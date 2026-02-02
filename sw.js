
const CACHE_NAME = 'pocketplans-v4'; // Incremented version
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install Event: Cache core files immediately
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Activate worker immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

// Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Stale-While-Revalidate Strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests and chrome-extension requests
  if (event.request.method !== 'GET' || url.protocol.startsWith('chrome-extension')) {
    return;
  }

  // Handle navigation requests (HTML) specially
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((cached) => {
        // Return cached index.html if available, but also fetch from network to update cache
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
             caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
          }
          return networkResponse;
        }).catch(() => {
           // If offline and no cache, we might be in trouble, but if we have cached index.html above, we are good.
        });
        return cached || fetchPromise;
      })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 1. Try to get from cache
      const cachedResponse = await cache.match(event.request);

      // 2. Fetch from network to update cache (in background)
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Only cache valid responses (status 200)
        // We allow opaque responses (type 0) for CDNs (like esm.sh) to ensure they are cached
        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      }).catch((error) => {
        console.log('Network request failed, staying offline:', error);
      });

      // 3. Return cached response if available, otherwise wait for network
      return cachedResponse || fetchPromise;
    })
  );
});
