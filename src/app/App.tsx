import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, Outlet, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/api';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';

import { ChatProvider } from '../contexts/ChatContext';
import { ThemeProvider } from '../context/ThemeContext';
import { ToastProvider } from '../contexts/ToastContext';

import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../hooks/useAuth';
import { RequireHrPermission } from '../components/hr/RequireHrPermission';

const Dashboard = lazy(() => import('../pages/Dashboard').then(m => ({ default: m.Dashboard })));
const AccountingAssistant = lazy(() => import('../pages/ai/AccountingAssistant').then(m => ({ default: m.AccountingAssistant })));
const NvidiaAiPage = lazy(() => import('../pages/ai/NvidiaAiPage').then(m => ({ default: m.NvidiaAiPage })));

const InvoiceList = lazy(() => import('../pages/sales/InvoiceList').then(m => ({ default: m.InvoiceList })));
const InvoiceForm = lazy(() => import('../pages/sales/InvoiceForm').then(m => ({ default: m.InvoiceForm })));
const InvoiceDetail = lazy(() => import('../pages/sales/InvoiceDetail').then(m => ({ default: m.InvoiceDetail })));
const RecurringInvoicesPage = lazy(() => import('../pages/sales/RecurringInvoices').then(m => ({ default: m.RecurringInvoicesPage })));
const CreditNotesPage = lazy(() => import('../pages/sales/CreditNotes').then(m => ({ default: m.CreditNotesPage })));

const BankAccounts = lazy(() => import('../pages/banking/BankAccounts').then(m => ({ default: m.BankAccounts })));
const Reconciliation = lazy(() => import('../pages/banking/Reconciliation').then(m => ({ default: m.Reconciliation })));
const BankRules = lazy(() => import('../pages/banking/BankRules').then(m => ({ default: m.BankRules })));
const TransfersPage = lazy(() => import('../pages/banking/TransfersPage').then(m => ({ default: m.TransfersPage })));
const BankConnectionsPage = lazy(() => import('../pages/banking/BankConnectionsPage').then(m => ({ default: m.BankConnectionsPage })));
const PaymentGatewayPage = lazy(() => import('../pages/banking/PaymentGatewayPage').then(m => ({ default: m.PaymentGatewayPage })));
const ProjectsPage = lazy(() => import('../pages/sales/ProjectsPage').then(m => ({ default: m.ProjectsPage })));
const ProjectDetailPage = lazy(() => import('../pages/sales/ProjectDetailPage').then(m => ({ default: m.ProjectDetailPage })));

const CustomersPage = lazy(() => import('../pages/sales/Customers').then(m => ({ default: m.CustomersPage })));
const QuotesPage = lazy(() => import('../pages/sales/Quotes').then(m => ({ default: m.QuotesPage })));
const PaymentsPage = lazy(() => import('../pages/sales/PaymentsReceived').then(m => ({ default: m.PaymentsReceivedPage })));
const VendorsPage = lazy(() => import('../pages/purchases/Vendors').then(m => ({ default: m.VendorsPage })));
const ExpensesPage = lazy(() => import('../pages/purchases/Expenses').then(m => ({ default: m.ExpensesPage })));
const BillsPage = lazy(() => import('../pages/purchases/Bills').then(m => ({ default: m.BillsPage })));
const PaymentsMadePage = lazy(() => import('../pages/purchases/PaymentsMade').then(m => ({ default: m.PaymentsMadePage })));
const InventoryPage = lazy(() => import('../pages/inventory/Items').then(m => ({ default: m.ItemsPage })));
const InventoryAdjustmentsPage = lazy(() => import('../pages/inventory/InventoryAdjustmentsPage'));
const InventoryManagementPage = lazy(() => import('../pages/inventory/InventoryManagementPage'));
const ChartOfAccountsPage = lazy(() => import('../pages/accountant/ChartOfAccounts').then(m => ({ default: m.ChartOfAccountsPage })));
const JournalsPage = lazy(() => import('../pages/accountant/JournalsPage').then(m => ({ default: m.JournalsPage })));
const BudgetsPage = lazy(() => import('../pages/accountant/BudgetsPage').then(m => ({ default: m.BudgetsPage })));
const FixedAssetsPage = lazy(() => import('../pages/accountant/FixedAssetsPage').then(m => ({ default: m.FixedAssetsPage })));
const DepreciationPage = lazy(() => import('../pages/accountant/DepreciationPage').then(m => ({ default: m.DepreciationPage })));
const LeasesPage = lazy(() => import('../pages/accountant/LeasesPage').then(m => ({ default: m.LeasesPage })));
const EclPage = lazy(() => import('../pages/accountant/EclPage').then(m => ({ default: m.EclPage })));
const TrialBalancePage = lazy(() => import('../pages/reports/ReportsPage').then(m => ({ default: m.TrialBalancePage })));
const IncomeStatementPage = lazy(() => import('../pages/reports/ReportsPage').then(m => ({ default: m.IncomeStatementPage })));
const BalanceSheetPage = lazy(() => import('../pages/reports/ReportsPage').then(m => ({ default: m.BalanceSheetPage })));
const CashFlowPage = lazy(() => import('../pages/reports/ReportsPage').then(m => ({ default: m.CashFlowPage })));
const StatementOfChangesInEquityPage = lazy(() => import('../pages/reports/ReportsPage').then(m => ({ default: m.StatementOfChangesInEquityPage })));
const GeneralLedgerPage = lazy(() => import('../pages/reports/ReportsPage').then(m => ({ default: m.GeneralLedgerPage })));
const VATReturnPage = lazy(() => import('../pages/reports/ReportsPage').then(m => ({ default: m.VATReturnPage })));
const AgedReceivablesPage = lazy(() => import('../pages/reports/ReportsPage').then(m => ({ default: m.AgedReceivablesPage })));
const AgedPayablesPage = lazy(() => import('../pages/reports/ReportsPage').then(m => ({ default: m.AgedPayablesPage })));
const SalesOrdersPage = lazy(() => import('../pages/sales/SalesOrders').then(m => ({ default: m.SalesOrdersPage })));
const ReceiptsPage = lazy(() => import('../pages/sales/PaymentsReceived').then(m => ({ default: m.PaymentsReceivedPage })));
const RecurringExpensesPage = lazy(() => import('../pages/purchases/RecurringExpenses').then(m => ({ default: m.RecurringExpensesPage })));
const PurchaseOrdersPage = lazy(() => import('../pages/purchases/PurchaseOrders').then(m => ({ default: m.PurchaseOrdersPage })));
const PurchaseCreditNotesPage = lazy(() => import('../pages/purchases/PurchaseCreditNotes').then(m => ({ default: m.PurchaseCreditNotesPage })));
const CurrencyRatesPage = lazy(() => import('../pages/banking/CurrencyRatesPage').then(m => ({ default: m.CurrencyRatesPage })));
const AuditLogsPage = lazy(() => import('../pages/reports/AuditLogsPage').then(m => ({ default: m.AuditLogsPage })));
const ProjectsReportPage = lazy(() => import('../pages/reports/ReportsPage').then(m => ({ default: m.ProjectsReportPage })));
const CustomReportsPage = lazy(() => import('../pages/reports/CustomReportsPage').then(m => ({ default: m.CustomReportsPage })));
const TaxComputationPage = lazy(() => import('../pages/reports/ReportsPage').then(m => ({ default: m.TaxComputationPage })));
const TaxEnginePage = lazy(() => import('../pages/tax/TaxEnginePage'));
const LegacyMigrationPage = lazy(() => import('../pages/reports/LegacyMigrationPage').then(m => ({ default: m.LegacyMigrationPage })));
const InvitesSettingsPage = lazy(() => import('../pages/settings/InvitesPage').then(m => ({ default: m.InvitesSettingsPage })));
const IntegrationsSettingsPage = lazy(() => import('../pages/settings/IntegrationsPage').then(m => ({ default: m.IntegrationsSettingsPage })));

