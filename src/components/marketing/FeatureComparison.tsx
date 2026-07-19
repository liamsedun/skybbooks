import React from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { Check, X } from 'lucide-react';

interface FeatureRow {
  feature: string;
  skybooks: boolean;
  quickbooks: boolean;
  sage: boolean;
  wave: boolean;
}

const features: FeatureRow[] = [
  { feature: 'Invoicing', skybooks: true, quickbooks: true, sage: true, wave: true },
  { feature: 'Expense Tracking', skybooks: true, quickbooks: true, sage: true, wave: true },
  { feature: 'Bank Reconciliation', skybooks: true, quickbooks: true, sage: true, wave: false },
  { feature: 'Nigerian Tax (VAT, WHT, PAYE)', skybooks: true, quickbooks: false, sage: false, wave: false },
  { feature: 'Multi-Currency', skybooks: true, quickbooks: true, sage: true, wave: false },
  { feature: 'IFRS Reports', skybooks: true, quickbooks: false, sage: true, wave: false },
  { feature: 'Payroll & Statutory Payments', skybooks: true, quickbooks: false, sage: true, wave: false },
  { feature: 'Inventory Management', skybooks: true, quickbooks: true, sage: true, wave: false },
  { feature: 'Mobile App', skybooks: true, quickbooks: true, sage: false, wave: true },
  { feature: 'Customer Support (Local)', skybooks: true, quickbooks: false, sage: false, wave: false },
];

export function FeatureComparison() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-16 lg:py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-widest">Compare</span>
          <h2 className="mt-3 text-3xl lg:text-4xl font-bold text-[#082F49]">
            Why SkyBooks beats the competition
          </h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            Purpose-built for Nigerian businesses, with features no other platform offers.
          </p>
        </div>

        <div
          ref={ref}
          className={`overflow-x-auto rounded-xl border border-slate-200 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
        >
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="text-left py-4 px-5 font-semibold text-[#082F49]">Feature</th>
                <th className="py-4 px-5 font-semibold text-white bg-[#082F49] text-center">SkyBooks</th>
                <th className="py-4 px-5 font-semibold text-slate-700 text-center">QuickBooks</th>
                <th className="py-4 px-5 font-semibold text-slate-700 text-center">Sage</th>
                <th className="py-4 px-5 font-semibold text-slate-700 text-center">Wave</th>
              </tr>
            </thead>
            <tbody>
              {features.map((row, i) => (
                <tr
                  key={row.feature}
                  className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} border-t border-slate-100`}
                >
                  <td className="py-3.5 px-5 font-medium text-slate-800">{row.feature}</td>
                  <td className="py-3.5 px-5 text-center bg-[#082F49]/5">
                    {row.skybooks ? (
                      <Check size={18} className="text-green-600 mx-auto" />
                    ) : (
                      <X size={18} className="text-red-400 mx-auto" />
                    )}
                  </td>
                  <td className="py-3.5 px-5 text-center">
                    {row.quickbooks ? (
                      <Check size={18} className="text-green-600 mx-auto" />
                    ) : (
                      <X size={18} className="text-red-400 mx-auto" />
                    )}
                  </td>
                  <td className="py-3.5 px-5 text-center">
                    {row.sage ? (
                      <Check size={18} className="text-green-600 mx-auto" />
                    ) : (
                      <X size={18} className="text-red-400 mx-auto" />
                    )}
                  </td>
                  <td className="py-3.5 px-5 text-center">
                    {row.wave ? (
                      <Check size={18} className="text-green-600 mx-auto" />
                    ) : (
                      <X size={18} className="text-red-400 mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
