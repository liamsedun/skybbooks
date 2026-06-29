import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditLogApi, printWindow } from '../../lib/api';
import { Loader2, AlertCircle, Search, Download } from 'lucide-react';
import { exportToCsv } from '../../lib/csvTemplates';

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function AuditLogsPage() {
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [limit] = useState(200);

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-logs', actionFilter, entityFilter, limit],
    queryFn: () => auditLogApi.getLogs({ action: actionFilter || undefined, entityType: entityFilter || undefined, limit }),
  });

  const logs = data?.data || [];

  function exportAuditLogsCSV() {
    const today = new Date().toISOString().split('T')[0];
    const headers = ['Timestamp', 'Action', 'Entity Type', 'Entity ID', 'User', 'Details'];
    const rows = logs.map((l: any) => [l.createdAt ? new Date(l.createdAt).toLocaleString('en-GB') : '', l.action||'', l.entityType||'', l.entityId||'', l.user?.name||l.user?.email||'', typeof l.details === 'object' ? JSON.stringify(l.details) : (l.details||'')]);
    exportToCsv(`audit_logs_${today}.csv`, headers, rows);
  }

  const handleDownloadPdf = () => {
    const list = data?.data || [];
    const rows = list.map((l: any) =>
      `<tr><td>${new Date(l.createdAt).toLocaleDateString('en-GB')}</td><td>${l.action||''}</td><td>${l.entityType||''}</td><td>${l.entityId||''}</td><td>${l.performedBy||''}</td></tr>`
    ).join('');
    printWindow('Audit Logs', `<table><thead><tr><th>Date</th><th>Action</th><th>Entity</th><th>ID</th><th>User</th></tr></thead><tbody>${rows||'<tr><td colspan="5" style="text-align:center;color:#94a3b8">No records</td></tr>'}</tbody></table>`, `${list.length} entries`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
        <div className="flex items-center gap-3">
          {data?.total !== undefined && (
            <span className="text-xs text-slate-400">{data.total} total entries</span>
          )}
          <button onClick={exportAuditLogsCSV} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={handleDownloadPdf} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"><Download className="w-3.5 h-3.5" /> PDF</button>
        </div>
      </div>

      <div className="flex gap-4 items-center bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400" />
          <input placeholder="Filter by action..." value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-48" />
        </div>
        <input placeholder="Filter by entity..." value={entityFilter} onChange={e => setEntityFilter(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-48" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : error ? (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-xl text-sm"><AlertCircle className="w-4 h-4" /> Failed to load audit logs.</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Timestamp</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Action</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Entity Type</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Entity ID</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">IP Address</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any) => (
                <tr key={log.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtDate(log.createdAt)}</td>
                  <td className="px-4 py-3"><span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-600">{log.action}</span></td>
                  <td className="px-4 py-3 text-slate-600">{log.entityType}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 max-w-[120px] truncate">{log.entityId || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{log.ipAddress || '—'}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No audit log entries found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
