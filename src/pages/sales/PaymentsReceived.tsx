/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import {
  Search, Loader2, AlertCircle, CreditCard, Plus, Pencil,
  Banknote, Smartphone, Building2, Receipt, Trash2, X,
  FileText, ChevronRight, Download, Upload, CheckCircle2, Wallet, Calendar,
} from 'lucide-react';
import { AccountSearchSelect } from '../../components/ui/AccountSearchSelect';
import { CsvImportModal } from '../../components/ui/CsvImportModal';
import { CurrencySelector } from '../../components/ui/CurrencySelector';

// ── Interfaces ──────────────────────────────────────────────────────────────

interface Payment {
  id: string;
  orgId: string;
  paymentNumber: string;
  category: 'sales_invoice' | 'other_income';
  customerId: string | null;
  payerName: string | null;
  date: string;
  amount: number;
  currency: string;
  fxRate?: string | number | null;
  paymentMethod: string;
  reference: string | null;
  accountId: string;
  incomeAccountId: string | null;
  notes: string | null;
  createdAt: string;
  journalEntryId?: string | null;
  journalEntryNumber?: string | null;
}

interface PaymentAllocation {
  id: string;
  paymentId: string;
  invoiceId: string;
  amount: number;
}

interface PaymentDetail extends Payment {
  allocations: PaymentAllocation[];
  type: string;
  whtAmount?: number;
  totalAllocated?: number;
}

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  customerId: string;
  date: string;
  dueDate: string;
  status: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  currency: string;
  notes: string | null;
  lines: any[];
  customer?: Customer;
}

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  customerCode?: string;
}

interface GLAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
}

interface Org {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
  vatNumber: string | null;
  rcNumber: string | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const METHOD_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  bank_transfer: { label: 'Bank Transfer', icon: Building2 },
  cash:          { label: 'Cash',          icon: Banknote },
  card:          { label: 'Card',          icon: CreditCard },
  cheque:        { label: 'Cheque',        icon: Receipt },
  pos:           { label: 'POS',           icon: CreditCard },
  ussd:          { label: 'USSD',          icon: Smartphone },
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  draft:   { label: 'Draft',          className: 'bg-slate-100 text-slate-600' },
  sent:    { label: 'Sent',           className: 'bg-blue-50 text-blue-600' },
  paid:    { label: 'Paid',           className: 'bg-emerald-50 text-emerald-700' },
  partial: { label: 'Partially Paid', className: 'bg-amber-50 text-amber-700' },
  overdue: { label: 'Overdue',        className: 'bg-rose-50 text-rose-600' },
  void:    { label: 'Void',           className: 'bg-slate-100 text-slate-400' },
};

const PAYMENT_METHODS = ['bank_transfer', 'cash', 'card', 'cheque', 'pos', 'ussd'];

type AllocationItem = {
  invoiceId: string;
  invoiceNumber: string;
  balanceDue: number;
  allocatedAmount: number;
  selected: boolean;
};

type AddFormState = {
  category: 'sales_invoice' | 'other_income';
  payerName: string;
  customerId: string;
  date: string;
  amount: string;
  whtAmount: string;
  paymentMethod: string;
  reference: string;
  accountId: string;
  incomeAccountId: string;
  notes: string;
  allocations: AllocationItem[];
  currency: string;
  fxRate: string | null;
  projectId: string;
};

