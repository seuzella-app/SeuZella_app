'use client';

import { useEffect } from 'react';

function isIPadOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * iPad-only deployment handshake for the DDC.
 *
 * Safari/iPadOS can retain a long-lived installed PWA shell even after the
 * web deployment has changed. The Service Worker is still responsible for
 * normal cache lifecycle, but this guard adds a second, server-authoritative
 * build check. It only runs on iPadOS, so Desktop and Mobile behavior is
 * unchanged.
 */
export function DDCStaleShellGuard({ expectedBuildId }: { expectedBuildId: string }) {
  useEffect(() => {
    if (!isIPadOS()) return;
    if (!expectedBuildId || expectedBuildId === 'development') return;

    let cancelled = false;

    const verifyCurrentDeployment = async () => {
      try {
        const response = await fetch('/api/ddc/runtime-version', {
          cache: 'no-store',
          credentials: 'include',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (!response.ok || cancelled) return;

        const payload = (await response.json()) as { buildId?: string };
        if (!payload.buildId || payload.buildId === expectedBuildId) return;

        // Make the navigation URL unique so Safari cannot reuse the old
        // document from its HTTP/PWA cache. The server route itself is also
        // force-dynamic/no-store, so this is a belt-and-suspenders guard.
        const url = new URL(window.location.href);
        url.searchParams.set('__ddc_build', payload.buildId.slice(0, 12));
        window.location.replace(url.toString());
      } catch {
        // Never block the DDC because the diagnostic endpoint is unavailable.
      }
    };

    void verifyCurrentDeployment();

    return () => {
      cancelled = true;
    };
  }, [expectedBuildId]);

  return null;
}
