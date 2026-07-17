import React, { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { budgetsApi, accountantApi, printWindow } from '../../lib/api';
import { AccountSearchSelect } from '../../components/ui/AccountSearchSelect';
import { PageLoader } from '../../components/ui/PageLoader';
import { Plus, X, Loader2, AlertCircle, CheckCircle2, Trash2, Download, Upload, Printer } from 'lucide-react';
import { exportToCsv } from '../../lib/csvTemplates';

function fmtNaira(v: number): string {
  return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

const PERIOD_LABELS: Record<string, string> = { monthly: 'Monthly', quarterly: 'Quarterly', annual: 'Annual' };
const STATUS_COLORS: Record<string, string> = { draft: 'bg-slate-100 text-slate-600', active: 'bg-emerald-100 text-emerald-700', archived: 'bg-amber-100 text-amber-700' };

export function BudgetsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: budgets, isLoading } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => budgetsApi.getBudgets(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => budgetsApi.deleteBudget(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budgets'] }),
  });

  function exportBudgetsCSV() {
    const today = new Date().toISOString().split('T')[0];
    const headers = ['Name', 'Fiscal Year', 'Period', 'Status'];
    const rows = budgetList.map((b: any) => [b.name||'', b.fiscalYear||'', b.period||'', b.status||'']);
    exportToCsv(`budgets_${today}.csv`, headers, rows);
  }

  const handlePrintPdf = () => {
    try {
      const list = budgetList;
      const rows = list.map((b: any) =>
        `<tr><td>${b.name||''}</td><td>${b.fiscalYear||''}</td><td>${b.period||''}</td><td class="c">${b.status||''}</td></tr>`
      ).join('');
      printWindow('Budgets', `<table><thead><tr><th>Name</th><th>Fiscal Year</th><th>Period</th><th class="c">Status</th></tr></thead><tbody>${rows||'<tr><td colspan="4" style="text-align:center;color:#94a3b8">No budgets</td></tr>'}</tbody></table>`, `${list.length} budgets`);
    } catch (err) {
      alert('Failed to open print window: ' + (err instanceof Error ? err.message : 'Unknown error'));
      console.error('Print error:', err);
    }
  };

  const budgetList = useMemo(() => {
    const list = Array.isArray(budgets) ? budgets : [];
    if (!dateFrom && !dateTo) return list;
    return list.filter((b: any) => {
      const d = b.createdAt ? b.createdAt.split('T')[0] : '';
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }, [budgets, dateFrom, dateTo]);

  const handleImport = async () => {
    if (!csvText.trim()) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const res = await accountantApi.importBudgetsCsv(csvText);
      setImportMsg({ type: 'success', text: res.message || 'Imported successfully.' });
      setCsvText('');
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      setTimeout(() => { setShowImport(false); setImportMsg(null); }, 1500);
    } catch (err: any) {
      setImportMsg({ type: 'error', text: err.response?.data?.error || err.message || 'Import failed.' });
    } finally { setImporting(false); }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">

        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-slate-200/80 text-slate-600 rounded-xl hover:bg-slate-50 transition-all duration-200">
            <Upload size={14} /> Import CSV
          </button>
          <button onClick={exportBudgetsCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-slate-200/80 text-slate-600 rounded-xl hover:bg-slate-50 transition-all duration-200">
            <Download size={14} /> CSV
          </button>
          <button onClick={handlePrintPdf} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-all duration-200"><Printer className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200"><Plus className="w-4 h-4" /> +New</button>
        </div>
      </div>

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => { setShowImport(false); setImportMsg(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 border border-slate-200/80 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold text-slate-900">Import Budgets</h2>
              <button onClick={() => { setShowImport(false); setImportMsg(null); }} className="text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-100 transition-all duration-200"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-slate-500">Upload a CSV file with columns: name, fiscalYear, period, line_accountCode, line_period (1-12), line_amount (NGN)</p>
            <input ref={fileRef} type="file" accept=".csv" onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => setCsvText(ev.target?.result as string);
              reader.readAsText(file);
            }} className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
            {csvText && (
              <div className="text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl">File loaded ({csvText.split(/\n/).length} rows)</div>
            )}
            {importMsg && (
              <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${importMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80' : 'bg-red-50 text-red-700 border border-red-100/80'}`}>
                {importMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {importMsg.text}
              </div>
            )}
            <div className="flex justify-end gap-3 shrink-0">
              <button onClick={() => { setShowImport(false); setImportMsg(null); }} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all duration-200 border border-slate-200/80">Cancel</button>
              <button onClick={handleImport} disabled={!csvText || importing}
                className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 transition-all duration-200">
                {importing ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Import
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm ? (
        <BudgetForm onDone={() => { setShowForm(false); queryClient.invalidateQueries({ queryKey: ['budgets'] }); }} />
      ) : isLoading ? (
        <PageLoader message="Loading budgets..." />
      ) : (
        <>
          <div className="flex gap-2 items-center">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow bg-white" />
            <span className="text-xs text-slate-400 font-medium">to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow bg-white" />
            <span className="text-xs text-slate-400 font-medium">{budgetList.length} budget{budgetList.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-3 text-left">Name</th>
                  <th className="px-3 py-3 text-left">Fiscal Year</th>
                  <th className="px-3 py-3 text-left">Period</th>
                  <th className="px-3 py-3 text-left">Status</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {budgetList.map((budget: any) => (
                  <tr key={budget.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{budget.name}</td>
                    <td className="px-4 py-3 text-slate-600">{budget.fiscalYear}</td>
                    <td className="px-4 py-3 text-slate-600">{PERIOD_LABELS[budget.period] || budget.period}</td>
                    <td className="px-3 py-3"><span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_COLORS[budget.status] === 'bg-slate-100 text-slate-600' ? 'border-slate-200/50 bg-slate-100 text-slate-600' : STATUS_COLORS[budget.status] === 'bg-emerald-100 text-emerald-700' ? 'border-emerald-100/50 bg-emerald-100 text-emerald-700' : 'border-amber-100/50 bg-amber-100 text-amber-700'}`}>{budget.status}</span></td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => deleteMutation.mutate(budget.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
                {budgetList.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No budgets created yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function BudgetForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());
  const [period, setPeriod] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');
  const [lines, setLines] = useState([{ accountId: '', period: 1, amount: 0 }]);
  const [error, setError] = useState('');

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountantApi.getAccounts(),
  });

  const mutation = useMutation({
    mutationFn: (data: any) => budgetsApi.createBudget(data),
    onSuccess: onDone,
    onError: (err: any) => setError(err.response?.data?.error || err.message || 'Failed to create.'),
  });

  const addLine = () => setLines([...lines, { accountId: '', period: 1, amount: 0 }]);
  const removeLine = (i: number) => { if (lines.length > 1) setLines(lines.filter((_, idx) => idx !== i)); };
  const updateLine = (i: number, field: string, value: any) => {
    setLines(lines.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name) { setError('Budget name is required.'); return; }
    mutation.mutate({
      name,
      fiscalYear,
      period,
      lines: lines.filter(l => l.accountId).map(l => ({
        accountId: l.accountId,
        period: Number(l.period),
        amount: Math.round(Number(l.amount || 0) * 100),
      })),
    });
  };

  const accList = Array.isArray(accounts) ? accounts : [];

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
      {error && <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100/80"><AlertCircle className="w-4 h-4" /> {error}</div>}
      <div className="grid grid-cols-3 gap-4">
        <div><label className="text-xs font-semibold text-slate-500 uppercase">Name</label><input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow mt-1" /></div>
        <div><label className="text-xs font-semibold text-slate-500 uppercase">Fiscal Year</label><input type="number" value={fiscalYear} onChange={e => setFiscalYear(Number(e.target.value))} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow mt-1" /></div>
        <div><label className="text-xs font-semibold text-slate-500 uppercase">Period</label>
          <select value={period} onChange={e => setPeriod(e.target.value as any)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow mt-1">
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annual">Annual</option>
          </select>
        </div>
      </div>

      <div className="bg-slate-50 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase">Budget Lines</span>
          <button type="button" onClick={addLine} className="text-xs text-blue-600 hover:text-blue-800 font-semibold">+ Add Line</button>
        </div>
        {lines.map((line, i) => (
          <div key={i} className="flex gap-2 items-start">
            <AccountSearchSelect
              accounts={accList}
              value={line.accountId}
              onChange={id => updateLine(i, 'accountId', id)}
              placeholder="Select account"
            />
            <input type="number" value={line.period} onChange={e => updateLine(i, 'period', e.target.value)} min={1} max={12} className="w-20 px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" placeholder="Period" />
            <input type="number" value={line.amount || ''} onChange={e => updateLine(i, 'amount', e.target.value)} className="w-32 px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" placeholder="Amount (₦)" />
            {lines.length > 1 && <button type="button" onClick={() => removeLine(i)} className="p-1.5 text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button>}
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all duration-200 border border-slate-200/80">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 transition-all duration-200">
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Create Budget
        </button>
      </div>
    </form>
  );
}
