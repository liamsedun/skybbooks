import React, { useState, useRef } from 'react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { reportsApi, accountantApi, apiDownload, printWindow, api, orgApi, downloadBlob, journalsApi, vatApi, taxApi } from '../../lib/api';
import { Loader2, AlertCircle, CheckCircle2, Download, Search, Upload, FileText, X, RefreshCw, ExternalLink, Pencil, ChevronRight, ChevronDown, Briefcase, ArrowLeft, Eye } from 'lucide-react';
import { downloadCsv, exportToCsv, CSV_TEMPLATES } from '../../lib/csvTemplates';

const MODULE_LINKS: { prefix: string; path: string; label: string }[] = [
  { prefix: '1002', path: '/banking', label: 'Banking' },
  { prefix: '1003', path: '/banking', label: 'Banking' },
  { prefix: '1004', path: '/banking', label: 'Banking' },
  { prefix: '1005', path: '/banking', label: 'Banking' },
  { prefix: '1010', path: '/sales/customers', label: 'Customers' },
  { prefix: '1011', path: '/sales/customers', label: 'Customers' },
  { prefix: '102', path: '/inventory/items', label: 'Items' },
  { prefix: '200', path: '/accountant/fixed-assets', label: 'Fixed Assets' },
  { prefix: '201', path: '/accountant/fixed-assets', label: 'Fixed Assets' },
  { prefix: '202', path: '/accountant/fixed-assets', label: 'Fixed Assets' },
  { prefix: '203', path: '/accountant/fixed-assets', label: 'Fixed Assets' },
  { prefix: '204', path: '/accountant/fixed-assets', label: 'Fixed Assets' },
  { prefix: '205', path: '/accountant/fixed-assets', label: 'Fixed Assets' },
  { prefix: '206', path: '/accountant/fixed-assets', label: 'Fixed Assets' },
  { prefix: '3000', path: '/purchases/bills', label: 'Bills' },
  { prefix: '3001', path: '/purchases/bills', label: 'Bills' },
  { prefix: '500', path: '/accountant/manual-journals', label: 'Manual Journals' },
  { prefix: '501', path: '/accountant/manual-journals', label: 'Manual Journals' },
  { prefix: '502', path: '/accountant/manual-journals', label: 'Manual Journals' },
  { prefix: '503', path: '/accountant/manual-journals', label: 'Manual Journals' },
  { prefix: '504', path: '/accountant/manual-journals', label: 'Manual Journals' },
  { prefix: '505', path: '/accountant/manual-journals', label: 'Manual Journals' },
  { prefix: '600', path: '/sales', label: 'Sales' },
  { prefix: '601', path: '/sales', label: 'Sales' },
  { prefix: '700', path: '/inventory/items', label: 'Items' },
  { prefix: '900', path: '/sales', label: 'Sales' },
];

function getAccountModuleLink(code: string): { path: string; label: string } | null {
  const c = code.toString().trim();
  for (const m of MODULE_LINKS) {
    if (c.startsWith(m.prefix)) return { path: m.path, label: m.label };
  }
  return null;
}

type ReportType = 'trial-balance' | 'income-statement' | 'balance-sheet' | 'cash-flow' | 'aged-receivables' | 'aged-payables';

interface ReportPageProps {
  reportType: ReportType;
  title: string;
}

function fmtNaira(v: number): string {
  return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getDefaultDateRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: now.toISOString().split('T')[0],
  };
}

