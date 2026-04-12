// Service Worker for Atomic Fizz Caps PWA
// Enables offline functionality and app-like experience
//
// CACHE_VERSION: bump this string on every production deploy to invalidate
// stale assets for all returning users.  Format: v{semver}-{YYYYMMDD}
const CACHE_VERSION = 'v1.1.0-20260403';
const CACHE_NAME = `atomic-fizz-caps-${CACHE_VERSION}`;
const OFFLINE_URL = '/';

// Assets to cache on install
// NOTE: Keep this list lean — only assets that are *essential* for a meaningful
// offline session.  JS/CSS/HTML are network-first (see fetch handler), so they
// update immediately on each online visit; the cached copies act as a fallback.
// Large audio .mp3 tracks are NOT pre-cached (too large); they fall back to the
// cache-first path and get cached the first time they are streamed.
const PRECACHE_ASSETS = [
  // Shell
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.png',

  // Critical CSS
  '/css/pipboy.css',
  '/css/pipboy-map.css',
  '/css/pipboy-responsive.css',
  '/css/vats.css',
  '/css/live-radio.css',

  // Boot / core scripts
  '/js/config.js',
  '/js/boot.js',
  '/js/pipboy.js',
  '/js/pipboy-special.js',
  '/js/main.js',
  '/js/radioPlayer.js',
  '/js/gps.js',

  // Core modules
  '/js/modules/worldmap.js',
  '/js/modules/inventory-ui.js',
  '/js/modules/inventory-loader.js',
  '/js/modules/quest-ui.js',
  '/js/modules/quests.js',
  '/js/modules/narrative.js',
  '/js/modules/battles.js',
  '/js/modules/crafting.js',
  '/js/modules/factions.js',
  '/js/modules/mintables.js',
  '/js/modules/web3-wallet-adapter.js',
  '/js/modules/live-radio-streaming.js',
  '/js/modules/vats.js',

  // Game engine scripts
  '/js/game/player-state.js',
  '/js/game/api-client.js',
  '/js/game/inventory-actions.js',
  '/js/game/equip-actions.js',
  '/js/game/loop.js',

  // World scripts
  '/js/world/state.js',
  '/js/world/factions.js',
  '/js/world/regions.js',
  '/js/world/npc_traits.js',
  '/js/world/weather.js',
  '/js/world/loot.js',
  '/js/world/encounters.js',

  // Static game data (needed for offline POI + quests)
  '/data/poi.json',
  '/data/fallout_pois.json',
  '/data/locations.json',
  '/data/items/items.json',
  '/data/factions/factions.json',
  '/data/quests.json',
  '/data/narrative/dialog_siren.json',

  // Encounter + battle scripts needed for offline combat
  '/js/encounters.js',
  '/js/world/encounters.js',
  '/js/modules/npcEncounter.js',
  '/js/game/loop.js',

  // Radio metadata (lets the player pick a station offline;
  // actual mp3 files stream separately and get cached on first play)
  '/audio/radio/station.json',
  '/audio/radio/station-mojave.json',
  '/audio/radio/station-swing.json',
  '/audio/radio/playlist.json',
  '/audio/radio/playlist-mojave.json',
  '/audio/radio/playlist-swing.json',
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

// ------------------------------------------------------------
// Network status broadcasting
// Notifies all open game tabs when connectivity changes so the
// Pip-Boy HUD can show an "OFFLINE" / "ONLINE" banner.
// ------------------------------------------------------------
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CHECK_NETWORK') {
    // Reply immediately; the browser will tell us if fetch fails
    event.ports[0] && event.ports[0].postMessage({ online: true });
  }
});
