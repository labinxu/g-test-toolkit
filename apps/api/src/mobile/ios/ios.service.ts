import { Injectable } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import { LoggerService } from 'src/logger/logger.service';
import { CustomLogger } from 'src/logger/logger.custom';

type RunResult = { stdout: string; stderr: string; code: number };

export interface IosInitOptions {
  deviceName?: string; // e.g., "iPhone 15"
  runtime?: string; // e.g., "iOS-17-5" or "17.5"
  udid?: string; // specific simulator UDID
  port?: number; // Appium port (default 4723)
  clientId?: string; // for websocket log streaming
}

@Injectable()
export class IosService {
  private logger: CustomLogger;
  private appiumProc: ChildProcess | null = null;

  constructor(private readonly loggerService: LoggerService) {
    this.logger = this.loggerService.createLogger('IosService');
  }

  private runCommand(
    cmd: string,
    args: string[],
    clientId?: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const proc = spawn(cmd, args, { stdio: 'pipe' });
        proc.stdout.on('data', (data) => {
          const msg = data.toString();
          clientId
            ? this.logger.sendTo(clientId, msg, 'info')
            : this.logger.info(msg);
        });
        proc.stderr.on('data', (data) => {
          const msg = data.toString();
          clientId
            ? this.logger.sendTo(clientId, msg, 'error')
            : this.logger.error(msg);
        });
        proc.on('error', (err) => {
          const msg = `Failed to start command ${cmd}: ${err.message}`;
          clientId
            ? this.logger.sendTo(clientId, msg, 'error')
            : this.logger.error(msg);
          reject(err);
        });
        proc.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`${cmd} exited with code ${code}`));
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  private runCommandCapture(
    cmd: string,
    args: string[],
    clientId?: string,
  ): Promise<RunResult> {
    return new Promise((resolve) => {
      const proc = spawn(cmd, args, { stdio: 'pipe' });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (data) => {
        const msg = data.toString();
        stdout += msg;
        clientId
          ? this.logger.sendTo(clientId, msg, 'info')
          : this.logger.info(msg);
      });
      proc.stderr.on('data', (data) => {
        const msg = data.toString();
        stderr += msg;
        clientId
          ? this.logger.sendTo(clientId, msg, 'error')
          : this.logger.error(msg);
      });
      proc.on('close', (code) => {
        resolve({ stdout, stderr, code: code ?? 0 });
      });
    });
  }

  private normalizeRuntime(runtime?: string): string | null {
    if (!runtime) return null;
    const r = runtime.trim();
    if (!r) return null;
    if (/^\d+(\.\d+)?$/.test(r)) {
      return `iOS-${r.replace(/\./g, '-')}`.toLowerCase();
    }
    return r.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '-');
  }

  private async ensureSimulatorBooted(params: {
    deviceName?: string;
    runtime?: string;
    udid?: string;
    clientId?: string;
  }): Promise<void> {
    const { deviceName, runtime, udid, clientId } = params || {};

    // If UDID is provided, try it directly
    if (udid) {
      try {
        await this.runCommand('xcrun', ['simctl', 'boot', udid], clientId);
      } catch {
        // ignore boot errors (likely already booted)
      }
      await this.runCommand(
        'xcrun',
        ['simctl', 'bootstatus', udid, '-b'],
        clientId,
      );
      try {
        await this.runCommand(
          'open',
          ['-a', 'Simulator', '--args', '-CurrentDeviceUDID', udid],
          clientId,
        );
      } catch {
        await this.runCommand(
          'open',
          [
            '-b',
            'com.apple.iphonesimulator',
            '--args',
            '-CurrentDeviceUDID',
            udid,
          ],
          clientId,
        );
      }
      return;
    }

    const { stdout } = await this.runCommandCapture(
      'xcrun',
      ['simctl', 'list', 'devices', 'available', '-j'],
      clientId,
    );
    let data: any;
    try {
      data = JSON.parse(stdout);
    } catch {
      throw new Error(
        'Failed to parse simctl output. Ensure Xcode Command Line Tools are installed.',
      );
    }

    const devicesByRuntime: Record<string, any[]> = data?.devices || {};
    const normalizedRuntime = this.normalizeRuntime(runtime);

    type Candidate = { runtimeKey: string; dev: any };
    const candidates: Candidate[] = [];

    for (const [rKey, list] of Object.entries(devicesByRuntime)) {
      const lowerKey = rKey.toLowerCase();
      if (!lowerKey.includes('ios')) continue;
      if (normalizedRuntime && !lowerKey.includes(normalizedRuntime)) continue;
      for (const dev of list as any[]) {
        const available = dev.isAvailable !== false && !dev.availabilityError;
        const nameMatch = deviceName ? dev.name === deviceName : true;
        if (available && nameMatch) {
          candidates.push({ runtimeKey: rKey, dev });
        }
      }
    }

    if (candidates.length === 0) {
      const hint =
        deviceName || normalizedRuntime
          ? ` (device=${deviceName || ''}, runtime=${runtime || ''})`
          : '';
      const availableSummary: string[] = [];
      for (const [rk, list] of Object.entries(devicesByRuntime)) {
        if (!rk.toLowerCase().includes('ios')) continue;
        for (const d of list as any[]) {
          if (d.isAvailable !== false && !d.availabilityError) {
            availableSummary.push(`${d.name} | ${rk} | ${d.state}`);
          }
        }
      }
      const msg =
        `No available iOS Simulator found${hint}. ` +
        `Try params: device=<name>&runtime=<iOS-17-5|17.5>&udid=<UDID>.\n` +
        `Available (showing up to 20):\n` +
        (availableSummary.slice(0, 20).join('\n') || 'None');
      clientId
        ? this.logger.sendTo(clientId, msg, 'warn')
        : this.logger.warn(msg);
      throw new Error(`No available iOS Simulator found${hint}.`);
    }

    let target =
      candidates.find((c) => c.dev.state === 'Booted') || candidates[0];
    const targetUdid = target.dev.udid as string;
    const selMsg = `Using Simulator: ${target.dev.name} | ${target.runtimeKey} | ${target.dev.state} | UDID=${targetUdid}`;
    clientId
      ? this.logger.sendTo(clientId, selMsg, 'info')
      : this.logger.info(selMsg);

    try {
      await this.runCommand('xcrun', ['simctl', 'boot', targetUdid], clientId);
    } catch {
      // ignore boot errors (likely already booted)
    }
    await this.runCommand(
      'xcrun',
      ['simctl', 'bootstatus', targetUdid, '-b'],
      clientId,
    );

    try {
      await this.runCommand(
        'open',
        ['-a', 'Simulator', '--args', '-CurrentDeviceUDID', targetUdid],
        clientId,
      );
    } catch {
      await this.runCommand(
        'open',
        [
          '-b',
          'com.apple.iphonesimulator',
          '--args',
          '-CurrentDeviceUDID',
          targetUdid,
        ],
        clientId,
      );
    }
  }

  async initEnvironment(options: IosInitOptions = {}): Promise<void> {
    const { clientId, deviceName, runtime, udid, port = 4723 } = options;
    try {
      clientId &&
        this.logger.sendTo(
          clientId,
          'Initializing iOS test environment...',
          'info',
        );

      // Check Xcode installation
      await this.runCommand('xcode-select', ['-p'], clientId);

      // Ensure Simulator is booted and focus the target one
      await this.ensureSimulatorBooted({ deviceName, runtime, udid, clientId });

      // Appium doctor (optional but helpful)
      try {
        await this.runCommand('npx', ['--yes', 'appium-doctor', '--ios'], clientId);
      } catch {
        try {
          // fallback to -y for older npx
          await this.runCommand('npx', ['-y', 'appium-doctor', '--ios'], clientId);
        } catch {
          this.logger.warn('appium-doctor failed (non-fatal)', 'warn');
        }
      }

      // Install Appium XCUITest driver (best-effort)
      let hasXcui = false;
      try {
        const res = await this.runCommandCapture('npx', ['--yes', 'appium', 'driver', 'list', '--installed'], clientId);
        hasXcui = /xcuitest/i.test(res.stdout);
      } catch {
        // ignore, will try install directly
      }
      if (!hasXcui) {
        try {
          await this.runCommand('npx', ['--yes', 'appium', 'driver', 'install', 'xcuitest'], clientId);
        } catch {
          try {
            // fallback to -y for older npx
            await this.runCommand('npx', ['-y', 'appium', 'driver', 'install', 'xcuitest'], clientId);
          } catch (e) {
            this.logger.warn(
              `Failed to install Appium XCUITest driver: ${
                e instanceof Error ? e.message : String(e)
              } (non-fatal)`,
            );
          }
        }
      }

      // Start Appium server if not already started
      if (this.appiumProc && !this.appiumProc.killed) {
        this.logger.sendTo(
          clientId,
          'Appium server is already running.',
          'info',
        );
        return;
      }

      clientId &&
        this.logger.sendTo(
          clientId,
          `Starting Appium server on port ${port}...`,
          'info',
        );

      // Determine how to launch Appium (prefer npx, fallback to global)
      let appiumCmd = 'npx';
      let appiumArgs = ['--yes', 'appium', '-p', String(port)];
      try {
        const checkNpx = await this.runCommandCapture('npx', ['--yes', 'appium', '--version'], clientId);
        if (checkNpx.code !== 0) {
          const checkGlobal = await this.runCommandCapture('appium', ['--version'], clientId);
          if (checkGlobal.code === 0) {
            appiumCmd = 'appium';
            appiumArgs = ['-p', String(port)];
          } else {
            this.logger.warn('Appium is not available via npx or globally. Skipping Appium server start.', 'warn');
            return;
          }
        }
      } catch {
        // If checks threw unexpectedly, try global appium as fallback
        const checkGlobal = await this.runCommandCapture('appium', ['--version'], clientId);
        if (checkGlobal.code === 0) {
          appiumCmd = 'appium';
          appiumArgs = ['-p', String(port)];
        } else {
          this.logger.warn('Appium is not available via npx or globally. Skipping Appium server start.', 'warn');
          return;
        }
      }

      this.appiumProc = spawn(appiumCmd, appiumArgs, {
        stdio: 'pipe',
      });

      this.appiumProc.stdout?.on('data', (data) => {
        const msg = data.toString();
        clientId
          ? this.logger.sendTo(clientId, msg, 'info')
          : this.logger.info(msg);
      });
      this.appiumProc.stderr?.on('data', (data) => {
        const msg = data.toString();
        clientId
          ? this.logger.sendTo(clientId, msg, 'error')
          : this.logger.error(msg);
      });
      this.appiumProc.on('exit', (code) => {
        const msg = `Appium server exited with code ${code}`;
        clientId
          ? this.logger.sendTo(clientId, msg, 'warn')
          : this.logger.warn(msg);
        this.appiumProc = null;
      });

      clientId &&
        this.logger.sendTo(
          clientId,
          'iOS environment initialization completed.',
          'info',
        );
    } catch (error: any) {
      const msg = `iOS initialization failed: ${error?.message || String(error)}`;
      clientId && this.logger.sendTo(clientId, msg, 'error');
      throw error;
    }
  }

  /**
   * List iOS simulators via `xcrun simctl list devices`.
   * Use availableOnly=true to restrict to available devices.
   * Optional filters by device name substring and runtime substring.
   */
  async listSimulators(options: {
    availableOnly?: boolean;
    clientId?: string;
    name?: string;
    runtime?: string;
  } = {}): Promise<
    { name: string; udid: string; runtime: string; state: string; isAvailable: boolean }[]
  > {
    const { availableOnly = true, clientId, name, runtime } = options;
    const args = ['simctl', 'list', 'devices'];
    if (availableOnly) {
      args.push('available');
    }
    args.push('-j');

    const { stdout } = await this.runCommandCapture('xcrun', args, clientId);
    let data: any;
    try {
      data = JSON.parse(stdout);
    } catch {
      throw new Error(
        'Failed to parse simctl output. Ensure Xcode Command Line Tools are installed.',
      );
    }

    const devicesByRuntime: Record<string, any[]> = data?.devices || {};
    const list: { name: string; udid: string; runtime: string; state: string; isAvailable: boolean }[] = [];

    for (const [runtimeKey, devices] of Object.entries(devicesByRuntime)) {
      for (const dev of devices as any[]) {
        list.push({
          name: dev.name,
          udid: dev.udid,
          runtime: runtimeKey,
          state: dev.state,
          isAvailable: dev.isAvailable !== false && !dev.availabilityError,
        });
      }
    }

    const nameFilter = (name || '').toLowerCase();
    const runtimeFilter = (runtime || '').toLowerCase();

    const filtered = list.filter((d) => {
      const nameOk = nameFilter ? d.name.toLowerCase().includes(nameFilter) : true;
      const runtimeOk = runtimeFilter ? d.runtime.toLowerCase().includes(runtimeFilter) : true;
      return nameOk && runtimeOk;
    });

    // Sort: available and Booted first, then by name
    filtered.sort((a, b) => {
      const availScoreA = (a.isAvailable ? 1 : 0) + (a.state === 'Booted' ? 1 : 0);
      const availScoreB = (b.isAvailable ? 1 : 0) + (b.state === 'Booted' ? 1 : 0);
      if (availScoreA !== availScoreB) return availScoreB - availScoreA;
      return a.name.localeCompare(b.name);
    });

    return filtered;
  }
}
