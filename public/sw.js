// SEU ZÉLLA — PWA Service Worker v4
// Offline fallback + Web Push + safe background sync
// v4: DDC/mobile deployments must never be served from stale navigation cache.
const CACHE_NAME = 'seuzella-pwa-v4';
const OFFLINE_URL = '/offline.html';

const ASSET_PATTERNS = [
  /\/_next\/static\//, /\/fonts\//, /\/sounds\//, /\/icons?\//,
  /\.(?:js|css|woff2?|ttf|png|jpg|jpeg|svg|gif|webp|mp3)$/i,
];
const API_CACHE_PATTERNS = [
  /\/api\/ddc\/notifications/, /\/api\/v1\/guest\/ddc\/notifications/, /\/api\/ddc\/bookings/,
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

const SYNC_QUEUE_DB = 'zella-sync-queue';
const SYNC_QUEUE_STORE = 'pending-actions';

function openSyncQueue() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SYNC_QUEUE_DB, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (db.objectStoreNames.contains(SYNC_QUEUE_STORE)) db.deleteObjectStore(SYNC_QUEUE_STORE);
      db.createObjectStore(SYNC_QUEUE_STORE, { autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function waitForTransaction(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

async function enqueueAction(action) {
  let db;
  try {
    db = await openSyncQueue();
    const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
    tx.objectStore(SYNC_QUEUE_STORE).add(action);
    await waitForTransaction(tx);
    if (self.registration?.sync) await self.registration.sync.register('zella-sync');
  } catch (err) {
    console.error('[SW v4] enqueueAction failed:', err);
  } finally {
    db?.close();
  }
}

async function flushQueue() {
  let db;
  try {
    db = await openSyncQueue();
    const readTx = db.transaction(SYNC_QUEUE_STORE, 'readonly');
    const store = readTx.objectStore(SYNC_QUEUE_STORE);
    const [keys, actions] = await Promise.all([
      idbRequest(store.getAllKeys()),
      idbRequest(store.getAll()),
    ]);

    for (let index = 0; index < actions.length; index += 1) {
      const action = actions[index];
      try {
        const response = await fetch(action.url, action.init);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const deleteTx = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
        deleteTx.objectStore(SYNC_QUEUE_STORE).delete(keys[index]);
        await waitForTransaction(deleteTx);
      } catch (err) {
        console.error('[SW v4] queued action retained after failed replay:', err);
        break;
      }
    }
  } catch (err) {
    console.error('[SW v4] flushQueue failed:', err);
  } finally {
    db?.close();
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'zella-sync') event.waitUntil(flushQueue());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    if (request.method === 'PUT' && /\/api\/ddc\/notifications/.test(url.pathname)) {
      event.respondWith((async () => {
        try {
          const response = await fetch(request.clone());
          if (!response.ok && response.status >= 500) throw new Error(`Server error ${response.status}`);
          return response;
        } catch {
          await enqueueAction({
            url: request.url,
            init: {
              method: request.method,
              headers: Object.fromEntries(request.headers.entries()),
              body: await request.clone().text(),
            },
          });
          return new Response(JSON.stringify({ success: true, queued: true, mode: 'offline' }), {
            status: 202, headers: { 'Content-Type': 'application/json' },
          });
        }
      })());
    }
    return;
  }

  // DDC and Mobile are live applications, not offline documents.
  // Always obtain the current deployment shell from the network so an iPad,
  // installed PWA, or long-lived Safari tab cannot resurrect an old DDC UI.
  if (request.mode === 'navigate' && (/^\/ddc(?:\/|$)/.test(url.pathname) || /^\/mobile(?:\/|$)/.test(url.pathname))) {
    event.respondWith(fetch(request, { cache: 'no-store' }).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        return response;
      }).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  if (API_CACHE_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        return response;
      }).catch(() => caches.match(request).then((cached) => cached || new Response('[]', {
        status: 503, headers: { 'Content-Type': 'application/json' },
      })))
    );
    return;
  }

  if (ASSET_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        return response;
      }).catch(() => cached);
      return cached || network;
    }));
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { title: event.data?.text() || 'Seu Zélla' }; }

  const options = {
    body: data.body || 'Você recebeu um novo alerta no DDC.',
    ...(data.icon ? { icon: data.icon } : {}),
    ...(data.badge ? { badge: data.badge } : {}),
    vibrate: data.vibrate || [200, 100, 200],
    tag: data.tag || 'zella-notification',
    renotify: Boolean(data.renotify),
    data: { url: data.url || data.actionUrl || '/mobile', ...data.data },
    actions: data.actions || [
      { action: 'open', title: 'Abrir' },
      { action: 'dismiss', title: 'Dispensar' },
    ],
  };
  event.waitUntil(self.registration.showNotification(data.title || 'Seu Zélla — Novo Alerta', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const targetUrl = event.notification.data?.url || '/mobile';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      if (client.url.includes(targetUrl) && 'focus' in client) return client.focus();
    }
    return self.clients.openWindow ? self.clients.openWindow(targetUrl) : undefined;
  }));
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING' || event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'PURGE_LIVE_APP_CACHE') {
    event.waitUntil(caches.open(CACHE_NAME).then(async (cache) => {
      const keys = await cache.keys();
      await Promise.all(keys.filter((request) => {
        const pathname = new URL(request.url).pathname;
        return /^\/ddc(?:\/|$)/.test(pathname) || /^\/mobile(?:\/|$)/.test(pathname);
      }).map((request) => cache.delete(request)));
    }));
  }
});
