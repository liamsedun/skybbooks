import React, { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Database } from 'lucide-react';
import { fmtNaira, formatVarianceClass } from '../reportUtils';
import { buildPnLRows } from './buildPnLRows';

export function ComparativePnLTable({ current, prior, priorLegacy, priorEmpty, onAccountClick }: { current: any; prior: any | null; priorLegacy?: boolean; priorEmpty?: boolean; onAccountClick?: (acct: any) => void }) {
  const [showLegacyDetail, setShowLegacyDetail] = useState(false);
  if (priorEmpty) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-3">Account</th>
                <th className="text-right px-3 py-3">Current Period</th>
              </tr>
            </thead>
            <tbody>
              {buildPnLRows(current, null).filter((s: any) => {
                if (s.isSummary) return true;
                if (!s.children) return false;
                return s.children.some((c: any) => Math.abs(c.currentBalance) > 0.01);
              }).map((section: any, si: number) => (
                <React.Fragment key={si}>
                  <tr className="bg-slate-100/50">
                    <td colSpan={2} className="px-3 py-2 text-xs font-bold text-slate-700 uppercase tracking-wider">{section.section}</td>
                  </tr>
                  {!section.isSummary && section.children.filter((c: any) => Math.abs(c.currentBalance) > 0.01).map((row: any, ri: number) => (
                    <tr key={ri} className={`border-t border-slate-100 hover:bg-slate-50/50 even:bg-slate-50/50 transition-colors ${row.accountId ? 'cursor-pointer' : ''}`} onClick={() => row.accountId && onAccountClick?.(row)}>
                      <td className="px-3 py-2.5 pl-8 text-slate-800">{row.name}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{fmtNaira(row.currentBalance)}</td>
                    </tr>
                  ))}
                  {section.isSummary && (
                    <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold">
                      <td className="px-3 py-3 text-sm text-slate-900">{section.section}</td>
                      <td className="px-3 py-3 text-right text-slate-900">{fmtNaira(section.summaryCurrent)}</td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          Prior period comparative data is not available for this period.
        </div>
      </div>
    );
  }

  const rows = buildPnLRows(current, prior);

  const legacyLines = priorLegacy && prior ? [
    { label: 'Revenue', value: prior.revenue, note: prior.revenueNote },
    { label: 'Cost of sales', value: prior.costOfSales, note: prior.costOfSalesNote },
    { label: 'Gross profit', value: prior.grossProfit, isComputed: true },
    { label: 'Other gains or losses', value: prior.otherGainsOrLosses, note: prior.otherGainsOrLossesNote },
    { label: 'Impairment on financial assets', value: prior.impairmentOnFinancialAssets, note: prior.impairmentOnFinancialAssetsNote },
    { label: 'Administrative expenses', value: prior.administrativeExpenses, note: prior.administrativeExpensesNote },
    { label: 'Operating profit', value: prior.operatingProfit, isComputed: true },
    { label: 'Finance cost', value: prior.financeCost, note: prior.financeCostNote },
    { label: 'Profit before tax', value: prior.profitBeforeTax, isComputed: true },
    { label: 'Income tax', value: prior.incomeTax, note: prior.incomeTaxNote },
    { label: 'Deferred Tax', value: prior.deferredTax, note: prior.deferredTaxNote },
    { label: 'Profit for the year', value: prior.profitForTheYear, isComputed: true },
    { label: 'OCI — Gain/Loss on valuation of investments', value: prior.ociValuationGainLoss, note: prior.ociValuationNote },
    { label: 'OCI — Grant/other income', value: prior.ociGrantIncome, note: prior.ociGrantNote },
    { label: 'OCI net of taxes', value: prior.ociNetOfTaxes, isComputed: true },
    { label: 'Total comprehensive income', value: prior.totalComprehensiveIncome, isComputed: true },
    { label: 'Earnings per share (kobo)', value: prior.earningsPerShareKobo, note: prior.earningsPerShareNote },
    { label: 'Diluted earnings per share', value: prior.dilutedEarningsPerShare, note: prior.dilutedEpsNote },
  ] : [];

  return (
    <div className="space-y-4">
      {priorLegacy && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 text-sm text-indigo-700 flex items-center gap-2">
          <Database className="w-5 h-5 flex-shrink-0" />
          Prior period sourced from legacy/migration data. Line-item detail below reflects the prior system's presentation format.
        </div>
      )}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="text-left px-3 py-3">Account</th>
              <th className="text-right px-3 py-3">Current Period</th>
              <th className="text-right px-3 py-3">
                Prior Period
                {priorLegacy && <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">Legacy</span>}
              </th>
              <th className="text-right px-3 py-3">Variance (₦)</th>
              <th className="text-right px-3 py-3">Variance (%)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((section: any, si: number) => (
              <React.Fragment key={si}>
                <tr className="bg-slate-100/50">
                  <td colSpan={5} className="px-3 py-2 text-xs font-bold text-slate-700 uppercase tracking-wider">{section.section}</td>
                </tr>
                {!section.isSummary && section.children.map((row: any, ri: number) => {
                  const varPct = row.priorBalance !== 0 ? ((row.variance / row.priorBalance) * 100).toFixed(1) : '—';
                  return (
                    <tr key={ri} className={`border-t border-slate-100 hover:bg-slate-50/50 even:bg-slate-50/50 transition-colors ${row.accountId ? 'cursor-pointer' : ''}`} onClick={() => row.accountId && onAccountClick?.(row)}>
                      <td className="px-3 py-2.5 pl-8 text-slate-800">{row.name}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{fmtNaira(row.currentBalance)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600">{fmtNaira(row.priorBalance)}</td>
                      <td className={`px-3 py-2.5 text-right font-semibold ${formatVarianceClass(row.variance, row.isRevenue)}`}>{fmtNaira(row.variance)}</td>
                      <td className={`px-3 py-2.5 text-right font-semibold ${formatVarianceClass(row.variance, row.isRevenue)}`}>{varPct}{varPct !== '—' ? '%' : ''}</td>
                    </tr>
                  );
                })}
                {!section.isSummary && (
                  <tr className="border-t border-slate-200 bg-slate-50/50 font-medium">
                    <td className="px-3 py-2 pl-8 text-sm text-slate-700">Total {section.section}</td>
                    <td className="px-3 py-2 text-right text-slate-800">{fmtNaira(section.totalCurrent)}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{fmtNaira(section.totalPrior)}</td>
                    <td className={`px-3 py-2 text-right ${formatVarianceClass(section.totalCurrent - section.totalPrior, section.isRevenue)}`}>{fmtNaira(section.totalCurrent - section.totalPrior)}</td>
                    <td className={`px-3 py-2 text-right ${formatVarianceClass(section.totalCurrent - section.totalPrior, section.isRevenue)}`}>
                      {section.totalPrior !== 0 ? `${((section.totalCurrent - section.totalPrior) / section.totalPrior * 100).toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                )}
                {section.isSummary && (
                  <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold">
                    <td className="px-3 py-3 text-sm text-slate-900">{section.section}</td>
                    <td className="px-3 py-3 text-right text-slate-900">{fmtNaira(section.summaryCurrent)}</td>
                    <td className="px-3 py-3 text-right text-slate-700">{fmtNaira(section.summaryPrior)}</td>
                    <td className={`px-3 py-3 text-right ${formatVarianceClass(section.summaryCurrent - section.summaryPrior, section.isRevenue)}`}>{fmtNaira(section.summaryCurrent - section.summaryPrior)}</td>
                    <td className={`px-3 py-3 text-right ${formatVarianceClass(section.summaryCurrent - section.summaryPrior, section.isRevenue)}`}>
                      {section.summaryPrior !== 0 ? `${((section.summaryCurrent - section.summaryPrior) / section.summaryPrior * 100).toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {priorLegacy && legacyLines.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <button onClick={() => setShowLegacyDetail(!showLegacyDetail)} className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors">
            <span className="flex items-center gap-2"><Database className="w-4 h-4" /> Legacy Detail (as entered from prior system)</span>
            {showLegacyDetail ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showLegacyDetail && (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <tr><th className="text-left px-4 py-2">Line Item</th><th className="text-right px-4 py-2">Note</th><th className="text-right px-4 py-2">Amount (NGN)</th></tr>
              </thead>
              <tbody>
                {legacyLines.map((line, i) => (
                  <tr key={i} className={`border-t border-slate-100 ${line.isComputed ? 'bg-slate-50 font-semibold' : ''}`}>
                    <td className="px-4 py-1.5 text-xs text-slate-700">{line.label}</td>
                    <td className="px-4 py-1.5 text-right text-xs text-slate-400">{line.note || '—'}</td>
                    <td className="px-4 py-1.5 text-right text-xs text-slate-800">₦{fmtNaira(line.value || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
