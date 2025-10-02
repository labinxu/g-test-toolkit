import { EventEmitter } from 'events';
import { Browser, Page } from 'puppeteer';
import { CustomLogger } from '../../types';

export class TestCase {
  public page: Page | null = null;
  public browser: Browser | null = null;
  protected reportData: Record<string, any> = {};
  private sharedState: {
    workspace: string;
    clientId: string;
    logs: string[];
    details: string[];
    exceptCounter: number;
    delaytime: number;
    emiter: EventEmitter;
    logger: CustomLogger;
  };
  constructor(logger: any, clientId: string, workspace: string) {
    const emiter = new EventEmitter();
    this.sharedState = {
      workspace,
      clientId,
      logs: [],
      details: [],
      logger,
      delaytime: 2000,
      exceptCounter: 0,
      emiter: emiter,
    };
    emiter.on('event', (msg) => console.log(msg));
  }
  async pagePromise() {
    return new Promise((resolve, reject) => {
      this.browser?.once('targetcreated', async (target) => {
        const newPage = await target.page();
        if (newPage) {
          await newPage.setViewport({
            width: 1920, // 宽度，例如 1920px
            height: 1080, // 高度，例如 1080px
            deviceScaleFactor: 1, // 缩放比例，1 为正常比例
            isMobile: false,
          });
          resolve(newPage);
        } else {
          reject(new Error('Failed to get new page'));
        }
      });
    });
  }
 
  setDelayTime(dl: number) {
    this.sharedState.delaytime = dl;
  }
  setPage(p: Page) {
    this.page = p;
  }
  setBrowser(br: any) {
    this.browser = br;
  }
  get clientId() {
    return this.sharedState.clientId;
  }
  get logger() {
    return this.sharedState.logger;
  }
  get emiter() {
    return this.sharedState.emiter;
  }
  get delaytime() {
    return this.sharedState.delaytime;
  }
  get exceptCounter() {
    return this.sharedState.exceptCounter;
  }
  get details() {
    return this.sharedState.details;
  }
  setName(name: string) {
    this.reportData['caseName'] = name;
  }
  setWorkspace(wks: string) {
    this.sharedState.workspace = wks;
  }
  get workspace() {
    return this.sharedState.workspace;
  }

  async tearUp() {
    this.reportData['startTime'] = Date.now();
  }
  async tearDown() {
    this.reportData['endTime'] = Date.now();
    this.reportData['duration'] =
      this.reportData.endTime - this.reportData.startTime;
    this.reportData['logs'] = this.logs;
    this.reportData['details'] = this.details;
    this.reportData.exceptCounter = this.exceptCounter;
  }

  appendLog(log: string): void {
    this.logs.push(log);
  }
  get logs() {
    return this.sharedState.logs;
  }
  getReportData() {
    return this.reportData;
  }

  assertEqual(except: any, actual: any, description?: string) {
    this.sharedState.exceptCounter += 1;
    let message = '';
    if (except === actual) {
      message = `Expected: ${except} Actual: ${actual} Result: Passed`;
      this.details.push(message);
      this.logger.info(message);
    } else {
      message = `Expected: ${except} Actual: ${actual} Result: Failed. description: ${description}`;
      this.details.push(message);
      this.logger.error(message);
      throw new Error(`Error: Expected ${except}, got ${actual}`);
    }
  }
  assertNotNull(except: any, description?: string) {
    this.sharedState.exceptCounter += 1;
    let message = '';

    if (except) {
      message = `Assert: ${description} ${except} not null Result: Passed`;
      this.details.push(message);
      this.logger.info(message);
    } else {
      message = `Expected not null Result: Failed. description: ${description}`;
      this.details.push(message);
      this.logger.error(message);
      throw new Error(`Error: Expected ${except} is null `);
    }
  }
  clone() {
    const cloned = Object.create(Object.getPrototypeOf(this));
    cloned.sharedState = this.sharedState;
    return cloned;
  }
}
