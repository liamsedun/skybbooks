/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Plus, X, Loader2, AlertCircle, Search, RefreshCw,
  CheckCircle2, Play, Pause, Trash2, Calendar, Download, FileText
} from 'lucide-react';

interface Vendor { id: string; name: string; }
interface Account { id: string; name: string; type: string; code: string | null; }

type Frequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';

const FREQ_META: Record<Frequency, { label: string }> = {
  daily: { label: 'Daily' },
  weekly: { label: 'Weekly' },
  monthly: { label: 'Monthly' },
  quarterly: { label: 'Quarterly' },
  annually: { label: 'Annually' },
};

interface RecurringExpense {
  id: string; orgId: string; vendorId: string | null;
  accountId: string; frequency: Frequency;
  amount: number; taxAmount: number; description: string | null;
  paymentMethod: string; startDate: string; endDate: string | null;
  nextRunDate: string | null; isActive: boolean; createdAt: string;
}

// Searchable account dropdown component
function AccountSearchSelect({
  accounts,
  value,
  onChange,
  placeholder = 'Select account...',
}: {
  accounts: Account[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected = accounts.find(a => a.id === value);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return accounts;
    return accounts.filter(a =>
      a.name.toLowerCase().includes(q) ||
      (a.code || '').toLowerCase().includes(q)
    );
  }, [accounts, query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(!open); setQuery(''); }}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white text-left flex items-center justify-between"
      >
        <span className={selected ? 'text-slate-900' : 'text-slate-400'}>
          {selected ? `${selected.code ? selected.code + ' · ' : ''}${selected.name}` : placeholder}
        </span>
        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search accounts..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900/20"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400">No accounts match</p>
            ) : (
              filtered.map(a => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => { onChange(a.id); setOpen(false); setQuery(''); }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors flex items-center gap-2 ${a.id === value ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700'}`}
                >
                  {a.code && <span className="font-mono text-slate-400 shrink-0">{a.code}</span>}
                  <span>{a.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatNaira(kobo: number) {
  return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const PAYMENT_METHODS = ['cash', 'bank_transfer', 'card', 'cheque', 'pos', 'ussd'];
const STORAGE_KEY = 'skybooks_recurring_expenses';

function loadSchedules(): RecurringExpense[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveSchedules(items: RecurringExpense[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function exportRecurringCSV(items: RecurringExpense[], vendorMap: Map<string, string>, accountMap: Map<string, string>) {
  const headers = ['Description', 'Account', 'Vendor', 'Frequency', 'Amount (₦)', 'Start Date', 'End Date', 'Next Run', 'Status'];
  const rows = items.map(r => [
    r.description || '', accountMap.get(r.accountId) || '',
    r.vendorId ? (vendorMap.get(r.vendorId) || '') : '',
    r.frequency, (r.amount / 100).toFixed(2), fmtDate(r.startDate),
    r.endDate ? fmtDate(r.endDate) : '', r.nextRunDate ? fmtDate(r.nextRunDate) : '',
    r.isActive ? 'Active' : 'Paused'
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `recurring-expenses-${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

function exportRecurringPDF(items: RecurringExpense[], vendorMap: Map<string, string>, accountMap: Map<string, string>) {
  const rows = items.map(r => `
    <tr>
      <td>${r.description || accountMap.get(r.accountId) || '—'}</td>
      <td>${accountMap.get(r.accountId) || '—'}</td>
      <td>${r.vendorId ? (vendorMap.get(r.vendorId) || '—') : '—'}</td>
      <td>${FREQ_META[r.frequency]?.label || r.frequency}</td>
      <td style="text-align:right">${formatNaira(r.amount)}</td>
      <td>${r.nextRunDate ? fmtDate(r.nextRunDate) : '—'}</td>
      <td><span style="padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;background:${r.isActive ? '#dcfce7' : '#f1f5f9'};color:${r.isActive ? '#166534' : '#64748b'}">${r.isActive ? 'Active' : 'Paused'}</span></td>
    </tr>`).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Recurring Expenses</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;color:#1e293b;padding:40px;font-size:13px}.header{display:flex;justify-content:space-between;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #0f172a}.company{font-size:22px;font-weight:800}.subtitle{font-size:11px;color:#64748b;margin-top:4px}.title{font-size:18px;font-weight:700;text-align:right}.date{font-size:11px;color:#64748b;margin-top:4px;text-align:right}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#0f172a;color:#fff;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase}td{padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px}tr:nth-child(even) td{background:#f8fafc}.footer{margin-top:40px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px}@media print{body{padding:20px}}</style>
  </head><body>
  <div class="header"><div><div class="company">SkyBooks</div><div class="subtitle">By Skyhouse Accountants &amp; Technologies</div></div><div><div class="title">Recurring Expenses</div><div class="date">Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</div></div></div>
  <table><thead><tr><th>Description</th><th>Account</th><th>Vendor</th><th>Frequency</th><th style="text-align:right">Amount</th><th>Next Run</th><th>Status</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <div class="footer">SkyBooks By Skyhouse Accountants &amp; Technologies (Olalekan Williams Edun) &bull; Confidential</div>
  </body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
}

type FormState = {
  vendorId: string; accountId: string; frequency: Frequency;
  amount: string; taxAmount: string; description: string;
  paymentMethod: string; startDate: string; endDate: string;
};

const EMPTY_FORM: FormState = {
  vendorId: '', accountId: '', frequency: 'monthly',
  amount: '', taxAmount: '0', description: '',
  paymentMethod: 'bank_transfer',
  startDate: new Date().toISOString().split('T')[0], endDate: '',
};

function calcNextRun(startDate: string, frequency: Frequency): string {
  const d = new Date(startDate);
  switch (frequency) {
    case 'daily': d.setDate(d.getDate() + 1); break;
    case 'weekly': d.setDate(d.getDate() + 7); break;
    case 'monthly': d.setMonth(d.getMonth() + 1); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'annually': d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString();
}

export function RecurringExpensesPage() {
  const [schedules, setSchedules] = useState<RecurringExpense[]>(loadSchedules);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ['vendors'],
    queryFn: async () => { const r = await api.get('/purchases/vendors'); return r.data; },
  });

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: async () => { const r = await api.get('/accountant/accounts'); return r.data; },
  });

  const vendorMap = useMemo(() => new Map(vendors.map(v => [v.id, v.name])), [vendors]);
  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a.name])), [accounts]);
  const expenseAccounts = useMemo(() => accounts.filter(a => a.type === 'expense'), [accounts]);

  const filtered = useMemo(() => {
    const t = search.toLowerCase();
    return schedules.filter(r =>
      !t || (r.description || '').toLowerCase().includes(t) ||
      (accountMap.get(r.accountId) || '').toLowerCase().includes(t) ||
      (vendorMap.get(r.vendorId || '') || '').toLowerCase().includes(t)
    );
  }, [schedules, search, vendorMap, accountMap]);

  function showSuccess(msg: string) { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 4000); }
  function closeModal() { setModalOpen(false); setForm(EMPTY_FORM); setFormError(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.accountId) { setFormError('Please select an expense account.'); return; }
    const amtKobo = Math.round(parseFloat(form.amount) * 100);
    if (!amtKobo || amtKobo <= 0) { setFormError('Amount must be greater than zero.'); return; }

    const newSchedule: RecurringExpense = {
      id: `re_${Date.now()}`,
      orgId: '',
      vendorId: form.vendorId || null,
      accountId: form.accountId,
      frequency: form.frequency,
      amount: amtKobo,
      taxAmount: Math.round(parseFloat(form.taxAmount || '0') * 100),
      description: form.description || null,
      paymentMethod: form.paymentMethod,
      startDate: form.startDate,
      endDate: form.endDate || null,
      nextRunDate: calcNextRun(form.startDate, form.frequency),
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const updated = [...schedules, newSchedule];
    setSchedules(updated);
    saveSchedules(updated);
    closeModal();
    showSuccess('Recurring expense schedule created.');
  }

  function toggleActive(id: string) {
    const updated = schedules.map(s => s.id === id ? { ...s, isActive: !s.isActive } : s);
    setSchedules(updated);
    saveSchedules(updated);
  }

  function deleteSchedule(id: string) {
    const updated = schedules.filter(s => s.id !== id);
    setSchedules(updated);
    saveSchedules(updated);
    showSuccess('Schedule deleted.');
  }

  const activeCount = schedules.filter(r => r.isActive).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Recurring Expenses</h1>
          <p className="text-sm text-slate-500 mt-0.5">{schedules.length} schedules · {activeCount} active</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportRecurringCSV(filtered, vendorMap, accountMap)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            <Download size={14} /> CSV
          </button>
          <button onClick={() => exportRecurringPDF(filtered, vendorMap, accountMap)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            <FileText size={14} /> PDF
          </button>
          <button onClick={() => { setForm(EMPTY_FORM); setFormError(null); setModalOpen(true); }} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">
            <Plus size={15} /> New Schedule
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          <CheckCircle2 size={16} /> {successMsg}
        </div>
      )}

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search schedules..." className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
          <RefreshCw size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">{search ? 'No matching schedules' : 'No recurring expenses yet'}</p>
          {!search && <p className="text-xs text-slate-400 mt-1">Set up schedules for rent, subscriptions, and recurring costs</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <div key={r.id} className={`bg-white border rounded-xl p-5 transition-all ${r.isActive ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-slate-900">{r.description || accountMap.get(r.accountId) || '—'}</h3>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${r.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {r.isActive ? <><Play className="w-2.5 h-2.5" /> Active</> : <><Pause className="w-2.5 h-2.5" /> Paused</>}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                      <Calendar className="w-2.5 h-2.5" /> {FREQ_META[r.frequency]?.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-slate-500 mt-2">
                    <span>Account: <span className="font-medium text-slate-700">{accountMap.get(r.accountId) || '—'}</span></span>
                    {r.vendorId && <span>Vendor: <span className="font-medium text-slate-700">{vendorMap.get(r.vendorId) || '—'}</span></span>}
                    <span>Started: <span className="font-medium text-slate-700">{fmtDate(r.startDate)}</span></span>
                    {r.endDate && <span>Ends: <span className="font-medium text-slate-700">{fmtDate(r.endDate)}</span></span>}
                    <span>Next Run: <span className="font-medium text-slate-700">{fmtDate(r.nextRunDate)}</span></span>
                    <span>Amount: <span className="font-mono font-semibold text-slate-900">{formatNaira(r.amount)}</span></span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleActive(r.id)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${r.isActive ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200' : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'}`}
                    title={r.isActive ? 'Pause schedule' : 'Resume schedule'}
                  >
                    {r.isActive ? <><Pause size={12} /> Pause</> : <><Play size={12} /> Resume</>}
                  </button>
                  <button
                    onClick={() => { if (confirm('Delete this recurring expense schedule?')) deleteSchedule(r.id); }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 px-4 py-8 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">New Recurring Expense</h2>
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
                  <label className="block text-xs font-medium text-slate-500 mb-1">Expense Account *</label>
                  <AccountSearchSelect
                    accounts={expenseAccounts}
                    value={form.accountId}
                    onChange={id => setForm({ ...form, accountId: id })}
                    placeholder="Search and select account..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Amount (₦) *</label>
                  <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">VAT Amount (₦)</label>
                  <input type="number" min="0" step="0.01" value={form.taxAmount} onChange={e => setForm({ ...form, taxAmount: e.target.value })} placeholder="0.00" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Frequency *</label>
                  <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value as Frequency })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
                    {(Object.keys(FREQ_META) as Frequency[]).map(f => (
                      <option key={f} value={f}>{FREQ_META[f].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Payment Method</label>
                  <select value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Start Date *</label>
                  <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">End Date (optional)</label>
                  <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Vendor (optional)</label>
                  <select value={form.vendorId} onChange={e => setForm({ ...form, vendorId: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
                    <option value="">No specific vendor</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                  <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g. Monthly office rent, SaaS subscription..." className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                <button type="submit" className="px-5 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 flex items-center gap-2">
                  Create Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// updated
