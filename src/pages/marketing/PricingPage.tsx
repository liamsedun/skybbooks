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
    name: 'Free',
    monthlyPrice: '₦0',
    annualPrice: '₦0',
    annualPerMonth: '₦0',
    savings: '',
    description: 'Perfect for freelancers and sole proprietors just starting out.',
    popular: false,
    cta: 'Get Started Free',
    ctaLink: '/register',
    maxUsers: '1 user',
    support: 'Community forum',
    storage: '100 MB',
    apiAccess: false,
    aiAccess: false,
    integrations: '1 bank connection',
    advancedReports: false,
    accountingFeatures: ['Basic invoicing (10/mo)', 'Manual expense entry', 'Single currency (NGN)', 'Basic reports'],
    taxFeatures: [],
    inventory: false,
    projects: false,
    payroll: false,
    analytics: 'Basic dashboard',
  },
  {
    name: 'Standard',
    monthlyPrice: '₦7,500',
    annualPrice: '₦75,000',
    annualPerMonth: '₦6,250',
    savings: 'Save ₦15,000',
    description: 'For growing startups that need more transactions and bank feeds.',
    popular: false,
    cta: 'Start Free Trial',
    ctaLink: '/register',
    maxUsers: '3 users',
    support: 'Email support (24h)',
    storage: '1 GB',
    apiAccess: false,
    aiAccess: true,
    integrations: '3 bank connections',
    advancedReports: false,
    accountingFeatures: ['Unlimited invoicing', 'Receipt scanning', 'Multi-currency (NGN + 1)', 'Bank reconciliation', 'Expense categorization'],
    taxFeatures: ['VAT computation', 'VAT return export'],
    inventory: false,
    projects: false,
    payroll: false,
    analytics: 'Standard reports',
  },
  {
    name: 'Professional',
    monthlyPrice: '₦15,000',
    annualPrice: '₦150,000',
    annualPerMonth: '₦12,500',
    savings: 'Save ₦30,000',
    description: 'For established SMEs needing full accounting and team collaboration.',
    popular: true,
    cta: 'Start Free Trial',
    ctaLink: '/register',
    maxUsers: '10 users',
    support: 'Priority email & chat',
    storage: '5 GB',
    apiAccess: true,
    aiAccess: true,
    integrations: 'Unlimited bank connections',
    advancedReports: true,
    accountingFeatures: ['Unlimited invoicing & quotes', 'Receipt OCR scanning', 'Multi-currency (unlimited)', 'Auto bank reconciliation', 'Recurring invoices', 'Bill management', 'Multi-user roles'],
    taxFeatures: ['VAT computation & filing', 'WHT computation', 'PAYE computation', 'CIT computation'],
    inventory: true,
    projects: true,
    payroll: false,
    analytics: 'Advanced reports (P&L, BS, CF, TB)',
  },
  {
    name: 'Premium',
    monthlyPrice: '₦30,000',
    annualPrice: '₦300,000',
    annualPerMonth: '₦25,000',
    savings: 'Save ₦60,000',
    description: 'For companies with payroll needs and advanced inventory management.',
    popular: false,
    cta: 'Start Free Trial',
    ctaLink: '/register',
    maxUsers: '25 users',
    support: 'Priority chat & phone',
    storage: '20 GB',
    apiAccess: true,
    aiAccess: true,
    integrations: 'Unlimited + API webhooks',
    advancedReports: true,
    accountingFeatures: ['Everything in Professional', 'Budget management', 'Fixed assets register', 'Multi-entity consolidation', 'Custom reporting'],
    taxFeatures: ['Everything in Professional', 'NSITF computation', 'ITF computation', 'NHIF computation', 'Stamp duty', 'FIRS-ready returns'],
    inventory: true,
    projects: true,
    payroll: true,
    analytics: 'Executive dashboard + KPIs',
  },
  {
    name: 'Elite',
    monthlyPrice: '₦60,000',
    annualPrice: '₦600,000',
    annualPerMonth: '₦50,000',
    savings: 'Save ₦120,000',
    description: 'For enterprises demanding IFRS compliance and advanced automation.',
    popular: false,
    cta: 'Start Free Trial',
    ctaLink: '/register',
    maxUsers: '50 users',
    support: 'Dedicated account manager',
    storage: '50 GB',
    apiAccess: true,
    aiAccess: true,
    integrations: 'Unlimited + custom connectors',
    advancedReports: true,
    accountingFeatures: ['Everything in Premium', 'IFRS 15 (Revenue Recognition)', 'IFRS 16 (Lease Accounting)', 'IFRS 9 (ECL Provisioning)', 'Multi-org consolidation', 'Custom report builder'],
    taxFeatures: ['Everything in Premium', 'Auto tax journal posting', 'Tax calendar & reminders', 'Multi-jurisdiction support'],
    inventory: true,
    projects: true,
    payroll: true,
    analytics: 'AI-powered insights & forecasting',
  },
  {
    name: 'Ultimate',
    monthlyPrice: '₦120,000',
    annualPrice: '₦1,200,000',
    annualPerMonth: '₦100,000',
    savings: 'Save ₦240,000',
    description: 'For large organizations requiring full customization and white-label.',
    popular: false,
    cta: 'Contact Sales',
    ctaLink: '/contact',
    maxUsers: 'Unlimited users',
    support: '24/7 dedicated support',
    storage: 'Unlimited',
    apiAccess: true,
    aiAccess: true,
    integrations: 'Unlimited + white-label',
    advancedReports: true,
    accountingFeatures: ['Everything in Elite', 'White-label platform', 'On-premise option', 'SLA guarantee', 'Custom development', 'Priority feature requests'],
    taxFeatures: ['Everything in Elite', 'Custom tax rules', 'Automated multi-jurisdiction filing'],
    inventory: true,
    projects: true,
    payroll: true,
    analytics: 'Full BI integration + data warehouse',
  },
];

