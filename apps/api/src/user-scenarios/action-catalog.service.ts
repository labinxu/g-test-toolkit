import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActionCatalog, ActionParamDef, PageActionDef, PageDef, StepBindingV1 } from './action-catalog';
import { ActionPage } from './entities/action-page.entity';
import { ActionPageAction } from './entities/action-page-action.entity';
import { ActionParam } from './entities/action-param.entity';

@Injectable()
export class ActionCatalogService {
  constructor(
    @InjectRepository(ActionPage)
    private readonly pageRepo: Repository<ActionPage>,
    @InjectRepository(ActionPageAction)
    private readonly actionRepo: Repository<ActionPageAction>,
    @InjectRepository(ActionParam)
    private readonly paramRepo: Repository<ActionParam>,
  ) {}

  private async loadCatalogFromDb(platform: string): Promise<ActionCatalog | null> {
    const pages = await this.pageRepo.find({
      where: { platform, enabled: true } as any,
      relations: ['actions', 'actions.params'],
      order: {
        sortOrder: 'ASC',
        id: 'ASC',
        actions: {
          sortOrder: 'ASC',
          id: 'ASC',
          params: {
            sortOrder: 'ASC',
            id: 'ASC',
          } as any,
        } as any,
      } as any,
    });
    if (!pages || pages.length === 0) return null;

    const mapParam = (p: ActionParam): ActionParamDef => ({
      name: p.name,
      type: p.type || undefined,
      required: !!p.required,
      placeholder: p.placeholder || undefined,
    });

    const mapAction = (a: ActionPageAction): PageActionDef => {
      const rawKind = (a.kind as any) || 'action';
      const kind: 'action' | 'assert' | 'call' =
        rawKind === 'assert' ? 'assert' : rawKind === 'call' ? 'call' : 'action';
      const actionType: 'click' | 'input' | 'drag' | undefined =
        kind === 'action'
          ? (a.actionType as any) === 'input'
            ? 'input'
            : (a.actionType as any) === 'drag'
              ? 'drag'
              : 'click'
          : undefined;
      const callSteps = (() => {
        const raw = (a as any).callStepsJson as string | null | undefined;
        if (!raw) return undefined;
        try {
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed)) return undefined;
          const steps = parsed
            .map((s: any, idx: number) => {
              const targetActionKey = String(s?.targetActionKey || '').trim();
              if (!targetActionKey) return null;
              const args = Array.isArray(s?.args)
                ? s.args.map((v: any) => String(v))
                : [];
              const soRaw = Number(s?.sortOrder);
              const sortOrder = Number.isFinite(soRaw) ? Math.floor(soRaw) : idx;
              return { targetActionKey, args, sortOrder };
            })
            .filter(Boolean) as { targetActionKey: string; args: string[]; sortOrder: number }[];
          return steps.length > 0 ? steps : undefined;
        } catch {
          return undefined;
        }
      })();
      return {
        key: a.key,
        label: a.label,
        method: a.method,
        kind,
        actionType,
        callSteps,
        defaultExpected: a.defaultExpected || undefined,
        locator: a.locator || undefined,
        returnTarget: a.returnTarget || undefined,
        params: (a.params || []).sort((x, y) => x.sortOrder - y.sortOrder).map(mapParam),
      };
    };

    const mapPage = (p: ActionPage): PageDef => ({
      key: p.key,
      label: p.label,
      module: p.module,
      className: p.className,
      varName: p.varName,
      actions: (p.actions || [])
        .filter((a) => a.enabled)
        .sort((x, y) => x.sortOrder - y.sortOrder)
        .map(mapAction),
    });

    const out: ActionCatalog = {
      platform,
      pages: pages.map(mapPage),
    };
    return out;
  }

  async getCatalog(platformRaw?: string): Promise<ActionCatalog> {
    const platform = (platformRaw || 'gettr-web').toLowerCase();
    const fromDb = await this.loadCatalogFromDb(platform);
    if (fromDb) return fromDb;
    // 若数据库没有记录，则返回空，不再从 shared-libs 或默认常量回退
    return { platform, pages: [] };
  }

  resolveBindingWithCatalog(
    catalog: ActionCatalog,
    binding: StepBindingV1 | null | undefined,
  ): { page: PageDef; action: PageActionDef } | null {
    if (!binding) return null;
    const platform = (binding.platform || catalog.platform || '').toLowerCase();
    if (platform !== (catalog.platform || '').toLowerCase()) return null;
    const ver = (binding as any).ver ?? 1;
    if (ver !== 1) return null;
    const page = catalog.pages.find((p) => p.key === binding.pageKey);
    if (!page) return null;
    const action = page.actions.find((a) => a.key === binding.actionKey);
    if (!action) return null;
    return { page, action };
  }
}
