// SEU ZÉLLA — PWA Service Worker v2 (Offline Fallback + Web Push + Background Sync)
// ============================================================================
// CHANGES FROM v1:
//   - Bumped cache version v1 → v2
//   - Stale-while-revalidate for static assets (JS, CSS, fonts)
//   - Network-first strategy for API GETs (notifications, booking-sync)
//   - Background sync queue for offline actions (markAsRead, markAllAsRead)
//   - Push event handler with structured payload parsing
//   - Notificationclick handler with deep-link support
//   - Skip-waiting + clients.claim for instant activation
// ============================================================================

const CACHE_NAME = 'seuzella-pwa-v2';
const OFFLINE_URL = '/offline.html';

// Asset patterns that benefit from stale-while-revalidate caching
const ASSET_PATTERNS = [
  /\/_next\/static\//,
  /\/fonts\//,
  /\/sounds\//,
  /\/icons?\//,
  /\.(?:js|css|woff2?|ttf|png|jpg|jpeg|svg|gif|webp|mp3)$/i,
];

// API GET endpoints safe to cache with network-first strategy
const API_CACHE_PATTERNS = [
  /\/api\/ddc\/notifications/,
  /\/api\/v1\/guest\/ddc\/notifications/,
  /\/api\/ddc\/bookings/,
];

// ─── Install: pre-cache offline page + activate immediately ────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
  );
  self.skipWaiting();
});

// ─── Activate: clean old caches + claim clients ────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return undefined;
        })
      )
    )
  );
  self.clients.claim();
});

// ─── Background Sync Queue (for offline actions) ────────────────────────────
const SYNC_QUEUE_DB = 'zella-sync-queue';
const SYNC_QUEUE_STORE = 'pending-actions';

function openSyncQueue() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SYNC_QUEUE_DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(SYNC_QUEUE_STORE, { autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function enqueueAction(action) {
  try {
    const db = await openSyncQueue();
    const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
    tx.objectStore(SYNC_QUEUE_STORE).add(action);
    await tx.done;
    if (self.registration?.sync) {
      await self.registration.sync.register('zella-sync');
    }
  } catch (err) {
    console.error('[SW v2] enqueueAction failed:', err);
  }
}

async function flushQueue() {
  let db;
  try {
    db = await openSyncQueue();
  } catch {
    return;
  }
  const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
  const store = tx.objectStore(SYNC_QUEUE_STORE);
  const allReq = store.getAll();
  await new Promise((resolve) => {
    allReq.onsuccess = () => resolve();
    allReq.onerror = () => resolve();
  });
  const actions = allReq.result ?? [];
  for (const action of actions) {
    try {
      await fetch(action.url, action.init);
    } catch (err) {
      console.error('[SW v2] flushQueue fetch failed for', action.url, err);
    }
  }
  store.clear();
  await tx.done;
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'zella-sync') {
    event.waitUntil(flushQueue());
  }
});

// ─── Fetch handler: navigation + assets + API strategies ────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (except PUT/POST to /api/ddc/notifications — queued)
  if (request.method !== 'GET') {
    // Intercept notification mutations and queue if offline
    if (
      request.method === 'PUT' &&
      /\/api\/ddc\/notifications/.test(url.pathname)
    ) {
      event.respondWith(
        (async () => {
          try {
            const cloned = request.clone();
            const response = await fetch(request);
            if (!response.ok && response.status >= 500) {
              throw new Error(`Server error ${response.status}`);
            }
            return response;
          } catch {
            // Network failed — queue for background sync
            const body = await request.clone().text();
            await enqueueAction({
              url: request.url,
              init: {
                method: request.method,
                headers: Object.fromEntries(request.headers.entries()),
                body,
              },
            });
            return new Response(
              JSON.stringify({ success: true, queued: true, mode: 'offline' }),
              { status: 202, headers: { 'Content-Type': 'application/json' } }
            );
          }
        })()
      );
    }
    return;
  }

  // ── Navigation: network-first, fallback to offline page ──
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful navigation responses
          if (response.ok) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          }
          return response;
        })
        .catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // ── API GETs: network-first, fallback to cache ──
  if (API_CACHE_PATTERNS.some((p) => p.test(url.pathname))) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          }
          return response;
        })
        .catch(() => caches.match(request).then((r) => r || new Response('[]', { status: 503 })))
    );
    return;
  }

  // ── Static assets: stale-while-revalidate ──
  if (ASSET_PATTERNS.some((p) => p.test(url.pathname))) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response.ok) {
              const cloned = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
            }
            return response;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }
});

// ─── Web Push Notification Event Handler ─────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data?.text() ?? 'Seu Zélla' };
  }
  const title = data.title || 'Seu Zélla — Novo Alerta';
  const options = {
    body: data.body || 'Você recebeu um novo alerta no DDC.',
    icon: data.icon || '/SeuZella_Logo_site.png',
    badge: data.badge || '/SeuZella_Logo_site.png',
    vibrate: data.vibrate || [200, 100, 200],
    tag: data.tag || 'zella-notification',
    renotify: !!data.renotify,
    data: {
      url: data.url || data.actionUrl || '/mobile/pousada',
      ...data.data,
    },
    actions: data.actions || [
      { action: 'open', title: 'Abrir' },
      { action: 'dismiss', title: 'Dispensar' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Notificationclick handler — deep-link to URL ──────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/mobile/pousada';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ─── Message handler — for skipWaiting trigger from page ────────────────────
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
