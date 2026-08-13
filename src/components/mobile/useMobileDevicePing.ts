'use client';

/**
 * useMobileDevicePing — Hook para registrar pings de dispositivos mobile
 * =====================================================================
 *
 * Usado por MobilePousadaSuperApp e MobileAirbnbSuperApp para registrar
 * visitas na tabela `MobileDevicePing` (consultada pelo ZCC > Mobile Devices).
 *
 * Comportamento:
 *   - Gera um deviceId efêmero (sessionStorage) — não persistente
 *   - Faz POST para /api/mobile/devices-tracking no mount e a cada 5min
 *   - Faz POST também onVisibilityChange quando volta para foreground
 *   - Best-effort: falhas silenciosas, nunca quebra a UX mobile
 *
 * LGPD: Não coleta dados pessoais. Apenas:
 *   - tenantId (do subdomínio, sessão, ou fallback 'demo')
 *   - niche (pousada | airbnb)
 *   - viewport (largura x altura)
 *   - userAgent (apenas para parse de tipo de dispositivo)
 *   - deviceId efêmero (sessionStorage, destruído ao fechar aba)
 */

import { useEffect, useRef } from 'react';

interface UseMobileDevicePingParams {
  niche: 'pousada' | 'airbnb';
  /** TenantId — se não fornecido, usa 'demo' */
  tenantId?: string;
  /** Tenant name amigável (opcional) */
  tenantName?: string;
}

const PING_INTERVAL_MS = 5 * 60 * 1000; // 5 min
const DEVICE_ID_STORAGE_KEY = 'zella_mobile_device_id';

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

export function useMobileDevicePing({ niche, tenantId = 'demo', tenantName }: UseMobileDevicePingParams) {
  const deviceIdRef = useRef<string>('');

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
            deviceId: deviceIdRef.current,
            viewport: getViewport(),
            userAgent: getUserAgent(),
            firstSeen,
          }),
          // best-effort, não bloqueia unload
          keepalive: true,
        });
      } catch {
        // Falha silenciosa — não impacta UX
      }
    };

    // Ping inicial no mount
    sendPing();

    // Refresh a cada 5min
    const interval = setInterval(sendPing, PING_INTERVAL_MS);

    // Reenvia ping quando aba volta para foreground
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
  }, [niche, tenantId, tenantName]);
}

export default useMobileDevicePing;
