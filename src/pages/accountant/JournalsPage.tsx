import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { journalsApi, accountantApi, printWindow, orgApi } from '../../lib/api';
import { AccountSearchSelect } from '../../components/ui/AccountSearchSelect';
import { PageLoader } from '../../components/ui/PageLoader';
import { Plus, X, Loader2, AlertCircle, CheckCircle2, Eye, Download, Upload, Printer, ExternalLink, ArrowLeft, RotateCcw } from 'lucide-react';
import { exportToCsv } from '../../lib/csvTemplates';

function fmtNaira(v: number): string {
  return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function fmtNairaRaw(v: number): string {
  return `₦${v.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function sourceDocLink(source: string, sourceId?: string): string | null {
  if (!sourceId) return null;
  switch (source) {
    case 'invoice': return `/sales/invoices/${sourceId}`;
    case 'bill': return `/purchases/bills/${sourceId}`;
    case 'expense': return `/purchases/expenses`;
    case 'payment': return `/purchases/payments-made`;
    case 'credit_note': return `/sales/credit-notes`;
    case 'vendor_credit': return `/purchases/vendor-credits`;
    default: return null;
  }
}

export function JournalsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const entryParam = searchParams.get('entry');
  const [showForm, setShowForm] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: journals, isLoading } = useQuery({
    queryKey: ['journals', dateFrom, dateTo],
    queryFn: () => journalsApi.getJournals({ from: dateFrom || undefined, to: dateTo || undefined }),
  });

  const filteredJournals = React.useMemo(() => {
    const list = Array.isArray(journals) ? journals : [];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((e: any) => {
      const entryNum = (e.entryNumber || '').toLowerCase();
      const desc = (e.description || '').toLowerCase();
      const source = (e.source || '').toLowerCase();
      return entryNum.includes(q) || desc.includes(q) || source.includes(q);
    });
  }, [journals, search]);

  useEffect(() => {
    if (entryParam && Array.isArray(journals)) {
      const found = journals.find((e: any) => e.entryNumber === entryParam);
      if (found) setViewId(found.id);
    }
  }, [entryParam, journals]);

  function exportJournalsCSV() {
    const today = new Date().toISOString().split('T')[0];
    const headers = ['Entry #', 'Date', 'Description', 'Source'];
    const rows = (Array.isArray(journals) ? journals : []).map((e: any) => [e.entryNumber||'', e.date ? new Date(e.date).toLocaleDateString('en-GB') : '', e.description||'', e.source||'']);
    exportToCsv(`manual_journals_${today}.csv`, headers, rows);
  }

  const handlePrintPdf = () => {
    try {
      const list = Array.isArray(journals) ? journals : [];
      const rows = list.map((e: any) =>
        `<tr><td>${e.entryNumber||''}</td><td>${e.date ? new Date(e.date).toLocaleDateString('en-GB') : ''}</td><td>${e.description||''}</td><td>${e.source||''}</td></tr>`
      ).join('');
      printWindow('Manual Journals', `<table><thead><tr><th>Entry #</th><th>Date</th><th>Description</th><th>Source</th></tr></thead><tbody>${rows||'<tr><td colspan="4" style="text-align:center;color:#94a3b8">No entries</td></tr>'}</tbody></table>`, `${list.length} entries`);
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
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Manual Journals</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-slate-200/80 text-slate-600 rounded-xl hover:bg-slate-50 transition-all duration-200">
            <Upload size={14} /> Import CSV
          </button>
          <button onClick={exportJournalsCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-slate-200/80 text-slate-600 rounded-xl hover:bg-slate-50 transition-all duration-200">
            <Download size={14} /> CSV
          </button>
          <button onClick={handlePrintPdf} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-all duration-200"><Printer className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={() => { setShowForm(true); setViewId(null); }} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200"><Plus className="w-4 h-4" /> New Journal Entry</button>
        </div>
      </div>

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => { setShowImport(false); setImportMsg(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 border border-slate-200/80 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold text-slate-900">Import Journal Entries</h2>
              <button onClick={() => { setShowImport(false); setImportMsg(null); }} className="text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-100 transition-all duration-200"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-slate-500">Upload a CSV file with columns: date, entryNumber, description, reference, line_accountCode, line_debit (NGN), line_credit (NGN), line_description</p>
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

      {viewId ? (
        <JournalDetailView journalId={viewId} onBack={() => setViewId(null)} />
      ) : showForm ? (
        <JournalForm onDone={() => { setShowForm(false); queryClient.invalidateQueries({ queryKey: ['journals'] }); }} />
      ) : isLoading ? (
        <PageLoader message="Loading journals..." />
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-center gap-3">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                type="text"
                placeholder="Search by entry #, description, source..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500">From:</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500">To:</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
            </div>
            {(search || dateFrom || dateTo) && (
              <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); }} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1">Clear</button>
            )}
            <span className="text-xs text-slate-400 font-medium whitespace-nowrap">{filteredJournals.length} entr{filteredJournals.length !== 1 ? 'ies' : 'y'}</span>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-3 text-left">Entry #</th>
                <th className="px-3 py-3 text-left">Date</th>
                <th className="px-3 py-3 text-left">Narration</th>
                <th className="px-3 py-3 text-right">Debit</th>
                <th className="px-3 py-3 text-right">Credit</th>
                <th className="px-3 py-3 text-center">Status</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredJournals.map((entry: any) => {
                const tDebits = Number(entry.totalDebits || 0);
                const tCredits = Number(entry.totalCredits || 0);
                const balanced = tDebits === tCredits;
                return (
                <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50">
                  <td className="px-4 py-3 font-mono font-medium text-slate-800">{entry.entryNumber}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(entry.date)}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{entry.description || '—'}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium tabular-nums text-slate-800">{tDebits > 0 ? fmtNaira(tDebits) : '—'}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium tabular-nums text-slate-800">{tCredits > 0 ? fmtNaira(tCredits) : '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${balanced ? 'border border-emerald-200/50 bg-emerald-50 text-emerald-700' : 'border border-red-200/50 bg-red-50 text-red-700'}`}>
                      {balanced ? 'Balanced' : 'Unbalanced'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setViewId(entry.id)} className="text-blue-600 hover:text-blue-800"><Eye className="w-4 h-4" /></button>
                  </td>
                </tr>
              );})}
              {filteredJournals.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No journal entries found.</td></tr>
              )}
            </tbody>
            {filteredJournals.length > 0 && (
            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
              <tr className="font-bold text-sm">
                <td colSpan={3} className="px-5 py-3.5 text-right text-slate-700 uppercase tracking-wide">TOTAL</td>
                <td className="px-5 py-3.5 text-right font-mono tabular-nums text-slate-900">{fmtNaira(filteredJournals.reduce((s: number, e: any) => s + Number(e.totalDebits || 0), 0))}</td>
                <td className="px-5 py-3.5 text-right font-mono tabular-nums text-slate-900">{fmtNaira(filteredJournals.reduce((s: number, e: any) => s + Number(e.totalCredits || 0), 0))}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
            )}
          </table>
        </div>
        </>
      )}
    </div>
  );
}

