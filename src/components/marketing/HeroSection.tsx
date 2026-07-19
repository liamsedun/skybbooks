import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Play, Check } from 'lucide-react';

const stats = [
  { value: '10,000+', label: 'Businesses' },
  { value: '₦50B+', label: 'Transactions Processed' },
  { value: '99.9%', label: 'Uptime' },
  { value: '4.8/5', label: 'User Rating' },
];

export function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="relative pt-24 lg:pt-28 pb-16 lg:pb-24 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-sky-50/80 via-white to-white pointer-events-none" />
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-sky-100/40 to-transparent pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-50 border border-sky-200 text-sm font-medium text-sky-700 mb-6">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
            Trusted by 10,000+ Nigerian SMEs
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#082F49] leading-tight tracking-tight">
            Accounting Software{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0EA5E9] to-[#0284C7]">
              Built for Africa
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            SkyBooks is the all-in-one accounting platform for Nigerian SMEs. 
            Send invoices, track expenses, manage payroll, reconcile bank feeds, 
            and generate IFRS-compliant reports — all in one place.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/register')}
              className="w-full sm:w-auto px-8 py-3.5 bg-[#082F49] hover:bg-[#0C4A6E] text-white font-semibold rounded-xl transition-all shadow-lg shadow-[#082F49]/20 hover:shadow-xl hover:shadow-[#082F49]/30 flex items-center justify-center gap-2 text-sm"
            >
              Start Free Trial <ArrowRight size={16} />
            </button>
            <button
              onClick={() => navigate('/register')}
              className="w-full sm:w-auto px-8 py-3.5 border border-slate-200 hover:border-slate-300 text-slate-700 font-medium rounded-xl transition-all flex items-center justify-center gap-2 text-sm hover:bg-slate-50"
            >
              <Play size={16} /> Watch Demo
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-sm text-slate-500">
            {['No credit card required', 'Free 14-day trial', 'Cancel anytime'].map(text => (
              <span key={text} className="flex items-center gap-1.5">
                <Check size={14} className="text-emerald-500" /> {text}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-16 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-[#082F49]/5 to-transparent rounded-2xl" />
          <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-rose-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
              </div>
              <div className="flex-1 text-center text-xs text-slate-400 font-medium">SkyBooks Dashboard</div>
            </div>
            <div className="aspect-[16/9] bg-gradient-to-br from-slate-50 to-white flex items-center justify-center p-8">
              <div className="w-full max-w-2xl">
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {['Total Revenue', 'Invoices', 'Expenses', 'Net Profit'].map(label => (
                    <div key={label} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                      <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{label}</div>
                      <div className="text-sm font-bold text-[#082F49] mt-1">₦0.00</div>
                      <div className="text-[10px] text-emerald-600 font-medium">+0%</div>
                    </div>
                  ))}
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-700">Recent Transactions</span>
                    <span className="text-[10px] text-[#0EA5E9] font-medium">View All</span>
                  </div>
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100" />
                        <div>
                          <div className="text-xs font-medium text-slate-700">Transaction Name</div>
                          <div className="text-[10px] text-slate-400">Today</div>
                        </div>
                      </div>
                      <div className="text-xs font-semibold text-slate-500">-₦0.00</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8">
          {stats.map(stat => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl lg:text-3xl font-bold text-[#082F49]">{stat.value}</div>
              <div className="text-sm text-slate-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
