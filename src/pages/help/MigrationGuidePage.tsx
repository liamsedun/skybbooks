import React from 'react';
import { History, ArrowRight, CheckCircle2 } from 'lucide-react';

const STEPS = [
  { step: 1, title: 'Prepare Your Data', desc: 'Export your chart of accounts, customer/vendor lists, and trial balance from your current accounting software. Accepted formats: CSV, Excel, or direct database export.' },
  { step: 2, title: 'Upload Legacy File', desc: 'Go to Settings → Legacy Import and upload your exported file. The system accepts CSV files with financial data including account codes, balances, and transaction history.' },
  { step: 3, title: 'Map Your Accounts', desc: 'The system will attempt to auto-map your legacy account codes to SkyBooks accounts. Review and adjust mappings as needed. Unmapped accounts can be created on the fly.' },
  { step: 4, title: 'Preview Migration', desc: 'Review a preview of all data that will be migrated — opening balances, customer/vendor records, outstanding invoices, and uncleared payments. Verify totals match your legacy system.' },
  { step: 5, title: 'Execute Migration', desc: 'Run the migration. The system posts opening balances as journal entries through the 207000 Bank Clearing Suspense account. All migrated data is tagged for audit trail purposes.' },
  { step: 6, title: 'Verify & Go Live', desc: 'Generate a Trial Balance and compare it with your legacy system report. Check customer balances, vendor balances, and bank accounts. Once confirmed, begin using SkyBooks for new transactions.' },
];

const TIPS = [
  'Ensure all account codes are consistent with SkyBooks chart structure (numeric codes recommended)',
  'Clean up duplicate customer/vendor records before export',
  'Close all open periods in your legacy system before extracting final balances',
  'Keep your legacy system accessible for 30 days post-migration for reference',
  'Run a parallel Trial Balance for the first period to catch any discrepancies',
];

export function MigrationGuidePage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <History className="w-6 h-6 text-indigo-600" />
        <h1 className="text-2xl font-bold text-slate-900">Migration Guide</h1>
      </div>
      <p className="text-sm text-slate-500">Step-by-step guide to migrating your financial data from a legacy system to SkyBooks.</p>

      <div className="space-y-0">
        {STEPS.map(s => (
          <div key={s.step} className="flex gap-5">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold shrink-0">{s.step}</div>
              {s.step < STEPS.length && <div className="w-0.5 flex-1 bg-indigo-100 my-1" />}
            </div>
            <div className="pb-8 flex-1">
              <h3 className="font-semibold text-slate-900">{s.title}</h3>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-amber-50 rounded-2xl border border-amber-200/80 p-5">
        <h3 className="font-semibold text-amber-900 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Tips for a Smooth Migration</h3>
        <ul className="mt-3 space-y-2">
          {TIPS.map(t => (
            <li key={t} className="text-sm text-amber-800 flex items-start gap-2"><ArrowRight className="w-3.5 h-3.5 mt-0.5 shrink-0" />{t}</li>
          ))}
        </ul>
      </div>

      <div className="bg-indigo-50 rounded-2xl border border-indigo-200/80 p-5 text-sm text-indigo-800">
        <strong>Need help?</strong> Contact our support team via the Help & Support menu for assistance with your migration.
      </div>
    </div>
  );
}
