import { Injectable } from '@nestjs/common';
import { LoggerService } from 'src/logger/logger.service';
import { CustomLogger } from './logger/logger.custom';
@Injectable()
export class AppService {
  private logger: CustomLogger;

  constructor(private readonly loggerService: LoggerService) {}
  async onModuleInit() {
    this.logger = this.loggerService.createLogger('AppService');
  }
  getHello(): string {
    return 'Hello World!';
  }
  async start() {
    this.logger.debug('start browser');
  }
}
