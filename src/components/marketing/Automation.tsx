import React from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { CheckCircle2, ArrowRight } from 'lucide-react';

const automationPoints = [
  {
    title: 'Auto-Categorization',
    description: 'AI learns your expense patterns and automatically categorizes every transaction — salaries, utilities, rent, and more — saving hours of manual data entry.',
  },
  {
    title: 'Bank Reconciliation',
    description: 'Bank feeds are matched against your ledger automatically. In seconds, reconcile hundreds of transactions with intelligent fuzzy matching.',
  },
  {
    title: 'Recurring Transactions',
    description: 'Set up rent, subscriptions, loan repayments, and standing orders once. SkyBooks posts them automatically on schedule with full audit trails.',
  },
  {
    title: 'Scheduled Reports',
    description: 'Deliver P&L, Balance Sheet, VAT returns, and board reports to stakeholders automatically via email on any schedule — daily, weekly, or monthly.',
  },
];

const workflowSteps = ['Invoice Received', 'Auto-Categorize', 'Auto-Reconcile', 'Auto-Post to GL'];

export default function Automation() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section id="automation" className="py-16 lg:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div ref={ref}>
            <div className={`transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              <span className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-widest">Automation</span>
              <h2 className="mt-3 text-3xl lg:text-4xl font-bold text-[#082F49]">
                Automate your entire accounting workflow
              </h2>
              <p className="mt-4 text-slate-600 leading-relaxed mb-8">
                Stop wasting time on repetitive data entry. SkyBooks automates the entire 
                accounts process from invoice receipt to general ledger posting.
              </p>

              <div className="space-y-6">
                {automationPoints.map((pt, i) => (
                  <div
                    key={pt.title}
                    className={`flex gap-4 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
                    style={{ transitionDelay: `${i * 120}ms` }}
                  >
                    <div className="shrink-0 mt-0.5">
                      <CheckCircle2 size={20} className="text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-[#082F49]">{pt.title}</h3>
                      <p className="text-sm text-slate-500 mt-1 leading-relaxed">{pt.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-[#0EA5E9]/5 to-[#082F49]/5 rounded-2xl" />
            <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl p-6 lg:p-8">
              <div className="text-center mb-6">
                <h3 className="text-sm font-bold text-[#082F49]">Automation Workflow</h3>
                <p className="text-xs text-slate-400">End-to-end processing pipeline</p>
              </div>

              <div className="space-y-0">
                {workflowSteps.map((step, i) => (
                  <div key={step} className="relative flex items-center gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-[#082F49] flex items-center justify-center shrink-0">
                        <span className="text-white text-xs font-bold">{i + 1}</span>
                      </div>
                      {i < workflowSteps.length - 1 && (
                        <div className="w-0.5 h-10 bg-gradient-to-b from-[#0EA5E9] to-slate-200" />
                      )}
                    </div>
                    <div className={`bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 flex-1 ${i === 0 || i === workflowSteps.length - 1 ? 'bg-sky-50 border-sky-200' : ''}`}>
                      <div className="text-sm font-semibold text-[#082F49]">{step}</div>
                      <div className="text-xs text-slate-400">
                        {i === 0 && 'Upload or email invoices to SkyBooks'}
                        {i === 1 && 'AI reads vendor, amount, category, tax'}
                        {i === 2 && 'Matches against PO, bank feed, and ledger'}
                        {i === 3 && 'Creates journal entries automatically'}
                      </div>
                    </div>
                    {i < workflowSteps.length - 1 && (
                      <div className="absolute -bottom-5 left-5 hidden lg:block">
                        <ArrowRight size={14} className="text-[#0EA5E9]" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 text-center">
                <span className="text-xs text-slate-400">
                  From invoice to GL posting in under 30 seconds
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
