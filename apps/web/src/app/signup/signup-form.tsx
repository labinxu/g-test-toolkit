'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Cookies from 'js-cookie';

export function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Optional: Store in cookie
        // document.cookie = `accessToken=${data.accessToken}; path=/; max-age=3600; secure; samesite=strict`;
        router.push('/reports');
        Cookies.set('accessToken', data.accessToken, {
          expires: 1,
          secure: true,
          sameSite: 'strict',
        });
        Cookies.set('refreshToken', data.refreshToken, {
          expires: 7,
          secure: true,
          sameSite: 'strict',
        });
        router.push('/locate');
      } else {
        setError(
          data.message || 'Login failed. Please check your credentials.',
        );
      }
    } catch (err) {
      setError('An error occurred during login. Please try again.');
      console.error('Login error:', err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label
          htmlFor="username"
          className="block text-sm font-medium text-gray-700"
        >
          Username
        </Label>
        <input
          id="username"
          type="text"
          placeholder="Choose a username"
          className="mt-1 w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition duration-200"
        />
      </div>
      <div>
        <Label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700"
        >
          Email Address
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="Enter your email"
          className="mt-1 w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition duration-200"
        />
      </div>
      <div>
        <Label
          htmlFor="password"
          className="block text-sm font-medium text-gray-700"
        >
          Password
        </Label>
        <Input
          id="password"
          type="password"
          placeholder="Create a password"
          className="mt-1 w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition duration-200"
        />
      </div>
      <div>
        <Label
          htmlFor="confirm-password"
          className="block text-sm font-medium text-gray-700"
        >
          Confirm Password
        </Label>
        <Input
          id="confirm-password"
          type="password"
          placeholder="Confirm your password"
          className="mt-1 w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition duration-200"
        />
      </div>
      <div className="flex items-center">
        <Input
          id="terms"
          type="checkbox"
          className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
        />
        <Label htmlFor="terms" className="ml-2 text-sm text-gray-600">
          I agree to the{' '}
          <a
            href="#"
            className="text-purple-600 hover:text-purple-800 transition duration-200"
          >
            Terms & Conditions
          </a>
        </Label>
      </div>
      <Button className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition duration-200 font-semibold">
        Sign Up
      </Button>
    </form>
  );
}
