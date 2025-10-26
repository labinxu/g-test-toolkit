'use client'

import React, { RefObject } from 'react'
import { Button } from '@/components/ui/button'

export type Bounds = { x1: number; y1: number; x2: number; y2: number }
export type NodeInfo = {
  nodeId: string
  class: string
  text: string
  resourceId: string
  contentDesc: string
  clickable: boolean
  bounds: Bounds
}

export type Snapshot = {
  screenshotUrl?: string
  screenshotBase64?: string
  screen: { width: number; height: number }
  nodes: NodeInfo[]
  takenAt: number
}

export interface AndroidInspectorProps {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  showToolbar?: boolean
  fillHeight?: boolean

  autoCenterOnClick: boolean
  setAutoCenterOnClick: (v: boolean) => void

  viewportRef: RefObject<HTMLDivElement | null>
  spaceDown: boolean
  dragging: boolean
  onMouseDown: (e: React.MouseEvent) => void
  onMouseMove: (e: React.MouseEvent) => void
  onMouseUp: () => void

  data: Snapshot | null
  viewportSize: { w: number; h: number }
  scale: { sx: number; sy: number }
  pan: { x: number; y: number }

  filteredNodes: NodeInfo[]
  selectedId: string | null
  hoveredId: string | null
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>
  setHoveredId: React.Dispatch<React.SetStateAction<string | null>>
  centerOn: (n: NodeInfo) => void
  onNodeClick?: (node: NodeInfo) => void

  loading: boolean
}

export default function AndroidInspector(props: AndroidInspectorProps) {
  const {
    zoom,
    onZoomIn,
    onZoomOut,
    onZoomReset,
    autoCenterOnClick,
    setAutoCenterOnClick,
    viewportRef,
    spaceDown,
    dragging,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    data,
    viewportSize,
    scale,
    pan,
    filteredNodes,
    selectedId,
    hoveredId,
    setSelectedId,
    setHoveredId,
    centerOn,
    onNodeClick,
    loading,
    showToolbar = true,
    fillHeight = false,
  } = props

  return (
    <div
      className={`flex flex-col rounded-lg border select-none ${fillHeight ? 'h-full min-h-0' : ''}`}
    >
      {showToolbar && (
        <div className="m-2 flex items-center justify-between rounded-lg border">
          <Button variant="outline" size="sm" onClick={onZoomOut}>
            -
          </Button>
          <div className="w-16 text-center text-sm">{Math.round(zoom * 100)}%</div>
          <Button variant="outline" size="sm" onClick={onZoomIn}>
            +
          </Button>
          <Button variant="outline" size="sm" onClick={onZoomReset}>
            Reset
          </Button>
          <div className="ml-4 flex items-center gap-2 text-xs">
            <input
              id="toggle-center"
              type="checkbox"
              className="h-4 w-4"
              checked={autoCenterOnClick}
              onChange={(e) => setAutoCenterOnClick(e.target.checked)}
            />
            <label htmlFor="toggle-center" className="cursor-pointer select-none">
              Center
            </label>
          </div>
        </div>
      )}
      <div
        ref={viewportRef}
        className={`relative ${fillHeight ? 'min-h-0 flex-1' : 'h-[640px]'} w-[340px] overflow-hidden rounded-md border ${spaceDown ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
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
              {(() => {
                let src: string | undefined
                if (data.screenshotBase64) {
                  src = `data:image/png;base64,${data.screenshotBase64}`
                } else if (data.screenshotUrl) {
                  const sep = data.screenshotUrl.includes('?') ? '&' : '?'
                  const ts = data.takenAt || Date.now()
                  src = `${data.screenshotUrl}${sep}t=${ts}`
                }
                return src ? (
                  <img
                    alt="screenshot"
                    className="h-full w-full select-none"
                    draggable={false}
                    src={src}
                  />
                ) : null
              })()}

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
                          ? 'border-4 border-red-500 bg-red-500/10'
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
                      onDoubleClick={() => {
                        // For future: double-click could zoom or other action
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
          <div
            className={`text-muted-foreground flex h-full w-full items-center justify-center rounded-md border text-sm`}
          >
            {loading ? 'Loading...' : 'No Snapshot'}
          </div>
        )}
      </div>
    </div>
  )
}
