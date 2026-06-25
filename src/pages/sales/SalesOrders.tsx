/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Plus, Search, Pencil, Trash2, X, Loader2, AlertCircle,
  FileText, Download, CheckCircle2, Clock, XCircle, TrendingDown,
  ShoppingCart, ArrowRight, PackageCheck,
  Upload,
} from 'lucide-react';
import { CsvImportModal } from '../../components/ui/CsvImportModal';

type SOStatus = 'draft' | 'confirmed' | 'partial' | 'fulfilled' | 'cancelled';

interface Customer { id: string; name: string; email: string | null; }
interface Item { id: string; name: string; description: string | null; salesPrice: number | null; }
interface SOLine {
  itemId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  taxRate: number;
}
interface SalesOrder {
  id: string; orgId: string; soNumber: string; customerId: string;
  quoteId: string | null; date: string; expectedDelivery: string | null;
  status: SOStatus; currency: string;
  subtotal: number; discount: number; tax: number; total: number;
  notes: string | null; lines: SOLine[] | null; createdAt: string;
}

const EMPTY_LINE: SOLine = { itemId: null, description: '', quantity: 1, unitPrice: 0, discountPct: 0, taxRate: 7.5 };

type SOFormState = {
  customerId: string; date: string; expectedDelivery: string;
  status: SOStatus; notes: string; lines: SOLine[];
};

const EMPTY_FORM: SOFormState = {
  customerId: '', date: new Date().toISOString().split('T')[0],
  expectedDelivery: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  status: 'draft', notes: '', lines: [{ ...EMPTY_LINE }],
};

const STATUS_META: Record<SOStatus, { label: string; color: string; bg: string; icon: React.ComponentType<{ className?: string }> }> = {
  draft:     { label: 'Draft',     color: 'text-slate-600',   bg: 'bg-slate-100',   icon: FileText },
  confirmed: { label: 'Confirmed', color: 'text-blue-700',    bg: 'bg-blue-50',     icon: CheckCircle2 },
  partial:   { label: 'Partial',   color: 'text-amber-700',   bg: 'bg-amber-50',    icon: Clock },
  fulfilled: { label: 'Fulfilled', color: 'text-emerald-700', bg: 'bg-emerald-50',  icon: PackageCheck },
  cancelled: { label: 'Cancelled', color: 'text-rose-700',    bg: 'bg-rose-50',     icon: XCircle },
};

