/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bankingApi, salesApi, purchasesApi } from '../../lib/api';
import { useCurrency } from '../../hooks/useCurrency';
import { useAuth } from '../../hooks/useAuth';
import { AccountSearchSelect } from '../../components/ui/AccountSearchSelect';
import { printWindow } from '../../lib/api';
import {
  RefreshCw,
  Search,
  Check,
  CheckCircle,
  AlertCircle,
  PlusCircle,
  TrendingDown,
  TrendingUp,
  ArrowRightLeft,
  X,
  Sparkles,
  CheckSquare,
  ChevronRight,
  Calculator,
  ArrowRight,
  Trash2,
  ArrowLeft,
  ExternalLink
} from 'lucide-react';

interface ReconciliationProps {
  initialAccountId?: string;
  onNavigateHome: () => void;
}

export function Reconciliation({ initialAccountId, onNavigateHome }: ReconciliationProps) {
  const queryClient = useQueryClient();
  const { formatNaira } = useCurrency();
  const { token } = useAuth();

  // Active bank account selected
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>(initialAccountId || '');
  
  // Selected bank feed transaction for matching comparison
  const [selectedFeedTxnId, setSelectedFeedTxnId] = useState<string | null>(null);
  
  // Drag state indicators
  const [dragOverTxnId, setDragOverTxnId] = useState<string | null>(null);
  const [dragOverLineId, setDragOverLineId] = useState<string | null>(null);

  // Search & Filters on right column of general ledger entries
  const [glSearchKey, setGlSearchKey] = useState('');
  const [glTypeFilter, setGlTypeFilter] = useState<'all' | 'debit' | 'credit'>('all');

  // Multi-select feed items for batch operations
  const [selectedFeedIds, setSelectedFeedIds] = useState<string[]>([]);

  // Quick Create Drawer state
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickCreateTxns, setQuickCreateTxns] = useState<any[]>([]);
  const [quickCreateForm, setQuickCreateForm] = useState({
    type: 'expense' as 'expense' | 'payment_received' | 'transfer' | 'payment_made',
    accountId: '', // GL category account
    description: '',
    contactId: ''
  });

  // Open bills/invoices for allocation (quick payment drawer)
  const [openBills, setOpenBills] = useState<any[]>([]);
  const [openInvoices, setOpenInvoices] = useState<any[]>([]);
  const [selectedAllocations, setSelectedAllocations] = useState<string[]>([]);

  // Fetch open bills when vendor selected for payment_made
  useEffect(() => {
    if (quickCreateForm.type === 'payment_made' && quickCreateForm.contactId) {
      purchasesApi.getBills({ vendorId: quickCreateForm.contactId, limit: 100 }).then((res: any) => {
        const billsData = res?.bills || [];
        setOpenBills(billsData.filter((b: any) => (b.balanceDue || 0) > 0));
      }).catch(() => setOpenBills([]));
    } else {
      setOpenBills([]);
    }
    setSelectedAllocations([]);
  }, [quickCreateForm.type, quickCreateForm.contactId]);

  // Fetch open invoices when customer selected for payment_received
  useEffect(() => {
    if (quickCreateForm.type === 'payment_received' && quickCreateForm.contactId) {
      salesApi.getInvoices({ customerId: quickCreateForm.contactId, limit: 200 }).then((res: any) => {
        const invData = res?.invoices || [];
        setOpenInvoices(invData.filter((inv: any) => (inv.balanceDue || 0) > 0));
      }).catch(() => setOpenInvoices([]));
    } else {
      setOpenInvoices([]);
    }
    setSelectedAllocations([]);
  }, [quickCreateForm.type, quickCreateForm.contactId]);

  // ML suggestion popup state
  const [suggestionTxnId, setSuggestionTxnId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  // Partial match state
  const [partialMatchTxnId, setPartialMatchTxnId] = useState<string | null>(null);
  const [partialMatchLineId, setPartialMatchLineId] = useState<string | null>(null);
  const [partialAmount, setPartialAmount] = useState<number>(0);

  // Adjustment journal modal state
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentForm, setAdjustmentForm] = useState({
    adjustmentType: 'bank_charge' as 'bank_charge' | 'interest_income' | 'correction' | 'difference',
    amount: 0,
    description: '',
    reference: '',
    date: new Date().toISOString().split('T')[0],
    contraAccountId: ''
  });

  // Recent match logs this session to print at bottom
  const [sessionMatches, setSessionMatches] = useState<Array<{
    txn: any;
    line: any;
    date: string;
  }>>([]);

  const [botResults, setBotResults] = useState<{
    show: boolean;
    autoMatched: number;
    rulesMatched: number;
    needsReview: number;
  } | null>(null);

  // 1. Fetch connected bank accounts list
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bankAccounts'],
    queryFn: bankingApi.getAccounts,
    enabled: !!token,
  });

  // If no account is active yet, automatically choose the first connected one
  useEffect(() => {
    if (!selectedBankAccountId && bankAccounts.length > 0) {
      setSelectedBankAccountId(bankAccounts[0].id);
    }
  }, [bankAccounts, selectedBankAccountId]);

  const activeAccountDetails = bankAccounts.find((ba: any) => ba.id === selectedBankAccountId);

  // 2. Fetch unreconciled bank stream feed transactions
  const { data: feedTxns = [], isLoading: isLoadingFeed, refetch: refetchFeed } = useQuery({
    queryKey: ['bankingTransactions', selectedBankAccountId],
    queryFn: () => bankingApi.getTransactions(selectedBankAccountId, { status: 'unreconciled' }),
    enabled: !!selectedBankAccountId && !!token,
  });

  const unreconciledFeed = feedTxns.filter((txn: any) => txn.status === 'unreconciled');

  // 3. Fetch unmatched General Ledger Cash lines for the paired cash ledger account (using our new route!)
  const { data: unmatchedJournalLines = [], isLoading: isLoadingGL, refetch: refetchGL } = useQuery({
    queryKey: ['unmatchedJournalLines', selectedBankAccountId],
    queryFn: () => bankingApi.getUnmatchedJournalLines(selectedBankAccountId),
    enabled: !!selectedBankAccountId && !!token,
  });

  // 4. Fetch all general ledger accounts for Quick Create selections
  const { data: glAccounts = [] } = useQuery({
    queryKey: ['glCashAccounts'],
    queryFn: bankingApi.getGLAccounts,
    enabled: !!token,
  });

  // Safe fetch customers for contacts association
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: salesApi.getCustomers,
    enabled: !!token,
  });

  // Fetch vendors for payment_made contact association
  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: purchasesApi.getVendors,
    enabled: !!token,
  });

  // 5. Reconcile matching mutation
  const reconcileMutation = useMutation({
    mutationFn: ({ txnId, lineId }: { txnId: string; lineId: string }) =>
      bankingApi.reconcileTransaction(txnId, lineId),
    onSuccess: (data, variables) => {
      // Find matching items to append to session display
      const clickedTxn = feedTxns.find((t: any) => t.id === variables.txnId);
      const clickedLine = unmatchedJournalLines.find((l: any) => l.id === variables.lineId);

      if (clickedTxn && clickedLine) {
        setSessionMatches((prev) => [
          { txn: clickedTxn, line: clickedLine, date: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) },
          ...prev
        ]);
      }

      // Reset selection
      if (selectedFeedTxnId === variables.txnId) {
        setSelectedFeedTxnId(null);
      }

      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['bankingTransactions', selectedBankAccountId] });
      queryClient.invalidateQueries({ queryKey: ['unmatchedJournalLines', selectedBankAccountId] });
    },
    onError: (err: any) => {
      alert(`Booking Match Failed: ${err.response?.data?.message || err.message}`);
    }
  });

  // 6. Quick create transaction from feed link
  const createRecordMutation = useMutation({
    mutationFn: ({ txnId, data }: { txnId: string; data: any }) =>
      bankingApi.createRecordFromFeed(txnId, data),
    onSuccess: () => {
      setShowQuickCreate(false);
      setSelectedFeedTxnId(null);
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['bankingTransactions', selectedBankAccountId] });
      queryClient.invalidateQueries({ queryKey: ['unmatchedJournalLines', selectedBankAccountId] });
    },
    onError: (err: any) => {
      alert(`Quick-Create failed: ${err.response?.data?.message || err.response?.data?.error || err.message}`);
    }
  });

  // Batch create records from multiple selected feed items
  const batchCreateRecordMutation = useMutation({
    mutationFn: ({ ids, data }: { ids: string[]; data: any }) =>
      bankingApi.batchCreateRecordFromFeed(ids, data),
    onSuccess: (result: any) => {
      setShowQuickCreate(false);
      setSelectedFeedIds([]);
      setSelectedFeedTxnId(null);
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['bankingTransactions', selectedBankAccountId] });
      queryClient.invalidateQueries({ queryKey: ['unmatchedJournalLines', selectedBankAccountId] });
      if (result.errors?.length > 0) {
        alert(`Created ${result.success} record(s). ${result.errors.length} item(s) failed: ${result.errors.map((e: any) => e.error).join('; ')}`);
      }
    },
    onError: (err: any) => {
      alert(`Batch Quick-Create failed: ${err.response?.data?.message || err.response?.data?.error || err.message}`);
    }
  });

  // 7. Clear imported statements mutation
  const clearImportMutation = useMutation({
    mutationFn: (accountId: string) => bankingApi.clearImportedStatements(accountId),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['bankingTransactions', selectedBankAccountId] });
      alert(result.message || 'Imported statements cleared.');
    },
    onError: (err: any) => {
      alert(`Failed to clear: ${err.message}`);
    }
  });

  const handleClearImport = () => {
    if (!selectedBankAccountId) return;
    if (confirm('Clear all CSV-imported statement transactions? Balance will reset to 0. This cannot be undone.')) {
      clearImportMutation.mutate(selectedBankAccountId);
    }
  };

  // 8. Auto Match Bot trigger
  const autoMatchMutation = useMutation({
    mutationFn: bankingApi.autoMatchTransactions,
    onSuccess: (result: any) => {
      setBotResults({
        show: true,
        autoMatched: result.autoMatchedLedgerLines || 0,
        rulesMatched: result.rulesMatchedFeedRecords || 0,
        needsReview: result.needsReviewCount || 0
      });

      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['bankingTransactions', selectedBankAccountId] });
      queryClient.invalidateQueries({ queryKey: ['unmatchedJournalLines', selectedBankAccountId] });
    },
    onError: (err: any) => {
      alert(`Auto-Matching bot faulted: ${err.message}`);
    }
  });

  // Suggest matches mutation
  const loadSuggestions = async (txnId: string) => {
    setSuggestionTxnId(txnId);
    setSuggestionsLoading(true);
    try {
      const res: any = await bankingApi.suggestMatches(txnId);
      setSuggestions(res.suggestions || []);
    } catch {
      setSuggestions([]);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  // Partial match mutation
  const partialMatchMutation = useMutation({
    mutationFn: ({ txnId, lineId, amount }: { txnId: string; lineId: string; amount: number }) =>
      bankingApi.partialMatchTransaction(txnId, { journalLineId: lineId, allocatedAmount: amount }),
    onSuccess: () => {
      setPartialMatchTxnId(null);
      setPartialMatchLineId(null);
      setPartialAmount(0);
      queryClient.invalidateQueries({ queryKey: ['bankingTransactions', selectedBankAccountId] });
      queryClient.invalidateQueries({ queryKey: ['unmatchedJournalLines', selectedBankAccountId] });
    },
    onError: (err: any) => {
      alert(`Partial match failed: ${err.response?.data?.message || err.message}`);
    }
  });

  // Batch reconcile mutation
  const batchReconcileMutation = useMutation({
    mutationFn: (matches: { bankTransactionId: string; journalLineId: string }[]) =>
      bankingApi.batchReconcile(selectedBankAccountId, { matches }),
    onSuccess: (result: any) => {
      setSelectedFeedIds([]);
      queryClient.invalidateQueries({ queryKey: ['bankingTransactions', selectedBankAccountId] });
      queryClient.invalidateQueries({ queryKey: ['unmatchedJournalLines', selectedBankAccountId] });
      alert(`Batch reconciled ${result.matched} transaction(s).${result.errors?.length ? ` ${result.errors.length} error(s).` : ''}`);
    },
    onError: (err: any) => {
      alert(`Batch reconcile failed: ${err.response?.data?.message || err.message}`);
    }
  });

  // Adjustment journal mutation
  const adjustmentMutation = useMutation({
    mutationFn: (data: any) => bankingApi.generateAdjustment(selectedBankAccountId, data),
    onSuccess: (result: any) => {
      setShowAdjustmentModal(false);
      setAdjustmentForm({
        adjustmentType: 'bank_charge',
        amount: 0,
        description: '',
        reference: '',
        date: new Date().toISOString().split('T')[0],
        contraAccountId: ''
      });
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['bankingTransactions', selectedBankAccountId] });
      queryClient.invalidateQueries({ queryKey: ['unmatchedJournalLines', selectedBankAccountId] });
      alert(`Adjustment journal created successfully.`);
    },
    onError: (err: any) => {
      alert(`Adjustment failed: ${err.response?.data?.message || err.message}`);
    }
  });

  // Reconciliation statement for printing
  const { data: recStatement } = useQuery({
    queryKey: ['reconciliationStatement', selectedBankAccountId],
    queryFn: () => bankingApi.getReconciliationStatement(selectedBankAccountId),
    enabled: !!selectedBankAccountId && !!token,
  });

  const handlePrintStatement = () => {
    const stmt = recStatement?.data || recStatement;
    if (!stmt) return;
    const fmt = (v: number) => `₦${(v/100).toLocaleString()}`;
    const rows: string[] = [];
    const addRow = (label: string, val: string, cls?: string) =>
      rows.push(`<tr${cls?` style="${cls}"`:''}><td style="padding:6px 12px">${label}</td><td class="r" style="padding:6px 12px;font-weight:600">${val}</td></tr>`);
    addRow('Balance per bank statement', fmt(stmt.statementClosingBalance));
    addRow('Add: Outstanding deposits', fmt(stmt.outstandingDeposits));
    addRow('Less: Outstanding payments', `(${fmt(stmt.outstandingPayments)})`);
    addRow('', '', 'border-top:2px solid #0f172a');
    addRow('Adjusted bank balance', fmt(stmt.adjustedBankBalance), 'font-weight:700');
    addRow('', '', 'border-top:2px solid #0f172a');
    addRow('Balance per GL (cash book)', fmt(stmt.glBalance));
    addRow('', '', 'border-top:3px double #0f172a');
    const diff = Math.abs(stmt.adjustedBankBalance - stmt.glBalance);
    if (stmt.isReconciled) {
      addRow(`Difference: ₦${(diff/100).toLocaleString()}  ✓ Reconciled`, '', 'background:#ecfdf5;font-weight:700;color:#059669');
    } else {
      addRow(`Difference: ₦${(diff/100).toLocaleString()}  ✗ Outstanding`, '', 'background:#fef2f2;font-weight:700;color:#dc2626');
    }
    addRow('', '', 'border-top:3px double #0f172a');
    const subtitle = `Bank: ${stmt.bankAccount.bankName} — ${stmt.bankAccount.name} (${stmt.bankAccount.accountNumber})`;
    printWindow('Bank Reconciliation Statement', `<table style="width:100%;border-collapse:collapse;font-size:13px">${rows.join('')}</table>`, subtitle);
  };

  // Handle manual reconciliation lock
  const handleMatch = (txnId: string, lineId: string) => {
    reconcileMutation.mutate({ txnId, lineId });
  };

  // Drag-and-drop mechanics
  const handleDragStart = (e: React.DragEvent, id: string, origin: 'bank' | 'gl') => {
    e.dataTransfer.setData('origin', origin);
    e.dataTransfer.setData('id', id);
  };

  const handleDragOver = (e: React.DragEvent, id: string, targetType: 'bank' | 'gl') => {
    e.preventDefault();
    if (targetType === 'bank') {
      setDragOverTxnId(id);
    } else {
      setDragOverLineId(id);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string, targetType: 'bank' | 'gl') => {
    e.preventDefault();
    setDragOverTxnId(null);
    setDragOverLineId(null);

    const origin = e.dataTransfer.getData('origin');
    const sourceId = e.dataTransfer.getData('id');

    if (!origin || !sourceId) return;

    if (origin === 'bank' && targetType === 'gl') {
      // Dragged bank transaction card and dropped onto General Ledger card!
      handleMatch(sourceId, targetId);
    } else if (origin === 'gl' && targetType === 'bank') {
      // Dragged GL card and dropped onto bank card!
      handleMatch(targetId, sourceId);
    }
  };

  // Open Quick create modal setup (single or batch)
  const openQuickCreate = (txn?: any) => {
    const items = txn ? [txn] : selectedFeedIds.map(id => feedTxns.find((t: any) => t.id === id)).filter(Boolean);
    if (items.length === 0) return;
    const firstDebit = items.some((t: any) => t.type === 'debit');
    setQuickCreateTxns(items);
    setQuickCreateForm({
      type: firstDebit ? 'expense' : 'payment_received',
      accountId: '',
      description: items.length === 1 ? (items[0].description || '') : 'Bank charges',
      contactId: ''
    });
    setShowQuickCreate(true);
  };

  // Navigate to the originating transaction for a journal line
  const handleDrillDown = (line: any) => {
    if (!line.source || !line.sourceId) return;
    switch (line.source) {
      case 'invoice':
        navigate(`/sales/invoices/${line.sourceId}`);
        break;
      case 'bill':
        navigate(`/purchases/bills/${line.sourceId}`);
        break;
      case 'payment':
        if (line.debitAmount > 0) {
          navigate(`/sales/payments/${line.sourceId}`);
        } else {
          navigate(`/purchases/payments/${line.sourceId}`);
        }
        break;
      case 'payroll':
        navigate(`/payroll/runs/${line.sourceId}`);
        break;
      case 'manual':
        navigate(`/expenses/${line.sourceId}`);
        break;
    }
  };

  const submitQuickCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCreateForm.accountId) {
      alert('Please select a General Ledger categorization account.');
      return;
    }

    // Build allocations from selected bills/invoices
    const totalAmount = quickCreateTxns.reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);
    let allocations: { id: string; amount: number }[] = [];
    if (quickCreateForm.type === 'payment_made' && selectedAllocations.length > 0 && openBills.length > 0) {
      const selectedBills = openBills.filter((b: any) => selectedAllocations.includes(b.id));
      const totalSelectedBal = selectedBills.reduce((s: number, b: any) => s + (b.balanceDue || 0), 0);
      if (totalSelectedBal > 0) {
        let remaining = totalAmount;
        allocations = selectedBills.map((b: any, i: number) => {
          const isLast = i === selectedBills.length - 1;
          const amt = isLast ? remaining : Math.round((b.balanceDue / totalSelectedBal) * totalAmount);
          remaining -= amt;
          return { id: b.id, amount: Math.min(amt, b.balanceDue) };
        });
      }
    } else if (quickCreateForm.type === 'payment_received' && selectedAllocations.length > 0 && openInvoices.length > 0) {
      const selectedInvs = openInvoices.filter((inv: any) => selectedAllocations.includes(inv.id));
      const totalSelectedBal = selectedInvs.reduce((s: number, inv: any) => s + (inv.balanceDue || 0), 0);
      if (totalSelectedBal > 0) {
        let remaining = totalAmount;
        allocations = selectedInvs.map((inv: any, i: number) => {
          const isLast = i === selectedInvs.length - 1;
          const amt = isLast ? remaining : Math.round((inv.balanceDue / totalSelectedBal) * totalAmount);
          remaining -= amt;
          return { id: inv.id, amount: Math.min(amt, inv.balanceDue) };
        });
      }
    }

    const data = {
      type: quickCreateForm.type,
      accountId: quickCreateForm.accountId,
      description: quickCreateForm.description,
      contactId: quickCreateForm.contactId || undefined,
      allocations: allocations.length > 0 ? allocations : undefined
    };

    if (quickCreateTxns.length === 1) {
      createRecordMutation.mutate({ txnId: quickCreateTxns[0].id, data });
    } else {
      batchCreateRecordMutation.mutate({ ids: quickCreateTxns.map((t: any) => t.id), data });
    }
  };

  // Automated bot run
  const triggerAutoMatch = () => {
    if (!selectedBankAccountId) return;
    autoMatchMutation.mutate(selectedBankAccountId);
  };

  // Match suggestions calculations
  const findPerfectMatchFromGL = (txn: any) => {
    return unmatchedJournalLines.find((line: any) => {
      const opposingMatch =
        (txn.type === 'debit' && line.creditAmount > 0) ||
        (txn.type === 'credit' && line.debitAmount > 0);
      if (!opposingMatch) return false;

      const ledgerValue = line.debitAmount > 0 ? line.debitAmount : line.creditAmount;
      const amtDiff = Math.abs(txn.amount - ledgerValue);
      if (amtDiff > 1) return false;

      const dateDiff = Math.abs(new Date(txn.date).getTime() - new Date(line.entryDate).getTime());
      return dateDiff <= 3 * 24 * 60 * 60 * 1000; // ±3 days
    });
  };

  // Filter General Ledger unmatched lines dynamically
  const filteredJournalEntries = unmatchedJournalLines.filter((line: any) => {
    const term = glSearchKey.toLowerCase();
    const descMatches = (line.description || '').toLowerCase().includes(term);
    const entryNumMatches = (line.entryNum || '').toLowerCase().includes(term);
    const textMatches = descMatches || entryNumMatches;

    if (glTypeFilter === 'debit') {
      return textMatches && line.debitAmount > 0;
    }
    if (glTypeFilter === 'credit') {
      return textMatches && line.creditAmount > 0;
    }
    return textMatches;
  });

  const navigate = useNavigate();

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      {/* Upper Context Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-4 border-b border-slate-100 gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onNavigateHome}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all duration-200 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

        </div>

        {/* Select Account & Bot Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-tight">Active Bank:</span>
            <select
              value={selectedBankAccountId}
              onChange={(e) => {
                setSelectedBankAccountId(e.target.value);
                setSelectedFeedTxnId(null);
              }}
              className="px-2.5 py-1.5 text-xs font-bold border border-slate-200 focus:outline-none bg-white rounded-xl text-slate-800 transition-all duration-200"
            >
              {bankAccounts.map((account: any) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.bankName})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            disabled={autoMatchMutation.isPending || unreconciledFeed.length === 0}
            onClick={triggerAutoMatch}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer font-sans shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>Auto-Match Bot</span>
          </button>
          <button
            type="button"
            onClick={handlePrintStatement}
            disabled={!recStatement?.data && !recStatement}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-700 rounded-xl disabled:opacity-50 transition-all duration-200 cursor-pointer font-sans shadow-xs"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
            <span>Print Statement</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAdjustmentModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-700 rounded-xl transition-all duration-200 cursor-pointer font-sans shadow-xs"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Adjustment JE</span>
          </button>
        </div>
      </div>

      {/* Bot success alert modal overlay if active */}
      {botResults?.show && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-xs text-slate-900 font-sans">Automated AI Reconciliation Completed</h3>
              <p className="text-[11px] text-slate-600 mt-0.5 max-w-xl leading-relaxed">
                Matched <span className="font-bold">{botResults.autoMatched} ledger entries</span> automatically, applied <span className="font-bold">{botResults.rulesMatched} automated rule categories</span>. Under review: <span className="font-semibold">{botResults.needsReview}</span> items.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setBotResults(null)}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-all duration-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* SPLIT PANE WORKBENCH */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-5 items-start">
        {/* LEFT COLUMN: Bank Feeds Statement (40%) */}
        <div className="lg:col-span-4 space-y-3.5">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block font-sans">Bank Stream Feed</span>
                <span className="text-xs font-bold text-slate-800 font-sans">{unreconciledFeed.length} Unreconciled Records</span>
              </div>
              {unreconciledFeed.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearImport}
                  disabled={clearImportMutation.isPending}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold uppercase rounded-xl border border-rose-200/80 text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition-all duration-200 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear Import</span>
                </button>
              )}
            </div>
            {selectedFeedIds.length > 0 && (
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap">
                <span className="text-[11px] font-bold text-slate-600">{selectedFeedIds.length} selected</span>
                <button
                  type="button"
                  onClick={() => openQuickCreate()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200 cursor-pointer shadow-sm"
                >
                  <PlusCircle className="w-3 h-3" />
                  <span>Record as Quick Payment</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Build batch matches from perfect matches of selected items
                    const matches = selectedFeedIds.map(id => {
                      const txn = feedTxns.find((t: any) => t.id === id);
                      if (!txn) return null;
                      const perfect = findPerfectMatchFromGL(txn);
                      return perfect ? { bankTransactionId: id, journalLineId: perfect.id } : null;
                    }).filter((m): m is { bankTransactionId: string; journalLineId: string } => m !== null);
                    if (matches.length === 0) { alert('No perfect matches found for selected items.'); return; }
                    if (matches.length < selectedFeedIds.length) {
                      if (!confirm(`${matches.length} of ${selectedFeedIds.length} items have perfect matches. Proceed?`)) return;
                    }
                    batchReconcileMutation.mutate(matches);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white hover:from-emerald-700 hover:to-emerald-800 transition-all duration-200 cursor-pointer shadow-sm"
                >
                  <CheckSquare className="w-3 h-3" />
                  <span>Batch Reconcile</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFeedIds([])}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold uppercase rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all duration-200 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              </div>
            )}
          </div>

          {isLoadingFeed ? (
            <div className="py-20 text-center text-xs text-slate-400 font-sans bg-gradient-to-r from-slate-200 to-slate-100 animate-pulse rounded-xl flex items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 mx-auto mb-2.5 animate-spin text-slate-300" />
              Loading statement feed...
            </div>
          ) : unreconciledFeed.length === 0 ? (
            <div className="py-20 text-center px-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
              <CheckCircle className="w-9 h-9 text-emerald-500 mx-auto mb-3" />
              <h3 className="font-sans font-bold text-slate-900 text-xs">Feed is fully reconciled!</h3>
              <p className="font-sans text-[10px] text-slate-400 mt-1 max-w-[200px] mx-auto">
                No pending bank statement transactions remain unmatched. Good job!
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {unreconciledFeed.map((txn: any) => {
                const isSelected = selectedFeedTxnId === txn.id;
                const isDebit = txn.type === 'debit';
                const suggestedMatch = findPerfectMatchFromGL(txn);

                return (
                  <div
                    key={txn.id}
                    id={`bank-txn-card-${txn.id}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, txn.id, 'bank')}
                    onDragOver={(e) => handleDragOver(e, txn.id, 'bank')}
                    onDrop={(e) => handleDrop(e, txn.id, 'bank')}
                    onClick={() => setSelectedFeedTxnId(isSelected ? null : txn.id)}
                    className={`p-3.5 rounded-xl border transition-all duration-200 text-left select-none cursor-pointer relative group flex flex-col justify-between ${
                      isSelected
                        ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                        : dragOverTxnId === txn.id
                        ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200'
                        : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    {/* Multi-select checkbox */}
                    <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedFeedIds.includes(txn.id)}
                        onChange={(e) => {
                          setSelectedFeedIds(prev =>
                            e.target.checked ? [...prev, txn.id] : prev.filter(id => id !== txn.id)
                          );
                        }}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Upper date/amount/balance info */}
                    <div className="flex items-start justify-between gap-2 pl-5">
                      <div className="min-w-0 flex-1">
                        <p className={`font-sans font-semibold text-xs tracking-tight leading-snug truncate ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                          {txn.description}
                        </p>
                        <p className={`text-[10px] font-sans font-medium mt-0.5 ${isSelected ? 'text-slate-400' : 'text-slate-400'}`}>
                          {new Date(txn.date).toLocaleDateString('en-GB')}
                        </p>
                      </div>

                      <div className="text-right shrink-0 flex items-center gap-3">
                        <div>
                          <span className={`font-mono font-bold text-xs ${
                            isDebit
                              ? isSelected ? 'text-rose-300' : 'text-rose-600 bg-rose-50 px-2 py-0.5 rounded'
                              : isSelected ? 'text-emerald-300' : 'text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded'
                          }`}>
                            {isDebit ? '-' : '+'}{formatNaira(txn.amount)}
                          </span>
                          <span className={`block text-[8px] font-extrabold uppercase mt-0.5 text-right ${isSelected ? 'text-slate-400' : 'text-slate-400'}`}>
                            {isDebit ? 'Withdrawal' : 'Deposit'}
                          </span>
                        </div>
                        {txn.balanceAfter != null && (
                          <div className="pl-2 border-l border-slate-200/60">
                            <span className={`font-mono font-bold text-xs ${isSelected ? 'text-slate-300' : 'text-slate-700'}`}>
                              {formatNaira(txn.balanceAfter)}
                            </span>
                            <span className={`block text-[8px] font-extrabold uppercase mt-0.5 text-right ${isSelected ? 'text-slate-500' : 'text-slate-400'}`}>
                              Balance
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Draggable handle hint */}
                    <div className="absolute right-2 bottom-1.5 opacity-0 group-hover:opacity-60 text-[9px] font-bold tracking-tight text-slate-400 select-none">
                      Drag to Match
                    </div>

                    {/* AI Perfect Candidate Suggestion Badge */}
                    {suggestedMatch && !isSelected && (
                      <div className="mt-3 flex items-center justify-between bg-indigo-50/50 border border-indigo-200/50 rounded-xl p-2 text-left">
                        <div className="min-w-0">
                          <span className="text-[9px] font-black uppercase text-indigo-600 block leading-none">Perfect Candidate Match</span>
                          <span className="text-[10px] font-bold text-slate-700 truncate block mt-0.5">
                            {suggestedMatch.description} ({suggestedMatch.entryNum})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMatch(txn.id, suggestedMatch.id);
                          }}
                          className="px-2 py-1 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl text-[9px] font-semibold uppercase transition-all duration-200 hover:from-indigo-700 hover:to-indigo-800 flex items-center gap-0.5"
                        >
                          <Check className="w-2.5 h-2.5" /> Book
                        </button>
                      </div>
                    )}

                    {/* Expanded details context when row-holder clicked */}
                    {isSelected && (
                      <div className="mt-4 pt-3.5 border-t border-slate-800 space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 font-sans">
                          <div>
                            <span className="block font-bold">Transaction Reference</span>
                            <span className="font-mono text-white text-[11px] block mt-0.5">{txn.reference || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="block font-bold">Flow Segment Direction</span>
                            <span className="text-white font-semibold text-[11px] block mt-0.5">{isDebit ? 'Debit Money Expelled' : 'Credit Money Received'}</span>
                          </div>
                        </div>

                        {/* Quick create button controllers */}
                        <div className="flex flex-col gap-1 px-0.5 pt-1.5">
                          <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wide block mb-1">Unmatched? Create ledger record:</span>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openQuickCreate(txn);
                              }}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold uppercase rounded-xl border border-slate-700/80 text-orange-400 inline-flex items-center gap-1 cursor-pointer transition-all duration-200 shrink-0"
                            >
                                <PlusCircle className="w-3.5 h-3.5" />
                                <span>{isDebit ? 'Record Expense' : 'Record Revenue'}</span>
                              </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setQuickCreateForm({
                                  type: 'transfer',
                                  accountId: '',
                                  description: `Transfer funds: ${txn.description}`,
                                  contactId: ''
                                });
                                setQuickCreateTxns([txn]);
                                setShowQuickCreate(true);
                              }}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold uppercase rounded-xl border border-slate-700/80 text-white inline-flex items-center gap-1 cursor-pointer transition-all duration-200 shrink-0"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                              <span>Record Transfer</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); loadSuggestions(txn.id); }}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold uppercase rounded-xl border border-slate-700/80 text-emerald-400 inline-flex items-center gap-1 cursor-pointer transition-all duration-200 shrink-0"
                            >
                              <TrendingUp className="w-3.5 h-3.5" />
                              <span>ML Suggestions</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPartialMatchTxnId(partialMatchTxnId === txn.id ? null : txn.id);
                                setPartialAmount(txn.amount);
                              }}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold uppercase rounded-xl border border-slate-700/80 text-cyan-400 inline-flex items-center gap-1 cursor-pointer transition-all duration-200 shrink-0"
                            >
                              <Calculator className="w-3.5 h-3.5" />
                              <span>Partial Match</span>
                            </button>
                          </div>

                          {/* ML Suggestions Popup */}
                          {suggestionTxnId === txn.id && (
                            <div className="mt-2 bg-slate-800/50 border border-slate-700 rounded-xl p-2.5 space-y-2" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black uppercase text-emerald-400">ML Confidence Scored Suggestions</span>
                                <button type="button" onClick={() => setSuggestionTxnId(null)} className="text-slate-500 hover:text-slate-300"><X className="w-3 h-3" /></button>
                              </div>
                              {suggestionsLoading ? (
                                <div className="text-[10px] text-slate-400 py-2 text-center">Loading suggestions...</div>
                              ) : suggestions.length === 0 ? (
                                <div className="text-[10px] text-slate-400 py-2 text-center">No matching candidates found.</div>
                              ) : (
                                <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                                  {suggestions.map((s: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between bg-slate-900/50 rounded-lg p-2 gap-2">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                            s.confidence >= 90 ? 'bg-emerald-600/20 text-emerald-400' :
                                            s.confidence >= 70 ? 'bg-amber-600/20 text-amber-400' :
                                            'bg-slate-600/20 text-slate-400'
                                          }`}>{s.confidence}%</span>
                                          <span className="text-[10px] font-bold text-slate-300 truncate">{s.entryDescription || s.entryNumber}</span>
                                        </div>
                                        <div className="text-[8px] text-slate-500 mt-0.5">
                                          {s.entryNumber} · {new Date(s.entryDate).toLocaleDateString()} · ₦{(s.lineAmount / 100).toLocaleString()}
                                        </div>
                                        {s.descriptionMatch != null && (
                                          <div className="text-[8px] text-slate-500">Desc match: {s.descriptionMatch}% · Date diff: {s.dateDiffDays}d · Amt diff: ₦{s.amountDiff}</div>
                                        )}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleMatch(txn.id, s.journalLineId)}
                                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[8px] font-bold uppercase shrink-0"
                                      >
                                        <Check className="w-2.5 h-2.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Partial Match Form */}
                          {partialMatchTxnId === txn.id && (
                            <div className="mt-2 bg-slate-800/50 border border-slate-700 rounded-xl p-2.5 space-y-2" onClick={(e) => e.stopPropagation()}>
                              <span className="text-[9px] font-black uppercase text-cyan-400 block">Partial Match</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-400 shrink-0">Amount (kobo):</span>
                                <input
                                  type="number"
                                  value={partialAmount}
                                  onChange={(e) => setPartialAmount(Number(e.target.value))}
                                  className="flex-1 px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                                />
                                <span className="text-[9px] text-slate-500">max: {formatNaira(txn.amount)}</span>
                              </div>
                              <div className="text-[9px] text-slate-500">Select a GL line card on the right, then click here to match:</div>
                              {selectedFeedTxnId && partialMatchLineId && (
                                <button
                                  type="button"
                                  onClick={() => partialMatchMutation.mutate({ txnId: txn.id, lineId: partialMatchLineId, amount: partialAmount })}
                                  disabled={partialMatchMutation.isPending}
                                  className="w-full py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-[9px] font-bold uppercase disabled:opacity-50"
                                >
                                  {partialMatchMutation.isPending ? 'Processing...' : `Allocate ${formatNaira(partialAmount)}`}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: FinanceOS General Ledger Cash Lines (60%) */}
        <div className="lg:col-span-6 space-y-3.5">
          {/* Header toolbar & filtration desk */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block font-sans">SkyBooks</span>
                <span className="text-xs font-bold text-slate-800 font-sans">{filteredJournalEntries.length} Unmatched Journal Lines</span>
              </div>

              {/* Filtering segmented controls */}
              <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/50">
                <button
                  type="button"
                  onClick={() => setGlTypeFilter('all')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-xl font-sans transition-all duration-200 ${
                    glTypeFilter === 'all' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setGlTypeFilter('debit')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-xl font-sans transition-all duration-200 ${
                    glTypeFilter === 'debit' ? 'bg-white shadow-xs text-indigo-600' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Debits
                </button>
                <button
                  type="button"
                  onClick={() => setGlTypeFilter('credit')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-xl font-sans transition-all duration-200 ${
                    glTypeFilter === 'credit' ? 'bg-white shadow-xs text-rose-600' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Credits
                </button>
              </div>
            </div>

            {/* General ledger searching keyboard input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search ledger by transaction descriptions or ledger entry numbers..."
                value={glSearchKey}
                onChange={(e) => setGlSearchKey(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow pl-9 pr-4 text-slate-800 placeholder-slate-400 block"
              />
            </div>
          </div>

          {isLoadingGL ? (
            <div className="py-20 text-center text-xs text-slate-400 font-sans bg-gradient-to-r from-slate-200 to-slate-100 animate-pulse rounded-xl flex items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 mx-auto mb-2.5 animate-spin text-slate-300" />
              Loading general ledger accounts...
            </div>
          ) : filteredJournalEntries.length === 0 ? (
            <div className="py-20 text-center px-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
              <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <h3 className="font-sans font-bold text-slate-700 text-xs">No ledger rows found</h3>
              <p className="font-sans text-[10px] text-slate-400 mt-1">
                Try clearing search terms or selecting another bank account.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1">
              {filteredJournalEntries.map((line: any) => {
                const isDebit = line.debitAmount > 0;
                const valueLine = isDebit ? line.debitAmount : line.creditAmount;
                const matchesSelection = selectedFeedTxnId !== null;

                // Check if this ledger row direction matches target selection (strictly opposite of bank transaction)
                const selectedTxn = feedTxns.find((t: any) => t.id === selectedFeedTxnId);
                const isDirectionOpposing =
                  selectedTxn &&
                  ((selectedTxn.type === 'debit' && line.creditAmount > 0) ||
                    (selectedTxn.type === 'credit' && line.debitAmount > 0));

                const isValueIdentical = selectedTxn && Math.abs(selectedTxn.amount - valueLine) <= 1;
                const canMatch = isDirectionOpposing && isValueIdentical;

                return (
                  <div
                    key={line.id}
                    id={`gl-line-card-${line.id}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, line.id, 'gl')}
                    onDragOver={(e) => handleDragOver(e, line.id, 'gl')}
                    onDrop={(e) => handleDrop(e, line.id, 'gl')}
                    onClick={() => {
                      if (partialMatchTxnId) {
                        setPartialMatchLineId(line.id);
                        return;
                      }
                      if (selectedFeedTxnId) {
                        handleMatch(selectedFeedTxnId, line.id);
                      }
                    }}
                    className={`p-3.5 border rounded-xl transition-all duration-200 flex flex-col justify-between text-left relative overflow-hidden group select-none cursor-pointer ${
                      partialMatchLineId === line.id
                        ? 'bg-cyan-50 border-cyan-300 ring-2 ring-cyan-200'
                        : canMatch
                        ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-100 hover:bg-amber-50'
                        : dragOverLineId === line.id
                        ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200'
                        : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    {/* Top Section */}
                    <div className="space-y-1.5 flex-1 pb-4">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[9px] font-mono font-bold text-slate-400 uppercase">
                          {line.entryNum || 'JOURNAL'}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          isDebit ? 'bg-indigo-50 text-indigo-700 border-indigo-100/50' : 'bg-rose-50 text-rose-700 border-rose-100/50'
                        }`}>
                          {isDebit ? 'Debit (+) Cash' : 'Credit (-) Cash'}
                        </span>
                      </div>

                      <p className="font-sans font-bold text-xs text-slate-800 leading-tight block truncate" title={line.description}>
                        {line.description}
                      </p>
                      <p className="text-[10px] font-sans font-medium text-slate-400 leading-none">
                        Date: {new Date(line.entryDate).toLocaleDateString('en-GB')}
                      </p>
                    </div>

                    {/* Bottom balance status */}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 shrink-0">
                      <span className="text-[10px] font-bold text-slate-400 font-sans">Ledger value:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-xs text-slate-900">{formatNaira(valueLine)}</span>
                        {line.source && line.sourceId && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDrillDown(line); }}
                            className="p-1 rounded-lg text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-200"
                            title={`View originating ${line.source}`}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Hover pairing recommendation banner */}
                    {canMatch && (
                      <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-2.5 text-center transition-all duration-150 animate-fade-in">
                        <CheckSquare className="w-4 h-4 text-emerald-400 mb-1" />
                        <span className="font-sans font-extrabold text-[10px] text-white uppercase tracking-wider">Opposing value Match!</span>
                        <span className="font-sans text-[8px] text-slate-400 mt-0.5">Click Card or Drop to Book Match</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* SESSION RESULTS PANELS: LOCKED LIST AT BOTTOM */}
      {sessionMatches.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 font-sans">
              Reconciliation audit trails ({sessionMatches.length} locked this session)
            </h4>
            <div className="text-[10px] text-emerald-600 font-bold inline-flex items-center gap-1">
              <CheckSquare className="w-3.5 h-3.5" /> Accounting ledgers synced in real time
            </div>
          </div>

          <div className="divide-y divide-slate-100 max-h-[220px] overflow-y-auto">
            {sessionMatches.map((match, idx) => (
              <div key={idx} className="p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-slate-700 hover:bg-emerald-50/30 transition-colors">
                <div className="flex items-start sm:items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
                    ✓
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-sans font-bold text-xs text-slate-900">{match.txn.description}</span>
                      <span className="text-[10px] text-slate-400 font-medium">matched with ledger</span>
                      <span className="font-sans font-semibold text-xs text-slate-700 underline">{match.line.description}</span>
                    </div>
                    <span className="text-[9px] font-mono text-slate-400">
                      Bank Ref: {match.txn.reference || 'N/A'} • GL Entry Ref: {match.line.entryNum}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4.5">
                  <span className="font-mono font-bold text-xs text-slate-900 shrink-0">
                    {formatNaira(match.txn.amount)}
                  </span>
                  <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded font-sans leading-none">
                    Locked at {match.date}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 text-right">
            <button
              type="button"
              onClick={() => {
                setSessionMatches([]);
                onNavigateHome();
              }}
              className="px-4 py-2 font-sans font-semibold text-xs bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl transition-all duration-200 shadow-sm"
            >
              Confirm Reconciliation & Done
            </button>
          </div>
        </div>
      )}

      {/* AGING TABLE — show when statement data is available */}
      {recStatement?.data && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-5 py-3 border-b border-slate-200">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 font-sans">Unreconciled Aging</h4>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h5 className="text-[10px] font-bold uppercase text-slate-500 mb-2">Outstanding Deposits</h5>
              {(() => {
                const aging = recStatement.data.aging?.outstandingDeposits || {};
                return (
                  <table className="w-full text-xs">
                    <thead><tr className="text-slate-400 text-[9px] uppercase font-bold"><td className="pb-1">Bucket</td><td className="pb-1 text-right">Amount</td></tr></thead>
                    <tbody>
                      {Object.entries(aging).map(([bucket, amt]: any) => (
                        <tr key={bucket} className="border-t border-slate-100"><td className="py-1 text-slate-700">{bucket} days</td><td className="py-1 text-right font-mono font-bold text-slate-900">{formatNaira(amt)}</td></tr>
                      ))}
                      <tr className="border-t-2 border-slate-300"><td className="py-1 font-bold text-slate-800">Total</td><td className="py-1 text-right font-mono font-bold text-slate-900">{formatNaira(Object.values(aging).reduce((s: number, a: any) => s + a, 0))}</td></tr>
                    </tbody>
                  </table>
                );
              })()}
            </div>
            <div>
              <h5 className="text-[10px] font-bold uppercase text-slate-500 mb-2">Outstanding Payments</h5>
              {(() => {
                const aging = recStatement.data.aging?.outstandingPayments || {};
                return (
                  <table className="w-full text-xs">
                    <thead><tr className="text-slate-400 text-[9px] uppercase font-bold"><td className="pb-1">Bucket</td><td className="pb-1 text-right">Amount</td></tr></thead>
                    <tbody>
                      {Object.entries(aging).map(([bucket, amt]: any) => (
                        <tr key={bucket} className="border-t border-slate-100"><td className="py-1 text-slate-700">{bucket} days</td><td className="py-1 text-right font-mono font-bold text-slate-900">{formatNaira(amt)}</td></tr>
                      ))}
                      <tr className="border-t-2 border-slate-300"><td className="py-1 font-bold text-slate-800">Total</td><td className="py-1 text-right font-mono font-bold text-slate-900">{formatNaira(Object.values(aging).reduce((s: number, a: any) => s + a, 0))}</td></tr>
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>
          {recStatement.data.matchMethodBreakdown && (
            <div className="px-5 pb-4">
              <h5 className="text-[10px] font-bold uppercase text-slate-500 mb-2">Match Method Breakdown</h5>
              <div className="flex flex-wrap gap-2">
                {Object.entries(recStatement.data.matchMethodBreakdown).map(([method, count]: any) => (
                  <span key={method} className="px-2.5 py-1 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-700">{method}: {count}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ADJUSTMENT JOURNAL MODAL */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 border border-slate-200/80">
            <div className="p-4 border-b border-slate-200/80 bg-slate-50 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-xs text-slate-900 uppercase tracking-tight">Reconciliation Adjustment JE</h3>
              </div>
              <button type="button" onClick={() => setShowAdjustmentModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); adjustmentMutation.mutate(adjustmentForm); }} className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Adjustment Type</label>
                <select
                  value={adjustmentForm.adjustmentType}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, adjustmentType: e.target.value as any })}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white text-slate-800"
                >
                  <option value="bank_charge">Bank Charge</option>
                  <option value="interest_income">Interest Income</option>
                  <option value="correction">Correction</option>
                  <option value="difference">Difference</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Amount (₦)</label>
                <input type="number" step="0.01" value={adjustmentForm.amount / 100} onChange={(e) => setAdjustmentForm({ ...adjustmentForm, amount: Math.round(parseFloat(e.target.value || '0') * 100) })} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 text-slate-800" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Description</label>
                <input type="text" required value={adjustmentForm.description} onChange={(e) => setAdjustmentForm({ ...adjustmentForm, description: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 text-slate-800" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Date</label>
                <input type="date" required value={adjustmentForm.date} onChange={(e) => setAdjustmentForm({ ...adjustmentForm, date: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 text-slate-800" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Contra GL Account (optional)</label>
                <AccountSearchSelect
                  accounts={glAccounts}
                  value={adjustmentForm.contraAccountId}
                  onChange={(id) => setAdjustmentForm({ ...adjustmentForm, contraAccountId: id })}
                  placeholder="-- Auto-select --"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAdjustmentModal(false)} className="flex-1 py-2 text-xs font-bold border border-slate-200/80 hover:bg-slate-100 text-slate-600 rounded-xl cursor-pointer">Cancel</button>
                <button type="submit" disabled={adjustmentMutation.isPending} className="flex-1 py-2 text-xs font-bold bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 cursor-pointer">{adjustmentMutation.isPending ? 'Posting...' : 'Post Adjustment JE'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK CREATE SIDE DRAWER */}
      {showQuickCreate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-white h-screen max-w-sm w-full shadow-2xl flex flex-col border-l border-slate-200/80 animate-slide-in">
            {/* Header */}
            <div className="p-4 border-b border-slate-200/80 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-xs text-slate-900 uppercase tracking-tight">Record Quick Payment</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickCreate(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-100 transition-all duration-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={submitQuickCreate} className="p-5 flex-1 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-4">
                {/* Visual feed details banner */}
                <div className="bg-indigo-50/50 border border-indigo-200/50 rounded-2xl p-3.5 text-xs text-indigo-950 space-y-1">
                  <span className="font-bold block tracking-tight">
                    {quickCreateTxns.length > 1 ? `${quickCreateTxns.length} Selected Items:` : 'Statement Line Item Details:'}
                  </span>
                  {quickCreateTxns.length === 1 ? (
                    <>
                      <div className="font-semibold">{quickCreateTxns[0].description}</div>
                      <div className="font-mono font-bold mt-1.5 text-indigo-700">
                        {quickCreateTxns[0].type === 'debit' ? '-' : '+'}{formatNaira(quickCreateTxns[0].amount)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Bank Date: {new Date(quickCreateTxns[0].date).toLocaleDateString('en-GB')}
                      </div>
                    </>
                  ) : (
                    <div className="space-y-1 max-h-[120px] overflow-y-auto">
                      {quickCreateTxns.slice(0, 10).map((t: any) => (
                        <div key={t.id} className="flex items-center justify-between text-[10px]">
                          <span className="truncate mr-2">{t.description}</span>
                          <span className="font-mono font-semibold shrink-0">{t.type === 'debit' ? '-' : '+'}{formatNaira(t.amount)}</span>
                        </div>
                      ))}
                      {quickCreateTxns.length > 10 && (
                        <div className="text-[10px] text-slate-400">...and {quickCreateTxns.length - 10} more</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Form fields layout */}
                <div className="space-y-3.5">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Journal Classification type
                    </label>
                    <select
                      value={quickCreateForm.type}
                      onChange={(e) => setQuickCreateForm({ ...quickCreateForm, type: e.target.value as any })}
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow bg-white text-slate-800"
                    >
                      {quickCreateTxns.some((t: any) => t.type === 'debit') ? (
                        <>
                          <option value="expense">Direct Corporate Expense / Outflow</option>
                          <option value="payment_made">Account Payable Settlement</option>
                        </>
                      ) : (
                        <>
                          <option value="payment_received">Client Invoice Deposit / Inflow</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Journal Category Account (GL Mapping)
                    </label>
                    <AccountSearchSelect
                      accounts={
                        quickCreateForm.type === 'expense' ? glAccounts.filter((acc: any) => acc.type === 'expense' || acc.type === 'liability') :
                        quickCreateForm.type === 'payment_made' ? glAccounts.filter((acc: any) => acc.type === 'liability' || acc.type === 'expense') :
                        quickCreateForm.type === 'payment_received' ? glAccounts.filter((acc: any) => acc.type === 'revenue' || acc.type === 'asset' || acc.type === 'income') :
                        quickCreateForm.type === 'transfer' ? glAccounts.filter((acc: any) => acc.type === 'asset' || acc.code?.startsWith('10')) :
                        []
                      }
                      value={quickCreateForm.accountId}
                      onChange={id => setQuickCreateForm({ ...quickCreateForm, accountId: id })}
                      placeholder="-- Choose target General Ledger account --"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      This selects the double-entry matching leg on general ledger records.
                    </p>
                  </div>

                  {/* Vendor for payment_made */}
                  {quickCreateForm.type === 'payment_made' && (
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1 font-sans">
                        Vendor (Optional)
                      </label>
                      <select
                        value={quickCreateForm.contactId}
                        onChange={(e) => setQuickCreateForm({ ...quickCreateForm, contactId: e.target.value })}
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow bg-white text-slate-800"
                      >
                        <option value="">-- No linked vendor --</option>
                        {vendors.map((c: any) => (
                          <option key={c.id} value={c.id}>
                            {c.fullName || c.name || 'Anonymous Vendor'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Association with client/customer */}
                  {quickCreateForm.type === 'payment_received' && (
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1 font-sans">
                        Paying Client (Optional)
                      </label>
                      <select
                        value={quickCreateForm.contactId}
                        onChange={(e) => setQuickCreateForm({ ...quickCreateForm, contactId: e.target.value })}
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow bg-white text-slate-800"
                      >
                        <option value="">-- No linked contact / public deposit --</option>
                        {customers.map((c: any) => (
                          <option key={c.id} value={c.id}>
                            {c.fullName || c.name || 'Anonymous Client'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Open bills selection for payment_made */}
                  {quickCreateForm.type === 'payment_made' && quickCreateForm.contactId && openBills.length > 0 && (
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Allocate Payment to Bills
                      </label>
                      <div className="border border-slate-200 rounded-xl p-2 max-h-[160px] overflow-y-auto space-y-1">
                        {openBills.map((bill: any) => (
                          <label key={bill.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={selectedAllocations.includes(bill.id)}
                              onChange={() => {
                                setSelectedAllocations((prev) =>
                                  prev.includes(bill.id)
                                    ? prev.filter((id) => id !== bill.id)
                                    : [...prev, bill.id]
                                );
                              }}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="flex-1 truncate">{bill.billNumber || 'Bill'}</span>
                            <span className="font-mono text-indigo-600 font-semibold">{formatNaira(bill.balanceDue)}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Open invoices selection for payment_received */}
                  {quickCreateForm.type === 'payment_received' && quickCreateForm.contactId && openInvoices.length > 0 && (
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Allocate Payment to Invoices
                      </label>
                      <div className="border border-slate-200 rounded-xl p-2 max-h-[160px] overflow-y-auto space-y-1">
                        {openInvoices.map((inv: any) => (
                          <label key={inv.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={selectedAllocations.includes(inv.id)}
                              onChange={() => {
                                setSelectedAllocations((prev) =>
                                  prev.includes(inv.id)
                                    ? prev.filter((id) => id !== inv.id)
                                    : [...prev, inv.id]
                                );
                              }}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="flex-1 truncate">{inv.invoiceNumber || 'Invoice'}</span>
                            <span className="font-mono text-indigo-600 font-semibold">{formatNaira(inv.balanceDue)}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Narration narration description
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={quickCreateForm.description}
                      onChange={(e) => setQuickCreateForm({ ...quickCreateForm, description: e.target.value })}
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow text-slate-800 placeholder-slate-400"
                    />
                  </div>
                </div>
              </div>

              {/* Drawer footer controls */}
              <div className="flex gap-2 bg-slate-50 p-4 border-t border-slate-200/80 max-w-sm w-full mx-[-20px] mb-[-20px] self-end mt-10">
                <button
                  type="button"
                  onClick={() => setShowQuickCreate(false)}
                  className="flex-1 py-2 text-xs font-bold border border-slate-200/80 hover:bg-slate-100 text-slate-600 rounded-xl inline-flex items-center justify-center cursor-pointer transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createRecordMutation.isPending}
                  className="flex-grow py-2 text-xs font-bold bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 transition-all duration-200 uppercase inline-flex items-center justify-center cursor-pointer"
                >
                  {createRecordMutation.isPending ? 'Syncing...' : 'Book Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default Reconciliation;
