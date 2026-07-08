import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { depreciationApi, accountantApi } from '../../lib/api';
import { PageLoader } from '../../components/ui/PageLoader';
import { X, Loader2, AlertCircle, CheckCircle2, Search, Eye, Edit3 } from 'lucide-react';

function fmtNaira(v: number): string {
  return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function DepreciationPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [viewTarget, setViewTarget] = useState<any | null>(null);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['depreciation-entries'],
    queryFn: depreciationApi.list,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => depreciationApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['depreciation-entries'] });
      setEditTarget(null);
      setSuccess('Depreciation entry updated successfully.');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => setFormError(err?.response?.data?.error || err?.message || 'Failed to update.'),
  });

  const filteredEntries = useMemo(() => {
    const list = Array.isArray(entries) ? entries : [];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((e: any) =>
      (e.entryNumber || '').toLowerCase().includes(q) ||
      (e.description || '').toLowerCase().includes(q) ||
      e.lines?.some((l: any) =>
        (l.accountCode || '').toLowerCase().includes(q) ||
        (l.accountName || '').toLowerCase().includes(q) ||
        (l.description || '').toLowerCase().includes(q)
      )
    );
  }, [entries, search]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Depreciation</h1>
      </div>

      {success && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm border border-emerald-200/80">
          <CheckCircle2 className="w-4 h-4" /> {success}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search by entry number, description, account..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
        </div>
        <span className="text-xs text-slate-400 font-medium whitespace-nowrap">{filteredEntries.length} entry{filteredEntries.length !== 1 ? 'ies' : 'y'}</span>
      </div>

      {viewTarget && <DepreciationDetailView entry={viewTarget} onClose={() => setViewTarget(null)} />}

      {editTarget && (
        <DepreciationEditForm
          entry={editTarget}
          error={formError}
          isPending={updateMutation.isPending}
          onSave={(data) => updateMutation.mutate({ id: editTarget.journalEntryId, data })}
          onClose={() => { setEditTarget(null); setFormError(null); }}
        />
      )}

      {isLoading ? (
        <PageLoader message="Loading depreciation entries..." />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-3 text-left">Entry #</th>
                <th className="px-3 py-3 text-left">Date</th>
                <th className="px-3 py-3 text-left">Source</th>
                <th className="px-3 py-3 text-left">Reference</th>
                <th className="px-3 py-3 text-left">Created</th>
                <th className="px-3 py-3 text-right">Debit (₦)</th>
                <th className="px-3 py-3 text-right">Credit (₦)</th>
                <th className="px-3 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((e: any) => (
                <tr key={e.journalEntryId} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50">
                  <td className="px-4 py-3 font-mono text-indigo-600 font-medium">{e.entryNumber}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(e.date)}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 text-[10px] font-bold rounded-full uppercase bg-slate-100 text-slate-600">manual</span></td>
                  <td className="px-4 py-3 text-slate-500">{e.reference || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(e.createdAt)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-slate-900">{fmtNaira(e.totalDebit)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-slate-900">{fmtNaira(e.totalCredit)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => setViewTarget(e)} className="text-indigo-600 hover:text-indigo-800 p-1" title="View details"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => { setEditTarget(e); setFormError(null); }} className="text-blue-600 hover:text-blue-800 p-1" title="Edit"><Edit3 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredEntries.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No depreciation entries found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DepreciationDetailView({ entry, onClose }: { entry: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-6 space-y-4 border border-slate-200/80 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-slate-900">{entry.entryNumber}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div><span className="text-slate-500 font-medium">Date</span><p className="text-slate-900 font-medium">{fmtDate(entry.date)}</p></div>
          <div><span className="text-slate-500 font-medium">Source</span><p className="text-slate-900 capitalize">manual</p></div>
          <div><span className="text-slate-500 font-medium">Reference</span><p className="text-slate-500">{entry.reference || '—'}</p></div>
          <div><span className="text-slate-500 font-medium">Created</span><p className="text-slate-900">{fmtDate(entry.createdAt)}</p></div>
        </div>
        {entry.description && <p className="text-sm text-slate-600 bg-slate-50 rounded-xl px-4 py-2">{entry.description}</p>}
        <div className="overflow-y-auto flex-1 border border-slate-200 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 text-left">Account Code</th>
                <th className="px-3 py-2 text-left">Account Name</th>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-right">Debit (₦)</th>
                <th className="px-3 py-2 text-right">Credit (₦)</th>
              </tr>
            </thead>
            <tbody>
              {entry.lines?.map((l: any, i: number) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-3 py-2 font-mono text-slate-600">{l.accountCode}</td>
                  <td className="px-3 py-2 text-slate-800">{l.accountName}</td>
                  <td className="px-3 py-2 text-slate-500">{l.description || '—'}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-900">{l.debit > 0 ? fmtNaira(l.debit) : '—'}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-900">{l.credit > 0 ? fmtNaira(l.credit) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 text-xs font-bold text-slate-700">
              <tr>
                <td colSpan={3} className="px-3 py-2 text-right uppercase">Total</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtNaira(entry.totalDebit)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtNaira(entry.totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function DepreciationEditForm({ entry, error, isPending, onSave, onClose }: {
  entry: any;
  error: string | null;
  isPending: boolean;
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const [lines, setLines] = useState(entry.lines?.map((l: any) => ({
    id: l.id,
    accountId: l.accountId || '',
    accountCode: l.accountCode || '',
    accountName: l.accountName || '',
    description: l.description || '',
    debit: l.debit,
    credit: l.credit,
  })) || []);
  const [searchAccounts, setSearchAccounts] = useState<Record<string, { code: string; name: string; id: string }[]>>({});
  const [accountSearch, setAccountSearch] = useState<Record<number, string>>({});

  const { data: accountsList } = useQuery({
    queryKey: ['accountant', 'accounts'],
    queryFn: () => accountantApi.getAccounts(),
  });
  const allAccounts = useMemo(() => Array.isArray(accountsList) ? accountsList : [], [accountsList]);

  function updateLine(i: number, field: string, value: any) {
    setLines((prev: any[]) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  }

  function selectAccount(i: number, account: any) {
    updateLine(i, 'accountId', account.id);
    updateLine(i, 'accountCode', account.code);
    updateLine(i, 'accountName', account.name);
    setAccountSearch((p: any) => ({ ...p, [i]: `${account.code} - ${account.name}` }));
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      lines: lines.map((l: any) => ({
        id: l.id,
        accountId: l.accountId,
        debitAmount: l.debit,
        creditAmount: l.credit,
        description: l.description || undefined,
      })),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-6 space-y-4 border border-slate-200/80 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-slate-900">Edit Depreciation - {entry.entryNumber}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100/80">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col">
          <div className="overflow-y-auto flex-1 border border-slate-200 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-left">Account</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-right">Debit (₦)</th>
                  <th className="px-3 py-2 text-right">Credit (₦)</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l: any, i: number) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="px-3 py-2">
                      <div className="relative">
                        <input type="text" value={accountSearch[i] || `${l.accountCode} - ${l.accountName}`}
                          onChange={e => {
                            setAccountSearch((p: any) => ({ ...p, [i]: e.target.value }));
                            const q = e.target.value.toLowerCase();
                            const matches = allAccounts.filter((a: any) =>
                              (a.code || '').toLowerCase().includes(q) ||
                              (a.name || '').toLowerCase().includes(q)
                            ).slice(0, 10);
                            setSearchAccounts((p: any) => ({ ...p, [i]: matches }));
                          }}
                          placeholder="Search account..."
                          className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                        {searchAccounts[i]?.length > 0 && (
                          <div className="absolute z-10 top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-32 overflow-y-auto mt-1">
                            {searchAccounts[i].map((a: any) => (
                              <button key={a.id} type="button" onClick={() => selectAccount(i, a)}
                                className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 text-slate-700">{a.code} - {a.name}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" value={l.description} onChange={e => updateLine(i, 'description', e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" min="0" value={l.debit ? (l.debit / 100).toFixed(2) : ''}
                        onChange={e => { const val = e.target.value ? Math.round(parseFloat(e.target.value) * 100) : 0; updateLine(i, 'debit', val); if (val > 0) updateLine(i, 'credit', 0); }}
                        className="w-full px-2 py-1.5 text-xs text-right border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 font-mono" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" min="0" value={l.credit ? (l.credit / 100).toFixed(2) : ''}
                        onChange={e => { const val = e.target.value ? Math.round(parseFloat(e.target.value) * 100) : 0; updateLine(i, 'credit', val); if (val > 0) updateLine(i, 'debit', 0); }}
                        className="w-full px-2 py-1.5 text-xs text-right border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 font-mono" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-3 pt-2 shrink-0">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">Cancel</button>
            <button type="submit" disabled={isPending}
              className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}