function JournalDetailView({ journalId, onBack }: { journalId: string; onBack: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: entry, isLoading } = useQuery({
    queryKey: ['journal', journalId],
    queryFn: () => journalsApi.getJournal(journalId),
  });
  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountantApi.getAccounts(),
  });
  const { data: orgData } = useQuery({
    queryKey: ['org'],
    queryFn: () => orgApi.getOrg(),
  });

  const reverseMutation = useMutation({
    mutationFn: () => journalsApi.reverseJournal(journalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journals'] });
      queryClient.invalidateQueries({ queryKey: ['journal', journalId] });
    },
  });

  if (isLoading) return <PageLoader message="Loading journal entry..." />;
  if (!entry) return <div className="text-center py-20 text-slate-400">Journal entry not found.</div>;

  const lines = entry.lines || [];
  const totalDebits = lines.reduce((s: number, l: any) => s + Number(l.debitAmount || 0), 0);
  const totalCredits = lines.reduce((s: number, l: any) => s + Number(l.creditAmount || 0), 0);
  const isBalanced = totalDebits === totalCredits;
  const diff = Math.abs(totalDebits - totalCredits);

  const accMap = new Map((Array.isArray(accountsData) ? accountsData : []).map((a: any) => [a.id, a]));

  const handleReverse = () => {
    if (!window.confirm('Reverse this journal entry? This will create a reversal entry with debits and credits swapped.')) return;
    reverseMutation.mutate();
  };

  const handlePrintPdf = () => {
    const org = orgData || {};
    const orgName = org.name || '';
    const orgAddr = org.address ? `<p style="margin:0;font-size:11px;color:#475569">${org.address}</p>` : '';
    const orgPhone = org.phone || '';
    const orgEmail = org.email || '';
    const orgWebsite = org.website || '';
    const orgLogo = org.logoUrl ? `<img src="${org.logoUrl}" style="max-height:60px;max-width:200px;object-fit:contain" />` : '';
    const contactInfo = [orgPhone, orgEmail, orgWebsite].filter(Boolean).join(' | ');

    const rows = lines.map((l: any) => {
      const acc = accMap.get(l.accountId);
      const code = acc?.code || '';
      const name = acc?.name || l.accountId;
      return `<tr>
        <td>${code}</td>
        <td>${name}</td>
        <td>${l.description || ''}</td>
        <td style="text-align:right;font-family:monospace">${l.debitAmount > 0 ? fmtNaira(l.debitAmount) : ''}</td>
        <td style="text-align:right;font-family:monospace">${l.creditAmount > 0 ? fmtNaira(l.creditAmount) : ''}</td>
      </tr>`;
    }).join('');
    const balancedText = totalDebits === totalCredits
      ? '<span style="color:#059669;font-weight:700">✓ Balanced</span>'
      : `<span style="color:#dc2626;font-weight:700">✗ OUT OF BALANCE by ${fmtNaira(diff)}</span>`;
    printWindow(
      `Journal Entry ${entry.entryNumber}`,
      `<div style="text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #e2e8f0">
        ${orgLogo}
        <h1 style="margin:4px 0;font-size:18px;color:#0f172a">${orgName}</h1>
        ${orgAddr}
        <p style="margin:2px 0;font-size:11px;color:#64748b">${contactInfo}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Account Code</th>
            <th>Account Name</th>
            <th>Description</th>
            <th style="text-align:right">Debit (₦)</th>
            <th style="text-align:right">Credit (₦)</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:#94a3b8">No lines</td></tr>'}</tbody>
        <tfoot>
          <tr style="font-weight:700;background:#f1f5f9">
            <td colspan="3" style="text-align:right">TOTAL</td>
            <td style="text-align:right;font-family:monospace">${fmtNaira(totalDebits)}</td>
            <td style="text-align:right;font-family:monospace">${fmtNaira(totalCredits)}</td>
          </tr>
          <tr>
            <td colspan="5" style="text-align:center;padding-top:8px">${balancedText}</td>
          </tr>
        </tfoot>
      </table>
      <p style="margin-top:12px;font-size:11px;color:#64748b">Entry #${entry.entryNumber} | ${fmtDate(entry.date)} | ${entry.source}</p>`,
      `Journal Entry ${entry.entryNumber}`
    );
  };

  return (
    <div className="space-y-5">
      {/* Back button */}
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to journals
      </button>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200/80 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-bold text-slate-900 font-mono">{entry.entryNumber}</h2>
              {entry.isReversed && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-red-200/50 bg-red-50 text-red-700">
                  <RotateCcw className="w-3 h-3" /> Reversed
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">{entry.description || 'No description'}</p>
          </div>
          {entry.source !== 'manual' && entry.sourceId && (
            <a
              href={sourceDocLink(entry.source, entry.sourceId) || '#'}
              onClick={(e) => { e.preventDefault(); const p = sourceDocLink(entry.source, entry.sourceId); if (p) navigate(p); }}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-indigo-200/50 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-all duration-200 shrink-0"
            ><ExternalLink className="w-3.5 h-3.5" /> View Source</a>
          )}
        </div>
        <div className="grid grid-cols-4 gap-6 px-6 py-4 bg-slate-50/50 text-sm border-b border-slate-200/80">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">Date</span>
            <span className="text-slate-800 font-medium">{fmtDate(entry.date)}</span>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">Source</span>
            <span className="text-slate-800 font-medium capitalize">{entry.source.replace(/_/g, ' ')}</span>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">Reference</span>
            <span className="text-slate-800 font-medium">{entry.reference || '—'}</span>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">Created</span>
            <span className="text-slate-800 font-medium">{fmtDate(entry.createdAt || entry.date)}</span>
          </div>
        </div>
      </div>

      {/* Lines table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-3 text-left">Account Code</th>
                <th className="px-3 py-3 text-left">Account Name</th>
                <th className="px-3 py-3 text-left">Description</th>
                <th className="px-3 py-3 text-right w-44">Debit (₦)</th>
                <th className="px-3 py-3 text-right w-44">Credit (₦)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((line: any, i: number) => {
                const acc = accMap.get(line.accountId);
                const code = acc?.code || '';
                const name = acc?.name || line.accountId;
                return (
                  <tr key={line.id || i} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{code}</td>
                    <td className="px-5 py-3 font-medium text-slate-800">{name}</td>
                    <td className="px-5 py-3 text-slate-600 max-w-[240px] truncate">{line.description || '—'}</td>
                    <td className="px-5 py-3 text-right font-mono font-medium tabular-nums text-slate-800">
                      {line.debitAmount > 0 ? fmtNaira(line.debitAmount) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-medium tabular-nums text-slate-800">
                      {line.creditAmount > 0 ? fmtNaira(line.creditAmount) : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
              <tr className="font-bold text-sm">
                <td colSpan={3} className="px-5 py-3.5 text-right text-slate-700 uppercase tracking-wide">TOTAL</td>
                <td className="px-5 py-3.5 text-right font-mono tabular-nums text-slate-900">{fmtNaira(totalDebits)}</td>
                <td className="px-5 py-3.5 text-right font-mono tabular-nums text-slate-900">{fmtNaira(totalCredits)}</td>
              </tr>
              <tr className="border-t border-slate-100">
                <td colSpan={5} className="px-5 py-3 text-center">
                  <div className="flex items-center justify-center gap-2 text-sm">
                    {isBalanced ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="font-semibold text-emerald-700">Balanced</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500">Debits = Credits</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <span className="font-semibold text-red-600">OUT OF BALANCE</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-red-500">Difference: {fmtNairaRaw(diff)}</span>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!entry.isReversed && entry.source === 'manual' && (
            <button
              onClick={handleReverse}
              disabled={reverseMutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200/80 rounded-xl transition-all duration-200 disabled:opacity-50"
            >{reverseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Reverse Entry</button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handlePrintPdf} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all duration-200">
            <Printer className="w-4 h-4" /> Print / PDF
          </button>
          <button onClick={onBack} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all duration-200">
            Close
          </button>
        </div>
      </div>

      {/* Reversal error */}
      {reverseMutation.isError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-200/80">
          <AlertCircle className="w-4 h-4 shrink-0" /> {(reverseMutation.error as any)?.response?.data?.error || (reverseMutation.error as any)?.message || 'Reverse failed.'}
        </div>
      )}
      {reverseMutation.isSuccess && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm border border-emerald-200/80">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> Entry reversed successfully.
        </div>
      )}
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
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
      {success && <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm border border-emerald-200/80"><CheckCircle2 className="w-4 h-4" /> {success}</div>}
      {error && <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100/80"><AlertCircle className="w-4 h-4" /> {error}</div>}

      <div className="grid grid-cols-3 gap-4">
        <div><label className="text-xs font-semibold text-slate-500 uppercase">Entry #</label><input value={entryNumber} onChange={e => setEntryNumber(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow mt-1" /></div>
        <div><label className="text-xs font-semibold text-slate-500 uppercase">Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow mt-1" /></div>
        <div><label className="text-xs font-semibold text-slate-500 uppercase">Reference</label><input value={reference} onChange={e => setReference(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow mt-1" /></div>
      </div>
      <div><label className="text-xs font-semibold text-slate-500 uppercase">Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow mt-1" /></div>

      <div className="bg-slate-50 rounded-xl p-4 space-y-3">
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
            <input placeholder="Debit (₦)" type="number" value={line.debitAmount || ''} onChange={e => updateLine(i, 'debitAmount', e.target.value)} className="w-32 px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
            <input placeholder="Credit (₦)" type="number" value={line.creditAmount || ''} onChange={e => updateLine(i, 'creditAmount', e.target.value)} className="w-32 px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
            <input placeholder="Description" value={line.description} onChange={e => updateLine(i, 'description', e.target.value)} className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
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
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all duration-200 border border-slate-200/80">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 transition-all duration-200">
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Create Journal Entry
        </button>
      </div>
    </form>
  );
}
