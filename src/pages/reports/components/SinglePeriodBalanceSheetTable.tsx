import React from 'react';
import { AlertCircle } from 'lucide-react';

export function SinglePeriodBalanceSheetTable({ data, onAccountClick, showZero, showCodes }: { data: any; onAccountClick?: (acct: any) => void; showZero?: boolean; showCodes?: boolean }) {
  if (!data) return <div className="p-6 text-center text-slate-400 text-sm">No balance sheet data available.</div>;

  const hasOB = Math.abs(data.outOfBalance) > 1;

  function shouldShow(balance: number): boolean {
    return showZero || Math.abs(balance) > 0.01;
  }

  function fmt(val: number): string {
    return `₦${(val / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function renderItems(items: any[], indent: string = 'pl-8') {
    return items.filter((i: any) => shouldShow(i.balance)).map((item: any, idx: number) => (
      <tr key={`${item.accountId || item.code || idx}`} className={`border-t border-slate-100 hover:bg-slate-50/50 even:bg-slate-50/50 transition-colors ${item.accountId !== 're-opening' && item.accountId !== 're-profit-period' && item.accountId !== 're-dividends' && item.accountId !== 're-other' && item.accountId && !item.accountId.startsWith('re-') ? 'cursor-pointer' : ''}`}
        onClick={() => item.accountId && !item.accountId.startsWith('re-') && onAccountClick?.(item)}>
        <td className={`px-3 py-2 ${indent} ${item.balance === 0 ? 'text-slate-300' : 'text-slate-800'}`}>
          {showCodes && item.code ? <span className="text-slate-400 mr-1.5 text-[11px] font-mono">{item.code}</span> : ''}
          {item.name}{item.reclassified ? <span className="text-slate-400 italic text-[10px] ml-1">(reclassified)</span> : ''}
        </td>
        <td className={`px-3 py-2 text-right ${item.balance === 0 ? 'text-slate-300' : 'font-semibold text-slate-800'}`}>{fmt(item.balance)}</td>
      </tr>
    ));
  }

  function renderSection(label: string, total: number, items: any[], indent: string = 'pl-8', bg: string = 'bg-slate-100/50') {
    if (!showZero && total === 0 && items.every((i: any) => !shouldShow(i.balance))) return null;
    const sectionItems = items.filter((i: any) => i.name !== label);
    return (
      <>
        <tr className={bg}>
          <td colSpan={2} className="px-3 py-2 text-xs font-bold text-slate-700 uppercase tracking-wider">{label}</td>
        </tr>
        {renderItems(sectionItems, indent)}
        <tr className="border-t border-slate-200 bg-slate-50/50 font-medium">
          <td className="px-3 py-2 pl-8 text-sm text-slate-700">Total {label}</td>
          <td className="px-3 py-2 text-right text-slate-800">{fmt(total)}</td>
        </tr>
      </>
    );
  }

  function renderNBVSection(label: string, costItems: any[], costTotal: number, contraItems: any[], contraTotal: number, netTotal: number) {
    const show = showZero || netTotal !== 0 || costTotal !== 0;
    if (!show) return null;
    return (
      <>
        <tr className="bg-slate-100/50">
          <td colSpan={2} className="px-3 py-2 text-xs font-bold text-slate-700 uppercase tracking-wider">{label}</td>
        </tr>
        {renderItems(costItems, 'pl-8')}
        {contraItems.length > 0 && contraItems.map((ci: any) => (
          <tr key={ci.accountId || ci.code} className="border-t border-slate-100 text-slate-500">
            <td className="px-3 py-2 pl-8 text-sm">Less: {ci.name}</td>
            <td className="px-3 py-2 text-right text-sm">{fmt(-Math.abs(ci.balance))}</td>
          </tr>
        ))}
        <tr className="border-t border-slate-200 bg-slate-50/50 font-semibold">
          <td className="px-3 py-2 pl-8 text-sm text-slate-700">Net Book Value – {label}</td>
          <td className="px-3 py-2 text-right text-slate-800">{fmt(netTotal)}</td>
        </tr>
      </>
    );
  }

  const ca = data?.currentAssets || {};
  const nca = data?.nonCurrentAssets || {};
  const cl = data?.currentLiabilities || {};
  const ncl = data?.nonCurrentLiabilities || {};
  const eq = data?.equity || {};

  const caSections = ca.subSections || [];
  const ncaSections = nca.subSections || [];
  const clSections = cl.subSections || [];
  const nclSections = ncl.subSections || [];
  const eqSections = eq.subSections || [];

  const totalAssets = data?.totalAssets || 0;
  const totalLiabilities = data?.totalLiabilities || 0;
  const totalEquity = data?.totalEquity || 0;
  const liabilitiesAndEquity = totalLiabilities + totalEquity;

  return (
    <div className="space-y-4">
      {hasOB && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-red-800 text-sm">⚠ Trial Balance Out of Balance by {fmt(Math.abs(data.outOfBalance))}</p>
            <p className="text-red-600 text-xs mt-1">This report may be unreliable. Please reconcile your journals before publishing this statement.</p>
          </div>
        </div>
      )}

      {(data?.reclassified || []).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
          {data.reclassified.map((r: any, i: number) => (
            <p key={i}>• Reclassified <strong>{r.from}</strong> from {r.fromSection} to {r.toSection} ({r.reason})</p>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="text-left px-3 py-3">Account</th>
              <th className="text-right px-3 py-3">Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-blue-50"><td colSpan={2} className="px-3 py-2.5 text-xs font-bold text-blue-800 uppercase tracking-wider tracking-wide">Assets</td></tr>

            <tr className="bg-blue-50/50"><td colSpan={2} className="px-3 py-1.5 pl-6 text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Current Assets</td></tr>
            {caSections.map((sec: any) => (
              sec.key === 'ppe' || sec.key === 'rou' || sec.key === 'intangibles'
                ? renderNBVSection(sec.label, sec.items || [], sec.total || 0, sec.contraItems || [], sec.contraTotal || 0, sec.netTotal ?? sec.total)
                : renderSection(sec.label, sec.total || 0, sec.items || [], 'pl-10', 'bg-blue-50/20')
            ))}
            <tr className="border-t-2 border-blue-200 bg-blue-50/70 font-bold">
              <td className="px-3 py-2 pl-6 text-sm text-slate-800">Total Current Assets</td>
              <td className="px-3 py-2 text-right text-slate-800">{fmt(ca.total || 0)}</td>
            </tr>

            <tr className="bg-blue-50/50"><td colSpan={2} className="px-3 py-1.5 pl-6 text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Non-Current Assets</td></tr>
            {ncaSections.map((sec: any) => (
              sec.key === 'ppe' || sec.key === 'rou' || sec.key === 'intangibles'
                ? renderNBVSection(sec.label, sec.items || [], sec.total || 0, sec.contraItems || [], sec.contraTotal || 0, sec.netTotal ?? sec.total)
                : renderSection(sec.label, sec.total || 0, sec.items || [], 'pl-10', 'bg-blue-50/20')
            ))}
            <tr className="border-t-2 border-blue-200 bg-blue-50/70 font-bold">
              <td className="px-3 py-2 pl-6 text-sm text-slate-800">Total Non-Current Assets</td>
              <td className="px-3 py-2 text-right text-slate-800">{fmt(nca.total || 0)}</td>
            </tr>

            <tr className="border-t-2 border-blue-300 bg-blue-100 font-bold text-base">
              <td className="px-3 py-3 text-slate-900">TOTAL ASSETS</td>
              <td className="px-3 py-3 text-right text-slate-900">{fmt(totalAssets)}</td>
            </tr>

            <tr className="bg-amber-50"><td colSpan={2} className="px-3 py-2.5 text-xs font-bold text-amber-800 uppercase tracking-wider tracking-wide">Liabilities</td></tr>

            <tr className="bg-amber-50/50"><td colSpan={2} className="px-3 py-1.5 pl-6 text-[10px] font-semibold text-amber-600 uppercase tracking-wider">Current Liabilities</td></tr>
            {clSections.map((sec: any) => renderSection(sec.label, sec.total || 0, sec.items || [], 'pl-10', 'bg-amber-50/20'))}
            <tr className="border-t-2 border-amber-200 bg-amber-50/70 font-bold">
              <td className="px-3 py-2 pl-6 text-sm text-slate-800">Total Current Liabilities</td>
              <td className="px-3 py-2 text-right text-slate-800">{fmt(cl.total || 0)}</td>
            </tr>

            <tr className="bg-amber-50/50"><td colSpan={2} className="px-3 py-1.5 pl-6 text-[10px] font-semibold text-amber-600 uppercase tracking-wider">Non-Current Liabilities</td></tr>
            {nclSections.map((sec: any) => renderSection(sec.label, sec.total || 0, sec.items || [], 'pl-10', 'bg-amber-50/20'))}
            <tr className="border-t-2 border-amber-200 bg-amber-50/70 font-bold">
              <td className="px-3 py-2 pl-6 text-sm text-slate-800">Total Non-Current Liabilities</td>
              <td className="px-3 py-2 text-right text-slate-800">{fmt(ncl.total || 0)}</td>
            </tr>

            <tr className="border-t-2 border-amber-300 bg-amber-100 font-bold">
              <td className="px-3 py-2.5 text-sm text-slate-900">TOTAL LIABILITIES</td>
              <td className="px-3 py-2.5 text-right text-slate-900">{fmt(totalLiabilities)}</td>
            </tr>

            <tr className="bg-violet-50"><td colSpan={2} className="px-3 py-2.5 text-xs font-bold text-violet-800 uppercase tracking-wider tracking-wide">Equity</td></tr>
            {eqSections.map((sec: any) => renderSection(sec.label, sec.total || 0, sec.items || [], 'pl-10', 'bg-violet-50/20'))}
            <tr className="border-t-2 border-violet-200 bg-violet-100 font-bold">
              <td className="px-3 py-2.5 text-sm text-slate-900">TOTAL EQUITY</td>
              <td className="px-3 py-2.5 text-right text-slate-900">{fmt(totalEquity)}</td>
            </tr>

            <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold text-base">
              <td className="px-3 py-3 text-slate-900">TOTAL LIABILITIES &amp; EQUITY</td>
              <td className="px-3 py-3 text-right text-slate-900">{fmt(liabilitiesAndEquity)}</td>
            </tr>

            <tr className="border-t border-slate-200">
              <td colSpan={2} className="px-3 py-2 text-xs text-slate-500">
                Accounting Equation Check: Total Assets ({fmt(totalAssets)}) = Total Liabilities ({fmt(totalLiabilities)}) + Total Equity ({fmt(totalEquity)})
                {Math.abs(totalAssets - liabilitiesAndEquity) < 1 ? <span className="text-emerald-600 font-bold ml-2">✅ Balanced</span> : <span className="text-red-600 font-bold ml-2">⚠ {fmt(totalAssets - liabilitiesAndEquity)} out of balance</span>}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
