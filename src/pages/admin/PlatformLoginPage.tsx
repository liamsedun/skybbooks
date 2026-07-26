import { useState, useEffect } from 'react';
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

const PARTICLES = Array.from({ length: 30 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: 2 + Math.random() * 4,
  speed: 0.3 + Math.random() * 0.7,
  delay: Math.random() * 8,
  opacity: 0.15 + Math.random() * 0.35,
}));

export function PlatformLoginPage() {
  const { platformLogin, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

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

  const fadeIn = (delay: number) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(20px)',
    transition: `all 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
  });

  return (
    <div className="min-h-screen bg-[#0a0b1e] flex items-center justify-center p-4 relative overflow-hidden">

      {/* Animated gradient orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.12),transparent_70%)] animate-pulse" style={{ animationDuration: '6s' }} />
      <div className="absolute bottom-[-15%] right-[-10%] w-[45%] h-[45%] rounded-full bg-[radial-gradient(circle,rgba(6,182,212,0.1),transparent_70%)] animate-pulse" style={{ animationDuration: '8s', animationDelay: '1s' }} />
      <div className="absolute top-[40%] right-[5%] w-[25%] h-[25%] rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.06),transparent_70%)] animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />

      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />

      {/* Floating particles */}
      {PARTICLES.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full bg-white pointer-events-none"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            opacity: 0,
            animation: `float-particle ${8 / p.speed}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}

      <style>{`
        @keyframes float-particle {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: ${0.15 + Math.random() * 0.35}; }
          50% { transform: translateY(-120px) translateX(40px); opacity: ${0.1 + Math.random() * 0.2}; }
          90% { opacity: ${0.15 + Math.random() * 0.35}; }
        }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(99,102,241,0.15), 0 0 40px rgba(99,102,241,0.05); }
          50% { box-shadow: 0 0 30px rgba(99,102,241,0.25), 0 0 60px rgba(99,102,241,0.1); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .input-glow:focus {
          animation: glow-pulse 2s ease-in-out infinite;
        }
      `}</style>

      <div className="w-full max-w-sm relative z-10" style={fadeIn(0)}>
        <div className="text-center mb-8" style={fadeIn(0.2)}>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/[0.04] backdrop-blur-sm mb-4 ring-1 ring-white/[0.06] relative group">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-cyan-500/5 animate-pulse" style={{ animationDuration: '4s' }} />
            <ShieldAlert className="w-8 h-8 text-indigo-400 relative z-10 group-hover:scale-110 transition-transform duration-300" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Platform Admin</h1>
          <p className="text-sm text-slate-400 mt-1">Sign in to SkyHouse administration</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/[0.03] backdrop-blur-sm rounded-2xl p-6 shadow-2xl ring-1 ring-white/[0.06] space-y-4" style={fadeIn(0.4)}>
          {loginError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-3 py-2.5 flex items-center gap-2 animate-in" style={fadeIn(0)}>
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <div style={fadeIn(0.5)}>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Email</label>
            <div className="relative group/input">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3 group-focus-within/input:text-indigo-400 transition-colors" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@skyhouse.com"
                className="input-glow w-full pl-10 pr-4 py-2.5 text-sm bg-slate-900/60 border border-slate-700/60 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all"
                required
                autoFocus
                autoComplete="email"
                disabled={submitting}
              />
            </div>
          </div>

          <div style={fadeIn(0.6)}>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Password</label>
            <div className="relative group/input">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3 group-focus-within/input:text-indigo-400 transition-colors" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="input-glow w-full pl-10 pr-10 py-2.5 text-sm bg-slate-900/60 border border-slate-700/60 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all"
                required
                autoComplete="current-password"
                disabled={submitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                disabled={submitting}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div style={fadeIn(0.7)}>
            <button
              type="submit"
              disabled={submitting || isLoading}
              className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-sm font-semibold rounded-xl hover:from-indigo-500 hover:to-indigo-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 hover:shadow-indigo-500/30 active:scale-[0.98]"
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
          </div>

          <div className="pt-2 text-center" style={fadeIn(0.8)}>
            <a href="/login" className="text-xs text-slate-500 hover:text-slate-300 transition-colors inline-flex items-center gap-1 group">
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
              Back to tenant login
            </a>
          </div>
        </form>

        <p className="text-center mt-6 text-xs text-slate-600" style={fadeIn(0.9)}>
          SkyHouse Platform Administration &middot; Authorized access only
        </p>
      </div>
    </div>
  );
}
