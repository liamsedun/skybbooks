/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Users,
  Shield,
} from 'lucide-react';

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
  };
}

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

export function OrganisationSettingsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState<OrgFormState>({
    name: '', address: '', phone: '', email: '',
    fiscalYearStart: '', vatNumber: '', rcNumber: '',
  });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
    updateMutation.mutate(payload);
  }

  function f(key: keyof OrgFormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 flex items-center justify-center text-slate-400">
        <Loader2 size={20} className="animate-spin mr-2" />
        Loading organisation details...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-8">
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
              value={form.fiscalYearStart}
              onChange={f('fiscalYearStart')}
              placeholder="01-01 (DD-MM)"
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
  );
}