const GroupManagementPage = lazy(() => import('../pages/settings/GroupManagementPage').then(m => ({ default: m.GroupManagementPage })));
const RecurringBillsPage = lazy(() => import('../pages/purchases/RecurringBillsPage').then(m => ({ default: m.RecurringBillsPage })));
const IntercompanyTransactionsPage = lazy(() => import('../pages/accountant/IntercompanyTransactionsPage').then(m => ({ default: m.IntercompanyTransactionsPage })));
const ConsolidationReportsPage = lazy(() => import('../pages/reports/ConsolidationReportsPage').then(m => ({ default: m.ConsolidationReportsPage })));
const SettingsLayout = lazy(() => import('../components/settings/SettingsLayout').then(m => ({ default: m.SettingsLayout })));
const TaxConfigurationPage = lazy(() => import('../pages/settings/TaxConfigurationPage').then(m => ({ default: m.TaxConfigurationPage })));
const NotesPage = lazy(() => import('../pages/reports/NotesPage').then(m => ({ default: m.NotesPage })));
const MappingsPage = lazy(() => import('../pages/reports/MappingsPage').then(m => ({ default: m.MappingsPage })));
const RevenueContractsPage = lazy(() => import('../pages/revenue/RevenueContractsPage').then(m => ({ default: m.RevenueContractsPage })));
const RevenueRecognitionReport = lazy(() => import('../pages/revenue/RevenueRecognitionReport').then(m => ({ default: m.RevenueRecognitionReport })));
const SupportTicketsPage = lazy(() => import('../pages/support/SupportTicketsPage').then(m => ({ default: m.SupportTicketsPage })));

const UsageMonitorDashboardPage = lazy(() => import('../pages/reports/UsageMonitorDashboardPage').then(m => ({ default: m.UsageMonitorDashboardPage })));

const OrganisationProfilePage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.OrganisationProfilePage })));
const BrandingPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.BrandingPage })));
const CustomDomainPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.CustomDomainPage })));
const LocationsPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.LocationsPage })));
const UsersPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.UsersPage })));
const RolesPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.RolesPage })));
const UserPreferencesPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.UserPreferencesPage })));
const CrmSettingsPage = lazy(() => import('../pages/settings/CrmSettingsPage').then(m => ({ default: m.CrmSettingsPage })));
const GeneralPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.GeneralPage })));
const CurrenciesPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.CurrenciesPage })));
const PaymentTermsPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.PaymentTermsPage })));
const OpeningBalancesPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.OpeningBalancesPage })));
const RemindersPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.RemindersPage })));
const CustomerPortalPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.CustomerPortalPage })));
const VendorPortalPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.VendorPortalPage })));
const TxnNumberingPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.TxnNumberingPage })));
const PdfTemplatesPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.PdfTemplatesPage })));
const EmailNotificationsPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.EmailNotificationsPage })));
const ReportingTagsPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.ReportingTagsPage })));
const WebTabsPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.WebTabsPage })));
const WorkflowRulesPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.WorkflowRulesPage })));
const WorkflowActionsPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.WorkflowActionsPage })));
const WorkflowLogsPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.WorkflowLogsPage })));
const SchedulesPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.SchedulesPage })));
const ContactsSettingsPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.ContactsSettingsPage })));
const ItemsSettingsPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.ItemsSettingsPage })));
const RevenueRecognitionPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.RevenueRecognitionPage })));
const AccountantSettingsPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.AccountantSettingsPage })));
const TasksSettingsPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.TasksSettingsPage })));
const ProjectsSettingsPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.ProjectsSettingsPage })));
const TimesheetSettingsPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.TimesheetSettingsPage })));
const SettingsInventoryAdjustmentsPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.InventoryAdjustmentsPage })));
const SettingsPaymentGatewaysPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.PaymentGatewaysPage })));
const QuotesSettingsPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.QuotesSettingsPage })));
const SalesOrdersSettingsPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.SalesOrdersSettingsPage })));
const InvoicesSettingsPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.InvoicesSettingsPage })));
const RecurringInvoicesSettingsPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.RecurringInvoicesSettingsPage })));
const SalesReceiptsSettingsPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.SalesReceiptsSettingsPage })));
const PaymentsReceivedSettingsPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.PaymentsReceivedSettingsPage })));
const CreditNotesSettingsPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.CreditNotesSettingsPage })));
const DeliveryNotesSettingsPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.DeliveryNotesSettingsPage })));
const PackingSlipsSettingsPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.PackingSlipsSettingsPage })));
const ExpensesSettingsPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.ExpensesSettingsPage })));
const RecurringExpensesSettingsPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.RecurringExpensesSettingsPage })));
const PurchaseOrdersSettingsPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.PurchaseOrdersSettingsPage })));
const BillsSettingsPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.BillsSettingsPage })));
const RecurringBillsSettingsPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.RecurringBillsSettingsPage })));
const PaymentsMadeSettingsPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.PaymentsMadeSettingsPage })));
const VendorCreditsSettingsPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.VendorCreditsSettingsPage })));
const CustomModulesPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.CustomModulesPage })));
const TaxesPage = lazy(() => import('../pages/settings/SettingsPages').then(m => ({ default: m.TaxesPage })));

