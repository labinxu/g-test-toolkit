'use client';

import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormField,
  FormMessage,
} from '@/components/ui/form';
import { useSession } from '../context/session-context';
import { formSchema } from './schema';
import { PasswordInput } from '@/components/ui/password-input';
import { useState } from 'react';
type FormData = {
  email: string;
  password: string;
};
export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const { login } = useSession();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Fetch CSRF token on component mount
  const handleSubmit = async (data: FormData) => {
    setError('');
    const { email, password } = data;
    try {
      await login(email, password);
      router.push('/devices');
    } catch (err) {
      console.error('Login error:', err);
      setError((err as Error).message);
    }
  };

  return (
    <Form {...form}>
      <form
        id="id-register-form"
        onSubmit={form.handleSubmit(handleSubmit)}
        className="gap-1 space-y-8 dark:bg-zinc-800 bg-amber-50"
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor={field.name}>Email</FormLabel>
              <FormControl>
                <Input {...field} id={field.name} autoComplete="email" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor={field.name}>Password</FormLabel>
              <FormControl>
                <PasswordInput
                  {...field}
                  id={field.name}
                  autoComplete="new-password"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex w-full justify-end items-center gap-4">
          {error != '' ? (
            <div className="text-red-500 items-center">{error}</div>
          ) : null}
          <Button type="submit" variant={'outline'}>
            Submit
          </Button>
        </div>
      </form>
    </Form>
  );
}
