'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
      console.error('[PWA] service worker registration failed', error);
    });
  }, []);

  return null;
}
