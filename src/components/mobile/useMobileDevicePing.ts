'use client';

/** Unifies desktop/mobile presence telemetry without trusting browser tenant identity. */
import { useEffect, useRef } from 'react';

interface UseDevicePingParams {
  niche: 'pousada' | 'airbnb';
  route: string;
  isMobile: boolean;
  /** Deprecated compatibility field. Never transmitted; server resolves tenant from auth context. */
  tenantId?: string;
  tenantName?: string;
  tabName?: string;
}

const PING_INTERVAL_MS = 5 * 60 * 1000;
const DEVICE_ID_STORAGE_KEY = 'zella_device_id';

function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'ssr';
  try {
    let id = sessionStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return 'fallback';
  }
}

function getViewport(): string {
  return typeof window === 'undefined' ? 'unknown' : `${window.innerWidth}x${window.innerHeight}`;
}

export function useDevicePing({ niche, route, isMobile, tenantName, tabName }: UseDevicePingParams) {
  const deviceIdRef = useRef('');
  const tabNameRef = useRef(tabName);

  useEffect(() => { tabNameRef.current = tabName; }, [tabName]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    deviceIdRef.current = getOrCreateDeviceId();

    const sendPing = () => {
      void fetch('/api/mobile/devices-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        keepalive: true,
        body: JSON.stringify({
          tenantName,
          niche,
          route,
          isMobile,
          deviceId: deviceIdRef.current,
          viewport: getViewport(),
          tabName: tabNameRef.current,
        }),
      }).catch(() => undefined);
    };

    sendPing();
    const interval = setInterval(sendPing, PING_INTERVAL_MS);
    const handleVisibility = () => document.visibilityState === 'visible' && sendPing();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [niche, route, isMobile, tenantName]);

  const updateTabName = (newTab: string) => { tabNameRef.current = newTab; };
  return { updateTabName };
}

export function useMobileDevicePing(params: Omit<UseDevicePingParams, 'isMobile'>) {
  return useDevicePing({ ...params, isMobile: true });
}

export function useDesktopDevicePing(params: Omit<UseDevicePingParams, 'isMobile'>) {
  return useDevicePing({ ...params, isMobile: false });
}

export default useDevicePing;
