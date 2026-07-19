import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Sparkles, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Modules', href: '#modules' },
  { label: 'Why SkyBooks', href: '#why-skybooks' },
  { label: 'AI & Automation', href: '#ai-automation' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Testimonials', href: '#testimonials' },
  { label: 'FAQs', href: '#faqs' },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location]);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('#')) {
      e.preventDefault();
      const el = document.querySelector(href);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const isHashLink = (href: string) => href.startsWith('#');

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm' : 'bg-transparent'}`}>
      {/* Announcement banner */}
      {!bannerDismissed && (
        <div className="bg-gradient-to-r from-[#082F49] via-[#0C4A6E] to-[#0EA5E9] text-white text-center text-xs sm:text-sm py-2 px-4 relative">
          <span className="inline-flex items-center gap-1.5">
            <Sparkles size={14} className="text-yellow-300 shrink-0" />
            <span className="font-medium">New:</span>
            {' '}AI-powered invoice scanning &mdash; upload any receipt, we&rsquo;ll extract the data automatically.{' '}
            <a href="#features" className="underline font-semibold hover:text-yellow-200 transition-colors whitespace-nowrap">Learn more</a>
          </span>
          <button
            onClick={() => setBannerDismissed(true)}
            className="ml-2 align-middle text-white/60 hover:text-white transition-colors"
            aria-label="Dismiss announcement"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <Link to="/" className="flex items-center gap-2" aria-label="SkyBooks home">
            <div className="w-8 h-8 rounded-lg bg-[#082F49] flex items-center justify-center overflow-hidden">
              <img src="/images/skyhouse-logo.png" alt="" width="32" height="32" decoding="async" className="w-full h-full object-contain p-0.5" />
            </div>
            <span className="text-lg font-bold text-[#082F49]">SkyBooks</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8" aria-label="Main navigation">
            {NAV_LINKS.map(link =>
              isHashLink(link.href) ? (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={e => handleNavClick(e, link.href)}
                  className="text-sm font-medium text-slate-600 hover:text-[#082F49] transition-colors"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  to={link.href}
                  className="text-sm font-medium text-slate-600 hover:text-[#082F49] transition-colors"
                >
                  {link.label}
                </Link>
              )
            )}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <button
                onClick={() => navigate('/app/dashboard')}
                className="px-5 py-2 text-sm font-semibold text-white bg-[#082F49] hover:bg-[#0C4A6E] rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
                aria-label="Go to dashboard"
              >
                <LayoutDashboard size={14} aria-hidden="true" /> Dashboard
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/auth/login')}
                  className="px-5 py-2 text-sm font-medium text-slate-700 hover:text-[#082F49] transition-colors rounded-lg"
                >
                  Log in
                </button>
                <button
                  onClick={() => navigate('/auth/register')}
                  className="px-5 py-2 text-sm font-semibold text-white bg-[#082F49] hover:bg-[#0C4A6E] rounded-lg transition-colors shadow-sm"
                >
                  Sign Up
                </button>
              </>
            )}
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-slate-600 hover:text-[#082F49]"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-slate-100 shadow-lg">
          <div className="px-4 py-4 space-y-1">
            {NAV_LINKS.map(link =>
              isHashLink(link.href) ? (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={e => handleNavClick(e, link.href)}
                  className="block px-3 py-2.5 text-sm font-medium text-slate-600 hover:text-[#082F49] hover:bg-slate-50 rounded-lg transition-colors"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  to={link.href}
                  className="block px-3 py-2.5 text-sm font-medium text-slate-600 hover:text-[#082F49] hover:bg-slate-50 rounded-lg transition-colors"
                >
                  {link.label}
                </Link>
              )
            )}
            <hr className="my-3 border-slate-100" />
            {isAuthenticated ? (
              <button
                onClick={() => navigate('/app/dashboard')}
                className="w-full px-3 py-2.5 text-sm font-semibold text-white bg-[#082F49] hover:bg-[#0C4A6E] rounded-lg transition-colors text-center"
              >
                Dashboard
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/auth/login')}
                  className="w-full px-3 py-2.5 text-sm font-medium text-slate-700 hover:text-[#082F49] hover:bg-slate-50 rounded-lg transition-colors text-left"
                >
                  Log in
                </button>
                <button
                  onClick={() => navigate('/auth/register')}
                  className="w-full px-3 py-2.5 text-sm font-semibold text-white bg-[#082F49] hover:bg-[#0C4A6E] rounded-lg transition-colors mt-1"
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
