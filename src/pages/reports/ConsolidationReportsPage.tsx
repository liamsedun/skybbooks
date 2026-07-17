import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Loader2, Play, Download, History, BarChart3, RefreshCw, Eye, CheckCircle2, AlertCircle, X, FileSpreadsheet, Layers, DollarSign, Users, TrendingUp, PieChart } from 'lucide-react';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';

function fmtNaira(v: number): string {
  return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface Group {
  id: string;
  name: string;
}

interface ConsolidationRun {
  id: string;
  reportType: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  totalOrgs: number;
  createdAt: string;
}

interface ConsolidationDetail {
  id: string;
  reportType: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  summary: Record<string, number>;
  orgBreakdown: { orgName: string; ownershipPercentage: number; consolidationMethod: string; metrics: Record<string, number> }[];
  eliminations: { accountName: string; accountCode: string; amount: number; description: string }[];
  nci: { value: number; percentage: number } | null;
}

const REPORT_TYPE_OPTIONS = [
  { value: 'balance_sheet', label: 'Balance Sheet' },
  { value: 'income_statement', label: 'Income Statement' },
  { value: 'cash_flow', label: 'Cash Flow' },
];

const REPORT_TYPE_LABELS: Record<string, string> = {
  balance_sheet: 'Balance Sheet',
  income_statement: 'Income Statement',
  cash_flow: 'Cash Flow',
};

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700' },
  running: { label: 'Running', className: 'bg-blue-100 text-blue-700' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-700' },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700' },
};

