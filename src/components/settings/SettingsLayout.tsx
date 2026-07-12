import React, { useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2, Paintbrush, Globe, MapPinned, Users, Shield, UserCog,
  Settings, CreditCard, Clock, Scale, Bell, Store, Boxes,
  Hash, LayoutTemplate, Mail, Tag, Layers, Zap, ListChecks, History, Timer,
  Package, BarChart2, FileText, FileClock, Repeat, ReceiptText, Banknote,
  FileCheck, Truck, ClipboardList, ArrowLeftRight, Wallet, PuzzleIcon,
  ChevronDown, Search, Menu, X, ShoppingCart, Receipt, HelpCircle, ArrowLeft,
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
      { label: 'Taxes (VAT)', path: '/settings/taxes', icon: Receipt },
      { label: 'Tax Configuration', path: '/settings/tax', icon: FileText },
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

function groupLabel(group: string): string {
  return group.replace('Module Settings — ', '');
}

export function SettingsSidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  function toggle(group: string) {
    setCollapsed(prev => ({ ...prev, [group]: !prev[group] }));
  }

  // Groups that are "Module Settings — *" get consolidated under one umbrella
  const moduleSettingsGroups = NAV.filter(g => g.group.startsWith('Module Settings — '));
  const topLevelGroups = NAV.filter(g => !g.group.startsWith('Module Settings — '));

  // Filter by search query across both top-level and module sub-groups
  const query = searchQuery.toLowerCase().trim();
  const filteredTopLevel = useMemo(() => {
    if (!query) return topLevelGroups;
    return topLevelGroups
      .map(g => ({ ...g, items: g.items.filter(i => i.label.toLowerCase().includes(query)) }))
      .filter(g => g.items.length > 0);
  }, [query, topLevelGroups]);

  const filteredModuleSubGroups = useMemo(() => {
    if (!query) return moduleSettingsGroups;
    return moduleSettingsGroups
      .map(g => ({ ...g, items: g.items.filter(i => i.label.toLowerCase().includes(query)) }))
      .filter(g => g.items.length > 0);
  }, [query, moduleSettingsGroups]);

  // Active path helpers
  const currentPath = location.pathname;
  const activeItem = NAV.flatMap(g => g.items).find(i => i.path === currentPath);
  const activeGroupLabel = activeItem
    ? NAV.find(g => g.items.some(i => i.path === currentPath))?.group ?? ''
    : '';

  function renderGroup(group: NavGroup) {
    const isOpen = collapsed[group.group] !== false;
    const isActive = group.items.some(i => i.path === currentPath);
    const label = groupLabel(group.group);

    return (
      <div key={group.group} className="flex flex-col">
        <button
          onClick={() => toggle(group.group)}
          className={`flex items-center justify-between w-full px-2.5 py-1.5 text-left rounded-lg transition-all duration-150 ${
            isActive ? 'bg-primary-light/60' : 'hover:bg-surface-subtle'
          }`}
        >
          <span className={`text-[11px] font-bold tracking-[0.08em] uppercase ${
            isActive ? 'text-primary' : 'text-ink-400'
          }`}>
            {label}
          </span>
          {isOpen
            ? <ChevronDown size={12} className="text-ink-400" />
            : <ChevronDown size={12} className="text-ink-400 -rotate-90" />
          }
        </button>
        {isOpen && (
          <div className="flex flex-col space-y-0.5 mt-0.5 ml-0.5">
            {group.items.map(({ label, path, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs transition-all duration-150 ease-out group ${
                    isActive
                      ? 'bg-primary-light text-primary font-semibold shadow-sm'
                      : 'text-ink-600 hover:text-primary hover:bg-surface-subtle'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg shrink-0 transition-all duration-150 ${
                      isActive
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-transparent group-hover:bg-primary-light/50'
                    }`}>
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-ink-400 group-hover:text-primary'}`} />
                    </span>
                    {label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  }

  const sidebar = (
    <nav className="w-56 shrink-0 self-start sticky top-6">
      {/* Search */}
      <div className="relative mb-3">
        <Search className="w-3.5 h-3.5 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Find setting..."
          className="w-full pl-9 pr-3 py-2 text-xs font-medium border border-border-custom rounded-xl outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all duration-150 bg-white text-ink-900 placeholder-ink-400"
        />
      </div>

      <div className="bg-white border border-border-custom rounded-xl overflow-hidden max-h-[calc(100vh-12rem)] overflow-y-auto sidebar-scrollbar">
        {filteredTopLevel.map(renderGroup)}

        {/* Consolidated Module Settings */}
        {filteredModuleSubGroups.length > 0 && (
          <div className="flex flex-col">
            <button
              onClick={() => toggle('__module_settings')}
              className={`flex items-center justify-between w-full px-2.5 py-1.5 text-left rounded-lg transition-all duration-150 hover:bg-surface-subtle ${
                moduleSettingsGroups.some(g => g.items.some(i => i.path === currentPath))
                  ? 'bg-primary-light/60' : ''
              }`}
            >
              <span className={`text-[11px] font-bold tracking-[0.08em] uppercase ${
                moduleSettingsGroups.some(g => g.items.some(i => i.path === currentPath))
                  ? 'text-primary' : 'text-ink-400'
              }`}>
                Module Settings
              </span>
              {collapsed['__module_settings'] !== false
                ? <ChevronDown size={12} className="text-ink-400" />
                : <ChevronDown size={12} className="text-ink-400 -rotate-90" />
              }
            </button>
            {(collapsed['__module_settings'] !== false) && (
              <div className="flex flex-col space-y-0.5 mt-0.5 ml-0.5">
                {filteredModuleSubGroups.map(subGroup => (
                  <div key={subGroup.group} className="flex flex-col">
                    <span className="px-2.5 py-1 text-[10px] font-semibold text-ink-400 tracking-wider uppercase">
                      {groupLabel(subGroup.group)}
                    </span>
                    <div className="flex flex-col space-y-0.5">
                      {subGroup.items.map(({ label, path, icon: Icon }) => (
                        <NavLink
                          key={path}
                          to={path}
                          onClick={() => setMobileOpen(false)}
                          className={({ isActive }) =>
                            `flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs transition-all duration-150 ease-out group ${
                              isActive
                                ? 'bg-primary-light text-primary font-semibold shadow-sm'
                                : 'text-ink-600 hover:text-primary hover:bg-surface-subtle'
                            }`
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg shrink-0 transition-all duration-150 ${
                                isActive
                                  ? 'bg-primary text-white shadow-sm'
                                  : 'bg-transparent group-hover:bg-primary-light/50'
                              }`}>
                                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-ink-400 group-hover:text-primary'}`} />
                              </span>
                              {label}
                            </>
                          )}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Custom Modules remains as its own group if it has items */}
        {(() => {
          const cm = NAV.find(g => g.group === 'Custom Modules');
          if (!cm) return null;
          const cmItems = query ? cm.items.filter(i => i.label.toLowerCase().includes(query)) : cm.items;
          if (cmItems.length === 0) return null;
          return renderGroup({ ...cm, items: cmItems });
        })()}

        {filteredTopLevel.length === 0 && filteredModuleSubGroups.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-ink-400">
            No settings match your search.
          </div>
        )}
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile toggle — matches AppLayout drawer pattern */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden flex items-center gap-2 px-3 py-2 text-xs font-medium text-ink-600 bg-white border border-border-custom rounded-xl transition-all duration-150 hover:bg-surface-subtle mb-4"
      >
        {mobileOpen ? <X size={14} /> : <Menu size={14} />}
        {activeGroupLabel ? groupLabel(activeGroupLabel) : 'Settings Menu'}
        <ChevronDown size={12} className={`ml-auto transition-transform duration-200 ${mobileOpen ? 'rotate-180' : ''}`} />
      </button>
      {mobileOpen && (
        <div className="lg:hidden mb-6">{sidebar}</div>
      )}
      <div className="hidden lg:block">{sidebar}</div>
    </>
  );
}

export function SettingsLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  // Breadcrumb: derive group + page name from current path
  const currentPath = location.pathname;
  const activeGroup = NAV.find(g => g.items.some(i => i.path === currentPath));
  const activeItem = activeGroup?.items.find(i => i.path === currentPath);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-8 flex flex-col lg:flex-row gap-6 items-start">
      <SettingsSidebar />
      <div className="flex-1 min-w-0">
        {/* Back to Dashboard */}
        <button onClick={() => navigate('/dashboard')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-600 hover:text-primary transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        {/* Consistent page header */}
        {activeGroup && activeItem && (
          <div className="mb-6">
            <nav className="flex items-center gap-1.5 text-xs text-ink-400 mb-1.5">
              <span className="font-medium">Settings</span>
              <span className="text-ink-400">/</span>
              <span className="text-ink-600 font-medium">{groupLabel(activeGroup.group)}</span>
              <span className="text-ink-400">/</span>
              <span className="text-ink-900 font-semibold">{activeItem.label}</span>
            </nav>
            <h1 className="text-xl font-extrabold text-ink-900">
              {activeItem.label}
            </h1>
          </div>
        )}
        <Outlet />
      </div>
    </div>
  );
}

export { NAV };
