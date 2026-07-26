import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, HelpCircle, Video, History, LifeBuoy, ChevronRight } from 'lucide-react';

const SECTIONS = [
  { path: '/help/documents', icon: BookOpen, title: 'Help Documents', desc: 'Browse documentation on invoices, banking, payroll, reports, and more.', color: 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100' },
  { path: '/help/faqs', icon: HelpCircle, title: 'FAQs', desc: 'Frequently asked questions about using SkyBooks.', color: 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' },
  { path: '/help/videos', icon: Video, title: 'Video Tutorials', desc: 'Watch step-by-step video guides for common tasks.', color: 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100' },
  { path: '/help/migration-guide', icon: History, title: 'Migration Guide', desc: 'Step-by-step guide to migrating from a legacy system, including opening balances and COA import.', color: 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100' },
];

export function HelpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-2">
          <LifeBuoy className="w-7 h-7 text-indigo-600" />
          <h1 className="text-2xl font-bold text-slate-900">Help & Support</h1>
        </div>
        <p className="text-sm text-slate-500 mb-10">Everything you need to get started and make the most of SkyBooks.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SECTIONS.map(s => {
            const Icon = s.icon;
            return (
              <Link key={s.path} to={s.path} className={`group rounded-2xl border p-5 transition-all ${s.color}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/80 border shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{s.title}</h3>
                      <p className="text-sm text-slate-600 mt-0.5 leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0 mt-1" />
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-12 bg-indigo-50 rounded-2xl border border-indigo-200/80 p-6 text-sm text-indigo-800">
          <h3 className="font-semibold text-indigo-900 flex items-center gap-2 mb-2"><LifeBuoy className="w-4 h-4" /> Still need help?</h3>
          <p>Contact our support team via the in-app chat widget (bottom-right corner) or email us at <a href="mailto:hello@skyaccounting.com.ng" className="text-indigo-700 underline font-medium">hello@skyaccounting.com.ng</a>.</p>
        </div>
      </div>
    </div>
  );
}
