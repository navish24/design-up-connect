// v2 — do NOT cache HTML or JS bundles; they change on every deploy.
// Only cache stable static assets so the app is never served stale content.
const CACHE = 'connect-v2';
const STATIC = ['/Ionicons.ttf', '/assets/icon.png', '/assets/favicon.png'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(STATIC).catch(() => {}))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    // Delete ALL previous caches (including connect-v1 that had stale index.html)
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const { pathname } = new URL(event.request.url);
  // Only serve fonts/icons from cache; HTML + JS bundles always go to network
  if (STATIC.includes(pathname)) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
  }
});
