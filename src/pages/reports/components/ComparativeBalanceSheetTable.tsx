import React from 'react';
import { fmtNaira } from '../reportUtils';

export function ComparativeBalanceSheetTable({ current, prior, onAccountClick }: { current: any; prior: any | null; onAccountClick?: (acct: any) => void }) {
  if (!current) return <div className="p-6 text-center text-slate-400 text-sm">No balance sheet data available for comparative view.</div>;

  const priorData = prior || {};

  function renderItems(items: any[], priorItems: any[], indent: string = 'pl-8') {
    const priorMap = new Map((priorItems || []).map((a: any) => [a.code || a.accountId || a.name, a.balance]));
    return (items || []).filter((i: any) => Math.abs(i.balance) > 0.01 || Math.abs(priorMap.get(i.code || i.accountId || i.name) || 0) > 0.01).map((item: any, idx: number) => {
      const priorBal = priorMap.get(item.code || item.accountId || item.name) || 0;
      const variance = item.balance - priorBal;
      return (
        <tr key={`${item.accountId || item.code || idx}`} className={`border-t border-slate-100 hover:bg-slate-50/50 even:bg-slate-50/50 transition-colors ${item.accountId ? 'cursor-pointer' : ''}`}
          onClick={() => item.accountId && onAccountClick?.(item)}>
          <td className={`px-3 py-2 ${indent} text-slate-800`}>{item.name}</td>
          <td className="px-3 py-2 text-right font-semibold text-slate-800">{fmtNaira(item.balance)}</td>
          <td className="px-3 py-2 text-right text-slate-600">{fmtNaira(priorBal)}</td>
          <td className={`px-3 py-2 text-right font-semibold ${variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtNaira(variance)}</td>
          <td className={`px-3 py-2 text-right font-semibold ${variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{priorBal !== 0 ? `${(variance / priorBal * 100).toFixed(1)}%` : '—'}</td>
        </tr>
      );
    });
  }

  function renderSubSection(sec: any, priorSec: any, indent: string = 'pl-10', subIndent: string = 'pl-12') {
    const priorItems = (priorSec?.items || []);
    return (
      <>
        <tr className="bg-slate-50/30">
          <td colSpan={5} className={`px-3 py-1.5 ${indent} text-xs font-semibold text-slate-500 uppercase tracking-wider`}>{sec.label}</td>
        </tr>
        {renderItems(sec.items, priorItems, subIndent)}
        <tr className="border-t border-slate-200 bg-slate-50/30 font-medium">
          <td className={`px-3 py-1.5 ${indent} text-xs text-slate-500`}>Total {sec.label}</td>
          <td className="px-3 py-1.5 text-right text-slate-700">{fmtNaira(sec.total || 0)}</td>
          <td className="px-3 py-1.5 text-right text-slate-500">{fmtNaira(priorSec?.total || 0)}</td>
          <td className="px-3 py-1.5 text-right font-semibold">{(sec.total || 0) - (priorSec?.total || 0) >= 0 ? fmtNaira((sec.total || 0) - (priorSec?.total || 0)) : fmtNaira((sec.total || 0) - (priorSec?.total || 0))}</td>
          <td className="px-3 py-1.5 text-right">{(priorSec?.total || 0) !== 0 ? `${((((sec.total || 0) - (priorSec?.total || 0)) / (priorSec?.total || 0)) * 100).toFixed(1)}%` : '—'}</td>
        </tr>
      </>
    );
  }

  function calcSectionTotals(data: any): { caTotal: number; ncaTotal: number; clTotal: number; nclTotal: number } {
    const ca = data?.currentAssets || {};
    const nca = data?.nonCurrentAssets || {};
    const cl = data?.currentLiabilities || {};
    const ncl = data?.nonCurrentLiabilities || {};
    return {
      caTotal: ca.total || 0,
      ncaTotal: nca.total || 0,
      clTotal: cl.total || 0,
      nclTotal: ncl.total || 0,
    };
  }

  const currTotals = calcSectionTotals(current);
  const priorTotals = calcSectionTotals(priorData);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          <tr>
            <th className="text-left px-3 py-3">Account</th>
            <th className="text-right px-3 py-3">Current</th>
            <th className="text-right px-3 py-3">Prior</th>
            <th className="text-right px-3 py-3">Variance (₦)</th>
            <th className="text-right px-3 py-3">Variance (%)</th>
          </tr>
        </thead>
        <tbody>
          <tr className="bg-blue-50"><td colSpan={5} className="px-3 py-2.5 text-xs font-bold text-blue-800 uppercase tracking-wider">Assets</td></tr>
          <tr className="bg-blue-50/50"><td colSpan={5} className="px-3 py-1.5 pl-6 text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Current Assets</td></tr>
          {(current?.currentAssets?.subSections || []).map((sec: any) => {
            const priorSec = (priorData?.currentAssets?.subSections || []).find((s: any) => s.key === sec.key);
            return renderSubSection(sec, priorSec);
          })}
          <tr className="border-t-2 border-blue-200 bg-blue-50/70 font-bold">
            <td className="px-3 py-2 pl-6 text-sm text-slate-800">Total Current Assets</td>
            <td className="px-3 py-2 text-right text-slate-800">{fmtNaira(currTotals.caTotal)}</td>
            <td className="px-3 py-2 text-right text-slate-600">{fmtNaira(priorTotals.caTotal)}</td>
            <td className="px-3 py-2 text-right">{fmtNaira(currTotals.caTotal - priorTotals.caTotal)}</td>
            <td className="px-3 py-2 text-right">{priorTotals.caTotal !== 0 ? `${(((currTotals.caTotal - priorTotals.caTotal) / priorTotals.caTotal) * 100).toFixed(1)}%` : '—'}</td>
          </tr>
          <tr className="bg-blue-50/50"><td colSpan={5} className="px-3 py-1.5 pl-6 text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Non-Current Assets</td></tr>
          {(current?.nonCurrentAssets?.subSections || []).map((sec: any) => {
            const priorSec = (priorData?.nonCurrentAssets?.subSections || []).find((s: any) => s.key === sec.key);
            return renderSubSection(sec, priorSec);
          })}
          <tr className="border-t-2 border-blue-200 bg-blue-50/70 font-bold">
            <td className="px-3 py-2 pl-6 text-sm text-slate-800">Total Non-Current Assets</td>
            <td className="px-3 py-2 text-right text-slate-800">{fmtNaira(currTotals.ncaTotal)}</td>
            <td className="px-3 py-2 text-right text-slate-600">{fmtNaira(priorTotals.ncaTotal)}</td>
            <td className="px-3 py-2 text-right">{fmtNaira(currTotals.ncaTotal - priorTotals.ncaTotal)}</td>
            <td className="px-3 py-2 text-right">{priorTotals.ncaTotal !== 0 ? `${(((currTotals.ncaTotal - priorTotals.ncaTotal) / priorTotals.ncaTotal) * 100).toFixed(1)}%` : '—'}</td>
          </tr>
          <tr className="border-t-2 border-blue-300 bg-blue-100 font-bold text-base">
            <td className="px-3 py-3 text-slate-900">TOTAL ASSETS</td>
            <td className="px-3 py-3 text-right text-slate-900">{fmtNaira(current?.totalAssets || 0)}</td>
            <td className="px-3 py-3 text-right text-slate-700">{fmtNaira(priorData?.totalAssets || 0)}</td>
            <td className="px-3 py-3 text-right text-slate-900">{fmtNaira((current?.totalAssets || 0) - (priorData?.totalAssets || 0))}</td>
            <td className="px-3 py-3 text-right text-slate-900">{(priorData?.totalAssets || 0) !== 0 ? `${((((current?.totalAssets || 0) - (priorData?.totalAssets || 0)) / (priorData?.totalAssets || 0)) * 100).toFixed(1)}%` : '—'}</td>
          </tr>

          <tr className="bg-amber-50"><td colSpan={5} className="px-3 py-2.5 text-xs font-bold text-amber-800 uppercase tracking-wider">Liabilities</td></tr>
          <tr className="bg-amber-50/50"><td colSpan={5} className="px-3 py-1.5 pl-6 text-[10px] font-semibold text-amber-600 uppercase tracking-wider">Current Liabilities</td></tr>
          {(current?.currentLiabilities?.subSections || []).map((sec: any) => {
            const priorSec = (priorData?.currentLiabilities?.subSections || []).find((s: any) => s.key === sec.key);
            return renderSubSection(sec, priorSec);
          })}
          <tr className="border-t-2 border-amber-200 bg-amber-50/70 font-bold">
            <td className="px-3 py-2 pl-6 text-sm text-slate-800">Total Current Liabilities</td>
            <td className="px-3 py-2 text-right text-slate-800">{fmtNaira(currTotals.clTotal)}</td>
            <td className="px-3 py-2 text-right text-slate-600">{fmtNaira(priorTotals.clTotal)}</td>
            <td className="px-3 py-2 text-right">{fmtNaira(currTotals.clTotal - priorTotals.clTotal)}</td>
            <td className="px-3 py-2 text-right">{priorTotals.clTotal !== 0 ? `${(((currTotals.clTotal - priorTotals.clTotal) / priorTotals.clTotal) * 100).toFixed(1)}%` : '—'}</td>
          </tr>
          <tr className="bg-amber-50/50"><td colSpan={5} className="px-3 py-1.5 pl-6 text-[10px] font-semibold text-amber-600 uppercase tracking-wider">Non-Current Liabilities</td></tr>
          {(current?.nonCurrentLiabilities?.subSections || []).map((sec: any) => {
            const priorSec = (priorData?.nonCurrentLiabilities?.subSections || []).find((s: any) => s.key === sec.key);
            return renderSubSection(sec, priorSec);
          })}
          <tr className="border-t-2 border-amber-200 bg-amber-50/70 font-bold">
            <td className="px-3 py-2 pl-6 text-sm text-slate-800">Total Non-Current Liabilities</td>
            <td className="px-3 py-2 text-right text-slate-800">{fmtNaira(currTotals.nclTotal)}</td>
            <td className="px-3 py-2 text-right text-slate-600">{fmtNaira(priorTotals.nclTotal)}</td>
            <td className="px-3 py-2 text-right">{fmtNaira(currTotals.nclTotal - priorTotals.nclTotal)}</td>
            <td className="px-3 py-2 text-right">{priorTotals.nclTotal !== 0 ? `${(((currTotals.nclTotal - priorTotals.nclTotal) / priorTotals.nclTotal) * 100).toFixed(1)}%` : '—'}</td>
          </tr>
          <tr className="border-t-2 border-amber-300 bg-amber-100 font-bold">
            <td className="px-3 py-2.5 text-sm text-slate-900">TOTAL LIABILITIES</td>
            <td className="px-3 py-2.5 text-right text-slate-900">{fmtNaira(current?.totalLiabilities || 0)}</td>
            <td className="px-3 py-2.5 text-right text-slate-700">{fmtNaira(priorData?.totalLiabilities || 0)}</td>
            <td className="px-3 py-2.5 text-right text-slate-900">{fmtNaira((current?.totalLiabilities || 0) - (priorData?.totalLiabilities || 0))}</td>
            <td className="px-3 py-2.5 text-right text-slate-900">{(priorData?.totalLiabilities || 0) !== 0 ? `${((((current?.totalLiabilities || 0) - (priorData?.totalLiabilities || 0)) / (priorData?.totalLiabilities || 0)) * 100).toFixed(1)}%` : '—'}</td>
          </tr>

          <tr className="bg-violet-50"><td colSpan={5} className="px-3 py-2.5 text-xs font-bold text-violet-800 uppercase tracking-wider">Equity</td></tr>
          {(current?.equity?.subSections || []).map((sec: any) => {
            const priorSec = (priorData?.equity?.subSections || []).find((s: any) => s.key === sec.key);
            return renderSubSection(sec, priorSec);
          })}
          <tr className="border-t-2 border-violet-200 bg-violet-100 font-bold">
            <td className="px-3 py-2.5 text-sm text-slate-900">TOTAL EQUITY</td>
            <td className="px-3 py-2.5 text-right text-slate-900">{fmtNaira(current?.totalEquity || 0)}</td>
            <td className="px-3 py-2.5 text-right text-slate-700">{fmtNaira(priorData?.totalEquity || 0)}</td>
            <td className="px-3 py-2.5 text-right text-slate-900">{fmtNaira((current?.totalEquity || 0) - (priorData?.totalEquity || 0))}</td>
            <td className="px-3 py-2.5 text-right text-slate-900">{(priorData?.totalEquity || 0) !== 0 ? `${((((current?.totalEquity || 0) - (priorData?.totalEquity || 0)) / (priorData?.totalEquity || 0)) * 100).toFixed(1)}%` : '—'}</td>
          </tr>

          <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold text-base">
            <td className="px-3 py-3 text-slate-900">Total Liabilities &amp; Equity</td>
            <td className="px-3 py-3 text-right text-slate-900">{fmtNaira((current?.totalLiabilities || 0) + (current?.totalEquity || 0))}</td>
            <td className="px-3 py-3 text-right text-slate-700">{fmtNaira((priorData?.totalLiabilities || 0) + (priorData?.totalEquity || 0))}</td>
            <td className="px-3 py-3 text-right text-slate-900">
              {fmtNaira(((current?.totalLiabilities || 0) + (current?.totalEquity || 0)) - ((priorData?.totalLiabilities || 0) + (priorData?.totalEquity || 0)))}
            </td>
            <td className="px-3 py-3 text-right text-slate-900">
              {((priorData?.totalLiabilities || 0) + (priorData?.totalEquity || 0)) !== 0
                ? `${((((current?.totalLiabilities || 0) + (current?.totalEquity || 0)) - ((priorData?.totalLiabilities || 0) + (priorData?.totalEquity || 0))) / ((priorData?.totalLiabilities || 0) + (priorData?.totalEquity || 0)) * 100).toFixed(1)}%`
                : '—'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
