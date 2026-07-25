import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import {
  Building, Mail, Lock, User as UserIcon, Phone, Twitter, Linkedin, Facebook,
  Globe, Eye, EyeOff
} from 'lucide-react';

export function RegisterPage() {
  const { signup } = useAuth();
  const [orgName, setOrgName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | undefined>(undefined);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [showPlans, setShowPlans] = useState(false);

  const { data: plans } = useQuery({
    queryKey: ['public-plans'],
    queryFn: async () => {
      const res = await api.get('/auth/plans');
      return res.data as any[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signup({
        orgName,
        fullName,
        email,
        password,
        planId: selectedPlanId || undefined,
        billingCycle: selectedPlanId ? billingCycle : undefined,
      });
      window.location.href = '/app/dashboard';
    } catch (err: any) {
      setError(err.message || 'Signup failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-start pt-8 px-4 sm:px-6 lg:px-8 selection:bg-indigo-100 font-sans">
      <div className="mx-auto w-full max-w-5xl bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[620px]">
        {/* Left Column */}
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
                <input type="text" required placeholder="e.g. Apex Retail Corp Ltd" value={orgName} onChange={(e) => setOrgName(e.target.value)} className="w-full pl-10 pr-4 py-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-indigo-600 transition bg-slate-50/20 text-slate-800" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Administrator Full Name</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input type="text" required placeholder="e.g. Temitope Adeola" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full pl-10 pr-4 py-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-indigo-600 transition bg-slate-50/20 text-slate-800" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Work Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input type="email" required placeholder="e.g. temitope@apexcorp.ng" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-indigo-600 transition bg-slate-50/20 text-slate-800" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">PASSWORD</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input type={showPassword ? "text" : "password"} required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-10 py-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-indigo-600 transition bg-slate-50/20 text-slate-800" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none flex items-center justify-center p-1" aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Plan Selection */}
            <div>
              <button type="button" onClick={() => setShowPlans(!showPlans)} className="flex items-center gap-2 text-[10px] font-bold text-indigo-600 uppercase tracking-wider hover:text-indigo-700">
                {showPlans ? '−' : '+'} Select a plan {selectedPlanId ? '(1 selected)' : '(Free — skip)'}
              </button>
              {showPlans && (
                <div className="mt-2 space-y-2">
                  {plans?.filter((p: any) => p.isPublic || p.isActive).map((plan: any) => {
                    const isSelected = selectedPlanId === plan.id;
                    const price = billingCycle === 'yearly' ? Number(plan.annualPriceKobo) : Number(plan.monthlyPriceKobo);
                    return (
                      <div key={plan.id} onClick={() => setSelectedPlanId(isSelected ? undefined : plan.id)} className={`p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm font-bold text-slate-900">{plan.name}</span>
                            {plan.popularBadge && <span className="ml-2 text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">POPULAR</span>}
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-slate-900">
                              {price === 0 ? 'Free' : `₦${(price / 100).toLocaleString()}`}
                              {price > 0 && <span className="text-[10px] text-slate-400 font-normal">/{billingCycle === 'yearly' ? 'yr' : 'mo'}</span>}
                            </div>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">{plan.description || ''}</p>
                        {isSelected && price > 0 && (
                          <div className="mt-2 flex gap-2">
                            <button type="button" onClick={(e) => { e.stopPropagation(); setBillingCycle('monthly'); }} className={`px-3 py-1 text-[10px] rounded-lg border ${billingCycle === 'monthly' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200'}`}>Monthly</button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); setBillingCycle('yearly'); }} className={`px-3 py-1 text-[10px] rounded-lg border ${billingCycle === 'yearly' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200'}`}>Annual</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl">⚠️ {error}</div>
            )}

            <button type="submit" disabled={loading} className="w-full py-3 px-4 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-slate-900 focus:outline-none transition shadow-md shadow-indigo-100 flex justify-center items-center cursor-pointer">
              {loading ? 'Creating your account...' : selectedPlanId ? 'Start Free Trial' : 'Create Free Account'}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-100 text-center">
            <Link to="/login" id="back-signin-anchor" className="text-xs font-bold text-indigo-600 hover:text-indigo-700">Already have active accounting books? Sign In</Link>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-center gap-2">
            <a href="tel:+2348157377000" className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-100 flex items-center justify-center duration-150 cursor-pointer" title="Call Phone (+234 815 737 7000)" aria-label="Call +234 815 737 7000"><Phone className="h-3.5 w-3.5" /></a>
            <a href="mailto:hello@skyaccounting.com.ng" className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-100 flex items-center justify-center duration-150 cursor-pointer" title="Email: hello@skyaccounting.com.ng" aria-label="Email: hello@skyaccounting.com.ng"><Mail className="h-3.5 w-3.5" /></a>
            <a href="https://www.skyaccounting.com.ng" target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-100 flex items-center justify-center duration-150 cursor-pointer" title="Website: www.skyaccounting.com.ng" aria-label="Website: www.skyaccounting.com.ng"><Globe className="h-3.5 w-3.5" /></a>
            <div className="h-4 w-[1px] bg-slate-200 mx-1 self-center" />
            <a href="https://facebook.com/skyhouse" target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-100 flex items-center justify-center duration-150 cursor-pointer" title="Facebook" aria-label="Facebook Profile"><Facebook className="h-3.5 w-3.5" /></a>
            <a href="https://twitter.com/skyhouse" target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-100 flex items-center justify-center duration-150 cursor-pointer" title="Twitter/X" aria-label="Twitter Profile"><Twitter className="h-3.5 w-3.5" /></a>
            <a href="https://linkedin.com/company/skyhouse" target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-100 flex items-center justify-center duration-150 cursor-pointer" title="LinkedIn" aria-label="LinkedIn Profile"><Linkedin className="h-3.5 w-3.5" /></a>
          </div>
        </div>
      </div>
    </div>
  );
}
