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

type FileNode = {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
};

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

type DeleteTarget = { path: string; isDirectory: boolean } | null;

export default function DirectoryTree({
  currentDir,
  onSelect,
  onDirSelect,
  refreshKey = 0,
  setRefreshKey,
  collapsible = true,
}: {
  currentDir: string;
  onSelect: (filePath: string) => void;
  onDirSelect?: (dirPath: string) => void;
  refreshKey?: number;
  setRefreshKey: (k: number) => void;
  collapsible?: boolean;
}) {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deleting, setDeleting] = useState(false);
  const rootDir = useMemo(() => {
    return currentDir;
  }, [currentDir]);
  const { isAuthenticated } = useSession();

  // Initialize and restore expanded state
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    fetch(`/api/files/tree?dir=${rootDir}&depth=3`, {
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
  }, [refreshKey, isAuthenticated, rootDir]);

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
    async (path: string, isDirectory: boolean) => {
      console.log('handle delete', isDirectory, path);
      setDeleting(true);
      await fetch('/api/files/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ path }),
      });
      setDeleting(false);
      setRefreshKey(refreshKey + 1);
      if (selectedPath === path) setSelectedPath(null);
      if (isDirectory) {
        setSelectedPath(null);
        if (onDirSelect)
          onDirSelect(currentDir.substring(0, currentDir.lastIndexOf('/')));
      }
      setDeleteTarget(null);
    },
    [refreshKey, setRefreshKey, selectedPath, onDirSelect, currentDir],
  );

  const handleRun = useCallback(async (path: string, isDirectory: boolean) => {
    console.log('handle run', path, isDirectory);
  }, []);

  function renderNode(node: FileNode, level = 0, isLast = false) {
    const isSelected = selectedPath === node.path;
    const isOpen = expanded[node.path] ?? false;
    const base =
      'relative flex items-center px-2 py-1 cursor-pointer select-none';
    const folder = isSelected
      ? 'bg-blue-100 text-blue-700 font-bold'
      : 'hover:bg-blue-50 font-bold text-gray-700';
    const file = isSelected
      ? 'bg-green-100 text-green-700'
      : 'hover:bg-green-50 text-gray-600';

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
            node={{ path: node.path, isDirectory: node.isDirectory }}
            onDelete={() => {
              setDeleteTarget({
                path: node.path,
                isDirectory: node.isDirectory,
              });
            }}
            onRun={handleRun}
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
        {tree.map((node, idx) => renderNode(node, 0, idx === tree.length - 1))}
      </div>
      {/*
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>ooxx</div>
        </ContextMenuTrigger>
        <FileContextMenu
          node={{ path: 'xx', isDirectory: false }}
          onDelete={() => {}}
          onRun={() => {}}
        />
        </ContextMenu>*/}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.isDirectory ? 'Folder' : 'File'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              {deleteTarget?.isDirectory ? 'folder' : 'file'}:{' '}
              <b>{deleteTarget?.path}</b>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={() => {
                if (deleteTarget)
                  handleDelete(deleteTarget.path, deleteTarget.isDirectory);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
