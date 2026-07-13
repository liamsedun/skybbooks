import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { legacyApi } from '../../lib/api';
import { Loader2, Lock, Unlock, AlertTriangle, Save, Plus, Eye, Pencil, ChevronDown, ChevronUp, History, Database } from 'lucide-react';

type TabType = 'income' | 'cashflow' | 'socie' | 'settings';

const fiscalYears = [2025, 2024, 2023, 2022, 2021, 2020];

const IS_LINES = [
  { key: 'operatingRevenue', label: 'Operating Revenue' },
  { key: 'otherOperatingIncome', label: 'Other Operating Income' },
  { key: 'totalRevenue', label: 'Total Revenue', computed: true },
  { key: 'costOfSales', label: 'Cost of Sales' },
  { key: 'grossProfit', label: 'Gross Profit', computed: true },
  { key: 'staffCosts', label: 'Staff Costs' },
  { key: 'administrative', label: 'Administrative Expenses' },
  { key: 'sellingDistribution', label: 'Selling & Distribution' },
  { key: 'otherOperating', label: 'Other Operating Expenses' },
  { key: 'financeIncome', label: 'Finance Income' },
  { key: 'financeCosts', label: 'Finance Costs' },
  { key: 'taxExpense', label: 'Income Tax Expense' },
  { key: 'netProfit', label: 'Net Profit', computed: true },
];

