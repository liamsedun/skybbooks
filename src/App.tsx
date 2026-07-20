/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, Outlet } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/api';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

import { ChatProvider } from './contexts/ChatContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';

import { AppLayout } from './components/layout/AppLayout';
import { useAuth } from './hooks/useAuth';

// ── Lazy-loaded page components ─────────────────────────────────────────
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const AccountingAssistant = lazy(() => import('./pages/ai/AccountingAssistant').then(m => ({ default: m.AccountingAssistant })));
const NvidiaAiPage = lazy(() => import('./pages/ai/NvidiaAiPage').then(m => ({ default: m.NvidiaAiPage })));

// Sales
const InvoiceList = lazy(() => import('./pages/sales/InvoiceList').then(m => ({ default: m.InvoiceList })));
const InvoiceForm = lazy(() => import('./pages/sales/InvoiceForm').then(m => ({ default: m.InvoiceForm })));
const InvoiceDetail = lazy(() => import('./pages/sales/InvoiceDetail').then(m => ({ default: m.InvoiceDetail })));
const RecurringInvoicesPage = lazy(() => import('./pages/sales/RecurringInvoices').then(m => ({ default: m.RecurringInvoicesPage })));
const CreditNotesPage = lazy(() => import('./pages/sales/CreditNotes').then(m => ({ default: m.CreditNotesPage })));

// Banking
const BankAccounts = lazy(() => import('./pages/banking/BankAccounts').then(m => ({ default: m.BankAccounts })));
const Reconciliation = lazy(() => import('./pages/banking/Reconciliation').then(m => ({ default: m.Reconciliation })));
const BankRules = lazy(() => import('./pages/banking/BankRules').then(m => ({ default: m.BankRules })));
const TransfersPage = lazy(() => import('./pages/banking/TransfersPage').then(m => ({ default: m.TransfersPage })));
const BankConnectionsPage = lazy(() => import('./pages/banking/BankConnectionsPage').then(m => ({ default: m.BankConnectionsPage })));
const PaymentGatewayPage = lazy(() => import('./pages/banking/PaymentGatewayPage').then(m => ({ default: m.PaymentGatewayPage })));
const ProjectsPage = lazy(() => import('./pages/sales/ProjectsPage').then(m => ({ default: m.ProjectsPage })));
const ProjectDetailPage = lazy(() => import('./pages/sales/ProjectDetailPage').then(m => ({ default: m.ProjectDetailPage })));

// Auth
const LoginPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('./pages/AuthPages').then(m => ({ default: m.ResetPasswordPage })));
const AcceptInvitePage = lazy(() => import('./pages/AuthPages').then(m => ({ default: m.AcceptInvitePage })));
const NotFoundPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.NotFoundPage })));

// ModulePlaceholders
const CustomersPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.CustomersPage })));
const QuotesPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.QuotesPage })));
const PaymentsPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.PaymentsPage })));
const VendorsPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.VendorsPage })));
const ExpensesPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.ExpensesPage })));
const BillsPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.BillsPage })));
const PaymentsMadePage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.PaymentsMadePage })));
const InventoryPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.InventoryPage })));
const InventoryAdjustmentsPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.InventoryAdjustmentsPage })));
const InventoryManagementPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.InventoryManagementPage })));
const ChartOfAccountsPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.ChartOfAccountsPage })));
const JournalsPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.JournalsPage })));
const BudgetsPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.BudgetsPage })));
const FixedAssetsPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.FixedAssetsPage })));
const DepreciationPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.DepreciationPage })));
const LeasesPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.LeasesPage })));
const EclPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.EclPage })));
const TrialBalancePage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.TrialBalancePage })));
const IncomeStatementPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.IncomeStatementPage })));
const BalanceSheetPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.BalanceSheetPage })));
const CashFlowPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.CashFlowPage })));
const StatementOfChangesInEquityPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.StatementOfChangesInEquityPage })));
const GeneralLedgerPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.GeneralLedgerPage })));
const VATReturnPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.VATReturnPage })));
const AgedReceivablesPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.AgedReceivablesPage })));
const AgedPayablesPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.AgedPayablesPage })));
const SalesOrdersPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.SalesOrdersPage })));
const ReceiptsPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.ReceiptsPage })));
const RecurringExpensesPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.RecurringExpensesPage })));
const PurchaseOrdersPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.PurchaseOrdersPage })));
const PurchaseCreditNotesPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.PurchaseCreditNotesPage })));
const CurrencyRatesPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.CurrencyRatesPage })));
const AuditLogsPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.AuditLogsPage })));
const ProjectsReportPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.ProjectsReportPage })));
const CustomReportsPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.CustomReportsPage })));
const TaxComputationPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.TaxComputationPage })));
const TaxEnginePage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.TaxEnginePage })));
const LegacyMigrationPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.LegacyMigrationPage })));
const InvitesSettingsPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.InvitesSettingsPage })));
const IntegrationsSettingsPage = lazy(() => import('./pages/ModulePlaceholders').then(m => ({ default: m.IntegrationsSettingsPage })));

