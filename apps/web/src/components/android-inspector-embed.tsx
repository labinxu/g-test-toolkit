'use client'

import React, { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import AndroidInspector, { NodeInfo, Snapshot } from '@/components/android-inspector'
import { Button } from '@/components/ui/button'
import { RefreshCwIcon } from 'lucide-react'
import { toast } from 'sonner'
import { normalizeResponseError } from '@/lib/error'

export type AndroidInspectorEmbedState = {
  data: Snapshot | null
  zoom: number
  pan: { x: number; y: number }
  selectedId: string | null
  hoveredId: string | null
}

export type AndroidInspectorEmbedHandle = {
  exportState: () => AndroidInspectorEmbedState
}

type Props = {
  deviceId?: string | null
  showToolbar?: boolean
  showRefreshButton?: boolean
  refreshKey?: number
  resetKey?: number
  autoCenterOnClick?: boolean
  onAutoCenterChange?: (v: boolean) => void
  initialState?: AndroidInspectorEmbedState
  onInsertCode?: (code: string) => void
  onSuggestSelector?: (selector: string, meta?: { isInput: boolean; node: NodeInfo }) => void
  showClickableOnly?: boolean
  overlayMode?: 'boxes' | 'markers'
  /** Optional override for pageSource preference. When omitted, reads from localStorage. */
  preferAppium?: boolean
}

const AndroidInspectorEmbed = forwardRef<AndroidInspectorEmbedHandle, Props>(
  (
    {
      deviceId,
      showToolbar = true,
      showRefreshButton = true,
      refreshKey,
      resetKey,
      autoCenterOnClick: controlledAutoCenter,
      onAutoCenterChange,
      initialState,
      onInsertCode,
      onSuggestSelector,
      showClickableOnly = true,
      overlayMode = 'boxes',
      preferAppium,
    },
    ref
  ) => {
    const [data, setData] = useState<Snapshot | null>(() => initialState?.data ?? null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const inflightRef = useRef<Promise<Snapshot | null> | null>(null)
    const autoFailCountRef = useRef(0)
    const [autoPaused, setAutoPaused] = useState(false)

    const fetchSnapshot = async (opts?: {
      silent?: boolean
      fromAuto?: boolean
      force?: boolean
    }): Promise<Snapshot | null> => {
      try {
        // Respect auto-fail guard for background auto refresh
        const maxAttempts = (() => {
          try {
            const raw = localStorage.getItem('gtt:inspector:snapshot:maxAttempts')
            const n = raw ? parseInt(raw, 10) : 10
            return Number.isFinite(n) ? Math.max(1, Math.min(20, n)) : 10
          } catch {
            return 10
          }
        })()
        if (opts?.fromAuto && !opts?.force && autoFailCountRef.current >= maxAttempts) {
          if (!autoPaused) {
            setAutoPaused(true)
            const msg =
              `自动刷新已暂停：连续 ${autoFailCountRef.current} 次获取快照失败，请手动点击刷新或检查设备/服务状态。`
            setError(msg)
            toast.error(msg)
          }
          return data
        }

        if (inflightRef.current) return await inflightRef.current
        setLoading(true)
        setError(null)
        const params = new URLSearchParams()
        if (deviceId) params.set('deviceId', deviceId)
        try {
          const v = localStorage.getItem('gtt:inspector:snapshot:intervalMs')
          const ms = v ? Math.max(0, parseInt(v, 10) || 0) : 0
          if (ms > 0) params.set('minMs', String(ms))
          // Inspector parameters: autoWake/autoUnlock and unlock details
          const aw = localStorage.getItem('gtt:inspector:autoWake')
          const au = localStorage.getItem('gtt:inspector:autoUnlock')
          const pwd = localStorage.getItem('gtt:inspector:unlockPassword') || ''
          const swipe = localStorage.getItem('gtt:inspector:unlockSwipe') || ''
          const kw = localStorage.getItem('gtt:inspector:unlockKeywords') || ''
          const prefer =
            typeof preferAppium === 'boolean'
              ? preferAppium
              : (() => {
                  const s = localStorage.getItem('gtt:inspector:preferAppiumSource')
                  return s === '1' || s === 'true'
                })()
          // Defaults: autoWake=true if unset, autoUnlock=false if unset
          const awBool = aw == null ? true : aw === '1' || aw === 'true'
          const auBool = au == null ? false : au === '1' || au === 'true'
          params.set('autoWake', awBool ? '1' : '0')
          params.set('autoUnlock', auBool ? '1' : '0')
          if (pwd) params.set('unlockPassword', pwd)
          if (swipe) params.set('unlockSwipe', swipe)
          if (kw) params.set('unlockKeywords', kw)
          params.set('preferAppium', prefer ? '1' : '0')
          // Force-stop fallback settings
          try {
            const fs = localStorage.getItem('gtt:inspector:fsOnAdbFail')
            const fsN = localStorage.getItem('gtt:inspector:fsFailN')
            const fsCd = localStorage.getItem('gtt:inspector:fsCooldownMs')
            if (fs != null) params.set('fsOnAdbFail', fs === '1' || fs === 'true' ? '1' : '0')
            if (fsN) params.set('fsFailN', String(Math.max(1, parseInt(fsN, 10) || 1)))
            if (fsCd) params.set('fsCooldown', String(Math.max(0, parseInt(fsCd, 10) || 0)))
          } catch {}
        } catch {}
        const qs = params.toString() ? `?${params.toString()}` : ''
        const req = fetch(`/api/inspector/snapshot${qs}`, {
          cache: 'no-store',
        })
        const p = req.then(async (res) => {
          if (!res.ok) {
            const err = await normalizeResponseError(res)
            throw new Error(err.message || 'Failed to load snapshot')
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
        autoFailCountRef.current = 0
        setAutoPaused(false)
        setWarmCached(false)
        // Cache last snapshot per device for fast warm start across views
        try {
          const warmEnabled = (() => {
            try {
              const s = localStorage.getItem('gtt:inspector:cacheWarmEnabled')
              return s == null ? true : s === '1' || s === 'true'
            } catch {
              return true
            }
          })()
          const g: any = globalThis as any
          const payload: any = {
            ...json,
            screenshotBase64: undefined,
            cachedAt: Date.now(),
          }
          if (warmEnabled && deviceId) {
            if (!g.__inspectorLast) g.__inspectorLast = new Map<string, any>()
            g.__inspectorLast.set(deviceId, payload)
            try {
              sessionStorage.setItem(`gtt:inspector:last:${deviceId}`, JSON.stringify(payload))
            } catch {}
          }
        } catch {}
        try {
          if (json && (json as any).fsTriggered) {
            const msg = (json as any).fsMessage || 'ADB 异常，已触发 UiAutomator2 force-stop'
            // Show a one-off toast when backend reports force-stop
            // Use warning style if available, fallback to message
            // @ts-ignore sonner may not type warning; safe to call
            ;(toast as any).warning ? (toast as any).warning(msg) : toast.message(msg)
          }
        } catch {}
        return json
      } catch (e: any) {
        setError(e?.message || 'Failed to load snapshot')
        if (opts?.fromAuto && !opts?.force) {
          autoFailCountRef.current += 1
        }
        if (!opts?.silent) {
          const msg = e?.message || 'Failed to load snapshot'
          toast.error(msg)
        }
        return null
      } finally {
        setLoading(false)
      }
    }

    // Refetch when deviceId changes to avoid using stale cached snapshot
    const prevDeviceIdRef = useRef<string | null>(null)
    useEffect(() => {
      const currentId = deviceId ?? null
      if (prevDeviceIdRef.current !== currentId) {
        prevDeviceIdRef.current = currentId
        // Keep showing previous snapshot until refreshed
        // Try warm-start from in-memory cache/session if no initialState present
        try {
          if (!data && currentId) {
            const warmEnabled = (() => {
              try {
                const s = localStorage.getItem('gtt:inspector:cacheWarmEnabled')
                return s == null ? true : s === '1' || s === 'true'
              } catch {
                return true
              }
            })()
            if (warmEnabled) {
              const g: any = globalThis as any
              const ttl = (() => {
                try {
                  const v = localStorage.getItem('gtt:inspector:cacheTtlMs')
                  const n = v ? parseInt(v, 10) : 15000
                  return Math.max(1000, Math.min(60000, Number.isFinite(n) ? n : 15000))
                } catch {
                  return 15000
                }
              })()
              const fromMem = g.__inspectorLast?.get?.(currentId)
              if (fromMem && (!fromMem.cachedAt || Date.now() - fromMem.cachedAt <= ttl)) {
                setData(fromMem)
                setWarmCached(true)
              } else {
                try {
                  const raw = sessionStorage.getItem(`gtt:inspector:last:${currentId}`)
                  if (raw) {
                    const obj = JSON.parse(raw)
                    if (!obj.cachedAt || Date.now() - obj.cachedAt <= ttl) {
                      setData(obj)
                      setWarmCached(true)
                    }
                  }
                } catch {}
              }
            }
          }
        } catch {}
        fetchSnapshot({ silent: false })
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deviceId])

    useEffect(() => {
      if (refreshKey !== undefined) {
        // avoid overlapping requests
        if (!inflightRef.current) fetchSnapshot({ fromAuto: true })
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshKey])

    // External reset: zoom=1, pan={0,0}
    useEffect(() => {
      if (resetKey !== undefined) {
        setZoom(1)
        setPan({ x: 0, y: 0 })
      }
    }, [resetKey])

    const viewportRef = useRef<HTMLDivElement | null>(null)
    const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>({
      w: 0,
      h: 0,
    })
    const [zoom, setZoom] = useState(() => initialState?.zoom ?? 1)
    const [pan, setPan] = useState<{ x: number; y: number }>(
      () => initialState?.pan ?? { x: 0, y: 0 }
    )
    const [spaceDown, setSpaceDown] = useState(false)
    const [dragging, setDragging] = useState(false)
    const dragStart = useRef<{
      x: number
      y: number
      panX: number
      panY: number
    } | null>(null)
    const preferRef = useRef<boolean | null>(null)
    const [warmCached, setWarmCached] = useState(false)
    const [warmDismissed, setWarmDismissed] = useState<boolean>(() => {
      try {
        return (sessionStorage.getItem('gtt:inspector:warmTipDismissed:embed') || '') === '1'
      } catch {
        return false
      }
    })

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

    // Auto refresh when "preferAppium" changes in Parameters
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
          if (!inflightRef.current) fetchSnapshot()
        }
      }
      window.addEventListener('storage', onPrefChange)
      window.addEventListener('gtt-parameters-updated', onPrefChange as any)
      return () => {
        window.removeEventListener('storage', onPrefChange)
        window.removeEventListener('gtt-parameters-updated', onPrefChange as any)
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
      setPan({
        x: dragStart.current.panX + dx,
        y: dragStart.current.panY + dy,
      })
    }
    const onMouseUp = () => {
      setDragging(false)
      dragStart.current = null
    }

    const [selectedId, setSelectedId] = useState<string | null>(
      () => initialState?.selectedId ?? null
    )
    const [hoveredId, setHoveredId] = useState<string | null>(() => initialState?.hoveredId ?? null)
    const [autoCenterOnClickInner, setAutoCenterOnClickInner] = useState(true)
    const autoCenterOnClick = controlledAutoCenter ?? autoCenterOnClickInner
    const setAutoCenterOnClick = (v: boolean) => {
      if (controlledAutoCenter !== undefined) onAutoCenterChange?.(v)
      else setAutoCenterOnClickInner(v)
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
      return showClickableOnly ? data.nodes.filter((n) => n.clickable) : data.nodes
    }, [data, showClickableOnly])

    const centerOf = (n: NodeInfo) => ({
      x: Math.round((n.bounds.x1 + n.bounds.x2) / 2),
      y: Math.round((n.bounds.y1 + n.bounds.y2) / 2),
    })

    const handleNodeClick = async (n: NodeInfo) => {
      // Generate best selector and code line for insertion
      const esc = (s: string) => s.replace(/['\\]/g, (m) => `\\${m}`)
      const buildBestSelector = (node: NodeInfo): string => {
        // Libs 页面优先使用 resource-id，其次 content-desc，再其次 text，最后 XPath 兜底
        if (node.resourceId) {
          const rid = node.resourceId
          const hasFull = /[:/]/.test(rid)
          if (hasFull) {
            return `android=new UiSelector().resourceId(\"${rid.replace(/\"/g, '\\\"')}\")`
          }
          return `android=new UiSelector().resourceIdMatches(\".*${rid.replace(/\"/g, '\\\"')}\")`
        }
        if (node.contentDesc) return `~${esc(node.contentDesc)}`
        if (node.text)
          return `android=new UiSelector().text(\"${node.text.replace(/\"/g, '\\\"')}\")`
        const parts: string[] = []
        if (node.class) parts.push(node.class)
        if (node.text) parts.push(`@text=\"${node.text.replace(/\"/g, '\\\"')}\"`)
        if (node.resourceId) parts.push(`@resource-id=\"${node.resourceId}\"`)
        const xpath =
          parts.length > 1
            ? `//${parts[0]}[${parts.slice(1).join(' and ')}]`
            : `//${parts[0] || '*'}`
        return xpath
      }
      try {
        const selector = buildBestSelector(n)
        const isInput = (() => {
          const cls = (n.class || '').toLowerCase()
          return (
            cls.includes('edittext') ||
            cls.includes('textinput') ||
            cls.includes('textfield') ||
            cls.includes('autocomplete') ||
            cls.includes('search')
          )
        })()
        const code = `await this.page.$('${selector}').click()`
        onInsertCode?.(code)
        onSuggestSelector?.(selector, { isInput, node: n })
      } catch {}
      try {
        const c = centerOf(n)
        const tapRes = await fetch('/api/inspector/tap', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            x: c.x,
            y: c.y,
            deviceId: deviceId ?? undefined,
          }),
        })
        if (!tapRes.ok) {
          const err = await normalizeResponseError(tapRes)
          throw new Error(err.message || 'Tap failed')
        }
        // After tapping, poll for a fresh snapshot to reflect UI change
        const prevAt = data?.takenAt
        const attempts = 6
        const delay = 400
        for (let i = 0; i < attempts; i++) {
          await new Promise((r) => setTimeout(r, delay))
          const snap = await fetchSnapshot({ silent: true })
          if (prevAt && snap?.takenAt && snap.takenAt !== prevAt) break
        }
        toast.success('Tapped')
      } catch (e: any) {
        toast.error(e?.message || 'Tap failed')
      }
    }

    const zoomIn = () => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))
    const zoomOut = () => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))
    const zoomReset = () => {
      setZoom(1)
      setPan({ x: 0, y: 0 })
    }

    useImperativeHandle(
      ref,
      () => ({
        exportState: () => ({ data, zoom, pan, selectedId, hoveredId }),
      }),
      [data, zoom, pan, selectedId, hoveredId]
    )

    const formatAgo = (ts?: number) => {
      if (!ts) return ''
      const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
      if (s < 60) return `${s}s`
      const m = Math.floor(s / 60)
      const rs = s % 60
      return rs ? `${m}m${rs}s` : `${m}m`
    }
    return (
      <div className="flex h-full flex-col gap-2 p-2">
        {showRefreshButton && (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size={'icon'}
              onClick={() => fetchSnapshot({ force: true })}
              disabled={loading}
            >
              <RefreshCwIcon className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="relative flex h-full w-full">
          {warmCached && !warmDismissed && (
            <div className="absolute right-2 bottom-2 z-10 flex items-center gap-2 rounded bg-yellow-100/90 px-2 py-1 text-[11px] text-yellow-800 shadow">
              <span>
                显示缓存快照（缓存于 {formatAgo((data as any)?.cachedAt)} 前），已自动刷新中
              </span>
              <button
                type="button"
                aria-label="dismiss"
                className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-yellow-300/60 text-yellow-800 hover:bg-yellow-200/60"
                onClick={() => {
                  try {
                    sessionStorage.setItem('gtt:inspector:warmTipDismissed:embed', '1')
                  } catch {}
                  setWarmDismissed(true)
                }}
              >
                ×
              </button>
            </div>
          )}
          <AndroidInspector
            zoom={zoom}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onZoomReset={zoomReset}
            fillHeight={true}
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
            onNodeClick={handleNodeClick}
            loading={loading}
            showToolbar={showToolbar}
            overlayMode={overlayMode}
          />
        </div>
      </div>
    )
  }
)

export default AndroidInspectorEmbed
