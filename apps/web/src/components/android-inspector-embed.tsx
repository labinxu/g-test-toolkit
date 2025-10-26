"use client"

import React, { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import AndroidInspector, {
  NodeInfo,
  Snapshot,
} from '@/components/android-inspector'
import { Button } from '@/components/ui/button'
import { RefreshCwIcon } from 'lucide-react'
import { toast } from 'sonner'

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
    },
    ref
  ) => {
  const [data, setData] = useState<Snapshot | null>(() => initialState?.data ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSnapshot = async (opts?: { silent?: boolean }): Promise<Snapshot | null> => {
    try {
      setLoading(true)
      setError(null)
      const qs = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : ''
      const res = await fetch(`/api/inspector/snapshot${qs}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())
      const json = (await res.json()) as Snapshot
      setData(json)
      return json
    } catch (e: any) {
      setError(e?.message || 'Failed to load snapshot')
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
      setData(null)
      fetchSnapshot()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId])

  useEffect(() => {
    if (refreshKey !== undefined) {
      fetchSnapshot()
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
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(() => initialState?.zoom ?? 1)
  const [pan, setPan] = useState<{ x: number; y: number }>(() => initialState?.pan ?? { x: 0, y: 0 })
  const [spaceDown, setSpaceDown] = useState(false)
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)

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
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
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

  const [selectedId, setSelectedId] = useState<string | null>(() => initialState?.selectedId ?? null)
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
    return data.nodes.filter((n) => n.clickable)
  }, [data])

  const centerOf = (n: NodeInfo) => ({
    x: Math.round((n.bounds.x1 + n.bounds.x2) / 2),
    y: Math.round((n.bounds.y1 + n.bounds.y2) / 2),
  })

  const handleNodeClick = async (n: NodeInfo) => {
    try {
      const c = centerOf(n)
      await fetch('/api/inspector/tap', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ x: c.x, y: c.y, deviceId: deviceId ?? undefined }),
      })
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

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      {showRefreshButton && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size={'icon'}
            onClick={() => fetchSnapshot()}
            disabled={loading}
          >
            <RefreshCwIcon className="h-4 w-4" />
          </Button>
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
      />

    </div>
  )
})

export default AndroidInspectorEmbed
