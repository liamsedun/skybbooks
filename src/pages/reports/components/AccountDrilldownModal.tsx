import React from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { accountantApi } from '../../../lib/api';
import { X, ExternalLink } from 'lucide-react';
import { fmtNaira, getAccountModuleLink } from '../reportUtils';

export function AccountDrilldownModal({ account, sDate, eDate, onClose }: { account: any; sDate: string; eDate: string; onClose: () => void }) {
  const navigate = useNavigate();
  const link = getAccountModuleLink(account.accountCode || account.code || '', account.accountId);
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
      case 'journal': return { path: `/accountant/journals`, label: 'View Journal' };
      default: return null;
    }
  }

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm" />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl flex flex-col animate-slide-in" onClick={e => e.stopPropagation()}>
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

        <div className="px-6 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
          Period: {sDate} – {eDate} &middot; Opening Balance: {fmtNaira(openingBalance)}
        </div>

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
