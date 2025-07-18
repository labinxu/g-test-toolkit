'use client';

import * as React from 'react';
import { Button } from './ui/button';
import { ChevronsUpDown } from 'lucide-react';
interface OutputPanelProps {
  renderLogs: () => React.ReactNode;
  title?: string;
  open: boolean;
  setOpen: (o: boolean) => void;
}

export function OutputPanel({
  renderLogs,
  title = 'Output',
  open = false,
  setOpen,
}: OutputPanelProps) {
  // 日志区最大高度
  const panelHeight = 320;

  return (
    <div
      className="w-full flex flex-col flex-none rounded-lg shadow-lg"
      // onMouseEnter={() => setOpen(true)}
      // onMouseLeave={() => setOpen(false)}
    >
      <div
        className="rounded-lg shadow-lg border-t border-b font-medium flex items-center  "
        onClick={() => setOpen(!open)}
      >
        <div className="ml-2 ">
          <span>{title}</span>
        </div>
        <div className="flex justify-center items-center w-full">
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
          className="w-full h-[320px] p-2 border-none rounded-lg shadow-lg overflow-y-auto"
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
