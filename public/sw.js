// ============================================================================
// Zélla Service Worker — PWA offline support
// ============================================================================
// Cache estratégias:
//   - Static assets (JS, CSS, fonts): Cache-First com fallback network
//   - API calls: Network-First com fallback cache (para quando offline)
//   - Imagens: Stale-While-Revalidate
// ============================================================================

const CACHE_VERSION = 'zehla-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// ─────────────────────────────────────────────────────────────────────────────
// INSTALL — pré-cacheia assets estáticos
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVATE — limpa caches antigos
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name.startsWith('zehla-') && !name.startsWith(CACHE_VERSION))
          .map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// ─────────────────────────────────────────────────────────────────────────────
// FETCH — estratégia por tipo de recurso
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return;

  // Skip Next.js HMR (dev only)
  if (url.pathname.startsWith('/_next/webpack-hmr')) return;

  // Strategy: STATIC — Cache-First
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.match(/\.(js|css|woff2?|ttf|eot)$/)
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Strategy: IMAGES — Stale-While-Revalidate
  if (url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/)) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
    return;
  }

  // Strategy: API — Network-First com fallback cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCacheFallback(request, API_CACHE));
    return;
  }

  // Strategy: HTML — Network-First (sempre fresco)
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstWithCacheFallback(request, STATIC_CACHE));
    return;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirstWithCacheFallback(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok && request.method === 'GET') {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'OFFLINE' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  return cached || fetchPromise;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUSH NOTIFICATIONS (futuro)
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Zélla', {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-badge.png',
      data: data.url || '/',
      tag: data.tag || 'zehla-notification',
      requireInteraction: data.urgent || false,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      if (clients.length > 0) {
        clients[0].focus();
        clients[0].postMessage({ type: 'NOTIFICATION_CLICK', url: event.notification.data });
      } else {
        self.clients.openWindow(event.notification.data);
      }
    })
  );
});
