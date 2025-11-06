import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from '../settings/setting.entity';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import * as winston from 'winston';
import { ModuleRef } from '@nestjs/core';

export type LoggerConfig = {
  filePath: string;
  fileLevel: string;
  maxSizeMb: number;
  maxFiles: number;
  zippedArchive: boolean;
};

export const FILE_TRANSPORT_NAME = 'logger-config-file';
const DEFAULT_FILE_LEVEL = process.env.LOG_LEVEL_FILE || 'error';
const DEFAULT_FILE_PATH = process.env.LOG_FILE || './logs/app.log';

const DEFAULT_MAX_SIZE_MB = (() => {
  const raw = Number(process.env.LOG_FILE_MAX_SIZE_MB ?? 20);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 20;
})();

const DEFAULT_MAX_FILES = (() => {
  const raw = Number(process.env.LOG_FILE_MAX_FILES ?? 30);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 30;
})();

const DEFAULT_ZIPPED =
  (process.env.LOG_FILE_ZIPPED || '1').toString().toLowerCase() !== '0';

function clamp(num: number, min: number, max: number): number {
  if (!Number.isFinite(num)) return min;
  return Math.max(min, Math.min(max, Math.floor(num)));
}

const allowedLevels = new Set(['error', 'warn', 'tc', 'info', 'debug']);

export function buildLoggerDefaults(): LoggerConfig {
  return {
    filePath: DEFAULT_FILE_PATH,
    fileLevel: DEFAULT_FILE_LEVEL,
    maxSizeMb: DEFAULT_MAX_SIZE_MB,
    maxFiles: DEFAULT_MAX_FILES,
    zippedArchive: DEFAULT_ZIPPED,
  };
}

export function sanitizeLoggerConfig(
  input: Partial<LoggerConfig> | null | undefined,
): LoggerConfig {
  const base = buildLoggerDefaults();
  const path =
    typeof input?.filePath === 'string' && input.filePath.trim()
      ? input.filePath.trim()
      : base.filePath;
  const level =
    typeof input?.fileLevel === 'string' &&
    allowedLevels.has(input.fileLevel as any)
      ? input.fileLevel
      : base.fileLevel;
  const maxSize =
    input?.maxSizeMb !== undefined
      ? clamp(input.maxSizeMb, 1, 1024)
      : base.maxSizeMb;
  const maxFiles =
    input?.maxFiles !== undefined
      ? clamp(input.maxFiles, 1, 200)
      : base.maxFiles;
  const zipped =
    input?.zippedArchive !== undefined
      ? !!input.zippedArchive
      : base.zippedArchive;
  return {
    filePath: path,
    fileLevel: level,
    maxSizeMb: maxSize,
    maxFiles,
    zippedArchive: zipped,
  };
}

@Injectable()
export class LoggerConfigService {
  private loggerInstance: winston.Logger | null = null;

  constructor(
    @InjectRepository(Setting)
    private readonly settingsRepo: Repository<Setting>,
    private readonly moduleRef: ModuleRef,
  ) {}

  private async loadRaw(): Promise<Partial<LoggerConfig> | null> {
    const row = await this.settingsRepo.findOne({
      where: { key: 'logger.config' },
    });
    if (!row?.value) return null;
    try {
      const parsed = JSON.parse(row.value) as Partial<LoggerConfig>;
      return parsed ?? null;
    } catch {
      return null;
    }
  }

  async getConfig(): Promise<LoggerConfig> {
    const raw = await this.loadRaw();
    return sanitizeLoggerConfig(raw ?? undefined);
  }

  private async save(config: LoggerConfig): Promise<void> {
    const existing = await this.settingsRepo.findOne({
      where: { key: 'logger.config' },
    });
    const payload = JSON.stringify(config);
    if (existing) {
      existing.value = payload;
      existing.encrypted = false;
      await this.settingsRepo.save(existing);
    } else {
      const row = this.settingsRepo.create({
        key: 'logger.config',
        value: payload,
        encrypted: false,
      });
      await this.settingsRepo.save(row);
    }
  }

  async updateConfig(
    partial: Partial<LoggerConfig>,
  ): Promise<LoggerConfig> {
    const current = await this.getConfig();
    const next = sanitizeLoggerConfig({
      ...current,
      ...partial,
    });
    await this.save(next);
    await this.applyConfig(next);
    return next;
  }

  async applyConfig(config?: LoggerConfig): Promise<void> {
    const logger =
      this.loggerInstance ||
      this.moduleRef.get<winston.Logger>(WINSTON_MODULE_PROVIDER, {
        strict: false,
      });
    if (!logger) return;
    this.loggerInstance = logger;
    const cfg = config ?? (await this.getConfig());
    const existing = logger.transports.find(
      (transport: any) => transport?.name === FILE_TRANSPORT_NAME,
    );
    if (existing) {
      logger.remove(existing);
    }
    const fileTransport = new winston.transports.File({
      filename: cfg.filePath,
      level: cfg.fileLevel,
      zippedArchive: cfg.zippedArchive,
      maxsize: Math.max(1, cfg.maxSizeMb) * 1024 * 1024,
      maxFiles: cfg.maxFiles,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, context, clientId }) => {
          const tag = context ? `[${context}]` : '';
          const clientTag = clientId ? `[${clientId}]` : '';
          return `${timestamp} ${level} ${tag} ${clientTag} ${message}`;
        }),
      ),
    });
    fileTransport.name = FILE_TRANSPORT_NAME;
    logger.add(fileTransport);
  }
}
