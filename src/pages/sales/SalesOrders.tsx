/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Plus, Search, Pencil, Trash2, X, Loader2, AlertCircle,
  ShoppingCart, CheckCircle2, Clock, XCircle, ArrowRight,
  Package, Truck,
} from 'lucide-react';

type SOStatus = 'draft' | 'confirmed' | 'partial' | 'fulfilled' | 'cancelled';

interface Customer { id: string; name: string; email: string | null; }
interface Item { id: string; name: string; sku: string | null; salesPrice: number | null; type: string; }
interface SOLine {
  itemId: string | null; description: string; quantity: number;
  unitPrice: number; discountPct: number; taxRate: number;
}
interface SalesOrder {
  id: string; orgId: string; soNumber: string; customerId: string;
  quoteId: string | null; date: string; expectedDelivery: string | null;
  status: SOStatus; currency: string; subtotal: number; discount: number;
  tax: number; total: number; notes: string | null; lines: SOLine[];
  createdAt: string;
}

type SOFormState = {
  customerId: string; date: string; expectedDelivery: string;
  status: SOStatus; notes: string;
  lines: { itemId: string; description: string; quantity: string; unitPrice: string; discountPct: string; taxRate: string; }[];
};

const EMPTY_LINE = { itemId: '', description: '', quantity: '1', unitPrice: '', discountPct: '0', taxRate: '7.5' };
const EMPTY_FORM: SOFormState = {
  customerId: '', date: new Date().toISOString().split('T')[0],
  expectedDelivery: '', status: 'draft', notes: '', lines: [{ ...EMPTY_LINE }],
};

const STATUS_META: Record<SOStatus, { label: string; color: string; bg: string; icon: React.ComponentType<{ className?: string }> }> = {
  draft:     { label: 'Draft',     color: 'text-slate-600',   bg: 'bg-slate-100',  icon: ShoppingCart },
  confirmed: { label: 'Confirmed', color: 'text-blue-700',    bg: 'bg-blue-50',    icon: CheckCircle2 },
  partial:   { label: 'Partial',   color: 'text-amber-700',   bg: 'bg-amber-50',   icon: Clock },
  fulfilled: { label: 'Fulfilled', color: 'text-emerald-700', bg: 'bg-emerald-50', icon: Truck },
  cancelled: { label: 'Cancelled', color: 'text-rose-700',    bg: 'bg-rose-50',    icon: XCircle },
};

