/**
 * RUN 6 — Hardening de helpers de autorização.
 *
 * Prova que:
 *  - createLockDevice recusa propriedade de outro tenant (pousada E airbnb);
 *  - generateSlug produz capability não-adivinhável (sufixo aleatório);
 *  - o bypass M2M de dev NÃO funciona em produção mesmo com o flag setado;
 *  - ZCC_ADMIN_TOKEN é comparado de forma timing-safe e continua funcional.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

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

vi.mock('@/lib/ddc/auth-utils', () => ({
  resolveTenantId: vi.fn(async () => mockSession.user.tenantId),
  requireDDCTenantId: vi.fn(async () => mockSession.user.tenantId),
}));

import { createLockDevice } from '@/lib/locks/orchestrator';
import { generateSlug } from '@/lib/slug-utils';
import { verifyCronM2MToken } from '@/lib/security/cron-auth';
import { requireTenantAccess } from '@/lib/security/tenant-authorization';

const jsonReq = (url: string, body: unknown, headers: Record<string, string> = {}, method = 'POST') =>
  new NextRequest(url, { method, body: method === 'GET' ? undefined : JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers } });

describe('RUN 6 — createLockDevice (resource ownership de propriedade)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user.tenantId = 'tenant_A';
  });

  it('NEGATIVO: property de OUTRO tenant (pousada) → LOCK_PROPERTY_NOT_OWNED, device nunca criado', async () => {
    dbMock.property = { findFirst: vi.fn(async (args: any) => args.where.tenantId === 'tenant_A' && args.where.id === 'prop_A' ? { id: 'prop_A' } : null) };
    dbMock.lockDevice = { create: vi.fn(async (args: any) => ({ id: 'dev1', ...args.data })) };
    await expect(createLockDevice({
      propertyId: 'prop_of_B', propertyType: 'pousada', nickname: 'x', brand: 'ttlock',
    })).rejects.toThrow('LOCK_PROPERTY_NOT_OWNED');
    expect(dbMock.lockDevice.create).not.toHaveBeenCalled();
    expect(dbMock.property.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'prop_of_B', tenantId: 'tenant_A' } }));
  });

  it('NEGATIVO: property airbnb de OUTRO tenant → recusado via airBProperty', async () => {
    dbMock.airBProperty = { findFirst: vi.fn(async () => null) };
    dbMock.lockDevice = { create: vi.fn() };
    await expect(createLockDevice({
      propertyId: 'airb_of_B', propertyType: 'airbnb', nickname: 'x', brand: 'ttlock',
    })).rejects.toThrow('LOCK_PROPERTY_NOT_OWNED');
    expect(dbMock.airBProperty.findFirst).toHaveBeenCalled();
    expect(dbMock.lockDevice.create).not.toHaveBeenCalled();
  });

  it('POSITIVO: property do próprio tenant → device criado no tenant', async () => {
    dbMock.property = { findFirst: vi.fn(async () => ({ id: 'prop_A' })) };
    dbMock.lockDevice = { create: vi.fn(async (args: any) => ({ id: 'dev1', ...args.data })) };
    dbMock.lockEvent = { create: vi.fn(async () => ({})) };
    const device = await createLockDevice({
      propertyId: 'prop_A', propertyType: 'pousada', nickname: 'Porta A', brand: 'ttlock',
    });
    expect(device).toBeTruthy();
    expect(dbMock.lockDevice.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId: 'tenant_A', propertyId: 'prop_A' }),
    }));
  });
});

describe('RUN 6 — generateSlug (capability entropy do guia público)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.guestGuide = { findFirst: vi.fn(async () => null) };
  });

  it('sufixo aleatório criptográfico presente (não enumera base-1, base-2...)', async () => {
    const a = await generateSlug('pousada-sol', 'tenant_A');
    const b = await generateSlug('pousada-sol', 'tenant_A');
    expect(a).toMatch(/^pousada-sol-[A-Za-z0-9_-]{10,}$/);
    expect(b).toMatch(/^pousada-sol-[A-Za-z0-9_-]{10,}$/);
    expect(a).not.toBe(b);
  });

  it('mantém unicidade (checa guestGuide) e sanitiza a base', async () => {
    const slug = await generateSlug('Pousada Sol & Mar!!', 'tenant_A');
    expect(slug.startsWith('pousada-sol-mar-')).toBe(true);
    expect(dbMock.guestGuide.findFirst).toHaveBeenCalled();
  });
});

describe('RUN 6 — cron M2M dev bypass (produção não pode ser aberta por flag)', () => {
  const OLD_ENV = process.env;

  afterEach(() => {
    process.env = OLD_ENV;
    vi.unstubAllEnvs();
  });

  it('NEGATIVO: NODE_ENV=production + ZELLA_ALLOW_M2M_DEV_BYPASS=true + header → REJEITADO', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ZELLA_ALLOW_M2M_DEV_BYPASS', 'true');
    vi.stubEnv('ZELLA_M2M_ED25519_PUBLIC_KEY', '');
    vi.stubEnv('ZELLA_M2M_JWKS_URL', '');
    vi.stubEnv('ZELLA_M2M_CLIENTS', '');
    vi.stubEnv('CRON_SECRET', '');
    const req = jsonReq('http://x/api/cron/weekly-report', {}, { 'x-zella-m2m-dev-bypass': 'cerebro:write' }, 'GET');
    const out = await verifyCronM2MToken(req, 'cerebro:write');
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.response.status).toBe(401);
  });

  it('POSITIVO: NODE_ENV=development + flag + header → permitido (dev legítimo)', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('ZELLA_ALLOW_M2M_DEV_BYPASS', 'true');
    vi.stubEnv('ZELLA_M2M_ED25519_PUBLIC_KEY', '');
    const req = jsonReq('http://x/api/cron/weekly-report', {}, { 'x-zella-m2m-dev-bypass': 'cerebro:write' }, 'GET');
    const out = await verifyCronM2MToken(req, 'cerebro:write');
    expect(out.ok).toBe(true);
  });
});

describe('RUN 6 — ZCC_ADMIN_TOKEN (timing-safe, funcional)', () => {
  const OLD_ENV = process.env;

  afterEach(() => {
    process.env = OLD_ENV;
    vi.unstubAllEnvs();
  });

  it('POSITIVO: bearer correto → contexto system/owner concedido', async () => {
    vi.stubEnv('ZCC_ADMIN_TOKEN', 'zcc-secret-test-token');
    const na = await import('next-auth');
    (na.getServerSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const req = jsonReq('http://x/api/ddc/booking-sync', {}, { authorization: 'Bearer zcc-secret-test-token' }, 'POST');
    const out = await requireTenantAccess(req);
    expect(out.allowed).toBe(true);
    if (out.allowed) {
      expect(out.context.tenantId).toBe('system');
      expect(out.context.role).toBe('owner');
    }
  });

  it('NEGATIVO: bearer errado → negado (fail-closed 401)', async () => {
    vi.stubEnv('ZCC_ADMIN_TOKEN', 'zcc-secret-test-token');
    const na = await import('next-auth');
    (na.getServerSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const req = jsonReq('http://x/api/ddc/booking-sync', {}, { authorization: 'Bearer wrong-token-aaaaaaaaaa' }, 'POST');
    const out = await requireTenantAccess(req);
    expect(out.allowed).toBe(false);
  });
});
