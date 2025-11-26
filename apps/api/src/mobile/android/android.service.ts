import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandService } from 'src/command/command.service';
import { CustomLogger } from 'src/logger/logger.custom';
import { LoggerService } from 'src/logger/logger.service';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { XMLParser } from 'fast-xml-parser';
import { FastifyReply as Response } from 'fastify';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as os from 'os';

@Injectable()
export class AndroidService {
  private readonly creatableAvdTemplates = [
    {
      id: 'pixel5-android13',
      label: 'Pixel 5 - Android 13 (API 33)',
      description:
        'Google APIs image, Android 13 (API level 33), arm64-v8a architecture, Pixel 5 profile.',
      deviceId: 'pixel_5',
      systemImage: 'system-images;android-33;google_apis;arm64-v8a',
      defaultName: 'pixel5-api33',
    },
    {
      id: 'pixel8-android15',
      label: 'Pixel 8 - Android 15 (API 36)',
      description:
        'Google Play image, Android 15 (API level 36), arm64-v8a architecture, Pixel 8 profile.',
      deviceId: 'pixel_8',
      systemImage: 'system-images;android-36;google_apis_playstore;arm64-v8a',
      defaultName: 'pixel8-api36',
    },
  ];
  private logger: CustomLogger;
  private dumpedObj: any;
  private appiumProc: ChildProcess | null = null;
  private appiumPort: number | null = null;
  private mitmProc: ChildProcess | null = null;
  private mitmPort: number | null = null;
  private mitmDumpFile?: string;
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
      const tmpfile = `./tmp/imgs/screenshot-${deviceId}.png`;
      const debugAdb = process.env.DEBUG_ADB === '1'
      debugAdb && this.logger.debug(`exec-out: adb -s ${deviceId} exec-out screencap -p > ${tmpfile}`)
      await this.commandService.captureScreenToFile(deviceId, tmpfile)
      debugAdb && this.logger.debug(`screenshot saved to ${tmpfile}`)

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

  private normalizeAvdKey(value: string | null | undefined) {
    if (!value) return '';
    return value.replace(/[\s_-]/g, '').toLowerCase();
  }

  private sanitizeAvdName(value: string) {
    const cleaned = value
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
    return cleaned || 'android-avd';
  }

  private generateRandomDeviceId(length = 16) {
    const alphabet = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return result;
  }

  private async randomizeAndroidDeviceId(serial: string): Promise<string | null> {
    const randomId = this.generateRandomDeviceId();
    try {
      await this.run(`adb -s ${serial} shell settings put secure android_id ${randomId}`);
    } catch (err) {
      this.logger.warn(
        `Failed to set android_id for ${serial}: ${(err as Error)?.message ?? err}`,
      );
      return null;
    }

    try {
      await this.run(`adb -s ${serial} shell settings put global device_name ${randomId}`);
    } catch (err) {
      this.logger.warn(
        `Failed to set device_name for ${serial}: ${(err as Error)?.message ?? err}`,
      );
      // proceed even if device_name update fails
    }

    return randomId;
  }

  private async getAndroidDeviceId(serial: string): Promise<string | null> {
    try {
      const { stdout } = await this.run(
        `adb -s ${serial} shell settings get secure android_id`,
      );
      const value = stdout.toString().trim();
      if (!value || value.toLowerCase() === 'null') {
        return null;
      }
      return value;
    } catch (err) {
      this.logger.warn(
        `Failed to read device ID for ${serial}: ${(err as Error)?.message ?? err}`,
      );
      return null;
    }
  }

  async startMitmproxy(options: { port?: number; outFile?: string } = {}) {
    if (this.mitmProc && !this.mitmProc.killed) {
      this.logger.info(
        `mitmproxy already running on port ${this.mitmPort ?? options.port}`,
      );
      return {
        started: false,
        port: this.mitmPort ?? options.port,
        dumpFile: this.mitmDumpFile,
      };
    }

    const port =
      options.port ??
      (process.env.MITM_PROXY_PORT
        ? Number(process.env.MITM_PROXY_PORT)
        : 8081);
    if (!Number.isFinite(port) || port <= 0) {
      throw new Error(`Invalid mitmproxy port: ${options.port}`);
    }

    const defaultDumpDir = './tmp/mitm';
    const dumpFile =
      options.outFile ??
      path.join(defaultDumpDir, `flows-${Date.now().toString()}.mitm`);

    try {
      const dir = path.dirname(dumpFile);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    } catch (err) {
      this.logger.warn(
        `Failed to ensure mitmproxy output directory: ${(err as Error)?.message ?? err}`,
      );
    }

    this.logger.info(
      `Starting mitmproxy (mitmdump) on port ${port}, output: ${dumpFile}`,
    );

    const args = ['-p', String(port), '-w', dumpFile];
    const proc = spawn('mitmdump', args, {
      stdio: 'pipe',
      env: process.env as NodeJS.ProcessEnv,
    });

    this.mitmProc = proc;
    this.mitmPort = port;
    this.mitmDumpFile = dumpFile;

    proc.stdout?.on('data', (data) => {
      this.logger.info(`[mitmproxy] ${data.toString().trimEnd()}`);
    });
    proc.stderr?.on('data', (data) => {
      this.logger.warn(`[mitmproxy] ${data.toString().trimEnd()}`);
    });
    proc.on('exit', (code) => {
      this.logger.warn(`mitmproxy exited with code ${code}`);
      this.mitmProc = null;
      this.mitmPort = null;
    });

    return { started: true, port, dumpFile };
  }

