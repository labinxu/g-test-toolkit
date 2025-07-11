'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSession } from '../context/session-context';
export function SignupForm() {
  const [username, setUsername] = useState('labin');
  const [email, setEmail] = useState('labin@gmail.com');
  const [password, setPassword] = useState('a111111');
  const [error, setError] = useState('');
  const router = useRouter();

  const { register } = useSession();
  // Fetch CSRF token on component mount
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await register(username, email, password);
      router.push('/signin');
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
        <Input
          id="username"
          type="text"
          placeholder="Choose a username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
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
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
          }}
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
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
      <Button
        className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition duration-200 font-semibold"
        onClick={handleSubmit}
      >
        Sign Up
      </Button>
    </form>
  );
}
