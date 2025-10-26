'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { RefreshCwIcon, Power, ChevronRight, ChevronLeft } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

type Bounds = { x1: number; y1: number; x2: number; y2: number }
type NodeInfo = {
  nodeId: string
  class: string
  text: string
  resourceId: string
  contentDesc: string
  clickable: boolean
  bounds: Bounds
}

type Snapshot = {
  screenshotUrl?: string
  screenshotBase64?: string
  screen: { width: number; height: number }
  nodes: NodeInfo[]
  takenAt: number
}

function useSnapshot(deviceId?: string | null) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchSnapshot = async (): Promise<Snapshot | null> => {
    try {
      setLoading(true)
      setError(null)
      // Prefer real backend; only fallback to mock if proxy not configured (503)
      const qs = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : ''
      const res = await fetch(`/api/inspector/snapshot${qs}`, {
        cache: 'no-store',
      })
      if (res.status === 503) {
        const mockRes = await fetch('/api/mock/inspector/snapshot', {
          cache: 'no-store',
        })
        if (!mockRes.ok) throw new Error(`HTTP ${mockRes.status}`)
        const mockJson = (await mockRes.json()) as Snapshot
        setData(mockJson)
        return mockJson
      }
      if (!res.ok) {
        // Provide a friendlier message, especially for 404 from backend (Nest NotFoundException)
        const friendly404 =
          '未找到运行中的设备或快照，请在 Devices 页面启动 Android 模拟器与 Appium 服务。'
        if (res.status === 404) {
          throw new Error(friendly404)
        }
        let msg = `HTTP ${res.status}`
        try {
          const j = await res.json()
          // Nest default NotFound: { statusCode: 404, message: '...', error: 'Not Found' }
          const messageField = Array.isArray(j?.message) ? j.message.join('\n') : j?.message
          if (j?.error === 'Not Found' && messageField) {
            msg = String(messageField)
          } else {
            msg = messageField || j?.details || j?.error || msg
          }
          if (/no running device|emulator/i.test(msg)) {
            msg = friendly404
          }
        } catch {}
        throw new Error(msg)
      }
      const json = (await res.json()) as Snapshot
      setData(json)
      return json
    } catch (e: any) {
      setError(e?.message || 'Failed to load snapshot')
      return null
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSnapshot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId])

  return { loading, data, error, refresh: fetchSnapshot }
}

function formatBounds(b: Bounds) {
  return `[${b.x1},${b.y1}][${b.x2},${b.y2}]`
}

type Suggestion = {
  label: string
  code: string
  using?: string
  value?: string
  isCoordinate?: boolean
  coord?: { x: number; y: number }
}

