'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AppiumToggleButton } from '@/components/appium-toggle-button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ParametersForm, type ParametersFormHandle } from '@/components/settings/parameters-form'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { normalizeResponseError, isUnauthorizedError } from '@/lib/error'
import {
  RefreshCwIcon,
  ChevronRight,
  ChevronLeft,
  SlidersHorizontal,
  Filter,
  Target,
  ImagePlay,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import AndroidInspector from '@/components/android-inspector'

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
  fsTriggered?: boolean
  fsMessage?: string
}

function useSnapshot(deviceId?: string | null) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Snapshot | null>(() => {
    try {
      const warmEnabled = (() => {
        try { const s = localStorage.getItem('gtt:inspector:cacheWarmEnabled'); return s == null ? true : (s === '1' || s === 'true') } catch { return true }
      })()
      if (!warmEnabled) return null
      const g: any = globalThis as any
      if (deviceId && g.__inspectorLast && typeof g.__inspectorLast.get === 'function') {
        return g.__inspectorLast.get(deviceId) || null
      }
      if (deviceId) {
        const raw = sessionStorage.getItem(`gtt:inspector:last:${deviceId}`)
        if (raw) {
          const obj = JSON.parse(raw)
          const ttl = (() => {
            try {
              const v = localStorage.getItem('gtt:inspector:cacheTtlMs')
              const n = v ? parseInt(v, 10) : 15000
              return Math.max(1000, Math.min(60000, Number.isFinite(n) ? n : 15000))
            } catch { return 15000 }
          })()
          if (!obj.cachedAt || Date.now() - obj.cachedAt <= ttl) return obj
        }
      }
    } catch {}
    return null
  })
  const [warmCached, setWarmCached] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inflightRef = useRef<Promise<Snapshot | null> | null>(null)
  const lastFetchAtRef = useRef<number>(0)

  const fetchSnapshot = async (): Promise<Snapshot | null> => {
    try {
      // Coalesce in-flight requests
      if (inflightRef.current) return await inflightRef.current
      // Throttle burst calls (e.g. on page switch + settings updates)
      const now = Date.now()
      const throttleMs = (() => {
        try {
          const v = localStorage.getItem('gtt:inspector:snapshot:intervalMs')
          const n = v ? parseInt(v, 10) : 1200
          return Math.max(400, Math.min(5000, Number.isFinite(n) ? n : 1200))
        } catch {
          return 1200
        }
      })()
      if (now - lastFetchAtRef.current < throttleMs) {
        return data // return last data without new network call
      }
      setLoading(true)
      setError(null)
      // Prefer real backend; only fallback to mock if proxy not configured (503)
      const params = new URLSearchParams()
      if (deviceId) params.set('deviceId', deviceId)
      try {
        const v = localStorage.getItem('gtt:inspector:snapshot:intervalMs')
        const ms = v ? Math.max(0, parseInt(v, 10) || 0) : 0
        if (ms > 0) params.set('minMs', String(ms))
        // Unified: read all snapshot parameters from localStorage with defaults
        const aw = localStorage.getItem('gtt:inspector:autoWake')
        const au = localStorage.getItem('gtt:inspector:autoUnlock')
        const pwd = localStorage.getItem('gtt:inspector:unlockPassword') || ''
        const swipe = localStorage.getItem('gtt:inspector:unlockSwipe') || ''
        const kw = localStorage.getItem('gtt:inspector:unlockKeywords') || ''
        const prefer = localStorage.getItem('gtt:inspector:preferAppiumSource')
        const fs = localStorage.getItem('gtt:inspector:fsOnAdbFail')
        const fsN = localStorage.getItem('gtt:inspector:fsFailN')
        const fsCd = localStorage.getItem('gtt:inspector:fsCooldownMs')
        const awBool = aw == null ? true : aw === '1' || aw === 'true'
        const auBool = au == null ? false : au === '1' || au === 'true'
        params.set('autoWake', awBool ? '1' : '0')
        params.set('autoUnlock', auBool ? '1' : '0')
        if (pwd) params.set('unlockPassword', pwd)
        if (swipe) params.set('unlockSwipe', swipe)
        if (kw) params.set('unlockKeywords', kw)
        if (prefer != null) params.set('preferAppium', prefer === '1' || prefer === 'true' ? '1' : '0')
        if (fs != null) params.set('fsOnAdbFail', fs === '1' || fs === 'true' ? '1' : '0')
        if (fsN) params.set('fsFailN', String(Math.max(1, parseInt(fsN, 10) || 1)))
        if (fsCd) params.set('fsCooldown', String(Math.max(0, parseInt(fsCd, 10) || 0)))
      } catch {}
      const qs = params.toString() ? `?${params.toString()}` : ''
      const req = fetch(`/api/inspector/snapshot${qs}`, { cache: 'no-store' })
      const p = req.then(async (res) => {
        if (res.status === 503) {
          const mockRes = await fetch('/api/mock/inspector/snapshot', { cache: 'no-store' })
          if (!mockRes.ok) throw new Error(`HTTP ${mockRes.status}`)
          return (await mockRes.json()) as Snapshot
        }
        if (!res.ok) {
          // Provide a friendlier message, especially for 404 from backend (Nest NotFoundException)
          const friendly404 =
            'No running device or snapshot found. Please start an Android emulator and Appium from the Devices page.'
          if (res.status === 404) {
            throw new Error(friendly404)
          }
          let msg = `HTTP ${res.status}`
          try {
            const j = await res.json()
            const messageField = Array.isArray(j?.message) ? j.message.join('\n') : j?.message
            if (j?.error === 'Not Found' && messageField) {
              msg = String(messageField)
            } else {
              msg = messageField || j?.details || j?.error || msg
            }
            if (/no running device|emulator/i.test(msg)) msg = friendly404
          } catch {}
          throw new Error(msg)
        }
        return (await res.json()) as Snapshot
      })
      inflightRef.current = p
      let json: Snapshot | null = null
      try {
        json = await p
      } finally {
        inflightRef.current = null
      }
      setData(json)
      setWarmCached(false)
      // Save to warm caches (memory + sessionStorage)
      try {
        const warmEnabled = (() => {
          try { const s = localStorage.getItem('gtt:inspector:cacheWarmEnabled'); return s == null ? true : (s === '1' || s === 'true') } catch { return true }
        })()
        const g: any = globalThis as any
        const payload: any = { ...json, screenshotBase64: undefined, cachedAt: Date.now() }
        if (warmEnabled && deviceId) {
          if (!g.__inspectorLast) g.__inspectorLast = new Map<string, any>()
          g.__inspectorLast.set(deviceId, payload)
          try { sessionStorage.setItem(`gtt:inspector:last:${deviceId}`, JSON.stringify(payload)) } catch {}
        }
      } catch {}
      try {
        if (json && (json as any).fsTriggered) {
          const msg = (json as any).fsMessage || 'ADB 异常，已触发 UiAutomator2 force-stop'
          // @ts-ignore sonner may not type warning; safe to call
          ;(toast as any).warning ? (toast as any).warning(msg) : toast.message(msg)
        }
      } catch {}
      lastFetchAtRef.current = Date.now()
      return json
    } catch (e: any) {
      setError(e?.message || 'Failed to load snapshot')
      return null
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Warm start from in-memory/session cache to avoid flicker
    try {
      const warmEnabled = (() => {
        try { const s = localStorage.getItem('gtt:inspector:cacheWarmEnabled'); return s == null ? true : (s === '1' || s === 'true') } catch { return true }
      })()
      const g: any = globalThis as any
      const ttl = (() => {
        try {
          const v = localStorage.getItem('gtt:inspector:cacheTtlMs')
          const n = v ? parseInt(v, 10) : 15000
          return Math.max(1000, Math.min(60000, Number.isFinite(n) ? n : 15000))
        } catch { return 15000 }
      })()
      if (!data && deviceId && warmEnabled) {
        const cached = g.__inspectorLast?.get?.(deviceId)
        if (cached && (!cached.cachedAt || Date.now() - cached.cachedAt <= ttl)) {
          setData(cached)
          setWarmCached(true)
        } else {
          try {
            const raw = sessionStorage.getItem(`gtt:inspector:last:${deviceId}`)
            if (raw) {
              const obj = JSON.parse(raw)
              if (!obj.cachedAt || Date.now() - obj.cachedAt <= ttl) {
                setData(obj)
                setWarmCached(true)
              }
            }
          } catch {}
        }
      } else {
        setWarmCached(false)
      }
    } catch {}
    fetchSnapshot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId])

  return { loading, data, error, refresh: fetchSnapshot, warmCached }
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
    const rid = n.resourceId
    const full = /[:/]/.test(rid)
    if (full) {
      const escRid = rid.replace(/\"/g, '\\"')
      suggestions.push({
        label: 'UiSelector resourceId (JS)',
        code: `await $('android=new UiSelector().resourceId(\"${escRid}\")').click()`,
        using: 'android uiautomator',
        value: `new UiSelector().resourceId(\"${escRid}\")`,
      })
    } else {
      const escRid = rid.replace(/\"/g, '\\"')
      suggestions.push({
        label: 'UiSelector resourceIdMatches (JS)',
        code: `await $('android=new UiSelector().resourceIdMatches(\".*${escRid}\")').click()`,
        using: 'android uiautomator',
        value: `new UiSelector().resourceIdMatches(\".*${escRid}\")`,
      })
    }
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
      label: 'Tap by coordinate (JS)',
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
    const rid = n.resourceId
    const full = /[:/]/.test(rid)
    if (full) {
      const escRid = rid.replace(/\"/g, '\\"')
      suggestions.push({
        label: 'UiSelector resourceId (JS)',
        code: `await $('android=new UiSelector().resourceId(\"${escRid}\")').click()`,
      })
    } else {
      const escRid = rid.replace(/\"/g, '\\"')
      suggestions.push({
        label: 'UiSelector resourceIdMatches (JS)',
        code: `await $('android=new UiSelector().resourceIdMatches(\".*${escRid}\")').click()`,
      })
    }
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
      label: 'Tap by coordinate (JS)',
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
  // Allow selecting a device (USB or running emulator serial) from within the page; persisted
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(() => {
    if (typeof window === 'undefined') return paramDeviceId || ''
    try {
      const saved = localStorage.getItem('gtt:inspector:selectedDeviceId')
      if (saved) return saved
    } catch {}
    return paramDeviceId || ''
  })
  const effectiveDeviceId = selectedDeviceId || paramDeviceId || undefined
  const paramsRef = useRef<ParametersFormHandle | null>(null)
  // Persisting moved to settings page
  const { data, loading, error, refresh, warmCached } = useSnapshot(effectiveDeviceId)
  const [hideWarmTip, setHideWarmTip] = useState<boolean>(() => {
    try { return (sessionStorage.getItem('gtt:inspector:warmTipDismissed:tools') || '') === '1' } catch { return false }
  })
  useEffect(() => {
    if (warmCached) {
      try {
        const dism = (sessionStorage.getItem('gtt:inspector:warmTipDismissed:tools') || '')
        setHideWarmTip(dism === '1')
      } catch { setHideWarmTip(false) }
    }
  }, [warmCached])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [autoCenterOnClick, setAutoCenterOnClick] = useState(false)
  const [showClickableOnly, setShowClickableOnly] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    try {
      const v = localStorage.getItem('gtt:inspector:clickableOnly')
      return v == null ? true : v === '1' || v === 'true'
    } catch {}
    return true
  })
  const [overlayMode, setOverlayMode] = useState<'boxes' | 'markers'>(() => {
    if (typeof window === 'undefined') return 'boxes'
    try {
      const v = localStorage.getItem('gtt:inspector:overlayMode')
      return v === 'markers' ? 'markers' : 'boxes'
    } catch {}
    return 'boxes'
  })
  const [filterText, setFilterText] = useState('')
  const [selectedAvd, setSelectedAvd] = useState(paramAvd || '')
  // Filters are now in a collapsible; no persistent state needed
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

  // Persist clickable-only preference (shared with Libs page embed)
  useEffect(() => {
    try {
      localStorage.setItem('gtt:inspector:clickableOnly', showClickableOnly ? '1' : '0')
    } catch {}
  }, [showClickableOnly])

  // Hot-apply overlay and clickable-only when saved in Parameters
  useEffect(() => {
    const handler = () => {
      try {
        const v = localStorage.getItem('gtt:inspector:clickableOnly')
        setShowClickableOnly(v == null ? true : v === '1' || v === 'true')
        const m = localStorage.getItem('gtt:inspector:overlayMode')
        setOverlayMode(m === 'markers' ? 'markers' : 'boxes')
      } catch {}
    }
    window.addEventListener('storage', handler)
    window.addEventListener('gtt-parameters-updated', handler as any)
    return () => {
      window.removeEventListener('storage', handler)
      window.removeEventListener('gtt-parameters-updated', handler as any)
    }
  }, [])

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
    const isEditableTarget = (el: EventTarget | null) => {
      const t = el as HTMLElement | null
      if (!t) return false
      const tag = (t.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea') return true
      if ((t as HTMLElement).isContentEditable) return true
      try {
        if (t.closest && (t.closest('.cm-editor') || t.closest('[role="textbox"]'))) return true
      } catch {}
      return false
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        if (isEditableTarget(e.target)) return
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
  const preferRef = useRef<boolean | null>(null)
  const [autoRefresh, setAutoRefresh] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      const v = localStorage.getItem('gtt:inspector:snapshot:autoRefresh')
      return v === '1' || v === 'true'
    } catch {}
    return false
  })
  const POLL_MS = 3000
  // Short-polling config for post-action refresh
  const [pollIntervalMs, setPollIntervalMs] = useState<number>(() => {
    if (typeof window === 'undefined') return 400
    try {
      const raw = localStorage.getItem('gtt:inspector:snapshot:intervalMs')
      const n = raw ? parseInt(raw, 10) : 400
      return Math.max(100, Math.min(3000, Number.isFinite(n) ? n : 400))
    } catch {}
    return 400
  })
  const [pollMaxAttempts, setPollMaxAttempts] = useState<number>(() => {
    if (typeof window === 'undefined') return 6
    try {
      const raw = localStorage.getItem('gtt:inspector:snapshot:maxAttempts')
      const n = raw ? parseInt(raw, 10) : 6
      return Math.max(1, Math.min(20, Number.isFinite(n) ? n : 6))
    } catch {}
    return 6
  })
  const startAppiumNow = async () => {
    setStartingAppium(true)
    try {
      const res = await fetch('/api/android/appium/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        if (isUnauthorizedError(err)) {
          throw new Error('Unauthorized')
        }
        throw new Error(err.message || `HTTP ${res.status}`)
      }
      const data = await res.json().catch(() => ({}) as any)
      const port = (data as any)?.port
      toast.success(port ? `Appium server started on ${port}` : 'Appium server started')
      // 尝试刷新快照
      await refresh()
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || 'Failed to start Appium')
      }
    } finally {
      setStartingAppium(false)
    }
  }

  // Force refresh when "preferAppium" changes in Parameters
  useEffect(() => {
    const readPrefer = (): boolean => {
      try {
        const s = localStorage.getItem('gtt:inspector:preferAppiumSource')
        return s === '1' || s === 'true'
      } catch {}
      return false
    }
    preferRef.current = readPrefer()
    const onPrefChange = () => {
      const cur = readPrefer()
      if (preferRef.current !== cur) {
        preferRef.current = cur
        void refresh()
      }
    }
    window.addEventListener('storage', onPrefChange)
    window.addEventListener('gtt-parameters-updated', onPrefChange as any)
    return () => {
      window.removeEventListener('storage', onPrefChange)
      window.removeEventListener('gtt-parameters-updated', onPrefChange as any)
    }
  }, [refresh])

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

  // Persist snapshot target selection
  useEffect(() => {
    try {
      if (selectedDeviceId) localStorage.setItem('gtt:inspector:selectedDeviceId', selectedDeviceId)
      else localStorage.removeItem('gtt:inspector:selectedDeviceId')
    } catch {}
  }, [selectedDeviceId])

  // Toolbar: emulator list + appium status
  type AndroidEmulatorResponse = {
    avds: string[]
    running: {
      serial: string
      avd: string | null
      deviceName: string | null
    } | null
  }

  // Auto refresh controls for device/emulator lists
  const [listsAutoRefresh, setListsAutoRefresh] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    try {
      const v = localStorage.getItem('gtt:inspector:lists:autoRefresh')
      return v == null ? true : v === '1' || v === 'true'
    } catch {}
    return true
  })
  const [listsRefreshSec, setListsRefreshSec] = useState<number>(() => {
    if (typeof window === 'undefined') return 3
    try {
      const v = parseInt(localStorage.getItem('gtt:inspector:lists:refreshSec') || '3', 10)
      return Number.isFinite(v) && v >= 1 ? v : 3
    } catch {}
    return 3
  })
  useEffect(() => {
    try {
      localStorage.setItem('gtt:inspector:lists:autoRefresh', listsAutoRefresh ? '1' : '0')
    } catch {}
  }, [listsAutoRefresh])
  useEffect(() => {
    try {
      localStorage.setItem('gtt:inspector:lists:refreshSec', String(listsRefreshSec | 0))
    } catch {}
  }, [listsRefreshSec])

  const emulatorQuery = useQuery<AndroidEmulatorResponse>({
    queryKey: ['android-emulators-for-inspector'],
    queryFn: async () => {
      const res = await fetch('/api/android/emulators', { method: 'GET' })
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        throw new Error(err.message || 'Failed to fetch emulators')
      }
      return res.json()
    },
    staleTime: 5000,
    refetchOnWindowFocus: false,
    refetchInterval: listsAutoRefresh ? Math.max(1000, (listsRefreshSec || 1) * 1000) : false,
    refetchIntervalInBackground: listsAutoRefresh,
  })

  useEffect(() => {
    const list = emulatorQuery.data?.avds ?? []
    if (list.length && !selectedAvd) setSelectedAvd(list[0])
  }, [emulatorQuery.data?.avds, selectedAvd])

  // USB Android devices list (adb devices)
  const androidDevicesQuery = useQuery<{ devices: string }>({
    queryKey: ['android-devices-for-inspector'],
    queryFn: async () => {
      const res = await fetch('/api/android/devices', { method: 'GET' })
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        throw new Error(err.message || 'Failed to fetch devices')
      }
      return res.json()
    },
    staleTime: 3000,
    refetchOnWindowFocus: false,
    refetchInterval: listsAutoRefresh ? Math.max(1000, (listsRefreshSec || 1) * 1000) : false,
    refetchIntervalInBackground: listsAutoRefresh,
  })

  const usbDeviceSerials = useMemo(() => {
    const output = androidDevicesQuery.data?.devices ?? ''
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && line.endsWith('device') && !line.startsWith('emulator-'))
      .map((line) => line.split(/\s+/)[0])
  }, [androidDevicesQuery.data?.devices])

  // Initialize selection with first USB device if none pre-selected
  useEffect(() => {
    if (!selectedDeviceId && usbDeviceSerials.length > 0) {
      setSelectedDeviceId(usbDeviceSerials[0])
    }
  }, [usbDeviceSerials, selectedDeviceId])

  const startEmulatorMutation = useMutation<any, Error, { avd: string }>({
    mutationFn: async ({ avd }) => {
      const res = await fetch('/api/android/emulators/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ avd, headless: false, reset: false }),
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        throw new Error(err.message || 'Failed to start emulator')
      }
      return res.json()
    },
    onSuccess: async (data) => {
      toast.success(data?.message ?? 'Emulator started')
      await emulatorQuery.refetch()
      await refresh()
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to start emulator'),
  })

  // Read-only LLM info (server settings)
  const [llmInfo, setLlmInfo] = useState<{
    provider: string
    model: string
    hasApiKey: boolean
  } | null>(null)
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/settings/ai', { cache: 'no-store' })
        if (!res.ok) return
        const j = await res.json()
        setLlmInfo({
          provider: (j?.provider || '').toLowerCase() || 'openai',
          model: j?.model || '',
          hasApiKey: !!j?.hasApiKey,
        })
      } catch {}
    }
    load()
  }, [])

  // Hot-apply settings when saved in Parameters
  useEffect(() => {
    const handler = () => {
      try {
        const readInt = (k: string, d: number) => {
          const raw = localStorage.getItem(k)
          if (!raw) return d
          const n = parseInt(raw, 10)
          return Number.isFinite(n) ? n : d
        }
        const listsAuto = localStorage.getItem('gtt:inspector:lists:autoRefresh')
        setListsAutoRefresh(listsAuto == null ? true : listsAuto === '1' || listsAuto === 'true')
        setListsRefreshSec(Math.max(1, Math.min(60, readInt('gtt:inspector:lists:refreshSec', 3))))

        const ar = localStorage.getItem('gtt:inspector:snapshot:autoRefresh')
        setAutoRefresh(ar === '1' || ar === 'true')
        setPollIntervalMs(
          Math.max(100, Math.min(3000, readInt('gtt:inspector:snapshot:intervalMs', 400)))
        )
        setPollMaxAttempts(
          Math.max(1, Math.min(20, readInt('gtt:inspector:snapshot:maxAttempts', 6)))
        )
        // Re-fetch to apply new snapshot parameters immediately
        try {
          refresh()
        } catch {}
      } catch {}
    }
    window.addEventListener('storage', handler)
    window.addEventListener('gtt-parameters-updated', handler as any)
    return () => {
      window.removeEventListener('storage', handler)
      window.removeEventListener('gtt-parameters-updated', handler as any)
    }
  }, [])

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
          deviceId: effectiveDeviceId ?? undefined,
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

  // Throttle error toasts to reduce noise during retries
  const lastToastRef = useRef<number>(0)
  useEffect(() => {
    if (!error) return
    const now = Date.now()
    const silentPatterns = [/No running device or snapshot found/i, /Failed to dump UI hierarchy/i]
    if (silentPatterns.some((re) => re.test(error))) {
      // suppress repetitive friendly 404 messages
      return
    }
    if (now - lastToastRef.current > 8000) {
      toast.error(error)
      lastToastRef.current = now
    }
  }, [error])

  // Build snapshot target options (running emulator + USB devices)
  const runningEmu = emulatorQuery.data?.running ?? null
  const snapshotOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = []
    if (runningEmu?.serial) {
      const name = runningEmu.deviceName || runningEmu.avd || runningEmu.serial
      opts.push({ value: runningEmu.serial, label: `Emulator ${name}` })
    }
    for (const serial of usbDeviceSerials) {
      opts.push({ value: serial, label: `Device ${serial}` })
    }
    return opts
  }, [runningEmu?.serial, runningEmu?.deviceName, runningEmu?.avd, usbDeviceSerials])

  // Ensure selected target exists; default to running emulator, otherwise first USB
  useEffect(() => {
    if (snapshotOptions.length === 0) return
    const values = new Set(snapshotOptions.map((o) => o.value))
    if (!selectedDeviceId || !values.has(selectedDeviceId)) {
      const running = runningEmu?.serial
      if (running && values.has(running)) {
        setSelectedDeviceId(running)
      } else if (usbDeviceSerials.length > 0) {
        setSelectedDeviceId(usbDeviceSerials[0])
      }
    }
  }, [snapshotOptions, runningEmu?.serial, usbDeviceSerials, selectedDeviceId])

  return (
    <div className="flex w-full flex-1 flex-col gap-2">
      <div className="flex gap-2">
        <div className="flex gap-2">
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
            <div className="flex items-center rounded-lg border">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    onClick={refresh}
                    disabled={loading}
                    size={'icon'}
                    className="h-8 w-8 rounded-full p-0"
                  >
                    <ImagePlay className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>Refresh snapshot</TooltipContent>
              </Tooltip>
              <AppiumToggleButton
                queryKey={['appium-status', 'inspector']}
                pollIntervalMs={
                  listsAutoRefresh ? Math.max(1000, (listsRefreshSec || 1) * 1000) : false
                }
                onAfterChange={async () => {
                  try {
                    await refresh()
                  } catch {}
                }}
              />
            </div>

            {/* Settings link (non-collapsible) */}
            <Tooltip>
              <Dialog>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      aria-label="Settings"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>Settings</TooltipContent>
                <DialogContent className="max-w-3xl overflow-hidden p-0 sm:max-w-3xl">
                  <div className="flex h-[80vh] flex-col">
                    <div className="bg-background border-b p-6">
                      <DialogHeader>
                        <DialogTitle>Parameters</DialogTitle>
                      </DialogHeader>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6">
                      <ParametersForm ref={paramsRef} hideActions />
                    </div>
                    <div className="bg-background border-t p-4">
                      <DialogFooter>
                        <Button onClick={() => paramsRef.current?.save()}>Save</Button>
                        <Button variant="outline" onClick={() => paramsRef.current?.reset()}>
                          Reset
                        </Button>
                        <DialogClose asChild>
                          <Button variant="outline">Close</Button>
                        </DialogClose>
                      </DialogFooter>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </Tooltip>

            {/* Filters collapsible */}
            <Collapsible className="rounded-lg border">
              <Tooltip>
                <TooltipTrigger asChild>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      aria-label="Filters"
                    >
                      <Filter className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>Filters</TooltipContent>
              </Tooltip>
              <CollapsibleContent>
                <div className="mt-2 flex min-h-[var(--inspector-collapsible-min-h)] flex-wrap items-center gap-2 rounded-lg border p-2">
                  <Label htmlFor="filter">Filter by:</Label>
                  <Input
                    id="filter"
                    placeholder="Search by text/id/desc"
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
                      Clickable only
                    </label>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Snapshot target collapsible */}
            <Collapsible className="rounded-lg border">
              <Tooltip>
                <TooltipTrigger asChild>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      aria-label="Snapshot target"
                    >
                      <Target className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>Snapshot target</TooltipContent>
              </Tooltip>
              <CollapsibleContent>
                <div className="mt-2 flex min-h-[var(--inspector-collapsible-min-h)] flex-wrap items-center gap-2 rounded-lg border p-2">
                  <Label htmlFor="snapshot-target" className="text-muted-foreground text-xs">
                    Snapshot target
                  </Label>
                  <Select value={selectedDeviceId} onValueChange={(v) => setSelectedDeviceId(v)}>
                    <SelectTrigger id="snapshot-target" className="w-[220px]">
                      <SelectValue placeholder="Select device/emulator" />
                    </SelectTrigger>
                    <SelectContent>
                      {snapshotOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Refresh device list */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 rounded-full"
                        onClick={() => {
                          emulatorQuery.refetch().catch(() => {})
                          androidDevicesQuery.refetch().catch(() => {})
                        }}
                        aria-label="Refresh device list"
                        disabled={emulatorQuery.isFetching || androidDevicesQuery.isFetching}
                      >
                        <RefreshCwIcon
                          className={cn(
                            'h-4 w-4',
                            (emulatorQuery.isFetching || androidDevicesQuery.isFetching) &&
                              'animate-spin'
                          )}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent sideOffset={6}>Refresh device list</TooltipContent>
                  </Tooltip>
                  {/* Lists auto-refresh controls moved to Settings > Parameters */}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(paramDeviceId || paramAvd) && (
            <div className="text-muted-foreground ml-2 text-xs">
              Dest: {paramAvd ? `AVD ${paramAvd}` : ''}{' '}
              {paramDeviceId ? `(DeviceId ${paramDeviceId})` : ''}
            </div>
          )}
        </div>
      </div>

      {/* Error messages are shown via toasts */}

      <div className="relative flex gap-2 overflow-auto">
        {warmCached && !hideWarmTip && (
          <div className="text-muted-foreground absolute right-4 bottom-4 z-10 flex items-center gap-2 rounded bg-yellow-100/90 px-2 py-1 text-[11px] text-yellow-800 shadow">
            <span>
              显示缓存快照
              {(data as any)?.cachedAt
                ? `（缓存于 ${(() => {
                    const ts = (data as any)?.cachedAt as number
                    const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
                    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${s % 60 ? s % 60 + 's' : ''}`
                  })()} 前）`
                : ''}
              ，已自动刷新中
            </span>
            <button
              type="button"
              aria-label="dismiss"
              className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-yellow-300/60 text-yellow-800 hover:bg-yellow-200/60"
              onClick={() => { try { sessionStorage.setItem('gtt:inspector:warmTipDismissed:tools', '1') } catch {}; setHideWarmTip(true) }}
            >
              ×
            </button>
          </div>
        )}
        {/* Canvas side with zoom/pan */}
        <AndroidInspector
          zoom={zoom}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onZoomReset={zoomReset}
          autoCenterOnClick={autoCenterOnClick}
          setAutoCenterOnClick={setAutoCenterOnClick}
          viewportRef={viewportRef}
          spaceDown={spaceDown}
          dragging={dragging}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          data={data}
          viewportSize={viewportSize}
          scale={scale}
          pan={pan}
          filteredNodes={filteredNodes}
          selectedId={selectedId}
          hoveredId={hoveredId}
          setSelectedId={setSelectedId}
          setHoveredId={setHoveredId}
          centerOn={centerOn}
          loading={loading}
          overlayMode={overlayMode}
        />

        {/* Tree view with compact right-side toggle */}
        <div
          className="relative flex items-stretch rounded-lg border"
          style={{
            width: showTree ? undefined : Math.max(40, collapsedWidth * 2),
          }}
        >
          {showTree && (
            <div className="ml-2 min-h-[640px] w-[320px] overflow-auto rounded-lg text-sm">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-semibold">Elements:</div>
              </div>
              {data ? (
                <Tree
                  nodes={buildTree(filteredNodes)}
                  selectedId={selectedId}
                  onSelect={(id) => {
                    setSelectedId(id)
                    const n = data.nodes.find((x) => x.nodeId === id)
                    if (n && autoCenterOnClick) centerOn(n)
                  }}
                />
              ) : (
                <div className="text-muted-foreground">No Data</div>
              )}
            </div>
          )}
          <div className="pointer-events-none absolute top-1/2 right-1 z-40 -translate-y-1/2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="pointer-events-auto h-7 w-7 rounded-full border p-0 shadow"
                  onClick={() => setShowTree((v) => !v)}
                  tabIndex={-1}
                  type="button"
                  aria-label={showTree ? 'Collapse element tree' : 'Expand element tree'}
                >
                  {showTree ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>
                {showTree ? 'Collapse element tree' : 'Expand element tree'}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Side panel */}
        <div className="flex flex-1 flex-col overflow-auto rounded-lg border p-2">
          <div className="scroll-auto text-base font-semibold">Element Details</div>
          {selectedNode ? (
            <div className="flex flex-col text-sm">
              <div>nodeId: {selectedNode.nodeId}</div>
              <div>class: {selectedNode.class}</div>
              <div>text: {selectedNode.text || '(Empty)'}</div>
              <div>resource-id: {selectedNode.resourceId || '(Empty)'}</div>
              <div>content-desc: {selectedNode.contentDesc || '(Empty)'}</div>
              <div>clickable: {selectedNode.clickable ? 'Yes' : 'No'}</div>
              <div>bounds: {formatBounds(selectedNode.bounds)}</div>
              <div className="flex items-center justify-between">
                <div className="text-base font-semibold">Suggest</div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const all = buildSuggestions(selectedNode, centerOf(selectedNode.bounds))
                      .map((s) => s.code)
                      .join('\n')
                    navigator.clipboard.writeText(all)
                    toast.success('Copied')
                  }}
                >
                  CopyAll
                </Button>
              </div>
              <div className="flex items-center">
                <Button variant="secondary" onClick={tapSelected} disabled={tapping}>
                  {tapping ? 'Clicking...' : 'Tap on device'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const c = centerOf(selectedNode.bounds)
                    navigator.clipboard.writeText(`${c.x},${c.y}`)
                    toast.success('Coordinates copied')
                  }}
                >
                  Copy center
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
                          toast.success('Copied')
                        }}
                      >
                        Copy
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
                                  deviceId: effectiveDeviceId ?? undefined,
                                }),
                              })
                              if (!res.ok) {
                                const err = await normalizeResponseError(res)
                                toast.error(`Verify Failed: ${err.message || 'Unknown error'}`)
                              } else {
                                toast.success('Verify successful')
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
                              toast.error(`Verify Failed: ${e?.message || e}`)
                            }
                          }}
                        >
                          Verify
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">
              Click the highlighted box to locate the position.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
