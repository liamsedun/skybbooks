import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { reportsApi, accountantApi, printWindow } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { downloadCsv, exportToCsv } from '../../lib/csvTemplates';
import { Loader2, AlertCircle, CheckCircle2, Download, Search, Upload, FileText, X, RefreshCw, ExternalLink, Pencil, ChevronRight, ChevronDown, ChevronUp, Database } from 'lucide-react';
import { getDefaultDateRange, getAccountModuleLink, fmtNaira } from './reportUtils';
import { AccountDrilldownModal } from './components/AccountDrilldownModal';

export function TrialBalancePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { startDate, endDate } = getDefaultDateRange();
  const [sDate, setSDate] = useState(startDate);
  const [eDate, setEDate] = useState(endDate);
  const [searchQuery, setSearchQuery] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [drillDown, setDrillDown] = useState<any | null>(null);
  const [showEditOb, setShowEditOb] = useState(false);
  const [editObData, setEditObData] = useState<{ accountCode: string; accountName: string; openingBalance: number }[]>([]);
  const [editObLoading, setEditObLoading] = useState(false);
  const [editObSaving, setEditObSaving] = useState(false);
  const [editObMsg, setEditObMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [obOpen, setObOpen] = useState(false);
  const [dlOpen, setDlOpen] = useState(false);
  const obRef = useRef<HTMLDivElement>(null);
  const dlRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (obRef.current && !obRef.current.contains(e.target as Node)) setObOpen(false);
      if (dlRef.current && !dlRef.current.contains(e.target as Node)) setDlOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['report', 'trial-balance', sDate, eDate],
    queryFn: async () => {
      const res = await reportsApi.getTrialBalance({ startDate: sDate, endDate: eDate, format: 'json' });
      return res.data || res;
    },
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
  const rawRows: any[] = Array.isArray(data) ? data : [];

  const childrenByParent: Record<string, any[]> = {};
  rawRows.forEach((r: any) => {
    if (r.parentId) {
      if (!childrenByParent[r.parentId]) childrenByParent[r.parentId] = [];
      childrenByParent[r.parentId].push(r);
    }
  });

  const isSearching = searchQuery.length > 0;
  const searchLower = searchQuery.toLowerCase();

  const autoExpandParents = new Set<string>();
  if (isSearching) {
    rawRows.forEach((r: any) => {
      if (r.parentId) {
        const matches = (r.accountCode || '').toLowerCase().includes(searchLower) ||
                        (r.accountName || '').toLowerCase().includes(searchLower);
        if (matches) autoExpandParents.add(r.parentId);
      }
    });
  }

  function rowMatches(r: any): boolean {
    if (!isSearching) return true;
    return (r.accountCode || '').toLowerCase().includes(searchLower) ||
           (r.accountName || '').toLowerCase().includes(searchLower);
  }

  const displayRows: any[] = [];
  const expandedActive = new Set(expandedParents);
  autoExpandParents.forEach(id => expandedActive.add(id));

  for (const r of rawRows) {
    const id = r.accountId || r.id;
    const hasChildren = !!childrenByParent[id];
    const isChild = !!r.parentId;
    const isRoot = !isChild;

    const matches = rowMatches(r);
    const childMatches = isRoot && autoExpandParents.has(id);
    if (!matches && !childMatches) continue;

    if (isChild && !expandedActive.has(r.parentId)) continue;

    let depth = 0;
    if (isChild) {
      let pid = r.parentId;
      while (pid) {
        depth++;
        const parent = rawRows.find((x: any) => (x.accountId || x.id) === pid);
        pid = parent?.parentId || null;
      }
    }

    const isExpanded = expandedActive.has(id);

    displayRows.push({ ...r, _depth: depth, _hasChildren: hasChildren, _isExpanded: isExpanded });

    if (hasChildren && isExpanded) {
      expandedActive.add(id);
    }
  }

  const rows = displayRows;

  const handleExport = (format: 'pdf' | 'csv') => {
    if (format === 'csv') {
      const headers = ['Account Code', 'Account Name', 'Type', 'Debit (NGN)', 'Credit (NGN)'];
      const csvRows = rawRows.map((r: any) => [
        r.accountCode || '',
        `"${(r.accountName || '').replace(/"/g, '""')}"`,
        r.accountType || '',
        ((r.closingDebit || 0) / 100).toFixed(2),
        ((r.closingCredit || 0) / 100).toFixed(2),
      ]);
      exportToCsv(`trial_balance_${sDate}_to_${eDate}.csv`, headers, csvRows);
    } else {
      try {
        const totalDr = rawRows.reduce((s: number, r: any) => s + (r.parentId ? 0 : (r.closingDebit || 0)), 0);
        const totalCr = rawRows.reduce((s: number, r: any) => s + (r.parentId ? 0 : (r.closingCredit || 0)), 0);
        const rows = rawRows.map((r: any) =>
          `<tr><td>${r.accountCode||''}</td><td>${r.accountName||''}</td><td class="c">${r.accountType||''}</td><td class="r">₦${((r.closingDebit||0)/100).toLocaleString()}</td><td class="r">₦${((r.closingCredit||0)/100).toLocaleString()}</td></tr>`
        ).join('');
        printWindow('Trial Balance', `<table><thead><tr><th>Code</th><th>Account</th><th class="c">Type</th><th class="r">Debit</th><th class="r">Credit</th></tr></thead><tbody>${rows}</tbody><tfoot><tr style="font-weight:700;border-top:2px solid #cbd5e1;background:#f1f5f9"><td colspan="3" style="padding:7px 12px">Total</td><td class="r">₦${(totalDr/100).toLocaleString()}</td><td class="r">₦${(totalCr/100).toLocaleString()}</td></tr></tfoot></table>`, `Period: ${sDate} - ${eDate}`);
      } catch (err) {
        toast('Failed to open print window: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
        console.error('Print error:', err);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText(ev.target?.result as string || '');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!csvText.trim()) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const res = await reportsApi.importTrialBalanceOpeningBalances({ csvData: csvText });
      setImportMsg({ type: 'success', text: res.message || 'Opening balances imported successfully.' });
      setCsvText('');
      refetch();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Import failed.';
      const errors = err?.response?.data?.errors;
      setImportMsg({ type: 'error', text: errors ? `${msg}: ${errors.join(', ')}` : msg });
    } finally {
      setImporting(false);
    }
  };

  const handleOpenEditOb = async () => {
    setEditObLoading(true);
    setEditObMsg(null);
    try {
      const accounts = await accountantApi.getAccounts();
      setEditObData(accounts.map((a: any) => ({
        accountCode: a.code,
        accountName: a.name,
        openingBalance: Math.round((a.openingBalance || 0) / 100)
      })));
      setShowEditOb(true);
    } catch {
      setEditObMsg({ type: 'error', text: 'Failed to load accounts.' });
    } finally {
      setEditObLoading(false);
    }
  };

  const handleSaveEditOb = async () => {
    setEditObSaving(true);
    setEditObMsg(null);
    try {
      const lines = editObData.map(a => ({
        accountCode: a.accountCode,
        openingBalance: a.openingBalance
      }));
      const res = await reportsApi.setTrialBalanceOpeningBalances({ lines });
      setEditObMsg({ type: 'success', text: res.message || 'Opening balances updated.' });
      refetch();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Save failed.';
      setEditObMsg({ type: 'error', text: msg });
    } finally {
      setEditObSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">

        <div className="flex gap-2">
          <button onClick={() => refetch()} disabled={isFetching} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 disabled:opacity-50 transition-all duration-200"><RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh</button>
          <div className="relative" ref={obRef}>
            <button onClick={() => { setObOpen(!obOpen); setDlOpen(false); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-600 rounded-xl hover:bg-slate-700 transition-all duration-200"><Database className="w-3.5 h-3.5" /> Opening Balances <ChevronDown size={12} className={`transition-transform ${obOpen ? 'rotate-180' : ''}`} /></button>
            {obOpen && (
              <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1">
                <button onClick={() => { downloadCsv('trial-balance-opening-balances-template.csv', ['accountCode', 'accountName', 'debit (NGN)', 'credit (NGN)'], ['100000', 'Cash and Cash Equivalents', '5000000', '0']); setObOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"><FileText size={14} /> Sample CSV</button>
                <button onClick={() => { setShowImport(true); setObOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"><Upload size={14} /> Import Opening Balances</button>
                <button onClick={() => { handleOpenEditOb(); setObOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"><Pencil size={14} /> Edit Opening Balances</button>
              </div>
            )}
          </div>
          <div className="relative" ref={dlRef}>
            <button onClick={() => { setDlOpen(!dlOpen); setObOpen(false); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-all duration-200"><Download className="w-3.5 h-3.5" /> Download <ChevronDown size={12} className={`transition-transform ${dlOpen ? 'rotate-180' : ''}`} /></button>
            {dlOpen && (
              <div className="absolute left-0 top-full mt-1 w-40 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1">
                <button onClick={() => { handleExport('pdf'); setDlOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"><FileText size={14} /> PDF</button>
                <button onClick={() => { handleExport('csv'); setDlOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"><Download size={14} /> CSV</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-4 items-center bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">From:</label>
          <input type="date" value={sDate} onChange={e => setSDate(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">To:</label>
          <input type="date" value={eDate} onChange={e => setEDate(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search accounts..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl w-64 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><div className="bg-gradient-to-r from-slate-200 to-slate-100 animate-pulse rounded-xl h-8 w-48"></div></div>
      ) : error ? (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-xl text-sm"><AlertCircle className="w-4 h-4" /> Failed to load report.</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-3">Account Code</th>
                <th className="text-left px-3 py-3">Account Name</th>
                <th className="text-right px-3 py-3">Type</th>
                <th className="text-right px-3 py-3">Debit</th>
                <th className="text-right px-3 py-3">Credit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any, i: number) => {
                const link = getAccountModuleLink(row.accountCode || row.code || '', row.accountId || row.id);
                const padLeft = row._depth * 20;
                return (
                <tr key={i} className={`border-t border-slate-100 hover:bg-slate-50/50 even:bg-slate-50/50 transition-colors cursor-pointer ${row._depth > 0 ? 'bg-slate-50/30' : ''}`} onClick={() => setDrillDown(row)}>
                  <td className="px-3 py-3 text-slate-600 font-mono" style={{ paddingLeft: `${12 + padLeft}px` }}>
                    {row._hasChildren ? (
                      <button
                        onClick={e => { e.stopPropagation(); toggleExpand(row.accountId || row.id); }}
                        className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 mr-1"
                      >
                        {row._isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                    ) : (
                      <span className="inline-block w-5 mr-1" />
                    )}
                    <span className={row._hasChildren ? 'font-semibold text-slate-800' : ''}>{row.accountCode || row.code || '—'}</span>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/reports/general-ledger?accountId=${row.accountId || row.id}`); }}
                      className={`text-left hover:text-emerald-700 hover:underline transition-colors ${row._hasChildren ? 'font-semibold text-slate-800' : 'font-medium text-slate-700'} ${row._depth > 0 ? 'text-sm' : ''}`}
                      title="View journal entries for this account"
                    >{row.accountName || row.name || `Account ${i + 1}`}</button>
                    {link && (
                      <button
                        onClick={e => { e.stopPropagation(); navigate(link.path); }}
                        className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                        title={`Go to ${link.label}`}
                      ><ExternalLink className="w-3 h-3" /> {link.label}</button>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right text-slate-500 capitalize">{row.accountType || row.type || '—'}</td>
                  <td className="px-3 py-3 text-right text-slate-600">{fmtNaira(row.closingDebit || row.debit || 0)}</td>
                  <td className="px-3 py-3 text-right text-slate-600">{fmtNaira(row.closingCredit || row.credit || 0)}</td>
                </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">{searchQuery ? 'No accounts match your search.' : 'No data available.'}</td></tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold text-slate-900">
                  <td className="px-3 py-3 text-sm" colSpan={3}>Total</td>
                  <td className="px-3 py-3 text-right text-sm font-mono">{fmtNaira(rows.reduce((s: number, r: any) => s + (r._depth === 0 ? (r.closingDebit || r.debit || 0) : 0), 0))}</td>
                  <td className="px-3 py-3 text-right text-sm font-mono">{fmtNaira(rows.reduce((s: number, r: any) => s + (r._depth === 0 ? (r.closingCredit || r.credit || 0) : 0), 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowImport(false)}>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 w-full max-w-lg mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Import Opening Balances</h2>
              <button onClick={() => setShowImport(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-slate-500">Upload a CSV file with columns: <code className="text-xs bg-slate-100 px-1 rounded">accountCode</code>, <code className="text-xs bg-slate-100 px-1 rounded">debit (NGN)</code>, <code className="text-xs bg-slate-100 px-1 rounded">credit (NGN)</code>. Debits must equal credits.</p>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFileUpload} className="block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
            {csvText && (
              <div className="text-xs text-slate-500 bg-slate-50 rounded-xl p-2 max-h-24 overflow-auto">{csvText.slice(0, 500)}{csvText.length > 500 ? '...' : ''}</div>
            )}
            {importMsg && (
              <div className={`text-sm p-2 rounded-xl ${importMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{importMsg.text}</div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowImport(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-xl text-slate-600 hover:bg-slate-50 transition-all duration-200">Cancel</button>
              <button onClick={handleImport} disabled={!csvText.trim() || importing} className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 transition-all duration-200">{importing ? 'Importing...' : 'Import'}</button>
            </div>
          </div>
        </div>
      )}

      {drillDown && <AccountDrilldownModal account={drillDown} sDate={sDate} eDate={eDate} onClose={() => setDrillDown(null)} />}

      {showEditOb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { if (!editObSaving) setShowEditOb(false); }}>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 w-full max-w-3xl mx-4 p-6 space-y-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold text-slate-900">Edit Opening Balances</h2>
              <button onClick={() => { if (!editObSaving) setShowEditOb(false); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            {editObLoading ? (
              <div className="flex items-center justify-center py-12"><div className="bg-gradient-to-r from-slate-200 to-slate-100 animate-pulse rounded-xl h-8 w-48"></div></div>
            ) : (
              <>
                <p className="text-sm text-slate-500">Set opening balances for balance sheet accounts (values in Naira). Changes take effect immediately.</p>
                <div className="overflow-auto flex-1 border border-slate-200/80 rounded-2xl">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-3">Code</th>
                        <th className="text-left px-3 py-3">Account</th>
                        <th className="text-right px-3 py-3">Opening Balance (₦)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editObData.map((row, i) => (
                        <tr key={row.accountCode} className="border-t border-slate-100 hover:bg-slate-50/50 even:bg-slate-50/50 transition-colors">
                          <td className="px-3 py-3 text-slate-600 font-mono text-xs">{row.accountCode}</td>
                          <td className="px-3 py-3 text-slate-800 font-medium">{row.accountName}</td>
                          <td className="px-3 py-3 text-right">
                            <input
                              type="number"
                              value={row.openingBalance}
                              onChange={e => {
                                const val = e.target.value === '' ? 0 : Number(e.target.value);
                                setEditObData(prev => prev.map((r, j) => j === i ? { ...r, openingBalance: val } : r));
                              }}
                              className="w-40 text-right border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {editObMsg && (
                  <div className={`text-sm p-2 rounded-xl shrink-0 ${editObMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{editObMsg.text}</div>
                )}
                <div className="flex justify-end gap-2 shrink-0">
                  <button onClick={() => setShowEditOb(false)} disabled={editObSaving} className="px-4 py-2 text-sm border border-slate-300 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all duration-200">Cancel</button>
                  <button onClick={handleSaveEditOb} disabled={editObSaving} className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 rounded-xl hover:bg-amber-700 disabled:opacity-50 transition-all duration-200">{editObSaving ? 'Saving...' : 'Save Changes'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
