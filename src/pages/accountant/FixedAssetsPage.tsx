import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fixedAssetsApi, printWindow } from '../../lib/api';
import { PageLoader } from '../../components/ui/PageLoader';
import { AccountSearchSelect } from '../../components/ui/AccountSearchSelect';
import { Building, TrendingDown, Plus, FileText, Download, Upload, Search, Trash2, Eye, Edit3, AlertTriangle, Repeat, Wrench, ArrowRight, History, BarChart4, X, Loader2, CheckCircle, MapPin, Layers } from 'lucide-react';

function fmtNaira(v: number): string { return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`; }
function fmtDate(d: string | Date): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function toKobo(v: number): number { return Math.round(v * 100); }
function fromKobo(v: number): number { return v / 100; }

type Tab = 'assets' | 'classes' | 'reports';

const methodOptions = [
  { value: 'straight_line', label: 'Straight Line' },
  { value: 'declining_balance', label: 'Declining Balance' },
  { value: 'no_depreciation', label: 'No Depreciation' },
];

const statusBadge: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-100/50',
  disposed: 'bg-red-100 text-red-700 border-red-100/50',
  fully_depreciated: 'bg-slate-100 text-slate-600 border-slate-200/50',
  cwip: 'bg-amber-100 text-amber-700 border-amber-100/50',
};

export function FixedAssetsPage() {
  const [tab, setTab] = useState<Tab>('assets');
  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">

        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm flex overflow-hidden">
          <button onClick={() => setTab('assets')} className={`px-4 py-2 text-xs font-semibold transition-all duration-200 ${tab === 'assets' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><Building className="w-3.5 h-3.5 inline mr-1" /> Assets</button>
          <button onClick={() => setTab('classes')} className={`px-4 py-2 text-xs font-semibold border-x border-slate-200/80 ${tab === 'classes' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><Layers className="w-3.5 h-3.5 inline mr-1" /> Classes</button>
          <button onClick={() => setTab('reports')} className={`px-4 py-2 text-xs font-semibold ${tab === 'reports' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><BarChart4 className="w-3.5 h-3.5 inline mr-1" /> IFRS Reports</button>
        </div>
      </div>
      {tab === 'assets' && <AssetsTab />}
      {tab === 'classes' && <ClassesTab />}
      {tab === 'reports' && <ReportsTab />}
    </div>
  );
}

function AssetsTab() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [editAsset, setEditAsset] = useState<any>(null);
  const [viewAssetId, setViewAssetId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [importing, setImporting] = useState(false);
  const [lastImportIds, setLastImportIds] = useState<string[]>([]);
  const [clearing, setClearing] = useState(false);
  const [showDisposal, setShowDisposal] = useState<{ assetId: string; assetName: string; nbv: number } | null>(null);
  const [showTransfer, setShowTransfer] = useState<{ assetId: string; assetName: string } | null>(null);
  const [showRevalue, setShowRevalue] = useState<{ assetId: string; assetName: string; bookValue: number } | null>(null);
  const [showImpair, setShowImpair] = useState<{ assetId: string; assetName: string; bookValue: number } | null>(null);

  const { data: assets, isLoading, refetch } = useQuery({
    queryKey: ['fixed-assets'],
    queryFn: () => fixedAssetsApi.getAssets(),
  });
  const { data: classes } = useQuery({
    queryKey: ['asset-classes'],
    queryFn: () => fixedAssetsApi.getClasses(),
  });

  const deleteMutation = useMutation({ mutationFn: (id: string) => fixedAssetsApi.deleteAsset(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fixed-assets'] }) });

  const importMutation = useMutation({
    mutationFn: (csvData: string) => fixedAssetsApi.importAssetsCsv({ csvData }),
    onSuccess: (data: any) => {
      setImportMsg(data.message || 'Import complete.');
      setLastImportIds((data.created || []).map((a: any) => a.id));
      setImporting(false);
      queryClient.invalidateQueries({ queryKey: ['fixed-assets'] });
    },
    onError: (err: any) => { setImportMsg(`Error: ${err?.response?.data?.error || err.message}`); setImporting(false); },
  });

  const clearMutation = useMutation({
    mutationFn: (ids: string[]) => fixedAssetsApi.bulkDeleteAssets(ids),
    onSuccess: () => { setClearing(false); setLastImportIds([]); setImportMsg(''); queryClient.invalidateQueries({ queryKey: ['fixed-assets'] }); },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(ev.target?.result as string || '');
    reader.readAsText(file);
  };

  const handleImport = () => { if (csvText.trim()) { setImporting(true); setImportMsg(''); importMutation.mutate(csvText); } };

  const handleDownloadSample = () => {
    const csv = '\uFEFFname,purchase date (YYYY-MM-DD),purchase cost (NGN),depreciation method,useful life (months),residual value (NGN),category,account code\nOffice Building,2024-01-15,50000000,No Depreciation,0,0,Buildings,200200\nLaptop Computers,2024-06-01,3000000,Straight Line,36,0,Computer Equipment,200600\n';
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = 'fixed-assets-template.csv'; a.click();
  };

  const handleExportCsv = async () => {
    try { const blob = await fixedAssetsApi.exportAssetsCsv(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'fixed_assets.csv'; a.click(); URL.revokeObjectURL(url); } catch {}
  };

  const handlePrintPdf = async () => {
    const list = assets || [];
    const rows = list.map((a: any) => `<tr><td>${a.assetNumber}</td><td>${a.name}</td><td>${a.category || '-'}</td><td class="r">${fmtNaira(a.purchaseCost)}</td><td class="r">${fmtNaira(a.accumulatedDepreciation)}</td><td class="r">${fmtNaira(a.bookValue)}</td><td>${a.status}</td></tr>`).join('');
    const totalCost = list.reduce((s: number, a: any) => s + a.purchaseCost, 0);
    const totalDepr = list.reduce((s: number, a: any) => s + a.accumulatedDepreciation, 0);
    const totalBv = list.reduce((s: number, a: any) => s + a.bookValue, 0);
    printWindow('Fixed Assets', `<h2>Fixed Assets Register</h2><p>${list.length} assets</p><table><thead><tr><th>Asset #</th><th>Name</th><th>Category</th><th class="r">Cost</th><th class="r">Depreciation</th><th class="r">Book Value</th><th>Status</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="3">Total</th><th class="r">${fmtNaira(totalCost)}</th><th class="r">${fmtNaira(totalDepr)}</th><th class="r">${fmtNaira(totalBv)}</th><th></th></tr></tfoot></table>`, '');
  };

  const classMap = new Map((classes || []).map((c: any) => [c.id as string, c]));

  const filteredAssets = (assets || []).filter((a: any) => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (search) { const q = search.toLowerCase(); return a.name.toLowerCase().includes(q) || a.assetNumber.toLowerCase().includes(q) || (a.category || '').toLowerCase().includes(q); }
    return true;
  });

  if (viewAssetId) {
    return <AssetDetailView assetId={viewAssetId} onBack={() => setViewAssetId(null)} classes={classes || []} />;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search assets..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="cwip">CWIP</option>
          <option value="fully_depreciated">Fully Depreciated</option>
          <option value="disposed">Disposed</option>
        </select>
        <button onClick={() => { setEditAsset(null); setShowForm(true); }} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700"><Plus className="w-3.5 h-3.5" /> New Asset</button>
        <button onClick={() => { setShowImport(true); setCsvText(''); setImportMsg(''); }} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200/80 rounded-xl hover:bg-slate-50"><Upload className="w-3.5 h-3.5" /> Import CSV</button>
        <button onClick={handleExportCsv} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200/80 rounded-xl hover:bg-slate-50"><Download className="w-3.5 h-3.5" /> Export CSV</button>
        <button onClick={handlePrintPdf} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700"><FileText className="w-3.5 h-3.5" /> PDF</button>
      </div>

      {isLoading && <PageLoader message="Loading fixed assets..." />}

      {/* Summary Cards */}
      {assets && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4"><p className="text-[11px] font-semibold text-slate-400 uppercase">Total Assets</p><p className="text-xl font-bold text-slate-800 mt-1">{assets.length}</p></div>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4"><p className="text-[11px] font-semibold text-slate-400 uppercase">Total Cost</p><p className="text-xl font-bold text-slate-800 mt-1">{fmtNaira(assets.reduce((s: number, a: any) => s + a.purchaseCost, 0))}</p></div>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4"><p className="text-[11px] font-semibold text-slate-400 uppercase">Total Depreciation</p><p className="text-xl font-bold text-amber-700 mt-1">{fmtNaira(assets.reduce((s: number, a: any) => s + a.accumulatedDepreciation, 0))}</p></div>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4"><p className="text-[11px] font-semibold text-slate-400 uppercase">Net Book Value</p><p className="text-xl font-bold text-emerald-700 mt-1">{fmtNaira(assets.reduce((s: number, a: any) => s + a.bookValue, 0))}</p></div>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4"><p className="text-[11px] font-semibold text-slate-400 uppercase">CWIP</p><p className="text-xl font-bold text-amber-700 mt-1">{assets.filter((a: any) => a.status === 'cwip').length}</p></div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2 text-left">Asset #</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Class</th>
              <th className="px-3 py-2 text-left">Category</th>
              <th className="px-3 py-2 text-right">Cost</th>
              <th className="px-3 py-2 text-right">Depreciation</th>
              <th className="px-3 py-2 text-right">NBV</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th className="px-3 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAssets.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-400">No fixed assets found.</td></tr>
            ) : filteredAssets.map((a: any) => (
              <tr key={a.id} className="hover:bg-slate-50/50 border-b border-slate-50">
                <td className="px-3 py-2 font-mono text-xs text-slate-500">{a.assetNumber}</td>
                <td className="px-3 py-2 font-medium text-slate-800">{a.name}</td>
                <td className="px-3 py-2 text-slate-500">{(classMap.get(a.assetClassId as string) as any)?.name || '-'}</td>
                <td className="px-3 py-2 text-slate-500">{a.category || '-'}</td>
                <td className="px-3 py-2 text-right text-slate-600">{fmtNaira(a.purchaseCost)}</td>
                <td className="px-3 py-2 text-right text-slate-600">{fmtNaira(a.accumulatedDepreciation)}</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-800">{fmtNaira(a.bookValue)}</td>
                <td className="px-3 py-2 text-center"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadge[a.status] || 'bg-slate-100 text-slate-600'}`}>{a.status.replace('_', ' ')}</span></td>
                <td className="px-3 py-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => setViewAssetId(a.id)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600" title="View"><Eye className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { setEditAsset(a); setShowForm(true); }} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-amber-600" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
                    {a.status === 'active' && (
                      <>
                        <button onClick={() => setShowDisposal({ assetId: a.id, assetName: a.name, nbv: a.bookValue })} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-red-600" title="Dispose"><Trash2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setShowTransfer({ assetId: a.id, assetName: a.name })} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600" title="Transfer"><ArrowRight className="w-3.5 h-3.5" /></button>
                      </>
                    )}
                    {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" /> : (
                      <button onClick={() => { if (confirm('Delete this asset?')) deleteMutation.mutate(a.id); }} className="p-1 rounded-lg hover:bg-slate-100 text-slate-300 hover:text-red-500" title="Delete"><X className="w-3 h-3" /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Form Modal */}
      {showForm && <AssetFormModal asset={editAsset} classes={classes || []} onClose={() => { setShowForm(false); setEditAsset(null); refetch(); }} />}

      {/* Import CSV Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowImport(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 border border-slate-200/80" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Import Fixed Assets</h2><button onClick={() => setShowImport(false)}><X className="w-5 h-5 text-slate-400" /></button></div>
            <p className="text-xs text-slate-500">Upload a CSV file with asset data. <button onClick={handleDownloadSample} className="text-indigo-600 underline">Download sample template</button></p>
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload} className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
            {csvText && <textarea value={csvText} onChange={e => setCsvText(e.target.value)} rows={5} className="w-full text-xs p-2 border border-slate-200 rounded-xl font-mono" />}
            {importMsg && <div className={`text-xs p-3 rounded-xl ${importMsg.startsWith('Error') || importMsg.startsWith('E') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{importMsg}</div>}
            {lastImportIds.length > 0 && (
              <button onClick={() => clearMutation.mutate(lastImportIds)} disabled={clearing} className="text-xs text-red-600 underline">Clear last import</button>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowImport(false)} className="px-4 py-2 text-sm border border-slate-200/80 rounded-xl text-slate-600">Cancel</button>
              <button onClick={handleImport} disabled={!csvText || importing} className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50">{importing ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Import</button>
            </div>
          </div>
        </div>
      )}

      {/* Disposal Modal */}
      {showDisposal && <DisposalModal {...showDisposal} onClose={() => setShowDisposal(null)} onComplete={() => { setShowDisposal(null); queryClient.invalidateQueries({ queryKey: ['fixed-assets'] }); }} />}

      {/* Transfer Modal */}
      {showTransfer && <TransferModal {...showTransfer} onClose={() => setShowTransfer(null)} onComplete={() => { setShowTransfer(null); queryClient.invalidateQueries({ queryKey: ['fixed-assets'] }); }} />}
    </div>
  );
}

function AssetFormModal({ asset, classes, onClose }: { asset: any; classes: any[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: accountsList } = useQuery({ queryKey: ['accounts'], queryFn: async () => { const res = await import('../../lib/api').then(m => m.api.get('/accounts')); return res.data; } });
  const [form, setForm] = useState<any>(asset ? {
    name: asset.name, assetNumber: asset.assetNumber, category: asset.category || '',
    assetClassId: asset.assetClassId || '', purchaseDate: asset.purchaseDate?.split('T')[0] || '',
    purchaseCost: fromKobo(asset.purchaseCost), depreciationMethod: asset.depreciationMethod,
    usefulLifeMonths: asset.usefulLifeMonths, residualValue: fromKobo(asset.residualValue),
    accountId: asset.accountId, location: asset.location || '', department: asset.department || '',
    disposalAccountId: asset.disposalAccountId || '', status: asset.status || 'active',
  } : {
    assetNumber: `FA-${Date.now()}`, name: '', category: '', assetClassId: '', purchaseDate: new Date().toISOString().split('T')[0],
    purchaseCost: 0, depreciationMethod: 'straight_line', usefulLifeMonths: 60, residualValue: 0,
    accountId: '', location: '', department: '', disposalAccountId: '', status: 'active',
  });

  const handleClassChange = (classId: string) => {
    const cls = classes.find((c: any) => c.id === classId);
    if (cls) {
      setForm((f: any) => ({
        ...f, assetClassId: classId, depreciationMethod: cls.defaultDepreciationMethod || f.depreciationMethod,
        usefulLifeMonths: cls.defaultUsefulLifeMonths || f.usefulLifeMonths, accountId: cls.glAssetAccountId || f.accountId,
      }));
    } else {
      setForm((f: any) => ({ ...f, assetClassId: '' }));
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, purchaseCost: toKobo(form.purchaseCost), residualValue: toKobo(form.residualValue), category: form.category || null, location: form.location || null, department: form.department || null, assetClassId: form.assetClassId || null, disposalAccountId: form.disposalAccountId || null, status: form.usefulLifeMonths <= 0 ? 'cwip' : form.status };
      if (asset) return fixedAssetsApi.updateAsset(asset.id, payload);
      return fixedAssetsApi.createAsset(payload);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['fixed-assets'] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4 border border-slate-200/80" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold">{asset ? 'Edit Asset' : 'New Asset'}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs font-semibold text-slate-500">Asset Number</label><input type="text" value={form.assetNumber} onChange={e => setForm({ ...form, assetNumber: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1 focus:outline-none focus:ring-2 focus:ring-slate-900/10" /></div>
          <div><label className="text-xs font-semibold text-slate-500">Asset Class</label><select value={form.assetClassId} onChange={e => handleClassChange(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1 focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white"><option value="">— None —</option>{classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="col-span-2"><label className="text-xs font-semibold text-slate-500">Name *</label><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1 focus:outline-none focus:ring-2 focus:ring-slate-900/10" /></div>
          <div><label className="text-xs font-semibold text-slate-500">Category</label><input type="text" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1" /></div>
          <div><label className="text-xs font-semibold text-slate-500">Purchase Date</label><input type="date" value={form.purchaseDate} onChange={e => setForm({ ...form, purchaseDate: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1" /></div>
          <div><label className="text-xs font-semibold text-slate-500">Purchase Cost (NGN)</label><input type="number" min="0" value={form.purchaseCost || ''} onChange={e => setForm({ ...form, purchaseCost: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1" /></div>
          <div><label className="text-xs font-semibold text-slate-500">Residual Value (NGN)</label><input type="number" min="0" value={form.residualValue || ''} onChange={e => setForm({ ...form, residualValue: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1" /></div>
          <div><label className="text-xs font-semibold text-slate-500">Depreciation Method</label><select value={form.depreciationMethod} onChange={e => setForm({ ...form, depreciationMethod: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1 bg-white">{methodOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
          <div><label className="text-xs font-semibold text-slate-500">Useful Life (months)</label><input type="number" min="0" value={form.usefulLifeMonths} onChange={e => setForm({ ...form, usefulLifeMonths: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1" /></div>
          <div className="col-span-2">
            <label className="text-xs font-semibold text-slate-500">Asset GL Account *</label>
            <AccountSearchSelect accounts={accountsList || []} value={form.accountId} onChange={id => setForm({ ...form, accountId: id })} />
          </div>
          <div><label className="text-xs font-semibold text-slate-500">Location</label><input type="text" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1" /></div>
          <div><label className="text-xs font-semibold text-slate-500">Department</label><input type="text" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1" /></div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200/80 rounded-xl text-slate-600">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={!form.name || !form.accountId || mutation.isPending} className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} {asset ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DisposalModal({ assetId, assetName, nbv, onClose, onComplete }: { assetId: string; assetName: string; nbv: number; onClose: () => void; onComplete: () => void }) {
  const [disposalDate, setDisposalDate] = useState(new Date().toISOString().split('T')[0]);
  const [disposalAmount, setDisposalAmount] = useState(0);
  const mutation = useMutation({
    mutationFn: () => fixedAssetsApi.disposeAsset(assetId, { disposalDate, disposalAmount: toKobo(disposalAmount) }),
    onSuccess: onComplete,
  });
  const expectedGainLoss = toKobo(disposalAmount) - nbv;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-200/80" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3"><Trash2 className="w-5 h-5 text-red-600" /><h2 className="text-lg font-bold">Dispose Asset</h2></div>
        <p className="text-sm text-slate-600">Dispose: <strong>{assetName}</strong></p>
        <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1"><div className="flex justify-between"><span>Net Book Value:</span><span className="font-semibold">{fmtNaira(nbv)}</span></div></div>
        <div><label className="text-xs font-semibold text-slate-500">Disposal Date</label><input type="date" value={disposalDate} onChange={e => setDisposalDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1" /></div>
        <div><label className="text-xs font-semibold text-slate-500">Disposal Proceeds (NGN)</label><input type="number" min="0" value={disposalAmount} onChange={e => setDisposalAmount(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1" /></div>
        {disposalAmount > 0 && <div className={`text-xs font-semibold ${expectedGainLoss >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{expectedGainLoss >= 0 ? 'Gain on disposal' : 'Loss on disposal'}: {fmtNaira(Math.abs(expectedGainLoss))}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200/80 rounded-xl text-slate-600">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700">{mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Dispose</button>
        </div>
      </div>
    </div>
  );
}

function TransferModal({ assetId, assetName, onClose, onComplete }: { assetId: string; assetName: string; onClose: () => void; onComplete: () => void }) {
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [toLocation, setToLocation] = useState('');
  const [toDepartment, setToDepartment] = useState('');
  const [reason, setReason] = useState('');
  const mutation = useMutation({
    mutationFn: () => fixedAssetsApi.transferAsset(assetId, { transferDate, toLocation, toDepartment, reason }),
    onSuccess: onComplete,
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-200/80" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3"><ArrowRight className="w-5 h-5 text-blue-600" /><h2 className="text-lg font-bold">Transfer Asset</h2></div>
        <p className="text-sm text-slate-600">Transfer: <strong>{assetName}</strong></p>
        <div><label className="text-xs font-semibold text-slate-500">Transfer Date</label><input type="date" value={transferDate} onChange={e => setTransferDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1" /></div>
        <div><label className="text-xs font-semibold text-slate-500">To Location</label><input type="text" value={toLocation} onChange={e => setToLocation(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1" /></div>
        <div><label className="text-xs font-semibold text-slate-500">To Department</label><input type="text" value={toDepartment} onChange={e => setToDepartment(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1" /></div>
        <div><label className="text-xs font-semibold text-slate-500">Reason</label><input type="text" value={reason} onChange={e => setReason(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1" /></div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200/80 rounded-xl text-slate-600">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700">{mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Transfer</button>
        </div>
      </div>
    </div>
  );
}

function AssetDetailView({ assetId, onBack, classes }: { assetId: string; onBack: () => void; classes: any[] }) {
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState<'details' | 'components' | 'revaluations' | 'impairments' | 'maintenance' | 'transfers'>('details');

  const { data: asset, isLoading } = useQuery({
    queryKey: ['fixed-asset', assetId],
    queryFn: () => fixedAssetsApi.getAsset(assetId),
  });
  const { data: comps } = useQuery({
    queryKey: ['asset-components', assetId],
    queryFn: () => fixedAssetsApi.getComponents(assetId),
    enabled: activeSubTab === 'components',
  });
  const { data: revaluations } = useQuery({
    queryKey: ['asset-revaluations', assetId],
    queryFn: () => fixedAssetsApi.getRevaluations(assetId),
    enabled: activeSubTab === 'revaluations',
  });
  const { data: impairments } = useQuery({
    queryKey: ['asset-impairments', assetId],
    queryFn: () => fixedAssetsApi.getImpairments(assetId),
    enabled: activeSubTab === 'impairments',
  });
  const { data: maintenance } = useQuery({
    queryKey: ['asset-maintenance', assetId],
    queryFn: () => fixedAssetsApi.getMaintenance(assetId),
    enabled: activeSubTab === 'maintenance',
  });
  const { data: transfers } = useQuery({
    queryKey: ['asset-transfers', assetId],
    queryFn: () => fixedAssetsApi.getTransfers(assetId),
    enabled: activeSubTab === 'transfers',
  });
  const [showAddComponent, setShowAddComponent] = useState(false);
  const [showRevalue, setShowRevalue] = useState(false);
  const [showImpair, setShowImpair] = useState(false);
  const [showMaintenance, setShowMaintenance] = useState(false);

  if (isLoading) return <PageLoader message="Loading asset..." />;
  if (!asset) return <div className="text-red-600 p-4">Asset not found.</div>;

  const classMap = new Map(classes.map((c: any) => [c.id, c]));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-indigo-600 hover:underline">&larr; Back to Assets</button>
        <h2 className="text-xl font-bold text-slate-900">{asset.name}</h2>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusBadge[asset.status] || ''}`}>{asset.status.replace('_', ' ')}</span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4"><p className="text-[11px] font-semibold text-slate-400 uppercase">Cost</p><p className="text-xl font-bold text-slate-800">{fmtNaira(asset.purchaseCost)}</p></div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4"><p className="text-[11px] font-semibold text-slate-400 uppercase">Depreciation</p><p className="text-xl font-bold text-amber-700">{fmtNaira(asset.accumulatedDepreciation)}</p></div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4"><p className="text-[11px] font-semibold text-slate-400 uppercase">Net Book Value</p><p className="text-xl font-bold text-emerald-700">{fmtNaira(asset.bookValue)}</p></div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4"><p className="text-[11px] font-semibold text-slate-400 uppercase">Revaluation</p><p className="text-xl font-bold text-blue-700">{fmtNaira(asset.revaluationAmount || 0)}</p></div>
      </div>

      {/* Detail Row */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 grid grid-cols-4 gap-4 text-xs">
        <div><span className="text-slate-400">Asset #:</span> <span className="font-mono">{asset.assetNumber}</span></div>
        <div><span className="text-slate-400">Class:</span> {(classMap.get(asset.assetClassId as string) as any)?.name || '-'}</div>
        <div><span className="text-slate-400">Category:</span> {asset.category || '-'}</div>
        <div><span className="text-slate-400">Method:</span> {methodOptions.find(o => o.value === asset.depreciationMethod)?.label || asset.depreciationMethod}</div>
        <div><span className="text-slate-400">Useful Life:</span> {asset.usefulLifeMonths} months</div>
        <div><span className="text-slate-400">Residual:</span> {fmtNaira(asset.residualValue)}</div>
        <div><span className="text-slate-400">Location:</span> {asset.location || '-'}</div>
        <div><span className="text-slate-400">Department:</span> {asset.department || '-'}</div>
        <div><span className="text-slate-400">Purchase Date:</span> {fmtDate(asset.purchaseDate)}</div>
        <div><span className="text-slate-400">Capitalization:</span> {asset.capitalizationDate ? fmtDate(asset.capitalizationDate) : '-'}</div>
        <div><span className="text-slate-400">Last Depreciation:</span> {asset.lastDepreciationDate ? fmtDate(asset.lastDepreciationDate) : '-'}</div>
        {asset.status === 'disposed' && <div><span className="text-slate-400">Disposal:</span> {asset.disposalDate ? fmtDate(asset.disposalDate) : '-'} ({fmtNaira(asset.disposalAmount || 0)})</div>}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-0">
        {(['details', 'components', 'revaluations', 'impairments', 'maintenance', 'transfers'] as const).map(t => (
          <button key={t} onClick={() => setActiveSubTab(t)} className={`px-3 py-2 text-xs font-semibold border-b-2 -mb-[1px] transition-colors ${activeSubTab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
            {t === 'details' && <><Building className="w-3 h-3 inline mr-1" /> Details</>}
            {t === 'components' && <><Layers className="w-3 h-3 inline mr-1" /> Components</>}
            {t === 'revaluations' && <><Repeat className="w-3 h-3 inline mr-1" /> Revaluations</>}
            {t === 'impairments' && <><AlertTriangle className="w-3 h-3 inline mr-1" /> Impairments</>}
            {t === 'maintenance' && <><Wrench className="w-3 h-3 inline mr-1" /> Maintenance</>}
            {t === 'transfers' && <><ArrowRight className="w-3 h-3 inline mr-1" /> Transfers</>}
          </button>
        ))}
      </div>

      {activeSubTab === 'details' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          {asset.status === 'active' && (
            <div className="flex gap-2 mb-4">
              <button onClick={() => setShowRevalue(true)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700"><Repeat className="w-3.5 h-3.5" /> Revalue</button>
              <button onClick={() => setShowImpair(true)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-amber-600 rounded-xl hover:bg-amber-700"><AlertTriangle className="w-3.5 h-3.5" /> Impair</button>
            </div>
          )}
          <p className="text-xs text-slate-400">Select a tab above to view or manage asset components, revaluations, impairments, maintenance, or transfers.</p>
        </div>
      )}

      {activeSubTab === 'components' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-800">Components ({comps?.length || 0})</h3>
            <button onClick={() => setShowAddComponent(true)} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700"><Plus className="w-3 h-3" /> Add Component</button>
          </div>
          <table className="w-full text-xs"><thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase"><tr><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-right">Cost</th><th className="px-3 py-2 text-right">Depreciation</th><th className="px-3 py-2 text-right">NBV</th><th className="px-3 py-2 text-right">Life</th><th className="px-3 py-2 text-left">Method</th></tr></thead>
            <tbody>{(comps || []).length === 0 ? <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No components.</td></tr> : (comps || []).map((c: any) => (
              <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50"><td className="px-3 py-2 font-medium">{c.name}</td><td className="px-3 py-2 text-right">{fmtNaira(c.cost)}</td><td className="px-3 py-2 text-right">{fmtNaira(c.accumulatedDepreciation)}</td><td className="px-3 py-2 text-right font-semibold">{fmtNaira(c.bookValue)}</td><td className="px-3 py-2 text-right">{c.usefulLifeMonths}m</td><td className="px-3 py-2">{methodOptions.find(o => o.value === c.depreciationMethod)?.label}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {activeSubTab === 'revaluations' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100"><h3 className="text-sm font-bold text-slate-800">Revaluation History</h3></div>
          <table className="w-full text-xs"><thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase"><tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-center">Type</th><th className="px-3 py-2 text-right">Old Carrying</th><th className="px-3 py-2 text-right">New Carrying</th><th className="px-3 py-2 text-right">Surplus</th><th className="px-3 py-2 text-right">Loss</th></tr></thead>
            <tbody>{(revaluations || []).length === 0 ? <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No revaluations.</td></tr> : (revaluations || []).map((r: any) => (
              <tr key={r.id} className="border-b border-slate-50"><td className="px-3 py-2">{fmtDate(r.revaluationDate)}</td><td className="px-3 py-2 text-center"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${r.revaluationType === 'upward' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{r.revaluationType}</span></td><td className="px-3 py-2 text-right">{fmtNaira(r.oldCarryingAmount)}</td><td className="px-3 py-2 text-right font-semibold">{fmtNaira(r.newCarryingAmount)}</td><td className="px-3 py-2 text-right text-blue-700">{fmtNaira(r.revaluationSurplus)}</td><td className="px-3 py-2 text-right text-red-700">{fmtNaira(r.revaluationLoss)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {activeSubTab === 'impairments' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100"><h3 className="text-sm font-bold text-slate-800">Impairment History</h3></div>
          <table className="w-full text-xs"><thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase"><tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-right">Carrying</th><th className="px-3 py-2 text-right">Recoverable</th><th className="px-3 py-2 text-right">Impairment</th><th className="px-3 py-2 text-left">Source</th></tr></thead>
            <tbody>{(impairments || []).length === 0 ? <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">No impairments recorded.</td></tr> : (impairments || []).map((i: any) => (
              <tr key={i.id} className="border-b border-slate-50"><td className="px-3 py-2">{fmtDate(i.impairmentDate)}</td><td className="px-3 py-2 text-right">{fmtNaira(i.carryingAmount)}</td><td className="px-3 py-2 text-right">{fmtNaira(i.recoverableAmount)}</td><td className="px-3 py-2 text-right font-semibold text-red-700">{fmtNaira(i.impairmentLoss)}</td><td className="px-3 py-2">{i.impairmentSource || '-'}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {activeSubTab === 'maintenance' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-800">Maintenance Records</h3>
            <button onClick={() => setShowMaintenance(true)} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700"><Plus className="w-3 h-3" /> Add Record</button>
          </div>
          <table className="w-full text-xs"><thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase"><tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Description</th><th className="px-3 py-2 text-right">Cost</th><th className="px-3 py-2 text-left">Vendor</th></tr></thead>
            <tbody>{(maintenance || []).length === 0 ? <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">No maintenance records.</td></tr> : (maintenance || []).map((m: any) => (
              <tr key={m.id} className="border-b border-slate-50"><td className="px-3 py-2">{fmtDate(m.maintenanceDate)}</td><td className="px-3 py-2 capitalize">{m.maintenanceType}</td><td className="px-3 py-2">{m.description}</td><td className="px-3 py-2 text-right">{fmtNaira(m.cost)}</td><td className="px-3 py-2">{m.vendor || '-'}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {activeSubTab === 'transfers' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100"><h3 className="text-sm font-bold text-slate-800">Transfer History</h3></div>
          <table className="w-full text-xs"><thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase"><tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">From</th><th className="px-3 py-2 text-left">To</th><th className="px-3 py-2 text-left">Reason</th></tr></thead>
            <tbody>{(transfers || []).length === 0 ? <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">No transfers.</td></tr> : (transfers || []).map((t: any) => (
              <tr key={t.id} className="border-b border-slate-50"><td className="px-3 py-2">{fmtDate(t.transferDate)}</td><td className="px-3 py-2">{t.fromLocation || t.fromDepartment || '-'}</td><td className="px-3 py-2 font-medium">{t.toLocation || t.toDepartment || '-'}</td><td className="px-3 py-2">{t.reason || '-'}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {/* Revalue Modal */}
      {showRevalue && <RevalueModal assetId={asset.id} assetName={asset.name} currentBookValue={asset.bookValue} onClose={() => setShowRevalue(false)} onComplete={() => { setShowRevalue(false); queryClient.invalidateQueries({ queryKey: ['fixed-asset', assetId] }); }} />}
      {showImpair && <ImpairModal assetId={asset.id} assetName={asset.name} currentBookValue={asset.bookValue} onClose={() => setShowImpair(false)} onComplete={() => { setShowImpair(false); queryClient.invalidateQueries({ queryKey: ['fixed-asset', assetId] }); }} />}
      {showAddComponent && <AddComponentModal assetId={asset.id} onClose={() => setShowAddComponent(false)} onComplete={() => { setShowAddComponent(false); queryClient.invalidateQueries({ queryKey: ['asset-components', assetId] }); }} />}
      {showMaintenance && <AddMaintenanceModal assetId={asset.id} onClose={() => setShowMaintenance(false)} onComplete={() => { setShowMaintenance(false); queryClient.invalidateQueries({ queryKey: ['asset-maintenance', assetId] }); }} />}
    </div>
  );
}

// Mini modals for revalue, impair, add component, add maintenance...

function RevalueModal({ assetId, assetName, currentBookValue, onClose, onComplete }: { assetId: string; assetName: string; currentBookValue: number; onClose: () => void; onComplete: () => void }) {
  const [newCarrying, setNewCarrying] = useState(fromKobo(currentBookValue));
  const [revalDate, setRevalDate] = useState(new Date().toISOString().split('T')[0]);
  const mutation = useMutation({ mutationFn: () => fixedAssetsApi.revalueAsset(assetId, { revaluationDate: revalDate, newCarryingAmount: toKobo(newCarrying) }), onSuccess: onComplete });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3"><Repeat className="w-5 h-5 text-blue-600" /><h2 className="text-lg font-bold">Revalue Asset</h2></div>
        <p className="text-sm">Asset: <strong>{assetName}</strong><br />Current NBV: <strong>{fmtNaira(currentBookValue)}</strong></p>
        <div><label className="text-xs font-semibold text-slate-500">Date</label><input type="date" value={revalDate} onChange={e => setRevalDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1" /></div>
        <div><label className="text-xs font-semibold text-slate-500">New Carrying Amount (NGN)</label><input type="number" value={newCarrying} onChange={e => setNewCarrying(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1" /></div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200/80 rounded-xl">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl">{mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Revalue</button>
        </div>
      </div>
    </div>
  );
}

function ImpairModal({ assetId, assetName, currentBookValue, onClose, onComplete }: { assetId: string; assetName: string; currentBookValue: number; onClose: () => void; onComplete: () => void }) {
  const [recoverable, setRecoverable] = useState(fromKobo(currentBookValue));
  const [impDate, setImpDate] = useState(new Date().toISOString().split('T')[0]);
  const [source, setSource] = useState('');
  const mutation = useMutation({ mutationFn: () => fixedAssetsApi.impairAsset(assetId, { impairmentDate: impDate, recoverableAmount: toKobo(recoverable), impairmentSource: source }), onSuccess: onComplete });
  const loss = toKobo(recoverable) > currentBookValue ? 0 : currentBookValue - toKobo(recoverable);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3"><AlertTriangle className="w-5 h-5 text-amber-600" /><h2 className="text-lg font-bold">Record Impairment</h2></div>
        <p className="text-sm">Asset: <strong>{assetName}</strong><br />Current NBV: <strong>{fmtNaira(currentBookValue)}</strong></p>
        <div><label className="text-xs font-semibold text-slate-500">Date</label><input type="date" value={impDate} onChange={e => setImpDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1" /></div>
        <div><label className="text-xs font-semibold text-slate-500">Recoverable Amount (NGN)</label><input type="number" value={recoverable} onChange={e => setRecoverable(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1" /></div>
        {loss > 0 && <div className="text-xs font-semibold text-red-600">Impairment loss: {fmtNaira(loss)}</div>}
        <div><label className="text-xs font-semibold text-slate-500">Source</label><input type="text" value={source} onChange={e => setSource(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1" /></div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200/80 rounded-xl">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || loss <= 0} className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 rounded-xl">{mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Record Impairment</button>
        </div>
      </div>
    </div>
  );
}

function AddComponentModal({ assetId, onClose, onComplete }: { assetId: string; onClose: () => void; onComplete: () => void }) {
  const [form, setForm] = useState({ name: '', cost: 0, usefulLifeMonths: 60, residualValue: 0, depreciationMethod: 'straight_line', description: '' });
  const mutation = useMutation({ mutationFn: () => fixedAssetsApi.createComponent(assetId, { ...form, cost: toKobo(form.cost), residualValue: toKobo(form.residualValue) }), onSuccess: onComplete });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold">Add Component</h2>
        <div><label className="text-xs font-semibold text-slate-500">Name *</label><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1" /></div>
        <div><label className="text-xs font-semibold text-slate-500">Description</label><input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs font-semibold text-slate-500">Cost (NGN)</label><input type="number" value={form.cost || ''} onChange={e => setForm({ ...form, cost: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1" /></div>
          <div><label className="text-xs font-semibold text-slate-500">Residual (NGN)</label><input type="number" value={form.residualValue || ''} onChange={e => setForm({ ...form, residualValue: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1" /></div>
          <div><label className="text-xs font-semibold text-slate-500">Life (months)</label><input type="number" value={form.usefulLifeMonths} onChange={e => setForm({ ...form, usefulLifeMonths: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1" /></div>
          <div><label className="text-xs font-semibold text-slate-500">Method</label><select value={form.depreciationMethod} onChange={e => setForm({ ...form, depreciationMethod: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1 bg-white">{methodOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200/80 rounded-xl">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={!form.name || mutation.isPending} className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl">{mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Add</button>
        </div>
      </div>
    </div>
  );
}

function AddMaintenanceModal({ assetId, onClose, onComplete }: { assetId: string; onClose: () => void; onComplete: () => void }) {
  const [form, setForm] = useState({ maintenanceDate: new Date().toISOString().split('T')[0], maintenanceType: 'routine', description: '', cost: 0, vendor: '' });
  const mutation = useMutation({ mutationFn: () => fixedAssetsApi.addMaintenance(assetId, { ...form, cost: toKobo(form.cost) }), onSuccess: onComplete });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold">Add Maintenance Record</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs font-semibold text-slate-500">Date</label><input type="date" value={form.maintenanceDate} onChange={e => setForm({ ...form, maintenanceDate: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1" /></div>
          <div><label className="text-xs font-semibold text-slate-500">Type</label><select value={form.maintenanceType} onChange={e => setForm({ ...form, maintenanceType: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1 bg-white"><option value="routine">Routine</option><option value="repair">Repair</option><option value="overhaul">Overhaul</option><option value="inspection">Inspection</option></select></div>
          <div className="col-span-2"><label className="text-xs font-semibold text-slate-500">Description *</label><input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1" /></div>
          <div><label className="text-xs font-semibold text-slate-500">Cost (NGN)</label><input type="number" value={form.cost || ''} onChange={e => setForm({ ...form, cost: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1" /></div>
          <div><label className="text-xs font-semibold text-slate-500">Vendor</label><input type="text" value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1" /></div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200/80 rounded-xl">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={!form.description || mutation.isPending} className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl">{mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Add</button>
        </div>
      </div>
    </div>
  );
}

// ==============================
// CLASSES TAB
// ==============================

function ClassesTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const { data: classes, isLoading } = useQuery({ queryKey: ['asset-classes'], queryFn: () => fixedAssetsApi.getClasses() });
  const deleteMutation = useMutation({ mutationFn: (id: string) => fixedAssetsApi.deleteClass(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['asset-classes'] }) });

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3 flex justify-between items-center">
        <p className="text-xs text-slate-500">Asset classes define default depreciation settings, useful lives, and GL account mappings.</p>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700"><Plus className="w-3.5 h-3.5" /> New Class</button>
      </div>
      {isLoading ? <PageLoader message="Loading classes..." /> : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-xs"><thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase"><tr><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-left">Code</th><th className="px-3 py-2 text-right">Life</th><th className="px-3 py-2 text-left">Method</th><th className="px-3 py-2 text-right">Residual %</th><th className="px-3 py-2 text-center">Actions</th></tr></thead>
            <tbody>{(classes || []).length === 0 ? <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No asset classes defined.</td></tr> : (classes || []).map((c: any) => (
              <tr key={c.id} className="hover:bg-slate-50/50 border-b border-slate-50">
                <td className="px-3 py-2 font-medium">{c.name}</td>
                <td className="px-3 py-2 font-mono text-slate-500">{c.code || '-'}</td>
                <td className="px-3 py-2 text-right">{c.defaultUsefulLifeMonths || 0}m</td>
                <td className="px-3 py-2 capitalize">{c.defaultDepreciationMethod?.replace('_', ' ') || '-'}</td>
                <td className="px-3 py-2 text-right">{c.defaultResidualValuePct || 0}%</td>
                <td className="px-3 py-2 text-center">
                  <button onClick={() => { if (confirm('Delete this class?')) deleteMutation.mutate(c.id); }} className="p-1 rounded-lg hover:bg-slate-100 text-slate-300 hover:text-red-500"><X className="w-3 h-3" /></button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {showForm && <ClassFormModal onClose={() => setShowForm(false)} onComplete={() => { setShowForm(false); queryClient.invalidateQueries({ queryKey: ['asset-classes'] }); }} />}
    </div>
  );
}

function ClassFormModal({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const { data: accountsList } = useQuery({ queryKey: ['accounts'], queryFn: async () => { const res = await import('../../lib/api').then(m => m.api.get('/accounts')); return res.data; } });
  const [form, setForm] = useState({ name: '', code: '', description: '', defaultUsefulLifeMonths: 60, defaultDepreciationMethod: 'straight_line', defaultResidualValuePct: 0, glAssetAccountId: '', glDepreciationExpenseAccountId: '', glAccumDeprAccountId: '', glRevaluationReserveAccountId: '', glDisposalProceedsAccountId: '', glDisposalLossAccountId: '' });
  const mutation = useMutation({ mutationFn: () => fixedAssetsApi.createClass(form), onSuccess: onComplete });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold">New Asset Class</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs font-semibold text-slate-500">Name *</label><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1" /></div>
          <div><label className="text-xs font-semibold text-slate-500">Code</label><input type="text" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1" /></div>
          <div className="col-span-2"><label className="text-xs font-semibold text-slate-500">Description</label><input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1" /></div>
          <div><label className="text-xs font-semibold text-slate-500">Default Life (months)</label><input type="number" min="0" value={form.defaultUsefulLifeMonths} onChange={e => setForm({ ...form, defaultUsefulLifeMonths: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1" /></div>
          <div><label className="text-xs font-semibold text-slate-500">Depreciation Method</label><select value={form.defaultDepreciationMethod} onChange={e => setForm({ ...form, defaultDepreciationMethod: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1 bg-white">{methodOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
          <div><label className="text-xs font-semibold text-slate-500">Residual %</label><input type="number" min="0" max="100" value={form.defaultResidualValuePct} onChange={e => setForm({ ...form, defaultResidualValuePct: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl mt-1" /></div>
          <div className="col-span-2"><label className="text-xs font-semibold text-slate-500">Asset GL Account</label><AccountSearchSelect accounts={accountsList || []} value={form.glAssetAccountId} onChange={id => setForm({ ...form, glAssetAccountId: id })} /></div>
          <div><label className="text-xs font-semibold text-slate-500">Depr Expense Account</label><AccountSearchSelect accounts={accountsList || []} value={form.glDepreciationExpenseAccountId} onChange={id => setForm({ ...form, glDepreciationExpenseAccountId: id })} /></div>
          <div><label className="text-xs font-semibold text-slate-500">Accum Depr Account</label><AccountSearchSelect accounts={accountsList || []} value={form.glAccumDeprAccountId} onChange={id => setForm({ ...form, glAccumDeprAccountId: id })} /></div>
          <div><label className="text-xs font-semibold text-slate-500">Reval Reserve Account</label><AccountSearchSelect accounts={accountsList || []} value={form.glRevaluationReserveAccountId} onChange={id => setForm({ ...form, glRevaluationReserveAccountId: id })} /></div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200/80 rounded-xl">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={!form.name || mutation.isPending} className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl">{mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Create</button>
        </div>
      </div>
    </div>
  );
}

// ==============================
// IFRS REPORTS TAB
// ==============================

function ReportsTab() {
  const [reportType, setReportType] = useState<'register' | 'summary' | 'aging' | 'movement'>('summary');
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: summary, isLoading: sumLoading } = useQuery({
    queryKey: ['fa-summary'],
    queryFn: () => fixedAssetsApi.getAssetSummary(),
    enabled: reportType === 'summary',
  });
  const { data: register } = useQuery({
    queryKey: ['fa-register'],
    queryFn: () => fixedAssetsApi.getAssetRegister(),
    enabled: reportType === 'register',
  });
  const { data: aging } = useQuery({
    queryKey: ['fa-aging'],
    queryFn: () => fixedAssetsApi.getAssetAging(),
    enabled: reportType === 'aging',
  });
  const { data: movement } = useQuery({
    queryKey: ['fa-movement', fromDate, toDate],
    queryFn: () => fixedAssetsApi.getMovementSchedule(fromDate, toDate),
    enabled: reportType === 'movement',
  });

  const handlePrint = () => {
    if (!register) return;
    document.title = 'Fixed Asset Register';
    const rows = register.map((a: any) => `<tr><td>${a.assetNumber}</td><td>${a.name}</td><td>${a.category || '-'}</td><td class="r">${fmtNaira(a.purchaseCost)}</td><td class="r">${fmtNaira(a.accumulatedDepreciation)}</td><td class="r">${fmtNaira(a.bookValue)}</td><td class="r">${fmtNaira(a.revaluationAmount || 0)}</td><td>${a.status}</td></tr>`).join('');
    printWindow('Fixed Asset Register', `<h2>IFRS Fixed Asset Register</h2><table><thead><tr><th>Asset #</th><th>Name</th><th>Category</th><th class="r">Cost</th><th class="r">Depr</th><th class="r">NBV</th><th class="r">Reval</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`, '');
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3 flex items-center gap-3 flex-wrap">
        <button onClick={() => setReportType('summary')} className={`px-3 py-1.5 text-xs font-semibold rounded-xl ${reportType === 'summary' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Summary</button>
        <button onClick={() => setReportType('register')} className={`px-3 py-1.5 text-xs font-semibold rounded-xl ${reportType === 'register' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Register</button>
        <button onClick={() => setReportType('aging')} className={`px-3 py-1.5 text-xs font-semibold rounded-xl ${reportType === 'aging' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Aging</button>
        <button onClick={() => setReportType('movement')} className={`px-3 py-1.5 text-xs font-semibold rounded-xl ${reportType === 'movement' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Movement</button>
        {reportType === 'register' && <button onClick={handlePrint} className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-xl"><FileText className="w-3 h-3 inline mr-1" /> PDF</button>}
        {reportType === 'movement' && <><input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="px-2 py-1.5 text-xs border border-slate-200 rounded-xl" /><input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="px-2 py-1.5 text-xs border border-slate-200 rounded-xl" /></>}
      </div>

      {reportType === 'summary' && (
        sumLoading ? <PageLoader message="Loading summary..." /> : summary ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4"><p className="text-xs font-semibold text-slate-400 uppercase">Total Assets</p><p className="text-2xl font-bold mt-1">{summary.total_assets || 0}</p></div>
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4"><p className="text-xs font-semibold text-slate-400 uppercase">Active</p><p className="text-2xl font-bold text-emerald-700 mt-1">{summary.active_assets || 0}</p></div>
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4"><p className="text-xs font-semibold text-slate-400 uppercase">CWIP</p><p className="text-2xl font-bold text-amber-700 mt-1">{summary.cwip_assets || 0}</p></div>
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4"><p className="text-xs font-semibold text-slate-400 uppercase">Total Cost</p><p className="text-2xl font-bold mt-1">{fmtNaira(summary.total_cost || 0)}</p></div>
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4"><p className="text-xs font-semibold text-slate-400 uppercase">Total Depr</p><p className="text-2xl font-bold text-amber-700 mt-1">{fmtNaira(summary.total_depreciation || 0)}</p></div>
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4"><p className="text-xs font-semibold text-slate-400 uppercase">Total NBV</p><p className="text-2xl font-bold text-emerald-700 mt-1">{fmtNaira(summary.total_book_value || 0)}</p></div>
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4"><p className="text-xs font-semibold text-slate-400 uppercase">Revaluation</p><p className="text-2xl font-bold text-blue-700 mt-1">{fmtNaira(summary.total_revaluation || 0)}</p></div>
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4"><p className="text-xs font-semibold text-slate-400 uppercase">Impairment</p><p className="text-2xl font-bold text-red-700 mt-1">{fmtNaira(summary.total_impairment || 0)}</p></div>
          </div>
        ) : null
      )}

      {reportType === 'register' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
          <table className="w-full text-xs"><thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase"><tr><th className="px-3 py-2 text-left">Asset #</th><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-left">Category</th><th className="px-3 py-2 text-right">Cost</th><th className="px-3 py-2 text-right">Depr</th><th className="px-3 py-2 text-right">NBV</th><th className="px-3 py-2 text-right">Reval</th><th className="px-3 py-2 text-center">Status</th></tr></thead>
            <tbody>{(register || []).length === 0 ? <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-400">No assets.</td></tr> : (register || []).map((a: any) => (
              <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/50"><td className="px-3 py-2 font-mono">{a.assetNumber}</td><td className="px-3 py-2 font-medium">{a.name}</td><td className="px-3 py-2">{a.category || '-'}</td><td className="px-3 py-2 text-right">{fmtNaira(a.purchaseCost)}</td><td className="px-3 py-2 text-right">{fmtNaira(a.accumulatedDepreciation)}</td><td className="px-3 py-2 text-right font-semibold">{fmtNaira(a.bookValue)}</td><td className="px-3 py-2 text-right">{fmtNaira(a.revaluationAmount || 0)}</td><td className="px-3 py-2 text-center"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusBadge[a.status] || ''}`}>{a.status.replace('_', ' ')}</span></td></tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {reportType === 'aging' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-xs"><thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase"><tr><th className="px-3 py-2 text-left">Age Group</th><th className="px-3 py-2 text-right">Count</th><th className="px-3 py-2 text-right">Total Cost</th><th className="px-3 py-2 text-right">Total Depreciation</th><th className="px-3 py-2 text-right">Total NBV</th></tr></thead>
            <tbody>{(aging || []).length === 0 ? <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">No data.</td></tr> : (aging || []).map((g: any) => (
              <tr key={g.age_group} className="border-b border-slate-50"><td className="px-3 py-2 font-medium">{g.age_group}</td><td className="px-3 py-2 text-right">{g.count}</td><td className="px-3 py-2 text-right">{fmtNaira(g.total_cost)}</td><td className="px-3 py-2 text-right">{fmtNaira(g.total_depreciation)}</td><td className="px-3 py-2 text-right font-semibold">{fmtNaira(g.total_book_value)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {reportType === 'movement' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
          <table className="w-full text-xs"><thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase"><tr><th className="px-3 py-2 text-left">Asset #</th><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-right">Cost</th><th className="px-3 py-2 text-right">NBV</th><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Event</th></tr></thead>
            <tbody>{(movement || []).length === 0 ? <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No movements in this period.</td></tr> : (movement || []).map((m: any) => {
              let event = 'Purchase'; let date = m.purchaseDate;
              if (m.disposalDate) { event = 'Disposal'; date = m.disposalDate; }
              if (m.capitalizationDate) { event = 'Capitalization'; date = m.capitalizationDate; }
              return <tr key={m.id + event} className="border-b border-slate-50"><td className="px-3 py-2 font-mono">{m.assetNumber}</td><td className="px-3 py-2 font-medium">{m.name}</td><td className="px-3 py-2 text-right">{fmtNaira(m.purchaseCost)}</td><td className="px-3 py-2 text-right font-semibold">{fmtNaira(m.bookValue)}</td><td className="px-3 py-2">{fmtDate(date)}</td><td className="px-3 py-2"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${event === 'Purchase' ? 'bg-green-100 text-green-700' : event === 'Disposal' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{event}</span></td></tr>;
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
