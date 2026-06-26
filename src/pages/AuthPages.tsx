/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { authApi, api } from '../lib/api';
import {
  Mail,
  Lock,
  Building2,
  User,
  Eye,
  EyeOff,
  Phone,
  Globe,
  Facebook,
  Linkedin,
  CheckCircle2,
  Loader2,
  ArrowRight,
} from 'lucide-react';

// =========================================================================
// CONTACT & SOCIAL LINKS — Skyhouse Accountants & Technologies
// =========================================================================

const CONTACT = {
  phone: '+2348157377000',
  email: 'hello@skyaccounting.com.ng',
  website: 'https://skyaccounting.com.ng',
  facebook: 'https://web.facebook.com/skyhouseaccountants',
  x: 'https://x.com/SkyhouseAccount',
  linkedin: 'https://ng.linkedin.com/company/skyhouse-accounting-bookkeepers',
};

const FEATURES = [
  'Live bank feeds via Flutterwave & Paystack',
  'Nigerian chart of accounts, seeded on day one',
  'FIRS, SEC & IFRS-ready trial balances and audit logs',
];

// =========================================================================
// SHARED VISUAL PIECES
// =========================================================================

function XGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 4l16 16M20 4L4 20" />
    </svg>
  );
}

function SkyhouseMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" className={className}>
      <path
        d="M5 13.5L14 6l9 7.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 12v9.5h12V12"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Signature element: a skyline that reads equally as a bar chart —
// the dual visual nods to "Sky[house]" and the ledgers the product runs on.
const SKYLINE_BARS = [34, 56, 42, 72, 50, 86, 62, 46];

function SkylineSignature() {
  return (
    <div className="flex items-end gap-2 h-24" aria-hidden="true">
      {SKYLINE_BARS.map((h, i) => (
        <div
          key={i}
          className="auth-skyline-bar flex-1 rounded-t-sm bg-gradient-to-t from-indigo-400/40 to-amber-300/70"
          style={{ height: `${h}%`, animationDelay: `${i * 70}ms` }}
        />
      ))}
    </div>
  );
}