const EMPTY_ADD_FORM: AddFormState = {
  category: 'other_income',
  payerName: '',
  customerId: '',
  date: new Date().toISOString().split('T')[0],
  amount: '',
  whtAmount: '',
  paymentMethod: 'bank_transfer',
  reference: '',
  accountId: '',
  incomeAccountId: '',
  notes: '',
  allocations: [],
  currency: 'NGN',
  fxRate: '1.00000000',
  projectId: '',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDual(cents: number, currency?: string, fxRate?: number | string | null): string {
  const ngn = formatNaira(cents);
  if (!currency || currency === 'NGN' || !fxRate || Number(fxRate) <= 1) return ngn;
  const original = (cents / 100) / Number(fxRate);
  const cur = original.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency} ${cur}  \u2022  ${ngn}`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusStyle(status: string): string {
  switch (status) {
    case 'paid': return 'background:#d1fae5;color:#065f46';
    case 'partial': return 'background:#fef3c7;color:#92400e';
    case 'sent': return 'background:#dbeafe;color:#1e40af';
    case 'overdue': return 'background:#ffe4e6;color:#e11d48';
    case 'draft': return 'background:#f1f5f9;color:#475569';
    case 'void': return 'background:#f1f5f9;color:#94a3b8';
    default: return 'background:#f1f5f9;color:#475569';
  }
}

function printReceipt(payment: PaymentDetail, org: any, cust: any, invoices: (InvoiceDetail | undefined)[]) {
  const meta = METHOD_META[payment.paymentMethod] || { label: payment.paymentMethod };
  const methodLabel = meta.label;
  const logoHtml = org?.logoUrl
    ? `<img src="${org.logoUrl}" style="height:48px;width:48px;object-fit:contain;border-radius:8px;" />`
    : `<div style="width:48px;height:48px;border-radius:12px;background:#4f46e5;display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;font-weight:700;">${org?.name?.[0]?.toUpperCase() ?? 'S'}</div>`;

  const allocationsHtml = (payment.allocations || []).map(alloc => {
    const inv = invoices.find(i => i?.id === alloc.invoiceId);
    const st = inv ? inv.status : '';
    return `
      <tr>
        <td style="padding:12px;border-bottom:1px solid #e2e8f0;">
          <div style="font-weight:600;font-size:13px;font-family:monospace;color:#1e293b;">${inv?.invoiceNumber || alloc.invoiceId.substring(0,8)}</div>
          ${inv ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">Total ${formatNaira(inv.total)} · Due ${formatNaira(inv.balanceDue)}</div>` : ''}
          <div style="font-size:11px;font-weight:600;color:#059669;margin-top:2px;">Applied: ${formatNaira(alloc.amount)}</div>
        </td>
        <td style="padding:12px;border-bottom:1px solid #e2e8f0;text-align:right;vertical-align:middle;">
          ${st ? `<span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:10px;font-weight:700;text-transform:capitalize;${statusStyle(st)}">${STATUS_META[st]?.label || st}</span>` : ''}
        </td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><title>Payment Receipt - ${payment.paymentNumber}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:48px;color:#1e293b}
  @media print{body{padding:24px}}
</style></head><body>
<div style="max-width:640px;margin:0 auto;background:#fff;">
  <div style="height:6px;background:linear-gradient(90deg,#4f46e5,#8b5cf6,#818cf8);border-radius:3px;margin-bottom:32px;"></div>

  <!-- Header -->
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
            ${(org?.rcNumber || org?.vatNumber) ? `<div style="font-size:10px;color:#94a3b8;margin-top:2px;">${org?.rcNumber ? 'RC: '+org.rcNumber : ''}${org?.rcNumber && org?.vatNumber ? ' · ' : ''}${org?.vatNumber ? 'VAT: '+org.vatNumber : ''}</div>` : ''}
          </div>
        </div>
      </td>
      <td style="vertical-align:top;text-align:right;">
        <div style="font-size:11px;font-weight:700;color:#4f46e5;text-transform:uppercase;letter-spacing:2px;">Payment Receipt</div>
        <div style="font-size:24px;font-weight:900;color:#0f172a;letter-spacing:-0.5px;margin-top:4px;">${payment.paymentNumber}</div>
        <div style="display:inline-block;margin-top:6px;padding:3px 12px;border-radius:999px;font-size:11px;font-weight:600;background:#d1fae5;color:#065f46;border:1px solid #a7f3d0;">Received</div>
      </td>
    </tr>
  </table>

  <!-- From / Details -->
  <table style="width:100%;border-collapse:collapse;margin-top:32px;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">
    <tr>
      <td style="vertical-align:top;padding:24px 16px 24px 0;width:60%;">
        <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Received From</div>
        <div style="font-size:14px;font-weight:700;color:#0f172a;">${cust?.name || payment.payerName || '—'}</div>
        ${cust?.address ? `<div style="font-size:11px;color:#64748b;margin-top:3px;">${cust.address}</div>` : ''}
        ${cust?.city ? `<div style="font-size:11px;color:#64748b;">${cust.city}${cust?.state ? ', '+cust.state : ''}</div>` : ''}
        ${cust?.country ? `<div style="font-size:11px;color:#64748b;">${cust.country}</div>` : ''}
        <div style="margin-top:6px;">
          ${cust?.phone ? `<span style="font-size:11px;color:#64748b;">${cust.phone}</span>` : ''}
          ${cust?.phone && cust?.email ? ' · ' : ''}
          ${cust?.email ? `<span style="font-size:11px;color:#64748b;">${cust.email}</span>` : ''}
        </div>
      </td>
      <td style="vertical-align:top;padding:24px 0 24px 16px;text-align:right;">
        <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Receipt Details</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tr><td style="padding:3px 0;color:#94a3b8;text-align:left;">Date</td><td style="padding:3px 0;font-weight:500;color:#334155;text-align:right;">${fmtDate(payment.date)}</td></tr>
          <tr><td style="padding:3px 0;color:#94a3b8;text-align:left;">Method</td><td style="padding:3px 0;font-weight:500;color:#334155;text-align:right;">${methodLabel}</td></tr>
          ${payment.reference ? `<tr><td style="padding:3px 0;color:#94a3b8;text-align:left;">Reference</td><td style="padding:3px 0;font-weight:500;color:#334155;text-align:right;font-family:monospace;">${payment.reference}</td></tr>` : ''}
        </table>
      </td>
    </tr>
  </table>

  <!-- Amount -->
  <div style="margin-top:24px;padding:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
    ${(payment.whtAmount || 0) > 0 ? `
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <tr><td style="padding:4px 0;color:#64748b;">Invoice Amount</td><td style="padding:4px 0;text-align:right;font-weight:600;font-family:monospace;color:#334155;">${formatNaira(payment.totalAllocated || payment.amount)}</td></tr>
      <tr><td style="padding:4px 0;color:#d97706;">Less: WHT Withheld by Customer</td><td style="padding:4px 0;text-align:right;font-weight:500;font-family:monospace;color:#d97706;">− ${formatNaira(payment.whtAmount!)}</td></tr>
      <tr><td style="padding:8px 0 0 0;border-top:1px solid #cbd5e1;"></td><td style="padding:8px 0 0 0;border-top:1px solid #cbd5e1;"></td></tr>
      <tr><td style="padding:4px 0;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Net Amount Received</td><td style="padding:4px 0;text-align:right;font-size:20px;font-weight:900;color:#059669;font-family:monospace;">${formatNaira(payment.amount)}</td></tr>
    </table>
    ` : `
    <div style="text-align:center;">
      <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Net Amount Received</div>
      <div style="font-size:28px;font-weight:900;color:#059669;font-family:monospace;">${formatNaira(payment.amount)}</div>
    </div>
    `}
    <div style="font-size:11px;color:#94a3b8;text-align:center;margin-top:6px;">${payment.currency}</div>
  </div>

  <!-- Allocated To -->
  ${(payment.allocations || []).length > 0 ? `
  <div style="margin-top:24px;">
    <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Allocated To</div>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="background:#f1f5f9;"><th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;">Invoice</th><th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;">Status</th></tr></thead>
      <tbody>${allocationsHtml}</tbody>
    </table>
  </div>
  ` : ''}

  <!-- Notes -->
  ${payment.notes ? `
  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;">
    <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Notes</div>
    <div style="font-size:12px;color:#64748b;line-height:1.6;">${payment.notes}</div>
  </div>
  ` : ''}

  <!-- Footer -->
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;font-size:10px;color:#94a3b8;">
    ${org?.name || 'Your Company'} · This receipt was generated electronically and confirms the payment recorded above.
  </div>
</div>
</body></html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
  else { alert('Popup blocked. Please allow popups for this site and try again.'); }
}

function printPaymentDetail(payment: PaymentDetail, org: any) {
  const meta = METHOD_META[payment.paymentMethod] || { label: payment.paymentMethod };
  const logoHtml = org?.logoUrl
    ? `<img src="${org.logoUrl}" style="height:48px;width:48px;object-fit:contain;border-radius:8px;" />`
    : `<div style="width:48px;height:48px;border-radius:12px;background:#4f46e5;display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;font-weight:700;">${org?.name?.[0]?.toUpperCase() ?? 'S'}</div>`;

  const html = `<!DOCTYPE html><html><head><title>Payment Detail - ${payment.paymentNumber}</title>
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
        <div style="font-size:11px;font-weight:700;color:#4f46e5;text-transform:uppercase;letter-spacing:2px;">Payment Detail</div>
        <div style="font-size:24px;font-weight:900;color:#0f172a;letter-spacing:-0.5px;margin-top:4px;">${payment.paymentNumber}</div>
        <div style="display:inline-block;margin-top:6px;padding:3px 12px;border-radius:999px;font-size:11px;font-weight:600;background:#fef3c7;color:#92400e;border:1px solid #fde68a;">Other Income</div>
      </td>
    </tr>
  </table>

  <table style="width:100%;border-collapse:collapse;margin-top:32px;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">
    <tr>
      <td style="vertical-align:top;padding:24px 16px 24px 0;width:60%;">
        <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">From</div>
        <div style="font-size:14px;font-weight:700;color:#0f172a;">${payment.payerName || '—'}</div>
      </td>
      <td style="vertical-align:top;padding:24px 0 24px 16px;text-align:right;">
        <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Details</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tr><td style="padding:3px 0;color:#94a3b8;text-align:left;">Date</td><td style="padding:3px 0;font-weight:500;color:#334155;text-align:right;">${fmtDate(payment.date)}</td></tr>
          <tr><td style="padding:3px 0;color:#94a3b8;text-align:left;">Method</td><td style="padding:3px 0;font-weight:500;color:#334155;text-align:right;">${meta.label}</td></tr>
          ${payment.reference ? `<tr><td style="padding:3px 0;color:#94a3b8;text-align:left;">Reference</td><td style="padding:3px 0;font-weight:500;color:#334155;text-align:right;font-family:monospace;">${payment.reference}</td></tr>` : ''}
        </table>
      </td>
    </tr>
  </table>

  <div style="margin-top:24px;padding:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
    <div style="text-align:center;">
      <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Total Received</div>
      <div style="font-size:28px;font-weight:900;color:#059669;font-family:monospace;">${formatNaira(payment.amount)}</div>
    </div>
    <div style="font-size:11px;color:#94a3b8;text-align:center;margin-top:6px;">${payment.currency}</div>
  </div>

  ${payment.notes ? `
  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;">
    <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Notes</div>
    <div style="font-size:12px;color:#64748b;line-height:1.6;">${payment.notes}</div>
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

// ── Export Helpers ──────────────────────────────────────────────────────────

function exportPaymentsCSV(payments: Payment[]) {
  const headers = ['Payment #','Payer','Date','Amount (₦)','Method','Reference','Category','Notes'];
  const rows = payments.map(p => [
    p.paymentNumber, p.payerName||'', p.date, (p.amount/100).toFixed(2),
    p.paymentMethod, p.reference||'', p.category, p.notes||'',
  ]);
  const csv = [headers,...rows].map(r => r.map(val => `"${val}"`).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url;
  a.download=`payments-received-${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

function exportPaymentsPDF(payments: Payment[]) {
  const fmt = (k: number) => `₦${(k/100).toLocaleString('en-NG',{minimumFractionDigits:2})}`;
  const rows = payments.map(p => `
    <tr>
      <td>${p.paymentNumber}</td>
      <td>${p.payerName||'\u2014'}</td>
      <td>${new Date(p.date).toLocaleDateString('en-GB')}</td>
      <td style="text-align:right">${fmt(p.amount)}</td>
      <td>${p.paymentMethod}</td>
      <td>${p.reference||'\u2014'}</td>
      <td><span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;background:#f1f5f9;color:#475569">${p.category}</span></td>
    </tr>`).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Payments Received</title>
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
    <div style="text-align:right"><div class="title">Payments Received Report</div><div class="date">Generated: ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</div><div class="date">${payments.length} payments</div></div>
  </div>
  <table><thead><tr><th>Payment #</th><th>Payer</th><th>Date</th><th style="text-align:right">Amount</th><th>Method</th><th>Reference</th><th>Category</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="footer">SkyBooks By Skyhouse Accountants &amp; Technologies (Olalekan Williams Edun) &bull; Confidential</div>
  </body></html>`;
  const w = window.open('','_blank');
  if (w) { w.document.write(html); w.document.close(); setTimeout(()=>w.print(),500); }
}

// ── Main Page ────────────────────────────────────────────────────────────────

export function PaymentsReceivedPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm]           = useState('');
  const [methodFilter, setMethodFilter]       = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [receiptPaymentId, setReceiptPaymentId]   = useState<string | null>(null);

  useEffect(() => {
    const selected = searchParams.get('selected');
    if (selected) setSelectedPaymentId(selected);
  }, [searchParams]);

  // Add modal
  const [addOpen, setAddOpen]     = useState(false);
  const [addForm, setAddForm]     = useState<AddFormState>(EMPTY_ADD_FORM);
  const [addError, setAddError]   = useState<string | null>(null);

  // Edit modal
  const [editTarget, setEditTarget] = useState<Payment | null>(null);
  const [editForm, setEditForm]     = useState<Partial<AddFormState>>({});
  const [editError, setEditError]   = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null);
  const [deleteError, setDeleteError]   = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: payments, isLoading, isError } = useQuery<Payment[]>({
    queryKey: ['sales', 'payments'],
    queryFn: async () => { const r = await api.get('/sales/payments'); return r.data; },
  });

  const nextReference = useMemo(() => {
    if (!payments) return 'TXN-00001';
    let max = 0;
    payments.forEach(p => {
      const ref = p.reference || '';
      const match = ref.match(/^TXN-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > max) max = num;
      }
    });
    return `TXN-${String(max + 1).padStart(5, '0')}`;
  }, [payments]);

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ['sales', 'customers'],
    queryFn: async () => { const r = await api.get('/sales/customers'); return r.data; },
  });

  const { data: org } = useQuery<Org>({
    queryKey: ['org'],
    queryFn: async () => { const r = await api.get('/org'); return r.data; },
    staleTime: 60000,
  });

  const { data: glAccounts } = useQuery<GLAccount[]>({
    queryKey: ['accountant', 'accounts'],
    queryFn: async () => { const r = await api.get('/accountant/accounts'); return r.data; },
  });

  const { data: bankAccounts } = useQuery<any[]>({
    queryKey: ['bankAccounts'],
    queryFn: async () => { const r = await api.get('/banking/accounts'); return r.data; },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
    staleTime: 60000,
  });

  const { data: allInvoicesResult } = useQuery<any>({
    queryKey: ['invoices'],
    queryFn: async () => { const r = await api.get('/sales/invoices', { params: { limit: 200 } }); return r.data; },
  });

  const invoicesList = useMemo(() => {
    if (!allInvoicesResult) return [];
    return Array.isArray(allInvoicesResult) ? allInvoicesResult : (allInvoicesResult.invoices || allInvoicesResult.data || []);
  }, [allInvoicesResult]);

  const { data: detail, isLoading: loadingDetail } = useQuery<PaymentDetail>({
    queryKey: ['sales', 'payment-detail', selectedPaymentId],
    queryFn: async () => { const r = await api.get(`/sales/payments/${selectedPaymentId}`); return r.data; },
    enabled: !!selectedPaymentId,
  });

  const allocationInvoiceIds = detail?.allocations?.map(a => a.invoiceId) || [];
  const { data: allocationInvoices } = useQuery<InvoiceDetail[]>({
    queryKey: ['allocation-invoices', allocationInvoiceIds.join(',')],
    queryFn: async () => {
      const results = await Promise.all(
        allocationInvoiceIds.map(id => api.get(`/sales/invoices/${id}`).then(r => r.data))
      );
      return results;
    },
    enabled: allocationInvoiceIds.length > 0,
  });

  // ── Derived ────────────────────────────────────────────────────────────────

  const invoiceCustomerMap = useMemo(() => {
    const m = new Map<string, string>();
    invoicesList.forEach((inv: any) => { if (inv.id && inv.customerId) m.set(inv.id, inv.customerId); });
    return m;
  }, [invoicesList]);

  const outstandingInvoices = useMemo(() => {
    if (addForm.category !== 'sales_invoice' || !invoicesList.length) return [];
    return invoicesList.filter((inv: any) => {
      if (addForm.customerId && inv.customerId !== addForm.customerId) return false;
      const outstanding = ['Unpaid', 'Overdue', 'sent', 'partial', 'draft'].includes(inv.status?.toLowerCase());
      return outstanding && (inv.balanceDue || inv.total) > 0;
    });
  }, [addForm.category, invoicesList, addForm.customerId]);

  useEffect(() => {
    if (addForm.category === 'sales_invoice' && outstandingInvoices.length > 0) {
      const allocs: AllocationItem[] = outstandingInvoices.map((inv: any) => ({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber || `INV-${inv.id.substring(0, 6).toUpperCase()}`,
        balanceDue: inv.balanceDue ?? inv.total ?? 0,
        allocatedAmount: 0,
        selected: false,
      }));
      if (allocs.length !== addForm.allocations.length || allocs.some((a, i) => a.invoiceId !== addForm.allocations[i]?.invoiceId)) {
        setAddForm(f => ({ ...f, allocations: allocs }));
      }
    } else if (addForm.category !== 'sales_invoice') {
      setAddForm(f => ({ ...f, allocations: [] }));
    }
  }, [addForm.category, outstandingInvoices]);

  const handleAllocToggle = (index: number) => {
    setAddForm(f => {
      const allocs = [...f.allocations];
      const wasSelected = allocs[index].selected;
      allocs[index] = { ...allocs[index], selected: !wasSelected };
      let customerId = f.customerId;
      if (!wasSelected) {
        const invCustomerId = invoiceCustomerMap.get(allocs[index].invoiceId);
        if (invCustomerId && invCustomerId !== customerId) {
          customerId = invCustomerId;
        }
      }
      return { ...f, allocations: allocs, customerId };
    });
  };

  const totalAllocated = useMemo(() => {
    return addForm.allocations
      .filter(a => a.selected)
      .reduce((s, a) => s + (a.allocatedAmount || 0), 0);
  }, [addForm.allocations]);

  // Auto-distribute net + WHT across selected invoices
  useEffect(() => {
    const amountKobo = Math.round((parseFloat(addForm.amount) || 0) * 100);
    const whtKobo = Math.round((parseFloat(addForm.whtAmount) || 0) * 100);
    const grossKobo = amountKobo + whtKobo;
    const selected = addForm.allocations.filter(a => a.selected);
    if (!selected.length) return;
    let remaining = grossKobo;
    const updated = addForm.allocations.map(a => {
      if (!a.selected) return { ...a, allocatedAmount: 0 };
      const applied = Math.max(0, Math.min(remaining, a.balanceDue));
      remaining -= applied;
      return { ...a, allocatedAmount: applied };
    });
    const changed = updated.some((a, i) => a.allocatedAmount !== addForm.allocations[i].allocatedAmount);
    if (changed) setAddForm(f => ({ ...f, allocations: updated }));
  }, [addForm.amount, addForm.whtAmount, addForm.allocations.map(a => a.selected).join(',')]);

  const customerMap = useMemo(() => {
    const m = new Map<string, Customer>();
    (customers || []).forEach(c => m.set(c.id, c));
    return m;
  }, [customers]);

  const invoiceMap = useMemo(() => {
    const m = new Map<string, InvoiceDetail>();
    (allocationInvoices || []).forEach(inv => m.set(inv.id, inv));
    return m;
  }, [allocationInvoices]);

  const revenueAccounts = (glAccounts || []).filter(a => a.type === 'revenue' && a.isActive);
  const assetAccounts   = (glAccounts || []).filter(a => a.type === 'asset'   && a.isActive);

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return (payments || []).filter(p => {
      if (methodFilter !== 'all' && p.paymentMethod !== methodFilter) return false;
      if (dateFrom && p.date < dateFrom) return false;
      if (dateTo && p.date > dateTo) return false;
      if (!term) return true;
      const cust = p.customerId ? customerMap.get(p.customerId) : null;
      return (
        p.paymentNumber.toLowerCase().includes(term) ||
        (cust?.name || '').toLowerCase().includes(term) ||
        (p.payerName || '').toLowerCase().includes(term) ||
        (p.reference || '').toLowerCase().includes(term)
      );
    });
  }, [payments, searchTerm, methodFilter, dateFrom, dateTo, customerMap]);

  const totals = useMemo(() => ({
    count: filtered.length,
    sum: filtered.reduce((s, p) => s + p.amount, 0),
  }), [filtered]);

  const methods = useMemo(() => Array.from(new Set((payments || []).map(p => p.paymentMethod))), [payments]);

  const selectedPayment = selectedPaymentId ? (payments || []).find(p => p.id === selectedPaymentId) : null;

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/sales/payments', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'payments'] });
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
      setAddOpen(false);
      setAddForm(EMPTY_ADD_FORM);
      setAddError(null);
    },
    onError: (e: any) => setAddError(e?.response?.data?.error || 'Failed to record payment.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => api.patch(`/sales/payments/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'payments'] });
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
      setEditTarget(null);
      setEditError(null);
    },
    onError: (e: any) => setEditError(e?.response?.data?.error || 'Failed to update payment.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sales/payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
      setDeleteTarget(null);
      setDeleteError(null);
      if (selectedPaymentId === deleteTarget?.id) setSelectedPaymentId(null);
    },
    onError: (e: any) => setDeleteError(e?.response?.data?.error || 'Failed to reverse payment.'),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    if (!addForm.amount || parseFloat(addForm.amount) <= 0) { setAddError('Amount is required.'); return; }
    if (!addForm.accountId) { setAddError('Bank / deposit account is required.'); return; }
    if (addForm.category === 'other_income' && !addForm.payerName.trim() && !addForm.customerId) {
      setAddError('Payer name or customer is required.'); return;
    }
    if (addForm.category === 'sales_invoice') {
      const totalAlloc = addForm.allocations.filter(a => a.selected).reduce((s, a) => s + Math.round(a.allocatedAmount), 0);
      const netAmt = Math.round(parseFloat(addForm.amount) * 100);
      const whtKobo = Math.round((parseFloat(addForm.whtAmount) || 0) * 100);
      if (totalAlloc > 0 && totalAlloc !== netAmt + whtKobo) {
        setAddError(`Allocated sum (₦${(totalAlloc/100).toFixed(2)}) must match net receipt plus WHT (₦${((netAmt+whtKobo)/100).toFixed(2)}).`);
        return;
      }
    }
    const activeAllocations = addForm.allocations
      .filter(a => a.selected && a.allocatedAmount > 0)
      .map(a => ({ invoiceId: a.invoiceId, amount: Math.round(a.allocatedAmount) }));
    const payload: any = {
      category: addForm.category,
      payerName: addForm.payerName.trim() || null,
      customerId: addForm.customerId || null,
      date: addForm.date,
      amount: Math.round(parseFloat(addForm.amount) * 100),
      whtAmount: Math.round((parseFloat(addForm.whtAmount) || 0) * 100),
      paymentMethod: addForm.paymentMethod,
      reference: addForm.reference.trim() || null,
      accountId: addForm.accountId,
      incomeAccountId: addForm.incomeAccountId || null,
      notes: addForm.notes.trim() || null,
      allocations: activeAllocations,
      currency: addForm.currency,
      fxRate: addForm.fxRate ? parseFloat(addForm.fxRate) : undefined,
      projectId: addForm.projectId || undefined,
    };
    createMutation.mutate(payload);
  }

  function openEditModal(p: Payment) {
    setEditTarget(p);
    const cust = p.customerId ? customerMap.get(p.customerId) : null;
    setEditForm({
      payerName: p.payerName || cust?.name || '',
      date: p.date.split('T')[0],
      amount: (p.amount / 100).toString(),
      paymentMethod: p.paymentMethod,
      reference: p.reference || '',
      notes: p.notes || '',
      accountId: p.accountId || '',
    });
    setEditError(null);
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    const payload: any = {
      payerName: editForm.payerName?.trim() || null,
      date: editForm.date,
      reference: editForm.reference?.trim() || null,
      notes: editForm.notes?.trim() || null,
      accountId: editForm.accountId || null,
    };
    if (editForm.amount) payload.amount = Math.round(parseFloat(editForm.amount) * 100);
    updateMutation.mutate({ id: editTarget.id, payload });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Page header */}
        <div className="flex items-start justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => { setAddForm({ ...EMPTY_ADD_FORM, reference: nextReference }); setAddError(null); setAddOpen(true); }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-xs font-medium rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200 shadow-sm">
              <Plus size={14} />+New
            </button>
            <button onClick={() => exportPaymentsCSV(filtered)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-xl hover:bg-slate-50 transition-all duration-200">
              <Download size={14} /> CSV
            </button>
            <button onClick={() => exportPaymentsPDF(filtered)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-xl hover:bg-slate-50 transition-all duration-200">
              <FileText size={14} /> PDF
            </button>
            <button onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-white text-slate-700 text-xs font-medium border border-slate-200 rounded-xl hover:bg-slate-50 transition-all duration-200">
              <Upload size={14} />Import CSV
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button onClick={() => { setDateFrom(''); setDateTo(''); setMethodFilter('all'); setSearchTerm(''); }} className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl shadow-md p-5 text-left cursor-pointer hover:from-blue-600 hover:to-blue-800 hover:shadow-lg transition-all duration-200 group">
            <div className="absolute top-3 right-3 p-2 rounded-xl bg-white/10 text-white/40 group-hover:scale-110 transition-transform duration-200">
              <Wallet size={20} />
            </div>
            <p className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">Total Receipts</p>
            <p className="text-2xl font-bold text-white mt-1.5">{formatNaira((payments || []).reduce((s, p) => s + p.amount, 0))}</p>
            <p className="text-[11px] text-white/40 mt-1">Click to clear filters</p>
          </button>
          <button onClick={() => {
            const now = new Date();
            const first = new Date(now.getFullYear(), now.getMonth(), 1);
            const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            setDateFrom(first.toISOString().split('T')[0]);
            setDateTo(last.toISOString().split('T')[0]);
            setMethodFilter('all');
            setSearchTerm('');
          }} className="relative overflow-hidden bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl shadow-md p-5 text-left cursor-pointer hover:from-indigo-600 hover:to-indigo-800 hover:shadow-lg transition-all duration-200 group">
            <div className="absolute top-3 right-3 p-2 rounded-xl bg-white/10 text-white/40 group-hover:scale-110 transition-transform duration-200">
              <Calendar size={20} />
            </div>
            <p className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">This Month</p>
            <p className="text-2xl font-bold text-white mt-1.5">
              {formatNaira((payments || []).filter(p => {
                const d = new Date(p.date); const now = new Date();
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
              }).reduce((s, p) => s + p.amount, 0))}
            </p>
            <p className="text-[11px] text-white/40 mt-1">{new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}</p>
          </button>
          <button onClick={() => { setDateFrom(''); setDateTo(''); setMethodFilter('all'); setSearchTerm(''); }} className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl shadow-md p-5 text-left cursor-pointer hover:from-emerald-600 hover:to-emerald-800 hover:shadow-lg transition-all duration-200 group">
            <div className="absolute top-3 right-3 p-2 rounded-xl bg-white/10 text-white/40 group-hover:scale-110 transition-transform duration-200">
              <CreditCard size={20} />
            </div>
            <p className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">Total Count</p>
            <p className="text-2xl font-bold text-white mt-1.5">{(payments || []).length}</p>
            <p className="text-[11px] text-white/40 mt-1">payments received</p>
          </button>
        </div>

        <div className="flex gap-6">
          {/* List panel */}
          <div className={`flex-1 min-w-0 ${selectedPaymentId ? 'hidden lg:block' : ''}`}>
            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setMethodFilter('all')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${methodFilter === 'all' ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                All Methods
              </button>
              {methods.map(m => (
                <button key={m} onClick={() => setMethodFilter(m)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${methodFilter === m ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                  {METHOD_META[m]?.label || m}
                </button>
              ))}
            </div>

            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search by payment number, customer, or reference..."
                  className="w-full px-9 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
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
                  <Loader2 size={20} className="animate-spin mr-2" />Loading payments...
                </div>
              ) : isError ? (
                <div className="flex items-center justify-center gap-2 py-16 text-rose-500 text-sm">
                  <AlertCircle size={16} />Failed to load payments.
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <Banknote size={28} className="text-slate-300 mb-3" />
                  <p className="text-sm font-medium text-slate-600">No payments yet</p>
                  <p className="text-xs text-slate-400 mt-1">Record your first payment using the button above.</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="px-3 py-3 text-left">Payment #</th>
                      <th className="px-3 py-3 text-left">From</th>
                      <th className="px-3 py-3 text-left">Date</th>
                      <th className="px-3 py-3 text-left">Method</th>
                      <th className="px-3 py-3 text-right">Amount</th>
                      <th className="px-3 py-3 text-center">Ledger</th>
                      <th className="px-3 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map(p => {
                      const cust = p.customerId ? customerMap.get(p.customerId) : null;
                      const displayName = cust?.name || p.payerName || '—';
                      const displayEmail = cust?.email || null;
                      const meta = METHOD_META[p.paymentMethod] || { label: p.paymentMethod, icon: Banknote };
                      const Icon = meta.icon;
                      const isSelected = p.id === selectedPaymentId;
                      return (
                        <tr key={p.id} onClick={() => setSelectedPaymentId(isSelected ? null : p.id)}
                          className={`group cursor-pointer hover:bg-slate-50/50 transition-colors ${isSelected ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : ''}`}>
                          <td className="px-3 py-3">
                            <p className="font-mono text-sm font-semibold text-slate-700">{p.paymentNumber}</p>
                            {p.category === 'other_income' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">Other Income</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <p className="text-sm font-medium text-slate-800">{displayName}</p>
                            {displayEmail && <p className="text-xs text-slate-400">{displayEmail}</p>}
                          </td>
                          <td className="px-3 py-3 text-sm text-slate-500">{fmtDate(p.date)}</td>
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                              <Icon className="w-3.5 h-3.5 text-slate-400" />
                              {meta.label}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right font-semibold text-emerald-700 font-mono">
                            {formatNaira(p.amount)}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {p.journalEntryId ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); navigate(`/accountant/journals?entry=${p.journalEntryNumber || ''}`); }}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all duration-200"
                              ><CheckCircle2 className="w-3 h-3" /> Posted</button>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">Not posted</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <div className="opacity-0 group-hover:opacity-100 flex items-center justify-end gap-1 transition-opacity" onClick={e => e.stopPropagation()}>
                              {p.category === 'sales_invoice' ? (
                                <button onClick={() => setReceiptPaymentId(p.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-200" title="Download receipt">
                                  <Download size={14} />
                                </button>
                              ) : (
                                <button onClick={() => { if (org) printPaymentDetail(p as PaymentDetail, org); }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-200" title="Print payment detail">
                                  <Download size={14} />
                                </button>
                              )}
                              <button onClick={() => openEditModal(p)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all duration-200" title="Edit payment">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => { setDeleteTarget(p); setDeleteError(null); }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all duration-200" title="Reverse payment">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50/80">
                      <td colSpan={4} className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        {filtered.length} payments shown
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-slate-800 font-mono">{formatNaira(totals.sum)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>

          {/* Detail panel */}
          {selectedPaymentId && (
            <div className="w-full lg:w-96 shrink-0">
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden sticky top-6">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <div>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Payment Detail</p>
                    <p className="text-base font-bold text-slate-900 mt-0.5">{selectedPayment?.paymentNumber}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {selectedPayment?.category === 'sales_invoice' ? (
                      <button onClick={() => setReceiptPaymentId(selectedPaymentId)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" title="Download receipt">
                        <Download size={16} />
                      </button>
                    ) : (
                      <button onClick={() => { if (selectedPayment && org) printPaymentDetail(selectedPayment as PaymentDetail, org); }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" title="Print payment detail">
                        <Download size={16} />
                      </button>
                    )}
                    <button onClick={() => selectedPayment && openEditModal(selectedPayment)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100" title="Edit">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => setSelectedPaymentId(null)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {loadingDetail ? (
                  <div className="flex items-center justify-center py-12 text-slate-400">
                    <Loader2 size={18} className="animate-spin mr-2" />Loading...
                  </div>
                ) : detail ? (
                  <div className="p-5 space-y-5">
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">From</span>
                        <span className="font-medium text-slate-800">
                          {detail.customerId ? (customerMap.get(detail.customerId)?.name || '—') : (detail.payerName || '—')}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Category</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${detail.category === 'sales_invoice' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                          {detail.category === 'sales_invoice' ? 'Invoice Payment' : 'Other Income'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Date</span>
                        <span className="font-medium text-slate-800">{fmtDate(detail.date)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Method</span>
                        <span className="font-medium text-slate-800">{METHOD_META[detail.paymentMethod]?.label || detail.paymentMethod}</span>
                      </div>
                      {detail.reference && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Reference</span>
                          <span className="font-medium text-slate-800 font-mono">{detail.reference}</span>
                        </div>
                      )}
                      {(detail.whtAmount || 0) > 0 ? (
                        <div className="border-t border-slate-100 pt-3 space-y-1.5">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Invoice Amount</span>
                            <span className="font-mono text-slate-700">{formatNaira(detail.totalAllocated || detail.amount)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Less: WHT Withheld by Customer</span>
                            <span className="font-mono text-amber-600">− {formatNaira(detail.whtAmount!)}</span>
                          </div>
                          <div className="flex justify-between items-center pt-1.5 border-t border-slate-100">
                            <span className="text-sm font-semibold text-slate-700">Net Amount Received</span>
                            <span className="text-lg font-black text-emerald-700 font-mono">{formatNaira(detail.amount)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center py-3 border-t border-slate-100">
                          <span className="text-sm font-semibold text-slate-700">Total Received</span>
                          <span className="text-lg font-black text-emerald-700 font-mono">{formatNaira(detail.amount)}</span>
                        </div>
                      )}
                    </div>

                    {detail.allocations && detail.allocations.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                          <FileText size={12} />Allocated To
                        </p>
                        <div className="space-y-2">
                          {detail.allocations.map(alloc => {
                            const inv = invoiceMap.get(alloc.invoiceId);
                            const statusMeta = inv ? STATUS_META[inv.status] : null;
                            return (
                              <div key={alloc.id}
                                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-slate-800 font-mono">
                                      {inv?.invoiceNumber || alloc.invoiceId.substring(0, 8) + '...'}
                                    </span>
                                    {statusMeta && (
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize ${statusMeta.className}`}>
                                        {statusMeta.label}
                                      </span>
                                    )}
                                  </div>
                                  {inv && (
                                    <p className="text-xs text-slate-400 mt-0.5">
                                      Total {formatNaira(inv.total)} · Due {formatNaira(inv.balanceDue)}
                                    </p>
                                  )}
                                  <p className="text-xs font-medium text-emerald-700 mt-0.5">
                                    Applied: {formatNaira(alloc.amount)}
                                  </p>
                                </div>
                                <button onClick={() => navigate(`/sales/invoices/${alloc.invoiceId}`)}
                                  className="ml-2 p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 shrink-0">
                                  <ChevronRight size={16} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {detail.notes && (
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Notes</p>
                        <p className="text-sm text-slate-600 leading-relaxed">{detail.notes}</p>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-100">
                      <button onClick={() => { setDeleteTarget(selectedPayment!); setDeleteError(null); }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50 transition-colors">
                        <Trash2 size={14} />Reverse Payment
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Add Payment Modal ────────────────────────────────────────────────── */}
      {addOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 px-4 overflow-y-auto py-8">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Record Payment Received</h2>
              <button onClick={() => { setAddOpen(false); setAddError(null); }} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"><X size={18} /></button>
            </div>
            <form onSubmit={handleAddSubmit} className="px-5 py-4 space-y-3 max-h-[75vh] overflow-y-auto">
              {addError && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">{addError}</div>}

              {/* Category toggle */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Payment Category</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['other_income', 'sales_invoice'] as const).map(cat => (
                    <button key={cat} type="button"
                      onClick={() => setAddForm(f => ({ ...f, category: cat }))}
                      className={`py-2 px-3 rounded-xl text-sm font-medium border transition-all duration-200 ${addForm.category === cat ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      {cat === 'sales_invoice' ? 'Invoice Payment' : 'Other Income'}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {addForm.category === 'other_income'
                    ? 'Use for grants, donations, asset sales, or any non-invoice income.'
                    : 'Records payment and allocates it to an invoice via the invoice detail page.'}
                </p>
              </div>

              {addForm.category === 'other_income' ? (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Payer Name</label>
                  <input value={addForm.payerName} onChange={e => setAddForm(f => ({ ...f, payerName: e.target.value }))}
                    placeholder="e.g. Federal Government Grant, Asset Disposal"
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Customer</label>
                  <select value={addForm.customerId} onChange={e => setAddForm(f => ({ ...f, customerId: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow">
                    <option value="">Select customer...</option>
                    {(customers || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              {addForm.category === 'sales_invoice' && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Outstanding Invoices</label>
                  {addForm.allocations.length === 0 ? (
                    <p className="text-xs text-slate-400">No outstanding invoices found.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {addForm.allocations.map((alloc, idx) => {
                        const cName = customers?.find(c => c.id === invoiceCustomerMap.get(alloc.invoiceId))?.name || '';
                        return (
                          <label key={alloc.invoiceId} className="flex items-center gap-3 p-2 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                            <input type="checkbox" checked={alloc.selected}
                              onChange={() => handleAllocToggle(idx)}
                              className="h-4 w-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800">{alloc.invoiceNumber}</p>
                              <p className="text-xs text-slate-400">{cName} &middot; Balance: {formatNaira(alloc.balanceDue)}</p>
                            </div>
                            <div className="text-right">
                              {alloc.selected && (
                                <p className="text-sm font-semibold text-emerald-700">{formatNaira(alloc.allocatedAmount || 0)}</p>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <CurrencySelector
                currency={addForm.currency}
                onCurrencyChange={c => setAddForm(f => ({ ...f, currency: c }))}
                fxRate={addForm.fxRate}
                onFxRateChange={r => setAddForm(f => ({ ...f, fxRate: r }))}
                date={addForm.date}
              />

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">Project</label>
                <select value={addForm.projectId} onChange={e => setAddForm(f => ({ ...f, projectId: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow mt-1 bg-white">
                  <option value="">None (no project)</option>
                  {projects.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
                  <input type="date" value={addForm.date} onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Net Amount Received ({addForm.currency})</label>
                  <input type="number" step="0.01" value={addForm.amount} onChange={e => setAddForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                  <p className="text-[10px] text-slate-400 mt-0.5">Invoice total minus WHT deducted at source</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">WHT Deducted at Source (₦)</label>
                <input type="number" step="0.01" min="0" value={addForm.whtAmount} onChange={e => setAddForm(f => ({ ...f, whtAmount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 text-sm border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-900/10 focus:border-amber-300 transition-shadow" />
                <p className="text-[10px] text-amber-600 font-medium mt-1">Posted to WHT Receivable GL account.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Payment Method</label>
                  <select value={addForm.paymentMethod} onChange={e => setAddForm(f => ({ ...f, paymentMethod: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow">
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{METHOD_META[m]?.label || m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Reference</label>
                  <input value={addForm.reference} onChange={e => setAddForm(f => ({ ...f, reference: e.target.value }))}
                    placeholder="TXN-xxxxx"
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Deposit Into (Bank Account / GL)</label>
                <AccountSearchSelect
                  accounts={[...(bankAccounts||[]).map((ba:any) => ({ id: ba.accountId, name: `${ba.bankName} — ${ba.name}`, code: 'Bank' })), ...assetAccounts]}
                  value={addForm.accountId}
                  onChange={id => setAddForm(f => ({ ...f, accountId: id }))}
                  placeholder="Select account..."
                />
              </div>

              {addForm.category === 'other_income' && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Income Account (Revenue GL)</label>
                  <AccountSearchSelect
                    accounts={revenueAccounts}
                    value={addForm.incomeAccountId}
                    onChange={id => setAddForm(f => ({ ...f, incomeAccountId: id }))}
                    placeholder="Select income account..."
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                <textarea value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setAddOpen(false); setAddError(null); }}
                  className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-all duration-200">Cancel</button>
                <button type="submit" disabled={createMutation.isPending}
                  className="px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 rounded-xl shadow-sm disabled:opacity-50 transition-all duration-200">
                  {createMutation.isPending ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Modal ───────────────────────────────────────────────────────── */}
      {editTarget && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Edit Payment — {editTarget.paymentNumber}</h2>
              <button onClick={() => setEditTarget(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"><X size={18} /></button>
            </div>
            <form onSubmit={handleEditSubmit} className="px-5 py-4 space-y-3">
              {editError && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">{editError}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
                  <input type="date" value={editForm.date || ''} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Reference</label>
                  <input value={editForm.reference || ''} onChange={e => setEditForm(f => ({ ...f, reference: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                </div>
              </div>
              {editTarget.category === 'other_income' && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Payer Name</label>
                  <input value={editForm.payerName || ''} onChange={e => setEditForm(f => ({ ...f, payerName: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Bank Account</label>
                <AccountSearchSelect
                  accounts={assetAccounts}
                  value={editForm.accountId || ''}
                  onChange={id => setEditForm(f => ({ ...f, accountId: id }))}
                  placeholder="Select account..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                <textarea value={editForm.notes || ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
              </div>
              <p className="text-xs text-slate-400">Note: Amount and allocation cannot be edited after recording. Reverse and re-record if needed.</p>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditTarget(null)}
                  className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-all duration-200">Cancel</button>
                <button type="submit" disabled={updateMutation.isPending}
                  className="px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 rounded-xl shadow-sm disabled:opacity-50 transition-all duration-200">
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ──────────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <h2 className="text-base font-bold text-slate-900 mb-2">Reverse Payment</h2>
            <p className="text-sm text-slate-500 mb-4">
              Reverse <span className="font-medium text-slate-700">{deleteTarget.paymentNumber}</span> ({formatNaira(deleteTarget.amount)})?
              This will restore any invoice balance due and reverse the journal entries.
            </p>
            {deleteError && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2 mb-3">{deleteError}</div>}
            <div className="flex justify-end gap-2">
              <button onClick={() => { setDeleteTarget(null); setDeleteError(null); }}
                className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-all duration-200">Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending}
                className="px-4 py-2.5 text-sm font-medium text-white bg-rose-600 rounded-xl hover:bg-rose-700 disabled:opacity-50 transition-all duration-200">
                {deleteMutation.isPending ? 'Reversing...' : 'Reverse Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CSV Import Modal ──────────────────────────────────────────────── */}
      {importOpen && (
        <CsvImportModal
          entity="paymentsReceived"
          endpoint="/sales/payments"
          onClose={() => setImportOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['sales', 'payments'] });
            queryClient.invalidateQueries({ queryKey: ['paymentsReceived'] });
          }}
          transformRow={(row, headers) => {
            const custIdx = headers.findIndex(h => h === 'customerCode (or name)' || h === 'customerId (or name)');
            const custName = row[custIdx]?.trim();
            const customer = (customers || []).find(c => c.id === custName || c.name === custName || c.customerCode === custName);
            const amountStr = row[headers.indexOf('amount (NGN)')]?.replace(/[,₦]/g, '').trim();
            const invNum = row[headers.indexOf('invoiceNumber')]?.trim() || row[headers.indexOf('invoice')]?.trim() || '';
            const matchedInvoice = invNum ? (invoicesList || []).find((inv: any) => (inv.invoiceNumber || '') === invNum || inv.id === invNum) : null;
            const amountKobo = Math.round((parseFloat(amountStr) || 0) * 100);
            const allocations = matchedInvoice ? [{ invoiceId: matchedInvoice.id, amount: amountKobo }] : [];
            const defaultAccountId = (bankAccounts || [])[0]?.accountId || (bankAccounts || [])[0]?.id || '';
            const rawCategory = (row[headers.indexOf('category')]?.trim() || '').toLowerCase();
            const category = rawCategory === 'sales_invoice' || rawCategory === 'invoice payment' || !!matchedInvoice ? 'sales_invoice' : 'other_income';
            return {
              category,
              customerId: customer?.id || custName || null,
              payerName: row[headers.indexOf('payerName')]?.trim() || null,
              date: row[headers.indexOf('date (YYYY-MM-DD)')] || undefined,
              amount: amountKobo,
              paymentMethod: row[headers.indexOf('paymentMethod')]?.trim() || 'bank_transfer',
              reference: row[headers.indexOf('reference')]?.trim() || null,
              accountId: defaultAccountId,
              notes: row[headers.indexOf('notes')]?.trim() || null,
              allocations,
            };
          }}
        />
      )}

      {/* ── Receipt Modal (sales_invoice only) ─────────────────────────────── */}
      <ReceiptModal
        paymentId={receiptPaymentId}
        onClose={() => setReceiptPaymentId(null)}
        customerMap={customerMap}
        org={org}
      />
    </>
  );
}

// ── Receipt Modal Component ───────────────────────────────────────────────────

function ReceiptModal({ paymentId, onClose, customerMap, org }: {
  paymentId: string | null;
  onClose: () => void;
  customerMap: Map<string, Customer>;
  org?: Org;
}) {
  const { data: payment, isLoading: paymentLoading } = useQuery<PaymentDetail>({
    queryKey: ['sales', 'payments', paymentId],
    queryFn: async () => { const r = await api.get(`/sales/payments/${paymentId}`); return r.data; },
    enabled: !!paymentId,
  });

  const invoiceIds = useMemo(
    () => Array.from(new Set((payment?.allocations || []).map(a => a.invoiceId))),
    [payment]
  );

  const invoiceQueries = useQueries({
    queries: invoiceIds.map(invId => ({
      queryKey: ['sales', 'invoices', invId],
      queryFn: async () => { const r = await api.get(`/sales/invoices/${invId}`); return r.data as InvoiceDetail; },
      enabled: !!invId,
    })),
  });

  const invoiceNumbers = useMemo(
    () => invoiceQueries.map(q => q.data?.invoiceNumber).filter(Boolean) as string[],
    [invoiceQueries]
  );

  if (!paymentId) return null;

  const cust = payment?.customerId ? customerMap.get(payment.customerId) : undefined;
  const meta = payment ? (METHOD_META[payment.paymentMethod] || { label: payment.paymentMethod, icon: Banknote }) : null;
  const isLoading = paymentLoading || invoiceQueries.some(q => q.isLoading);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] px-4 py-8">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 print:hidden">
          <h2 className="text-base font-semibold text-slate-900">Payment Receipt</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => {
              if (payment) {
                const cust = payment.customerId ? customerMap.get(payment.customerId) : undefined;
                const invs = invoiceQueries.map(q => q.data).filter(Boolean) as InvoiceDetail[];
                printReceipt(payment, org, cust, invs);
              }
            }} disabled={isLoading}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-slate-900 transition disabled:opacity-50">
              <Download size={14} />Download PDF
            </button>
            <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading || !payment ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 size={20} className="animate-spin mr-2" />Loading receipt...
            </div>
          ) : (
            <div id="receipt-pdf-container" className="bg-white">
              <div className="h-1.5 bg-gradient-to-r from-indigo-600 via-violet-500 to-indigo-400" />
              <div className="p-8 sm:p-10 space-y-8">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-8">
                  <div className="flex items-start gap-3">
                    {org?.logoUrl ? (
                      <img src={org.logoUrl} alt={org?.name || 'Logo'} className="w-14 h-14 rounded-xl object-contain border border-slate-100 bg-white p-1 shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-xl font-bold shrink-0">
                        {org?.name?.[0]?.toUpperCase() ?? 'S'}
                      </div>
                    )}
                    <div className="space-y-0.5">
                      <h2 className="text-sm font-bold text-slate-900 leading-tight">{org?.name || 'Your Company'}</h2>
                      {org?.address && <p className="text-[11px] text-slate-500">{org.address}</p>}
                      <div className="flex flex-wrap gap-x-3 mt-1">
                        {org?.phone && <span className="text-[11px] text-slate-500">{org.phone}</span>}
                        {org?.email && <span className="text-[11px] text-slate-500">{org.email}</span>}
                        {org?.website && <span className="text-[11px] text-indigo-500">{org.website}</span>}
                      </div>
                      {(org?.rcNumber || org?.vatNumber) && (
                        <div className="flex gap-3 mt-1">
                          {org?.rcNumber && <span className="text-[10px] text-slate-400">RC: {org.rcNumber}</span>}
                          {org?.vatNumber && <span className="text-[10px] text-slate-400">VAT: {org.vatNumber}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="sm:text-right shrink-0 space-y-1">
                    <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest">Payment Receipt</p>
                    <p className="text-2xl font-black text-slate-900 tracking-tight">{payment.paymentNumber}</p>
                    <span className="inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Received
                    </span>
                  </div>
                </div>

                {/* From / Details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 py-6 border-y border-slate-100">
                  <div className="sm:col-span-2 space-y-0.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Received From</p>
                    <p className="text-sm font-bold text-slate-900">{cust?.name || payment.payerName || '—'}</p>
                    {cust?.address && <p className="text-[11px] text-slate-500">{cust.address}</p>}
                    {cust?.city    && <p className="text-[11px] text-slate-500">{cust.city}{cust?.state ? `, ${cust.state}` : ''}</p>}
                    {cust?.country && <p className="text-[11px] text-slate-500">{cust.country}</p>}
                    <div className="flex flex-wrap gap-x-3 mt-1">
                      {cust?.phone && <span className="text-[11px] text-slate-500">{cust.phone}</span>}
                      {cust?.email && <span className="text-[11px] text-slate-500">{cust.email}</span>}
                    </div>
                  </div>
                  <div className="space-y-1.5 sm:text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Receipt Details</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex sm:justify-end gap-2">
                        <span className="text-slate-400 w-24 sm:w-auto">Date</span>
                        <span className="font-medium text-slate-700">{fmtDate(payment.date)}</span>
                      </div>
                      <div className="flex sm:justify-end gap-2">
                        <span className="text-slate-400 w-24 sm:w-auto">Method</span>
                        <span className="font-medium text-slate-700">{meta?.label}</span>
                      </div>
                      {payment.reference && (
                        <div className="flex sm:justify-end gap-2">
                          <span className="text-slate-400 w-24 sm:w-auto">Reference</span>
                          <span className="font-medium text-slate-700 font-mono">{payment.reference}</span>
                        </div>
                      )}
                      {invoiceNumbers.length > 0 && (
                        <div className="flex sm:justify-end gap-2">
                          <span className="text-slate-400 w-24 sm:w-auto">Invoice{invoiceNumbers.length > 1 ? 's' : ''}</span>
                          <span className="font-medium text-slate-700 font-mono">{invoiceNumbers.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Amount */}
                <div className="space-y-2 bg-slate-50 rounded-xl border border-slate-100 p-5">
                  {(payment.whtAmount || 0) > 0 ? (
                    <>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-500">Invoice Amount</span>
                        <span className="font-mono font-semibold text-slate-700">{formatNaira(payment.totalAllocated || payment.amount)}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-500">Less: WHT Withheld by Customer</span>
                        <span className="font-mono font-medium text-amber-600">− {formatNaira(payment.whtAmount!)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Net Amount Received</p>
                        <p className="text-xl font-black text-emerald-700 font-mono tracking-tight">{formatNaira(payment.amount)}</p>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Amount Received</p>
                      <p className="text-3xl font-black text-emerald-700 font-mono tracking-tight">{fmtDual(payment.amount, payment.currency, payment.fxRate)}</p>
                    </div>
                  )}
                  <p className="text-[11px] text-slate-400 text-center mt-1">{payment.currency}{payment.currency !== 'NGN' && payment.fxRate ? ` \u00b7 Rate: ${Number(payment.fxRate).toFixed(4)}` : ''}</p>
                </div>

                {payment.notes && (
                  <div className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-100 pt-4">
                    <p className="font-bold text-slate-400 uppercase tracking-widest text-[10px] mb-1">Notes</p>
                    {payment.notes}
                  </div>
                )}

                <div className="text-center text-[10px] text-slate-400 pt-4 border-t border-slate-100">
                  {org?.name} · This receipt was generated electronically and confirms the payment recorded above.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
