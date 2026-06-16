/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { authApi } from '../lib/api';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'owner' | 'accountant' | 'manager' | 'employee';
  organisationId: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
}

export interface Organisation {
  id: string;
  name: string;
  email: string;
  phone?: string;
  logoUrl?: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [organisation, setOrganisation] = useState<Organisation | null>(() => {
    const saved = localStorage.getItem('organisation');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('accessToken'));
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

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await authApi.login({ email, password });
      
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('organisation', JSON.stringify(data.organisation));

      setToken(data.accessToken);
      setUser(data.user);
      setOrganisation(data.organisation);
      return data;
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message || 'Login failed';
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
      
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('organisation', JSON.stringify(data.organisation));

      setToken(data.accessToken);
      setUser(data.user);
      setOrganisation(data.organisation);
      return data;
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message || 'Registration failed';
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      const rToken = localStorage.getItem('refreshToken');
      if (rToken) {
        await authApi.logout(rToken);
      }
    } catch (e) {
      console.warn('Backend logout failed or session expired', e);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      localStorage.removeItem('organisation');
      localStorage.removeItem('demo_mode_active');
      setToken(null);
      setUser(null);
      setOrganisation(null);
      setIsLoading(false);
      window.location.href = '/login';
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
    register,
    logout,
  };
}
