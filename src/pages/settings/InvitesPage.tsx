import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrgSettings } from '../../hooks/useOrgSettings';
import { orgApi } from '../../lib/api';
import { Plus, X, Loader2, AlertCircle, CheckCircle2, Mail, Trash2 } from 'lucide-react';

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function InvitesSettingsPage() {
  const queryClient = useQueryClient();
  const { settings, save, isPending } = useOrgSettings();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  const [localError, setLocalError] = useState('');
  const [localSuccess, setLocalSuccess] = useState('');

  const invites: any[] = settings?.invites || [];

  const sendInvite = useMutation({
    mutationFn: (data: { name: string; email: string; role: string }) => orgApi.inviteUser(data),
    onSuccess: () => {
      setLocalSuccess('Invitation sent successfully.');
      setName(''); setEmail(''); setRole('staff');
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['orgSettings'] });
      setTimeout(() => setLocalSuccess(''), 3000);
    },
    onError: (err: any) => {
      setLocalError(err.response?.data?.error || err.message || 'Failed to send invitation.');
      setTimeout(() => setLocalError(''), 5000);
    },
  });

  const clearInvites = useMutation({
    mutationFn: () => orgApi.clearInvites(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orgSettings'] });
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (!name || !email) { setLocalError('Name and email are required.'); return; }
    sendInvite.mutate({ name, email, role });
  };

  const handleCancel = (index: number) => {
    const updated = invites.filter((_, i) => i !== index);
    save({ invites: updated });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Invites</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"><Plus className="w-4 h-4" /> New Invite</button>
          {invites.length > 0 && (
            <button onClick={() => clearInvites.mutate()} disabled={clearInvites.isPending} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-red-600 bg-red-50 rounded-lg hover:bg-red-100"><Trash2 className="w-4 h-4" /> Clear All</button>
          )}
        </div>
      </div>

      {localSuccess && <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm"><CheckCircle2 className="w-4 h-4" /> {localSuccess}</div>}
      {localError && <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm"><AlertCircle className="w-4 h-4" /> {localError}</div>}
      {isPending && <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Saving...</div>}

      {showForm && (
        <form onSubmit={handleSend} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-xs font-semibold text-slate-500 uppercase">Name</label><input value={name} onChange={e => setName(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm mt-1" /></div>
            <div><label className="text-xs font-semibold text-slate-500 uppercase">Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm mt-1" /></div>
            <div><label className="text-xs font-semibold text-slate-500 uppercase">Role</label>
              <select value={role} onChange={e => setRole(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm mt-1">
                <option value="staff">Staff</option>
                <option value="accountant">Accountant</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
            <button type="submit" disabled={sendInvite.isPending} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {sendInvite.isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Send Invite
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Name</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Email</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Role</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600">Sent</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invites.map((inv: any, i: number) => (
              <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{inv.name}</td>
                <td className="px-4 py-3 text-slate-600">{inv.email}</td>
                <td className="px-4 py-3 text-slate-600 capitalize">{inv.role}</td>
                <td className="px-4 py-3"><span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${inv.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : inv.status === 'expired' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{inv.status || 'pending'}</span></td>
                <td className="px-4 py-3 text-right text-slate-500">{inv.createdAt ? fmtDate(inv.createdAt) : '—'}</td>
                <td className="px-4 py-3 text-right">
                  {inv.status !== 'accepted' && (
                    <button onClick={() => handleCancel(i)} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button>
                  )}
                </td>
              </tr>
            ))}
            {invites.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No pending invitations.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
