import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, payrollApi, printWindow, downloadBlob, orgApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import {
  Loader2, AlertCircle, FileText, Download, Printer, Trash2
} from 'lucide-react';

function formatNaira(kobo: number) {
  return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}
function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function PensionSchedulesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [selectedPensionIds, setSelectedPensionIds] = useState<string[]>([]);

  const deletePensionLineMutation = useMutation({
    mutationFn: ({ runId, employeeId }: { runId: string; employeeId: string }) => api.delete(`/payroll/runs/${runId}/payslips/${employeeId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll-run-detail', selectedRunId] }),
  });

  const bulkDeletePensionMutation = useMutation({
    mutationFn: (employeeIds: string[]) => api.post(`/payroll/runs/${selectedRunId}/payslips/bulk-delete`, { employeeIds }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-run-detail', selectedRunId] }); setSelectedPensionIds([]); },
  });

  const { data: runsData, isLoading: runsLoading } = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: () => api.get('/payroll/runs').then(r => r.data),
  });

  const runs: any[] = useMemo(() => Array.isArray(runsData) ? runsData : [], [runsData]);

  const { data: org } = useQuery({ queryKey: ['org'], queryFn: orgApi.getOrg, staleTime: 60000 });

  const { data: detailData, isLoading } = useQuery({
    queryKey: ['payroll-run-detail', selectedRunId],
    queryFn: () => api.get(`/payroll/runs/${selectedRunId}`).then(r => r.data),
    enabled: !!selectedRunId,
  });

  const lines: any[] = detailData?.lines || [];
  const selectedRun = runs.find(r => r.id === selectedRunId);

  const totals = useMemo(() => {
    let pensionEE = 0, pensionER = 0, pensionable = 0;
    lines.forEach((l: any) => {
      pensionEE += l.pensionEmployee || 0;
      pensionER += l.pensionEmployer || 0;
      pensionable += l.grossPay || 0;
    });
    return { pensionEE, pensionER, total: pensionEE + pensionER, pensionable };
  }, [lines]);

  function exportCSV() {
    const headers = ['Staff ID', 'Employee', 'Gross Pay', 'Pensionable Earnings', 'Employee 8%', 'Employer 10%', 'Total Contribution'];
    const rows = lines.map((l: any) => [
      l.employee?.staffId || '',
      `${l.employee?.firstName || ''} ${l.employee?.lastName || ''}`,
      (l.grossPay / 100).toFixed(2),
      (l.basic / 100).toFixed(2),
      (l.pensionEmployee / 100).toFixed(2),
      (l.pensionEmployer / 100).toFixed(2),
      ((l.pensionEmployee + l.pensionEmployer) / 100).toFixed(2),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `pension-schedule-${selectedRun?.runNumber || 'all'}-${new Date().toISOString().split('T')[0]}.csv`);
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">

        {lines.length > 0 && (
          <div className="flex items-center gap-2">
            {selectedPensionIds.length > 0 && selectedRun?.status === 'draft' && (
              <button onClick={() => { if (confirm(`Delete ${selectedPensionIds.length} selected line(s)?`)) bulkDeletePensionMutation.mutate(selectedPensionIds); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl transition-all duration-200 hover:bg-rose-100">
                <Trash2 size={14} /> Delete ({selectedPensionIds.length})
              </button>
            )}
            <button onClick={() => {
              try {
                const logoHtml = org?.logoUrl
                  ? `<img src="${org.logoUrl}" alt="" style="width:56px;height:56px;border-radius:10px;object-fit:contain;border:1px solid #e2e8f0;background:white;padding:4px"/>`
                  : '';
                const fmt = (v: number) => `₦${(v/100).toLocaleString('en-NG',{minimumFractionDigits:2})}`;
                const rowsHtml = lines.map((l: any) => {
                  const pen = l.basic || 0;
                  const tot = (l.pensionEmployee||0) + (l.pensionEmployer||0);
                  return `<tr>
                    <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;font-family:monospace;color:#64748b">${l.employee?.staffId||'—'}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px">${l.employee?.firstName||''} ${l.employee?.lastName||''}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:right;font-family:monospace">${fmt(l.grossPay)}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:right;font-family:monospace">${fmt(pen)}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:right;font-family:monospace;color:#d97706">${fmt(l.pensionEmployee)}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:right;font-family:monospace;color:#4f46e5">${fmt(l.pensionEmployer)}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:right;font-family:monospace;font-weight:700">${fmt(tot)}</td>
                  </tr>`;
                }).join('');
                const totalRow = `<tr style="background:#f8fafc;font-weight:700">
                  <td style="padding:10px 12px;font-size:12px" colspan="2">TOTAL (${lines.length} employees)</td>
                  <td style="padding:10px 12px;font-size:12px;text-align:right;font-family:monospace">—</td>
                  <td style="padding:10px 12px;font-size:12px;text-align:right;font-family:monospace">${fmt(totals.pensionable)}</td>
                  <td style="padding:10px 12px;font-size:12px;text-align:right;font-family:monospace;color:#d97706">${fmt(totals.pensionEE)}</td>
                  <td style="padding:10px 12px;font-size:12px;text-align:right;font-family:monospace;color:#4f46e5">${fmt(totals.pensionER)}</td>
                  <td style="padding:10px 12px;font-size:12px;text-align:right;font-family:monospace">${fmt(totals.total)}</td>
                </tr>`;
                const html = `<!DOCTYPE html><html><head><title>Pension Schedule — ${selectedRun?.runNumber||''}</title><style>
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
                      <div class="report-title">Pension Schedule</div>
                      <div class="period-info">${selectedRun?.runNumber||''} — ${fmtDate(selectedRun?.periodStart)} to ${fmtDate(selectedRun?.periodEnd)}</div>
                    </div>
                  </div>
                  <table>
                    <thead><tr>
                      <th>Staff ID</th><th>Employee</th><th class="r">Gross Pay</th><th class="r">Pensionable</th><th class="r">Employee 8%</th><th class="r">Employer 10%</th><th class="r">Total</th>
                    </tr></thead>
                    <tbody>${rowsHtml}${totalRow}</tbody>
                  </table>
                  <div class="footer">${org?.name || 'SkyBooks'} &bull; Pension Schedule &bull; Generated: ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</div>
                </body></html>`;
                const w = window.open('', '_blank');
                if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
                else { toast('Popup blocked. Please allow popups for this site and try again.', 'warning'); }
              } catch (err) {
                toast('Failed to open print window: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
                console.error('Print error:', err);
              }
            }} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-xs font-medium rounded-xl transition-all duration-200 hover:from-blue-700 hover:to-blue-800 shadow-sm">
              <Printer size={14} /> PDF
            </button>
            <button onClick={exportCSV} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-xl transition-all duration-200 hover:bg-slate-50 hover:border-slate-300">
              <Download size={14} /> Export CSV
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-3 items-center">
        {runsLoading ? (
          <select disabled className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-400">
            <option>Loading runs...</option>
          </select>
        ) : (
          <select key={runs.length} value={selectedRunId} onChange={e => setSelectedRunId(e.target.value)}
            className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow">
            <option value="">Select a payroll run...</option>
            {runs.map(r => (
              <option key={r.id} value={r.id}>{r.runNumber} — {fmtDate(r.periodStart)} to {fmtDate(r.periodEnd)}</option>
            ))}
          </select>
        )}
      </div>

      {!selectedRunId ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <FileText size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">Select a payroll run</p>
          <p className="text-xs text-slate-400 mt-1">Choose a run to view its pension schedule</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading...
        </div>
      ) : lines.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <AlertCircle size={24} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">No employee lines found in this run.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="px-3 py-3 text-left w-10">
                  <input type="checkbox" checked={selectedPensionIds.length === lines.length && lines.length > 0}
                    onChange={e => { if (e.target.checked) { setSelectedPensionIds(lines.map((l: any) => l.employeeId)); } else { setSelectedPensionIds([]); } }}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                </th>
                <th className="px-3 py-3 text-left">Staff ID</th>
                <th className="px-3 py-3 text-left">Employee</th>
                <th className="px-3 py-3 text-right">Gross Pay</th>
                <th className="px-3 py-3 text-right">Pensionable</th>
                <th className="px-3 py-3 text-right">Employee 8%</th>
                <th className="px-3 py-3 text-right">Employer 10%</th>
                <th className="px-3 py-3 text-right">Total</th>
                <th className="px-3 py-3 text-left w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((line: any) => {
                const pensionable = line.basic || 0;
                const totalPension = (line.pensionEmployee || 0) + (line.pensionEmployer || 0);
                return (
                  <tr key={line.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 pl-3 pr-1">
                      <input type="checkbox" checked={selectedPensionIds.includes(line.employeeId)}
                        onChange={e => { setSelectedPensionIds(prev => e.target.checked ? [...prev, line.employeeId] : prev.filter(i => i !== line.employeeId)); }}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-500">{line.employee?.staffId || '—'}</td>
                    <td className="py-2.5 px-2 text-slate-700">{line.employee?.firstName} {line.employee?.lastName}</td>
                    <td className="py-2.5 px-2 text-right font-mono">{formatNaira(line.grossPay)}</td>
                    <td className="py-2.5 px-2 text-right font-mono">{formatNaira(pensionable)}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-amber-600">{formatNaira(line.pensionEmployee)}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-indigo-600">{formatNaira(line.pensionEmployer)}</td>
                    <td className="py-2.5 px-2 text-right font-mono font-semibold text-slate-900">{formatNaira(totalPension)}</td>
                    <td className="py-2.5 px-2">
                      {selectedRun?.status === 'draft' && (
                        <button onClick={() => { if (confirm(`Delete pension line for ${line.employee?.firstName} ${line.employee?.lastName}?`)) deletePensionLineMutation.mutate({ runId: selectedRunId, employeeId: line.employeeId }); }}
                          className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all duration-200" title="Delete">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50/80 border-t border-slate-200 font-semibold text-sm">
                <td colSpan={3} className="px-4 py-3 text-slate-600">Totals</td>
                <td className="px-2 py-3 text-right">—</td>
                <td className="px-2 py-3 text-right">{formatNaira(totals.pensionable)}</td>
                <td className="px-2 py-3 text-right text-amber-700">{formatNaira(totals.pensionEE)}</td>
                <td className="px-2 py-3 text-right text-indigo-700">{formatNaira(totals.pensionER)}</td>
                <td className="px-2 py-3 text-right text-slate-900">{formatNaira(totals.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}