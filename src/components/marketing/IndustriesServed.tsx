import React from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { Stethoscope, GraduationCap, ShoppingCart, Factory, Landmark, Wheat } from 'lucide-react';

const industries = [
  {
    icon: Stethoscope,
    name: 'Healthcare',
    description: 'Manage patient billing, HMO capitation, NHIS remittances, supplier payments for medical equipment, and track receivables from insurance partners with automated reconciliation.',
  },
  {
    icon: GraduationCap,
    name: 'Education',
    description: 'Handle school fees collection, TETFUND grants, payroll for academic and non-academic staff, PTA levy management, and bursary disbursements with full audit trails.',
  },
  {
    icon: ShoppingCart,
    name: 'Retail & E-commerce',
    description: 'Track inventory across multiple locations, reconcile Paystack/Flutterwave settlements, manage supplier credit, and generate real-time sales reports for informed restocking.',
  },
  {
    icon: Factory,
    name: 'Manufacturing',
    description: 'Monitor raw material inventory, track work-in-progress costs, manage landed cost of imports, compute excise duties, and generate cost-of-goods-sold reports per product line.',
  },
  {
    icon: Landmark,
    name: 'Financial Services',
    description: 'Manage loan disbursements, track installment repayments, compute interest accruals, reconcile settlement accounts, and generate regulatory returns for the CBN and NDIC.',
  },
  {
    icon: Wheat,
    name: 'Agriculture',
    description: 'Track farm input costs, manage outgrower payments, record harvest yields, handle commodity sales across multiple markets, and access sector-specific VAT exemption rules.',
  },
];

export default function IndustriesServed() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section id="industries" className="py-16 lg:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" ref={ref}>
        <div className={`text-center max-w-2xl mx-auto mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <span className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-widest">Industries</span>
          <h2 className="mt-3 text-3xl lg:text-4xl font-bold text-[#082F49]">
            Built for every sector of the Nigerian economy
          </h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            SkyBooks adapts to the unique financial workflows of your industry — from healthcare to agriculture.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {industries.map((ind, i) => {
            const Icon = ind.icon;
            return (
              <div
                key={ind.name}
                className={`bg-white rounded-2xl border border-slate-200 p-6 micro-lift transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className="w-11 h-11 rounded-xl bg-sky-50 flex items-center justify-center mb-4">
                  <Icon size={20} className="text-[#0EA5E9]" />
                </div>
                <h3 className="text-base font-semibold text-[#082F49] mb-2">{ind.name}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{ind.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
