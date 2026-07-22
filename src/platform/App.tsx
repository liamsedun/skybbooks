import React, { Suspense, lazy, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/api';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { PlatformLayout } from '../components/layout/PlatformLayout';
import { ThemeProvider } from '../context/ThemeContext';
import { ToastProvider } from '../contexts/ToastContext';
import { useAuth } from '../hooks/useAuth';
import { LogIn, ShieldAlert, Eye, EyeOff, AlertCircle, Mail, Lock } from 'lucide-react';

const PlatformDashboardPage = lazy(() => import('../pages/admin/PlatformDashboardPage').then(m => ({ default: m.PlatformDashboardPage })));
const OrganizationsPage = lazy(() => import('../pages/admin/OrganizationsPage').then(m => ({ default: m.OrganizationsPage })));
const PlatformUsersPage = lazy(() => import('../pages/admin/PlatformUsersPage').then(m => ({ default: m.PlatformUsersPage })));
const PlatformRolesPage = lazy(() => import('../pages/admin/PlatformRolesPage').then(m => ({ default: m.PlatformRolesPage })));
const PlatformApiKeysPage = lazy(() => import('../pages/admin/PlatformApiKeysPage').then(m => ({ default: m.PlatformApiKeysPage })));
const PlatformAuditLogPage = lazy(() => import('../pages/admin/PlatformAuditLogPage').then(m => ({ default: m.PlatformAuditLogPage })));
const PlatformProfilePage = lazy(() => import('../pages/admin/PlatformProfilePage').then(m => ({ default: m.PlatformProfilePage })));
const PlatformSecurityPage = lazy(() => import('../pages/admin/PlatformSecurityPage').then(m => ({ default: m.PlatformSecurityPage })));
const PlatformSystemSettingsPage = lazy(() => import('../pages/admin/PlatformSystemSettingsPage').then(m => ({ default: m.PlatformSystemSettingsPage })));
const SaaSAnalyticsDashboard = lazy(() => import('../pages/admin/SaaSAnalyticsDashboard').then(m => ({ default: m.SaaSAnalyticsDashboard })));
const SupportTicketsPage = lazy(() => import('../pages/admin/SupportTicketsPage').then(m => ({ default: m.SupportTicketsPage })));
const AnnouncementsPage = lazy(() => import('../pages/admin/AnnouncementsPage').then(m => ({ default: m.AnnouncementsPage })));
const FeatureRolloutsPage = lazy(() => import('../pages/admin/FeatureRolloutsPage').then(m => ({ default: m.FeatureRolloutsPage })));
const SystemHealthPage = lazy(() => import('../pages/admin/SystemHealthPage').then(m => ({ default: m.SystemHealthPage })));

const SubscriptionPage = lazy(() => import('../pages/subscriptions/SubscriptionPage').then(m => ({ default: m.SubscriptionPage })));
const SubscriptionPlansPage = lazy(() => import('../pages/subscriptions/SubscriptionPlansPage').then(m => ({ default: m.SubscriptionPlansPage })));
const SubscriptionPortalPage = lazy(() => import('../pages/subscriptions/SubscriptionPortalPage').then(m => ({ default: m.SubscriptionPortalPage })));
const SubscriptionCouponsPage = lazy(() => import('../pages/subscriptions/SubscriptionCouponsPage').then(m => ({ default: m.SubscriptionCouponsPage })));
const SubscriptionBillingPage = lazy(() => import('../pages/subscriptions/SubscriptionBillingPage').then(m => ({ default: m.SubscriptionBillingPage })));
const AddonMarketplacePage = lazy(() => import('../pages/subscriptions/AddonMarketplacePage').then(m => ({ default: m.AddonMarketplacePage })));

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

function ProtectedPlatformRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans font-bold text-xs text-slate-400 select-none uppercase tracking-widest">
        Verifying Security Vault...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/platform/login" replace />;
  }

  return (
    <PlatformLayout>
      <Outlet />
    </PlatformLayout>
  );
}

function PlatformLoginPage() {
  const { platformLogin, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState('');

  if (isAuthenticated) {
    return <Navigate to="/platform" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setLoginError('');
    try {
      await platformLogin(email, password);
      navigate('/platform');
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.08),transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(6,182,212,0.06),transparent_50%)] pointer-events-none" />

      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm mb-4 ring-1 ring-white/10">
            <ShieldAlert className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Platform Admin</h1>
          <p className="text-sm text-slate-400 mt-1">Sign in to SkyHouse administration</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 shadow-2xl ring-1 ring-white/10 space-y-4">
          {loginError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-3 py-2.5 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {loginError}
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@skyhouse.com"
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-900/60 border border-slate-700/60 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all"
                required
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-900/60 border border-slate-700/60 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || isLoading}
            className="w-full py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Sign In
              </>
            )}
          </button>
        </form>

        <p className="text-center mt-6 text-xs text-slate-600">
          SkyHouse Platform Administration &middot; Authorized access only
        </p>
      </div>
    </div>
  );
}

function AdminRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/platform/login" element={<PlatformLoginPage />} />

        <Route path="/platform" element={<ProtectedPlatformRoute />}>
          <Route index element={<LazyRoute element={<PlatformDashboardPage />} />} />

          {/* Core Platform Management */}
          <Route path="organizations" element={<LazyRoute element={<OrganizationsPage />} />} />
          <Route path="users" element={<LazyRoute element={<PlatformUsersPage />} />} />
          <Route path="roles" element={<LazyRoute element={<PlatformRolesPage />} />} />
          <Route path="subscriptions" element={<LazyRoute element={<SubscriptionPage />} />} />
          <Route path="subscriptions/portal" element={<LazyRoute element={<SubscriptionPortalPage />} />} />
          <Route path="plans" element={<LazyRoute element={<SubscriptionPlansPage />} />} />
          <Route path="subscriptions/coupons" element={<LazyRoute element={<SubscriptionCouponsPage />} />} />
          <Route path="subscriptions/billing" element={<LazyRoute element={<SubscriptionBillingPage />} />} />
          <Route path="subscriptions/addons" element={<LazyRoute element={<AddonMarketplacePage />} />} />

          {/* Analytics & Revenue */}
          <Route path="analytics" element={<LazyRoute element={<SaaSAnalyticsDashboard />} />} />

          {/* Customer-facing Operations */}
          <Route path="support-tickets" element={<LazyRoute element={<SupportTicketsPage />} />} />
          <Route path="announcements" element={<LazyRoute element={<AnnouncementsPage />} />} />

          {/* Platform Administration */}
          <Route path="api-keys" element={<LazyRoute element={<PlatformApiKeysPage />} />} />
          <Route path="audit" element={<LazyRoute element={<PlatformAuditLogPage />} />} />
          <Route path="feature-rollouts" element={<LazyRoute element={<FeatureRolloutsPage />} />} />
          <Route path="system-settings" element={<LazyRoute element={<PlatformSystemSettingsPage />} />} />
          <Route path="system-health" element={<LazyRoute element={<SystemHealthPage />} />} />
          <Route path="security" element={<LazyRoute element={<PlatformSecurityPage />} />} />
          <Route path="profile" element={<LazyRoute element={<PlatformProfilePage />} />} />
        </Route>

        <Route path="*" element={<Navigate to="/platform" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <Suspense fallback={<PageLoader />}>
              <AdminRoutes />
            </Suspense>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
