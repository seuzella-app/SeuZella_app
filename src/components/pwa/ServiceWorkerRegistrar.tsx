'use client';

import { useEffect, useState } from 'react';

/**
 * Production PWA update controller.
 *
 * DDC/Mobile are live applications: after a deployment, an iPad or an
 * installed PWA must not remain on an old application shell. The registrar
 * therefore performs an immediate SW update check, purges live-app cache,
 * and lets the new worker take control without requiring the user to close
 * Safari or remove the home-screen app.
 */
export function ServiceWorkerRegistrar() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    let registration: ServiceWorkerRegistration | null = null;
    let reloadDone = false;

    const reloadAfterControllerChange = () => {
      if (reloadDone) return;
      reloadDone = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', reloadAfterControllerChange);

    void navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(async (reg) => {
        registration = reg;

        // Force an update check immediately. This is especially important for
        // long-lived iPad Safari/PWA sessions where the previous worker may
        // have been controlling the page for days.
        await reg.update().catch(() => {});

        // Tell the active worker to discard any cached live-app documents.
        // The v4 worker handles this message; older workers safely ignore it.
        reg.active?.postMessage({ type: 'PURGE_LIVE_APP_CACHE' });

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
              // v4 calls skipWaiting() during install, so controllerchange will
              // normally reload automatically. Keep the visible action as a
              // fallback for browsers that delay activation.
            }
          });
        });
      })
      .catch((error) => {
        console.error('[PWA] service worker registration failed', error);
      });

    // Re-check when the user returns to Safari/PWA and periodically while open.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        registration?.update().catch(() => {});
        registration?.active?.postMessage({ type: 'PURGE_LIVE_APP_CACHE' });
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const updateInterval = setInterval(() => {
      registration?.update().catch(() => {});
    }, 15 * 60 * 1000);

    return () => {
      clearInterval(updateInterval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      navigator.serviceWorker.removeEventListener('controllerchange', reloadAfterControllerChange);
    };
  }, []);

  const applyUpdate = () => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistration('/').then((reg) => {
      reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
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
