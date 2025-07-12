import { ContextMenu, ContextMenuTrigger } from '@radix-ui/react-context-menu';
import { FileContextMenu } from './(pages)/testcases/files/file-context-menu';

export default function Page() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>ooxx</div>
        </ContextMenuTrigger>

        <FileContextMenu
          node={{ path: 'aa', isDirectory: false }}
          onDelete={() => {}}
          onRun={() => {}}
        />
      </ContextMenu>
    </div>
  );
}
