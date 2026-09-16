// ==============================================================================
// Meta Wave 3 — HARDENING: attribution, ZéLLM learning, migrations, CAPI
// ==============================================================================
// Arquivo separado do webhook-guard e signature (registry de mocks isolado).
// ==============================================================================
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

// ── Mocks (padrão dos testes meta) ──────────────────────────────────────────
const dbMock = vi.hoisted(() => ({
  metaAttributionEvent: {
    findMany: vi.fn(async (..._a: unknown[]) => [] as unknown[]),
    updateMany: vi.fn(async (..._a: unknown[]) => ({ count: 1 })),
    create: vi.fn(async (..._a: unknown[]) => ({})),
    findFirst: vi.fn(async (..._a: unknown[]) => null as unknown),
  },
  conversationLog: {
    findFirst: vi.fn(async (..._a: unknown[]) => null as unknown),
    findUnique: vi.fn(async (..._a: unknown[]) => null as unknown),
    updateMany: vi.fn(async (..._a: unknown[]) => ({ count: 1 })),
    create: vi.fn(async (..._a: unknown[]) => ({})),
  },
  metaCostLog: {
    findFirst: vi.fn(async (..._a: unknown[]) => null),
    create: vi.fn(async (..._a: unknown[]) => ({})),
  },
  metaWebhookEvent: {
    findUnique: vi.fn(async (..._a: unknown[]) => null),
    create: vi.fn(async (..._a: unknown[]) => ({})),
    update: vi.fn(async (..._a: unknown[]) => ({})),
  },
  metaConnection: {
    updateMany: vi.fn(async (..._a: unknown[]) => ({ count: 1 })),
  },
}));

vi.mock('@/lib/db', () => ({ db: dbMock, isDatabaseAvailable: vi.fn(async () => true) }));
vi.mock('@/lib/cerebro/telemetry-bridge', () => ({
  recordTelemetryEvent: vi.fn(),
  logSink: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Implementações base restauradas explicitamente (determinismo entre tests)
function resetDbBaseImplementations() {
  dbMock.metaAttributionEvent.findMany.mockImplementation(async () => []);
  dbMock.metaAttributionEvent.updateMany.mockImplementation(async () => ({ count: 1 }));
  dbMock.metaAttributionEvent.findFirst.mockImplementation(async () => null);
  dbMock.conversationLog.findFirst.mockImplementation(async () => null);
  dbMock.conversationLog.updateMany.mockImplementation(async () => ({ count: 1 }));
}

// ── 1. ATTRIBUTION — CTM window + links com guard de tenant ─────────────────

describe('🔗 Attribution — janela CTM configurável e links seguros', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resetDbBaseImplementations();
    delete process.env.META_CTM_WINDOW_DAYS;
  });

  afterEach(() => {
    delete process.env.META_CTM_WINDOW_DAYS;
  });

  it('default: entry point expira em 7 dias', async () => {
    const mod = await import('@/lib/meta/meta-attribution');
    const now = new Date('2026-09-16T12:00:00Z');
    const ep = mod.buildEntryPointFromReferral(
      { source: 'ads', sourceId: 'camp-1', sourceUrl: null, sourceType: null, headline: null, body: null },
      now
    );
    expect(ep.entryPointType).toBe('click_to_whatsapp');
    expect(ep.entryPointExpiresAt.getTime() - ep.entryPointStartedAt.getTime()).toBe(7 * 86_400_000);
  });

  it('env META_CTM_WINDOW_DAYS=14 sobrepõe o default (sem hardcode)', async () => {
    process.env.META_CTM_WINDOW_DAYS = '14';
    const mod = await import('@/lib/meta/meta-attribution');
    const now = new Date('2026-09-16T12:00:00Z');
    const ep = mod.buildEntryPointFromReferral(
      { source: 'ads', sourceId: 'camp-1', sourceUrl: null, sourceType: null, headline: null, body: null },
      now
    );
    expect(ep.entryPointExpiresAt.getTime() - ep.entryPointStartedAt.getTime()).toBe(14 * 86_400_000);
  });

  it('env inválida (0/31/abc) cai no default 7', async () => {
    for (const bad of ['0', '31', 'abc']) {
      vi.resetModules();
      process.env.META_CTM_WINDOW_DAYS = bad;
      const mod = await import('@/lib/meta/meta-attribution');
      const now = new Date('2026-09-16T12:00:00Z');
      const ep = mod.buildEntryPointFromReferral(null, now);
      expect(ep.entryPointExpiresAt.getTime() - ep.entryPointStartedAt.getTime()).toBe(7 * 86_400_000);
    }
  });

  it('linkAttributionToConversation: true quando linka, false quando idempotente (count=0)', async () => {
    const mod = await import('@/lib/meta/meta-attribution');
    const ok = await mod.linkAttributionToConversation({
      tenantId: 'tenant-a',
      messageId: 'wamid.1',
      conversationId: 'conv-1',
    });
    expect(ok).toBe(true);
    expect(dbMock.metaAttributionEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-a', messageId: 'wamid.1', conversationId: null }),
      })
    );
    dbMock.metaAttributionEvent.updateMany.mockResolvedValueOnce({ count: 0 });
    const repeat = await mod.linkAttributionToConversation({
      tenantId: 'tenant-a',
      messageId: 'wamid.1',
      conversationId: 'conv-1',
    });
    expect(repeat).toBe(false);
  });

  it('linkAttributionToConversation: params ausentes → false sem tocar o DB', async () => {
    const mod = await import('@/lib/meta/meta-attribution');
    expect(await mod.linkAttributionToConversation({ tenantId: '', messageId: 'm', conversationId: 'c' })).toBe(false);
    expect(dbMock.metaAttributionEvent.updateMany).not.toHaveBeenCalled();
  });

  it('linkReservationToMetaAttribution: tenant mismatch (count=0) → NÃO linka', async () => {
    dbMock.metaAttributionEvent.findMany.mockResolvedValueOnce([
      {
        id: 'attr-1',
        confidence: 'DETERMINISTIC',
        entryPointType: 'click_to_whatsapp',
        entryPointExpiresAt: new Date(Date.now() + 86_400_000),
      },
    ]);
    dbMock.metaAttributionEvent.updateMany.mockResolvedValueOnce({ count: 0 });
    const mod = await import('@/lib/meta/meta-attribution');
    const linked = await mod.linkReservationToMetaAttribution({
      tenantId: 'tenant-a',
      guestPhone: '5511999990002',
      reservationId: 'res-1',
      reservationValue: 397,
    });
    expect(linked).toBe(false);
    expect(dbMock.metaAttributionEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'attr-1', tenantId: 'tenant-a' }) })
    );
  });
});

