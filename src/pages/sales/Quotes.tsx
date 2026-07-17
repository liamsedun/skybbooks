/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, orgApi } from '../../lib/api';
import {
  Plus, Search, Pencil, Trash2, X, Loader2, AlertCircle, Upload,
  FileText, ArrowRight, CheckCircle2, Clock, XCircle, RefreshCw, ChevronRight,
  RotateCcw, Download, Copy, Send, ClipboardList,
} from 'lucide-react';
import { CsvImportModal } from '../../components/ui/CsvImportModal';

type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired' | 'converted';

interface Customer { id: string; name: string; email: string | null; customerCode?: string; }
interface Item { id: string; name: string; sku: string | null; salesPrice: number | null; type: string; }
interface QuoteLine {
  itemId: string | null; description: string; quantity: number;
  unitPrice: number; discountPct: number; taxRate: number;
}
interface Quote {
  id: string; orgId: string; quoteNumber: string; customerId: string;
  date: string; expiryDate: string | null; status: QuoteStatus;
  currency: string; subtotal: number; discount: number; tax: number;
  total: number; notes: string | null; terms: string | null;
  convertedToId: string | null; convertedToInvoiceNumber: string | null; lines: QuoteLine[]; createdAt: string;
}

type FormLine = { itemId: string; description: string; quantity: string; unitPrice: string; discountPct: string; taxRate: string; };
type QuoteFormState = { customerId: string; date: string; expiryDate: string; status: QuoteStatus; notes: string; terms: string; lines: FormLine[]; };

const EMPTY_LINE: FormLine = { itemId: '', description: '', quantity: '1', unitPrice: '', discountPct: '0', taxRate: '7.5' };
const EMPTY_FORM: QuoteFormState = {
  customerId: '', date: new Date().toISOString().split('T')[0],
  expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  status: 'draft', notes: '', terms: '', lines: [{ ...EMPTY_LINE }],
};

type FilterKey = 'all' | QuoteStatus;
type StatusMeta = {
  label: string;
  gradient: string; gradientActive: string; border: string; borderActive: string; ring: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string; iconBgActive: string;
  badgeColor: string; badgeBg: string;
};
const STATUS_META: Record<FilterKey, StatusMeta> = {
  all:      { label: 'All',      gradient: 'from-slate-50 to-slate-100/80', gradientActive: 'from-slate-800 to-slate-900', border: 'border-slate-200/70', borderActive: 'border-slate-700', ring: 'ring-slate-300', icon: ClipboardList, iconBg: 'bg-slate-100/80', iconBgActive: 'bg-white/15', badgeColor: 'text-slate-600',   badgeBg: 'bg-slate-100' },
  draft:    { label: 'Draft',    gradient: 'from-slate-50 to-slate-100/80', gradientActive: 'from-slate-700 to-slate-800', border: 'border-slate-200/70', borderActive: 'border-slate-600', ring: 'ring-slate-300', icon: FileText, iconBg: 'bg-slate-100/80', iconBgActive: 'bg-white/15', badgeColor: 'text-slate-600',   badgeBg: 'bg-slate-100' },
  sent:     { label: 'Sent',     gradient: 'from-blue-50 to-blue-100/80',   gradientActive: 'from-blue-600 to-blue-700',   border: 'border-blue-200/70', borderActive: 'border-blue-500', ring: 'ring-blue-300', icon: ArrowRight, iconBg: 'bg-blue-100/80', iconBgActive: 'bg-white/15', badgeColor: 'text-blue-700',     badgeBg: 'bg-blue-50' },
  accepted: { label: 'Accepted', gradient: 'from-emerald-50 to-emerald-100/80', gradientActive: 'from-emerald-600 to-emerald-700', border: 'border-emerald-200/70', borderActive: 'border-emerald-500', ring: 'ring-emerald-300', icon: CheckCircle2, iconBg: 'bg-emerald-100/80', iconBgActive: 'bg-white/15', badgeColor: 'text-emerald-700', badgeBg: 'bg-emerald-50' },
  declined: { label: 'Declined', gradient: 'from-rose-50 to-rose-100/80',   gradientActive: 'from-rose-600 to-rose-700',   border: 'border-rose-200/70', borderActive: 'border-rose-500', ring: 'ring-rose-300', icon: XCircle, iconBg: 'bg-rose-100/80', iconBgActive: 'bg-white/15', badgeColor: 'text-rose-700',    badgeBg: 'bg-rose-50' },
  expired:  { label: 'Expired',  gradient: 'from-amber-50 to-amber-100/80', gradientActive: 'from-amber-600 to-amber-700', border: 'border-amber-200/70', borderActive: 'border-amber-500', ring: 'ring-amber-300', icon: Clock, iconBg: 'bg-amber-100/80', iconBgActive: 'bg-white/15', badgeColor: 'text-amber-700',   badgeBg: 'bg-amber-50' },
  converted:{ label: 'Converted',gradient: 'from-violet-50 to-violet-100/80', gradientActive: 'from-violet-600 to-violet-700', border: 'border-violet-200/70', borderActive: 'border-violet-500', ring: 'ring-violet-300', icon: RefreshCw, iconBg: 'bg-violet-100/80', iconBgActive: 'bg-white/15', badgeColor: 'text-violet-700',  badgeBg: 'bg-violet-50' },
};

