/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Plus, X, Loader2, AlertCircle, Search, ShoppingCart,
  CheckCircle2, ArrowRight, Download, FileText, Upload,
  Eye, Edit2, Trash2
} from 'lucide-react';
import { CsvImportModal } from '../../components/ui/CsvImportModal';

interface Vendor { id: string; name: string; }
interface Item { id: string; name: string; purchasePrice: number | null; }
interface POLine {
  itemId: string | null; description: string;
  quantity: number; unitPrice: number; taxRate: number; accountId: string | null;
}
interface PO {
  id: string; poNumber: string; vendorId: string;
  date: string; expectedDate: string | null; status: string;
  subtotal: number; taxAmount: number; total: number; currency: string; notes: string | null;
  lines?: POLine[];
}

const EMPTY_LINE: POLine = { itemId: null, description: '', quantity: 1, unitPrice: 0, taxRate: 7.5, accountId: null };
const today = new Date().toISOString().split('T')[0];

function formatNaira(kobo: number) {
  return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}
function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function calcLine(l: POLine) {
  const base = l.quantity * l.unitPrice;
  const tax = Math.round(base * (l.taxRate / 100));
  return { base, tax, total: base + tax };
}


function exportPOsCSV(pos: PO[], vendorMap: Map<string,string>) {
  const headers = ['PO #','Vendor','Date','Expected','Status','Total'];
  const rows = pos.map(p => [p.poNumber, vendorMap.get(p.vendorId)||'', fmtDate(p.date), fmtDate(p.expectedDate), p.status, (p.total/100).toFixed(2)]);
  const csv = [headers,...rows].map(r=>r.map(v=>`"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`purchase-orders-${new Date().toISOString().split('T')[0]}.csv`; a.click(); URL.revokeObjectURL(url);
}

function exportPOsPDF(pos: PO[], vendorMap: Map<string,string>) {
  const rows = pos.map(p=>`<tr><td>${p.poNumber}</td><td>${vendorMap.get(p.vendorId)||'—'}</td><td>${fmtDate(p.date)}</td><td>${fmtDate(p.expectedDate)}</td><td>${p.status}</td><td style="text-align:right">${formatNaira(p.total)}</td></tr>`).join('');
  const total = pos.reduce((s,p)=>s+p.total,0);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Purchase Orders</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;color:#1e293b;padding:40px;font-size:13px}.header{display:flex;justify-content:space-between;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #0f172a}.company{font-size:22px;font-weight:800}.subtitle{font-size:11px;color:#64748b;margin-top:4px}.title{font-size:18px;font-weight:700;text-align:right}.date{font-size:11px;color:#64748b;margin-top:4px;text-align:right}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#0f172a;color:#fff;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase}td{padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px}tr:nth-child(even) td{background:#f8fafc}.total-row td{font-weight:700;background:#f1f5f9;border-top:2px solid #0f172a}.footer{margin-top:40px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px}@media print{body{padding:20px}}</style></head><body><div class="header"><div><div class="company">SkyBooks</div><div class="subtitle">By Skyhouse Accountants &amp; Technologies</div></div><div><div class="title">Purchase Orders</div><div class="date">Generated: ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</div></div></div><table><thead><tr><th>PO #</th><th>Vendor</th><th>Date</th><th>Expected</th><th>Status</th><th style="text-align:right">Total</th></tr></thead><tbody>${rows}</tbody><tfoot><tr class="total-row"><td colspan="5"><strong>Total (${pos.length} orders)</strong></td><td style="text-align:right">${formatNaira(total)}</td></tr></tfoot></table><div class="footer">SkyBooks By Skyhouse Accountants &amp; Technologies (Olalekan Williams Edun) &bull; Confidential</div></body></html>`;
  const w = window.open('','_blank'); if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),500);}
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-50 text-blue-700',
  received: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-rose-50 text-rose-500',
  billed: 'bg-violet-50 text-violet-700',
};

