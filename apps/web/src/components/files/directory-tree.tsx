'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { FolderClosedIcon, FolderOpenIcon, FileIcon } from 'lucide-react';

import { useSession } from '@/app/context/session-context';
import { normalizeResponseError } from '@/lib/error';
import { toast } from 'sonner';

export type FileNode = {
  name?: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
};

export type DirectoryTreeAction = {
  key: string;
  label: string;
  icon?: React.ComponentType<{ className?: string; size?: number }>;
  disabled?: boolean;
  danger?: boolean;
  onSelect: (node: FileNode) => void;
};

type DirectoryTreeProps = {
  api?: string;
  currentDir: string;
  onSelect: (filePath: string) => void;
  onDirSelect?: (dirPath: string) => void;
  refreshKey?: number;
  collapsible?: boolean;
  selectedPath?: string | null;
  cacheEnabled?: boolean;
  cacheTtlMs?: number;
  filterText?: string;
  toolbarActions?: React.ReactNode;
  nodeActions?: (node: FileNode) => DirectoryTreeAction[];
  selectablePredicate?: (node: FileNode) => boolean;
  selectedPaths?: string[];
  onToggleSelect?: (node: FileNode, checked: boolean) => void;
  onTreeData?: (nodes: FileNode[]) => void;
};

const EXPANDED_KEY_PREFIX = 'directoryTreeExpanded';

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

function defaultApi(currentDir: string) {
  const dir = encodeURIComponent(currentDir);
  return `/api/files/tree?dir=${dir}&depth=3`;
}

