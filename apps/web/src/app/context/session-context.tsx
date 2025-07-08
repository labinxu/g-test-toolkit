'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { refreshToken } from '@/lib/utils';

interface SessionContextType {
  isAuthenticated: boolean;
  accessToken: string | null;
  logout: () => void;
  user: { username: string; email: string } | null;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      let token = Cookies.get('accessToken');

      if (!token) {
        setIsLoading(false);
        router.push('/signin');
        return;
      }

      try {
        const response = await fetch('/api/auth/profile', {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        });

        if (response.ok) {
          setIsAuthenticated(true);
          setAccessToken(token);
          const { username, email } = await response.json();
          setUser({ username, email });
        } else if (response.status === 401) {
          try {
            token = await refreshToken();
            setIsAuthenticated(true);
            setAccessToken(token);
          } catch (refreshError) {
            console.error('Refresh error:', refreshError);
            Cookies.remove('accessToken');
            Cookies.remove('refreshToken');
            router.push('/signin');
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
        Cookies.remove('accessToken');
        Cookies.remove('refreshToken');
        router.push('/signin');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const logout = () => {
    Cookies.remove('accessToken');
    Cookies.remove('refreshToken');
    setIsAuthenticated(false);
    setAccessToken(null);
    router.push('/signin');
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
      value={{ isAuthenticated, accessToken, logout, user }}
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
