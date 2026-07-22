import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, BarChart3, Bell, Globe, Building, Users2, Settings,
  Palette, LifeBuoy, Megaphone, Gauge, FlaskConical, Activity, Shield,
  LogOut, Search, Menu, X, ChevronDown, PanelLeftClose, PanelLeft,
  HelpCircle, CreditCard, Receipt, Tag, Package, ExternalLink
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', path: '/platform', icon: LayoutDashboard },
  { name: 'SaaS Analytics', path: '/platform/analytics', icon: BarChart3 },
  { name: 'Notifications Engine', path: '/platform/notifications', icon: Bell },
  { name: 'Regional Pricing', path: '/platform/regional-pricing', icon: Globe },
  { name: 'Enterprise Contracts', path: '/platform/enterprise-contracts', icon: Building },
  { name: 'Reseller Contracts', path: '/platform/reseller-contracts', icon: Users2 },
  { name: 'Org Config', path: '/platform/org-config', icon: Settings },
  { name: 'White Label', path: '/platform/white-label', icon: Palette },
  { name: 'Support Tickets', path: '/platform/support-tickets', icon: LifeBuoy },
  { name: 'Announcements', path: '/platform/announcements', icon: Megaphone },
  { name: 'Rate Limits', path: '/platform/rate-limits', icon: Gauge },
  { name: 'Feature Rollouts', path: '/platform/feature-rollouts', icon: FlaskConical },
  { name: 'System Health', path: '/platform/system-health', icon: Activity },
  // Subscription Management
  { name: 'Plans', path: '/platform/plans', icon: CreditCard },
  { name: 'Subscriptions', path: '/platform/subscriptions', icon: Building },
  { name: 'Subscription Portal', path: '/platform/subscriptions/portal', icon: ExternalLink },
  { name: 'Billing', path: '/platform/subscriptions/billing', icon: Receipt },
  { name: 'Coupons', path: '/platform/subscriptions/coupons', icon: Tag },
  { name: 'Add-ons', path: '/platform/subscriptions/addons', icon: Package },
];

export function PlatformLayout({ children }: { children?: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredNav = useMemo(() => {
    if (!searchQuery.trim()) return navItems;
    const q = searchQuery.toLowerCase();
    return navItems.filter(item =>
      item.name.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleLogout = async () => { await logout(); navigate('/platform/login'); };

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const el = event.target as HTMLElement;
      if (showUserMenu) {
        const btn = document.getElementById('platform-profile-button');
        const dd = document.getElementById('platform-profile-dropdown');
        if (btn && !btn.contains(el) && dd && !dd.contains(el)) setShowUserMenu(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showUserMenu]);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 z-40 h-screen flex flex-col bg-[#082F49] transition-all duration-300 ease-in-out ${
        sidebarCollapsed ? 'w-16' : 'w-60'
      } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className={`flex items-center shrink-0 border-b border-white/10 ${
          sidebarCollapsed ? 'h-14 justify-center px-2' : 'h-16 px-4'
        }`}>
          {sidebarCollapsed ? (
            <img src="/images/skyhouse-logo.png" alt="SkyHouse" className="w-10 h-10 rounded-lg object-contain shrink-0" />
          ) : (
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <img src="/images/skyhouse-logo.png" alt="SkyHouse" className="w-10 h-10 rounded-lg object-contain shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-white truncate leading-tight">SkyHouse</div>
                <div className="text-[10px] text-white/50 font-medium truncate leading-tight">Platform Admin</div>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex items-center justify-center w-6 h-6 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <PanelLeftClose className={`w-4 h-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
          <button onClick={() => setIsMobileOpen(false)} className="lg:hidden w-7 h-7 flex items-center justify-center text-white/50">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!sidebarCollapsed && (
          <div className="px-3 pt-3 pb-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white/10 text-white placeholder-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                autoComplete="off"
              />
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {filteredNav.map(item => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setIsMobileOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-[13px] rounded-lg transition-all duration-150 ${
                  sidebarCollapsed ? 'justify-center px-0' : ''
                } ${
                  active
                    ? 'bg-white/15 text-white font-semibold'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
                title={sidebarCollapsed ? item.name : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">{item.name}</span>}
              </button>
            );
          })}
        </nav>

        {!sidebarCollapsed && (
          <div className="p-2.5 border-t border-white/10">
            <div className="flex items-center gap-2.5 px-2 py-1.5">
              <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 bg-white/20 flex items-center justify-center text-white text-[11px] font-bold">
                {user?.fullName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-white truncate leading-tight">{user?.fullName || user?.email}</div>
                <div className="text-[10px] text-white/50 truncate leading-tight">Administrator</div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main area */}
      <div className={`flex-1 flex flex-col min-w-0 min-h-screen transition-all duration-300 ${
        sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-60'
      }`}>
        {/* Top bar */}
        <header className="sticky top-0 z-20 h-14 md:h-16 bg-white border-b border-slate-200 flex items-center gap-3 px-3 md:px-5">
          <button onClick={() => setIsMobileOpen(true)} className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
            <Menu className="w-4.5 h-4.5" />
          </button>

          <div className="flex-1" />

          <div className="relative">
            <button
              id="platform-profile-button"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-8 h-8 rounded-full bg-[#082F49] flex items-center justify-center text-white text-xs font-bold overflow-hidden"
            >
              {user?.fullName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'A'}
            </button>
            {showUserMenu && (
              <div
                id="platform-profile-dropdown"
                className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50"
              >
                <div className="px-4 py-3 border-b border-slate-100">
                  <div className="text-sm font-bold text-slate-800 truncate">{user?.fullName || user?.email}</div>
                  <div className="text-[11px] text-slate-500 capitalize">Administrator</div>
                </div>
                <div className="p-1.5">
                  <button
                    onClick={() => { setShowUserMenu(false); handleLogout(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Log Out Session
                  </button>
                  <button
                    onClick={() => { setShowUserMenu(false); window.open('/help/documents', '_blank'); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <HelpCircle className="w-4 h-4" />
                    Help & Support
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
