import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  ClipboardList, Search, Filter, ChevronDown, Loader2, RefreshCw,
  Calendar, User, Building2,
} from 'lucide-react';

function fmtDateTime(d: string) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

interface AuditEntry {
  id: string; action: string; entityType: string; entityId: string; description?: string;
  createdAt: string; userName?: string; orgName?: string; ipAddress?: string; userAgent?: string;
}

const ACTION_STYLES: Record<string, string> = {
  CREATE: 'bg-emerald-100 text-emerald-700',
  UPDATE: 'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-700',
  LOGIN: 'bg-blue-100 text-blue-700',
};

const ACTIONS = ['', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN'];

export function PlatformAuditLogPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [showFilter, setShowFilter] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['platform-audit-logs', page, search, actionFilter],
    queryFn: async () => {
      const params: any = { page, pageSize: 30 };
      if (search) params.search = search;
      if (actionFilter) params.action = actionFilter;
      const res = await api.get('/platform/audit-logs', { params });
      return res.data.data as { data: AuditEntry[]; total: number; page: number; pageSize: number };
    },
  });

  const totalPages = data ? Math.ceil(data.total / 30) : 1;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Audit Log</h1>
          <p className="text-sm text-ink-500 mt-1">Platform-wide audit trail across all organizations</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-2 text-sm bg-surface border rounded-lg hover:bg-surface-hover">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input
            type="text" placeholder="Search by user, org, entity..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="relative">
          <button onClick={() => setShowFilter(!showFilter)} className="flex items-center gap-2 px-3 py-2 text-sm bg-surface border rounded-lg hover:bg-surface-hover">
            <Filter className="w-4 h-4" /> Action <ChevronDown className="w-3 h-3" />
          </button>
          {showFilter && (
            <div className="absolute top-full mt-1 right-0 bg-surface border rounded-lg shadow-lg z-10 w-36">
              {ACTIONS.map(a => (
                <button key={a} onClick={() => { setActionFilter(a); setPage(1); setShowFilter(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-hover ${actionFilter === a ? 'bg-blue-50 text-blue-600' : 'text-ink-700'}`}>
                  {a ? a : 'All Actions'}
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
              <th className="text-left p-3 font-medium text-ink-600">Timestamp</th>
              <th className="text-left p-3 font-medium text-ink-600">User</th>
              <th className="text-left p-3 font-medium text-ink-600">Organization</th>
              <th className="text-left p-3 font-medium text-ink-600">Action</th>
              <th className="text-left p-3 font-medium text-ink-600">Entity</th>
              <th className="text-left p-3 font-medium text-ink-600">Description</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ink-400" /></td></tr>
            ) : !data?.data?.length ? (
              <tr><td colSpan={6} className="p-12 text-center text-ink-400">No audit log entries found</td></tr>
            ) : (
              data.data.map((entry) => (
                <tr key={entry.id} className="border-b hover:bg-surface-hover">
                  <td className="p-3 text-ink-500 text-xs whitespace-nowrap">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDateTime(entry.createdAt)}</span>
                  </td>
                  <td className="p-3">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-ink-400" />
                      <span className="text-ink-700">{entry.userName || 'System'}</span>
                    </span>
                  </td>
                  <td className="p-3 text-ink-600">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-ink-400" />
                      {entry.orgName || '—'}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${ACTION_STYLES[entry.action] || 'bg-surface-hover text-ink-600'}`}>
                      {entry.action}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="text-xs font-mono bg-surface-hover px-1.5 py-0.5 rounded">{entry.entityType}</span>
                    <span className="text-xs text-ink-400 ml-1">#{entry.entityId?.slice(0, 8)}</span>
                  </td>
                  <td className="p-3 text-ink-600 text-xs max-w-xs truncate">{entry.description || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {data && data.total > 30 && (
          <div className="px-3 py-3 border-t flex items-center justify-between">
            <p className="text-xs text-ink-500">Showing {(page - 1) * 30 + 1}–{Math.min(page * 30, data.total)} of {data.total}</p>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 text-sm border rounded hover:bg-surface-hover disabled:opacity-40">Previous</button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 text-sm border rounded hover:bg-surface-hover disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
