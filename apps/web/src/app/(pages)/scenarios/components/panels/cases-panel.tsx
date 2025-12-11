import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OptionsSelect, type OptionsSelectItem } from '@/components/select/options-select';
import ResizableStickyTable from '@/components/data-table';
import TableToolbar from '@/components/table-toolbar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Download,
  ExternalLink,
  FileCode,
  FileText,
  FileUp,
  Loader2,
  Pencil,
  Plus,
  Play,
  Radio,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserScenarioSummary } from '../../types';

export type CasesPanelProps = {
  platform: string;
  platforms: OptionsSelectItem<string>[];
  ingestingDoc: boolean;
  loadingCases: boolean;
  onOpenDocPrompt: () => void;
  onCsvFileChange: (file: File) => void | Promise<void>;
  onDocFileChange: (file: File) => void | Promise<void>;
  onPlatformChange: (val: string) => void;
  onRefresh: () => void;
  tablePage: number;
  tablePageSize: number;
  tableFilteredRows: number;
  onRowCountChange: (total: number, filtered: number) => void;
  filteredCases: UserScenarioSummary[];
  totalPages: number;
  safePage: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onNewCase: () => void;
  selectedIds: number[];
  deletingBulk: boolean;
  onDeleteSelected: () => void;
  onExport: () => void;
  selectedCaseId: number | null;
  onSelectCase: (id: number) => void;
  moduleLabelMap: Record<string, string>;
  submenuLabelMap: Record<string, string>;
  priorityLabelMap: Record<'P0' | 'P1' | 'P2', string>;
  statusLabelMap: Record<string, string>;
  runEnvItems: OptionsSelectItem<string>[];
  runEnvSelected: string;
  onSelectRunEnv: (val: string) => void;
  tableSelectedKeys: Set<string>;
  onSelectionChange: (keys: Set<string>, ids: number[]) => void;
  deletingId: number | null;
  onDeleteCase: (id: number) => void;
  onOpenMeta: (id: number) => void;
  onOpenSteps: (id: number) => void;
  onGenerateCode: (id: number, platform?: string | null) => void;
  onOpenTestcases: (filePath?: string | null) => void;
  onRunCase: (id: number) => void;
  onRunSelected: () => void;
  onOpenRunLogs: () => void;
};

