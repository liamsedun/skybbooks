import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { CsvImportModal } from '../../components/ui/CsvImportModal';
import {
  Search, Upload, Loader2, AlertCircle, X, Plus, FileMinus, ChevronRight,
  Ban, CheckCircle2, ReceiptText, Edit2, FileText,
} from 'lucide-react';

interface Vendor { id: string; name: string; email: string | null; }

interface VendorCredit {
  id: string;
  orgId: string;
  vcNumber: string;
  vendorId: string;
  billId: string | null;
  date: string;
  status: 'issued' | 'applied' | 'void';
  subtotal: number;
  tax: number;
  total: number;
  remainingCredit: number;
  notes: string | null;
  journalEntryId: string | null;
  createdAt: string;
  vendor?: Vendor | null;
  billNumber?: string | null;
}

interface Bill {
  id: string;
  billNumber: string;
  total: number;
  balanceDue: number;
  status: string;
  date: string;
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  issued:  { label: 'Issued',  className: 'bg-amber-50 text-amber-700' },
  applied: { label: 'Applied', className: 'bg-emerald-50 text-emerald-700' },
  void:    { label: 'Void',    className: 'bg-slate-100 text-slate-400' },
};

function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null): string {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function PurchaseCreditNotesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<VendorCredit | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<VendorCredit | null>(null);

  const { data: notes, isLoading, isError } = useQuery<VendorCredit[]>({
    queryKey: ['purchases', 'vendor-credit-notes'],
    queryFn: async () => { const r = await api.get('/purchases/credit-notes'); return r.data; },
  });

  const voidMutation = useMutation({
    mutationFn: (id: string) => api.post(`/purchases/credit-notes/${id}/void`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases', 'vendor-credit-notes'] });
      setVoidTarget(null);
    },
    onError: (e: any) => setActionError(e?.response?.data?.error || 'Failed to void credit note.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/purchases/credit-notes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases', 'vendor-credit-notes'] });
      setEditingNote(null);
    },
    onError: (e: any) => setActionError(e?.response?.data?.error || 'Failed to update credit note.'),
  });

  function openEdit(note: VendorCredit) {
    setEditingNote(note);
  }

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return (notes || []).filter(n => {
      if (statusFilter !== 'all' && n.status !== statusFilter) return false;
      if (!term) return true;
      return (
        n.vcNumber.toLowerCase().includes(term) ||
        (n.vendor?.name || '').toLowerCase().includes(term) ||
        (n.billNumber || '').toLowerCase().includes(term)
      );
    });
  }, [notes, searchTerm, statusFilter]);

  const totals = useMemo(() => {
    const totalIssued = (notes || []).reduce((s, n) => s + n.total, 0);
    const totalOutstanding = (notes || []).filter(n => n.status !== 'void').reduce((s, n) => s + n.remainingCredit, 0);
    return { count: (notes || []).length, totalIssued, totalOutstanding };
  }, [notes]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vendor Credit Notes</h1>
          <p className="text-sm text-slate-500 mt-1">
            Record credits from vendors for returns, overpayments, or adjustments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={async () => {
              try { const list = Array.isArray(notes) ? notes : []; if (!list.length) return;
                const rows = list.map((n: any) => [n.vcNumber, n.vendor?.name||'', new Date(n.date).toLocaleDateString('en-GB'), (n.total/100).toFixed(2), n.status]);
                const res = await api.post('/reports/custom/pdf', { title:'Vendor Credit Notes', headers:['VC #','Vendor','Date','Total','Status'], rows }, { responseType:'blob' });
                window.open(URL.createObjectURL(res.data), '_blank');
              } catch (e) { console.error(e); }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition shadow-sm">
            <FileText size={14} /> PDF
          </button>
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition shadow-sm"
          >
            <Upload size={14} />
            Import CSV
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-slate-900 transition shadow-sm"
          >
            <Plus size={14} />
            New Credit Note
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Total Credit Notes</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{totals.count}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Total Issued Value</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{formatNaira(totals.totalIssued)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Outstanding Credit</p>
          <p className="text-xl font-bold text-amber-600 mt-1">{formatNaira(totals.totalOutstanding)}</p>
        </div>
      </div>

      {actionError && (
        <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 mb-4">
          <AlertCircle size={14} />
          {actionError}
          <button onClick={() => setActionError(null)} className="ml-auto text-rose-400 hover:text-rose-600">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {['all', 'issued', 'applied', 'void'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              statusFilter === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}>
            {s === 'all' ? 'All' : STATUS_META[s]?.label || s}
          </button>
        ))}
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search by credit note number, vendor, or bill..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" />Loading vendor credit notes...
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center gap-2 py-16 text-rose-500 text-sm">
            <AlertCircle size={16} />Failed to load vendor credit notes.
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <FileMinus size={28} className="text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-600">No vendor credit notes found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Record credits from vendors for returned goods, overpayments, or invoice adjustments.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 py-2 px-4 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-slate-900 transition"
            >
              New Credit Note
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
                <th className="py-2.5 pl-4 pr-3">VC #</th>
                <th className="py-2.5 pr-3">Vendor</th>
                <th className="py-2.5 pr-3">Bill</th>
                <th className="py-2.5 pr-3">Date</th>
                <th className="py-2.5 pr-3 text-right">Total</th>
                <th className="py-2.5 pr-3 text-right">Remaining</th>
                <th className="py-2.5 pr-3">Status</th>
                <th className="py-2.5 pr-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(n => {
                const statusMeta = STATUS_META[n.status] || { label: n.status, className: 'bg-slate-100 text-slate-600' };
                return (
                  <tr
                    key={n.id}
                    className="group hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedId(n.id)}
                  >
                    <td className="py-2.5 pl-4 pr-3 font-mono text-sm font-semibold text-slate-700">{n.vcNumber}</td>
                    <td className="py-2.5 pr-3">
                      <p className="text-sm font-medium text-slate-800">{n.vendor?.name || '\u2014'}</p>
                      {n.vendor?.email && <p className="text-xs text-slate-400">{n.vendor.email}</p>}
                    </td>
                    <td className="py-2.5 pr-3 text-sm text-slate-500 font-mono">{n.billNumber || '\u2014'}</td>
                    <td className="py-2.5 pr-3 text-sm text-slate-500">{fmtDate(n.date)}</td>
                    <td className="py-2.5 pr-3 text-right font-semibold text-slate-700 font-mono">{formatNaira(n.total)}</td>
                    <td className="py-2.5 pr-3 text-right font-semibold text-amber-600 font-mono">{formatNaira(n.remainingCredit)}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusMeta.className}`}>
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="py-2.5 pr-2">
                      <div className="flex items-center justify-end gap-1">
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEdit(n); }}
                            title="Edit"
                            className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                          >
                            <Edit2 size={14} />
                          </button>
                          {n.status === 'issued' && n.remainingCredit === n.total && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setVoidTarget(n); }}
                              title="Void credit note"
                              className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            >
                              <Ban size={14} />
                            </button>
                          )}
                        </div>
                        <ChevronRight size={16} className="text-slate-300" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showCreateModal && (
        <CreateVendorCreditModal onClose={() => setShowCreateModal(false)} onError={setActionError} />
      )}
      {editingNote && (
        <CreateVendorCreditModal
          key={editingNote.id}
          editNote={editingNote}
          onClose={() => setEditingNote(null)}
          onError={setActionError}
          updateMutation={updateMutation}
        />
      )}

      {voidTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Void Credit Note</h2>
            <p className="text-sm text-slate-500 mb-4">
              Void <span className="font-medium text-slate-700">{voidTarget.vcNumber}</span> ({formatNaira(voidTarget.total)})?
              This reverses its ledger entry and makes it unusable. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setVoidTarget(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
              <button onClick={() => voidMutation.mutate(voidTarget.id)} disabled={voidMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50">
                {voidMutation.isPending ? 'Voiding...' : 'Void Credit Note'}
              </button>
            </div>
          </div>
        </div>
      )}

      <DetailPanel
        creditNoteId={selectedId}
        onClose={() => setSelectedId(null)}
        onError={setActionError}
      />

      {importOpen && (
        <CsvImportModal
          entity="purchaseCreditNotes"
          endpoint="/purchases/credit-notes"
          onClose={() => setImportOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['purchases', 'vendor-credit-notes'] });
            queryClient.invalidateQueries({ queryKey: ['purchases'] });
          }}
          transformRow={(row, headers) => {
            const get = (key: string) => {
              const idx = headers.findIndex(h => h.toLowerCase() === key.toLowerCase());
              return idx >= 0 ? row[idx]?.trim() : '';
            };
            const vendorName = get('vendorId (or name)') || get('vendorId') || get('vendor');
            return {
              vendorId: vendorName,
              billId: get('billNumber (optional)') || get('billNumber') || get('bill') || null,
              date: get('date (YYYY-MM-DD)') || get('date') || undefined,
              subtotal: Math.round(parseFloat(get('subtotal (NGN)') || get('subtotal') || '0') * 100),
              tax: Math.round(parseFloat(get('tax (NGN)') || get('tax') || '0') * 100),
              notes: get('notes') || null,
            };
          }}
        />
      )}
    </div>
  );
}

function DetailPanel({
  creditNoteId,
  onClose,
  onError,
}: {
  creditNoteId: string | null;
  onClose: () => void;
  onError: (msg: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [applyBillId, setApplyBillId] = useState('');
  const [applyAmount, setApplyAmount] = useState('');

  const { data: note, isLoading } = useQuery<VendorCredit>({
    queryKey: ['purchases', 'vendor-credit-notes', creditNoteId],
    queryFn: async () => { const r = await api.get(`/purchases/credit-notes/${creditNoteId}`); return r.data; },
    enabled: !!creditNoteId,
  });

  const { data: openBillsData } = useQuery<any>({
    queryKey: ['purchases', 'bills', 'by-vendor', note?.vendorId],
    queryFn: async () => {
      const r = await api.get('/purchases/bills', { params: { vendorId: note?.vendorId, limit: 100 } });
      return r.data;
    },
    enabled: !!note?.vendorId && showApplyForm,
  });

  const openBills: Bill[] = useMemo(() => {
    const list = openBillsData?.invoices || openBillsData?.data || openBillsData || [];
    return (Array.isArray(list) ? list : []).filter((inv: Bill) => inv.balanceDue > 0 && inv.status !== 'draft' && inv.status !== 'void');
  }, [openBillsData]);

  const applyMutation = useMutation({
    mutationFn: (payload: { billId: string; amount: number }) =>
      api.post(`/purchases/credit-notes/${creditNoteId}/apply`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases', 'vendor-credit-notes'] });
      queryClient.invalidateQueries({ queryKey: ['purchases', 'vendor-credit-notes', creditNoteId] });
      queryClient.invalidateQueries({ queryKey: ['purchases', 'bills'] });
      setShowApplyForm(false);
      setApplyBillId('');
      setApplyAmount('');
    },
    onError: (e: any) => onError(e?.response?.data?.error || 'Failed to apply credit note.'),
  });

  if (!creditNoteId) return null;

  const statusMeta = note ? (STATUS_META[note.status] || { label: note.status, className: 'bg-slate-100 text-slate-600' }) : null;
  const canApply = note && note.status !== 'void' && note.remainingCredit > 0;

  const selectedBill = openBills.find(i => i.id === applyBillId);
  const maxApplyAmount = note ? Math.min(note.remainingCredit, selectedBill?.balanceDue || note.remainingCredit) : 0;

  const handleApply = () => {
    onError(null);
    const amt = Math.round(parseFloat(applyAmount || '0') * 100);
    if (!applyBillId) { onError('Select a bill to apply this credit to.'); return; }
    if (amt <= 0) { onError('Enter a valid amount to apply.'); return; }
    if (amt > maxApplyAmount) { onError(`Amount exceeds the maximum applicable (${formatNaira(maxApplyAmount)}).`); return; }
    applyMutation.mutate({ billId: applyBillId, amount: amt });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Vendor Credit Note</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {isLoading || !note ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 size={20} className="animate-spin mr-2" />Loading credit note...
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-mono text-sm font-semibold text-slate-700">{note.vcNumber}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{fmtDate(note.date)}</p>
                  </div>
                  {statusMeta && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusMeta.className}`}>
                      {statusMeta.label}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Vendor</p>
                    <p className="font-medium text-slate-800">{note.vendor?.name || '\u2014'}</p>
                    {note.vendor?.email && <p className="text-xs text-slate-400">{note.vendor.email}</p>}
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Originating Bill</p>
                    <p className="font-mono text-slate-700">{note.billNumber || '\u2014'}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-white border border-slate-100 rounded-lg p-3">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Subtotal</p>
                  <p className="font-mono font-semibold text-slate-800">{formatNaira(note.subtotal)}</p>
                </div>
                <div className="bg-white border border-slate-100 rounded-lg p-3">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">VAT</p>
                  <p className="font-mono font-semibold text-slate-800">{formatNaira(note.tax)}</p>
                </div>
                <div className="bg-white border border-slate-100 rounded-lg p-3">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Total</p>
                  <p className="font-mono font-semibold text-slate-900">{formatNaira(note.total)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between bg-amber-50/60 border border-amber-100 rounded-xl px-4 py-3">
                <div>
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Remaining Credit</p>
                  <p className="text-lg font-bold text-amber-700 font-mono">{formatNaira(note.remainingCredit)}</p>
                </div>
                {canApply && !showApplyForm && (
                  <button
                    onClick={() => setShowApplyForm(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-slate-900 transition"
                  >
                    <ReceiptText size={14} />
                    Apply to Bill
                  </button>
                )}
              </div>

              {showApplyForm && (
                <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-700">Apply Credit to a Bill</h3>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Select Open Bill</label>
                    <select
                      value={applyBillId}
                      onChange={e => {
                        setApplyBillId(e.target.value);
                        const inv = openBills.find(i => i.id === e.target.value);
                        if (inv) {
                          const amt = Math.min(note.remainingCredit, inv.balanceDue);
                          setApplyAmount((amt / 100).toFixed(2));
                        }
                      }}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    >
                      <option value="">Select bill...</option>
                      {openBills.map(inv => (
                        <option key={inv.id} value={inv.id}>
                          {inv.billNumber} \u2014 Balance Due: {formatNaira(inv.balanceDue)}
                        </option>
                      ))}
                    </select>
                    {openBills.length === 0 && (
                      <p className="text-xs text-slate-400 mt-1">No open bills found for this vendor.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Amount to Apply (\u20A6)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={applyAmount}
                      onChange={e => setApplyAmount(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    />
                    <p className="text-xs text-slate-400 mt-1">Maximum applicable: {formatNaira(maxApplyAmount)}</p>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => { setShowApplyForm(false); setApplyBillId(''); setApplyAmount(''); }}
                      className="px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleApply}
                      disabled={applyMutation.isPending}
                      className="px-3.5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-slate-900 disabled:opacity-50"
                    >
                      {applyMutation.isPending ? 'Applying...' : 'Apply Credit'}
                    </button>
                  </div>
                </div>
              )}

              {note.notes && (
                <div className="text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-0.5">Notes</p>
                  {note.notes}
                </div>
              )}

              {note.status === 'applied' && (
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                  <CheckCircle2 size={14} />
                  This credit note has been fully applied.
                </div>
              )}

              {note.status === 'void' && (
                <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                  <Ban size={14} />
                  This credit note has been voided and can no longer be applied.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function CreateVendorCreditModal({ onClose, onError, editNote, updateMutation }: {
  onClose: () => void;
  onError: (msg: string | null) => void;
  editNote?: VendorCredit | null;
  updateMutation?: { mutate: (args: { id: string; data: any }) => void; isPending: boolean };
}) {
  const queryClient = useQueryClient();
  const [vendorId, setVendorId] = useState(editNote?.vendorId || '');
  const [billId, setBillId] = useState(editNote?.billId || '');
  const [date, setDate] = useState(editNote?.date || new Date().toISOString().split('T')[0]);
  const [subtotal, setSubtotal] = useState(editNote ? (editNote.subtotal / 100).toFixed(2) : '');
  const [taxRate, setTaxRate] = useState(editNote ? (editNote.subtotal > 0 ? ((editNote.tax / editNote.subtotal) * 100).toFixed(1) : '7.5') : '7.5');
  const [reason, setReason] = useState(editNote?.notes || '');

  const { data: vendors } = useQuery<Vendor[]>({
    queryKey: ['vendors'],
    queryFn: async () => { const r = await api.get('/purchases/vendors'); return r.data; },
  });

  const { data: vendorBillsData } = useQuery<any>({
    queryKey: ['purchases', 'bills', 'by-vendor', vendorId],
    queryFn: async () => {
      const r = await api.get('/purchases/bills', { params: { vendorId, limit: 100 } });
      return r.data;
    },
    enabled: !!vendorId,
  });

  const vendorBills: Bill[] = useMemo(() => {
    const list = vendorBillsData?.invoices || vendorBillsData?.data || vendorBillsData || [];
    return (Array.isArray(list) ? list : []).filter((inv: Bill) => inv.status !== 'draft' && inv.status !== 'void');
  }, [vendorBillsData]);

  const subtotalKobo = Math.round(parseFloat(subtotal || '0') * 100);
  const taxKobo = Math.round(subtotalKobo * (parseFloat(taxRate || '0') / 100));
  const totalKobo = subtotalKobo + taxKobo;

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/purchases/credit-notes', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases', 'vendor-credit-notes'] });
      onClose();
    },
    onError: (e: any) => onError(e?.response?.data?.error || 'Failed to create vendor credit note.'),
  });

  const handleSubmit = () => {
    if (!vendorId) { onError('Select a vendor.'); return; }
    if (subtotalKobo <= 0) { onError('Enter a credit subtotal greater than zero.'); return; }
    onError(null);
    const payload = {
      vendorId,
      billId: billId || null,
      date,
      subtotal: subtotalKobo,
      tax: taxKobo,
      notes: reason || null,
    };
    if (editNote && updateMutation) {
      updateMutation.mutate({ id: editNote.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-8">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">{editNote ? 'Edit Vendor Credit Note' : 'New Vendor Credit Note'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Vendor</label>
            <select
              value={vendorId}
              onChange={e => { setVendorId(e.target.value); setBillId(''); }}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            >
              <option value="">Select vendor...</option>
              {(vendors || []).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Originating Bill (optional)</label>
            <select
              value={billId}
              onChange={e => setBillId(e.target.value)}
              disabled={!vendorId}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">No specific bill / general credit</option>
              {vendorBills.map(inv => (
                <option key={inv.id} value={inv.id}>{inv.billNumber} \u2014 {formatNaira(inv.total)}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">
              Linking a bill is for reference only \u2014 apply this credit to any open bill once it is issued.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">VAT Rate (%)</label>
              <input
                type="number"
                step="0.1"
                value={taxRate}
                onChange={e => setTaxRate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Credit Subtotal (\u20A6, excl. VAT)</label>
            <input
              type="number"
              step="0.01"
              value={subtotal}
              onChange={e => setSubtotal(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Reason / Notes</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              placeholder="e.g. Returned consignment \u2014 12 units damaged on arrival"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>

          <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-sm border border-slate-100">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-mono text-slate-700">{formatNaira(subtotalKobo)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">VAT ({taxRate || 0}%)</span>
              <span className="font-mono text-slate-700">{formatNaira(taxKobo)}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-200">
              <span className="font-semibold text-slate-700">Total Credit</span>
              <span className="font-mono font-bold text-slate-900">{formatNaira(totalKobo)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={editNote ? updateMutation?.isPending : createMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-slate-900 disabled:opacity-50"
          >
            {editNote
              ? (updateMutation?.isPending ? 'Saving...' : 'Save Changes')
              : (createMutation.isPending ? 'Creating...' : 'Issue Credit Note')}
          </button>
        </div>
      </div>
    </div>
  );
}
