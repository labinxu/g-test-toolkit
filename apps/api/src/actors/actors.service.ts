import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Actor } from './entities/actor.entity';
import { ActorEnv } from './entities/actor-env.entity';
import { CreateActorDto } from './dto/create-actor.dto';
import { UpdateActorDto } from './dto/update-actor.dto';

const DEFAULT_ENVS = ['qa1x', 'qa4', 'stg', 'prod'] as const;

@Injectable()
export class ActorsService {
  constructor(
    @InjectRepository(Actor) private readonly actors: Repository<Actor>,
    @InjectRepository(ActorEnv) private readonly envs: Repository<ActorEnv>,
  ) {}

  async ensureSeedEnvs(): Promise<void> {
    const existing = await this.envs.find();
    const existingSet = new Set(existing.map((e) => (e.name || '').toString()));
    const missing = DEFAULT_ENVS.filter((name) => !existingSet.has(name));
    if (!missing.length) return;
    const toInsert = missing.map((name) => {
      const env = new ActorEnv();
      env.name = name;
      return env;
    });
    await this.envs.save(toInsert);
  }

  async listEnvs() {
    await this.ensureSeedEnvs();
    const list = await this.envs.find();
    const order = new Map<string, number>(DEFAULT_ENVS.map((v, idx) => [v, idx]));
    return list
      .slice()
      .sort((a, b) => (order.get(a.name) ?? 999) - (order.get(b.name) ?? 999))
      .map((e) => ({ id: e.id, name: e.name }));
  }

  async listActors() {
    await this.ensureSeedEnvs();
    const list = await this.actors.find({ order: { id: 'DESC' as any } });
    return list.map((a) => ({
      id: a.id,
      accountName: a.accountName,
      password: a.password,
      env: a.env ? { id: a.env.id, name: a.env.name } : null,
      envId: a.envId,
    }));
  }

  async create(dto: CreateActorDto) {
    const accountName = (dto.accountName || '').toString().trim();
    const password = (dto.password || '').toString();
    const envId = Number(dto.envId);
    if (!accountName) throw new BadRequestException('accountName is required');
    if (!Number.isFinite(envId) || envId <= 0)
      throw new BadRequestException('envId is invalid');

    const env = await this.envs.findOne({ where: { id: envId } });
    if (!env) throw new BadRequestException('envId not found');

    const actor = new Actor();
    actor.accountName = accountName;
    actor.password = password;
    actor.envId = env.id;
    const saved = await this.actors.save(actor);
    const loaded = await this.actors.findOne({ where: { id: saved.id } });
    return loaded
      ? {
          id: loaded.id,
          accountName: loaded.accountName,
          password: loaded.password,
          env: loaded.env ? { id: loaded.env.id, name: loaded.env.name } : null,
          envId: loaded.envId,
        }
      : null;
  }

  async update(id: number, dto: UpdateActorDto) {
    const actor = await this.actors.findOne({ where: { id } });
    if (!actor) throw new NotFoundException('Actor not found');

    if (dto.accountName !== undefined) {
      const v = (dto.accountName || '').toString().trim();
      if (!v) throw new BadRequestException('accountName is required');
      actor.accountName = v;
    }
    if (dto.password !== undefined) {
      actor.password = (dto.password || '').toString();
    }
    if (dto.envId !== undefined) {
      const envId = Number(dto.envId);
      if (!Number.isFinite(envId) || envId <= 0)
        throw new BadRequestException('envId is invalid');
      const env = await this.envs.findOne({ where: { id: envId } });
      if (!env) throw new BadRequestException('envId not found');
      actor.envId = env.id;
    }

    await this.actors.save(actor);
    const loaded = await this.actors.findOne({ where: { id } });
    return loaded
      ? {
          id: loaded.id,
          accountName: loaded.accountName,
          password: loaded.password,
          env: loaded.env ? { id: loaded.env.id, name: loaded.env.name } : null,
          envId: loaded.envId,
        }
      : null;
  }

  async remove(id: number) {
    const actor = await this.actors.findOne({ where: { id } });
    if (!actor) throw new NotFoundException('Actor not found');
    await this.actors.delete({ id });
    return { ok: true };
  }
}
