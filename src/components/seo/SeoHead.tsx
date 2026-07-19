import { useEffect } from 'react';

interface SeoHeadProps {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  canonical?: string;
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

    setMeta('description', desc);
    setMeta('og:title', ogT, 'og:title');
    setMeta('og:description', ogD, 'og:description');
    setMeta('og:image', img, 'og:image');
    setMeta('og:url', url, 'og:url');
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
  }, [title, description, ogTitle, ogDescription, ogImage, canonical]);

  return null;
}
