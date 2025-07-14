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
export function DeleteAlertDialog({
  deleting,
  deleteTarget,
  setDeleteTarget,
  handleDelete,
}: {
  deleting: boolean;
  deleteTarget: FileNode | null;
  setDeleteTarget: (node: FileNode | null) => void;
  handleDelete: (node: FileNode) => void;
}) {
  return (
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
              if (deleteTarget) handleDelete(deleteTarget);
            }}
            className="bg-red-600 hover:bg-red-700"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