export function PurchaseOrdersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ vendorId: '', date: today, expectedDate: '', notes: '', lines: [{ ...EMPTY_LINE }] });
  const [formError, setFormError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [viewingPo, setViewingPo] = useState<PO | null>(null);
  const [editingPo, setEditingPo] = useState<PO | null>(null);

  const { data: posData, isLoading, isError } = useQuery({
    queryKey: ['purchase-orders', search],
    queryFn: async () => {
      const params: any = {};
      if (search) params.search = search;
      const r = await api.get('/purchases/orders', { params });
      return r.data;
    },
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ['vendors'],
    queryFn: async () => { const r = await api.get('/purchases/vendors'); return r.data; },
  });

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ['items'],
    queryFn: async () => { const r = await api.get('/inventory/items'); return r.data; },
  });

  const vendorMap = useMemo(() => new Map(vendors.map(v => [v.id, v.name])), [vendors]);
  const pos: PO[] = posData?.orders || posData?.purchaseOrders || [];

  const createMutation = useMutation({
    mutationFn: (p: any) => api.post('/purchases/orders', p),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }); closeModal(); showSuccess('Purchase order created.'); },
    onError: (e: any) => setFormError(e?.response?.data?.error || 'Failed to create PO.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/purchases/orders/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }); setEditingPo(null); closeModal(); showSuccess('Purchase order updated.'); },
    onError: (e: any) => setFormError(e?.response?.data?.error || 'Failed to update PO.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/purchases/orders/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }); showSuccess('Purchase order deleted.'); },
    onError: (e: any) => setFormError(e?.response?.data?.error || 'Failed to delete PO.'),
  });

  const convertMutation = useMutation({
    mutationFn: (id: string) => api.post(`/purchases/orders/${id}/convert-to-bill`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      showSuccess('PO converted to bill successfully.');
      setMenuOpen(null);
    },
    onError: (e: any) => alert(e?.response?.data?.error || 'Failed to convert PO.'),
  });

  function openView(po: PO) { setViewingPo(po); }

  function openEdit(po: PO) {
    setForm({
      vendorId: po.vendorId,
      date: po.date?.split('T')[0] || '',
      expectedDate: po.expectedDate?.split('T')[0] || '',
      notes: po.notes || '',
      lines: po.lines?.length ? po.lines.map((l: any) => ({
        itemId: l.itemId || '',
        description: l.description || '',
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        taxRate: l.taxRate,
        accountId: l.accountId || null,
      })) : [{ ...EMPTY_LINE }],
    });
    setEditingPo(po);
    setModalOpen(true);
  }

  function showSuccess(msg: string) { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 4000); }
  function closeModal() { setModalOpen(false); setEditingPo(null); setForm({ vendorId: '', date: today, expectedDate: '', notes: '', lines: [{ ...EMPTY_LINE }] }); setFormError(null); }

  function updateLine(idx: number, field: keyof POLine, value: any) {
    const nl = [...form.lines];
    nl[idx] = { ...nl[idx], [field]: value };
    setForm({ ...form, lines: nl });
  }

  function selectItem(idx: number, itemId: string) {
    const item = items.find(it => it.id === itemId);
    if (!item) return;
    const nl = [...form.lines];
    nl[idx] = { ...nl[idx], itemId, description: item.name, unitPrice: item.purchasePrice ?? 0 };
    setForm({ ...form, lines: nl });
  }

  const totals = useMemo(() => {
    let sub = 0, tax = 0;
    form.lines.forEach(l => { const c = calcLine(l); sub += c.base; tax += c.tax; });
    return { sub, tax, total: sub + tax };
  }, [form.lines]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vendorId) { setFormError('Please select a vendor.'); return; }
    const payload = {
      vendorId: form.vendorId,
      date: form.date,
      expectedDate: form.expectedDate || null,
      notes: form.notes || null,
      lines: form.lines.map(l => ({ ...l, unitPrice: Math.round(l.unitPrice * 100) })),
    };
    if (editingPo) {
      updateMutation.mutate({ id: editingPo.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Purchase Orders</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage procurement requests to vendors</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportPOsCSV(pos, vendorMap)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            <Download size={14} /> CSV
          </button>
          <button onClick={() => exportPOsPDF(pos, vendorMap)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            <FileText size={14} /> PDF
          </button>
          <button onClick={() => setImportOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            <Upload size={14} /> Import CSV
          </button>
          <button onClick={() => { setModalOpen(true); setFormError(null); }} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">
            <Plus size={15} /> New Purchase Order
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          <CheckCircle2 size={16} /> {successMsg}
        </div>
      )}

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search orders..." className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 bg-white border border-slate-200 rounded-xl">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading orders...
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center py-16 text-rose-500 gap-2 bg-white border border-slate-200 rounded-xl">
          <AlertCircle size={18} /> Failed to load purchase orders.
        </div>
      ) : pos.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
          <ShoppingCart size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">No purchase orders yet</p>
          <p className="text-xs text-slate-400 mt-1">Create your first PO to begin procurement tracking</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide border-b border-slate-200">
                <th className="py-3 pl-4 pr-2 text-left">PO #</th>
                <th className="py-3 px-2 text-left">Vendor</th>
                <th className="py-3 px-2 text-left">Date</th>
                <th className="py-3 px-2 text-left">Expected</th>
                <th className="py-3 px-2 text-left">Status</th>
                <th className="py-3 px-2 text-right">Total</th>
                <th className="py-3 pl-2 pr-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pos.map(po => (
                <tr key={po.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 pl-4 pr-2 font-mono text-xs font-medium text-slate-700">{po.poNumber}</td>
                  <td className="py-3 px-2 font-medium text-slate-900">{vendorMap.get(po.vendorId) || '—'}</td>
                  <td className="py-3 px-2 text-xs text-slate-500">{fmtDate(po.date)}</td>
                  <td className="py-3 px-2 text-xs text-slate-500">{fmtDate(po.expectedDate)}</td>
                  <td className="py-3 px-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[po.status] || 'bg-slate-100 text-slate-500'}`}>
                      {po.status}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-slate-900">{formatNaira(po.total)}</td>
                  <td className="py-3 pl-2 pr-4">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openView(po)} className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100" title="View">
                        <Eye size={14} />
                      </button>
                      <button onClick={() => openEdit(po)} className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" title="Edit">
                        <Edit2 size={14} />
                      </button>
                      {po.status === 'draft' && (
                        <button onClick={() => { if (window.confirm('Delete this purchase order?')) deleteMutation.mutate(po.id); }} className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Delete" disabled={deleteMutation.isPending}>
                          <Trash2 size={14} />
                        </button>
                      )}
                      {(po.status === 'sent' || po.status === 'received') && (
                        <button onClick={() => convertMutation.mutate(po.id)} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-md transition-colors">
                          <ArrowRight size={11} /> To Bill
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {/* View Detail */}
      {viewingPo && (
        <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setViewingPo(null)} />
      )}
      {viewingPo && (
        <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">Purchase Order Details</h2>
            <button onClick={() => setViewingPo(null)} className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100">
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <div className="space-y-6">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-mono text-sm font-semibold text-slate-700">{viewingPo.poNumber}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{fmtDate(viewingPo.date)}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[viewingPo.status] || 'bg-slate-100 text-slate-500'}`}>{viewingPo.status}</span>
                </div>
                <div className="text-sm">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Vendor</p>
                  <p className="font-medium text-slate-800">{vendorMap.get(viewingPo.vendorId) || viewingPo.vendorId}</p>
                </div>
                {viewingPo.expectedDate && (
                  <div className="text-sm mt-3">
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Expected Delivery</p>
                    <p className="text-slate-700">{fmtDate(viewingPo.expectedDate)}</p>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-1 text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span className="font-mono">{formatNaira(viewingPo.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>VAT</span>
                  <span className="font-mono">{formatNaira(viewingPo.taxAmount)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-100">
                  <span>Total</span>
                  <span className="font-mono">{formatNaira(viewingPo.total)}</span>
                </div>
              </div>

              {viewingPo.notes && (
                <div className="text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-0.5">Notes</p>
                  {viewingPo.notes}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 px-4 py-8 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">{editingPo ? 'Edit Purchase Order' : 'New Purchase Order'}</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              {formError && (
                <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 flex items-center gap-2">
                  <AlertCircle size={14} /> {formError}
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Vendor *</label>
                  <select value={form.vendorId} onChange={e => setForm({ ...form, vendorId: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
                    <option value="">Select vendor...</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Order Date</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Expected Delivery</label>
                  <input type="date" value={form.expectedDate} onChange={e => setForm({ ...form, expectedDate: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-2">Line Items</label>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide">
                        <th className="py-2.5 pl-3 pr-2 text-left w-44">Item</th>
                        <th className="py-2.5 px-2 text-left">Description</th>
                        <th className="py-2.5 px-2 text-center w-14">Qty</th>
                        <th className="py-2.5 px-2 text-right w-32">Unit Price (₦)</th>
                        <th className="py-2.5 px-2 text-center w-14">VAT %</th>
                        <th className="py-2.5 px-2 text-right w-28">Amount</th>
                        <th className="py-2.5 pl-2 pr-3 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {form.lines.map((line, idx) => {
                        const c = calcLine(line);
                        return (
                          <tr key={idx}>
                            <td className="py-2 pl-3 pr-2">
                              <select value={line.itemId || ''} onChange={e => e.target.value ? selectItem(idx, e.target.value) : updateLine(idx, 'itemId', null)} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none bg-white">
                                <option value="">— Custom —</option>
                                {items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                              </select>
                            </td>
                            <td className="py-2 px-2"><input value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)} placeholder="Description" className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none" /></td>
                            <td className="py-2 px-2"><input type="number" min="1" value={line.quantity} onChange={e => updateLine(idx, 'quantity', parseFloat(e.target.value) || 1)} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded text-center focus:outline-none" /></td>
                            <td className="py-2 px-2"><input type="number" min="0" step="0.01" value={line.unitPrice || ''} onChange={e => updateLine(idx, 'unitPrice', parseFloat(e.target.value) || 0)} placeholder="0.00" className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded text-right focus:outline-none" /></td>
                            <td className="py-2 px-2"><input type="number" min="0" max="100" step="0.1" value={line.taxRate} onChange={e => updateLine(idx, 'taxRate', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded text-center focus:outline-none" /></td>
                            <td className="py-2 px-2 text-right text-xs font-mono font-medium text-slate-900">₦{c.total.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                            <td className="py-2 pl-2 pr-3">
                              <button type="button" onClick={() => { if (form.lines.length > 1) setForm({ ...form, lines: form.lines.filter((_, i) => i !== idx) }); }} disabled={form.lines.length === 1} className="text-slate-300 hover:text-rose-500 disabled:opacity-20"><X size={14} /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="px-3 py-2 border-t border-slate-100 bg-slate-50">
                    <button type="button" onClick={() => setForm({ ...form, lines: [...form.lines, { ...EMPTY_LINE }] })} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                      <Plus size={13} /> Add Line
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none resize-none" />
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2">
                  <div className="flex justify-between text-sm text-slate-500"><span>Subtotal</span><span className="font-mono">₦{totals.sub.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between text-sm text-slate-500"><span>VAT</span><span className="font-mono">₦{totals.tax.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between pt-2 border-t border-slate-200"><span className="font-bold text-slate-800">Total</span><span className="font-black text-slate-900 font-mono">₦{totals.total.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span></div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="px-5 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2">
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 size={14} className="animate-spin" />}
                  {editingPo ? 'Save Changes' : 'Create PO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {importOpen && (
        <CsvImportModal
          entity="purchaseOrders"
          endpoint="/purchases/orders"
          onClose={() => setImportOpen(false)}
          onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }); }}
          transformRow={(row, headers) => ({
            vendorId: row[headers.indexOf('vendorId (or name)')] || '',
            date: row[headers.indexOf('date (YYYY-MM-DD)')] || '',
            expectedDate: row[headers.indexOf('expectedDate')] || null,
            notes: row[headers.indexOf('notes')] || null,
            lines: row[headers.indexOf('line_description')] ? [{
              description: row[headers.indexOf('line_description')],
              quantity: parseFloat(row[headers.indexOf('line_quantity')]) || 1,
              unitPrice: Math.round(parseFloat(row[headers.indexOf('line_unitPrice (NGN)')]) * 100) || 0,
              taxRate: parseFloat(row[headers.indexOf('line_taxRate')]) || 0,
            }] : [],
          })}
        />
      )}
    </div>
  );
}
