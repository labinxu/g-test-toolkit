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
    const emu = await this.androidService.getRunningEmulator(true);
    if (!emu?.serial) throw new NotFoundException('No running device/emulator');
    return emu.serial;
  }

  async snapshot(params: { deviceId?: string }) {
    const serial = await this.ensureSerial(params.deviceId);
    const filePath = await this.androidService.getScreen(serial);
    const screenshotBase64 = readFileSync(filePath).toString('base64');
    await this.commandService.dumpxml(serial);
    const xmlPath = `./tmp/window_dump-${serial}.xml`;
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

