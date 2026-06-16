/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Plus,
  Trash2,
  ChevronDown,
  Info,
  ArrowLeft,
  X,
  CreditCard,
  Save,
  Check,
  Send,
  Loader2,
  AlertCircle,
  PlusCircle,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { salesApi, bankingApi } from '../../lib/api';
import { useCurrency } from '../../hooks/useCurrency';
import { AmountDisplay } from '../../components/ui/AmountDisplay';
import { useAuth } from '../../hooks/useAuth';

interface InvoiceFormProps {
  invoiceId?: string; // If present, we are in Edit Mode
  onNavigate: (viewId: string) => void;
}

// Zod schema matching custom corporate backend constraints
const invoiceFormZodSchema = z.object({
  customerId: z.string().min(1, 'Please select a customer.'),
  invoiceNumber: z.string().min(1, 'Invoice number is required.'),
  date: z.string().min(1, 'Invoice date is required.'),
  dueDate: z.string().min(1, 'Due date is required.'),
  paymentTerms: z.string(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  lines: z.array(
    z.object({
      itemId: z.string().optional().nullable(),
      description: z.string().min(1, 'Line description is required.'),
      quantity: z.number().positive('Quantity must be greater than zero.'),
      unitPrice: z.number().positive('Price must be greater than zero.'), // edited in Naira float, will be scaled in submit handler
      discountPct: z.number().min(0).max(105).optional(),
      taxRate: z.number().min(0).optional(), // Nigerian VAT defaults to 7.5%
      accountId: z.string().optional().nullable(),
    })
  ).min(1, 'Invoice must contain at least one line item.'),
});

type InvoiceFormValues = z.infer<typeof invoiceFormZodSchema>;

// Seed options for service items dropdown catalog
const SERVICE_CATALOG = [
  { id: '1', name: 'Software Development & Integration Consulting', price: 950000.0, accountId: 'revenue-01' },
  { id: '2', name: 'Broadband Core Fiber Subscriptions', price: 120000.0, accountId: 'revenue-02' },
  { id: '3', name: 'Server Deployment & Cloud Provisioning', price: 450000.0, accountId: 'revenue-03' },
  { id: '4', name: 'Database Maintenance Advisory', price: 250000.0, accountId: 'revenue-04' },
];

export function InvoiceForm({ invoiceId, onNavigate }: InvoiceFormProps) {
  const queryClient = useQueryClient();
  const { formatNaira } = useCurrency();

  // 1. Core Component States
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [addCustomerError, setAddCustomerError] = useState('');

  // Draft banner recovery helper
  const [draftBannerVisible, setDraftBannerVisible] = useState(false);

  // 2. React Query for customers & bank accounts selection
  const { token } = useAuth();

  const { data: customers = [], isLoading: isLoadingCustomers, refetch: refetchCustomers } = useQuery({
    queryKey: ['customers'],
    queryFn: salesApi.getCustomers,
    enabled: !!token,
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bankAccounts'],
    queryFn: bankingApi.getAccounts,
    enabled: !!token,
  });

  // 3. Edit mode load data query
  const { data: editingInvoice, isLoading: isLoadingInvoiceData } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => salesApi.getInvoice(invoiceId!),
    enabled: !!invoiceId && !!token,
  });

  // 4. Form Initialization with React Hook Form
  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors, isDirty, isValid },
  } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormZodSchema),
    mode: 'onChange',
    defaultValues: {
      customerId: '',
      invoiceNumber: `INV-${Math.floor(10000 + Math.random() * 90000)}`,
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      paymentTerms: '30',
      notes: '',
      terms: 'Payments must be completed within the specified corporate invoice terms. 5% WHT is applicable.',
      lines: [
        {
          itemId: '',
          description: 'Consulting Advisory Services',
          quantity: 1,
          unitPrice: 150000.0,
          discountPct: 0,
          taxRate: 7.5,
          accountId: '',
        },
      ],
    },
  });

  // Field arrays controller for invoice lines
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'lines',
  });

  // Watch field values for real-time calculations
  const watchedCustomerId = watch('customerId');
  const watchedInvoiceDate = watch('date');
  const watchedPaymentTerms = watch('paymentTerms');
  const watchedLines = watch('lines') || [];

  // 5. Automatic terms date calculation helper
  useEffect(() => {
    if (watchedInvoiceDate && watchedPaymentTerms !== 'custom') {
      const days = parseInt(watchedPaymentTerms, 10);
      if (!isNaN(days)) {
        const baseDate = new Date(watchedInvoiceDate);
        baseDate.setDate(baseDate.getDate() + days);
        setValue('dueDate', baseDate.toISOString().split('T')[0]);
      }
    }
  }, [watchedInvoiceDate, watchedPaymentTerms, setValue]);

  // 6. Form Session LocalStorage autosave draft handler
  useEffect(() => {
    // Only auto-save if in CREATE mode, not editing existing record
    if (invoiceId) return;
    
    const subscription = watch((value) => {
      localStorage.setItem('financeos_invoice_form_draft', JSON.stringify(value));
    });
    return () => subscription.unsubscribe();
  }, [watch, invoiceId]);

  // Check on mount if an autosaved draft belongs in session
  useEffect(() => {
    if (invoiceId) return; // Do not restore if editing
    const draft = localStorage.getItem('financeos_invoice_form_draft');
    if (draft) {
      setDraftBannerVisible(true);
    }
  }, [invoiceId]);

  const handleRestoreDraft = () => {
    try {
      const draft = localStorage.getItem('financeos_invoice_form_draft');
      if (draft) {
        reset(JSON.parse(draft));
      }
    } catch (e) {
      console.error('Failed to restore invoice forms draft', e);
    }
    setDraftBannerVisible(false);
  };

  const handleDismissDraft = () => {
    localStorage.removeItem('financeos_invoice_form_draft');
    setDraftBannerVisible(false);
  };

  // Populate form if in edit mode and details loaded
  useEffect(() => {
    if (editingInvoice && invoiceId) {
      // Map line items from database back to form structures
      const lines = (editingInvoice.lines || editingInvoice.items || []).map((l: any) => ({
        itemId: l.itemId || '',
        description: l.description || '',
        quantity: typeof l.quantity === 'string' ? parseFloat(l.quantity) : (l.quantity || 1),
        unitPrice: (l.unitPrice || l.price || 0) / 100, // convert kobo back to Float Naira
        discountPct: l.discountPct || 0,
        taxRate: l.taxRate !== undefined ? l.taxRate : 7.5,
        accountId: l.accountId || '',
      }));

      reset({
        customerId: editingInvoice.customerId || editingInvoice.clientName || '',
        invoiceNumber: editingInvoice.invoiceNumber || `INV-${editingInvoice.id.substring(0,6).toUpperCase()}`,
        date: editingInvoice.date,
        dueDate: editingInvoice.dueDate,
        paymentTerms: editingInvoice.paymentTerms?.toString() || '30',
        notes: editingInvoice.notes || '',
        terms: editingInvoice.terms || '',
        lines: lines.length > 0 ? lines : [
          {
            itemId: '',
            description: '',
            quantity: 1,
            unitPrice: 0,
            discountPct: 0,
            taxRate: 7.5,
            accountId: '',
          },
        ],
      });
    }
  }, [editingInvoice, invoiceId, reset]);

  // 7. Interactive calculation of invoice amounts (VAT, Discount, Total)
  const totals = useMemo(() => {
    let subtotalKobo = 0;
    let discountTotalKobo = 0;
    let vatTotalKobo = 0;

    watchedLines.forEach((line: any) => {
      const qty = parseFloat(line?.quantity as any) || 0;
      const priceNaira = parseFloat(line?.unitPrice as any) || 0;
      const priceKobo = Math.round(priceNaira * 100);
      const discountPct = parseFloat(line?.discountPct as any) || 0;
      const taxRate = parseFloat(line?.taxRate as any) || 0;

      const baseAmountKobo = qty * priceKobo;
      const lineDiscountKobo = Math.round((baseAmountKobo * discountPct) / 100);
      const discountedAmountKobo = baseAmountKobo - lineDiscountKobo;
      const lineVatKobo = Math.round((discountedAmountKobo * taxRate) / 100);

      subtotalKobo += baseAmountKobo;
      discountTotalKobo += lineDiscountKobo;
      vatTotalKobo += lineVatKobo;
    });

    const totalKobo = subtotalKobo - discountTotalKobo + vatTotalKobo;

    return {
      subtotalKobo,
      discountTotalKobo,
      vatTotalKobo,
      totalKobo,
    };
  }, [watchedLines]);

  // Selected customer balance analysis details
  const activeCustomerInfo = useMemo(() => {
    if (!watchedCustomerId || customers.length === 0) return null;
    return customers.find((c: any) => c.id === watchedCustomerId || c.name === watchedCustomerId);
  }, [watchedCustomerId, customers]);

  // 8. Mutations for saving and sending invoices
  const saveInvoiceMutation = useMutation({
    mutationFn: async (data: { formValues: InvoiceFormValues; saveAndSend: boolean }) => {
      const linesPayload = data.formValues.lines.map((line) => {
        const qty = parseFloat(line.quantity as any) || 1;
        const priceKobo = Math.round((parseFloat(line.unitPrice as any) || 0) * 100);
        return {
          itemId: line.itemId || null,
          description: line.description,
          quantity: qty,
          unitPrice: priceKobo,
          discountPct: parseFloat(line.discountPct as any) || 0,
          taxRate: parseFloat(line.taxRate as any) || 7.5,
          accountId: line.accountId || null,
        };
      });

      const payload = {
        customerId: data.formValues.customerId,
        invoiceNumber: data.formValues.invoiceNumber,
        date: data.formValues.date,
        dueDate: data.formValues.dueDate,
        paymentTerms: isNaN(parseInt(data.formValues.paymentTerms)) ? 30 : parseInt(data.formValues.paymentTerms),
        notes: data.formValues.notes || '',
        terms: data.formValues.terms || '',
        currency: 'NGN',
        fxRate: 1.0,
        status: data.saveAndSend ? 'sent' : (invoiceId ? editingInvoice?.status : 'draft'),
        lines: linesPayload,
      };

      if (invoiceId) {
        return salesApi.updateInvoice(invoiceId, payload);
      } else {
        return salesApi.createInvoice(payload);
      }
    },
    onSuccess: (res, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      // Remove autosave state
      localStorage.removeItem('financeos_invoice_form_draft');
      
      // Auto trigger secondary email dispatch if saveAndSend is matched
      if (variables.saveAndSend && res?.id) {
        salesApi.sendInvoice(res.id).catch(console.error);
      }
      onNavigate('invoices');
    },
  });

  const handleFormSubmission = (formValues: InvoiceFormValues, saveAndSend = false) => {
    saveInvoiceMutation.mutate({ formValues, saveAndSend });
  };

  // 9. Quick Inline Add Customer execution
  const executeAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddCustomerError('');
    setIsAddingCustomer(true);

    try {
      if (!newCustomerName) throw new Error('Customer full name is required.');
      const res = await salesApi.createCustomer({
        name: newCustomerName,
        email: newCustomerEmail,
      });

      await refetchCustomers();
      if (res?.id) {
        setValue('customerId', res.id);
      }
      setNewCustomerName('');
      setNewCustomerEmail('');
      setShowAddCustomerModal(false);
    } catch (err: any) {
      setAddCustomerError(err.message || 'Unable to register customer inline.');
    } finally {
      setIsAddingCustomer(false);
    }
  };

  // Handle service/catalog selection auto fills
  const handleCatalogSelect = (index: number, itemId: string) => {
    if (!itemId) return;
    const match = SERVICE_CATALOG.find((i) => i.id === itemId);
    if (match) {
      setValue(`lines.${index}.description`, match.name);
      setValue(`lines.${index}.unitPrice`, match.price);
    }
  };

  if (isLoadingInvoiceData && invoiceId) {
    return (
      <div className="py-24 text-center text-slate-500 text-xs flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-650 animate-spin mb-3" />
        Fetching invoice details for edit console...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" id="invoice-form-viewport">
      
      {/* Draft Recovery Alert Bubble */}
      {draftBannerVisible && (
        <div className="p-4 bg-purple-50 border border-purple-150 rounded-2xl flex items-center justify-between text-xs font-semibold text-purple-800 shadow-2xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-purple-600 animate-pulse" />
            <span>Unsaved draft invoice discovered in session memory. Reset and restore form draft?</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRestoreDraft}
              className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              Restore Draft
            </button>
            <button
              onClick={handleDismissDraft}
              className="px-2.5 py-1.5 border border-purple-200 text-purple-750 hover:bg-white rounded-lg transition"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Header and navigational row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3.5">
          <button
            onClick={() => onNavigate('invoices')}
            className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-700 rounded-xl transition outline-none"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">
              {invoiceId ? `Edit Invoice #${editingInvoice?.invoiceNumber || invoiceFormZodSchema.shape.invoiceNumber}` : 'Create Client Invoice'}
            </h2>
            <p className="text-xs text-slate-400 font-semibold tracking-wide uppercase mt-1">
              {invoiceId ? 'Revise billing thresholds' : 'Post accounts receivable entries'}
            </p>
          </div>
        </div>
      </div>

      {/* TWO COLUMN FORM LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="invoice-form-columns">
        
        {/* LEFT COLUMN: 65% Main Content */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main Information BlockCard */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-2xs space-y-5">
            <h3 className="text-xs font-black text-slate-450 uppercase tracking-widest font-mono">Invoice Core Details</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              
              {/* Customer searchable select */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Customer / Client Name
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddCustomerModal(true)}
                    className="text-[10px] font-bold text-purple-650 hover:text-purple-700 outline-none flex items-center"
                  >
                    <Plus className="w-3 h-3 mr-0.5" /> Register Client
                  </button>
                </div>

                {isLoadingCustomers ? (
                  <div className="text-xs text-slate-400 flex items-center py-2">
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Loading customer registry...
                  </div>
                ) : (
                  <select
                    id="form-customer-select"
                    {...register('customerId')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-850 rounded-lg text-xs font-semibold focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                  >
                    <option value="">-- Choose client name --</option>
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

              {/* Invoice Number */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Invoice ID Reference #
                </label>
                <input
                  type="text"
                  id="form-invoice-number-input"
                  {...register('invoiceNumber')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold font-mono text-slate-800 bg-slate-50 focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                />
                {errors.invoiceNumber && (
                  <span className="text-rose-600 font-bold mt-1 block">{errors.invoiceNumber.message}</span>
                )}
              </div>

            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-1">
              
              {/* Date */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Invoice Date
                </label>
                <input
                  type="date"
                  id="form-invoice-date-picker"
                  {...register('date')}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-semibold text-slate-700 bg-slate-50 focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                />
                {errors.date && (
                  <span className="text-rose-600 font-bold mt-1 block">{errors.date.message}</span>
                )}
              </div>

              {/* Payment Terms */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Payment Terms
                </label>
                <select
                  id="form-payment-terms-selector"
                  {...register('paymentTerms')}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-750 rounded-lg text-xs font-semibold focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                >
                  <option value="0">Due immediately (COD)</option>
                  <option value="7">Net 7 Days</option>
                  <option value="15">Net 15 Days</option>
                  <option value="30">Net 30 Days</option>
                  <option value="45">Net 45 Days</option>
                  <option value="60">Net 60 Days</option>
                  <option value="custom">Custom Due Date</option>
                </select>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Due Date
                </label>
                <input
                  type="date"
                  id="form-due-date-picker"
                  disabled={watchedPaymentTerms !== 'custom'}
                  {...register('dueDate')}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-semibold text-slate-700 bg-slate-50 disabled:opacity-60 focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                />
                {errors.dueDate && (
                  <span className="text-rose-600 font-bold mt-1 block">{errors.dueDate.message}</span>
                )}
              </div>

            </div>

          </div>

          {/* Line Items Table Block */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-50">
              <h3 className="text-xs font-black text-slate-450 uppercase tracking-widest font-mono">Invoice Lines</h3>
              <span className="text-[10px] text-slate-400 font-bold font-mono">
                {fields.length} item lines added
              </span>
            </div>

            {errors.lines && !Array.isArray(errors.lines) && (
              <div className="p-3 bg-rose-50 text-rose-700 font-bold rounded-xl flex items-center">
                ⚠️ {errors.lines.message}
              </div>
            )}

            {/* Main Interactive Table Grid */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50/70 text-[9px] text-slate-400 uppercase font-black tracking-widest font-mono border-b border-slate-100 select-none">
                    <th className="py-2.5 px-3 w-10 text-center">Reorder</th>
                    <th className="py-2.5 px-3 w-48">Service Template</th>
                    <th className="py-2.5 px-3">Line Description</th>
                    <th className="py-2.5 px-3 w-16 text-center">Qty</th>
                    <th className="py-2.5 px-3 w-28 text-right">Unit Price (₦)</th>
                    <th className="py-2.5 px-3 w-16 text-center">Disc%</th>
                    <th className="py-2.5 px-3 w-16 text-center font-mono">VAT%</th>
                    <th className="py-2.5 px-3 w-28 text-right">Line Amount</th>
                    <th className="py-2.5 px-3.5 w-10 text-center">Rem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-medium">
                  {fields.map((field, index) => {
                    // Calculating values for real-time line display preview
                    const qty = parseFloat(watchedLines[index]?.quantity as any) || 0;
                    const price = parseFloat(watchedLines[index]?.unitPrice as any) || 0;
                    const discount = parseFloat(watchedLines[index]?.discountPct as any) || 0;
                    const vatRate = parseFloat(watchedLines[index]?.taxRate as any) || 0;
                    
                    const beforeDiscountVal = qty * price;
                    const lineDiscount = (beforeDiscountVal * discount) / 100;
                    const lineVal = beforeDiscountVal - lineDiscount;
                    const lineVat = (lineVal * vatRate) / 100;
                    const finalLineValKobo = Math.round((lineVal + lineVat) * 100);

                    return (
                      <tr key={field.id} className="hover:bg-slate-50/20 group">
                        
                        {/* Drag / Move rows */}
                        <td className="py-3 px-2 text-center">
                          <div className="flex flex-col items-center justify-center -space-y-1">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => move(index, index - 1)}
                              className="p-0.5 text-slate-350 hover:text-primary disabled:opacity-30 outline-none transition"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={index === fields.length - 1}
                              onClick={() => move(index, index + 1)}
                              className="p-0.5 text-slate-350 hover:text-primary disabled:opacity-30 outline-none transition"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        {/* Catalog selector drop */}
                        <td className="py-3 px-2">
                          <select
                            onChange={(e) => handleCatalogSelect(index, e.target.value)}
                            defaultValue=""
                            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold focus:bg-white outline-none"
                          >
                            <option value="">-- Choose Template --</option>
                            {SERVICE_CATALOG.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name.substring(0, 24)}...
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Description input */}
                        <td className="py-3 px-2">
                          <input
                            type="text"
                            placeholder="Advisory services description..."
                            {...register(`lines.${index}.description` as const)}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg font-semibold focus:border-primary focus:ring-1 focus:ring-primary outline-none bg-white text-slate-800"
                          />
                          {errors.lines?.[index]?.description && (
                            <span className="text-[10px] text-rose-600 block mt-0.5 font-bold">Required</span>
                          )}
                        </td>

                        {/* Quantity */}
                        <td className="py-3 px-2">
                          <input
                            type="number"
                            min="1"
                            step="any"
                            {...register(`lines.${index}.quantity` as const, { valueAsNumber: true })}
                            className="w-full px-1.5 py-1.5 text-center border border-slate-200 rounded-lg font-bold focus:border-primary focus:ring-1 focus:ring-primary outline-none text-slate-850"
                          />
                          {errors.lines?.[index]?.quantity && (
                            <span className="text-[9px] text-rose-600 block mt-0.5 font-bold">Positive</span>
                          )}
                        </td>

                        {/* Unit Price */}
                        <td className="py-3 px-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            {...register(`lines.${index}.unitPrice` as const, { valueAsNumber: true })}
                            className="w-full px-2 py-1.5 text-right border border-slate-200 rounded-lg font-bold focus:border-primary focus:ring-1 focus:ring-primary outline-none text-slate-850"
                          />
                          {errors.lines?.[index]?.unitPrice && (
                            <span className="text-[9px] text-rose-600 block mt-0.5 font-bold">Positive</span>
                          )}
                        </td>

                        {/* Discount */}
                        <td className="py-3 px-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            {...register(`lines.${index}.discountPct` as const, { valueAsNumber: true })}
                            className="w-full px-1 py-1.5 text-center border border-slate-200 rounded-lg font-bold text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                          />
                        </td>

                        {/* VAT rate */}
                        <td className="py-3 px-2">
                          <input
                            type="number"
                            step="0.1"
                            {...register(`lines.${index}.taxRate` as const, { valueAsNumber: true })}
                            className="w-full px-1 py-1.5 text-center border border-slate-200 rounded-lg font-mono text-slate-600 font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                          />
                        </td>

                        {/* Line Amount (read-only final calculation) */}
                        <td className="py-3 px-2 text-right font-bold text-slate-800">
                          <AmountDisplay amountInKobo={finalLineValKobo} className="text-xs font-bold" />
                        </td>

                        {/* Rev / Delete row */}
                        <td className="py-3 px-2 text-center">
                          <button
                            type="button"
                            disabled={fields.length === 1}
                            onClick={() => remove(index)}
                            className="p-1 text-slate-350 hover:text-rose-600 disabled:opacity-30 rounded transition outline-none cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Append row button */}
            <button
              type="button"
              onClick={() => append({
                itemId: '',
                description: '',
                quantity: 1,
                unitPrice: 0,
                discountPct: 0,
                taxRate: 7.5,
                accountId: '',
              })}
              className="px-3.5 py-2 border border-primary/20 hover:border-primary hover:bg-primary-light/10 text-primary text-xs font-semibold rounded-lg transition flex items-center shrink-0 cursor-pointer outline-none"
            >
              <PlusCircle className="w-4.5 h-4.5 mr-1.5" /> Append Line Item
            </button>

          </div>

          {/* Audit Notes and Legal Terms Areas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-100">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Audit Notes / Client memo
              </label>
              <textarea
                rows={3}
                placeholder="Private remarks to show internally inside collections dashboards..."
                {...register('notes')}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none bg-slate-50/50 text-slate-700 transition"
              />
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Standard Corporate Payment Terms & Clauses
              </label>
              <textarea
                rows={3}
                placeholder="These standard legal clauses and bank account transfers are shown to clients..."
                {...register('terms')}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none bg-slate-50/50 text-slate-700 transition"
              />
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: 35% Sticky Summary Calculations & Action Panel */}
        <div className="space-y-6">
          
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6 lg:sticky lg:top-20" id="invoice-form-summary-sidebar">
            
            <div className="border-b border-slate-50 pb-4">
              <h3 className="text-xs font-black text-slate-450 uppercase tracking-widest font-mono">Invoice Summary</h3>
              <span className="text-[10px] text-slate-400 font-bold mt-1 block">
                Calculations are aligned to Nigerian corporate accounting rules.
              </span>
            </div>

            {/* Line items math metrics details */}
            <div className="space-y-3 text-xs font-semibold text-slate-500">
              
              <div className="flex justify-between items-center">
                <span>Subtotal (Pre-tax)</span>
                <span className="font-mono text-slate-850 font-bold">
                  {formatNaira(totals.subtotalKobo)}
                </span>
              </div>

              <div className="flex justify-between items-center text-primary bg-primary-light/50 p-1.5 rounded-lg border border-primary/25">
                <span>Direct discount total</span>
                <span className="font-mono font-black text-primary">
                  - {formatNaira(totals.discountTotalKobo)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span>Total 7.5% Nigerian VAT</span>
                <span className="font-mono text-slate-850 font-bold">
                  {formatNaira(totals.vatTotalKobo)}
                </span>
              </div>

              <div className="border-t border-slate-50 pt-4 flex justify-between items-end">
                <span className="text-slate-850 font-black">TOTAL VALUE DUE</span>
                <span className="text-xl font-black text-slate-900 tracking-tight font-mono">
                  {formatNaira(totals.totalKobo)}
                </span>
              </div>
            </div>

            {/* Active customer info box */}
            {activeCustomerInfo && (
              <div className="bg-amber-50/30 border border-amber-200/50 p-4 rounded-xl text-[11px] font-medium leading-relaxed text-amber-800">
                <h4 className="font-bold uppercase tracking-wider text-[10px] text-amber-700 mb-1">
                  Active Client Audit Bubble
                </h4>
                <p>Company Name: <strong>{activeCustomerInfo.name}</strong></p>
                <p className="mt-0.5">Corporate Email: <strong>{activeCustomerInfo.email || 'none'}</strong></p>
                <div className="h-px bg-amber-200/50 my-2" />
                <p className="text-slate-500 text-[10px]">
                  Unpaid total invoices outstanding for this corporate client is tracked under subledger controls.
                </p>
              </div>
            )}

            {/* Core Action triggers */}
            <div className="space-y-3.5 pt-4 border-t border-slate-50">
              
              {/* Reset recovery state on click */}
              <button
                type="button"
                disabled={saveInvoiceMutation.isPending || !isValid}
                onClick={handleSubmit((vals) => handleFormSubmission(vals as InvoiceFormValues, false))}
                className="w-full py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold rounded-lg transition text-xs flex items-center justify-center outline-none cursor-pointer disabled:opacity-50"
              >
                {saveInvoiceMutation.isPending ? (
                  <Loader2 className="w-4 h-4 text-primary animate-spin mr-1.5" />
                ) : (
                  <Save className="w-4 h-4 mr-1.5 text-slate-500" />
                )}
                Save draft invoice
              </button>

              <button
                type="button"
                disabled={saveInvoiceMutation.isPending || !isValid}
                onClick={handleSubmit((vals) => handleFormSubmission(vals as InvoiceFormValues, true))}
                className="w-full py-3 bg-primary hover:bg-primary-hover text-white font-semibold text-xs rounded-lg shadow-sm transition cursor-pointer flex items-center justify-center outline-none disabled:opacity-50"
              >
                {saveInvoiceMutation.isPending ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin mr-1.5" />
                ) : (
                  <Send className="w-4 h-4 mr-1.5 text-primary-light stroke-[2.5]" />
                )}
                Approve & Send to client
              </button>

              <button
                type="button"
                onClick={() => onNavigate('invoices')}
                className="w-full text-center py-2 text-slate-400 hover:text-rose-600 text-[11px] font-bold uppercase tracking-wider transition select-none outline-none"
              >
                Cancel posting
              </button>

            </div>

          </div>

        </div>

      </div>

      {/* SEARCHABLE INLINE ADD CUSTOMER LIGHT MODAL */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs select-none">
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden"
            id="inline-customer-modal-container"
          >
            <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                Register New Customer
              </h4>
              <button
                onClick={() => setShowAddCustomerModal(false)}
                className="text-slate-400 hover:text-slate-600 outline-none"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={executeAddCustomer} className="p-5 space-y-4 text-xs font-semibold">
              {addCustomerError && (
                <div className="p-3 bg-rose-50 text-rose-750 font-bold rounded-xl leading-relaxed">
                  ⚠️ {addCustomerError}
                </div>
              )}

              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest mb-1.5">
                  Business / Customer Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Aliko Container Holdings Ltd"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest mb-1.5">
                  Corporate Email
                </label>
                <input
                  type="email"
                  placeholder="accounts@alikoholdings.com"
                  value={newCustomerEmail}
                  onChange={(e) => setNewCustomerEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary text-slate-800"
                />
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 font-semibold rounded-lg transition cursor-pointer"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={isAddingCustomer}
                  className="px-5 py-2 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg transition cursor-pointer flex items-center justify-center"
                >
                  {isAddingCustomer ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    'Add Customer'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
export default InvoiceForm;
