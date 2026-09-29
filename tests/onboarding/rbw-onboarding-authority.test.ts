/**
 * RBW Fases A+B — onboarding NÃO é autoridade comercial + isolamento de tenant.
 * Simulação local com db e sessão mockados (padrão run6).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockSession: { user: { id?: string; email?: string; tenantId?: string } | null } = { user: null };

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => (mockSession.user ? { user: mockSession.user } : null)),
  default: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ authOptions: {} }));

const dbMock: Record<string, any> = {};
vi.mock('@/lib/db', () => ({
  db: new Proxy({}, {
    get(_t, prop: string) {
      if (!dbMock[prop]) dbMock[prop] = {};
      return dbMock[prop];
    },
  }),
}));

import { GET, POST } from '@/app/api/onboarding/route';

const jsonReq = (url: string, body: unknown, method = 'POST') =>
  new NextRequest(url, { method, body: method === 'GET' ? undefined : JSON.stringify(body), headers: { 'content-type': 'application/json' } });

const BODY = { mode: 'pousada', planSlug: 'max', name: 'Pousada Teste', email: 'owner@test.com' };

describe('RBW-A · POST /api/onboarding — plano do cliente NÃO é autoridade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user = null;
  });

  it('usuário autenticado (pós-Google-signup): tenant nasce GRATUITO mesmo com planSlug=max', async () => {
    dbMock.user = { findUnique: vi.fn(async () => ({ id: 'user_1', email: 'owner@test.com' })) };
    dbMock.tenant = {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async (args: any) => ({ id: 't_new', ...args.data })),
    };
    mockSession.user = { id: 'user_1', email: 'owner@test.com' };

    const res = await POST(jsonReq('http://localhost/api/onboarding', BODY));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tenant.planSlug).toBe('gratuito');
    expect(dbMock.tenant.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ plan: 'gratuito' }) }));
  });

  it('conta anônima nova em PRODUÇÃO → 403 fail-closed (não minta tenant pago)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    try {
      dbMock.user = { findUnique: vi.fn(async () => null) };
      const res = await POST(jsonReq('http://localhost/api/onboarding', BODY));
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('ONBOARDING_AUTH_REQUIRED');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('conta anônima nova em DEV → 201 com plano FORÇADO gratuito (compat de dev)', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    try {
      dbMock.user = {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async (args: any) => ({ id: 'user_new', tenant: { id: 't_dev', name: BODY.name, niche: BODY.mode, plan: 'gratuito' } })),
      };
      const res = await POST(jsonReq('http://localhost/api/onboarding', BODY));
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.tenant.planSlug).toBe('gratuito');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('usuário que já tem tenant → 409 ONBOARDING_ALREADY_COMPLETED', async () => {
    dbMock.user = { findUnique: vi.fn(async () => ({ id: 'user_2', email: 'owner@test.com' })) };
    dbMock.tenant = { findFirst: vi.fn(async () => ({ id: 't_existing' })) };
    const res = await POST(jsonReq('http://localhost/api/onboarding', BODY));
    expect(res.status).toBe(409);
  });

  it('usuário existente sem sessão compatível → 403 USER_EXISTS_AUTH_REQUIRED (RUN6 mantido)', async () => {
    dbMock.user = { findUnique: vi.fn(async () => ({ id: 'user_3', email: 'owner@test.com' })) };
    dbMock.tenant = { findFirst: vi.fn(async () => null) };
    const res = await POST(jsonReq('http://localhost/api/onboarding', BODY));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('USER_EXISTS_AUTH_REQUIRED');
  });
});

describe('RBW-B · GET /api/onboarding — isolamento session-bound', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('A → A = PASS: sessão do tenant A resolve somente o tenant A', async () => {
    mockSession.user = { tenantId: 'tenant_A' };
    dbMock.tenant = {
      findUnique: vi.fn(async (args: any) => args.where.id === 'tenant_A' ? { id: 'tenant_A', status: 'active', niche: 'pousada', plan: 'parceiro', name: 'A' } : null),
    };
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.name).toBe('A');
  });

  it('A → B = DENY: query param tenantId=B é IGNORADO (resolução é da sessão)', async () => {
    mockSession.user = { tenantId: 'tenant_A' };
    dbMock.tenant = {
      findUnique: vi.fn(async (args: any) => args.where.id === 'tenant_A' ? { id: 'tenant_A', status: 'active', niche: 'pousada', plan: 'parceiro', name: 'A' } : null),
    };
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.name).toBe('A');
    expect(dbMock.tenant.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'tenant_A' } }));
  });

  it('B → A = DENY: sessão do tenant B nunca lê dados do tenant A', async () => {
    mockSession.user = { tenantId: 'tenant_B' };
    dbMock.tenant = {
      findUnique: vi.fn(async (args: any) => args.where.id === 'tenant_B' ? { id: 'tenant_B', status: 'active', niche: 'airbnb', plan: 'gratuito', name: 'B' } : null),
    };
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.name).toBe('B');
  });

  it('sem sessão → 401 UNAUTHORIZED (nada de findFirst global de tenant ativo)', async () => {
    mockSession.user = null;
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('tenant inativo na sessão → 404 (sem dados)', async () => {
    mockSession.user = { tenantId: 'tenant_A' };
    dbMock.tenant = { findUnique: vi.fn(async () => ({ id: 'tenant_A', status: 'suspended' })) };
    const res = await GET();
    expect(res.status).toBe(404);
  });
});
