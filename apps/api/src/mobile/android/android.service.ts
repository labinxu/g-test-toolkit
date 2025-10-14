import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandService } from 'src/command/command.service';
import { CustomLogger } from 'src/logger/logger.custom';
import { LoggerService } from 'src/logger/logger.service';
import { readFileSync } from 'fs';
import { XMLParser } from 'fast-xml-parser';
import { FastifyReply as Response } from 'fastify';
import { spawn, ChildProcess } from 'child_process';

@Injectable()
export class AndroidService {
  private logger: CustomLogger;
  private dumpedObj: any;
  private appiumProc: ChildProcess | null = null;
  private appiumPort: number | null = null;
  private devicesCache?: { at: number; output: string };
  constructor(
    private readonly commandService: CommandService,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.createLogger('AndroidService');
  }
  async getDevices() {
    const result = await this.commandService.runCommand('adb devices');
    return { devices: result.stdout };
  }
  async getScreen(deviceId: string) {
    try {
      if (!/^[a-zA-Z0-9_-]+$/.test(deviceId)) {
        throw new Error('Invalid device ID');
      }
      // await this.commandService.runCommand(
      //   `adb -s ${deviceId} shell wm density ${240}`,
      // );
      // this.logger.log(`Set density to ${density} for device ${deviceId}`);
      const tmpfile = `./tmp/imgs/screenshot-${deviceId}.png`;
      this.logger.debug(
        `execute:adb -s ${deviceId} shell screencap -p /sdcard/screenshot-${deviceId}.png`,
      );
      await this.commandService.runCommand(
        `adb -s ${deviceId} shell screencap -p /sdcard/screenshot-${deviceId}.png`,
      );
      this.logger.debug(
        `execute: adb -s ${deviceId} pull /scard/screenshot.png ./tmp/imgs`,
      );
      await this.commandService.runCommand(
        `adb -s ${deviceId} pull /sdcard/screenshot-${deviceId}.png ./tmp/imgs/screenshot-${deviceId}.png`,
      );
      this.logger.debug(
        `screenshot saved to ./tmp/imgs/screenshot-${deviceId}.png`,
      );

      // Reset density
      // await this.commandService.runCommand(
      //   `adb -s ${deviceId} shell wm density reset`,
      // );

      return tmpfile;
      //await sharp(tmpfile)
      //  .resize({ width: 220, height: 360, fit: 'fill' })
      //  .toFile(`./tmp/imgs/screenshot-${deviceId}-resize.png`);
      //return `./tmp/imgs/screenshot-${deviceId}-resize.png`;
    } catch (error) {
      this.logger.error('Failed to capture screenshot');
      throw new NotFoundException(
        `Failed to capture screenshot for device ${deviceId}`,
      );
    }
  }
  async streamScreen(deviceId: string) {
    const filePath = await this.getScreen(deviceId);
    if (!require('fs').existsSync(filePath)) {
      this.logger.error(`Screenshot file not found at ${filePath}`);
      throw new NotFoundException('Screenshot file not found');
    }
    return filePath;
  }

  async screenOn(
    deviceId: string,
    checkKeywords = 'holding display',
    password = '125698',
    swipeData: string,
  ) {
    await this.commandService.unlockScreen(
      deviceId,
      checkKeywords,
      password,
      swipeData,
    );
  }
  async goHome(deviceId: string) {
    await this.commandService.home(deviceId);
  }
  async dumpxml(deviceId: string, res: Response) {
    try {
      if (!/^[a-zA-Z0-9_-]+$/.test(deviceId)) {
        throw new Error('Invalid device ID');
      }
      const dumpcommand = `adb -s ${deviceId} shell uiautomator dump`;
      await this.commandService.runCommand(dumpcommand);
      this.logger.debug(dumpcommand);
      const xmlfilepath = `./tmp/window_dump-${deviceId}.xml`;
      const pullcommand = `adb -s ${deviceId} pull /sdcard/window_dump.xml ${xmlfilepath}`;
      await this.commandService.runCommand(pullcommand);
      this.logger.debug(pullcommand);
      res.header('content-type', 'file/xml');
      const fileStream = readFileSync(xmlfilepath);
      res.send(fileStream);
    } catch (err) {}
  }
  findNode(node: any, attribute: string, text: string) {
    if (!node) return null;
    if (node[`@_${attribute}`] === text) {
      return node; // 找到即返回
    }
    // 递归子节点（node 可能有 node 或 node 数组）
    if (node.node) {
      if (Array.isArray(node.node)) {
        for (const child of node.node) {
          const found = this.findNode(child, attribute, text);
          if (found) return found;
        }
      } else {
        return this.findNode(node.node, attribute, text);
      }
    }
    return null;
  }