function formatNaira(kobo: number | null | undefined): string {
  if (kobo == null) return '—';
  return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function calcLine(l: SOFormState['lines'][0]) {
  const qty = parseFloat(l.quantity) || 0;
  const price = parseFloat(l.unitPrice) || 0;
  const disc = parseFloat(l.discountPct) || 0;
  const tax = parseFloat(l.taxRate) || 0;
  const base = qty * price;
  const afterDisc = base * (1 - disc / 100);
  return afterDisc * (1 + tax / 100);
}

function buildPayload(form: SOFormState) {
  const lines = form.lines.map(l => ({
    itemId: l.itemId || null,
    description: l.description,
    quantity: parseFloat(l.quantity) || 1,
    unitPrice: Math.round((parseFloat(l.unitPrice) || 0) * 100),
    discountPct: parseFloat(l.discountPct) || 0,
    taxRate: parseFloat(l.taxRate) || 7.5,
  }));
  const subtotalNaira = form.lines.reduce((s, l) => {
    const qty = parseFloat(l.quantity) || 0;
    const price = parseFloat(l.unitPrice) || 0;
    const disc = parseFloat(l.discountPct) || 0;
    return s + qty * price * (1 - disc / 100);
  }, 0);
  const taxNaira = form.lines.reduce((s, l) => {
    const qty = parseFloat(l.quantity) || 0;
    const price = parseFloat(l.unitPrice) || 0;
    const disc = parseFloat(l.discountPct) || 0;
    const tax = parseFloat(l.taxRate) || 0;
    return s + qty * price * (1 - disc / 100) * (tax / 100);
  }, 0);
  const subtotal = Math.round(subtotalNaira * 100);
  const tax = Math.round(taxNaira * 100);
  return {
    customerId: form.customerId,
    date: form.date || undefined,
    expectedDelivery: form.expectedDelivery || null,
    status: form.status,
    subtotal,
    discount: 0,
    tax,
    total: subtotal + tax,
    notes: form.notes.trim() || null,
    lines,
  };
}

function formFromSO(so: SalesOrder): SOFormState {
  return {
    customerId: so.customerId,
    date: so.date ? so.date.split('T')[0] : '',
    expectedDelivery: so.expectedDelivery ? so.expectedDelivery.split('T')[0] : '',
    status: so.status,
    notes: so.notes || '',
    lines: (so.lines || []).length > 0 ? so.lines.map(l => ({
      itemId: l.itemId || '',
      description: l.description,
      quantity: l.quantity.toString(),
      unitPrice: (l.unitPrice / 100).toString(),
      discountPct: (l.discountPct || 0).toString(),
      taxRate: (l.taxRate || 7.5).toString(),
    })) : [{ ...EMPTY_LINE }],
  };
}

export function SalesOrdersPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SOStatus>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SOFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SalesOrder | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [convertSuccess, setConvertSuccess] = useState<string | null>(null);

  const { data: soData, isLoading, isError } = useQuery<SalesOrder[]>({
    queryKey: ['sales', 'sales-orders'],
    queryFn: async () => { const r = await api.get('/sales/sales-orders'); return r.data; },
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ['sales', 'customers'],
    queryFn: async () => { const r = await api.get('/sales/customers'); return r.data; },
  });

  const { data: items } = useQuery<Item[]>({
    queryKey: ['inventory', 'items'],
    queryFn: async () => { const r = await api.get('/inventory/items'); return r.data; },
  });

  const customerMap = useMemo(() => {
    const m = new Map<string, Customer>();
    (customers || []).forEach(c => m.set(c.id, c));
    return m;
  }, [customers]);

  const createMutation = useMutation({
    mutationFn: (p: any) => api.post('/sales/sales-orders', p),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sales', 'sales-orders'] }); closeModal(); },
    onError: (e: any) => setFormError(e?.response?.data?.error || 'Failed to create sales order.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, p }: { id: string; p: any }) => api.patch(`/sales/sales-orders/${id}`, p),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sales', 'sales-orders'] }); closeModal(); },
    onError: (e: any) => setFormError(e?.response?.data?.error || 'Failed to update sales order.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sales/sales-orders/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sales', 'sales-orders'] }); setDeleteTarget(null); setDeleteError(null); },
    onError: (e: any) => setDeleteError(e?.response?.data?.error || 'Failed to delete sales order.'),
  });

  const convertMutation = useMutation({
    mutationFn: (id: string) => api.post(`/sales/sales-orders/${id}/convert`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setConvertingId(null);
      setConvertSuccess(`Converted to ${res.data?.invoice?.invoiceNumber || 'invoice'} successfully.`);
      setTimeout(() => setConvertSuccess(null), 4000);
    },
    onError: (e: any) => { setConvertingId(null); alert(e?.response?.data?.error || 'Conversion failed.'); },
  });

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return (soData || []).filter(so => {
      if (statusFilter !== 'all' && so.status !== statusFilter) return false;
      if (!term) return true;
      const cust = customerMap.get(so.customerId);
      return so.soNumber.toLowerCase().includes(term) || (cust?.name || '').toLowerCase().includes(term);
    });
  }, [soData, searchTerm, statusFilter, customerMap]);

  const counts = useMemo(() => {
    const all = soData?.length || 0;
    const byStatus: Record<string, number> = {};
    (soData || []).forEach(so => { byStatus[so.status] = (byStatus[so.status] || 0) + 1; });
    return { all, byStatus };
  }, [soData]);

  function openAddModal() { setForm(EMPTY_FORM); setEditingId(null); setFormError(null); setModalOpen(true); }
  function openEditModal(so: SalesOrder) { setForm(formFromSO(so)); setEditingId(so.id); setFormError(null); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditingId(null); setFormError(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customerId) { setFormError('Please select a customer.'); return; }
    if (form.lines.some(l => !l.description.trim())) { setFormError('All line items need a description.'); return; }
    const p = buildPayload(form);
    if (editingId) updateMutation.mutate({ id: editingId, p });
    else createMutation.mutate(p);
  }

  function setLine(idx: number, field: string, val: string) {
    setForm(prev => {
      const lines = [...prev.lines];
      lines[idx] = { ...lines[idx], [field]: val };
      return { ...prev, lines };
    });
  }

  function addLine() { setForm(prev => ({ ...prev, lines: [...prev.lines, { ...EMPTY_LINE }] })); }
  function removeLine(idx: number) { setForm(prev => ({ ...prev, lines: prev.lines.filter((_, i) => i !== idx) })); }

  function handleItemSelect(idx: number, itemId: string) {
    const item = (items || []).find(i => i.id === itemId);
    if (!item) return;
    setForm(prev => {
      const lines = [...prev.lines];
      lines[idx] = {
        ...lines[idx],
        itemId,
        description: item.name,
        unitPrice: item.salesPrice != null ? (item.salesPrice / 100).toString() : '',
      };
      return { ...prev, lines };
    });
  }

  const previewTotal = form.lines.reduce((s, l) => s + calcLine(l), 0);
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales Orders</h1>
          <p className="text-sm text-slate-500 mt-1">
            {counts.all} orders · {counts.byStatus['confirmed'] || 0} confirmed · {counts.byStatus['fulfilled'] || 0} fulfilled
          </p>
        </div>
        <button onClick={openAddModal} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">
          <Plus size={16} />New Order
        </button>
      </div>

      {convertSuccess && (
        <div className="mb-4 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3">
          <CheckCircle2 size={16} />{convertSuccess}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {(['all', 'draft', 'confirmed', 'partial', 'fulfilled', 'cancelled'] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              statusFilter === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}>
            {s === 'all' ? `All (${counts.all})` : `${STATUS_META[s].label} (${counts.byStatus[s] || 0})`}
          </button>
        ))}
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search by order number or customer..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" />Loading sales orders...
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center gap-2 py-16 text-rose-500 text-sm">
            <AlertCircle size={16} />Failed to load sales orders.
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <ShoppingCart size={28} className="text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-600">No sales orders yet</p>
            <p className="text-xs text-slate-400 mt-1">Create your first sales order to track fulfilment.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
                <th className="py-2.5 pl-4 pr-3">Order #</th>
                <th className="py-2.5 pr-3">Customer</th>
                <th className="py-2.5 pr-3">Date</th>
                <th className="py-2.5 pr-3">Expected Delivery</th>
                <th className="py-2.5 pr-3">Total</th>
                <th className="py-2.5 pr-3">Status</th>
                <th className="py-2.5 pr-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(so => {
                const meta = STATUS_META[so.status];
                const Icon = meta.icon;
                const cust = customerMap.get(so.customerId);
                return (
                  <tr key={so.id} className="group hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 pl-4 pr-3 font-mono text-sm font-semibold text-slate-700">{so.soNumber}</td>
                    <td className="py-2.5 pr-3">
                      <p className="text-sm font-medium text-slate-800">{cust?.name || '—'}</p>
                      {cust?.email && <p className="text-xs text-slate-400">{cust.email}</p>}
                    </td>
                    <td className="py-2.5 pr-3 text-sm text-slate-500">{fmtDate(so.date)}</td>
                    <td className="py-2.5 pr-3 text-sm text-slate-500">{fmtDate(so.expectedDelivery)}</td>
                    <td className="py-2.5 pr-3 text-sm font-medium text-slate-700">{formatNaira(so.total)}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${meta.bg} ${meta.color}`}>
                        <Icon className="w-3 h-3" />{meta.label}
                      </span>
                    </td>
                    <td className="py-2.5 pr-2">
                      <div className="opacity-0 group-hover:opacity-100 flex items-center justify-end gap-1 transition-opacity">
                        {so.status === 'confirmed' && (
                          <button onClick={() => { setConvertingId(so.id); convertMutation.mutate(so.id); }}
                            disabled={convertingId === so.id}
                            className="px-2 py-1 rounded text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 disabled:opacity-50"
                            title="Convert to Invoice">
                            {convertingId === so.id ? <Loader2 size={12} className="animate-spin" /> : 'Invoice'}
                          </button>
                        )}
                        {so.status !== 'fulfilled' && (
                          <>
                            <button onClick={() => openEditModal(so)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => { setDeleteTarget(so); setDeleteError(null); }}
                              className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50">
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 overflow-y-auto py-8">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">{editingId ? 'Edit Sales Order' : 'New Sales Order'}</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{formError}</div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Customer</label>
                  <select value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10">
                    <option value="">Select a customer...</option>
                    {(customers || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Order Date</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Expected Delivery</label>
                  <input type="date" value={form.expectedDelivery} onChange={e => setForm({ ...form, expectedDelivery: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as SOStatus })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10">
                    {(['draft','confirmed','partial','cancelled'] as SOStatus[]).map(s => (
                      <option key={s} value={s}>{STATUS_META[s].label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Line items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-slate-500">Line Items</label>
                  <button type="button" onClick={addLine}
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                    <Plus size={12} />Add Line
                  </button>
                </div>
                <div className="space-y-2">
                  {form.lines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-start p-3 bg-slate-50 rounded-lg">
                      <div className="col-span-4">
                        <select value={line.itemId}
                          onChange={e => e.target.value ? handleItemSelect(idx, e.target.value) : setLine(idx, 'itemId', '')}
                          className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-slate-900/10 mb-1">
                          <option value="">— Choose item —</option>
                          {(items || []).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </select>
                        <input placeholder="Description" value={line.description}
                          onChange={e => setLine(idx, 'description', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-slate-900/10" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-400 block mb-0.5">Qty</label>
                        <input type="number" min="1" value={line.quantity} onChange={e => setLine(idx, 'quantity', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none" />
                      </div>
                      <div className="col-span-3">
                        <label className="text-[10px] text-slate-400 block mb-0.5">Unit Price (₦)</label>
                        <input type="number" step="0.01" value={line.unitPrice} onChange={e => setLine(idx, 'unitPrice', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-400 block mb-0.5">VAT %</label>
                        <input type="number" step="0.1" value={line.taxRate} onChange={e => setLine(idx, 'taxRate', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none" />
                      </div>
                      <div className="col-span-1 pt-4">
                        {form.lines.length > 1 && (
                          <button type="button" onClick={() => removeLine(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      <div className="col-span-11 text-right text-xs font-medium text-slate-600">
                        Line: ₦{calcLine(line).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-2 px-3 py-2 bg-slate-50 rounded-lg text-sm">
                  <span className="text-slate-500">Total</span>
                  <span className="font-bold text-slate-900">₦{previewTotal.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                <button type="submit" disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50">
                  {isSaving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Delete Sales Order</h2>
            <p className="text-sm text-slate-500 mb-4">
              Delete <span className="font-medium text-slate-700">{deleteTarget.soNumber}</span>? This cannot be undone.
            </p>
            {deleteError && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 mb-3">{deleteError}</div>}
            <div className="flex justify-end gap-2">
              <button onClick={() => { setDeleteTarget(null); setDeleteError(null); }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50">
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
