import { Injectable, NotFoundException } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { readFileSync } from 'fs';
import { CommandService } from 'src/command/command.service';
import { CustomLogger } from 'src/logger/logger.custom';
import { LoggerService } from 'src/logger/logger.service';
import { AndroidService } from '../android/android.service';

type Bounds = { x1: number; y1: number; x2: number; y2: number };
type NodeInfo = {
  nodeId: string;
  class: string;
  text: string;
  resourceId: string;
  contentDesc: string;
  clickable: boolean;
  bounds: Bounds;
};

@Injectable()
export class InspectorService {
  private logger: CustomLogger;
  private lastSnapshotCache: Map<string, { at: number; data: any }> = new Map();
  constructor(
    private readonly commandService: CommandService,
    private readonly loggerService: LoggerService,
    private readonly androidService: AndroidService,
  ) {
    this.logger = this.loggerService.createLogger('InspectorService');
  }

  private parseBounds(value: string): Bounds | null {
    const m = value?.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    if (!m) return null;
    return { x1: +m[1], y1: +m[2], x2: +m[3], y2: +m[4] };
  }

  private flattenNodes(root: any): NodeInfo[] {
    const out: NodeInfo[] = [];
    let counter = 0;
    const walk = (node: any) => {
      if (!node) return;
      const attr = (k: string) => node?.[`@_${k}`] ?? '';
      const b = this.parseBounds(attr('bounds'));
      if (b) {
        out.push({
          nodeId: `n${++counter}`,
          class: String(attr('class') || ''),
          text: String(attr('text') || ''),
          resourceId: String(attr('resource-id') || ''),
          contentDesc: String(attr('content-desc') || ''),
          clickable: String(attr('clickable') || '') === 'true',
          bounds: b,
        });
      }
      const child = node.node;
      if (Array.isArray(child)) child.forEach(walk);
      else if (child) walk(child);
    };
    walk(root);
    return out;
  }

  private async ensureSerial(deviceId?: string): Promise<string> {
    if (deviceId) return deviceId;
    // Prefer running emulator if present
    const emu = await this.androidService.getRunningEmulator(true);
    if (emu?.serial) return emu.serial;
    // Fallback: pick any connected device in 'device' state
    try {
      const { stdout } = await this.commandService.runCommand('adb devices');
      const lines = stdout
        .toString()
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const line of lines) {
        // ignore header line
        if (line.toLowerCase().startsWith('list of devices')) continue;
        const m = line.match(/^(\S+)\s+device$/);
        if (m) {
          return m[1];
        }
      }
    } catch {}
    throw new NotFoundException('No connected Android device/emulator detected');
  }

  async snapshot(params: {
    deviceId?: string;
    autoWake?: boolean;
    autoUnlock?: boolean;
    unlockPassword?: string;
    unlockSwipe?: string;
    unlockKeywords?: string;
    minIntervalMs?: number;
  }) {
    const serial = await this.ensureSerial(params.deviceId);
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const minMs = Math.max(0, Number(params.minIntervalMs ?? process.env.INSPECTOR_SNAPSHOT_MIN_MS ?? 0));
    const now = Date.now();
    const cached = this.lastSnapshotCache.get(serial);
    if (minMs > 0 && cached && now - cached.at < minMs) {
      return cached.data;
    }
    // Optional pre-unlock step
    if (params.autoUnlock) {
      try {
        const pwd = params.unlockPassword ?? '125698';
        const swipe = params.unlockSwipe ?? '';
        const keywords = params.unlockKeywords ?? 'holding display';
        if (swipe) {
          await this.commandService.unlockScreen(serial, keywords, pwd, swipe);
          await wait(500);
        }
      } catch {}
    }
    const attempt = async () => {
      const filePath = await this.androidService.getScreen(serial);
      const screenshotBase64 = readFileSync(filePath).toString('base64');
      await this.commandService.dumpxml(serial);
      const xmlPath = `./tmp/window_dump-${serial}.xml`;
      // ensure device flushed the dump file on some devices
      await wait(120);
      await this.commandService.pullDumpedXml(serial, xmlPath);
      const xmlContent = readFileSync(xmlPath);
      const parser = new XMLParser({ ignoreAttributes: false });
      const obj = parser.parse(xmlContent);
      const nodes = this.flattenNodes(obj?.hierarchy?.node ?? obj?.hierarchy);
      const width = nodes.reduce((mx, n) => Math.max(mx, n.bounds.x2), 0);
      const height = nodes.reduce((mx, n) => Math.max(mx, n.bounds.y2), 0);
      return {
        screenshotBase64,
        screen: { width, height },
        nodes,
        takenAt: Date.now(),
      };
    };
    const allowWake = params.autoWake !== false;
    try {
      const res = await attempt();
      if (minMs > 0) this.lastSnapshotCache.set(serial, { at: Date.now(), data: res });
      return res;
    } catch (e) {
      if (!allowWake) throw e;
      try {
        await this.commandService.wakeDevice(serial);
        await wait(500);
      } catch {}
      const res = await attempt();
      if (minMs > 0) this.lastSnapshotCache.set(serial, { at: Date.now(), data: res });
      return res;
    }
  }

  private findByUsing(nodes: NodeInfo[], using: string, value: string): NodeInfo | null {
    const u = using.toLowerCase();
    if (u === 'accessibility id') return nodes.find((n) => n.contentDesc === value) ?? null;
    if (u === 'id') return nodes.find((n) => n.resourceId === value) ?? null;
    if (u === 'xpath') {
      const m = value.match(/^\/\/([^\[]+)(?:\[(.+)\])?$/);
      if (!m) return null;
      const clazz = m[1]?.trim();
      const cond = m[2] || '';
      const conditions: Record<string, string> = {};
      cond.split(/\s+and\s+/).forEach((chunk) => {
        const mm = chunk.match(/@([^=]+)=\"([^\"]*)\"/);
        if (mm) conditions[mm[1]] = mm[2];
      });
      return (
        nodes.find((n) =>
          (!clazz || n.class.endsWith(clazz)) &&
          (!conditions['text'] || n.text === conditions['text']) &&
          (!conditions['resource-id'] || n.resourceId === conditions['resource-id']),
        ) || null
      );
    }
    if (u === 'android uiautomator') {
      const mm = value.match(/text\(\"([\s\S]*?)\"\)/);
      if (mm) return nodes.find((n) => n.text === mm[1]) ?? null;
    }
    return null;
  }

  async tapCoordinate(params: { deviceId?: string; x: number; y: number }) {
    const serial = await this.ensureSerial(params.deviceId);
    await this.commandService.runCommand(
      `adb -s ${serial} shell input tap ${Math.round(params.x)} ${Math.round(params.y)}`,
    );
    return { ok: true };
  }

  async findAndTap(params: { deviceId?: string; using: string; value: string }) {
    const serial = await this.ensureSerial(params.deviceId);
    const snap = await this.snapshot({ deviceId: serial });
    const node = this.findByUsing(snap.nodes, params.using, params.value);
    if (!node) throw new NotFoundException('Element not found');
    const x = Math.round((node.bounds.x1 + node.bounds.x2) / 2);
    const y = Math.round((node.bounds.y1 + node.bounds.y2) / 2);
    await this.tapCoordinate({ deviceId: serial, x, y });
    return { ok: true, tapped: { x, y }, nodeId: node.nodeId };
  }
}
