export interface PnLRow {
  section?: string;
  isSummary?: boolean;
  summaryCurrent?: number;
  summaryPrior?: number;
  isRevenue?: boolean;
  children?: PnLChildRow[];
  totalCurrent?: number;
  totalPrior?: number;
}

interface PnLChildRow {
  accountId?: string;
  name: string;
  code?: string;
  currentBalance: number;
  priorBalance: number;
  variance: number;
  isRevenue: boolean;
  isSubtotal?: boolean;
}

export function buildPnLRows(current: any, prior: any | null): PnLRow[] {
  function buildSec(key: string, label: string, isRevenue: boolean): PnLRow {
    const currAccounts = current?.[key]?.accounts || [];
    const priorAccounts = prior?.[key]?.accounts || [];
    const priorMap = new Map(priorAccounts.map((a: any) => [a.code || a.accountId, a.balance]));
    let secCurrTotal = 0;
    let secPriorTotal = 0;
    const secRows: PnLChildRow[] = [];
    for (const a of currAccounts) {
      const code = a.code || a.accountId;
      const priorBal = Number(priorMap.get(code) || 0);
      secCurrTotal += (a.balance as number);
      secPriorTotal += priorBal;
      secRows.push({ accountId: a.accountId, name: a.name, code: a.code, currentBalance: a.balance, priorBalance: priorBal, variance: (a.balance as number) - priorBal, isRevenue });
    }
    for (const a of priorAccounts) {
      const code = a.code || a.accountId;
      if (!currAccounts.some((ca: any) => (ca.code || ca.accountId) === code)) {
        secPriorTotal += a.balance;
        secRows.push({ accountId: a.accountId, name: a.name, code: a.code, currentBalance: 0, priorBalance: a.balance, variance: 0 - a.balance, isRevenue });
      }
    }
    return { section: label, children: secRows, totalCurrent: secCurrTotal, totalPrior: secPriorTotal, isRevenue };
  }
  const rows: PnLRow[] = [];
  rows.push(buildSec('operatingRevenue', 'Operating Revenue', true));
  rows.push(buildSec('otherOperatingIncome', 'Other Operating Income', true));
  const trCurr = current?.totalRevenue ?? (current?.operatingRevenue?.total || 0) + (current?.otherOperatingIncome?.total || 0);
  const trPrior = prior?.totalRevenue ?? prior?.revenue ?? (prior?.operatingRevenue?.total || 0) + (prior?.otherOperatingIncome?.total || 0);
  rows.push({ section: 'TOTAL REVENUE', isSummary: true, summaryCurrent: trCurr, summaryPrior: trPrior, isRevenue: true });
  (function() {
    const cos = current?.costOfSales || {};
    const cosIsFlat = typeof prior?.costOfSales === 'number';
    const cosPrior = cosIsFlat ? {} : (prior?.costOfSales || {});
    const currAccounts = cos?.accounts || [];
    const priorAccounts = cosIsFlat ? [] : (cosPrior?.accounts || []);
    const priorMap = new Map(priorAccounts.map((a: any) => [a.code || a.accountId, a.balance]));
    const children: PnLChildRow[] = [];
    let secCurr = 0;
    let secPrior = 0;
    const opening = cos?.openingStock ?? 0;
    const closing = cos?.closingStock ?? 0;
    const invSold = cos?.inventorySold ?? 0;
    const pog = cos?.purchasesOfGoods || null;
    const priorOpening = cosPrior?.openingStock ?? 0;
    const priorClosing = cosPrior?.closingStock ?? 0;
    const priorInvSold = cosPrior?.inventorySold ?? 0;
    const priorPog = cosPrior?.purchasesOfGoods || null;
    if (opening !== 0 || priorOpening !== 0) {
      children.push({ name: 'Opening Stock', currentBalance: opening, priorBalance: priorOpening, variance: opening - priorOpening, isRevenue: false });
      secCurr += opening; secPrior += priorOpening;
    }
    if ((pog && pog.balance !== 0) || (priorPog && priorPog.balance !== 0)) {
      const curBal = pog?.balance || 0;
      const priBal = priorPog?.balance || 0;
      children.push({ name: `${pog?.name || 'Purchases of Goods'} (${pog?.code || '700200'})`, currentBalance: curBal, priorBalance: priBal, variance: curBal - priBal, isRevenue: false });
      secCurr += curBal; secPrior += priBal;
    }
    if (closing !== 0 || priorClosing !== 0) {
      children.push({ name: 'Closing Stock', currentBalance: -closing, priorBalance: -priorClosing, variance: -closing + priorClosing, isRevenue: false });
      secCurr -= closing; secPrior -= priorClosing;
    }
    if (invSold !== 0 || priorInvSold !== 0) {
      children.push({ name: 'Cost of Inventory Sold', isSubtotal: true, currentBalance: invSold, priorBalance: priorInvSold, variance: invSold - priorInvSold, isRevenue: false });
    }
    for (const a of currAccounts) {
      const code = a.code || a.accountId;
      const priorBal = Number(priorMap.get(code) || 0);
      secCurr += (a.balance as number);
      secPrior += priorBal;
      children.push({ accountId: a.accountId, name: a.name, code: a.code, currentBalance: a.balance, priorBalance: priorBal, variance: (a.balance as number) - priorBal, isRevenue: false });
    }
    for (const a of priorAccounts) {
      const code = a.code || a.accountId;
      if (!currAccounts.some((ca: any) => (ca.code || ca.accountId) === code)) {
        secPrior += a.balance;
        children.push({ accountId: a.accountId, name: a.name, code: a.code, currentBalance: 0, priorBalance: a.balance, variance: 0 - a.balance, isRevenue: false });
      }
    }
    if (cosIsFlat) {
      const flatVal = prior?.costOfSales || 0;
      children.length = 0;
      secCurr = current?.costOfSales?.total || 0;
      secPrior = flatVal;
      children.push({ name: 'Cost of Sales (prior system — legacy)', currentBalance: secCurr, priorBalance: secPrior, variance: secCurr - secPrior, isRevenue: false });
    }
    rows.push({ section: 'Cost of Sales', children, totalCurrent: secCurr, totalPrior: secPrior, isRevenue: false });
  })();
  const gpCurr = current?.grossProfit ?? (trCurr - (current?.costOfSales?.total || 0));
  const gpPrior = prior?.grossProfit ?? (trPrior - (prior?.costOfSales?.total || 0));
  rows.push({ section: 'GROSS PROFIT', isSummary: true, summaryCurrent: gpCurr, summaryPrior: gpPrior, isRevenue: true });
  const subSections = [
    { key: 'staffCosts', label: 'Staff Costs', isRevenue: false },
    { key: 'administrative', label: 'Administrative Expenses', isRevenue: false },
    { key: 'sellingDistribution', label: 'Selling & Distribution Expenses', isRevenue: false },
    { key: 'otherOperatingExpenses', label: 'Other Operating Expenses', isRevenue: false },
  ];
  for (const sub of subSections) {
    const currAccounts = current?.[sub.key]?.accounts || [];
    const priorAccounts = prior?.[sub.key]?.accounts || [];
    if (currAccounts.length > 0 || priorAccounts.length > 0) {
      rows.push(buildSec(sub.key, sub.label, false));
    }
  }
  const opExCurr = current?.totalOperatingExpenses ?? 0;
  const opExPrior = prior?.totalOperatingExpenses ?? 0;
  rows.push({ section: 'Total Operating Expenses', isSummary: true, summaryCurrent: opExCurr, summaryPrior: opExPrior, isRevenue: false });
  const opCurr = current?.operatingProfit ?? (gpCurr - opExCurr);
  const opPrior = prior?.operatingProfit ?? (gpPrior - opExPrior);
  rows.push({ section: 'OPERATING PROFIT (EBIT)', isSummary: true, summaryCurrent: opCurr, summaryPrior: opPrior, isRevenue: true });
  const fiCurr = current?.financeIncome?.accounts || [];
  const fiPrior = prior?.financeIncome?.accounts || [];
  if (fiCurr.length > 0 || fiPrior.length > 0) {
    rows.push(buildSec('financeIncome', 'Finance Income', true));
  }
  const fcCurr = current?.financeCosts?.accounts || [];
  const fcPrior = prior?.financeCosts?.accounts || [];
  if (fcCurr.length > 0 || fcPrior.length > 0) {
    rows.push(buildSec('financeCosts', 'Finance Costs', false));
  }
  const fiTotalCurr = current?.financeIncome?.total || 0;
  const fcTotalCurr = current?.financeCosts?.total || 0;
  const fiTotalPrior = prior?.financeIncome?.total || 0;
  const fcTotalPrior = prior?.financeCosts?.total || 0;
  const pbtCurr = current?.profitBeforeTax ?? (opCurr + fiTotalCurr - fcTotalCurr);
  const pbtPrior = prior?.profitBeforeTax ?? (opPrior + fiTotalPrior - fcTotalPrior);
  rows.push({ section: 'PROFIT BEFORE TAX', isSummary: true, summaryCurrent: pbtCurr, summaryPrior: pbtPrior, isRevenue: true });
  const txCurr = current?.incomeTaxExpense?.accounts || [];
  const txPrior = prior?.incomeTaxExpense?.accounts || [];
  if (txCurr.length > 0 || txPrior.length > 0) {
    rows.push(buildSec('incomeTaxExpense', 'Income Tax Expense', false));
  }
  const npCurr = current?.netProfit ?? (pbtCurr - (current?.incomeTaxExpense?.total || 0));
  const npPrior = prior?.netProfit ?? prior?.profitForTheYear ?? (pbtPrior - (prior?.incomeTaxExpense?.total || 0));
  rows.push({ section: 'NET PROFIT AFTER TAX', isSummary: true, summaryCurrent: npCurr, summaryPrior: npPrior, isRevenue: true });
  return rows;
}
