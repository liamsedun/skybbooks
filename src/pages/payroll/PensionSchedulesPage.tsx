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

export function PensionSchedulesPage() {
  const qc = useQueryClient();
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Pension Schedules</h1>
          <p className="text-sm text-slate-500 mt-0.5">Employee and employer pension contributions per run</p>
        </div>
        {lines.length > 0 && (
          <div className="flex items-center gap-2">
            {selectedPensionIds.length > 0 && selectedRun?.status === 'draft' && (
              <button onClick={() => { if (confirm(`Delete ${selectedPensionIds.length} selected line(s)?`)) bulkDeletePensionMutation.mutate(selectedPensionIds); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100">
                <Trash2 size={14} /> Delete ({selectedPensionIds.length})
              </button>
            )}
            <button onClick={() => {
              try {
                const rows = lines.map((l: any) =>
                  `<tr><td>${l.employee?.staffId||''}</td><td>${l.employee?.firstName||''} ${l.employee?.lastName||''}</td><td class="r">₦${(l.grossPay/100).toFixed(2)}</td><td class="r">₦${(l.pensionEmployee/100).toFixed(2)}</td><td class="r">₦${(l.pensionEmployer/100).toFixed(2)}</td><td class="r">₦${((l.pensionEmployee+l.pensionEmployer)/100).toFixed(2)}</td></tr>`
                ).join('');
                printWindow('Pension Schedule', `<table><thead><tr><th>Staff ID</th><th>Employee</th><th class="r">Gross Pay</th><th class="r">Employee</th><th class="r">Employer</th><th class="r">Total</th></tr></thead><tbody>${rows}</tbody></table>`, `${lines.length} employees · ${selectedRun?.runNumber || ''}`);
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
      </div>

      {!selectedRunId ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
          <FileText size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">Select a payroll run</p>
          <p className="text-xs text-slate-400 mt-1">Choose a run to view its pension schedule</p>
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
                  <input type="checkbox" checked={selectedPensionIds.length === lines.length && lines.length > 0}
                    onChange={e => { if (e.target.checked) { setSelectedPensionIds(lines.map((l: any) => l.employeeId)); } else { setSelectedPensionIds([]); } }}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                </th>
                <th className="py-3 px-4 text-left">Staff ID</th>
                <th className="py-3 px-2 text-left">Employee</th>
                <th className="py-3 px-2 text-right">Gross Pay</th>
                <th className="py-3 px-2 text-right">Pensionable</th>
                <th className="py-3 px-2 text-right">Employee 8%</th>
                <th className="py-3 px-2 text-right">Employer 10%</th>
                <th className="py-3 px-2 text-right">Total</th>
                <th className="py-3 px-2 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((line: any) => {
                const pensionable = line.basic || 0;
                const totalPension = (line.pensionEmployee || 0) + (line.pensionEmployer || 0);
                return (
                  <tr key={line.id} className="hover:bg-slate-50">
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