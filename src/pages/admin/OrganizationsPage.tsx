import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../lib/api';
import {
  Building2, Search, Filter, ChevronDown, Loader2, X, Users, Mail,
  Calendar, Shield, MoreHorizontal, Clock, CheckCircle2, AlertTriangle,
  Ban, Eye, RefreshCw,
} from 'lucide-react';

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  trial: 'bg-blue-100 text-blue-700',
  expired: 'bg-red-100 text-red-700',
  suspended: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-surface-hover text-ink-600',
};

interface OrgRow {
  id: string; name: string; email: string; createdAt: string;
  subscriptionStatus: string; planName: string;
}

interface OrgDetail {
  org: { id: string; name: string; email: string; phone?: string; address?: string; createdAt: string; logoUrl?: string };
  users: Array<{ id: string; fullName: string; email: string; role: string; isActive: boolean }>;
  subscription: { id: string; planName: string; status: string; startDate?: string; endDate?: string };
}

export function OrganizationsPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['platform-organizations', page, search, statusFilter],
    queryFn: async () => {
      const params: any = { page, pageSize: 20 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/platform/organizations', { params });
      return res.data.data as { data: OrgRow[]; total: number; page: number; pageSize: number };
    },
  });

  const { data: orgDetail } = useQuery({
    queryKey: ['platform-org-detail', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return null;
      const res = await api.get('/platform/organizations/' + selectedOrgId);
      return res.data.data as OrgDetail;
    },
    enabled: !!selectedOrgId,
  });

  const handleStatusUpdate = async (orgId: string, status: string) => {
    try {
      await api.put('/platform/organizations/' + orgId + '/status', { status });
      toast.toast('Organization status updated', 'success');
      refetch();
    } catch (err: any) {
      toast.toast(err.response?.data?.error || 'Failed to update status', 'error');
    }
  };

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Organizations</h1>
          <p className="text-sm text-ink-500 mt-1">Manage all tenant organizations</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-2 text-sm bg-surface border rounded-lg hover:bg-surface-hover">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input
            type="text" placeholder="Search by name or email..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="relative">
          <button onClick={() => setShowFilter(!showFilter)} className="flex items-center gap-2 px-3 py-2 text-sm bg-surface border rounded-lg hover:bg-surface-hover">
            <Filter className="w-4 h-4" /> Status <ChevronDown className="w-3 h-3" />
          </button>
          {showFilter && (
            <div className="absolute top-full mt-1 right-0 bg-surface border rounded-lg shadow-lg z-10 w-40">
              {['', 'active', 'trial', 'expired', 'suspended', 'cancelled'].map(s => (
                <button key={s} onClick={() => { setStatusFilter(s); setPage(1); setShowFilter(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-hover ${statusFilter === s ? 'bg-blue-50 text-blue-600' : 'text-ink-700'}`}>
                  {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-surface rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-surface-subtle">
              <th className="text-left p-3 font-medium text-ink-600">Organization</th>
              <th className="text-left p-3 font-medium text-ink-600">Email</th>
              <th className="text-left p-3 font-medium text-ink-600">Plan</th>
              <th className="text-left p-3 font-medium text-ink-600">Status</th>
              <th className="text-left p-3 font-medium text-ink-600">Created</th>
              <th className="text-right p-3 font-medium text-ink-600 w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ink-400" /></td></tr>
            ) : !data?.data?.length ? (
              <tr><td colSpan={6} className="p-12 text-center text-ink-400">No organizations found</td></tr>
            ) : (
              data.data.map((org) => (
                <tr key={org.id} className="border-b hover:bg-surface-hover">
                  <td className="p-3">
                    <button onClick={() => setSelectedOrgId(org.id)} className="font-medium text-blue-600 hover:underline flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-ink-400" /> {org.name}
                    </button>
                  </td>
                  <td className="p-3 text-ink-600">{org.email}</td>
                  <td className="p-3"><span className="text-xs font-medium text-ink-700 bg-surface-hover px-2 py-0.5 rounded">{org.planName}</span></td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_STYLES[org.subscriptionStatus] || 'bg-surface-hover text-ink-600'}`}>
                      {org.subscriptionStatus}
                    </span>
                  </td>
                  <td className="p-3 text-ink-500">{fmtDate(org.createdAt)}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setSelectedOrgId(org.id)} className="p-1.5 hover:bg-surface-hover rounded" title="View details">
                        <Eye className="w-4 h-4 text-ink-500" />
                      </button>
                      <div className="relative group">
                        <button className="p-1.5 hover:bg-surface-hover rounded"><MoreHorizontal className="w-4 h-4 text-ink-500" /></button>
                        <div className="absolute right-0 top-full mt-1 bg-surface border rounded-lg shadow-lg z-10 hidden group-hover:block min-w-[150px]">
                          {org.subscriptionStatus !== 'active' && (
                            <button onClick={() => handleStatusUpdate(org.id, 'active')} className="w-full text-left px-3 py-2 text-sm text-emerald-600 hover:bg-surface-hover flex items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Set Active
                            </button>
                          )}
                          {org.subscriptionStatus !== 'suspended' && (
                            <button onClick={() => handleStatusUpdate(org.id, 'suspended')} className="w-full text-left px-3 py-2 text-sm text-amber-600 hover:bg-surface-hover flex items-center gap-2">
                              <AlertTriangle className="w-3.5 h-3.5" /> Suspend
                            </button>
                          )}
                          {org.subscriptionStatus !== 'cancelled' && (
                            <button onClick={() => handleStatusUpdate(org.id, 'cancelled')} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-surface-hover flex items-center gap-2">
                              <Ban className="w-3.5 h-3.5" /> Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {data && data.total > 20 && (
          <div className="px-3 py-3 border-t flex items-center justify-between">
            <p className="text-xs text-ink-500">Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, data.total)} of {data.total}</p>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 text-sm border rounded hover:bg-surface-hover disabled:opacity-40">Previous</button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 text-sm border rounded hover:bg-surface-hover disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      {selectedOrgId && orgDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedOrgId(null)}>
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto mx-4" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-surface border-b px-5 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" /> {orgDetail.org.name}
              </h2>
              <button onClick={() => setSelectedOrgId(null)} className="p-1 hover:bg-surface-hover rounded"><X className="w-5 h-5 text-ink-500" /></button>
            </div>
            <div className="p-5 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-ink-500">Email</p><p className="text-sm font-medium flex items-center gap-1.5 mt-0.5"><Mail className="w-3.5 h-3.5 text-ink-400" />{orgDetail.org.email}</p></div>
                <div><p className="text-xs text-ink-500">Phone</p><p className="text-sm font-medium mt-0.5">{orgDetail.org.phone || '—'}</p></div>
                <div><p className="text-xs text-ink-500">Created</p><p className="text-sm font-medium flex items-center gap-1.5 mt-0.5"><Calendar className="w-3.5 h-3.5 text-ink-400" />{fmtDate(orgDetail.org.createdAt)}</p></div>
                <div><p className="text-xs text-ink-500">Plan</p><p className="text-sm font-medium mt-0.5">{orgDetail.subscription.planName}</p></div>
                <div><p className="text-xs text-ink-500">Subscription Status</p><p className="mt-0.5"><span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_STYLES[orgDetail.subscription.status] || 'bg-surface-hover text-ink-600'}`}>{orgDetail.subscription.status}</span></p></div>
                <div><p className="text-xs text-ink-500">Address</p><p className="text-sm font-medium mt-0.5">{orgDetail.org.address || '—'}</p></div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-ink-700 mb-3 flex items-center gap-2"><Users className="w-4 h-4" /> Users ({orgDetail.users.length})</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-surface-subtle">
                      <th className="text-left p-2 font-medium text-ink-600">Name</th>
                      <th className="text-left p-2 font-medium text-ink-600">Email</th>
                      <th className="text-left p-2 font-medium text-ink-600">Role</th>
                      <th className="text-left p-2 font-medium text-ink-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgDetail.users.map(u => (
                      <tr key={u.id} className="border-b hover:bg-surface-hover">
                        <td className="p-2 font-medium">{u.fullName}</td>
                        <td className="p-2 text-ink-600">{u.email}</td>
                        <td className="p-2"><span className="text-xs bg-surface-hover px-2 py-0.5 rounded">{u.role}</span></td>
                        <td className="p-2">{u.isActive ? <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Active</span> : <span className="text-xs text-red-600 flex items-center gap-1"><Ban className="w-3 h-3" /> Inactive</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {orgDetail.subscription && (
                <div>
                  <h3 className="text-sm font-semibold text-ink-700 mb-2 flex items-center gap-2"><Shield className="w-4 h-4" /> Subscription</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-ink-500">Plan:</span> <span className="font-medium">{orgDetail.subscription.planName}</span></div>
                    <div><span className="text-ink-500">Status:</span> <span className="font-medium">{orgDetail.subscription.status}</span></div>
                    {orgDetail.subscription.startDate && <div><span className="text-ink-500">Start:</span> <span className="font-medium">{fmtDate(orgDetail.subscription.startDate)}</span></div>}
                    {orgDetail.subscription.endDate && <div><span className="text-ink-500">End:</span> <span className="font-medium">{fmtDate(orgDetail.subscription.endDate)}</span></div>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
