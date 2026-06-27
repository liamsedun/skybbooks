/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bankingApi } from '../../lib/api';
import { useCurrency } from '../../hooks/useCurrency';
import { useAuth } from '../../hooks/useAuth';
import { FlutterwaveConnectButton } from '../../components/banking/FlutterwaveConnectButton';
import { CsvImportModal } from '../../components/ui/CsvImportModal';
import { CSV_TEMPLATES, downloadCsv } from '../../lib/csvTemplates';
import { AccountSearchSelect } from '../../components/ui/AccountSearchSelect';
import {
  Plus,
  RefreshCw,
  Wallet,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Trash2,
  X,
  Building,
  CreditCard as CardIcon,
  ArrowRight,
  UploadCloud,
  FileUp,
  Loader2,
  Download,
  Database,
  Edit3
} from 'lucide-react';

interface BankAccountsProps {
  onNavigate: (viewId: string, accountId?: string) => void;
}

// Sub-component to fetch and render the unreconciled badge for each account dynamically
function UnreconciledBadge({ accountId, onClick }: { accountId: string; onClick: () => void }) {
  const { data: txns = [] } = useQuery({
    queryKey: ['bankingTransactions', accountId],
    queryFn: () => bankingApi.getTransactions(accountId, { status: 'unreconciled' }),
    staleTime: 5000,
  });

  const count = txns.filter((t: any) => t.status === 'unreconciled').length;

  if (count === 0) {
    return (
      <div className="flex items-center gap-1 text-[11px] font-sans font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
        <CheckCircle2 className="w-3 h-3" />
        <span>Reconciled</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-[11px] font-sans font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 hover:text-amber-800 px-2 py-1 rounded-full transition-colors cursor-pointer group"
    >
      <AlertCircle className="w-3 h-3 text-amber-500 animate-pulse" />
      <span>{count} Unreconciled</span>
      <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-2px] group-hover:translate-x-0" />
    </button>
  );
}

