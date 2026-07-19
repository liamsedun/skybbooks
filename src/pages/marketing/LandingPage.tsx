import React, { Suspense, lazy } from 'react';
import '../../styles/landing-animations.css';
import { MarketingLayout } from '../../components/marketing/MarketingLayout';
import { SeoHead } from '../../components/seo/SeoHead';
import { HeroSection } from '../../components/marketing/HeroSection';
import { SectionSkeleton } from '../../components/ui/SectionSkeleton';

const FeaturesSection = lazy(() => import('../../components/marketing/FeaturesSection').then(m => ({ default: m.FeaturesSection })));
const WhySkyBooks = lazy(() => import('../../components/marketing/WhySkyBooks').then(m => ({ default: m.WhySkyBooks })));
const IndustriesServed = lazy(() => import('../../components/marketing/IndustriesServed'));
const AccountingModules = lazy(() => import('../../components/marketing/AccountingModules'));
const Automation = lazy(() => import('../../components/marketing/Automation'));
const ArtificialIntelligence = lazy(() => import('../../components/marketing/ArtificialIntelligence'));
const DashboardShowcase = lazy(() => import('../../components/marketing/DashboardShowcase'));
const Screenshots = lazy(() => import('../../components/marketing/Screenshots'));
const FeatureComparison = lazy(() => import('../../components/marketing/FeatureComparison').then(m => ({ default: m.FeatureComparison })));
const BenefitsSection = lazy(() => import('../../components/marketing/BenefitsSection').then(m => ({ default: m.BenefitsSection })));
const TestimonialsSection = lazy(() => import('../../components/marketing/TestimonialsSection').then(m => ({ default: m.TestimonialsSection })));
const CaseStudies = lazy(() => import('../../components/marketing/CaseStudies').then(m => ({ default: m.CaseStudies })));
const PricingSection = lazy(() => import('../../components/marketing/PricingSection').then(m => ({ default: m.PricingSection })));
const Security = lazy(() => import('../../components/marketing/Security').then(m => ({ default: m.Security })));
const Compliance = lazy(() => import('../../components/marketing/Compliance').then(m => ({ default: m.Compliance })));
const Integrations = lazy(() => import('../../components/marketing/Integrations').then(m => ({ default: m.Integrations })));
const FAQsSection = lazy(() => import('../../components/marketing/FAQsSection').then(m => ({ default: m.FAQsSection })));
const BlogPreview = lazy(() => import('../../components/marketing/BlogPreview').then(m => ({ default: m.BlogPreview })));
const Newsletter = lazy(() => import('../../components/marketing/Newsletter').then(m => ({ default: m.Newsletter })));
const CTASection = lazy(() => import('../../components/marketing/CTASection').then(m => ({ default: m.CTASection })));

export function LandingPage() {
  return (
    <MarketingLayout>
      <SeoHead
        description="SkyBooks is the all-in-one accounting platform built for Nigerian SMEs. Send invoices, track expenses, reconcile banks, run payroll, compute VAT/WHT/PAYE/CIT, and generate IFRS-compliant reports — all in one place."
        canonical="https://skyaccounting.com.ng"
      />
      <HeroSection />
      <Suspense fallback={<SectionSkeleton />}><FeaturesSection /></Suspense>
      <Suspense fallback={<SectionSkeleton />}><AccountingModules /></Suspense>
      <Suspense fallback={<SectionSkeleton />}><IndustriesServed /></Suspense>
      <Suspense fallback={<SectionSkeleton />}><WhySkyBooks /></Suspense>
      <Suspense fallback={<SectionSkeleton />}><BenefitsSection /></Suspense>
      <Suspense fallback={<SectionSkeleton />}><DashboardShowcase /></Suspense>
      <Suspense fallback={<SectionSkeleton />}><Screenshots /></Suspense>
      <Suspense fallback={<SectionSkeleton />}><Automation /></Suspense>
      <Suspense fallback={<SectionSkeleton />}><ArtificialIntelligence /></Suspense>
      <Suspense fallback={<SectionSkeleton />}><FeatureComparison /></Suspense>
      <Suspense fallback={<SectionSkeleton />}><TestimonialsSection /></Suspense>
      <Suspense fallback={<SectionSkeleton />}><CaseStudies /></Suspense>
      <Suspense fallback={<SectionSkeleton />}><PricingSection /></Suspense>
      <Suspense fallback={<SectionSkeleton />}><Security /></Suspense>
      <Suspense fallback={<SectionSkeleton />}><Compliance /></Suspense>
      <Suspense fallback={<SectionSkeleton />}><Integrations /></Suspense>
      <Suspense fallback={<SectionSkeleton />}><FAQsSection /></Suspense>
      <Suspense fallback={<SectionSkeleton />}><BlogPreview /></Suspense>
      <Suspense fallback={<SectionSkeleton />}><Newsletter /></Suspense>
      <Suspense fallback={<SectionSkeleton />}><CTASection /></Suspense>
    </MarketingLayout>
  );
}
