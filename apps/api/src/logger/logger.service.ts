import { Injectable, Inject } from '@nestjs/common';
import { CustomLogger } from './logger.custom';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import * as winston from 'winston';
import { LoggerGateway } from './logger.gateway';
import { forwardRef } from '@nestjs/common';

@Injectable()
export class LoggerService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly winstonLogger: winston.Logger,
    @Inject(forwardRef(() => LoggerGateway))
    private readonly loggerGateway: LoggerGateway,
  ) {}

  createLogger(context: string, clientId?: string): CustomLogger {
    const customLogger = new CustomLogger(
      this.winstonLogger,
      this.loggerGateway,
      clientId,
    );
    customLogger.setContext(context);
    return customLogger;
  }
}
