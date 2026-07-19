import React from 'react';
import { Quote } from 'lucide-react';

const testimonials = [
  {
    quote: 'SkyBooks transformed how we manage our finances. The automated bank reconciliation alone saves us 15 hours every month. The IFRS-compliant reports make tax season stress-free.',
    name: 'Chioma Okafor',
    role: 'CFO, Lagos Tech Hub',
  },
  {
    quote: 'We switched from QuickBooks to SkyBooks because of the Nigerian tax engine. Automated VAT and WHT computations are a game-changer. Our accountant loves it.',
    name: 'Emeka Nwosu',
    role: 'CEO, Prime Distributors Ltd',
  },
  {
    quote: 'The multi-currency support and CBN rate integration make cross-border transactions seamless. Finally, an accounting platform built for African businesses.',
    name: 'Sarah Adeyemi',
    role: 'Finance Director, Westlink Enterprises',
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-16 lg:py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-widest">Testimonials</span>
          <h2 className="mt-3 text-3xl lg:text-4xl font-bold text-[#082F49]">
            Loved by businesses across Nigeria
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {testimonials.map((t, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 lg:p-8 shadow-sm hover:shadow-md transition-shadow">
              <Quote size={24} className="text-[#0EA5E9]/30 mb-4" />
              <p className="text-sm text-slate-600 leading-relaxed mb-6">&ldquo;{t.quote}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#082F49] to-[#0EA5E9] flex items-center justify-center text-white text-sm font-bold">
                  {t.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#082F49]">{t.name}</div>
                  <div className="text-xs text-slate-500">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
