import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useOrgSettings } from '../../hooks/useOrgSettings';
import { orgApi } from '../../lib/api';

function useSettingsForm(key: string, defaults?: Record<string, any>) {
  const { settings, save, isPending } = useOrgSettings();
  const [form, setForm] = useState<Record<string, any>>(defaults || {});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings[key]) {
      setForm((prev: Record<string, any>) => ({ ...prev, ...settings[key] }));
    }
  }, [settings, key]);

  const handleSave = useCallback(() => {
    setError(null);
    save({ [key]: form }, {
      onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 3000); },
      onError: (err: any) => setError(err?.response?.data?.error || err?.message || 'Save failed'),
    });
  }, [key, form, save]);

  function field(name: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
      setForm((p: Record<string, any>) => ({ ...p, [name]: value }));
    };
  }

  function toggle(name: string) {
    return () => setForm((p: Record<string, any>) => ({ ...p, [name]: !p[name] }));
  }

  return { form, field, toggle, handleSave, isPending, saved, error, setForm };
}
import {
  Building2, Paintbrush, Globe, MapPinned, Users, Shield, UserCog,
  Settings, CreditCard, Clock, Scale, Bell, Store, Boxes, Hash,
  LayoutTemplate, Mail, Tag, Layers, Zap, ListChecks, History, Timer,
  Package, BarChart2, FileText, FileClock, Repeat, ReceiptText, Banknote,
  FileCheck, Truck, ClipboardList, ArrowLeftRight, Wallet, PuzzleIcon,
  ShoppingCart, Receipt, ToggleLeft, Download, Upload, Link,
  Lightbulb, Eye, Pencil, Trash2, Plus, Check, X,
  Loader2, Save, CheckCircle2, AlertCircle, MapPin, Calendar, Phone,
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

function ToggleRow({ label, desc, checked, onClick, defaultChecked }: { label: string; desc?: string; checked?: boolean; onClick?: () => void; defaultChecked?: boolean }) {
  const [internal, setInternal] = useState(defaultChecked ?? false);
  const isOn = checked !== undefined ? checked : internal;
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {desc && <p className="text-xs text-slate-400">{desc}</p>}
      </div>
      <button
        type="button"
        onClick={() => { if (onClick) onClick(); else setInternal(!internal); }}
        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${isOn ? 'bg-indigo-600' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${isOn ? 'translate-x-5' : 'translate-x-0.5'}`} />
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

function FieldWithIcon({ icon: Icon, label, hint, ...props }: { icon: React.ComponentType<{ className?: string }>; label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
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

function SaveBar({ onSave, isPending, saved, error }: { onSave?: () => void; isPending?: boolean; saved?: boolean; error?: string | null }) {
  return (
    <div className="flex flex-col gap-2">
      {error && (
        <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-4 py-3">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
        {saved && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
            <CheckCircle2 size={14} /> Saved
          </span>
        )}
        <button
          onClick={onSave}
          disabled={isPending}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          {isPending ? <><Loader2 size={15} className="animate-spin" />Saving…</> : <><Save size={15} />Save Changes</>}
        </button>
      </div>
    </div>
  );
}

// ─── Organisation Settings (Profile) ───────────────────────────────────────

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

export function OrganisationProfilePage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState<OrgFormState>({
    name: '', address: '', phone: '', email: '',
    fiscalYearStart: '', vatNumber: '', rcNumber: '', website: '',
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
    onSuccess: () => {
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
      <PageShell title="Organisation Settings" desc="Update your company profile, tax identifiers, and fiscal configuration." icon={Building2}>
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 size={20} className="animate-spin mr-2" />
          Loading organisation details...
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Organisation Settings" desc="Update your company profile, tax identifiers, and fiscal configuration." icon={Building2}>
      <form onSubmit={handleSubmit}>
        <Section title="Company Identity" desc="Your business name and contact details appear on invoices and documents.">
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
              <FieldWithIcon icon={Building2} label="Legal Business Name" required value={form.name} onChange={f('name')} placeholder="Skyhouse Technologies Ltd" />
            </div>
            <FieldWithIcon icon={Mail} label="Business Email" type="email" value={form.email} onChange={f('email')} placeholder="hello@company.ng" />
            <FieldWithIcon icon={Phone} label="Phone Number" value={form.phone} onChange={f('phone')} placeholder="+234 801 234 5678" />
            <div className="sm:col-span-2">
              <FieldWithIcon icon={MapPin} label="Registered Address" value={form.address} onChange={f('address')} placeholder="12 Bode Thomas Road, Surulere, Lagos" hint="Appears on invoices and official documents." />
            </div>
            <div className="sm:col-span-2">
              <FieldWithIcon icon={Globe} label="Website" value={form.website} onChange={f('website')} placeholder="https://www.yourcompany.com" hint="Shown on invoices and client documents." />
            </div>
          </div>
        </Section>

        <Section title="Tax & Compliance" desc="Federal Inland Revenue Service and CAC registration details.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldWithIcon icon={Hash} label="RC Number (CAC)" value={form.rcNumber} onChange={f('rcNumber')} placeholder="RC-1234567" hint="Companies and Allied Matters Act registration." />
            <FieldWithIcon icon={Receipt} label="VAT / TIN Number (FIRS)" value={form.vatNumber} onChange={f('vatNumber')} placeholder="TIN-00000000-0001" hint="Federal Inland Revenue Service tax ID." />
            <FieldWithIcon icon={Calendar} label="Fiscal Year Start" value={form.fiscalYearStart} onChange={f('fiscalYearStart')} placeholder="01-01 (DD-MM)" hint="Day and month your financial year begins." />
          </div>
        </Section>

        {/* Read-only info */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-5">
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

        {saveError && (
          <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-4 py-3 mb-4">
            <AlertCircle size={16} className="shrink-0" />
            {saveError}
          </div>
        )}
        {saveSuccess && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3 mb-4">
            <CheckCircle2 size={16} className="shrink-0" />
            Organisation profile saved successfully.
          </div>
        )}

        <div className="flex justify-end pt-4 border-t border-slate-100">
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
    </PageShell>
  );
}

// ─── Branding ──────────────────────────────────────────────────────────────
export function BrandingPage() {
  const { form, field, toggle, handleSave, isPending, saved, error } = useSettingsForm('branding', { showLogo: true });
  const queryClient = useQueryClient();
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
              {logoUploading ? "Uploading..." : <><Upload size={14} /> Upload Logo</>}
              <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleLogoUpload} disabled={logoUploading} />
            </label>
            {logoError && <p className="text-xs text-red-500 mt-1">{logoError}</p>}
          </div>
        </div>
        <Field label="Company Tagline" placeholder="Your tagline here" value={form.tagline || ''} onChange={field('tagline')} desc="Appears below your company name on documents." />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Primary Color" type="text" placeholder="#4F46E5" value={form.primaryColor || ''} onChange={field('primaryColor')} />
          <Field label="Accent Color" type="text" placeholder="#10B981" value={form.accentColor || ''} onChange={field('accentColor')} />
        </div>
      </Section>
      <Section title="Invoice & Document Customization">
        <ToggleRow label="Show company logo on all documents" checked={form.showLogo} onClick={toggle('showLogo')} />
        <ToggleRow label="Show company signature on invoices" checked={form.showSignature} onClick={toggle('showSignature')} />
        <ToggleRow label="Include payment QR code on invoices" checked={form.showQRCode} onClick={toggle('showQRCode')} />
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Custom Domain ─────────────────────────────────────────────────────────
export function CustomDomainPage() {
  const { form, field, handleSave, isPending, saved, error } = useSettingsForm('domain');
  return (
    <PageShell title="Custom Domain" desc="Connect your own domain to host your customer portal and documents." icon={Globe}>
      <Section title="Domain Configuration">
        <Field label="Custom Domain" placeholder="books.yourcompany.com" value={form.domain || ''} onChange={field('domain')} desc="Enter the domain you want to use." />
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-600 space-y-2">
          <p className="font-medium text-slate-800 flex items-center gap-2"><Lightbulb size={14} />DNS Setup Instructions</p>
          <p>Add the following CNAME record to your DNS provider:</p>
          <code className="block bg-white border border-slate-200 rounded px-3 py-2 text-xs font-mono text-indigo-600">
            Type: CNAME<br />Name: books<br />Value: skybooks.app
          </code>
        </div>
        <ToggleRow label="Enable custom domain" defaultChecked={form.enabled} onClick={() => {}} />
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Locations ─────────────────────────────────────────────────────────────
export function LocationsPage() {
  const { form, handleSave, isPending, saved, error } = useSettingsForm('locations');
  return (
    <PageShell title="Locations" desc="Manage your business locations for multi-branch operations." icon={MapPinned}>
      <Section title="Your Locations">
        {(form.locations || []).length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No locations added yet.</p>
        ) : (
          <div className="space-y-3">
            {(form.locations || []).map((loc: any, i: number) => (
              <div key={i} className="flex items-center justify-between border border-slate-100 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <MapPinned size={16} className="text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">{loc.name}</p>
                    <p className="text-xs text-slate-400">{loc.address}</p>
                  </div>
                </div>
                <button className="text-slate-400 hover:text-red-500 transition"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
        <button className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition">
          <Plus size={16} /> Add Location
        </button>
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Users ─────────────────────────────────────────────────────────────────
export function UsersPage() {
  return (
    <PageShell title="Users" desc="Manage team members who have access to your SkyBooks account." icon={Users}>
      <Section title="Team Members">
        <p className="text-sm text-slate-400 py-4 text-center">User management is available via the API. Use the invite flow to add team members.</p>
      </Section>
    </PageShell>
  );
}

// ─── Roles ─────────────────────────────────────────────────────────────────
export function RolesPage() {
  const { form, handleSave, isPending, saved, error } = useSettingsForm('roles');
  return (
    <PageShell title="Roles" desc="Define access permissions for different user roles." icon={Shield}>
      <Section title="Roles & Permissions">
        {['admin', 'accountant', 'staff'].map((role) => (
          <div key={role} className="border border-slate-200 rounded-lg p-4 mb-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-slate-800 capitalize">{role}</span>
            </div>
            <div className="space-y-1.5">
              {['Sales', 'Purchases', 'Accounting', 'Reports', 'Settings'].map(m => (
                <div key={m} className="flex items-center justify-between text-xs text-slate-600">
                  <span>{m}</span>
                  <select
                    value={form[`${role}_${m.toLowerCase()}`] || 'read'}
                    onChange={() => {}}
                    className="text-xs border border-slate-200 rounded px-2 py-1"
                  >
                    <option value="none">No Access</option>
                    <option value="read">View Only</option>
                    <option value="write">Create & Edit</option>
                    <option value="full">Full Access</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── User Preferences ──────────────────────────────────────────────────────
export function UserPreferencesPage() {
  const { form, field, toggle, handleSave, isPending, saved, error } = useSettingsForm('userPreferences');
  return (
    <PageShell title="User Preferences" desc="Configure your personal app preferences." icon={UserCog}>
      <Section title="Preferences">
        <Select label="Language" options={[{ value: 'en', label: 'English' }, { value: 'fr', label: 'French' }]} value={form.language || 'en'} onChange={v => field('language')({ target: { value: v } } as any)} />
        <Select label="Date Format" options={[{ value: 'DD-MM-YYYY', label: 'DD-MM-YYYY' }, { value: 'MM-DD-YYYY', label: 'MM-DD-YYYY' }]} value={form.dateFormat || 'DD-MM-YYYY'} />
        <Select label="Number Format" options={[{ value: 'NG', label: '1,234.56 (NG)' }, { value: 'US', label: '1,234.56 (US)' }]} value={form.numberFormat || 'NG'} />
        <Select label="Timezone" options={[{ value: 'WAT', label: 'West Africa Time (WAT)' }]} value={form.timezone || 'WAT'} />
        <ToggleRow label="Receive email notifications" desc="Get notified about invoices, payments, and updates." checked={form.emailNotifications} onClick={toggle('emailNotifications')} />
        <ToggleRow label="Compact sidebar mode" desc="Use a narrower sidebar for more screen space." checked={form.compactSidebar} onClick={toggle('compactSidebar')} />
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── General ───────────────────────────────────────────────────────────────
export function GeneralPage() {
  const { form, field, toggle, handleSave, isPending, saved, error } = useSettingsForm('general');
  return (
    <PageShell title="General" desc="Configure general system settings." icon={Settings}>
      <Section title="General Settings">
        <Select label="Default Currency" options={[{ value: 'NGN', label: 'NGN - Nigerian Naira' }, { value: 'USD', label: 'USD - US Dollar' }]} value={form.defaultCurrency || 'NGN'} />
        <Field label="Default Tax Rate (%)" type="number" placeholder="7.5" value={form.defaultTaxRate || ''} onChange={field('defaultTaxRate')} desc="Default VAT rate for new transactions." />
        <ToggleRow label="Auto-generate transaction numbers" checked={form.autoGenerateNumbers} onClick={toggle('autoGenerateNumbers')} />
        <ToggleRow label="Allow negative inventory" desc="Permit inventory to go below zero temporarily." checked={form.allowNegativeInventory} onClick={toggle('allowNegativeInventory')} />
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Currencies ────────────────────────────────────────────────────────────
export function CurrenciesPage() {
  const { form, handleSave, isPending, saved, error } = useSettingsForm('currencies');
  return (
    <PageShell title="Currencies" desc="Manage currencies used in your account." icon={CreditCard}>
      <Section title="Active Currencies">
        {!form.activeCurrencies || form.activeCurrencies.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No currencies configured.</p>
        ) : (
          <div className="space-y-2">
            {form.activeCurrencies.map((c: any) => (
              <div key={c.code} className="flex items-center justify-between border border-slate-100 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-bold">{c.symbol}</span>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{c.code} — {c.name}</p>
                    <p className="text-xs text-slate-400">1 {c.code} = ₦{c.rate}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Payment Terms ─────────────────────────────────────────────────────────
export function PaymentTermsPage() {
  const { form, handleSave, isPending, saved, error } = useSettingsForm('paymentTerms', { defaultTerm: 'net30' });
  return (
    <PageShell title="Payment Terms" desc="Define payment terms for customers and vendors." icon={Clock}>
      <Section title="Default Payment Terms">
        <div className="space-y-3">
          {[
            { label: 'Due on Receipt', value: 'dueonreceipt', days: 0 },
            { label: 'Net 15', value: 'net15', days: 15 },
            { label: 'Net 30', value: 'net30', days: 30 },
            { label: 'Net 60', value: 'net60', days: 60 },
          ].map(t => (
            <label key={t.value} className="flex items-center justify-between border border-slate-100 rounded-lg px-4 py-3 cursor-pointer hover:bg-slate-50">
              <div>
                <p className="text-sm font-medium text-slate-700">{t.label}</p>
                <p className="text-xs text-slate-400">Payment due within {t.days} day{t.days !== 1 ? 's' : ''}</p>
              </div>
              <input type="radio" name="default-term" value={t.value} checked={form.defaultTerm === t.value} onChange={() => {}} className="w-4 h-4 text-indigo-600" />
            </label>
          ))}
        </div>
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Opening Balances ──────────────────────────────────────────────────────
export function OpeningBalancesPage() {
  const { form, handleSave, isPending, saved, error } = useSettingsForm('openingBalances');
  return (
    <PageShell title="Opening Balances" desc="Set up opening balances for your accounts." icon={Scale}>
      <Section title="Opening Balance Entry">
        <p className="text-xs text-slate-500 mb-3">Enter the opening balances for your accounts as of the start of your fiscal year.</p>
        {!form.balances || form.balances.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No opening balances set. Balances can be imported from your chart of accounts.</p>
        ) : (
          <div className="space-y-2">
            {form.balances.map((a: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm text-slate-700">{a.account}</p>
                </div>
                <input type="text" defaultValue={a.balance} className="w-40 px-3 py-2 text-sm border border-slate-200 rounded-lg text-right font-mono" />
              </div>
            ))}
          </div>
        )}
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Reminders ─────────────────────────────────────────────────────────────
export function RemindersPage() {
  const { form, field, toggle, handleSave, isPending, saved, error } = useSettingsForm('reminders', { enabled: true, emailEnabled: true });
  return (
    <PageShell title="Reminders" desc="Configure automated payment reminders for overdue invoices." icon={Bell}>
      <Section title="Payment Reminders">
        <ToggleRow label="Enable automatic reminders" desc="Send reminders for overdue invoices automatically." checked={form.enabled} onClick={toggle('enabled')} />
        <Field label="First reminder after (days)" type="number" value={form.firstAfter ?? ''} onChange={field('firstAfter')} placeholder="1" desc="Days after the due date." />
        <Field label="Second reminder after (days)" type="number" value={form.secondAfter ?? ''} onChange={field('secondAfter')} placeholder="7" />
        <Field label="Final reminder after (days)" type="number" value={form.finalAfter ?? ''} onChange={field('finalAfter')} placeholder="15" />
        <ToggleRow label="Send reminder via email" checked={form.emailEnabled} onClick={toggle('emailEnabled')} />
        <ToggleRow label="Send reminder via SMS" checked={form.smsEnabled} onClick={toggle('smsEnabled')} />
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Customer Portal ───────────────────────────────────────────────────────
export function CustomerPortalPage() {
  const { form, field, toggle, handleSave, isPending, saved, error } = useSettingsForm('customerPortal', { enabled: true, allowDownload: true, allowPayments: true, showHistory: true });
  return (
    <PageShell title="Customer Portal" desc="Configure your customer self-service portal." icon={Store}>
      <Section title="Portal Settings">
        <ToggleRow label="Enable Customer Portal" desc="Allow customers to view invoices and make payments online." checked={form.enabled} onClick={toggle('enabled')} />
        <ToggleRow label="Allow customers to download invoices" checked={form.allowDownload} onClick={toggle('allowDownload')} />
        <ToggleRow label="Allow customers to make payments via portal" checked={form.allowPayments} onClick={toggle('allowPayments')} />
        <ToggleRow label="Show payment history" checked={form.showHistory} onClick={toggle('showHistory')} />
        <Field label="Portal custom message" placeholder="Welcome to our billing portal" value={form.customMessage || ''} onChange={field('customMessage')} desc="Shown at the top of the portal login page." />
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Vendor Portal ─────────────────────────────────────────────────────────
export function VendorPortalPage() {
  const { form, field, toggle, handleSave, isPending, saved, error } = useSettingsForm('vendorPortal', { enabled: true, showPaymentHistory: true });
  return (
    <PageShell title="Vendor Portal" desc="Configure your vendor self-service portal." icon={Boxes}>
      <Section title="Portal Settings">
        <ToggleRow label="Enable Vendor Portal" desc="Allow vendors to view purchase orders and bills online." checked={form.enabled} onClick={toggle('enabled')} />
        <ToggleRow label="Allow vendors to submit invoices" checked={form.allowSubmit} onClick={toggle('allowSubmit')} />
        <ToggleRow label="Show payment history to vendors" checked={form.showPaymentHistory} onClick={toggle('showPaymentHistory')} />
        <Field label="Portal custom message" placeholder="Welcome to our vendor portal" value={form.customMessage || ''} onChange={field('customMessage')} />
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Transaction Number Series ─────────────────────────────────────────────
export function TxnNumberingPage() {
  const { form, field, handleSave, isPending, saved, error } = useSettingsForm('txnNumbering');
  const series = ['Invoices', 'Quotes', 'Sales Orders', 'Purchase Orders', 'Bills', 'Payments Received', 'Payments Made', 'Credit Notes', 'Expenses'];
  return (
    <PageShell title="Transaction Number Series" desc="Configure numbering prefixes for your transactions." icon={Hash}>
      <Section title="Numbering Series">
        {series.map(s => {
          const key = s.toLowerCase().replace(/ /g, '');
          return (
            <div key={s} className="flex items-center gap-4 py-2 border-b border-slate-50 last:border-0">
              <span className="w-36 text-sm text-slate-700">{s}</span>
              <input type="text" value={form[key] || ''} onChange={field(key)} className="w-28 px-3 py-1.5 text-sm border border-slate-200 rounded-lg font-mono" />
            </div>
          );
        })}
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── PDF Templates ─────────────────────────────────────────────────────────
export function PdfTemplatesPage() {
  const { form, handleSave, isPending, saved, error } = useSettingsForm('pdfTemplates');
  return (
    <PageShell title="PDF Templates" desc="Customize the layout of your PDF documents." icon={LayoutTemplate}>
      <Section title="Document Templates">
        {['Invoice', 'Quote', 'Sales Order', 'Purchase Order', 'Bill', 'Credit Note'].map(t => {
          const key = t.toLowerCase().replace(/ /g, '');
          return (
            <div key={t} className="flex items-center justify-between border border-slate-100 rounded-lg px-4 py-3 mb-2">
              <div className="flex items-center gap-3">
                <FileText size={16} className="text-slate-400" />
                <span className="text-sm text-slate-700">{t} Template</span>
              </div>
              <select value={form[key] || 'default'} onChange={field(key)} className="text-xs border border-slate-200 rounded px-2 py-1">
                <option value="default">Default</option>
                <option value="modern">Modern</option>
                <option value="classic">Classic</option>
              </select>
            </div>
          );
        })}
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Email Notifications ───────────────────────────────────────────────────
export function EmailNotificationsPage() {
  const { form, toggle, handleSave, isPending, saved, error } = useSettingsForm('emailNotifications');
  const triggers = ['Invoice Sent', 'Payment Received', 'Invoice Overdue', 'Credit Note Issued', 'Purchase Order Received', 'Bill Due Reminder', 'Quote Accepted', 'Account Statement'];
  return (
    <PageShell title="Email Notifications" desc="Configure email notifications sent to customers and vendors." icon={Mail}>
      <Section title="Notification Triggers">
        {triggers.map(n => {
          const key = n.toLowerCase().replace(/ /g, '');
          return (
            <div key={n} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
              <span className="text-sm text-slate-700">{n}</span>
              <ToggleRow label="" checked={form[key]} onClick={toggle(key)} />
            </div>
          );
        })}
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Reporting Tags ────────────────────────────────────────────────────────
export function ReportingTagsPage() {
  const { form, handleSave, isPending, saved, error } = useSettingsForm('reportingTags');
  const tags = form.tags || [];
  return (
    <PageShell title="Reporting Tags" desc="Create and manage tags for categorizing transactions." icon={Tag}>
      <Section title="Tags">
        <div className="flex flex-wrap gap-2">
          {tags.length === 0 ? (
            <p className="text-sm text-slate-400 py-2">No tags defined yet.</p>
          ) : tags.map((t: string, i: number) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
              <Tag size={12} /> {t}
            </span>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <input type="text" placeholder="New tag name..." className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg" />
          <button className="px-3 py-2 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700"><Plus size={14} /></button>
        </div>
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Web Tabs ──────────────────────────────────────────────────────────────
export function WebTabsPage() {
  const { form, handleSave, isPending, saved, error } = useSettingsForm('webTabs');
  return (
    <PageShell title="Web Tabs" desc="Manage custom web tabs in your sidebar navigation." icon={Layers}>
      <Section title="Custom Web Tabs">
        <p className="text-xs text-slate-500 mb-3">Add custom links to external tools in your SkyBooks sidebar.</p>
        {(form.tabs || []).length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No web tabs configured.</p>
        ) : (
          <div className="space-y-2">
            {(form.tabs || []).map((tab: any, i: number) => (
              <div key={i} className="flex items-center justify-between border border-slate-100 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <Link size={14} className="text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">{tab.label}</p>
                    <p className="text-xs text-slate-400">{tab.url}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Workflow Rules ────────────────────────────────────────────────────────
export function WorkflowRulesPage() {
  const { form, handleSave, isPending, saved, error } = useSettingsForm('workflowRules');
  const rules = form.rules || [];
  return (
    <PageShell title="Workflow Rules" desc="Create automated rules to trigger actions based on events." icon={Zap}>
      <Section title="Workflow Rules">
        {rules.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No workflow rules configured.</p>
        ) : rules.map((r: any, i: number) => (
          <div key={i} className="border border-slate-200 rounded-lg p-4 mb-3">
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
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Workflow Actions ──────────────────────────────────────────────────────
export function WorkflowActionsPage() {
  const { form, handleSave, isPending, saved, error } = useSettingsForm('workflowActions');
  const actions = form.actions || [];
  return (
    <PageShell title="Workflow Actions" desc="Define actions that can be triggered by workflow rules." icon={ListChecks}>
      <Section title="Available Actions">
        {actions.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No workflow actions configured.</p>
        ) : actions.map((a: any, i: number) => (
          <div key={i} className="flex items-center justify-between border border-slate-100 rounded-lg px-4 py-3 mb-2">
            <div>
              <p className="text-sm font-medium text-slate-700">{a.name}</p>
              <p className="text-xs text-slate-400">{a.desc}</p>
            </div>
          </div>
        ))}
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Workflow Logs ─────────────────────────────────────────────────────────
export function WorkflowLogsPage() {
  const { form, handleSave, isPending, saved, error } = useSettingsForm('workflowLogs');
  const logs = form.logs || [];
  return (
    <PageShell title="Workflow Logs" desc="View the execution history of your workflow rules." icon={History}>
      <Section title="Execution History">
        {logs.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No workflow execution logs yet.</p>
        ) : (
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
                {logs.map((l: any, i: number) => (
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
        )}
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Schedules ─────────────────────────────────────────────────────────────
export function SchedulesPage() {
  const { form, handleSave, isPending, saved, error } = useSettingsForm('schedules');
  const jobs = form.jobs || [];
  return (
    <PageShell title="Schedules" desc="Manage automated background jobs and schedules." icon={Timer}>
      <Section title="Scheduled Jobs">
        {jobs.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No scheduled jobs configured.</p>
        ) : jobs.map((s: any, i: number) => (
          <div key={i} className="flex items-center justify-between border border-slate-100 rounded-lg px-4 py-3 mb-2">
            <div>
                <p className="text-sm font-medium text-slate-700">{s.name}</p>
                <p className="text-xs text-slate-400">{s.freq} · Last: {s.last} · Next: {s.next}</p>
              </div>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full uppercase">Active</span>
            </div>
          ))}
      </Section>
    </PageShell>
  );
}

// ─── Customers & Vendors ───────────────────────────────────────────────────
export function ContactsSettingsPage() {
  const { form, toggle, handleSave, isPending, saved, error } = useSettingsForm('contacts', { autoGenerateIds: true, creditLimitEnabled: false });
  return (
    <PageShell title="Customers & Vendors" desc="Configure settings for customer and vendor management." icon={Users}>
      <Section title="General Settings">
        <ToggleRow label="Auto-generate customer IDs" desc="Automatically assign IDs to new customers." checked={form.autoGenerateIds} onClick={toggle('autoGenerateIds')} />
        <ToggleRow label="Require TIN for customers" desc="Make Tax Identification Number mandatory." checked={form.requireTin} onClick={toggle('requireTin')} />
        <ToggleRow label="Allow duplicate contact names" checked={form.allowDuplicates} onClick={toggle('allowDuplicates')} />
        <ToggleRow label="Enable customer credit limit" desc="Set maximum credit limits per customer." checked={form.creditLimitEnabled} onClick={toggle('creditLimitEnabled')} />
      </Section>
      <Section title="Default Contact Settings">
        <Select label="Default Payment Term" options={[{ value: 'net15', label: 'Net 15' }, { value: 'net30', label: 'Net 30' }, { value: 'dueonreceipt', label: 'Due on Receipt' }]} value={form.defaultPaymentTerm || 'net30'} />
        <Select label="Default Currency" options={[{ value: 'NGN', label: 'NGN' }, { value: 'USD', label: 'USD' }]} value={form.defaultCurrency || 'NGN'} />
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Items ─────────────────────────────────────────────────────────────────
export function ItemsSettingsPage() {
  const { form, field, toggle, handleSave, isPending, saved, error } = useSettingsForm('items', { trackInventory: true, autoGenerateSku: true });
  return (
    <PageShell title="Items" desc="Configure settings for your product and service items." icon={Package}>
      <Section title="Item Settings">
        <ToggleRow label="Track inventory quantity" desc="Enable quantity tracking for stock items." checked={form.trackInventory} onClick={toggle('trackInventory')} />
        <ToggleRow label="Allow fractional quantities" checked={form.allowFractional} onClick={toggle('allowFractional')} />
        <ToggleRow label="Auto-generate SKU for new items" checked={form.autoGenerateSku} onClick={toggle('autoGenerateSku')} />
        <ToggleRow label="Show item images in lists" checked={form.showImages} onClick={toggle('showImages')} />
      </Section>
      <Section title="Default Units">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Default Unit (Service)" placeholder="Hour" value={form.serviceUnit || 'Hour'} onChange={field('serviceUnit')} />
          <Field label="Default Unit (Product)" placeholder="Piece" value={form.productUnit || 'Piece'} onChange={field('productUnit')} />
        </div>
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Revenue Recognition ───────────────────────────────────────────────────
export function RevenueRecognitionPage() {
  const { form, toggle, handleSave, isPending, saved, error } = useSettingsForm('revenueRecognition', { method: 'accrual' });
  return (
    <PageShell title="Revenue Recognition" desc="Configure how revenue is recognized in your books." icon={BarChart2}>
      <Section title="Revenue Recognition Rules">
        <Select label="Method" options={[
          { value: 'accrual', label: 'Accrual Basis — Recognize when invoiced' },
          { value: 'cash', label: 'Cash Basis — Recognize when received' },
        ]} value={form.method || 'accrual'} />
        <ToggleRow label="Defer revenue for recurring invoices" desc="Recognize proportionally over the service period." checked={form.deferRevenue} onClick={toggle('deferRevenue')} />
        <ToggleRow label="Auto-create deferred revenue schedule" checked={form.autoDeferredSchedule} onClick={toggle('autoDeferredSchedule')} />
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Accountant ────────────────────────────────────────────────────────────
export function AccountantSettingsPage() {
  const { form, toggle, handleSave, isPending, saved, error } = useSettingsForm('accountant', { approvalWorkflow: true, lockPeriods: true });
  return (
    <PageShell title="Accountant" desc="Configure settings for your accounting module." icon={FileText}>
      <Section title="Accounting Preferences">
        <ToggleRow label="Enable journal entry approval workflow" desc="Require approval before journal entries are posted." checked={form.approvalWorkflow} onClick={toggle('approvalWorkflow')} />
        <ToggleRow label="Auto-post journal entries" desc="Automatically post journal entries for transactions." checked={form.autoPost} onClick={toggle('autoPost')} />
        <ToggleRow label="Lock past fiscal periods" desc="Prevent changes to transactions in closed periods." checked={form.lockPeriods} onClick={toggle('lockPeriods')} />
      </Section>
      <Section title="Default Accounts">
        <Select label="Default Revenue Account" options={[{ value: 'sales', label: 'Sales Revenue' }]} value={form.defaultRevenueAccount || 'sales'} />
        <Select label="Default Expense Account" options={[{ value: 'genexp', label: 'General Expenses' }]} value={form.defaultExpenseAccount || 'genexp'} />
        <Select label="Default Bank Account" options={[{ value: 'cbn', label: 'CBN Cash Account' }]} value={form.defaultBankAccount || 'cbn'} />
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Tasks ─────────────────────────────────────────────────────────────────
export function TasksSettingsPage() {
  const { form, toggle, handleSave, isPending, saved, error } = useSettingsForm('tasks', { enableAssignments: true, sendReminders: true, allowComments: true });
  return (
    <PageShell title="Tasks" desc="Configure settings for task management." icon={ListChecks}>
      <Section title="Task Settings">
        <ToggleRow label="Enable task assignments" desc="Assign tasks to team members." checked={form.enableAssignments} onClick={toggle('enableAssignments')} />
        <ToggleRow label="Send task reminders" checked={form.sendReminders} onClick={toggle('sendReminders')} />
        <ToggleRow label="Allow task comments" checked={form.allowComments} onClick={toggle('allowComments')} />
        <ToggleRow label="Auto-create tasks from workflows" desc="Allow workflow rules to create tasks." checked={form.autoCreateFromWorkflows} onClick={toggle('autoCreateFromWorkflows')} />
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Projects ──────────────────────────────────────────────────────────────
export function ProjectsSettingsPage() {
  const { form, toggle, handleSave, isPending, saved, error } = useSettingsForm('projects', { enableBilling: true, allowBudgets: true, enableMilestones: true });
  return (
    <PageShell title="Projects" desc="Configure settings for project management." icon={Layers}>
      <Section title="Project Settings">
        <ToggleRow label="Enable project billing" desc="Track billable hours and expenses per project." checked={form.enableBilling} onClick={toggle('enableBilling')} />
        <ToggleRow label="Auto-create invoices from projects" checked={form.autoCreateInvoices} onClick={toggle('autoCreateInvoices')} />
        <ToggleRow label="Allow project budgets" checked={form.allowBudgets} onClick={toggle('allowBudgets')} />
        <ToggleRow label="Enable project milestones" checked={form.enableMilestones} onClick={toggle('enableMilestones')} />
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Timesheet ─────────────────────────────────────────────────────────────
export function TimesheetSettingsPage() {
  const { form, field, toggle, handleSave, isPending, saved, error } = useSettingsForm('timesheet', { enabled: true, requireApproval: true, enableReminders: true });
  return (
    <PageShell title="Timesheet" desc="Configure timesheet settings." icon={FileClock}>
      <Section title="Timesheet Settings">
        <ToggleRow label="Enable timesheet tracking" desc="Track employee work hours." checked={form.enabled} onClick={toggle('enabled')} />
        <ToggleRow label="Require timesheet approval" desc="Managers must approve timesheets." checked={form.requireApproval} onClick={toggle('requireApproval')} />
        <ToggleRow label="Allow overtime tracking" checked={form.allowOvertime} onClick={toggle('allowOvertime')} />
        <ToggleRow label="Enable timesheet reminders" checked={form.enableReminders} onClick={toggle('enableReminders')} />
      </Section>
      <Section title="Default Configuration">
        <Field label="Standard work hours per day" type="number" value={form.standardHours ?? ''} onChange={field('standardHours')} />
        <Select label="Timesheet frequency" options={[{ value: 'weekly', label: 'Weekly' }, { value: 'biweekly', label: 'Bi-weekly' }, { value: 'monthly', label: 'Monthly' }]} value={form.frequency || 'weekly'} />
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Inventory Adjustments ─────────────────────────────────────────────────
export function InventoryAdjustmentsPage() {
  const { form, toggle, handleSave, isPending, saved, error } = useSettingsForm('inventoryAdjustments', { requireApproval: true, autoUpdateCost: true });
  return (
    <PageShell title="Inventory Adjustments" desc="Configure settings for inventory adjustments." icon={ArrowLeftRight}>
      <Section title="Adjustment Settings">
        <ToggleRow label="Require approval for adjustments" checked={form.requireApproval} onClick={toggle('requireApproval')} />
        <ToggleRow label="Auto-update average cost" desc="Recalculate average cost after adjustments." checked={form.autoUpdateCost} onClick={toggle('autoUpdateCost')} />
        <ToggleRow label="Track adjustment reasons" desc="Require a reason for each adjustment." checked={form.trackReasons} onClick={toggle('trackReasons')} />
        <ToggleRow label="Notify warehouse on adjustments" checked={form.notifyWarehouse} onClick={toggle('notifyWarehouse')} />
      </Section>
      <Section title="Default Adjustments Account">
        <Select label="Default Adjustment Account" options={[
          { value: 'invadj', label: 'Inventory Adjustments' },
          { value: 'loss', label: 'Inventory Loss' },
        ]} value={form.defaultAccount || 'invadj'} />
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Payment Gateways ──────────────────────────────────────────────────────
export function PaymentGatewaysPage() {
  const { form, toggle, handleSave, isPending, saved, error } = useSettingsForm('paymentGateways', { flutterwaveConnected: true });
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
        <ToggleRow label="Redirect to payment page after invoice creation" checked={form.redirectAfterCreation} onClick={toggle('redirectAfterCreation')} />
        <ToggleRow label="Allow partial payments" checked={form.allowPartialPayments} onClick={toggle('allowPartialPayments')} />
        <Select label="Default payment gateway" options={[{ value: 'flutterwave', label: 'Flutterwave' }, { value: 'paystack', label: 'Paystack' }]} value={form.defaultGateway || 'flutterwave'} />
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Sales Module Settings ─────────────────────────────────────────────────
function SalesModuleSection({ title, fields, form, toggle }: { title: string; fields: { key: string; label: string; desc: string }[]; form: Record<string, any>; toggle: (k: string) => () => void }) {
  return (
    <Section title={title} desc="Configure default settings for this transaction type.">
      {fields.map(f => (
        <ToggleRow key={f.key} label={f.label} desc={f.desc} checked={form[f.key]} onClick={toggle(f.key)} />
      ))}
    </Section>
  );
}

export function QuotesSettingsPage() {
  const { form, field, toggle, handleSave, isPending, saved, error } = useSettingsForm('quotes', { autoGenerateNumbers: true });
  return (
    <PageShell title="Quotes" desc="Configure default settings for quotes." icon={FileCheck}>
      <SalesModuleSection title="Quote Settings" fields={[
        { key: 'autoGenerateNumbers', label: 'Auto-generate quote numbers', desc: 'Automatically assign quote numbers.' },
        { key: 'sendPdfOnCreation', label: 'Send quote PDF on creation', desc: 'Email the PDF to the customer automatically.' },
        { key: 'requireApproval', label: 'Require customer approval', desc: 'Quotes require customer approval to convert.' },
      ]} form={form} toggle={toggle} />
      <Section title="Defaults">
        <Select label="Default Quote Status" options={[{ value: 'draft', label: 'Draft' }, { value: 'sent', label: 'Sent' }]} value={form.defaultStatus || 'draft'} />
        <Field label="Quote expiry (days)" type="number" value={form.expiryDays ?? ''} onChange={field('expiryDays')} />
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

export function SalesOrdersSettingsPage() {
  const { form, field, toggle, handleSave, isPending, saved, error } = useSettingsForm('salesOrders', { autoGenerateNumbers: true });
  return (
    <PageShell title="Sales Orders" desc="Configure default settings for sales orders." icon={ShoppingCart}>
      <SalesModuleSection title="Sales Order Settings" fields={[
        { key: 'autoGenerateNumbers', label: 'Auto-generate sales order numbers', desc: 'Automatically assign sales order numbers.' },
        { key: 'allowPartialFulfillment', label: 'Allow partial fulfillment', desc: 'Allow shipping items in multiple batches.' },
        { key: 'requireApproval', label: 'Require sales order approval', desc: 'Sales orders require approval before fulfillment.' },
      ]} form={form} toggle={toggle} />
      <Select label="Default Status" options={[{ value: 'draft', label: 'Draft' }, { value: 'confirmed', label: 'Confirmed' }]} value={form.defaultStatus || 'draft'} />
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

export function InvoicesSettingsPage() {
  const { form, field, toggle, handleSave, isPending, saved, error } = useSettingsForm('invoices', { autoGenerateNumbers: true, allowDiscounts: true });
  return (
    <PageShell title="Invoices" desc="Configure default settings for invoices." icon={Receipt}>
      <SalesModuleSection title="Invoice Settings" fields={[
        { key: 'autoGenerateNumbers', label: 'Auto-generate invoice numbers', desc: 'Automatically assign invoice numbers.' },
        { key: 'sendOnCreation', label: 'Send invoice via email on creation', desc: 'Email the invoice to the customer.' },
        { key: 'showDueDate', label: 'Show invoice due date prominently', desc: 'Display the due date in bold.' },
        { key: 'showPaymentTerms', label: 'Include payment terms on invoice', desc: 'Display payment terms on printed invoices.' },
        { key: 'allowDiscounts', label: 'Allow invoice discounts', desc: 'Enable discount fields on invoices.' },
      ]} form={form} toggle={toggle} />
      <Section title="Defaults">
        <Select label="Default Invoice Status" options={[{ value: 'draft', label: 'Draft' }, { value: 'sent', label: 'Sent' }]} value={form.defaultStatus || 'draft'} />
        <Select label="Default Payment Term" options={[{ value: 'net30', label: 'Net 30' }, { value: 'net15', label: 'Net 15' }, { value: 'dueonreceipt', label: 'Due on Receipt' }]} value={form.defaultPaymentTerm || 'net30'} />
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

export function RecurringInvoicesSettingsPage() {
  const { form, field, toggle, handleSave, isPending, saved, error } = useSettingsForm('recurringInvoices', { autoGenerateNumbers: true, sendAutomatically: true });
  return (
    <PageShell title="Recurring Invoices" desc="Configure default settings for recurring invoices." icon={Repeat}>
      <SalesModuleSection title="Recurring Invoice Settings" fields={[
        { key: 'autoGenerateNumbers', label: 'Auto-generate recurring invoice numbers', desc: 'Automatically assign invoice numbers from template.' },
        { key: 'sendAutomatically', label: 'Send invoice automatically', desc: 'Email the invoice on the scheduled date.' },
        { key: 'stopAfterOccurrences', label: 'Stop after N occurrences', desc: 'Automatically stop after a set number of cycles.' },
        { key: 'notifyBeforeGeneration', label: 'Notify before generation', desc: 'Send a reminder before the next invoice is generated.' },
      ]} form={form} toggle={toggle} />
      <Section title="Defaults">
        <Select label="Default Frequency" options={[{ value: 'monthly', label: 'Monthly' }, { value: 'weekly', label: 'Weekly' }, { value: 'yearly', label: 'Yearly' }]} value={form.defaultFrequency || 'monthly'} />
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

export function SalesReceiptsSettingsPage() {
  const { form, toggle, handleSave, isPending, saved, error } = useSettingsForm('salesReceipts', { autoGenerateNumbers: true });
  return (
    <PageShell title="Sales Receipts" desc="Configure default settings for sales receipts." icon={ReceiptText}>
      <SalesModuleSection title="Sales Receipt Settings" fields={[
        { key: 'autoGenerateNumbers', label: 'Auto-generate receipt numbers', desc: 'Automatically assign receipt numbers.' },
        { key: 'emailToCustomer', label: 'Email receipt to customer', desc: 'Send a copy of the receipt via email.' },
        { key: 'printOnPos', label: 'Print receipt on POS', desc: 'Enable receipt printing for POS transactions.' },
      ]} form={form} toggle={toggle} />
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

export function PaymentsReceivedSettingsPage() {
  const { form, toggle, handleSave, isPending, saved, error } = useSettingsForm('paymentsReceived', { autoGenerateNumbers: true, autoAllocate: true });
  return (
    <PageShell title="Payments Received" desc="Configure default settings for received payments." icon={Banknote}>
      <SalesModuleSection title="Payment Settings" fields={[
        { key: 'autoGenerateNumbers', label: 'Auto-generate payment numbers', desc: 'Automatically assign payment numbers.' },
        { key: 'autoAllocate', label: 'Auto-allocate payments', desc: 'Automatically allocate payments to outstanding invoices.' },
        { key: 'sendConfirmation', label: 'Send payment confirmation', desc: 'Email payment confirmation to customer.' },
      ]} form={form} toggle={toggle} />
      <Section title="Defaults">
        <Select label="Default Payment Method" options={[
          { value: 'bank', label: 'Bank Transfer' },
          { value: 'card', label: 'Card Payment' },
          { value: 'cash', label: 'Cash' },
          { value: 'pos', label: 'POS' },
        ]} value={form.defaultPaymentMethod || 'bank'} />
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

export function CreditNotesSettingsPage() {
  const { form, toggle, handleSave, isPending, saved, error } = useSettingsForm('creditNotes', { autoGenerateNumbers: true });
  return (
    <PageShell title="Credit Notes" desc="Configure default settings for credit notes." icon={FileText}>
      <SalesModuleSection title="Credit Note Settings" fields={[
        { key: 'autoGenerateNumbers', label: 'Auto-generate credit note numbers', desc: 'Automatically assign credit note numbers.' },
        { key: 'allowWithoutInvoice', label: 'Allow credit notes without invoice', desc: 'Create standalone credit notes.' },
        { key: 'notifyCustomer', label: 'Notify customer on issuance', desc: 'Email the credit note to the customer.' },
      ]} form={form} toggle={toggle} />
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

export function DeliveryNotesSettingsPage() {
  const { form, toggle, handleSave, isPending, saved, error } = useSettingsForm('deliveryNotes', { autoGenerateNumbers: true });
  return (
    <PageShell title="Delivery Notes" desc="Configure default settings for delivery notes." icon={Truck}>
      <SalesModuleSection title="Delivery Note Settings" fields={[
        { key: 'autoGenerateNumbers', label: 'Auto-generate delivery note numbers', desc: 'Automatically assign delivery note numbers.' },
        { key: 'showSerialNumbers', label: 'Show item serial numbers', desc: 'Display serial numbers on delivery notes.' },
        { key: 'emailToCustomer', label: 'Email delivery note to customer', desc: 'Send a copy via email.' },
      ]} form={form} toggle={toggle} />
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

export function PackingSlipsSettingsPage() {
  const { form, toggle, handleSave, isPending, saved, error } = useSettingsForm('packingSlips', { autoGenerateNumbers: true });
  return (
    <PageShell title="Packing Slips" desc="Configure default settings for packing slips." icon={ClipboardList}>
      <SalesModuleSection title="Packing Slip Settings" fields={[
        { key: 'autoGenerateNumbers', label: 'Auto-generate packing slip numbers', desc: 'Automatically assign packing slip numbers.' },
        { key: 'showBatchNumbers', label: 'Show batch numbers', desc: 'Display batch/lot numbers on packing slips.' },
        { key: 'includeBarcode', label: 'Include barcode', desc: 'Include barcode on printed packing slips.' },
      ]} form={form} toggle={toggle} />
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Purchases Module Settings ─────────────────────────────────────────────
function PurchasesModuleSection({ title, fields, form, toggle }: { title: string; fields: { key: string; label: string; desc: string }[]; form: Record<string, any>; toggle: (k: string) => () => void }) {
  return (
    <Section title={title} desc="Configure default settings for this transaction type.">
      {fields.map(f => (
        <ToggleRow key={f.key} label={f.label} desc={f.desc} checked={form[f.key]} onClick={toggle(f.key)} />
      ))}
    </Section>
  );
}

export function ExpensesSettingsPage() {
  const { form, toggle, handleSave, isPending, saved, error } = useSettingsForm('expenses', { autoGenerateNumbers: true, allowAttachments: true });
  return (
    <PageShell title="Expenses" desc="Configure default settings for expenses." icon={CreditCard}>
      <PurchasesModuleSection title="Expense Settings" fields={[
        { key: 'autoGenerateNumbers', label: 'Auto-generate expense numbers', desc: 'Automatically assign expense numbers.' },
        { key: 'allowAttachments', label: 'Allow expense attachments', desc: 'Upload receipts and documents to expenses.' },
        { key: 'requireApproval', label: 'Require expense approval', desc: 'Expenses require manager approval.' },
        { key: 'enableMileageTracking', label: 'Enable mileage tracking', desc: 'Track business mileage in expenses.' },
      ]} form={form} toggle={toggle} />
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

export function RecurringExpensesSettingsPage() {
  const { form, toggle, handleSave, isPending, saved, error } = useSettingsForm('recurringExpenses', { autoGenerateNumbers: true });
  return (
    <PageShell title="Recurring Expenses" desc="Configure default settings for recurring expenses." icon={Repeat}>
      <PurchasesModuleSection title="Recurring Expense Settings" fields={[
        { key: 'autoGenerateNumbers', label: 'Auto-generate expense numbers', desc: 'Automatically assign expense numbers.' },
        { key: 'notifyBeforeGeneration', label: 'Notify before generation', desc: 'Send a reminder before the next expense is created.' },
        { key: 'autoPostJournals', label: 'Auto-post journal entries', desc: 'Automatically post to the general ledger.' },
      ]} form={form} toggle={toggle} />
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

export function PurchaseOrdersSettingsPage() {
  const { form, field, toggle, handleSave, isPending, saved, error } = useSettingsForm('purchaseOrders', { autoGenerateNumbers: true });
  return (
    <PageShell title="Purchase Orders" desc="Configure default settings for purchase orders." icon={ShoppingCart}>
      <PurchasesModuleSection title="Purchase Order Settings" fields={[
        { key: 'autoGenerateNumbers', label: 'Auto-generate PO numbers', desc: 'Automatically assign purchase order numbers.' },
        { key: 'allowPartialReceipts', label: 'Allow partial receipts', desc: 'Receive items in multiple batches.' },
        { key: 'requireApproval', label: 'Require PO approval', desc: 'Purchase orders require approval before sending.' },
      ]} form={form} toggle={toggle} />
      <Select label="Default Status" options={[{ value: 'draft', label: 'Draft' }, { value: 'sent', label: 'Sent' }]} value={form.defaultStatus || 'draft'} />
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

export function BillsSettingsPage() {
  const { form, field, toggle, handleSave, isPending, saved, error } = useSettingsForm('bills', { autoGenerateNumbers: true, allowAttachments: true });
  return (
    <PageShell title="Bills" desc="Configure default settings for bills." icon={FileText}>
      <PurchasesModuleSection title="Bill Settings" fields={[
        { key: 'autoGenerateNumbers', label: 'Auto-generate bill numbers', desc: 'Automatically assign bill numbers.' },
        { key: 'allowAttachments', label: 'Allow bill attachments', desc: 'Upload vendor invoices to bills.' },
        { key: 'requireApproval', label: 'Require bill approval', desc: 'Bills require approval before payment.' },
        { key: 'enableRecurring', label: 'Enable recurring bills', desc: 'Allow recurring bill templates.' },
      ]} form={form} toggle={toggle} />
      <Select label="Default Payment Term" options={[{ value: 'net30', label: 'Net 30' }, { value: 'net15', label: 'Net 15' }, { value: 'dueonreceipt', label: 'Due on Receipt' }]} value={form.defaultPaymentTerm || 'net30'} />
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

export function RecurringBillsSettingsPage() {
  const { form, toggle, handleSave, isPending, saved, error } = useSettingsForm('recurringBills', { autoGenerateNumbers: true });
  return (
    <PageShell title="Recurring Bills" desc="Configure default settings for recurring bills." icon={FileClock}>
      <PurchasesModuleSection title="Recurring Bill Settings" fields={[
        { key: 'autoGenerateNumbers', label: 'Auto-generate bill numbers', desc: 'Automatically assign bill numbers.' },
        { key: 'notifyBeforeGeneration', label: 'Notify before generation', desc: 'Send a reminder before the next bill is created.' },
        { key: 'autoCreatePayment', label: 'Auto-create payment', desc: 'Automatically create a payment for recurring bills.' },
      ]} form={form} toggle={toggle} />
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

export function PaymentsMadeSettingsPage() {
  const { form, toggle, handleSave, isPending, saved, error } = useSettingsForm('paymentsMade', { autoGenerateNumbers: true, autoAllocate: true });
  return (
    <PageShell title="Payments Made" desc="Configure default settings for payments made." icon={Wallet}>
      <PurchasesModuleSection title="Payment Settings" fields={[
        { key: 'autoGenerateNumbers', label: 'Auto-generate payment numbers', desc: 'Automatically assign payment numbers.' },
        { key: 'autoAllocate', label: 'Auto-allocate payments', desc: 'Automatically allocate to outstanding bills.' },
        { key: 'sendConfirmation', label: 'Send payment confirmation to vendor', desc: 'Email payment confirmation.' },
      ]} form={form} toggle={toggle} />
      <Select label="Default Payment Method" options={[
        { value: 'bank', label: 'Bank Transfer' },
        { value: 'cheque', label: 'Cheque' },
        { value: 'cash', label: 'Cash' },
      ]} value={form.defaultPaymentMethod || 'bank'} />
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

export function VendorCreditsSettingsPage() {
  const { form, toggle, handleSave, isPending, saved, error } = useSettingsForm('vendorCredits', { autoGenerateNumbers: true });
  return (
    <PageShell title="Vendor Credits" desc="Configure default settings for vendor credits." icon={Banknote}>
      <PurchasesModuleSection title="Vendor Credit Settings" fields={[
        { key: 'autoGenerateNumbers', label: 'Auto-generate credit note numbers', desc: 'Automatically assign vendor credit numbers.' },
        { key: 'allowWithoutBill', label: 'Allow credits without bill', desc: 'Create standalone vendor credits.' },
        { key: 'autoApplyToBills', label: 'Auto-apply to future bills', desc: 'Automatically apply credits to new bills.' },
      ]} form={form} toggle={toggle} />
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Custom Modules ────────────────────────────────────────────────────────
export function CustomModulesPage() {
  const { form, handleSave, isPending, saved, error } = useSettingsForm('customModules');
  const modules = form.modules || [];
  return (
    <PageShell title="Custom Modules" desc="Manage custom modules and integrations." icon={PuzzleIcon}>
      <Section title="Installed Modules">
        {modules.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No custom modules installed.</p>
        ) : modules.map((m: any, i: number) => (
          <div key={i} className="flex items-center justify-between border border-slate-200 rounded-lg p-4 mb-2">
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
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}