function formatNaira(kobo: number | null | undefined): string {
  if (kobo == null) return '—';
  return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function calcLineTotal(l: FormLine): number {
  const qty = parseFloat(l.quantity) || 0;
  const price = parseFloat(l.unitPrice) || 0;
  const disc = parseFloat(l.discountPct) || 0;
  const tax = parseFloat(l.taxRate) || 0;
  return qty * price * (1 - disc / 100) * (1 + tax / 100);
}
function buildPayload(form: QuoteFormState) {
  const lines = form.lines.map(l => ({
    itemId: l.itemId || null,
    description: l.description,
    quantity: parseFloat(l.quantity) || 1,
    unitPrice: Math.round((parseFloat(l.unitPrice) || 0) * 100),
    discountPct: parseFloat(l.discountPct) || 0,
    taxRate: parseFloat(l.taxRate) || 7.5,
  }));
  const subtotalNaira = form.lines.reduce((s, l) => s + (parseFloat(l.quantity)||0)*(parseFloat(l.unitPrice)||0)*(1-(parseFloat(l.discountPct)||0)/100), 0);
  const taxNaira = form.lines.reduce((s, l) => s + (parseFloat(l.quantity)||0)*(parseFloat(l.unitPrice)||0)*(1-(parseFloat(l.discountPct)||0)/100)*((parseFloat(l.taxRate)||0)/100), 0);
  const subtotal = Math.round(subtotalNaira * 100);
  const tax = Math.round(taxNaira * 100);
  return { customerId: form.customerId, date: form.date||undefined, expiryDate: form.expiryDate||null, status: form.status,
    subtotal, discount: 0, tax, total: subtotal+tax, notes: form.notes.trim()||null, terms: form.terms.trim()||null, lines };
}
function formFromQuote(q: Quote): QuoteFormState {
  return {
    customerId: q.customerId, date: q.date?q.date.split('T')[0]:'',
    expiryDate: q.expiryDate?q.expiryDate.split('T')[0]:'', status: q.status,
    notes: q.notes||'', terms: q.terms||'',
    lines: (q.lines||[]).length>0 ? q.lines.map(l=>({
      itemId: l.itemId||'', description: l.description,
      quantity: l.quantity.toString(), unitPrice: (l.unitPrice/100).toString(),
      discountPct: (l.discountPct||0).toString(), taxRate: (l.taxRate||7.5).toString(),
    })) : [{ ...EMPTY_LINE }],
  };
}

function exportQuotesCSV(quotes: Quote[], customerMap: Map<string, Customer>) {
  const headers = ['Quote #','Customer','Date','Expiry','Status','Subtotal (₦)','Discount (₦)','VAT (₦)','Total (₦)','Notes'];
  const rows = quotes.map(q => [
    q.quoteNumber, customerMap.get(q.customerId)?.name || q.customerId, q.date, q.expiryDate||'', q.status,
    (q.subtotal/100).toFixed(2), (q.discount/100).toFixed(2), (q.tax/100).toFixed(2), (q.total/100).toFixed(2),
    q.notes||'',
  ]);
  const csv = [headers,...rows].map(r => r.map(val => `"${val}"`).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url;
  a.download=`quotes-${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

function exportQuotesPDF(quotes: Quote[], customerMap: Map<string, Customer>) {
  const fmt = (k: number) => `₦${(k/100).toLocaleString('en-NG',{minimumFractionDigits:2})}`;
  const rows = quotes.map(q => `
    <tr>
      <td>${q.quoteNumber}</td>
      <td>${customerMap.get(q.customerId)?.name || '\u2014'}</td>
      <td>${new Date(q.date).toLocaleDateString('en-GB')}</td>
      <td>${q.expiryDate ? new Date(q.expiryDate).toLocaleDateString('en-GB') : '\u2014'}</td>
      <td><span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;background:#f1f5f9;color:#475569">${q.status}</span></td>
      <td style="text-align:right">${fmt(q.total)}</td>
    </tr>`).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Quotes</title>
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
    <div style="text-align:right"><div class="title">Quotes Report</div><div class="date">Generated: ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</div><div class="date">${quotes.length} quotes</div></div>
  </div>
  <table><thead><tr><th>Quote #</th><th>Customer</th><th>Date</th><th>Expiry</th><th>Status</th><th style="text-align:right">Total</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="footer">SkyBooks By Skyhouse Accountants &amp; Technologies (Olalekan Williams Edun) &bull; Confidential</div>
  </body></html>`;
  const w = window.open('','_blank');
  if (w) { w.document.write(html); w.document.close(); setTimeout(()=>w.print(),500); }
}

export function QuotesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm]     = useState('');
  const [statusFilter, setStatusFilter] = useState<'all'|QuoteStatus>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedId, setSelectedId]     = useState<string|null>(null);
  const [modalOpen, setModalOpen]       = useState(false);
  const [editingId, setEditingId]       = useState<string|null>(null);
  const [form, setForm]                 = useState<QuoteFormState>(EMPTY_FORM);
  const [formError, setFormError]       = useState<string|null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Quote|null>(null);
  const [deleteError, setDeleteError]   = useState<string|null>(null);
  const [convertingId, setConvertingId] = useState<string|null>(null);
  const [convertSuccess, setConvertSuccess] = useState<string|null>(null);
  const [unconvertingId, setUnconvertingId] = useState<string|null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { data: quotesData, isLoading, isError } = useQuery<Quote[]>({
    queryKey: ['sales','quotes'],
    queryFn: async () => { const r = await api.get('/sales/quotes'); return r.data; },
  });
  const { data: customers } = useQuery<Customer[]>({
    queryKey: ['sales','customers'],
    queryFn: async () => { const r = await api.get('/sales/customers'); return r.data; },
  });
  const { data: items } = useQuery<Item[]>({
    queryKey: ['inventory','items'],
    queryFn: async () => { const r = await api.get('/inventory/items'); return r.data; },
  });

  const { data: org } = useQuery({ queryKey: ['org'], queryFn: orgApi.getOrg, staleTime: 60000 });

  const customerMap = useMemo(() => { const m=new Map<string,Customer>(); (customers||[]).forEach(c=>m.set(c.id,c)); return m; }, [customers]);

  const createMutation = useMutation({
    mutationFn: (p:any) => api.post('/sales/quotes', p),
    onSuccess: () => { queryClient.invalidateQueries({queryKey:['sales','quotes']}); closeModal(); },
    onError: (e:any) => setFormError(e?.response?.data?.error||'Failed to create quote.'),
  });
  const updateMutation = useMutation({
    mutationFn: ({id,p}:{id:string;p:any}) => api.patch(`/sales/quotes/${id}`,p),
    onSuccess: () => { queryClient.invalidateQueries({queryKey:['sales','quotes']}); closeModal(); },
    onError: (e:any) => setFormError(e?.response?.data?.error||'Failed to update quote.'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id:string) => api.delete(`/sales/quotes/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({queryKey:['sales','quotes']}); setDeleteTarget(null); setDeleteError(null); },
    onError: (e:any) => setDeleteError(e?.response?.data?.error||'Failed to delete quote.'),
  });
  const convertMutation = useMutation({
    mutationFn: (id:string) => api.post(`/sales/quotes/${id}/convert`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({queryKey:['sales','quotes']});
      queryClient.invalidateQueries({queryKey:['invoices']});
      setConvertingId(null);
      setConvertSuccess(`Converted to ${res.data?.invoice?.invoiceNumber||'invoice'} successfully.`);
      setTimeout(()=>setConvertSuccess(null),4000);
    },
    onError: (e:any) => { setConvertingId(null); alert(e?.response?.data?.error||'Conversion failed.'); },
  });
  const convertToSoMutation = useMutation({
    mutationFn: (id: string) => api.post(`/sales/quotes/${id}/convert-to-sales-order`),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey:['sales','quotes']});
      queryClient.invalidateQueries({queryKey:['sales','sales-orders']});
    },
    onError: (e:any) => alert(e?.response?.data?.error||'Failed to convert to sales order.'),
  });

  const statusUpdateMutation = useMutation({
    mutationFn: ({id, status}: {id: string; status: string}) => api.patch(`/sales/quotes/${id}`, {status}),
    onSuccess: () => { queryClient.invalidateQueries({queryKey:['sales','quotes']}); },
    onError: (e:any) => alert(e?.response?.data?.error||'Failed to update status.'),
  });

  const unconvertMutation = useMutation({
    mutationFn: (id:string) => api.post(`/sales/quotes/${id}/unconvert`),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey:['sales','quotes']});
      queryClient.invalidateQueries({queryKey:['invoices']});
      setUnconvertingId(null);
    },
    onError: (e:any) => { setUnconvertingId(null); alert(e?.response?.data?.error||'Unconvert failed.'); },
  });

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return (quotesData||[]).filter(q => {
      if (statusFilter!=='all' && q.status!==statusFilter) return false;
      if (dateFrom && q.date < dateFrom) return false;
      if (dateTo && q.date > dateTo) return false;
      if (!term) return true;
      const cust = customerMap.get(q.customerId);
      return q.quoteNumber.toLowerCase().includes(term)||(cust?.name||'').toLowerCase().includes(term);
    });
  }, [quotesData, searchTerm, statusFilter, dateFrom, dateTo, customerMap]);

  const counts = useMemo(() => {
    const all=quotesData?.length||0; const byStatus:Record<string,number>={};
    (quotesData||[]).forEach(q=>{ byStatus[q.status]=(byStatus[q.status]||0)+1; }); return {all,byStatus};
  }, [quotesData]);

  const selectedQuote = selectedId ? (quotesData||[]).find(q=>q.id===selectedId) : null;

  function openAddModal() { setForm(EMPTY_FORM); setEditingId(null); setFormError(null); setModalOpen(true); }
  function openEditModal(q:Quote) { setForm(formFromQuote(q)); setEditingId(q.id); setFormError(null); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditingId(null); setFormError(null); }
  function handleSubmit(e:React.FormEvent) {
    e.preventDefault();
    if (!form.customerId) { setFormError('Please select a customer.'); return; }
    if (form.lines.some(l=>!l.description.trim())) { setFormError('All line items need a description.'); return; }
    const p = buildPayload(form);
    if (editingId) updateMutation.mutate({id:editingId,p});
    else createMutation.mutate(p);
  }
  function setLine(idx:number, field:string, val:string) {
    setForm(prev=>{ const lines=[...prev.lines]; lines[idx]={...lines[idx],[field]:val}; return {...prev,lines}; });
  }
  function addLine() { setForm(prev=>({...prev,lines:[...prev.lines,{...EMPTY_LINE}]})); }
  function removeLine(idx:number) { setForm(prev=>({...prev,lines:prev.lines.filter((_,i)=>i!==idx)})); }
  function handleItemSelect(idx:number, itemId:string) {
    const item=(items||[]).find(i=>i.id===itemId); if(!item) return;
    setForm(prev=>{ const lines=[...prev.lines]; lines[idx]={...lines[idx],itemId,description:item.name,unitPrice:item.salesPrice!=null?(item.salesPrice/100).toString():''}; return {...prev,lines}; });
  }
  const previewTotal = form.lines.reduce((s,l)=>s+calcLineTotal(l),0);
  const isSaving = createMutation.isPending||updateMutation.isPending;

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => exportQuotesCSV(filtered, customerMap)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-xl hover:bg-slate-50 transition-all duration-200">
            <Download size={14} /> CSV
          </button>
          <button onClick={() => exportQuotesPDF(filtered, customerMap)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-xl hover:bg-slate-50 transition-all duration-200">
            <FileText size={14} /> PDF
          </button>
          <button onClick={() => setImportOpen(true)} className="inline-flex items-center gap-2 px-3 py-1.5 bg-white text-slate-700 text-xs font-medium border border-slate-200 rounded-xl hover:bg-slate-50 transition-all duration-200">
            <Upload size={14} /> Import CSV
          </button>
          <button onClick={openAddModal} className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-xs font-medium rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200 shadow-sm">
            <Plus size={14} />New
          </button>
        </div>
      </div>

      {convertSuccess && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
          <CheckCircle2 size={16} />{convertSuccess}
        </div>
      )}

      <div className="flex gap-6">
        {/* List */}
        <div className={`flex-1 min-w-0 ${selectedId?'hidden lg:block':''}`}>
          <div className="flex flex-wrap gap-2">
            {(['all','draft','sent','accepted','converted'] as const).map(s=>{
              const meta=STATUS_META[s]; const Icon=meta.icon; const count=s==='all'?counts.all:(counts.byStatus[s]||0);
              const active=statusFilter===s;
              return (
              <button key={s} onClick={()=>setStatusFilter(s)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border shadow-sm ${
                  active
                    ? `bg-gradient-to-br ${meta.gradientActive} text-white ${meta.borderActive} shadow-md ring-2 ${meta.ring}`
                    : `bg-gradient-to-br ${meta.gradient} text-slate-700 ${meta.border} hover:shadow-md hover:border-slate-300`
                }`}>
                <Icon className={`w-3.5 h-3.5 ${active?'text-white':''}`} />
                <span>{meta.label} <span className={`${active?'text-white/70':'text-slate-400'}`}>({count})</span></span>
              </button>
            )})}
          </div>
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Search quotes..."
                className="w-full px-9 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
            </div>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
              className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
            <span className="text-xs text-slate-400 font-medium">to</span>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
              className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            {isLoading ? <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 size={20} className="animate-spin mr-2"/>Loading...</div>
            : isError ? <div className="flex items-center justify-center gap-2 py-16 text-rose-500 text-sm"><AlertCircle size={16}/>Failed to load.</div>
            : filtered.length===0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <FileText size={28} className="text-slate-300 mb-3"/>
                <p className="text-sm font-medium text-slate-600">No quotes yet</p>
                <p className="text-xs text-slate-400 mt-1">Create your first quote to send to a customer.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="px-3 py-3 text-left">Quote #</th><th className="px-3 py-3 text-left">Customer</th>
                    <th className="px-3 py-3 text-left">Date</th><th className="px-3 py-3 text-left">Expires</th>
                    <th className="px-3 py-3 text-right">Total</th><th className="px-3 py-3 text-left">Status</th><th className="px-3 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(q=>{
                    const cust=customerMap.get(q.customerId); const meta=STATUS_META[q.status]; const Icon=meta.icon;
                    const isSelected=q.id===selectedId;
                    return (
                      <tr key={q.id} onClick={()=>setSelectedId(isSelected?null:q.id)}
                        className={`cursor-pointer group transition-colors ${isSelected?'bg-indigo-50 border-l-2 border-l-indigo-500':'hover:bg-slate-50/50'}`}>
                        <td className="py-2.5 pl-4 pr-3 font-mono text-sm font-semibold text-slate-700">{q.quoteNumber}</td>
                        <td className="py-2.5 pr-3 text-sm text-slate-700">{cust?.name||'—'}</td>
                        <td className="py-2.5 pr-3 text-sm text-slate-500">{fmtDate(q.date)}</td>
                        <td className="py-2.5 pr-3 text-sm text-slate-500">{fmtDate(q.expiryDate)}</td>
                        <td className="py-2.5 pr-3 text-sm text-right font-medium text-slate-900 font-mono">{formatNaira(q.total)}</td>
                        <td className="py-2.5 pr-3">
                          {q.status === 'converted' ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate(`/sales/invoices/${q.convertedToId}`); }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 transition-colors"
                            ><RefreshCw className="w-3 h-3" /> {q.convertedToInvoiceNumber || 'Converted'}</button>
                          ) : (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${meta.badgeColor} ${meta.badgeBg}`}>
                              <Icon className="w-3 h-3"/>{meta.label}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-2">
                          <div className="opacity-0 group-hover:opacity-100 flex items-center justify-end gap-1 transition-opacity" onClick={e=>e.stopPropagation()}>
                            {q.status==='converted' ? (
                              <button onClick={() => { setForm(formFromQuote(q)); setEditingId(null); setFormError(null); setModalOpen(true); }}
                                className="px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg">
                                <Copy size={12} className="inline mr-1" />Duplicate
                              </button>
                            ) : q.status!=='declined'&&(
                              <button onClick={()=>{ setConvertingId(q.id); convertMutation.mutate(q.id); }}
                                disabled={convertMutation.isPending&&convertingId===q.id}
                                className="px-2 py-1 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg disabled:opacity-50">
                                {convertMutation.isPending&&convertingId===q.id?<Loader2 size={12} className="animate-spin"/>:'To Invoice'}
                              </button>
                            )}
                            {q.status==='draft'&&(
                              <button onClick={()=>openEditModal(q)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                                <Pencil size={14}/>
                              </button>
                            )}
                            {q.status!=='converted'&&(
                              <button onClick={()=>{ setDeleteTarget(q); setDeleteError(null); }} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg">
                                <Trash2 size={14}/>
                              </button>
                            )}
                            <ChevronRight size={14} className={`text-slate-400 transition-transform ${isSelected?'rotate-90':''}`}/>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Detail panel */}
        {selectedId && selectedQuote && (
          <div className="w-full lg:w-96 shrink-0">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden sticky top-6">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Quote</p>
                  <p className="text-base font-bold text-slate-900 mt-0.5">{selectedQuote.quoteNumber}</p>
                </div>
                <div className="flex items-center gap-1">
                  {selectedQuote.status==='draft'&&(
                    <button onClick={()=>openEditModal(selectedQuote)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100" title="Edit">
                      <Pencil size={16}/>
                    </button>
                  )}
                  <button onClick={()=>setSelectedId(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                    <X size={16}/>
                  </button>
                </div>
              </div>
              <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                {/* Status */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">Status</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_META[selectedQuote.status].badgeColor} ${STATUS_META[selectedQuote.status].badgeBg}`}>
                    {React.createElement(STATUS_META[selectedQuote.status].icon,{className:"w-3 h-3"})}
                    {STATUS_META[selectedQuote.status].label}
                  </span>
                </div>
                {/* Key fields */}
                <div className="space-y-2">
                  {[
                    ['Customer', customerMap.get(selectedQuote.customerId)?.name||'—'],
                    ['Date', fmtDate(selectedQuote.date)],
                    ['Expiry', fmtDate(selectedQuote.expiryDate)],
                  ].map(([label,val])=>(
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-slate-400">{label}</span>
                      <span className="font-medium text-slate-800">{val}</span>
                    </div>
                  ))}
                </div>
                {/* Line items */}
                {(selectedQuote.lines||[]).length>0&&(
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Line Items</p>
                    <div className="space-y-2">
                      {selectedQuote.lines.map((l,i)=>{
                        const lineTotal=l.quantity*l.unitPrice/100*(1-(l.discountPct||0)/100)*(1+(l.taxRate||7.5)/100);
                        return (
                          <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <p className="text-sm font-medium text-slate-800">{l.description}</p>
                            <div className="flex justify-between mt-1 text-xs text-slate-500">
                              <span>{l.quantity} × {formatNaira(l.unitPrice)}</span>
                              <span className="font-medium text-slate-700">{formatNaira(Math.round(lineTotal*100))}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Totals */}
                <div className="space-y-1.5 border-t border-slate-100 pt-3">
                  <div className="flex justify-between text-sm text-slate-500"><span>Subtotal</span><span className="font-mono">{formatNaira(selectedQuote.subtotal)}</span></div>
                  {selectedQuote.tax>0&&<div className="flex justify-between text-sm text-slate-500"><span>VAT</span><span className="font-mono">{formatNaira(selectedQuote.tax)}</span></div>}
                  <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-100"><span>Total</span><span className="font-mono">{formatNaira(selectedQuote.total)}</span></div>
                </div>
                {/* Notes / Terms */}
                {selectedQuote.notes&&<div><p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Notes</p><p className="text-sm text-slate-600">{selectedQuote.notes}</p></div>}
                {selectedQuote.terms&&<div><p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Terms</p><p className="text-sm text-slate-600">{selectedQuote.terms}</p></div>}
                {/* Linked invoice */}
                {selectedQuote.convertedToId&&(
                  <div className="border-t border-slate-100 pt-3">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Converted To</p>
                    <button onClick={()=>navigate(`/sales/invoices/${selectedQuote.convertedToId}`)}
                      className="w-full flex items-center justify-between p-3 bg-violet-50 rounded-lg border border-violet-100 hover:border-violet-200 transition-colors">
                      <span className="text-sm font-medium text-violet-700">{selectedQuote.convertedToInvoiceNumber || 'View Invoice'}</span>
                      <ChevronRight size={16} className="text-violet-400"/>
                    </button>
                  </div>
                )}
                {/* Actions */}
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <button
                    onClick={() => {
                      const el = document.getElementById('quote-pdf-mock-container');
                      if (el) { window.print(); }
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    <Download size={14}/>Download PDF
                  </button>
                  {selectedQuote.status==='draft' && (
                    <button onClick={()=> statusUpdateMutation.mutate({id: selectedQuote.id, status: 'sent'})}
                      disabled={statusUpdateMutation.isPending}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-50">
                      <Send size={14}/>{statusUpdateMutation.isPending?'Sending...':'Send'}
                    </button>
                  )}
                  {selectedQuote.status==='sent' && (
                    <>
                      <button onClick={()=> statusUpdateMutation.mutate({id: selectedQuote.id, status: 'accepted'})}
                        disabled={statusUpdateMutation.isPending}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-50 disabled:opacity-50">
                        <CheckCircle2 size={14}/>{statusUpdateMutation.isPending?'Accepting...':'Accepted'}
                      </button>
                      <button onClick={()=> statusUpdateMutation.mutate({id: selectedQuote.id, status: 'declined'})}
                        disabled={statusUpdateMutation.isPending}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-50 disabled:opacity-50">
                        <XCircle size={14}/>{statusUpdateMutation.isPending?'Declining...':'Decline'}
                      </button>
                    </>
                  )}
                  {selectedQuote.status==='accepted' && (
                    <>
                      <button onClick={()=>{ setConvertingId(selectedQuote.id); convertMutation.mutate(selectedQuote.id); }}
                        disabled={convertMutation.isPending&&convertingId===selectedQuote.id}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-violet-700 border border-violet-200 rounded-lg hover:bg-violet-50 disabled:opacity-50">
                        <RefreshCw size={14}/>{convertMutation.isPending&&convertingId===selectedQuote.id?'Converting...':'To Invoice'}
                      </button>
                      <button onClick={()=> convertToSoMutation.mutate(selectedQuote.id)}
                        disabled={convertToSoMutation.isPending}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-50 disabled:opacity-50">
                        <ClipboardList size={14}/>{convertToSoMutation.isPending?'Converting...':'Sale Order'}
                      </button>
                    </>
                  )}
                  {selectedQuote.status==='converted'&&(
                    <button onClick={()=>{ setForm(formFromQuote(selectedQuote)); setEditingId(null); setFormError(null); setModalOpen(true); }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50">
                      <Copy size={14}/>Duplicate Quote
                    </button>
                  )}
                  {selectedQuote.status==='converted'&&(
                    <button onClick={()=>{ setUnconvertingId(selectedQuote.id); unconvertMutation.mutate(selectedQuote.id); }}
                      disabled={unconvertMutation.isPending&&unconvertingId===selectedQuote.id}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-50 disabled:opacity-50">
                      <RotateCcw size={14}/>{unconvertMutation.isPending&&unconvertingId===selectedQuote.id?'Reverting...':'Unconvert (Reset to Accepted)'}
                    </button>
                  )}
                  {selectedQuote.status==='draft' && (
                    <button onClick={()=>{ setDeleteTarget(selectedQuote); setDeleteError(null); }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50">
                      <Trash2 size={14}/>Delete Quote
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quote Print Container */}
      {selectedQuote && (
        <div id="quote-pdf-mock-container" className="bg-white" style={{ display: 'none' }}>
          <div className="p-8 sm:p-10 space-y-8 max-w-4xl mx-auto">
            <div className="h-1.5 bg-gradient-to-r from-indigo-600 via-violet-500 to-indigo-400" />
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-8 pt-4">
              <div className="flex flex-col items-start gap-2">
                {org?.logoUrl ? (
                  <img src={org.logoUrl} alt={org?.name || 'Logo'} className="w-14 h-14 rounded-xl object-contain border border-slate-100 bg-white p-1" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-xl font-bold">
                    {org?.name?.[0]?.toUpperCase() ?? 'S'}
                  </div>
                )}
                <div className="space-y-0.5">
                  <h2 className="text-sm font-bold text-slate-900">{org?.name || 'Your Company'}</h2>
                  <div className="flex flex-col gap-y-0 mt-0.5">
                    {org?.address && <span className="text-[11px] text-slate-500">{org.address}</span>}
                    {(org as any)?.city && <span className="text-[11px] text-slate-500">{(org as any).city}</span>}
                    {(org as any)?.state && <span className="text-[11px] text-slate-500">{(org as any).state}</span>}
                  </div>
                  <div className="flex flex-col gap-y-0 mt-1">
                    {org?.phone && <span className="text-[11px] text-slate-500">{org.phone}</span>}
                    {org?.email && <span className="text-[11px] text-slate-500">{org.email}</span>}
                  </div>
                </div>
              </div>
              <div className="sm:text-right shrink-0 space-y-1">
                <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest">Quotation</p>
                <p className="text-2xl font-black text-slate-900 tracking-tight">{selectedQuote.quoteNumber}</p>
                <span className="inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-semibold capitalize bg-slate-100 text-slate-600 border border-slate-200">{selectedQuote.status}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 py-6 border-y border-slate-100">
              <div className="sm:col-span-2 space-y-0.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Bill To</p>
                <p className="text-sm font-bold text-slate-900">{customerMap.get(selectedQuote.customerId)?.name || '—'}</p>
                {(() => { const c = customers?.find(c => c.id === selectedQuote.customerId); return c ? (
                  <div className="flex flex-col gap-y-0 mt-1">
                    {(c as any).address && <span className="text-[11px] text-slate-500">{(c as any).address}</span>}
                    {(c as any).city && <span className="text-[11px] text-slate-500">{(c as any).city}</span>}
                    {(c as any).state && <span className="text-[11px] text-slate-500">{(c as any).state}</span>}
                    {(c as any).email && <span className="text-[11px] text-slate-500">{(c as any).email}</span>}
                    {(c as any).phone && <span className="text-[11px] text-slate-500">{(c as any).phone}</span>}
                  </div>
                ) : null; })()}
              </div>
              <div className="space-y-2 sm:text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Quote Details</p>
                <div className="space-y-1 text-sm">
                  <div className="flex sm:justify-end gap-2">
                    <span className="text-slate-400 w-24 sm:w-auto">Issued</span>
                    <span className="font-medium text-slate-700">{fmtDate(selectedQuote.date)}</span>
                  </div>
                  <div className="flex sm:justify-end gap-2">
                    <span className="text-slate-400 w-24 sm:w-auto">Expires</span>
                    <span className="font-medium text-slate-700">{fmtDate(selectedQuote.expiryDate)}</span>
                  </div>
                  <div className="flex sm:justify-end gap-2">
                    <span className="text-slate-400 w-24 sm:w-auto">Status</span>
                    <span className="font-medium text-slate-700">{selectedQuote.status}</span>
                  </div>
                </div>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 rounded-lg">
                  <th className="text-left py-3 pl-3 pr-2 text-xs font-semibold text-slate-500 uppercase tracking-wide w-8">#</th>
                  <th className="text-left py-3 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</th>
                  <th className="text-center py-3 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wide w-14">Qty</th>
                  <th className="text-right py-3 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wide w-32">Unit Price</th>
                  <th className="text-center py-3 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wide w-14">VAT</th>
                  <th className="text-right py-3 pl-2 pr-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-32 rounded-r-lg">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(selectedQuote.lines || []).map((line: QuoteLine, index: number) => {
                  const lineTotal = line.quantity * line.unitPrice * (1 - (line.discountPct || 0) / 100) * (1 + (line.taxRate || 7.5) / 100);
                  return (
                    <tr key={index} className="border-b border-slate-50">
                      <td className="py-4 pl-3 pr-2 text-slate-400 text-sm">{index + 1}</td>
                      <td className="py-4 px-2 font-medium text-slate-800">{line.description}</td>
                      <td className="py-4 px-2 text-center text-slate-600">{line.quantity}</td>
                      <td className="py-4 px-2 text-right text-slate-600 font-mono">{formatNaira(line.unitPrice)}</td>
                      <td className="py-4 px-2 text-center text-slate-500 text-xs">{line.taxRate ? `${line.taxRate}%` : '—'}</td>
                      <td className="py-4 pl-2 pr-3 text-right font-semibold text-slate-900 font-mono">{formatNaira(Math.round(lineTotal))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="flex flex-col sm:flex-row justify-between gap-8 pt-2">
              <div className="flex-1 max-w-sm space-y-4">
                {selectedQuote.terms && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Terms</p>
                    <p className="text-sm text-slate-500 leading-relaxed whitespace-pre-line">{selectedQuote.terms}</p>
                  </div>
                )}
              </div>
              <div className="shrink-0 w-full sm:w-[300px] space-y-2">
                <div className="flex justify-between text-sm text-slate-500 pb-2">
                  <span>Subtotal</span>
                  <span className="font-medium text-slate-700 font-mono">{formatNaira(selectedQuote.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-500 pb-2">
                  <span>VAT (7.5%)</span>
                  <span className="font-medium text-slate-700 font-mono">{formatNaira(selectedQuote.tax)}</span>
                </div>
                <div className="flex justify-between py-3 border-t border-slate-200">
                  <span className="text-base font-bold text-slate-800">Total</span>
                  <span className="text-base font-black text-slate-900 font-mono">{formatNaira(selectedQuote.total)}</span>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
              <span>{org?.name} &middot; Thank you for considering our proposal.</span>
              <span className="font-mono">{selectedQuote.quoteNumber}</span>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen&&(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <h2 className="text-base font-semibold text-slate-900">{editingId?'Edit Quote':'New Quote'}</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"><X size={18}/></button>
            </div>
            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 overflow-y-auto">
              {formError&&<div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">{formError}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Customer</label>
                  <select value={form.customerId} onChange={e=>setForm({...form,customerId:e.target.value})}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow">
                    <option value="">Select a customer...</option>
                    {(customers||[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Quote Date</label>
                  <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Expiry Date</label>
                  <input type="date" value={form.expiryDate} onChange={e=>setForm({...form,expiryDate:e.target.value})}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                  <select value={form.status} onChange={e=>setForm({...form,status:e.target.value as QuoteStatus})}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow">
                    {(['draft','sent','accepted','declined','expired'] as QuoteStatus[]).map(s=>
                      <option key={s} value={s}>{STATUS_META[s].label}</option>
                    )}
                  </select>
                </div>
              </div>
              {/* Line items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-slate-500">Line Items</label>
                  <button type="button" onClick={addLine} className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                    <Plus size={12}/>Add Line
                  </button>
                </div>
                <div className="space-y-2">
                  {form.lines.map((line,idx)=>(
                    <div key={idx} className="grid grid-cols-12 gap-2 items-start p-3 bg-slate-50 rounded-lg">
                      <div className="col-span-4">
                        <select value={line.itemId} onChange={e=>e.target.value?handleItemSelect(idx,e.target.value):setLine(idx,'itemId','')}
                          className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none mb-1">
                          <option value="">— Choose item —</option>
                          {(items||[]).map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
                        </select>
                        <input placeholder="Description" value={line.description} onChange={e=>setLine(idx,'description',e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none"/>
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-400 block mb-0.5">Qty</label>
                        <input type="number" min="1" value={line.quantity} onChange={e=>setLine(idx,'quantity',e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none"/>
                      </div>
                      <div className="col-span-3">
                        <label className="text-[10px] text-slate-400 block mb-0.5">Unit Price (₦)</label>
                        <input type="number" step="0.01" value={line.unitPrice} onChange={e=>setLine(idx,'unitPrice',e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none"/>
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-400 block mb-0.5">VAT %</label>
                        <input type="number" step="0.1" value={line.taxRate} onChange={e=>setLine(idx,'taxRate',e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none"/>
                      </div>
                      <div className="col-span-1 pt-4">
                        {form.lines.length>1&&<button type="button" onClick={()=>removeLine(idx)} className="p-1 text-slate-400 hover:text-rose-600"><X size={14}/></button>}
                      </div>
                      <div className="col-span-11 text-right text-xs font-medium text-slate-600">
                        Line: ₦{calcLineTotal(line).toLocaleString('en-NG',{minimumFractionDigits:2})}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-2 px-3 py-2 bg-slate-50 rounded-lg text-sm">
                  <span className="text-slate-500">Total</span>
                  <span className="font-bold text-slate-900">₦{previewTotal.toLocaleString('en-NG',{minimumFractionDigits:2})}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={2}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Payment Terms</label>
                <textarea value={form.terms} onChange={e=>setForm({...form,terms:e.target.value})} rows={2}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow"/>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-all duration-200">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 transition-all duration-200 shadow-sm">
                  {isSaving?'Saving...':editingId?'Save Changes':'Create Quote'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget&&(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Delete Quote</h2>
            <p className="text-sm text-slate-500 mb-4">Delete <span className="font-medium text-slate-700">{deleteTarget.quoteNumber}</span>? This cannot be undone.</p>
            {deleteError&&<div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2 mb-3">{deleteError}</div>}
            <div className="flex justify-end gap-2">
              <button onClick={()=>{ setDeleteTarget(null); setDeleteError(null); }} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-all duration-200">Cancel</button>
              <button onClick={()=>deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-xl hover:bg-rose-700 disabled:opacity-50 transition-all duration-200">
                {deleteMutation.isPending?'Deleting...':'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {importOpen && (
        <CsvImportModal
          entity="quotes"
          endpoint="/sales/quotes"
          onClose={() => setImportOpen(false)}
          onSuccess={() => queryClient.invalidateQueries({queryKey:['sales','quotes']})}
          transformRow={(row, headers) => {
            const idx = (h: string) => headers.indexOf(h);
            const custCol = headers.findIndex(h => h === 'customerCode (or name)' || h === 'customerId (or name)');
            const custVal = custCol >= 0 ? row[custCol]?.trim() : '';
            const customer = (customers || []).find(c => c.id === custVal || c.name === custVal || c.customerCode === custVal);
            return {
              customerId: customer?.id || custVal,
              date: row[idx('date (YYYY-MM-DD)')] || undefined,
              expiryDate: row[idx('expiryDate')] || undefined,
              currency: row[idx('currency')] || undefined,
              notes: row[idx('notes')] || null,
              terms: row[idx('terms')] || null,
              lines: [{
                description: row[idx('line_description')] || '',
                quantity: parseFloat(row[idx('line_quantity')]) || 1,
                unitPrice: Math.round((parseFloat(row[idx('line_unitPrice (NGN)')]) || 0) * 100),
                discountPct: parseFloat(row[idx('line_discountPct')]) || 0,
                taxRate: parseFloat(row[idx('line_taxRate')]) || 7.5,
              }],
            };
          }}
        />
      )}
    </div>
  );
}
