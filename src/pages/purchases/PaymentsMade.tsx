import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { CsvImportModal } from '../../components/ui/CsvImportModal';
import {
  Upload, Plus, X, Loader2, AlertCircle, Search, CreditCard,
  CheckCircle2, Download, FileText, Eye, Pencil, Save
} from 'lucide-react';

interface Vendor { id: string; name: string; }
interface Account { id: string; name: string; type: string; }
interface Bill { id: string; billNumber: string; vendorId: string; balanceDue: number; total: number; }
interface Payment {
  id: string; paymentNumber: string; vendorId: string;
  date: string; amount: number; currency: string;
  paymentMethod: string; reference: string | null; notes: string | null;
  accountId?: string;
}
interface PaymentAllocation {
  id: string; paymentId: string; billId: string; amount: number;
}
interface PaymentDetail extends Payment {
  allocations: PaymentAllocation[];
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

const PAYMENT_METHODS = ['cash', 'bank_transfer', 'card', 'cheque', 'pos', 'ussd'];

export function PaymentsMadePage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    vendorId: '', date: new Date().toISOString().split('T')[0],
    amount: '', paymentMethod: 'bank_transfer',
    reference: '', notes: '', accountId: '',
    allocations: [] as { billId: string; amount: string }[],
  });

  // Detail modal state
  const [detailPaymentId, setDetailPaymentId] = useState<string | null>(null);
  const [detailEditMode, setDetailEditMode] = useState(false);
  const [detailForm, setDetailForm] = useState({
    date: '', amount: '', paymentMethod: '', reference: '', notes: '', accountId: ''
  });
  const [detailFormError, setDetailFormError] = useState('');

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
      const r = await api.get('/purchases/bills', { params: { status: 'open', limit: 100 } });
      return r.data?.bills || [];
    },
  });

  // Fetch payment detail
  const { data: paymentDetail, refetch: refetchDetail } = useQuery<PaymentDetail>({
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
  const assetAccounts = useMemo(() => accounts.filter(a => a.type === 'asset'), [accounts]);

  const vendorBills = useMemo(() =>
    allBills.filter(b => b.vendorId === form.vendorId && b.balanceDue > 0),
    [allBills, form.vendorId]
  );

  const filtered = useMemo(() => {
    const t = search.toLowerCase();
    return payments.filter(p =>
      !t || p.paymentNumber.toLowerCase().includes(t) ||
      (vendorMap.get(p.vendorId) || '').toLowerCase().includes(t) ||
      (p.reference || '').toLowerCase().includes(t)
    );
  }, [payments, search, vendorMap]);

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
      setDetailEditMode(false);
      showSuccess('Payment updated successfully.');
    },
    onError: (e: any) => setDetailFormError(e?.response?.data?.message || 'Failed to update payment.'),
  });

  function showSuccess(msg: string) { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 4000); }

  function closeModal() {
    setModalOpen(false);
    setForm({ vendorId: '', date: new Date().toISOString().split('T')[0], amount: '', paymentMethod: 'bank_transfer', reference: '', notes: '', accountId: '', allocations: [] });
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

    createMutation.mutate({
      vendorId: form.vendorId,
      date: form.date,
      amount: Math.round(parseFloat(form.amount) * 100),
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

  // Detail modal handlers
  function openDetail(payment: Payment) {
    setDetailPaymentId(payment.id);
    setDetailEditMode(false);
    setDetailFormError('');
  }

  function closeDetail() {
    setDetailPaymentId(null);
    setDetailEditMode(false);
    setDetailFormError('');
  }

  function enableDetailEdit() {
    if (!paymentDetail) return;
    setDetailForm({
      date: paymentDetail.date ? paymentDetail.date.split('T')[0] : '',
      amount: (paymentDetail.amount / 100).toFixed(2),
      paymentMethod: paymentDetail.paymentMethod,
      reference: paymentDetail.reference || '',
      notes: paymentDetail.notes || '',
      accountId: paymentDetail.accountId || '',
    });
    setDetailEditMode(true);
    setDetailFormError('');
  }

  function handleUpdatePayment() {
    if (!detailPaymentId) return;
    setDetailFormError('');
    const amt = parseFloat(detailForm.amount);
    if (isNaN(amt) || amt <= 0) { setDetailFormError('Amount must be greater than zero.'); return; }
    if (!detailForm.date) { setDetailFormError('Date is required.'); return; }

    const payload: any = {
      date: detailForm.date,
      amount: Math.round(amt * 100),
      paymentMethod: detailForm.paymentMethod,
      reference: detailForm.reference || null,
      notes: detailForm.notes || null,
    };
    if (detailForm.accountId) payload.accountId = detailForm.accountId;

    updateMutation.mutate({ id: detailPaymentId, data: payload });
  }

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Payments Made</h1>
          <p className="text-sm text-slate-500 mt-0.5">{payments.length} payments · {formatNaira(totalPaid)} total disbursed</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportPaymentsCSV(filtered, vendorMap)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            <Download size={14} /> CSV
          </button>
          <button onClick={() => exportPaymentsPDF(filtered, vendorMap, filtered.reduce((s,p)=>s+p.amount,0))} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            <FileText size={14} /> PDF
          </button>
          <button onClick={() => setImportOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            <Upload size={14} /> Import CSV
          </button>
          <button onClick={() => { setModalOpen(true); setFormError(null); }} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">
            <Plus size={15} /> Record Payment
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
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search payments..." className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 bg-white border border-slate-200 rounded-xl">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading payments...
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center py-16 text-rose-500 gap-2 bg-white border border-slate-200 rounded-xl">
          <AlertCircle size={18} /> Failed to load payments.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
          <CreditCard size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">{search ? 'No matching payments' : 'No payments recorded yet'}</p>
          {!search && <p className="text-xs text-slate-400 mt-1">Record a payment to track vendor disbursements</p>}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide border-b border-slate-200">
                <th className="py-3 pl-4 pr-2 text-left">Payment #</th>
                <th className="py-3 px-2 text-left">Vendor</th>
                <th className="py-3 px-2 text-left">Date</th>
                <th className="py-3 px-2 text-left">Method</th>
                <th className="py-3 px-2 text-left">Reference</th>
                <th className="py-3 px-2 text-right">Amount</th>
                <th className="py-3 px-2 text-center w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 pl-4 pr-2 font-mono text-xs font-medium text-slate-700">{p.paymentNumber}</td>
                  <td className="py-3 px-2 font-medium text-slate-900">{vendorMap.get(p.vendorId) || '—'}</td>
                  <td className="py-3 px-2 text-xs text-slate-500">{fmtDate(p.date)}</td>
                  <td className="py-3 px-2">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full capitalize">{p.paymentMethod?.replace('_', ' ')}</span>
                  </td>
                  <td className="py-3 px-2 text-xs text-slate-500 font-mono">{p.reference || '—'}</td>
                  <td className="py-3 px-2 text-right font-mono font-medium text-slate-900">{formatNaira(p.amount)}</td>
                  <td className="py-3 px-2 text-center">
                    <button onClick={() => openDetail(p)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors"
                      title="View payment">
                      <Eye size={12} /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Record Payment Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 px-4 py-8 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Record Payment to Vendor</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {formError && (
                <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 flex items-center gap-2">
                  <AlertCircle size={14} /> {formError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Vendor *</label>
                  <select value={form.vendorId} onChange={e => onVendorChange(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
                    <option value="">Select vendor...</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Amount (₦) *</label>
                  <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Payment Date</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Payment Method</label>
                  <select value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Paid From Account *</label>
                  <select value={form.accountId} onChange={e => setForm({ ...form, accountId: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
                    <option value="">Select account...</option>
                    {assetAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Reference</label>
                  <input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} placeholder="Transfer ref / cheque no." className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
              </div>

              {form.vendorId && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Allocate to Bills *</label>
                  {vendorBills.length === 0 ? (
                    <p className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-3 py-3">No open bills for this vendor.</p>
                  ) : (
                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
                      {vendorBills.map(b => {
                        const alloc = form.allocations.find(a => a.billId === b.id);
                        return (
                          <div key={b.id} className={`px-3 py-2.5 flex items-center gap-3 ${alloc ? 'bg-indigo-50' : 'bg-white'}`}>
                            <input type="checkbox" checked={!!alloc} onChange={() => toggleBillAllocation(b.id, b.balanceDue)} className="rounded" />
                            <div className="flex-1">
                              <span className="text-xs font-mono font-medium text-slate-700">{b.billNumber}</span>
                              <span className="text-xs text-slate-400 ml-2">Balance: {formatNaira(b.balanceDue)}</span>
                            </div>
                            {alloc && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-slate-400">₦</span>
                                <input
                                  type="number" min="0" step="0.01"
                                  value={alloc.amount}
                                  onChange={e => {
                                    const updated = form.allocations.map(a => a.billId === b.id ? { ...a, amount: e.target.value } : a);
                                    setForm({ ...form, allocations: updated });
                                  }}
                                  className="w-28 px-2 py-1 text-xs border border-indigo-200 rounded focus:outline-none text-right bg-white"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none resize-none" />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="px-5 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2">
                  {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Detail Modal */}
      {detailPaymentId && paymentDetail && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 px-4 py-8 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{paymentDetail.paymentNumber}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{vendorMap.get(paymentDetail.vendorId) || '—'}</p>
              </div>
              <div className="flex items-center gap-2">
                {!detailEditMode && (
                  <button onClick={enableDetailEdit}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                    <Pencil size={12} /> Edit
                  </button>
                )}
                <button onClick={closeDetail} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
              </div>
            </div>

            {detailEditMode ? (
              <div className="px-6 py-5 space-y-4">
                {detailFormError && (
                  <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 flex items-center gap-2">
                    <AlertCircle size={14} /> {detailFormError}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
                    <input type="date" value={detailForm.date} onChange={e => setDetailForm({ ...detailForm, date: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Amount (₦)</label>
                    <input type="number" min="0" step="0.01" value={detailForm.amount} onChange={e => setDetailForm({ ...detailForm, amount: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Payment Method</label>
                    <select value={detailForm.paymentMethod} onChange={e => setDetailForm({ ...detailForm, paymentMethod: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
                      {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Paid From Account</label>
                    <select value={detailForm.accountId} onChange={e => setDetailForm({ ...detailForm, accountId: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
                      <option value="">Select account...</option>
                      {assetAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Reference</label>
                    <input value={detailForm.reference} onChange={e => setDetailForm({ ...detailForm, reference: e.target.value })}
                      placeholder="Transfer ref / cheque no."
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                    <textarea value={detailForm.notes} onChange={e => setDetailForm({ ...detailForm, notes: e.target.value })}
                      rows={2} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none resize-none" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button onClick={() => { setDetailEditMode(false); setDetailFormError(''); }}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                  <button onClick={handleUpdatePayment} disabled={updateMutation.isPending}
                    className="px-5 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2">
                    {updateMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                    <Save size={14} /> Save Changes
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-6 py-5 space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Amount</span>
                    <p className="font-bold text-slate-900 mt-1">{formatNaira(paymentDetail.amount)}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Date</span>
                    <p className="font-semibold text-slate-700 mt-1">{fmtDate(paymentDetail.date)}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Method</span>
                    <p className="font-semibold text-slate-700 mt-1 capitalize">{paymentDetail.paymentMethod?.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Account</span>
                    <p className="font-semibold text-slate-700 mt-1">{accountMap.get(paymentDetail.accountId || '') || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Reference</span>
                    <p className="font-semibold text-slate-700 mt-1 font-mono text-xs">{paymentDetail.reference || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Currency</span>
                    <p className="font-semibold text-slate-700 mt-1">{paymentDetail.currency || 'NGN'}</p>
                  </div>
                </div>

                {paymentDetail.notes && (
                  <div>
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Notes</span>
                    <p className="text-sm text-slate-600 mt-1 italic">{paymentDetail.notes}</p>
                  </div>
                )}

                {/* Bill Allocations */}
                {paymentDetail.allocations && paymentDetail.allocations.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Allocated Bills</h3>
                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                      {paymentDetail.allocations.map((alloc: PaymentAllocation) => (
                        <div key={alloc.id} className="px-4 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-medium text-slate-700">{/* bill number */}</span>
                            <button onClick={() => setViewBillId(alloc.billId)}
                              className="text-xs text-primary hover:text-primary-hover underline font-medium">
                              View Bill
                            </button>
                          </div>
                          <span className="text-xs font-mono font-medium text-slate-900">{formatNaira(alloc.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
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
