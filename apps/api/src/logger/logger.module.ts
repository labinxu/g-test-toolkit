import { Module, Scope } from '@nestjs/common';
import { WinstonModule, WINSTON_MODULE_PROVIDER } from 'nest-winston';
import * as winston from 'winston';
import * as dotenv from 'dotenv';
import { CustomLogger } from './logger.custom';
import { LoggerService } from './logger.service';
import { LoggerGateway } from './logger.gateway';

dotenv.config();

const loggerFormat = winston.format.printf(
  ({ timestamp, level, message, context, clientId }) => {
    const tag = context ? `[${context}]` : '';
    const clientTag = clientId ? `[${clientId}]` : '';
    return `${timestamp} ${level} ${tag} ${clientTag} ${message}`;
  },
);
const customLevels = {
  error: 0,
  warn: 1,
  tc: 2, // 新增的 level
  info: 3,
  debug: 4,
};
winston.addColors({ tc: 'cyan' });
@Module({
  imports: [
    WinstonModule.forRoot({
      levels: customLevels,
      transports: [
        new winston.transports.Console({
          level: process.env.LOG_LEVEL_CONSOLE,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize(),
            loggerFormat,
          ),
        }),
        new winston.transports.File({
          filename: process.env.LOG_FILE,
          level: process.env.LOG_LEVEL_FILE || 'error',
          zippedArchive: true,
          maxsize: 20 * 1024 * 1024,
          maxFiles: 30,
          format: winston.format.combine(
            winston.format.timestamp(),
            loggerFormat,
          ),
        }),
      ],
    }),
  ],
  providers: [
    LoggerGateway,
    {
      provide: CustomLogger,
      useFactory: (
        winstonLogger: winston.Logger,
        loggerGateway: LoggerGateway,
      ) => {
        return new CustomLogger(winstonLogger, loggerGateway);
      },
      inject: [WINSTON_MODULE_PROVIDER, LoggerGateway],
      scope: Scope.TRANSIENT,
    },
    {
      provide: LoggerService,
      useFactory: (
        winstonLogger: winston.Logger,
        loggerGateway: LoggerGateway,
      ) => {
        return new LoggerService(winstonLogger, loggerGateway);
      },
      inject: [WINSTON_MODULE_PROVIDER, LoggerGateway],
    },
  ],
  exports: [LoggerService, CustomLogger, LoggerGateway], // Add LoggerGateway to exports
})
export class LoggerModule {}
