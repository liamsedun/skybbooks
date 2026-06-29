import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useOrgSettings } from '../../hooks/useOrgSettings';
import { orgApi, authApi, accountantApi, api } from '../../lib/api';

function useSettingsForm(key: string, defaults?: Record<string, any>) {
  const { settings, save, isPending } = useOrgSettings();
  const [form, setForm] = useState<Record<string, any>>(defaults || {});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings[key]) {
      if (Array.isArray(settings[key])) {
        setForm((prev: Record<string, any>) => ({ ...prev, [key]: settings[key] }));
      } else {
        setForm((prev: Record<string, any>) => ({ ...prev, ...settings[key] }));
      }
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
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | string) => {
      const value = typeof e === 'string' ? e : e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
      setForm((p: Record<string, any>) => ({ ...p, [name]: value }));
    };
  }

  function toggle(name: string) {
    return () => setForm((p: Record<string, any>) => ({ ...p, [name]: !p[name] }));
  }

  return { form, field, toggle, handleSave, isPending, saved, error, setForm, save, setSaved, setError };
}
import {
  Building2, Paintbrush, Globe, MapPinned, Users, Shield, UserCog,
  Settings, CreditCard, Clock, Scale, Bell, Store, Boxes, Hash,
  LayoutTemplate, Mail, Tag, Layers, Zap, ListChecks, History, Timer,
  Package, BarChart2, FileText, FileClock, Repeat, ReceiptText, Banknote,
  FileCheck, Truck, ClipboardList, ArrowLeftRight, Wallet, PuzzleIcon,
  ShoppingCart, Receipt, ToggleLeft, Download, Upload, Link,
  Lightbulb, Eye, Pencil, Trash2, Plus, Check, X,
  Loader2, Save, CheckCircle2, AlertCircle, MapPin, Calendar, Phone, Search, Star,
  ChevronLeft, ChevronRight, Activity, Code, Filter, Info,
} from 'lucide-react';

import { AccountSearchSelect } from '../../components/ui/AccountSearchSelect';

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
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-4 mb-5">
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
    <div className="flex items-center justify-between py-2 flex-wrap gap-2">
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
          <div className="flex items-center gap-5 pb-4 border-b border-slate-100 flex-wrap">
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
            <FieldWithIcon icon={Calendar} label="Fiscal Year Start" type="date" value={form.fiscalYearStart} onChange={f('fiscalYearStart')} hint="Day and month your financial year begins." />
          </div>
        </Section>

        {/* Read-only info */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-5">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Shield size={14} />
            Account Info
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
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
  const { data: org } = useQuery<OrgData>({
    queryKey: ['org'],
    queryFn: orgApi.getOrg,
  });

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
          <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden shrink-0">
            {org?.logoUrl
              ? <img src={org.logoUrl} alt="Logo" className="w-full h-full object-contain" />
              : <Building2 size={28} className="text-slate-300" />}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
  const [showModal, setShowModal] = useState(false);
  const [domainInput, setDomainInput] = useState('');
  const { form, field, handleSave, isPending, saved, error } = useSettingsForm('domain');
  return (
    <PageShell title="Custom Domain" desc="Connect your own domain to host your customer portal and documents." icon={Globe}>
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3 mb-5">
        <div className="flex items-start gap-3">
          <Globe size={20} className="text-indigo-600 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Custom Domain Mapping</h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              This feature lets your customers access their Customer Portal and vendor portal with a custom domain name.
            </p>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              For example, let's say your company's name is Zylker and your website's domain name is{' '}
              https://www.zylker.com. With domain mapping, your customers can access their Customer Portal from the
              subdomain <strong>https://books.zylker.com/portal</strong> instead of{' '}
              <strong>https://books.skyaccounting.com.ng/portal</strong>.
            </p>
            <a href="#" className="inline-flex items-center gap-1 text-xs text-indigo-600 font-medium mt-2 hover:underline">
              Read more about Domain Mapping
            </a>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center mb-5">
        <Globe size={36} className="text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500">You have not mapped a custom domain yet.</p>
        <button
          onClick={() => { setDomainInput(''); setShowModal(true); }}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition"
        >
          <Plus size={16} /> Add Custom Domain
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden z-10">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-indigo-600">Domain mapping</span>
                <span className="text-slate-300">/</span>
                <span className="text-slate-500">Add Domain</span>
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">3</span>
                <span className="text-slate-300">/</span>
                <span className="text-slate-500">Verify Ownership</span>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div className="space-y-1">
                <p className="text-xs font-medium text-indigo-600">Step 1</p>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 space-y-2">
                  <p className="font-medium text-slate-800">Follow these steps before submitting your custom domain name:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Go to your domain name provider's website and locate the DNS management page.</li>
                    <li>In this website, create a CNAME record by entering the following information:</li>
                  </ol>
                  <div className="bg-white border border-slate-200 rounded px-3 py-2 space-y-1 mt-2 font-mono text-xs">
                    <p><span className="font-medium text-slate-700">Host Name:</span> {domainInput || 'book.skyaccounting.com'}</p>
                    <p><span className="font-medium text-slate-700">CNAME:</span> knyk3m.books.cs.skyaccounting.com.ng</p>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-indigo-600">Step 2</p>
                <label className="block text-xs font-medium text-slate-600">Enter your corporate subdomain</label>
                <input
                  type="text"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="https://book.skyaccounting.com"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 placeholder-slate-400 mt-1"
                />
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-indigo-600">Step 3</p>
                <div className="flex items-center gap-3 pt-1">
                  <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition">
                    Submit &amp; Verify
                  </button>
                  <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition">
                    Cancel
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Note: You will not be able to verify your custom domain name until it reflects on the DNS server.
                This process could take some time.
              </p>
            </div>
          </div>
        </div>
      )}

      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Locations ─────────────────────────────────────────────────────────────
