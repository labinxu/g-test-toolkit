import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
} from '@/components/ui/context-menu';
import { Pencil, Play, Trash2, FileIcon, FolderIcon } from 'lucide-react';
import { FileNode } from './types';
export function FileContextMenu({
  node,
  onDelete,
  onRun,
  onRename,
}: {
  node: FileNode | null;
  onDelete: (node: FileNode) => void;
  onRun: (node: FileNode) => void;
  onRename: (node: FileNode) => void;
}) {
  if (!node) return null;
  return (
    <ContextMenuContent className="w-44">
      <ContextMenuLabel className="flex items-center gap-2 text-xs opacity-80">
        {node.isDirectory ? <FolderIcon className="size-4" /> : <FileIcon className="size-4" />}
        <span className="truncate" title={node.name || node.path}>
          {node.name || node.path.split('/').pop()}
        </span>
      </ContextMenuLabel>
      <ContextMenuSeparator />
      <ContextMenuItem
        onSelect={() => {
          onRename(node);
        }}
      >
        <Pencil />
        <span>Rename</span>
      </ContextMenuItem>
      <ContextMenuItem
        disabled={!!node.isDirectory}
        onSelect={() => {
          onRun(node);
        }}
      >
        <Play />
        <span>Run</span>
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        variant="destructive"
        onSelect={() => {
          onDelete(node);
        }}
      >
        <Trash2 />
        <span>Delete</span>
      </ContextMenuItem>
    </ContextMenuContent>
  );
}
