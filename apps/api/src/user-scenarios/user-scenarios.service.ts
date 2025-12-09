import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import {
  UserScenario,
  UserScenarioStatus,
} from './entities/user-scenario.entity';
import { UserScenarioStep } from './entities/user-scenario-step.entity';
import { UserScenarioSuite } from './entities/user-scenario-suite.entity';
import { UserScenarioSummaryDto } from './dto/user-scenario-summary.dto';
import {
  UserScenarioStepInputDto,
  UpsertUserScenarioStepsDto,
} from './dto/upsert-steps.dto';
import { UpdateUserScenarioDto } from './dto/update-scenario.dto';
import { CreateUserScenarioDto } from './dto/create-scenario.dto';
import { StepBindingV1, StepCheckRule } from './action-catalog';
import { ActionCatalogService } from './action-catalog.service';
import { UserScenarioOption } from './entities/user-scenario-option.entity';
import { EnvTemplate } from './entities/env-template.entity';

@Injectable()
export class UserScenariosService {
  constructor(
    @InjectRepository(UserScenario)
    readonly caseRepo: Repository<UserScenario>,
  @InjectRepository(UserScenarioStep)
  private readonly stepRepo: Repository<UserScenarioStep>,
  @InjectRepository(UserScenarioSuite)
  private readonly suiteRepo: Repository<UserScenarioSuite>,
    @InjectRepository(UserScenarioOption)
    private readonly optionRepo: Repository<UserScenarioOption>,
    @InjectRepository(EnvTemplate)
    private readonly envTemplateRepo: Repository<EnvTemplate>,
    private readonly actionCatalog: ActionCatalogService,
  ) {}

  private sanitizeName(value: string | null | undefined): string {
    const trimmed = (value || '').trim();
    if (!trimmed) return 'default';
    return trimmed.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'default';
  }

  private normalizePlatform(value?: string | null): string {
    const raw = (value || '').toString().trim().toLowerCase();
    return raw || 'gettr-web';
  }

  private normalizeModule(value?: string | null): string {
    const raw = (value || '').toString().trim();
    if (!raw) return 'livestream';
    // 仅保留字母和数字
    const cleaned = raw.replace(/[^A-Za-z0-9]+/g, '');
    return cleaned || 'livestream';
  }

