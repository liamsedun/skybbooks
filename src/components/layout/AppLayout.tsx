/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  LayoutDashboard,
  Users,
  FileCode,
  FileText,
  DollarSign,
  Briefcase,
  History,
  TrendingUp,
  Settings,
  Menu,
  X,
  Building,
  Bell,
  ArrowRight,
  LogOut,
  User,
  Shield,
  CreditCard,
  FileBarChart,
  HelpCircle,
  FileInput,
  BookOpen,
  Sparkles,
  Package,
  ArrowRightLeft,
  TrendingDown,
  ReceiptText
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Footer } from './Footer';
import { SkyhouseLogo } from '../ui/SkyhouseLogo';
import { usePlatformBranding } from '../../hooks/usePlatformBranding';
import { useNotifications } from '../../hooks/useNotifications';

interface AppLayoutProps {
  currentView?: string;
  onViewChange?: (viewId: string) => void;
  children?: React.ReactNode;
}

interface NavItem {
  name: string;
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  roleRequirement?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

function Tooltip({ children, label }: { children: React.ReactNode; label: string }) {
  const [visible, setVisible] = useState(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => { timer = setTimeout(() => setVisible(true), 400); }}
      onMouseLeave={() => { if (timer) clearTimeout(timer); setVisible(false); }}
    >
      {children}
      {visible && (
        <span
          className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md text-xs whitespace-nowrap z-50 shadow-lg pointer-events-none"
          style={{ backgroundColor: 'var(--color-ink-900)', color: 'white' }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

export function AppLayout({ currentView, onViewChange, children }: AppLayoutProps) {
  const { user, organisation, logout } = useAuth();
  const { role, hasModuleAccess } = usePermissions();
  const { developerLogoUrl } = usePlatformBranding();
  const { notifications, unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  React.useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const clickedEl = event.target as HTMLElement;
      
      if (showUserMenu) {
        const profileButton = document.getElementById('header-profile-button');
        const profileDropdown = document.getElementById('header-profile-dropdown');
        if (
          profileButton && !profileButton.contains(clickedEl) &&
          profileDropdown && !profileDropdown.contains(clickedEl)
        ) {
          setShowUserMenu(false);
        }
      }
      
      if (showNotifications) {
        const notifyButton = document.getElementById('header-notification-button');
        const notifyPopup = document.getElementById('header-notifications-popup');
        if (
          notifyButton && !notifyButton.contains(clickedEl) &&
          notifyPopup && !notifyPopup.contains(clickedEl)
        ) {
          setShowNotifications(false);
        }
      }
    };

    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [showUserMenu, showNotifications]);

  const pathMap: Record<string, string> = useMemo(() => ({
    'dashboard': '/dashboard',
    'ai_insights': '/ai/insights',
    'customers': '/sales/customers',
    'quotes': '/sales/quotes',
    'sales_orders': '/sales/sales-orders',
    'invoices': '/sales/invoices',
    'receipts': '/sales/receipts',
    'recurring_invoices': '/sales/recurring-invoices',
    'payments_received': '/sales/payments',
    'credit_notes': '/sales/credit-notes',
    'vendors': '/purchases/vendors',
    'expenses': '/purchases/expenses',
    'recurring_expenses': '/purchases/recurring-expenses',
    'purchase_orders': '/purchases/purchase-orders',
    'bills': '/purchases/bills',
    'payments_made': '/purchases/payments-made',
    'purchase_credit_notes': '/purchases/credit-notes',
    'items': '/inventory/items',
    'inventory_adjustments': '/inventory/adjustments',
    'employees': '/payroll/employees',
    'payroll_runs': '/payroll/runs',
    'paye_schedules': '/payroll/paye-schedules',
    'pension_schedules': '/payroll/pension-schedules',
    'payslips': '/payroll/payslips',
    'bank_accounts': '/banking',
    'bank_feed': '/banking/reconciliation/demo',
    'banking_rules': '/banking/rules',
    'currency_rates': '/banking/currency-rates',
    'bank_transfers': '/banking/transfers',
    'projects': '/projects',
    'chart_accounts': '/accountant/chart-of-accounts',
    'manual_journals': '/accountant/journals',
    'budgets': '/accountant/budgets',
    'fixed_assets': '/accountant/fixed-assets',
    'depreciation': '/accountant/fixed-assets/depreciation',
    'rep_trial_balance': '/reports/trial-balance',
    'rep_income_statement': '/reports/income-statement',
    'rep_balance_sheet': '/reports/balance-sheet',
    'rep_cash_flow': '/reports/cash-flow',
    'rep_general_ledger': '/reports/general-ledger',
    'rep_vat_return': '/reports/vat-return',
    'rep_aged_receivables': '/reports/aged-receivables',
    'rep_aged_payables': '/reports/aged-payables',
    'rep_audit_logs': '/reports/audit-logs',
    'rep_custom': '/reports/custom',
    'rep_tax_computation': '/reports/tax-computation',
    'rep_projects': '/reports/projects',
    'rep_legacy': '/reports/legacy',
    'set_organisation': '/settings/organisation',
    'set_invites': '/settings/invites',
    'set_roles': '/settings/roles',
    'user_preferences': '/settings/user-preferences',
    'set_integrations': '/settings/integrations',
  }), []);

  // Group collapse/expand state
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    'OVERVIEW': false,
    'SALES': false,
    'PURCHASES': false,
    'INVENTORY': false,
    'PAYROLL': true,
    'BANKING': true,
    'ACCOUNTANT': true,
    'REPORTS': true,
    'SETTINGS': true,
  });

  const navigation: NavGroup[] = useMemo(() => [
    {
      title: 'OVERVIEW',
      items: [
        { name: 'Dashboard', id: 'dashboard', icon: LayoutDashboard },
        { name: 'SMART CFO Insights', id: 'ai_insights', icon: Sparkles },
      ],
    },
    {
      title: 'SALES',
      items: [
        { name: 'Customers', id: 'customers', icon: Users },
        { name: 'Quotes & Quotes Sent', id: 'quotes', icon: FileCode },
        { name: 'Sales Orders', id: 'sales_orders', icon: FileText },
        { name: 'Invoices', id: 'invoices', icon: FileText },
        { name: 'Receipts', id: 'receipts', icon: FileInput },
        { name: 'Recurring Invoices', id: 'recurring_invoices', icon: History },
        { name: 'Payments Received', id: 'payments_received', icon: DollarSign },
        { name: 'Credit Notes', id: 'credit_notes', icon: FileText },
      ],
    },
    {
      title: 'PROJECTS',
      items: [
        { name: 'All Projects', id: 'projects', icon: Briefcase },
      ],
    },
    {
      title: 'PURCHASES',
      items: [
        { name: 'Vendors', id: 'vendors', icon: Users },
        { name: 'Expenses', id: 'expenses', icon: DollarSign },
        { name: 'Recurring Expenses', id: 'recurring_expenses', icon: History },
        { name: 'Purchase Orders', id: 'purchase_orders', icon: FileText },
        { name: 'Bills', id: 'bills', icon: FileText },
        { name: 'Payments Made', id: 'payments_made', icon: DollarSign },
        { name: 'Credit Notes', id: 'purchase_credit_notes', icon: FileText },
      ],
    },
    {
      title: 'INVENTORY',
      items: [
        { name: 'Items & Services', id: 'items', icon: Package },
        { name: 'Inventory Adjustments', id: 'inventory_adjustments', icon: ArrowRightLeft },
      ],
    },
    {
      title: 'PAYROLL',
      items: [
        { name: 'Employees', id: 'employees', icon: Users },
        { name: 'Payroll Runs', id: 'payroll_runs', icon: Briefcase },
        { name: 'PAYE Schedules', id: 'paye_schedules', icon: FileBarChart },
        { name: 'Pension Schedules', id: 'pension_schedules', icon: FileBarChart },
        { name: 'Payslips', id: 'payslips', icon: FileText },
      ],
    },
    {
      title: 'BANKING',
      items: [
        { name: 'Bank Accounts', id: 'bank_accounts', icon: CreditCard },
        { name: 'Bank Feed Reconciler', id: 'bank_feed', icon: History },
        { name: 'Rules', id: 'banking_rules', icon: Shield },
        { name: 'Currency Rates', id: 'currency_rates', icon: TrendingUp },
        { name: 'Transfers', id: 'bank_transfers', icon: ArrowRightLeft },
      ],
    },
    {
      title: 'ACCOUNTANT',
      items: [
        { name: 'Chart of Accounts', id: 'chart_accounts', icon: BookOpen },
        { name: 'Manual Journals', id: 'manual_journals', icon: FileCode },
        { name: 'Budgets', id: 'budgets', icon: TrendingUp },
        { name: 'Fixed Assets', id: 'fixed_assets', icon: Building },
        { name: 'Depreciation', id: 'depreciation', icon: TrendingDown },
      ],
    },
    {
      title: 'REPORTS',
      items: [
        { name: 'Trial Balance', id: 'rep_trial_balance', icon: FileBarChart },
        { name: 'Income Statement', id: 'rep_income_statement', icon: FileBarChart },
        { name: 'Balance Sheet', id: 'rep_balance_sheet', icon: FileBarChart },
        { name: 'Cash Flow Statement', id: 'rep_cash_flow', icon: FileBarChart },
        { name: 'General Ledger', id: 'rep_general_ledger', icon: FileBarChart },
        { name: 'VAT Return', id: 'rep_vat_return', icon: FileBarChart },
        { name: 'Aged Receivables', id: 'rep_aged_receivables', icon: FileBarChart },
        { name: 'Aged Payables', id: 'rep_aged_payables', icon: FileBarChart },
        { name: 'Audit Logs', id: 'rep_audit_logs', icon: History },
        { name: 'Custom Reports', id: 'rep_custom', icon: FileCode },
        { name: 'Tax Computation', id: 'rep_tax_computation', icon: ReceiptText },
        { name: 'Project Report', id: 'rep_projects', icon: Briefcase },
        { name: 'Legacy Migration', id: 'rep_legacy', icon: History },
      ],
    },
    {
    title: 'SETTINGS',
    items: [
      { name: 'Organisation Settings', id: 'set_organisation', icon: Settings },
      { name: 'Users & Roles', id: 'set_roles', icon: Shield },
    ],
    },
  ], []);

  // Filter navigation items matching query
  const filteredNavigation = useMemo(() => {
    if (!searchQuery.trim()) return navigation;
    const query = searchQuery.toLowerCase();

    return navigation
      .map((group) => {
        const matchingItems = group.items.filter((item) =>
          item.name.toLowerCase().includes(query)
        );
        return {
          ...group,
          items: matchingItems,
        };
      })
      .filter((group) => group.items.length > 0);
  }, [navigation, searchQuery]);

  const toggleGroup = (title: string) => {
    setCollapsedGroups((prev) => {
      const isCurrentlyCollapsed = !!prev[title];
      const next: Record<string, boolean> = {
        'OVERVIEW': true,
        'SALES': true,
        'PURCHASES': true,
        'INVENTORY': true,
        'PAYROLL': true,
        'BANKING': true,
        'ACCOUNTANT': true,
        'REPORTS': true,
        'SETTINGS': true,
      };
      next[title] = !isCurrentlyCollapsed;
      return next;
    });
  };

  const handleLinkClick = (id: string) => {
    if (onViewChange) {
      onViewChange(id);
    }
    const targetPath = pathMap[id];
    if (targetPath) {
      navigate(targetPath);
    }
    setIsMobileOpen(false);
  };

  // Build current display company avatar letter
  const orgInitials = organisation?.name?.charAt(0).toUpperCase() || 'F';
  const userInitials = user?.fullName?.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase() || 'U';
  const userAvatarUrl = (user as any)?.avatarUrl;

  const formatRole = (roleStr: string) => {
    if (!roleStr) return 'Employee';
    return roleStr.charAt(0).toUpperCase() + roleStr.slice(1);
  };

  const isSettingsPage = location.pathname.startsWith('/settings');

  return (
    <div className="min-h-screen bg-slate-50 flex" id="finance-os-applet-shell">
      
      {/* 1. LEFT SIDEBAR — hidden on settings pages for full-width layout */}
      {!isSettingsPage && (<aside 
        id="desktop-sidebar-pane"
        className={`fixed top-0 bottom-0 left-0 z-40 ${sidebarCollapsed ? 'w-16' : 'w-60'} bg-surface border-r border-border-custom flex flex-col transition-all duration-300 lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:static lg:h-screen shrink-0`}
      >
        {/* Brand visual header area */}
        <div className={`h-16 border-b border-border-custom flex items-center ${sidebarCollapsed ? 'px-2 justify-between' : 'px-5 justify-between'}`}>
          <div className={`flex items-center select-none ${sidebarCollapsed ? '' : 'space-x-2.5'}`}>
            {developerLogoUrl ? (
              <img src={developerLogoUrl} alt="" className="w-7 h-7 rounded object-contain shrink-0" />
            ) : (
              <SkyhouseLogo className={`${sidebarCollapsed ? 'w-5 h-5' : 'w-8 h-8'} drop-shadow-sm shrink-0`} />
            )}
            {!sidebarCollapsed && (
              <div>
                <h2 className="text-sm font-extrabold text-ink-900 uppercase tracking-[0.12em] leading-none">SkyBooks</h2>
                <span className="text-[10px] text-ink-400 font-semibold tracking-widest font-mono uppercase mt-0.5 inline-block">Books Engine</span>
              </div>
            )}
          </div>

          {/* Close drawer icon on small viewports */}
          <button 
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden p-1.5 hover:bg-surface-subtle text-ink-400 rounded-lg outline-none transition-colors duration-150"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Collapse/expand toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`${sidebarCollapsed ? 'absolute -right-3 top-4 z-50 bg-white border border-border-custom shadow-sm rounded-full p-1' : 'p-1.5'} hover:bg-surface-subtle text-ink-400 rounded-lg outline-none transition-colors duration-150`}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ArrowRight className={`w-4 h-4 transition-transform duration-200 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Dynamic Sidebar Search Engine */}
        {!sidebarCollapsed && (
        <div className="p-3.5 border-b border-slate-50">
          <div className="relative">
            <Search className="w-4 h-4 text-ink-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              id="sidebar-search-bar"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search functions & tags..."
              className="w-full pl-9 pr-3 py-2 text-xs font-medium border border-border-custom rounded-xl outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all duration-150 bg-white text-ink-900 placeholder-ink-400"
            />
          </div>
        </div>
        )}

        {/* Scrollable Navigation section */}
        <nav className={`flex-1 overflow-y-auto ${sidebarCollapsed ? 'p-2' : 'p-3'} space-y-3 sidebar-scrollbar`} id="sidebar-scrollable-links">
          {filteredNavigation.map((group) => {
            const isCollapsed = collapsedGroups[group.title] && !searchQuery;
            return (
              <div key={group.title} className="flex flex-col">
                {/* Header Group toggler */}
                {!sidebarCollapsed && (
                <button
                  onClick={() => toggleGroup(group.title)}
                  className="px-2 py-1.5 flex items-center justify-between text-[11px] font-bold text-ink-400 tracking-[0.08em] font-sans select-none text-left w-full hover:text-ink-600 transition-all duration-150 rounded-lg hover:bg-surface-subtle group"
                >
                  <span>{group.title}</span>
                  {!searchQuery && (
                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 text-ink-400 group-hover:text-ink-500 ${isCollapsed ? '-rotate-90' : ''}`} />
                  )}
                </button>
                )}

                {/* Sub-items array */}
                {(!isCollapsed || sidebarCollapsed) && (
                  <div className={`flex flex-col ${sidebarCollapsed ? 'items-center space-y-1' : 'space-y-0.5 mt-0.5'}`}>
                    {group.items.map((item) => {
                      const targetPath = pathMap[item.id];
                      const isActive = currentView 
                        ? currentView === item.id 
                        : (targetPath ? (location.pathname === targetPath || (targetPath !== '/dashboard' && location.pathname.startsWith(targetPath))) : false);
                      const Icon = item.icon;

                      const navButton = (
                        <button
                          key={item.id}
                          id={`nav-link-${item.id}`}
                          onClick={() => handleLinkClick(item.id)}
                          className={`${sidebarCollapsed ? 'px-0 py-2 justify-center w-full' : 'w-full px-2.5 py-1.5'} flex items-center text-xs font-medium rounded-xl text-left transition-all duration-150 ease-out relative group ${
                            isActive
                              ? 'bg-primary-light text-primary font-semibold shadow-sm'
                              : 'text-ink-600 hover:text-primary hover:bg-surface-subtle'
                          }`}
                        >
                          <span className={`inline-flex items-center justify-center w-7 h-7 ${sidebarCollapsed ? '' : 'mr-2.5'} rounded-lg shrink-0 transition-all duration-150 ${
                            isActive
                              ? 'bg-primary text-white shadow-sm'
                              : 'bg-transparent group-hover:bg-primary-light/50'
                          }`}>
                            <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-ink-400 group-hover:text-primary'}`} />
                          </span>
                          {!sidebarCollapsed && <span className="truncate">{item.name}</span>}
                        </button>
                      );

                      return sidebarCollapsed ? (
                        <Tooltip key={item.id} label={item.name}>{navButton}</Tooltip>
                      ) : navButton;
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* STICKY BOTTOM USER PROFILE SECTION */}
        <div className={`${sidebarCollapsed ? 'p-2' : 'p-3'} border-t border-border-custom bg-white shadow-sm`} id="sidebar-sticky-footer">
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-2.5'} p-2 rounded-xl bg-surface-subtle border border-border-custom/60`}>
            <Tooltip label={user?.fullName || 'Active Controller'}>
              <div className="w-8 h-8 rounded-lg bg-primary-light text-primary font-extrabold flex items-center justify-center text-xs shadow-sm select-none uppercase overflow-hidden shrink-0">
                {userAvatarUrl ? <img src={userAvatarUrl} alt="" className="w-full h-full object-cover" /> : userInitials}
              </div>
            </Tooltip>
            {!sidebarCollapsed && (
              <>
                <div className="flex-1 min-w-0 select-none">
                  <h4 className="text-xs font-bold text-ink-900 truncate">{user?.fullName || 'Active Controller'}</h4>
                  <p className="text-[10px] text-ink-400 font-semibold truncate mt-0.5">{formatRole(role)}</p>
                </div>
                <button 
                  id="sidebar-btn-logout"
                  title="Sign Out Session"
                  onClick={logout}
                  className="p-1.5 rounded-lg hover:bg-rose-50 text-ink-400 hover:text-rose-600 transition-all duration-150 outline-none"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>)}

      {/* Backdrop overlay for drawer when mobile menu is open */}
      {!isSettingsPage && isMobileOpen && (
        <div 
          onClick={() => setIsMobileOpen(false)}
          className="lg:hidden fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-xs"
        />
      )}

      {/* 2. MAIN CONTAINER AREA WITH TOP HEADER */}
      <div className={`flex-1 flex flex-col min-w-0 overflow-y-auto ${isSettingsPage ? '' : 'lg:h-screen'}`} id="main-content-scroll-container">
        {/* TOP HEADER */}
        <header className={`h-14 md:h-16 px-4 md:px-6 bg-white border-b border-slate-100 flex items-center justify-between shrink-0 sticky top-0 z-20 ${isSettingsPage ? '' : ''}`}>
          
          {/* Hamburger toggle button on smaller screens — hidden on settings pages */}
          {!isSettingsPage && (<button 
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="lg:hidden p-2 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl outline-none mr-3 shrink-0 transition"
          >
            <Menu className="w-5 h-5" />
          </button>)}

          {/* Org Display capsule with selector */}
          <div className="flex items-center space-x-2.5 sm:space-x-3.5 select-none" id="org-display-bubble">
            <div className="w-7 h-7 bg-primary-light text-primary rounded-lg flex items-center justify-center text-xs font-bold shadow-sm uppercase shrink-0 overflow-hidden">
              {developerLogoUrl ? (
                <img src={developerLogoUrl} alt="" className="w-full h-full object-contain" />
              ) : (
                orgInitials
              )}
            </div>
            <div>
              <div className="hidden sm:block">
                <span className="text-[9px] text-ink-400 font-bold uppercase tracking-wider block">Enterprise Account</span>
                <h1 className="text-xs font-black text-ink-900 leading-tight uppercase tracking-wide">
                  {organisation?.name || 'SkyBooks Client'}
                </h1>
              </div>
              <div className="block sm:hidden">
                <h1 className="text-xs font-black text-ink-900 leading-tight uppercase tracking-wide">
                  {(organisation?.name || 'Skyhouse').trim().split(' ')[0]}
                </h1>
              </div>
            </div>
          </div>

          {/* Header Action caps */}
          <div className="flex items-center space-x-2.5 sm:space-x-4 ml-auto" id="header-right-actions">
            
            {/* Real-time UTC Live Status Clock — hidden on settings pages */}
            {!isSettingsPage && (
            <span className="hidden md:inline-flex items-center text-[11px] font-mono font-semibold text-slate-500 bg-slate-50 border border-slate-100 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2 inline-block animate-pulse"></span>
              Live Ledger Connected
            </span>
            )}

            {/* Quick Audit Notifications */}
            <div className="relative">
              <button 
                id="header-notification-button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-1.5 md:p-2 border border-slate-150 rounded-xl hover:bg-slate-50 hover:text-primary transition relative outline-none cursor-pointer"
              >
                <Bell className="w-4 h-4 md:w-4.5 md:h-4.5 text-slate-500" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 md:-top-1 md:-right-1 bg-red-500 text-white border-2 border-white rounded-full h-3.5 w-3.5 md:h-4.5 md:w-4.5 text-[7px] md:text-[8px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-3.5 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-slate-100 z-50 p-4 space-y-1.5 text-[11px] font-medium" id="header-notifications-popup">
                  <div className="font-extrabold text-ink-900 border-b border-slate-50 pb-2 mb-1 flex justify-between items-center text-xs">
                    <span>Notifications</span>
                    <span 
                      onClick={() => setShowNotifications(false)}
                      className="text-primary cursor-pointer font-bold hover:underline"
                    >
                      Dismiss
                    </span>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="text-center py-6 text-slate-400">No notifications</div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => { navigate(n.link); setShowNotifications(false); }}
                        className={`flex items-start gap-2 p-2 rounded-lg border border-transparent transition cursor-pointer ${
                          n.severity === 'error'
                            ? 'hover:bg-red-50 hover:border-red-100 text-red-700'
                            : n.severity === 'warning'
                            ? 'hover:bg-amber-50 hover:border-amber-100 text-amber-700'
                            : 'hover:bg-blue-50 hover:border-blue-100 text-slate-600'
                        }`}
                      >
                        <span className="text-sm">{n.icon}</span>
                        <span className="flex-1">{n.message}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* User Profile dropdown wrapper */}
            <div className="relative">
              <button
                id="header-profile-button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-1.5 md:space-x-2 p-0.5 md:p-1 border border-slate-150 hover:bg-slate-50 rounded-xl transition cursor-pointer select-none outline-none"
              >
                <div className="h-6 w-6 md:h-7 md:w-7 rounded-lg bg-primary text-white font-extrabold text-[10px] md:text-xs flex items-center justify-center shadow-3xs uppercase overflow-hidden">
                  {userAvatarUrl ? <img src={userAvatarUrl} alt="" className="w-full h-full object-cover" /> : userInitials}
                </div>
                <ChevronDown className="w-3 h-3 md:w-3.5 md:h-3.5 text-slate-400" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-3.5 w-52 bg-white rounded-xl shadow-xl border border-slate-100 z-50 p-2 text-xs font-semibold text-ink-600" id="header-profile-dropdown">
                  <div className="px-3 py-2 border-b border-slate-50 text-[10px] text-ink-400 uppercase font-bold tracking-widest leading-none mb-1">
                    My Account
                  </div>
                  <button 
                    onClick={() => { setShowUserMenu(false); navigate('/settings/user-preferences'); }} 
                    className="w-full px-3 py-1.5 hover:bg-slate-50 rounded-lg flex items-center text-left"
                  >
                    <User className="w-4 h-4 mr-2.5 text-ink-400" />
                    User Settings
                  </button>
                  <button 
                    onClick={() => handleLinkClick('set_organisation')}
                    className="w-full px-3 py-1.5 hover:bg-slate-50 rounded-lg flex items-center text-left"
                  >
                    <Building className="w-4 h-4 mr-2.5 text-ink-400" />
                    Organisation Setup
                  </button>
                  <button 
                    onClick={logout}
                    className="w-full px-3 py-1.5 hover:bg-rose-50 text-rose-600 rounded-lg flex items-center text-left mt-1.5 border-t border-slate-50 pt-2"
                  >
                    <LogOut className="w-4 h-4 mr-2.5 text-rose-500" />
                    Log Out Session
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* 3. SCROLLABLE SCREEN CONTENT AREA */}
        <main className={`flex-1 p-4 sm:p-6 md:p-8 w-full mx-auto ${isSettingsPage ? '' : 'max-w-7xl'}`} id="shell-inner-viewport">
          {children || <Outlet />}
        </main>
        
        <Footer />
      </div>
    </div>
  );
}
export default AppLayout;
