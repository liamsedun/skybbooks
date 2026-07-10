import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, orgApi } from '../../lib/api';
import { CsvImportModal } from '../../components/ui/CsvImportModal';
import {
  Search, Upload, Loader2, AlertCircle, X, Plus, FileMinus, ChevronRight,
  Ban, CheckCircle2, ReceiptText, Edit2, Download, FileText,
} from 'lucide-react';
import { CurrencySelector } from '../../components/ui/CurrencySelector';

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

function exportVendorCreditNotesCSV(notes: VendorCredit[]) {
  const headers = ['VC #','Vendor','Bill','Date','Status','Subtotal (₦)','VAT (₦)','Total (₦)','Remaining (₦)','Notes'];
  const rows = notes.map(n => [
    n.vcNumber, n.vendor?.name||'', n.billNumber||'', n.date, n.status,
    (n.subtotal/100).toFixed(2), (n.tax/100).toFixed(2), (n.total/100).toFixed(2), (n.remainingCredit/100).toFixed(2),
    n.notes||'',
  ]);
  const csv = [headers,...rows].map(r => r.map(val => `"${val}"`).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url;
  a.download=`vendor-credit-notes-${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

function exportVendorCreditNotesPDF(notes: VendorCredit[]) {
  const fmt = (k: number) => `₦${(k/100).toLocaleString('en-NG',{minimumFractionDigits:2})}`;
  const rows = notes.map(n => `
    <tr>
      <td>${n.vcNumber}</td>
      <td>${n.vendor?.name||'\u2014'}</td>
      <td>${n.billNumber||'\u2014'}</td>
      <td>${new Date(n.date).toLocaleDateString('en-GB')}</td>
      <td><span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;background:#f1f5f9;color:#475569">${n.status}</span></td>
      <td style="text-align:right">${fmt(n.total)}</td>
      <td style="text-align:right">${fmt(n.remainingCredit)}</td>
    </tr>`).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Vendor Credit Notes</title>
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
    <div style="text-align:right"><div class="title">Vendor Credit Notes Report</div><div class="date">Generated: ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</div><div class="date">${notes.length} credit notes</div></div>
  </div>
  <table><thead><tr><th>VC #</th><th>Vendor</th><th>Bill</th><th>Date</th><th>Status</th><th style="text-align:right">Total</th><th style="text-align:right">Remaining</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="footer">SkyBooks By Skyhouse Accountants &amp; Technologies (Olalekan Williams Edun) &bull; Confidential</div>
  </body></html>`;
  const w = window.open('','_blank');
  if (w) { w.document.write(html); w.document.close(); setTimeout(()=>w.print(),500); }
}

function printVendorCreditNote(note: VendorCredit, org: any) {
  const logoHtml = org?.logoUrl
    ? `<img src="${org.logoUrl}" style="height:48px;width:48px;object-fit:contain;border-radius:8px;" />`
    : `<div style="width:48px;height:48px;border-radius:12px;background:#4f46e5;display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;font-weight:700;">${org?.name?.[0]?.toUpperCase() ?? 'S'}</div>`;

  const statusLabel = STATUS_META[note.status]?.label || note.status;
  const statusBadgeBg = note.status === 'applied' ? '#d1fae5' : note.status === 'issued' ? '#fef3c7' : '#f1f5f9';
  const statusBadgeColor = note.status === 'applied' ? '#065f46' : note.status === 'issued' ? '#92400e' : '#475569';
  const statusBadgeBorder = note.status === 'applied' ? '#a7f3d0' : note.status === 'issued' ? '#fde68a' : '#e2e8f0';

  const html = `<!DOCTYPE html><html><head><title>Vendor Credit Note - ${note.vcNumber}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:48px;color:#1e293b}
  @media print{body{padding:24px}}
</style></head><body>
<div style="max-width:640px;margin:0 auto;background:#fff;">
  <div style="height:6px;background:linear-gradient(90deg,#4f46e5,#8b5cf6,#818cf8);border-radius:3px;margin-bottom:32px;"></div>

  <table style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="vertical-align:top;">
        <div style="display:flex;align-items:center;gap:12px;">
          ${logoHtml}
          <div>
            <div style="font-size:14px;font-weight:700;color:#0f172a;">${org?.name || 'Your Company'}</div>
            ${org?.address ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">${org.address}</div>` : ''}
            <div style="font-size:11px;color:#64748b;margin-top:4px;">
              ${org?.phone ? `<span>${org.phone}</span>` : ''}${org?.phone && org?.email ? ' · ' : ''}
              ${org?.email ? `<span>${org.email}</span>` : ''}
            </div>
            ${org?.website ? `<div style="font-size:11px;color:#4f46e5;margin-top:0px;">${org.website}</div>` : ''}
          </div>
        </div>
      </td>
      <td style="vertical-align:top;text-align:right;">
        <div style="font-size:11px;font-weight:700;color:#4f46e5;text-transform:uppercase;letter-spacing:2px;">Vendor Credit Note</div>
        <div style="font-size:24px;font-weight:900;color:#0f172a;letter-spacing:-0.5px;margin-top:4px;">${note.vcNumber}</div>
        <div style="margin-top:8px;">${fmtDate(note.date)}</div>
        <div style="display:inline-block;margin-top:6px;padding:3px 12px;border-radius:999px;font-size:11px;font-weight:600;background:${statusBadgeBg};color:${statusBadgeColor};border:1px solid ${statusBadgeBorder};">${statusLabel}</div>
      </td>
    </tr>
  </table>

  <table style="width:100%;border-collapse:collapse;margin-top:32px;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">
    <tr>
      <td style="vertical-align:top;padding:24px 16px 24px 0;width:60%;">
        <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Vendor</div>
        <div style="font-size:14px;font-weight:700;color:#0f172a;">${note.vendor?.name || '—'}</div>
        ${note.vendor?.email ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">${note.vendor.email}</div>` : ''}
      </td>
      <td style="vertical-align:top;padding:24px 0 24px 16px;text-align:right;">
        <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Originating Bill</div>
        <div style="font-size:14px;font-weight:700;color:#0f172a;font-family:monospace;">${note.billNumber || '—'}</div>
      </td>
    </tr>
  </table>

  <div style="margin-top:24px;display:flex;gap:16px;">
    <div style="flex:1;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;text-align:center;">
      <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Subtotal</div>
      <div style="font-size:18px;font-weight:900;color:#0f172a;font-family:monospace;">${formatNaira(note.subtotal)}</div>
    </div>
    <div style="flex:1;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;text-align:center;">
      <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">VAT</div>
      <div style="font-size:18px;font-weight:900;color:#0f172a;font-family:monospace;">${formatNaira(note.tax)}</div>
    </div>
    <div style="flex:1;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;text-align:center;">
      <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Total</div>
      <div style="font-size:18px;font-weight:900;color:#059669;font-family:monospace;">${formatNaira(note.total)}</div>
    </div>
  </div>

  <div style="margin-top:16px;padding:16px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;text-align:center;">
    <div style="font-size:10px;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Remaining Credit</div>
    <div style="font-size:20px;font-weight:900;color:#d97706;font-family:monospace;">${formatNaira(note.remainingCredit)}</div>
  </div>

  ${note.notes ? `
  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;">
    <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Notes</div>
    <div style="font-size:12px;color:#64748b;line-height:1.6;">${note.notes}</div>
  </div>
  ` : ''}

  ${note.status === 'applied' ? `
  <div style="margin-top:24px;padding:12px 16px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;font-size:12px;font-weight:600;color:#065f46;text-align:center;">
    This credit note has been fully applied.
  </div>
  ` : ''}

  ${note.status === 'void' ? `
  <div style="margin-top:24px;padding:12px 16px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:12px;font-size:12px;font-weight:600;color:#64748b;text-align:center;">
    This credit note has been voided and can no longer be applied.
  </div>
  ` : ''}

  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;font-size:10px;color:#94a3b8;">
    ${org?.name || 'Your Company'} · This document was generated electronically.
  </div>
</div>
</body></html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
  else { alert('Popup blocked. Please allow popups for this site and try again.'); }
}

export function PurchaseCreditNotesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<VendorCredit | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<VendorCredit | null>(null);

  const { data: notes, isLoading, isError, error } = useQuery<VendorCredit[]>({
    queryKey: ['purchases', 'vendor-credit-notes'],
    queryFn: async () => { const r = await api.get('/purchases/credit-notes'); return r.data; },
  });
  const queryError = isError && error
    ? (error as any)?.response?.data?.error || (error as any)?.message || 'Failed to load vendor credit notes.'
    : null;

  if (isError && error) console.error('[CreditNotes] query error:', (error as any)?.response?.data || (error as any)?.message || error);

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
      if (dateFrom && n.date < dateFrom) return false;
      if (dateTo && n.date > dateTo) return false;
      if (!term) return true;
      return (
        n.vcNumber.toLowerCase().includes(term) ||
        (n.vendor?.name || '').toLowerCase().includes(term) ||
        (n.billNumber || '').toLowerCase().includes(term)
      );
    });
  }, [notes, searchTerm, statusFilter, dateFrom, dateTo]);

  const totals = useMemo(() => {
    const totalIssued = (notes || []).reduce((s, n) => s + n.total, 0);
    const totalOutstanding = (notes || []).filter(n => n.status !== 'void').reduce((s, n) => s + n.remainingCredit, 0);
    return { count: (notes || []).length, totalIssued, totalOutstanding };
  }, [notes]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vendor Credit Notes</h1>
          <p className="text-sm text-slate-500 mt-1">
            Record credits from vendors for returns, overpayments, or adjustments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportVendorCreditNotesCSV(filtered)}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-xs font-medium rounded-xl hover:bg-slate-50 transition-all duration-200"
          >
            <Download size={14} /> CSV
          </button>
          <button
            onClick={() => exportVendorCreditNotesPDF(filtered)}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-xs font-medium rounded-xl hover:bg-slate-50 transition-all duration-200"
          >
            <FileText size={14} /> PDF
          </button>
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-xs font-medium rounded-xl hover:bg-slate-50 transition-all duration-200"
          >
            <Upload size={14} />
            Import CSV
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-sm font-semibold rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200 shadow-sm"
          >
            <Plus size={15} />
            New Credit Note
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button onClick={() => { setDateFrom(''); setDateTo(''); setStatusFilter('all'); setSearchTerm(''); }} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 text-left cursor-pointer hover:border-blue-300 hover:shadow-md transition-all duration-200">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Credit Notes</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{totals.count}</p>
        </button>
        <button onClick={() => { setDateFrom(''); setDateTo(''); setStatusFilter('all'); setSearchTerm(''); }} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 text-left cursor-pointer hover:border-blue-300 hover:shadow-md transition-all duration-200">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Issued Value</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{formatNaira(totals.totalIssued)}</p>
        </button>
        <button onClick={() => { setDateFrom(''); setDateTo(''); setStatusFilter('all'); setSearchTerm(''); }} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 text-left cursor-pointer hover:border-blue-300 hover:shadow-md transition-all duration-200">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Outstanding Credit</p>
          <p className="text-xl font-bold text-amber-600 mt-1">{formatNaira(totals.totalOutstanding)}</p>
        </button>
      </div>

      {actionError && (
        <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
          <AlertCircle size={14} />
          {actionError}
          <button onClick={() => setActionError(null)} className="ml-auto text-rose-400 hover:text-rose-600 transition-all duration-200">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {['all', 'issued', 'applied', 'void'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
              statusFilter === s ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}>
            {s === 'all' ? 'All' : STATUS_META[s]?.label || s}
          </button>
        ))}
      </div>

      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by credit note number, vendor, or bill..."
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
        </div>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
        <span className="text-xs text-slate-400 font-medium">to</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <div className="bg-gradient-to-r from-slate-200 to-slate-100 animate-pulse rounded-xl h-8 w-48" />
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center gap-2 py-16 text-rose-500 text-sm">
            <AlertCircle size={16} />{queryError}
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
              className="mt-4 py-2 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200"
            >
              New Credit Note
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="px-3 py-3 text-left">VC #</th>
                <th className="px-3 py-3 text-left">Vendor</th>
                <th className="px-3 py-3 text-left">Bill</th>
                <th className="px-3 py-3 text-left">Date</th>
                <th className="px-3 py-3 text-right">Total</th>
                <th className="px-3 py-3 text-right">Remaining</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(n => {
                const statusMeta = STATUS_META[n.status] || { label: n.status, className: 'bg-slate-100 text-slate-600' };
                return (
                  <tr
                    key={n.id}
                    className="group hover:bg-slate-50/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedId(n.id)}
                  >
                    <td className="px-3 py-3 font-mono text-sm font-semibold text-slate-700">{n.vcNumber}</td>
                    <td className="px-3 py-3">
                      <p className="text-sm font-medium text-slate-800">{n.vendor?.name || '\u2014'}</p>
                      {n.vendor?.email && <p className="text-xs text-slate-400">{n.vendor.email}</p>}
                    </td>
                    <td className="px-3 py-3 text-sm text-slate-500 font-mono">{n.billNumber || '\u2014'}</td>
                    <td className="px-3 py-3 text-sm text-slate-500">{fmtDate(n.date)}</td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-700 font-mono">{formatNaira(n.total)}</td>
                    <td className="px-3 py-3 text-right font-semibold text-amber-600 font-mono">{formatNaira(n.remainingCredit)}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusMeta.className === 'bg-amber-50 text-amber-700' ? 'border-amber-200 bg-amber-50 text-amber-700' : statusMeta.className === 'bg-emerald-50 text-emerald-700' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEdit(n); }}
                            title="Edit"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-200"
                          >
                            <Edit2 size={14} />
                          </button>
                          {n.status === 'issued' && n.remainingCredit === n.total && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setVoidTarget(n); }}
                              title="Void credit note"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all duration-200"
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Void Credit Note</h2>
            <p className="text-sm text-slate-500 mb-4">
              Void <span className="font-medium text-slate-700">{voidTarget.vcNumber}</span> ({formatNaira(voidTarget.total)})?
              This reverses its ledger entry and makes it unusable. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setVoidTarget(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-all duration-200">Cancel</button>
              <button onClick={() => voidMutation.mutate(voidTarget.id)} disabled={voidMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-rose-600 to-rose-700 rounded-xl hover:from-rose-700 hover:to-rose-800 disabled:opacity-50 transition-all duration-200">
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

  const { data: org } = useQuery({
    queryKey: ['org'],
    queryFn: orgApi.getOrg,
    staleTime: 60000,
  });

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
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/80">
          <h2 className="text-base font-semibold text-slate-900">Vendor Credit Note</h2>
          <div className="flex items-center gap-1">
            {note && org && (
              <button onClick={() => printVendorCreditNote(note, org)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-200" title="Print vendor credit note">
                <Download size={16} />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-200">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {isLoading || !note ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <div className="bg-gradient-to-r from-slate-200 to-slate-100 animate-pulse rounded-xl h-8 w-48" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-mono text-sm font-semibold text-slate-700">{note.vcNumber}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{fmtDate(note.date)}</p>
                  </div>
                  {statusMeta && (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusMeta.className === 'bg-amber-50 text-amber-700' ? 'border-amber-200 bg-amber-50 text-amber-700' : statusMeta.className === 'bg-emerald-50 text-emerald-700' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
                      {statusMeta.label}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Vendor</p>
                    <p className="font-medium text-slate-800">{note.vendor?.name || '\u2014'}</p>
                    {note.vendor?.email && <p className="text-xs text-slate-400">{note.vendor.email}</p>}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Originating Bill</p>
                    <p className="font-mono text-slate-700">{note.billNumber || '\u2014'}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Subtotal</p>
                  <p className="font-mono font-semibold text-slate-800">{formatNaira(note.subtotal)}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">VAT</p>
                  <p className="font-mono font-semibold text-slate-800">{formatNaira(note.tax)}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Total</p>
                  <p className="font-mono font-semibold text-slate-900">{formatNaira(note.total)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                <div>
                  <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Remaining Credit</p>
                  <p className="text-lg font-bold text-amber-700 font-mono">{formatNaira(note.remainingCredit)}</p>
                </div>
                {canApply && !showApplyForm && (
                  <button
                    onClick={() => setShowApplyForm(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200 shadow-sm"
                  >
                    <ReceiptText size={14} />
                    Apply to Bill
                  </button>
                )}
              </div>

              {showApplyForm && (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-700">Apply Credit to a Bill</h3>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Select Open Bill</label>
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
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow"
                    >
                      <option value="">Select bill...</option>
                      {openBills.map(inv => (
                        <option key={inv.id} value={inv.id}>
                          {inv.billNumber} — Balance Due: {formatNaira(inv.balanceDue)}
                        </option>
                      ))}
                    </select>
                    {openBills.length === 0 && (
                      <p className="text-xs text-slate-400 mt-1">No open bills found for this vendor.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Amount to Apply (₦)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={applyAmount}
                      onChange={e => setApplyAmount(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow"
                    />
                    <p className="text-xs text-slate-400 mt-1">Maximum applicable: {formatNaira(maxApplyAmount)}</p>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => { setShowApplyForm(false); setApplyBillId(''); setApplyAmount(''); }}
                      className="px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-all duration-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleApply}
                      disabled={applyMutation.isPending}
                      className="px-3.5 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 transition-all duration-200"
                    >
                      {applyMutation.isPending ? 'Applying...' : 'Apply Credit'}
                    </button>
                  </div>
                </div>
              )}

              {note.notes && (
                <div className="text-sm text-slate-600 bg-white rounded-2xl border border-slate-200/80 shadow-sm px-3 py-2">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Notes</p>
                  {note.notes}
                </div>
              )}

              {note.status === 'applied' && (
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                  <CheckCircle2 size={14} />
                  This credit note has been fully applied.
                </div>
              )}

              {note.status === 'void' && (
                <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
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
  const [currency, setCurrency] = useState('NGN');
  const [fxRate, setFxRate] = useState<string | null>('1.00000000');
  const [projectId, setProjectId] = useState('');

  const { data: vendors } = useQuery<Vendor[]>({
    queryKey: ['vendors'],
    queryFn: async () => { const r = await api.get('/purchases/vendors'); return r.data; },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
    staleTime: 60000,
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
    const list = vendorBillsData?.bills || vendorBillsData?.invoices || vendorBillsData?.data || vendorBillsData || [];
    return (Array.isArray(list) ? list : []).filter((inv: Bill) => inv.status !== 'draft' && inv.status !== 'void');
  }, [vendorBillsData]);

  const outstandingBills = useMemo(() => {
    return vendorBills.filter(inv => (inv.balanceDue || 0) > 0);
  }, [vendorBills]);

  // Pre-fill subtotal when a bill is selected
  useEffect(() => {
    if (!billId) return;
    const bill = vendorBills.find(inv => inv.id === billId);
    if (bill) {
      setSubtotal((bill.total / 100).toFixed(2));
    }
  }, [billId, vendorBills]);

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
      currency,
      fxRate: fxRate ? parseFloat(fxRate) : undefined,
      projectId: projectId || undefined,
    };
    if (editNote && updateMutation) {
      updateMutation.mutate({ id: editNote.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/80">
          <h2 className="text-base font-semibold text-slate-900">{editNote ? 'Edit Vendor Credit Note' : 'New Vendor Credit Note'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-200">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Vendor</label>
            <select
              value={vendorId}
              onChange={e => { setVendorId(e.target.value); setBillId(''); }}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow"
            >
              <option value="">Select vendor...</option>
              {(vendors || []).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Originating Bill (optional)</label>
            <select
              value={billId}
              onChange={e => setBillId(e.target.value)}
              disabled={!vendorId}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">No specific bill / general credit</option>
              {outstandingBills.length === 0 && vendorBills.length > 0 && (
                <option value="" disabled>All bills are fully paid</option>
              )}
              {outstandingBills.map(inv => (
                <option key={inv.id} value={inv.id}>{inv.billNumber} — {formatNaira(inv.total)} (Due: {formatNaira(inv.balanceDue)})</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">
              Linking a bill is for reference only — apply this credit to any open bill once it is issued.
            </p>
          </div>

          <div className="col-span-2">
            <CurrencySelector
              currency={currency}
              onCurrencyChange={setCurrency}
              fxRate={fxRate}
              onFxRateChange={setFxRate}
              date={date}
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-semibold text-slate-500 uppercase">Project</label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow mt-1 bg-white">
              <option value="">None (no project)</option>
              {projects.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">VAT Rate (%)</label>
              <input
                type="number"
                step="0.1"
                value={taxRate}
                onChange={e => setTaxRate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Credit Subtotal (₦, excl. VAT)</label>
            <input
              type="number"
              step="0.01"
              value={subtotal}
              onChange={e => setSubtotal(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Reason / Notes</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              placeholder="e.g. Returned consignment — 12 units damaged on arrival"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow"
            />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3 space-y-1 text-sm">
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

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200/80">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-all duration-200">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={editNote ? updateMutation?.isPending : createMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 transition-all duration-200"
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
