import React from 'react';
import { FileText, Wallet, Banknote, BarChart3, Users, Shield, RefreshCw, Receipt } from 'lucide-react';

const features = [
  {
    icon: FileText,
    title: 'Invoicing & Quotes',
    description: 'Create professional invoices and quotes in seconds. Auto-numbering, recurring invoices, multi-currency support, and instant PDF generation.',
  },
  {
    icon: Wallet,
    title: 'Expense Tracking',
    description: 'Track every business expense with receipt capture, categorization, and real-time approval workflows.',
  },
  {
    icon: Banknote,
    title: 'Bank Reconciliation',
    description: 'Connect your bank accounts for automatic feed reconciliation. Match transactions in seconds, not hours.',
  },
  {
    icon: BarChart3,
    title: 'Financial Reports',
    description: 'IFRS-compliant reports including P&L, Balance Sheet, Cash Flow, Trial Balance, and VAT returns — all generated automatically.',
  },
  {
    icon: Users,
    title: 'Multi-User Access',
    description: 'Role-based access control for your team. Accountants, managers, and staff each see only what they need.',
  },
  {
    icon: Shield,
    title: 'Nigerian Tax Compliance',
    description: 'Automated VAT, WHT, PAYE, CIT, NSITF, ITF, and NHIF computations. Stay compliant with FIRS requirements effortlessly.',
  },
  {
    icon: RefreshCw,
    title: 'Multi-Currency',
    description: 'Handle transactions in USD, EUR, GBP, and more with auto-fetching exchange rates from the CBN.',
  },
  {
    icon: Receipt,
    title: 'Inventory Management',
    description: 'Track stock levels, manage purchase orders, and automate inventory adjustments with landed cost tracking.',
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-16 lg:py-24 bg-white section-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-widest">Features</span>
          <h2 className="mt-3 text-3xl lg:text-4xl font-bold text-[#082F49]">
            Everything you need to run your business
          </h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            From invoicing to financial reporting, SkyBooks provides a complete toolkit 
            for Nigerian SMEs to manage their finances efficiently.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={i}
                className="group relative bg-white rounded-2xl border border-slate-200 p-6 hover:border-[#0EA5E9]/30 hover:shadow-lg hover:shadow-[#0EA5E9]/5 transition-all duration-300"
              >
                <div className="w-11 h-11 rounded-xl bg-sky-50 flex items-center justify-center mb-4 group-hover:bg-sky-100 transition-colors">
                  <Icon size={20} className="text-[#0EA5E9]" />
                </div>
                <h3 className="text-base font-semibold text-[#082F49] mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
