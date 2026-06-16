/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../lib/api';

// =========================================================================
// SHARED STYLES & COMPONENTS
// =========================================================================

const inputClass =
  'w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400';

const btnClass =
  'w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed';

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">SkyBooks</h1>
          <p className="text-blue-300 text-sm mt-1">Cloud Accounting for Nigerian Businesses</p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">{children}</div>
      </div>
    </div>
  );
}

// =========================================================================
// LOGIN PAGE
// =========================================================================

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authApi.login({ email, password });
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('organisation', JSON.stringify(data.organisation));
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <h2 className="text-xl font-bold text-slate-800 mb-1">Sign In</h2>
      <p className="text-slate-500 text-sm mb-6">Access your accounting books</p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Work Email</label>
          <input
            type="email"
            className={inputClass}
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
          <input
            type="password"
            className={inputClass}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-xs text-blue-600 hover:underline">
            Forgot password?
          </Link>
        </div>
        <button type="submit" className={btnClass} disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        No account?{' '}
        <Link to="/register" className="text-blue-600 font-medium hover:underline">
          Create one
        </Link>
      </p>
    </AuthShell>
  );
}

// =========================================================================
// REGISTER PAGE
// =========================================================================

export function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    orgName: '',
    fullName: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authApi.register(form);
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('organisation', JSON.stringify(data.organisation));
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <h2 className="text-xl font-bold text-slate-800 mb-1">Create Account</h2>
      <p className="text-slate-500 text-sm mb-6">Set up your cloud accounting books</p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Organisation Legal Name</label>
          <input
            type="text"
            name="orgName"
            className={inputClass}
            placeholder="Acme Nigeria Ltd"
            value={form.orgName}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Administrator Full Name</label>
          <input
            type="text"
            name="fullName"
            className={inputClass}
            placeholder="Olalekan Edun"
            value={form.fullName}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Work Email</label>
          <input
            type="email"
            name="email"
            className={inputClass}
            placeholder="you@company.com"
            value={form.email}
            onChange={handleChange}
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
          <input
            type="password"
            name="password"
            className={inputClass}
            placeholder="Min. 6 characters"
            value={form.password}
            onChange={handleChange}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        <button type="submit" className={btnClass} disabled={loading}>
          {loading ? 'Creating account...' : 'Initialize New Ledger'}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        Already have an account?{' '}
        <Link to="/login" className="text-blue-600 font-medium hover:underline">
          Sign In
        </Link>
      </p>
    </AuthShell>
  );
}

// =========================================================================
// FORGOT PASSWORD PAGE (placeholder)
// =========================================================================

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  return (
    <AuthShell>
      <h2 className="text-xl font-bold text-slate-800 mb-1">Reset Password</h2>
      <p className="text-slate-500 text-sm mb-6">We'll send reset instructions to your email</p>

      {sent ? (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm text-center">
          If that email exists, you'll receive reset instructions shortly.
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Work Email</label>
            <input
              type="email"
              className={inputClass}
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button type="submit" className={btnClass}>
            Send Reset Link
          </button>
        </form>
      )}

      <p className="text-center text-sm text-slate-500 mt-6">
        <Link to="/login" className="text-blue-600 font-medium hover:underline">
          Back to Sign In
        </Link>
      </p>
    </AuthShell>
  );
}
