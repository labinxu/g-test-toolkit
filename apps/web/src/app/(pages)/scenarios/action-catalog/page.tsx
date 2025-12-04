'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { OptionsSelect, type OptionsSelectItem } from '@/components/select/options-select'
import { OptionsSelectInput } from '@/components/select/options-select-input'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { normalizeResponseError, isUnauthorizedError } from '@/lib/error'
import { toast } from 'sonner'
import {
  Loader2,
  Plus,
  Trash2,
  ChevronsUpDown,
  Eye,
  FileCode,
  Pencil,
  SlidersHorizontal,
  FilePlus2,
  UploadCloud,
  Eraser,
  RefreshCw,
  Save,
} from 'lucide-react'
import { GTable } from '@/components/g-table'
import { useRouter } from 'next/navigation'
import TablePagination from '@/components/table-pagination'
import TableToolbar from '@/components/table-toolbar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type PageSummary = {
  id: number
  platform: string
  key: string
  label: string
  module: string
  className: string
  varName: string
  enabled: boolean
  sortOrder: number
}

type AdminAction = {
  id?: number
  key: string
  label: string
  method: string
  kind: 'action' | 'assert' | 'call'
  defaultExpected?: string | null
  description?: string | null
  enabled: boolean
  sortOrder: number
  locator?: string | null
  returnTarget?: string | null
  params: AdminParam[]
  callSteps?: AdminCallStep[]
}

type AdminPage = {
  id?: number
  platform: string
  key: string
  label: string
  module: string
  className: string
  varName: string
  enabled: boolean
  sortOrder: number
  actions: AdminAction[]
}

type AdminElement = {
  id?: number
  elementId: string
  description?: string | null
  defaultLocator?: string | null
}

type AdminParam = {
  id?: number
  name: string
  type?: string | null
  required: boolean
  placeholder?: string | null
  defaultValue?: string | null
  sortOrder: number
}

type AdminCallStep = {
  targetActionKey: string
  args: string[]
  sortOrder: number
}

type PlatformSummary = {
  id: number
  key: string
  label: string
  libDir?: string | null
  enabled: boolean
  sortOrder: number
}

const getDefaultModuleForPlatform = (plat?: string | null): string => {
  const key = (plat || 'gettr-web').toLowerCase()
  switch (key) {
    case 'gettr-android':
      return 'gettr-android-lib'
    case 'gettr-mobile-web':
      return 'gettr-mobile-web-lib'
    case 'gettr-ios':
      return 'gettr-ios-lib'
    default:
      return 'gettr-web-lib'
  }
}

