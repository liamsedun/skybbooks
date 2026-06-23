/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Plus, X, Loader2, AlertCircle, Search, Building2,
  Phone, Mail, MapPin, FileText, MoreVertical, Edit2, Trash2,
  ChevronRight, TrendingDown
} from 'lucide-react';

interface Vendor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  taxPin: string | null;
  paymentTerms: number | null;
  currency: string;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

type FormState = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  taxPin: string;
  paymentTerms: string;
  currency: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  name: '', email: '', phone: '', address: '',
  city: '', state: '', country: 'Nigeria',
  taxPin: '', paymentTerms: '30', currency: 'NGN', notes: '',
};

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const COLORS = ['bg-violet-100 text-violet-700', 'bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700'];
function colorFor(name: string) { return COLORS[name.charCodeAt(0) % COLORS.length]; }

export function VendorsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const { data: vendors = [], isLoading, isError } = useQuery<Vendor[]>({
    queryKey: ['vendors'],
    queryFn: async () => { const r = await api.get('/purchases/vendors'); return r.data; },
  });

  const createMutation = useMutation({
    mutationFn: (p: any) => api.post('/purchases/vendors', p),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vendors'] }); closeModal(); },
    onError: (e: any) => setFormError(e?.response?.data?.error || 'Failed to save vendor.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, p }: { id: string; p: any }) => api.patch(`/purchases/vendors/${id}`, p),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vendors'] }); closeModal(); },
    onError: (e: any) => setFormError(e?.response?.data?.error || 'Failed to update vendor.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/purchases/vendors/${id}`, { isActive: false }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendors'] }),
  });

  const filtered = useMemo(() => {
    const t = search.toLowerCase();
    return vendors.filter(v =>
      !t || v.name.toLowerCase().includes(t) ||
      (v.email || '').toLowerCase().includes(t) ||
      (v.city || '').toLowerCase().includes(t)
    );
  }, [vendors, search]);

  function openCreate() { setEditingId(null); setForm(EMPTY_FORM); setFormError(null); setModalOpen(true); }
  function openEdit(v: Vendor) {
    setEditingId(v.id);
    setForm({
      name: v.name, email: v.email || '', phone: v.phone || '',
      address: v.address || '', city: v.city || '', state: v.state || '',
      country: v.country || 'Nigeria', taxPin: v.taxPin || '',
      paymentTerms: v.paymentTerms?.toString() || '30',
      currency: v.currency || 'NGN', notes: v.notes || '',
    });
    setFormError(null); setModalOpen(true); setMenuOpen(null);
  }
  function closeModal() { setModalOpen(false); setEditingId(null); setFormError(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError('Vendor name is required.'); return; }
    const payload = {
      ...form,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      taxPin: form.taxPin || null,
      notes: form.notes || null,
      paymentTerms: parseInt(form.paymentTerms) || null,
    };
    if (editingId) updateMutation.mutate({ id: editingId, p: payload });
    else createMutation.mutate(payload);
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Vendors</h1>
          <p className="text-sm text-slate-500 mt-0.5">{vendors.length} vendor{vendors.length !== 1 ? 's' : ''} · manage your supplier directory</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">
          <Plus size={15} /> Add Vendor
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendors..." className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 bg-white border border-slate-200 rounded-xl">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading vendors...
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center py-16 text-rose-500 gap-2 bg-white border border-slate-200 rounded-xl">
          <AlertCircle size={18} /> Failed to load vendors.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
          <Building2 size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">{search ? 'No vendors match your search' : 'No vendors yet'}</p>
          {!search && <p className="text-xs text-slate-400 mt-1">Add your first supplier to get started</p>}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide border-b border-slate-200">
                <th className="py-3 pl-4 pr-2 text-left">Vendor</th>
                <th className="py-3 px-2 text-left">Contact</th>
                <th className="py-3 px-2 text-left">Location</th>
                <th className="py-3 px-2 text-left">Terms</th>
                <th className="py-3 px-2 text-left">Tax PIN</th>
                <th className="py-3 pl-2 pr-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(v => (
                <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 pl-4 pr-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${colorFor(v.name)}`}>
                        {initials(v.name)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{v.name}</p>
                        {v.notes && <p className="text-xs text-slate-400 truncate max-w-[180px]">{v.notes}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <div className="space-y-0.5">
                      {v.email && <div className="flex items-center gap-1 text-xs text-slate-500"><Mail size={11} /> {v.email}</div>}
                      {v.phone && <div className="flex items-center gap-1 text-xs text-slate-500"><Phone size={11} /> {v.phone}</div>}
                    </div>
                  </td>
                  <td className="py-3 px-2 text-xs text-slate-500">
                    {[v.city, v.state, v.country].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="py-3 px-2">
                    {v.paymentTerms ? (
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">Net {v.paymentTerms}</span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="py-3 px-2 text-xs text-slate-500 font-mono">{v.taxPin || '—'}</td>
                  <td className="py-3 pl-2 pr-4 relative">
                    <button onClick={() => setMenuOpen(menuOpen === v.id ? null : v.id)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                      <MoreVertical size={14} />
                    </button>
                    {menuOpen === v.id && (
                      <div className="absolute right-4 top-8 z-10 bg-white border border-slate-200 rounded-lg shadow-lg text-xs w-36 py-1">
                        <button onClick={() => openEdit(v)} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 text-slate-700">
                          <Edit2 size={12} /> Edit vendor
                        </button>
                        <button onClick={() => { if (confirm('Remove this vendor?')) { deleteMutation.mutate(v.id); setMenuOpen(null); } }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-rose-50 text-rose-600">
                          <Trash2 size={12} /> Remove
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 px-4 py-8 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">{editingId ? 'Edit Vendor' : 'Add New Vendor'}</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {formError && (
                <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 flex items-center gap-2">
                  <AlertCircle size={14} /> {formError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Vendor Name *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. ABC Supplies Ltd" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="vendor@company.com" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+234 800 000 0000" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
                  <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Street address" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">City</label>
                  <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Lagos" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">State</label>
                  <input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} placeholder="Lagos State" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Tax PIN</label>
                  <input value={form.taxPin} onChange={e => setForm({ ...form, taxPin: e.target.value })} placeholder="TIN-XXXXXXXXX" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Payment Terms (days)</label>
                  <input type="number" min="0" value={form.paymentTerms} onChange={e => setForm({ ...form, paymentTerms: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 resize-none" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-5 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2">
                  {isSaving && <Loader2 size={14} className="animate-spin" />}
                  {editingId ? 'Save Changes' : 'Add Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
