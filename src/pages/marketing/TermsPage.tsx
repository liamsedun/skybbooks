import React from 'react';
import { MarketingLayout } from '../../components/marketing/MarketingLayout';

export function TermsPage() {
  return (
    <MarketingLayout>
      <div className="pt-24 pb-16 lg:pb-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl lg:text-4xl font-bold text-[#082F49] mb-4">Terms of Service</h1>
          <p className="text-sm text-slate-500 mb-8">Last updated: January 2026</p>

          <div className="prose prose-sm prose-slate max-w-none">
            <h2 className="text-lg font-semibold text-[#082F49] mt-8">1. Acceptance of Terms</h2>
            <p className="text-slate-600 leading-relaxed">
              By accessing or using SkyBooks (&ldquo;the Platform&rdquo;), you agree to be bound by these Terms of Service. 
              If you do not agree, you may not use the Platform.
            </p>

            <h2 className="text-lg font-semibold text-[#082F49] mt-8">2. Description of Service</h2>
            <p className="text-slate-600 leading-relaxed">
              SkyBooks provides cloud-based accounting software for businesses, including invoicing, expense tracking, 
              bank reconciliation, payroll management, financial reporting, and tax compliance features.
            </p>

            <h2 className="text-lg font-semibold text-[#082F49] mt-8">3. User Responsibilities</h2>
            <p className="text-slate-600 leading-relaxed">
              You are responsible for maintaining the confidentiality of your account credentials, for all activities 
              that occur under your account, and for ensuring that your use of the Platform complies with applicable laws.
            </p>

            <h2 className="text-lg font-semibold text-[#082F49] mt-8">4. Subscription and Billing</h2>
            <p className="text-slate-600 leading-relaxed">
              Paid plans are billed monthly or annually in advance. You may cancel your subscription at any time. 
              Refunds are provided in accordance with our refund policy. Prices are in Nigerian Naira (NGN).
            </p>

            <h2 className="text-lg font-semibold text-[#082F49] mt-8">5. Data Ownership</h2>
            <p className="text-slate-600 leading-relaxed">
              You retain full ownership of all data you enter into the Platform. We do not claim any intellectual property 
              rights over your business data. You may export your data at any time.
            </p>

            <h2 className="text-lg font-semibold text-[#082F49] mt-8">6. Limitation of Liability</h2>
            <p className="text-slate-600 leading-relaxed">
              SkyBooks shall not be liable for any indirect, incidental, special, consequential, or punitive damages 
              arising from your use of the Platform. Our total liability is limited to the amount you paid in the 
              12 months preceding the claim.
            </p>

            <h2 className="text-lg font-semibold text-[#082F49] mt-8">7. Service Level Agreement</h2>
            <p className="text-slate-600 leading-relaxed">
              We commit to 99.9% platform uptime. In the event of downtime exceeding our SLA, Enterprise customers 
              may be eligible for service credits as outlined in their agreement.
            </p>

            <h2 className="text-lg font-semibold text-[#082F49] mt-8">8. Termination</h2>
            <p className="text-slate-600 leading-relaxed">
              Either party may terminate this agreement with 30 days written notice. We may suspend or terminate 
              your access for violation of these terms, with notice where practicable.
            </p>

            <h2 className="text-lg font-semibold text-[#082F49] mt-8">9. Governing Law</h2>
            <p className="text-slate-600 leading-relaxed">
              These terms are governed by the laws of the Federal Republic of Nigeria. Any disputes shall be 
              resolved through binding arbitration in Lagos, Nigeria.
            </p>

            <h2 className="text-lg font-semibold text-[#082F49] mt-8">10. Contact</h2>
            <p className="text-slate-600 leading-relaxed">
              For questions about these terms, contact:<br />
              Email: hello@skyaccounting.com.ng<br />
              Phone: +234 815 737 7000
            </p>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