// Other pages
const GroupManagementPage = lazy(() => import('./pages/settings/GroupManagementPage').then(m => ({ default: m.GroupManagementPage })));
const RecurringBillsPage = lazy(() => import('./pages/purchases/RecurringBillsPage').then(m => ({ default: m.RecurringBillsPage })));
const IntercompanyTransactionsPage = lazy(() => import('./pages/accountant/IntercompanyTransactionsPage').then(m => ({ default: m.IntercompanyTransactionsPage })));
const ConsolidationReportsPage = lazy(() => import('./pages/reports/ConsolidationReportsPage').then(m => ({ default: m.ConsolidationReportsPage })));
const SettingsLayout = lazy(() => import('./components/settings/SettingsLayout').then(m => ({ default: m.SettingsLayout })));
const TaxConfigurationPage = lazy(() => import('./pages/settings/TaxConfigurationPage').then(m => ({ default: m.TaxConfigurationPage })));
const NotesPage = lazy(() => import('./pages/reports/NotesPage').then(m => ({ default: m.NotesPage })));
const MappingsPage = lazy(() => import('./pages/reports/MappingsPage').then(m => ({ default: m.MappingsPage })));
const RevenueContractsPage = lazy(() => import('./pages/revenue/RevenueContractsPage').then(m => ({ default: m.RevenueContractsPage })));
const RevenueRecognitionReport = lazy(() => import('./pages/revenue/RevenueRecognitionReport').then(m => ({ default: m.RevenueRecognitionReport })));

// Subscriptions
const SubscriptionPage = lazy(() => import('./pages/subscriptions/SubscriptionPage').then(m => ({ default: m.SubscriptionPage })));
const SubscriptionPlansPage = lazy(() => import('./pages/subscriptions/SubscriptionPlansPage').then(m => ({ default: m.SubscriptionPlansPage })));
const SubscriptionCouponsPage = lazy(() => import('./pages/subscriptions/SubscriptionCouponsPage').then(m => ({ default: m.SubscriptionCouponsPage })));
const SubscriptionPortalPage = lazy(() => import('./pages/subscriptions/SubscriptionPortalPage').then(m => ({ default: m.SubscriptionPortalPage })));
const UsageMonitorDashboardPage = lazy(() => import('./pages/reports/UsageMonitorDashboardPage').then(m => ({ default: m.UsageMonitorDashboardPage })));
const AddonMarketplacePage = lazy(() => import('./pages/subscriptions/AddonMarketplacePage').then(m => ({ default: m.AddonMarketplacePage })));

