import React from 'react';
import { Mail, Phone, Twitter, Linkedin, Globe } from 'lucide-react';
import { usePlatformBranding } from '../../hooks/usePlatformBranding';

export function Footer() {
  const { developerLogoUrl } = usePlatformBranding();
  return (
    <footer className="footer-main mt-16 py-8 px-6 md:px-8" id="corporate-skyhouse-footer">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">

        {/* Brand identity */}
        <div className="flex items-center space-x-2.5 select-none">
          {developerLogoUrl ? (
            <img src={developerLogoUrl} alt="Developer Logo" className="w-8 h-8 rounded-lg object-contain border border-white/10 bg-white/5 p-0.5 shrink-0" />
          ) : (
            <img src="/images/skyhouse-logo.png" alt="SkyBooks" className="w-8 h-8 rounded-lg object-contain border border-white/10 bg-white/5 p-0.5 shrink-0" />
          )}
          <div>
            <h4 className="text-xs sm:text-sm font-black footer-text tracking-tight leading-none">SkyBooks</h4>
            <p className="text-[8px] sm:text-[10px] footer-text-muted mt-1 uppercase tracking-wider font-bold">
              <span className="hidden sm:inline">Product of Skyhouse Accounting & Analytics</span>
              <span className="inline sm:hidden">SKYHOUSE ANALYTICS</span>
            </p>
          </div>
        </div>

        {/* Social links */}
        <div className="flex items-center gap-2">
          <a
            href="tel:+2348157377000"
            className="p-2 rounded-xl footer-icon-btn border border-white/10 flex items-center justify-center"
            title="Call Phone (+234 815 737 7000)"
            aria-label="Call +234 815 737 7000"
          >
            <Phone className="h-3.5 w-3.5" />
          </a>
          <a
            href="mailto:hello@skyaccounting.com.ng"
            className="p-2 rounded-xl footer-icon-btn border border-white/10 flex items-center justify-center"
            title="Email: hello@skyaccounting.com.ng"
            aria-label="Email: hello@skyaccounting.com.ng"
          >
            <Mail className="h-3.5 w-3.5" />
          </a>
          <a
            href="https://www.skyaccounting.com.ng"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-xl footer-icon-btn border border-white/10 flex items-center justify-center"
            title="Website: www.skyaccounting.com.ng"
            aria-label="Website: www.skyaccounting.com.ng"
          >
            <Globe className="h-3.5 w-3.5" />
          </a>

          <div className="h-4 w-px footer-border mx-1 self-center" />

          <a
            href="https://facebook.com/skyhouse"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-xl footer-icon-btn border border-white/10 flex items-center justify-center"
            title="Facebook Page"
            aria-label="Facebook Profile"
          >
            <Twitter className="h-3.5 w-3.5" />
          </a>
          <a
            href="https://linkedin.com/company/skyhouse"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-xl footer-icon-btn border border-white/10 flex items-center justify-center"
            title="LinkedIn Corporate Profile"
            aria-label="LinkedIn Profile"
          >
            <Linkedin className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-6 pt-4 border-t footer-border flex flex-col sm:flex-row items-center justify-between text-[11px] footer-text-muted">
        <p>© {new Date().getFullYear()} Skyhouse. All rights reserved. Registered SaaS Workspace.</p>
        <div className="flex space-x-4 mt-2 sm:mt-0 font-medium font-mono uppercase text-[9px] tracking-widest footer-text-muted">
          <span>SECURE BANK SEC-FEED</span>
          <span className="footer-text-muted">•</span>
          <span>NIGERIAN GAAP & IFRS ENFORCED</span>
        </div>
      </div>
    </footer>
  );
}
