/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NavLink, useLocation } from 'react-router-dom';
import { orgApi } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Hash,
  Calendar,
  Receipt,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Shield,
  Users,
  UserCog,
  Settings,
  Globe,
  CreditCard,
  Clock,
  Scale,
  Bell,
  LayoutTemplate,
  FileText,
  Tag,
  Layers,
  Zap,
  ListChecks,
  History,
  Timer,
  ShoppingCart,
  Package,
  Wallet,
  BarChart2,
  ChevronDown,
  ChevronRight,
  Paintbrush,
  MapPinned,
  FileClock,
  Repeat,
  ReceiptText,
  Banknote,
  FileCheck,
  Truck,
  ClipboardList,
  ArrowLeftRight,
  Store,
  Boxes,
  PuzzleIcon,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface OrgData {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
  baseCurrency: string;
  fiscalYearStart: string | null;
  vatNumber: string | null;
  rcNumber: string | null;
  website: string | null;
  createdAt: string;
}

type OrgFormState = {
  name: string;
  address: string;
  phone: string;
  email: string;
  fiscalYearStart: string;
  vatNumber: string;
  rcNumber: string;
  website: string;
};

function fromOrg(org: OrgData): OrgFormState {
  return {
    name: org.name || '',
    address: org.address || '',
    phone: org.phone || '',
    email: org.email || '',
    fiscalYearStart: org.fiscalYearStart || '',
    vatNumber: org.vatNumber || '',
    rcNumber: org.rcNumber || '',
    website: org.website || '',
  };
}

// ─── Sidebar nav config ───────────────────────────────────────────────────────

