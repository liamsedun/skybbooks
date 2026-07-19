import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowRight } from 'lucide-react';

const tiers = [
  {
    name: 'Free',
    price: '₦0',
    period: 'forever',
    description: 'Perfect for freelancers and micro-businesses just getting started.',
    features: ['1 user', 'Basic invoicing (10/mo)', 'Manual expense entry', 'Single currency (NGN)', 'Community support'],
    cta: 'Get Started',
    popular: false,
  },
  {
    name: 'Standard',
    price: '₦7,500',
    period: '/month',
    description: 'For growing startups that need more transactions and bank feeds.',
    features: ['3 users', 'Unlimited invoicing', 'Receipt scanning', 'Bank reconciliation', 'VAT computation', 'AI features', 'Email support'],
    cta: 'Start Free Trial',
    popular: false,
  },
  {
    name: 'Professional',
    price: '₦15,000',
    period: '/month',
    description: 'For established SMEs needing full accounting, inventory, and tax compliance.',
    features: [
      '10 users',
      'Unlimited invoicing & quotes',
      'Multi-currency (unlimited)',
      'Auto bank reconciliation',
      'Inventory management',
      'Project tracking',
      'Full tax (VAT, WHT, PAYE, CIT)',
      'API access',
      'Advanced reports',
      'Priority support',
    ],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Premium',
    price: '₦30,000',
    period: '/month',
    description: 'For companies needing payroll, IFRS compliance, and enterprise features.',
    features: [
      '25 users',
      'Payroll management',
      'Fixed assets',
      'IFRS 15, 16 & 9 compliance',
      'Multi-entity consolidation',
      'All tax computations (NSITF, ITF, NHIF, Stamp Duty)',
      'White-label option',
      'Dedicated account manager',
      'Priority phone support',
    ],
    cta: 'Start Free Trial',
    popular: false,
  },
];

export function PricingSection() {
  const navigate = useNavigate();

  return (
    <section id="pricing" className="py-16 lg:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-widest">Pricing</span>
          <h2 className="mt-3 text-3xl lg:text-4xl font-bold text-[#082F49]">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            No hidden fees. No surprise charges. Start free and upgrade as you grow.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6 max-w-6xl mx-auto">
          {tiers.map(tier => (
            <div
              key={tier.name}
              className={`relative bg-white rounded-2xl border p-6 transition-all duration-300 ${
                tier.popular
                  ? 'border-[#0EA5E9] shadow-xl shadow-[#0EA5E9]/10 ring-1 ring-[#0EA5E9]/20 scale-[1.02]'
                  : 'border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md'
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#0EA5E9] text-white text-xs font-semibold rounded-full">
                  Most Popular
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className={`text-lg font-semibold ${tier.popular ? 'text-[#0EA5E9]' : 'text-[#082F49]'}`}>{tier.name}</h3>
                <div className="mt-3 flex items-baseline justify-center gap-1">
                  <span className="text-3xl lg:text-4xl font-extrabold text-[#082F49]">{tier.price}</span>
                  <span className="text-sm text-slate-500">{tier.period}</span>
                </div>
                <p className="mt-2 text-sm text-slate-500">{tier.description}</p>
              </div>

              <ul className="space-y-3 mb-8">
                {tier.features.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <Check size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => navigate(tier.name === 'Premium' ? '/register' : '/register')}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                  tier.popular
                    ? 'bg-[#082F49] text-white hover:bg-[#0C4A6E] shadow-lg shadow-[#082F49]/20'
                    : 'border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {tier.cta} <ArrowRight size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <button
            onClick={() => navigate('/pricing')}
            className="text-sm font-semibold text-[#0EA5E9] hover:text-[#0284C7] transition-colors"
          >
            View full pricing details &rarr;
          </button>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          All plans include a 14-day free trial. No credit card required.
        </p>
      </div>
    </section>
  );
}