  async stopMitmproxy() {
    if (!this.mitmProc || this.mitmProc.killed) {
      this.mitmProc = null;
      const lastPort = this.mitmPort;
      const lastDump = this.mitmDumpFile;
      this.mitmPort = null;
      this.mitmDumpFile = undefined;
      return { stopped: false, port: lastPort ?? undefined, dumpFile: lastDump };
    }

    this.logger.info('Stopping mitmproxy...');
    const proc = this.mitmProc;
    const port = this.mitmPort ?? undefined;
    const dumpFile = this.mitmDumpFile;
    try {
      const killed = proc.kill();
      if (!killed) {
        process.kill(proc.pid, 'SIGTERM');
      }
    } catch (err) {
      this.logger.warn(
        `Failed to stop mitmproxy: ${(err as Error)?.message ?? err}`,
      );
    }
    this.mitmProc = null;
    this.mitmPort = null;
    this.mitmDumpFile = undefined;
    return { stopped: true, port, dumpFile };
  }

  getMitmproxyStatus() {
    const running = !!this.mitmProc && !this.mitmProc.killed;
    return {
      running,
      port: this.mitmPort ?? undefined,
      dumpFile: this.mitmDumpFile,
    };
  }

  async setDeviceHttpProxy(deviceId: string, host: string, port: number) {
    const trimmedHost = (host || '').trim();
    if (!trimmedHost) {
      throw new Error('Proxy host is required');
    }
    if (!Number.isFinite(port) || port <= 0) {
      throw new Error('Proxy port must be a positive number');
    }
    this.logger.info(
      `Setting HTTP proxy for ${deviceId} to ${trimmedHost}:${port}`,
    );
    await this.run(
      `adb -s ${deviceId} shell settings put global http_proxy ${trimmedHost}:${port}`,
    );
  }

  async clearDeviceHttpProxy(deviceId: string) {
    this.logger.info(`Clearing HTTP proxy for ${deviceId}`);
    try {
      await this.run(
        `adb -s ${deviceId} shell settings put global http_proxy :0`,
      );
      return;
    } catch {
      await this.run(
        `adb -s ${deviceId} shell settings put global http_proxy ''`,
      );
    }
  }

  async startFridaServer(options: { devicePath?: string } = {}) {
    const devicePath = options.devicePath || process.env.FRIDA_SERVER_PATH || '/data/local/tmp/frida-server';
    this.logger.info(`Starting frida-server on device path: ${devicePath}`);
    // Best-effort: ensure adb root, ignore failures
    try {
      await this.run('adb root');
    } catch {}
    try {
      // Run frida-server in background on device
      const cmd = `adb shell sh -c "nohup ${devicePath} >/dev/null 2>&1 &"`;
      await this.run(cmd);
      return { started: true, devicePath };
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      this.logger.warn(`Failed to start frida-server: ${msg}`);
      throw new Error(`Failed to start frida-server at ${devicePath}: ${msg}`);
    }
  }

  async startGettrFridaBypass() {
    const scriptPath = path.resolve('./mitm/ssl-bypass-gettr.js');
    if (!existsSync(scriptPath)) {
      throw new NotFoundException(`Frida script not found at ${scriptPath}`);
    }
    this.logger.info(
      `Starting Frida SSL bypass for com.gettr.gettr with script ${scriptPath}`,
    );
    // Attach to running GETTR process by name. Assumes app is already started.
    // Run in background so Nest process does not block on Frida CLI.
    const cmd = `frida -U -n GETTR -l "${scriptPath}" >/tmp/frida-gettr.log 2>&1 &`;
    try {
      await this.run(cmd);
      return { started: true, scriptPath };
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      this.logger.warn(`Failed to start Frida SSL bypass for GETTR: ${msg}`);
      throw new Error(`Failed to start Frida SSL bypass: ${msg}`);
    }
  }