function buildSuggestions(n: NodeInfo, center?: { x: number; y: number }): Suggestion[] {
  const suggestions: Suggestion[] = []
  if (n.contentDesc) {
    suggestions.push({
      label: 'accessibility id (JS)',
      code: `await $('~${n.contentDesc}').click()`,
      using: 'accessibility id',
      value: n.contentDesc,
    })
  }
  if (n.resourceId) {
    suggestions.push({
      label: 'id (JS)',
      code: `await $('#${n.resourceId}').click()`,
      using: 'id',
      value: n.resourceId,
    })
  }
  if (n.text) {
    const esc = n.text.replace(/\"/g, '\\"')
    suggestions.push({
      label: 'UiSelector text (JS)',
      code: `await $('android=new UiSelector().text(\"${esc}\")').click()`,
      using: 'android uiautomator',
      value: `new UiSelector().text(\"${esc}\")`,
    })
  }
  const parts: string[] = []
  if (n.class) parts.push(n.class)
  if (n.text) parts.push(`@text=\"${n.text.replace(/\"/g, '\\"')}\"`)
  if (n.resourceId) parts.push(`@resource-id=\"${n.resourceId}\"`)
  const xpath =
    parts.length > 1 ? `//${parts[0]}[${parts.slice(1).join(' and ')}]` : `//${parts[0]}`
  if (n.class)
    suggestions.push({
      label: 'XPath (fallback)',
      code: `await $('${xpath}').click()`,
      using: 'xpath',
      value: xpath,
    })
  if (center) {
    suggestions.push({
      label: '坐标 tap (JS)',
      code: `await driver.touchAction({ action: 'tap', x: ${center.x}, y: ${center.y} })`,
      isCoordinate: true,
      coord: center,
    })
  }
  return suggestions
}

function generateLocators(n: NodeInfo, center?: { x: number; y: number }) {
  const suggestions: { label: string; code: string }[] = []
  if (n.contentDesc) {
    suggestions.push({
      label: 'accessibility id (JS)',
      code: `await $('~${n.contentDesc}').click()`,
    })
  }
  if (n.resourceId) {
    suggestions.push({
      label: 'id (JS)',
      code: `await $('#${n.resourceId}').click()`,
    })
  }
  if (n.text) {
    const esc = n.text.replace(/"/g, '\\"')
    suggestions.push({
      label: 'UiSelector text (JS)',
      code: `await $('android=new UiSelector().text("${esc}")').click()`,
    })
  }
  // Fallback XPath (short form)
  const parts: string[] = []
  if (n.class) parts.push(n.class)
  if (n.text) parts.push(`@text="${n.text.replace(/"/g, '\\"')}"`)
  if (n.resourceId) parts.push(`@resource-id="${n.resourceId}"`)
  const xpath =
    parts.length > 1 ? `//${parts[0]}[${parts.slice(1).join(' and ')}]` : `//${parts[0]}`
  if (n.class)
    suggestions.push({
      label: 'XPath (fallback)',
      code: `await $('${xpath}').click()`,
    })
  if (center) {
    suggestions.push({
      label: '坐标 tap (JS)',
      code: `await driver.touchAction({ action: 'tap', x: ${center.x}, y: ${center.y} })`,
    })
  }
  return suggestions
}

type TreeNode = NodeInfo & { children: TreeNode[] }

function contains(a: Bounds, b: Bounds) {
  return a.x1 <= b.x1 && a.y1 <= b.y1 && a.x2 >= b.x2 && a.y2 >= b.y2
}

function buildTree(nodes: NodeInfo[]): TreeNode[] {
  const list: TreeNode[] = nodes.map((n) => ({ ...n, children: [] }))
  const area = (b: Bounds) => (b.x2 - b.x1) * (b.y2 - b.y1)
  list
    .slice()
    .sort((a, b) => area(a.bounds) - area(b.bounds))
    .forEach((child, idx, arr) => {
      let parent: TreeNode | null = null
      let parentArea = Infinity
      for (const candidate of arr) {
        if (candidate === child) continue
        const candArea = area(candidate.bounds)
        if (candArea <= area(child.bounds)) continue
        if (contains(candidate.bounds, child.bounds) && candArea < parentArea) {
          parent = candidate
          parentArea = candArea
        }
      }
      if (parent) parent.children.push(child)
    })
  const childIds = new Set(list.flatMap((n) => n.children.map((c) => c.nodeId)))
  const roots = list.filter((n) => !childIds.has(n.nodeId))
  const sortFn = (a: TreeNode, b: TreeNode) =>
    a.bounds.y1 - b.bounds.y1 || a.bounds.x1 - b.bounds.x1
  const sortTree = (n: TreeNode) => {
    n.children.sort(sortFn)
    n.children.forEach(sortTree)
  }
  roots.sort(sortFn)
  roots.forEach(sortTree)
  return roots
}

function Tree({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: TreeNode[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(nodes.map((n) => n.nodeId)))
  const toggle = (id: string) => {
    setExpanded((s) => {
      const ns = new Set(s)
      if (ns.has(id)) ns.delete(id)
      else ns.add(id)
      return ns
    })
  }
  const Item = ({ n, depth }: { n: TreeNode; depth: number }) => {
    const isExpanded = expanded.has(n.nodeId)
    const hasChildren = n.children.length > 0
    return (
      <div key={n.nodeId} className="select-none">
        <div
          className={`flex items-center gap-1 rounded px-1 py-0.5 ${selectedId === n.nodeId ? 'bg-blue-50 text-blue-700' : 'hover:bg-accent'}`}
        >
          <button
            type="button"
            className="w-5 text-xs"
            onClick={() => hasChildren && toggle(n.nodeId)}
          >
            {hasChildren ? (isExpanded ? '▾' : '▸') : ''}
          </button>
          <button
            type="button"
            className="flex-1 truncate text-left"
            onClick={() => onSelect(n.nodeId)}
            title={`${n.class} ${n.text || ''}`.trim()}
          >
            {n.class.split('.').pop()}{' '}
            {n.resourceId || n.contentDesc || n.text
              ? `- ${n.resourceId || n.contentDesc || n.text}`
              : ''}
          </button>
        </div>
        {hasChildren && isExpanded && (
          <div className="ml-4 border-l pl-2">
            {n.children.map((c) => (
              <Item key={c.nodeId} n={c} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }
  return (
    <div className="space-y-1">
      {nodes.map((n) => (
        <Item key={n.nodeId} n={n} depth={0} />
      ))}
    </div>
  )
}

export default function AndroidInspectorPage() {
  const searchParams = useSearchParams()
  const paramDeviceId = searchParams.get('deviceId')
  const paramAvd = searchParams.get('avd')
  const { data, loading, error, refresh } = useSnapshot(paramDeviceId)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [autoCenterOnClick, setAutoCenterOnClick] = useState(false)
  const [showClickableOnly, setShowClickableOnly] = useState(true)
  const [filterText, setFilterText] = useState('')
  const [selectedAvd, setSelectedAvd] = useState(paramAvd || '')
  const [showFilters, setShowFilters] = useState(false)
  const [showTree, setShowTree] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    const v = localStorage.getItem('inspector.treeOpen')
    return v !== '0'
  })
  const [treeWidth, setTreeWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 320
    const v = parseInt(localStorage.getItem('inspector.treeWidth') || '320', 10)
    return Number.isFinite(v) ? v : 320
  })
  const [collapsedWidth, setCollapsedWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 12
    const v = parseInt(localStorage.getItem('inspector.treeCollapsedWidth') || '12', 10)
    return Number.isFinite(v) ? v : 12
  })
  const minTreeWidth = 240
  const maxTreeWidth = 560
  const minCollapsed = 8
  const maxCollapsed = 48
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>({
    w: 0,
    h: 0,
  })
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [spaceDown, setSpaceDown] = useState(false)
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<{
    x: number
    y: number
    panX: number
    panY: number
  } | null>(null)

  const selectedNode = useMemo(() => {
    return data?.nodes.find((n) => n.nodeId === selectedId) || null
  }, [data, selectedId])

  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const updateSize = () => setViewportSize({ w: vp.clientWidth, h: vp.clientHeight })
    updateSize()
    const ro = new ResizeObserver(updateSize)
    ro.observe(vp)
    return () => ro.disconnect()
  }, [viewportRef.current])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        setSpaceDown(e.type === 'keydown')
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
  }, [])

  const scale = useMemo(() => {
    if (!data || !viewportSize.w || !viewportSize.h) return { sx: 1, sy: 1 }
    const sx = viewportSize.w / data.screen.width
    const sy = viewportSize.h / data.screen.height
    return { sx, sy }
  }, [data, viewportSize])

  const onMouseDown = (e: React.MouseEvent) => {
    if (!spaceDown) return
    setDragging(true)
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !dragStart.current) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy })
  }
  const onMouseUp = () => {
    setDragging(false)
    dragStart.current = null
  }

  // Persist tree UI
  useEffect(() => {
    try {
      localStorage.setItem('inspector.treeOpen', showTree ? '1' : '0')
      localStorage.setItem('inspector.treeWidth', String(treeWidth))
      localStorage.setItem('inspector.treeCollapsedWidth', String(collapsedWidth))
    } catch {}
  }, [showTree, treeWidth, collapsedWidth])

  // Tree resizer handlers
  const isResizingTreeRef = useRef(false)
  const resizeStartRef = useRef<{
    x: number
    startWidth: number
    startCollapsed: number
  } | null>(null)
  const onTreeResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    isResizingTreeRef.current = true
    resizeStartRef.current = {
      x: e.clientX,
      startWidth: treeWidth,
      startCollapsed: collapsedWidth,
    }
    window.addEventListener('mousemove', onTreeResizeMove)
    window.addEventListener('mouseup', onTreeResizeEnd)
  }
  const onTreeResizeMove = (e: MouseEvent) => {
    if (!isResizingTreeRef.current || !resizeStartRef.current) return
    const dx = e.clientX - resizeStartRef.current.x
    if (showTree) {
      let next = resizeStartRef.current.startWidth + dx
      if (next < 40) {
        setShowTree(false)
        next = Math.max(minCollapsed, Math.min(maxCollapsed, next))
        setCollapsedWidth(next)
      } else {
        next = Math.max(minTreeWidth, Math.min(maxTreeWidth, next))
        setTreeWidth(next)
      }
    } else {
      let next = resizeStartRef.current.startCollapsed + dx
      if (next > 60) {
        setShowTree(true)
        next = Math.max(minTreeWidth, Math.min(maxTreeWidth, next))
        setTreeWidth(next)
      } else {
        next = Math.max(minCollapsed, Math.min(maxCollapsed, next))
        setCollapsedWidth(next)
      }
    }
  }
  const onTreeResizeEnd = () => {
    isResizingTreeRef.current = false
    resizeStartRef.current = null
    window.removeEventListener('mousemove', onTreeResizeMove)
    window.removeEventListener('mouseup', onTreeResizeEnd)
  }

  const zoomIn = () => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))
  const zoomOut = () => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))
  const zoomReset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const centerOn = (n: NodeInfo) => {
    const viewportW = viewportSize.w
    const viewportH = viewportSize.h
    const left = n.bounds.x1 * scale.sx * zoom
    const top = n.bounds.y1 * scale.sy * zoom
    const width = (n.bounds.x2 - n.bounds.x1) * scale.sx * zoom
    const height = (n.bounds.y2 - n.bounds.y1) * scale.sy * zoom
    const cx = left + width / 2
    const cy = top + height / 2
    setPan({ x: viewportW / 2 - cx, y: viewportH / 2 - cy })
  }

  const filteredNodes = useMemo(() => {
    if (!data) return [] as NodeInfo[]
    const base = showClickableOnly ? data.nodes.filter((n) => n.clickable) : data.nodes
    if (!filterText.trim()) return base
    const ft = filterText.trim().toLowerCase()
    return base.filter((n) =>
      [n.text, n.resourceId, n.contentDesc, n.class]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(ft))
    )
  }, [data, showClickableOnly, filterText])

  const centerOf = (b: Bounds) => ({
    x: Math.round((b.x1 + b.x2) / 2),
    y: Math.round((b.y1 + b.y2) / 2),
  })

  const [tapping, setTapping] = useState(false)
  const [startingAppium, setStartingAppium] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const POLL_MS = 3000
  // Short-polling config for post-action refresh
  const [pollIntervalMs, setPollIntervalMs] = useState(400)
  const [pollMaxAttempts, setPollMaxAttempts] = useState(6)
  const startAppiumNow = async () => {
    setStartingAppium(true)
    try {
      const res = await fetch('/api/android/appium/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t || `HTTP ${res.status}`)
      }
      const data = await res.json().catch(() => ({}) as any)
      const port = (data as any)?.port
      toast.success(port ? `Appium server started on ${port}` : 'Appium server started')
      // 尝试刷新快照
      await refresh()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to start Appium')
    } finally {
      setStartingAppium(false)
    }
  }

  // Auto refresh polling
  useEffect(() => {
    if (!autoRefresh) return
    const id = window.setInterval(() => {
      refresh()
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [autoRefresh, refresh])

  // Turn on polling when error occurs; stop when data available
  useEffect(() => {
    if (error) {
      setAutoRefresh(true)
    } else if (data) {
      setAutoRefresh(false)
    }
  }, [error, data])

  // Toolbar: emulator list + appium status
  type AndroidEmulatorResponse = {
    avds: string[]
    running: {
      serial: string
      avd: string | null
      deviceName: string | null
    } | null
  }
  type AppiumStatus = { running: boolean; port?: number }

  const emulatorQuery = useQuery<AndroidEmulatorResponse>({
    queryKey: ['android-emulators-for-inspector'],
    queryFn: async () => {
      const res = await fetch('/api/android/emulators', { method: 'GET' })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    staleTime: 5000,
  })

  useEffect(() => {
    const list = emulatorQuery.data?.avds ?? []
    if (list.length && !selectedAvd) setSelectedAvd(list[0])
  }, [emulatorQuery.data?.avds, selectedAvd])

  const appiumStatusQuery = useQuery<AppiumStatus>({
    queryKey: ['appium-status-for-inspector'],
    queryFn: async () => {
      const res = await fetch('/api/android/appium/status', { method: 'GET' })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    staleTime: 3000,
  })

  const startEmulatorMutation = useMutation<any, Error, { avd: string }>({
    mutationFn: async ({ avd }) => {
      const res = await fetch('/api/android/emulators/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ avd, headless: false, reset: false }),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: async (data) => {
      toast.success(data?.message ?? 'Emulator started')
      await emulatorQuery.refetch()
      await appiumStatusQuery.refetch()
      await refresh()
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to start emulator'),
  })

  const startAppiumMutation = useMutation<
    { result: string; started?: boolean; port?: number },
    Error,
    void
  >({
    mutationFn: async () => {
      const res = await fetch('/api/android/appium/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: async (data) => {
      toast.success(data?.port ? `Appium server started on ${data.port}` : 'Appium started')
      await appiumStatusQuery.refetch()
      await refresh()
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to start Appium'),
  })

  const stopAppiumMutation = useMutation<{ result: string; stopped?: boolean }, Error, void>({
    mutationFn: async () => {
      const res = await fetch('/api/android/appium/stop', { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: async (data) => {
      toast.success(data?.stopped ? 'Appium stopped' : 'Appium not running')
      await appiumStatusQuery.refetch()
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to stop Appium'),
  })
  const tapSelected = async () => {
    if (!selectedNode) return
    setTapping(true)
    try {
      const prevAt = data?.takenAt
      const c = centerOf(selectedNode.bounds)
      await fetch('/api/inspector/tap', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          x: c.x,
          y: c.y,
          deviceId: paramDeviceId ?? undefined,
        }),
      })
      const maxAttempts = Math.max(1, Math.min(20, pollMaxAttempts | 0))
      const delay = Math.max(100, Math.min(3000, pollIntervalMs | 0))
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, delay))
        const snap = await refresh()
        if (snap && prevAt && snap.takenAt !== prevAt) break
      }
    } catch (e) {
      // noop
    } finally {
      setTapping(false)
    }
  }

  return (
    <div className="flex w-full flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters((v) => !v)}>
            {showFilters ? '收起筛选' : '筛选'}
          </Button>
          {showFilters && (
            <>
              <Label htmlFor="filter">筛选:</Label>
              <Input
                id="filter"
                placeholder="Search by text / id / desc"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="w-64"
              />
              <div className="flex items-center gap-2">
                <Switch
                  id="toggle-clickable-only"
                  checked={showClickableOnly}
                  onCheckedChange={(v) => setShowClickableOnly(!!v)}
                />
                <label
                  htmlFor="toggle-clickable-only"
                  className="cursor-pointer text-xs select-none"
                >
                  OnlyClickable
                </label>
              </div>
            </>
          )}
          <div className="ml-4 flex items-center gap-2">
            <Select value={selectedAvd} onValueChange={(v) => setSelectedAvd(v)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select AVD" />
              </SelectTrigger>
              <SelectContent>
                {(emulatorQuery.data?.avds ?? []).map((avd) => (
                  <SelectItem key={avd} value={avd}>
                    {avd}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => selectedAvd && startEmulatorMutation.mutate({ avd: selectedAvd })}
              disabled={!selectedAvd || startEmulatorMutation.isPending}
            >
              {startEmulatorMutation.isPending ? 'Starting...' : 'Start'}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={refresh} disabled={loading} size={'icon'}>
            <RefreshCwIcon />
          </Button>
          <Button
            onClick={() =>
              appiumStatusQuery.data?.running
                ? stopAppiumMutation.mutate()
                : startAppiumMutation.mutate()
            }
            disabled={startAppiumMutation.isPending || stopAppiumMutation.isPending}
            size={'icon'}
            className={cn(
              'h-9 w-9 rounded-full p-0',
              appiumStatusQuery.data?.running ? 'bg-green-600 text-white hover:bg-green-700' : ''
            )}
            aria-label={
              appiumStatusQuery.data?.running ? 'Stop Appium Server' : 'Start Appium Server'
            }
            title={
              startAppiumMutation.isPending || stopAppiumMutation.isPending
                ? '处理中…'
                : appiumStatusQuery.data?.running
                  ? 'Appium running. 点击停止'
                  : 'Start Appium'
            }
          >
            <Power className="h-4 w-4" />
          </Button>
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="outline">高级设置</Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 flex flex-wrap items-center gap-3 rounded-md border p-2">
                <div className="flex items-center gap-2">
                  <Switch
                    id="auto-refresh"
                    checked={autoRefresh}
                    onCheckedChange={(v) => setAutoRefresh(!!v)}
                  />
                  <label htmlFor="auto-refresh" className="cursor-pointer text-xs select-none">
                    自动刷新
                  </label>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Label htmlFor="poll-interval">短轮询间隔(ms)</Label>
                  <Input
                    id="poll-interval"
                    className="h-8 w-20"
                    type="number"
                    value={pollIntervalMs}
                    min={100}
                    max={3000}
                    onChange={(e) => setPollIntervalMs(Number(e.target.value) || 400)}
                  />
                  <Label htmlFor="poll-attempts">次数</Label>
                  <Input
                    id="poll-attempts"
                    className="h-8 w-16"
                    type="number"
                    value={pollMaxAttempts}
                    min={1}
                    max={20}
                    onChange={(e) => setPollMaxAttempts(Number(e.target.value) || 6)}
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
          {(paramDeviceId || paramAvd) && (
            <div className="text-muted-foreground ml-2 text-xs">
              目标: {paramAvd ? `AVD ${paramAvd}` : ''}{' '}
              {paramDeviceId ? `(DeviceId ${paramDeviceId})` : ''}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          加载失败: {error}
          {(/no running device/i.test(error) || /emulator/i.test(error)) && (
            <div className="mt-2">
              请先在 Devices 页面启动 Android 模拟器与 Appium 服务。
              <a href="/devices" className="ml-2 underline">
                前往 Devices
              </a>
              <Button
                className="ml-3"
                size="sm"
                variant="secondary"
                onClick={startAppiumNow}
                disabled={startingAppium}
              >
                {startingAppium ? '正在启动 Appium…' : '一键启动 Appium'}
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-4">
        {/* Canvas side with zoom/pan */}
        <div className="flex flex-col gap-2 select-none">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={zoomOut}>
              -
            </Button>
            <div className="w-16 text-center text-sm">{Math.round(zoom * 100)}%</div>
            <Button variant="outline" size="sm" onClick={zoomIn}>
              +
            </Button>
            <Button variant="outline" size="sm" onClick={zoomReset}>
              重置
            </Button>
            <div
              className={`ml-2 text-xs ${spaceDown ? 'text-blue-600' : 'text-muted-foreground'}`}
            >
              按住空格拖拽
            </div>
            <div className="ml-4 flex items-center gap-2 text-xs">
              <input
                id="toggle-center"
                type="checkbox"
                className="h-4 w-4"
                checked={autoCenterOnClick}
                onChange={(e) => setAutoCenterOnClick(e.target.checked)}
              />
              <label htmlFor="toggle-center" className="cursor-pointer select-none">
                点击居中
              </label>
            </div>
          </div>
          <div
            ref={viewportRef}
            className={`relative h-[640px] w-[380px] overflow-hidden rounded-md border ${spaceDown ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            {data ? (
              <>
                <div
                  className="absolute top-0 left-0"
                  style={{
                    width: viewportSize.w * zoom,
                    height: viewportSize.h * zoom,
                    transform: `translate(${pan.x}px, ${pan.y}px)`,
                  }}
                >
                  <img
                    alt="screenshot"
                    src={
                      data.screenshotUrl
                        ? data.screenshotUrl
                        : data.screenshotBase64
                          ? `data:image/png;base64,${data.screenshotBase64}`
                          : null
                    }
                    className="h-full w-full select-none"
                    draggable={false}
                  />
                  {/* Overlay */}
                  <div className="pointer-events-none absolute top-0 left-0 h-full w-full">
                    {filteredNodes.map((n) => {
                      const left = Math.round(n.bounds.x1 * scale.sx * zoom)
                      const top = Math.round(n.bounds.y1 * scale.sy * zoom)
                      const width = Math.max(
                        2,
                        Math.round((n.bounds.x2 - n.bounds.x1) * scale.sx * zoom)
                      )
                      const height = Math.max(
                        2,
                        Math.round((n.bounds.y2 - n.bounds.y1) * scale.sy * zoom)
                      )
                      const selected = selectedId === n.nodeId
                      const hovered = hoveredId === n.nodeId
                      return (
                        <div
                          key={n.nodeId}
                          className={
                            'absolute box-border rounded-sm ' +
                            (selected
                              ? 'border-2 border-blue-500 bg-blue-500/10'
                              : hovered
                                ? 'border-2 border-amber-500 bg-amber-500/10'
                                : 'border border-emerald-500 bg-emerald-500/10')
                          }
                          style={{ left, top, width, height }}
                        />
                      )
                    })}
                  </div>
                  {/* Click layer */}
                  <div className="absolute top-0 left-0 h-full w-full">
                    {filteredNodes.map((n) => {
                      const left = Math.round(n.bounds.x1 * scale.sx * zoom)
                      const top = Math.round(n.bounds.y1 * scale.sy * zoom)
                      const width = Math.max(
                        2,
                        Math.round((n.bounds.x2 - n.bounds.x1) * scale.sx * zoom)
                      )
                      const height = Math.max(
                        2,
                        Math.round((n.bounds.y2 - n.bounds.y1) * scale.sy * zoom)
                      )
                      return (
                        <button
                          key={n.nodeId}
                          type="button"
                          className="absolute cursor-pointer border-transparent bg-transparent p-0"
                          style={{ left, top, width, height }}
                          onClick={() => {
                            setSelectedId(n.nodeId)
                            if (autoCenterOnClick) {
                              centerOn(n)
                            }
                          }}
                          title={`${n.class} ${n.text || ''}`.trim()}
                          onMouseEnter={() => setHoveredId(n.nodeId)}
                          onMouseLeave={() => setHoveredId((id) => (id === n.nodeId ? null : id))}
                        />
                      )
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-muted-foreground flex h-[640px] w-full items-center justify-center rounded-md border text-sm">
                {loading ? '加载中…' : '暂无快照'}
              </div>
            )}
          </div>
        </div>

        {/* Tree view with compact right-side toggle */}
        <div className="flex min-h-[640px] items-center rounded-lg border">
          {showTree && (
            <div className="ml-2 min-h-[640px] w-[320px] overflow-auto text-sm">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-semibold">元素树</div>
              </div>
              {data ? (
                <Tree
                  nodes={buildTree(filteredNodes)}
                  selectedId={selectedId}
                  onSelect={(id) => {
                    setSelectedId(id)
                    const n = data.nodes.find((x) => x.nodeId === id)
                    if (n) centerOn(n)
                  }}
                />
              ) : (
                <div className="text-muted-foreground">No Data</div>
              )}
            </div>
          )}
          <div className="flex h-[640px] items-center">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowTree((v) => !v)}
              title={showTree ? '收起元素树' : '展开元素树'}
              aria-label={showTree ? 'Collapse tree' : 'Expand tree'}
            >
              {showTree ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Side panel */}
        <div className="flex min-h-[640px] flex-1 flex-col gap-3 rounded-lg border p-4">
          <div className="scroll-auto text-base font-semibold">元素详情</div>
          {selectedNode ? (
            <div className="flex flex-col gap-2 text-sm">
              <div>nodeId: {selectedNode.nodeId}</div>
              <div>class: {selectedNode.class}</div>
              <div>text: {selectedNode.text || '(空)'}</div>
              <div>resource-id: {selectedNode.resourceId || '(空)'}</div>
              <div>content-desc: {selectedNode.contentDesc || '(空)'}</div>
              <div>clickable: {selectedNode.clickable ? '是' : '否'}</div>
              <div>bounds: {formatBounds(selectedNode.bounds)}</div>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-base font-semibold">定位建议</div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const all = buildSuggestions(selectedNode, centerOf(selectedNode.bounds))
                      .map((s) => s.code)
                      .join('\n')
                    navigator.clipboard.writeText(all)
                    toast.success('已复制全部定位')
                  }}
                >
                  复制全部
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={tapSelected} disabled={tapping}>
                  {tapping ? '点击中…' : '在设备上点击选中元素'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const c = centerOf(selectedNode.bounds)
                    navigator.clipboard.writeText(`${c.x},${c.y}`)
                    toast.success('已复制中心坐标')
                  }}
                >
                  复制中心坐标
                </Button>
              </div>

              <div className="flex flex-col gap-2">
                {buildSuggestions(selectedNode, centerOf(selectedNode.bounds)).map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 rounded-md border p-2"
                  >
                    <div className="max-w-[70%] truncate text-xs">
                      <div className="font-medium">{s.label}</div>
                      <div className="text-muted-foreground truncate">{s.code}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(s.code)
                          toast.success('已复制')
                        }}
                      >
                        复制
                      </Button>
                      {s.using && s.value && (
                        <Button
                          variant="secondary"
                          onClick={async () => {
                            try {
                              const res = await fetch('/api/inspector/find-and-tap', {
                                method: 'POST',
                                headers: {
                                  'content-type': 'application/json',
                                },
                                body: JSON.stringify({
                                  using: s.using,
                                  value: s.value,
                                  action: 'tap',
                                  deviceId: paramDeviceId ?? undefined,
                                }),
                              })
                              if (!res.ok) {
                                const msg = await res.text()
                                toast.error(`验证失败: ${msg}`)
                              } else {
                                toast.success('验证点击成功')
                                const prevAt = data?.takenAt
                                const maxAttempts = Math.max(1, Math.min(20, pollMaxAttempts | 0))
                                const delay = Math.max(100, Math.min(3000, pollIntervalMs | 0))
                                for (let i = 0; i < maxAttempts; i++) {
                                  await new Promise((r) => setTimeout(r, delay))
                                  const snap = await refresh()
                                  if (snap && prevAt && snap.takenAt !== prevAt) break
                                }
                              }
                            } catch (e: any) {
                              toast.error(`验证失败: ${e?.message || e}`)
                            }
                          }}
                        >
                          验证
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">
              点击左侧元素高亮框查看详情与定位代码
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
