import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

const faqs = [
  {
    q: 'What is SkyBooks?',
    a: 'SkyBooks is a cloud-based accounting platform built specifically for Nigerian SMEs. It handles invoicing, expense tracking, bank reconciliation, inventory, payroll, multi-currency, and all Nigerian statutory taxes (VAT, WHT, PAYE, CIT, NSITF, ITF, NHF). Financial reports are generated in full IFRS compliance.',
  },
  {
    q: 'Can I migrate from Excel?',
    a: 'Yes. SkyBooks has a built-in legacy migration tool that imports your chart of accounts, customer and vendor lists, opening balances, and historical transactions from Excel. The system maps your data structure during import and creates opening journal entries through our clearing account to ensure accurate trial balances from day one.',
  },
  {
    q: 'Can I migrate from QuickBooks?',
    a: 'Yes. SkyBooks supports direct migration from QuickBooks. Export your chart of accounts, customer/vendor list, and trial balance from QuickBooks, then use our legacy import wizard to upload and map the data. The migration engine normalises your chart, reconciles opening balances, and preserves your audit trail.',
  },
  {
    q: 'How secure is my data?',
    a: 'Your data is protected with AES-256 encryption at rest and TLS 1.3 in transit. Our infrastructure is hosted on SOC 2-compliant cloud providers with geo-redundant daily backups and a 30-day retention policy. Role-based access controls, immutable audit trails, and 2FA ensure only authorised users can access your financial records.',
  },
  {
    q: 'Is VAT supported?',
    a: 'Yes. SkyBooks handles the full VAT lifecycle — automatic computation at 7.5% on applicable transactions, VAT inclusive/exclusive pricing, input VAT tracking on purchases, and output VAT on sales. The system generates VAT returns in the FIRS-required format and posts all VAT journals automatically.',
  },
  {
    q: 'Does it support Nigerian taxes?',
    a: 'Absolutely. SkyBooks has a comprehensive Nigerian Tax Engine covering VAT (7.5%), WHT (withholding tax at applicable rates), PAYE (with graduated Nigerian tax bands up to 24%), CIT (company income tax), NSITF (1% employer), ITF (1% annual payroll), NHF (2.5% of basic salary), and Stamp Duty (₦50 on qualifying transactions). All taxes are computed automatically and posted as journals.',
  },
  {
    q: 'Can I manage multiple companies?',
    a: 'Yes. The Enterprise plan supports multi-entity consolidation. You can manage multiple companies under one account, each with its own chart of accounts, bank connections, and users. The consolidated reporting engine aggregates financials across entities for group-level P&L, Balance Sheet, and Cash Flow statements.',
  },
  {
    q: 'Is there a mobile app?',
    a: 'SkyBooks is fully responsive and works seamlessly on all devices through your browser. You can create invoices, approve payments, check reports, and reconcile transactions from your phone or tablet. A dedicated mobile app for iOS and Android is on our roadmap.',
  },
  {
    q: 'Can I use multiple currencies?',
    a: 'Yes. SkyBooks supports transactions in NGN, USD, EUR, GBP, and other major currencies. Exchange rates are auto-fetched from the CBN, and every transaction is recorded in both the original currency and NGN equivalent. Multi-currency reporting shows amounts in both the transaction currency and your base currency.',
  },
  {
    q: 'Can I invite my accountant?',
    a: 'Yes. SkyBooks has role-based access control. You can invite your external accountant as a user with specific permissions — read-only access to reports, full access to journals, or admin privileges. They get their own login and can work alongside your team without compromising security.',
  },
  {
    q: 'Can I integrate my bank?',
    a: 'Yes. SkyBooks connects to all major Nigerian banks through secure open banking APIs. Once linked, your bank transactions are automatically imported daily, categorised using AI, and presented for reconciliation. Supported banks include GTBank, Access Bank, UBA, First Bank, Zenith, Providus, and many more.',
  },
];

export const FAQsSection = React.memo(function FAQsSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section id="faqs" className="py-16 lg:py-24 bg-white section-auto">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-widest">FAQs</span>
          <h2 className="mt-3 text-3xl lg:text-4xl font-bold text-[#082F49]">
            Frequently asked questions
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
              <div
                key={i}
                className={`group bg-white rounded-xl border overflow-hidden transition-all duration-200 hover:shadow-sm ${
                  openIdx === i ? 'border-[#0EA5E9]/30 shadow-sm' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <button
                  onClick={() => setOpenIdx(openIdx === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left gap-3"
                >
                  <span className="flex items-center gap-3 text-sm font-medium text-[#082F49]">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors duration-200 ${
                      openIdx === i ? 'bg-[#0EA5E9] text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                    }`}>
                      <HelpCircle size={11} />
                    </span>
                    {faq.q}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-slate-400 shrink-0 transition-transform duration-200 ${openIdx === i ? 'rotate-180' : ''}`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    openIdx === i ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="px-5 pb-4 pl-12">
                    <p className="text-sm text-slate-500 leading-relaxed">{faq.a}</p>
                  </div>
                </div>
              </div>
          ))}
        </div>
      </div>
    </section>
  );
});

