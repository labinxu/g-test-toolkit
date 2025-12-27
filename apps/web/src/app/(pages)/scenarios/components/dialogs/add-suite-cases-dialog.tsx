'use client'

import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'

import ResizableStickyTable from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { SortDir } from '@/components/data-table'
import type { UserScenarioSummary } from '../../types'

type AddSuiteCasesDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  suiteId: number
  suiteName?: string | null
  allCases: Pick<UserScenarioSummary, 'id' | 'code' | 'title'>[]
  existingCaseIds: Set<number>
  adding: boolean
  onAddCases: (caseIds: number[]) => Promise<boolean> | boolean
}

export function AddSuiteCasesDialog({
  open,
  onOpenChange,
  suiteId,
  suiteName,
  allCases,
  existingCaseIds,
  adding,
  onAddCases,
}: AddSuiteCasesDialogProps) {
  const [query, setQuery] = useState('')
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<string>('id')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allCases
      .filter((c) => !existingCaseIds.has(c.id))
      .filter((c) => {
        if (!q) return true
        return (
          String(c.id).includes(q) ||
          (c.code || '').toLowerCase().includes(q) ||
          (c.title || '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => a.id - b.id)
  }, [allCases, existingCaseIds, query])

  const selectedIds = useMemo(() => {
    const ids: number[] = []
    for (const k of selectedKeys) {
      const parts = k.split(':')
      const n = Number(parts[1] ?? parts[0])
      if (Number.isFinite(n)) ids.push(n)
    }
    return ids
  }, [selectedKeys])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) {
          setQuery('')
          setSelectedKeys(new Set())
        }
      }}
    >
	      <DialogContent className="sm:max-w-3xl flex max-h-[85vh] flex-col overflow-hidden">
	        <DialogHeader>
	          <DialogTitle className="flex items-center gap-2">
	            <Plus className="h-4 w-4" />
	            添加用例到套件
	          </DialogTitle>
	          <DialogDescription className="sr-only">
	            从列表中选择用例并添加到目标套件。
	          </DialogDescription>
	        </DialogHeader>

        <div className="min-h-0 flex flex-1 flex-col gap-3 overflow-hidden">
          <div className="grid shrink-0 gap-2 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">目标套件</Label>
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
                #{suiteId} {suiteName ? `· ${suiteName}` : ''}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">搜索</Label>
              <Input
                value={query}
                placeholder="按用例ID / 用例编号 / 标题筛选"
                onChange={(e) => setQuery(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="text-muted-foreground shrink-0 text-xs">
            仅显示未加入当前套件的用例（{candidates.length} 条）。
          </div>

          <div className="min-h-0 flex-1">
            <ResizableStickyTable<Pick<UserScenarioSummary, 'id' | 'code' | 'title'>>
              rows={candidates}
              columns={[
                { key: 'id', header: '用例ID', width: 88, minWidth: 80, sortable: true },
                { key: 'code', header: '用例编号', width: 120, minWidth: 100, sortable: true },
                { key: 'title', header: '标题', width: 360, minWidth: 220 },
              ]}
              getRowKey={(row) => `id:${row.id}`}
              page={1}
              pageSize={9999}
              headerHeightPx={40}
              density="compact"
              headerLightClass="bg-muted/70 text-foreground"
              headerDarkClass="dark:bg-muted/70 dark:text-foreground"
              framePadding="none"
              frameClassName="rounded-md"
              containerClassName="h-[52vh] overscroll-contain overflow-x-auto overflow-y-auto"
              selection={{
                enabled: true,
                keys: selectedKeys,
                onChange: (keys) => setSelectedKeys(keys),
                width: 40,
                minWidth: 36,
              }}
              sortKey={sortKey}
              sortDir={sortDir}
              onSortChange={(key, dir) => {
                setSortKey(key)
                setSortDir(dir)
              }}
              compareFns={{
                id: (a, b) => (a.id || 0) - (b.id || 0),
                code: (a, b) => (a.code || '').localeCompare(b.code || ''),
              }}
            />
          </div>
        </div>

        <DialogFooter className="relative z-[90] gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={adding}>
              取消
            </Button>
          </DialogClose>
          <Button
            type="button"
            disabled={adding || selectedIds.length === 0}
            onClick={async () => {
              const ok = await onAddCases(selectedIds)
              if (ok) {
                onOpenChange(false)
              }
            }}
          >
            添加所选（{selectedIds.length}）
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
