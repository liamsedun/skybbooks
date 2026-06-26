import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../lib/api';
import { Loader2, AlertCircle, Download } from 'lucide-react';

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
  return <ReportShell reportType="trial-balance" title="Trial Balance" />;
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
      const res = await reportsApi.getTrialBalance({ startDate: sDate, endDate: eDate, format: 'json' });
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
