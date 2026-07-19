import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    q: 'Is SkyBooks suitable for small businesses?',
    a: 'Absolutely. SkyBooks is designed specifically for Nigerian SMEs. Whether you are a freelancer, a startup, or an established enterprise, our platform scales with your business. The Starter plan is free forever.',
  },
  {
    q: 'How does the Nigerian tax engine work?',
    a: 'SkyBooks automatically computes VAT (7.5%), WHT, PAYE, CIT, NSITF, ITF, and NHIF based on your transactions. The system generates the appropriate journal entries and produces ready-to-file returns in the required FIRS format.',
  },
  {
    q: 'Can I connect my bank accounts?',
    a: 'Yes. SkyBooks integrates with all major Nigerian banks via secure open banking APIs. Your bank transactions are automatically imported and categorized for reconciliation.',
  },
  {
    q: 'Do you support multi-currency transactions?',
    a: 'Yes. SkyBooks supports USD, EUR, GBP, and other major currencies. Exchange rates are auto-fetched from the CBN, and transactions are recorded in the original currency with NGN equivalents.',
  },
  {
    q: 'How secure is my data?',
    a: 'SkyBooks uses bank-grade encryption (AES-256 at rest, TLS 1.3 in transit), SOC 2 compliant infrastructure, and role-based access control. Your financial data is backed up daily across multiple regions.',
  },
  {
    q: 'Can I generate IFRS-compliant financial statements?',
    a: 'Yes. SkyBooks automatically generates Profit & Loss, Balance Sheet, Cash Flow Statement, Statement of Changes in Equity, and Trial Balance in full compliance with IFRS and Nigerian GAAP. Notes to accounts are also auto-generated.',
  },
];

export function FAQsSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section id="faqs" className="py-16 lg:py-24 bg-white">
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
              className="bg-white rounded-xl border border-slate-200 overflow-hidden transition-all duration-200 hover:border-slate-300"
            >
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <span className="text-sm font-medium text-[#082F49] pr-4">{faq.q}</span>
                <ChevronDown
                  size={16}
                  className={`text-slate-400 shrink-0 transition-transform duration-200 ${openIdx === i ? 'rotate-180' : ''}`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ${
                  openIdx === i ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <p className="px-5 pb-4 text-sm text-slate-500 leading-relaxed">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
