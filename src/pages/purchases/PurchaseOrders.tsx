/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, orgApi } from '../../lib/api';
import {
  Plus, X, Loader2, AlertCircle, Search, ShoppingCart,
  CheckCircle2, ArrowRight, Download, FileText, Upload,
  Eye, Edit2, Trash2
} from 'lucide-react';
import { CsvImportModal } from '../../components/ui/CsvImportModal';
import { CurrencySelector } from '../../components/ui/CurrencySelector';
import { useToast } from '../../contexts/ToastContext';

interface Vendor { id: string; name: string; }
interface Item { id: string; name: string; purchasePrice: number | null; }
interface POLine {
  itemId: string | null; description: string;
  quantity: number; unitPrice: number; taxRate: number; accountId: string | null;
}
interface PO {
  id: string; poNumber: string; vendorId: string;
  date: string; expectedDate: string | null; status: string;
  subtotal: number; tax: number; total: number; currency: string; fxRate?: string | number | null; notes: string | null;
  lines?: POLine[];
}

const EMPTY_LINE: POLine = { itemId: null, description: '', quantity: 1, unitPrice: 0, taxRate: 7.5, accountId: null };
const today = new Date().toISOString().split('T')[0];

function formatNaira(kobo: number) {
  return `\u20a6${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}
function fmtDual(cents: number, currency?: string, fxRate?: number | string | null): string {
  const ngn = formatNaira(cents);
  if (!currency || currency === 'NGN' || !fxRate || Number(fxRate) <= 1) return ngn;
  const original = (cents / 100) / Number(fxRate);
  const cur = original.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency} ${cur}  \u2022  ${ngn}`;
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
  const headers = ['PO #','Vendor','Date','Expected','Status','Currency','Total'];
  const rows = pos.map(p => [p.poNumber, vendorMap.get(p.vendorId)||'', fmtDate(p.date), fmtDate(p.expectedDate), p.status, p.currency||'NGN', (p.total/100).toFixed(2)]);
  const csv = [headers,...rows].map(r=>r.map(v=>`"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`purchase-orders-${new Date().toISOString().split('T')[0]}.csv`; a.click(); URL.revokeObjectURL(url);
}

function exportPOsPDF(pos: PO[], vendorMap: Map<string,string>) {
  const fmtDualPdf = (k: number, c?: string, fx?: number | string | null) => {
    if (!c || c === 'NGN' || !fx || Number(fx) <= 1) return `₦${(k/100).toLocaleString('en-NG',{minimumFractionDigits:2})}`;
    const orig = (k/100) / Number(fx);
    return `${c} ${orig.toLocaleString('en-US',{minimumFractionDigits:2})} \u2022 ₦${(k/100).toLocaleString('en-NG',{minimumFractionDigits:2})}`;
  };
  const rows = pos.map(p=>`<tr><td>${p.poNumber}</td><td>${vendorMap.get(p.vendorId)||'—'}</td><td>${fmtDate(p.date)}</td><td>${fmtDate(p.expectedDate)}</td><td>${p.status}</td><td style="text-align:right">${fmtDualPdf(p.total, p.currency, p.fxRate)}</td></tr>`).join('');
  const total = pos.reduce((s,p)=>s+p.total,0);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Purchase Orders</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;color:#1e293b;padding:40px;font-size:13px}.header{display:flex;justify-content:space-between;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #0f172a}.company{font-size:22px;font-weight:800}.subtitle{font-size:11px;color:#64748b;margin-top:4px}.title{font-size:18px;font-weight:700;text-align:right}.date{font-size:11px;color:#64748b;margin-top:4px;text-align:right}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#0f172a;color:#fff;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase}td{padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px}tr:nth-child(even) td{background:#f8fafc}.total-row td{font-weight:700;background:#f1f5f9;border-top:2px solid #0f172a}.footer{margin-top:40px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px}@media print{body{padding:20px}}</style></head><body><div class="header"><div><div class="company">SkyBooks</div><div class="subtitle">By Skyhouse Accountants &amp; Technologies</div></div><div><div class="title">Purchase Orders</div><div class="date">Generated: ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</div></div></div><table><thead><tr><th>PO #</th><th>Vendor</th><th>Date</th><th>Expected</th><th>Status</th><th style="text-align:right">Total</th></tr></thead><tbody>${rows}</tbody><tfoot><tr class="total-row"><td colspan="5"><strong>Total (${pos.length} orders)</strong></td><td style="text-align:right">${formatNaira(total)}</td></tr></tfoot></table><div class="footer">SkyBooks By Skyhouse Accountants &amp; Technologies (Olalekan Williams Edun) &bull; Confidential</div></body></html>`;
  const w = window.open('','_blank'); if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),500);}
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  confirmed: 'bg-amber-50 text-amber-700',
  accepted: 'bg-blue-50 text-blue-700',
  approved: 'bg-emerald-50 text-emerald-700',
  sent: 'bg-indigo-50 text-indigo-700',
  received: 'bg-teal-50 text-teal-700',
  cancelled: 'bg-rose-50 text-rose-500',
  billed: 'bg-violet-50 text-violet-700',
};

