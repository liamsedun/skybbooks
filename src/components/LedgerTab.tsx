/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  ArrowRightLeft, 
  Database,
  Filter, 
  FileText
} from 'lucide-react';
import { Transaction, Kobo } from '../types';
import { CHART_OF_ACCOUNTS } from '../utils/accountingData';

interface LedgerTabProps {
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  onAddTransaction: (desc: string, amount: Kobo, type: 'debit' | 'credit', category: string, account?: string, ref?: string) => void;
}

/**
 * LedgerTab Component
 * Renders the General Journal Ledger displaying GAAP/IFRS double-entry transaction trails in kobo integers.
 */
export default function LedgerTab({ transactions, setTransactions, onAddTransaction }: LedgerTabProps) {
  const [search, setSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  
  // Post Ledger Entry State
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'debit' | 'credit'>('debit');
  const [category, setCategory] = useState('Consulting Revenue');
  const [account, setAccount] = useState('Main Operating Access Checking');
  const [reference, setReference] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Categories & Accounts lists derived representation
  const categories = Array.from(new Set(transactions.map(t => t.category)));
  const bankAccounts = Array.from(new Set(transactions.map(t => t.account)));

  /**
   * Safe submission handler. Translates decimal float inputs into integer kobo bounds.
   */
  const handlePostJournal = (e: React.FormEvent) => {
    e.preventDefault();
    const amtNaira = parseFloat(amount);
    if (!description || isNaN(amtNaira) || amtNaira <= 0) return;

    const amtKobo = Math.round(amtNaira * 100);

    onAddTransaction(
      description,
      amtKobo,
      type,
      category,
      account,
      reference || undefined
    );

    // Reset Form
    setDescription('');
    setAmount('');
    setReference('');
    setShowForm(false);
    
    alert("Post Journal Entry complete. Ledger double balances updated successfully under GAAP protocol.");
  };

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(search.toLowerCase()) || 
                          (t.reference && t.reference.toLowerCase().includes(search.toLowerCase()));
    const matchesAccount = accountFilter === 'All' || t.account === accountFilter;
    const matchesCategory = categoryFilter === 'All' || t.category === categoryFilter;

    return matchesSearch && matchesAccount && matchesCategory;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in" id="ledger-tab-root">
      
      {/* COLUMN 1 & 2: TRANSACTIONS LOG (Span 2) */}
      <div className="lg:col-span-2 space-y-6" id="ledger-left-col">
        
        {/* HEADER & QUICK FILTER ROW */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4" id="ledger-header-panel">
          <div>
            <h2 className="text-lg font-bold text-neutral-900 font-sans">General Journal Ledger</h2>
            <p className="text-xs text-neutral-500 font-sans font-medium">Double-entry accounting audit trail for Skyhouse client accounts</p>
          </div>

          <button 
            id="btn-toggle-post-journal"
            onClick={() => setShowForm(!showForm)}
            className="bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer self-start"
            style={{ backgroundColor: '#7C3AED' }}
          >
            <Plus className="w-3.5 h-3.5" />
            Post Journal Entry
          </button>
        </div>

        {/* JOURNAL POSTING ACTION CARD */}
        {showForm && (
          <form onSubmit={handlePostJournal} className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-sm space-y-4" id="form-post-journal">
            <h3 className="text-sm font-bold text-neutral-900 border-b border-neutral-100 pb-2">Post Standard Journal Entry (GAAP)</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans" id="journal-posting-grid">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Transaction Description</label>
                <input 
                  id="input-tx-desc"
                  type="text" 
                  required
                  placeholder="e.g. ADP Payroll Management Fee"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 text-neutral-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Ref ID / Doc #</label>
                <input 
                  id="input-tx-ref"
                  type="text" 
                  placeholder="e.g. RC-4820"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 text-neutral-800 font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Journal Entry Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    id="btn-post-type-debit"
                    type="button"
                    onClick={() => setType('debit')}
                    className={`py-1.5 text-xs font-bold rounded-lg border transition text-center cursor-pointer ${
                      type === 'debit' ? 'bg-purple-50 border-purple-200 text-purple-700 font-bold' : 'border-neutral-200 text-neutral-600 bg-white'
                    }`}
                  >
                    Debit (+)
                  </button>
                  <button 
                    id="btn-post-type-credit"
                    type="button"
                    onClick={() => setType('credit')}
                    className={`py-1.5 text-xs font-bold rounded-lg border transition text-center cursor-pointer ${
                      type === 'credit' ? 'bg-purple-50 border-purple-200 text-purple-700 font-bold' : 'border-neutral-200 text-neutral-600 bg-white'
                    }`}
                  >
                    Credit (-)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Ledger Category</label>
                <select 
                  id="select-tx-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 text-neutral-800 font-sans"
                >
                  <option value="Consulting Revenue">Consulting Revenue</option>
                  <option value="Audit & Advisory Fees">Audit & Advisory Fees</option>
                  <option value="Salary Expense">Salary Expense</option>
                  <option value="Software">Software & Cloud Services</option>
                  <option value="Office Rent & Supplies">Office Rent & Supplies</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Posting Cash Account</label>
                <select 
                  id="select-tx-account"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 text-neutral-800 font-sans"
                >
                  <option value="Main Operating Access Checking">Main Operating Access Checking</option>
                  <option value="Tax Reserve Access Account">Tax Reserve Access Account</option>
                  <option value="Client Escrow Vault">Client Escrow Vault</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Amount (₦)</label>
                <input 
                  id="input-tx-amount"
                  type="number" 
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full text-xs font-mono font-semibold px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 text-neutral-800"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end border-t border-neutral-100 pt-3">
              <button 
                id="btn-cancel-post-journal"
                type="button" 
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-xs font-semibold text-neutral-700 cursor-pointer text-sans"
              >
                Cancel
              </button>
              <button 
                id="btn-submit-post-journal"
                type="submit"
                className="px-4 py-2 bg-purple-650 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer text-sans"
                style={{ backgroundColor: '#7C3AED' }}
              >
                Assemble Posting
              </button>
            </div>
          </form>
        )}

        {/* LEDGER FILTER CONTROLS */}
        <div className="bg-white border border-neutral-150 rounded-2xl p-4 shadow-3xs flex flex-wrap gap-4 items-center justify-between" id="ledger-filters-bar font-sans">
          <div className="flex items-center gap-2 overflow-x-auto pr-1">
            <span className="text-xs font-bold text-neutral-400 flex items-center gap-1 shrink-0 font-sans">
              <Filter className="w-3.5 h-3.5" />
              Filter:
            </span>
            
            {/* Account filter */}
            <select 
              id="select-filter-account"
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="text-xs font-semibold px-2.5 py-1 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none text-sans"
            >
              <option value="All">All Bank Accounts</option>
              {bankAccounts.map((acc, index) => <option key={index} value={acc}>{acc}</option>)}
            </select>

            {/* Category filter */}
            <select 
              id="select-filter-category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs font-semibold px-2.5 py-1 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none text-sans"
            >
              <option value="All">All Categories</option>
              {categories.map((cat, index) => <option key={index} value={cat}>{cat}</option>)}
            </select>
          </div>

          <div className="relative w-full sm:w-48 ml-auto font-sans" id="ledger-quick-search-wrapper">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-neutral-400" />
            <input 
              id="input-ledger-lookup"
              type="text"
              placeholder="Search Ledger..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none text-neutral-800"
            />
          </div>
        </div>

        {/* TRANSACTION LIST TABLE */}
        <div className="bg-white border border-neutral-150 rounded-2xl overflow-hidden shadow-xs" id="ledger-table-card">
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left border-collapse" id="ledger-table">
              <thead className="sticky top-0 z-10 bg-surface-subtle shadow-[inset_0_-1px_0_rgba(15,23,42,0.06)]">
                <tr className="h-12 border-b border-neutral-150 text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-mono align-middle bg-surface-subtle">
                  <th className="px-5 h-12 align-middle text-left bg-surface-subtle">Ref Number</th>
                  <th className="px-5 h-12 align-middle bg-surface-subtle">Book Date</th>
                  <th className="px-5 h-12 align-middle bg-surface-subtle">Description</th>
                  <th className="px-5 h-12 align-middle bg-surface-subtle">GL Category</th>
                  <th className="px-5 h-12 align-middle bg-surface-subtle">Source Account</th>
                  <th className="px-5 h-12 align-middle text-right bg-surface-subtle">GL Valuation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-[13px] font-sans text-neutral-700 font-medium">
                {filteredTransactions.map(t => (
                  <tr key={t.id} className="h-12 hover:bg-neutral-50/50 transition duration-155 align-middle" id={`row-tx-${t.id}`}>
                    <td className="px-5 h-12 align-middle font-mono text-neutral-400 select-none text-[13px]">{t.reference || t.id.slice(0, 8)}</td>
                    <td className="px-5 h-12 align-middle font-mono text-neutral-500 text-[13px]">{t.date}</td>
                    <td className="px-5 h-12 align-middle font-bold text-neutral-900 text-[13px]">{t.description}</td>
                    <td className="px-5 h-12 align-middle text-[13px]">
                      <span className="px-2 py-0.5 text-[10px] font-semibold font-mono rounded bg-neutral-100 text-neutral-600 border border-neutral-150">
                        {t.category}
                      </span>
                    </td>
                    <td className="px-5 h-12 align-middle text-neutral-500 truncate max-w-[130px] text-[13px]">{t.account}</td>
                    <td className="px-5 h-12 align-middle text-right font-mono font-bold tabular-nums text-[13px]">
                      {t.type === 'debit' ? (
                        <span className="text-emerald-650">+₦{(t.amount / 100).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      ) : (
                        <span className="text-rose-600">-₦{(t.amount / 100).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      )}
                    </td>
                  </tr>
                ))}

                {filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-xs text-neutral-400 font-sans">
                      No matching double bookkeeping entries found in ledger logs.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* COLUMN 3: CHART OF ACCOUNTS SUMMARY & PROTOCOLS */}
      <div className="space-y-6" id="ledger-right-col">
        
        {/* CHART OF ACCOUNTS PANEL */}
        <div className="bg-white border border-neutral-150 shadow-xs rounded-2xl p-5" id="chart-of-accounts-card">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-4">
            <h3 className="text-sm font-bold text-neutral-900 font-sans flex items-center gap-1.5">
              <Database className="w-4 h-4 text-purple-650" />
              Chart of Accounts (GL)
            </h3>
            <span className="text-[9px] px-1.5 py-0.5 bg-neutral-100 border border-neutral-200 text-neutral-500 font-mono font-bold rounded">CBN / IFRS</span>
          </div>

          <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1" id="ledger-coa-list font-sans">
            {CHART_OF_ACCOUNTS.map(coa => (
              <div 
                key={coa.code} 
                className="flex items-center justify-between p-2.5 rounded-xl border border-neutral-100 hover:bg-neutral-50 transition"
                id={`coa-item-${coa.code}`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold font-mono text-neutral-400 select-none">#{coa.code}</span>
                    <span className="text-xs font-bold text-neutral-800 font-sans truncate max-w-[130px]">{coa.name}</span>
                  </div>
                  
                  <span className={`inline-block text-[8px] font-bold tracking-wider uppercase px-1.5 py-0.2 mt-1 rounded ${
                    coa.type === 'Asset' ? 'bg-emerald-50 text-emerald-700' :
                    coa.type === 'Liability' ? 'bg-amber-50 text-amber-700' :
                    coa.type === 'Equity' ? 'bg-blue-50 text-blue-700' :
                    coa.type === 'Revenue' ? 'bg-purple-50 text-purple-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {coa.type}
                  </span>
                </div>

                <div className="text-xs font-bold font-mono text-neutral-950 text-right">
                  ₦{(coa.balance / 100).toLocaleString(undefined, {minimumFractionDigits: 2})}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* LEDGER REPORT AUDIT CONCEPTS */}
        <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4 text-[11px] text-neutral-600 leading-relaxed space-y-2 font-sans" id="auditor-concepts">
          <div className="font-bold text-xs text-neutral-900 flex items-center gap-1 mb-1 font-sans">
            <FileText className="w-3.5 h-3.5 text-neutral-500" />
            Accounting Ledgers Standard Rules
          </div>
          <p>
            • **Debits (+)** representing investments, expenses incurred, client invoices pending, and operating checking fund injections.
          </p>
          <p>
            • **Credits (-)** represent payout dispatches, payroll out, capital distributions, and accounts payable charges.
          </p>
          <p>
            • System enforces continuous ledger integrity to sync automatic tax withholds and bank escrow reports.
          </p>
        </div>
      </div>
    </div>
  );
}
