/**
 * RUN 6B — UNKNOWN ZERO: classificação provada por teste.
 *
 * Superfícies reclassificadas nesta onda e agora com prova comportamental:
 *  - R6B-01 /api/security            → plano plataforma (gate ZCC);
 *  - R6B-02 /api/swipe-templates     → tenant-scoped (escopo da sessão);
 *  - R6B-03 /api/monitoring          → plano plataforma (gate ZCC);
 *  - R6B-04 /api/tenants             → plano plataforma (gate ZCC; antes
 *    role 'admin' de TENANT listava todos os tenants);
 *  - R6B-05 /api/admin/faturamento-zehla + upsell-analytics → gate ZCC
 *    (antes: 'ADMIN' uppercase nunca ocorria = deny-all com role morta).
 *
 * DENY: sessão de tenant comum → 404/403/401 e NENHUMA leitura.
 * ALLOW: admin de plataforma autorizado (gate ZCC) continua operando.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockSession: { user: { id: string; tenantId: string; role: string; email?: string } } = {
  user: { id: 'user_A', tenantId: 'tenant_A', role: 'owner', email: 'owner@pousadaa.com' },
};

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => mockSession),
  default: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
  requireTenant: vi.fn(async () => mockSession.user.tenantId),
  verifyRobotToken: vi.fn(async () => false),
}));

const zccAllowed = vi.fn(async () => false); // mutável por teste
vi.mock('@/lib/zcc-security', () => ({
  verifyZCCAccessOrReject: vi.fn(async (request: unknown) => {
    if (await zccAllowed()) return { allowed: true, response: undefined };
    const { NextResponse } = await import('next/server');
    return { allowed: false, response: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }),
}));

vi.mock('@/lib/security/api-shield', () => ({
  withSecurity: (handler: unknown) => handler,
}));

vi.mock('@/lib/rate-limit', () => ({
  apiRatelimit: { limit: vi.fn(async () => ({ success: true, remaining: 9, reset: Date.now() + 60000 })) },
  authRatelimit: { limit: vi.fn(async () => ({ success: true })) },
  buildIdentifier: vi.fn(async () => 'ip-test'),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(),
    withRequest: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })),
    getBufferStats: vi.fn(() => ({})),
  },
}));

vi.mock('@/lib/monitoring', () => ({
  getSystemMetrics: vi.fn(() => ({ uptime: 1, memory: {} })),
  getCounters: vi.fn(() => []),
  getTimers: vi.fn(() => []),
  getRequestStats: vi.fn(() => []),
  getHealthChecks: vi.fn(() => []),
}));

vi.mock('@/lib/upsell/faturamento-zehla', () => ({
  calcularFaturamentoMensalZehla: vi.fn(async () => ({ total: 0 })),
  gerarCobrancasMensais: vi.fn(async () => []),
  formatarPeriodo: vi.fn(() => '2026-09'),
}));

vi.mock('@/lib/upsell/upsell-analytics', () => ({
  calcularBehavioralMetrics: vi.fn(async () => ({})),
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

// ── Rotas (import após mocks) ───────────────────────────────────────────────

import { GET as securityGET } from '@/app/api/security/route';
import { GET as swipeTemplatesGET } from '@/app/api/swipe-templates/route';
import { GET as monitoringGET } from '@/app/api/monitoring/route';
import { GET as tenantsGET } from '@/app/api/tenants/route';
import { GET as faturamentoGET } from '@/app/api/admin/faturamento-zehla/route';
import { GET as upsellAnalyticsGET } from '@/app/api/admin/upsell-analytics/route';

const getReq = (url: string, headers: Record<string, string> = {}) =>
  new NextRequest(url, { method: 'GET', headers });

describe('RUN 6B — R6B-01 /api/security (alertas cross-tenant → plano ZCC)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    zccAllowed.mockResolvedValue(false);
    dbMock.securityAlert = { findMany: vi.fn(async () => [{ id: 'al1', tenantId: 'tenant_B', description: 'alerta do tenant B' }]) };
    dbMock.lead = { count: vi.fn(async () => 0) };
  });

  it('DENY: sessão de tenant comum → 404 e NENHUMA leitura de alertas', async () => {
    const res = await securityGET(getReq('http://x/api/security'));
    expect(res.status).toBe(404);
    expect(dbMock.securityAlert.findMany).not.toHaveBeenCalled();
  });

  it('ALLOW: admin de plataforma (gate ZCC) lê alertas do plano', async () => {
    zccAllowed.mockResolvedValue(true);
    const res = await securityGET(getReq('http://x/api/security'));
    expect(res.status).toBe(200);
    expect(dbMock.securityAlert.findMany).toHaveBeenCalled();
  });
});

describe('RUN 6B — R6B-02 /api/swipe-templates (recurso tenant-scoped)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.swipeTemplate = {
      findMany: vi.fn(async (args: any) =>
        args?.where?.tenantId === 'tenant_A'
          ? [{ id: 't_A1', tenantId: 'tenant_A', content: 'template do A', createdAt: new Date('2026-09-01T10:00:00Z'), updatedAt: new Date('2026-09-01T10:00:00Z') }]
          : []),
    };
  });

  it('DENY: sem sessão → 401 e nenhuma leitura', async () => {
    const nextAuth = await import('next-auth');
    (nextAuth.getServerSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await swipeTemplatesGET(getReq('http://x/api/swipe-templates'));
    expect(res.status).toBe(401);
    expect(dbMock.swipeTemplate.findMany).not.toHaveBeenCalled();
  });

  it('ALLOW: tenant A lê SOMENTE templates do tenant A (where escopado)', async () => {
    const res = await swipeTemplatesGET(getReq('http://x/api/swipe-templates'));
    expect(res.status).toBe(200);
    expect(dbMock.swipeTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant_A', isActive: true }) }),
    );
    const body = await res.json();
    expect(body.every((t: { tenantId?: string }) => !t.tenantId || t.tenantId === 'tenant_A')).toBe(true);
  });

  it('DENY (estrutural): where SEMPRE inclui tenantId — nenhum caminho sem escopo', async () => {
    await swipeTemplatesGET(getReq('http://x/api/swipe-templates'));
    for (const call of (dbMock.swipeTemplate.findMany as ReturnType<typeof vi.fn>).mock.calls) {
      const args = call[0] as { where?: { tenantId?: string } };
      expect(args?.where?.tenantId).toBe('tenant_A');
    }
  });
});

describe('RUN 6B — R6B-03 /api/monitoring (telemetria global → plano ZCC)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    zccAllowed.mockResolvedValue(false);
  });

  it('DENY: sessão de tenant comum → 404', async () => {
    const res = await monitoringGET(getReq('http://x/api/monitoring'));
    expect(res.status).toBe(404);
  });

  it('ALLOW: admin de plataforma (gate ZCC) lê telemetria', async () => {
    zccAllowed.mockResolvedValue(true);
    const res = await monitoringGET(getReq('http://x/api/monitoring'));
    expect(res.status).toBe(200);
  });
});

describe('RUN 6B — R6B-04 /api/tenants (listagem global → plano ZCC)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    zccAllowed.mockResolvedValue(false);
    dbMock.tenant = { findMany: vi.fn(async () => [{ id: 'tenant_B', name: 'Pousada B', email: 'b@b.com' }]) };
  });

  it('DENY: role admin de TENANT não lista mais todos os tenants (fix do leak)', async () => {
    mockSession.user.role = 'admin';
    const res = await tenantsGET(getReq('http://x/api/tenants'));
    expect(res.status).toBe(404);
    expect(dbMock.tenant.findMany).not.toHaveBeenCalled();
    mockSession.user.role = 'owner';
  });

  it('ALLOW: admin de plataforma (gate ZCC) lista tenants', async () => {
    zccAllowed.mockResolvedValue(true);
    const res = await tenantsGET(getReq('http://x/api/tenants'));
    expect(res.status).toBe(200);
    expect(dbMock.tenant.findMany).toHaveBeenCalled();
  });
});

describe('RUN 6B — R6B-05 /api/admin/faturamento-zehla + upsell-analytics (role morta → gate ZCC)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    zccAllowed.mockResolvedValue(false);
    dbMock.upsellRecord = { findMany: vi.fn(async () => []) };
  });

  it('DENY: sessão de tenant → 404 em ambas as rotas', async () => {
    const r1 = await faturamentoGET(getReq('http://x/api/admin/faturamento-zehla'));
    const r2 = await upsellAnalyticsGET(getReq('http://x/api/admin/upsell-analytics'));
    expect(r1.status).toBe(404);
    expect(r2.status).toBe(404);
  });

  it('ALLOW: admin de plataforma (gate ZCC) acessa faturamento e analytics', async () => {
    zccAllowed.mockResolvedValue(true);
    const r1 = await faturamentoGET(getReq('http://x/api/admin/faturamento-zehla'));
    const r2 = await upsellAnalyticsGET(getReq('http://x/api/admin/upsell-analytics'));
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
  });
});
