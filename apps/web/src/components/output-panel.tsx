'use client';

import * as React from 'react';
import { Button } from './ui/button';
import { ChevronsUpDown } from 'lucide-react';
interface OutputPanelProps {
  renderLogs: () => React.ReactNode;
  title?: string;
}

export function OutputPanel({
  renderLogs,
  title = 'Output',
}: OutputPanelProps) {
  const [open, setOpen] = React.useState(false);
  // 日志区最大高度
  const panelHeight = 320;

  return (
    <div
      className="w-full flex flex-col flex-none"
      // onMouseEnter={() => setOpen(true)}
      // onMouseLeave={() => setOpen(false)}
    >
      <div className="px-3 py-2 border-t border-b bg-gray-100 font-medium flex items-center">
        <div>
          <span>{title}</span>
        </div>
        <div className="flex justify-center items-center w-full">
          <Button variant={'secondary'} onClick={() => setOpen((v) => !v)}>
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
          className="w-full h-[320px] p-2 border-none rounded-md bg-gray-50 overflow-y-auto"
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
  );
}
