import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react';
import { GTable } from '@/components/g-table';
import type { StepParamHint, UserScenarioStep } from '../../types';

export type ScenarioStepsTableProps = {
  steps: UserScenarioStep[];
  mode: 'readonly' | 'editable';
  getStepParamHint?: (step: UserScenarioStep) => StepParamHint | null;
  onEditStep?: (id: string) => void;
  onDeleteStep?: (id: string) => void;
  onMoveStep?: (id: string, direction: 'up' | 'down') => void;
  showRowNumber?: boolean;
};

export function ScenarioStepsTable({
  steps,
  mode,
  getStepParamHint,
  onEditStep,
  onDeleteStep,
  onMoveStep,
  showRowNumber = false,
}: ScenarioStepsTableProps) {
  const [highlightStepId, setHighlightStepId] = useState<string | null>(null);

  const highlightRowIndex =
    highlightStepId != null
      ? steps.findIndex((step) => step.id === highlightStepId)
      : -1;

  if (!steps.length) {
    return (
      <div className="text-muted-foreground py-2 text-center text-xs">
        暂无步骤，请点击右上角「添加步骤」为该用例补充执行路径。
      </div>
    );
  }

  const isEditable = mode === 'editable';
  const showEdit = isEditable && typeof onEditStep === 'function';
  const showDelete = typeof onDeleteStep === 'function';
  const showMove = isEditable && typeof onMoveStep === 'function';

  const headers: ReactNode[] = [];
  if (showEdit) headers.push('');
  headers.push('顺序', '操作', '数据', '期望结果');
  if (showDelete) headers.push('');

  const rows = steps.map((s, index) => {
    const hint = getStepParamHint ? getStepParamHint(s) : null;
    const hasData = !!(s.data && s.data.trim());

    const displayOrder = showRowNumber ? index + 1 : s.order;
    const orderLabel = (
      <div className="flex items-center justify-end gap-1 pr-1">
        <div className="flex items-center gap-1">
          {showMove && (
            <div className="mr-1 flex flex-col items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-4 w-4"
                disabled={index === 0}
                onClick={() => {
                  onMoveStep?.(s.id, 'up');
                  setHighlightStepId(s.id);
                }}
                aria-label="上移步骤"
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-4 w-4"
                disabled={index === steps.length - 1}
                onClick={() => {
                  onMoveStep?.(s.id, 'down');
                  setHighlightStepId(s.id);
                }}
                aria-label="下移步骤"
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            </div>
          )}
          <span className="inline-block w-[32px] text-right text-xs">{displayOrder}</span>
        </div>
      </div>
    );

    const dataText = hasData ? s.data : hint ? `参数：${hint.summary}` : '—';

    const rowCells: ReactNode[] = [];
    if (showEdit) {
      rowCells.push(
        <Tooltip key="edit-tip">
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 cursor-grab active:cursor-grabbing"
              onClick={() => onEditStep?.(s.id)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent sideOffset={6}>编辑步骤（页面 + 动作 + 参数）</TooltipContent>
        </Tooltip>,
      );
    }

    rowCells.push(
      orderLabel,
      <Tooltip key="action">
        <TooltipTrigger asChild>
          <div className="line-clamp-2 text-xs whitespace-pre-wrap">{s.action || '—'}</div>
        </TooltipTrigger>
        {s.action && (
          <TooltipContent sideOffset={6} className="max-w-sm whitespace-pre-wrap">
            {s.action}
          </TooltipContent>
        )}
      </Tooltip>,
      <Tooltip key="data">
        <TooltipTrigger asChild>
          <div className="text-muted-foreground line-clamp-2 text-[11px] whitespace-pre-wrap">
            {dataText}
          </div>
        </TooltipTrigger>
        {(hasData || hint) && (
          <TooltipContent sideOffset={6} className="max-w-sm whitespace-pre-wrap">
            {hasData ? s.data : hint?.summary}
            {hint && hasData && (
              <div className="text-muted-foreground mt-1 text-[11px]">参数：{hint.summary}</div>
            )}
          </TooltipContent>
        )}
      </Tooltip>,
      <Tooltip key="expected">
        <TooltipTrigger asChild>
          <div className="line-clamp-2 text-xs whitespace-pre-wrap">{s.expected || '—'}</div>
        </TooltipTrigger>
        {s.expected && (
          <TooltipContent sideOffset={6} className="max-w-sm whitespace-pre-wrap">
            {s.expected}
          </TooltipContent>
        )}
      </Tooltip>,
    );

    if (showDelete) {
      rowCells.push(
        <Button
          key="delete"
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onDeleteStep?.(s.id)}
          aria-label="删除步骤"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>,
      );
    }

    return rowCells;
  });

  return (
    <GTable
      headers={headers}
      rows={rows}
      highlightRowIndex={highlightRowIndex >= 0 ? highlightRowIndex : null}
      onRowDoubleClick={(rowIndex) => {
        const step = steps[rowIndex];
        if (step && onEditStep) {
          onEditStep(step.id);
        }
      }}
      onSelectedRow={
        mode === 'readonly' && onEditStep
          ? (rowIndex) => {
              const step = steps[rowIndex];
              if (step) {
                onEditStep(step.id);
              }
            }
          : undefined
      }
    />
  );
}
