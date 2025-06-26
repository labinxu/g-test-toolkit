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
  private clientId: string = '';
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
  setClientId(clientId: string) {
    this.clientId = clientId;
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

  sendLogTo(message: string) {
    if (!this.clientId) {
      this.logger.error('client id not initialized!');
      return;
    }
    this.loggerGateway?.sendLogTo(this.clientId, message);
  }
  sendExitTo() {
    if (!this.clientId) {
      this.logger.error('client id not initialized!');
      return;
    }
    this.loggerGateway.sendExitTo(this.clientId);
  }
  sendLog(message: string) {
    this.loggerGateway?.sendLog(this.format('', message));
    this.logger.log('tc', message);
  }

  verbose(message: string) {
    this.logger.verbose(message);
  }
}
