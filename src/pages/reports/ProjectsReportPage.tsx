import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, printWindow } from '../../lib/api';
import { Loader2, ChevronRight, Download } from 'lucide-react';
import { fmtNaira, getDefaultDateRange } from './reportUtils';

export function ProjectsReportPage() {
  return <ProjectsReport />;
}

function ProjectsReport() {
  const { startDate, endDate: defaultEnd } = getDefaultDateRange();
  const [sDate, setSDate] = useState(startDate);
  const [eDate, setEDate] = useState(defaultEnd);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
    staleTime: 60000,
  });

  const { data: summaryData, isLoading, isError, error } = useQuery({
    queryKey: ['project-summary', sDate, eDate],
    queryFn: async () => {
      const res = await api.get('/reports/project-summary', { params: { startDate: sDate, endDate: eDate } });
      return res.data;
    },
  });

  const { data: detailData } = useQuery({
    queryKey: ['project-income-expense', selectedProjectId, sDate, eDate],
    queryFn: async () => {
      if (!selectedProjectId) return null;
      const res = await api.get('/reports/project-income-expense', { params: { projectId: selectedProjectId, startDate: sDate, endDate: eDate } });
      return res.data;
    },
    enabled: !!selectedProjectId,
  });

  const summaryList = Array.isArray(summaryData) ? summaryData : [];
  const selectedProject = (Array.isArray(projects) ? projects : []).find((p: any) => p.id === selectedProjectId);

  function handlePrintPdf() {
    const rows = summaryList.map((p: any) =>
      `<tr><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e2e8f0">${p.name}</td><td style="padding:8px 12px;font-size:12px;font-family:monospace;border-bottom:1px solid #e2e8f0">${p.code || '—'}</td><td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #e2e8f0">${p.status || 'active'}</td><td style="padding:8px 12px;font-size:12px;text-align:right;font-family:monospace;border-bottom:1px solid #e2e8f0">${fmtNaira(p.totalIncome)}</td><td style="padding:8px 12px;font-size:12px;text-align:right;font-family:monospace;border-bottom:1px solid #e2e8f0">${fmtNaira(p.totalExpenses)}</td><td style="padding:8px 12px;font-size:12px;text-align:right;font-family:monospace;font-weight:600;border-bottom:1px solid #e2e8f0">${fmtNaira(p.profit)}</td></tr>`
    ).join('');
    const totalIncome = summaryList.reduce((s: number, p: any) => s + p.totalIncome, 0);
    const totalExpenses = summaryList.reduce((s: number, p: any) => s + p.totalExpenses, 0);
    const totalProfit = summaryList.reduce((s: number, p: any) => s + p.profit, 0);
    const summaryTable = summaryList.length > 0 ? `
      <h3 style="font-size:14px;font-weight:600;color:#0f172a;margin:0 0 8px">${selectedProjectId ? selectedProject?.name || 'Project Detail' : 'Project Summary'}</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <thead><tr style="background:#f1f5f9">
          <th style="padding:8px 12px;font-size:10px;font-weight:600;color:#475569;text-align:left;text-transform:uppercase">Project</th>
          <th style="padding:8px 12px;font-size:10px;font-weight:600;color:#475569;text-align:left;text-transform:uppercase">Code</th>
          <th style="padding:8px 12px;font-size:10px;font-weight:600;color:#475569;text-align:left;text-transform:uppercase">Status</th>
          <th style="padding:8px 12px;font-size:10px;font-weight:600;color:#475569;text-align:right;text-transform:uppercase">Income</th>
          <th style="padding:8px 12px;font-size:10px;font-weight:600;color:#475569;text-align:right;text-transform:uppercase">Expenses</th>
          <th style="padding:8px 12px;font-size:10px;font-weight:600;color:#475569;text-align:right;text-transform:uppercase">Profit / Loss</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr style="background:#f8fafc;font-weight:700">
          <td colspan="3" style="padding:8px 12px;font-size:12px;border-top:2px solid #cbd5e1">TOTAL</td>
          <td style="padding:8px 12px;font-size:12px;text-align:right;font-family:monospace;border-top:2px solid #cbd5e1">${fmtNaira(totalIncome)}</td>
          <td style="padding:8px 12px;font-size:12px;text-align:right;font-family:monospace;border-top:2px solid #cbd5e1">${fmtNaira(totalExpenses)}</td>
          <td style="padding:8px 12px;font-size:12px;text-align:right;font-family:monospace;border-top:2px solid #cbd5e1">${fmtNaira(totalProfit)}</td>
        </tr></tfoot>
      </table>` : '';

    let detailHtml = '';
    if (detailData) {
      const incRows = (detailData.income || []).map((a: any) =>
        `<tr><td style="padding:6px 10px;font-size:11px;border-bottom:1px solid #f1f5f9">${a.code} - ${a.name}</td><td style="padding:6px 10px;font-size:11px;text-align:right;font-family:monospace;border-bottom:1px solid #f1f5f9">${fmtNaira(a.amount)}</td></tr>`
      ).join('');
      const expRows = (detailData.expenses || []).map((a: any) =>
        `<tr><td style="padding:6px 10px;font-size:11px;border-bottom:1px solid #f1f5f9">${a.code} - ${a.name}</td><td style="padding:6px 10px;font-size:11px;text-align:right;font-family:monospace;border-bottom:1px solid #f1f5f9">${fmtNaira(a.amount)}</td></tr>`
      ).join('');
      detailHtml = `
        <h3 style="font-size:14px;font-weight:600;color:#0f172a;margin:16px 0 8px">${selectedProject?.name || 'Project'} Detail</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          <tr><td style="padding:8px 12px;font-size:12px;font-weight:600">Income</td><td style="padding:8px 12px;font-size:12px;text-align:right;font-family:monospace">${fmtNaira(detailData.totalIncome)}</td></tr>
          <tr><td style="padding:8px 12px;font-size:12px;font-weight:600">Expenses</td><td style="padding:8px 12px;font-size:12px;text-align:right;font-family:monospace">${fmtNaira(detailData.totalExpenses)}</td></tr>
          <tr><td style="padding:8px 12px;font-size:12px;font-weight:600">Profit / Loss</td><td style="padding:8px 12px;font-size:12px;text-align:right;font-family:monospace">${fmtNaira(detailData.profit)}</td></tr>
        </table>
        <div style="display:flex;gap:24px">
          <div style="flex:1">
            <h4 style="font-size:12px;font-weight:600;color:#475569;margin:0 0 6px">Income Breakdown</h4>
            <table style="width:100%;border-collapse:collapse">${incRows || '<tr><td style="padding:6px 10px;font-size:11px;color:#94a3b8">No income</td></tr>'}</table>
          </div>
          <div style="flex:1">
            <h4 style="font-size:12px;font-weight:600;color:#475569;margin:0 0 6px">Expense Breakdown</h4>
            <table style="width:100%;border-collapse:collapse">${expRows || '<tr><td style="padding:6px 10px;font-size:11px;color:#94a3b8">No expenses</td></tr>'}</table>
          </div>
        </div>`;
    }

    printWindow('Project Report',
      `<p style="font-size:11px;color:#64748b;margin:0 0 16px">Period: ${new Date(sDate).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})} – ${new Date(eDate).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})} &middot; ${summaryList.length} project${summaryList.length !== 1 ? 's' : ''}</p>
      ${summaryTable}
      ${detailHtml}`,
      `${new Date(sDate).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})} – ${new Date(eDate).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}`
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">

        <button onClick={handlePrintPdf} disabled={summaryList.length === 0 && !detailData}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200 shadow-sm shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed">
          <Download className="w-3.5 h-3.5" /> PDF
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">From:</label>
          <input type="date" value={sDate} onChange={e => setSDate(e.target.value)}
            className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">To:</label>
          <input type="date" value={eDate} onChange={e => setEDate(e.target.value)}
            className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">Project:</label>
          <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)}
            className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow bg-white">
            <option value="">All projects (summary)</option>
            {Array.isArray(projects) && projects.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <span className="text-xs text-slate-400 font-medium whitespace-nowrap">{summaryList.length} project{summaryList.length !== 1 ? 's' : ''}</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
      ) : selectedProjectId && detailData ? (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-1">{selectedProject?.name || 'Project'}</h2>
            <p className="text-xs text-slate-400 mb-4">{selectedProject?.code ? `Code: ${selectedProject.code}` : ''} {selectedProjectId ? `· ID: ${selectedProjectId}` : ''}</p>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200/50">
                <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Income</p>
                <p className="text-xl font-bold text-emerald-700 mt-1">{fmtNaira(detailData.totalIncome)}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4 border border-red-200/50">
                <p className="text-[11px] font-semibold text-red-600 uppercase tracking-wider">Expenses</p>
                <p className="text-xl font-bold text-red-700 mt-1">{fmtNaira(detailData.totalExpenses)}</p>
              </div>
              <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200/50">
                <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider">Profit / Loss</p>
                <p className={`text-xl font-bold mt-1 ${detailData.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmtNaira(detailData.profit)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Income Breakdown</h3>
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider"><th className="px-3 py-2 text-left">Account</th><th className="px-3 py-2 text-right">Amount</th></tr></thead>
                  <tbody>
                    {detailData.income?.length ? detailData.income.map((a: any, i: number) => (
                      <tr key={i} className="border-t border-slate-100"><td className="px-3 py-2 text-slate-700">{a.code} - {a.name}</td><td className="px-3 py-2 text-right font-mono text-slate-900">{fmtNaira(a.amount)}</td></tr>
                    )) : <tr><td colSpan={2} className="px-3 py-4 text-center text-slate-400">No income recorded</td></tr>}
                    {detailData.income?.length > 0 && (
                      <tr className="border-t-2 border-slate-200 font-bold bg-slate-50"><td className="px-3 py-2 text-slate-800">Total Income</td><td className="px-3 py-2 text-right font-mono text-slate-900">{fmtNaira(detailData.totalIncome)}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Expense Breakdown</h3>
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider"><th className="px-3 py-2 text-left">Account</th><th className="px-3 py-2 text-right">Amount</th></tr></thead>
                  <tbody>
                    {detailData.expenses?.length ? detailData.expenses.map((a: any, i: number) => (
                      <tr key={i} className="border-t border-slate-100"><td className="px-3 py-2 text-slate-700">{a.code} - {a.name}</td><td className="px-3 py-2 text-right font-mono text-slate-900">{fmtNaira(a.amount)}</td></tr>
                    )) : <tr><td colSpan={2} className="px-3 py-4 text-center text-slate-400">No expenses recorded</td></tr>}
                    {detailData.expenses?.length > 0 && (
                      <tr className="border-t-2 border-slate-200 font-bold bg-slate-50"><td className="px-3 py-2 text-slate-800">Total Expenses</td><td className="px-3 py-2 text-right font-mono text-slate-900">{fmtNaira(detailData.totalExpenses)}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <button onClick={() => setSelectedProjectId('')}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">← Back to project summary</button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-3 text-left">Project</th>
                <th className="px-3 py-3 text-left">Code</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-right">Income</th>
                <th className="px-3 py-3 text-right">Expenses</th>
                <th className="px-3 py-3 text-right">Profit / Loss</th>
                <th className="px-3 py-3 text-center">Drill-down</th>
              </tr>
            </thead>
            <tbody>
              {summaryList.map((p: any, i: number) => (
                <tr key={p.id} className="hover:bg-slate-50/50 border-t border-slate-100 cursor-pointer" onClick={() => setSelectedProjectId(p.id)}>
                  <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-3 font-mono text-slate-600">{p.code || '—'}</td>
                  <td className="px-4 py-3"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${p.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'}`}>{p.status || 'active'}</span></td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-700">{fmtNaira(p.totalIncome)}</td>
                  <td className="px-4 py-3 text-right font-mono text-red-600">{fmtNaira(p.totalExpenses)}</td>
                  <td className={`px-4 py-3 text-right font-mono font-semibold ${p.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmtNaira(p.profit)}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={(e) => { e.stopPropagation(); setSelectedProjectId(p.id); }} className="text-indigo-600 hover:text-indigo-800 p-1"><ChevronRight className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {summaryList.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">No data for this period.</td></tr>
              )}
            </tbody>
            {summaryList.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td colSpan={3} className="px-4 py-3 text-slate-800">TOTAL</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-600">{fmtNaira(summaryList.reduce((s: number, p: any) => s + p.totalIncome, 0))}</td>
                  <td className="px-4 py-3 text-right font-mono text-red-600">{fmtNaira(summaryList.reduce((s: number, p: any) => s + p.totalExpenses, 0))}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-800">{fmtNaira(summaryList.reduce((s: number, p: any) => s + p.profit, 0))}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