export function PurchaseOrdersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ vendorId: '', date: today, expectedDate: '', notes: '', currency: 'NGN', fxRate: '1.00000000' as string | null, projectId: '', lines: [{ ...EMPTY_LINE }] });
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

  const { data: org } = useQuery({ queryKey: ['org'], queryFn: orgApi.getOrg, staleTime: 60000 });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
    staleTime: 60000,
  });

  const vendorMap = useMemo(() => new Map(vendors.map(v => [v.id, v.name])), [vendors]);
  const pos: PO[] = posData?.orders || posData?.purchaseOrders || [];
  const filtered = useMemo(() => pos.filter(po => {
    if (dateFrom && po.date < dateFrom) return false;
    if (dateTo && po.date > dateTo) return false;
    return true;
  }), [pos, dateFrom, dateTo]);

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
    onError: (e: any) => toast(e?.response?.data?.error || 'Failed to convert PO.', 'error'),
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => api.post(`/purchases/orders/${id}/confirm`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }); showSuccess('PO confirmed.'); },
    onError: (e: any) => toast(e?.response?.data?.error || 'Failed to confirm PO.', 'error'),
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.post(`/purchases/orders/${id}/accept`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }); showSuccess('PO accepted.'); },
    onError: (e: any) => toast(e?.response?.data?.error || 'Failed to accept PO.', 'error'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/purchases/orders/${id}/approve`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }); showSuccess('PO approved.'); },
    onError: (e: any) => toast(e?.response?.data?.error || 'Failed to approve PO.', 'error'),
  });

  const convertToExpenseMutation = useMutation({
    mutationFn: (id: string) => api.post(`/purchases/orders/${id}/convert-to-expense`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      showSuccess('PO converted to expense successfully.');
      setMenuOpen(null);
    },
    onError: (e: any) => toast(e?.response?.data?.error || 'Failed to convert PO to expense.', 'error'),
  });

  function openView(po: PO) { setViewingPo(po); }

  function handlePrintPdf() {
    const el = document.getElementById('po-pdf-container');
    if (el) { el.style.display = 'block'; requestAnimationFrame(() => { window.print(); el.style.display = 'none'; }); }
  }

  function openEdit(po: PO) {
    setForm({
      vendorId: po.vendorId,
      date: po.date?.split('T')[0] || '',
      expectedDate: po.expectedDate?.split('T')[0] || '',
      notes: po.notes || '',
      currency: po.currency || 'NGN',
      fxRate: po.fxRate ? String(po.fxRate) : (po.currency && po.currency !== 'NGN' ? null : '1.00000000'),
      projectId: (po as any).projectId || '',
      lines: po.lines?.length ? po.lines.map((l: any) => ({
        itemId: l.itemId || '',
        description: l.description || '',
        quantity: l.quantity,
        unitPrice: Math.round(l.unitPrice / 100),
        taxRate: l.taxRate,
        accountId: l.accountId || null,
      })) : [{ ...EMPTY_LINE }],
    });
    setEditingPo(po);
    setModalOpen(true);
  }

  function showSuccess(msg: string) { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 4000); }
  function closeModal() { setModalOpen(false); setEditingPo(null); setForm({ vendorId: '', date: today, expectedDate: '', notes: '', currency: 'NGN', fxRate: '1.00000000', projectId: '', lines: [{ ...EMPTY_LINE }] }); setFormError(null); }

  function updateLine(idx: number, field: keyof POLine, value: any) {
    const nl = [...form.lines];
    nl[idx] = { ...nl[idx], [field]: value };
    setForm({ ...form, lines: nl });
  }

  function selectItem(idx: number, itemId: string) {
    const item = items.find(it => it.id === itemId);
    if (!item) return;
    const nl = [...form.lines];
    nl[idx] = { ...nl[idx], itemId, description: item.name, unitPrice: (item.purchasePrice ?? 0) / 100 };
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
      currency: form.currency,
      fxRate: form.fxRate ? parseFloat(form.fxRate) : 1,
      projectId: form.projectId || undefined,
      lines: form.lines.map(l => ({ ...l, unitPrice: Math.round(l.unitPrice * 100) })),
    };
    if (editingPo) {
      updateMutation.mutate({ id: editingPo.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">

        <div className="flex items-center gap-2">
          <button onClick={() => exportPOsCSV(filtered, vendorMap)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-xl hover:bg-slate-50 transition-all duration-200">
            <Download size={14} /> CSV
          </button>
          <button onClick={() => exportPOsPDF(pos, vendorMap)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-xl hover:bg-slate-50 transition-all duration-200">
            <FileText size={14} /> PDF
          </button>
          <button onClick={() => setImportOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-xl hover:bg-slate-50 transition-all duration-200">
            <Upload size={14} /> Import CSV
          </button>
          <button onClick={() => { setModalOpen(true); setFormError(null); }} className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-xs font-medium rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200">
            <Plus size={14} /> +New
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          <CheckCircle2 size={16} /> {successMsg}
        </div>
      )}

      <div className="flex gap-2 items-center">
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search orders..." className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
        </div>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
        <span className="text-xs text-slate-400 font-medium">to</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 bg-gradient-to-r from-slate-200 to-slate-100 animate-pulse rounded-xl">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading orders...
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center py-16 text-rose-500 gap-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <AlertCircle size={18} /> Failed to load purchase orders.
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <ShoppingCart size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">{dateFrom || dateTo ? 'No orders match the date range' : 'No purchase orders yet'}</p>
          <p className="text-xs text-slate-400 mt-1">Create your first PO to begin procurement tracking</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                <th className="px-3 py-3 text-left">PO #</th>
                <th className="px-3 py-3 text-left">Vendor</th>
                <th className="px-3 py-3 text-left">Date</th>
                <th className="px-3 py-3 text-left">Expected</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-right">Total</th>
                <th className="px-3 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(po => (
                <tr key={po.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 pl-4 pr-2 font-mono text-xs font-medium text-slate-700">
                    {po.poNumber}
                    {po.currency && po.currency !== 'NGN' && (
                      <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200">{po.currency}</span>
                    )}
                  </td>
                  <td className="py-3 px-2 font-medium text-slate-900">{vendorMap.get(po.vendorId) || '—'}</td>
                  <td className="py-3 px-2 text-xs text-slate-500">{fmtDate(po.date)}</td>
                  <td className="py-3 px-2 text-xs text-slate-500">{fmtDate(po.expectedDate)}</td>
                  <td className="py-3 px-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize ${STATUS_STYLES[po.status] || 'bg-slate-100 text-slate-500'}`}>
                      {po.status}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-slate-900">
                    {fmtDual(po.total, po.currency, po.fxRate)}
                  </td>
                  <td className="py-3 pl-2 pr-4">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openView(po)} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-200" title="View">
                        <Eye size={14} />
                      </button>
                      {(po.status === 'draft' || po.status === 'confirmed') && (
                        <button onClick={() => openEdit(po)} className="p-1.5 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-200" title="Edit">
                          <Edit2 size={14} />
                        </button>
                      )}
                      {po.status === 'draft' && (
                        <button onClick={() => { if (window.confirm('Delete this purchase order?')) deleteMutation.mutate(po.id); }} className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all duration-200" title="Delete" disabled={deleteMutation.isPending}>
                          <Trash2 size={14} />
                        </button>
                      )}
                      {po.status === 'draft' && (
                        <button onClick={() => confirmMutation.mutate(po.id)} disabled={confirmMutation.isPending} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all duration-200" title="Confirm">
                          <ArrowRight size={11} /> Confirm
                        </button>
                      )}
                      {po.status === 'confirmed' && (
                        <button onClick={() => acceptMutation.mutate(po.id)} disabled={acceptMutation.isPending} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all duration-200" title="Accept">
                          <ArrowRight size={11} /> Accept
                        </button>
                      )}
                      {po.status === 'accepted' && (
                        <button onClick={() => approveMutation.mutate(po.id)} disabled={approveMutation.isPending} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all duration-200" title="Approve">
                          <ArrowRight size={11} /> Approve
                        </button>
                      )}
                      {po.status === 'approved' && (
                        <>
                          <button onClick={() => convertMutation.mutate(po.id)} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-xl transition-all duration-200" title="Convert to Bill">
                            <ArrowRight size={11} /> To Bill
                          </button>
                          <button onClick={() => convertToExpenseMutation.mutate(po.id)} disabled={convertToExpenseMutation.isPending} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all duration-200" title="Convert to Expense">
                            <ArrowRight size={11} /> To Expense
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* View Detail */}
      {viewingPo && (
        <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setViewingPo(null)} />
      )}
      {viewingPo && (
        <div className="fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col">
          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">

            {/* Company header */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-100">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {org?.logoUrl ? (
                    <img src={org.logoUrl} alt="" className="w-12 h-12 rounded-xl object-contain border border-slate-100 bg-white p-1" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-lg font-bold">
                      {org?.name?.[0]?.toUpperCase() ?? 'S'}
                    </div>
                  )}
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">{org?.name || 'Your Company'}</h2>
                    {org?.address && <p className="text-[11px] text-slate-500 mt-0.5">{org.address}</p>}
                    <div className="flex flex-wrap gap-x-3 gap-y-0 mt-0.5">
                      {org?.phone && <span className="text-[11px] text-slate-400">{org.phone}</span>}
                      {org?.email && <span className="text-[11px] text-slate-400">{org.email}</span>}
                      {(org as any)?.website && <span className="text-[11px] text-slate-400">{(org as any).website}</span>}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-indigo-600 uppercase tracking-widest">Purchase Order</p>
                  <p className="text-lg font-black text-slate-900 mt-0.5">{viewingPo.poNumber}</p>
                  <span className={`inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[viewingPo.status] || 'bg-slate-100 text-slate-500'}`}>{viewingPo.status}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                <button onClick={handlePrintPdf} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors">
                  <FileText size={14} /> Print PDF
                </button>
                <button onClick={() => setViewingPo(null)} className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 ml-auto">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="px-6 py-5 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Vendor</p>
                  <p className="text-sm font-semibold text-slate-800">{vendorMap.get(viewingPo.vendorId) || viewingPo.vendorId}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Expected Delivery</p>
                  <p className="text-sm font-medium text-slate-700">{viewingPo.expectedDate ? fmtDate(viewingPo.expectedDate) : '—'}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Order Date</p>
                  <p className="text-sm font-medium text-slate-700">{fmtDate(viewingPo.date)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[viewingPo.status] || 'bg-slate-100 text-slate-500'}`}>{viewingPo.status}</span>
                </div>
                {viewingPo.currency && viewingPo.currency !== 'NGN' && (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Currency</p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200">{viewingPo.currency}</span>
                    {viewingPo.fxRate && <p className="text-[10px] text-slate-500 mt-1">Rate: {Number(viewingPo.fxRate).toFixed(4)}</p>}
                  </div>
                )}
              </div>

              {viewingPo.lines && viewingPo.lines.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Line Items</p>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          <th className="py-2.5 pl-4 pr-2 text-left">Item / Description</th>
                          <th className="py-2.5 px-2 text-center w-14">Qty</th>
                          <th className="py-2.5 px-2 text-right w-28">Unit Price</th>
                          <th className="py-2.5 px-2 text-center w-12">VAT%</th>
                          <th className="py-2.5 pl-2 pr-4 text-right w-28">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {viewingPo.lines.map((line: any, idx: number) => {
                          const base = line.quantity * line.unitPrice;
                          const tax = Math.round(base * (line.taxRate / 100));
                          const total = base + tax;
                          return (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-2.5 pl-4 pr-2 text-xs font-medium text-slate-700">{line.description || '—'}</td>
                              <td className="py-2.5 px-2 text-xs text-center text-slate-700">{line.quantity}</td>
                              <td className="py-2.5 px-2 text-xs text-right font-mono text-slate-700">{fmtDual(line.unitPrice, viewingPo.currency, viewingPo.fxRate)}</td>
                              <td className="py-2.5 px-2 text-xs text-center text-slate-500">{line.taxRate}%</td>
                              <td className="py-2.5 pl-2 pr-4 text-xs text-right font-mono font-medium text-slate-900">{fmtDual(total, viewingPo.currency, viewingPo.fxRate)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <div className="w-64 bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Subtotal</span>
                    <span className="font-mono">{fmtDual(viewingPo.subtotal, viewingPo.currency, viewingPo.fxRate)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>VAT</span>
                    <span className="font-mono">{fmtDual(viewingPo.tax, viewingPo.currency, viewingPo.fxRate)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                    <span>Total</span>
                    <span className="font-mono">{fmtDual(viewingPo.total, viewingPo.currency, viewingPo.fxRate)}</span>
                  </div>
                </div>
              </div>

              {viewingPo.notes && (
                <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Notes</p>
                  <p className="text-sm text-slate-600">{viewingPo.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Print container for PO PDF */}
      {viewingPo && (
        <div id="po-pdf-container" className="bg-white" style={{ display: 'none' }}>
          <div className="p-10 space-y-8">
            {/* Header with org identity */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b-2 border-slate-900">
              <div className="flex items-start gap-3">
                {org?.logoUrl ? (
                  <img src={org.logoUrl} alt="" className="w-14 h-14 rounded-xl object-contain border border-slate-100 bg-white p-1" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-xl font-bold">
                    {org?.name?.[0]?.toUpperCase() ?? 'S'}
                  </div>
                )}
                <div>
                  <h1 className="text-lg font-bold text-slate-900">{org?.name || 'Your Company'}</h1>
                  <div className="flex flex-col gap-y-0 mt-0.5">
                    {org?.address && <span className="text-[11px] text-slate-500 leading-snug">{org.address}</span>}
                    {(org as any)?.city && <span className="text-[11px] text-slate-500 leading-snug">{(org as any).city}</span>}
                    {(org as any)?.state && <span className="text-[11px] text-slate-500 leading-snug">{(org as any).state}</span>}
                    {(org as any)?.country && <span className="text-[11px] text-slate-500 leading-snug">{(org as any).country}</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0 mt-1">
                    {org?.phone && <span className="text-[11px] text-slate-500">{org.phone}</span>}
                    {org?.email && <span className="text-[11px] text-slate-500">{org.email}</span>}
                    {(org as any)?.website && <span className="text-[11px] text-slate-500">{(org as any).website}</span>}
                  </div>
                </div>
              </div>
              <div className="sm:text-right shrink-0">
                <p className="text-xs font-semibold text-indigo-600 uppercase tracking-widest">Purchase Order</p>
                <p className="text-2xl font-black text-slate-900 mt-0.5 tracking-tight">{viewingPo.poNumber}</p>
                <p className="text-xs text-slate-400 mt-1">{new Date(viewingPo.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                <span className="inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium capitalize bg-slate-100 text-slate-600">{viewingPo.status}</span>
              </div>
            </div>

            {/* Vendor and Order Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Vendor</p>
                <p className="text-sm font-bold text-slate-900">{vendorMap.get(viewingPo.vendorId) || viewingPo.vendorId}</p>
              </div>
              <div className="sm:text-right space-y-1">
                <div className="flex sm:justify-end gap-2 text-sm">
                  <span className="text-slate-400">Expected</span>
                  <span className="font-medium text-slate-700">{viewingPo.expectedDate ? new Date(viewingPo.expectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}</span>
                </div>
                <div className="flex sm:justify-end gap-2 text-sm">
                  <span className="text-slate-400">Ordered</span>
                  <span className="font-medium text-slate-700">{new Date(viewingPo.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                </div>
              </div>
            </div>

            {/* Line Items */}
            {viewingPo.lines && viewingPo.lines.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 rounded-lg">
                    <th className="text-left py-3 pl-3 pr-2 text-xs font-semibold text-slate-500 uppercase tracking-wide rounded-l-lg">#</th>
                    <th className="text-left py-3 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Item / Description</th>
                    <th className="text-center py-3 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wide w-14">Qty</th>
                    <th className="text-right py-3 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wide w-32">Unit Price</th>
                    <th className="text-center py-3 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wide w-14">VAT</th>
                    <th className="text-right py-3 pl-2 pr-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-32 rounded-r-lg">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingPo.lines.map((line: any, idx: number) => {
                    const base = line.quantity * line.unitPrice;
                    const tax = Math.round(base * (line.taxRate / 100));
                    const total = base + tax;
                    return (
                      <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 pl-3 pr-2 text-slate-400 text-sm">{idx + 1}</td>
                        <td className="py-3 px-2">
                          <p className="font-medium text-slate-800 text-sm">{line.description}</p>
                          {line.itemId && <p className="text-xs text-slate-400 mt-0.5 font-mono">SKU: {line.itemId?.substring(0, 8).toUpperCase()}</p>}
                        </td>
                        <td className="py-3 px-2 text-center text-slate-600">{line.quantity}</td>
                        <td className="py-3 px-2 text-right text-slate-600 font-mono">{fmtDual(line.unitPrice, viewingPo.currency, viewingPo.fxRate)}</td>
                        <td className="py-3 px-2 text-center text-slate-500 text-xs">{line.taxRate > 0 ? `${line.taxRate}%` : '\u2014'}</td>
                        <td className="py-3 pl-2 pr-3 text-right font-semibold text-slate-900 font-mono">{fmtDual(total, viewingPo.currency, viewingPo.fxRate)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 border-t border-slate-200 pt-2 space-y-1">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Subtotal</span>
                  <span className="font-mono">{fmtDual(viewingPo.subtotal, viewingPo.currency, viewingPo.fxRate)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>VAT</span>
                  <span className="font-mono">{fmtDual(viewingPo.tax, viewingPo.currency, viewingPo.fxRate)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-1">
                  <span>Total</span>
                  <span className="font-mono">{fmtDual(viewingPo.total, viewingPo.currency, viewingPo.fxRate)}</span>
                </div>
              </div>
            </div>

            {/* Notes / Footer */}
            <div className="flex flex-col sm:flex-row justify-between gap-8 pt-2">
              <div className="flex-1 max-w-sm">
                {viewingPo.notes && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Notes</p>
                    <p className="text-sm text-slate-500 leading-relaxed">{viewingPo.notes}</p>
                  </div>
                )}
                {org && ((org as any)?.vatNumber || (org as any)?.rcNumber) && (
                  <div className="mt-3 space-y-0.5">
                    {(org as any)?.vatNumber && <p className="text-xs text-slate-400">VAT Reg: {(org as any).vatNumber}</p>}
                    {(org as any)?.rcNumber && <p className="text-xs text-slate-400">RC: {(org as any).rcNumber}</p>}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-[10px] text-slate-400 border-t border-slate-100 pt-4">
              {org?.name || 'SkyBooks'} — {org?.address || ''} — {org?.phone || ''} — {org?.email || ''}
              {(org as any)?.website && <span> — {(org as any).website}</span>}
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">{editingPo ? 'Edit Purchase Order' : 'New Purchase Order'}</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5 overflow-y-auto">
              {formError && (
                <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2 flex items-center gap-2">
                  <AlertCircle size={14} /> {formError}
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Vendor *</label>
                  <select value={form.vendorId} onChange={e => setForm({ ...form, vendorId: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow bg-white">
                    <option value="">Select vendor...</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Order Date</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Expected Delivery</label>
                  <input type="date" value={form.expectedDate} onChange={e => setForm({ ...form, expectedDate: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                </div>
                <div className="col-span-2">
                  <CurrencySelector
                    currency={form.currency}
                    onCurrencyChange={(c) => setForm({ ...form, currency: c })}
                    fxRate={form.fxRate}
                    onFxRateChange={(r) => setForm({ ...form, fxRate: r })}
                    date={form.date}
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Project</label>
                  <select value={form.projectId} onChange={e => setForm({ ...form, projectId: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow mt-1 bg-white">
                    <option value="">None (no project)</option>
                    {projects.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-2">Line Items</label>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        <th className="px-3 py-3 text-left w-44">Item</th>
                        <th className="px-3 py-3 text-left">Description</th>
                        <th className="px-3 py-3 text-center w-14">Qty</th>
                        <th className="px-3 py-3 text-right w-32">Unit Price (₦)</th>
                        <th className="px-3 py-3 text-center w-14">VAT %</th>
                        <th className="px-3 py-3 text-right w-28">Amount</th>
                        <th className="px-3 py-3 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {form.lines.map((line, idx) => {
                        const c = calcLine(line);
                        return (
                          <tr key={idx}>
                            <td className="py-2 pl-3 pr-2">
                              <select value={line.itemId || ''} onChange={e => e.target.value ? selectItem(idx, e.target.value) : updateLine(idx, 'itemId', null)} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
                                <option value="">— Custom —</option>
                                {items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                              </select>
                            </td>
                            <td className="py-2 px-2"><input value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)} placeholder="Description" className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10" /></td>
                            <td className="py-2 px-2"><input type="number" min="1" value={line.quantity} onChange={e => updateLine(idx, 'quantity', parseFloat(e.target.value) || 1)} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-xl text-center focus:outline-none focus:ring-2 focus:ring-slate-900/10" /></td>
                            <td className="py-2 px-2"><input type="number" min="0" step="0.01" value={line.unitPrice || ''} onChange={e => updateLine(idx, 'unitPrice', parseFloat(e.target.value) || 0)} placeholder="0.00" className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-xl text-right focus:outline-none focus:ring-2 focus:ring-slate-900/10" /></td>
                            <td className="py-2 px-2"><input type="number" min="0" max="100" step="0.1" value={line.taxRate} onChange={e => updateLine(idx, 'taxRate', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-xl text-center focus:outline-none focus:ring-2 focus:ring-slate-900/10" /></td>
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
                  <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow resize-none" />
                </div>
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-2">
                  <div className="flex justify-between text-sm text-slate-500"><span>Subtotal</span><span className="font-mono">{fmtDual(Math.round(totals.sub * 100), form.currency, form.fxRate)}</span></div>
                  <div className="flex justify-between text-sm text-slate-500"><span>VAT</span><span className="font-mono">{fmtDual(Math.round(totals.tax * 100), form.currency, form.fxRate)}</span></div>
                  <div className="flex justify-between pt-2 border-t border-slate-200"><span className="font-bold text-slate-800">Total</span><span className="font-black text-slate-900 font-mono">{fmtDual(Math.round(totals.total * 100), form.currency, form.fxRate)}</span></div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-all duration-200">Cancel</button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 flex items-center gap-2 transition-all duration-200">
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
