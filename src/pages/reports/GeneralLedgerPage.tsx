import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api, orgApi, journalsApi, printWindow } from '../../lib/api';
import { exportToCsv } from '../../lib/csvTemplates';
import { Loader2, ArrowLeft, Download, FileText, Eye } from 'lucide-react';

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
