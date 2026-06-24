/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import {
  Plus, Search, Pencil, Trash2, X, Loader2, AlertCircle, Upload,
  FileText, ArrowRight, CheckCircle2, Clock, XCircle, RefreshCw, ChevronRight,
  RotateCcw, Download,
} from 'lucide-react';
import { CsvImportModal } from '../../components/ui/CsvImportModal';

type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired' | 'converted';

interface Customer { id: string; name: string; email: string | null; }
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
  convertedToId: string | null; lines: QuoteLine[]; createdAt: string;
}

type FormLine = { itemId: string; description: string; quantity: string; unitPrice: string; discountPct: string; taxRate: string; };
type QuoteFormState = { customerId: string; date: string; expiryDate: string; status: QuoteStatus; notes: string; terms: string; lines: FormLine[]; };

const EMPTY_LINE: FormLine = { itemId: '', description: '', quantity: '1', unitPrice: '', discountPct: '0', taxRate: '7.5' };
const EMPTY_FORM: QuoteFormState = {
  customerId: '', date: new Date().toISOString().split('T')[0],
  expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  status: 'draft', notes: '', terms: '', lines: [{ ...EMPTY_LINE }],
};

const STATUS_META: Record<QuoteStatus, { label: string; color: string; bg: string; icon: React.ComponentType<{ className?: string }> }> = {
  draft:     { label: 'Draft',     color: 'text-slate-600',   bg: 'bg-slate-100',  icon: FileText },
  sent:      { label: 'Sent',      color: 'text-blue-700',    bg: 'bg-blue-50',    icon: ArrowRight },
  accepted:  { label: 'Accepted',  color: 'text-emerald-700', bg: 'bg-emerald-50', icon: CheckCircle2 },
  declined:  { label: 'Declined',  color: 'text-rose-700',    bg: 'bg-rose-50',    icon: XCircle },
  expired:   { label: 'Expired',   color: 'text-amber-700',   bg: 'bg-amber-50',   icon: Clock },
  converted: { label: 'Converted', color: 'text-violet-700',  bg: 'bg-violet-50',  icon: RefreshCw },
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
  const headers = ['Quote #','Customer','Date','Expiry','Status','Subtotal (₦)','Discount (₦)','Tax (₦)','Total (₦)','Notes'];
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
      if (!term) return true;
      const cust = customerMap.get(q.customerId);
      return q.quoteNumber.toLowerCase().includes(term)||(cust?.name||'').toLowerCase().includes(term);
    });
  }, [quotesData, searchTerm, statusFilter, customerMap]);

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
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quotes</h1>
          <p className="text-sm text-slate-500 mt-1">{counts.all} total · {counts.byStatus['draft']||0} draft · {counts.byStatus['accepted']||0} accepted</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportQuotesCSV(filtered, customerMap)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            <Download size={14} /> CSV
          </button>
          <button onClick={() => exportQuotesPDF(filtered, customerMap)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            <FileText size={14} /> PDF
          </button>
          <button onClick={() => setImportOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            <Upload size={16} /> Import CSV
          </button>
          <button onClick={openAddModal} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">
            <Plus size={16} />New Quote
          </button>
        </div>
      </div>

      {convertSuccess && (
        <div className="mb-4 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3">
          <CheckCircle2 size={16} />{convertSuccess}
        </div>
      )}

      <div className="flex gap-6">
        {/* List */}
        <div className={`flex-1 min-w-0 ${selectedId?'hidden lg:block':''}`}>
          <div className="flex flex-wrap gap-2 mb-4">
            {(['all','draft','sent','accepted','declined','expired','converted'] as const).map(s=>(
              <button key={s} onClick={()=>setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${statusFilter===s?'bg-slate-900 text-white':'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                {s==='all'?`All (${counts.all})`:`${STATUS_META[s].label} (${counts.byStatus[s]||0})`}
              </button>
            ))}
          </div>
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Search quotes..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
          </div>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
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
                  <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
                    <th className="py-2.5 pl-4 pr-3">Quote #</th><th className="py-2.5 pr-3">Customer</th>
                    <th className="py-2.5 pr-3">Date</th><th className="py-2.5 pr-3">Expires</th>
                    <th className="py-2.5 pr-3 text-right">Total</th><th className="py-2.5 pr-3">Status</th><th className="py-2.5 pr-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(q=>{
                    const cust=customerMap.get(q.customerId); const meta=STATUS_META[q.status]; const Icon=meta.icon;
                    const isSelected=q.id===selectedId;
                    return (
                      <tr key={q.id} onClick={()=>setSelectedId(isSelected?null:q.id)}
                        className={`cursor-pointer group transition-colors ${isSelected?'bg-indigo-50 border-l-2 border-l-indigo-500':'hover:bg-slate-50'}`}>
                        <td className="py-2.5 pl-4 pr-3 font-mono text-sm font-semibold text-slate-700">{q.quoteNumber}</td>
                        <td className="py-2.5 pr-3 text-sm text-slate-700">{cust?.name||'—'}</td>
                        <td className="py-2.5 pr-3 text-sm text-slate-500">{fmtDate(q.date)}</td>
                        <td className="py-2.5 pr-3 text-sm text-slate-500">{fmtDate(q.expiryDate)}</td>
                        <td className="py-2.5 pr-3 text-sm text-right font-medium text-slate-900 font-mono">{formatNaira(q.total)}</td>
                        <td className="py-2.5 pr-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.color} ${meta.bg}`}>
                            <Icon className="w-3 h-3"/>{meta.label}
                          </span>
                        </td>
                        <td className="py-2.5 pr-2">
                          <div className="opacity-0 group-hover:opacity-100 flex items-center justify-end gap-1 transition-opacity" onClick={e=>e.stopPropagation()}>
                            {q.status!=='converted'&&q.status!=='declined'&&(
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
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden sticky top-6">
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
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_META[selectedQuote.status].color} ${STATUS_META[selectedQuote.status].bg}`}>
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
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Converted Invoice</p>
                    <button onClick={()=>navigate(`/sales/invoices/${selectedQuote.convertedToId}`)}
                      className="w-full flex items-center justify-between p-3 bg-violet-50 rounded-lg border border-violet-100 hover:border-violet-200 transition-colors">
                      <span className="text-sm font-medium text-violet-700">View Invoice</span>
                      <ChevronRight size={16} className="text-violet-400"/>
                    </button>
                  </div>
                )}
                {/* Actions */}
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  {selectedQuote.status!=='converted'&&selectedQuote.status!=='declined'&&(
                    <button onClick={()=>{ setConvertingId(selectedQuote.id); convertMutation.mutate(selectedQuote.id); }}
                      disabled={convertMutation.isPending&&convertingId===selectedQuote.id}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-violet-700 border border-violet-200 rounded-lg hover:bg-violet-50 disabled:opacity-50">
                      <RefreshCw size={14}/>{convertMutation.isPending&&convertingId===selectedQuote.id?'Converting...':'Convert to Invoice'}
                    </button>
                  )}
                  {selectedQuote.status==='converted'&&(
                    <button onClick={()=>{ setUnconvertingId(selectedQuote.id); unconvertMutation.mutate(selectedQuote.id); }}
                      disabled={unconvertMutation.isPending&&unconvertingId===selectedQuote.id}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-50 disabled:opacity-50">
                      <RotateCcw size={14}/>{unconvertMutation.isPending&&unconvertingId===selectedQuote.id?'Reverting...':'Unconvert (Reset to Accepted)'}
                    </button>
                  )}
                  {selectedQuote.status!=='converted'&&(
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

      {/* Add/Edit Modal */}
      {modalOpen&&(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 overflow-y-auto py-8">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">{editingId?'Edit Quote':'New Quote'}</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
            </div>
            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError&&<div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{formError}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Customer</label>
                  <select value={form.customerId} onChange={e=>setForm({...form,customerId:e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10">
                    <option value="">Select a customer...</option>
                    {(customers||[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Quote Date</label>
                  <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Expiry Date</label>
                  <input type="date" value={form.expiryDate} onChange={e=>setForm({...form,expiryDate:e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                  <select value={form.status} onChange={e=>setForm({...form,status:e.target.value as QuoteStatus})}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10">
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
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Payment Terms</label>
                <textarea value={form.terms} onChange={e=>setForm({...form,terms:e.target.value})} rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"/>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50">
                  {isSaving?'Saving...':editingId?'Save Changes':'Create Quote'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget&&(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Delete Quote</h2>
            <p className="text-sm text-slate-500 mb-4">Delete <span className="font-medium text-slate-700">{deleteTarget.quoteNumber}</span>? This cannot be undone.</p>
            {deleteError&&<div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 mb-3">{deleteError}</div>}
            <div className="flex justify-end gap-2">
              <button onClick={()=>{ setDeleteTarget(null); setDeleteError(null); }} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
              <button onClick={()=>deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50">
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
            return {
              customerId: row[idx('customerId (or name)')],
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