// SettingsPages (30+ named exports from single file)
const OrganisationProfilePage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.OrganisationProfilePage })));
const BrandingPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.BrandingPage })));
const CustomDomainPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.CustomDomainPage })));
const LocationsPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.LocationsPage })));
const UsersPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.UsersPage })));
const RolesPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.RolesPage })));
const UserPreferencesPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.UserPreferencesPage })));
const GeneralPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.GeneralPage })));
const CurrenciesPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.CurrenciesPage })));
const PaymentTermsPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.PaymentTermsPage })));
const OpeningBalancesPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.OpeningBalancesPage })));
const RemindersPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.RemindersPage })));
const CustomerPortalPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.CustomerPortalPage })));
const VendorPortalPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.VendorPortalPage })));
const TxnNumberingPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.TxnNumberingPage })));
const PdfTemplatesPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.PdfTemplatesPage })));
const EmailNotificationsPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.EmailNotificationsPage })));
const ReportingTagsPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.ReportingTagsPage })));
const WebTabsPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.WebTabsPage })));
const WorkflowRulesPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.WorkflowRulesPage })));
const WorkflowActionsPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.WorkflowActionsPage })));
const WorkflowLogsPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.WorkflowLogsPage })));
const SchedulesPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.SchedulesPage })));
const ContactsSettingsPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.ContactsSettingsPage })));
const ItemsSettingsPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.ItemsSettingsPage })));
const RevenueRecognitionPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.RevenueRecognitionPage })));
const AccountantSettingsPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.AccountantSettingsPage })));
const TasksSettingsPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.TasksSettingsPage })));
const ProjectsSettingsPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.ProjectsSettingsPage })));
const TimesheetSettingsPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.TimesheetSettingsPage })));
const SettingsInventoryAdjustmentsPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.InventoryAdjustmentsPage })));
const SettingsPaymentGatewaysPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.PaymentGatewaysPage })));
const QuotesSettingsPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.QuotesSettingsPage })));
const SalesOrdersSettingsPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.SalesOrdersSettingsPage })));
const InvoicesSettingsPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.InvoicesSettingsPage })));
const RecurringInvoicesSettingsPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.RecurringInvoicesSettingsPage })));
const SalesReceiptsSettingsPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.SalesReceiptsSettingsPage })));
const PaymentsReceivedSettingsPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.PaymentsReceivedSettingsPage })));
const CreditNotesSettingsPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.CreditNotesSettingsPage })));
const DeliveryNotesSettingsPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.DeliveryNotesSettingsPage })));
const PackingSlipsSettingsPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.PackingSlipsSettingsPage })));
const ExpensesSettingsPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.ExpensesSettingsPage })));
const RecurringExpensesSettingsPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.RecurringExpensesSettingsPage })));
const PurchaseOrdersSettingsPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.PurchaseOrdersSettingsPage })));
const BillsSettingsPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.BillsSettingsPage })));
const RecurringBillsSettingsPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.RecurringBillsSettingsPage })));
const PaymentsMadeSettingsPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.PaymentsMadeSettingsPage })));
const VendorCreditsSettingsPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.VendorCreditsSettingsPage })));
const CustomModulesPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.CustomModulesPage })));
const TaxesPage = lazy(() => import('./pages/settings/SettingsPages').then(m => ({ default: m.TaxesPage })));

const EmailSettingsPage = lazy(() => import('./pages/settings/EmailSettingsPage'));
const BillingSettingsPage = lazy(() => import('./pages/settings/BillingSettingsPage'));
const PostingRulesPage = lazy(() => import('./pages/settings/PostingRulesPage'));
const ApprovalWorkflowsPage = lazy(() => import('./pages/settings/ApprovalWorkflowsPage'));
const FeatureFlagsPage = lazy(() => import('./pages/settings/FeatureFlagsPage').then(m => ({ default: m.FeatureFlagsPage })));
const PlanFeatureFlagsPage = lazy(() => import('./pages/settings/PlanFeatureFlagsPage').then(m => ({ default: m.PlanFeatureFlagsPage })));

const OcrProcessingPage = lazy(() => import('./pages/accountant/OcrProcessingPage').then(m => ({ default: m.OcrProcessingPage })));
const HelpDocumentsPage = lazy(() => import('./pages/help/HelpDocumentsPage').then(m => ({ default: m.HelpDocumentsPage })));
const FAQsPage = lazy(() => import('./pages/help/FAQsPage').then(m => ({ default: m.FAQsPage })));
const VideoTutorialsPage = lazy(() => import('./pages/help/VideoTutorialsPage').then(m => ({ default: m.VideoTutorialsPage })));
const MigrationGuidePage = lazy(() => import('./pages/help/MigrationGuidePage').then(m => ({ default: m.MigrationGuidePage })));

