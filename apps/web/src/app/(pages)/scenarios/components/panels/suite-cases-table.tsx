'use client'

import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'

import { GTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { EmbedSelectSearch } from '@/components/select/embed-select-search'
import type { OptionsSelectItem } from '@/components/select/options-select'
import { AddSuiteCasesDialog } from '../dialogs/add-suite-cases-dialog'
import type { UserScenarioSummary } from '../../types'

type SuiteCasesTableProps = {
  suiteId: number
  suiteName?: string | null
  actorItems: OptionsSelectItem<string>[]
  allCases: Pick<UserScenarioSummary, 'id' | 'code' | 'title'>[]
  adding?: boolean
  onAddCases: (caseIds: number[]) => Promise<boolean> | boolean
  cases: Array<Pick<UserScenarioSummary, 'id' | 'code' | 'title'> & { actorId?: number | null }>
  selectedCaseId?: number | null
  removingCaseId?: number | null
  onEditCase: (id: number) => void
  onRemoveCase: (id: number) => void
  onUpdateCaseActor: (caseId: number, actorId: number | null) => void
}

export function SuiteCasesTable({
  suiteId,
  suiteName,
  actorItems,
  allCases,
  adding = false,
  onAddCases,
  cases,
  selectedCaseId,
  removingCaseId,
  onEditCase,
  onRemoveCase,
  onUpdateCaseActor,
}: SuiteCasesTableProps) {
  const [addOpen, setAddOpen] = useState(false)
  const highlightRowIndex = useMemo(() => {
    if (selectedCaseId == null) return null
    const idx = cases.findIndex((c) => c.id === selectedCaseId)
    return idx >= 0 ? idx : null
  }, [cases, selectedCaseId])

  const existingCaseIds = useMemo(() => new Set(cases.map((c) => c.id)), [cases])

  const headers = ['用例ID', '用例编号', '标题', 'Actor', '']

  const rows = cases.map((c) => [
    <button
      key={`id-${c.id}`}
      type="button"
      className="w-full truncate text-left font-medium"
      onClick={(e) => {
        e.stopPropagation()
        onEditCase(c.id)
      }}
    >
      {c.id}
    </button>,
    <button
      key={`code-${c.id}`}
      type="button"
      className="w-full truncate text-left text-[11px] text-muted-foreground"
      onClick={(e) => {
        e.stopPropagation()
        onEditCase(c.id)
      }}
    >
      {c.code}
    </button>,
    <button
      key={`title-${c.id}`}
      type="button"
      className="w-full truncate text-left"
      title={c.title}
      onClick={(e) => {
        e.stopPropagation()
        onEditCase(c.id)
      }}
    >
      {c.title}
    </button>,
    <div
      key={`actor-${c.id}`}
      className="min-w-[160px]"
    >
      <EmbedSelectSearch
        size="sm"
        value={c.actorId ? String(c.actorId) : 'none'}
        onChange={(val) => {
          const next = val === 'none' ? null : Number(val)
          onUpdateCaseActor(c.id, Number.isFinite(next as any) ? (next as any) : null)
        }}
        items={actorItems}
        placeholder="选择 Actor"
      />
    </div>,
    <div key={`ops-${c.id}`} className="flex items-center justify-end gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="编辑"
            onClick={(e) => {
              e.stopPropagation()
              onEditCase(c.id)
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent sideOffset={6}>编辑</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="从套件移除"
            disabled={removingCaseId === c.id}
            onClick={(e) => {
              e.stopPropagation()
              onRemoveCase(c.id)
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent sideOffset={6}>从套件移除</TooltipContent>
      </Tooltip>
    </div>,
  ])

  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium">已加入套件的用例</div>
        <div className="flex items-center gap-1">
          <div className="text-muted-foreground text-xs">{cases.length} 条</div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-7 w-7"
                aria-label="添加用例到套件"
                disabled={adding}
                onClick={() => setAddOpen(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>添加用例</TooltipContent>
          </Tooltip>
        </div>
      </div>
      {cases.length ? (
        <GTable
          headers={headers}
          rows={rows}
          stickyLastColumn
          stickyLastColumnWidthPx={88}
          showFooter={false}
          highlightRowIndex={highlightRowIndex}
          containerClassName="max-h-[220px] overflow-x-auto overflow-y-auto"
          onSelectedRow={(rowIndex) => {
            const row = cases[rowIndex]
            if (!row) return
            onEditCase(row.id)
          }}
          onRowDoubleClick={(rowIndex) => {
            const row = cases[rowIndex]
            if (!row) return
            onEditCase(row.id)
          }}
        />
      ) : (
        <div className="text-muted-foreground rounded-md border bg-background p-3 text-xs">
          当前套件暂无用例。点击右上角 + 添加。
        </div>
      )}

      <AddSuiteCasesDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        suiteId={suiteId}
        suiteName={suiteName}
        allCases={allCases}
        existingCaseIds={existingCaseIds}
        adding={adding}
        onAddCases={onAddCases}
      />
    </div>
  )
}
