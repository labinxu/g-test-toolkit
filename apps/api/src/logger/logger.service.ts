import { Injectable } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import * as winston from 'winston';
import { Inject } from '@nestjs/common';
import { CustomLogger } from './logger.custom';

@Injectable()
export class LoggerService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly winstonLogger: winston.Logger,
  ) {}

  createLogger(context: string): CustomLogger {
    return new CustomLogger(this.winstonLogger, context);
  }
}
