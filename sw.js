const CACHE_NAME = 'algomind-fx-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[AlgoMind FX] Cache opened');
        return cache.addAll(urlsToCache);
      })
      .catch((err) => {
        console.error('[AlgoMind FX] Cache failed:', err);
      })
  );
  self.skipWaiting();
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        return fetch(event.request)
          .then((response) => {
            // Don't cache if not a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(() => {
            // Network failed, try to return offline page for navigation requests
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[AlgoMind FX] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Push notification support
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  
  const options = {
    body: data.body || 'AlgoMind FX Alert',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    image: data.image || '/icons/icon-512x512.png',
    vibrate: data.vibrate || [100, 50, 100],
    tag: data.tag || 'algomind-alert',
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: data.primaryKey || 1,
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'AlgoMind FX', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const notificationData = event.notification.data;
  
  if (event.action === 'open' || event.action === '') {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        // If a window is already open, focus it
        for (const client of clientList) {
          if (client.url && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow(notificationData.url || '/');
        }
      })
    );
  }
});

// Background sync for offline trading signals
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-signals') {
    event.waitUntil(syncPendingSignals());
  }
});

async function syncPendingSignals() {
  try {
    const cache = await caches.open('algomind-signals');
    const pendingRequests = await cache.keys();
    
    await Promise.all(
      pendingRequests.map(async (request) => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            await cache.delete(request);
          }
        } catch (error) {
          console.log('[AlgoMind FX] Signal sync failed:', error);
        }
      })
    );
  } catch (error) {
    console.error('[AlgoMind FX] Background sync error:', error);
  }
}

// Periodic background sync for market data
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'market-data-sync') {
    event.waitUntil(updateMarketData());
  }
});

async function updateMarketData() {
  try {
    const response = await fetch('/api/market/snapshot');
    if (response.ok) {
      const data = await response.json();
      const cache = await caches.open('algomind-market-data');
      await cache.put('/api/market/snapshot', new Response(JSON.stringify(data)));
    }
  } catch (error) {
    console.log('[AlgoMind FX] Market data sync failed:', error);
  }
}
