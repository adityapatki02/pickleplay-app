#!/usr/bin/env node
/**
 * Post-build PWA wiring.
 *
 * Runs after `expo export --platform web`. Takes the static `dist/` output and:
 *   1. Copies PWA icons from `assets/pwa/` into `dist/`.
 *   2. Writes `dist/manifest.webmanifest`.
 *   3. Injects PWA <link> / <meta> tags into `dist/index.html`.
 *
 * Designed for an installable-only PWA (no service worker, no offline cache).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PWA_SRC = path.join(ROOT, 'assets', 'pwa');

if (!fs.existsSync(DIST)) {
  console.error('[postbuild-pwa] dist/ not found — run `expo export --platform web` first.');
  process.exit(1);
}

// ─── 1. Copy icons ────────────────────────────────────────────────
const icons = [
  'icon-192.png',
  'icon-512.png',
  'icon-512-maskable.png',
  'apple-touch-icon.png',
];
for (const f of icons) {
  const src = path.join(PWA_SRC, f);
  const dest = path.join(DIST, f);
  if (!fs.existsSync(src)) {
    console.warn(`[postbuild-pwa] missing ${src} — skipped`);
    continue;
  }
  fs.copyFileSync(src, dest);
  console.log(`[postbuild-pwa] copied ${f}`);
}

// ─── 2. Write manifest ─────────────────────────────────────────────
const manifest = {
  name: 'Yoiden',
  short_name: 'Yoiden',
  description: 'India\'s racket-sports tournament operating system.',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#F6F5F1',
  theme_color: '#0A0A0B',
  categories: ['sports', 'productivity'],
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
fs.writeFileSync(
  path.join(DIST, 'manifest.webmanifest'),
  JSON.stringify(manifest, null, 2),
);
console.log('[postbuild-pwa] wrote manifest.webmanifest');

// ─── 3. Inject head tags into index.html ───────────────────────────
const indexPath = path.join(DIST, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const pwaHead = `
  <link rel="manifest" href="/manifest.webmanifest" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
  <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Yoiden" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="application-name" content="Yoiden" />
  <meta name="description" content="India's racket-sports tournament operating system." />`;

// Insert pwaHead just before </head>, but only once.
if (!html.includes('rel="manifest"')) {
  html = html.replace('</head>', `${pwaHead}\n</head>`);
}

fs.writeFileSync(indexPath, html);
console.log('[postbuild-pwa] injected PWA head tags into index.html');

console.log('[postbuild-pwa] done.');
