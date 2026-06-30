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
    const calc = calculation || {};

    const intDedArr = Array.isArray(calc.internalDeductions || line.internalDeductions) ? (calc.internalDeductions || line.internalDeductions) : [];
    const intDedTotal = intDedArr.reduce((s: number, d: any) => s + (d.amount || 0), 0);

    const eRows = [
      { l: 'Basic Salary', v: calc.basicSalary || line.basic || 0 },
      { l: 'Housing Allowance', v: calc.housing || line.housing || 0 },
      { l: 'Transport Allowance', v: calc.transport || line.transport || 0 },
      { l: 'Utilities Allowance', v: calc.utilities || 0 },
      { l: 'Meals Allowance', v: calc.meals || 0 },
      { l: 'Other Allowances', v: calc.otherAllowances || line.otherAllowances || 0 },
    ];
    const sRows = [
      { l: 'PAYE Tax', v: calc.monthlyPAYE || line.paye || 0 },
      { l: 'Pension (EE)', v: calc.pensionEE || line.pensionEmployee || 0 },
      { l: 'NHIS (5% of Basic)', v: calc.nhis || line.nhis || 0 },
      { l: 'NHF (2.5% of Basic)', v: calc.nhf || line.nhf || 0 },
    ];
    const totalDed = sRows.reduce((s, r) => s + r.v, 0) + intDedTotal;
    const gross = calc.grossPay || line.grossPay || 0;
    const net = calc.netPay || line.netPay || 0;

    const bands = (calc.bandBreakdown || []).map((b: any) => `
      <tr><td>${b.bandName || b.band}</td><td>${(b.rate * 100).toFixed(0)}%</td><td class="r">${formatNaira(b.taxableAmountInBand || b.taxableAmount || 0)}</td><td class="r fw">${formatNaira(b.taxAmountInBand || b.tax || 0)}</td></tr>
    `).join('');

    const hasRelief = (calc.rentRelief || 0) > 0 || (calc.mortgageInterestRelief || 0) > 0 || (calc.lifeAssuranceRelief || 0) > 0;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Payslip - ${employee?.firstName} ${employee?.lastName}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Inter','Segoe UI',sans-serif;background:#eef2f6;padding:28px;font-size:11px;color:#1e293b}
      .page{max-width:860px;margin:0 auto;background:#fff;border-radius:14px;box-shadow:0 2px 20px rgba(0,0,0,0.06)}
      .top-bar{background:#0f172a;padding:18px 28px;display:flex;align-items:center;justify-content:space-between;border-radius:14px 14px 0 0}
      .top-bar .org-name{color:#fff;font-size:15px;font-weight:700}
      .top-bar .org-detail{color:#94a3b8;font-size:8px;line-height:1.5}
      .top-bar .badge{background:#2563eb;color:#fff;padding:3px 12px;border-radius:20px;font-size:9px;font-weight:700}
      .content{padding:22px 28px}
      .emp-grid{display:flex;justify-content:space-between;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #e2e8f0}
      .emp-grid .left .name{font-size:15px;font-weight:700;color:#0f172a}
      .emp-grid .left .meta{font-size:9px;color:#64748b;margin-top:1px}
      .emp-grid .right{text-align:right;font-size:9px;color:#64748b}
      .emp-grid .right strong{color:#0f172a;font-size:10px}
      .two-col{display:flex;gap:20px;margin-bottom:14px}
      .two-col > div{flex:1}
      .card{background:#f8fafc;border-radius:8px;padding:12px;border:1px solid #e2e8f0;margin-bottom:14px}
      .card-title{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;margin-bottom:6px}
      .row{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dashed #e2e8f0;font-size:10px}
      .row:last-child{border-bottom:none}
      .row .lb{color:#64748b}
      .row .vl{font-weight:600;color:#0f172a}
      .row .tot{border-top:1.5px solid #0f172a;margin-top:3px;padding-top:5px;font-weight:700}
      .row .tot .vl{color:#0f172a}
      .net-box{background:linear-gradient(135deg,#1e3a5f,#2563eb);border-radius:10px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
      .net-box .nl{color:#bfdbfe;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em}
      .net-box .na{color:#fff;font-size:20px;font-weight:800}
      .net-box .ns{color:#93c5fd;font-size:8px;margin-top:1px}
      table.tax{width:100%;border-collapse:collapse;font-size:10px}
      table.tax th{text-align:left;color:#64748b;font-weight:600;padding:4px 6px;border-bottom:1px solid #e2e8f0}
      table.tax td{padding:3px 6px;border-bottom:1px dashed #e2e8f0}
      table.tax .r{text-align:right}
      table.tax .fw{font-weight:600}
      .metric-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
      .metric{background:#f1f5f9;border-radius:8px;padding:10px 12px;text-align:center}
      .metric .ml{font-size:8px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em}
      .metric .mv{font-size:15px;font-weight:700;margin-top:2px}
      .footer-note{text-align:center;font-size:7px;color:#94a3b8;border-top:1px solid #e2e8f0;padding:10px 28px}
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
        <div class="emp-grid">
          <div class="left">
            <div class="name">${employee?.firstName || ''} ${employee?.lastName || ''}</div>
            <div class="meta">${employee?.staffId || ''}${employee?.department ? ` &bull; ${employee.department}` : ''}${employee?.designation ? ` &bull; ${employee.designation}` : ''}</div>
            ${employee?.email ? `<div class="meta">${employee.email}</div>` : ''}
            ${employee?.phone ? `<div class="meta">${employee.phone}</div>` : ''}
            ${employee?.address ? `<div class="meta">${employee.address}</div>` : ''}
          </div>
          <div class="right">
            <strong>${fmtDate(run?.periodStart)} – ${fmtDate(run?.periodEnd)}</strong><br>
            Pay Date: ${fmtDate(run?.payDate)}
          </div>
        </div>

        <div class="two-col">
          <div>
            <div class="card-title">Earnings</div>
            <div class="card">
              ${eRows.map(r => `<div class="row"><span class="lb">${r.l}</span><span class="vl">${formatNaira(r.v)}</span></div>`).join('')}
              <div class="row tot"><span class="lb">Total Gross</span><span class="vl">${formatNaira(gross)}</span></div>
            </div>
            <div class="card-title">Tax Computation (Annual)</div>
            <div class="card">
              <div class="row"><span class="lb">Annual Gross</span><span class="vl">${formatNaira(calc.annualGross || gross * 12)}</span></div>
              <div class="row"><span class="lb">Less: Pension (EE)</span><span class="vl">${formatNaira(calc.annualPension || 0)}</span></div>
              <div class="row"><span class="lb">Less: NHIS</span><span class="vl">${formatNaira(calc.annualNHIS || 0)}</span></div>
              <div class="row"><span class="lb">Less: NHF</span><span class="vl">${formatNaira(calc.annualNHF || 0)}</span></div>
              ${hasRelief ? `<div class="row tot"><span class="lb">Less: Tax Reliefs</span><span class="vl">${formatNaira((calc.rentRelief||0)+(calc.mortgageInterestRelief||0)+(calc.lifeAssuranceRelief||0))}</span></div>` : ''}
              <div class="row tot"><span class="lb">Chargeable Income</span><span class="vl">${formatNaira(calc.chargeableIncome || 0)}</span></div>
              <div class="row"><span class="lb">Annual PAYE</span><span class="vl">${formatNaira(calc.annualPAYE || 0)}</span></div>
              <div class="row"><span class="lb">Effective Rate</span><span class="vl">${((calc.effectiveRatePct || 0)).toFixed(2)}%</span></div>
            </div>
          </div>
          <div>
            <div class="card-title">Statutory Deductions</div>
            <div class="card">
              ${sRows.map(r => `<div class="row"><span class="lb">${r.l}</span><span class="vl">${formatNaira(r.v)}</span></div>`).join('')}
              ${intDedArr.map((d: any) => `<div class="row"><span class="lb" style="padding-left:6px;font-style:italic">${d.description}</span><span class="vl">${formatNaira(d.amount || 0)}</span></div>`).join('')}
              <div class="row tot"><span class="lb">Total Deductions</span><span class="vl">${formatNaira(totalDed)}</span></div>
            </div>
            ${hasRelief ? `<div class="card-title">Tax Reliefs</div>
            <div class="card">
              ${(calc.rentRelief||0) > 0 ? `<div class="row"><span class="lb">Rent Relief</span><span class="vl">${formatNaira(calc.rentRelief)}</span></div>` : ''}
              ${(calc.mortgageInterestRelief||0) > 0 ? `<div class="row"><span class="lb">Mortgage Interest</span><span class="vl">${formatNaira(calc.mortgageInterestRelief)}</span></div>` : ''}
              ${(calc.lifeAssuranceRelief||0) > 0 ? `<div class="row"><span class="lb">Life Assurance</span><span class="vl">${formatNaira(calc.lifeAssuranceRelief)}</span></div>` : ''}
            </div>` : ''}
            <div class="card-title">Employer Contributions</div>
            <div class="card">
              <div class="row"><span class="lb">Pension (ER 10%)</span><span class="vl">${formatNaira(line.pensionEmployer || 0)}</span></div>
              <div class="row tot"><span class="lb">Total Pension Obligation</span><span class="vl">${formatNaira((line.pensionEmployee || 0) + (line.pensionEmployer || 0))}</span></div>
            </div>
            <div class="card-title">Payment Info</div>
            <div class="card">
              <div class="row"><span class="lb">Bank</span><span class="vl">${employee?.bankName || '—'}</span></div>
              <div class="row"><span class="lb">Account</span><span class="vl">${employee?.accountNumber || '—'}</span></div>
              <div class="row"><span class="lb">Tax ID</span><span class="vl">${employee?.taxId || '—'}</span></div>
              ${employee?.pensionPin ? `<div class="row"><span class="lb">Pension PIN</span><span class="vl">${employee.pensionPin}</span></div>` : ''}
              ${employee?.nhfNumber ? `<div class="row"><span class="lb">NHF Number</span><span class="vl">${employee.nhfNumber}</span></div>` : ''}
            </div>
          </div>
        </div>

        <div class="net-box">
          <div>
            <div class="nl">Net Pay</div>
            <div class="ns">After all statutory &amp; internal deductions</div>
          </div>
          <div style="text-align:right">
            <div class="na">${formatNaira(net)}</div>
          </div>
        </div>

        ${bands ? `
        <div class="card-title">Tax Band Breakdown (Annual)</div>
        <div class="card" style="padding:8px">
          <table class="tax">
            <thead><tr><th>Band</th><th>Rate</th><th class="r">Taxable Amount</th><th class="r">Tax</th></tr></thead>
            <tbody>${bands}</tbody>
          </table>
        </div>` : ''}

        <div class="metric-grid">
          <div class="metric"><div class="ml">Annual Gross</div><div class="mv">${formatNaira(calc.annualGross || gross * 12)}</div></div>
          <div class="metric"><div class="ml">Annual PAYE</div><div class="mv" style="color:#dc2626">${formatNaira(calc.annualPAYE || 0)}</div></div>
          <div class="metric"><div class="ml">Monthly PAYE</div><div class="mv" style="color:#dc2626">${formatNaira(calc.monthlyPAYE || line.paye || 0)}</div></div>
          <div class="metric"><div class="ml">Annual Net Pay</div><div class="mv" style="color:#16a34a">${formatNaira(net * 12)}</div></div>
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