import React from 'react';
import { BookOpen, Search } from 'lucide-react';

const HELP_TOPICS = [
  { title: 'Getting Started', icon: '🚀', content: 'Create your organisation, invite team members, and set up your chart of accounts. Configure your fiscal year, base currency, and tax settings.' },
  { title: 'Chart of Accounts', icon: '📊', content: 'Add, edit, and manage your chart of accounts. Set up parent-child account relationships, import accounts via CSV, and view balances with debit/credit columns.' },
  { title: 'Invoices & Sales', icon: '🧾', content: 'Create and send invoices to customers. Accept payments, issue credit notes, and manage recurring invoices. Bulk-send invoices and track payment status.' },
  { title: 'Bills & Purchases', icon: '📦', content: 'Record bills from vendors, track expenses, manage purchase orders with approval workflow (draft → confirmed → accepted → approved).' },
  { title: 'Banking & Reconciliation', icon: '🏦', content: 'Connect bank feeds via Paystack/Flutterwave/Moniepoint, reconcile transactions, transfer between accounts, and manage currency rates.' },
  { title: 'Payroll Management', icon: '👥', content: 'Manage employees, run payroll, generate PAYE schedules, pension schedules, and payslips. Auto-computes Nigerian statutory deductions.' },
  { title: 'Fixed Assets & Depreciation', icon: '🏗️', content: 'Register fixed assets, set depreciation methods (straight-line/declining-balance), run monthly depreciation, dispose assets, and manage CWIP.' },
  { title: 'Reports & Analytics', icon: '📈', content: 'Generate Trial Balance, Income Statement, Balance Sheet, Cash Flow Statement, SOCIE, VAT Return, Aged Receivables/Payables, and custom reports.' },
  { title: 'Multi-Currency', icon: '💱', content: 'Record transactions in foreign currencies. Select currency per transaction, auto-fill exchange rates, and view base-currency equivalents.' },
  { title: 'IFRS 15 Revenue Recognition', icon: '📋', content: 'Create revenue contracts with performance obligations, generate recognition schedules, and post JE entries point-in-time or over-time.' },
  { title: 'IFRS 16 Lease Accounting', icon: '📄', content: 'Record leases, calculate PV of lease payments, post commencement entries, process payments, post depreciation, modify or terminate leases.' },
  { title: 'Audit Trail', icon: '🔍', content: 'View all changes made across the system with user details, timestamps, IP addresses, and before/after diff views. Export audit logs as CSV or PDF.' },
  { title: 'Tax Engine', icon: '💰', content: 'Manage PAYE schedules, ITF assessments, Stamp Duty records, Tax Exemptions, and FIRS reports. Auto-post tax journal entries.' },
  { title: 'VAT Return', icon: '📑', content: 'Compute VAT payable/receivable based on sales and purchases. File VAT returns and track filing history.' },
  { title: 'SKYHRM Entry Point & Setup', icon: '👤', content: 'Entry at /app/hr/home/overview. Sidebar group visible only when user role has hrm module access (owners, admins, hr role). Setup hub at /app/hr/manage (6 tabs: Users, Employee Profiles, Organisation Setup with 8 sub-tabs, User Access Control, Approvals, Services). Recommended sequence: (1) Configure Departments & Designations, (2) HR Settings toggles (8 options), (3) Leave Types & Policies, (4) Attendance Configuration, (5) Approval Engine, (6) Onboarding Templates. HR schema auto-created on startup — no manual DB setup required.' },
];

export function HelpDocumentsPage() {
  const [search, setSearch] = React.useState('');
  const filtered = search ? HELP_TOPICS.filter(t => t.title.toLowerCase().includes(search.toLowerCase())) : HELP_TOPICS;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <BookOpen className="w-6 h-6 text-indigo-600" />
        <h1 className="text-2xl font-bold text-slate-900">Help Documents</h1>
      </div>
      <p className="text-sm text-slate-500">Browse documentation on how to use SkyBooks accounting system.</p>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Search help topics..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
      </div>

      <div className="grid gap-4">
        {filtered.map(topic => (
          <div key={topic.title} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2"><span>{topic.icon}</span>{topic.title}</h3>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed">{topic.content}</p>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No matching topics found.</p>}
      </div>
    </div>
  );
}
