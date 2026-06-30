import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, payrollApi, orgApi, printWindow } from '../../lib/api';
import {
  Loader2, AlertCircle, FileText, Search, X, Printer, Download, Trash2
} from 'lucide-react';
import { exportToCsv } from '../../lib/csvTemplates';

function formatNaira(kobo: number) {
  return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}
function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function PayslipsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [viewingPayslip, setViewingPayslip] = useState<any>(null);
  const [selectedPayslipIds, setSelectedPayslipIds] = useState<string[]>([]);

  const deletePayslipMutation = useMutation({
    mutationFn: ({ runId, employeeId }: { runId: string; employeeId: string }) => api.delete(`/payroll/runs/${runId}/payslips/${employeeId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll-run-detail', selectedRunId] }),
  });

  const bulkDeletePayslipsMutation = useMutation({
    mutationFn: (employeeIds: string[]) => api.post(`/payroll/runs/${selectedRunId}/payslips/bulk-delete`, { employeeIds }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-run-detail', selectedRunId] }); setSelectedPayslipIds([]); },
  });

  const { data: runsData, isLoading: runsLoading } = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: () => api.get('/payroll/runs').then(r => r.data),
  });

  const runs: any[] = useMemo(() => Array.isArray(runsData) ? runsData : [], [runsData]);

  const { data: orgData } = useQuery({
    queryKey: ['org'],
    queryFn: orgApi.getOrg,
  });

  const { data: detailData, isLoading } = useQuery({
    queryKey: ['payroll-run-detail', selectedRunId],
    queryFn: () => api.get(`/payroll/runs/${selectedRunId}`).then(r => r.data),
    enabled: !!selectedRunId,
  });

  const lines: any[] = detailData?.lines || [];
  const selectedRun = runs.find(r => r.id === selectedRunId);

  const filtered = useMemo(() => {
    if (!search) return lines;
    const q = search.toLowerCase();
    return lines.filter((l: any) =>
      (l.employee?.firstName || '').toLowerCase().includes(q) ||
      (l.employee?.lastName || '').toLowerCase().includes(q) ||
      (l.employee?.staffId || '').toLowerCase().includes(q)
    );
  }, [lines, search]);

  async function viewPayslip(line: any) {
    try {
      const res = await api.get(`/payroll/runs/${selectedRunId}/payslips/${line.employeeId}`);
      setViewingPayslip(res.data);
    } catch {
      // Fallback: show data from line + employee
      setViewingPayslip({ line, run: selectedRun, employee: line.employee, calculation: null });
    }
  }

  function exportPayslipsCSV() {
    const today = new Date().toISOString().split('T')[0];
    const headers = ['Staff ID', 'Employee', 'Department', 'Gross', 'Basic', 'PAYE', 'Pension', 'NHIS', 'NHF', 'Internal Deductions', 'Net'];
    const rows = filtered.map((l: any) => {
      const intDed = Array.isArray(l.internalDeductions) ? l.internalDeductions.reduce((s: number, d: any) => s + (d.amount || 0), 0) : 0;
      return [l.employee?.staffId||'', `${l.employee?.firstName||''} ${l.employee?.lastName||''}`, l.employee?.department||'', (l.grossPay/100).toFixed(2), (l.basic/100).toFixed(2), (l.paye/100).toFixed(2), (l.pensionEmployee/100).toFixed(2), ((l.nhis||0)/100).toFixed(2), (l.nhf/100).toFixed(2), (intDed/100).toFixed(2), (l.netPay/100).toFixed(2)];
    });
    exportToCsv(`payslips_${today}.csv`, headers, rows);
  }

  function printPayslip() {
    if (!viewingPayslip) return;
    const { line, run, employee, calculation } = viewingPayslip;
    const org = (orgData as any)?.data || orgData || {};
    const nhisVal = (line as any).nhis || 0;
    const intDedArr = Array.isArray((line as any).internalDeductions) ? (line as any).internalDeductions : [];
    const intDedTotal = intDedArr.reduce((s: number, d: any) => s + (d.amount || 0), 0);
    const gp = line.grossPay;
    const bp = employee?.basicSalaryPct ?? 50;
    const hp = employee?.housingPct ?? 20;
    const tp = employee?.transportPct ?? 10;
    const up = employee?.utilitiesPct ?? 10;
    const mp = employee?.mealsPct ?? 5;
    const op = employee?.othersPct ?? 5;
    const sumPct = bp + hp + tp + up + mp + op;
    const basicSalaryAmt = Math.round(gp * bp / sumPct);
    const housingAmt = Math.round(gp * hp / sumPct);
    const transportAmt = Math.round(gp * tp / sumPct);
    const utilitiesAmt = Math.round(gp * up / sumPct);
    const mealsAmt = Math.round(gp * mp / sumPct);
    const othersAmt = gp - basicSalaryAmt - housingAmt - transportAmt - utilitiesAmt - mealsAmt;
    const totalDeductions = line.paye + line.pensionEmployee + nhisVal + line.nhf + intDedTotal;
    const calc = calculation || {
      grossPay: gp, basic: line.basic,
      monthlyPAYE: line.paye,
      pensionEE: line.pensionEmployee,
      nhf: line.nhf,
      nhis: nhisVal,
      otherDeductions: line.otherDeductions,
      internalDeductions: intDedArr,
      netPay: line.netPay,
      basicSalaryAmt, housingAmt, transportAmt, utilitiesAmt, mealsAmt, othersAmt,
    };

    const earningsRows = [
      { label: 'Basic Salary', val: calc.basicSalaryAmt || calc.grossPay },
      { label: 'Housing Allowance', val: calc.housingAmt || 0 },
      { label: 'Transport Allowance', val: calc.transportAmt || 0 },
      { label: 'Utilities Allowance', val: calc.utilitiesAmt || 0 },
      { label: 'Meals Allowance', val: calc.mealsAmt || 0 },
      { label: 'Others', val: calc.othersAmt || 0 },
    ];
    const deductionsRows = [
      { label: 'PAYE Tax', val: calc.monthlyPAYE },
      { label: 'Pension (EE)', val: calc.pensionEE },
      { label: 'NHIS (5% of Basic)', val: calc.nhis },
      { label: 'NHF (2.5% of Basic)', val: calc.nhf },
    ];

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Payslip - ${employee?.firstName} ${employee?.lastName}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Inter','Segoe UI',sans-serif;background:#f1f5f9;padding:30px;font-size:12px;color:#1e293b}
      .page{max-width:800px;margin:0 auto;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden}
      .top-bar{background:#0f172a;padding:20px 30px;display:flex;align-items:center;justify-content:space-between}
      .top-bar .org-name{color:#fff;font-size:16px;font-weight:700}
      .top-bar .org-detail{color:#94a3b8;font-size:9px;line-height:1.5}
      .top-bar .badge{background:#3b82f6;color:#fff;padding:4px 14px;border-radius:20px;font-size:10px;font-weight:700}
      .content{padding:24px 30px}
      .section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:10px}
      .emp-header{display:flex;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #e2e8f0}
      .emp-header .name{font-size:16px;font-weight:700;color:#0f172a}
      .emp-header .meta{font-size:10px;color:#64748b;margin-top:2px}
      .emp-header .period{text-align:right;font-size:10px;color:#64748b}
      .emp-header .period strong{color:#0f172a;font-size:11px}
      .two-col{display:flex;gap:24px;margin-bottom:20px}
      .two-col > div{flex:1}
      .card{background:#f8fafc;border-radius:10px;padding:14px;border:1px solid #e2e8f0}
      .card .row{display:flex;justify-content:space-between;padding:5px 0;font-size:11px;border-bottom:1px dashed #e2e8f0}
      .card .row:last-child{border-bottom:none}
      .card .row .label{color:#64748b}
      .card .row .value{font-weight:600;color:#0f172a}
      .card .row.total{border-top:2px solid #0f172a;margin-top:4px;padding-top:8px;font-weight:700}
      .card .row.total .value{color:#0f172a}
      .net-box{background:linear-gradient(135deg,#1e40af,#3b82f6);border-radius:10px;padding:18px 20px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
      .net-box .net-label{color:#bfdbfe;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em}
      .net-box .net-amount{color:#fff;font-size:22px;font-weight:800}
      .net-box .net-sub{color:#93c5fd;font-size:9px;margin-top:2px}
      .footer-note{text-align:center;font-size:8px;color:#94a3b8;border-top:1px solid #e2e8f0;padding:12px 30px;margin-top:8px}
      @media print{body{background:#fff;padding:0}.page{box-shadow:none;border-radius:0}}
    </style></head><body>
    <div class="page">
      <div class="top-bar">
        <div>
          <div class="org-name">${org.name || 'SkyBooks'}</div>
          <div class="org-detail">${org.address || ''}${org.phone ? ` &bull; ${org.phone}` : ''}${org.email ? `<br>${org.email}` : ''}${org.website ? ` &bull; ${org.website}` : ''}</div>
        </div>
        <span class="badge">${run?.runNumber || 'PAYSLIP'}</span>
      </div>
      <div class="content">
        <div class="emp-header">
          <div>
            <div class="name">${employee?.firstName || ''} ${employee?.lastName || ''}</div>
            <div class="meta">${employee?.staffId || ''}${employee?.department ? ` &bull; ${employee.department}` : ''}</div>
            ${employee?.email ? `<div class="meta">${employee.email}</div>` : ''}
            ${employee?.phone ? `<div class="meta">${employee.phone}</div>` : ''}
            ${employee?.address ? `<div class="meta">${employee.address}</div>` : ''}
          </div>
          <div class="period">
            <strong>${fmtDate(run?.periodStart)} – ${fmtDate(run?.periodEnd)}</strong><br>
            Pay Date: ${fmtDate(run?.payDate)}
          </div>
        </div>
        <div class="two-col">
          <div>
            <div class="section-title">Earnings</div>
            <div class="card">
              ${earningsRows.map(r => `<div class="row"><span class="label">${r.label}</span><span class="value">${formatNaira(r.val)}</span></div>`).join('')}
              <div class="row total"><span class="label">Total Gross</span><span class="value">${formatNaira(calc.grossPay)}</span></div>
            </div>
          </div>
          <div>
            <div class="section-title">Statutory Deductions</div>
            <div class="card">
              ${deductionsRows.map(d => `<div class="row"><span class="label">${d.label}</span><span class="value">${formatNaira(d.val)}</span></div>`).join('')}
              ${intDedArr.length > 0 ? intDedArr.map((d: any) => `<div class="row"><span class="label" style="padding-left:8px;font-style:italic">${d.description}</span><span class="value">${formatNaira(d.amount || 0)}</span></div>`).join('') : ''}
              <div class="row total"><span class="label">Total Deductions</span><span class="value">${formatNaira(totalDeductions)}</span></div>
            </div>
          </div>
        </div>
        <div class="net-box">
          <div>
            <div class="net-label">Net Pay</div>
            <div class="net-sub">After all deductions</div>
          </div>
          <div style="text-align:right">
            <div class="net-amount">${formatNaira(calc.netPay)}</div>
          </div>
        </div>
        <div style="display:flex;gap:24px">
          <div style="flex:1">
            <div class="section-title">Employer Contributions</div>
            <div class="card">
              <div class="row"><span class="label">Pension (EE)</span><span class="value">${formatNaira(line.pensionEmployee)}</span></div>
              <div class="row"><span class="label">Pension (ER 10%)</span><span class="value">${formatNaira(line.pensionEmployer)}</span></div>
              <div class="row total"><span class="label">Total Pension Obligation</span><span class="value">${formatNaira(line.pensionEmployee + line.pensionEmployer)}</span></div>
            </div>
          </div>
          <div style="flex:1">
            <div class="section-title">Payment Info</div>
            <div class="card">
              <div class="row"><span class="label">Bank</span><span class="value">${employee?.bankName || '—'}</span></div>
              <div class="row"><span class="label">Account</span><span class="value">${employee?.accountNumber || '—'}</span></div>
              <div class="row"><span class="label">Tax ID</span><span class="value">${employee?.taxId || '—'}</span></div>
            </div>
          </div>
        </div>
      </div>
      <div class="footer-note">
        ${org.name || 'SkyBooks'} &bull; Confidential &bull; Computer-generated document &bull; ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
      </div>
    </div>
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
    else { alert('Popup blocked. Please allow popups for this site and try again.'); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Payslips</h1>
          <p className="text-sm text-slate-500 mt-0.5">Employee payslips per payroll run</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        {selectedPayslipIds.length > 0 && (
          <button onClick={() => { if (confirm(`Delete ${selectedPayslipIds.length} selected payslip(s)?`)) bulkDeletePayslipsMutation.mutate(selectedPayslipIds); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 disabled:opacity-50">
            <Trash2 size={14} /> Delete ({selectedPayslipIds.length})
          </button>
        )}
          <button onClick={exportPayslipsCSV} disabled={!selectedRunId || filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50">
            <Download size={14} /> CSV
          </button>
        {runsLoading ? (
          <select disabled className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-400">
            <option>Loading runs...</option>
          </select>
        ) : (
          <select key={runs.length} value={selectedRunId} onChange={e => setSelectedRunId(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10">
            <option value="">Select a payroll run...</option>
            {runs.map(r => (
              <option key={r.id} value={r.id}>{r.runNumber} — {fmtDate(r.periodStart)} to {fmtDate(r.periodEnd)}</option>
            ))}
          </select>
        )}
        {selectedRunId && (
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
          </div>
        )}
      </div>

      {!selectedRunId ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
          <FileText size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">Select a payroll run</p>
          <p className="text-xs text-slate-400 mt-1">Choose a run to view employee payslips</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 bg-white border border-slate-200 rounded-xl">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading payslips...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
          <AlertCircle size={24} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">{search ? 'No matching employees' : 'No payslips found'}</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide border-b border-slate-200">
                <th className="py-3 pl-3 pr-1 w-10">
                  <input type="checkbox" checked={selectedPayslipIds.length === filtered.length && filtered.length > 0}
                    onChange={e => { if (e.target.checked) { setSelectedPayslipIds(filtered.map((l: any) => l.employeeId)); } else { setSelectedPayslipIds([]); } }}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                </th>
                <th className="py-3 px-4 text-left">Staff ID</th>
                <th className="py-3 px-2 text-left">Employee</th>
                <th className="py-3 px-2 text-left">Department</th>
                <th className="py-3 px-2 text-right">Gross</th>
                <th className="py-3 px-2 text-right">PAYE</th>
                <th className="py-3 px-2 text-right">Pension</th>
                <th className="py-3 px-2 text-right">NHF</th>
                <th className="py-3 px-2 text-right">Net</th>
                <th className="py-3 pl-2 pr-4 w-28"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((line: any) => (
                <tr key={line.id} className="hover:bg-slate-50">
                  <td className="py-2.5 pl-3 pr-1">
                    <input type="checkbox" checked={selectedPayslipIds.includes(line.employeeId)}
                      onChange={e => { setSelectedPayslipIds(prev => e.target.checked ? [...prev, line.employeeId] : prev.filter(i => i !== line.employeeId)); }}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  </td>
                  <td className="py-2.5 px-4 font-mono text-xs text-slate-500">{line.employee?.staffId || '—'}</td>
                  <td className="py-2.5 px-2 text-slate-700">{line.employee?.firstName} {line.employee?.lastName}</td>
                  <td className="py-2.5 px-2 text-xs text-slate-500">{line.employee?.department || '—'}</td>
                  <td className="py-2.5 px-2 text-right font-mono">{formatNaira(line.grossPay)}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-red-600">{formatNaira(line.paye)}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-amber-600">{formatNaira(line.pensionEmployee)}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-slate-500">{formatNaira(line.nhf)}</td>
                  <td className="py-2.5 px-2 text-right font-mono font-semibold text-emerald-600">{formatNaira(line.netPay)}</td>
                  <td className="py-2.5 pl-2 pr-4">
                    <div className="flex items-center gap-1">
                      <button onClick={() => viewPayslip(line)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md">
                        <FileText size={11} /> View
                      </button>
                      <button onClick={() => {
                        try {
                          const l = line;
                          const intDedArr = Array.isArray((l as any).internalDeductions) ? (l as any).internalDeductions : [];
                          const intDedHtml = intDedArr.map((d: any) => `<tr><td style="padding-left:20px">${d.description}</td><td style="text-align:right">${formatNaira(d.amount || 0)}</td></tr>`).join('');
                          const body = `<table><thead><tr><th>Earnings</th><th style="text-align:right">Amount</th></tr></thead><tbody>
                            <tr><td>Basic Salary</td><td style="text-align:right">${formatNaira(l.basic)}</td></tr>
                            <tr><td>Housing Allowance</td><td style="text-align:right">${formatNaira(l.housing)}</td></tr>
                            <tr><td>Transport Allowance</td><td style="text-align:right">${formatNaira(l.transport)}</td></tr>
                            <tr style="font-weight:bold;border-top:1px solid #ccc"><td>Total Gross</td><td style="text-align:right">${formatNaira(l.grossPay)}</td></tr>
                          </tbody></table>
                          <table><thead><tr><th>Deductions</th><th style="text-align:right">Amount</th></tr></thead><tbody>
                            <tr><td>PAYE Tax</td><td style="text-align:right">${formatNaira(l.paye)}</td></tr>
                            <tr><td>Pension (EE)</td><td style="text-align:right">${formatNaira(l.pensionEmployee)}</td></tr>
                            <tr><td>NHF</td><td style="text-align:right">${formatNaira(l.nhf)}</td></tr>
                            ${intDedHtml}
                            <tr style="font-weight:bold;border-top:2px solid #333;background:#dbeafe"><td>Net Pay</td><td style="text-align:right">${formatNaira(l.netPay)}</td></tr>
                          </tbody></table>`;
                          printWindow(`Payslip - ${l.employee?.firstName||''} ${l.employee?.lastName||''}`, body, `Staff: ${l.employee?.staffId||''}`);
                        } catch (err) {
                          alert('Failed to open print window: ' + (err instanceof Error ? err.message : 'Unknown error'));
                          console.error('Print error:', err);
                        }
                      }}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md">
                        <Download size={11} /> PDF
                      </button>
                      {selectedRun && selectedRun.status === 'draft' && (
                        <button onClick={() => { if (confirm(`Delete payslip for ${line.employee?.firstName} ${line.employee?.lastName}?`)) deletePayslipMutation.mutate({ runId: selectedRunId, employeeId: line.employeeId }); }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md">
                          <Trash2 size={11} /> Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Payslip Detail */}
      {viewingPayslip && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setViewingPayslip(null)} />
          <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Payslip</h2>
              <div className="flex items-center gap-2">
                <button onClick={printPayslip} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg">
                  <Printer size={13} /> Print
                </button>
                <button onClick={() => {
                  try {
                    const { line, employee } = viewingPayslip;
                    const l = line;
                    const intDedArr = Array.isArray((l as any).internalDeductions) ? (l as any).internalDeductions : [];
                    const intDedHtml = intDedArr.map((d: any) => `<tr><td style="padding-left:20px">${d.description}</td><td style="text-align:right">${formatNaira(d.amount || 0)}</td></tr>`).join('');
                    const body = `<table><thead><tr><th>Earnings</th><th style="text-align:right">Amount</th></tr></thead><tbody>
                      <tr><td>Basic Salary</td><td style="text-align:right">${formatNaira(l.basic)}</td></tr>
                      <tr><td>Housing Allowance</td><td style="text-align:right">${formatNaira(l.housing)}</td></tr>
                      <tr><td>Transport Allowance</td><td style="text-align:right">${formatNaira(l.transport)}</td></tr>
                      <tr style="font-weight:bold;border-top:1px solid #ccc"><td>Total Gross</td><td style="text-align:right">${formatNaira(l.grossPay)}</td></tr>
                    </tbody></table>
                    <table><thead><tr><th>Deductions</th><th style="text-align:right">Amount</th></tr></thead><tbody>
                      <tr><td>PAYE Tax</td><td style="text-align:right">${formatNaira(l.paye)}</td></tr>
                      <tr><td>Pension (EE)</td><td style="text-align:right">${formatNaira(l.pensionEmployee)}</td></tr>
                      <tr><td>NHF</td><td style="text-align:right">${formatNaira(l.nhf)}</td></tr>
                      ${intDedHtml}
                      <tr style="font-weight:bold;border-top:2px solid #333;background:#dbeafe"><td>Net Pay</td><td style="text-align:right">${formatNaira(l.netPay)}</td></tr>
                    </tbody></table>`;
                    printWindow(`Payslip - ${employee?.firstName||''} ${employee?.lastName||''}`, body, `Staff: ${employee?.staffId||''}`);
                  } catch (err) {
                    alert('Failed to open print window: ' + (err instanceof Error ? err.message : 'Unknown error'));
                    console.error('Print error:', err);
                  }
                }} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg">
                  <Download size={13} /> PDF
                </button>
                <button onClick={() => setViewingPayslip(null)} className="p-1 rounded-md text-slate-400 hover:text-slate-600"><X size={18} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {(() => {
                const { line, run, employee } = viewingPayslip;
                if (!line) return <p className="text-sm text-slate-400">No data available.</p>;
                const nhisVal = (line as any).nhis || 0;
                const intDedArr = Array.isArray((line as any).internalDeductions) ? (line as any).internalDeductions : [];
                const intDedTotal = intDedArr.reduce((s: number, d: any) => s + (d.amount || 0), 0);
                const totalDed = (line.paye || 0) + (line.pensionEmployee || 0) + nhisVal + (line.nhf || 0) + intDedTotal;
                return (
                  <div className="space-y-5">
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Net Pay</p>
                      <p className="text-2xl font-black text-emerald-600 mt-1">{formatNaira(line.netPay)}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">After all deductions</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-50 rounded-lg p-3"><span className="text-slate-400">Employee</span><p className="font-semibold mt-0.5">{employee?.firstName} {employee?.lastName}</p></div>
                      <div className="bg-slate-50 rounded-lg p-3"><span className="text-slate-400">Staff ID</span><p className="font-semibold mt-0.5">{employee?.staffId}</p></div>
                      <div className="bg-slate-50 rounded-lg p-3"><span className="text-slate-400">Department</span><p className="font-semibold mt-0.5">{employee?.department || '—'}</p></div>
                      <div className="bg-slate-50 rounded-lg p-3"><span className="text-slate-400">Pay Period</span><p className="font-semibold mt-0.5">{fmtDate(run?.periodStart)} – {fmtDate(run?.periodEnd)}</p></div>
                    </div>
                    <div className="border-t border-slate-100 pt-4 space-y-2 text-sm">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Earnings</h4>
                      {(() => {
                        const gp = line.grossPay;
                        const bp = employee?.basicSalaryPct ?? 50;
                        const hp = employee?.housingPct ?? 20;
                        const tp = employee?.transportPct ?? 10;
                        const up = employee?.utilitiesPct ?? 10;
                        const mp = employee?.mealsPct ?? 5;
                        const op = employee?.othersPct ?? 5;
                        const sumPct = bp + hp + tp + up + mp + op;
                        const basicAmt = Math.round(gp * bp / sumPct);
                        const housingAmt = Math.round(gp * hp / sumPct);
                        const transportAmt = Math.round(gp * tp / sumPct);
                        const utilitiesAmt = Math.round(gp * up / sumPct);
                        const mealsAmt = Math.round(gp * mp / sumPct);
                        const othersAmt = gp - basicAmt - housingAmt - transportAmt - utilitiesAmt - mealsAmt;
                        return (
                          <div className="space-y-1">
                            <div className="flex justify-between"><span className="text-slate-500">Basic Salary</span><span className="font-mono">{formatNaira(basicAmt)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Housing Allowance</span><span className="font-mono">{formatNaira(housingAmt)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Transport Allowance</span><span className="font-mono">{formatNaira(transportAmt)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Utilities Allowance</span><span className="font-mono">{formatNaira(utilitiesAmt)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Meals Allowance</span><span className="font-mono">{formatNaira(mealsAmt)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Others</span><span className="font-mono">{formatNaira(othersAmt)}</span></div>
                            <div className="flex justify-between font-semibold border-t border-slate-100 pt-1"><span className="text-slate-700">Total Gross</span><span className="font-mono">{formatNaira(gp)}</span></div>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="border-t border-slate-100 pt-4 space-y-2 text-sm">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Statutory Deductions</h4>
                      <div className="flex justify-between"><span className="text-slate-500">PAYE Tax</span><span className="font-mono text-red-600">{formatNaira(line.paye)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Pension (EE)</span><span className="font-mono text-amber-600">{formatNaira(line.pensionEmployee)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">NHIS (5% of Basic)</span><span className="font-mono text-amber-600">{formatNaira(nhisVal)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">NHF (2.5% of Basic)</span><span className="font-mono text-slate-600">{formatNaira(line.nhf)}</span></div>
                      {intDedArr.map((d: any, i: number) => (
                        <div key={i} className="flex justify-between"><span className="text-slate-500">{d.description}</span><span className="font-mono">{formatNaira(d.amount || 0)}</span></div>
                      ))}
                      <div className="flex justify-between font-bold pt-1 border-t border-slate-100"><span>Total Deductions</span><span className="font-mono text-red-600">{formatNaira(totalDed)}</span></div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex justify-between items-center">
                      <span className="text-sm font-bold text-emerald-800">NET PAY</span>
                      <span className="text-lg font-black text-emerald-700 font-mono">{formatNaira(line.netPay)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}