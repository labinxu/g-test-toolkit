 'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { OptionsSelectSearch } from '@/components/select/options-select-search';
import { Loader2, Plus, Trash2 } from 'lucide-react';

type SuiteSummary = {
  id: number;
  name: string;
  description?: string | null;
  caseCount?: number;
  sharedPreSteps?: string[];
};

type SuitePanelProps = {
  suites: SuiteSummary[];
  selectedSuiteId: number | null;
  suiteLoading: boolean;
  suiteGenerating: boolean;
  suiteSaving?: boolean;
  suiteDescDraft: string;
  suitePreSteps: string[];
  suitePreStepDraft: string;
  onSuiteDescChange: (val: string) => void;
  onSuitePreStepsChange: (steps: string[]) => void;
  onSuitePreStepDraftChange: (val: string) => void;
  onAssignSuite: (suiteId: number | null) => void;
  onSaveSuitePreSteps: () => void;
  onOpenCreateSuite: () => void;
  onGenerateSuiteCode: () => void;
  onOpenSuiteStepDialog: () => void;
};

export function SuitePanel({
  suites,
  selectedSuiteId,
  suiteLoading,
  suiteGenerating,
  suiteDescDraft,
  suitePreSteps,
  suitePreStepDraft,
  onSuiteDescChange,
  onSuitePreStepsChange,
  onSuitePreStepDraftChange,
  onAssignSuite,
  onSaveSuitePreSteps,
  onOpenCreateSuite,
  onGenerateSuiteCode,
  onOpenSuiteStepDialog,
  suiteSaving = false,
}: SuitePanelProps) {
  const suiteSelectValue =
    selectedSuiteId != null ? String(selectedSuiteId) : 'none';

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
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">测试套件</div>
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
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
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
        <div className="space-y-1">
          <Label className="text-xs">套件描述（可选）</Label>
          <Input
            value={suiteDescDraft}
            onChange={(e) => onSuiteDescChange(e.target.value)}
            placeholder="为套件添加说明，帮助团队理解覆盖范围"
            disabled={!selectedSuiteId}
          />
        </div>
    </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <Label className="text-xs">套件级前置步骤</Label>
            <p className="text-muted-foreground text-[11px]">
              这些前置步骤会在套件代码中统一执行，不需要在每个用例里重复。
            </p>
          </div>
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
        </div>
        <div className="space-y-2">
          {suitePreSteps.length === 0 && (
            <p className="text-muted-foreground text-[11px]">
              暂无前置步骤，可在下方添加。
            </p>
          )}
          {suitePreSteps.map((step, idx) => (
            <div key={`${idx}-${step}`} className="flex items-center gap-2">
              <Input
                value={step}
                onChange={(e) =>
                  onSuitePreStepsChange(
                    suitePreSteps.map((s, i) =>
                      i === idx ? e.target.value : s,
                    ),
                  )
                }
                disabled={!selectedSuiteId}
                placeholder={`前置步骤 ${idx + 1}`}
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8"
                disabled={!selectedSuiteId}
                onClick={() =>
                  onSuitePreStepsChange(
                    suitePreSteps.filter((_, i) => i !== idx),
                  )
                }
                aria-label="删除套件前置步骤"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Textarea
            value={suitePreStepDraft}
            onChange={(e) => onSuitePreStepDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                addSuitePreSteps();
              }
            }}
            placeholder="按行输入多个前置步骤，Enter 快速添加，Shift+Enter 换行"
            rows={3}
            disabled={!selectedSuiteId}
            className="min-h-[72px]"
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-9 w-9"
            disabled={!selectedSuiteId || !suitePreStepDraft.trim()}
            onClick={addSuitePreSteps}
            aria-label="添加套件前置步骤"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={onSaveSuitePreSteps}
            disabled={!selectedSuiteId || suiteSaving}
          >
            {suiteSaving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            保存套件前置
          </Button>
          <p className="text-muted-foreground text-[11px]">
            套件前置步骤将一次维护，在生成的套件代码中统一调用。
          </p>
        </div>
      </div>
    </div>
  );
}
