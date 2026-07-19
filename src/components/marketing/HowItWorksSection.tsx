import React from 'react';
import { UserPlus, Link, BarChart3 } from 'lucide-react';

const steps = [
  {
    icon: UserPlus,
    title: 'Create Your Account',
    description: 'Sign up in under 2 minutes. No credit card required. Set up your company profile and invite your team.',
  },
  {
    icon: Link,
    title: 'Connect & Configure',
    description: 'Link your bank accounts, set up your chart of accounts, configure tax rates, and customize your invoice templates.',
  },
  {
    icon: BarChart3,
    title: 'Run Your Business',
    description: 'Send invoices, track expenses, reconcile bank feeds, and generate IFRS-compliant financial reports in real time.',
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-16 lg:py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-widest">How It Works</span>
          <h2 className="mt-3 text-3xl lg:text-4xl font-bold text-[#082F49]">
            Get started in minutes
          </h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            No complex setup. No training required. Start managing your business finances today.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12 relative">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={i} className="relative text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-[#082F49] flex items-center justify-center shadow-lg shadow-[#082F49]/20 mb-6 relative z-10">
                  <Icon size={28} className="text-white" />
                </div>
                <div className="absolute top-8 left-[60%] w-[calc(100%-4rem)] h-px bg-slate-200 hidden md:block" style={i >= 2 ? { display: 'none' } : {}} />
                <div className="absolute top-8 left-[60%] w-[calc(100%-4rem)] h-px bg-gradient-to-r from-sky-200 to-transparent hidden md:block" style={i >= 2 ? { display: 'none' } : {}} />
                <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-sky-50 border border-sky-200 text-xs font-bold text-[#0EA5E9] mb-4">
                  {i + 1}
                </div>
                <h3 className="text-lg font-semibold text-[#082F49] mb-2">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">{step.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