const EmailSettingsPage = lazy(() => import('../pages/settings/EmailSettingsPage'));
const PostingRulesPage = lazy(() => import('../pages/settings/PostingRulesPage'));
const ApprovalWorkflowsPage = lazy(() => import('../pages/settings/ApprovalWorkflowsPage'));
const FeatureFlagsPage = lazy(() => import('../pages/settings/FeatureFlagsPage').then(m => ({ default: m.FeatureFlagsPage })));
const CustomerSubscriptionPage = lazy(() => import('../pages/settings/CustomerSubscriptionPage').then(m => ({ default: m.CustomerSubscriptionPage })));

const OcrProcessingPage = lazy(() => import('../pages/accountant/OcrProcessingPage').then(m => ({ default: m.OcrProcessingPage })));

const CrmDashboard = lazy(() => import('../pages/crm/CrmDashboard').then(m => ({ default: m.CrmDashboard })));
const DealsPipeline = lazy(() => import('../pages/crm/DealsPipeline').then(m => ({ default: m.DealsPipeline })));
const DealsTable = lazy(() => import('../pages/crm/DealsTable').then(m => ({ default: m.DealsTable })));
const CrmContactsPage = lazy(() => import('../pages/crm/CrmContactsPage').then(m => ({ default: m.CrmContactsPage })));
const ActivitiesPage = lazy(() => import('../pages/crm/ActivitiesPage').then(m => ({ default: m.ActivitiesPage })));

