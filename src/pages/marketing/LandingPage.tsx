import React from 'react';
import { MarketingLayout } from '../../components/marketing/MarketingLayout';
import { HeroSection } from '../../components/marketing/HeroSection';
import { FeaturesSection } from '../../components/marketing/FeaturesSection';
import { HowItWorksSection } from '../../components/marketing/HowItWorksSection';
import { PricingSection } from '../../components/marketing/PricingSection';
import { TestimonialsSection } from '../../components/marketing/TestimonialsSection';
import { FAQsSection } from '../../components/marketing/FAQsSection';
import { CTASection } from '../../components/marketing/CTASection';

export function LandingPage() {
  return (
    <MarketingLayout>
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <TestimonialsSection />
      <PricingSection />
      <FAQsSection />
      <CTASection />
    </MarketingLayout>
  );
}