  async getFridaStatus() {
    let fridaServerRunning = false;
    let fridaServerProcessLine: string | undefined;
    let gettrProcessPresent = false;
    let gettrProcessLine: string | undefined;

    // Check frida-server on device via adb ps (be tolerant to different ps variants / names)
    try {
      const { stdout } = await this.run(
        `adb shell sh -c "ps -A 2>/dev/null | grep -i frida || ps 2>/dev/null | grep -i frida || true"`,
      );
      const lines = stdout
        .toString()
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (lines.length > 0) {
        fridaServerRunning = true;
        fridaServerProcessLine = lines[0];
      }
    } catch (err) {
      this.logger.warn(
        `Failed to inspect frida-server process: ${(err as Error)?.message ?? err}`,
      );
    }

    // Check GETTR process visibility via frida-ps
    try {
      const { stdout } = await this.run(
        `frida-ps -Uai | grep -i com.gettr.gettr || true`,
      );
      const lines = stdout
        .toString()
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (lines.length > 0) {
        gettrProcessPresent = true;
        gettrProcessLine = lines[0];
      }
    } catch (err) {
      this.logger.warn(
        `Failed to inspect GETTR process via frida-ps: ${(err as Error)?.message ?? err}`,
      );
    }

    return {
      fridaServerRunning,
      fridaServerProcessLine,
      gettrProcessPresent,
      gettrProcessLine,
    };
  }

  async readFridaLog(options: { maxLines?: number } = {}) {
    const logPath = process.env.FRIDA_LOG_PATH || '/tmp/frida-gettr.log';
    const maxLines =
      typeof options.maxLines === 'number' && Number.isFinite(options.maxLines)
        ? Math.max(1, Math.min(1000, Math.floor(options.maxLines)))
        : 200;

    if (!existsSync(logPath)) {
      throw new NotFoundException(`Frida log file not found at ${logPath}`);
    }

    try {
      const raw = readFileSync(logPath, 'utf8');
      const lines = raw.split(/\r?\n/);
      const tail =
        lines.length <= maxLines ? lines : lines.slice(lines.length - maxLines);
      return {
        path: logPath,
        totalLines: lines.length,
        maxLines,
        lines: tail,
      };
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      this.logger.warn(`Failed to read Frida log at ${logPath}: ${msg}`);
      throw new NotFoundException(
        `Failed to read Frida log at ${logPath}: ${msg}`,
      );
    }
  }

