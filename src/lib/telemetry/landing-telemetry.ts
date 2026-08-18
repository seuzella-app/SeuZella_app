// ============================================================================
// SEU ZÉLLA — Landing Page Telemetry (Integração Cérebro Zélla)
// ============================================================================
// Envia cliques, seleções de plano, aberturas de modais e interações da
// Landing Page diretamente para o Cérebro Zélla via /api/telemetry/landing.
// ============================================================================

export interface LandingTelemetryPayload {
  eventName: string;
  category: 'cta_click' | 'plan_selection' | 'nav_click' | 'modal_open' | 'faq_interaction' | 'demo_try';
  label?: string;
  planId?: string;
  path?: string;
  metadata?: Record<string, unknown>;
}

export function trackLandingClick(payload: LandingTelemetryPayload): void {
  if (typeof window === 'undefined') return;

  const data = JSON.stringify({
    ...payload,
    path: payload.path || window.location.pathname,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
  });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([data], { type: 'application/json' });
      navigator.sendBeacon('/api/telemetry/landing', blob);
    } else {
      fetch('/api/telemetry/landing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data,
        keepalive: true,
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('[LandingTelemetry] error sending event:', err);
  }
}
