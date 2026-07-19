import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bankingApi } from '../../lib/api';
import {
  Loader2, AlertCircle, RefreshCw, ArrowLeft, Search,
  TrendingUp, Globe, Clock, Database, X
} from 'lucide-react';

const FLAGS: Record<string, string> = {
  NGN: '\uD83C\uDDF3\uD83C\uDDEC', USD: '\uD83C\uDDFA\uD83C\uDDF8', GBP: '\uD83C\uDDEC\uD83C\uDDE7',
  EUR: '\uD83C\uDDEA\uD83C\uDDFA', GHS: '\uD83C\uDDEC\uD83C\uDDED', ZAR: '\uD83C\uDDFF\uD83C\uDDE6',
  KES: '\uD83C\uDDF0\uD83C\uDDEA', UGX: '\uD83C\uDDFA\uD83C\uDDEC', TZS: '\uD83C\uDDF9\uD83C\uDDFF',
  RWF: '\uD83C\uDDF7\uD83C\uDDEC', XAF: '\uD83C\uDDE8\uD83C\uDDEB', XOF: '\uD83C\uDDE8\uD83C\uDDEB',
  ZMW: '\uD83C\uDDFF\uD83C\uDDF2', MZN: '\uD83C\uDDF2\uD83C\uDDFF', BWP: '\uD83C\uDDE6\uD83C\uDDFC',
  AOA: '\uD83C\uDDE6\uD83C\uDDF4', EGP: '\uD83C\uDDEA\uD83C\uDDEC', MAD: '\uD83C\uDDF2\uD83C\uDDE6',
};

const CURRENCY_NAMES: Record<string, string> = {
  NGN: 'Nigerian Naira', USD: 'US Dollar', GBP: 'British Pound', EUR: 'Euro',
  GHS: 'Ghanaian Cedi', ZAR: 'South African Rand', KES: 'Kenyan Shilling',
  UGX: 'Ugandan Shilling', TZS: 'Tanzanian Shilling', RWF: 'Rwandan Franc',
  XAF: 'CFA Franc BEAC', XOF: 'CFA Franc BCEAO', ZMW: 'Zambian Kwacha',
  MZN: 'Mozambican Metical', BWP: 'Botswana Pula', AOA: 'Angolan Kwanza',
  EGP: 'Egyptian Pound', MAD: 'Moroccan Dirham',
};

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtShortDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function CurrencyRatesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: rates, isLoading, error } = useQuery({
    queryKey: ['currency-rates'],
    queryFn: () => bankingApi.getCurrencyRates(),
    refetchInterval: 5 * 60 * 1000,
  });

  const refreshMutation = useMutation({
    mutationFn: () => bankingApi.refreshCurrencyRates(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['currency-rates'] }),
  });

  const list: any[] = useMemo(() => {
    const arr = Array.isArray(rates) ? rates : [];
    if (!search) return arr;
    const q = search.toLowerCase();
    return arr.filter(r =>
      r.baseCurrency.toLowerCase().includes(q) ||
      r.quoteCurrency.toLowerCase().includes(q) ||
      (r.source || '').toLowerCase().includes(q) ||
      (CURRENCY_NAMES[r.quoteCurrency] || '').toLowerCase().includes(q)
    );
  }, [rates, search]);

  const lastUpdated = useMemo(() => {
    const arr = Array.isArray(rates) ? rates : [];
    if (arr.length === 0) return null;
    return arr.reduce((latest: string, r: any) =>
      r.effectiveDate > latest ? r.effectiveDate : latest, arr[0].effectiveDate
    );
  }, [rates]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/app/banking')}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all duration-200 cursor-pointer">
            <ArrowLeft className="w-4 h-4" />
          </button>

        </div>
        <button onClick={() => refreshMutation.mutate()} disabled={refreshMutation.isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 transition-all duration-200">
          <RefreshCw className={`w-4 h-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
          {refreshMutation.isPending ? 'Refreshing...' : 'Refresh Rates'}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Currencies</p>
            <p className="text-xl font-bold text-slate-900">{Array.isArray(rates) ? rates.length : 0}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Base Currency</p>
            <p className="text-xl font-bold text-slate-900">NGN</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Last Updated</p>
            <p className="text-sm font-bold text-slate-900">{lastUpdated ? fmtShortDate(lastUpdated) : '—'}</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search currency..."
          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow pl-9 pr-8 bg-white text-slate-800 placeholder-slate-400" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-all duration-200"><X className="w-4 h-4" /></button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 bg-gradient-to-r from-slate-200 to-slate-100 animate-pulse rounded-xl gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm text-slate-400 font-medium">Loading currency rates...</p>
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 p-5 bg-red-50 border border-red-100/80 rounded-2xl text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Failed to load currency rates</p>
            <p className="text-xs mt-0.5 text-red-500">Check your connection and try again.</p>
          </div>
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200/80 shadow-sm gap-4">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
            <Database className="w-8 h-8 text-slate-300" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-600">{search ? 'No matching rates' : 'No currency rates yet'}</p>
            <p className="text-xs text-slate-400 mt-1">
              {search ? 'Try a different search term.' : 'Click "Refresh Rates" to fetch the latest exchange rates.'}
            </p>
          </div>
          {!search && (
            <button onClick={() => refreshMutation.mutate()} disabled={refreshMutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 transition-all duration-200">
              <RefreshCw className="w-4 h-4" /> Fetch Rates
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-200/80">
                <th className="px-3 py-3 text-left">Currency</th>
                <th className="px-3 py-3 text-left">Name</th>
                <th className="px-3 py-3 text-right">Rate (NGN)</th>
                <th className="px-3 py-3 text-center">Source</th>
                <th className="px-3 py-3 text-right">Effective Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((rate: any) => (
                <tr key={rate.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg leading-none" title={rate.quoteCurrency}>{FLAGS[rate.quoteCurrency] || '\uD83C\uDFF4'}</span>
                      <span className="font-semibold text-slate-800">{rate.quoteCurrency}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-500 text-xs">{CURRENCY_NAMES[rate.quoteCurrency] || rate.quoteCurrency}</td>
                  <td className="px-3 py-3 text-right">
                    <span className="font-mono font-bold text-slate-900 text-sm tabular-nums">{Number(rate.rate).toFixed(6)}</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-slate-200/50 bg-slate-100 text-slate-600">
                      {rate.source === 'ExchangeRate-API' ? (
                        <><Globe className="w-3 h-3" /> API</>
                      ) : (
                        <><Database className="w-3 h-3" /> {rate.source || 'Manual'}</>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-xs text-slate-400 tabular-nums">{fmtDate(rate.effectiveDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer note */}
      <p className="text-[10px] text-slate-400 text-center">
        Rates are provided for reference only. Actual transaction rates may vary.
      </p>
    </div>
  );
}
