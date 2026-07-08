// Tokyo Trip PWA Service Worker
// Version control for cache busting
const VERSION = '2026.07.07.002';
const CACHE_NAME = `tokyo-trip-${VERSION}`;

// Resources to cache for offline use
const urlsToCache = [
  '/posts/travel/tokyo/index.html',
  '/posts/travel/tokyo/',
  '/posts/travel/tokyo/css/tokyo.css',
  '/posts/travel/tokyo/js/tokyo.js',
  '/posts/travel/tokyo/tokyo-manifest.json',
  '/posts/travel/tokyo/trip-data.json',
  '/posts/travel/tokyo/other-info.md',
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
              // Delete old versions of tokyo-trip cache
              return cacheName.startsWith('tokyo-trip-') && cacheName !== CACHE_NAME;
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

// Data files change often during trip planning - always prefer the live
// copy over cache so edits show up on the very next reload instead of
// lagging one refresh behind.
function isDataFile(pathname) {
  return pathname.includes('trip-data.json') ||
    pathname.includes('overview.md') ||
    pathname.includes('other-info.md');
}

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  if (isDataFile(url.pathname)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version
          console.log(`[SW ${VERSION}] Serving from cache: ${url.pathname}`);
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
