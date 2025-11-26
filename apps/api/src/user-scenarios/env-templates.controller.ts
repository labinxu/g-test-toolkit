import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnvTemplate } from './entities/env-template.entity';

@Controller('env-templates')
@UseGuards(AuthGuard('jwt'))
export class EnvTemplatesController {
  constructor(
    @InjectRepository(EnvTemplate)
    private readonly repo: Repository<EnvTemplate>,
  ) {}

  @Get()
  async list(
    @Query('platform') platform?: string,
    @Query('driver') driver?: string,
  ) {
    const qb = this.repo.createQueryBuilder('t');
    if (platform && platform.trim()) {
      qb.andWhere('t.platform = :platform', {
        platform: platform.trim().toLowerCase(),
      });
    }
    if (driver && driver.trim()) {
      qb.andWhere('t.driver = :driver', {
        driver: driver.trim().toLowerCase(),
      });
    }
    qb.orderBy('t.sortOrder', 'ASC').addOrderBy('t.id', 'ASC');
    const items = await qb.getMany();
    return { items };
  }

  @Post()
  async create(
    @Body()
    body: {
      platform: string;
      driver: 'browser' | 'android' | 'ios' | 'other';
      key: string;
      name: string;
      description?: string | null;
      config: any;
      enabled?: boolean;
      sortOrder?: number;
    },
  ) {
    const entity = new EnvTemplate();
    entity.platform = (body.platform || 'gettr-web').toLowerCase();
    entity.driver = (body.driver ||
      'browser') as 'browser' | 'android' | 'ios' | 'other';
    entity.key = (body.key || '').trim();
    entity.name = (body.name || '').trim() || entity.key;
    entity.description = body.description || null;
    entity.config = JSON.stringify(body.config ?? {});
    entity.enabled = body.enabled ?? true;
    entity.sortOrder = body.sortOrder ?? 0;
    await this.repo.save(entity);
    return entity;
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      platform?: string;
      driver?: 'browser' | 'android' | 'ios' | 'other';
      key?: string;
      name?: string;
      description?: string | null;
      config?: any;
      enabled?: boolean;
      sortOrder?: number;
    },
  ) {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) {
      return;
    }
    if (body.platform !== undefined) {
      entity.platform = (body.platform || 'gettr-web').toLowerCase();
    }
    if (body.driver !== undefined) {
      entity.driver = body.driver;
    }
    if (body.key !== undefined) {
      entity.key = (body.key || '').trim();
    }
    if (body.name !== undefined) {
      entity.name = (body.name || '').trim() || entity.key;
    }
    if (body.description !== undefined) {
      entity.description = body.description || null;
    }
    if (body.config !== undefined) {
      entity.config = JSON.stringify(body.config ?? {});
    }
    if (body.enabled !== undefined) {
      entity.enabled = body.enabled;
    }
    if (body.sortOrder !== undefined) {
      entity.sortOrder = body.sortOrder;
    }
    await this.repo.save(entity);
    return entity;
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) return { result: 'ok' };
    await this.repo.remove(entity);
    return { result: 'ok' };
  }
}

