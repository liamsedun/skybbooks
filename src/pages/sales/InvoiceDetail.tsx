// fixed
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Edit,
  Send,
  CreditCard,
  Ban,
  Download,
  ArrowLeft,
  Loader2,
  Clock,
  CheckCircle,
  ShieldCheck,
  TrendingDown
} from 'lucide-react';
import { salesApi, orgApi } from '../../lib/api';
import { useCurrency } from '../../hooks/useCurrency';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { RecordPaymentDrawer } from '../../components/sales/RecordPaymentDrawer';
import { useAuth } from '../../hooks/useAuth';

interface InvoiceDetailProps {
  invoiceId: string;
  onNavigate: (viewId: string, id?: string) => void;
}

export function InvoiceDetail({ invoiceId, onNavigate }: InvoiceDetailProps) {
  const queryClient = useQueryClient();
  const { formatNaira } = useCurrency();
  const { token } = useAuth();
  const { data: org } = useQuery({ queryKey: ['org'], queryFn: orgApi.getOrg, staleTime: 60000, enabled: !!token });

  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false);

  const { data: invoice, isLoading, refetch } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => salesApi.getInvoice(invoiceId),
    staleTime: 5000,
    enabled: !!invoiceId && !!token,
  });


  // Fetch full customer for Bill To
  const customerId = (invoice as any)?.customerId;
  const { data: customer } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => salesApi.getCustomer(customerId),
    enabled: !!customerId && !!token,
    staleTime: 60000,
  });

  const invoiceData = useMemo(() => {
    if (invoice) return {
      ...invoice,
      clientName: invoice.customer?.name || invoice.clientName || null,
      clientEmail: invoice.customer?.email || invoice.clientEmail || null,
      lines: invoice.lines || invoice.items || [],
      payments: (invoice.paymentHistory?.rows || invoice.paymentHistory || invoice.payments || []),
    };
  }, [invoice, invoiceId]);

  const sendInvoiceMutation = useMutation({
    mutationFn: () => salesApi.sendInvoice(invoiceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      refetch();
    },
  });

  const voidInvoiceMutation = useMutation({
    mutationFn: () => salesApi.voidInvoice(invoiceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      refetch();
    },
  });

  const computedPricing = useMemo(() => {
    const lines = invoiceData.lines || invoiceData.items || [];
    let subtotalKobo = 0, discountKobo = 0, vatKobo = 0;
    lines.forEach((line: any) => {
      const q = typeof line.quantity === 'string' ? parseFloat(line.quantity) : (line.quantity || 1);
      const pr = line.unitPrice || line.price || 0;
      const d = line.discountPct || 0;
      const t = line.taxRate !== undefined ? line.taxRate : 7.5;
      const base = q * pr;
      const disc = Math.round((base * d) / 100);
      const afterDisc = base - disc;
      const vt = Math.round((afterDisc * t) / 100);
      subtotalKobo += base;
      discountKobo += disc;
      vatKobo += vt;
    });
    return { subtotalKobo, discountKobo, vatKobo, totalKobo: subtotalKobo - discountKobo + vatKobo };
  }, [invoiceData]);

  const auditTimeline = useMemo(() => {
    const steps = [];
    const status = (invoiceData.status || '').toLowerCase();
    const fmt = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

    steps.push({
      id: 'step-1', title: 'Invoice Created',
      description: 'Invoice draft saved and added to accounts receivable.',
      timestamp: fmt(invoiceData.date),
      icon: FileText, color: 'bg-blue-500 text-white',
    });

    if (status !== 'draft') {
      steps.push({
        id: 'step-2', title: 'Invoice Sent',
        description: `Sent to ${invoiceData.clientEmail}`,
        timestamp: fmt(invoiceData.date),
        icon: Send, color: 'bg-amber-500 text-white',
      });
    }

    if (status === 'void') {
      steps.push({
        id: 'step-void', title: 'Invoice Voided',
        description: 'Invoice marked as void. Balance reversed.',
        timestamp: 'Voided',
        icon: Ban, color: 'bg-rose-500 text-white',
      });
    }

    if (status === 'overdue') {
      steps.push({
        id: 'step-overdue', title: 'Payment Overdue',
        description: 'Past the due date. Payment reminder sent.',
        timestamp: `Due ${fmt(invoiceData.dueDate)}`,
        icon: Clock, color: 'bg-orange-500 text-white',
      });
    }

    if (invoiceData.payments?.length > 0) {
      invoiceData.payments.forEach((p: any, idx: number) => {
        steps.push({
          id: `step-pay-${idx}`, title: 'Payment Received',
          description: `${formatNaira(p.amount)} via ${p.paymentMethod?.replace('_', ' ')}${p.reference ? ` · Ref: ${p.reference}` : ''}`,
          timestamp: fmt(p.date),
          icon: CheckCircle, color: 'bg-emerald-500 text-white',
        });
      });
    }

    if (status === 'paid') {
      steps.push({
        id: 'step-settled', title: 'Invoice Paid',
        description: 'Payment received in full. Invoice closed.',
        timestamp: 'Settled',
        icon: ShieldCheck, color: 'bg-purple-600 text-white',
      });
    }

    return steps.reverse();
  }, [invoiceData, formatNaira]);

  const handlePdfDownload = async () => {
    try {
      const printArea = document.getElementById('invoice-pdf-mock-container');
      if (printArea) { window.print(); return; }
      const blob = await salesApi.getInvoicePdf(invoiceId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${invoiceData.invoiceNumber || 'INVOICE'}.pdf`);
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      const content = `Invoice #${invoiceData.invoiceNumber}\nClient: ${invoiceData.clientName}\nTotal: ${formatNaira(computedPricing.totalKobo)}`;
      const blob = new Blob([content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${invoiceData.invoiceNumber}.txt`);
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 animate-spin" />
        <span className="text-sm">Loading invoice…</span>
      </div>
    );
  }


  if (!invoiceData) {
    return (
      <div className="py-24 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 animate-spin" />
        <span className="text-sm">Loading invoice...</span>
      </div>
    );
  }

  const isPaid = invoiceData.status?.toLowerCase() === 'paid';
  const isVoid = invoiceData.status?.toLowerCase() === 'void';
  const isDraft = invoiceData.status?.toLowerCase() === 'draft';
  const displayInvoiceNo = invoiceData.invoiceNumber || `INV-${invoiceData.id.substring(0, 6).toUpperCase()}`;
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="space-y-6" id="invoice-details-viewport">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('invoices')}
            className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-800">{displayInvoiceNo}</h2>
              <StatusBadge status={invoiceData.status} />
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {invoiceData.clientName} · Due {fmtDate(invoiceData.dueDate)}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center flex-wrap gap-2">
          {isDraft && (
            <button
              onClick={() => onNavigate('edit-invoice', invoiceData.id)}
              className="px-3.5 py-2 text-sm bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg transition flex items-center gap-1.5"
            >
              <Edit className="w-3.5 h-3.5" /> Edit
            </button>
          )}
          {!isVoid && (isDraft || invoiceData.status?.toLowerCase() === 'unpaid') && (
            <button
              onClick={() => sendInvoiceMutation.mutate()}
              className="px-3.5 py-2 text-sm bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" /> Send Invoice
            </button>
          )}
          {!isPaid && !isVoid && !isDraft && (
            <button
              onClick={() => setPaymentDrawerOpen(true)}
              className="px-3.5 py-2 text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-lg transition flex items-center gap-1.5 font-medium"
            >
              <CreditCard className="w-3.5 h-3.5" /> Record Payment
            </button>
          )}
          <button
            onClick={handlePdfDownload}
            className="px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg transition flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Download PDF
          </button>
          {!isVoid && !isPaid && (
            <button
              onClick={() => {
                if (window.confirm(`Void invoice ${displayInvoiceNo}? This cannot be undone.`)) {
                  voidInvoiceMutation.mutate();
                }
              }}
              className="px-3.5 py-2 text-sm bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg transition flex items-center gap-1.5"
            >
              <Ban className="w-3.5 h-3.5" /> Void
            </button>
          )}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Invoice document */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative" id="invoice-pdf-mock-container">

            {/* PAID watermark */}
            {isPaid && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 rotate-[-30deg] opacity-[0.07]">
                <span className="text-emerald-600 text-[110px] font-black border-[10px] border-emerald-600 rounded-3xl px-10 leading-none select-none tracking-widest">PAID</span>
              </div>
            )}

            {/* Top colour bar */}
            <div className="h-1.5 bg-gradient-to-r from-indigo-600 via-violet-500 to-indigo-400" />

            <div className="p-8 sm:p-10 space-y-8">

              {/* Header: logo/company left, invoice meta right */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-8">

                {/* Company identity */}
                <div className="flex flex-col items-start gap-2">
                  {/* Logo above company name */}
                  {org?.logoUrl ? (
                    <img src={org.logoUrl} alt={org?.name || 'Logo'} className="w-14 h-14 rounded-xl object-contain border border-slate-100 bg-white p-1" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-xl font-bold">
                      {org?.name?.[0]?.toUpperCase() ?? 'S'}
                    </div>
                  )}
                  <div className="space-y-0.5">
                    <h2 className="text-sm font-bold text-slate-900 leading-tight tracking-tight">{org?.name || 'Your Company'}</h2>
                    <div className="flex flex-col gap-y-0 mt-0.5">
                      {org?.address && (
                        <span className="text-[11px] text-slate-500 leading-snug">{org.address}</span>
                      )}
                      {(org as any)?.city && (
                        <span className="text-[11px] text-slate-500 leading-snug">{(org as any).city}</span>
                      )}
                      {(org as any)?.state && (
                        <span className="text-[11px] text-slate-500 leading-snug">{(org as any).state}</span>
                      )}
                      {(org as any)?.country && (
                        <span className="text-[11px] text-slate-500 leading-snug">{(org as any).country}</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-y-0 mt-1">
                      {org?.phone && (
                        <span className="text-[11px] text-slate-500">{org.phone}</span>
                      )}
                      {org?.email && (
                        <span className="text-[11px] text-slate-500">{org.email}</span>
                      )}
                      {(org as any)?.website && (
                        <span className="text-[11px] text-slate-500">{(org as any).website}</span>
                      )}
                    </div>
                  </div>
                </div>
                {/* Invoice badge */}
                <div className="sm:text-right shrink-0 space-y-1">
                  <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest">Invoice</p>
                  <p className="text-2xl font-black text-slate-900 tracking-tight">{displayInvoiceNo}</p>
                  <span className={`inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-semibold capitalize ${
                    invoiceData.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    invoiceData.status === 'overdue' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                    invoiceData.status === 'sent' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                    'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>{invoiceData.status}</span>
                </div>
              </div>

              {/* Bill To / Invoice Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 py-6 border-y border-slate-100">
                <div className="sm:col-span-2 space-y-0.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Billed To</p>
                  <p className="text-sm font-bold text-slate-900 leading-tight">{invoiceData.clientName}</p>
                  <div className="flex flex-col gap-y-0 mt-0.5">
                    {customer?.address && (<span className="text-[11px] text-slate-500 leading-snug">{customer.address}</span>)}
                    {customer?.city && (<span className="text-[11px] text-slate-500 leading-snug">{customer.city}</span>)}
                    {customer?.state && (<span className="text-[11px] text-slate-500 leading-snug">{customer.state}</span>)}
                    {customer?.country && (<span className="text-[11px] text-slate-500 leading-snug">{customer.country}</span>)}
                  </div>
                  <div className="flex flex-col gap-y-0 mt-1">
                    {customer?.phone && (<span className="text-[11px] text-slate-500">{customer.phone}</span>)}
                    {(customer?.email || invoiceData.clientEmail) && (<span className="text-[11px] text-slate-500">{customer?.email || invoiceData.clientEmail}</span>)}
                    {(customer as any)?.website && (<span className="text-[11px] text-slate-500">{(customer as any).website}</span>)}
                  </div>
                </div>
                <div className="space-y-2 sm:text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Invoice Details</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex sm:justify-end gap-2">
                      <span className="text-slate-400 w-24 sm:w-auto">Issued</span>
                      <span className="font-medium text-slate-700">{fmtDate(invoiceData.date)}</span>
                    </div>
                    <div className="flex sm:justify-end gap-2">
                      <span className="text-slate-400 w-24 sm:w-auto">Due</span>
                      <span className="font-medium text-slate-700">{fmtDate(invoiceData.dueDate)}</span>
                    </div>
                    <div className="flex sm:justify-end gap-2">
                      <span className="text-slate-400 w-24 sm:w-auto">Terms</span>
                      <span className="font-medium text-slate-700">Net {invoiceData.paymentTerms || 30}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 rounded-lg">
                      <th className="text-left py-3 pl-3 pr-2 text-xs font-semibold text-slate-500 uppercase tracking-wide rounded-l-lg w-8">#</th>
                      <th className="text-left py-3 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</th>
                      <th className="text-center py-3 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wide w-14">Qty</th>
                      <th className="text-right py-3 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wide w-32">Unit Price</th>
                      <th className="text-center py-3 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wide w-16">Disc.</th>
                      <th className="text-center py-3 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wide w-14">VAT</th>
                      <th className="text-right py-3 pl-2 pr-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-32 rounded-r-lg">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invoiceData.lines || invoiceData.items || []).map((line: any, index: number) => {
                      const q = typeof line.quantity === 'string' ? parseFloat(line.quantity) : (line.quantity || 1);
                      const pr = line.unitPrice || line.price || 0;
                      const d = line.discountPct || 0;
                      const t = line.taxRate !== undefined ? line.taxRate : 7.5;
                      const base = q * pr;
                      const disc = Math.round((base * d) / 100);
                      const net = base - disc + Math.round(((base - disc) * t) / 100);

                      return (
                        <tr key={line.id || index} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 pl-3 pr-2 text-slate-400 text-sm">{index + 1}</td>
                          <td className="py-4 px-2">
                            <p className="font-medium text-slate-800">{line.description}</p>
                            {line.itemId && (
                              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                                SKU: {line.sku || line.itemId?.substring(0, 8).toUpperCase()}
                              </p>
                            )}
                          </td>
                          <td className="py-4 px-2 text-center text-slate-600">{q}</td>
                          <td className="py-4 px-2 text-right text-slate-600 font-mono">{formatNaira(pr)}</td>
                          <td className="py-4 px-2 text-center">
                            {d > 0 ? (
                              <span className="inline-flex items-center gap-0.5 text-violet-600 font-medium text-xs">
                                <TrendingDown className="w-3 h-3" />{d}%
                              </span>
                            ) : <span className="text-slate-300">&mdash;</span>}
                          </td>
                          <td className="py-4 px-2 text-center text-slate-500 text-xs">{t > 0 ? `${t}%` : <span className="text-slate-300">&mdash;</span>}</td>
                          <td className="py-4 pl-2 pr-3 text-right font-semibold text-slate-900 font-mono">{formatNaira(net)}</td>
                        </tr>
                      );
                    })}
                    {(!invoiceData.lines || invoiceData.lines.length === 0) && (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-sm text-slate-400">
                          No line items on this invoice.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer: Notes left, Totals right */}
              <div className="flex flex-col sm:flex-row justify-between gap-8 pt-2">

                {/* Notes + Terms */}
                <div className="flex-1 max-w-sm space-y-4">
                  {invoiceData.notes && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Notes</p>
                      <p className="text-sm text-slate-500 leading-relaxed">{invoiceData.notes}</p>
                    </div>
                  )}
                  {invoiceData.terms && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Payment Terms</p>
                      <p className="text-sm text-slate-500 leading-relaxed">{invoiceData.terms}</p>
                    </div>
                  )}
                  {org?.vatNumber && (
                    <p className="text-xs text-slate-400">VAT Reg: {org.vatNumber}</p>
                  )}
                  {(org as any)?.rcNumber && (
                    <p className="text-xs text-slate-400">RC: {(org as any).rcNumber}</p>
                  )}
                </div>

                {/* Totals */}
                <div className="shrink-0 w-full sm:w-[300px] space-y-2">
                  <div className="flex justify-between text-sm text-slate-500 pb-2">
                    <span>Subtotal</span>
                    <span className="font-medium text-slate-700 font-mono">{formatNaira(computedPricing.subtotalKobo)}</span>
                  </div>
                  {computedPricing.discountKobo > 0 && (
                    <div className="flex justify-between text-sm text-violet-600 pb-2">
                      <span>Discount</span>
                      <span className="font-medium font-mono">&minus; {formatNaira(computedPricing.discountKobo)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm text-slate-500 pb-2">
                    <span>VAT (7.5%)</span>
                    <span className="font-medium text-slate-700 font-mono">{formatNaira(computedPricing.vatKobo)}</span>
                  </div>
                  <div className="flex justify-between py-3 border-t border-slate-200">
                    <span className="text-base font-bold text-slate-800">Total</span>
                    <span className="text-base font-black text-slate-900 font-mono">{formatNaira(computedPricing.totalKobo)}</span>
                  </div>
                  <div className={`flex justify-between items-center px-4 py-3 rounded-xl border ${
                    isPaid ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
                  }`}>
                    <span className={`text-sm font-bold ${isPaid ? 'text-emerald-700' : 'text-rose-700'}`}>Balance Due</span>
                    <span className={`text-lg font-black font-mono ${isPaid ? 'text-emerald-700' : 'text-rose-700'}`}>{formatNaira(invoiceData.balanceDue ?? 0)}</span>
                  </div>
                </div>

              </div>

              {/* Footer strip */}
              <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
                <span>{org?.name} &middot; Thank you for your business.</span>
                <span className="font-mono">{displayInvoiceNo}</span>
              </div>

            </div>
          </div>
        </div>

        {/* Timeline sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="border-b border-slate-100 pb-4 mb-5">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" /> Activity
              </h3>
            </div>

            <div className="relative pl-6 space-y-5 border-l border-slate-100">
              {auditTimeline.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.id} className="relative">
                    <div className={`p-1.5 rounded-lg absolute -left-[34px] top-0 border-2 border-white ${step.color}`}>
                      <Icon className="w-2.5 h-2.5" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-slate-800">{step.title}</p>
                      <p className="text-xs text-slate-500 leading-relaxed">{step.description}</p>
                      <p className="text-xs text-slate-400 mt-1">{step.timestamp}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {paymentDrawerOpen && (
        <RecordPaymentDrawer
          isOpen={paymentDrawerOpen}
          onClose={() => setPaymentDrawerOpen(false)}
          customerId={invoiceData.clientName || invoiceData.customerId}
          invoiceId={invoiceData.id}
          onSuccess={() => refetch()}
        />
      )}

    </div>
  );
}

export default InvoiceDetail;

