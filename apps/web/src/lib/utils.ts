import { clsx, type ClassValue } from 'clsx';
import { z } from 'zod';
import { twMerge } from 'tailwind-merge';

import Cookies from 'js-cookie';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const refreshToken = async (): Promise<string> => {
  const username = Cookies.get('_account');
  const refreshToken = Cookies.get(`${username}-refreshToken`);
  console.log('refresh', refreshToken, username);
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();
    if (response.ok) {
      Cookies.set(`${username}-accessToken`, data.accessToken, {
        expires: 1,
        secure: true,
        sameSite: 'strict',
      });
      Cookies.set(`${username}-refreshToken`, data.refreshToken, {
        expires: 7,
        secure: true,
        sameSite: 'strict',
      });

      return data.accessToken;
    } else {
      throw new Error(data.message || 'Failed to refresh token');
    }
  } catch (error) {
    Cookies.remove('accessToken');
    Cookies.remove('refreshToken');
    throw error;
  }
};
export const passwordSchema = z
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
