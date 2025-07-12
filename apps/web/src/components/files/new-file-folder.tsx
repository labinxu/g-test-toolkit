'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { PlusIcon } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileType } from './file-type';
export default function NewFileOrFolder({
  parentDir,
  onCreated,
}: {
  parentDir: string;
  onCreated?: () => void;
}) {
  const [isFolder, setIsFolder] = useState(false);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [fileType, setFileType] = useState('file');
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;
    if (isFolder) {
      await fetch('/api/files/mkdir', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dir: `${parentDir}/${name}` }),
      });
    } else {
      await fetch('/api/files/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: `${parentDir}/${name}`, content }),
      });
    }
    setName('');
    setContent('');
    onCreated?.();
  }

  return (
    <div className="flex flex-1 ">
      <form
        id="id-create-file"
        onSubmit={handleSubmit}
        className="flex flex-row items-center gap-1 m-2 rounded-lg shadow-2xl justify-between"
      >
        <div className="flex flex-row">
          <FileType value={fileType} setValue={setFileType} />

          <Input
            placeholder={isFolder ? 'Folder name' : 'File name'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ fontSize: 12 }}
          />
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="submit"
                className="h-6 w-6 p-0 flex items-center justify-center bg-accent"
                variant="ghost"
                aria-label="Create"
                tabIndex={0}
              >
                <PlusIcon className="w-3 h-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <span>Create {isFolder ? 'Folder' : 'File'}</span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </form>
    </div>
  );
}
