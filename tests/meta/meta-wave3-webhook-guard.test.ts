// ==============================================================================
// Meta Wave 3 — HARDENING: webhook canônico (guardas de abuso)
// ==============================================================================
// Arquivo SEPARADO para isolar o registry de mocks do vi.mock global
// (contaminação de ordem entre describes no mesmo arquivo — vitest).
// ==============================================================================
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const rateLimitMock = vi.hoisted(() => ({ limit: vi.fn(async () => ({ success: true })) }));

vi.mock('@/lib/db', () => ({ db: {}, isDatabaseAvailable: vi.fn(async () => true) }));
vi.mock('@/lib/cerebro/telemetry-bridge', () => ({
  recordTelemetryEvent: vi.fn(),
  logSink: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/rate-limit', () => ({
  webhookRatelimit: rateLimitMock,
  apiRatelimit: { limit: vi.fn(async () => ({ success: true })) },
}));
vi.mock('@/lib/whatsapp-ai-responder', () => ({ processIncomingMessage: vi.fn() }));
vi.mock('@/lib/message-bundler', () => ({ bufferMessage: vi.fn() }));
vi.mock('@/lib/whatsapp-send', () => ({ sendWhatsAppMessage: vi.fn() }));
vi.mock('@/lib/lgpd-consent', () => ({
  isOptOutMessage: vi.fn(() => false),
  handleOptOut: vi.fn(),
}));
vi.mock('@/lib/bsuid-resolver', () => ({ resolveGuest: vi.fn() }));
vi.mock('@/lib/meta-cost-guard', () => ({
  recordMetaCost: vi.fn(),
  recordMetaPricingFromStatus: vi.fn(),
  classifyMessageType: vi.fn(),
  isWithinServiceWindow: vi.fn(),
  getServiceWindowRemaining: vi.fn(),
  checkMetaBudget: vi.fn(),
}));
vi.mock('@/lib/notifications/bridges', () => ({ bridgeWhatsAppIncoming: vi.fn() }));

describe('🛡️ Webhook canônico — guard de payload + rate limit', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    rateLimitMock.limit.mockImplementation(async () => ({ success: true }));
    process.env.META_APP_SECRET = 'test-secret-for-wave3-hardening-32ch';
    delete process.env.WEBHOOK_ALLOW_NO_SECRET;
  });

  afterEach(() => {
    delete process.env.META_APP_SECRET;
  });

  async function loadRoute() {
    return await import('@/app/api/webhooks/whatsapp/route');
  }

  function makeRequest(body: string, signature = 'sha256=invalid'): NextRequest {
    return new NextRequest('http://localhost/api/webhooks/whatsapp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': signature,
        'x-forwarded-for': '203.0.113.10',
      },
      body,
    });
  }

  it('payload > 1MB → 413 payload_too_large (antes mesmo da verificação HMAC e do rate limit)', async () => {
    const route = await loadRoute();
    const oversized = 'x'.repeat(1024 * 1024 + 1);
    const res = await route.POST(makeRequest(oversized));
    expect(res.status).toBe(413);
    const json = await res.json();
    expect(json.status).toBe('payload_too_large');
    expect(rateLimitMock.limit).not.toHaveBeenCalled();
  });

  it('rate limit negado → 429 rate_limited (mesmo com payload válido)', async () => {
    rateLimitMock.limit.mockResolvedValueOnce({ success: false });
    const route = await loadRoute();
    const res = await route.POST(
      makeRequest(JSON.stringify({ object: 'whatsapp_business_account' }))
    );
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.status).toBe('rate_limited');
  });

  it('estratégia anti-disable preservada: assinatura inválida → 200 {rejected}', async () => {
    const route = await loadRoute();
    const res = await route.POST(
      makeRequest(JSON.stringify({ object: 'whatsapp_business_account' }))
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('rejected');
  });
});
