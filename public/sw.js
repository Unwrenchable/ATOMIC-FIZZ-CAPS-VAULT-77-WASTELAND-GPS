// Service Worker for Atomic Fizz Caps PWA
// Enables offline functionality and app-like experience
//
// CACHE_VERSION: bump this string on every production deploy to invalidate
// stale assets for all returning users.  Format: v{semver}-{YYYYMMDD}
const CACHE_VERSION = 'v1.0.1-20260327';
const CACHE_NAME = `atomic-fizz-caps-${CACHE_VERSION}`;
const OFFLINE_URL = '/';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/css/pipboy.css',
  '/css/pipboy-map.css',
  '/css/pipboy-responsive.css',
  '/css/vats.css',
  '/css/live-radio.css',
  '/favicon.ico',
  '/favicon.png',
  '/manifest.json'
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching offline page');
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate');
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) return;

  const url = new URL(event.request.url);
  const isScript = url.pathname.endsWith('.js');
  const isCss = url.pathname.endsWith('.css');
  const isHtml = event.request.mode === 'navigate' || url.pathname.endsWith('.html');

  // Network-first for JS, CSS, and HTML navigation: ensures deploys propagate
  // immediately without users needing to manually clear the cache.
  if (isScript || isCss || isHtml) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version
        return cachedResponse;
      }

      // Fetch from network and cache
      return fetch(event.request)
        .then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          // Cache in background (don't block response)
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        })
        .catch(() => {
          // Return offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match(OFFLINE_URL);
          }
        });
    })
  );
});

// Handle push notifications (future feature)
self.addEventListener('push', (event) => {
  const body = (event.data && typeof event.data.text === 'function') 
    ? event.data.text() 
    : 'New wasteland activity detected!';
    
  const options = {
    body: body,
    icon: '/favicon.png',
    badge: '/favicon.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('Atomic Fizz Caps', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
