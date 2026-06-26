import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bankingApi } from '../../lib/api';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function CurrencyRatesPage() {
  const queryClient = useQueryClient();

  const { data: rates, isLoading, error } = useQuery({
    queryKey: ['currency-rates'],
    queryFn: () => bankingApi.getCurrencyRates(),
  });

  const refreshMutation = useMutation({
    mutationFn: () => bankingApi.refreshCurrencyRates(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['currency-rates'] }),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Currency Rates</h1>
        <button
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
          Refresh Rates
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : error ? (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-xl text-sm"><AlertCircle className="w-4 h-4" /> Failed to load currency rates.</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Base Currency</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Quote Currency</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Rate</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Source</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Effective Date</th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(rates) ? rates : []).map((rate: any) => (
                <tr key={rate.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{rate.baseCurrency}</td>
                  <td className="px-4 py-3 text-slate-800">{rate.quoteCurrency}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">{Number(rate.rate).toFixed(6)}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{rate.source || 'Manual'}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{fmtDate(rate.effectiveDate)}</td>
                </tr>
              ))}
              {(!rates || rates.length === 0) && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No currency rates available. Click "Refresh Rates" to fetch latest.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
