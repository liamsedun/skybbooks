import { useState, useEffect } from 'react';
import { authApi } from '../lib/api';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'owner' | 'admin' | 'accountant' | 'manager' | 'employee';
  organisationId?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  avatarUrl?: string;
}

export interface Organisation {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
}

function getAuthPrefix(): string {
  if (typeof window === 'undefined') return '';
  return window.location.pathname.startsWith('/platform') ? 'platform_' : '';
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => {
    const prefix = getAuthPrefix();
    const saved = localStorage.getItem(prefix + 'user');
    return saved ? JSON.parse(saved) : null;
  });
  const [organisation, setOrganisation] = useState<Organisation | null>(() => {
    const prefix = getAuthPrefix();
    const saved = localStorage.getItem(prefix + 'organisation');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    const prefix = getAuthPrefix();
    return localStorage.getItem(prefix + 'accessToken');
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleUnauthorized = () => {
      setToken(null);
      setUser(null);
      setOrganisation(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  function storeAuth(data: any) {
    const prefix = getAuthPrefix();
    localStorage.setItem(prefix + 'accessToken', data.accessToken);
    localStorage.setItem(prefix + 'refreshToken', data.refreshToken);
    localStorage.setItem(prefix + 'user', JSON.stringify(data.user));
    if (data.organisation) {
      localStorage.setItem(prefix + 'organisation', JSON.stringify(data.organisation));
    }
    setToken(data.accessToken);
    setUser(data.user);
    setOrganisation(data.organisation || null);
  }

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await authApi.login({ email, password });
      storeAuth(data);
      return data;
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message || 'Login failed';
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const platformLogin = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await authApi.platformLogin({ email, password });
      storeAuth(data);
      return data;
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message || 'Platform login failed';
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (input: any) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await authApi.register(input);
      storeAuth(data);
      return data;
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message || 'Registration failed';
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (input: any) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await authApi.signup(input);
      const prefix = getAuthPrefix();
      localStorage.setItem(prefix + 'accessToken', data.accessToken);
      localStorage.setItem(prefix + 'refreshToken', data.refreshToken);
      localStorage.setItem(prefix + 'user', JSON.stringify(data.user));
      localStorage.setItem(prefix + 'organisation', JSON.stringify(data.org || data.organisation));
      if (data.subscription) {
        localStorage.setItem('subscription', JSON.stringify(data.subscription));
      }
      setToken(data.accessToken);
      setUser(data.user);
      setOrganisation(data.org || data.organisation);
      return data;
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message || 'Signup failed';
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    const prefix = getAuthPrefix();
    const loginUrl = prefix === 'platform_' ? '/platform/login' : '/login';
    try {
      const rToken = localStorage.getItem(prefix + 'refreshToken');
      if (rToken) {
        if (prefix === 'platform_') {
          await authApi.platformLogout(rToken);
        } else {
          await authApi.logout(rToken);
        }
      }
    } catch (e) {
      console.warn('Backend logout failed or session expired', e);
    } finally {
      localStorage.removeItem(prefix + 'accessToken');
      localStorage.removeItem(prefix + 'refreshToken');
      localStorage.removeItem(prefix + 'user');
      localStorage.removeItem(prefix + 'organisation');
      localStorage.removeItem('demo_mode_active');
      setToken(null);
      setUser(null);
      setOrganisation(null);
      setIsLoading(false);
      window.location.href = loginUrl;
    }
  };

  const refreshUser = async () => {
    try {
      const data = await authApi.getMe();
      const prefix = getAuthPrefix();
      localStorage.setItem(prefix + 'user', JSON.stringify(data.user));
      if (data.organisation) {
        localStorage.setItem(prefix + 'organisation', JSON.stringify(data.organisation));
      }
      setUser(data.user);
      setOrganisation(data.organisation);
      return data;
    } catch (err) {
      console.error('Failed to refresh user', err);
    }
  };

  return {
    user,
    organisation,
    token,
    isAuthenticated: !!token,
    isLoading,
    error,
    login,
    platformLogin,
    register,
    signup,
    logout,
    refreshUser,
  };
}