function formatNaira(kobo: number | null | undefined): string {
  if (kobo == null) return '—';
  return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function calcLine(line: SOLine) {
  const base = line.quantity * line.unitPrice;
  const disc = Math.round(base * (line.discountPct / 100));
  const afterDisc = base - disc;
  const vat = Math.round(afterDisc * (line.taxRate / 100));
  return { base, disc, afterDisc, vat, total: afterDisc + vat };
}

function buildPayload(form: SOFormState) {
  let subtotal = 0, discount = 0, tax = 0;
  form.lines.forEach(l => {
    const c = calcLine(l);
    subtotal += c.base;
    discount += c.disc;
    tax += c.vat;
  });
  const total = subtotal - discount + tax;
  return {
    customerId: form.customerId,
    date: form.date || undefined,
    expectedDelivery: form.expectedDelivery || null,
    status: form.status,
    subtotal: Math.round(subtotal * 100),
    discount: Math.round(discount * 100),
    tax: Math.round(tax * 100),
    total: Math.round(total * 100),
    notes: form.notes.trim() || null,
    lines: form.lines.map(l => ({
      itemId: l.itemId || null,
      description: l.description,
      quantity: l.quantity,
      unitPrice: Math.round(l.unitPrice * 100),
      discountPct: l.discountPct,
      taxRate: l.taxRate,
    })),
  };
}

function formFromSO(so: SalesOrder): SOFormState {
  return {
    customerId: so.customerId,
    date: so.date ? so.date.split('T')[0] : '',
    expectedDelivery: so.expectedDelivery ? so.expectedDelivery.split('T')[0] : '',
    status: so.status,
    notes: so.notes || '',
    lines: (so.lines && so.lines.length > 0)
      ? so.lines.map(l => ({ ...l, unitPrice: l.unitPrice / 100 }))
      : [{ ...EMPTY_LINE }],
  };
}

function exportSOsCSV(orders: SalesOrder[], customerMap: Map<string, Customer>) {
  const headers = ['SO #','Customer','Date','Delivery','Status','Subtotal (₦)','Discount (₦)','Tax (₦)','Total (₦)','Notes'];
  const rows = orders.map(o => [
    o.soNumber, customerMap.get(o.customerId)?.name || o.customerId, o.date, o.expectedDelivery||'', o.status,
    (o.subtotal/100).toFixed(2), (o.discount/100).toFixed(2), (o.tax/100).toFixed(2), (o.total/100).toFixed(2),
    o.notes||'',
  ]);
  const csv = [headers,...rows].map(r => r.map(val => `"${val}"`).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url;
  a.download=`sales-orders-${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

function exportSOsPDF(orders: SalesOrder[], customerMap: Map<string, Customer>) {
  const fmt = (k: number) => `₦${(k/100).toLocaleString('en-NG',{minimumFractionDigits:2})}`;
  const rows = orders.map(o => `
    <tr>
      <td>${o.soNumber}</td>
      <td>${customerMap.get(o.customerId)?.name || '\u2014'}</td>
      <td>${new Date(o.date).toLocaleDateString('en-GB')}</td>
      <td>${o.expectedDelivery ? new Date(o.expectedDelivery).toLocaleDateString('en-GB') : '\u2014'}</td>
      <td><span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;background:#f1f5f9;color:#475569">${o.status}</span></td>
      <td style="text-align:right">${fmt(o.total)}</td>
    </tr>`).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sales Orders</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',sans-serif;color:#1e293b;padding:40px;font-size:13px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #0f172a}
    .company{font-size:22px;font-weight:800;color:#0f172a}
    .subtitle{font-size:11px;color:#64748b;margin-top:4px}
    .title{font-size:18px;font-weight:700;color:#0f172a}
    .date{font-size:11px;color:#64748b;margin-top:4px}
    table{width:100%;border-collapse:collapse;margin-top:16px}
    th{background:#0f172a;color:#fff;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em}
    td{padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px}
    tr:nth-child(even) td{background:#f8fafc}
    .footer{margin-top:40px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px}
    @media print{body{padding:20px}}
  </style></head><body>
  <div class="header">
    <div><div class="company">SkyBooks</div><div class="subtitle">By Skyhouse Accountants &amp; Technologies</div></div>
    <div style="text-align:right"><div class="title">Sales Orders Report</div><div class="date">Generated: ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</div><div class="date">${orders.length} orders</div></div>
  </div>
  <table><thead><tr><th>SO #</th><th>Customer</th><th>Date</th><th>Delivery</th><th>Status</th><th style="text-align:right">Total</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="footer">SkyBooks By Skyhouse Accountants &amp; Technologies (Olalekan Williams Edun) &bull; Confidential</div>
  </body></html>`;
  const w = window.open('','_blank');
  if (w) { w.document.write(html); w.document.close(); setTimeout(()=>w.print(),500); }
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
  const [importOpen, setImportOpen] = useState(false);

  const { data: ordersData, isLoading, isError } = useQuery<SalesOrder[]>({
    queryKey: ['sales', 'orders'],
    queryFn: async () => { const r = await api.get('/sales/sales-orders'); return r.data; },
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ['sales', 'customers'],
    queryFn: async () => { const r = await api.get('/sales/customers'); return r.data; },
  });

  const { data: items } = useQuery<Item[]>({
    queryKey: ['items'],
    queryFn: async () => { const r = await api.get('/inventory/items'); return r.data; },
  });

  const customerMap = useMemo(() => {
    const m = new Map<string, Customer>();
    (customers || []).forEach(c => m.set(c.id, c));
    return m;
  }, [customers]);

  const createMutation = useMutation({
    mutationFn: (p: any) => api.post('/sales/sales-orders', p),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sales', 'orders'] }); closeModal(); },
    onError: (e: any) => setFormError(e?.response?.data?.error || 'Failed to create sales order.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, p }: { id: string; p: any }) => api.patch(`/sales/sales-orders/${id}`, p),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sales', 'orders'] }); closeModal(); },
    onError: (e: any) => setFormError(e?.response?.data?.error || 'Failed to update sales order.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sales/sales-orders/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sales', 'orders'] }); setDeleteTarget(null); setDeleteError(null); },
    onError: (e: any) => setDeleteError(e?.response?.data?.error || 'Failed to delete sales order.'),
  });

  const convertMutation = useMutation({
    mutationFn: (id: string) => api.post(`/sales/sales-orders/${id}/convert`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setConvertingId(null);
      setConvertSuccess(`Converted to ${res.data?.invoice?.invoiceNumber || 'invoice'} successfully.`);
      setTimeout(() => setConvertSuccess(null), 4000);
    },
    onError: (e: any) => { setConvertingId(null); alert(e?.response?.data?.error || 'Conversion failed.'); },
  });

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return (ordersData || []).filter(so => {
      if (statusFilter !== 'all' && so.status !== statusFilter) return false;
      if (!term) return true;
      const cust = customerMap.get(so.customerId);
      return so.soNumber.toLowerCase().includes(term) || (cust?.name || '').toLowerCase().includes(term);
    });
  }, [ordersData, searchTerm, statusFilter, customerMap]);

  const counts = useMemo(() => {
    const all = ordersData?.length || 0;
    const byStatus: Record<string, number> = {};
    (ordersData || []).forEach(so => { byStatus[so.status] = (byStatus[so.status] || 0) + 1; });
    return { all, byStatus };
  }, [ordersData]);

  function openCreate() { setEditingId(null); setForm(EMPTY_FORM); setFormError(null); setModalOpen(true); }
  function openEdit(so: SalesOrder) { setEditingId(so.id); setForm(formFromSO(so)); setFormError(null); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditingId(null); setFormError(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customerId) { setFormError('Please select a customer.'); return; }
    if (form.lines.length === 0) { setFormError('Add at least one line item.'); return; }
    if (form.lines.some(l => !l.description.trim())) { setFormError('All line items need a description.'); return; }
    const payload = buildPayload(form);
    if (editingId) updateMutation.mutate({ id: editingId, p: payload });
    else createMutation.mutate(payload);
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  function updateLine(index: number, field: keyof SOLine, value: any) {
    const newLines = [...form.lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setForm({ ...form, lines: newLines });
  }

  function addLine() { setForm({ ...form, lines: [...form.lines, { ...EMPTY_LINE }] }); }

  function removeLine(index: number) {
    if (form.lines.length === 1) return;
    setForm({ ...form, lines: form.lines.filter((_, i) => i !== index) });
  }

  function selectItem(index: number, itemId: string) {
    const item = (items || []).find(it => it.id === itemId);
    if (!item) return;
    const newLines = [...form.lines];
    newLines[index] = { ...newLines[index], itemId, description: item.name, unitPrice: item.salesPrice ? item.salesPrice / 100 : 0 };
    setForm({ ...form, lines: newLines });
  }

  const totals = useMemo(() => {
    let subtotal = 0, discount = 0, tax = 0;
    form.lines.forEach(l => { const c = calcLine(l); subtotal += c.base; discount += c.disc; tax += c.vat; });
    return { subtotal, discount, tax, total: subtotal - discount + tax };
  }, [form.lines]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Sales Orders</h1>
          <p className="text-sm text-slate-500 mt-0.5">{counts.all} total · {counts.byStatus['confirmed'] || 0} confirmed · {counts.byStatus['fulfilled'] || 0} fulfilled</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportSOsCSV(filtered, customerMap)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            <Download size={14} /> CSV
          </button>
          <button onClick={() => exportSOsPDF(filtered, customerMap)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            <FileText size={14} /> PDF
          </button>
          <button onClick={() => setImportOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            <Upload size={15} /> Import CSV
          </button>
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">
            <Plus size={15} /> New Sales Order
          </button>
        </div>
      </div>

      {convertSuccess && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          <CheckCircle2 size={16} /> {convertSuccess}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search orders..." className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
          <option value="all">All Statuses</option>
          {(Object.keys(STATUS_META) as SOStatus[]).map(s => (
            <option key={s} value={s}>{STATUS_META[s].label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 size={20} className="animate-spin mr-2" /> Loading orders...</div>
        ) : isError ? (
          <div className="flex items-center justify-center py-16 text-rose-500 gap-2"><AlertCircle size={18} /> Failed to load sales orders.</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <ShoppingCart size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-medium">No sales orders yet</p>
            <p className="text-xs mt-1">Create your first sales order to get started</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
                <th className="py-3 pl-4 pr-3">Order #</th>
                <th className="py-3 pr-3">Customer</th>
                <th className="py-3 pr-3">Date</th>
                <th className="py-3 pr-3">Expected Delivery</th>
                <th className="py-3 pr-3 text-right">Total</th>
                <th className="py-3 pr-3">Status</th>
                <th className="py-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(so => {
                const cust = customerMap.get(so.customerId);
                const meta = STATUS_META[so.status];
                const Icon = meta.icon;
                return (
                  <tr key={so.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 pl-4 pr-3 text-sm font-mono font-medium text-slate-700">{so.soNumber}</td>
                    <td className="py-3 pr-3 text-sm text-slate-700">{cust?.name || '—'}</td>
                    <td className="py-3 pr-3 text-sm text-slate-500">{fmtDate(so.date)}</td>
                    <td className="py-3 pr-3 text-sm text-slate-500">{fmtDate(so.expectedDelivery)}</td>
                    <td className="py-3 pr-3 text-sm text-right font-medium text-slate-900 font-mono">{formatNaira(so.total)}</td>
                    <td className="py-3 pr-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.color} ${meta.bg}`}>
                        <Icon className="w-3 h-3" /> {meta.label}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center justify-end gap-1">
                        {so.status !== 'cancelled' && so.status !== 'fulfilled' && (
                          <button
                            onClick={() => { setConvertingId(so.id); convertMutation.mutate(so.id); }}
                            disabled={convertMutation.isPending && convertingId === so.id}
                            className="px-2.5 py-1 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            {convertMutation.isPending && convertingId === so.id ? <Loader2 size={12} className="animate-spin" /> : <><ArrowRight size={11} /> To Invoice</>}
                          </button>
                        )}
                        {(so.status === 'draft' || so.status === 'confirmed') && (
                          <button onClick={() => openEdit(so)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                            <Pencil size={14} />
                          </button>
                        )}
                        {so.status !== 'fulfilled' && (
                          <button onClick={() => { setDeleteTarget(so); setDeleteError(null); }} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                            <Trash2 size={14} />
                          </button>
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

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 px-4 py-8 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">{editingId ? 'Edit Sales Order' : 'New Sales Order'}</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              {formError && (
                <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 flex items-center gap-2">
                  <AlertCircle size={14} /> {formError}
                </div>
              )}
              {/* Header fields */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Customer *</label>
                  <select value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
                    <option value="">Select a customer...</option>
                    {(customers || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Order Date</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Expected Delivery</label>
                  <input type="date" value={form.expectedDelivery} onChange={e => setForm({ ...form, expectedDelivery: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-2">Line Items</label>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide">
                        <th className="py-2.5 pl-3 pr-2 text-left w-48">Item</th>
                        <th className="py-2.5 px-2 text-left">Description</th>
                        <th className="py-2.5 px-2 text-center w-16">Qty</th>
                        <th className="py-2.5 px-2 text-right w-32">Unit Price (₦)</th>
                        <th className="py-2.5 px-2 text-center w-16">Disc %</th>
                        <th className="py-2.5 px-2 text-center w-16">VAT %</th>
                        <th className="py-2.5 px-2 text-right w-32">Amount</th>
                        <th className="py-2.5 pl-2 pr-3 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {form.lines.map((line, idx) => {
                        const c = calcLine(line);
                        return (
                          <tr key={idx}>
                            <td className="py-2 pl-3 pr-2">
                              <select value={line.itemId || ''} onChange={e => e.target.value ? selectItem(idx, e.target.value) : updateLine(idx, 'itemId', null)} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-900/20 bg-white">
                                <option value="">— Custom —</option>
                                {(items || []).map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                              </select>
                            </td>
                            <td className="py-2 px-2">
                              <input value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)} placeholder="Description" className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-900/20" />
                            </td>
                            <td className="py-2 px-2">
                              <input type="number" min="1" step="1" value={line.quantity} onChange={e => updateLine(idx, 'quantity', parseFloat(e.target.value) || 1)} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-900/20 text-center" />
                            </td>
                            <td className="py-2 px-2">
                              <input type="number" min="0" step="0.01" value={line.unitPrice === 0 ? '' : line.unitPrice} onChange={e => updateLine(idx, 'unitPrice', parseFloat(e.target.value) || 0)} placeholder="0.00" className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-900/20 text-right" />
                            </td>
                            <td className="py-2 px-2">
                              <input type="number" min="0" max="100" step="0.1" value={line.discountPct === 0 ? '' : line.discountPct} onChange={e => updateLine(idx, 'discountPct', parseFloat(e.target.value) || 0)} placeholder="0" className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-900/20 text-center" />
                            </td>
                            <td className="py-2 px-2">
                              <input type="number" min="0" max="100" step="0.1" value={line.taxRate} onChange={e => updateLine(idx, 'taxRate', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-900/20 text-center" />
                            </td>
                            <td className="py-2 px-2 text-right text-xs font-medium text-slate-900 font-mono">
                              ₦{c.total.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2 pl-2 pr-3">
                              <button type="button" onClick={() => removeLine(idx)} disabled={form.lines.length === 1} className="text-slate-300 hover:text-rose-500 disabled:opacity-20 transition-colors">
                                <X size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="px-3 py-2 border-t border-slate-100 bg-slate-50">
                    <button type="button" onClick={addLine} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                      <Plus size={13} /> Add Line Item
                    </button>
                  </div>
                </div>
              </div>

              {/* Totals + Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                    <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Internal notes..." className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as SOStatus })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
                      {(Object.keys(STATUS_META) as SOStatus[]).map(s => (
                        <option key={s} value={s}>{STATUS_META[s].label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2 bg-slate-50 rounded-xl p-4 border border-slate-100 self-start">
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>Subtotal</span>
                    <span className="font-mono">₦{totals.subtotal.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {totals.discount > 0 && (
                    <div className="flex justify-between text-sm text-violet-600">
                      <span className="flex items-center gap-1"><TrendingDown size={13} /> Discount</span>
                      <span className="font-mono">− ₦{totals.discount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>VAT (7.5%)</span>
                    <span className="font-mono">₦{totals.tax.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200">
                    <span className="text-base font-bold text-slate-800">Total</span>
                    <span className="text-base font-black text-slate-900 font-mono">₦{totals.total.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-5 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2">
                  {isSaving && <Loader2 size={14} className="animate-spin" />}
                  {editingId ? 'Save Changes' : 'Create Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import CSV */}
      {importOpen && (
        <CsvImportModal
          entity="salesOrders"
          endpoint="/sales/sales-orders"
          onClose={() => setImportOpen(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['sales', 'orders'] })}
          transformRow={(row, headers) => {
            const custName = row[headers.indexOf('customerId (or name)')]?.trim();
            const customer = (customers || []).find(c => c.id === custName || c.name === custName);
            return {
              customerId: customer?.id || custName,
              date: row[headers.indexOf('date (YYYY-MM-DD)')] || undefined,
              expectedDelivery: row[headers.indexOf('expectedDelivery')] || null,
              currency: row[headers.indexOf('currency')] || 'NGN',
              notes: row[headers.indexOf('notes')] || null,
              lines: [{
                description: row[headers.indexOf('line_description')] || '',
                quantity: parseFloat(row[headers.indexOf('line_quantity')]) || 1,
                unitPrice: Math.round((parseFloat(row[headers.indexOf('line_unitPrice (NGN)')]) || 0) * 100),
                discountPct: parseFloat(row[headers.indexOf('line_discountPct')]) || 0,
                taxRate: parseFloat(row[headers.indexOf('line_taxRate')]) || 0,
              }],
            };
          }}
        />
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-1">Delete Sales Order</h3>
            <p className="text-sm text-slate-500 mb-4">Delete <span className="font-medium">{deleteTarget.soNumber}</span>? This cannot be undone.</p>
            {deleteError && <p className="text-sm text-rose-600 mb-3">{deleteError}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending} className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50">
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
