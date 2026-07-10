import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { depreciationHistoryApi, fixedAssetsApi } from '../../lib/api';
import { PageLoader } from '../../components/ui/PageLoader';
import { Play, Loader2, X, ExternalLink, Search } from 'lucide-react';

function fmtNaira(v: number): string {
  return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

export function DepreciationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showRunModal, setShowRunModal] = useState(false);
  const [periodDate, setPeriodDate] = useState(new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['depreciation-history'],
    queryFn: depreciationHistoryApi.list,
  });

  const runMutation = useMutation({
    mutationFn: (d: string) => fixedAssetsApi.runDepreciation(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['depreciation-history'] });
      queryClient.invalidateQueries({ queryKey: ['fixed-assets'] });
      setShowRunModal(false);
    },
  });

  const filtered = search
    ? entries.filter((r: any) =>
        (r.assetNumber || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.assetName || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.jeNumber || '').toLowerCase().includes(search.toLowerCase())
      )
    : entries;

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Depreciation History</h1>
        <button onClick={() => setShowRunModal(true)} disabled={runMutation.isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-amber-600 rounded-xl hover:bg-amber-700 disabled:opacity-50 transition-all duration-200">
          <Play className="w-4 h-4" /> {runMutation.isPending ? 'Running...' : 'Run Depreciation'}
        </button>
      </div>

      {runMutation.isPending && (
        <div className="flex items-center gap-2 px-4 py-2 text-sm text-amber-700 bg-amber-50 rounded-2xl border border-amber-200/80">
          <Loader2 className="w-4 h-4 animate-spin" /> Processing depreciation...
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search by asset number, name, or journal entry..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300" />
        </div>
        <span className="text-xs text-slate-400 font-medium">{filtered.length} entry{filtered.length !== 1 ? 'ies' : 'y'}</span>
      </div>

      {isLoading ? (
        <PageLoader message="Loading depreciation history..." />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Asset #</th>
                <th className="px-4 py-3 text-left">Asset Name</th>
                <th className="px-4 py-3 text-left">Period</th>
                <th className="px-4 py-3 text-right">Amount (₦)</th>
                <th className="px-4 py-3 text-right">Accum. Depr.</th>
                <th className="px-4 py-3 text-right">Book Value</th>
                <th className="px-4 py-3 text-left">Journal Entry</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50 cursor-pointer"
                  onClick={() => navigate(`/accountant/journals`)}>
                  <td className="px-4 py-3 font-mono text-indigo-600 font-medium">{r.assetNumber}</td>
                  <td className="px-4 py-3 text-slate-800">{r.assetName}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(r.periodDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900">{fmtNaira(r.amount)}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600">{fmtNaira(r.accumulatedDepreciation)}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600">{fmtNaira(r.bookValue)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium">
                      {r.jeNumber} <ExternalLink className="w-3 h-3" />
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No depreciation entries found. Run depreciation to generate entries.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showRunModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowRunModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-200/80" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Run Depreciation</h2>
              <button onClick={() => setShowRunModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-slate-600">Select the period (month) for the depreciation run.</p>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Period Date</label>
              <input type="date" value={periodDate} onChange={e => setPeriodDate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 mt-1" />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowRunModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">Cancel</button>
              <button onClick={() => runMutation.mutate(periodDate)} disabled={runMutation.isPending || !periodDate}
                className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 rounded-xl hover:bg-amber-700 disabled:opacity-50">
                {runMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Run Depreciation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
