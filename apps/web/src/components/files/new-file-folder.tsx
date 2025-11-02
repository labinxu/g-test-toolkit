'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusIcon } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Form, FormItem, FormControl, FormField, FormMessage } from '../ui/form';
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
import { toast } from 'sonner';
import { normalizeResponseError } from '@/lib/error';

export default function NewFileOrFolder({
  parentDir,
  onCreated,
}: {
  parentDir: string;
  onCreated?: () => void;
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
    <div className="flex flex-1 ">
      <Form {...form}>
        <form
          id="id-create-file"
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex flex-row items-center gap-1 m-2 rounded-lg shadow-2xl justify-between"
        >
          <FormField
            control={form.control}
            name="fileType"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <FileType value={field.value} setValue={field.onChange} />
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
                  <Input placeholder="type name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" variant={'secondary'} size={'icon'}>
            <PlusIcon />
          </Button>
        </form>
      </Form>
    </div>
  );
}
