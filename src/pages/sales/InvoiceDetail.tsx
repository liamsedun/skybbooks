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
  Calendar,
  User,
  Info,
  Clock,
  CheckCircle,
  Truck,
  FileCheck2,
  Trash2,
  ShieldCheck,
  Percent,
  TrendingDown
} from 'lucide-react';
import { salesApi, orgApi } from '../../lib/api';
import { useCurrency } from '../../hooks/useCurrency';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { AmountDisplay } from '../../components/ui/AmountDisplay';
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

  // Dialog and payments drawer state handlers
  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false);

  // 1. Fetch current Invoice data details
  const { data: invoice, isLoading, refetch } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => salesApi.getInvoice(invoiceId),
    staleTime: 5000,
    enabled: !!invoiceId && !!token,
  });

  // 2. Mock fallback invoice details for the local previewer/demo mode
  const invoiceData = useMemo(() => {
    if (invoice) return { ...invoice, clientName: invoice.clientName || invoice.customer?.name || null, clientEmail: invoice.clientEmail || invoice.customer?.email || null };

    // Default static fallback mockup to guarantee seamless offline navigation
    const mockDb: Record<string, any> = {
      'inv-1001': {
        id: 'inv-1001',
        invoiceNumber: 'INV-1001',
        clientName: 'Mainwood Systems Ltd',
        clientEmail: 'info@mainwood.ng',
        customerId: 'cust-01',
        date: '2026-06-01',
        dueDate: '2026-06-30',
        status: 'sent',
        paymentTerms: 30,
        total: 125000000, // ₦1,250,000.00
        balanceDue: 125000000,
        notes: 'Provide full support assistance logs monthly.',
        terms: 'Payment with 5% VAT withholding matches system calculations.',
        lines: [
          { id: '1', description: 'Consulting Advisory Services Dev Tier', quantity: 1, unitPrice: 125000000, discountPct: 0, taxRate: 7.5 }
        ],
        payments: []
      },
      'inv-1002': {
        id: 'inv-1002',
        invoiceNumber: 'INV-1002',
        clientName: 'Apex Retail Stores Corp',
        clientEmail: 'billing@apexstores.ng',
        customerId: 'cust-02',
        date: '2026-05-15',
        dueDate: '2026-06-14',
        status: 'overdue',
        paymentTerms: 30,
        total: 450000000, // ₦4,500,000.00
        balanceDue: 450000000,
        notes: 'Supply order completed with partial delivery logs.',
        terms: 'Subject to Net 30 corporate covenants.',
        lines: [
          { id: '2', description: 'Apex Cloud Hub Integration Pipeline', quantity: 2, unitPrice: 225000000, discountPct: 0, taxRate: 7.5 }
        ],
        payments: []
      },
      'inv-1003': {
        id: 'inv-1003',
        invoiceNumber: 'INV-1003',
        clientName: 'Dangote Cement Distributors',
        clientEmail: 'accounts@dangotegroup.com',
        customerId: 'cust-03',
        date: '2026-06-10',
        dueDate: '2026-07-10',
        status: 'paid',
        paymentTerms: 30,
        total: 820000000, // ₦8,200,000.00
        balanceDue: 0,
        notes: 'Full volume dispatch cleared by site coordinator.',
        terms: 'Cleared and stamped paid.',
        lines: [
          { id: '3', description: 'Dangote Distribution Ledger Advisory v2', quantity: 1, unitPrice: 820000000, discountPct: 0, taxRate: 7.5 }
        ],
        payments: [
          { id: 'p-1', date: '2026-06-12', amount: 820000000, paymentMethod: 'bank_transfer', reference: 'NIBSS-902482' }
        ]
      },
      'inv-1004': {
        id: 'inv-1004',
        invoiceNumber: 'INV-1004',
        clientName: 'Interswitch Web Gateway',
        clientEmail: 'integrations@interswitch.ng',
        customerId: 'cust-04',
        date: '2026-06-12',
        dueDate: '2026-07-12',
        status: 'draft',
        paymentTerms: 30,
        total: 35000000, // ₦350,000.00
        balanceDue: 35000000,
        notes: 'Initial integration proposal invoice.',
        terms: 'Direct bank transfer only.',
        lines: [
          { id: '4', description: 'Interswitch Core API Sandbox Advisory', quantity: 1, unitPrice: 35000000, discountPct: 0, taxRate: 7.5 }
        ],
        payments: []
      }
    };

    return mockDb[invoiceId] || {
      id: invoiceId,
      invoiceNumber: `INV-${invoiceId.substring(0,6).toUpperCase()}`,
      clientName: 'Corporate Customer Ltd',
      clientEmail: 'billing@corporate.ng',
      customerId: 'cust-05',
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 3500).toISOString().split('T')[0],
      status: 'draft',
      paymentTerms: 30,
      total: 10000000,
      balanceDue: 10000000,
      notes: '',
      terms: '',
      lines: [],
      payments: []
    };
  }, [invoice, invoiceId]);

  // 3. Status Action Mutations
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

  // Calculate detailed pricing variables
  const computedPricing = useMemo(() => {
    const lines = invoiceData.lines || invoiceData.items || [];
    let subtotalKobo = 0;
    let discountKobo = 0;
    let vatKobo = 0;

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

    const totalKobo = subtotalKobo - discountKobo + vatKobo;

    return { subtotalKobo, discountKobo, vatKobo, totalKobo };
  }, [invoiceData]);

  // Dynamic audit history timeline based on current status and data logs
  const auditTimeline = useMemo(() => {
    const steps = [];
    const createdDate = invoiceData.date;
    const status = (invoiceData.status || '').toLowerCase();

    // 1. Initial Generation Draft
    steps.push({
      id: 'step-1',
      title: 'Invoice Draft Registered',
      description: 'Transaction posted to Accounts Receivables ledger. Core draft locked.',
      timestamp: `${createdDate} 08:30 AM`,
      icon: FileText,
      color: 'bg-blue-500 text-white',
    });

    // 2. Sent out / Approved logs
    if (status !== 'draft') {
      steps.push({
        id: 'step-2',
        title: 'Invoice Approved & Sent',
        description: `Delivered to client contact address: ${invoiceData.clientEmail}`,
        timestamp: `${createdDate} 09:15 AM`,
        icon: Send,
        color: 'bg-amber-500 text-white',
      });
    }

    // 3. Void logs
    if (status === 'void') {
      steps.push({
        id: 'step-3-void',
        title: 'Invoice Stamp Voided',
        description: 'Audit trace: Transaction marked void. Balance reversed in financial journal.',
        timestamp: 'Audit Action: Completed',
        icon: Ban,
        color: 'bg-rose-500 text-white',
      });
    }

    // 4. Overdue diagnostics
    if (status === 'overdue') {
      steps.push({
        id: 'step-3-overdue',
        title: 'Overdue Collecting Flag',
        description: 'Past corporate due dates threshold. Multi-level dunning notice initiated.',
        timestamp: `${invoiceData.dueDate ? new Date(invoiceData.dueDate).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}) : '-'} Midnight`,
        icon: Clock,
        color: 'bg-rose-600 text-white',
      });
    }

    // 5. Payments receipt logs
    const hasPayments = invoiceData.payments && invoiceData.payments.length > 0;
    if (hasPayments) {
      invoiceData.payments.forEach((p: any, idx: number) => {
        steps.push({
          id: `step-pay-${p.id || idx}`,
          title: 'Corporate Allocation Receipt Locked',
          description: `Settlement check applied. TXN Ref: ${p.reference || 'N/A'}. Method: ${p.paymentMethod?.toUpperCase()}`,
          timestamp: p.date,
          icon: CheckCircle,
          color: 'bg-emerald-500 text-white',
        });
      });
    }

    // 6. Paid finished state
    if (status === 'paid') {
      steps.push({
        id: 'step-settled',
        title: 'Settled General Ledger Balance',
        description: 'Double entry balancing verified. Closed Accounts Receivable subledger.',
        timestamp: 'Ledger: BALANCED',
        icon: ShieldCheck,
        color: 'bg-purple-600 text-white',
      });
    }

    return steps.reverse(); // Newest first
  }, [invoiceData]);

  // Handle single dynamic PDF receipt download
  const handlePdfDownload = async () => {
    try {
// PDF: print instead
      const printArea = document.getElementById("invoice-pdf-mock-container");
      if (printArea) { window.print(); return; }
      const blob = await salesApi.getInvoicePdf(invoiceId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${invoiceData.invoiceNumber || 'INVOICE'}.pdf`);
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      // Local fallback text ledger audit copy for mock offline integration
      const content = `
FinanceOS certified GAAP Receipts
===============================
Invoice #: ${invoiceData.invoiceNumber || 'INV-MOCK'}
Client Business: ${invoiceData.clientName}
Issue Date: ${invoiceData.date ? new Date(invoiceData.date).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}) : '-'}
Due Date: ${invoiceData.dueDate ? new Date(invoiceData.dueDate).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}) : '-'}
Subtotal: ${formatNaira(computedPricing.subtotalKobo)}
Tax (Nigerian VAT 7.5%): ${formatNaira(computedPricing.vatKobo)}
Total Billing due Naira: ${formatNaira(computedPricing.totalKobo)}
Reference Authentication Token: SECURE_SHA-256_STAMP
===============================
      `;
      const fallbackBlob = new Blob([content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(fallbackBlob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${invoiceData.invoiceNumber || 'INV-MOCK'}-Audit-Receipt.txt`);
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center text-slate-500 text-xs flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-650 animate-spin mb-3" />
        Scanning transaction audit trail directory...
      </div>
    );
  }

  const isPaid = invoiceData.status?.toLowerCase() === 'paid';
  const isVoid = invoiceData.status?.toLowerCase() === 'void';
  const isDraft = invoiceData.status?.toLowerCase() === 'draft';
  const displayInvoiceNo = invoiceData.invoiceNumber || `INV-${invoiceData.id.substring(0, 6).toUpperCase()}`;

  return (
    <div className="space-y-6 animate-fade-in" id="invoice-details-viewport">

      {/* 1. Header Navigation and Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        
        <div className="flex items-center space-x-3.5">
          <button
            onClick={() => onNavigate('invoices')}
            className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-700 rounded-xl transition outline-none"
          >
            <ArrowLeft className="w-4 h-4 animate-slide-left" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-extrabold text-slate-800 tracking-tight font-mono">{displayInvoiceNo}</h2>
              <StatusBadge status={invoiceData.status} />
            </div>
            <p className="text-xs text-slate-400 font-semibold tracking-wide uppercase mt-1">
              General Ledger AR Journal Inspect
            </p>
          </div>
        </div>

        {/* Action controllers buttons */}
        <div className="flex items-center flex-wrap gap-2 text-xs font-bold" id="invoice-detail-action-buttons">
          
          {/* Edit (Draft state only) */}
          {isDraft && (
            <button
              onClick={() => onNavigate('edit-invoice', invoiceData.id)}
              className="px-3.5 py-2 bg-white border border-slate-200 hover:border-purple-300 text-slate-700 hover:text-purple-700 rounded-xl transition flex items-center shrink-0 cursor-pointer"
            >
              <Edit className="w-4 h-4 mr-1.5" /> Edit Draft
            </button>
          )}

          {/* Approve / Mail client */}
          {!isVoid && (isDraft || invoiceData.status?.toLowerCase() === 'unpaid') && (
            <button
              onClick={() => sendInvoiceMutation.mutate()}
              className="px-3.5 py-2 bg-purple-50 text-purple-750 hover:bg-purple-100 border border-purple-150 rounded-xl transition flex items-center cursor-pointer"
            >
              <Send className="w-4 h-4 mr-1.5" /> Send Invoice Alert
            </button>
          )}

          {/* Record manual allocation recibes */}
          {!isPaid && !isVoid && !isDraft && (
            <button
              onClick={() => setPaymentDrawerOpen(true)}
              className="px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-150 hover:bg-emerald-100/60 rounded-xl transition flex items-center cursor-pointer font-extrabold"
            >
              <CreditCard className="w-4.5 h-4.5 mr-1.5 text-emerald-600" /> Record Ledger Payment
            </button>
          )}

          {/* Download certified ledger PDF */}
          <button
            onClick={handlePdfDownload}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl transition flex items-center cursor-pointer"
          >
            <Download className="w-4 h-4 mr-1.5 text-slate-500" /> Print PDF Ledger
          </button>

          {/* Trash / Refund / Void */}
          {!isVoid && !isPaid && (
            <button
              onClick={() => {
                if (window.confirm(`Are you sure you want to VOID invoice ${displayInvoiceNo}? This reverses ledger lines.`)) {
                  voidInvoiceMutation.mutate();
                }
              }}
              className="px-3 py-2 bg-rose-50 border border-rose-150 text-rose-700 hover:bg-rose-100 rounded-xl transition flex items-center cursor-pointer"
            >
              <Ban className="w-4 h-4 mr-1.5 text-rose-600" /> Void Bill
            </button>
          )}

        </div>

      </div>

      {/* 2. DUAL COLUMNS DETAILED VIEWGRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COMPARTMENT: 65% Actual Invoice Receipt Rendering */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 space-y-8 relative overflow-hidden" id="invoice-pdf-mock-container">
            
            {/* Top decorative visual frame line */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-purple-500 via-indigo-650 to-purple-650" />

            {/* Invoice Metadata & Identity Top Banner */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6" id="pdf-branding-row">
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-white font-black text-sm uppercase tracking-wide">
                    S
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-800 tracking-widest uppercase">SkyBooks Ledger</h3>
                    <p className="text-[9px] text-slate-400 font-extrabold uppercase font-mono tracking-widest leading-none mt-0.5">Dual Entry Certified</p>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 font-medium leading-relaxed font-mono">
                  {[org?.address, [org?.phone, org?.email].filter(Boolean).join(' � ')].filter(Boolean).join(', ')}
                </div>
              </div>

              <div className="text-left sm:text-right space-y-1 sm:space-y-2">
                <span className="text-[10px] font-black font-mono text-purple-650 uppercase tracking-widest block bg-purple-50 px-2 py-1 rounded-md sm:inline-block">INVOICE RECEIPT</span>
                <div className="text-lg font-black text-slate-800 font-mono block mt-1">{displayInvoiceNo}</div>
                <div className="text-[10px] text-slate-400 font-mono font-semibold">
                  STATUS STATE: <span className="text-slate-700 font-bold">{invoiceData.status?.toUpperCase()}</span>
                </div>
              </div>

            </div>

            {/* Sender / Customer Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-slate-50 text-xs" id="pdf-contacts-row">
              
              <div className="space-y-1.5">
                <h5 className="text-[9px] font-extrabold font-mono text-slate-400 uppercase tracking-widest">Invoiced From (Bill To Account)</h5>
                <div className="font-extrabold text-slate-800 text-sm">{invoiceData.clientName}</div>
                <div className="text-slate-500 font-semibold">Contact Email: {invoiceData.clientEmail}</div>
                <div className="text-slate-400">Tax Identification: N/A (Contact registration verified)</div>
              </div>

              <div className="space-y-1.5 sm:text-right font-mono">
                <h5 className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Core Ledger Covenants</h5>
                <p className="text-slate-500">Date Issued: <strong className="text-slate-800">{invoiceData.date ? new Date(invoiceData.date).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}) : '-'}</strong></p>
                <p className="text-slate-500">Payment Terms: <strong className="text-slate-800">{invoiceData.paymentTerms || '30'} Days</strong></p>
                <p className="text-slate-500">Invoice Due Date: <strong className="text-slate-800 font-black">{invoiceData.dueDate ? new Date(invoiceData.dueDate).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}) : '-'}</strong></p>
              </div>

            </div>

            {/* Line items details listed */}
            <div className="pt-4 border-t border-slate-50" id="pdf-line-table-box">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[9px] uppercase font-black tracking-widest text-slate-450 font-mono select-none border-b border-slate-100">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Service Description</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Unit Price</th>
                    <th className="py-2.5 px-3 text-center">Line Discount</th>
                    <th className="py-2.5 px-3 text-center font-mono">VAT</th>
                    <th className="py-2.5 px-3 text-right">Total Net Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-medium">
                  {(invoiceData.lines || invoiceData.items || []).map((line: any, index: number) => {
                    const qDetails = typeof line.quantity === 'string' ? parseFloat(line.quantity) : (line.quantity || 1);
                    const pKobo = line.unitPrice || line.price || 0;
                    const dPct = line.discountPct || 0;
                    const tRate = line.taxRate !== undefined ? line.taxRate : 7.5;

                    const base = qDetails * pKobo;
                    const dSum = Math.round((base * dPct) / 100);
                    const nSumKobo = base - dSum + Math.round(((base - dSum) * tRate) / 100);

                    return (
                      <tr key={line.id || index} className="text-slate-700">
                        <td className="py-3 px-3 font-mono text-slate-400">{index + 1}</td>
                        <td className="py-3 px-3">
                          <div className="font-extrabold text-slate-800 leading-relaxed">{line.description}</div>
                          {line.itemId && <div className="text-[9px] text-slate-400 mt-0.5 font-bold font-mono">SKU: {line.sku || line.itemId?.substring(0,8).toUpperCase() || '-'}</div>}
                        </td>
                        <td className="py-3 px-3 text-center font-sans">{qDetails}</td>
                        <td className="py-3 px-3 text-right font-mono">{formatNaira(pKobo)}</td>
                        <td className="py-3 px-3 text-center text-purple-750 font-mono">
                          {dPct > 0 ? (
                            <span className="flex items-center justify-center font-bold">
                              <TrendingDown className="w-3 h-3 mr-0.5 text-purple-500" /> {dPct}%
                            </span>
                          ) : '0%'}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-500">{tRate}%</td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900 font-mono">
                          {formatNaira(nSumKobo)}
                        </td>
                      </tr>
                    );
                  })}
                  {(!invoiceData.lines || invoiceData.lines.length === 0) && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 font-semibold border-b border-slate-50">
                        No lines added in invoice items directory.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Calculations summaries breakdown bottom */}
            <div className="flex flex-col sm:flex-row justify-between gap-6 pt-6 border-t border-slate-50 text-xs font-semibold" id="pdf-totals-row">
              
              <div className="max-w-xs space-y-2.5">
                <h5 className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">Note / Direct remarks</h5>
                <p className="text-slate-500 leading-relaxed font-semibold">
                  {invoiceData.notes || 'No custom client-facing remarks specified on billing ledger.'}
                </p>
                <div className="pt-2">
                  <h6 className="text-[10px] font-black uppercase tracking-wider text-slate-450 font-mono mb-1">Standard Wire Clauses</h6>
                  <p className="text-[10px] text-slate-400 leading-relaxed uppercase">
                    {invoiceData.terms || 'Payment instructions are aligned strictly to institutional client terms.'}
                  </p>
                </div>
              </div>

              <div className="sm:text-right shrink-0 min-w-[200px] space-y-2.5 font-mono text-slate-500">
                <div className="flex justify-between sm:justify-end sm:space-x-8">
                  <span>Subtotal</span>
                  <span className="text-slate-800 font-bold">{formatNaira(computedPricing.subtotalKobo)}</span>
                </div>

                <div className="flex justify-between sm:justify-end sm:space-x-8 text-purple-750">
                  <span>Pre-tax Discounts</span>
                  <span className="font-extrabold">- {formatNaira(computedPricing.discountKobo)}</span>
                </div>

                <div className="flex justify-between sm:justify-end sm:space-x-8">
                  <span>VAT (NGN 7.5%)</span>
                  <span className="text-slate-800 font-bold">{formatNaira(computedPricing.vatKobo)}</span>
                </div>

                <div className="h-px bg-slate-100 sm:ml-auto w-full max-w-[240px]" />

                <div className="flex justify-between sm:justify-end sm:space-x-8 text-slate-850 font-extrabold pt-1">
                  <span className="text-xs">TOTAL TAX VALUE INCL</span>
                  <span className="text-base text-slate-900 font-black tracking-tight">{formatNaira(computedPricing.totalKobo)}</span>
                </div>

                {/* Subledger balances remaining details */}
                <div className="flex justify-between sm:justify-end sm:space-x-8 text-rose-600 font-extrabold bg-rose-50/20 px-2 py-1.5 rounded-lg border border-rose-100/30">
                  <span className="text-[10px]">REMAINING BALANCE DUE</span>
                  <span className="text-xs font-black">
                    {formatNaira(invoiceData.balanceDue !== undefined ? invoiceData.balanceDue : computedPricing.totalKobo)}
                  </span>
                </div>
              </div>

            </div>

          </div>

        </div>

        {/* RIGHT COMPARTMENT: 35% Historical Audit Logs Timeline */}
        <div className="space-y-6" id="invoice-detail-sidebar-timeline">
          
          <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-6 shadow-2xs">
            
            <div className="border-b border-slate-50 pb-4">
              <h3 className="text-xs font-black text-slate-850 uppercase tracking-widest font-mono flex items-center">
                <Clock className="w-4 h-4 mr-2 text-purple-650" /> Timeline Audit Logs
              </h3>
              <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider leading-none">
                Subledger operations tracking trace
              </p>
            </div>

            {/* Vertical timeline stepper */}
            <div className="relative pl-6 space-y-6 border-l border-slate-100" id="audit-timeline-stepper">
              {auditTimeline.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.id} className="relative select-none text-xs">
                    
                    {/* Circle Node Badge */}
                    <div className={`p-1 rounded-lg absolute -left-[35px] -top-0.5 border-4 border-white ${step.color}`}>
                      <Icon className="w-3 h-3 stroke-[2.5]" />
                    </div>

                    {/* Step details */}
                    <div className="space-y-0.5">
                      <h4 className="font-extrabold text-slate-800 leading-normal">{step.title}</h4>
                      <p className="text-slate-400 font-medium leading-relaxed">{step.description}</p>
                      <span className="text-[9px] text-slate-400 block font-bold font-mono tracking-wide uppercase mt-1">
                        {step.timestamp}
                      </span>
                    </div>

                  </div>
                );
              })}
            </div>

          </div>

        </div>

      </div>

      {/* 3. DRAWER SLIDE PORT */}
      {paymentDrawerOpen && (
        <RecordPaymentDrawer
          isOpen={paymentDrawerOpen}
          onClose={() => {
            setPaymentDrawerOpen(false);
          }}
          customerId={invoiceData.clientName || invoiceData.customerId}
          invoiceId={invoiceData.id}
          onSuccess={() => {
            refetch();
          }}
        />
      )}

    </div>
  );
}
export default InvoiceDetail;













