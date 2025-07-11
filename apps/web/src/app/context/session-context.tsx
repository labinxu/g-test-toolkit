'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface SessionContextType {
  isAuthenticated: boolean;
  user: { username: string; email: string } | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    username: string,
    email: string,
    password: string,
  ) => Promise<void>;
  logout: () => void;
  csrfToken: string | null;
}

type User = { username: string; email: string };

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Fetch CSRF token
  const fetchCsrfToken = async () => {
    try {
      const response = await fetch('/api/auth/csrf-token', {
        method: 'GET',
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setCsrfToken(data.csrfToken);
        return data.csrfToken;
      } else {
        console.error('Failed to fetch CSRF token:', response.status);
        return null;
      }
    } catch (error) {
      console.error('Error fetching CSRF token:', error);
      return null;
    }
  };

  // Check authentication status
  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'GET',
        credentials: 'include', // Sends httpOnly access_token cookie
      });

      if (response.ok) {
        const data = await response.json();
        setIsAuthenticated(true);
        setUser({ username: data.user.username, email: data.user.email });
      } else {
        console.error('Profile fetch failed:', response.status);
        setIsAuthenticated(false);
        setUser(null);
        if (pathname !== '/register' && pathname !== '/signin') {
          router.push('/signin');
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setIsAuthenticated(false);
      setUser(null);
      if (pathname !== '/register' && pathname !== '/signin') {
        router.push('/signin');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Initial auth and CSRF token fetch
  useEffect(() => {
    const initialize = async () => {
      await fetchCsrfToken();
      await checkAuth();
    };
    initialize();
  }, [router, pathname]);

  // Login function
  const login = async (email: string, password: string) => {
    if (!csrfToken) {
      const token = await fetchCsrfToken();
      if (!token) {
        throw new Error('Failed to fetch CSRF token');
      }
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        await checkAuth(); // Refresh auth state after login
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  // Register function
  const register = async (
    username: string,
    email: string,
    password: string,
  ) => {
    if (!csrfToken) {
      const token = await fetchCsrfToken();
      if (!token) {
        throw new Error('Failed to fetch CSRF token');
      }
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ username, email, password }),
      });

      if (response.ok) {
        await checkAuth(); // Refresh auth state after registration
        router.push('/dashboard'); // Redirect to dashboard
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        setIsAuthenticated(false);
        setUser(null);
        router.push('/signin');
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center text-gray-600">
        Loading...
      </div>
    );
  }

  return (
    <SessionContext.Provider
      value={{ isAuthenticated, user, login, register, logout, csrfToken }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
