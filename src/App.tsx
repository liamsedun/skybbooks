/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, Outlet } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/api';

// Layout & Custom Pages
import AppLayout from './components/layout/AppLayout';
import { Dashboard } from './pages/Dashboard';
import InsightsDashboard from './pages/ai/InsightsDashboard';

// Sales Pages
import { InvoiceList } from './pages/sales/InvoiceList';
import { InvoiceForm } from './pages/sales/InvoiceForm';
import { InvoiceDetail } from './pages/sales/InvoiceDetail';

// Banking Pages
import { BankAccounts } from './pages/banking/BankAccounts';
import { Reconciliation } from './pages/banking/Reconciliation';
import { BankRules } from './pages/banking/BankRules';

// Public & Protected Route Component Placeholders
import {
  import { LoginPage, RegisterPage, ForgotPasswordPage } from './pages/AuthPages';
,
  NotFoundPage,
  CustomersPage,
  QuotesPage,
  PaymentsPage,
  CreditNotesPage,
  VendorsPage,
  ExpensesPage,
  BillsPage,
  PaymentsMadePage,
  InventoryPage,
  EmployeesPage,
  PayrollRunsPage,
  ChartOfAccountsPage,
  JournalsPage,
  BudgetsPage,
  FixedAssetsPage,
  TrialBalancePage,
  IncomeStatementPage,
  BalanceSheetPage,
  CashFlowPage,
  AgedReceivablesPage,
  AgedPayablesPage,
  OrganisationSettingsPage,
  UsersSettingsPage,
  SalesOrdersPage,
  ReceiptsPage,
  RecurringInvoicesPage,
  RecurringExpensesPage,
  PurchaseOrdersPage,
  PayeSchedulesPage,
  PensionSchedulesPage,
  PayslipsPage,
  CurrencyRatesPage,
  AuditLogsPage,
  CustomReportsPage,
  InvitesSettingsPage,
  IntegrationsSettingsPage
} from './pages/ModulePlaceholders';

import { useAuth } from './hooks/useAuth';

// =========================================================================
// 1. COMPATIBLE ADAPTERS FOR BESPOKE NAVIGATION HANDLERS
// =========================================================================

function InvoiceListWrapper() {
  const navigate = useNavigate();
  return (
    <InvoiceList 
      onNavigate={(viewId, id) => {
        if (viewId === 'invoice-form') {
          navigate('/sales/invoices/new');
        } else if (viewId === 'edit-invoice' && id) {
          navigate(`/sales/invoices/${id}/edit`);
        } else if (viewId === 'invoice-detail' && id) {
          navigate(`/sales/invoices/${id}`);
        } else {
          navigate('/dashboard');
        }
      }} 
    />
  );
}

function InvoiceFormWrapper() {
  const navigate = useNavigate();
  const { id } = useParams();
  return (
    <InvoiceForm 
      invoiceId={id} 
      onNavigate={(viewId) => {
        navigate('/sales/invoices');
      }} 
    />
  );
}

function InvoiceDetailWrapper() {
  const navigate = useNavigate();
  const { id } = useParams();
  return (
    <InvoiceDetail 
      invoiceId={id!} 
      onNavigate={(viewId, targetId) => {
        if (viewId === 'invoices') {
          navigate('/sales/invoices');
        } else if (viewId === 'edit-invoice' && targetId) {
          navigate(`/sales/invoices/${targetId}/edit`);
        } else if (viewId === 'invoice-detail' && targetId) {
          navigate(`/sales/invoices/${targetId}`);
        } else {
          navigate('/dashboard');
        }
      }} 
    />
  );
}

function BankAccountsWrapper() {
  const navigate = useNavigate();
  return (
    <BankAccounts 
      onNavigate={(viewScope, accountId) => {
        if (viewScope === 'reconciliation' && accountId) {
          navigate(`/banking/reconciliation/${accountId}`);
        } else {
          navigate('/banking/rules');
        }
      }} 
    />
  );
}

