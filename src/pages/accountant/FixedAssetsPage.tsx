import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fixedAssetsApi, accountantApi } from '../../lib/api';
import { AccountSearchSelect } from '../../components/ui/AccountSearchSelect';
import { Plus, X, Loader2, AlertCircle, CheckCircle2, Trash2, Eye } from 'lucide-react';

function fmtNaira(v: number): string {
  return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_LABELS: Record<string, string> = { active: 'Active', disposed: 'Disposed', fully_depreciated: 'Fully Depreciated' };
const STATUS_COLORS: Record<string, string> = { active: 'bg-emerald-100 text-emerald-700', disposed: 'bg-red-100 text-red-700', fully_depreciated: 'bg-slate-100 text-slate-600' };
const DEPR_LABELS: Record<string, string> = { straight_line: 'Straight Line', declining_balance: 'Declining Balance' };

export function FixedAssetsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);

  const { data: assets, isLoading } = useQuery({
    queryKey: ['fixed-assets'],
    queryFn: () => fixedAssetsApi.getAssets(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fixedAssetsApi.deleteAsset(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fixed-assets'] }),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Fixed Assets</h1>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"><Plus className="w-4 h-4" /> New Asset</button>
      </div>

      {showForm ? (
        <AssetForm onDone={() => { setShowForm(false); queryClient.invalidateQueries({ queryKey: ['fixed-assets'] }); }} />
      ) : viewId ? (
        <AssetDetailView assetId={viewId} onBack={() => setViewId(null)} />
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Asset #</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Category</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Cost</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Depreciation</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Book Value</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(assets) ? assets : []).map((asset: any) => (
                <tr key={asset.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-medium text-slate-800">{asset.assetNumber}</td>
                  <td className="px-4 py-3 text-slate-800">{asset.name}</td>
                  <td className="px-4 py-3 text-slate-600">{asset.category || '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{fmtNaira(asset.purchaseCost)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{fmtNaira(asset.accumulatedDepreciation)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmtNaira(asset.bookValue)}</td>
                  <td className="px-4 py-3"><span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${STATUS_COLORS[asset.status] || 'bg-slate-100 text-slate-600'}`}>{STATUS_LABELS[asset.status] || asset.status}</span></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setViewId(asset.id)} className="text-blue-600 hover:text-blue-800"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => deleteMutation.mutate(asset.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!assets || assets.length === 0) && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No fixed assets recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AssetDetailView({ assetId, onBack }: { assetId: string; onBack: () => void }) {
  const { data: asset, isLoading } = useQuery({
    queryKey: ['fixed-asset', assetId],
    queryFn: () => fixedAssetsApi.getAsset(assetId),
  });

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (!asset) return <div className="text-center py-20 text-slate-400">Asset not found.</div>;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-blue-600 hover:text-blue-800">&larr; Back to assets</button>
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div><span className="text-xs font-semibold text-slate-500 uppercase">Asset #</span><p className="text-sm font-medium text-slate-800 font-mono">{asset.assetNumber}</p></div>
          <div><span className="text-xs font-semibold text-slate-500 uppercase">Name</span><p className="text-sm font-medium text-slate-800">{asset.name}</p></div>
          <div><span className="text-xs font-semibold text-slate-500 uppercase">Category</span><p className="text-sm text-slate-600">{asset.category || '—'}</p></div>
          <div><span className="text-xs font-semibold text-slate-500 uppercase">Status</span><p className="text-sm"><span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${STATUS_COLORS[asset.status] || ''}`}>{STATUS_LABELS[asset.status] || asset.status}</span></p></div>
          <div><span className="text-xs font-semibold text-slate-500 uppercase">Purchase Date</span><p className="text-sm text-slate-600">{fmtDate(asset.purchaseDate)}</p></div>
          <div><span className="text-xs font-semibold text-slate-500 uppercase">Purchase Cost</span><p className="text-sm font-semibold text-slate-800">{fmtNaira(asset.purchaseCost)}</p></div>
          <div><span className="text-xs font-semibold text-slate-500 uppercase">Accumulated Depreciation</span><p className="text-sm text-slate-600">{fmtNaira(asset.accumulatedDepreciation)}</p></div>
          <div><span className="text-xs font-semibold text-slate-500 uppercase">Book Value</span><p className="text-sm font-semibold text-slate-800">{fmtNaira(asset.bookValue)}</p></div>
          <div><span className="text-xs font-semibold text-slate-500 uppercase">Method</span><p className="text-sm text-slate-600">{DEPR_LABELS[asset.depreciationMethod] || asset.depreciationMethod}</p></div>
          <div><span className="text-xs font-semibold text-slate-500 uppercase">Useful Life (months)</span><p className="text-sm text-slate-600">{asset.usefulLifeMonths}</p></div>
          <div><span className="text-xs font-semibold text-slate-500 uppercase">Residual Value</span><p className="text-sm text-slate-600">{fmtNaira(asset.residualValue)}</p></div>
        </div>
      </div>
    </div>
  );
}

function AssetForm({ onDone }: { onDone: () => void }) {
  const [assetNumber, setAssetNumber] = useState(`FA-${Date.now()}`);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [purchaseCost, setPurchaseCost] = useState('');
  const [depreciationMethod, setDepreciationMethod] = useState<'straight_line' | 'declining_balance'>('straight_line');
  const [usefulLifeMonths, setUsefulLifeMonths] = useState('60');
  const [residualValue, setResidualValue] = useState('0');
  const [accountId, setAccountId] = useState('');
  const [error, setError] = useState('');

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountantApi.getAccounts(),
  });

  const mutation = useMutation({
    mutationFn: (data: any) => fixedAssetsApi.createAsset(data),
    onSuccess: onDone,
    onError: (err: any) => setError(err.response?.data?.error || err.message || 'Failed to create.'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name || !accountId) { setError('Name and account are required.'); return; }
    mutation.mutate({
      assetNumber,
      name,
      category: category || null,
      purchaseDate,
      purchaseCost: Math.round(Number(purchaseCost || 0) * 100),
      depreciationMethod,
      usefulLifeMonths: Number(usefulLifeMonths),
      residualValue: Math.round(Number(residualValue || 0) * 100),
      accountId,
    });
  };

  const accList = Array.isArray(accounts) ? accounts.filter((a: any) => a.type === 'asset') : [];

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
      {error && <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm"><AlertCircle className="w-4 h-4" /> {error}</div>}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div><label className="text-xs font-semibold text-slate-500 uppercase">Asset #</label><input value={assetNumber} onChange={e => setAssetNumber(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm mt-1" /></div>
        <div><label className="text-xs font-semibold text-slate-500 uppercase">Name</label><input value={name} onChange={e => setName(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm mt-1" /></div>
        <div><label className="text-xs font-semibold text-slate-500 uppercase">Category</label><input value={category} onChange={e => setCategory(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm mt-1" /></div>
        <div><label className="text-xs font-semibold text-slate-500 uppercase">Purchase Date</label><input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm mt-1" /></div>
        <div><label className="text-xs font-semibold text-slate-500 uppercase">Purchase Cost (₦)</label><input type="number" value={purchaseCost} onChange={e => setPurchaseCost(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm mt-1" /></div>
        <div><label className="text-xs font-semibold text-slate-500 uppercase">Residual Value (₦)</label><input type="number" value={residualValue} onChange={e => setResidualValue(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm mt-1" /></div>
        <div><label className="text-xs font-semibold text-slate-500 uppercase">Depreciation Method</label>
          <select value={depreciationMethod} onChange={e => setDepreciationMethod(e.target.value as any)} className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm mt-1">
            <option value="straight_line">Straight Line</option>
            <option value="declining_balance">Declining Balance</option>
          </select>
        </div>
        <div><label className="text-xs font-semibold text-slate-500 uppercase">Useful Life (months)</label><input type="number" value={usefulLifeMonths} onChange={e => setUsefulLifeMonths(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm mt-1" /></div>
        <div><label className="text-xs font-semibold text-slate-500 uppercase">Asset Account</label>
          <AccountSearchSelect
            accounts={accList}
            value={accountId}
            onChange={setAccountId}
            placeholder="Select account"
          />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Create Asset
        </button>
      </div>
    </form>
  );
}
