/* ──────────────────────────────────────────────────────────────────────────
   Service worker — cache-first for static assets, network-first fallback
   for HTML, navigation fallback to index.html when offline.

   Bump CACHE_VERSION when shipping structural changes so old cached
   responses get evicted automatically next visit.
   ────────────────────────────────────────────────────────────────────────── */
const CACHE_VERSION = 'hralmeida-v3';
// Asset URLs include ?v=1 to match the version-busters in HTML. Without the
// query string, caches.match() keys are unqueried and the network request for
// `./style.css?v=1` would always miss the precache — defeating the cache. With
// ?v=1 baked in, offline visits also pull the same version the HTML now asks
// for. Bump this string + CACHE_VERSION (and the HTML ?v=) together when you
// ship a new release.
const PRECACHE = [
  './',
  './index.html',
  './style.css?v=1',
  './posts.css?v=1',
  './theme.js?v=1',
  './easter.js?v=1',
  './posts.js?v=1',
  './bio.js?v=1',
  './now.js?v=1',
  './cv.js?v=1',
  './giscus-config.js?v=1',
  './manifest.json',
  './imgs/imgs.jpg',
  './imgs/og-default.png',
  './imgs/icon-192.png',
  './imgs/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // skip cross-origin (CDNs, fonts, giscus)

  // For navigations: try the network, fall back to cached index.html so the
  // app shell still loads offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // For everything else (same-origin static): cache-first, network fallback.
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
