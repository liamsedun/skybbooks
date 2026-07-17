import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Search, ExternalLink, DollarSign, TrendingUp, Activity, Loader2, Wallet, ArrowRightLeft, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { bankingApi } from '../../lib/api';

interface GatewayTransaction {
  id: string;
  provider: string;
  gatewayTransactionId: string;
  reference: string;
  amount: number;
  fee: number;
  currency: string;
  status: string;
  customerEmail: string | null;
  customerName: string | null;
  customerPhone: string | null;
  description: string | null;
  paymentMethod: string | null;
  channel: string | null;
  settledAt: string | null;
  createdAt: string;
  bankAccountId: string | null;
  matchedTransactionId: string | null;
  bankAccountName: string | null;
}

interface GatewaySummary {
  totalVolume: number;
  totalFees: number;
  transactionCount: number;
  successCount: number;
}

const PROVIDER_LABELS: Record<string, string> = { paystack: 'Paystack', flutterwave: 'Flutterwave', moniepoint: 'Moniepoint' };
const PROVIDER_COLORS: Record<string, string> = {
  paystack: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  flutterwave: 'bg-blue-50 text-blue-700 border-blue-200',
  moniepoint: 'bg-amber-50 text-amber-700 border-amber-200',
};

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-700' },
  success: { label: 'Success', className: 'bg-emerald-100 text-emerald-700' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-700' },
  settled: { label: 'Settled', className: 'bg-blue-100 text-blue-700' },
  partial_refund: { label: 'Partial Refund', className: 'bg-orange-100 text-orange-700' },
  full_refund: { label: 'Full Refund', className: 'bg-purple-100 text-purple-700' },
};

function fmtNaira(kobo: number) {
  return `₦${(kobo / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PaymentGatewayPage() {
  const [transactions, setTransactions] = useState<GatewayTransaction[]>([]);
  const [summary, setSummary] = useState<GatewaySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [filter, setFilter] = useState({ provider: '', status: '', search: '' });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 25;

  const fetchData = useCallback(async () => {
    try {
      const [txnResult, summaryResult] = await Promise.all([
        bankingApi.getGatewayTransactions({ provider: filter.provider || undefined, status: filter.status || undefined, page, limit }),
        bankingApi.getGatewaySummary(),
      ]);
      setTransactions(txnResult.data || []);
      setTotal(txnResult.total || 0);
      setSummary(summaryResult);
    } catch (err) {
      console.error('Failed to fetch gateway transactions', err);
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSync = async (provider: string) => {
    setSyncing(provider);
    try {
      await bankingApi.syncGatewayTransactions(provider);
      await fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.error || err.message || 'Sync failed');
    } finally {
      setSyncing(null);
    }
  };

  const handleAutoMatch = async () => {
    try {
      const result = await bankingApi.autoMatchGateway();
      alert(`Auto-matched ${result.count} transactions`);
      await fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.error || err.message || 'Auto-match failed');
    }
  };

  const filtered = transactions.filter(t => {
    if (filter.search) {
      const q = filter.search.toLowerCase();
      return (t.reference?.toLowerCase().includes(q) ||
        t.customerEmail?.toLowerCase().includes(q) ||
        t.customerName?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q));
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">

        <div className="flex items-center gap-2">
          <button onClick={handleAutoMatch} className="px-3 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1.5">
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Auto-Match
          </button>
          <button onClick={fetchData} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Total Volume</span>
            </div>
            <div className="text-lg font-bold text-slate-900">{fmtNaira(summary.totalVolume)}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Total Fees</span>
            </div>
            <div className="text-lg font-bold text-slate-900">{fmtNaira(summary.totalFees)}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Activity className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Transactions</span>
            </div>
            <div className="text-lg font-bold text-slate-900">{summary.transactionCount.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <CheckCircle className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Success Rate</span>
            </div>
            <div className="text-lg font-bold text-slate-900">
              {summary.transactionCount > 0
                ? `${Math.round((summary.successCount / summary.transactionCount) * 100)}%`
                : 'N/A'}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search reference, email, name..."
              value={filter.search}
              onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
          <select
            value={filter.provider}
            onChange={e => setFilter(f => ({ ...f, provider: e.target.value }))}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="">All Providers</option>
            <option value="paystack">Paystack</option>
            <option value="flutterwave">Flutterwave</option>
            <option value="moniepoint">Moniepoint</option>
          </select>
          <select
            value={filter.status}
            onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="">All Status</option>
            <option value="success">Success</option>
            <option value="settled">Settled</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="partial_refund">Partial Refund</option>
            <option value="full_refund">Full Refund</option>
          </select>
          {['paystack', 'flutterwave', 'moniepoint'].map(p => (
            <button
              key={p}
              onClick={() => handleSync(p)}
              disabled={syncing === p}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {syncing === p ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Sync {PROVIDER_LABELS[p] || p}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-3 font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Provider</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Reference</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Customer</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Amount</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Fee</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Status</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Channel</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400 text-sm">No transactions found</td>
                </tr>
              ) : (
                filtered.map(tx => {
                  const badge = STATUS_BADGES[tx.status] || { label: tx.status, className: 'bg-slate-100 text-slate-600' };
                  return (
                    <tr key={tx.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${PROVIDER_COLORS[tx.provider] || 'bg-slate-100 text-slate-600'}`}>
                          {PROVIDER_LABELS[tx.provider] || tx.provider}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-700 max-w-[140px] truncate">{tx.reference}</td>
                      <td className="px-4 py-3">
                        <div className="text-slate-700 text-xs">{tx.customerName || tx.customerEmail || '-'}</div>
                        {tx.customerEmail && tx.customerName && <div className="text-[10px] text-slate-400">{tx.customerEmail}</div>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmtNaira(tx.amount)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{fmtNaira(tx.fee)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-[11px] text-slate-500">{tx.channel || tx.paymentMethod || '-'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {total > limit && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">{total} total transactions</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-xs font-semibold bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-xs text-slate-500">Page {page} of {Math.ceil(total / limit)}</span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= Math.ceil(total / limit)}
                className="px-3 py-1 text-xs font-semibold bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
