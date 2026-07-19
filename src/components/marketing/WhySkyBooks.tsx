import React from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { Zap, Globe, Shield, Users } from 'lucide-react';

const reasons = [
  {
    icon: Zap,
    title: 'Built for Nigerian SMEs',
    description: 'Every feature is designed with the Nigerian business environment in mind — from VAT computations to bank integrations with local banks.',
  },
  {
    icon: Globe,
    title: 'Multi-Currency Ready',
    description: 'Handle USD, EUR, GBP alongside NGN with auto-fetched CBN exchange rates. Perfect for importers, exporters, and cross-border businesses.',
  },
  {
    icon: Shield,
    title: 'Bank-Grade Security',
    description: 'AES-256 encryption, SOC 2 infrastructure, daily backups, and granular access controls keep your financial data safe.',
  },
  {
    icon: Users,
    title: 'Team Collaboration',
    description: 'Invite your accountant, auditors, and team members with role-based access. Everyone sees only what they need.',
  },
];

export function WhySkyBooks() {
  const { ref, isVisible } = useScrollReveal();
  return (
    <section className="py-20 lg:py-28 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" ref={ref}>
        <div className={`text-center max-w-2xl mx-auto mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <span className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-widest">Why SkyBooks</span>
          <h2 className="mt-3 text-3xl lg:text-4xl font-bold text-[#082F49]">
            Accounting software that actually works for Africa
          </h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            Unlike generic platforms built for Western markets, SkyBooks is engineered from the ground up for the unique needs of African businesses.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {reasons.map((r, i) => {
            const Icon = r.icon;
            return (
              <div
                key={r.title}
                className={`bg-white rounded-2xl border border-slate-200 p-6 micro-lift transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <div className="w-11 h-11 rounded-xl bg-sky-50 flex items-center justify-center mb-4 group-hover:bg-sky-100">
                  <Icon size={20} className="text-[#0EA5E9]" />
                </div>
                <h3 className="text-base font-semibold text-[#082F49] mb-2">{r.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{r.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
