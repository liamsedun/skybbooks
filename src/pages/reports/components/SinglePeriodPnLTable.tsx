import React from 'react';

export function SinglePeriodPnLTable({ current, onAccountClick, showZero, showCodes }: { current: any; onAccountClick?: (acct: any) => void; showZero?: boolean; showCodes?: boolean }) {
  function shouldShow(balance: number): boolean {
    return showZero || Math.abs(balance) > 0.01;
  }
  function fmtPnL(val: number): string {
    const abs = Math.abs(val / 100);
    const formatted = abs.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return val < 0 ? `(₦${formatted})` : `₦${formatted}`;
  }
  function renderSection(label: string, accounts: any[], total: number, indent: string = 'pl-8', subIndent: string = 'pl-8') {
    const visible = (accounts || []).filter((a: any) => shouldShow(a.balance));
    if (!showZero && visible.length === 0 && Math.abs(total) < 0.01) return null;
    return (
      <>
        <tr className="bg-slate-100/50">
          <td colSpan={2} className="px-3 py-2 text-xs font-bold text-slate-700 uppercase tracking-wider">{label}</td>
        </tr>
        {visible.map((a: any, i: number) => (
          <tr key={i} className={`border-t border-slate-100 hover:bg-slate-50/50 even:bg-slate-50/50 transition-colors ${a.accountId ? 'cursor-pointer' : ''}`} onClick={() => a.accountId && onAccountClick?.(a)}>
            <td className={`px-3 py-2.5 ${subIndent} text-slate-800`}>{showCodes && a.code ? <span className="text-slate-400 mr-1.5 text-[11px] font-mono">{a.code}</span> : ''}{a.name}</td>
            <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{fmtPnL(a.balance)}</td>
          </tr>
        ))}
        <tr className="border-t border-slate-200 bg-slate-50/50 font-medium">
          <td className={`px-3 py-2 ${indent} text-sm text-slate-700`}>Total {label}</td>
          <td className="px-3 py-2 text-right text-slate-800">{fmtPnL(total)}</td>
        </tr>
      </>
    );
  }
  function renderSubSection(label: string, data: any, indent: string = 'pl-10', subIndent: string = 'pl-14') {
    const accounts = data?.accounts || [];
    const total = data?.total || 0;
    const visible = accounts.filter((a: any) => shouldShow(a.balance));
    if (!showZero && visible.length === 0 && Math.abs(total) < 0.01) return null;
    return (
      <>
        <tr className="bg-slate-50/30">
          <td colSpan={2} className={`px-3 py-1.5 ${indent} text-xs font-semibold text-slate-500 uppercase tracking-wider`}>{label}</td>
        </tr>
        {visible.map((a: any, i: number) => (
          <tr key={i} className={`border-t border-slate-100 hover:bg-slate-50/50 even:bg-slate-50/50 transition-colors ${a.accountId ? 'cursor-pointer' : ''}`} onClick={() => a.accountId && onAccountClick?.(a)}>
            <td className={`px-3 py-2 ${subIndent} text-slate-700`}>{showCodes && a.code ? <span className="text-slate-400 mr-1.5 text-[11px] font-mono">{a.code}</span> : ''}{a.name}</td>
            <td className="px-3 py-2 text-right font-semibold text-slate-700">{fmtPnL(a.balance)}</td>
          </tr>
        ))}
        <tr className="border-t border-slate-200 bg-slate-50/30 font-medium">
          <td className={`px-3 py-1.5 ${indent} text-xs text-slate-500`}>Total {label}</td>
          <td className="px-3 py-1.5 text-right text-slate-600">{fmtPnL(total)}</td>
        </tr>
      </>
    );
  }
  function profitRow(label: string, value: number, isLoss: boolean = false) {
    return (
      <tr className={`border-t-2 ${isLoss ? 'border-red-300 bg-red-50/50' : 'border-slate-300 bg-slate-100'} font-bold`}>
        <td className={`px-3 py-2.5 pl-8 text-sm ${isLoss ? 'text-red-700' : 'text-slate-900'}`}>{label}</td>
        <td className={`px-3 py-2.5 text-right ${isLoss ? 'text-red-700' : 'text-slate-900'}`}>{fmtPnL(value)}</td>
      </tr>
    );
  }
  function renderCostOfSales(cos: any) {
    const accounts = cos?.accounts || [];
    const casTotal = cos?.total || 0;
    const opening = cos?.openingStock ?? 0;
    const closing = cos?.closingStock ?? 0;
    const invSold = cos?.inventorySold ?? 0;
    const pog = cos?.purchasesOfGoods || null;
    const hasInvCalc = opening !== 0 || (pog && pog.balance !== 0) || closing !== 0;
    const visible = accounts.filter((a: any) => shouldShow(a.balance));
    if (!showZero && !hasInvCalc && visible.length === 0 && Math.abs(casTotal) < 0.01) return null;
    const showInv = !showZero ? (hasInvCalc || Math.abs(invSold) >= 0.01) : true;
    return (
      <>
        <tr className="bg-slate-100/50">
          <td colSpan={2} className="px-3 py-2 text-xs font-bold text-slate-700 uppercase tracking-wider">Cost of Sales</td>
        </tr>
        {showInv && (
          <>
            <tr className="border-t border-slate-100 bg-slate-50/30">
              <td className="px-3 py-2 pl-12 text-xs font-semibold text-slate-500">Cost of Inventory Sold</td>
              <td></td>
            </tr>
            {shouldShow(opening) && (
              <tr className="border-t border-slate-100 even:bg-slate-50/50 hover:bg-slate-50/50 transition-colors">
                <td className="px-3 py-2.5 pl-16 text-slate-700">Opening Stock</td>
                <td className="px-3 py-2.5 text-right font-semibold text-slate-700">{fmtPnL(opening)}</td>
              </tr>
            )}
            {pog && shouldShow(pog.balance) && (
              <tr className="border-t border-slate-100 even:bg-slate-50/50 hover:bg-slate-50/50 transition-colors">
                <td className="px-3 py-2.5 pl-16 text-slate-700">{showCodes ? <span className="text-slate-400 mr-1.5 text-[11px] font-mono">{pog.code}</span> : ''}{pog.name}</td>
                <td className="px-3 py-2.5 text-right font-semibold text-slate-700">{fmtPnL(pog.balance)}</td>
              </tr>
            )}
            {shouldShow(closing) && (
              <tr className="border-t border-slate-100 even:bg-slate-50/50 hover:bg-slate-50/50 transition-colors">
                <td className="px-3 py-2.5 pl-16 text-slate-700">Closing Stock</td>
                <td className="px-3 py-2.5 text-right font-semibold text-slate-700">{fmtPnL(-closing)}</td>
              </tr>
            )}
            <tr className="border-t border-slate-200 bg-slate-50/50 font-medium">
              <td className="px-3 py-2 pl-12 text-sm text-slate-700">Cost of Inventory Sold</td>
              <td className="px-3 py-2 text-right text-slate-800">{fmtPnL(invSold)}</td>
            </tr>
          </>
        )}
        {visible.map((a: any, i: number) => (
          <tr key={i} className={`border-t border-slate-100 hover:bg-slate-50/50 even:bg-slate-50/50 transition-colors ${a.accountId ? 'cursor-pointer' : ''}`} onClick={() => a.accountId && onAccountClick?.(a)}>
            <td className={`px-3 py-2.5 pl-12 text-slate-800`}>{showCodes && a.code ? <span className="text-slate-400 mr-1.5 text-[11px] font-mono">{a.code}</span> : ''}{a.name}</td>
            <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{fmtPnL(a.balance)}</td>
          </tr>
        ))}
        <tr className="border-t border-slate-200 bg-slate-50/50 font-medium">
          <td className="px-3 py-2 pl-8 text-sm text-slate-700">Total Cost of Sales</td>
          <td className="px-3 py-2 text-right text-slate-800">{fmtPnL(casTotal)}</td>
        </tr>
      </>
    );
  }

  const opRev = current?.operatingRevenue || {};
  const ooi = current?.otherOperatingIncome || {};
  const cos = current?.costOfSales || {};
  const sc = current?.staffCosts || {};
  const adm = current?.administrative || {};
  const sd = current?.sellingDistribution || {};
  const ooe = current?.otherOperatingExpenses || {};
  const fi = current?.financeIncome || {};
  const fc = current?.financeCosts || {};
  const tx = current?.incomeTaxExpense || {};

  const opRevTotal = opRev.total || 0;
  const ooiTotal = ooi.total || 0;
  const totalRevenue = current?.totalRevenue ?? (opRevTotal + ooiTotal);
  const cosTotal = cos.total || 0;
  const grossProfit = current?.grossProfit ?? (totalRevenue - cosTotal);
  const scTotal = sc.total || 0;
  const admTotal = adm.total || 0;
  const sdTotal = sd.total || 0;
  const ooeTotal = ooe.total || 0;
  const opExTotal = current?.totalOperatingExpenses ?? (scTotal + admTotal + sdTotal + ooeTotal);
  const operatingProfit = current?.operatingProfit ?? (grossProfit - opExTotal);
  const fiTotal = fi.total || 0;
  const fcTotal = fc.total || 0;
  const profitBeforeTax = current?.profitBeforeTax ?? (operatingProfit + fiTotal - fcTotal);
  const txTotal = tx.total || 0;
  const netProfit = current?.netProfit ?? (profitBeforeTax - txTotal);
  const effectiveTaxRate = current?.effectiveTaxRate ?? (profitBeforeTax > 0 ? Math.round((txTotal / profitBeforeTax) * 1000) / 10 : 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          <tr>
            <th className="text-left px-3 py-3">Account</th>
            <th className="text-right px-3 py-3">Amount</th>
          </tr>
        </thead>
        <tbody>
          {renderSection('Operating Revenue', opRev.accounts, opRevTotal)}
          {renderSection('Other Operating Income', ooi.accounts, ooiTotal)}
          <tr className="border-t border-slate-200 bg-slate-100/70 font-semibold">
            <td className="px-3 py-2 pl-8 text-sm text-slate-800">TOTAL REVENUE</td>
            <td className="px-3 py-2 text-right text-slate-800">{fmtPnL(totalRevenue)}</td>
          </tr>
          {renderCostOfSales(cos)}
          {profitRow('GROSS PROFIT', grossProfit, grossProfit < 0)}
          <tr className="bg-slate-100/50">
            <td colSpan={2} className="px-3 py-2 text-xs font-bold text-slate-700 uppercase tracking-wider">Operating Expenses</td>
          </tr>
          {renderSubSection('Staff Costs', sc)}
          {renderSubSection('Administrative Expenses', adm)}
          {renderSubSection('Selling & Distribution Expenses', sd)}
          {renderSubSection('Other Operating Expenses', ooe)}
          <tr className="border-t border-slate-200 bg-slate-100/70 font-semibold">
            <td className="px-3 py-2 pl-8 text-sm text-slate-800">Total Operating Expenses</td>
            <td className="px-3 py-2 text-right text-slate-800">{fmtPnL(opExTotal)}</td>
          </tr>
          {profitRow('OPERATING PROFIT (EBIT)', operatingProfit, operatingProfit < 0)}
          {renderSection('Finance Income', fi.accounts, fiTotal)}
          {renderSection('Finance Costs', fc.accounts, fcTotal)}
          {profitRow('PROFIT BEFORE TAX', profitBeforeTax, profitBeforeTax < 0)}
          {renderSection('Income Tax Expense', tx.accounts, txTotal)}
          <tr className={`border-t-2 font-bold ${netProfit < 0 ? 'border-red-500 bg-red-50' : 'border-slate-400 bg-slate-100'}`}>
            <td className={`px-3 py-3 text-sm ${netProfit < 0 ? 'text-red-800' : 'text-slate-900'}`}>NET PROFIT AFTER TAX</td>
            <td className={`px-3 py-3 text-right ${netProfit < 0 ? 'text-red-800' : 'text-slate-900'}`}>{fmtPnL(netProfit)}</td>
          </tr>
          {profitBeforeTax > 0 && (
            <tr className="bg-slate-50 border-t border-slate-200">
              <td colSpan={2} className="px-3 py-2 text-xs text-slate-500 italic">Effective Tax Rate: {effectiveTaxRate}%  (Tax Expense ÷ Profit Before Tax)</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
