import React, { Suspense, lazy, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/api';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { PlatformLayout } from '../components/layout/PlatformLayout';
import { ThemeProvider } from '../context/ThemeContext';
import { ToastProvider } from '../contexts/ToastContext';
import { useAuth } from '../hooks/useAuth';
import { LogIn, ShieldAlert } from 'lucide-react';

const SuperAdminDashboard = lazy(() => import('../pages/admin/SuperAdminDashboard').then(m => ({ default: m.SuperAdminDashboard })));
const SaaSAnalyticsDashboard = lazy(() => import('../pages/admin/SaaSAnalyticsDashboard').then(m => ({ default: m.SaaSAnalyticsDashboard })));
const SubscriptionNotificationsPage = lazy(() => import('../pages/admin/SubscriptionNotificationsPage').then(m => ({ default: m.SubscriptionNotificationsPage })));
const RegionalPricingPage = lazy(() => import('../pages/admin/RegionalPricingPage').then(m => ({ default: m.RegionalPricingPage })));
const EnterpriseContractsPage = lazy(() => import('../pages/admin/EnterpriseContractsPage').then(m => ({ default: m.EnterpriseContractsPage })));
const ResellerContractsPage = lazy(() => import('../pages/admin/ResellerContractsPage').then(m => ({ default: m.ResellerContractsPage })));
const OrgConfigPage = lazy(() => import('../pages/admin/OrgConfigPage').then(m => ({ default: m.OrgConfigPage })));
const WhiteLabelConfigPage = lazy(() => import('../pages/admin/WhiteLabelConfigPage').then(m => ({ default: m.WhiteLabelConfigPage })));
const SupportTicketsPage = lazy(() => import('../pages/admin/SupportTicketsPage').then(m => ({ default: m.SupportTicketsPage })));
const AnnouncementsPage = lazy(() => import('../pages/admin/AnnouncementsPage').then(m => ({ default: m.AnnouncementsPage })));
const RateLimitsPage = lazy(() => import('../pages/admin/RateLimitsPage').then(m => ({ default: m.RateLimitsPage })));
const FeatureRolloutsPage = lazy(() => import('../pages/admin/FeatureRolloutsPage').then(m => ({ default: m.FeatureRolloutsPage })));
const SystemHealthPage = lazy(() => import('../pages/admin/SystemHealthPage').then(m => ({ default: m.SystemHealthPage })));

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
  const { platformLogin, isAuthenticated, isLoading, error } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 mb-4">
            <ShieldAlert className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Platform Admin</h1>
          <p className="text-sm text-slate-400 mt-1">Sign in to SkyHouse administration</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-xl space-y-4">
          {loginError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-3 py-2">
              {loginError}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@skyhouse.com"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting || isLoading}
            className="w-full py-2.5 bg-[#082F49] text-white text-sm font-semibold rounded-xl hover:bg-[#0a3d5e] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center mt-6 text-xs text-slate-500">
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
          <Route index element={<LazyRoute element={<SuperAdminDashboard />} />} />
          <Route path="analytics" element={<LazyRoute element={<SaaSAnalyticsDashboard />} />} />
          <Route path="notifications" element={<LazyRoute element={<SubscriptionNotificationsPage />} />} />
          <Route path="regional-pricing" element={<LazyRoute element={<RegionalPricingPage />} />} />
          <Route path="enterprise-contracts" element={<LazyRoute element={<EnterpriseContractsPage />} />} />
          <Route path="reseller-contracts" element={<LazyRoute element={<ResellerContractsPage />} />} />
          <Route path="org-config" element={<LazyRoute element={<OrgConfigPage />} />} />
          <Route path="white-label" element={<LazyRoute element={<WhiteLabelConfigPage />} />} />
          <Route path="support-tickets" element={<LazyRoute element={<SupportTicketsPage />} />} />
          <Route path="announcements" element={<LazyRoute element={<AnnouncementsPage />} />} />
          <Route path="rate-limits" element={<LazyRoute element={<RateLimitsPage />} />} />
          <Route path="feature-rollouts" element={<LazyRoute element={<FeatureRolloutsPage />} />} />
          <Route path="system-health" element={<LazyRoute element={<SystemHealthPage />} />} />
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
