import { Injectable, Scope } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import * as winston from 'winston';
import { Inject } from '@nestjs/common';

@Injectable({ scope: Scope.TRANSIENT })
export class CustomLogger {
  private readonly logger: winston.Logger;

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) winstonLogger: winston.Logger,
    private readonly context: string,
  ) {
    this.logger = winstonLogger.child({ context });
  }

  log(message: string) {
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

  verbose(message: string) {
    this.logger.verbose(message);
  }
}
