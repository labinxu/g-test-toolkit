'use client'

import { useMemo, type Dispatch, type SetStateAction } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import {
  SlidersHorizontal,
  Pencil,
  FileCode,
  Eye,
  Trash2,
  Plus,
  MoreVertical,
} from 'lucide-react'
import { TableHeaderContent } from '@/components/table-header-content'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import TableToolbar from '@/components/table-toolbar'
import { GTable } from '@/components/data-table'
import type { PageSummary } from '../../action-catalog/types'

type Props = {
  pagedPages: PageSummary[]
  filteredPages: PageSummary[]
  selectedPageIds: number[]
  setSelectedPageIds: Dispatch<SetStateAction<number[]>>
  keyFilter: string
  setKeyFilter: (v: string) => void
  nameFilter: string
  setNameFilter: (v: string) => void
  enabledFilter: 'all' | 'enabled' | 'disabled'
  setEnabledFilter: (v: 'all' | 'enabled' | 'disabled') => void
  pageTablePage: number
  pageTableTotalPages: number
  pageTablePageSize: number
  setPageTablePage: (n: number) => void
  setPageTablePageSize: (n: number) => void
  loadingPages: boolean
  deleting: boolean
  onCreatePage: () => void
  onBulkDelete: () => void
  onSelectPage: (id: number) => void
  onOpenDetails: (id: number) => void
  onOpenLib: (page: PageSummary) => void
  onViewPage: (id: number) => void
  onDeletePage: (page: PageSummary) => void
}

