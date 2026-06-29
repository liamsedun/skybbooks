import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, downloadBlob } from '../../lib/api';
import { payrollApi } from '../../lib/api';
import {
  Plus, X, Loader2, AlertCircle, Search, FileText,
  CheckCircle2, Ban, ChevronDown, ChevronUp, Play, DollarSign,
  Download, Trash2
} from 'lucide-react';
import { exportToCsv } from '../../lib/csvTemplates';

function formatNaira(kobo: number) {
  return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}
function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  approved: 'bg-blue-50 text-blue-700',
  paid: 'bg-emerald-50 text-emerald-700',
};

export function PayrollRunsPage() {
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ periodStart: '', periodEnd: '', payDate: '' });
  const [formError, setFormError] = useState('');
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);

  const { data: runsData, isLoading } = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: () => api.get('/payroll/runs').then(r => r.data),
  });

  const { data: employeesData } = useQuery({
    queryKey: ['payroll-employees'],
    queryFn: () => api.get('/payroll/employees').then(r => r.data),
  });

  const runs: any[] = useMemo(() => Array.isArray(runsData) ? runsData : [], [runsData]);
  const employees: any[] = useMemo(() => Array.isArray(employeesData) ? employeesData : [], [employeesData]);

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/payroll/runs', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-runs'] }); setShowCreate(false); setFormError(''); },
    onError: (e: any) => setFormError(e?.response?.data?.error || 'Failed to create run'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/runs/${id}/approve`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll-runs'] }),
  });

  const payMutation = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/runs/${id}/pay`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll-runs'] }),
  });

  const deleteRunMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/payroll/runs/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-runs'] }); },
  });

  const bulkDeleteRunsMutation = useMutation({
    mutationFn: (ids: string[]) => api.post('/payroll/runs/bulk-delete', { ids }).then(r => r.data),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['payroll-runs'] }); setSelectedRunIds([]); setFormError(res.message || `${res.deleted} run(s) deleted.`); setTimeout(() => setFormError(''), 3000); },
  });

  const [detailRun, setDetailRun] = useState<any>(null);
  const [detailLines, setDetailLines] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  async function openDetail(run: any) {
    setDetailRun(run);
    setLoadingDetail(true);
    try {
      const res = await api.get(`/payroll/runs/${run.id}`);
      setDetailLines(res.data.lines || []);
    } catch { setDetailLines([]); }
    setLoadingDetail(false);
  }

  function exportPayrollRunsCSV() {
    const today = new Date().toISOString().split('T')[0];
    const headers = ['Run #', 'Period Start', 'Period End', 'Pay Date', 'Status', 'Gross', 'PAYE', 'Pension', 'Net'];
    const rows = runs.map((r: any) => [r.runNumber||'', r.periodStart ? new Date(r.periodStart).toLocaleDateString('en-GB') : '', r.periodEnd ? new Date(r.periodEnd).toLocaleDateString('en-GB') : '', r.payDate ? new Date(r.payDate).toLocaleDateString('en-GB') : '', r.status||'', (r.grossTotal/100).toFixed(2), (r.payeTotal/100).toFixed(2), (r.pensionTotal/100).toFixed(2), (r.netTotal/100).toFixed(2)]);
    exportToCsv(`payroll_runs_${today}.csv`, headers, rows);
  }

  function handleCreate() {
    setFormError('');
    if (!form.periodStart || !form.periodEnd || !form.payDate) {
      return setFormError('All date fields are required.');
    }
    createMutation.mutate({
      periodStart: form.periodStart,
      periodEnd: form.periodEnd,
      payDate: form.payDate,
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Payroll Runs</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage payroll cycles and processing</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedRunIds.length > 0 && (
            <button onClick={() => { if (confirm(`Delete ${selectedRunIds.length} selected run(s)? Only draft runs will be deleted.`)) bulkDeleteRunsMutation.mutate(selectedRunIds); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100">
              <Trash2 size={14} /> Delete ({selectedRunIds.length})
            </button>
          )}
          <button onClick={exportPayrollRunsCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
            <Download size={14} /> CSV
          </button>
          <button onClick={async () => { try { const blob = await payrollApi.getPayrollRunsPdf(); downloadBlob(blob, `payroll_runs_${new Date().toISOString().split('T')[0]}.pdf`); } catch (e) { alert('Failed to export PDF.'); console.error(e); } }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Download size={14} /> PDF
          </button>
          <button onClick={() => { setShowCreate(true); setForm({ periodStart: '', periodEnd: '', payDate: '' }); setFormError(''); }}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors">
            <Plus size={15} /> Run Payroll
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 bg-white border border-slate-200 rounded-xl">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading runs...
        </div>
      ) : runs.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
          <Play size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">No payroll runs yet</p>
          <p className="text-xs text-slate-400 mt-1">Create your first payroll run to process salaries</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide border-b border-slate-200">
                <th className="py-3 pl-3 pr-1 w-10">
                  <input type="checkbox" checked={selectedRunIds.length === runs.length && runs.length > 0}
                    onChange={e => { if (e.target.checked) { setSelectedRunIds(runs.map((r: any) => r.id)); } else { setSelectedRunIds([]); } }}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                </th>
                <th className="py-3 pl-2 pr-2 text-left">Run #</th>
                <th className="py-3 px-2 text-left">Period</th>
                <th className="py-3 px-2 text-left">Pay Date</th>
                <th className="py-3 px-2 text-left">Status</th>
                <th className="py-3 px-2 text-right">Gross</th>
                <th className="py-3 px-2 text-right">PAYE</th>
                <th className="py-3 px-2 text-right">Pension</th>
                <th className="py-3 px-2 text-right">Net</th>
                <th className="py-3 pl-2 pr-4 w-44"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                  {runs.map(run => (
                <React.Fragment key={run.id}>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 pl-3 pr-1">
                      <input type="checkbox" checked={selectedRunIds.includes(run.id)}
                        onChange={e => { setSelectedRunIds(prev => e.target.checked ? [...prev, run.id] : prev.filter(i => i !== run.id)); }}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    </td>
                    <td className="py-3 pl-2 pr-2 font-mono text-xs font-semibold text-slate-700">
                      <button onClick={() => setExpandedId(expandedId === run.id ? null : run.id)}
                        className="flex items-center gap-1 hover:text-indigo-600">
                        {expandedId === run.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        {run.runNumber}
                      </button>
                    </td>
                    <td className="py-3 px-2 text-xs text-slate-500">{fmtDate(run.periodStart)} – {fmtDate(run.periodEnd)}</td>
                    <td className="py-3 px-2 text-xs text-slate-500">{fmtDate(run.payDate)}</td>
                    <td className="py-3 px-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[run.status] || 'bg-slate-100 text-slate-500'}`}>{run.status}</span>
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-slate-900">{formatNaira(run.totalGross)}</td>
                    <td className="py-3 px-2 text-right font-mono text-slate-900">{formatNaira(run.totalPaye)}</td>
                    <td className="py-3 px-2 text-right font-mono text-slate-900">{formatNaira(run.totalPension)}</td>
                    <td className="py-3 px-2 text-right font-mono font-semibold text-slate-900">{formatNaira(run.totalNet)}</td>
                    <td className="py-3 pl-2 pr-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openDetail(run)} className="px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md">View</button>
                        {run.status === 'draft' && (
                          <>
                            <button onClick={() => approveMutation.mutate(run.id)} disabled={approveMutation.isPending}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-md">
                              <CheckCircle2 size={11} /> Approve
                            </button>
                            <button onClick={() => { if (confirm('Delete this payroll run? This cannot be undone.')) deleteRunMutation.mutate(run.id); }} disabled={deleteRunMutation.isPending}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md">
                              <Trash2 size={11} /> Delete
                            </button>
                          </>
                        )}
                        {run.status === 'approved' && (
                          <button onClick={() => { if (confirm('Mark this payroll run as paid?')) payMutation.mutate(run.id); }} disabled={payMutation.isPending}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md">
                            <DollarSign size={11} /> Pay
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedId === run.id && (
                    <tr>
                      <td colSpan={10} className="px-6 py-4 bg-slate-50/80 border-b border-slate-100 text-xs">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div><span className="text-slate-400 uppercase font-semibold">Employees</span><p className="font-semibold mt-1 text-slate-900">—</p></div>
                          <div><span className="text-slate-400 uppercase font-semibold">NHF</span><p className="font-semibold mt-1 text-slate-900">{formatNaira(run.totalNhf)}</p></div>
                          <div><span className="text-slate-400 uppercase font-semibold">Gross Pay</span><p className="font-semibold mt-1 text-slate-900">{formatNaira(run.totalGross)}</p></div>
                          <div><span className="text-slate-400 uppercase font-semibold">Net Pay</span><p className="font-semibold mt-1 text-emerald-600">{formatNaira(run.totalNet)}</p></div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail slide-over */}
      {detailRun && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => { setDetailRun(null); setDetailLines([]); }} />
          <div className="fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">{detailRun.runNumber} — Details</h2>
              <button onClick={() => { setDetailRun(null); setDetailLines([]); }} className="p-1 rounded-md text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {loadingDetail ? (
                <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin" /></div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Period</p>
                    <p className="text-sm font-semibold text-slate-800">{fmtDate(detailRun.periodStart)} – {fmtDate(detailRun.periodEnd)}</p>
                    <p className="text-xs text-slate-400 mt-2">Pay Date: <span className="font-semibold text-slate-700">{fmtDate(detailRun.payDate)}</span></p>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100">
                        <th className="py-2 text-left">Employee</th>
                        <th className="py-2 text-right">Gross</th>
                        <th className="py-2 text-right">PAYE</th>
                        <th className="py-2 text-right">Pension</th>
                        <th className="py-2 text-right">NHF</th>
                        <th className="py-2 text-right">Net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {detailLines.map((line: any) => (
                        <tr key={line.id}>
                          <td className="py-2 text-xs text-slate-700">
                            {line.employee?.firstName} {line.employee?.lastName}
                            <span className="text-slate-400 ml-1">({line.employee?.staffId})</span>
                          </td>
                          <td className="py-2 text-right text-xs font-mono">{formatNaira(line.grossPay)}</td>
                          <td className="py-2 text-right text-xs font-mono text-red-600">{formatNaira(line.paye)}</td>
                          <td className="py-2 text-right text-xs font-mono text-amber-600">{formatNaira(line.pensionEmployee)}</td>
                          <td className="py-2 text-right text-xs font-mono text-slate-600">{formatNaira(line.nhf)}</td>
                          <td className="py-2 text-right text-xs font-mono font-semibold text-emerald-600">{formatNaira(line.netPay)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Create Run Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 px-4 py-8 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">New Payroll Run</h2>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {formError && (
                <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{formError}</div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Period Start *</label>
                <input type="date" value={form.periodStart} onChange={e => setForm({ ...form, periodStart: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Period End *</label>
                <input type="date" value={form.periodEnd} onChange={e => setForm({ ...form, periodEnd: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Pay Date *</label>
                <input type="date" value={form.payDate} onChange={e => setForm({ ...form, payDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              </div>
              <p className="text-xs text-slate-400">This will calculate payroll for all active employees.</p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
              <button onClick={handleCreate} disabled={createMutation.isPending}
                className="px-5 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2">
                {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                Generate Run
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}