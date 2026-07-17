/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Search, ChevronDown, LayoutDashboard, Users, FileCode, FileText,
  DollarSign, Briefcase, History, MessageCircle, TrendingUp, Settings,
  Menu, X, Building, Bell, ArrowRight, LogOut, User, Shield, CreditCard,
  FileBarChart, HelpCircle, FileInput, BookOpen, Sparkles, Package,
  ArrowRightLeft, TrendingDown, ReceiptText, AlertTriangle, Bot, Wifi,
  Moon, Sun, Star, Zap, ChevronRight, PanelLeftClose, PanelLeft,
  CircleUser, Command, Plus, LayoutList, Home, Landmark
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Footer } from './Footer';
import { usePlatformBranding } from '../../hooks/usePlatformBranding';
import { useNotifications } from '../../hooks/useNotifications';
import { useTheme } from '../../context/ThemeContext';
import { useFavorites } from '../../hooks/useFavorites';
import { useRecentActivity } from '../../hooks/useRecentActivity';
import { api } from '../../lib/api';
import ChatWidget from '../chat/ChatWidget';
import { CommandPalette } from './CommandPalette';
import { QuickActionsBar } from './QuickActionsBar';
import { Breadcrumbs } from './Breadcrumbs';

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
  const { developerLogoUrl } = usePlatformBranding();
  const { notifications, unreadCount } = useNotifications();
  const { theme, toggleTheme } = useTheme();
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const { addActivity } = useRecentActivity();

  const totalUnread = unreadCount;
  const navigate = useNavigate();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    overview: false, sales: false, purchases: true, inventory: true,
    payroll: true, banking: true, accountant: true, reports: true,
  });

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const el = event.target as HTMLElement;
      if (showUserMenu) {
        const btn = document.getElementById('header-profile-button');
        const dd = document.getElementById('header-profile-dropdown');
        if (btn && !btn.contains(el) && dd && !dd.contains(el)) setShowUserMenu(false);
      }
      if (showNotifications) {
        const btn = document.getElementById('header-notification-button');
        const pop = document.getElementById('header-notifications-popup');
        if (btn && !btn.contains(el) && pop && !pop.contains(el)) setShowNotifications(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showUserMenu, showNotifications]);

  const pathMap: Record<string, string> = useMemo(() => ({
    dashboard: '/dashboard', ai_insights: '/ai/insights', ai_assistant: '/ai/assistant',
    customers: '/sales/customers', quotes: '/sales/quotes', sales_orders: '/sales/sales-orders',
    invoices: '/sales/invoices', receipts: '/sales/receipts', recurring_invoices: '/sales/recurring-invoices',
    payments_received: '/sales/payments', credit_notes: '/sales/credit-notes',
    vendors: '/purchases/vendors', expenses: '/purchases/expenses', recurring_expenses: '/purchases/recurring-expenses',
    purchase_orders: '/purchases/purchase-orders', bills: '/purchases/bills',
    payments_made: '/purchases/payments-made', purchase_credit_notes: '/purchases/credit-notes',
    items: '/inventory/items', inventory_adjustments: '/inventory/adjustments', inventory_management: '/inventory/management',
    employees: '/payroll/employees', payroll_runs: '/payroll/runs', paye_schedules: '/payroll/paye-schedules',
    pension_schedules: '/payroll/pension-schedules', payslips: '/payroll/payslips',
    bank_accounts: '/banking', bank_feed: '/banking/reconciliation/demo',
    bank_connections: '/banking/connections', payment_gateway: '/banking/payment-gateway',
    banking_rules: '/banking/rules', currency_rates: '/banking/currency-rates', bank_transfers: '/banking/transfers',
    projects: '/projects', chart_accounts: '/accountant/chart-of-accounts', manual_journals: '/accountant/journals',
    budgets: '/accountant/budgets', fixed_assets: '/accountant/fixed-assets', depreciation: '/accountant/fixed-assets/depreciation',
    leases: '/accountant/leases', ocr: '/accountant/ocr', intercompany: '/accountant/intercompany',
    ecl: '/accountant/ecl',
    rep_trial_balance: '/reports/trial-balance', rep_income_statement: '/reports/income-statement',
    rep_balance_sheet: '/reports/balance-sheet', rep_cash_flow: '/reports/cash-flow',
    rep_changes_in_equity: '/reports/statement-of-changes-in-equity', rep_general_ledger: '/reports/general-ledger',
    rep_vat_return: '/reports/vat-return', rep_aged_receivables: '/reports/aged-receivables',
    rep_aged_payables: '/reports/aged-payables', rep_audit_logs: '/reports/audit-logs',
    rep_custom: '/reports/custom', rep_tax_computation: '/reports/tax-computation',
    rep_tax_engine: '/reports/tax-engine', rep_projects: '/reports/projects', rep_legacy: '/reports/legacy',
    rep_consolidation: '/reports/consolidation',
    revenue_contracts: '/revenue/contracts', rep_revenue_recognition: '/revenue/recognition-report',
    set_organisation: '/settings/organisation', set_invites: '/settings/invites', set_roles: '/settings/roles',
    user_preferences: '/settings/user-preferences', set_integrations: '/settings/integrations',
  }), []);

  const navigation: NavGroup[] = useMemo(() => [
    { title: 'OVERVIEW', items: [
      { name: 'Dashboard', id: 'dashboard', icon: LayoutDashboard },
      { name: 'SMART CFO Insights', id: 'ai_insights', icon: Sparkles },
      { name: 'AI Assistant', id: 'ai_assistant', icon: Bot },
    ]},
    { title: 'SALES', items: [
      { name: 'Customers', id: 'customers', icon: Users },
      { name: 'Quotes', id: 'quotes', icon: FileText },
      { name: 'Sales Orders', id: 'sales_orders', icon: FileCode },
      { name: 'Invoices', id: 'invoices', icon: ReceiptText },
      { name: 'Receipts', id: 'receipts', icon: FileInput },
      { name: 'Recurring Invoices', id: 'recurring_invoices', icon: History },
      { name: 'Payments Received', id: 'payments_received', icon: DollarSign },
      { name: 'Credit Notes', id: 'credit_notes', icon: FileText },
    ]},
    { title: 'PROJECTS', items: [
      { name: 'All Projects', id: 'projects', icon: Briefcase },
    ]},
    { title: 'PURCHASES', items: [
      { name: 'Vendors', id: 'vendors', icon: Building },
      { name: 'Expenses', id: 'expenses', icon: CreditCard },
      { name: 'Recurring Expenses', id: 'recurring_expenses', icon: History },
      { name: 'Purchase Orders', id: 'purchase_orders', icon: FileCode },
      { name: 'Bills', id: 'bills', icon: FileText },
      { name: 'Payments Made', id: 'payments_made', icon: DollarSign },
      { name: 'Credit Notes', id: 'purchase_credit_notes', icon: FileText },
    ]},
    { title: 'INVENTORY', items: [
      { name: 'Items & Services', id: 'items', icon: Package },
      { name: 'Inventory Adjustments', id: 'inventory_adjustments', icon: TrendingDown },
      { name: 'Inventory Management', id: 'inventory_management', icon: LayoutList },
    ]},
    { title: 'PAYROLL', items: [
      { name: 'Employees', id: 'employees', icon: Users },
      { name: 'Payroll Runs', id: 'payroll_runs', icon: FileText },
      { name: 'PAYE Schedules', id: 'paye_schedules', icon: FileCode },
      { name: 'Pension Schedules', id: 'pension_schedules', icon: Shield },
      { name: 'Payslips', id: 'payslips', icon: FileInput },
    ]},
    { title: 'BANKING', items: [
      { name: 'Bank Accounts', id: 'bank_accounts', icon: Landmark },
      { name: 'Bank Feed Reconciler', id: 'bank_feed', icon: ArrowRightLeft },
      { name: 'Connections', id: 'bank_connections', icon: Wifi },
      { name: 'Payment Gateway', id: 'payment_gateway', icon: CreditCard },
      { name: 'Rules', id: 'banking_rules', icon: Shield },
      { name: 'Currency Rates', id: 'currency_rates', icon: TrendingUp },
      { name: 'Transfers', id: 'bank_transfers', icon: ArrowRightLeft },
    ]},
    { title: 'ACCOUNTANT', items: [
      { name: 'Chart of Accounts', id: 'chart_accounts', icon: BookOpen },
      { name: 'Manual Journals', id: 'manual_journals', icon: FileCode },
      { name: 'Budgets', id: 'budgets', icon: TrendingUp },
      { name: 'Fixed Assets', id: 'fixed_assets', icon: Building },
      { name: 'Depreciation', id: 'depreciation', icon: TrendingDown },
      { name: 'Lease Accounting', id: 'leases', icon: Briefcase },
      { name: 'Revenue Contracts', id: 'revenue_contracts', icon: FileText },
      { name: 'ECL (IFRS 9)', id: 'ecl', icon: AlertTriangle },
      { name: 'OCR Processor', id: 'ocr', icon: FileText },
      { name: 'Intercompany Txns', id: 'intercompany', icon: ArrowRightLeft },
    ]},
    { title: 'REPORTS', items: [
      { name: 'Trial Balance', id: 'rep_trial_balance', icon: FileBarChart },
      { name: 'Income Statement', id: 'rep_income_statement', icon: FileBarChart },
      { name: 'Balance Sheet', id: 'rep_balance_sheet', icon: FileBarChart },
      { name: 'Cash Flow Statement', id: 'rep_cash_flow', icon: FileBarChart },
      { name: 'Changes in Equity', id: 'rep_changes_in_equity', icon: FileBarChart },
      { name: 'General Ledger', id: 'rep_general_ledger', icon: BookOpen },
      { name: 'VAT Return', id: 'rep_vat_return', icon: FileBarChart },
      { name: 'Aged Receivables', id: 'rep_aged_receivables', icon: FileBarChart },
      { name: 'Aged Payables', id: 'rep_aged_payables', icon: FileBarChart },
      { name: 'Audit Logs', id: 'rep_audit_logs', icon: Shield },
      { name: 'Custom Reports', id: 'rep_custom', icon: FileBarChart },
      { name: 'Tax Computation', id: 'rep_tax_computation', icon: FileBarChart },
      { name: 'Tax Engine', id: 'rep_tax_engine', icon: Shield },
      { name: 'Project Report', id: 'rep_projects', icon: Briefcase },
      { name: 'Legacy Migration', id: 'rep_legacy', icon: History },
      { name: 'Consolidation', id: 'rep_consolidation', icon: Building },
      { name: 'Revenue Recognition', id: 'rep_revenue_recognition', icon: FileBarChart },
    ]},
  ], []);

  const filteredNavigation = useMemo(() => {
    if (!searchQuery) return navigation;
    const q = searchQuery.toLowerCase();
    return navigation
      .map(group => ({
        ...group,
        items: group.items.filter(item =>
          item.name.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q)
        ),
      }))
      .filter(group => group.items.length > 0);
  }, [navigation, searchQuery]);

  const isSettingsPage = location.pathname.startsWith('/settings');

  const activeNavId = useMemo(() => {
    const path = location.pathname;
    const entry = Object.entries(pathMap).find(([, p]) => path.startsWith(p));
    return entry?.[0] || '';
  }, [location.pathname, pathMap]);

  const handleNavigation = useCallback((id: string) => {
    const path = pathMap[id];
    if (!path) return;
    addActivity({ id, path, label: navigation.flatMap(g => g.items).find(i => i.id === id)?.name || id });
    navigate(path);
    setIsMobileOpen(false);
    if (onViewChange) onViewChange(id);
  }, [pathMap, navigate, onViewChange, addActivity, navigation]);

  const isActive = (id: string) => {
    if (activeNavId === id) return true;
    const path = pathMap[id];
    return path ? location.pathname.startsWith(path) : false;
  };

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const currentNavItem = useMemo(() =>
    navigation.flatMap(g => g.items).find(i => i.id === activeNavId),
    [navigation, activeNavId]
  );

  return (
    <>
      <CommandPalette />

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        id="desktop-sidebar-pane"
        className={`fixed top-0 left-0 z-40 h-screen flex flex-col sidebar-main transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'w-16' : 'w-60'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        {/* Logo area */}
        <div className={`flex items-center sidebar-separator shrink-0 ${
          sidebarCollapsed ? 'h-14 justify-center px-2' : 'h-16 px-4'
        }`}>
          {sidebarCollapsed ? (
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white text-sm font-bold shrink-0">
              S
            </div>
          ) : (
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {developerLogoUrl ? (
                <img src={developerLogoUrl} alt="Logo" className="h-8 w-8 rounded-lg object-contain" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white text-sm font-bold shrink-0">
                  S
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold sidebar-text truncate leading-tight">SkyBooks</div>
                <div className="text-[10px] sidebar-text-muted font-medium truncate leading-tight">Books Engine</div>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`hidden lg:flex items-center justify-center rounded-lg sidebar-icon-btn ${
              sidebarCollapsed ? 'absolute -right-3 top-5 w-6 h-6 sidebar-main border sidebar-separator rounded-full shadow-sm' : 'w-7 h-7'
            }`}
          >
            <PanelLeftClose className={`w-4 h-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden w-7 h-7 flex items-center justify-center rounded-lg sidebar-icon-btn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sidebar search */}
        {!sidebarCollapsed && (
          <div className="px-3 pt-3 pb-1 sidebar-search-wrapper">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sidebar-search-icon" />
              <input
                type="text"
                placeholder="Search functions..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs sidebar-search rounded-lg transition-all"
              />
            </div>
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto sidebar-scrollbar px-2 py-2 space-y-0.5">
          {filteredNavigation.map(group => {
            const isCollapsed = collapsedGroups[group.title] !== false;
            return (
              <div key={group.title}>
                {!sidebarCollapsed && (
                  <button
                    onClick={() => setCollapsedGroups(prev => ({ ...prev, [group.title]: !isCollapsed }))}
                    className="flex items-center justify-between w-full px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest sidebar-group-header transition-colors"
                  >
                    <span>{group.title}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${isCollapsed ? '' : 'rotate-180'}`} />
                  </button>
                )}
                {(!isCollapsed || sidebarCollapsed) && group.items.map(item => {
                  const Icon = item.icon;
                  const active = isActive(item.id);
                  const fav = isFavorite(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigation(item.id)}
                      className={`sidebar-nav-btn group relative w-full flex items-center gap-2.5 px-2.5 py-2 text-sm transition-all duration-150 ${
                        active ? 'active' : ''
                      } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
                      title={sidebarCollapsed ? item.name : undefined}
                    >
                      <Icon className={`w-4.5 h-4.5 shrink-0 sidebar-icon`} />
                      {!sidebarCollapsed && (
                        <>
                          <span className="truncate text-[13px] sidebar-text">{item.name}</span>
                          {fav && <Star className="w-3 h-3 sidebar-fav-star ml-auto" />}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Settings link */}
        <div className="sidebar-settings p-2">
          <button
            onClick={() => handleNavigation('set_organisation')}
            className={`sidebar-nav-btn w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition-all duration-150 ${
              location.pathname.startsWith('/settings') ? 'active' : ''
            } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
          >
            <Settings className="w-4.5 h-4.5 shrink-0 sidebar-icon" />
            {!sidebarCollapsed && <span className="truncate sidebar-text">Settings</span>}
          </button>
        </div>

        {/* User footer */}
        {!sidebarCollapsed && (
          <div className="sidebar-user-section p-2.5">
            <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl sidebar-user-card">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                {user?.fullName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold sidebar-user-name truncate leading-tight">
                  {user?.fullName || user?.email}
                </div>
                <div className="text-[10px] sidebar-user-role capitalize truncate leading-tight">{user?.role}</div>
              </div>
              <button
                onClick={handleLogout}
                className="w-6 h-6 flex items-center justify-center rounded-md sidebar-icon-btn"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main content area */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
        sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-60'
      }`}>
        {/* Top header */}
        <header className="sticky top-0 z-20 h-14 md:h-16 bg-surface border-b border-border-custom flex items-center gap-3 px-3 md:px-5">
          {/* Mobile menu */}
          <button
            onClick={() => setIsMobileOpen(true)}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-ink-600 hover:bg-surface-hover"
          >
            <Menu className="w-4.5 h-4.5" />
          </button>

          {/* Org display */}
          <div className="flex items-center gap-2 min-w-0 mr-auto">
            {organisation?.logoUrl ? (
              <img src={organisation.logoUrl} alt="" className="w-6 h-6 rounded-md object-contain hidden sm:block" />
            ) : (
              <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold hidden sm:block">
                {organisation?.name?.charAt(0) || 'O'}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-bold text-ink-900 truncate leading-tight">
                {organisation?.name || 'SkyBooks'}
              </div>
              <div className="text-[10px] text-ink-400 hidden sm:block leading-tight">
                <Breadcrumbs />
              </div>
            </div>
          </div>

          {/* Quick action buttons */}
          <div className="hidden md:flex items-center gap-1">
            <button
              onClick={() => navigate('/sales/invoices/new')}
              className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-hover transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              New Invoice
            </button>
            <button
              onClick={() => navigate('/purchases/bills/new')}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border-custom text-ink-600 hover:bg-surface-hover transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              New Bill
            </button>
          </div>

          {/* Search trigger */}
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { metaKey: true, shiftKey: true, key: 'f' }))}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs text-ink-400 bg-surface-subtle border border-border-custom rounded-lg hover:border-ink-300 transition-colors min-w-[160px]"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search anything...</span>
            <kbd className="ml-auto px-1.5 py-0.5 text-[10px] font-mono bg-surface border border-border-custom rounded text-ink-400">⌘K</kbd>
          </button>

          {/* Right side actions */}
          <div className="flex items-center gap-1">
            {/* Dark mode toggle */}
            <button
              onClick={toggleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-400 hover:text-ink-600 hover:bg-surface-hover transition-colors"
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                id="header-notification-button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-400 hover:text-ink-600 hover:bg-surface-hover transition-colors relative"
              >
                <Bell className="w-4 h-4" />
                {totalUnread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-danger-custom text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div
                  id="header-notifications-popup"
                  className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-surface rounded-2xl shadow-xl border border-border-custom overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-border-custom">
                    <div className="text-sm font-bold text-ink-900">Notifications</div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-ink-400">
                        <Bell className="w-8 h-8 mx-auto mb-2 text-ink-200" />
                        No new notifications
                      </div>
                    ) : (
                      notifications.slice(0, 10).map((n, i) => (
                        <div key={i} className="px-4 py-2.5 hover:bg-surface-hover transition-colors border-b border-border-custom/50 last:border-0">
                          <div className="flex items-start gap-2.5">
                            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                              n.severity === 'error' ? 'bg-danger-custom' :
                              n.severity === 'warning' ? 'bg-warning-custom' : 'bg-info-custom'
                            }`} />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs text-ink-900 line-clamp-2">{n.message}</div>
                              {n.timestamp && (
                                <div className="text-[10px] text-ink-400 mt-0.5">
                                  {new Date(n.timestamp).toLocaleString()}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User profile */}
            <div className="relative">
              <button
                id="header-profile-button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold hover:bg-primary-light transition-colors"
              >
                {user?.fullName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
              </button>
              {showUserMenu && (
                <div
                  id="header-profile-dropdown"
                  className="absolute right-0 top-full mt-2 w-56 bg-surface rounded-2xl shadow-xl border border-border-custom overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-border-custom">
                    <div className="text-sm font-bold text-ink-900 truncate">{user?.fullName || user?.email}</div>
                    <div className="text-[11px] text-ink-400 capitalize">{user?.role} · {organisation?.name}</div>
                  </div>
                  <div className="p-1.5">
                    <button
                      onClick={() => { setShowUserMenu(false); navigate('/settings/user-preferences'); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-ink-600 hover:bg-surface-hover hover:text-ink-900 transition-colors"
                    >
                      <User className="w-4 h-4" />
                      User Preferences
                    </button>
                    <button
                      onClick={() => { setShowUserMenu(false); navigate('/settings/organisation'); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-ink-600 hover:bg-surface-hover hover:text-ink-900 transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      Organisation Settings
                    </button>
                    <button
                      onClick={() => setShowUserMenu(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-ink-600 hover:bg-surface-hover hover:text-ink-900 transition-colors"
                    >
                      <HelpCircle className="w-4 h-4" />
                      Help & Support
                    </button>
                    <hr className="my-1 border-border-custom" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-danger-custom hover:bg-danger-bg transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Log Out Session
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className={`flex-1 ${isSettingsPage ? '' : 'p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full'}`}>
          {!isSettingsPage && (
            <div className="mb-4 flex items-center justify-between">
              <div>
                <Breadcrumbs />
                {currentNavItem && (
                  <h1 className="text-xl font-bold text-ink-900 mt-1">{currentNavItem.name}</h1>
                )}
              </div>
              <div className="flex items-center gap-2">
                {currentNavItem && (
                  <button
                    onClick={() => toggleFavorite({ id: currentNavItem.id, path: pathMap[currentNavItem.id] || '', label: currentNavItem.name })}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                      isFavorite(currentNavItem.id) ? 'text-warning-custom hover:text-warning-custom/80' : 'text-ink-400 hover:text-ink-600 hover:bg-surface-hover'
                    }`}
                    title={isFavorite(currentNavItem.id) ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Star className={`w-4 h-4 ${isFavorite(currentNavItem.id) ? 'fill-warning-custom' : ''}`} />
                  </button>
                )}
              </div>
            </div>
          )}
          {children || <Outlet />}
        </main>

        {!isSettingsPage && <Footer />}
      </div>

      <QuickActionsBar />
      <ChatWidget />
    </>
  );
}