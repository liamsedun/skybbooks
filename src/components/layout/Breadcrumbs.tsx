/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const segmentLabels: Record<string, string> = {
  'dashboard': 'Dashboard',
  'sales': 'Sales',
  'purchases': 'Purchases',
  'accountant': 'Accounting',
  'reports': 'Reports',
  'banking': 'Banking',
  'inventory': 'Inventory',
  'payroll': 'Payroll',
  'settings': 'Settings',
  'ai': 'AI',
  'projects': 'Projects',
  'chat': 'Chat',
  'revenue': 'Revenue',
  'customers': 'Customers',
  'quotes': 'Quotes',
  'sales-orders': 'Sales Orders',
  'invoices': 'Invoices',
  'receipts': 'Receipts',
  'recurring-invoices': 'Recurring Invoices',
  'payments': 'Payments Received',
  'credit-notes': 'Credit Notes',
  'vendors': 'Vendors',
  'expenses': 'Expenses',
  'recurring-expenses': 'Recurring Expenses',
  'purchase-orders': 'Purchase Orders',
  'bills': 'Bills',
  'payments-made': 'Payments Made',
  'items': 'Items',
  'adjustments': 'Adjustments',
  'management': 'Management',
  'employees': 'Employees',
  'runs': 'Runs',
  'paye-schedules': 'PAYE Schedules',
  'pension-schedules': 'Pension Schedules',
  'payslips': 'Payslips',
  'reconciliation': 'Reconciliation',
  'connections': 'Connections',
  'payment-gateway': 'Payment Gateway',
  'rules': 'Rules',
  'currency-rates': 'Currency Rates',
  'transfers': 'Transfers',
  'chart-of-accounts': 'Chart of Accounts',
  'journals': 'Journals',
  'budgets': 'Budgets',
  'fixed-assets': 'Fixed Assets',
  'depreciation': 'Depreciation',
  'leases': 'Leases',
  'ocr': 'OCR',
  'intercompany': 'Intercompany',
  'ecl': 'ECL',
  'trial-balance': 'Trial Balance',
  'income-statement': 'Income Statement',
  'balance-sheet': 'Balance Sheet',
  'cash-flow': 'Cash Flow',
  'statement-of-changes-in-equity': 'Changes in Equity',
  'general-ledger': 'General Ledger',
  'vat-return': 'VAT Return',
  'aged-receivables': 'Aged Receivables',
  'aged-payables': 'Aged Payables',
  'audit-logs': 'Audit Logs',
  'custom': 'Custom Reports',
  'tax-computation': 'Tax Computation',
  'tax-engine': 'Tax Engine',
  'legacy': 'Legacy',
  'consolidation': 'Consolidation',
  'contracts': 'Contracts',
  'recognition-report': 'Recognition Report',
  'organisation': 'Organisation',
  'invites': 'Invites',
  'roles': 'Roles',
  'user-preferences': 'User Preferences',
  'integrations': 'Integrations',
  'insights': 'Insights',
  'assistant': 'Assistant',
  'new': 'New',
  'edit': 'Edit',
  'demo': 'Demo',
  'hr': 'SkyHRM',
  'manage': 'Manage SkyHRM',
  'home': 'Home',
  'overview': 'Overview',
  'calendar': 'Calendar',
  'delegation': 'Delegation',
  'onboarding': 'Onboarding',
  'add-candidate': 'Add Candidate',
  'leave': 'Leave Tracker',
  'summary': 'Summary',
  'requests': 'Requests',
  'shift': 'Shift',
  'attendance': 'Attendance',
  'timesheets': 'Time Tracker',
  'logs': 'Time Logs',
  'sheets': 'Timesheets',
  'jobs': 'Jobs',
  'job-schedule': 'Job Schedule',
  'services': 'More Services',
  'preferences': 'Preferences',
  'performance': 'Performance',
  'files': 'Files',
  'engagement': 'Employee Engagement',
  'hr-letters': 'HR Letters',
  'travel': 'Travel',
  'tasks': 'Tasks',
  'compensation': 'Compensation',
  'system': 'General',
  'operations': 'Operations',
  'employee-info': 'Employee Information',
  'my-reports': 'My Reports',
  'career-history': 'Career History',
  'leave-balance': 'Leave Balance',
  'early-check-in': 'Early Check In',
  'late-check-in': 'Late Check In',
  'early-check-out': 'Early Check Out',
  'late-check-out': 'Late Check Out',
  'presence-hours': 'Presence Hours',
  'team-reports': 'Team Reports',
  'org-reports': 'Organization Reports',
  'analytics': 'Analytics',
  'schedules': 'Schedules',
  'okr': 'OKR',
  'data-admin': 'Data Administration',
  'users': 'Users',
  'policy': 'Policy',
  'structure': 'Structure',
  'locations': 'Locations',
  'departments': 'Departments',
  'designations': 'Designations',
  'domains': 'Domains & Rebranding',
  'from-address': 'From Address',
  'email-auth': 'Email Authentication',
  'access': 'User Access Control',
  'general': 'General Role',
  'specific': 'Specific Role',
  'assignments': 'Role Assignments',
  'permissions': 'Function Permissions',
  'administrator': 'Administrator',
  'approvals': 'Approvals',
  'details': 'Details',
  'criteria': 'Criteria',
  'list': 'Approvals List',
  'messages': 'Messages',
  'candidate': 'Candidate',
  'employee-information': 'Employee Information',
  'holidays': 'Holidays',
  'compensatory-request': 'Compensatory Request',
  'time-tracker': 'Time Tracker',
  'clients': 'Clients',
  'self-appraisal': 'Self Appraisal',
  'performance-appraisal': 'Performance Appraisal',
  'multi-rater-review': 'Multi-Rater Review',
  'organization-files': 'Organization Files',
  'employee-files': 'Employee Files',
  'employee-engagement': 'Employee Engagement',
  'address-proof': 'Address Proof',
  'bonafide-letter': 'Bonafide Letter',
  'experience-letter': 'Experience Letter',
  'travel-request': 'Travel Request',
  'travel-expense': 'Travel Expense',
  'exit-details': 'Exit Details',
  'hr-help-desk': 'HR Help Desk',
  'administration': 'Administration',
  'surveys': 'Surveys',
  'goals': 'Goals',
  'courses': 'Courses',
  'recognition': 'Recognition',
  'announcements': 'Announcements',
  'workflows': 'Workflows',
  'offboarding': 'Offboarding',
  'recruitment': 'Recruitment',
  'time': 'Time',
  'letters': 'Letters',
  'policies': 'Policies',
  'hr-settings': 'Settings',
  'shifts': 'Shifts',
  'leave-types': 'Leave Types',
  'expense-reports': 'Expense Reports',
  'employee-profiles': 'Employee Profiles',
  'benefits': 'Benefits',
  'job-openings': 'Job Openings',
  'templates': 'Templates',
  'performance-reviews': 'Performance Reviews',
};

