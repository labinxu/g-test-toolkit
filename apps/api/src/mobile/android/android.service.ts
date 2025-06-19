import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandService } from 'src/command/command.service';
import { CustomLogger } from 'src/logger/logger.custom';
import { LoggerService } from 'src/logger/logger.service';
import { readFileSync } from 'fs';
import { Response } from 'express';
import sharp from 'sharp';
@Injectable()
export class AndroidService {
  private logger: CustomLogger;
  constructor(
    private readonly commandService: CommandService,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.createLogger('AndroidService');
  }
  async getDevices(): Promise<string> {
    const result = await this.commandService.runCommand('adb devices');
    return result.stdout;
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
    res.contentType('image/png');
    const fileStream = readFileSync(filePath);
    res.send(fileStream);
  }
  async screenOn(deviceId:string,checkKeywords='holding display',password='125698',swipeCord:string){
    const displaycommand = `adb -s ${deviceId} shell dumpsys power`;
    let result = await this.commandService.runCommand(displaycommand);
    let goon= result.stdout.search(checkKeywords)
    let counter = 3
    while(goon===-1 && counter >0){
      counter -= 1;
      const command = `adb -s ${deviceId} shell input keyevent 26`;
      await this.commandService.runCommand(command);
      result = await this.commandService.runCommand(displaycommand);
      goon = result.stdout.search(checkKeywords);
    }
    const swipeOn = `adb -s ${deviceId} shell input swipe ${swipeCord}`;
    this.logger.debug(swipeOn)
    await this.commandService.runCommand(swipeOn);
    const inputpassword = `adb -s ${deviceId} shell input text ${password}`
    this.logger.debug(inputpassword)
    await this.commandService.runCommand(inputpassword);

    const enterCmd = `adb -s ${deviceId} shell input keyevent 66`;
    this.logger.debug(enterCmd)
    await this.commandService.runCommand(enterCmd);
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
}