  async dumpxmlTo(deviceId: string, workspace: string) {
    try {
      if (!/^[a-zA-Z0-9_-]+$/.test(deviceId)) {
        throw new Error('Invalid device ID');
      }
      const { stdout, stderr } = await this.commandService.dumpxml(deviceId);
      this.logger.debug(stderr.toString());
      this.logger.debug(stdout.toString());
      const xmlfilepath = `${workspace}/window_dump-${deviceId}.xml`;
      await this.commandService.pullDumpedXml(deviceId, xmlfilepath);
      const xmlstring = readFileSync(xmlfilepath);
      const parser = new XMLParser({ ignoreAttributes: false });
      this.dumpedObj = parser.parse(xmlstring);
      return xmlfilepath;
    } catch (err) {
      throw new Error(`${err}`);
    }
  }

  async click(deviceId: string, attribute: string, text: string) {
    const node = this.findNode(this.dumpedObj.hierarchy.node, attribute, text);
    if (!node) {
      this.logger.info(`${attribute} ${text} not found`);
      return;
    }
    this.logger.info(JSON.stringify(node));
    const match = node['@_bounds'].match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    if (match) {
      const x1 = parseInt(match[1]);
      const y1 = parseInt(match[2]);
      const x2 = parseInt(match[3]);
      const y2 = parseInt(match[4]);

      const cmd = `adb -s ${deviceId} shell input tap ${(x1 + x2) / 2} ${(y1 + y2) / 2}`;
      await this.commandService.runCommand(cmd);
    } else {
      this.logger.error(`Error found bounds`);
    }
  }
  async hasNotifIncludesText(
    deviceId: string,
    searchString: string,
  ): Promise<boolean> {
    return await this.commandService.dumpNotifWithText(deviceId, searchString);
  }
  async expandNotifBar(deviceId: string) {
    await this.commandService.expandNotifBar(deviceId);
  }
  async clearAllNotif(
    deviceId: string,
    keywords = 'holding display',
    password = '125698',
    swipeData: string,
    attribute = 'text',
    text = 'Clear all',
  ) {
    await this.commandService.unlockScreen(
      deviceId,
      keywords,
      password,
      swipeData,
    );
    const dumppath = `.`;
    await this.commandService.expandNotifBar(deviceId);
    const tmpfile = await this.dumpxmlTo(deviceId, dumppath);
    await this.click(deviceId, attribute, text);
    // await unlink(tmpfile);
  }
  async snapscreenTo(deviceId: string, filePath: string) {
    await this.commandService.snapshot(deviceId);
    await this.commandService.pullSnapshot(deviceId, filePath);
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async run(cmd: string) {
    return await this.commandService.runCommand(cmd);
  }

  private async listAvds(): Promise<string[]> {
    try {
      const { stdout } = await this.run('emulator -list-avds');
      return stdout
        .toString()
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  async listEmulators(): Promise<string[]> {
    return await this.listAvds();
  }

  private async adbDevices(force = false): Promise<string> {
    if (
      !force &&
      this.devicesCache &&
      Date.now() - this.devicesCache.at < 1500
    ) {
      return this.devicesCache.output;
    }
    const { stdout } = await this.run('adb devices');
    const output = stdout.toString();
    this.devicesCache = { at: Date.now(), output };
    return output;
  }

  async getRunningEmulator(
    force = false,
  ): Promise<{ serial: string; avd: string | null; deviceName: string | null } | null> {
    const serial = await this.getBootedEmulatorSerial(force);
    if (!serial) return null;
    let avd: string | null = null;
    try {
      const { stdout } = await this.run(`adb -s ${serial} emu avd name`);
      const parts = stdout
        .toString()
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length) {
        const candidate = parts[parts.length - 1];
        avd = candidate && candidate.toLowerCase() !== 'ok' ? candidate : null;
      }
    } catch {
      avd = null;
    }
    if (!avd) {
      try {
        const { stdout } = await this.run(
          `adb -s ${serial} shell getprop ro.boot.qemu.avd_name`,
        );
        const candidate = stdout.toString().trim();
        if (candidate) {
          avd = candidate;
        }
      } catch {
        avd = null;
      }
    }
    const deviceName = serial;
    return { serial, avd, deviceName };
  }

  async getBootedEmulatorSerial(force = false): Promise<string | null> {
    try {
      const list = await this.adbDevices(force);
      const lines = list.split('\n');
      for (const line of lines) {
        const m = line.match(/^(emulator-\d+)\s+device/);
        if (m) return m[1];
      }
      return null;
    } catch {
      return null;
    }
  }

  async startEmulator(avd: string, headless = false) {
    const args = [
      '-avd',
      avd,
      '-no-boot-anim',
      '-netdelay',
      'none',
      '-netspeed',
      'full',
    ];
    if (headless) {
      args.push('-no-window');
    }
    this.logger.info(`Starting Android emulator: emulator ${args.join(' ')}`);
    const env: NodeJS.ProcessEnv = {
      ...(process.env as NodeJS.ProcessEnv),
      ANDROID_EMULATOR_USE_SYSTEM_LIBS: '1',
      QTWEBENGINE_DISABLE_SANDBOX: '1',
    };
    if (!env.ANDROID_SDK_ROOT && process.env.ANDROID_HOME) {
      env.ANDROID_SDK_ROOT = process.env.ANDROID_HOME;
    }
    // Start emulator in background
    const proc = spawn('emulator', args, {
      stdio: 'ignore',
      detached: true,
      env,
    });
    proc.unref();
  }

  async waitForBootCompleted(serial: string, timeoutMs = 180000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const { stdout } = await this.run(
          `adb -s ${serial} shell getprop sys.boot_completed`,
        );
        if (stdout.toString().trim() === '1') {
          // optional small delay to allow system stabilization
          await this.sleep(2000);
          return;
        }
      } catch {}
      await this.sleep(3000);
    }
    throw new Error(
      `Emulator ${serial} boot timeout after ${Math.round(timeoutMs / 1000)}s`,
    );
  }