// ── 2. ZéLLM metadata round-trip (reservationValue) + guard tenant ──────────

describe('🧠 meta-learning — tenant guard + reservationValue persistido', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resetDbBaseImplementations();
    process.env.META_LEARNING_ENABLED = 'true';
  });

  afterEach(() => {
    delete process.env.META_LEARNING_ENABLED;
  });

  it('recordConversationOutcome grava reservationValue no metadata.zellm e filtra por tenant', async () => {
    dbMock.conversationLog.findFirst.mockResolvedValueOnce({ metadata: '{}' });
    const mod = await import('@/lib/meta/meta-learning');
    await mod.recordConversationOutcome({
      tenantId: 'tenant-a',
      conversationId: 'conv-9',
      channel: 'WHATSAPP',
      outcome: 'RESERVATION_SUCCESS',
      reservationValue: 397,
    });
    expect(dbMock.conversationLog.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'conv-9', tenantId: 'tenant-a' }) })
    );
    const updateCall = dbMock.conversationLog.updateMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
      data: { metadata: string };
    };
    expect(updateCall.where).toEqual(expect.objectContaining({ id: 'conv-9', tenantId: 'tenant-a' }));
    const metadata = JSON.parse(updateCall.data.metadata);
    expect(metadata.zellm.reservationValue).toBe(397);
    expect(metadata.zellm.lastOutcome).toBe('RESERVATION_SUCCESS');
  });

  it('conversa de OUTRO tenant (findFirst vazio) → não escreve nada', async () => {
    const mod = await import('@/lib/meta/meta-learning');
    await mod.recordConversationOutcome({
      tenantId: 'tenant-a',
      conversationId: 'conv-of-tenant-b',
      channel: 'WHATSAPP',
      outcome: 'RESERVATION_SUCCESS',
    });
    expect(dbMock.conversationLog.updateMany).not.toHaveBeenCalled();
  });
});

// ── 3. MIGRATIONS / SCHEMA ──────────────────────────────────────────────────

