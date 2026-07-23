import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LogIn, ShieldAlert, Eye, EyeOff, AlertCircle, Mail, Lock, ArrowLeft } from 'lucide-react';

function friendlyError(err: string): string {
  if (err.includes('not found') || err.includes('404')) return 'Service unavailable. Please try again later.';
  if (err.includes('password') || err.includes('Invalid email')) return 'Invalid email or password.';
  if (err.includes('deactivated') || err.includes('inactive')) return 'Your account has been deactivated.';
  if (err.includes('rate limit') || err.includes('Too many')) return 'Too many attempts. Please wait before trying again.';
  if (err.includes('network') || err.includes('connect') || err.includes('ECONNREFUSED')) return 'Unable to connect. Check your internet connection.';
  return err;
}

export function PlatformLoginPage() {
  const { platformLogin, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState('');

  if (isAuthenticated) {
    navigate('/platform', { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setLoginError('Please enter your email and password.');
      return;
    }
    setSubmitting(true);
    setLoginError('');
    try {
      await platformLogin(email, password);
      navigate('/platform');
    } catch (err: any) {
      const raw = err.response?.data?.error || err.message || 'Login failed. Please try again.';
      setLoginError(friendlyError(raw));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.08),transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(6,182,212,0.06),transparent_50%)] pointer-events-none" />

      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface/10 backdrop-blur-sm mb-4 ring-1 ring-white/10">
            <ShieldAlert className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Platform Admin</h1>
          <p className="text-sm text-ink-400 mt-1">Sign in to SkyHouse administration</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface/5 backdrop-blur-sm rounded-2xl p-6 shadow-2xl ring-1 ring-white/10 space-y-4">
          {loginError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-3 py-2.5 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider block mb-1.5">Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-ink-500 absolute left-3 top-3" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@skyhouse.com"
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-900/60 border border-slate-700/60 rounded-xl text-white placeholder:text-ink-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all"
                required
                autoFocus
                autoComplete="email"
                disabled={submitting}
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider block mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-ink-500 absolute left-3 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-900/60 border border-slate-700/60 rounded-xl text-white placeholder:text-ink-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all"
                required
                autoComplete="current-password"
                disabled={submitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-2 text-ink-500 hover:text-slate-300 transition-colors p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                disabled={submitting}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || isLoading}
            className="w-full py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Sign In
              </>
            )}
          </button>

          <div className="pt-2 text-center">
            <a href="/login" className="text-xs text-ink-500 hover:text-slate-300 transition-colors inline-flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" />
              Back to tenant login
            </a>
          </div>
        </form>

        <p className="text-center mt-6 text-xs text-ink-600">
          SkyHouse Platform Administration &middot; Authorized access only
        </p>
      </div>
    </div>
  );
}
