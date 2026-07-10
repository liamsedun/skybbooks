import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { depreciationApi } from '../../lib/api';
import { PageLoader } from '../../components/ui/PageLoader';
import { Search } from 'lucide-react';

function fmtNaira(v: number): string {
  return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

export function DepreciationPage() {
  const [search, setSearch] = React.useState('');

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['depreciation-entries'],
    queryFn: depreciationApi.list,
  });

  const filtered = useMemo(() => {
    const list = Array.isArray(rows) ? rows : [];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((r: any) =>
      (r.accountCode || '').toLowerCase().includes(q) ||
      (r.accountName || '').toLowerCase().includes(q) ||
      (r.type || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totalDebit = useMemo(() => filtered.reduce((s: number, r: any) => s + (r.debit || 0), 0), [filtered]);
  const totalCredit = useMemo(() => filtered.reduce((s: number, r: any) => s + (r.credit || 0), 0), [filtered]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Depreciation</h1>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search by account code, name, or type..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
        </div>
        <span className="text-xs text-slate-400 font-medium whitespace-nowrap">{filtered.length} account{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {isLoading ? (
        <PageLoader message="Loading depreciation accounts..." />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Account Code</th>
                <th className="px-4 py-3 text-left">Account Name</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-right">Debit (₦)</th>
                <th className="px-4 py-3 text-right">Credit (₦)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: any) => (
                <tr key={r.accountId} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50">
                  <td className="px-4 py-3 font-mono text-indigo-600 font-medium">{r.accountCode}</td>
                  <td className="px-4 py-3 text-slate-800">{r.accountName}</td>
                  <td className="px-4 py-3 capitalize text-slate-500">{r.type}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900">
                    {r.debit > 0 ? fmtNaira(r.debit) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900">
                    {r.credit > 0 ? fmtNaira(r.credit) : '—'}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No depreciation accounts found.</td></tr>
              )}
            </tbody>
            <tfoot className="bg-slate-50 text-xs font-bold text-slate-700">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-right uppercase">Total</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900">{fmtNaira(totalDebit)}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900">{fmtNaira(totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
