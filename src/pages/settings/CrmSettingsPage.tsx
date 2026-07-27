import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, CheckCircle2, XCircle, Save, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api';

const CRM_PERMISSIONS = [
  { key: 'crm:read', label: 'View CRM' },
  { key: 'crm:create', label: 'Create Deals & Activities' },
  { key: 'crm:update', label: 'Edit Deals & Activities' },
  { key: 'crm:delete', label: 'Delete Deals & Activities' },
];

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner', admin: 'Admin', administrator: 'Administrator',
  accountant: 'Accountant', manager: 'Manager', sales: 'Sales',
  inventory: 'Inventory', cashier: 'Cashier', auditor: 'Auditor',
  hr: 'HR', purchasing: 'Purchasing', staff: 'Staff',
};

export function CrmSettingsPage() {
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['crm-role-permissions'],
    queryFn: async () => {
      const res = await api.get('/crm/role-permissions');
      return res.data.data as { role: string; label: string; defaultPerms: string[]; overridePerms: string[] | null }[];
    },
  });

  const getEffectivePerms = (row: { role: string; defaultPerms: string[]; overridePerms: string[] | null }) => {
    if (edits[row.role] !== undefined) return edits[row.role];
    return row.overridePerms ?? row.defaultPerms;
  };

  const togglePerm = (role: string, perm: string) => {
    setEdits(prev => {
      const current = prev[role] ?? data?.find(r => r.role === role)?.overridePerms ?? data?.find(r => r.role === role)?.defaultPerms ?? [];
      const next = current.includes(perm) ? current.filter(p => p !== perm) : [...current, perm];
      return { ...prev, [role]: next };
    });
    setSuccessMsg('');
  };

  const saveRole = async (role: string) => {
    const perms = edits[role];
    if (perms === undefined) return;
    setSaving(role);
    try {
      await api.put('/crm/role-permissions', { role, permissions: perms });
      setEdits(prev => { const n = { ...prev }; delete n[role]; return n; });
      setSuccessMsg(`Permissions saved for ${ROLE_LABELS[role] || role}`);
      queryClient.invalidateQueries({ queryKey: ['crm-role-permissions'] });
    } catch (e: any) {
      console.error('Failed to save permissions', e);
    } finally {
      setSaving(null);
    }
  };

  const hasEdits = (role: string) => edits[role] !== undefined;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Shield className="w-6 h-6 text-indigo-600" />
        <h1 className="text-2xl font-bold text-slate-900">CRM Access Control</h1>
      </div>
      <p className="text-sm text-slate-500">Control which user roles can access the CRM module. Changes take effect immediately.</p>

      {successMsg && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {successMsg}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Role</th>
                  {CRM_PERMISSIONS.map(p => (
                    <th key={p.key} className="text-center px-3 py-3 font-semibold text-slate-700 text-[11px] uppercase tracking-wider">{p.label}</th>
                  ))}
                  <th className="text-center px-3 py-3 font-semibold text-slate-700 w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.map((row) => {
                  const effective = getEffectivePerms(row);
                  const isOverridden = row.overridePerms !== null && edits[row.role] === undefined;
                  const isEdited = hasEdits(row.role);
                  return (
                    <tr key={row.role} className={`border-b border-slate-100 transition-colors ${isEdited ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {ROLE_LABELS[row.role] || row.role}
                        {row.role === 'owner' && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Full</span>}
                      </td>
                      {CRM_PERMISSIONS.map(p => {
                        const has = effective.includes(p.key);
                        const isDefault = row.defaultPerms.includes(p.key);
                        const changed = isEdited && (edits[row.role]?.includes(p.key) !== (row.overridePerms ?? row.defaultPerms).includes(p.key));
                        return (
                          <td key={p.key} className="text-center px-3 py-3">
                            <button
                              onClick={() => row.role !== 'owner' && togglePerm(row.role, p.key)}
                              disabled={row.role === 'owner'}
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                                row.role === 'owner' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:scale-110'
                              } ${has ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}
                              title={has ? `Has ${p.label}` : `No ${p.label}`}
                            >
                              {has ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                            </button>
                            {changed && <span className="block text-[9px] text-indigo-500 mt-0.5">edited</span>}
                            {!changed && isOverridden && has !== row.defaultPerms.includes(p.key) && (
                              <span className="block text-[9px] text-amber-500 mt-0.5">custom</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="text-center px-3 py-3">
                        {row.role === 'owner' ? (
                          <span className="text-[10px] text-slate-400">Always</span>
                        ) : isEdited ? (
                          <button onClick={() => saveRole(row.role)} disabled={saving === row.role}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                          >
                            {saving === row.role ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            Save
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400">{isOverridden ? 'Custom' : 'Default'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-indigo-50 rounded-2xl border border-indigo-200/80 p-5 text-sm text-indigo-800 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <strong className="text-indigo-900">How it works:</strong> By default, CRM permissions follow the role defaults defined by the system. Use the toggles above to override permissions for specific roles. The <strong>Owner</strong> role always has full CRM access. Changes are saved per role — click "Save" after toggling permissions for each role.
        </div>
      </div>
    </div>
  );
}
