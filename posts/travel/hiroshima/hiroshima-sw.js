// Hiroshima Trip PWA Service Worker
// Version control for cache busting
const VERSION = '2026.05.21.001';
const CACHE_NAME = `hiroshima-trip-${VERSION}`;

// Resources to cache for offline use
const urlsToCache = [
  '/posts/travel/hiroshima/index.html',
  '/posts/travel/hiroshima/',
  '/posts/travel/hiroshima/css/hiroshima.css',
  '/posts/travel/hiroshima/js/hiroshima.js',
  '/posts/travel/hiroshima/hiroshima-manifest.json',
  '/posts/travel/hiroshima/trip-data.json',
  '/posts/travel/hiroshima/overview.md',
  '/posts/travel/hiroshima/other-info.md',
  '/assets/css/custom.css',
  // Bootstrap & Dependencies
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css',
  'https://cdn.jsdelivr.net/npm/marked@14.1.0/marked.min.js',
  // Fonts (critical)
  'https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;600;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700&display=swap'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log(`[SW ${VERSION}] Installing...`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log(`[SW ${VERSION}] Caching resources`);
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log(`[SW ${VERSION}] Installation complete`);
        return self.skipWaiting(); // Activate immediately
      })
      .catch((error) => {
        console.error(`[SW ${VERSION}] Installation failed:`, error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log(`[SW ${VERSION}] Activating...`);
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // Delete old versions of hiroshima-trip cache
              return cacheName.startsWith('hiroshima-trip-') && cacheName !== CACHE_NAME;
            })
            .map((cacheName) => {
              console.log(`[SW ${VERSION}] Deleting old cache: ${cacheName}`);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log(`[SW ${VERSION}] Activation complete`);
        return self.clients.claim(); // Take control immediately
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version
          console.log(`[SW ${VERSION}] Serving from cache: ${url.pathname}`);
          
          // For trip-data.json, check for updates in background
          if (url.pathname.includes('trip-data.json') || 
              url.pathname.includes('overview.md') || 
              url.pathname.includes('others.md')) {
            // Network-then-cache strategy for data files
            fetch(event.request)
              .then((response) => {
                if (response && response.status === 200) {
                  // Update cache with fresh data
                  caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, response.clone());
                    console.log(`[SW ${VERSION}] Updated cache: ${url.pathname}`);
                  });
                }
              })
              .catch(() => {
                // Silently fail - offline or network error
              });
          }
          
          return cachedResponse;
        }

        // Not in cache, fetch from network
        console.log(`[SW ${VERSION}] Fetching from network: ${url.pathname}`);
        return fetch(event.request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }

            // Clone response for cache
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
                console.log(`[SW ${VERSION}] Cached new resource: ${url.pathname}`);
              });

            return response;
          })
          .catch(() => {
            // Network failed and not in cache
            console.warn(`[SW ${VERSION}] Failed to fetch: ${url.pathname}`);
            
            // Could return a custom offline page here
            return new Response('離線模式：無法載入此資源', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain; charset=utf-8'
              })
            });
          });
      })
  );
});

// Message event - handle commands from page
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: VERSION });
  }
});