function ReconciliationWrapper() {
  const { accountId } = useParams();
  const navigate = useNavigate();
  return (
    <Reconciliation 
      initialAccountId={accountId || ''} 
      onNavigateHome={() => navigate('/banking')} 
    />
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
    return <Navigate to="/login" replace />;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

// =========================================================================
// 3. CENTRAL APP ROOT & ROUTER WIRE
// =========================================================================

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public auth pages */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* Protected general ledger system */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard onNavigate={() => {}} />} />
          <Route path="/ai/insights" element={<InsightsDashboard />} />
          
          {/* Sales module routing */}
          <Route path="/sales/customers" element={<CustomersPage />} />
          <Route path="/sales/customers/:id" element={<CustomersPage />} />
          <Route path="/sales/quotes" element={<QuotesPage />} />
          <Route path="/sales/quotes/new" element={<QuotesPage />} />
          <Route path="/sales/quotes/:id" element={<QuotesPage />} />
          <Route path="/sales/invoices" element={<InvoiceListWrapper />} />
          <Route path="/sales/invoices/new" element={<InvoiceFormWrapper />} />
          <Route path="/sales/invoices/:id" element={<InvoiceDetailWrapper />} />
          <Route path="/sales/invoices/:id/edit" element={<InvoiceFormWrapper />} />
          <Route path="/sales/payments" element={<PaymentsPage />} />
          <Route path="/sales/credit-notes" element={<CreditNotesPage />} />
          <Route path="/sales/sales-orders" element={<SalesOrdersPage />} />
          <Route path="/sales/receipts" element={<ReceiptsPage />} />
          <Route path="/sales/recurring-invoices" element={<RecurringInvoicesPage />} />

          {/* Purchases module routing */}
          <Route path="/purchases/vendors" element={<VendorsPage />} />
          <Route path="/purchases/vendors/:id" element={<VendorsPage />} />
          <Route path="/purchases/expenses" element={<ExpensesPage />} />
          <Route path="/purchases/expenses/new" element={<ExpensesPage />} />
          <Route path="/purchases/bills" element={<BillsPage />} />
          <Route path="/purchases/bills/new" element={<BillsPage />} />
          <Route path="/purchases/bills/:id" element={<BillsPage />} />
          <Route path="/purchases/payments-made" element={<PaymentsMadePage />} />
          <Route path="/purchases/recurring-expenses" element={<RecurringExpensesPage />} />
          <Route path="/purchases/purchase-orders" element={<PurchaseOrdersPage />} />

          {/* Inventory module routing */}
          <Route path="/inventory/items" element={<InventoryPage />} />
          <Route path="/inventory/items/new" element={<InventoryPage />} />

          {/* Banking module routing */}
          <Route path="/banking" element={<BankAccountsWrapper />} />
          <Route path="/banking/reconciliation/:accountId" element={<ReconciliationWrapper />} />
          <Route path="/banking/rules" element={<BankRules />} />
          <Route path="/banking/currency-rates" element={<CurrencyRatesPage />} />

          {/* Payroll module routing */}
          <Route path="/payroll/employees" element={<EmployeesPage />} />
          <Route path="/payroll/runs" element={<PayrollRunsPage />} />
          <Route path="/payroll/runs/:id" element={<PayrollRunsPage />} />
          <Route path="/payroll/paye-schedules" element={<PayeSchedulesPage />} />
          <Route path="/payroll/pension-schedules" element={<PensionSchedulesPage />} />
          <Route path="/payroll/payslips" element={<PayslipsPage />} />

          {/* Accountant general ledger tools routing */}
          <Route path="/accountant/chart-of-accounts" element={<ChartOfAccountsPage />} />
          <Route path="/accountant/journals" element={<JournalsPage />} />
          <Route path="/accountant/journals/new" element={<JournalsPage />} />
          <Route path="/accountant/budgets" element={<BudgetsPage />} />
          <Route path="/accountant/fixed-assets" element={<FixedAssetsPage />} />

          {/* Financial statements & analytics reports */}
          <Route path="/reports/trial-balance" element={<TrialBalancePage />} />
          <Route path="/reports/income-statement" element={<IncomeStatementPage />} />
          <Route path="/reports/balance-sheet" element={<BalanceSheetPage />} />
          <Route path="/reports/cash-flow" element={<CashFlowPage />} />
          <Route path="/reports/aged-receivables" element={<AgedReceivablesPage />} />
          <Route path="/reports/aged-payables" element={<AgedPayablesPage />} />
          <Route path="/reports/audit-logs" element={<AuditLogsPage />} />
          <Route path="/reports/custom" element={<CustomReportsPage />} />

          {/* System metadata & account preferences */}
          <Route path="/settings/organisation" element={<OrganisationSettingsPage />} />
          <Route path="/settings/users" element={<UsersSettingsPage />} />
          <Route path="/settings/invites" element={<InvitesSettingsPage />} />
          <Route path="/settings/integrations" element={<IntegrationsSettingsPage />} />
        </Route>

        {/* Unmatched wildcard route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRoutes />
    </QueryClientProvider>
  );
}
