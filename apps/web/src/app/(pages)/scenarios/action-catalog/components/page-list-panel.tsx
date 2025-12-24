'use client'

import { useMemo, useRef, type Dispatch, type SetStateAction } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { OptionsSelect } from '@/components/select/options-select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  FilePlus2,
  Trash2,
  UploadCloud,
  Eraser,
  SlidersHorizontal,
  Pencil,
  FileCode,
  Eye,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { PageSummary, PlatformSummary } from '../types'
import { PageTable } from '../../components/shared/page-table'

type PageListPanelProps = {
  platform: string
  platforms: PlatformSummary[]
  onPlatformChange: (value: string) => void
  onCreatePlatform: () => void
  onDeletePlatform: () => void
  uploadingWebIds: boolean
  onUploadWebIds: (file: File) => Promise<void>
  clearingWebIds: boolean
  onClearWebIds: () => Promise<void>
  totalElements: number
  filteredPages: PageSummary[]
  pagedPages: PageSummary[]
  selectedPageIds: number[]
  setSelectedPageIds: Dispatch<SetStateAction<number[]>>
  loadingPages: boolean
  deleting: boolean
  onCreatePage: () => void
  onBulkDelete: () => Promise<void>
  onSelectPage: (id: number) => void
  onOpenDetails: (id: number) => void
  onOpenLib: (page: PageSummary) => void
  onViewPage: (id: number) => void
  onDeletePage: (page: PageSummary) => void
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
}

export function PageListPanel({
  platform,
  platforms,
  onPlatformChange,
  onCreatePlatform,
  onDeletePlatform,
  uploadingWebIds,
  onUploadWebIds,
  clearingWebIds,
  onClearWebIds,
  totalElements,
  filteredPages,
  pagedPages,
  selectedPageIds,
  setSelectedPageIds,
  loadingPages,
  deleting,
  onCreatePage,
  onBulkDelete,
  onSelectPage,
  onOpenDetails,
  onOpenLib,
  onViewPage,
  onDeletePage,
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
}: PageListPanelProps) {
  const uploadInputRef = useRef<HTMLInputElement | null>(null)

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
          onClick={(e) => {
            e.stopPropagation()
          }}
          aria-label="选择当前页所有页面"
        />
      </div>,
      <div key="key-head" className="flex items-center justify-between gap-1">
        <span>页面 key</span>
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
      </div>,
      <div key="label-head" className="flex items-center justify-between gap-1">
        <span>名称</span>
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
      </div>,
      '模块',
      '动作数',
      '元素数',
      <div key="enabled-head" className="flex items-center justify-between gap-1">
        <span>启用</span>
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
      </div>,
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
          <div key={`ops-${p.id}`} className="flex items-center gap-1 pl-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
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
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation()
                onOpenLib(p)
              }}
              aria-label={`在 Libs 中打开页面 ${p.key}`}
            >
              <FileCode className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation()
                onViewPage(p.id)
              }}
              aria-label={`查看页面 ${p.key}`}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation()
                onDeletePage(p)
              }}
              aria-label={`删除页面 ${p.key}`}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>,
        ]
      }),
    [pagedPages, selectedPageIds, setSelectedPageIds, onSelectPage, onOpenDetails, onOpenLib, onViewPage, onDeletePage]
  )

  return (
    <Card className="flex min-h-0 flex-1 flex-col min-w-[320px] overflow-hidden">
      <input
        ref={uploadInputRef}
        id="ac-web-ids-upload"
        type="file"
        accept=".csv"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0]
          if (!file) return
          await onUploadWebIds(file)
          event.target.value = ''
        }}
      />
      <CardHeader className="pb-3">
        <CardTitle className="text-base">页面列表（平台映射）</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="space-y-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="ac-platform" className="whitespace-nowrap">
                平台
              </Label>
              <OptionsSelect
                id="ac-platform"
                value={platform}
                items={platforms.map((p) => ({
                  value: p.key,
                  label: p.label,
                }))}
                onSelect={(item) => onPlatformChange(item.value)}
                size="sm"
                triggerClassName="min-w-[140px]"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={onCreatePlatform}
                    aria-label="新增平台"
                  >
                    <FilePlus2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>新增平台</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="h-8 w-8"
                    onClick={onDeletePlatform}
                    disabled={!platforms.some((p) => p.key === platform)}
                    aria-label="删除平台"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>删除平台</TooltipContent>
              </Tooltip>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={() => uploadInputRef.current?.click()}
                    disabled={uploadingWebIds}
                    aria-label="从 CSV 导入"
                  >
                    {uploadingWebIds ? (
                      <UploadCloud className="h-4 w-4 animate-spin" />
                    ) : (
                      <UploadCloud className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>从 CSV 导入</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={onClearWebIds}
                    disabled={clearingWebIds}
                    aria-label="清空当前平台元素 ID"
                  >
                    {clearingWebIds ? (
                      <Eraser className="h-4 w-4 animate-spin" />
                    ) : (
                      <Eraser className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>清空当前平台元素 ID</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <p className="text-muted-foreground text-[11px]">
            支持从 docs/test-plan/web/web-ids.csv 导入页面名称与 data-testid；同一平台下按页面名称归集。
            {totalElements > 0 && (
              <span className="ml-2">
                当前平台已导入元素 ID 共 {totalElements} 个
              </span>
            )}
          </p>
        </div>
        <PageTable
          pagedPages={pagedPages}
          filteredPages={filteredPages}
          selectedPageIds={selectedPageIds}
          setSelectedPageIds={setSelectedPageIds}
          keyFilter={keyFilter}
          setKeyFilter={setKeyFilter}
          nameFilter={nameFilter}
          setNameFilter={setNameFilter}
          enabledFilter={enabledFilter}
          setEnabledFilter={setEnabledFilter}
          pageTablePage={pageTablePage}
          pageTableTotalPages={pageTableTotalPages}
          pageTablePageSize={pageTablePageSize}
          setPageTablePage={setPageTablePage}
          setPageTablePageSize={setPageTablePageSize}
          loadingPages={loadingPages}
          deleting={deleting}
          onCreatePage={onCreatePage}
          onBulkDelete={onBulkDelete}
          onSelectPage={onSelectPage}
          onOpenDetails={onOpenDetails}
          onOpenLib={onOpenLib}
          onViewPage={onViewPage}
          onDeletePage={onDeletePage}
        />
      </CardContent>
    </Card>
  )
}
