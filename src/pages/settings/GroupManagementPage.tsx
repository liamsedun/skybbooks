import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Users, Globe, Edit3, Trash2, X, Check, ChevronDown, ChevronUp, Building2, Percent, Layers, Star, ExternalLink } from 'lucide-react';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';

interface Group {
  id: string;
  name: string;
  baseCurrency: string;
  memberCount?: number;
}

interface GroupMember {
  id: string;
  orgId: string;
  orgName: string;
  ownershipPercentage: number;
  consolidationMethod: string;
  isParent: boolean;
}

interface OrgAccess {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
}

function fmtPct(v: number): string {
  return `${Number(v).toFixed(1)}%`;
}

const METHOD_LABELS: Record<string, string> = {
  full: 'Full',
  equity: 'Equity',
  proportionate: 'Proportionate',
};

const METHOD_COLORS: Record<string, string> = {
  full: 'bg-emerald-100 text-emerald-700',
  equity: 'bg-blue-100 text-blue-700',
  proportionate: 'bg-amber-100 text-amber-700',
};

export function GroupManagementPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'groups' | 'org-access'>('groups');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);

  const { data: groups, isLoading: groupsLoading } = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: async () => { const r = await api.get('/groups'); return r.data; },
  });

  const { data: selectedGroup, refetch: refetchGroup } = useQuery({
    queryKey: ['group', selectedGroupId],
    queryFn: async () => { const r = await api.get(`/groups/${selectedGroupId}`); return r.data; },
    enabled: !!selectedGroupId,
  });

  const { data: members, refetch: refetchMembers } = useQuery<GroupMember[]>({
    queryKey: ['group-members', selectedGroupId],
    queryFn: async () => { const r = await api.get(`/groups/${selectedGroupId}/members`); return r.data; },
    enabled: !!selectedGroupId,
  });

  const { data: orgAccess, isLoading: orgAccessLoading } = useQuery<OrgAccess[]>({
    queryKey: ['org-access'],
    queryFn: async () => { const r = await api.get('/groups/org-access'); return r.data; },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; baseCurrency: string }) => { const r = await api.post('/groups', data); return r.data; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['groups'] }); toast.success('Group created'); setShowCreateModal(false); },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to create group'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { const r = await api.put(`/groups/${id}`, data); return r.data; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['groups'] }); refetchGroup(); toast.success('Group updated'); },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to update group'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const r = await api.delete(`/groups/${id}`); return r.data; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['groups'] }); setSelectedGroupId(null); toast.success('Group deleted'); },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to delete group'),
  });

  const addMemberMutation = useMutation({
    mutationFn: async (data: any) => { const r = await api.post(`/groups/${selectedGroupId}/members`, data); return r.data; },
    onSuccess: () => { refetchMembers(); toast.success('Member added'); setShowAddMember(false); },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to add member'),
  });

  const updateMemberMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { const r = await api.put(`/groups/members/${id}`, data); return r.data; },
    onSuccess: () => { refetchMembers(); setEditingMember(null); toast.success('Member updated'); },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to update member'),
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (id: string) => { const r = await api.delete(`/groups/members/${id}`); return r.data; },
    onSuccess: () => { refetchMembers(); toast.success('Member removed'); },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to remove member'),
  });

  const switchOrgMutation = useMutation({
    mutationFn: async (orgId: string) => { const r = await api.post('/groups/switch-org', { orgId }); return r.data; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['org-access'] }); toast.success('Active organisation switched'); },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to switch org'),
  });

  const handleDeleteGroup = (id: string) => {
    if (!confirm('Delete this group? This action cannot be undone.')) return;
    deleteMutation.mutate(id);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Group Management</h1>
        <p className="text-sm text-slate-500 mt-1">Manage multi-company groups, consolidation settings, and org access.</p>
      </div>

      <div className="flex gap-4 mb-6 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('groups')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'groups' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <Users className="w-4 h-4 inline mr-1.5" />Groups
        </button>
        <button
          onClick={() => setActiveTab('org-access')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'org-access' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <Building2 className="w-4 h-4 inline mr-1.5" />Org Access
        </button>
      </div>

      {activeTab === 'groups' && (
        <div className="space-y-4">
          {groupsLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2" />Loading groups...</div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">{(groups || []).length} group{(groups || []).length !== 1 ? 's' : ''}</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-all"
                >
                  <Plus className="w-4 h-4" /> New Group
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(groups || []).map((g) => (
                  <div
                    key={g.id}
                    onClick={() => setSelectedGroupId(selectedGroupId === g.id ? null : g.id)}
                    className={`bg-white rounded-xl border p-5 cursor-pointer transition-all ${
                      selectedGroupId === g.id ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                          <Globe className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{g.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{g.baseCurrency} &middot; {g.memberCount || 0} member{g.memberCount !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g.id); }}
                          className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                          title="Delete group"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {(groups || []).length === 0 && (
                <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
                  <Globe className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-500">No Groups Yet</h3>
                  <p className="text-xs text-slate-400 mt-1">Create a group to manage multi-company consolidation.</p>
                </div>
              )}
            </>
          )}

          {selectedGroupId && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">{selectedGroup?.name || 'Group'}</h2>
                  <p className="text-xs text-slate-500">Base currency: {selectedGroup?.baseCurrency || 'NGN'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const name = prompt('Group name', selectedGroup?.name);
                      if (name && name.trim()) updateMutation.mutate({ id: selectedGroupId, data: { name: name.trim() } });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><Users className="w-4 h-4 text-slate-400" /> Members</h3>
                  <button
                    onClick={() => setShowAddMember(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add Member
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide">
                        <th className="text-left py-2 pr-3 font-semibold">Org Name</th>
                        <th className="text-right py-2 px-3 font-semibold">Ownership</th>
                        <th className="text-center py-2 px-3 font-semibold">Method</th>
                        <th className="text-center py-2 px-3 font-semibold">Parent</th>
                        <th className="text-right py-2 pl-3 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(members || []).map((m) => (
                        <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="py-2.5 pr-3 font-medium text-slate-800">{m.orgName}</td>
                          <td className="py-2.5 px-3 text-right text-slate-600">{fmtPct(m.ownershipPercentage)}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${METHOD_COLORS[m.consolidationMethod] || 'bg-slate-100 text-slate-600'}`}>
                              {METHOD_LABELS[m.consolidationMethod] || m.consolidationMethod}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">{m.isParent ? <Star className="w-3.5 h-3.5 text-amber-500 inline" /> : '—'}</td>
                          <td className="py-2.5 pl-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setEditingMember(m)}
                                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => { if (confirm('Remove this member?')) removeMemberMutation.mutate(m.id); }}
                                className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                                title="Remove"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(members || []).length === 0 && <p className="text-xs text-slate-400 py-4 text-center">No members. Add an organisation to this group.</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'org-access' && (
        <div className="space-y-3">
          {orgAccessLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2" />Loading...</div>
          ) : (
            (orgAccess || []).map((o) => (
              <div key={o.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${o.isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{o.name}</p>
                    <p className="text-xs text-slate-500 capitalize">{o.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {o.isActive && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">Active</span>}
                  {!o.isActive && (
                    <button
                      onClick={() => switchOrgMutation.mutate(o.id)}
                      disabled={switchOrgMutation.isPending}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50"
                    >
                      Set Active
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
          {(orgAccess || []).length === 0 && !orgAccessLoading && (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
              <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-500">No Org Access</h3>
              <p className="text-xs text-slate-400 mt-1">You do not have access to any organisations.</p>
            </div>
          )}
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && <CreateGroupModal onClose={() => setShowCreateModal(false)} onCreate={(data) => createMutation.mutate(data)} />}

      {/* Add Member Modal */}
      {showAddMember && selectedGroupId && (
        <MemberModal
          title="Add Member"
          orgs={(orgAccess || []).filter(o => !(members || []).find((m: any) => m.orgId === o.id))}
          onSave={(data) => addMemberMutation.mutate(data)}
          onClose={() => setShowAddMember(false)}
        />
      )}

      {/* Edit Member Modal */}
      {editingMember && (
        <MemberModal
          title="Edit Member"
          orgs={[]}
          initial={editingMember}
          onSave={(data) => updateMemberMutation.mutate({ id: editingMember.id, data })}
          onClose={() => setEditingMember(null)}
        />
      )}
    </div>
  );
}

function CreateGroupModal({ onClose, onCreate }: { onClose: () => void; onCreate: (data: { name: string; baseCurrency: string }) => void }) {
  const [name, setName] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('NGN');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900">Create Group</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Group Name</label>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
              placeholder="e.g. Skyhouse Group"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Base Currency</label>
            <select
              value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white"
            >
              <option value="NGN">NGN</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">Cancel</button>
          <button
            onClick={() => { if (name.trim()) onCreate({ name: name.trim(), baseCurrency }); }}
            disabled={!name.trim()}
            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all"
          >
            Create Group
          </button>
        </div>
      </div>
    </div>
  );
}

function MemberModal({
  title,
  orgs,
  initial,
  onSave,
  onClose,
}: {
  title: string;
  orgs: OrgAccess[];
  initial?: any;
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const [orgId, setOrgId] = useState(initial?.orgId || '');
  const [ownershipPercentage, setOwnershipPercentage] = useState(initial?.ownershipPercentage || 100);
  const [consolidationMethod, setConsolidationMethod] = useState(initial?.consolidationMethod || 'full');
  const [isParent, setIsParent] = useState(initial?.isParent || false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          {!initial && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Organisation</label>
              <select
                value={orgId} onChange={(e) => setOrgId(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white"
              >
                <option value="">Select organisation...</option>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Ownership %</label>
            <input
              type="number" value={ownershipPercentage}
              onChange={(e) => setOwnershipPercentage(Number(e.target.value))}
              min={0} max={100} step={0.1}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Consolidation Method</label>
            <select
              value={consolidationMethod} onChange={(e) => setConsolidationMethod(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white"
            >
              <option value="full">Full</option>
              <option value="equity">Equity</option>
              <option value="proportionate">Proportionate</option>
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isParent} onChange={(e) => setIsParent(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <span className="text-sm text-slate-700">Is Parent Organisation</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">Cancel</button>
          <button
            onClick={() => {
              if (!initial && !orgId) return;
              onSave({ orgId: orgId || initial?.orgId, ownershipPercentage, consolidationMethod, isParent });
            }}
            disabled={!initial && !orgId}
            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
