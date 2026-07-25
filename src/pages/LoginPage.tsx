import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  Sparkles, Mail, Lock, User as UserIcon, CheckCircle, AlertCircle,
  Phone, Twitter, Linkedin, Facebook, Globe, Eye, EyeOff
} from 'lucide-react';

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (isAuthenticated) {
      window.location.href = '/app/dashboard';
    }
  }, [isAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      window.location.href = '/app/dashboard';
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = () => {
    localStorage.setItem('demo_mode_active', 'true');
    localStorage.setItem('accessToken', 'demo-token');
    localStorage.setItem('user', JSON.stringify({
      id: 'demo-user-id',
      email: 'controller@company.ng',
      fullName: 'Demo Administrator',
      role: 'owner',
      organisationId: 'demo-org-id',
      isActive: true,
      createdAt: new Date().toISOString()
    }));
    localStorage.setItem('organisation', JSON.stringify({
      id: 'demo-org-id',
      name: 'Skyhouse Enterprises',
      email: 'hello@skyaccounting.com.ng'
    }));
    window.location.href = '/app/dashboard';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-start pt-8 px-4 sm:px-6 lg:px-8 selection:bg-indigo-100 font-sans" id="auth-viewport-wrapper">
      <div className="absolute top-4 right-4">
        <button
          onClick={handleDemo}
          className="text-xs font-bold text-slate-500 hover:text-slate-700 outline-none bg-white py-2 px-4 rounded-xl border border-slate-200 flex items-center gap-1.5 shadow-sm transition-all hover:border-slate-300"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
          Demo Mode (Offline)
        </button>
      </div>

      <div className="mx-auto w-full max-w-5xl bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[620px]">
        {/* Left Column - Graphic & Highlights */}
        <div className="hidden md:flex md:col-span-5 bg-gradient-to-br from-indigo-900 via-indigo-850 to-slate-900 p-8 flex-col justify-between text-white relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.15),transparent)] pointer-events-none" />

          <div className="space-y-4">
            <div className="flex items-center space-x-2.5">
              <img src="/images/skyhouse-logo.png" alt="SkyBooks" className="w-10 h-10 drop-shadow-sm shrink-0 object-contain" />
              <div>
                <h3 className="text-md font-bold tracking-tight">SkyBooks</h3>
                <span className="text-[9px] text-indigo-300 font-bold uppercase tracking-widest font-mono">Accounting Ledgers</span>
              </div>
            </div>

            <div className="pt-8">
              <h1 className="text-xl font-extrabold tracking-tight text-white leading-tight">
                Streamline Corporate Accounting Ledgers for Nigerian SMEs
              </h1>
              <p className="text-xs text-indigo-200 mt-2 leading-relaxed">
                Connect bank accounts, track payables/receivables, and compile digital audits under SEC, FIRS and global IFRS compliance.
              </p>
            </div>
          </div>

          <div className="space-y-4 border-t border-indigo-800/40 pt-6">
            <div className="flex items-start space-x-3 text-xs">
              <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-white">Flutterwave & Paystack</h4>
                <p className="text-indigo-200 text-[11px] mt-0.5">Dual live bank feeds connect local banking institutions directly.</p>
              </div>
            </div>

            <div className="flex items-start space-x-3 text-xs">
              <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-white">Interactive Journal Ledger</h4>
                <p className="text-indigo-200 text-[11px] mt-0.5">Visual GAAP trial balances and structured MoM CFO advice.</p>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-indigo-400 font-mono">
            SECURE CLOUD PLATFORM V2.4 • SKYHOUSE
          </div>
        </div>

        {/* Right Column - Form */}
        <div className="col-span-1 md:col-span-7 p-8 sm:p-12 flex flex-col justify-center">
          <div className="mb-6 md:hidden text-center">
            <span className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-extrabold flex items-center justify-center text-xl shadow-lg shadow-indigo-200 mx-auto mb-3 select-none">
              S
            </span>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">SkyBooks</h2>
          </div>

          <div>
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Sign In</h2>
            <p className="text-xs text-slate-400 mt-1">Enterprise Accounting Books</p>
          </div>

          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Corporate Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="email"
                  required
                  placeholder="controller@company.ng"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 text-sm border border-slate-200 rounded-xl outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition bg-slate-50/20 text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 text-sm border border-slate-200 rounded-xl outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition bg-slate-50/20 text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none flex items-center justify-center p-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center">
                <input id="remember-me" name="remember-me" type="checkbox" className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded cursor-pointer" />
                <label htmlFor="remember-me" className="ml-2 block text-xs text-slate-500 font-semibold select-none cursor-pointer">Remember Me</label>
              </div>
              <div className="text-xs font-bold">
                <Link to="/forgot-password" id="forgot-pass-anchor" className="text-indigo-600 hover:text-indigo-700">Forgot password?</Link>
              </div>
            </div>

            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl flex items-center leading-relaxed">
                <AlertCircle className="w-4 h-4 text-rose-500 mr-2 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-slate-900 focus:outline-none transition-all flex justify-center items-center cursor-pointer shadow-md shadow-indigo-100"
            >
              {loading ? 'Authenticating Security Node...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <Link to="/register" id="ref-register-anchor" className="text-xs font-black text-slate-800 hover:text-indigo-700">
              New company? Build Corporate Accounting Books
            </Link>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-center gap-2">
            <a href="tel:+2348157377000" className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-100 flex items-center justify-center duration-150 cursor-pointer" title="Call Phone (+234 815 737 7000)" aria-label="Call +234 815 737 7000">
              <Phone className="h-3.5 w-3.5" />
            </a>
            <a href="mailto:hello@skyaccounting.com.ng" className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-100 flex items-center justify-center duration-150 cursor-pointer" title="Email: hello@skyaccounting.com.ng" aria-label="Email: hello@skyaccounting.com.ng">
              <Mail className="h-3.5 w-3.5" />
            </a>
            <a href="https://www.skyaccounting.com.ng" target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-100 flex items-center justify-center duration-150 cursor-pointer" title="Website: www.skyaccounting.com.ng" aria-label="Website: www.skyaccounting.com.ng">
              <Globe className="h-3.5 w-3.5" />
            </a>

            <div className="h-4 w-[1px] bg-slate-200 mx-1 self-center" />

            <a href="https://facebook.com/skyhouse" target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-100 flex items-center justify-center duration-150 cursor-pointer" title="Facebook" aria-label="Facebook Profile">
              <Facebook className="h-3.5 w-3.5" />
            </a>
            <a href="https://twitter.com/skyhouse" target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-100 flex items-center justify-center duration-150 cursor-pointer" title="Twitter/X" aria-label="Twitter Profile">
              <Twitter className="h-3.5 w-3.5" />
            </a>
            <a href="https://linkedin.com/company/skyhouse" target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-100 flex items-center justify-center duration-150 cursor-pointer" title="LinkedIn" aria-label="LinkedIn Profile">
              <Linkedin className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
