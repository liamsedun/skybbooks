import React from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { ScanText, Brain, AlertTriangle, TrendingUp } from 'lucide-react';

const aiFeatures = [
  {
    icon: ScanText,
    title: 'Smart Receipt Scanning',
    description: 'Snap a photo of any receipt or invoice. Our AI extracts vendor, date, amount, line items, and VAT — then creates an expense entry automatically.',
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    icon: Brain,
    title: 'Intelligent Categorization',
    description: 'The AI learns your chart of accounts and historical patterns to categorize every transaction with over 95% accuracy — no manual tagging needed.',
    gradient: 'from-violet-500 to-purple-500',
  },
  {
    icon: AlertTriangle,
    title: 'Anomaly Detection',
    description: 'Get alerted on duplicate payments, unusual spending spikes, missing receipts, and irregular journal entries before they become costly problems.',
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    icon: TrendingUp,
    title: 'Cash Flow Predictions',
    description: 'Forecast your cash position 30, 60, and 90 days ahead using historical patterns, upcoming invoices, and known commitments — all powered by ML models.',
    gradient: 'from-[#0EA5E9] to-[#0284C7]',
  },
];

export default function ArtificialIntelligence() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section id="ai-features" className="py-16 lg:py-24 bg-slate-50 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle at 25% 50%, #0EA5E9 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" ref={ref}>
        <div className={`text-center max-w-2xl mx-auto mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <span className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-widest">Artificial Intelligence</span>
          <h2 className="mt-3 text-3xl lg:text-4xl font-bold text-[#082F49]">
            Smarter accounting with AI
          </h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            SkyBooks uses machine learning to automate the tedious parts of accounting so you can focus on growing your business.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {aiFeatures.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className={`group relative bg-white rounded-2xl border border-slate-200 p-6 transition-all duration-500 micro-lift ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ border: '1px solid transparent', backgroundClip: 'padding-box', background: 'linear-gradient(135deg, rgba(14,165,233,0.15), rgba(8,47,73,0.08))' }} />
                <div className="relative">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-4 shadow-lg`}>
                    <Icon size={20} className="text-white" />
                  </div>
                  <h3 className="text-base font-semibold text-[#082F49] mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
