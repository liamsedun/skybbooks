import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bankingApi, orgApi, printWindow } from '../../lib/api';
import { PageLoader } from '../../components/ui/PageLoader';
import {
  Plus, X, Loader2, AlertCircle, CheckCircle2, ArrowRightLeft, Trash2, Edit3, Search, Eye, Printer
} from 'lucide-react';

function fmtNaira(v: number): string {
  return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function TransfersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [viewTarget, setViewTarget] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bankAccounts'],
    queryFn: bankingApi.getAccounts,
  });

  const { data: orgData } = useQuery({ queryKey: ['org'], queryFn: orgApi.getOrg });

  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ['bankTransfers', dateFrom, dateTo],
    queryFn: () => bankingApi.getTransfers({ from: dateFrom || undefined, to: dateTo || undefined }),
  });

  const filteredTransfers = useMemo(() => {
    const list = Array.isArray(transfers) ? transfers : [];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((t: any) =>
      (t.transferNumber || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q) ||
      (t.fromAccountName || '').toLowerCase().includes(q) ||
      (t.toAccountName || '').toLowerCase().includes(q) ||
      (t.reference || '').toLowerCase().includes(q)
    );
  }, [transfers, search]);

  const createMutation = useMutation({
    mutationFn: bankingApi.createTransfer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bankTransfers'] });
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
      setShowForm(false);
      setSuccess('Transfer created successfully.');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => setFormError(err?.response?.data?.error || err?.message || 'Failed to create transfer.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => bankingApi.updateTransfer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bankTransfers'] });
      setEditTarget(null);
      setSuccess('Transfer updated successfully.');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => setFormError(err?.response?.data?.error || err?.message || 'Failed to update transfer.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => bankingApi.deleteTransfer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bankTransfers'] });
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
      setDeleteTarget(null);
      setSuccess('Transfer reversed successfully.');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => {
      setDeleteTarget(null);
      alert(err?.response?.data?.error || err?.message || 'Failed to reverse transfer.');
    },
  });

  const accountOptions = (Array.isArray(bankAccounts) ? bankAccounts : []).map((a: any) => ({
    id: a.id,
    label: `${a.name} — ${a.bankName} ****${(a.accountNumber || '').slice(-4)}`,
  }));

  function printTransfersPDF() {
    const org = (orgData as any)?.data || orgData || {};
    const orgName = org.name || '';
    const orgAddr = org.address ? `<p style="margin:0;font-size:11px;color:#475569">${org.address}</p>` : '';
    const orgPhone = org.phone || '';
    const orgEmail = org.email || '';
    const orgWebsite = org.website || '';
    const orgLogo = org.logoUrl ? `<img src="${org.logoUrl}" style="max-height:60px;max-width:200px;object-fit:contain" />` : '';
    const contactInfo = [orgPhone, orgEmail, orgWebsite].filter(Boolean).join(' | ');

    const rows = filteredTransfers.map((t: any) => `
      <tr>
        <td style="padding:8px 12px;font-family:monospace;font-size:12px;border-bottom:1px solid #e2e8f0">${t.transferNumber}</td>
        <td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e2e8f0">${fmtDate(t.date)}</td>
        <td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e2e8f0">${t.fromAccountName || t.fromBankName || '—'}</td>
        <td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e2e8f0">${t.toAccountName || t.toBankName || '—'}</td>
        <td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e2e8f0">${t.description || '—'}</td>
        <td style="padding:8px 12px;font-size:12px;font-weight:600;text-align:right;border-bottom:1px solid #e2e8f0">${fmtNaira(t.amount)}</td>
      </tr>`).join('');

    const total = filteredTransfers.reduce((s: number, t: any) => s + t.amount, 0);

    printWindow(
      'Inter Account Transfers',
      `<div style="text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #e2e8f0">
        ${orgLogo}
        <h1 style="margin:4px 0;font-size:18px;color:#0f172a">${orgName}</h1>
        ${orgAddr}
        <p style="margin:2px 0;font-size:11px;color:#64748b">${contactInfo}</p>
      </div>
      <h2 style="font-size:16px;color:#0f172a;margin:0 0 8px">Inter Account Transfers</h2>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#64748b;text-align:left;text-transform:uppercase">Transfer #</th>
            <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#64748b;text-align:left;text-transform:uppercase">Date</th>
            <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#64748b;text-align:left;text-transform:uppercase">Paid from</th>
            <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#64748b;text-align:left;text-transform:uppercase">Received in</th>
            <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#64748b;text-align:left;text-transform:uppercase">Description</th>
            <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#64748b;text-align:right;text-transform:uppercase">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="border-top:2px solid #0f172a">
            <td colspan="5" style="padding:10px 12px;font-size:13px;font-weight:700;text-align:right">Total</td>
            <td style="padding:10px 12px;font-size:13px;font-weight:700;text-align:right">${fmtNaira(total)}</td>
          </tr>
        </tfoot>
      </table>`,
      'Inter Account Transfers'
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ArrowRightLeft className="w-6 h-6 text-indigo-600" /> Inter Account Transfers
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={printTransfersPDF} disabled={filteredTransfers.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all duration-200 disabled:opacity-50">
            <Printer className="w-4 h-4" /> PDF
          </button>
          <button onClick={() => { setShowForm(true); setEditTarget(null); setFormError(null); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200">
            <Plus className="w-4 h-4" /> New Transfer
          </button>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm border border-emerald-200/80">
          <CheckCircle2 className="w-4 h-4" /> {success}
        </div>
      )}

      {/* Search + Date Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search by transfer #, description, account..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">From:</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">To:</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
        </div>
        {(search || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); }}
            className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1">Clear</button>
        )}
        <span className="text-xs text-slate-400 font-medium whitespace-nowrap">{filteredTransfers.length} transfer{filteredTransfers.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Transfer Form Modal */}
      {(showForm || editTarget) && (
        <TransferForm
          bankAccounts={accountOptions}
          editTarget={editTarget}
          onSave={(data) => {
            if (editTarget) {
              updateMutation.mutate({ id: editTarget.id, data });
            } else {
              createMutation.mutate(data);
            }
          }}
          onClose={() => { setShowForm(false); setEditTarget(null); setFormError(null); }}
          error={formError}
          isPending={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-200/80"
            onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900">Reverse Transfer</h2>
            <p className="text-sm text-slate-600">
              This will reverse the journal entry for transfer <strong>{deleteTarget.transferNumber}</strong> and delete the transfer record. Continue?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all">Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50 transition-all">
                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Reverse & Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfers Table */}
      {isLoading ? (
        <PageLoader message="Loading transfers..." />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-3 text-left">Transfer #</th>
                <th className="px-3 py-3 text-left">Date</th>
                <th className="px-3 py-3 text-left">Paid from</th>
                <th className="px-3 py-3 text-left">Received in</th>
                <th className="px-3 py-3 text-left">Description</th>
                <th className="px-3 py-3 text-right">Amount</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransfers.map((t: any) => (
                <tr key={t.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50">
                  <td className="px-4 py-3 font-mono font-medium text-slate-800">{t.transferNumber}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(t.date)}</td>
                  <td className="px-4 py-3 text-slate-700 max-w-[200px] truncate">{t.fromAccountName || t.fromBankName}</td>
                  <td className="px-4 py-3 text-slate-700 max-w-[200px] truncate">{t.toAccountName || t.toBankName}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{t.description || '—'}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-slate-900">{fmtNaira(t.amount)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setViewTarget(t)}
                        className="text-indigo-600 hover:text-indigo-800 p-1" title="View details">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setEditTarget(t); setFormError(null); }}
                        className="text-blue-600 hover:text-blue-800 p-1" title="Edit">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteTarget(t)}
                        className="text-red-500 hover:text-red-700 p-1" title="Reverse">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTransfers.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No transfers found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {viewTarget && (
        <TransferDetailView transfer={viewTarget} onClose={() => setViewTarget(null)} />
      )}
    </div>
  );
}

function TransferDetailView({ transfer, onClose }: { transfer: any; onClose: () => void }) {
  const { data: org } = useQuery({ queryKey: ['org'], queryFn: orgApi.getOrg });

  const handlePrintPdf = () => {
    const o = org || {};
    const orgName = o.name || '';
    const orgAddr = o.address ? `<p style="margin:0;font-size:11px;color:#475569">${o.address}</p>` : '';
    const orgPhone = o.phone || '';
    const orgEmail = o.email || '';
    const orgWebsite = o.website || '';
    const orgLogo = o.logoUrl ? `<img src="${o.logoUrl}" style="max-height:60px;max-width:200px;object-fit:contain" />` : '';
    const contactInfo = [orgPhone, orgEmail, orgWebsite].filter(Boolean).join(' | ');

    printWindow(
      `Transfer ${transfer.transferNumber}`,
      `<div style="text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #e2e8f0">
        ${orgLogo}
        <h1 style="margin:4px 0;font-size:18px;color:#0f172a">${orgName}</h1>
        ${orgAddr}
        <p style="margin:2px 0;font-size:11px;color:#64748b">${contactInfo}</p>
      </div>
      <table>
        <tr><td style="font-weight:600;padding:6px 12px;width:160px">Transfer #</td><td style="padding:6px 12px">${transfer.transferNumber}</td></tr>
        <tr><td style="font-weight:600;padding:6px 12px">Date</td><td style="padding:6px 12px">${fmtDate(transfer.date)}</td></tr>
        <tr><td style="font-weight:600;padding:6px 12px">Paid from</td><td style="padding:6px 12px">${transfer.fromAccountName || transfer.fromBankName || '—'}</td></tr>
        <tr><td style="font-weight:600;padding:6px 12px">Received in</td><td style="padding:6px 12px">${transfer.toAccountName || transfer.toBankName || '—'}</td></tr>
        <tr><td style="font-weight:600;padding:6px 12px">Amount</td><td style="padding:6px 12px;font-weight:700">${fmtNaira(transfer.amount)}</td></tr>
        <tr><td style="font-weight:600;padding:6px 12px">Description</td><td style="padding:6px 12px">${transfer.description || '—'}</td></tr>
        <tr><td style="font-weight:600;padding:6px 12px">Reference</td><td style="padding:6px 12px">${transfer.reference || '—'}</td></tr>
        <tr><td style="font-weight:600;padding:6px 12px">Created</td><td style="padding:6px 12px">${fmtDate(transfer.createdAt)}</td></tr>
      </table>`,
      `Transfer ${transfer.transferNumber}`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 border border-slate-200/80" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Transfer Details</h2>
          <div className="flex items-center gap-2">
            <button onClick={handlePrintPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all">
              <Printer className="w-3.5 h-3.5" /> Print / PDF
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-100"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="space-y-1.5 text-sm">
          <div className="grid grid-cols-3 gap-4 py-2.5 border-b border-slate-100">
            <span className="text-slate-500 font-medium col-span-1">Transfer #</span>
            <span className="text-slate-900 font-semibold font-mono col-span-2">{transfer.transferNumber}</span>
          </div>
          <div className="grid grid-cols-3 gap-4 py-2.5 border-b border-slate-100">
            <span className="text-slate-500 font-medium col-span-1">Date</span>
            <span className="text-slate-900 col-span-2">{fmtDate(transfer.date)}</span>
          </div>
          <div className="grid grid-cols-3 gap-4 py-2.5 border-b border-slate-100">
            <span className="text-slate-500 font-medium col-span-1">Paid from</span>
            <span className="text-slate-900 col-span-2">{transfer.fromAccountName || transfer.fromBankName || '—'}</span>
          </div>
          <div className="grid grid-cols-3 gap-4 py-2.5 border-b border-slate-100">
            <span className="text-slate-500 font-medium col-span-1">Received in</span>
            <span className="text-slate-900 col-span-2">{transfer.toAccountName || transfer.toBankName || '—'}</span>
          </div>
          <div className="grid grid-cols-3 gap-4 py-2.5 border-b border-slate-100">
            <span className="text-slate-500 font-medium col-span-1">Amount</span>
            <span className="text-slate-900 font-semibold col-span-2">{fmtNaira(transfer.amount)}</span>
          </div>
          <div className="grid grid-cols-3 gap-4 py-2.5 border-b border-slate-100">
            <span className="text-slate-500 font-medium col-span-1">Description</span>
            <span className="text-slate-900 col-span-2">{transfer.description || '—'}</span>
          </div>
          {(transfer.reference) && (
            <div className="grid grid-cols-3 gap-4 py-2.5 border-b border-slate-100">
              <span className="text-slate-500 font-medium col-span-1">Reference</span>
              <span className="text-slate-900 col-span-2">{transfer.reference}</span>
            </div>
          )}
          <div className="grid grid-cols-3 gap-4 py-2.5">
            <span className="text-slate-500 font-medium col-span-1">Created</span>
            <span className="text-slate-900 col-span-2">{fmtDate(transfer.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TransferForm({
  bankAccounts, editTarget, error, isPending, onSave, onClose
}: {
  bankAccounts: { id: string; label: string }[];
  editTarget: any | null;
  error: string | null;
  isPending: boolean;
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(editTarget?.date ? new Date(editTarget.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  const [fromId, setFromId] = useState(editTarget?.fromBankAccountId || '');
  const [toId, setToId] = useState(editTarget?.toBankAccountId || '');
  const [amount, setAmount] = useState(editTarget ? (editTarget.amount / 100).toString() : '');
  const [description, setDescription] = useState(editTarget?.description || '');
  const [reference, setReference] = useState(editTarget?.reference || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromId || !toId) { return; }
    if (fromId === toId) { return; }
    if (!amount || parseFloat(amount) <= 0) { return; }
    onSave({
      fromBankAccountId: fromId,
      toBankAccountId: toId,
      date,
      amount: parseFloat(amount),
      description: description || undefined,
      reference: reference || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 border border-slate-200/80 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-slate-900">{editTarget ? 'Edit Transfer' : 'Inter Account Transfer'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100/80">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Reference</label>
              <input type="text" value={reference} onChange={e => setReference(e.target.value)} placeholder="Optional"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow mt-1" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Description</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow mt-1" />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Paid from</label>
            <select value={fromId} onChange={e => setFromId(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow mt-1 bg-white">
              <option value="">Select source account...</option>
              {bankAccounts.map(a => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Amount</label>
              <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow mt-1" />
            </div>
            <div className="flex items-end pb-2.5">
              <span className="text-sm font-semibold text-slate-500">NGN</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Received in</label>
            <select value={toId} onChange={e => setToId(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow mt-1 bg-white">
              <option value="">Select destination account...</option>
              {bankAccounts.map(a => (
                <option key={a.id} value={a.id} disabled={a.id === fromId}>{a.label}</option>
              ))}
            </select>
          </div>

          {fromId && toId && fromId === toId && (
            <div className="flex items-center gap-2 p-2 text-xs text-red-600 bg-red-50 rounded-xl">
              <AlertCircle className="w-3.5 h-3.5" /> Source and destination must be different.
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2 shrink-0">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all">Cancel</button>
            <button type="submit" disabled={isPending || !fromId || !toId || fromId === toId || !amount || parseFloat(amount) <= 0}
              className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 transition-all">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} {editTarget ? 'Update' : 'Create Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}