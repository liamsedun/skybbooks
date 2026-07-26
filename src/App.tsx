import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/api';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';

const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then(m => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('./pages/AuthPages').then(m => ({ default: m.ResetPasswordPage })));
const AcceptInvitePage = lazy(() => import('./pages/AuthPages').then(m => ({ default: m.AcceptInvitePage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));

const MarketingLandingPage = lazy(() => import('./pages/marketing/LandingPage').then(m => ({ default: m.LandingPage })));
const PricingPage = lazy(() => import('./pages/marketing/PricingPage').then(m => ({ default: m.PricingPage })));
const PrivacyPage = lazy(() => import('./pages/marketing/PrivacyPage').then(m => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('./pages/marketing/TermsPage').then(m => ({ default: m.TermsPage })));
const ContactPage = lazy(() => import('./pages/marketing/ContactPage').then(m => ({ default: m.ContactPage })));

const HelpDocumentsPage = lazy(() => import('./pages/help/HelpDocumentsPage').then(m => ({ default: m.HelpDocumentsPage })));
const FAQsPage = lazy(() => import('./pages/help/FAQsPage').then(m => ({ default: m.FAQsPage })));
const VideoTutorialsPage = lazy(() => import('./pages/help/VideoTutorialsPage').then(m => ({ default: m.VideoTutorialsPage })));
const MigrationGuidePage = lazy(() => import('./pages/help/MigrationGuidePage').then(m => ({ default: m.MigrationGuidePage })));
const HelpPage = lazy(() => import('./pages/help/HelpPage').then(m => ({ default: m.HelpPage })));

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

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LazyRoute element={<MarketingLandingPage />} />} />
        <Route path="/pricing" element={<LazyRoute element={<PricingPage />} />} />
        <Route path="/privacy" element={<LazyRoute element={<PrivacyPage />} />} />
        <Route path="/terms" element={<LazyRoute element={<TermsPage />} />} />
        <Route path="/contact" element={<LazyRoute element={<ContactPage />} />} />

        <Route path="/login" element={<LazyRoute element={<LoginPage />} />} />
        <Route path="/register" element={<LazyRoute element={<RegisterPage />} />} />
        <Route path="/forgot-password" element={<LazyRoute element={<ForgotPasswordPage />} />} />
        <Route path="/reset-password" element={<LazyRoute element={<ResetPasswordPage />} />} />
        <Route path="/accept-invite" element={<LazyRoute element={<AcceptInvitePage />} />} />
        <Route path="/auth/login" element={<Navigate to="/login" replace />} />
        <Route path="/auth/register" element={<Navigate to="/register" replace />} />
        <Route path="/auth/forgot-password" element={<Navigate to="/forgot-password" replace />} />
        <Route path="/auth/reset-password" element={<Navigate to="/reset-password" replace />} />
        <Route path="/auth/accept-invite" element={<Navigate to="/accept-invite" replace />} />

        <Route path="/help/documents" element={<LazyRoute element={<HelpDocumentsPage />} />} />
        <Route path="/help/faqs" element={<LazyRoute element={<FAQsPage />} />} />
        <Route path="/help/videos" element={<LazyRoute element={<VideoTutorialsPage />} />} />
        <Route path="/help/migration-guide" element={<LazyRoute element={<MigrationGuidePage />} />} />
        <Route path="/help" element={<LazyRoute element={<HelpPage />} />} />

        <Route path="*" element={<LazyRoute element={<NotFoundPage />} />} />
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
              <AppRoutes />
            </Suspense>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
