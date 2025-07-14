import {
  ContextMenuContent,
  ContextMenuItem,
} from '@/components/ui/context-menu';
import { FileNode } from './types';
export function FileContextMenu({
  node,
  onDelete,
  onRun,
}: {
  node: FileNode | null;
  onDelete: (node: FileNode) => void;
  onRun: (node: FileNode) => void;
}) {
  if (!node) return null;
  return (
    <ContextMenuContent className="w-30">
      <ContextMenuItem
        onSelect={() => {
          onDelete(node);
        }}
      >
        Delete
      </ContextMenuItem>
      <ContextMenuItem
        onSelect={() => {
          onRun(node);
        }}
      >
        Run
      </ContextMenuItem>
    </ContextMenuContent>
  );
}
