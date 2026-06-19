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

  const invoiceData = useMemo(() => {
    if (invoice) return {
      ...invoice,
      clientName: invoice.clientName || invoice.customer?.name || null,
      clientEmail: invoice.clientEmail || invoice.customer?.email || null
    };

    const mockDb: Record<string, any> = {
      'inv-1001': {
        id: 'inv-1001', invoiceNumber: 'INV-1001', clientName: 'Mainwood Systems Ltd',
        clientEmail: 'info@mainwood.ng', date: '2026-06-01', dueDate: '2026-06-30',
        status: 'sent', paymentTerms: 30, total: 125000000, balanceDue: 125000000,
        notes: 'Please include invoice number on payment reference.',
        terms: 'Payment due within 30 days of invoice date.',
        lines: [{ id: '1', description: 'Consulting Advisory Services', quantity: 1, unitPrice: 125000000, discountPct: 0, taxRate: 7.5 }],
        payments: []
      },
      'inv-1002': {
        id: 'inv-1002', invoiceNumber: 'INV-1002', clientName: 'Apex Retail Stores Corp',
        clientEmail: 'billing@apexstores.ng', date: '2026-05-15', dueDate: '2026-06-14',
        status: 'overdue', paymentTerms: 30, total: 450000000, balanceDue: 450000000,
        notes: '', terms: 'Net 30.',
        lines: [{ id: '2', description: 'Cloud Integration Services', quantity: 2, unitPrice: 225000000, discountPct: 0, taxRate: 7.5 }],
        payments: []
      },
      'inv-1003': {
        id: 'inv-1003', invoiceNumber: 'INV-1003', clientName: 'Dangote Cement Distributors',
        clientEmail: 'accounts@dangotegroup.com', date: '2026-06-10', dueDate: '2026-07-10',
        status: 'paid', paymentTerms: 30, total: 820000000, balanceDue: 0,
        notes: '', terms: 'Paid in full.',
        lines: [{ id: '3', description: 'Distribution Advisory Services', quantity: 1, unitPrice: 820000000, discountPct: 0, taxRate: 7.5 }],
        payments: [{ id: 'p-1', date: '2026-06-12', amount: 820000000, paymentMethod: 'bank_transfer', reference: 'NIBSS-902482' }]
      },
      'inv-1004': {
        id: 'inv-1004', invoiceNumber: 'INV-1004', clientName: 'Interswitch Web Gateway',
        clientEmail: 'integrations@interswitch.ng', date: '2026-06-12', dueDate: '2026-07-12',
        status: 'draft', paymentTerms: 30, total: 35000000, balanceDue: 35000000,
        notes: 'Initial integration proposal.', terms: 'Direct bank transfer only.',
        lines: [{ id: '4', description: 'API Sandbox Integration Services', quantity: 1, unitPrice: 35000000, discountPct: 0, taxRate: 7.5 }],
        payments: []
      }
    };

    return mockDb[invoiceId] || {
      id: invoiceId,
      invoiceNumber: `INV-${invoiceId.substring(0, 6).toUpperCase()}`,
      clientName: 'Customer', clientEmail: 'billing@customer.ng',
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 3600000).toISOString().split('T')[0],
      status: 'draft', paymentTerms: 30, total: 0, balanceDue: 0,
      notes: '', terms: '', lines: [], payments: []
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
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden relative" id="invoice-pdf-mock-container">

            {/* PAID watermark */}
            {isPaid && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 rotate-[-35deg] opacity-10">
                <span className="text-green-600 text-[120px] font-black border-[12px] border-green-600 rounded-2xl px-8 leading-none select-none">PAID</span>
              </div>
            )}

            {/* Top accent */}
            <div className="h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />

            <div className="p-8 space-y-7">

              {/* Branding row */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                      {org?.name?.[0] ?? 'S'}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">{org?.name || 'Your Company'}</h3>
                      {org?.address && <p className="text-xs text-slate-400 mt-0.5">{org.address}</p>}
                    </div>
                  </div>
                  {(org?.phone || org?.email) && (
                    <p className="text-xs text-slate-400">
                      {[org?.phone, org?.email].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-xs font-medium text-indigo-600 uppercase tracking-wide">Invoice</span>
                  <div className="text-xl font-bold text-slate-800 mt-1">{displayInvoiceNo}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    Status: <span className="font-medium text-slate-600 capitalize">{invoiceData.status}</span>
                  </div>
                </div>
              </div>

              {/* Bill to / Invoice details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-5 border-t border-slate-100">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Bill To</p>
                  <p className="text-sm font-semibold text-slate-800">{invoiceData.clientName}</p>
                  {invoiceData.clientEmail && (
                    <p className="text-sm text-slate-500">{invoiceData.clientEmail}</p>
                  )}
                </div>

                <div className="space-y-1.5 sm:text-right">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Details</p>
                  <div className="text-sm text-slate-500 space-y-1">
                    <p>Issue date: <span className="font-medium text-slate-700">{fmtDate(invoiceData.date)}</span></p>
                    <p>Due date: <span className="font-medium text-slate-700">{fmtDate(invoiceData.dueDate)}</span></p>
                    <p>Payment terms: <span className="font-medium text-slate-700">{invoiceData.paymentTerms || 30} days</span></p>
                  </div>
                </div>
              </div>

              {/* Line items */}
              <div className="border-t border-slate-100 pt-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide w-8">#</th>
                      <th className="text-left py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Description</th>
                      <th className="text-center py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide w-12">Qty</th>
                      <th className="text-right py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Unit Price</th>
                      <th className="text-center py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide w-16">Disc.</th>
                      <th className="text-center py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide w-14">VAT</th>
                      <th className="text-right py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(invoiceData.lines || invoiceData.items || []).map((line: any, index: number) => {
                      const q = typeof line.quantity === 'string' ? parseFloat(line.quantity) : (line.quantity || 1);
                      const pr = line.unitPrice || line.price || 0;
                      const d = line.discountPct || 0;
                      const t = line.taxRate !== undefined ? line.taxRate : 7.5;
                      const base = q * pr;
                      const disc = Math.round((base * d) / 100);
                      const net = base - disc + Math.round(((base - disc) * t) / 100);

                      return (
                        <tr key={line.id || index} className="text-slate-700">
                          <td className="py-3.5 text-slate-400 text-sm">{index + 1}</td>
                          <td className="py-3.5">
                            <p className="font-medium text-slate-800">{line.description}</p>
                            {line.itemId && (
                              <p className="text-xs text-slate-400 mt-0.5">
                                SKU: {line.sku || line.itemId?.substring(0, 8).toUpperCase()}
                              </p>
                            )}
                          </td>
                          <td className="py-3.5 text-center text-slate-600">{q}</td>
                          <td className="py-3.5 text-right text-slate-600">{formatNaira(pr)}</td>
                          <td className="py-3.5 text-center text-slate-500">
                            {d > 0 ? (
                              <span className="flex items-center justify-center gap-0.5 text-violet-600 font-medium">
                                <TrendingDown className="w-3 h-3" />{d}%
                              </span>
                            ) : '—'}
                          </td>
                          <td className="py-3.5 text-center text-slate-500">{t}%</td>
                          <td className="py-3.5 text-right font-semibold text-slate-800">{formatNaira(net)}</td>
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

              {/* Totals + Notes */}
              <div className="flex flex-col sm:flex-row justify-between gap-6 pt-5 border-t border-slate-100">

                {/* Notes */}
                <div className="max-w-xs space-y-3">
                  {invoiceData.notes && (
                    <div>
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Notes</p>
                      <p className="text-sm text-slate-500 leading-relaxed">{invoiceData.notes}</p>
                    </div>
                  )}
                  {invoiceData.terms && (
                    <div>
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Terms</p>
                      <p className="text-sm text-slate-500 leading-relaxed">{invoiceData.terms}</p>
                    </div>
                  )}
                </div>

                {/* Totals */}
                <div className="shrink-0 w-[280px] space-y-2">
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>Subtotal</span>
                    <span className="font-medium text-slate-700">{formatNaira(computedPricing.subtotalKobo)}</span>
                  </div>
                  {computedPricing.discountKobo > 0 && (
                    <div className="flex justify-between text-sm text-violet-600">
                      <span>Discount</span>
                      <span className="font-medium">− {formatNaira(computedPricing.discountKobo)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>VAT (7.5%)</span>
                    <span className="font-medium text-slate-700">{formatNaira(computedPricing.vatKobo)}</span>
                  </div>
                  <div className="border-t border-slate-100 pt-2.5 flex justify-between">
                    <span className="text-sm font-semibold text-slate-800">Total</span>
                    <span className="text-base font-bold text-slate-900">{formatNaira(computedPricing.totalKobo)}</span>
                  </div>
                  <div className={isPaid ? "flex w-full justify-between text-sm px-3 py-2 rounded-lg border bg-green-50 border-green-100" : "flex w-full justify-between text-sm px-3 py-2 rounded-lg border bg-rose-50 border-rose-100"}>
                    <span className={isPaid ? "font-medium text-green-700" : "font-medium text-rose-700"}>Balance Due</span>
                    <span className={isPaid ? "font-bold text-green-700" : "font-bold text-rose-700"}>{formatNaira(invoiceData.balanceDue ?? 0)}</span>
                  </div>
                </div>

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
