import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Search, X, ArrowRightLeft, ArrowRight, CheckCircle2, Clock, AlertTriangle, Trash2, Eye, SlidersHorizontal, Layers, BarChart3, FileText } from 'lucide-react';
import { api } from '../../lib/api';
import { CurrencySelector } from '../../components/ui/CurrencySelector';
import toast from 'react-hot-toast';

function fmtNaira(v: number): string {
  return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const TXN_TYPE_LABELS: Record<string, string> = {
  loan: 'Loan',
  goods: 'Goods',
  service: 'Service',
  royalty: 'Royalty',
  dividend: 'Dividend',
  management_fee: 'Mgmt Fee',
  other: 'Other',
};

const TXN_TYPE_COLORS: Record<string, string> = {
  loan: 'bg-blue-100 text-blue-700',
  goods: 'bg-emerald-100 text-emerald-700',
  service: 'bg-purple-100 text-purple-700',
  royalty: 'bg-amber-100 text-amber-700',
  dividend: 'bg-green-100 text-green-700',
  management_fee: 'bg-pink-100 text-pink-700',
  other: 'bg-slate-100 text-slate-600',
};

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700' },
  matched: { label: 'Matched', className: 'bg-blue-100 text-blue-700' },
  settled: { label: 'Settled', className: 'bg-emerald-100 text-emerald-700' },
  disputed: { label: 'Disputed', className: 'bg-red-100 text-red-700' },
};

interface Group {
  id: string;
  name: string;
}

interface IcTxn {
  id: string;
  fromOrgId: string;
  toOrgId: string;
  type: string;
  amount: number;
  currency: string;
  fxRate: string | null;
  reference: string;
  description: string | null;
  notes: string | null;
  date: string;
  status: string;
  fromJournalEntryId: string | null;
  toJournalEntryId: string | null;
  fromOrgName?: string;
  toOrgName?: string;
}

interface IcSummary {
  fromOrgName: string;
  toOrgName: string;
  outstandingAmount: number;
  txnCount: number;
}

