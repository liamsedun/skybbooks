import React, { useState } from 'react';
import {
  Building2, Paintbrush, Globe, MapPinned, Users, Shield, UserCog,
  Settings, CreditCard, Clock, Scale, Bell, Store, Boxes, Hash,
  LayoutTemplate, Mail, Tag, Layers, Zap, ListChecks, History, Timer,
  Package, BarChart2, FileText, FileClock, Repeat, ReceiptText, Banknote,
  FileCheck, Truck, ClipboardList, ArrowLeftRight, Wallet, PuzzleIcon,
  ShoppingCart, Receipt, ToggleLeft, Download, Upload, Link,
  Lightbulb, Eye, Pencil, Trash2, Plus, Check, X, AlertCircle,
} from 'lucide-react';

function PageShell({ title, desc, icon: Icon, children }: { title: string; desc?: string; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
          {Icon && <Icon className="w-6 h-6 text-slate-400" />}
          {title}
        </h1>
        {desc && <p className="text-sm text-slate-500 mt-1 ml-0">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 mb-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {desc && <p className="text-xs text-slate-400 mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({ label, desc, defaultChecked }: { label: string; desc?: string; defaultChecked?: boolean }) {
  const [on, setOn] = useState(defaultChecked ?? false);
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {desc && <p className="text-xs text-slate-400">{desc}</p>}
      </div>
      <button
        onClick={() => setOn(!on)}
        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${on ? 'bg-indigo-600' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

function Field({ label, desc, ...props }: { label: string; desc?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      <input
        {...props}
        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 placeholder-slate-400 transition-shadow"
      />
      {desc && <p className="text-xs text-slate-400 mt-1">{desc}</p>}
    </div>
  );
}

function Select({ label, desc, options, value, onChange }: { label: string; desc?: string; options: { value: string; label: string }[]; value?: string; onChange?: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={e => onChange?.(e.target.value)}
        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {desc && <p className="text-xs text-slate-400 mt-1">{desc}</p>}
    </div>
  );
}

function SaveBar({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
      {children}
      <button className="px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">
        Save Changes
      </button>
    </div>
  );
}

// ─── Organisation Settings (Profile) ───────────────────────────────────────
export function OrganisationProfilePage() {
  return (
    <PageShell title="Organisation Settings" desc="Update your company profile, tax identifiers, and fiscal configuration." icon={Building2}>
      <Section title="Company Identity" desc="Your business name and contact details appear on invoices and documents.">
        <div className="flex items-center gap-5 pb-4 border-b border-slate-100">
          <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden shrink-0">
            <Building2 size={28} className="text-slate-300" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">Company Logo</p>
            <p className="text-xs text-slate-400 mt-0.5 mb-2">PNG or JPG, max 2MB. Appears on invoices.</p>
            <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition">
              <Upload size={14} /> Upload Logo
              <input type="file" accept="image/png,image/jpeg" className="hidden" />
            </label>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div className="sm:col-span-2">
            <Field label="Legal Business Name" placeholder="Skyhouse Technologies Ltd" defaultValue="My Company Ltd" />
          </div>
          <Field label="Business Email" type="email" placeholder="hello@company.ng" />
          <Field label="Phone Number" placeholder="+234 801 234 5678" />
          <div className="sm:col-span-2">
            <Field label="Registered Address" placeholder="12 Bode Thomas Road, Surulere, Lagos" desc="Appears on invoices and official documents." />
          </div>
          <div className="sm:col-span-2">
            <Field label="Website" placeholder="https://www.yourcompany.com" />
          </div>
        </div>
      </Section>

      <Section title="Tax & Compliance" desc="Federal Inland Revenue Service and CAC registration details.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="RC Number (CAC)" placeholder="RC-1234567" desc="Companies and Allied Matters Act registration." />
          <Field label="VAT / TIN Number (FIRS)" placeholder="TIN-00000000-0001" desc="Federal Inland Revenue Service tax ID." />
          <Field label="Fiscal Year Start" placeholder="01-01 (DD-MM)" desc="Day and month your financial year begins." />
        </div>
      </Section>

      <SaveBar />
    </PageShell>
  );
}

// ─── Branding ──────────────────────────────────────────────────────────────
export function BrandingPage() {
  return (
    <PageShell title="Branding" desc="Customize the look and feel of your customer-facing documents." icon={Paintbrush}>
      <Section title="Logo & Appearance">
        <div className="flex items-center gap-5 pb-4 border-b border-slate-100">
          <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50">
            <Building2 size={28} className="text-slate-300" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">Company Logo</p>
            <p className="text-xs text-slate-400 mb-2">Appears on all customer-facing documents.</p>
            <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg">
              <Upload size={14} /> Upload Logo
              <input type="file" accept="image/png,image/jpeg" className="hidden" />
            </label>
          </div>
        </div>
        <Field label="Company Tagline" placeholder="Your tagline here" desc="Appears below your company name on documents." />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Primary Color" type="text" placeholder="#4F46E5" />
          <Field label="Accent Color" type="text" placeholder="#10B981" />
        </div>
      </Section>
      <Section title="Invoice & Document Customization">
        <ToggleRow label="Show company logo on all documents" defaultChecked />
        <ToggleRow label="Show company signature on invoices" />
        <ToggleRow label="Include payment QR code on invoices" />
      </Section>
      <SaveBar />
    </PageShell>
  );
}

// ─── Custom Domain ─────────────────────────────────────────────────────────
export function CustomDomainPage() {
  return (
    <PageShell title="Custom Domain" desc="Connect your own domain to host your customer portal and documents." icon={Globe}>
      <Section title="Domain Configuration">
        <Field label="Custom Domain" placeholder="books.yourcompany.com" desc="Enter the domain you want to use." />
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-600 space-y-2">
          <p className="font-medium text-slate-800 flex items-center gap-2"><Lightbulb size={14} />DNS Setup Instructions</p>
          <p>Add the following CNAME record to your DNS provider:</p>
          <code className="block bg-white border border-slate-200 rounded px-3 py-2 text-xs font-mono text-indigo-600">
            Type: CNAME<br />Name: books<br />Value: skybooks.app
          </code>
        </div>
      </Section>
      <SaveBar />
    </PageShell>
  );
}

// ─── Locations ─────────────────────────────────────────────────────────────
export function LocationsPage() {
  return (
    <PageShell title="Locations" desc="Manage your business locations for multi-branch operations." icon={MapPinned}>
      <Section title="Your Locations">
        <div className="space-y-3">
          {['Head Office — Lagos', 'Branch Office — Abuja', 'Warehouse — Port Harcourt'].map((loc, i) => (
            <div key={i} className="flex items-center justify-between border border-slate-100 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <MapPinned size={16} className="text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-700">{loc}</p>
                  <p className="text-xs text-slate-400">Address line, city, state</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-1.5 text-slate-400 hover:text-slate-600 transition"><Pencil size={14} /></button>
                <button className="p-1.5 text-slate-400 hover:text-red-500 transition"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
        <button className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition">
          <Plus size={16} /> Add Location
        </button>
      </Section>
      <SaveBar />
    </PageShell>
  );
}

// ─── Users ─────────────────────────────────────────────────────────────────
export function UsersPage() {
  return (
    <PageShell title="Users" desc="Manage team members who have access to your SkyBooks account." icon={Users}>
      <Section title="Team Members">
        <div className="space-y-3">
          {[
            { name: 'Liam Sedun', email: 'liam@company.ng', role: 'Administrator' },
            { name: 'Sarah Johnson', email: 'sarah@company.ng', role: 'Accountant' },
            { name: 'Michael Obi', email: 'michael@company.ng', role: 'Viewer' },
          ].map((u, i) => (
            <div key={i} className="flex items-center justify-between border border-slate-100 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                  {u.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">{u.name}</p>
                  <p className="text-xs text-slate-400">{u.email} · {u.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${i === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{i === 0 ? 'Active' : 'Invited'}</span>
              </div>
            </div>
          ))}
        </div>
        <button className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition">
          <Plus size={16} /> Invite User
        </button>
      </Section>
    </PageShell>
  );
}

// ─── Roles ─────────────────────────────────────────────────────────────────
export function RolesPage() {
  return (
    <PageShell title="Roles" desc="Define access permissions for different user roles." icon={Shield}>
      <Section title="Roles & Permissions">
        {['Administrator', 'Accountant', 'Viewer'].map((role, i) => (
          <div key={i} className="border border-slate-200 rounded-lg p-4 mb-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-slate-800">{role}</span>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                i === 0 ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {i === 0 ? 'Full Access' : i === 1 ? 'Restricted' : 'Read Only'}
              </span>
            </div>
            <div className="space-y-1.5">
              {['Sales', 'Purchases', 'Accounting', 'Reports', 'Settings'].map(m => (
                <div key={m} className="flex items-center justify-between text-xs text-slate-600">
                  <span>{m}</span>
                  <span className={`font-medium ${i === 0 ? 'text-emerald-600' : i === 2 ? 'text-slate-400' : 'text-amber-600'}`}>
                    {i === 0 ? 'Full Access' : i === 2 ? 'View Only' : 'Create & Edit'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Section>
    </PageShell>
  );
}

// ─── User Preferences ──────────────────────────────────────────────────────
export function UserPreferencesPage() {
  return (
    <PageShell title="User Preferences" desc="Configure your personal app preferences." icon={UserCog}>
      <Section title="Preferences">
        <Select label="Language" options={[{ value: 'en', label: 'English' }, { value: 'fr', label: 'French' }]} value="en" />
        <Select label="Date Format" options={[{ value: 'DD-MM-YYYY', label: 'DD-MM-YYYY' }, { value: 'MM-DD-YYYY', label: 'MM-DD-YYYY' }]} value="DD-MM-YYYY" />
        <Select label="Number Format" options={[{ value: 'NG', label: '1,234.56 (NG)' }, { value: 'US', label: '1,234.56 (US)' }]} value="NG" />
        <Select label="Timezone" options={[{ value: 'WAT', label: 'West Africa Time (WAT)' }]} value="WAT" />
        <ToggleRow label="Receive email notifications" desc="Get notified about invoices, payments, and updates." defaultChecked />
        <ToggleRow label="Compact sidebar mode" desc="Use a narrower sidebar for more screen space." />
      </Section>
      <SaveBar />
    </PageShell>
  );
}

// ─── General ───────────────────────────────────────────────────────────────
export function GeneralPage() {
  return (
    <PageShell title="General" desc="Configure general system settings." icon={Settings}>
      <Section title="General Settings">
        <Select label="Default Currency" options={[{ value: 'NGN', label: 'NGN - Nigerian Naira' }, { value: 'USD', label: 'USD - US Dollar' }]} value="NGN" />
        <Field label="Default Tax Rate (%)" type="number" placeholder="7.5" desc="Default VAT rate for new transactions." />
        <ToggleRow label="Auto-generate transaction numbers" defaultChecked />
        <ToggleRow label="Allow negative inventory" desc="Permit inventory to go below zero temporarily." />
      </Section>
      <SaveBar />
    </PageShell>
  );
}

// ─── Currencies ────────────────────────────────────────────────────────────
export function CurrenciesPage() {
  return (
    <PageShell title="Currencies" desc="Manage currencies used in your account." icon={CreditCard}>
      <Section title="Active Currencies">
        <div className="space-y-2">
          {[
            { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', rate: '1.0000' },
            { code: 'USD', name: 'US Dollar', symbol: '$', rate: '1,550.00' },
            { code: 'GBP', name: 'British Pound', symbol: '£', rate: '1,980.00' },
            { code: 'EUR', name: 'Euro', symbol: '€', rate: '1,700.00' },
          ].map(c => (
            <div key={c.code} className="flex items-center justify-between border border-slate-100 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-bold">{c.symbol}</span>
                <div>
                  <p className="text-sm font-medium text-slate-700">{c.code} — {c.name}</p>
                  <p className="text-xs text-slate-400">1 {c.code} = ₦{c.rate}</p>
                </div>
              </div>
              <ToggleLeft size={18} className="text-indigo-600" />
            </div>
          ))}
        </div>
      </Section>
      <Section title="Exchange Rates">
        <p className="text-xs text-slate-400">Exchange rates update automatically via our provider. Manual override is also available.</p>
        <button className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition mt-2">
          <RefreshCw size={14} /> Update Exchange Rates
        </button>
      </Section>
    </PageShell>
  );
}

// ─── Payment Terms ─────────────────────────────────────────────────────────
export function PaymentTermsPage() {
  return (
    <PageShell title="Payment Terms" desc="Define payment terms for customers and vendors." icon={Clock}>
      <Section title="Default Payment Terms">
        <div className="space-y-3">
          {[
            { label: 'Due on Receipt', days: 0 },
            { label: 'Net 15', days: 15 },
            { label: 'Net 30', days: 30 },
            { label: 'Net 60', days: 60 },
          ].map(t => (
            <div key={t.days} className="flex items-center justify-between border border-slate-100 rounded-lg px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-700">{t.label}</p>
                <p className="text-xs text-slate-400">Payment due within {t.days} day{t.days !== 1 ? 's' : ''}</p>
              </div>
              <input type="radio" name="default-term" defaultChecked={t.days === 30} className="w-4 h-4 text-indigo-600" />
            </div>
          ))}
        </div>
      </Section>
      <SaveBar />
    </PageShell>
  );
}

// ─── Opening Balances ──────────────────────────────────────────────────────
export function OpeningBalancesPage() {
  return (
    <PageShell title="Opening Balances" desc="Set up opening balances for your accounts." icon={Scale}>
      <Section title="Opening Balance Entry">
        <p className="text-xs text-slate-500 mb-3">Enter the opening balances for your accounts as of the start of your fiscal year.</p>
        <div className="space-y-2">
          {[
            { account: 'CBN Cash Account', balance: '₦ 12,450,000.00' },
            { account: 'GTBank Current Account', balance: '₦ 8,200,000.00' },
            { account: 'Accounts Receivable', balance: '₦ 5,750,000.00' },
          ].map((a, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm text-slate-700">{a.account}</p>
              </div>
              <input type="text" defaultValue={a.balance} className="w-40 px-3 py-2 text-sm border border-slate-200 rounded-lg text-right font-mono" />
            </div>
          ))}
        </div>
      </Section>
      <SaveBar />
    </PageShell>
  );
}

// ─── Reminders ─────────────────────────────────────────────────────────────
export function RemindersPage() {
  return (
    <PageShell title="Reminders" desc="Configure automated payment reminders for overdue invoices." icon={Bell}>
      <Section title="Payment Reminders">
        <ToggleRow label="Enable automatic reminders" desc="Send reminders for overdue invoices automatically." defaultChecked />
        <Field label="First reminder after (days)" type="number" defaultValue="1" placeholder="1" desc="Days after the due date." />
        <Field label="Second reminder after (days)" type="number" defaultValue="7" placeholder="7" />
        <Field label="Final reminder after (days)" type="number" defaultValue="15" placeholder="15" />
        <ToggleRow label="Send reminder via email" defaultChecked />
        <ToggleRow label="Send reminder via SMS" />
      </Section>
      <SaveBar />
    </PageShell>
  );
}

// ─── Customer Portal ───────────────────────────────────────────────────────
export function CustomerPortalPage() {
  return (
    <PageShell title="Customer Portal" desc="Configure your customer self-service portal." icon={Store}>
      <Section title="Portal Settings">
        <ToggleRow label="Enable Customer Portal" desc="Allow customers to view invoices and make payments online." defaultChecked />
        <ToggleRow label="Allow customers to download invoices" defaultChecked />
        <ToggleRow label="Allow customers to make payments via portal" defaultChecked />
        <ToggleRow label="Show payment history" defaultChecked />
        <Field label="Portal custom message" placeholder="Welcome to our billing portal" desc="Shown at the top of the portal login page." />
      </Section>
      <SaveBar />
    </PageShell>
  );
}

// ─── Vendor Portal ─────────────────────────────────────────────────────────
export function VendorPortalPage() {
  return (
    <PageShell title="Vendor Portal" desc="Configure your vendor self-service portal." icon={Boxes}>
      <Section title="Portal Settings">
        <ToggleRow label="Enable Vendor Portal" desc="Allow vendors to view purchase orders and bills online." defaultChecked />
        <ToggleRow label="Allow vendors to submit invoices" />
        <ToggleRow label="Show payment history to vendors" defaultChecked />
        <Field label="Portal custom message" placeholder="Welcome to our vendor portal" />
      </Section>
      <SaveBar />
    </PageShell>
  );
}

// ─── Transaction Number Series ─────────────────────────────────────────────
export function TxnNumberingPage() {
  return (
    <PageShell title="Transaction Number Series" desc="Configure numbering prefixes for your transactions." icon={Hash}>
      <Section title="Numbering Series">
        {[
          { label: 'Invoices', value: 'INV-' },
          { label: 'Quotes', value: 'QTE-' },
          { label: 'Sales Orders', value: 'SO-' },
          { label: 'Purchase Orders', value: 'PO-' },
          { label: 'Bills', value: 'BILL-' },
          { label: 'Payments Received', value: 'PMT-' },
          { label: 'Payments Made', value: 'PM-' },
          { label: 'Credit Notes', value: 'CN-' },
          { label: 'Expenses', value: 'EXP-' },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-4 py-2 border-b border-slate-50 last:border-0">
            <span className="w-36 text-sm text-slate-700">{s.label}</span>
            <input type="text" defaultValue={s.value} className="w-28 px-3 py-1.5 text-sm border border-slate-200 rounded-lg font-mono" />
            <span className="text-xs text-slate-400">Next: {s.value}{String(Math.floor(Math.random() * 9000) + 1000)}</span>
          </div>
        ))}
      </Section>
      <SaveBar />
    </PageShell>
  );
}

// ─── PDF Templates ─────────────────────────────────────────────────────────
export function PdfTemplatesPage() {
  return (
    <PageShell title="PDF Templates" desc="Customize the layout of your PDF documents." icon={LayoutTemplate}>
      <Section title="Document Templates">
        {['Invoice', 'Quote', 'Sales Order', 'Purchase Order', 'Bill', 'Credit Note'].map(t => (
          <div key={t} className="flex items-center justify-between border border-slate-100 rounded-lg px-4 py-3 mb-2">
            <div className="flex items-center gap-3">
              <FileText size={16} className="text-slate-400" />
              <span className="text-sm text-slate-700">{t} Template</span>
            </div>
            <button className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700">
              <Pencil size={13} /> Customize
            </button>
          </div>
        ))}
      </Section>
    </PageShell>
  );
}

// ─── Email Notifications ───────────────────────────────────────────────────
export function EmailNotificationsPage() {
  return (
    <PageShell title="Email Notifications" desc="Configure email notifications sent to customers and vendors." icon={Mail}>
      <Section title="Notification Triggers">
        {[
          'Invoice Sent', 'Payment Received', 'Invoice Overdue', 'Credit Note Issued',
          'Purchase Order Received', 'Bill Due Reminder', 'Quote Accepted', 'Account Statement'
        ].map(n => (
          <div key={n} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
            <span className="text-sm text-slate-700">{n}</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
            </label>
          </div>
        ))}
      </Section>
      <Section title="Email Templates">
        <p className="text-xs text-slate-400">Customize the email body templates sent for each notification type.</p>
        <button className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition mt-2">
          <Pencil size={14} /> Edit Email Templates
        </button>
      </Section>
    </PageShell>
  );
}

// ─── Reporting Tags ────────────────────────────────────────────────────────
export function ReportingTagsPage() {
  return (
    <PageShell title="Reporting Tags" desc="Create and manage tags for categorizing transactions." icon={Tag}>
      <Section title="Tags">
        <div className="flex flex-wrap gap-2">
          {['Marketing', 'Operations', 'Salary', 'Utilities', 'Travel', 'Software', 'Office Supplies', 'Tax'].map(t => (
            <span key={t} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
              <Tag size={12} /> {t}
              <button className="text-slate-400 hover:text-red-500 ml-0.5"><X size={12} /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <input type="text" placeholder="New tag name..." className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg" />
          <button className="px-3 py-2 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700"><Plus size={14} /></button>
        </div>
      </Section>
    </PageShell>
  );
}

// ─── Web Tabs ──────────────────────────────────────────────────────────────
export function WebTabsPage() {
  return (
    <PageShell title="Web Tabs" desc="Manage custom web tabs in your sidebar navigation." icon={Layers}>
      <Section title="Custom Web Tabs">
        <p className="text-xs text-slate-500 mb-3">Add custom links to external tools in your SkyBooks sidebar.</p>
        <div className="space-y-2">
          {[
            { label: 'Support Portal', url: 'https://support.company.ng' },
            { label: 'HR Portal', url: 'https://hr.company.ng' },
          ].map((tab, i) => (
            <div key={i} className="flex items-center justify-between border border-slate-100 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <Link size={14} className="text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-700">{tab.label}</p>
                  <p className="text-xs text-slate-400">{tab.url}</p>
                </div>
              </div>
              <button className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        <button className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700">
          <Plus size={16} /> Add Web Tab
        </button>
      </Section>
    </PageShell>
  );
}

// ─── Workflow Rules ────────────────────────────────────────────────────────
export function WorkflowRulesPage() {
  return (
    <PageShell title="Workflow Rules" desc="Create automated rules to trigger actions based on events." icon={Zap}>
      <Section title="Workflow Rules">
        <div className="space-y-3">
          {[
            { name: 'Flag Large Invoices', trigger: 'Invoice Created > ₦5,000,000', action: 'Notify Admin' },
            { name: 'Auto-Archive Paid Bills', trigger: 'Bill Status = Paid', action: 'Mark as Archived' },
          ].map((r, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-800">{r.name}</span>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full uppercase">Active</span>
              </div>
              <div className="text-xs text-slate-500 space-y-1">
                <p>When: {r.trigger}</p>
                <p>Then: {r.action}</p>
              </div>
            </div>
          ))}
        </div>
        <button className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700">
          <Plus size={16} /> Add Workflow Rule
        </button>
      </Section>
    </PageShell>
  );
}

// ─── Workflow Actions ──────────────────────────────────────────────────────
export function WorkflowActionsPage() {
  return (
    <PageShell title="Workflow Actions" desc="Define actions that can be triggered by workflow rules." icon={ListChecks}>
      <Section title="Available Actions">
        <div className="space-y-3">
          {[
            { name: 'Send Email Notification', desc: 'Send an email to the specified recipients.' },
            { name: 'Update Record Status', desc: 'Change the status of a transaction.' },
            { name: 'Create Task', desc: 'Create a new task for a team member.' },
            { name: 'Send Webhook', desc: 'Send an HTTP request to an external URL.' },
          ].map((a, i) => (
            <div key={i} className="flex items-center justify-between border border-slate-100 rounded-lg px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-700">{a.name}</p>
                <p className="text-xs text-slate-400">{a.desc}</p>
              </div>
              <button className="text-xs font-medium text-indigo-600 hover:text-indigo-700">Configure</button>
            </div>
          ))}
        </div>
      </Section>
    </PageShell>
  );
}

// ─── Workflow Logs ─────────────────────────────────────────────────────────
export function WorkflowLogsPage() {
  return (
    <PageShell title="Workflow Logs" desc="View the execution history of your workflow rules." icon={History}>
      <Section title="Execution History">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-bold">
                <th className="pb-2 pr-4">Time</th>
                <th className="pb-2 pr-4">Rule</th>
                <th className="pb-2 pr-4">Trigger</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[
                { time: '2026-06-25 10:30', rule: 'Flag Large Invoices', trigger: 'INV-1050', status: 'Completed' },
                { time: '2026-06-25 09:15', rule: 'Auto-Archive Paid Bills', trigger: 'BILL-203', status: 'Completed' },
              ].map((l, i) => (
                <tr key={i}>
                  <td className="py-2.5 pr-4 text-slate-500 font-mono">{l.time}</td>
                  <td className="py-2.5 pr-4 text-slate-700 font-medium">{l.rule}</td>
                  <td className="py-2.5 pr-4 text-slate-600">{l.trigger}</td>
                  <td className="py-2.5"><span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded-full">{l.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400 mt-3">No recent workflow errors.</p>
      </Section>
    </PageShell>
  );
}

// ─── Schedules ─────────────────────────────────────────────────────────────
export function SchedulesPage() {
  return (
    <PageShell title="Schedules" desc="Manage automated background jobs and schedules." icon={Timer}>
      <Section title="Scheduled Jobs">
        <div className="space-y-3">
          {[
            { name: 'Recurring Invoice Generator', freq: 'Daily at 08:00', last: '2026-06-25 08:00', next: '2026-06-26 08:00' },
            { name: 'Payment Reminder Check', freq: 'Every 6 hours', last: '2026-06-25 06:00', next: '2026-06-25 12:00' },
            { name: 'Exchange Rate Sync', freq: 'Daily at 02:00', last: '2026-06-25 02:00', next: '2026-06-26 02:00' },
          ].map((s, i) => (
            <div key={i} className="flex items-center justify-between border border-slate-100 rounded-lg px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-700">{s.name}</p>
                <p className="text-xs text-slate-400">{s.freq} · Last: {s.last} · Next: {s.next}</p>
              </div>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full uppercase">Active</span>
            </div>
          ))}
        </div>
      </Section>
    </PageShell>
  );
}

// ─── Customers & Vendors ───────────────────────────────────────────────────
export function ContactsSettingsPage() {
  return (
    <PageShell title="Customers & Vendors" desc="Configure settings for customer and vendor management." icon={Users}>
      <Section title="General Settings">
        <ToggleRow label="Auto-generate customer IDs" desc="Automatically assign IDs to new customers." defaultChecked />
        <ToggleRow label="Require TIN for customers" desc="Make Tax Identification Number mandatory." />
        <ToggleRow label="Allow duplicate contact names" />
        <ToggleRow label="Enable customer credit limit" desc="Set maximum credit limits per customer." />
      </Section>
      <Section title="Default Contact Settings">
        <Select label="Default Payment Term" options={[{ value: 'net15', label: 'Net 15' }, { value: 'net30', label: 'Net 30' }, { value: 'dueonreceipt', label: 'Due on Receipt' }]} value="net30" />
        <Select label="Default Currency" options={[{ value: 'NGN', label: 'NGN' }, { value: 'USD', label: 'USD' }]} value="NGN" />
      </Section>
      <SaveBar />
    </PageShell>
  );
}

// ─── Items ─────────────────────────────────────────────────────────────────
export function ItemsSettingsPage() {
  return (
    <PageShell title="Items" desc="Configure settings for your product and service items." icon={Package}>
      <Section title="Item Settings">
        <ToggleRow label="Track inventory quantity" desc="Enable quantity tracking for stock items." defaultChecked />
        <ToggleRow label="Allow fractional quantities" />
        <ToggleRow label="Auto-generate SKU for new items" defaultChecked />
        <ToggleRow label="Show item images in lists" />
      </Section>
      <Section title="Default Units">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Default Unit (Service)" placeholder="Hour" defaultValue="Hour" />
          <Field label="Default Unit (Product)" placeholder="Piece" defaultValue="Piece" />
        </div>
      </Section>
      <SaveBar />
    </PageShell>
  );
}

// ─── Revenue Recognition ───────────────────────────────────────────────────
export function RevenueRecognitionPage() {
  return (
    <PageShell title="Revenue Recognition" desc="Configure how revenue is recognized in your books." icon={BarChart2}>
      <Section title="Revenue Recognition Rules">
        <Select label="Method" options={[
          { value: 'accrual', label: 'Accrual Basis — Recognize when invoiced' },
          { value: 'cash', label: 'Cash Basis — Recognize when received' },
        ]} value="accrual" />
        <ToggleRow label="Defer revenue for recurring invoices" desc="Recognize proportionally over the service period." defaultChecked />
        <ToggleRow label="Auto-create deferred revenue schedule" defaultChecked />
      </Section>
      <SaveBar />
    </PageShell>
  );
}

// ─── Accountant ────────────────────────────────────────────────────────────
export function AccountantSettingsPage() {
  return (
    <PageShell title="Accountant" desc="Configure settings for your accounting module." icon={FileText}>
      <Section title="Accounting Preferences">
        <ToggleRow label="Enable journal entry approval workflow" desc="Require approval before journal entries are posted." defaultChecked />
        <ToggleRow label="Auto-post journal entries" desc="Automatically post journal entries for transactions." />
        <ToggleRow label="Lock past fiscal periods" desc="Prevent changes to transactions in closed periods." defaultChecked />
      </Section>
      <Section title="Default Accounts">
        <Select label="Default Revenue Account" options={[{ value: 'sales', label: 'Sales Revenue' }]} />
        <Select label="Default Expense Account" options={[{ value: 'genexp', label: 'General Expenses' }]} />
        <Select label="Default Bank Account" options={[{ value: 'cbn', label: 'CBN Cash Account' }]} />
      </Section>
      <SaveBar />
    </PageShell>
  );
}

// ─── Tasks ─────────────────────────────────────────────────────────────────
export function TasksSettingsPage() {
  return (
    <PageShell title="Tasks" desc="Configure settings for task management." icon={ListChecks}>
      <Section title="Task Settings">
        <ToggleRow label="Enable task assignments" desc="Assign tasks to team members." defaultChecked />
        <ToggleRow label="Send task reminders" defaultChecked />
        <ToggleRow label="Allow task comments" defaultChecked />
        <ToggleRow label="Auto-create tasks from workflows" desc="Allow workflow rules to create tasks." />
      </Section>
      <SaveBar />
    </PageShell>
  );
}

// ─── Projects ──────────────────────────────────────────────────────────────
export function ProjectsSettingsPage() {
  return (
    <PageShell title="Projects" desc="Configure settings for project management." icon={Layers}>
      <Section title="Project Settings">
        <ToggleRow label="Enable project billing" desc="Track billable hours and expenses per project." defaultChecked />
        <ToggleRow label="Auto-create invoices from projects" />
        <ToggleRow label="Allow project budgets" defaultChecked />
        <ToggleRow label="Enable project milestones" defaultChecked />
      </Section>
      <SaveBar />
    </PageShell>
  );
}

// ─── Timesheet ─────────────────────────────────────────────────────────────
export function TimesheetSettingsPage() {
  return (
    <PageShell title="Timesheet" desc="Configure timesheet settings." icon={FileClock}>
      <Section title="Timesheet Settings">
        <ToggleRow label="Enable timesheet tracking" desc="Track employee work hours." defaultChecked />
        <ToggleRow label="Require timesheet approval" desc="Managers must approve timesheets." defaultChecked />
        <ToggleRow label="Allow overtime tracking" />
        <ToggleRow label="Enable timesheet reminders" defaultChecked />
      </Section>
      <Section title="Default Configuration">
        <Field label="Standard work hours per day" type="number" defaultValue="8" />
        <Select label="Timesheet frequency" options={[{ value: 'weekly', label: 'Weekly' }, { value: 'biweekly', label: 'Bi-weekly' }, { value: 'monthly', label: 'Monthly' }]} value="weekly" />
      </Section>
      <SaveBar />
    </PageShell>
  );
}

// ─── Inventory Adjustments ─────────────────────────────────────────────────
export function InventoryAdjustmentsPage() {
  return (
    <PageShell title="Inventory Adjustments" desc="Configure settings for inventory adjustments." icon={ArrowLeftRight}>
      <Section title="Adjustment Settings">
        <ToggleRow label="Require approval for adjustments" defaultChecked />
        <ToggleRow label="Auto-update average cost" desc="Recalculate average cost after adjustments." defaultChecked />
        <ToggleRow label="Track adjustment reasons" desc="Require a reason for each adjustment." />
        <ToggleRow label="Notify warehouse on adjustments" />
      </Section>
      <Section title="Default Adjustments Account">
        <Select label="Default Adjustment Account" options={[
          { value: 'invadj', label: 'Inventory Adjustments' },
          { value: 'loss', label: 'Inventory Loss' },
        ]} />
      </Section>
      <SaveBar />
    </PageShell>
  );
}

// ─── Payment Gateways ──────────────────────────────────────────────────────
export function PaymentGatewaysPage() {
  return (
    <PageShell title="Payment Gateways" desc="Configure online payment gateway connections." icon={Wallet}>
      <Section title="Connected Gateways">
        <div className="space-y-3">
          <div className="flex items-center justify-between border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center text-sm font-bold">FW</div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Flutterwave</p>
                <p className="text-xs text-slate-400">Connected · Live Mode</p>
              </div>
            </div>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full uppercase">Active</span>
          </div>
          <div className="flex items-center justify-between border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">PS</div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Paystack</p>
                <p className="text-xs text-slate-400">Not connected</p>
              </div>
            </div>
            <button className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700">Connect</button>
          </div>
        </div>
      </Section>
      <Section title="Payment Page Settings">
        <ToggleRow label="Redirect to payment page after invoice creation" defaultChecked />
        <ToggleRow label="Allow partial payments" />
        <Select label="Default payment gateway" options={[{ value: 'flutterwave', label: 'Flutterwave' }, { value: 'paystack', label: 'Paystack' }]} value="flutterwave" />
      </Section>
      <SaveBar />
    </PageShell>
  );
}

// ─── Sales Module Settings ─────────────────────────────────────────────────
function SalesModuleSection({ title, fields }: { title: string; fields: { label: string; desc: string }[] }) {
  return (
    <Section title={title} desc="Configure default settings for this transaction type.">
      {fields.map(f => (
        <ToggleRow key={f.label} label={f.label} desc={f.desc} defaultChecked />
      ))}
    </Section>
  );
}

export function QuotesSettingsPage() {
  return (
    <PageShell title="Quotes" desc="Configure default settings for quotes." icon={FileCheck}>
      <SalesModuleSection title="Quote Settings" fields={[
        { label: 'Auto-generate quote numbers', desc: 'Automatically assign quote numbers.' },
        { label: 'Send quote PDF on creation', desc: 'Email the PDF to the customer automatically.' },
        { label: 'Require customer approval', desc: 'Quotes require customer approval to convert.' },
      ]} />
      <Section title="Defaults">
        <Select label="Default Quote Status" options={[{ value: 'draft', label: 'Draft' }, { value: 'sent', label: 'Sent' }]} value="draft" />
        <Field label="Quote expiry (days)" type="number" defaultValue="30" />
      </Section>
      <SaveBar />
    </PageShell>
  );
}

export function SalesOrdersSettingsPage() {
  return (
    <PageShell title="Sales Orders" desc="Configure default settings for sales orders." icon={ShoppingCart}>
      <SalesModuleSection title="Sales Order Settings" fields={[
        { label: 'Auto-generate sales order numbers', desc: 'Automatically assign sales order numbers.' },
        { label: 'Allow partial fulfillment', desc: 'Allow shipping items in multiple batches.' },
        { label: 'Require sales order approval', desc: 'Sales orders require approval before fulfillment.' },
      ]} />
      <Select label="Default Status" options={[{ value: 'draft', label: 'Draft' }, { value: 'confirmed', label: 'Confirmed' }]} value="draft" />
      <SaveBar />
    </PageShell>
  );
}

export function InvoicesSettingsPage() {
  return (
    <PageShell title="Invoices" desc="Configure default settings for invoices." icon={Receipt}>
      <SalesModuleSection title="Invoice Settings" fields={[
        { label: 'Auto-generate invoice numbers', desc: 'Automatically assign invoice numbers.' },
        { label: 'Send invoice via email on creation', desc: 'Email the invoice to the customer.' },
        { label: 'Show invoice due date prominently', desc: 'Display the due date in bold.' },
        { label: 'Include payment terms on invoice', desc: 'Display payment terms on printed invoices.' },
        { label: 'Allow invoice discounts', desc: 'Enable discount fields on invoices.' },
      ]} />
      <Section title="Defaults">
        <Select label="Default Invoice Status" options={[{ value: 'draft', label: 'Draft' }, { value: 'sent', label: 'Sent' }]} value="draft" />
        <Select label="Default Payment Term" options={[{ value: 'net30', label: 'Net 30' }, { value: 'net15', label: 'Net 15' }, { value: 'dueonreceipt', label: 'Due on Receipt' }]} value="net30" />
      </Section>
      <SaveBar />
    </PageShell>
  );
}

export function RecurringInvoicesSettingsPage() {
  return (
    <PageShell title="Recurring Invoices" desc="Configure default settings for recurring invoices." icon={Repeat}>
      <SalesModuleSection title="Recurring Invoice Settings" fields={[
        { label: 'Auto-generate recurring invoice numbers', desc: 'Automatically assign invoice numbers from template.' },
        { label: 'Send invoice automatically', desc: 'Email the invoice on the scheduled date.' },
        { label: 'Stop after N occurrences', desc: 'Automatically stop after a set number of cycles.' },
        { label: 'Notify before generation', desc: 'Send a reminder before the next invoice is generated.' },
      ]} />
      <Section title="Defaults">
        <Select label="Default Frequency" options={[{ value: 'monthly', label: 'Monthly' }, { value: 'weekly', label: 'Weekly' }, { value: 'yearly', label: 'Yearly' }]} value="monthly" />
      </Section>
      <SaveBar />
    </PageShell>
  );
}

export function SalesReceiptsSettingsPage() {
  return (
    <PageShell title="Sales Receipts" desc="Configure default settings for sales receipts." icon={ReceiptText}>
      <SalesModuleSection title="Sales Receipt Settings" fields={[
        { label: 'Auto-generate receipt numbers', desc: 'Automatically assign receipt numbers.' },
        { label: 'Email receipt to customer', desc: 'Send a copy of the receipt via email.' },
        { label: 'Print receipt on POS', desc: 'Enable receipt printing for POS transactions.' },
      ]} />
      <SaveBar />
    </PageShell>
  );
}

export function PaymentsReceivedSettingsPage() {
  return (
    <PageShell title="Payments Received" desc="Configure default settings for received payments." icon={Banknote}>
      <SalesModuleSection title="Payment Settings" fields={[
        { label: 'Auto-generate payment numbers', desc: 'Automatically assign payment numbers.' },
        { label: 'Auto-allocate payments', desc: 'Automatically allocate payments to outstanding invoices.' },
        { label: 'Send payment confirmation', desc: 'Email payment confirmation to customer.' },
      ]} />
      <Section title="Defaults">
        <Select label="Default Payment Method" options={[
          { value: 'bank', label: 'Bank Transfer' },
          { value: 'card', label: 'Card Payment' },
          { value: 'cash', label: 'Cash' },
          { value: 'pos', label: 'POS' },
        ]} value="bank" />
      </Section>
      <SaveBar />
    </PageShell>
  );
}

export function CreditNotesSettingsPage() {
  return (
    <PageShell title="Credit Notes" desc="Configure default settings for credit notes." icon={FileText}>
      <SalesModuleSection title="Credit Note Settings" fields={[
        { label: 'Auto-generate credit note numbers', desc: 'Automatically assign credit note numbers.' },
        { label: 'Allow credit notes without invoice', desc: 'Create standalone credit notes.' },
        { label: 'Notify customer on issuance', desc: 'Email the credit note to the customer.' },
      ]} />
      <SaveBar />
    </PageShell>
  );
}

export function DeliveryNotesSettingsPage() {
  return (
    <PageShell title="Delivery Notes" desc="Configure default settings for delivery notes." icon={Truck}>
      <SalesModuleSection title="Delivery Note Settings" fields={[
        { label: 'Auto-generate delivery note numbers', desc: 'Automatically assign delivery note numbers.' },
        { label: 'Show item serial numbers', desc: 'Display serial numbers on delivery notes.' },
        { label: 'Email delivery note to customer', desc: 'Send a copy via email.' },
      ]} />
      <SaveBar />
    </PageShell>
  );
}

export function PackingSlipsSettingsPage() {
  return (
    <PageShell title="Packing Slips" desc="Configure default settings for packing slips." icon={ClipboardList}>
      <SalesModuleSection title="Packing Slip Settings" fields={[
        { label: 'Auto-generate packing slip numbers', desc: 'Automatically assign packing slip numbers.' },
        { label: 'Show batch numbers', desc: 'Display batch/lot numbers on packing slips.' },
        { label: 'Include barcode', desc: 'Include barcode on printed packing slips.' },
      ]} />
      <SaveBar />
    </PageShell>
  );
}

// ─── Purchases Module Settings ─────────────────────────────────────────────
function PurchasesModuleSection({ title, fields }: { title: string; fields: { label: string; desc: string }[] }) {
  return (
    <Section title={title} desc="Configure default settings for this transaction type.">
      {fields.map(f => (
        <ToggleRow key={f.label} label={f.label} desc={f.desc} defaultChecked />
      ))}
    </Section>
  );
}

export function ExpensesSettingsPage() {
  return (
    <PageShell title="Expenses" desc="Configure default settings for expenses." icon={CreditCard}>
      <PurchasesModuleSection title="Expense Settings" fields={[
        { label: 'Auto-generate expense numbers', desc: 'Automatically assign expense numbers.' },
        { label: 'Allow expense attachments', desc: 'Upload receipts and documents to expenses.' },
        { label: 'Require expense approval', desc: 'Expenses require manager approval.' },
        { label: 'Enable mileage tracking', desc: 'Track business mileage in expenses.' },
      ]} />
      <SaveBar />
    </PageShell>
  );
}

export function RecurringExpensesSettingsPage() {
  return (
    <PageShell title="Recurring Expenses" desc="Configure default settings for recurring expenses." icon={Repeat}>
      <PurchasesModuleSection title="Recurring Expense Settings" fields={[
        { label: 'Auto-generate expense numbers', desc: 'Automatically assign expense numbers.' },
        { label: 'Notify before generation', desc: 'Send a reminder before the next expense is created.' },
        { label: 'Auto-post journal entries', desc: 'Automatically post to the general ledger.' },
      ]} />
      <SaveBar />
    </PageShell>
  );
}

export function PurchaseOrdersSettingsPage() {
  return (
    <PageShell title="Purchase Orders" desc="Configure default settings for purchase orders." icon={ShoppingCart}>
      <PurchasesModuleSection title="Purchase Order Settings" fields={[
        { label: 'Auto-generate PO numbers', desc: 'Automatically assign purchase order numbers.' },
        { label: 'Allow partial receipts', desc: 'Receive items in multiple batches.' },
        { label: 'Require PO approval', desc: 'Purchase orders require approval before sending.' },
      ]} />
      <Select label="Default Status" options={[{ value: 'draft', label: 'Draft' }, { value: 'sent', label: 'Sent' }]} value="draft" />
      <SaveBar />
    </PageShell>
  );
}

export function BillsSettingsPage() {
  return (
    <PageShell title="Bills" desc="Configure default settings for bills." icon={FileText}>
      <PurchasesModuleSection title="Bill Settings" fields={[
        { label: 'Auto-generate bill numbers', desc: 'Automatically assign bill numbers.' },
        { label: 'Allow bill attachments', desc: 'Upload vendor invoices to bills.' },
        { label: 'Require bill approval', desc: 'Bills require approval before payment.' },
        { label: 'Enable recurring bills', desc: 'Allow recurring bill templates.' },
      ]} />
      <Select label="Default Payment Term" options={[{ value: 'net30', label: 'Net 30' }, { value: 'net15', label: 'Net 15' }, { value: 'dueonreceipt', label: 'Due on Receipt' }]} value="net30" />
      <SaveBar />
    </PageShell>
  );
}

export function RecurringBillsSettingsPage() {
  return (
    <PageShell title="Recurring Bills" desc="Configure default settings for recurring bills." icon={FileClock}>
      <PurchasesModuleSection title="Recurring Bill Settings" fields={[
        { label: 'Auto-generate bill numbers', desc: 'Automatically assign bill numbers.' },
        { label: 'Notify before generation', desc: 'Send a reminder before the next bill is created.' },
        { label: 'Auto-create payment', desc: 'Automatically create a payment for recurring bills.' },
      ]} />
      <SaveBar />
    </PageShell>
  );
}

export function PaymentsMadeSettingsPage() {
  return (
    <PageShell title="Payments Made" desc="Configure default settings for payments made." icon={Wallet}>
      <PurchasesModuleSection title="Payment Settings" fields={[
        { label: 'Auto-generate payment numbers', desc: 'Automatically assign payment numbers.' },
        { label: 'Auto-allocate payments', desc: 'Automatically allocate to outstanding bills.' },
        { label: 'Send payment confirmation to vendor', desc: 'Email payment confirmation.' },
      ]} />
      <Select label="Default Payment Method" options={[
        { value: 'bank', label: 'Bank Transfer' },
        { value: 'cheque', label: 'Cheque' },
        { value: 'cash', label: 'Cash' },
      ]} value="bank" />
      <SaveBar />
    </PageShell>
  );
}

export function VendorCreditsSettingsPage() {
  return (
    <PageShell title="Vendor Credits" desc="Configure default settings for vendor credits." icon={Banknote}>
      <PurchasesModuleSection title="Vendor Credit Settings" fields={[
        { label: 'Auto-generate credit note numbers', desc: 'Automatically assign vendor credit numbers.' },
        { label: 'Allow credits without bill', desc: 'Create standalone vendor credits.' },
        { label: 'Auto-apply to future bills', desc: 'Automatically apply credits to new bills.' },
      ]} />
      <SaveBar />
    </PageShell>
  );
}

// ─── Custom Modules ────────────────────────────────────────────────────────
export function CustomModulesPage() {
  return (
    <PageShell title="Custom Modules" desc="Manage custom modules and integrations." icon={PuzzleIcon}>
      <Section title="Installed Modules">
        <div className="space-y-3">
          {[
            { name: 'Inventory Management', desc: 'Track stock levels, warehouses, and inventory movements.', installed: true },
            { name: 'Payroll', desc: 'Manage employee salaries, PAYE, and pension contributions.', installed: true },
            { name: 'Fixed Assets', desc: 'Track and depreciate company fixed assets.', installed: false },
            { name: 'Multi-Currency', desc: 'Support for multiple currencies and exchange rates.', installed: true },
          ].map((m, i) => (
            <div key={i} className="flex items-center justify-between border border-slate-200 rounded-lg p-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">{m.name}</p>
                <p className="text-xs text-slate-400">{m.desc}</p>
              </div>
              {m.installed
                ? <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full uppercase">Installed</span>
                : <button className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700">Install</button>
              }
            </div>
          ))}
        </div>
      </Section>
    </PageShell>
  );
}

// RefreshCw icon used in CurrenciesPage
function RefreshCw({ size, className }: { size?: number; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size ?? 24} height={size ?? 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}
