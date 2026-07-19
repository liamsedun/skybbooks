import React from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { RefreshCw, CreditCard, Puzzle, Zap, Database, FileText, Cloud } from 'lucide-react';

/* ─── SVG Brand Logos ─── */

const PaystackLogo = () => (
  <svg viewBox="0 0 40 40" className="w-8 h-8">
    <rect width="40" height="40" rx="8" fill="#0BA4DB" />
    <path d="M12 28V12h4l8 10V12h4v16h-4l-8-10v10h-4z" fill="white" />
  </svg>
);

const FlutterwaveLogo = () => (
  <svg viewBox="0 0 40 40" className="w-8 h-8">
    <rect width="40" height="40" rx="8" fill="#F6352E" />
    <path d="M10 20c0-5.5 4.5-10 10-10s10 4.5 10 10-4.5 10-10 10" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M16 20l3 3 5-6" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MoniepointLogo = () => (
  <svg viewBox="0 0 40 40" className="w-8 h-8">
    <rect width="40" height="40" rx="8" fill="#1A1A2E" />
    <circle cx="20" cy="20" r="8" fill="none" stroke="#00D4AA" strokeWidth="2.5" />
    <path d="M20 14v6l4 2" fill="none" stroke="#00D4AA" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const StripeLogo = () => (
  <svg viewBox="0 0 40 40" className="w-8 h-8">
    <rect width="40" height="40" rx="8" fill="#635BFF" />
    <path d="M16 14h5c2.5 0 4.5 1.5 4.5 4s-2 4-4.5 4h-2v4h-3V14zm3 5.5h1.5c1 0 1.5-.5 1.5-1.5s-.5-1.5-1.5-1.5H19v3z" fill="white" />
  </svg>
);

const GoogleDriveLogo = () => (
  <svg viewBox="0 0 40 40" className="w-8 h-8">
    <rect width="40" height="40" rx="8" fill="#1A1A2E" />
    <path d="M8 28l8-14 8 14H8z" fill="#4285F4" />
    <path d="M16 14l8 14h8L24 14h-8z" fill="#EA4335" />
    <path d="M24 14l-8 14-8-6L16 8l8 6z" fill="#34A853" />
  </svg>
);

const Microsoft365Logo = () => (
  <svg viewBox="0 0 40 40" className="w-8 h-8">
    <rect width="40" height="40" rx="8" fill="#1A1A2E" />
    <rect x="8" y="8" width="10" height="10" rx="2" fill="#F25022" />
    <rect x="22" y="8" width="10" height="10" rx="2" fill="#7FBA00" />
    <rect x="8" y="22" width="10" height="10" rx="2" fill="#00A4EF" />
    <rect x="22" y="22" width="10" height="10" rx="2" fill="#FFB900" />
  </svg>
);

const GoogleWorkspaceLogo = () => (
  <svg viewBox="0 0 40 40" className="w-8 h-8">
    <rect width="40" height="40" rx="8" fill="#1A1A2E" />
    <circle cx="20" cy="16" r="5" fill="#4285F4" />
    <path d="M20 21c-4 0-7 1.8-7 4v2h14v-2c0-2.2-3-4-7-4z" fill="#34A853" />
    <rect x="16" y="9" width="8" height="3" rx="1" fill="#EA4335" />
  </svg>
);

const SlackLogo = () => (
  <svg viewBox="0 0 40 40" className="w-8 h-8">
    <rect width="40" height="40" rx="8" fill="#1A1A2E" />
    <rect x="10" y="16" width="4" height="8" rx="2" fill="#E01E5A" />
    <rect x="16" y="10" width="8" height="4" rx="2" fill="#36C5F0" />
    <rect x="26" y="16" width="4" height="8" rx="2" fill="#2EB67D" />
    <rect x="16" y="26" width="8" height="4" rx="2" fill="#ECB22E" />
    <path d="M14 20h5v-4" fill="none" stroke="#E01E5A" strokeWidth="1.5" />
    <path d="M20 14v5h4" fill="none" stroke="#36C5F0" strokeWidth="1.5" />
    <path d="M26 20h-5v4" fill="none" stroke="#2EB67D" strokeWidth="1.5" />
    <path d="M20 26v-5h-4" fill="none" stroke="#ECB22E" strokeWidth="1.5" />
  </svg>
);

const TeamsLogo = () => (
  <svg viewBox="0 0 40 40" className="w-8 h-8">
    <rect width="40" height="40" rx="8" fill="#1A1A2E" />
    <rect x="8" y="14" width="10" height="12" rx="3" fill="#635BFF" />
    <circle cx="13" cy="11" r="3" fill="#635BFF" />
    <rect x="20" y="10" width="12" height="16" rx="4" fill="#7C6BFF" />
    <circle cx="26" cy="8" r="3" fill="#7C6BFF" />
  </svg>
);

const ZoomLogo = () => (
  <svg viewBox="0 0 40 40" className="w-8 h-8">
    <rect width="40" height="40" rx="8" fill="#1A1A2E" />
    <circle cx="18" cy="20" r="8" fill="#0B5CFF" />
    <path d="M22 17l4 3-4 3v-6z" fill="white" />
  </svg>
);

const ShopifyLogo = () => (
  <svg viewBox="0 0 40 40" className="w-8 h-8">
    <rect width="40" height="40" rx="8" fill="#1A1A2E" />
    <path d="M12 28l2-16h4l.5-2c.3-1.2 1.5-2 2.8-1.7 1 .2 1.7 1 1.7 2l.4 1.7h4l2 16H12zm4.5-16l-.3 1.5H17l.3-1c.2-.8.8-1.2 1.5-1l.5 2H17l-.5-1.5zm5 0l-.3 1.5H22l.3-1c.2-.8.8-1.2 1.5-1l.5 2H22l-.5-1.5z" fill="#95BF47" />
    <circle cx="20" cy="22" r="3" fill="#5E8E3E" />
  </svg>
);

const WooCommerceLogo = () => (
  <svg viewBox="0 0 40 40" className="w-8 h-8">
    <rect width="40" height="40" rx="8" fill="#1A1A2E" />
    <path d="M8 28l3-16h5l2 8 2-8h5l3 16h-4l-1.5-10L20 28h-4l-2.5-10L14 28h-6z" fill="#96588A" />
    <circle cx="20" cy="18" r="2" fill="#7C3A6E" />
  </svg>
);

const ZapierLogo = () => (
  <svg viewBox="0 0 40 40" className="w-8 h-8">
    <rect width="40" height="40" rx="8" fill="#1A1A2E" />
    <path d="M20 8l2.5 7H30l-6 5 2.5 7L20 22l-6.5 5L16 20l-6-5h7.5L20 8z" fill="#FF4A00" />
  </svg>
);

const PowerBILogo = () => (
  <svg viewBox="0 0 40 40" className="w-8 h-8">
    <rect width="40" height="40" rx="8" fill="#1A1A2E" />
    <rect x="11" y="16" width="4" height="10" rx="1" fill="#F2C811" />
    <rect x="17" y="12" width="4" height="14" rx="1" fill="#F2C811" opacity="0.7" />
    <rect x="23" y="8" width="4" height="18" rx="1" fill="#F2C811" opacity="0.4" />
  </svg>
);

const ExcelLogo = () => (
  <svg viewBox="0 0 40 40" className="w-8 h-8">
    <rect width="40" height="40" rx="8" fill="#1A1A2E" />
    <rect x="10" y="8" width="20" height="24" rx="2" fill="#217346" />
    <path d="M14 14l4 6-4 6h3l2.5-4 2.5 4h3l-4-6 4-6h-3l-2.5 4L17 14h-3z" fill="white" />
  </svg>
);

const OutlookLogo = () => (
  <svg viewBox="0 0 40 40" className="w-8 h-8">
    <rect width="40" height="40" rx="8" fill="#1A1A2E" />
    <rect x="8" y="12" width="16" height="18" rx="2" fill="#0078D4" />
    <path d="M24 14l8 4v12l-8-4V14z" fill="#0078D4" opacity="0.8" />
    <path d="M14 18l3 2.5 3-2.5v7h-6v-7z" fill="white" />
  </svg>
);

const GmailLogo = () => (
  <svg viewBox="0 0 40 40" className="w-8 h-8">
    <rect width="40" height="40" rx="8" fill="#1A1A2E" />
    <rect x="8" y="12" width="24" height="16" rx="2" fill="white" />
    <path d="M8 14l12 8 12-8v2L20 24 8 16v-2z" fill="#EA4335" />
    <rect x="8" y="12" width="24" height="16" rx="2" fill="none" stroke="#EA4335" strokeWidth="1" />
  </svg>
);

const BankAPILogo = () => (
  <svg viewBox="0 0 40 40" className="w-8 h-8">
    <rect width="40" height="40" rx="8" fill="#1A1A2E" />
    <rect x="10" y="16" width="20" height="14" rx="2" fill="#0EA5E9" opacity="0.2" />
    <rect x="10" y="16" width="20" height="14" rx="2" fill="none" stroke="#0EA5E9" strokeWidth="1.5" />
    <path d="M20 10l-4 6h8l-4-6z" fill="#0EA5E9" />
    <rect x="16" y="22" width="8" height="4" rx="1" fill="#0EA5E9" opacity="0.6" />
    <line x1="18" y1="20" x2="22" y2="20" stroke="#0EA5E9" strokeWidth="1.5" />
  </svg>
);

const OCRLogo = () => (
  <svg viewBox="0 0 40 40" className="w-8 h-8">
    <rect width="40" height="40" rx="8" fill="#1A1A2E" />
    <rect x="10" y="12" width="20" height="16" rx="2" fill="#8B5CF6" opacity="0.2" />
    <rect x="10" y="12" width="20" height="16" rx="2" fill="none" stroke="#8B5CF6" strokeWidth="1.5" />
    <path d="M16 20l-2 3h12l-4-6-3 4-2-3z" fill="#8B5CF6" opacity="0.6" />
    <circle cx="15" cy="17" r="1.5" fill="#8B5CF6" />
    <path d="M14 12v-2h12v2" fill="#8B5CF6" opacity="0.4" />
  </svg>
);

/* ─── Data ─── */

interface Integration {
  name: string;
  logo: React.ComponentType;
  category: string;
}

const integrations: Integration[] = [
  { name: 'Paystack', logo: PaystackLogo, category: 'Payments' },
  { name: 'Flutterwave', logo: FlutterwaveLogo, category: 'Payments' },
  { name: 'Moniepoint', logo: MoniepointLogo, category: 'Payments' },
  { name: 'Stripe', logo: StripeLogo, category: 'Payments' },
  { name: 'Google Drive', logo: GoogleDriveLogo, category: 'Productivity' },
  { name: 'Microsoft 365', logo: Microsoft365Logo, category: 'Productivity' },
  { name: 'Google Workspace', logo: GoogleWorkspaceLogo, category: 'Productivity' },
  { name: 'Slack', logo: SlackLogo, category: 'Productivity' },
  { name: 'Teams', logo: TeamsLogo, category: 'Productivity' },
  { name: 'Zoom', logo: ZoomLogo, category: 'Productivity' },
  { name: 'Shopify', logo: ShopifyLogo, category: 'Commerce' },
  { name: 'WooCommerce', logo: WooCommerceLogo, category: 'Commerce' },
  { name: 'Zapier', logo: ZapierLogo, category: 'Automation' },
  { name: 'Power BI', logo: PowerBILogo, category: 'Analytics' },
  { name: 'Excel', logo: ExcelLogo, category: 'Analytics' },
  { name: 'Outlook', logo: OutlookLogo, category: 'Productivity' },
  { name: 'Gmail', logo: GmailLogo, category: 'Productivity' },
  { name: 'Bank APIs', logo: BankAPILogo, category: 'Banking' },
  { name: 'OCR Providers', logo: OCRLogo, category: 'Banking' },
];

const categories = [
  { icon: RefreshCw, title: 'Banking & Financial', desc: 'Connect directly to Nigerian banks, payment gateways, and OCR providers for automatic transaction sync.', count: 3 },
  { icon: CreditCard, title: 'Payments', desc: 'Seamless integration with leading payment gateways for real-time transaction reconciliation.', count: 4 },
  { icon: Cloud, title: 'Productivity & Office', desc: 'Sync with the tools your team already uses — email, calendars, documents, and chat.', count: 8 },
  { icon: Database, title: 'Commerce & Analytics', desc: 'Connect your e-commerce platform and BI tools for complete financial visibility.', count: 4 },
];

export function Integrations() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section id="integrations" className="py-16 lg:py-24 bg-slate-50 overflow-hidden section-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-widest">Integrations</span>
          <h2 className="mt-3 text-3xl lg:text-4xl font-bold text-[#082F49]">
            Connects with the tools you already use
          </h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            SkyBooks integrates with your bank, payment gateways, productivity suite, and e-commerce platforms — all in one place.
          </p>
        </div>

        {/* ─── Logo Grid ─── */}
        <div ref={ref} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-16">
          {integrations.map((item, i) => {
            const Logo = item.logo;
            return (
              <div
                key={item.name}
                className={`group relative flex flex-col items-center justify-center gap-2 bg-white rounded-xl border border-slate-200 p-4 transition-all duration-500 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
                style={{ transitionDelay: `${i * 50}ms` }}
              >
                {/* Hover glow */}
                <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{ boxShadow: 'inset 0 0 20px rgba(14,165,233,0.08)' }} />
                {/* Logo */}
                <div className="transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-0.5">
                  <Logo />
                </div>
                <span className="text-[11px] font-medium text-slate-600 group-hover:text-[#082F49] transition-colors duration-300">{item.name}</span>
                {/* Category badge on hover */}
                <div className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-[#0EA5E9] text-[8px] text-white font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  {item.category}
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── Category Cards ─── */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {categories.map((cat, i) => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.title}
                className={`bg-white rounded-2xl border border-slate-200 p-5 micro-lift transition-all duration-700 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center mb-3">
                  <Icon size={18} className="text-[#0EA5E9]" />
                </div>
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="text-sm font-bold text-[#082F49]">{cat.title}</h3>
                  <span className="text-[10px] font-semibold text-[#0EA5E9]">{cat.count} apps</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{cat.desc}</p>
              </div>
            );
          })}
        </div>

        {/* ─── Trust bar ─── */}
        <div className={`mt-10 text-center transition-all duration-700 delay-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-slate-200 shadow-sm text-xs text-slate-500">
            <span className="font-semibold text-[#0EA5E9]">Open API</span>
            <span className="text-slate-300">·</span>
            <span>Build custom integrations with our REST API</span>
            <span className="text-slate-300">·</span>
            <span className="text-[#0EA5E9] font-medium cursor-pointer hover:underline">View Docs &rarr;</span>
          </div>
        </div>
      </div>
    </section>
  );
}
