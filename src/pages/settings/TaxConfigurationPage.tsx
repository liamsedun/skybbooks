import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Receipt, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { taxApi } from '../../lib/api';

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

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2 flex-wrap gap-2">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {desc && <p className="text-xs text-slate-400">{desc}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${checked ? 'bg-indigo-600' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
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

function Select({ label, desc, options, value, onChange }: { label: string; desc?: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white text-slate-800 transition-shadow"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {desc && <p className="text-xs text-slate-400 mt-1">{desc}</p>}
    </div>
  );
}

export function TaxConfigurationPage() {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear().toString();
  const [taxYear, setTaxYear] = useState(currentYear);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    sizeClass: '',
    incorporationDate: '',
    fiscalYearEnd: 'Dec 31',
    pioneerStatus: false,
    pioneerStartDate: '',
    pioneerEndDate: '',
    nitdaApplicable: false,
    pptApplicable: false,
    exportExemption: false,
    agriculturalExemption: false,
    foreignEquityExemption: false,
    firstFourYearsExemption: false,
    minimumTaxExemptReason: '',
  });

  const { data: config, isLoading } = useQuery({
    queryKey: ['tax-config', taxYear],
    queryFn: () => taxApi.getConfiguration({ taxYear }),
  });

  useEffect(() => {
    if (config) {
      setForm({
        sizeClass: config.sizeClass || '',
        incorporationDate: config.incorporationDate ? config.incorporationDate.slice(0, 10) : '',
        fiscalYearEnd: config.fiscalYearEnd || 'Dec 31',
        pioneerStatus: config.pioneerStatus || false,
        pioneerStartDate: config.pioneerStartDate ? config.pioneerStartDate.slice(0, 10) : '',
        pioneerEndDate: config.pioneerEndDate ? config.pioneerEndDate.slice(0, 10) : '',
        nitdaApplicable: config.nitdaApplicable || false,
        pptApplicable: config.pptApplicable || false,
        exportExemption: config.exportExemption || false,
        agriculturalExemption: config.agriculturalExemption || false,
        foreignEquityExemption: config.foreignEquityExemption || false,
        firstFourYearsExemption: config.firstFourYearsExemption || false,
        minimumTaxExemptReason: config.minimumTaxExemptReason || '',
      });
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => taxApi.updateConfiguration(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-config'] });
      setSaved(true);
      setError(null);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || 'Failed to save tax configuration.');
      setSaved(false);
    },
  });

  function f(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | string) =>
      setForm(prev => ({ ...prev, [key]: typeof e === 'string' ? e : e.target.value }));
  }

  function handleToggle(key: keyof typeof form) {
    return (v: boolean) => setForm(prev => ({ ...prev, [key]: v }));
  }

  function handleSave() {
    setError(null);
    saveMutation.mutate({
      taxYear,
      sizeClass: form.sizeClass || undefined,
      incorporationDate: form.incorporationDate || null,
      fiscalYearEnd: form.fiscalYearEnd,
      pioneerStatus: form.pioneerStatus,
      pioneerStartDate: form.pioneerStartDate || null,
      pioneerEndDate: form.pioneerEndDate || null,
      nitdaApplicable: form.nitdaApplicable,
      pptApplicable: form.pptApplicable,
      exportExemption: form.exportExemption,
      agriculturalExemption: form.agriculturalExemption,
      foreignEquityExemption: form.foreignEquityExemption,
      firstFourYearsExemption: form.firstFourYearsExemption,
    });
  }

  if (isLoading) {
    return (
      <PageShell title="Tax Configuration" desc="Configure your company's Nigerian tax profile for CIT, EDT, CGT, NITDA, and deferred tax." icon={Receipt}>
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading tax configuration...
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Tax Configuration" desc="Configure your company's Nigerian tax profile for CIT, EDT, CGT, NITDA, and deferred tax." icon={Receipt}>
      <Section title="Tax Year" desc="Select the tax year for this configuration.">
        <Select
          label="Tax Year"
          options={[
            { value: (currentYearAsInt() - 1).toString(), label: (currentYearAsInt() - 1).toString() },
            { value: currentYear, label: currentYear },
            { value: (currentYearAsInt() + 1).toString(), label: (currentYearAsInt() + 1).toString() },
          ]}
          value={taxYear}
          onChange={setTaxYear}
        />
      </Section>

      <Section title="Company Tax Profile" desc="Auto-classified based on turnover, or override manually.">
        <Select
          label="Company Size Classification"
          desc="Auto-detected from gross turnover: Small (<₦25M), Medium (₦25M–₦100M), Large (>₦100M)"
          options={[
            { value: '', label: '— Auto-classify —' },
            { value: 'small', label: 'Small Company (Turnover < ₦25M) — CIT 0%' },
            { value: 'medium', label: 'Medium Company (₦25M–₦100M) — CIT 20%' },
            { value: 'large', label: 'Large Company (> ₦100M) — CIT 30%' },
          ]}
          value={form.sizeClass}
          onChange={f('sizeClass')}
        />
        <Field label="Date of Incorporation" type="date" value={form.incorporationDate} onChange={f('incorporationDate')} />
        <Field label="Fiscal Year End" value={form.fiscalYearEnd} onChange={f('fiscalYearEnd')} placeholder="e.g. Dec 31" />
      </Section>

      <Section title="Applicable Taxes" desc="Enable the tax types that apply to your company.">
        <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 mb-2">
          Company Income Tax (CIT) — applies to all companies. Education Tax (TETFund) — all non-small companies.
        </div>
        <ToggleRow label="NITDA Levy (1% of PBT)" desc="For IT/Telecoms/Digital sector companies with turnover > ₦100M" checked={form.nitdaApplicable} onChange={handleToggle('nitdaApplicable')} />
        <ToggleRow label="Petroleum Profits Tax (PPT)" desc="For upstream petroleum operations only" checked={form.pptApplicable} onChange={handleToggle('pptApplicable')} />
      </Section>

      <Section title="Minimum Tax Exemptions" desc="Select any exemptions that apply to your company.">
        <ToggleRow label="First 4 years of business" desc="Company is within first 4 years from incorporation date" checked={form.firstFourYearsExemption} onChange={handleToggle('firstFourYearsExemption')} />
        <ToggleRow label="Agricultural company" desc="Engaged in agricultural trade or business (CITA s.33(1))" checked={form.agriculturalExemption} onChange={handleToggle('agriculturalExemption')} />
        <ToggleRow label="Foreign equity > 25% (first 5 years)" desc="Foreign equity participation exceeds 25% and within first 5 years" checked={form.foreignEquityExemption} onChange={handleToggle('foreignEquityExemption')} />
      </Section>

      <Section title="Tax-Exempt Income" desc="Income streams that are exempt from tax.">
        <ToggleRow label="Export proceeds exemption" desc="Export proceeds repatriated into Nigeria (CITA s.23)" checked={form.exportExemption} onChange={handleToggle('exportExemption')} />
      </Section>

      <Section title="Pioneer Status / Industry Incentives" desc="Tax holidays and特殊 incentives.">
        <ToggleRow label="Pioneer Status (Tax Holiday)" desc="Granted by NIPC — CIT and EDT = 0% during pioneer period" checked={form.pioneerStatus} onChange={handleToggle('pioneerStatus')} />
        {form.pioneerStatus && (
          <div className="grid grid-cols-2 gap-3 ml-4">
            <Field label="Pioneer Start Date" type="date" value={form.pioneerStartDate} onChange={f('pioneerStartDate')} />
            <Field label="Pioneer End Date" type="date" value={form.pioneerEndDate} onChange={f('pioneerEndDate')} />
          </div>
        )}
      </Section>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
        <div>
          <p className="text-sm font-semibold text-slate-900">Save Tax Configuration</p>
          <p className="text-xs text-slate-400">Your settings are saved per tax year.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all duration-150"
        >
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4 text-green-200" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </PageShell>
  );
}

function currentYearAsInt() {
  return new Date().getFullYear();
}
