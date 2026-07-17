import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { journalsApi, accountantApi, printWindow, orgApi } from '../../lib/api';
import { AccountSearchSelect } from '../../components/ui/AccountSearchSelect';
import { PageLoader } from '../../components/ui/PageLoader';
import { Plus, X, Loader2, AlertCircle, CheckCircle2, Eye, Download, Upload, Printer, ExternalLink, ArrowLeft, RotateCcw, Trash2, Pencil, FileText } from 'lucide-react';
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

const STATUS_STYLE: Record<string, { bg: string; text: string; border: string; label: string }> = {
  draft: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200/60', label: 'Draft' },
  pending_review: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200/60', label: 'Pending Review' },
  approved: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200/60', label: 'Approved' },
  posted: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200/60', label: 'Posted' },
  locked: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200/60', label: 'Locked' },
  reversed: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200/60', label: 'Reversed' },
  cancelled: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200/60', label: 'Cancelled' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] || { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200/60', label: status };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${s.bg} ${s.text} ${s.border}`}>
      {s.label}
    </span>
  );
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
  const accountIdParam = searchParams.get('accountId');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateFromInput, setDateFromInput] = useState('');
  const [dateToInput, setDateToInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: journals, isLoading } = useQuery({
    queryKey: ['journals', dateFrom, dateTo, accountIdParam],
    queryFn: () => journalsApi.getJournals({ from: dateFrom || undefined, to: dateTo || undefined, accountId: accountIdParam || undefined }),
  });

  const filteredJournals = React.useMemo(() => {
    const list = Array.isArray(journals) ? journals : [];
    return list.filter((e: any) => {
      if (search) {
        const q = search.toLowerCase();
        const entryNum = (e.entryNumber || '').toLowerCase();
        const desc = (e.description || '').toLowerCase();
        const source = (e.source || '').toLowerCase();
        if (!entryNum.includes(q) && !desc.includes(q) && !source.includes(q)) return false;
      }
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      return true;
    });
  }, [journals, search, statusFilter]);

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

  const { data: orgData } = useQuery({ queryKey: ['org'], queryFn: orgApi.getOrg });

  const handlePrintPdf = () => {
    try {
      const list = Array.isArray(journals) ? journals : [];
      const org = (orgData as any)?.data || orgData || {};
      const orgName = org.name || '';
      const orgAddr = org.address ? `<p style="margin:0;font-size:11px;color:#475569">${org.address}</p>` : '';
      const orgPhone = org.phone || '';
      const orgEmail = org.email || '';
      const orgWebsite = org.website || '';
      const orgLogo = org.logoUrl ? `<img src="${org.logoUrl}" style="max-height:60px;max-width:200px;object-fit:contain" />` : '';
      const contactInfo = [orgPhone, orgEmail, orgWebsite].filter(Boolean).join(' | ');

      const rows = list.map((e: any) => {
        const tDebits = Number(e.totalDebits || 0);
        const tCredits = Number(e.totalCredits || 0);
        const balanced = tDebits === tCredits;
        return `<tr>
          <td style="padding:8px 12px;font-family:monospace;font-size:12px;border-bottom:1px solid #e2e8f0">${e.entryNumber||''}</td>
          <td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e2e8f0">${e.date ? new Date(e.date).toLocaleDateString('en-GB') : ''}</td>
          <td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e2e8f0">${e.description||''}</td>
          <td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e2e8f0">${e.source||''}</td>
          <td style="padding:8px 12px;font-size:12px;font-family:monospace;text-align:right;border-bottom:1px solid #e2e8f0">${tDebits > 0 ? fmtNaira(tDebits) : '—'}</td>
          <td style="padding:8px 12px;font-size:12px;font-family:monospace;text-align:right;border-bottom:1px solid #e2e8f0">${tCredits > 0 ? fmtNaira(tCredits) : '—'}</td>
          <td style="padding:8px 12px;font-size:12px;text-align:center;border-bottom:1px solid #e2e8f0;color:${balanced ? '#059669' : '#dc2626'};font-weight:600">${balanced ? 'Balanced' : 'Unbalanced'}</td>
        </tr>`;
      }).join('');

      const totalDebs = list.reduce((s: number, e: any) => s + Number(e.totalDebits || 0), 0);
      const totalCres = list.reduce((s: number, e: any) => s + Number(e.totalCredits || 0), 0);

      printWindow('Manual Journals',
        `<div style="text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #e2e8f0">
          ${orgLogo}
          <h1 style="margin:4px 0;font-size:18px;color:#0f172a">${orgName}</h1>
          ${orgAddr}
          <p style="margin:2px 0;font-size:11px;color:#64748b">${contactInfo}</p>
        </div>
        <h2 style="font-size:16px;color:#0f172a;margin:0 0 8px">Manual Journals</h2>
        <p style="font-size:11px;color:#64748b;margin:0 0 12px">${list.length} entries — Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#f8fafc">
              <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#64748b;text-align:left;text-transform:uppercase">Entry #</th>
              <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#64748b;text-align:left;text-transform:uppercase">Date</th>
              <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#64748b;text-align:left;text-transform:uppercase">Description</th>
              <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#64748b;text-align:left;text-transform:uppercase">Source</th>
              <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#64748b;text-align:right;text-transform:uppercase">Debit</th>
              <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#64748b;text-align:right;text-transform:uppercase">Credit</th>
              <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#64748b;text-align:center;text-transform:uppercase">Status</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:20px">No entries</td></tr>'}</tbody>
          <tfoot>
            <tr style="font-weight:700;border-top:2px solid #0f172a">
              <td colspan="4" style="padding:10px 12px;font-size:13px;text-align:right">TOTAL</td>
              <td style="padding:10px 12px;font-size:13px;font-family:monospace;text-align:right">${fmtNaira(totalDebs)}</td>
              <td style="padding:10px 12px;font-size:13px;font-family:monospace;text-align:right">${fmtNaira(totalCres)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>`,
        `${list.length} entries`
      );
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
          <button onClick={() => { setShowForm(true); setViewId(null); setEditId(null); }} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200"><Plus className="w-4 h-4" /> +New</button>
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
        <JournalDetailView journalId={viewId} onBack={() => setViewId(null)} onEdit={(id) => { setViewId(null); setEditId(id); setShowForm(true); }} />
      ) : showForm ? (
        <JournalForm editId={editId} onDone={() => { setShowForm(false); setEditId(null); queryClient.invalidateQueries({ queryKey: ['journals'] }); }} />
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
              <input type="date" value={dateFromInput || dateFrom} onChange={e => setDateFromInput(e.target.value)} onBlur={() => { if (/^\d{4}-\d{2}-\d{2}$/.test(dateFromInput)) setDateFrom(dateFromInput); else setDateFromInput(dateFrom); }}
              className="w-40 px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500">To:</label>
              <input type="date" value={dateToInput || dateTo} onChange={e => setDateToInput(e.target.value)} onBlur={() => { if (/^\d{4}-\d{2}-\d{2}$/.test(dateToInput)) setDateTo(dateToInput); else setDateToInput(dateTo); }}
              className="w-40 px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
            </div>
            <div className="flex items-center gap-1">
              <label className="text-xs font-semibold text-slate-500">Status:</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
                className="px-2 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow bg-white">
                <option value="all">All</option>
                <option value="draft">Draft</option>
                <option value="pending_review">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="posted">Posted</option>
                <option value="locked">Locked</option>
                <option value="reversed">Reversed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            {(search || dateFrom || dateTo || statusFilter !== 'all') && (
              <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setStatusFilter('all'); }} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1">Clear</button>
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
                const entryStatus = entry.status || 'posted';
                return (
                <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50">
                  <td className="px-4 py-3 font-mono font-medium text-slate-800">{entry.entryNumber}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(entry.date)}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{entry.description || '—'}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium tabular-nums text-slate-800">{tDebits > 0 ? fmtNaira(tDebits) : '—'}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium tabular-nums text-slate-800">{tCredits > 0 ? fmtNaira(tCredits) : '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={entryStatus} />
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

function JournalDetailView({ journalId, onBack, onEdit }: { journalId: string; onBack: () => void; onEdit?: (id: string) => void }) {
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

  const tagMutation = useMutation({
    mutationFn: (toOpening: boolean) => journalsApi.tagJournal(journalId, toOpening),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal', journalId] });
      queryClient.invalidateQueries({ queryKey: ['journals'] });
    },
  });

  const submitReviewMutation = useMutation({
    mutationFn: () => journalsApi.submitReview(journalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal', journalId] });
      queryClient.invalidateQueries({ queryKey: ['journals'] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => journalsApi.approveJournal(journalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal', journalId] });
      queryClient.invalidateQueries({ queryKey: ['journals'] });
    },
  });

  const postMutation = useMutation({
    mutationFn: () => journalsApi.postJournal(journalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal', journalId] });
      queryClient.invalidateQueries({ queryKey: ['journals'] });
    },
  });

  const lockMutation = useMutation({
    mutationFn: () => journalsApi.lockJournal(journalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal', journalId] });
      queryClient.invalidateQueries({ queryKey: ['journals'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => journalsApi.cancelJournal(journalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal', journalId] });
      queryClient.invalidateQueries({ queryKey: ['journals'] });
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
              <StatusBadge status={entry.status || 'posted'} />
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
                        <span className="text-red-500">Difference: {fmtNaira(diff)}</span>
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
      <div className="space-y-3">
        {/* Status transition buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          {entry.status === 'draft' && (
            <>
              <button onClick={() => submitReviewMutation.mutate()} disabled={submitReviewMutation.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-xl transition-all duration-200 disabled:opacity-50">
                <Loader2 className={`w-4 h-4 ${submitReviewMutation.isPending ? 'animate-spin' : 'hidden'}`} /> Submit for Review
              </button>
              <button onClick={() => { if (confirm('Cancel this draft entry?')) cancelMutation.mutate(); }} disabled={cancelMutation.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-xl transition-all duration-200 disabled:opacity-50">
                Cancel
              </button>
            </>
          )}
          {entry.status === 'pending_review' && (
            <>
              <button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded-xl transition-all duration-200 disabled:opacity-50">
                <CheckCircle2 className="w-4 h-4" /> Approve
              </button>
              <button onClick={() => { if (confirm('Cancel this pending entry?')) cancelMutation.mutate(); }} disabled={cancelMutation.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-xl transition-all duration-200 disabled:opacity-50">
                Cancel
              </button>
            </>
          )}
          {entry.status === 'approved' && (
            <button onClick={() => postMutation.mutate()} disabled={postMutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-xl transition-all duration-200 disabled:opacity-50">
              <Loader2 className={`w-4 h-4 ${postMutation.isPending ? 'animate-spin' : 'hidden'}`} /> Post to GL
            </button>
          )}
          {entry.status === 'posted' && (
            <>
              <button onClick={() => { if (confirm('Lock this posted entry? This prevents reversal.')) lockMutation.mutate(); }} disabled={lockMutation.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200/80 rounded-xl transition-all duration-200 disabled:opacity-50">
                <Loader2 className={`w-4 h-4 ${lockMutation.isPending ? 'animate-spin' : 'hidden'}`} /> Lock
              </button>
              <button onClick={handleReverse} disabled={reverseMutation.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200/80 rounded-xl transition-all duration-200 disabled:opacity-50">
                {reverseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Reverse
              </button>
            </>
          )}
          {entry.status === 'draft' && entry.source === 'manual' && (
            <button onClick={() => onEdit?.(journalId)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-xl transition-all duration-200">
              <Pencil className="w-4 h-4" /> Edit
            </button>
          )}
          {(entry.source === 'manual' || entry.source === 'opening_balance') && entry.status !== 'reversed' && entry.status !== 'cancelled' && (
            entry.source === 'manual' ? (
              <button onClick={() => { if (confirm('Tag this entry as an opening/migration balance entry?')) tagMutation.mutate(true); }} disabled={tagMutation.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-xl transition-all duration-200 disabled:opacity-50">
                <FileText className="w-4 h-4" /> Tag as Opening
              </button>
            ) : (
              <button onClick={() => { if (confirm('Remove the opening-balance tag?')) tagMutation.mutate(false); }} disabled={tagMutation.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 rounded-xl transition-all duration-200 disabled:opacity-50">
                <X className="w-4 h-4" /> Remove OB Tag
              </button>
            )
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={handlePrintPdf} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all duration-200">
              <Printer className="w-4 h-4" /> Print / PDF
            </button>
          </div>
          <button onClick={onBack} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all duration-200">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>
      </div>

      {/* Transition mutation errors/success */}
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
      {submitReviewMutation.isError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-200/80">
          <AlertCircle className="w-4 h-4 shrink-0" /> {(submitReviewMutation.error as any)?.response?.data?.error || (submitReviewMutation.error as any)?.message || 'Submit failed.'}
        </div>
      )}
      {submitReviewMutation.isSuccess && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm border border-emerald-200/80">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> Submitted for review.
        </div>
      )}
      {approveMutation.isError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-200/80">
          <AlertCircle className="w-4 h-4 shrink-0" /> {(approveMutation.error as any)?.response?.data?.error || (approveMutation.error as any)?.message || 'Approval failed.'}
        </div>
      )}
      {approveMutation.isSuccess && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm border border-emerald-200/80">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> Entry approved.
        </div>
      )}
      {postMutation.isError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-200/80">
          <AlertCircle className="w-4 h-4 shrink-0" /> {(postMutation.error as any)?.response?.data?.error || (postMutation.error as any)?.message || 'Posting failed.'}
        </div>
      )}
      {postMutation.isSuccess && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm border border-emerald-200/80">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> Entry posted to GL.
        </div>
      )}
      {lockMutation.isError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-200/80">
          <AlertCircle className="w-4 h-4 shrink-0" /> {(lockMutation.error as any)?.response?.data?.error || (lockMutation.error as any)?.message || 'Lock failed.'}
        </div>
      )}
      {lockMutation.isSuccess && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm border border-emerald-200/80">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> Entry locked.
        </div>
      )}
      {cancelMutation.isError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-200/80">
          <AlertCircle className="w-4 h-4 shrink-0" /> {(cancelMutation.error as any)?.response?.data?.error || (cancelMutation.error as any)?.message || 'Cancel failed.'}
        </div>
      )}
      {cancelMutation.isSuccess && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm border border-emerald-200/80">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> Entry cancelled.
        </div>
      )}
    </div>
  );
}

function JournalForm({ editId, onDone }: { editId?: string | null; onDone: () => void }) {
  const [entryNumber, setEntryNumber] = useState(`JE-${Date.now()}`);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState([{ accountId: '', debitAmount: 0, creditAmount: 0, description: '' }]);
  const [isOpeningBalance, setIsOpeningBalance] = useState(false);
  const [journalStatus, setJournalStatus] = useState<'draft' | 'posted'>('posted');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loaded, setLoaded] = useState(false);

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountantApi.getAccounts(),
  });

  const { data: existingEntry } = useQuery({
    queryKey: ['journal', editId],
    queryFn: () => journalsApi.getJournal(editId!),
    enabled: !!editId,
  });

  useEffect(() => {
    if (existingEntry && !loaded) {
      setEntryNumber(existingEntry.entryNumber || `JE-${Date.now()}`);
      setDate(existingEntry.date ? existingEntry.date.slice(0, 10) : new Date().toISOString().split('T')[0]);
      setDescription(existingEntry.description || '');
      setReference(existingEntry.reference || '');
      setLines((existingEntry.lines || []).map((l: any) => ({
        accountId: l.accountId || '',
        debitAmount: Number(l.debitAmount || 0) / 100,
        creditAmount: Number(l.creditAmount || 0) / 100,
        description: l.description || '',
      })));
      setLoaded(true);
    }
  }, [existingEntry, loaded]);

  const isEdit = !!editId;

  const mutation = useMutation({
    mutationFn: (data: any) => isEdit ? journalsApi.updateJournal(editId!, data) : journalsApi.createJournal(data),
    onSuccess: () => { setSuccess(isEdit ? 'Journal entry updated.' : 'Journal entry created.'); setTimeout(onDone, 1000); },
    onError: (err: any) => setError(err.response?.data?.error || err.message || 'Failed to save.'),
  });

  const addLine = () => setLines([...lines, { accountId: '', debitAmount: 0, creditAmount: 0, description: '' }]);
  const removeLine = (i: number) => { if (lines.length > 1) setLines(lines.filter((_, idx) => idx !== i)); };
  const updateLine = (i: number, field: string, value: any) => {
    setLines(lines.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  };

  const totalDebits = lines.reduce((s, l) => s + Number(l.debitAmount || 0), 0);
  const totalCredits = lines.reduce((s, l) => s + Number(l.creditAmount || 0), 0);
  const isBalanced = Math.round(totalDebits * 100) === Math.round(totalCredits * 100);

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
      isOpeningBalance,
      status: journalStatus,
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
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {success && <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm border border-emerald-200/80"><CheckCircle2 className="w-4 h-4" /> {success}</div>}
      {error && <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100/80"><AlertCircle className="w-4 h-4" /> {error}</div>}

      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-900 mb-4">{isEdit ? 'Edit Journal Entry' : 'New Journal Entry'}</h2>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Entry #</label>
            <input value={entryNumber} onChange={e => setEntryNumber(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-shadow font-mono" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-shadow" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Reference</label>
            <input value={reference} onChange={e => setReference(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-shadow" />
          </div>
          <div className="flex items-end justify-end gap-3 pb-1">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/60">
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="radio" name="journalStatus" value="draft" checked={journalStatus === 'draft'} onChange={() => setJournalStatus('draft')}
                  className="w-3.5 h-3.5 text-slate-600 focus:ring-slate-500" />
                <span className="text-xs font-medium text-slate-600">Draft</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="radio" name="journalStatus" value="posted" checked={journalStatus === 'posted'} onChange={() => setJournalStatus('posted')}
                  className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500" />
                <span className="text-xs font-medium text-indigo-600">Post</span>
              </label>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${isBalanced ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {isBalanced ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              {isBalanced ? 'Balanced' : 'Out of Balance'}
            </span>
          </div>
        </div>
      </div>

      {/* Description row */}
      <div className="px-6 py-3 border-b border-slate-100">
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Description</label>
        <input value={description} onChange={e => setDescription(e.target.value)}
          placeholder="Brief description of this journal entry..."
          className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-shadow" />
      </div>

      {/* Opening balance checkbox */}
      <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-3">
        <input type="checkbox" id="isOpeningBalance" checked={isOpeningBalance} onChange={e => setIsOpeningBalance(e.target.checked)}
          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
        <label htmlFor="isOpeningBalance" className="text-sm text-slate-700 cursor-pointer">
          This is an opening/migration balance entry <span className="text-slate-400 font-normal">(from previous accounting system)</span>
        </label>
        <span className="text-[11px] text-slate-400 ml-1">— Affects how Cash Flow Statement classifies this entry.</span>
      </div>

      {/* Journal lines table */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-slate-700">Journal Lines</span>
          <button type="button" onClick={addLine}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Line
          </button>
        </div>
        <div className="border border-slate-200 rounded-lg overflow-visible">
          <div className="grid text-sm" style={{ gridTemplateColumns: '2rem 1fr 9rem 9rem 1fr 2.5rem' }}>
            <div className="px-2 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-200">#</div>
            <div className="px-2 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-200">Account</div>
            <div className="px-2 py-2.5 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-200">Debit (₦)</div>
            <div className="px-2 py-2.5 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-200">Credit (₦)</div>
            <div className="px-2 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-200">Description</div>
            <div className="border-b border-slate-200" />
          </div>
          {lines.map((line, i) => (
            <div key={i} className="grid hover:bg-slate-50/50 transition-colors border-b border-slate-100" style={{ gridTemplateColumns: '2rem 1fr 9rem 9rem 1fr 2.5rem' }}>
              <div className="px-2 py-2 text-xs text-slate-400 font-mono flex items-center">{i + 1}</div>
              <div className="px-2 py-2">
                <AccountSearchSelect
                  accounts={accList}
                  value={line.accountId}
                  onChange={id => updateLine(i, 'accountId', id)}
                  placeholder="Select account"
                />
              </div>
              <div className="px-2 py-2">
                <input type="number" placeholder="0.00"
                  value={line.debitAmount || ''}
                  onChange={e => updateLine(i, 'debitAmount', e.target.value)}
                  className="w-full px-3 py-2 text-sm text-right font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-shadow" />
              </div>
              <div className="px-2 py-2">
                <input type="number" placeholder="0.00"
                  value={line.creditAmount || ''}
                  onChange={e => updateLine(i, 'creditAmount', e.target.value)}
                  className="w-full px-3 py-2 text-sm text-right font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-shadow" />
              </div>
              <div className="px-2 py-2">
                <input placeholder="Line description (optional)"
                  value={line.description}
                  onChange={e => updateLine(i, 'description', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-shadow" />
              </div>
              <div className="px-2 py-2 flex items-center justify-center">
                {lines.length > 1 && (
                  <button type="button" onClick={() => removeLine(i)}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="grid bg-slate-50" style={{ gridTemplateColumns: '2rem 1fr 9rem 9rem 1fr 2.5rem' }}>
            <div className="px-2 py-3 text-sm font-bold text-slate-700 col-span-2">Totals</div>
            <div className="px-2 py-3 text-right font-mono font-bold text-sm">{fmtNaira(totalDebits * 100)}</div>
            <div className="px-2 py-3 text-right font-mono font-bold text-sm">{fmtNaira(totalCredits * 100)}</div>
            <div className="px-2 py-3 text-xs text-slate-400 col-span-2">
              {isBalanced
                ? <span className="text-emerald-600 font-semibold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> In balance</span>
                : <span className="text-red-600 font-semibold flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Difference: {fmtNaira(Math.abs(totalDebits - totalCredits) * 100)}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-end gap-3">
        <button type="button" onClick={onDone}
          className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white rounded-lg hover:bg-slate-100 transition-colors border border-slate-200/80">Cancel</button>
        <button type="submit" disabled={mutation.isPending}
          className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2">
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {isEdit ? 'Update' : journalStatus === 'draft' ? 'Save as Draft' : 'Post Entry'}
        </button>
      </div>
    </form>
  );
}
