import { Module, Scope } from '@nestjs/common';
import { WinstonModule, WINSTON_MODULE_PROVIDER } from 'nest-winston';
import * as winston from 'winston';
import * as dotenv from 'dotenv';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomLogger } from './logger.custom';
import { LoggerService } from './logger.service';
import { LoggerGateway } from './logger.gateway';
import {
  LoggerConfigService,
  FILE_TRANSPORT_NAME,
  sanitizeLoggerConfig,
} from './logger-config.service';
import { LoggerSettingsController } from './logger-settings.controller';
import { Setting } from '../settings/setting.entity';
import { User } from '../auth/entities/user.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

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
    TypeOrmModule.forFeature([Setting, User]),
    WinstonModule.forRootAsync({
      imports: [TypeOrmModule.forFeature([Setting])],
      inject: [getRepositoryToken(Setting)],
      useFactory: async (settingsRepo: Repository<Setting>) => {
        let stored: Partial<{
          filePath: string;
          fileLevel: string;
          maxSizeMb: number;
          maxFiles: number;
          zippedArchive: boolean;
        }> | null = null;
        const row = await settingsRepo.findOne({
          where: { key: 'logger.config' },
        });
        if (row?.value) {
          try {
            stored = JSON.parse(row.value);
          } catch {
            stored = null;
          }
        }
        const cfg = sanitizeLoggerConfig(stored ?? undefined);
        const consoleTransport = new winston.transports.Console({
          level: process.env.LOG_LEVEL_CONSOLE ?? 'info',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize(),
            loggerFormat,
          ),
        });
        const fileTransport = new winston.transports.File({
          filename: cfg.filePath,
          level: cfg.fileLevel,
          zippedArchive: cfg.zippedArchive,
          maxsize: Math.max(1, cfg.maxSizeMb) * 1024 * 1024,
          maxFiles: cfg.maxFiles,
          format: winston.format.combine(
            winston.format.timestamp(),
            loggerFormat,
          ),
        });
        fileTransport.name = FILE_TRANSPORT_NAME;
        const transports: winston.transport[] = [consoleTransport, fileTransport];
        return {
          levels: customLevels,
          transports,
        };
      },
    }),
  ],
  controllers: [LoggerSettingsController],
  providers: [
    LoggerGateway,
    LoggerConfigService,
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
  exports: [LoggerService, CustomLogger, LoggerGateway, LoggerConfigService],
})
export class LoggerModule {}
