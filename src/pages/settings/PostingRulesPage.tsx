/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, X, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { postingRulesApi, api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

const SOURCE_OPTIONS = [
  { value: 'invoice', label: 'Sales Invoice' },
  { value: 'bill', label: 'Vendor Bill' },
  { value: 'payment', label: 'Payment Received / Made' },
  { value: 'payroll', label: 'Payroll Run' },
  { value: 'bank_feed', label: 'Bank Feed Match' },
  { value: 'opening_balance', label: 'Opening Balance' },
  { value: 'opening_stock', label: 'Opening Stock' },
  { value: 'inventory_adjustment', label: 'Inventory Adjustment' },
  { value: 'transfer', label: 'Bank Transfer' },
  { value: 'vat_settlement', label: 'VAT Settlement' },
  { value: 'tax_provision', label: 'Tax Provision' },
  { value: 'manual', label: 'Manual Journal' },
];

const ROLE_OPTIONS = [
  { value: 'accounts_receivable', label: 'Accounts Receivable' },
  { value: 'accounts_payable', label: 'Accounts Payable' },
  { value: 'vat_payable', label: 'VAT Payable' },
  { value: 'vat_receivable', label: 'VAT Receivable' },
  { value: 'retained_earnings', label: 'Retained Earnings' },
  { value: 'cogs', label: 'Cost of Goods Sold' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'bank', label: 'Bank' },
  { value: 'payroll_clearing', label: 'Payroll Clearing' },
  { value: 'paye_payable', label: 'PAYE Payable' },
  { value: 'pension_payable', label: 'Pension Payable' },
  { value: 'wht_receivable', label: 'WHT Receivable' },
  { value: 'wht_payable', label: 'WHT Payable' },
];

const ALL_SOURCES = SOURCE_OPTIONS.map(o => o.value);

interface Rule {
  id: string;
  name: string;
  source: string;
  eventType?: string | null;
  accountRole?: string | null;
  accountId?: string | null;
  priority: number;
  isActive: boolean;
}

interface AccountOption { id: string; code: string; name: string; type: string }

function RuleCreateModal({
  open, onClose, accounts,
}: {
  open: boolean; onClose: () => void;
  accounts: AccountOption[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    source: SOURCE_OPTIONS[0].value,
    accountRole: ROLE_OPTIONS[0].value,
    accountId: '',
    priority: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => postingRulesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posting-rules'] });
      setForm({ name: '', source: SOURCE_OPTIONS[0].value, accountRole: ROLE_OPTIONS[0].value, accountId: '', priority: 0 });
      setError(null);
      onClose();
    },
    onError: (err: any) => setError(err?.response?.data?.message || 'Failed to create rule.'),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-base font-semibold text-slate-900">Add Posting Rule</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }}
          className="px-5 py-4 space-y-4 overflow-y-auto"
        >
          {error && (
            <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Rule Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Override AR for invoices"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl placeholder-slate-400
                         focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Transaction Source</label>
            <select
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white
                         focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
            >
              {SOURCE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Account Role to Override</label>
            <select
              value={form.accountRole}
              onChange={(e) => setForm({ ...form, accountRole: e.target.value })}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white
                         focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
            >
              {ROLE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Override Account</label>
            <select
              value={form.accountId}
              onChange={(e) => setForm({ ...form, accountId: e.target.value })}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white
                         focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
            >
              <option value="">— Use system default —</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">
              When selected, this account replaces the system-role account for the above source + role.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Priority</label>
            <input
              type="number"
              value={String(form.priority)}
              onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl
                         focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-all duration-200">
              Cancel
            </button>
            <button type="submit" disabled={createMutation.isPending}
              className="px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700
                         rounded-xl hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 transition-all duration-200 shadow-sm">
              {createMutation.isPending ? <><Loader2 size={14} className="animate-spin inline mr-1.5" /> Saving...</> : 'Add Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function PostingRulesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [sourceFilter, setSourceFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  const { data: rulesResp, isLoading } = useQuery<{ rules: Rule[] }>({
    queryKey: ['posting-rules', sourceFilter],
    queryFn: () => postingRulesApi.list(sourceFilter === 'all' ? undefined : sourceFilter),
  });

  const { data: acctsResp } = useQuery<{ accounts: AccountOption[] }>({
    queryKey: ['chart-of-accounts'],
    queryFn: async () => {
      const res = await api.get('/accountant/accounts');
      return res.data;
    },
  });

  const rules = rulesResp?.rules || [];
  const accounts = acctsResp?.accounts || [];

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => postingRulesApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posting-rules'] });
      setDeleteError(null);
    },
    onError: (err: any) => setDeleteError(err?.response?.data?.message || 'Failed to deactivate.'),
  });

  const sourceLabel = (s: string) => SOURCE_OPTIONS.find(o => o.value === s)?.label || s;
  const roleLabel = (r: string | null) => ROLE_OPTIONS.find(o => o.value === r)?.label || 'None';
  const accountLabel = (id: string | null) => {
    if (!id) return '—';
    const a = accounts.find(ac => ac.id === id);
    return a ? `${a.code} — ${a.name}` : id;
  };

  return (
    <div>
      {deleteError && (
        <div className="mb-4 flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
          <AlertCircle size={14} /> {deleteError}
        </div>
      )}

      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-600
                       focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
          >
            <option value="all">All Sources</option>
            {SOURCE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span className="text-xs text-slate-400">{rules.length} rule{rules.length !== 1 ? 's' : ''}</span>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg
                       hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus size={14} /> Add Rule
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading rules...
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Source</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Override Account</th>
                <th className="px-4 py-3 text-left">Priority</th>
                {isAdmin && <th className="px-4 py-3 text-right w-14"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-4 py-12 text-center text-sm text-slate-400">
                    {sourceFilter !== 'all'
                      ? <>No rules for <span className="font-medium">{sourceLabel(sourceFilter)}</span>. {isAdmin && 'Click "Add Rule" to create one.'}</>
                      : <>No posting rules configured yet. {isAdmin && 'Use rules to override which account is used for a role per source.'}</>
                    }
                  </td>
                </tr>
              ) : (
                rules.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-2.5 text-sm font-medium text-slate-800">{r.name}</td>
                    <td className="px-4 py-2.5 text-sm text-slate-600 font-medium">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">
                        {sourceLabel(r.source)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-slate-600">
                      {r.accountRole ? roleLabel(r.accountRole) : (
                        <span className="text-slate-400 italic">None</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-slate-600 font-mono">
                      {accountLabel(r.accountId)}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-slate-500">{r.priority}</td>
                    {isAdmin && (
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => { if (confirm('Deactivate this rule?')) deactivateMutation.mutate(r.id); }}
                          disabled={deactivateMutation.isPending}
                          className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors disabled:opacity-30"
                          title="Deactivate"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <RuleCreateModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        accounts={accounts}
      />
    </div>
  );
}

export default PostingRulesPage;