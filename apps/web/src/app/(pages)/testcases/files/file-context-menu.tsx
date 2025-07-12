import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuShortcut,
} from '@/components/ui/context-menu';

export function FileContextMenu({
  node,
  onDelete,
  onRun,
}: {
  node: { path: string; isDirectory: boolean } | null;
  onDelete: (path: string, isDirectory: boolean) => void;
  onRun: (path: string, isDirectory: boolean) => void;
}) {
  if (!node) return null;

  // 调试：确认 node 数据
  console.log('FileContextMenu node:', node);

  return (
    <ContextMenuContent className="w-52">
      <ContextMenuItem
        onSelect={() => {
          console.log('Delete clicked:', node.path);
          onDelete(node.path, node.isDirectory);
        }}
      >
        Delete
        <ContextMenuShortcut>⌘delete</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem
        onSelect={() => {
          console.log('Run clicked:', node.path);
          onRun(node.path, node.isDirectory);
        }}
        disabled={node.isDirectory}
      >
        Run
        <ContextMenuShortcut>⌘]</ContextMenuShortcut>
      </ContextMenuItem>
    </ContextMenuContent>
  );
}
