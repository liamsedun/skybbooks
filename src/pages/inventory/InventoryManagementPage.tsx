import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '../../lib/api';
import {
  Plus, X, Loader2, CheckCircle2, Clock,
  Truck, ClipboardList, FileX, Anchor, BarChart3,
} from 'lucide-react';

const fmtNaira = (v: number | string | null | undefined) => {
  const n = Number(v ?? 0);
  return '₦' + Math.abs(n / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

type Tab = 'transfers' | 'stock-counts' | 'writeoffs' | 'landed-costs' | 'reports';

function Modal({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: React.ReactNode; title: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6 z-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const tabLabels: Record<Tab, string> = { transfers: 'Transfer', 'stock-counts': 'Stock Count', writeoffs: 'Write-off', 'landed-costs': 'Landed Cost', reports: '' };

export default function InventoryManagementPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('transfers');
  const [showNewModal, setShowNewModal] = useState(false);
  const [createType, setCreateType] = useState<Tab>('transfers');

  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');

  const [countDate, setCountDate] = useState(new Date().toISOString().split('T')[0]);
  const [countLocation, setCountLocation] = useState('');

  const [woDate, setWoDate] = useState(new Date().toISOString().split('T')[0]);
  const [woReason, setWoReason] = useState('');
  const [woAccountId, setWoAccountId] = useState('');

  const [lcDate, setLcDate] = useState(new Date().toISOString().split('T')[0]);
  const [lcDescription, setLcDescription] = useState('');
  const [lcAmount, setLcAmount] = useState(0);
  const [lcAllocMethod, setLcAllocMethod] = useState<'by_value' | 'by_quantity' | 'by_weight'>('by_value');

  const [msg, setMsg] = useState('');

  const { data: transfers, isLoading: loadingTransfers } = useQuery<any[]>({
    queryKey: ['inventory', 'transfers'],
    queryFn: inventoryApi.getTransfers,
    enabled: tab === 'transfers',
  });

  const { data: stockCounts, isLoading: loadingCounts } = useQuery<any[]>({
    queryKey: ['inventory', 'stock-counts'],
    queryFn: inventoryApi.getStockCounts,
    enabled: tab === 'stock-counts',
  });

  const { data: writeoffs, isLoading: loadingWriteoffs } = useQuery<any[]>({
    queryKey: ['inventory', 'writeoffs'],
    queryFn: inventoryApi.getWriteoffs,
    enabled: tab === 'writeoffs',
  });

  const { data: landedCosts, isLoading: loadingLanded } = useQuery<any[]>({
    queryKey: ['inventory', 'landed-costs'],
    queryFn: inventoryApi.getLandedCosts,
    enabled: tab === 'landed-costs',
  });

  const { data: valuation } = useQuery<any[]>({
    queryKey: ['inventory', 'valuation'],
    queryFn: () => inventoryApi.getValuation(),
    enabled: tab === 'reports',
  });

  const { data: aging } = useQuery<any[]>({
    queryKey: ['inventory', 'aging'],
    queryFn: inventoryApi.getAging,
    enabled: tab === 'reports',
  });

  const { data: stockStatus } = useQuery<any[]>({
    queryKey: ['inventory', 'stock-status'],
    queryFn: inventoryApi.getStockStatus,
    enabled: tab === 'reports',
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
  };

  const createTransferMut = useMutation({
    mutationFn: (data: any) => inventoryApi.createTransfer(data),
    onSuccess: () => { invalidate(); setShowNewModal(false); setMsg('Transfer created'); },
    onError: (err: any) => setMsg(err?.response?.data?.error || 'Failed'),
  });

  const createStockCountMut = useMutation({
    mutationFn: (data: any) => inventoryApi.createStockCount(data),
    onSuccess: () => { invalidate(); setShowNewModal(false); setMsg('Stock count created'); },
    onError: (err: any) => setMsg(err?.response?.data?.error || 'Failed'),
  });

  const applyStockCountMut = useMutation({
    mutationFn: (id: string) => inventoryApi.applyStockCount(id),
    onSuccess: () => { invalidate(); setMsg('Stock count applied'); },
    onError: (err: any) => setMsg(err?.response?.data?.error || 'Failed'),
  });

  const createWriteoffMut = useMutation({
    mutationFn: (data: any) => inventoryApi.createWriteoff(data),
    onSuccess: () => { invalidate(); setShowNewModal(false); setMsg('Write-off created'); },
    onError: (err: any) => setMsg(err?.response?.data?.error || 'Failed'),
  });

  const postWriteoffMut = useMutation({
    mutationFn: (id: string) => inventoryApi.postWriteoff(id),
    onSuccess: () => { invalidate(); setMsg('Write-off posted to GL'); },
    onError: (err: any) => setMsg(err?.response?.data?.error || 'Failed'),
  });

  const createLandedCostMut = useMutation({
    mutationFn: (data: any) => inventoryApi.createLandedCost(data),
    onSuccess: () => { invalidate(); setShowNewModal(false); setMsg('Landed cost created'); },
    onError: (err: any) => setMsg(err?.response?.data?.error || 'Failed'),
  });

  const allocateLandedCostMut = useMutation({
    mutationFn: (id: string) => inventoryApi.allocateLandedCost(id),
    onSuccess: () => { invalidate(); setMsg('Landed cost allocated'); },
    onError: (err: any) => setMsg(err?.response?.data?.error || 'Failed'),
  });

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'transfers', label: 'Transfers', icon: <Truck size={16} /> },
    { key: 'stock-counts', label: 'Stock Counts', icon: <ClipboardList size={16} /> },
    { key: 'writeoffs', label: 'Write-offs', icon: <FileX size={16} /> },
    { key: 'landed-costs', label: 'Landed Costs', icon: <Anchor size={16} /> },
    { key: 'reports', label: 'Valuation Reports', icon: <BarChart3 size={16} /> },
  ];

  const renderTable = (cols: string[], rows: (any[] | null), loading: boolean, emptyMsg: string) => (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>{cols.map((c, i) => <th key={i} className={`text-${i === 0 || c === 'Reason' || c === 'Description' ? 'left' : /^(Items|Amount|Total)$/.test(c) ? 'right' : 'center'} px-4 py-3 font-medium text-gray-600`}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={cols.length} className="text-center py-8 text-gray-400"><Loader2 size={20} className="inline animate-spin" /> Loading...</td></tr>
          ) : !rows?.length ? (
            <tr><td colSpan={cols.length} className="text-center py-8 text-gray-400">{emptyMsg}</td></tr>
          ) : rows.map((row: any, idx: number) => (
            <tr key={row.id ?? idx} className="border-b border-gray-100 hover:bg-gray-50">
              {row.cells.map((cell: any, ci: number) => <td key={ci} className={`px-4 py-3 ${typeof cell === 'object' ? cell.className : ''}`}>{typeof cell === 'object' ? cell.content : cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-sm text-gray-500 mt-1">Transfers, stock counts, write-offs, landed costs & valuation</p>
        </div>
        {tab !== 'reports' && (
          <button onClick={() => { setShowNewModal(true); setCreateType(tab); }} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors">
            <Plus size={18} /> New {tabLabels[tab]}
          </button>
        )}
      </div>

      {msg && (
        <div className="mb-4 px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-sm flex items-center justify-between">
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="ml-2 hover:bg-indigo-100 rounded p-0.5"><X size={14} /></button>
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}>{t.icon}{t.label}</button>
        ))}
      </div>

      {tab === 'transfers' && renderTable(
        ['Date', 'From', 'To', 'Items', 'By'],
        transfers?.map((t: any) => ({ id: t.id, cells: [fmtDate(t.date), t.fromLocation || '—', t.toLocation || '—', { content: (t.itemCount ?? t.items?.length ?? 0).toString(), className: 'text-right' }, t.createdByName || '—'] })) ?? null,
        loadingTransfers, 'No transfers yet'
      )}

      {tab === 'stock-counts' && (
        <div>
          {renderTable(
            ['Date', 'Location', 'Items', 'Status', 'Actions'],
            stockCounts?.map((sc: any) => ({
              id: sc.id,
              cells: [
                fmtDate(sc.date),
                sc.location || '—',
                { content: (sc.itemCount ?? sc.items?.length ?? 0).toString(), className: 'text-right' },
                { content: sc.status === 'applied'
                  ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700"><CheckCircle2 size={12} /> Applied</span>
                  : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700"><Clock size={12} /> Draft</span>,
                  className: 'text-center' },
                sc.status !== 'applied'
                  ? <button onClick={() => applyStockCountMut.mutate(sc.id)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Apply</button>
                  : '—',
              ],
            })) ?? null,
            loadingCounts, 'No stock counts yet'
          )}
        </div>
      )}

      {tab === 'writeoffs' && (
        <div>
          {renderTable(
            ['Date', 'Reason', 'Items', 'Total', 'Status', 'Actions'],
            writeoffs?.map((wo: any) => ({
              id: wo.id,
              cells: [
                fmtDate(wo.date),
                { content: wo.reason || '—', className: 'max-w-[200px] truncate' },
                { content: (wo.itemCount ?? wo.items?.length ?? 0).toString(), className: 'text-right' },
                { content: fmtNaira(wo.totalAmount ?? wo.totalCost ?? 0), className: 'text-right font-medium' },
                { content: wo.status === 'posted'
                  ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700"><CheckCircle2 size={12} /> Posted</span>
                  : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700"><Clock size={12} /> Draft</span>,
                  className: 'text-center' },
                wo.status !== 'posted'
                  ? <button onClick={() => postWriteoffMut.mutate(wo.id)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Post to GL</button>
                  : '—',
              ],
            })) ?? null,
            loadingWriteoffs, 'No write-offs yet'
          )}
        </div>
      )}

      {tab === 'landed-costs' && (
        <div>
          {renderTable(
            ['Date', 'Description', 'Amount', 'Method', 'Status', 'Actions'],
            landedCosts?.map((lc: any) => ({
              id: lc.id,
              cells: [
                fmtDate(lc.date),
                { content: lc.description || '—', className: 'max-w-[250px] truncate' },
                { content: fmtNaira(lc.amount), className: 'text-right font-medium' },
                { content: lc.allocationMethod?.replace('_', ' ') || '—', className: 'capitalize' },
                { content: lc.status === 'allocated'
                  ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700"><CheckCircle2 size={12} /> Allocated</span>
                  : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700"><Clock size={12} /> Pending</span>,
                  className: 'text-center' },
                lc.status !== 'allocated'
                  ? <button onClick={() => allocateLandedCostMut.mutate(lc.id)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Allocate</button>
                  : '—',
              ],
            })) ?? null,
            loadingLanded, 'No landed costs yet'
          )}
        </div>
      )}

      {tab === 'reports' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Inventory Valuation</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200">
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Item</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Qty</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Unit Cost</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Total Value</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Method</th>
                </tr></thead>
                <tbody>
                  {valuation?.map((v: any) => (
                    <tr key={v.itemId ?? v.id} className="border-b border-gray-100">
                      <td className="px-3 py-2">{v.itemName ?? v.name}</td>
                      <td className="px-3 py-2 text-right">{Number(v.quantity ?? v.totalQuantity ?? 0).toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{fmtNaira(v.unitCost ?? v.averageCost ?? 0)}</td>
                      <td className="px-3 py-2 text-right font-medium">{fmtNaira(v.totalValue ?? v.totalAmount ?? 0)}</td>
                      <td className="px-3 py-2 capitalize">{v.costingMethod || 'fifo'}</td>
                    </tr>
                  )) || <tr><td colSpan={5} className="text-center py-4 text-gray-400">No data</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Inventory Aging</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200">
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Item</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">0–30 days</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">31–60 days</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">61–90 days</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">90+ days</th>
                </tr></thead>
                <tbody>
                  {aging?.map((a: any) => (
                    <tr key={a.itemId ?? a.id} className="border-b border-gray-100">
                      <td className="px-3 py-2">{a.itemName ?? a.name}</td>
                      <td className="px-3 py-2 text-right">{Number(a.bucket0_30 ?? a['0-30'] ?? 0).toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{Number(a.bucket31_60 ?? a['31-60'] ?? 0).toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{Number(a.bucket61_90 ?? a['61-90'] ?? 0).toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{Number(a.bucket90Plus ?? a['90+'] ?? 0).toLocaleString()}</td>
                    </tr>
                  )) || <tr><td colSpan={5} className="text-center py-4 text-gray-400">No data</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Stock Status Summary</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200">
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Item</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">On Hand</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Min</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Max</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Reorder</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Status</th>
                </tr></thead>
                <tbody>
                  {stockStatus?.map((s: any) => {
                    const qty = Number(s.quantity ?? s.onHand ?? 0);
                    const min = Number(s.minStockLevel ?? 0);
                    const max = Number(s.maxStockLevel ?? 0);
                    const reorder = Number(s.reorderQuantity ?? 0);
                    const isLow = min > 0 && qty <= min;
                    const isOver = max > 0 && qty >= max;
                    return (
                      <tr key={s.itemId ?? s.id} className="border-b border-gray-100">
                        <td className="px-3 py-2">{s.itemName ?? s.name}</td>
                        <td className="px-3 py-2 text-right">{qty.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">{min.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">{max.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">{reorder.toLocaleString()}</td>
                        <td className="px-3 py-2">
                          {isLow ? <span className="text-red-600 font-medium text-xs">Low Stock</span>
                            : isOver ? <span className="text-amber-600 font-medium text-xs">Overstocked</span>
                            : <span className="text-emerald-600 font-medium text-xs">OK</span>}
                        </td>
                      </tr>
                    );
                  }) || <tr><td colSpan={6} className="text-center py-4 text-gray-400">No data</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <Modal open={showNewModal && tab !== 'reports'} onClose={() => setShowNewModal(false)} title={`New ${tabLabels[createType]}`}>
        {createType === 'transfers' && (
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Date</label><input type="date" value={transferDate} onChange={e => setTransferDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">From Location</label><input type="text" value={fromLocation} onChange={e => setFromLocation(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">To Location</label><input type="text" value={toLocation} onChange={e => setToLocation(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
              <button onClick={() => setShowNewModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={() => createTransferMut.mutate({ date: transferDate, fromLocation, toLocation })} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Create Transfer</button>
            </div>
          </div>
        )}
        {createType === 'stock-counts' && (
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Date</label><input type="date" value={countDate} onChange={e => setCountDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Location</label><input type="text" value={countLocation} onChange={e => setCountLocation(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
              <button onClick={() => setShowNewModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={() => createStockCountMut.mutate({ date: countDate, location: countLocation })} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Create Stock Count</button>
            </div>
          </div>
        )}
        {createType === 'writeoffs' && (
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Date</label><input type="date" value={woDate} onChange={e => setWoDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Reason</label><input type="text" value={woReason} onChange={e => setWoReason(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Write-off GL Account ID (optional)</label><input type="text" value={woAccountId} onChange={e => setWoAccountId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
              <button onClick={() => setShowNewModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={() => createWriteoffMut.mutate({ date: woDate, reason: woReason, writeoffAccountId: woAccountId || undefined })} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Create Write-off</button>
            </div>
          </div>
        )}
        {createType === 'landed-costs' && (
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Date</label><input type="date" value={lcDate} onChange={e => setLcDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><input type="text" value={lcDescription} onChange={e => setLcDescription(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Amount (kobo)</label><input type="number" value={lcAmount} onChange={e => setLcAmount(Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Allocation Method</label>
              <select value={lcAllocMethod} onChange={e => setLcAllocMethod(e.target.value as any)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="by_value">By Value</option><option value="by_quantity">By Quantity</option><option value="by_weight">By Weight</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
              <button onClick={() => setShowNewModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={() => createLandedCostMut.mutate({ date: lcDate, description: lcDescription, amount: lcAmount, allocationMethod: lcAllocMethod })} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Create Landed Cost</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
