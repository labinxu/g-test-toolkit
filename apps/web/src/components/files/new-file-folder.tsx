'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusIcon } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Form, FormItem, FormControl, FormField, FormMessage } from '../ui/form';
import { OptionsSelect, type OptionsSelectItem } from '@/components/select/options-select';
import { toast } from 'sonner';
import { normalizeResponseError } from '@/lib/error';

export default function NewFileOrFolder({
  parentDir,
  onCreated,
  filterText,
  onFilterChange,
}: {
  parentDir: string;
  onCreated?: () => void;
  filterText?: string;
  onFilterChange?: (value: string) => void;
}) {
  const fileNameSchema = z
    .string()
    .min(1, { message: 'File name must be at least 1 character.' })
    .max(255, { message: 'File name cannot exceed 255 characters.' })
    .regex(/^[^\s].*[^\s]$/, {
      message: 'File name cannot start or end with spaces.',
    })
    .regex(/^[^/<>*?\\:"|]+$/, {
      message: 'File name contains invalid characters: /<>*?\\:"|',
    })
    .refine((val) => !/^\.*$/.test(val), {
      message: 'File name cannot be only dots (e.g., . or ..).',
    })
    .refine((val) => !/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(val), {
      message:
        'File name cannot be a reserved name (e.g., CON, PRN, AUX, NUL, COM1, LPT1).',
    });
  const formSchema = z.object({
    fileName: fileNameSchema,
    fileType: z.enum(['file', 'folder']),
  });
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fileName: '',
      fileType: 'file',
    },
  });
  async function handleSubmit(data: z.infer<typeof formSchema>) {
    try {
      const path = `${parentDir}/${data.fileName}`
      const url = data.fileType === 'file' ? '/api/files/create' : '/api/files/mkdir'
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        toast.error(err.message || 'Operation failed')
        return
      }
      toast.success(data.fileType === 'file' ? 'File created' : 'Folder created')
      onCreated?.()
      form.reset()
    } catch (e) {
      toast.error((e as Error)?.message || 'Operation failed')
    }
  }
  return (
    <div className="flex flex-col gap-2 m-2">
      <Form {...form}>
        <form
          id="id-create-file"
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex flex-row items-center gap-2 rounded-lg shadow-2xl px-2 py-1"
        >
          <FormField
            control={form.control}
            name="fileType"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <OptionsSelect
                    id="id-type-of-file"
                    value={field.value}
                    items={
                      [
                        { label: 'File', value: 'file' },
                        { label: 'Folder', value: 'folder' },
                      ] as OptionsSelectItem<'file' | 'folder'>[]
                    }
                    onSelect={(item) => field.onChange(item.value)}
                    triggerClassName="h-8 w-[80px] text-xs px-2"
                    contentClassName="w-[120px]"
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="fileName"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    placeholder="New file or folder name"
                    className="h-8 text-xs w-[180px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            variant={'secondary'}
            size={'icon'}
            className="h-8 w-8"
          >
            <PlusIcon className="h-4 w-4" />
          </Button>
        </form>
      </Form>
      {typeof onFilterChange === 'function' && (
        <div className="flex items-center gap-1">
          <Input
            placeholder="Filter files by name / keyword"
            className="h-8 text-xs"
            value={filterText ?? ''}
            onChange={(e) => onFilterChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