  async startStandaloneEmulator(
    avd: string,
    headless = false,
  ): Promise<{ serial: string; avd: string | null; deviceName: string | null }> {
    await this.run('adb start-server').catch(() => {});

    const avds = await this.listAvds();
    if (!avds.includes(avd)) {
      throw new NotFoundException(`AVD ${avd} does not exist`);
    }

    const running = await this.getRunningEmulator();
    if (running) {
      this.logger.info(`Emulator already running: ${running.serial}`);
      return running;
    }

    await this.startEmulator(avd, headless);

    let serial: string | null = null;
    for (let i = 0; i < 90; i++) {
      serial = await this.getBootedEmulatorSerial(true);
      if (serial) break;
      await this.sleep(2000);
    }
    if (!serial) {
      throw new NotFoundException(
        'Failed to detect emulator serial after starting AVD.',
      );
    }

    try {
      await this.run(`adb -s ${serial} wait-for-device`);
    } catch {}
    await this.waitForBootCompleted(serial);

    const runningInfo = await this.getRunningEmulator(true);
    await this.ensureAppiumServer(this.appiumPort ?? 4723);
    return {
      serial,
      avd: runningInfo?.avd ?? avd,
      deviceName: runningInfo?.deviceName ?? serial,
    };
  }

  async stopEmulator(
    serial?: string,
  ): Promise<{
    stopped: boolean;
    serial?: string;
    avd?: string | null;
    deviceName?: string | null;
  }> {
    const running = await this.getRunningEmulator(true);
    const targetSerial = serial || running?.serial;
    if (!targetSerial) {
      this.logger.info('No running Android emulator detected. Nothing to stop.');
      this.stopAppiumServer();
      return { stopped: false };
    }
    this.logger.info(`Stopping Android emulator: ${targetSerial}`);
    try {
      await this.run(`adb -s ${targetSerial} emu kill`);
    } catch (err) {
      const message = (err as Error)?.message ?? String(err);
      this.logger.warn(`Failed to stop emulator ${targetSerial}: ${message}`);
      // continue even if kill fails (already stopped, etc.)
    }
    this.devicesCache = undefined;
    const stillRunning = await this.getBootedEmulatorSerial(true);
    if (!stillRunning) {
      this.stopAppiumServer();
    }
    return {
      stopped: true,
      serial: targetSerial,
      avd: running?.avd ?? null,
      deviceName: running?.deviceName ?? null,
    };
  }

