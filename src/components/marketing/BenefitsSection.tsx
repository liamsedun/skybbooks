import React from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { Clock, CheckCircle, TrendingUp } from 'lucide-react';

const benefits = [
  {
    icon: Clock,
    title: 'Save Time',
    description: 'Automate repetitive accounting tasks and cut processing time by up to 60%.',
    bullets: [
      'Auto-reconcile bank transactions in seconds',
      'Generate IFRS reports with one click',
      'Schedule recurring invoices and payments',
    ],
  },
  {
    icon: CheckCircle,
    title: 'Reduce Errors',
    description: 'Eliminate manual data entry mistakes and ensure accurate financial records.',
    bullets: [
      'Real-time validation on every transaction',
      'Automated Nigerian tax computations',
      'Built-in audit trail for every change',
    ],
  },
  {
    icon: TrendingUp,
    title: 'Gain Insights',
    description: 'Make data-driven decisions with real-time financial intelligence.',
    bullets: [
      'Live dashboard with key business metrics',
      'Cash flow forecasting and projections',
      'Multi-dimensional profit & loss analysis',
    ],
  },
];

export function BenefitsSection() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-16 lg:py-24 bg-white section-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-widest">Benefits</span>
          <h2 className="mt-3 text-3xl lg:text-4xl font-bold text-[#082F49]">
            The SkyBooks advantage
          </h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            More than accounting software — a strategic partner for your business growth.
          </p>
        </div>

        <div ref={ref} className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {benefits.map((b, i) => {
            const Icon = b.icon;
            return (
              <div
                key={b.title}
                className={`micro-lift bg-white rounded-2xl border border-slate-200 p-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: `${i * 150}ms` }}
              >
                <div className="w-14 h-14 rounded-2xl bg-sky-50 flex items-center justify-center mb-5">
                  <Icon size={28} className="text-[#0EA5E9]" />
                </div>
                <h3 className="text-xl font-bold text-[#082F49] mb-3">{b.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-5">{b.description}</p>
                <ul className="space-y-2.5">
                  {b.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0EA5E9] mt-2 shrink-0" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
