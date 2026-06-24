import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Loader2, AlertCircle, FileText, Search, X, Printer
} from 'lucide-react';

function formatNaira(kobo: number) {
  return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}
function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function PayslipsPage() {
  const [search, setSearch] = useState('');
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [viewingPayslip, setViewingPayslip] = useState<any>(null);

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

  function printPayslip() {
    if (!viewingPayslip) return;
    const { line, run, employee, calculation } = viewingPayslip;
    const calc = calculation || {
      grossPay: line.grossPay, basic: line.basic, housing: line.housing,
      transport: line.transport, otherAllowances: line.otherAllowances,
      pensionEmployee: line.pensionEmployee, pensionEmployer: line.pensionEmployer,
      nhf: line.nhf, annualGross: line.annualGross, cra: line.taxRelief,
      chargeableIncome: line.annualGross - line.taxRelief - (line.pensionEmployee || 0) * 12 - (line.nhf || 0) * 12,
      annualPaye: line.paye * 12, monthlyPaye: line.paye,
      otherDeductions: line.otherDeductions, netPay: line.netPay,
      effectiveTaxRate: line.grossPay > 0 ? line.paye / line.grossPay : 0,
      breakdown: [],
    };

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Payslip - ${employee?.firstName} ${employee?.lastName}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Segoe UI',sans-serif;color:#1e293b;padding:30px;font-size:12px}
      .header{text-align:center;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #0f172a}
      .company{font-size:20px;font-weight:800}
      .subtitle{font-size:10px;color:#64748b;margin-top:2px}
      .title{font-size:16px;font-weight:700;margin-top:8px}
      .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0;padding:12px;background:#f8fafc;border-radius:8px}
      .info-grid div{font-size:11px}
      .info-grid .label{color:#64748b;font-weight:600}
      .info-grid .value{font-weight:700;color:#0f172a}
      table{width:100%;border-collapse:collapse;margin:12px 0}
      th{background:#0f172a;color:#fff;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase}
      td{padding:7px 10px;border-bottom:1px solid #e2e8f0;font-size:11px}
      tr:nth-child(even) td{background:#f8fafc}
      .total-row td{font-weight:700;background:#f1f5f9;border-top:2px solid #0f172a}
      .net-row td{font-weight:800;background:#dbeafe;border-top:2px solid #1e40af;color:#1e40af;font-size:13px}
      .footer{text-align:center;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px;margin-top:24px}
      .badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:10px;font-weight:700;background:#dbeafe;color:#1e40af}
      @media print{body{padding:15px}}
    </style></head><body>
    <div class="header">
      <div class="company">SkyBooks</div>
      <div class="subtitle">By Skyhouse Accountants &amp; Technologies</div>
      <div class="title">Payslip</div>
      <span class="badge">${run?.runNumber || ''}</span>
    </div>
    <div class="info-grid">
      <div><div class="label">Employee</div><div class="value">${employee?.firstName || ''} ${employee?.lastName || ''}</div></div>
      <div><div class="label">Staff ID</div><div class="value">${employee?.staffId || ''}</div></div>
      <div><div class="label">Department</div><div class="value">${employee?.department || '—'}</div></div>
      <div><div class="label">Designation</div><div class="value">${employee?.designation || '—'}</div></div>
      <div><div class="label">Period</div><div class="value">${fmtDate(run?.periodStart)} – ${fmtDate(run?.periodEnd)}</div></div>
      <div><div class="label">Pay Date</div><div class="value">${fmtDate(run?.payDate)}</div></div>
    </div>
    <table>
      <thead><tr><th>Earnings</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>
        <tr><td>Basic Salary</td><td style="text-align:right">${formatNaira(calc.basic)}</td></tr>
        <tr><td>Housing Allowance</td><td style="text-align:right">${formatNaira(calc.housing)}</td></tr>
        <tr><td>Transport Allowance</td><td style="text-align:right">${formatNaira(calc.transport)}</td></tr>
        <tr><td>Other Allowances</td><td style="text-align:right">${formatNaira(calc.otherAllowances)}</td></tr>
        <tr class="total-row"><td>Gross Pay</td><td style="text-align:right">${formatNaira(calc.grossPay)}</td></tr>
      </tbody>
    </table>
    <table>
      <thead><tr><th>Deductions</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>
        <tr><td>PAYE Tax</td><td style="text-align:right">${formatNaira(calc.monthlyPaye)}</td></tr>
        <tr><td>Pension (Employee 8%)</td><td style="text-align:right">${formatNaira(calc.pensionEmployee)}</td></tr>
        <tr><td>NHF (2.5%)</td><td style="text-align:right">${formatNaira(calc.nhf)}</td></tr>
        <tr class="net-row"><td>Net Pay</td><td style="text-align:right">${formatNaira(calc.netPay)}</td></tr>
      </tbody>
    </table>
    <div class="footer">
      SkyBooks By Skyhouse Accountants &amp; Technologies (Olalekan Williams Edun) &bull; Confidential<br/>
      Generated: ${new Date().toLocaleString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
    </div>
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
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
        <select value={selectedRunId} onChange={e => setSelectedRunId(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10">
          <option value="">Select a payroll run...</option>
          {runs.map(r => (
            <option key={r.id} value={r.id}>{r.runNumber} — {fmtDate(r.periodStart)} to {fmtDate(r.periodEnd)}</option>
          ))}
        </select>
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
                <th className="py-3 px-4 text-left">Staff ID</th>
                <th className="py-3 px-2 text-left">Employee</th>
                <th className="py-3 px-2 text-left">Department</th>
                <th className="py-3 px-2 text-right">Gross</th>
                <th className="py-3 px-2 text-right">PAYE</th>
                <th className="py-3 px-2 text-right">Pension</th>
                <th className="py-3 px-2 text-right">NHF</th>
                <th className="py-3 px-2 text-right">Net</th>
                <th className="py-3 pl-2 pr-4 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((line: any) => (
                <tr key={line.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4 font-mono text-xs text-slate-500">{line.employee?.staffId || '—'}</td>
                  <td className="py-2.5 px-2 text-slate-700">{line.employee?.firstName} {line.employee?.lastName}</td>
                  <td className="py-2.5 px-2 text-xs text-slate-500">{line.employee?.department || '—'}</td>
                  <td className="py-2.5 px-2 text-right font-mono">{formatNaira(line.grossPay)}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-red-600">{formatNaira(line.paye)}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-amber-600">{formatNaira(line.pensionEmployee)}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-slate-500">{formatNaira(line.nhf)}</td>
                  <td className="py-2.5 px-2 text-right font-mono font-semibold text-emerald-600">{formatNaira(line.netPay)}</td>
                  <td className="py-2.5 pl-2 pr-4">
                    <button onClick={() => viewPayslip(line)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md">
                      <FileText size={11} /> View
                    </button>
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
                <button onClick={() => setViewingPayslip(null)} className="p-1 rounded-md text-slate-400 hover:text-slate-600"><X size={18} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {(() => {
                const { line, run, employee } = viewingPayslip;
                if (!line) return <p className="text-sm text-slate-400">No data available.</p>;
                const totalDed = (line.paye || 0) + (line.pensionEmployee || 0) + (line.nhf || 0) + (line.otherDeductions || 0);
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
                      <div className="flex justify-between"><span className="text-slate-500">Basic Salary</span><span className="font-mono">{formatNaira(line.basic)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Housing</span><span className="font-mono">{formatNaira(line.housing)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Transport</span><span className="font-mono">{formatNaira(line.transport)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Other Allowances</span><span className="font-mono">{formatNaira(line.otherAllowances)}</span></div>
                      <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-100"><span>Gross Pay</span><span className="font-mono">{formatNaira(line.grossPay)}</span></div>
                    </div>
                    <div className="border-t border-slate-100 pt-4 space-y-2 text-sm">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Deductions</h4>
                      <div className="flex justify-between"><span className="text-slate-500">PAYE Tax</span><span className="font-mono text-red-600">{formatNaira(line.paye)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Pension (EE 8%)</span><span className="font-mono text-amber-600">{formatNaira(line.pensionEmployee)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">NHF (2.5%)</span><span className="font-mono text-slate-600">{formatNaira(line.nhf)}</span></div>
                      {line.otherDeductions > 0 && <div className="flex justify-between"><span className="text-slate-500">Other Deductions</span><span className="font-mono">{formatNaira(line.otherDeductions)}</span></div>}
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