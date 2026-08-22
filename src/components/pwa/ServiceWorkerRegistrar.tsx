'use client';

import { useEffect, useState } from 'react';

/**
 * ServiceWorkerRegistrar with update flow.
 *
 * RESPONSIBILITIES:
 *   1. Register /sw.js in production only
 *   2. Detect when a new SW version is available → prompt user to reload
 *   3. Listen for SW controller change → auto-reload once
 *
 * ARCHITECTURE (Onda 5F):
 *   - Browser loads page → SW registers (first visit) or activates (returning)
 *   - SW fetches new assets → triggers 'updatefound' event
 *   - New SW enters 'waiting' state (doesn't activate until all tabs close)
 *   - We skipWaiting() to activate immediately + reload page once
 *
 * USAGE: mount <ServiceWorkerRegistrar /> once in app/layout.tsx.
 */

export function ServiceWorkerRegistrar() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    let registration: ServiceWorkerRegistration | null = null;

    void navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((reg) => {
        registration = reg;

        // Listen for new SW waiting to activate
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version installed — prompt user to reload
              setUpdateAvailable(true);
            }
          });
        });
      })
      .catch((error) => {
        console.error('[PWA] service worker registration failed', error);
      });

    // Listen for controller change (new SW took over) → reload once
    let reloadDone = false;
    const onControllerChange = () => {
      if (reloadDone) return;
      reloadDone = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    // Check for updates every 60 minutes (catches deploys during long sessions)
    const updateInterval = setInterval(() => {
      registration?.update().catch(() => {});
    }, 60 * 60 * 1000);

    return () => {
      clearInterval(updateInterval);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  const applyUpdate = () => {
    if (!('serviceWorker' in navigator)) return;
    // Send SKIP_WAITING message to the waiting SW
    navigator.serviceWorker.getRegistration('/').then((reg) => {
      if (reg?.waiting) {
        reg.waiting.postMessage('SKIP_WAITING');
      }
    });
  };

  if (!updateAvailable) return null;

  return (
    <div
      role="alertdialog"
      aria-labelledby="sw-update-title"
      aria-describedby="sw-update-desc"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 border border-emerald-500/30 rounded-xl p-4 shadow-2xl max-w-sm"
    >
      <p id="sw-update-title" className="text-emerald-400 text-sm font-semibold mb-1">
        Nova versão disponível
      </p>
      <p id="sw-update-desc" className="text-zinc-300 text-xs mb-3">
        Recarregue para aplicar a atualização.
      </p>
      <button
        type="button"
        onClick={applyUpdate}
        className="w-full h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
      >
        Atualizar agora
      </button>
    </div>
  );
}
