import React from 'react';
import { MarketingLayout } from '../../components/marketing/MarketingLayout';

export function PrivacyPage() {
  return (
    <MarketingLayout>
      <div className="pt-24 pb-16 lg:pb-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl lg:text-4xl font-bold text-[#082F49] mb-4">Privacy Policy</h1>
          <p className="text-sm text-slate-500 mb-8">Last updated: January 2026</p>

          <div className="prose prose-sm prose-slate max-w-none">
            <h2 className="text-lg font-semibold text-[#082F49] mt-8">1. Introduction</h2>
            <p className="text-slate-600 leading-relaxed">
              SkyBooks (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is committed to protecting your privacy. 
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our accounting platform.
            </p>

            <h2 className="text-lg font-semibold text-[#082F49] mt-8">2. Information We Collect</h2>
            <p className="text-slate-600 leading-relaxed">
              We collect information you provide directly to us, including your name, email address, phone number, 
              business details, and financial transaction data necessary for the operation of the accounting platform.
            </p>

            <h2 className="text-lg font-semibold text-[#082F49] mt-8">3. How We Use Your Information</h2>
            <p className="text-slate-600 leading-relaxed">
              We use the information we collect to provide, maintain, and improve our services; to process transactions; 
              to send you technical notices and support messages; and to comply with legal obligations.
            </p>

            <h2 className="text-lg font-semibold text-[#082F49] mt-8">4. Data Security</h2>
            <p className="text-slate-600 leading-relaxed">
              We implement industry-standard security measures including AES-256 encryption at rest, TLS 1.3 in transit, 
              and role-based access controls. Your financial data is backed up daily across multiple secure regions.
            </p>

            <h2 className="text-lg font-semibold text-[#082F49] mt-8">5. Data Retention</h2>
            <p className="text-slate-600 leading-relaxed">
              We retain your data for as long as your account is active or as needed to provide you services. 
              You can request deletion of your data at any time by contacting our support team.
            </p>

            <h2 className="text-lg font-semibold text-[#082F49] mt-8">6. Third-Party Services</h2>
            <p className="text-slate-600 leading-relaxed">
              We may share data with trusted third-party service providers who assist us in operating our platform, 
              such as payment processors and bank feed aggregators. These providers are bound by confidentiality agreements.
            </p>

            <h2 className="text-lg font-semibold text-[#082F49] mt-8">7. Your Rights</h2>
            <p className="text-slate-600 leading-relaxed">
              You have the right to access, correct, or delete your personal data. You may also restrict or object 
              to certain processing activities. To exercise these rights, contact us at hello@skyaccounting.com.ng.
            </p>

            <h2 className="text-lg font-semibold text-[#082F49] mt-8">8. Contact</h2>
            <p className="text-slate-600 leading-relaxed">
              If you have questions about this Privacy Policy, please contact us at:<br />
              Email: hello@skyaccounting.com.ng<br />
              Phone: +234 815 737 7000
            </p>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