export function ConsolidationReportsPage() {
  const [groupId, setGroupId] = useState('');
  const [reportType, setReportType] = useState('balance_sheet');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [includeEliminations, setIncludeEliminations] = useState(true);
  const [includeNci, setIncludeNci] = useState(true);
  const [currencyMethod, setCurrencyMethod] = useState('closing_rate');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const { data: groups } = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: async () => { const r = await api.get('/groups'); return r.data; },
  });

  const { data: history, isLoading: historyLoading, refetch: refetchHistory } = useQuery<ConsolidationRun[]>({
    queryKey: ['consolidation-history', groupId],
    queryFn: async () => { const r = await api.get(`/reports/consolidation/history/${groupId}`); return r.data; },
    enabled: !!groupId,
  });

  const { data: runDetail, isLoading: detailLoading } = useQuery<ConsolidationDetail>({
    queryKey: ['consolidation-run', selectedRunId],
    queryFn: async () => { const r = await api.get(`/reports/consolidation/runs/${selectedRunId}`); return r.data; },
    enabled: !!selectedRunId,
  });

  const runMutation = useMutation({
    mutationFn: async (data: any) => { const r = await api.post('/reports/consolidation/run', data); return r.data; },
    onSuccess: (result) => { toast.success('Consolidation run completed'); refetchHistory(); setSelectedRunId(result.id); },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Consolidation run failed'),
  });

  const eliminateMutation = useMutation({
    mutationFn: async (data: any) => { const r = await api.post('/reports/consolidation/eliminate', data); return r.data; },
    onSuccess: () => { toast.success('Elimination entries generated'); refetchHistory(); },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Elimination failed'),
  });

  const handleRun = () => {
    if (!groupId) { toast.error('Select a group'); return; }
    if (!periodStart || !periodEnd) { toast.error('Select period dates'); return; }
    runMutation.mutate({
      groupId,
      reportType,
      periodStart,
      periodEnd,
      options: { includeEliminations, includeNci, currencyTranslationMethod: currencyMethod },
    });
  };

  const handleEliminate = () => {
    if (!groupId) { toast.error('Select a group'); return; }
    if (!periodStart || !periodEnd) { toast.error('Select period dates'); return; }
    eliminateMutation.mutate({ groupId, reportType, periodStart, periodEnd });
  };

  const handleExportCsv = () => {
    if (!runDetail) return;
    const rows: string[][] = [];
    const header = ['Metric', ...(runDetail.orgBreakdown || []).map((o) => o.orgName), 'Consolidated'];
    rows.push(header);
    if (runDetail.summary) {
      Object.entries(runDetail.summary).forEach(([key, val]) => {
        rows.push([key, ...(runDetail.orgBreakdown || []).map(() => ''), (val / 100).toFixed(2)]);
      });
    }
    if (runDetail.eliminations?.length) {
      rows.push(['', '', '']);
      rows.push(['Elimination Entries', '', '']);
      rows.push(['Account', 'Code', 'Amount', 'Description']);
      runDetail.eliminations.forEach((e) => rows.push([e.accountName, e.accountCode, (e.amount / 100).toFixed(2), e.description]));
    }
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `consolidation-${runDetail.reportType}-${runDetail.periodStart}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const summaryKeys: Record<string, string> = {
    totalAssets: 'Total Assets',
    totalLiabilities: 'Total Liabilities',
    totalEquity: 'Total Equity',
    totalRevenue: 'Total Revenue',
    totalCostOfSales: 'Total Cost of Sales',
    grossProfit: 'Gross Profit',
    totalExpenses: 'Total Expenses',
    netProfit: 'Net Profit',
    netCashFlow: 'Net Cash Flow',
    operatingCashFlow: 'Operating Cash Flow',
    investingCashFlow: 'Investing Cash Flow',
    financingCashFlow: 'Financing Cash Flow',
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Consolidation Reports</h1>
          <p className="text-sm text-slate-500 mt-1">Run and view group consolidation reports across organisations.</p>
        </div>
      </div>

      <div className="mb-6">
        <select
          value={groupId} onChange={(e) => { setGroupId(e.target.value); setSelectedRunId(null); }}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 bg-white min-w-[240px]"
        >
          <option value="">Select group...</option>
          {(groups || []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      {groupId && (
        <>
          {/* Run Consolidation Panel */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
            <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2"><Play className="w-4 h-4 text-indigo-500" /> Run Consolidation</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Report Type</label>
                <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white">
                  {REPORT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Period Start</label>
                <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Period End</label>
                <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Currency Translation</label>
                <select value={currencyMethod} onChange={(e) => setCurrencyMethod(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white">
                  <option value="closing_rate">Closing Rate</option>
                  <option value="average_rate">Average Rate</option>
                  <option value="historical">Historical</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={includeEliminations} onChange={(e) => setIncludeEliminations(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                <span className="text-sm text-slate-700">Include Eliminations</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={includeNci} onChange={(e) => setIncludeNci(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                <span className="text-sm text-slate-700">Include NCI</span>
              </label>
              <div className="flex-1" />
              <button
                onClick={handleRun}
                disabled={runMutation.isPending}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all"
              >
                {runMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Run Consolidation
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* History */}
            <div className="lg:col-span-1">
              <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5"><History className="w-4 h-4 text-slate-400" /> Consolidation History</h2>
              {historyLoading ? (
                <div className="flex items-center justify-center py-8 text-slate-400"><Loader2 className="w-4 h-4 animate-spin mr-2" />Loading...</div>
              ) : (!history || history.length === 0) ? (
                <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
                  <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">No runs yet. Run your first consolidation above.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(history || []).map((run) => {
                    const badge = STATUS_BADGES[run.status] || { label: run.status, className: 'bg-slate-100 text-slate-600' };
                    return (
                      <div
                        key={run.id}
                        onClick={() => setSelectedRunId(run.id)}
                        className={`bg-white rounded-xl border p-3 cursor-pointer transition-all ${
                          selectedRunId === run.id ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-slate-800">{REPORT_TYPE_LABELS[run.reportType] || run.reportType}</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>{badge.label}</span>
                        </div>
                        <p className="text-xs text-slate-500">{fmtDate(run.periodStart)} — {fmtDate(run.periodEnd)}</p>
                        <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-400">
                          <span>{run.totalOrgs} orgs</span>
                          <span>{fmtDateTime(run.createdAt)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Result */}
            <div className="lg:col-span-2">
              {!selectedRunId ? (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                  <BarChart3 className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-500">Select a Run</h3>
                  <p className="text-xs text-slate-400 mt-1">Click a consolidation run from the history to view details.</p>
                </div>
              ) : detailLoading ? (
                <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2" />Loading run details...</div>
              ) : runDetail ? (
                <div className="space-y-5">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {runDetail.summary && Object.entries(runDetail.summary).slice(0, 6).map(([key, val]) => (
                      <div key={key} className="bg-white rounded-xl border border-slate-200 p-3">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase">{summaryKeys[key] || key.replace(/([A-Z])/g, ' $1').trim()}</p>
                        <p className="text-lg font-bold text-slate-800 mt-0.5">{fmtNaira(val)}</p>
                      </div>
                    ))}
                  </div>

                  {/* Per-org Breakdown */}
                  {runDetail.orgBreakdown && runDetail.orgBreakdown.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-100">
                        <h3 className="text-sm font-bold text-slate-900">Per-Org Breakdown</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide bg-slate-50/50">
                              <th className="text-left py-2.5 px-4 font-semibold">Org</th>
                              <th className="text-right py-2.5 px-3 font-semibold">Ownership</th>
                              <th className="text-center py-2.5 px-3 font-semibold">Method</th>
                              {runDetail.summary && Object.keys(runDetail.summary).slice(0, 3).map((k) => (
                                <th key={k} className="text-right py-2.5 px-3 font-semibold">{summaryKeys[k] || k}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {runDetail.orgBreakdown.map((o, i) => (
                              <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                                <td className="py-2.5 px-4 font-medium text-slate-800">{o.orgName}</td>
                                <td className="py-2.5 px-3 text-right text-slate-600">{o.ownershipPercentage}%</td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize bg-slate-100 text-slate-600">{o.consolidationMethod}</span>
                                </td>
                                {runDetail.summary && Object.keys(runDetail.summary).slice(0, 3).map((k) => (
                                  <td key={k} className="py-2.5 px-3 text-right font-mono text-slate-800">{fmtNaira(o.metrics[k] || 0)}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Eliminations */}
                  {runDetail.eliminations && runDetail.eliminations.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5"><Layers className="w-4 h-4 text-slate-400" /> Elimination Entries</h3>
                        <span className="text-xs text-slate-500">{runDetail.eliminations.length} entries</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide bg-slate-50/50">
                              <th className="text-left py-2.5 px-4 font-semibold">Account</th>
                              <th className="text-left py-2.5 px-3 font-semibold">Code</th>
                              <th className="text-right py-2.5 px-3 font-semibold">Amount</th>
                              <th className="text-left py-2.5 px-3 font-semibold">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {runDetail.eliminations.map((e, i) => (
                              <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                                <td className="py-2.5 px-4 font-medium text-slate-800">{e.accountName}</td>
                                <td className="py-2.5 px-3 text-slate-500 font-mono">{e.accountCode}</td>
                                <td className="py-2.5 px-3 text-right font-mono text-slate-800">{fmtNaira(e.amount)}</td>
                                <td className="py-2.5 px-3 text-slate-600">{e.description}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* NCI Display */}
                  {runDetail.nci && (
                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                      <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5"><Users className="w-4 h-4 text-slate-400" /> Non-Controlling Interest (NCI)</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-slate-400">NCI Value</p>
                          <p className="text-lg font-bold text-slate-800">{fmtNaira(runDetail.nci.value)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">NCI Percentage</p>
                          <p className="text-lg font-bold text-slate-800">{runDetail.nci.percentage}%</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportCsv}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      <Download className="w-4 h-4" /> Export CSV
                    </button>
                    <button
                      onClick={handleEliminate}
                      disabled={eliminateMutation.isPending}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors disabled:opacity-50"
                    >
                      {eliminateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                      Auto Eliminate
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                  <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-500">Run Not Found</h3>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