export function BankAccounts({ onNavigate }: BankAccountsProps) {
  const queryClient = useQueryClient();
  const { formatNaira } = useCurrency();
  const { token } = useAuth();

  const [showConnectModal, setShowConnectModal] = useState(false);
  const [editAccount, setEditAccount] = useState<any | null>(null);
  const [connectMethod, setConnectMethod] = useState<'select' | 'mono' | 'manual'>('select');
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Statement Upload States
  const [selectedUploadAccountId, setSelectedUploadAccountId] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [statementFile, setStatementFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Opening Balance States
  const [importOpen, setImportOpen] = useState(false);
  const [balanceModalOpen, setBalanceModalOpen] = useState(false);
  const [balanceForm, setBalanceForm] = useState({ bankAccountId: '', openingBalance: '' });
  const [balanceSuccess, setBalanceSuccess] = useState<string | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  // Form states for manual add
  const [manualForm, setManualForm] = useState({
    name: '',
    bankName: '',
    accountNumber: '',
    currentBalance: '',
    accountId: '', // GL cash ledger account ID
    type: 'Checking' as 'Checking' | 'Savings' | 'Credit Card'
  });

  // 1. Fetch connected bank accounts from DB
  const { data: bankAccounts = [], isLoading, refetch } = useQuery({
    queryKey: ['bankAccounts'],
    queryFn: bankingApi.getAccounts,
    enabled: !!token,
  });

  // 2. Fetch general ledger Cash Accounts to pair with
  const { data: glAccounts = [] } = useQuery({
    queryKey: ['glCashAccounts'],
    queryFn: bankingApi.getGLAccounts,
    enabled: !!token,
  });

  // Filter accounts list to find standard cash/asset accounts (usually code starts with '1' or asset type)
  const cashGLAccounts = glAccounts.filter(
    (acc: any) => acc.type === 'asset' || acc.code?.startsWith('10')
  );

  // 3. Register a manual bank account mutation
  const createAccountMutation = useMutation({
    mutationFn: bankingApi.createAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
      setShowConnectModal(false);
      resetManualForm();
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to register account.');
    }
  });

  // 3b. Update bank account mutation
  const updateAccountMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => bankingApi.updateAccount(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
      setEditAccount(null);
      setShowConnectModal(false);
      setErrorMessage(null);
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to update account.');
    }
  });

  // 4. Sync bank feed mutation
  const syncAccountMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => bankingApi.syncAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['bankingTransactions'] });
    },
    onError: (err: any) => {
      alert(`Sync failed: ${err.message}`);
    },
    onSettled: () => {
      setSyncingAccountId(null);
    }
  });

  // 5. Update balance mutation
  const updateBalanceMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => bankingApi.updateBalance(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
      setBalanceForm({ bankAccountId: '', openingBalance: '' });
      setBalanceError(null);
      setBalanceSuccess('Opening balance updated.');
      setTimeout(() => { setBalanceSuccess(null); setBalanceModalOpen(false); }, 2000);
    },
    onError: (err: any) => {
      setBalanceError(err?.response?.data?.message || err.message || 'Failed to update balance.');
    }
  });

  // 6. Delete/purge bank account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: bankingApi.deleteAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.message || 'Cannot delete audited accounts.');
    }
  });

  const resetManualForm = () => {
    setManualForm({
      name: '',
      bankName: '',
      accountNumber: '',
      currentBalance: '',
      accountId: '',
      type: 'Checking'
    });
    setErrorMessage(null);
  };

  const handleSyncNow = (id: string) => {
    setSyncingAccountId(id);
    syncAccountMutation.mutate({ id });
  };

  const handleDeleteAccount = (id: string, name: string) => {
    if (confirm(`Are you sure you want to deactivate and disconnect "${name}"? This will purge pending unreconciled feed records.`)) {
      deleteAccountMutation.mutate(id);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!manualForm.name.trim()) return setErrorMessage('Account display name is required.');
    if (!manualForm.bankName.trim()) return setErrorMessage('Bank name is required.');
    if (manualForm.accountNumber.length < 5) return setErrorMessage('Account number must be at least 5 digits.');
    if (!manualForm.accountId) return setErrorMessage('You must pair this with a General Ledger Cash Account.');

    const balanceNum = parseFloat(manualForm.currentBalance) || 0;
    const balanceKobo = Math.round(balanceNum * 100);

    if (editAccount) {
      updateAccountMutation.mutate({
        id: editAccount.id,
        data: {
          name: manualForm.name,
          bankName: manualForm.bankName,
          accountNumber: manualForm.accountNumber,
          currentBalance: balanceKobo,
          accountId: manualForm.accountId,
        }
      });
    } else {
      createAccountMutation.mutate({
        name: manualForm.name,
        bankName: manualForm.bankName,
        accountNumber: manualForm.accountNumber,
        currentBalance: balanceKobo,
        accountId: manualForm.accountId,
        currency: 'NGN'
      });
    }
  };

  const maskAccountNumber = (num: string) => {
    if (!num) return '****';
    const clean = num.replace(/\s+/g, '');
    if (clean.length <= 4) return clean;
    return `****${clean.slice(-4)}`;
  };

  const handleStatementFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setStatementFile(e.target.files[0]);
      setUploadError(null);
      setUploadSuccess(null);
    }
  };

  const handleStatementUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUploadAccountId || !statementFile) {
      setUploadError('Please select a valid CSV or PDF bank statement file first.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', statementFile);

      const res = await bankingApi.uploadStatement(selectedUploadAccountId, formData);
      setUploadSuccess(res.message || 'Successfully uploaded and parsed bank statement!');
      setStatementFile(null);
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
      refetch();
      setTimeout(() => {
        setShowUploadModal(false);
        setUploadSuccess(null);
      }, 3000);
    } catch (err: any) {
      setUploadError(err.response?.data?.message || err.message || 'Statement parsing failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const getBankColor = (bankName: string) => {
    const name = bankName.toLowerCase();
    if (name.includes('gtb') || name.includes('guaranty')) return 'border-orange-500 bg-orange-50 text-orange-600';
    if (name.includes('zenith')) return 'border-red-600 bg-red-50 text-red-600';
    if (name.includes('access')) return 'border-orange-600 bg-orange-50/50 text-orange-700';
    if (name.includes('kuda')) return 'border-emerald-500 bg-emerald-50 text-emerald-600';
    if (name.includes('stanbic')) return 'border-blue-600 bg-blue-50 text-blue-600';
    return 'border-indigo-500 bg-indigo-50 text-indigo-600';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-1 lg:p-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 font-sans tracking-tight">Bank Accounts</h1>
          <p className="text-xs text-slate-500 mt-1 font-sans">
            Connect corporate bank accounts to automatically stream transactions into your SkyBooks accounting ledger.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Download size={14} />
            Import Opening Balances
          </button>
          <button
            onClick={() => { setBalanceForm({ bankAccountId: '', openingBalance: '' }); setBalanceError(null); setBalanceSuccess(null); setBalanceModalOpen(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Database size={14} />
            Record Opening Balance
          </button>
          <button
            id="btn-add-bank-account"
            onClick={() => {
              setConnectMethod('select');
              setShowConnectModal(true);
            }}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors cursor-pointer self-start sm:self-center font-sans shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Connect Account</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
          <p className="font-sans text-xs text-slate-500">Querying registered banking accounts feed...</p>
        </div>
      ) : bankAccounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white border border-slate-100 rounded-xl shadow-sm text-center">
          <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center mb-4 text-orange-500">
            <Wallet className="w-6 h-6" />
          </div>
          <h3 className="font-sans font-bold text-slate-950 text-sm mb-1.5">No Connected Bank Accounts</h3>
          <p className="font-sans text-xs text-slate-500 max-w-sm mx-auto mb-5 leading-relaxed">
            Link corporate bank feeds now using Flutterwave, or record a manual ledger account to run automated reconciliation checkups.
          </p>
          <button
            onClick={() => {
              setConnectMethod('select');
              setShowConnectModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-4.5 py-2 text-xs font-bold bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Connect First Account
          </button>
        </div>
      ) : (
        /* Accounts Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" id="bank-accounts-grid">
          {bankAccounts.map((account: any) => {
            const hasMono = !!account.monoAccountId;
            const logoColorClass = getBankColor(account.bankName);

            return (
              <div
                key={account.id}
                id={`bank-account-card-${account.id}`}
                className="bg-white border border-slate-200/80 rounded-xl overflow-hidden hover:border-slate-300 transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between"
              >
                {/* Upper Body */}
                <div className="p-5 space-y-4">
                  {/* Account Metadata Row */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-lg border flex items-center justify-center text-xs font-bold leading-none shrink-0 ${logoColorClass}`}>
                        {account.bankName ? account.bankName.substring(0, 2).toUpperCase() : 'BK'}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-sans font-bold text-slate-900 text-xs truncate" title={account.name}>
                          {account.name}
                        </h3>
                        <p className="font-sans text-[10px] text-slate-400 font-medium">
                          {account.bankName} • {maskAccountNumber(account.accountNumber)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditAccount(account);
                          setManualForm({
                            name: account.name || '',
                            bankName: account.bankName || '',
                            accountNumber: account.accountNumber || '',
                            currentBalance: account.currentBalance ? String(account.currentBalance / 100) : '',
                            accountId: account.accountId || '',
                            type: account.type || 'Checking'
                          });
                          setErrorMessage(null);
                          setShowConnectModal(true);
                        }}
                        className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-slate-50 transition"
                        title="Edit Account"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAccount(account.id, account.name)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-slate-50 transition"
                        title="Deactivate Account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Account Balance Display */}
                  <div>
                    <label className="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Current Bank balance
                    </label>
                    <div className="font-sans font-bold text-slate-900 text-lg lg:text-xl">
                      {formatNaira(account.currentBalance || 0)}
                    </div>
                  </div>

                  {/* Sync Status Badge Row */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                    <div className="text-[10px] text-slate-400 font-sans">
                      {account.lastSyncedAt ? (
                        <span>Synced {new Date(account.lastSyncedAt).toLocaleDateString('en-GB')}</span>
                      ) : (
                        <span>Never synced</span>
                      )}
                    </div>

                    {/* Reconciliation Counter Badge */}
                    <UnreconciledBadge
                      accountId={account.id}
                      onClick={() => onNavigate('reconciliation', account.id)}
                    />
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 font-sans">
                    {hasMono ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        Live Feed Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                        Manual Feed
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {/* If Flutterwave linked, show 'Sync Now' / Otherwise show FlutterwaveConnectButton */}
                    {hasMono ? (
                      <button
                        type="button"
                        disabled={syncingAccountId === account.id}
                        onClick={() => handleSyncNow(account.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight text-indigo-600 border border-indigo-100 hover:bg-indigo-50 bg-white rounded transition cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${syncingAccountId === account.id ? 'animate-spin' : ''}`} />
                        <span>Sync Feed</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <FlutterwaveConnectButton
                          bankAccountId={account.id}
                          onSuccess={() => {
                            queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
                            refetch();
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUploadAccountId(account.id);
                            setShowUploadModal(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold font-sans uppercase tracking-tight border border-slate-250 hover:bg-slate-50 bg-white text-slate-700 rounded transition cursor-pointer"
                        >
                          <UploadCloud className="w-3 h-3 text-indigo-500" />
                          <span>Upload Stmt</span>
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => onNavigate('reconciliation', account.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold font-sans uppercase tracking-tight bg-slate-900 text-white rounded hover:bg-black transition cursor-pointer"
                    >
                      Reconcile
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Connection Drawer/Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 font-sans">
            {/* Modal Header */}
            <div className="bg-slate-50 p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-800 uppercase tracking-tight">{editAccount ? 'Edit Bank Account' : 'Connect Corporate Account'}</h3>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition"
                onClick={() => {
                  setShowConnectModal(false);
                  setEditAccount(null);
                  resetManualForm();
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selection Step */}
            {connectMethod === 'select' && (
              <div className="p-6 space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Select how you would like to pair. Integrating your accounts guarantees instant transaction importing.
                </p>

                <div className="grid grid-cols-1 gap-3">
                  <button
                    type="button"
                    onClick={() => setConnectMethod('manual')}
                    className="p-4 border border-slate-200/80 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50 rounded-xl text-left transition-all duration-150 flex items-start gap-3.5 group"
                  >
                    <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                      <Plus className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 group-hover:text-indigo-600 transition-colors">Add Account Manually</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                        Record account details manually and upload or input statement line items for checking.
                      </p>
                    </div>
                  </button>

                  <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/20 text-left flex items-start gap-3.5">
                    <div className="w-10 h-10 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center shrink-0">
                      <Building className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-xs text-slate-900">Direct Banking feed (Flutterwave)</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-normal mb-2.5">
                        First add account holder specifics manually, then trigger the Flutterwave popup popup to map statement streams.
                      </p>
                      <button
                        type="button"
                        onClick={() => setConnectMethod('manual')}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase rounded"
                      >
                        Start Setup
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Manual Form Setup */}
            {connectMethod === 'manual' && (
              <form onSubmit={handleManualSubmit} className="p-6 space-y-4">
                {errorMessage && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-lg text-xs leading-normal font-sans">
                    {errorMessage}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Account holder Display Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. GTB Business Escrow"
                      value={manualForm.name}
                      onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                      className="w-full text-xs font-sans border border-slate-200 focus:border-indigo-500 rounded px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none"
                    />
                  </div>

                  <div className="col-span-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Guaranty Trust Bank"
                      value={manualForm.bankName}
                      onChange={(e) => setManualForm({ ...manualForm, bankName: e.target.value })}
                      className="w-full text-xs font-sans border border-slate-200 focus:border-indigo-500 rounded px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none"
                    />
                  </div>

                  <div className="col-span-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Account Type
                    </label>
                    <select
                      value={manualForm.type}
                      onChange={(e) => setManualForm({ ...manualForm, type: e.target.value as any })}
                      className="w-full text-xs font-sans border border-slate-200 focus:border-indigo-500 rounded px-3 py-1.5 bg-white text-slate-800 focus:outline-none"
                    >
                      <option value="Checking">Checking</option>
                      <option value="Savings">Savings</option>
                      <option value="Credit Card">Credit Card</option>
                    </select>
                  </div>

                  <div className="col-span-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Account Number
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={10}
                      placeholder="10 Digits"
                      value={manualForm.accountNumber}
                      onChange={(e) => setManualForm({ ...manualForm, accountNumber: e.target.value.replace(/\D/g, '') })}
                      className="w-full text-xs font-sans border border-slate-200 focus:border-indigo-500 rounded px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none"
                    />
                  </div>

                  <div className="col-span-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Opening ledger Balance (₦)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={manualForm.currentBalance}
                      onChange={(e) => setManualForm({ ...manualForm, currentBalance: e.target.value })}
                      className="w-full text-xs font-sans border border-slate-200 focus:border-indigo-500 rounded px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Pair with General Ledger Cash Asset Account
                    </label>
                    <AccountSearchSelect
                      accounts={cashGLAccounts}
                      value={manualForm.accountId}
                      onChange={id => setManualForm({ ...manualForm, accountId: id })}
                      placeholder="-- Choose General Ledger Target Account --"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Double-entry transactions matching this bank feed will book to this Cash GL ledger line.
                    </p>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex gap-2 border-t border-slate-100 pt-4 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setConnectMethod('select');
                      setEditAccount(null);
                      resetManualForm();
                    }}
                    className="flex-1 py-2 text-xs font-bold border border-slate-200 hover:bg-slate-50 text-slate-600 rounded cursor-pointer"
                  >
                    Go Back
                  </button>
                  <button
                    type="submit"
                    disabled={createAccountMutation.isPending}
                    className="flex-grow py-2 text-xs font-bold bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors uppercase cursor-pointer"
                  >
                    {createAccountMutation.isPending || updateAccountMutation.isPending ? 'Saving...' : editAccount ? 'Update Account' : 'Register Account'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MANUAL BANK STATEMENT UPLOADER MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 font-sans">
            {/* Header */}
            <div className="bg-slate-50 p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 bg-indigo-600 text-white font-extrabold flex items-center justify-center rounded-lg text-xs">S</span>
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">Upload Bank Statement</h3>
              </div>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 cursor-pointer outline-none"
                onClick={() => {
                  setShowUploadModal(false);
                  setStatementFile(null);
                  setUploadError(null);
                  setUploadSuccess(null);
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleStatementUploadSubmit} className="p-5 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Provide a digital <b>.CSV</b> or <b>.PDF</b> copy of your corporate bank statement to instantly load transactions into your SkyBooks accounting ledger.
              </p>

              {/* Drag & Drop Canvas */}
              <div 
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                  statementFile 
                    ? 'border-emerald-500 bg-emerald-50/20' 
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    setStatementFile(e.dataTransfer.files[0]);
                    setUploadError(null);
                    setUploadSuccess(null);
                  }
                }}
              >
                <input
                  type="file"
                  id="statement-file-input"
                  className="hidden"
                  accept=".csv,.pdf"
                  onChange={handleStatementFileChange}
                />
                
                <label htmlFor="statement-file-input" className="cursor-pointer block space-y-2">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-2">
                    <FileUp className="w-5 h-5 text-indigo-500" />
                  </div>
                  {statementFile ? (
                    <div>
                      <p className="text-xs font-bold text-slate-800 font-mono truncate max-w-xs">{statementFile.name}</p>
                      <p className="text-[10px] text-emerald-600 font-bold mt-1 uppercase">Ready to scan & parse • {(statementFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-bold text-slate-700">Drag statement file here, or click to browse</p>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase">Supports CSV & PDF (up to 10MB)</p>
                    </div>
                  )}
                </label>
              </div>

              {/* Success / Error states */}
              {uploadSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-xs font-semibold flex items-start gap-2 leading-relaxed">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{uploadSuccess}</span>
                </div>
              )}

              {uploadError && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-800 text-xs font-semibold flex items-start gap-2 leading-relaxed">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  className="flex-1 py-2.5 font-sans font-bold text-xs border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 cursor-pointer"
                  onClick={() => {
                    setShowUploadModal(false);
                    setStatementFile(null);
                    setUploadError(null);
                    setUploadSuccess(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !statementFile}
                  className="flex-1 py-2.5 font-sans font-bold text-xs bg-indigo-600 rounded-xl text-white hover:bg-slate-900 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:bg-indigo-300"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Parsing statement...
                    </>
                  ) : (
                    'Extract & Sync'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {importOpen && (
        <CsvImportModal
          entity="bankOpeningBalances"
          endpoint="/banking/accounts/import-opening-balances"
          onClose={() => setImportOpen(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['bankAccounts'] })}
          transformRow={(row, headers) => {
            const map: Record<string, string> = {};
            headers.forEach((h, i) => { map[h.toLowerCase().trim()] = row[i]?.trim() || ''; });
            return {
              bankIdentifier: map['bankname (or accountnumber)'] || map['bankname'] || '',
              openingBalance: map['openingbalance (ngn)'] || map['openingbalance'] || '0',
            };
          }}
        />
      )}

      {balanceModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900">Record Opening Balance</h2>
              <button onClick={() => setBalanceModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            {balanceSuccess && (
              <div className="flex items-center gap-2 px-3 py-2 mb-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg">
                <CheckCircle2 size={14} /> {balanceSuccess}
              </div>
            )}
            {balanceError && (
              <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 mb-3">{balanceError}</div>
            )}
            <form onSubmit={(e) => {
              e.preventDefault();
              const balanceKobo = Math.round(parseFloat(balanceForm.openingBalance || '0') * 100);
              updateBalanceMutation.mutate({ id: balanceForm.bankAccountId, data: { currentBalance: balanceKobo } });
            }} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Bank Account</label>
                <select
                  value={balanceForm.bankAccountId}
                  onChange={(e) => setBalanceForm({ ...balanceForm, bankAccountId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                >
                  <option value="">Select account...</option>
                  {bankAccounts.map((acc: any) => (
                    <option key={acc.id} value={acc.id}>{acc.name} ({acc.bankName} • ****{acc.accountNumber?.slice(-4)})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Opening Balance (₦)</label>
                <input type="number" step="0.01" min="0" value={balanceForm.openingBalance}
                  onChange={(e) => setBalanceForm({ ...balanceForm, openingBalance: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setBalanceModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                <button type="submit" disabled={updateBalanceMutation.isPending || !balanceForm.bankAccountId || !balanceForm.openingBalance}
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50">
                  {updateBalanceMutation.isPending ? 'Saving...' : 'Save Balance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default BankAccounts;
