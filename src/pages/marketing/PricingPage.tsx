import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, ArrowRight, Plus, Minus } from 'lucide-react';

type BillingPeriod = 'monthly' | 'annual';

interface Tier {
  name: string;
  monthlyPrice: string;
  annualPrice: string;
  annualPerMonth: string;
  savings: string;
  description: string;
  popular: boolean;
  cta: string;
  ctaLink: string;
  maxUsers: string;
  support: string;
  storage: string;
  apiAccess: boolean;
  aiAccess: boolean;
  integrations: string;
  advancedReports: boolean;
  accountingFeatures: string[];
  taxFeatures: string[];
  inventory: boolean;
  projects: boolean;
  payroll: boolean;
  analytics: string;
}

const tiers: Tier[] = [
  {
    name: 'Starter',
    monthlyPrice: '₦0',
    annualPrice: '₦0',
    annualPerMonth: '₦0',
    savings: '',
    description: 'Perfect for freelancers and micro-businesses just getting started.',
    popular: false,
    cta: 'Get Started',
    ctaLink: '/register',
    maxUsers: '1 user',
    support: 'Email support',
    storage: '100 MB',
    apiAccess: false,
    aiAccess: false,
    integrations: '1 bank connection',
    advancedReports: false,
    accountingFeatures: [
      'Up to 20 invoices/month',
      'Full expense management',
      'Bank reconciliation',
      'Multi-currency support',
      'Financial reports (P&L, BS, CF)',
      'Inventory management',
    ],
    taxFeatures: [
      'VAT computation',
      'WHT computation',
    ],
    inventory: true,
    projects: false,
    payroll: false,
    analytics: 'Basic dashboard',
  },
  {
    name: 'Professional',
    monthlyPrice: '₦9,000',
    annualPrice: '₦90,000',
    annualPerMonth: '₦7,500',
    savings: 'Save ₦18,000',
    description: 'For growing businesses that need full accounting capabilities.',
    popular: true,
    cta: 'Start Free Trial',
    ctaLink: '/register',
    maxUsers: '5 users',
    support: 'Priority email & chat',
    storage: '5 GB',
    apiAccess: true,
    aiAccess: true,
    integrations: 'Unlimited bank connections',
    advancedReports: true,
    accountingFeatures: [
      'Bank feed connection',
      'Unlimited invoices & quotes',
      'Full expense management',
      'Bank reconciliation',
      'Multi-currency support',
      'Financial reports (P&L, BS, CF)',
      'Inventory management',
    ],
    taxFeatures: [
      'VAT computation',
      'WHT computation',
      'Payroll management',
      'Tax engine (VAT, WHT, PAYE, CIT)',
    ],
    inventory: true,
    projects: true,
    payroll: true,
    analytics: 'Financial reports (P&L, BS, CF)',
  },
  {
    name: 'Enterprise',
    monthlyPrice: '₦20,000',
    annualPrice: '₦200,000',
    annualPerMonth: '₦16,667',
    savings: 'Save ₦40,000',
    description: 'For established businesses with advanced reporting and compliance needs.',
    popular: false,
    cta: 'Contact Sales',
    ctaLink: '/contact',
    maxUsers: 'Unlimited users',
    support: 'Dedicated account manager',
    storage: 'Unlimited',
    apiAccess: true,
    aiAccess: true,
    integrations: 'Unlimited + webhooks',
    advancedReports: true,
    accountingFeatures: [
      'Everything in Professional',
      'Payroll management',
      'Multi-entity consolidation',
      'Custom reports & integrations',
      'IFRS 15 & 16 compliance',
      'SLA guarantee',
    ],
    taxFeatures: [
      'Tax engine (VAT, WHT, PAYE, CIT)',
      'Auto tax journal posting',
    ],
    inventory: true,
    projects: true,
    payroll: true,
    analytics: 'Custom reports & dashboards',
  },
];