  private parseSharedPreSteps(raw?: string | null): string[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((s) => (typeof s === 'string' ? s.trim() : ''))
          .filter((s) => s.length > 0);
      }
    } catch {
      // ignore parse errors
    }
    return [];
  }

  private serializeSharedPreSteps(items?: string[] | null): string | null {
    if (!items || !items.length) return null;
    const normalized = items
      .map((s) => (s || '').toString().trim())
      .filter((s) => s.length > 0);
    if (!normalized.length) return null;
    return JSON.stringify(normalized);
  }

  private async ensureOption(
    kind: 'module' | 'submenu' | 'priority',
    rawValue?: string | null,
  ): Promise<void> {
    const val = (rawValue || '').toString().trim();
    if (!val) return;
    let value: string;
    if (kind === 'module') {
      value = this.normalizeModule(val);
    } else if (kind === 'priority') {
      // 优先级直接使用 P0/P1/P2 小写化
      value = val.toUpperCase();
    } else {
      // submenu：保留现有 sanitize 规则
      value = this.sanitizeName(val.toLowerCase());
    }
    if (!value) return;
    const exists = await this.optionRepo.findOne({ where: { kind, value } });
    if (exists) return;
    const opt = new UserScenarioOption();
    opt.kind = kind;
    opt.value = value;
    opt.label = val;
    opt.enabled = true;
    opt.sortOrder = 0;
    try {
      await this.optionRepo.save(opt);
    } catch {
      // ignore duplicate errors
    }
  }

  private getModuleNameForPlatform(platform: string | null | undefined): string {
    const key = this.normalizePlatform(platform);
    switch (key) {
      case 'gettr-web':
        return 'gettr-web-lib';
      case 'gettr-android':
        return 'gettr-android-lib';
      case 'gettr-mobile-web':
        return 'gettr-mobile-web-lib';
      case 'gettr-ios':
        return 'gettr-ios-lib';
      default:
        return `${key}-lib`;
    }
  }

  async findAll(params?: {
    status?: UserScenarioStatus | 'all';
    submenu?: string | 'all';
    platform?: string | 'all';
    q?: string;
  }): Promise<UserScenarioSummaryDto[]> {
    const qb = this.caseRepo
      .createQueryBuilder('c')
      .leftJoin('c.steps', 's')
      .leftJoinAndSelect('c.suite', 'suite')
      .loadRelationCountAndMap('c.stepsCount', 'c.steps');

    if (params?.status && params.status !== 'all') {
      qb.andWhere('c.status = :status', { status: params.status });
    }
    if (params?.submenu && params.submenu !== 'all') {
      qb.andWhere('c.submenu = :submenu', { submenu: params.submenu });
    }
    if (params?.platform && params.platform !== 'all') {
      qb.andWhere('c.platform = :platform', {
        platform: this.normalizePlatform(params.platform),
      });
    }
    if (params?.q) {
      const q = `%${params.q.toLowerCase()}%`;
      qb.andWhere(
        '(lower(c.code) LIKE :q OR lower(c.csvId) LIKE :q OR lower(c.title) LIKE :q OR lower(c.feature) LIKE :q)',
        { q },
      );
    }

    qb.orderBy('c.code', 'ASC');

    const rows = await qb.getMany();
    return rows.map((c: any) => {
      const dto = new UserScenarioSummaryDto();
      dto.id = c.id;
      dto.code = c.code;
      dto.csvId = c.csvId ?? null;
      dto.title = c.title;
      dto.module = c.module ?? 'live-stream';
       // 平台字段用于前端筛选与展示
      dto.platform = c.platform ?? 'gettr-web';
      dto.feature = c.feature ?? null;
      dto.submenu = c.submenu ?? null;
      dto.priority = c.priority;
      dto.status = c.status;
      dto.hasSteps = (c as any).stepsCount && (c as any).stepsCount > 0;
      dto.hasCode = !!c.hasCode;
      dto.description = c.description ?? null;
      dto.acceptanceCriteria = c.acceptanceCriteria ?? null;
      dto.generatedFilePath = c.generatedFilePath ?? null;
      dto.suiteId = (c as any)?.suite?.id ?? null;
      dto.suiteName = (c as any)?.suite?.name ?? null;
      return dto;
    });
  }

  async findOneWithSteps(id: number): Promise<UserScenario> {
    const entity = await this.caseRepo.findOne({
      where: { id },
      relations: ['steps', 'suite'],
      order: { steps: { order: 'ASC' as any } },
    });
    if (!entity) {
      throw new NotFoundException(`UserScenario ${id} not found`);
    }
    return entity;
  }

  async listOptions(
    kind: 'module' | 'submenu' | 'priority',
  ): Promise<{ value: string; label: string }[]> {
    const rows = await this.optionRepo.find({
      where: { kind } as any,
      order: { sortOrder: 'ASC', value: 'ASC' } as any,
    });
    return rows
      .filter((r) => r.enabled)
      .map((r) => ({ value: r.value, label: r.label }));
  }

  async upsertSteps(
    caseId: number,
    dto: UpsertUserScenarioStepsDto,
  ): Promise<UserScenario> {
    const entity = await this.caseRepo.findOne({ where: { id: caseId } });
    if (!entity) {
      throw new NotFoundException(`UserScenario ${caseId} not found`);
    }

    const normalized: UserScenarioStepInputDto[] = (dto.steps || [])
      .map((s) => ({
        ...s,
        order:
          typeof s.order === 'number' && Number.isFinite(s.order)
            ? Math.max(1, Math.floor(s.order))
            : 1,
      }))
      .sort((a, b) => a.order - b.order);

    await this.stepRepo.delete({ scenario: { id: caseId } as any });

    const toSave: UserScenarioStep[] = normalized.map((s) => {
      const step = new UserScenarioStep();
      step.scenario = entity;
      step.order = s.order;
      step.action = s.action || '';
      step.data = s.data ?? null;
      step.expected = s.expected || '';
      step.binding = (s as any).binding ?? null;
      return step;
    });

    await this.stepRepo.save(toSave);

    // 如果之前是 draft 且现在有步骤，自动将状态推进到 in_progress
    if (toSave.length > 0 && entity.status === 'draft') {
      entity.status = 'in_progress';
      await this.caseRepo.save(entity);
    }

    return await this.findOneWithSteps(caseId);
  }

  private parseCsvLine(line: string): string[] {
    const out: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        out.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    out.push(current);
    return out.map((s) => s.trim().replace(/^"|"$/g, ''));
  }

  /**
   * 从 CSV 的「测试步骤 / 预期结果 / 前置条件」文本中构造结构化步骤。
   * - rawSteps / rawExpected 通常为「1. xxx；2. yyy」形式，会按分号/换行拆分。
   * - 不强制要求数量一致，按索引一一对应，多余的步骤或预期会单独生成。
   * - rawPrecond 会挂到第一个步骤的 data 字段，便于后续在系统中查看。
   */
  private buildStepsFromCsv(
    rawSteps: string,
    rawExpected?: string | null,
    rawPrecond?: string | null,
  ): { order: number; action: string; expected: string; data?: string | null }[] {
    const normalize = (v: string | null | undefined): string =>
      (v || '').replace(/\r/g, '').trim();

    const splitSegments = (v: string | null | undefined): string[] => {
      const norm = normalize(v);
      if (!norm) return [];
      return norm
        .split(/[\n；;]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((s) =>
          // 去掉前缀序号，例如 "1. xxx" / "1) xxx" / "1）xxx"
          s.replace(/^[0-9]+[.)）]\s*/, '').trim(),
        )
        .filter((s) => s.length > 0);
    };

    const actions = splitSegments(rawSteps);
    const expecteds = splitSegments(rawExpected);
    const maxLen = Math.max(actions.length, expecteds.length);
    if (maxLen === 0) {
      return [];
    }

    const out: {
      order: number;
      action: string;
      expected: string;
      data?: string | null;
    }[] = [];

    for (let i = 0; i < maxLen; i++) {
      const action = actions[i] || actions[0] || '';
      const expected = expecteds[i] || '';
      if (!action && !expected) continue;
      out.push({
        order: i + 1,
        action,
        expected: expected || '请在用例中补充本步骤的预期结果。',
        data:
          i === 0 && rawPrecond && normalize(rawPrecond).length > 0
            ? normalize(rawPrecond)
            : null,
      });
    }

    return out;
  }

  /**
   * 根据 CSV 内容替换指定用例的步骤。
   * - 仅在 CSV 中存在非空「测试步骤」时才会执行；
   * - 会先清空原有步骤，再用 CSV 中解析出的步骤覆盖；
   * - 对于没有测试步骤的用例，不做任何修改，便于在系统中手工维护。
   */
  private async syncStepsFromCsv(
    scenario: UserScenario,
    rawSteps: string,
    rawExpected?: string | null,
    rawPrecond?: string | null,
  ): Promise<void> {
    const steps = this.buildStepsFromCsv(rawSteps, rawExpected, rawPrecond);
    if (!steps.length) return;

    await this.stepRepo.delete({ scenario: { id: scenario.id } as any });

    const toSave: UserScenarioStep[] = steps.map((s) => {
      const step = new UserScenarioStep();
      step.scenario = scenario;
      step.order = s.order;
      step.action = s.action;
      step.expected = s.expected;
      step.data = s.data ?? null;
      step.binding = null;
      return step;
    });

    await this.stepRepo.save(toSave);

    if (scenario.status === 'draft') {
      scenario.status = 'in_progress';
      await this.caseRepo.save(scenario);
    }
  }

  /**
   * Sync live stream cases from a CSV file.
   * CSV header: 用例ID,模块ID,模块名称,平台,检查点描述
   */
  async syncFromCsv(csvPath?: string, platformHint?: string) {
    const effectivePath =
      csvPath ||
      process.env.LIVE_STREAM_CSV_PATH ||
      path.resolve(
        process.cwd(),
        '..',
        'gettr-wks',
        'livestream-user-case',
        'livestream-testcases.csv',
      );
    if (!fs.existsSync(effectivePath)) {
      throw new NotFoundException(`CSV file not found at ${effectivePath}`);
    }
    const raw = fs.readFileSync(effectivePath, 'utf8');
    const parsed = await this.syncFromCsvContent(raw, platformHint);
    return { ...parsed, path: effectivePath };
  }

  /**
   * Sync live stream cases from CSV content string.
   * 基础表头: 用例ID,模块ID,模块名称,平台,检查点描述
   * 可选列: UserStory/User Story/用户故事, AcceptanceCriteria/Acceptance Criteria/验收标准, 测试步骤, 前置条件, 预期结果
   */
  async syncFromCsvContent(raw: string, platformHint?: string) {
    const lines = raw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (lines.length <= 1) {
      const total = await this.caseRepo.count();
      return { created: 0, updated: 0, total };
    }

    const header = this.parseCsvLine(lines[0]);
    const idxCaseId = header.indexOf('用例ID');
    const idxModuleId = header.indexOf('模块ID');
    const idxModuleNameRaw = header.indexOf('模块名称');
    const idxModuleName =
      idxModuleNameRaw >= 0 ? idxModuleNameRaw : header.indexOf('模块');
    const idxPlatform = header.indexOf('平台');
    const idxDesc = header.indexOf('检查点描述');
    const idxUserStory = header.findIndex(
      (name) =>
        name === 'UserStory' ||
        name === 'User Story' ||
        name === '用户故事',
    );
    const idxAcceptance = header.findIndex(
      (name) =>
        name === 'AcceptanceCriteria' ||
        name === 'Acceptance Criteria' ||
        name === '验收标准',
    );
    const idxPrecond = header.findIndex(
      (name) =>
        name === '前置条件' ||
        name === '前提条件' ||
        name === 'Precondition' ||
        name === 'Preconditions',
    );
    const idxSteps = header.findIndex(
      (name) =>
        name === '测试步骤' ||
        name === 'TestSteps' ||
        name === 'Test Steps' ||
        name === 'Steps',
    );
    const idxExpected = header.findIndex(
      (name) =>
        name === '预期结果' ||
        name === 'ExpectedResult' ||
        name === 'Expected Result' ||
        name === 'Expected',
    );

    let created = 0;
    let updated = 0;
    const platformNorm = this.normalizePlatform(platformHint);

    for (let i = 1; i < lines.length; i++) {
      const cols = this.parseCsvLine(lines[i]);
      const caseCode = idxCaseId >= 0 ? cols[idxCaseId] || '' : '';
      const moduleId = idxModuleId >= 0 ? cols[idxModuleId] || '' : '';
      const moduleName = idxModuleName >= 0 ? cols[idxModuleName] || '' : '';
      const platform = idxPlatform >= 0 ? cols[idxPlatform] || '' : '';
      const rawDesc = idxDesc >= 0 ? cols[idxDesc] || '' : '';
      const rawStory = idxUserStory >= 0 ? cols[idxUserStory] || '' : '';
      const rawAcceptance = idxAcceptance >= 0 ? cols[idxAcceptance] || '' : '';
      const rawPrecond = idxPrecond >= 0 ? cols[idxPrecond] || '' : '';
      const rawSteps = idxSteps >= 0 ? cols[idxSteps] || '' : '';
      const rawExpected = idxExpected >= 0 ? cols[idxExpected] || '' : '';
      const desc =
        rawStory && rawDesc
          ? `${rawStory}\n\n${rawDesc}`
          : rawStory || rawDesc;
      const hasPrecond = !!rawPrecond && rawPrecond.trim().length > 0;
      const hasSteps = !!rawSteps && rawSteps.trim().length > 0;
      const descBlocks: string[] = [];
      if (desc && desc.trim().length > 0) {
        descBlocks.push(desc);
      }
      if (hasPrecond) {
        descBlocks.push(`【前置条件】\n${rawPrecond}`);
      }
      if (hasSteps) {
        descBlocks.push(`【测试步骤】\n${rawSteps}`);
      }
      const fullDesc = descBlocks.length > 0 ? descBlocks.join('\n\n') : null;
      const acceptanceText =
        (rawAcceptance && rawAcceptance.trim().length > 0
          ? rawAcceptance
          : rawExpected && rawExpected.trim().length > 0
          ? rawExpected
          : null) || null;
      const code = (caseCode || '').trim();
      if (!code) continue;

      const existing = await this.caseRepo.findOne({ where: { code } });
      if (!existing) {
        const entity = new UserScenario();
        entity.module = 'live-stream';
        entity.platform = platformNorm;
        entity.code = code;
        entity.csvId = moduleId || null;
        entity.title = desc || code;
        entity.feature = moduleName || null;
        entity.submenu = platform ? this.sanitizeName(platform.toLowerCase()) : null;
        entity.priority = 'P1';
        entity.status = 'draft';
        entity.description = fullDesc || null;
        entity.acceptanceCriteria = acceptanceText;
        entity.hasCode = false;
        await this.caseRepo.save(entity);
        if (hasSteps) {
          await this.syncStepsFromCsv(entity, rawSteps, rawExpected, rawPrecond);
        }
        await this.ensureOption('module', entity.module);
        await this.ensureOption('submenu', entity.submenu);
        await this.ensureOption('priority', entity.priority);
        created += 1;
      } else {
        const nextTitle = desc || code;
        const nextFeature = moduleName || null;
        const nextCsvId = moduleId || null;
        const nextSubmenu = platform
          ? this.sanitizeName(platform.toLowerCase())
          : null;
        const nextAcceptance = acceptanceText;
        const nextDesc = fullDesc || null;

        const changed =
          existing.csvId !== nextCsvId ||
          existing.title !== nextTitle ||
          existing.feature !== nextFeature ||
          existing.submenu !== nextSubmenu ||
          existing.description !== nextDesc ||
          existing.acceptanceCriteria !== nextAcceptance ||
          existing.platform !== platformNorm;
        if (changed) {
          existing.csvId = nextCsvId;
          existing.title = nextTitle;
          existing.feature = nextFeature;
          existing.submenu = nextSubmenu;
          existing.description = nextDesc;
          existing.acceptanceCriteria = nextAcceptance;
          existing.platform = platformNorm;
          await this.caseRepo.save(existing);
          updated += 1;
        }
        if (hasSteps) {
          await this.syncStepsFromCsv(existing, rawSteps, rawExpected, rawPrecond);
        }
      }
    }

    const total = await this.caseRepo.count();
    return { created, updated, total };
  }

  async listSuites(params?: { platform?: string | 'all' }) {
    const qb = this.suiteRepo
      .createQueryBuilder('suite')
      .leftJoinAndSelect('suite.cases', 'c');
    if (params?.platform && params.platform !== 'all') {
      qb.andWhere('suite.platform = :platform', {
        platform: this.normalizePlatform(params.platform),
      });
    }
    qb.orderBy('suite.name', 'ASC');
    const rows = await qb.getMany();
    return rows.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description ?? null,
      platform: s.platform,
      module: s.module,
      sharedPreSteps: this.parseSharedPreSteps(s.sharedPreStepsJson),
      caseIds: (s.cases || []).map((c) => c.id),
      caseCount: (s.cases || []).length,
    }));
  }

  async getSuiteDetail(id: number) {
    const suite = await this.suiteRepo.findOne({
      where: { id },
      relations: ['cases'],
    });
    if (!suite) {
      throw new NotFoundException(`Suite ${id} not found`);
    }
    return {
      id: suite.id,
      name: suite.name,
      description: suite.description ?? null,
      platform: suite.platform,
      module: suite.module,
      sharedPreSteps: this.parseSharedPreSteps(suite.sharedPreStepsJson),
      cases:
        (suite.cases || []).map((c) => ({
          id: c.id,
          code: c.code,
          title: c.title,
        })) || [],
      caseCount: (suite.cases || []).length,
    };
  }

  async createSuite(dto: {
    name: string;
    description?: string | null;
    platform?: string | null;
    module?: string | null;
    sharedPreSteps?: string[];
  }) {
    const suite = new UserScenarioSuite();
    suite.name = (dto.name || 'Suite').toString().trim() || 'Suite';
    suite.description = dto.description || null;
    suite.platform = this.normalizePlatform(dto.platform);
    suite.module = this.normalizeModule(dto.module);
    suite.sharedPreStepsJson = this.serializeSharedPreSteps(dto.sharedPreSteps);
    await this.suiteRepo.save(suite);
    return await this.getSuiteDetail(suite.id);
  }

  async updateSuite(
    id: number,
    dto: {
      name?: string;
      description?: string | null;
      platform?: string | null;
      module?: string | null;
      sharedPreSteps?: string[] | null;
    },
  ) {
    const suite = await this.suiteRepo.findOne({ where: { id } });
    if (!suite) {
      throw new NotFoundException(`Suite ${id} not found`);
    }
    if (dto.name !== undefined) {
      suite.name = (dto.name || 'Suite').toString().trim() || 'Suite';
    }
    if (dto.description !== undefined) {
      suite.description = dto.description || null;
    }
    if (dto.platform !== undefined) {
      suite.platform = this.normalizePlatform(dto.platform);
    }
    if (dto.module !== undefined) {
      suite.module = this.normalizeModule(dto.module);
    }
    if (dto.sharedPreSteps !== undefined) {
      suite.sharedPreStepsJson = this.serializeSharedPreSteps(dto.sharedPreSteps);
    }
    await this.suiteRepo.save(suite);
    return await this.getSuiteDetail(id);
  }

  async createCase(dto: CreateUserScenarioDto): Promise<UserScenario> {
    const code = (dto.code || '').toString().trim();
    if (!code) {
      throw new NotFoundException('code is required');
    }
    const existing = await this.caseRepo.findOne({ where: { code } });
    if (existing) {
      throw new NotFoundException(`UserScenario with code ${code} already exists`);
    }
    const entity = new UserScenario();
    entity.module = (dto.module as any) || 'live-stream';
    entity.code = code;
    entity.platform = this.normalizePlatform(dto.platform);
    entity.title = (dto.title || code).toString();
    entity.feature = dto.feature || null;
    entity.submenu = dto.submenu
      ? this.sanitizeName(dto.submenu.toLowerCase())
      : null;
    entity.priority = (dto.priority as any) || 'P1';
    entity.status = dto.status || 'draft';
    entity.description = dto.description || null;
    entity.acceptanceCriteria = dto.acceptanceCriteria || null;
    entity.hasCode = false;
    await this.caseRepo.save(entity);
    return entity;
  }

  /**
   * Sync high-level user stories from a dedicated CSV file.
   * Expected header (order can vary): #,Phase,Priority,Persona,User Story,Acceptance Criteria,...
   */
  async syncFromUserStoriesCsvContent(raw: string, platformHint?: string) {
    const physical = raw.split(/\r?\n/);
    const logical: string[] = [];
    let buffer = '';
    let inQuotes = false;

    for (let idx = 0; idx < physical.length; idx++) {
      let line = physical[idx] ?? '';
      // strip BOM only on first physical line
      if (idx === 0) line = line.replace(/^\uFEFF/, '');
      const trimmed = line.replace(/\r$/, '');
      if (!inQuotes && trimmed.trim().length === 0) {
        continue;
      }
      buffer = buffer ? `${buffer}\n${trimmed}` : trimmed;
      // walk chars to track quote state (handle escaped "")
      for (let i = 0; i < trimmed.length; i++) {
        const ch = trimmed[i];
        if (ch === '"') {
          if (inQuotes && trimmed[i + 1] === '"') {
            // escaped quote, skip next
            i++;
            continue;
          }
          inQuotes = !inQuotes;
        }
      }
      if (!inQuotes) {
        const ready = buffer.trim();
        if (ready.length > 0) logical.push(ready);
        buffer = '';
      }
    }
    if (buffer.trim().length > 0) {
      logical.push(buffer.trim());
    }

    if (logical.length <= 1) {
      const total = await this.caseRepo.count();
      return { created: 0, updated: 0, total };
    }

    const header = this.parseCsvLine(logical[0]);
    const idxNo = header.findIndex((name) => name === '#' || /^ID$/i.test(name));
    const idxPhase = header.indexOf('Phase');
    const idxPriority = header.indexOf('Priority');
    const idxPersona = header.indexOf('Persona');
    const idxUserStory = header.findIndex(
      (name) => name === 'User Story' || name === 'UserStory',
    );
    const idxAcceptance = header.findIndex(
      (name) =>
        name === 'Acceptance Criteria' ||
        name === 'AcceptanceCriteria' ||
        name === '验收标准',
    );

    if (idxUserStory < 0) {
      throw new NotFoundException(
        'User Story column is required in userstories.csv',
      );
    }

    let created = 0;
    let updated = 0;
    const platformNorm = this.normalizePlatform(platformHint);

    for (let i = 1; i < logical.length; i++) {
      const cols = this.parseCsvLine(logical[i]);
      const noRaw = idxNo >= 0 ? cols[idxNo] || '' : '';
      const phaseRaw = idxPhase >= 0 ? cols[idxPhase] || '' : '';
      const priorityRaw = idxPriority >= 0 ? cols[idxPriority] || '' : '';
      const personaRaw = idxPersona >= 0 ? cols[idxPersona] || '' : '';
      const userStoryRaw = idxUserStory >= 0 ? cols[idxUserStory] || '' : '';
      const acceptanceRaw = idxAcceptance >= 0 ? cols[idxAcceptance] || '' : '';

      const userStory = (userStoryRaw || '').trim();
      if (!userStory) continue;

      const phase = (phaseRaw || '').toString().trim();
      const no = (noRaw || '').toString().trim() || String(i);
      const personaKey =
        personaRaw && personaRaw.trim()
          ? this.sanitizeName(personaRaw.toLowerCase())
          : null;
      const rawCodeParts = ['US'];
      if (phase) rawCodeParts.push(phase);
      if (personaKey) rawCodeParts.push(personaKey);
      rawCodeParts.push(no);
      const rawCode = rawCodeParts.join('-');
      const code = this.sanitizeName(rawCode);

      const csvId = phase ? `${phase}-${no}` : no;
      const feature = phase ? `Phase ${phase}` : null;
      const submenu = personaKey;
      const priority: 'P0' | 'P1' | 'P2' =
        priorityRaw === 'P0' || priorityRaw === 'P2'
          ? (priorityRaw as any)
          : 'P1';

      const existing = await this.caseRepo.findOne({ where: { code } });
      if (!existing) {
        const entity = new UserScenario();
        entity.module = 'live-stream';
        entity.platform = platformNorm;
        entity.code = code;
        entity.csvId = csvId || null;
        entity.title = userStory || code;
        entity.feature = feature;
        entity.submenu = submenu;
        entity.priority = priority;
        entity.status = 'draft';
        entity.description = userStory || null;
        entity.acceptanceCriteria = acceptanceRaw || null;
        entity.hasCode = false;
        await this.caseRepo.save(entity);
        await this.ensureOption('module', entity.module);
        await this.ensureOption('submenu', entity.submenu);
        await this.ensureOption('priority', entity.priority);
        created += 1;
      } else {
        let changed = false;
        const nextTitle = userStory || code;
        const nextFeature = feature;
        const nextCsvId = csvId || null;
        const nextSubmenu = submenu;
        const nextPriority = priority;
        const nextDesc = userStory || null;
        const nextAcceptance = acceptanceRaw || null;

        if (existing.csvId !== nextCsvId) {
          existing.csvId = nextCsvId;
          changed = true;
        }
        if (existing.title !== nextTitle) {
          existing.title = nextTitle;
          changed = true;
        }
        if (existing.feature !== nextFeature) {
          existing.feature = nextFeature;
          changed = true;
        }
        if (existing.submenu !== nextSubmenu) {
          existing.submenu = nextSubmenu;
          changed = true;
        }
        if (existing.priority !== nextPriority) {
          existing.priority = nextPriority;
          changed = true;
        }
        if (existing.description !== nextDesc) {
          existing.description = nextDesc;
          changed = true;
        }
        if (existing.acceptanceCriteria !== nextAcceptance) {
          existing.acceptanceCriteria = nextAcceptance;
          changed = true;
        }
        if (existing.platform !== platformNorm) {
          existing.platform = platformNorm;
          changed = true;
        }
        if (changed) {
          await this.caseRepo.save(existing);
          updated += 1;
        }
      }
    }

    const total = await this.caseRepo.count();
    return { created, updated, total };
  }

  async generateCodeForCase(
    id: number,
    username: string,
    envTemplateId?: number | null,
  ) {
    const entity = await this.caseRepo.findOne({
      where: { id },
      relations: ['steps'],
      order: { steps: { order: 'ASC' as any } },
    });
    if (!entity) {
      throw new NotFoundException(`UserScenario ${id} not found`);
    }

    const safeUser = this.sanitizeName(username || 'default');
    const platform = this.normalizePlatform(entity.platform);
    const isApiPlatform = platform.includes('-api-');
    const moduleName = this.sanitizeName(entity.module || 'live-stream');
    // 目录结构：workspace/users/<user>/cases/<platform>/<module>/<submenu>/<code>.ts
    const root = path.resolve(
      process.cwd(),
      'workspace',
      'users',
      safeUser,
      'cases',
      platform,
      moduleName,
    );
    const submenu = entity.submenu || 'general';
    const safeSubmenu = this.sanitizeName(submenu);
    const dir = path.join(root, safeSubmenu);
    await fs.promises.mkdir(dir, { recursive: true });

    const safeCode = this.sanitizeName(entity.code || `case-${id}`);
    const filePath = path.join(dir, `${safeCode}.ts`);
    const relPath = path.relative(process.cwd(), filePath);

    const lines: string[] = [
      '// Auto-generated live stream user case',
      `// Code: ${entity.code}`,
      entity.feature ? `// Feature: ${entity.feature}` : '',
      entity.csvId ? `// CSV ID: ${entity.csvId}` : '',
      `// Generated at: ${new Date().toISOString()}`,
      '',
    ].filter(Boolean) as string[];

    if (entity.description) {
      lines.push('// Description:');
      const descLines = String(entity.description)
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      for (const ln of descLines) {
        lines.push(`//   ${ln}`);
      }
      lines.push('');
    }

    if (entity.acceptanceCriteria) {
      lines.push('// Acceptance Criteria:');
      const acLines = String(entity.acceptanceCriteria)
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      for (const ln of acLines) {
        lines.push(`//   ${ln}`);
      }
      lines.push('');
    }

    // Detect structured bindings for current platform (web / android / others)
    const steps = entity.steps || [];
    type UsedPage = {
      className: string;
      varName: string;
      module?: string | null;
    };
    const usedPages = new Map<string, UsedPage>();
    const stepCallLines: string[] = [];
    const catalog = await this.actionCatalog.getCatalog(platform);
    const hasBindings = steps.some((s) => {
      if (!s.binding) return false;
      try {
        const parsed = JSON.parse(s.binding) as StepBindingV1;
        const resolved = this.actionCatalog.resolveBindingWithCatalog(
          catalog,
          parsed,
        );
        return !!resolved;
      } catch {
        return false;
      }
    });

    if (hasBindings) {
      for (const s of steps) {
        let binding: StepBindingV1 | null = null;
        if (s.binding) {
          try {
            binding = JSON.parse(s.binding) as StepBindingV1;
          } catch {
            binding = null;
          }
        }
        const resolved = binding
          ? this.actionCatalog.resolveBindingWithCatalog(catalog, binding)
          : null;
        if (!resolved) {
          // Fallback：对未绑定步骤保留注释
          stepCallLines.push(
            `    // Step ${s.order}: ${s.action.replace(/\r?\n/g, ' ')}`,
          );
          if (s.data) {
            stepCallLines.push(
              `    //   Data / Precondition: ${s.data.replace(
                /\r?\n/g,
                ' ',
              )}`,
            );
          }
          stepCallLines.push(
            `    //   Expected: ${s.expected.replace(/\r?\n/g, ' ')}`,
          );
          continue;
        }
        const { page, action } = resolved;
        const pageKey = page.key;
        if (!usedPages.has(pageKey)) {
          usedPages.set(pageKey, {
            className: page.className,
            varName: page.varName,
            module: (page as any).module ?? null,
          });
        }
        const args =
          (binding?.args || [])
            .map((a) => `${a.value}`)
            .filter((v) => v.length > 0) || [];
        const argsCode = args.map((v) => JSON.stringify(v)).join(', ');
        const call =
          argsCode.length > 0
            ? `    await ${page.varName}.${action.method}(${argsCode});`
            : `    await ${page.varName}.${action.method}();`;
        // 保留一行注释 + 一行真实调用，便于阅读
        stepCallLines.push(
          `    // Step ${s.order}: ${s.action.replace(/\r?\n/g, ' ')}`,
        );
        if (s.data) {
          stepCallLines.push(
            `    //   Data / Precondition: ${s.data.replace(/\r?\n/g, ' ')}`,
          );
        }
        stepCallLines.push(
          `    //   Expected: ${s.expected.replace(/\r?\n/g, ' ')}`,
        );
        stepCallLines.push(call);
        const rule: StepCheckRule | undefined =
          binding && typeof (binding as any).checkRule === 'object'
            ? ((binding as any).checkRule as StepCheckRule)
            : undefined;
        if (rule && rule.type) {
          const type = rule.type;
          if (type === 'element-visible' || type === 'element-hidden') {
            const fromRule = (rule.locator || '').toString().trim();
            const fromAction = (action as any).locator
              ? (action as any).locator.toString().trim()
              : '';
            const locator = fromRule || fromAction;
            if (locator) {
              const locatorLit = JSON.stringify(locator);
              const expectedText = (s.expected || '').toString().trim();
              const userMessage = expectedText
                ? expectedText.replace(/\r?\n/g, ' ')
                : '';
              const defaultMessage =
                type === 'element-visible'
                  ? `元素应出现：${locator}`
                  : `元素应消失：${locator}`;
              const description = userMessage || defaultMessage;
              stepCallLines.push('    {');
              stepCallLines.push(
                `      const driver: any = (tc as any).page;`,
              );
              stepCallLines.push(`      let el: any = null;`);
              stepCallLines.push('      try {');
              stepCallLines.push(
                `        el = driver && typeof driver.$ === 'function' ? await driver.$(${locatorLit}) : null;`,
              );
              stepCallLines.push('      } catch (e) {');
              stepCallLines.push('        el = null;');
              stepCallLines.push('      }');
              if (type === 'element-visible') {
                stepCallLines.push(
                  `      tc.assertNotNull(el, ${JSON.stringify(
                    description,
                  )});`,
                );
              } else {
                stepCallLines.push(
                  `      if (el) { throw new Error(${JSON.stringify(
                    description,
                  )} + '（实际仍然存在）'); }`,
                );
              }
              stepCallLines.push('    }');
            }
          } else if (
            type === 'url-contains' ||
            type === 'url-equals'
          ) {
            const expectedUrl = (rule.expectedUrl || '')
              .toString()
              .trim();
            if (expectedUrl) {
              const expectedLit = JSON.stringify(expectedUrl);
              const mode =
                type === 'url-contains' ? '包含' : '等于';
              stepCallLines.push('    {');
              stepCallLines.push(
                `      const driver: any = (tc as any).page;`,
              );
              stepCallLines.push(
                `      const url = driver && typeof driver.getUrl === 'function' ? await driver.getUrl() :`,
              );
              stepCallLines.push(
                `        driver && typeof driver.url === 'function' ? await driver.url() : '';`,
              );
              stepCallLines.push(
                type === 'url-contains'
                  ? `      const ok = typeof url === 'string' && url.includes(${expectedLit});`
                  : `      const ok = typeof url === 'string' && url === ${expectedLit};`,
              );
              stepCallLines.push(
                `      tc.assertEqual(true, ok, ${JSON.stringify(
                  `URL 检查：期望${mode} ${expectedUrl}`,
                )});`,
              );
              stepCallLines.push('    }');
            }
          }
        }
      }
    }

    // Imports
    const importCore = isApiPlatform
      ? "import { describe, it, expect, useTestCase } from 'core-lib';"
      : hasBindings
      ? "import { describe, it, useTestCase } from 'core-lib';"
      : "import { describe, it } from 'core-lib';";
    lines.push(importCore);
    if (hasBindings && usedPages.size > 0) {
      const byModule = new Map<string, Set<string>>();
      for (const { className, module } of usedPages.values()) {
        const mod =
          (module && module.trim()) || this.getModuleNameForPlatform(platform);
        if (!byModule.has(mod)) byModule.set(mod, new Set<string>());
        byModule.get(mod)!.add(className);
      }
      for (const [mod, classSet] of byModule.entries()) {
        const uniqueClassNames = Array.from(classSet.values());
        lines.push(
          `import { ${uniqueClassNames.join(', ')} } from '${mod}';`,
        );
      }
    }
    lines.push('');

    const describeTitlePrefix =
      platform === 'gettr-android'
        ? '[android]'
        : platform === 'gettr-mobile-web'
        ? '[mobile-web]'
        : `[${platform}]`;
    const describeTitle = `${describeTitlePrefix} ${entity.code} ${entity.title}`;
    lines.push(`describe(${JSON.stringify(describeTitle)}, () => {`);
    if (isApiPlatform) {
      // -------- API 平台（gettr-api-livestream）：使用 useTestCase 但不启动浏览器 / Android，会通过 fetch 调用后端 API --------
      lines.push(
        `  const tc = useTestCase({`,
        `    module: '${moduleName}',`,
        `    browser: false,`,
        `    android: false,`,
        `    tags: ['api', '${moduleName}'],`,
        `  });`,
        '',
        '  type ApiTestConfig = {',
        '    baseUrl: string;',
        '    defaultHeaders?: Record<string, string>;',
        '    sampleLivePostId?: string;',
        '  };',
        '',
        '  function getApiTestConfig(): ApiTestConfig {',
        '    const anyGlobal = globalThis as any;',
        '    const baseCfg = (anyGlobal?.params?.apiTestConfig ?? {}) as Partial<ApiTestConfig>;',
        '    const envCfgRaw = (anyGlobal?.params?.envConfig ?? null) as any;',
        '    const envCfg =',
        '      envCfgRaw && typeof envCfgRaw === "object"',
        '        ? (envCfgRaw as Partial<ApiTestConfig>)',
        '        : ({} as Partial<ApiTestConfig>);',
        '    const merged: Partial<ApiTestConfig> = { ...baseCfg, ...envCfg };',
        "    if (!merged.baseUrl) {",
        "      throw new Error('apiTestConfig.baseUrl is not configured. 请在 Settings → Parameters → API Tests 中配置。');",
        '    }',
        '    return merged as ApiTestConfig;',
        '  }',
        '',
        '  async function apiRequest(path: string, init: RequestInit = {}) {',
        '    const { baseUrl, defaultHeaders } = getApiTestConfig();',
        "    const url = `${baseUrl.replace(/\\/$/, '')}${path}`;",
        '    const headers: Record<string, string> = {',
        '      ...(defaultHeaders || {}),',
        "      ...(init.headers as Record<string, string> | undefined || {}),",
        '    };',
        '    const res = await fetch(url, { ...init, headers });',
        '    return res;',
        '  }',
        '',
        '  async function apiPost(path: string, body?: any, init: RequestInit = {}) {',
        "    const headers: Record<string, string> = { 'content-type': 'application/json', ...(init.headers as Record<string, string> | undefined || {}) };",
        "    return apiRequest(path, { ...init, method: 'POST', headers, body: body == null ? undefined : JSON.stringify(body) });",
        '  }',
        '',
        "  it('should satisfy all defined steps', async () => {",
      );
      const parseApiStepData = (raw: string | null | undefined) => {
        const result: { method: string; path: string; body: string } = {
          method: 'GET',
          path: '',
          body: '',
        };
        const text = (raw || '').toString();
        if (!text.trim()) return result;
        for (const part of text.split(',')) {
          const seg = part.trim();
          if (!seg) continue;
          const eqIdx = seg.indexOf('=');
          if (eqIdx <= 0) continue;
          const key = seg
            .slice(0, eqIdx)
            .trim()
            .toLowerCase();
          const value = seg.slice(eqIdx + 1).trim();
          if (key === 'method' && value) {
            result.method = value.toUpperCase();
          } else if (key === 'path') {
            result.path = value;
          } else if (key === 'body' || key === 'payload') {
            result.body = value;
          }
        }
        return result;
      };

      if (!entity.steps || entity.steps.length === 0) {
        lines.push(
          `    // TODO: 当前用例尚未从 CSV 或用例管理中定义具体步骤，请先在「用户场景」页面补充步骤。`,
          `    // 示例：`,
          `    // const res = await apiPost('/admin/live/start', { ... });`,
          `    // tc.assertEqual(200, res.status, '开播接口返回 200');`,
        );
      } else {
        lines.push(
          `    // 以下步骤由用例管理模块自动生成，已根据“数据”列中的 method/path/body 生成 API 调用骨架，请按需补充断言与请求体：`,
        );
        let apiStepIndex = 0;
        for (const s of entity.steps) {
          const actionText = (s.action || '').replace(/\r?\n/g, ' ');
          const expectedText = (s.expected || '').replace(/\r?\n/g, ' ');
          const dataText = (s.data || '').replace(/\r?\n/g, ' ');
          lines.push(`    // Step ${s.order}: ${actionText}`);
          if (dataText) {
            lines.push(`    //   Data / Precondition: ${dataText}`);
          }
          if (expectedText) {
            lines.push(`    //   Expected: ${expectedText}`);
          }

          const parsed = parseApiStepData(s.data as any);
          const method = (parsed.method || 'GET').toUpperCase();
          const pathValue = parsed.path;
          const bodyValue = parsed.body;

          if (!pathValue) {
            lines.push(
              `    // TODO: 本步骤尚未配置 path=...，请在「步骤与检查点」中补充 API 路径后，在此处实现调用。`,
              '',
            );
            continue;
          }

          apiStepIndex += 1;
          const resVar = `res${apiStepIndex}`;
          const methodLit = JSON.stringify(method);
          const pathLit = JSON.stringify(pathValue);

          if (method === 'GET' || method === 'DELETE') {
            lines.push(
              `    // AUTO-GEN: API 调用骨架（${method} ${pathValue}）`,
              `    const ${resVar} = await apiRequest(${pathLit}, { method: ${methodLit} });`,
              `    tc.assertEqual(200, ${resVar}.status, 'HTTP ${method} ${pathValue} 返回 200');`,
              `    // TODO: 根据上面的“Expected”补充对 ${resVar} JSON 的断言（errcode / 字段值等）。`,
              '',
            );
          } else if (method === 'POST') {
            if (bodyValue) {
              const bodyComment = bodyValue.replace(/\r?\n/g, ' ');
              lines.push(
                `    // AUTO-GEN: API 调用骨架（POST ${pathValue}）`,
                `    //   Body: ${bodyComment}`,
                `    const ${resVar} = await apiPost(${pathLit}); // TODO: 将上面的 Body 填入 apiPost 第二个参数`,
                `    tc.assertEqual(200, ${resVar}.status, 'HTTP POST ${pathValue} 返回 200');`,
                `    // TODO: 根据上面的“Expected”补充对 ${resVar} JSON 的断言（errcode / 字段值等）。`,
                '',
              );
            } else {
              lines.push(
                `    // AUTO-GEN: API 调用骨架（POST ${pathValue}）`,
                `    const ${resVar} = await apiPost(${pathLit}); // TODO: 传入请求 body（如有需要）`,
                `    tc.assertEqual(200, ${resVar}.status, 'HTTP POST ${pathValue} 返回 200');`,
                `    // TODO: 根据上面的“Expected”补充对 ${resVar} JSON 的断言（errcode / 字段值等）。`,
                '',
              );
            }
          } else {
            lines.push(
              `    // AUTO-GEN: API 调用骨架（${method} ${pathValue}）`,
              `    const ${resVar} = await apiRequest(${pathLit}, { method: ${methodLit} }); // TODO: 如有 Body，请补充 body 字段`,
              `    tc.assertEqual(200, ${resVar}.status, 'HTTP ${method} ${pathValue} 返回 200');`,
              `    // TODO: 根据上面的“Expected”补充对 ${resVar} JSON 的断言（errcode / 字段值等）。`,
              '',
            );
          }
        }
      }
      lines.push('  });');
    } else if (hasBindings) {
      let envConfigLines: string[] = [];
      if (envTemplateId && Number.isFinite(envTemplateId)) {
        const tpl = await this.envTemplateRepo.findOne({
          where: { id: envTemplateId as number },
        });
        if (tpl && tpl.enabled) {
          let parsed: any = {};
          try {
            parsed = JSON.parse(tpl.config || '{}');
          } catch {
            parsed = {};
          }
          const rawLines = JSON.stringify(parsed, null, 2).split('\n');
          let innerLines: string[];
          if (
            rawLines.length >= 2 &&
            rawLines[0].trim().startsWith('{') &&
            rawLines[rawLines.length - 1].trim().startsWith('}')
          ) {
            innerLines = rawLines.slice(1, -1);
          } else {
            innerLines = rawLines;
          }
          const json = innerLines.map((ln) => (ln ? `      ${ln}` : ln));
          lines.push(
            `  // Env template: ${tpl.name} (${tpl.key})`,
          );
          if (platform === 'gettr-android') {
            envConfigLines = [
              `  const tc = useTestCase({`,
              `    module: '${moduleName}',`,
              `    android: {`,
              ...json,
              `    },`,
              `    keepAppOpen: true,`,
              `    shareSession: true,`,
              `  });`,
              '',
            ];
          } else {
            envConfigLines = [
              `  const tc = useTestCase({`,
              `    module: '${moduleName}',`,
              `    browser: {`,
              ...json,
              `    },`,
              `  });`,
              '',
            ];
          }
        }
      }
      if (envConfigLines.length === 0) {
        if (platform === 'gettr-android') {
          envConfigLines = [
            `  const tc = useTestCase({`,
            `    module: '${moduleName}',`,
            `    android: {`,
            `      // TODO: 根据实际设备/环境配置以下参数：`,
            `      // deviceName: 'my-device',`,
            `      // udid: 'YOUR_DEVICE_UDID',`,
            `      // appPackage: 'com.gettr.gettr',`,
            `      // appActivity: '.MainActivity',`,
            `      // 或使用 apk 安装方式（示例）：`,
            `      // apk: '1.xx.x_xxx.apk',`,
            `    },`,
            `    keepAppOpen: true,`,
            `    shareSession: true,`,
            `  });`,
            '',
          ];
        } else {
          envConfigLines = [
            `  const tc = useTestCase({`,
            `    module: '${moduleName}',`,
            `    browser: {`,
            `      headless: false,`,
            `      debug: true,`,
            `      // TODO: 根据环境调整域名，例如：https://stg.gettr.com`,
            `      // domain: 'https://stg.gettr.com',`,
            `    },`,
            `  });`,
            '',
          ];
        }
      }
      lines.push(...envConfigLines);
      if (usedPages.size > 0) {
        for (const { className, varName } of usedPages.values()) {
          lines.push(
            `  const ${varName} = new ${className}(tc as any);`,
          );
        }
        lines.push('');
      }
      lines.push(
        `  it('should satisfy all defined steps', async () => {`,
      );
      if (stepCallLines.length === 0) {
        lines.push(
          `    // TODO: 当前用例尚未定义具体步骤，请在用例管理页面补充后再完善此处实现。`,
        );
      } else {
        const primaryLib = this.getModuleNameForPlatform(platform);
        lines.push(
          `    // 以下步骤由用例管理模块自动生成，对应 ${primaryLib} 中的页面与方法：`,
        );
        lines.push(...stepCallLines);
      }
      lines.push('  });');
    } else {
      lines.push(
        `  it('should satisfy all defined steps', async () => {`,
      );
      if (!entity.steps || entity.steps.length === 0) {
        lines.push(
          `    // TODO: 当前用例尚未定义具体步骤，请在用例管理页面补充后再完善此处实现。`,
        );
      } else {
        lines.push(
          `    // 以下步骤由用例管理模块自动生成，请根据需要替换为真实 App / API 操作：`,
        );
        for (const s of entity.steps) {
          lines.push(
            `    // Step ${s.order}: ${s.action.replace(/\r?\n/g, ' ')}`,
          );
          if (s.data) {
            lines.push(
              `    //   Data / Precondition: ${s.data.replace(
                /\r?\n/g,
                ' ',
              )}`,
            );
          }
          lines.push(
            `    //   Expected: ${s.expected.replace(/\r?\n/g, ' ')}`,
          );
        }
        lines.push('');
        lines.push(
          `    // 示例：`,
          `    // const app = await launchAppWithTestAccount(...);`,
          `    // await app.goLive();`,
          `    // await app.expectLiveBadgeVisible();`,
        );
      }
      lines.push('  });');
    }
    lines.push('});');
    lines.push('');

    await fs.promises.writeFile(filePath, lines.join('\n'), 'utf8');

    entity.hasCode = true;
    entity.generatedFilePath = relPath;
    entity.generatedAt = new Date();
    entity.status = 'code_generated';
    await this.caseRepo.save(entity);

    return { filePath: relPath };
  }

  async generateCodeForSuite(
    suiteId: number,
    username: string,
    envTemplateId?: number | null,
  ) {
    const suite = await this.suiteRepo.findOne({
      where: { id: suiteId },
      relations: ['cases', 'cases.steps'],
    });
    if (!suite) {
      throw new NotFoundException(`Suite ${suiteId} not found`);
    }
    const cases = (suite.cases || [])
      .slice()
      .sort((a, b) => a.code.localeCompare(b.code));
    if (!cases.length) {
      throw new NotFoundException(`Suite ${suite.name} 尚未包含任何用例`);
    }

    const platform = this.normalizePlatform(
      suite.platform || cases[0]?.platform || 'gettr-web',
    );
    const isApiPlatform = platform.includes('-api-');
    const moduleName = this.sanitizeName(
      suite.module || cases[0]?.module || 'live-stream',
    );
    const safeUser = this.sanitizeName(username || 'default');
    const root = path.resolve(
      process.cwd(),
      'workspace',
      'users',
      safeUser,
      'suites',
      platform,
      moduleName,
    );
    await fs.promises.mkdir(root, { recursive: true });

    const safeSuiteName = this.sanitizeName(suite.name || `suite-${suiteId}`);
    const filePath = path.join(root, `${safeSuiteName}.ts`);
    const relPath = path.relative(process.cwd(), filePath);

    const sharedPreSteps = this.parseSharedPreSteps(suite.sharedPreStepsJson);

    const lines: string[] = [
      '// Auto-generated live stream suite',
      `// Suite: ${suite.name}`,
      `// Generated at: ${new Date().toISOString()}`,
      '',
    ];

    const catalog = await this.actionCatalog.getCatalog(platform);
    type UsedPage = { className: string; varName: string; module?: string | null };
    const usedPages = new Map<string, UsedPage>();
    const stepLinesByCase = new Map<number, string[]>();
    let hasBindings = false;

    if (!isApiPlatform) {
      for (const sc of cases) {
        const steps = (sc.steps || []).slice().sort((a, b) => a.order - b.order);
        const stepLines: string[] = [];
        for (const s of steps) {
          let binding: StepBindingV1 | null = null;
          if (s.binding) {
            try {
              binding = JSON.parse(s.binding) as StepBindingV1;
            } catch {
              binding = null;
            }
          }
          const resolved = binding
            ? this.actionCatalog.resolveBindingWithCatalog(catalog, binding)
            : null;
          if (!resolved) {
            stepLines.push(
              `    // Step ${s.order}: ${s.action.replace(/\r?\n/g, ' ')}`,
            );
            if (s.data) {
              stepLines.push(
                `    //   Data / Precondition: ${s.data.replace(
                  /\r?\n/g,
                  ' ',
                )}`,
              );
            }
            stepLines.push(
              `    //   Expected: ${s.expected.replace(/\r?\n/g, ' ')}`,
            );
            continue;
          }
          hasBindings = true;
          const { page, action } = resolved;
          const pageKey = page.key;
          if (!usedPages.has(pageKey)) {
            usedPages.set(pageKey, {
              className: page.className,
              varName: page.varName,
              module: (page as any).module ?? null,
            });
          }
          const args =
            (binding?.args || [])
              .map((a) => `${a.value}`)
              .filter((v) => v.length > 0) || [];
          const argsCode = args.map((v) => JSON.stringify(v)).join(', ');
          const call =
            argsCode.length > 0
              ? `    await ${page.varName}.${action.method}(${argsCode});`
              : `    await ${page.varName}.${action.method}();`;
          stepLines.push(
            `    // Step ${s.order}: ${s.action.replace(/\r?\n/g, ' ')}`,
          );
          if (s.data) {
            stepLines.push(
              `    //   Data / Precondition: ${s.data.replace(
                /\r?\n/g,
                ' ',
              )}`,
            );
          }
          stepLines.push(
            `    //   Expected: ${s.expected.replace(/\r?\n/g, ' ')}`,
          );
          stepLines.push(call);
          const rule: StepCheckRule | undefined =
            binding && typeof (binding as any).checkRule === 'object'
              ? ((binding as any).checkRule as StepCheckRule)
              : undefined;
          if (rule && rule.type) {
            if (rule.type === 'element-visible' || rule.type === 'element-hidden') {
              const fromRule = (rule.locator || '').toString().trim();
              const fromAction = (action as any).locator
                ? (action as any).locator.toString().trim()
                : '';
              const locator = fromRule || fromAction;
              if (locator) {
                const locatorLit = JSON.stringify(locator);
                const expectedText = (s.expected || '').toString().trim();
                const userMessage = expectedText
                  ? expectedText.replace(/\r?\n/g, ' ')
                  : '';
                const defaultMessage =
                  rule.type === 'element-visible'
                    ? `元素应出现：${locator}`
                    : `元素应消失：${locator}`;
                const description = userMessage || defaultMessage;
                stepLines.push('    {');
                stepLines.push(`      const driver: any = (tc as any).page;`);
                stepLines.push(`      let el: any = null;`);
                stepLines.push('      try {');
                stepLines.push(
                  `        el = driver && typeof driver.$ === 'function' ? await driver.$(${locatorLit}) : null;`,
                );
                stepLines.push('      } catch (e) {');
                stepLines.push('        el = null;');
                stepLines.push('      }');
                if (rule.type === 'element-visible') {
                  stepLines.push(
                    `      tc.assertNotNull(el, ${JSON.stringify(description)});`,
                  );
                } else {
                  stepLines.push(
                    `      if (el) { throw new Error(${JSON.stringify(
                      description,
                    )} + '（实际仍然存在）'); }`,
                  );
                }
                stepLines.push('    }');
              }
            } else if (rule.type === 'url-contains' || rule.type === 'url-equals') {
              const expectedUrl = (rule.expectedUrl || '').toString().trim();
              if (expectedUrl) {
                const expectedLit = JSON.stringify(expectedUrl);
                const mode =
                  rule.type === 'url-contains' ? '包含' : '等于';
                stepLines.push('    {');
                stepLines.push(`      const driver: any = (tc as any).page;`);
                stepLines.push(
                  `      const url = driver && typeof driver.getUrl === 'function' ? await driver.getUrl() :`,
                );
                stepLines.push(
                  `        driver && typeof driver.url === 'function' ? await driver.url() : '';`,
                );
                stepLines.push(
                  rule.type === 'url-contains'
                    ? `      const ok = typeof url === 'string' && url.includes(${expectedLit});`
                    : `      const ok = typeof url === 'string' && url === ${expectedLit};`,
                );
                stepLines.push(
                  `      tc.assertEqual(true, ok, ${JSON.stringify(
                    `URL 检查：期望${mode} ${expectedUrl}`,
                  )});`,
                );
                stepLines.push('    }');
              }
            }
          }
        }
        stepLinesByCase.set(sc.id, stepLines);
      }
    }

    const importCore = isApiPlatform
      ? "import { describe, it, expect, useTestCase } from 'core-lib';"
      : "import { describe, it, useTestCase } from 'core-lib';";
    lines.push(importCore);
    if (!isApiPlatform && hasBindings && usedPages.size > 0) {
      const byModule = new Map<string, Set<string>>();
      for (const { className, module } of usedPages.values()) {
        const mod =
          (module && module.trim()) || this.getModuleNameForPlatform(platform);
        if (!byModule.has(mod)) byModule.set(mod, new Set<string>());
        byModule.get(mod)!.add(className);
      }
      for (const [mod, classSet] of byModule.entries()) {
        const uniqueClassNames = Array.from(classSet.values());
        lines.push(
          `import { ${uniqueClassNames.join(', ')} } from '${mod}';`,
        );
      }
    }
    lines.push('');

    const describeTitlePrefix =
      platform === 'gettr-android'
        ? '[android]'
        : platform === 'gettr-mobile-web'
        ? '[mobile-web]'
        : `[${platform}]`;
    const describeTitle = `${describeTitlePrefix} Suite: ${suite.name}`;
    lines.push(`describe(${JSON.stringify(describeTitle)}, () => {`);

    const envConfigLines: string[] = [];
    const tplLines: string[] = [];
    if (envTemplateId && Number.isFinite(envTemplateId)) {
      const tpl = await this.envTemplateRepo.findOne({
        where: { id: envTemplateId as number },
      });
      if (tpl && tpl.enabled) {
        let parsed: any = {};
        try {
          parsed = JSON.parse(tpl.config || '{}');
        } catch {
          parsed = {};
        }
        const rawLines = JSON.stringify(parsed, null, 2).split('\n');
        let innerLines: string[];
        if (
          rawLines.length >= 2 &&
          rawLines[0].trim().startsWith('{') &&
          rawLines[rawLines.length - 1].trim().startsWith('}')
        ) {
          innerLines = rawLines.slice(1, -1);
        } else {
          innerLines = rawLines;
        }
        const json = innerLines.map((ln) => (ln ? `      ${ln}` : ln));
        tplLines.push(`  // Env template: ${tpl.name} (${tpl.key})`);
        if (platform === 'gettr-android') {
          envConfigLines.push(
            `  const tc = useTestCase({`,
            `    module: '${moduleName}',`,
            `    android: {`,
            ...json,
            `    },`,
            `    keepAppOpen: true,`,
            `    shareSession: true,`,
            `  });`,
            '',
          );
        } else {
          envConfigLines.push(
            `  const tc = useTestCase({`,
            `    module: '${moduleName}',`,
            `    browser: {`,
            ...json,
            `    },`,
            `  });`,
            '',
          );
        }
      }
    }
    if (!envConfigLines.length) {
      if (platform === 'gettr-android') {
        envConfigLines.push(
          `  const tc = useTestCase({`,
          `    module: '${moduleName}',`,
          `    android: {`,
          `      // TODO: 根据实际设备/环境配置以下参数：`,
          `      // deviceName: 'my-device',`,
          `      // udid: 'YOUR_DEVICE_UDID',`,
          `      // appPackage: 'com.gettr.gettr',`,
          `      // appActivity: '.MainActivity',`,
          `    },`,
          `    keepAppOpen: true,`,
          `    shareSession: true,`,
          `  });`,
          '',
        );
      } else {
        envConfigLines.push(
          `  const tc = useTestCase({`,
          `    module: '${moduleName}',`,
          `    browser: {`,
          `      headless: false,`,
          `      debug: true,`,
          `    },`,
          `  });`,
          '',
        );
      }
    }
    lines.push(...tplLines);
    lines.push(...envConfigLines);

    if (!isApiPlatform && hasBindings && usedPages.size > 0) {
      for (const { className, varName } of usedPages.values()) {
        lines.push(`  const ${varName} = new ${className}(tc as any);`);
      }
      lines.push('');
    }

    lines.push(
      `  async function runSuitePreSteps() {`,
      `    // 套件级前置步骤（在「用户场景」页面的套件中维护，仅需实现一次即可复用）：`,
    );
    if (sharedPreSteps.length) {
      sharedPreSteps.forEach((txt, idx) => {
        lines.push(`    // ${idx + 1}. ${txt}`);
      });
    } else {
      lines.push(`    // （尚未填写，可在套件中补充前置步骤说明）`);
    }
    lines.push(
      `    // TODO: 根据上面的描述实现实际前置操作，避免在各个用例中重复维护。`,
      `  }`,
      '',
    );

    if (isApiPlatform) {
      lines.push(
        '  type ApiTestConfig = {',
        '    baseUrl: string;',
        '    defaultHeaders?: Record<string, string>;',
        '    sampleLivePostId?: string;',
        '  };',
        '',
        '  function getApiTestConfig(): ApiTestConfig {',
        '    const anyGlobal = globalThis as any;',
        '    const baseCfg = (anyGlobal?.params?.apiTestConfig ?? {}) as Partial<ApiTestConfig>;',
        '    const envCfgRaw = (anyGlobal?.params?.envConfig ?? null) as any;',
        '    const envCfg =',
        '      envCfgRaw && typeof envCfgRaw === "object"',
        '        ? (envCfgRaw as Partial<ApiTestConfig>)',
        '        : ({} as Partial<ApiTestConfig>);',
        '    const merged: Partial<ApiTestConfig> = { ...baseCfg, ...envCfg };',
        "    if (!merged.baseUrl) {",
        "      throw new Error('apiTestConfig.baseUrl is not configured. 请在 Settings → Parameters → API Tests 中配置。');",
        '    }',
        '    return merged as ApiTestConfig;',
        '  }',
        '',
        '  async function apiRequest(path: string, init: RequestInit = {}) {',
        '    const { baseUrl, defaultHeaders } = getApiTestConfig();',
        "    const url = `${baseUrl.replace(/\\/$/, '')}${path}`;",
        '    const headers: Record<string, string> = {',
        '      ...(defaultHeaders || {}),',
        "      ...(init.headers as Record<string, string> | undefined || {}),",
        '    };',
        '    const res = await fetch(url, { ...init, headers });',
        '    return res;',
        '  }',
        '',
        '  async function apiPost(path: string, body?: any, init: RequestInit = {}) {',
        "    const headers: Record<string, string> = { 'content-type': 'application/json', ...(init.headers as Record<string, string> | undefined || {}) };",
        "    return apiRequest(path, { ...init, method: 'POST', headers, body: body == null ? undefined : JSON.stringify(body) });",
        '  }',
        '',
      );
    }

    for (const sc of cases) {
      const steps = (sc.steps || []).slice().sort((a, b) => a.order - b.order);
      const caseTitle = `${sc.code} ${sc.title}`;
      lines.push(`  it(${JSON.stringify(caseTitle)}, async () => {`);
      lines.push('    await runSuitePreSteps();');
      if (isApiPlatform) {
        const parseApiStepData = (raw: string | null | undefined) => {
          const result: { method: string; path: string; body: string } = {
            method: 'GET',
            path: '',
            body: '',
          };
          const text = (raw || '').toString();
          if (text.trim()) {
            for (const part of text.split(',')) {
              const seg = part.trim();
              if (!seg) continue;
              const eqIdx = seg.indexOf('=');
              if (eqIdx <= 0) continue;
              const key = seg
                .slice(0, eqIdx)
                .trim()
                .toLowerCase();
              const value = seg.slice(eqIdx + 1).trim();
              if (key === 'method' && value) {
                result.method = value.toUpperCase();
              } else if (key === 'path') {
                result.path = value;
              } else if (key === 'body' || key === 'payload') {
                result.body = value;
              }
            }
          }
          return result;
        };

        if (!steps.length) {
          lines.push(
            `    // TODO: 当前用例尚未定义具体步骤，请先在用例管理页面补充。`,
          );
        } else {
          lines.push(
            `    // 以下步骤由用例管理模块生成，请根据“数据”列中的 method/path/body 补充 API 调用与断言：`,
          );
          let apiStepIndex = 0;
          for (const s of steps) {
            const actionText = (s.action || '').replace(/\r?\n/g, ' ');
            const expectedText = (s.expected || '').replace(/\r?\n/g, ' ');
            const dataText = (s.data || '').replace(/\r?\n/g, ' ');
            lines.push(`    // Step ${s.order}: ${actionText}`);
            if (dataText) {
              lines.push(`    //   Data / Precondition: ${dataText}`);
            }
            if (expectedText) {
              lines.push(`    //   Expected: ${expectedText}`);
            }

            const parsed = parseApiStepData(s.data as any);
            const method = (parsed.method || 'GET').toUpperCase();
            const pathValue = parsed.path;
            const bodyValue = parsed.body;

            if (!pathValue) {
              lines.push(
                `    // TODO: 本步骤尚未配置 path=...，请在「步骤与检查点」中补充 API 路径后，在此处实现调用。`,
                '',
              );
              continue;
            }

            apiStepIndex += 1;
            const resVar = `res${apiStepIndex}`;
            const methodLit = JSON.stringify(method);
            const pathLit = JSON.stringify(pathValue);

            if (method === 'GET' || method === 'DELETE') {
              lines.push(
                `    // AUTO-GEN: API 调用骨架（${method} ${pathValue}）`,
                `    const ${resVar} = await apiRequest(${pathLit}, { method: ${methodLit} });`,
                `    tc.assertEqual(200, ${resVar}.status, 'HTTP ${method} ${pathValue} 返回 200');`,
                `    // TODO: 根据上面的“Expected”补充对 ${resVar} JSON 的断言（errcode / 字段值等）。`,
                '',
              );
            } else if (method === 'POST') {
              if (bodyValue) {
                const bodyComment = bodyValue.replace(/\r?\n/g, ' ');
                lines.push(
                  `    // AUTO-GEN: API 调用骨架（POST ${pathValue}）`,
                  `    //   Body: ${bodyComment}`,
                  `    const ${resVar} = await apiPost(${pathLit}); // TODO: 将上面的 Body 填入 apiPost 第二个参数`,
                  `    tc.assertEqual(200, ${resVar}.status, 'HTTP POST ${pathValue} 返回 200');`,
                  `    // TODO: 根据上面的“Expected”补充对 ${resVar} JSON 的断言（errcode / 字段值等）。`,
                  '',
                );
              } else {
                lines.push(
                  `    // AUTO-GEN: API 调用骨架（POST ${pathValue}）`,
                  `    const ${resVar} = await apiPost(${pathLit}); // TODO: 传入请求 body（如有需要）`,
                  `    tc.assertEqual(200, ${resVar}.status, 'HTTP POST ${pathValue} 返回 200');`,
                  `    // TODO: 根据上面的“Expected”补充对 ${resVar} JSON 的断言（errcode / 字段值等）。`,
                  '',
                );
              }
            } else {
              lines.push(
                `    // AUTO-GEN: API 调用骨架（${method} ${pathValue}）`,
                `    const ${resVar} = await apiRequest(${pathLit}, { method: ${methodLit} }); // TODO: 如有 Body，请补充 body 字段`,
                `    tc.assertEqual(200, ${resVar}.status, 'HTTP ${method} ${pathValue} 返回 200');`,
                `    // TODO: 根据上面的“Expected”补充对 ${resVar} JSON 的断言（errcode / 字段值等）。`,
                '',
              );
            }
          }
        }
      } else {
        const stepLines = stepLinesByCase.get(sc.id) || [];
        if (!stepLines.length) {
          lines.push(
            `    // TODO: 当前用例尚未定义具体步骤，请在用例管理页面补充后完善此处实现。`,
          );
        } else {
          lines.push(
            `    // 以下步骤由用例管理模块自动生成，已复用套件级前置步骤：`,
          );
          lines.push(...stepLines);
        }
      }
      lines.push('  });');
      lines.push('');
    }

    lines.push('});');
    lines.push('');

    await fs.promises.writeFile(filePath, lines.join('\n'), 'utf8');

    // 标记套件内的用例已生成代码（指向同一个套件文件）
    for (const sc of cases) {
      sc.hasCode = true;
      sc.generatedFilePath = relPath;
      sc.generatedAt = new Date();
      sc.status = 'code_generated';
      await this.caseRepo.save(sc);
    }

    return { filePath: relPath };
  }

  async findByGeneratedFilePath(pathRaw: string): Promise<UserScenario | null> {
    const trimmed = (pathRaw || '').trim();
    if (!trimmed) return null;
    const scenario = await this.caseRepo.findOne({
      where: { generatedFilePath: trimmed } as any,
    });
    return scenario || null;
  }

  async updateCase(
    id: number,
    dto: UpdateUserScenarioDto,
  ): Promise<UserScenario> {
    const entity = await this.caseRepo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`UserScenario ${id} not found`);
    }
    if (dto.title !== undefined) {
      entity.title = dto.title;
    }
    if (dto.feature !== undefined) {
      entity.feature = dto.feature || null;
    }
    if (dto.module !== undefined) {
      entity.module = dto.module || 'live-stream';
    }
    if (dto.submenu !== undefined) {
      entity.submenu =
        dto.submenu && dto.submenu !== 'all'
          ? this.sanitizeName(dto.submenu)
          : null;
    }
    if (dto.platform !== undefined) {
      entity.platform = this.normalizePlatform(dto.platform);
    }
    if (dto.priority !== undefined) {
      entity.priority = dto.priority;
    }
    if (dto.status !== undefined) {
      entity.status = dto.status;
    }
    if (dto.description !== undefined) {
      entity.description = dto.description || null;
    }
    if (dto.suiteId !== undefined) {
      if (dto.suiteId === null) {
        entity.suite = null;
        entity.suiteId = null;
      } else {
        const suite = await this.suiteRepo.findOne({
          where: { id: dto.suiteId },
        });
        if (!suite) {
          throw new NotFoundException(`Suite ${dto.suiteId} not found`);
        }
        entity.suite = suite;
        entity.suiteId = suite.id;
      }
    }
    await this.caseRepo.save(entity);
    await this.ensureOption('module', entity.module);
    await this.ensureOption('submenu', entity.submenu);
    await this.ensureOption('priority', entity.priority);
    return entity;
  }

  async removeCase(id: number): Promise<void> {
    const entity = await this.caseRepo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`UserScenario ${id} not found`);
    }
    await this.caseRepo.remove(entity);
  }
}
