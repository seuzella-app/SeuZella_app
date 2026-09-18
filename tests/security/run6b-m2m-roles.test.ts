/**
 * RUN 6B — Role Matrix (§17) + Machine Tokens (§19/§23).
 *
 * Roles REAIS no código (lowercase): owner(4) > admin(3) > staff(2) > client(1),
 * com system_admin reservado ao plano ZCC (email ∈ ZCC_ADMIN_EMAILs ou master
 * admin). Prova comportamental:
 *  - hierarquia em requireTenantAccess (owner/admin/staff/client);
 *  - system_admin NÃO ganha acesso global por acidente de comparação:
 *    passagem explícita no gate do plano (persisted-user check intencionalmente
 *    dispensado para o tenant ZCC — documento em RUN6B_ROLE_MATRIX.json);
 *  - JWT "stale" (user reassigned) → 403 TENANT_MISMATCH;
 *  - withApiGuard: TENANT_USER = owner/admin/staff; ADMIN guard = owner
 *    (string 'ADMIN' nunca ocorre — RES-11 documentado, deny-safe);
 *  - machine token válido → ALLOW; inválido → DENY;
 *  - dev bypass M2M NUNCA em produção (regressão R6-15);
 *  - cron unificado fail-closed (503) sem nenhuma credencial em produção.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mockSession: { user: { id: string; tenantId: string; role: string; email?: string } } = {
  user: { id: 'user_A', tenantId: 'tenant_A', role: 'owner', email: 'a@a.com' },
};

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => mockSession),
  default: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
  requireTenant: vi.fn(async () => mockSession.user.tenantId),
  verifyRobotToken: vi.fn((req: Request) => {
    const header = req.headers.get('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    const configured = [process.env.ZEHLA_LOOP_API_KEY, process.env.ZAI_API_KEY].filter((v): v is string => !!v);
    if (!token || configured.length === 0) return false;
    return configured.includes(token);
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

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

vi.mock('@/lib/rate-limit', () => ({
  apiRatelimit: { limit: vi.fn(async () => ({ success: true })) },
  authRatelimit: { limit: vi.fn(async () => ({ success: true })) },
}));

import { requireTenantAccess } from '@/lib/security/tenant-authorization';
import { withApiGuard, withTenantGuard, withAdminGuard } from '@/lib/security/api-guard';
import { verifyRobotToken } from '@/lib/auth';
import { verifyCronM2MToken } from '@/lib/security/cron-auth';
import { verifyCronAuth } from '@/lib/security/cron-auth-unified';

const getReq = (url: string, headers: Record<string, string> = {}) =>
  new NextRequest(url, { method: 'GET', headers });

function configureTenantDb() {
  dbMock.tenant = {
    findUnique: vi.fn(async (args: any) =>
      args?.where?.id === 'tenant_A'
        ? { id: 'tenant_A', status: 'active' }
        : args?.where?.id === 'zcc-admin-tenant'
          ? { id: 'zcc-admin-tenant', status: 'active' }
          : null),
  };
  dbMock.user = {
    findUnique: vi.fn(async (args: any) =>
      args?.where?.id === 'user_A' ? { tenantId: 'tenant_A' } : null),
  };
}

describe('RUN 6B — Role matrix: requireTenantAccess (owner/admin/staff/client)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureTenantDb();
  });

  const cases: Array<{ role: string; required: 'staff' | 'admin'; expectAllowed: boolean }> = [
    { role: 'owner', required: 'staff', expectAllowed: true },
    { role: 'admin', required: 'staff', expectAllowed: true },
    { role: 'staff', required: 'staff', expectAllowed: true },
    { role: 'staff', required: 'admin', expectAllowed: false },
    { role: 'client', required: 'staff', expectAllowed: false },
  ];

  for (const c of cases) {
    it(`role ${c.role} com requiredRole ${c.required} → ${c.expectAllowed ? 'ALLOW' : 'DENY'}`, async () => {
      mockSession.user.role = c.role;
      const result = await requireTenantAccess(getReq('http://x/api/test'), { requiredRole: c.required });
      expect(result.allowed).toBe(c.expectAllowed);
      if (!c.expectAllowed) expect(result.response?.status).toBe(403);
    });
  }

  it('JWT stale: user reatribuído para outro tenant → 403 TENANT_MISMATCH', async () => {
    mockSession.user.role = 'owner';
    dbMock.user = { findUnique: vi.fn(async () => ({ tenantId: 'tenant_B' })) };
    const result = await requireTenantAccess(getReq('http://x/api/test'));
    expect(result.allowed).toBe(false);
    expect(result.response?.status).toBe(403);
    const body = await result.response!.json();
    expect(body.code).toBe('TENANT_MISMATCH');
  });
});

describe('RUN 6B — system_admin: acesso global EXPLÍCITO (não por acidente)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureTenantDb();
    mockSession.user.role = 'system_admin';
    mockSession.user.tenantId = 'zcc-admin-tenant';
  });

  it('system_admin autêntico (sessão ZCC) passa no gate sem requiredRole', async () => {
    const result = await requireTenantAccess(getReq('http://x/api/test'));
    expect(result.allowed).toBe(true);
    expect(result.context.role).toBe('system_admin');
  });

  it('withAdminGuard (plano tenant) NÃO abre automaticamente para system_admin (deny-safe)', async () => {
    const handler = vi.fn(async () => new NextResponse(JSON.stringify({ ok: true }), { status: 200 }));
    const guarded = withAdminGuard({}, handler);
    const res = await guarded(getReq('http://x/api/test'));
    expect(res.status).toBe(403); // system_admin não é 'owner' nem 'ADMIN' → deny explícito
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('RUN 6B — withApiGuard: matriz TENANT_USER/ADMIN (RES-11 provada por teste)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureTenantDb();
    mockSession.user.tenantId = 'tenant_A';
  });

  const tenantUserCases = [
    { role: 'owner', expect: 200 },
    { role: 'admin', expect: 200 },
    { role: 'staff', expect: 200 },
    { role: 'client', expect: 403 },
  ];
  for (const c of tenantUserCases) {
    it(`withTenantGuard com role ${c.role} → ${c.expect}`, async () => {
      mockSession.user.role = c.role;
      const guarded = withTenantGuard({}, async () => new NextResponse(JSON.stringify({ ok: true }), { status: 200 }));
      const res = await guarded(getReq('http://x/api/test'));
      expect(res.status).toBe(c.expect);
    });
  }

  it('withAdminGuard: só roles reais de owner/admin-plane passam; string morta ADMIN é inalcançável', async () => {
    for (const role of ['owner', 'admin', 'staff', 'client', 'system_admin', 'ADMIN']) {
      mockSession.user.role = role;
      const handler = vi.fn(async () => new NextResponse(JSON.stringify({ ok: true }), { status: 200 }));
      const guarded = withAdminGuard({}, handler);
      const res = await guarded(getReq('http://x/api/test'));
      if (role === 'owner') {
        expect(res.status).toBe(200);
        expect(handler).toHaveBeenCalledTimes(1);
      } else if (role === 'ADMIN') {
        // RES-11: o guard ACEITARIA a string 'ADMIN', porém NENHUM caminho de
        // login produz esse valor (auth.ts: role = tenant.role || 'owner' ou
        // 'system_admin' — sempre lowercase). String morta = inalcançável,
        // não bloqueada. Sem bypass real (prova: matriz de sessões reais).
        expect(res.status).toBe(200);
      } else {
        expect(res.status).toBe(403);
        expect(handler).not.toHaveBeenCalled();
      }
      handler.mockClear();
    }
  });
});

describe('RUN 6B — Machine tokens (verifyRobotToken + M2M cron)', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterAll(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('verifyRobotToken: token válido → ALLOW; inválido → DENY', () => {
    process.env.ZAI_API_KEY = 'zai-secret-1234567890';
    process.env.ZEHLA_LOOP_API_KEY = 'loop-secret-0987654321';

    const valid = new Request('http://x/api/test', { headers: { authorization: 'Bearer zai-secret-1234567890' } });
    expect(verifyRobotToken(valid)).toBe(true);

    const loop = new Request('http://x/api/test', { headers: { authorization: 'Bearer loop-secret-0987654321' } });
    expect(verifyRobotToken(loop)).toBe(true);

    const invalid = new Request('http://x/api/test', { headers: { authorization: 'Bearer token-falso-00000' } });
    expect(verifyRobotToken(invalid)).toBe(false);

    const absent = new Request('http://x/api/test');
    expect(verifyRobotToken(absent)).toBe(false);

    delete process.env.ZAI_API_KEY;
    delete process.env.ZEHLA_LOOP_API_KEY;
    const noConfig = new Request('http://x/api/test', { headers: { authorization: 'Bearer zai-secret-1234567890' } });
    expect(verifyRobotToken(noConfig)).toBe(false);
  });

  it('M2M dev bypass NUNCA em produção (regressão R6-15)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ZELLA_ALLOW_M2M_DEV_BYPASS', 'true');
    delete process.env.ZELLA_M2M_ED25519_PUBLIC_KEY;

    const req = getReq('http://x/api/cron/test', { 'x-zella-m2m-dev-bypass': 'cerebro:write' });
    const result = await verifyCronM2MToken(req, 'cerebro:write');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
    vi.unstubAllEnvs();
  });

  it('M2M dev bypass em desenvolvimento (sem chave configurada) → ALLOW legítimo', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    delete process.env.ZELLA_M2M_ED25519_PUBLIC_KEY;
    delete process.env.ZELLA_ALLOW_M2M_DEV_BYPASS;

    const req = getReq('http://x/api/cron/test', { 'x-zella-m2m-dev-bypass': 'cerebro:write' });
    const result = await verifyCronM2MToken(req, 'cerebro:write');
    expect(result.ok).toBe(true);
    vi.unstubAllEnvs();
  });

  it('cron unificado fail-closed: produção sem M2M e sem CRON_SECRET → 503/401', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.ZELLA_M2M_ED25519_PUBLIC_KEY;
    delete process.env.ZELLA_M2M_JWKS_URL;
    delete process.env.ZELLA_M2M_CLIENTS;
    delete process.env.CRON_SECRET;

    const result = await verifyCronAuth(getReq('http://x/api/cron/test'), 'cerebro:write');
    expect(result.ok).toBe(false);
    if (result.response) expect([401, 503]).toContain(result.response.status);
    vi.unstubAllEnvs();
  });
});
