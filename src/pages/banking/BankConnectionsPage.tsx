import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Link, Unlink, AlertCircle, CheckCircle, XCircle, Clock, ExternalLink, Loader2, Wifi, WifiOff } from 'lucide-react';
import { bankingApi } from '../../lib/api';

interface BankConnection {
  id: string;
  bankAccountId: string;
  provider: string;
  providerAccountId: string | null;
  providerAccountName: string | null;
  status: string;
  lastSyncedAt: string | null;
  errorMessage: string | null;
  meta: any;
  createdAt: string;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
}

interface ProviderStatus {
  availableProviders: { feed: string[]; gateway: string[] };
  connections: BankConnection[];
  gatewaySummary: { provider: string; total: number; pending: number; settled: number; failed: number }[];
}

const PROVIDER_NAMES: Record<string, string> = {
  mono: 'Mono Connect',
  paystack: 'Paystack',
  flutterwave: 'Flutterwave',
  moniepoint: 'Moniepoint',
};

const PROVIDER_COLORS: Record<string, string> = {
  mono: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  paystack: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  flutterwave: 'bg-blue-50 text-blue-700 border-blue-200',
  moniepoint: 'bg-amber-50 text-amber-700 border-amber-200',
};

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-emerald-100 text-emerald-700' },
  reauth_required: { label: 'Re-auth Required', className: 'bg-amber-100 text-amber-700' },
  expired: { label: 'Expired', className: 'bg-red-100 text-red-700' },
  disconnected: { label: 'Disconnected', className: 'bg-slate-100 text-slate-500' },
  pending: { label: 'Pending', className: 'bg-blue-100 text-blue-700' },
};

export function BankConnectionsPage() {
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await bankingApi.getProviderStatus();
      setStatus(data);
    } catch (err) {
      console.error('Failed to fetch provider status', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleSync = async (connectionId: string) => {
    setSyncing(connectionId);
    try {
      await bankingApi.syncConnection(connectionId);
      await fetchStatus();
    } catch (err: any) {
      alert(err?.response?.data?.error || err.message || 'Sync failed');
    } finally {
      setSyncing(null);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    if (!confirm('Disconnect this bank account? You can reconnect later.')) return;
    try {
      await bankingApi.deleteConnection(connectionId);
      await fetchStatus();
    } catch (err: any) {
      alert(err?.response?.data?.error || err.message || 'Failed to disconnect');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  const connectionsByProvider: Record<string, BankConnection[]> = {};
  for (const conn of status?.connections || []) {
    if (!connectionsByProvider[conn.provider]) connectionsByProvider[conn.provider] = [];
    connectionsByProvider[conn.provider].push(conn);
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">

        <button
          onClick={fetchStatus}
          className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {['mono', 'paystack', 'flutterwave', 'moniepoint'].map(provider => {
          const conns = connectionsByProvider[provider] || [];
          const activeConns = conns.filter(c => c.status === 'active').length;
          const gwSummary = status?.gatewaySummary?.find(g => g.provider === provider);
          const isFeed = status?.availableProviders.feed.includes(provider);
          const isGateway = status?.availableProviders.gateway.includes(provider);

          return (
            <div key={provider} className={`rounded-xl border p-4 ${PROVIDER_COLORS[provider] || 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="font-bold text-sm">{PROVIDER_NAMES[provider] || provider}</div>
                {isFeed ? <Wifi className="w-4 h-4 text-emerald-500" /> : isGateway ? <Wifi className="w-4 h-4 text-blue-500" /> : <WifiOff className="w-4 h-4 text-slate-400" />}
              </div>
              <div className="text-xs space-y-1">
                <span className="text-slate-500">{isFeed ? 'Bank Feed' : isGateway ? 'Payment Gateway' : 'Not Configured'}</span>
                {isFeed && <div className="font-semibold">{activeConns} / {conns.length} connections active</div>}
                {isGateway && gwSummary && (
                  <div className="space-y-0.5">
                    <div>Total: {gwSummary.total} txns</div>
                    <div className="flex gap-2">
                      <span className="text-emerald-600">{gwSummary.settled} settled</span>
                      <span className="text-amber-600">{gwSummary.pending} pending</span>
                      <span className="text-red-600">{gwSummary.failed} failed</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {status?.connections && status.connections.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Connected Accounts</h2>
          {status.connections.map(conn => {
            const badge = STATUS_BADGES[conn.status] || { label: conn.status, className: 'bg-slate-100 text-slate-600' };
            return (
              <div key={conn.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${conn.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    {conn.status === 'active' ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 text-sm truncate">
                        {conn.bankAccountName || conn.providerAccountName || conn.bankName || conn.provider}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${PROVIDER_COLORS[conn.provider] || 'bg-slate-100 text-slate-600'}`}>
                        {PROVIDER_NAMES[conn.provider] || conn.provider}
                      </span>
                      {conn.bankAccountNumber && <span>•{conn.bankAccountNumber.slice(-4)}</span>}
                      {conn.lastSyncedAt && <span>Synced {new Date(conn.lastSyncedAt).toLocaleDateString()}</span>}
                    </div>
                    {conn.errorMessage && (
                      <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                        <AlertCircle className="w-3 h-3" />
                        {conn.errorMessage}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleSync(conn.id)}
                    disabled={syncing === conn.id}
                    className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors disabled:opacity-50"
                    title="Sync now"
                  >
                    {syncing === conn.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleDisconnect(conn.id)}
                    className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
                    title="Disconnect"
                  >
                    <Unlink className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <Link className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-500">No Bank Connections</h3>
          <p className="text-xs text-slate-400 mt-1">Connect a bank account via Mono to start syncing transactions automatically</p>
        </div>
      )}
    </div>
  );
}
