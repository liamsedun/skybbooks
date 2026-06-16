/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BankAccounts } from '../pages/banking/BankAccounts';
import { Reconciliation } from '../pages/banking/Reconciliation';
import { BankRules } from '../pages/banking/BankRules';
import { BankAccount, CreditCard, Kobo } from '../types';
import { TrendingUp, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';

interface AccountsTabProps {
  bankAccounts: BankAccount[];
  setBankAccounts: React.Dispatch<React.SetStateAction<BankAccount[]>>;
  cards: CreditCard[];
  setCards: React.Dispatch<React.SetStateAction<CreditCard[]>>;
  onAddTransaction: (desc: string, amount: Kobo, type: 'debit' | 'credit', category: string, accountName?: string) => void;
  currentView: string;
  onViewChange: (viewId: string) => void;
}

export default function AccountsTab({
  currentView,
  onViewChange
}: AccountsTabProps) {
  // Stored target account ID when user clicks "Reconcile Now" on BankAccounts card
  const [reconcileTargetId, setReconcileTargetId] = useState<string>('');

  const handleNavigateToReconcile = (viewScope: string, accountId?: string) => {
    if (viewScope === 'reconciliation' && accountId) {
      setReconcileTargetId(accountId);
      onViewChange('bank_feed'); // Route matching ID 'bank_feed' in AppLayout
    } else {
      onViewChange('bank_feed');
    }
  };

  const handleBackToAccounts = () => {
    onViewChange('bank_accounts');
  };

  // Render respective module page view based on router selection
  if (currentView === 'bank_feed') {
    return (
      <div className="animate-fade-in" id="reconciliation-panel">
        <Reconciliation
          initialAccountId={reconcileTargetId}
          onNavigateHome={handleBackToAccounts}
        />
      </div>
    );
  }

  if (currentView === 'banking_rules') {
    return (
      <div className="animate-fade-in" id="rules-panel">
        <BankRules />
      </div>
    );
  }

  if (currentView === 'currency_rates') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm max-w-2xl mx-auto space-y-4 font-sans text-left">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <TrendingUp className="w-5 h-5 text-indigo-500" />
          <h2 className="font-sans font-extrabold text-sm uppercase tracking-wider text-slate-800">
            Currency Exchange Central (CBN Rates)
          </h2>
        </div>

        <p className="text-xs text-slate-500 leading-normal">
          Live interbank exchange rates. These indexes map international invoice receivables with live double-entry records.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-sans">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">USD/NGN Exchange Rate</span>
            <span className="font-mono font-bold text-lg text-slate-900 mt-1 block">₦1,485.50</span>
            <span className="text-[9px] text-emerald-600 font-bold block mt-1">▲ +0.12% active</span>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">GBP/NGN Exchange Rate</span>
            <span className="font-mono font-bold text-lg text-slate-900 mt-1 block">₦1,894.20</span>
            <span className="text-[9px] text-rose-500 font-bold block mt-1">▼ -0.05% soft</span>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">EUR/NGN Exchange Rate</span>
            <span className="font-mono font-bold text-lg text-slate-900 mt-1 block">₦1,602.80</span>
            <span className="text-[9px] text-emerald-600 font-bold block mt-1">▲ +0.02% steady</span>
          </div>
        </div>

        <div className="bg-indigo-50 border border-indigo-150 rounded-xl p-3 flex gap-3 text-xs text-indigo-950">
          <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Multi-Currency Automation:</span> Receivables booking to multi-currency general ledgers are automatically adjusted using active daily rates indices to maintain ledger continuity.
          </div>
        </div>
      </div>
    );
  }

  // Fallback to primary Bank Accounts list card grid
  return (
    <div className="animate-fade-in" id="bank-accounts-panel">
      <BankAccounts onNavigate={handleNavigateToReconcile} />
    </div>
  );
}
