import { z } from 'zod';
const passwordSchema = z
  .string()
  .min(6, { message: 'Password must be at least 6 characters long.' })
  .max(128, { message: 'Password must not exceed 128 characters.' });
// .regex(/[a-z]/, {
//   message: 'Password must contain at least one lowercase letter.',
// })
// .regex(/[A-Z]/, {
//   message: 'Password must contain at least one uppercase letter.',
// })
// .regex(/[0-9]/, { message: 'Password must contain at least one number.' })
// .regex(/[^a-zA-Z0-9]/, {
//   message: 'Password must contain at least one special character.',
// });

export const formSchema = z.object({
  email: z.email({ message: 'Invalid email address.' }),
  password: passwordSchema,
});
