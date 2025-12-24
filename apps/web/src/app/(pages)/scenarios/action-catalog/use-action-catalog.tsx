'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { normalizeResponseError, isUnauthorizedError } from '@/lib/error'
import { Button } from '@/components/ui/button'
import { AdminAction, AdminPage, PageSummary, PlatformSummary } from './types'

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

export const resolveActionSubtypeLabel = (action: AdminAction): string => {
  if (action.kind !== 'action') return ''
  if (action.actionType === 'input') return '输入'
  if (action.actionType === 'drag') return '拖动'
  if (action.actionType === 'click') return '点击'
  const text = `${action.method || ''} ${action.label || ''}`.toLowerCase()
  if (text.match(/drag|swipe|move|drop|滑|拖|拽/)) {
    return '拖动'
  }
  if (text.match(/input|type|fill|enter|set|键入|输入|填/)) {
    return '输入'
  }
  return '点击'
}

export function useActionCatalogModel() {
  const router = useRouter()
  const searchParams = useSearchParams()
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
  const [pendingSelectPageId, setPendingSelectPageId] = useState<number | null>(null)
  const [pendingSelectPageKey, setPendingSelectPageKey] = useState<string | null>(null)
  const [pendingOpenActionKey, setPendingOpenActionKey] = useState<string | null>(null)

  const selectedSummary = useMemo(
    () => pages.find((p) => p.id === selectedPageId) || null,
    [pages, selectedPageId]
  )

  const getLibFilePathForPage = useCallback(
    (pageLike: { platform: string; key: string; className: string }) => {
      const plat = (pageLike.platform || platform || 'gettr-web').toLowerCase()
      const platRec = platforms.find((p) => p.key === plat)
      const dirName = (platRec?.libDir || platRec?.key || '').trim()
      if (!dirName) return null
      const baseRaw =
        (pageLike.className || '').replace(/Page$/, '') || pageLike.key || 'page'
      const fileBase = baseRaw.toLowerCase()
      const fileName = `${fileBase}-page.ts`
      return `workspace/shared-libs/${dirName}/src/${fileName}`
    },
    [platform, platforms]
  )

  const loadPages = useCallback(
    async (plat: string, preferSelectId?: number | null) => {
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
        const filtered = items.filter((p: any) => {
          const filePath = (p?.filePath || p?.path || '') as string
          if (typeof filePath === 'string' && filePath.includes('shared-libs')) {
            return false
          }
          if (typeof filePath === 'string' && filePath.trim().endsWith('.ts')) {
            return false
          }
          const looksLikeTs =
            (typeof p?.key === 'string' && p.key.includes('.ts')) ||
            (typeof p?.label === 'string' && p.label.includes('.ts'))
          return !looksLikeTs
        })
        const uniqByKey: PageSummary[] = []
        const seen = new Set<string>()
        for (const p of filtered) {
          if (seen.has(p.key)) continue
          seen.add(p.key)
          uniqByKey.push(p)
        }
        setPages(uniqByKey)
        setSelectedPageIds((prev) => prev.filter((id) => uniqByKey.some((p) => p.id === id)))
        if (preferSelectId && uniqByKey.some((p) => p.id === preferSelectId)) {
          setSelectedPageId(preferSelectId)
          setSelectedPageIds([preferSelectId])
        } else if (!selectedPageId && uniqByKey.length) {
          setSelectedPageId(uniqByKey[0].id)
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
    },
    [router, selectedPageId]
  )

  const loadPlatforms = useCallback(async () => {
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
  }, [platform, router])

  const loadPageDetail = useCallback(
    async (id: number) => {
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
          ...(Array.isArray((data as any).elements)
            ? {
                elements: (data as any).elements.map((el: any) => ({
                  id: el.id,
                  elementId: el.elementId || '',
                  description: el.description ?? null,
                  defaultLocator: el.defaultLocator ?? null,
                })),
              }
            : {}),
          actions: Array.isArray(data.actions)
            ? data.actions.map((a, index) => {
                const kind: AdminAction['kind'] =
                  (a as any).kind === 'assert'
                    ? 'assert'
                    : (a as any).kind === 'call'
                      ? 'call'
                      : 'action'
                const normalizedActionType: AdminAction['actionType'] =
                  kind === 'action'
                    ? (a as any).actionType === 'input'
                      ? 'input'
                      : (a as any).actionType === 'drag'
                        ? 'drag'
                        : 'click'
                    : undefined
                return {
                  id: a.id,
                  key: a.key || '',
                  label: a.label || a.key || '',
                  method: a.method || a.key || '',
                  kind,
                  actionType: normalizedActionType,
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
                }
              })
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
    },
    [platform, router]
  )

  useEffect(() => {
    void loadPlatforms()
  }, [loadPlatforms])

  useEffect(() => {
    void (async () => {
      await loadPages(platform, pendingSelectPageId)
      if (pendingSelectPageId != null) {
        setPendingSelectPageId(null)
      }
    })()
  }, [platform, pendingSelectPageId, loadPages])

  useEffect(() => {
    const qpPlat = searchParams?.get('platform')
    const qpPageId = searchParams?.get('pageId')
    const qpPageKey = searchParams?.get('pageKey')
    const qpActionKey = searchParams?.get('actionKey')
    if (qpPlat && qpPlat !== platform) {
      setPlatform(qpPlat)
    }
    if (qpPageId) {
      const n = Number(qpPageId)
      if (Number.isFinite(n)) {
        setPendingSelectPageId(n)
        setDetailsOpen(true)
      }
    }
    if (qpPageKey) {
      setKeyFilter(qpPageKey)
      setPendingSelectPageKey(qpPageKey)
      setDetailsOpen(true)
    }
    if (qpActionKey) {
      setPendingOpenActionKey(qpActionKey)
      setDetailsOpen(true)
    }
  }, [platform, searchParams])

  useEffect(() => {
    if (!pendingSelectPageKey) return
    if (!pages.length) return
    const match = pages.find((p) => p.key === pendingSelectPageKey) || null
    if (!match) return
    setPendingSelectPageId(match.id)
    setPendingSelectPageKey(null)
  }, [pages, pendingSelectPageKey])

  useEffect(() => {
    if (selectedPageId != null) {
      void loadPageDetail(selectedPageId)
    }
  }, [selectedPageId, loadPageDetail])

  const handleCreatePage = useCallback(() => {
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
  }, [pages, platform])

  const savePage = useCallback(
    async (opts?: { successMessage?: string; skipLibToast?: boolean }) => {
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
        await loadPages(platform, data.id ?? null)
        const libPath = getLibFilePathForPage({
          platform: data.platform || platform,
          key: data.key,
          className: data.className,
        })
      if (libPath && !opts?.skipLibToast) {
        try {
          localStorage.setItem('gtt:libs:lastFile', libPath)
        } catch {}
        const href = `/testcases/libs${libPath ? `?file=${encodeURIComponent(libPath)}` : ''}`
        let toastId: string | number | undefined
        const handleOpen = () => {
          setDetailsOpen(false)
          try {
            router.push(href)
            setTimeout(() => {
              if (typeof window !== 'undefined') {
                window.location.href = href
              }
            }, 200)
          } catch {
            if (typeof window !== 'undefined') {
              window.location.href = href
            }
          }
          if (toastId !== undefined) {
            try {
              toast.dismiss(toastId)
            } catch {}
          }
        }
        toastId = toast.success(
          <div className="pointer-events-auto flex flex-col gap-1">
            <div className="break-all text-xs">页面与动作已保存，对应代码文件：</div>
            <div className="break-all font-mono text-[11px]">{libPath}</div>
            <div className="mt-1">
              <Button
                type="button"
                size="xs"
                variant="outline"
                className="h-6 px-2 text-[11px]"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleOpen()
                  if (toastId !== undefined) {
                    try {
                      toast.dismiss(toastId)
                    } catch {}
                  }
                }}
              >
                在「Libs」页面中打开
              </Button>
            </div>
          </div>,
          { closeButton: true, duration: 8000 }
        )
      } else {
        toast.success(opts?.successMessage || '页面与动作已保存')
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
    },
    [draft, platform, loadPages, getLibFilePathForPage, router]
  )

  const handleSave = useCallback(async () => savePage(), [savePage])

  const handleSaveAction = useCallback(
    async (action: AdminAction) => {
      if (!draft?.id) {
        await savePage({ successMessage: '动作已保存' });
        return;
      }
      setSaving(true);
      try {
        const payload: AdminAction = {
          ...action,
          sortOrder:
            typeof action.sortOrder === 'number' && Number.isFinite(action.sortOrder)
              ? Math.floor(action.sortOrder)
              : 0,
          params: (action.params || []).map((p, pIndex) => ({
            ...p,
            sortOrder:
              typeof p.sortOrder === 'number' && Number.isFinite(p.sortOrder)
                ? Math.floor(p.sortOrder)
                : pIndex,
          })),
          callSteps: (action.callSteps || []).map((s, sIndex) => ({
            targetActionKey: s.targetActionKey,
            args: s.args || [],
            sortOrder:
              typeof s.sortOrder === 'number' && Number.isFinite(s.sortOrder)
                ? Math.floor(s.sortOrder)
                : sIndex,
          })),
        };
        const method = action.id ? 'PUT' : 'POST';
        const url = action.id
          ? `/api/action-catalog/pages/${draft.id}/actions/${action.id}`
          : `/api/action-catalog/pages/${draft.id}/actions`;
        const res = await fetch(url, {
          method,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await normalizeResponseError(res as any);
          throw new Error(err.message || '保存动作失败');
        }
        const data = (await res.json()) as AdminPage;
        setDraft(data);
        await loadPages(platform, data.id ?? draft.id ?? null);
        toast.success('动作已保存');
      } catch (e: any) {
        if (isUnauthorizedError(e)) {
          try {
            router.push('/signin');
          } catch {}
          return;
        }
        toast.error(e?.message || '保存动作失败');
      } finally {
        setSaving(false);
      }
    },
    [draft?.id, loadPages, platform, router, savePage]
  )

  const handleDelete = useCallback(async () => {
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
  }, [draft, loadPages, platform, router])

  const loadCallSourceActions = useCallback(
    async (pageId: number): Promise<AdminAction[]> => {
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
          ? data.actions.map((a, index) => {
              const kind: AdminAction['kind'] =
                (a as any).kind === 'assert'
                  ? 'assert'
                  : (a as any).kind === 'call'
                    ? 'call'
                    : 'action'
              const actionType: AdminAction['actionType'] =
                kind === 'action'
                  ? (a as any).actionType === 'input'
                    ? 'input'
                    : (a as any).actionType === 'drag'
                      ? 'drag'
                      : 'click'
                  : undefined
              return {
                id: a.id,
                key: a.key || '',
                label: a.label || a.key || '',
                method: a.method || a.key || '',
                actionType,
                kind,
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
              }
            })
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
    },
    [callSourceActionsByPageId, router]
  )

  const handleViewPage = useCallback(
    async (pageId: number) => {
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
    },
    [router]
  )

  const handleUpdateAction = useCallback(
    (index: number, patch: Partial<AdminAction>) => {
      if (!draft) return
      const list = draft.actions || []
      const next = list.map((a, i) => {
        if (i !== index) return a
        const nextKind = patch.kind ?? a.kind
        const nextActionType =
          nextKind === 'action'
            ? patch.actionType ?? a.actionType ?? 'click'
            : undefined
        return {
          ...a,
          ...patch,
          kind: nextKind,
          actionType: nextActionType,
        }
      })
      setDraft({ ...draft, actions: next })
    },
    [draft]
  )

  const handleDeleteAction = useCallback(
    (index: number) => {
      if (!draft) return
      const list = draft.actions || []
      const next = list.filter((_, i) => i !== index).map((a, i) => ({ ...a, sortOrder: i }))
      setDraft({ ...draft, actions: next })
    },
    [draft]
  )

  const handleAddParam = useCallback(
    (actionIndex: number) => {
      if (!draft) return
      const actions = draft.actions || []
      const target = actions[actionIndex]
      if (!target) return
      const params = target.params || []
      const nextParam = {
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
    },
    [draft]
  )

  const handleUpdateParam = useCallback(
    (actionIndex: number, paramIndex: number, patch: any) => {
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
    },
    [draft]
  )

  const handleDeleteParam = useCallback(
    (actionIndex: number, paramIndex: number) => {
      if (!draft) return
      const actions = draft.actions || []
      const target = actions[actionIndex]
      if (!target) return
      const params = target.params || []
      const nextParams = params.filter((_, i) => i !== paramIndex).map((p, i) => ({ ...p, sortOrder: i }))
      const nextActions = actions.map((a, i) =>
        i === actionIndex ? { ...a, params: nextParams } : a
      )
      setDraft({ ...draft, actions: nextActions })
    },
    [draft]
  )

  const handleDeletePage = useCallback(
    async (page: PageSummary) => {
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
    },
    [loadPages, platform, selectedPageId, router]
  )

  const handleCreatePlatform = useCallback(async () => {
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
  }, [loadPlatforms, router])

  const handleDeletePlatform = useCallback(async () => {
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
  }, [platforms, platform, loadPlatforms, router])

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

  return {
    platform,
    setPlatform,
    platforms,
    pages,
    loadingPages,
    selectedPageId,
    setSelectedPageId,
    selectedPageIds,
    setSelectedPageIds,
    loadingDetail,
    saving,
    deleting,
    setDeleting,
    draft,
    setDraft,
    keyFilter,
    setKeyFilter,
    nameFilter,
    setNameFilter,
    enabledFilter,
    setEnabledFilter,
    callSourcePageId,
    setCallSourcePageId,
    callSourceActionsByPageId,
    loadingCallSource,
    viewPageDialogOpen,
    setViewPageDialogOpen,
    viewPageLoading,
    viewPageDetail,
    setViewPageDetail,
    uploadingWebIds,
    setUploadingWebIds,
    clearingWebIds,
    setClearingWebIds,
    detailsOpen,
    setDetailsOpen,
    pageTablePage,
    setPageTablePage,
    pageTablePageSize,
    setPageTablePageSize,
    filteredPages,
    totalElements,
    pageTableTotalPages,
    safePageTablePage,
    pagedPages,
    selectedSummary,
    getLibFilePathForPage,
    loadPlatforms,
    loadPages,
    loadPageDetail,
    handleCreatePage,
    handleSave,
    handleSaveAction,
    handleDelete,
    loadCallSourceActions,
    handleViewPage,
    handleUpdateAction,
    handleDeleteAction,
    handleAddParam,
    handleUpdateParam,
    handleDeleteParam,
    handleDeletePage,
    handleCreatePlatform,
    handleDeletePlatform,
    setPendingSelectPageId,
    pendingOpenActionKey,
    setPendingOpenActionKey,
  }
}
