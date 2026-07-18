import React from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';

const FAQS = [
  { q: 'How do I create an invoice?', a: 'Go to Sales → Invoices, click "+New Invoice", fill in customer details, add line items, and click Save. You can then send the invoice directly from the detail view.' },
  { q: 'How do I import opening balances?', a: 'Navigate to Reports → Trial Balance, click "Opening Balances" → "Import Opening Balances". Download the sample CSV template, fill in your account codes and balances, then upload.' },
  { q: 'How is VAT calculated?', a: 'VAT is computed automatically based on your transaction amounts. Go to Reports → VAT Return to see the full computation. The system uses the standard Nigerian VAT rate.' },
  { q: 'Can I record transactions in foreign currency?', a: 'Yes. Use the Currency Selector dropdown on any transaction form (Invoice, Bill, Expense, etc.). The system auto-fills exchange rates and stores both foreign and base-currency amounts.' },
  { q: 'How do I add new employees?', a: 'Go to Payroll → Employees, click "+New", enter employee details and statutory information. You can also import employees via CSV.' },
  { q: 'What is the Trial Balance?', a: 'The Trial Balance shows all account balances for a given period. It includes debit/credit columns, parent-child account rollups, and drill-down links to customers, vendors, and journals.' },
  { q: 'How do I reverse a journal entry?', a: 'Open Manual Journals, find the entry, click the "Reverse" button in the detail view. A reversing entry will be created automatically.' },
  { q: 'How does bank reconciliation work?', a: 'Connect your bank via Paystack/Flutterwave/Moniepoint in Banking → Connections. Imported transactions appear in Bank Feed Reconciler where you can match them against system entries.' },
  { q: 'What reports are available?', a: 'SkyBooks includes Trial Balance, Income Statement, Balance Sheet, Cash Flow Statement, SOCIE, VAT Return, Aged Receivables/Payables, General Ledger, Custom Reports, and more.' },
  { q: 'How do I set up payroll taxes?', a: 'PAYE, NHF, NSITF, and ITF are computed automatically when you run payroll. Go to Payroll → Payroll Runs to process. Tax rates follow Nigerian statutory guidelines.' },
  { q: 'Can I export reports to Excel?', a: 'Yes. Most reports have a Download button with options for CSV and PDF. Balance Sheet, Income Statement, and Cash Flow also support Excel format.' },
  { q: 'What is a parent account?', a: 'A parent account is a grouping account that aggregates balances from its child accounts. Parent accounts themselves do not contribute to totals to avoid double-counting.' },
];

export function FAQsPage() {
  const [openIdx, setOpenIdx] = React.useState<number | null>(null);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <HelpCircle className="w-6 h-6 text-indigo-600" />
        <h1 className="text-2xl font-bold text-slate-900">Frequently Asked Questions</h1>
      </div>

      <div className="space-y-2">
        {FAQS.map((faq, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <button onClick={() => setOpenIdx(openIdx === i ? null : i)}
              className="w-full flex items-center justify-between p-4 text-left text-sm font-medium text-slate-900 hover:bg-slate-50 transition-colors">
              <span>{faq.q}</span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${openIdx === i ? 'rotate-180' : ''}`} />
            </button>
            {openIdx === i && (
              <div className="px-4 pb-4 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">{faq.a}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
