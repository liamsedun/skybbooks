import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Play, Calendar, BarChart3, TrendingUp, Receipt, Landmark, Bot, Check, Sparkles } from 'lucide-react';

const stats = [
  { value: '10,000+', label: 'Active Businesses' },
  { value: '₦50B+', label: 'Transactions Processed' },
  { value: '99.9%', label: 'Platform Uptime' },
  { value: '4.8/5', label: 'User Rating' },
];

export function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="relative pt-36 lg:pt-40 pb-20 lg:pb-28 overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-50/60 via-white to-white pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-[#0EA5E9]/5 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-20 right-0 w-1/3 h-1/2 bg-gradient-to-l from-sky-100/40 to-transparent pointer-events-none" />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' viewBox=\'0 0 40 40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23082F49\' fill-opacity=\'1\'%3E%3Cpath d=\'M0 0h40v40H0z\' fill=\'none\'/%3E%3Cpath d=\'M40 0v1H0V0z\'/%3E%3C/g%3E%3C/svg%3E")', backgroundRepeat: 'repeat' }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ─── Headline Section ─── */}
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200/60 text-sm font-medium text-sky-700 mb-6 shadow-sm">
            <Sparkles size={14} className="text-[#0EA5E9]" />
            Trusted by 10,000+ Nigerian SMEs
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-[#082F49] leading-[1.1] tracking-tight">
            Accounting Made{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0EA5E9] to-[#0284C7]">
              Simple
            </span>{' '}
            for{' '}
            <span className="relative">
              Nigerian Businesses
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
                <path d="M2 10C75 2 175 0 298 10" stroke="url(#hero-underline)" strokeWidth="3" strokeLinecap="round"/>
                <defs><linearGradient id="hero-underline" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#0EA5E9"/><stop offset="100%" stopColor="#0284C7"/></linearGradient></defs>
              </svg>
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Manage invoices, banking, inventory, payroll, taxes and financial reporting — 
            from one intelligent cloud platform.
          </p>

          {/* ─── Buttons ─── */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate('/register')}
              className="group w-full sm:w-auto px-8 py-3.5 bg-[#082F49] hover:bg-[#0C4A6E] text-white font-semibold rounded-xl transition-all shadow-lg shadow-[#082F49]/20 hover:shadow-xl hover:shadow-[#082F49]/30 flex items-center justify-center gap-2 text-sm"
              aria-label="Start free trial"
            >
              Start Free
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </button>
            <button
              onClick={() => navigate('/contact')}
              className="w-full sm:w-auto px-8 py-3.5 border border-slate-200 hover:border-[#0EA5E9]/40 text-slate-700 font-medium rounded-xl transition-all flex items-center justify-center gap-2 text-sm hover:bg-sky-50 hover:text-[#082F49]"
              aria-label="Book a demo"
            >
              <Calendar size={16} aria-hidden="true" /> Book a Demo
            </button>
            <button
              onClick={() => navigate('/register')}
              className="w-full sm:w-auto px-8 py-3.5 border border-slate-200 hover:border-slate-300 text-slate-600 font-medium rounded-xl transition-all flex items-center justify-center gap-2 text-sm hover:bg-slate-50"
              aria-label="Watch video overview"
            >
              <Play size={16} aria-hidden="true" /> Watch Video
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5 mt-6 text-sm text-slate-500">
            {['No credit card required', 'Free 14-day trial', 'Cancel anytime'].map(text => (
              <span key={text} className="flex items-center gap-1.5">
                <Check size={14} className="text-emerald-500" /> {text}
              </span>
            ))}
          </div>
        </div>

        {/* ─── Laptop Mockup + Floating Cards ─── */}
        <div className="mt-20 relative">
          {/* Laptop base */}
          <div className="relative mx-auto max-w-5xl">
            {/* Screen bezel */}
            <div className="relative bg-[#1a1a2e] rounded-t-xl rounded-b-sm shadow-2xl border border-slate-700/50 overflow-hidden">
              {/* Camera dot */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-[#1a1a2e] rounded-b-lg z-10">
                <div className="mx-auto w-2 h-2 rounded-full bg-slate-600 mt-0.5" />
              </div>
              {/* Screen content */}
              <div className="mt-2 mx-2 mb-2 rounded-lg overflow-hidden bg-white">
                <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border-b border-slate-100">
                  <div className="flex gap-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  </div>
                  <div className="flex-1 text-center text-[10px] text-slate-400 font-medium">SkyBooks Dashboard</div>
                </div>
                <div className="p-4 sm:p-6">
                  {/* Dashboard grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
                    {[
                      { label: 'Total Revenue', value: '₦12,450,000', change: '+12.5%', color: 'emerald' },
                      { label: 'Invoices Sent', value: '₦8,230,000', change: '+8.2%', color: 'emerald' },
                      { label: 'Expenses', value: '₦3,120,000', change: '-2.1%', color: 'rose' },
                      { label: 'Net Profit', value: '₦9,330,000', change: '+15.3%', color: 'emerald' },
                    ].map(card => (
                      <div key={card.label} className="bg-white rounded-lg border border-slate-100 p-2.5 sm:p-3 shadow-sm">
                        <div className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">{card.label}</div>
                        <div className="text-xs sm:text-sm font-bold text-[#082F49] mt-0.5">{card.value}</div>
                        <div className={`text-[9px] font-medium text-${card.color}-600`}>{card.change}</div>
                      </div>
                    ))}
                  </div>
                  {/* Chart row */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-white rounded-lg border border-slate-100 p-3 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-semibold text-slate-600">Revenue Trend</span>
                        <BarChart3 size={12} className="text-[#0EA5E9]" />
                      </div>
                      <div className="flex items-end gap-1 h-14">
                        {[40, 55, 45, 70, 60, 85, 75, 90, 80, 95, 88, 100].map((h, i) => (
                          <div key={i} className="flex-1 rounded-t-sm bg-gradient-to-t from-[#0EA5E9] to-[#38BDF8]" style={{ height: `${h}%` }} />
                        ))}
                      </div>
                    </div>
                    <div className="bg-white rounded-lg border border-slate-100 p-3 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-semibold text-slate-600">Cash Flow</span>
                        <TrendingUp size={12} className="text-emerald-500" />
                      </div>
                      <div className="relative h-14">
                        <svg viewBox="0 0 180 56" className="w-full h-full">
                          <path d="M0 48 Q15 42 30 44 T60 35 T90 38 T120 25 T150 15 T180 18" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round"/>
                          <path d="M0 48 Q15 42 30 44 T60 35 T90 38 T120 25 T150 15 T180 18 V56 H0 Z" fill="url(#cashflow-grad)" opacity="0.2"/>
                          <defs><linearGradient id="cashflow-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10B981"/><stop offset="100%" stopColor="#10B981" stopOpacity="0"/></linearGradient></defs>
                        </svg>
                      </div>
                    </div>
                  </div>
                  {/* Transactions */}
                  <div className="bg-white rounded-lg border border-slate-100 p-3 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] font-semibold text-slate-600">Recent Transactions</span>
                      <span className="text-[8px] text-[#0EA5E9] font-medium">View All</span>
                    </div>
                    {[
                      { name: 'Payment from TechHub Ltd', amount: '+₦850,000', time: '2 min ago', type: 'credit' },
                      { name: 'Office rent - Lekki Phase 1', amount: '-₦1,200,000', time: '1 hour ago', type: 'debit' },
                      { name: 'Supplier payment - Prime Goods', amount: '-₦450,000', time: '3 hours ago', type: 'debit' },
                      { name: 'Invoice #INV-2026-0042', amount: '+₦2,300,000', time: 'Yesterday', type: 'credit' },
                    ].map((tx, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                        <div className="flex items-center gap-2">
                          <div className={`w-5 h-5 rounded-full ${tx.type === 'credit' ? 'bg-emerald-50' : 'bg-rose-50'} flex items-center justify-center`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${tx.type === 'credit' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          </div>
                          <div>
                            <div className="text-[10px] font-medium text-slate-700">{tx.name}</div>
                            <div className="text-[8px] text-slate-400">{tx.time}</div>
                          </div>
                        </div>
                        <div className={`text-[10px] font-semibold ${tx.type === 'credit' ? 'text-emerald-600' : 'text-slate-600'}`}>{tx.amount}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* Laptop base/stand */}
            <div className="mx-auto w-[40%] h-2 bg-[#2a2a3e] rounded-b-lg" />
            <div className="mx-auto w-[30%] h-4 bg-[#1a1a2e] rounded-b-lg" />

            {/* ─── Floating Cards ─── */}

            {/* Revenue Chart Card */}
            <div className="hidden lg:block absolute -left-12 top-12 w-52 bg-white rounded-xl border border-slate-200 shadow-xl p-4 animate-float" style={{ animationDelay: '0s' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-[#082F49]">Revenue</span>
                <BarChart3 size={14} className="text-[#0EA5E9]" />
              </div>
              <div className="text-lg font-bold text-[#082F49]">₦12.4M</div>
              <div className="flex items-center gap-1.5 mb-3">
                <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">+12.5%</span>
                <span className="text-[10px] text-slate-400">vs last month</span>
              </div>
              <div className="flex items-end gap-1 h-10">
                {[60, 45, 75, 55, 85, 65, 95].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t-sm bg-gradient-to-t from-[#0EA5E9] to-[#38BDF8]" style={{ height: `${h}%`, opacity: 0.3 + (i / 7) * 0.7 }} />
                ))}
              </div>
            </div>

            {/* Cashflow Chart Card */}
            <div className="hidden lg:block absolute -right-10 top-20 w-52 bg-white rounded-xl border border-slate-200 shadow-xl p-4 animate-float" style={{ animationDelay: '1.5s' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-[#082F49]">Cash Flow</span>
                <TrendingUp size={14} className="text-emerald-500" />
              </div>
              <div className="text-lg font-bold text-[#082F49]">₦8.7M</div>
              <div className="flex items-center gap-1.5 mb-3">
                <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">+8.2%</span>
                <span className="text-[10px] text-slate-400">this quarter</span>
              </div>
              <svg viewBox="0 0 180 40" className="w-full h-10">
                <path d="M0 35 Q20 30 40 32 T80 22 T120 25 T160 12 T180 15" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round"/>
                <path d="M0 35 Q20 30 40 32 T80 22 T120 25 T160 12 T180 15 V40 H0 Z" fill="url(#cf-grad)" opacity="0.15"/>
                <defs><linearGradient id="cf-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10B981"/><stop offset="100%" stopColor="#10B981" stopOpacity="0"/></linearGradient></defs>
              </svg>
            </div>

            {/* Invoice Card */}
            <div className="hidden lg:block absolute -left-8 bottom-32 w-48 bg-white rounded-xl border border-slate-200 shadow-xl p-4 animate-float" style={{ animationDelay: '0.8s' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center">
                  <Receipt size={14} className="text-[#0EA5E9]" />
                </div>
                <span className="text-xs font-semibold text-[#082F49]">Latest Invoice</span>
              </div>
              <div className="text-[10px] text-slate-500">#INV-2026-0042</div>
              <div className="text-sm font-bold text-[#082F49]">₦2,300,000</div>
              <div className="mt-2 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[9px] text-emerald-600 font-medium">Paid</span>
                <span className="text-[9px] text-slate-400 ml-auto">TechHub Ltd</span>
              </div>
              <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full w-3/4 bg-emerald-400 rounded-full" />
              </div>
            </div>

            {/* Bank Reconciliation Widget */}
            <div className="hidden lg:block absolute -right-8 bottom-24 w-52 bg-white rounded-xl border border-slate-200 shadow-xl p-4 animate-float" style={{ animationDelay: '2s' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <Landmark size={14} className="text-indigo-500" />
                </div>
                <span className="text-xs font-semibold text-[#082F49]">Bank Reconciliation</span>
              </div>
              <div className="flex items-center justify-between text-[10px] mb-2">
                <span className="text-slate-500">Matched</span>
                <span className="font-semibold text-emerald-600">47/50</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                <div className="h-full w-[94%] bg-emerald-400 rounded-full" />
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-500">Unmatched</span>
                <span className="font-semibold text-amber-600">3</span>
              </div>
            </div>

            {/* AI Assistant Bubble */}
            <div className="hidden lg:block absolute -right-6 top-1/2 -translate-y-1/2">
              <div className="relative animate-float" style={{ animationDelay: '0.4s' }}>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0EA5E9] to-[#0284C7] shadow-lg shadow-[#0EA5E9]/30 flex items-center justify-center">
                  <Bot size={24} className="text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white" />
                <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-36 bg-white rounded-lg border border-slate-200 shadow-md p-2 text-center">
                  <p className="text-[9px] text-slate-500">Need help? Ask SkyAI</p>
                  <p className="text-[9px] font-medium text-[#0EA5E9]">How can I help?</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Animated Statistics ─── */}
        <div className="mt-20 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#0EA5E9]/5 to-transparent rounded-2xl" />
          <div className="relative grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8 py-8">
            {stats.map((stat, i) => (
              <div key={stat.label} className="text-center group">
                <div className="text-2xl lg:text-3xl font-bold text-[#082F49] group-hover:scale-105 transition-transform">
                  {stat.value.split('').map((char, ci) => (
                    <span
                      key={ci}
                      className="inline-block animate-fade-up"
                      style={{ animationDelay: `${i * 100 + ci * 40}ms`, opacity: 0, animationFillMode: 'forwards' }}
                    >
                      {char}
                    </span>
                  ))}
                </div>
                <div className="text-sm text-slate-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
