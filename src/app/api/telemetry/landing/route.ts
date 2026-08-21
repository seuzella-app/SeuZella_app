import { NextRequest, NextResponse } from 'next/server';
import { recordTelemetryEvent } from '@/lib/cerebro/telemetry-bridge';

const MAX_BODY_BYTES = 16 * 1024;
const MAX_STRING_LENGTH = 200;
const MAX_METADATA_KEYS = 20;
const LANDING_EVENTS = new Set(['hero_planos', 'hero_parceiro', 'pousada_demo', 'airbnb_demo', 'final_cta', 'landing.click']);

export const landingMetricsStore = {
  totalClicks: 1420,
  ctaClicks: { hero_planos: 412, hero_parceiro: 328, pousada_demo: 290, airbnb_demo: 275, final_cta: 115 },
  planInterests: { LITE: 142, PRO: 418, MAX: 205, PARCEIRO: 395 },
  recentEvents: [] as Array<{ eventName: string; category: string; label?: string; timestamp: string }>,
};

const noStoreHeaders = { 'Cache-Control': 'no-store' };

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get('content-length') || '0');
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return NextResponse.json({ success: false, error: 'Payload too large' }, { status: 413, headers: noStoreHeaders });
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) return NextResponse.json({ success: false, error: 'Payload too large' }, { status: 413, headers: noStoreHeaders });
    let body: any;
    try { body = JSON.parse(rawBody); } catch { return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400, headers: noStoreHeaders }); }
    const { eventName, category, label, planId, metadata } = body ?? {};
    if (typeof eventName !== 'string' || !LANDING_EVENTS.has(eventName)) return NextResponse.json({ success: false, error: 'Invalid event' }, { status: 400, headers: noStoreHeaders });
    if (category !== undefined && (typeof category !== 'string' || category.length > MAX_STRING_LENGTH)) return NextResponse.json({ success: false, error: 'Invalid category' }, { status: 400, headers: noStoreHeaders });
    if (label !== undefined && (typeof label !== 'string' || label.length > MAX_STRING_LENGTH)) return NextResponse.json({ success: false, error: 'Invalid label' }, { status: 400, headers: noStoreHeaders });
    if (planId !== undefined && (typeof planId !== 'string' || planId.length > MAX_STRING_LENGTH)) return NextResponse.json({ success: false, error: 'Invalid plan' }, { status: 400, headers: noStoreHeaders });
    if (metadata !== undefined && (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata))) return NextResponse.json({ success: false, error: 'Invalid metadata' }, { status: 400, headers: noStoreHeaders });
    if (metadata && Object.keys(metadata).length > MAX_METADATA_KEYS) return NextResponse.json({ success: false, error: 'Too much metadata' }, { status: 400, headers: noStoreHeaders });

    recordTelemetryEvent({ type: 'landing_click', name: eventName, module: 'landing-page', severity: 'info', message: `[Landing Page] Evento: ${eventName} (${category || 'general'}) — ${label || planId || ''}`, context: { category, label, planId, metadata } });
    landingMetricsStore.totalClicks++;
    if (category === 'plan_selection' && planId) {
      const p = planId.toUpperCase();
      if (landingMetricsStore.planInterests[p as keyof typeof landingMetricsStore.planInterests] !== undefined) landingMetricsStore.planInterests[p as keyof typeof landingMetricsStore.planInterests]++;
    } else if (landingMetricsStore.ctaClicks[eventName as keyof typeof landingMetricsStore.ctaClicks] !== undefined) {
      landingMetricsStore.ctaClicks[eventName as keyof typeof landingMetricsStore.ctaClicks]++;
    }
    landingMetricsStore.recentEvents.unshift({ eventName, category: category || 'general', label: label || planId, timestamp: new Date().toISOString() });
    if (landingMetricsStore.recentEvents.length > 50) landingMetricsStore.recentEvents.pop();
    return NextResponse.json({ success: true }, { headers: noStoreHeaders });
  } catch (error) {
    console.error('Landing telemetry error:', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ success: false, error: 'Telemetry unavailable' }, { status: 503, headers: noStoreHeaders });
  }
}

export async function GET(request: NextRequest) {
  const configuredKey = process.env.ZCC_MASTER_KEY;
  const providedKey = request.headers.get('x-zcc-master-key');
  if (!configuredKey || !providedKey || providedKey.length !== configuredKey.length || !cryptoSafeEqual(providedKey, configuredKey)) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401, headers: noStoreHeaders });
  }
  return NextResponse.json({ success: true, data: landingMetricsStore }, { headers: noStoreHeaders });
}

function cryptoSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}
