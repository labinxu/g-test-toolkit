import { EventEmitter } from 'events';
import { Page } from 'puppeteer';
import { CustomLogger } from '../../types';

export class TestCase {
  protected p: Page | null = null;
  private tag: string | '';
  private logger: CustomLogger;
  protected reportData: Record<string, any> = {};
  private sharedState: {
    clientId: string;
    workspace: string;
    logs: string[];
    details?: string[];
    exceptCounter?: number;
    emiter: EventEmitter;
  };
  constructor(logger: any, workspace: string) {
    this.logger = logger;
    const emiter = new EventEmitter();
    this.sharedState = {
      clientId: '',
      workspace,
      logs: [],
      details: [],
      exceptCounter: 0,
      emiter: emiter,
    };
    emiter.on('event', (msg) => console.log(msg));
    this.tag = this.constructor.name;
    this.logger.debug(`construct TestCase ${this.tag}`);
  }
  debug(msg: string) {
    this.logger.debug(msg, this.tag);
  }
  setPage(p: Page) {
    this.p = p;
  }
  get emiter() {
    return this.sharedState.emiter;
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
  get clientId() {
    return this.sharedState.clientId;
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

  setClientId(clientId: string) {
    this.sharedState.clientId = clientId;
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

  page() {
    return this.p;
  }
  exceptEqual(except: any, actual: any, description?: string) {}
  exceptNotNull(except: any, description?: string) {}

  clone() {
    const cloned = Object.create(Object.getPrototypeOf(this));
    cloned.sharedState = this.sharedState;
    return cloned;
  }
}
