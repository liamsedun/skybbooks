import React from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import {
  TrendingUp, TrendingDown, PiggyBank, DollarSign, ArrowUpRight, ArrowDownRight,
  CreditCard, Receipt, BarChart3, Wallet, Building2, Target
} from 'lucide-react';

const summaryCards = [
  { label: 'Total Revenue', value: '₦28,450,000', change: '+12.5%', trend: 'up', icon: TrendingUp, color: 'text-emerald-500' },
  { label: 'Total Expenses', value: '₦16,320,000', change: '+8.3%', trend: 'up', icon: TrendingDown, color: 'text-rose-500' },
  { label: 'Net Profit', value: '₦12,130,000', change: '+18.2%', trend: 'up', icon: PiggyBank, color: 'text-[#0EA5E9]' },
  { label: 'Cash on Hand', value: '₦8,450,000', change: '+5.7%', trend: 'up', icon: DollarSign, color: 'text-violet-500' },
];

const barData = [40, 65, 45, 80, 55, 70, 90, 60, 75, 50, 85, 70];

const DashboardShowcase = React.memo(function DashboardShowcase() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-16 lg:py-24 bg-white relative overflow-hidden section-auto">
      {/* Background accents */}
      <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-[#0EA5E9]/3 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-violet-500/3 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" ref={ref}>
        <div className={`text-center max-w-2xl mx-auto mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <span className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-widest">Dashboard</span>
          <h2 className="mt-3 text-3xl lg:text-4xl font-bold text-[#082F49]">
            See your business at a glance
          </h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            A real-time dashboard that gives you instant visibility into revenue, expenses, profitability, and cash flow — all updated in real time.
          </p>
        </div>

        <div className={`relative transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          {/* Dashboard mockup */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-rose-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
              </div>
              <div className="flex-1 text-center text-xs text-slate-400 font-medium">SkyBooks Dashboard · ABC Enterprises Ltd</div>
            </div>

            <div className="p-4 lg:p-6 space-y-5">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {summaryCards.map((card, i) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.label}
                      className={`bg-white rounded-xl border border-slate-200 p-4 shadow-sm micro-lift transition-all duration-700 ${
                        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                      }`}
                      style={{ transitionDelay: `${400 + i * 80}ms` }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{card.label}</span>
                        <Icon size={16} className={card.color} />
                      </div>
                      <div className="text-lg font-bold text-[#082F49]">{card.value}</div>
                      <div className={`flex items-center gap-1 text-xs font-medium mt-1 ${card.trend === 'up' ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {card.trend === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {card.change}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Charts row */}
              <div className="grid lg:grid-cols-3 gap-4">
                {/* Revenue bar chart */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-semibold text-slate-700">Revenue vs Expenses</span>
                    <span className="text-[10px] text-slate-400">Last 12 months</span>
                  </div>
                  <div className="flex items-end gap-1.5 h-32">
                    {barData.map((h, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group/chart">
                        <div
                          className="w-full rounded-t-sm transition-all duration-500 group-hover/chart:opacity-80"
                          style={{
                            height: `${h}%`,
                            background: i % 2 === 0
                              ? 'linear-gradient(to top, #0EA5E9, #38BDF8)'
                              : 'linear-gradient(to top, #082F49, #1E3A5F)',
                            opacity: isVisible ? 1 : 0.3,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#0EA5E9]" /> Revenue</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#082F49]" /> Expenses</span>
                  </div>
                </div>

                {/* Quick stats */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <span className="text-xs font-semibold text-slate-700">Quick Overview</span>
                  <div className="mt-3 space-y-3">
                    {[
                      { icon: CreditCard, label: 'Pending Invoices', value: '12', sub: '₦4.2M total', color: 'text-[#0EA5E9]', bg: 'bg-sky-50' },
                      { icon: Wallet, label: 'Unpaid Bills', value: '8', sub: '₦2.8M total', color: 'text-rose-500', bg: 'bg-rose-50' },
                      { icon: Target, label: 'Overdue Tasks', value: '3', sub: 'Requires attention', color: 'text-amber-500', bg: 'bg-amber-50' },
                    ].map(item => {
                      const Icon = item.icon;
                      return (
                        <div key={item.label} className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center`}>
                            <Icon size={14} className={item.color} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-500">{item.label}</span>
                              <span className="text-xs font-bold text-[#082F49]">{item.value}</span>
                            </div>
                            <div className="text-[9px] text-slate-400">{item.sub}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Transactions + mobile summary */}
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-700">Recent Transactions</span>
                    <span className="text-[10px] text-[#0EA5E9] font-medium cursor-pointer hover:underline">View All</span>
                  </div>
                  <div className="space-y-1">
                    {[
                      { name: 'Julius Berger Construction', amount: '-₦2,400,000', date: 'Today, 10:32 AM', type: 'out' },
                      { name: 'MTN Nigeria - Bulk Airtime', amount: '-₦850,000', date: 'Today, 09:15 AM', type: 'out' },
                      { name: 'Chipper Technologies Payment', amount: '+₦3,200,000', date: 'Yesterday, 4:20 PM', type: 'in' },
                      { name: 'LIRS - Monthly Filing', amount: '-₦420,000', date: 'Yesterday, 2:05 PM', type: 'out' },
                      { name: 'Interswitch Settlement', amount: '+₦1,875,000', date: 'Jul 17, 11:45 AM', type: 'in' },
                    ].map((tx, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-between py-2 border-b border-slate-100 last:border-0 transition-all duration-700 ${
                          isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
                        }`}
                        style={{ transitionDelay: `${500 + i * 80}ms` }}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tx.type === 'in' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                            {tx.type === 'in'
                              ? <ArrowUpRight size={14} className="text-emerald-500" />
                              : <ArrowDownRight size={14} className="text-rose-500" />
                            }
                          </div>
                          <div>
                            <div className="text-xs font-medium text-slate-700">{tx.name}</div>
                            <div className="text-[10px] text-slate-400">{tx.date}</div>
                          </div>
                        </div>
                        <div className={`text-xs font-semibold ${tx.type === 'in' ? 'text-emerald-600' : 'text-slate-500'}`}>
                          {tx.amount}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bank accounts mini-card */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-700">Connected Accounts</span>
                    <span className="text-[10px] text-[#0EA5E9] font-medium cursor-pointer hover:underline">Manage</span>
                  </div>
                  <div className="space-y-2.5">
                    {[
                      { bank: 'GTBank PLC', type: 'Current Account', number: '0123****0456', balance: '₦4,280,000', color: 'from-red-600 to-red-500' },
                      { bank: 'Access Bank', type: 'Savings', number: '0789****1234', balance: '₦2,150,000', color: 'from-green-600 to-green-500' },
                      { bank: 'UBA PLC', type: 'Domiciliary (USD)', number: '3002****7890', balance: '$45,200', color: 'from-blue-600 to-blue-500' },
                    ].map(acct => (
                      <div key={acct.number} className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${acct.color} flex items-center justify-center text-white text-[9px] font-bold`}>
                          {acct.bank.split(' ')[0].substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-medium text-slate-700">{acct.bank}</span>
                            <span className="text-[10px] font-bold text-[#082F49]">{acct.balance}</span>
                          </div>
                          <div className="text-[9px] text-slate-400">{acct.type} · {acct.number}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">Total Balance</span>
                    <span className="font-bold text-[#082F49]">₦6,430,000 + $45,200</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
export default DashboardShowcase;
