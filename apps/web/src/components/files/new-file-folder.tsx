'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Plus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;
    if (isFolder) {
      await fetch('/api/files/mkdir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dir: `${parentDir}/${name}` }),
      });
    } else {
      await fetch('/api/files/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: `${parentDir}/${name}`, content }),
      });
    }
    setName('');
    setContent('');
    onCreated?.();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-row items-center gap-1 mb-2 rounded-lg shadow-2xl"
    >
      <div className="flex items-center gap-1 ml-2">
        <Switch
          id="folder-switch"
          checked={isFolder}
          onCheckedChange={setIsFolder}
          className="data-[state=checked]:bg-primary h-4 w-7"
        />
        <label
          htmlFor="folder-switch"
          className="text-[11px] select-none text-gray-700"
          style={{ cursor: 'pointer', lineHeight: 1 }}
        >
          Folder
        </label>
      </div>
      <Input
        placeholder={isFolder ? 'Folder name' : 'File name'}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        className="w-28 h-6 text-xs px-2 py-1"
        style={{ fontSize: 12 }}
      />

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="submit"
              className="h-6 w-6 p-0 flex items-center justify-center"
              variant="ghost"
              aria-label="Create"
              tabIndex={0}
            >
              <Plus className="w-3 h-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <span>Create {isFolder ? 'Folder' : 'File'}</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </form>
  );
}
