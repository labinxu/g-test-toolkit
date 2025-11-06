import {
  Body,
  Controller,
  Get,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { LoggerConfigService } from './logger-config.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { ensureAdminOrBootstrap } from '../settings/admin.util';

@Controller('settings/logger')
@UseGuards(AuthGuard('jwt'))
export class LoggerSettingsController {
  constructor(
    private readonly loggerConfig: LoggerConfigService,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  @Get()
  async getConfig(@Req() req: any) {
    await ensureAdminOrBootstrap(this.usersRepo, req);
    const cfg = await this.loggerConfig.getConfig();
    return {
      filePath: cfg.filePath,
      fileLevel: cfg.fileLevel,
      maxSizeMb: cfg.maxSizeMb,
      maxFiles: cfg.maxFiles,
      zippedArchive: cfg.zippedArchive,
    };
  }

  @Put()
  async updateConfig(@Req() req: any, @Body() body: any) {
    await ensureAdminOrBootstrap(this.usersRepo, req);
    const partial: Record<string, any> = {};
    if (typeof body?.filePath === 'string') partial.filePath = body.filePath;
    if (typeof body?.fileLevel === 'string') partial.fileLevel = body.fileLevel;
    if (body?.maxSizeMb !== undefined) {
      const num = Number(body.maxSizeMb);
      if (Number.isFinite(num)) partial.maxSizeMb = num;
    }
    if (body?.maxFiles !== undefined) {
      const num = Number(body.maxFiles);
      if (Number.isFinite(num)) partial.maxFiles = num;
    }
    if (body?.zippedArchive !== undefined) {
      partial.zippedArchive =
        body.zippedArchive === true ||
        body.zippedArchive === '1' ||
        body.zippedArchive === 1;
    }
    const next = await this.loggerConfig.updateConfig(partial);
    return {
      filePath: next.filePath,
      fileLevel: next.fileLevel,
      maxSizeMb: next.maxSizeMb,
      maxFiles: next.maxFiles,
      zippedArchive: next.zippedArchive,
    };
  }
}