export function LocationsPage() {
  const { form, setForm, handleSave, save, isPending, saved, error, setSaved, setError } = useSettingsForm('locations');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewOnly, setViewOnly] = useState(false);
  const [locForm, setLocForm] = useState<Record<string, any>>({ type: 'business' });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const locations = form.locations || [];

  function f(name: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setLocForm((p: Record<string, any>) => ({ ...p, [name]: e.target.value }));
  }

  function openAddForm() {
    setEditingId(null);
    setViewOnly(false);
    setLocForm({ type: 'business' });
    setLogoPreview(null);
    setShowForm(true);
  }

  function openViewForm(loc: any) {
    setEditingId(loc.id);
    setViewOnly(true);
    setLocForm({ ...loc });
    setLogoPreview(loc.logoUrl || null);
    setShowForm(true);
  }

  function openEditForm(loc: any) {
    setEditingId(loc.id);
    setViewOnly(false);
    setLocForm({ ...loc });
    setLogoPreview(loc.logoUrl || null);
    setShowForm(true);
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setLogoPreview(previewUrl);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = reader.result as string;
      setLocForm((p: Record<string, any>) => ({ ...p, logoUrl: dataUri }));
    };
    reader.readAsDataURL(file);
  }

  function persistLocations(newLocations: any[]) {
    setForm((p: Record<string, any>) => ({ ...p, locations: newLocations }));
    save({ locations: newLocations }, {
      onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 3000); },
      onError: (err: any) => setError(err?.response?.data?.error || err?.message || 'Save failed'),
    });
  }

  function handleSaveLocation() {
    const current = form.locations || [];
    let newLocations: any[];
    if (editingId) {
      newLocations = current.map((l: any) => l.id === editingId ? { ...locForm, id: editingId } : l);
    } else {
      newLocations = [...current, { ...locForm, id: Date.now().toString() }];
    }
    persistLocations(newLocations);
    setLocForm({ type: 'business' });
    setLogoPreview(null);
    setEditingId(null);
    setShowForm(false);
  }

  function handleDeleteLocation(id: string) {
    const newLocations = (form.locations || []).filter((l: any) => l.id !== id);
    persistLocations(newLocations);
  }

  return (
    <PageShell title="Locations" desc="Manage your business locations for multi-branch operations." icon={MapPinned}>
      <Section title="Your Locations">
        {locations.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No locations added yet.</p>
        ) : (
          <div className="space-y-3">
            {locations.map((loc: any, i: number) => (
              <div key={i} className="flex items-center justify-between border border-slate-100 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden shrink-0">
                    {loc.logoUrl
                      ? <img src={loc.logoUrl} alt="" className="w-full h-full object-contain" />
                      : <MapPinned size={14} className="text-slate-400" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{loc.name}</p>
                    <p className="text-xs text-slate-400">{loc.city || loc.street1 || ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openViewForm(loc)} className="text-slate-400 hover:text-indigo-600 transition"><Eye size={14} /></button>
                  <button onClick={() => openEditForm(loc)} className="text-slate-400 hover:text-indigo-600 transition"><Pencil size={14} /></button>
                  <button onClick={() => handleDeleteLocation(loc.id)} className="text-slate-400 hover:text-red-500 transition"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={openAddForm}
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition"
        >
          <Plus size={16} /> Add Location
        </button>
      </Section>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 overflow-y-auto">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 z-10">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">{viewOnly ? 'View Location' : editingId ? 'Edit Location' : 'Add Location'}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 transition">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Location Type */}
              <div>
                <p className="text-xs font-medium text-slate-600 mb-3">Location Type</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={viewOnly}
                    onClick={() => setLocForm((p: Record<string, any>) => ({ ...p, type: 'business' }))}
                    className={`border rounded-xl p-4 text-left transition ${viewOnly ? 'cursor-default' : ''} ${locForm.type === 'business' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 size={16} className="text-indigo-600" />
                      <span className="text-sm font-medium text-slate-800">Business Location</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      A Business Location represents your organization or office's operational location. It is used
                      to record transactions, assess regional performance, and monitor stock levels for items stored
                      at this location.
                    </p>
                  </button>
                  <button
                    type="button"
                    disabled={viewOnly}
                    onClick={() => setLocForm((p: Record<string, any>) => ({ ...p, type: 'warehouse' }))}
                    className={`border rounded-xl p-4 text-left transition ${viewOnly ? 'cursor-default' : ''} ${locForm.type === 'warehouse' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Store size={16} className="text-indigo-600" />
                      <span className="text-sm font-medium text-slate-800">Warehouse Only Location</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      A Warehouse Only Location refers to where your items are stored. It helps track and monitor
                      stock levels for items stored at this location.
                    </p>
                  </button>
                </div>
              </div>

              {/* Logo */}
              <div>
                <p className="text-xs font-medium text-slate-600 mb-2">Logo</p>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden shrink-0">
                    {logoPreview
                      ? <img src={logoPreview} alt="" className="w-full h-full object-contain" />
                      : <Building2 size={24} className="text-slate-300" />}
                  </div>
                  <label className={`inline-flex items-center gap-2 px-3 py-1.5 text-white text-xs font-medium rounded-lg transition ${viewOnly ? 'bg-slate-300 cursor-not-allowed' : 'cursor-pointer bg-indigo-600 hover:bg-indigo-700'}`}>
                    <Upload size={12} /> Upload Logo
                    <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleLogoChange} disabled={viewOnly} />
                  </label>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Name</label>
                <input
                  type="text"
                  value={locForm.name || ''}
                  onChange={f('name')}
                  placeholder="Location Name"
                  disabled={viewOnly}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 placeholder-slate-400 disabled:bg-slate-50 disabled:text-slate-500"
                />
                <p className="text-xs text-slate-400 mt-1">This is a Child Location</p>
              </div>

              {/* Address */}
              <div>
                <p className="text-xs font-medium text-slate-600 mb-3">Address</p>
                <div className="space-y-3">
                  <input type="text" value={locForm.attention || ''} onChange={f('attention')} placeholder="Attention" disabled={viewOnly} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 placeholder-slate-400 disabled:bg-slate-50 disabled:text-slate-500" />
                  <input type="text" value={locForm.street1 || ''} onChange={f('street1')} placeholder="Street 1" disabled={viewOnly} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 placeholder-slate-400 disabled:bg-slate-50 disabled:text-slate-500" />
                  <input type="text" value={locForm.street2 || ''} onChange={f('street2')} placeholder="Street 2" disabled={viewOnly} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 placeholder-slate-400 disabled:bg-slate-50 disabled:text-slate-500" />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input type="text" value={locForm.city || ''} onChange={f('city')} placeholder="City" disabled={viewOnly} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 placeholder-slate-400 disabled:bg-slate-50 disabled:text-slate-500" />
                    <input type="text" value={locForm.zip || ''} onChange={f('zip')} placeholder="ZIP/Postal Code" disabled={viewOnly} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 placeholder-slate-400 disabled:bg-slate-50 disabled:text-slate-500" />
                    <input type="text" value={locForm.state || ''} onChange={f('state')} placeholder="State/Province" disabled={viewOnly} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 placeholder-slate-400 disabled:bg-slate-50 disabled:text-slate-500" />
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Phone</label>
                  <input type="text" value={locForm.phone || ''} onChange={f('phone')} placeholder="Phone" disabled={viewOnly} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 placeholder-slate-400 disabled:bg-slate-50 disabled:text-slate-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Fax Number</label>
                  <input type="text" value={locForm.fax || ''} onChange={f('fax')} placeholder="Fax Number" disabled={viewOnly} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 placeholder-slate-400 disabled:bg-slate-50 disabled:text-slate-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Email</label>
                <input type="email" value={locForm.email || ''} onChange={f('email')} placeholder="Email address" disabled={viewOnly} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 placeholder-slate-400 disabled:bg-slate-50 disabled:text-slate-500" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Website URL</label>
                <input type="text" value={locForm.website2 || ''} onChange={f('website2')} placeholder="Website URL" disabled={viewOnly} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 placeholder-slate-400 disabled:bg-slate-50 disabled:text-slate-500" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Primary Contact</label>
                <select value={locForm.primaryContact || ''} onChange={f('primaryContact')} disabled={viewOnly} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 disabled:bg-slate-50 disabled:text-slate-500">
                  <option value="">Select a contact</option>
                  <option value="olalekan">Olalekan Edun</option>
                </select>
              </div>

              {/* Transaction Number Series */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                <p className="text-xs font-medium text-slate-600">Transaction Number Series</p>
                <button disabled={viewOnly} className={`inline-flex items-center gap-1.5 text-xs font-medium transition ${viewOnly ? 'text-slate-300 cursor-not-allowed' : 'text-indigo-600 hover:text-indigo-700'}`}>
                  <Plus size={14} /> Add Transaction Series
                </button>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Default Transaction Number Series</label>
                  <select disabled={viewOnly} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 disabled:bg-slate-50 disabled:text-slate-500">
                    <option value="">None</option>
                  </select>
                </div>
              </div>

              {/* Location Access */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                <p className="text-xs font-medium text-slate-600">Location Access</p>
                <p className="text-xs text-slate-400">1 user(s) selected</p>
                <p className="text-xs text-slate-500">Selected users can create and access transactions for this location.</p>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="access-all" disabled={viewOnly} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50" />
                  <label htmlFor="access-all" className="text-xs text-slate-600">Provide access to all users</label>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-left">
                        <th className="px-3 py-2 font-medium text-slate-500">Users</th>
                        <th className="px-3 py-2 font-medium text-slate-500">Role</th>
                        <th className="px-3 py-2 font-medium text-slate-500">Remove</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-medium text-indigo-700">OE</div>
                            <div>
                              <p className="text-xs font-medium text-slate-700">Olalekan Edun</p>
                              <p className="text-[10px] text-slate-400">info@skyaccounting.com.ng</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2"><span className="text-xs text-slate-600">Admin</span></td>
                        <td className="px-3 py-2"><button disabled={viewOnly} className="text-slate-400 hover:text-red-500 transition disabled:opacity-30"><Trash2 size={14} /></button></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition">
                Cancel
              </button>
              <button onClick={handleSaveLocation} disabled={viewOnly} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition disabled:bg-slate-300 disabled:cursor-not-allowed">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Users ─────────────────────────────────────────────────────────────────
export function UsersPage() {
  const queryClient = useQueryClient();
  const [showInviteUser, setShowInviteUser] = useState(false);
  const [showInviteAccountant, setShowInviteAccountant] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [inviteForm, setInviteForm] = useState<Record<string, any>>({});
  const [addUserForm, setAddUserForm] = useState<Record<string, any>>({});
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [locationSearch, setLocationSearch] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [addUserPending, setAddUserPending] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [addUserError, setAddUserError] = useState<string | null>(null);
  const [addUserSuccess, setAddUserSuccess] = useState<string | null>(null);

  const availableLocations = ['Abuja', 'Head Office, Lagos'];

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['orgUsers'],
    queryFn: orgApi.getUsers,
  });

  function refreshUsers() { queryClient.invalidateQueries({ queryKey: ['orgUsers'] }); }

  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  function openEditUser(u: any) {
    setEditingUser(u);
    setEditForm({ fullName: u.fullName || '', email: u.email || '', role: u.role || 'staff', isActive: u.isActive !== false });
    setEditError(null);
    setEditSuccess(null);
  }

  async function handleEditSave() {
    if (!editingUser) return;
    setEditError(null); setEditSuccess(null);
    if (!editForm.fullName?.trim()) { setEditError('Name is required.'); return; }
    if (!editForm.email?.trim()) { setEditError('Email is required.'); return; }
    setEditSaving(true);
    try {
      await orgApi.updateUser(editingUser.id, editForm);
      setEditSuccess('User updated successfully.');
      refreshUsers();
      setTimeout(() => { setEditingUser(null); }, 2000);
    } catch (err: any) {
      setEditError(err?.response?.data?.error || err?.message || 'Failed to update user.');
    } finally { setEditSaving(false); }
  }

  async function handleExportCsv() {
    try {
      const blob = await orgApi.exportUsersCsv();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'users.csv'; a.click();
      window.URL.revokeObjectURL(url);
    } catch { setInviteError('Failed to export CSV.'); }
  }

  async function handleExportPdf() {
    try {
      const blob = await orgApi.exportUsersPdf();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'users.pdf'; a.click();
      window.URL.revokeObjectURL(url);
    } catch { setInviteError('Failed to export PDF.'); }
  }

  function auf(name: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setAddUserForm((p: Record<string, any>) => ({ ...p, [name]: e.target.value }));
  }

  async function handleAddUser() {
    setAddUserError(null); setAddUserSuccess(null);
    const name = addUserForm.name?.trim();
    const email = addUserForm.email?.trim();
    const role = addUserForm.role;
    const password = addUserForm.password;
    if (!name || !email || !role || !password) { setAddUserError('All fields are required.'); return; }
    if (password.length < 6) { setAddUserError('Password must be at least 6 characters.'); return; }
    setAddUserPending(true);
    try {
      const result = await orgApi.createUser({ name, email, role, password });
      setAddUserSuccess(result.message || `User ${name} created successfully.`);
      setAddUserForm({});
      refreshUsers();
      setTimeout(() => { setShowAddUser(false); setAddUserSuccess(null); }, 3000);
    } catch (err: any) {
      setAddUserError(err?.response?.data?.error || err?.message || 'Failed to create user.');
    } finally { setAddUserPending(false); }
  }

  async function handleSendInvite(emailField: string, nameField: string, role: string) {
    setInviteError(null); setInviteSuccess(null);
    const name = inviteForm[nameField]?.trim();
    const email = inviteForm[emailField]?.trim();
    if (!name || !email) { setInviteError('Name and email are required.'); return; }
    setSendingInvite(true);
    try {
      const result = await orgApi.inviteUser({ name, email, role });
      setInviteSuccess(result.message || `Invitation sent to ${email}.`);
      setInviteForm({});
      setSelectedLocations([]);
      setTimeout(() => { setShowInviteUser(false); setShowInviteAccountant(false); setInviteSuccess(null); }, 3000);
    } catch (err: any) {
      setInviteError(err?.response?.data?.error || err?.message || 'Failed to send invite.');
    } finally { setSendingInvite(false); }
  }

  function ifv(name: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setInviteForm((p: Record<string, any>) => ({ ...p, [name]: e.target.value }));
  }

  function toggleLocation(loc: string) {
    setSelectedLocations((prev) =>
      prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc]
    );
  }

  const filteredLocations = availableLocations.filter((l) =>
    l.toLowerCase().includes(locationSearch.toLowerCase())
  );

  return (
    <PageShell title="Users" desc="Manage team members who have access to your SkyBooks account." icon={Users}>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setInviteForm({}); setSelectedLocations([]); setShowInviteUser(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition"
          >
            <Plus size={14} /> Invite User
          </button>
          <button
            onClick={() => { setInviteForm({}); setSelectedLocations([]); setShowInviteAccountant(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-medium rounded-lg transition"
          >
            <Plus size={14} /> Invite Accountant
          </button>
          <button
            onClick={() => { setInviteForm({}); setShowAddUser(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-emerald-200 hover:border-emerald-300 text-emerald-700 text-xs font-medium rounded-lg transition"
          >
            <Plus size={14} /> Add User
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCsv} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-medium rounded-lg transition">
            <Download size={14} /> CSV
          </button>
          <button onClick={handleExportPdf} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-medium rounded-lg transition">
            <Download size={14} /> PDF
          </button>
          <button onClick={async () => {
            if (!confirm('Clear all pending invites? This cannot be undone.')) return;
            try {
              await orgApi.clearInvites();
              setInviteSuccess('Pending invites cleared. You can now resend invites.');
              setTimeout(() => setInviteSuccess(null), 3000);
            } catch (err: any) {
              setInviteError(err?.response?.data?.error || err?.message || 'Failed to clear invites.');
              setTimeout(() => setInviteError(null), 3000);
            }
          }} className="inline-flex items-center gap-1.5 px-3 py-2 border border-red-200 hover:border-red-300 text-red-600 text-xs font-medium rounded-lg transition">
            <X size={14} /> Clear Pending Invites
          </button>
        </div>
      </div>

      <Section title="Team Members">
        {usersLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-slate-300" /></div>
        ) : !users || users.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No users have been invited yet.</p>
        ) : (
          <div className="border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-4 py-3 font-medium text-slate-500">User</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Role</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Status</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Last Login</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[10px] font-semibold text-indigo-600 uppercase shrink-0">
                          {(u.fullName || u.email || '?').charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-700">{u.fullName || 'Unnamed'}</p>
                          <p className="text-[11px] text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 capitalize">{u.role}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[11px] ${u.isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-[11px]">
                      {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => openEditUser(u)} className="text-slate-400 hover:text-indigo-600 transition">
                        <Pencil size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Invite User Modal */}
      {showInviteUser && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 overflow-y-auto">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowInviteUser(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 z-10">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">Invite User</h2>
              <button onClick={() => setShowInviteUser(false)} className="text-slate-400 hover:text-slate-600 transition"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Name</label>
                <input type="text" value={inviteForm.name || ''} onChange={ifv('name')} placeholder="Full name" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 placeholder-slate-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Email Address</label>
                <input type="email" value={inviteForm.email || ''} onChange={ifv('email')} placeholder="email@company.com" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 placeholder-slate-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Role</label>
                <select value={inviteForm.role || ''} onChange={ifv('role')} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800">
                  <option value="">Select a role</option>
                  <option value="admin">Admin</option>
                  <option value="accountant">Accountant</option>
                  <option value="staff">Staff</option>
                </select>
              </div>

              {/* Restrict Access To */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                <p className="text-xs font-medium text-slate-600">Restrict Access To</p>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">User's Default Business Location :</label>
                  <select className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800">
                    <option value="">None</option>
                    {availableLocations.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">User's Default Warehouse Location :</label>
                  <select className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800">
                    <option value="">None</option>
                    {availableLocations.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">Type to search Locations</label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={locationSearch}
                      onChange={(e) => setLocationSearch(e.target.value)}
                      placeholder="Search locations..."
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 placeholder-slate-400"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedLocations.length === availableLocations.length}
                    onChange={() =>
                      setSelectedLocations(
                        selectedLocations.length === availableLocations.length ? [] : [...availableLocations]
                      )
                    }
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Select All
                </label>

                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {filteredLocations.map((loc) => (
                    <label key={loc} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedLocations.includes(loc)}
                        onChange={() => toggleLocation(loc)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      {loc}
                    </label>
                  ))}
                </div>

                <p className="text-xs text-slate-400">{selectedLocations.length} Associated Values {selectedLocations.length}</p>
              </div>
            </div>
            {inviteSuccess && <div className="px-6 py-3 bg-emerald-50 border-t border-emerald-100"><p className="text-xs text-emerald-700 flex items-center gap-1"><CheckCircle2 size={12} /> {inviteSuccess}</p></div>}
            {inviteError && <div className="px-6 py-3 bg-rose-50 border-t border-rose-100"><p className="text-xs text-rose-600">{inviteError}</p></div>}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button onClick={() => setShowInviteUser(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition">Cancel</button>
              <button onClick={() => handleSendInvite('email', 'name', inviteForm.role || 'staff')} disabled={sendingInvite} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50">
                {sendingInvite ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Accountant Modal */}
      {showInviteAccountant && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 overflow-y-auto">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowInviteAccountant(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 z-10">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">Invite Accountant</h2>
              <button onClick={() => setShowInviteAccountant(false)} className="text-slate-400 hover:text-slate-600 transition"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Name</label>
                <input type="text" value={inviteForm.accName || ''} onChange={ifv('accName')} placeholder="Full name" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 placeholder-slate-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Email Address</label>
                <input type="email" value={inviteForm.accEmail || ''} onChange={ifv('accEmail')} placeholder="email@company.com" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 placeholder-slate-400" />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                Note: Since there are no roles configured for accountant users, an accountant role will be automatically created and assigned to this user. You can configure this role from Roles tab.
              </div>

              {/* Restrict Access To */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                <p className="text-xs font-medium text-slate-600">Restrict Access To</p>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">User's Default Business Location :</label>
                  <select className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800">
                    <option value="">None</option>
                    {availableLocations.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">User's Default Warehouse Location :</label>
                  <select className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800">
                    <option value="">None</option>
                    {availableLocations.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">Type to search Locations</label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={locationSearch}
                      onChange={(e) => setLocationSearch(e.target.value)}
                      placeholder="Search locations..."
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 placeholder-slate-400"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedLocations.length === availableLocations.length}
                    onChange={() =>
                      setSelectedLocations(
                        selectedLocations.length === availableLocations.length ? [] : [...availableLocations]
                      )
                    }
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Select All
                </label>

                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {filteredLocations.map((loc) => (
                    <label key={loc} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedLocations.includes(loc)}
                        onChange={() => toggleLocation(loc)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      {loc}
                    </label>
                  ))}
                </div>

                <p className="text-xs text-slate-400">{selectedLocations.length} Associated Values {selectedLocations.length}</p>
              </div>
            </div>
            {inviteSuccess && <div className="px-6 py-3 bg-emerald-50 border-t border-emerald-100"><p className="text-xs text-emerald-700 flex items-center gap-1"><CheckCircle2 size={12} /> {inviteSuccess}</p></div>}
            {inviteError && <div className="px-6 py-3 bg-rose-50 border-t border-rose-100"><p className="text-xs text-rose-600">{inviteError}</p></div>}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button onClick={() => setShowInviteAccountant(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition">Cancel</button>
              <button onClick={() => handleSendInvite('accEmail', 'accName', 'accountant')} disabled={sendingInvite} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50">
                {sendingInvite ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal (bypasses invite email) */}
      {showAddUser && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 overflow-y-auto">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowAddUser(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 z-10">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Add User Manually</h2>
                <p className="text-xs text-slate-400">Create a user directly without sending an invite email.</p>
              </div>
              <button onClick={() => setShowAddUser(false)} className="text-slate-400 hover:text-slate-600 transition"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Full Name</label>
                <input type="text" value={addUserForm.name || ''} onChange={auf('name')} placeholder="Full name" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 placeholder-slate-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Email Address</label>
                <input type="email" value={addUserForm.email || ''} onChange={auf('email')} placeholder="email@company.com" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 placeholder-slate-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Role</label>
                <select value={addUserForm.role || ''} onChange={auf('role')} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800">
                  <option value="">Select a role</option>
                  <option value="admin">Admin</option>
                  <option value="accountant">Accountant</option>
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Password</label>
                <input type="password" value={addUserForm.password || ''} onChange={auf('password')} placeholder="Minimum 6 characters" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 placeholder-slate-400" />
              </div>
            </div>
            {addUserSuccess && <div className="px-6 py-3 bg-emerald-50 border-t border-emerald-100"><p className="text-xs text-emerald-700 flex items-center gap-1"><CheckCircle2 size={12} /> {addUserSuccess}</p></div>}
            {addUserError && <div className="px-6 py-3 bg-rose-50 border-t border-rose-100"><p className="text-xs text-rose-600">{addUserError}</p></div>}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button onClick={() => setShowAddUser(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition">Cancel</button>
              <button onClick={handleAddUser} disabled={addUserPending} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50">
                {addUserPending ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 overflow-y-auto">
          <div className="fixed inset-0 bg-black/40" onClick={() => setEditingUser(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 z-10">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Edit User</h2>
                <p className="text-xs text-slate-400">Update user details and permissions.</p>
              </div>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600 transition"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Full Name</label>
                <input type="text" value={editForm.fullName || ''} onChange={e => setEditForm(p => ({...p, fullName: e.target.value}))} placeholder="Full name" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 placeholder-slate-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Email Address</label>
                <input type="email" value={editForm.email || ''} onChange={e => setEditForm(p => ({...p, email: e.target.value}))} placeholder="email@company.com" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 placeholder-slate-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Role</label>
                <select value={editForm.role || ''} onChange={e => setEditForm(p => ({...p, role: e.target.value}))} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800">
                  <option value="admin">Admin</option>
                  <option value="accountant">Accountant</option>
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editForm.isActive !== false} onChange={e => setEditForm(p => ({...p, isActive: e.target.checked}))} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm text-slate-700">Active</span>
                </label>
              </div>
            </div>
            {editSuccess && <div className="px-6 py-3 bg-emerald-50 border-t border-emerald-100"><p className="text-xs text-emerald-700 flex items-center gap-1"><CheckCircle2 size={12} /> {editSuccess}</p></div>}
            {editError && <div className="px-6 py-3 bg-rose-50 border-t border-rose-100"><p className="text-xs text-rose-600">{editError}</p></div>}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button onClick={() => setEditingUser(null)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition">Cancel</button>
              <button onClick={handleEditSave} disabled={editSaving} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50">
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

// ─── Roles ─────────────────────────────────────────────────────────────────
// ─── Permission Schema ─────────────────────────────────────────────────────
const PERM_COLUMNS: Record<string, string[]> = {
  standard: ['full', 'view', 'create', 'edit', 'delete', 'others'],
  withApprove: ['full', 'view', 'create', 'edit', 'delete', 'approve', 'others'],
  withAssignOwner: ['full', 'view', 'create', 'edit', 'delete', 'assignOwner', 'others'],
  withApproveAssign: ['full', 'view', 'create', 'edit', 'delete', 'approve', 'assignOwner', 'others'],
};

const COLUMN_LABELS: Record<string, string> = {
  full: 'Full', view: 'View', create: 'Create', edit: 'Edit',
  delete: 'Delete', approve: 'Approve', assignOwner: 'Assign owner', others: 'Others',
};

const REPORT_COLUMNS = ['fullAccess', 'view', 'export', 'schedule', 'share'];
const REPORT_COL_LABELS: Record<string, string> = {
  fullAccess: 'Full Access', view: 'View', export: 'Export', schedule: 'Schedule', share: 'Share',
};

const PERMISSION_SECTIONS = [
  { name: 'Contacts', subs: [
    { key: 'customers', label: 'Customers', columns: 'withAssignOwner', more: [{ key: 'assignedCustomersOnly', label: 'Allow users to handle the data and transactions for assigned customers only.' }] },
    { key: 'vendors', label: 'Vendors', columns: 'withApprove' },
    { key: 'vendorBank', label: 'Vendors Bank', more: [{ key: 'editDeleteVendorBank', label: "Allow users to add, edit and delete vendor's bank account details." }] },
  ]},
  { name: 'Items', subs: [
    { key: 'item', label: 'Item', columns: 'withApprove' },
    { key: 'inventoryAdjustments', label: 'Inventory Adjustments', columns: 'standard', more: [{ key: 'inventoryAdjustmentsMore', label: '' }] },
    { key: 'priceList', label: 'Price List', columns: 'standard' },
  ]},
  { name: 'Banking', subs: [
    { key: 'banking', label: 'Banking', columns: 'standard', more: [{ key: 'bankingMore', label: '' }] },
  ]},
  { name: 'Sales', subs: [
    { key: 'invoices', label: 'Invoices', columns: 'withApprove', more: [{ key: 'invoicesMore', label: '' }] },
    { key: 'customerPayments', label: 'Customer Payments', columns: 'standard', more: [{ key: 'customerPaymentsMore', label: '' }] },
    { key: 'quotes', label: 'Quotes', columns: 'withApprove', more: [{ key: 'quotesMore', label: '' }] },
    { key: 'salesReceipt', label: 'Sales Receipt', columns: 'standard', more: [{ key: 'salesReceiptMore', label: '' }] },
    { key: 'salesOrders', label: 'Sales Orders', columns: 'withApprove', more: [{ key: 'salesOrdersMore', label: '' }] },
    { key: 'creditNotes', label: 'Credit Notes', columns: 'withApprove', more: [{ key: 'creditNotesMore', label: '' }] },
  ]},
  { name: 'Purchases', subs: [
    { key: 'bills', label: 'Bills', columns: 'withApprove', more: [{ key: 'billsMore', label: '' }] },
    { key: 'vendorPayments', label: 'Vendor Payments', columns: 'withApprove', more: [{ key: 'vendorPaymentsMore', label: '' }] },
    { key: 'expenses', label: 'Expenses', columns: 'standard' },
    { key: 'purchaseOrders', label: 'Purchase Orders', columns: 'withApprove', more: [{ key: 'purchaseOrdersMore', label: '' }] },
    { key: 'vendorCredits', label: 'Vendor Credits', columns: 'withApprove', more: [{ key: 'vendorCreditsMore', label: '' }] },
  ]},
  { name: 'Accountant', subs: [
    { key: 'chartOfAccounts', label: 'Chart of Accounts', columns: 'withApprove' },
    { key: 'journals', label: 'Journals', columns: 'withApprove' },
    { key: 'budget', label: 'Budget', columns: 'standard' },
  ]},
  { name: 'Tasks', subs: [
    { key: 'tasks', label: 'Tasks', columns: 'standard', more: [{ key: 'tasksMore', label: '' }] },
  ]},
  { name: 'Timesheets', subs: [
    { key: 'projects', label: 'Projects', columns: 'standard', more: [{ key: 'noExpenseRecording', label: "Don't allow timesheet staffs to record expenses for the associated project(s)." }] },
  ]},
  { name: 'Locations', subs: [
    { key: 'locations', label: 'Locations', columns: 'standard' },
  ]},
  { name: 'Reporting Tags', subs: [
    { key: 'reportingTags', label: 'Reporting Tags', columns: 'standard' },
  ]},
  { name: 'Fixed Asset', subs: [
    { key: 'fixedAsset', label: 'Fixed Asset', columns: 'standard', more: [{ key: 'fixedAssetMore', label: '' }] },
  ]},
];

const DOCUMENT_PERMS = [
  { key: 'viewDocuments', label: 'View Documents' },
  { key: 'uploadDocuments', label: 'Upload Documents' },
  { key: 'deleteDocuments', label: 'Delete Documents' },
  { key: 'manageFolder', label: 'Manage Folder' },
];

const SETTINGS_TOGGLES = [
  { key: 'updateOrgProfile', label: 'Update organization profile' },
  { key: 'users', label: 'Users' },
  { key: 'exportData', label: 'Export data' },
  { key: 'generalPreferences', label: 'General preferences' },
  { key: 'fixedAssetPreferences', label: 'Fixed Asset preferences' },
  { key: 'accountantPreferences', label: 'Accountant preferences' },
  { key: 'taxes', label: 'Taxes' },
  { key: 'protectedData', label: 'Provide access to protected data' },
  { key: 'paymentTerms', label: 'Payment Terms' },
  { key: 'templates', label: 'Templates' },
  { key: 'emailTemplate', label: 'Email Template' },
  { key: 'manageIntegration', label: 'Manage Integration' },
  { key: 'automation', label: 'Automation' },
  { key: 'incomingWebhook', label: 'Incoming Webhook' },
  { key: 'signal', label: 'Signal' },
];

const DASHBOARD_WIDGETS = [
  { key: 'totalPayables', label: 'Total Payables' },
  { key: 'totalReceivables', label: 'Total Receivables' },
  { key: 'cashFlow', label: 'Cash Flow' },
  { key: 'incomeAndExpenses', label: 'Income and Expenses' },
  { key: 'topExpense', label: 'Your Top Expense' },
  { key: 'projects', label: 'Projects' },
  { key: 'bankAndCreditCards', label: 'Bank and Credit Cards' },
  { key: 'accountWatchlist', label: 'Account Watchlist' },
];

const ALL_REPORTS = [
  'Profit and Loss', 'Cash Flow Statement', 'Balance Sheet', 'Business Performance Ratios',
  'Cash Flow Forecasting', 'Movement of Equity', 'Sales by Customer', 'Sales by Item',
  'Sales Return History', 'Sales by Sales Person', 'Sales Summary', 'Profit By Item',
  'Sales Channel Integrations Sync Summary', 'Inventory Summary', 'Committed Stock Details',
  'Inventory Aging Summary', 'Stock Summary', 'Stock Movement', 'Inventory Adjustment Summary',
  'Inventory Adjustment Details', 'Inventory Turnover By Quantity', 'Inventory Valuation Summary',
  'FIFO Cost Lot Tracking', 'ABC classification', 'Landed Cost Summary',
  'Inventory Turnover By Amount', 'Weighted Average Costing Summary', 'AR Aging Summary',
  'AR Aging Details', 'Invoice Details', 'Retainer Invoice Details', 'Sales Order Details',
  'Delivery Challan Details', 'Quote Details', 'Customer Balance Summary', 'Receivable Summary',
  'Receivable Details', 'Payments Received', 'Time to Get Paid', 'Credit Note Details',
  'Refund History', 'Recurring Invoice Details', 'Payment Failure', 'Payment Retry',
  'Card Expiry', 'Vendor Balance Summary', 'AP Aging Summary', 'AP Aging Details',
  'Bill Details', 'Vendor Credit Details', 'Payments Made', 'Refund History',
  'Purchase Order Details', 'Purchase Orders by Vendor', 'Payable Summary', 'Payable Details',
  'Active Purchase Orders Report', 'Purchases by Vendor', 'Purchases by Item',
  'Expense Details', 'Expenses by Category', 'Expenses by Customer', 'Expenses by Project',
  'Expenses by Employee', 'Billable Expense Details', 'Tax Summary', 'FEC Report',
  'VAT MOSS Report', 'IOSS Report', 'OSS Report', 'TDS Payable Summary',
  'TDS Receivable Summary', 'Overseas Digital Tax Summary', 'Reverse Charge Summary',
  'Sales Reverse Charge Summary', 'Reconciliation Status', 'Timesheet Details',
  'Timesheet Profitability Summary', 'Project Summary', 'Project Details',
  'Projects Cost Summary', 'Projects Revenue Summary', 'Projects Performance Summary',
  'Project Revenue Details', 'TimeSheet Profitability Details', 'Fixed Asset Register',
  'Account Transactions', 'Account Type Summary', 'General Ledger', 'Detailed General Ledger',
  'Journal Report', 'Trial Balance', 'Budget Vs Actuals', 'Realized Gain or Loss',
  'Unrealized Gain or Loss', 'System Mails', 'SMS Notifications', 'Snail Mail Credits Report',
  'Activity Logs', 'Exception Report', 'Portal Activities', 'Customer Reviews',
  'API Usage', 'Pending Inventory Valuations', 'Scheduled Date Based Workflow Rules',
  'Scheduled Time Based Workflow Actions',
];

function buildDefaultRole(name: string, isAccountant = false) {
  const role: Record<string, any> = { name, description: '', isAccountant };
  PERMISSION_SECTIONS.forEach(section => {
    role[section.name] = {};
    section.subs.forEach(sub => {
      const cols = sub.columns ? PERM_COLUMNS[sub.columns] || PERM_COLUMNS.standard : [];
      role[section.name][sub.key] = {};
      cols.forEach(c => { role[section.name][sub.key][c] = false; });
      (sub.more || []).forEach(m => { role[section.name][sub.key][m.key] = false; });
    });
  });
  role.Documents = {};
  DOCUMENT_PERMS.forEach(d => { role.Documents[d.key] = false; });
  role.Settings = {};
  SETTINGS_TOGGLES.forEach(s => { role.Settings[s.key] = false; });
  role.Dashboard = {};
  DASHBOARD_WIDGETS.forEach(d => { role.Dashboard[d.key] = false; });
  role.Dashboard.enableFullAccessAllReports = false;
  role.Reports = {};
  ALL_REPORTS.forEach(r => {
    const key = r.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    role.Reports[key] = {};
    REPORT_COLUMNS.forEach(c => { role.Reports[key][c] = false; });
  });
  return role;
}

function getRoleNames(form: Record<string, any>) {
  const names: string[] = [];
  Object.keys(form).forEach(k => {
    if (form[k] && typeof form[k] === 'object' && !Array.isArray(form[k]) && 'name' in form[k]) {
      if (!names.includes(form[k].name)) names.push(form[k].name);
    }
  });
  return names;
}

// ─── Role Editor Modal ─────────────────────────────────────────────────────
function RoleEditorModal({ role, form, setForm, onClose, isNew, saveSettings }: {
  role: string;
  form: Record<string, any>;
  setForm: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  onClose: () => void;
  isNew: boolean;
  saveSettings?: (partial: Record<string, any>, opts?: any) => void;
}) {
  const roleData = form[role] || buildDefaultRole(role);
  const [local, setLocal] = useState<Record<string, any>>(roleData);
  const [activeTab, setActiveTab] = useState('general');
  const [reportSearch, setReportSearch] = useState('');

  useEffect(() => { setLocal(form[role] || buildDefaultRole(role)); }, [role, form]);

  function updateLocal(path: string[], value: any) {
    setLocal((prev: Record<string, any>) => {
      const next = JSON.parse(JSON.stringify(prev));
      let cur = next;
      for (let i = 0; i < path.length - 1; i++) {
        if (!cur[path[i]]) cur[path[i]] = {};
        cur = cur[path[i]];
      }
      cur[path[path.length - 1]] = value;
      return next;
    });
  }

  function getVal(path: string[], def = false) {
    let cur = local;
    for (const p of path) {
      if (cur === undefined || cur === null || typeof cur !== 'object') return def;
      cur = cur[p];
    }
    return cur === undefined ? def : cur;
  }

  function handleDone(withSave = false) {
    const updated = { ...form, [role]: local };
    setForm(updated);
    if (withSave && saveSettings) {
      saveSettings({ roles: updated }, {
        onSuccess: () => {},
        onError: (err: any) => console.error('Save failed', err),
      });
    }
    onClose();
  }

  function setAllInSection(sectionIdx: number, subKey: string, cols: string[], value: boolean) {
    setLocal((prev: Record<string, any>) => {
      const next = JSON.parse(JSON.stringify(prev));
      const sectionName = PERMISSION_SECTIONS[sectionIdx].name;
      cols.forEach(c => {
        if (next[sectionName] && next[sectionName][subKey]) {
          next[sectionName][subKey][c] = value;
        }
      });
      return next;
    });
  }

  function setAllReports(value: boolean) {
    setLocal((prev: Record<string, any>) => {
      const next = JSON.parse(JSON.stringify(prev));
      if (next.Reports) {
        Object.keys(next.Reports).forEach(r => {
          REPORT_COLUMNS.forEach(c => { next.Reports[r][c] = value; });
        });
      }
      return next;
    });
  }

  const roleName = role;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 overflow-y-auto">
      <div className="fixed inset-0 bg-black/40" onClick={handleDone} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl mx-4 overflow-hidden z-10 max-h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{isNew ? 'New Role' : `Edit Role: ${roleName.replace(/_/g, ' ')}`}</h2>
            <p className="text-xs text-slate-500">Define granular permissions for this role</p>
          </div>
          <button onClick={handleDone} className="text-slate-400 hover:text-slate-600 transition"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 py-2 border-b border-slate-200 bg-slate-50 shrink-0 overflow-x-auto">
          {[
            { id: 'general', label: 'General' },
            ...PERMISSION_SECTIONS.map(s => ({ id: s.name, label: s.name })),
            { id: 'Documents', label: 'Documents' },
            { id: 'Settings', label: 'Settings' },
            { id: 'Dashboard', label: 'Dashboard' },
            { id: 'Reports', label: 'Reports' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'general' && (
            <div className="space-y-5 max-w-xl">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Role Name</label>
                <input type="text" value={local.name || ''} onChange={e => updateLocal(['name'], e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Description <span className="text-slate-400 font-normal">(Max. 500 characters)</span></label>
                <textarea value={local.description || ''} onChange={e => updateLocal(['description'], e.target.value)} maxLength={500} rows={3}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none" />
              </div>
              <label className="flex items-start gap-3 pt-2">
                <input type="checkbox" checked={!!local.isAccountant} onChange={e => updateLocal(['isAccountant'], e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                <div>
                  <p className="text-sm font-medium text-slate-700">This role is for Accountant users</p>
                  <p className="text-xs text-slate-400">If you mark this option, all users who are added with this role will be an accountant user.</p>
                </div>
              </label>
            </div>
          )}

          {activeTab !== 'general' && activeTab !== 'Documents' && activeTab !== 'Settings' && activeTab !== 'Dashboard' && activeTab !== 'Reports' && (
            (() => {
              const section = PERMISSION_SECTIONS.find(s => s.name === activeTab);
              if (!section) return null;
              return (
                <div className="space-y-6">
                  {section.subs.map(sub => {
                    const cols = sub.columns ? PERM_COLUMNS[sub.columns] || PERM_COLUMNS.standard : [];
                    const allChecked = cols.every(c => getVal([section.name, sub.key, c]));
                    return (
                      <div key={sub.key}>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold text-slate-800">{sub.label}</h3>
                          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                            <input type="checkbox" checked={allChecked} onChange={e => setAllInSection(PERMISSION_SECTIONS.indexOf(section), sub.key, cols, e.target.checked)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                            Select All
                          </label>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50">
                                <th className="text-left px-3 py-2 font-medium text-slate-600 border border-slate-200">Particulars</th>
                                {cols.map(c => (
                                  <th key={c} className="text-center px-3 py-2 font-medium text-slate-600 border border-slate-200 whitespace-nowrap">{COLUMN_LABELS[c] || c}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td className="px-3 py-2 text-slate-700 border border-slate-200 font-medium">{sub.label}</td>
                                {cols.map(c => (
                                  <td key={c} className="text-center px-3 py-2 border border-slate-200">
                                    <input type="checkbox" checked={getVal([section.name, sub.key, c])} onChange={e => updateLocal([section.name, sub.key, c], e.target.checked)}
                                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                  </td>
                                ))}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        {(sub.more || []).filter(m => m.label).map(m => (
                          <label key={m.key} className="flex items-start gap-2 mt-2 cursor-pointer">
                            <input type="checkbox" checked={getVal([section.name, sub.key, m.key])} onChange={e => updateLocal([section.name, sub.key, m.key], e.target.checked)}
                              className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                            <span className="text-xs text-slate-500">{m.label}</span>
                          </label>
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}

          {activeTab === 'Documents' && (
            <div className="space-y-3">
              {DOCUMENT_PERMS.map(d => (
                <label key={d.key} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={getVal(['Documents', d.key])} onChange={e => updateLocal(['Documents', d.key], e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm text-slate-700">{d.label}</span>
                </label>
              ))}
            </div>
          )}

          {activeTab === 'Settings' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {SETTINGS_TOGGLES.map(s => (
                <label key={s.key} className="flex items-center gap-3 cursor-pointer p-3 border border-slate-100 rounded-lg hover:bg-slate-50">
                  <input type="checkbox" checked={getVal(['Settings', s.key])} onChange={e => updateLocal(['Settings', s.key], e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-xs text-slate-700">{s.label}</span>
                </label>
              ))}
            </div>
          )}

          {activeTab === 'Dashboard' && (
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer p-3 border border-slate-100 rounded-lg hover:bg-slate-50">
                <input type="checkbox" checked={getVal(['Dashboard', 'enableFullAccessAllReports'])} onChange={e => updateLocal(['Dashboard', 'enableFullAccessAllReports'], e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                <div>
                  <p className="text-sm font-medium text-slate-700">Enable full access for all reports</p>
                  <p className="text-xs text-slate-400">When new reports are introduced, you will have to edit the role and provide access to them.</p>
                </div>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {DASHBOARD_WIDGETS.map(d => (
                  <label key={d.key} className="flex items-center gap-3 cursor-pointer p-3 border border-slate-100 rounded-lg hover:bg-slate-50">
                    <input type="checkbox" checked={getVal(['Dashboard', d.key])} onChange={e => updateLocal(['Dashboard', d.key], e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-xs text-slate-700">{d.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'Reports' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <input type="text" value={reportSearch} onChange={e => setReportSearch(e.target.value)}
                  placeholder="Search reports..." className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 max-w-xs" />
                <div className="flex items-center gap-3">
                  <button onClick={() => setAllReports(true)} className="text-xs text-indigo-600 hover:underline">Select All</button>
                  <button onClick={() => setAllReports(false)} className="text-xs text-slate-500 hover:underline">Clear All</button>
                </div>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 sticky top-0">
                      <th className="text-left px-3 py-2 font-medium text-slate-600 border-b border-slate-200">Report Groups</th>
                      {REPORT_COLUMNS.map(c => (
                        <th key={c} className="text-center px-3 py-2 font-medium text-slate-600 border-b border-slate-200 whitespace-nowrap">{REPORT_COL_LABELS[c]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ALL_REPORTS.filter(r => !reportSearch || r.toLowerCase().includes(reportSearch.toLowerCase())).map(r => {
                      const key = r.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
                      return (
                        <tr key={key} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-slate-700 border-b border-slate-100 whitespace-nowrap">{r}</td>
                          {REPORT_COLUMNS.map(c => (
                            <td key={c} className="text-center px-3 py-2 border-b border-slate-100">
                              <input type="checkbox" checked={getVal(['Reports', key, c])} onChange={e => updateLocal(['Reports', key, c], e.target.checked)}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition">Cancel</button>
          <button onClick={() => handleDone(true)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition">
            {isNew ? 'Create Role' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Roles Page ────────────────────────────────────────────────────────────
export function RolesPage() {
  const { form, handleSave, isPending, saved, error, setForm, save } = useSettingsForm('roles');
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [newRoleNameInput, setNewRoleNameInput] = useState('');

  const defaultRoles = ['admin', 'accountant', 'staff'];
  const existingNames = Object.keys(form).filter(k => form[k] && typeof form[k] === 'object' && !Array.isArray(form[k]));
  const allRoles = [...new Set([...defaultRoles, ...existingNames])];

  function ensureDefaults() {
    setForm((p: Record<string, any>) => {
      let changed = false;
      const next = { ...p };
      defaultRoles.forEach(r => {
        if (!next[r] || typeof next[r] !== 'object' || Array.isArray(next[r]) || !next[r].name) {
          next[r] = buildDefaultRole(r);
          changed = true;
        }
      });
      return changed ? next : p;
    });
  }

  useEffect(() => { ensureDefaults(); }, []);

  function openNewRole() {
    const name = newRoleNameInput.trim().toLowerCase().replace(/\s+/g, '_');
    if (!name || allRoles.includes(name)) return;
    setForm((p: Record<string, any>) => ({ ...p, [name]: buildDefaultRole(name) }));
    setEditingRole(name);
    setIsNew(true);
    setNewRoleNameInput('');
  }

  function deleteRole(role: string) {
    if (defaultRoles.includes(role)) return;
    setForm((p: Record<string, any>) => {
      const next = { ...p };
      delete next[role];
      return next;
    });
    setShowDeleteConfirm(null);
  }

  return (
    <PageShell title="Roles" desc="Define access permissions for different user roles." icon={Shield}>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <p className="text-xs text-slate-500">{allRoles.length} role{allRoles.length !== 1 ? 's' : ''} configured</p>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="text" value={newRoleNameInput} onChange={e => setNewRoleNameInput(e.target.value)}
            placeholder="New role name..." className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-full sm:w-48"
            onKeyDown={e => { if (e.key === 'Enter') openNewRole(); }} />
          <button onClick={openNewRole} disabled={!newRoleNameInput.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition flex items-center gap-1.5">
            <Plus size={14} /> New Role
          </button>
        </div>
      </div>

      <Section title="Roles & Permissions">
        {allRoles.map(role => {
          const data = form[role];
          return (
            <div key={role} className="border border-slate-200 rounded-lg p-4 mb-3 hover:border-slate-300 transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold uppercase">
                    {role.charAt(0)}
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-slate-800 capitalize block">{role.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-slate-400">{data?.description || (defaultRoles.includes(role) ? 'Default role' : '')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setEditingRole(role); setIsNew(false); }}
                    className="px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition flex items-center gap-1">
                    <Pencil size={12} /> Edit
                  </button>
                  {!defaultRoles.includes(role) && (
                    <button onClick={() => setShowDeleteConfirm(role)}
                      className="px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </Section>

      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowDeleteConfirm(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 z-10">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Delete Role</h3>
            <p className="text-xs text-slate-500 mb-4">Are you sure you want to delete <strong className="capitalize">{showDeleteConfirm.replace(/_/g, ' ')}</strong>? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition">Cancel</button>
              <button onClick={() => deleteRole(showDeleteConfirm)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition">Delete</button>
            </div>
          </div>
        </div>
      )}

      {editingRole && (
        <RoleEditorModal
          role={editingRole}
          form={form}
          setForm={setForm}
          onClose={() => { setEditingRole(null); setIsNew(false); }}
          isNew={isNew}
          saveSettings={save}
        />
      )}
    </PageShell>
  );
}

// ─── User Preferences ──────────────────────────────────────────────────────
export function UserPreferencesPage() {
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  const { form, field, toggle, handleSave, isPending, saved, error } = useSettingsForm('userPreferences');
  const [profileForm, setProfileForm] = useState({ fullName: user?.fullName || '', email: user?.email || '' });
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl || null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    setProfileForm({ fullName: user?.fullName || '', email: user?.email || '' });
    setAvatarPreview(user?.avatarUrl || null);
  }, [user]);

  function pf(name: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setProfileForm((p) => ({ ...p, [name]: e.target.value }));
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setProfileError("Photo must be under 2MB"); return; }
    setAvatarUploading(true); setProfileError(null);
    try {
      const fd = new FormData(); fd.append("photo", file);
      const updated = await authApi.uploadAvatar(fd);
      setAvatarPreview(updated.avatarUrl || URL.createObjectURL(file));
      await refreshUser();
    } catch { setProfileError("Upload failed. Try again."); }
    finally { setAvatarUploading(false); }
  }

  async function handleProfileSave() {
    setProfileSaving(true); setProfileError(null); setProfileSaved(false);
    try {
      await authApi.updateProfile({ fullName: profileForm.fullName, email: profileForm.email });
      await refreshUser();
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err: any) {
      setProfileError(err?.response?.data?.error || err?.message || 'Failed to save profile.');
    } finally { setProfileSaving(false); }
  }

  return (
    <PageShell title="User Preferences" desc="Configure your personal profile and app preferences." icon={UserCog}>
      <Section title="My Profile">
        <div className="flex items-center gap-5 pb-4 border-b border-slate-100">
          <div className="w-20 h-20 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden shrink-0">
            {avatarPreview
              ? <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
              : <UserCog size={28} className="text-slate-300" />}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">Passport Photograph</p>
            <p className="text-xs text-slate-400 mb-2">PNG or JPG, max 2MB.</p>
            <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition">
              {avatarUploading ? "Uploading..." : <><Upload size={12} /> Upload Photo</>}
              <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleAvatarUpload} disabled={avatarUploading} />
            </label>
            {profileError && <p className="text-xs text-red-500 mt-1">{profileError}</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Full Name</label>
            <input type="text" value={profileForm.fullName} onChange={pf('fullName')} placeholder="Your full name" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 placeholder-slate-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Email Address</label>
            <input type="email" value={profileForm.email} onChange={pf('email')} placeholder="email@company.com" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 placeholder-slate-400" />
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <button
            onClick={handleProfileSave}
            disabled={profileSaving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 transition"
          >
            {profileSaving ? <><Loader2 size={14} className="animate-spin" />Saving...</> : <><Save size={14} />Save Profile</>}
          </button>
        </div>
        {profileSaved && (
          <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1"><CheckCircle2 size={12} /> Profile saved successfully.</p>
        )}
      </Section>

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
function CheckboxGrid({ label, options, form, field }: { label: string; options: { key: string; label: string }[]; form: Record<string, any>; field: (n: string) => any }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-600 mb-2">{label}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {options.map(o => (
          <label key={o.key} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-50">
            <input type="checkbox" checked={!!form[o.key]} onChange={field(o.key)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <span className="text-xs text-slate-700">{o.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function RadioGroup({ label, name, options, form, field }: { label: string; name: string; options: { value: string; label: string }[]; form: Record<string, any>; field: (n: string) => any }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-600 mb-2">{label}</p>
      <div className="space-y-2">
        {options.map(o => (
          <label key={o.value} className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name={name} value={o.value} checked={form[name] === o.value} onChange={field(name)} className="border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <span className="text-xs text-slate-700">{o.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function GeneralPage() {
  const { form, field, toggle, handleSave, isPending, saved, error } = useSettingsForm('general');

  const moduleOptions = [
    { key: 'moduleQuotes', label: 'Quotes' }, { key: 'moduleSalesOrders', label: 'Sales Orders' },
    { key: 'moduleSalesReceipts', label: 'Sales Receipts' }, { key: 'modulePurchaseOrders', label: 'Purchase Orders' },
    { key: 'moduleTimeTracking', label: 'Time Tracking' }, { key: 'moduleRetainerInvoices', label: 'Retainer Invoices' },
    { key: 'moduleRecurringInvoice', label: 'Recurring Invoice' }, { key: 'moduleRecurringExpense', label: 'Recurring Expense' },
    { key: 'moduleRecurringBills', label: 'Recurring Bills' }, { key: 'moduleRecurringJournals', label: 'Recurring Journals' },
    { key: 'moduleCreditNote', label: 'Credit Note' }, { key: 'moduleDebitNote', label: 'Debit Note' },
    { key: 'modulePaymentLinks', label: 'Payment Links' }, { key: 'moduleTasks', label: 'Tasks' },
    { key: 'moduleSelfBilledInvoice', label: 'Self Billed Invoice' }, { key: 'moduleSelfBilledCreditNote', label: 'Self Billed Credit Note' },
    { key: 'moduleSelfBilledDebitNote', label: 'Self Billed Debit Note' }, { key: 'moduleFixedAsset', label: 'Fixed Asset' },
  ];

  const inventoryModules = [
    { key: 'invCompositeItems', label: 'Composite Items' }, { key: 'invPackages', label: 'Packages' },
    { key: 'invPicklists', label: 'Picklists' }, { key: 'invShipments', label: 'Shipments' },
    { key: 'invPurchaseReceive', label: 'Purchase Receive' }, { key: 'invSalesReturns', label: 'Sales Returns' },
    { key: 'invTransferOrders', label: 'Transfer Orders' },
  ];

  const docCopyOptions = [
    { value: 'original_duplicate', label: 'Two Copies (Original & Duplicate)' },
    { value: 'three_copies', label: 'Three Copies (Original, Duplicate & Triplicate)' },
    { value: 'four_five_copies', label: 'Four/Five Copies' },
  ];

  return (
    <PageShell title="General" desc="Configure general system settings." icon={Settings}>
      <Section title="General Settings">
        <Select label="Default Currency" options={[
          { value: 'NGN', label: 'NGN - Nigerian Naira' }, { value: 'USD', label: 'USD - US Dollar' },
          { value: 'EUR', label: 'EUR - Euro' }, { value: 'GBP', label: 'GBP - British Pound' },
          { value: 'KES', label: 'KES - Kenyan Shilling' }, { value: 'GHS', label: 'GHS - Ghanaian Cedi' },
          { value: 'ZAR', label: 'ZAR - South African Rand' }, { value: 'XOF', label: 'XOF - West African CFA' },
        ]} value={form.defaultCurrency || 'NGN'} onChange={field('defaultCurrency')} />
        <Field label="Default Tax Rate (%)" type="number" placeholder="7.5" value={form.defaultTaxRate || ''} onChange={field('defaultTaxRate')} desc="Default VAT rate for new transactions." />
        <ToggleRow label="Auto-generate transaction numbers" checked={form.autoGenerateNumbers} onClick={toggle('autoGenerateNumbers')} />
        <ToggleRow label="Allow negative inventory" desc="Permit inventory to go below zero temporarily." checked={form.allowNegativeInventory} onClick={toggle('allowNegativeInventory')} />
      </Section>

      <Section title="Modules">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-800 mb-4">
          Select the modules you would like to enable. Click a module name to configure its settings.
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {[
            { key: 'moduleQuotes', label: 'Quotes', link: '/settings/quotes' },
            { key: 'moduleSalesOrders', label: 'Sales Orders', link: '/settings/sales-orders' },
            { key: 'moduleSalesReceipts', label: 'Sales Receipts', link: '/settings/sales-receipts' },
            { key: 'modulePurchaseOrders', label: 'Purchase Orders', link: '/settings/purchase-orders' },
            { key: 'moduleTimeTracking', label: 'Time Tracking', link: '/settings/timesheet' },
            { key: 'moduleRetainerInvoices', label: 'Retainer Invoices', link: '/settings/invoices' },
            { key: 'moduleRecurringInvoice', label: 'Recurring Invoice', link: '/settings/recurring-invoices' },
            { key: 'moduleRecurringExpense', label: 'Recurring Expense', link: '/settings/recurring-expenses' },
            { key: 'moduleRecurringBills', label: 'Recurring Bills', link: '/settings/recurring-bills' },
            { key: 'moduleRecurringJournals', label: 'Recurring Journals', link: '/settings/accountant' },
            { key: 'moduleCreditNote', label: 'Credit Note', link: '/settings/credit-notes' },
            { key: 'moduleDebitNote', label: 'Debit Note', link: '/settings/credit-notes' },
            { key: 'modulePaymentLinks', label: 'Payment Links', link: '/settings/payment-gateways' },
            { key: 'moduleTasks', label: 'Tasks', link: '/settings/tasks' },
            { key: 'moduleSelfBilledInvoice', label: 'Self Billed Invoice', link: '/settings/invoices' },
            { key: 'moduleSelfBilledCreditNote', label: 'Self Billed Credit Note', link: '/settings/credit-notes' },
            { key: 'moduleSelfBilledDebitNote', label: 'Self Billed Debit Note', link: '/settings/credit-notes' },
            { key: 'moduleFixedAsset', label: 'Fixed Asset', link: '/settings/inventory-adjustments' },
          ].map(o => (
            <label key={o.key} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-50 group">
              <input type="checkbox" checked={!!form[o.key]} onChange={field(o.key)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              <a href={o.link} onClick={e => e.stopPropagation()} className="text-xs text-slate-700 group-hover:text-indigo-600 hover:underline">{o.label}</a>
            </label>
          ))}
        </div>
      </Section>

      <Section title="Inventory Add-on">
        <ToggleRow label="Enable Inventory modules" checked={form.enableInventory} onClick={toggle('enableInventory')} desc="Enabling the Inventory Add-on will allow you to use inventory management modules." />
        {form.enableInventory && (
          <div className="mt-3 pl-4 border-l-2 border-indigo-200 space-y-2">
            <CheckboxGrid label="" options={inventoryModules} form={form} field={field} />
          </div>
        )}
      </Section>

      <Section title="Work Week">
        <Select label="First day of work week" options={[
          { value: 'monday', label: 'Monday' }, { value: 'tuesday', label: 'Tuesday' },
          { value: 'wednesday', label: 'Wednesday' }, { value: 'thursday', label: 'Thursday' },
          { value: 'friday', label: 'Friday' }, { value: 'saturday', label: 'Saturday' },
          { value: 'sunday', label: 'Sunday' },
        ]} value={form.firstDayOfWeek || 'monday'} onChange={field('firstDayOfWeek')} />
      </Section>

      <Section title="PDF Attachment">
        <ToggleRow label="Attach PDF with invoice & quote emails" checked={form.pdfAttachInvoice} onClick={toggle('pdfAttachInvoice')} />
        <ToggleRow label="Attach payment receipt PDF to thank-you email" checked={form.pdfAttachReceipt} onClick={toggle('pdfAttachReceipt')} />
        <ToggleRow label="Encrypt PDF files (prevents editing/conversion)" checked={form.pdfEncrypt} onClick={toggle('pdfEncrypt')} />
      </Section>

      <Section title="Discounts">
        <RadioGroup label="Do you give discounts?" name="discountType" options={[
          { value: 'none', label: "I don't give discounts" },
          { value: 'line_item', label: 'At Line Item Level' },
          { value: 'transaction', label: 'At Transaction Level' },
        ]} form={form} field={field} />
      </Section>

      <Section title="Additional Charges">
        <CheckboxGrid label="Select additional charges" options={[
          { key: 'chargeAdjustments', label: 'Adjustments' },
          { key: 'chargeShipping', label: 'Shipping Charges' },
        ]} form={form} field={field} />
        {form.chargeShipping && (
          <div className="mt-3 pl-4 border-l-2 border-indigo-200">
            <ToggleRow label="Enable tax automation for shipping charges" checked={form.shippingTaxAuto} onClick={toggle('shippingTaxAuto')} desc="The tax rate associated with a customer will be applied to the shipping charge." />
          </div>
        )}
      </Section>

      <Section title="Tax Configuration">
        <RadioGroup label="Do you sell items at rates inclusive of tax?" name="taxMode" options={[
          { value: 'exclusive', label: 'Tax Exclusive' },
          { value: 'inclusive', label: 'Tax Inclusive' },
        ]} form={form} field={field} />
        <div className="mt-4">
          <p className="text-xs font-medium text-slate-600 mb-2">Rounding off in Sales Transactions</p>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="roundingMode" value="none" checked={!form.roundingMode || form.roundingMode === 'none'} onChange={field('roundingMode')} className="border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              <span className="text-xs text-slate-700">No Rounding</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="roundingMode" value="nearest_whole" checked={form.roundingMode === 'nearest_whole'} onChange={field('roundingMode')} className="border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              <span className="text-xs text-slate-700">Round off the total to the nearest whole number</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="roundingMode" value="nearest_incremental" checked={form.roundingMode === 'nearest_incremental'} onChange={field('roundingMode')} className="border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              <span className="text-xs text-slate-700">Round off the total to the nearest incremental value</span>
            </label>
          </div>
        </div>
      </Section>

      <Section title="Salesperson & Profit Margin">
        <ToggleRow label="Add a field for salesperson" checked={form.enableSalesperson} onClick={toggle('enableSalesperson')} />
        <ToggleRow label="Enable Profit Margin estimation" checked={form.enableProfitMargin} onClick={toggle('enableProfitMargin')} desc="Shows profit margin estimate for each line item and overall transaction." />
      </Section>

      <Section title="Billable Expenses">
        <ToggleRow label="Track billable bills and expenses while invoicing" checked={form.trackBillable} onClick={toggle('trackBillable')} />
        {form.trackBillable && (
          <Field label="Default Markup Percentage (%)" type="number" placeholder="0" value={form.defaultMarkup || ''} onChange={field('defaultMarkup')} />
        )}
      </Section>

      <Section title="Document Copies">
        <RadioGroup label="Default print preferences" name="docCopyMode" options={docCopyOptions} form={form} field={field} />
      </Section>

      <Section title="Weekly Summary">
        <ToggleRow label="Send Weekly Summary report" checked={form.weeklySummary} onClick={toggle('weeklySummary')} desc="All users with Admin access will receive a summary of all business transactions for each week." />
      </Section>

      <Section title="Payment Retention">
        <ToggleRow label="Allow customers to retain a portion of invoice amount" checked={form.paymentRetention} onClick={toggle('paymentRetention')} desc="Enable this option to allow your customers to retain a part of their total invoice amount." />
      </Section>

      <Section title="Organization Address Format">
        <p className="text-xs text-slate-500 mb-2">Displayed in PDF only</p>
        <textarea value={form.addressFormat || ''} onChange={field('addressFormat')} rows={8}
          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono text-xs"
          placeholder={`\${ORGANIZATION.COMPANYID_LABEL} \${ORGANIZATION.COMPANYID_VALUE}\n\${ORGANIZATION.COMPANYTAXID_LABEL} \${ORGANIZATION.COMPANYTAXID_VALUE}\n\${ORGANIZATION.STREET_ADDRESS_1}\n\${ORGANIZATION.STREET_ADDRESS_2}\n\${ORGANIZATION.CITY} \${ORGANIZATION.STATE} \${ORGANIZATION.POSTAL_CODE}\n\${ORGANIZATION.COUNTRY}\n\${ORGANIZATION.PHONE}\n\${ORGANIZATION.EMAIL}\n\${ORGANIZATION.WEBSITE}`} />
        <div className="flex items-center gap-2 mt-2">
          <button type="button" onClick={() => { /* insert placeholder */ }} className="text-xs text-indigo-600 hover:underline">Insert Placeholders</button>
          <button type="button" onClick={() => { /* preview */ }} className="text-xs text-slate-500 hover:underline">Preview</button>
        </div>
      </Section>

      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Currencies ────────────────────────────────────────────────────────────
const ALL_CURRENCIES = [
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' }, { code: 'AFN', name: 'Afghan Afghani', symbol: '؋' },
  { code: 'ALL', name: 'Albanian Lek', symbol: 'L' }, { code: 'AMD', name: 'Armenian Dram', symbol: '֏' },
  { code: 'ANG', name: 'Netherlands Antillian Guilder', symbol: 'ƒ' }, { code: 'AOA', name: 'Angolan Kwanza', symbol: 'Kz' },
  { code: 'ARS', name: 'Argentine Peso', symbol: '$' }, { code: 'AUD', name: 'Australian Dollar', symbol: '$' },
  { code: 'AWG', name: 'Aruban Guilder', symbol: 'ƒ' }, { code: 'AZN', name: 'Azerbaijanian Manat', symbol: '₼' },
  { code: 'BAM', name: 'Bosnia and Herzegovina Convertible Marks', symbol: 'KM' }, { code: 'BBD', name: 'Barbadian Dollar', symbol: '$' },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳' }, { code: 'BGN', name: 'Bulgarian Lev', symbol: 'лв' },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: '.د.ب' }, { code: 'BIF', name: 'Burundian Franc', symbol: 'FBu' },
  { code: 'BMD', name: 'Bermudian Dollar (Bermuda Dollar)', symbol: '$' }, { code: 'BND', name: 'Brunei Dollar', symbol: '$' },
  { code: 'BOB', name: 'Bolivian Boliviano', symbol: 'Bs' }, { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'BSD', name: 'Bahamian Dollar', symbol: '$' }, { code: 'BTN', name: 'Bhutanese Ngultrum', symbol: 'Nu.' },
  { code: 'BWP', name: 'Botswana Pula', symbol: 'P' }, { code: 'BYN', name: 'Belarussian Ruble', symbol: 'Br' },
  { code: 'BZD', name: 'Belize Dollar', symbol: '$' }, { code: 'CAD', name: 'Canadian Dollar', symbol: '$' },
  { code: 'CDF', name: 'Congolese franc', symbol: 'FC' }, { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
  { code: 'CLP', name: 'Chilean Peso', symbol: '$' }, { code: 'CNY', name: 'Yuan Renminbi', symbol: '¥' },
  { code: 'COP', name: 'Colombian Peso', symbol: '$' }, { code: 'CRC', name: 'Costa Rican Colon', symbol: '₡' },
  { code: 'CUC', name: 'Cuban Convertible Peso', symbol: '$' }, { code: 'CUP', name: 'Cuban Peso', symbol: '$' },
  { code: 'CVE', name: 'Cape Verdean Escudo', symbol: '$' }, { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč' },
  { code: 'DJF', name: 'Djiboutian Franc', symbol: 'Fdj' }, { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
  { code: 'DOP', name: 'Dominican Peso', symbol: 'RD$' }, { code: 'DZD', name: 'Algerian Dinar', symbol: 'د.ج' },
  { code: 'EGP', name: 'Egyptian Pound', symbol: '£' }, { code: 'ERN', name: 'Eritrean Nakfa', symbol: 'Nfk' },
  { code: 'ETB', name: 'Ethiopian Birr', symbol: 'Br' }, { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'FJD', name: 'Fijian Dollar', symbol: '$' }, { code: 'FKP', name: 'Falkland Islands Pound', symbol: '£' },
  { code: 'GBP', name: 'Pound Sterling', symbol: '£' }, { code: 'GEL', name: 'Georgian Lari', symbol: '₾' },
  { code: 'GGP', name: 'Guernsey Pound', symbol: '£' }, { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵' },
  { code: 'GIP', name: 'Gibraltar Pound', symbol: '£' }, { code: 'GMD', name: 'Gambian Dalasi', symbol: 'D' },
  { code: 'GNF', name: 'Guinean Franc', symbol: 'FG' }, { code: 'GTQ', name: 'Guatemalan Quetzal', symbol: 'Q' },
  { code: 'GYD', name: 'Guyanese Dollar', symbol: '$' }, { code: 'HKD', name: 'Hong Kong Dollar', symbol: '$' },
  { code: 'HNL', name: 'Honduran Lempira', symbol: 'L' }, { code: 'HRK', name: 'Croatian Kuna', symbol: 'kn' },
  { code: 'HTG', name: 'Haitian Gourde', symbol: 'G' }, { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' }, { code: 'ILS', name: 'Israeli new shekel', symbol: '₪' },
  { code: 'IMP', name: 'Manx Pound', symbol: '£' }, { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'IQD', name: 'Iraqi Dinar', symbol: 'ع.د' }, { code: 'IRR', name: 'Iranian Rial', symbol: '﷼' },
  { code: 'ISK', name: 'Icelandic Krona', symbol: 'kr' }, { code: 'JEP', name: 'Jersey Pound', symbol: '£' },
  { code: 'JMD', name: 'Jamaican Dollar', symbol: '$' }, { code: 'JOD', name: 'Jordanian Dinar', symbol: 'د.ا' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' }, { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
  { code: 'KGS', name: 'Kyrgyzstani Som', symbol: 'с' }, { code: 'KHR', name: 'Cambodian Riel', symbol: '៛' },
  { code: 'KMF', name: 'Comorian Franc', symbol: 'CF' }, { code: 'KPW', name: 'North Korean Won', symbol: '₩' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' }, { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك' },
  { code: 'KYD', name: 'Cayman Islands Dollar', symbol: '$' }, { code: 'KZT', name: 'Kazakhstani Tenge', symbol: '₸' },
  { code: 'LAK', name: 'Lao Kip', symbol: '₭' }, { code: 'LBP', name: 'Lebanese Pound', symbol: 'ل.ل' },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs' }, { code: 'LRD', name: 'Liberian Dollar', symbol: '$' },
  { code: 'LSL', name: 'Lesotho Loti', symbol: 'L' }, { code: 'LYD', name: 'Libyan Dinar', symbol: 'ل.د' },
  { code: 'MAD', name: 'Moroccan Dirham', symbol: 'د.م.' }, { code: 'MDL', name: 'Moldovan Leu', symbol: 'L' },
  { code: 'MGA', name: 'Malagascy Ariary', symbol: 'Ar' }, { code: 'MKD', name: 'Macedonian Denar', symbol: 'ден' },
  { code: 'MMK', name: 'Burmese Kyat', symbol: 'K' }, { code: 'MNT', name: 'Mongolian Tugrik', symbol: '₮' },
  { code: 'MOP', name: 'Macanese Pataca', symbol: 'MOP$' }, { code: 'MRU', name: 'Ouguiya', symbol: 'UM' },
  { code: 'MUR', name: 'Mauritian Rupee', symbol: '₨' }, { code: 'MVR', name: 'Maldivian Rufiyaa', symbol: 'Rf' },
  { code: 'MWK', name: 'Malawian Kwacha', symbol: 'MK' }, { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' }, { code: 'MZN', name: 'Mozambican Metical', symbol: 'MT' },
  { code: 'NAD', name: 'Namibian Dollar', symbol: '$' }, { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
  { code: 'NIO', name: 'Nicaraguan Cordoba Oro', symbol: 'C$' }, { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'NPR', name: 'Nepalese Rupee', symbol: 'Rs' }, { code: 'NZD', name: 'New Zealand Dollar', symbol: '$' },
  { code: 'OMR', name: 'Omani rial', symbol: '﷼' }, { code: 'PAB', name: 'Panamanian Balboa', symbol: 'B/.' },
  { code: 'PEN', name: 'Peruvian Nuevo Sol', symbol: 'S/' }, { code: 'PGK', name: 'Papua New Guinean Kina', symbol: 'K' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱' }, { code: 'PKR', name: 'Pakistani Rupee', symbol: 'Rs' },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' }, { code: 'PYG', name: 'Paraguayan Guarani', symbol: '₲' },
  { code: 'QAR', name: 'Qatari Riyal', symbol: '﷼' }, { code: 'RON', name: 'Romanian Leu', symbol: 'lei' },
  { code: 'RSD', name: 'Serbian Dinar', symbol: 'дин' }, { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
  { code: 'RWF', name: 'Rwandan Franc', symbol: 'FRw' }, { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
  { code: 'SBD', name: 'Solomon Islands Dollar', symbol: '$' }, { code: 'SCR', name: 'Seychellois Rupee', symbol: '₨' },
  { code: 'SDG', name: 'Sudanese Pound', symbol: '£' }, { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' }, { code: 'SHP', name: 'Saint Helena Pound', symbol: '£' },
  { code: 'SLE', name: 'Sierra Leonean Leone', symbol: 'Le' }, { code: 'SOS', name: 'Somali Shilling', symbol: 'Sh' },
  { code: 'SRD', name: 'Surinamese Dollar', symbol: '$' }, { code: 'SSP', name: 'South Sudanese Pound', symbol: '£' },
  { code: 'STN', name: 'Sao Tome and Principe Dobra', symbol: 'Db' }, { code: 'SYP', name: 'Syrian Pound', symbol: '£' },
  { code: 'SZL', name: 'Swazi Lilangeni', symbol: 'L' }, { code: 'THB', name: 'Thai Baht', symbol: '฿' },
  { code: 'TJS', name: 'Tajikistani Somoni', symbol: 'SM' }, { code: 'TMT', name: 'Turkmenistan Manat', symbol: 'T' },
  { code: 'TND', name: 'Tunisian Dinar', symbol: 'د.ت' }, { code: 'TOP', name: 'Tongan Paanga', symbol: 'T$' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺' }, { code: 'TTD', name: 'Trinidad and Tobago Dollar', symbol: '$' },
  { code: 'TWD', name: 'New Taiwan Dollar', symbol: 'NT$' }, { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'Sh' },
  { code: 'UAH', name: 'Ukrainian Hryvnia', symbol: '₴' }, { code: 'UGX', name: 'Ugandan Shilling', symbol: 'Sh' },
  { code: 'USD', name: 'United States Dollar', symbol: '$' }, { code: 'UYU', name: 'Uruguayan peso', symbol: '$' },
  { code: 'UZS', name: 'Uzbekistani Sum', symbol: 'Soʻm' }, { code: 'VES', name: 'Venezuelan Bolivar Soberano', symbol: 'Bs' },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' }, { code: 'VUV', name: 'Vanuatu Vatu', symbol: 'VT' },
  { code: 'WST', name: 'Samoan Tala', symbol: 'T' }, { code: 'XAF', name: 'Central African CFA Franc', symbol: 'Fr' },
  { code: 'XCD', name: 'Eastern Caribbean Dollar', symbol: '$' }, { code: 'XOF', name: 'CFA Franc BCEAO', symbol: 'Fr' },
  { code: 'XPF', name: 'CFP Franc', symbol: 'Fr' }, { code: 'YER', name: 'Yemeni Rial', symbol: '﷼' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' }, { code: 'ZMW', name: 'Zambian Kwacha', symbol: 'ZK' },
  { code: 'ZWL', name: 'Zimbabwe Dollar', symbol: '$' },
].sort((a, b) => a.code.localeCompare(b.code));

export function CurrenciesPage() {
  const { form, handleSave, isPending, saved, error, setForm } = useSettingsForm('currencies', {
    baseCurrency: 'NGN',
    activeCurrencies: ['NGN', 'USD', 'EUR', 'GBP'],
    rates: {} as Record<string, number>,
    customCurrencies: [] as { code: string; name: string; symbol: string; decimalPlaces: number; format: string }[],
  });
  const [editRate, setEditRate] = useState<string | null>(null);
  const [rateValue, setRateValue] = useState('');
  const [newCurrencyOpen, setNewCurrencyOpen] = useState(false);
  const [newCurrency, setNewCurrency] = useState({ code: '', name: '', symbol: '', decimalPlaces: 2, format: '{symbol}{amount}' });

  const activeSet = new Set(form.activeCurrencies || []);
  const base = form.baseCurrency || 'NGN';
  const rates = form.rates || {};
  const customCurrencies = form.customCurrencies || [];

  function toggleCurrency(code: string) {
    const set = new Set(activeSet);
    if (code === base) return;
    if (set.has(code)) set.delete(code); else set.add(code);
    setForm((p: any) => ({ ...p, activeCurrencies: Array.from(set) }));
  }

  function setBase(code: string) {
    const set = new Set(activeSet);
    set.add(code);
    setForm((p: any) => ({ ...p, baseCurrency: code, activeCurrencies: Array.from(set) }));
  }

  function openRate(code: string) {
    setEditRate(code);
    setRateValue(String(rates[code] || ''));
  }

  function saveRate() {
    if (!editRate) return;
    const val = parseFloat(rateValue);
    if (isNaN(val) || val <= 0) return;
    setForm((p: any) => ({ ...p, rates: { ...(p.rates || {}), [editRate]: val } }));
    setEditRate(null);
  }

  function addCustomCurrency() {
    if (!newCurrency.code.trim() || !newCurrency.name.trim()) return;
    const code = newCurrency.code.trim().toUpperCase();
    if (ALL_CURRENCIES.some(c => c.code === code) || customCurrencies.some(c => c.code === code)) return;
    const updated = [...customCurrencies, { ...newCurrency, code }];
    setForm((p: any) => ({ ...p, customCurrencies: updated, activeCurrencies: [...(p.activeCurrencies || []), code] }));
    setNewCurrencyOpen(false);
    setNewCurrency({ code: '', name: '', symbol: '', decimalPlaces: 2, format: '{symbol}{amount}' });
  }

  function getAllCurrencies() {
    const all = [...ALL_CURRENCIES];
    customCurrencies.forEach(cc => { if (!all.some(c => c.code === cc.code)) all.push(cc); });
    return all.sort((a, b) => a.code.localeCompare(b.code));
  }

  const allCurrencies = getAllCurrencies();

  return (
    <PageShell title="Currencies" desc="Manage currencies used in your account." icon={CreditCard}>
      <Section title="Active Currencies">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-slate-400">{activeSet.size} currency{activeSet.size !== 1 ? 'ies' : 'y'} active</p>
          <button onClick={() => setNewCurrencyOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors">
            <Plus size={14} /> New Currency
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="py-2.5 pr-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                <th className="py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Symbol</th>
                <th className="py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Rate (1 {base})</th>
                <th className="py-2.5 pl-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">More Actions</th>
              </tr>
            </thead>
            <tbody>
              {allCurrencies.filter(c => activeSet.has(c.code)).map(c => (
                <tr key={c.code} className={`border-b border-slate-100 hover:bg-slate-50 ${c.code === base ? 'bg-indigo-50/50' : ''}`}>
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2.5">
                      <span className={`text-sm ${c.code === base ? 'font-semibold text-indigo-700' : 'text-slate-800'}`}>{c.code} — {c.name}</span>
                      {c.code === base && <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded uppercase">Base</span>}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-lg text-slate-600">{c.symbol}</td>
                  <td className="py-3 px-3">
                    {editRate === c.code ? (
                      <div className="flex items-center gap-1">
                        <input type="number" step="0.01" min="0" value={rateValue} onChange={e => setRateValue(e.target.value)} className="w-24 px-2 py-1 text-xs border border-slate-200 rounded" autoFocus />
                        <button onClick={saveRate} className="p-1 text-emerald-600 hover:text-emerald-700"><Check size={14} /></button>
                        <button onClick={() => setEditRate(null)} className="p-1 text-slate-400 hover:text-slate-600"><X size={14} /></button>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-600">{rates[c.code] ? `1 ${c.code} = ${rates[c.code]} ${base}` : '—'}</span>
                    )}
                  </td>
                  <td className="py-3 pl-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {c.code !== base && (
                        <button onClick={() => setBase(c.code)} className="p-1.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" title="Set as base currency">
                          <Star size={14} />
                        </button>
                      )}
                      <button onClick={() => openRate(c.code)} className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100" title="Set exchange rate">
                        <Settings size={14} />
                      </button>
                      <button onClick={() => toggleCurrency(c.code)} className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50" title="Remove currency">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {activeSet.size === 0 && <p className="text-sm text-slate-400 py-4 text-center">No currencies selected. Add currencies below or create a new one.</p>}
      </Section>

      <Section title="Available Currencies">
        <div className="flex flex-wrap gap-2">
          {allCurrencies.filter(c => !activeSet.has(c.code)).map(c => (
            <button
              key={c.code}
              onClick={() => toggleCurrency(c.code)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              <span className="text-sm">{c.symbol}</span>
              <span>{c.code}</span>
            </button>
          ))}
        </div>
      </Section>

      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />

      {newCurrencyOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">New Currency</h2>
              <button onClick={() => setNewCurrencyOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <Field label="Currency Code" placeholder="e.g. ABC" value={newCurrency.code} onChange={e => setNewCurrency(p => ({ ...p, code: e.target.value }))} desc="3-letter ISO code" />
              <Field label="Currency Symbol" placeholder="e.g. $" value={newCurrency.symbol} onChange={e => setNewCurrency(p => ({ ...p, symbol: e.target.value }))} />
              <Field label="Currency Name" placeholder="e.g. Example Dollar" value={newCurrency.name} onChange={e => setNewCurrency(p => ({ ...p, name: e.target.value }))} />
              <Field label="Decimal Places" type="number" placeholder="2" value={String(newCurrency.decimalPlaces)} onChange={e => setNewCurrency(p => ({ ...p, decimalPlaces: parseInt(e.target.value) || 2 }))} />
              <Field label="Format" placeholder="{symbol}{amount}" value={newCurrency.format} onChange={e => setNewCurrency(p => ({ ...p, format: e.target.value }))} desc="Use {symbol} and {amount} placeholders" />
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setNewCurrencyOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                <button onClick={addCustomCurrency} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Add Currency</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

// ─── Payment Terms ─────────────────────────────────────────────────────────
const DEFAULT_TERMS = [
  { label: 'Due end of next month', value: 'end_of_next_month', days: 0, desc: 'Payment due at the end of the following month' },
  { label: 'Due end of the month', value: 'end_of_month', days: 0, desc: 'Payment due at the end of the current month' },
  { label: 'Default', value: 'default', days: 0, desc: 'Default payment terms' },
  { label: 'Due on Receipt', value: 'dueonreceipt', days: 0, desc: 'Payment due immediately upon receipt' },
  { label: 'Net 15', value: 'net15', days: 15, desc: 'Payment due within 15 days' },
  { label: 'Net 30', value: 'net30', days: 30, desc: 'Payment due within 30 days' },
  { label: 'Net 60', value: 'net60', days: 60, desc: 'Payment due within 60 days' },
  { label: 'Net 90', value: 'net90', days: 90, desc: 'Payment due within 90 days' },
];

export function PaymentTermsPage() {
  const { form, handleSave, isPending, saved, error, setForm } = useSettingsForm('paymentTerms', {
    defaultTerm: 'net30',
    customTerms: DEFAULT_TERMS,
  });
  const [editTerm, setEditTerm] = useState<{ index: number; label: string; desc: string } | null>(null);
  const [newTermOpen, setNewTermOpen] = useState(false);
  const [newTerm, setNewTerm] = useState({ label: '', desc: '' });

  const terms = form.customTerms || DEFAULT_TERMS;
  const defaultTerm = form.defaultTerm || 'net30';

  function setDefault(value: string) {
    setForm((p: any) => ({ ...p, defaultTerm: value }));
  }

  function openEditTerm(i: number) {
    const t = terms[i];
    setEditTerm({ index: i, label: t.label, desc: t.desc || '' });
  }

  function saveEditTerm() {
    if (!editTerm || !editTerm.label.trim()) return;
    const updated = terms.map((t: any, i: number) =>
      i === editTerm.index ? { ...t, label: editTerm.label.trim(), desc: editTerm.desc.trim() } : t
    );
    setForm((p: any) => ({ ...p, customTerms: updated }));
    setEditTerm(null);
  }

  function deleteTerm(i: number) {
    const updated = terms.filter((_: any, idx: number) => idx !== i);
    setForm((p: any) => ({ ...p, customTerms: updated }));
  }

  function addTerm() {
    if (!newTerm.label.trim()) return;
    const value = 'custom_' + Date.now();
    const updated = [...terms, { label: newTerm.label.trim(), value, days: 0, desc: newTerm.desc.trim() }];
    setForm((p: any) => ({ ...p, customTerms: updated }));
    setNewTermOpen(false);
    setNewTerm({ label: '', desc: '' });
  }

  return (
    <PageShell title="Payment Terms" desc="Define payment terms for customers and vendors." icon={Clock}>
      <Section title="Payment Terms">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-slate-400">{terms.length} terms</p>
          <button onClick={() => setNewTermOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors">
            <Plus size={14} /> New Term
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="py-2.5 pr-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Terms</th>
                <th className="py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="py-2.5 pl-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">More Actions</th>
              </tr>
            </thead>
            <tbody>
              {terms.map((t: any, i: number) => (
                <tr key={t.value || i} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm text-slate-800">{t.label}</span>
                      {t.desc && <span className="text-xs text-slate-400 hidden sm:inline">— {t.desc}</span>}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    {t.value === defaultTerm ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Default
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Active
                      </span>
                    )}
                  </td>
                  <td className="py-3 pl-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {t.value !== defaultTerm && (
                        <button onClick={() => setDefault(t.value)} className="p-1.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" title="Set as default">
                          <Star size={14} />
                        </button>
                      )}
                      <button onClick={() => openEditTerm(i)} className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100" title="Edit term">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => deleteTerm(i)} className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50" title="Delete term">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />

      {editTerm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Edit Payment Term</h2>
              <button onClick={() => setEditTerm(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <Field label="Term Name" placeholder="e.g. Net 45" value={editTerm.label} onChange={e => setEditTerm(p => p ? { ...p, label: e.target.value } : null)} />
              <Field label="Description" placeholder="e.g. Payment due within 45 days" value={editTerm.desc} onChange={e => setEditTerm(p => p ? { ...p, desc: e.target.value } : null)} />
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setEditTerm(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                <button onClick={saveEditTerm} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {newTermOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">New Payment Term</h2>
              <button onClick={() => setNewTermOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <Field label="Term Name" placeholder="e.g. Net 45" value={newTerm.label} onChange={e => setNewTerm(p => ({ ...p, label: e.target.value }))} />
              <Field label="Description" placeholder="e.g. Payment due within 45 days" value={newTerm.desc} onChange={e => setNewTerm(p => ({ ...p, desc: e.target.value }))} />
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setNewTermOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                <button onClick={addTerm} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Add Term</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

// ─── Opening Balances ──────────────────────────────────────────────────────
function downloadSampleCSV(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text: string): string[][] {
  return text.split('\n').filter(Boolean).map(line =>
    line.split(',').map(cell => cell.trim().replace(/^"(.*)"$/, '$1'))
  );
}

const SYSTEM_FIELDS = [
  { value: 'accountName', label: 'Account Name', required: true },
  { value: 'amount', label: 'Amount', required: true },
  { value: 'debitOrCredit', label: 'Debit or Credit' },
  { value: 'migrationDate', label: 'Migration Date' },
  { value: 'contactName', label: 'Contact Name' },
  { value: 'currencyCode', label: 'Currency Code' },
  { value: 'exchangeRate', label: 'Exchange Rate' },
];

export function OpeningBalancesPage() {
  const { form, handleSave, isPending, saved, error, setForm } = useSettingsForm('openingBalances', {
    location: '',
    migrationDate: '2025-03-01',
    arTotal: 0,
    apTotal: 0,
    adjustmentAccount: 'Opening Balance Adjustments',
    adjustmentAmount: 0,
    importedRows: [] as any[],
  });

  const { settings } = useOrgSettings();
  const locations = settings?.locations || [];

  const { data: accounts } = useQuery<any[]>({
    queryKey: ['accounts'],
    queryFn: async () => { const r = await api.get('/accountant/accounts'); return r.data; },
    enabled: true,
  });

  const [importStep, setImportStep] = useState(0);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [encoding, setEncoding] = useState('UTF-8');
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [isDragOver, setIsDragOver] = useState(false);

  const ar = form.arTotal || 0;
  const ap = form.apTotal || 0;
  const adj = form.adjustmentAmount || 0;
  const grandTotalVal = ar - ap + adj;

  const accountNameMap = new Map(
    (accounts || []).map((a: any) => [a.name.toLowerCase(), a.name])
  );

  function formatMoney(val: number) {
    return val.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function autoMap(headers: string[]) {
    const map: Record<string, string> = {};
    headers.forEach(h => {
      const lower = h.toLowerCase().trim();
      if (lower.includes('account') || lower.includes('name')) map[h] = 'accountName';
      else if (lower.includes('amount') || lower.includes('balance') || lower.includes('total')) map[h] = 'amount';
      else if (lower.includes('debit') || lower.includes('credit') || lower.includes('dr') || lower.includes('cr')) map[h] = 'debitOrCredit';
      else if (lower.includes('date') || lower.includes('migration')) map[h] = 'migrationDate';
      else if (lower.includes('contact') || lower.includes('customer') || lower.includes('vendor') || lower.includes('client')) map[h] = 'contactName';
      else if (lower.includes('currency') || lower.includes('curr') || lower.includes('code')) map[h] = 'currencyCode';
      else if (lower.includes('rate') || lower.includes('exchange') || lower.includes('fx')) map[h] = 'exchangeRate';
    });
    return map;
  }

  function handleFile(file: File) {
    setImportFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const separator = file.name.endsWith('.tsv') ? '\t' : ',';
      const lines = text.split('\n').filter(Boolean);
      if (lines.length < 2) return;
      const rows = lines.map(line => {
        const parts: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') { inQuotes = !inQuotes; }
          else if (ch === separator && !inQuotes) { parts.push(current.trim()); current = ''; }
          else { current += ch; }
        }
        parts.push(current.trim());
        return parts;
      });
      setParsedHeaders(rows[0]);
      setParsedRows(rows.slice(1));
      setFieldMapping(autoMap(rows[0]));
      setImportStep(1);
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function confirmImport() {
    const acctIdx = parsedHeaders.findIndex(h => fieldMapping[h] === 'accountName');
    const amtIdx = parsedHeaders.findIndex(h => fieldMapping[h] === 'amount');
    const dcIdx = parsedHeaders.findIndex(h => fieldMapping[h] === 'debitOrCredit');
    const dateIdx = parsedHeaders.findIndex(h => fieldMapping[h] === 'migrationDate');
    const contactIdx = parsedHeaders.findIndex(h => fieldMapping[h] === 'contactName');
    const currIdx = parsedHeaders.findIndex(h => fieldMapping[h] === 'currencyCode');
    const rateIdx = parsedHeaders.findIndex(h => fieldMapping[h] === 'exchangeRate');

    if (acctIdx === -1 || amtIdx === -1) return;

    const rows = parsedRows.map((row, i) => {
      const rawAcct = row[acctIdx] || '';
      const matched = accountNameMap.get(rawAcct.toLowerCase().trim());
      return {
        id: `imported_${i}`,
        accountName: matched || rawAcct,
        accountMatched: !!matched,
        amount: parseFloat(row[amtIdx]) || 0,
        debitOrCredit: dcIdx >= 0 ? row[dcIdx] : 'Debit',
        migrationDate: dateIdx >= 0 ? row[dateIdx] : form.migrationDate,
        contactName: contactIdx >= 0 ? row[contactIdx] : '',
        currencyCode: currIdx >= 0 ? row[currIdx] : '',
        exchangeRate: parseFloat(rateIdx >= 0 ? row[rateIdx] : '1') || 1,
      };
    });

    let totalAr = 0, totalAp = 0;
    for (const r of rows) {
      const baseAmt = r.amount * r.exchangeRate;
      const isDebit = r.debitOrCredit.toLowerCase().startsWith('d');
      if (r.accountName.toLowerCase().includes('receivable')) {
        totalAr += isDebit ? baseAmt : -baseAmt;
      } else if (r.accountName.toLowerCase().includes('payable')) {
        totalAp += isDebit ? baseAmt : -baseAmt;
      }
    }

    setForm((p: any) => ({
      ...p,
      arTotal: totalAr || p.arTotal,
      apTotal: totalAp || p.apTotal,
      importedRows: rows,
      migrationDate: rows[0]?.migrationDate || p.migrationDate,
    }));
    setImportStep(0);
    setImportFile(null);
  }

  function renderUploadZone() {
    return (
      <div
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition ${
          isDragOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 hover:border-slate-400 bg-white'
        }`}
        onClick={() => document.getElementById('ob-file-input')?.click()}
      >
        <Upload size={36} className="mx-auto text-slate-300 mb-3" />
        <p className="text-sm font-medium text-slate-700 mb-1">Drag and drop file to import</p>
        <p className="text-xs text-slate-400">Maximum File Size: 25 MB &bull; File Format: CSV or TSV or XLS</p>
        <input
          id="ob-file-input"
          type="file" accept=".csv,.tsv,.xls,.xlsx"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        <div className="mt-5 flex items-center justify-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); downloadSampleCSV('sample_opening_balance.csv',
            ['Migration Date', 'Account Name', 'Debit or Credit', 'Currency Code', 'Amount', 'Exchange Rate', 'Contact Name'],
            [['2017-01-01', 'Accounts Receivable', 'Debit', 'USD', '10000.0', '1.000000', 'Ethan'],
             ['2017-01-01', 'Accounts Payable', 'Credit', 'USD', '10000.0', '1.000000', 'Edward'],
             ['2017-01-01', 'Salaries and Employee Wages', 'Debit', 'USD', '10000', '1', ''],
             ['2017-01-01', 'General Income', 'Credit', 'USD', '10000', '1', '']]
          ); }} className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition">
            <Download size={14} /> Download a sample file
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Download a sample file and compare it to your import file to ensure you have the file perfect for the import.
        </p>
      </div>
    );
  }

  function renderConfigureStep() {
    const headerCount = parsedHeaders.length;
    const rowCount = parsedRows.length;
    return (
      <div className="space-y-5">
        <div className="flex items-center text-xs text-slate-500 mb-2">
          <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> File selected: <span className="font-medium text-slate-700">{importFile?.name}</span></span>
          <span className="mx-3 text-slate-300">|</span>
          <span>{headerCount} columns</span>
          <span className="mx-3 text-slate-300">|</span>
          <span>{rowCount} rows</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Character Encoding</label>
            <select value={encoding} onChange={e => setEncoding(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white text-slate-800">
              <option>UTF-8</option>
              <option>ISO-8859-1</option>
              <option>Windows-1252</option>
              <option>UTF-16</option>
            </select>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <p className="text-xs text-amber-700">
            <strong>Page Tips:</strong> If you have files in other formats, you can convert it to an accepted file format using any online/offline converter. You can configure your import settings and save them for future too!
          </p>
        </div>
        <div className="flex justify-between items-center">
          <button onClick={() => { setImportStep(0); setImportFile(null); }} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition">Cancel</button>
          <button onClick={() => setImportStep(2)} disabled={!parsedHeaders.length} className="inline-flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition">
            Continue <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  function renderMapFieldsStep() {
    return (
      <div className="space-y-5">
        <p className="text-xs text-slate-500">Map your file columns to the system fields. Required fields are marked with <span className="text-red-500">*</span>.</p>
        <div className="space-y-3 max-w-lg">
          {parsedHeaders.map(h => (
            <div key={h} className="flex items-center gap-3">
              <span className="w-36 text-sm text-slate-700 truncate shrink-0">{h}</span>
              <ChevronRight size={14} className="text-slate-300 shrink-0" />
              <select
                value={fieldMapping[h] || ''}
                onChange={e => setFieldMapping(p => ({ ...p, [h]: e.target.value }))}
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white text-slate-800"
              >
                <option value="">— Skip —</option>
                {SYSTEM_FIELDS.map(f => (
                  <option key={f.value} value={f.value}>
                    {f.label}{f.required ? ' *' : ''}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center pt-2">
          <button onClick={() => setImportStep(1)} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition">
            <ChevronLeft size={16} /> Back
          </button>
          <button
            onClick={() => setImportStep(3)}
            disabled={!parsedHeaders.some(h => fieldMapping[h] === 'accountName') || !parsedHeaders.some(h => fieldMapping[h] === 'amount')}
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
          >
            Continue <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  function renderPreviewStep() {
    const acctIdx = parsedHeaders.findIndex(h => fieldMapping[h] === 'accountName');
    const amtIdx = parsedHeaders.findIndex(h => fieldMapping[h] === 'amount');
    const dcIdx = parsedHeaders.findIndex(h => fieldMapping[h] === 'debitOrCredit');
    const contactIdx = parsedHeaders.findIndex(h => fieldMapping[h] === 'contactName');
    const currIdx = parsedHeaders.findIndex(h => fieldMapping[h] === 'currencyCode');

    const previewRows = parsedRows.slice(0, 50);
    let totalDebit = 0, totalCredit = 0;

    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
          <CheckCircle2 size={14} className="text-emerald-500" />
          <span>Parsed <strong>{parsedRows.length}</strong> rows. Showing first {Math.min(50, parsedRows.length)}.</span>
        </div>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-left font-semibold text-slate-500 uppercase tracking-wide">
                <th className="px-3 py-2">Account Name</th>
                <th className="px-3 py-2">Match</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Debit/Credit</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Currency</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, i) => {
                const rawAcct = row[acctIdx] || '';
                const matched = accountNameMap.get(rawAcct.toLowerCase().trim());
                const amount = parseFloat(row[amtIdx]) || 0;
                const isDebit = dcIdx >= 0 ? row[dcIdx]?.toLowerCase().startsWith('d') : true;
                if (isDebit) totalDebit += amount; else totalCredit += amount;
                return (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-700 max-w-48 truncate">{rawAcct}</td>
                    <td className="px-3 py-2">{matched ? <span className="text-emerald-600 font-medium">✓</span> : <span className="text-amber-500 font-medium">?</span>}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-800">{amount.toFixed(2)}</td>
                    <td className="px-3 py-2">{dcIdx >= 0 ? row[dcIdx] : '—'}</td>
                    <td className="px-3 py-2 text-slate-500">{contactIdx >= 0 ? row[contactIdx] : '—'}</td>
                    <td className="px-3 py-2">{currIdx >= 0 ? row[currIdx] : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="bg-slate-50 rounded-lg p-4 flex items-center justify-between">
          <div className="space-y-1 text-xs">
            <p className="text-slate-600">Total Debit: <span className="font-semibold text-slate-800">₦{formatMoney(totalDebit)}</span></p>
            <p className="text-slate-600">Total Credit: <span className="font-semibold text-slate-800">₦{formatMoney(totalCredit)}</span></p>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <button onClick={() => setImportStep(2)} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition">
            <ChevronLeft size={16} /> Back
          </button>
          <button onClick={confirmImport} className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition">
            <Check size={16} /> Confirm Import
          </button>
        </div>
      </div>
    );
  }

  return (
    <PageShell title="Opening Balances" desc="Set up opening balances for your accounts." icon={Scale}>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-5">
        <h3 className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-3">Page Tips</h3>
        <ul className="space-y-2 text-xs text-blue-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />Generate the Trial Balance report in your previous accounting software on the date you're migrating to SkyBooks.</li>
          <li className="flex items-start gap-2"><span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />Add all your bank and credit card accounts in the Banking module of SkyBooks. Once added, you can enter their balances.</li>
          <li className="flex items-start gap-2"><span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />Import all your items along with their opening stocks.</li>
          <li className="flex items-start gap-2"><span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />Import all your contacts along with their opening balances.</li>
        </ul>
      </div>

      <Section title="Opening Balances">
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Location</label>
              <select value={form.location || ''} onChange={e => setForm((p: any) => ({ ...p, location: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white text-slate-800">
                <option value="">Select a location...</option>
                {locations.map((loc: any) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Migration Date</label>
              <input type="date" value={form.migrationDate || ''} onChange={e => setForm((p: any) => ({ ...p, migrationDate: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white text-slate-800" />
              <p className="text-xs text-slate-400 mt-1">The date on which you generated the Trial Balance report in your previous accounting software while migrating to SkyBooks.</p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Opening Balances — Select File</h3>

            {importStep === 0 && renderUploadZone()}

            {importStep >= 1 && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-1 px-5 py-3 bg-slate-50 border-b border-slate-200">
                  {[
                    { step: 1, label: 'Configure' },
                    { step: 2, label: 'Map Fields' },
                    { step: 3, label: 'Preview' },
                  ].map(s => (
                    <div key={s.step} className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition ${
                      importStep === s.step ? 'bg-indigo-100 text-indigo-700' : importStep > s.step ? 'text-emerald-600' : 'text-slate-400'
                    }`}>
                      {importStep > s.step ? <CheckCircle2 size={14} /> : <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px] font-bold">{s.step}</span>}
                      {s.label}
                    </div>
                  ))}
                </div>
                <div className="px-5 py-4">
                  {importStep === 1 && renderConfigureStep()}
                  {importStep === 2 && renderMapFieldsStep()}
                  {importStep === 3 && renderPreviewStep()}
                </div>
              </div>
            )}
          </div>

          {(form.importedRows?.length > 0) && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p className="text-xs font-medium text-emerald-700 flex items-center gap-1.5 mb-2">
                <CheckCircle2 size={14} /> {form.importedRows.length} rows imported successfully
              </p>
              <div className="overflow-x-auto max-h-40">
                <table className="w-full text-xs">
                  <thead><tr className="text-left font-semibold text-emerald-600">
                    <th className="px-2 py-1">Account</th><th className="px-2 py-1 text-right">Amount</th><th className="px-2 py-1">Dr/Cr</th><th className="px-2 py-1">Contact</th>
                  </tr></thead>
                  <tbody>
                    {(form.importedRows || []).slice(0, 20).map((r: any, i: number) => (
                      <tr key={i} className="border-t border-emerald-100 text-emerald-800">
                        <td className="px-2 py-1">{r.accountName}{!r.accountMatched ? ' ⚠' : ''}</td>
                        <td className="px-2 py-1 text-right font-mono">{r.amount.toFixed(2)}</td>
                        <td className="px-2 py-1">{r.debitOrCredit}</td>
                        <td className="px-2 py-1">{r.contactName || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Opening Balance Adjustments</h4>
            <p className="text-xs text-slate-400">This account will hold the difference in credit and debit.</p>
            <div className="flex items-center justify-between py-2 flex-wrap gap-2">
              <span className="text-sm text-slate-700">{form.adjustmentAccount || 'Opening Balance Adjustments'}</span>
              <input type="number" value={adj} onChange={e => setForm((p: any) => ({ ...p, adjustmentAmount: parseFloat(e.target.value) || 0 }))} className="w-40 px-3 py-2 text-sm border border-slate-200 rounded-lg text-right font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
            <p className="text-xs font-medium text-slate-500 mb-2">TOTAL AMOUNT <span className="text-slate-400 font-normal">(Includes Opening Balance Adjustment account)</span></p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Grand Total</span>
              <span className="text-lg font-mono font-bold text-slate-900">₦{formatMoney(grandTotalVal)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
              <span>Accounts Receivable</span>
              <span className="font-mono">₦{formatMoney(ar)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Accounts Payable</span>
              <span className="font-mono">₦{formatMoney(ap)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Adjustment</span>
              <span className="font-mono">₦{formatMoney(adj)}</span>
            </div>
          </div>
        </div>
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
  const { form, field, toggle, handleSave, isPending, saved, error, setForm } = useSettingsForm('customerPortal', {
    webTabs: true,
    customModules: false,
    portalName: 'wastecaresolutionsresourcesman',
    portalUrl: 'https://books.skybooks.com/portal/wastecaresolutionsresourcesman',
    bannerMessage: '',
    enableMfa: false,
    allowPaymentMethods: false,
    preventDuplicatePayments: false,
    allowSignup: false,
    notifyActivity: false,
    notifyEmail: true,
    notifyInApp: true,
    notifyOnComment: false,
    allowEditInfo: false,
    allowForwardDocs: false,
    allowBulkPayments: false,
    enableReviews: false,
    allowViewSalesOrders: false,
    displaySalesReceipts: false,
    displayCreditNotes: false,
    allowViewProjects: false,
    enableIdentityVerification: false,
  });

  return (
    <PageShell title="Customer Portal" desc="Configure your customer self-service portal." icon={Store}>
      <Section title="Preferences">
        <ToggleRow label="Web Tabs" desc="Enable web tabs in the customer portal." checked={form.webTabs} onClick={toggle('webTabs')} />
        <ToggleRow label="Custom Modules" desc="Enable custom module support in the portal." checked={form.customModules} onClick={toggle('customModules')} />
        <Field label="Portal Name" value={form.portalName || ''} onChange={field('portalName')} placeholder="wastecaresolutionsresourcesman" />
        <Field label="Portal URL" value={form.portalUrl || ''} onChange={field('portalUrl')} placeholder="https://books.skybooks.com/portal/..." />
        <p className="text-xs text-slate-400">Note: The portal name and portal URL will be common for the Customer and Vendor Portal.</p>
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mt-2">
          <p className="text-xs font-medium text-slate-700">Have you tried the Customer Portal feature?</p>
        </div>
      </Section>

      <Section title="Banner Message">
        <textarea
          value={form.bannerMessage || ''}
          onChange={field('bannerMessage')}
          placeholder="This message will be displayed right on top of the 'Home' page of the portal."
          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white text-slate-800 placeholder-slate-400 min-h-[80px] resize-y"
        />
      </Section>

      <Section title="Security">
        <ToggleRow
          label="Enable multi-factor authentication (MFA)"
          desc="Add an extra layer of security to the customer portal by enabling Multi-Factor Authentication (MFA). Once enabled, your customer will need to verify their identity with a code using an authenticator app, in addition to a password. This helps prevent unauthorized access, even if their password is compromised."
          checked={form.enableMfa}
          onClick={toggle('enableMfa')}
        />
        <div className="flex items-start justify-between py-2 flex-wrap gap-2">
          <div>
            <p className="text-sm font-medium text-slate-700">Allow customers to add payment methods</p>
            <p className="text-xs text-slate-400">Your customers will be able to add new payment methods directly from the portal. These payment methods can be associated with both new and existing transactions to facilitate autocharge.</p>
          </div>
          <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold rounded-full uppercase shrink-0">Unavailable in your current plan</span>
        </div>
        <ToggleRow
          label="Prevent duplicate payments"
          desc="Subsequent payments cannot be made for invoices with Pending payments, that is, invoice payments that were made via ACH or any other method that typically takes longer to process. Payments will be allowed again if the previous attempt fails."
          checked={form.preventDuplicatePayments}
          onClick={toggle('preventDuplicatePayments')}
        />
      </Section>

      <Section title="Access">
        <ToggleRow
          label="Allow customers to sign up to the Customer Portal"
          desc="Your customers and their contacts can sign up to the Customer Portal by themselves, using signup links that will be displayed to them while making invoice payments via Payment Links."
          checked={form.allowSignup}
          onClick={toggle('allowSignup')}
        />
        <div className="border-t border-slate-100 pt-3 mt-3">
          <ToggleRow
            label="Notify me about Customer Portal activity"
            desc="You will be notified about your customers' portal activity such as payments, comments or transaction approvals."
            checked={form.notifyActivity}
            onClick={toggle('notifyActivity')}
          />
          {form.notifyActivity && (
            <div className="pl-6 space-y-2 border-l-2 border-indigo-200 ml-1 mt-2">
              <ToggleRow label="Notify via email" checked={form.notifyEmail} onClick={toggle('notifyEmail')} />
              <ToggleRow label="Notify via in-app notification" checked={form.notifyInApp} onClick={toggle('notifyInApp')} />
            </div>
          )}
        </div>
        <div className="border-t border-slate-100 pt-3 mt-3">
          <ToggleRow
            label="Send an email notification to customers when I comment on transactions."
            desc="Your customers will receive an email notification whenever you comment on their transactions with the Show in Portal option enabled."
            checked={form.notifyOnComment}
            onClick={toggle('notifyOnComment')}
          />
        </div>
      </Section>

      <Section title="Customer Permissions">
        <ToggleRow label="Allow customers to upload documents and edit their information in the portal" desc="Your customers will be able to upload documents and edit their basic details, such as their address and display name." checked={form.allowEditInfo} onClick={toggle('allowEditInfo')} />
        <ToggleRow label="Allow customers to forward documents from the portal" desc="Your customers can share invoices with their contact persons via email, right from the portal." checked={form.allowForwardDocs} onClick={toggle('allowForwardDocs')} />
        <ToggleRow label="Enable customers to make bulk payments for invoices" desc="Your customers can select multiple invoices and make a single payment for the selected invoices." checked={form.allowBulkPayments} onClick={toggle('allowBulkPayments')} />
        <ToggleRow label="Enable customer reviews for my service" desc="Your customers can rate your service and provide feedback. These reviews are not public." checked={form.enableReviews} onClick={toggle('enableReviews')} />
        <ToggleRow label="Allow customers to view Sales Orders" desc="This option allows your customers to view Sales Orders in the portal." checked={form.allowViewSalesOrders} onClick={toggle('allowViewSalesOrders')} />
        <ToggleRow label="Display sales receipts in the portal" desc="Your customers will be able to view all their sales receipts and payment details." checked={form.displaySalesReceipts} onClick={toggle('displaySalesReceipts')} />
        <ToggleRow label="Display credit notes in the portal" desc="Your customers will be able to view all of their credit notes, the invoices to which they were applied, and details of refunds." checked={form.displayCreditNotes} onClick={toggle('displayCreditNotes')} />
        <ToggleRow
          label="Allow customers to view projects and timesheets"
          desc="Enabling this option will allow your customers to view the following project related information in the Customer Portal: Project name and description, Logged time, billed and unbilled hours, Fixed cost of the project, Customer approvals and approve them."
          checked={form.allowViewProjects}
          onClick={toggle('allowViewProjects')}
        />
      </Section>

      <Section title="Secure Public Links">
        <ToggleRow
          label="Enable identity verification to view invoices and estimates"
          desc="Require customers to verify their email address or contact number to view or download invoice and estimate PDFs. This keeps their data secure and is recommended when sharing transactions outside the Customer Portal."
          checked={form.enableIdentityVerification}
          onClick={toggle('enableIdentityVerification')}
        />
      </Section>

      <Section title="Support">
        <div className="flex items-start justify-between py-2 flex-wrap gap-3">
          <div>
            <p className="text-sm font-medium text-slate-700">Provide instant support to customers</p>
            <p className="text-xs text-slate-400 mt-0.5">Reach your customers instantly when they're in need! Connect with a live chat service to answer customer queries.</p>
          </div>
          <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition shrink-0">
            Connect Now
          </button>
        </div>
      </Section>

      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Vendor Portal ─────────────────────────────────────────────────────────
export function VendorPortalPage() {
  const { form, field, toggle, handleSave, isPending, saved, error, setForm } = useSettingsForm('vendorPortal', {
    portalName: 'wastecaresolutionsresourcesman',
    portalUrl: 'https://books.skybooks.com/portal/wastecaresolutionsresourcesman',
    bannerMessage: '',
    notifyActivity: false,
    notifyOnComment: false,
    allowEditContact: false,
    allowUploadDocs: false,
    allowAcceptRejectPO: false,
  });

  return (
    <PageShell title="Vendor Portal" desc="Configure your vendor self-service portal." icon={Boxes}>
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5">
        <p className="text-xs text-amber-700">
          Enter a valid portal name (Use only 5 to 30 characters in lower case without any space and special characters)
        </p>
      </div>

      <Section title="Portal Settings">
        <Field label="Portal Name" value={form.portalName || ''} onChange={field('portalName')} placeholder="wastecaresolutionsresourcesman" />
        <Field label="Portal URL" value={form.portalUrl || ''} onChange={field('portalUrl')} placeholder="https://books.skybooks.com/portal/..." />
        <p className="text-xs text-slate-400">Note: The portal name and portal URL will be common for the Customer and Vendor Portal.</p>
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mt-2">
          <p className="text-xs font-medium text-slate-700">Understand how the vendor portal works</p>
        </div>
      </Section>

      <Section title="Banner Message">
        <textarea
          value={form.bannerMessage || ''}
          onChange={field('bannerMessage')}
          placeholder="This message will be displayed right on top of the 'Home' page of the portal."
          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white text-slate-800 placeholder-slate-400 min-h-[80px] resize-y"
        />
      </Section>

      <Section title="Notifications">
        <ToggleRow
          label="Notify me for every activity that takes place in the portal"
          desc="An email and an in-app notification will be sent to you whenever your vendor adds comments, updates custom fields or uploads documents."
          checked={form.notifyActivity}
          onClick={toggle('notifyActivity')}
        />
        <ToggleRow
          label="Notify my vendor when I comment or reject the documents"
          desc="An email notification will be sent to your vendor whenever you add a comment or reject the documents they uploaded."
          checked={form.notifyOnComment}
          onClick={toggle('notifyOnComment')}
        />
      </Section>

      <Section title="Vendor Permissions">
        <ToggleRow
          label="Allow vendors to update their contact details in the portal"
          desc="Vendors can add or edit their shipping/billing addresses, custom fields and other contact details."
          checked={form.allowEditContact}
          onClick={toggle('allowEditContact')}
        />
        <ToggleRow
          label="Allow vendors to upload documents"
          desc="Vendors can upload invoices that support your purchases. Once uploaded, you can verify and convert them into bills in SkyBooks."
          checked={form.allowUploadDocs}
          onClick={toggle('allowUploadDocs')}
        />
        <ToggleRow
          label="Allow vendors to accept/reject purchase orders"
          desc="The purchase orders you create and send will be available in the portal. The vendor can review the orders and accept or reject them."
          checked={form.allowAcceptRejectPO}
          onClick={toggle('allowAcceptRejectPO')}
        />
      </Section>

      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Transaction Number Series ─────────────────────────────────────────────
const DEFAULT_SERIES = [
  { module: 'Credit Note', prefix: 'CN-', start: '00001' },
  { module: 'Journal', prefix: '', start: '1' },
  { module: 'Customer Payment', prefix: '', start: '1' },
  { module: 'Vendor Payment', prefix: '', start: '1' },
  { module: 'Purchase Order', prefix: 'PO-', start: '00001' },
  { module: 'Sales Order', prefix: 'SO-', start: '00001' },
  { module: 'Retainer Invoice', prefix: 'RET-', start: '00001' },
  { module: 'Vendor Credits', prefix: 'DN-', start: '00001' },
  { module: 'Debit Note', prefix: 'CDN-', start: '000001' },
  { module: 'Invoice', prefix: 'INV-', start: '000001' },
  { module: 'Quote', prefix: 'QT-', start: '000001' },
  { module: 'Sales Receipt', prefix: 'SR-', start: '00001' },
  { module: 'Fixed Asset', prefix: 'FA1-', start: '00001' },
  { module: 'Self-Billed Credit Note', prefix: 'SBCN-', start: '000001' },
];

export function TxnNumberingPage() {
  const { form, handleSave, isPending, saved, error, setForm } = useSettingsForm('txnNumbering', {
    series: DEFAULT_SERIES,
  });

  const [showNewSeries, setShowNewSeries] = useState(false);
  const [newModule, setNewModule] = useState('');
  const [newPrefix, setNewPrefix] = useState('');
  const [newStart, setNewStart] = useState('00001');

  const seriesList = form.series || DEFAULT_SERIES;

  function updateSeries(i: number, field: string, val: string) {
    setForm((p: any) => ({
      ...p,
      series: (p.series || []).map((s: any, j: number) => j === i ? { ...s, [field]: val } : s),
    }));
  }

  function addSeries() {
    if (!newModule.trim()) return;
    setForm((p: any) => ({
      ...p,
      series: [...(p.series || []), { module: newModule.trim(), prefix: newPrefix, start: newStart }],
    }));
    setNewModule('');
    setNewPrefix('');
    setNewStart('00001');
    setShowNewSeries(false);
  }

  function removeSeries(i: number) {
    setForm((p: any) => ({
      ...p,
      series: (p.series || []).filter((_: any, j: number) => j !== i),
    }));
  }

  return (
    <PageShell title="Transaction Number Series" desc="Configure numbering prefixes for your transactions." icon={Hash}>
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <span className="px-3 py-1.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full">All Series</span>
        {seriesList.map((s: any, i: number) => (
          <span key={i} className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-full hover:bg-slate-200 transition cursor-default">{s.module}</span>
        ))}
      </div>

      <Section title="Numbering Series">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-2.5">Module</th>
                <th className="px-4 py-2.5">Prefix</th>
                <th className="px-4 py-2.5">Starting Number</th>
                <th className="px-4 py-2.5">Restart Numbering</th>
                <th className="px-4 py-2.5">Preview</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {seriesList.map((s: any, i: number) => (
                <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-sm text-slate-700 font-medium">{s.module}</td>
                  <td className="px-4 py-2.5">
                    <input
                      type="text" value={s.prefix || ''}
                      onChange={e => updateSeries(i, 'prefix', e.target.value)}
                      className="w-24 px-2 py-1.5 text-sm border border-slate-200 rounded font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="text" value={s.start || ''}
                      onChange={e => updateSeries(i, 'start', e.target.value)}
                      className="w-24 px-2 py-1.5 text-sm border border-slate-200 rounded font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600" />
                    </label>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-sm text-slate-600">{s.prefix}{s.start}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => removeSeries(i)} className="text-slate-400 hover:text-red-500 transition"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showNewSeries ? (
          <div className="mt-4 border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Module</label>
                <input type="text" value={newModule} onChange={e => setNewModule(e.target.value)} placeholder="Series name" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Prefix</label>
                <input type="text" value={newPrefix} onChange={e => setNewPrefix(e.target.value)} placeholder="INV-" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Starting Number</label>
                <input type="text" value={newStart} onChange={e => setNewStart(e.target.value)} placeholder="000001" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white font-mono" />
              </div>
              <div className="flex items-end gap-2">
                <button onClick={addSeries} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition">Add</button>
                <button onClick={() => setShowNewSeries(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition">Cancel</button>
              </div>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowNewSeries(true)} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition">
            <Plus size={16} /> New Series
          </button>
        )}
      </Section>

      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── PDF Templates ─────────────────────────────────────────────────────────
const TEMPLATE_CATEGORIES = [
  'Quotes', 'Sales Orders', 'Invoices', 'Sales Receipts', 'Credit Notes',
  'Purchase Orders', 'Payment Receipts', 'Customer Statements', 'Bills',
  'Expenses', 'Vendor Credits', 'Vendor Payments', 'Vendor Statements',
  'Journals', 'Quantity Adjustments', 'Value Adjustments',
];

export function PdfTemplatesPage() {
  const { form, handleSave, isPending, saved, error, setForm } = useSettingsForm('pdfTemplates', {
    templates: {} as Record<string, { active: string; list: { name: string; content: string }[] }>,
  });

  const [activeCat, setActiveCat] = useState('Invoices');
  const templates = form.templates || {};

  function getCatTemplates(cat: string) {
    return templates[cat] || { active: 'Standard', list: [
      { name: 'Default', content: '' },
      { name: 'Standard', content: '' },
    ]};
  }

  function setCatTemplates(cat: string, data: { active: string; list: { name: string; content: string }[] }) {
    setForm((p: any) => ({ ...p, templates: { ...(p.templates || {}), [cat]: data } }));
  }

  const catData = getCatTemplates(activeCat);

  function addTemplate() {
    const newList = [...catData.list, { name: 'New Template', content: '' }];
    setCatTemplates(activeCat, { ...catData, list: newList, active: 'New Template' });
  }

  return (
    <PageShell title="PDF Templates" desc="Customize the layout of your PDF documents." icon={LayoutTemplate}>
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {TEMPLATE_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCat(cat)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition ${
              activeCat === cat ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <Section title={`All ${activeCat} Templates`}>
        <div className="border border-slate-200 rounded-xl overflow-hidden mb-4">
          <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">Preview of</span>
              <select
                value={catData.active}
                onChange={e => setCatTemplates(activeCat, { ...catData, active: e.target.value })}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-800"
              >
                {catData.list.map((t: any) => (
                  <option key={t.name} value={t.name}>{t.name} Template</option>
                ))}
              </select>
            </div>
            <span className="text-xs text-slate-400 bg-white px-3 py-1.5 border border-slate-200 rounded-lg">
              Preview of <strong className="text-slate-600">{catData.active}</strong> template
            </span>
          </div>
          <div className="p-10 flex items-center justify-center bg-white min-h-[200px]">
            <div className="text-center">
              <FileText size={48} className="mx-auto text-slate-200 mb-3" />
              <p className="text-sm text-slate-400">{catData.active} template preview</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {catData.list.map((t: any) => (
              <button
                key={t.name}
                onClick={() => setCatTemplates(activeCat, { ...catData, active: t.name })}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                  catData.active === t.name
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
          <button onClick={addTemplate} className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition">
            <Plus size={14} /> New Template
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-3">Click to add a template from our gallery. You can customize the template title, columns, and headers in line item table.</p>
      </Section>

      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Email Notifications ───────────────────────────────────────────────────
const EMAIL_GROUPS = [
  { label: 'General', items: ['Customer Review Notification', 'Item Notification', 'Task Notification'] },
  { label: 'Sales', items: ['Customer Notification', 'Customer Statement', 'Quote Notification', 'Sales Order Notification', 'Invoice Notification', 'Sales Receipt Notification', 'Recurring Invoice Notification', 'Credit Note Notification', 'Customer Portal Invitation', 'Customer Portal Link', 'Late Fee Notification'] },
  { label: 'Purchases', items: ['Vendor Statement', 'Vendor Credit Notification', 'Vendor Portal Invitation', 'Expense Notification', 'Recurring Expense Notification', 'Expense Refund Notification', 'Purchase Order Notification', 'Bill Notification', 'Recurring Bill Notification'] },
  { label: 'Time Tracking', items: ['Project Notification', 'Timesheet Notification'] },
  { label: 'Accounting', items: ['Chart of Accounts Notification', 'Budget Notification', 'Transfer Fund Notification', 'Deposit Notification', 'Owner Drawings Notification', 'Owner Contribution Notification', 'Other Income Notification', 'Interest Income Notification'] },
  { label: 'Customer Payments', items: ['Payment Thank-you', 'Payment Initiated', 'Payment Refund', 'Card Payment Notification', 'Refund/Credit Notification'] },
  { label: 'Vendor Payments', items: ['Payment Made Notification', 'Payment Refund'] },
];

export function EmailNotificationsPage() {
  const { form, handleSave, isPending, saved, error, setForm } = useSettingsForm('emailNotifications', {
    content: {} as Record<string, { subject: string; content: string; enabled: boolean }>,
  });

  const [sidebarTab, setSidebarTab] = useState('Templates');
  const [selectedNotif, setSelectedNotif] = useState('Payment Refund');
  const content = form.content || {};

  function getNotif(key: string) {
    return content[key] || { subject: 'Payment Refund', content: '', enabled: true };
  }

  function updateNotif(key: string, field: string, val: any) {
    setForm((p: any) => ({
      ...p,
      content: { ...(p.content || {}), [key]: { ...getNotif(key), [field]: val } },
    }));
  }

  const topTabs = ['Preferences', 'Sender Email Preferences', 'Email Insights', 'Templates'];

  return (
    <PageShell title="Email Notifications" desc="Configure email notifications sent to customers and vendors." icon={Mail}>
      <div className="flex gap-6 items-start">
        {/* Sidebar */}
        <div className="w-56 shrink-0 self-start sticky top-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {topTabs.map(tab => (
              <button
                key={tab}
                onClick={() => setSidebarTab(tab)}
                className={`w-full text-left px-4 py-2.5 text-sm font-medium border-b border-slate-100 last:border-0 transition ${
                  sidebarTab === tab ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {tab}
              </button>
            ))}
            {sidebarTab === 'Templates' && (
              <div className="border-t border-slate-200">
                {EMAIL_GROUPS.map(group => (
                  <div key={group.label}>
                    <div className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50">{group.label}</div>
                    {group.items.map(item => (
                      <button
                        key={item}
                        onClick={() => setSelectedNotif(item)}
                        className={`w-full text-left px-4 py-2 text-xs font-medium border-b border-slate-50 last:border-0 transition ${
                          selectedNotif === item ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {sidebarTab === 'Preferences' && (
            <Section title="Email Preferences">
              <p className="text-sm text-slate-400">Configure your email preferences here.</p>
            </Section>
          )}
          {sidebarTab === 'Sender Email Preferences' && (
            <Section title="Sender Email Preferences">
              <p className="text-sm text-slate-400">Configure sender email address and display name.</p>
            </Section>
          )}
          {sidebarTab === 'Email Insights' && (
            <Section title="Email Insights">
              <p className="text-sm text-slate-400">View email delivery statistics and insights.</p>
            </Section>
          )}
          {sidebarTab === 'Templates' && (
            <>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-5">
                <p className="text-xs text-slate-500">
                  Sent when a payment is refunded.
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        <th className="px-4 py-3 w-32">Name</th>
                        <th className="px-4 py-3">Subject and Content</th>
                        <th className="px-4 py-3 w-24 text-right">More Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-slate-100">
                        <td className="px-4 py-3 text-sm font-medium text-slate-800">Default Default</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-700">{getNotif(selectedNotif).subject}</span>
                            <button
                              onClick={() => updateNotif(selectedNotif, 'showContent', !getNotif(selectedNotif).showContent)}
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition"
                            >
                              {getNotif(selectedNotif).showContent ? 'Hide Mail Content' : 'Show Mail Content'}
                              <ChevronRight size={14} className={getNotif(selectedNotif).showContent ? 'rotate-90' : ''} />
                            </button>
                          </div>
                          {getNotif(selectedNotif).showContent && (
                            <div className="mt-3 border border-slate-200 rounded-lg p-4 bg-slate-50">
                              <p className="text-xs text-slate-400 mb-2">Email Subject:</p>
                              <input
                                type="text" value={getNotif(selectedNotif).subject}
                                onChange={e => updateNotif(selectedNotif, 'subject', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg mb-3 bg-white"
                              />
                              <p className="text-xs text-slate-400 mb-2">Email Body:</p>
                              <textarea
                                value={getNotif(selectedNotif).content}
                                onChange={e => updateNotif(selectedNotif, 'content', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white min-h-[120px] resize-y"
                                placeholder="Email content..."
                              />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button className="text-slate-400 hover:text-slate-600"><Pencil size={14} /></button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Reporting Tags ────────────────────────────────────────────────────────
export function ReportingTagsPage() {
  const { form, handleSave, isPending, saved, error, setForm } = useSettingsForm('reportingTags', {
    tags: [] as { name: string; desc: string; modules: string[]; level: 'transaction' | 'line'; extraModules: string[]; mandatory: boolean }[],
  });

  const [tagName, setTagName] = useState('');
  const [tagDesc, setTagDesc] = useState('');
  const [assocModules, setAssocModules] = useState<string[]>([]);
  const [tagLevel, setTagLevel] = useState<'transaction' | 'line'>('transaction');
  const [extraModules, setExtraModules] = useState<string[]>([]);
  const [mandatory, setMandatory] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const tags = form.tags || [];

  function toggleModule(mod: string, list: string[], setter: any) {
    setter(list.includes(mod) ? list.filter(m => m !== mod) : [...list, mod]);
  }

  function saveTag() {
    if (!tagName.trim()) return;
    const newTag = { name: tagName.trim(), desc: tagDesc, modules: assocModules, level: tagLevel, extraModules, mandatory };
    if (editingIdx !== null) {
      setForm((p: any) => ({
        ...p,
        tags: (p.tags || []).map((t: any, i: number) => i === editingIdx ? newTag : t),
      }));
    } else {
      setForm((p: any) => ({ ...p, tags: [...(p.tags || []), newTag] }));
    }
    resetForm();
  }

  function editTag(i: number) {
    const t = tags[i];
    setTagName(t.name);
    setTagDesc(t.desc);
    setAssocModules(t.modules || []);
    setTagLevel(t.level || 'transaction');
    setExtraModules(t.extraModules || []);
    setMandatory(t.mandatory || false);
    setEditingIdx(i);
  }

  function deleteTag(i: number) {
    setForm((p: any) => ({ ...p, tags: (p.tags || []).filter((_: any, j: number) => j !== i) }));
    if (editingIdx === i) resetForm();
  }

  function resetForm() {
    setTagName(''); setTagDesc(''); setAssocModules([]); setTagLevel('transaction'); setExtraModules([]); setMandatory(false); setEditingIdx(null);
  }

  const moduleChecks = ['Sales', 'Purchases', 'Journals', 'Inventory'];
  const extraChecks = ['Customers', 'Vendors', 'Items', 'Fixed Assets', 'Banking', 'Configurations'];

  return (
    <PageShell title="Reporting Tags" desc="Create and manage tags for categorizing transactions." icon={Tag}>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-5">
        <p className="text-xs text-blue-700">Reporting tags are labels that can be associated with your transactions, records and reports. You can use these tags to filter reports and gain insights into your business.</p>
      </div>

      {/* Existing tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {tags.map((t: any, i: number) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
              <Tag size={12} /> {t.name}
              <button onClick={() => editTag(i)} className="text-slate-400 hover:text-indigo-600 ml-0.5"><Pencil size={12} /></button>
              <button onClick={() => deleteTag(i)} className="text-slate-400 hover:text-red-500"><X size={12} /></button>
            </span>
          ))}
        </div>
      )}

      <Section title={editingIdx !== null ? 'Edit Reporting Tag' : 'Create Reporting Tag'}>
        <div className="space-y-5">
          {/* Step indicator */}
          <div className="flex items-center gap-1 text-xs font-medium">
            {[{ n: 1, label: 'Create Reporting Tag' }, { n: 2, label: 'Configure Options' }].map((s, i) => (
              <div key={s.n} className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">{s.n}</span>
                <span className="text-slate-600">{s.label}</span>
                {i === 0 && <ChevronRight size={14} className="text-slate-300 mx-1" />}
              </div>
            ))}
          </div>

          {/* Step 1: Name & Description */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Reporting Tag Name</label>
            <input type="text" value={tagName} onChange={e => setTagName(e.target.value)} placeholder="e.g. Marketing Campaign" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Description</label>
            <textarea value={tagDesc} onChange={e => setTagDesc(e.target.value)} placeholder="Describe this reporting tag..." className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white min-h-[60px] resize-y" />
          </div>

          {/* Step 2: Configure Options */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500 mb-3">Associate This Reporting Tag To</p>
            <p className="text-xs text-slate-400 mb-3">You can select the modules for which you want to associate reporting tags.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {moduleChecks.map(m => (
                <label key={m} className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 text-sm text-slate-700">
                  <input type="checkbox" checked={assocModules.includes(m)} onChange={() => toggleModule(m, assocModules, setAssocModules)} className="text-indigo-600 rounded" />
                  {m}
                </label>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500 mb-3">Tag Application Level</p>
            <div className="space-y-2">
              <label className="flex items-center gap-3 px-3 py-2.5 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                <input type="radio" name="tagLevel" checked={tagLevel === 'transaction'} onChange={() => setTagLevel('transaction')} className="text-indigo-600" />
                <div>
                  <p className="text-sm font-medium text-slate-700">At Transaction Level</p>
                  <p className="text-xs text-slate-400">The reporting tag is applied to the entire transaction.</p>
                </div>
              </label>
              <label className="flex items-center gap-3 px-3 py-2.5 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                <input type="radio" name="tagLevel" checked={tagLevel === 'line'} onChange={() => setTagLevel('line')} className="text-indigo-600" />
                <div>
                  <p className="text-sm font-medium text-slate-700">At Line Item Level</p>
                  <p className="text-xs text-slate-400">The reporting tag is applied to individual line items within a transaction.</p>
                </div>
              </label>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500 mb-3">Additional Associations</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {extraChecks.map(m => (
                <label key={m} className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 text-sm text-slate-700">
                  <input type="checkbox" checked={extraModules.includes(m)} onChange={() => toggleModule(m, extraModules, setExtraModules)} className="text-indigo-600 rounded" />
                  {m}
                </label>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-start justify-between py-2 flex-wrap gap-2">
              <div>
                <p className="text-sm font-medium text-slate-700">Make this reporting tag as mandatory</p>
                <p className="text-xs text-slate-400">Requires you to provide input for the reporting tag field. However, it will be skipped for auto-created transactions and in certain apps where this field is not present.</p>
              </div>
              <button
                type="button"
                onClick={() => setMandatory(!mandatory)}
                className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${mandatory ? 'bg-indigo-600' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${mandatory ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
            <button onClick={saveTag} disabled={!tagName.trim()} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition">
              {editingIdx !== null ? 'Update Tag' : 'Create Tag'}
            </button>
            {editingIdx !== null && (
              <button onClick={resetForm} className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition">Cancel</button>
            )}
          </div>
        </div>
      </Section>

      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Web Tabs ──────────────────────────────────────────────────────────────
export function WebTabsPage() {
  const { form, handleSave, isPending, saved, error, setForm } = useSettingsForm('webTabs', { tabs: [] as { name: string; url: string; visibility: 'me' | 'selected' | 'everyone'; selectedRoles: string[]; createdAt: string }[] });
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [visibility, setVisibility] = useState<'me' | 'selected' | 'everyone'>('everyone');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const tabs = form.tabs || [];

  function saveTab() {
    if (!name.trim() || !url.trim()) return;
    const entry = { name: name.trim(), url: url.trim(), visibility, selectedRoles: [], createdAt: new Date().toISOString() };
    if (editingIdx !== null) {
      setForm((p: any) => ({ ...p, tabs: (p.tabs || []).map((t: any, i: number) => i === editingIdx ? entry : t) }));
    } else {
      setForm((p: any) => ({ ...p, tabs: [...(p.tabs || []), entry] }));
    }
    resetForm();
  }

  function editTab(i: number) {
    const t = tabs[i];
    setName(t.name); setUrl(t.url); setVisibility(t.visibility || 'everyone'); setEditingIdx(i); setShowForm(true);
  }

  function deleteTab(i: number) {
    setForm((p: any) => ({ ...p, tabs: (p.tabs || []).filter((_: any, j: number) => j !== i) }));
    if (editingIdx === i) resetForm();
  }

  function resetForm() {
    setName(''); setUrl(''); setVisibility('everyone'); setEditingIdx(null); setShowForm(false);
  }

  return (
    <PageShell title="Web Tabs" desc="Manage custom web tabs in your sidebar navigation." icon={Layers}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-slate-500">Add custom links to external tools in your SkyBooks sidebar. <a href="#" className="text-indigo-600 hover:underline">Learn more about Web Tabs</a></p>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition">
          <Plus size={14} /> New Web Tab
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Info</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">URL</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Last Updated</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">More Actions</th>
              </tr>
            </thead>
            <tbody>
              {tabs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Globe size={32} className="text-slate-200" />
                      <p className="text-sm text-slate-400">You haven't created any web tabs yet.</p>
                    </div>
                  </td>
                </tr>
              ) : tabs.map((tab: any, i: number) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-3"><Globe size={14} className="text-slate-300" /></td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-700">{tab.name}</td>
                  <td className="px-4 py-3 text-xs text-indigo-600"><a href={tab.url} target="_blank" rel="noreferrer">{tab.url}</a></td>
                  <td className="px-4 py-3 text-xs text-slate-400">{tab.createdAt ? new Date(tab.createdAt).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full uppercase">Active</span></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => editTab(i)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100"><Pencil size={14} /></button>
                      <button onClick={() => deleteTab(i)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New/Edit Form */}
      {showForm && (
        <Section title={editingIdx !== null ? 'Edit Web Tab' : 'New Web Tab'}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Tab Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. CRM Dashboard" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">URL</label>
              <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white" />
              <p className="text-xs text-amber-600 mt-1">This URL belongs to a Sky app or website.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">Visibility</label>
              <div className="space-y-2">
                {[
                  { value: 'me', label: 'Only Me' },
                  { value: 'selected', label: 'Only Selected Users & Roles' },
                  { value: 'everyone', label: 'Everyone' },
                ].map(v => (
                  <label key={v.value} className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 text-sm text-slate-700">
                    <input type="radio" name="visibility" checked={visibility === v.value} onChange={() => setVisibility(v.value as any)} className="text-indigo-600" />
                    {v.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
              <button onClick={saveTab} disabled={!name.trim() || !url.trim()} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition">
                {editingIdx !== null ? 'Update Tab' : 'Create Tab'}
              </button>
              <button onClick={resetForm} className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition">Cancel</button>
            </div>
          </div>
        </Section>
      )}

      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Workflow Rules ────────────────────────────────────────────────────────
export function WorkflowRulesPage() {
  const { form, handleSave, isPending, saved, error, setForm } = useSettingsForm('workflowRules', { rules: [] as { name: string; module: string; desc: string; status: string }[] });
  const [moduleFilter, setModuleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const rules = form.rules || [];

  function deleteRule(i: number) {
    setForm((p: any) => ({ ...p, rules: (p.rules || []).filter((_: any, j: number) => j !== i) }));
  }

  const filtered = rules.filter((r: any) => {
    if (moduleFilter && r.module !== moduleFilter) return false;
    if (statusFilter && r.status !== statusFilter) return false;
    return true;
  });

  const modules = [...new Set(rules.map((r: any) => r.module).filter(Boolean))];

  return (
    <PageShell title="Workflow Rules" desc="Create automated rules to trigger actions based on events." icon={Zap}>
      {/* Intro banner */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-5 mb-5">
        <p className="text-xs text-indigo-700 mb-2">Looking to streamline your business operations?</p>
        <p className="text-xs text-slate-500">Try out the examples in the Custom Function Series forum posts and discover how functions can be tailored to meet your unique business needs. <a href="#" className="text-indigo-600 hover:underline font-medium">View Examples</a></p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        {[
          { icon: Code, label: 'Functions', value: 0, total: 10000, color: 'blue' },
          { icon: Globe, label: 'Webhooks', value: 0, total: 10000, color: 'emerald' },
          { icon: Mail, label: 'Email Alerts', value: 0, total: 500, color: 'amber' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg bg-${s.color}-50 flex items-center justify-center`}>
              <s.icon size={18} className={`text-${s.color}-600`} />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Usage Stats (per day)</p>
              <p className="text-lg font-bold text-slate-800">{s.value} / {s.total.toLocaleString()}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Workflow Rules section */}
      <Section title="Workflow Rules">
        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter size={12} className="text-slate-400" />
            <span className="text-[10px] font-semibold text-slate-400 uppercase">Module :</span>
            <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)} className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white">
              <option value="">All</option>
              {modules.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Filter size={12} className="text-slate-400" />
            <span className="text-[10px] font-semibold text-slate-400 uppercase">Status :</span>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white">
              <option value="">All</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 pr-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                <th className="text-left py-3 pr-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Module</th>
                <th className="text-left py-3 pr-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                <th className="text-left py-3 pr-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-right py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">More Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <p className="text-sm text-slate-400">There are no workflows</p>
                  </td>
                </tr>
              ) : filtered.map((r: any, i: number) => (
                <tr key={i} className="hover:bg-slate-50/50">
                  <td className="py-3 pr-4 text-sm font-medium text-slate-700">{r.name}</td>
                  <td className="py-3 pr-4 text-xs text-slate-500">{r.module || '-'}</td>
                  <td className="py-3 pr-4 text-xs text-slate-500">{r.desc || '-'}</td>
                  <td className="py-3 pr-4"><span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${r.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{r.status || 'Inactive'}</span></td>
                  <td className="py-3 text-right">
                    <button onClick={() => deleteRule(i)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Workflow Actions ──────────────────────────────────────────────────────
export function WorkflowActionsPage() {
  const { form, handleSave, isPending, saved, error, setForm } = useSettingsForm('workflowActions', { emailAlerts: [] as { module: string; template: string; rules: string; actions: string }[] });
  const [actionTab, setActionTab] = useState('Email Alerts');
  const [moduleFilter, setModuleFilter] = useState('');
  const emailAlerts = form.emailAlerts || [];
  const tabs = ['Email Alerts', 'In-app Notifications', 'Field Updates', 'Webhooks', 'Functions'];

  const filtered = emailAlerts.filter((a: any) => !moduleFilter || a.module === moduleFilter);
  const modules = [...new Set(emailAlerts.map((a: any) => a.module).filter(Boolean))];

  return (
    <PageShell title="Workflow Actions" desc="Define actions that can be triggered by workflow rules." icon={ListChecks}>
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-5 bg-slate-100 rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button key={t} onClick={() => setActionTab(t)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition ${actionTab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >{t}</button>
        ))}
      </div>

      {actionTab === 'Email Alerts' && (
        <Section title="Email Alerts">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={12} className="text-slate-400" />
            <span className="text-[10px] font-semibold text-slate-400 uppercase">Module :</span>
            <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)} className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white">
              <option value="">All</option>
              {modules.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 pr-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Module</th>
                  <th className="text-left py-3 pr-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Email Template</th>
                  <th className="text-left py-3 pr-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Related rules</th>
                  <th className="text-right py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={4} className="py-12 text-center"><p className="text-sm text-slate-400">There are no email alerts</p></td></tr>
                ) : filtered.map((a: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="py-3 pr-4 text-sm font-medium text-slate-700">{a.module}</td>
                    <td className="py-3 pr-4 text-xs text-slate-500">{a.template || '-'}</td>
                    <td className="py-3 pr-4 text-xs text-slate-500">{a.rules || '-'}</td>
                    <td className="py-3 text-right"><button className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100"><Pencil size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      {actionTab !== 'Email Alerts' && (
        <Section title={actionTab}>
          <p className="text-sm text-slate-400 py-8 text-center">No {actionTab.toLowerCase()} configured yet.</p>
        </Section>
      )}

      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Workflow Logs ─────────────────────────────────────────────────────────
export function WorkflowLogsPage() {
  const { form, handleSave, isPending, saved, error, setForm } = useSettingsForm('workflowLogs', {
    emailLogs: [] as { occurredAt: string; name: string; logId: string; entity: string; status: string }[],
    schedules: [] as { name: string; lastExecuted: string; nextDate: string; frequency: string; status: string }[],
  });
  const [logTab, setLogTab] = useState('Email Alerts');
  const [statusFilter, setStatusFilter] = useState('');
  const [modulesFilter, setModulesFilter] = useState('');
  const [dateRange, setDateRange] = useState('');

  const emailLogs = form.emailLogs || [];
  const schedules = form.schedules || [];
  const logTabs = ['Email Alerts', 'Webhooks', 'Functions', 'Schedules', 'Buttons'];

  const filteredLogs = emailLogs.filter((l: any) => {
    if (statusFilter && l.status !== statusFilter) return false;
    if (modulesFilter && l.entity !== modulesFilter) return false;
    return true;
  });

  const logEntities = [...new Set(emailLogs.map((l: any) => l.entity).filter(Boolean))];

  return (
    <PageShell title="Workflow Logs" desc="View the execution history of your workflow rules." icon={History}>
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-5 bg-slate-100 rounded-lg p-1 w-fit">
        {logTabs.map(t => (
          <button key={t} onClick={() => setLogTab(t)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition ${logTab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >{t}</button>
        ))}
      </div>

      {logTab === 'Schedules' ? (
        <Section title="Schedules">
          <p className="text-xs text-slate-500 mb-3">Create tasks and execute them in different time intervals with Schedules. <a href="#" className="text-indigo-600 hover:underline">Learn More</a></p>
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Name', 'Last Executed On', 'Next date', 'Frequency', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left py-3 pr-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider last:text-right last:pr-0">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {schedules.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center"><p className="text-sm text-slate-400">No schedules configured.</p></td></tr>
                ) : schedules.map((s: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="py-3 pr-4 text-sm font-medium text-slate-700">{s.name}</td>
                    <td className="py-3 pr-4 text-xs text-slate-500">{s.lastExecuted || '-'}</td>
                    <td className="py-3 pr-4 text-xs text-slate-500">{s.nextDate || '-'}</td>
                    <td className="py-3 pr-4 text-xs text-slate-500">{s.frequency || '-'}</td>
                    <td className="py-3 pr-4"><span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${s.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{s.status || 'Inactive'}</span></td>
                    <td className="py-3 text-right"><button className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100"><Pencil size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : (
        <Section title={logTab}>
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap mb-4">
            <div className="flex items-center gap-2">
              <Filter size={12} className="text-slate-400" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase">Status :</span>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white">
                <option value="">All</option>
                <option value="Success">Success</option>
                <option value="Failed">Failed</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Filter size={12} className="text-slate-400" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase">Modules :</span>
              <select value={modulesFilter} onChange={e => setModulesFilter(e.target.value)} className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white">
                <option value="">All</option>
                {logEntities.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Filter size={12} className="text-slate-400" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase">Date Range :</span>
              <input type="date" value={dateRange} onChange={e => setDateRange(e.target.value)} className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white" />
            </div>
          </div>
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Occurred at', 'Name', 'Log ID', 'Entity type', 'Status'].map(h => (
                    <th key={h} className="text-left py-3 pr-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredLogs.length === 0 ? (
                  <tr><td colSpan={5} className="py-12 text-center"><p className="text-sm text-slate-400">There are no logs</p></td></tr>
                ) : filteredLogs.map((l: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="py-3 pr-4 text-xs text-slate-500">{l.occurredAt || '-'}</td>
                    <td className="py-3 pr-4 text-sm font-medium text-slate-700">{l.name}</td>
                    <td className="py-3 pr-4 text-xs font-mono text-slate-500">{l.logId || '-'}</td>
                    <td className="py-3 pr-4 text-xs text-slate-500">{l.entity || '-'}</td>
                    <td className="py-3"><span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${l.status === 'Success' ? 'bg-emerald-50 text-emerald-700' : l.status === 'Failed' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>{l.status || 'Pending'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

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
  const { form, toggle, handleSave, isPending, saved, error, setForm, field } = useSettingsForm('contacts', {
    allowDuplicates: false, enableCustomerNumbers: true, enableVendorNumbers: true,
    defaultCustomerType: 'business', creditLimit: 'disabled',
    creditExceedAction: 'restrict', creditIncludeSalesOrders: false,
    billingFormat: ['${CONTACT.CONTACT_DISPLAYNAME}', '${CONTACT.CONTACT_ADDRESS}', '${CONTACT.CONTACT_CITY}', '${CONTACT.CONTACT_CODE} ${CONTACT.CONTACT_STATE}', '${CONTACT.CONTACT_COUNTRY}'].join('\n'),
    shippingFormat: ['${CONTACT.CONTACT_ADDRESS}', '${CONTACT.CONTACT_CITY}', '${CONTACT.CONTACT_CODE} ${CONTACT.CONTACT_STATE}', '${CONTACT.CONTACT_COUNTRY}'].join('\n'),
  });
  const [cTab, setCTab] = useState('Preferences');
  const cTabs = ['Preferences', 'Fields', 'Buttons', 'Related Lists'];

  return (
    <PageShell title="Customers & Vendors" desc="Configure settings for customer and vendor management." icon={Users}>
      <div className="flex items-center gap-1 mb-5 bg-slate-100 rounded-lg p-1 w-fit">
        {cTabs.map(t => (
          <button key={t} onClick={() => setCTab(t)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition ${cTab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >{t}</button>
        ))}
      </div>

      {cTab === 'Preferences' && (
        <div className="space-y-5">
          <Section title="Customers and Vendors">
            <ToggleRow label="Allow duplicates for customer and vendor display name." checked={form.allowDuplicates} onClick={toggle('allowDuplicates')} />
          </Section>

          <Section title="Customer & Vendor Numbers">
            <p className="text-xs text-slate-500 mb-3">Generate customer and vendor numbers automatically. You can configure the series in which numbers are generated while creating new records.</p>
            <ToggleRow label="Enable Customer Numbers" checked={form.enableCustomerNumbers} onClick={toggle('enableCustomerNumbers')} />
            <ToggleRow label="Enable Vendor Numbers" checked={form.enableVendorNumbers} onClick={toggle('enableVendorNumbers')} />
          </Section>

          <Section title="Default Customer Type">
            <p className="text-xs text-slate-500 mb-3">Select the default customer type based on the kind of customers you usually sell your products or services to. The default customer type will be pre-selected in the customer creation form.</p>
            <div className="flex items-center gap-4">
              {['Business', 'Individual'].map(t => (
                <label key={t} className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 text-sm text-slate-700">
                  <input type="radio" name="defaultCustomerType" checked={form.defaultCustomerType === t.toLowerCase()} onChange={() => setForm((p: any) => ({ ...p, defaultCustomerType: t.toLowerCase() }))} className="text-indigo-600" />
                  {t}
                </label>
              ))}
            </div>
          </Section>

          <Section title="Customer Credit Limit">
            <p className="text-xs text-slate-500 mb-3">Credit Limit enables you to set limit on the outstanding receivable amount of the customers.</p>
            <ToggleRow label="Enabled" checked={form.creditLimit === 'enabled'} onClick={() => setForm((p: any) => ({ ...p, creditLimit: p.creditLimit === 'enabled' ? 'disabled' : 'enabled' }))} />
            {form.creditLimit === 'enabled' && (
              <div className="mt-4 space-y-4 pl-2">
                <div>
                  <p className="text-xs font-medium text-slate-700 mb-2">What do you want to do when credit limit is exceeded?</p>
                  <label className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 text-sm text-slate-700 mb-2">
                    <input type="radio" name="creditExceedAction" checked={form.creditExceedAction === 'restrict'} onChange={() => setForm((p: any) => ({ ...p, creditExceedAction: 'restrict' }))} className="text-indigo-600" />
                    Restrict creating or updating invoices
                  </label>
                  <label className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 text-sm text-slate-700">
                    <input type="radio" name="creditExceedAction" checked={form.creditExceedAction === 'warn'} onChange={() => setForm((p: any) => ({ ...p, creditExceedAction: 'warn' }))} className="text-indigo-600" />
                    Show a warning and allow users to proceed
                  </label>
                </div>
                <ToggleRow label="Include sales orders' amount in limiting the credit given to customers" checked={form.creditIncludeSalesOrders} onClick={toggle('creditIncludeSalesOrders')} />
                <p className="text-xs text-slate-400 italic">Go to the respective customer's contact details to set the credit limit.</p>
                <p className="text-xs text-slate-400 italic">Credit Limit will not affect recurring invoices.</p>
              </div>
            )}
          </Section>

          <Section title="Customer and Vendor Billing Address Format (Displayed in PDF only)">
            <p className="text-xs text-slate-500 mb-2">Insert Placeholders</p>
            <textarea value={form.billingFormat || ''} onChange={e => setForm((p: any) => ({ ...p, billingFormat: e.target.value }))}
              className="w-full px-3 py-2.5 text-xs font-mono text-slate-600 border border-slate-200 rounded-lg bg-slate-50 min-h-[100px] resize-y" />
          </Section>

          <Section title="Customer and Vendor Shipping Address Format (Displayed in PDF only)">
            <p className="text-xs text-slate-500 mb-2">Insert Placeholders</p>
            <textarea value={form.shippingFormat || ''} onChange={e => setForm((p: any) => ({ ...p, shippingFormat: e.target.value }))}
              className="w-full px-3 py-2.5 text-xs font-mono text-slate-600 border border-slate-200 rounded-lg bg-slate-50 min-h-[80px] resize-y" />
          </Section>
        </div>
      )}
      {cTab !== 'Preferences' && (
        <Section title={cTab}><p className="text-sm text-slate-400 py-8 text-center">No {cTab.toLowerCase()} configured yet.</p></Section>
      )}

      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Items ─────────────────────────────────────────────────────────────────
export function ItemsSettingsPage() {
  const { form, field, toggle, handleSave, isPending, saved, error, setForm } = useSettingsForm('items', {
    decimalRate: true, valuationMethod: 'fifo', allowDuplicateNames: false,
    enhancedSearch: false, priceLists: false, trackInventory: true, inventoryStartDate: '01 Mar 2025',
    preventNegativeStock: false, showOutOfStockWarning: false, notifyReorder: false, notifyTo: '',
    trackLandedCost: false,
  });
  const [iTab, setITab] = useState('Preferences');
  const iTabs = ['Preferences', 'Fields', 'Validation Rules', 'Record Locking', 'Buttons', 'Related Lists'];

  return (
    <PageShell title="Items" desc="Configure settings for your product and service items." icon={Package}>
      <div className="flex items-center gap-1 mb-5 bg-slate-100 rounded-lg p-1 w-fit overflow-x-auto">
        {iTabs.map(t => (
          <button key={t} onClick={() => setITab(t)}
            className={`whitespace-nowrap px-4 py-1.5 text-xs font-medium rounded-md transition ${iTab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >{t}</button>
        ))}
      </div>

      {iTab === 'Preferences' && (
        <div className="space-y-5">
          <Section title="Preferences">
            <ToggleRow label="Set a decimal rate for your item quantity" checked={form.decimalRate} onClick={toggle('decimalRate')} />
          </Section>

          <Section title="Default Inventory Valuation Method">
            <p className="text-xs text-slate-500 mb-3">This valuation method will be used by default when creating items, variants and composite items.</p>
            <Select label="Inventory Valuation Method" options={[
              { value: 'fifo', label: 'FIFO (First In, First Out)' },
              { value: 'lifo', label: 'LIFO (Last In, First Out)' },
              { value: 'average', label: 'Average Cost' },
            ]} value={form.valuationMethod || 'fifo'} onChange={field('valuationMethod')} />
          </Section>

          <Section title="Duplicate Item Name">
            <ToggleRow label="Allow duplicate item names" desc="If you allow duplicate item names, all imports involving items will use SKU as the primary field for mapping." checked={form.allowDuplicateNames} onClick={toggle('allowDuplicateNames')} />
            {form.allowDuplicateNames && <p className="text-xs text-amber-600 ml-10">Before you enable this option, make the SKU field active and mandatory.</p>}
          </Section>

          <Section title="Enhanced Item Search">
            <ToggleRow label="Enable Enhanced Item Search" desc="Enabling this option makes it easier to find any item using relevant keywords in any order." checked={form.enhancedSearch} onClick={toggle('enhancedSearch')} />
          </Section>

          <Section title="Price Lists">
            <ToggleRow label="Enable Price Lists" desc="Price Lists enables you to customise the rates of the items in your sales and purchase transactions." checked={form.priceLists} onClick={toggle('priceLists')} />
          </Section>

          <Section title="Inventory">
            <ToggleRow label="Enable Inventory Tracking" checked={form.trackInventory} onClick={toggle('trackInventory')} />
            {form.trackInventory && (
              <div className="ml-10 space-y-3 mt-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-600 font-medium">Inventory Start Date :</span>
                  <span className="text-xs text-slate-700">{form.inventoryStartDate || '01 Mar 2025'}</span>
                  <button className="text-xs text-indigo-600 hover:underline">Change</button>
                </div>
                <ToggleRow label="Prevent stock from going below zero" checked={form.preventNegativeStock} onClick={toggle('preventNegativeStock')} />
                <ToggleRow label="Show an Out of Stock warning when an item's stock drops below zero" checked={form.showOutOfStockWarning} onClick={toggle('showOutOfStockWarning')} />
                <div className="flex flex-wrap items-center gap-3">
                  <ToggleRow label="Notify me if an item's quantity reaches the reorder point" checked={form.notifyReorder} onClick={toggle('notifyReorder')} />
                  {form.notifyReorder && <Field label="Notify to" placeholder="email@example.com" value={form.notifyTo || ''} onChange={field('notifyTo')} />}
                </div>
                <ToggleRow label="Track landed cost on items" checked={form.trackLandedCost} onClick={toggle('trackLandedCost')} />
              </div>
            )}
          </Section>

          <Section title="Advanced Inventory">
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center gap-3">
              <p className="text-xs text-indigo-700">Looking for Advanced Inventory Management features, integrate with Sky Inventory <a href="#" className="font-semibold underline">Learn More</a></p>
            </div>
            <p className="text-xs text-slate-400 mt-1">Do more than just basic item creation with SkyBooks. Use advanced serial, bin, batch tracking features and more to track your items and simplify your inventory management.</p>
          </Section>
        </div>
      )}
      {iTab !== 'Preferences' && (
        <Section title={iTab}><p className="text-sm text-slate-400 py-8 text-center">No {iTab.toLowerCase()} configured yet.</p></Section>
      )}

      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Revenue Recognition ───────────────────────────────────────────────────
export function RevenueRecognitionPage() {
  const { form, handleSave, isPending, saved, error } = useSettingsForm('revenueRecognition', { method: 'accrual', deferRevenue: false, autoDeferredSchedule: false });
  return (
    <PageShell title="Revenue Recognition" desc="Configure how revenue is recognized in your books." icon={BarChart2}>
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 mb-5">
        <p className="text-xs text-indigo-700">Revenue recognition lets you track your revenue on an accrual basis, i.e., the revenue a transaction earns over the course of its service period, even if it was paid for upfront. Once enabled, you'll find new Revenue Recognition reports which let you track metrics like recognized and deferred revenues. This feature helps you stay compliant with accounting standards like IFRS 15.</p>
      </div>

      <Section title="Revenue Recognition">
        <div className="space-y-3">
          {[
            { label: 'Create Recognition Rules', desc: 'Define rules that automatically recognize revenue based on service periods.' },
            { label: 'Associate Rules with Transactions', desc: 'Link recognition rules to your invoices and sales transactions.' },
            { label: 'Track Recognized and Deferred Revenues', desc: 'Monitor revenue metrics through dedicated reports.' },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 border border-slate-200 rounded-lg">
              <Check size={14} className="text-emerald-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-700">{s.label}</p>
                <p className="text-xs text-slate-400">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-5 mb-5">
        <p className="text-xs font-semibold text-indigo-800 mb-1">Exclusive for accounting and bookkeeping firms!</p>
        <p className="text-xs text-slate-500">Introducing Sky Practice, the complete practice management software to centralize client management, simplify tasks, get access to financial insights and receive compliance alerts, ensuring service excellence.</p>
        <button className="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition">Get started now</button>
      </div>

      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Accountant ────────────────────────────────────────────────────────────
const defaultAccountTypes = [
  { key: 'receivable', label: 'Accounts Receivable' },
  { key: 'vendorAdvances', label: 'Vendor Advances' },
  { key: 'payable', label: 'Accounts Payable' },
  { key: 'customerAdvances', label: 'Customer Advances' },
  { key: 'lateFeeIncome', label: 'Late Fee Income' },
  { key: 'discount', label: 'Discount' },
  { key: 'adjustment', label: 'Adjustment' },
  { key: 'shippingCharge', label: 'Shipping Charge' },
  { key: 'badDebt', label: 'Bad Debt' },
  { key: 'purchaseAdjustment', label: 'Purchase Adjustment' },
];

const dataTypeOptions = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'checkbox', label: 'Checkbox' },
];

export function AccountantSettingsPage() {
  const { form, field, toggle, handleSave, isPending, saved, error, setForm, settings } = useSettingsForm('accountant', {
    makeAccountCodeMandatory: false, currencyGainLoss: 'sameAccount', exchangeAdjustmentAccount: '',
    allow13thMonth: false, recurringJournalState: 'draft',
    journalApprovalType: 'noApproval',
    defaultAccounts: {} as Record<string, string>,
    journalFields: [] as any[],
    coaFields: [] as any[],
    fixedAssetFields: [] as any[],
  });
  const [aTab, setATab] = useState('Preferences');
  const aTabs = ['Preferences', 'Default Account Tracking', 'Journal Approvals', 'Journal Validation Rules', 'Journal Fields', 'Chart of Accounts Fields', 'Fixed Asset Fields'];

  const { data: accounts } = useQuery<any[]>({
    queryKey: ['accounts'],
    queryFn: accountantApi.getAccounts,
  });
  const accountOptions = (accounts || []).map((a: any) => ({
    value: a.id,
    label: `${a.code} — ${a.name}`,
  }));

  // Default Account Tracking helpers
  const defaultAccounts = (form.defaultAccounts || {}) as Record<string, string>;
  const setDefaultAccount = (key: string, val: string) => setForm((p: any) => ({ ...p, defaultAccounts: { ...(p.defaultAccounts || {}), [key]: val } }));

  // Journal / COA / Fixed Asset Fields state
  const [fieldSearch, setFieldSearch] = useState('');
  const [fieldTarget, setFieldTarget] = useState<'journal' | 'coa' | 'fixedAsset'>('journal');
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [editFieldIdx, setEditFieldIdx] = useState<number | null>(null);
  const [fieldForm, setFieldForm] = useState({ labelName: '', dataType: 'text', mandatory: false, showInPdf: false, status: 'active' });

  const fieldsMap: Record<string, any[]> = {
    journal: form.journalFields || [],
    coa: form.coaFields || [],
    fixedAsset: form.fixedAssetFields || [],
  };
  const currentFields = fieldsMap[fieldTarget] || [];

  const filteredFields = currentFields.filter((f: any) =>
    !fieldSearch || f.labelName?.toLowerCase().includes(fieldSearch.toLowerCase())
  );

  const openFieldModal = (target: string, idx: number | null = null) => {
    setFieldTarget(target as any);
    if (idx !== null) {
      const f = currentFields[idx];
      setFieldForm({ labelName: f.labelName, dataType: f.dataType, mandatory: f.mandatory, showInPdf: f.showInPdf, status: f.status });
      setEditFieldIdx(idx);
    } else {
      setFieldForm({ labelName: '', dataType: 'text', mandatory: false, showInPdf: false, status: 'active' });
      setEditFieldIdx(null);
    }
    setShowFieldModal(true);
  };

  const saveField = () => {
    const key = fieldTarget === 'journal' ? 'journalFields' : fieldTarget === 'coa' ? 'coaFields' : 'fixedAssetFields';
    const list = [...(form[key] || [])];
    if (editFieldIdx !== null) {
      list[editFieldIdx] = fieldForm;
    } else {
      list.push({ ...fieldForm, id: Date.now().toString() });
    }
    setForm((p: any) => ({ ...p, [key]: list }));
    setShowFieldModal(false);
    setEditFieldIdx(null);
  };

  const deleteField = (target: string, idx: number) => {
    const key = target === 'journal' ? 'journalFields' : target === 'coa' ? 'coaFields' : 'fixedAssetFields';
    const list = [...(form[key] || [])];
    list.splice(idx, 1);
    setForm((p: any) => ({ ...p, [key]: list }));
  };

  return (
    <PageShell title="Accountant" desc="Configure settings for your accounting module." icon={FileText}>
      <div className="flex items-center gap-1 mb-5 bg-slate-100 rounded-lg p-1 w-fit overflow-x-auto">
        {aTabs.map(t => (
          <button key={t} onClick={() => setATab(t)}
            className={`whitespace-nowrap px-4 py-1.5 text-xs font-medium rounded-md transition ${aTab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >{t}</button>
        ))}
      </div>

      {aTab === 'Preferences' && (
        <div className="space-y-5">
          <Section title="Chart of Accounts">
            <ToggleRow label="Make Account Code mandatory for new accounts." desc="Enter a unique Account Code for accounts created." checked={form.makeAccountCodeMandatory} onClick={toggle('makeAccountCodeMandatory')} />
          </Section>

          <Section title="Default Account for Currency Exchange Gain/Loss">
            <p className="text-xs text-slate-500 mb-3">Exchange rates affect the value of your base currency during conversions. Set a default account to track these gains or losses and keep your financial records accurate.</p>
            {[
              { value: 'sameAccount', label: 'Track gains and losses in the same expense account', desc: 'You can track both gains and losses in the same expense account for a consolidated view.' },
              { value: 'separateAccounts', label: 'Track gains and losses in separate accounts', desc: 'You can track gains in an income account and losses in an expense account for better categorization.' },
            ].map(o => (
              <label key={o.value} className="flex items-start gap-3 px-3 py-2.5 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 mb-2">
                <input type="radio" name="currencyGainLoss" checked={form.currencyGainLoss === o.value} onChange={() => setForm((p: any) => ({ ...p, currencyGainLoss: o.value }))} className="text-indigo-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-700">{o.label}</p>
                  <p className="text-xs text-slate-400">{o.desc}</p>
                </div>
              </label>
            ))}
          </Section>

          <Section title="Default Account for Exchange Adjustments in Transactions">
            <p className="text-xs text-slate-500 mb-3">When transactions are created in foreign currencies, there may be decimal value variations between the debit and credit amounts while the journal entries are being posted. These variations are recorded as adjustments. Select the default account using which these adjustments must be recorded.</p>
            <Select label="" options={[
              { value: '', label: 'Select an account...' },
              ...accountOptions,
            ]} value={form.exchangeAdjustmentAccount || ''} onChange={field('exchangeAdjustmentAccount')} />
          </Section>

          <Section title="Journals">
            <ToggleRow label="Allow 13th Month Adjustments in manual journals" desc="Enable this option to create a 13th month adjustment journal entry for the selected fiscal year. Once enabled, you can make end-of-period corrections or balance adjustments to your accounts for accurate financial reporting." checked={form.allow13thMonth} onClick={toggle('allow13thMonth')} />
          </Section>

          <Section title="Recurring Journals">
            <p className="text-xs text-slate-500 mb-3">Recurring Journals are created automatically based on a pre-configured schedule. These journal entries can either be created in the Draft state or in the Published state.</p>
            {[
              { value: 'draft', label: 'Create manual journals in the Draft state', desc: 'Journal entries will be saved as drafts. You can review and publish them later.' },
              { value: 'published', label: 'Create manual journals in the Published state', desc: 'Journal entries will be created directly in the Published state.' },
            ].map(o => (
              <label key={o.value} className="flex items-start gap-3 px-3 py-2.5 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 mb-2">
                <input type="radio" name="recurringJournalState" checked={form.recurringJournalState === o.value} onChange={() => setForm((p: any) => ({ ...p, recurringJournalState: o.value }))} className="text-indigo-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-700">{o.label}</p>
                  <p className="text-xs text-slate-400">{o.desc}</p>
                </div>
              </label>
            ))}
          </Section>
        </div>
      )}

      {aTab === 'Default Account Tracking' && (
        <div className="space-y-5">
          <Section title="Select Default Accounts for Each Account Type">
            <p className="text-xs text-slate-500 mb-4">The default accounts you select here will automatically be applied when you create new transactions.</p>
            <div className="space-y-4">
              {defaultAccountTypes.map(at => (
                <div key={at.key} className="grid grid-cols-2 gap-4 items-center">
                  <p className="text-sm font-medium text-slate-700">{at.label}</p>
                  <Select label="" options={[{ value: '', label: 'Select an account...' }, ...accountOptions]}
                    value={defaultAccounts[at.key] || ''} onChange={(v: string) => setDefaultAccount(at.key, v)} />
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {aTab === 'Journal Approvals' && (
        <div className="space-y-5">
          <Section title="Approval Type">
            {[
              { value: 'noApproval', label: 'No Approval', desc: 'Create Journal and perform further actions without approval.' },
              { value: 'simple', label: 'Simple Approval', desc: 'Any user with approve permission can approve the Journal.' },
              { value: 'multiLevel', label: 'Multi-Level Approval', desc: 'Set many levels of approval. The Journal will be approved only when all the approvers approve.' },
            ].map(o => (
              <label key={o.value} className="flex items-start gap-3 px-3 py-2.5 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 mb-2">
                <input type="radio" name="journalApprovalType" checked={form.journalApprovalType === o.value} onChange={() => setForm((p: any) => ({ ...p, journalApprovalType: o.value }))} className="text-indigo-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-700">{o.label}</p>
                  <p className="text-xs text-slate-400">{o.desc}</p>
                </div>
              </label>
            ))}
          </Section>
        </div>
      )}

      {aTab === 'Journal Validation Rules' && (
        <div className="space-y-5">
          <Section title="Create Validation Rules">
            <p className="text-xs text-slate-500 mb-4">Validation Rules helps you to validate the data entered while creating, editing, or converting transactions and to prevent users from performing specific actions.</p>
            <div className="text-center py-12 text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg">No results found</div>
          </Section>
        </div>
      )}

      {['Journal Fields', 'Chart of Accounts Fields', 'Fixed Asset Fields'].includes(aTab) && (
        <div className="space-y-5">
          <Section title={aTab}>
            <div className="flex items-center gap-3 mb-4">
              <input type="text" placeholder="Search Field Name"
                className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg"
                value={fieldSearch} onChange={e => setFieldSearch(e.target.value)} />
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="text-left py-2 font-medium">Field Name</th>
                  <th className="text-left py-2 font-medium">Data Type</th>
                  <th className="text-left py-2 font-medium">Mandatory</th>
                  <th className="text-left py-2 font-medium">Show in All PDFs</th>
                  <th className="text-left py-2 font-medium">Status</th>
                  <th className="text-right py-2 font-medium">More Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFields.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-slate-400">No fields configured yet.</td></tr>
                )}
                {filteredFields.map((f: any, idx: number) => (
                  <tr key={f.id || idx} className="border-b border-slate-100">
                    <td className="py-2 text-slate-700">{f.labelName}</td>
                    <td className="py-2 text-slate-500">{f.dataType}</td>
                    <td className="py-2">{f.mandatory ? <span className="text-green-600">Yes</span> : <span className="text-slate-400">No</span>}</td>
                    <td className="py-2">{f.showInPdf ? <span className="text-green-600">Yes</span> : <span className="text-slate-400">No</span>}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${f.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{f.status}</span>
                    </td>
                    <td className="py-2 text-right">
                      <button onClick={() => openFieldModal(aTab === 'Journal Fields' ? 'journal' : aTab === 'Chart of Accounts Fields' ? 'coa' : 'fixedAsset', idx)} className="text-indigo-600 hover:underline mr-2">Edit</button>
                      <button onClick={() => deleteField(aTab === 'Journal Fields' ? 'journal' : aTab === 'Chart of Accounts Fields' ? 'coa' : 'fixedAsset', idx)} className="text-red-500 hover:underline">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-slate-400 mt-3">
              Do you have information that doesn't go under any existing field? Go ahead and{' '}
              <button className="text-indigo-600 hover:underline" onClick={() => openFieldModal(aTab === 'Journal Fields' ? 'journal' : aTab === 'Chart of Accounts Fields' ? 'coa' : 'fixedAsset')}>create a new field</button>.
            </p>
          </Section>
        </div>
      )}

      {/* New / Edit Field Modal */}
      {showFieldModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowFieldModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-slate-800 mb-4">
              {editFieldIdx !== null ? 'Edit' : 'New'} Field - {fieldTarget === 'journal' ? 'Chart of Accounts' : fieldTarget === 'coa' ? 'Chart of Accounts' : 'Fixed Asset'}
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-slate-700 mb-1">Label Name</p>
                <input type="text" className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg" value={fieldForm.labelName}
                  onChange={e => setFieldForm(p => ({ ...p, labelName: e.target.value }))} />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-700 mb-1">Data Type</p>
                <Select label="" options={dataTypeOptions} value={fieldForm.dataType} onChange={(v: string) => setFieldForm(p => ({ ...p, dataType: v }))} />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-700 mb-1">Is Mandatory</p>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input type="radio" name="fieldMandatory" checked={fieldForm.mandatory} onChange={() => setFieldForm(p => ({ ...p, mandatory: true }))} className="text-indigo-600" /> Yes
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input type="radio" name="fieldMandatory" checked={!fieldForm.mandatory} onChange={() => setFieldForm(p => ({ ...p, mandatory: false }))} className="text-indigo-600" /> No
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={fieldForm.showInPdf} onChange={e => setFieldForm(p => ({ ...p, showInPdf: e.target.checked }))} className="text-indigo-600" />
                <span className="text-xs text-slate-700">Show in All PDFs</span>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowFieldModal(false)} className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
                <button onClick={saveField} className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Tasks ─────────────────────────────────────────────────────────────────
export function TasksSettingsPage() {
  const { form, field, toggle, handleSave, isPending, saved, error, setForm } = useSettingsForm('tasks', {
    notifyCompletion: true, setReminder: false, alertType: 'email', remindBefore: 1,
  });
  const [tTab, setTTab] = useState('Preferences');
  const tTabs = ['Preferences', 'Statuses', 'Fields'];

  return (
    <PageShell title="Tasks" desc="Configure settings for task management." icon={ListChecks}>
      <div className="flex items-center gap-1 mb-5 bg-slate-100 rounded-lg p-1 w-fit">
        {tTabs.map(t => (
          <button key={t} onClick={() => setTTab(t)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition ${tTab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >{t}</button>
        ))}
      </div>

      {tTab === 'Preferences' && (
        <div className="space-y-5">
          <Section title="Task Completion Notify">
            <ToggleRow label="Notify users once the status is changed to Completed" desc="An email and an in-app notification will be sent to the users associated with each task when a task's status is updated to Completed" checked={form.notifyCompletion} onClick={toggle('notifyCompletion')} />
          </Section>

          <Section title="Set Reminder Notify">
            <ToggleRow label="Set the default preference for reminder" desc="The reminder preference that you configure here will auto-populate when you create a task and enable reminder for it" checked={form.setReminder} onClick={toggle('setReminder')} />
            {form.setReminder && (
              <div className="ml-10 flex items-center gap-3 mt-3">
                <Select label="Alert Type" options={[
                  { value: 'email', label: 'Email' },
                  { value: 'inapp', label: 'In-App Notification' },
                  { value: 'both', label: 'Email & In-App' },
                ]} value={form.alertType || 'email'} onChange={field('alertType')} />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Remind Before</span>
                  <div className="flex items-center gap-1">
                    <input type="number" value={form.remindBefore ?? 1} onChange={e => setForm((p: any) => ({ ...p, remindBefore: parseInt(e.target.value) || 0 }))}
                      className="w-16 px-2 py-1.5 text-sm border border-slate-200 rounded-lg text-center" />
                    <span className="text-xs text-slate-500">Day(s)</span>
                  </div>
                </div>
              </div>
            )}
          </Section>
        </div>
      )}
      {tTab !== 'Preferences' && (
        <Section title={tTab}><p className="text-sm text-slate-400 py-8 text-center">No {tTab.toLowerCase()} configured yet.</p></Section>
      )}

      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Projects ──────────────────────────────────────────────────────────────
export function ProjectsSettingsPage() {
  const { form, handleSave, isPending, saved, error, setForm } = useSettingsForm('projects', {
    fields: [] as { name: string; dataType: string; mandatory: boolean; status: string }[],
  });
  const [pTab, setPTab] = useState('Fields');
  const pTabs = ['Fields', 'Buttons', 'Related Lists'];
  const [fieldName, setFieldName] = useState('');
  const [fieldDataType, setFieldDataType] = useState('text');
  const fields = form.fields || [];

  function addField() {
    if (!fieldName.trim()) return;
    setForm((p: any) => ({ ...p, fields: [...(p.fields || []), { name: fieldName.trim(), dataType: fieldDataType, mandatory: false, status: 'Active' }] }));
    setFieldName('');
  }

  function removeField(i: number) {
    setForm((p: any) => ({ ...p, fields: (p.fields || []).filter((_: any, j: number) => j !== i) }));
  }

  return (
    <PageShell title="Projects" desc="Configure settings for project management." icon={Layers}>
      <div className="flex items-center gap-1 mb-5 bg-slate-100 rounded-lg p-1 w-fit">
        {pTabs.map(t => (
          <button key={t} onClick={() => setPTab(t)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition ${pTab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >{t}</button>
        ))}
      </div>

      {pTab === 'Fields' && (
        <div className="space-y-5">
          <Section title="Search Field Name">
            <input type="text" value={fieldName} onChange={e => setFieldName(e.target.value)} placeholder="e.g. Custom Field" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white" />
            <div className="flex items-center gap-3 mt-2">
              <select value={fieldDataType} onChange={e => setFieldDataType(e.target.value)}
                className="px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white">
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="boolean">Boolean</option>
              </select>
              <button onClick={addField} disabled={!fieldName.trim()} className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"><Plus size={14} /></button>
            </div>
          </Section>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Field Name</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Data Type</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Mandatory</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">More Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {fields.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center"><p className="text-sm text-slate-400">No custom fields yet.</p></td></tr>
                  ) : fields.map((f: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-700">{f.name}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{f.dataType}</td>
                      <td className="px-4 py-3"><input type="checkbox" checked={f.mandatory} onChange={() => setForm((p: any) => ({ ...p, fields: (p.fields || []).map((x: any, j: number) => j === i ? { ...x, mandatory: !x.mandatory } : x) }))} className="text-indigo-600 rounded" /></td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${f.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{f.status}</span></td>
                      <td className="px-4 py-3 text-right"><button onClick={() => removeField(i)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {fields.length > 0 && <p className="px-4 py-3 text-xs text-slate-400 border-t border-slate-100">Do you have information that doesn't go under any existing field? Go ahead and <button onClick={() => { setFieldName(''); setFieldDataType('text'); }} className="text-indigo-600 hover:underline">create a new field</button>.</p>}
          </div>
        </div>
      )}
      {pTab !== 'Fields' && (
        <Section title={pTab}><p className="text-sm text-slate-400 py-8 text-center">No {pTab.toLowerCase()} configured yet.</p></Section>
      )}

      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Timesheet ─────────────────────────────────────────────────────────────
export function TimesheetSettingsPage() {
  const { form, field, toggle, handleSave, isPending, saved, error, setForm } = useSettingsForm('timesheet', {
    roundOff: 'none', maxHoursDay: '24:00', trackCosts: false,
    enableApprovals: false, enableCustomerApprovals: false,
  });
  const [tsTab, setTsTab] = useState('Preferences');
  const tsTabs = ['Preferences', 'Fields'];

  return (
    <PageShell title="Timesheet" desc="Configure timesheet settings." icon={FileClock}>
      <div className="flex items-center gap-1 mb-5 bg-slate-100 rounded-lg p-1 w-fit">
        {tsTabs.map(t => (
          <button key={t} onClick={() => setTsTab(t)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition ${tsTab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >{t}</button>
        ))}
      </div>

      {tsTab === 'Preferences' && (
        <div className="space-y-5">
          <Section title="Round Off Time">
            <p className="text-xs text-slate-500 mb-3">Time entries will appear on your invoices and reports based on the selected round-off format.</p>
            <Select label="" options={[
              { value: 'none', label: 'No Round Off' },
              { value: '15min', label: '15 Minutes' },
              { value: '30min', label: '30 Minutes' },
              { value: '1hour', label: '1 Hour' },
            ]} value={form.roundOff || 'none'} onChange={field('roundOff')} />
          </Section>

          <Section title="Maximum Hours">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-slate-600">Set maximum hours/day for logging time</span>
              <input type="text" value={form.maxHoursDay || '24:00'} onChange={e => setForm((p: any) => ({ ...p, maxHoursDay: e.target.value }))}
                className="w-20 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg text-center bg-white" />
            </div>
          </Section>

          <Section title="Cost Tracking">
            <ToggleRow label="Track costs for time entries" desc="Enabling this option allows you to track the cost associated with paying your staff for their time entries." checked={form.trackCosts} onClick={toggle('trackCosts')} />
          </Section>

          <Section title="Timesheet Approvals">
            <ToggleRow label="Enable Approvals for time entries" desc="Enabling this option lets you submit time entries to the project manager for their approval before you invoice them." checked={form.enableApprovals} onClick={toggle('enableApprovals')} />
            <ToggleRow label="Enable Customer Approvals for time entries." desc="Enabling this option allows you to submit time entries to your customers and get their approval before you invoice them." checked={form.enableCustomerApprovals} onClick={toggle('enableCustomerApprovals')} />
          </Section>
        </div>
      )}
      {tsTab !== 'Preferences' && (
        <Section title={tsTab}><p className="text-sm text-slate-400 py-8 text-center">No {tsTab.toLowerCase()} configured yet.</p></Section>
      )}

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
  const { form, setForm, field, toggle, handleSave, isPending, saved, error } = useSettingsForm('paymentGateways', {
    flutterwaveConnected: true, paystackConnected: false,
    redirectAfterCreation: true, allowPartialPayments: false, defaultGateway: 'flutterwave',
  });

  const toggleGateway = (gw: 'flutterwave' | 'paystack') => {
    const key = gw === 'flutterwave' ? 'flutterwaveConnected' : 'paystackConnected';
    setForm((p: any) => ({ ...p, [key]: !p[key] }));
  };

  return (
    <PageShell title="Payment Gateways" desc="Configure online payment gateway connections." icon={Wallet}>
      <Section title="Connected Gateways">
        <div className="space-y-3">
          <div className="flex items-center justify-between border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center text-sm font-bold">FW</div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Flutterwave</p>
                <p className="text-xs text-slate-400">{form.flutterwaveConnected ? 'Connected · Live Mode' : 'Not connected'}</p>
              </div>
            </div>
            {form.flutterwaveConnected ? (
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full uppercase">Active</span>
                <button onClick={() => toggleGateway('flutterwave')} className="px-3 py-1.5 border border-red-300 text-red-600 text-xs font-medium rounded-lg hover:bg-red-50">Disconnect</button>
              </div>
            ) : (
              <button onClick={() => toggleGateway('flutterwave')} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700">Connect</button>
            )}
          </div>
          <div className="flex items-center justify-between border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">PS</div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Paystack</p>
                <p className="text-xs text-slate-400">{form.paystackConnected ? 'Connected · Live Mode' : 'Not connected'}</p>
              </div>
            </div>
            {form.paystackConnected ? (
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full uppercase">Active</span>
                <button onClick={() => toggleGateway('paystack')} className="px-3 py-1.5 border border-red-300 text-red-600 text-xs font-medium rounded-lg hover:bg-red-50">Disconnect</button>
              </div>
            ) : (
              <button onClick={() => toggleGateway('paystack')} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700">Connect</button>
            )}
          </div>
        </div>
      </Section>
      <Section title="Payment Page Settings">
        <ToggleRow label="Redirect to payment page after invoice creation" checked={form.redirectAfterCreation} onClick={toggle('redirectAfterCreation')} />
        <ToggleRow label="Allow partial payments" checked={form.allowPartialPayments} onClick={toggle('allowPartialPayments')} />
        <Select label="Default payment gateway" options={[{ value: 'flutterwave', label: 'Flutterwave' }, { value: 'paystack', label: 'Paystack' }]} value={form.defaultGateway || 'flutterwave'} onChange={field('defaultGateway')} />
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
  const { form, handleSave, isPending, saved, error, setForm } = useSettingsForm('deliveryNotes', {
    labels: {} as Record<string,string>,
    showCustomerNotes: true,
  });

  const fields = [
    { key: 'documentTitle', label: 'Document Title', default: 'DELIVERY NOTE' },
    { key: 'transactionNumber', label: 'Transaction Number', default: '#' },
    { key: 'dateField', label: 'Date Field', default: 'Date' },
    { key: 'item', label: 'Item', default: 'Item' },
    { key: 'description', label: 'Description', default: 'Description' },
    { key: 'quantity', label: 'Quantity', default: 'Qty' },
    { key: 'referenceField', label: 'Reference Field', default: 'Reference#' },
    { key: 'billTo', label: 'Bill To', default: 'Bill To' },
    { key: 'signature', label: 'Signature', default: 'Authorized Signature' },
    { key: 'deliveryTo', label: 'Delivery To', default: 'Delivery To' },
    { key: 'balanceDue', label: 'Balance Due', default: 'Balance Due' },
  ];

  const labels = form.labels || {};

  function setLabel(key: string, value: string) {
    setForm((p: any) => ({ ...p, labels: { ...(p.labels || {}), [key]: value } }));
  }

  return (
    <PageShell title="Delivery Notes" desc="Configure default settings for delivery notes." icon={Truck}>
      <Section title="Delivery Notes">
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 pr-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Field</th>
                <th className="text-left py-3 pr-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Label</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {fields.map(f => (
                <tr key={f.key} className="hover:bg-slate-50/50">
                  <td className="py-3 pr-4 text-sm font-medium text-slate-700">{f.label}</td>
                  <td className="py-3 pr-4">
                    <input type="text" value={labels[f.key] ?? f.default} onChange={e => setLabel(f.key, e.target.value)}
                      className="w-full max-w-[200px] px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white" />
                  </td>
                </tr>
              ))}
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 pr-4 text-sm font-medium text-slate-700">Customer Notes</td>
                <td className="py-3 pr-4">
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={form.showCustomerNotes} onChange={() => setForm((p: any) => ({ ...p, showCustomerNotes: !p.showCustomerNotes }))} className="text-indigo-600 rounded" />
                    Show Customer Notes
                  </label>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

export function PackingSlipsSettingsPage() {
  const { form, handleSave, isPending, saved, error, setForm } = useSettingsForm('packingSlips', {
    labels: {} as Record<string,string>,
    showCustomerNotes: true,
  });

  const fields = [
    { key: 'documentTitle', label: 'Document Title', default: 'PACKING SLIP' },
    { key: 'transactionNumber', label: 'Transaction Number', default: '#' },
    { key: 'dateField', label: 'Date Field', default: 'Date' },
    { key: 'item', label: 'Item', default: 'Item' },
    { key: 'description', label: 'Description', default: 'Description' },
    { key: 'quantity', label: 'Quantity', default: 'Qty' },
    { key: 'referenceField', label: 'Reference Field', default: 'Reference#' },
    { key: 'billTo', label: 'Bill To', default: 'Bill To' },
    { key: 'signature', label: 'Signature', default: 'Authorized Signature' },
    { key: 'deliveryTo', label: 'Delivery To', default: 'Delivery To' },
    { key: 'balanceDue', label: 'Balance Due', default: 'Balance Due' },
  ];

  const labels = form.labels || {};

  function setLabel(key: string, value: string) {
    setForm((p: any) => ({ ...p, labels: { ...(p.labels || {}), [key]: value } }));
  }

  return (
    <PageShell title="Packing Slips" desc="Configure default settings for packing slips." icon={ClipboardList}>
      <Section title="Packing Slips">
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 pr-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Field</th>
                <th className="text-left py-3 pr-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Label</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {fields.map(f => (
                <tr key={f.key} className="hover:bg-slate-50/50">
                  <td className="py-3 pr-4 text-sm font-medium text-slate-700">{f.label}</td>
                  <td className="py-3 pr-4">
                    <input type="text" value={labels[f.key] ?? f.default} onChange={e => setLabel(f.key, e.target.value)}
                      className="w-full max-w-[200px] px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white" />
                  </td>
                </tr>
              ))}
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 pr-4 text-sm font-medium text-slate-700">Customer Notes</td>
                <td className="py-3 pr-4">
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={form.showCustomerNotes} onChange={() => setForm((p: any) => ({ ...p, showCustomerNotes: !p.showCustomerNotes }))} className="text-indigo-600 rounded" />
                    Show Customer Notes
                  </label>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>
      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

export function ExpensesSettingsPage() {
  const { form, field, toggle, handleSave, isPending, saved, error, setForm } = useSettingsForm('expenses', {
    associateEmployees: false, defaultMileageCategory: '', defaultUnit: 'km',
    mileageRates: [] as { startDate: string; rate: string }[],
  });
  const [eTab, setETab] = useState('Preferences');
  const eTabs = ['Preferences', 'Vehicle', 'Fields', 'Buttons', 'Related Lists'];
  const [startDate, setStartDate] = useState('');
  const [mileageRate, setMileageRate] = useState('');

  function addMileageRate() {
    if (!startDate || !mileageRate) return;
    setForm((p: any) => ({ ...p, mileageRates: [...(p.mileageRates || []), { startDate, rate: mileageRate }] }));
    setStartDate(''); setMileageRate('');
  }
  function removeMileageRate(i: number) {
    setForm((p: any) => ({ ...p, mileageRates: (p.mileageRates || []).filter((_: any, j: number) => j !== i) }));
  }

  return (
    <PageShell title="Expenses" desc="Configure default settings for expenses." icon={CreditCard}>
      <div className="flex items-center gap-1 mb-5 bg-slate-100 rounded-lg p-1 w-fit">
        {eTabs.map(t => (
          <button key={t} onClick={() => setETab(t)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition ${eTab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >{t}</button>
        ))}
      </div>

      {eTab === 'Preferences' && (
        <div className="space-y-5">
          <Section title="Expenses">
            <ToggleRow label="Associate employees to expenses" checked={form.associateEmployees} onClick={toggle('associateEmployees')} />
          </Section>
        </div>
      )}
      {eTab === 'Vehicle' && (
        <div className="space-y-5">
          <Section title="Mileage Preference">
            <Select label="Default Mileage Category" options={[{ value: '', label: 'Select...' }, { value: 'standard', label: 'Standard Mileage' }]} value={form.defaultMileageCategory || ''} onChange={field('defaultMileageCategory')} />
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-slate-600">Default Unit</span>
              {['Km', 'Mile'].map(u => (
                <label key={u} className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                  <input type="radio" name="defaultUnit" checked={form.defaultUnit === u.toLowerCase()} onChange={() => setForm((p: any) => ({ ...p, defaultUnit: u.toLowerCase() }))} className="text-indigo-600" />
                  {u}
                </label>
              ))}
            </div>
          </Section>
          <Section title="Mileage Rates">
            <p className="text-xs text-slate-500 mb-3">Any mileage expense recorded on or after the start date will have the corresponding mileage rate. You can create a default rate (created without specifying a date), which will be applicable for mileage expenses recorded before the initial start date.</p>
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-3 pr-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Start Date</th>
                    <th className="text-left py-3 pr-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Mileage Rate</th>
                    <th className="text-right py-3 pr-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">More Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(form.mileageRates || []).length === 0 ? (
                    <tr><td colSpan={3} className="py-4 text-center text-xs text-slate-400">No mileage rates added yet.</td></tr>
                  ) : (form.mileageRates || []).map((r: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="py-3 pr-4 text-xs text-slate-500">{r.startDate}</td>
                      <td className="py-3 pr-4 text-xs text-slate-700 font-medium">{r.rate}</td>
                      <td className="py-3 text-right"><button onClick={() => removeMileageRate(i)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <span className="text-xs text-slate-400">dd MMM yyyy</span>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white" />
              <span className="text-xs text-slate-400">NGN</span>
              <input type="number" value={mileageRate} onChange={e => setMileageRate(e.target.value)} placeholder="Rate" className="w-24 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white" />
              <button onClick={addMileageRate} disabled={!startDate || !mileageRate} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg"><Plus size={12} /> Add Mileage Rate</button>
            </div>
          </Section>
        </div>
      )}
      {eTab !== 'Preferences' && eTab !== 'Vehicle' && (
        <Section title={eTab}><p className="text-sm text-slate-400 py-8 text-center">No {eTab.toLowerCase()} configured yet.</p></Section>
      )}

      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

export function RecurringExpensesSettingsPage() {
  const { form, handleSave, isPending, saved, error, setForm } = useSettingsForm('recurringExpenses', { buttons: [] as any[] });
  const [rTab, setRTab] = useState('Buttons');
  const rTabs = ['Buttons'];
  const reButtons = form.buttons || [];

  return (
    <PageShell title="Recurring Expenses" desc="Configure default settings for recurring expenses." icon={Repeat}>
      <div className="flex items-center gap-3 mb-5">
        <a href="#" className="text-xs text-indigo-600 hover:underline">What's this?</a>
        <a href="#" className="text-xs text-indigo-600 hover:underline">View Logs</a>
      </div>
      <div className="flex items-center gap-1 mb-5 bg-slate-100 rounded-lg p-1 w-fit">
        {rTabs.map(t => (
          <button key={t} onClick={() => setRTab(t)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition ${rTab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >{t}</button>
        ))}
      </div>

      {rTab === 'Buttons' && <PurchasesButtonsSection buttons={reButtons} setButtons={b => setForm((p: any) => ({ ...p, buttons: b }))} />}

      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

const approvalOptions = [
  { value: 'none', label: 'No Approval', desc: 'Create and perform further actions without approval.' },
  { value: 'simple', label: 'Simple Approval', desc: 'Any user with approve permission can approve.' },
  { value: 'multi', label: 'Multi-Level Approval', desc: 'Set many levels of approval. The transaction will be approved only when all the approvers approve.' },
  { value: 'custom', label: 'Custom Approval', desc: 'Create a customized approval flow by adding one or more criteria.' },
];

function PurchasesFieldTable({ fields, setFields }: { fields: any[]; setFields: (f: any[]) => void }) {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [fieldForm, setFieldForm] = useState({ labelName: '', dataType: 'text', mandatory: false, showInPdf: true, status: 'active' });
  const filtered = fields.filter((f: any) => !search || f.labelName?.toLowerCase().includes(search.toLowerCase()));
  const dataTypes = ['Text Box (Single Line)', 'Text Box (Multi-line)', 'Date', 'Number', 'Dropdown', 'Checkbox'];
  return (
    <Section title="Fields">
      <div className="mb-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Field Name"
          className="w-full max-w-xs px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white" />
      </div>
      <div className="overflow-x-auto -mx-6 px-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              {['Field Name', 'Data Type', 'Mandatory', 'Show in All PDFs', 'Status', 'More Actions'].map(h => (
                <th key={h} className="text-left py-3 pr-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider last:text-right last:pr-0">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-xs text-slate-400">No fields configured yet.</td></tr>}
            {filtered.map((f: any, i: number) => (
              <tr key={f.id || i} className="hover:bg-slate-50/50">
                <td className="py-3 pr-4 text-sm font-medium text-slate-700">{f.labelName}</td>
                <td className="py-3 pr-4 text-xs text-slate-500">{f.dataType}</td>
                <td className="py-3 pr-4"><span className={`text-xs ${f.mandatory ? 'text-green-600 font-medium' : 'text-slate-400'}`}>{f.mandatory ? 'Yes' : 'No'}</span></td>
                <td className="py-3 pr-4"><span className={`text-xs ${f.showInPdf ? 'text-green-600 font-medium' : 'text-slate-400'}`}>{f.showInPdf ? 'Yes' : 'No'}</span></td>
                <td className="py-3 pr-4"><span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${f.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{f.status}</span></td>
                <td className="py-3 text-right">
                  <button onClick={() => { setEditIdx(i); setFieldForm({ labelName: f.labelName, dataType: f.dataType, mandatory: f.mandatory, showInPdf: f.showInPdf, status: f.status }); setShowModal(true); }} className="text-indigo-600 hover:underline text-xs mr-2">Edit</button>
                  <button onClick={() => setFields(fields.filter((_: any, j: number) => j !== i))} className="text-red-500 hover:underline text-xs">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 mt-3">Do you have information that doesn't go under any existing field? Go ahead and{' '}
        <button className="text-indigo-600 hover:underline" onClick={() => { setEditIdx(null); setFieldForm({ labelName: '', dataType: 'Text Box (Single Line)', mandatory: false, showInPdf: true, status: 'active' }); setShowModal(true); }}>create a new field</button>.
      </p>
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-slate-800 mb-4">{editIdx !== null ? 'Edit' : 'New'} Field</h3>
            <div className="space-y-4">
              <div><p className="text-xs font-medium text-slate-700 mb-1">Label Name</p>
                <input type="text" className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg" value={fieldForm.labelName} onChange={e => setFieldForm(p => ({ ...p, labelName: e.target.value }))} /></div>
              <div><p className="text-xs font-medium text-slate-700 mb-1">Data Type</p>
                <select className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white" value={fieldForm.dataType} onChange={e => setFieldForm(p => ({ ...p, dataType: e.target.value }))}>
                  {dataTypes.map(dt => <option key={dt} value={dt}>{dt}</option>)}
                </select></div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer"><input type="radio" name="fMandatory" checked={fieldForm.mandatory} onChange={() => setFieldForm(p => ({ ...p, mandatory: true }))} className="text-indigo-600" /> Yes</label>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer"><input type="radio" name="fMandatory" checked={!fieldForm.mandatory} onChange={() => setFieldForm(p => ({ ...p, mandatory: false }))} className="text-indigo-600" /> No</label>
              </div>
              <div className="flex items-center gap-2"><input type="checkbox" checked={fieldForm.showInPdf} onChange={e => setFieldForm(p => ({ ...p, showInPdf: e.target.checked }))} className="text-indigo-600" /><span className="text-xs text-slate-700">Show in All PDFs</span></div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer"><input type="radio" name="fStatus" checked={fieldForm.status === 'active'} onChange={() => setFieldForm(p => ({ ...p, status: 'active' }))} className="text-indigo-600" /> Active</label>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer"><input type="radio" name="fStatus" checked={fieldForm.status === 'inactive'} onChange={() => setFieldForm(p => ({ ...p, status: 'inactive' }))} className="text-indigo-600" /> Inactive</label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
                <button onClick={() => {
                  const list = [...fields];
                  if (editIdx !== null) list[editIdx] = fieldForm;
                  else list.push({ ...fieldForm, id: Date.now().toString() });
                  setFields(list);
                  setShowModal(false);
                }} className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

function PurchasesButtonsSection({ buttons, setButtons }: { buttons: any[]; setButtons: (b: any[]) => void }) {
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [permission, setPermission] = useState('all');
  const [location, setLocation] = useState('list');
  const filtered = buttons.filter((b: any) => !search || b.name?.toLowerCase().includes(search.toLowerCase()));
  return (
    <Section title="Buttons">
      <div className="mb-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Custom Button Name"
          className="w-full max-w-xs px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white" />
      </div>
      <div className="overflow-x-auto -mx-6 px-6">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-100">
            {['Info', 'Button Name', 'Access Permission', 'Location', 'More Actions'].map(h => (
              <th key={h} className="text-left py-3 pr-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider last:text-right last:pr-0">{h}</th>
            ))}
          </tr></thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="py-12 text-center"><p className="text-sm text-slate-400">Create buttons which perform actions set by you. <a href="#" className="text-indigo-600 hover:underline">What are you waiting for!</a></p></td></tr>
            ) : filtered.map((b: any, i: number) => (
              <tr key={i} className="hover:bg-slate-50/50">
                <td className="py-3 pr-4"><Info size={14} className="text-slate-300" /></td>
                <td className="py-3 pr-4 text-sm font-medium text-slate-700">{b.name}</td>
                <td className="py-3 pr-4 text-xs text-slate-500">{b.permission}</td>
                <td className="py-3 pr-4 text-xs text-slate-500">{b.location}</td>
                <td className="py-3 text-right"><button onClick={() => setButtons(buttons.filter((_: any, j: number) => j !== i))} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3 mt-4 flex-wrap">
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Button name" className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white" />
        <select value={permission} onChange={e => setPermission(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white">
          <option value="All Users">All Users</option>
          <option value="Admin Only">Admin Only</option>
          <option value="Manager">Manager</option>
        </select>
        <select value={location} onChange={e => setLocation(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white">
          <option value="List View">List View</option>
          <option value="Detail View">Detail View</option>
          <option value="Both">Both</option>
        </select>
        <button onClick={() => { if (!name.trim()) return; setButtons([...buttons, { name: name.trim(), permission, location }]); setName(''); }}
          disabled={!name.trim()} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"><Plus size={14} /> Add</button>
      </div>
    </Section>
  );
}

export function PurchaseOrdersSettingsPage() {
  const { form, handleSave, isPending, saved, error, setForm } = useSettingsForm('purchaseOrders', {
    closeWhen: 'receive', terms: '', notes: '', approvalType: 'none',
    fields: [{ id: '1', labelName: 'Purchase Order#', dataType: 'Text Box (Single Line)', mandatory: false, showInPdf: true, status: 'active' }],
    buttons: [] as any[],
  });
  const [poTab, setPoTab] = useState('Preferences');
  const poTabs = ['Preferences', 'Approvals', 'Fields', 'Validation Rules', 'Buttons', 'Related Lists'];
  const poFields = form.fields || [];
  const poButtons = form.buttons || [];

  return (
    <PageShell title="Purchase Orders" desc="Configure default settings for purchase orders." icon={ShoppingCart}>
      <div className="flex items-center gap-1 mb-5 bg-slate-100 rounded-lg p-1 w-fit">
        {poTabs.map(t => (
          <button key={t} onClick={() => setPoTab(t)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition ${poTab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >{t}</button>
        ))}
      </div>

      {poTab === 'Preferences' && (
        <div className="space-y-5">
          <Section title="Purchase Orders">
            <p className="text-xs font-semibold text-slate-600 mb-3">When do you want your Purchase Orders to be closed?</p>
            {[
              { value: 'receive', label: 'When a Purchase Receive is recorded' },
              { value: 'bill', label: 'When a Bill is created' },
              { value: 'both', label: 'When Receives and Bills are recorded' },
            ].map(o => (
              <label key={o.value} className="flex items-center gap-3 px-3 py-2.5 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 mb-2">
                <input type="radio" name="closeWhen" checked={form.closeWhen === o.value} onChange={() => setForm((p: any) => ({ ...p, closeWhen: o.value }))} className="text-indigo-600" />
                <span className="text-sm text-slate-700">{o.label}</span>
              </label>
            ))}
          </Section>
          <Section title="Terms & Conditions">
            <textarea value={form.terms || ''} onChange={e => setForm((p: any) => ({ ...p, terms: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white min-h-[80px] resize-y" placeholder="Enter terms and conditions..." />
          </Section>
          <Section title="Notes">
            <textarea value={form.notes || ''} onChange={e => setForm((p: any) => ({ ...p, notes: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white min-h-[80px] resize-y" placeholder="Enter notes..." />
          </Section>
        </div>
      )}
      {poTab === 'Approvals' && (
        <Section title="Approval Type">
          {approvalOptions.map(o => (
            <label key={o.value} className="flex items-start gap-3 px-3 py-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 mb-2">
              <input type="radio" name="poApproval" checked={form.approvalType === o.value} onChange={() => setForm((p: any) => ({ ...p, approvalType: o.value }))} className="text-indigo-600 mt-0.5" />
              <div><p className="text-sm font-medium text-slate-700">{o.label}</p><p className="text-xs text-slate-400">{o.desc}</p></div>
            </label>
          ))}
        </Section>
      )}
      {poTab === 'Fields' && <PurchasesFieldTable fields={poFields} setFields={f => setForm((p: any) => ({ ...p, fields: f }))} />}
      {poTab === 'Validation Rules' && (
        <Section title="Create Validation Rules">
          <p className="text-xs text-slate-500 mb-4">Validation Rules helps you to validate the data entered while creating, editing, or converting transactions and to prevent users from performing specific actions.</p>
          <div className="text-center py-12 text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg">No results found</div>
        </Section>
      )}
      {poTab === 'Buttons' && <PurchasesButtonsSection buttons={poButtons} setButtons={b => setForm((p: any) => ({ ...p, buttons: b }))} />}
      {poTab === 'Related Lists' && (
        <Section title="Related Lists"><p className="text-sm text-slate-400 py-8 text-center">No related lists configured yet.</p></Section>
      )}

      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}


export function BillsSettingsPage() {
  const { form, handleSave, isPending, saved, error, setForm } = useSettingsForm('bills', {
    approvalType: 'none',
    fields: [
      { id: '1', labelName: 'Order Number', dataType: 'Text Box (Single Line)', mandatory: false, showInPdf: true, status: 'active' },
      { id: '2', labelName: 'Bill#', dataType: 'Text Box (Single Line)', mandatory: true, showInPdf: true, status: 'active' },
      { id: '3', labelName: 'Bill Date', dataType: 'Date', mandatory: true, showInPdf: true, status: 'active' },
      { id: '4', labelName: 'Transaction Posting Date', dataType: 'Date', mandatory: false, showInPdf: false, status: 'inactive' },
      { id: '5', labelName: 'Subject', dataType: 'Text Box (Single Line)', mandatory: false, showInPdf: true, status: 'active' },
      { id: '6', labelName: 'Notes', dataType: 'Text Box (Multi-line)', mandatory: false, showInPdf: false, status: 'active' },
    ] as any[],
    buttons: [] as any[],
  });
  const [bTab, setBTab] = useState('Approvals');
  const bTabs = ['Approvals', 'Fields', 'Validation Rules', 'Buttons', 'Related Lists'];
  const bFields = form.fields || [];
  const bButtons = form.buttons || [];

  return (
    <PageShell title="Bills" desc="Configure default settings for bills." icon={FileText}>
      <div className="flex items-center gap-1 mb-5 bg-slate-100 rounded-lg p-1 w-fit">
        {bTabs.map(t => (
          <button key={t} onClick={() => setBTab(t)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition ${bTab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >{t}</button>
        ))}
      </div>

      {bTab === 'Approvals' && (
        <Section title="Approval Type">
          {[
            { value: 'none', label: 'No Approval', desc: 'Create Bill and perform further actions without approval.' },
            { value: 'simple', label: 'Simple Approval', desc: 'Any user with approve permission can approve the Bill.' },
            { value: 'multi', label: 'Multi-Level Approval', desc: 'Set many levels of approval. The Bill will be approved only when all the approvers approve.' },
            { value: 'custom', label: 'Custom Approval', desc: 'Create a customized approval flow by adding one or more criteria.' },
          ].map(o => (
            <label key={o.value} className="flex items-start gap-3 px-3 py-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 mb-2">
              <input type="radio" name="bApprovalType" checked={form.approvalType === o.value} onChange={() => setForm((p: any) => ({ ...p, approvalType: o.value }))} className="text-indigo-600 mt-0.5" />
              <div><p className="text-sm font-medium text-slate-700">{o.label}</p><p className="text-xs text-slate-400">{o.desc}</p></div>
            </label>
          ))}
        </Section>
      )}
      {bTab === 'Fields' && <PurchasesFieldTable fields={bFields} setFields={f => setForm((p: any) => ({ ...p, fields: f }))} />}
      {bTab === 'Validation Rules' && (
        <Section title="Create Validation Rules">
          <p className="text-xs text-slate-500 mb-4">Validation Rules helps you to validate the data entered while creating, editing, or converting transactions and to prevent users from performing specific actions.</p>
          <div className="text-center py-12 text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg">No results found</div>
        </Section>
      )}
      {bTab === 'Buttons' && <PurchasesButtonsSection buttons={bButtons} setButtons={b => setForm((p: any) => ({ ...p, buttons: b }))} />}
      {bTab === 'Related Lists' && (
        <Section title="Related Lists"><p className="text-sm text-slate-400 py-8 text-center">No related lists configured yet.</p></Section>
      )}

      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

export function RecurringBillsSettingsPage() {
  const { form, handleSave, isPending, saved, error, setForm } = useSettingsForm('recurringBills', { buttons: [] as any[] });
  const [rbTab, setRbTab] = useState('Buttons');
  const rbTabs = ['Buttons'];
  const rbButtons = form.buttons || [];

  return (
    <PageShell title="Recurring Bills" desc="Configure default settings for recurring bills." icon={FileClock}>
      <div className="flex items-center gap-3 mb-5">
        <a href="#" className="text-xs text-indigo-600 hover:underline">What's this?</a>
        <a href="#" className="text-xs text-indigo-600 hover:underline">View Logs</a>
      </div>
      <div className="flex items-center gap-1 mb-5 bg-slate-100 rounded-lg p-1 w-fit">
        {rbTabs.map(t => (
          <button key={t} onClick={() => setRbTab(t)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition ${rbTab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >{t}</button>
        ))}
      </div>

      {rbTab === 'Buttons' && <PurchasesButtonsSection buttons={rbButtons} setButtons={b => setForm((p: any) => ({ ...p, buttons: b }))} />}

      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

export function PaymentsMadeSettingsPage() {
  const { form, handleSave, isPending, saved, error, setForm } = useSettingsForm('paymentsMade', {
    approvalType: 'none',
    fields: [
      { id: '1', labelName: 'Payment#', dataType: 'Text Box (Single Line)', mandatory: true, showInPdf: true, status: 'active' },
      { id: '2', labelName: 'Payment Date', dataType: 'Date', mandatory: true, showInPdf: true, status: 'active' },
      { id: '3', labelName: 'Reference#', dataType: 'Text Box (Single Line)', mandatory: false, showInPdf: true, status: 'active' },
    ] as any[],
    buttons: [] as any[],
  });
  const [pmTab, setPmTab] = useState('Approvals');
  const pmTabs = ['Approvals', 'Fields', 'Buttons'];
  const pmFields = form.fields || [];
  const pmButtons = form.buttons || [];

  return (
    <PageShell title="Payments Made" desc="Configure default settings for payments made." icon={Wallet}>
      <div className="flex items-center gap-1 mb-5 bg-slate-100 rounded-lg p-1 w-fit">
        {pmTabs.map(t => (
          <button key={t} onClick={() => setPmTab(t)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition ${pmTab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >{t}</button>
        ))}
      </div>

      {pmTab === 'Approvals' && (
        <Section title="Approval Type">
          {[
            { value: 'none', label: 'No Approval', desc: 'Create Vendor Payment and perform further actions without approval.' },
            { value: 'simple', label: 'Simple Approval', desc: 'Any user with approve permission can approve the Vendor Payment.' },
            { value: 'multi', label: 'Multi-Level Approval', desc: 'Set many levels of approval. The Vendor Payment will be approved only when all the approvers approve.' },
            { value: 'custom', label: 'Custom Approval', desc: 'Create a customized approval flow by adding one or more criteria.' },
          ].map(o => (
            <label key={o.value} className="flex items-start gap-3 px-3 py-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 mb-2">
              <input type="radio" name="pmApprovalType" checked={form.approvalType === o.value} onChange={() => setForm((p: any) => ({ ...p, approvalType: o.value }))} className="text-indigo-600 mt-0.5" />
              <div><p className="text-sm font-medium text-slate-700">{o.label}</p><p className="text-xs text-slate-400">{o.desc}</p></div>
            </label>
          ))}
        </Section>
      )}
      {pmTab === 'Fields' && <PurchasesFieldTable fields={pmFields} setFields={f => setForm((p: any) => ({ ...p, fields: f }))} />}
      {pmTab === 'Buttons' && <PurchasesButtonsSection buttons={pmButtons} setButtons={b => setForm((p: any) => ({ ...p, buttons: b }))} />}

      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

export function VendorCreditsSettingsPage() {
  const { form, handleSave, isPending, saved, error, setForm } = useSettingsForm('vendorCredits', {
    approvalType: 'none',
    fields: [
      { id: '1', labelName: 'Vendor Credit#', dataType: 'Text Box (Single Line)', mandatory: true, showInPdf: true, status: 'active' },
      { id: '2', labelName: 'Credit Date', dataType: 'Date', mandatory: true, showInPdf: true, status: 'active' },
      { id: '3', labelName: 'Reference#', dataType: 'Text Box (Single Line)', mandatory: false, showInPdf: true, status: 'active' },
    ] as any[],
    buttons: [] as any[],
  });
  const [vcTab, setVcTab] = useState('Approvals');
  const vcTabs = ['Approvals', 'Fields', 'Validation Rules', 'Buttons', 'Related Lists'];
  const vcFields = form.fields || [];
  const vcButtons = form.buttons || [];

  return (
    <PageShell title="Vendor Credits" desc="Configure default settings for vendor credits." icon={Banknote}>
      <div className="flex items-center gap-1 mb-5 bg-slate-100 rounded-lg p-1 w-fit">
        {vcTabs.map(t => (
          <button key={t} onClick={() => setVcTab(t)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition ${vcTab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >{t}</button>
        ))}
      </div>

      {vcTab === 'Approvals' && (
        <Section title="Approval Type">
          {[
            { value: 'none', label: 'No Approval', desc: 'Create Vendor Credits and perform further actions without approval.' },
            { value: 'simple', label: 'Simple Approval', desc: 'Any user with approve permission can approve the Vendor Credits.' },
            { value: 'multi', label: 'Multi-Level Approval', desc: 'Set many levels of approval. The Vendor Credits will be approved only when all the approvers approve.' },
            { value: 'custom', label: 'Custom Approval', desc: 'Create a customized approval flow by adding one or more criteria.' },
          ].map(o => (
            <label key={o.value} className="flex items-start gap-3 px-3 py-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 mb-2">
              <input type="radio" name="vcApprovalType" checked={form.approvalType === o.value} onChange={() => setForm((p: any) => ({ ...p, approvalType: o.value }))} className="text-indigo-600 mt-0.5" />
              <div><p className="text-sm font-medium text-slate-700">{o.label}</p><p className="text-xs text-slate-400">{o.desc}</p></div>
            </label>
          ))}
        </Section>
      )}
      {vcTab === 'Fields' && <PurchasesFieldTable fields={vcFields} setFields={f => setForm((p: any) => ({ ...p, fields: f }))} />}
      {vcTab === 'Validation Rules' && (
        <Section title="Create Validation Rules">
          <p className="text-xs text-slate-500 mb-4">Validation Rules helps you to validate the data entered while creating, editing, or converting transactions and to prevent users from performing specific actions.</p>
          <div className="text-center py-12 text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg">No results found</div>
        </Section>
      )}
      {vcTab === 'Buttons' && <PurchasesButtonsSection buttons={vcButtons} setButtons={b => setForm((p: any) => ({ ...p, buttons: b }))} />}
      {vcTab === 'Related Lists' && (
        <Section title="Related Lists"><p className="text-sm text-slate-400 py-8 text-center">No related lists configured yet.</p></Section>
      )}

      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Custom Modules ────────────────────────────────────────────────────────
export function CustomModulesPage() {
  const { form, handleSave, isPending, saved, error, setForm } = useSettingsForm('customModules', { modules: [] as { name: string; plural: string; desc: string; primaryField: string }[] });
  const [showForm, setShowForm] = useState(false);
  const [step, setStep] = useState(1);
  const [modName, setModName] = useState('');
  const [modPlural, setModPlural] = useState('');
  const [modDesc, setModDesc] = useState('');
  const [primaryField, setPrimaryField] = useState('');

  function createModule() {
    if (!modName.trim() || step === 1) return;
    setForm((p: any) => ({ ...p, modules: [...(p.modules || []), { name: modName.trim(), plural: modPlural.trim() || modName.trim(), desc: modDesc, primaryField: primaryField || 'Name' }] }));
    setModName(''); setModPlural(''); setModDesc(''); setPrimaryField(''); setStep(1); setShowForm(false);
  }

  return (
    <PageShell title="Custom Modules" desc="Manage custom modules and integrations." icon={PuzzleIcon}>
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-6 mb-5">
        <h3 className="text-sm font-bold text-indigo-800 mb-1">Introducing Custom Modules</h3>
        <p className="text-xs text-slate-500 mb-4">Create Custom Modules to record and track information that cannot be recorded in the pre-defined modules of SkyBooks.</p>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition">Create Module</button>
      </div>

      {showForm && (
        <Section title="Create Custom Module">
          <div className="flex items-center gap-1 text-xs font-medium mb-4">
            {[{ n: 1, label: 'Module Details' }, { n: 2, label: 'Primary Field Properties' }].map((s, i) => (
              <div key={s.n} className="flex items-center gap-1.5">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step >= s.n ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}>{s.n}</span>
                <span className={`text-xs ${step >= s.n ? 'text-indigo-700 font-medium' : 'text-slate-400'}`}>{s.label}</span>
                {i === 0 && <ChevronRight size={14} className="text-slate-300 mx-1" />}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Module Name</label>
                <input type="text" value={modName} onChange={e => setModName(e.target.value)} placeholder="e.g. Assets" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Plural Name</label>
                <input type="text" value={modPlural} onChange={e => setModPlural(e.target.value)} placeholder="e.g. Assets" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Description</label>
                <textarea value={modDesc} onChange={e => setModDesc(e.target.value)} placeholder="Describe this module..." className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white min-h-[60px] resize-y" />
              </div>
              <p className="text-xs text-amber-600">Note: Only admins and users with relevant permission can access the records of this custom module.</p>
              <div className="flex items-center gap-3 pt-2">
                <button onClick={() => { if (modName.trim()) setStep(2); }} disabled={!modName.trim()} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg">Next</button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Primary Field Properties</label>
                <Select label="Field Type" options={[
                  { value: 'text', label: 'Text' },
                  { value: 'number', label: 'Number' },
                  { value: 'date', label: 'Date' },
                  { value: 'dropdown', label: 'Dropdown' },
                ]} value={primaryField || 'text'} onChange={(v: any) => setPrimaryField(v)} />
              </div>
              <p className="text-xs text-slate-400">The primary field is the main field used to identify records in this module.</p>
              <div className="flex items-center gap-3 pt-2">
                <button onClick={createModule} disabled={!modName.trim()} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg">Create Module</button>
                <button onClick={() => setStep(1)} className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Back</button>
              </div>
            </div>
          )}
        </Section>
      )}

      {(form.modules || []).length > 0 && (
        <Section title="Installed Modules">
          {(form.modules || []).map((m: any, i: number) => (
            <div key={i} className="flex items-center justify-between border border-slate-200 rounded-lg p-4 mb-2">
              <div>
                <p className="text-sm font-semibold text-slate-800">{m.name}</p>
                <p className="text-xs text-slate-400">{m.desc || 'No description'}</p>
              </div>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full uppercase">Active</span>
            </div>
          ))}
        </Section>
      )}

      <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
    </PageShell>
  );
}

// ─── Taxes ──────────────────────────────────────────────────────────────────
const DEFAULT_TAX_RATES: { name: string; rate: number }[] = [
  { name: 'FCTA NCS1 AMMC/AEPB (WHT&Others)', rate: -14.5 },
  { name: 'LAWMA Deduction (Sources) WHT STM DUTY VAT', rate: -12.5 },
  { name: 'Value Added Tax (VAT)', rate: 7.5 },
  { name: 'Withholding Tax (WHT) - 10%', rate: 10 },
  { name: 'Withholding Tax (WHT) - 5%', rate: 5 },
];

export function TaxesPage() {
  const { form, field, toggle, handleSave, isPending, saved, error, setForm } = useSettingsForm('taxes', {
    taxRates: DEFAULT_TAX_RATES,
    whtRates: [],
    taxRegistrationNumber: 'TAX 2301110109017',
    enableWht: false,
    enableTdsFor: 'customers',
    enableWhtOverrideSales: false,
    enableWhtOverridePurchases: false,
    enableReverseChargeSales: false,
    enableReverseChargePurchases: false,
    taxTrackingPreference: 'single',
    enableTaxOverrideSales: false,
    enableTaxOverridePurchases: false,
    enableVatMoss: false,
  });
  const [activeTab, setActiveTab] = useState<'taxRates' | 'whtRates' | 'settings'>('taxRates');
  const [taxModalOpen, setTaxModalOpen] = useState(false);
  const [editingTaxIdx, setEditingTaxIdx] = useState<number | null>(null);
  const [taxForm, setTaxForm] = useState({ name: '', rate: '' });

  const { data: accounts } = useQuery<any[]>({
    queryKey: ['accountant', 'accounts'],
    queryFn: async () => { const r = await api.get('/accountant/accounts'); return r.data; },
    staleTime: 60000,
  });

  const tabs = [
    { key: 'taxRates' as const, label: 'Tax Rates' },
    { key: 'whtRates' as const, label: 'WHT(TSD) Rates' },
    { key: 'settings' as const, label: 'Tax Settings' },
  ];

  function openAddTax() { setEditingTaxIdx(null); setTaxForm({ name: '', rate: '' }); setTaxModalOpen(true); }
  function openEditTax(i: number) { const t = form.taxRates?.[i]; if (t) { setEditingTaxIdx(i); setTaxForm({ name: t.name, rate: String(t.rate) }); setTaxModalOpen(true); } }

  function saveTaxRate() {
    if (!taxForm.name.trim() || !taxForm.rate.trim()) return;
    const rate = parseFloat(taxForm.rate);
    if (isNaN(rate)) return;
    const rates = [...(form.taxRates || [])];
    if (editingTaxIdx !== null) {
      rates[editingTaxIdx] = { name: taxForm.name.trim(), rate };
    } else {
      rates.push({ name: taxForm.name.trim(), rate });
    }
    setForm((p: any) => ({ ...p, taxRates: rates }));
    setTaxModalOpen(false);
  }

  function deleteTaxRate(i: number) {
    const rates = [...(form.taxRates || [])];
    rates.splice(i, 1);
    setForm((p: any) => ({ ...p, taxRates: rates }));
  }

  return (
    <PageShell title="Taxes" desc="Manage tax rates, WHT (TSD) rates, and tax settings." icon={Receipt}>
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 px-4 py-2 text-xs font-medium rounded-md transition ${
              activeTab === t.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'taxRates' && (
        <Section title="Active Taxes">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="py-2.5 pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tax Name</th>
                <th className="py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Rate (%)</th>
                <th className="py-2.5 pl-4 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(form.taxRates || []).map((tax: any, i: number) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 pr-4 text-sm text-slate-800">{tax.name}</td>
                  <td className="py-3 px-4 text-sm text-slate-800">{tax.rate}%</td>
                  <td className="py-3 pl-4 text-right">
                    <button onClick={() => openEditTax(i)} className="text-slate-400 hover:text-indigo-600 transition mr-2"><Pencil size={14} /></button>
                    <button onClick={() => deleteTaxRate(i)} className="text-slate-400 hover:text-red-500 transition"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <button onClick={openAddTax} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition">
            <Plus size={16} /> Add Tax
          </button>
        </Section>
      )}

      {activeTab === 'whtRates' && (
        <Section title="New WHT (TSD)">
          <div className="space-y-4">
            <Field label="WHT Name" placeholder="e.g. Withholding Tax - 10%" value={form.whtName || ''} onChange={field('whtName')} />
            <Field label="WHT Rate (%)" type="number" placeholder="10" value={form.whtRate || ''} onChange={field('whtRate')} />
            <Select label="Tracking Preference" options={[
              { value: 'sales', label: 'Track in Sales' },
              { value: 'purchases', label: 'Track in Purchases' },
              { value: 'both', label: 'Track in Both' },
            ]} value={form.whtTrackingPref || 'both'} onChange={field('whtTrackingPref')} />
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Account to Track WHT in Sales</label>
              <AccountSearchSelect
                accounts={(accounts || []).filter((a: any) => a.isActive)}
                value={form.whtSalesAccount || ''}
                onChange={id => setForm({ ...form, whtSalesAccount: id })}
                placeholder="Select account"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Account to Track WHT in Purchases</label>
              <AccountSearchSelect
                accounts={(accounts || []).filter((a: any) => a.isActive)}
                value={form.whtPurchasesAccount || ''}
                onChange={id => setForm({ ...form, whtPurchasesAccount: id })}
                placeholder="Select account"
              />
            </div>
          </div>
        </Section>
      )}

      {activeTab === 'settings' && (
        <>
          <Section title="Tax Registration Number">
            <Field label="Tax Registration Number" placeholder="TAX 2301110109017" value={form.taxRegistrationNumber || ''} onChange={field('taxRegistrationNumber')} />
            <p className="text-xs text-slate-400 mt-1">
              To include this number as part of your organization address in transaction PDFs, insert this number's placeholder in Organization Address Format under{' '}
              <a href="/settings/general" className="text-indigo-600 hover:underline">Settings &gt; Preferences &gt; General</a>.
            </p>
          </Section>

          <Section title="WHT">
            <ToggleRow label="Enable WHT" checked={form.enableWht} onClick={toggle('enableWht')} />
            {form.enableWht && (
              <>
                <p className="text-xs text-slate-500 mb-2">
                  TDS or the Tax Deducted at Source, can be associated with the customers, vendors or both. You can enable TDS for a particular contact in the contact's create or edit page.
                </p>
                <Select label="Enable TDS For" options={[
                  { value: 'customers', label: 'Customers' },
                  { value: 'vendors', label: 'Vendors' },
                  { value: 'both', label: 'Both Customers & Vendors' },
                ]} value={form.enableTdsFor || 'customers'} onChange={field('enableTdsFor')} />
                <div className="mt-3 pl-4 border-l-2 border-indigo-200 space-y-1">
                  <ToggleRow label="Enable WHT Override for sales transactions" checked={form.enableWhtOverrideSales} onClick={toggle('enableWhtOverrideSales')} desc="This option lets you override the system generated TDS amount in sales transactions." />
                  <ToggleRow label="Enable WHT Override for purchases transactions" checked={form.enableWhtOverridePurchases} onClick={toggle('enableWhtOverridePurchases')} desc="This option lets you override the system generated TDS amount in purchases transactions." />
                </div>
              </>
            )}
          </Section>

          <Section title="Reverse Charge">
            <p className="text-xs text-slate-500 mb-2">
              Reverse Charge allows you to pay taxes directly to the government for purchases and enables customers to do the same for sales transactions. Enable Reverse Charge to apply and track it to your sales and purchase transactions.
            </p>
            <ToggleRow label="Enable Reverse Charge in Sales transactions" checked={form.enableReverseChargeSales} onClick={toggle('enableReverseChargeSales')} />
            <ToggleRow label="Enable Reverse Charge in Purchase transactions" checked={form.enableReverseChargePurchases} onClick={toggle('enableReverseChargePurchases')} />
          </Section>

          <Section title="Tax Tracking Account Preference">
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                <input type="radio" name="taxTrackingPref" value="single" checked={form.taxTrackingPreference === 'single'} onChange={() => setForm((p: any) => ({ ...p, taxTrackingPreference: 'single' }))} className="text-indigo-600 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700">Track taxes under a single account</p>
                  <p className="text-xs text-slate-400">The taxes applied on your sales and purchase transactions will be tracked under the Tax Payable account.</p>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                <input type="radio" name="taxTrackingPref" value="separate" checked={form.taxTrackingPreference === 'separate'} onChange={() => setForm((p: any) => ({ ...p, taxTrackingPreference: 'separate' }))} className="text-indigo-600 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700">Track taxes under separate accounts</p>
                  <p className="text-xs text-slate-400">The taxes applied on your sales and purchase transactions will be tracked under the Output Tax and Input Tax accounts respectively.</p>
                </div>
              </label>
            </div>
          </Section>

          <Section title="Tax Override in Transactions">
            <ToggleRow label="Enable Tax Override for sales transactions" checked={form.enableTaxOverrideSales} onClick={toggle('enableTaxOverrideSales')} desc="This option lets you override the system generated Tax amount in sales transactions." />
            <ToggleRow label="Enable Tax Override for purchases transactions" checked={form.enableTaxOverridePurchases} onClick={toggle('enableTaxOverridePurchases')} desc="This option lets you override the system generated Tax amount in purchases transactions." />
          </Section>

          <Section title="VAT MOSS, IOSS and Digital Services Export">
            <ToggleRow label="Track VAT MOSS, OSS, IOSS, or the sale of digital services to overseas customers" checked={form.enableVatMoss} onClick={toggle('enableVatMoss')} desc="Enable this to track the sale of digital services to the EU member states using the VAT MOSS Report. Also, you can track the VAT collected on the sale of imported goods to buyers in the EU member states using the IOSS Report, and track digital services export using the Overseas Digital Tax Summary report." />
          </Section>

          <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />
        </>
      )}

      {activeTab !== 'settings' && <SaveBar onSave={handleSave} isPending={isPending} saved={saved} error={error} />}

      {taxModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">{editingTaxIdx !== null ? 'Edit Tax Rate' : 'Add Tax Rate'}</h2>
              <button onClick={() => setTaxModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <Field label="Tax Name" placeholder="e.g. Value Added Tax" value={taxForm.name} onChange={e => setTaxForm(p => ({ ...p, name: e.target.value }))} />
              <Field label="Rate (%)" type="number" placeholder="7.5" value={taxForm.rate} onChange={e => setTaxForm(p => ({ ...p, rate: e.target.value }))} />
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setTaxModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                <button onClick={saveTaxRate} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">{editingTaxIdx !== null ? 'Save' : 'Add'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
