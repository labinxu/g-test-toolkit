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
import { normalizeResponseError } from '@/lib/error';
import { toast } from 'sonner';

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
  api,
  currentDir,
  onSelect,
  onDirSelect,
  refreshKey = 0,
  setRefreshKey,
  collapsible = true,
  run,
  selectedPath: selectedPathProp,
  cacheEnabled = true,
  cacheTtlMs = 60_000,
  filterText = '',
}: {
  api: string;
  currentDir: string;
  onSelect: (filePath: string) => void;
  onDirSelect?: (dirPath: string) => void;
  refreshKey?: number;
  setRefreshKey: (k: number) => void;
  collapsible?: boolean;
  run?: (node?: FileNode, clientId?: string) => Promise<void>;
  selectedPath?: string | null;
  cacheEnabled?: boolean;
  cacheTtlMs?: number;
  filterText?: string;
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

  // Initialize and restore expanded state (with local cache for faster paint)
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    // 1) Try fast path: load cached tree (configurable TTL)
    if (cacheEnabled) {
      try {
        const CACHE_KEY = `gtt:dirTree:${api}`;
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          const obj = JSON.parse(raw) as { at: number; tree: FileNode[] };
          if (obj && Array.isArray(obj.tree) && Number.isFinite(obj.at) && Date.now() - obj.at < cacheTtlMs) {
            setTree(obj.tree);
            const saved = localStorage.getItem(EXPANDED_KEY);
            if (saved) setExpanded(JSON.parse(saved));
            // Apply selected path if provided
            if (selectedPathProp) {
              setSelectedPath(selectedPathProp);
              try {
                const allDirs = getAllDirPaths(obj.tree);
                const open: Record<string, boolean> = {};
                for (const dir of allDirs) {
                  if (selectedPathProp.startsWith(dir)) open[dir] = true;
                }
                setExpanded((prev) => ({ ...prev, ...open }));
              } catch {}
            }
          }
        }
      } catch {}
    }

    // 2) Always fetch in background to keep fresh
    fetch(api, {
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await normalizeResponseError(res)
          toast.error(err.message || 'Failed to load files')
          throw new Error(err.message || 'Failed to load files')
        }
        return res.json()
      })
      .then((treeData: FileNode[]) => {
        setTree(treeData);
        if (cacheEnabled) {
          try {
            const CACHE_KEY = `gtt:dirTree:${api}`;
            localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), tree: treeData }));
          } catch {}
        }
        const saved = localStorage.getItem(EXPANDED_KEY);
        if (saved) {
          setExpanded(JSON.parse(saved));
        }
        // Apply controlled selected path after load
        if (selectedPathProp) {
          setSelectedPath(selectedPathProp);
          // Auto-expand folders along the selected path
          try {
            const allDirs = getAllDirPaths(treeData);
            const open: Record<string, boolean> = {};
            for (const dir of allDirs) {
              if (selectedPathProp.startsWith(dir)) open[dir] = true;
            }
            setExpanded((prev) => ({ ...prev, ...open }));
          } catch {}
        }
      });
  }, [refreshKey, isAuthenticated, cacheEnabled, cacheTtlMs]);

  // Update selection when prop changes (after tree present)
  useEffect(() => {
    if (typeof selectedPathProp === 'string') {
      setSelectedPath(selectedPathProp);
    }
  }, [selectedPathProp, tree]);

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

  const filterTokens = useMemo(
    () =>
      (filterText || '')
        .split(/[\s,]+/g)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    [filterText],
  );

  // When filtering, auto-expand folders that contain matches
  useEffect(() => {
    if (!filterTokens.length || !tree.length) return;
    const auto: Record<string, boolean> = {};

    const visit = (nodes: FileNode[]): boolean => {
      let hasMatch = false;
      for (const node of nodes) {
        const name = (node.name || '').toLowerCase();
        const path = node.path.toLowerCase();
        const haystack = name || path;
        const selfMatch = filterTokens.every((t) => haystack.includes(t));

        let childMatch = false;
        if (node.children && node.children.length > 0) {
          childMatch = visit(node.children);
        }

        if ((selfMatch || childMatch) && node.isDirectory) {
          auto[node.path] = true;
        }
        if (selfMatch || childMatch) {
          hasMatch = true;
        }
      }
      return hasMatch;
    };

    try {
      visit(tree);
      if (Object.keys(auto).length) {
        setExpanded((prev) => ({ ...prev, ...auto }));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterTokens.join('|'), tree]);

  function filterTree(nodes: FileNode[], tokens: string[]): FileNode[] {
    if (!tokens.length) return nodes;
    const result: FileNode[] = [];
    for (const node of nodes) {
      const name = (node.name || '').toLowerCase();
      const path = node.path.toLowerCase();
      const haystack = name || path;
      const selfMatch = tokens.every((t) => haystack.includes(t));

      let children: FileNode[] | undefined;
      if (node.children && node.children.length > 0) {
        children = filterTree(node.children, tokens);
      }

      if (selfMatch || (children && children.length > 0)) {
        result.push({
          ...node,
          children,
        });
      }
    }
    return result;
  }

  const visibleTree = useMemo(
    () => (filterTokens.length ? filterTree(tree, filterTokens) : tree),
    [tree, filterTokens],
  );

  const handleDelete = useCallback(
    async (node: FileNode) => {
      setDeleting(true);
      const res = await fetch('/api/files/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ path: node.path }),
      });
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        toast.error(err.message || 'Delete failed')
        setDeleting(false)
        return
      }
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
      run && (await run(node, clientId));
      setRunning(false);
    },
    [clientId],
  );

  const handleRename = useCallback(
    async (node: FileNode) => {
      try {
        const currentName = node.name || node.path.split('/').pop() || ''
        const input = window.prompt('Rename to', currentName)
        if (input == null) return
        const newName = input.trim()
        if (!newName || newName === currentName) return
        const res = await fetch('/api/files/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ path: node.path, newName }),
        })
        if (!res.ok) {
          const err = await normalizeResponseError(res)
          throw new Error(err.message || 'Rename failed')
        }
        const data = await res.json().catch(() => ({} as any))
        const newPath: string | undefined = data?.newPath
        setRefreshKey(refreshKey + 1)
        if (newPath) {
          setSelectedPath(newPath)
          if (!node.isDirectory) {
            onSelect(newPath)
          } else {
            onDirSelect?.(newPath)
          }
        }
      } catch (e: any) {
        // Prefer toast error if available; fallback to alert
        try {
          const msg = e?.message || 'Rename failed'
          ;(toast as any)?.error ? toast.error(msg) : alert(msg)
        } catch {}
      }
    },
    [refreshKey, setRefreshKey, onSelect, onDirSelect]
  )

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
              <span className="whitespace-nowrap">{node.name}</span>
            </div>
          </ContextMenuTrigger>
          <FileContextMenu
            node={node}
            onDelete={setDeleteTarget}
            onRun={setRunTarget}
            onRename={handleRename}
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
      <div className="flex-1 min-h-0 overflow-auto overflow-x-auto">
        {typeof visibleTree?.map === 'function' ? (
          visibleTree.map((node, idx) =>
            renderNode(node, 0, idx === visibleTree.length - 1),
          )
        ) : (
          <div>No Files</div>
        )}
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
