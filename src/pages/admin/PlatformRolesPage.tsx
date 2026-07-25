import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Save, Loader2, RefreshCw, Plus, X, Trash2, Check, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';

const PERMISSION_GROUPS: Record<string, string[]> = {
  Users: ['users:read', 'users:create', 'users:update', 'users:delete'],
  Organisations: ['orgs:read', 'orgs:manage'],
  'Subscriptions & Plans': ['subscriptions:read', 'subscriptions:manage', 'plans:read', 'plans:manage'],
  Billing: ['billing:read', 'billing:manage'],
  Analytics: ['analytics:read', 'growth:read'],
  System: ['system:read', 'system:manage', 'feature_flags:manage', 'audit_logs:read'],
  Support: ['support:read', 'support:manage'],
  Announcements: ['announcements:manage'],
  Marketing: ['marketing:manage'],
  'Enterprise': ['regional_pricing:manage', 'enterprise_contracts:manage', 'reseller_contracts:manage', 'org_config:manage', 'white_label:manage'],
  'Infrastructure': ['api_keys:manage', 'impersonation:use'],
};

const allPermissions = Object.values(PERMISSION_GROUPS).flat();
const BUILTIN_ROLES = ['super_admin', 'admin', 'billing_manager', 'support_manager', 'analyst', 'developer', 'security_auditor', 'marketing_manager', 'onboarding_specialist', 'compliance_officer', 'viewer'];

function permLabel(p: string) {
  return p.replace(/_/g, ' ').replace(/:(.)/g, (_, c) => ': ' + c.toUpperCase());
}

