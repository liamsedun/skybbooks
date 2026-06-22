/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Loader2, Check, Banknote, HelpCircle, Info } from 'lucide-react';
import { salesApi, bankingApi } from '../../lib/api';
import { AmountDisplay } from '../ui/AmountDisplay';
import { useCurrency } from '../../hooks/useCurrency';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../../hooks/useAuth';

interface RecordPaymentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  customerId?: string; // Prepopulated customer UUID
  invoiceId?: string;  // Prepopulated invoice UUID
  onSuccess?: () => void;
}

interface AllocationField {
  invoiceId: string;
  invoiceNumber: string;
  totalAmount: number;
  balanceDue: number;
  allocatedAmount: number;
  selected: boolean;
}

interface PaymentFormData {
  customerId: string;
  date: string;
  amount: number;
  paymentMethod: 'cash' | 'bank_transfer' | 'card' | 'cheque' | 'pos' | 'ussd';
  reference: string;
  accountId: string;
  notes: string;
  allocations: AllocationField[];
}

export function RecordPaymentDrawer({
  isOpen,
  onClose,
  customerId,
  invoiceId,
  onSuccess,
}: RecordPaymentDrawerProps) {
  const queryClient = useQueryClient();
  const { formatNaira, parseToKobo } = useCurrency();
  const { token } = useAuth();

  // Queries for dynamic selects
  const { data: customers = [], isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customers'],
    queryFn: salesApi.getCustomers,
    enabled: !!token,
  });

  const { data: bankAccounts = [], isLoading: isLoadingBankAccounts } = useQuery({
    queryKey: ['bankAccounts'],
    queryFn: bankingApi.getAccounts,
    enabled: !!token,
  });

  const { data: invoicesData, isLoading: isLoadingInvoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => salesApi.getInvoices({ limit: 100 }),
    enabled: !!token,
  });

  const allInvoices = useMemo(() => {
    if (!invoicesData) return [];
    // Can be an array directly or an object { data: [...] }
    return Array.isArray(invoicesData) ? invoicesData : (invoicesData.invoices || invoicesData.data || []);
  }, [invoicesData]);

  // Form Setup
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<PaymentFormData>({
    defaultValues: {
      customerId: customerId || '',
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      paymentMethod: 'bank_transfer',
      reference: '',
      accountId: '',
      notes: '',
      allocations: [],
    },
  });

  const selectedCustomerId = watch('customerId');
  const watchedAmount = watch('amount');
  const watchedAllocations = watch('allocations') || [];

  // Filter outstanding invoices for the selected customer
  const outstandingInvoices = useMemo(() => {
    if (!selectedCustomerId) return [];
    return allInvoices.filter((invoice: any) => {
      const matchCust = invoice.customerId === selectedCustomerId || invoice.clientName === selectedCustomerId;
      const outstanding = invoice.status === 'Unpaid' || invoice.status === 'Overdue' || invoice.status === 'sent' || invoice.status === 'partial';
      return matchCust && outstanding;
    });
  }, [selectedCustomerId, allInvoices]);

  // Handle customer change -> reload outstanding invoices list
  useEffect(() => {
    if (selectedCustomerId) {
      const fields = outstandingInvoices.map((invoice: any) => {
        const isPreselected = invoice.id === invoiceId;
        const balDue = invoice.balanceDue !== undefined ? invoice.balanceDue : (invoice.total || 0);
        return {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber || `INV-${invoice.id.substring(0, 6).toUpperCase()}`,
          totalAmount: invoice.total || 0,
          balanceDue: balDue,
          allocatedAmount: isPreselected ? balDue : 0,
          selected: isPreselected,
        };
      });
      setValue('allocations', fields);

      // Pre-fill total payment amount with total of pre-selected invoices
      const preselectedTotal = (fields as any[])
        .filter((f) => f.selected)
        .reduce((sum, f) => sum + f.balanceDue, 0);
      if (preselectedTotal > 0) {
        setValue('amount', preselectedTotal / 100);
      } else {
        setValue('amount', 0);
      }
    } else {
      setValue('allocations', []);
      setValue('amount', 0);
    }
  }, [selectedCustomerId, outstandingInvoices, invoiceId, setValue]);

  // Trigger form presets on initial mounting if details are passed
  useEffect(() => {
    if (customerId) {
      setValue('customerId', customerId);
    }
  }, [customerId, setValue]);

  // Set default bank account when loaded
  useEffect(() => {
    if (bankAccounts.length > 0) {
      const checking = bankAccounts.find((acc: any) => acc.type === 'Checking' || acc.name.toLowerCase().includes('operating'));
      setValue('accountId', checking?.id || bankAccounts[0].id);
    }
  }, [bankAccounts, setValue]);

  // Safety net: amount must always exactly equal the sum of selected allocations
  // (the backend enforces this strictly). Recompute on every allocation change so
  // the field can never silently drift out of sync, regardless of how it changed.
  useEffect(() => {
    const checkedSum = watchedAllocations
      .filter((f) => f.selected)
      .reduce((sum, f) => sum + (f.allocatedAmount || 0), 0);
    setValue('amount', checkedSum / 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(watchedAllocations.map(f => `${f.selected}:${f.allocatedAmount}`))]);

  // Handle allocation checkbox toggle
  const handleCheckboxToggle = (index: number) => {
    const current = watchedAllocations[index];
    const newSelected = !current.selected;
    
    // Update selection state
    setValue(`allocations.${index}.selected`, newSelected);
    
    if (newSelected) {
      // Auto-fill allocated amount with remaining balance if possible
      setValue(`allocations.${index}.allocatedAmount`, current.balanceDue);
    } else {
      setValue(`allocations.${index}.allocatedAmount`, 0);
    }

    // Auto-update total payment amount to matching checked total
    const currentAllocations = [...watchedAllocations];
    currentAllocations[index].selected = newSelected;
    currentAllocations[index].allocatedAmount = newSelected ? current.balanceDue : 0;
    
    const checkedSum = currentAllocations
      .filter((f) => f.selected)
      .reduce((sum, f) => sum + f.allocatedAmount, 0);
    
    setValue('amount', checkedSum / 100);
  };

  // Handle allocated amount manual override
  const handleAllocatedAmountChange = (index: number, val: string) => {
    const numericNaira = parseFloat(val) || 0;
    const koboVal = Math.round(numericNaira * 100);
    setValue(`allocations.${index}.allocatedAmount`, koboVal);

    // If greater than 0, check the select box automatically
    if (koboVal > 0) {
      setValue(`allocations.${index}.selected`, true);
    }

    // Re-sum checked amount
    const updatedAllocations = [...watchedAllocations];
    updatedAllocations[index].allocatedAmount = koboVal;
    if (koboVal > 0) {
      updatedAllocations[index].selected = true;
    }
    const checkedSum = updatedAllocations
      .filter((f) => f.selected)
      .reduce((sum, f) => sum + f.allocatedAmount, 0);

    setValue('amount', checkedSum / 100);
  };

  const createPaymentMutation = useMutation({
    mutationFn: async (data: PaymentFormData) => {
      // Format active allocations list
      const activeAllocations = data.allocations
        .filter((field) => field.selected && field.allocatedAmount > 0)
        .map((field) => ({
          invoiceId: field.invoiceId,
          amount: Math.round(field.allocatedAmount),
        }));

      if (activeAllocations.length === 0) {
        throw new Error('Please select at least one invoice and allocate payments.');
      }

      // Final payment build packet
      const payload = {
        customerId: data.customerId,
        date: data.date,
        amount: Math.round(data.amount * 100), // convert Naira back to Kobo
        paymentMethod: data.paymentMethod,
        reference: data.reference || `REF-${Math.floor(100000 + Math.random() * 900000)}`,
        accountId: data.accountId,
        notes: data.notes,
        allocations: activeAllocations,
      };

      return salesApi.createPaymentReceived(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['paymentsReceived'] });
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
      reset();
      onSuccess?.();
      onClose();
    },
  });

  const onSubmit = (data: PaymentFormData) => {
    createPaymentMutation.mutate(data);
  };

  const totalAllocatedKobo = watchedAllocations
    .filter((f) => f.selected)
    .reduce((sum, f) => sum + (f.allocatedAmount || 0), 0);

  const paymentAmountKobo = Math.round((parseFloat(watchedAmount as any) || 0) * 100);
  const unallocatedKobo = Math.max(0, paymentAmountKobo - totalAllocatedKobo);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900 z-[99]"
            onClick={onClose}
          />

          {/* Slide-out Panel container */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white border-l border-slate-100 shadow-2xl z-[100] flex flex-col"
            id="record-payment-drawer-surface"
          >
            {/* Header section */}
            <div className="h-16 px-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Record Payment</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest font-mono">Receipt Ledger entry</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg outline-none transition"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex-1 overflow-y-auto p-6 space-y-6 text-xs"
              id="record-payment-drawer-form"
            >
              {createPaymentMutation.isError && (
                <div className="p-3 bg-rose-50 text-rose-700 font-bold rounded-xl leading-relaxed">
                  ⚠️ {(createPaymentMutation.error as any)?.response?.data?.error
                    || (createPaymentMutation.error as any)?.message
                    || 'Unsuccessful posting of payment.'}
                </div>
              )}

              {/* 1. Customer Selection */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Select Customer
                </label>
                {isLoadingCustomers ? (
                  <div className="text-slate-400 flex items-center py-2">
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Loading customer list...
                  </div>
                ) : (
                  <select
                    id="payment-drawer-customer-selector"
                    {...register('customerId', { required: 'Customer selection is required.' })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 focus:bg-white focus:border-purple-600 focus:ring-1 focus:ring-purple-600 outline-none transition"
                  >
                    <option value="">-- Choose active customer --</option>
                    {customers.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.email ? `(${c.email})` : ''}
                      </option>
                    ))}
                  </select>
                )}
                {errors.customerId && (
                  <span className="text-rose-600 font-bold mt-1 block">{errors.customerId.message}</span>
                )}
              </div>

              {/* 2. Core Payment Details Block */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    id="payment-drawer-date-picker"
                    {...register('date', { required: 'Date is required.' })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold text-slate-700 bg-slate-50 focus:bg-white focus:border-purple-600 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                    Payment Method
                  </label>
                  <select
                    id="payment-drawer-method-selector"
                    {...register('paymentMethod')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 focus:bg-white focus:border-purple-600 outline-none transition"
                  >
                    <option value="bank_transfer">Direct Bank Transfer</option>
                    <option value="cash">Cash In Hand</option>
                    <option value="card">Card Payment</option>
                    <option value="pos">POS Terminal</option>
                    <option value="cheque">Banker Cheque</option>
                    <option value="ussd">USSD Code</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                    Reference Ticket #
                  </label>
                  <input
                    type="text"
                    id="payment-drawer-ref-input"
                    placeholder="e.g. TXN-94025"
                    {...register('reference')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold text-slate-700 bg-slate-50 focus:bg-white focus:border-purple-600 outline-none transition placeholder-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                    Deposit Into Account
                  </label>
                  <select
                    id="payment-drawer-account-selector"
                    {...register('accountId', { required: 'Please specify active account.' })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 focus:bg-white focus:border-purple-600 outline-none transition"
                  >
                    {bankAccounts.map((acc: any) => (
                      <option key={acc.id} value={acc.accountId}>
                        {acc.name} ({formatNaira(acc.currentBalance || acc.balance || 0)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. Total Received Box */}
              <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-100">
                <label className="block text-[10px] font-extrabold text-purple-700 uppercase tracking-widest mb-1.5">
                  Amount Received (NGN) — auto-calculated from allocations below
                </label>
                <div className="relative">
                  <span className="font-sans font-bold text-slate-500 absolute left-3.5 top-2 ml-0.5">₦</span>
                  <input
                    type="number"
                    step="0.01"
                    id="payment-drawer-amount-input"
                    readOnly
                    {...register('amount', {
                      required: 'Payment amount is required.',
                      min: { value: 0.01, message: 'Select at least one invoice and allocate an amount.' },
                    })}
                    className="w-full pl-8 pr-4 py-2 border border-purple-300 rounded-xl font-extrabold text-slate-800 bg-slate-100 cursor-not-allowed outline-none transition text-base"
                  />
                </div>
                {errors.amount && (
                  <span className="text-rose-600 font-bold mt-1 block">{errors.amount.message}</span>
                )}
                
                {/* Real-time distribution diagnostic summary line */}
                <div className="flex justify-between items-center mt-3 text-[10px] text-slate-500 font-mono">
                  <span>Allocated: {formatNaira(totalAllocatedKobo)}</span>
                  <span className={unallocatedKobo > 0 ? 'text-purple-600 font-bold' : ''}>
                    Unallocated Excess: {formatNaira(unallocatedKobo)}
                  </span>
                </div>
              </div>

              {/* 4. Invoices Allocations Stack */}
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">
                  Outstanding Bills & Invoices Allocation
                </h4>

                {!selectedCustomerId ? (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 font-medium">
                    Please select a customer to view active outstanding balances.
                  </div>
                ) : isLoadingInvoices ? (
                  <div className="flex items-center justify-center p-6">
                    <Loader2 className="w-5 h-5 text-purple-600 animate-spin mr-2" /> Loading invoices list...
                  </div>
                ) : watchedAllocations.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 font-medium">
                    No active unpaid or overdue invoices found for this customer.
                  </div>
                ) : (
                  <div className="space-y-3" id="payment-allocations-table">
                    {watchedAllocations.map((field, index) => {
                      return (
                        <div
                          key={field.invoiceId}
                          className={`p-3 rounded-xl border transition flex items-center justify-between ${
                            field.selected
                              ? 'bg-emerald-50/20 border-emerald-250/60'
                              : 'bg-white border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          {/* Left: toggler checkbox + details */}
                          <div className="flex items-start space-x-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={field.selected}
                              onChange={() => handleCheckboxToggle(index)}
                              className="mt-1 h-3.5 w-3.5 text-purple-650 border-slate-300 rounded focus:ring-purple-600"
                            />
                            <div className="min-w-0">
                              <h5 className="font-extrabold text-slate-700 font-mono truncate">
                                {field.invoiceNumber}
                              </h5>
                              <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5 font-mono">
                                Dev. Balance: {formatNaira(field.balanceDue)}
                              </p>
                            </div>
                          </div>

                          {/* Right: cash override input */}
                          <div className="text-right shrink-0 relative max-w-[120px]">
                            <span className="text-[10px] font-mono text-emerald-600 absolute left-2 top-2">₦</span>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={field.allocatedAmount ? (field.allocatedAmount / 100).toFixed(2) : ''}
                              onChange={(e) => handleAllocatedAmountChange(index, e.target.value)}
                              className="w-full pl-5 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-right font-bold text-slate-700 focus:bg-white focus:border-purple-600 outline-none text-xs transition"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 5. Notes */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Audit Notes
                </label>
                <textarea
                  rows={2}
                  id="payment-drawer-notes-area"
                  placeholder="Allocate payment reference, corporate check details, or other info here..."
                  {...register('notes')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold text-slate-700 bg-slate-50 focus:bg-white focus:border-purple-600 outline-none transition placeholder-slate-400"
                />
              </div>
            </form>

            {/* Bottom Sticky Action Panel */}
            <div className="p-4 border-t border-slate-50 bg-slate-50 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 border border-slate-200 text-slate-650 bg-white hover:bg-slate-50 font-bold rounded-xl outline-none transition"
              >
                Discard
              </button>
              
              <button
                type="button"
                disabled={createPaymentMutation.isPending}
                onClick={handleSubmit(onSubmit)}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-extrabold rounded-xl shadow-md outline-none transition flex items-center justify-center cursor-pointer min-w-[140px]"
              >
                {createPaymentMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Posting entry...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-1.5 text-purple-200" />
                    Save Payment
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
export default RecordPaymentDrawer;


