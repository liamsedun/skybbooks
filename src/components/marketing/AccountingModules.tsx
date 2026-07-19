import React from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import {
  BookOpen,
  ArrowUpFromLine,
  ArrowDownToLine,
  Users,
  Building2,
  Package,
  LineChart,
  ReceiptText,
} from 'lucide-react';

const modules = [
  {
    icon: BookOpen,
    name: 'General Ledger',
    description: 'Full double-entry accounting with a flexible chart of accounts, multi-currency support, and real-time posting to the general ledger.',
  },
  {
    icon: ArrowUpFromLine,
    name: 'Accounts Payable',
    description: 'Manage vendor bills, track payment due dates, schedule disbursements, and reconcile supplier statements with automated aging reports.',
  },
  {
    icon: ArrowDownToLine,
    name: 'Accounts Receivable',
    description: 'Generate invoices, track customer payments, send automated reminders, and monitor receivables aging to improve cash flow.',
  },
  {
    icon: Users,
    name: 'Payroll Management',
    description: 'Compute PAYE, NHF, NSITF, and ITF deductions automatically. Generate payslips, remit statutory deductions, and file returns.',
  },
  {
    icon: Building2,
    name: 'Fixed Assets',
    description: 'Track asset registers, compute straight-line and reducing-balance depreciation, monitor disposals, and generate asset schedules for IFRS compliance.',
  },
  {
    icon: Package,
    name: 'Inventory',
    description: 'Manage stock levels across warehouses, track landed costs, auto-adjust on purchase and sale, and generate inventory valuation reports.',
  },
  {
    icon: LineChart,
    name: 'Budgeting',
    description: 'Set departmental budgets, track actual vs budget variance in real time, and configure rolling forecasts for better financial planning.',
  },
  {
    icon: ReceiptText,
    name: 'VAT Management',
    description: 'Auto-compute output and input VAT, generate VAT returns, reconcile with FIRS payments, and handle exemptions for qualifying supplies.',
  },
];

export default function AccountingModules() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section id="modules" className="py-16 lg:py-24 bg-slate-50 section-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" ref={ref}>
        <div className={`text-center max-w-2xl mx-auto mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <span className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-widest">Modules</span>
          <h2 className="mt-3 text-3xl lg:text-4xl font-bold text-[#082F49]">
            Complete accounting toolkit
          </h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            Eight integrated modules that cover every aspect of your business finance — from procurement to reporting.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {modules.map((m, i) => {
            const Icon = m.icon;
            return (
              <div
                key={m.name}
                className={`bg-white rounded-2xl border border-slate-200 p-6 micro-lift transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div className="w-11 h-11 rounded-xl bg-sky-50 flex items-center justify-center mb-4">
                  <Icon size={20} className="text-[#0EA5E9]" />
                </div>
                <h3 className="text-base font-semibold text-[#082F49] mb-2">{m.name}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{m.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
