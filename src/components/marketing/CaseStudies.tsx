import React from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { Quote, ArrowUpRight } from 'lucide-react';

interface Stat {
  label: string;
  value: string;
}

interface CaseStudy {
  initials: string;
  gradient: string;
  company: string;
  industry: string;
  industryColor: string;
  quote: string;
  stats: Stat[];
}

const studies: CaseStudy[] = [
  {
    initials: 'PF',
    gradient: 'from-amber-500 to-orange-600',
    company: 'Prime Foods Nigeria',
    industry: 'Manufacturing',
    industryColor: 'text-amber-700 bg-amber-50',
    quote: 'SkyBooks automated our entire accounts payable process. What used to take a full week now takes two days. The Nigerian tax engine alone saves us hours every month.',
    stats: [
      { label: 'Hours saved per month', value: '40+' },
      { label: 'Reduction in late payments', value: '85%' },
    ],
  },
  {
    initials: 'TS',
    gradient: 'from-blue-500 to-indigo-600',
    company: 'TechBridge Solutions',
    industry: 'Technology',
    industryColor: 'text-blue-700 bg-blue-50',
    quote: 'The bank reconciliation accuracy is incredible — 99.8% auto-match rate. We went from dreading month-end close to finishing it in two days.',
    stats: [
      { label: 'Auto-reconciliation rate', value: '99.8%' },
      { label: 'Month-end close time', value: '2 days' },
    ],
  },
  {
    initials: 'GF',
    gradient: 'from-emerald-500 to-teal-600',
    company: 'Greenfield Farms',
    industry: 'Agriculture',
    industryColor: 'text-emerald-700 bg-emerald-50',
    quote: 'Managing inventory across 12 locations was chaotic. SkyBooks gave us real-time visibility into stock levels and automated our purchase orders.',
    stats: [
      { label: 'Daily transactions processed', value: '500+' },
      { label: 'Inventory accuracy improvement', value: '96%' },
    ],
  },
];

export function CaseStudies() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-16 lg:py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-widest">Success Stories</span>
          <h2 className="mt-3 text-3xl lg:text-4xl font-bold text-[#082F49]">
            Trusted by businesses across Nigeria
          </h2>
        </div>

        <div ref={ref} className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {studies.map((s, i) => (
            <div
              key={s.company}
              className={`micro-lift bg-white rounded-2xl border border-slate-200 p-6 lg:p-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: `${i * 150}ms` }}
            >
              <div className="flex items-center gap-4 mb-5">
                <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${s.gradient} flex items-center justify-center text-white text-base font-bold shrink-0`}>
                  {s.initials}
                </div>
                <div>
                  <div className="text-base font-semibold text-[#082F49]">{s.company}</div>
                  <span className={`inline-block text-xs font-medium mt-0.5 px-2.5 py-0.5 rounded-full ${s.industryColor}`}>
                    {s.industry}
                  </span>
                </div>
              </div>

              <Quote size={20} className="text-[#0EA5E9]/30 mb-3" />
              <p className="text-sm text-slate-600 leading-relaxed mb-6">&ldquo;{s.quote}&rdquo;</p>

              <div className="grid grid-cols-2 gap-4 py-4 border-t border-slate-100">
                {s.stats.map((stat) => (
                  <div key={stat.label}>
                    <div className="text-lg font-bold text-[#082F49]">{stat.value}</div>
                    <div className="text-xs text-slate-500">{stat.label}</div>
                  </div>
                ))}
              </div>

              <a
                href="#"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0EA5E9] hover:text-[#082F49] transition-colors mt-2"
              >
                Read full story
                <ArrowUpRight size={14} />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
