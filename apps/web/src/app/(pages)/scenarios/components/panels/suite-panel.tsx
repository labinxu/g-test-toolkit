'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { OptionsSelectSearch } from '@/components/select/options-select-search';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { ScenarioStepsTable } from '../shared/steps-table';
import { SuiteCasesTable } from './suite-cases-table';
import type { UserScenarioStep, UserScenarioSummary } from '../../types';

type SuiteSummary = {
  id: number;
  name: string;
  description?: string | null;
  caseCount?: number;
  sharedPreSteps?: string[];
};

type SuiteActorDraft = {
  name: string;
  scope: 'suite' | 'test';
  authMode: 'ui' | 'cookies';
  cookiesPath: string;
};

type SuitePanelProps = {
  suites: SuiteSummary[];
  selectedSuiteId: number | null;
  suiteCases: Pick<UserScenarioSummary, 'id' | 'code' | 'title'>[];
  allCases: Pick<UserScenarioSummary, 'id' | 'code' | 'title'>[];
  selectedCaseId?: number | null;
  removingSuiteCaseId?: number | null;
  addingSuiteCases?: boolean;
  suiteLoading: boolean;
  suiteGenerating: boolean;
  suiteSaving?: boolean;
  suiteDeleting?: boolean;
  suiteDescDraft: string;
  suitePreSteps: string[];
  suitePreStepDraft: string;
  suiteActorsDraft: SuiteActorDraft[];
  suiteDefaultActorDraft: string;
  onSuiteDescChange: (val: string) => void;
  onSuitePreStepsChange: (steps: string[]) => void;
  onSuitePreStepDraftChange: (val: string) => void;
  onSuiteActorsDraftChange: (actors: SuiteActorDraft[]) => void;
  onSuiteDefaultActorDraftChange: (val: string) => void;
  onAssignSuite: (suiteId: number | null) => void;
  onEditSuiteCase: (caseId: number) => void;
  onRemoveSuiteCase: (caseId: number) => void;
  onAddSuiteCases: (suiteId: number, caseIds: number[]) => Promise<boolean> | boolean;
  onEditSuiteStep: (id: string) => void;
  onSaveSuitePreSteps: () => void;
  onDeleteSuite: () => void;
  onOpenCreateSuite: () => void;
  onGenerateSuiteCode: () => void;
  onOpenSuiteStepDialog: () => void;
};

