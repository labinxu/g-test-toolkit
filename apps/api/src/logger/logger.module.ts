import { Module, Scope } from '@nestjs/common'; // Import Scope from @nestjs/common
import { WinstonModule, WINSTON_MODULE_PROVIDER } from 'nest-winston'; // Import WINSTON_MODULE_PROVIDER
import * as winston from 'winston';
import * as dotenv from 'dotenv';
import { CustomLogger } from './logger.custom';
import { LoggerService } from './logger.service';

dotenv.config();
const loggerFormat = winston.format.printf(
  ({ timestamp, level, message, context }) => {
    const tag = context ? `[${context}]` : '';
    return `${timestamp} ${level} ${tag} ${message}`;
  },
);

@Module({
  imports: [
    WinstonModule.forRoot({
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
          level: process.env.LOG_LEVEL_FILE|| 'error',
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
    {
      provide: CustomLogger,
      useFactory: (winstonLogger: winston.Logger, context?: string) => {
        return new CustomLogger(winstonLogger, context || 'Default');
      },
      inject: [WINSTON_MODULE_PROVIDER], // Now correctly recognized
      scope: Scope.TRANSIENT, // Now correctly recognized
    },
    LoggerService, // Add LoggerService as a provider
  ],
  exports: [LoggerService, CustomLogger], // Export both for use in other modules
})
export class LoggerModule {}
