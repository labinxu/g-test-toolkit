import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { CustomLogger } from 'src/logger/logger.custom';
import { LoggerService } from 'src/logger/logger.service';
import { promisify } from 'util';

const execPromise = promisify(exec);

@Injectable()
export class CommandService {
  private logger: CustomLogger;
  constructor(private readonly loggerService: LoggerService) {
    this.logger = this.loggerService.createLogger('CommandService');
  }
  async runCommand(
    command: string,
  ): Promise<{ stdout: string; stderr: string }> {
    try {
      const { stdout, stderr } = await execPromise(command);
      this.logger.info(`Run command: ${command}`);
      return { stdout, stderr };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Command failed: ${errorMessage}`);
    }
  }

  async home(deviceId: string) {
    await this.runCommand(`adb -s ${deviceId} shell input keyevent 3`);
  }

  async powerOn(deviceId: string) {
    await this.runCommand(`adb -s ${deviceId} shell input keyevent 26`);
  }
  async unlock(deviceId: string) {
    await this.runCommand(`adb -s ${deviceId} shell input keyevent 66`);
  }
  async dumpxml(deviceId:string){
     const dumpcommand = `adb -s ${deviceId} shell uiautomator dump`;
    await this.runCommand(dumpcommand)
  }
  async pullDumpedXml(deviceId:string,outPath:string){
     const pullcommand = `adb -s ${deviceId} pull /sdcard/window_dump.xml ${outPath}`;
    await this.runCommand(pullcommand);
  }
  async unlockScreen(
    deviceId: string,
    keywords = 'holding display',
    password: string,
    swipeData: string,
  ) {
    const displaycommand = `adb -s ${deviceId} shell dumpsys power`;
    let result = await this.runCommand(displaycommand);
    let goon = result.stdout.search(keywords);
    if (goon != -1) {
      await this.home(deviceId);
      return;
    }
    let counter = 3;
    while (goon === -1 && counter > 0) {
      counter -= 1;
      await this.powerOn(deviceId);
      result = await this.runCommand(displaycommand);
      goon = result.stdout.search(keywords);
    }
    const swipeOn = `adb -s ${deviceId} shell input swipe ${swipeData}`;
    await this.runCommand(swipeOn);
    const inputpassword = `adb -s ${deviceId} shell input text ${password}`;
    await this.runCommand(inputpassword);
    await this.unlock(deviceId)
    await this.home(deviceId);
  }
}