export function SuitePanel({
  suites,
  selectedSuiteId,
  suiteCases,
  allCases,
  selectedCaseId,
  removingSuiteCaseId,
  addingSuiteCases,
  suiteLoading,
  suiteGenerating,
  suiteDescDraft,
  suitePreSteps,
  suitePreStepDraft,
  suiteActorsDraft,
  suiteDefaultActorDraft,
  onSuiteDescChange,
  onSuitePreStepsChange,
  onSuitePreStepDraftChange,
  onSuiteActorsDraftChange,
  onSuiteDefaultActorDraftChange,
  onAssignSuite,
  onEditSuiteCase,
  onRemoveSuiteCase,
  onAddSuiteCases,
  onEditSuiteStep,
  onSaveSuitePreSteps,
  onDeleteSuite,
  onOpenCreateSuite,
  onGenerateSuiteCode,
  onOpenSuiteStepDialog,
  suiteSaving = false,
  suiteDeleting = false,
}: SuitePanelProps) {
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const v = localStorage.getItem('gtt:scenarios:suitePanelOpen');
      if (v === '0') return false;
      if (v === '1') return true;
    } catch {}
    return true;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('gtt:scenarios:suitePanelOpen', open ? '1' : '0');
    } catch {}
  }, [open]);

  const suiteStepsParsed: UserScenarioStep[] = useMemo(() => {
    return suitePreSteps.map((raw, idx) => {
      let parsed: any = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
      const order = idx + 1;
      const action =
        (parsed?.action ?? (typeof raw === 'string' ? raw : '') ?? '').toString();
      const expected = (parsed?.expected ?? '').toString();
      const data = (parsed?.data ?? '').toString();
      return {
        id: `suite-${idx}`,
        order,
        action,
        expected,
        data,
      };
    });
  }, [suitePreSteps]);

  const suiteSelectValue =
    selectedSuiteId != null ? String(selectedSuiteId) : 'none';
  const selectedSuite = selectedSuiteId != null ? suites.find((s) => s.id === selectedSuiteId) : null;

  const addSuitePreSteps = () => {
    const lines = suitePreStepDraft
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return;
    onSuitePreStepsChange([...suitePreSteps, ...lines]);
    onSuitePreStepDraftChange('');
  };

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="space-y-3 rounded-lg border bg-card p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                aria-label={open ? '折叠测试套件' : '展开测试套件'}
              >
                {open ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <div className="text-sm font-semibold">测试套件</div>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            将多个用例放入同一套件，复用套件级前置步骤并生成单个测试文件。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenCreateSuite}
          >
            <Plus className="mr-1 h-4 w-4" />
            新建套件
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!selectedSuiteId || suiteGenerating}
            onClick={onGenerateSuiteCode}
          >
            {suiteGenerating && (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            )}
            生成套件代码
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!selectedSuiteId || suiteDeleting}
            onClick={onDeleteSuite}
          >
            删除套件
          </Button>
        </div>
      </div>

      <CollapsibleContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1 md:col-span-1">
            <Label className="text-xs">所属套件</Label>
            <OptionsSelectSearch
              key={`suite-select-${suiteSelectValue}-${suites.length}`}
              placeholder="搜索或选择套件"
              value={suiteSelectValue}
              items={[
                { value: 'none', label: '不加入套件' },
                ...suites
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((s) => ({
                    value: String(s.id),
                    label: `${s.name}${
                      s.caseCount ? `（${s.caseCount} 用例）` : ''
                    }`,
                  })),
              ]}
              onChange={(val) => {
                if (val === 'none') {
                  onAssignSuite(null);
                } else {
                  const n = Number(val);
                  if (Number.isFinite(n)) {
                    onAssignSuite(n);
                  }
                }
              }}
              className="w-full"
              disabled={suiteLoading}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">套件描述（可选）</Label>
            <Input
              value={suiteDescDraft}
              onChange={(e) => onSuiteDescChange(e.target.value)}
              placeholder="为套件添加说明，帮助团队理解覆盖范围"
              disabled={!selectedSuiteId}
            />
          </div>
        </div>

        {selectedSuiteId ? (
          <SuiteCasesTable
            suiteId={selectedSuiteId}
            suiteName={selectedSuite?.name || null}
            allCases={allCases}
            adding={!!addingSuiteCases}
            onAddCases={(caseIds) => onAddSuiteCases(selectedSuiteId, caseIds)}
            cases={suiteCases}
            selectedCaseId={selectedCaseId}
            removingCaseId={removingSuiteCaseId}
            onEditCase={onEditSuiteCase}
            onRemoveCase={onRemoveSuiteCase}
          />
        ) : null}

      <div className="space-y-2 rounded-md border bg-muted/20 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <Label className="text-xs">Actors（多账号）</Label>
            <p className="text-muted-foreground mt-1 text-[11px]">
              用例的 `submenu` 如果等于 actor name，生成的套件代码会自动插入 `tc.useActor(submenu)`。
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!selectedSuiteId}
            onClick={() => {
              onSuiteActorsDraftChange([
                ...suiteActorsDraft,
                { name: '', scope: 'suite', authMode: 'ui', cookiesPath: '' },
              ]);
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            添加 actor
          </Button>
        </div>

        <div className="grid gap-2">
          {suiteActorsDraft.length ? (
            <div className="grid gap-2">
              {suiteActorsDraft.map((row, idx) => (
                <div
                  key={`actor-${idx}`}
                  className="grid items-center gap-2 rounded-md border bg-background p-2 md:grid-cols-12"
                >
                  <div className="md:col-span-2">
                    <Label className="text-[11px]">name</Label>
                    <Input
                      value={row.name}
                      onChange={(e) => {
                        const next = suiteActorsDraft.slice();
                        next[idx] = { ...row, name: e.target.value };
                        onSuiteActorsDraftChange(next);
                      }}
                      placeholder="host / viewer / user1 ..."
                      disabled={!selectedSuiteId}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-[11px]">scope</Label>
                    <select
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                      value={row.scope}
                      disabled={!selectedSuiteId}
                      onChange={(e) => {
                        const v = e.target.value === 'test' ? 'test' : 'suite';
                        const next = suiteActorsDraft.slice();
                        next[idx] = { ...row, scope: v };
                        onSuiteActorsDraftChange(next);
                      }}
                    >
                      <option value="suite">suite</option>
                      <option value="test">test</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-[11px]">auth</Label>
                    <select
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                      value={row.authMode}
                      disabled={!selectedSuiteId}
                      onChange={(e) => {
                        const v = e.target.value === 'cookies' ? 'cookies' : 'ui';
                        const next = suiteActorsDraft.slice();
                        next[idx] = { ...row, authMode: v, cookiesPath: v === 'cookies' ? row.cookiesPath : '' };
                        onSuiteActorsDraftChange(next);
                      }}
                    >
                      <option value="ui">ui</option>
                      <option value="cookies">cookies</option>
                    </select>
                  </div>
                  <div className="md:col-span-5">
                    <Label className="text-[11px]">cookiesPath</Label>
                    <Input
                      value={row.cookiesPath}
                      onChange={(e) => {
                        const next = suiteActorsDraft.slice();
                        next[idx] = { ...row, cookiesPath: e.target.value };
                        onSuiteActorsDraftChange(next);
                      }}
                      placeholder="auth/user1.cookies.json"
                      disabled={!selectedSuiteId || row.authMode !== 'cookies'}
                    />
                  </div>
                  <div className="flex justify-end md:col-span-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={!selectedSuiteId}
                      onClick={() => {
                        const next = suiteActorsDraft.filter((_, i) => i !== idx);
                        onSuiteActorsDraftChange(next);
                        if (suiteDefaultActorDraft && !next.some((a) => a.name === suiteDefaultActorDraft)) {
                          onSuiteDefaultActorDraftChange('');
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              未配置 actors。需要多账号场景时添加 host/viewer 等。
            </p>
          )}

          <div className="grid gap-1 md:grid-cols-3">
            <div className="space-y-1 md:col-span-1">
              <Label className="text-[11px]">defaultActor</Label>
              <select
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={suiteDefaultActorDraft}
                disabled={!selectedSuiteId}
                onChange={(e) => onSuiteDefaultActorDraftChange(e.target.value)}
              >
                <option value="">（无）</option>
                {suiteActorsDraft
                  .map((a) => a.name.trim())
                  .filter(Boolean)
                  .map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <Label className="text-xs">套件级前置步骤</Label>
            <p className="text-muted-foreground text-[11px]">
              这些前置步骤会在套件代码中统一执行，不需要在每个用例里重复。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onOpenSuiteStepDialog}
              disabled={!selectedSuiteId || suiteLoading}
            >
              <Plus className="mr-1 h-4 w-4" />
              使用对话框添加
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onSaveSuitePreSteps}
              disabled={!selectedSuiteId || suiteSaving}
            >
              {suiteSaving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              保存套件
            </Button>
          </div>
        </div>
        <ScenarioStepsTable
          steps={suiteStepsParsed}
          mode="editable"
          showRowNumber
          onEditStep={(id) => onEditSuiteStep(id)}
          onDeleteStep={(id) => {
            const idx = suiteStepsParsed.findIndex((s) => s.id === id);
            if (idx < 0) return;
            onSuitePreStepsChange(suitePreSteps.filter((_, i) => i !== idx));
          }}
          onMoveStep={(id, dir) => {
            const idx = suiteStepsParsed.findIndex((s) => s.id === id);
            if (idx < 0) return;
            if (dir === 'up' && idx === 0) return;
            if (dir === 'down' && idx === suiteStepsParsed.length - 1) return;
            const target = dir === 'up' ? idx - 1 : idx + 1;
            const next = [...suitePreSteps];
            const tmp = next[idx];
            next[idx] = next[target];
            next[target] = tmp;
            onSuitePreStepsChange(next);
          }}
        />
      </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