export default function ActionCatalogSettingsPage() {
  const router = useRouter()
  const [platform, setPlatform] = useState('gettr-web')
  const [platforms, setPlatforms] = useState<PlatformSummary[]>([])
  const [pages, setPages] = useState<PageSummary[]>([])
  const [loadingPages, setLoadingPages] = useState(false)
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null)
  const [selectedPageIds, setSelectedPageIds] = useState<number[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [draft, setDraft] = useState<AdminPage | null>(null)
  const [keyFilter, setKeyFilter] = useState('')
  const [nameFilter, setNameFilter] = useState('')
  const [enabledFilter, setEnabledFilter] = useState<'all' | 'enabled' | 'disabled'>('all')
  const [callSourcePageId, setCallSourcePageId] = useState<number | null>(null)
  const [callSourceActionsByPageId, setCallSourceActionsByPageId] = useState<
    Record<number, AdminAction[]>
  >({})
  const [loadingCallSource, setLoadingCallSource] = useState(false)
  const [viewPageDialogOpen, setViewPageDialogOpen] = useState(false)
  const [viewPageLoading, setViewPageLoading] = useState(false)
  const [viewPageDetail, setViewPageDetail] = useState<AdminPage | null>(null)
  const [uploadingWebIds, setUploadingWebIds] = useState(false)
  const [clearingWebIds, setClearingWebIds] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [pageTablePage, setPageTablePage] = useState(1)
  const [pageTablePageSize, setPageTablePageSize] = useState(20)

  const selectedSummary = useMemo(
    () => pages.find((p) => p.id === selectedPageId) || null,
    [pages, selectedPageId]
  )

  const getLibFilePathForPage = (pageLike: { platform: string; key: string; className: string }) => {
    const plat = (pageLike.platform || platform || 'gettr-web').toLowerCase()
    const platRec = platforms.find((p) => p.key === plat)
    const dirName = (platRec?.libDir || platRec?.key || '').trim()
    if (!dirName) return null
    const baseRaw =
      (pageLike.className || '').replace(/Page$/, '') || pageLike.key || 'page'
    const fileBase = baseRaw.toLowerCase()
    const fileName = `${fileBase}-page.ts`
    return `workspace/shared-libs/${dirName}/src/${fileName}`
  }

  const loadPages = async (plat: string) => {
    try {
      setLoadingPages(true)
      const res = await fetch(`/api/action-catalog/pages?platform=${encodeURIComponent(plat)}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res as any)
        throw new Error(err.message || '获取页面列表失败')
      }
      const data = await res.json()
      const items = Array.isArray(data?.items) ? (data.items as PageSummary[]) : []
      setPages(items)
      setSelectedPageIds((prev) =>
        prev.filter((id) => items.some((p) => p.id === id))
      )
      if (!selectedPageId && items.length) {
        setSelectedPageId(items[0].id)
      }
    } catch (e: any) {
      if (isUnauthorizedError(e)) {
        try {
          router.push('/signin')
        } catch {}
        return
      }
      toast.error(e?.message || '获取页面列表失败')
      setPages([])
      setSelectedPageId(null)
      setDraft(null)
    } finally {
      setLoadingPages(false)
    }
  }

  const loadPlatforms = async () => {
    try {
      const res = await fetch('/api/action-catalog/platforms', { cache: 'no-store' })
      if (!res.ok) {
        const err = await normalizeResponseError(res as any)
        throw new Error(err.message || '获取平台列表失败')
      }
      const data = await res.json()
      const items: PlatformSummary[] = Array.isArray(data?.items) ? data.items : []
      setPlatforms(items)
      if (!items.length) return
      // 如果当前 platform 不在列表中，重置为第一个
      const exists = items.some((p) => p.key === platform)
      if (!exists) {
        setPlatform(items[0]!.key)
      }
    } catch (e: any) {
      if (isUnauthorizedError(e)) {
        try {
          router.push('/signin')
        } catch {}
        return
      }
      toast.error(e?.message || '获取平台列表失败')
    }
  }

  const loadPageDetail = async (id: number) => {
    try {
      setLoadingDetail(true)
      const res = await fetch(`/api/action-catalog/pages/${id}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res as any)
        throw new Error(err.message || '获取页面详情失败')
      }
      const data = (await res.json()) as AdminPage
      const normalizedPlatform = data.platform || platform
      const normalized: AdminPage = {
        id: data.id,
        platform: normalizedPlatform,
        key: data.key || '',
        label: data.label || data.key || '',
        module: data.module || getDefaultModuleForPlatform(normalizedPlatform),
        className: data.className || '',
        varName: data.varName || 'page',
        enabled: data.enabled !== false,
        sortOrder:
          typeof data.sortOrder === 'number' && Number.isFinite(data.sortOrder)
            ? Math.floor(data.sortOrder)
            : 0,
        // elements 仅用于前端辅助选择 locator，不随页面保存回写
        ...(Array.isArray((data as any).elements)
          ? {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              elements: (data as any).elements.map((el: any) => ({
                id: el.id,
                elementId: el.elementId || '',
                description: el.description ?? null,
                defaultLocator: el.defaultLocator ?? null,
              })) as AdminElement[],
            }
          : {}),
        actions: Array.isArray(data.actions)
          ? data.actions.map((a, index) => ({
              id: a.id,
              key: a.key || '',
              label: a.label || a.key || '',
              method: a.method || a.key || '',
              kind:
                (a as any).kind === 'assert'
                  ? 'assert'
                  : (a as any).kind === 'call'
                    ? 'call'
                    : 'action',
              defaultExpected: a.defaultExpected ?? null,
              description: a.description ?? null,
              locator: (a as any).locator ?? null,
              returnTarget: (a as any).returnTarget ?? null,
              enabled: a.enabled !== false,
              sortOrder:
                typeof a.sortOrder === 'number' && Number.isFinite(a.sortOrder)
                  ? Math.floor(a.sortOrder)
                  : index,
              params: Array.isArray((a as any).params)
                ? (a as any).params.map((p: any, pIndex: number) => ({
                    id: p.id,
                    name: p.name || '',
                    type: p.type ?? null,
                    required: p.required === true,
                    placeholder: p.placeholder ?? null,
                    defaultValue: p.defaultValue ?? null,
                    sortOrder:
                      typeof p.sortOrder === 'number' && Number.isFinite(p.sortOrder)
                        ? Math.floor(p.sortOrder)
                        : pIndex,
                  }))
                : [],
              callSteps: Array.isArray((a as any).callSteps)
                ? (a as any).callSteps.map((s: any, sIndex: number) => ({
                    targetActionKey: String(s?.targetActionKey || ''),
                    args: Array.isArray(s?.args)
                      ? s.args.map((v: any) => String(v))
                      : [],
                    sortOrder:
                      typeof s?.sortOrder === 'number' && Number.isFinite(s.sortOrder)
                        ? Math.floor(s.sortOrder)
                        : sIndex,
                  }))
                : [],
            }))
          : [],
      }
      setDraft(normalized)
    } catch (e: any) {
      if (isUnauthorizedError(e)) {
        try {
          router.push('/signin')
        } catch {}
        return
      }
      toast.error(e?.message || '获取页面详情失败')
      setDraft(null)
    } finally {
      setLoadingDetail(false)
    }
  }

  useEffect(() => {
    void loadPlatforms()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void loadPages(platform)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform])

  useEffect(() => {
    if (selectedPageId != null) {
      void loadPageDetail(selectedPageId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPageId])

  const handleCreatePage = () => {
    const baseKey = 'live-stream'
    const usedKeys = new Set(pages.map((p) => p.key))
    let key = baseKey
    let idx = 1
    while (usedKeys.has(key)) {
      key = `${baseKey}-${idx}`
      idx += 1
    }
    const page: AdminPage = {
      id: undefined,
      platform,
      key,
      label: '新页面',
      module: getDefaultModuleForPlatform(platform),
      className: '',
      varName: 'page',
      enabled: true,
      sortOrder: pages.length,
      actions: [],
    }
    setSelectedPageId(null)
    setDraft(page)
    setDetailsOpen(true)
  }

  const handleSave = async () => {
    if (!draft) {
      toast.error('没有要保存的页面')
      return
    }
    if (!draft.key.trim()) {
      toast.error('页面 key 不能为空')
      return
    }
    if (!draft.className.trim()) {
      toast.error('Page 类名（className）不能为空')
      return
    }
    setSaving(true)
    try {
      const payload: AdminPage = {
        ...draft,
        platform,
        actions: (draft.actions || []).map((a, index) => ({
          ...a,
          sortOrder:
            typeof a.sortOrder === 'number' && Number.isFinite(a.sortOrder)
              ? Math.floor(a.sortOrder)
              : index,
          params: (a.params || []).map((p, pIndex) => ({
            ...p,
            sortOrder:
              typeof p.sortOrder === 'number' && Number.isFinite(p.sortOrder)
                ? Math.floor(p.sortOrder)
                : pIndex,
          })),
          callSteps: (a.callSteps || []).map((s, sIndex) => ({
            targetActionKey: s.targetActionKey,
            args: s.args || [],
            sortOrder:
              typeof s.sortOrder === 'number' && Number.isFinite(s.sortOrder)
                ? Math.floor(s.sortOrder)
                : sIndex,
          })),
        })),
      }
      const method = draft.id ? 'PUT' : 'POST'
      const url = draft.id ? `/api/action-catalog/pages/${draft.id}` : `/api/action-catalog/pages`
      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res as any)
        throw new Error(err.message || '保存页面失败')
      }
      const data = (await res.json()) as AdminPage
      // 刷新左侧列表
      await loadPages(platform)
      if (data.id) {
        setSelectedPageId(data.id)
      }
      const libPath = getLibFilePathForPage({
        platform: data.platform || platform,
        key: data.key,
        className: data.className,
      })
      if (libPath) {
        try {
          localStorage.setItem('gtt:libs:lastFile', libPath)
        } catch {}
        toast.success(
          <div className="flex flex-col gap-1">
            <div className="break-all text-xs">页面与动作已保存，对应代码文件：</div>
            <div className="break-all font-mono text-[11px]">{libPath}</div>
            <div className="mt-1">
              <Button
                type="button"
                size="xs"
                variant="outline"
                className="h-6 px-2 text-[11px]"
                onClick={() => {
                  router.push('/testcases/libs')
                }}
              >
                在「Libs」页面中打开
              </Button>
            </div>
          </div>
        )
      } else {
        toast.success('页面与动作已保存')
      }
    } catch (e: any) {
      if (isUnauthorizedError(e)) {
        try {
          router.push('/signin')
        } catch {}
        return
      }
      toast.error(e?.message || '保存页面失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!draft?.id) {
      toast.error('当前页面尚未保存，无法删除')
      return
    }
    const confirmed = window.confirm(`确认删除页面 ${draft.key} 及其所有动作？`)
    if (!confirmed) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/action-catalog/pages/${draft.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res as any)
        throw new Error(err.message || '删除页面失败')
      }
      await loadPages(platform)
      setSelectedPageId(null)
      setDraft(null)
      toast.success('页面已删除')
    } catch (e: any) {
      if (isUnauthorizedError(e)) {
        try {
          router.push('/signin')
        } catch {}
        return
      }
      toast.error(e?.message || '删除页面失败')
    } finally {
      setDeleting(false)
    }
  }

  const handleAddAction = () => {
    if (!draft) return
    const list = draft.actions || []
    const next: AdminAction = {
      key: '',
      label: '',
      method: '',
      kind: 'action',
      defaultExpected: null,
      description: null,
      enabled: true,
      sortOrder: list.length,
      params: [],
    }
    setDraft({ ...draft, actions: [...list, next] })
  }

  const loadCallSourceActions = async (pageId: number): Promise<AdminAction[]> => {
    if (callSourceActionsByPageId[pageId]) {
      return callSourceActionsByPageId[pageId]!
    }
    try {
      setLoadingCallSource(true)
      const res = await fetch(`/api/action-catalog/pages/${pageId}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res as any)
        throw new Error(err.message || '获取来源页面详情失败')
      }
      const data = (await res.json()) as AdminPage
      const normalizedActions: AdminAction[] = Array.isArray(data.actions)
        ? data.actions.map((a, index) => ({
            id: a.id,
            key: a.key || '',
            label: a.label || a.key || '',
            method: a.method || a.key || '',
            kind:
              (a as any).kind === 'assert'
                ? 'assert'
                : (a as any).kind === 'call'
                  ? 'call'
                  : 'action',
            defaultExpected: a.defaultExpected ?? null,
            description: a.description ?? null,
            locator: (a as any).locator ?? null,
            returnTarget: (a as any).returnTarget ?? null,
            enabled: a.enabled !== false,
            sortOrder:
              typeof a.sortOrder === 'number' && Number.isFinite(a.sortOrder)
                ? Math.floor(a.sortOrder)
                : index,
            params: Array.isArray((a as any).params)
              ? (a as any).params.map((p: any, pIndex: number) => ({
                  id: p.id,
                  name: p.name || '',
                  type: p.type ?? null,
                  required: p.required === true,
                  placeholder: p.placeholder ?? null,
                  defaultValue: p.defaultValue ?? null,
                  sortOrder:
                    typeof p.sortOrder === 'number' && Number.isFinite(p.sortOrder)
                      ? Math.floor(p.sortOrder)
                      : pIndex,
                }))
              : [],
          }))
        : []
      setCallSourceActionsByPageId((prev) => ({
        ...prev,
        [pageId]: normalizedActions,
      }))
      return normalizedActions
    } catch (e: any) {
      if (isUnauthorizedError(e)) {
        try {
          router.push('/signin')
        } catch {}
        return []
      }
      toast.error(e?.message || '获取来源页面详情失败')
      return []
    } finally {
      setLoadingCallSource(false)
    }
  }

  const handleViewPage = async (pageId: number) => {
    setViewPageDialogOpen(true)
    setViewPageLoading(true)
    setViewPageDetail(null)
    try {
      const res = await fetch(`/api/action-catalog/pages/${pageId}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res as any)
        throw new Error(err.message || '获取页面详情失败')
      }
      const data = (await res.json()) as AdminPage
      setViewPageDetail(data)
    } catch (e: any) {
      if (isUnauthorizedError(e)) {
        try {
          router.push('/signin')
        } catch {}
        return
      }
      toast.error(e?.message || '获取页面详情失败')
      setViewPageDetail(null)
    } finally {
      setViewPageLoading(false)
    }
  }

  const handleUpdateAction = (index: number, patch: Partial<AdminAction>) => {
    if (!draft) return
    const list = draft.actions || []
    const next = list.map((a, i) => (i === index ? { ...a, ...patch } : a))
    setDraft({ ...draft, actions: next })
  }

  const handleDeleteAction = (index: number) => {
    if (!draft) return
    const list = draft.actions || []
    const next = list.filter((_, i) => i !== index).map((a, i) => ({ ...a, sortOrder: i }))
    setDraft({ ...draft, actions: next })
  }

  const currentActions = draft?.actions || []
  const filteredPages = useMemo(() => {
    const ft = keyFilter.trim().toLowerCase()
    const nameFt = nameFilter.trim().toLowerCase()
    return pages.filter((p) => {
      if (ft) {
        const keyHit = p.key.toLowerCase().includes(ft)
        const labelHit = (p.label || '').toLowerCase().includes(ft)
        if (!keyHit && !labelHit) return false
      }
      if (nameFt) {
        if (!(p.label || '').toLowerCase().includes(nameFt)) return false
      }
      if (enabledFilter === 'enabled' && !p.enabled) return false
      if (enabledFilter === 'disabled' && p.enabled) return false
      return true
    })
  }, [pages, keyFilter, nameFilter, enabledFilter])

  const totalElements = useMemo(
    () =>
      pages.reduce(
        (sum, p) => sum + (((p as any).elementsCount as number | undefined) ?? 0),
        0
      ),
    [pages]
  )

  const pageTableTotalPages = useMemo(
    () =>
      Math.max(
        1,
        Math.ceil(
          Math.max(0, filteredPages.length) / Math.max(1, Math.floor(pageTablePageSize) || 1)
        )
      ),
    [filteredPages.length, pageTablePageSize]
  )

  const safePageTablePage = useMemo(
    () => Math.max(1, Math.min(pageTableTotalPages, pageTablePage)),
    [pageTablePage, pageTableTotalPages]
  )

  const pagedPages = useMemo(() => {
    const start = (safePageTablePage - 1) * Math.max(1, pageTablePageSize)
    const end = start + Math.max(1, pageTablePageSize)
    return filteredPages.slice(start, end)
  }, [filteredPages, safePageTablePage, pageTablePageSize])

  const pageTableHeaders = useMemo<ReactNode[]>(() => {
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
      '', // 操作列不再显示表头文字
    ]
  }, [pagedPages, selectedPageIds, keyFilter, nameFilter, enabledFilter])

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
                  setSelectedPageId(p.id)
                }
              }}
              onClick={(e) => {
                e.stopPropagation()
              }}
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
                setSelectedPageId(p.id)
                setDetailsOpen(true)
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
                const libPath = getLibFilePathForPage({
                  platform: p.platform,
                  key: p.key,
                  className: p.className,
                })
                if (!libPath) {
                  toast.error('当前平台未配置 libDir，无法定位对应 libs 文件')
                  return
                }
                try {
                  localStorage.setItem('gtt:libs:lastFile', libPath)
                } catch {}
                router.push('/testcases/libs')
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
                void handleViewPage(p.id)
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
                void handleDeletePage(p)
              }}
              aria-label={`删除页面 ${p.key}`}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>,
        ]
      }),
    [pagedPages, router, selectedPageIds]
  )

  const handleAddParam = (actionIndex: number) => {
    if (!draft) return
    const actions = draft.actions || []
    const target = actions[actionIndex]
    if (!target) return
    const params = target.params || []
    const nextParam: AdminParam = {
      name: '',
      type: 'string',
      required: false,
      placeholder: null,
      defaultValue: null,
      sortOrder: params.length,
    }
    const nextActions = actions.map((a, i) =>
      i === actionIndex ? { ...a, params: [...params, nextParam] } : a
    )
    setDraft({ ...draft, actions: nextActions })
  }

  const handleUpdateParam = (
    actionIndex: number,
    paramIndex: number,
    patch: Partial<AdminParam>
  ) => {
    if (!draft) return
    const actions = draft.actions || []
    const target = actions[actionIndex]
    if (!target) return
    const params = target.params || []
    const nextParams = params.map((p, i) => (i === paramIndex ? { ...p, ...patch } : p))
    const nextActions = actions.map((a, i) =>
      i === actionIndex ? { ...a, params: nextParams } : a
    )
    setDraft({ ...draft, actions: nextActions })
  }

  const handleDeleteParam = (actionIndex: number, paramIndex: number) => {
    if (!draft) return
    const actions = draft.actions || []
    const target = actions[actionIndex]
    if (!target) return
    const params = target.params || []
    const nextParams = params
      .filter((_, i) => i !== paramIndex)
      .map((p, i) => ({ ...p, sortOrder: i }))
    const nextActions = actions.map((a, i) =>
      i === actionIndex ? { ...a, params: nextParams } : a
    )
    setDraft({ ...draft, actions: nextActions })
  }

  const handleDeletePage = async (page: PageSummary) => {
    const confirmed = window.confirm(
      `确认删除页面 ${page.key}？将同时删除其所有动作。`
    )
    if (!confirmed) return
    try {
      const res = await fetch(`/api/action-catalog/pages/${page.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res as any)
        throw new Error(err.message || '删除页面失败')
      }
      await loadPages(platform)
      if (selectedPageId === page.id) {
        setSelectedPageId(null)
        setDraft(null)
      }
      toast.success(`页面 ${page.key} 已删除`)
    } catch (e: any) {
      if (isUnauthorizedError(e)) {
        try {
          router.push('/signin')
        } catch {}
        return
      }
      toast.error(e?.message || '删除页面失败')
    }
  }

  const handleCreatePlatform = async () => {
    const keyRaw = window
      .prompt('请输入平台 key（例如：gettr-web）')
      ?.trim()
    if (!keyRaw) return
    const labelRaw =
      window.prompt('请输入平台名称（显示用，例如：GETTR Web）')?.trim() || keyRaw
    const libDirRaw =
      window
        .prompt('请输入 shared-libs 下的子目录名（例如：gettr-web）')
        ?.trim() || keyRaw
    try {
      const res = await fetch('/api/action-catalog/platforms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          key: keyRaw,
          label: labelRaw,
          libDir: libDirRaw,
        }),
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res as any)
        throw new Error(err.message || '创建平台失败')
      }
      await loadPlatforms()
      toast.success('平台已创建')
    } catch (e: any) {
      if (isUnauthorizedError(e)) {
        try {
          router.push('/signin')
        } catch {}
        return
      }
      toast.error(e?.message || '创建平台失败')
    }
  }

  const handleDeletePlatform = async () => {
    const current = platforms.find((p) => p.key === platform)
    if (!current) {
      toast.error('当前平台不存在')
      return
    }
    const confirmed = window.confirm(
      `确认删除平台 ${current.key}？如有页面使用该平台，需先删除对应页面。`
    )
    if (!confirmed) return
    try {
      const res = await fetch(`/api/action-catalog/platforms/${current.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res as any)
        throw new Error(err.message || '删除平台失败')
      }
      await loadPlatforms()
      // 重置当前平台、页面和详情
      const nextPlat = platforms.find((p) => p.id !== current.id)
      setPlatform(nextPlat?.key || '')
      setSelectedPageId(null)
      setDraft(null)
      toast.success('平台已删除')
    } catch (e: any) {
      if (isUnauthorizedError(e)) {
        try {
          router.push('/signin')
        } catch {}
        return
      }
      toast.error(e?.message || '删除平台失败')
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-row gap-2 p-2">
      <Card className="flex min-h-0 flex-1 flex-col min-w-[320px] overflow-hidden">
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
                  onSelect={(item) => {
                    setPlatform(item.value)
                    setSelectedPageId(null)
                    setDraft(null)
                    setPageTablePage(1)
                  }}
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
                      onClick={handleCreatePlatform}
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
                      onClick={handleDeletePlatform}
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
              <input
                id="ac-web-ids-upload"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  setUploadingWebIds(true)
                  try {
                    const formData = new FormData()
                    formData.append('file', file)
                    formData.append('platform', platform || 'gettr-web')
                    const res = await fetch('/api/action-catalog/web-ids/upload', {
                      method: 'POST',
                      body: formData,
                    })
                    if (!res.ok) {
                      const err = await normalizeResponseError(res as any)
                      throw new Error(err.message || '导入页面元素 ID 失败')
                    }
                    const data = (await res.json()) as {
                      pagesCreated?: number
                      elementsCreated?: number
                      elementsUpdated?: number
                    }
                    const created = data?.elementsCreated ?? 0
                    const updated = data?.elementsUpdated ?? 0
                    const pagesCreated = data?.pagesCreated ?? 0
                    toast.success(
                      `导入完成：新建页面 ${pagesCreated} 个，新增元素 ${created} 个，更新元素 ${updated} 个`
                    )
                    await loadPages(platform)
                  } catch (e: any) {
                    toast.error(e?.message || '导入页面元素 ID 失败')
                  } finally {
                    setUploadingWebIds(false)
                    event.target.value = ''
                  }
                }}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={() => {
                      const input = document.getElementById(
                        'ac-web-ids-upload'
                      ) as HTMLInputElement | null
                      input?.click()
                    }}
                    disabled={uploadingWebIds}
                    aria-label="从 CSV 导入"
                  >
                    {uploadingWebIds ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
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
                    onClick={async () => {
                      const confirmed = window.confirm(
                        `确认删除平台 ${platform} 下所有已导入的页面元素 ID？不会删除页面和动作。`
                      )
                      if (!confirmed) return
                      setClearingWebIds(true)
                      try {
                        const qs = new URLSearchParams()
                        if (platform) qs.set('platform', platform)
                        const res = await fetch(
                          `/api/action-catalog/web-ids?${qs.toString()}`,
                          { method: 'DELETE' }
                        )
                        if (!res.ok) {
                          const err = await normalizeResponseError(res as any)
                          throw new Error(err.message || '清空页面元素 ID 失败')
                        }
                        const data = (await res.json()) as { deleted?: number }
                        toast.success(
                          `已删除当前平台下的元素 ID 共 ${data?.deleted ?? 0} 个；可重新导入 CSV。`
                        )
                        await loadPages(platform)
                      } catch (e: any) {
                        toast.error(e?.message || '清空页面元素 ID 失败')
                      } finally {
                        setClearingWebIds(false)
                      }
                    }}
                    disabled={clearingWebIds}
                    aria-label="清空当前平台元素 ID"
                  >
                    {clearingWebIds ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
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
          <TableToolbar
            page={safePageTablePage}
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      type="button"
                      onClick={handleCreatePage}
                      aria-label="新增页面"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>新增页面</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      type="button"
                      disabled={!selectedPageIds.length || deleting}
                      onClick={async () => {
                        if (!selectedPageIds.length) return
                        const targets = pages.filter((p) => selectedPageIds.includes(p.id))
                        if (!targets.length) return
                        const confirmed = window.confirm(
                          `确认删除选中的 ${targets.length} 个页面？将同时删除其所有动作。`
                        )
                        if (!confirmed) return
                        try {
                          setDeleting(true)
                          for (const page of targets) {
                            const res = await fetch(`/api/action-catalog/pages/${page.id}`, {
                              method: 'DELETE',
                            })
                            if (!res.ok) {
                              const err = await normalizeResponseError(res as any)
                              throw new Error(err.message || '删除页面失败')
                            }
                          }
                          await loadPages(platform)
                          setSelectedPageId(null)
                          setSelectedPageIds([])
                          setDraft(null)
                          toast.success(`已删除选中的 ${targets.length} 个页面`)
                        } catch (e: any) {
                          if (isUnauthorizedError(e)) {
                            try {
                              router.push('/signin')
                            } catch {}
                          } else {
                            toast.error(e?.message || '删除页面失败')
                          }
                        } finally {
                          setDeleting(false)
                        }
                      }}
                      aria-label="删除所选页面"
                    >
                      {deleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>删除所选页面</TooltipContent>
                </Tooltip>
              </>
            }
          />
          <div className="relative min-h-0 flex-1 text-xs">
            <GTable
              headers={pageTableHeaders}
              rows={pageTableRows}
              stickyFirstColumn
              showFooter={false}
              containerClassName="h-full overflow-x-auto overflow-y-auto"
              onSelectedRow={(rowIndex) => {
                const p = pagedPages[rowIndex]
                if (!p) return
                setSelectedPageId(p.id)
              }}
              onRowDoubleClick={(rowIndex) => {
                const p = pagedPages[rowIndex]
                if (!p) return
                setSelectedPageId(p.id)
                setDetailsOpen(true)
              }}
            />
            {!pageTableRows.length && !loadingPages && (
              <p className="text-muted-foreground pointer-events-none absolute inset-x-0 top-12 text-center text-xs">
                暂无匹配的页面，请调整筛选条件或点击右上角 + 按钮新建。
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent side="right" className="flex h-full w-full flex-col sm:max-w-4xl">
          <SheetHeader>
            <SheetTitle>页面与动作详情</SheetTitle>
            {draft?.id != null && (
              <SheetDescription>
                页面 ID：{draft.id}。为对应 Page 类配置 key、类名与动作列表，供用户场景步骤复用。
              </SheetDescription>
            )}
          </SheetHeader>
          <Card className="mt-3 flex min-h-0 flex-1 flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">页面与动作详情</CardTitle>
              <p className="text-muted-foreground mt-1 text-xs">
                为 shared-libs 中的 Page 类配置页面 key、类名与动作列表，供「用户场景」页面在添加步骤时复用。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={() => draft && loadPageDetail(draft.id!)}
                    aria-label="刷新详情"
                    disabled={!draft}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>刷新详情</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    onClick={handleSave}
                    disabled={saving || !draft}
                    aria-label="保存页面"
                    className="h-8 w-8"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>保存页面</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={!draft?.id || deleting}
                    aria-label="删除页面"
                    className="h-8 w-8"
                  >
                    {deleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>删除页面</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
          {!draft && (
            <p className="text-muted-foreground text-sm">
              请在左侧选择一个页面，或点击「+」新建页面。
            </p>
          )}
          {draft && (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="ac-key">页面 key</Label>
                  <Input
                    id="ac-key"
                    value={draft.key}
                    onChange={(e) => setDraft({ ...draft, key: e.target.value })}
                    placeholder="例如：live-stream"
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ac-label">页面名称</Label>
                  <Input
                    id="ac-label"
                    value={draft.label}
                    onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                    placeholder="例如：直播 Studio（Web）"
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ac-module">模块名（module）</Label>
                  <Input
                    id="ac-module"
                    value={draft.module}
                    onChange={(e) => setDraft({ ...draft, module: e.target.value })}
                    placeholder="gettr-web-lib"
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ac-class">Page 类名（className）</Label>
                  <Input
                    id="ac-class"
                    value={draft.className}
                    onChange={(e) => setDraft({ ...draft, className: e.target.value })}
                    placeholder="例如：LiveStreamPage"
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ac-var">变量名（varName）</Label>
                  <Input
                    id="ac-var"
                    value={draft.varName}
                    onChange={(e) => setDraft({ ...draft, varName: e.target.value })}
                    placeholder="生成代码时使用的变量名，例如：live"
                    className="h-8"
                  />
              </div>
              <div className="space-y-1">
                  <Label htmlFor="ac-sort">排序（sortOrder）</Label>
                  <Input
                    id="ac-sort"
                    type="number"
                    value={draft.sortOrder}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        sortOrder: Number(e.target.value || 0),
                      })
                    }
                    className="h-8"
                  />
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">动作列表</div>
                <p className="text-muted-foreground text-xs">
                  每个动作会映射到 Page 类上的一个方法，用于「添加步骤」对话框与代码生成。
                </p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={handleAddAction}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                新增动作
              </Button>
            </div>

              <div className="space-y-3">
                {currentActions.map((a, index) => (
                  <Collapsible
                    key={`${a.id ?? 'new'}-${index}`}
                    defaultOpen
                    className="rounded-md border text-xs"
                  >
                    <div className="flex items-center justify-between gap-2 px-3 py-2">
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="flex flex-1 items-center justify-between text-left"
                        >
                          <div className="font-medium">
                            动作 {index + 1}{' '}
                            {a.key ? (
                              <span className="text-muted-foreground">({a.key})</span>
                            ) : null}
                          </div>
                          <ChevronsUpDown className="text-muted-foreground ml-2 h-3.5 w-3.5" />
                        </button>
                      </CollapsibleTrigger>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleDeleteAction(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <CollapsibleContent className="border-t px-3 py-3">
                      <div className="grid gap-2 md:grid-cols-3">
                        <div className="space-y-1">
                          <Label className="text-[11px]">key</Label>
                          <Input
                            className="h-8"
                            value={a.key}
                            onChange={(e) => handleUpdateAction(index, { key: e.target.value })}
                            placeholder="例如：hostOpenStudioFromHome"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">名称（label）</Label>
                          <Input
                            className="h-8"
                            value={a.label}
                            onChange={(e) =>
                              handleUpdateAction(index, {
                                label: e.target.value,
                              })
                            }
                            placeholder="例如：主播：从首页进入 Studio"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">方法名（method）</Label>
                          <Input
                            className="h-8"
                            value={a.method}
                            onChange={(e) =>
                              handleUpdateAction(index, {
                                method: e.target.value,
                              })
                            }
                            placeholder="例如：hostOpenStudioFromHome"
                          />
                        </div>
                      </div>
                      <div className="mt-2 grid gap-2 md:grid-cols-3">
                        <div className="space-y-1">
                          <Label className="text-[11px]">类型（kind）</Label>
                          <OptionsSelect<'action' | 'assert' | 'call'>
                            value={a.kind}
                            size="sm"
                            items={[
                              { value: 'action', label: '动作（action）' },
                              { value: 'assert', label: '断言（assert）' },
                              { value: 'call', label: '函数调用（call）' },
                            ]}
                            onSelect={(item) => handleUpdateAction(index, { kind: item.value })}
                            contentClassName="w-[180px]"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">排序（sortOrder）</Label>
                          <Input
                            className="h-8"
                            type="number"
                            value={a.sortOrder}
                            onChange={(e) =>
                              handleUpdateAction(index, {
                                sortOrder: Number(e.target.value || 0),
                              })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">启用</Label>
                          <OptionsSelect<'true' | 'false'>
                            value={a.enabled ? 'true' : 'false'}
                            size="sm"
                            items={[
                              { value: 'true', label: '是' },
                              { value: 'false', label: '否' },
                            ]}
                            onSelect={(item) =>
                              handleUpdateAction(index, {
                                enabled: item.value === 'true',
                              })
                            }
                            contentClassName="w-[120px]"
                          />
                        </div>
                      </div>
                      {a.kind === 'call' && (
                        <div className="mt-2 space-y-3">
                          <p className="text-[11px] text-muted-foreground">
                            函数调用类型：通常对应在 Page 类中手写的组合方法（例如
                            <span className="mx-0.5 font-mono text-[10px]">loginWithUsername</span>
                            ），生成代码时会输出一行
                            <span className="mx-0.5 font-mono text-[10px]">
                              await {draft?.varName || 'page'}.{a.method || 'method'}(...)
                            </span>
                            。你可以直接填写方法名和参数，或从任意页面已有动作中复制方法签名。
                          </p>
                          <div className="mt-1 grid gap-2 md:grid-cols-3">
                            <div className="space-y-1">
                              <Label className="text-[11px]">来源页面（可选）</Label>
                              <OptionsSelect<string>
                                value={
                                  callSourcePageId != null
                                    ? String(callSourcePageId)
                                    : draft?.id != null
                                      ? String(draft.id)
                                      : ''
                                }
                                items={[
                                  ...(draft?.id
                                    ? (() => {
                                        const curSummary =
                                          pages.find((p) => p.id === draft.id) || null
                                        return [
                                          {
                                            value: String(draft.id),
                                            label: `当前页面：${
                                              curSummary?.label || draft.label || draft.key
                                            }`,
                                          },
                                        ]
                                      })()
                                    : []),
                                  ...pages
                                    .filter((p) => (draft?.id ? p.id !== draft.id : true))
                                    .map((p) => ({
                                      value: String(p.id),
                                      label: p.label,
                                    })),
                                ]}
                                onSelect={(item) => {
                                  const idNum = Number(item.value)
                                  if (!Number.isFinite(idNum)) {
                                    setCallSourcePageId(null)
                                    return
                                  }
                                  setCallSourcePageId(idNum)
                                  if (!draft?.id || idNum !== draft.id) {
                                    void loadCallSourceActions(idNum)
                                  }
                                }}
                                placeholder="选择一个来源页面"
                                size="sm"
                                triggerClassName="text-[11px]"
                                contentClassName="w-[260px]"
                              />
                            </div>
                            <div className="space-y-1 md:col-span-2">
                              <Label className="text-[11px]">
                                从来源页面已有动作复制（可选）
                              </Label>
                              <OptionsSelect<string>
                                value=""
                                disabled={
                                  loadingCallSource ||
                                  (!currentActions.length &&
                                    (!callSourcePageId ||
                                      !callSourceActionsByPageId[callSourcePageId]))
                                }
                                items={(() => {
                                  const sourcePageId =
                                    callSourcePageId != null
                                      ? callSourcePageId
                                      : draft?.id != null
                                        ? draft.id
                                        : null
                                  const sourceActions =
                                    sourcePageId != null && draft?.id != null
                                      ? sourcePageId === draft.id
                                        ? currentActions
                                        : callSourceActionsByPageId[sourcePageId] || []
                                      : currentActions
                                  return sourceActions
                                    .map((other, otherIndex) => ({
                                      other,
                                      otherIndex,
                                    }))
                                    .map(({ other, otherIndex }) => ({
                                      value: String(otherIndex),
                                      label:
                                        (other.method || other.key || 'action') +
                                        (other.label ? ` · ${other.label}` : ''),
                                    }))
                                })()}
                                onSelect={(item) => {
                                  const srcIndex = Number(item.value)
                                  if (!Number.isFinite(srcIndex)) return
                                  const sourcePageId =
                                    callSourcePageId != null
                                      ? callSourcePageId
                                      : draft?.id != null
                                        ? draft.id
                                        : null
                                  const sourceActions =
                                    sourcePageId != null && draft?.id != null
                                      ? sourcePageId === draft.id
                                        ? currentActions
                                        : callSourceActionsByPageId[sourcePageId] || []
                                      : currentActions
                                  const src = sourceActions[srcIndex]
                                  if (!src) return
                                  handleUpdateAction(index, {
                                    method: src.method,
                                    key: a.key || src.key,
                                    label: a.label || src.label,
                                    params: (src.params || []).map((p, pIndex) => ({
                                      id: undefined,
                                      name: p.name,
                                      type: p.type ?? 'string',
                                      required: !!p.required,
                                      placeholder: p.placeholder ?? null,
                                      defaultValue: p.defaultValue ?? null,
                                      sortOrder: pIndex,
                                    })),
                                  })
                                }}
                                placeholder={
                                  loadingCallSource
                                    ? '来源页面加载中…'
                                    : '选择一个已有动作以复制方法和参数'
                                }
                                size="sm"
                                triggerClassName="text-[11px]"
                                contentClassName="w-[260px]"
                              />
                            </div>
                          </div>
                          <div className="rounded-md border px-2 py-2">
                            <div className="mb-1 flex items-center justify-between">
                              <Label className="text-[11px]">内部调用序列（可选）</Label>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-[11px]"
                                onClick={() => {
                                  const steps = a.callSteps || []
                                  const nextStep: AdminCallStep = {
                                    targetActionKey:
                                      steps[steps.length - 1]?.targetActionKey ||
                                      (currentActions.find(
                                        (x, idx) => idx !== index && x.method,
                                      )?.key || ''),
                                    args: [],
                                    sortOrder: steps.length,
                                  }
                                  handleUpdateAction(index, {
                                    callSteps: [...steps, nextStep],
                                  })
                                }}
                              >
                                <Plus className="mr-1 h-3 w-3" />
                                新增内部步骤
                              </Button>
                            </div>
                            <p className="mb-1 text-[11px] text-muted-foreground">
                              按顺序调用当前 Page 上的多个方法；参数可以填写当前函数的参数名（例如
                              <span className="mx-0.5 font-mono text-[10px]">username</span>）或字面量（例如
                              <span className="mx-0.5 font-mono text-[10px]">'qa_lb'</span>）。
                            </p>
                            <div className="space-y-1">
                              {(a.callSteps || []).map((step, sIndex) => {
                                const targetAction =
                                  currentActions.find((other) => other.key === step.targetActionKey) ||
                                  null
                                const targetParams = targetAction?.params || []
                                const args = step.args || []
                                return (
                                  <div
                                    key={`${step.targetActionKey}-${sIndex}`}
                                    className="flex flex-col gap-1 rounded border px-2 py-1.5"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex flex-1 items-center gap-2">
                                        <span className="text-[11px] text-muted-foreground">
                                          步骤 {sIndex + 1}
                                        </span>
                                          <OptionsSelect<string>
                                            value={step.targetActionKey}
                                          items={currentActions.map((other) => ({
                                            value: other.key,
                                            label:
                                              (other.method || other.key || 'action') +
                                              (other.label ? ` · ${other.label}` : ''),
                                          }))}
                                            onSelect={(item) => {
                                              const nextSteps = [...(a.callSteps || [])]
                                              nextSteps[sIndex] = {
                                                ...step,
                                                targetActionKey: item.value,
                                              }
                                              handleUpdateAction(index, { callSteps: nextSteps })
                                            }}
                                            placeholder="选择一个方法"
                                            size="sm"
                                            triggerClassName="text-[11px]"
                                            contentClassName="w-[260px]"
                                          />
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Input
                                          className="h-8 w-16 text-[11px]"
                                          type="number"
                                          value={step.sortOrder}
                                          onChange={(e) => {
                                            const so = Number(e.target.value || 0)
                                            const nextSteps = [...(a.callSteps || [])]
                                            nextSteps[sIndex] = {
                                              ...step,
                                              sortOrder: Number.isFinite(so) ? so : sIndex,
                                            }
                                            handleUpdateAction(index, { callSteps: nextSteps })
                                          }}
                                        />
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="ghost"
                                          className="h-6 w-6"
                                          onClick={() => {
                                            const nextSteps = (a.callSteps || [])
                                              .filter((_, i) => i !== sIndex)
                                              .map((st, newIdx) => ({
                                                ...st,
                                                sortOrder: newIdx,
                                              }))
                                            handleUpdateAction(index, { callSteps: nextSteps })
                                          }}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </div>
                                    <div className="mt-1 grid gap-1 md:grid-cols-3">
                                      {targetParams.length === 0 && (
                                        <div className="md:col-span-3">
                                          <p className="text-[11px] text-muted-foreground">
                                            该方法无参数，无需映射。
                                          </p>
                                        </div>
                                      )}
                                      {targetParams.map((tp, pIndex) => (
                                        <div key={`${tp.name}-${pIndex}`} className="space-y-1">
                                          <Label className="text-[11px]">
                                            参数 {pIndex + 1}（{tp.name}）
                                          </Label>
                                          <OptionsSelect<string>
                                            value={
                                              args[pIndex] && args[pIndex].trim().length > 0
                                                ? args[pIndex]
                                                : 'none'
                                            }
                                            items={[
                                              { value: 'none', label: '（不传此参数）' },
                                              ...(a.params || [])
                                                .map((mp) => mp.name)
                                                .filter((name) => name && name.trim().length > 0)
                                                .map((name) => ({
                                                  value: name,
                                                  label: name,
                                                })),
                                            ]}
                                            onSelect={(item) => {
                                              const nextArgs = [...args]
                                              nextArgs[pIndex] =
                                                item.value === 'none' ? '' : item.value
                                              const nextSteps = [...(a.callSteps || [])]
                                              nextSteps[sIndex] = {
                                                ...step,
                                                args: nextArgs,
                                              }
                                              handleUpdateAction(index, { callSteps: nextSteps })
                                            }}
                                            placeholder="选择要传入的参数名"
                                            size="sm"
                                            triggerClassName="text-[11px]"
                                            contentClassName="w-[220px]"
                                          />
                                          {!(a.params || []).length && (
                                            <p className="text-[10px] text-muted-foreground">
                                              当前函数尚未定义参数，如需映射，请先在上方「参数列表」中新增参数。
                                            </p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )
                              })}
                              {!(a.callSteps || []).length && (
                                <p className="text-[11px] text-muted-foreground">
                                  暂无内部步骤。可通过上方「新增内部步骤」按钮，为该函数依次调用当前
                                  Page 中的其它方法。
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="mt-2 space-y-1">
                        <Label className="text-[11px]">默认期望结果（defaultExpected）</Label>
                        <Textarea
                          rows={2}
                          className="text-xs"
                          value={a.defaultExpected || ''}
                          onChange={(e) =>
                            handleUpdateAction(index, {
                              defaultExpected: e.target.value || null,
                            })
                          }
                          placeholder="例如：页面在 30 秒内显示“直播中”状态。"
                        />
                      </div>
                      <div className="mt-2 space-y-1">
                        <Label className="text-[11px]">说明（description，可选）</Label>
                        <Textarea
                          rows={2}
                          className="text-xs"
                          value={a.description || ''}
                          onChange={(e) =>
                            handleUpdateAction(index, {
                              description: e.target.value || null,
                            })
                          }
                          placeholder="用于补充该动作对应的业务含义或使用建议。"
                        />
                      </div>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-[11px]">元素定位字符串（locator，可选）</Label>
                          <OptionsSelectInput<string>
                            id={`ac-action-${index}-locator`}
                            value={a.locator || ''}
                            onChange={(value) =>
                              handleUpdateAction(index, {
                                locator: value || null,
                              })
                            }
                            items={
                              Array.isArray((draft as any)?.elements)
                                ? ((draft as any).elements as AdminElement[]).map((el) => ({
                                    value: el.defaultLocator || `[data-testid="${el.elementId}"]`,
                                    label: el.description
                                      ? `${el.elementId} — ${el.description}`
                                      : el.elementId,
                                  }))
                                : []
                            }
                            placeholder='可选择已导入的 data-testid，或直接输入 CSS/XPath，例如：[data-testid="login_button"]'
                            className="w-full"
                            size="sm"
                            inputClassName="text-[11px]"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">返回对象（returnTarget）</Label>
                          <OptionsSelect<string>
                            value={a.returnTarget || 'this'}
                            items={[
                              {
                                value: 'this',
                                label: 'this（返回当前页面实例）',
                              },
                              ...pages.map((p) => ({
                                value: p.className,
                                label: `${p.label || p.key}（${p.className}）`,
                              })),
                            ]}
                            onSelect={(item) =>
                              handleUpdateAction(index, {
                                returnTarget: item.value,
                              })
                            }
                            size="sm"
                            triggerClassName="text-[11px]"
                            contentClassName="w-[220px]"
                          />
                        </div>
                      </div>
                      <div className="mt-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-[11px]">参数列表（可选）</Label>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="px-2 text-[11px]"
                            onClick={() => handleAddParam(index)}
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            新增参数
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {(a.params || []).map((p, pIndex) => (
                            <div
                              key={`${p.id ?? 'new'}-${pIndex}`}
                              className="flex flex-wrap items-center gap-2 rounded border px-2 py-1.5"
                            >
                              <div className="flex min-w-[120px] flex-1 flex-col gap-1">
                                <Label className="text-[11px]">name</Label>
                                <Input
                                  className="h-8 text-[11px]"
                                  value={p.name}
                                  onChange={(e) =>
                                    handleUpdateParam(index, pIndex, {
                                      name: e.target.value,
                                    })
                                  }
                                  placeholder="例如：timeoutMs"
                                />
                              </div>
                              <div className="flex w-[120px] flex-col gap-1">
                                <Label className="text-[11px]">类型</Label>
                                <OptionsSelect<'string' | 'number' | 'boolean'>
                                  value={(p.type as any) || 'string'}
                                  items={[
                                    { value: 'string', label: 'string' },
                                    { value: 'number', label: 'number' },
                                    { value: 'boolean', label: 'boolean' },
                                  ]}
                                  onSelect={(item) =>
                                    handleUpdateParam(index, pIndex, {
                                      type: item.value,
                                    })
                                  }
                                  size="sm"
                                  triggerClassName="text-[11px]"
                                  contentClassName="w-[120px]"
                                />
                              </div>
                              <div className="flex w-[90px] flex-col gap-1">
                                <Label className="text-[11px]">必填</Label>
                                <OptionsSelect<'true' | 'false'>
                                  value={p.required ? 'true' : 'false'}
                                  items={[
                                    { value: 'true', label: '是' },
                                    { value: 'false', label: '否' },
                                  ]}
                                  onSelect={(item) =>
                                    handleUpdateParam(index, pIndex, {
                                      required: item.value === 'true',
                                    })
                                  }
                                  size="sm"
                                  triggerClassName="text-[11px]"
                                  contentClassName="w-[120px]"
                                />
                              </div>
                              <div className="flex min-w-[140px] flex-1 flex-col gap-1">
                                <Label className="text-[11px]">placeholder</Label>
                                <Input
                                  className="h-8 text-[11px]"
                                  value={p.placeholder || ''}
                                  onChange={(e) =>
                                    handleUpdateParam(index, pIndex, {
                                      placeholder: e.target.value || null,
                                    })
                                  }
                                  placeholder="输入框提示，例如：最大等待时间（毫秒）"
                                />
                              </div>
                              <div className="flex min-w-[140px] flex-1 flex-col gap-1">
                                <Label className="text-[11px]">默认值</Label>
                                <Input
                                  className="h-8 text-[11px]"
                                  value={p.defaultValue || ''}
                                  onChange={(e) =>
                                    handleUpdateParam(index, pIndex, {
                                      defaultValue: e.target.value || null,
                                    })
                                  }
                                  placeholder="可选，例如：30000"
                                />
                              </div>
                              <div className="flex w-[80px] flex-col gap-1">
                                <Label className="text-[11px]">排序</Label>
                                <Input
                                  className="h-8 text-[11px]"
                                  type="number"
                                  value={p.sortOrder}
                                  onChange={(e) =>
                                    handleUpdateParam(index, pIndex, {
                                      sortOrder: Number(e.target.value || 0),
                                    })
                                  }
                                />
                              </div>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => handleDeleteParam(index, pIndex)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                          {!a.params?.length && (
                            <p className="text-muted-foreground text-[11px]">
                              暂无参数，如需在「添加步骤」时弹出参数输入框，可在此处新增参数定义。
                            </p>
                          )}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
                {!currentActions.length && (
                  <p className="text-muted-foreground text-xs">
                    暂无动作，请点击上方「新增动作」按钮，为当前页面添加可复用的步骤动作。
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
          </Card>
        </SheetContent>
      </Sheet>

      <Dialog
        open={viewPageDialogOpen}
        onOpenChange={(open) => {
          setViewPageDialogOpen(open)
          if (!open) {
            setViewPageDetail(null)
            setViewPageLoading(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader className="w-full max-w-full">
            <DialogTitle>页面配置预览</DialogTitle>
            <DialogDescription>
              从数据库中读取当前页面及其动作配置，只读展示，便于排查生成逻辑与数据库记录是否一致。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-w-full overflow-hidden">
            {viewPageLoading && (
              <p className="text-xs text-muted-foreground">加载中…</p>
            )}
            {viewPageDetail && (
              <>
                <div className="grid gap-2 text-xs md:grid-cols-3">
                  <div>
                    <span className="text-muted-foreground">ID：</span>
                    <span>{viewPageDetail.id}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">平台：</span>
                    <span>{viewPageDetail.platform}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">页面 key：</span>
                    <span>{viewPageDetail.key}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">名称：</span>
                    <span>{viewPageDetail.label}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">模块：</span>
                    <span>{viewPageDetail.module}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">类名：</span>
                    <span>{viewPageDetail.className}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">变量名：</span>
                    <span>{viewPageDetail.varName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">启用：</span>
                    <span>{viewPageDetail.enabled ? '是' : '否'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">排序：</span>
                    <span>{viewPageDetail.sortOrder}</span>
                  </div>
                </div>
                <div className="w-full rounded-md border p-2">
                  <GTable
                    caption="动作列表（来自数据库）"
                    headers={[
                      'ID',
                      'key',
                      '名称',
                      '方法',
                      '类型',
                      '启用',
                      '排序',
                      '参数',
                      '内部步骤数',
                    ]}
                    showFooter={false}
                    containerClassName="max-h-[50vh] overflow-x-auto overflow-y-auto"
                    rows={(viewPageDetail.actions || []).map((a) => [
                      a.id ?? '',
                      a.key,
                      a.label,
                      a.method,
                      (a as any).kind || '',
                      a.enabled ? '是' : '否',
                      a.sortOrder,
                      (Array.isArray((a as any).params) ? (a as any).params : [])
                        .map((p: any) => p.name)
                        .filter((name: string) => name)
                        .join(', '),
                      Array.isArray((a as any).callSteps)
                        ? (a as any).callSteps.length
                        : 0,
                    ])}
                  />
                </div>
              </>
            )}
            {!viewPageLoading && !viewPageDetail && (
              <p className="text-xs text-muted-foreground">
                暂无数据，请在左侧选择页面并点击查看按钮。
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
