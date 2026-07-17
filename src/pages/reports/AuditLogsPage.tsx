import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { auditLogApi, api, orgApi, printWindow } from '../../lib/api';
import { Loader2, AlertCircle, Search, Download, RefreshCw, Shield, ShieldAlert, AlertTriangle, Info, History, ExternalLink, ChevronDown, ChevronUp, Eye, Edit3, Trash2, FileText, Fingerprint, Hash, Link2 } from 'lucide-react';
import { exportToCsv } from '../../lib/csvTemplates';

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtDateShort(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const ENTITY_ROUTES: Record<string, { path: string; label: (id: string) => string }> = {
  contact: { path: '/sales/customers', label: () => 'View Customer' },
  customer: { path: '/sales/customers', label: () => 'View Customer' },
  vendor: { path: '/purchases/vendors', label: () => 'View Vendor' },
  invoice: { path: '/sales/invoices', label: (id) => `View Invoice` },
  bill: { path: '/purchases/bills', label: (id) => `View Bill` },
  payment: { path: '/sales/payments', label: () => 'View Payment' },
  expense: { path: '/purchases/expenses', label: () => 'View Expense' },
  'journal-entry': { path: '/accounting/journal', label: () => 'View in GL' },
  journal_entry: { path: '/accounting/journal', label: () => 'View in GL' },
  'journal-entry-line': { path: '/accounting/journal', label: () => 'View in GL' },
  quote: { path: '/sales/quotes', label: () => 'View Quote' },
  'sales-order': { path: '/sales/orders', label: () => 'View Order' },
  'purchase-order': { path: '/purchases/orders', label: () => 'View Order' },
  'vendor-credit': { path: '/purchases/vendor-credits', label: () => 'View Credit' },
  'credit-note': { path: '/sales/credit-notes', label: () => 'View Credit Note' },
  'fixed-asset': { path: '/accounting/fixed-assets', label: () => 'View Asset' },
  'bank-account': { path: '/banking/accounts', label: () => 'View Account' },
  organisation: { path: '/settings', label: () => 'View Settings' },
  user: { path: '/settings/users', label: () => 'View User' },
  session: { path: '', label: () => '' },
  'ai_service': { path: '', label: () => '' },
};

const ACTION_STYLES: Record<string, { icon: any; color: string; bg: string; border: string }> = {
  create: { icon: Edit3, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  update: { icon: Edit3, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  delete: { icon: Trash2, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  login: { icon: Fingerprint, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  logout: { icon: Fingerprint, color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-200' },
  AI_CALL: { icon: FileText, color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
};

function getActionStyle(action: string) {
  const lower = action.toLowerCase();
  if (lower === 'login') return ACTION_STYLES.login;
  if (lower === 'logout') return ACTION_STYLES.logout;
  if (lower.startsWith('ai_')) return ACTION_STYLES.AI_CALL;
  if (lower.startsWith('create') || lower.includes('create')) return ACTION_STYLES.create;
  if (lower.startsWith('update') || lower.includes('update')) return ACTION_STYLES.update;
  if (lower.startsWith('delete') || lower.includes('delete')) return ACTION_STYLES.delete;
  return { icon: Eye, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' };
}

function DiffView({ oldValues, newValues }: { oldValues: Record<string, any>; newValues: Record<string, any> }) {
  const allKeys = [...new Set([...Object.keys(oldValues || {}), ...Object.keys(newValues || {})])]
    .filter(k => k !== 'updatedAt' && k !== 'createdAt');
  if (allKeys.length === 0) return <span className="text-xs text-slate-400 italic">No changed fields</span>;
  return (
    <div className="text-xs font-mono space-y-0.5">
      {allKeys.map(key => {
        const oldVal = oldValues?.[key];
        const newVal = newValues?.[key];
        const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);
        return (
          <div key={key} className={`flex gap-2 ${changed ? '' : 'opacity-40'}`}>
            <span className="text-slate-500 min-w-[100px]">{key}:</span>
            {changed ? (
              <>
                <span className="text-red-600 line-through flex-1">{oldVal === undefined ? '∅' : JSON.stringify(oldVal)}</span>
                <span className="text-emerald-600 flex-1">{newVal === undefined ? '∅' : JSON.stringify(newVal)}</span>
              </>
            ) : (
              <span className="text-slate-600 flex-1">{JSON.stringify(oldVal)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface Anomaly {
  transactionId: string;
  reason: string;
  severity: 'low' | 'medium' | 'high';
  date?: string;
  description?: string;
  amountKobo?: number;
  _count?: number;
  _groupKey?: string;
  _txIds?: string[];
}

const THREAT_META: Record<string, { icon: any; color: string; bg: string; border: string; badge: string }> = {
  low: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700 border-blue-200' },
  medium: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  high: { icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700 border-red-200' },
};

function getSourceLinkForAlert(alert: Anomaly): { path: string; label: string } | null {
  const desc = (alert.description || '').toLowerCase();
  if (desc.includes('payment received') || desc.includes('ref-') || desc.includes('txn-')) {
    return { path: '/sales/payments', label: 'View Payments' };
  }
  if (desc.includes('payment made') || desc.includes('bill')) {
    return { path: '/purchases/payments', label: 'View Payments' };
  }
  if (desc.includes('invoice') || desc.includes('inv-')) {
    return { path: '/sales/invoices', label: 'View Invoices' };
  }
  if (desc.includes('expense')) {
    return { path: '/purchases/expenses', label: 'View Expenses' };
  }
  return null;
}

function HashBadge({ hash }: { hash?: string | null }) {
  if (!hash) return null;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-mono text-slate-500" title={`SHA-256: ${hash}`}>
      <Hash className="w-2.5 h-2.5" />
      {hash.substring(0, 12)}…
    </span>
  );
}

export function AuditLogsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'logs' | 'shield'>('logs');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [entityIdFilter, setEntityIdFilter] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [limit] = useState(200);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [chainStatus, setChainStatus] = useState<{ valid: boolean; checkedCount: number } | null>(null);
  const [checkingChain, setCheckingChain] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-logs', actionFilter || '', entityFilter || '', entityIdFilter || '', userIdFilter || '', searchFilter || '', limit],
    queryFn: () => {
      const p: Record<string, any> = { limit };
      if (actionFilter) p.action = actionFilter;
      if (entityFilter) p.entityType = entityFilter;
      if (entityIdFilter) p.entityId = entityIdFilter;
      if (userIdFilter) p.userId = userIdFilter;
      if (searchFilter) p.search = searchFilter;
      return auditLogApi.getLogs(p);
    },
    retry: 1,
  });

  const { data: orgData } = useQuery({ queryKey: ['org'], queryFn: orgApi.getOrg });

  const { data: statsData } = useQuery({
    queryKey: ['audit-stats'],
    queryFn: auditLogApi.getLogStats,
    retry: 1,
  });

  const logs = Array.isArray(data?.data) ? data.data : [];
  const total = data?.total || 0;
  let queryError: string | null = null;
  try {
    queryError = error ? String((error as any)?.response?.data?.error || (error as any)?.message || 'Failed to load audit logs.') : null;
  } catch { queryError = 'Failed to load audit logs.'; }

  const handleVerifyChain = async () => {
    setCheckingChain(true);
    try {
      const res: any = await auditLogApi.verifyChain();
      setChainStatus(res);
    } catch {
      setChainStatus({ valid: false, checkedCount: 0 });
    } finally {
      setCheckingChain(false);
    }
  };

  // Shield tab state
  const [searchTerm, setSearchTerm] = useState('');
  const [threatFilter, setThreatFilter] = useState<string>('all');
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loadingAnomalies, setLoadingAnomalies] = useState(false);
  const [anomaliesError, setAnomaliesError] = useState<string | null>(null);
  const [rescanning, setRescanning] = useState(false);

  const filteredAlerts = anomalies.filter(a => {
    if (threatFilter !== 'all' && a.severity !== threatFilter) return false;
    if (!searchTerm) return true;
    const t = searchTerm.toLowerCase();
    return (a.description || '').toLowerCase().includes(t) || a.reason.toLowerCase().includes(t);
  });

  const counts = {
    all: anomalies.length,
    high: anomalies.filter(a => a.severity === 'high').length,
    medium: anomalies.filter(a => a.severity === 'medium').length,
    low: anomalies.filter(a => a.severity === 'low').length,
  };

  const runAnomalyScan = async () => {
    setLoadingAnomalies(true);
    setAnomaliesError(null);
    try {
      let combinedTxns: any[] = [];
      const accountsRes = await api.get('/banking/accounts');
      if (accountsRes.data && accountsRes.data.length > 0) {
        const txnsRes = await api.get(`/banking/accounts/${accountsRes.data[0].id}/transactions`, { params: { limit: 200 } });
        if (txnsRes.data?.transactions?.length) {
          combinedTxns = txnsRes.data.transactions.map((t: any) => ({ id: t.id, description: t.description || t.reference || '', amount: t.amount || 0, date: t.date?.split('T')[0] }));
        }
      }
      if (combinedTxns.length === 0) {
        const pmtRes = await api.get('/sales/payments', { params: { limit: 200 } });
        if (pmtRes.data?.length) {
          combinedTxns = pmtRes.data.map((p: any) => ({ id: p.id, description: p.description || p.reference || 'Payment received', amount: p.amount || 0, date: p.date?.split('T')[0] }));
        }
      }
      if (combinedTxns.length === 0) {
        const pmtRes = await api.get('/purchases/payments', { params: { limit: 200 } });
        if (pmtRes.data?.length) {
          combinedTxns = pmtRes.data.map((p: any) => ({ id: p.id, description: p.description || p.reference || 'Payment made', amount: p.amount || 0, date: p.date?.split('T')[0] }));
        }
      }
      if (combinedTxns.length === 0) {
        const invRes = await api.get('/invoices', { params: { limit: 200 } });
        if (Array.isArray(invRes.data) && invRes.data.length > 0) {
          combinedTxns = invRes.data.map((i: any) => ({ id: i.id, description: i.description || `Invoice ${i.invoiceNumber}`, amount: i.total || 0, date: i.date?.split('T')[0] }));
        }
      }
      if (combinedTxns.length === 0) {
        setAnomalies([]);
        setLoadingAnomalies(false);
        return;
      }
      const scanRes = await api.post('/ai/detect-anomalies', { transactions: combinedTxns });
      if (scanRes.data?.success) {
        const enriched = scanRes.data.data.map((anom: Anomaly) => {
          const match = combinedTxns.find((t) => t.id === anom.transactionId);
          return { ...anom, date: match?.date, description: match?.description, amountKobo: match?.amount || match?.amountKobo };
        });
        const groups = new Map<string, Anomaly & { _txIds: string[] }>();
        for (const a of enriched) {
          const key = `${a.description}|${a.amountKobo}|${a.reason}`;
          if (groups.has(key)) {
            const g = groups.get(key)!;
            g._txIds.push(a.transactionId);
          } else {
            groups.set(key, { ...a, _txIds: [a.transactionId] });
          }
        }
        const grouped = Array.from(groups.values()).map(g => ({ ...g, _count: g._txIds.length, _groupKey: g._txIds.length > 1 ? 'grouped' : 'single' }));
        setAnomalies(grouped);
      }
    } catch (err: any) {
      setAnomaliesError(err.response?.data?.error || 'Unable to execute transaction scan.');
    } finally {
      setLoadingAnomalies(false);
    }
  };

  React.useEffect(() => {
    if (tab === 'shield' && anomalies.length === 0 && !loadingAnomalies) {
      runAnomalyScan();
    }
  }, [tab]);

  function exportAuditLogsCSV() {
    const today = new Date().toISOString().split('T')[0];
    const headers = ['Timestamp', 'Action', 'Entity Type', 'Entity ID', 'User', 'Description', 'IP Address', 'User Agent', 'Correlation ID', 'Hash'];
    const rows = logs.map((l: any) => [
      l.createdAt ? new Date(l.createdAt).toLocaleString('en-GB') : '',
      l.action||'', l.entityType||'', l.entityId||'',
      l.user?.name||l.user?.email||'', l.description||'',
      l.ipAddress||'', l.userAgent||'', l.correlationId||'', l.hash||''
    ]);
    exportToCsv(`audit_logs_${today}.csv`, headers, rows);
  }

  function exportShieldCSV() {
    const today = new Date().toISOString().split('T')[0];
    const headers = ['Description', 'Reason', 'Label', 'Threat', 'Date', 'Amount', 'Occurrences'];
    const rows = filteredAlerts.map(a => [a.description || '', a.reason, a.severity === 'high' ? 'Critical' : a.severity === 'medium' ? 'Suspicious' : 'Info', a.severity, a.date ? fmtDateShort(a.date) : '', a.amountKobo ? fmtNaira(a.amountKobo) : '', a._count && a._count > 1 ? String(a._count) : '1']);
    exportToCsv(`audit_shield_${today}.csv`, headers, rows);
  }

  const handleDownloadPdf = () => {
    try {
      const org = (orgData as any)?.data || orgData || {};
      const orgName = org.name || '';
      const orgAddr = org.address ? `<p style="margin:0;font-size:11px;color:#475569">${org.address}</p>` : '';
      const orgPhone = org.phone || '';
      const orgEmail = org.email || '';
      const orgWebsite = org.website || '';
      const orgLogo = org.logoUrl ? `<img src="${org.logoUrl}" style="max-height:60px;max-width:200px;object-fit:contain" />` : '';
      const contactInfo = [orgPhone, orgEmail, orgWebsite].filter(Boolean).join(' | ');

      const list = data?.data || [];
      const rows = list.map((l: any) =>
        `<tr><td style="padding:6px 10px;font-size:11px;border-bottom:1px solid #f1f5f9">${new Date(l.createdAt).toLocaleDateString('en-GB')}</td><td style="padding:6px 10px;font-size:11px;border-bottom:1px solid #f1f5f9"><span style="background:#f1f5f9;padding:2px 8px;border-radius:999px;font-size:10px">${l.action}</span></td><td style="padding:6px 10px;font-size:11px;border-bottom:1px solid #f1f5f9">${l.entityType}</td><td style="padding:6px 10px;font-size:11px;font-family:monospace;border-bottom:1px solid #f1f5f9">${l.entityId||'—'}</td><td style="padding:6px 10px;font-size:11px;border-bottom:1px solid #f1f5f9">${l.user?.name||l.user?.email||'—'}</td><td style="padding:6px 10px;font-size:11px;border-bottom:1px solid #f1f5f9">${l.description||'—'}</td><td style="padding:6px 10px;font-size:11px;border-bottom:1px solid #f1f5f9">${l.ipAddress||'—'}</td><td style="padding:6px 10px;font-size:11px;color:#94a3b8;border-bottom:1px solid #f1f5f9">${l.userAgent ? l.userAgent.substring(0, 50) : '—'}</td></tr>`
      ).join('');
      printWindow('Audit Logs',
        `<div style="text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #e2e8f0">
          ${orgLogo}
          <h1 style="margin:4px 0;font-size:18px;color:#0f172a">${orgName}</h1>
          ${orgAddr}
          <p style="margin:2px 0;font-size:11px;color:#64748b">${contactInfo}</p>
        </div>
        <h2 style="font-size:16px;color:#0f172a;margin:0 0 8px">Audit Logs</h2>
        <p style="font-size:11px;color:#64748b;margin:0 0 12px">${list.length} entries</p>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:#f8fafc">
            <th style="padding:8px 10px;font-size:10px;font-weight:600;color:#64748b;text-align:left;text-transform:uppercase">Date</th>
            <th style="padding:8px 10px;font-size:10px;font-weight:600;color:#64748b;text-align:left;text-transform:uppercase">Action</th>
            <th style="padding:8px 10px;font-size:10px;font-weight:600;color:#64748b;text-align:left;text-transform:uppercase">Entity</th>
            <th style="padding:8px 10px;font-size:10px;font-weight:600;color:#64748b;text-align:left;text-transform:uppercase">Entity ID</th>
            <th style="padding:8px 10px;font-size:10px;font-weight:600;color:#64748b;text-align:left;text-transform:uppercase">User</th>
            <th style="padding:8px 10px;font-size:10px;font-weight:600;color:#64748b;text-align:left;text-transform:uppercase">Description</th>
            <th style="padding:8px 10px;font-size:10px;font-weight:600;color:#64748b;text-align:left;text-transform:uppercase">IP Address</th>
            <th style="padding:8px 10px;font-size:10px;font-weight:600;color:#64748b;text-align:left;text-transform:uppercase">User Agent</th>
          </tr></thead>
          <tbody>${rows||'<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:20px">No records</td></tr>'}</tbody>
        </table>`,
        `${list.length} entries`
      );
    } catch (err) {
      alert('Failed to open print window: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-1 w-fit">
        <button onClick={() => setTab('logs')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200 ${tab === 'logs' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
          <History className="w-4 h-4" /> Audit Logs
        </button>
        <button onClick={() => setTab('shield')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200 ${tab === 'shield' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
          <Shield className="w-4 h-4" /> Audit-Shield
        </button>
      </div>

      {tab === 'logs' && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
              {total > 0 && <span className="text-xs text-slate-400">{total} total entries</span>}
              {statsData?.dateRange?.earliest && (
                <span className="text-[10px] text-slate-400">From {fmtDateShort(statsData.dateRange.earliest)}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleVerifyChain} disabled={checkingChain}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all duration-200 disabled:opacity-50">
                <Link2 className={`w-3.5 h-3.5 ${checkingChain ? 'animate-spin' : ''}`} /> {checkingChain ? 'Checking...' : 'Verify Chain'}
              </button>
              {chainStatus && (
                <span className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-xl ${chainStatus.valid ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {chainStatus.valid ? '✓ Chain Intact' : '✗ Chain Broken'} ({chainStatus.checkedCount} entries)
                </span>
              )}
              <button onClick={exportAuditLogsCSV} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all duration-200"><Download className="w-3.5 h-3.5" /> CSV</button>
              <button onClick={handleDownloadPdf} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200"><Download className="w-3.5 h-3.5" /> PDF</button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-center bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input placeholder="Filter by action..." value={actionFilter} onChange={e => { setActionFilter(e.target.value); }} className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
            </div>
            <input placeholder="Entity type..." value={entityFilter} onChange={e => setEntityFilter(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
            <input placeholder="Entity ID..." value={entityIdFilter} onChange={e => setEntityIdFilter(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm w-36 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
            <input placeholder="User ID..." value={userIdFilter} onChange={e => setUserIdFilter(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm w-36 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
            <input placeholder="Full-text search..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm flex-1 min-w-[120px] focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
          ) : error ? (
            <div className="flex items-start gap-3 p-5 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Failed to load audit logs</p>
                <p className="text-xs mt-1 text-red-500/80">{queryError}</p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-3 py-3">Timestamp</th>
                    <th className="text-left px-3 py-3">Action</th>
                    <th className="text-left px-3 py-3">Entity</th>
                    <th className="text-left px-3 py-3">Description</th>
                    <th className="text-left px-3 py-3">Changes</th>
                    <th className="text-left px-3 py-3">User</th>
                    <th className="text-left px-3 py-3">Source</th>
                    <th className="text-left px-3 py-3">Hash</th>
                    <th className="text-left px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log: any) => {
                    const as = getActionStyle(log.action);
                    const ActionIcon = as.icon;
                    const entityRoute = ENTITY_ROUTES[log.entityType] || ENTITY_ROUTES[log.entityType?.replace(/_/g, '-')];
                    const hasDiff = log.oldValues && log.newValues && Object.keys(log.oldValues).length > 0;
                    const isExpanded = expandedRow === log.id;
                    return (
                      <React.Fragment key={log.id}>
                        <tr className={`border-t border-slate-100 transition-colors ${isExpanded ? 'bg-indigo-50/50' : 'hover:bg-slate-50/50 even:bg-slate-50/50'}`}>
                          <td className="px-3 py-3 text-slate-600 whitespace-nowrap text-xs">{fmtDate(log.createdAt)}</td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${as.border} ${as.bg} ${as.color}`}>
                              <ActionIcon className="w-3 h-3" /> {log.action}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="text-slate-600 text-xs font-medium">{log.entityType}</div>
                            {log.entityId && entityRoute?.path ? (
                              <Link to={`${entityRoute.path}/${log.entityId}`} className="text-indigo-600 hover:text-indigo-800 hover:underline text-[11px] font-mono inline-flex items-center gap-1">
                                {log.entityId.slice(0, 8)}… <ExternalLink className="w-3 h-3" />
                              </Link>
                            ) : (
                            <span className="text-slate-400 text-[11px] font-mono">{log.entityId ? log.entityId.slice(0, 8) + '…' : '—'}</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-600 max-w-[180px] truncate" title={log.description || ''}>
                            {log.description || <span className="text-slate-300 italic">—</span>}
                          </td>
                          <td className="px-3 py-3">
                            {hasDiff ? (
                              <button onClick={() => setExpandedRow(isExpanded ? null : log.id)} className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                {isExpanded ? 'Hide' : `${Object.keys(log.newValues || {}).length} fields`}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-600">{log.user?.name || log.user?.email || '—'}</td>
                          <td className="px-3 py-3 text-xs text-slate-400">
                            <div>{log.ipAddress || '—'}</div>
                            {log.userAgent && <div className="text-[10px] text-slate-300 truncate max-w-[120px]" title={log.userAgent}>{log.userAgent.slice(0, 40)}…</div>}
                          </td>
                          <td className="px-3 py-3"><HashBadge hash={log.hash} /></td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1">
                              {entityRoute?.path && log.entityId && (
                                <Link to={`${entityRoute.path}/${log.entityId}`}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline whitespace-nowrap">
                                  <Eye className="w-3 h-3" /> View
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-slate-50 border-t border-indigo-100">
                            <td colSpan={9} className="px-3 py-4 space-y-3">
                              {hasDiff && (
                                <div>
                                  <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Field Changes</div>
                                  <DiffView oldValues={log.oldValues} newValues={log.newValues} />
                                  <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                                    <span className="text-red-600">◀ strikethrough</span> = old value
                                    <span className="text-emerald-600 ml-2">▶</span> = new value
                                  </div>
                                </div>
                              )}
                              {(log.correlationId || log.hash || log.previousHash) && (
                                <div className="border-t border-slate-200 pt-2">
                                  <div className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Integrity Metadata</div>
                                  <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
                                    {log.correlationId && <div><span className="text-slate-400">Correlation:</span> <span className="text-slate-700">{log.correlationId}</span></div>}
                                    {log.hash && <div><span className="text-slate-400">Hash:</span> <span className="text-slate-700">{log.hash}</span></div>}
                                    {log.previousHash && <div><span className="text-slate-400">Prev Hash:</span> <span className="text-slate-700">{log.previousHash}</span></div>}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {logs.length === 0 && (
                    <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-400">No audit log entries found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'shield' && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                <Shield className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Audit-Shield</h1>
                <p className="text-sm text-slate-500">AI-powered transaction monitoring & threat detection</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={exportShieldCSV} disabled={filteredAlerts.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all duration-200 disabled:opacity-50"><Download className="w-4 h-4" /> CSV</button>
              <button onClick={async () => { setRescanning(true); await runAnomalyScan(); setRescanning(false); }} disabled={rescanning || loadingAnomalies}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all duration-200 disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 ${rescanning ? 'animate-spin' : ''}`} /> {rescanning ? 'Scanning...' : 'Rescan'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            {(['all', 'high', 'medium', 'low'] as const).map(t => {
              const meta = t === 'all' ? { badge: 'bg-slate-100 text-slate-700' } : THREAT_META[t];
              return (
                <button key={t} onClick={() => setThreatFilter(t)}
                  className={`text-left p-5 rounded-2xl border transition-all duration-200 bg-white shadow-sm ${
                    threatFilter === t ? 'ring-2 ring-indigo-500 border-indigo-500 bg-white' : 'border-slate-200/80 hover:border-slate-300'
                  }`}>
                  <p className="text-2xl font-bold text-slate-900">{counts[t]}</p>
                  <p className="text-xs font-semibold mt-0.5 capitalize"><span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${meta.badge}`}>{t === 'all' ? 'Total' : t}</span></p>
                </button>
              );
            })}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search alerts..." className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
          </div>

          {loadingAnomalies ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
          ) : anomaliesError ? (
            <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-xl text-sm"><AlertCircle className="w-4 h-4" /> {anomaliesError}</div>
          ) : (
            <div className="space-y-3">
              {filteredAlerts.map((alert, i) => {
                const meta = THREAT_META[alert.severity];
                const Icon = meta.icon;
                const navLink = getSourceLinkForAlert(alert);
                return (
                  <div key={alert.transactionId || i}
                    className={`bg-white rounded-2xl border ${meta.border} p-5 hover:shadow-md transition-all shadow-sm ${navLink ? 'cursor-pointer hover:border-indigo-300 hover:ring-1 hover:ring-indigo-200' : ''}`}
                    onClick={() => { if (navLink) navigate(navLink.path); }}>
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-2xl ${meta.bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-5 h-5 ${meta.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-slate-900">{alert.description || 'Transaction Alert'}</h3>
                              {navLink && <ExternalLink className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">{alert.reason}</p>
                            {alert._count && alert._count > 1 && (
                              <p className="text-xs font-semibold text-amber-600 mt-1.5">{alert._count} occurrences • {alert._txIds?.length || alert._count} transactions on this date</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${meta.badge}`}>{alert.severity} Threat</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                          {alert.date && <span>{fmtDateShort(alert.date)}</span>}
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-slate-200 bg-slate-100 text-slate-600`}>{alert.severity === 'high' ? 'Critical' : alert.severity === 'medium' ? 'Suspicious' : 'Informational'}</span>
                        </div>
                        {alert.amountKobo && (
                          <div className="mt-2">
                            <span className="text-xs font-semibold text-slate-500 uppercase">Indexed sum:</span>
                            <p className="text-lg font-bold text-slate-900 font-mono">{fmtNaira(alert.amountKobo)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    {navLink && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <span className="text-xs font-semibold text-indigo-600 inline-flex items-center gap-1">Click to view source <ExternalLink className="w-3 h-3" /></span>
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredAlerts.length === 0 && !loadingAnomalies && (
                <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
                  <Shield className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm font-medium">{anomalies.length === 0 ? 'No threats detected. Run a scan to check transactions.' : 'No threats match your filter.'}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