  private async ensureUiAutomator2Installed() {
    // Check installed drivers
    try {
      const res = await this.run('yarn dlx -q appium driver list --installed');
      const out = res?.stdout?.toString() ?? '';
      if (/uiautomator2/i.test(out)) return;
    } catch {
      // ignore
    }

    // Try to install via yarn dlx
    try {
      await this.run('yarn dlx appium driver install uiautomator2');
      return;
    } catch (e) {
      this.logger.warn(
        'Failed to install Appium UiAutomator2 via yarn dlx, falling back to npx (non-fatal)',
      );
    }

    // Fallback to npx
    try {
      const list = await this.run('npx --yes appium driver list --installed');
      if (!/uiautomator2/i.test(list?.stdout?.toString() ?? '')) {
        await this.run('npx --yes appium driver install uiautomator2');
      }
    } catch {
      this.logger.warn(
        'Failed to install Appium UiAutomator2 driver (non-fatal)',
      );
    }
  }

  private async ensureAppiumServer(port = 4723) {
    if (this.appiumProc && !this.appiumProc.killed) {
      this.logger.info(
        `Appium server already running on port ${this.appiumPort ?? port}.`,
      );
      return { started: false, port: this.appiumPort ?? port };
    }

    this.logger.info(`Starting Appium server on port ${port}...`);
    let cmd = 'yarn';
    let args = ['dlx', 'appium', '-p', String(port)];
    try {
      const checkYarn = await this.run('yarn dlx appium --version');
      if (!checkYarn?.stdout?.toString()?.trim()) {
        cmd = 'npx';
        args = ['--yes', 'appium', '-p', String(port)];
      }
    } catch {
      cmd = 'npx';
      args = ['--yes', 'appium', '-p', String(port)];
    }

    this.appiumProc = spawn(cmd, args, { stdio: 'pipe' });
    this.appiumPort = port;
    this.appiumProc.stdout?.on('data', (data) => {
      this.logger.info(data.toString());
    });
    this.appiumProc.stderr?.on('data', (data) => {
      this.logger.error(data.toString());
    });
    this.appiumProc.on('exit', (code) => {
      this.logger.warn(`Appium server exited with code ${code}`);
      this.appiumProc = null;
      this.appiumPort = null;
    });

    return { started: true, port };
  }

  private stopAppiumServer() {
    if (!this.appiumProc || this.appiumProc.killed) {
      this.appiumProc = null;
      this.appiumPort = null;
      return false;
    }

    this.logger.info('Stopping Appium server...');
    try {
      const killed = this.appiumProc.kill();
      if (!killed) {
        process.kill(this.appiumProc.pid, 'SIGTERM');
      }
    } catch (err) {
      this.logger.warn(
        `Failed to stop Appium server: ${(err as Error)?.message ?? err}`,
      );
    }
    this.appiumProc = null;
    this.appiumPort = null;
    return true;
  }

  /**
   * Initialize Android emulator and Appium test environment.
   * Steps:
   *  - Ensure ADB server is running
   *  - Start AVD emulator (or reuse if already booted)
   *  - Wait for boot completion
   *  - Run appium-doctor (android)
   *  - Ensure UiAutomator2 driver installed
   *  - Start Appium server on given port (yarn dlx/npx/global)
   */
  async initAndroidEnvironment(
    options: { avd?: string; headless?: boolean; port?: number } = {},
  ) {
    const { avd, headless = false, port = 4723 } = options;
    this.logger.info('Initializing Android test environment...');

    // Ensure ADB is running
    try {
      await this.run('adb start-server');
    } catch {}

    // Determine target AVD
    let targetAvd = avd;
    const avds = await this.listAvds();
    if (!targetAvd) {
      targetAvd = avds[0];
    }
    if (!targetAvd) {
      throw new NotFoundException(
        'No Android AVD found. Please create an emulator via avdmanager / Android Studio.',
      );
    }

    // Start emulator if not already running
    let serial = await this.getBootedEmulatorSerial();
    if (!serial) {
      await this.startEmulator(targetAvd, headless);
      // Wait for emulator to appear
      for (let i = 0; i < 90; i++) {
        serial = await this.getBootedEmulatorSerial();
        if (serial) break;
        await this.sleep(2000);
      }
      if (!serial) {
        throw new NotFoundException(
          'Failed to detect emulator serial after starting AVD.',
        );
      }
      // Wait for device ready and boot completed
      try {
        await this.run(`adb -s ${serial} wait-for-device`);
      } catch {}
      await this.waitForBootCompleted(serial);
    } else {
      this.logger.info(`Reusing booted emulator: ${serial}`);
    }

    // Appium doctor (android) - best effort
    try {
      await this.run('yarn dlx appium-doctor --android');
    } catch {
      this.logger.warn('appium-doctor (android) failed (non-fatal)');
    }

    // Ensure UiAutomator2 driver
    await this.ensureUiAutomator2Installed();

    await this.ensureAppiumServer(port);
  }
}
