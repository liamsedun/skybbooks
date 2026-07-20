/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Search, ChevronDown, LayoutDashboard, Users, FileCode, FileText,
  DollarSign, Briefcase, History, MessageCircle, TrendingUp, Settings,
  Menu, X, Building, Bell, ArrowRight, LogOut, User, Shield, CreditCard,
  FileBarChart, HelpCircle, FileInput, BookOpen, Package,
  ArrowRightLeft, TrendingDown, ReceiptText, AlertTriangle, Bot, Wifi,
  Star, Zap, ChevronRight, PanelLeftClose, PanelLeft,
  CircleUser, Command, Plus, LayoutList, Home, Landmark,
  ShoppingCart, ShoppingBag, Receipt, Mail, Phone, ExternalLink, Video, RefreshCw, Tag,
  ToggleLeft, SlidersHorizontal, BarChart3
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Footer } from './Footer';
import { usePlatformBranding } from '../../hooks/usePlatformBranding';
import { useNotifications } from '../../hooks/useNotifications';
import { useFavorites } from '../../hooks/useFavorites';
import { useRecentActivity } from '../../hooks/useRecentActivity';
import { api, setPrintOrgInfo } from '../../lib/api';
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
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

export function AppLayout({ currentView, onViewChange, children }: AppLayoutProps) {
  const { user, organisation, logout } = useAuth();
  const { role, hasModuleAccess } = usePermissions();
  const { developerLogoUrl } = usePlatformBranding();
  const { notifications, unreadCount } = useNotifications();
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const { addActivity } = useRecentActivity();

  const totalUnread = unreadCount;
  const navigate = useNavigate();
  const location = useLocation();

  // Scroll to top on every route change
  React.useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);

  React.useEffect(() => {
    if (organisation) {
      setPrintOrgInfo({ name: organisation.name, address: organisation.address, phone: organisation.phone, email: organisation.email, logoUrl: organisation.logoUrl });
    }
  }, [organisation]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    OVERVIEW: false, SALES: false, PROJECTS: true,
    PURCHASES: true, INVENTORY: true, PAYROLL: true,
    BANKING: true, ACCOUNTANT: true, REPORTS: true, BILLING: true, SYSTEM: false,
  });
  const [showHelpSubMenu, setShowHelpSubMenu] = useState(false);
  const [showMailForm, setShowMailForm] = useState(false);
  const [mailSubject, setMailSubject] = useState('');
  const [mailMessage, setMailMessage] = useState('');
  const [headerSearchQuery, setHeaderSearchQuery] = useState('');
  const [showHeaderSearch, setShowHeaderSearch] = useState(false);
  const headerSearchRef = useRef<HTMLDivElement>(null);

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
      if (showNewMenu) {
        const btn = document.getElementById('header-new-button');
        const dd = document.getElementById('header-new-dropdown');
        if (btn && !btn.contains(el) && dd && !dd.contains(el)) setShowNewMenu(false);
      }
      if (showHeaderSearch && headerSearchRef.current && !headerSearchRef.current.contains(el)) {
        setShowHeaderSearch(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showUserMenu, showNotifications, showNewMenu, showHeaderSearch]);

  const pathMap: Record<string, string> = useMemo(() => ({
    dashboard: '/app/dashboard', ai_assistant: '/app/ai/assistant', ai_nvidia: '/app/ai/nvidia',
    customers: '/app/sales/customers', quotes: '/app/sales/quotes', sales_orders: '/app/sales/sales-orders',
    invoices: '/app/sales/invoices', receipts: '/app/sales/receipts', recurring_invoices: '/app/sales/recurring-invoices',
    payments_received: '/app/sales/payments', credit_notes: '/app/sales/credit-notes',
    vendors: '/app/purchases/vendors', expenses: '/app/purchases/expenses', recurring_expenses: '/app/purchases/recurring-expenses',
    purchase_orders: '/app/purchases/purchase-orders', bills: '/app/purchases/bills',
    recurring_bills: '/app/purchases/recurring-bills',
    payments_made: '/app/purchases/payments-made', purchase_credit_notes: '/app/purchases/credit-notes',
    items: '/app/inventory/items', inventory_adjustments: '/app/inventory/adjustments', inventory_management: '/app/inventory/management',
    employees: '/app/payroll/employees', payroll_runs: '/app/payroll/runs', paye_schedules: '/app/payroll/paye-schedules',
    pension_schedules: '/app/payroll/pension-schedules', payslips: '/app/payroll/payslips',
    bank_accounts: '/app/banking', bank_feed: '/app/banking/reconciliation/demo',
    bank_connections: '/app/banking/connections', payment_gateway: '/app/banking/payment-gateway',
    banking_rules: '/app/banking/rules', currency_rates: '/app/banking/currency-rates', bank_transfers: '/app/banking/transfers',
    projects: '/app/projects', chart_accounts: '/app/accountant/chart-of-accounts', manual_journals: '/app/accountant/journals',
    budgets: '/app/accountant/budgets', fixed_assets: '/app/accountant/fixed-assets', depreciation: '/app/accountant/fixed-assets/depreciation',
    leases: '/app/accountant/leases', ocr: '/app/accountant/ocr', intercompany: '/app/accountant/intercompany',
    ecl: '/app/accountant/ecl',
    rep_trial_balance: '/app/reports/trial-balance', rep_income_statement: '/app/reports/income-statement',
    rep_balance_sheet: '/app/reports/balance-sheet', rep_cash_flow: '/app/reports/cash-flow',
    rep_changes_in_equity: '/app/reports/statement-of-changes-in-equity', rep_general_ledger: '/app/reports/general-ledger',
    rep_vat_return: '/app/reports/vat-return', rep_aged_receivables: '/app/reports/aged-receivables',
    rep_aged_payables: '/app/reports/aged-payables', rep_audit_logs: '/app/reports/audit-logs',
    rep_custom: '/app/reports/custom', rep_tax_computation: '/app/reports/tax-computation',
    rep_tax_engine: '/app/reports/tax-engine', rep_projects: '/app/reports/projects', rep_legacy: '/app/reports/legacy',
    rep_consolidation: '/app/reports/consolidation',
    revenue_contracts: '/app/revenue/contracts', rep_revenue_recognition: '/app/revenue/recognition-report',
    subscription: '/app/subscription', subscription_plans: '/app/subscription/plans', subscription_coupons: '/app/subscription/coupons', subscription_portal: '/app/subscription/portal',
    subscription_addons: '/app/subscription/addons',
    usage_monitor: '/app/reports/usage-monitor',
    set_organisation: '/app/settings/organisation', set_invites: '/app/settings/invites', set_roles: '/app/settings/roles',
    user_preferences: '/app/settings/user-preferences', set_integrations: '/app/settings/integrations',
    feature_flags: '/app/settings/feature-flags', plan_features: '/app/settings/feature-flags/plans',
  }), []);

  const navigation: NavGroup[] = useMemo(() => [
    { title: 'OVERVIEW', icon: LayoutDashboard, items: [
      { name: 'Dashboard', id: 'dashboard', icon: LayoutDashboard },
      { name: 'Smart Assistant', id: 'ai_assistant', icon: Bot },
      { name: 'NVIDIA AI', id: 'ai_nvidia', icon: Zap },
    ]},
    { title: 'SALES', icon: ShoppingCart, items: [
      { name: 'Customers', id: 'customers', icon: Users },
      { name: 'Quotes', id: 'quotes', icon: FileText },
      { name: 'Sales Orders', id: 'sales_orders', icon: FileCode },
      { name: 'Invoices', id: 'invoices', icon: ReceiptText },
      { name: 'Receipts', id: 'receipts', icon: FileInput },
      { name: 'Recurring Invoices', id: 'recurring_invoices', icon: History },
      { name: 'Payments Received', id: 'payments_received', icon: DollarSign },
      { name: 'Credit Notes', id: 'credit_notes', icon: FileText },
    ]},
    { title: 'PROJECTS', icon: Briefcase, items: [
      { name: 'All Projects', id: 'projects', icon: Briefcase },
    ]},
    { title: 'PURCHASES', icon: ShoppingBag, items: [
      { name: 'Vendors', id: 'vendors', icon: Building },
      { name: 'Expenses', id: 'expenses', icon: CreditCard },
      { name: 'Recurring Expenses', id: 'recurring_expenses', icon: History },
      { name: 'Purchase Orders', id: 'purchase_orders', icon: FileCode },
      { name: 'Bills', id: 'bills', icon: FileText },
      { name: 'Recurring Bills', id: 'recurring_bills', icon: RefreshCw },
      { name: 'Payments Made', id: 'payments_made', icon: DollarSign },
      { name: 'Credit Notes', id: 'purchase_credit_notes', icon: FileText },
    ]},
    { title: 'INVENTORY', icon: Package, items: [
      { name: 'Items & Services', id: 'items', icon: Package },
      { name: 'Inventory Adjustments', id: 'inventory_adjustments', icon: TrendingDown },
      { name: 'Inventory Management', id: 'inventory_management', icon: LayoutList },
    ]},
    { title: 'PAYROLL', icon: Users, items: [
      { name: 'Employees', id: 'employees', icon: Users },
      { name: 'Payroll Runs', id: 'payroll_runs', icon: FileText },
      { name: 'PAYE Schedules', id: 'paye_schedules', icon: FileCode },
      { name: 'Pension Schedules', id: 'pension_schedules', icon: Shield },
      { name: 'Payslips', id: 'payslips', icon: FileInput },
    ]},
    { title: 'BANKING', icon: Landmark, items: [
      { name: 'Bank Accounts', id: 'bank_accounts', icon: Landmark },
      { name: 'Bank Feed Reconciler', id: 'bank_feed', icon: ArrowRightLeft },
      { name: 'Connections', id: 'bank_connections', icon: Wifi },
      { name: 'Payment Gateway', id: 'payment_gateway', icon: CreditCard },
      { name: 'Rules', id: 'banking_rules', icon: Shield },
      { name: 'Currency Rates', id: 'currency_rates', icon: TrendingUp },
      { name: 'Transfers', id: 'bank_transfers', icon: ArrowRightLeft },
    ]},
    { title: 'ACCOUNTANT', icon: BookOpen, items: [
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
    { title: 'BILLING', icon: CreditCard, items: [
      { name: 'Subscription', id: 'subscription', icon: CreditCard },
      { name: 'Portal', id: 'subscription_portal', icon: ExternalLink },
      { name: 'Add-ons', id: 'subscription_addons', icon: Package },
      { name: 'Plans', id: 'subscription_plans', icon: CreditCard },
      { name: 'Coupons', id: 'subscription_coupons', icon: Tag },
    ]},
    { title: 'REPORTS', icon: FileBarChart, items: [
      { name: 'Trial Balance', id: 'rep_trial_balance', icon: FileBarChart },
      { name: 'Income Statement', id: 'rep_income_statement', icon: FileBarChart },
      { name: 'Balance Sheet', id: 'rep_balance_sheet', icon: FileBarChart },
      { name: 'Cash Flow Statement', id: 'rep_cash_flow', icon: FileBarChart },
      { name: 'Changes in Equity', id: 'rep_changes_in_equity', icon: FileBarChart },
      { name: 'General Ledger', id: 'rep_general_ledger', icon: BookOpen },
      { name: 'VAT Return', id: 'rep_vat_return', icon: FileBarChart },
      { name: 'Aged Receivables', id: 'rep_aged_receivables', icon: FileBarChart },
      { name: 'Aged Payables', id: 'rep_aged_payables', icon: FileBarChart },
      { name: 'Usage Monitor', id: 'usage_monitor', icon: BarChart3 },
      { name: 'Audit Logs', id: 'rep_audit_logs', icon: Shield },
      { name: 'Custom Reports', id: 'rep_custom', icon: FileBarChart },
      { name: 'Tax Computation', id: 'rep_tax_computation', icon: FileBarChart },
      { name: 'Tax Engine', id: 'rep_tax_engine', icon: Shield },
      { name: 'Project Report', id: 'rep_projects', icon: Briefcase },
      { name: 'Legacy Migration', id: 'rep_legacy', icon: History },
      { name: 'Consolidation', id: 'rep_consolidation', icon: Building },
      { name: 'Revenue Recognition', id: 'rep_revenue_recognition', icon: FileBarChart },
    ]},
    { title: 'SYSTEM', icon: Shield, items: [
      { name: 'Feature Flags', id: 'feature_flags', icon: ToggleLeft },
      { name: 'Plan Features', id: 'plan_features', icon: SlidersHorizontal },
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

  const isSettingsPage = location.pathname.startsWith('/app/settings');

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

  const newMenuItems = useMemo(() => [
    { label: 'Customer', icon: Users, path: '/app/sales/customers' },
    { label: 'Invoice', icon: ReceiptText, path: '/app/sales/invoices/new' },
    { label: 'Receipt', icon: FileInput, path: '/app/sales/receipts' },
    { label: 'Payment Received', icon: DollarSign, path: '/app/sales/payments' },
    { label: 'Sales Order', icon: FileCode, path: '/app/sales/sales-orders' },
    { label: 'Vendor', icon: Building, path: '/app/purchases/vendors' },
    { label: 'Expense', icon: CreditCard, path: '/app/purchases/expenses/new' },
    { label: 'Purchase Order', icon: FileCode, path: '/app/purchases/purchase-orders' },
    { label: 'Bill', icon: FileText, path: '/app/purchases/bills/new' },
    { label: 'Payment Made', icon: DollarSign, path: '/app/purchases/payments-made' },
    { label: 'Employee', icon: Users, path: '/app/payroll/employees' },
    { label: 'Payroll Run', icon: FileText, path: '/app/payroll/runs' },
    { label: 'New Manual Journal', icon: BookOpen, path: '/app/accountant/journals/new' },
  ], []);

  const handleLogout = async () => { await logout(); navigate('/auth/login'); };

  const currentNavItem = useMemo(() =>
    navigation.flatMap(g => g.items).find(i => i.id === activeNavId),
    [navigation, activeNavId]
  );

  const headerSearchResults = useMemo(() => {
    if (!headerSearchQuery.trim()) return [];
    const q = headerSearchQuery.toLowerCase();
    const all = navigation.flatMap(g => g.items.map(item => ({
      ...item,
      group: g.title,
      path: pathMap[item.id] || '',
    })));
    return all.filter(item =>
      item.name.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q)
    );
  }, [navigation, pathMap, headerSearchQuery]);

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
            <img src="/images/skyhouse-logo.png" alt="SkyBooks" className="w-10 h-10 rounded-lg object-contain shrink-0" />
          ) : (
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <img src="/images/skyhouse-logo.png" alt="SkyBooks" className="w-10 h-10 rounded-lg object-contain shrink-0" />
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
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sidebar-search-icon pointer-events-none" />
              <input
                type="text"
                placeholder="Search functions..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs sidebar-search rounded-lg transition-all"
                autoComplete="off"
              />
            </div>
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto sidebar-scrollbar px-2 py-1 space-y-0.5">
          {filteredNavigation.map(group => {
            const isCollapsed = collapsedGroups[group.title] !== false;
            const GroupIcon = group.icon;
            return (
              <div key={group.title}>
                {!sidebarCollapsed && (
                  <button
                    onClick={() => {
                      if (!isCollapsed) {
                        setCollapsedGroups(prev => ({ ...prev, [group.title]: true }));
                      } else {
                        setCollapsedGroups(prev => {
                          const allCollapsed = Object.fromEntries(Object.keys(prev).map(k => [k, true]));
                          return { ...allCollapsed, [group.title]: false };
                        });
                      }
                    }}
                    className="flex items-center justify-between w-full px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest sidebar-group-header transition-colors"
                  >
                    <span className="flex items-center gap-2"><GroupIcon className="w-3.5 h-3.5 sidebar-icon" />{group.title}</span>
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
                      className={`sidebar-nav-btn group relative w-full flex items-center gap-2 px-2.5 py-1 text-[13px] transition-all duration-150 ${
                        active ? 'active' : ''
                      } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
                      title={sidebarCollapsed ? item.name : undefined}
                    >
                      <Icon className={`w-4 h-4 shrink-0 sidebar-icon`} />
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
            className={`sidebar-nav-btn w-full flex items-center gap-2 px-2.5 py-1 rounded-xl text-[13px] transition-all duration-150 ${
              location.pathname.startsWith('/settings') ? 'active' : ''
            } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
          >
            <Settings className="w-4 h-4 shrink-0 sidebar-icon" />
            {!sidebarCollapsed && <span className="truncate sidebar-text">Settings</span>}
          </button>
        </div>

        {/* User footer */}
        {!sidebarCollapsed && (
          <div className="sidebar-user-section p-2.5">
            <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl sidebar-user-card">
              <div className="w-7 h-7 rounded-full shrink-0 overflow-hidden">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-white/20 flex items-center justify-center text-white text-[11px] font-bold">
                    {user?.fullName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                )}
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
        <header className="sticky top-0 z-20 h-14 md:h-16 header-main flex items-center gap-3 px-3 md:px-5">
          {/* Mobile menu */}
          <button
            onClick={() => setIsMobileOpen(true)}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg header-icon-btn"
          >
            <Menu className="w-4.5 h-4.5" />
          </button>

          {/* Org display */}
          <div className="flex items-center gap-2 min-w-0 mr-auto">
            {organisation?.logoUrl ? (
              <img src={organisation.logoUrl} alt="" className="w-12 h-12 rounded-md object-contain bg-white p-0.5 hidden sm:block ring-1 ring-white/20" />
            ) : (
              <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center text-white text-[10px] font-bold hidden sm:block">
                {organisation?.name?.charAt(0) || 'O'}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-bold header-text truncate leading-tight">
                {organisation?.name || 'SkyBooks'}
              </div>
              <div className="text-[10px] header-text-muted hidden sm:block leading-tight">
                <Breadcrumbs />
              </div>
            </div>
          </div>

          {/* Quick action buttons */}
          <div className="hidden md:flex items-center gap-1">
            <div className="relative">
              <button
                id="header-new-button"
                onClick={() => setShowNewMenu(!showNewMenu)}
                className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-hover transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                New
                <ChevronDown className="w-3 h-3" />
              </button>
              {showNewMenu && (
                <div
                  id="header-new-dropdown"
                  className="absolute right-0 top-full mt-2 w-52 bg-surface rounded-2xl shadow-xl border border-border-custom overflow-hidden z-50"
                >
                  <div className="p-1.5 max-h-80 overflow-y-auto">
                    {newMenuItems.map((item, i) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={i}
                          onClick={() => { setShowNewMenu(false); navigate(item.path); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-ink-600 hover:bg-surface-hover hover:text-ink-900 transition-colors"
                        >
                          <Icon className="w-4 h-4" />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative hidden sm:block" ref={headerSearchRef}>
            <div className="relative min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 header-search-icon pointer-events-none" />
              <input
                type="text"
                placeholder="Search anything..."
                value={headerSearchQuery}
                onChange={e => { setHeaderSearchQuery(e.target.value); setShowHeaderSearch(true); }}
                onFocus={() => setShowHeaderSearch(true)}
                onKeyDown={e => {
                  if (e.key === 'Escape') { setShowHeaderSearch(false); (e.target as HTMLInputElement).blur(); }
                  if (e.key === 'Enter' && headerSearchResults.length > 0) {
                    setShowHeaderSearch(false); setHeaderSearchQuery(''); handleNavigation(headerSearchResults[0].id);
                  }
                }}
                className="w-full pl-8 pr-8 py-1.5 text-xs header-search rounded-lg transition-all outline-none"
                autoComplete="off"
              />
              {!headerSearchQuery && (
                <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 header-kbd text-[9px]">⌘K</kbd>
              )}
            </div>
            {showHeaderSearch && headerSearchQuery.trim() && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-surface rounded-2xl shadow-xl border border-border-custom overflow-hidden z-50">
                <div className="p-1.5 max-h-72 overflow-y-auto">
                  {headerSearchResults.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-ink-400">No results found</div>
                  ) : (
                    headerSearchResults.slice(0, 20).map((item, i) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={i}
                          onClick={() => { setShowHeaderSearch(false); setHeaderSearchQuery(''); handleNavigation(item.id); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-ink-600 hover:bg-surface-hover hover:text-ink-900 transition-colors text-left"
                        >
                          <Icon className="w-4 h-4 shrink-0 text-ink-400" />
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-medium truncate">{item.name}</div>
                            <div className="text-[10px] text-ink-400 truncate">{item.group} · {item.path}</div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-1">
            {/* Notifications */}
            <div className="relative">
              <button
                id="header-notification-button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="w-8 h-8 flex items-center justify-center header-icon-btn relative"
              >
                <Bell className="w-4 h-4" />
                {totalUnread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full header-badge text-[9px] font-bold flex items-center justify-center shadow-sm">
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
                className="w-8 h-8 rounded-full header-avatar flex items-center justify-center text-xs font-bold overflow-hidden"
              >
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  user?.fullName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'
                )}
              </button>
              {showUserMenu && (
                <div
                  id="header-profile-dropdown"
                  className="absolute right-0 top-full mt-2 w-64 bg-surface rounded-2xl shadow-xl border border-border-custom overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-border-custom">
                    <div className="text-sm font-bold text-ink-900 truncate">{user?.fullName || user?.email}</div>
                    <div className="text-[11px] text-ink-400 capitalize">{user?.role} · {organisation?.name}</div>
                  </div>
                  <div className="p-1.5">
                    <button
                      onClick={() => { setShowUserMenu(false); navigate('/app/settings/user-preferences'); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-ink-600 hover:bg-surface-hover hover:text-ink-900 transition-colors"
                    >
                      <User className="w-4 h-4" />
                      User Preferences
                    </button>
                    <button
                      onClick={() => { setShowUserMenu(false); navigate('/app/settings/organisation'); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-ink-600 hover:bg-surface-hover hover:text-ink-900 transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      Organisation Settings
                    </button>
                    <button
                      onClick={() => setShowHelpSubMenu(!showHelpSubMenu)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-ink-600 hover:bg-surface-hover hover:text-ink-900 transition-colors"
                    >
                      <HelpCircle className="w-4 h-4" />
                      <span className="flex-1 text-left">Help & Support</span>
                      <ChevronDown className={`w-3.5 h-3.5 text-ink-400 transition-transform duration-200 ${showHelpSubMenu ? 'rotate-180' : ''}`} />
                    </button>
                    {showHelpSubMenu && (
                      <div className="ml-3 pl-3 border-l-2 border-indigo-100 space-y-0.5">
                        <button onClick={() => { setShowUserMenu(false); window.open('/help/documents', '_blank', 'noopener,noreferrer'); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs text-ink-500 hover:bg-surface-hover hover:text-ink-700 transition-colors"><BookOpen className="w-3.5 h-3.5" /> Help Documents</button>
                        <button onClick={() => { setShowUserMenu(false); window.open('/help/faqs', '_blank', 'noopener,noreferrer'); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs text-ink-500 hover:bg-surface-hover hover:text-ink-700 transition-colors"><HelpCircle className="w-3.5 h-3.5" /> FAQs</button>
                        <button onClick={() => { setShowUserMenu(false); window.open('/help/videos', '_blank', 'noopener,noreferrer'); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs text-ink-500 hover:bg-surface-hover hover:text-ink-700 transition-colors"><Video className="w-3.5 h-3.5" /> Video Tutorials</button>
                        <button onClick={() => { setShowUserMenu(false); window.open('/help/migration-guide', '_blank', 'noopener,noreferrer'); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs text-ink-500 hover:bg-surface-hover hover:text-ink-700 transition-colors"><ExternalLink className="w-3.5 h-3.5" /> Migration Guide</button>
                        <div className="h-px bg-border-custom my-1.5" />
                        <div className="flex items-center gap-1.5 px-3 py-1.5">
                          <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">WhatsApp</span>
                        </div>
                        <a href="https://wa.me/2348157377000" target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs text-ink-500 hover:bg-green-50 hover:text-green-700 transition-colors">
                          <MessageCircle className="w-3.5 h-3.5 text-green-600" /> <span>Chat on WhatsApp</span>
                        </a>
                        <a href="https://wa.me/2347058119864" target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs text-ink-500 hover:bg-green-50 hover:text-green-700 transition-colors">
                          <MessageCircle className="w-3.5 h-3.5 text-green-600" /> <span>Chat on WhatsApp</span>
                        </a>
                        <button onClick={() => { setShowMailForm(true); }}
                          className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs text-ink-500 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                          <Mail className="w-3.5 h-3.5 text-blue-600" /> Send an Email
                        </button>
                        <div className="h-px bg-border-custom my-1.5" />
                        <div className="flex items-center gap-1.5 px-3 py-1.5">
                          <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Talk to us</span>
                          <span className="text-[9px] text-ink-300">(Mon - Fri)</span>
                        </div>
                        <a href="tel:+2348157377000" className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs text-ink-500 hover:bg-surface-hover hover:text-ink-700 transition-colors"><Phone className="w-3.5 h-3.5" /> +234 815 737 7000</a>
                        <a href="tel:+2347058119864" className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs text-ink-500 hover:bg-surface-hover hover:text-ink-700 transition-colors"><Phone className="w-3.5 h-3.5" /> +234 705 811 9864</a>
                      </div>
                    )}
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
                <Breadcrumbs variant="content" />
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

      {/* Email form modal */}
      {showMailForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowMailForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/15 rounded-xl"><Mail className="w-5 h-5" /></div>
                <div>
                  <h2 className="text-base font-bold">Send an Email</h2>
                  <p className="text-[11px] text-indigo-200">We typically respond within 24 hours</p>
                </div>
              </div>
              <button onClick={() => setShowMailForm(false)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Subject</label>
                <div className="relative">
                  <input type="text" placeholder="e.g. Account query, Feature request..." value={mailSubject} onChange={e => setMailSubject(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all placeholder:text-slate-400" />
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Message</label>
                <textarea placeholder="Describe your issue or question in detail..." rows={5} value={mailMessage} onChange={e => setMailMessage(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all resize-none placeholder:text-slate-400" />
              </div>
              <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3.5 py-2.5">
                <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />
                <p className="text-[11px] text-slate-500">We'll reply to <strong className="text-slate-700">{user?.email || 'your email'}</strong></p>
              </div>
              <div className="flex justify-end gap-2.5 pt-1">
                <button onClick={() => setShowMailForm(false)} className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
                <button onClick={() => { const a = document.createElement('a'); a.href = `mailto:hello@skyaccounting.com.ng?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailMessage)}`; a.click(); setShowMailForm(false); setMailSubject(''); setMailMessage(''); }}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 shadow-sm transition-all">Send Message</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}