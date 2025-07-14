'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusIcon } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Form, FormItem, FormControl, FormField } from '../ui/form';
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
    fileType: z.string(),
  });
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fileName: '',
      fileType: 'File',
    },
  });
  async function handleSubmit(data: z.infer<typeof formSchema>) {
    console.log('create ', data);
    if (data.fileType === 'file') {
      await fetch('/api/files/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: `${parentDir}/${data.fileName}`,
        }),
      });
    } else {
      await fetch('/api/files/mkdir', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: `${parentDir}/${data.fileName}` }),
      });
    }
    onCreated?.();
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
                  <Input placeholder="testcase" {...field} />
                </FormControl>
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
