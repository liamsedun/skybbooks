import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { CsvImportModal } from '../../components/ui/CsvImportModal';
import { AccountSearchSelect } from '../../components/ui/AccountSearchSelect';
import {
  Upload, Plus, X, Loader2, AlertCircle, Search, CreditCard,
  CheckCircle2, Download, FileText, Eye, Pencil, Save, Trash2,
  Banknote, Smartphone, Building2, Receipt,
} from 'lucide-react';

interface Vendor { id: string; name: string; }
interface Account { id: string; name: string; type: string; }
interface Bill { id: string; billNumber: string; vendorId: string; balanceDue: number; total: number; }
interface Payment {
  id: string; paymentNumber: string; vendorId: string;
  date: string; amount: number; currency: string;
  paymentMethod: string; reference: string | null; notes: string | null;
  accountId?: string;
  journalEntryId?: string | null;
  journalEntryNumber?: string | null;
}
interface PaymentAllocation {
  id: string; paymentId: string; billId: string; amount: number;
}
interface PaymentDetail extends Payment {
  allocations: PaymentAllocation[];
  whtAmount?: number;
  totalAllocated?: number;
}
interface BillLine {
  id: string; billId: string;
  description: string; quantity: number; unitPrice: number;
  taxRate: number; taxAmount: number; lineTotal: number;
  accountId: string | null;
}
interface BillDetail {
  id: string; billNumber: string; vendorId: string;
  date: string; dueDate: string; status: string;
  subtotal: number; taxAmount: number; total: number;
  amountPaid: number; balanceDue: number;
  currency: string; notes: string | null;
  lines: BillLine[];
  vendor: Vendor;
}

const METHOD_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  bank_transfer: { label: 'Bank Transfer', icon: Building2 },
  cash:          { label: 'Cash',          icon: Banknote },
  card:          { label: 'Card',          icon: CreditCard },
  cheque:        { label: 'Cheque',        icon: Receipt },
  pos:           { label: 'POS',           icon: CreditCard },
  ussd:          { label: 'USSD',          icon: Smartphone },
};

const PAYMENT_METHODS = ['bank_transfer', 'cash', 'card', 'cheque', 'pos', 'ussd'];

function exportPaymentsCSV(payments: Payment[], vendorMap: Map<string,string>) {
  const headers = ['Payment #','Vendor','Date','Method','Reference','Amount (₦)'];
  const rows = payments.map(p => [p.paymentNumber, vendorMap.get(p.vendorId)||'', fmtDate(p.date), p.paymentMethod?.replace('_',' ')||'', p.reference||'', (p.amount/100).toFixed(2)]);
  const csv = [headers,...rows].map(r=>r.map(v=>`"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`payments-made-${new Date().toISOString().split('T')[0]}.csv`; a.click(); URL.revokeObjectURL(url);
}

function exportPaymentsPDF(payments: Payment[], vendorMap: Map<string,string>, total: number) {
  const rows = payments.map(p=>`<tr><td>${p.paymentNumber}</td><td>${vendorMap.get(p.vendorId)||'—'}</td><td>${fmtDate(p.date)}</td><td>${p.paymentMethod?.replace('_',' ')||'—'}</td><td>${p.reference||'—'}</td><td style="text-align:right">${formatNaira(p.amount)}</td></tr>`).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Payments Made</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;color:#1e293b;padding:40px;font-size:13px}.header{display:flex;justify-content:space-between;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #0f172a}.company{font-size:22px;font-weight:800}.subtitle{font-size:11px;color:#64748b;margin-top:4px}.title{font-size:18px;font-weight:700;text-align:right}.date{font-size:11px;color:#64748b;margin-top:4px;text-align:right}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#0f172a;color:#fff;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase}td{padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px}tr:nth-child(even) td{background:#f8fafc}.total-row td{font-weight:700;background:#f1f5f9;border-top:2px solid #0f172a}.footer{margin-top:40px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px}@media print{body{padding:20px}}</style></head><body><div class="header"><div><div class="company">SkyBooks</div><div class="subtitle">By Skyhouse Accountants &amp; Technologies</div></div><div><div class="title">Payments Made</div><div class="date">Generated: ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</div></div></div><table><thead><tr><th>Payment #</th><th>Vendor</th><th>Date</th><th>Method</th><th>Reference</th><th style="text-align:right">Amount</th></tr></thead><tbody>${rows}</tbody><tfoot><tr class="total-row"><td colspan="5"><strong>Total (${payments.length} payments)</strong></td><td style="text-align:right">${formatNaira(total)}</td></tr></tfoot></table><div class="footer">SkyBooks By Skyhouse Accountants &amp; Technologies (Olalekan Williams Edun) &bull; Confidential</div></body></html>`;
  const w = window.open('','_blank'); if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),500);}
}