describe('🗄️ Migrations — Property.metadata, FK idempotente, RLS wave13', () => {
  it('migration property_metadata: ADD COLUMN IF NOT EXISTS metadata TEXT', () => {
    const sql = read('prisma/migrations/20260916120000_property_metadata_idempotent/migration.sql');
    expect(sql).toContain('ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "metadata" TEXT;');
  });

  it('migration FK idempotente: 2 constraints com CASCADE e guard de existência', () => {
    const sql = read('prisma/migrations/20260916130000_meta_tenant_fk_idempotent/migration.sql');
    expect(sql).toContain('meta_connections_tenantId_fkey');
    expect(sql).toContain('meta_attribution_events_tenantId_fkey');
    expect(sql).toContain('ON DELETE CASCADE ON UPDATE CASCADE');
    expect(sql.match(/NOT EXISTS/g)?.length).toBeGreaterThanOrEqual(2);
    expect(sql).toContain('pg_catalog.pg_constraint');
  });

  it('migration RLS: 3 tabelas Meta com padrão wave13 (ENABLE + policy, SEM FORCE)', () => {
    const sql = read('prisma/migrations/20260916140000_meta_tables_rls_wave13_pattern/migration.sql');
    expect((sql.match(/ENABLE ROW LEVEL SECURITY/g) ?? []).length).toBe(3);
    expect((sql.match(/CREATE POLICY/g) ?? []).length).toBe(3);
    expect(sql).toContain('meta_connections');
    expect(sql).toContain('meta_attribution_events');
    expect(sql).toContain('meta_cost_logs');
    expect(sql).toContain("current_setting('app.current_tenant_id', true)");
    // padrão v11-P0: sem FORCE (owner do pool Prisma faz bypass — app-level segue funcionando)
    expect(sql).not.toContain('FORCE ROW LEVEL SECURITY');
    // tabela de idempotência global (sem tenant) NÃO recebe RLS
    expect(sql).not.toContain('meta_webhook_events');
  });

  it('schema.prisma: @relation tenant nas 2 tabelas Meta + metadata em Property', () => {
    const schema = read('prisma/schema.prisma');
    expect(
      (schema.match(/tenant Tenant @relation\(fields: \[tenantId\], references: \[id\], onDelete: Cascade\)/g) ?? [])
        .length
    ).toBeGreaterThanOrEqual(2);
    expect(schema).toContain('metaConnections   MetaConnection[]');
    expect(schema).toContain('metaAttributionEvents MetaAttributionEvent[]');
    expect(schema).toMatch(/metadata\s+String\?/);
  });

  it('TENANT_MODELS inclui MetaConnection e MetaAttributionEvent', () => {
    const src = read('src/lib/db/tenant-prisma.ts');
    expect(src).toContain("'MetaConnection'");
    expect(src).toContain("'MetaAttributionEvent'");
    expect(src).toContain("'MetaCostLog'");
  });
});

// ── 4. CAPI — flag OFF, zero callers, dedupe própria ────────────────────────

describe('📡 Meta CAPI — contrato interno sem ativação externa', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.META_CAPI_ENABLED;
    delete process.env.META_CAPI_DATASET_ID;
    delete process.env.META_CAPI_ACCESS_TOKEN;
  });

  afterEach(() => {
    delete process.env.META_CAPI_ENABLED;
    delete process.env.META_CAPI_DATASET_ID;
    delete process.env.META_CAPI_ACCESS_TOKEN;
  });

  it('flag default OFF', async () => {
    const mod = await import('@/lib/meta/meta-config');
    expect(mod.META_CAPI_ENABLED).toBe(false);
    expect(mod.getMetaFeatureFlags().META_CAPI_ENABLED).toBe(false);
  });

  it('sendMetaCapiEvent com flag off → no-op {sent:false, flag_off} — sem fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('should not fetch'));
    const mod = await import('@/lib/meta/meta-capi');
    const result = await mod.sendMetaCapiEvent({
      event_name: 'purchase_test',
      event_id: 'zella-x',
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'system_generated',
      user_data: {},
    });
    expect(result).toEqual({ sent: false, reason: 'flag_off' });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('buildMetaCapiEvent: event_id determinístico (dedupe própria) e value só quando finito', async () => {
    const mod = await import('@/lib/meta/meta-capi');
    const now = new Date('2026-09-16T12:00:00Z');
    const ev = mod.buildMetaCapiEvent({
      eventName: 'purchase_test',
      messageId: 'wamid.77',
      eventTime: now,
      value: 397,
      currency: 'BRL',
    });
    expect(ev.event_id).toBe('zella-wamid.77');
    expect(ev.event_time).toBe(Math.floor(now.getTime() / 1000));
    expect(ev.custom_data).toEqual({ value: 397, currency: 'BRL' });
    const evNoValue = mod.buildMetaCapiEvent({
      eventName: 'purchase_test',
      messageId: 'wamid.78',
      eventTime: now,
      value: Number.NaN,
    });
    expect(evNoValue.custom_data).toBeUndefined();
  });

  it('resolveMetaCapiConfig: sem credenciais → null; com credenciais → datasetId correto', async () => {
    const mod = await import('@/lib/meta/meta-capi');
    expect(mod.resolveMetaCapiConfig({})).toBeNull();
    const cfg = mod.resolveMetaCapiConfig({ META_CAPI_DATASET_ID: 'ds-1', META_CAPI_ACCESS_TOKEN: 'tok' });
    expect(cfg).toEqual({ datasetId: 'ds-1', accessToken: 'tok', testEventCode: undefined });
  });

  it('ZERO callers em produção: sendMetaCapiEvent só existe no próprio módulo', () => {
    const { readdirSync, statSync } = require('node:fs');
    const { join } = require('node:path');
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        const st = statSync(p);
        if (st.isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts')) {
          if (readFileSync(p, 'utf8').includes('sendMetaCapiEvent')) hits.push(p);
        }
      }
    };
    walk(resolve(root, 'src'));
    expect(hits.every((h) => h.replace(/\\/g, '/').endsWith('src/lib/meta/meta-capi.ts'))).toBe(true);
  });
});
