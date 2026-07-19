export const MODULE_LINKS: { prefix: string; path: string; label: string; isJournal?: boolean }[] = [
  { prefix: '1000', path: '/banking', label: 'Banking' },
  { prefix: '1001', path: '/banking', label: 'Banking' },
  { prefix: '1002', path: '/banking', label: 'Banking' },
  { prefix: '1003', path: '/banking', label: 'Banking' },
  { prefix: '1004', path: '/banking', label: 'Banking' },
  { prefix: '1005', path: '/banking', label: 'Banking' },
  { prefix: '1010', path: '/sales/customers', label: 'Customers' },
  { prefix: '1011', path: '/sales/customers', label: 'Customers' },
  { prefix: '102', path: '/inventory/items', label: 'Items' },
  { prefix: '200', path: '/accountant/fixed-assets', label: 'Fixed Assets' },
  { prefix: '201', path: '/accountant/fixed-assets', label: 'Fixed Assets' },
  { prefix: '202', path: '/accountant/fixed-assets', label: 'Fixed Assets' },
  { prefix: '203', path: '/accountant/fixed-assets', label: 'Fixed Assets' },
  { prefix: '204', path: '/accountant/fixed-assets', label: 'Fixed Assets' },
  { prefix: '205', path: '/accountant/fixed-assets', label: 'Fixed Assets' },
  { prefix: '206', path: '/accountant/fixed-assets', label: 'Fixed Assets' },
  { prefix: '3000', path: '/purchases/bills', label: 'Bills' },
  { prefix: '3001', path: '/purchases/bills', label: 'Bills' },
  { prefix: '3015', path: '/payroll/runs', label: 'Payroll' },
  { prefix: '3016', path: '/payroll/runs', label: 'Payroll' },
  { prefix: '3018', path: '/payroll/runs', label: 'Payroll' },
  { prefix: '306', path: '/payroll/runs', label: 'Payroll' },
  { prefix: '500', path: '/accountant/journals', label: 'Manual Journals', isJournal: true },
  { prefix: '501', path: '/accountant/journals', label: 'Manual Journals', isJournal: true },
  { prefix: '502', path: '/accountant/journals', label: 'Manual Journals', isJournal: true },
  { prefix: '503', path: '/accountant/journals', label: 'Manual Journals', isJournal: true },
  { prefix: '504', path: '/accountant/journals', label: 'Manual Journals', isJournal: true },
  { prefix: '505', path: '/accountant/journals', label: 'Manual Journals', isJournal: true },
  { prefix: '600', path: '/sales/invoices', label: 'Invoices' },
  { prefix: '601', path: '/sales/invoices', label: 'Invoices' },
  { prefix: '700', path: '/inventory/items', label: 'Items' },
  { prefix: '8001', path: '/payroll/runs', label: 'Payroll' },
  { prefix: '8003', path: '/payroll/runs', label: 'Payroll' },
  { prefix: '900', path: '/sales/invoices', label: 'Invoices' },
];

export function getAccountModuleLink(code: string, accountId?: string): { path: string; label: string } | null {
  const c = code.toString().trim();
  for (const m of MODULE_LINKS) {
    if (c.startsWith(m.prefix)) {
      let path = m.path;
      if (m.isJournal && accountId) path = `${m.path}?accountId=${accountId}`;
      return { path, label: m.label };
    }
  }
  return null;
}

export type ReportType = 'trial-balance' | 'income-statement' | 'balance-sheet' | 'cash-flow' | 'aged-receivables' | 'aged-payables' | 'statement-of-changes-in-equity';

export interface ReportPageProps {
  reportType: ReportType;
  title: string;
}

export function fmtNaira(v: number): string {
  return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function getDefaultDateRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: now.toISOString().split('T')[0],
  };
}

export function getDefaultCompareDates(sDate: string, eDate: string): { compareStart: string; compareEnd: string } {
  const start = new Date(sDate);
  const end = new Date(eDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { compareStart: '', compareEnd: '' };
  }
  const durationMs = end.getTime() - start.getTime();
  const priorEnd = new Date(start.getTime() - 86400000);
  const priorStart = new Date(priorEnd.getTime() - durationMs);
  return {
    compareStart: isNaN(priorStart.getTime()) ? '' : priorStart.toISOString().split('T')[0],
    compareEnd: isNaN(priorEnd.getTime()) ? '' : priorEnd.toISOString().split('T')[0],
  };
}

export function getDefaultCompareAsOf(asOfDate: string): string {
  const d = new Date(asOfDate);
  if (isNaN(d.getTime())) return '';
  const prior = new Date(d.getFullYear() - 1, d.getMonth(), d.getDate());
  return isNaN(prior.getTime()) ? '' : prior.toISOString().split('T')[0];
}

export function formatVarianceClass(variance: number, isRevenue: boolean): string {
  if (variance === 0) return '';
  const isFavorable = isRevenue ? variance > 0 : variance < 0;
  return isFavorable ? 'text-emerald-600' : 'text-red-600';
}
