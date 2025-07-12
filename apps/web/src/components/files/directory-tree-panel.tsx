'use client';
import { useState } from 'react';
import DirectoryTree from './directory-tree';
import NewFileOrFolder from './new-file-folder';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function DirectoryTreePanel({
  currentDir,
  editable = true,
  onSelect,
  onDirSelect,
}: {
  currentDir: string;
  editable: boolean;
  onSelect: (filePath: string) => void;
  onDirSelect?: (dirPath: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const sidebarWidth = 288;
  const collapsedWidth = 28;
  return (
    <div
      id="directory-panel"
      className="relative h-full flex flex-row items-stretch rounded-xl shadow-lg dark:bg-zinc-400 "
      style={{
        minWidth: collapsed ? collapsedWidth : 180,
        width: collapsed ? collapsedWidth : sidebarWidth,
        transition: 'width 0.2s',
      }}
    >
      {/* 侧栏内容，折叠时隐藏但节点不移除 */}
      <div
        className={`flex-1 h-full flex flex-col `}
        style={{
          width: collapsed ? 0 : sidebarWidth,
          minWidth: 0,
          overflow: 'hidden',
          display: collapsed ? 'none' : undefined,
        }}
      >
        {editable ? (
          <NewFileOrFolder
            key={currentDir}
            parentDir={currentDir}
            onCreated={() => setRefreshKey((k) => k + 1)}
          />
        ) : null}
        <DirectoryTree
          currentDir={currentDir}
          refreshKey={refreshKey}
          setRefreshKey={setRefreshKey}
          onSelect={onSelect}
          onDirSelect={(dir) => {
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
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40">
          <Button
            variant="secondary"
            onClick={() => setCollapsed((v) => !v)}
            tabIndex={-1}
          >
            {collapsed ? (
              <ChevronRight className="dark:bg-zinc-400" size={18} />
            ) : (
              <ChevronLeft size={18} className="dark:bg-zinc-400" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
