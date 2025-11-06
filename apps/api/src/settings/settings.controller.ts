import {
  Body,
  Controller,
  Get,
  Put,
  Req,
  UseGuards,
  Post,
  Delete,
  Param,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { ensureAdminOrBootstrap } from './admin.util';

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('ai')
  async getAi(@Req() req: any) {
    const user = req?.user as any;
    if (!user?.id) throw new UnauthorizedException('No user');
    const cfg = await this.settings.getAiConfig(Number(user.id));
    return {
      provider: cfg.provider || '',
      model: cfg.model || '',
      baseUrl: cfg.baseUrl || '',
      hasApiKey: !!cfg.apiKey,
      timeoutMs: cfg.timeoutMs ?? null,
      maxTokens: cfg.maxTokens ?? null,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('ai')
  async setAi(@Req() req: any, @Body() body: any) {
    const user = req?.user as any;
    if (!user?.id) throw new UnauthorizedException('No user');
    const provider =
      typeof body?.provider === 'string' ? body.provider : undefined;
    const model = typeof body?.model === 'string' ? body.model : undefined;
    const baseUrl =
      typeof body?.baseUrl === 'string' ? body.baseUrl : undefined;
    const apiKey = typeof body?.apiKey === 'string' ? body.apiKey : undefined;
    const clearKey = body?.clearKey === true || body?.clearKey === '1';
    let timeoutMs: number | undefined;
    let maxTokens: number | undefined;
    if (body?.timeoutMs !== undefined) {
      const raw = Number(body.timeoutMs);
      if (!Number.isFinite(raw)) {
        throw new BadRequestException('timeoutMs must be a number');
      }
      timeoutMs = raw;
    }
    if (body?.maxTokens !== undefined) {
      const raw = Number(body.maxTokens);
      if (!Number.isFinite(raw)) {
        throw new BadRequestException('maxTokens must be a number');
      }
      maxTokens = Math.max(64, Math.min(512000, Math.floor(raw)));
    }
    await this.settings.setAiConfig(
      {
        provider,
        model,
        baseUrl,
        apiKey,
        clearKey,
        timeoutMs,
        maxTokens,
      },
      Number(user.id),
    );
    const cfg = await this.settings.getAiConfig(Number(user.id));
    return {
      ok: true,
      hasApiKey: !!cfg.apiKey,
      timeoutMs: cfg.timeoutMs ?? null,
      maxTokens: cfg.maxTokens ?? null,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('admins')
  async listAdmins(@Req() req: any) {
    await ensureAdminOrBootstrap(this.users, req);
    const url = new URL(
      req?.raw?.url ?? req?.url ?? '',
      'http://localhost',
    ) as any;
    const q = (url.searchParams?.get?.('q') || '')
      .toString()
      .trim()
      .toLowerCase();
    const page = Math.max(
      1,
      Math.min(
        100000,
        parseInt(url.searchParams?.get?.('page') || '1', 10) || 1,
      ),
    );
    const pageSize = Math.max(
      1,
      Math.min(
        200,
        parseInt(url.searchParams?.get?.('pageSize') || '20', 10) || 20,
      ),
    );
    const sortByRaw = (url.searchParams?.get?.('sortBy') || 'id').toString();
    const sortDirRaw = (url.searchParams?.get?.('sortDir') || 'asc')
      .toString()
      .toLowerCase();
    const allowedSort: Record<string, string> = {
      id: 'u.id',
      username: 'u.username',
      email: 'u.email',
      isAdmin: 'u.isAdmin',
    };
    const sortByKey = allowedSort[sortByRaw] ? sortByRaw : 'id';
    const sortField = allowedSort[sortByKey];
    const sortDir: 'ASC' | 'DESC' = sortDirRaw === 'desc' ? 'DESC' : 'ASC';
    const qb = this.users.createQueryBuilder('u');
    if (q) {
      qb.where('LOWER(u.username) LIKE :kw OR LOWER(u.email) LIKE :kw', {
        kw: `%${q}%`,
      });
    }
    const total = await qb.getCount();
    const items = await qb
      .orderBy(sortField, sortDir)
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();
    return {
      items: items.map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        isAdmin: !!u.isAdmin,
      })),
      total,
      page,
      pageSize,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('admins')
  async updateAdmins(@Req() req: any, @Body() body: any) {
    await ensureAdminOrBootstrap(this.users, req);
    const updates: Array<{ id: number; isAdmin: boolean }> = Array.isArray(
      body?.updates,
    )
      ? body.updates
      : [];
    if (!updates.length) return { ok: true };
    const ids = updates.map((u) => u.id);
    const rows = await this.users.findBy({ id: In(ids as any) });
    // Strong guard: ensure at least one admin remains after update
    const currentAdminCount = await this.users.count({
      where: { isAdmin: true },
    });
    let inc = 0;
    let dec = 0;
    for (const u of updates) {
      const row = rows.find((r) => r.id === u.id);
      if (!row) continue;
      const next = !!u.isAdmin;
      const prev = !!row.isAdmin;
      if (prev && !next) dec += 1;
      if (!prev && next) inc += 1;
    }
    const nextAdminCount = currentAdminCount + inc - dec;
    if (nextAdminCount <= 0) {
      throw new ForbiddenException('Cannot remove the last admin');
    }
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const u of updates) {
      const row = byId.get(u.id);
      if (row) row.isAdmin = !!u.isAdmin;
    }
    await this.users.save(Array.from(byId.values()));
    return { ok: true };
  }

  // --- User management ---
  @UseGuards(AuthGuard('jwt'))
  @Post('users')
  async createUser(
    @Req() req: any,
    @Body()
    body: {
      username?: string;
      email?: string;
      password?: string;
      isAdmin?: boolean;
    },
  ) {
    await ensureAdminOrBootstrap(this.users, req);
    const username = (body?.username || '').trim();
    const email = (body?.email || '').trim();
    const password = body?.password || '';
    if (!username || !email || !password)
      throw new BadRequestException('username/email/password required');
    const existing = await this.users.findOne({ where: { email } });
    if (existing) throw new BadRequestException('Email already exists');
    const salt = await bcrypt.genSalt();
    const hashed = await bcrypt.hash(password, salt);
    const user = this.users.create({
      username,
      email,
      password: hashed,
      isAdmin: !!body?.isAdmin,
    });
    const saved = await this.users.save(user);
    return {
      id: saved.id,
      username: saved.username,
      email: saved.email,
      isAdmin: !!saved.isAdmin,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('users/:id')
  async deleteUser(@Req() req: any, @Param('id') id: string) {
    await ensureAdminOrBootstrap(this.users, req);
    const uid = parseInt(id, 10);
    if (!Number.isFinite(uid)) throw new BadRequestException('Invalid id');
    const user = await this.users.findOne({ where: { id: uid } });
    if (!user) return { ok: true };
    if (user.isAdmin) {
      const adminCount = await this.users.count({ where: { isAdmin: true } });
      if (adminCount <= 1)
        throw new ForbiddenException('Cannot delete the last admin');
    }
    await this.users.delete({ id: uid } as any);
    return { ok: true };
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('users/:id/password')
  async resetPassword(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { password?: string },
  ) {
    await ensureAdminOrBootstrap(this.users, req);
    const uid = parseInt(id, 10);
    if (!Number.isFinite(uid)) throw new BadRequestException('Invalid id');
    const pw = (body?.password || '').trim();
    if (pw.length < 6) throw new BadRequestException('Password too short');
    const user = await this.users.findOne({ where: { id: uid } });
    if (!user) throw new BadRequestException('User not found');
    const salt = await bcrypt.genSalt();
    user.password = await bcrypt.hash(pw, salt);
    await this.users.save(user);
    return { ok: true };
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('users/:id')
  async updateUser(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { username?: string; email?: string },
  ) {
    await ensureAdminOrBootstrap(this.users, req);
    const uid = parseInt(id, 10);
    if (!Number.isFinite(uid)) throw new BadRequestException('Invalid id');
    const user = await this.users.findOne({ where: { id: uid } });
    if (!user) throw new BadRequestException('User not found');
    const username =
      typeof body?.username === 'string' ? body.username.trim() : undefined;
    const email =
      typeof body?.email === 'string' ? body.email.trim() : undefined;
    if (email != null) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (email && !emailRegex.test(email))
        throw new BadRequestException('Invalid email format');
      if (email && email !== user.email) {
        const exists = await this.users.findOne({ where: { email } });
        if (exists) throw new BadRequestException('Email already exists');
      }
      user.email = email || user.email;
    }
    if (username != null) {
      if (!username) throw new BadRequestException('username empty');
      if (username !== user.username) {
        const exists = await this.users.findOne({ where: { username } });
        if (exists) throw new BadRequestException('Username already exists');
      }
      user.username = username;
    }
    await this.users.save(user);
    return { ok: true };
  }
}
