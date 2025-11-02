import { z } from 'zod';
import { passwordSchema } from '@/lib/utils';

export const formSchema = z.object({
  email: z.string().trim().email({ message: 'Invalid email address.' }),
  password: passwordSchema,
});
