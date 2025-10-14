import { Injectable } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import { LoggerService } from 'src/logger/logger.service';
import { CustomLogger } from 'src/logger/logger.custom';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

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
  private appiumHome: string | null = null;

  constructor(private readonly loggerService: LoggerService) {
    this.logger = this.loggerService.createLogger('IosService');
  }

  private runCommand(
    cmd: string,
    args: string[],
    clientId?: string,
    opts?: { cwd?: string; env?: NodeJS.ProcessEnv; silent?: boolean },
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const proc = spawn(cmd, args, {
          stdio: 'pipe',
          cwd: opts?.cwd,
          env: opts?.env ? { ...process.env, ...opts.env } : process.env,
        });
        proc.stdout.on('data', (data) => {
          if (!opts?.silent) {
            const msg = data.toString();
            clientId
              ? this.logger.sendTo(clientId, msg, 'info')
              : this.logger.info(msg);
          }
        });
        proc.stderr.on('data', (data) => {
          if (!opts?.silent) {
            const msg = data.toString();
            clientId
              ? this.logger.sendTo(clientId, msg, 'error')
              : this.logger.error(msg);
          }
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
    opts?: { cwd?: string; env?: NodeJS.ProcessEnv; silent?: boolean },
  ): Promise<RunResult> {
    return new Promise((resolve) => {
      const proc = spawn(cmd, args, {
        stdio: 'pipe',
        cwd: opts?.cwd,
        env: opts?.env ? { ...process.env, ...opts.env } : process.env,
      });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (data) => {
        const msg = data.toString();
        stdout += msg;
        if (!opts?.silent) {
          clientId
            ? this.logger.sendTo(clientId, msg, 'info')
            : this.logger.info(msg);
        }
      });
      proc.stderr.on('data', (data) => {
        const msg = data.toString();
        stderr += msg;
        if (!opts?.silent) {
          clientId
            ? this.logger.sendTo(clientId, msg, 'error')
            : this.logger.error(msg);
        }
      });
      proc.on('close', (code) => {
        resolve({ stdout, stderr, code: code ?? 0 });
      });
    });
  }

  private async hasPnpm(clientId?: string): Promise<boolean> {
    try {
      const res = await this.runCommandCapture('pnpm', ['--version'], clientId, { silent: true });
      return res.code === 0;
    } catch {
      return false;
    }
  }

  private ensureTempAppiumHome(): string {
    if (this.appiumHome && fs.existsSync(this.appiumHome)) return this.appiumHome;
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'appium-home-'));
    // Create minimal package.json to avoid workspace detection by npm
    try {
      fs.writeFileSync(
        path.join(tmpHome, 'package.json'),
        JSON.stringify({ name: 'appium-temp', version: '1.0.0' }),
      );
    } catch {}
    this.appiumHome = tmpHome;
    return tmpHome;
  }

  private envWithAppiumHome(): NodeJS.ProcessEnv | undefined {
    return this.appiumHome ? { APPIUM_HOME: this.appiumHome } as any : undefined;
  }

  private async dlxRun(
    binary: string,
    args: string[],
    clientId?: string,
    opts?: { cwd?: string; env?: NodeJS.ProcessEnv; silent?: boolean },
  ): Promise<void> {
    if (await this.hasPnpm(clientId)) {
      await this.runCommand('pnpm', ['dlx', binary, ...args], clientId, opts);
    } else {
      await this.runCommand('npx', ['--yes', binary, ...args], clientId, opts);
    }
  }

  private async dlxCapture(
    binary: string,
    args: string[],
    clientId?: string,
    opts?: { cwd?: string; env?: NodeJS.ProcessEnv; silent?: boolean },
  ): Promise<RunResult> {
    if (await this.hasPnpm(clientId)) {
      return await this.runCommandCapture('pnpm', ['dlx', binary, ...args], clientId, opts);
    } else {
      return await this.runCommandCapture('npx', ['--yes', binary, ...args], clientId, opts);
    }
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
  }): Promise<{ udid: string; name?: string; runtime?: string }> {
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

      const info = await this.lookupSimulatorByUdid(udid, clientId);
      return {
        udid,
        name: info?.name,
        runtime: info?.runtime,
      };
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

    return {
      udid: targetUdid,
      name: target.dev.name,
      runtime: target.runtimeKey,
    };
  }

  private async lookupSimulatorByUdid(udid: string, clientId?: string) {
    const { stdout } = await this.runCommandCapture(
      'xcrun',
      ['simctl', 'list', 'devices', 'available', '-j'],
      clientId,
    );
    try {
      const data = JSON.parse(stdout);
      for (const [runtimeKey, devices] of Object.entries<any[]>(
        data?.devices || {},
      )) {
        for (const dev of devices) {
          if ((dev.udid as string)?.toLowerCase() === udid.toLowerCase()) {
            return { name: dev.name as string, runtime: runtimeKey as string, state: dev.state as string };
          }
        }
      }
    } catch {}
    return null;
  }

  private async installXcuiDriver(clientId?: string): Promise<boolean> {
    // Check if installed already
    try {
      const env = this.envWithAppiumHome();
      const listRes = await this.dlxCapture(
        'appium',
        ['driver', 'list', '--installed'],
        clientId,
        { silent: true, env },
      );
      if (listRes.code === 0 && /xcuitest/i.test(listRes.stdout)) {
        return true;
      }
    } catch {
      // continue to install attempts
    }

    // Try standard install via pnpm dlx (preferred) or npx
    let res = await this.dlxCapture(
      'appium',
      ['driver', 'install', 'xcuitest'],
      clientId,
    );
    if (res.code === 0) {
      return true;
    }

    // Workspace-safe fallback: isolate APPIUM_HOME and working directory
    try {
      const tmpHome = this.ensureTempAppiumHome();
      const env = { APPIUM_HOME: tmpHome };

      // Install driver in isolated APPIUM_HOME and isolated cwd
      res = await this.dlxCapture(
        'appium',
        ['driver', 'install', 'xcuitest'],
        clientId,
        { env, cwd: tmpHome },
      );

      if (res.code === 0) {
        const verify = await this.dlxCapture(
          'appium',
          ['driver', 'list', '--installed'],
          clientId,
          { env, cwd: tmpHome, silent: true },
        );
        if (verify.code === 0 && /xcuitest/i.test(verify.stdout)) {
          this.appiumHome = tmpHome;
          return true;
        }
      }
    } catch {
      // ignore and continue to other fallbacks
    }

    // Fallback: use global appium if present
    try {
      const hasGlobal = await this.runCommandCapture('appium', ['--version'], clientId, { silent: true });
      if (hasGlobal.code === 0) {
        const env = this.appiumHome ? { APPIUM_HOME: this.appiumHome } : undefined;
        res = await this.runCommandCapture('appium', ['driver', 'install', 'xcuitest'], clientId, { env });
        if (res.code === 0) {
          const verify = await this.runCommandCapture('appium', ['driver', 'list', '--installed'], clientId, { env, silent: true });
          if (verify.code === 0 && /xcuitest/i.test(verify.stdout)) {
            return true;
          }
        }
      }
    } catch {
      // ignore
    }

    return false;
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
        await this.dlxRun('appium-doctor', ['--ios'], clientId);
      } catch {
        this.logger.warn('appium-doctor failed (non-fatal)', 'warn');
      }

      // Install Appium XCUITest driver (best-effort, workspace-safe)
      const installed = await this.installXcuiDriver(clientId);
      if (!installed) {
        this.logger.warn(
          'XCUITest driver not installed. Try: pnpm dlx appium driver install xcuitest (or ensure Appium v2 is installed).',
          'warn',
        );
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

      // Determine how to launch Appium (prefer pnpm dlx, then npx, then global)
      let appiumCmd = 'pnpm';
      let appiumArgs = ['dlx', 'appium', '-p', String(port)];

      const tryPnpm = await this.runCommandCapture('pnpm', ['--version'], clientId, { silent: true });
      if (tryPnpm.code !== 0) {
        // fallback to npx
        appiumCmd = 'npx';
        appiumArgs = ['--yes', 'appium', '-p', String(port)];
        const checkNpx = await this.runCommandCapture('npx', ['--yes', 'appium', '--version'], clientId, { silent: true });
        if (checkNpx.code !== 0) {
          const checkGlobal = await this.runCommandCapture('appium', ['--version'], clientId, { silent: true });
          if (checkGlobal.code === 0) {
            appiumCmd = 'appium';
            appiumArgs = ['-p', String(port)];
          } else {
            this.logger.warn('Appium is not available via pnpm dlx, npx or globally. Skipping Appium server start.', 'warn');
            return;
          }
        }
      } else {
        // ensure appium is resolvable via pnpm dlx
        const checkDlx = await this.runCommandCapture('pnpm', ['dlx', 'appium', '--version'], clientId, { silent: true });
        if (checkDlx.code !== 0) {
          // fallback to npx
          appiumCmd = 'npx';
          appiumArgs = ['--yes', 'appium', '-p', String(port)];
          const checkNpx = await this.runCommandCapture('npx', ['--yes', 'appium', '--version'], clientId, { silent: true });
          if (checkNpx.code !== 0) {
            const checkGlobal = await this.runCommandCapture('appium', ['--version'], clientId, { silent: true });
            if (checkGlobal.code === 0) {
              appiumCmd = 'appium';
              appiumArgs = ['-p', String(port)];
            } else {
              this.logger.warn('Appium is not available via pnpm dlx, npx or globally. Skipping Appium server start.', 'warn');
              return;
            }
          }
        }
      }

      this.appiumProc = spawn(appiumCmd, appiumArgs, {
        stdio: 'pipe',
        env: this.appiumHome ? { ...process.env, APPIUM_HOME: this.appiumHome } : process.env,
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
   * List iOS simulators and return Appium capabilities objects for each device.
   * Use availableOnly=true to restrict to available devices.
   * Optional filters by device name substring and runtime substring.
   */
  async listSimulators(options: {
    availableOnly?: boolean;
    clientId?: string;
    name?: string;
    runtime?: string;
    appPath?: string;
    xcodeSigningId?: string;
    wdaBundleId?: string;
  } = {}): Promise<{
    name: string;
    udid: string;
    runtime: string;
    state: string;
    isAvailable: boolean;
    platformVersion?: string;
    capabilities: Record<string, any>;
  }[]> {
    const { availableOnly = true, clientId, name, runtime } = options;
    const appPath =
      options.appPath ?? process.env.IOS_APP_PATH ?? undefined;
    const xcodeSigningId =
      options.xcodeSigningId ?? process.env.IOS_XCODE_SIGNING_ID ?? 'iPhone Developer';
    const wdaBundleId =
      options.wdaBundleId ?? process.env.IOS_WDA_BUNDLE_ID ?? 'com.gettr.WebDriverAgentRunner';

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

    // Convert runtime label to version string like "18.6"
    const toPlatformVersion = (runtimeKey: string): string | undefined => {
      // Supports "iOS 18.6", "iOS-18-6", or "...iOS-18-6"
      const m = runtimeKey.match(/iOS[\s-]?(\d+)(?:[.\-](\d+))?/i);
      if (m) {
        const major = m[1];
        const minor = m[2] ?? '0';
        return `${major}.${minor}`;
      }
      return undefined;
    };

    // Map to Appium capabilities shape
    const capabilities = filtered.map((d) => {
      const platformVersion = toPlatformVersion(d.runtime);
      const caps: any = {
        platformName: 'iOS',
        'appium:platformVersion': platformVersion,
        'appium:deviceName': d.name,
        'appium:udid': d.udid,
        'appium:automationName': 'XCUITest',
        'appium:xcodeSigningId': xcodeSigningId,
        'appium:updatedWDABundleId': wdaBundleId,
        'appium:useNewWDA': true,
        'appium:showXcodeLog': true,
        'appium:wdaStartupRetries': 3,
        'appium:autoGrantPermissions': true,
        'appium:autoAcceptAlerts': true,
        'appium:fullReset': true,
        'appium:noReset': false,
      };
      if (appPath) {
        caps['appium:app'] = appPath;
      }
      return {
        name: d.name,
        udid: d.udid,
        runtime: d.runtime,
        state: d.state,
        isAvailable: d.isAvailable,
        platformVersion,
        capabilities: caps,
      };
    });

    return capabilities;
  }

  async bootSimulator(options: {
    udid?: string;
    deviceName?: string;
    runtime?: string;
    clientId?: string;
  } = {}) {
    const info = await this.ensureSimulatorBooted(options);
    const sims = await this.listSimulators({
      availableOnly: false,
      clientId: options.clientId,
    });
    const matched = sims.find(
      (s) => s.udid.toLowerCase() === info.udid.toLowerCase(),
    );
    return {
      started: true,
      simulator:
        matched ?? {
          name: info.name ?? 'Unknown',
          udid: info.udid,
          runtime: info.runtime ?? '',
          state: 'Booted',
          isAvailable: true,
          platformVersion: undefined,
          capabilities: {},
        },
    };
  }

  async shutdownSimulator(options: { udid?: string; clientId?: string } = {}) {
    const sims = await this.listSimulators({
      availableOnly: false,
      clientId: options.clientId,
    });
    const target = options.udid
      ? sims.find((s) => s.udid.toLowerCase() === options.udid!.toLowerCase())
      : sims.find((s) => s.state === 'Booted');
    if (!target) {
      this.logger.info('No running iOS simulator detected. Nothing to shutdown.');
      return { stopped: false, simulator: null };
    }

    try {
      await this.runCommand('xcrun', ['simctl', 'shutdown', target.udid], options.clientId);
    } catch (err) {
      const message = (err as Error)?.message ?? String(err);
      this.logger.warn(`Failed to shutdown simulator ${target.udid}: ${message}`);
    }

    const updated = await this.listSimulators({
      availableOnly: false,
      clientId: options.clientId,
    });
    const refreshed = updated.find(
      (s) => s.udid.toLowerCase() === target.udid.toLowerCase(),
    );
    const simulator =
      refreshed ?? {
        ...target,
        state: 'Shutdown',
      };
    return { stopped: true, simulator };
  }
}
