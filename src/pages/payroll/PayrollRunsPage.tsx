import React, { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, payrollApi, printWindow, orgApi } from '../../lib/api';
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
  const { id: routeRunId } = useParams<{ id: string }>();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [modalKey, setModalKey] = useState(0);
  const [form, setForm] = useState({ periodStart: '', periodEnd: '', payDate: '', bankAccountId: '', accruedSalaryAccountId: '' });
  const [formError, setFormError] = useState('');
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: runsData, isLoading } = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: () => api.get('/payroll/runs').then(r => r.data),
  });

  const { data: employeesData } = useQuery({
    queryKey: ['payroll-employees'],
    queryFn: () => api.get('/payroll/employees').then(r => r.data),
  });

  const { data: bankAccountsData } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => api.get('/banking/accounts').then(r => r.data),
  });

  const { data: accountsData } = useQuery({
    queryKey: ['chart-accounts'],
    queryFn: () => api.get('/accountant/accounts').then(r => r.data),
  });

  const { data: org } = useQuery({ queryKey: ['org'], queryFn: orgApi.getOrg, staleTime: 60000 });

  const runs: any[] = useMemo(() => Array.isArray(runsData) ? runsData : [], [runsData]);
  const employees: any[] = useMemo(() => Array.isArray(employeesData) ? employeesData : [], [employeesData]);
  const filteredRuns = useMemo(() => runs.filter((r: any) => {
    const payDate = r.payDate || r.periodStart || '';
    if (dateFrom && payDate < dateFrom) return false;
    if (dateTo && payDate > dateTo) return false;
    return true;
  }), [runs, dateFrom, dateTo]);

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/payroll/runs', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-runs'] }); setShowCreate(false); setFormError(''); },
    onError: (e: any) => setFormError(e?.response?.data?.error || 'Failed to create run'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/runs/${id}/approve`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-runs'] }); setActionMsg({ type: 'success', text: 'Payroll run approved successfully.' }); setTimeout(() => setActionMsg(null), 4000); },
    onError: (e: any) => setActionMsg({ type: 'error', text: e?.response?.data?.error || e?.message || 'Approval failed. Check that all required ledger accounts exist.' }),
  });

  const payMutation = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/runs/${id}/pay`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-runs'] }); setActionMsg({ type: 'success', text: 'Payroll run paid successfully.' }); setTimeout(() => setActionMsg(null), 4000); },
    onError: (e: any) => setActionMsg({ type: 'error', text: e?.response?.data?.error || e?.message || 'Payment failed.' }),
  });

  const unapproveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/runs/${id}/unapprove`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-runs'] }); setActionMsg({ type: 'success', text: 'Payroll run unapproved and journals reversed.' }); setTimeout(() => setActionMsg(null), 4000); },
    onError: (e: any) => setActionMsg({ type: 'error', text: e?.response?.data?.error || e?.message || 'Unapproval failed.' }),
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

  // Auto-open run detail when navigating from a linked payment
  useEffect(() => {
    if (routeRunId && runs.length > 0) {
      const run = runs.find((r: any) => r.id === routeRunId);
      if (run) openDetail(run);
    }
  }, [routeRunId, runs]);

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
    const rows = filteredRuns.map((r: any) => [r.runNumber||'', r.periodStart ? new Date(r.periodStart).toLocaleDateString('en-GB') : '', r.periodEnd ? new Date(r.periodEnd).toLocaleDateString('en-GB') : '', r.payDate ? new Date(r.payDate).toLocaleDateString('en-GB') : '', r.status||'', (r.grossTotal/100).toFixed(2), (r.payeTotal/100).toFixed(2), (r.pensionTotal/100).toFixed(2), (r.netTotal/100).toFixed(2)]);
    exportToCsv(`payroll_runs_${today}.csv`, headers, rows);
  }

  function printPayrollRunDetail(run: any, lines: any[]) {
    const logoHtml = org?.logoUrl
      ? `<img src="${org.logoUrl}" alt="" style="width:56px;height:56px;border-radius:10px;object-fit:contain;border:1px solid #e2e8f0;background:white;padding:4px"/>`
      : '';
    const rowsHtml = lines.map((line: any) =>
      `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px">${line.employee?.firstName || ''} ${line.employee?.lastName || ''} <span style="color:#94a3b8">(${line.employee?.staffId || ''})</span></td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:right;font-family:monospace">${formatNaira(line.grossPay)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:right;font-family:monospace;color:#dc2626">${formatNaira(line.paye)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:right;font-family:monospace;color:#d97706">${formatNaira(line.pensionEmployee)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:right;font-family:monospace">${formatNaira(line.nhf)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:right;font-family:monospace;font-weight:700;color:#059669">${formatNaira(line.netPay)}</td>
      </tr>`
    ).join('');
    const grossTotal = lines.reduce((s: number, l: any) => s + (l.grossPay || 0), 0);
    const payeTotal = lines.reduce((s: number, l: any) => s + (l.paye || 0), 0);
    const pensionTotal = lines.reduce((s: number, l: any) => s + (l.pensionEmployee || 0), 0);
    const nhfTotal = lines.reduce((s: number, l: any) => s + (l.nhf || 0), 0);
    const netTotal = lines.reduce((s: number, l: any) => s + (l.netPay || 0), 0);
    const totalRow = `<tr style="background:#f8fafc;font-weight:700">
      <td style="padding:10px 12px;font-size:12px">TOTAL (${lines.length} employees)</td>
      <td style="padding:10px 12px;font-size:12px;text-align:right;font-family:monospace">${formatNaira(grossTotal)}</td>
      <td style="padding:10px 12px;font-size:12px;text-align:right;font-family:monospace;color:#dc2626">${formatNaira(payeTotal)}</td>
      <td style="padding:10px 12px;font-size:12px;text-align:right;font-family:monospace;color:#d97706">${formatNaira(pensionTotal)}</td>
      <td style="padding:10px 12px;font-size:12px;text-align:right;font-family:monospace">${formatNaira(nhfTotal)}</td>
      <td style="padding:10px 12px;font-size:12px;text-align:right;font-family:monospace;color:#059669">${formatNaira(netTotal)}</td>
    </tr>`;

    const html = `<!DOCTYPE html><html><head><title>${run.runNumber} — Payroll Detail</title><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:40px;color:#1e293b}
      .org-header{display:flex;align-items:center;gap:16px;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #0f172a}
      .org-info{flex:1}
      .org-name{font-size:16px;font-weight:800;color:#0f172a}
      .org-details{font-size:10px;color:#64748b;margin-top:4px;line-height:1.6}
      .org-details span{margin-right:12px}
      .title-section{text-align:right}
      .report-title{font-size:18px;font-weight:700;color:#0f172a}
      .period-info{font-size:11px;color:#64748b;margin-top:4px}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th{background:#0f172a;color:#fff;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em}
      th.r{text-align:right}
      .total-row{background:#f8fafc;font-weight:700}
      .footer{margin-top:40px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px}
      @media print{body{padding:20px}}
    </style></head><body>
      <div class="org-header">
        ${logoHtml ? `<div>${logoHtml}</div>` : ''}
        <div class="org-info">
          <div class="org-name">${org?.name || 'SkyBooks'}</div>
          <div class="org-details">
            ${org?.address ? `<span>${org.address}</span>` : ''}
            ${org?.phone ? `<span>${org.phone}</span>` : ''}
            ${org?.email ? `<span>${org.email}</span>` : ''}
            ${org?.website ? `<span style="color:#4f46e5">${org.website}</span>` : ''}
          </div>
        </div>
        <div class="title-section">
          <div class="report-title">${run.runNumber} — Payroll Detail</div>
          <div class="period-info">${fmtDate(run.periodStart)} – ${fmtDate(run.periodEnd)} &bull; Pay Date: ${fmtDate(run.payDate)}</div>
        </div>
      </div>
      <table>
        <thead><tr>
          <th>Employee</th><th class="r">Gross</th><th class="r">PAYE</th><th class="r">Pension</th><th class="r">NHF</th><th class="r">Net</th>
        </tr></thead>
        <tbody>${rowsHtml}${totalRow}</tbody>
      </table>
      <div class="footer">${org?.name || 'SkyBooks'} &bull; Payroll Summary &bull; Generated: ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</div>
    </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
    else { alert('Popup blocked. Please allow popups for this site and try again.'); }
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
      bankAccountId: form.bankAccountId || undefined,
      accruedSalaryAccountId: form.accruedSalaryAccountId || undefined,
    });
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Payroll Runs</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage payroll cycles and processing</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedRunIds.length > 0 && (
            <button onClick={() => { if (confirm(`Delete ${selectedRunIds.length} selected run(s)? Only draft runs will be deleted.`)) bulkDeleteRunsMutation.mutate(selectedRunIds); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl transition-all duration-200 hover:bg-rose-100">
              <Trash2 size={14} /> Delete ({selectedRunIds.length})
            </button>
          )}
          <button onClick={exportPayrollRunsCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 text-slate-600 rounded-xl transition-all duration-200 hover:bg-slate-50 hover:border-slate-300">
            <Download size={14} /> CSV
          </button>
          <button onClick={() => {
              try {
                const rows = filteredRuns.map((r: any) =>
                  `<tr><td>${r.runNumber||''}</td><td>${new Date(r.periodStart).toLocaleDateString('en-GB')}</td><td>${new Date(r.periodEnd).toLocaleDateString('en-GB')}</td><td class="r">₦${(r.totalGross/100).toLocaleString()}</td><td class="r">₦${(r.totalNet/100).toLocaleString()}</td><td class="c">${r.employeeCount||0}</td><td class="c">${r.status||''}</td></tr>`
                ).join('');
                printWindow('Payroll Runs', `<table><thead><tr><th>Run #</th><th>Period Start</th><th>Period End</th><th class="r">Gross</th><th class="r">Net</th><th class="c">Employees</th><th class="c">Status</th></tr></thead><tbody>${rows}</tbody></table>`, `${filteredRuns.length} runs`);
              } catch (err) {
                alert('Failed to open print window: ' + (err instanceof Error ? err.message : 'Unknown error'));
                console.error('Print error:', err);
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl transition-all duration-200 hover:from-blue-700 hover:to-blue-800 shadow-sm">
            <Download size={14} /> PDF
          </button>
          <button onClick={() => { setShowCreate(true); setModalKey(k => k + 1); setForm({ periodStart: '', periodEnd: '', payDate: '', bankAccountId: '', accruedSalaryAccountId: '' }); setFormError(''); }}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-xs font-medium rounded-xl transition-all duration-200 hover:from-indigo-700 hover:to-indigo-800 shadow-sm">
            <Plus size={15} /> Run Payroll
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${actionMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {actionMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {actionMsg.text}
        </div>
      )}

      <div className="flex gap-2 items-center">
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow bg-white" />
        <span className="text-xs text-slate-400 font-medium">to</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow bg-white" />
        <span className="text-xs text-slate-400 font-medium">{filteredRuns.length} run{filteredRuns.length !== 1 ? 's' : ''}</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading runs...
        </div>
      ) : filteredRuns.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <Play size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">{dateFrom || dateTo ? 'No runs match the date range' : 'No payroll runs yet'}</p>
          <p className="text-xs text-slate-400 mt-1">Create your first payroll run to process salaries</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="px-3 py-3 text-left w-10">
                  <input type="checkbox" checked={selectedRunIds.length === filteredRuns.length && filteredRuns.length > 0}
                    onChange={e => { if (e.target.checked) { setSelectedRunIds(filteredRuns.map((r: any) => r.id)); } else { setSelectedRunIds([]); } }}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                </th>
                <th className="px-3 py-3 text-left">Run #</th>
                <th className="px-3 py-3 text-left">Period</th>
                <th className="px-3 py-3 text-left">Pay Date</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-right">Gross</th>
                <th className="px-3 py-3 text-right">PAYE</th>
                <th className="px-3 py-3 text-right">Pension</th>
                <th className="px-3 py-3 text-right">Net</th>
                <th className="px-3 py-3 text-left w-44"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                  {filteredRuns.map(run => (
                <React.Fragment key={run.id}>
                  <tr className="hover:bg-slate-50/50 transition-colors">
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
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${STATUS_STYLES[run.status] ? STATUS_STYLES[run.status] + ' border-current' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{run.status}</span>
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-slate-900">{formatNaira(run.totalGross)}</td>
                    <td className="py-3 px-2 text-right font-mono text-slate-900">{formatNaira(run.totalPaye)}</td>
                    <td className="py-3 px-2 text-right font-mono text-slate-900">{formatNaira(run.totalPension)}</td>
                    <td className="py-3 px-2 text-right font-mono font-semibold text-slate-900">{formatNaira(run.totalNet)}</td>
                    <td className="py-3 pl-2 pr-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openDetail(run)} className="px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all duration-200">View</button>
                        {run.status === 'draft' && (
                          <>
                            <button onClick={() => approveMutation.mutate(run.id)} disabled={approveMutation.isPending}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-all duration-200 disabled:opacity-50">
                              {approveMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} Approve
                            </button>
                            <button onClick={() => { if (confirm('Delete this payroll run? This cannot be undone.')) deleteRunMutation.mutate(run.id); }} disabled={deleteRunMutation.isPending}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all duration-200">
                              <Trash2 size={11} /> Delete
                            </button>
                          </>
                        )}
                        {run.status === 'approved' && (
                          <button onClick={() => { if (confirm('Mark this payroll run as paid?')) payMutation.mutate(run.id); }} disabled={payMutation.isPending}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all duration-200 disabled:opacity-50">
                            {payMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <DollarSign size={11} />} Pay
                          </button>
                        )}
                        {run.status === 'approved' && (
                          <button onClick={() => { if (confirm('Unapprove this payroll run? This will reverse all posted journals.')) unapproveMutation.mutate(run.id); }} disabled={unapproveMutation.isPending}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-all duration-200 disabled:opacity-50">
                            {unapproveMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <Ban size={11} />} Unapprove
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedId === run.id && (
                    <tr>
                      <td colSpan={10} className="px-6 py-4 bg-slate-50/80 text-xs">
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
              <div className="flex items-center gap-2">
                <button onClick={() => printPayrollRunDetail(detailRun, detailLines)} disabled={loadingDetail || detailLines.length === 0}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl transition-all duration-200 hover:from-blue-700 hover:to-blue-800 shadow-sm disabled:opacity-50">
                  <FileText size={13} /> Payroll PDF
                </button>
                <button onClick={() => { setDetailRun(null); setDetailLines([]); }} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition-all duration-200"><X size={18} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {loadingDetail ? (
                <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin" /></div>
              ) : (
                <div className="space-y-4">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Period</p>
            <p className="text-sm font-semibold text-slate-800">{fmtDate(detailRun.periodStart)} – {fmtDate(detailRun.periodEnd)}</p>
            <p className="text-xs text-slate-400 mt-2">Pay Date: <span className="font-semibold text-slate-700">{fmtDate(detailRun.payDate)}</span></p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="px-3 py-3 text-left">Employee</th>
                <th className="px-3 py-3 text-right">Gross</th>
                <th className="px-3 py-3 text-right">PAYE</th>
                <th className="px-3 py-3 text-right">Pension</th>
                <th className="px-3 py-3 text-right">NHF</th>
                <th className="px-3 py-3 text-right">Net</th>
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <h2 className="text-base font-semibold text-slate-900">New Payroll Run</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-200"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              {formError && (
                <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">{formError}</div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Period Start *</label>
                <input key={`ps-${modalKey}`} type="date" value={form.periodStart} onChange={e => setForm({ ...form, periodStart: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Period End *</label>
                <input key={`pe-${modalKey}`} type="date" value={form.periodEnd} onChange={e => setForm({ ...form, periodEnd: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Pay Date *</label>
                <input key={`pd-${modalKey}`} type="date" value={form.payDate} onChange={e => setForm({ ...form, payDate: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Disburse From *</label>
                <select value={form.bankAccountId} onChange={e => setForm({ ...form, bankAccountId: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow">
                  <option value="">Select bank account</option>
                  {(Array.isArray(bankAccountsData) ? bankAccountsData : []).map((ba: any) => (
                    <option key={ba.id} value={ba.id}>{ba.bankName} — {ba.accountNumber} ({ba.name})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Accrued Salary Account (optional)</label>
                <select value={form.accruedSalaryAccountId} onChange={e => setForm({ ...form, accruedSalaryAccountId: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow">
                  <option value="">Direct disbursement (no accrual)</option>
                  {(Array.isArray(accountsData) ? accountsData : []).filter((a: any) => a.type === 'liability').map((a: any) => (
                    <option key={a.id} value={a.id}>{a.code} {a.name}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">If selected, net pay is parked as a liability on approval and settled on payment.</p>
              </div>
              <p className="text-xs text-slate-400">This will calculate payroll for all active employees.</p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-all duration-200">Cancel</button>
              <button onClick={handleCreate} disabled={createMutation.isPending}
                className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl transition-all duration-200 hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 flex items-center gap-2 shadow-sm">
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