import type { Plugin } from 'vite';

/**
 * Content Security Policy for the published site. Only the build gets it:
 * the dev server needs inline scripts for hot reload.
 *
 * Images are limited to the cover catalogs and Google profile photos, so a
 * nominated "cover" cannot point at an arbitrary tracking server.
 */
const POLICY: Record<string, string[]> = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    'https://apis.google.com',
    'https://www.google.com/recaptcha/',
    'https://www.gstatic.com/recaptcha/',
  ],
  'style-src': ["'self'"],
  'font-src': ["'self'", 'data:'],
  'img-src': [
    "'self'",
    'data:',
    'https://*.googleusercontent.com',
    'https://books.google.com',
    'https://covers.openlibrary.org',
    'https://archive.org',
    'https://*.archive.org',
    'https://s4.anilist.co',
  ],
  'connect-src': [
    "'self'",
    'https://*.googleapis.com',
    'https://openlibrary.org',
    'https://graphql.anilist.co',
  ],
  'frame-src': [
    'https://*.firebaseapp.com',
    'https://www.google.com/recaptcha/',
    'https://recaptcha.google.com',
  ],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'upgrade-insecure-requests': [],
};

export function serializePolicy(policy: Record<string, string[]>): string {
  return Object.entries(policy)
    .map(([directive, sources]) => [directive, ...sources].join(' '))
    .join('; ');
}

export function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: serializePolicy(POLICY) },
        injectTo: 'head-prepend',
      },
    ],
  };
}
