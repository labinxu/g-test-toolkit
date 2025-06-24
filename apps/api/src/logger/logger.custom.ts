import { Injectable, Scope, Optional, forwardRef } from '@nestjs/common';
import * as winston from 'winston';
import { Inject } from '@nestjs/common';
import { LoggerGateway } from './logger.gateway';
const loggerFormat = winston.format.printf(
  ({ timestamp, level, message, context }) => {
    const tag = context ? `[${context}]` : '';
    return `${timestamp} ${level} ${tag} ${message}`;
  },
);

@Injectable({ scope: Scope.TRANSIENT })
export class CustomLogger {
  private logger: winston.Logger;
  private context = 'LOG:';
  constructor(
    private readonly winstonLogger: winston.Logger,
    @Optional()
    @Inject(forwardRef(() => LoggerGateway))
    private readonly loggerGateway: LoggerGateway,
  ) {
    this.logger = winstonLogger.child({ context: this.context });
    this.winstonLogger = winstonLogger;
  }

  private format(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    const tag = this.context ? `[${this.context}]` : '';
    return `${timestamp} ${level} ${tag} ${message}`;
  }
  setContext(context: string) {
    this.context = context;
    this.logger = this.winstonLogger.child({ context });
  }
  addLogFileTransports(filename: string) {
    const contextTrans = new winston.transports.File({
      filename: `./logs/${filename}`,
      level: 'tc',
      zippedArchive: true,
      maxsize: 20 * 1024 * 1024,
      maxFiles: 30,
      format: winston.format.combine(winston.format.timestamp(), loggerFormat),
    });

    this.logger.add(contextTrans);
    return contextTrans;
  }
  removeLogFileTransports(transport: winston.transports.FileTransportInstance) {
    this.logger.remove(transport);
  }
  info(message: string) {
    this.logger.info(message);
  }

  error(message: string) {
    this.logger.error(message);
  }

  warn(message: string) {
    this.logger.warn(message);
  }

  debug(message: string) {
    this.logger.debug(message);
  }
  sendLog(message: string) {
    this.loggerGateway?.sendLog(this.format('', message));
    this.logger.log('tc',message)
  }
  sendCtl(ctlMsg: string) {
    this.loggerGateway.sendControl(ctlMsg);
  }
  verbose(message: string) {
    this.logger.verbose(message);
  }
}
