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

  private format(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    const tag = this.context ? `[${this.context}]` : '';
    return `${timestamp} ${level} ${tag} ${message}`;
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

  sendLogTo(clientId: string, message: string) {
    this.loggerGateway?.sendLogTo(clientId, this.format('', message));
  }
  sendDebugTo(clientId: string, message: string) {
    if (!clientId) {
      this.logger.error('client id not initialized!');
      return;
    }
    this.loggerGateway?.sendLogTo(clientId, this.format('debug', message));
    this.logger.debug(message);
  }
  sendErrorTo(clientId: string, message: string) {
    if (!clientId) {
      this.logger.error('client id not initialized!');
      return;
    }
    this.loggerGateway?.sendLogTo(clientId, this.format('error', message));
    this.logger.error(message);
  }
  sendInfoTo(clientId: string, message: string) {
    this.loggerGateway?.sendLogTo(clientId, this.format('info', message));
    this.logger.info(message);
  }
  sendWarnTo(clientId: string, message: string) {
    this.loggerGateway?.sendLogTo(clientId, this.format('warn', message));
    this.logger.warn(message);
  }
  sendExitTo(clientId: string) {
    this.loggerGateway.sendExitTo(clientId);
  }

  verbose(message: string) {
    this.logger.verbose(message);
  }
}
