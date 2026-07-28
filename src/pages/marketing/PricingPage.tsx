import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, ArrowRight, Plus, Minus, Loader2 } from 'lucide-react';
import { SeoHead } from '../../components/seo/SeoHead';

type BillingPeriod = 'monthly' | 'annual';

function fmtNaira(v: number): string {
  const abs = Math.abs(v);
  const naira = Math.floor(abs / 100);
  const kobo = abs % 100;
  const formatted = naira.toLocaleString('en-US') + '.' + String(kobo).padStart(2, '0');
  return (v < 0 ? '-₦' : '₦') + formatted;
}

const PLAN_FEATURES: Record<string, { label: string; included: boolean }[]> = {
  free: [
    { label: 'Up to 1 user', included: true },
    { label: '10 Invoices/month', included: true },
    { label: '10 Bills/Repayment', included: true },
    { label: '1 Bank feed connection', included: true },
    { label: '1 Bank reconciliation/month', included: true },
    { label: 'Financial reports (P&L, BS, CF)', included: true },
    { label: 'API access', included: true },
    { label: '500MB storage', included: true },
    { label: 'VAT computation', included: true },
    { label: 'WHT computation', included: true },
    { label: 'Tax engine (VAT, WHT, PAYE, CIT)', included: true },
  ],
  start: [
    { label: 'Up to 3 users', included: true },
    { label: 'Bank feed connection', included: true },
    { label: 'Bank reconciliation', included: true },
    { label: 'Multi-currency support', included: true },
    { label: 'Financial reports (P&L, BS, CF)', included: true },
    { label: 'Inventory management', included: true },
    { label: 'Projects', included: true },
    { label: 'API access', included: true },
    { label: '5 GB storage', included: true },
    { label: 'VAT computation', included: true },
    { label: 'WHT computation', included: true },
    { label: 'Tax engine (VAT, WHT, PAYE, CIT)', included: true },
  ],
  professional: [
    { label: 'Up to 10 users', included: true },
    { label: 'Bank feed connection', included: true },
    { label: 'Bank reconciliation', included: true },
    { label: 'Multi-currency support', included: true },
    { label: 'Financial reports (P&L, BS, CF)', included: true },
    { label: 'Inventory management', included: true },
    { label: 'Projects', included: true },
    { label: 'API access', included: true },
    { label: '10 GB storage', included: true },
    { label: 'VAT computation', included: true },
    { label: 'WHT computation', included: true },
    { label: 'Tax engine (VAT, WHT, PAYE, CIT)', included: true },
    { label: 'SkyHRM', included: true },
  ],
  enterprise: [
    { label: 'Up to 50 users', included: true },
    { label: 'Bank feed connection', included: true },
    { label: 'Bank reconciliation', included: true },
    { label: 'Multi-currency support', included: true },
    { label: 'Financial reports (P&L, BS, CF)', included: true },
    { label: 'Inventory management', included: true },
    { label: 'Projects', included: true },
    { label: 'API access', included: true },
    { label: '20 GB storage', included: true },
    { label: 'VAT computation', included: true },
    { label: 'WHT computation', included: true },
    { label: 'Tax engine (VAT, WHT, PAYE, CIT)', included: true },
    { label: 'SkyCRM', included: true },
    { label: 'SkyHRM', included: true },
  ],
};

function getFeatures(plan: any) {
  const code = (plan.code || '').toLowerCase();
  return PLAN_FEATURES[code] || PLAN_FEATURES.free;
}

function computeSavings(monthlyKobo: number, annualKobo: number): string | null {
  if (!monthlyKobo || !annualKobo) return null;
  const monthlyTotal = monthlyKobo * 12;
  const saving = monthlyTotal - annualKobo;
  if (saving <= 0) return null;
  return `Save ${fmtNaira(saving)}`;
}

function computeAnnualPerMonth(annualKobo: number): string | null {
  if (!annualKobo) return null;
  const perMonth = Math.round(annualKobo / 12);
  return fmtNaira(perMonth);
}