// Marketing pages (not under ProtectedRoute — need separate Suspense wrappers)
const MarketingLandingPage = lazy(() => import('./pages/marketing/LandingPage').then(m => ({ default: m.LandingPage })));
const PricingPage = lazy(() => import('./pages/marketing/PricingPage').then(m => ({ default: m.PricingPage })));
const PrivacyPage = lazy(() => import('./pages/marketing/PrivacyPage').then(m => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('./pages/marketing/TermsPage').then(m => ({ default: m.TermsPage })));
const ContactPage = lazy(() => import('./pages/marketing/ContactPage').then(m => ({ default: m.ContactPage })));

// Payroll
const EmployeesPageReal = lazy(() => import('./pages/payroll/EmployeesPage').then(m => ({ default: m.EmployeesPage })));
const PayrollRunsPage = lazy(() => import('./pages/payroll/PayrollRunsPage').then(m => ({ default: m.PayrollRunsPage })));
const PayeSchedulesPage = lazy(() => import('./pages/payroll/PayeSchedulesPage').then(m => ({ default: m.PayeSchedulesPage })));
const PensionSchedulesPage = lazy(() => import('./pages/payroll/PensionSchedulesPage').then(m => ({ default: m.PensionSchedulesPage })));
const PayslipsPage = lazy(() => import('./pages/payroll/PayslipsPage').then(m => ({ default: m.PayslipsPage })));

// =========================================================================
// 1. COMPATIBLE ADAPTERS FOR BESPOKE NAVIGATION HANDLERS
// =========================================================================

function InvoiceListWrapper() {
  const navigate = useNavigate();
  return (
    <Suspense fallback={<PageLoader />}>
      <InvoiceList 
        onNavigate={(viewId, id) => {
          if (viewId === 'invoice-form') {
            navigate('/app/sales/invoices/new');
          } else if (viewId === 'edit-invoice' && id) {
            navigate(`/app/sales/invoices/${id}/edit`);
          } else if (viewId === 'invoice-detail' && id) {
            navigate(`/app/sales/invoices/${id}`);
          } else {
            navigate('/app/dashboard');
          }
        }} 
      />
    </Suspense>
  );
}

function InvoiceFormWrapper() {
  const navigate = useNavigate();
  const { id } = useParams();
  return (
    <Suspense fallback={<PageLoader />}>
      <InvoiceForm 
        invoiceId={id} 
        onNavigate={(viewId) => {
          navigate('/app/sales/invoices');
        }} 
      />
    </Suspense>
  );
}

function InvoiceDetailWrapper() {
  const navigate = useNavigate();
  const { id } = useParams();
  return (
    <Suspense fallback={<PageLoader />}>
      <InvoiceDetail 
        invoiceId={id!} 
        onNavigate={(viewId, targetId) => {
          if (viewId === 'invoices') {
            navigate('/app/sales/invoices');
          } else if (viewId === 'edit-invoice' && targetId) {
            navigate(`/app/sales/invoices/${targetId}/edit`);
          } else if (viewId === 'invoice-detail' && targetId) {
            navigate(`/app/sales/invoices/${targetId}`);
          } else {
            navigate('/app/dashboard');
          }
        }} 
      />
    </Suspense>
  );
}

function BankAccountsWrapper() {
  const navigate = useNavigate();
  return (
    <Suspense fallback={<PageLoader />}>
      <BankAccounts 
        onNavigate={(viewScope, accountId) => {
          if (viewScope === 'reconciliation' && accountId) {
            navigate(`/app/banking/reconciliation/${accountId}`);
          } else {
            navigate('/app/banking/rules');
          }
        }} 
      />
    </Suspense>
  );
}

function ReconciliationWrapper() {
  const { accountId } = useParams();
  const navigate = useNavigate();
  return (
    <Suspense fallback={<PageLoader />}>
      <Reconciliation 
        initialAccountId={accountId || ''} 
        onNavigateHome={() => navigate('/app/banking')} 
      />
    </Suspense>
  );
}

// =========================================================================
// 2. SECURITY GATES & ROUTE PROTECTION
// =========================================================================

function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans font-bold text-xs text-slate-400 select-none uppercase tracking-widest">
        Verifying Security Vault...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

function RequireRoleRoute({ roles }: { roles: string[] }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans font-bold text-xs text-slate-400 select-none uppercase tracking-widest">
        Verifying Security Vault...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <Outlet />;
}

// =========================================================================
// 3. CENTRAL APP ROOT & ROUTER WIRE
// =========================================================================

function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#082F49] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-400 font-medium">Loading...</span>
      </div>
    </div>
  );
}

