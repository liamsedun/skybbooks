import { ReportShell } from './components/ReportShell';

export function IncomeStatementPage() {
  return <ReportShell reportType="income-statement" title="Income Statement" />;
}
export function BalanceSheetPage() {
  return <ReportShell reportType="balance-sheet" title="Balance Sheet" />;
}
export function CashFlowPage() {
  return <ReportShell reportType="cash-flow" title="Cash Flow Statement" />;
}
export function StatementOfChangesInEquityPage() {
  return <ReportShell reportType="statement-of-changes-in-equity" title="Statement of Changes in Equity" />;
}
export function AgedReceivablesPage() {
  return <ReportShell reportType="aged-receivables" title="Aged Receivables" />;
}
export function AgedPayablesPage() {
  return <ReportShell reportType="aged-payables" title="Aged Payables" />;
}