export default function DirectoryTree({
  api,
  currentDir,
  onSelect,
  onDirSelect,
  refreshKey = 0,
  collapsible = true,
  selectedPath: selectedPathProp,
  cacheEnabled = true,
  cacheTtlMs = 60_000,
  filterText = '',
  toolbarActions,
  nodeActions,
  selectablePredicate,
  selectedPaths,
  onToggleSelect,
  onTreeData,
}: DirectoryTreeProps) {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const { isAuthenticated } = useSession();

  const cacheKey = useMemo(
    () => `gtt:dirTree:${api || currentDir}`,
    [api, currentDir],
  );
  const expandedKey = useMemo(
    () => `${EXPANDED_KEY_PREFIX}:${api || currentDir}`,
    [api, currentDir],
  );

  const filterTokens = useMemo(
    () =>
      (filterText || '')
        .split(/[\s,]+/g)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    [filterText],
  );

  const applySelectedPath = useCallback(
    (nodes: FileNode[], path: string | null | undefined) => {
      if (!path) return;
      setSelectedPath(path);
      try {
        const allDirs = getAllDirPaths(nodes);
        const open: Record<string, boolean> = {};
        for (const dir of allDirs) {
          if (path.startsWith(dir)) open[dir] = true;
        }
        if (Object.keys(open).length) {
          setExpanded((prev) => ({ ...prev, ...open }));
        }
      } catch {}
    },
    [],
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    const loadFromCache = () => {
      if (!cacheEnabled) return;
      try {
        const raw = localStorage.getItem(cacheKey);
        if (!raw) return;
        const obj = JSON.parse(raw) as { at: number; tree: FileNode[] };
        if (
          !obj ||
          !Array.isArray(obj.tree) ||
          !Number.isFinite(obj.at) ||
          Date.now() - obj.at > cacheTtlMs
        ) {
          return;
        }
        setTree(obj.tree);
        const saved = localStorage.getItem(expandedKey);
        if (saved) setExpanded(JSON.parse(saved));
        applySelectedPath(obj.tree, selectedPathProp);
        onTreeData?.(obj.tree);
      } catch {}
    };

    loadFromCache();

    const fetchTree = async () => {
      try {
        const res = await fetch(api || defaultApi(currentDir), {
          credentials: 'include',
        });
        if (!res.ok) {
          const err = await normalizeResponseError(res);
          toast.error(err.message || 'Failed to load files');
          return;
        }
        const data = (await res.json()) as FileNode[];
        if (cancelled) return;
        setTree(data);
        if (cacheEnabled) {
          try {
            localStorage.setItem(
              cacheKey,
              JSON.stringify({ at: Date.now(), tree: data }),
            );
          } catch {}
        }
        const saved = localStorage.getItem(expandedKey);
        if (saved) setExpanded(JSON.parse(saved));
        applySelectedPath(data, selectedPathProp);
        onTreeData?.(data);
      } catch (err: any) {
        if (!cancelled) {
          const msg = err?.message || 'Failed to load files';
          toast.error(msg);
        }
      }
    };

    fetchTree();
    return () => {
      cancelled = true;
    };
  }, [
    api,
    cacheEnabled,
    cacheKey,
    cacheTtlMs,
    currentDir,
    expandedKey,
    isAuthenticated,
    refreshKey,
    applySelectedPath,
    selectedPathProp,
    onTreeData,
  ]);

  useEffect(() => {
    localStorage.setItem(expandedKey, JSON.stringify(expanded));
  }, [expanded, expandedKey]);

  useEffect(() => {
    if (typeof selectedPathProp === 'string') {
      setSelectedPath(selectedPathProp);
    }
  }, [selectedPathProp]);

  const toggleFolder = useCallback((path: string) => {
    setExpanded((prev) => ({ ...prev, [path]: !prev[path] }));
  }, []);

  const expandAll = useCallback(() => {
    const allDirs = getAllDirPaths(tree);
    const newState: Record<string, boolean> = {};
    allDirs.forEach((p) => (newState[p] = true));
    setExpanded(newState);
  }, [tree]);

  const collapseAll = useCallback(() => {
    setExpanded({});
  }, []);

  const selectedSet = useMemo(
    () => new Set(selectedPaths || []),
    [selectedPaths],
  );

  const visibleTree = useMemo(() => {
    if (!filterTokens.length) return tree;
    const filterTree = (nodes: FileNode[], tokens: string[]): FileNode[] => {
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
    };
    return filterTree(tree, filterTokens);
  }, [tree, filterTokens]);

  const handleNodeClick = useCallback(
    (node: FileNode) => {
      setSelectedPath(node.path);
      if (node.isDirectory) {
        toggleFolder(node.path);
        onDirSelect?.(node.path);
      } else {
        onSelect(node.path);
      }
    },
    [onDirSelect, onSelect, toggleFolder],
  );

  const renderActions = useCallback(
    (node: FileNode) => {
      const actions = nodeActions?.(node) || [];
      if (!actions.length) return null;
      return (
        <ContextMenuContent className="w-44">
          <ContextMenuLabel className="flex items-center gap-2 text-xs opacity-80">
            {node.isDirectory ? (
              <FolderOpenIcon className="size-4" />
            ) : (
              <FileIcon className="size-4" />
            )}
            <span className="truncate" title={node.name || node.path}>
              {node.name || node.path.split('/').pop()}
            </span>
          </ContextMenuLabel>
          <ContextMenuSeparator />
          {actions.map((action, idx) => {
            const Icon = action.icon;
            return (
              <ContextMenuItem
                key={action.key || idx}
                onSelect={() => action.onSelect(node)}
                disabled={action.disabled}
                className={action.danger ? 'text-red-600 focus:text-red-600' : undefined}
              >
                {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
                <span>{action.label}</span>
              </ContextMenuItem>
            );
          })}
        </ContextMenuContent>
      );
    },
    [nodeActions],
  );

  function renderNode(node: FileNode, level = 0, isLast = false) {
    const isSelected = selectedPath === node.path;
    const isOpen = expanded[node.path] ?? false;
    const selectable = selectablePredicate ? selectablePredicate(node) : false;
    const checked = selectable ? selectedSet.has(node.path) : false;
    const base =
      'relative flex items-center px-2 py-1 cursor-pointer select-none ';
    const folder = isSelected
      ? 'text-blue-600 font-bold '
      : 'font-bold hover:text-blue-500 ';
    const file = isSelected
      ? 'text-green-500 '
      : 'hover:text-blue-500 ';

    const content = (
      <div
        className={`${base} ${node.isDirectory ? folder : file}`}
        style={{ paddingLeft: `${level * 24 + 8}px` }}
        onClick={() => handleNodeClick(node)}
      >
        {selectable ? (
          <Checkbox
            checked={checked}
            className="mr-2 h-4 w-4"
            onClick={(e) => e.stopPropagation()}
            onCheckedChange={(value) =>
              onToggleSelect?.(node, value === true)
            }
          />
        ) : null}
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
        <span className="whitespace-nowrap">{node.name || node.path}</span>
      </div>
    );

    return (
      <div key={node.path} className="relative group">
        {nodeActions ? (
          <ContextMenu>
            <ContextMenuTrigger asChild>{content}</ContextMenuTrigger>
            {renderActions(node)}
          </ContextMenu>
        ) : (
          content
        )}
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
    return <div className="text-inherit bg-inherit">login please</div>;
  }

  return (
    <div className="flex flex-col rounded-lg h-full">
      {(collapsible || toolbarActions) && (
        <div className="mb-2 flex items-center gap-2">
          {collapsible && (
            <>
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
            </>
          )}
          {toolbarActions ? <div className="ml-auto flex items-center gap-2">{toolbarActions}</div> : null}
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-auto">
        {Array.isArray(visibleTree) && visibleTree.length
          ? visibleTree.map((node, idx) =>
              renderNode(node, 0, idx === visibleTree.length - 1),
            )
          : <div className="px-2 text-sm text-muted-foreground">No files</div>}
      </div>
    </div>
  );
}
