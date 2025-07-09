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

// Utility to decode JWT and get expiration time
const getTokenExpiration = (token: string): number | null => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 : null; // Convert to milliseconds
  } catch {
    return null;
  }
};

interface SessionContextType {
  isAuthenticated: boolean;
  accessToken: string | null;
  logout: () => void;
  user: { username: string; email: string } | null;
}
type User = { username: string; email: string };

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  const checkAuth = async () => {
    let token = Cookies.get('accessToken');

    if (!token) {
      setIsAuthenticated(false);
      setAccessToken(null);
      setUser(null);
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
          setIsAuthenticated(false);
          setAccessToken(null);
          setUser(null);
          router.push('/signin');
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
      Cookies.remove('accessToken');
      Cookies.remove('refreshToken');
      setIsAuthenticated(false);
      setAccessToken(null);
      setUser(null);
      router.push('/signin');
    } finally {
      setIsLoading(false);
    }
  };

  // Token refresh logic
  useEffect(() => {
    if (!accessToken) return;

    const scheduleRefresh = async () => {
      const expiration = getTokenExpiration(accessToken);
      if (!expiration) {
        console.warn('Could not decode token expiration');
        checkAuth(); // Fallback to checkAuth if token can't be decoded
        return;
      }

      const refreshMargin = 5 * 60 * 1000; // Refresh 5 minutes before expiration
      const timeUntilRefresh = expiration - Date.now() - refreshMargin;

      if (timeUntilRefresh <= 0) {
        await checkAuth(); // Immediate refresh or logout if token is expired
        return;
      }

      const timeoutId = setTimeout(async () => {
        try {
          const newToken = await refreshToken();
          setAccessToken(newToken);
          console.log('Token refreshed successfully');
        } catch (error) {
          console.error('Failed to refresh token:', error);
          Cookies.remove('accessToken');
          Cookies.remove('refreshToken');
          setIsAuthenticated(false);
          setAccessToken(null);
          setUser(null);
          router.push('/signin');
        }
      }, timeUntilRefresh);

      return () => clearTimeout(timeoutId);
    };

    scheduleRefresh();
    return () => {}; // Ensure cleanup is handled within scheduleRefresh
  }, [accessToken, router]);

  // Initial auth check
  useEffect(() => {
    checkAuth();
  }, [router]);

  const logout = () => {
    Cookies.remove('accessToken');
    Cookies.remove('refreshToken');
    setIsAuthenticated(false); // Fixed typo from previous code
    setAccessToken(null);
    setUser(null);
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
