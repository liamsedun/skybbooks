import React from 'react';
import '../../styles/landing-animations.css';
import { MarketingLayout } from '../../components/marketing/MarketingLayout';
import { HeroSection } from '../../components/marketing/HeroSection';
import { FeaturesSection } from '../../components/marketing/FeaturesSection';
import { WhySkyBooks } from '../../components/marketing/WhySkyBooks';
import IndustriesServed from '../../components/marketing/IndustriesServed';
import AccountingModules from '../../components/marketing/AccountingModules';
import Automation from '../../components/marketing/Automation';
import ArtificialIntelligence from '../../components/marketing/ArtificialIntelligence';
import DashboardShowcase from '../../components/marketing/DashboardShowcase';
import Screenshots from '../../components/marketing/Screenshots';
import { FeatureComparison } from '../../components/marketing/FeatureComparison';
import { BenefitsSection } from '../../components/marketing/BenefitsSection';
import { TestimonialsSection } from '../../components/marketing/TestimonialsSection';
import { CaseStudies } from '../../components/marketing/CaseStudies';
import { PricingSection } from '../../components/marketing/PricingSection';
import { Security } from '../../components/marketing/Security';
import { Compliance } from '../../components/marketing/Compliance';
import { Integrations } from '../../components/marketing/Integrations';
import { FAQsSection } from '../../components/marketing/FAQsSection';
import { BlogPreview } from '../../components/marketing/BlogPreview';
import { Newsletter } from '../../components/marketing/Newsletter';
import { CTASection } from '../../components/marketing/CTASection';

export function LandingPage() {
  return (
    <MarketingLayout>
      <HeroSection />
      <FeaturesSection />
      <AccountingModules />
      <IndustriesServed />
      <WhySkyBooks />
      <BenefitsSection />
      <DashboardShowcase />
      <Screenshots />
      <Automation />
      <ArtificialIntelligence />
      <FeatureComparison />
      <TestimonialsSection />
      <CaseStudies />
      <PricingSection />
      <Security />
      <Compliance />
      <Integrations />
      <FAQsSection />
      <BlogPreview />
      <Newsletter />
      <CTASection />
    </MarketingLayout>
  );
}
