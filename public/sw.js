// ============================================================================
// Zélla Service Worker — PWA v2 (com Background Sync)
// ============================================================================
// Cache estratégias:
//   - Static assets: Cache-First
//   - API calls: Network-First com fallback cache
//   - Imagens: Stale-While-Revalidate
//   - Background Sync: fila de requisições offline
// ============================================================================

const CACHE_VERSION = 'seuzella-pwa-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;
const SYNC_QUEUE = 'zella-sync';

const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// ─────────────────────────────────────────────────────────────────────────────
// INSTALL — pré-cacheia assets
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Se algum asset não existir, ignora (não quebra o SW)
        return Promise.all(
          STATIC_ASSETS.map(url =>
            cache.add(url).catch(() => null)
          )
        );
      });
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
          .filter(name => name.startsWith('seuzella-pwa-') && !name.startsWith(CACHE_VERSION))
          .map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// ─────────────────────────────────────────────────────────────────────────────
// FETCH — estratégia por tipo
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    // Para POST/PUT/DELETE não-GET: se offline, enfileira em Background Sync
    if (!navigator.onLine && 'sync' in registration) {
      event.respondWith(
        handleOfflineMutation(request).catch(() => new Response('', { status: 503 }))
      );
    }
    return;
  }

  if (url.origin !== self.location.origin) return;
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
// BACKGROUND SYNC — processa fila de requisições offline
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_QUEUE) {
    event.waitUntil(processSyncQueue());
  }
});

async function handleOfflineMutation(request) {
  // Enfileira a requisição para processar quando voltar online
  try {
    const body = await request.clone().text();
    const queueItem = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body,
      timestamp: Date.now(),
    };

    // Salva no IndexedDB (ou cache como fallback)
    const cache = await caches.open(`${CACHE_VERSION}-sync`);
    const response = new Response(JSON.stringify(queueItem));
    await cache.put(`sync-${Date.now()}-${Math.random()}`, response);

    // Registra para Background Sync
    if ('sync' in registration) {
      await registration.sync.register(SYNC_QUEUE);
    }

    return new Response(JSON.stringify({ success: true, queued: true }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'OFFLINE_QUEUE_FAILED' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function processSyncQueue() {
  const cache = await caches.open(`${CACHE_VERSION}-sync`);
  const keys = await cache.keys();

  for (const key of keys) {
    const response = await cache.match(key);
    const text = await response.text();
    try {
      const item = JSON.parse(text);
      await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });
      await cache.delete(key);
    } catch (err) {
      // Se falhar, mantém na fila para próxima tentativa
      console.warn('[SW] Sync falhou para', key.url, err);
    }
  }
}

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
    return caches.match('/offline.html') || new Response('Offline', { status: 503 });
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
    if (request.headers.get('accept')?.includes('text/html')) {
      return caches.match('/offline.html') || new Response('Offline', { status: 503 });
    }
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
// PUSH NOTIFICATIONS
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

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE — skipWaiting para atualização imediata
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
