import React from 'react';
import { Video, Play } from 'lucide-react';

const VIDEOS = [
  { title: 'Getting Started with SkyBooks', desc: 'Learn how to set up your organisation, invite users, and configure basic settings.', duration: '8:32' },
  { title: 'Managing Chart of Accounts', desc: 'How to create, edit, and organise your chart of accounts with parent-child relationships.', duration: '12:15' },
  { title: 'Creating Invoices & Getting Paid', desc: 'Walkthrough of the invoicing process from creation to payment reconciliation.', duration: '15:40' },
  { title: 'Recording Bills & Expenses', desc: 'How to record vendor bills, track expenses, and manage purchase orders.', duration: '10:22' },
  { title: 'Bank Reconciliation', desc: 'Connect your bank feeds and reconcile transactions step by step.', duration: '14:08' },
  { title: 'Running Payroll', desc: 'Process employee payroll, compute statutory deductions, and generate payslips.', duration: '18:55' },
  { title: 'Generating Financial Reports', desc: 'How to generate and export Trial Balance, Income Statement, Balance Sheet, and more.', duration: '20:10' },
  { title: 'Fixed Assets Management', desc: 'Register assets, run depreciation, and manage asset lifecycle.', duration: '11:45' },
  { title: 'Multi-Currency Transactions', desc: 'How to record and manage transactions in foreign currencies.', duration: '9:30' },
  { title: 'IFRS 15 Revenue Recognition', desc: 'Set up revenue contracts, performance obligations, and recognition schedules.', duration: '16:20' },
  { title: 'IFRS 16 Lease Accounting', desc: 'Record leases, process payments, and manage lease modifications.', duration: '13:50' },
  { title: 'Tax Engine & VAT Returns', desc: 'Manage PAYE, VAT, ITF, and other statutory tax obligations.', duration: '17:05' },
];

export function VideoTutorialsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Video className="w-6 h-6 text-indigo-600" />
        <h1 className="text-2xl font-bold text-slate-900">Video Tutorials</h1>
      </div>
      <p className="text-sm text-slate-500">Watch step-by-step video guides on using SkyBooks accounting features.</p>

      <div className="grid sm:grid-cols-2 gap-4">
        {VIDEOS.map(v => (
          <div key={v.title} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 hover:shadow-md transition-all group cursor-pointer">
            <div className="flex items-start gap-4">
              <div className="w-16 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Play className="w-5 h-5 text-white fill-white" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900">{v.title}</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{v.desc}</p>
                <span className="text-[11px] text-slate-400 font-medium mt-1 inline-block">{v.duration}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