function formatNaira(kobo: number) {
  return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }

export function PaymentsMadePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [form, setForm] = useState({
    vendorId: '', date: new Date().toISOString().split('T')[0],
    amount: '', whtAmount: '', paymentMethod: 'bank_transfer',
    reference: '', notes: '', accountId: '',
    allocations: [] as { billId: string; amount: string }[],
  });

  const [searchParams] = useSearchParams();

  // Detail panel state
  const [detailPaymentId, setDetailPaymentId] = useState<string | null>(null);

  useEffect(() => {
    const selected = searchParams.get('selected');
    if (selected) setDetailPaymentId(selected);
    const vendorId = searchParams.get('vendor');
    if (vendorId) {
      setForm(f => ({ ...f, vendorId }));
      setModalOpen(true);
      setFormError(null);
    }
  }, [searchParams]);

  // Edit modal state
  const [editTarget, setEditTarget] = useState<Payment | null>(null);
  const [editForm, setEditForm] = useState({
    date: '', amount: '', paymentMethod: '', reference: '', notes: '', accountId: ''
  });
  const [editFormError, setEditFormError] = useState('');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Bill viewing modal state
  const [viewBillId, setViewBillId] = useState<string | null>(null);

  const { data: payments = [], isLoading, isError } = useQuery<Payment[]>({
    queryKey: ['payments-made'],
    queryFn: async () => { const r = await api.get('/purchases/payments'); return r.data; },
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ['vendors'],
    queryFn: async () => { const r = await api.get('/purchases/vendors'); return r.data; },
  });

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: async () => { const r = await api.get('/accountant/accounts'); return r.data; },
  });

  const { data: allBills = [] } = useQuery<Bill[]>({
    queryKey: ['bills-open'],
    queryFn: async () => {
      const r = await api.get('/purchases/bills', { params: { limit: 100 } });
      return r.data?.bills || [];
    },
  });

  const { data: org } = useQuery<any>({
    queryKey: ['org'],
    queryFn: async () => { const r = await api.get('/org'); return r.data; },
    staleTime: 60000,
  });

  // Fetch payment detail
  const { data: paymentDetail, isLoading: loadingDetail } = useQuery<PaymentDetail>({
    queryKey: ['payment-detail', detailPaymentId],
    queryFn: async () => { const r = await api.get(`/purchases/payments/${detailPaymentId}`); return r.data; },
    enabled: !!detailPaymentId,
  });

  // Fetch bill detail for viewing
  const { data: billDetail } = useQuery<BillDetail>({
    queryKey: ['bill-detail', viewBillId],
    queryFn: async () => { const r = await api.get(`/purchases/bills/${viewBillId}`); return r.data; },
    enabled: !!viewBillId,
  });

  const vendorMap = useMemo(() => new Map(vendors.map(v => [v.id, v.name])), [vendors]);
  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a.name])), [accounts]);
  const billNumberMap = useMemo(() => new Map(allBills.map(b => [b.id, b.billNumber])), [allBills]);
  const assetAccounts = useMemo(() => accounts.filter(a => a.type === 'asset'), [accounts]);

  const vendorBills = useMemo(() =>
    allBills.filter(b => b.vendorId === form.vendorId && b.balanceDue > 0),
    [allBills, form.vendorId]
  );

  const methods = useMemo(() => Array.from(new Set(payments.map(p => p.paymentMethod))), [payments]);

  const filtered = useMemo(() => {
    const t = search.toLowerCase();
    return payments.filter(p => {
      if (methodFilter !== 'all' && p.paymentMethod !== methodFilter) return false;
      return !t || p.paymentNumber.toLowerCase().includes(t) ||
        (vendorMap.get(p.vendorId) || '').toLowerCase().includes(t) ||
        (p.reference || '').toLowerCase().includes(t);
    });
  }, [payments, search, vendorMap, methodFilter]);

  const totals = useMemo(() => ({
    count: filtered.length,
    sum: filtered.reduce((s, p) => s + p.amount, 0),
  }), [filtered]);

  const selectedPayment = detailPaymentId ? payments.find(p => p.id === detailPaymentId) : null;

  const createMutation = useMutation({
    mutationFn: (p: any) => api.post('/purchases/payments', p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments-made'] });
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      queryClient.invalidateQueries({ queryKey: ['bills-open'] });
      closeModal();
      showSuccess('Payment recorded successfully.');
    },
    onError: (e: any) => setFormError(e?.response?.data?.error || 'Failed to record payment.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/purchases/payments/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments-made'] });
      queryClient.invalidateQueries({ queryKey: ['payment-detail'] });
      setEditTarget(null);
      showSuccess('Payment updated successfully.');
    },
    onError: (e: any) => setEditFormError(e?.response?.data?.message || 'Failed to update payment.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/purchases/payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments-made'] });
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      queryClient.invalidateQueries({ queryKey: ['bills-open'] });
      setDetailPaymentId(null);
      setDeleteTarget(null);
      setDeleteError(null);
    },
    onError: (e: any) => setDeleteError(e?.response?.data?.error || 'Failed to delete payment.'),
  });

  function showSuccess(msg: string) { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 4000); }

  function closeModal() {
    setModalOpen(false);
    setForm({ vendorId: '', date: new Date().toISOString().split('T')[0], amount: '', whtAmount: '', paymentMethod: 'bank_transfer', reference: '', notes: '', accountId: '', allocations: [] });
    setFormError(null);
  }

  function onVendorChange(vendorId: string) {
    setForm({ ...form, vendorId, allocations: [] });
  }

  function toggleBillAllocation(billId: string, balanceDue: number) {
    const existing = form.allocations.find(a => a.billId === billId);
    if (existing) {
      setForm({ ...form, allocations: form.allocations.filter(a => a.billId !== billId) });
    } else {
      setForm({ ...form, allocations: [...form.allocations, { billId, amount: (balanceDue / 100).toFixed(2) }] });
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vendorId) { setFormError('Please select a vendor.'); return; }
    if (!form.accountId) { setFormError('Please select a bank/cash account.'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { setFormError('Amount must be greater than zero.'); return; }
    if (form.allocations.length === 0) { setFormError('Please allocate this payment to at least one bill.'); return; }
    const totalAlloc = form.allocations.reduce((s, a) => s + Math.round(parseFloat(a.amount) * 100), 0);
    const netAmount = Math.round(parseFloat(form.amount) * 100);
    const whtKobo = Math.round((parseFloat(form.whtAmount) || 0) * 100);
    if (totalAlloc !== netAmount + whtKobo) {
      setFormError(`Allocated sum (₦${(totalAlloc/100).toFixed(2)}) must match net amount plus WHT (₦${((netAmount+whtKobo)/100).toFixed(2)}).`);
      return;
    }

    createMutation.mutate({
      vendorId: form.vendorId,
      date: form.date,
      amount: Math.round(parseFloat(form.amount) * 100),
      whtAmount: Math.round((parseFloat(form.whtAmount) || 0) * 100),
      currency: 'NGN',
      paymentMethod: form.paymentMethod,
      reference: form.reference || null,
      notes: form.notes || null,
      accountId: form.accountId,
      allocations: form.allocations.map(a => ({
        billId: a.billId,
        amount: Math.round(parseFloat(a.amount) * 100),
      })),
    });
  }

  // Edit handlers
  function openEditModal(p: Payment) {
    setEditTarget(p);
    setEditForm({
      date: p.date ? p.date.split('T')[0] : '',
      amount: (p.amount / 100).toFixed(2),
      paymentMethod: p.paymentMethod,
      reference: p.reference || '',
      notes: p.notes || '',
      accountId: p.accountId || '',
    });
    setEditFormError('');
  }

  function handleUpdatePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setEditFormError('');
    const amt = parseFloat(editForm.amount);
    if (isNaN(amt) || amt <= 0) { setEditFormError('Amount must be greater than zero.'); return; }
    if (!editForm.date) { setEditFormError('Date is required.'); return; }

    const payload: any = {
      date: editForm.date,
      amount: Math.round(amt * 100),
      paymentMethod: editForm.paymentMethod,
      reference: editForm.reference || null,
      notes: editForm.notes || null,
    };
    if (editForm.accountId) payload.accountId = editForm.accountId;

    updateMutation.mutate({ id: editTarget.id, data: payload });
  }

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const thisMonthPaid = payments.filter(p => {
    const d = new Date(p.date); const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((s, p) => s + p.amount, 0);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payments Made</h1>
          <p className="text-sm text-slate-500 mt-1">
            {totals.count} payments · {formatNaira(totals.sum)} total disbursed
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setModalOpen(true); setFormError(null); }}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors">
            <Plus size={14} />Record Payment
          </button>
          <button onClick={() => exportPaymentsCSV(filtered, vendorMap)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">
            <Download size={14} /> CSV
          </button>
          <button onClick={() => exportPaymentsPDF(filtered, vendorMap, totals.sum)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">
            <FileText size={14} /> PDF
          </button>
          <button onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white text-slate-700 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            <Upload size={14} />Import CSV
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 mb-6">
          <CheckCircle2 size={16} /> {successMsg}
        </div>
      )}

      {actionError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700 mb-6">
          <AlertCircle size={16} /> {actionError}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Total Disbursed</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{formatNaira(totalPaid)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">This Month</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{formatNaira(thisMonthPaid)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Total Count</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{payments.length} payments</p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* List panel */}
        <div className={`flex-1 min-w-0 ${detailPaymentId ? 'hidden lg:block' : ''}`}>
          {/* Filter chips */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button onClick={() => setMethodFilter('all')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${methodFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
              All Methods
            </button>
            {methods.map(m => (
              <button key={m} onClick={() => setMethodFilter(m)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${methodFilter === m ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                {METHOD_META[m]?.label || m}
              </button>
            ))}
          </div>

          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by payment number, vendor, or reference..." className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-slate-400">
                <Loader2 size={20} className="animate-spin mr-2" />Loading payments...
              </div>
            ) : isError ? (
              <div className="flex items-center justify-center gap-2 py-16 text-rose-500 text-sm">
                <AlertCircle size={16} />Failed to load payments.
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <CreditCard size={28} className="text-slate-300 mb-3" />
                <p className="text-sm font-medium text-slate-600">{search || methodFilter !== 'all' ? 'No matching payments' : 'No payments recorded yet'}</p>
                <p className="text-xs text-slate-400 mt-1">Record a payment to track vendor disbursements.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
                    <th className="py-2.5 pl-4 pr-3">Payment #</th>
                    <th className="py-2.5 pr-3">Vendor</th>
                    <th className="py-2.5 pr-3">Date</th>
                    <th className="py-2.5 pr-3">Method</th>
                    <th className="py-2.5 pr-3 text-right">Amount</th>
                    <th className="py-2.5 pr-3 text-center">Ledger</th>
                    <th className="py-2.5 pr-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(p => {
                    const meta = METHOD_META[p.paymentMethod] || { label: p.paymentMethod, icon: Banknote };
                    const Icon = meta.icon;
                    const isSelected = p.id === detailPaymentId;
                    return (
                      <tr key={p.id} onClick={() => setDetailPaymentId(isSelected ? null : p.id)}
                        className={`group cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : 'hover:bg-slate-50'}`}>
                        <td className="py-2.5 pl-4 pr-3">
                          <p className="font-mono text-sm font-semibold text-slate-700">{p.paymentNumber}</p>
                        </td>
                        <td className="py-2.5 pr-3">
                          <p className="text-sm font-medium text-slate-800">{vendorMap.get(p.vendorId) || '—'}</p>
                        </td>
                        <td className="py-2.5 pr-3 text-sm text-slate-500">{fmtDate(p.date)}</td>
                        <td className="py-2.5 pr-3">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                            <Icon className="w-3.5 h-3.5 text-slate-400" />
                            {meta.label}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-right font-semibold text-rose-700 font-mono">{formatNaira(p.amount)}</td>
                        <td className="py-2.5 pr-3 text-center">
                          {p.journalEntryId ? (
                            <button onClick={(e) => { e.stopPropagation(); navigate(`/accountant/journals?entry=${p.journalEntryNumber || ''}`); }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                            ><CheckCircle2 className="w-3 h-3" /> Posted</button>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">Not posted</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-2">
                          <div className="opacity-0 group-hover:opacity-100 flex items-center justify-end gap-1 transition-opacity" onClick={e => e.stopPropagation()}>
                            <button onClick={() => openEditModal(p)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100" title="Edit payment">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => { setDeleteTarget(p); setDeleteError(null); }}
                              className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Reverse payment">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td colSpan={4} className="py-2.5 pl-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {filtered.length} payments shown
                    </td>
                    <td className="py-2.5 pr-3 text-right font-bold text-slate-800 font-mono">{formatNaira(totals.sum)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>

        {/* Detail panel */}
        {detailPaymentId && (
          <div className="w-full lg:w-96 shrink-0">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden sticky top-6">
              {loadingDetail ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                  <Loader2 size={18} className="animate-spin mr-2" />Loading...
                </div>
              ) : paymentDetail ? (
                <>
                  {/* Voucher header */}
                  <div className="px-5 pt-5 pb-3 border-b border-slate-100">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {org?.logoUrl ? (
                          <img src={org.logoUrl} alt="" className="w-10 h-10 rounded-lg object-contain border border-slate-200 bg-white p-1" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">{(org?.name||'S')[0].toUpperCase()}</div>
                        )}
                        <div>
                          <p className="text-sm font-bold text-slate-900">{org?.name || 'Your Company'}</p>
                          {org?.address && <p className="text-[10px] text-slate-400 leading-tight">{org.address}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => selectedPayment && openEditModal(selectedPayment)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100" title="Edit">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => setDetailPaymentId(null)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-widest">Payment Voucher</p>
                    <p className="text-lg font-bold text-slate-900 mt-0.5 tracking-tight">{paymentDetail.paymentNumber}</p>
                  </div>

                  {/* Voucher body */}
                  <div className="p-5 space-y-4">
                    {/* Info grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                      <div>
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Vendor</p>
                        <p className="font-semibold text-slate-800 mt-0.5">{vendorMap.get(paymentDetail.vendorId) || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Date</p>
                        <p className="font-semibold text-slate-800 mt-0.5">{fmtDate(paymentDetail.date)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Method</p>
                        <p className="font-semibold text-slate-800 mt-0.5 capitalize">{paymentDetail.paymentMethod?.replace('_', ' ')}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Account</p>
                        <p className="font-semibold text-slate-800 mt-0.5">{accountMap.get(paymentDetail.accountId || '') || '—'}</p>
                      </div>
                      {paymentDetail.reference && (
                        <div className="col-span-2">
                          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Reference</p>
                          <p className="font-semibold text-slate-800 mt-0.5 text-xs font-mono">{paymentDetail.reference}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Currency</p>
                        <p className="font-semibold text-slate-800 mt-0.5">{paymentDetail.currency || 'NGN'}</p>
                      </div>
                    </div>

                    {/* Allocations table */}
                    {paymentDetail.allocations && paymentDetail.allocations.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Allocated Bills</p>
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-slate-50">
                                <th className="text-left px-3 py-2 font-medium text-slate-500">Bill #</th>
                                <th className="text-right px-3 py-2 font-medium text-slate-500">Amount</th>
                                <th className="w-0 px-3 py-2"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {paymentDetail.allocations.map(alloc => (
                                <tr key={alloc.id} className="hover:bg-slate-50">
                                  <td className="px-3 py-2 font-mono font-medium text-slate-800">
                                    {billNumberMap.get(alloc.billId) || alloc.billId.substring(0, 8) + '...'}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono font-semibold text-rose-700">{formatNaira(alloc.amount)}</td>
                                  <td className="px-3 py-2">
                                    <button onClick={() => setViewBillId(alloc.billId)}
                                      className="text-indigo-600 hover:text-indigo-800 underline font-medium whitespace-nowrap">
                                      View Bill
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* WHT Analysis */}
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <tbody className="divide-y divide-slate-100">
                          <tr>
                            <td className="px-3 py-2 text-slate-500">Total Bills Credited</td>
                            <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800">{formatNaira(paymentDetail.totalAllocated || paymentDetail.amount)}</td>
                          </tr>
                          {(paymentDetail.whtAmount || 0) > 0 && (
                            <tr>
                              <td className="px-3 py-2 text-slate-500">Less: WHT Withheld</td>
                              <td className="px-3 py-2 text-right font-mono font-medium text-amber-600">−{formatNaira(paymentDetail.whtAmount!)}</td>
                            </tr>
                          )}
                          <tr className="bg-slate-50">
                            <td className="px-3 py-2.5 text-sm font-semibold text-slate-700">Net Paid to Vendor</td>
                            <td className="px-3 py-2.5 text-right text-base font-black text-rose-700 font-mono">{formatNaira(paymentDetail.amount)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Notes */}
                    {paymentDetail.notes && (
                      <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                        <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-1">Notes</p>
                        <p className="text-sm text-amber-800 leading-relaxed">{paymentDetail.notes}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => {
                        const logoHtml = org?.logoUrl
                          ? `<img src="${org.logoUrl}" alt="" style="width:48px;height:48px;border-radius:8px;object-fit:contain;border:1px solid #e2e8f0;background:white;padding:4px"/>`
                          : `<div style="width:48px;height:48px;border-radius:8px;background:#4f46e5;display:flex;align-items:center;justify-content:center;color:white;font-size:22px;font-weight:bold">${(org?.name||'S')[0].toUpperCase()}</div>`;
                        const allocRows = (paymentDetail.allocations||[]).map(a => `<tr><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;font-family:monospace;color:#334155;font-weight:500">${billNumberMap.get(a.billId)||a.billId.substring(0,8)+'...'}</td><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;text-align:right;color:#dc2626;font-family:monospace;font-weight:600">${formatNaira(a.amount)}</td></tr>`).join('');
                        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Payment Voucher ${paymentDetail.paymentNumber}</title>
                        <style>
                          *{margin:0;padding:0;box-sizing:border-box}
                          body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b;padding:40px;font-size:13px}
                          @media print{body{padding:20px}}
                        </style></head><body>
                          <div style="height:4px;background:linear-gradient(90deg,#4f46e5,#7c3aed,#818cf8);border-radius:2px;margin-bottom:28px"></div>
                          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:28px">
                            <div style="display:flex;align-items:flex-start;gap:12px">
                              ${logoHtml}
                              <div>
                                <h2 style="font-size:16px;font-weight:bold;color:#0f172a;margin:0">${org?.name||'Your Company'}</h2>
                                ${org?.address ? `<p style="font-size:11px;color:#64748b;margin:3px 0">${org.address}</p>` : ''}
                                <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:2px">
                                  ${org?.phone ? `<span style="font-size:10px;color:#64748b">${org.phone}</span>` : ''}
                                  ${org?.email ? `<span style="font-size:10px;color:#64748b">${org.email}</span>` : ''}
                                  ${org?.website ? `<span style="font-size:10px;color:#4f46e5">${org.website}</span>` : ''}
                                </div>
                              </div>
                            </div>
                            <div style="text-align:right">
                              <p style="font-size:10px;font-weight:600;color:#4f46e5;text-transform:uppercase;letter-spacing:0.12em;margin:0 0 4px 0">Payment Voucher</p>
                              <p style="font-size:22px;font-weight:bold;color:#0f172a;margin:0;letter-spacing:-0.02em">${paymentDetail.paymentNumber}</p>
                              <p style="font-size:10px;color:#64748b;margin-top:4px">${fmtDate(paymentDetail.date)}</p>
                            </div>
                          </div>
                          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:16px 20px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:24px">
                            <div>
                              <p style="font-size:9px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 4px 0">Paid To</p>
                              <p style="font-size:14px;font-weight:bold;color:#0f172a;margin:0">${vendorMap.get(paymentDetail.vendorId)||'—'}</p>
                              <p style="font-size:11px;color:#64748b;margin-top:4px">Method: <span style="text-transform:capitalize;font-weight:500">${paymentDetail.paymentMethod?.replace('_',' ')}</span></p>
                              <p style="font-size:11px;color:#64748b;margin-top:2px">Account: ${accountMap.get(paymentDetail.accountId||'')||'—'}</p>
                              ${paymentDetail.reference ? `<p style="font-size:11px;color:#64748b;margin-top:2px">Reference: ${paymentDetail.reference}</p>` : ''}
                              <p style="font-size:11px;color:#64748b;margin-top:2px">Currency: ${paymentDetail.currency||'NGN'}</p>
                            </div>
                          </div>
                          <table style="width:100%;border-collapse:collapse">
                            <thead>
                              <tr style="background:#0f172a">
                                <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:600;color:white;text-transform:uppercase;letter-spacing:0.06em">Bill #</th>
                                <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:600;color:white;text-transform:uppercase;letter-spacing:0.06em">Amount Paid</th>
                              </tr>
                            </thead>
                            <tbody>${allocRows||'<tr><td colspan="2" style="text-align:center;padding:20px;color:#94a3b8">No allocations</td></tr>'}</tbody>
                            <tfoot>
                              <tr style="background:#f8fafc">
                                <td style="padding:8px 12px;font-size:12px;color:#475569">Total Bills Credited</td>
                                <td style="padding:8px 12px;font-size:12px;font-weight:600;color:#334155;text-align:right;font-family:monospace">${formatNaira(paymentDetail.totalAllocated || paymentDetail.amount)}</td>
                              </tr>
                              ${(paymentDetail.whtAmount||0) > 0 ? `<tr>
                                <td style="padding:8px 12px;font-size:12px;color:#475569">Less: WHT Withheld</td>
                                <td style="padding:8px 12px;font-size:12px;font-weight:500;color:#d97706;text-align:right;font-family:monospace">−${formatNaira(paymentDetail.whtAmount!)}</td>
                              </tr>` : ''}
                              <tr style="background:#f1f5f9">
                                <td style="padding:10px 12px;font-size:13px;font-weight:700;color:#0f172a">Net Paid to Vendor</td>
                                <td style="padding:10px 12px;font-size:13px;font-weight:800;color:#dc2626;text-align:right;font-family:monospace">${formatNaira(paymentDetail.amount)}</td>
                              </tr>
                            </tfoot>
                          </table>
                          ${paymentDetail.notes ? `<div style="margin-top:20px;padding:12px 16px;background:#fefce8;border:1px solid #fde68a;border-radius:8px;font-size:11px;color:#92400e"><strong style="font-weight:600">Notes:</strong> ${paymentDetail.notes}</div>` : ''}
                          <div style="text-align:center;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px;margin-top:40px">${org?.name||'SkyBooks'} · Payment Voucher · Generated ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</div>
                        </body></html>`;
                        const w = window.open('','_blank');
                        if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),500);}
                      }}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                        <FileText size={14} /> Print PDF
                      </button>
                      <button onClick={() => { setDeleteTarget(selectedPayment!); setDeleteError(null); }}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50 transition-colors">
                        <Trash2 size={14} />Reverse
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 overflow-y-auto py-8">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Record Payment to Vendor</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3 max-h-[75vh] overflow-y-auto">
              {formError && (
                <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{formError}</div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Vendor *</label>
                <select value={form.vendorId} onChange={e => onVendorChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
                  <option value="">Select vendor...</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Net Amount to Vendor (₦) *</label>
                  <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                  <p className="text-[10px] text-slate-400 mt-0.5">Bill total minus WHT deducted</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">WHT Deducted (₦)</label>
                  <input type="number" min="0" step="0.01" value={form.whtAmount} onChange={e => setForm({ ...form, whtAmount: e.target.value })} placeholder="0.00"
                    className="w-full px-3 py-2 text-sm border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-900/10" />
                  <p className="text-[10px] text-amber-600 font-medium mt-1">Withholding Tax — credited to WHT Payable GL, owed to FIRS.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Payment Date</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Payment Method</label>
                  <select value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{METHOD_META[m]?.label || m}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Paid From Account *</label>
                <AccountSearchSelect
                  accounts={assetAccounts}
                  value={form.accountId}
                  onChange={id => setForm({ ...form, accountId: id })}
                  placeholder="Select account..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Reference</label>
                <input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} placeholder="Transfer ref / cheque no."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              </div>

              {form.vendorId && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Allocate to Bills *</label>
                  {vendorBills.length === 0 ? (
                    <p className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-3 py-3">No open bills for this vendor.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {vendorBills.map(b => {
                        const alloc = form.allocations.find(a => a.billId === b.id);
                        return (
                          <label key={b.id} className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer ${alloc ? 'bg-indigo-50 border-indigo-200' : 'border-slate-200 hover:bg-slate-50'}`}>
                            <input type="checkbox" checked={!!alloc} onChange={() => toggleBillAllocation(b.id, b.balanceDue)}
                              className="h-4 w-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800">{b.billNumber}</p>
                              <p className="text-xs text-slate-400">Balance: {formatNaira(b.balanceDue)}</p>
                            </div>
                            {alloc && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-slate-400">₦</span>
                                <input type="number" min="0" step="0.01" value={alloc.amount}
                                  onChange={e => {
                                    const updated = form.allocations.map(a => a.billId === b.id ? { ...a, amount: e.target.value } : a);
                                    setForm({ ...form, allocations: updated });
                                  }}
                                  onClick={e => e.stopPropagation()}
                                  className="w-28 px-2 py-1 text-xs border border-indigo-200 rounded focus:outline-none text-right bg-white" />
                              </div>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none resize-none" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                <button type="submit" disabled={createMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50">
                  {createMutation.isPending ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Edit Payment — {editTarget.paymentNumber}</h2>
              <button onClick={() => setEditTarget(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleUpdatePayment} className="px-5 py-4 space-y-3">
              {editFormError && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{editFormError}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
                  <input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Amount (₦)</label>
                  <input type="number" min="0" step="0.01" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Payment Method</label>
                  <select value={editForm.paymentMethod} onChange={e => setEditForm({ ...editForm, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{METHOD_META[m]?.label || m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Reference</label>
                  <input value={editForm.reference} onChange={e => setEditForm({ ...editForm, reference: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Paid From Account</label>
                <AccountSearchSelect
                  accounts={assetAccounts}
                  value={editForm.accountId}
                  onChange={id => setEditForm({ ...editForm, accountId: id })}
                  placeholder="Select account..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                <textarea value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none resize-none" />
              </div>
              <p className="text-xs text-slate-400">Note: Amount and allocation cannot be edited after recording. Reverse and re-record if needed.</p>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditTarget(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                <button type="submit" disabled={updateMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50">
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Reverse Payment</h2>
            <p className="text-sm text-slate-500 mb-4">
              Reverse <span className="font-medium text-slate-700">{deleteTarget.paymentNumber}</span> ({formatNaira(deleteTarget.amount)})?
              This will restore any bill balance due and reverse the journal entries.
            </p>
            {deleteError && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 mb-3">{deleteError}</div>}
            <div className="flex justify-end gap-2">
              <button onClick={() => { setDeleteTarget(null); setDeleteError(null); }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50">
                {deleteMutation.isPending ? 'Reversing...' : 'Reverse Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bill Viewing Modal */}
      {viewBillId && billDetail && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 px-4 py-8 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{billDetail.billNumber}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{billDetail.vendor?.name || '—'}</p>
              </div>
              <button onClick={() => setViewBillId(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Status</span>
                  <p className="font-semibold mt-1 capitalize">{billDetail.status}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Date</span>
                  <p className="font-semibold text-slate-700 mt-1">{fmtDate(billDetail.date)}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Due Date</span>
                  <p className="font-semibold text-slate-700 mt-1">{fmtDate(billDetail.dueDate)}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Currency</span>
                  <p className="font-semibold text-slate-700 mt-1">{billDetail.currency}</p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide">
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-right w-16">Qty</th>
                      <th className="px-3 py-2 text-right w-24">Unit Price</th>
                      <th className="px-3 py-2 text-right w-20">Tax</th>
                      <th className="px-3 py-2 text-right w-24">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {billDetail.lines?.map((line: BillLine) => (
                      <tr key={line.id}>
                        <td className="px-3 py-2 text-slate-700">{line.description}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{line.quantity}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{formatNaira(line.unitPrice)}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{formatNaira(line.taxAmount)}</td>
                        <td className="px-3 py-2 text-right font-medium text-slate-700">{formatNaira(line.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 text-sm font-semibold">
                      <td colSpan={4} className="px-3 py-2 text-slate-600">Subtotal</td>
                      <td className="px-3 py-2 text-right text-slate-700">{formatNaira(billDetail.subtotal)}</td>
                    </tr>
                    <tr className="bg-slate-50 text-sm">
                      <td colSpan={4} className="px-3 py-2 text-slate-600">Tax</td>
                      <td className="px-3 py-2 text-right text-slate-600">{formatNaira(billDetail.taxAmount)}</td>
                    </tr>
                    <tr className="bg-slate-50 text-sm font-bold">
                      <td colSpan={4} className="px-3 py-2 text-slate-800">Total</td>
                      <td className="px-3 py-2 text-right text-slate-900">{formatNaira(billDetail.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Amount Paid</span>
                  <p className="font-semibold text-green-600 mt-1">{formatNaira(billDetail.amountPaid)}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Balance Due</span>
                  <p className="font-semibold text-slate-900 mt-1">{formatNaira(billDetail.balanceDue)}</p>
                </div>
              </div>

              {billDetail.notes && (
                <p className="text-sm text-slate-500 italic">Notes: {billDetail.notes}</p>
              )}
            </div>
            <div className="flex justify-end px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-xl">
              <button onClick={() => setViewBillId(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {importOpen && (
        <CsvImportModal
          entity="paymentsMade"
          endpoint="/purchases/payments"
          onClose={() => setImportOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['payments-made'] });
            queryClient.invalidateQueries({ queryKey: ['bills'] });
            queryClient.invalidateQueries({ queryKey: ['bills-open'] });
          }}
          transformRow={(row, headers) => {
            const get = (key: string) => {
              const idx = headers.findIndex(h => h.startsWith(key));
              return idx >= 0 ? (row[idx] || '').trim() : '';
            };
            return {
              vendorId: get('vendorId'),
              date: get('date') || undefined,
              amount: Math.round(parseFloat(get('amount')) * 100) || 0,
              currency: 'NGN',
              paymentMethod: get('paymentMethod'),
              reference: get('reference') || null,
              notes: get('notes') || null,
              accountId: '',
              allocations: [],
            };
          }}
        />
      )}
    </div>
  );
}

export default PaymentsMadePage;
