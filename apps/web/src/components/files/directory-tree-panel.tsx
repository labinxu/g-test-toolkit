'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function DirectoryTreePanel({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const sidebarWidth = 288;
  const collapsedWidth = 28;
  return (
    <div
      className="relative h-full flex flex-row items-stretch rounded-xl shadow-lg dark:bg-zinc-800 bg-white"
      style={{
        minWidth: collapsed ? collapsedWidth : 180,
        width: collapsed ? collapsedWidth : sidebarWidth,
        transition: 'width 0.2s',
      }}
    >
      {/* 侧栏内容，折叠时隐藏但节点不移除 */}
      <div
        className={`flex-1 h-full flex flex-col`}
        style={{
          width: collapsed ? 0 : sidebarWidth,
          minWidth: 0,
          overflow: 'hidden',
          display: collapsed ? 'none' : undefined,
        }}
      >
        {children}
      </div>
      {/* 折叠/展开按钮 */}
      <div
        className="relative flex flex-col items-center justify-center flex-shrink-0"
        style={{
          width: 28,
          zIndex: 20,
          userSelect: 'none',
        }}
      >
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40">
          <Button
            variant="secondary"
            size="icon"
            className="h-7 w-7 p-0  shadow border  rounded-full"
            onClick={() => setCollapsed((v) => !v)}
            tabIndex={-1}
            type="button"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </Button>
        </div>
      </div>
    </div>
  );
}