function LazyRoute({ element }: { element: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{element}</Suspense>;
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Marketing Website (root) ── */}
        <Route path="/" element={<LazyRoute element={<MarketingLandingPage />} />} />
        <Route path="/pricing" element={<LazyRoute element={<PricingPage />} />} />
        <Route path="/privacy" element={<LazyRoute element={<PrivacyPage />} />} />
        <Route path="/terms" element={<LazyRoute element={<TermsPage />} />} />
        <Route path="/contact" element={<LazyRoute element={<ContactPage />} />} />

        {/* ── Authentication ── */}
        <Route path="/auth/login" element={<LazyRoute element={<LoginPage />} />} />
        <Route path="/auth/register" element={<LazyRoute element={<RegisterPage />} />} />
        <Route path="/auth/forgot-password" element={<LazyRoute element={<ForgotPasswordPage />} />} />
        <Route path="/auth/reset-password" element={<LazyRoute element={<ResetPasswordPage />} />} />
        <Route path="/auth/accept-invite" element={<LazyRoute element={<AcceptInvitePage />} />} />

        {/* ── Accounting Application ── */}
        <Route path="/app" element={<ProtectedRoute />}>
          <Route path="dashboard" element={<LazyRoute element={<Dashboard onNavigate={() => {}} />} />} />

          {/* Module root redirects (for breadcrumb parent links) */}
          <Route path="ai" element={<Navigate to="/app/ai/assistant" replace />} />
          <Route path="sales" element={<Navigate to="/app/sales/invoices" replace />} />
          <Route path="purchases" element={<Navigate to="/app/purchases/bills" replace />} />
          <Route path="inventory" element={<Navigate to="/app/inventory/items" replace />} />
          <Route path="payroll" element={<Navigate to="/app/payroll/employees" replace />} />
          <Route path="accountant" element={<Navigate to="/app/accountant/journals" replace />} />
          <Route path="reports" element={<Navigate to="/app/reports/trial-balance" replace />} />
          <Route path="revenue" element={<Navigate to="/app/revenue/contracts" replace />} />

          <Route path="ai/assistant" element={<LazyRoute element={<AccountingAssistant />} />} />
          <Route path="ai/nvidia" element={<LazyRoute element={<NvidiaAiPage />} />} />
          
          {/* Sales module routing */}
          <Route path="sales/customers" element={<LazyRoute element={<CustomersPage />} />} />
          <Route path="sales/customers/:id" element={<LazyRoute element={<CustomersPage />} />} />
          <Route path="sales/quotes" element={<LazyRoute element={<QuotesPage />} />} />
          <Route path="sales/quotes/new" element={<LazyRoute element={<QuotesPage />} />} />
          <Route path="sales/quotes/:id" element={<LazyRoute element={<QuotesPage />} />} />
          <Route path="sales/invoices" element={<InvoiceListWrapper />} />
          <Route path="sales/invoices/new" element={<InvoiceFormWrapper />} />
          <Route path="sales/invoices/:id" element={<InvoiceDetailWrapper />} />
          <Route path="sales/invoices/:id/edit" element={<InvoiceFormWrapper />} />
          <Route path="sales/payments" element={<LazyRoute element={<PaymentsPage />} />} />
          <Route path="sales/credit-notes" element={<LazyRoute element={<CreditNotesPage />} />} />
          <Route path="sales/sales-orders" element={<LazyRoute element={<SalesOrdersPage />} />} />
          <Route path="sales/receipts" element={<LazyRoute element={<ReceiptsPage />} />} />
          <Route path="sales/recurring-invoices" element={<LazyRoute element={<RecurringInvoicesPage />} />} />

          {/* Purchases module routing */}
          <Route path="purchases/vendors" element={<LazyRoute element={<VendorsPage />} />} />
          <Route path="purchases/vendors/:id" element={<LazyRoute element={<VendorsPage />} />} />
          <Route path="purchases/expenses" element={<LazyRoute element={<ExpensesPage />} />} />
          <Route path="purchases/expenses/new" element={<LazyRoute element={<ExpensesPage />} />} />
          <Route path="purchases/bills" element={<LazyRoute element={<BillsPage />} />} />
          <Route path="purchases/bills/new" element={<LazyRoute element={<BillsPage />} />} />
          <Route path="purchases/bills/:id" element={<LazyRoute element={<BillsPage />} />} />
          <Route path="purchases/payments-made" element={<LazyRoute element={<PaymentsMadePage />} />} />
          <Route path="purchases/recurring-expenses" element={<LazyRoute element={<RecurringExpensesPage />} />} />
          <Route path="purchases/purchase-orders" element={<LazyRoute element={<PurchaseOrdersPage />} />} />
          <Route path="purchases/recurring-bills" element={<LazyRoute element={<RecurringBillsPage />} />} />
          <Route path="purchases/credit-notes" element={<LazyRoute element={<PurchaseCreditNotesPage />} />} />

          {/* Projects module routing */}
          <Route path="projects" element={<LazyRoute element={<ProjectsPage />} />} />
          <Route path="projects/:id" element={<LazyRoute element={<ProjectDetailPage />} />} />

          {/* Inventory module routing */}
          <Route path="inventory/items" element={<LazyRoute element={<InventoryPage />} />} />
          <Route path="inventory/items/new" element={<LazyRoute element={<InventoryPage />} />} />
          <Route path="inventory/adjustments" element={<LazyRoute element={<InventoryAdjustmentsPage />} />} />
          <Route path="inventory/management" element={<LazyRoute element={<InventoryManagementPage />} />} />

          {/* Banking module routing */}
          <Route path="banking" element={<BankAccountsWrapper />} />
          <Route path="banking/reconciliation/:accountId" element={<ReconciliationWrapper />} />
          <Route path="banking/connections" element={<LazyRoute element={<BankConnectionsPage />} />} />
          <Route path="banking/payment-gateway" element={<LazyRoute element={<PaymentGatewayPage />} />} />
          <Route path="banking/rules" element={<LazyRoute element={<BankRules />} />} />
          <Route path="banking/currency-rates" element={<LazyRoute element={<CurrencyRatesPage />} />} />
          <Route path="banking/transfers" element={<LazyRoute element={<TransfersPage />} />} />

          {/* Payroll module routing */}
          <Route path="payroll/employees" element={<LazyRoute element={<EmployeesPageReal />} />} />
          <Route path="payroll/runs" element={<LazyRoute element={<PayrollRunsPage />} />} />
          <Route path="payroll/runs/:id" element={<LazyRoute element={<PayrollRunsPage />} />} />
          <Route path="payroll/paye-schedules" element={<LazyRoute element={<PayeSchedulesPage />} />} />
          <Route path="payroll/pension-schedules" element={<LazyRoute element={<PensionSchedulesPage />} />} />
          <Route path="payroll/payslips" element={<LazyRoute element={<PayslipsPage />} />} />

          {/* Accountant general ledger tools routing */}
          <Route path="accountant/chart-of-accounts" element={<LazyRoute element={<ChartOfAccountsPage />} />} />
          <Route path="accountant/journals" element={<LazyRoute element={<JournalsPage />} />} />
          <Route path="accountant/journals/new" element={<LazyRoute element={<JournalsPage />} />} />
          <Route path="accountant/budgets" element={<LazyRoute element={<BudgetsPage />} />} />
          <Route path="accountant/fixed-assets" element={<LazyRoute element={<FixedAssetsPage />} />} />
          <Route path="accountant/fixed-assets/depreciation" element={<LazyRoute element={<DepreciationPage />} />} />
          <Route path="accountant/leases" element={<LazyRoute element={<LeasesPage />} />} />
          <Route path="accountant/ecl" element={<LazyRoute element={<EclPage />} />} />
          <Route path="accountant/ocr" element={<LazyRoute element={<OcrProcessingPage />} />} />
          <Route path="accountant/intercompany" element={<LazyRoute element={<IntercompanyTransactionsPage />} />} />

          {/* Financial statements & analytics reports */}
          <Route path="reports/trial-balance" element={<LazyRoute element={<TrialBalancePage />} />} />
          <Route path="reports/income-statement" element={<LazyRoute element={<IncomeStatementPage />} />} />
          <Route path="reports/balance-sheet" element={<LazyRoute element={<BalanceSheetPage />} />} />
          <Route path="reports/cash-flow" element={<LazyRoute element={<CashFlowPage />} />} />
          <Route path="reports/statement-of-changes-in-equity" element={<LazyRoute element={<StatementOfChangesInEquityPage />} />} />
          <Route path="reports/general-ledger" element={<LazyRoute element={<GeneralLedgerPage />} />} />
          <Route path="reports/vat-return" element={<LazyRoute element={<VATReturnPage />} />} />
          <Route path="reports/aged-receivables" element={<LazyRoute element={<AgedReceivablesPage />} />} />
          <Route path="reports/aged-payables" element={<LazyRoute element={<AgedPayablesPage />} />} />
          <Route element={<RequireRoleRoute roles={['owner', 'admin']} />}>
            <Route path="reports/audit-logs" element={<LazyRoute element={<AuditLogsPage />} />} />
          </Route>
          <Route path="reports/projects" element={<LazyRoute element={<ProjectsReportPage />} />} />
          <Route path="reports/tax-computation" element={<LazyRoute element={<TaxComputationPage />} />} />
          <Route path="reports/tax-engine" element={<LazyRoute element={<TaxEnginePage />} />} />
          <Route path="reports/custom" element={<LazyRoute element={<CustomReportsPage />} />} />
          <Route path="reports/legacy" element={<LazyRoute element={<LegacyMigrationPage />} />} />
          <Route path="reports/consolidation" element={<LazyRoute element={<ConsolidationReportsPage />} />} />
          <Route path="reports/notes" element={<LazyRoute element={<NotesPage />} />} />
          <Route path="reports/mappings" element={<LazyRoute element={<MappingsPage />} />} />
          <Route path="revenue/contracts" element={<LazyRoute element={<RevenueContractsPage />} />} />
          <Route path="revenue/recognition-report" element={<LazyRoute element={<RevenueRecognitionReport />} />} />

          {/* Subscription routes */}
          <Route path="subscription" element={<LazyRoute element={<SubscriptionPage />} />} />
          <Route path="subscription/plans" element={<LazyRoute element={<SubscriptionPlansPage />} />} />
          <Route path="subscription/coupons" element={<LazyRoute element={<SubscriptionCouponsPage />} />} />
          <Route path="subscription/portal" element={<LazyRoute element={<SubscriptionPortalPage />} />} />
          <Route path="subscription/addons" element={<LazyRoute element={<AddonMarketplacePage />} />} />
          <Route path="reports/usage-monitor" element={<LazyRoute element={<UsageMonitorDashboardPage />} />} />

          {/* System metadata & account preferences */}
          <Route path="settings" element={<Suspense fallback={<PageLoader />}><SettingsLayout /></Suspense>}>
            <Route index element={<Navigate to="/app/settings/organisation" replace />} />
            <Route path="organisation" element={<LazyRoute element={<OrganisationProfilePage />} />} />
            <Route path="branding" element={<LazyRoute element={<BrandingPage />} />} />
            <Route path="domain" element={<LazyRoute element={<CustomDomainPage />} />} />
            <Route path="locations" element={<LazyRoute element={<LocationsPage />} />} />
            <Route path="users" element={<LazyRoute element={<UsersPage />} />} />
            <Route path="roles" element={<LazyRoute element={<RolesPage />} />} />
            <Route path="user-preferences" element={<LazyRoute element={<UserPreferencesPage />} />} />
            <Route path="general" element={<LazyRoute element={<GeneralPage />} />} />
            <Route path="currencies" element={<LazyRoute element={<CurrenciesPage />} />} />
            <Route path="payment-terms" element={<LazyRoute element={<PaymentTermsPage />} />} />
            <Route path="opening-balances" element={<LazyRoute element={<OpeningBalancesPage />} />} />
            <Route path="reminders" element={<LazyRoute element={<RemindersPage />} />} />
            <Route path="customer-portal" element={<LazyRoute element={<CustomerPortalPage />} />} />
            <Route path="vendor-portal" element={<LazyRoute element={<VendorPortalPage />} />} />
            <Route path="txn-numbering" element={<LazyRoute element={<TxnNumberingPage />} />} />
            <Route path="pdf-templates" element={<LazyRoute element={<PdfTemplatesPage />} />} />
            <Route path="email-notifications" element={<LazyRoute element={<EmailNotificationsPage />} />} />
            <Route path="email-settings" element={<LazyRoute element={<EmailSettingsPage />} />} />
            <Route path="billing" element={<LazyRoute element={<BillingSettingsPage />} />} />
            <Route path="reporting-tags" element={<LazyRoute element={<ReportingTagsPage />} />} />
            <Route path="web-tabs" element={<LazyRoute element={<WebTabsPage />} />} />
            <Route path="workflow-rules" element={<LazyRoute element={<WorkflowRulesPage />} />} />
            <Route path="workflow-actions" element={<LazyRoute element={<WorkflowActionsPage />} />} />
            <Route path="workflow-logs" element={<LazyRoute element={<WorkflowLogsPage />} />} />
            <Route path="schedules" element={<LazyRoute element={<SchedulesPage />} />} />
            <Route path="taxes" element={<LazyRoute element={<TaxesPage />} />} />
            <Route path="tax" element={<LazyRoute element={<TaxConfigurationPage />} />} />
            <Route path="posting-rules" element={<LazyRoute element={<PostingRulesPage />} />} />
            <Route path="approval-workflows" element={<LazyRoute element={<ApprovalWorkflowsPage />} />} />
            <Route path="groups" element={<LazyRoute element={<GroupManagementPage />} />} />
            <Route path="contacts" element={<LazyRoute element={<ContactsSettingsPage />} />} />
            <Route path="items" element={<LazyRoute element={<ItemsSettingsPage />} />} />
            <Route path="revenue-recognition" element={<LazyRoute element={<RevenueRecognitionPage />} />} />
            <Route path="accountant" element={<LazyRoute element={<AccountantSettingsPage />} />} />
            <Route path="tasks" element={<LazyRoute element={<TasksSettingsPage />} />} />
            <Route path="projects" element={<LazyRoute element={<ProjectsSettingsPage />} />} />
            <Route path="timesheet" element={<LazyRoute element={<TimesheetSettingsPage />} />} />
            <Route path="inventory-adjustments" element={<LazyRoute element={<SettingsInventoryAdjustmentsPage />} />} />
            <Route path="payment-gateways" element={<LazyRoute element={<SettingsPaymentGatewaysPage />} />} />
            <Route path="quotes" element={<LazyRoute element={<QuotesSettingsPage />} />} />
            <Route path="sales-orders" element={<LazyRoute element={<SalesOrdersSettingsPage />} />} />
            <Route path="invoices" element={<LazyRoute element={<InvoicesSettingsPage />} />} />
            <Route path="recurring-invoices" element={<LazyRoute element={<RecurringInvoicesSettingsPage />} />} />
            <Route path="sales-receipts" element={<LazyRoute element={<SalesReceiptsSettingsPage />} />} />
            <Route path="payments-received" element={<LazyRoute element={<PaymentsReceivedSettingsPage />} />} />
            <Route path="credit-notes" element={<LazyRoute element={<CreditNotesSettingsPage />} />} />
            <Route path="delivery-notes" element={<LazyRoute element={<DeliveryNotesSettingsPage />} />} />
            <Route path="packing-slips" element={<LazyRoute element={<PackingSlipsSettingsPage />} />} />
            <Route path="expenses" element={<LazyRoute element={<ExpensesSettingsPage />} />} />
            <Route path="recurring-expenses" element={<LazyRoute element={<RecurringExpensesSettingsPage />} />} />
            <Route path="purchase-orders" element={<LazyRoute element={<PurchaseOrdersSettingsPage />} />} />
            <Route path="bills" element={<LazyRoute element={<BillsSettingsPage />} />} />
            <Route path="recurring-bills" element={<LazyRoute element={<RecurringBillsSettingsPage />} />} />
            <Route path="payments-made" element={<LazyRoute element={<PaymentsMadeSettingsPage />} />} />
            <Route path="vendor-credits" element={<LazyRoute element={<VendorCreditsSettingsPage />} />} />
            <Route path="custom-modules" element={<LazyRoute element={<CustomModulesPage />} />} />
            <Route path="feature-flags" element={<LazyRoute element={<FeatureFlagsPage />} />} />
            <Route path="feature-flags/plans" element={<LazyRoute element={<PlanFeatureFlagsPage />} />} />
          </Route>
          <Route path="settings/invites" element={<LazyRoute element={<InvitesSettingsPage />} />} />
          <Route path="settings/integrations" element={<LazyRoute element={<IntegrationsSettingsPage />} />} />
        </Route>

        {/* ── Help & Support (public) ── */}
          <Route path="/help/documents" element={<LazyRoute element={<HelpDocumentsPage />} />} />
          <Route path="/help/faqs" element={<LazyRoute element={<FAQsPage />} />} />
          <Route path="/help/videos" element={<LazyRoute element={<VideoTutorialsPage />} />} />
          <Route path="/help/migration-guide" element={<LazyRoute element={<MigrationGuidePage />} />} />
          <Route path="/help" element={<Navigate to="/help/documents" replace />} />

        {/* Unmatched — 404 */}
        <Route path="*" element={<LazyRoute element={<NotFoundPage />} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <ChatProvider>
              <Suspense fallback={<PageLoader />}>
                <AppRoutes />
              </Suspense>
            </ChatProvider>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
