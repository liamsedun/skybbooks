import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useOrgSettings } from '../../hooks/useOrgSettings';
import { orgApi, authApi } from '../../lib/api';

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
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
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
  Loader2, Save, CheckCircle2, AlertCircle, MapPin, Calendar, Phone, Search,
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
                <div className="grid grid-cols-2 gap-3">
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
                  <div className="grid grid-cols-3 gap-3">
                    <input type="text" value={locForm.city || ''} onChange={f('city')} placeholder="City" disabled={viewOnly} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 placeholder-slate-400 disabled:bg-slate-50 disabled:text-slate-500" />
                    <input type="text" value={locForm.zip || ''} onChange={f('zip')} placeholder="ZIP/Postal Code" disabled={viewOnly} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 placeholder-slate-400 disabled:bg-slate-50 disabled:text-slate-500" />
                    <input type="text" value={locForm.state || ''} onChange={f('state')} placeholder="State/Province" disabled={viewOnly} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 placeholder-slate-400 disabled:bg-slate-50 disabled:text-slate-500" />
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div className="grid grid-cols-2 gap-3">
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
                <div className="border border-slate-200 rounded-lg overflow-hidden">
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
      <div className="flex items-center justify-between mb-5">
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
        </div>
      </div>

      <Section title="Team Members">
        {usersLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-slate-300" /></div>
        ) : !users || users.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No users have been invited yet.</p>
        ) : (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
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
      <div className="flex items-center justify-between mb-5">
        <p className="text-xs text-slate-500">{allRoles.length} role{allRoles.length !== 1 ? 's' : ''} configured</p>
        <div className="flex items-center gap-2">
          <input type="text" value={newRoleNameInput} onChange={e => setNewRoleNameInput(e.target.value)}
            placeholder="New role name..." className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-48"
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
