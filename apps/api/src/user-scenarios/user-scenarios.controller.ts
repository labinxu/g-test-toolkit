import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Delete,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserScenariosService } from './user-scenarios.service';
import { UpsertUserScenarioStepsDto } from './dto/upsert-steps.dto';
import { UserScenarioStatus } from './entities/user-scenario.entity';
import { FastifyRequest as Request } from 'fastify';
import { checkPath } from 'src/common/utils';
import { UpdateUserScenarioDto } from './dto/update-scenario.dto';
import { FileInterceptor } from '@nest-lab/fastify-multer';
import { File as FastifyMulterFile } from 'fastify-multer/lib/interfaces';
import { AiService } from '../ai/ai.service';
import { ActionCatalogService } from './action-catalog.service';
import { CreateUserScenarioDto } from './dto/create-scenario.dto';

@Controller('user-scenarios')
export class UserScenariosController {
  constructor(
    private readonly service: UserScenariosService,
    private readonly ai: AiService,
    private readonly catalog: ActionCatalogService,
  ) {}

  @Get('options')
  @UseGuards(AuthGuard('jwt'))
  async listOptions(@Query('kind') kind?: string) {
    const k = (kind || '').trim();
    if (!k) {
      throw new BadRequestException('kind is required');
    }
    if (k !== 'module' && k !== 'submenu' && k !== 'priority') {
      throw new BadRequestException('kind must be one of: module, submenu, priority');
    }
    const items = await this.service.listOptions(k as any);
    return { items };
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  async list(
    @Query('status') status?: UserScenarioStatus | 'all',
    @Query('submenu') submenu?: string | 'all',
    @Query('platform') platform?: string | 'all',
    @Query('q') q?: string,
  ) {
    try {
      return await this.service.findAll({
        status: (status as any) || 'all',
        submenu: (submenu as any) || 'all',
        platform: (platform as any) || 'all',
        q: q || undefined,
      });
    } catch (err) {
      throw new NotFoundException(
        (err && (err as Error).message) || 'Failed to list user scenarios',
      );
    }
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  async createCase(@Body() body: CreateUserScenarioDto) {
    try {
      return await this.service.createCase(body);
    } catch (err) {
      throw new NotFoundException(
        (err && (err as Error).message) || 'Failed to create user scenario',
      );
    }
  }

  @Get('action-catalog')
  @UseGuards(AuthGuard('jwt'))
  async getActionCatalog(@Query('platform') platform?: string) {
    const catalog = await this.catalog.getCatalog(platform || 'gettr-web');
    return {
      result: 'ok',
      catalog,
    };
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  async detail(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.service.findOneWithSteps(id);
    } catch (err) {
      throw new NotFoundException(
        (err && (err as Error).message) ||
          `Failed to fetch user scenario ${id}`,
      );
    }
  }

  @Post(':id/steps')
  @UseGuards(AuthGuard('jwt'))
  async upsertSteps(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpsertUserScenarioStepsDto,
  ) {
    try {
      return await this.service.upsertSteps(id, body);
    } catch (err) {
      throw new NotFoundException(
        (err && (err as Error).message) ||
          `Failed to update steps for user scenario ${id}`,
      );
    }
  }

  @Post('sync-from-csv')
  @UseGuards(AuthGuard('jwt'))
  async syncFromCsv(@Query('platform') platform?: string) {
    try {
      const result = await this.service.syncFromCsv(undefined, platform);
      return { result: 'ok', ...result };
    } catch (err) {
      throw new NotFoundException(
        (err && (err as Error).message) ||
          'Failed to sync user scenarios from CSV',
      );
    }
  }

  @Post('sync-from-csv-upload')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async syncFromCsvUpload(
    @UploadedFile() file: FastifyMulterFile,
    @Body() body: any,
  ) {
    if (!file || !file.buffer) {
      throw new NotFoundException('CSV file is required');
    }
    try {
      const raw = file.buffer.toString('utf8');
      const result = await this.service.syncFromCsvContent(
        raw,
        (body?.platform as string) || undefined,
      );
      return { result: 'ok', ...result };
    } catch (err) {
      throw new NotFoundException(
        (err && (err as Error).message) ||
          'Failed to sync user scenarios from uploaded CSV',
      );
    }
  }

  @Post('ingest-doc-upload')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async ingestDocUpload(
    @UploadedFile() file: FastifyMulterFile,
    @Body()
    body: {
      project?: string
      docType?: string
      moduleIdHint?: string
      moduleNameHint?: string
      sourceDoc?: string
      platform?: string
      aiHint?: string
    },
    @Req() req: Request,
  ) {
    if (!file || !file.buffer) {
      throw new NotFoundException('description file is required');
    }
    const rawText = file.buffer.toString('utf8');
    const project = body?.project || 'live-stream';
    const docType = body?.docType || 'livekit';
    const moduleIdHint = body?.moduleIdHint || undefined;
    const moduleNameHint = body?.moduleNameHint || undefined;
    const sourceDoc = body?.sourceDoc || 'livekit';
    const aiHint = body?.aiHint || undefined;
    const user: any = (req as any)?.user || {};
    const rawUserId = user?.id;
    const userId = Number(rawUserId);
    try {
      const firstLine =
        rawText
          .split(/\r?\n/)
          .map((s) => s.trim())
          .find((s) => s.length > 0) || '';
      const isUserStoriesCsv =
        firstLine.includes('User Story') && firstLine.includes('Acceptance Criteria');

      if (isUserStoriesCsv) {
        const parsed = await this.service.syncFromUserStoriesCsvContent(
          rawText,
          body?.platform,
        );
        return { result: 'ok', ...parsed };
      }

      const norm = await this.ai.normalizeUserScenarios({
        rawText,
        project,
        docType,
        moduleIdHint,
        moduleNameHint,
        sourceDoc,
        userId: Number.isFinite(userId) ? userId : undefined,
        aiHint,
      });
      const cases = (norm?.cases as any[]) || [];
      let created = 0;
      let updated = 0;
      for (const c of cases) {
        const code = (c.caseCode || '').toString().trim();
        if (!code) continue;
        const moduleId = c.moduleId || null;
        const moduleName = c.moduleName || null;
        const submenuRaw = c.submenu || null;
        const rawDescription = c.description || c.title || code;
        const rawUserStory = (c.userStory || '').toString().trim();
        const desc =
          rawUserStory && rawDescription
            ? `${rawUserStory}\n\n${rawDescription}`
            : rawUserStory || rawDescription;
        const acceptanceRaw = (c.acceptanceCriteria || '').toString().trim();
        const rawPrecond = (c.precondition || '').toString().trim();
        const rawSteps = (c.testSteps || '').toString().trim();
        const rawExpected = (c.expectedResult || '').toString().trim();
        const existing = await this.service['caseRepo'].findOne({
          where: { code },
        } as any);
        const submenu = submenuRaw
          ? this.service['sanitizeName']?.(String(submenuRaw).toLowerCase?.() || '') ??
            String(submenuRaw)
          : null;
        const platformNorm = this.service['normalizePlatform']?.(
          (body?.platform as string) || undefined,
        ) as string;
        if (!existing) {
          const entity = new (this.service as any).caseRepo.target();
          entity.module = project || 'live-stream';
          entity.platform = platformNorm;
          entity.code = code;
          entity.csvId = moduleId || null;
          entity.title = c.title || desc || code;
          entity.feature = moduleName || null;
          entity.submenu = submenu;
          entity.priority = 'P1';
          entity.status = 'draft';
          const descBlocks: string[] = [];
          if (desc && String(desc).trim().length > 0) {
            descBlocks.push(String(desc).trim());
          }
          if (rawPrecond) {
            descBlocks.push(`【前置条件】\n${rawPrecond}`);
          }
          if (rawSteps) {
            descBlocks.push(`【测试步骤】\n${rawSteps}`);
          }
          entity.description = descBlocks.length > 0 ? descBlocks.join('\n\n') : null;
          entity.hasCode = false;
          await (this.service as any).caseRepo.save(entity);
          if (rawSteps) {
            await (this.service as any).syncStepsFromCsv(
              entity,
              rawSteps,
              rawExpected || acceptanceRaw || '',
              rawPrecond || '',
            );
          }
          created += 1;
        } else {
          let changed = false;
          const nextTitle = c.title || desc || code;
          const nextFeature = moduleName || null;
          const nextAcceptance =
            acceptanceRaw || (existing.acceptanceCriteria as string | null) || null;
          if (existing.csvId !== (moduleId || null)) {
            existing.csvId = moduleId || null;
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
          if (existing.submenu !== submenu) {
            existing.submenu = submenu;
            changed = true;
          }
          const descBlocks: string[] = [];
          if (desc && String(desc).trim().length > 0) {
            descBlocks.push(String(desc).trim());
          }
          if (rawPrecond) {
            descBlocks.push(`【前置条件】\n${rawPrecond}`);
          }
          if (rawSteps) {
            descBlocks.push(`【测试步骤】\n${rawSteps}`);
          }
          const nextDesc = descBlocks.length > 0 ? descBlocks.join('\n\n') : null;
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
            await (this.service as any).caseRepo.save(existing);
            updated += 1;
          }
          if (rawSteps) {
            await (this.service as any).syncStepsFromCsv(
              existing,
              rawSteps,
              rawExpected || acceptanceRaw || '',
              rawPrecond || '',
            );
          }
        }
      }
      const total = await (this.service as any).caseRepo.count();
      return {
        result: 'ok',
        created,
        updated,
        total,
      };
    } catch (err) {
      throw new NotFoundException(
        (err && (err as Error).message) ||
          'Failed to ingest user scenarios from description file',
      );
    }
  }

  @Post(':id/generate-code')
  @UseGuards(AuthGuard('jwt'))
  async generateCode(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      envTemplateId?: number | null
    },
    @Req() req: Request,
  ) {
    try {
      const user = (req as any)?.user as any;
      const usernameRaw = user?.username || user?.['username'] || 'default';
      const username = checkPath(usernameRaw);
      const { filePath } = await this.service.generateCodeForCase(
        id,
        username,
        body?.envTemplateId,
      );
      return {
        result: 'ok',
        filePath,
        message: `Generated user scenario case file: ${filePath}`,
      };
    } catch (err) {
      throw new NotFoundException(
        (err && (err as Error).message) ||
          `Failed to generate code for user scenario ${id}`,
      );
    }
  }

  @Get('resolve-testcase')
  @UseGuards(AuthGuard('jwt'))
  async resolveTestcaseByPath(@Query('path') path: string) {
    const trimmed = (path || '').trim();
    if (!trimmed) {
      throw new BadRequestException('path is required');
    }
    try {
      const scenario = await this.service.findByGeneratedFilePath(trimmed);
      if (!scenario) {
        return { scenario: null };
      }
      return {
        scenario: {
          id: scenario.id,
          code: scenario.code,
          title: scenario.title,
          platform: scenario.platform,
          module: scenario.module,
          submenu: scenario.submenu,
          status: scenario.status,
        },
      };
    } catch (err) {
      throw new NotFoundException(
        (err && (err as Error).message) ||
          `Failed to resolve testcase for path ${trimmed}`,
      );
    }
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  async updateCase(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateUserScenarioDto,
  ) {
    try {
      return await this.service.updateCase(id, body);
    } catch (err) {
      throw new NotFoundException(
        (err && (err as Error).message) ||
          `Failed to update user scenario ${id}`,
      );
    }
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  async deleteCase(@Param('id', ParseIntPipe) id: number) {
    try {
      await this.service.removeCase(id);
      return { result: 'ok' };
    } catch (err) {
      throw new NotFoundException(
        (err && (err as Error).message) ||
          `Failed to delete user scenario ${id}`,
      );
    }
  }
}