export function CasesPanel({
  platform,
  platforms,
  ingestingDoc,
  loadingCases,
  onOpenDocPrompt,
  onCsvFileChange,
  onDocFileChange,
  onPlatformChange,
  onRefresh,
  tablePage,
  tablePageSize,
  tableFilteredRows,
  filteredCases,
  totalPages,
  safePage,
  onPageChange,
  onPageSizeChange,
  onNewCase,
  selectedIds,
  deletingBulk,
  onDeleteSelected,
  onExport,
  selectedCaseId,
  onSelectCase,
  moduleLabelMap,
  submenuLabelMap,
  priorityLabelMap,
  statusLabelMap,
  runEnvItems,
  runEnvSelected,
  onSelectRunEnv,
  tableSelectedKeys,
  onSelectionChange,
  onRowCountChange,
  deletingId,
  onDeleteCase,
  onOpenMeta,
  onOpenSteps,
  onGenerateCode,
  onOpenTestcases,
  onRunCase,
  onRunSelected,
  onOpenRunLogs,
}: CasesPanelProps) {
  return (
    <Card className="flex min-h-0 flex-1 flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          用户场景 / 用例
          <span className="text-muted-foreground text-xs">
            {tableFilteredRows || filteredCases.length} 条
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-4 pt-0">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full"
                disabled={loadingCases}
                onClick={onRefresh}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>刷新列表</TooltipContent>
          </Tooltip>
          <div className="flex flex-wrap items-center gap-1.5">
            <form className="flex items-center gap-1.5" onSubmit={(e) => e.preventDefault()}>
              <input
                id="ls-upload-csv"
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  await onCsvFileChange(file);
                  event.target.value = '';
                }}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={() => {
                      const input = document.getElementById('ls-upload-csv') as HTMLInputElement | null;
                      input?.click();
                    }}
                  >
                    <FileUp className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>从结构化 CSV 导入（要求符合 Livestream CSV 模板）</TooltipContent>
              </Tooltip>
            </form>
            <form className="flex items-center gap-1.5" onSubmit={(e) => e.preventDefault()}>
              <input
                id="ls-upload-doc"
                type="file"
                accept=".csv,text/csv,.txt,.md,.markdown,.log"
                className="hidden"
                onChange={async (event) => {
                  if (!event.target.files?.length) return;
                  const file = event.target.files[0]!;
                  await onDocFileChange(file);
                  event.target.value = '';
                }}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    disabled={ingestingDoc}
                    onClick={() => {
                      if (ingestingDoc) return;
                      onOpenDocPrompt();
                    }}
                  >
                    {ingestingDoc ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  从说明文档/设计文档导入（支持 md/txt/csv，自动解析为用例草稿）
                </TooltipContent>
              </Tooltip>
            </form>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <OptionsSelect
              id="ls-platform"
              value={platform}
              items={platforms.length ? platforms : [{ value: 'gettr-web', label: 'GETTR Web' }]}
              placeholder="平台"
              onSelect={(item) => onPlatformChange(item.value)}
              size="sm"
              triggerClassName="min-w-[140px]"
            />
            <OptionsSelect
              id="ls-run-env"
              value={runEnvSelected}
              items={
                runEnvItems.length
                  ? runEnvItems
                  : [{ value: 'none', label: '默认环境（无模板）' }]
              }
              placeholder="运行环境模板"
              onSelect={(item) => onSelectRunEnv(item.value)}
              size="sm"
              triggerClassName="min-w-[200px]"
            />
          </div>
          {ingestingDoc && (
            <p className="text-muted-foreground max-w-xl text-[11px]">
              导入中：后端正在解析说明文档并写入用户场景，通常需要 10～60 秒，完成后列表会自动刷新…
            </p>
          )}
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <TableToolbar
            page={tablePage}
            totalPages={totalPages}
            totalRows={tableFilteredRows || filteredCases.length}
            pageSize={tablePageSize}
            pageSizeMin={10}
            pageSizeMax={200}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            rightActions={
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      type="button"
                      onClick={onNewCase}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>新增用例</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      disabled={!filteredCases.length}
                      onClick={onExport}
                      type="button"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>
                    导出{selectedIds.length ? '所选' : '全部'}用例
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="default"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      disabled={!selectedIds.length}
                      onClick={onRunSelected}
                      type="button"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>顺序运行所选用例</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      type="button"
                      onClick={onOpenRunLogs}
                    >
                      <Radio className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>查看运行日志</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      disabled={!selectedIds.length || deletingBulk}
                      onClick={onDeleteSelected}
                      type="button"
                    >
                      {deletingBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>删除所选</TooltipContent>
                </Tooltip>
              </>
            }
          />
          <div className="relative min-h-0 flex-1">
            <ResizableStickyTable<UserScenarioSummary>
              rows={filteredCases}
              columns={[
                {
                  key: 'code',
                  header: '用例ID',
                  width: 80,
                  minWidth: 72,
                  sticky: 'left' as const,
                  filterType: 'text' as const,
                  filterPlaceholder: '按用例ID筛选',
                  render: (row: UserScenarioSummary) => (
                    <button
                      type="button"
                      className={cn('w-full truncate text-left', selectedCaseId === row.id && 'font-semibold')}
                      onClick={() => onSelectCase(row.id)}
                    >
                      {row.code}
                    </button>
                  ),
                },
                {
                  key: 'title',
                  header: '标题',
                  width: 220,
                  minWidth: 160,
                  filterType: 'text' as const,
                  filterPlaceholder: '按标题筛选',
                  render: (row: UserScenarioSummary) => (
                    <button
                      type="button"
                      className={cn('w-full truncate text-left', selectedCaseId === row.id && 'font-semibold')}
                      title={row.title}
                      onClick={() => onSelectCase(row.id)}
                    >
                      {row.title}
                    </button>
                  ),
                },
                {
                  key: 'module',
                  header: '业务模块',
                  width: 120,
                  minWidth: 96,
                  filterType: 'select' as const,
                  accessor: (row: UserScenarioSummary) => (row.module ? moduleLabelMap[row.module] || row.module : ''),
                },
                {
                  key: 'submenu',
                  header: '角色 / Persona',
                  width: 80,
                  minWidth: 72,
                  filterType: 'select' as const,
                  accessor: (row: UserScenarioSummary) =>
                    row.submenu ? submenuLabelMap[row.submenu] || row.submenu : '-',
                },
                {
                  key: 'priority',
                  header: '优先级',
                  width: 72,
                  minWidth: 64,
                  filterType: 'select' as const,
                  accessor: (row: UserScenarioSummary) =>
                    row.priority ? priorityLabelMap[row.priority] : '',
                },
                {
                  key: 'status',
                  header: '状态',
                  width: 80,
                  minWidth: 72,
                  filterType: 'select' as const,
                  accessor: (row: UserScenarioSummary) => statusLabelMap[row.status],
                },
                {
                  key: 'actions',
                  header: '',
                  width: 188,
                  minWidth: 168,
                  render: (row: UserScenarioSummary) => (
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              onSelectCase(row.id);
                              onOpenSteps(row.id);
                            }}
                            aria-label="编辑步骤"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent sideOffset={6}>编辑步骤</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              onSelectCase(row.id);
                              onOpenMeta(row.id);
                            }}
                            aria-label="编辑基本信息"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent sideOffset={6}>编辑基本信息</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => onGenerateCode(row.id, row.platform || platform)}
                            aria-label="为该用例生成代码"
                          >
                            <FileCode className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent sideOffset={6}>为该用例生成代码</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => onRunCase(row.id)}
                            aria-label="运行用例"
                          >
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent sideOffset={6}>运行用例（未生成则先生成）</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {(() => {
                            const canOpen =
                              row.status === 'code_generated' &&
                              !!row.generatedFilePath &&
                              row.generatedFilePath.trim().length > 0;
                            return (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                disabled={!canOpen}
                                onClick={() => {
                                  if (!canOpen) return;
                                  onOpenTestcases(row.generatedFilePath);
                                }}
                                aria-label="在用例库中打开生成代码"
                              >
                                <ExternalLink className={cn('h-3.5 w-3.5', !canOpen && 'opacity-30 cursor-default')} />
                              </Button>
                            );
                          })()}
                        </TooltipTrigger>
                        <TooltipContent sideOffset={6}>在「用例库」中打开生成代码</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive h-7 w-7"
                            disabled={deletingId === row.id}
                            onClick={() => onDeleteCase(row.id)}
                            aria-label="删除用户场景"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent sideOffset={6}>删除用例</TooltipContent>
                      </Tooltip>
                    </div>
                  ),
                },
              ]}
              getRowKey={(row) => `id:${row.id}`}
              page={safePage}
              pageSize={tablePageSize}
              headerLightClass="bg-muted text-foreground border-b border-border"
              headerDarkClass="dark:bg-muted dark:text-foreground dark:border-border"
              density="compact"
              selection={{
                enabled: true,
                keys: tableSelectedKeys,
                onChange: (keys) => {
                  const ids: number[] = [];
                  for (const k of keys) {
                    const parts = k.split(':');
                    const n = Number(parts[1] ?? parts[0]);
                    if (Number.isFinite(n)) ids.push(n);
                  }
                  onSelectionChange(keys, ids);
                },
                width: 40,
                minWidth: 36,
              }}
              containerClassName="h-full overflow-x-auto overflow-y-auto"
              rowClassName={(row) => (selectedCaseId === row.id ? 'bg-primary/10 dark:bg-primary/20' : '')}
              enableFilters
              onRowCountChange={onRowCountChange}
              onRowDoubleClick={(row) => {
                onSelectCase(row.id);
                onOpenSteps(row.id);
              }}
            />
            {tableFilteredRows === 0 && (
              <p className="text-muted-foreground pointer-events-none absolute inset-x-0 top-12 text-center text-xs">
                暂无匹配的用户场景，请调整筛选条件或点击右上角 + 按钮新建。
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
