import React from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import {
  Building2, CreditCard, Puzzle, RefreshCw, Landmark,
  Wallet,
} from 'lucide-react';

interface Integration {
  name: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const banks: Integration[] = [
  { name: 'GTBank', icon: Building2 },
  { name: 'Access Bank', icon: Building2 },
  { name: 'UBA', icon: Building2 },
  { name: 'FirstBank', icon: Building2 },
  { name: 'Zenith', icon: Building2 },
  { name: 'Fidelity', icon: Building2 },
];

const gateways: Integration[] = [
  { name: 'Paystack', icon: Wallet },
  { name: 'Flutterwave', icon: Wallet },
  { name: 'Moniepoint', icon: Wallet },
];

const tools: Integration[] = [
  { name: 'Slack', icon: Puzzle },
  { name: 'Zapier', icon: Puzzle },
  { name: 'Make', icon: Puzzle },
];

const categories = [
  {
    icon: RefreshCw,
    title: 'Banking',
    description: 'Connect directly to Nigerian banks for automatic transaction feeds and reconciliation.',
    integrations: 'GTBank, Access, UBA, FirstBank, Zenith, Fidelity & more',
  },
  {
    icon: CreditCard,
    title: 'Payments',
    description: 'Seamless integration with leading payment gateways for real-time transaction sync.',
    integrations: 'Paystack, Flutterwave, Moniepoint & more',
  },
  {
    icon: Puzzle,
    title: 'Productivity',
    description: 'Connect your favourite tools to automate workflows and data sync.',
    integrations: 'Slack, Zapier, Make (Integromat) & more',
  },
];

const allIntegrations = [...banks, ...gateways, ...tools];

export function Integrations() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-16 lg:py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-widest">Integrations</span>
          <h2 className="mt-3 text-3xl lg:text-4xl font-bold text-[#082F49]">
            Connects with the tools you already use
          </h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            Sync your bank accounts, payment gateways, and productivity tools seamlessly.
          </p>
        </div>

        <div className="relative mb-16">
          <div className="flex gap-3 animate-marquee w-max">
            {[...allIntegrations, ...allIntegrations].map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={`${item.name}-${i}`}
                  className="micro-scale flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-full px-5 py-2.5 whitespace-nowrap"
                >
                  <Icon size={16} className="text-[#0EA5E9]" />
                  <span className="text-sm font-medium text-slate-700">{item.name}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div ref={ref} className="grid md:grid-cols-3 gap-6">
          {categories.map((cat, i) => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.title}
                className={`micro-lift bg-white rounded-2xl border border-slate-200 p-6 lg:p-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
                style={{ transitionDelay: `${i * 150}ms` }}
              >
                <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center mb-5">
                  <Icon size={24} className="text-[#0EA5E9]" />
                </div>
                <h3 className="text-lg font-bold text-[#082F49] mb-2">{cat.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-4">{cat.description}</p>
                <div className="text-xs text-slate-400">{cat.integrations}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
