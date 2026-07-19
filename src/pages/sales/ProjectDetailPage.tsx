import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { api, printWindow } from '../../lib/api';
import { PageLoader } from '../../components/ui/PageLoader';
import { useOrg } from '../../hooks/useOrg';
import { useOrgSettings } from '../../hooks/useOrgSettings';
import { ArrowLeft, Printer, Briefcase } from 'lucide-react';

function fmtNaira(v: number): string {
  return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { organisation: org } = useOrg();
  const { settings } = useOrgSettings();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
    staleTime: 60000,
  });

  const project = (Array.isArray(projects) ? projects : []).find((p: any) => p.id === id);

  const { data: detailData, isLoading } = useQuery({
    queryKey: ['project-income-expense', id, startDate, endDate],
    queryFn: async () => {
      if (!id) return null;
      const params: any = { projectId: id };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await api.get('/reports/project-income-expense', { params });
      return res.data;
    },
    enabled: !!id,
  });

  const handlePrint = () => {
    if (!project || !detailData) return;
    const customFieldDefs: { name: string; dataType: string }[] = settings?.projects?.fields || [];
    const customFields = project.customFields || {};
    const logoHtml = org?.logoUrl
      ? `<img src="${org.logoUrl}" style="height:48px;width:48px;object-fit:contain;border-radius:8px;" />`
      : '';
    const headerHtml = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #0f172a">
      ${logoHtml ? `<div>${logoHtml}</div>` : ''}
      <div style="flex:1">
        <div style="font-size:18px;font-weight:700;color:#0f172a">${org?.name || ''}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px">${[org?.address, org?.phone, org?.email, org?.website].filter(Boolean).join(' | ')}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:16px;font-weight:700;color:#0f172a">${project.name}</div>
        <div style="font-size:10px;color:#64748b;margin-top:2px">${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
      </div>
    </div>`;
    const detailsTable = `
    <table style="margin-bottom:20px">
      <tbody>
        <tr><td style="font-weight:600;width:160px">Code</td><td>${project.code || '—'}</td></tr>
        <tr><td style="font-weight:600">Customer</td><td>${project.customerName || '—'}</td></tr>
        <tr><td style="font-weight:600">Billing Method</td><td>${project.billingMethod || 'Fixed Price'}</td></tr>
        <tr><td style="font-weight:600">Status</td><td>${project.status || 'active'}</td></tr>
        <tr><td style="font-weight:600">Budget</td><td>${fmtNaira(project.budget)}</td></tr>
        ${customFieldDefs.filter((cf: any) => customFields[cf.name] !== undefined && customFields[cf.name] !== '').map((cf: any) =>
          `<tr><td style="font-weight:600">${cf.name}</td><td>${cf.dataType === 'boolean' ? (customFields[cf.name] === 'true' ? 'Yes' : 'No') : customFields[cf.name]}</td></tr>`
        ).join('')}
      </tbody>
    </table>`;
    const pnlHtml = `
    <div style="display:flex;gap:16px;margin-bottom:16px">
      <div style="flex:1;background:#ecfdf5;padding:12px;border-radius:8px;border:1px solid #a7f3d0"><div style="font-size:10px;font-weight:600;color:#047857;text-transform:uppercase">Income</div><div style="font-size:18px;font-weight:700;color:#047857">${fmtNaira(detailData.totalIncome)}</div></div>
      <div style="flex:1;background:#fef2f2;padding:12px;border-radius:8px;border:1px solid #fecaca"><div style="font-size:10px;font-weight:600;color:#b91c1c;text-transform:uppercase">Expenses</div><div style="font-size:18px;font-weight:700;color:#b91c1c">${fmtNaira(detailData.totalExpenses)}</div></div>
      <div style="flex:1;background:#eef2ff;padding:12px;border-radius:8px;border:1px solid #c7d2fe"><div style="font-size:10px;font-weight:600;color:#4338ca;text-transform:uppercase">Profit/Loss</div><div style="font-size:18px;font-weight:700;color:${detailData.profit >= 0 ? '#047857' : '#b91c1c'}">${fmtNaira(detailData.profit)}</div></div>
    </div>
    <div style="display:flex;gap:16px;margin-bottom:16px">
      <div style="flex:1;background:#ecfeff;padding:12px;border-radius:8px;border:1px solid #a5f3fc"><div style="font-size:10px;font-weight:600;color:#0891b2;text-transform:uppercase">Cash Received</div><div style="font-size:18px;font-weight:700;color:#0891b2">${fmtNaira(detailData.cashReceived)}</div></div>
      <div style="flex:1;background:#fff7ed;padding:12px;border-radius:8px;border:1px solid #fed7aa"><div style="font-size:10px;font-weight:600;color:#c2410c;text-transform:uppercase">WHT Deducted (Recoverable)</div><div style="font-size:18px;font-weight:700;color:#c2410c">${fmtNaira(detailData.whtDeducted)}</div></div>
    </div>`;
    const incomeRows = (detailData.income || []).map((a: any) => `<tr><td>${a.code} - ${a.name}</td><td class="r">${fmtNaira(a.amount)}</td></tr>`).join('');
    const expenseRows = (detailData.expenses || []).map((a: any) => `<tr><td>${a.code} - ${a.name}</td><td class="r">${fmtNaira(a.amount)}</td></tr>`).join('');
    const breakdownHtml = `
    <table>
      <thead><tr><th>Income</th><th class="r">Amount</th></tr></thead><tbody>${incomeRows || '<tr><td colspan="2" style="text-align:center;color:#94a3b8">None</td></tr>'}</tbody>
    </table>
    <table style="margin-top:12px">
      <thead><tr><th>Expenses</th><th class="r">Amount</th></tr></thead><tbody>${expenseRows || '<tr><td colspan="2" style="text-align:center;color:#94a3b8">None</td></tr>'}</tbody>
    </table>`;
    printWindow(`Project - ${project.name}`, headerHtml + detailsTable + pnlHtml + breakdownHtml, '');
  };

  if (!id) { navigate('/app/projects'); return null; }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/app/projects')}
            className="text-slate-500 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-indigo-600" /> {project?.name || 'Project'}
          </h1>
        </div>
        <button onClick={handlePrint} disabled={!detailData}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all disabled:opacity-50">
          <Printer className="w-4 h-4" /> Print PDF
        </button>
      </div>

      {project && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 grid grid-cols-4 gap-4 text-sm">
          <div><span className="text-slate-500 font-medium">Code</span><p className="text-slate-900 font-mono mt-0.5">{project.code || '—'}</p></div>
          <div><span className="text-slate-500 font-medium">Customer</span><p className="text-slate-900 mt-0.5">{project.customerName || '—'}</p></div>
          <div><span className="text-slate-500 font-medium">Billing Method</span><p className="text-slate-900 mt-0.5 capitalize">{project.billingMethod || 'Fixed Price'}</p></div>
          <div><span className="text-slate-500 font-medium">Status</span><p className="text-slate-900 mt-0.5 capitalize">{project.status || 'active'}</p></div>
          <div><span className="text-slate-500 font-medium">Start Date</span><p className="text-slate-900 mt-0.5">{fmtDate(project.startDate)}</p></div>
          <div><span className="text-slate-500 font-medium">End Date</span><p className="text-slate-900 mt-0.5">{fmtDate(project.endDate)}</p></div>
          <div><span className="text-slate-500 font-medium">Budget</span><p className="text-slate-900 font-semibold mt-0.5">{fmtNaira(project.budget)}</p></div>
          <div><span className="text-slate-500 font-medium">Description</span><p className="text-slate-900 mt-0.5">{project.description || '—'}</p></div>
        </div>
      )}

      {/* Date filter */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">From:</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">To:</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none" />
        </div>
      </div>

      {isLoading ? (
        <PageLoader message="Loading project P&L..." />
      ) : detailData ? (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div onClick={() => navigate('/app/sales/invoices')}
              className="bg-emerald-50 rounded-xl p-4 border border-emerald-200/50 cursor-pointer hover:bg-emerald-100 hover:shadow-md transition-all">
              <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Income</p>
              <p className="text-xl font-bold text-emerald-700 mt-1">{fmtNaira(detailData.totalIncome)}</p>
            </div>
            <div onClick={() => navigate('/app/purchases/expenses')}
              className="bg-red-50 rounded-xl p-4 border border-red-200/50 cursor-pointer hover:bg-red-100 hover:shadow-md transition-all">
              <p className="text-[11px] font-semibold text-red-600 uppercase tracking-wider">Expenses</p>
              <p className="text-xl font-bold text-red-700 mt-1">{fmtNaira(detailData.totalExpenses)}</p>
            </div>
            <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200/50">
              <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider">Profit / Loss</p>
              <p className={`text-xl font-bold mt-1 ${detailData.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmtNaira(detailData.profit)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div onClick={() => navigate('/app/sales/payments')}
              className="bg-cyan-50 rounded-xl p-4 border border-cyan-200/50 cursor-pointer hover:bg-cyan-100 hover:shadow-md transition-all">
              <p className="text-[11px] font-semibold text-cyan-600 uppercase tracking-wider">Cash Received</p>
              <p className="text-xl font-bold text-cyan-700 mt-1">{fmtNaira(detailData.cashReceived)}</p>
            </div>
            <div onClick={() => navigate('/app/accountant/journals')}
              className="bg-amber-50 rounded-xl p-4 border border-amber-200/50 cursor-pointer hover:bg-amber-100 hover:shadow-md transition-all">
              <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">WHT Deducted (Recoverable)</p>
              <p className="text-xl font-bold text-amber-700 mt-1">{fmtNaira(detailData.whtDeducted)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Income Breakdown</h3>
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider"><th className="px-3 py-2 text-left">Account</th><th className="px-3 py-2 text-right">Amount</th></tr></thead>
                <tbody>
                  {(detailData.income || []).length > 0 ? detailData.income.map((a: any, i: number) => (
                    <tr key={i} onClick={() => navigate('/app/sales/invoices')} className="border-t border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors"><td className="px-3 py-2 text-slate-700">{a.code} - {a.name}</td><td className="px-3 py-2 text-right font-mono text-slate-900">{fmtNaira(a.amount)}</td></tr>
                  )) : <tr><td colSpan={2} className="px-3 py-4 text-center text-slate-400">No income recorded</td></tr>}
                  {(detailData.income || []).length > 0 && (
                    <tr className="border-t-2 border-slate-200 font-bold bg-slate-50"><td className="px-3 py-2 text-slate-800">Total Income</td><td className="px-3 py-2 text-right font-mono text-slate-900">{fmtNaira(detailData.totalIncome)}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Expense Breakdown</h3>
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider"><th className="px-3 py-2 text-left">Account</th><th className="px-3 py-2 text-right">Amount</th></tr></thead>
                <tbody>
                  {(detailData.expenses || []).length > 0 ? detailData.expenses.map((a: any, i: number) => (
                    <tr key={i} onClick={() => navigate('/app/purchases/expenses')} className="border-t border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors"><td className="px-3 py-2 text-slate-700">{a.code} - {a.name}</td><td className="px-3 py-2 text-right font-mono text-slate-900">{fmtNaira(a.amount)}</td></tr>
                  )) : <tr><td colSpan={2} className="px-3 py-4 text-center text-slate-400">No expenses recorded</td></tr>}
                  {(detailData.expenses || []).length > 0 && (
                    <tr className="border-t-2 border-slate-200 font-bold bg-slate-50"><td className="px-3 py-2 text-slate-800">Total Expenses</td><td className="px-3 py-2 text-right font-mono text-slate-900">{fmtNaira(detailData.totalExpenses)}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8 text-center text-slate-400">
          No transactions found for this project.
        </div>
      )}
    </div>
  );
}