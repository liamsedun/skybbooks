import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export const CTASection = React.memo(function CTASection() {
  const navigate = useNavigate();

  return (
    <section className="py-16 lg:py-24 bg-gradient-to-br from-[#082F49] to-[#0C4A6E] relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")', backgroundRepeat: 'repeat' }} />

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl lg:text-4xl font-bold text-white leading-tight">
          Ready to transform your business finances?
        </h2>
        <p className="mt-4 text-lg text-white/70 leading-relaxed max-w-xl mx-auto">
          Join 10,000+ Nigerian businesses already using SkyBooks. Start your free 14-day trial today — no credit card needed.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => navigate('/register')}
            className="w-full sm:w-auto px-8 py-3.5 bg-white hover:bg-slate-100 text-[#082F49] font-semibold rounded-xl transition-all shadow-xl flex items-center justify-center gap-2 text-sm"
            aria-label="Start free trial"
          >
            Start Free Trial <ArrowRight size={16} aria-hidden="true" />
          </button>
          <button
            onClick={() => navigate('/login')}
            className="w-full sm:w-auto px-8 py-3.5 border border-white/20 hover:border-white/40 text-white font-medium rounded-xl transition-all text-sm"
          >
            Log in to your account
          </button>
        </div>
        <p className="mt-4 text-xs text-white/50">Free 14-day trial &middot; No credit card required &middot; Cancel anytime</p>
      </div>
    </section>
  );
});

