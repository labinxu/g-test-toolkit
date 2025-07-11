'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '../context/session-context';
export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const { login } = useSession();
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError('An error occurred during login. Please try again.');
      console.error('Login error:', err);
      alert(`${err}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700"
        >
          Email Address
        </label>
        <input
          id="email"
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200"
          required
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-gray-700"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200"
          required
        />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <input
            id="remember"
            type="checkbox"
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          />
          <label htmlFor="remember" className="ml-2 text-sm text-gray-600">
            Remember me
          </label>
        </div>
        <a
          href="#"
          className="text-sm text-indigo-600 hover:text-indigo-800 transition duration-200"
        >
          Forgot Password?
        </a>
      </div>
      <button
        type="submit"
        className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition duration-200 font-semibold"
      >
        Sign In
      </button>
      {error && (
        <div className="mt-4 text-center text-sm text-red-600">{error}</div>
      )}
    </form>
  );
}
