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

function buildPayslipHtml(line: any, run: any, employee: any, calc: any, org: any): string {
  const intDedArr = Array.isArray(calc?.internalDeductions || line?.internalDeductions) ? (calc?.internalDeductions || line?.internalDeductions) : [];
  const intDedTotal = intDedArr.reduce((s: number, d: any) => s + (d.amount || 0), 0);

  const eRows = [
    { l: 'Basic Salary', v: calc?.basicSalary || line?.basic || 0 },
    { l: 'Housing Allowance', v: calc?.housing || line?.housing || 0 },
    { l: 'Transport Allowance', v: calc?.transport || line?.transport || 0 },
    { l: 'Utilities Allowance', v: calc?.utilities || 0 },
    { l: 'Meals Allowance', v: calc?.meals || 0 },
    { l: 'Other Allowances', v: calc?.otherAllowances || line?.otherAllowances || 0 },
  ];
  const sRows = [
    { l: 'PAYE Tax', v: calc?.monthlyPAYE || line?.paye || 0 },
    { l: 'Pension (EE)', v: calc?.pensionEE || line?.pensionEmployee || 0 },
    { l: 'NHIS', v: calc?.nhis || line?.nhis || 0 },
    { l: 'NHF', v: calc?.nhf || line?.nhf || 0 },
  ];
  const totalDed = sRows.reduce((s, r) => s + r.v, 0) + intDedTotal;
  const gross = calc?.grossPay || line?.grossPay || 0;
  const net = calc?.netPay || line?.netPay || 0;

  const bands = (calc?.bandBreakdown || []).map((b: any) => `
    <tr><td class="bn">${b.bandName || b.band}</td><td class="r">${(b.rate * 100).toFixed(0)}%</td><td class="r">${formatNaira(b.taxableAmountInBand || b.taxableAmount || 0)}</td><td class="r fw">${formatNaira(b.taxAmountInBand || b.tax || 0)}</td></tr>
  `).join('');

  const totalRelief = calc ? ((calc.rentRelief||0) + (calc.mortgageInterestRelief||0) + (calc.lifeAssuranceRelief||0)) : 0;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Payslip - ${employee?.firstName} ${employee?.lastName}</title>
  <style>
    @page{size:A4 portrait;margin:0}
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:#fff;font-size:9.5px;color:#0f172a;-webkit-font-smoothing:antialiased;width:210mm;height:297mm;overflow:hidden}
    .page{width:210mm;height:297mm;background:#fff;position:relative}
    .watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:120px;font-weight:900;color:rgba(180,40,50,0.12);letter-spacing:18px;white-space:nowrap;pointer-events:none;z-index:0}
    .header{background:#1e3a5f;padding:10px 22px;display:flex;align-items:center;justify-content:space-between;position:relative;z-index:1}
    .header-left{display:flex;align-items:center;gap:10px}
    .header-logo{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff;overflow:hidden;flex-shrink:0}
    .header-logo img{width:100%;height:100%;object-fit:cover;border-radius:6px}
    .header-logo .fallback{width:100%;height:100%;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;border-radius:6px}
    .header h1{color:#fff;font-size:14px;font-weight:700}
    .header .sub{color:#a0b8d4;font-size:7px;margin-top:1px;line-height:1.4}
    .header-right .badge{display:inline-block;background:rgba(255,255,255,0.12);color:#e8f0fe;padding:3px 14px;border-radius:14px;font-size:12px;font-weight:800;letter-spacing:0.04em}
    .body{padding:8px 22px 4px;position:relative;z-index:1}
    .emp-row{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #eef1f5}
    .emp-row .name{font-size:14px;font-weight:700;color:#1e3a5f}
    .emp-row .emp-meta{font-size:8.5px;color:#6b7a90;margin-top:1px}
    .emp-row .emp-meta span{display:inline-block;margin-right:8px}
    .emp-row .period{text-align:right;font-size:8.5px;color:#6b7a90;line-height:1.5}
    .emp-row .period strong{color:#1e3a5f;font-size:9px;font-weight:600}
    .grid-2{display:flex;gap:14px;margin-bottom:5px}
    .grid-2 > div{flex:1;min-width:0}
    .section-header{font-size:7px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#8b9ab0;margin-bottom:3px}
    .card{border:1px solid #e2e8f0;border-radius:6px;overflow:hidden}
    .card-row{display:flex;justify-content:space-between;align-items:center;padding:4px 10px;font-size:9px;border-bottom:1px solid #f1f5f9}
    .card-row:last-child{border-bottom:none}
    .card-row .lb{color:#475569}
    .card-row .vl{font-weight:600;color:#0f172a;font-variant-numeric:tabular-nums}
    .card-row.highlight{background:#f0f7ff}
    .card-row.total{border-top:1.5px solid #1e3a5f;margin-top:0;background:#f1f5f9;padding:4px 10px}
    .card-row.total .lb{font-weight:700;color:#1e3a5f}
    .card-row.total .vl{color:#1e3a5f}
    .relief-list{padding:2px 10px 2px;font-size:8.5px}
    .relief-list .rl-row{display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px dashed #eef2f6}
    .relief-list .rl-row:last-child{border-bottom:none}
    .relief-list .rl-label{color:#475569;padding-left:8px}
    .relief-list .rl-value{font-weight:600;color:#0f172a;font-variant-numeric:tabular-nums}
    .net-panel{background:linear-gradient(135deg,#1e3a5f,#2d5a87);border-radius:8px;padding:8px 18px;display:flex;justify-content:space-between;align-items:center;margin-bottom:5px}
    .net-panel .nl{color:#b8cfe8;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em}
    .net-panel .ns{color:#8aadd0;font-size:7px;margin-top:1px}
    .net-panel .na{color:#fff;font-size:20px;font-weight:800}
    table.bands{width:100%;border-collapse:separate;border-spacing:0;font-size:9px;border-radius:6px;overflow:hidden}
    table.bands th{padding:5px 10px;text-align:left;color:#fff;font-weight:700;font-size:7px;text-transform:uppercase;letter-spacing:0.07em;background:#1e3a5f}
    table.bands td{padding:4px 10px;border-bottom:1px solid #eef2f6;color:#1e293b;font-variant-numeric:tabular-nums;background:#fff}
    table.bands tr:last-child td{border-bottom:none}
    table.bands tr:nth-child(even) td{background:#f8fafc}
    table.bands .r{text-align:right;font-weight:500}
    table.bands .fw{font-weight:700;color:#1e3a5f}
    table.bands .bn{color:#475569}
    .metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}
    .metric-card{border:1px solid #e2e8f0;border-radius:6px;padding:5px 5px;text-align:center;background:#fafbfc}
    .metric-card .ml{font-size:6.5px;color:#8b9ab0;text-transform:uppercase;letter-spacing:0.05em;font-weight:700;margin-bottom:2px}
    .metric-card .mv{font-size:11px;font-weight:700;color:#0f172a;font-variant-numeric:tabular-nums}
    .footer{text-align:center;padding:5px 22px;border-top:1px solid #e2e8f0;font-size:7.5px;color:#94a3b8;position:relative;z-index:1}
    @media print{body{background:#fff}.page{box-shadow:none;border-radius:0}}
  </style></head><body>
  <div class="page">
    <div class="watermark">CONFIDENTIAL</div>
  <div class="page">
    <div class="header">
      <div class="header-left">
        <div class="header-logo">
          ${org?.logoUrl ? `<img src="${org.logoUrl}" alt="" />` : `<div class="fallback">${(org?.name || 'S')[0]}</div>`}
        </div>
        <div>
          <h1>${org?.name || 'SkyBooks'}</h1>
          <div class="sub">${[org?.address, org?.phone, org?.email].filter(Boolean).join(' &bull; ')}</div>
        </div>
      </div>
      <div class="header-right">
        <div class="badge">PAYSLIP ${run?.runNumber || ''}</div>
      </div>
    </div>
    <div class="body">
      <div class="emp-row">
        <div>
          <div class="name">${employee?.firstName || ''} ${employee?.lastName || ''}</div>
          <div class="emp-meta">
            ${employee?.staffId ? `<span>${employee.staffId}</span>` : ''}
            ${employee?.department ? `<span>${employee.department}</span>` : ''}
            ${employee?.designation ? `<span>${employee.designation}</span>` : ''}
          </div>
          <div class="emp-meta">
            ${employee?.email ? `<span>${employee.email}</span>` : ''}
            ${employee?.phone ? `<span>${employee.phone}</span>` : ''}
          </div>
          ${employee?.address ? `<div class="emp-meta">${employee.address}</div>` : ''}
        </div>
        <div class="period">
          <strong>${fmtDate(run?.periodStart)} – ${fmtDate(run?.periodEnd)}</strong><br>
          Pay Date: ${fmtDate(run?.payDate)}
        </div>
      </div>

      <div class="grid-2">
        <div>
          <div class="section-header">Earnings</div>
          <div class="card">
            ${eRows.map(r => `<div class="card-row"><span class="lb">${r.l}</span><span class="vl">${formatNaira(r.v)}</span></div>`).join('')}
            <div class="card-row total"><span class="lb">Total Gross</span><span class="vl">${formatNaira(gross)}</span></div>
          </div>
        </div>
        <div>
          <div class="section-header">Statutory Deductions</div>
          <div class="card">
            ${sRows.map(r => `<div class="card-row"><span class="lb">${r.l}</span><span class="vl">${formatNaira(r.v)}</span></div>`).join('')}
            ${intDedArr.map((d: any) => `<div class="card-row"><span class="lb" style="padding-left:18px;font-style:italic;color:#8b9ab0">${d.description}</span><span class="vl">${formatNaira(d.amount || 0)}</span></div>`).join('')}
            <div class="card-row total"><span class="lb">Total Deductions</span><span class="vl">${formatNaira(totalDed)}</span></div>
          </div>
          <div style="margin-top:12px">
            <div class="section-header">Employer Contributions</div>
            <div class="card">
              <div class="card-row"><span class="lb">Pension (ER 10%)</span><span class="vl">${formatNaira(line?.pensionEmployer || 0)}</span></div>
              <div class="card-row total"><span class="lb">Total Pension Obligation</span><span class="vl">${formatNaira((line?.pensionEmployee || 0) + (line?.pensionEmployer || 0))}</span></div>
            </div>
          </div>
        </div>
      </div>

      <div class="net-panel">
        <div>
          <div class="nl">Net Pay</div>
          <div class="ns">After all statutory &amp; internal deductions</div>
        </div>
        <div class="na">${formatNaira(net)}</div>
      </div>

      ${calc ? `
      <div class="grid-2">
        <div>
          <div class="section-header">Tax Computation (Annual)</div>
          <div class="card">
            <div class="card-row"><span class="lb">Annual Gross</span><span class="vl">${formatNaira(calc.annualGross || gross * 12)}</span></div>
            <div class="card-row"><span class="lb">Less: Pension (EE)</span><span class="vl">${formatNaira(calc.annualPension || 0)}</span></div>
            <div class="card-row"><span class="lb">Less: NHIS</span><span class="vl">${formatNaira(calc.annualNHIS || 0)}</span></div>
            <div class="card-row"><span class="lb">Less: NHF</span><span class="vl">${formatNaira(calc.annualNHF || 0)}</span></div>
            ${calc ? `<div class="relief-list">
              <div style="font-weight:700;color:#1e3a5f;font-size:9.5px;padding:4px 0;border-bottom:1px solid #e2e8f0;margin-bottom:4px">Less: Tax Reliefs (Monthly)</div>
              <div class="rl-row"><span class="rl-label">Rent Relief</span><span class="rl-value">${formatNaira(calc.rentRelief || 0)}</span></div>
              <div class="rl-row"><span class="rl-label">Mortgage Loan Interest</span><span class="rl-value">${formatNaira(calc.mortgageInterestRelief || 0)}</span></div>
              <div class="rl-row"><span class="rl-label">Life Insurance</span><span class="rl-value">${formatNaira(calc.lifeAssuranceRelief || 0)}</span></div>
            </div>` : ''}
            <div class="card-row total"><span class="lb">Chargeable Income</span><span class="vl">${formatNaira(calc.chargeableIncome || 0)}</span></div>
            <div class="card-row"><span class="lb">Annual PAYE</span><span class="vl">${formatNaira(calc.annualPAYE || 0)}</span></div>
            <div class="card-row"><span class="lb">Effective Rate</span><span class="vl">${((calc.effectiveRatePct || 0)).toFixed(2)}%</span></div>
          </div>
        </div>
        <div>
          <div class="section-header">Payment Info</div>
          <div class="card">
            <div class="card-row"><span class="lb">Bank</span><span class="vl">${employee?.bankName || '—'}</span></div>
            <div class="card-row"><span class="lb">Account</span><span class="vl">${employee?.accountNumber || '—'}</span></div>
            <div class="card-row"><span class="lb">Tax ID</span><span class="vl">${employee?.taxId || '—'}</span></div>
            ${employee?.pensionPin ? `<div class="card-row"><span class="lb">Pension PIN</span><span class="vl">${employee.pensionPin}</span></div>` : ''}
            ${employee?.nhfNumber ? `<div class="card-row"><span class="lb">NHF Number</span><span class="vl">${employee.nhfNumber}</span></div>` : ''}
          </div>
          
        </div>
      </div>

      ${bands ? `
      <div style="margin-top:16px">
        <div class="section-header">Tax Band Breakdown</div>
        <div class="card" style="padding:0">
          <table class="bands">
            <thead><tr><th>Band</th><th style="text-align:right">Rate</th><th style="text-align:right">Taxable Amount</th><th style="text-align:right">Tax</th></tr></thead>
            <tbody>${bands}</tbody>
          </table>
        </div>
      </div>` : ''}

      <div style="margin-top:16px">
        <div class="section-header">Annual Overview</div>
        <div class="metrics">
          <div class="metric-card"><div class="ml">Annual Gross</div><div class="mv">${formatNaira(calc.annualGross || gross * 12)}</div></div>
          <div class="metric-card"><div class="ml">Annual PAYE</div><div class="mv" style="color:#d0314e">${formatNaira(calc.annualPAYE || 0)}</div></div>
          <div class="metric-card"><div class="ml">Monthly PAYE</div><div class="mv" style="color:#d0314e">${formatNaira(calc.monthlyPAYE || line?.paye || 0)}</div></div>
          <div class="metric-card"><div class="ml">Annual Net Pay</div><div class="mv" style="color:#189e5b">${formatNaira(net * 12)}</div></div>
        </div>
      </div>
      ` : `
      <div style="margin-top:16px">
        <div class="section-header">Payment Info</div>
        <div class="card">
          <div class="card-row"><span class="lb">Bank</span><span class="vl">${employee?.bankName || '—'}</span></div>
          <div class="card-row"><span class="lb">Account</span><span class="vl">${employee?.accountNumber || '—'}</span></div>
          <div class="card-row"><span class="lb">Tax ID</span><span class="vl">${employee?.taxId || '—'}</span></div>
          ${employee?.pensionPin ? `<div class="card-row"><span class="lb">Pension PIN</span><span class="vl">${employee.pensionPin}</span></div>` : ''}
          ${employee?.nhfNumber ? `<div class="card-row"><span class="lb">NHF Number</span><span class="vl">${employee.nhfNumber}</span></div>` : ''}
        </div>
      </div>
      `}
    </div>
    <div class="footer">
      ${org?.name || 'SkyBooks'} &bull; Confidential &bull; Computer-generated document
    </div>
  </div>
  </body></html>`;
}

function openPayslipPrint(html: string, title: string) {
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
  else { alert('Popup blocked. Please allow popups for this site and try again.'); }
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
    const html = buildPayslipHtml(line, run, employee, calculation, org);
    openPayslipPrint(html, `Payslip - ${employee?.firstName} ${employee?.lastName}`);
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
                <button onClick={printPayslip} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg">
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