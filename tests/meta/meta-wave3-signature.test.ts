// ==============================================================================
// Meta Wave 3 — assinatura posicional + dívida de type-safety + certificações
// ==============================================================================
// Arquivo separado para isolar vi.doMock (registry próprio).
// ==============================================================================
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

const sendMock = vi.hoisted(() =>
  vi.fn(async (..._a: unknown[]) => ({ success: true, isMock: true }))
);
const dbHouseMock = vi.hoisted(() => ({ room: { updateMany: vi.fn(async () => ({})) } }));

vi.mock('@/lib/whatsapp-send', () => ({ sendWhatsAppMessage: sendMock }));
vi.mock('@/lib/db', () => ({ db: dbHouseMock, isDatabaseAvailable: vi.fn(async () => true) }));

describe('📞 sendWhatsAppMessage — assinatura posicional (unit, housekeeping)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('handleCheckoutEvent chama (phone, mensagem, {tenantId}) — nunca objeto', async () => {
    const mod = await import('@/lib/housekeeping/index');
    await mod.handleCheckoutEvent({
      tenantId: 'tenant-a',
      roomName: 'Suíte 7',
      guestName: 'Maria',
      cleaningTeamPhone: '5511999990001',
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const [to, text, opts] = sendMock.mock.calls[0];
    expect(to).toBe('5511999990001');
    expect(typeof text).toBe('string');
    expect(text).toContain('Suíte 7');
    expect(opts).toEqual({ tenantId: 'tenant-a' });
  });
});

describe('📞 sendWhatsAppMessage — os 4 call sites corrigidos (certificação)', () => {
  it('nenhum dos 4 arquivos usa mais a forma objeto sendWhatsAppMessage({', () => {
    const files = [
      'src/app/api/cron/payment-confirmation/route.ts',
      'src/app/api/cron/nps-checkout/route.ts',
      'src/app/api/cron/lembrete-checkin/route.ts',
      'src/lib/housekeeping/index.ts',
    ];
    for (const file of files) {
      const src = read(file);
      expect(src, file).not.toMatch(/sendWhatsAppMessage\(\s*\{/);
      expect(src, `${file} deve passar phone como 1º arg posicional`).toMatch(
        /sendWhatsAppMessage\(\s*(phone|params\.cleaningTeamPhone)/
      );
    }
  });
});

describe('🧹 @ts-nocheck — dívida de type-safety zerada nos 5 arquivos da onda', () => {
  const files = [
    'src/lib/whatsapp-ai-responder.ts',
    'src/app/api/cron/payment-confirmation/route.ts',
    'src/app/api/cron/nps-checkout/route.ts',
    'src/app/api/cron/lembrete-checkin/route.ts',
    'src/lib/housekeeping/index.ts',
  ];

  it('nenhum dos 5 arquivos contém a diretiva @ts-nocheck', () => {
    for (const file of files) {
      expect(read(file), file).not.toMatch(/^\/\/ @ts-nocheck/m);
    }
  });

  it('ai-responder parseia Property.metadata como string JSON (contrato do schema)', () => {
    const src = read('src/lib/whatsapp-ai-responder.ts');
    expect(src).toContain('JSON.parse(property?.metadata');
    expect(src).not.toContain('property?.metadata?.aiTone');
    expect(src).toContain('propertyMeta.aiTone');
  });
});

describe('💳 payment-confirmation — types reais dos gateways', () => {
  it('usa startsWith RESERVATION_PAYMENT e nunca mais o literal PAYMENT', () => {
    const src = read('src/app/api/cron/payment-confirmation/route.ts');
    expect(src).toContain("startsWith: 'RESERVATION_PAYMENT'");
    expect(src).not.toMatch(/type:\s*'PAYMENT'/);
  });

  it('consistência: o tipo criado pelos gateways começa com RESERVATION_PAYMENT', () => {
    const gateway = read('src/lib/payments/process-reservation-webhook.ts');
    expect(gateway).toContain('`RESERVATION_PAYMENT:${event.gateway}`');
  });
});

describe('💰 revenue-details — resposta honesta (anti "verde fabricado")', () => {
  it('sem transações demo; degraded response com source database_unavailable', () => {
    const src = read('src/app/api/ddc/revenue-details/route.ts');
    expect(src).not.toContain('demoTransactions');
    expect(src).not.toContain('demo-tx-1');
    expect(src).toContain("'database_unavailable'");
    expect(src).toContain('degraded: true');
    expect(src).toContain('resolveTenantId');
  });
});

describe('🔒 api-shield — paridade de rotas públicas', () => {
  it("PUBLIC_ROUTES contém '/api/webhooks/whatsapp'", () => {
    const src = read('src/lib/security/api-shield.ts');
    expect(src).toContain("'/api/webhooks/whatsapp'");
  });
});

describe('🕸️ Webhook — wiring attribution → conversation + guardas', () => {
  it('rota importa e chama o link nas duas branches (texto e mídia)', () => {
    const src = read('src/app/api/webhooks/whatsapp/route.ts');
    expect(src).toContain('linkAttributionToConversation');
    expect(src.match(/linkAttributionToConversation\(/g)?.length).toBeGreaterThanOrEqual(2);
    expect(src).toContain('payload_too_large');
    expect(src).toContain('rate_limited');
  });
});