const FEATURE_CATEGORIES = [
  {
    label: 'Users & Support',
    key: 'usersSupport' as const,
    rows: [
      { label: 'Maximum Users', key: 'maxUsers' as const },
      { label: 'Support', key: 'support' as const },
      { label: 'Storage', key: 'storage' as const },
    ],
  },
  {
    label: 'Platform Features',
    key: 'platform' as const,
    rows: [
      { label: 'API Access', key: 'apiAccess' as const },
      { label: 'AI Features', key: 'aiAccess' as const },
      { label: 'Integrations', key: 'integrations' as const },
      { label: 'Advanced Reports', key: 'advancedReports' as const },
    ],
  },
  {
    label: 'Modules',
    key: 'modules' as const,
    rows: [
      { label: 'Inventory', key: 'inventory' as const },
      { label: 'Projects', key: 'projects' as const },
      { label: 'Payroll', key: 'payroll' as const },
    ],
  },
];

export function PricingPage() {
  const navigate = useNavigate();
  const [billing, setBilling] = useState<BillingPeriod>('monthly');
  const [compareOpen, setCompareOpen] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white">
      {/* Simple nav for the pricing page */}
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
            Get Started
          </button>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="pt-16 pb-12 lg:pt-20 lg:pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-widest">Pricing</span>
          <h1 className="mt-3 text-4xl lg:text-5xl font-extrabold text-[#082F49] leading-tight">
            Plans for every stage of growth
          </h1>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            Start free, upgrade as you grow. All plans include a 14-day free trial with no credit card required.
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
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 lg:gap-5">
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
                  {/* Recommended badge */}
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#0EA5E9] text-white text-[10px] font-semibold rounded-full whitespace-nowrap">
                      Most Popular
                    </div>
                  )}

                  <div className="p-5 flex flex-col flex-1">
                    {/* Plan name */}
                    <h3 className={`text-base font-bold ${tier.popular ? 'text-[#0EA5E9]' : 'text-[#082F49]'}`}>{tier.name}</h3>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{tier.description}</p>

                    {/* Price */}
                    <div className="mt-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-extrabold text-[#082F49]">{price}</span>
                        <span className="text-[11px] text-slate-400">{period}</span>
                      </div>
                      {perMonth && (
                        <div className="text-[10px] text-slate-400 mt-0.5">{perMonth}/month billed annually</div>
                      )}
                      {showSavings && (
                        <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-semibold rounded">
                          <Check size={10} /> {tier.savings}
                        </div>
                      )}
                    </div>

                    {/* CTA */}
                    <button
                      onClick={() => navigate(tier.ctaLink)}
                      className={`mt-5 w-full py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-1.5 ${
                        tier.popular
                          ? 'bg-[#082F49] text-white hover:bg-[#0C4A6E] shadow-lg shadow-[#082F49]/20'
                          : tier.name === 'Free'
                            ? 'border border-slate-200 text-slate-700 hover:border-[#0EA5E9]/40 hover:bg-sky-50'
                            : 'border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {tier.cta} <ArrowRight size={12} />
                    </button>

                    {/* Feature list */}
                    <div className="mt-5 space-y-2.5 flex-1">
                      {/* Max users */}
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Users</span>
                        <span className="font-medium text-[#082F49]">{tier.maxUsers}</span>
                      </div>
                      {/* Support */}
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Support</span>
                        <span className="font-medium text-[#082F49]">{tier.support}</span>
                      </div>
                      {/* Storage */}
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Storage</span>
                        <span className="font-medium text-[#082F49]">{tier.storage}</span>
                      </div>

                      <hr className="border-slate-100" />

                      {tier.accountingFeatures.slice(0, 4).map((f) => (
                        <div key={f} className="flex items-start gap-2 text-[11px] text-slate-600">
                          <Check size={11} className="text-emerald-500 mt-0.5 shrink-0" />
                          {f}
                        </div>
                      ))}
                      {tier.accountingFeatures.length > 4 && (
                        <div className="text-[10px] text-[#0EA5E9] font-medium ml-5">+{tier.accountingFeatures.length - 4} more</div>
                      )}

                      {/* Tax features */}
                      {tier.taxFeatures.length > 0 && (
                        <>
                          <hr className="border-slate-100" />
                          {tier.taxFeatures.slice(0, 2).map((f) => (
                            <div key={f} className="flex items-start gap-2 text-[11px] text-slate-600">
                              <Check size={11} className="text-emerald-500 mt-0.5 shrink-0" />
                              {f}
                            </div>
                          ))}
                          {tier.taxFeatures.length > 2 && (
                            <div className="text-[10px] text-[#0EA5E9] font-medium ml-5">+{tier.taxFeatures.length - 2} tax features</div>
                          )}
                        </>
                      )}

                      {/* Module checks */}
                      <hr className="border-slate-100" />
                      {([
                        ['Inventory', tier.inventory],
                        ['Projects', tier.projects],
                        ['Payroll', tier.payroll],
                        ['API Access', tier.apiAccess],
                        ['AI Features', tier.aiAccess],
                        ['Advanced Reports', tier.advancedReports],
                      ] as const).map(([label, included]) => (
                        <div key={label} className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">{label}</span>
                          {included ? (
                            <Check size={12} className="text-emerald-500" />
                          ) : (
                            <X size={12} className="text-slate-300" />
                          )}
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
                  {/* Users & Support */}
                  <tr className="bg-slate-50">
                    <td colSpan={7} className="py-2 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Users & Support</td>
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

                  {/* Platform */}
                  <tr className="bg-slate-50">
                    <td colSpan={7} className="py-2 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Platform</td>
                  </tr>
                  {[
                    { label: 'API Access', vals: tiers.map(t => t.apiAccess) },
                    { label: 'AI Features', vals: tiers.map(t => t.aiAccess) },
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

                  {/* Modules */}
                  <tr className="bg-slate-50">
                    <td colSpan={7} className="py-2 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Modules</td>
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

                  {/* Accounting */}
                  <tr className="bg-slate-50">
                    <td colSpan={7} className="py-2 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Accounting</td>
                  </tr>
                  {tiers[0].accountingFeatures.map((feat, fi) => (
                    <tr key={feat} className="border-b border-slate-100">
                      <td className="py-2.5 px-4 text-[12px] text-slate-700">{feat}</td>
                      {tiers.map((t, ti) => {
                        const has = ti <= fi ? ti >= 0 : false;
                        const idx = t.accountingFeatures.indexOf(feat);
                        return (
                          <td key={ti} className="py-2.5 px-3 text-center">
                            {idx >= 0 ? (
                              <Check size={14} className="mx-auto text-emerald-500" />
                            ) : (
                              <X size={14} className="mx-auto text-slate-300" />
                            )}
                          </td>
                        );
                      })}
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
              { q: 'Do you offer custom enterprise plans?', a: 'Yes, the Ultimate plan can be fully customized to your needs. Contact our sales team for a tailored quote.' },
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
        Prices exclude applicable taxes.
      </div>
    </div>
  );
}
