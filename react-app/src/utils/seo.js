import { useEffect } from 'react';

const SITE_ORIGIN = 'https://gigto.in';
const SITE_BASE = '';
const DEFAULT_TITLE = 'Gigtos - Verified Home Services In India';
const DEFAULT_DESCRIPTION = 'Book verified maid help, cleaning, electrician, and repair workers with transparent launch pricing and Smart Queue matching.';

function setMeta(name, content, attribute = 'name') {
  if (typeof document === 'undefined' || !content) return;
  let element = document.head.querySelector(`meta[${attribute}="${name}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, name);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function setCanonical(path) {
  if (typeof document === 'undefined') return;
  const href = `${SITE_ORIGIN}${SITE_BASE}${path || '/'}`;
  let element = document.head.querySelector('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

function setJsonLd(id, value) {
  if (typeof document === 'undefined') return;
  const elementId = `seo-jsonld-${id}`;
  let element = document.getElementById(elementId);
  if (!value) {
    if (element) element.remove();
    return;
  }
  if (!element) {
    element = document.createElement('script');
    element.id = elementId;
    element.type = 'application/ld+json';
    document.head.appendChild(element);
  }
  element.textContent = JSON.stringify(value);
}

export function buildPageUrl(path = '/') {
  return `${SITE_ORIGIN}${SITE_BASE}${path}`;
}

export function useSeo({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  path = '/',
  keywords = '',
  image = `${SITE_ORIGIN}${SITE_BASE}/og-image.png`,
  jsonLd = null,
}) {
  useEffect(() => {
    document.title = title;
    setMeta('description', description);
    setMeta('keywords', keywords);
    setMeta('og:title', title, 'property');
    setMeta('og:description', description, 'property');
    setMeta('og:url', buildPageUrl(path), 'property');
    setMeta('og:image', image, 'property');
    setMeta('twitter:title', title);
    setMeta('twitter:description', description);
    setMeta('twitter:image', image);
    setCanonical(path);
    setJsonLd('page', jsonLd);
  }, [description, image, jsonLd, keywords, path, title]);
}
