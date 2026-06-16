/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Printer, 
  Check, 
  Calculator,
  Search
} from 'lucide-react';
import { Invoice, InvoiceItem, Kobo } from '../types';

interface InvoicesTabProps {
  invoices: Invoice[];
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  onAddTransaction: (desc: string, amount: Kobo, type: 'debit' | 'credit', category: string) => void;
}

/**
 * InvoicesTab Component
 * Renders corporate billings, handles invoice creations, calculates Nigerian VAT (7.5%),
 * and stores all financial variables with integer kobo precision.
 */
export default function InvoicesTab({ invoices, setInvoices, onAddTransaction }: InvoicesTabProps) {
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  // New Invoice Form Fields - internally managed in kobo integers (rate/amount)
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [terms, setTerms] = useState('Net 30');
  
  // Default values represented as kobo (120,000.00 Naira)
  const [lineItems, setLineItems] = useState<InvoiceItem[]>([
    { id: '1', description: 'Consulting Advisory Services', quantity: 1, unitPrice: 12000000, amount: 12000000 }
  ]);

  /**
   * Safe line-item creation setup.
   */
  const addLineItem = () => {
    const newItem: InvoiceItem = {
      id: Math.random().toString(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      amount: 0
    };
    setLineItems(prev => [...prev, newItem]);
  };

  /**
   * Handles user float changes, transforming them dynamically into compliant integer kobo.
   */
  const updateLineItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item };
      
      if (field === 'description') {
        updated.description = value;
      } else if (field === 'quantity') {
        const qty = Math.max(1, parseInt(value) || 1);
        updated.quantity = qty;
        updated.amount = qty * item.unitPrice;
      } else if (field === 'unitPrice') {
        const parsedVal = parseFloat(value) || 0;
        const priceKobo = Math.round(parsedVal * 100);
        updated.unitPrice = priceKobo;
        updated.amount = item.quantity * priceKobo;
      }

      return updated;
    }));
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length === 1) return;
    setLineItems(prev => prev.filter(item => item.id !== id));
  };

  /**
   * Formats and posts invoices with precise total kobo.
   */
  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !clientEmail || !dueDate || lineItems.some(i => !i.description)) {
      alert("Please complete all invoice details and item descriptions.");
      return;
    }

    const calculatedTotal = lineItems.reduce((acc, curr) => acc + curr.amount, 0);
    const newInvoice: Invoice = {
      id: `INV-${Math.floor(100 + Math.random() * 900)}`,
      clientName,
      clientEmail,
      date: new Date().toISOString().split('T')[0],
      dueDate,
      status: 'Unpaid',
      items: lineItems,
      total: calculatedTotal,
      terms
    };

    setInvoices(prev => [newInvoice, ...prev]);
    
    // Reset Form
    setClientName('');
    setClientEmail('');
    setDueDate('');
    setLineItems([{ id: '1', description: 'Consulting Advisory Services', quantity: 1, unitPrice: 12000000, amount: 12000000 }]);
    setShowCreateModal(false);

    alert(`Successfully generated Invoice ${newInvoice.id} to ${newInvoice.clientName}!`);
  };

  /**
   * Posts standard revenue ledger entries when invoice collection triggers.
   */
  const markAsPaid = (invoiceId: string) => {
    let earnedAmountKobo: Kobo = 0;
    let targetClient = '';
    
    setInvoices(prev => prev.map(inv => {
      if (inv.id !== invoiceId) return inv;
      earnedAmountKobo = inv.total;
      targetClient = inv.clientName;
      return { ...inv, status: 'Paid' as const };
    }));

    if (earnedAmountKobo > 0) {
      onAddTransaction(
        `Invoice payment collected - ${targetClient} (#${invoiceId})`,
        earnedAmountKobo,
        'debit', // Cash Asset Influx (+)
        'Consulting Revenue'
      );
      
      if (viewingInvoice && viewingInvoice.id === invoiceId) {
        setViewingInvoice(prev => prev ? { ...prev, status: 'Paid' } : null);
      }
      
      alert(`Invoice ${invoiceId} logged as PAID. Consulting revenues posted to Ledger.`);
    }
  };

  const filteredInvoices = invoices.filter(inv => 
    inv.id.toLowerCase().includes(search.toLowerCase()) || 
    inv.clientName.toLowerCase().includes(search.toLowerCase()) ||
    inv.status.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in font-sans" id="invoices-tab-root">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4" id="invoices-header-row">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 font-sans">Corporate Billing & Client Invoices</h2>
          <p className="text-xs text-neutral-500 font-sans font-medium">Issue corporate invoices, track client accounts receivable, and evaluate VAT reports</p>
        </div>

        <div className="flex items-center gap-3 font-sans">
          <div className="relative w-full sm:w-64" id="invoice-search-wrapper">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <input 
              id="input-invoice-lookup"
              type="text"
              placeholder="Search invoices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 text-neutral-800 transition"
            />
          </div>

          <button 
            id="btn-trigger-create-invoice"
            onClick={() => setShowCreateModal(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            style={{ backgroundColor: '#7C3AED' }}
          >
            <Plus className="w-3.5 h-3.5" />
            Create Invoice
          </button>
        </div>
      </div>

      {/* INVOICES LIST TABLE */}
      <div className="bg-white border border-neutral-150 rounded-2xl overflow-hidden shadow-xs" id="invoices-table-card">
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left border-collapse" id="invoices-table">
            <thead className="sticky top-0 z-10 bg-surface-subtle shadow-[inset_0_-1px_0_rgba(15,23,42,0.06)]">
              <tr className="h-12 border-b border-neutral-150 text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-mono align-middle bg-surface-subtle">
                <th className="px-6 h-12 align-middle select-none bg-surface-subtle">Invoice Number</th>
                <th className="px-6 h-12 align-middle bg-surface-subtle">Billed Client</th>
                <th className="px-6 h-12 align-middle bg-surface-subtle">Bill Date</th>
                <th className="px-6 h-12 align-middle bg-surface-subtle">Due Date</th>
                <th className="px-6 h-12 align-middle font-mono bg-surface-subtle">Terms</th>
                <th className="px-6 h-12 align-middle bg-surface-subtle">Status</th>
                <th className="px-6 h-12 align-middle text-right font-mono bg-surface-subtle">Valuation Total</th>
                <th className="px-6 h-12 align-middle text-right bg-surface-subtle">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-[13px] font-sans text-neutral-700 font-medium animate-fade-in">
              {filteredInvoices.map(inv => (
                <tr key={inv.id} className="h-12 hover:bg-neutral-50/50 transition duration-150 align-middle group" id={`row-invoice-${inv.id}`}>
                  <td className="px-6 h-12 align-middle font-mono text-neutral-450 font-bold text-[13px]">{inv.id}</td>
                  
                  <td className="px-6 h-12 align-middle">
                    <div>
                      <div className="text-[13px] font-bold text-neutral-900 leading-tight">{inv.clientName}</div>
                      <div className="text-[10px] text-neutral-400 font-sans leading-none">{inv.clientEmail}</div>
                    </div>
                  </td>

                  <td className="px-6 h-12 align-middle font-mono text-neutral-500 text-[13px]">{inv.date}</td>
                  
                  <td className="px-6 h-12 align-middle font-mono text-neutral-500 text-[13px]">{inv.dueDate}</td>
                  
                  <td className="px-6 h-12 align-middle font-semibold text-neutral-500 text-[13px]">{inv.terms || 'Net 30'}</td>

                  <td className="px-6 h-12 align-middle">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition shrink-0 select-none ${
                      inv.status === 'Paid' 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-100 font-bold' 
                        : inv.status === 'Unpaid'
                          ? 'bg-amber-50 text-amber-800 border-amber-100 font-bold'
                          : 'bg-rose-50 text-rose-800 border-rose-100 font-bold'
                    }`}>
                      {inv.status === 'Paid' ? 'Paid' : inv.status === 'Unpaid' ? 'Unpaid' : 'Overdue'}
                    </span>
                  </td>

                  <td className="px-6 h-12 align-middle text-right font-mono font-bold text-neutral-900 tabular-nums text-[13px]">
                    ₦{(inv.total / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>

                  <td className="px-6 h-12 align-middle text-right">
                    <div className="flex gap-2 justify-end items-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <button 
                        id={`btn-view-invoice-${inv.id}`}
                        onClick={() => setViewingInvoice(inv)}
                        className="px-2.5 py-1.5 border border-neutral-150 hover:bg-neutral-50 text-neutral-600 rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                        title="View printable statement"
                      >
                        Print/View
                      </button>
                      
                      {inv.status !== 'Paid' && (
                        <button 
                          id={`btn-collect-invoice-${inv.id}`}
                          onClick={() => markAsPaid(inv.id)}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition shadow-2xs"
                          title="Record payout audit ledger"
                        >
                          Mark Paid
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-xs text-neutral-400 font-sans">
                    No corporate invoice files matching query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* INVOICE MODAL CREATOR */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-neutral-900/60 flex items-center justify-center z-50 p-4 transition-all" id="create-invoice-modal-backdrop animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-xl border border-neutral-100 max-h-[90vh] overflow-y-auto" id="create-invoice-box">
            
            <div className="border-b border-neutral-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-md font-bold text-neutral-950 font-sans">Assemble Corporate Invoice</h3>
                <p className="text-xs text-neutral-500">Formulate client payments in local Naira with 7.5% commercial VAT rules</p>
              </div>
              <Calculator className="w-5 h-5 text-purple-650" />
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-4 font-sans" id="form-create-invoice">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="client-info-fields">
                <div>
                  <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Corporate Client</label>
                  <input 
                    id="input-client-name"
                    type="text" 
                    required
                    placeholder="e.g. Apex Retail Holding"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 text-neutral-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Billing Email</label>
                  <input 
                    id="input-client-email"
                    type="email" 
                    required
                    placeholder="billing@apexretail.io"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 text-neutral-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Due Date</label>
                  <input 
                    id="input-invoice-duedate"
                    type="date" 
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 text-neutral-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Payment Net Standard</label>
                  <select 
                    id="select-invoice-terms"
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 text-neutral-800"
                  >
                    <option value="Due on Receipt">Due on Receipt</option>
                    <option value="Net 15">Net 15 (15 days)</option>
                    <option value="Net 30">Net 30 (30 days)</option>
                    <option value="Net 60">Net 60 (60 days)</option>
                  </select>
                </div>
              </div>

              {/* DYNAMIC LINE ITEMS TABLE */}
              <div className="space-y-3" id="invoice-line-items-section">
                <div className="flex justify-between items-center border-b border-neutral-100 pb-1.5">
                  <span className="text-xs font-bold text-neutral-700">Invoice Scope Items</span>
                  <button 
                    id="btn-invoice-add-item"
                    type="button"
                    onClick={addLineItem}
                    className="text-xs font-semibold text-purple-650 hover:text-purple-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Item Row
                  </button>
                </div>

                <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1" id="line-items-list-container">
                  {lineItems.map((item, index) => (
                    <div key={item.id} className="flex gap-3 items-center" id={`row-item-creator-${item.id}`}>
                      <div className="flex-1">
                        <input 
                          id={`input-item-desc-${item.id}`}
                          type="text" 
                          required
                          placeholder="Line item description (Audit Fee support...)"
                          value={item.description}
                          onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                          className="w-full text-xs font-semibold px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-800"
                        />
                      </div>

                      <div className="w-16">
                        <input 
                          id={`input-item-qty-${item.id}`}
                          type="number" 
                          required
                          min="1"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(item.id, 'quantity', e.target.value)}
                          className="w-full text-xs font-mono font-semibold px-2 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-800 text-center"
                        />
                      </div>

                      <div className="w-24">
                        <input 
                          id={`input-item-price-${item.id}`}
                          type="number" 
                          required
                          min="0"
                          step="0.01"
                          placeholder="Unit Rate (₦)"
                          value={item.unitPrice === 0 ? '' : item.unitPrice / 100}
                          onChange={(e) => updateLineItem(item.id, 'unitPrice', e.target.value)}
                          className="w-full text-xs font-mono font-semibold px-2 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-800"
                        />
                      </div>

                      <div className="w-24 text-right font-mono font-bold text-xs text-neutral-600">
                        ₦{(item.amount / 100).toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </div>

                      <button 
                        id={`btn-delete-item-${item.id}`}
                        type="button"
                        onClick={() => removeLineItem(item.id)}
                        disabled={lineItems.length === 1}
                        className={`text-neutral-400 hover:text-red-500 cursor-pointer ${lineItems.length === 1 ? 'opacity-35 cursor-not-allowed' : ''}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* ESTIMATIONS & TOTALS SUMMARY */}
              <div className="flex justify-end pt-3 border-t border-neutral-100" id="invoice-estimator-totals">
                <div className="w-64 space-y-2 text-xs font-semibold text-neutral-600 font-sans" id="invoice-calculation-summary">
                  <div className="flex justify-between">
                    <span>Valuation Subtotal:</span>
                    <span className="font-mono font-bold text-neutral-900">
                      ₦{(lineItems.reduce((acc, curr) => acc + curr.amount, 0) / 100).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Federal VAT (7.5%):</span>
                    <span className="font-mono font-bold text-neutral-900">
                      ₦{((lineItems.reduce((acc, curr) => acc + curr.amount, 0) * 0.075) / 100).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-neutral-100 pt-1 text-sm font-bold text-neutral-900">
                    <span>Invoice Net Total:</span>
                    <span className="font-mono text-purple-700">
                      ₦{((lineItems.reduce((acc, curr) => acc + curr.amount, 0) * 1.075) / 100).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-neutral-100" id="invoice-builder-actions">
                <button 
                  id="btn-invoice-modal-cancel"
                  type="button" 
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-xs font-semibold text-neutral-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  id="btn-invoice-modal-create"
                  type="submit"
                  className="px-4 py-2 bg-purple-650 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                  style={{ backgroundColor: '#7C3AED' }}
                >
                  Assemble Billing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE HIGH FIDELITY INVOICE STATEMENT VIEWER */}
      {viewingInvoice && (
        <div className="fixed inset-0 bg-neutral-900/75 flex items-center justify-center z-50 p-4 transition-all overflow-y-auto" id="printable-modal-backdrop animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-8 space-y-6 shadow-2xl relative border border-neutral-200 max-h-[95vh] overflow-y-auto print:p-0 print:border-none print:shadow-none" id="printable-modal-container">
            
            {/* ABSOLUTE FLOATING CLOSE CONTROLS */}
            <div className="absolute right-6 top-6 flex gap-2 print:hidden" id="modal-top-close-controls">
              <button 
                id="btn-invoice-print"
                onClick={() => window.print()}
                className="p-2 border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Statement
              </button>
              
              {viewingInvoice.status !== 'Paid' && (
                <button 
                  id="btn-invoice-markpaid-modal"
                  onClick={() => markAsPaid(viewingInvoice.id)}
                  className="p-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  Mark Paid
                </button>
              )}

              <button 
                id="btn-invoice-close-modal"
                onClick={() => setViewingInvoice(null)}
                className="p-2 border border-neutral-200 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Close View
              </button>
            </div>

            {/* LETTERHEAD OUTLINE */}
            <div className="space-y-6" id="invoice">
              
              <div className="flex flex-col sm:flex-row justify-between items-start border-b border-neutral-100 pb-5 gap-4 shadow-3xs" id="invoice-print-header">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-6 h-6 rounded bg-neutral-900 text-white font-black font-sans flex items-center justify-center text-xs">S</span>
                    <h1 className="text-lg font-black text-neutral-950 font-sans uppercase tracking-tight">Skyhouse Accountants</h1>
                  </div>
                  <p className="text-[10px] text-neutral-400 font-sans mt-1">
                    Suite 900, Broad Street Financial Center, Lagos & Victoria Island<br />
                    compliance@skyaccounting.com.ng • hello@skyaccounting.com.ng
                  </p>
                </div>

                <div className="text-right sm:text-right" id="invoice-print-num">
                  <span className="inline-block text-[10px] font-bold bg-neutral-100 border border-neutral-200 rounded px-2.5 py-0.5 text-neutral-500 tracking-wider font-mono">
                    COMMERCIAL INVOICE
                  </span>
                  <div className="text-lg font-mono font-bold text-neutral-950 mt-1">{viewingInvoice.id}</div>
                  <div className="text-xs text-neutral-500 mt-1">Book Date: <strong className="font-mono">{viewingInvoice.date}</strong></div>
                </div>
              </div>

              {/* To / From */}
              <div className="grid grid-cols-2 gap-6 text-xs text-neutral-600 font-sans" id="invoice-billing-vectors">
                <div>
                  <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 font-mono">Billed to client:</div>
                  <div className="text-sm font-bold text-neutral-950">{viewingInvoice.clientName}</div>
                  <div className="text-xs mt-0.5 text-neutral-500">{viewingInvoice.clientEmail}</div>
                  <div className="text-xs text-neutral-400 mt-1 text-sans">Account reference active</div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 font-mono">Due standard calendars:</div>
                  <div className="text-sm font-bold text-neutral-950 mt-0.5">{viewingInvoice.dueDate}</div>
                  <div className="text-xs mt-0.5 text-purple-600 font-bold">{viewingInvoice.terms || 'Net 30'} standard credit</div>
                  <div className="text-xs text-neutral-400 mt-1 text-sans">Pay via Credit Card, Direct Access Transfer or CBN Escrow Bank Feed</div>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-neutral-150 rounded-xl overflow-hidden font-sans" id="invoice-items-print-outline">
                <table className="w-full text-left text-xs border-collapse font-sans" id="invoice-print-items-table">
                  <thead>
                    <tr className="bg-neutral-50/70 border-b border-neutral-150 text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-mono">
                      <th className="px-5 py-2.5">Audit Listing / Scope item</th>
                      <th className="px-5 py-2.5 text-center font-mono">Qty</th>
                      <th className="px-5 py-2.5 text-right font-mono">Unit Rate</th>
                      <th className="px-5 py-2.5 text-right font-mono">Amount Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 font-medium">
                    {viewingInvoice.items.map((item, idx) => (
                      <tr key={idx} id={`print-item-idx-${idx}`}>
                        <td className="px-5 py-3 font-semibold text-neutral-800">{item.description}</td>
                        <td className="px-5 py-3 text-center text-neutral-500 font-mono">{item.quantity}</td>
                        <td className="px-5 py-3 text-right text-neutral-550 font-mono">₦{(item.unitPrice / 100).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        <td className="px-5 py-3 text-right text-neutral-900 font-mono font-bold">₦{(item.amount / 100).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Row 4: Calculation Totals */}
              <div className="flex justify-between items-start font-sans" id="invoice-calc-and-withhold-stamp font-sans">
                {/* Visual Status Watermark */}
                <div className="relative pt-2" id="invoice-watermark-wrapper">
                  {viewingInvoice.status === 'Paid' ? (
                    <div className="border-4 border-emerald-500 rounded-lg text-emerald-600 uppercase font-bold text-sm tracking-widest px-4 py-2 rotate-[-5deg] inline-block opacity-80" id="paid-stamp">
                      ● PAID COLLECTED ●
                    </div>
                  ) : (
                    <div className="border-4 border-amber-500 rounded-lg text-amber-600 uppercase font-bold text-sm tracking-widest px-4 py-2 rotate-[-5deg] inline-block opacity-80" id="unpaid-stamp">
                      ○ PAYMENT UNPAID DIRECT ○
                    </div>
                  )}
                </div>

                <div className="w-64 space-y-2 text-xs font-semibold text-neutral-600 font-sans" id="invoice-calculation-breakdown-print">
                  <div className="flex justify-between">
                    <span>Valuation Subtotal:</span>
                    <span className="font-mono font-bold text-neutral-900">₦{(viewingInvoice.total / 100).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Federal VAT (7.5%):</span>
                    <span className="font-mono font-bold text-neutral-900">₦{((viewingInvoice.total * 0.075) / 100).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between border-t border-neutral-150 pt-2 text-sm font-bold text-neutral-950">
                    <span>Grand Total:</span>
                    <span className="font-mono text-purple-700 text-base">₦{((viewingInvoice.total * 1.075) / 100).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="text-[10px] text-neutral-400 border-t border-neutral-100 pt-4 flex gap-4 justify-between font-sans" id="print-notes-section">
                <div>
                  <span className="font-bold text-neutral-600">Accounting Terms: </span>
                  Thank you for conducting compliance consulting with Skyhouse Accountants.<br />
                  All direct invoice wire dispatches are logged under commercial compliance service rules.
                </div>
                <div className="text-right shrink-0 select-none font-mono">
                  IFRS Compliance. Sec 508.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
