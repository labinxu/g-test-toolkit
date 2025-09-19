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
  private context = 'LOG';
  private clientId: string | null;
  constructor(
    private readonly winstonLogger: winston.Logger,
    @Optional()
    @Inject(forwardRef(() => LoggerGateway))
    private readonly loggerGateway: LoggerGateway,
    clientId?: string,
  ) {
    this.logger = winstonLogger.child({ context: this.context, clientId });
    this.winstonLogger = winstonLogger;
    this.clientId = clientId;
  }

  format(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    const tag = this.context ? `[${this.context}]` : '';
    return `${timestamp}  ${tag} [${level}] ${message}`;
  }
  setContext(context: string) {
    this.logger.debug(`set context: clientID:${this.clientId}`);
    this.context = context;
    this.logger = this.winstonLogger.child({
      context,
      clientId: this.clientId,
    });
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
  sendTo(clientId: string, msg: string, level?: string) {
    this.loggerGateway?.sendLogTo(
      clientId,
      this.format(level ? level : '', msg),
    );
  }
  info(message: string, tag?: string) {
    this.logger.info(message);
    this.sendTo(this.clientId, message, tag ? tag : 'info');
  }

  error(message: string, tag?: string) {
    this.logger.error(message);
    this.sendTo(this.clientId, message, tag ? tag : 'error');
  }

  warn(message: string, tag?: string) {
    this.logger.warn(message);
    this.sendTo(this.clientId, message, tag ? tag : 'warn');
  }

  debug(message: string, tag?: string) {
    this.logger.debug(message);
    this.sendTo(this.clientId, message, tag ? tag : 'debug');
  }

  verbose(message: string, tag?: string) {
    this.logger.verbose(message);
    this.sendTo(this.clientId, message, tag ? tag : 'verbose');
  }
  complete(clientId?: string) {
    this.loggerGateway.sendExitTo(clientId ? clientId : this.clientId);
  }
}
