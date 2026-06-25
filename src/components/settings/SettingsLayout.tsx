import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Building2, Paintbrush, Globe, MapPinned, Users, Shield, UserCog,
  Settings, CreditCard, Clock, Scale, Bell, Store, Boxes,
  Hash, LayoutTemplate, Mail, Tag, Layers, Zap, ListChecks, History, Timer,
  Package, BarChart2, FileText, FileClock, Repeat, ReceiptText, Banknote,
  FileCheck, Truck, ClipboardList, ArrowLeftRight, Wallet, PuzzleIcon,
  ChevronDown, ChevronRight, ShoppingCart, Receipt, HelpCircle,
} from 'lucide-react';

type NavItem = { label: string; path: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { group: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    group: 'Organisation',
    items: [
      { label: 'Profile', path: '/settings/organisation', icon: Building2 },
      { label: 'Branding', path: '/settings/branding', icon: Paintbrush },
      { label: 'Custom Domain', path: '/settings/domain', icon: Globe },
      { label: 'Locations', path: '/settings/locations', icon: MapPinned },
    ],
  },
  {
    group: 'Users & Roles',
    items: [
      { label: 'Users', path: '/settings/users', icon: Users },
      { label: 'Roles', path: '/settings/roles', icon: Shield },
      { label: 'User Preferences', path: '/settings/user-preferences', icon: UserCog },
    ],
  },
  {
    group: 'Setup & Configuration',
    items: [
      { label: 'General', path: '/settings/general', icon: Settings },
      { label: 'Currencies', path: '/settings/currencies', icon: CreditCard },
      { label: 'Payment Terms', path: '/settings/payment-terms', icon: Clock },
      { label: 'Opening Balances', path: '/settings/opening-balances', icon: Scale },
      { label: 'Reminders', path: '/settings/reminders', icon: Bell },
      { label: 'Customer Portal', path: '/settings/customer-portal', icon: Store },
      { label: 'Vendor Portal', path: '/settings/vendor-portal', icon: Boxes },
    ],
  },
  {
    group: 'Customization',
    items: [
      { label: 'Transaction Number Series', path: '/settings/txn-numbering', icon: Hash },
      { label: 'PDF Templates', path: '/settings/pdf-templates', icon: LayoutTemplate },
      { label: 'Email Notifications', path: '/settings/email-notifications', icon: Mail },
      { label: 'Reporting Tags', path: '/settings/reporting-tags', icon: Tag },
      { label: 'Web Tabs', path: '/settings/web-tabs', icon: Layers },
    ],
  },
  {
    group: 'Automation',
    items: [
      { label: 'Workflow Rules', path: '/settings/workflow-rules', icon: Zap },
      { label: 'Workflow Actions', path: '/settings/workflow-actions', icon: ListChecks },
      { label: 'Workflow Logs', path: '/settings/workflow-logs', icon: History },
      { label: 'Schedules', path: '/settings/schedules', icon: Timer },
    ],
  },
  {
    group: 'Module Settings — General',
    items: [
      { label: 'Customers & Vendors', path: '/settings/contacts', icon: Users },
      { label: 'Items', path: '/settings/items', icon: Package },
      { label: 'Revenue Recognition', path: '/settings/revenue-recognition', icon: BarChart2 },
      { label: 'Accountant', path: '/settings/accountant', icon: FileText },
      { label: 'Tasks', path: '/settings/tasks', icon: ListChecks },
      { label: 'Projects', path: '/settings/projects', icon: Layers },
      { label: 'Timesheet', path: '/settings/timesheet', icon: FileClock },
    ],
  },
  {
    group: 'Module Settings — Inventory',
    items: [
      { label: 'Inventory Adjustments', path: '/settings/inventory-adjustments', icon: ArrowLeftRight },
    ],
  },
  {
    group: 'Module Settings — Online Payments',
    items: [
      { label: 'Payment Gateways', path: '/settings/payment-gateways', icon: Wallet },
    ],
  },
  {
    group: 'Module Settings — Sales',
    items: [
      { label: 'Quotes', path: '/settings/quotes', icon: FileCheck },
      { label: 'Sales Orders', path: '/settings/sales-orders', icon: ShoppingCart },
      { label: 'Invoices', path: '/settings/invoices', icon: Receipt },
      { label: 'Recurring Invoices', path: '/settings/recurring-invoices', icon: Repeat },
      { label: 'Sales Receipts', path: '/settings/sales-receipts', icon: ReceiptText },
      { label: 'Payments Received', path: '/settings/payments-received', icon: Banknote },
      { label: 'Credit Notes', path: '/settings/credit-notes', icon: FileText },
      { label: 'Delivery Notes', path: '/settings/delivery-notes', icon: Truck },
      { label: 'Packing Slips', path: '/settings/packing-slips', icon: ClipboardList },
    ],
  },
  {
    group: 'Module Settings — Purchases',
    items: [
      { label: 'Expenses', path: '/settings/expenses', icon: CreditCard },
      { label: 'Recurring Expenses', path: '/settings/recurring-expenses', icon: Repeat },
      { label: 'Purchase Orders', path: '/settings/purchase-orders', icon: ShoppingCart },
      { label: 'Bills', path: '/settings/bills', icon: FileText },
      { label: 'Recurring Bills', path: '/settings/recurring-bills', icon: FileClock },
      { label: 'Payments Made', path: '/settings/payments-made', icon: Wallet },
      { label: 'Vendor Credits', path: '/settings/vendor-credits', icon: Banknote },
    ],
  },
  {
    group: 'Custom Modules',
    items: [
      { label: 'Overview', path: '/settings/custom-modules', icon: PuzzleIcon },
    ],
  },
];

export function SettingsSidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggle(group: string) {
    setCollapsed(prev => ({ ...prev, [group]: !prev[group] }));
  }

  const sidebar = (
    <nav className="w-56 shrink-0 self-start sticky top-6">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden max-h-[calc(100vh-8rem)] overflow-y-auto">
        {NAV.map(({ group, items }) => {
          const isOpen = collapsed[group] !== false;
          const isActive = items.some(i => i.path === location.pathname);
          return (
            <div key={group} className="border-b border-slate-100 last:border-0">
              <button
                onClick={() => toggle(group)}
                className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
                  isActive ? 'bg-indigo-50' : 'hover:bg-slate-50'
                }`}
              >
                <span className={`text-xs font-semibold tracking-wide uppercase ${
                  isActive ? 'text-indigo-700' : 'text-slate-500'
                }`}>
                  {group.replace('Module Settings — ', '')}
                </span>
                {isOpen
                  ? <ChevronDown size={13} className="text-slate-400" />
                  : <ChevronRight size={13} className="text-slate-400" />
                }
              </button>
              {isOpen && (
                <div className="pb-1">
                  {items.map(({ label, path, icon: Icon }) => (
                    <NavLink
                      key={path}
                      to={path}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 px-3 py-1.5 mx-1 rounded-lg text-xs transition-colors ${
                          isActive
                            ? 'bg-indigo-600 text-white font-medium'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`
                      }
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      {label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden flex items-center gap-2 text-sm font-medium text-slate-600 mb-4 px-1"
      >
        <Settings size={16} />
        Settings Menu
        {mobileOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {mobileOpen && (
        <div className="lg:hidden mb-4">{sidebar}</div>
      )}
      <div className="hidden lg:block">{sidebar}</div>
    </>
  );
}

export function SettingsLayout() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8 flex gap-6 items-start">
      <SettingsSidebar />
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}

export { NAV };
