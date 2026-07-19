// Barrel file — re-exports all report page components
export { TrialBalancePage } from './TrialBalancePage';
export { GeneralLedgerPage } from './GeneralLedgerPage';
export { VATReturnPage } from './VATReturnPage';
export { ProjectsReportPage } from './ProjectsReportPage';
export { TaxComputationPage } from './TaxComputationPage';

// Thin wrapper pages that delegate to ReportShell
export { IncomeStatementPage, BalanceSheetPage, CashFlowPage, StatementOfChangesInEquityPage, AgedReceivablesPage, AgedPayablesPage } from './reportWrappers';
