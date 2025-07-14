'use client';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { FileNode } from '../files/types';
export function RunAlertDialog({
  running,
  runTarget,
  setRunTarget,
  handleRun,
}: {
  running: boolean;
  runTarget: FileNode | null;
  setRunTarget: (node: FileNode | null) => void;
  handleRun: (node: FileNode) => void;
}) {
  return (
    <AlertDialog
      open={!!runTarget}
      onOpenChange={(open) => {
        if (!open) setRunTarget(null);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Run {runTarget?.isDirectory ? 'Folder' : 'File'}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to run
            {runTarget?.isDirectory ? 'folder' : 'file'}:{' '}
            <b>{runTarget?.path}</b>? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={running}
            onClick={() => setRunTarget(null)}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={running}
            onClick={() => {
              if (runTarget) handleRun(runTarget);
            }}
            className="bg-red-600 hover:bg-red-700"
          >
            {running ? 'Running...' : 'complete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
