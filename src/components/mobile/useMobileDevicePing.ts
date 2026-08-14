'use client';

/**
 * useDevicePing — Hook unificado para tracking de Desktop + Mobile
 * =================================================================
 *
 * Usado por:
 *   - MobilePousadaSuperApp (/mobile/pousada)
 *   - MobileAirbnbSuperApp (/mobile/airbnb)
 *   - DDC desktop (Pousada + Airbnb) — via useDesktopDevicePing
 *
 * Registra pings em `DevicePing` (Prisma) consultados pelo painel
 * "Mobile Analytics" no ZCC para comparar Desktop vs Mobile.
 *
 * Comportamento:
 *   - Gera deviceId efêmero (sessionStorage) — não persistente
 *   - POST para /api/mobile/devices-tracking no mount e a cada 5min
 *   - Reenvia ping quando aba volta para foreground (visibilitychange)
 *   - Best-effort: falhas silenciosas, nunca quebra a UX
 *
 * LGPD: Não coleta dados pessoais. Apenas:
 *   - tenantId (do subdomínio, sessão, ou fallback 'demo')
 *   - niche (pousada | airbnb)
 *   - route (/ddc/pousada, /mobile/pousada, etc.)
 *   - isMobile (true para /mobile/*)
 *   - viewport (largura x altura)
 *   - userAgent (apenas para parse de tipo de dispositivo)
 *   - tabName (aba ativa dentro do app)
 *   - deviceId efêmero (sessionStorage, destruído ao fechar aba)
 */

import { useEffect, useRef } from 'react';

interface UseDevicePingParams {
  niche: 'pousada' | 'airbnb';
  /** Rota completa: /ddc/pousada, /mobile/pousada, /ddc/airbnb, /mobile/airbnb */
  route: string;
  /** true se for mobile (/mobile/*), false se for desktop (/ddc/*) */
  isMobile: boolean;
  /** TenantId — se não fornecido, usa 'demo' */
  tenantId?: string;
  /** Tenant name amigável (opcional) */
  tenantName?: string;
  /** Aba ativa (opcional, atualizada dinamicamente) */
  tabName?: string;
}

const PING_INTERVAL_MS = 5 * 60 * 1000; // 5 min
const DEVICE_ID_STORAGE_KEY = 'zella_device_id';

function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'ssr';
  try {
    let id = sessionStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (!id) {
      id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return 'fallback';
  }
}

function getViewport(): string {
  if (typeof window === 'undefined') return 'unknown';
  return `${window.innerWidth}x${window.innerHeight}`;
}

function getUserAgent(): string {
  if (typeof navigator === 'undefined') return '';
  return navigator.userAgent;
}

export function useDevicePing({
  niche,
  route,
  isMobile,
  tenantId = 'demo',
  tenantName,
  tabName,
}: UseDevicePingParams) {
  const deviceIdRef = useRef<string>('');
  const tabNameRef = useRef<string | undefined>(tabName);

  // Permite atualizar tabName dinamicamente sem re-rodar o effect
  useEffect(() => {
    tabNameRef.current = tabName;
  }, [tabName]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    deviceIdRef.current = getOrCreateDeviceId();
    const firstSeen = new Date().toISOString();

    const sendPing = async () => {
      try {
        await fetch('/api/mobile/devices-tracking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId,
            tenantName,
            niche,
            route,
            isMobile,
            deviceId: deviceIdRef.current,
            viewport: getViewport(),
            userAgent: getUserAgent(),
            tabName: tabNameRef.current,
            firstSeen,
          }),
          keepalive: true,
        });
      } catch {
        // Falha silenciosa — não impacta UX
      }
    };

    sendPing();
    const interval = setInterval(sendPing, PING_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        sendPing();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [niche, route, isMobile, tenantId, tenantName]);

  /** Atualiza o tabName atual (chamar quando usuário troca de aba no app) */
  const updateTabName = (newTab: string) => {
    tabNameRef.current = newTab;
    // Envia ping imediato ao trocar de aba (captura engagement por aba)
    if (typeof window !== 'undefined' && deviceIdRef.current) {
      try {
        fetch('/api/mobile/devices-tracking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId,
            tenantName,
            niche,
            route,
            isMobile,
            deviceId: deviceIdRef.current,
            viewport: getViewport(),
            userAgent: getUserAgent(),
            tabName: newTab,
            firstSeen: new Date().toISOString(),
          }),
          keepalive: true,
        }).catch(() => {});
      } catch {}
    }
  };

  return { updateTabName };
}

/**
 * Helper: hook específico para mobile (sem necessidade de passar isMobile=true)
 */
export function useMobileDevicePing(params: Omit<UseDevicePingParams, 'isMobile'>) {
  return useDevicePing({ ...params, isMobile: true });
}

/**
 * Helper: hook específico para desktop (DDC Shell)
 */
export function useDesktopDevicePing(params: Omit<UseDevicePingParams, 'isMobile'>) {
  return useDevicePing({ ...params, isMobile: false });
}

export default useDevicePing;
