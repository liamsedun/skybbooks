import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Phone, MapPin, Globe, ArrowRight, Send, MessageCircle } from 'lucide-react';

export function ContactPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
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

      <section className="pt-16 pb-20 lg:pt-24 lg:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            {/* Left — Contact info */}
            <div>
              <span className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-widest">Contact</span>
              <h1 className="mt-3 text-3xl lg:text-4xl font-extrabold text-[#082F49] leading-tight">Get in touch</h1>
              <p className="mt-4 text-base text-slate-600 leading-relaxed">
                Have a question about SkyBooks? Want a personalized demo? Our team is ready to help.
              </p>

              <div className="mt-10 space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-sky-50 flex items-center justify-center shrink-0">
                    <Mail size={18} className="text-[#0EA5E9]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#082F49]">Email</h3>
                    <a href="mailto:subscription@skyaccounting.com.ng" className="text-sm text-[#0EA5E9] hover:underline block mt-0.5">subscription@skyaccounting.com.ng</a>
                    <a href="mailto:hello@skyaccounting.com.ng" className="text-sm text-[#0EA5E9] hover:underline block">hello@skyaccounting.com.ng</a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-sky-50 flex items-center justify-center shrink-0">
                    <MessageCircle size={18} className="text-[#0EA5E9]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#082F49]">WhatsApp</h3>
                    <a href="https://wa.me/2348157377000" target="_blank" rel="noopener noreferrer" className="text-sm text-[#0EA5E9] hover:underline block mt-0.5">+234 815 737 7000</a>
                    <a href="https://wa.me/2347058119864" target="_blank" rel="noopener noreferrer" className="text-sm text-[#0EA5E9] hover:underline block">+234 705 811 9864</a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-sky-50 flex items-center justify-center shrink-0">
                    <Globe size={18} className="text-[#0EA5E9]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#082F49]">Web</h3>
                    <a href="https://skyaccounting.com.ng" target="_blank" rel="noopener noreferrer" className="text-sm text-[#0EA5E9] hover:underline block mt-0.5">skyaccounting.com.ng</a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-sky-50 flex items-center justify-center shrink-0">
                    <MapPin size={18} className="text-[#0EA5E9]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#082F49]">Office</h3>
                    <p className="text-sm text-slate-600 mt-0.5">2/4 Moses Adebayo Street, Ojodu-Ikeja, Lagos, Nigeria</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex items-center gap-3">
                <a
                  href="https://ng.linkedin.com/company/skyhouse-accounting-bookkeepers"
                  target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-slate-100 hover:bg-[#0EA5E9] flex items-center justify-center text-slate-500 hover:text-white transition-all duration-300"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                </a>
                <a
                  href="https://x.com/SkyhouseAccount"
                  target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-slate-100 hover:bg-[#0EA5E9] flex items-center justify-center text-slate-500 hover:text-white transition-all duration-300"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                </a>
                <a
                  href="https://web.facebook.com/skyhouseaccountants"
                  target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-slate-100 hover:bg-[#0EA5E9] flex items-center justify-center text-slate-500 hover:text-white transition-all duration-300"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                </a>
                <a
                  href="https://www.youtube.com/channel/UCapqWrjoXasFhyGENVywYxw"
                  target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-slate-100 hover:bg-[#0EA5E9] flex items-center justify-center text-slate-500 hover:text-white transition-all duration-300"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
                </a>
              </div>
            </div>

            {/* Right — Contact form */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 lg:p-8">
              <h2 className="text-xl font-bold text-[#082F49] mb-6">Send us a message</h2>
              <form onSubmit={e => { e.preventDefault(); window.location.href = 'mailto:hello@skyaccounting.com.ng'; }} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Full name</label>
                    <input type="text" placeholder="Your name" className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 focus:border-[#0EA5E9] transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Email</label>
                    <input type="email" placeholder="you@company.com" className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 focus:border-[#0EA5E9] transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Subject</label>
                  <select className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 focus:border-[#0EA5E9] transition-all">
                    <option>Book a Demo</option>
                    <option>Sales Inquiry</option>
                    <option>Technical Support</option>
                    <option>Partnership</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Message</label>
                  <textarea rows={4} placeholder="Tell us about your needs..." className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 focus:border-[#0EA5E9] transition-all resize-none" />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-[#082F49] hover:bg-[#0C4A6E] text-white font-semibold rounded-xl transition-colors shadow-lg shadow-[#082F49]/20 flex items-center justify-center gap-2 text-sm"
                >
                  <Send size={14} /> Send Message
                </button>
                <p className="text-xs text-slate-400 text-center">We typically respond within 2 hours during business hours.</p>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 bg-gradient-to-br from-[#082F49] to-[#0C4A6E]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-white">Ready to simplify your accounting?</h2>
          <p className="mt-3 text-white/70 text-sm">Start your free trial today. No credit card required.</p>
          <button
            onClick={() => navigate('/register')}
            className="mt-6 px-8 py-3 bg-white hover:bg-slate-100 text-[#082F49] font-semibold rounded-xl transition-all shadow-xl text-sm inline-flex items-center gap-2"
          >
            Start Free Trial <ArrowRight size={14} />
          </button>
        </div>
      </section>
    </div>
  );
}
