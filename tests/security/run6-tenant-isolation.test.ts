/**
 * RUN 6 — Tenant Isolation: testes adversariais NEGATIVOS + POSITIVOS.
 *
 * Prova por invocação REAL das rotas/serviços corrigidos que:
 *  - tenant A autenticado NUNCA lê/escreve/deleta recursos do tenant B;
 *  - a autoridade de tenant é SEMPRE a sessão (body/query só como
 *    consistency check);
 *  - sem sessão → 401 (sem fallback first-tenant/demo);
 *  - operações legítimas do próprio tenant continuam funcionando (ALLOW).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks de infraestrutura ─────────────────────────────────────────────────

const mockSession = { user: { id: 'user_A', tenantId: 'tenant_A', role: 'TENANT_USER' } };

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => mockSession),
  default: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
  requireTenant: vi.fn(async () => mockSession.user.tenantId),
  verifyRobotToken: vi.fn(async () => false),
}));

vi.mock('@/lib/security/api-shield', () => ({
  withSecurity: (handler: unknown) => handler,
}));

vi.mock('@/lib/rate-limit', () => ({
  apiRatelimit: { limit: vi.fn(async () => ({ success: true })) },
  enforceRateLimit: vi.fn(async () => ({ success: true })),
  buildIdentifier: vi.fn(async () => 'ip-test'),
}));

// db mock — cada teste configura os modelos de que precisa.
const dbMock: Record<string, any> = {};
vi.mock('@/lib/db', () => ({
  db: new Proxy({}, {
    get(_t, prop: string) {
      if (!dbMock[prop]) dbMock[prop] = {};
      return dbMock[prop];
    },
  }),
  isDatabaseAvailable: vi.fn(async () => true),
}));

vi.mock('@/lib/ddc/ddc-mapper', () => ({
  resolveTenantId: vi.fn(async () => mockSession.user.tenantId),
  mapConversation: (c: unknown) => c,
}));

vi.mock('@/lib/security/tenant-context', () => ({
  getTenantId: vi.fn(async () => mockSession.user.tenantId),
  requireTenantId: vi.fn(async () => mockSession.user.tenantId),
  runWithTenant: vi.fn(async (_t: string, fn: () => Promise<unknown>) => fn()),
}));

vi.mock('@/lib/ddc/auth-utils', () => ({
  resolveTenantId: vi.fn(async () => mockSession.user.tenantId),
  requireDDCTenantId: vi.fn(async () => mockSession.user.tenantId),
}));

// ── Rotas / serviços (import após mocks) ────────────────────────────────────

import { DELETE as conversationsDELETE } from '@/app/api/ddc/conversations/route';
import { POST as onboardingPOST } from '@/app/api/onboarding/route';
import { GET as overviewGET } from '@/app/api/v1/guest/ddc/overview/route';
import { GET as notificationsGET } from '@/app/api/v1/guest/ddc/notifications/route';
import { POST as pushUnsubscribePOST } from '@/app/api/push/unsubscribe/route';
import { exportarDadosHospede } from '@/lib/lgpd/lgpd-service';
import { removePushSubscription } from '@/lib/push/push-service';

const jsonReq = (url: string, body: unknown, method = 'POST') =>
  new NextRequest(url, { method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const getReq = (url: string, headers: Record<string, string> = {}) =>
  new NextRequest(url, { method: 'GET', headers });

describe('RUN 6 — conversations DELETE (resource IDOR cross-tenant)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user.tenantId = 'tenant_A';
    dbMock.conversationLog = { deleteMany: vi.fn(async (args: any) => ({ count: args.where.tenantId === 'tenant_A' && args.where.id === 'conv_of_A' ? 1 : 0 })) };
  });

  it('NEGATIVO: tenant A não deleta conversa do tenant B (404 + where escopado)', async () => {
    const res = await conversationsDELETE(jsonReq('http://x/api/ddc/conversations', { conversationId: 'conv_of_B' }, 'DELETE'));
    expect(res.status).toBe(404);
    expect(dbMock.conversationLog.deleteMany).toHaveBeenCalledWith({ where: { id: 'conv_of_B', tenantId: 'tenant_A' } });
  });

  it('POSITIVO: tenant A deleta conversa própria (200)', async () => {
    const res = await conversationsDELETE(jsonReq('http://x/api/ddc/conversations', { conversationId: 'conv_of_A' }, 'DELETE'));
    expect(res.status).toBe(200);
    expect(dbMock.conversationLog.deleteMany).toHaveBeenCalledWith({ where: { id: 'conv_of_A', tenantId: 'tenant_A' } });
  });

  it('NEGATIVO: sem sessão → 401 e nenhuma deleção', async () => {
    const ddc = await import('@/lib/ddc/ddc-mapper');
    (ddc.resolveTenantId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await conversationsDELETE(jsonReq('http://x/api/ddc/conversations', { conversationId: 'conv_x' }, 'DELETE'));
    expect(res.status).toBe(401);
    expect(dbMock.conversationLog.deleteMany).not.toHaveBeenCalled();
  });
});

describe('RUN 6 — onboarding POST (escrita cross-tenant anônima)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.user = { findUnique: vi.fn(async (args: any) => args.where.email === 'vitima@x.com' ? { id: 'user_victim' } : null) };
    dbMock.tenant = {
      findFirst: vi.fn(async () => ({ id: 'tenant_victim' })),
      create: vi.fn(async (args: any) => ({ id: 'tenant_new', ...args.data })),
      update: vi.fn(),
    };
  });

  it('NEGATIVO: email de usuário COM tenant → 409 e tenant.update NUNCA é chamado', async () => {
    const res = await onboardingPOST(jsonReq('http://x/api/onboarding', { mode: 'pousada', planSlug: 'max', name: 'Ataque', email: 'vitima@x.com' }));
    expect(res.status).toBe(409);
    expect(dbMock.tenant.update).not.toHaveBeenCalled();
    expect(dbMock.tenant.create).not.toHaveBeenCalled();
  });

  it('NEGATIVO: email de usuário SEM tenant sem sessão → 403 (anti-squatting)', async () => {
    dbMock.user.findUnique = vi.fn(async () => ({ id: 'user_google' }));
    dbMock.tenant.findFirst = vi.fn(async () => null);
    const res = await onboardingPOST(jsonReq('http://x/api/onboarding', { mode: 'pousada', planSlug: 'max', name: 'X', email: 'google@x.com' }));
    expect([403, 409]).toContain(res.status);
    expect(dbMock.tenant.create).not.toHaveBeenCalled();
  });

  it('POSITIVO: signup de usuário novo → 201 com tenant criado', async () => {
    dbMock.user.findUnique = vi.fn(async () => null);
    dbMock.user.create = vi.fn(async (args: any) => ({ id: 'user_new', email: args.data.email, tenant: { id: 'tenant_new', name: 'Nova', plan: 'pro', niche: 'pousada' } }));
    const res = await onboardingPOST(jsonReq('http://x/api/onboarding', { mode: 'pousada', planSlug: 'pro', name: 'Nova', email: 'novo@x.com' }));
    expect(res.status).toBe(201);
    expect(dbMock.tenant.create).not.toHaveBeenCalled(); // caminho novo cria tenant embutido no user.create
  });
});

describe('RUN 6 — v1/guest/ddc overview + notifications (header/fallback removidos)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user.tenantId = 'tenant_A';
    dbMock.tenant = { findFirst: vi.fn(), findUnique: vi.fn(async () => ({ id: 'tenant_A', name: 'A', niche: 'pousada', plan: 'lite', domain: null })) };
    dbMock.reservation = {
      findMany: vi.fn(async () => [{
        id: 'r1',
        checkIn: new Date('2026-09-01T12:00:00Z'),
        checkOut: new Date(Date.now() + 5 * 24 * 3600 * 1000),
        status: 'CHECKED_IN',
        totalPrice: 700,
        source: 'whatsapp',
        guest: { id: 'g1', name: 'Hospede', phone: '5548999990000' },
        room: { id: 'room1', name: 'Suite 1' },
      }]),
    };
    dbMock.transaction = { findMany: vi.fn(async () => []) };
    dbMock.guestMessage = { findFirst: vi.fn(async () => null) };
  });

  it('NEGATIVO: sem sessão → 401 (nunca first-tenant/demo)', async () => {
    const tc = await import('@/lib/security/tenant-context');
    (tc.requireTenantId as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('UNAUTHORIZED'));
    const res = await overviewGET(getReq('http://x/api/v1/guest/ddc/overview'));
    expect(res.status).toBe(401);
    expect(dbMock.tenant.findFirst).not.toHaveBeenCalled();
    expect(dbMock.reservation.findMany).not.toHaveBeenCalled();
  });

  it('NEGATIVO: header X-Tenant-Id NÃO é mais autoridade (sem sessão → 401)', async () => {
    const tc = await import('@/lib/security/tenant-context');
    (tc.requireTenantId as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('UNAUTHORIZED'));
    const res = await overviewGET(getReq('http://x/api/v1/guest/ddc/overview', { 'x-tenant-id': 'tenant_B' }));
    expect(res.status).toBe(401);
    expect(dbMock.reservation.findMany).not.toHaveBeenCalled();
  });

  it('POSITIVO: sessão tenant_A → consultas apenas em tenant_A', async () => {
    const tc = await import('@/lib/security/tenant-context');
    (tc.requireTenantId as ReturnType<typeof vi.fn>).mockResolvedValue('tenant_A');
    const res = await overviewGET(getReq('http://x/api/v1/guest/ddc/overview'));
    expect(res.status).toBe(200);
    expect(dbMock.reservation.findMany.mock.calls[0][0].where.tenantId).toBe('tenant_A');
  });

  it('NEGATIVO: notifications sem sessão → 401 e nenhuma leitura', async () => {
    const tc = await import('@/lib/security/tenant-context');
    (tc.requireTenantId as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('UNAUTHORIZED'));
    const res = await notificationsGET(getReq('http://x/api/v1/guest/ddc/notifications'));
    expect(res.status).toBe(401);
    expect(dbMock.transaction.findMany).not.toHaveBeenCalled();
  });
});

describe('RUN 6 — LGPD export (resource → tenant ownership no serviço)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.guest = { findFirst: vi.fn(async (args: any) => args.where.tenantId === 'tenant_A' && args.where.id === 'guest_A' ? { id: 'guest_A', name: 'Hospede A' } : null) };
    dbMock.reservation = { findMany: vi.fn(async () => []) };
    dbMock.conversation = { findMany: vi.fn(async () => []) };
    dbMock.review = { findMany: vi.fn(async () => []) };
    dbMock.consentLog = { findMany: vi.fn(async () => []) };
    dbMock.upsellRecord = { findMany: vi.fn(async () => []) };
  });

  it('NEGATIVO: guestId de outro tenant → guest NUNCA retornado (where escopado)', async () => {
    const data = await exportarDadosHospede('tenant_A', 'guest_B');
    expect(data.guest).toBeNull();
    expect(dbMock.guest.findFirst).toHaveBeenCalledWith({ where: { id: 'guest_B', tenantId: 'tenant_A' } });
  });

  it('POSITIVO: guestId do próprio tenant → dados exportados', async () => {
    const data = await exportarDadosHospede('tenant_A', 'guest_A');
    expect(data.guest).toEqual({ id: 'guest_A', name: 'Hospede A' });
  });
});

describe('RUN 6 — push unsubscribe (endpoint cross-tenant)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user.tenantId = 'tenant_A';
    dbMock.pushSubscription = { updateMany: vi.fn(async (args: any) => ({ count: args.where.tenantId === 'tenant_A' ? 1 : 0 })) };
  });

  it('NEGATIVO/POSITIVO: desativação escopada ao tenant da sessão (serviço real + db mockado)', async () => {
    const res = await pushUnsubscribePOST(jsonReq('http://x/api/push/unsubscribe', { endpoint: 'https://push.service/endpoint_of_B' }));
    expect(res.status).toBe(200);
    expect(dbMock.pushSubscription.updateMany).toHaveBeenCalledWith({ where: { endpoint: 'https://push.service/endpoint_of_B', tenantId: 'tenant_A' }, data: { isActive: false } });

    // Service-level direto: where sempre inclui tenantId
    const r2 = await removePushSubscription('https://push.service/endpoint_other', 'tenant_A');
    expect(r2.success).toBe(true);
    expect(dbMock.pushSubscription.updateMany).toHaveBeenLastCalledWith({ where: { endpoint: 'https://push.service/endpoint_other', tenantId: 'tenant_A' }, data: { isActive: false } });
  });
});