export function PricingPage() {
  const navigate = useNavigate();
  const [billing, setBilling] = useState<BillingPeriod>('monthly');
  const [compareOpen, setCompareOpen] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetch('/api/auth/plans')
      .then(r => r.json())
      .then(data => {
        const active = (Array.isArray(data) ? data : []).filter((p: any) => p.isActive && p.isPublic);
        setPlans(active);
      })
      .catch(err => console.error('Failed to load plans:', err))
      .finally(() => setLoading(false));
  }, []);

  const jsonLdOffers = plans.map((p: any) => ({
    '@type': 'Offer',
    name: p.name,
    price: String(Math.round((p.monthlyPriceKobo || 0) / 100)),
    priceCurrency: p.currency || 'NGN',
    description: p.description || '',
  }));

  return (
    <div className="min-h-screen bg-white">
      <SeoHead
        title="Pricing"
        description="Simple, transparent pricing for Nigerian SMEs. Start free, upgrade as you grow."
        canonical="https://skyaccounting.com.ng/pricing"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          'name': 'SkyBooks Accounting Platform',
          'description': 'Cloud-based accounting software for Nigerian SMEs with invoicing, expense tracking, payroll, bank reconciliation, and tax compliance.',
          'brand': { '@type': 'Brand', 'name': 'SkyBooks' },
          'offers': jsonLdOffers,
        }}
      />
      {/* Simple nav */}
      <header className="border-b border-slate-100 bg-white/95 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <button onClick={() => navigate('/')} className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#082F49] flex items-center justify-center overflow-hidden">
              <img src="/images/skyhouse-logo.png" alt="" className="w-full h-full object-contain p-0.5" />
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
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 max-w-6xl mx-auto">
              {plans.map((plan: any) => {
                const isPopular = plan.popularBadge;
                const monthlyKobo = plan.monthlyPriceKobo || 0;
                const annualKobo = plan.annualPriceKobo || 0;
                const price = billing === 'monthly' ? fmtNaira(monthlyKobo) : fmtNaira(annualKobo);
                const period = billing === 'monthly' ? '/month' : '/year';
                const perMonth = billing === 'annual' ? computeAnnualPerMonth(annualKobo) : null;
                const savings = billing === 'annual' ? computeSavings(monthlyKobo, annualKobo) : null;
                const features = getFeatures(plan);

                return (
                  <div
                    key={plan.id}
                    className={`relative flex flex-col bg-white rounded-2xl border transition-all duration-300 ${
                      isPopular
                        ? 'border-[#0EA5E9] shadow-xl shadow-[#0EA5E9]/10 ring-1 ring-[#0EA5E9]/20 scale-[1.02]'
                        : 'border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md'
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#0EA5E9] text-white text-xs font-semibold rounded-full whitespace-nowrap">
                        Most Popular
                      </div>
                    )}

                    <div className="p-6 lg:p-8 flex flex-col flex-1">
                      <h3 className={`text-lg font-semibold text-center ${isPopular ? 'text-[#0EA5E9]' : 'text-[#082F49]'}`}>{plan.name}</h3>
                      <p className="text-sm text-slate-500 text-center mt-2">{plan.description}</p>

                      {/* Price */}
                      <div className="mt-6 text-center">
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-2xl lg:text-3xl font-extrabold text-[#082F49]">{price}</span>
                          <span className="text-sm text-slate-400">{period}</span>
                        </div>
                        {perMonth && (
                          <div className="text-xs text-slate-400 mt-1">{perMonth}/month billed annually</div>
                        )}
                        {savings && (
                          <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded">
                            <Check size={12} /> {savings}
                          </div>
                        )}
                      </div>

                      {/* CTA */}
                      <button
                        onClick={() => navigate('/register')}
                        className={`mt-6 w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                          isPopular
                            ? 'bg-[#082F49] text-white hover:bg-[#0C4A6E] shadow-lg shadow-[#082F49]/20'
                            : plan.code === 'free'
                              ? 'border border-slate-200 text-slate-700 hover:border-[#0EA5E9]/40 hover:bg-sky-50'
                              : 'border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {plan.monthlyPriceKobo === 0 ? 'Get Started' : 'Start Free Trial'} <ArrowRight size={14} />
                      </button>

                      {/* Feature list */}
                      <ul className="mt-6 space-y-3 flex-1">
                        {features.map((f) => (
                          <li key={f.label} className="flex items-start gap-2.5 text-sm text-slate-600">
                            <Check size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                            {f.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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

          {compareOpen && !loading && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-[#082F49] w-48">Feature</th>
                    {plans.map((p: any) => (
                      <th key={p.id} className={`py-3 px-3 text-center font-semibold text-[11px] ${p.popularBadge ? 'text-[#0EA5E9]' : 'text-[#082F49]'}`}>
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-slate-50">
                    <td colSpan={plans.length + 1} className="py-2 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Users & Support</td>
                  </tr>
                  {[
                    { label: 'Maximum Users', vals: plans.map((p: any) => p.userLimit === 0 ? 'Unlimited' : String(p.userLimit)) },
                    { label: 'Support', vals: plans.map((p: any) => p.supportLevel || 'community') },
                    { label: 'Storage', vals: plans.map((p: any) => `${p.storageLimitGb || 1} GB`) },
                  ].map((row) => (
                    <tr key={row.label} className="border-b border-slate-100">
                      <td className="py-2.5 px-4 text-[12px] text-slate-700">{row.label}</td>
                      {row.vals.map((v, i) => (
                        <td key={i} className="py-2.5 px-3 text-center text-[11px] text-slate-600">{v}</td>
                      ))}
                    </tr>
                  ))}

                  <tr className="bg-slate-50">
                    <td colSpan={plans.length + 1} className="py-2 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Platform</td>
                  </tr>
                  {[
                    { label: 'API Access', vals: plans.map((p: any) => p.apiRequests > 0) },
                    { label: 'Integrations', vals: plans.map((p: any) => p.apiRequests === 0 ? '1 bank connection' : 'Unlimited bank connections') },
                    { label: 'Advanced Reports', vals: plans.map((p: any) => (p.maxReports ?? 0) > 10) },
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
                    <td colSpan={plans.length + 1} className="py-2 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Modules</td>
                  </tr>
                  {[
                    { label: 'Inventory', key: 'maxWarehouses', fn: (v: number) => v > 0 },
                    { label: 'Projects', key: 'maxProjects', fn: (v: number) => v > 0 },
                    { label: 'SkyCRM', key: 'modules', fn: (v: string[]) => (v ?? []).includes('crm') },
                    { label: 'SkyHRM', key: 'modules', fn: (v: string[]) => (v ?? []).includes('hrm') },
                  ].map((row) => (
                    <tr key={row.label} className="border-b border-slate-100">
                      <td className="py-2.5 px-4 text-[12px] text-slate-700">{row.label}</td>
                      {plans.map((p: any) => {
                        const included = row.fn(p[row.key]);
                        return (
                          <td key={p.id} className="py-2.5 px-3 text-center">
                            {included ? <Check size={14} className="mx-auto text-emerald-500" /> : <X size={14} className="mx-auto text-slate-300" />}
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
