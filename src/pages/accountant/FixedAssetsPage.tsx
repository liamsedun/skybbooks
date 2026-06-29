import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fixedAssetsApi, accountantApi } from '../../lib/api';
import { AccountSearchSelect } from '../../components/ui/AccountSearchSelect';
import { Plus, X, Loader2, AlertCircle, CheckCircle2, Trash2, Eye, Download, Upload, FileText, Printer, Calculator } from 'lucide-react';
import { downloadCsv } from '../../lib/csvTemplates';

function fmtNaira(v: number): string {
  return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_LABELS: Record<string, string> = { active: 'Active', disposed: 'Disposed', fully_depreciated: 'Fully Depreciated' };
const STATUS_COLORS: Record<string, string> = { active: 'bg-emerald-100 text-emerald-700', disposed: 'bg-red-100 text-red-700', fully_depreciated: 'bg-slate-100 text-slate-600' };
const DEPR_LABELS: Record<string, string> = { straight_line: 'Straight Line', declining_balance: 'Declining Balance', no_depreciation: 'No Depreciation' };

export function FixedAssetsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [editAsset, setEditAsset] = useState<any | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [lastImportIds, setLastImportIds] = useState<string[]>([]);
  const [clearing, setClearing] = useState(false);
  const [deprMsg, setDeprMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: assets, isLoading } = useQuery({
    queryKey: ['fixed-assets'],
    queryFn: () => fixedAssetsApi.getAssets(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fixedAssetsApi.deleteAsset(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fixed-assets'] }),
  });

  const deprMutation = useMutation({
    mutationFn: () => fixedAssetsApi.runDepreciation(),
    onSuccess: (res) => { setDeprMsg({ type: 'success', text: res.message || 'Depreciation run complete.' }); queryClient.invalidateQueries({ queryKey: ['fixed-assets'] }); setTimeout(() => setDeprMsg(null), 5000); },
    onError: (err: any) => { setDeprMsg({ type: 'error', text: err?.response?.data?.error || err.message || 'Depreciation run failed.' }); setTimeout(() => setDeprMsg(null), 5000); },
  });

  const handleExportCsv = async () => {
    try {
      const blob = await fixedAssetsApi.exportAssetsCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'fixed_assets.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  const handlePrintPdf = async () => {
    try {
      const blob = await fixedAssetsApi.getAssetsPdf();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch { /* ignore */ }
  };

  const handleClearLastImport = async () => {
    if (!lastImportIds.length || !confirm('Delete all assets from the last import?')) return;
    setClearing(true);
    try {
      await fixedAssetsApi.bulkDeleteAssets(lastImportIds);
      setLastImportIds([]);
      queryClient.invalidateQueries({ queryKey: ['fixed-assets'] });
    } catch { /* ignore */ }
    finally { setClearing(false); }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(ev.target?.result as string || '');
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!csvText.trim()) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const res = await fixedAssetsApi.importAssetsCsv({ csvData: csvText });
      setImportMsg({ type: 'success', text: res.message || 'Assets imported successfully.' });
      setLastImportIds((res.created || []).map((a: any) => a.id));
      setCsvText('');
      queryClient.invalidateQueries({ queryKey: ['fixed-assets'] });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Import failed.';
      const errors = err?.response?.data?.errors;
      setImportMsg({ type: 'error', text: errors ? `${msg}: ${errors.join(', ')}` : msg });
    } finally { setImporting(false); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Fixed Assets</h1>
        <div className="flex gap-2">
          <button onClick={() => downloadCsv('fixed-assets-template.csv', ['name', 'purchase date (YYYY-MM-DD)', 'purchase cost (NGN)', 'depreciation method', 'useful life (months)', 'residual value (NGN)', 'category', 'account code'], ['Office Building', '2024-01-15', '50000000', 'No Depreciation', '0', '0', 'Buildings', '200200'])} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-500 rounded-lg hover:bg-slate-600"><FileText className="w-3.5 h-3.5" /> Sample CSV</button>
          <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"><Upload className="w-3.5 h-3.5" /> Import CSV</button>
          {lastImportIds.length > 0 && (
            <button onClick={handleClearLastImport} disabled={clearing} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50"><X className="w-3.5 h-3.5" /> {clearing ? 'Clearing...' : 'Clear Last Import'}</button>
          )}
          <button onClick={() => { if (confirm('Run depreciation for all active assets? This will post a journal entry.')) deprMutation.mutate(); }} disabled={deprMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50">
            <Calculator className="w-3.5 h-3.5" /> {deprMutation.isPending ? 'Running...' : 'Run Depreciation'}
          </button>
          <button onClick={handleExportCsv} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={handlePrintPdf} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700"><Printer className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"><Plus className="w-3.5 h-3.5" /> New Asset</button>
        </div>
      </div>

      {deprMsg && (
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold ${deprMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {deprMsg.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          {deprMsg.text}
        </div>
      )}

      {showForm ? (
        <AssetForm onDone={() => { setShowForm(false); queryClient.invalidateQueries({ queryKey: ['fixed-assets'] }); }} />
      ) : editAsset ? (
        <AssetForm initialData={editAsset} onDone={() => { setEditAsset(null); queryClient.invalidateQueries({ queryKey: ['fixed-assets'] }); }} />
      ) : viewId ? (
        <AssetDetailView assetId={viewId} onBack={() => setViewId(null)} onEdit={(a) => { setViewId(null); setEditAsset(a); }} />
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Asset #</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Name</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Category</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Cost</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Depreciation</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Residual</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Book Value</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Status</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const list = Array.isArray(assets) ? assets : [];
                if (list.length === 0) return <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-400">No fixed assets recorded.</td></tr>;
                const groups: Record<string, any[]> = {};
                for (const a of list) {
                  const cat = a.category || 'Uncategorized';
                  if (!groups[cat]) groups[cat] = [];
                  groups[cat].push(a);
                }
                const rows: JSX.Element[] = [];
                for (const [cat, items] of Object.entries(groups)) {
                  const catCost = items.reduce((s, a) => s + a.purchaseCost, 0);
                  const catDepr = items.reduce((s, a) => s + a.accumulatedDepreciation, 0);
                  const catRes = items.reduce((s, a) => s + a.residualValue, 0);
                  const catBv = items.reduce((s, a) => s + a.bookValue, 0);
                  for (const asset of items) {
                    rows.push(
                      <tr key={asset.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono font-medium text-slate-800">{asset.assetNumber}</td>
                        <td className="px-3 py-2 text-slate-800">{asset.name}</td>
                        <td className="px-3 py-2 text-slate-600">{asset.category || '—'}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{fmtNaira(asset.purchaseCost)}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{fmtNaira(asset.accumulatedDepreciation)}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{fmtNaira(asset.residualValue)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-800">{fmtNaira(asset.bookValue)}</td>
                        <td className="px-3 py-2"><span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full ${STATUS_COLORS[asset.status] || 'bg-slate-100 text-slate-600'}`}>{STATUS_LABELS[asset.status] || asset.status}</span></td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setViewId(asset.id)} className="text-blue-600 hover:text-blue-800"><Eye className="w-3.5 h-3.5" /></button>
                            <button onClick={() => deleteMutation.mutate(asset.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  rows.push(
                    <tr key={`sub-${cat}`} className="border-t border-slate-200 bg-slate-50/80">
                      <td colSpan={3} className="px-3 py-1.5 text-xs font-bold text-slate-700">{cat} Subtotal</td>
                      <td className="px-3 py-1.5 text-right text-xs font-bold text-slate-700">{fmtNaira(catCost)}</td>
                      <td className="px-3 py-1.5 text-right text-xs font-bold text-slate-700">{fmtNaira(catDepr)}</td>
                      <td className="px-3 py-1.5 text-right text-xs font-bold text-slate-700">{fmtNaira(catRes)}</td>
                      <td className="px-3 py-1.5 text-right text-xs font-bold text-slate-700">{fmtNaira(catBv)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  );
                }
                return rows;
              })()}
            </tbody>
            {assets && assets.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50">
                <td colSpan={3} className="px-3 py-2 text-xs font-bold text-slate-800">Total</td>
                <td className="px-3 py-2 text-right font-bold text-slate-800">{fmtNaira(assets.reduce((s: number, a: any) => s + a.purchaseCost, 0))}</td>
                <td className="px-3 py-2 text-right font-bold text-slate-800">{fmtNaira(assets.reduce((s: number, a: any) => s + a.accumulatedDepreciation, 0))}</td>
                <td className="px-3 py-2 text-right font-bold text-slate-800">{fmtNaira(assets.reduce((s: number, a: any) => s + a.residualValue, 0))}</td>
                <td className="px-3 py-2 text-right font-bold text-slate-800">{fmtNaira(assets.reduce((s: number, a: any) => s + a.bookValue, 0))}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
            )}
          </table>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowImport(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Import Fixed Assets</h2>
              <button onClick={() => setShowImport(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-slate-500">Upload a CSV file exported from your previous accounting system. Required columns: <code className="text-xs bg-slate-100 px-1 rounded">name</code>, <code className="text-xs bg-slate-100 px-1 rounded">purchase cost (NGN)</code>. Optional: <code className="text-xs bg-slate-100 px-1 rounded">purchase date</code>, <code className="text-xs bg-slate-100 px-1 rounded">depreciation method</code>, <code className="text-xs bg-slate-100 px-1 rounded">useful life (months)</code>, <code className="text-xs bg-slate-100 px-1 rounded">residual value (NGN)</code>, <code className="text-xs bg-slate-100 px-1 rounded">category</code>, <code className="text-xs bg-slate-100 px-1 rounded">account code</code>.</p>
            <p className="text-xs text-slate-400">Click "Sample CSV" above to download a template.</p>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFileUpload} className="block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
            {csvText && <div className="text-xs text-slate-500 bg-slate-50 rounded p-2 max-h-24 overflow-auto">{csvText.slice(0, 500)}{csvText.length > 500 ? '...' : ''}</div>}
            {importMsg && <div className={`text-sm p-2 rounded ${importMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{importMsg.text}</div>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowImport(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={handleImport} disabled={!csvText.trim() || importing} className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">{importing ? 'Importing...' : 'Import'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AssetDetailView({ assetId, onBack, onEdit }: { assetId: string; onBack: () => void; onEdit: (a: any) => void }) {
  const { data: asset, isLoading } = useQuery({
    queryKey: ['fixed-asset', assetId],
    queryFn: () => fixedAssetsApi.getAsset(assetId),
  });

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (!asset) return <div className="text-center py-20 text-slate-400">Asset not found.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-blue-600 hover:text-blue-800">&larr; Back to assets</button>
        <button onClick={() => onEdit(asset)} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> Edit</button>
      </div>
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

function AssetForm({ initialData, onDone }: { initialData?: any; onDone: () => void }) {
  const isEdit = !!initialData;
  const [assetNumber, setAssetNumber] = useState(initialData?.assetNumber || `FA-${Date.now()}`);
  const [name, setName] = useState(initialData?.name || '');
  const [category, setCategory] = useState(initialData?.category || '');
  const [purchaseDate, setPurchaseDate] = useState(initialData?.purchaseDate ? new Date(initialData.purchaseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  const [purchaseCost, setPurchaseCost] = useState(initialData ? String(initialData.purchaseCost / 100) : '');
  const [depreciationMethod, setDepreciationMethod] = useState<'straight_line' | 'declining_balance' | 'no_depreciation'>(initialData?.depreciationMethod || 'straight_line');
  const [usefulLifeMonths, setUsefulLifeMonths] = useState(String(initialData?.usefulLifeMonths || '60'));
  const [residualValue, setResidualValue] = useState(initialData ? String(initialData.residualValue / 100) : '0');
  const [accountId, setAccountId] = useState(initialData?.accountId || '');
  const [error, setError] = useState('');

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountantApi.getAccounts(),
  });

  const mutation = useMutation({
    mutationFn: (data: any) => isEdit ? fixedAssetsApi.updateAsset(initialData.id, data) : fixedAssetsApi.createAsset(data),
    onSuccess: onDone,
    onError: (err: any) => setError(err.response?.data?.error || err.message || (isEdit ? 'Failed to update.' : 'Failed to create.')),
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
      <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Edit Asset' : 'New Asset'}</h2>
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
            <option value="no_depreciation">No Depreciation (e.g. Land)</option>
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
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} {isEdit ? 'Update Asset' : 'Create Asset'}
        </button>
      </div>
    </form>
  );
}