import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { journalsApi, accountantApi } from '../../lib/api';
import { AccountSearchSelect } from '../../components/ui/AccountSearchSelect';
import { Plus, X, Loader2, AlertCircle, CheckCircle2, Eye, Download, Upload } from 'lucide-react';
import { exportToCsv } from '../../lib/csvTemplates';

function fmtNaira(v: number): string {
  return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function JournalsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: journals, isLoading } = useQuery({
    queryKey: ['journals'],
    queryFn: () => journalsApi.getJournals(),
  });

  function exportJournalsCSV() {
    const today = new Date().toISOString().split('T')[0];
    const headers = ['Entry #', 'Date', 'Description', 'Source'];
    const rows = (Array.isArray(journals) ? journals : []).map((e: any) => [e.entryNumber||'', e.date ? new Date(e.date).toLocaleDateString('en-GB') : '', e.description||'', e.source||'']);
    exportToCsv(`manual_journals_${today}.csv`, headers, rows);
  }

  const handleDownloadPdf = async () => {
    try {
      const blob = await accountantApi.getManualJournalsPdf();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      console.error('PDF download failed', err);
    }
  };

  const handleImport = async () => {
    if (!csvText.trim()) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const res = await accountantApi.importJournalsCsv(csvText);
      setImportMsg({ type: 'success', text: res.message || 'Imported successfully.' });
      setCsvText('');
      queryClient.invalidateQueries({ queryKey: ['journals'] });
      setTimeout(() => { setShowImport(false); setImportMsg(null); }, 1500);
    } catch (err: any) {
      setImportMsg({ type: 'error', text: err.response?.data?.error || err.message || 'Import failed.' });
    } finally { setImporting(false); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Manual Journals</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
            <Upload size={14} /> Import CSV
          </button>
          <button onClick={exportJournalsCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
            <Download size={14} /> CSV
          </button>
          <button onClick={handleDownloadPdf} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"><Download className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={() => { setShowForm(true); setViewId(null); }} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"><Plus className="w-4 h-4" /> New Journal Entry</button>
        </div>
      </div>

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setShowImport(false); setImportMsg(null); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Import Journal Entries</h2>
              <button onClick={() => { setShowImport(false); setImportMsg(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-slate-500">Upload a CSV file with columns: date, entryNumber, description, reference, line_accountCode, line_debit (NGN), line_credit (NGN), line_description</p>
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

      {viewId ? (
        <JournalDetailView journalId={viewId} onBack={() => setViewId(null)} />
      ) : showForm ? (
        <JournalForm onDone={() => { setShowForm(false); queryClient.invalidateQueries({ queryKey: ['journals'] }); }} />
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Entry #</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Description</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Source</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(journals) ? journals : []).map((entry: any) => (
                <tr key={entry.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-medium text-slate-800">{entry.entryNumber}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(entry.date)}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{entry.description || '—'}</td>
                  <td className="px-4 py-3 text-right"><span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-600 capitalize">{entry.source}</span></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setViewId(entry.id)} className="text-blue-600 hover:text-blue-800"><Eye className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {(!journals || journals.length === 0) && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No journal entries yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function JournalDetailView({ journalId, onBack }: { journalId: string; onBack: () => void }) {
  const { data: entry, isLoading } = useQuery({
    queryKey: ['journal', journalId],
    queryFn: () => journalsApi.getJournal(journalId),
  });

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (!entry) return <div className="text-center py-20 text-slate-400">Journal entry not found.</div>;

  const lines = entry.lines || [];
  const totalDebits = lines.reduce((s: number, l: any) => s + l.debitAmount, 0);
  const totalCredits = lines.reduce((s: number, l: any) => s + l.creditAmount, 0);

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-blue-600 hover:text-blue-800">&larr; Back to journals</button>
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div><span className="text-xs font-semibold text-slate-500 uppercase">Entry #</span><p className="text-sm font-medium text-slate-800 font-mono">{entry.entryNumber}</p></div>
          <div><span className="text-xs font-semibold text-slate-500 uppercase">Date</span><p className="text-sm font-medium text-slate-800">{fmtDate(entry.date)}</p></div>
          <div><span className="text-xs font-semibold text-slate-500 uppercase">Source</span><p className="text-sm font-medium text-slate-800 capitalize">{entry.source}</p></div>
          {entry.description && <div className="col-span-3"><span className="text-xs font-semibold text-slate-500 uppercase">Description</span><p className="text-sm text-slate-700">{entry.description}</p></div>}
          {entry.reference && <div className="col-span-3"><span className="text-xs font-semibold text-slate-500 uppercase">Reference</span><p className="text-sm text-slate-700">{entry.reference}</p></div>}
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Account</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Description</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600">Debit</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600">Credit</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line: any, i: number) => (
              <tr key={line.id || i} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-800">{line.accountId}</td>
                <td className="px-4 py-3 text-slate-600">{line.description || '—'}</td>
                <td className="px-4 py-3 text-right text-slate-800">{line.debitAmount > 0 ? fmtNaira(line.debitAmount) : '—'}</td>
                <td className="px-4 py-3 text-right text-slate-800">{line.creditAmount > 0 ? fmtNaira(line.creditAmount) : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-semibold">
            <tr>
              <td colSpan={2} className="px-4 py-3 text-slate-800">Totals</td>
              <td className="px-4 py-3 text-right text-slate-800">{fmtNaira(totalDebits)}</td>
              <td className="px-4 py-3 text-right text-slate-800">{fmtNaira(totalCredits)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function JournalForm({ onDone }: { onDone: () => void }) {
  const [entryNumber, setEntryNumber] = useState(`JE-${Date.now()}`);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState([{ accountId: '', debitAmount: 0, creditAmount: 0, description: '' }]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountantApi.getAccounts(),
  });

  const mutation = useMutation({
    mutationFn: (data: any) => journalsApi.createJournal(data),
    onSuccess: () => { setSuccess('Journal entry created.'); setTimeout(onDone, 1000); },
    onError: (err: any) => setError(err.response?.data?.error || err.message || 'Failed to create.'),
  });

  const addLine = () => setLines([...lines, { accountId: '', debitAmount: 0, creditAmount: 0, description: '' }]);
  const removeLine = (i: number) => { if (lines.length > 1) setLines(lines.filter((_, idx) => idx !== i)); };
  const updateLine = (i: number, field: string, value: any) => {
    setLines(lines.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  };

  const totalDebits = lines.reduce((s, l) => s + Number(l.debitAmount || 0), 0);
  const totalCredits = lines.reduce((s, l) => s + Number(l.creditAmount || 0), 0);
  const isBalanced = totalDebits === totalCredits;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isBalanced) { setError('Total debits must equal total credits.'); return; }
    if (!entryNumber) { setError('Entry number is required.'); return; }
    mutation.mutate({
      entryNumber,
      date,
      description: description || null,
      reference: reference || null,
      lines: lines.map(l => ({
        accountId: l.accountId,
        debitAmount: Math.round(Number(l.debitAmount || 0) * 100),
        creditAmount: Math.round(Number(l.creditAmount || 0) * 100),
        description: l.description || null,
      })),
    });
  };

  const accList = Array.isArray(accounts) ? accounts : [];

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
      {success && <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm"><CheckCircle2 className="w-4 h-4" /> {success}</div>}
      {error && <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm"><AlertCircle className="w-4 h-4" /> {error}</div>}

      <div className="grid grid-cols-3 gap-4">
        <div><label className="text-xs font-semibold text-slate-500 uppercase">Entry #</label><input value={entryNumber} onChange={e => setEntryNumber(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm mt-1" /></div>
        <div><label className="text-xs font-semibold text-slate-500 uppercase">Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm mt-1" /></div>
        <div><label className="text-xs font-semibold text-slate-500 uppercase">Reference</label><input value={reference} onChange={e => setReference(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm mt-1" /></div>
      </div>
      <div><label className="text-xs font-semibold text-slate-500 uppercase">Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm mt-1" /></div>

      <div className="bg-slate-50 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase">Journal Lines</span>
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
            <input placeholder="Debit (₦)" type="number" value={line.debitAmount || ''} onChange={e => updateLine(i, 'debitAmount', e.target.value)} className="w-32 border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
            <input placeholder="Credit (₦)" type="number" value={line.creditAmount || ''} onChange={e => updateLine(i, 'creditAmount', e.target.value)} className="w-32 border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
            <input placeholder="Description" value={line.description} onChange={e => updateLine(i, 'description', e.target.value)} className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
            {lines.length > 1 && <button type="button" onClick={() => removeLine(i)} className="p-1.5 text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button>}
          </div>
        ))}
        <div className={`flex items-center justify-end gap-3 text-sm font-semibold ${isBalanced ? 'text-emerald-600' : 'text-red-600'}`}>
          <span>Debits: {fmtNaira(totalDebits * 100)}</span>
          <span>Credits: {fmtNaira(totalCredits * 100)}</span>
          {isBalanced ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Create Journal Entry
        </button>
      </div>
    </form>
  );
}
