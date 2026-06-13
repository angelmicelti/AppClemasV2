/* ============================================================
   SERVICE WORKER - ClemasV2 PWA
   Cache-first strategy with network fallback for offline support
   ============================================================ */

var CACHE_NAME = 'clemas-v2-cache-v2.16';

/* Files to cache for offline use */
var ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

/* ============================================================
   INSTALL - Precache static assets
   ============================================================ */
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(ASSETS_TO_CACHE).catch(function(err) {
                console.warn('[SW] Some assets could not be precached:', err);
                return; /* Don't fail install for missing icons */
            });
        }).then(function() {
            return self.skipWaiting();
        })
    );
});

/* ============================================================
   ACTIVATE - Clean old caches
   ============================================================ */
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.filter(function(name) {
                    return name !== CACHE_NAME;
                }).map(function(name) {
                    return caches.delete(name);
                })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

/* ============================================================
   FETCH - Cache first, then network
   ============================================================ */
self.addEventListener('fetch', function(event) {
    var request = event.request;
    var url = new URL(request.url);

    /* Skip non-GET requests */
    if (request.method !== 'GET') return;

    /* Skip GitHub API and any request whose path contains /token endpoints */
    if (url.hostname === 'api.github.com') return;
    if (url.pathname.toLowerCase().indexOf('/token') !== -1) return;

    event.respondWith(
        caches.match(request).then(function(cachedResponse) {
            if (cachedResponse) {
                return cachedResponse;
            }

            /* Not in cache - fetch from network and cache it */
            return fetch(request).then(function(networkResponse) {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }

                /* Clone the response because it can only be consumed once */
                var responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(function(cache) {
                    cache.put(request, responseToCache);
                });

                return networkResponse;
            }).catch(function() {
                /* Offline - return cached index.html for HTML navigations */
                if (request.headers.get('Accept').indexOf('text/html') !== -1) {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
