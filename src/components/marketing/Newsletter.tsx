import React from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { Check, Mail, Send } from 'lucide-react';

const perks = [
  'Monthly product updates and new features',
  'Nigerian tax and compliance tips',
  'Exclusive invites to webinars and events',
];

export function Newsletter() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="relative py-16 lg:py-24 overflow-hidden section-auto">
      <div className="absolute inset-0 bg-gradient-to-br from-[#082F49] to-[#0C4A6E]" />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={ref} className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div
            className={`transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
          >
            <span className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-widest">Newsletter</span>
            <h2 className="mt-3 text-3xl lg:text-4xl font-bold text-white">
              Stay ahead of the curve
            </h2>
            <p className="mt-4 text-sky-200 leading-relaxed">
              Get the latest accounting tips, regulatory updates, and product news delivered to your inbox.
            </p>
            <ul className="mt-6 space-y-3">
              {perks.map((perk) => (
                <li key={perk} className="flex items-center gap-3 text-sm text-sky-100">
                  <div className="w-5 h-5 rounded-full bg-sky-500/20 flex items-center justify-center shrink-0">
                    <Check size={12} className="text-[#0EA5E9]" />
                  </div>
                  {perk}
                </li>
              ))}
            </ul>
          </div>

          <div
            className={`transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
          >
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 p-6 lg:p-8">
              <div className="flex items-center gap-3 mb-5">
                <Mail size={20} className="text-[#0EA5E9]" />
                <h3 className="text-lg font-semibold text-white">Subscribe to our newsletter</h3>
              </div>
              <div className="flex gap-3">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-sky-300/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-transparent transition-all"
                />
                <button className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#0EA5E9] text-white text-sm font-semibold hover:bg-sky-500 transition-colors whitespace-nowrap">
                  Subscribe
                  <Send size={14} />
                </button>
              </div>
              <p className="mt-4 text-xs text-sky-300/60">
                No spam. Unsubscribe anytime.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