export function PricingPage() {
  const navigate = useNavigate();
  const [billing, setBilling] = useState<BillingPeriod>('monthly');
  const [compareOpen, setCompareOpen] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white">
      {/* Simple nav */}
      <header className="border-b border-slate-100 bg-white/95 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <button onClick={() => navigate('/')} className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#082F49] flex items-center justify-center">
              <span className="text-white font-bold text-xs">S</span>
            </div>
            <span className="text-base font-bold text-[#082F49]">SkyBooks</span>
          </button>
          <button
            onClick={() => navigate('/register')}
            className="px-5 py-2 text-sm font-semibold text-white bg-[#082F49] hover:bg-[#0C4A6E] rounded-lg transition-colors"
          >
            Sign Up
          </button>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="pt-16 pb-12 lg:pt-20 lg:pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-widest">Pricing</span>
          <h1 className="mt-3 text-4xl lg:text-5xl font-extrabold text-[#082F49] leading-tight">
            Simple, transparent pricing
          </h1>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            No hidden fees. No surprise charges. Start free and upgrade as you grow.
          </p>

          {/* Billing toggle */}
          <div className="mt-8 inline-flex items-center gap-3 bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
                billing === 'monthly' ? 'bg-white text-[#082F49] shadow-sm' : 'text-slate-500 hover:text-[#082F49]'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('annual')}
              className={`px-5 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
                billing === 'annual' ? 'bg-white text-[#082F49] shadow-sm' : 'text-slate-500 hover:text-[#082F49]'
              }`}
            >
              Annual
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Save up to 17%</span>
            </button>
          </div>
        </div>
      </section>

      {/* ─── Pricing Cards ─── */}
      <section className="pb-16 lg:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
            {tiers.map((tier) => {
              const price = billing === 'monthly' ? tier.monthlyPrice : tier.annualPrice;
              const period = billing === 'monthly' ? '/month' : '/year';
              const perMonth = billing === 'annual' ? tier.annualPerMonth : null;
              const showSavings = billing === 'annual' && tier.savings;

              return (
                <div
                  key={tier.name}
                  className={`relative flex flex-col bg-white rounded-2xl border transition-all duration-300 ${
                    tier.popular
                      ? 'border-[#0EA5E9] shadow-xl shadow-[#0EA5E9]/10 ring-1 ring-[#0EA5E9]/20 scale-[1.02]'
                      : 'border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md'
                  }`}
                >
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#0EA5E9] text-white text-xs font-semibold rounded-full whitespace-nowrap">
                      Most Popular
                    </div>
                  )}

                  <div className="p-6 lg:p-8 flex flex-col flex-1">
                    <h3 className={`text-lg font-semibold text-center ${tier.popular ? 'text-[#0EA5E9]' : 'text-[#082F49]'}`}>{tier.name}</h3>
                    <p className="text-sm text-slate-500 text-center mt-2">{tier.description}</p>

                    {/* Price */}
                    <div className="mt-6 text-center">
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-3xl lg:text-4xl font-extrabold text-[#082F49]">{price}</span>
                        <span className="text-sm text-slate-400">{period}</span>
                      </div>
                      {perMonth && (
                        <div className="text-xs text-slate-400 mt-1">{perMonth}/month billed annually</div>
                      )}
                      {showSavings && (
                        <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded">
                          <Check size={12} /> {tier.savings}
                        </div>
                      )}
                    </div>

                    {/* CTA */}
                    <button
                      onClick={() => navigate(tier.ctaLink)}
                      className={`mt-6 w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                        tier.popular
                          ? 'bg-[#082F49] text-white hover:bg-[#0C4A6E] shadow-lg shadow-[#082F49]/20'
                          : tier.name === 'Starter'
                            ? 'border border-slate-200 text-slate-700 hover:border-[#0EA5E9]/40 hover:bg-sky-50'
                            : 'border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {tier.cta} <ArrowRight size={14} />
                    </button>

                    {/* Feature list */}
                    <ul className="mt-6 space-y-3 flex-1">
                      {tier.accountingFeatures.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                          <Check size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                          {f}
                        </li>
                      ))}
                      {tier.taxFeatures.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                          <Check size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    {/* Module indicators */}
                    <div className="mt-6 pt-5 border-t border-slate-100 space-y-2">
                      {([
                        ['Unlimited users & roles', tier.maxUsers === 'Unlimited users'],
                        ['Inventory', tier.inventory],
                        ['Payroll', tier.payroll],
                        ['API access', tier.apiAccess],
                        ['Dedicated account manager', tier.support === 'Dedicated account manager'],
                        ['SLA guarantee', false],
                      ] as const).filter(([, included]) => included).map(([label]) => (
                        <div key={label} className="flex items-center gap-2 text-xs text-slate-600">
                          <Check size={12} className="text-emerald-500 shrink-0" />
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Compare All Features Table ─── */}
      <section className="pb-16 lg:pb-24" id="compare">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <button
              onClick={() => setCompareOpen(!compareOpen)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#0EA5E9] hover:text-[#0284C7] transition-colors"
            >
              {compareOpen ? 'Hide' : 'Compare all features'} <ArrowRight size={14} className={compareOpen ? 'rotate-90' : ''} />
            </button>
          </div>

          {compareOpen && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-[#082F49] w-48">Feature</th>
                    {tiers.map((t) => (
                      <th key={t.name} className={`py-3 px-3 text-center font-semibold text-[11px] ${t.popular ? 'text-[#0EA5E9]' : 'text-[#082F49]'}`}>
                        {t.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-slate-50">
                    <td colSpan={4} className="py-2 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Users & Support</td>
                  </tr>
                  {[
                    { label: 'Maximum Users', vals: tiers.map(t => t.maxUsers) },
                    { label: 'Support', vals: tiers.map(t => t.support) },
                    { label: 'Storage', vals: tiers.map(t => t.storage) },
                  ].map((row) => (
                    <tr key={row.label} className="border-b border-slate-100">
                      <td className="py-2.5 px-4 text-[12px] text-slate-700">{row.label}</td>
                      {row.vals.map((v, i) => (
                        <td key={i} className="py-2.5 px-3 text-center text-[11px] text-slate-600">{v}</td>
                      ))}
                    </tr>
                  ))}

                  <tr className="bg-slate-50">
                    <td colSpan={4} className="py-2 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Platform</td>
                  </tr>
                  {[
                    { label: 'API Access', vals: tiers.map(t => t.apiAccess) },
                    { label: 'Integrations', vals: tiers.map(t => t.integrations) },
                    { label: 'Advanced Reports', vals: tiers.map(t => t.advancedReports) },
                  ].map((row) => (
                    <tr key={row.label} className="border-b border-slate-100">
                      <td className="py-2.5 px-4 text-[12px] text-slate-700">{row.label}</td>
                      {row.vals.map((v, i) => (
                        <td key={i} className="py-2.5 px-3 text-center">
                          {typeof v === 'boolean' ? (
                            v ? <Check size={14} className="mx-auto text-emerald-500" /> : <X size={14} className="mx-auto text-slate-300" />
                          ) : (
                            <span className="text-[11px] text-slate-600">{v}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}

                  <tr className="bg-slate-50">
                    <td colSpan={4} className="py-2 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Modules</td>
                  </tr>
                  {[
                    { label: 'Inventory', vals: tiers.map(t => t.inventory) },
                    { label: 'Projects', vals: tiers.map(t => t.projects) },
                    { label: 'Payroll', vals: tiers.map(t => t.payroll) },
                  ].map((row) => (
                    <tr key={row.label} className="border-b border-slate-100">
                      <td className="py-2.5 px-4 text-[12px] text-slate-700">{row.label}</td>
                      {row.vals.map((v, i) => (
                        <td key={i} className="py-2.5 px-3 text-center">
                          {v ? <Check size={14} className="mx-auto text-emerald-500" /> : <X size={14} className="mx-auto text-slate-300" />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ─── FAQs ─── */}
      <section className="pb-16 lg:pb-24 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-[#082F49]">Pricing FAQs</h2>
          </div>
          <div className="space-y-3">
            {[
              { q: 'Can I switch from Monthly to Annual billing?', a: 'Yes, you can switch at any time. Your next billing cycle will reflect the annual rate, and we will credit any remaining days from your monthly plan.' },
              { q: 'What happens when I exceed my plan limits?', a: 'We will notify you when you approach your plan limits. You can upgrade to a higher tier at any time with no downtime or data loss.' },
              { q: 'Is there a discount for non-profits or educational institutions?', a: 'Yes, we offer a 25% discount for registered non-profits and educational institutions. Contact our sales team to apply.' },
              { q: 'Can I cancel my subscription?', a: 'You can cancel anytime from your account settings. Your access will continue until the end of the current billing period. No cancellation fees.' },
              { q: 'Do you offer custom enterprise plans?', a: 'Yes, we offer custom plans for large organizations. Contact our sales team for a tailored quote.' },
            ].map((faq, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                >
                  <span className="text-sm font-medium text-[#082F49]">{faq.q}</span>
                  {expandedFaq === i ? <Minus size={14} className="text-slate-400 shrink-0" /> : <Plus size={14} className="text-slate-400 shrink-0" />}
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${expandedFaq === i ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <p className="px-5 pb-4 text-sm text-slate-500 leading-relaxed">{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-16 lg:py-20 bg-gradient-to-br from-[#082F49] to-[#0C4A6E] relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")', backgroundRepeat: 'repeat' }} />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white leading-tight">Ready to get started?</h2>
          <p className="mt-4 text-lg text-white/70 max-w-xl mx-auto">Join 10,000+ Nigerian businesses already using SkyBooks. Start your free trial today.</p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={() => navigate('/register')} className="w-full sm:w-auto px-8 py-3.5 bg-white hover:bg-slate-100 text-[#082F49] font-semibold rounded-xl transition-all shadow-xl text-sm">
              Start Free Trial <ArrowRight size={16} className="inline ml-1" />
            </button>
            <button onClick={() => navigate('/contact')} className="w-full sm:w-auto px-8 py-3.5 border border-white/20 hover:border-white/40 text-white font-medium rounded-xl transition-all text-sm">
              Talk to Sales
            </button>
          </div>
        </div>
      </section>

      {/* ─── Footer note ─── */}
      <div className="py-6 text-center text-xs text-slate-400 bg-white border-t border-slate-100">
        All plans include a 14-day free trial. No credit card required.
      </div>
    </div>
  );
}
