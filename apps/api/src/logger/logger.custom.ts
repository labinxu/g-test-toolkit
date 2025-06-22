import { Injectable, Scope, Optional, forwardRef } from '@nestjs/common';
import * as winston from 'winston';
import { Inject } from '@nestjs/common';
import { LoggerGateway } from './logger.gateway';

@Injectable({ scope: Scope.TRANSIENT })
export class CustomLogger {
  private logger: winston.Logger;
  private context = 'LOG:';
  constructor(
    private readonly winstonLogger: winston.Logger,
    @Optional() @Inject(forwardRef(() => LoggerGateway))
    private readonly loggerGateway: LoggerGateway,
  ) {
    this.logger = winstonLogger.child({ context: this.context });
    this.winstonLogger = winstonLogger;
  }
private format(level: string, message: string): string {
  const timestamp = new Date().toISOString();
  const tag = this.context ? `[${this.context}]` : '';
  return `${timestamp} ${level} ${tag} ${message}\n`;
}
  setContext(context: string) {
    this.context = context;
    this.logger = this.winstonLogger.child({ context });
  }

  log(message: string) {
    this.logger.info(message);

    this.loggerGateway?.sendLog(this.format('log', message)); // Use optional chaining for safety
  }

  error(message: string) {
    this.logger.error(message);
  }

  warn(message: string) {
    this.logger.warn(message);
  }

  debug(message: string) {
    this.logger.debug(message);
     this.loggerGateway?.sendLog(this.format('log', message)); // Use optional chaining for safety

  }

  verbose(message: string) {
    this.logger.verbose(message);
  }
}