function ContactRow({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const base =
    tone === 'dark'
      ? 'text-indigo-200/70 hover:text-white'
      : 'text-slate-400 hover:text-slate-700';
  const divider = tone === 'dark' ? 'bg-indigo-700/60' : 'bg-slate-200';

  return (
    <div className="flex items-center gap-3">
      <a href={`tel:${CONTACT.phone}`} aria-label="Call Skyhouse Accountants & Technologies" className={base}>
        <Phone className="w-4 h-4" />
      </a>
      <a href={`mailto:${CONTACT.email}`} aria-label="Email Skyhouse Accountants & Technologies" className={base}>
        <Mail className="w-4 h-4" />
      </a>
      <a
        href={CONTACT.website}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Visit Skyhouse Accountants & Technologies website"
        className={base}
      >
        <Globe className="w-4 h-4" />
      </a>
      <span className={`w-px h-4 ${divider}`} />
      <a
        href={CONTACT.facebook}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Skyhouse Accountants & Technologies on Facebook"
        className={base}
      >
        <Facebook className="w-4 h-4" />
      </a>
      <a
        href={CONTACT.x}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Skyhouse Accountants & Technologies on X"
        className={base}
      >
        <XGlyph className="w-4 h-4" />
      </a>
      <a
        href={CONTACT.linkedin}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Skyhouse Accountants & Technologies on LinkedIn"
        className={base}
      >
        <Linkedin className="w-4 h-4" />
      </a>
    </div>
  );
}

// =========================================================================
// AUTH SHELL — two-panel layout shared by Login, Register & Forgot Password
// =========================================================================

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 lg:p-8">
      <style>{`
        @keyframes auth-grow-bar {
          from { transform: scaleY(0); }
          to { transform: scaleY(1); }
        }
        @media (prefers-reduced-motion: no-preference) {
          .auth-skyline-bar {
            transform-origin: bottom;
            animation: auth-grow-bar 0.6s cubic-bezier(0.22, 1, 0.36, 1) backwards;
          }
        }
        @media (prefers-reduced-motion: no-preference) {
          .auth-card-enter {
            animation: auth-fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
          }
        }
        @keyframes auth-fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="auth-card-enter w-full max-w-5xl bg-white rounded-3xl shadow-xl overflow-hidden grid lg:grid-cols-[1.05fr_1fr]">
        {/* Brand panel */}
        <div className="hidden lg:flex relative flex-col justify-between bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-900 p-10 text-white overflow-hidden">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center">
                <SkyhouseMark className="w-5 h-5 text-amber-300" />
              </span>
              <div>
                <h1 className="text-lg font-bold tracking-tight leading-none">SkyBooks</h1>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-300/80 mt-0.5">
                  Accounting Ledgers
                </p>
              </div>
            </div>

            <h2 className="text-3xl font-bold leading-tight mt-10 max-w-sm">
              Double-entry accounting, built for Nigeria's SMEs.
            </h2>
            <p className="text-indigo-200/80 text-sm mt-3 max-w-sm leading-relaxed">
              Connect your bank, automate reconciliation, and stay ready for FIRS, SEC and IFRS —
              without hiring a forensic accountant.
            </p>

            <ul className="mt-8 space-y-3">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-indigo-100/90">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <SkylineSignature />
            <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-between">
              <p className="text-[11px] text-indigo-300/70">
                A product of Skyhouse Accountants &amp; Technologies
              </p>
              <ContactRow tone="dark" />
            </div>
          </div>
        </div>

        {/* Form panel */}
        <div className="flex flex-col p-6 sm:p-10 lg:p-12">
          {/* Mobile-only compact header */}
          <div className="flex lg:hidden items-center gap-2.5 mb-8">
            <span className="w-8 h-8 rounded-lg bg-indigo-950 flex items-center justify-center">
              <SkyhouseMark className="w-4.5 h-4.5 text-amber-300" />
            </span>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">SkyBooks</h1>
          </div>

          <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto">
            {children}
          </div>

          {/* Mobile-only footer contact row */}
          <div className="flex lg:hidden items-center justify-between mt-10 pt-5 border-t border-slate-100">
            <p className="text-[11px] text-slate-400">Skyhouse Accountants &amp; Technologies</p>
            <ContactRow tone="light" />
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// SHARED FORM FIELDS
// =========================================================================

function TextField({
  icon: Icon,
  label,
  ...props
}: { icon: React.ComponentType<{ className?: string }>; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          {...props}
          className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-slate-400 transition-shadow"
        />
      </div>
    </div>
  );
}

function PasswordField({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      <div className="relative">
        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          {...props}
          type={show ? 'text' : 'password'}
          className="w-full pl-11 pr-11 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-slate-400 transition-shadow"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function SubmitButton({ loading, idleLabel, loadingLabel }: { loading: boolean; idleLabel: string; loadingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed group"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {loadingLabel}
        </>
      ) : (
        <>
          {idleLabel}
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </>
      )}
    </button>
  );
}

function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="mb-5 p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-sm">
      {message}
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
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">Sign in</h2>
      <p className="text-slate-500 text-sm mb-7">Access your accounting books</p>

      <ErrorBanner message={error} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField
          icon={Mail}
          label="Work email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <PasswordField
          label="Password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <div className="flex justify-end -mt-1">
          <Link to="/forgot-password" className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline">
            Forgot password?
          </Link>
        </div>
        <SubmitButton loading={loading} idleLabel="Sign in" loadingLabel="Signing in..." />
      </form>

      <p className="text-center text-sm text-slate-500 mt-7">
        New to SkyBooks?{' '}
        <Link to="/register" className="text-indigo-600 font-medium hover:underline">
          Set up your company
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
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">Set up your company</h2>
      <p className="text-slate-500 text-sm mb-7">Build your double-entry ledger in minutes</p>

      <ErrorBanner message={error} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField
          icon={Building2}
          label="Organisation legal name"
          type="text"
          name="orgName"
          placeholder="Acme Nigeria Ltd"
          value={form.orgName}
          onChange={handleChange}
          required
        />
        <TextField
          icon={User}
          label="Administrator full name"
          type="text"
          name="fullName"
          placeholder="Olalekan Edun"
          value={form.fullName}
          onChange={handleChange}
          required
        />
        <TextField
          icon={Mail}
          label="Work email"
          type="email"
          name="email"
          placeholder="you@company.com"
          value={form.email}
          onChange={handleChange}
          required
          autoComplete="email"
        />
        <PasswordField
          label="Password"
          name="password"
          placeholder="Min. 6 characters"
          value={form.password}
          onChange={handleChange}
          required
          minLength={6}
          autoComplete="new-password"
        />
        <SubmitButton loading={loading} idleLabel="Initialize new ledger" loadingLabel="Creating account..." />
      </form>

      <p className="text-center text-sm text-slate-500 mt-7">
        Already have an account?{' '}
        <Link to="/login" className="text-indigo-600 font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}

// =========================================================================
// FORGOT PASSWORD PAGE
// =========================================================================

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  return (
    <AuthShell>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">Reset password</h2>
      <p className="text-slate-500 text-sm mb-7">We'll send reset instructions to your email</p>

      {sent ? (
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-sm text-center">
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
          <TextField
            icon={Mail}
            label="Work email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <SubmitButton loading={false} idleLabel="Send reset link" loadingLabel="Sending..." />
        </form>
      )}

      <p className="text-center text-sm text-slate-500 mt-7">
        <Link to="/login" className="text-indigo-600 font-medium hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}

// =========================================================================
// ACCEPT INVITE — Complete registration from invitation link
// =========================================================================

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ name: string; email: string; role: string; orgName: string } | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!token) { setError('No invitation token found.'); setLoading(false); return; }
    api.get(`/org/invite/${token}`)
      .then(res => { setInvite(res.data); setLoading(false); })
      .catch(err => { setError(err?.response?.data?.error || 'Invalid or expired invitation.'); setLoading(false); });
  }, [token]);

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !password || password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setAccepting(true); setError(null);
    try {
      const res = await api.post(`/org/invite/${token}/accept`, { password });
      setSuccess(res.data.message || 'Account created! You can now log in.');
      setTimeout(() => navigate('/login'), 2500);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to accept invitation.');
    } finally { setAccepting(false); }
  }

  return (
    <AuthShell>
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-indigo-600" /></div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm text-center">{error}</div>
      ) : success ? (
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-sm text-center">{success}</div>
      ) : invite ? (
        <>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Accept Invitation</h2>
          <p className="text-slate-500 text-sm mb-2">
            You've been invited to join <strong>{invite.orgName}</strong> as a <strong className="capitalize">{invite.role}</strong>.
          </p>
          <p className="text-slate-400 text-xs mb-7">Set your password to activate your account.</p>

          <form onSubmit={handleAccept} className="space-y-4">
            <TextField icon={User} label="Name" value={invite.name} disabled />
            <TextField icon={Mail} label="Email" type="email" value={invite.email} disabled />
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Create a password (min 6 characters)"
                  className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 placeholder-slate-400"
                  required
                  minLength={6}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <SubmitButton loading={accepting} idleLabel="Accept & Create Account" loadingLabel="Creating account..." />
          </form>

          <p className="text-center text-sm text-slate-500 mt-7">
            <Link to="/login" className="text-indigo-600 font-medium hover:underline">Back to sign in</Link>
          </p>
        </>
      ) : null}
    </AuthShell>
  );
}
