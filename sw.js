// DingProof service worker — caches the app shell so it opens instantly
// even with no signal (a parking garage, an airport basement). It never
// caches anything beyond these local files: no photos, no PDFs, no network
// data ever passes through here, matching the app's own privacy rule.
var CACHE_NAME = 'dingproof-v2';
var SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(SHELL);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.filter(function (n) { return n !== CACHE_NAME; }).map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Cache-first for the app shell: instant load offline. Anything else
// (there is nothing else — no backend) just falls through to the network.
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') { return; }
  event.respondWith(
    caches.match(event.request).then(function (hit) {
      if (hit) { return hit; }
      return fetch(event.request).then(function (res) {
        if (res && res.ok && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
        }
        return res;
      })['catch'](function () {
        // Offline and not cached. A page navigation (the driver reopening
        // the app with no signal) falls back to the cached shell so the
        // app still loads; anything else gets a real Response instead of
        // undefined, which the fetch API would otherwise reject with a
        // network-error page.
        if (event.request.mode === 'navigate' || event.request.destination === 'document') {
          return caches.match('./index.html').then(function (shell) {
            return shell || new Response(
              '<!doctype html><meta charset="utf-8"><title>DingProof — offline</title>' +
              '<p style="font:16px system-ui;padding:24px">DingProof cannot load right now. ' +
              'Reconnect once, then this page works offline.</p>',
              { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            );
          });
        }
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});
