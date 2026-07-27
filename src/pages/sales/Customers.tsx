/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, orgApi } from '../../lib/api';
import {
  Plus,
  Pencil,
  ArrowLeft,
  Users,
  Mail,
  Phone as PhoneIcon,
  MapPin,
  FileText,
  Power,
  Upload,
  Download,
  Printer,
} from 'lucide-react';
import { CsvImportModal } from '../../components/ui/CsvImportModal';
import { PageHeader } from '../../components/shared/PageHeader';
import { Button } from '../../components/shared/Button';
import { SearchBar } from '../../components/shared/SearchBar';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { EmptyState } from '../../components/shared/EmptyState';
import { TableSkeleton } from '../../components/shared/Skeleton';
import { Card } from '../../components/shared/Card';
import { FormModal } from '../../components/shared/Modal';
import { exportToCsv, exportToPdf } from '../../lib/exportUtils';

interface Customer {
  id: string;
  orgId: string;
  type: 'customer' | 'vendor' | 'both';
  customerCode?: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  taxPin: string | null;
  paymentTerms: number | null;
  creditLimit: number | null;
  balance: number;
  outstanding?: number;
  currency: string;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

type CustomerFormState = {
  customerCode: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  taxPin: string;
  paymentTerms: string;
  creditLimit: string;
  balance: string;
  notes: string;
};

const EMPTY_FORM: CustomerFormState = {
  customerCode: '',
  name: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  country: 'Nigeria',
  taxPin: '',
  paymentTerms: '',
  creditLimit: '',
  balance: '',
  notes: '',
};

function formatNaira(kobo: number | null | undefined): string {
  if (kobo === null || kobo === undefined) return '—';
  return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDual(cents: number | null | undefined, currency?: string, fxRate?: number | string | null): string {
  if (cents == null) return '—';
  const base = formatNaira(cents);
  if (currency && currency !== 'NGN' && fxRate) {
    const rate = Number(fxRate) || 1;
    const orig = cents / rate / 100;
    return `${currency} ${orig.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} • ${base}`;
  }
  return base;
}

function buildPayload(form: CustomerFormState) {
  return {
    name: form.name.trim(),
    email: form.email.trim() || null,
    phone: form.phone.trim() || null,
    address: form.address.trim() || null,
    city: form.city.trim() || null,
    state: form.state.trim() || null,
    country: form.country.trim() || 'Nigeria',
    taxPin: form.taxPin.trim() || null,
    paymentTerms: form.paymentTerms ? parseInt(form.paymentTerms, 10) : null,
    creditLimit: form.creditLimit ? Math.round(parseFloat(form.creditLimit) * 100) : null,
    balance: form.balance ? Math.round(parseFloat(form.balance) * 100) : null,
    notes: form.notes.trim() || null,
  };
}

function formFromCustomer(c: Customer): CustomerFormState {
  return {
    customerCode: c.customerCode || '',
    name: c.name,
    email: c.email || '',
    phone: c.phone || '',
    address: c.address || '',
    city: c.city || '',
    state: c.state || '',
    country: c.country || 'Nigeria',
    taxPin: c.taxPin || '',
    paymentTerms: c.paymentTerms != null ? c.paymentTerms.toString() : '',
    creditLimit: c.creditLimit != null ? (c.creditLimit / 100).toString() : '',
    balance: c.balance != null ? (c.balance / 100).toString() : '',
    notes: c.notes || '',
  };
}

function exportCustomersCSV(customers: Customer[]) {
  const headers = ['Code','Name','Email','Phone','Address','City','State','Country','Tax PIN','Payment Terms','Credit Limit','Opening Balance','Outstanding','Currency','Notes','Status'];
  const rows = customers.map(c => [
    c.customerCode||'', c.name, c.email||'', c.phone||'', c.address||'', c.city||'', c.state||'',
    c.country, c.taxPin||'', c.paymentTerms ? `Net ${c.paymentTerms}` : '',
    c.creditLimit ? `₦${(c.creditLimit/100).toLocaleString('en-NG')}` : '',
    c.balance ? `₦${(c.balance/100).toLocaleString('en-NG')}` : '',
    c.outstanding ? `₦${(c.outstanding/100).toLocaleString('en-NG')}` : '',
    c.currency, c.notes||'', c.isActive ? 'Active' : 'Inactive'
  ]);
  exportToCsv(headers, rows, 'customers');
}

function exportCustomersPDF(customers: Customer[]) {
  const headers = ['Customer','Code','Contact','Location','Tax PIN','Terms','Credit Limit','Status'];
  const rows = customers.map(c => [
    `${c.name}${c.notes ? ` (${c.notes})` : ''}`,
    c.customerCode||'\u2014',
    [c.email,c.phone].filter(Boolean).join(' / ')||'\u2014',
    [c.city,c.state,c.country].filter(Boolean).join(', ')||'\u2014',
    c.taxPin||'\u2014',
    c.paymentTerms ? `Net ${c.paymentTerms}` : '\u2014',
    c.creditLimit ? `₦${(c.creditLimit/100).toLocaleString('en-NG')}` : '\u2014',
    c.isActive ? 'Active' : 'Inactive',
  ]);
  exportToPdf('Customer Directory', headers, rows, 'customers');
}

export function CustomersPage() {
  const { id } = useParams();
  if (id) return <CustomerDetail id={id} />;
  return <CustomerList />;
}

// =========================================================================
// LIST VIEW
// =========================================================================

function CustomerList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: customers, isLoading, isError } = useQuery<Customer[]>({
    queryKey: ['sales', 'customers'],
    queryFn: async () => {
      const res = await api.get('/sales/customers');
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/sales/customers', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'customers'] });
      closeModal();
    },
    onError: (err: any) => setFormError(err?.response?.data?.error || 'Failed to create customer.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => api.patch(`/sales/customers/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'customers'] });
      closeModal();
    },
    onError: (err: any) => setFormError(err?.response?.data?.error || 'Failed to update customer.'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/sales/customers/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sales', 'customers'] }),
  });

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return (customers || []).filter((c) => {
      if (statusFilter === 'active' && !c.isActive) return false;
      if (statusFilter === 'inactive' && c.isActive) return false;
      if (!term) return true;
      return (
        c.name.toLowerCase().includes(term) ||
        (c.email || '').toLowerCase().includes(term) ||
        (c.phone || '').toLowerCase().includes(term)
      );
    });
  }, [customers, searchTerm, statusFilter]);

  const counts = useMemo(() => {
    const all = customers?.length || 0;
    const active = (customers || []).filter((c) => c.isActive).length;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const newThisMonth = (customers || []).filter((c) => new Date(c.createdAt) >= monthStart).length;
    return { all, active, inactive: all - active, newThisMonth };
  }, [customers]);

  function openAddModal() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormError(null);
    setModalOpen(true);
  }

  function openEditModal(c: Customer, e: React.MouseEvent) {
    e.stopPropagation();
    setForm(formFromCustomer(c));
    setEditingId(c.id);
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setFormError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError('Customer name is required.');
      return;
    }
    const payload = buildPayload(form);
    if (editingId) {
      updateMutation.mutate({ id: editingId, payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <PageHeader title="Customers" description={`${customers?.length || 0} total customers`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<Download className="w-3.5 h-3.5" />} onClick={() => exportCustomersCSV(filtered)}>CSV</Button>
            <Button variant="secondary" size="sm" icon={<FileText className="w-3.5 h-3.5" />} onClick={() => exportCustomersPDF(filtered)}>PDF</Button>
            <Button variant="secondary" size="sm" icon={<Upload className="w-3.5 h-3.5" />} onClick={() => setImportOpen(true)}>Import</Button>
            <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={openAddModal}>New</Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Button variant={statusFilter === 'all' ? 'primary' : 'secondary'} size="sm"
          onClick={() => setStatusFilter('all')} icon={<Users className="w-3.5 h-3.5" />}>
          All ({counts.all})
        </Button>
        <Button variant={statusFilter === 'active' ? 'primary' : 'secondary'} size="sm"
          onClick={() => setStatusFilter('active')}
          className={statusFilter === 'active' ? '!bg-emerald-600 !text-white' : ''}>
          Active ({counts.active})
        </Button>
        <Button variant={statusFilter === 'inactive' ? 'primary' : 'secondary'} size="sm"
          onClick={() => setStatusFilter('inactive')}
          className={statusFilter === 'inactive' ? '!bg-rose-600 !text-white' : ''}>
          Inactive ({counts.inactive})
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setStatusFilter('all')}>
          New ({counts.newThisMonth})
        </Button>
      </div>

      <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Search by name, email, or phone..." />

      <Card padding={false}>
        {isLoading ? (
          <TableSkeleton rows={5} columns={6} />
        ) : isError ? (
          <EmptyState icon={<FileText className="w-8 h-8" />} title="Failed to load" message="Could not load customers. Check the API route." />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Users className="w-8 h-8" />} title="No customers yet" message="Add your first customer to start invoicing."
            action={<Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openAddModal}>Add Customer</Button>} />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="px-3 py-3 text-left">Name</th>
                <th className="px-3 py-3 text-left">Code</th>
                <th className="px-3 py-3 text-left">Contact</th>
                <th className="px-3 py-3 text-left">Location</th>
                <th className="px-3 py-3 text-left">Balance</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/sales/customers/${c.id}`)}
                  className="group hover:bg-slate-50/50 transition-colors cursor-pointer"
                >
                  <td className="py-2.5 pl-4 pr-3">
                    <span className="text-sm font-medium text-slate-900">{c.name}</span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="text-sm text-slate-500 font-mono">{c.customerCode || '—'}</span>
                  </td>
                  <td className="py-2.5 pr-3 text-sm text-slate-500">
                    {c.email && <div><a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()} className="hover:text-blue-600 transition-colors">{c.email}</a></div>}
                    {c.phone && <div className="text-xs text-slate-400"><a href={`tel:${c.phone}`} onClick={e => e.stopPropagation()} className="hover:text-blue-600 transition-colors">{c.phone}</a></div>}
                  </td>
                  <td className="py-2.5 pr-3 text-sm text-slate-500">
                    {[c.city, c.state].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="py-2.5 pr-3 text-sm text-slate-700">{formatNaira((c.balance || 0) + (c.outstanding || 0))}</td>
                  <td className="py-2.5 pr-3">
                    <StatusBadge status={c.isActive ? 'active' : 'inactive'} />
                  </td>
                  <td className="py-2.5 pr-2 text-right">
                    <div className="opacity-0 group-hover:opacity-100 flex items-center justify-end gap-1 transition-opacity">
                      <Button variant="ghost" size="sm" icon={<Pencil className="w-3.5 h-3.5" />}
                        onClick={(e) => { e.stopPropagation(); openEditModal(c, e as any); }} aria-label="Edit customer" />
                      <Button variant="ghost" size="sm" icon={<Power className="w-3.5 h-3.5" />}
                        onClick={(e) => { e.stopPropagation(); toggleActiveMutation.mutate({ id: c.id, isActive: !c.isActive }); }}
                        aria-label={c.isActive ? 'Deactivate' : 'Reactivate'} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50/80">
                <td colSpan={4} className="px-3 py-3 text-sm font-bold text-slate-800">Total</td>
                <td className="px-3 py-3 text-sm font-bold text-slate-800">{formatNaira(filtered.reduce((s, c) => s + (c.balance || 0) + (c.outstanding || 0), 0))}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
            )}
          </table>
        )}
      </Card>

      <FormModal open={modalOpen} onClose={closeModal} title={editingId ? 'Edit Customer' : 'Add Customer'}
        onSubmit={handleSubmit} error={formError} loading={isSaving} submitLabel={editingId ? 'Save Changes' : 'Add Customer'}>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Customer Code</label>
          <input value={form.customerCode || (editingId ? '' : 'Auto-generated')} readOnly
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-400 cursor-not-allowed" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Customer Name *</label>
          <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
            <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
          <input value={form.address} onChange={e => setForm({...form, address: e.target.value})}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">City</label>
            <input value={form.city} onChange={e => setForm({...form, city: e.target.value})}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">State</label>
            <input value={form.state} onChange={e => setForm({...form, state: e.target.value})}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Country</label>
            <input value={form.country} onChange={e => setForm({...form, country: e.target.value})}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Tax PIN</label>
            <input value={form.taxPin} onChange={e => setForm({...form, taxPin: e.target.value})}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Payment Terms (days)</label>
            <input type="number" value={form.paymentTerms} onChange={e => setForm({...form, paymentTerms: e.target.value})} placeholder="30"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Credit Limit (₦)</label>
            <input type="number" step="0.01" value={form.creditLimit} onChange={e => setForm({...form, creditLimit: e.target.value})}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Opening Balance (₦)</label>
          <input type="number" step="0.01" value={form.balance} onChange={e => setForm({...form, balance: e.target.value})} placeholder="0.00"
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
          <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
        </div>
      </FormModal>
      {importOpen && (
        <CsvImportModal
          entity="customers"
          endpoint="/sales/customers"
          onClose={() => setImportOpen(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['sales', 'customers'] })}
          transformRow={(row, headers) => {
            const h = Object.fromEntries(headers.map((k, i) => [k.toLowerCase(), i]));
            const num = (key: string) => parseFloat((row[h[key]] || '').replace(/,/g, ''));
            return {
              name: row[h['name']] || '',
              customerCode: row[h['code']] || row[h['customer code']] || null,
              email: row[h['email']] || null,
              phone: row[h['phone']] || null,
              address: row[h['address']] || null,
              city: row[h['city']] || null,
              state: row[h['state']] || null,
              country: row[h['country']] || 'Nigeria',
              taxPin: row[h['taxpin']] || null,
              paymentTerms: num('paymentterms (days)') ? parseInt(String(num('paymentterms (days)')), 10) : null,
              creditLimit: num('creditlimit (ngn)') ? Math.round(num('creditlimit (ngn)') * 100) : null,
              balance: num('openingbalance (ngn)') ? Math.round(num('openingbalance (ngn)') * 100) : null,
              notes: row[h['notes']] || null,
            };
          }}
        />
      )}
    </div>
  );
}



// =========================================================================
// DETAIL VIEW (contact info + account statement)
// =========================================================================

interface StatementLine {
  id: string;
  date: string;
  type: string;
  number: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
}

interface StatementResponse {
  customer: { id: string; name: string; email: string | null; phone: string | null; notes: string | null };
  ledgerStatement: StatementLine[];
  closingOutstandingBalance: number;
}

function CustomerDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CustomerFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: customer, isLoading: loadingCustomer } = useQuery<Customer>({
    queryKey: ['sales', 'customer', id],
    queryFn: async () => {
      const res = await api.get(`/sales/customers/${id}`);
      return res.data;
    },
  });

  const { data: org } = useQuery({ queryKey: ['org'], queryFn: orgApi.getOrg, staleTime: 60000 });

  const { data: statement, isLoading: loadingStatement } = useQuery<StatementResponse>({
    queryKey: ['sales', 'customer', id, 'statement'],
    queryFn: async () => {
      const res = await api.get(`/sales/customers/${id}/statement`);
      return res.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: any) => api.patch(`/sales/customers/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'customer', id] });
      queryClient.invalidateQueries({ queryKey: ['sales', 'customers'] });
      setModalOpen(false);
    },
    onError: (err: any) => setFormError(err?.response?.data?.error || 'Failed to update customer.'),
  });

  function openEditModal() {
    if (!customer) return;
    setForm(formFromCustomer(customer));
    setFormError(null);
    setModalOpen(true);
  }

  function fmtDate(d: string): string {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function handlePrintStatement() {
    const el = document.getElementById('customer-statement-pdf-container');
    if (el) window.print();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError('Customer name is required.');
      return;
    }
    updateMutation.mutate(buildPayload(form));
  }

  if (loadingCustomer) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-16 flex items-center justify-center text-slate-400">
        <div className="bg-gradient-to-r from-slate-200 to-slate-100 animate-pulse rounded-2xl p-6 flex items-center gap-3">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Loading customer...</span>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-16 text-center text-slate-500">
        Customer not found.
        <div className="mt-3">
          <Link to="/app/sales/customers" className="text-indigo-600 hover:underline text-sm">
            Back to customers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <button
        onClick={() => navigate('/app/sales/customers')}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to customers
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{customer.name}</h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
            {customer.email && (
              <a href={`mailto:${customer.email}`} className="inline-flex items-center gap-1.5 hover:text-blue-600 transition-colors">
                <Mail size={14} />
                {customer.email}
              </a>
            )}
            {customer.phone && (
              <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-1.5 hover:text-blue-600 transition-colors">
                <PhoneIcon size={14} />
                {customer.phone}
              </a>
            )}
            {customer.currency && customer.currency !== 'NGN' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full">
                {customer.currency}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrintStatement}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-all duration-200"
          >
            <Printer size={14} />
            Print Statement
          </button>
          <button
            onClick={openEditModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-sm font-medium rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200 shadow-sm"
          >
            <Pencil size={14} />
            Edit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Outstanding Balance</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{fmtDual((customer.balance || 0) + (customer.outstanding || 0), customer.currency)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Credit Limit</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{fmtDual(customer.creditLimit, customer.currency)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Payment Terms</p>
          <p className="text-xl font-bold text-slate-900 mt-1">
            {customer.paymentTerms != null ? `Net ${customer.paymentTerms}` : '—'}
          </p>
        </div>
      </div>

      {(customer.address || customer.city || customer.taxPin) && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-start gap-2.5 text-sm text-slate-600">
          <MapPin size={16} className="text-slate-400 mt-0.5 shrink-0" />
          <div>
            {[customer.address, customer.city, customer.state, customer.country].filter(Boolean).join(', ')}
            {customer.taxPin && <div className="text-xs text-slate-400 mt-0.5">Tax PIN: {customer.taxPin}</div>}
          </div>
        </div>
      )}

      <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
        <FileText size={16} className="text-slate-400" />
        Account Statement
      </h2>
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loadingStatement ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <Loader2 size={18} className="animate-spin mr-2" />
            Loading statement...
          </div>
        ) : !statement || statement.ledgerStatement.length === 0 ? (
          <div className="text-center py-12 text-sm text-slate-400">No transactions yet.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="px-3 py-3 text-left">Date</th>
                <th className="px-3 py-3 text-left">Type</th>
                <th className="px-3 py-3 text-left">Number</th>
                <th className="px-3 py-3 text-left">Reference</th>
                <th className="px-3 py-3 text-right">Debit</th>
                <th className="px-3 py-3 text-right">Credit</th>
                <th className="px-3 py-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {statement.ledgerStatement.map((line) => {
                const isInvoice = line.type === 'invoice';
                const isPayment = line.type === 'payment';
                const isCreditNote = line.type === 'credit_note';
                const isBillableExpense = line.type === 'billable_expense';
                const isOpening = line.type === 'opening_balance';
                const isClickable = isInvoice || isPayment || isCreditNote || isBillableExpense;
                let href = '';
                if (isInvoice) href = `/sales/invoices/${line.id}`;
                else if (isPayment) href = `/sales/payments?selected=${line.id}`;
                else if (isCreditNote) href = `/sales/credit-notes?selected=${line.id}`;
                else if (isBillableExpense) href = `/purchases/expenses?selected=${line.id}`;
                return (
                  <tr
                    key={line.id}
                    onClick={() => isClickable && navigate(href)}
                    className={`hover:bg-slate-50/50 transition-colors ${isClickable ? "cursor-pointer hover:bg-indigo-50/60" : ""} ${isOpening ? "bg-slate-50/50 font-medium" : ""}`}
                  >
                    <td className="px-3 py-3 text-sm text-slate-600">
                      {isOpening ? '—' : new Date(line.date).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`text-xs font-medium capitalize ${isInvoice ? "text-indigo-600" : isPayment ? "text-emerald-600" : isCreditNote ? "text-amber-600" : isBillableExpense ? "text-rose-600" : isOpening ? "text-slate-800" : "text-slate-500"}`}>{line.type.replace('_', ' ')}</span>
                    </td>
                    <td className="px-3 py-3 text-sm font-mono">
                      {isClickable ? (
                        <span className="text-indigo-600 hover:underline font-medium">{line.number}</span>
                      ) : (
                        <span className="text-slate-600">{line.number || '—'}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-slate-500">{line.reference}</td>
                    <td className="px-3 py-3 text-sm text-right text-slate-700">
                      {line.debit > 0 ? fmtDual(line.debit, customer.currency) : '—'}
                    </td>
                    <td className="px-3 py-3 text-sm text-right text-slate-700">
                      {line.credit > 0 ? fmtDual(line.credit, customer.currency) : '—'}
                    </td>
                    <td className="px-3 py-3 text-sm text-right font-medium text-slate-900">
                      {fmtDual(line.balance, customer.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title="Edit Customer"
        onSubmit={handleSubmit} error={formError} loading={updateMutation.isPending} submitLabel="Save Changes">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Customer Code</label>
          <input value={form.customerCode || ''} readOnly
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-400 cursor-not-allowed" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Customer Name *</label>
          <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" /></div>
          <div><label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
            <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" /></div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
          <input value={form.address} onChange={e => setForm({...form, address: e.target.value})}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="block text-xs font-medium text-slate-500 mb-1">City</label>
            <input value={form.city} onChange={e => setForm({...form, city: e.target.value})}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" /></div>
          <div><label className="block text-xs font-medium text-slate-500 mb-1">State</label>
            <input value={form.state} onChange={e => setForm({...form, state: e.target.value})}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" /></div>
          <div><label className="block text-xs font-medium text-slate-500 mb-1">Country</label>
            <input value={form.country} onChange={e => setForm({...form, country: e.target.value})}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" /></div>
        </div>
      </FormModal>

      {/* Print container for customer statement PDF */}
      <div id="customer-statement-pdf-container" className="bg-white" style={{ display: 'none' }}>
        <div className="p-8 sm:p-10 space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-8">
            <div className="flex flex-col items-start gap-2">
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
                  {org?.address && <span className="text-[11px] text-slate-500 leading-snug">{org.address}</span>}
                  {(org as any)?.city && <span className="text-[11px] text-slate-500 leading-snug">{(org as any).city}</span>}
                  {(org as any)?.state && <span className="text-[11px] text-slate-500 leading-snug">{(org as any).state}</span>}
                </div>
                <div className="flex flex-col gap-y-0 mt-1">
                  {org?.phone && <span className="text-[11px] text-slate-500">{org.phone}</span>}
                  {org?.email && <span className="text-[11px] text-slate-500">{org.email}</span>}
                </div>
              </div>
            </div>
            <div className="sm:text-right shrink-0 space-y-1">
              <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest">Account Statement</p>
              <p className="text-lg font-bold text-slate-900">{customer.name}</p>
              {(customer.email || customer.phone) && (
                <p className="text-xs text-slate-500">{[customer.email, customer.phone].filter(Boolean).join(' · ')}</p>
              )}
            </div>
          </div>

          {/* Statement Table */}
          <table className="w-full border-collapse" style={{ fontSize: '12px' }}>
            <thead>
              <tr className="border-b-2 border-slate-300">
                <th className="py-2 pr-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date</th>
                <th className="py-2 pr-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Type</th>
                <th className="py-2 pr-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Number</th>
                <th className="py-2 pr-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Reference</th>
                <th className="py-2 pr-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Debit</th>
                <th className="py-2 pr-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Credit</th>
                <th className="py-2 pr-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Balance</th>
              </tr>
            </thead>
            <tbody>
              {statement?.ledgerStatement.map((line) => (
                <tr key={line.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 text-sm text-slate-600">
                    {line.type === 'opening_balance' ? '—' : fmtDate(line.date)}
                  </td>
                  <td className="py-2 pr-3 text-sm text-slate-600 capitalize">{line.type.replace('_', ' ')}</td>
                  <td className="py-2 pr-3 text-sm font-mono text-slate-700">{line.number || '—'}</td>
                  <td className="py-2 pr-3 text-sm text-slate-500">{line.reference || '—'}</td>
                  <td className="py-2 pr-3 text-sm text-right text-slate-700">{line.debit > 0 ? fmtDual(line.debit, customer.currency) : '—'}</td>
                  <td className="py-2 pr-3 text-sm text-right text-slate-700">{line.credit > 0 ? fmtDual(line.credit, customer.currency) : '—'}</td>
                  <td className="py-2 pr-3 text-sm text-right font-medium text-slate-900">{fmtDual(line.balance, customer.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
