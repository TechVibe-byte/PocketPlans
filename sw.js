const CACHE_NAME = 'pocketplans-v1';
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
    }).then(() => self.clients.claim()) // Take control of all clients immediately
  );
});

// Fetch Event: Stale-While-Revalidate Strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests and chrome-extension requests
  if (event.request.method !== 'GET' || url.protocol.startsWith('chrome-extension')) {
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
        // If network fails and we don't have a cache, we can't do much for new resources
        // but existing cached resources will return the cachedResponse below.
      });

      // 3. Return cached response if available, otherwise wait for network
      return cachedResponse || fetchPromise;
    })
  );
});