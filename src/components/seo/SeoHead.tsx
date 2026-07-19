import { useEffect } from 'react';

interface SeoHeadProps {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  canonical?: string;
  noIndex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const BASE_URL = 'https://skyaccounting.com.ng';
const SITE_NAME = 'SkyBooks';
const DEFAULT_DESC = 'All-in-one accounting platform for Nigerian SMEs. Invoicing, expense tracking, bank reconciliation, payroll, and tax compliance.';

export function SeoHead({
  title,
  description,
  ogTitle,
  ogDescription,
  ogImage,
  canonical,
  noIndex,
  jsonLd,
}: SeoHeadProps) {
  useEffect(() => {
    const fullTitle = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — Accounting Software for Nigerian SMEs`;
    const desc = description || DEFAULT_DESC;
    const ogT = ogTitle || fullTitle;
    const ogD = ogDescription || desc;
    const img = ogImage || `${BASE_URL}/og-image.png`;
    const url = canonical || window.location.href;

    document.title = fullTitle;

    const setMeta = (name: string, content: string, property?: string) => {
      const attr = property ? 'property' : 'name';
      let el = document.querySelector(`meta[${attr}="${property || name}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, property || name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const removeMeta = (name: string, property?: string) => {
      const attr = property ? 'property' : 'name';
      const el = document.querySelector(`meta[${attr}="${property || name}"]`);
      if (el) el.remove();
    };

    // Robots
    if (noIndex) {
      setMeta('robots', 'noindex, nofollow');
    } else {
      setMeta('robots', 'index, follow');
    }

    setMeta('description', desc);
    setMeta('og:title', ogT, 'og:title');
    setMeta('og:description', ogD, 'og:description');
    setMeta('og:image', img, 'og:image');
    setMeta('og:url', url, 'og:url');
    setMeta('og:type', 'website', 'og:type');
    setMeta('og:locale', 'en_NG', 'og:locale');
    setMeta('og:site_name', SITE_NAME, 'og:site_name');
    setMeta('twitter:card', 'summary_large_image', 'twitter:card');
    setMeta('twitter:title', ogT, 'twitter:title');
    setMeta('twitter:description', ogD, 'twitter:description');
    setMeta('twitter:image', img, 'twitter:image');

    // Canonical
    let canonicalEl = document.querySelector('link[rel="canonical"]');
    if (!canonicalEl) {
      canonicalEl = document.createElement('link');
      canonicalEl.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute('href', url);

    // JSON-LD
    const existingScript = document.querySelector('#seo-jsonld');
    if (existingScript) existingScript.remove();
    if (jsonLd) {
      const script = document.createElement('script');
      script.id = 'seo-jsonld';
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(Array.isArray(jsonLd) ? jsonLd : [jsonLd]);
      document.head.appendChild(script);
    }
  }, [title, description, ogTitle, ogDescription, ogImage, canonical, noIndex, jsonLd]);

  return null;
}
