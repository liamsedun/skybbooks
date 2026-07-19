import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmtNaira, ReportType } from '../reportUtils';
import { SinglePeriodPnLTable } from './SinglePeriodPnLTable';
import { ComparativePnLTable } from './ComparativePnLTable';
import { ComparativeBalanceSheetTable } from './ComparativeBalanceSheetTable';
import { SinglePeriodBalanceSheetTable } from './SinglePeriodBalanceSheetTable';
import { ComparativeCashFlowTable } from './ComparativeCashFlowTable';
import { AlertCircle, X } from 'lucide-react';

export function ReportTable({ data, reportType, compareEnabled, onAccountClick, showZero, showCodes, isShowZero, isShowCodes, cfShowZero, cfShowCodes, asOfDate }: { data: any; reportType: ReportType; compareEnabled?: boolean; onAccountClick?: (acct: any) => void; showZero?: boolean; showCodes?: boolean; isShowZero?: boolean; isShowCodes?: boolean; cfShowZero?: boolean; cfShowCodes?: boolean; asOfDate?: string }) {
  const navigate = useNavigate();
  if (!data) return null;

  if (compareEnabled && data?.current) {
    if (reportType === 'income-statement') {
      return <ComparativePnLTable current={data.current} prior={data.prior} priorLegacy={data.priorLegacy} priorEmpty={data.priorEmpty} onAccountClick={onAccountClick} />;
    }
    if (reportType === 'balance-sheet') {
      return <ComparativeBalanceSheetTable current={data.current} prior={data.prior} onAccountClick={onAccountClick} />;
    }
    if (reportType === 'cash-flow') {
      return <ComparativeCashFlowTable current={data.current} prior={data.prior} priorLegacy={data.priorLegacy} priorEmpty={data.priorEmpty} onAccountClick={onAccountClick} />;
    }
  }

  if (reportType === 'aged-receivables' || reportType === 'aged-payables') {
    const [activeBucket, setActiveBucket] = useState<string | null>(null);
    const [drillEntity, setDrillEntity] = useState<string | null>(null);
    const title = reportType === 'aged-receivables' ? 'Customer' : 'Vendor';
    const entityLabel = reportType === 'aged-receivables' ? 'customer' : 'vendor';
    const isReceivables = reportType === 'aged-receivables';
    const allRows: any[] = data?.rows || (Array.isArray(data) ? data : []);
    const invoices: any[] = data?.invoices || [];
    const bills: any[] = data?.bills || [];

    const bucketKey: Record<string, string> = { current: 'current', days1to30: 'days1to30', days31to60: 'days31to60', days61to90: 'days61to90', days90Plus: 'days90Plus', total: 'total' };
    const bucketLabel: Record<string, string> = { current: 'Current', days1to30: '1-30 Days', days31to60: '31-60 Days', days61to90: '61-90 Days', days90Plus: '90+ Days', total: 'Total' };
    const bucketColor: Record<string, { head: string; activeHead: string; cell: string }> = {
      current: { head: 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md shadow-emerald-200 hover:shadow-lg hover:shadow-emerald-300 hover:-translate-y-0.5', activeHead: 'bg-gradient-to-br from-emerald-600 to-emerald-800 text-white ring-2 ring-emerald-300 shadow-lg shadow-emerald-400 -translate-y-0.5', cell: 'bg-emerald-50' },
      days1to30: { head: 'bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-md shadow-blue-200 hover:shadow-lg hover:shadow-blue-300 hover:-translate-y-0.5', activeHead: 'bg-gradient-to-br from-blue-600 to-blue-800 text-white ring-2 ring-blue-300 shadow-lg shadow-blue-400 -translate-y-0.5', cell: 'bg-blue-50' },
      days31to60: { head: 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-md shadow-amber-200 hover:shadow-lg hover:shadow-amber-300 hover:-translate-y-0.5', activeHead: 'bg-gradient-to-br from-amber-600 to-amber-800 text-white ring-2 ring-amber-300 shadow-lg shadow-amber-400 -translate-y-0.5', cell: 'bg-amber-50' },
      days61to90: { head: 'bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-md shadow-orange-200 hover:shadow-lg hover:shadow-orange-300 hover:-translate-y-0.5', activeHead: 'bg-gradient-to-br from-orange-600 to-orange-800 text-white ring-2 ring-orange-300 shadow-lg shadow-orange-400 -translate-y-0.5', cell: 'bg-orange-50' },
      days90Plus: { head: 'bg-gradient-to-br from-red-400 to-red-600 text-white shadow-md shadow-red-200 hover:shadow-lg hover:shadow-red-300 hover:-translate-y-0.5', activeHead: 'bg-gradient-to-br from-red-600 to-red-800 text-white ring-2 ring-red-300 shadow-lg shadow-red-400 -translate-y-0.5', cell: 'bg-red-50' },
      total: { head: 'bg-gradient-to-br from-violet-400 to-violet-600 text-white shadow-md shadow-violet-200 hover:shadow-lg hover:shadow-violet-300 hover:-translate-y-0.5', activeHead: 'bg-gradient-to-br from-violet-600 to-violet-800 text-white ring-2 ring-violet-300 shadow-lg shadow-violet-400 -translate-y-0.5', cell: 'bg-violet-50' },
    };
    const bucketIcon: Record<string, string> = {
      current: '●',
      days1to30: '●',
      days31to60: '●',
      days61to90: '●',
      days90Plus: '●',
      total: '◆',
    };

    const filteredRows = activeBucket
      ? allRows.filter(r => (r[activeBucket] || 0) > 0)
      : allRows;

    function isBucketActive(b: string): boolean { return activeBucket === b; }
    function toggleBucket(b: string): void { setActiveBucket(isBucketActive(b) ? null : b); }

    const bucketHeaders = ['current', 'days1to30', 'days31to60', 'days61to90', 'days90Plus', 'total'];

    const drillItems = drillEntity
      ? isReceivables
        ? invoices.filter((inv: any) => inv.customerName === drillEntity)
        : bills.filter((bl: any) => bl.vendorName === drillEntity)
      : [];

    function fmtNairaDrill(v: number): string {
      return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
    }

    return (
      <div>
        {activeBucket && (
          <div className="mb-4 flex items-center gap-3">
            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs shadow-sm ${activeBucket ? bucketColor[activeBucket].head : 'bg-indigo-100 text-indigo-700'}`}>
              <span>{bucketIcon[activeBucket]}</span>
              <span>Filtered: <strong>{bucketLabel[activeBucket]}</strong></span>
              <span className="opacity-75">—</span>
              <span>{filteredRows.length} {entityLabel}{filteredRows.length !== 1 ? 's' : ''}</span>
            </span>
            <button onClick={() => setActiveBucket(null)} className="text-xs font-medium text-slate-400 hover:text-red-600 transition-colors hover:underline flex items-center gap-1">
              <X className="w-3 h-3" /> Clear
            </button>
          </div>
        )}

        {drillEntity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDrillEntity(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-slate-200">
                <h3 className="text-lg font-bold text-slate-900">{drillEntity} — {isReceivables ? 'Invoices' : 'Bills'}</h3>
                <button onClick={() => setDrillEntity(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
              </div>
              {drillItems.length === 0 ? (
                <div className="p-8 text-center text-slate-400">No individual {isReceivables ? 'invoices' : 'bills'} found.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-3">{isReceivables ? 'Invoice' : 'Bill'} #</th>
                      <th className="text-left px-4 py-3">Due Date</th>
                      <th className="text-right px-4 py-3">Balance Due</th>
                      <th className="text-right px-4 py-3">Overdue</th>
                      <th className="text-right px-4 py-3">Bucket</th>
                      <th className="text-right px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {drillItems.map((item: any, i: number) => (
                      <tr key={item.id || i} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-blue-600">
                          <button onClick={() => navigate(isReceivables ? `/sales/invoices/${item.id}` : `/purchases/bills/${item.id}`)} className="hover:underline">
                            {item.invoiceNumber || item.billNumber || '—'}
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{new Date(item.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-800">{fmtNairaDrill(item.balanceDue)}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{item.overdueDays || 0}d</td>
                        <td className="px-4 py-2.5 text-right"><span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{item.bucket}</span></td>
                        <td className="px-4 py-2.5 text-right">
                          <button onClick={() => navigate(isReceivables ? `/sales/invoices/${item.id}` : `/purchases/bills/${item.id}`)} className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium">
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold text-sm">
                      <td colSpan={2} className="px-4 py-3 text-slate-800">Total</td>
                      <td className="px-4 py-3 text-right text-slate-800">{fmtNairaDrill(drillItems.reduce((s: number, item: any) => s + (item.balanceDue || 0), 0))}</td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-4 flex-wrap">
          {bucketHeaders.map(b => {
            const total = allRows.reduce((s: number, r: any) => s + (r[b] || 0), 0);
            const count = allRows.filter(r => (r[b] || 0) > 0).length;
            return (
              <button key={b} onClick={() => toggleBucket(b)}
                className={`flex-1 min-w-[100px] px-4 py-3 rounded-xl cursor-pointer select-none transition-all duration-200 font-bold text-sm ${isBucketActive(b) ? bucketColor[b].activeHead : bucketColor[b].head}`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] opacity-75">{bucketIcon[b]}</span>
                  <span className="text-[10px] uppercase tracking-wider opacity-90">{bucketLabel[b]}</span>
                </div>
                <div className="text-sm font-bold">{fmtNaira(total)}</div>
                <div className="text-[10px] mt-0.5 opacity-75">{count} {entityLabel}{count !== 1 ? 's' : ''}</div>
              </button>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-3">{title}</th>
                {bucketHeaders.map(b => (
                  <th key={b} className="text-right px-3 py-3">{bucketLabel[b]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row: any, i: number) => (
                <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/50 even:bg-slate-50/50 transition-colors">
                  <td className="px-3 py-3 font-medium text-blue-600 cursor-pointer hover:text-blue-800 hover:underline" onClick={() => setDrillEntity(row.name)}>
                    {row.name || `Item ${i + 1}`}
                  </td>
                  {bucketHeaders.map(b => (
                    <td key={b} className={`px-3 py-3 text-right ${isBucketActive(b) ? bucketColor[b].cell + ' font-semibold' : 'text-slate-600'} ${b === 'total' ? 'font-semibold' : ''}`}>
                      {fmtNaira(row[b] || 0)}
                    </td>
                  ))}
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">No data available.</td></tr>
              )}
            </tbody>
            {filteredRows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold text-sm">
                <td className="px-3 py-3 text-slate-800">TOTAL</td>
                {bucketHeaders.map(b => (
                  <td key={b} className={`px-3 py-3 text-right ${isBucketActive(b) ? bucketColor[b].head : 'text-slate-800'}`}>
                    {fmtNaira(filteredRows.reduce((s: number, r: any) => s + (r[b] || 0), 0))}
                  </td>
                ))}
              </tr>
            </tfoot>
            )}
          </table>
        </div>
      </div>
    );
  }

  if (reportType === 'statement-of-changes-in-equity') {
    const socie = data?.data || data || {};
    const cy = socie.currentYear;
    const py = socie.priorYear;
    if (!cy) return <div className="text-center py-12 text-slate-400">No equity data available.</div>;

    const colKeys = cy.columns.map((c: any) => c.key);
    const colLabels = cy.columns.map((c: any) => c.label);
    const rowTotal = (row: any) => colKeys.reduce((t: number, k: string) => t + (row.columns[k] || 0), 0);
    const fmt = (v: number) => `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    function renderRows(rows: any[]) {
      return rows.map((r: any, i: number) => (
        <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
          <td className="px-4 py-3 text-sm font-medium text-slate-800">{r.label}</td>
          {colKeys.map((k: string) => (
            <td key={k} className="px-4 py-3 text-right font-mono text-sm text-slate-700">{fmt(r.columns[k] || 0)}</td>
          ))}
          <td className="px-4 py-3 text-right font-mono text-sm font-bold text-slate-900">{fmt(rowTotal(r))}</td>
        </tr>
      ));
    }

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3" />
                {colLabels.map((l: string) => <th key={l} className="text-right px-4 py-3">{l}</th>)}
                <th className="text-right px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {renderRows(cy.rows)}
            </tbody>
          </table>
        </div>

        {py && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
            <div className="px-4 py-2 bg-amber-50 text-amber-800 text-xs font-bold uppercase tracking-wider border-b border-amber-200/60">Prior Year — {py.yearLabel}</div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3" />
                  {colLabels.map((l: string) => <th key={l} className="text-right px-4 py-3">{l}</th>)}
                  <th className="text-right px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {renderRows(py.rows || [])}
              </tbody>
            </table>
          </div>
        )}

        <div className="text-xs text-slate-400 flex items-center gap-4 px-1">
          <span>Opening Equity: {fmt(socie.crossCheck?.openingEquity || 0)}</span>
          <span>Profit: {fmt(socie.crossCheck?.profitForYear || 0)}</span>
          <span>Other Movements: {fmt(socie.crossCheck?.otherMovements || 0)}</span>
          <span>Closing Equity: {fmt(socie.crossCheck?.closingEquity || 0)}</span>
          {socie.crossCheck?.reconciled === false && <span className="text-amber-600 font-semibold">Variance: {fmt(socie.crossCheck?.variance || 0)}</span>}
        </div>
      </div>
    );
  }

  if (reportType === 'balance-sheet') {
    const bsData = data?.data || data;
    return <SinglePeriodBalanceSheetTable data={bsData} onAccountClick={onAccountClick} showZero={showZero} showCodes={showCodes} />;
  }

  if (reportType === 'income-statement') {
    const stmt = data?.data || data;
    const current = stmt?.current || stmt;
    return <SinglePeriodPnLTable current={current} onAccountClick={onAccountClick} showZero={isShowZero} showCodes={isShowCodes} />;
  }

  if (reportType === 'cash-flow') {
    const cf = data?.data || data || {};
    const operatingLineItems = cf.operatingLineItems || [];
    const investing = cf.investingActivities || {};
    const financing = cf.financingActivities || {};
    const investingItems = investing.items || [];
    const financingItems = financing.items || [];
    const cb = cf.cashBreakdown || {};
    const migrationWarning = cf.migrationWarning;

    function fmtCf(val: number): string {
      const abs = Math.abs(val / 100);
      const formatted = abs.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return val < 0 ? `(₦${formatted})` : `₦${formatted}`;
    }
    function shouldShow(val: number): boolean {
      return cfShowZero || Math.abs(val) > 0.01;
    }
    function cfRow(label: string, amount: number, indent: string = 'pl-8', bold: boolean = false, autoLabel?: string) {
      if (!shouldShow(amount) && !bold && !autoLabel) return null;
      const isNeg = amount < 0;
      const displayLabel = autoLabel ? `${label}(auto)` : label;
      return (
        <tr key={label} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
          <td className={`px-3 py-2.5 ${indent} ${bold ? 'font-bold text-slate-900' : 'text-slate-800'}`}>{displayLabel}</td>
          <td className={`px-3 py-2.5 text-right ${bold ? 'font-bold' : 'font-semibold'} ${isNeg ? 'text-red-600' : 'text-slate-800'}`}>{fmtCf(amount)}</td>
        </tr>
      );
    }
    function sectionHeader(label: string, bg: string, textColor: string) {
      return <tr className={bg}><td colSpan={2} className={`px-3 py-2 text-xs font-bold ${textColor} uppercase tracking-wider`}>{label}</td></tr>;
    }

    const invTotal = investing.total || 0;
    const finTotal = financing.total || 0;
    const netChange = cf.netChangeInCash || 0;
    const opTotal = cf.operatingActivities?.total || 0;

    return (
      <div className="space-y-4">
        {migrationWarning && (
          <div className="bg-amber-50 border border-amber-200/80 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-500" />
            <span>{migrationWarning}</span>
          </div>
        )}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-3">Line Item</th>
                <th className="text-right px-3 py-3">Amount (NGN)</th>
              </tr>
            </thead>
            <tbody>
              {sectionHeader('Operating Activities', 'bg-emerald-50', 'text-emerald-800')}
              {operatingLineItems.map((item: any, i: number) => {
                const isAuto = item.auto === true;
                const isSubTotal = item.name.startsWith('Net Cash') || item.name.startsWith('Cash generated');
                return cfRow(item.name, item.amount, 'pl-8', isSubTotal, isAuto ? '' : undefined);
              })}
              <tr className="border-t-2 border-emerald-200 bg-emerald-50/50 font-bold">
                <td className="px-3 py-2.5 pl-8 text-sm text-slate-900">NET CASH FROM OPERATING ACTIVITIES</td>
                <td className={`px-3 py-2.5 text-right ${opTotal < 0 ? 'text-red-700' : 'text-slate-900'}`}>{fmtCf(opTotal)}</td>
              </tr>

              {sectionHeader('Investing Activities', 'bg-blue-50', 'text-blue-800')}
              {investingItems.length === 0 && (
                <tr className="border-t border-slate-100"><td colSpan={2} className="px-3 py-2.5 pl-8 text-slate-400 italic">No investing activity</td></tr>
              )}
              {investingItems.map((iv: any, i: number) => cfRow(iv.name, iv.amount, 'pl-8'))}
              <tr className="border-t-2 border-blue-200 bg-blue-50/50 font-bold">
                <td className="px-3 py-2.5 pl-8 text-sm text-slate-900">Net Cash generated (used in) by investing activities</td>
                <td className={`px-3 py-2.5 text-right ${invTotal < 0 ? 'text-red-700' : 'text-slate-900'}`}>{fmtCf(invTotal)}</td>
              </tr>

              {sectionHeader('Financing Activities', 'bg-violet-50', 'text-violet-800')}
              {financingItems.length === 0 && (
                <tr className="border-t border-slate-100"><td colSpan={2} className="px-3 py-2.5 pl-8 text-slate-400 italic">No financing activity</td></tr>
              )}
              {financingItems.map((fn: any, i: number) => cfRow(fn.name, fn.amount, 'pl-8'))}
              <tr className="border-t-2 border-violet-200 bg-violet-50/50 font-bold">
                <td className="px-3 py-2.5 pl-8 text-sm text-slate-900">Net Cash generated by (used in) Financing Activities</td>
                <td className={`px-3 py-2.5 text-right ${finTotal < 0 ? 'text-red-700' : 'text-slate-900'}`}>{fmtCf(finTotal)}</td>
              </tr>

              {sectionHeader('Summary', 'bg-slate-100', 'text-slate-700')}
              <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold text-base">
                <td className="px-3 py-3 text-slate-900">Net increase in cash and cash equivalents</td>
                <td className={`px-3 py-3 text-right ${netChange < 0 ? 'text-red-700' : 'text-slate-900'}`}>{fmtCf(netChange)}</td>
              </tr>
              <tr className="border-t border-slate-200">
                <td className="px-3 py-2.5 pl-8 text-slate-600">Cash and cash equivalents at the beginning of the year</td>
                <td className="px-3 py-2.5 text-right text-slate-600">{fmtCf(cf.openingCash)}</td>
              </tr>
              <tr className="border-t border-slate-200">
                <td className="px-3 py-2.5 pl-8 text-slate-600">Cash and cash equivalents at the end of the year</td>
                <td className="px-3 py-2.5 text-right font-bold text-slate-800">{fmtCf(cf.closingCash)}</td>
              </tr>

              {sectionHeader('Cash & Cash Equivalents Breakdown', 'bg-amber-50', 'text-amber-800')}
              <tr className="border-t border-slate-200">
                <td className="px-3 py-2.5 pl-8 text-slate-600">Cash & Bank balance</td>
                <td className="px-3 py-2.5 text-right text-slate-800">{fmtCf(cb.cashAndBankBalance || 0)}</td>
              </tr>
              <tr className="border-t border-slate-200">
                <td className="px-3 py-2.5 pl-8 text-slate-600">Term Deposit</td>
                <td className="px-3 py-2.5 text-right text-slate-800">{fmtCf(cb.termDeposit || 0)}</td>
              </tr>
              <tr className="border-t border-slate-200">
                <td className="px-3 py-2.5 pl-8 text-slate-600">Term Loan (deduction)</td>
                <td className="px-3 py-2.5 text-right text-red-600">{fmtCf(cb.termLoan || 0)}</td>
              </tr>
              <tr className="border-t border-slate-200 bg-slate-50/50">
                <td className="px-3 py-2.5 pl-8 font-bold text-slate-900">Reconciliation to closing cash{Math.abs(cb.reconciliationDiff || 0) > 1 ? `(off by ${fmtCf(cb.reconciliationDiff)})` : ''}</td>
                <td className="px-3 py-2.5 text-right font-bold text-slate-900">{fmtCf(cb.breakdownTotal || 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          <tr>
            <th className="text-left px-3 py-3">Account Code</th>
            <th className="text-left px-3 py-3">Account Name</th>
            <th className="text-right px-3 py-3">Type</th>
            <th className="text-right px-3 py-3">Debit</th>
            <th className="text-right px-3 py-3">Credit</th>
          </tr>
        </thead>
        <tbody>
          {(Array.isArray(data) ? data : []).map((row: any, i: number) => (
            <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/50 even:bg-slate-50/50 transition-colors">
              <td className="px-3 py-3 text-slate-600 font-mono">{row.code || row.accountCode || '—'}</td>
              <td className="px-3 py-3 font-medium text-slate-800">{row.name || row.accountName || `Account ${i + 1}`}</td>
              <td className="px-3 py-3 text-right text-slate-500 capitalize">{row.type || row.accountType || '—'}</td>
              <td className="px-3 py-3 text-right text-slate-600">{fmtNaira(row.debit || row.debitAmount || 0)}</td>
              <td className="px-3 py-3 text-right text-slate-600">{fmtNaira(row.credit || row.creditAmount || 0)}</td>
            </tr>
          ))}
          {(!Array.isArray(data) || data.length === 0) && (
            <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">No data available.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