export function TrialBalancePage() {
  const navigate = useNavigate();
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

  // Build parent→children map for tree rendering
  const childrenByParent: Record<string, any[]> = {};
  rawRows.forEach((r: any) => {
    if (r.parentId) {
      if (!childrenByParent[r.parentId]) childrenByParent[r.parentId] = [];
      childrenByParent[r.parentId].push(r);
    }
  });

  // Determine visible rows with tree expansion
  const isSearching = searchQuery.length > 0;
  const searchLower = searchQuery.toLowerCase();

  // Auto-expand parents that have matching children during search
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

  // Compute display rows respecting tree hierarchy
  const displayRows: any[] = [];
  const expandedActive = new Set(expandedParents);
  // Also auto-expand parents with matching children
  autoExpandParents.forEach(id => expandedActive.add(id));

  for (const r of rawRows) {
    const id = r.accountId || r.id;
    const hasChildren = !!childrenByParent[id];
    const isChild = !!r.parentId;
    const isRoot = !isChild;

    // Skip if doesn't match search (unless it's a parent of a matching child)
    const matches = rowMatches(r);
    const childMatches = isRoot && autoExpandParents.has(id);
    if (!matches && !childMatches) continue;

    // Skip children whose parent isn't expanded
    if (isChild && !expandedActive.has(r.parentId)) continue;

    // For roots that are parents: if childMatches but root itself doesn't match,
    // still show the root (it's the parent of a matching child)
    if (isRoot && !matches && childMatches) {
      // Show the parent row even though it doesn't match - for context
    }

    // Determine depth for indentation
    let depth = 0;
    if (isChild) {
      // Walk up the parent chain to compute depth
      let pid = r.parentId;
      while (pid) {
        depth++;
        const parent = rawRows.find((x: any) => (x.accountId || x.id) === pid);
        pid = parent?.parentId || null;
      }
    }

    const isExpanded = expandedActive.has(id);

    displayRows.push({ ...r, _depth: depth, _hasChildren: hasChildren, _isExpanded: isExpanded });

    // If this parent is expanded, children will show in subsequent iterations
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
        alert('Failed to open print window: ' + (err instanceof Error ? err.message : 'Unknown error'));
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
        <h1 className="text-2xl font-bold text-slate-900">Trial Balance</h1>
        <div className="flex gap-2">
          <button onClick={() => refetch()} disabled={isFetching} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 disabled:opacity-50 transition-all duration-200"><RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh</button>
          <button onClick={() => { downloadCsv('trial-balance-opening-balances-template.csv', ['accountCode', 'accountName', 'debit (NGN)', 'credit (NGN)'], ['100000', 'Cash and Cash Equivalents', '5000000', '0']); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-600 rounded-xl hover:bg-slate-700 transition-all duration-200"><FileText className="w-3.5 h-3.5" /> Sample CSV</button>
          <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200"><Upload className="w-3.5 h-3.5" /> Import Opening Balances</button>
          <button onClick={handleOpenEditOb} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 rounded-xl hover:bg-amber-700 transition-all duration-200"><Pencil className="w-3.5 h-3.5" /> Edit Opening Balances</button>
          <button onClick={() => handleExport('pdf')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-all duration-200"><Download className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={() => handleExport('csv')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-all duration-200"><Download className="w-3.5 h-3.5" /> CSV</button>
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
                const link = getAccountModuleLink(row.accountCode || row.code || '');
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
function getDefaultCompareDates(sDate: string, eDate: string): { compareStart: string; compareEnd: string } {
  const start = new Date(sDate);
  const end = new Date(eDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { compareStart: '', compareEnd: '' };
  }
  const durationMs = end.getTime() - start.getTime();
  const priorEnd = new Date(start.getTime() - 86400000);
  const priorStart = new Date(priorEnd.getTime() - durationMs);
  return {
    compareStart: isNaN(priorStart.getTime()) ? '' : priorStart.toISOString().split('T')[0],
    compareEnd: isNaN(priorEnd.getTime()) ? '' : priorEnd.toISOString().split('T')[0],
  };
}

function getDefaultCompareAsOf(asOfDate: string): string {
  const d = new Date(asOfDate);
  if (isNaN(d.getTime())) return '';
  const prior = new Date(d.getFullYear() - 1, d.getMonth(), d.getDate());
  return isNaN(prior.getTime()) ? '' : prior.toISOString().split('T')[0];
}

export function IncomeStatementPage() {
  return <ReportShell reportType="income-statement" title="Income Statement" />;
}
export function BalanceSheetPage() {
  return <ReportShell reportType="balance-sheet" title="Balance Sheet" />;
}
export function CashFlowPage() {
  return <ReportShell reportType="cash-flow" title="Cash Flow Statement" />;
}
export function AgedReceivablesPage() {
  return <ReportShell reportType="aged-receivables" title="Aged Receivables" />;
}
export function AgedPayablesPage() {
  return <ReportShell reportType="aged-payables" title="Aged Payables" />;
}
export function TaxComputationPage() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const defaultTaxYear = `${currentYear - 1}-${(currentYear).toString().slice(2)}`;
  const [taxYear, setTaxYear] = useState(defaultTaxYear);
  const todayStr = now.toISOString().split('T')[0];
  const defaultStart = `${currentYear - 1}-01-01`;
  const defaultEnd = `${currentYear - 1}-12-31`;
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [posting, setPosting] = useState(false);
  const queryClient = useQueryClient();

  const { data: config } = useQuery({
    queryKey: ['tax-config', taxYear],
    queryFn: () => taxApi.getConfiguration({ taxYear }),
  });

  const { data: computation, isLoading, error, refetch } = useQuery({
    queryKey: ['tax-computation', taxYear, startDate, endDate],
    queryFn: () => taxApi.compute({ taxYear, startDate, endDate }),
    enabled: !!taxYear,
  });

  const { data: schedule } = useQuery({
    queryKey: ['tax-schedule', taxYear],
    queryFn: () => taxApi.getSchedule(),
  });

  const handlePost = async () => {
    setPosting(true);
    try {
      await taxApi.post({ taxYear, startDate, endDate, confirmed: true });
      queryClient.invalidateQueries({ queryKey: ['tax-schedule'] });
      refetch();
      alert('Tax journal entries posted successfully.');
    } catch (err: any) {
      alert(err?.response?.data?.error || err.message || 'Failed to post tax entries.');
    } finally {
      setPosting(false);
    }
  };

  function fmt(v: number) { return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Tax Computation</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500">Tax Year:</label>
            <input type="text" value={taxYear} onChange={e => setTaxYear(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl w-28 text-center font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500">From:</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500">To:</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
          </div>
          <button onClick={() => refetch()}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm">
          <p className="font-semibold">Failed to load tax computation</p>
          <p className="text-red-500 text-xs mt-1">{(error as any)?.message}</p>
        </div>
      ) : computation ? (
        <>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-slate-100"><td className="px-5 py-3 font-semibold text-slate-600">Company Size Classification</td><td className="px-5 py-3 font-mono text-slate-900 capitalize">{computation.sizeClass}</td></tr>
                <tr className="border-b border-slate-100"><td className="px-5 py-3 font-semibold text-slate-600">Period</td><td className="px-5 py-3 font-mono text-slate-900">{new Date(computation.periodStart).toLocaleDateString('en-GB')} — {new Date(computation.periodEnd).toLocaleDateString('en-GB')}</td></tr>
                <tr className="border-b border-slate-100 bg-slate-50/50"><td className="px-5 py-3 font-semibold text-slate-700">Gross Turnover</td><td className="px-5 py-3 font-mono text-slate-900">{fmt(computation.grossTurnover)}</td></tr>
                <tr className="border-b border-slate-100"><td className="px-5 py-3 font-semibold text-slate-600">Accounting Profit / (Loss) Before Tax</td><td className="px-5 py-3 font-mono text-slate-900">{fmt(computation.accountingPBT)}</td></tr>
                <tr className="border-b border-slate-100 bg-slate-50/50"><td className="px-5 py-3 font-semibold text-slate-700">Disallowable Add-backs</td><td className="px-5 py-3 font-mono text-slate-900">{fmt(computation.addbacks)}</td></tr>
                {computation.addbackDetails?.depreciation > 0 && <tr className="border-b border-slate-100"><td className="px-5 py-3 text-slate-500 pl-10 text-xs">· Depreciation / Amortisation</td><td className="px-5 py-3 font-mono text-slate-700 text-xs">{fmt(computation.addbackDetails.depreciation)}</td></tr>}
                <tr className="border-b border-slate-100"><td className="px-5 py-3 font-semibold text-slate-600">Capital Allowances</td><td className="px-5 py-3 font-mono text-slate-900">({fmt(computation.capitalAllowances)})</td></tr>
                <tr className="border-b border-slate-100 bg-slate-50/50"><td className="px-5 py-3 font-semibold text-slate-700">Losses Brought Forward</td><td className="px-5 py-3 font-mono text-slate-900">({fmt(computation.lossesBroughtForward)})</td></tr>
                <tr className="border-b-2 border-slate-200"><td className="px-5 py-3 font-bold text-slate-800 text-base">Assessable Profit</td><td className="px-5 py-3 font-mono font-bold text-slate-900 text-base">{computation.assessableProfit <= 0 ? <span className="text-red-600">{fmt(computation.assessableProfit)}</span> : fmt(computation.assessableProfit)}</td></tr>
                <tr className="border-b border-slate-100"><td className="px-5 py-3 font-semibold text-slate-600">CIT Rate</td><td className="px-5 py-3 font-mono text-slate-900">{(computation.citRate * 100).toFixed(1)}%</td></tr>
                <tr className="border-b border-slate-100 bg-slate-50/50"><td className="px-5 py-3 font-semibold text-slate-700">CIT from Profits</td><td className="px-5 py-3 font-mono text-slate-900">{fmt(computation.citFromProfits)}</td></tr>
                {computation.minimumTax > 0 && <tr className="border-b border-slate-100"><td className="px-5 py-3 font-semibold text-slate-600">Minimum Tax</td><td className="px-5 py-3 font-mono text-slate-900">{fmt(computation.minimumTax)}</td></tr>}
                <tr className="border-b border-slate-100 bg-yellow-50/50"><td className="px-5 py-3 font-bold text-slate-800">CIT Payable</td><td className="px-5 py-3 font-mono font-bold text-slate-900">{fmt(computation.citPayable)}</td></tr>
                {computation.edtPayable > 0 && <tr className="border-b border-slate-100"><td className="px-5 py-3 font-semibold text-slate-600">EDT Payable (3% of AP)</td><td className="px-5 py-3 font-mono text-slate-900">{fmt(computation.edtPayable)}</td></tr>}
                {computation.cgtPayable > 0 && <tr className="border-b border-slate-100"><td className="px-5 py-3 font-semibold text-slate-600">CGT Payable (10% of net gains)</td><td className="px-5 py-3 font-mono text-slate-900">{fmt(computation.cgtPayable)}</td></tr>}
                {computation.nitdaLevy > 0 && <tr className="border-b border-slate-100"><td className="px-5 py-3 font-semibold text-slate-600">NITDA Levy (1% of PBT)</td><td className="px-5 py-3 font-mono text-slate-900">{fmt(computation.nitdaLevy)}</td></tr>}
                {computation.deferredTaxCharge !== 0 && <tr className="border-b border-slate-100"><td className="px-5 py-3 font-semibold text-slate-600">Deferred Tax {computation.deferredTaxCharge > 0 ? 'Charge' : 'Credit'}</td><td className="px-5 py-3 font-mono text-slate-900">{fmt(Math.abs(computation.deferredTaxCharge))}</td></tr>}
                {computation.whtCreditsApplied > 0 && <tr className="border-b border-slate-100"><td className="px-5 py-3 font-semibold text-slate-600">WHT Credits Applied</td><td className="px-5 py-3 font-mono text-slate-900">({fmt(computation.whtCreditsApplied)})</td></tr>}
                <tr className="bg-indigo-50/50"><td className="px-5 py-3 font-bold text-indigo-800 text-base">Total Tax Expense</td><td className="px-5 py-3 font-mono font-bold text-indigo-800 text-base">{fmt(computation.totalTaxExpense)}</td></tr>
                {computation.netCitPayable > 0 && <tr className="bg-slate-50"><td className="px-5 py-3 font-bold text-slate-800">Net CIT Payable (after WHT)</td><td className="px-5 py-3 font-mono font-bold text-slate-900">{fmt(computation.netCitPayable)}</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={handlePost} disabled={posting || !computation}
              className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
              {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Post to Ledger
            </button>
          </div>

          {Array.isArray(schedule) && schedule.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                <h2 className="text-sm font-bold text-slate-700">Posted Computations</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Tax Year</th>
                    <th className="px-4 py-2.5 text-left">Period</th>
                    <th className="px-4 py-2.5 text-right">Assessable Profit</th>
                    <th className="px-4 py-2.5 text-right">CIT Payable</th>
                    <th className="px-4 py-2.5 text-right">Total Tax</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                    <th className="px-4 py-2.5 text-right">Posted At</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.slice(0, 10).map((s: any) => (
                    <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 font-mono text-slate-800">{s.taxYear}</td>
                      <td className="px-4 py-2.5 text-slate-600">{new Date(s.periodStart).toLocaleDateString('en-GB')} - {new Date(s.periodEnd).toLocaleDateString('en-GB')}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-900">{fmt(s.assessableProfit)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-900">{fmt(s.citPayable)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900">{fmt(s.totalTaxExpense)}</td>
                      <td className="px-4 py-2.5 text-center"><span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.status === 'submitted' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'}`}>{s.status}</span></td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-500 text-xs">{new Date(s.createdAt).toLocaleDateString('en-GB')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16 text-slate-400">Enter a tax year and click refresh to compute.</div>
      )}
    </div>
  );
}
export function GeneralLedgerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const accountIdParam = searchParams.get('accountId') || '';
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [viewEntryId, setViewEntryId] = useState<string | null>(null);

  const { data: accountInfo } = useQuery({
    queryKey: ['account', accountIdParam],
    queryFn: async () => {
      if (!accountIdParam) return null;
      const res = await api.get(`/accountant/accounts/${accountIdParam}`);
      const body = res.data as any;
      return body?.data || body;
    },
    enabled: !!accountIdParam,
  });

  const { data: journals, isLoading } = useQuery({
    queryKey: ['general-ledger', fromDate, toDate, accountIdParam],
    queryFn: () => journalsApi.getJournals({ from: fromDate || undefined, to: toDate || undefined, accountId: accountIdParam || undefined }),
  });

  const { data: journalDetail } = useQuery({
    queryKey: ['journal-detail', viewEntryId],
    queryFn: () => journalsApi.getJournal(viewEntryId!),
    enabled: !!viewEntryId,
  });

  const { data: orgData } = useQuery({ queryKey: ['org'], queryFn: orgApi.getOrg });
  const orgName = (orgData as any)?.data?.name || (orgData as any)?.name || '';

  function fmtNaira(v: number): string {
    return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  }

  function fmtDate(d: string): string {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function exportCsv() {
    const list = Array.isArray(journals) ? journals : [];
    const headers = ['Date', 'Entry #', 'Description', 'Source', 'Total Debits (₦)', 'Total Credits (₦)'];
    const rows = list.map((e: any) => [
      e.date ? fmtDate(e.date) : '',
      e.entryNumber || '',
      e.description || '',
      e.source || '',
      fmtNaira(Number(e.totalDebits || 0)),
      fmtNaira(Number(e.totalCredits || 0)),
    ]);
    exportToCsv(`general_ledger_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  }

  function printReport() {
    const list = Array.isArray(journals) ? journals : [];
    const totalDr = list.reduce((s: number, e: any) => s + Number(e.totalDebits || 0), 0);
    const totalCr = list.reduce((s: number, e: any) => s + Number(e.totalCredits || 0), 0);
    const periodStr = fromDate || toDate ? `${fromDate || '…'} – ${toDate || '…'}` : 'All periods';
    const filterStr = accountIdParam && accountInfo ? `${accountInfo.code || accountInfo.accountCode || ''} — ${accountInfo.name || accountInfo.accountName || ''}` : '';

    let tableRows = list.map((e: any) => `
      <tr>
        <td>${e.date ? fmtDate(e.date) : '—'}</td>
        <td>${e.entryNumber || '—'}</td>
        <td>${e.description || '—'}</td>
        <td>${e.source || '—'}</td>
        <td class="r">${e.totalDebits > 0 ? fmtNaira(Number(e.totalDebits)) : '—'}</td>
        <td class="r">${e.totalCredits > 0 ? fmtNaira(Number(e.totalCredits)) : '—'}</td>
      </tr>
    `).join('');

    const bodyHtml = `
      ${filterStr ? `<p style="font-size:12px;color:#64748b;margin-bottom:8px">Account: ${filterStr}</p>` : ''}
      <p style="font-size:11px;color:#64748b;margin-bottom:16px">Period: ${periodStr}</p>
      <table>
        <thead><tr><th>Date</th><th>Entry #</th><th>Description</th><th>Source</th><th class="r">Debit (₦)</th><th class="r">Credit (₦)</th></tr></thead>
        <tbody>${tableRows}</tbody>
        <tfoot>
          <tr style="font-weight:700;border-top:2px solid #0f172a;background:#f1f5f9">
            <td colspan="4" style="padding:10px 12px;font-size:12px">Total</td>
            <td class="r" style="padding:10px 12px;font-size:12px">${fmtNaira(totalDr)}</td>
            <td class="r" style="padding:10px 12px;font-size:12px">${fmtNaira(totalCr)}</td>
          </tr>
        </tfoot>
      </table>
    `;

    printWindow('General Ledger', bodyHtml, periodStr);
  }

  if (viewEntryId && journalDetail) {
    const entry = journalDetail as any;
    const lines = entry.lines || [];
    return (
      <div className="p-6">
        <button onClick={() => setViewEntryId(null)} className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-1 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to General Ledger
        </button>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">Journal Entry — {entry.entryNumber}</h2>
          <div className="grid grid-cols-2 gap-4 mb-4 text-sm text-gray-600">
            <div><span className="font-medium">Date:</span> {fmtDate(entry.date)}</div>
            <div><span className="font-medium">Source:</span> {entry.source || '—'}</div>
            <div className="col-span-2"><span className="font-medium">Description:</span> {entry.description || '—'}</div>
            {entry.reference && <div className="col-span-2"><span className="font-medium">Reference:</span> {entry.reference}</div>}
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-1.5 px-2">Account</th>
                <th className="text-left py-1.5 px-2">Description</th>
                <th className="text-right py-1.5 px-2">Debit (₦)</th>
                <th className="text-right py-1.5 px-2">Credit (₦)</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line: any, i: number) => (
                <tr key={line.id || i} className="border-b border-gray-100">
                  <td className="py-1.5 px-2">{(line.accountCode ? `${line.accountCode} — ` : '') + (line.accountName || line.accountId || '—')}</td>
                  <td className="py-1.5 px-2">{line.description || '—'}</td>
                  <td className="py-1.5 px-2 text-right">{line.debitAmount > 0 ? fmtNaira(line.debitAmount) : '—'}</td>
                  <td className="py-1.5 px-2 text-right">{line.creditAmount > 0 ? fmtNaira(line.creditAmount) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold border-t-2 border-gray-300">
                <td className="py-1.5 px-2" colSpan={2}>Totals</td>
                <td className="py-1.5 px-2 text-right">{fmtNaira(lines.reduce((s: number, l: any) => s + Number(l.debitAmount || 0), 0))}</td>
                <td className="py-1.5 px-2 text-right">{fmtNaira(lines.reduce((s: number, l: any) => s + Number(l.creditAmount || 0), 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }

  const list = Array.isArray(journals) ? journals : [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">General Ledger</h1>
          <p className="text-sm text-gray-500">All journal entries across the organisation</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={printReport} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2">
            <FileText className="w-4 h-4" /> PDF
          </button>
          <button onClick={exportCsv} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <Download className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">From Date</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To Date</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm" />
          </div>
          {(fromDate || toDate) && (
            <button onClick={() => { setFromDate(''); setToDate(''); }}
              className="text-sm text-blue-600 hover:text-blue-800 mt-5">Clear</button>
          )}
        </div>
        {accountIdParam && accountInfo && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-gray-500">Filtered by account:</span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-medium text-xs">
              {accountInfo.code || accountInfo.accountCode || ''} — {accountInfo.name || accountInfo.accountName || accountIdParam}
            </span>
            <button onClick={() => setSearchParams({})}
              className="text-xs text-red-600 hover:text-red-800 underline">Clear filter</button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No journal entries found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Date</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Entry #</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Description</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Source</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Total Debits (₦)</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Total Credits (₦)</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((entry: any) => (
                <tr key={entry.id} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setViewEntryId(entry.id)}>
                  <td className="py-3 px-4 text-gray-700">{fmtDate(entry.date)}</td>
                  <td className="py-3 px-4 font-mono text-blue-600">{entry.entryNumber}</td>
                  <td className="py-3 px-4 text-gray-700 max-w-xs truncate">{entry.description || '—'}</td>
                  <td className="py-3 px-4 text-gray-500 capitalize">{entry.source || '—'}</td>
                  <td className="py-3 px-4 text-right font-mono">{fmtNaira(entry.totalDebits || 0)}</td>
                  <td className="py-3 px-4 text-right font-mono">{fmtNaira(entry.totalCredits || 0)}</td>
                  <td className="py-3 px-4 text-right">
                    <Eye className="w-4 h-4 text-gray-400 inline" />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 font-bold bg-gray-50">
                <td className="py-3 px-4" colSpan={4}>Total</td>
                <td className="py-3 px-4 text-right">{fmtNaira(list.reduce((s: number, e: any) => s + Number(e.totalDebits || 0), 0))}</td>
                <td className="py-3 px-4 text-right">{fmtNaira(list.reduce((s: number, e: any) => s + Number(e.totalCredits || 0), 0))}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
export function VATReturnPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  const { data: vatData, isLoading, error: vatError, refetch } = useQuery({
    queryKey: ['vat-return', startDate, endDate],
    queryFn: () => vatApi.getReturn({ startDate, endDate }),
    enabled: !!startDate && !!endDate,
  });

  const { data: periodsData } = useQuery({
    queryKey: ['vat-periods'],
    queryFn: () => vatApi.getPeriods(),
  });

  const { data: settingsData } = useQuery({
    queryKey: ['vat-settings'],
    queryFn: () => vatApi.getSettings(),
  });

  const settleMutation = useMutation({
    mutationFn: (data: any) => vatApi.settle(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vat-periods'] });
      queryClient.invalidateQueries({ queryKey: ['vat-return'] });
    },
  });

  function fmtNaira(v: number): string {
    return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  }

  function fmtDate(d: string): string {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function handleGenerate() {
    refetch();
  }

  function handleSettle() {
    if (!vatData) return;
    settleMutation.mutate({
      startDate,
      endDate,
      totalOutputVat: vatData.totalOutputVat,
      totalInputVat: vatData.totalInputVat,
    });
  }

  function handlePrint() {
    const periodLabel = new Date(startDate).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const output = vatData || {};
    const totalOutput = output.totalOutputVat || 0;
    const totalInput = output.totalInputVat || 0;
    const netPayable = output.netVatPayable || 0;
    const netRefundable = output.netVatRefundable || 0;
    const etr = totalOutput > 0 ? 7.5 : 0;

    printWindow('VAT Return',
      `<div style="text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #e2e8f0">
        <h1 style="margin:4px 0;font-size:18px;color:#0f172a">VAT COMPUTATION SCHEDULE</h1>
        <p style="margin:2px 0;font-size:11px;color:#64748b">Tax Period: ${periodLabel}</p>
        <p style="margin:2px 0;font-size:11px;color:#64748b">TIN: ${settingsData?.vatNumber || '—'}</p>
        <p style="margin:2px 0;font-size:11px;color:#64748b">Due Date: 21 ${new Date(endDate).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>
      </div>
      <h3 style="font-size:13px;color:#0f172a;margin:12px 0 8px">PART A — OUTPUT TAX (Sales)</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <thead><tr style="background:#f1f5f9"><th style="padding:6px 8px;font-size:10px;text-align:left">Category</th><th style="padding:6px 8px;font-size:10px;text-align:right">Gross (₦)</th><th style="padding:6px 8px;font-size:10px;text-align:right">VAT (₦)</th></tr></thead>
        <tbody>
          <tr><td style="padding:4px 8px;font-size:10px">Standard Rated Sales</td><td style="padding:4px 8px;font-size:10px;text-align:right">${fmtNaira(output.standardRatedSales?.grossAmount || 0)}</td><td style="padding:4px 8px;font-size:10px;text-align:right">${fmtNaira(totalOutput)}</td></tr>
          <tr style="font-weight:700;border-top:1px solid #94a3b8"><td style="padding:4px 8px;font-size:10px">TOTAL OUTPUT VAT</td><td></td><td style="padding:4px 8px;font-size:10px;text-align:right">${fmtNaira(totalOutput)}</td></tr>
        </tbody>
      </table>
      <h3 style="font-size:13px;color:#0f172a;margin:12px 0 8px">PART B — INPUT TAX (Purchases)</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <thead><tr style="background:#f1f5f9"><th style="padding:6px 8px;font-size:10px;text-align:left">Category</th><th style="padding:6px 8px;font-size:10px;text-align:right">Gross (₦)</th><th style="padding:6px 8px;font-size:10px;text-align:right">VAT (₦)</th></tr></thead>
        <tbody>
          <tr><td style="padding:4px 8px;font-size:10px">Standard Rated Purchases</td><td style="padding:4px 8px;font-size:10px;text-align:right">${fmtNaira(output.inputPurchases?.grossAmount || 0)}</td><td style="padding:4px 8px;font-size:10px;text-align:right">${fmtNaira(totalInput)}</td></tr>
          <tr style="font-weight:700;border-top:1px solid #94a3b8"><td style="padding:4px 8px;font-size:10px">TOTAL RECOVERABLE INPUT VAT</td><td></td><td style="padding:4px 8px;font-size:10px;text-align:right">${fmtNaira(totalInput)}</td></tr>
        </tbody>
      </table>
      <h3 style="font-size:13px;color:#0f172a;margin:12px 0 8px">PART C — NET VAT</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <tbody>
          <tr><td style="padding:4px 8px;font-size:10px">Total Output VAT</td><td style="padding:4px 8px;font-size:10px;text-align:right">${fmtNaira(totalOutput)}</td></tr>
          <tr><td style="padding:4px 8px;font-size:10px">Less: Recoverable Input VAT</td><td style="padding:4px 8px;font-size:10px;text-align:right">(${fmtNaira(totalInput)})</td></tr>
          <tr style="font-weight:700;border-top:2px solid #0f172a"><td style="padding:6px 8px;font-size:11px">NET VAT ${netPayable > 0 ? 'PAYABLE' : 'REFUNDABLE'}</td><td style="padding:6px 8px;font-size:11px;text-align:right">${fmtNaira(netPayable > 0 ? netPayable : netRefundable)}</td></tr>
        </tbody>
      </table>`,
      `Period: ${periodLabel}`
    );
  }

  const periods = Array.isArray(periodsData) ? periodsData : [];
  const netPayable = vatData?.netVatPayable || 0;
  const netRefundable = vatData?.netVatRefundable || 0;
  const totalOutput = vatData?.totalOutputVat || 0;
  const totalInput = vatData?.totalInputVat || 0;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">VAT Return</h1>
          <p className="text-sm text-gray-500">FIRS Form 002 — VAT Computation Schedule</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handlePrint} className="px-4 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50 flex items-center gap-2">
            <Download className="w-4 h-4" /> Print
          </button>
          <button onClick={handleSettle} disabled={settleMutation.isPending || !vatData}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {settleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            File & Post Settlement
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Period From</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Period To</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm" />
          </div>
          <button onClick={handleGenerate}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 mt-5">
            Generate Return
          </button>
        </div>
      </div>

      {settleMutation.isSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-800">VAT Settlement Posted</p>
            <p className="text-xs text-green-600">Journal entry created. The VAT period has been marked as filed.</p>
          </div>
        </div>
      )}

      {settleMutation.isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Settlement Failed</p>
            <p className="text-xs text-red-600">{(settleMutation.error as any)?.message || 'An error occurred.'}</p>
          </div>
        </div>
      )}

      {vatError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">VAT Return Error</p>
            <p className="text-xs text-red-600">{(vatError as any)?.message || 'Failed to load VAT return data.'}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : vatData ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* PART A — Output VAT */}
            <div className="bg-white rounded-lg shadow">
              <div className="bg-gray-50 rounded-t-lg px-6 py-3 border-b">
                <h3 className="font-semibold text-sm text-gray-700">PART A — Output Tax (Sales)</h3>
              </div>
              <div className="p-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 font-medium text-gray-500">Category</th>
                      <th className="text-right py-2 font-medium text-gray-500">Gross Sales (₦)</th>
                      <th className="text-right py-2 font-medium text-gray-500">VAT Rate</th>
                      <th className="text-right py-2 font-medium text-gray-500">Output VAT (₦)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="py-3">Standard Rated Sales</td>
                      <td className="py-3 text-right font-mono">{fmtNaira(vatData.standardRatedSales?.grossAmount || 0)}</td>
                      <td className="py-3 text-right">7.5%</td>
                      <td className="py-3 text-right font-mono font-semibold">{fmtNaira(totalOutput)}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-3">Zero Rated Sales</td>
                      <td className="py-3 text-right font-mono">₦0.00</td>
                      <td className="py-3 text-right">0%</td>
                      <td className="py-3 text-right font-mono">₦0.00</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-3">Exempt Sales</td>
                      <td className="py-3 text-right font-mono">₦0.00</td>
                      <td className="py-3 text-right">N/A</td>
                      <td className="py-3 text-right font-mono">₦0.00</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="font-bold border-t-2 border-gray-300 bg-gray-50">
                      <td className="py-3">TOTAL OUTPUT VAT</td>
                      <td></td>
                      <td></td>
                      <td className="py-3 text-right font-mono">{fmtNaira(totalOutput)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* PART B — Input VAT */}
            <div className="bg-white rounded-lg shadow">
              <div className="bg-gray-50 rounded-t-lg px-6 py-3 border-b">
                <h3 className="font-semibold text-sm text-gray-700">PART B — Input Tax (Purchases)</h3>
              </div>
              <div className="p-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 font-medium text-gray-500">Category</th>
                      <th className="text-right py-2 font-medium text-gray-500">Gross Purchases (₦)</th>
                      <th className="text-right py-2 font-medium text-gray-500">VAT Paid (₦)</th>
                      <th className="text-right py-2 font-medium text-gray-500">Recoverable (₦)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="py-3">Standard Rated Purchases</td>
                      <td className="py-3 text-right font-mono">{fmtNaira(vatData.inputPurchases?.grossAmount || 0)}</td>
                      <td className="py-3 text-right font-mono">{fmtNaira(totalInput)}</td>
                      <td className="py-3 text-right font-mono font-semibold">{fmtNaira(totalInput)}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="font-bold border-t-2 border-gray-300 bg-gray-50">
                      <td className="py-3">TOTAL RECOVERABLE INPUT VAT</td>
                      <td></td>
                      <td></td>
                      <td className="py-3 text-right font-mono">{fmtNaira(totalInput)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* PART C — Net VAT sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow">
              <div className="bg-gray-50 rounded-t-lg px-6 py-3 border-b">
                <h3 className="font-semibold text-sm text-gray-700">PART C — Net VAT Position</h3>
              </div>
              <div className="p-6">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Output VAT</span>
                    <span className="font-mono font-semibold">{fmtNaira(totalOutput)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Less: Recoverable Input VAT</span>
                    <span className="font-mono text-red-600">({fmtNaira(totalInput)})</span>
                  </div>
                  <hr className="border-gray-300" />
                  <div className="flex justify-between text-base font-bold">
                    <span>NET VAT {netPayable > 0 ? 'PAYABLE' : 'REFUNDABLE'}</span>
                    <span className={`font-mono ${netPayable > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {fmtNaira(netPayable > 0 ? netPayable : netRefundable)}
                    </span>
                  </div>
                  {netPayable > 0 && (
                    <p className="text-xs text-gray-500 mt-2">Due to FIRS by 21st of next month</p>
                  )}
                  {netRefundable > 0 && (
                    <p className="text-xs text-gray-500 mt-2">Excess input VAT — carry forward or claim refund</p>
                  )}
                </div>
              </div>
            </div>

            {/* VAT Periods sidebar */}
            <div className="bg-white rounded-lg shadow">
              <div className="bg-gray-50 rounded-t-lg px-6 py-3 border-b">
                <h3 className="font-semibold text-sm text-gray-700">Filing History</h3>
              </div>
              <div className="p-6">
                {periods.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No returns filed yet</p>
                ) : (
                  <div className="space-y-3">
                    {periods.slice(0, 6).map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium text-gray-700">{p.periodLabel}</p>
                          <p className="text-xs text-gray-400">{new Date(p.filedAt || p.createdAt).toLocaleDateString('en-GB')}</p>
                        </div>
                        <span className={`text-xs font-medium px-2 py-1 rounded ${
                          p.status === 'filed' ? 'bg-blue-100 text-blue-700' :
                          p.status === 'paid' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {(p.status || 'draft').charAt(0).toUpperCase() + (p.status || 'draft').slice(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Select a period and click "Generate Return"</p>
        </div>
      )}
    </div>
  );
}
export function ProjectsReportPage() {
  return <ProjectsReport />;
}

function ProjectsReport() {
  const { startDate, endDate: defaultEnd } = getDefaultDateRange();
  const [sDate, setSDate] = useState(startDate);
  const [eDate, setEDate] = useState(defaultEnd);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
    staleTime: 60000,
  });

  const { data: summaryData, isLoading, isError, error } = useQuery({
    queryKey: ['project-summary', sDate, eDate],
    queryFn: async () => {
      const res = await api.get('/reports/project-summary', { params: { startDate: sDate, endDate: eDate } });
      return res.data;
    },
  });

  const { data: detailData } = useQuery({
    queryKey: ['project-income-expense', selectedProjectId, sDate, eDate],
    queryFn: async () => {
      if (!selectedProjectId) return null;
      const res = await api.get('/reports/project-income-expense', { params: { projectId: selectedProjectId, startDate: sDate, endDate: eDate } });
      return res.data;
    },
    enabled: !!selectedProjectId,
  });

  const summaryList = Array.isArray(summaryData) ? summaryData : [];
  const selectedProject = (Array.isArray(projects) ? projects : []).find((p: any) => p.id === selectedProjectId);

  function handlePrintPdf() {
    const rows = summaryList.map((p: any) =>
      `<tr><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e2e8f0">${p.name}</td><td style="padding:8px 12px;font-size:12px;font-family:monospace;border-bottom:1px solid #e2e8f0">${p.code || '—'}</td><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e2e8f0">${p.status || 'active'}</td><td style="padding:8px 12px;font-size:12px;text-align:right;font-family:monospace;border-bottom:1px solid #e2e8f0">${fmtNaira(p.totalIncome)}</td><td style="padding:8px 12px;font-size:12px;text-align:right;font-family:monospace;border-bottom:1px solid #e2e8f0">${fmtNaira(p.totalExpenses)}</td><td style="padding:8px 12px;font-size:12px;text-align:right;font-family:monospace;font-weight:600;border-bottom:1px solid #e2e8f0">${fmtNaira(p.profit)}</td></tr>`
    ).join('');
    const totalIncome = summaryList.reduce((s: number, p: any) => s + p.totalIncome, 0);
    const totalExpenses = summaryList.reduce((s: number, p: any) => s + p.totalExpenses, 0);
    const totalProfit = summaryList.reduce((s: number, p: any) => s + p.profit, 0);
    const summaryTable = summaryList.length > 0 ? `
      <h3 style="font-size:14px;font-weight:600;color:#0f172a;margin:0 0 8px">${selectedProjectId ? selectedProject?.name || 'Project Detail' : 'Project Summary'}</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <thead><tr style="background:#f1f5f9">
          <th style="padding:8px 12px;font-size:10px;font-weight:600;color:#475569;text-align:left;text-transform:uppercase">Project</th>
          <th style="padding:8px 12px;font-size:10px;font-weight:600;color:#475569;text-align:left;text-transform:uppercase">Code</th>
          <th style="padding:8px 12px;font-size:10px;font-weight:600;color:#475569;text-align:left;text-transform:uppercase">Status</th>
          <th style="padding:8px 12px;font-size:10px;font-weight:600;color:#475569;text-align:right;text-transform:uppercase">Income</th>
          <th style="padding:8px 12px;font-size:10px;font-weight:600;color:#475569;text-align:right;text-transform:uppercase">Expenses</th>
          <th style="padding:8px 12px;font-size:10px;font-weight:600;color:#475569;text-align:right;text-transform:uppercase">Profit / Loss</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr style="background:#f8fafc;font-weight:700">
          <td colspan="3" style="padding:8px 12px;font-size:12px;border-top:2px solid #cbd5e1">TOTAL</td>
          <td style="padding:8px 12px;font-size:12px;text-align:right;font-family:monospace;border-top:2px solid #cbd5e1">${fmtNaira(totalIncome)}</td>
          <td style="padding:8px 12px;font-size:12px;text-align:right;font-family:monospace;border-top:2px solid #cbd5e1">${fmtNaira(totalExpenses)}</td>
          <td style="padding:8px 12px;font-size:12px;text-align:right;font-family:monospace;border-top:2px solid #cbd5e1">${fmtNaira(totalProfit)}</td>
        </tr></tfoot>
      </table>` : '';

    let detailHtml = '';
    if (detailData) {
      const incRows = (detailData.income || []).map((a: any) =>
        `<tr><td style="padding:6px 10px;font-size:11px;border-bottom:1px solid #f1f5f9">${a.code} - ${a.name}</td><td style="padding:6px 10px;font-size:11px;text-align:right;font-family:monospace;border-bottom:1px solid #f1f5f9">${fmtNaira(a.amount)}</td></tr>`
      ).join('');
      const expRows = (detailData.expenses || []).map((a: any) =>
        `<tr><td style="padding:6px 10px;font-size:11px;border-bottom:1px solid #f1f5f9">${a.code} - ${a.name}</td><td style="padding:6px 10px;font-size:11px;text-align:right;font-family:monospace;border-bottom:1px solid #f1f5f9">${fmtNaira(a.amount)}</td></tr>`
      ).join('');
      detailHtml = `
        <h3 style="font-size:14px;font-weight:600;color:#0f172a;margin:16px 0 8px">${selectedProject?.name || 'Project'} Detail</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          <tr><td style="padding:8px 12px;font-size:12px;font-weight:600">Income</td><td style="padding:8px 12px;font-size:12px;text-align:right;font-family:monospace">${fmtNaira(detailData.totalIncome)}</td></tr>
          <tr><td style="padding:8px 12px;font-size:12px;font-weight:600">Expenses</td><td style="padding:8px 12px;font-size:12px;text-align:right;font-family:monospace">${fmtNaira(detailData.totalExpenses)}</td></tr>
          <tr><td style="padding:8px 12px;font-size:12px;font-weight:600">Profit / Loss</td><td style="padding:8px 12px;font-size:12px;text-align:right;font-family:monospace">${fmtNaira(detailData.profit)}</td></tr>
        </table>
        <div style="display:flex;gap:24px">
          <div style="flex:1">
            <h4 style="font-size:12px;font-weight:600;color:#475569;margin:0 0 6px">Income Breakdown</h4>
            <table style="width:100%;border-collapse:collapse">${incRows || '<tr><td style="padding:6px 10px;font-size:11px;color:#94a3b8">No income</td></tr>'}</table>
          </div>
          <div style="flex:1">
            <h4 style="font-size:12px;font-weight:600;color:#475569;margin:0 0 6px">Expense Breakdown</h4>
            <table style="width:100%;border-collapse:collapse">${expRows || '<tr><td style="padding:6px 10px;font-size:11px;color:#94a3b8">No expenses</td></tr>'}</table>
          </div>
        </div>`;
    }

    printWindow('Project Report',
      `<p style="font-size:11px;color:#64748b;margin:0 0 16px">Period: ${new Date(sDate).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})} – ${new Date(eDate).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})} &middot; ${summaryList.length} project${summaryList.length !== 1 ? 's' : ''}</p>
      ${summaryTable}
      ${detailHtml}`,
      `${new Date(sDate).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})} – ${new Date(eDate).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}`
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Briefcase className="w-6 h-6 text-indigo-600" /> Project Report
        </h1>
        <button onClick={handlePrintPdf} disabled={summaryList.length === 0 && !detailData}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200 shadow-sm shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed">
          <Download className="w-3.5 h-3.5" /> PDF
        </button>
      </div>

      {/* Date filter */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">From:</label>
          <input type="date" value={sDate} onChange={e => setSDate(e.target.value)}
            className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">To:</label>
          <input type="date" value={eDate} onChange={e => setEDate(e.target.value)}
            className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">Project:</label>
          <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)}
            className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow bg-white">
            <option value="">All projects (summary)</option>
            {Array.isArray(projects) && projects.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <span className="text-xs text-slate-400 font-medium whitespace-nowrap">{summaryList.length} project{summaryList.length !== 1 ? 's' : ''}</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
      ) : selectedProjectId && detailData ? (
        /* Detail view for a single project */
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-1">{selectedProject?.name || 'Project'}</h2>
            <p className="text-xs text-slate-400 mb-4">{selectedProject?.code ? `Code: ${selectedProject.code}` : ''} {selectedProjectId ? `· ID: ${selectedProjectId}` : ''}</p>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200/50">
                <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Income</p>
                <p className="text-xl font-bold text-emerald-700 mt-1">{fmtNaira(detailData.totalIncome)}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4 border border-red-200/50">
                <p className="text-[11px] font-semibold text-red-600 uppercase tracking-wider">Expenses</p>
                <p className="text-xl font-bold text-red-700 mt-1">{fmtNaira(detailData.totalExpenses)}</p>
              </div>
              <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200/50">
                <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider">Profit / Loss</p>
                <p className={`text-xl font-bold mt-1 ${detailData.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmtNaira(detailData.profit)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Income Breakdown</h3>
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider"><th className="px-3 py-2 text-left">Account</th><th className="px-3 py-2 text-right">Amount</th></tr></thead>
                  <tbody>
                    {detailData.income?.length ? detailData.income.map((a: any, i: number) => (
                      <tr key={i} className="border-t border-slate-100"><td className="px-3 py-2 text-slate-700">{a.code} - {a.name}</td><td className="px-3 py-2 text-right font-mono text-slate-900">{fmtNaira(a.amount)}</td></tr>
                    )) : <tr><td colSpan={2} className="px-3 py-4 text-center text-slate-400">No income recorded</td></tr>}
                    {detailData.income?.length > 0 && (
                      <tr className="border-t-2 border-slate-200 font-bold bg-slate-50"><td className="px-3 py-2 text-slate-800">Total Income</td><td className="px-3 py-2 text-right font-mono text-slate-900">{fmtNaira(detailData.totalIncome)}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Expense Breakdown</h3>
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider"><th className="px-3 py-2 text-left">Account</th><th className="px-3 py-2 text-right">Amount</th></tr></thead>
                  <tbody>
                    {detailData.expenses?.length ? detailData.expenses.map((a: any, i: number) => (
                      <tr key={i} className="border-t border-slate-100"><td className="px-3 py-2 text-slate-700">{a.code} - {a.name}</td><td className="px-3 py-2 text-right font-mono text-slate-900">{fmtNaira(a.amount)}</td></tr>
                    )) : <tr><td colSpan={2} className="px-3 py-4 text-center text-slate-400">No expenses recorded</td></tr>}
                    {detailData.expenses?.length > 0 && (
                      <tr className="border-t-2 border-slate-200 font-bold bg-slate-50"><td className="px-3 py-2 text-slate-800">Total Expenses</td><td className="px-3 py-2 text-right font-mono text-slate-900">{fmtNaira(detailData.totalExpenses)}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <button onClick={() => setSelectedProjectId('')}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">← Back to project summary</button>
        </div>
      ) : (
        /* Summary view — all projects */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-3 text-left">Project</th>
                <th className="px-3 py-3 text-left">Code</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-right">Income</th>
                <th className="px-3 py-3 text-right">Expenses</th>
                <th className="px-3 py-3 text-right">Profit / Loss</th>
                <th className="px-3 py-3 text-center">Drill-down</th>
              </tr>
            </thead>
            <tbody>
              {summaryList.map((p: any, i: number) => (
                <tr key={p.id} className="hover:bg-slate-50/50 border-t border-slate-100 cursor-pointer" onClick={() => setSelectedProjectId(p.id)}>
                  <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-3 font-mono text-slate-600">{p.code || '—'}</td>
                  <td className="px-4 py-3"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${p.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'}`}>{p.status || 'active'}</span></td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-700">{fmtNaira(p.totalIncome)}</td>
                  <td className="px-4 py-3 text-right font-mono text-red-600">{fmtNaira(p.totalExpenses)}</td>
                  <td className={`px-4 py-3 text-right font-mono font-semibold ${p.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmtNaira(p.profit)}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={(e) => { e.stopPropagation(); setSelectedProjectId(p.id); }} className="text-indigo-600 hover:text-indigo-800 p-1"><ChevronRight className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {summaryList.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">No data for this period.</td></tr>
              )}
            </tbody>
            {summaryList.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td colSpan={3} className="px-4 py-3 text-slate-800">TOTAL</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-600">{fmtNaira(summaryList.reduce((s: number, p: any) => s + p.totalIncome, 0))}</td>
                  <td className="px-4 py-3 text-right font-mono text-red-600">{fmtNaira(summaryList.reduce((s: number, p: any) => s + p.totalExpenses, 0))}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-800">{fmtNaira(summaryList.reduce((s: number, p: any) => s + p.profit, 0))}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

function ReportShell({ reportType, title }: ReportPageProps) {
  const { startDate, endDate } = getDefaultDateRange();
  const [sDate, setSDate] = useState(startDate);
  const [eDate, setEDate] = useState(endDate);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [drillDown, setDrillDown] = useState<any | null>(null);
  const [showZero, setShowZero] = useState(() => localStorage.getItem('bs_showZero') !== 'true');
  const [showCodes, setShowCodes] = useState(() => localStorage.getItem('bs_showCodes') === 'true');
  const [isShowZero, setIsShowZero] = useState(() => localStorage.getItem('is_showZero') !== 'false');
  const [isShowCodes, setIsShowCodes] = useState(() => localStorage.getItem('is_showCodes') === 'true');
  const [cfShowZero, setCfShowZero] = useState(() => localStorage.getItem('cf_showZero') !== 'false');
  const [cfShowCodes, setCfShowCodes] = useState(() => localStorage.getItem('cf_showCodes') === 'true');

  const isBalanceSheet = reportType === 'balance-sheet';
  const isAgedReport = reportType === 'aged-receivables' || reportType === 'aged-payables';
  const isComparativeReport = !isAgedReport;

  const defaultCompare = getDefaultCompareDates(sDate, eDate);
  const defaultBSCompare = getDefaultCompareAsOf(asOfDate);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compareSDate, setCompareSDate] = useState(defaultCompare.compareStart);
  const [compareEDate, setCompareEDate] = useState(defaultCompare.compareEnd);
  const [compareAsOf, setCompareAsOf] = useState(defaultBSCompare);

  // Recompute default compare dates when main dates change (only if compare not manually toggled)
  React.useEffect(() => {
    if (!compareEnabled) {
      try {
        const d = getDefaultCompareDates(sDate, eDate);
        if (d.compareStart) setCompareSDate(d.compareStart);
        if (d.compareEnd) setCompareEDate(d.compareEnd);
        const a = getDefaultCompareAsOf(asOfDate);
        if (a) setCompareAsOf(a);
      } catch { /* ignore invalid dates while typing */ }
    }
  }, [sDate, eDate, asOfDate]);

  const { data: orgData } = useQuery({ queryKey: ['org'], queryFn: orgApi.getOrg });

  const { data, isLoading, error } = useQuery({
    queryKey: ['report', reportType, sDate, eDate, asOfDate, compareEnabled, compareSDate, compareEDate, compareAsOf],
    queryFn: async () => {
      if (isBalanceSheet) {
        const params: any = { asOfDate, format: 'json' };
        if (compareEnabled) params.compareAsOf = compareAsOf;
        const res = await reportsApi.getBalanceSheet(params);
        return res.data || res;
      }
      if (isAgedReport) {
        if (reportType === 'aged-receivables') {
          const res = await reportsApi.getAgedReceivables({ format: 'json' });
          const report = res.report || res.data || res;
          const rows = (report?.byCustomer || []).map((r: any) => ({ name: r.customerName, entityId: r.customerId, current: r.current, days1to30: r.days1To30, days31to60: r.days31To60, days61to90: r.days61To90, days90Plus: r.daysOver90, total: r.totalOutstanding }));
          return { rows, invoices: report?.invoices || [] };
        }
        const res = await reportsApi.getAgedPayables({ format: 'json' });
        const report = res.report || res.data || res;
        const rows = (report?.byVendor || []).map((r: any) => ({ name: r.vendorName, entityId: r.vendorId, current: r.current, days1to30: r.days1To30, days31to60: r.days31To60, days61to90: r.days61To90, days90Plus: r.daysOver90, total: r.totalOutstanding }));
        return { rows, bills: report?.bills || [] };
      }
      if (reportType === 'cash-flow') {
        const params: any = { startDate: sDate, endDate: eDate, format: 'json' };
        const res = await reportsApi.getCashFlow(params);
        return res.data || res;
      }
      const params: any = { startDate: sDate, endDate: eDate, format: 'json' };
      if (compareEnabled) {
        params.compareStart = compareSDate;
        params.compareEnd = compareEDate;
      }
      const res = await reportsApi.getIncomeStatement(params);
      return res.data || res;
    },
  });

  const handleExport = (format: 'pdf' | 'excel' | 'csv') => {
    if (format === 'csv') {
      const today = new Date().toISOString().split('T')[0];
      let headers: string[];
      let csvRows: string[][];
      if (reportType === 'income-statement') {
        headers = ['Account', 'Amount'];
        csvRows = [];
        const isData = (data as any)?.current || data || {};
        const opRev = isData.operatingRevenue || {};
        const ooi = isData.otherOperatingIncome || {};
        const cos = isData.costOfSales || {};
        const sc = isData.staffCosts || {};
        const adm = isData.administrative || {};
        const sd = isData.sellingDistribution || {};
        const ooe = isData.otherOperatingExpenses || {};
        const fi = isData.financeIncome || {};
        const fc = isData.financeCosts || {};
        const tx = isData.incomeTaxExpense || {};
        const opRevTotal = opRev.total || 0;
        const ooiTotal = ooi.total || 0;
        const totalRevenue = isData.totalRevenue ?? (opRevTotal + ooiTotal);
        const cosTotal = cos.total || 0;
        const grossProfit = isData.grossProfit ?? (totalRevenue - cosTotal);
        const scTotal = sc.total || 0;
        const admTotal = adm.total || 0;
        const sdTotal = sd.total || 0;
        const ooeTotal = ooe.total || 0;
        const opExTotal = isData.totalOperatingExpenses ?? (scTotal + admTotal + sdTotal + ooeTotal);
        const operatingProfit = isData.operatingProfit ?? (grossProfit - opExTotal);
        const fiTotal = fi.total || 0;
        const fcTotal = fc.total || 0;
        const pbt = isData.profitBeforeTax ?? (operatingProfit + fiTotal - fcTotal);
        const txTotal = tx.total || 0;
        const netProfit = isData.netProfit ?? (pbt - txTotal);
        const etr = isData.effectiveTaxRate ?? (pbt > 0 ? Math.round((txTotal / pbt) * 1000) / 10 : 0);
        const addSec = (label: string, accounts: any[], total: number) => {
          csvRows.push([label, '']);
          (accounts || []).forEach((a: any) => csvRows.push([a.name, ((a.balance||0)/100).toFixed(2)]));
          csvRows.push([`Total ${label}`, (total/100).toFixed(2)]);
        };
        const addSubSec = (label: string, data: any) => {
          if (!data || !data.accounts || !data.accounts.length) return;
          csvRows.push([label, '']);
          data.accounts.forEach((a: any) => csvRows.push([a.name, ((a.balance||0)/100).toFixed(2)]));
          csvRows.push([`Total ${label}`, (data.total/100).toFixed(2)]);
        };
        addSec('Operating Revenue', opRev.accounts, opRevTotal);
        addSec('Other Operating Income', ooi.accounts, ooiTotal);
        csvRows.push(['TOTAL REVENUE', (totalRevenue/100).toFixed(2)]);
        // Cost of Sales with computed COGS breakdown
        csvRows.push(['Cost of Sales', '']);
        if (cos.openingStock !== undefined) {
          if (Math.abs(cos.openingStock) >= 0.01 || showZero) csvRows.push(['Opening Stock', (cos.openingStock/100).toFixed(2)]);
          if (cos.purchasesOfGoods && (Math.abs(cos.purchasesOfGoods.balance) >= 0.01 || showZero)) csvRows.push([`${cos.purchasesOfGoods.name} (${cos.purchasesOfGoods.code})`, (cos.purchasesOfGoods.balance/100).toFixed(2)]);
          if (Math.abs(cos.closingStock) >= 0.01 || showZero) csvRows.push(['Closing Stock', (-cos.closingStock/100).toFixed(2)]);
          csvRows.push(['Cost of Inventory Sold', (cos.inventorySold/100).toFixed(2)]);
        }
        (cos.accounts || []).forEach((a: any) => csvRows.push([a.name, ((a.balance||0)/100).toFixed(2)]));
        csvRows.push(['Total Cost of Sales', (cosTotal/100).toFixed(2)]);
        csvRows.push(['GROSS PROFIT', (grossProfit/100).toFixed(2)]);
        csvRows.push(['Operating Expenses', '']);
        addSubSec('Staff Costs', sc);
        addSubSec('Administrative Expenses', adm);
        addSubSec('Selling & Distribution Expenses', sd);
        addSubSec('Other Operating Expenses', ooe);
        csvRows.push(['Total Operating Expenses', (opExTotal/100).toFixed(2)]);
        csvRows.push(['OPERATING PROFIT (EBIT)', (operatingProfit/100).toFixed(2)]);
        if (fi.accounts?.length) addSec('Finance Income', fi.accounts, fiTotal);
        if (fc.accounts?.length) addSec('Finance Costs', fc.accounts, fcTotal);
        csvRows.push(['PROFIT BEFORE TAX', (pbt/100).toFixed(2)]);
        if (tx.accounts?.length) addSec('Income Tax Expense', tx.accounts, txTotal);
        csvRows.push(['NET PROFIT AFTER TAX', (netProfit/100).toFixed(2)]);
        if (pbt > 0) csvRows.push([`Effective Tax Rate: ${etr}%`, '']);
      } else {
        const rows = data?.rows || (Array.isArray(data) ? data : []);
        if (!rows.length) return;
        if (reportType === 'aged-receivables' || reportType === 'aged-payables') {
          headers = ['Name', 'Current', '1-30 Days', '31-60 Days', '61-90 Days', '90+ Days', 'Total'];
          csvRows = rows.map((r: any) => [r.name || r.customerName || r.vendorName || '', (r.current/100).toFixed(2), (r.days1to30/100).toFixed(2), (r.days31to60/100).toFixed(2), (r.days61to90/100).toFixed(2), (r.days90Plus/100).toFixed(2), (r.total/100).toFixed(2)]);
        } else if (reportType === 'balance-sheet') {
          headers = ['Account', 'Amount'];
          csvRows = [];
          const bsData = (data as any)?.data || data || {};
          const addCSSec = (label: string, items: any[], total: number) => {
            csvRows.push([label, '']);
            items.forEach((i: any) => csvRows.push([i.name || i.code || '', ((i.balance || 0) / 100).toFixed(2)]));
            csvRows.push([`Total ${label}`, (total / 100).toFixed(2)]);
          };
          const addCSVSection = (label: string, total: number, subSections: any[]) => {
            csvRows.push([`--- ${label} ---`, '']);
            (subSections || []).forEach((sec: any) => {
              if (sec.key === 'ppe' || sec.key === 'rou' || sec.key === 'intangibles') {
                addCSSec(sec.label, [...(sec.items || []), ...(sec.contraItems || []).map((ci: any) => ({ ...ci, balance: -Math.abs(ci.balance || 0) }))], sec.netTotal ?? sec.total);
              } else {
                addCSSec(sec.label, sec.items || [], sec.total || 0);
              }
            });
            csvRows.push([`Total ${label}`, (total / 100).toFixed(2)]);
          };
          const ca = bsData.currentAssets || {};
          const nca = bsData.nonCurrentAssets || {};
          const cl = bsData.currentLiabilities || {};
          const ncl = bsData.nonCurrentLiabilities || {};
          const eq = bsData.equity || {};
          csvRows.push(['ASSETS', '']);
          addCSVSection('Current Assets', ca.total || 0, ca.subSections || []);
          addCSVSection('Non-Current Assets', nca.total || 0, nca.subSections || []);
          csvRows.push(['Total Assets', ((bsData.totalAssets || 0) / 100).toFixed(2)]);
          csvRows.push(['', '']);
          csvRows.push(['LIABILITIES', '']);
          addCSVSection('Current Liabilities', cl.total || 0, cl.subSections || []);
          addCSVSection('Non-Current Liabilities', ncl.total || 0, ncl.subSections || []);
          csvRows.push(['Total Liabilities', ((bsData.totalLiabilities || 0) / 100).toFixed(2)]);
          csvRows.push(['', '']);
          csvRows.push(['EQUITY', '']);
          addCSVSection('Equity', eq.total || 0, eq.subSections || []);
          csvRows.push(['Total Equity', ((bsData.totalEquity || 0) / 100).toFixed(2)]);
          csvRows.push(['Total Liabilities & Equity', (((bsData.totalLiabilities || 0) + (bsData.totalEquity || 0)) / 100).toFixed(2)]);
        } else if (reportType === 'cash-flow') {
          const cf = data?.data || data || {};
          headers = ['Line Item', 'Amount'];
          const flatRows: string[][] = [];
          const addRow = (label: string, amt: number) => flatRows.push([label, (amt/100).toFixed(2)]);
          const operating = cf.operatingActivities || {};
          const investing = cf.investingActivities || {};
          const financing = cf.financingActivities || {};
          addRow('A. OPERATING ACTIVITIES', 0);
          addRow('Net Profit for the Period', cf.netIncome || 0);
          (operating.adjustments || []).forEach((a: any) => addRow(a.name, a.amount));
          addRow('Total Adjustments for Non-Cash Items', operating.adjustmentsTotal || 0);
          (operating.workingCapitalChanges || []).forEach((w: any) => addRow(w.name, w.amount));
          addRow('Total Changes in Working Capital', operating.workingCapitalTotal || 0);
          addRow('Cash Generated from Operations', operating.cashGeneratedFromOperations || 0);
          if (Math.abs(operating.incomeTaxPaid || 0) > 0) addRow('Income Tax Paid', operating.incomeTaxPaid);
          if (Math.abs(operating.interestPaid || 0) > 0) addRow('Interest Paid', operating.interestPaid);
          if (Math.abs(operating.interestReceived || 0) > 0) addRow('Interest Received', operating.interestReceived);
          addRow('Net Cash from Operating Activities', operating.total || 0);
          addRow('B. INVESTING ACTIVITIES', 0);
          (investing.items || []).forEach((iv: any) => addRow(iv.name, iv.amount));
          addRow('Net Cash from Investing Activities', investing.total || 0);
          addRow('C. FINANCING ACTIVITIES', 0);
          (financing.items || []).forEach((fn: any) => addRow(fn.name, fn.amount));
          addRow('Net Cash from Financing Activities', financing.total || 0);
          addRow('Net Increase / (Decrease) in Cash', cf.netChangeInCash || 0);
          addRow('Opening Cash & Cash Equivalents', cf.openingCash || 0);
          addRow('Closing Cash & Cash Equivalents', cf.closingCash || 0);
          addRow('Closing Cash per Ledger', cf.ledgerCashBalance || 0);
          addRow('Difference', cf.reconciliationDiff || 0);
          addRow('Reconciled', cf.reconciled ? 1 : 0);
          csvRows = flatRows;
        } else {
          headers = ['Account Code', 'Account Name', 'Type', 'Debit', 'Credit'];
          csvRows = rows.map((r: any) => [r.code||r.accountCode||'', r.name||r.accountName||'', r.type||r.accountType||'', ((r.debit||r.debitAmount||0)/100).toFixed(2), ((r.credit||r.creditAmount||0)/100).toFixed(2)]);
        }
      }
      exportToCsv(`${reportType}_${today}.csv`, headers, csvRows);
      return;
    }
    if (format === 'pdf') {
      try {
        if (reportType === 'income-statement') {
          const current = (data as any)?.current || data || {};
          const opRev = current.operatingRevenue || {};
          const ooi = current.otherOperatingIncome || {};
          const cos = current.costOfSales || {};
          const sc = current.staffCosts || {};
          const adm = current.administrative || {};
          const sd = current.sellingDistribution || {};
          const ooe = current.otherOperatingExpenses || {};
          const fi = current.financeIncome || {};
          const fc = current.financeCosts || {};
          const tx = current.incomeTaxExpense || {};
          const opRevTotal = opRev.total || 0;
          const ooiTotal = ooi.total || 0;
          const totalRevenue = current.totalRevenue ?? (opRevTotal + ooiTotal);
          const cosTotal = cos.total || 0;
          const grossProfit = current.grossProfit ?? (totalRevenue - cosTotal);
          const scTotal = sc.total || 0;
          const admTotal = adm.total || 0;
          const sdTotal = sd.total || 0;
          const ooeTotal = ooe.total || 0;
          const opExTotal = current.totalOperatingExpenses ?? (scTotal + admTotal + sdTotal + ooeTotal);
          const operatingProfit = current.operatingProfit ?? (grossProfit - opExTotal);
          const fiTotal = fi.total || 0;
          const fcTotal = fc.total || 0;
          const pbt = current.profitBeforeTax ?? (operatingProfit + fiTotal - fcTotal);
          const txTotal = tx.total || 0;
          const netProfit = current.netProfit ?? (pbt - txTotal);
          const etr = current.effectiveTaxRate ?? (pbt > 0 ? Math.round((txTotal / pbt) * 1000) / 10 : 0);
          const org = (orgData as any)?.data || orgData || {};
          const orgName = org.name || '';
          const orgAddr = org.address ? `<p style="margin:0;font-size:11px;color:#475569">${org.address}</p>` : '';
          const orgPhone = org.phone || '';
          const orgEmail = org.email || '';
          const orgWebsite = org.website || '';
          const orgLogo = org.logoUrl ? `<img src="${org.logoUrl}" style="max-height:60px;max-width:200px;object-fit:contain" />` : '';
          const contactInfo = [orgPhone, orgEmail, orgWebsite].filter(Boolean).join(' | ');

          function cogsRows(cos: any) {
            const opening = cos?.openingStock ?? 0;
            const closing = cos?.closingStock ?? 0;
            const invSold = cos?.inventorySold ?? 0;
            const pog = cos?.purchasesOfGoods || null;
            const accounts = cos?.accounts || [];
            const casTotal = cos?.total || 0;
            const hasInvCalc = opening !== 0 || (pog && pog.balance !== 0) || closing !== 0;
            let r = '<tr style="background:#f1f5f9"><td colspan="2" style="padding:6px 12px;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase">Cost of Sales</td></tr>';
            if (hasInvCalc || invSold !== 0) {
              r += '<tr style="background:#f8fafc"><td colspan="2" style="padding:4px 12px;padding-left:28px;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">Cost of Inventory Sold</td></tr>';
              if (opening !== 0) r += `<tr><td style="padding:3px 12px;padding-left:36px;font-size:10px;border-bottom:1px solid #f1f5f9">Opening Stock</td><td style="padding:3px 12px;font-size:10px;text-align:right;font-family:monospace;border-bottom:1px solid #f1f5f9">₦${(opening/100).toLocaleString()}</td></tr>`;
              if (pog && pog.balance !== 0) r += `<tr><td style="padding:3px 12px;padding-left:36px;font-size:10px;border-bottom:1px solid #f1f5f9">${pog.name} (${pog.code})</td><td style="padding:3px 12px;font-size:10px;text-align:right;font-family:monospace;border-bottom:1px solid #f1f5f9">₦${(pog.balance/100).toLocaleString()}</td></tr>`;
              if (closing !== 0) r += `<tr><td style="padding:3px 12px;padding-left:36px;font-size:10px;border-bottom:1px solid #f1f5f9">Closing Stock</td><td style="padding:3px 12px;font-size:10px;text-align:right;font-family:monospace;border-bottom:1px solid #f1f5f9">₦${(-closing/100).toLocaleString()}</td></tr>`;
              r += `<tr style="border-top:1px solid #e2e8f0;background:#f8fafc;font-weight:600"><td style="padding:4px 12px;padding-left:28px;font-size:10px;color:#64748b">Cost of Inventory Sold</td><td style="padding:4px 12px;font-size:10px;text-align:right;font-family:monospace">₦${(invSold/100).toLocaleString()}</td></tr>`;
            }
            const accRows = (accounts || []).map((a: any) =>
              `<tr><td style="padding:4px 12px;padding-left:24px;font-size:11px;border-bottom:1px solid #f1f5f9">${a.name}</td><td style="padding:4px 12px;font-size:11px;text-align:right;font-family:monospace;border-bottom:1px solid #f1f5f9">₦${((a.balance||0)/100).toLocaleString()}</td></tr>`
            ).join('');
            r += accRows;
            r += `<tr style="border-top:1px solid #cbd5e1;background:#f8fafc;font-weight:600"><td style="padding:6px 12px;padding-left:24px;font-size:12px;color:#0f172a">Total Cost of Sales</td><td style="padding:6px 12px;font-size:12px;text-align:right;font-family:monospace">₦${(casTotal/100).toLocaleString()}</td></tr>`;
            return r;
          }
          function secRows(label: string, accounts: any[], total: number) {
            const accRows = (accounts || []).map((a: any) =>
              `<tr><td style="padding:4px 12px;padding-left:24px;font-size:11px;border-bottom:1px solid #f1f5f9">${a.name}</td><td style="padding:4px 12px;font-size:11px;text-align:right;font-family:monospace;border-bottom:1px solid #f1f5f9">₦${((a.balance||0)/100).toLocaleString()}</td></tr>`
            ).join('');
            return `<tr style="background:#f1f5f9"><td colspan="2" style="padding:6px 12px;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase">${label}</td></tr>${accRows}<tr style="border-top:1px solid #cbd5e1;background:#f8fafc;font-weight:600"><td style="padding:6px 12px;padding-left:24px;font-size:12px;color:#0f172a">Total ${label}</td><td style="padding:6px 12px;font-size:12px;text-align:right;font-family:monospace">₦${(total/100).toLocaleString()}</td></tr>`;
          }
          function subSecRows(label: string, data: any) {
            if (!data || !data.accounts || data.accounts.length === 0) return '';
            const accRows = data.accounts.map((a: any) =>
              `<tr><td style="padding:3px 12px;padding-left:36px;font-size:10px;border-bottom:1px solid #f1f5f9">${a.name}</td><td style="padding:3px 12px;font-size:10px;text-align:right;font-family:monospace;border-bottom:1px solid #f1f5f9">₦${((a.balance||0)/100).toLocaleString()}</td></tr>`
            ).join('');
            return `<tr style="background:#f8fafc"><td colspan="2" style="padding:4px 12px;padding-left:28px;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">${label}</td></tr>${accRows}<tr style="border-top:1px solid #e2e8f0;background:#f8fafc;font-weight:600"><td style="padding:4px 12px;padding-left:28px;font-size:10px;color:#64748b">Total ${label}</td><td style="padding:4px 12px;font-size:10px;text-align:right;font-family:monospace">₦${(data.total/100).toLocaleString()}</td></tr>`;
          }

          const summaryRows =
            `<tr style="border-top:2px solid #94a3b8;background:${pbt < 0 ? '#fef2f2' : '#eef2f3'};font-weight:700"><td style="padding:6px 12px;padding-left:24px;font-size:12px;color:${pbt < 0 ? '#dc2626' : '#1e293b'}">PROFIT BEFORE TAX</td><td style="padding:6px 12px;font-size:12px;text-align:right;font-family:monospace;color:${pbt < 0 ? '#dc2626' : '#1e293b'}">₦${(pbt/100).toLocaleString()}</td></tr>` +
            (tx.accounts?.length ? secRows('Income Tax Expense', tx.accounts, txTotal) : '') +
            `<tr style="border-top:3px double #0f172a;background:#f8fafc;font-weight:700"><td style="padding:8px 12px;padding-left:24px;font-size:13px;color:#0f172a">NET PROFIT AFTER TAX</td><td style="padding:8px 12px;font-size:13px;text-align:right;font-family:monospace;color:#0f172a">₦${(netProfit/100).toLocaleString()}</td></tr>` +
            (pbt > 0 ? `<tr style="background:#f8fafc"><td colspan="2" style="padding:4px 12px;font-size:10px;color:#64748b;font-style:italic">Effective Tax Rate: ${etr}%  (Tax Expense ÷ Profit Before Tax)</td></tr>` : '');
          const mainRows =
            secRows('Operating Revenue', opRev.accounts, opRevTotal) +
            secRows('Other Operating Income', ooi.accounts, ooiTotal) +
            `<tr style="border-top:1px solid #cbd5e1;background:#f1f5f9;font-weight:700"><td style="padding:6px 12px;padding-left:24px;font-size:12px;color:#0f172a">TOTAL REVENUE</td><td style="padding:6px 12px;font-size:12px;text-align:right;font-family:monospace">₦${(totalRevenue/100).toLocaleString()}</td></tr>` +
            cogsRows(cos) +
            `<tr style="border-top:2px solid ${grossProfit < 0 ? '#dc2626' : '#059669'};background:${grossProfit < 0 ? '#fef2f2' : '#ecfdf5'};font-weight:700"><td style="padding:6px 12px;padding-left:24px;font-size:12px;color:${grossProfit < 0 ? '#dc2626' : '#059669'}">GROSS PROFIT</td><td style="padding:6px 12px;font-size:12px;text-align:right;font-family:monospace;color:${grossProfit < 0 ? '#dc2626' : '#059669'}">₦${(grossProfit/100).toLocaleString()}</td></tr>` +
            `<tr style="background:#f1f5f9"><td colspan="2" style="padding:6px 12px;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase">Operating Expenses</td></tr>` +
            subSecRows('Staff Costs', sc) +
            subSecRows('Administrative Expenses', adm) +
            subSecRows('Selling & Distribution Expenses', sd) +
            subSecRows('Other Operating Expenses', ooe) +
            `<tr style="border-top:1px solid #cbd5e1;background:#f1f5f9;font-weight:600"><td style="padding:6px 12px;padding-left:24px;font-size:12px;color:#0f172a">Total Operating Expenses</td><td style="padding:6px 12px;font-size:12px;text-align:right;font-family:monospace">₦${(opExTotal/100).toLocaleString()}</td></tr>` +
            `<tr style="border-top:2px solid #94a3b8;background:#eef2f3;font-weight:700"><td style="padding:6px 12px;padding-left:24px;font-size:12px;color:#1e293b">OPERATING PROFIT (EBIT)</td><td style="padding:6px 12px;font-size:12px;text-align:right;font-family:monospace">₦${(operatingProfit/100).toLocaleString()}</td></tr>` +
            (fi.accounts?.length ? secRows('Finance Income', fi.accounts, fiTotal) : '') +
            (fc.accounts?.length ? secRows('Finance Costs', fc.accounts, fcTotal) : '');

          printWindow('Income Statement',
            `<div style="text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #e2e8f0">
              ${orgLogo}
              <h1 style="margin:4px 0;font-size:18px;color:#0f172a">${orgName}</h1>
              ${orgAddr}
              <p style="margin:2px 0;font-size:11px;color:#64748b">${contactInfo}</p>
            </div>
            <h2 style="font-size:16px;color:#0f172a;margin:0 0 8px">Income Statement</h2>
            <p style="font-size:11px;color:#64748b;margin:0 0 12px">Period: ${sDate} - ${eDate} &bull; Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="background:#f8fafc">
                  <th style="padding:8px 12px;font-size:10px;font-weight:600;color:#64748b;text-align:left;text-transform:uppercase">Account</th>
                  <th style="padding:8px 12px;font-size:10px;font-weight:600;color:#64748b;text-align:right;text-transform:uppercase">Amount</th>
                </tr>
              </thead>
              <tbody>${(mainRows||'') + summaryRows || '<tr><td colspan="2" style="text-align:center;color:#94a3b8;padding:20px">No data</td></tr>'}</tbody>
            </table>`,
            `Period: ${sDate} - ${eDate}`
          );
        } else if (reportType === 'balance-sheet') {
          const bsData = (data as any)?.data || data || {};
          const totalAssets = bsData?.totalAssets || 0;
          const totalLiabilities = bsData?.totalLiabilities || 0;
          const totalEquity = bsData?.totalEquity || 0;
          const org = (orgData as any)?.data || orgData || {};
          const orgName = org.name || '';
          const orgAddr = org.address ? `<p style="margin:0;font-size:11px;color:#475569">${org.address}</p>` : '';
          const orgPhone = org.phone || '';
          const orgEmail = org.email || '';
          const orgWebsite = org.website || '';
          const orgLogo = org.logoUrl ? `<img src="${org.logoUrl}" style="max-height:60px;max-width:200px;object-fit:contain" />` : '';
          const contactInfo = [orgPhone, orgEmail, orgWebsite].filter(Boolean).join(' | ');
          function printSecRows(label: string, items: any[], total: number): string {
            const accRows = items.filter((i: any) => i.name !== label).map((i: any) =>
              `<tr><td style="padding:3px 12px;padding-left:24px;font-size:10px">${i.code ? `<span style="color:#94a3b8;font-family:monospace;font-size:9px;margin-right:4px">${i.code}</span>` : ''}${i.name||''}</td><td style="padding:3px 12px;font-size:10px;text-align:right;font-family:monospace">₦${((i.balance||0)/100).toLocaleString()}</td></tr>`
            ).join('');
            return `<tr style="background:#f1f5f9"><td colspan="2" style="padding:6px 12px;font-size:10px;font-weight:700;color:#475569;text-transform:uppercase">${label}</td></tr>${accRows}<tr style="border-top:1px solid #e2e8f0;font-weight:600;background:#f8fafc"><td style="padding:4px 12px;padding-left:24px;font-size:10px;color:#64748b">Total ${label}</td><td style="padding:4px 12px;font-size:10px;text-align:right;font-family:monospace">₦${(total/100).toLocaleString()}</td></tr>`;
          }
          function printNBVSec(label: string, costItems: any[], costTotal: number, contraItems: any[], contraTotal: number, netTotal: number): string {
            return `<tr style="background:#f1f5f9"><td colspan="2" style="padding:6px 12px;font-size:10px;font-weight:700;color:#475569;text-transform:uppercase">${label}</td></tr>${costItems.map((i: any) => `<tr><td style="padding:3px 12px;padding-left:24px;font-size:10px">${i.name||''}</td><td style="padding:3px 12px;font-size:10px;text-align:right;font-family:monospace">₦${((i.balance||0)/100).toLocaleString()}</td></tr>`).join('')}${contraItems.map((i: any) => `<tr><td style="padding:3px 12px;padding-left:24px;font-size:10px;color:#64748b">Less: ${i.name||''}</td><td style="padding:3px 12px;font-size:10px;text-align:right;font-family:monospace;color:#64748b">(₦${(Math.abs(i.balance||0)/100).toLocaleString()})</td></tr>`).join('')}<tr style="border-top:1px solid #e2e8f0;font-weight:600;background:#f8fafc"><td style="padding:4px 12px;padding-left:24px;font-size:10px;color:#64748b">Net Book Value – ${label}</td><td style="padding:4px 12px;font-size:10px;text-align:right;font-family:monospace">₦${((netTotal??costTotal)/100).toLocaleString()}</td></tr>`;
          }
          function printSection(label: string, total: number, items: any[]): string {
            return items.map((sec: any) => sec.key === 'ppe' || sec.key === 'rou' || sec.key === 'intangibles'
              ? printNBVSec(sec.label, sec.items||[], sec.total||0, sec.contraItems||[], sec.contraTotal||0, sec.netTotal??sec.total)
              : printSecRows(sec.label, sec.items||[], sec.total||0)
            ).join('') + `<tr style="border-top:1px solid #cbd5e1;background:#eef2f3;font-weight:700"><td style="padding:5px 12px;padding-left:16px;font-size:11px;color:#0f172a">Total ${label}</td><td style="padding:5px 12px;font-size:11px;text-align:right;font-family:monospace">₦${(total/100).toLocaleString()}</td></tr>`;
          }
          const ca = bsData.currentAssets || {}; const nca = bsData.nonCurrentAssets || {};
          const cl = bsData.currentLiabilities || {}; const ncl = bsData.nonCurrentLiabilities || {};
          const eq = bsData.equity || {};
          const assetHtml = printSection('Current Assets', ca.total||0, ca.subSections||[]) + printSection('Non-Current Assets', nca.total||0, nca.subSections||[]);
          const liabilityHtml = printSection('Current Liabilities', cl.total||0, cl.subSections||[]) + printSection('Non-Current Liabilities', ncl.total||0, ncl.subSections||[]);
          const equityHtml = printSection('Equity', eq.total||0, eq.subSections||[]);
          printWindow('Balance Sheet',
            `<div style="text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #e2e8f0">
              ${orgLogo}
              <h1 style="margin:4px 0;font-size:18px;color:#0f172a">${orgName}</h1>
              ${orgAddr}
              <p style="margin:2px 0;font-size:11px;color:#64748b">${contactInfo}</p>
            </div>
            <h2 style="font-size:16px;color:#0f172a;margin:0 0 8px">Balance Sheet</h2>
            <p style="font-size:11px;color:#64748b;margin:0 0 12px">As of ${asOfDate} &bull; Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="background:#f8fafc">
                  <th style="padding:8px 12px;font-size:10px;font-weight:600;color:#64748b;text-align:left;text-transform:uppercase">Account</th>
                  <th style="padding:8px 12px;font-size:10px;font-weight:600;color:#64748b;text-align:right;text-transform:uppercase">Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr style="background:#eff6ff;font-weight:bold"><td colspan="2" style="padding:8px 10px">ASSETS</td></tr>${assetHtml}
                <tr style="font-weight:bold;border-top:2px solid"><td style="padding:7px 10px">Total Assets</td><td style="padding:7px 10px;text-align:right;font-family:monospace">₦${(totalAssets/100).toLocaleString()}</td></tr>
                <tr style="background:#fffbeb;font-weight:bold"><td colspan="2" style="padding:8px 10px">LIABILITIES</td></tr>${liabilityHtml}
                <tr style="font-weight:bold;border-top:2px solid"><td style="padding:7px 10px">Total Liabilities</td><td style="padding:7px 10px;text-align:right;font-family:monospace">₦${(totalLiabilities/100).toLocaleString()}</td></tr>
                <tr style="background:#f5f3ff;font-weight:bold"><td colspan="2" style="padding:8px 10px">EQUITY</td></tr>${equityHtml}
                <tr style="font-weight:bold;border-top:2px solid"><td style="padding:7px 10px">Total Equity</td><td style="padding:7px 10px;text-align:right;font-family:monospace">₦${(totalEquity/100).toLocaleString()}</td></tr>
                <tr style="font-weight:bold;border-top:3px double;background:#f1f5f9"><td style="padding:7px 10px">Total Liabilities &amp; Equity</td><td style="padding:7px 10px;text-align:right;font-family:monospace">₦${((totalLiabilities+totalEquity)/100).toLocaleString()}</td></tr>
              </tbody>
            </table>`,
            `As of ${asOfDate}`
          );
        } else if (reportType === 'cash-flow') {
          const cf = data?.data || data || {};
          const fmtPdf = (v: number) => v < 0 ? `(₦${(Math.abs(v)/100).toLocaleString()})` : `₦${(v/100).toLocaleString()}`;
          const pdfRows: string[] = [];
          const addPdfRow = (label: string, amt: string, cls?: string) => pdfRows.push(`<tr${cls?` class="${cls}"`:''}><td style="padding:4px 10px">${label}</td><td class="r" style="padding:4px 10px">${amt}</td></tr>`);
          const operating = cf.operatingActivities || {};
          const investing = cf.investingActivities || {};
          const financing = cf.financingActivities || {};
          addPdfRow('A. OPERATING ACTIVITIES', '', 'bg-emerald-50');
          addPdfRow('Net Profit for the Period', fmtPdf(cf.netIncome || 0));
          if (operating.adjustments?.length) {
            addPdfRow('Adjustments for Non-Cash Items', '', 'bg-slate-50');
            (operating.adjustments || []).forEach((a: any) => addPdfRow(a.name, fmtPdf(a.amount)));
            addPdfRow('Total Adjustments', fmtPdf(operating.adjustmentsTotal || 0), 'fw-bold');
          }
          if (operating.workingCapitalChanges?.length) {
            addPdfRow('Changes in Working Capital', '', 'bg-slate-50');
            (operating.workingCapitalChanges || []).forEach((w: any) => addPdfRow(w.name, fmtPdf(w.amount)));
            addPdfRow('Total Working Capital Changes', fmtPdf(operating.workingCapitalTotal || 0), 'fw-bold');
          }
          addPdfRow('Cash Generated from Operations', fmtPdf(operating.cashGeneratedFromOperations || 0), 'fw-bold');
          if (Math.abs(operating.incomeTaxPaid || 0) > 0) addPdfRow('Income Tax Paid', fmtPdf(operating.incomeTaxPaid));
          if (Math.abs(operating.interestPaid || 0) > 0) addPdfRow('Interest Paid', fmtPdf(operating.interestPaid));
          if (Math.abs(operating.interestReceived || 0) > 0) addPdfRow('Interest Received', fmtPdf(operating.interestReceived));
          addPdfRow('NET CASH FROM OPERATING ACTIVITIES', fmtPdf(operating.total || 0), 'fw-bold border-top-2');
          addPdfRow('B. INVESTING ACTIVITIES', '', 'bg-blue-50');
          (investing.items || []).forEach((iv: any) => addPdfRow(iv.name, fmtPdf(iv.amount)));
          addPdfRow('NET CASH FROM INVESTING ACTIVITIES', fmtPdf(investing.total || 0), 'fw-bold border-top-2');
          addPdfRow('C. FINANCING ACTIVITIES', '', 'bg-violet-50');
          (financing.items || []).forEach((fn: any) => addPdfRow(fn.name, fmtPdf(fn.amount)));
          addPdfRow('NET CASH FROM FINANCING ACTIVITIES', fmtPdf(financing.total || 0), 'fw-bold border-top-2');
          addPdfRow('NET INCREASE / (DECREASE) IN CASH', fmtPdf(cf.netChangeInCash || 0), 'fw-bold border-top-3');
          addPdfRow('Opening Cash & Cash Equivalents', fmtPdf(cf.openingCash || 0));
          addPdfRow('Closing Cash & Cash Equivalents', fmtPdf(cf.closingCash || 0), 'fw-bold');
          const orgCf = (orgData as any)?.data || orgData || {};
          const orgCfName = orgCf.name || '';
          const orgCfAddr = orgCf.address ? `<p style="margin:0;font-size:11px;color:#475569">${orgCf.address}</p>` : '';
          const orgCfPhone = orgCf.phone || '';
          const orgCfEmail = orgCf.email || '';
          const orgCfWebsite = orgCf.website || '';
          const orgCfLogo = orgCf.logoUrl ? `<img src="${orgCf.logoUrl}" style="max-height:60px;max-width:200px;object-fit:contain" />` : '';
          const orgCfContact = [orgCfPhone, orgCfEmail, orgCfWebsite].filter(Boolean).join(' | ');
          printWindow('Cash Flow Statement',
            `<div style="text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #e2e8f0">
              ${orgCfLogo}
              <h1 style="margin:4px 0;font-size:18px;color:#0f172a">${orgCfName}</h1>
              ${orgCfAddr}
              <p style="margin:2px 0;font-size:11px;color:#64748b">${orgCfContact}</p>
            </div>
            <h2 style="font-size:16px;color:#0f172a;margin:0 0 8px">Cash Flow Statement</h2>
            <p style="font-size:11px;color:#64748b;margin:0 0 12px">Period: ${sDate} - ${eDate} &bull; Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="background:#f8fafc">
                  <th style="padding:8px 12px;font-size:10px;font-weight:600;color:#64748b;text-align:left;text-transform:uppercase">Line Item</th>
                  <th style="padding:8px 12px;font-size:10px;font-weight:600;color:#64748b;text-align:right;text-transform:uppercase">Amount</th>
                </tr>
              </thead>
              <tbody>${pdfRows.join('')}</tbody>
            </table>`,
            `Period: ${sDate} - ${eDate}`
          );
        } else if (reportType === 'aged-receivables' || reportType === 'aged-payables') {
          const label = reportType === 'aged-receivables' ? 'Customer' : 'Vendor';
          const title = reportType === 'aged-receivables' ? 'Aged Receivables' : 'Aged Payables';
          const list = data?.rows || (Array.isArray(data) ? data : []);
          const pdfRows = list.map((r: any) =>
            `<tr><td style="padding:6px 10px;font-size:11px;border-bottom:1px solid #f1f5f9">${r.name||''}</td><td style="padding:6px 10px;font-size:11px;text-align:right;font-family:monospace;border-bottom:1px solid #f1f5f9">₦${((r.current||0)/100).toLocaleString()}</td><td style="padding:6px 10px;font-size:11px;text-align:right;font-family:monospace;border-bottom:1px solid #f1f5f9">₦${((r.days1to30||0)/100).toLocaleString()}</td><td style="padding:6px 10px;font-size:11px;text-align:right;font-family:monospace;border-bottom:1px solid #f1f5f9">₦${((r.days31to60||0)/100).toLocaleString()}</td><td style="padding:6px 10px;font-size:11px;text-align:right;font-family:monospace;border-bottom:1px solid #f1f5f9">₦${((r.days61to90||0)/100).toLocaleString()}</td><td style="padding:6px 10px;font-size:11px;text-align:right;font-family:monospace;border-bottom:1px solid #f1f5f9">₦${((r.days90Plus||0)/100).toLocaleString()}</td><td style="padding:6px 10px;font-size:11px;text-align:right;font-weight:600;font-family:monospace;border-bottom:1px solid #f1f5f9">₦${((r.total||0)/100).toLocaleString()}</td></tr>`
          ).join('');
          const tCurr = list.reduce((s: number, r: any) => s + (r.current||0), 0);
          const t1_30 = list.reduce((s: number, r: any) => s + (r.days1to30||0), 0);
          const t31_60 = list.reduce((s: number, r: any) => s + (r.days31to60||0), 0);
          const t61_90 = list.reduce((s: number, r: any) => s + (r.days61to90||0), 0);
          const t90 = list.reduce((s: number, r: any) => s + (r.days90Plus||0), 0);
          const tTotal = list.reduce((s: number, r: any) => s + (r.total||0), 0);
          const orgAr = (orgData as any)?.data || orgData || {};
          const orgArName = orgAr.name || '';
          const orgArAddr = orgAr.address ? `<p style="margin:0;font-size:11px;color:#475569">${orgAr.address}</p>` : '';
          const orgArPhone = orgAr.phone || '';
          const orgArEmail = orgAr.email || '';
          const orgArWebsite = orgAr.website || '';
          const orgArLogo = orgAr.logoUrl ? `<img src="${orgAr.logoUrl}" style="max-height:60px;max-width:200px;object-fit:contain" />` : '';
          const orgArContact = [orgArPhone, orgArEmail, orgArWebsite].filter(Boolean).join(' | ');
          printWindow(title,
            `<div style="text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #e2e8f0">
              ${orgArLogo}
              <h1 style="margin:4px 0;font-size:18px;color:#0f172a">${orgArName}</h1>
              ${orgArAddr}
              <p style="margin:2px 0;font-size:11px;color:#64748b">${orgArContact}</p>
            </div>
            <h2 style="font-size:16px;color:#0f172a;margin:0 0 8px">${title}</h2>
            <p style="font-size:11px;color:#64748b;margin:0 0 12px">As of ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="background:#f8fafc">
                  <th style="padding:8px 10px;font-size:10px;font-weight:600;color:#64748b;text-align:left;text-transform:uppercase">${label}</th>
                  <th style="padding:8px 10px;font-size:10px;font-weight:600;color:#64748b;text-align:right;text-transform:uppercase">Current</th>
                  <th style="padding:8px 10px;font-size:10px;font-weight:600;color:#64748b;text-align:right;text-transform:uppercase">1-30</th>
                  <th style="padding:8px 10px;font-size:10px;font-weight:600;color:#64748b;text-align:right;text-transform:uppercase">31-60</th>
                  <th style="padding:8px 10px;font-size:10px;font-weight:600;color:#64748b;text-align:right;text-transform:uppercase">61-90</th>
                  <th style="padding:8px 10px;font-size:10px;font-weight:600;color:#64748b;text-align:right;text-transform:uppercase">90+</th>
                  <th style="padding:8px 10px;font-size:10px;font-weight:600;color:#64748b;text-align:right;text-transform:uppercase">Total</th>
                </tr>
              </thead>
              <tbody>${pdfRows || '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:20px">No data</td></tr>'}</tbody>
              <tfoot>
                <tr style="border-top:2px solid #0f172a;font-weight:700">
                  <td style="padding:8px 10px;font-size:12px">TOTAL</td>
                  <td style="padding:8px 10px;font-size:12px;text-align:right;font-family:monospace">₦${(tCurr/100).toLocaleString()}</td>
                  <td style="padding:8px 10px;font-size:12px;text-align:right;font-family:monospace">₦${(t1_30/100).toLocaleString()}</td>
                  <td style="padding:8px 10px;font-size:12px;text-align:right;font-family:monospace">₦${(t31_60/100).toLocaleString()}</td>
                  <td style="padding:8px 10px;font-size:12px;text-align:right;font-family:monospace">₦${(t61_90/100).toLocaleString()}</td>
                  <td style="padding:8px 10px;font-size:12px;text-align:right;font-family:monospace">₦${(t90/100).toLocaleString()}</td>
                  <td style="padding:8px 10px;font-size:12px;text-align:right;font-family:monospace">₦${(tTotal/100).toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>`,
            `${list.length} entries`
          );
        } else {
          const list = (Array.isArray(data) ? data : []);
          const rows = list.map((r: any) =>
            `<tr><td>${(r.code||r.accountCode||'')}</td><td>${(r.name||r.accountName||'')}</td><td class="c">${r.type||r.accountType||''}</td><td class="r">₦${((r.debit||r.debitAmount||0)/100).toLocaleString()}</td><td class="r">₦${((r.credit||r.creditAmount||0)/100).toLocaleString()}</td></tr>`
          ).join('');
          const pdfTotalDr = list.reduce((s: number, r: any) => s + (r.debit||r.debitAmount||0), 0);
          const pdfTotalCr = list.reduce((s: number, r: any) => s + (r.credit||r.creditAmount||0), 0);
          printWindow('Report', `<table><thead><tr><th>Code</th><th>Account</th><th class="c">Type</th><th class="r">Debit</th><th class="r">Credit</th></tr></thead><tbody>${rows||'<tr><td colspan="5" style="text-align:center;color:#94a3b8">No data</td></tr>'}</tbody><tfoot><tr style="font-weight:700;border-top:2px solid #cbd5e1;background:#f1f5f9"><td colspan="3" style="padding:7px 12px">Total</td><td class="r">₦${(pdfTotalDr/100).toLocaleString()}</td><td class="r">₦${(pdfTotalCr/100).toLocaleString()}</td></tr></tfoot></table>`);
        }
      } catch (err) {
        alert('Failed to open print window: ' + (err instanceof Error ? err.message : 'Unknown error'));
        console.error('Print error:', err);
      }
      return;
    }
    if (reportType === 'income-statement') {
      reportsApi.getIncomeStatement({ startDate: sDate, endDate: eDate, format: 'excel' }).then((blob: any) => {
        downloadBlob(blob, `income_statement_${new Date().toISOString().split('T')[0]}.xlsx`);
      }).catch((err: any) => {
        console.error('Excel export failed:', err);
        alert('Failed to export Excel. Please try again.');
      });
    } else if (reportType === 'balance-sheet') {
      apiDownload(`/reports/balance-sheet?format=${format}&asOfDate=${asOfDate}`, `balance_sheet_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else {
      apiDownload(`/reports/${reportType}?format=${format}&startDate=${sDate}&endDate=${eDate}`, `${reportType}_${new Date().toISOString().split('T')[0]}.${format}`);
    }
  };

  const handleImportOB = async () => {
    if (!csvText.trim()) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const res = await reportsApi.importTrialBalanceOpeningBalances({ csvData: csvText });
      setImportMsg({ type: 'success', text: res.message || 'Opening balances imported successfully.' });
      setCsvText('');
      setTimeout(() => { setShowImport(false); setImportMsg(null); }, 1500);
    } catch (err: any) {
      setImportMsg({ type: 'error', text: err.response?.data?.error || err.message || 'Import failed.' });
    } finally { setImporting(false); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50 transition-all duration-200"><Upload className="w-3.5 h-3.5" /> Import OB</button>
          <button onClick={() => handleExport('csv')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all duration-200"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => handleExport('pdf')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-all duration-200"><Download className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={() => handleExport('excel')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-all duration-200"><Download className="w-3.5 h-3.5" /> Excel</button>
        </div>
      </div>

      {/* Import Opening Balances Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setShowImport(false); setImportMsg(null); }}>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 w-full max-w-lg mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Import Opening Balances</h2>
              <button onClick={() => { setShowImport(false); setImportMsg(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-slate-500">Upload a CSV file with columns: accountCode, accountName, debit (NGN), credit (NGN)</p>
            <button onClick={() => downloadCsv('trial-balance-opening-balances-template.csv', CSV_TEMPLATES.trialBalanceOpeningBalances.headers, CSV_TEMPLATES.trialBalanceOpeningBalances.sample)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold">Download sample CSV</button>
            <input ref={fileRef} type="file" accept=".csv" onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => setCsvText(ev.target?.result as string);
              reader.readAsText(file);
            }} className="w-full text-sm" />
            {csvText && (
              <div className="text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl">File loaded ({csvText.split(/\n/).length} rows)</div>
            )}
            {importMsg && (
              <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${importMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {importMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {importMsg.text}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowImport(false); setImportMsg(null); }} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all duration-200">Cancel</button>
              <button onClick={handleImportOB} disabled={!csvText || importing}
                className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 transition-all duration-200">
                {importing ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Import
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-4 items-center bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
        {isAgedReport ? (
          <p className="text-sm text-slate-500">Aging as of {fmtDate(new Date().toISOString())}</p>
        ) : isBalanceSheet ? (
          <>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600">As of:</label>
            <input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={() => { setShowZero(!showZero); localStorage.setItem('bs_showZero', String(!showZero)); }} className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${showZero ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>{showZero ? 'Hide Zero Accounts' : 'Show Zero Accounts'}</button>
            <button onClick={() => { setShowCodes(!showCodes); localStorage.setItem('bs_showCodes', String(!showCodes)); }} className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${showCodes ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>{showCodes ? 'Hide Codes' : 'Show Codes'}</button>
          </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-600">From:</label>
              <input type="date" value={sDate} onChange={e => setSDate(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-600">To:</label>
              <input type="date" value={eDate} onChange={e => setEDate(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
            </div>
            <div className="flex items-center gap-2 ml-auto">
              {reportType === 'income-statement' && (
                <>
                  <button onClick={() => { setIsShowZero(!isShowZero); localStorage.setItem('is_showZero', String(!isShowZero)); }} className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${isShowZero ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>{isShowZero ? 'Hide Zero Accounts' : 'Show Zero Accounts'}</button>
                  <button onClick={() => { setIsShowCodes(!isShowCodes); localStorage.setItem('is_showCodes', String(!isShowCodes)); }} className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${isShowCodes ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>{isShowCodes ? 'Hide Codes' : 'Show Codes'}</button>
                </>
              )}
              {reportType === 'cash-flow' && (
                <>
                  <button onClick={() => { setCfShowZero(!cfShowZero); localStorage.setItem('cf_showZero', String(!cfShowZero)); }} className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${cfShowZero ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>{cfShowZero ? 'Hide Zero Accounts' : 'Show Zero Accounts'}</button>
                  <button onClick={() => { setCfShowCodes(!cfShowCodes); localStorage.setItem('cf_showCodes', String(!cfShowCodes)); }} className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${cfShowCodes ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>{cfShowCodes ? 'Hide Codes' : 'Show Codes'}</button>
                </>
              )}
            </div>
          </>
        )}

        {isComparativeReport && (
          <div className="flex items-center gap-3 ml-auto">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={compareEnabled} onChange={e => setCompareEnabled(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              Compare to prior period
            </label>
            {compareEnabled && (
              <>
                {isBalanceSheet ? (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-slate-500">Prior as of:</label>
                    <input type="date" value={compareAsOf} onChange={e => setCompareAsOf(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-slate-500">Prior from:</label>
                      <input type="date" value={compareSDate} onChange={e => setCompareSDate(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-slate-500">To:</label>
                      <input type="date" value={compareEDate} onChange={e => setCompareEDate(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><div className="bg-gradient-to-r from-slate-200 to-slate-100 animate-pulse rounded-xl h-8 w-48"></div></div>
      ) : error ? (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-xl text-sm"><AlertCircle className="w-4 h-4" /> Failed to load report.</div>
      ) : (
        <ReportTable data={data} reportType={reportType} compareEnabled={compareEnabled} onAccountClick={(acct: any) => setDrillDown(acct)} showZero={showZero} showCodes={showCodes} isShowZero={isShowZero} isShowCodes={isShowCodes} cfShowZero={cfShowZero} cfShowCodes={cfShowCodes} asOfDate={asOfDate} />
      )}

      {drillDown && <AccountDrilldownModal account={drillDown} sDate={sDate} eDate={isBalanceSheet ? `${asOfDate}` : eDate} onClose={() => setDrillDown(null)} />}
    </div>
  );
}

function ReportTable({ data, reportType, compareEnabled, onAccountClick, showZero, showCodes, isShowZero, isShowCodes, cfShowZero, cfShowCodes, asOfDate }: { data: any; reportType: ReportType; compareEnabled?: boolean; onAccountClick?: (acct: any) => void; showZero?: boolean; showCodes?: boolean; isShowZero?: boolean; isShowCodes?: boolean; cfShowZero?: boolean; cfShowCodes?: boolean; asOfDate?: string }) {
  const navigate = useNavigate();
  if (!data) return null;

  // Comparative mode — data contains { current, prior, variance }
  if (compareEnabled && data?.current) {
    if (reportType === 'income-statement') {
      return <ComparativePnLTable current={data.current} prior={data.prior} onAccountClick={onAccountClick} />;
    }
    if (reportType === 'balance-sheet') {
      return <ComparativeBalanceSheetTable current={data.current} prior={data.prior} onAccountClick={onAccountClick} />;
    }
  }

  if (reportType === 'aged-receivables' || reportType === 'aged-payables') {
    const [activeBucket, setActiveBucket] = useState<string | null>(null);
    const [drillEntity, setDrillEntity] = useState<string | null>(null);
    const title = reportType === 'aged-receivables' ? 'Customer' : 'Vendor';
    const entityLabel = reportType === 'aged-receivables' ? 'customer' : 'vendor';
    const isReceivables = reportType === 'aged-receivables';
    const allRows: any[] = data?.rows || (Array.isArray(data) ? data : []);
    const invoices: any[] = data?.invoices || [];
    const bills: any[] = data?.bills || [];

    const bucketKey: Record<string, string> = { current: 'current', days1to30: 'days1to30', days31to60: 'days31to60', days61to90: 'days61to90', days90Plus: 'days90Plus', total: 'total' };
    const bucketLabel: Record<string, string> = { current: 'Current', days1to30: '1-30 Days', days31to60: '31-60 Days', days61to90: '61-90 Days', days90Plus: '90+ Days', total: 'Total' };
    const bucketColor: Record<string, { head: string; activeHead: string; cell: string }> = {
      current: { head: 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md shadow-emerald-200 hover:shadow-lg hover:shadow-emerald-300 hover:-translate-y-0.5', activeHead: 'bg-gradient-to-br from-emerald-600 to-emerald-800 text-white ring-2 ring-emerald-300 shadow-lg shadow-emerald-400 -translate-y-0.5', cell: 'bg-emerald-50' },
      days1to30: { head: 'bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-md shadow-blue-200 hover:shadow-lg hover:shadow-blue-300 hover:-translate-y-0.5', activeHead: 'bg-gradient-to-br from-blue-600 to-blue-800 text-white ring-2 ring-blue-300 shadow-lg shadow-blue-400 -translate-y-0.5', cell: 'bg-blue-50' },
      days31to60: { head: 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-md shadow-amber-200 hover:shadow-lg hover:shadow-amber-300 hover:-translate-y-0.5', activeHead: 'bg-gradient-to-br from-amber-600 to-amber-800 text-white ring-2 ring-amber-300 shadow-lg shadow-amber-400 -translate-y-0.5', cell: 'bg-amber-50' },
      days61to90: { head: 'bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-md shadow-orange-200 hover:shadow-lg hover:shadow-orange-300 hover:-translate-y-0.5', activeHead: 'bg-gradient-to-br from-orange-600 to-orange-800 text-white ring-2 ring-orange-300 shadow-lg shadow-orange-400 -translate-y-0.5', cell: 'bg-orange-50' },
      days90Plus: { head: 'bg-gradient-to-br from-red-400 to-red-600 text-white shadow-md shadow-red-200 hover:shadow-lg hover:shadow-red-300 hover:-translate-y-0.5', activeHead: 'bg-gradient-to-br from-red-600 to-red-800 text-white ring-2 ring-red-300 shadow-lg shadow-red-400 -translate-y-0.5', cell: 'bg-red-50' },
      total: { head: 'bg-gradient-to-br from-violet-400 to-violet-600 text-white shadow-md shadow-violet-200 hover:shadow-lg hover:shadow-violet-300 hover:-translate-y-0.5', activeHead: 'bg-gradient-to-br from-violet-600 to-violet-800 text-white ring-2 ring-violet-300 shadow-lg shadow-violet-400 -translate-y-0.5', cell: 'bg-violet-50' },
    };
    const bucketIcon: Record<string, string> = {
      current: '●',
      days1to30: '●',
      days31to60: '●',
      days61to90: '●',
      days90Plus: '●',
      total: '◆',
    };

    const filteredRows = activeBucket
      ? allRows.filter(r => (r[activeBucket] || 0) > 0)
      : allRows;

    function isBucketActive(b: string): boolean { return activeBucket === b; }
    function toggleBucket(b: string): void { setActiveBucket(isBucketActive(b) ? null : b); }

    const bucketHeaders = ['current', 'days1to30', 'days31to60', 'days61to90', 'days90Plus', 'total'];

    const drillItems = drillEntity
      ? isReceivables
        ? invoices.filter((inv: any) => inv.customerName === drillEntity)
        : bills.filter((bl: any) => bl.vendorName === drillEntity)
      : [];

    function fmtNairaDrill(v: number): string {
      return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
    }

    return (
      <div>
        {activeBucket && (
          <div className="mb-4 flex items-center gap-3">
            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs shadow-sm ${activeBucket ? bucketColor[activeBucket].head : 'bg-indigo-100 text-indigo-700'}`}>
              <span>{bucketIcon[activeBucket]}</span>
              <span>Filtered: <strong>{bucketLabel[activeBucket]}</strong></span>
              <span className="opacity-75">—</span>
              <span>{filteredRows.length} {entityLabel}{filteredRows.length !== 1 ? 's' : ''}</span>
            </span>
            <button onClick={() => setActiveBucket(null)} className="text-xs font-medium text-slate-400 hover:text-red-600 transition-colors hover:underline flex items-center gap-1">
              <X className="w-3 h-3" /> Clear
            </button>
          </div>
        )}

        {/* Drill-down modal */}
        {drillEntity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDrillEntity(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-slate-200">
                <h3 className="text-lg font-bold text-slate-900">{drillEntity} — {isReceivables ? 'Invoices' : 'Bills'}</h3>
                <button onClick={() => setDrillEntity(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
              </div>
              {drillItems.length === 0 ? (
                <div className="p-8 text-center text-slate-400">No individual {isReceivables ? 'invoices' : 'bills'} found.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-3">{isReceivables ? 'Invoice' : 'Bill'} #</th>
                      <th className="text-left px-4 py-3">Due Date</th>
                      <th className="text-right px-4 py-3">Balance Due</th>
                      <th className="text-right px-4 py-3">Overdue</th>
                      <th className="text-right px-4 py-3">Bucket</th>
                      <th className="text-right px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {drillItems.map((item: any, i: number) => (
                      <tr key={item.id || i} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-blue-600">
                          <button onClick={() => navigate(isReceivables ? `/sales/invoices/${item.id}` : `/purchases/bills/${item.id}`)} className="hover:underline">
                            {item.invoiceNumber || item.billNumber || '—'}
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{new Date(item.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-800">{fmtNairaDrill(item.balanceDue)}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{item.overdueDays || 0}d</td>
                        <td className="px-4 py-2.5 text-right"><span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{item.bucket}</span></td>
                        <td className="px-4 py-2.5 text-right">
                          <button onClick={() => navigate(isReceivables ? `/sales/invoices/${item.id}` : `/purchases/bills/${item.id}`)} className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium">
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold text-sm">
                      <td colSpan={2} className="px-4 py-3 text-slate-800">Total</td>
                      <td className="px-4 py-3 text-right text-slate-800">{fmtNairaDrill(drillItems.reduce((s: number, item: any) => s + (item.balanceDue || 0), 0))}</td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Placard row */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {bucketHeaders.map(b => {
            const total = allRows.reduce((s: number, r: any) => s + (r[b] || 0), 0);
            const count = allRows.filter(r => (r[b] || 0) > 0).length;
            return (
              <button key={b} onClick={() => toggleBucket(b)}
                className={`flex-1 min-w-[100px] px-4 py-3 rounded-xl cursor-pointer select-none transition-all duration-200 font-bold text-sm ${isBucketActive(b) ? bucketColor[b].activeHead : bucketColor[b].head}`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] opacity-75">{bucketIcon[b]}</span>
                  <span className="text-[10px] uppercase tracking-wider opacity-90">{bucketLabel[b]}</span>
                </div>
                <div className="text-sm font-bold">{fmtNaira(total)}</div>
                <div className="text-[10px] mt-0.5 opacity-75">{count} {entityLabel}{count !== 1 ? 's' : ''}</div>
              </button>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-3">{title}</th>
                {bucketHeaders.map(b => (
                  <th key={b} className="text-right px-3 py-3">{bucketLabel[b]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row: any, i: number) => (
                <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/50 even:bg-slate-50/50 transition-colors">
                  <td className="px-3 py-3 font-medium text-blue-600 cursor-pointer hover:text-blue-800 hover:underline" onClick={() => setDrillEntity(row.name)}>
                    {row.name || `Item ${i + 1}`}
                  </td>
                  {bucketHeaders.map(b => (
                    <td key={b} className={`px-3 py-3 text-right ${isBucketActive(b) ? bucketColor[b].cell + ' font-semibold' : 'text-slate-600'} ${b === 'total' ? 'font-semibold' : ''}`}>
                      {fmtNaira(row[b] || 0)}
                    </td>
                  ))}
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">No data available.</td></tr>
              )}
            </tbody>
            {filteredRows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold text-sm">
                <td className="px-3 py-3 text-slate-800">TOTAL</td>
                {bucketHeaders.map(b => (
                  <td key={b} className={`px-3 py-3 text-right ${isBucketActive(b) ? bucketColor[b].head : 'text-slate-800'}`}>
                    {fmtNaira(filteredRows.reduce((s: number, r: any) => s + (r[b] || 0), 0))}
                  </td>
                ))}
              </tr>
            </tfoot>
            )}
          </table>
        </div>
      </div>
    );
  }

  if (reportType === 'balance-sheet') {
    const bsData = data?.data || data;
    return <SinglePeriodBalanceSheetTable data={bsData} onAccountClick={onAccountClick} showZero={showZero} showCodes={showCodes} />;
  }

  if (reportType === 'income-statement') {
    const current = data?.current || data;
    return <SinglePeriodPnLTable current={current} onAccountClick={onAccountClick} showZero={isShowZero} showCodes={isShowCodes} />;
  }

  if (reportType === 'cash-flow') {
    const cf = data?.data || data || {};
    const netIncome = cf.netIncome || 0;
    const operating = cf.operatingActivities || {};
    const investing = cf.investingActivities || {};
    const financing = cf.financingActivities || {};
    const adjustments = operating.adjustments || [];
    const workingCapital = operating.workingCapitalChanges || [];
    const investingItems = investing.items || [];
    const financingItems = financing.items || [];

    function fmtCf(val: number): string {
      const abs = Math.abs(val / 100);
      const formatted = abs.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return val < 0 ? `(₦${formatted})` : `₦${formatted}`;
    }
    function shouldShow(val: number): boolean {
      return cfShowZero || Math.abs(val) > 0.01;
    }
    function cfRow(label: string, amount: number, indent: string = 'pl-8', bold: boolean = false) {
      if (!shouldShow(amount) && !bold) return null;
      const isNeg = amount < 0;
      return (
        <tr key={label} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
          <td className={`px-3 py-2.5 ${indent} ${bold ? 'font-bold text-slate-900' : 'text-slate-800'}`}>{label}</td>
          <td className={`px-3 py-2.5 text-right ${bold ? 'font-bold' : 'font-semibold'} ${isNeg ? 'text-red-600' : 'text-slate-800'}`}>{fmtCf(amount)}</td>
        </tr>
      );
    }
    function sectionHeader(label: string, bg: string, textColor: string) {
      return <tr className={bg}><td colSpan={2} className={`px-3 py-2 text-xs font-bold ${textColor} uppercase tracking-wider`}>{label}</td></tr>;
    }

    const netOp = operating.total || 0;
    const invTotal = investing.total || 0;
    const finTotal = financing.total || 0;
    const netChange = cf.netChangeInCash || 0;
    const reconciles = cf.reconciled;

    return (
      <div className="space-y-4">
        {/* Reconciliation warning */}
        {!reconciles && (
          <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-red-800 text-sm">⚠ Cash Flow does not reconcile to ledger cash balance</p>
              <p className="text-red-600 text-xs mt-1">Computed closing cash: {fmtCf(cf.closingCash)}. Ledger cash balance: {fmtCf(cf.ledgerCashBalance)}. Difference: {fmtCf(cf.reconciliationDiff)}. Please review unrecorded transactions.</p>
            </div>
          </div>
        )}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-3">Line Item</th>
                <th className="text-right px-3 py-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {sectionHeader('A. Operating Activities', 'bg-emerald-50', 'text-emerald-800')}
              {cfRow('Net Profit for the Period', netIncome)}
              {/* Non-cash adjustments */}
              {adjustments.length > 0 && (
                <tr className="bg-slate-50/30"><td colSpan={2} className="px-3 py-1.5 pl-10 text-xs font-semibold text-slate-500 uppercase tracking-wider">Adjustments for Non-Cash Items</td></tr>
              )}
              {adjustments.map((a: any, i: number) => cfRow(a.name, a.amount, 'pl-14'))}
              {adjustments.length > 0 && cfRow('Total Adjustments for Non-Cash Items', operating.adjustmentsTotal || 0, 'pl-10', true)}
              {/* Working Capital */}
              {workingCapital.length > 0 && (
                <tr className="bg-slate-50/30"><td colSpan={2} className="px-3 py-1.5 pl-10 text-xs font-semibold text-slate-500 uppercase tracking-wider">Changes in Working Capital</td></tr>
              )}
              {workingCapital.map((w: any, i: number) => cfRow(w.name, w.amount, 'pl-14'))}
              {workingCapital.length > 0 && cfRow('Total Changes in Working Capital', operating.workingCapitalTotal || 0, 'pl-10', true)}
              {cfRow('Cash Generated from Operations', operating.cashGeneratedFromOperations || 0, 'pl-8', true)}
              {shouldShow(operating.incomeTaxPaid) && cfRow('Income Tax Paid', operating.incomeTaxPaid || 0, 'pl-8')}
              {shouldShow(operating.interestPaid) && cfRow('Interest Paid', operating.interestPaid || 0, 'pl-8')}
              {shouldShow(operating.interestReceived) && cfRow('Interest Received', operating.interestReceived || 0, 'pl-8')}
              <tr className={`border-t-2 border-emerald-200 bg-emerald-50/50 font-bold`}>
                <td className="px-3 py-2.5 pl-8 text-sm text-slate-900">NET CASH FROM OPERATING ACTIVITIES</td>
                <td className={`px-3 py-2.5 text-right ${netOp < 0 ? 'text-red-700' : 'text-slate-900'}`}>{fmtCf(netOp)}</td>
              </tr>
              {sectionHeader('B. Investing Activities', 'bg-blue-50', 'text-blue-800')}
              {investingItems.length === 0 && (
                <tr className="border-t border-slate-100"><td colSpan={2} className="px-3 py-2.5 pl-8 text-slate-400 italic">No investing activity</td></tr>
              )}
              {investingItems.map((iv: any, i: number) => cfRow(iv.name, iv.amount, 'pl-8'))}
              <tr className={`border-t-2 border-blue-200 bg-blue-50/50 font-bold`}>
                <td className="px-3 py-2.5 pl-8 text-sm text-slate-900">NET CASH FROM INVESTING ACTIVITIES</td>
                <td className={`px-3 py-2.5 text-right ${invTotal < 0 ? 'text-red-700' : 'text-slate-900'}`}>{fmtCf(invTotal)}</td>
              </tr>
              {sectionHeader('C. Financing Activities', 'bg-violet-50', 'text-violet-800')}
              {financingItems.length === 0 && (
                <tr className="border-t border-slate-100"><td colSpan={2} className="px-3 py-2.5 pl-8 text-slate-400 italic">No financing activity</td></tr>
              )}
              {financingItems.map((fn: any, i: number) => cfRow(fn.name, fn.amount, 'pl-8'))}
              <tr className={`border-t-2 border-violet-200 bg-violet-50/50 font-bold`}>
                <td className="px-3 py-2.5 pl-8 text-sm text-slate-900">NET CASH FROM FINANCING ACTIVITIES</td>
                <td className={`px-3 py-2.5 text-right ${finTotal < 0 ? 'text-red-700' : 'text-slate-900'}`}>{fmtCf(finTotal)}</td>
              </tr>
              {/* Net Change */}
              <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold text-base">
                <td className="px-3 py-3 text-slate-900">NET INCREASE / (DECREASE) IN CASH</td>
                <td className={`px-3 py-3 text-right ${netChange < 0 ? 'text-red-700' : 'text-slate-900'}`}>{fmtCf(netChange)}</td>
              </tr>
              <tr className="border-t border-slate-200">
                <td className="px-3 py-2.5 pl-8 text-slate-600">Opening Cash &amp; Cash Equivalents</td>
                <td className="px-3 py-2.5 text-right text-slate-600">{fmtNaira(cf.openingCash)}</td>
              </tr>
              <tr className="border-t border-slate-200">
                <td className="px-3 py-2.5 pl-8 text-slate-600">Closing Cash &amp; Cash Equivalents</td>
                <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{fmtNaira(cf.closingCash)}</td>
              </tr>
              {/* Reconciliation */}
              <tr className="border-t border-slate-200 bg-slate-50/50">
                <td colSpan={2} className="px-3 py-2 text-xs text-slate-500">
                  Reconciliation Check: Closing Cash per Statement: <strong>{fmtNaira(cf.closingCash)}</strong> &mdash; Closing Cash per Ledger: <strong>{fmtNaira(cf.ledgerCashBalance)}</strong> &mdash; Difference: <strong>{fmtNaira(cf.reconciliationDiff)}</strong>
                  {reconciles ? <span className="text-emerald-600 font-bold ml-2">✅</span> : <span className="text-red-600 font-bold ml-2">⚠</span>}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
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
          {(Array.isArray(data) ? data : []).map((row: any, i: number) => (
            <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/50 even:bg-slate-50/50 transition-colors">
              <td className="px-3 py-3 text-slate-600 font-mono">{row.code || row.accountCode || '—'}</td>
              <td className="px-3 py-3 font-medium text-slate-800">{row.name || row.accountName || `Account ${i + 1}`}</td>
              <td className="px-3 py-3 text-right text-slate-500 capitalize">{row.type || row.accountType || '—'}</td>
              <td className="px-3 py-3 text-right text-slate-600">{fmtNaira(row.debit || row.debitAmount || 0)}</td>
              <td className="px-3 py-3 text-right text-slate-600">{fmtNaira(row.credit || row.creditAmount || 0)}</td>
            </tr>
          ))}
          {(!Array.isArray(data) || data.length === 0) && (
            <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">No data available.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AccountDrilldownModal({ account, sDate, eDate, onClose }: { account: any; sDate: string; eDate: string; onClose: () => void }) {
  const navigate = useNavigate();
  const link = getAccountModuleLink(account.accountCode || account.code || '');
  const { data, isLoading, isFetching, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ['account-ledger', account.accountId, sDate, eDate],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await accountantApi.getAccountLedger(account.accountId, { startDate: sDate, endDate: eDate, page: pageParam, limit: 50 });
      return res;
    },
    getNextPageParam: (lastPage: any) => {
      if (!lastPage) return undefined;
      const totalPages = Math.ceil(lastPage.total / lastPage.limit);
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
    initialPageParam: 1,
    enabled: !!account.accountId,
  });

  const allPages = data?.pages || [];
  const firstPage = allPages[0] || {};
  const accountInfo = firstPage.account || {};
  const openingBalance = firstPage.openingBalance || 0;
  const lines = allPages.flatMap((p: any) => p.lines || []);
  const totalDr = lines.reduce((s: number, l: any) => s + Number(l.debitAmount || 0), 0);
  const totalCr = lines.reduce((s: number, l: any) => s + Number(l.creditAmount || 0), 0);
  const closingBalance = lines.length > 0 ? lines[lines.length - 1].runningBalance : openingBalance;      
  const isDebitType = accountInfo.type === 'asset' || accountInfo.type === 'expense';
  const balanceLabel = isDebitType ? 'Debit' : 'Credit';
  const absBalance = Math.abs(closingBalance);

  function getSourceLink(source: string, sourceId: string): { path: string; label: string } | null {
    if (!sourceId) return null;
    switch (source) {
      case 'invoice': return { path: `/sales/invoices/${sourceId}`, label: 'View Invoice' };
      case 'bill': return { path: `/purchases/bills/${sourceId}`, label: 'View Bill' };
      case 'payment': return { path: `/banking`, label: 'View Payment' };
      case 'payroll': return { path: `/payroll`, label: 'View Payroll' };
      case 'journal': return { path: `/accountant/manual-journals`, label: 'View Journal' };
      default: return null;
    }
  }

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm" />
      {/* Drawer panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl flex flex-col animate-slide-in" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{account.accountName || accountInfo.name || 'Account Ledger'}</h2>
            <p className="text-xs text-slate-500">
              {account.accountCode || accountInfo.code || ''} &middot; {account.accountType || accountInfo.type || ''}
              {closingBalance !== 0 && (
                <span className="ml-2 font-semibold">{balanceLabel}: {fmtNaira(absBalance)}</span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-5 h-5" /></button>
        </div>

        {/* Date info */}
        <div className="px-6 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
          Period: {sDate} – {eDate} &middot; Opening Balance: {fmtNaira(openingBalance)}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20"><div className="bg-gradient-to-r from-slate-200 to-slate-100 animate-pulse rounded-xl h-8 w-48"></div></div>
          ) : lines.length === 0 ? (
            <p className="text-sm text-slate-500 p-6">No journal entries in this period.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="text-left px-3 py-3">Date</th>
                  <th className="text-left px-3 py-3">Entry</th>
                  <th className="text-left px-3 py-3">Description</th>
                  <th className="text-left px-3 py-3">Source</th>
                  <th className="text-right px-3 py-3">Debit</th>
                  <th className="text-right px-3 py-3">Credit</th>
                  <th className="text-right px-3 py-3">Balance</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l: any, i: number) => {
                  const sourceLink = getSourceLink(l.source, l.sourceId);
                  return (
                  <tr key={l.id || i} className="border-b border-slate-100 hover:bg-slate-50/50 even:bg-slate-50/50 transition-colors">
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{new Date(l.date).toLocaleDateString('en-GB')}</td>
                    <td className="px-3 py-3 text-slate-800 font-mono">{l.entryNumber}</td>
                    <td className="px-3 py-3 text-slate-600 max-w-[180px] truncate" title={l.description || ''}>{l.description || '—'}</td>
                    <td className="px-3 py-3">
                      {sourceLink ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(sourceLink.path); }}
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                        >{l.source} <ExternalLink className="w-3 h-3" /></button>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-slate-200 bg-slate-100 text-slate-600">{l.source}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-600">{l.debitAmount > 0 ? fmtNaira(l.debitAmount) : '—'}</td>
                    <td className="px-3 py-3 text-right text-slate-600">{l.creditAmount > 0 ? fmtNaira(l.creditAmount) : '—'}</td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-800">{fmtNaira(l.runningBalance)}</td>
                  </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                  <td colSpan={4} className="px-3 py-3 text-slate-800 text-xs">Page Totals</td>
                  <td className="px-3 py-3 text-right text-slate-800">{fmtNaira(totalDr)}</td>
                  <td className="px-3 py-3 text-right text-slate-800">{fmtNaira(totalCr)}</td>
                  <td className="px-3 py-3 text-right text-slate-800">{fmtNaira(closingBalance)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Load more */}
        {!isLoading && hasNextPage && (
          <div className="px-6 py-3 border-t border-slate-200 text-center">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetching}
              className="inline-flex items-center gap-1 px-4 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 disabled:opacity-50 transition-all duration-200"
            >{isFetching ? 'Loading...' : 'Load more'}</button>
          </div>
        )}

        {link && (
          <div className="px-6 py-3 border-t border-slate-200 text-center">
            <button onClick={() => navigate(link.path)} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors">
              <ExternalLink className="w-3.5 h-3.5" /> View in {link.label}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function formatVarianceClass(variance: number, isRevenue: boolean): string {
  if (variance === 0) return '';
  // For revenue: positive = favorable (green), negative = unfavorable (red)
  // For expense: negative = favorable (green), positive = unfavorable (red)
  const isFavorable = isRevenue ? variance > 0 : variance < 0;
  return isFavorable ? 'text-emerald-600' : 'text-red-600';
}

function buildPnLRows(current: any, prior: any | null): any[] {
  function buildSec(key: string, label: string, isRevenue: boolean): any {
    const currAccounts = current?.[key]?.accounts || [];
    const priorAccounts = prior?.[key]?.accounts || [];
    const priorMap = new Map(priorAccounts.map((a: any) => [a.code || a.accountId, a.balance]));
    let secCurrTotal = 0;
    let secPriorTotal = 0;
    const secRows: any[] = [];
    for (const a of currAccounts) {
      const code = a.code || a.accountId;
      const priorBal = priorMap.get(code) || 0;
      secCurrTotal += a.balance;
      secPriorTotal += priorBal;
      secRows.push({ accountId: a.accountId, name: a.name, code: a.code, currentBalance: a.balance, priorBalance: priorBal, variance: a.balance - priorBal, isRevenue });
    }
    for (const a of priorAccounts) {
      const code = a.code || a.accountId;
      if (!currAccounts.some((ca: any) => (ca.code || ca.accountId) === code)) {
        secCurrTotal += 0;
        secPriorTotal += a.balance;
        secRows.push({ accountId: a.accountId, name: a.name, code: a.code, currentBalance: 0, priorBalance: a.balance, variance: 0 - a.balance, isRevenue });
      }
    }
    return { section: label, children: secRows, totalCurrent: secCurrTotal, totalPrior: secPriorTotal, isRevenue };
  }
  const rows: any[] = [];
  // 1. Operating Revenue
  rows.push(buildSec('operatingRevenue', 'Operating Revenue', true));
  // 2. Other Operating Income
  rows.push(buildSec('otherOperatingIncome', 'Other Operating Income', true));
  // Total Revenue summary
  const trCurr = current?.totalRevenue ?? (current?.operatingRevenue?.total || 0) + (current?.otherOperatingIncome?.total || 0);
  const trPrior = prior?.totalRevenue ?? (prior?.operatingRevenue?.total || 0) + (prior?.otherOperatingIncome?.total || 0);
  rows.push({ section: 'TOTAL REVENUE', isSummary: true, summaryCurrent: trCurr, summaryPrior: trPrior, isRevenue: true });
  // 3. Cost of Sales (with computed COGS breakdown)
  (function() {
    const cos = current?.costOfSales || {};
    const cosPrior = prior?.costOfSales || {};
    const currAccounts = cos?.accounts || [];
    const priorAccounts = cosPrior?.accounts || [];
    const priorMap = new Map(priorAccounts.map((a: any) => [a.code || a.accountId, a.balance]));
    const children: any[] = [];
    let secCurr = 0;
    let secPrior = 0;
    // Computed COGS breakdown
    const opening = cos?.openingStock ?? 0;
    const closing = cos?.closingStock ?? 0;
    const invSold = cos?.inventorySold ?? 0;
    const pog = cos?.purchasesOfGoods || null;
    const priorOpening = cosPrior?.openingStock ?? 0;
    const priorClosing = cosPrior?.closingStock ?? 0;
    const priorInvSold = cosPrior?.inventorySold ?? 0;
    const priorPog = cosPrior?.purchasesOfGoods || null;
    if (opening !== 0 || priorOpening !== 0) {
      children.push({ name: 'Opening Stock', currentBalance: opening, priorBalance: priorOpening, variance: opening - priorOpening, isRevenue: false });
      secCurr += opening; secPrior += priorOpening;
    }
    if ((pog && pog.balance !== 0) || (priorPog && priorPog.balance !== 0)) {
      const curBal = pog?.balance || 0;
      const priBal = priorPog?.balance || 0;
      children.push({ name: `${pog?.name || 'Purchases of Goods'} (${pog?.code || '700200'})`, currentBalance: curBal, priorBalance: priBal, variance: curBal - priBal, isRevenue: false });
      secCurr += curBal; secPrior += priBal;
    }
    if (closing !== 0 || priorClosing !== 0) {
      children.push({ name: 'Closing Stock', currentBalance: -closing, priorBalance: -priorClosing, variance: -closing + priorClosing, isRevenue: false });
      secCurr -= closing; secPrior -= priorClosing;
    }
    if (invSold !== 0 || priorInvSold !== 0) {
      children.push({ name: 'Cost of Inventory Sold', isSubtotal: true, currentBalance: invSold, priorBalance: priorInvSold, variance: invSold - priorInvSold, isRevenue: false });
    }
    // Other cost of sales accounts (700300, 700400, 700500, 700700, 700800)
    for (const a of currAccounts) {
      const code = a.code || a.accountId;
      const priorBal = priorMap.get(code) || 0;
      secCurr += a.balance;
      secPrior += priorBal;
      children.push({ accountId: a.accountId, name: a.name, code: a.code, currentBalance: a.balance, priorBalance: priorBal, variance: a.balance - priorBal, isRevenue: false });
    }
    for (const a of priorAccounts) {
      const code = a.code || a.accountId;
      if (!currAccounts.some((ca: any) => (ca.code || ca.accountId) === code)) {
        secPrior += a.balance;
        children.push({ accountId: a.accountId, name: a.name, code: a.code, currentBalance: 0, priorBalance: a.balance, variance: 0 - a.balance, isRevenue: false });
      }
    }
    rows.push({ section: 'Cost of Sales', children, totalCurrent: secCurr, totalPrior: secPrior, isRevenue: false });
  })();
  // 4. Gross Profit
  const gpCurr = current?.grossProfit ?? (trCurr - (current?.costOfSales?.total || 0));
  const gpPrior = prior?.grossProfit ?? (trPrior - (prior?.costOfSales?.total || 0));
  rows.push({ section: 'GROSS PROFIT', isSummary: true, summaryCurrent: gpCurr, summaryPrior: gpPrior, isRevenue: true });
  // 5. Operating Expenses sub-sections
  const subSections = [
    { key: 'staffCosts', label: 'Staff Costs', isRevenue: false },
    { key: 'administrative', label: 'Administrative Expenses', isRevenue: false },
    { key: 'sellingDistribution', label: 'Selling & Distribution Expenses', isRevenue: false },
    { key: 'otherOperatingExpenses', label: 'Other Operating Expenses', isRevenue: false },
  ];
  for (const sub of subSections) {
    const currAccounts = current?.[sub.key]?.accounts || [];
    const priorAccounts = prior?.[sub.key]?.accounts || [];
    if (currAccounts.length > 0 || priorAccounts.length > 0) {
      rows.push(buildSec(sub.key, sub.label, false));
    }
  }
  // Total Operating Expenses summary
  const opExCurr = current?.totalOperatingExpenses ?? 0;
  const opExPrior = prior?.totalOperatingExpenses ?? 0;
  rows.push({ section: 'Total Operating Expenses', isSummary: true, summaryCurrent: opExCurr, summaryPrior: opExPrior, isRevenue: false });
  // 6. Operating Profit (EBIT)
  const opCurr = current?.operatingProfit ?? (gpCurr - opExCurr);
  const opPrior = prior?.operatingProfit ?? (gpPrior - opExPrior);
  rows.push({ section: 'OPERATING PROFIT (EBIT)', isSummary: true, summaryCurrent: opCurr, summaryPrior: opPrior, isRevenue: true });
  // 7. Finance Income (if any)
  const fiCurr = current?.financeIncome?.accounts || [];
  const fiPrior = prior?.financeIncome?.accounts || [];
  if (fiCurr.length > 0 || fiPrior.length > 0) {
    rows.push(buildSec('financeIncome', 'Finance Income', true));
  }
  // 8. Finance Costs (if any)
  const fcCurr = current?.financeCosts?.accounts || [];
  const fcPrior = prior?.financeCosts?.accounts || [];
  if (fcCurr.length > 0 || fcPrior.length > 0) {
    rows.push(buildSec('financeCosts', 'Finance Costs', false));
  }
  // 9. Profit Before Tax
  const fiTotalCurr = current?.financeIncome?.total || 0;
  const fcTotalCurr = current?.financeCosts?.total || 0;
  const fiTotalPrior = prior?.financeIncome?.total || 0;
  const fcTotalPrior = prior?.financeCosts?.total || 0;
  const pbtCurr = current?.profitBeforeTax ?? (opCurr + fiTotalCurr - fcTotalCurr);
  const pbtPrior = prior?.profitBeforeTax ?? (opPrior + fiTotalPrior - fcTotalPrior);
  rows.push({ section: 'PROFIT BEFORE TAX', isSummary: true, summaryCurrent: pbtCurr, summaryPrior: pbtPrior, isRevenue: true });
  // 10. Income Tax Expense (if any)
  const txCurr = current?.incomeTaxExpense?.accounts || [];
  const txPrior = prior?.incomeTaxExpense?.accounts || [];
  if (txCurr.length > 0 || txPrior.length > 0) {
    rows.push(buildSec('incomeTaxExpense', 'Income Tax Expense', false));
  }
  // 11. Net Profit After Tax
  const npCurr = current?.netProfit ?? (pbtCurr - (current?.incomeTaxExpense?.total || 0));
  const npPrior = prior?.netProfit ?? (pbtPrior - (prior?.incomeTaxExpense?.total || 0));
  rows.push({ section: 'NET PROFIT AFTER TAX', isSummary: true, summaryCurrent: npCurr, summaryPrior: npPrior, isRevenue: true });
  return rows;
}

function SinglePeriodPnLTable({ current, onAccountClick, showZero, showCodes }: { current: any; onAccountClick?: (acct: any) => void; showZero?: boolean; showCodes?: boolean }) {
  function shouldShow(balance: number): boolean {
    return showZero || Math.abs(balance) > 0.01;
  }
  function fmtPnL(val: number): string {
    const abs = Math.abs(val / 100);
    const formatted = abs.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return val < 0 ? `(₦${formatted})` : `₦${formatted}`;
  }
  function renderSection(label: string, accounts: any[], total: number, indent: string = 'pl-8', subIndent: string = 'pl-8') {
    const visible = (accounts || []).filter((a: any) => shouldShow(a.balance));
    if (!showZero && visible.length === 0 && Math.abs(total) < 0.01) return null;
    return (
      <>
        <tr className="bg-slate-100/50">
          <td colSpan={2} className="px-3 py-2 text-xs font-bold text-slate-700 uppercase tracking-wider">{label}</td>
        </tr>
        {visible.map((a: any, i: number) => (
          <tr key={i} className={`border-t border-slate-100 hover:bg-slate-50/50 even:bg-slate-50/50 transition-colors ${a.accountId ? 'cursor-pointer' : ''}`} onClick={() => a.accountId && onAccountClick?.(a)}>
            <td className={`px-3 py-2.5 ${subIndent} text-slate-800`}>{showCodes && a.code ? <span className="text-slate-400 mr-1.5 text-[11px] font-mono">{a.code}</span> : ''}{a.name}</td>
            <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{fmtPnL(a.balance)}</td>
          </tr>
        ))}
        <tr className="border-t border-slate-200 bg-slate-50/50 font-medium">
          <td className={`px-3 py-2 ${indent} text-sm text-slate-700`}>Total {label}</td>
          <td className="px-3 py-2 text-right text-slate-800">{fmtPnL(total)}</td>
        </tr>
      </>
    );
  }
  function renderSubSection(label: string, data: any, indent: string = 'pl-10', subIndent: string = 'pl-14') {
    const accounts = data?.accounts || [];
    const total = data?.total || 0;
    const visible = accounts.filter((a: any) => shouldShow(a.balance));
    if (!showZero && visible.length === 0 && Math.abs(total) < 0.01) return null;
    return (
      <>
        <tr className="bg-slate-50/30">
          <td colSpan={2} className={`px-3 py-1.5 ${indent} text-xs font-semibold text-slate-500 uppercase tracking-wider`}>{label}</td>
        </tr>
        {visible.map((a: any, i: number) => (
          <tr key={i} className={`border-t border-slate-100 hover:bg-slate-50/50 even:bg-slate-50/50 transition-colors ${a.accountId ? 'cursor-pointer' : ''}`} onClick={() => a.accountId && onAccountClick?.(a)}>
            <td className={`px-3 py-2 ${subIndent} text-slate-700`}>{showCodes && a.code ? <span className="text-slate-400 mr-1.5 text-[11px] font-mono">{a.code}</span> : ''}{a.name}</td>
            <td className="px-3 py-2 text-right font-semibold text-slate-700">{fmtPnL(a.balance)}</td>
          </tr>
        ))}
        <tr className="border-t border-slate-200 bg-slate-50/30 font-medium">
          <td className={`px-3 py-1.5 ${indent} text-xs text-slate-500`}>Total {label}</td>
          <td className="px-3 py-1.5 text-right text-slate-600">{fmtPnL(total)}</td>
        </tr>
      </>
    );
  }
  function profitRow(label: string, value: number, isLoss: boolean = false) {
    return (
      <tr className={`border-t-2 ${isLoss ? 'border-red-300 bg-red-50/50' : 'border-slate-300 bg-slate-100'} font-bold`}>
        <td className={`px-3 py-2.5 pl-8 text-sm ${isLoss ? 'text-red-700' : 'text-slate-900'}`}>{label}</td>
        <td className={`px-3 py-2.5 text-right ${isLoss ? 'text-red-700' : 'text-slate-900'}`}>{fmtPnL(value)}</td>
      </tr>
    );
  }
  function renderCostOfSales(cos: any) {
    const accounts = cos?.accounts || [];
    const casTotal = cos?.total || 0;
    const opening = cos?.openingStock ?? 0;
    const closing = cos?.closingStock ?? 0;
    const invSold = cos?.inventorySold ?? 0;
    const pog = cos?.purchasesOfGoods || null;
    const hasInvCalc = opening !== 0 || (pog && pog.balance !== 0) || closing !== 0;
    const visible = accounts.filter((a: any) => shouldShow(a.balance));
    if (!showZero && !hasInvCalc && visible.length === 0 && Math.abs(casTotal) < 0.01) return null;
    const showInv = !showZero ? (hasInvCalc || Math.abs(invSold) >= 0.01) : true;
    return (
      <>
        <tr className="bg-slate-100/50">
          <td colSpan={2} className="px-3 py-2 text-xs font-bold text-slate-700 uppercase tracking-wider">Cost of Sales</td>
        </tr>
        {showInv && (
          <>
            <tr className="border-t border-slate-100 bg-slate-50/30">
              <td className="px-3 py-2 pl-12 text-xs font-semibold text-slate-500">Cost of Inventory Sold</td>
              <td></td>
            </tr>
            {shouldShow(opening) && (
              <tr className="border-t border-slate-100 even:bg-slate-50/50 hover:bg-slate-50/50 transition-colors">
                <td className="px-3 py-2.5 pl-16 text-slate-700">Opening Stock</td>
                <td className="px-3 py-2.5 text-right font-semibold text-slate-700">{fmtPnL(opening)}</td>
              </tr>
            )}
            {pog && shouldShow(pog.balance) && (
              <tr className="border-t border-slate-100 even:bg-slate-50/50 hover:bg-slate-50/50 transition-colors">
                <td className="px-3 py-2.5 pl-16 text-slate-700">{showCodes ? <span className="text-slate-400 mr-1.5 text-[11px] font-mono">{pog.code}</span> : ''}{pog.name}</td>
                <td className="px-3 py-2.5 text-right font-semibold text-slate-700">{fmtPnL(pog.balance)}</td>
              </tr>
            )}
            {shouldShow(closing) && (
              <tr className="border-t border-slate-100 even:bg-slate-50/50 hover:bg-slate-50/50 transition-colors">
                <td className="px-3 py-2.5 pl-16 text-slate-700">Closing Stock</td>
                <td className="px-3 py-2.5 text-right font-semibold text-slate-700">{fmtPnL(-closing)}</td>
              </tr>
            )}
            <tr className="border-t border-slate-200 bg-slate-50/50 font-medium">
              <td className="px-3 py-2 pl-12 text-sm text-slate-700">Cost of Inventory Sold</td>
              <td className="px-3 py-2 text-right text-slate-800">{fmtPnL(invSold)}</td>
            </tr>
          </>
        )}
        {visible.map((a: any, i: number) => (
          <tr key={i} className={`border-t border-slate-100 hover:bg-slate-50/50 even:bg-slate-50/50 transition-colors ${a.accountId ? 'cursor-pointer' : ''}`} onClick={() => a.accountId && onAccountClick?.(a)}>
            <td className={`px-3 py-2.5 pl-12 text-slate-800`}>{showCodes && a.code ? <span className="text-slate-400 mr-1.5 text-[11px] font-mono">{a.code}</span> : ''}{a.name}</td>
            <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{fmtPnL(a.balance)}</td>
          </tr>
        ))}
        <tr className="border-t border-slate-200 bg-slate-50/50 font-medium">
          <td className="px-3 py-2 pl-8 text-sm text-slate-700">Total Cost of Sales</td>
          <td className="px-3 py-2 text-right text-slate-800">{fmtPnL(casTotal)}</td>
        </tr>
      </>
    );
  }

  const opRev = current?.operatingRevenue || {};
  const ooi = current?.otherOperatingIncome || {};
  const cos = current?.costOfSales || {};
  const sc = current?.staffCosts || {};
  const adm = current?.administrative || {};
  const sd = current?.sellingDistribution || {};
  const ooe = current?.otherOperatingExpenses || {};
  const fi = current?.financeIncome || {};
  const fc = current?.financeCosts || {};
  const tx = current?.incomeTaxExpense || {};

  const opRevTotal = opRev.total || 0;
  const ooiTotal = ooi.total || 0;
  const totalRevenue = current?.totalRevenue ?? (opRevTotal + ooiTotal);
  const cosTotal = cos.total || 0;
  const grossProfit = current?.grossProfit ?? (totalRevenue - cosTotal);
  const scTotal = sc.total || 0;
  const admTotal = adm.total || 0;
  const sdTotal = sd.total || 0;
  const ooeTotal = ooe.total || 0;
  const opExTotal = current?.totalOperatingExpenses ?? (scTotal + admTotal + sdTotal + ooeTotal);
  const operatingProfit = current?.operatingProfit ?? (grossProfit - opExTotal);
  const fiTotal = fi.total || 0;
  const fcTotal = fc.total || 0;
  const profitBeforeTax = current?.profitBeforeTax ?? (operatingProfit + fiTotal - fcTotal);
  const txTotal = tx.total || 0;
  const netProfit = current?.netProfit ?? (profitBeforeTax - txTotal);
  const effectiveTaxRate = current?.effectiveTaxRate ?? (profitBeforeTax > 0 ? Math.round((txTotal / profitBeforeTax) * 1000) / 10 : 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          <tr>
            <th className="text-left px-3 py-3">Account</th>
            <th className="text-right px-3 py-3">Amount</th>
          </tr>
        </thead>
        <tbody>
          {renderSection('Operating Revenue', opRev.accounts, opRevTotal)}
          {renderSection('Other Operating Income', ooi.accounts, ooiTotal)}
          <tr className="border-t border-slate-200 bg-slate-100/70 font-semibold">
            <td className="px-3 py-2 pl-8 text-sm text-slate-800">TOTAL REVENUE</td>
            <td className="px-3 py-2 text-right text-slate-800">{fmtPnL(totalRevenue)}</td>
          </tr>
          {renderCostOfSales(cos)}
          {profitRow('GROSS PROFIT', grossProfit, grossProfit < 0)}
          <tr className="bg-slate-100/50">
            <td colSpan={2} className="px-3 py-2 text-xs font-bold text-slate-700 uppercase tracking-wider">Operating Expenses</td>
          </tr>
          {renderSubSection('Staff Costs', sc)}
          {renderSubSection('Administrative Expenses', adm)}
          {renderSubSection('Selling & Distribution Expenses', sd)}
          {renderSubSection('Other Operating Expenses', ooe)}
          <tr className="border-t border-slate-200 bg-slate-100/70 font-semibold">
            <td className="px-3 py-2 pl-8 text-sm text-slate-800">Total Operating Expenses</td>
            <td className="px-3 py-2 text-right text-slate-800">{fmtPnL(opExTotal)}</td>
          </tr>
          {profitRow('OPERATING PROFIT (EBIT)', operatingProfit, operatingProfit < 0)}
          {renderSection('Finance Income', fi.accounts, fiTotal)}
          {renderSection('Finance Costs', fc.accounts, fcTotal)}
          {profitRow('PROFIT BEFORE TAX', profitBeforeTax, profitBeforeTax < 0)}
          {renderSection('Income Tax Expense', tx.accounts, txTotal)}
          <tr className={`border-t-2 font-bold ${netProfit < 0 ? 'border-red-500 bg-red-50' : 'border-slate-400 bg-slate-100'}`}>
            <td className={`px-3 py-3 text-sm ${netProfit < 0 ? 'text-red-800' : 'text-slate-900'}`}>NET PROFIT AFTER TAX</td>
            <td className={`px-3 py-3 text-right ${netProfit < 0 ? 'text-red-800' : 'text-slate-900'}`}>{fmtPnL(netProfit)}</td>
          </tr>
          {profitBeforeTax > 0 && (
            <tr className="bg-slate-50 border-t border-slate-200">
              <td colSpan={2} className="px-3 py-2 text-xs text-slate-500 italic">Effective Tax Rate: {effectiveTaxRate}%  (Tax Expense ÷ Profit Before Tax)</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ComparativePnLTable({ current, prior, onAccountClick }: { current: any; prior: any | null; onAccountClick?: (acct: any) => void }) {
  const rows = buildPnLRows(current, prior);
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          <tr>
            <th className="text-left px-3 py-3">Account</th>
            <th className="text-right px-3 py-3">Current Period</th>
            <th className="text-right px-3 py-3">Prior Period</th>
            <th className="text-right px-3 py-3">Variance (₦)</th>
            <th className="text-right px-3 py-3">Variance (%)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((section: any, si: number) => (
            <React.Fragment key={si}>
              <tr className="bg-slate-100/50">
                <td colSpan={5} className="px-3 py-2 text-xs font-bold text-slate-700 uppercase tracking-wider">{section.section}</td>
              </tr>
              {!section.isSummary && section.children.map((row: any, ri: number) => {
                const varPct = row.priorBalance !== 0 ? ((row.variance / row.priorBalance) * 100).toFixed(1) : '—';
                return (
                  <tr key={ri} className={`border-t border-slate-100 hover:bg-slate-50/50 even:bg-slate-50/50 transition-colors ${row.accountId ? 'cursor-pointer' : ''}`} onClick={() => row.accountId && onAccountClick?.(row)}>
                    <td className="px-3 py-2.5 pl-8 text-slate-800">{row.name}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{fmtNaira(row.currentBalance)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-600">{fmtNaira(row.priorBalance)}</td>
                    <td className={`px-3 py-2.5 text-right font-semibold ${formatVarianceClass(row.variance, row.isRevenue)}`}>{fmtNaira(row.variance)}</td>
                    <td className={`px-3 py-2.5 text-right font-semibold ${formatVarianceClass(row.variance, row.isRevenue)}`}>{varPct}{varPct !== '—' ? '%' : ''}</td>
                  </tr>
                );
              })}
              {!section.isSummary && (
                <tr className="border-t border-slate-200 bg-slate-50/50 font-medium">
                  <td className="px-3 py-2 pl-8 text-sm text-slate-700">Total {section.section}</td>
                  <td className="px-3 py-2 text-right text-slate-800">{fmtNaira(section.totalCurrent)}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{fmtNaira(section.totalPrior)}</td>
                  <td className={`px-3 py-2 text-right ${formatVarianceClass(section.totalCurrent - section.totalPrior, section.isRevenue)}`}>{fmtNaira(section.totalCurrent - section.totalPrior)}</td>
                  <td className={`px-3 py-2 text-right ${formatVarianceClass(section.totalCurrent - section.totalPrior, section.isRevenue)}`}>
                    {section.totalPrior !== 0 ? `${((section.totalCurrent - section.totalPrior) / section.totalPrior * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              )}
              {section.isSummary && (
                <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold">
                  <td className="px-3 py-3 text-sm text-slate-900">{section.section}</td>
                  <td className="px-3 py-3 text-right text-slate-900">{fmtNaira(section.summaryCurrent)}</td>
                  <td className="px-3 py-3 text-right text-slate-700">{fmtNaira(section.summaryPrior)}</td>
                  <td className={`px-3 py-3 text-right ${formatVarianceClass(section.summaryCurrent - section.summaryPrior, section.isRevenue)}`}>{fmtNaira(section.summaryCurrent - section.summaryPrior)}</td>
                  <td className={`px-3 py-3 text-right ${formatVarianceClass(section.summaryCurrent - section.summaryPrior, section.isRevenue)}`}>
                    {section.summaryPrior !== 0 ? `${((section.summaryCurrent - section.summaryPrior) / section.summaryPrior * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SinglePeriodBalanceSheetTable({ data, onAccountClick, showZero, showCodes }: { data: any; onAccountClick?: (acct: any) => void; showZero?: boolean; showCodes?: boolean }) {
  if (!data) return <div className="p-6 text-center text-slate-400 text-sm">No balance sheet data available.</div>;

  const hasOB = Math.abs(data.outOfBalance) > 1;

  function shouldShow(balance: number): boolean {
    return showZero || Math.abs(balance) > 0.01;
  }

  function fmt(val: number): string {
    return `₦${(val / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function renderItems(items: any[], indent: string = 'pl-8', labelPrefix: string = '') {
    return items.filter((i: any) => shouldShow(i.balance)).map((item: any, idx: number) => (
      <tr key={`${item.accountId || item.code || idx}`} className={`border-t border-slate-100 hover:bg-slate-50/50 even:bg-slate-50/50 transition-colors ${item.accountId !== 're-opening' && item.accountId !== 're-profit-period' && item.accountId !== 're-dividends' && item.accountId !== 're-other' && item.accountId && !item.accountId.startsWith('re-') ? 'cursor-pointer' : ''}`}
        onClick={() => item.accountId && !item.accountId.startsWith('re-') && onAccountClick?.(item)}>
        <td className={`px-3 py-2 ${indent} ${item.balance === 0 ? 'text-slate-300' : 'text-slate-800'}`}>
          {showCodes && item.code ? <span className="text-slate-400 mr-1.5 text-[11px] font-mono">{item.code}</span> : ''}
          {item.name}{item.reclassified ? <span className="text-slate-400 italic text-[10px] ml-1">(reclassified)</span> : ''}
        </td>
        <td className={`px-3 py-2 text-right ${item.balance === 0 ? 'text-slate-300' : 'font-semibold text-slate-800'}`}>{fmt(item.balance)}</td>
      </tr>
    ));
  }

  function renderSection(label: string, total: number, items: any[], indent: string = 'pl-8', bg: string = 'bg-slate-100/50') {
    if (!showZero && total === 0 && items.every((i: any) => !shouldShow(i.balance))) return null;
    const sectionItems = items.filter((i: any) => i.name !== label);
    return (
      <>
        <tr className={bg}>
          <td colSpan={2} className="px-3 py-2 text-xs font-bold text-slate-700 uppercase tracking-wider">{label}</td>
        </tr>
        {renderItems(sectionItems, indent)}
        <tr className="border-t border-slate-200 bg-slate-50/50 font-medium">
          <td className="px-3 py-2 pl-8 text-sm text-slate-700">Total {label}</td>
          <td className="px-3 py-2 text-right text-slate-800">{fmt(total)}</td>
        </tr>
      </>
    );
  }

  function renderNBVSection(label: string, costItems: any[], costTotal: number, contraItems: any[], contraTotal: number, netTotal: number) {
    const show = showZero || netTotal !== 0 || costTotal !== 0;
    if (!show) return null;
    return (
      <>
        <tr className="bg-slate-100/50">
          <td colSpan={2} className="px-3 py-2 text-xs font-bold text-slate-700 uppercase tracking-wider">{label}</td>
        </tr>
        {renderItems(costItems, 'pl-8')}
        {contraItems.length > 0 && contraItems.map((ci: any) => (
          <tr key={ci.accountId || ci.code} className="border-t border-slate-100 text-slate-500">
            <td className="px-3 py-2 pl-8 text-sm">Less: {ci.name}</td>
            <td className="px-3 py-2 text-right text-sm">{fmt(-Math.abs(ci.balance))}</td>
          </tr>
        ))}
        <tr className="border-t border-slate-200 bg-slate-50/50 font-semibold">
          <td className="px-3 py-2 pl-8 text-sm text-slate-700">Net Book Value – {label}</td>
          <td className="px-3 py-2 text-right text-slate-800">{fmt(netTotal)}</td>
        </tr>
      </>
    );
  }

  const ca = data?.currentAssets || {};
  const nca = data?.nonCurrentAssets || {};
  const cl = data?.currentLiabilities || {};
  const ncl = data?.nonCurrentLiabilities || {};
  const eq = data?.equity || {};

  const caSections = ca.subSections || [];
  const ncaSections = nca.subSections || [];
  const clSections = cl.subSections || [];
  const nclSections = ncl.subSections || [];
  const eqSections = eq.subSections || [];

  const totalAssets = data?.totalAssets || 0;
  const totalLiabilities = data?.totalLiabilities || 0;
  const totalEquity = data?.totalEquity || 0;
  const liabilitiesAndEquity = totalLiabilities + totalEquity;

  return (
    <div className="space-y-4">
      {hasOB && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-red-800 text-sm">⚠ Trial Balance Out of Balance by {fmt(Math.abs(data.outOfBalance))}</p>
            <p className="text-red-600 text-xs mt-1">This report may be unreliable. Please reconcile your journals before publishing this statement.</p>
          </div>
        </div>
      )}

      {(data?.reclassified || []).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
          {data.reclassified.map((r: any, i: number) => (
            <p key={i}>• Reclassified <strong>{r.from}</strong> from {r.fromSection} to {r.toSection} ({r.reason})</p>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="text-left px-3 py-3">Account</th>
              <th className="text-right px-3 py-3">Balance</th>
            </tr>
          </thead>
          <tbody>
            {/* ASSETS */}
            <tr className="bg-blue-50"><td colSpan={2} className="px-3 py-2.5 text-xs font-bold text-blue-800 uppercase tracking-wider tracking-wide">Assets</td></tr>

            {/* Current Assets */}
            <tr className="bg-blue-50/50"><td colSpan={2} className="px-3 py-1.5 pl-6 text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Current Assets</td></tr>
            {caSections.map((sec: any) => (
              sec.key === 'ppe' || sec.key === 'rou' || sec.key === 'intangibles'
                ? renderNBVSection(sec.label, sec.items || [], sec.total || 0, sec.contraItems || [], sec.contraTotal || 0, sec.netTotal ?? sec.total)
                : renderSection(sec.label, sec.total || 0, sec.items || [], 'pl-10', 'bg-blue-50/20')
            ))}
            <tr className="border-t-2 border-blue-200 bg-blue-50/70 font-bold">
              <td className="px-3 py-2 pl-6 text-sm text-slate-800">Total Current Assets</td>
              <td className="px-3 py-2 text-right text-slate-800">{fmt(ca.total || 0)}</td>
            </tr>

            {/* Non-Current Assets */}
            <tr className="bg-blue-50/50"><td colSpan={2} className="px-3 py-1.5 pl-6 text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Non-Current Assets</td></tr>
            {ncaSections.map((sec: any) => (
              sec.key === 'ppe' || sec.key === 'rou' || sec.key === 'intangibles'
                ? renderNBVSection(sec.label, sec.items || [], sec.total || 0, sec.contraItems || [], sec.contraTotal || 0, sec.netTotal ?? sec.total)
                : renderSection(sec.label, sec.total || 0, sec.items || [], 'pl-10', 'bg-blue-50/20')
            ))}
            <tr className="border-t-2 border-blue-200 bg-blue-50/70 font-bold">
              <td className="px-3 py-2 pl-6 text-sm text-slate-800">Total Non-Current Assets</td>
              <td className="px-3 py-2 text-right text-slate-800">{fmt(nca.total || 0)}</td>
            </tr>

            {/* Total Assets */}
            <tr className="border-t-2 border-blue-300 bg-blue-100 font-bold text-base">
              <td className="px-3 py-3 text-slate-900">TOTAL ASSETS</td>
              <td className="px-3 py-3 text-right text-slate-900">{fmt(totalAssets)}</td>
            </tr>

            {/* LIABILITIES */}
            <tr className="bg-amber-50"><td colSpan={2} className="px-3 py-2.5 text-xs font-bold text-amber-800 uppercase tracking-wider tracking-wide">Liabilities</td></tr>

            {/* Current Liabilities */}
            <tr className="bg-amber-50/50"><td colSpan={2} className="px-3 py-1.5 pl-6 text-[10px] font-semibold text-amber-600 uppercase tracking-wider">Current Liabilities</td></tr>
            {clSections.map((sec: any) => renderSection(sec.label, sec.total || 0, sec.items || [], 'pl-10', 'bg-amber-50/20'))}
            <tr className="border-t-2 border-amber-200 bg-amber-50/70 font-bold">
              <td className="px-3 py-2 pl-6 text-sm text-slate-800">Total Current Liabilities</td>
              <td className="px-3 py-2 text-right text-slate-800">{fmt(cl.total || 0)}</td>
            </tr>

            {/* Non-Current Liabilities */}
            <tr className="bg-amber-50/50"><td colSpan={2} className="px-3 py-1.5 pl-6 text-[10px] font-semibold text-amber-600 uppercase tracking-wider">Non-Current Liabilities</td></tr>
            {nclSections.map((sec: any) => renderSection(sec.label, sec.total || 0, sec.items || [], 'pl-10', 'bg-amber-50/20'))}
            <tr className="border-t-2 border-amber-200 bg-amber-50/70 font-bold">
              <td className="px-3 py-2 pl-6 text-sm text-slate-800">Total Non-Current Liabilities</td>
              <td className="px-3 py-2 text-right text-slate-800">{fmt(ncl.total || 0)}</td>
            </tr>

            {/* Total Liabilities */}
            <tr className="border-t-2 border-amber-300 bg-amber-100 font-bold">
              <td className="px-3 py-2.5 text-sm text-slate-900">TOTAL LIABILITIES</td>
              <td className="px-3 py-2.5 text-right text-slate-900">{fmt(totalLiabilities)}</td>
            </tr>

            {/* EQUITY */}
            <tr className="bg-violet-50"><td colSpan={2} className="px-3 py-2.5 text-xs font-bold text-violet-800 uppercase tracking-wider tracking-wide">Equity</td></tr>
            {eqSections.map((sec: any) => renderSection(sec.label, sec.total || 0, sec.items || [], 'pl-10', 'bg-violet-50/20'))}
            <tr className="border-t-2 border-violet-200 bg-violet-100 font-bold">
              <td className="px-3 py-2.5 text-sm text-slate-900">TOTAL EQUITY</td>
              <td className="px-3 py-2.5 text-right text-slate-900">{fmt(totalEquity)}</td>
            </tr>

            {/* Total Liabilities & Equity */}
            <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold text-base">
              <td className="px-3 py-3 text-slate-900">TOTAL LIABILITIES &amp; EQUITY</td>
              <td className="px-3 py-3 text-right text-slate-900">{fmt(liabilitiesAndEquity)}</td>
            </tr>

            {/* Accounting Equation Check */}
            <tr className="border-t border-slate-200">
              <td colSpan={2} className="px-3 py-2 text-xs text-slate-500">
                Accounting Equation Check: Total Assets ({fmt(totalAssets)}) = Total Liabilities ({fmt(totalLiabilities)}) + Total Equity ({fmt(totalEquity)})
                {Math.abs(totalAssets - liabilitiesAndEquity) < 1 ? <span className="text-emerald-600 font-bold ml-2">✅ Balanced</span> : <span className="text-red-600 font-bold ml-2">⚠ {fmt(totalAssets - liabilitiesAndEquity)} out of balance</span>}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ComparativeBalanceSheetTable({ current, prior, onAccountClick }: { current: any; prior: any | null; onAccountClick?: (acct: any) => void }) {
  function renderSection(label: string, currAccounts: any[], priorAccounts: any[], currTotal: number, priorTotal: number, color: string) {
    const priorMap = new Map((priorAccounts || []).map((a: any) => [a.code || a.accountId, a.balance]));
    return (
      <>
        <tr className={`bg-${color}-50`}><td colSpan={5} className="px-3 py-2 text-xs font-bold text-${color}-800 uppercase tracking-wider">{label}</td></tr>
        {(currAccounts || []).map((a: any, i: number) => {
          const priorBal = priorMap.get(a.code || a.accountId) || 0;
          const variance = a.balance - priorBal;
          return (
            <tr key={i} className={`border-t border-slate-100 hover:bg-slate-50/50 even:bg-slate-50/50 transition-colors ${a.accountId ? 'cursor-pointer' : ''}`} onClick={() => a.accountId && onAccountClick?.(a)}>
              <td className="px-3 py-2.5 pl-8 text-slate-800">{a.name}</td>
              <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{fmtNaira(a.balance)}</td>
              <td className="px-3 py-2.5 text-right text-slate-600">{fmtNaira(priorBal)}</td>
              <td className={`px-3 py-2.5 text-right font-semibold ${variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtNaira(variance)}</td>
              <td className={`px-3 py-2.5 text-right font-semibold ${variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{priorBal !== 0 ? `${(variance / priorBal * 100).toFixed(1)}%` : '—'}</td>
            </tr>
          );
        })}
        <tr className={`border-t-2 border-${color}-200 bg-${color}-50/50 font-bold`}>
          <td className="px-3 py-2 text-sm text-slate-800">Total {label}</td>
          <td className="px-3 py-2 text-right text-slate-800">{fmtNaira(currTotal)}</td>
          <td className="px-3 py-2 text-right text-slate-600">{fmtNaira(priorTotal)}</td>
          <td className="px-3 py-2 text-right">{fmtNaira(currTotal - priorTotal)}</td>
          <td className="px-3 py-2 text-right">{priorTotal !== 0 ? `${((currTotal - priorTotal) / priorTotal * 100).toFixed(1)}%` : '—'}</td>
        </tr>
      </>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          <tr>
            <th className="text-left px-3 py-3">Account</th>
            <th className="text-right px-3 py-3">Current</th>
            <th className="text-right px-3 py-3">Prior</th>
            <th className="text-right px-3 py-3">Variance (₦)</th>
            <th className="text-right px-3 py-3">Variance (%)</th>
          </tr>
        </thead>
        <tbody>
          {renderSection('Assets', current?.assets?.accounts, prior?.assets?.accounts, current?.totalAssets || 0, prior?.totalAssets || 0, 'blue')}
          {renderSection('Liabilities', current?.liabilities?.accounts, prior?.liabilities?.accounts, current?.totalLiabilities || 0, prior?.totalLiabilities || 0, 'amber')}
          {renderSection('Equity', current?.equity?.accounts, prior?.equity?.accounts, current?.totalEquity || 0, prior?.totalEquity || 0, 'violet')}
          <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold text-base">
            <td className="px-3 py-3 text-slate-900">Total Liabilities &amp; Equity</td>
            <td className="px-3 py-3 text-right text-slate-900">{fmtNaira(current?.totalLiabilities + current?.totalEquity || 0)}</td>
            <td className="px-3 py-3 text-right text-slate-700">{fmtNaira(prior ? prior.totalLiabilities + prior.totalEquity : 0)}</td>
            <td className="px-3 py-3 text-right text-slate-900">
              {prior ? fmtNaira((current?.totalLiabilities + current?.totalEquity || 0) - (prior.totalLiabilities + prior.totalEquity)) : '—'}
            </td>
            <td className="px-3 py-3 text-right text-slate-900">
              {prior && (prior.totalLiabilities + prior.totalEquity) !== 0
                ? `${((((current?.totalLiabilities + current?.totalEquity || 0) - (prior.totalLiabilities + prior.totalEquity)) / (prior.totalLiabilities + prior.totalEquity)) * 100).toFixed(1)}%`
                : '—'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SummaryTable({ data, columns, onAccountClick }: { data: any; columns: { key: string; label: string; fmt?: (v: any) => string }[]; onAccountClick?: (acct: any) => void }) {
  const rows = Array.isArray(data) ? data : [];
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          <tr>
            {columns.map(col => (
              <th key={col.key} className={`px-3 py-3 ${col.key === 'balance' || col.key === 'amount' ? 'text-right' : 'text-left'}`}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row: any, i: number) => (
            <tr key={i} className={`border-t border-slate-100 hover:bg-slate-50/50 even:bg-slate-50/50 transition-colors ${row.accountId ? 'cursor-pointer' : ''}`} onClick={() => row.accountId && onAccountClick?.(row)}>
              {columns.map(col => (
                <td key={col.key} className={`px-3 py-3 ${col.key === 'balance' || col.key === 'amount' ? 'text-right font-semibold text-slate-800' : 'text-slate-800'}`}>
                  {col.fmt ? col.fmt(row[col.key] ?? row.balance ?? row.amount ?? 0) : row[col.key] || '—'}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-slate-400">No data available.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}