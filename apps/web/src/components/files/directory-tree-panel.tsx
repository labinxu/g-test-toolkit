'use client';
import { useRef, useState, useEffect } from 'react';
import DirectoryTree from './directory-tree';
import NewFileOrFolder from './new-file-folder';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function DirectoryTreePanel({
  onSelect,
  onDirSelect,
  onCollapseChange,
}: {
  onSelect: (filePath: string) => void;
  onDirSelect?: (dirPath: string) => void;
  onCollapseChange?: (c: boolean) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [currentDir, setCurrentDir] = useState('./user-cases');
  const [refreshKey, setRefreshKey] = useState(0);

  // 通知父组件折叠状态变化
  useEffect(() => {
    onCollapseChange?.(collapsed);
  }, [collapsed, onCollapseChange]);

  // 固定宽度
  const sidebarWidth = 288;
  const collapsedWidth = 28;

  return (
    <div
      className="relative h-full flex flex-row items-stretch rounded-xl shadow-lg bg-white"
      style={{
        minWidth: collapsed ? collapsedWidth : 180,
        width: collapsed ? collapsedWidth : sidebarWidth,
        transition: 'width 0.2s'
      }}
    >
      {/* 侧栏内容，折叠时隐藏但节点不移除 */}
      <div
        className={`flex-1 h-full flex flex-col`}
        style={{
          width: collapsed ? 0 : sidebarWidth,
          minWidth: 0,
          overflow: 'hidden',
          display: collapsed ? 'none' : undefined
        }}
      >
        <NewFileOrFolder
          key={currentDir}
          parentDir={currentDir}
          onCreated={() => setRefreshKey((k) => k + 1)}
        />
        <DirectoryTree
          key={refreshKey}
          onSelect={onSelect}
          onDirSelect={(dir) => {
            setCurrentDir(dir);
            onDirSelect?.(dir);
          }}
          collapsible={false}
        />
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
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40"
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 p-0 bg-white shadow border border-gray-200 rounded-full"
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
