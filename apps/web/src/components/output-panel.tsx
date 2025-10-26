'use client'

import * as React from 'react'
import { Button } from './ui/button'
import { ChevronsUpDown } from 'lucide-react'
interface OutputPanelProps {
  renderLogs: () => React.ReactNode
  title?: string
  open: boolean
  setOpen: (o: boolean) => void
}

export function OutputPanel({
  renderLogs,
  title = 'Output',
  open = false,
  setOpen,
}: OutputPanelProps) {
  // 日志区最大高度
  const panelHeight = 320

  return (
    <div
      className="flex w-full flex-none flex-col rounded-lg shadow-lg"
      // onMouseEnter={() => setOpen(true)}
      // onMouseLeave={() => setOpen(false)}
    >
      <div
        className="flex items-center rounded-lg border-t border-b font-medium shadow-lg"
        onClick={() => setOpen(!open)}
      >
        <div className="ml-2">
          <span>{title}</span>
        </div>
        <div className="flex w-full items-center justify-center rounded-full">
          <Button variant={'secondary'}>
            <ChevronsUpDown />
          </Button>
        </div>
      </div>
      <div
        className="overflow-hidden transition-[max-height] duration-300"
        style={{
          maxHeight: open ? panelHeight : 0,
        }}
      >
        <div
          className="h-[320px] w-full overflow-y-auto rounded-lg border-none p-2 shadow-lg"
          style={{
            whiteSpace: 'pre-wrap',
            fontFamily: 'monospace',
            fontSize: '14px',
          }}
        >
          {renderLogs()}
        </div>
      </div>
    </div>
  )
}
