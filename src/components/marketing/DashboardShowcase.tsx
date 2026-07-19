import React from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { TrendingUp, TrendingDown, DollarSign, PiggyBank, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const summaryCards = [
  { label: 'Revenue', value: '₦12,845,000', change: '+12.5%', trend: 'up', icon: TrendingUp, color: 'text-emerald-500' },
  { label: 'Expenses', value: '₦8,320,000', change: '+8.3%', trend: 'up', icon: TrendingDown, color: 'text-rose-500' },
  { label: 'Net Profit', value: '₦4,525,000', change: '+18.2%', trend: 'up', icon: PiggyBank, color: 'text-[#0EA5E9]' },
  { label: 'Cash Flow', value: '₦2,180,000', change: '+5.7%', trend: 'up', icon: DollarSign, color: 'text-violet-500' },
];

const recentTransactions = [
  { name: 'Julius Berger Construction', amount: '-₦2,400,000', date: 'Today, 10:32 AM', type: 'out' },
  { name: 'MTN Nigeria - Bulk Airtime', amount: '-₦850,000', date: 'Today, 09:15 AM', type: 'out' },
  { name: 'Chipper Technologies - Payment', amount: '+₦3,200,000', date: 'Yesterday, 4:20 PM', type: 'in' },
  { name: 'Lagos Internal Revenue Service', amount: '-₦420,000', date: 'Yesterday, 2:05 PM', type: 'out' },
  { name: 'Interswitch - Settlement', amount: '+₦1,875,000', date: 'Jul 17, 11:45 AM', type: 'in' },
];

const barData = [40, 65, 45, 80, 55, 70, 90, 60, 75, 50, 85, 70];

export default function DashboardShowcase() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-16 lg:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" ref={ref}>
        <div className={`text-center max-w-2xl mx-auto mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <span className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-widest">Dashboard</span>
          <h2 className="mt-3 text-3xl lg:text-4xl font-bold text-[#082F49]">
            See your business at a glance
          </h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            A real-time dashboard that gives you instant visibility into revenue, expenses, profitability, and cash flow.
          </p>
        </div>

        <div className={`relative transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-rose-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
              </div>
              <div className="flex-1 text-center text-xs text-slate-400 font-medium">SkyBooks Dashboard · ABC Enterprises Ltd</div>
            </div>

            <div className="p-4 lg:p-6 space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {summaryCards.map((card, i) => {
                  const Icon = card.icon;
                  return (
                    <div key={card.label}
                      className={`bg-white rounded-xl border border-slate-200 p-4 shadow-sm micro-lift transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                      style={{ transitionDelay: `${400 + i * 80}ms` }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{card.label}</span>
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

              <div className="grid lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-semibold text-slate-700">Monthly Revenue vs Expenses</span>
                    <span className="text-[10px] text-slate-400">Last 12 months</span>
                  </div>
                  <div className="flex items-end gap-1.5 h-28">
                    {barData.map((h, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                        <div
                          className="w-full rounded-t-sm transition-all duration-500"
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

                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-700">Recent Transactions</span>
                    <span className="text-[10px] text-[#0EA5E9] font-medium cursor-pointer hover:underline">View All</span>
                  </div>
                  <div className="space-y-1">
                    {recentTransactions.map((tx, i) => (
                      <div key={i}
                        className={`flex items-center justify-between py-2 border-b border-slate-100 last:border-0 transition-all duration-700 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`}
                        style={{ transitionDelay: `${500 + i * 80}ms` }}>
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