function fmtKobo(v: number) {
  return (v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toKobo(v: string) {
  const clean = v.replace(/[^0-9.-]/g, '');
  return Math.round(parseFloat(clean || '0') * 100);
}

export function LegacyMigrationPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabType>('income');
  const [selectedFy, setSelectedFy] = useState<number>(fiscalYears[0]);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmUnlock, setConfirmUnlock] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState('');
  const [liveGl, setLiveGl] = useState('');
  const [legacyName, setLegacyName] = useState('');

  // Org settings for migration config
  const { data: orgData, isLoading: orgLoading } = useQuery({
    queryKey: ['org'],
    queryFn: () => legacyApi.getOrg(),
  });
  const org = orgData?.data || orgData || {};

  // Sync settings form fields when org data loads
  useEffect(() => {
    if (org) {
      setLiveGl(org?.liveGlStartFiscalYear != null ? String(org.liveGlStartFiscalYear) : '');
      setLegacyName(org?.legacySystemName || '');
    }
  }, [org]);

  // Legacy statement data
  const queryKey = ['legacy', tab, selectedFy];

  const { data: isData, isLoading: isLoad, refetch: refetchIS } = useQuery({
    queryKey: ['legacy', 'income', selectedFy],
    queryFn: () => legacyApi.getIncomeStatement(selectedFy),
    enabled: tab === 'income',
    retry: false,
  });

  const { data: cfData, isLoading: cfLoad, refetch: refetchCF } = useQuery({
    queryKey: ['legacy', 'cashflow', selectedFy],
    queryFn: () => legacyApi.getCashFlowStatement(selectedFy),
    enabled: tab === 'cashflow',
    retry: false,
  });

  const { data: socieData, isLoading: socieLoad, refetch: refetchSocie } = useQuery({
    queryKey: ['legacy', 'socie', selectedFy],
    queryFn: () => legacyApi.getSocieStatement(selectedFy),
    enabled: tab === 'socie',
    retry: false,
  });

  const existingRecord = (() => {
    if (tab === 'income') return (isData as any)?.data || null;
    if (tab === 'cashflow') return (cfData as any)?.data || null;
    if (tab === 'socie') return (socieData as any)?.data || null;
    return null;
  })();

  const locked = existingRecord?.isLocked !== false;

  // Income statement form state
  const initialIsForm = { operatingRevenue: 0, otherOperatingIncome: 0, totalRevenue: 0, costOfSales: 0, grossProfit: 0, staffCosts: 0, administrative: 0, sellingDistribution: 0, otherOperating: 0, financeIncome: 0, financeCosts: 0, taxExpense: 0, netProfit: 0 };
  const [isForm, setIsForm] = useState(initialIsForm);

  useEffect(() => {
    if (existingRecord && tab === 'income') {
      const d = existingRecord.data || {};
      setIsForm({
        operatingRevenue: d.operatingRevenue || 0,
        otherOperatingIncome: d.otherOperatingIncome || 0,
        totalRevenue: d.totalRevenue || 0,
        costOfSales: d.costOfSales || 0,
        grossProfit: d.grossProfit || 0,
        staffCosts: d.staffCosts || 0,
        administrative: d.administrative || 0,
        sellingDistribution: d.sellingDistribution || 0,
        otherOperating: d.otherOperating || 0,
        financeIncome: d.financeIncome || 0,
        financeCosts: d.financeCosts || 0,
        taxExpense: d.taxExpense || 0,
        netProfit: d.netProfit || 0,
      });
    } else if (!existingRecord && tab === 'income') {
      setIsForm(initialIsForm);
    }
  }, [existingRecord, tab, selectedFy]);

  // Computed fields
  const computedTotalRevenue = isForm.operatingRevenue + isForm.otherOperatingIncome;
  const computedGrossProfit = computedTotalRevenue - isForm.costOfSales;
  const totalOpEx = isForm.staffCosts + isForm.administrative + isForm.sellingDistribution + isForm.otherOperating;
  const computedNetProfit = computedGrossProfit - totalOpEx + isForm.financeIncome - isForm.financeCosts - isForm.taxExpense;

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (tab === 'income') return legacyApi.upsertIncomeStatement(selectedFy, { fiscalYear: selectedFy, periodLabel: `FY${selectedFy}`, data });
      if (tab === 'cashflow') return legacyApi.upsertCashFlowStatement(selectedFy, { fiscalYear: selectedFy, periodLabel: `FY${selectedFy}`, data });
      return legacyApi.upsertSocieStatement(selectedFy, { fiscalYear: selectedFy, periodLabel: `FY${selectedFy}`, data });
    },
    onSuccess: () => {
      setSaveMsg('Saved successfully');
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['legacy', tab, selectedFy] });
      setTimeout(() => setSaveMsg(''), 3000);
    },
    onError: (err: any) => {
      setSaveMsg(`Error: ${err?.message || 'Save failed'}`);
      setTimeout(() => setSaveMsg(''), 5000);
    },
  });

  const unlockMutation = useMutation({
    mutationFn: async () => {
      if (tab === 'income') return legacyApi.unlockIncomeStatement(selectedFy);
      if (tab === 'cashflow') return legacyApi.unlockCashFlowStatement(selectedFy);
      return legacyApi.unlockSocieStatement(selectedFy);
    },
    onSuccess: () => {
      setConfirmUnlock(null);
      queryClient.invalidateQueries({ queryKey: ['legacy', tab, selectedFy] });
    },
  });

  const updateOrgMutation = useMutation({
    mutationFn: (data: any) => legacyApi.updateOrg(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org'] });
      setSaveMsg('Settings saved');
      setTimeout(() => setSaveMsg(''), 3000);
    },
  });

  function handleNumberChange(key: string, value: string) {
    setIsForm((prev: any) => ({ ...prev, [key]: toKobo(value) }));
  }

  function renderSettingsTab() {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2"><Database className="w-5 h-5 text-indigo-500" /> Migration Settings</h3>
          <p className="text-sm text-slate-500 mb-6">
            Configure which fiscal year your organisation started using SkyBooks for live transaction entry.
            Years before this cutover will use manually-entered legacy figures for comparative reporting.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Live GL Start Fiscal Year</label>
              <select value={liveGl} onChange={e => setLiveGl(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="">— Not set —</option>
                {fiscalYears.map(fy => <option key={fy} value={fy}>{fy}</option>)}
              </select>
              <p className="text-xs text-slate-400 mt-1">The first fiscal year where real transactions were entered. Prior years use legacy snapshots.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Legacy System Name</label>
              <input type="text" value={legacyName} onChange={e => setLegacyName(e.target.value)} placeholder="e.g. QuickBooks, Sage"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <p className="text-xs text-slate-400 mt-1">Displayed as a badge alongside legacy figures (e.g. "Migrated from QuickBooks").</p>
            </div>
            <button onClick={() => updateOrgMutation.mutate({ liveGlStartFiscalYear: liveGl ? parseInt(liveGl) : null, legacySystemName: legacyName })}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors">
              {updateOrgMutation.isPending ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderIncomeStatementForm() {
    const isSaved = !!existingRecord;
    const isLocked = isSaved && locked;

    return (
      <div className="space-y-4">
        {isSaved && (
          <div className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 ${isLocked ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
            {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            {isLocked ? 'Locked — click "Unlock to Edit" to make changes' : 'Unlocked — editable'}
            {existingRecord?.data && <span className="ml-auto text-xs opacity-70">Entered at {new Date(existingRecord.enteredAt).toLocaleString()}</span>}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr><th className="text-left px-4 py-3">Line Item</th><th className="text-right px-4 py-3">Amount (NGN)</th></tr>
            </thead>
            <tbody>
              {IS_LINES.map(line => {
                const val = line.computed
                  ? (line.key === 'totalRevenue' ? computedTotalRevenue
                    : line.key === 'grossProfit' ? computedGrossProfit
                    : computedNetProfit)
                  : (isForm as any)[line.key] || 0;
                const isComputed = line.computed;
                return (
                  <tr key={line.key} className={`border-t border-slate-100 ${line.key === 'netProfit' ? 'bg-slate-50 font-bold' : ''}`}>
                    <td className={`px-4 py-2.5 ${line.key === 'totalRevenue' || line.key === 'grossProfit' ? 'font-semibold' : ''} ${line.key === 'netProfit' ? 'text-base' : 'text-slate-800'}`}>
                      {line.label}
                      {isComputed && <span className="ml-2 text-[10px] text-slate-400">(auto)</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {isComputed ? (
                        <span className={line.key === 'netProfit' && val < 0 ? 'text-red-600' : 'text-slate-800'}>
                          ₦{fmtKobo(val)}
                        </span>
                      ) : (
                        <input type="text" disabled={isLocked && !isEditing}
                          value={fmtKobo((isForm as any)[line.key] || 0)}
                          onChange={e => handleNumberChange(line.key, e.target.value)}
                          className={`text-right w-40 px-2 py-1 border border-slate-200 rounded-md text-sm ${isLocked && !isEditing ? 'bg-slate-50 text-slate-500' : 'bg-white'}`} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderCashFlowForm() {
    return (
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          <AlertTriangle className="w-5 h-5 inline mr-2" />
          Enter the final prior-year cash flow statement figures for FY{selectedFy}. This data is used for comparative reporting in pre-cutover periods.
        </div>
      </div>
    );
  }

  function renderSocieForm() {
    return (
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          <AlertTriangle className="w-5 h-5 inline mr-2" />
          Enter the statement of changes in equity for FY{selectedFy}. This feeds the comparative equity section.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <History className="w-6 h-6 text-indigo-500" /> Legacy / Migration Financial Statements
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Enter prior-year financial data from your previous accounting system for comparative reporting.
          </p>
        </div>
        {org?.legacySystemName && (
          <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold border border-indigo-200 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5" /> Migrated from {org.legacySystemName}
          </span>
        )}
      </div>

      {/* Save message */}
      {saveMsg && (
        <div className={`px-4 py-2 rounded-lg text-sm font-medium ${saveMsg.includes('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {saveMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {[
          { key: 'income' as TabType, label: 'Income Statement' },
          { key: 'cashflow' as TabType, label: 'Cash Flow' },
          { key: 'socie' as TabType, label: 'Changes in Equity' },
          { key: 'settings' as TabType, label: 'Settings' },
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setIsEditing(false); setConfirmUnlock(null); }}
            className={`flex-1 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Fiscal Year selector (not for settings tab) */}
      {tab !== 'settings' && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-slate-700">Fiscal Year:</label>
            <select value={selectedFy} onChange={e => { setSelectedFy(parseInt(e.target.value)); setIsEditing(false); }}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm">
              {fiscalYears.map(fy => <option key={fy} value={fy}>FY {fy}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            {existingRecord && locked && !isEditing && (
              <button onClick={() => setConfirmUnlock(`${tab}-${selectedFy}`)}
                className="px-3 py-1.5 text-sm font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-1.5">
                <Unlock className="w-4 h-4" /> Unlock to Edit
              </button>
            )}
            {existingRecord && !locked && (
              <button onClick={() => setIsEditing(!isEditing)}
                className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${isEditing ? 'bg-slate-100 text-slate-600' : 'bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100'}`}>
                {isEditing ? <Eye className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                {isEditing ? 'View Mode' : 'Edit'}
              </button>
            )}
            {(!existingRecord) && (
              <button onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 text-sm font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Enter Data
              </button>
            )}
            {(isEditing || (!locked && existingRecord)) && (
              <button onClick={() => {
                if (tab === 'income') {
                  saveMutation.mutate({
                    operatingRevenue: isForm.operatingRevenue,
                    otherOperatingIncome: isForm.otherOperatingIncome,
                    totalRevenue: computedTotalRevenue,
                    costOfSales: isForm.costOfSales,
                    grossProfit: computedGrossProfit,
                    staffCosts: isForm.staffCosts,
                    administrative: isForm.administrative,
                    sellingDistribution: isForm.sellingDistribution,
                    otherOperating: isForm.otherOperating,
                    financeIncome: isForm.financeIncome,
                    financeCosts: isForm.financeCosts,
                    taxExpense: isForm.taxExpense,
                    netProfit: computedNetProfit,
                  });
                } else {
                  saveMutation.mutate({});
                }
              }}
                className="px-4 py-1.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
                disabled={saveMutation.isPending}>
                <Save className="w-4 h-4" /> {saveMutation.isPending ? 'Saving...' : 'Save Statement'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Unlock confirmation modal */}
      {confirmUnlock && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setConfirmUnlock(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 mx-4" onClick={e => e.stopPropagation()}>
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-900 text-center mb-2">Unlock Legacy Statement?</h3>
            <p className="text-sm text-slate-500 text-center mb-6">
              This will allow editing of a previously locked historical statement. This data feeds comparative reports — 
              changing it may affect financial reporting. Are you sure?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmUnlock(null)} className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors">Cancel</button>
              <button onClick={() => unlockMutation.mutate()} className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors">
                {unlockMutation.isPending ? 'Unlocking...' : 'Unlock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {tab === 'settings' && renderSettingsTab()}
      {tab === 'income' && renderIncomeStatementForm()}
      {tab === 'cashflow' && renderCashFlowForm()}
      {tab === 'socie' && renderSocieForm()}
    </div>
  );
}
