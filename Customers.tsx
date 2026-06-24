/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Plus,
  Search,
  Pencil,
  X,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Users,
  Mail,
  Phone as PhoneIcon,
  MapPin,
  FileText,
  Power,
} from 'lucide-react';

interface Customer {
  id: string;
  orgId: string;
  type: 'customer' | 'vendor' | 'both';
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
  currency: string;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

type CustomerFormState = {
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
  notes: string;
};

const EMPTY_FORM: CustomerFormState = {
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
  notes: '',
};

function formatNaira(kobo: number | null | undefined): string {
  if (kobo === null || kobo === undefined) return '—';
  return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
    notes: form.notes.trim() || null,
  };
}

function formFromCustomer(c: Customer): CustomerFormState {
  return {
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
    notes: c.notes || '',
  };
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
    return { all, active, inactive: all - active };
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
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500 mt-1">
            {counts.all} customers · {counts.active} active · {counts.inactive} inactive
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Plus size={16} />
          Add Customer
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            statusFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          All ({counts.all})
        </button>
        <button
          onClick={() => setStatusFilter('active')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            statusFilter === 'active' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Active ({counts.active})
        </button>
        <button
          onClick={() => setStatusFilter('inactive')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            statusFilter === 'inactive' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Inactive ({counts.inactive})
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by name, email, or phone..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" />
            Loading customers...
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center gap-2 py-16 text-rose-500 text-sm">
            <AlertCircle size={16} />
            Failed to load customers. Check the API route.
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Users size={28} className="text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-600">No customers yet</p>
            <p className="text-xs text-slate-400 mt-1">Add your first customer to start invoicing.</p>
          </div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
                <th className="py-2.5 pl-4 pr-3">Name</th>
                <th className="py-2.5 pr-3">Contact</th>
                <th className="py-2.5 pr-3">Location</th>
                <th className="py-2.5 pr-3">Balance</th>
                <th className="py-2.5 pr-3">Status</th>
                <th className="py-2.5 pr-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/sales/customers/${c.id}`)}
                  className="group hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <td className="py-2.5 pl-4 pr-3">
                    <span className="text-sm font-medium text-slate-900">{c.name}</span>
                  </td>
                  <td className="py-2.5 pr-3 text-sm text-slate-500">
                    {c.email && <div>{c.email}</div>}
                    {c.phone && <div className="text-xs text-slate-400">{c.phone}</div>}
                  </td>
                  <td className="py-2.5 pr-3 text-sm text-slate-500">
                    {[c.city, c.state].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="py-2.5 pr-3 text-sm text-slate-700">{formatNaira(c.balance)}</td>
                  <td className="py-2.5 pr-3">
                    <span className={`text-xs font-medium ${c.isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {c.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-2.5 pr-2 text-right">
                    <div className="opacity-0 group-hover:opacity-100 flex items-center justify-end gap-1 transition-opacity">
                      <button
                        onClick={(e) => openEditModal(c, e)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        aria-label="Edit customer"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleActiveMutation.mutate({ id: c.id, isActive: !c.isActive });
                        }}
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        aria-label={c.isActive ? 'Deactivate customer' : 'Reactivate customer'}
                        title={c.isActive ? 'Deactivate' : 'Reactivate'}
                      >
                        <Power size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {modalOpen && (
        <CustomerFormModal
          mode={editingId ? 'edit' : 'add'}
          form={form}
          setForm={setForm}
          formError={formError}
          isSaving={isSaving}
          onSubmit={handleSubmit}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

// =========================================================================
// SHARED ADD/EDIT MODAL
// =========================================================================

function CustomerFormModal({
  mode,
  form,
  setForm,
  formError,
  isSaving,
  onSubmit,
  onClose,
}: {
  mode: 'add' | 'edit';
  form: CustomerFormState;
  setForm: (f: CustomerFormState) => void;
  formError: string | null;
  isSaving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 overflow-y-auto py-8">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">{mode === 'add' ? 'Add Customer' : 'Edit Customer'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={onSubmit} className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {formError && (
            <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{formError}</div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Customer Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">City</label>
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">State</label>
              <input
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Country</label>
              <input
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Tax PIN</label>
              <input
                value={form.taxPin}
                onChange={(e) => setForm({ ...form, taxPin: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Payment Terms (days)</label>
              <input
                type="number"
                value={form.paymentTerms}
                onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                placeholder="30"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Credit Limit (₦)</label>
              <input
                type="number"
                step="0.01"
                value={form.creditLimit}
                onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : mode === 'add' ? 'Add Customer' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
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
      <div className="max-w-5xl mx-auto px-6 py-16 flex items-center justify-center text-slate-400">
        <Loader2 size={20} className="animate-spin mr-2" />
        Loading customer...
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-16 text-center text-slate-500">
        Customer not found.
        <div className="mt-3">
          <Link to="/sales/customers" className="text-indigo-600 hover:underline text-sm">
            Back to customers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <button
        onClick={() => navigate('/sales/customers')}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ArrowLeft size={14} />
        Back to customers
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{customer.name}</h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
            {customer.email && (
              <span className="inline-flex items-center gap-1.5">
                <Mail size={14} />
                {customer.email}
              </span>
            )}
            {customer.phone && (
              <span className="inline-flex items-center gap-1.5">
                <PhoneIcon size={14} />
                {customer.phone}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={openEditModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Pencil size={14} />
          Edit
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Outstanding Balance</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{formatNaira(customer.balance)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Credit Limit</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{formatNaira(customer.creditLimit)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Payment Terms</p>
          <p className="text-xl font-bold text-slate-900 mt-1">
            {customer.paymentTerms != null ? `Net ${customer.paymentTerms}` : '—'}
          </p>
        </div>
      </div>

      {(customer.address || customer.city || customer.taxPin) && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 flex items-start gap-2.5 text-sm text-slate-600">
          <MapPin size={16} className="text-slate-400 mt-0.5 shrink-0" />
          <div>
            {[customer.address, customer.city, customer.state, customer.country].filter(Boolean).join(', ')}
            {customer.taxPin && <div className="text-xs text-slate-400 mt-0.5">Tax PIN: {customer.taxPin}</div>}
          </div>
        </div>
      )}

      <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
        <FileText size={16} className="text-slate-400" />
        Account Statement
      </h2>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loadingStatement ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <Loader2 size={18} className="animate-spin mr-2" />
            Loading statement...
          </div>
        ) : !statement || statement.ledgerStatement.length === 0 ? (
          <div className="text-center py-12 text-sm text-slate-400">No transactions yet.</div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
                <th className="py-2.5 pl-4 pr-3">Date</th>
                <th className="py-2.5 pr-3">Type</th>
                <th className="py-2.5 pr-3">Number</th>
                <th className="py-2.5 pr-3">Reference</th>
                <th className="py-2.5 pr-3 text-right">Debit</th>
                <th className="py-2.5 pr-3 text-right">Credit</th>
                <th className="py-2.5 pr-4 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {statement.ledgerStatement.map((line) => {
                const isInvoice = line.type === 'invoice';
                return (
                  <tr
                    key={line.id}
                    onClick={() => isInvoice && navigate(`/sales/invoices/${line.id}`)}
                    className={`hover:bg-slate-50 transition-colors ${isInvoice ? "cursor-pointer hover:bg-indigo-50/60" : ""}`}
                  >
                    <td className="py-2.5 pl-4 pr-3 text-sm text-slate-600">
                      {new Date(line.date).toLocaleDateString('en-GB')}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={`text-xs font-medium capitalize ${isInvoice ? "text-indigo-600" : "text-slate-500"}`}>{line.type.replace('_', ' ')}</span>
                    </td>
                    <td className="py-2.5 pr-3 text-sm font-mono">
                      {isInvoice ? (
                        <span className="text-indigo-600 hover:underline font-medium">{line.number}</span>
                      ) : (
                        <span className="text-slate-600">{line.number}</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-sm text-slate-500">{line.reference}</td>
                    <td className="py-2.5 pr-3 text-sm text-right text-slate-700">
                      {line.debit > 0 ? formatNaira(line.debit) : '—'}
                    </td>
                    <td className="py-2.5 pr-3 text-sm text-right text-slate-700">
                      {line.credit > 0 ? formatNaira(line.credit) : '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-sm text-right font-medium text-slate-900">
                      {formatNaira(line.balance)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </div>

      {modalOpen && (
        <CustomerFormModal
          mode="edit"
          form={form}
          setForm={setForm}
          formError={formError}
          isSaving={updateMutation.isPending}
          onSubmit={handleSubmit}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