const HrDashboardPage = lazy(() => import('../pages/hr/employees/HrDashboardPage').then(m => ({ default: m.HrDashboardPage })));
const ManageSkyHRMPage = lazy(() => import('../pages/hr/ManageSkyHRMPage').then(m => ({ default: m.ManageSkyHRMPage })));
const HomeLayout = lazy(() => import('../pages/hr/home/HomeLayout').then(m => ({ default: m.HomeLayout })));
const HomeOverviewPage = lazy(() => import('../pages/hr/home/HomeOverviewPage').then(m => ({ default: m.HomeOverviewPage })));
const HomeDashboardPage = lazy(() => import('../pages/hr/home/HomeDashboardPage').then(m => ({ default: m.HomeDashboardPage })));
const HomeCalendarPage = lazy(() => import('../pages/hr/home/HomeCalendarPage').then(m => ({ default: m.HomeCalendarPage })));
const HomeDelegationPage = lazy(() => import('../pages/hr/home/HomeDelegationPage').then(m => ({ default: m.HomeDelegationPage })));
const ServicesLayout = lazy(() => import('../pages/hr/services/ServicesLayout').then(m => ({ default: m.ServicesLayout })));
const PreferencesPage = lazy(() => import('../pages/hr/services/PreferencesPage').then(m => ({ default: m.PreferencesPage })));
const HrServicesPerformancePage = lazy(() => import('../pages/hr/services/PerformancePage').then(m => ({ default: m.PerformancePage })));
const HrServicesFilesPage = lazy(() => import('../pages/hr/services/FilesPage').then(m => ({ default: m.FilesPage })));
const EmployeeEngagementPage = lazy(() => import('../pages/hr/services/EmployeeEngagementPage').then(m => ({ default: m.EmployeeEngagementPage })));
const HRLettersPage = lazy(() => import('../pages/hr/services/HRLettersPage').then(m => ({ default: m.HRLettersPage })));
const HrServicesTravelPage = lazy(() => import('../pages/hr/services/TravelPage').then(m => ({ default: m.TravelPage })));
const HrServicesTasksPage = lazy(() => import('../pages/hr/services/TasksPage').then(m => ({ default: m.TasksPage })));
const HrServicesCompensationPage = lazy(() => import('../pages/hr/services/CompensationPage').then(m => ({ default: m.CompensationPage })));
const HrServicesGeneralPage = lazy(() => import('../pages/hr/services/GeneralPage').then(m => ({ default: m.GeneralPage })));
const OperationsLayout = lazy(() => import('../pages/hr/operations/OperationsLayout').then(m => ({ default: m.OperationsLayout })));
const OpsServicesPage = lazy(() => import('../pages/hr/operations/ServicesPage').then(m => ({ default: m.OpsServicesPage })));
const OpsOnboardingPage = lazy(() => import('../pages/hr/operations/OnboardingPage').then(m => ({ default: m.OpsOnboardingPage })));
const OpsEmployeeInformationPage = lazy(() => import('../pages/hr/operations/EmployeeInformationPage').then(m => ({ default: m.OpsEmployeeInformationPage })));
const OpsLeaveTrackerPage = lazy(() => import('../pages/hr/operations/LeaveTrackerPage').then(m => ({ default: m.OpsLeaveTrackerPage })));
const OpsAttendancePage = lazy(() => import('../pages/hr/operations/AttendancePage').then(m => ({ default: m.OpsAttendancePage })));
const OpsShiftPage = lazy(() => import('../pages/hr/operations/ShiftPage').then(m => ({ default: m.OpsShiftPage })));
const OpsTimeTrackerPage = lazy(() => import('../pages/hr/operations/TimeTrackerPage').then(m => ({ default: m.OpsTimeTrackerPage })));
const OpsPerformancePage = lazy(() => import('../pages/hr/operations/PerformancePage').then(m => ({ default: m.OpsPerformancePage })));
const OpsFilesPage = lazy(() => import('../pages/hr/operations/FilesPage').then(m => ({ default: m.OpsFilesPage })));
const OpsEmployeeEngagementPage = lazy(() => import('../pages/hr/operations/EmployeeEngagementPage').then(m => ({ default: m.OpsEmployeeEngagementPage })));
const OpsHRLettersPage = lazy(() => import('../pages/hr/operations/HRLettersPage').then(m => ({ default: m.OpsHRLettersPage })));
const OpsTravelPage = lazy(() => import('../pages/hr/operations/TravelPage').then(m => ({ default: m.OpsTravelPage })));
const OpsTasksPage = lazy(() => import('../pages/hr/operations/TasksPage').then(m => ({ default: m.OpsTasksPage })));
const OpsGeneralPage = lazy(() => import('../pages/hr/operations/GeneralPage').then(m => ({ default: m.OpsGeneralPage })));
const OpsOffboardingPage = lazy(() => import('../pages/hr/operations/OffboardingPage').then(m => ({ default: m.OpsOffboardingPage })));
const OpsOKRPage = lazy(() => import('../pages/hr/operations/OKRPage').then(m => ({ default: m.OpsOKRPage })));
const OpsApprovalsPage = lazy(() => import('../pages/hr/operations/ApprovalsPage').then(m => ({ default: m.OpsApprovalsPage })));
const OpsDataAdministrationPage = lazy(() => import('../pages/hr/operations/DataAdministrationPage').then(m => ({ default: m.OpsDataAdministrationPage })));
const ManageLayout = lazy(() => import('../pages/hr/manage/ManageLayout').then(m => ({ default: m.ManageLayout })));
const ManageUsersPage = lazy(() => import('../pages/hr/manage/UsersPage').then(m => ({ default: m.UsersPage })));
const EmployeeProfilesPage = lazy(() => import('../pages/hr/manage/EmployeeProfilesPage').then(m => ({ default: m.EmployeeProfilesPage })));
const OrganisationSection = lazy(() => import('../pages/hr/manage/OrganisationSection').then(m => ({ default: m.OrganisationSection })));
const UserAccessSection = lazy(() => import('../pages/hr/manage/UserAccessSection').then(m => ({ default: m.UserAccessSection })));
const ApprovalsSection = lazy(() => import('../pages/hr/manage/ApprovalsSection').then(m => ({ default: m.ApprovalsSection })));
const ServicesSection = lazy(() => import('../pages/hr/manage/ServicesSection').then(m => ({ default: m.ServicesSection })));
const EmployeeList = lazy(() => import('../pages/hr/employees/EmployeeList').then(m => ({ default: m.EmployeeList })));
const EmployeeDetail = lazy(() => import('../pages/hr/employees/EmployeeDetail').then(m => ({ default: m.EmployeeDetail })));
const EmployeeForm = lazy(() => import('../pages/hr/employees/EmployeeForm').then(m => ({ default: m.EmployeeForm })));
const DepartmentsPage = lazy(() => import('../pages/hr/employees/DepartmentsPage').then(m => ({ default: m.DepartmentsPage })));
const DesignationsPage = lazy(() => import('../pages/hr/employees/DesignationsPage').then(m => ({ default: m.DesignationsPage })));
const LeaveLayout = lazy(() => import('../pages/hr/leave/LeaveLayout').then(m => ({ default: m.LeaveLayout })));
const LeaveSummaryPage = lazy(() => import('../pages/hr/leave/LeaveSummaryPage').then(m => ({ default: m.LeaveSummaryPage })));
const LeaveShiftPage = lazy(() => import('../pages/hr/leave/ShiftPage').then(m => ({ default: m.LeaveShiftPage })));
const LeaveRequestsPage = lazy(() => import('../pages/hr/leave/LeaveRequestsPage').then(m => ({ default: m.LeaveRequestsPage })));
const LeaveTypesPage = lazy(() => import('../pages/hr/leave/LeaveTypesPage').then(m => ({ default: m.LeaveTypesPage })));
const AttendanceLayout = lazy(() => import('../pages/hr/attendance/AttendanceLayout').then(m => ({ default: m.AttendanceLayout })));
const AttendanceSummaryPage = lazy(() => import('../pages/hr/attendance/AttendanceSummaryPage').then(m => ({ default: m.AttendanceSummaryPage })));
const AttendanceShiftPage = lazy(() => import('../pages/hr/attendance/ShiftPage').then(m => ({ default: m.AttendanceShiftPage })));
const ShiftsPage = lazy(() => import('../pages/hr/attendance/ShiftsPage').then(m => ({ default: m.ShiftsPage })));
const TimesheetsLayout = lazy(() => import('../pages/hr/time/TimesheetsLayout').then(m => ({ default: m.TimesheetsLayout })));
const TimeLogsPage = lazy(() => import('../pages/hr/time/TimeLogsPage').then(m => ({ default: m.TimeLogsPage })));
const TimesheetsListPage = lazy(() => import('../pages/hr/time/TimesheetsListPage').then(m => ({ default: m.TimesheetsListPage })));
const OnboardingLayout = lazy(() => import('../pages/hr/recruitment/OnboardingLayout').then(m => ({ default: m.OnboardingLayout })));
const AddCandidatePage = lazy(() => import('../pages/hr/recruitment/AddCandidatePage').then(m => ({ default: m.AddCandidatePage })));
const JobOpeningsPage = lazy(() => import('../pages/hr/recruitment/JobOpeningsPage').then(m => ({ default: m.JobOpeningsPage })));
const CandidatesPage = lazy(() => import('../pages/hr/recruitment/CandidatesPage').then(m => ({ default: m.CandidatesPage })));
const JobsPage = lazy(() => import('../pages/hr/JobsPage').then(m => ({ default: m.JobsPage })));
const HrProjectsPage = lazy(() => import('../pages/hr/ProjectsPage').then(m => ({ default: m.ProjectsPage })));
const JobSchedulePage = lazy(() => import('../pages/hr/JobSchedulePage').then(m => ({ default: m.JobSchedulePage })));
const PerformanceReviewsPage = lazy(() => import('../pages/hr/performance/PerformanceReviewsPage').then(m => ({ default: m.PerformanceReviewsPage })));
const CoursesPage = lazy(() => import('../pages/hr/courses/CoursesPage').then(m => ({ default: m.CoursesPage })));
const SurveysPage = lazy(() => import('../pages/hr/surveys/SurveysPage').then(m => ({ default: m.SurveysPage })));
const AnnouncementsPage = lazy(() => import('../pages/hr/announcements/AnnouncementsPage').then(m => ({ default: m.AnnouncementsPage })));
const RecognitionPage = lazy(() => import('../pages/hr/recognition/RecognitionPage').then(m => ({ default: m.RecognitionPage })));
const GoalsPage = lazy(() => import('../pages/hr/goals/GoalsPage').then(m => ({ default: m.GoalsPage })));
const LettersPage = lazy(() => import('../pages/hr/letters/LettersPage').then(m => ({ default: m.LettersPage })));
const LetterTemplatesPage = lazy(() => import('../pages/hr/letters/LetterTemplatesPage').then(m => ({ default: m.LetterTemplatesPage })));
const TravelRequestsPage = lazy(() => import('../pages/hr/travel/TravelRequestsPage').then(m => ({ default: m.TravelRequestsPage })));
const ExpenseReportsPage = lazy(() => import('../pages/hr/expenses/ExpenseReportsPage').then(m => ({ default: m.ExpenseReportsPage })));
const CompensationPage = lazy(() => import('../pages/hr/compensation/CompensationPage').then(m => ({ default: m.CompensationPage })));
const BenefitsPage = lazy(() => import('../pages/hr/compensation/BenefitsPage').then(m => ({ default: m.BenefitsPage })));
const TasksPage = lazy(() => import('../pages/hr/tasks/TasksPage').then(m => ({ default: m.TasksPage })));
const WorkflowsPage = lazy(() => import('../pages/hr/workflows/WorkflowsPage').then(m => ({ default: m.WorkflowsPage })));
const OffboardingPage = lazy(() => import('../pages/hr/offboarding/OffboardingPage').then(m => ({ default: m.OffboardingPage })));
const HelpDeskPage = lazy(() => import('../pages/hr/helpdesk/HelpDeskPage').then(m => ({ default: m.HelpDeskPage })));
const ApprovalsPage = lazy(() => import('../pages/hr/approvals/ApprovalsPage').then(m => ({ default: m.ApprovalsPage })));
const ReportsLayout = lazy(() => import('../pages/hr/reports/ReportsLayout').then(m => ({ default: m.ReportsLayout })));
const MyReportsPage = lazy(() => import('../pages/hr/reports/sub/MyReportsPage').then(m => ({ default: m.MyReportsPage })));
const ReportsEmployeeInformationPage = lazy(() => import('../pages/hr/reports/sub/EmployeeInformationPage').then(m => ({ default: m.ReportsEmployeeInformationPage })));
const CareerHistoryPage = lazy(() => import('../pages/hr/reports/sub/CareerHistoryPage').then(m => ({ default: m.CareerHistoryPage })));
const LeaveBalancePage = lazy(() => import('../pages/hr/reports/sub/LeaveBalancePage').then(m => ({ default: m.LeaveBalancePage })));
const ReportsAttendancePage = lazy(() => import('../pages/hr/reports/sub/AttendancePage').then(m => ({ default: m.ReportsAttendancePage })));
const EarlyCheckInPage = lazy(() => import('../pages/hr/reports/sub/EarlyCheckInPage').then(m => ({ default: m.EarlyCheckInPage })));
const LateCheckInPage = lazy(() => import('../pages/hr/reports/sub/LateCheckInPage').then(m => ({ default: m.LateCheckInPage })));
const EarlyCheckOutPage = lazy(() => import('../pages/hr/reports/sub/EarlyCheckOutPage').then(m => ({ default: m.EarlyCheckOutPage })));
const LateCheckOutPage = lazy(() => import('../pages/hr/reports/sub/LateCheckOutPage').then(m => ({ default: m.LateCheckOutPage })));
const PresenceHoursPage = lazy(() => import('../pages/hr/reports/sub/PresenceHoursPage').then(m => ({ default: m.PresenceHoursPage })));
const TeamReportsPage = lazy(() => import('../pages/hr/reports/sub/TeamReportsPage').then(m => ({ default: m.TeamReportsPage })));
const OrganizationReportsPage = lazy(() => import('../pages/hr/reports/sub/OrganizationReportsPage').then(m => ({ default: m.OrganizationReportsPage })));
const ReportsAnalyticsPage = lazy(() => import('../pages/hr/reports/sub/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const ReportsSchedulesPage = lazy(() => import('../pages/hr/reports/sub/SchedulesPage').then(m => ({ default: m.ReportsSchedulesPage })));
const PoliciesPage = lazy(() => import('../pages/hr/administration/PoliciesPage').then(m => ({ default: m.PoliciesPage })));
const HrSettingsPage = lazy(() => import('../pages/hr/administration/HrSettingsPage').then(m => ({ default: m.HrSettingsPage })));

const HelpDocumentsPage = lazy(() => import('../pages/help/HelpDocumentsPage').then(m => ({ default: m.HelpDocumentsPage })));
const FAQsPage = lazy(() => import('../pages/help/FAQsPage').then(m => ({ default: m.FAQsPage })));
const VideoTutorialsPage = lazy(() => import('../pages/help/VideoTutorialsPage').then(m => ({ default: m.VideoTutorialsPage })));
const MigrationGuidePage = lazy(() => import('../pages/help/MigrationGuidePage').then(m => ({ default: m.MigrationGuidePage })));
const HelpPage = lazy(() => import('../pages/help/HelpPage').then(m => ({ default: m.HelpPage })));

const EmployeesPageReal = lazy(() => import('../pages/payroll/EmployeesPage').then(m => ({ default: m.EmployeesPage })));
const PayrollRunsPage = lazy(() => import('../pages/payroll/PayrollRunsPage').then(m => ({ default: m.PayrollRunsPage })));
const PayeSchedulesPage = lazy(() => import('../pages/payroll/PayeSchedulesPage').then(m => ({ default: m.PayeSchedulesPage })));
const PensionSchedulesPage = lazy(() => import('../pages/payroll/PensionSchedulesPage').then(m => ({ default: m.PensionSchedulesPage })));
const PayslipsPage = lazy(() => import('../pages/payroll/PayslipsPage').then(m => ({ default: m.PayslipsPage })));

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

function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = '/login';
    }
  }, [isLoading, isAuthenticated, location.pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans font-bold text-xs text-slate-400 select-none uppercase tracking-widest">
        Verifying Security Vault...
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
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
    return <Navigate to="/login" replace />;
  }

  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <Outlet />;
}

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

