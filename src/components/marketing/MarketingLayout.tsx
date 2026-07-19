import React from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

export function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[#082F49] focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold focus:outline-none"
      >
        Skip to main content
      </a>
      <Navbar />
      <main id="main-content">{children}</main>
      <Footer />
    </div>
  );
}
