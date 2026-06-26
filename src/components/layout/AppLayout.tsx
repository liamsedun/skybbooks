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
  Package
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Footer } from './Footer';
import { SkyhouseLogo } from '../ui/SkyhouseLogo';

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

export function AppLayout({ currentView, onViewChange, children }: AppLayoutProps) {
  const { user, organisation, logout } = useAuth();
  const { role, hasModuleAccess } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

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
    'employees': '/payroll/employees',
    'payroll_runs': '/payroll/runs',
    'paye_schedules': '/payroll/paye-schedules',
    'pension_schedules': '/payroll/pension-schedules',
    'payslips': '/payroll/payslips',
    'bank_accounts': '/banking',
    'bank_feed': '/banking/reconciliation/demo',
    'banking_rules': '/banking/rules',
    'currency_rates': '/banking/currency-rates',
    'chart_accounts': '/accountant/chart-of-accounts',
    'manual_journals': '/accountant/journals',
    'budgets': '/accountant/budgets',
    'fixed_assets': '/accountant/fixed-assets',
    'rep_trial_balance': '/reports/trial-balance',
    'rep_income_statement': '/reports/income-statement',
    'rep_balance_sheet': '/reports/balance-sheet',
    'rep_cash_flow': '/reports/cash-flow',
    'rep_aged_receivables': '/reports/aged-receivables',
    'rep_aged_payables': '/reports/aged-payables',
    'rep_audit_logs': '/reports/audit-logs',
    'rep_custom': '/reports/custom',
    'set_organisation': '/settings/organisation',
    'set_invites': '/settings/invites',
    'set_roles': '/settings/roles',
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
    'Accountant': true,
    'REPORTS': true,
    'SETTINGS': true,
  });

  const navigation: NavGroup[] = useMemo(() => [
    {
      title: 'OVERVIEW',
      items: [
        { name: 'Dashboard', id: 'dashboard', icon: LayoutDashboard },
        { name: 'AI CFO Insights', id: 'ai_insights', icon: Sparkles },
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
      ],
    },
    {
      title: 'Accountant',
      items: [
        { name: 'Chart of Accounts', id: 'chart_accounts', icon: BookOpen },
        { name: 'Manual Journals', id: 'manual_journals', icon: FileCode },
        { name: 'Budgets', id: 'budgets', icon: TrendingUp },
        { name: 'Fixed Assets', id: 'fixed_assets', icon: Building },
      ],
    },
    {
      title: 'REPORTS',
      items: [
        { name: 'Trial Balance', id: 'rep_trial_balance', icon: FileBarChart },
        { name: 'Income Statement', id: 'rep_income_statement', icon: FileBarChart },
        { name: 'Balance Sheet', id: 'rep_balance_sheet', icon: FileBarChart },
        { name: 'Cash Flow Statement', id: 'rep_cash_flow', icon: FileBarChart },
        { name: 'Aged Receivables', id: 'rep_aged_receivables', icon: FileBarChart },
        { name: 'Aged Payables', id: 'rep_aged_payables', icon: FileBarChart },
        { name: 'Audit Logs', id: 'rep_audit_logs', icon: History },
        { name: 'Custom Reports', id: 'rep_custom', icon: FileCode },
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
        'Accountant': true,
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

  const formatRole = (roleStr: string) => {
    if (!roleStr) return 'Employee';
    return roleStr.charAt(0).toUpperCase() + roleStr.slice(1);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex" id="finance-os-applet-shell">
      
      {/* 1. LEFT SIDEBAR: Standard desktop (hidden on tablet/mobile unless toggled) */}
      <aside 
        id="desktop-sidebar-pane"
        className={`fixed top-0 bottom-0 left-0 z-40 w-60 bg-white border-r border-slate-100 flex flex-col transition-transform duration-300 xl:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        } xl:static xl:h-screen shrink-0`}
      >
        {/* Brand visual header area */}
        <div className="h-16 px-5 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-3 select-none">
            <SkyhouseLogo className="w-9 h-9 drop-shadow-sm shrink-0" />
            <div>
              <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest leading-none">SkyBooks</h2>
              <span className="text-[10px] text-slate-400 font-bold tracking-widest font-mono uppercase mt-1 inline-block">Books Engine</span>
            </div>
          </div>
          
          {/* Close drawer icon on small viewports */}
          <button 
            onClick={() => setIsMobileOpen(false)}
            className="xl:hidden p-1.5 hover:bg-slate-50 text-slate-400 rounded-lg outline-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic Sidebar Search Engine */}
        <div className="p-3.5 border-b border-slate-50">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              id="sidebar-search-bar"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search functions & tags..."
              className="w-full pl-9 pr-3 py-2 text-xs font-medium border border-slate-200 rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors bg-slate-50 text-ink-900 placeholder-ink-400"
            />
          </div>
        </div>

        {/* Scrollable Navigation section */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-4" id="sidebar-scrollable-links">
          {filteredNavigation.map((group) => {
            const isCollapsed = collapsedGroups[group.title] && !searchQuery;
            return (
              <div key={group.title} className="flex flex-col space-y-1">
                {/* Header Group toggler */}
                <button
                  onClick={() => toggleGroup(group.title)}
                  className="px-2 py-1 flex items-center justify-between text-[11px] font-bold text-ink-400 tracking-wider font-sans select-none text-left w-full hover:text-ink-600 transition-colors group"
                >
                  <span>{group.title}</span>
                  {!searchQuery && (
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 text-ink-400 group-hover:text-ink-500 ${isCollapsed ? '-rotate-90' : ''}`} />
                  )}
                </button>

                {/* Sub-items array */}
                {!isCollapsed && (
                  <div className="flex flex-col space-y-0.5 mt-1">
                    {group.items.map((item) => {
                      const targetPath = pathMap[item.id];
                      const isActive = currentView 
                        ? currentView === item.id 
                        : (targetPath ? (location.pathname === targetPath || (targetPath !== '/dashboard' && location.pathname.startsWith(targetPath))) : false);
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          id={`nav-link-${item.id}`}
                          onClick={() => handleLinkClick(item.id)}
                          className={`w-full px-3 py-1.5 flex items-center text-xs font-medium rounded-lg text-left transition-all relative ${
                            isActive
                              ? 'bg-primary-light text-primary font-semibold border-l-3 border-primary rounded-l-none shadow-sm'
                              : 'text-ink-600 hover:text-primary hover:bg-surface-subtle'
                          }`}
                        >
                          <Icon className={`w-4 h-4 mr-3 shrink-0 ${isActive ? 'text-primary' : 'text-ink-400'}`} />
                          <span className="truncate">{item.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* STICKY BOTTOM USER PROFILE SECTION */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50" id="sidebar-sticky-footer">
          <div className="flex items-center space-x-3 bg-white p-2.5 rounded-xl border border-slate-100">
            <div className="w-8.5 h-8.5 rounded-lg bg-primary-light text-primary font-extrabold flex items-center justify-center text-xs shadow-sm select-none uppercase">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0 select-none">
              <h4 className="text-xs font-bold text-ink-900 truncate">{user?.fullName || 'Active Controller'}</h4>
              <p className="text-[10px] text-ink-400 font-bold truncate mt-0.5">{formatRole(role)}</p>
            </div>
            <button 
              id="sidebar-btn-logout"
              title="Sign Out Session"
              onClick={logout}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-rose-600 transition-colors duration-150 outline-none"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Backdrop overlay for drawer when mobile menu is open */}
      {isMobileOpen && (
        <div 
          onClick={() => setIsMobileOpen(false)}
          className="xl:hidden fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-xs"
        />
      )}

      {/* 2. MAIN CONTAINER AREA WITH TOP HEADER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto xl:h-screen" id="main-content-scroll-container">
        {/* TOP HEADER */}
        <header className="h-14 md:h-16 px-4 md:px-6 bg-white border-b border-slate-100 flex items-center justify-between shrink-0 sticky top-0 z-20">
          
          {/* Hamburger toggle button on smaller screens */}
          <button 
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="xl:hidden p-2 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl outline-none mr-3 shrink-0 transition"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Org Display capsule with selector */}
          <div className="flex items-center space-x-2.5 sm:space-x-3.5 select-none" id="org-display-bubble">
            <div className="w-7 h-7 bg-primary-light text-primary rounded-lg flex items-center justify-center text-xs font-bold shadow-sm uppercase shrink-0">
              {orgInitials}
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
            
            {/* Real-time UTC Live Status Clock */}
            <span className="hidden md:inline-flex items-center text-[11px] font-mono font-semibold text-slate-500 bg-slate-50 border border-slate-100 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2 inline-block animate-pulse"></span>
              Live Ledger Connected
            </span>

            {/* Quick Audit Notifications */}
            <div className="relative">
              <button 
                id="header-notification-button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-1.5 md:p-2 border border-slate-150 rounded-xl hover:bg-slate-50 hover:text-primary transition relative outline-none cursor-pointer"
              >
                <Bell className="w-4 h-4 md:w-4.5 md:h-4.5 text-slate-500" />
                <span className="absolute -top-0.5 -right-0.5 md:-top-1 md:-right-1 bg-primary text-white border-2 border-white rounded-full h-3.5 w-3.5 md:h-4.5 md:w-4.5 text-[7px] md:text-[8px] font-bold flex items-center justify-center animate-pulse">
                  3
                </span>
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-3.5 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 p-4 space-y-2 text-[11px] font-medium" id="header-notifications-popup">
                  <div className="font-extrabold text-ink-900 border-b border-slate-50 pb-2 mb-2 flex justify-between items-center text-xs">
                    <span>Recent Audit Events</span>
                    <span 
                      onClick={() => setShowNotifications(false)}
                      className="text-primary cursor-pointer font-bold hover:underline"
                    >
                      Dismiss
                    </span>
                  </div>
                  <div className="p-2 hover:bg-primary-light/30 rounded-lg border border-transparent hover:border-primary-light transition text-ink-600">
                    📢 <strong>Bank sync:</strong> 15 new transactions imported and auto-matched with payment rules.
                  </div>
                  <div className="p-2 hover:bg-primary-light/30 rounded-lg border border-transparent hover:border-primary-light transition text-ink-600">
                    💰 <strong>Payroll Approved:</strong> Run #06/2026 approved by owner. Payslip generation completed.
                  </div>
                  <div className="p-2 hover:bg-primary-light/30 rounded-lg border border-transparent hover:border-primary-light transition text-ink-600 text-amber-700">
                    ⚠️ <strong>Overdue Invoices:</strong> Apex Retail invoice INV-1031 is overdue. Re-sent auto-notice.
                  </div>
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
                <div className="h-6 w-6 md:h-7 md:w-7 rounded-lg bg-primary text-white font-extrabold text-[10px] md:text-xs flex items-center justify-center shadow-3xs uppercase">
                  {userInitials}
                </div>
                <ChevronDown className="w-3 h-3 md:w-3.5 md:h-3.5 text-slate-400" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-3.5 w-52 bg-white rounded-xl shadow-xl border border-slate-100 z-50 p-2 text-xs font-semibold text-ink-600" id="header-profile-dropdown">
                  <div className="px-3 py-2 border-b border-slate-50 text-[10px] text-ink-400 uppercase font-bold tracking-widest leading-none mb-1">
                    My Account
                  </div>
                  <button 
                    onClick={() => handleLinkClick('set_roles')} 
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
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto" id="shell-inner-viewport">
          {children || <Outlet />}
        </main>
        
        <Footer />
      </div>
    </div>
  );
}
export default AppLayout;