function toTitleCase(str: string): string {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatSegment(segment: string, prevLabel?: string): string {
  if (uuidPattern.test(segment)) {
    return prevLabel ? `${prevLabel} Detail` : 'Detail';
  }
  return segmentLabels[segment] || toTitleCase(segment);
}

export function Breadcrumbs({ variant = 'header' }: { variant?: 'header' | 'content' }) {
  const location = useLocation();

  const segments = location.pathname.split('/').filter(Boolean);

  if (segments.length === 0) return null;

  const isHeader = variant === 'header';

  return (
    <nav className={`flex items-center gap-1.5 text-sm ${isHeader ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'}`} aria-label="Breadcrumb">
      <Link
        to="/app/dashboard"
        className={`p-1 rounded-lg transition-colors shrink-0 ${isHeader ? 'hover:bg-white/10' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
      >
        <Home className={`w-4 h-4 ${isHeader ? 'text-white/70' : ''}`} />
      </Link>

      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        const prevSegment = index > 0 ? segments[index - 1] : undefined;
        const prevLabel = prevSegment ? formatSegment(prevSegment) : undefined;
        const label = formatSegment(segment, prevLabel);
        const path = '/' + segments.slice(0, index + 1).join('/');

        return (
          <span key={path} className="flex items-center gap-1.5 min-w-0">
            <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${isHeader ? 'text-white/40' : 'text-slate-400 dark:text-slate-500'}`} />
            {isLast ? (
              <span className={`font-medium truncate ${isHeader ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                {label}
              </span>
            ) : (
              <Link
                to={path}
                className={`transition-colors truncate ${isHeader ? 'text-white/70 hover:text-white' : 'hover:text-primary dark:hover:text-primary'}`}
              >
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export default Breadcrumbs;
