import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { Setting } from './setting.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting)
    private readonly repo: Repository<Setting>,
  ) {}

  private getMasterKey(): Buffer | null {
    const raw = process.env.CONFIG_ENCRYPTION_KEY || '';
    if (!raw) return null;
    // normalize to 32 bytes
    const buf = Buffer.from(raw.padEnd(32, '0').slice(0, 32));
    return buf.length === 32 ? buf : null;
  }

  private encrypt(plain: string): string {
    const key = this.getMasterKey();
    if (!key) return plain; // not encrypted
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([
      cipher.update(Buffer.from(plain, 'utf8')),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([Buffer.from('1'), iv, tag, enc]).toString('base64');
  }

  private decrypt(data: string, encrypted: boolean): string {
    if (!encrypted) return data;
    const key = this.getMasterKey();
    if (!key) return data; // cannot decrypt without key
    const buf = Buffer.from(data, 'base64');
    // layout: [1-byte ver][12-byte iv][16-byte tag][...cipher]
    const ver = buf.subarray(0, 1);
    if (ver[0] !== 0x31) return data; // unknown version, return raw
    const iv = buf.subarray(1, 13);
    const tag = buf.subarray(13, 29);
    const enc = buf.subarray(29);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString('utf8');
  }

  async get(key: string): Promise<string | null> {
    const row = await this.repo.findOne({ where: { key } });
    if (!row) return null;
    return this.decrypt(row.value || '', !!row.encrypted);
  }

  async set(
    key: string,
    value: string | null,
    opts?: { encrypt?: boolean },
  ): Promise<void> {
    const encrypted = !!opts?.encrypt && !!this.getMasterKey();
    const toStore =
      value == null ? null : encrypted ? this.encrypt(value) : value;
    const existing = await this.repo.findOne({ where: { key } });
    if (existing) {
      existing.value = toStore;
      existing.encrypted = encrypted;
      await this.repo.save(existing);
    } else {
      const row = this.repo.create({ key, value: toStore, encrypted });
      await this.repo.save(row);
    }
  }

  private makeKey(base: string, userId?: number | null) {
    if (userId == null) return base;
    return `user:${userId}:${base}`;
  }

  private async getValue(
    base: string,
    userId?: number | null,
  ): Promise<string | null> {
    if (userId != null) {
      const scoped = await this.get(this.makeKey(base, userId));
      if (scoped != null) return scoped;
    }
    return userId == null ? this.get(base) : null;
  }

  async getAiConfig(userId?: number): Promise<{
    provider: string;
    model: string;
    baseUrl: string;
    apiKey: string | null;
    timeoutMs: number | null;
    maxTokens: number | null;
  }> {
    const provider = (await this.getValue('ai.provider', userId)) || '';
    const model = (await this.getValue('ai.model', userId)) || '';
    const baseUrl = (await this.getValue('ai.baseUrl', userId)) || '';
    const apiKey = (await this.getValue('ai.apiKey', userId)) || null;
    const timeoutRaw = await this.getValue('ai.timeoutMs', userId);
    let timeoutMs: number | null = null;
    if (timeoutRaw != null) {
      const parsed = parseInt(timeoutRaw, 10);
      if (Number.isFinite(parsed)) timeoutMs = parsed;
    }
    const maxTokensRaw = await this.getValue('ai.maxTokens', userId);
    const maxTokens = maxTokensRaw ? parseInt(maxTokensRaw, 10) || null : null;
    return { provider, model, baseUrl, apiKey, timeoutMs, maxTokens };
  }

  async setAiConfig(
    input: {
      provider?: string;
      model?: string;
      baseUrl?: string;
      apiKey?: string | null;
      clearKey?: boolean;
      timeoutMs?: number | null;
      maxTokens?: number | null;
    },
    userId?: number,
  ): Promise<void> {
    // If API key provided while encryption is required but no master key configured, reject
    const encryptionRequired =
      (process.env.REQUIRE_CONFIG_ENCRYPTION || '') === '1';
    const hasMaster = !!this.getMasterKey();
    if (
      !input?.clearKey &&
      typeof input?.apiKey === 'string' &&
      input.apiKey !== '' &&
      encryptionRequired &&
      !hasMaster
    ) {
      throw new Error(
        'Saving API key requires CONFIG_ENCRYPTION_KEY to be set',
      );
    }
    const scopedKey = (suffix: string) =>
      this.makeKey(`ai.${suffix}`, userId ?? null);

    if (input.provider != null)
      await this.set(scopedKey('provider'), input.provider);
    if (input.model != null) await this.set(scopedKey('model'), input.model);
    if (input.baseUrl != null)
      await this.set(scopedKey('baseUrl'), input.baseUrl);
    if (input.clearKey)
      await this.set(scopedKey('apiKey'), null, { encrypt: true });
    else if (input.apiKey != null && input.apiKey !== '')
      await this.set(scopedKey('apiKey'), input.apiKey, { encrypt: true });
    if (input.timeoutMs !== undefined) {
      if (input.timeoutMs == null) {
        await this.set(scopedKey('timeoutMs'), null);
      } else {
        const raw = Math.floor(input.timeoutMs);
        if (raw <= 0) {
          await this.set(scopedKey('timeoutMs'), '0');
        } else {
          const clamped = Math.max(1000, Math.min(600000, raw));
          await this.set(scopedKey('timeoutMs'), String(clamped));
        }
      }
    }
    if (input.maxTokens !== undefined) {
      if (input.maxTokens == null) {
        await this.set(scopedKey('maxTokens'), null);
      } else {
        const clamped = Math.max(
          64,
          Math.min(512000, Math.floor(input.maxTokens)),
        );
        await this.set(scopedKey('maxTokens'), String(clamped));
      }
    }
  }
}
