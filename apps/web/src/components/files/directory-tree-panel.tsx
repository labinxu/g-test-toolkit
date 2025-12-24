'use client';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DirectoryTreePanelProps {
  children?: React.ReactNode;
  currentDir?: string;
  onSelect?: (path: string) => void;
  onDirSelect?: (path: string) => void;
  collapsible?: boolean;
}

export default function DirectoryTreePanel({
  children,
  collapsible = true,
}: DirectoryTreePanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const sidebarWidth = 288;
  const collapsedWidth = 28;

  const [width, setWidth] = useState(sidebarWidth);
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(sidebarWidth);

  const startResize = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!collapsible) return;
    if (collapsed) return;
    isResizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = width;

    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizingRef.current) return;
      const delta = event.clientX - startXRef.current;
      const next = Math.max(180, Math.min(640, startWidthRef.current + delta));
      setWidth(next);
    };

    const handleMouseUp = () => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      className="relative h-full flex flex-row items-stretch rounded-xl shadow-lg dark:bg-zinc-800 bg-white"
      style={{
        minWidth: collapsible && collapsed ? collapsedWidth : 180,
        width: collapsible && collapsed ? collapsedWidth : width,
        transition: 'width 0.2s',
      }}
    >
      {/* 侧栏内容，折叠时隐藏但节点不移除 */}
      <div
        className={`flex-1 h-full flex flex-col`}
        style={{
          width: collapsible && collapsed ? 0 : width,
          minWidth: 0,
          overflow: 'hidden',
          display: collapsible && collapsed ? 'none' : undefined,
        }}
      >
        {children}
      </div>
      {/* 折叠/展开按钮 */}
      {collapsible ? (
        <div
          className="relative flex flex-col items-center justify-center flex-shrink-0 cursor-col-resize select-none"
          style={{
            width: 28,
            zIndex: 20,
            userSelect: 'none',
          }}
          onMouseDown={startResize}
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
      ) : null}
    </div>
  );
}