type HrAction = 'hr:read' | 'hr:create' | 'hr:update' | 'hr:delete' | 'hr:approve' | 'hr:export' | 'hr:reports' | 'hr:admin' | 'hr:manage';

function HrGuard({ perm, children }: { perm: HrAction; children: React.ReactNode }) {
  return <RequireHrPermission permission={perm}>{children}</RequireHrPermission>;
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/app" element={<ProtectedRoute />}>
          <Route path="dashboard" element={<LazyRoute element={<Dashboard onNavigate={() => {}} />} />} />

          <Route path="ai" element={<Navigate to="/app/ai/assistant" replace />} />
          <Route path="sales" element={<Navigate to="/app/sales/invoices" replace />} />
          <Route path="purchases" element={<Navigate to="/app/purchases/bills" replace />} />
          <Route path="inventory" element={<Navigate to="/app/inventory/items" replace />} />
          <Route path="payroll" element={<Navigate to="/app/payroll/employees" replace />} />
          <Route path="accountant" element={<Navigate to="/app/accountant/journals" replace />} />
          <Route path="reports" element={<Navigate to="/app/reports/trial-balance" replace />} />
          <Route path="revenue" element={<Navigate to="/app/revenue/contracts" replace />} />
          <Route path="crm" element={<Navigate to="/app/crm/dashboard" replace />} />
          <Route path="hr" element={<Navigate to="/app/hr/home" replace />} />

          <Route path="ai/assistant" element={<LazyRoute element={<AccountingAssistant />} />} />
          <Route path="ai/nvidia" element={<LazyRoute element={<NvidiaAiPage />} />} />
          
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

          <Route path="projects" element={<LazyRoute element={<ProjectsPage />} />} />
          <Route path="projects/:id" element={<LazyRoute element={<ProjectDetailPage />} />} />

          <Route path="inventory/items" element={<LazyRoute element={<InventoryPage />} />} />
          <Route path="inventory/items/new" element={<LazyRoute element={<InventoryPage />} />} />
          <Route path="inventory/adjustments" element={<LazyRoute element={<InventoryAdjustmentsPage />} />} />
          <Route path="inventory/management" element={<LazyRoute element={<InventoryManagementPage />} />} />

          <Route path="banking" element={<BankAccountsWrapper />} />
          <Route path="banking/reconciliation/:accountId" element={<ReconciliationWrapper />} />
          <Route path="banking/connections" element={<LazyRoute element={<BankConnectionsPage />} />} />
          <Route path="banking/payment-gateway" element={<LazyRoute element={<PaymentGatewayPage />} />} />
          <Route path="banking/rules" element={<LazyRoute element={<BankRules />} />} />
          <Route path="banking/currency-rates" element={<LazyRoute element={<CurrencyRatesPage />} />} />
          <Route path="banking/transfers" element={<LazyRoute element={<TransfersPage />} />} />

          <Route path="payroll/employees" element={<LazyRoute element={<EmployeesPageReal />} />} />
          <Route path="payroll/runs" element={<LazyRoute element={<PayrollRunsPage />} />} />
          <Route path="payroll/runs/:id" element={<LazyRoute element={<PayrollRunsPage />} />} />
          <Route path="payroll/paye-schedules" element={<LazyRoute element={<PayeSchedulesPage />} />} />
          <Route path="payroll/pension-schedules" element={<LazyRoute element={<PensionSchedulesPage />} />} />
          <Route path="payroll/payslips" element={<LazyRoute element={<PayslipsPage />} />} />

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
          <Route path="reports/usage-monitor" element={<LazyRoute element={<UsageMonitorDashboardPage />} />} />
          <Route path="revenue/contracts" element={<LazyRoute element={<RevenueContractsPage />} />} />
          <Route path="revenue/recognition-report" element={<LazyRoute element={<RevenueRecognitionReport />} />} />
          <Route path="support/tickets" element={<LazyRoute element={<SupportTicketsPage />} />} />
          <Route path="crm/dashboard" element={<LazyRoute element={<CrmDashboard />} />} />
          <Route path="crm/pipeline" element={<LazyRoute element={<DealsPipeline />} />} />
          <Route path="crm/deals" element={<LazyRoute element={<DealsTable />} />} />
          <Route path="crm/contacts" element={<LazyRoute element={<CrmContactsPage />} />} />
          <Route path="crm/activities" element={<LazyRoute element={<ActivitiesPage />} />} />

          <Route path="hr/home" element={<HrGuard perm="hr:read"><Suspense fallback={<PageLoader />}><HomeLayout /></Suspense></HrGuard>}>
            <Route index element={<Navigate to="/app/hr/home/overview" replace />} />
            <Route path="overview" element={<LazyRoute element={<HomeOverviewPage />} />} />
            <Route path="dashboard" element={<LazyRoute element={<HomeDashboardPage />} />} />
            <Route path="calendar" element={<LazyRoute element={<HomeCalendarPage />} />} />
            <Route path="delegation" element={<LazyRoute element={<HomeDelegationPage />} />} />
          </Route>
          <Route path="hr/manage" element={<HrGuard perm="hr:admin"><Suspense fallback={<PageLoader />}><ManageLayout /></Suspense></HrGuard>}>
            <Route index element={<Navigate to="/app/hr/manage/users" replace />} />
            <Route path="users" element={<LazyRoute element={<ManageUsersPage />} />} />
            <Route path="employees" element={<LazyRoute element={<EmployeeProfilesPage />} />} />
            <Route path="organisation" element={<Navigate to="/app/hr/manage/organisation/policy" replace />} />
            <Route path="organisation/policy" element={<LazyRoute element={<OrganisationSection />} />} />
            <Route path="organisation/structure" element={<LazyRoute element={<OrganisationSection />} />} />
            <Route path="organisation/locations" element={<LazyRoute element={<OrganisationSection />} />} />
            <Route path="organisation/departments" element={<LazyRoute element={<OrganisationSection />} />} />
            <Route path="organisation/designations" element={<LazyRoute element={<OrganisationSection />} />} />
            <Route path="organisation/domains" element={<LazyRoute element={<OrganisationSection />} />} />
            <Route path="organisation/from-address" element={<LazyRoute element={<OrganisationSection />} />} />
            <Route path="organisation/email-auth" element={<LazyRoute element={<OrganisationSection />} />} />
            <Route path="access" element={<Navigate to="/app/hr/manage/access/general" replace />} />
            <Route path="access/general" element={<LazyRoute element={<UserAccessSection />} />} />
            <Route path="access/specific" element={<LazyRoute element={<UserAccessSection />} />} />
            <Route path="access/assignments" element={<LazyRoute element={<UserAccessSection />} />} />
            <Route path="access/permissions" element={<LazyRoute element={<UserAccessSection />} />} />
            <Route path="access/administrator" element={<LazyRoute element={<UserAccessSection />} />} />
            <Route path="approvals" element={<Navigate to="/app/hr/manage/approvals/details" replace />} />
            <Route path="approvals/details" element={<LazyRoute element={<ApprovalsSection />} />} />
            <Route path="approvals/criteria" element={<LazyRoute element={<ApprovalsSection />} />} />
            <Route path="approvals/list" element={<LazyRoute element={<ApprovalsSection />} />} />
            <Route path="approvals/messages" element={<LazyRoute element={<ApprovalsSection />} />} />
            <Route path="services" element={<Navigate to="/app/hr/manage/services/onboarding" replace />} />
            <Route path="services/onboarding" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/candidate" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/employee-information" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/employee" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/department" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/designation" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/holidays" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/leave" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/compensatory-request" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/attendance" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/time-tracker" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/clients" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/projects" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/jobs" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/self-appraisal" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/performance-appraisal" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/goals" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/multi-rater-review" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/organization-files" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/employee-files" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/announcements" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/address-proof" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/bonafide-letter" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/experience-letter" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/travel-request" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/travel-expense" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/tasks" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/task" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/compensation" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/exit-details" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/offboarding" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/okr" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/courses" element={<LazyRoute element={<ServicesSection />} />} />
            <Route path="services/hr-help-desk" element={<LazyRoute element={<ServicesSection />} />} />
          </Route>
          <Route path="hr/onboarding" element={<HrGuard perm="hr:create"><Suspense fallback={<PageLoader />}><OnboardingLayout /></Suspense></HrGuard>}>
            <Route index element={<Navigate to="/app/hr/onboarding/add-candidate" replace />} />
            <Route path="add-candidate" element={<LazyRoute element={<AddCandidatePage />} />} />
          </Route>
          <Route path="hr/leave" element={<HrGuard perm="hr:read"><Suspense fallback={<PageLoader />}><LeaveLayout /></Suspense></HrGuard>}>
            <Route index element={<Navigate to="/app/hr/leave/summary" replace />} />
            <Route path="summary" element={<LazyRoute element={<LeaveSummaryPage />} />} />
            <Route path="requests" element={<LazyRoute element={<LeaveRequestsPage />} />} />
            <Route path="shift" element={<LazyRoute element={<LeaveShiftPage />} />} />
          </Route>
          <Route path="hr/attendance" element={<HrGuard perm="hr:read"><Suspense fallback={<PageLoader />}><AttendanceLayout /></Suspense></HrGuard>}>
            <Route index element={<Navigate to="/app/hr/attendance/summary" replace />} />
            <Route path="summary" element={<LazyRoute element={<AttendanceSummaryPage />} />} />
            <Route path="shift" element={<LazyRoute element={<AttendanceShiftPage />} />} />
          </Route>
          <Route path="hr/timesheets" element={<HrGuard perm="hr:read"><Suspense fallback={<PageLoader />}><TimesheetsLayout /></Suspense></HrGuard>}>
            <Route index element={<Navigate to="/app/hr/timesheets/logs" replace />} />
            <Route path="logs" element={<LazyRoute element={<TimeLogsPage />} />} />
            <Route path="sheets" element={<LazyRoute element={<TimesheetsListPage />} />} />
          </Route>
          <Route path="hr/services" element={<HrGuard perm="hr:read"><Suspense fallback={<PageLoader />}><ServicesLayout /></Suspense></HrGuard>}>
            <Route index element={<Navigate to="/app/hr/services/preferences" replace />} />
            <Route path="preferences" element={<LazyRoute element={<PreferencesPage />} />} />
            <Route path="performance" element={<LazyRoute element={<HrServicesPerformancePage />} />} />
            <Route path="files" element={<LazyRoute element={<HrServicesFilesPage />} />} />
            <Route path="engagement" element={<LazyRoute element={<EmployeeEngagementPage />} />} />
            <Route path="hr-letters" element={<LazyRoute element={<HRLettersPage />} />} />
            <Route path="travel" element={<LazyRoute element={<HrServicesTravelPage />} />} />
            <Route path="tasks" element={<LazyRoute element={<HrServicesTasksPage />} />} />
            <Route path="compensation" element={<LazyRoute element={<HrServicesCompensationPage />} />} />
            <Route path="system" element={<LazyRoute element={<HrServicesGeneralPage />} />} />
          </Route>
          <Route path="hr/operations" element={<HrGuard perm="hr:read"><Suspense fallback={<PageLoader />}><OperationsLayout /></Suspense></HrGuard>}>
            <Route index element={<Navigate to="/app/hr/operations/services" replace />} />
            <Route path="services" element={<LazyRoute element={<OpsServicesPage />} />} />
            <Route path="onboarding" element={<LazyRoute element={<OpsOnboardingPage />} />} />
            <Route path="employee-info" element={<LazyRoute element={<OpsEmployeeInformationPage />} />} />
            <Route path="leave" element={<LazyRoute element={<OpsLeaveTrackerPage />} />} />
            <Route path="attendance" element={<LazyRoute element={<OpsAttendancePage />} />} />
            <Route path="shift" element={<LazyRoute element={<OpsShiftPage />} />} />
            <Route path="time-tracker" element={<LazyRoute element={<OpsTimeTrackerPage />} />} />
            <Route path="performance" element={<LazyRoute element={<OpsPerformancePage />} />} />
            <Route path="files" element={<LazyRoute element={<OpsFilesPage />} />} />
            <Route path="engagement" element={<LazyRoute element={<OpsEmployeeEngagementPage />} />} />
            <Route path="hr-letters" element={<LazyRoute element={<OpsHRLettersPage />} />} />
            <Route path="travel" element={<LazyRoute element={<OpsTravelPage />} />} />
            <Route path="tasks" element={<LazyRoute element={<OpsTasksPage />} />} />
            <Route path="system" element={<LazyRoute element={<OpsGeneralPage />} />} />
            <Route path="offboarding" element={<LazyRoute element={<OpsOffboardingPage />} />} />
            <Route path="okr" element={<LazyRoute element={<OpsOKRPage />} />} />
            <Route path="approvals" element={<LazyRoute element={<OpsApprovalsPage />} />} />
            <Route path="data-admin" element={<LazyRoute element={<OpsDataAdministrationPage />} />} />
          </Route>
          <Route path="hr/reports" element={<HrGuard perm="hr:reports"><Suspense fallback={<PageLoader />}><ReportsLayout /></Suspense></HrGuard>}>
            <Route index element={<Navigate to="/app/hr/reports/my-reports" replace />} />
            <Route path="my-reports" element={<LazyRoute element={<MyReportsPage />} />} />
            <Route path="employee-info" element={<LazyRoute element={<ReportsEmployeeInformationPage />} />} />
            <Route path="career-history" element={<LazyRoute element={<CareerHistoryPage />} />} />
            <Route path="leave-balance" element={<LazyRoute element={<LeaveBalancePage />} />} />
            <Route path="attendance" element={<LazyRoute element={<ReportsAttendancePage />} />} />
            <Route path="early-check-in" element={<LazyRoute element={<EarlyCheckInPage />} />} />
            <Route path="late-check-in" element={<LazyRoute element={<LateCheckInPage />} />} />
            <Route path="early-check-out" element={<LazyRoute element={<EarlyCheckOutPage />} />} />
            <Route path="late-check-out" element={<LazyRoute element={<LateCheckOutPage />} />} />
            <Route path="presence-hours" element={<LazyRoute element={<PresenceHoursPage />} />} />
            <Route path="team-reports" element={<LazyRoute element={<TeamReportsPage />} />} />
            <Route path="org-reports" element={<LazyRoute element={<OrganizationReportsPage />} />} />
            <Route path="analytics" element={<LazyRoute element={<ReportsAnalyticsPage />} />} />
            <Route path="schedules" element={<LazyRoute element={<ReportsSchedulesPage />} />} />
          </Route>
          <Route path="hr/employees" element={<HrGuard perm="hr:read"><LazyRoute element={<EmployeeList />} /></HrGuard>} />
          <Route path="hr/employees/new" element={<HrGuard perm="hr:create"><LazyRoute element={<EmployeeForm />} /></HrGuard>} />
          <Route path="hr/employees/:id" element={<HrGuard perm="hr:read"><LazyRoute element={<EmployeeDetail />} /></HrGuard>} />
          <Route path="hr/departments" element={<HrGuard perm="hr:read"><LazyRoute element={<DepartmentsPage />} /></HrGuard>} />
          <Route path="hr/designations" element={<HrGuard perm="hr:read"><LazyRoute element={<DesignationsPage />} /></HrGuard>} />
          <Route path="hr/leave-types" element={<HrGuard perm="hr:read"><LazyRoute element={<LeaveTypesPage />} /></HrGuard>} />
          <Route path="hr/shifts" element={<HrGuard perm="hr:read"><LazyRoute element={<ShiftsPage />} /></HrGuard>} />
          <Route path="hr/candidates" element={<HrGuard perm="hr:read"><LazyRoute element={<CandidatesPage />} /></HrGuard>} />
          <Route path="hr/performance" element={<HrGuard perm="hr:read"><LazyRoute element={<PerformanceReviewsPage />} /></HrGuard>} />
          <Route path="hr/courses" element={<HrGuard perm="hr:read"><LazyRoute element={<CoursesPage />} /></HrGuard>} />
          <Route path="hr/surveys" element={<HrGuard perm="hr:read"><LazyRoute element={<SurveysPage />} /></HrGuard>} />
          <Route path="hr/announcements" element={<HrGuard perm="hr:read"><LazyRoute element={<AnnouncementsPage />} /></HrGuard>} />
          <Route path="hr/recognition" element={<HrGuard perm="hr:read"><LazyRoute element={<RecognitionPage />} /></HrGuard>} />
          <Route path="hr/goals" element={<HrGuard perm="hr:read"><LazyRoute element={<GoalsPage />} /></HrGuard>} />
          <Route path="hr/letters" element={<HrGuard perm="hr:read"><LazyRoute element={<LettersPage />} /></HrGuard>} />
          <Route path="hr/letter-templates" element={<HrGuard perm="hr:read"><LazyRoute element={<LetterTemplatesPage />} /></HrGuard>} />
          <Route path="hr/travel" element={<HrGuard perm="hr:read"><LazyRoute element={<TravelRequestsPage />} /></HrGuard>} />
          <Route path="hr/expenses" element={<HrGuard perm="hr:read"><LazyRoute element={<ExpenseReportsPage />} /></HrGuard>} />
          <Route path="hr/compensation" element={<HrGuard perm="hr:read"><LazyRoute element={<CompensationPage />} /></HrGuard>} />
          <Route path="hr/benefits" element={<HrGuard perm="hr:read"><LazyRoute element={<BenefitsPage />} /></HrGuard>} />
          <Route path="hr/tasks" element={<HrGuard perm="hr:read"><LazyRoute element={<TasksPage />} /></HrGuard>} />
          <Route path="hr/workflows" element={<HrGuard perm="hr:read"><LazyRoute element={<WorkflowsPage />} /></HrGuard>} />
          <Route path="hr/offboarding" element={<HrGuard perm="hr:read"><LazyRoute element={<OffboardingPage />} /></HrGuard>} />
          <Route path="hr/helpdesk" element={<HrGuard perm="hr:read"><LazyRoute element={<HelpDeskPage />} /></HrGuard>} />
          <Route path="hr/approvals" element={<HrGuard perm="hr:approve"><LazyRoute element={<ApprovalsPage />} /></HrGuard>} />
          <Route path="hr/policies" element={<HrGuard perm="hr:read"><LazyRoute element={<PoliciesPage />} /></HrGuard>} />
          <Route path="hr/settings" element={<HrGuard perm="hr:admin"><LazyRoute element={<HrSettingsPage />} /></HrGuard>} />
          <Route path="hr/jobs" element={<HrGuard perm="hr:read"><LazyRoute element={<JobsPage />} /></HrGuard>} />
          <Route path="hr/projects" element={<HrGuard perm="hr:read"><LazyRoute element={<HrProjectsPage />} /></HrGuard>} />
          <Route path="hr/job-schedule" element={<HrGuard perm="hr:read"><LazyRoute element={<JobSchedulePage />} /></HrGuard>} />

          <Route path="settings" element={<Suspense fallback={<PageLoader />}><SettingsLayout /></Suspense>}>
            <Route index element={<Navigate to="/app/settings/organisation" replace />} />
            <Route path="organisation" element={<LazyRoute element={<OrganisationProfilePage />} />} />
            <Route path="branding" element={<LazyRoute element={<BrandingPage />} />} />
            <Route path="domain" element={<LazyRoute element={<CustomDomainPage />} />} />
            <Route path="locations" element={<LazyRoute element={<LocationsPage />} />} />
            <Route path="users" element={<LazyRoute element={<UsersPage />} />} />
            <Route path="roles" element={<LazyRoute element={<RolesPage />} />} />
            <Route path="crm-access" element={<LazyRoute element={<CrmSettingsPage />} />} />
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
            <Route path="subscription" element={<LazyRoute element={<CustomerSubscriptionPage />} />} />
          </Route>
          <Route path="settings/invites" element={<LazyRoute element={<InvitesSettingsPage />} />} />
          <Route path="settings/integrations" element={<LazyRoute element={<IntegrationsSettingsPage />} />} />
        </Route>

        <Route path="/help/documents" element={<LazyRoute element={<HelpDocumentsPage />} />} />
        <Route path="/help/faqs" element={<LazyRoute element={<FAQsPage />} />} />
        <Route path="/help/videos" element={<LazyRoute element={<VideoTutorialsPage />} />} />
        <Route path="/help/migration-guide" element={<LazyRoute element={<MigrationGuidePage />} />} />
        <Route path="/help" element={<LazyRoute element={<HelpPage />} />} />

        <Route path="*" element={<LazyRoute element={<NotFoundPage />} />} />
      </Routes>
    </BrowserRouter>
  );
}

const NotFoundPage = lazy(() => import('../pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));

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
