import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { budgetsApi, accountantApi, printWindow } from '../../lib/api';
import { AccountSearchSelect } from '../../components/ui/AccountSearchSelect';
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
    const rows = (Array.isArray(budgets) ? budgets : []).map((b: any) => [b.name||'', b.fiscalYear||'', b.period||'', b.status||'']);
    exportToCsv(`budgets_${today}.csv`, headers, rows);
  }

  const handlePrintPdf = () => {
    try {
      const list = Array.isArray(budgets) ? budgets : [];
      const rows = list.map((b: any) =>
        `<tr><td>${b.name||''}</td><td>${b.fiscalYear||''}</td><td>${b.period||''}</td><td class="c">${b.status||''}</td></tr>`
      ).join('');
      printWindow('Budgets', `<table><thead><tr><th>Name</th><th>Fiscal Year</th><th>Period</th><th class="c">Status</th></tr></thead><tbody>${rows||'<tr><td colspan="4" style="text-align:center;color:#94a3b8">No budgets</td></tr>'}</tbody></table>`, `${list.length} budgets`);
    } catch (err) {
      alert('Failed to open print window: ' + (err instanceof Error ? err.message : 'Unknown error'));
      console.error('Print error:', err);
    }
  };

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
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Budgets</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
            <Upload size={14} /> Import CSV
          </button>
          <button onClick={exportBudgetsCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
            <Download size={14} /> CSV
          </button>
          <button onClick={handlePrintPdf} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700"><Printer className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"><Plus className="w-4 h-4" /> New Budget</button>
        </div>
      </div>

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setShowImport(false); setImportMsg(null); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Import Budgets</h2>
              <button onClick={() => { setShowImport(false); setImportMsg(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-slate-500">Upload a CSV file with columns: name, fiscalYear, period, line_accountCode, line_period (1-12), line_amount (NGN)</p>
            <input ref={fileRef} type="file" accept=".csv" onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => setCsvText(ev.target?.result as string);
              reader.readAsText(file);
            }} className="w-full text-sm" />
            {csvText && (
              <div className="text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">File loaded ({csvText.split(/\n/).length} rows)</div>
            )}
            {importMsg && (
              <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${importMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {importMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {importMsg.text}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowImport(false); setImportMsg(null); }} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
              <button onClick={handleImport} disabled={!csvText || importing}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {importing ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Import
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm ? (
        <BudgetForm onDone={() => { setShowForm(false); queryClient.invalidateQueries({ queryKey: ['budgets'] }); }} />
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Fiscal Year</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Period</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(budgets) ? budgets : []).map((budget: any) => (
                <tr key={budget.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{budget.name}</td>
                  <td className="px-4 py-3 text-slate-600">{budget.fiscalYear}</td>
                  <td className="px-4 py-3 text-slate-600">{PERIOD_LABELS[budget.period] || budget.period}</td>
                  <td className="px-4 py-3"><span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${STATUS_COLORS[budget.status] || 'bg-slate-100 text-slate-600'}`}>{budget.status}</span></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => deleteMutation.mutate(budget.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {(!budgets || budgets.length === 0) && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No budgets created yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
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
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
      {error && <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm"><AlertCircle className="w-4 h-4" /> {error}</div>}
      <div className="grid grid-cols-3 gap-4">
        <div><label className="text-xs font-semibold text-slate-500 uppercase">Name</label><input value={name} onChange={e => setName(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm mt-1" /></div>
        <div><label className="text-xs font-semibold text-slate-500 uppercase">Fiscal Year</label><input type="number" value={fiscalYear} onChange={e => setFiscalYear(Number(e.target.value))} className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm mt-1" /></div>
        <div><label className="text-xs font-semibold text-slate-500 uppercase">Period</label>
          <select value={period} onChange={e => setPeriod(e.target.value as any)} className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm mt-1">
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annual">Annual</option>
          </select>
        </div>
      </div>

      <div className="bg-slate-50 rounded-lg p-4 space-y-3">
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
            <input type="number" value={line.period} onChange={e => updateLine(i, 'period', e.target.value)} min={1} max={12} className="w-20 border border-slate-300 rounded-lg px-3 py-1.5 text-sm" placeholder="Period" />
            <input type="number" value={line.amount || ''} onChange={e => updateLine(i, 'amount', e.target.value)} className="w-32 border border-slate-300 rounded-lg px-3 py-1.5 text-sm" placeholder="Amount (₦)" />
            {lines.length > 1 && <button type="button" onClick={() => removeLine(i)} className="p-1.5 text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button>}
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Create Budget
        </button>
      </div>
    </form>
  );
}
