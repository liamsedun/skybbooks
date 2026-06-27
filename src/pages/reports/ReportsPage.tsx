import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { reportsApi } from '../../lib/api';
import { Loader2, AlertCircle, Download, Search, Upload, FileText, X, RefreshCw, ExternalLink } from 'lucide-react';
import { downloadCsv } from '../../lib/csvTemplates';

const MODULE_LINKS: { prefix: string; path: string; label: string }[] = [
  { prefix: '1002', path: '/banking', label: 'Banking' },
  { prefix: '1003', path: '/banking', label: 'Banking' },
  { prefix: '1004', path: '/banking', label: 'Banking' },
  { prefix: '1005', path: '/banking', label: 'Banking' },
  { prefix: '1011', path: '/sales/customers', label: 'Customers' },
  { prefix: '102', path: '/inventory/items', label: 'Items' },
  { prefix: '200', path: '/accountant/fixed-assets', label: 'Fixed Assets' },
  { prefix: '201', path: '/accountant/fixed-assets', label: 'Fixed Assets' },
  { prefix: '202', path: '/accountant/fixed-assets', label: 'Fixed Assets' },
  { prefix: '203', path: '/accountant/fixed-assets', label: 'Fixed Assets' },
  { prefix: '204', path: '/accountant/fixed-assets', label: 'Fixed Assets' },
  { prefix: '205', path: '/accountant/fixed-assets', label: 'Fixed Assets' },
  { prefix: '206', path: '/accountant/fixed-assets', label: 'Fixed Assets' },
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
  const rows = searchQuery
    ? rawRows.filter(r =>
        (r.accountCode || r.code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.accountName || r.name || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : rawRows;

  const handleExport = async (format: 'pdf' | 'csv') => {
    try {
      if (format === 'csv') {
        const blob = await reportsApi.getTrialBalance({ startDate: sDate, endDate: eDate, format: 'csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `trial_balance_${sDate}_to_${eDate}.csv`; a.click();
        URL.revokeObjectURL(url);
      } else {
        const res = await reportsApi.getTrialBalance({ startDate: sDate, endDate: eDate, format: 'pdf' });
        const url = URL.createObjectURL(res);
        window.open(url, '_blank');
      }
    } catch { /* ignore */ }
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Trial Balance</h1>
        <div className="flex gap-2">
          <button onClick={() => refetch()} disabled={isFetching} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50"><RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh</button>
          <button onClick={() => { downloadCsv('trial-balance-opening-balances-template.csv', ['accountCode', 'accountName', 'debit (NGN)', 'credit (NGN)'], ['100000', 'Cash and Cash Equivalents', '5000000', '0']); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-600 rounded-lg hover:bg-slate-700"><FileText className="w-3.5 h-3.5" /> Sample CSV</button>
          <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"><Upload className="w-3.5 h-3.5" /> Import Opening Balances</button>
          <button onClick={() => handleExport('pdf')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700"><Download className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={() => handleExport('csv')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"><Download className="w-3.5 h-3.5" /> CSV</button>
        </div>
      </div>

      <div className="flex gap-4 items-center bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">From:</label>
          <input type="date" value={sDate} onChange={e => setSDate(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">To:</label>
          <input type="date" value={eDate} onChange={e => setEDate(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search accounts..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : error ? (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-xl text-sm"><AlertCircle className="w-4 h-4" /> Failed to load report.</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Account Code</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Account Name</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Type</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Debit</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Credit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any, i: number) => {
                const link = getAccountModuleLink(row.accountCode || row.code || '');
                return (
                <tr key={i} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => setDrillDown(row)}>
                  <td className="px-4 py-3 text-slate-600 font-mono">{row.accountCode || row.code || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-800">{row.accountName || row.name || `Account ${i + 1}`}</span>
                    {link && (
                      <button
                        onClick={e => { e.stopPropagation(); navigate(link.path); }}
                        className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                        title={`Go to ${link.label}`}
                      ><ExternalLink className="w-3 h-3" /> {link.label}</button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500 capitalize">{row.accountType || row.type || '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{fmtNaira(row.closingDebit || row.debit || 0)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{fmtNaira(row.closingCredit || row.credit || 0)}</td>
                </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">{searchQuery ? 'No accounts match your search.' : 'No data available.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowImport(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Import Opening Balances</h2>
              <button onClick={() => setShowImport(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-slate-500">Upload a CSV file with columns: <code className="text-xs bg-slate-100 px-1 rounded">accountCode</code>, <code className="text-xs bg-slate-100 px-1 rounded">debit (NGN)</code>, <code className="text-xs bg-slate-100 px-1 rounded">credit (NGN)</code>. Debits must equal credits.</p>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFileUpload} className="block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
            {csvText && (
              <div className="text-xs text-slate-500 bg-slate-50 rounded p-2 max-h-24 overflow-auto">{csvText.slice(0, 500)}{csvText.length > 500 ? '...' : ''}</div>
            )}
            {importMsg && (
              <div className={`text-sm p-2 rounded ${importMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{importMsg.text}</div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowImport(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={handleImport} disabled={!csvText.trim() || importing} className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">{importing ? 'Importing...' : 'Import'}</button>
            </div>
          </div>
        </div>
      )}

      {drillDown && <AccountDrilldownModal account={drillDown} sDate={sDate} eDate={eDate} onClose={() => setDrillDown(null)} />}
    </div>
  );
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

function ReportShell({ reportType, title }: ReportPageProps) {
  const { startDate, endDate } = getDefaultDateRange();
  const [sDate, setSDate] = useState(startDate);
  const [eDate, setEDate] = useState(endDate);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

  const isBalanceSheet = reportType === 'balance-sheet';
  const isAgedReport = reportType === 'aged-receivables' || reportType === 'aged-payables';

  const { data, isLoading, error } = useQuery({
    queryKey: ['report', reportType, sDate, eDate, asOfDate],
    queryFn: async () => {
      if (isBalanceSheet) {
        const res = await reportsApi.getBalanceSheet({ asOfDate, format: 'json' });
        return res.data || res;
      }
      if (isAgedReport) {
        if (reportType === 'aged-receivables') {
          const res = await reportsApi.getAgedReceivables({ format: 'json' });
          return res.report || res.data || res;
        }
        const res = await reportsApi.getAgedPayables({ format: 'json' });
        return res.report || res.data || res;
      }
      const res = await reportsApi.getIncomeStatement({ startDate: sDate, endDate: eDate, format: 'json' });
      return res.data || res;
    },
  });

  const handleExport = async (format: 'pdf' | 'excel') => {
    let blob: Blob;
    try {
      if (reportType === 'trial-balance') {
        const res = await reportsApi.getTrialBalance({ startDate: sDate, endDate: eDate, format });
        blob = res;
      } else if (reportType === 'income-statement') {
        const res = await reportsApi.getIncomeStatement({ startDate: sDate, endDate: eDate, format });
        blob = res;
      } else if (reportType === 'balance-sheet') {
        const res = await reportsApi.getBalanceSheet({ asOfDate, format });
        blob = res;
      } else if (reportType === 'cash-flow') {
        const res = await reportsApi.getCashFlow({ startDate: sDate, endDate: eDate, format });
        blob = res;
      } else if (reportType === 'aged-receivables') {
        const res = await reportsApi.getAgedReceivables({ format });
        blob = res;
      } else {
        const res = await reportsApi.getAgedPayables({ format });
        blob = res;
      }
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch { /* ignore */ }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <div className="flex gap-2">
          <button onClick={() => handleExport('pdf')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700"><Download className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={() => handleExport('excel')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"><Download className="w-3.5 h-3.5" /> Excel</button>
        </div>
      </div>

      <div className="flex gap-4 items-center bg-white p-4 rounded-xl border border-slate-200">
        {isAgedReport ? (
          <p className="text-sm text-slate-500">Aging as of {fmtDate(new Date().toISOString())}</p>
        ) : isBalanceSheet ? (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600">As of:</label>
            <input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-600">From:</label>
              <input type="date" value={sDate} onChange={e => setSDate(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-600">To:</label>
              <input type="date" value={eDate} onChange={e => setEDate(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
            </div>
          </>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : error ? (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-xl text-sm"><AlertCircle className="w-4 h-4" /> Failed to load report.</div>
      ) : (
        <ReportTable data={data} reportType={reportType} />
      )}
    </div>
  );
}

function ReportTable({ data, reportType }: { data: any; reportType: ReportType }) {
  if (!data) return null;

  if (reportType === 'aged-receivables' || reportType === 'aged-payables') {
    const title = reportType === 'aged-receivables' ? 'Customer' : 'Vendor';
    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">{title}</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600">Current</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600">1-30 Days</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600">31-60 Days</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600">61-90 Days</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600">90+ Days</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600">Total</th>
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(data) ? data : []).map((row: any, i: number) => (
              <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{row.name || row.customerName || row.vendorName || `Item ${i + 1}`}</td>
                <td className="px-4 py-3 text-right text-slate-600">{fmtNaira(row.current || 0)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{fmtNaira(row.days1to30 || 0)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{fmtNaira(row.days31to60 || 0)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{fmtNaira(row.days61to90 || 0)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{fmtNaira(row.days90Plus || 0)}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmtNaira(row.total || row.current + row.days1to30 + row.days31to60 + row.days61to90 + row.days90Plus || 0)}</td>
              </tr>
            ))}
            {(!Array.isArray(data) || data.length === 0) && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No data available.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  if (reportType === 'balance-sheet') {
    return <SummaryTable data={data} columns={[{ key: 'accountName', label: 'Account' }, { key: 'balance', label: 'Balance', fmt: fmtNaira }]} />;
  }

  if (reportType === 'income-statement') {
    return <SummaryTable data={data} columns={[{ key: 'accountName', label: 'Account' }, { key: 'balance', label: 'Amount', fmt: fmtNaira }]} />;
  }

  if (reportType === 'cash-flow') {
    return <SummaryTable data={data} columns={[{ key: 'category', label: 'Category' }, { key: 'amount', label: 'Amount', fmt: fmtNaira }]} />;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="text-left px-4 py-3 font-semibold text-slate-600">Account Code</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600">Account Name</th>
            <th className="text-right px-4 py-3 font-semibold text-slate-600">Type</th>
            <th className="text-right px-4 py-3 font-semibold text-slate-600">Debit</th>
            <th className="text-right px-4 py-3 font-semibold text-slate-600">Credit</th>
          </tr>
        </thead>
        <tbody>
          {(Array.isArray(data) ? data : []).map((row: any, i: number) => (
            <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-600 font-mono">{row.code || row.accountCode || '—'}</td>
              <td className="px-4 py-3 font-medium text-slate-800">{row.name || row.accountName || `Account ${i + 1}`}</td>
              <td className="px-4 py-3 text-right text-slate-500 capitalize">{row.type || row.accountType || '—'}</td>
              <td className="px-4 py-3 text-right text-slate-600">{fmtNaira(row.debit || row.debitAmount || 0)}</td>
              <td className="px-4 py-3 text-right text-slate-600">{fmtNaira(row.credit || row.creditAmount || 0)}</td>
            </tr>
          ))}
          {(!Array.isArray(data) || data.length === 0) && (
            <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No data available.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AccountDrilldownModal({ account, sDate, eDate, onClose }: { account: any; sDate: string; eDate: string; onClose: () => void }) {
  const navigate = useNavigate();
  const link = getAccountModuleLink(account.accountCode || account.code || '');
  const { data, isLoading } = useQuery({
    queryKey: ['general-ledger', account.accountId, sDate, eDate],
    queryFn: async () => {
      const res = await reportsApi.getGeneralLedger({ accountId: account.accountId, startDate: sDate, endDate: eDate, format: 'json' });
      return res;
    },
    enabled: !!account.accountId && account.accountId !== 'suspense',
  });

  const lines = data?.lines || [];
  const totalDr = lines.reduce((s: number, l: any) => s + Number(l.debit), 0);
  const totalCr = lines.reduce((s: number, l: any) => s + Number(l.credit), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{account.accountName || account.name}</h2>
            <p className="text-xs text-slate-500">{account.accountCode || account.code} &middot; {account.accountType || account.type} &middot; Bal: {fmtNaira((account.closingDebit || account.debit || 0) - (account.closingCredit || account.credit || 0))}</p>
          </div>
          <div className="flex items-center gap-2">
            {link && (
              <button onClick={() => navigate(link.path)} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100"><ExternalLink className="w-3 h-3" /> View in {link.label}</button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="overflow-auto flex-1 p-4">
          {account.accountId === 'suspense' ? (
            <p className="text-sm text-slate-500 p-4">This is a system-generated suspense account balancing unreconciled module differences. No journal entries back it.</p>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
          ) : lines.length === 0 ? (
            <p className="text-sm text-slate-500 p-4">No journal entries in this period. The balance may come from module data (fixed assets, bank accounts, or contacts) or opening balances.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left px-3 py-2 font-semibold text-slate-600">Date</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-600">Entry</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-600">Description</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-600">Source</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-600">Debit</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-600">Credit</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-600">{new Date(l.date).toLocaleDateString('en-GB')}</td>
                    <td className="px-3 py-2 text-slate-800 font-mono">{l.entryNumber}</td>
                    <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate">{l.description || '—'}</td>
                    <td className="px-3 py-2"><span className="inline-block px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600 rounded">{l.source}</span></td>
                    <td className="px-3 py-2 text-right text-slate-600">{l.debit > 0 ? fmtNaira(l.debit) : '—'}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{l.credit > 0 ? fmtNaira(l.credit) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                  <td colSpan={4} className="px-3 py-2 text-slate-800">Total</td>
                  <td className="px-3 py-2 text-right text-slate-800">{fmtNaira(totalDr)}</td>
                  <td className="px-3 py-2 text-right text-slate-800">{fmtNaira(totalCr)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryTable({ data, columns }: { data: any; columns: { key: string; label: string; fmt?: (v: any) => string }[] }) {
  const rows = Array.isArray(data) ? data : [];
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map(col => (
              <th key={col.key} className={`px-4 py-3 font-semibold text-slate-600 ${col.key === 'balance' || col.key === 'amount' ? 'text-right' : 'text-left'}`}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row: any, i: number) => (
            <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
              {columns.map(col => (
                <td key={col.key} className={`px-4 py-3 ${col.key === 'balance' || col.key === 'amount' ? 'text-right font-semibold text-slate-800' : 'text-slate-800'}`}>
                  {col.fmt ? col.fmt(row[col.key] ?? row.balance ?? row.amount ?? 0) : row[col.key] || '—'}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400">No data available.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}