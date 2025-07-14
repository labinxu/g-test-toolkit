'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FolderClosedIcon, FolderOpenIcon, FileIcon } from 'lucide-react';
import { useSession } from '@/app/context/session-context';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { FileContextMenu } from './file-context-menu';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import { FileNode } from './types';
import { DeleteAlertDialog } from '../alert-dialog/delete-alert';
import { RunAlertDialog } from '../alert-dialog/run-alert';
import { useSocket } from '../socket-content';

const EXPANDED_KEY = 'directoryTreeExpanded';

function getAllDirPaths(tree: FileNode[]): string[] {
  let result: string[] = [];
  for (const node of tree) {
    if (node.isDirectory) {
      result.push(node.path);
      if (node.children) {
        result = result.concat(getAllDirPaths(node.children));
      }
    }
  }
  return result;
}

export default function DirectoryTree({
  currentDir,
  onSelect,
  onDirSelect,
  refreshKey = 0,
  setRefreshKey,
  collapsible = true,
  run,
}: {
  currentDir: string;
  onSelect: (filePath: string) => void;
  onDirSelect?: (dirPath: string) => void;
  refreshKey?: number;
  setRefreshKey: (k: number) => void;
  collapsible?: boolean;
  run: (node?: FileNode, clientId?: string) => Promise<void>;
}) {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [deleteTarget, setDeleteTarget] = useState<FileNode | null>(null);
  const [runTarget, setRunTarget] = useState<FileNode | null>(null);
  const [running, setRunning] = useState(false);
  const { clientId } = useSocket();
  const [deleting, setDeleting] = useState(false);
  const { isAuthenticated } = useSession();

  // Initialize and restore expanded state
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    fetch(`/api/testcase/listcases?&depth=3`, {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((treeData: FileNode[]) => {
        setTree(treeData);
        const saved = localStorage.getItem(EXPANDED_KEY);
        if (saved) {
          setExpanded(JSON.parse(saved));
        }
      });
  }, [refreshKey, isAuthenticated]);

  // Persist expanded state
  useEffect(() => {
    localStorage.setItem(EXPANDED_KEY, JSON.stringify(expanded));
  }, [expanded]);

  function toggleFolder(path: string) {
    setExpanded((prev) => ({ ...prev, [path]: !prev[path] }));
  }

  function expandAll() {
    const allDirs = getAllDirPaths(tree);
    const newState: Record<string, boolean> = {};
    allDirs.forEach((p) => (newState[p] = true));
    setExpanded(newState);
  }

  function collapseAll() {
    setExpanded({});
  }

  const handleDelete = useCallback(
    async (node: FileNode) => {
      setDeleting(true);
      await fetch('/api/files/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ path: node.path }),
      });
      setDeleting(false);
      setRefreshKey(refreshKey + 1);
      if (selectedPath === node.path) setSelectedPath(null);
      if (node.isDirectory) {
        setSelectedPath(null);
        if (onDirSelect)
          onDirSelect(currentDir.substring(0, currentDir.lastIndexOf('/')));
      }
      setDeleteTarget(null);
    },
    [refreshKey, setRefreshKey, selectedPath, onDirSelect, currentDir],
  );

  const handleRun = useCallback(
    async (node: FileNode) => {
      setRunning(true);
      if (!clientId) {
        console.log('directory-tree clientId not initialized');
        return;
      }
      await run(node, clientId);
      setRunning(false);
    },
    [clientId],
  );

  function renderNode(node: FileNode, level = 0, isLast = false) {
    const isSelected = selectedPath === node.path;
    const isOpen = expanded[node.path] ?? false;

    const base =
      'relative flex items-center px-2 py-1 cursor-pointer select-none ';
    const folder = isSelected
      ? 'text-blue-600 font-bold '
      : 'font-bold hover:text-blue-500 ';
    const file = isSelected
      ? 'text-green-400 dark:text-green-400 '
      : 'hover:text-blue-500  ';
    return (
      <div key={node.path} className="relative group">
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              className={`${base} ${node.isDirectory ? folder : file}`}
              style={{ paddingLeft: `${level * 24 + 8}px` }}
              onClick={() => {
                setSelectedPath(node.path);
                if (node.isDirectory) {
                  toggleFolder(node.path);
                  onDirSelect?.(node.path);
                } else {
                  onDirSelect?.('');
                  onSelect(node.path);
                }
              }}
            >
              {/* Vertical line */}
              {level > 0 && (
                <span
                  className="absolute left-0 top-0 h-full w-4"
                  style={{
                    borderLeft:
                      isLast && (!node.children || node.children.length === 0)
                        ? 'none'
                        : '2px solid #e5e7eb',
                    height: '100%',
                  }}
                />
              )}
              {/* Horizontal line */}
              {level > 0 && (
                <span
                  className="absolute"
                  style={{
                    left: `${level * 24 - 8}px`,
                    top: '50%',
                    width: '16px',
                    height: '2px',
                    background: '#e5e7eb',
                    transform: 'translateY(-1px)',
                  }}
                />
              )}
              {/* Collapse/Expand icon */}

              {node.isDirectory ? (
                <span className="mr-2 w-4">
                  {isOpen ? (
                    <FolderOpenIcon size={16} />
                  ) : (
                    <FolderClosedIcon size={16} />
                  )}
                </span>
              ) : (
                <span className="mr-2 w-4">
                  <FileIcon size={16} />
                </span>
              )}
              <span>{node.name}</span>
            </div>
          </ContextMenuTrigger>
          <FileContextMenu
            node={node}
            onDelete={setDeleteTarget}
            onRun={setRunTarget}
          />
        </ContextMenu>
        {/* Child nodes */}
        {node.isDirectory &&
          isOpen &&
          node.children &&
          node.children.map(
            (child, idx) =>
              node.children?.length &&
              renderNode(child, level + 1, idx === node.children.length - 1),
          )}
      </div>
    );
  }

  if (!isAuthenticated) {
    return <div>login please</div>;
  }

  return (
    <div className="flex flex-col rounded-lg h-full">
      {collapsible && (
        <div className="flex gap-2 mb-2 items-center">
          <Button
            variant="outline"
            onClick={expandAll}
            type="button"
            className="text-xs"
          >
            Expand All
          </Button>
          <Button
            variant="outline"
            onClick={collapseAll}
            type="button"
            className="text-xs"
          >
            Collapse All
          </Button>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-auto">
        {tree?.map((node, idx) => renderNode(node, 0, idx === tree.length - 1))}
      </div>
      <DeleteAlertDialog
        deleting={deleting}
        deleteTarget={deleteTarget}
        handleDelete={handleDelete}
        setDeleteTarget={setDeleteTarget}
      />
      <RunAlertDialog
        running={running}
        runTarget={runTarget}
        handleRun={handleRun}
        setRunTarget={setRunTarget}
      />
    </div>
  );
}
