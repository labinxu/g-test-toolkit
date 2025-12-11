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
import { ActionCatalogService } from './action-catalog.service';
import { UserScenarioOption } from './entities/user-scenario-option.entity';
import { EnvTemplate } from './entities/env-template.entity';
import {
  getModuleNameForPlatform,
  normalizeModule,
  normalizePlatform,
  parseSharedPreSteps,
  sanitizeName,
  serializeSharedPreSteps,
} from './utils/normalize';
import { UserScenarioCodeGenerator } from './codegen/code-generator';

@Injectable()
export class UserScenariosService {
  private readonly codeGenerator: UserScenarioCodeGenerator;

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
  ) {
    this.codeGenerator = new UserScenarioCodeGenerator(
      this.caseRepo,
      this.suiteRepo,
      this.envTemplateRepo,
      this.actionCatalog,
    );
  }

  private async ensureOption(
    kind: 'module' | 'submenu' | 'priority',
    rawValue?: string | null,
  ): Promise<void> {
    const val = (rawValue || '').toString().trim();
    if (!val) return;
    let value: string;
    if (kind === 'module') {
      value = normalizeModule(val);
    } else if (kind === 'priority') {
      // 优先级直接使用 P0/P1/P2 小写化
      value = val.toUpperCase();
    } else {
      // submenu：保留现有 sanitize 规则
      value = sanitizeName(val.toLowerCase());
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

  private getModuleNameForPlatform(
    platform: string | null | undefined,
  ): string {
    return getModuleNameForPlatform(platform);
  }

  private normalizePlatform(platform: string | null | undefined) {
    return normalizePlatform(platform);
  }

  private sanitizeName(value: string | null | undefined) {
    return sanitizeName(value);
  }

  private parseSharedPreSteps(raw?: string | null) {
    return parseSharedPreSteps(raw);
  }

  private serializeSharedPreSteps(steps?: string[] | null) {
    return serializeSharedPreSteps(steps);
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
        platform: normalizePlatform(params.platform),
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
  ): {
    order: number;
    action: string;
    expected: string;
    data?: string | null;
  }[] {
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
        name === 'UserStory' || name === 'User Story' || name === '用户故事',
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
    const platformNorm = normalizePlatform(platformHint);

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
        rawStory && rawDesc ? `${rawStory}\n\n${rawDesc}` : rawStory || rawDesc;
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
        entity.submenu = platform
          ? sanitizeName(platform.toLowerCase())
          : null;
        entity.priority = 'P1';
        entity.status = 'draft';
        entity.description = fullDesc || null;
        entity.acceptanceCriteria = acceptanceText;
        entity.hasCode = false;
        await this.caseRepo.save(entity);
        if (hasSteps) {
          await this.syncStepsFromCsv(
            entity,
            rawSteps,
            rawExpected,
            rawPrecond,
          );
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
          ? sanitizeName(platform.toLowerCase())
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
          await this.syncStepsFromCsv(
            existing,
            rawSteps,
            rawExpected,
            rawPrecond,
        );
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
        platform: normalizePlatform(params.platform),
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
    suite.platform = normalizePlatform(dto.platform);
    suite.module = normalizeModule(dto.module);
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
      suite.platform = normalizePlatform(dto.platform);
    }
    if (dto.module !== undefined) {
      suite.module = normalizeModule(dto.module);
    }
    if (dto.sharedPreSteps !== undefined) {
      suite.sharedPreStepsJson = this.serializeSharedPreSteps(
        dto.sharedPreSteps,
      );
    }
    await this.suiteRepo.save(suite);
    return await this.getSuiteDetail(id);
  }

  async deleteSuite(id: number) {
    const suite = await this.suiteRepo.findOne({ where: { id } });
    if (!suite) {
      throw new NotFoundException(`Suite ${id} not found`);
    }
    // 将已关联用例解除套件关系
    await this.caseRepo.update(
      { suite: { id } as any },
      { suite: null, suiteId: null },
    );
    await this.suiteRepo.delete(id);
    return { result: 'ok' };
  }

  async createCase(dto: CreateUserScenarioDto): Promise<UserScenario> {
    const code = (dto.code || '').toString().trim();
    if (!code) {
      throw new NotFoundException('code is required');
    }
    const existing = await this.caseRepo.findOne({ where: { code } });
    if (existing) {
      throw new NotFoundException(
        `UserScenario with code ${code} already exists`,
      );
    }
    const entity = new UserScenario();
    entity.module = (dto.module as any) || 'live-stream';
    entity.code = code;
    entity.platform = normalizePlatform(dto.platform);
    entity.title = (dto.title || code).toString();
    entity.feature = dto.feature || null;
    entity.submenu = dto.submenu
      ? sanitizeName(dto.submenu.toLowerCase())
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
    const idxNo = header.findIndex(
      (name) => name === '#' || /^ID$/i.test(name),
    );
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
    const platformNorm = normalizePlatform(platformHint);

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
          ? sanitizeName(personaRaw.toLowerCase())
          : null;
      const rawCodeParts = ['US'];
      if (phase) rawCodeParts.push(phase);
      if (personaKey) rawCodeParts.push(personaKey);
      rawCodeParts.push(no);
      const rawCode = rawCodeParts.join('-');
      const code = sanitizeName(rawCode);

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
    return this.codeGenerator.generateCodeForCase(id, username, envTemplateId);
  }

  async generateCodeForSuite(
    suiteId: number,
    username: string,
    envTemplateId?: number | null,
  ) {
    return this.codeGenerator.generateCodeForSuite(
      suiteId,
      username,
      envTemplateId,
    );
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
