import React from 'react';
import { AlertCircle, Database } from 'lucide-react';
import { fmtNaira } from '../reportUtils';

export function ComparativeCashFlowTable({ current, prior, priorLegacy, priorEmpty, onAccountClick }: { current: any; prior: any | null; priorLegacy?: boolean; priorEmpty?: boolean; onAccountClick?: (acct: any) => void }) {
  if (!current) return <div className="p-6 text-center text-slate-400 text-sm">No cash flow data available for comparative view.</div>;
  if (priorEmpty) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr><th className="text-left px-3 py-3">Line Item</th><th className="text-right px-3 py-3">Amount (NGN)</th></tr>
            </thead>
            <tbody>
              <tr><td colSpan={2} className="px-3 py-2 text-xs text-slate-500">Current period data shown only.</td></tr>
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
  const priorData = prior || {};

  const fmtCf = (val: number) => {
    const abs = Math.abs(val / 100);
    const formatted = abs.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return val < 0 ? `(₦${formatted})` : `₦${formatted}`;
  };

  function cfRow(label: string, currAmt: number, priorAmt: number, indent: string = 'pl-8', bold: boolean = false) {
    const variance = currAmt - priorAmt;
    const isNeg = currAmt < 0;
    const priorNeg = priorAmt < 0;
    return (
      <tr key={label} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
        <td className={`px-3 py-2 ${indent} ${bold ? 'font-bold text-slate-900' : 'text-slate-800'}`}>{label}</td>
        <td className={`px-3 py-2 text-right ${bold ? 'font-bold' : 'font-semibold'} ${isNeg ? 'text-red-600' : 'text-slate-800'}`}>{fmtCf(currAmt)}</td>
        <td className={`px-3 py-2 text-right ${priorNeg ? 'text-red-600' : 'text-slate-600'}`}>{fmtCf(priorAmt)}</td>
        <td className={`px-3 py-2 text-right font-semibold ${variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtCf(variance)}</td>
        <td className={`px-3 py-2 text-right font-semibold ${variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{priorAmt !== 0 ? `${(variance / priorAmt * 100).toFixed(1)}%` : '—'}</td>
      </tr>
    );
  }

  function sectionHeader(label: string, bg: string, textColor: string) {
    return <tr className={bg}><td colSpan={5} className={`px-3 py-2 text-xs font-bold ${textColor} uppercase tracking-wider`}>{label}</td></tr>;
  }

  function subSectionHeader(label: string) {
    return <tr className="bg-slate-50/30"><td colSpan={5} className="px-3 py-1.5 pl-10 text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</td></tr>;
  }

  const currOp = current.operatingActivities || {};
  const priorOp = priorData.operatingActivities || {};
  const currInv = current.investingActivities || {};
  const priorInv = priorData.investingActivities || {};
  const currFin = current.financingActivities || {};
  const priorFin = priorData.financingActivities || {};

  const priorAdjMap = new Map((priorOp.adjustments || []).map((a: any) => [a.name, a.amount]));
  const priorWcMap = new Map((priorOp.workingCapitalChanges || []).map((w: any) => [w.name, w.amount]));
  const priorInvMap = new Map((priorInv.items || []).map((iv: any) => [iv.name, iv.amount]));
  const priorFinMap = new Map((priorFin.items || []).map((fn: any) => [fn.name, fn.amount]));

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          <tr>
            <th className="text-left px-3 py-3">Line Item</th>
            <th className="text-right px-3 py-3">Current</th>
            <th className="text-right px-3 py-3">
              Prior
              {priorLegacy && <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">Legacy</span>}
            </th>
            <th className="text-right px-3 py-3">Variance (₦)</th>
            <th className="text-right px-3 py-3">Variance (%)</th>
          </tr>
        </thead>
        <tbody>
          {priorLegacy && (
            <tr className="bg-indigo-50"><td colSpan={5} className="px-3 py-2 text-xs text-indigo-700"><Database className="w-3.5 h-3.5 inline mr-1" /> Prior period sourced from legacy/migration data.</td></tr>
          )}
          {sectionHeader('A. Operating Activities', 'bg-emerald-50', 'text-emerald-800')}
          {cfRow('Net Profit for the Period', current.netIncome || 0, priorData.netIncome || 0)}
          {(currOp.adjustments?.length > 0 || priorOp.adjustments?.length > 0) && subSectionHeader('Adjustments for Non-Cash Items')}
          {(currOp.adjustments || []).map((a: any) => cfRow(a.name, a.amount, (priorAdjMap.get(a.name) || 0) as number, 'pl-14'))}
          {cfRow('Total Adjustments for Non-Cash Items', currOp.adjustmentsTotal || 0, priorOp.adjustmentsTotal || 0, 'pl-10', true)}
          {(currOp.workingCapitalChanges?.length > 0 || priorOp.workingCapitalChanges?.length > 0) && subSectionHeader('Changes in Working Capital')}
          {(currOp.workingCapitalChanges || []).map((w: any) => cfRow(w.name, w.amount, (priorWcMap.get(w.name) || 0) as number, 'pl-14'))}
          {cfRow('Total Changes in Working Capital', currOp.workingCapitalTotal || 0, priorOp.workingCapitalTotal || 0, 'pl-10', true)}
          {cfRow('Cash Generated from Operations', currOp.cashGeneratedFromOperations || 0, priorOp.cashGeneratedFromOperations || 0, 'pl-8', true)}
          {Math.abs(currOp.incomeTaxPaid || 0) > 0.01 && cfRow('Income Tax Paid', currOp.incomeTaxPaid || 0, priorOp.incomeTaxPaid || 0)}
          {Math.abs(currOp.interestPaid || 0) > 0.01 && cfRow('Interest Paid', currOp.interestPaid || 0, priorOp.interestPaid || 0)}
          {Math.abs(currOp.interestReceived || 0) > 0.01 && cfRow('Interest Received', currOp.interestReceived || 0, priorOp.interestReceived || 0)}
          <tr className="border-t-2 border-emerald-200 bg-emerald-50/50 font-bold">
            <td className="px-3 py-2.5 pl-8 text-sm text-slate-900">NET CASH FROM OPERATING ACTIVITIES</td>
            <td className={`px-3 py-2.5 text-right ${(currOp.total || 0) < 0 ? 'text-red-700' : 'text-slate-900'}`}>{fmtCf(currOp.total || 0)}</td>
            <td className="px-3 py-2.5 text-right text-slate-600">{fmtCf(priorOp.total || 0)}</td>
            <td className="px-3 py-2.5 text-right font-semibold">{fmtCf((currOp.total || 0) - (priorOp.total || 0))}</td>
            <td className="px-3 py-2.5 text-right">{(priorOp.total || 0) !== 0 ? `${((((currOp.total || 0) - (priorOp.total || 0)) / (priorOp.total || 0)) * 100).toFixed(1)}%` : '—'}</td>
          </tr>
          {sectionHeader('B. Investing Activities', 'bg-blue-50', 'text-blue-800')}
          {(currInv.items?.length > 0 || priorInv.items?.length > 0) && (currInv.items || []).map((iv: any) => cfRow(iv.name, iv.amount, (priorInvMap.get(iv.name) || 0) as number))}
          {(currInv.items?.length === 0 && priorInv.items?.length === 0) && <tr className="border-t border-slate-100"><td colSpan={5} className="px-3 py-2.5 pl-8 text-slate-400 italic">No investing activity in either period</td></tr>}
          <tr className="border-t-2 border-blue-200 bg-blue-50/50 font-bold">
            <td className="px-3 py-2.5 pl-8 text-sm text-slate-900">NET CASH FROM INVESTING ACTIVITIES</td>
            <td className={`px-3 py-2.5 text-right ${(currInv.total || 0) < 0 ? 'text-red-700' : 'text-slate-900'}`}>{fmtCf(currInv.total || 0)}</td>
            <td className="px-3 py-2.5 text-right text-slate-600">{fmtCf(priorInv.total || 0)}</td>
            <td className="px-3 py-2.5 text-right font-semibold">{fmtCf((currInv.total || 0) - (priorInv.total || 0))}</td>
            <td className="px-3 py-2.5 text-right">{(priorInv.total || 0) !== 0 ? `${((((currInv.total || 0) - (priorInv.total || 0)) / (priorInv.total || 0)) * 100).toFixed(1)}%` : '—'}</td>
          </tr>
          {sectionHeader('C. Financing Activities', 'bg-violet-50', 'text-violet-800')}
          {(currFin.items?.length > 0 || priorFin.items?.length > 0) && (currFin.items || []).map((fn: any) => cfRow(fn.name, fn.amount, (priorFinMap.get(fn.name) || 0) as number))}
          {(currFin.items?.length === 0 && priorFin.items?.length === 0) && <tr className="border-t border-slate-100"><td colSpan={5} className="px-3 py-2.5 pl-8 text-slate-400 italic">No financing activity in either period</td></tr>}
          <tr className="border-t-2 border-violet-200 bg-violet-50/50 font-bold">
            <td className="px-3 py-2.5 pl-8 text-sm text-slate-900">NET CASH FROM FINANCING ACTIVITIES</td>
            <td className={`px-3 py-2.5 text-right ${(currFin.total || 0) < 0 ? 'text-red-700' : 'text-slate-900'}`}>{fmtCf(currFin.total || 0)}</td>
            <td className="px-3 py-2.5 text-right text-slate-600">{fmtCf(priorFin.total || 0)}</td>
            <td className="px-3 py-2.5 text-right font-semibold">{fmtCf((currFin.total || 0) - (priorFin.total || 0))}</td>
            <td className="px-3 py-2.5 text-right">{(priorFin.total || 0) !== 0 ? `${((((currFin.total || 0) - (priorFin.total || 0)) / (priorFin.total || 0)) * 100).toFixed(1)}%` : '—'}</td>
          </tr>
          <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold text-base">
            <td className="px-3 py-3 text-slate-900">NET INCREASE / (DECREASE) IN CASH</td>
            <td className={`px-3 py-3 text-right ${(current.netChangeInCash || 0) < 0 ? 'text-red-700' : 'text-slate-900'}`}>{fmtCf(current.netChangeInCash || 0)}</td>
            <td className="px-3 py-3 text-right text-slate-700">{fmtCf(priorData.netChangeInCash || 0)}</td>
            <td className="px-3 py-3 text-right text-slate-900">{fmtCf((current.netChangeInCash || 0) - (priorData.netChangeInCash || 0))}</td>
            <td className="px-3 py-3 text-right text-slate-900">{(priorData.netChangeInCash || 0) !== 0 ? `${((((current.netChangeInCash || 0) - (priorData.netChangeInCash || 0)) / (priorData.netChangeInCash || 0)) * 100).toFixed(1)}%` : '—'}</td>
          </tr>
          <tr className="border-t border-slate-200">
            <td className="px-3 py-2.5 pl-8 text-slate-600">Opening Cash &amp; Cash Equivalents</td>
            <td className="px-3 py-2.5 text-right text-slate-600">{fmtNaira(current.openingCash)}</td>
            <td className="px-3 py-2.5 text-right text-slate-600">{fmtNaira(priorData.openingCash)}</td>
            <td className="px-3 py-2.5 text-right font-semibold">{fmtNaira((current.openingCash || 0) - (priorData.openingCash || 0))}</td>
            <td className="px-3 py-2.5 text-right">{(priorData.openingCash || 0) !== 0 ? `${((((current.openingCash || 0) - (priorData.openingCash || 0)) / (priorData.openingCash || 0)) * 100).toFixed(1)}%` : '—'}</td>
          </tr>
          <tr className="border-t border-slate-200">
            <td className="px-3 py-2.5 pl-8 text-slate-600">Closing Cash &amp; Cash Equivalents</td>
            <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{fmtNaira(current.closingCash)}</td>
            <td className="px-3 py-2.5 text-right text-slate-600">{fmtNaira(priorData.closingCash)}</td>
            <td className="px-3 py-2.5 text-right font-semibold">{fmtNaira((current.closingCash || 0) - (priorData.closingCash || 0))}</td>
            <td className="px-3 py-2.5 text-right">{(priorData.closingCash || 0) !== 0 ? `${((((current.closingCash || 0) - (priorData.closingCash || 0)) / (priorData.closingCash || 0)) * 100).toFixed(1)}%` : '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
