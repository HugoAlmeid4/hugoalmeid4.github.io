/* ──────────────────────────────────────────────────────────────────────────
   Service worker — cache-first for static assets, network-first fallback
   for HTML, navigation fallback to index.html when offline.

   Bump CACHE_VERSION when shipping structural changes so old cached
   responses get evicted automatically next visit.
   ────────────────────────────────────────────────────────────────────────── */
const CACHE_VERSION = 'hralmeida-v8';
// Asset URLs include ?v=N to match the version-busters in HTML. Without the
// query string, caches.match() keys are unqueried and the network request for
// `./style.css?v=2` would always miss the precache — defeating the cache. With
// ?v=N baked in, offline visits also pull the same version the HTML now asks
// for. Bump this string + CACHE_VERSION + HTML ?v= together when shipping.
//
// Data files (posts/index.json, data/*.json, etc.) are intentionally excluded
// from PRECACHE because they change when content is added via /admin. Cache-
// first on those would cause stale content until Ctrl+Shift+R. posts.js always
// fetches them with ?t=timestamp to bypass the service-worker cache entirely.
const PRECACHE = [
  './',
  './index.html',
  './gallery.html',
  './certificates.html',
  './now.html',
  './cv.html',
  './404.html',
  './style.css?v=4',
  './posts.css?v=3',
  './certificates.css?v=4',
  './now.css?v=4',
  './cv.css?v=4',
  './404.css?v=4',
  './theme.js?v=4',
  './posts.js?v=3',
  './bio.js?v=3',
  './counter.js?v=3',
  './now.js?v=4',
  './cv.js?v=4',
  './giscus-config.js?v=3',
  './manifest.json',
  './imgs/imgs.jpg',
  './imgs/imgs.webp',
  './imgs/og-default.png',
  './imgs/Frame10.png',
  './imgs/Frame10.webp',
  './imgs/icon-192.png',
  './imgs/icon-512.png',
  './imgs/certificate-placeholder.webp'
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
