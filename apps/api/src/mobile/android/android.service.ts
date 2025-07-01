import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandService } from 'src/command/command.service';
import { CustomLogger } from 'src/logger/logger.custom';
import { LoggerService } from 'src/logger/logger.service';
import { readFileSync } from 'fs';
import { XMLParser } from 'fast-xml-parser';
import { Response } from 'express';
import { getDefaultAutoSelectFamilyAttemptTimeout } from 'net';
import { unlink } from 'fs/promises';

@Injectable()
export class AndroidService {
  private logger: CustomLogger;
  private dumpedObj: any;
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
  async streamScreen(deviceId: string, res: Response) {
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
      res.contentType('file/xml');
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
      await this.commandService.dumpxml(deviceId);
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
      this.logger.error(`${attribute} ${text} not found`);
      return;
    }
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
    const dumppath = `/tmp`;
    await this.commandService.expandNotifBar(deviceId);
    const tmpfile = await this.dumpxmlTo(deviceId, dumppath);
    await this.click(deviceId, attribute, text);
    await unlink(tmpfile);
  }
  async snapscreenTo(deviceId: string, filePath: string) {
    await this.commandService.snapshot(deviceId);
    await this.commandService.pullSnapshot(deviceId, filePath);
  }
}
