import { z } from 'zod';
import { passwordSchema } from '@/lib/utils';

const usernameSchema = z
  .string()
  .trim()
  .min(4, { message: 'Username must be at least 4 characters.' })
  .max(64, { message: 'Username must be at most 64 characters.' })
  .regex(/^[A-Za-z0-9._-]+$/, {
    message: 'Username can only include letters, numbers, dot, underscore, hyphen.',
  });

export const formSchema = z
  .object({
    username: usernameSchema,
    email: z
      .string()
      .trim()
      .email({ message: 'Invalid email address.' })
      .max(255, { message: 'Email must be at most 255 characters.' }),
    password: passwordSchema,
    confirmPassword: z.string().min(1, { message: 'Please confirm your password.' }),
  })
  .superRefine((val, ctx) => {
    if (val.confirmPassword !== val.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Passwords must match.',
        path: ['confirmPassword'],
      });
    }
  });