export function IntercompanyTransactionsPage() {
  const queryClient = useQueryClient();
  const [groupId, setGroupId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'summary'>('list');

  const { data: groups } = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: async () => { const r = await api.get('/groups'); return r.data; },
  });

  const { data: txns, isLoading, refetch } = useQuery<IcTxn[]>({
    queryKey: ['intercompany', groupId],
    queryFn: async () => { const r = await api.get(`/intercompany/group/${groupId}`); return r.data; },
    enabled: !!groupId,
  });

  const { data: summary } = useQuery<IcSummary[]>({
    queryKey: ['intercompany-summary', groupId],
    queryFn: async () => { const r = await api.get(`/intercompany/group/${groupId}/summary`); return r.data; },
    enabled: !!groupId && view === 'summary',
  });

  const { data: detail } = useQuery<IcTxn>({
    queryKey: ['intercompany-txn', showDetail],
    queryFn: async () => { const r = await api.get(`/intercompany/${showDetail}`); return r.data; },
    enabled: !!showDetail,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => { const r = await api.post('/intercompany', data); return r.data; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['intercompany', groupId] }); toast.success('Transaction created'); setShowCreate(false); },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to create transaction'),
  });

  const settleMutation = useMutation({
    mutationFn: async (id: string) => { const r = await api.post(`/intercompany/${id}/settle`); return r.data; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['intercompany', groupId] }); toast.success('Transaction settled'); setShowDetail(null); },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to settle transaction'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const r = await api.delete(`/intercompany/${id}`); return r.data; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['intercompany', groupId] }); toast.success('Transaction deleted'); setShowDetail(null); },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to delete transaction'),
  });

  const matchMutation = useMutation({
    mutationFn: async () => { const r = await api.post(`/intercompany/group/${groupId}/match`); return r.data; },
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ['intercompany', groupId] }); toast.success(`Auto-match complete: ${data.matchedCount || 0} matched`); },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Auto-match failed'),
  });

  const filtered = (txns || []).filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (t.reference || '').toLowerCase().includes(q) ||
           (t.description || '').toLowerCase().includes(q) ||
           (t.fromOrgName || '').toLowerCase().includes(q) ||
           (t.toOrgName || '').toLowerCase().includes(q);
  });

  const totalVolume = (txns || []).reduce((s, t) => s + Number(t.amount), 0);
  const outstanding = (txns || []).filter((t) => t.status === 'pending' || t.status === 'matched').reduce((s, t) => s + Number(t.amount), 0);
  const settledCount = (txns || []).filter((t) => t.status === 'settled').length;

  const selectedGroup = (groups || []).find((g) => g.id === groupId);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">


      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transactions..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 bg-white"
          />
        </div>
        <select
          value={groupId} onChange={(e) => { setGroupId(e.target.value); setShowDetail(null); }}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 bg-white min-w-[200px]"
        >
          <option value="">Select group...</option>
          {(groups || []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <div className="flex items-center bg-slate-100 rounded-xl p-0.5">
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${view === 'list' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Layers className="w-3.5 h-3.5 inline mr-1" /> List
          </button>
          <button
            onClick={() => setView('summary')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${view === 'summary' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <BarChart3 className="w-3.5 h-3.5 inline mr-1" /> Summary
          </button>
        </div>
        <div className="flex-1" />
        {groupId && (
          <>
            <button
              onClick={() => matchMutation.mutate()}
              disabled={matchMutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors disabled:opacity-50"
            >
              {matchMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <SlidersHorizontal className="w-4 h-4" />}
              Auto-Match
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-all"
            >
              <Plus className="w-4 h-4" /> Create
            </button>
          </>
        )}
      </div>

      {groupId && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-[11px] font-semibold text-slate-400 uppercase">Total IC Volume</p>
            <p className="text-xl font-bold text-slate-800 mt-1">{fmtNaira(totalVolume)}</p>
            <p className="text-xs text-slate-400 mt-0.5">Period total</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-[11px] font-semibold text-slate-400 uppercase">Outstanding</p>
            <p className="text-xl font-bold text-amber-700 mt-1">{fmtNaira(outstanding)}</p>
            <p className="text-xs text-slate-400 mt-0.5">Pending + Matched</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-[11px] font-semibold text-slate-400 uppercase">Settled</p>
            <p className="text-xl font-bold text-emerald-700 mt-1">{settledCount}</p>
            <p className="text-xs text-slate-400 mt-0.5">Completed transactions</p>
          </div>
        </div>
      )}

      {view === 'list' && (
        <>
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2" />Loading...</div>
          ) : !groupId ? (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
              <ArrowRightLeft className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-500">Select a Group</h3>
              <p className="text-xs text-slate-400 mt-1">Choose a group above to view intercompany transactions.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
              <ArrowRightLeft className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-500">No Transactions</h3>
              <p className="text-xs text-slate-400 mt-1">Create the first intercompany transaction for this group.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide bg-slate-50/50">
                    <th className="text-left py-3 px-4 font-semibold">Date</th>
                    <th className="text-left py-3 px-4 font-semibold">Reference</th>
                    <th className="text-left py-3 px-4 font-semibold">From</th>
                    <th className="text-left py-3 px-4 font-semibold">To</th>
                    <th className="text-center py-3 px-4 font-semibold">Type</th>
                    <th className="text-right py-3 px-4 font-semibold">Amount</th>
                    <th className="text-center py-3 px-4 font-semibold">Status</th>
                    <th className="text-right py-3 px-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => {
                    const statusBadge = STATUS_BADGES[t.status] || { label: t.status, className: 'bg-slate-100 text-slate-600' };
                    const typeColor = TXN_TYPE_COLORS[t.type] || 'bg-slate-100 text-slate-600';
                    return (
                      <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{fmtDate(t.date)}</td>
                        <td className="py-3 px-4 font-medium text-slate-800">{t.reference || '—'}</td>
                        <td className="py-3 px-4 text-slate-600">{t.fromOrgName || t.fromOrgId?.slice(0, 8)}</td>
                        <td className="py-3 px-4 text-slate-600">{t.toOrgName || t.toOrgId?.slice(0, 8)}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeColor}`}>{TXN_TYPE_LABELS[t.type] || t.type}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-slate-800">{fmtNaira(t.amount)}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBadge.className}`}>{statusBadge.label}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setShowDetail(showDetail === t.id ? null : t.id)}
                            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                            title="View detail"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {showDetail && detail && (
            <div className="mt-4 bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Transaction Detail</h3>
                <button onClick={() => setShowDetail(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div><span className="text-xs text-slate-400 block">Reference</span><span className="font-semibold text-slate-800">{detail.reference || '—'}</span></div>
                <div><span className="text-xs text-slate-400 block">Date</span><span className="font-semibold text-slate-800">{fmtDate(detail.date)}</span></div>
                <div><span className="text-xs text-slate-400 block">Type</span><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TXN_TYPE_COLORS[detail.type] || 'bg-slate-100 text-slate-600'}`}>{TXN_TYPE_LABELS[detail.type] || detail.type}</span></div>
                <div><span className="text-xs text-slate-400 block">From Org</span><span className="font-semibold text-slate-800">{detail.fromOrgName || detail.fromOrgId}</span></div>
                <div><span className="text-xs text-slate-400 block">To Org</span><span className="font-semibold text-slate-800">{detail.toOrgName || detail.toOrgId}</span></div>
                <div><span className="text-xs text-slate-400 block">Amount</span><span className="font-semibold text-slate-800">{fmtNaira(detail.amount)}</span></div>
                <div><span className="text-xs text-slate-400 block">Currency</span><span className="font-semibold text-slate-800">{detail.currency || 'NGN'}</span></div>
                <div><span className="text-xs text-slate-400 block">FX Rate</span><span className="font-semibold text-slate-800">{detail.fxRate || '1.0000'}</span></div>
                <div><span className="text-xs text-slate-400 block">Status</span><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${(STATUS_BADGES[detail.status] || {}).className || 'bg-slate-100 text-slate-600'}`}>{(STATUS_BADGES[detail.status] || {}).label || detail.status}</span></div>
              </div>
              {detail.description && <div><span className="text-xs text-slate-400 block">Description</span><p className="text-sm text-slate-700 mt-0.5">{detail.description}</p></div>}
              {detail.notes && <div><span className="text-xs text-slate-400 block">Notes</span><p className="text-sm text-slate-700 mt-0.5">{detail.notes}</p></div>}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                {(detail.status === 'pending' || detail.status === 'matched') && (
                  <button
                    onClick={() => { if (confirm('Settle this transaction?')) settleMutation.mutate(detail.id); }}
                    disabled={settleMutation.isPending}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Settle
                  </button>
                )}
                {detail.status === 'pending' && (
                  <button
                    onClick={() => { if (confirm('Delete this transaction?')) deleteMutation.mutate(detail.id); }}
                    disabled={deleteMutation.isPending}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                )}
                {detail.fromJournalEntryId && (
                  <span className="text-xs text-slate-400 flex items-center gap-1"><FileText className="w-3 h-3" /> From JE: {detail.fromJournalEntryId.slice(0, 8)}…</span>
                )}
                {detail.toJournalEntryId && (
                  <span className="text-xs text-slate-400 flex items-center gap-1"><FileText className="w-3 h-3" /> To JE: {detail.toJournalEntryId.slice(0, 8)}…</span>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {view === 'summary' && groupId && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {(!summary || summary.length === 0) ? (
            <div className="text-center py-16">
              <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-500">No Summary Data</h3>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide bg-slate-50/50">
                  <th className="text-left py-3 px-4 font-semibold">From Org</th>
                  <th className="text-left py-3 px-4 font-semibold">To Org</th>
                  <th className="text-right py-3 px-4 font-semibold">Outstanding</th>
                  <th className="text-right py-3 px-4 font-semibold">Transactions</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-medium text-slate-800">{s.fromOrgName}</td>
                    <td className="py-3 px-4 text-slate-600">{s.toOrgName}</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-800">{fmtNaira(s.outstandingAmount)}</td>
                    <td className="py-3 px-4 text-right text-slate-600">{s.txnCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Create Transaction Modal */}
      {showCreate && groupId && (
        <CreateIcTxnModal
          groupId={groupId}
          onClose={() => setShowCreate(false)}
          onCreate={(data) => createMutation.mutate(data)}
        />
      )}
    </div>
  );
}

function CreateIcTxnModal({ groupId, onClose, onCreate }: { groupId: string; onClose: () => void; onCreate: (data: any) => void }) {
  const [form, setForm] = useState({
    fromOrgId: '',
    toOrgId: '',
    type: 'loan',
    amount: '',
    currency: 'NGN',
    fxRate: '1.00000000',
    date: new Date().toISOString().split('T')[0],
    reference: '',
    description: '',
    notes: '',
  });

  const { data: members } = useQuery<any[]>({
    queryKey: ['group-members', groupId],
    queryFn: async () => { const r = await api.get(`/groups/${groupId}/members`); return r.data; },
  });

  const f = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = () => {
    if (!form.fromOrgId || !form.toOrgId) { toast.error('Select from and to organisations'); return; }
    if (form.fromOrgId === form.toOrgId) { toast.error('From and To organisations must be different'); return; }
    if (!form.amount || Number(form.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    onCreate({
      fromOrgId: form.fromOrgId,
      toOrgId: form.toOrgId,
      type: form.type,
      amount: Math.round(Number(form.amount) * 100),
      currency: form.currency,
      fxRate: form.fxRate,
      date: form.date,
      reference: form.reference || undefined,
      description: form.description || undefined,
      notes: form.notes || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900">Create Intercompany Transaction</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">From Organisation</label>
              <select value={form.fromOrgId} onChange={f('fromOrgId')} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white">
                <option value="">Select...</option>
                {(members || []).map((m: any) => <option key={m.orgId} value={m.orgId}>{m.orgName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">To Organisation</label>
              <select value={form.toOrgId} onChange={f('toOrgId')} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white">
                <option value="">Select...</option>
                {(members || []).map((m: any) => <option key={m.orgId} value={m.orgId}>{m.orgName}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Type</label>
              <select value={form.type} onChange={f('type')} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white">
                <option value="loan">Loan</option>
                <option value="goods">Goods</option>
                <option value="service">Service</option>
                <option value="royalty">Royalty</option>
                <option value="dividend">Dividend</option>
                <option value="management_fee">Management Fee</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Amount (NGN)</label>
              <input type="number" value={form.amount} onChange={f('amount')} placeholder="0.00" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
            </div>
          </div>
          <CurrencySelector
            currency={form.currency}
            onCurrencyChange={(c) => setForm((p) => ({ ...p, currency: c }))}
            fxRate={form.fxRate}
            onFxRateChange={(r) => setForm((p) => ({ ...p, fxRate: r || '1.00000000' }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Date</label>
              <input type="date" value={form.date} onChange={f('date')} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Reference</label>
              <input value={form.reference} onChange={f('reference')} placeholder="e.g. IC-001" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Description</label>
            <textarea value={form.description} onChange={f('description')} rows={2} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={f('notes')} rows={2} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">Cancel</button>
          <button onClick={handleSubmit} className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-all">Create Transaction</button>
        </div>
      </div>
    </div>
  );
}
