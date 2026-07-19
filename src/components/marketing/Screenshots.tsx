import React from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { FileText, ArrowLeftRight, BarChart3, Shield } from 'lucide-react';

const screenshots = [
  {
    icon: FileText,
    label: 'Invoices Dashboard',
    description: 'Create, send, and track invoices with real-time payment status and automated reminders.',
    gradient: 'from-[#0EA5E9]/20 to-[#0284C7]/5',
    pattern: 'radial-gradient(circle at 20% 80%, rgba(14,165,233,0.08) 0%, transparent 50%)',
  },
  {
    icon: ArrowLeftRight,
    label: 'Bank Reconciliation',
    description: 'Match bank feed transactions against your ledger with intelligent auto-suggestions.',
    gradient: 'from-emerald-500/20 to-teal-500/5',
    pattern: 'radial-gradient(circle at 80% 20%, rgba(16,185,129,0.08) 0%, transparent 50%)',
  },
  {
    icon: BarChart3,
    label: 'Financial Reports',
    description: 'Generate IFRS-compliant P&L, Balance Sheet, Cash Flow, and Trial Balance in one click.',
    gradient: 'from-violet-500/20 to-purple-500/5',
    pattern: 'radial-gradient(circle at 30% 30%, rgba(139,92,246,0.08) 0%, transparent 50%)',
  },
  {
    icon: Shield,
    label: 'Tax Engine',
    description: 'Automated VAT, WHT, PAYE, CIT, NSITF, and ITF computations with direct FIRS filing.',
    gradient: 'from-amber-500/20 to-orange-500/5',
    pattern: 'radial-gradient(circle at 70% 70%, rgba(245,158,11,0.08) 0%, transparent 50%)',
  },
];

export default function Screenshots() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-16 lg:py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" ref={ref}>
        <div className={`text-center max-w-2xl mx-auto mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <span className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-widest">Screenshots</span>
          <h2 className="mt-3 text-3xl lg:text-4xl font-bold text-[#082F49]">
            See SkyBooks in action
          </h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            A glimpse into the powerful features that help Nigerian businesses manage their finances effortlessly.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5 lg:gap-6">
          {screenshots.map((shot, i) => {
            const Icon = shot.icon;
            return (
              <div
                key={shot.label}
                className={`group relative bg-white rounded-2xl border border-slate-200 overflow-hidden micro-scale transition-all duration-700 cursor-pointer ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <div
                  className="absolute inset-0 bg-gradient-to-br"
                  style={{ backgroundImage: `${shot.gradient}, ${shot.pattern}` }}
                />
                <div className="relative h-48 lg:h-56 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-white/80 backdrop-blur-sm border border-white/40 shadow-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Icon size={28} className="text-[#082F49]" />
                    </div>
                    <div className="text-xs font-semibold text-[#082F49]/60 bg-white/60 backdrop-blur-sm px-3 py-1 rounded-full border border-white/40">
                      {shot.label}
                    </div>
                  </div>
                </div>
                <div className="relative bg-white/95 backdrop-blur-sm border-t border-slate-200 px-5 py-4">
                  <h3 className="text-sm font-semibold text-[#082F49]">{shot.label}</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{shot.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
