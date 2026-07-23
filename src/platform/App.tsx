import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/api';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { PlatformLayout } from '../components/layout/PlatformLayout';
import { ThemeProvider } from '../context/ThemeContext';
import { ToastProvider } from '../contexts/ToastContext';
import { useAuth } from '../hooks/useAuth';

const PlatformLoginPage = lazy(() => import('../pages/admin/PlatformLoginPage').then(m => ({ default: m.PlatformLoginPage })));
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
        <span className="text-xs text-ink-400 font-medium">Loading...</span>
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
      <div className="min-h-screen bg-surface-subtle flex items-center justify-center font-sans font-bold text-xs text-ink-400 select-none uppercase tracking-widest">
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
          <Route path="subscriptions" element={<Navigate to="/platform/organizations" replace />} />
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
