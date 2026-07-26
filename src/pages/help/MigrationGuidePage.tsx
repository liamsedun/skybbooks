import React from 'react';
import { History, ArrowRight, CheckCircle2, Database, Upload, Users, Building2, FileSpreadsheet, ExternalLink, BookOpen } from 'lucide-react';

export function MigrationGuidePage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <History className="w-6 h-6 text-indigo-600" />
        <h1 className="text-2xl font-bold text-slate-900">Migration Guide</h1>
      </div>
      <p className="text-sm text-slate-500">How to migrate your financial data from a legacy system to SkyBooks and start using the app.</p>

      {/* What Happens After Registration */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-500" /> What Happens After You Register</h2>
        <p className="text-sm text-slate-600">When you sign up (<code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">POST /auth/signup</code>), the system automatically provisions everything in a single database transaction:</p>
        <ul className="space-y-3 text-sm text-slate-600">
          <li className="flex items-start gap-2.5"><span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span><span><strong className="text-slate-900">Organisation + Owner Account</strong> — Your organisation is created and you are set as the owner with full access.</span></li>
          <li className="flex items-start gap-2.5"><span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span><span><strong className="text-slate-900">Subscription</strong> — If you selected a plan, a subscription is activated (free trial or active). If no plan was selected, a free plan is auto-assigned.</span></li>
          <li className="flex items-start gap-2.5"><span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span><span><strong className="text-slate-900">Chart of Accounts</strong> — 130+ IFRS-compliant Nigerian accounts are seeded automatically (assets, liabilities, equity, revenue, expenses, including all statutory accounts).</span></li>
          <li className="flex items-start gap-2.5"><span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">4</span><span><strong className="text-slate-900">Welcome Email</strong> — A branded email is sent with a Quick Start Guide covering your first 4 steps.</span></li>
          <li className="flex items-start gap-2.5"><span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">5</span><span><strong className="text-slate-900">JWT Tokens</strong> — You are logged in immediately and redirected to <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">/app/dashboard</code>.</span></li>
        </ul>
        <div className="bg-amber-50 rounded-xl border border-amber-200/80 p-4 text-sm text-amber-800">
          <strong className="text-amber-900">Note:</strong> The dashboard shows 8 KPI metric cards (all at zero initially) and a financial chart. There is no guided onboarding wizard — you navigate to each module to set up your data.
        </div>
      </section>

      {/* Six-Step Migration Process */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Database className="w-5 h-5 text-indigo-500" /> The 6-Step Migration Process</h2>
        <p className="text-sm text-slate-600">Follow these steps to bring your legacy accounting data into SkyBooks.</p>

        <div className="space-y-0">
          {[
            { step: 1, title: 'Prepare Your Data', desc: 'Export your chart of accounts, customer/vendor lists, and trial balance from your current accounting software. Accepted formats: CSV, Excel, or direct database export. Ensure all account codes are numeric and consistent.', icon: FileSpreadsheet },
            { step: 2, title: 'Upload Legacy File', desc: 'Go to Settings → Legacy Import and upload your exported file. The system accepts CSV files with financial data including account codes, balances, and transaction history.', icon: Upload },
            { step: 3, title: 'Map Your Accounts', desc: 'The system auto-maps your legacy account codes to SkyBooks accounts. Review and adjust mappings as needed. Unmapped accounts can be created on the fly.', icon: BookOpen },
            { step: 4, title: 'Preview Migration', desc: 'Review a preview of all data to be migrated — opening balances, customer/vendor records, outstanding invoices, and uncleared payments. Verify totals match your legacy system.', icon: Building2 },
            { step: 5, title: 'Execute Migration', desc: 'Run the migration. The system posts opening balances as journal entries through the 207000 Bank Clearing Suspense account. All migrated data is tagged for audit trail purposes.', icon: Database },
            { step: 6, title: 'Verify & Go Live', desc: 'Generate a Trial Balance and compare with your legacy system. Check customer balances, vendor balances, and bank accounts. Once confirmed, begin using SkyBooks for all new transactions.', icon: CheckCircle2 },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.step} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold shrink-0">{s.step}</div>
                  {i < 5 && <div className="w-0.5 flex-1 bg-indigo-100 my-1" />}
                </div>
                <div className="pb-6 flex-1">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Icon className="w-4 h-4 text-indigo-500" />{s.title}</h3>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Bringing in Opening Balances */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Building2 className="w-5 h-5 text-rose-500" /> Bringing in Your Old Accounting Balances</h2>
        <p className="text-sm text-slate-600">SkyBooks provides multiple entry points to import legacy balances. Each method creates journal entries through the <strong>207000 Bank Clearing Suspense</strong> account to keep the general ledger balanced.</p>

        <div className="space-y-5">
          {/* 1. Legacy Migration Page */}
          <div className="border border-slate-200 rounded-xl p-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Database className="w-4 h-4 text-indigo-500" /> 1. Legacy Migration Page <code className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">/reports/legacy-migration</code></h3>
            <p className="text-sm text-slate-600 mt-1">For entering historical financial statements (Income Statement, Cash Flow, Statement of Changes in Equity) for fiscal years before you started using SkyBooks.</p>
            <ul className="mt-2 text-xs text-slate-500 space-y-1 list-disc list-inside">
              <li>4 data-entry tabs — Revenue, COS, Admin Expenses, Finance Costs, Tax, OCI per fiscal year</li>
              <li>Computed fields (Gross Profit, Operating Profit, PBT, Net Profit) auto-calculate</li>
              <li>Lock/unlock each statement to prevent accidental edits after finalization</li>
              <li>Sets <code className="text-[10px] bg-slate-100 px-1">liveGlStartFiscalYear</code> (first year of live GL transactions) and <code className="text-[10px] bg-slate-100 px-1">legacySystemName</code> (e.g. "QuickBooks")</li>
              <li>Feeds into <strong>Comparative Reports</strong> — prior-year columns show your legacy data alongside current figures</li>
              <li>Export each statement as PDF or CSV</li>
            </ul>
          </div>

          {/* 2. Chart of Accounts CSV */}
          <div className="border border-slate-200 rounded-xl p-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2"><FileSpreadsheet className="w-4 h-4 text-emerald-500" /> 2. Chart of Accounts CSV Import <code className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">/accountant/chart-of-accounts</code></h3>
            <p className="text-sm text-slate-600 mt-1">Upload a CSV with your chart of accounts including opening balances.</p>
            <ul className="mt-2 text-xs text-slate-500 space-y-1 list-disc list-inside">
              <li>Required columns: <code className="text-[10px] bg-slate-100 px-1">code</code>, <code className="text-[10px] bg-slate-100 px-1">name</code>, <code className="text-[10px] bg-slate-100 px-1">type</code>, <code className="text-[10px] bg-slate-100 px-1">sub type</code>, <code className="text-[10px] bg-slate-100 px-1">opening balance</code></li>
              <li>System creates accounts and posts a single opening-balance journal entry (dated <code className="text-[10px] bg-slate-100 px-1">1970-01-01</code>, source <code className="text-[10px] bg-slate-100 px-1">opening_balance</code>)</li>
              <li>DR asset/expense accounts, CR liability/equity/revenue accounts</li>
              <li>Total debits <strong>must</strong> equal total credits, otherwise the import is rejected</li>
              <li>Parent-child account relationships supported via <code className="text-[10px] bg-slate-100 px-1">parent code</code> column</li>
            </ul>
          </div>

          {/* 3. Bank Accounts */}
          <div className="border border-slate-200 rounded-xl p-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Building2 className="w-4 h-4 text-sky-500" /> 3. Bank Accounts <code className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">/banking</code></h3>
            <p className="text-sm text-slate-600 mt-1">Three ways to set bank opening balances:</p>
            <ul className="mt-2 text-xs text-slate-500 space-y-1 list-disc list-inside">
              <li><strong>On creation</strong> — Set <code className="text-[10px] bg-slate-100 px-1">currentBalance</code> when adding a bank account. Non-zero balance auto-creates a JE (DR/CR Bank GL account ↔ 207000 Bank Clearing Suspense)</li>
              <li><strong>Manual adjustment</strong> — Use the balance adjustment form. Delta creates a JE through the clearing account. Sets <code className="text-[10px] bg-slate-100 px-1">openingBalanceDate</code> on first-time setup.</li>
              <li><strong>CSV import</strong> — <code className="text-[10px] bg-slate-100 px-1">POST /banking/accounts/import-opening-balances</code> with <code className="text-[10px] bg-slate-100 px-1">{'{'} bankIdentifier, openingBalance {'}'}</code></li>
            </ul>
          </div>

          {/* 4. Customers */}
          <div className="border border-slate-200 rounded-xl p-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Users className="w-4 h-4 text-emerald-500" /> 4. Customers <code className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">/sales/customers</code></h3>
            <p className="text-sm text-slate-600 mt-1">Import customer records with outstanding balances.</p>
            <ul className="mt-2 text-xs text-slate-500 space-y-1 list-disc list-inside">
              <li><strong>On create</strong> — If <code className="text-[10px] bg-slate-100 px-1">balance {'>'} 0</code>, creates JE (DR Receivables, CR Retained Earnings — "Contra — opening balance")</li>
              <li><strong>CSV re-import</strong> — Matching by name+org, updates existing customer (merges fields, adds delta to balance)</li>
              <li>Auto-generates customer code <code className="text-[10px] bg-slate-100 px-1">CS-XXXX</code> per org</li>
            </ul>
          </div>

          {/* 5. Vendors */}
          <div className="border border-slate-200 rounded-xl p-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Building2 className="w-4 h-4 text-amber-500" /> 5. Vendors <code className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">/purchases/vendors</code></h3>
            <p className="text-sm text-slate-600 mt-1">Import vendor records with outstanding payables.</p>
            <ul className="mt-2 text-xs text-slate-500 space-y-1 list-disc list-inside">
              <li><strong>On create</strong> — <code className="text-[10px] bg-slate-100 px-1">balance</code> field creates JE (DR Retained Earnings, CR Payables — "Vendor opening balance")</li>
              <li><strong>CSV import</strong> — Flexible column matching: <code className="text-[10px] bg-slate-100 px-1">name</code>, <code className="text-[10px] bg-slate-100 px-1">email</code>, <code className="text-[10px] bg-slate-100 px-1">phone</code>, <code className="text-[10px] bg-slate-100 px-1">opening balance</code>/<code className="text-[10px] bg-slate-100 px-1">balance</code>, and more</li>
            </ul>
          </div>

          {/* 6. Trial Balance Bulk Import */}
          <div className="border border-slate-200 rounded-xl p-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2"><FileSpreadsheet className="w-4 h-4 text-purple-500" /> 6. Trial Balance Bulk Import <code className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">/reports/trial-balance</code></h3>
            <p className="text-sm text-slate-600 mt-1">Three bulk methods to set opening balances across all accounts at once:</p>
            <ul className="mt-2 text-xs text-slate-500 space-y-1 list-disc list-inside">
              <li><strong>CSV</strong> — Upload with account code + amount. Must balance. Creates JEs.</li>
              <li><strong>JSON</strong> — Submit <code className="text-[10px] bg-slate-100 px-1">POST /reports/trial-balance/record-opening-balances</code> with account/code pairs</li>
              <li><strong>Direct set</strong> — <code className="text-[10px] bg-slate-100 px-1">POST /reports/trial-balance/set-opening-balances</code> sets <code className="text-[10px] bg-slate-100 px-1">accounts.openingBalance</code> directly (no JE created)</li>
            </ul>
          </div>
        </div>

        <div className="bg-indigo-50 rounded-xl border border-indigo-200/80 p-4 text-sm text-indigo-800">
          <strong className="text-indigo-900">Key Concept — Bank Clearing Suspense (207000):</strong> All opening balance imports create journal entries through this account as the contra side. This ensures the GL always balances and gives you a single account to review for any uncleared migration entries.
        </div>
      </section>

      {/* Tips */}
      <section className="bg-amber-50 rounded-2xl border border-amber-200/80 p-5 space-y-3">
        <h3 className="font-semibold text-amber-900 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Tips for a Smooth Migration</h3>
        <ul className="space-y-2">
          {[
            'Ensure all account codes are consistent with SkyBooks chart structure (numeric codes recommended)',
            'Clean up duplicate customer/vendor records before export',
            'Close all open periods in your legacy system before extracting final balances',
            'Keep your legacy system accessible for 30 days post-migration for reference',
            'Run a parallel Trial Balance for the first period to catch any discrepancies',
            'Reconcile the 207000 Bank Clearing Suspense account to zero after all migrations are verified',
            'Import in this order: COA/bank accounts first, then customers and vendors, then trial balance bulk import last',
            'Verify customer and vendor balance reports match your legacy system before processing new transactions',
          ].map(t => (
            <li key={t} className="text-sm text-amber-800 flex items-start gap-2"><ArrowRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />{t}</li>
          ))}
        </ul>
      </section>

      {/* Post-Migration Checklist */}
      <section className="bg-emerald-50 rounded-2xl border border-emerald-200/80 p-5 space-y-3">
        <h3 className="font-semibold text-emerald-900 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Post-Migration Verification Checklist</h3>
        <ul className="space-y-1.5 text-sm text-emerald-800">
          <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Trial Balance total debits = total credits</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Customer outstanding balances match legacy system AR report</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Vendor outstanding balances match legacy system AP report</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Bank account balances match latest bank statements</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> 207000 Bank Clearing Suspense account is zero (all migration entries cleared)</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Income Statement and Balance Sheet generate without errors</li>
        </ul>
      </section>

      {/* Still need help */}
      <div className="bg-indigo-50 rounded-2xl border border-indigo-200/80 p-5 text-sm text-indigo-800 flex items-start gap-3">
        <ExternalLink className="w-4 h-4 mt-0.5 shrink-0" />
        <div><strong>Need help?</strong> Contact our support team via the in-app chat widget (bottom-right corner) or email <a href="mailto:hello@skyaccounting.com.ng" className="underline font-medium">hello@skyaccounting.com.ng</a>. Our team can also assist with the migration process if needed.</div>
      </div>
    </div>
  );
}