export function PageTable({
  pagedPages,
  filteredPages,
  selectedPageIds,
  setSelectedPageIds,
  keyFilter,
  setKeyFilter,
  nameFilter,
  setNameFilter,
  enabledFilter,
  setEnabledFilter,
  pageTablePage,
  pageTableTotalPages,
  pageTablePageSize,
  setPageTablePage,
  setPageTablePageSize,
  loadingPages,
  deleting,
  onCreatePage,
  onBulkDelete,
  onSelectPage,
  onOpenDetails,
  onOpenLib,
  onViewPage,
  onDeletePage,
}: Props) {
  const pageTableHeaders = useMemo(() => {
    const visibleIds = pagedPages.map((p) => p.id)
    const selectedVisible = visibleIds.filter((id) => selectedPageIds.includes(id))
    const allChecked = visibleIds.length > 0 && selectedVisible.length === visibleIds.length
    const indeterminate =
      selectedVisible.length > 0 && selectedVisible.length < visibleIds.length
    const filterButtonClass = (active: boolean) =>
      cn(
        'text-muted-foreground hover:border-border hover:bg-muted inline-flex h-6 w-6 items-center justify-center rounded border border-transparent text-[11px]',
        active && 'border-primary/50 bg-primary/5 text-primary'
      )

    return [
      <div key="sel-all" className="flex items-center justify-center">
        <Checkbox
          checked={allChecked ? true : indeterminate ? 'indeterminate' : false}
          onCheckedChange={(value) => {
            setSelectedPageIds((prev) => {
              const base = new Set(prev)
              if (value === true) {
                for (const id of visibleIds) base.add(id)
              } else {
                for (const id of visibleIds) base.delete(id)
              }
              return Array.from(base)
            })
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label="选择当前页所有页面"
        />
      </div>,
      <TableHeaderContent
        key="key-head"
        label="页面 key"
        right={
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="按页面 key 筛选"
                className={filterButtonClass(Boolean(keyFilter.trim()))}
                onClick={(e) => e.stopPropagation()}
              >
                <SlidersHorizontal className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-56 p-2"
              align="end"
              sideOffset={4}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-1">
                <div className="text-muted-foreground text-[11px]">按页面 key 筛选</div>
                <Input
                  value={keyFilter}
                  placeholder="输入页面 key"
                  className="h-8 w-full text-xs"
                  onChange={(e) => {
                    setKeyFilter(e.target.value)
                    setPageTablePage(1)
                  }}
                />
              </div>
            </PopoverContent>
          </Popover>
        }
      />,
      <TableHeaderContent
        key="label-head"
        label="名称"
        right={
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="按名称筛选"
                className={filterButtonClass(Boolean(nameFilter.trim()))}
                onClick={(e) => e.stopPropagation()}
              >
                <SlidersHorizontal className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-56 p-2"
              align="end"
              sideOffset={4}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-1">
                <div className="text-muted-foreground text-[11px]">按名称筛选</div>
                <Input
                  value={nameFilter}
                  placeholder="输入名称关键字"
                  className="h-8 w-full text-xs"
                  onChange={(e) => {
                    setNameFilter(e.target.value)
                    setPageTablePage(1)
                  }}
                />
              </div>
            </PopoverContent>
          </Popover>
        }
      />,
      <TableHeaderContent key="module-head" label="模块" />,
      <TableHeaderContent key="actions-head" label="动作数" />,
      <TableHeaderContent key="elements-head" label="元素数" />,
      <TableHeaderContent
        key="enabled-head"
        label="启用"
        right={
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="按启用状态筛选"
                className={filterButtonClass(enabledFilter !== 'all')}
                onClick={(e) => e.stopPropagation()}
              >
                <SlidersHorizontal className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-48 p-2"
              align="end"
              sideOffset={4}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-1">
                <div className="text-muted-foreground text-[11px]">选择启用状态</div>
                <Select
                  value={enabledFilter}
                  onValueChange={(val) => {
                    const next = val as typeof enabledFilter
                    setEnabledFilter(next)
                    setPageTablePage(1)
                  }}
                >
                  <SelectTrigger className="h-8 w-full px-2 text-xs">
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="enabled">仅启用</SelectItem>
                    <SelectItem value="disabled">仅禁用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
        }
      />,
      '',
    ]
  }, [
    pagedPages,
    selectedPageIds,
    keyFilter,
    nameFilter,
    enabledFilter,
    setSelectedPageIds,
    setKeyFilter,
    setNameFilter,
    setEnabledFilter,
    setPageTablePage,
  ])

  const pageTableRows = useMemo(
    () =>
      pagedPages.map((p) => {
        const actionsCount = (p as any).actionsCount ?? 0
        const elementsCount = (p as any).elementsCount ?? 0
        const hasElementsOnly = (p as any).hasElementsOnly === true
        const checked = selectedPageIds.includes(p.id)
        return [
          <div key={`sel-${p.id}`} className="flex items-center justify-center">
            <Checkbox
              checked={checked}
              onCheckedChange={(value) => {
                setSelectedPageIds((prev) => {
                  const set = new Set(prev)
                  if (value === true) set.add(p.id)
                  else set.delete(p.id)
                  return Array.from(set)
                })
                if (value === true) {
                  onSelectPage(p.id)
                }
              }}
              onClick={(e) => e.stopPropagation()}
              aria-label={`选择页面 ${p.key}`}
            />
          </div>,
          <div key={`key-${p.id}`} className="truncate font-medium text-xs">
            {p.key}
          </div>,
          <div key={`label-${p.id}`} className="truncate text-[11px] text-muted-foreground">
            {p.label}
            {elementsCount > 0 && (
              <span className="ml-1 inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-normal text-amber-700">
                {hasElementsOnly ? '已导入元素 ID，尚未配置动作' : '已导入元素 ID'}
              </span>
            )}
          </div>,
          <span key={`module-${p.id}`} className="truncate text-[11px] text-muted-foreground">
            {p.module}
          </span>,
          <span key={`actions-${p.id}`} className="text-[11px]">
            {actionsCount}
          </span>,
          <span key={`elements-${p.id}`} className="text-[11px]">
            {elementsCount}
          </span>,
          <span key={`enabled-${p.id}`} className="text-[11px]">
            {p.enabled ? '是' : '否'}
          </span>,
          <div key={`ops-${p.id}`} className="flex items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation()
                onOpenDetails(p.id)
              }}
              aria-label={`编辑页面 ${p.key}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation()
                onViewPage(p.id)
              }}
              aria-label={`查看页面 ${p.key}`}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label={`更多操作 ${p.key}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="min-w-[170px]"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuItem
                  className="text-xs"
                  onClick={() => onOpenLib(p)}
                >
                  <FileCode className="mr-2 h-3.5 w-3.5" />
                  在 Libs 中打开
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-xs text-destructive focus:text-destructive"
                  onClick={() => onDeletePage(p)}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>,
        ]
      }),
    [pagedPages, selectedPageIds, setSelectedPageIds, onSelectPage, onOpenDetails, onOpenLib, onViewPage, onDeletePage]
  )

  return (
    <div className="flex flex-col gap-2">
      <TableToolbar
        page={pageTablePage}
        totalPages={pageTableTotalPages}
        totalRows={filteredPages.length}
        pageSize={pageTablePageSize}
        pageSizeMin={10}
        pageSizeMax={200}
        onPageChange={setPageTablePage}
        onPageSizeChange={(size) => {
          setPageTablePageSize(size)
          setPageTablePage(1)
        }}
        rightActions={
          <>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              type="button"
              onClick={onCreatePage}
              aria-label="新增页面"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              size="icon"
              className="h-8 w-8 rounded-full"
              type="button"
              disabled={!selectedPageIds.length || deleting}
              onClick={onBulkDelete}
              aria-label="删除所选页面"
            >
              {deleting ? (
                <Trash2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </>
        }
      />
      <div className="relative min-h-0 flex-1 text-xs">
        <GTable
          headers={pageTableHeaders}
          rows={pageTableRows}
          stickyFirstColumn
          stickyLastColumn
          stickyLastColumnWidthPx={88}
          showFooter={false}
          containerClassName="h-full overflow-x-auto overflow-y-auto"
          onSelectedRow={(rowIndex) => {
            const p = pagedPages[rowIndex]
            if (!p) return
            onSelectPage(p.id)
          }}
          onRowDoubleClick={(rowIndex) => {
            const p = pagedPages[rowIndex]
            if (!p) return
            onOpenDetails(p.id)
          }}
        />
        {!pageTableRows.length && !loadingPages && (
          <p className="text-muted-foreground pointer-events-none absolute inset-x-0 top-12 text-center text-xs">
            暂无匹配的页面，请调整筛选条件或点击右上角 + 按钮新建。
          </p>
        )}
      </div>
    </div>
  )
}
