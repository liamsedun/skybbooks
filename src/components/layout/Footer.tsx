/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Mail, Phone, Twitter, Linkedin, Facebook, Globe } from 'lucide-react';
import { SkyhouseLogo } from '../ui/SkyhouseLogo';
import { useAuth } from '../../hooks/useAuth';

export function Footer() {
  const { organisation } = useAuth();
  return (
    <footer className="border-t border-slate-100 bg-white/70 backdrop-blur-md mt-16 py-8 px-6 md:px-8" id="corporate-skyhouse-footer">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        
        {/* Skyhouse Rebranded Identity Info */}
        <div className="flex items-center space-x-2.5 select-none">
          {organisation?.logoUrl ? (
            <img src={organisation.logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain border border-slate-100 bg-white p-0.5 shrink-0" />
          ) : (
            <SkyhouseLogo className="w-6 h-6 sm:w-8 sm:h-8 drop-shadow-sm shrink-0" />
          )}
          <div>
            <h4 className="text-xs sm:text-sm font-black text-slate-800 tracking-tight leading-none">SkyBooks</h4>
            <p className="text-[8px] sm:text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-bold">
              <span className="hidden sm:inline">Product of Skyhouse Accounting & Analytics</span>
              <span className="inline sm:hidden">SKYHOUSE ANALYTICS</span>
            </p>
          </div>
        </div>

        {/* Contacts & Social Interlinks (Icons Only) */}
        <div className="flex items-center gap-2">
          <a
            href="tel:+2348157377000"
            className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-100 flex items-center justify-center duration-150 cursor-pointer"
            title="Call Phone (+234 815 737 7000)"
            aria-label="Call +234 815 737 7000"
          >
            <Phone className="h-3.5 w-3.5" />
          </a>
          <a
            href="mailto:hello@skyaccounting.com.ng"
            className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-100 flex items-center justify-center duration-150 cursor-pointer"
            title="Email: hello@skyaccounting.com.ng"
            aria-label="Email: hello@skyaccounting.com.ng"
          >
            <Mail className="h-3.5 w-3.5" />
          </a>
          <a
            href="https://www.skyaccounting.com.ng"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-100 flex items-center justify-center duration-150 cursor-pointer"
            title="Website: www.skyaccounting.com.ng"
            aria-label="Website: www.skyaccounting.com.ng"
          >
            <Globe className="h-3.5 w-3.5" />
          </a>
          
          <div className="h-4 w-[1px] bg-slate-200 mx-1 self-center" />

          <a
            href="https://facebook.com/skyhouse"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-100 flex items-center justify-center duration-150 cursor-pointer"
            title="Facebook Page"
            aria-label="Facebook Profile"
          >
            <Facebook className="h-3.5 w-3.5" />
          </a>
          <a
            href="https://twitter.com/skyhouse"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-100 flex items-center justify-center duration-150 cursor-pointer"
            title="Twitter Stream"
            aria-label="Twitter Profile"
          >
            <Twitter className="h-3.5 w-3.5" />
          </a>
          <a
            href="https://linkedin.com/company/skyhouse"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-100 flex items-center justify-center duration-150 cursor-pointer"
            title="LinkedIn Corporate Profile"
            aria-label="LinkedIn Profile"
          >
            <Linkedin className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-6 pt-4 border-t border-slate-50 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400">
        <p>© {new Date().getFullYear()} Skyhouse. All rights reserved. Registered SaaS Workspace.</p>
        <div className="flex space-x-4 mt-2 sm:mt-0 font-medium font-mono uppercase text-[9px] tracking-widest text-slate-300">
          <span>SECURE BANK SEC-FEED</span>
          <span>•</span>
          <span>NIGERIAN GAAP & IFRS ENFORCED</span>
        </div>
      </div>
    </footer>
  );
}