type NavItem = { label: string; path: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { group: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    group: 'Organisation',
    items: [
      { label: 'Profile', path: '/settings/organisation', icon: Building2 },
      { label: 'Branding', path: '/settings/branding', icon: Paintbrush },
      { label: 'Custom Domain', path: '/settings/domain', icon: Globe },
      { label: 'Locations', path: '/settings/locations', icon: MapPinned },
    ],
  },
  {
    group: 'Users & Roles',
    items: [
      { label: 'Users', path: '/settings/users', icon: Users },
      { label: 'Roles', path: '/settings/roles', icon: Shield },
      { label: 'User Preferences', path: '/settings/user-preferences', icon: UserCog },
    ],
  },
  {
    group: 'Setup & Configuration',
    items: [
      { label: 'General', path: '/settings/general', icon: Settings },
      { label: 'Currencies', path: '/settings/currencies', icon: CreditCard },
      { label: 'Payment Terms', path: '/settings/payment-terms', icon: Clock },
      { label: 'Opening Balances', path: '/settings/opening-balances', icon: Scale },
      { label: 'Reminders', path: '/settings/reminders', icon: Bell },
      { label: 'Customer Portal', path: '/settings/customer-portal', icon: Store },
      { label: 'Vendor Portal', path: '/settings/vendor-portal', icon: Boxes },
    ],
  },
  {
    group: 'Customization',
    items: [
      { label: 'Transaction Number Series', path: '/settings/txn-numbering', icon: Hash },
      { label: 'PDF Templates', path: '/settings/pdf-templates', icon: LayoutTemplate },
      { label: 'Email Notifications', path: '/settings/email-notifications', icon: Mail },
      { label: 'Reporting Tags', path: '/settings/reporting-tags', icon: Tag },
      { label: 'Web Tabs', path: '/settings/web-tabs', icon: Layers },
    ],
  },
  {
    group: 'Automation',
    items: [
      { label: 'Workflow Rules', path: '/settings/workflow-rules', icon: Zap },
      { label: 'Workflow Actions', path: '/settings/workflow-actions', icon: ListChecks },
      { label: 'Workflow Logs', path: '/settings/workflow-logs', icon: History },
      { label: 'Schedules', path: '/settings/schedules', icon: Timer },
    ],
  },
  {
    group: 'Module Settings — General',
    items: [
      { label: 'Customers & Vendors', path: '/settings/contacts', icon: Users },
      { label: 'Items', path: '/settings/items', icon: Package },
      { label: 'Revenue Recognition', path: '/settings/revenue-recognition', icon: BarChart2 },
      { label: 'Accountant', path: '/settings/accountant', icon: FileText },
      { label: 'Tasks', path: '/settings/tasks', icon: ListChecks },
      { label: 'Projects', path: '/settings/projects', icon: Layers },
      { label: 'Timesheet', path: '/settings/timesheet', icon: FileClock },
    ],
  },
  {
    group: 'Module Settings — Inventory',
    items: [
      { label: 'Inventory Adjustments', path: '/settings/inventory-adjustments', icon: ArrowLeftRight },
    ],
  },
  {
    group: 'Module Settings — Online Payments',
    items: [
      { label: 'Payment Gateways', path: '/settings/payment-gateways', icon: Wallet },
    ],
  },
  {
    group: 'Module Settings — Sales',
    items: [
      { label: 'Quotes', path: '/settings/quotes', icon: FileCheck },
      { label: 'Sales Orders', path: '/settings/sales-orders', icon: ShoppingCart },
      { label: 'Invoices', path: '/settings/invoices', icon: Receipt },
      { label: 'Recurring Invoices', path: '/settings/recurring-invoices', icon: Repeat },
      { label: 'Sales Receipts', path: '/settings/sales-receipts', icon: ReceiptText },
      { label: 'Payments Received', path: '/settings/payments-received', icon: Banknote },
      { label: 'Credit Notes', path: '/settings/credit-notes', icon: FileText },
      { label: 'Delivery Notes', path: '/settings/delivery-notes', icon: Truck },
      { label: 'Packing Slips', path: '/settings/packing-slips', icon: ClipboardList },
    ],
  },
  {
    group: 'Module Settings — Purchases',
    items: [
      { label: 'Expenses', path: '/settings/expenses', icon: CreditCard },
      { label: 'Recurring Expenses', path: '/settings/recurring-expenses', icon: Repeat },
      { label: 'Purchase Orders', path: '/settings/purchase-orders', icon: ShoppingCart },
      { label: 'Bills', path: '/settings/bills', icon: FileText },
      { label: 'Recurring Bills', path: '/settings/recurring-bills', icon: FileClock },
      { label: 'Payments Made', path: '/settings/payments-made', icon: Wallet },
      { label: 'Vendor Credits', path: '/settings/vendor-credits', icon: Banknote },
    ],
  },
  {
    group: 'Custom Modules',
    items: [
      { label: 'Overview', path: '/settings/custom-modules', icon: PuzzleIcon },
    ],
  },
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function SettingsSidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggle(group: string) {
    setCollapsed(prev => ({ ...prev, [group]: !prev[group] }));
  }

  return (
    <nav className="w-56 shrink-0 self-start sticky top-6">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {NAV.map(({ group, items }) => {
          const isOpen = !collapsed[group];
          const isActive = items.some(i => i.path === location.pathname);
          return (
            <div key={group} className="border-b border-slate-100 last:border-0">
              <button
                onClick={() => toggle(group)}
                className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
                  isActive ? 'bg-indigo-50' : 'hover:bg-slate-50'
                }`}
              >
                <span className={`text-xs font-semibold tracking-wide uppercase ${
                  isActive ? 'text-indigo-700' : 'text-slate-500'
                }`}>
                  {group.replace('Module Settings — ', '')}
                </span>
                {isOpen
                  ? <ChevronDown size={13} className="text-slate-400" />
                  : <ChevronRight size={13} className="text-slate-400" />
                }
              </button>
              {isOpen && (
                <div className="pb-1">
                  {items.map(({ label, path, icon: Icon }) => (
                    <NavLink
                      key={path}
                      to={path}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 px-3 py-1.5 mx-1 rounded-lg text-xs transition-colors ${
                          isActive
                            ? 'bg-indigo-600 text-white font-medium'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`
                      }
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      {label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({
  icon: Icon,
  label,
  hint,
  ...props
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          {...props}
          className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 placeholder-slate-400 transition-shadow"
        />
      </div>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function OrganisationSettingsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState<OrgFormState>({
    name: '', address: '', phone: '', email: '',
    fiscalYearStart: '', vatNumber: '', rcNumber: '',
  });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setLogoError("Logo must be under 2MB"); return; }
    setLogoUploading(true); setLogoError(null);
    try {
      const fd = new FormData(); fd.append("logo", file);
      await orgApi.uploadLogo(fd);
      queryClient.invalidateQueries({ queryKey: ["org"] });
    } catch { setLogoError("Upload failed. Try again."); }
    finally { setLogoUploading(false); }
  }

  const { data: org, isLoading } = useQuery<OrgData>({
    queryKey: ['org'],
    queryFn: orgApi.getOrg,
  });

  useEffect(() => {
    if (org) setForm(fromOrg(org));
  }, [org]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<OrgFormState>) => orgApi.updateOrg(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['org'], updated);
      queryClient.invalidateQueries({ queryKey: ['org'] });
      setSaveSuccess(true);
      setSaveError(null);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (err: any) => {
      setSaveError(err?.response?.data?.error || 'Failed to save changes.');
      setSaveSuccess(false);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    const payload: Partial<OrgFormState> = {};
    if (form.name.trim()) payload.name = form.name.trim();
    payload.address = form.address.trim() || '';
    payload.phone = form.phone.trim() || '';
    payload.email = form.email.trim() || '';
    payload.fiscalYearStart = form.fiscalYearStart.trim() || '';
    payload.vatNumber = form.vatNumber.trim() || '';
    payload.rcNumber = form.rcNumber.trim() || '';
    payload.website = form.website.trim() || '';
    updateMutation.mutate(payload);
  }

  function f(key: keyof OrgFormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 size={20} className="animate-spin mr-2" />
        Loading organisation details...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 flex gap-6 items-start">
      <SettingsSidebar />

      <div className="flex-1 min-w-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Organisation Settings</h1>
          <p className="text-sm text-slate-500 mt-1">
            Update your company profile, tax identifiers, and fiscal configuration.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Core identity */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Building2 size={16} className="text-slate-400" />
              Company Identity
            </h2>
            <div className="flex items-center gap-5 pb-4 border-b border-slate-100">
              <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden shrink-0">
                {org?.logoUrl
                  ? <img src={org.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                  : <Building2 size={28} className="text-slate-300" />}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Company Logo</p>
                <p className="text-xs text-slate-400 mt-0.5 mb-2">PNG or JPG, max 2MB. Appears on invoices.</p>
                <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition">
                  {logoUploading ? "Uploading..." : "Upload Logo"}
                  <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleLogoUpload} disabled={logoUploading} />
                </label>
                {logoError && <p className="text-xs text-red-500 mt-1">{logoError}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Field
                  icon={Building2}
                  label="Legal Business Name"
                  value={form.name}
                  onChange={f('name')}
                  placeholder="Skyhouse Technologies Ltd"
                  required
                />
              </div>
              <Field
                icon={Mail}
                label="Business Email"
                type="email"
                value={form.email}
                onChange={f('email')}
                placeholder="hello@company.ng"
              />
              <Field
                icon={Phone}
                label="Phone Number"
                value={form.phone}
                onChange={f('phone')}
                placeholder="+234 801 234 5678"
              />
              <div className="sm:col-span-2">
                <Field
                  icon={MapPin}
                  label="Registered Address"
                  value={form.address}
                  onChange={f('address')}
                  placeholder="12 Bode Thomas Road, Surulere, Lagos State, Nigeria"
                  hint="This appears on invoices and official documents."
                />
              </div>
              <div className="sm:col-span-2">
                <Field
                  icon={Globe}
                  label="Website"
                  value={form.website}
                  onChange={f('website')}
                  placeholder="https://www.yourcompany.com"
                  hint="Shown on invoices and client documents."
                />
              </div>
            </div>
          </div>

          {/* Nigerian tax & compliance */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Receipt size={16} className="text-slate-400" />
              Tax & Compliance (FIRS / CAC)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                icon={Hash}
                label="RC Number (CAC)"
                value={form.rcNumber}
                onChange={f('rcNumber')}
                placeholder="RC-1234567"
                hint="Companies and Allied Matters Act registration number."
              />
              <Field
                icon={Receipt}
                label="VAT / TIN Number (FIRS)"
                value={form.vatNumber}
                onChange={f('vatNumber')}
                placeholder="TIN-00000000-0001"
                hint="Federal Inland Revenue Service tax identification."
              />
              <Field
                icon={Calendar}
                label="Fiscal Year Start"
                type="date"
                value={form.fiscalYearStart}
                onChange={f('fiscalYearStart')}
                hint="Day and month your financial year begins."
              />
            </div>
          </div>

          {/* Read-only info */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Shield size={14} />
              Account Info
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs text-slate-400 block mb-0.5">Administrator</span>
                <span className="font-medium text-slate-700">{user?.fullName || '—'}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block mb-0.5">Role</span>
                <span className="font-medium text-slate-700 capitalize">{user?.role || '—'}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block mb-0.5">Base Currency</span>
                <span className="font-medium text-slate-700">{org?.baseCurrency || 'NGN'}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block mb-0.5">Organisation ID</span>
                <span className="font-mono text-xs text-slate-500">{org?.id?.substring(0, 8)}…</span>
              </div>
            </div>
          </div>

          {/* Feedback */}
          {saveError && (
            <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-4 py-3">
              <AlertCircle size={16} className="shrink-0" />
              {saveError}
            </div>
          )}
          {saveSuccess && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3">
              <CheckCircle2 size={16} className="shrink-0" />
              Organisation profile saved successfully.
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {updateMutation.isPending ? (
                <><Loader2 size={16} className="animate-spin" />Saving…</>
              ) : (
                <><Save size={16} />Save Changes</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}






