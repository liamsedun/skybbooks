import React, { useState } from 'react';
import { Shield, ShieldAlert, AlertTriangle, Info, RefreshCw, Search, Loader2, Download } from 'lucide-react';
import { exportToCsv } from '../../lib/csvTemplates';

interface ThreatAlert {
  id: string;
  threat: 'low' | 'medium' | 'high';
  date: string;
  title: string;
  description: string;
  amount: number;
  category: string;
}

const ALERTS: ThreatAlert[] = [
  {
    id: 'ta-01',
    threat: 'low',
    date: '2026-01-06',
    title: 'PHCN Electricity payment round sum',
    description: 'Round-sum electricity payment of 5,000,000 Kobo which is typical of estimated billing or arbitrary round figures rather than exact meter readings.',
    amount: 5_000_000_00,
    category: 'Rounding',
  },
  {
    id: 'ta-02',
    threat: 'medium',
    date: '2026-03-06',
    title: 'Duplicated Staff Bonus payout',
    description: 'Identical duplicate transaction entry found for Staff Bonus payout with transaction ID tx-03 on the same date (2026-06-03) for 12,000,000 Kobo.',
    amount: 12_000_000_00,
    category: 'Duplicate',
  },
  {
    id: 'ta-03',
    threat: 'medium',
    date: '2026-03-06',
    title: 'Duplicated Staff Bonus payout',
    description: 'Identical duplicate transaction entry found for Staff Bonus payout with transaction ID tx-02 on the same date (2026-06-03) for 12,000,000 Kobo.',
    amount: 12_000_000_00,
    category: 'Duplicate',
  },
  {
    id: 'ta-04',
    threat: 'medium',
    date: '2026-05-06',
    title: 'Unknown Retail vendor payment offshore',
    description: 'Payment sent offshore to an unknown retail vendor, posing compliance and currency expatriation risks.',
    amount: 4_850_00,
    category: 'Offshore',
  },
  {
    id: 'ta-05',
    threat: 'high',
    date: '2026-08-06',
    title: 'Cash withdrawal round number alert',
    description: 'Extremely large cash withdrawal round number alert of 100,000,000 Kobo, which is highly unusual and poses security and regulatory compliance risks.',
    amount: 100_000_000_00,
    category: 'Rounding',
  },
];

const THREAT_META = {
  low: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700' },
  medium: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' },
  high: { icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700' },
};

function fmtNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function CustomReportsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [threatFilter, setThreatFilter] = useState<string>('all');
  const [resetting, setResetting] = useState(false);

  const filtered = ALERTS.filter(a => {
    if (threatFilter !== 'all' && a.threat !== threatFilter) return false;
    if (!searchTerm) return true;
    const t = searchTerm.toLowerCase();
    return a.title.toLowerCase().includes(t) || a.description.toLowerCase().includes(t) || a.category.toLowerCase().includes(t);
  });

  const counts = { all: ALERTS.length, low: ALERTS.filter(a => a.threat === 'low').length, medium: ALERTS.filter(a => a.threat === 'medium').length, high: ALERTS.filter(a => a.threat === 'high').length };

  const handleReset = () => {
    setResetting(true);
    setTimeout(() => setResetting(false), 1000);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Shield className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Audit-Shield</h1>
            <p className="text-sm text-slate-500">AI-powered transaction monitoring & threat detection</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { const today = new Date().toISOString().split('T')[0]; const rows = filtered.map(a => [a.id, a.title, a.description, a.category, a.threat, fmtDate(a.date), fmtNaira(a.amount)]); exportToCsv(`audit_shield_${today}.csv`, ['ID', 'Title', 'Description', 'Category', 'Threat', 'Date', 'Amount'], rows); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"><Download className="w-4 h-4" /> CSV</button>
          <button onClick={handleReset} disabled={resetting} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
            <RefreshCw className={`w-4 h-4 ${resetting ? 'animate-spin' : ''}`} /> Rescan
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {(['all', 'high', 'medium', 'low'] as const).map(t => {
          const meta = t === 'all' ? { badge: 'bg-slate-100 text-slate-700' } : THREAT_META[t];
          return (
            <button key={t} onClick={() => setThreatFilter(t)}
              className={`text-left p-4 rounded-xl border transition-all ${
                threatFilter === t ? 'ring-2 ring-indigo-500 border-indigo-500 bg-white' : 'bg-white border-slate-200 hover:border-slate-300'
              }`}>
              <p className="text-2xl font-bold text-slate-900">{counts[t]}</p>
              <p className="text-xs font-semibold mt-0.5 capitalize"><span className={`inline-block px-2 py-0.5 rounded-full ${meta.badge}`}>{t === 'all' ? 'Total' : t}</span></p>
            </button>
          );
        })}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search alerts..." className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
      </div>

      <div className="space-y-3">
        {filtered.map(alert => {
          const meta = THREAT_META[alert.threat];
          const Icon = meta.icon;
          return (
            <div key={alert.id} className={`bg-white rounded-xl border ${meta.border} p-5 hover:shadow-md transition-shadow`}>
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl ${meta.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${meta.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{alert.title}</h3>
                      <p className="text-xs text-slate-500 mt-1">{alert.description}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full capitalize ${meta.badge}`}>{alert.threat} Threat</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                    <span>{fmtDate(alert.date)}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">{alert.category}</span>
                  </div>
                  <div className="mt-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase">Indexed sum:</span>
                    <p className="text-lg font-bold text-slate-900 font-mono">{fmtNaira(alert.amount)}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <Shield className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-medium">No threats match your filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
