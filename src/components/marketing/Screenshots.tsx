import React from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import {
  FileText, BarChart3, Landmark, Package, FolderKanban, ReceiptText, Bot,
  ArrowUpRight, ArrowDownRight, Check, TrendingUp, CreditCard, Building2
} from 'lucide-react';

const modules = [
  {
    id: 'invoices',
    label: 'Invoice Preview',
    icon: FileText,
    color: 'from-blue-500 to-cyan-400',
    content: (
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[9px] text-slate-400">INV-2026-0042</div>
            <div className="text-xs font-bold text-[#082F49]">TechHub Solutions Ltd</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-slate-400">Amount Due</div>
            <div className="text-sm font-bold text-[#082F49]">₦2,450,000</div>
          </div>
        </div>
        <div className="border-t border-slate-100 pt-2 space-y-1.5">
          {['Consulting Services', 'Software License', 'Support Package'].map((item, i) => (
            <div key={item} className="flex items-center justify-between text-[10px]">
              <span className="text-slate-600">{item}</span>
              <span className="font-medium text-slate-700">₦{(i + 1) * 815}K</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full w-3/5 bg-emerald-400 rounded-full" />
          </div>
          <span className="text-[9px] text-emerald-600 font-medium">Paid (60%)</span>
        </div>
      </div>
    ),
  },
  {
    id: 'reports',
    label: 'Financial Reports',
    icon: BarChart3,
    color: 'from-violet-500 to-purple-400',
    content: (
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between text-[10px]">
          <span className="font-semibold text-[#082F49]">P&L Summary</span>
          <span className="text-slate-400">Q2 2026</span>
        </div>
        <div className="space-y-1.5">
          {[
            { label: 'Revenue', amount: '₦28.5M', change: '+12%', up: true },
            { label: 'Cost of Sales', amount: '₦12.2M', change: '+8%', up: true },
            { label: 'Gross Profit', amount: '₦16.3M', change: '+15%', up: true },
            { label: 'Net Profit', amount: '₦8.1M', change: '+22%', up: true },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between text-[10px]">
              <span className="text-slate-500">{row.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-700">{row.amount}</span>
                <span className={`flex items-center gap-0.5 ${row.up ? 'text-emerald-600' : 'text-rose-500'}`}>
                  <ArrowUpRight size={8} />{row.change}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-end gap-1 h-12 pt-1">
          {[45, 65, 50, 80, 60, 90, 70, 85].map((h, i) => (
            <div key={i} className="flex-1 rounded-t-sm bg-gradient-to-t from-violet-400 to-purple-300" style={{ height: `${h}%`, opacity: 0.4 + (i / 8) * 0.6 }} />
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'reconciliation',
    label: 'Bank Reconciliation',
    icon: Landmark,
    color: 'from-emerald-500 to-teal-400',
    content: (
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between text-[10px]">
          <span className="font-semibold text-[#082F49]">GTBank · 0123****0456</span>
          <span className="text-[9px] text-slate-400">Updated 2m ago</span>
        </div>
        <div className="bg-sky-50 rounded-lg p-2 text-center">
          <div className="text-[9px] text-slate-500">Book Balance</div>
          <div className="text-sm font-bold text-[#082F49]">₦4,280,000</div>
        </div>
        <div className="space-y-1.5">
          {[
            { desc: 'Payment from Paystack', amount: '+₦850K', matched: true },
            { desc: 'POS Settlement - Interswitch', amount: '+₦320K', matched: true },
            { desc: 'Bank Charges (Jul)', amount: '-₦15K', matched: false },
          ].map((tx, i) => (
            <div key={i} className="flex items-center justify-between text-[9px]">
              <div className="flex items-center gap-1.5">
                {tx.matched ? (
                  <Check size={10} className="text-emerald-500" />
                ) : (
                  <div className="w-2.5 h-2.5 rounded-full border-2 border-amber-400" />
                )}
                <span className="text-slate-600">{tx.desc}</span>
              </div>
              <span className="font-medium text-slate-700">{tx.amount}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-[9px] text-slate-400 pt-1 border-t border-slate-100">
          <span>Matched <strong className="text-emerald-600">47/50</strong></span>
          <span className="text-amber-600 font-medium">3 Unmatched</span>
        </div>
      </div>
    ),
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Package,
    color: 'from-amber-500 to-orange-400',
    content: (
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between text-[10px]">
          <span className="font-semibold text-[#082F49]">Stock Overview</span>
          <span className="text-[9px] text-slate-400">24 items</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { name: 'Cement 50kg', qty: 840, low: false },
            { name: 'Iron Rods 16mm', qty: 320, low: false },
            { name: 'PVC Pipes 4"', qty: 45, low: true },
            { name: 'Granite 3/4"', qty: 1200, low: false },
            { name: 'Sharp Sand', qty: 28, low: true },
            { name: 'Nails 3"', qty: 156, low: false },
          ].map(item => (
            <div key={item.name} className="bg-slate-50 rounded-lg p-1.5">
              <div className="text-[8px] text-slate-500 truncate">{item.name}</div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[10px] font-bold text-[#082F49]">{item.qty}</span>
                {item.low && <span className="text-[7px] text-rose-500 font-medium">Low</span>}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-[9px] text-slate-400 pt-1 border-t border-slate-100">
          <span>Stock Value</span>
          <span className="font-semibold text-[#082F49]">₦18.2M</span>
        </div>
      </div>
    ),
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: FolderKanban,
    color: 'from-rose-500 to-pink-400',
    content: (
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between text-[10px]">
          <span className="font-semibold text-[#082F49]">Active Projects</span>
          <span className="text-[9px] text-slate-400">4 ongoing</span>
        </div>
        <div className="space-y-1.5">
          {[
            { name: 'Lekki Phase 2 Estate', budget: '₦12.5M', progress: 75, color: 'bg-emerald-400' },
            { name: 'Ikeja Office Renovation', budget: '₦4.8M', progress: 40, color: 'bg-blue-400' },
            { name: 'Apapa Warehouse Dev', budget: '₦8.2M', progress: 15, color: 'bg-amber-400' },
          ].map(p => (
            <div key={p.name}>
              <div className="flex items-center justify-between text-[9px] mb-1">
                <span className="text-slate-600 truncate">{p.name}</span>
                <span className="font-medium text-slate-700">{p.budget}</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full ${p.color} rounded-full transition-all duration-700`} style={{ width: `${p.progress}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'tax',
    label: 'Tax Dashboard',
    icon: ReceiptText,
    color: 'from-indigo-500 to-indigo-400',
    content: (
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between text-[10px]">
          <span className="font-semibold text-[#082F49]">Tax Summary</span>
          <span className="text-[9px] text-slate-400">Period: Jul 2026</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { label: 'VAT Output', amount: '₦1.2M', status: 'Filed' },
            { label: 'WHT', amount: '₦450K', status: 'Pending' },
            { label: 'PAYE', amount: '₦680K', status: 'Due 25th' },
            { label: 'CIT', amount: '₦2.1M', status: 'Q3' },
          ].map(t => (
            <div key={t.label} className="bg-slate-50 rounded-lg p-1.5">
              <div className="text-[8px] text-slate-500">{t.label}</div>
              <div className="text-[10px] font-bold text-[#082F49]">{t.amount}</div>
              <div className={`text-[7px] font-medium ${
                t.status === 'Filed' ? 'text-emerald-600' : t.status === 'Pending' ? 'text-amber-600' : 'text-sky-600'
              }`}>{t.status}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'ai',
    label: 'AI Assistant',
    icon: Bot,
    color: 'from-[#0EA5E9] to-sky-300',
    content: (
      <div className="space-y-2 p-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#0EA5E9] to-[#0284C7] flex items-center justify-center">
            <Bot size={12} className="text-white" />
          </div>
          <div>
            <div className="text-[10px] font-semibold text-[#082F49]">SkyAI Assistant</div>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[8px] text-emerald-600">Online</span>
            </div>
          </div>
        </div>
        <div className="bg-sky-50 rounded-lg p-2 text-[9px] text-slate-700 leading-relaxed">
          I analysed your Q2 financials. Revenue grew 12% driven by the Lekki project. 
          I recommend reviewing your WHT schedule — 3 filings are due next week.
        </div>
        <div className="flex gap-1.5">
          {['Show cash flow', 'Tax reminders', 'Invoice status'].map(s => (
            <div key={s} className="bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5 text-[8px] text-slate-500">{s}</div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-slate-400 border-t border-slate-100 pt-2">
          <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center">
            <span className="text-[7px] text-slate-400">✎</span>
          </div>
          <span className="italic">Ask me anything about your finances...</span>
        </div>
      </div>
    ),
  },
];

export default function Screenshots() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section id="modules" className="py-16 lg:py-24 bg-slate-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" ref={ref}>
        <div className={`text-center max-w-2xl mx-auto mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <span className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-widest">Showcase</span>
          <h2 className="mt-3 text-3xl lg:text-4xl font-bold text-[#082F49]">
            Every financial tool you need
          </h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            From invoicing to tax compliance, SkyBooks provides a complete suite of integrated accounting modules.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
          {modules.map((mod, i) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.id}
                className={`group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                {/* Header */}
                <div className={`bg-gradient-to-r ${mod.color} px-4 py-2.5 flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Icon size={12} className="text-white" />
                    </div>
                    <span className="text-[11px] font-semibold text-white">{mod.label}</span>
                  </div>
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-white/40" />
                    <div className="w-2 h-2 rounded-full bg-white/40" />
                    <div className="w-2 h-2 rounded-full bg-white/40" />
                  </div>
                </div>
                {/* Content */}
                <div className="group-hover:translate-y-0 transition-transform duration-300">
                  {mod.content}
                </div>
                {/* Hover shimmer */}
                <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-shimmer" />
              </div>
            );
          })}
        </div>

        {/* Floating decorations */}
        <div className="relative mt-8 text-center" style={{ perspective: '1000px' }}>
          <div className={`inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-slate-200 shadow-sm text-xs text-slate-500 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`} style={{ transitionDelay: '600ms' }}>
            <CreditCard size={14} className="text-[#0EA5E9]" />
            <span>Integrates with</span>
            <span className="font-semibold text-slate-700">Paystack</span>
            <span className="text-slate-300">·</span>
            <span className="font-semibold text-slate-700">Flutterwave</span>
            <span className="text-slate-300">·</span>
            <span className="font-semibold text-slate-700">Moniepoint</span>
            <span className="text-slate-300">·</span>
            <span className="font-semibold text-slate-700">All Nigerian Banks</span>
          </div>
        </div>
      </div>
    </section>
  );
}
