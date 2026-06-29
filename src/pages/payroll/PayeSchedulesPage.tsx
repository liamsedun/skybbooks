import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, payrollApi, printWindow, downloadBlob } from '../../lib/api';
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

  const { data: runsData } = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: () => api.get('/payroll/runs').then(r => r.data),
  });

  const runs: any[] = useMemo(() => Array.isArray(runsData) ? runsData : [], [runsData]);

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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">PAYE Schedules</h1>
          <p className="text-sm text-slate-500 mt-0.5">Pay-As-You-Earn tax deductions per employee</p>
        </div>
        {lines.length > 0 && (
          <div className="flex items-center gap-2">
            {selectedPayeIds.length > 0 && selectedRun?.status === 'draft' && (
              <button onClick={() => { if (confirm(`Delete ${selectedPayeIds.length} selected line(s)?`)) bulkDeletePayeMutation.mutate(selectedPayeIds); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100">
                <Trash2 size={14} /> Delete ({selectedPayeIds.length})
              </button>
            )}
            <button onClick={() => {
              try {
                const rows = lines.map((l: any) =>
                  `<tr><td>${l.employee?.staffId||''}</td><td>${l.employee?.firstName||''} ${l.employee?.lastName||''}</td><td class="r">₦${(l.grossPay/100).toFixed(2)}</td><td class="r">₦${(l.paye/100).toFixed(2)}</td><td class="r">₦${(l.netPay/100).toFixed(2)}</td></tr>`
                ).join('');
                printWindow('PAYE Schedule', `<table><thead><tr><th>Staff ID</th><th>Employee</th><th class="r">Gross Pay</th><th class="r">PAYE</th><th class="r">Net Pay</th></tr></thead><tbody>${rows}</tbody></table>`, `${lines.length} employees · ${selectedRun?.runNumber || ''}`);
              } catch (err) {
                alert('Failed to open print window: ' + (err instanceof Error ? err.message : 'Unknown error'));
                console.error('Print error:', err);
              }
            }} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors">
              <Printer size={14} /> PDF
            </button>
            <button onClick={exportCSV} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">
              <Download size={14} /> Export CSV
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-3 items-center">
        <select value={selectedRunId} onChange={e => setSelectedRunId(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10">
          <option value="">Select a payroll run...</option>
          {runs.map(r => (
            <option key={r.id} value={r.id}>{r.runNumber} — {fmtDate(r.periodStart)} to {fmtDate(r.periodEnd)}</option>
          ))}
        </select>
        {selectedRun && (
          <span className="text-xs text-slate-400 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
            Status: <span className="font-semibold capitalize text-slate-700">{selectedRun.status}</span>
          </span>
        )}
      </div>

      {!selectedRunId ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
          <FileText size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">Select a payroll run</p>
          <p className="text-xs text-slate-400 mt-1">Choose a run to view its PAYE schedule</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 bg-white border border-slate-200 rounded-xl">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading...
        </div>
      ) : lines.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
          <AlertCircle size={24} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">No employee lines found in this run.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide border-b border-slate-200">
                <th className="py-3 pl-3 pr-1 w-10">
                  <input type="checkbox" checked={selectedPayeIds.length === lines.length && lines.length > 0}
                    onChange={e => { if (e.target.checked) { setSelectedPayeIds(lines.map((l: any) => l.employeeId)); } else { setSelectedPayeIds([]); } }}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                </th>
                <th className="py-3 px-4 text-left">Staff</th>
                <th className="py-3 px-2 text-left">Employee</th>
                <th className="py-3 px-2 text-right">Gross Pay</th>
                <th className="py-3 px-2 text-right">Pension (EE)</th>
                <th className="py-3 px-2 text-right">NHF</th>
                <th className="py-3 px-2 text-right">Annual Gross</th>
                <th className="py-3 px-2 text-right">Relief</th>
                <th className="py-3 px-2 text-right">Chargeable</th>
                <th className="py-3 px-2 text-right">PAYE</th>
                <th className="py-3 px-2 text-right">Net Pay</th>
                <th className="py-3 px-2 w-16"></th>
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
                  <tr key={line.id} className="hover:bg-slate-50">
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
                          className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded" title="Delete">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200 font-semibold text-sm">
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