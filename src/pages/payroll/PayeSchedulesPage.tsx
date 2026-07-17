import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, payrollApi, printWindow, downloadBlob, orgApi } from '../../lib/api';
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

export function PayeSchedulesPage() {
  const qc = useQueryClient();
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [selectedPayeIds, setSelectedPayeIds] = useState<string[]>([]);

  const deletePayeLineMutation = useMutation({
    mutationFn: ({ runId, employeeId }: { runId: string; employeeId: string }) => api.delete(`/payroll/runs/${runId}/payslips/${employeeId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll-run-detail', selectedRunId] }),
  });

  const bulkDeletePayeMutation = useMutation({
    mutationFn: (employeeIds: string[]) => api.post(`/payroll/runs/${selectedRunId}/payslips/bulk-delete`, { employeeIds }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-run-detail', selectedRunId] }); setSelectedPayeIds([]); },
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
    let gross = 0, paye = 0, net = 0, chargeable = 0;
    lines.forEach((l: any) => {
      gross += l.grossPay || 0;
      paye += l.paye || 0;
      net += l.netPay || 0;
      chargeable += (l.annualGross || 0) - (l.taxRelief || 0) - (l.pensionEmployee || 0) * 12 - (l.nhf || 0) * 12;
    });
    return { gross, paye, net, chargeable };
  }, [lines]);

  function exportCSV() {
    const headers = ['Staff ID', 'Employee', 'Gross', 'Pension (EE)', 'NHF', 'Annual Gross', 'Relief', 'Chargeable', 'PAYE', 'Net'];
    const rows = lines.map((l: any) => [
      l.employee?.staffId || '',
      `${l.employee?.firstName || ''} ${l.employee?.lastName || ''}`,
      (l.grossPay / 100).toFixed(2),
      (l.pensionEmployee / 100).toFixed(2),
      (l.nhf / 100).toFixed(2),
      ((l.annualGross || 0) / 100).toFixed(2),
      ((l.taxRelief || 0) / 100).toFixed(2),
      (((l.annualGross || 0) - (l.taxRelief || 0) - (l.pensionEmployee || 0) * 12 - (l.nhf || 0) * 12) / 100).toFixed(2),
      (l.paye / 100).toFixed(2),
      (l.netPay / 100).toFixed(2),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `paye-schedule-${selectedRun?.runNumber || 'all'}-${new Date().toISOString().split('T')[0]}.csv`);
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">

        {lines.length > 0 && (
          <div className="flex items-center gap-2">
            {selectedPayeIds.length > 0 && selectedRun?.status === 'draft' && (
              <button onClick={() => { if (confirm(`Delete ${selectedPayeIds.length} selected line(s)?`)) bulkDeletePayeMutation.mutate(selectedPayeIds); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl transition-all duration-200 hover:bg-rose-100">
                <Trash2 size={14} /> Delete ({selectedPayeIds.length})
              </button>
            )}
            <button onClick={() => {
              try {
                const logoHtml = org?.logoUrl
                  ? `<img src="${org.logoUrl}" alt="" style="width:56px;height:56px;border-radius:10px;object-fit:contain;border:1px solid #e2e8f0;background:white;padding:4px"/>`
                  : '';
                const fmt = (v: number) => `₦${(v/100).toLocaleString('en-NG',{minimumFractionDigits:2})}`;
                const fmt2 = (v: number) => (v/100).toLocaleString('en-NG',{minimumFractionDigits:2});
                const rowsHtml = lines.map((l: any) => {
                  const ag = l.annualGross || 0;
                  const rl = l.taxRelief || 0;
                  const pa = (l.pensionEmployee || 0) * 12;
                  const na = (l.nhf || 0) * 12;
                  const ch = Math.max(0, ag - rl - pa - na);
                  return `<tr>
                    <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;font-family:monospace;color:#64748b">${l.employee?.staffId||'—'}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px">${l.employee?.firstName||''} ${l.employee?.lastName||''}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:right;font-family:monospace">${fmt(l.grossPay)}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:right;font-family:monospace;color:#d97706">${fmt(l.pensionEmployee)}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:right;font-family:monospace">${fmt(l.nhf)}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:right;font-family:monospace">${fmt(ag)}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:right;font-family:monospace;color:#4f46e5">${fmt(rl)}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:right;font-family:monospace;font-weight:600">${fmt(ch)}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:right;font-family:monospace;font-weight:700;color:#dc2626">${fmt(l.paye)}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:right;font-family:monospace;font-weight:700;color:#059669">${fmt(l.netPay)}</td>
                  </tr>`;
                }).join('');
                const totalRow = `<tr style="background:#f8fafc;font-weight:700">
                  <td style="padding:10px 12px;font-size:12px" colspan="2">TOTAL (${lines.length} employees)</td>
                  <td style="padding:10px 12px;font-size:12px;text-align:right;font-family:monospace">${fmt(totals.gross)}</td>
                  <td style="padding:10px 12px;font-size:12px;text-align:right;font-family:monospace">—</td>
                  <td style="padding:10px 12px;font-size:12px;text-align:right;font-family:monospace">—</td>
                  <td style="padding:10px 12px;font-size:12px;text-align:right;font-family:monospace">—</td>
                  <td style="padding:10px 12px;font-size:12px;text-align:right;font-family:monospace">—</td>
                  <td style="padding:10px 12px;font-size:12px;text-align:right;font-family:monospace">${fmt(totals.chargeable)}</td>
                  <td style="padding:10px 12px;font-size:12px;text-align:right;font-family:monospace;color:#dc2626">${fmt(totals.paye)}</td>
                  <td style="padding:10px 12px;font-size:12px;text-align:right;font-family:monospace;color:#059669">${fmt(totals.net)}</td>
                </tr>`;
                const html = `<!DOCTYPE html><html><head><title>PAYE Schedule — ${selectedRun?.runNumber||''}</title><style>
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
                      <div class="report-title">PAYE Schedule</div>
                      <div class="period-info">${selectedRun?.runNumber||''} — ${fmtDate(selectedRun?.periodStart)} to ${fmtDate(selectedRun?.periodEnd)} &bull; Status: ${selectedRun?.status||''}</div>
                    </div>
                  </div>
                  <table>
                    <thead><tr>
                      <th>Staff</th><th>Employee</th><th class="r">Gross Pay</th><th class="r">Pension (EE)</th><th class="r">NHF</th><th class="r">Annual Gross</th><th class="r">Relief</th><th class="r">Chargeable</th><th class="r">PAYE</th><th class="r">Net Pay</th>
                    </tr></thead>
                    <tbody>${rowsHtml}${totalRow}</tbody>
                  </table>
                  <div class="footer">${org?.name || 'SkyBooks'} &bull; PAYE Schedule &bull; Generated: ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</div>
                </body></html>`;
                const w = window.open('', '_blank');
                if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
                else { alert('Popup blocked. Please allow popups for this site and try again.'); }
              } catch (err) {
                alert('Failed to open print window: ' + (err instanceof Error ? err.message : 'Unknown error'));
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
        {selectedRun && (
          <span className="text-xs text-slate-400 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
            Status: <span className="font-semibold capitalize text-slate-700">{selectedRun.status}</span>
          </span>
        )}
      </div>

      {!selectedRunId ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <FileText size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">Select a payroll run</p>
          <p className="text-xs text-slate-400 mt-1">Choose a run to view its PAYE schedule</p>
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
                  <input type="checkbox" checked={selectedPayeIds.length === lines.length && lines.length > 0}
                    onChange={e => { if (e.target.checked) { setSelectedPayeIds(lines.map((l: any) => l.employeeId)); } else { setSelectedPayeIds([]); } }}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                </th>
                <th className="px-3 py-3 text-left">Staff</th>
                <th className="px-3 py-3 text-left">Employee</th>
                <th className="px-3 py-3 text-right">Gross Pay</th>
                <th className="px-3 py-3 text-right">Pension (EE)</th>
                <th className="px-3 py-3 text-right">NHF</th>
                <th className="px-3 py-3 text-right">Annual Gross</th>
                <th className="px-3 py-3 text-right">Relief</th>
                <th className="px-3 py-3 text-right">Chargeable</th>
                <th className="px-3 py-3 text-right">PAYE</th>
                <th className="px-3 py-3 text-right">Net Pay</th>
                <th className="px-3 py-3 text-left w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((line: any) => {
                const annualGross = line.annualGross || 0;
                const relief = line.taxRelief || 0;
                const pensionAnnual = (line.pensionEmployee || 0) * 12;
                const nhfAnnual = (line.nhf || 0) * 12;
                const chargeable = Math.max(0, annualGross - relief - pensionAnnual - nhfAnnual);
                return (
                  <tr key={line.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 pl-3 pr-1">
                      <input type="checkbox" checked={selectedPayeIds.includes(line.employeeId)}
                        onChange={e => { setSelectedPayeIds(prev => e.target.checked ? [...prev, line.employeeId] : prev.filter(i => i !== line.employeeId)); }}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-500">{line.employee?.staffId || '—'}</td>
                    <td className="py-2.5 px-2 text-slate-700">{line.employee?.firstName} {line.employee?.lastName}</td>
                    <td className="py-2.5 px-2 text-right font-mono">{formatNaira(line.grossPay)}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-amber-600">{formatNaira(line.pensionEmployee)}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-slate-500">{formatNaira(line.nhf)}</td>
                    <td className="py-2.5 px-2 text-right font-mono">{formatNaira(annualGross)}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-indigo-600">{formatNaira(relief)}</td>
                    <td className="py-2.5 px-2 text-right font-mono font-semibold">{formatNaira(chargeable)}</td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold text-red-600">{formatNaira(line.paye)}</td>
                    <td className="py-2.5 px-2 text-right font-mono font-semibold text-emerald-600">{formatNaira(line.netPay)}</td>
                    <td className="py-2.5 px-2">
                      {selectedRun?.status === 'draft' && (
                        <button onClick={() => { if (confirm(`Delete PAYE line for ${line.employee?.firstName} ${line.employee?.lastName}?`)) deletePayeLineMutation.mutate({ runId: selectedRunId, employeeId: line.employeeId }); }}
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
                <td className="px-2 py-3 text-right">{formatNaira(totals.gross)}</td>
                <td className="px-2 py-3 text-right">—</td>
                <td className="px-2 py-3 text-right">—</td>
                <td className="px-2 py-3 text-right">—</td>
                <td className="px-2 py-3 text-right">—</td>
                <td className="px-2 py-3 text-right">{formatNaira(totals.chargeable)}</td>
                <td className="px-2 py-3 text-right text-red-700">{formatNaira(totals.paye)}</td>
                <td className="px-2 py-3 text-right text-emerald-700">{formatNaira(totals.net)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}