  async readMitmFlows(options: { limit?: number; dumpFile?: string } = {}) {
    const dumpFile = options.dumpFile || this.mitmDumpFile;
    if (!dumpFile) {
      throw new NotFoundException('No mitmproxy dump file available');
    }
    if (!existsSync(dumpFile)) {
      throw new NotFoundException(`mitmproxy dump file not found at ${dumpFile}`);
    }

    const limit =
      typeof options.limit === 'number' && Number.isFinite(options.limit)
        ? Math.max(1, Math.min(500, Math.floor(options.limit)))
        : 100;

    this.logger.info(`Reading mitmproxy flows from ${dumpFile} (limit=${limit})`);

    let stdout: string;
    const bin = process.env.MITMDUMP_BIN || 'mitmdump';
    const scriptPath = path.resolve('./mitm/flows_to_json.py');
    const cmd = `${bin} -nr "${dumpFile}" -s "${scriptPath}"`;
    try {
      const res = await this.run(cmd);
      stdout = res.stdout.toString();
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      this.logger.warn(`Failed to run mitmdump for dump ${dumpFile}: ${msg}`);
      throw new NotFoundException(
        `Failed to read mitmproxy flows. Command "${cmd}" failed: ${msg}`,
      );
    }

    const lines = stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    const flows: any[] = [];
    for (const line of lines) {
      if (flows.length >= limit) break;
      try {
        const obj = JSON.parse(line);
        flows.push(obj);
      } catch {
        // ignore malformed lines
      }
    }

    const summaries = flows.map((flow, idx) => {
      const id = typeof flow?.id === 'string' ? (flow.id as string) : `flow-${idx}`;
      const method = typeof flow?.method === 'string' ? String(flow.method).toUpperCase() : '';
      const url = typeof flow?.url === 'string' ? (flow.url as string) : '';
      const statusCode =
        typeof flow?.statusCode === 'number'
          ? (flow.statusCode as number)
          : typeof (flow as any).status_code === 'number'
          ? ((flow as any).status_code as number)
          : undefined;
      const contentType =
        typeof flow?.contentType === 'string'
          ? (flow.contentType as string)
          : typeof (flow as any).content_type === 'string'
          ? ((flow as any).content_type as string)
          : undefined;
      const startedAt =
        typeof flow?.startedAt === 'string' ? (flow.startedAt as string) : undefined;
      const durationMs =
        typeof flow?.durationMs === 'number' ? (flow.durationMs as number) : undefined;

      return {
        id,
        method,
        url,
        statusCode,
        contentType,
        startedAt,
        durationMs,
      };
    });

    return {
      dumpFile,
      total: flows.length,
      flows: summaries,
    };
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

  async deleteEmulator(avd: string) {
    const input = avd?.trim();
    if (!input) {
      throw new Error('AVD name is required');
    }
    const candidates = await this.listAvds();
    const target =
      candidates.find(
        (name) => this.normalizeAvdKey(name) === this.normalizeAvdKey(input),
      ) ?? null;
    if (!target) {
      throw new Error(`Emulator ${input} not found`);
    }
    const running = await this.getRunningEmulator();
    if (
      running?.avd &&
      this.normalizeAvdKey(running.avd) === this.normalizeAvdKey(target)
    ) {
      throw new Error(
        `Emulator ${target} is currently running. Stop it before deleting.`,
      );
    }
    const escaped = target.replace(/(["$`\\])/g, '\\$1');
    await this.run(`yes | avdmanager delete avd -n "${escaped}"`);
    return { deleted: true, avd: target };
  }

  async listCreatableEmulators() {
    return this.creatableAvdTemplates.map((template) => ({
      id: template.id,
      label: template.label,
      description: template.description,
      defaultName: template.defaultName,
    }));
  }

  async createEmulatorFromTemplate(templateId: string, requestedName?: string) {
    const template = this.creatableAvdTemplates.find((item) => item.id === templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }
    const desiredName = requestedName?.trim() || template.defaultName;
    if (!desiredName) {
      throw new Error('AVD name is required');
    }
    const sanitizedBase = this.sanitizeAvdName(desiredName);
    let finalName = sanitizedBase;
    const existing = await this.listAvds();
    const normalizedExisting = existing.map((name) => this.normalizeAvdKey(name));
    let counter = 1;
    while (normalizedExisting.includes(this.normalizeAvdKey(finalName))) {
      finalName = `${sanitizedBase}-${counter++}`;
    }
    const command = `printf 'no\\n' | avdmanager create avd -n "${finalName}" -k "${template.systemImage}" --device "${template.deviceId}" --force`;
    await this.run(command);

    // Ensure AVD config enables hardware keyboard input
    try {
      const avdHome = process.env.ANDROID_AVD_HOME || path.join(os.homedir(), '.android', 'avd');
      const configPath = path.join(avdHome, `${finalName}.avd`, 'config.ini');
      if (existsSync(configPath)) {
        const raw = readFileSync(configPath, 'utf8');
        const lines = raw.split(/\r?\n/);
        let found = false;
        const next = lines.map((line) => {
          if (/^\s*hw\.keyboard\s*=/.test(line)) {
            found = true;
            return 'hw.keyboard=yes';
          }
          return line;
        });
        if (!found) next.push('hw.keyboard=yes');
        writeFileSync(configPath, next.join('\n'));
        this.logger.info(`Enabled hardware keyboard for AVD: ${finalName}`);
      } else {
        this.logger.warn(`AVD config.ini not found for ${finalName} at ${configPath}`);
      }
    } catch (e) {
      this.logger.warn(`Failed to update AVD config for ${finalName}: ${(e as Error)?.message ?? e}`);
    }
    return { created: true, avd: finalName, templateId: template.id };
  }

  private async getApkPackageName(apkPath: string): Promise<string> {
    // Try aapt
    try {
      const { stdout } = await this.run(`aapt dump badging "${apkPath}"`);
      const out = stdout.toString();
      const m = out.match(/package:\s+name='([^']+)'/);
      if (m && m[1]) return m[1];
    } catch {}

    // Try aapt2
    try {
      const { stdout } = await this.run(`aapt2 dump badging "${apkPath}"`);
      const out = stdout.toString();
      const m = out.match(/package:\s+name='([^']+)'/);
      if (m && m[1]) return m[1];
    } catch {}

    // Try apkanalyzer
    try {
      const { stdout } = await this.run(`apkanalyzer manifest application-id "${apkPath}"`);
      const pkg = stdout.toString().trim();
      if (pkg) return pkg;
    } catch {}

    throw new Error('Unable to determine APK package name. Ensure Android Build Tools (aapt/apkanalyzer) are installed.');
  }

  async installAppOnEmulators(serials: string[], apkPath: string, options: { force?: boolean } = {}) {
    if (!serials || serials.length === 0) {
      throw new Error('No device serials provided');
    }
    const uniqueSerials = Array.from(
      new Set(
        serials
          .map((serial) => serial?.trim())
          .filter((serial): serial is string => !!serial),
      ),
    );
    if (uniqueSerials.length === 0) {
      throw new Error('No valid device serials provided');
    }
    const installed: string[] = [];
    const gettrPackageCandidates = ['com.gettr.gettr', 'org.app.getter'];
    let packageName: string | null = null;
    if (options?.force) {
      try {
        packageName = await this.getApkPackageName(apkPath);
      } catch (err) {
        this.logger.warn(`Force install requested but failed to read package name: ${(err as Error)?.message ?? err}`);
      }
    }
    for (const serial of uniqueSerials) {
      try {
        this.logger.info(`Installing ${apkPath} on ${serial}`);
        if (options?.force) {
          const candidates: string[] = [];
          if (packageName && gettrPackageCandidates.includes(packageName)) {
            // For GETTR app, try both known package names as uninstall options
            candidates.push(...gettrPackageCandidates);
          } else if (packageName) {
            candidates.push(packageName);
          } else {
            // Best-effort fallback when package name cannot be derived
            candidates.push(...gettrPackageCandidates);
          }

          for (const pkg of candidates) {
            try {
              this.logger.info(`Force uninstalling ${pkg} on ${serial}`);
              await this.run(`adb -s ${serial} uninstall ${pkg}`);
              // If uninstall succeeds for one candidate, do not try the rest
              break;
            } catch (unErr) {
              this.logger.warn(
                `Uninstall before install failed (non-fatal) for ${pkg} on ${serial}: ${(unErr as Error)?.message ?? unErr}`,
              );
            }
          }
        }
        await this.run(`adb -s ${serial} install -r "${apkPath}"`);
        installed.push(serial);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        throw new Error(
          `Failed to install APK on ${serial}: ${message}`,
        );
      }
    }
    const apkLabel = path.basename(apkPath);
    return {
      installed: installed.length,
      serials: installed,
      message: `Installed ${apkLabel} on ${installed.length} device${
        installed.length === 1 ? '' : 's'
      }`,
    };
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

  async startEmulator(
    avd: string,
    options: { headless?: boolean; wipeData?: boolean } = {},
  ) {
    const { headless = false, wipeData = false } = options;
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
    if (wipeData) {
      args.push('-wipe-data');
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

  async startStandaloneEmulator({
    avd,
    headless = false,
    reset = false,
    randomizeDeviceId = false,
  }: {
    avd: string;
    headless?: boolean;
    reset?: boolean;
    randomizeDeviceId?: boolean;
  }): Promise<{
    serial: string
    avd: string | null
    deviceName: string | null
    randomizedDeviceId?: string | null
    deviceId?: string | null
  }> {
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

    await this.startEmulator(avd, { headless, wipeData: reset });

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

    const shouldRandomize = reset || randomizeDeviceId;

    let randomizedDeviceId: string | null = null;
    if (shouldRandomize) {
      randomizedDeviceId = await this.randomizeAndroidDeviceId(serial);
    }

    const deviceId =
      randomizedDeviceId ?? (await this.getAndroidDeviceId(serial)) ?? null;

    const runningInfo = await this.getRunningEmulator(true);
    await this.ensureAppiumServer(this.appiumPort ?? 4723);
    return {
      serial,
      avd: runningInfo?.avd ?? avd,
      deviceName: runningInfo?.deviceName ?? serial,
      randomizedDeviceId,
      deviceId,
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

  // Public helpers for Appium control via controller
  async startAppiumServerOnly(port = 4723) {
    await this.ensureUiAutomator2Installed();
    return await this.ensureAppiumServer(port);
  }

  async stopAppiumServerOnly() {
    const stopped = this.stopAppiumServer();
    return { stopped };
  }

  getAppiumStatus() {
    const running = !!this.appiumProc && !this.appiumProc.killed;
    return { running, port: this.appiumPort ?? undefined };
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
      await this.startEmulator(targetAvd, { headless });
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
