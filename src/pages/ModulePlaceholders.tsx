/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { SkyhouseLogo } from '../components/ui/SkyhouseLogo';
import { 
  Shield, Sparkles, Building, Mail, Lock, User as UserIcon, 
  HelpCircle, ChevronRight, CheckCircle, ArrowLeft, Plus, 
  Trash2, Search, FileText, DollarSign, Calendar, TrendingUp, AlertCircle,
  Phone, Twitter, Linkedin, Facebook, Globe, Eye, EyeOff, History, Users
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

// =========================================================================
// 1. PUBLIC AUTHENTICATION GATES
// =========================================================================

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
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
    window.location.href = '/dashboard';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 selection:bg-indigo-100 font-sans" id="auth-viewport-wrapper">
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
        {/* Left Column - Graphic & Highlights (Responsive) */}
        <div className="hidden md:flex md:col-span-5 bg-gradient-to-br from-indigo-900 via-indigo-850 to-slate-900 p-8 flex-col justify-between text-white relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
          
          <div className="space-y-4">
            <div className="flex items-center space-x-2.5">
              <SkyhouseLogo className="w-10 h-10 drop-shadow-sm shrink-0" color="#FFFFFF" />
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

        {/* Right Column - Beautiful Clean Form */}
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
                <input id="remember-me" name="remember-me" type="checkbox" className="h-4 w-4 text-indigo-650 focus:ring-indigo-500 border-slate-300 rounded cursor-pointer" />
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
            <Link to="/register" id="ref-register-anchor" className="text-xs font-black text-indigo-650 text-indigo-650 hover:text-indigo-700">
              New company? Build Corporate Accounting Books
            </Link>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-center gap-2">
            <a
              href="tel:+2348157377000"
              className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-100 flex items-center justify-center duration-150 cursor-pointer"
              title="Call Phone (+234 815 737 7000)"
              aria-label="Call +234 815 737 7000"
            >
              <Phone className="h-3.5 w-3.5" />
            </a>
            <a
              href="mailto:hello@skyaccounting.com.ng"
              className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-100 flex items-center justify-center duration-150 cursor-pointer"
              title="Email: hello@skyaccounting.com.ng"
              aria-label="Email: hello@skyaccounting.com.ng"
            >
              <Mail className="h-3.5 w-3.5" />
            </a>
            <a
              href="https://www.skyaccounting.com.ng"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-100 flex items-center justify-center duration-150 cursor-pointer"
              title="Website: www.skyaccounting.com.ng"
              aria-label="Website: www.skyaccounting.com.ng"
            >
              <Globe className="h-3.5 w-3.5" />
            </a>
            
            <div className="h-4 w-[1px] bg-slate-200 mx-1 self-center" />

            <a
              href="https://facebook.com/skyhouse"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-100 flex items-center justify-center duration-150 cursor-pointer"
              title="Facebook"
              aria-label="Facebook Profile"
            >
              <Facebook className="h-3.5 w-3.5" />
            </a>
            <a
              href="https://twitter.com/skyhouse"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-100 flex items-center justify-center duration-150 cursor-pointer"
              title="Twitter/X"
              aria-label="Twitter Profile"
            >
              <Twitter className="h-3.5 w-3.5" />
            </a>
            <a
              href="https://linkedin.com/company/skyhouse"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-100 flex items-center justify-center duration-150 cursor-pointer"
              title="LinkedIn"
              aria-label="LinkedIn Profile"
            >
              <Linkedin className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register({ orgName, fullName, email, password });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Ledger instantiation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 selection:bg-indigo-100 font-sans">
      <div className="mx-auto w-full max-w-5xl bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[620px]">
        {/* Left Column - Graphic/Highlight Info */}
        <div className="hidden md:flex md:col-span-5 bg-gradient-to-br from-indigo-900 via-indigo-850 to-slate-900 p-8 flex-col justify-between text-white relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
          
          <div className="space-y-4">
            <div className="flex items-center space-x-2.5">
              <SkyhouseLogo className="w-10 h-10 drop-shadow-sm shrink-0" color="#FFFFFF" />
              <div>
                <h3 className="text-md font-bold tracking-tight">SkyBooks</h3>
                <span className="text-[9px] text-indigo-300 font-bold uppercase tracking-widest font-mono">Accounting Ledgers</span>
              </div>
            </div>
            
            <div className="pt-8">
              <h1 className="text-xl font-extrabold tracking-tight text-white leading-tight">
                Enterprise-Grade Corporate Accounting
              </h1>
              <p className="text-xs text-indigo-100 mt-2 leading-relaxed">
                Initialize your dual-entry journal books, establish standard tax structures, and connect secure local banking streams in seconds.
              </p>
            </div>
          </div>

          <div className="space-y-3 py-6 border-t border-indigo-800/40">
            <div className="flex items-center space-x-2.5 text-xs text-indigo-100">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
              <span>GAAP, LIRS, and FIRS compliant settings</span>
            </div>
            <div className="flex items-center space-x-2.5 text-xs text-indigo-100">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
              <span>Multi-user roles with precise permissions</span>
            </div>
            <div className="flex items-center space-x-2.5 text-xs text-indigo-100">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
              <span>Real-time charts and income statements</span>
            </div>
          </div>

          <div className="text-[10px] text-indigo-400 font-mono">
            SECURE ENCRYPTED SETUP • SKYHOUSE
          </div>
        </div>

        {/* Right Column - Register Form */}
        <div className="col-span-1 md:col-span-7 p-8 sm:p-12 flex flex-col justify-center">
          <div className="mb-6 md:hidden text-center">
            <span className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-extrabold flex items-center justify-center text-xl shadow-lg shadow-indigo-200 mx-auto mb-3 select-none">
              S
            </span>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">SkyBooks</h2>
          </div>

          <div>
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Build Corporate Accounting Books</h2>
            <p className="text-xs text-slate-400 mt-1 font-sans">Setup secure cloud accounting ledgers nodes</p>
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Organisation Legal Name</label>
              <div className="relative">
                <Building className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Retail Corp Ltd"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-indigo-600 transition bg-slate-50/20 text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Administrator Full Name</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Temitope Adeola"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-indigo-600 transition bg-slate-50/20 text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Work Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="email"
                  required
                  placeholder="e.g. temitope@apexcorp.ng"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-indigo-600 transition bg-slate-50/20 text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">PASSWORD</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-indigo-600 transition bg-slate-50/20 text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none flex items-center justify-center p-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl">
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-slate-900 focus:outline-none transition shadow-md shadow-indigo-100 flex justify-center items-center cursor-pointer"
            >
              {loading ? 'Initializing ledger...' : 'Initialize New Ledger'}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-100 text-center">
            <Link to="/login" id="back-signin-anchor" className="text-xs font-bold text-indigo-600 hover:text-indigo-700">
              Already have active accounting books? Sign In
            </Link>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-center gap-2">
            <a
              href="tel:+2348157377000"
              className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-100 flex items-center justify-center duration-150 cursor-pointer"
              title="Call Phone (+234 815 737 7000)"
              aria-label="Call +234 815 737 7000"
            >
              <Phone className="h-3.5 w-3.5" />
            </a>
            <a
              href="mailto:hello@skyaccounting.com.ng"
              className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-100 flex items-center justify-center duration-150 cursor-pointer"
              title="Email: hello@skyaccounting.com.ng"
              aria-label="Email: hello@skyaccounting.com.ng"
            >
              <Mail className="h-3.5 w-3.5" />
            </a>
            <a
              href="https://www.skyaccounting.com.ng"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-100 flex items-center justify-center duration-150 cursor-pointer"
              title="Website: www.skyaccounting.com.ng"
              aria-label="Website: www.skyaccounting.com.ng"
            >
              <Globe className="h-3.5 w-3.5" />
            </a>
            
            <div className="h-4 w-[1px] bg-slate-200 mx-1 self-center" />

            <a
              href="https://facebook.com/skyhouse"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-100 flex items-center justify-center duration-150 cursor-pointer"
              title="Facebook"
              aria-label="Facebook Profile"
            >
              <Facebook className="h-3.5 w-3.5" />
            </a>
            <a
              href="https://twitter.com/skyhouse"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-100 flex items-center justify-center duration-150 cursor-pointer"
              title="Twitter/X"
              aria-label="Twitter Profile"
            >
              <Twitter className="h-3.5 w-3.5" />
            </a>
            <a
              href="https://linkedin.com/company/skyhouse"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-100 flex items-center justify-center duration-150 cursor-pointer"
              title="LinkedIn"
              aria-label="LinkedIn Profile"
            >
              <Linkedin className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ForgotPasswordPage() {
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <span className="w-12 h-12 rounded-2xl bg-purple-600 text-white font-extrabold flex items-center justify-center text-xl shadow-lg shadow-purple-200 mx-auto mb-4 select-none">
          F
        </span>
        <h2 className="text-xl font-black text-slate-900 uppercase">Vault Credentials Recovery</h2>
        <p className="mt-1.5 text-xs text-slate-400 font-mono uppercase tracking-widest font-medium">Verify credentials authority</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 border border-slate-150 shadow-md rounded-2xl sm:px-10">
          {success ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Ledger Authority Reset Transmitted</h3>
              <p className="text-xs text-slate-400 leading-normal">
                An authorization token has been sent to <strong>{email}</strong>. Open the link to verify credentials override.
              </p>
              <div className="pt-2">
                <Link to="/login" className="text-xs font-bold text-purple-600 hover:text-purple-700">Return to sign-in terminal</Link>
              </div>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Registered Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type="email"
                    required
                    placeholder="controller@company.ng"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 text-sm border border-slate-250 rounded-xl outline-none focus:border-purple-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 text-sm font-bold text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition cursor-pointer"
              >
                Send Recovery Key
              </button>

              <div className="text-center pt-2">
                <Link to="/login" className="text-xs font-bold text-slate-500 hover:text-slate-700">Cancel and return</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="min-h-[70vh] flex flex-col justify-center items-center text-center p-6 font-sans">
      <div className="p-4 bg-slate-50 rounded-3xl border border-slate-200 shadow-sm max-w-sm space-y-4">
        <h2 className="font-mono font-black text-rose-500 text-3xl tracking-widest">404</h2>
        <h3 className="font-sans font-extrabold text-sm uppercase tracking-wider text-slate-800">
          Route Unresolved
        </h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          The requested system route is either protected, offline or unmapped. Return to the home cockpit index.
        </p>
        <Link 
          to="/dashboard"
          className="block w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}

// =========================================================================
// 2. HELPER PLATFORM PAGE BUILDER (DASHBOARD COMPATIBLE / MOCKS)
// =========================================================================

function PageShell({ title, description, badge, children }: { title: string, description: string, badge?: string, children: React.ReactNode }) {
  return (
    <div className="space-y-6 font-sans text-left">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-5 border-b border-slate-100 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-black text-slate-900 tracking-tight uppercase">{title}</h1>
            {badge && (
              <span className="bg-purple-50 text-purple-700 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-purple-100">
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1 leading-normal font-medium">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// =========================================================================
// 3. SECURE PROTECTED MODULES (RICH GRAPHICS & FULL-COMPLIANCE INTERFACES)
// =========================================================================

export function CustomersPage() {
  const [customers, setCustomers] = useState([
    { id: '1', name: 'Alhaji Dangote Group', email: 'billing@dangote.com', phone: '08031112222', balanceKobo: 520000000, active: true },
    { id: '2', name: 'Mainasara Logistics', email: 'mainasara@logistics.ng', phone: '08097778888', balanceKobo: 15450000, active: true },
    { id: '3', name: 'Jumia Nigeria HQ', email: 'jumia@jumia.com', phone: '09015556666', balanceKobo: -2900000, active: true }
  ]);
  const [search, setSearch] = useState('');
  const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  const formatMoney = (kobo: number) => {
    return '₦' + (kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 });
  };

  return (
    <PageShell title="Client & Receivables Registry" description="Secure directory mapping of all buyers, corporate clients and credit logs." badge="Double-Entry Integrated">
      <div className="flex justify-between items-center bg-white p-4 border border-slate-100 rounded-2xl shadow-3xs gap-4">
        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input 
            type="text" 
            placeholder="Search buyers profile..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-purple-600 bg-slate-50/50"
          />
        </div>
        <button className="py-2 px-3.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition">
          <Plus className="w-3.5 h-3.5" />
          Onboard Client
        </button>
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-2xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/75 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
              <th className="p-4">Customer Name</th>
              <th className="p-4">Billing Email</th>
              <th className="p-4">Logistics Contact</th>
              <th className="p-4 text-right">Amortized Ledger Balance</th>
              <th className="p-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-xs">
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-slate-50/40">
                <td className="p-4 font-bold text-slate-800">{c.name}</td>
                <td className="p-4 font-mono font-medium text-slate-500">{c.email}</td>
                <td className="p-4 text-slate-600">{c.phone}</td>
                <td className={`p-4 text-right font-mono font-bold ${c.balanceKobo > 0 ? 'text-slate-950' : 'text-emerald-600'}`}>{formatMoney(c.balanceKobo)}</td>
                <td className="p-4 text-center">
                  <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 font-extrabold text-[9px] rounded-full uppercase">Active</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

export function QuotesPage() {
  const [quotes, setQuotes] = useState([
    { id: 'Q-1049', client: 'Mainasara Logistics', date: '2026-06-12', amountKobo: 43200000, status: 'sent', expires: '2026-07-12' },
    { id: 'Q-1048', client: 'Dangote Group', date: '2026-06-08', amountKobo: 250000000, status: 'accepted', expires: '2026-07-08' }
  ]);

  return (
    <PageShell title="Proforma Invoices & Quotes" description="Create legal corporate scopes with itemized cost sheets." badge="Quotes Centric">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quotes.map(q => (
          <div key={q.id} className="bg-white border border-slate-150 p-5 rounded-2xl space-y-3 shadow-3xs">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] uppercase font-mono font-extrabold text-slate-400">{q.id}</span>
                <h4 className="font-bold text-slate-800 text-sm mt-0.5">{q.client}</h4>
              </div>
              <span className={`px-2 py-0.5 font-extrabold text-[9px] border rounded-full uppercase ${
                q.status === 'accepted' ? 'bg-emerald-50 border-emerald-150 text-emerald-700' : 'bg-blue-50 border-blue-150 text-blue-700'
              }`}>{q.status}</span>
            </div>
            <div className="pt-2 border-t border-slate-50 flex justify-between items-center">
              <div>
                <span className="text-[9px] text-slate-400 font-bold block uppercase font-mono">Quoted Amount</span>
                <span className="font-mono text-xs font-black text-slate-950">₦{(q.amountKobo/100).toLocaleString()}</span>
              </div>
              <div className="text-right">
                <span className="text-[9px] text-slate-400 font-bold block uppercase font-mono">Expires On</span>
                <span className="text-slate-500 text-xs font-semibold">{q.expires}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

export function PaymentsPage() {
  return (
    <PageShell title="Inbound Corporate Payments" description="History of clear bank conversions, Stripe, and Paystack settlement logs." badge="Automated Bank Mapping">
      <div className="bg-emerald-50/50 border border-emerald-150 p-4 rounded-2xl flex gap-3.5 text-xs text-emerald-950 max-w-xl mx-auto">
        <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
        <div>
          <span className="font-bold block">Integrations Active:</span> Accounts are connected to your Nigerian Paystack key. Wire and POS payments are matched automatically via local virtual accounts.
        </div>
      </div>
    </PageShell>
  );
}

export function CreditNotesPage() {
  return (
    <PageShell title="Client Credit Notes" description="Reverse records in receivables loops matching returned consignments and disputes." badge="VAT Adjustment Ready">
      <p className="text-xs text-slate-500 text-center py-10 bg-white border border-slate-100 rounded-2xl">
        No active credit notes found on the ledger. Open refunds or returns are reconciled directly with general invoice references.
      </p>
    </PageShell>
  );
}

export function VendorsPage() {
  return (
    <PageShell title="Wholesaler & Vendor Directory" description="Manage accounts payables, bulk suppliers, and regular suppliers." badge="Payables Integrated">
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-3xs max-w-lg mx-auto text-center space-y-4">
        <Building className="w-8 h-8 text-indigo-500 mx-auto" />
        <h3 className="font-bold text-sm text-slate-800">No Custom Vendor Directory Registered</h3>
        <p className="text-xs text-slate-500 leading-normal">
          Keep track of your materials, leaseholders, and supply lines by adding your first creditor vendor node.
        </p>
        <button className="py-2.5 px-4 bg-purple-600 text-white font-bold rounded-xl text-xs hover:bg-purple-700 transition">
          Add New Vendor
        </button>
      </div>
    </PageShell>
  );
}

export function ExpensesPage() {
  return (
    <PageShell title="Operational Expenses Console" description="Log petty cash payouts, SaaS leases, utilities, and daily operations costs matching VAT rules." badge="Integers Precinct">
      <p className="text-xs text-slate-500 text-center py-10 bg-white border border-slate-100 rounded-2xl">
        All daily operational expenses are automatically integrated with linked corporate debit cards and bank accounts.
      </p>
    </PageShell>
  );
}

export function BillsPage() {
  return (
    <PageShell title="Outstanding Vendor Bills" description="Manage incoming material logistics invoices, suppliers debt, and payment runs with 15-day alerts." badge="Procurement Node">
      <div className="p-4 bg-indigo-50 border border-indigo-150 rounded-2xl text-xs text-indigo-950 font-medium">
        🔔 <strong>Payables Alert:</strong> Next batch of bulk container freight bills matures in 4 days. Double check liquidity reserves before issuing payments made.
      </div>
    </PageShell>
  );
}

export function PaymentsMadePage() {
  return (
    <PageShell title="Outbound Corporate Settlements" description="Log files matching outward bank transfers, bank schedules, and payments to suppliers." badge="Double-Entry Approved">
      <p className="text-xs text-slate-500 text-center py-10 bg-white border border-slate-100 rounded-2xl">
        Audit trail stable. High-value wire transfers to external suppliers are backed by valid proforma invoices.
      </p>
    </PageShell>
  );
}

export function InventoryPage() {
  return (
    <PageShell title="Materials & Inventory Central" description="Real-time stock ledger with FIFO lot mapping and cost of sales valuation." badge="Cost of Sales Ready">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-3xs">
          <h4 className="text-xs font-mono font-extrabold text-slate-400 uppercase">Valuation Ledger (FIFO)</h4>
          <span className="font-mono text-xl font-black text-slate-950 mt-1 block">₦18,245,600.00</span>
          <span className="text-[10px] text-indigo-600 font-bold block mt-0.5">Asset Accrual Code #1200</span>
        </div>
        <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-3xs">
          <h4 className="text-xs font-mono font-extrabold text-slate-400 uppercase">Active Stock SKU Lots</h4>
          <span className="font-sans text-xl font-black text-slate-950 mt-1 block">1,820 Units</span>
          <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">Healthy stock capacity levels</span>
        </div>
      </div>
    </PageShell>
  );
}

export function EmployeesPage() {
  return (
    <PageShell title="Human Resources & Employee Directory" description="Track employees, tax IDs, salaries, pension setups, and active hours." badge="HR Precision">
      <p className="text-xs text-slate-500 text-center py-10 bg-white border border-slate-100 rounded-2xl">
        Employee personnel data is stored locally. Salary figures are linked to automatic monthly payruns.
      </p>
    </PageShell>
  );
}

export function PayrollRunsPage() {
  return (
    <PageShell title="Secure Payroll Run Central" description="Manage payroll cycles, NHF tax, pension fund assignments, and direct deposits." badge="CBN Bank Standards">
      <p className="text-xs text-slate-500 text-center py-10 bg-white border border-slate-100 rounded-2xl">
        The current active payroll run is configured to disperse on the 26th. Integrated tax structures are calculated dynamically.
      </p>
    </PageShell>
  );
}

export function export { ChartOfAccountsPage } from './accountant/ChartOfAccounts';() {
  return (
    <PageShell title="General Ledger Chart of Accounts" description="Fully customizable double-entry registry for tracking cash, assets, equities, and liabilities." badge="Continuous Ledger">
      <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-3xs">
        <table className="w-full text-left text-xs text-slate-600 border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-black uppercase">
              <th className="pb-3">Account Code</th>
              <th className="pb-3">Legal Name</th>
              <th className="pb-3">Accrual Class</th>
              <th className="pb-3 text-right">Total Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 font-mono">
            <tr>
              <td className="py-2.5 font-bold">#1000</td>
              <td className="py-2.5 font-sans font-semibold text-slate-800">CBN Bank Clearing Account</td>
              <td className="py-2.5 uppercase text-indigo-600 font-bold">Asset (Cash)</td>
              <td className="py-2.5 text-right font-bold text-slate-900">₦24,582,100.50</td>
            </tr>
            <tr>
              <td className="py-2.5 font-bold">#1200</td>
              <td className="py-2.5 font-sans font-semibold text-slate-800">Finished Stock Inventory</td>
              <td className="py-2.5 uppercase text-indigo-600 font-bold">Asset (Stock)</td>
              <td className="py-2.5 text-right font-bold text-slate-900">₦18,245,600.00</td>
            </tr>
            <tr>
              <td className="py-2.5 font-bold">#2000</td>
              <td className="py-2.5 font-sans font-semibold text-slate-800">VAT (Output 7.5% Accrual)</td>
              <td className="py-2.5 uppercase text-red-500 font-bold">Liability</td>
              <td className="py-2.5 text-right font-bold text-slate-900">₦1,120,400.00</td>
            </tr>
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

export function JournalsPage() {
  return (
    <PageShell title="Manual General Ledger Journals" description="Direct capital adjustments, reserve transfers, and depreciation entries." badge="Master Accountant Privileges">
      <p className="text-xs text-slate-500 text-center py-10 bg-white border border-slate-100 rounded-2xl">
        All adjustment journal entries must balance (Debits === Credits) before they can be saved.
      </p>
    </PageShell>
  );
}

export function BudgetsPage() {
  return (
    <PageShell title="Fiscal Budgets & Directives" description="Allocate structural funding caps for logistics, SaaS, and payroll. Generate alerts for variances." badge="Treasury Approved">
      <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-3xs max-w-sm">
        <h4 className="text-xs font-bold text-slate-700">Monthly Expense Cap Variance</h4>
        <div className="h-2 bg-slate-100 rounded-full mt-3 overflow-hidden">
          <div className="h-full bg-purple-600 rounded-full" style={{ width: '68%' }}></div>
        </div>
        <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 font-bold mt-2">
          <span>68% ALLOCATED</span>
          <span>₦12,450,000 / ₦18,000,000 Max</span>
        </div>
      </div>
    </PageShell>
  );
}

export function FixedAssetsPage() {
  return (
    <PageShell title="Corporate Fixed Assets Registry" description="Track physical plant, heavy freight trucks, warehouse space, and depreciation rate schedules." badge="IFRS Compliant">
      <p className="text-xs text-slate-500 text-center py-10 bg-white border border-slate-105 rounded-2xl">
        Physical tooling, systems, properties and machinery lists are integrated with annual depreciation journal cycles.
      </p>
    </PageShell>
  );
}

// =========================================================================
// 4. REPORTS COCKPIT (DYNAMIC CHARTS & SUMMARY METRICS)
// =========================================================================

export function TrialBalancePage() {
  const trialData = [
    { code: '#1000', name: 'CBN Cash Assets', debit: 24582100, credit: 0 },
    { code: '#1200', name: 'Finished Inventory', debit: 18245600, credit: 0 },
    { code: '#2000', name: 'Sales VAT Liability', debit: 0, credit: 1120400 },
    { code: '#3000', name: 'Retained Liquidity', debit: 0, credit: 41707300 }
  ];

  return (
    <PageShell title="Trial Balance Sheet Ledger" description="Continuous reconciliation matching Debits and Credits." badge="Balanced Ledger verified">
      <div className="bg-white border border-slate-150 rounded-2xl overflow-hidden shadow-2xs">
        <table className="w-full text-left font-mono text-xs text-slate-700 border-collapse">
          <thead className="bg-slate-50 text-[10px] font-black tracking-widest text-slate-400 uppercase border-b border-slate-100">
            <tr>
              <th className="p-4">Account Code</th>
              <th className="p-4">Legal Account Title</th>
              <th className="p-4 text-right">Debit Assets (₦)</th>
              <th className="p-4 text-right">Credit Liabilities (₦)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {trialData.map(d => (
              <tr key={d.code} className="hover:bg-slate-50/50">
                <td className="p-4 font-bold text-slate-950">{d.code}</td>
                <td className="p-4 font-sans text-slate-800 font-semibold">{d.name}</td>
                <td className="p-4 text-right text-emerald-600 font-bold">{d.debit > 0 ? (d.debit/100).toLocaleString() : '-'}</td>
                <td className="p-4 text-right text-indigo-600 font-bold">{d.credit > 0 ? (d.credit/100).toLocaleString() : '-'}</td>
              </tr>
            ))}
            <tr className="bg-slate-50/70 border-t-2 border-slate-200 font-black text-xs">
              <td className="p-4">TOTAL</td>
              <td className="p-4 font-sans uppercase">Balanced Capital Log</td>
              <td className="p-4 text-right text-emerald-700">42,827,700.00</td>
              <td className="p-4 text-right text-indigo-700">42,827,700.00</td>
            </tr>
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

const mockActivityData = [
  { name: 'Jan', Sales: 4000, Expenses: 2400 },
  { name: 'Feb', Sales: 3000, Expenses: 1398 },
  { name: 'Mar', Sales: 9800, Expenses: 5000 },
  { name: 'Apr', Sales: 6780, Expenses: 3908 },
  { name: 'May', Sales: 1890, Expenses: 4800 },
  { name: 'Jun', Sales: 2390, Expenses: 3800 }
];

export function IncomeStatementPage() {
  return (
    <PageShell title="Corporate Profit & Loss Statement" description="Historical display tracking raw revenues, material costs and net indices monthly." badge="Net Profit Analyzed">
      <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-3xs space-y-4">
        <h4 className="text-xs font-mono font-extrabold text-slate-400 uppercase">Operational Margins (Naira KNG)</h4>
        <div className="h-60 w-full font-mono">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mockActivityData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="name" fontSize={11} stroke="#94A3B8" />
              <YAxis fontSize={11} stroke="#94A3B8" />
              <Tooltip />
              <Bar dataKey="Sales" fill="#7C3AED" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </PageShell>
  );
}

export function BalanceSheetPage() {
  return (
    <PageShell title="Statement of Capital Position (Balance Sheet)" description="Consolidated summaries of active reserves, accounts inventories, and long-term liabilities." badge="IFRS Compliant">
      <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-3xs space-y-3 max-w-md">
        <h3 className="font-bold text-slate-800 text-sm border-b border-slate-50 pb-2">Primary Capital Equation</h3>
        <div className="space-y-2.5 text-xs">
          <div className="flex justify-between items-center text-slate-600">
            <span>Corporate Assets Value (A):</span>
            <span className="font-mono font-bold text-slate-900">₦42,827,700.00</span>
          </div>
          <div className="flex justify-between items-center text-slate-600">
            <span>Accounts Outstanding Liabilities (L):</span>
            <span className="font-mono font-bold text-rose-600">₦1,120,400.00</span>
          </div>
          <div className="flex justify-between items-center pt-2.5 border-t border-slate-50 text-slate-950 font-extrabold text-sm">
            <span>Net Shareholder Equities (A - L):</span>
            <span className="font-mono text-emerald-600">₦41,707,300.00</span>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

export function CashFlowPage() {
  return (
    <PageShell title="Cash Flow Statements" description="Track inward receivables liquidity against outward operational adjustments." badge="Verified Cash Logs">
      <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-3xs space-y-4">
        <h4 className="text-xs font-mono font-extrabold text-slate-400 uppercase">Cash Position Run (H1 2026)</h4>
        <div className="h-60 w-full font-mono">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockActivityData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="name" fontSize={11} stroke="#94A3B8" />
              <YAxis fontSize={11} stroke="#94A3B8" />
              <Tooltip />
              <Line type="monotone" dataKey="Sales" stroke="#10B981" strokeWidth={2.5} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </PageShell>
  );
}

export function AgedReceivablesPage() {
  return (
    <PageShell title="Aged Client Receivables Tracker" description="Verify client payments due over 30, 60 or 90 days. Keep accounts receivables balanced." badge="Credit Control Active">
      <p className="text-xs text-slate-500 text-center py-10 bg-white border border-slate-100 rounded-2xl font-mono uppercase tracking-widest font-black">
        Outstanding Receivables: ₦0.00. No clients are in default.
      </p>
    </PageShell>
  );
}

export function AgedPayablesPage() {
  return (
    <PageShell title="Aged Payables Ledger" description="Supplier invoice payment tracking cycles categorized by maturity milestones." badge="Cash Reserves Balanced">
      <p className="text-xs text-slate-500 text-center py-10 bg-white border border-slate-100 rounded-2xl font-mono uppercase tracking-widest font-black">
        Outstanding Payables: ₦0.00. Supply lines are healthy.
      </p>
    </PageShell>
  );
}

// =========================================================================
// 5. SETTINGS OVERVIEW (ORGANISATION SETUP)
// =========================================================================

export function OrganisationSettingsPage() {
  const { organisation } = useAuth();
  return (
    <PageShell title="Organisation Profile Settings" description="Modify tax IDs, legal address indexes, fiscal periods, and enterprise information." badge="Security Sealed">
      <div className="bg-white border border-slate-150 rounded-2xl p-6 shadow-3xs max-w-xl space-y-4">
        <h3 className="text-xs font-extrabold text-slate-850 uppercase tracking-widest font-mono border-b border-slate-50 pb-2.5">Corporate Meta Registry</h3>
        <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Legal Business Name</span>
            <span className="font-bold text-slate-800 mt-0.5 block">{organisation?.name || 'FinanceOS Client'}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Authorized Email</span>
            <span className="font-mono text-slate-600 mt-0.5 block">{organisation?.email || 'admin@financeos.ng'}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Nigerian Tax TIN Code</span>
            <span className="font-mono text-slate-600 mt-0.5 block">TIN-482093551-A</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">VAT Accrual Code</span>
            <span className="font-mono text-slate-600 mt-0.5 block">VAT-NG-7.5%</span>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

export function UsersSettingsPage() {
  const { user } = useAuth();
  return (
    <PageShell title="Corporate User Roles & Rights" description="Administer controller access levels, auditor keys, and workflow authentications." badge="Governance Sealed">
      <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-2xs">
        <div className="flex items-center space-x-3 bg-slate-50 p-3 rounded-xl border border-slate-205">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 font-extrabold flex items-center justify-center text-xs shadow-2xs uppercase">
            {user?.fullName?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0 select-none">
            <h4 className="text-xs font-bold text-slate-800 truncate">{user?.fullName || 'Active Controller'}</h4>
            <p className="text-[10px] text-slate-400 font-bold truncate mt-0.5 bg-purple-50 text-purple-700 border border-purple-100 rounded-full px-2 py-0.5 inline-block capitalize">{user?.role || 'Owner'}</p>
          </div>
          <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 font-black text-[9px] rounded-full uppercase tracking-widest font-mono">OWNER NODE</span>
        </div>
      </div>
    </PageShell>
  );
}

// =========================================================================
// 6. MISSING ROUTED CHANNELS & PLACEHOLDERS (COMPREHENSIVE BACKUPS)
// =========================================================================

export function SalesOrdersPage() {
  const orders = [
    { id: 'SO-2026-001', customer: 'Dangote Conglomerates', date: '2026-06-14', amount: '₦125,400,000.00', status: 'Pending Delivery' },
    { id: 'SO-2026-002', customer: 'Borno Agro Mills', date: '2026-06-12', amount: '₦8,950,000.00', status: 'Shipped' },
    { id: 'SO-2026-003', customer: 'Maitama Tech Hub', date: '2026-06-10', amount: '₦4,200,000.00', status: 'Invoiced' }
  ];
  return (
    <PageShell title="Sales Orders Registry" description="Track client requests, verified supply schedules, and automated fulfillment workflows." badge="Sales Pipeline">
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-3xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <th className="p-4">Order Reference</th>
              <th className="p-4">Customer Name</th>
              <th className="p-4">Order Date</th>
              <th className="p-4">Structured Volume</th>
              <th className="p-4 text-center">Fulfillment Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-xs text-slate-700">
            {orders.map(o => (
              <tr key={o.id} className="hover:bg-slate-50/40">
                <td className="p-4 font-mono font-bold text-indigo-650">{o.id}</td>
                <td className="p-4 font-bold text-slate-800">{o.customer}</td>
                <td className="p-4 text-slate-500">{o.date}</td>
                <td className="p-4 font-mono font-bold text-slate-900">{o.amount}</td>
                <td className="p-4 text-center">
                  <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full border ${
                    o.status === 'Shipped' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                    o.status === 'Invoiced' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                  }`}>{o.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

export function ReceiptsPage() {
  const receipts = [
    { id: 'REC-90145', client: 'Jumia Nigeria HQ', date: '2026-06-15', sum: '₦2,900,000.00', bank: 'Access Bank PLC' },
    { id: 'REC-90144', client: 'Mainasara Logistics', date: '2025-06-11', sum: '₦15,450,000.00', bank: 'Standard Chartered' }
  ];
  return (
    <PageShell title="Receipts & Payments Settled" description="Auditable records representing dynamic liquid inflows, customer deposits and settlements." badge="Settlements Logs">
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-3xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <th className="p-4">Receipt Token</th>
              <th className="p-4">Liquidator / Client</th>
              <th className="p-4">Settlement Date</th>
              <th className="p-4">Inward Clearings</th>
              <th className="p-4">Clearing Institutional Node</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-xs text-slate-700">
            {receipts.map(r => (
              <tr key={r.id}>
                <td className="p-4 font-mono font-bold text-slate-500">{r.id}</td>
                <td className="p-4 font-bold text-slate-800">{r.client}</td>
                <td className="p-4 text-slate-400">{r.date}</td>
                <td className="p-4 font-mono font-extrabold text-emerald-600">{r.sum}</td>
                <td className="p-4 font-medium text-slate-600">{r.bank}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

export function RecurringInvoicesPage() {
  return (
    <PageShell title="Recurring Billing Rules" description="Manage subscription tiers, automatic monthly clients billing agreements, and retainer sequences." badge="Auto pilot Active">
      <div className="p-10 bg-white border border-slate-100 rounded-2xl text-center space-y-3 shadow-3xs">
        <History className="w-8 h-8 text-indigo-400 mx-auto animate-spin duration-1000" />
        <h4 className="text-sm font-bold text-slate-800">No active automated billing retainers found</h4>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">Instantiate monthly client subscriptions to generate automated SEC and IFRS compliant invoices automatically.</p>
        <button className="py-2 px-4 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-slate-900 transition">Create Billing Template</button>
      </div>
    </PageShell>
  );
}

export function RecurringExpensesPage() {
  return (
    <PageShell title="Recurring Payables & Costs" description="Schedules governing auto-approved vendor obligations, office rent, services, and software retainers." badge="Payables Management">
      <div className="p-10 bg-white border border-slate-100 rounded-2xl text-center space-y-3 shadow-3xs">
        <DollarSign className="w-8 h-8 text-neutral-400 mx-auto" />
        <h4 className="text-sm font-bold text-slate-800">Recurring supplier accounts clear</h4>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">Establish schedules for automated utilities, standard subscriptions or monthly payroll ledger contributions.</p>
      </div>
    </PageShell>
  );
}

export function PurchaseOrdersPage() {
  return (
    <PageShell title="Purchase Orders Control" description="Approve, track, and dispatch formal acquisition bills and procurement requests to vendors." badge="Procurement Control">
      <div className="bg-white border border-slate-100 rounded-2xl p-6 text-center shadow-3xs">
        <p className="text-xs text-slate-400 font-mono py-8 uppercase tracking-wider">Procurement logs cleared. Total Committed: ₦0.00</p>
      </div>
    </PageShell>
  );
}

export function PayeSchedulesPage() {
  return (
    <PageShell title="PAYE Tax Schedules" description="Verify monthly Pay-As-You-Earn schedules mapped directly to legal LIRS, FIRS and sub-national channels." badge="Tax Compliance">
      <div className="bg-white border border-slate-150 rounded-2xl p-6 shadow-3xs space-y-4">
        <div className="flex justify-between items-center border-b border-slate-50 pb-3">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">Accrued Local PAYE Liability</span>
          <span className="font-mono text-sm font-bold text-indigo-600">₦0.00</span>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed font-sans">
          Your PAYE logs calculate with graduated local Nigerian tax tables automatically based on gross worker packages, local pension deductions, and standard statutory reliefs.
        </p>
      </div>
    </PageShell>
  );
}

export function PensionSchedulesPage() {
  return (
    <PageShell title="Pension Premium Tracker" description="Verify contributions compiled under PenCom regulations mapping 8% worker and 10% employer pools." badge="Pensions Secured">
      <div className="bg-white border border-slate-150 p-6 rounded-2xl shadow-2xs">
        <p className="text-xs text-slate-500 text-center py-8 font-mono tracking-wide uppercase">PenCom Audit Clearance status: 100% compliant. Next filing: July 10, 2026.</p>
      </div>
    </PageShell>
  );
}

export function PayslipsPage() {
  return (
    <PageShell title="Corporate Employees Payslips" description="Verify and review printable digital worker pay Slips reflecting tax schedules and wage allocations." badge="Payslips Hub">
      <div className="p-12 bg-white border border-slate-100 rounded-2xl text-center space-y-3 shadow-3xs">
        <FileText className="w-8 h-8 text-indigo-400 mx-auto" />
        <h4 className="text-xs font-mono font-bold text-slate-800 uppercase">Interactive Pay Nodes Ready</h4>
        <p className="text-xs text-slate-400 max-w-md mx-auto">All staff payroll computations generate a cryptographic PDF worker slip which they can download securely.</p>
      </div>
    </PageShell>
  );
}

export function CurrencyRatesPage() {
  return (
    <PageShell title="FX & Parallel Exchange Matrices" description="Verify central CBN official structures against modern parallel FX index pools." badge="Multicurrency Live">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-150 p-5 rounded-2xl space-y-3 shadow-3xs">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest font-mono">Parallel Exchange</span>
          <div className="flex justify-between items-center pt-2">
            <span className="text-xs font-bold text-slate-700">USD - United States Dollar</span>
            <span className="font-mono text-xs font-extrabold text-slate-950">₦1,480.00</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-700">GBP - British Sterling Pound</span>
            <span className="font-mono text-xs font-extrabold text-slate-950">₦1,895.00</span>
          </div>
        </div>
        <div className="bg-white border border-slate-150 p-5 rounded-2xl space-y-3 shadow-3xs">
          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest font-mono">Official CBN Index</span>
          <div className="flex justify-between items-center pt-2">
            <span className="text-xs font-bold text-slate-700">USD - Official Nigerian CBN</span>
            <span className="font-mono text-xs font-extrabold text-slate-950">₦1,420.50</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-700">GBP - Official Nigerian CBN</span>
            <span className="font-mono text-xs font-extrabold text-slate-950">₦1,811.20</span>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

export function AuditLogsPage() {
  const logs = [
    { date: '2026-06-16 09:12:35', user: 'controller@company.ng', event: 'Bank Reconciled', desc: 'Matched transaction ref FL-902 with ledger account 1102' },
    { date: '2026-06-15 17:45:11', user: 'controller@company.ng', event: 'Journal Posted', desc: 'Manuel ledger adjustment with value ₦430,500.00' },
    { date: '2026-06-15 08:30:00', user: 'system-auth', event: 'API Integration Sync', desc: 'Periodic bank balance sync retrieved from Flutterwave infrastructure' }
  ];
  return (
    <PageShell title="Enterprise Digital Audit Trail" description="Persistent tamper-proof security log tracking all accounting operations under statutory compliance." badge="Audit Safe">
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-3xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <th className="p-4">Timestamp (UTC)</th>
              <th className="p-4">Actor</th>
              <th className="p-4">Event Operation</th>
              <th className="p-4">Structured Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-xs text-slate-700 font-mono">
            {logs.map((l, idx) => (
              <tr key={idx} className="hover:bg-slate-50/40">
                <td className="p-4 text-slate-400">{l.date}</td>
                <td className="p-4 font-bold text-slate-600">{l.user}</td>
                <td className="p-4 font-semibold text-indigo-650">{l.event}</td>
                <td className="p-4 text-slate-500 font-sans">{l.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

export function CustomReportsPage() {
  return (
    <PageShell title="Custom Reports & Analytics Builder" description="Design, compile and filter specific corporate bookkeeping parameters dynamically." badge="Ad-hoc Analytics">
      <div className="bg-white border border-slate-150 p-6 rounded-2xl shadow-3xs space-y-4">
        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest font-mono">Generate Specific Audit Parameters</h4>
        <div className="flex flex-wrap gap-3">
          <button className="py-2.5 px-4 bg-slate-100 font-bold rounded-xl text-xs hover:bg-indigo-50 hover:text-indigo-700 transition">Cash Flows (MoM)</button>
          <button className="py-2.5 px-4 bg-slate-100 font-bold rounded-xl text-xs hover:bg-indigo-50 hover:text-indigo-700 transition">Tax Liability Forecast</button>
          <button className="py-2.5 px-4 bg-slate-100 font-bold rounded-xl text-xs hover:bg-indigo-50 hover:text-indigo-700 transition">Equity Movement Audit</button>
        </div>
      </div>
    </PageShell>
  );
}

export function InvitesSettingsPage() {
  return (
    <PageShell title="Invites & Members" description="Invite team members, external auditors, or accountants to access your books." badge="Access Control">
      <div className="p-10 bg-white border border-slate-100 rounded-2xl text-center space-y-3 shadow-3xs">
        <Users className="w-8 h-8 text-indigo-400 mx-auto" />
        <h4 className="text-sm font-bold text-slate-800">Add Team Members</h4>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">Invite other managers or professional Nigerian auditors to verify journal balance sheets in real-time.</p>
        <button className="py-2 px-4 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-slate-900 transition">Invite New Member</button>
      </div>
    </PageShell>
  );
}

export function IntegrationsSettingsPage() {
  return (
    <PageShell title="External Integrations Hub" description="Link secure payment processors, automated banks, and global analytical connectors." badge="Integrity Active">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-150 p-5 rounded-2xl space-y-3 shadow-3xs flex items-center justify-between">
          <div>
            <h4 className="font-bold text-slate-850 text-xs uppercase font-mono">Flutterwave Corp Feed</h4>
            <p className="text-[10px] text-slate-400 font-sans mt-0.5">Dual-mode local clearings client and live bank feeds</p>
          </div>
          <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 font-extrabold text-[9px] rounded-full uppercase">Connected</span>
        </div>
        <div className="bg-white border border-slate-150 p-5 rounded-2xl space-y-3 shadow-3xs flex items-center justify-between">
          <div>
            <h4 className="font-bold text-slate-850 text-xs uppercase font-mono">Paystack API Node</h4>
            <p className="text-[10px] text-slate-400 font-sans mt-0.5">Automated settlement matching and payout logs sync</p>
          </div>
          <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 font-extrabold text-[9px] rounded-full uppercase">Connected</span>
        </div>
      </div>
    </PageShell>
  );
}
