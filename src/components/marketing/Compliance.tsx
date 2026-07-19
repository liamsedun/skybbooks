import React from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { Award, FileCheck, Landmark, ShieldCheck, Building, BookOpen } from 'lucide-react';

const complianceItems = [
  {
    icon: Award,
    title: 'IFRS',
    description: 'Full International Financial Reporting Standards compliance for statutory reporting and audit readiness.',
  },
  {
    icon: FileCheck,
    title: 'Nigerian GAAP',
    description: 'Aligns with Nigerian Generally Accepted Accounting Principles as prescribed by NASB.',
  },
  {
    icon: Landmark,
    title: 'FIRS',
    description: 'Automated VAT, WHT, and CIT computations that match FIRS submission requirements.',
  },
  {
    icon: ShieldCheck,
    title: 'NDPR',
    description: 'Nigeria Data Protection Regulation compliance with full data privacy controls and consent management.',
  },
  {
    icon: Building,
    title: 'CBN Guidelines',
    description: 'Adheres to Central Bank of Nigeria financial reporting guidelines for regulated entities.',
  },
  {
    icon: BookOpen,
    title: 'IAS',
    description: 'International Accounting Standards support for cross-border financial reporting consistency.',
  },
];

export function Compliance() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-16 lg:py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-widest">Compliance</span>
          <h2 className="mt-3 text-3xl lg:text-4xl font-bold text-[#082F49]">
            Stay compliant without the headache
          </h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            SkyBooks handles the regulatory complexity so you can focus on growing your business.
          </p>
        </div>

        <div ref={ref} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {complianceItems.map((c, i) => {
            const Icon = c.icon;
            return (
              <div
                key={c.title}
                className={`micro-lift bg-white rounded-2xl border border-slate-200 p-6 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className="w-11 h-11 rounded-xl bg-sky-50 flex items-center justify-center mb-4">
                  <Icon size={20} className="text-[#0EA5E9]" />
                </div>
                <h3 className="text-base font-semibold text-[#082F49] mb-2">{c.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{c.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
