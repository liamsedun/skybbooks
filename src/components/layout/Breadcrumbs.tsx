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

export function Breadcrumbs() {
  const location = useLocation();

  const segments = location.pathname.split('/').filter(Boolean);

  if (segments.length === 0) return null;

  return (
    <nav className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400" aria-label="Breadcrumb">
      <Link
        to="/dashboard"
        className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
      >
        <Home className="w-4 h-4" />
      </Link>

      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        const prevSegment = index > 0 ? segments[index - 1] : undefined;
        const prevLabel = prevSegment ? formatSegment(prevSegment) : undefined;
        const label = formatSegment(segment, prevLabel);
        const path = '/' + segments.slice(0, index + 1).join('/');

        return (
          <span key={path} className="flex items-center gap-1.5 min-w-0">
            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
            {isLast ? (
              <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
                {label}
              </span>
            ) : (
              <Link
                to={path}
                className="hover:text-primary dark:hover:text-primary transition-colors truncate"
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