export function PlatformRolesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [edits, setEdits] = useState<Record<string, string[] | null>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ role: '', permissions: [...allPermissions] });

  const { data: roles, isLoading } = useQuery({
    queryKey: ['platform-roles'],
    queryFn: async () => {
      const res = await api.get('/platform/roles');
      return (res.data.data || []) as { role: string; permissions: string[] }[];
    },
  });

  useEffect(() => {
    if (roles) {
      setEdits(prev => {
        const next = { ...prev };
        for (const r of roles) {
          if (next[r.role] === undefined) next[r.role] = null;
        }
        return next;
      });
    }
  }, [roles]);

  const saveMut = useMutation({
    mutationFn: async ({ role, permissions }: { role: string; permissions: string[] }) => {
      await api.put(`/platform/roles/${encodeURIComponent(role)}`, { permissions });
    },
    onSuccess: (_data, vars) => {
      setEdits(e => ({ ...e, [vars.role]: null }));
      qc.invalidateQueries({ queryKey: ['platform-roles'] });
      toast.toast(`Permissions saved for ${vars.role}`, 'success');
    },
    onError: (err: any) => toast.toast(err.response?.data?.error || 'Failed to save', 'error'),
  });

  const createMut = useMutation({
    mutationFn: async (data: { role: string; permissions: string[] }) => {
      await api.post('/platform/roles', data);
    },
    onSuccess: () => {
      setShowCreate(false);
      setCreateForm({ role: '', permissions: [...allPermissions] });
      qc.invalidateQueries({ queryKey: ['platform-roles'] });
      toast.toast('Role created', 'success');
    },
    onError: (err: any) => toast.toast(err.response?.data?.error || 'Failed to create role', 'error'),
  });

  const deleteMut = useMutation({
    mutationFn: async (role: string) => {
      await api.delete(`/platform/roles/${encodeURIComponent(role)}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-roles'] });
      toast.toast('Role deleted', 'success');
    },
    onError: (err: any) => toast.toast(err.response?.data?.error || 'Failed to delete role', 'error'),
  });

  const togglePerm = useCallback((role: string, perm: string) => {
    setEdits(prev => {
      const current = prev[role];
      const base = current !== null ? current : (roles?.find(r => r.role === role)?.permissions || []);
      const next = base.includes(perm)
        ? base.filter(p => p !== perm)
        : [...base, perm];
      return { ...prev, [role]: next };
    });
  }, [roles]);

  const toggleAll = useCallback((role: string, perms: string[], on: boolean) => {
    setEdits(prev => {
      const current = prev[role];
      const base = current !== null ? current : (roles?.find(r => r.role === role)?.permissions || []);
      const next = on
        ? [...new Set([...base, ...perms])]
        : base.filter(p => !perms.includes(p));
      return { ...prev, [role]: next };
    });
  }, [roles]);

  if (isLoading) {
    return <div className="p-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-ink-400" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Platform Roles & Permissions</h1>
          <p className="text-sm text-ink-500 mt-1">Manage role-to-permission mappings. Changes take effect immediately.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { saveMut.reset(); qc.invalidateQueries({ queryKey: ['platform-roles'] }); setEdits({}); }}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-surface border rounded-lg hover:bg-surface-subtle">
            <RefreshCw className="w-4 h-4" /> Reset
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> New Role
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs bg-surface rounded-xl border">
          <thead>
            <tr className="border-b bg-surface-subtle">
              <th className="text-left p-2 font-medium text-ink-600 min-w-[140px] sticky left-0 bg-surface-subtle z-10">Permission</th>
              {roles?.map(r => (
                <th key={r.role} className={`text-center p-2 font-medium min-w-[90px] ${edits[r.role] !== null ? 'bg-amber-50' : ''}`}>
                  <div className="text-[10px] uppercase tracking-wider leading-tight">{r.role.replace(/_/g, ' ')}</div>
                  {edits[r.role] !== null && (
                    <div className="mt-1 flex justify-center gap-1">
                      <button onClick={() => saveMut.mutate({ role: r.role, permissions: edits[r.role]! })}
                        disabled={saveMut.isPending}
                        className="p-0.5 rounded bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50">
                        <Save className="w-3 h-3" />
                      </button>
                      <button onClick={() => setEdits(e => ({ ...e, [r.role]: null }))}
                        className="p-0.5 rounded bg-gray-400 text-white hover:bg-gray-500">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
              <tr key={group} className="border-b bg-surface-subtle/50">
                <td className="p-2 font-semibold text-ink-700 sticky left-0 bg-surface-subtle/50 z-10" colSpan={(roles?.length || 0) + 1}>
                  {group}
                  <div className="inline-flex gap-1 ml-2">
                    <button onClick={() => roles?.forEach(r => toggleAll(r.role, perms, true))}
                      className="text-[10px] px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200" title="Enable all in group">all on</button>
                    <button onClick={() => roles?.forEach(r => toggleAll(r.role, perms, false))}
                      className="text-[10px] px-1 py-0.5 rounded bg-red-100 text-red-700 hover:bg-red-200" title="Disable all in group">all off</button>
                  </div>
                </td>
              </tr>
            ))}
            {allPermissions.map(perm => (
              <tr key={perm} className="border-b hover:bg-surface-hover">
                <td className="p-2 pl-4 font-mono text-ink-700 sticky left-0 bg-surface z-10">{permLabel(perm)}</td>
                {roles?.map(r => {
                  const edited = edits[r.role] !== null;
                  const currentPerms = edited ? edits[r.role]! : r.permissions;
                  const has = currentPerms.includes(perm);
                  return (
                    <td key={r.role} className={`text-center p-2 cursor-pointer ${edited ? 'bg-amber-50/50' : ''}`}
                      onClick={() => togglePerm(r.role, perm)}>
                      <div className={`mx-auto w-4 h-4 rounded ${has ? 'bg-emerald-500' : 'bg-gray-200'} ${edited ? 'ring-2 ring-amber-300' : ''}`} />
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="sticky bottom-0 bg-surface border-t">
              <td className="p-2 font-medium text-ink-700 sticky left-0 bg-surface z-10">Actions</td>
              {roles?.map(r => {
                const edited = edits[r.role] !== null;
                const currentPerms = edited ? edits[r.role]! : r.permissions;
                const isBuiltin = BUILTIN_ROLES.includes(r.role);
                return (
                  <td key={r.role} className="text-center p-2">
                    {edited ? (
                      <div className="flex justify-center gap-1">
                        <button onClick={() => saveMut.mutate({ role: r.role, permissions: currentPerms })}
                          disabled={saveMut.isPending}
                          className="p-1 rounded bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50" title="Save">
                          <Save className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setEdits(e => ({ ...e, [r.role]: null }))}
                          className="p-1 rounded bg-gray-400 text-white hover:bg-gray-500" title="Cancel">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setEdits(e => ({ ...e, [r.role]: r.permissions }))}
                        className="p-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200" title="Edit">
                        <Shield className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {!isBuiltin && (
                      <button onClick={() => { if (confirm(`Delete role "${r.role}"?`)) deleteMut.mutate(r.role); }}
                        className="p-1 rounded text-red-400 hover:text-red-600 ml-1" title="Delete role">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-ink-400">
        <span>{roles?.length || 0} roles · {allPermissions.length} permissions</span>
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> granted</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-200 inline-block" /> denied</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-200 ring-2 ring-amber-300 inline-block" /> unsaved change</span>
        </span>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-surface rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">New Role</h3>
              <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-ink-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Role Name</label>
                <input value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}
                  placeholder="e.g. custom_role"
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1 flex items-center justify-between">
                  <span>Permissions</span>
                  <div className="flex gap-2">
                    <button onClick={() => setCreateForm(f => ({ ...f, permissions: [...allPermissions] }))}
                      className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">select all</button>
                    <button onClick={() => setCreateForm(f => ({ ...f, permissions: [] }))}
                      className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">deselect all</button>
                  </div>
                </label>
                <div className="border rounded-lg max-h-64 overflow-y-auto p-2 space-y-1">
                  {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
                    <div key={group}>
                      <div className="flex items-center gap-2 py-1">
                        <input type="checkbox"
                          checked={perms.every(p => createForm.permissions.includes(p))}
                          onChange={e => {
                            if (e.target.checked) {
                              setCreateForm(f => ({ ...f, permissions: [...new Set([...f.permissions, ...perms])] }));
                            } else {
                              setCreateForm(f => ({ ...f, permissions: f.permissions.filter(p => !perms.includes(p)) }));
                            }
                          }}
                          className="rounded" />
                        <span className="text-xs font-semibold text-ink-600">{group}</span>
                      </div>
                      <div className="ml-5 space-y-0.5">
                        {perms.map(p => (
                          <label key={p} className="flex items-center gap-2 py-0.5 cursor-pointer">
                            <input type="checkbox"
                              checked={createForm.permissions.includes(p)}
                              onChange={e => {
                                if (e.target.checked) {
                                  setCreateForm(f => ({ ...f, permissions: [...f.permissions, p] }));
                                } else {
                                  setCreateForm(f => ({ ...f, permissions: f.permissions.filter(x => x !== p) }));
                                }
                              }}
                              className="rounded" />
                            <span className="text-xs font-mono text-ink-700">{permLabel(p)}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => createMut.mutate(createForm)}
                disabled={!createForm.role.trim() || createMut.isPending}
                className="w-full py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
