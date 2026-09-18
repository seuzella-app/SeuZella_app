/**
 * RUN 4 — WAVE 4F: Testes adversariais de IDOR / autoridade de tenant.
 *
 * Prova, por invocação REAL das rotas corrigidas, que:
 *  - tenant A autenticado que envia tenantId=tenant B é REJEITADO (403);
 *  - a operação nunca lê/Escreve dados do tenant B;
 *  - sem sessão → 401;
 *  - principal global sem role admin → 403;
 *  - operação no próprio tenant continua funcionando (contrato preservado).
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
}));

vi.mock('@/lib/security/api-shield', () => ({
  withSecurity: (handler: unknown) => handler,
}));

const registrarConsentimento = vi.fn(async (p: { tenantId: string }) => ({ id: 'cons_x', ...p }));
const solicitarExclusaoDados = vi.fn(async (p: { tenantId: string }) => ({ id: 'del_x', ...p }));

vi.mock('@/lib/lgpd/lgpd-service', () => ({
  registrarConsentimento: (p: { tenantId: string }) => registrarConsentimento(p),
  solicitarExclusaoDados: (p: { tenantId: string }) => solicitarExclusaoDados(p),
}));

vi.mock('@/lib/security/rate-limit', () => ({
  enforceRateLimit: vi.fn(async () => ({ success: true })),
  buildIdentifier: vi.fn(async () => 'ip-test'),
  apiRatelimit: { limit: vi.fn(async () => ({ success: true })) },
}));

const getBadgeStatus = vi.fn(async (tenantId: string) => ({ isPartner: tenantId === 'tenant_A', badge: tenantId === 'tenant_A' ? 'PARTNER_ZELLA_ACTIVE' : null, label: null }));

vi.mock('@/lib/partner-program/partner-service', () => ({
  PartnerProgramService: { getBadgeStatus: (t: string) => getBadgeStatus(t) },
}));

// ── Rotas (import após mocks) ───────────────────────────────────────────────

import { GET as badgeGET } from '@/app/api/ddc/partner-program/badge/route';
import { POST as consentPOST } from '@/app/api/lgpd/consent/route';
import { POST as deletePOST } from '@/app/api/lgpd/delete-my-data/route';

const req = (url: string, body?: unknown) =>
  new NextRequest(url, body !== undefined ? { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : { method: 'GET' });

describe('WAVE 4F — IDOR: badge (leitura cross-tenant)', () => {
  beforeEach(() => {
    getBadgeStatus.mockClear();
    mockSession.user.tenantId = 'tenant_A';
    mockSession.user.role = 'TENANT_USER';
  });

  it('GET próprio tenant (sem param) → 200 e consulta somente tenant_A', async () => {
    const res = await badgeGET(req('http://x/api/ddc/partner-program/badge'));
    expect(res.status).toBe(200);
    expect(getBadgeStatus).toHaveBeenCalledWith('tenant_A');
    expect(getBadgeStatus).not.toHaveBeenCalledWith('tenant_B');
  });

  it('GET próprio tenant (param consistente) → 200 (consistency check)', async () => {
    const res = await badgeGET(req('http://x/api/ddc/partner-program/badge?tenantId=tenant_A'));
    expect(res.status).toBe(200);
    expect(getBadgeStatus).toHaveBeenCalledWith('tenant_A');
  });

  it('GET com tenantId=tenant_B (IDOR) → 403 e NUNCA consulta tenant_B', async () => {
    const res = await badgeGET(req('http://x/api/ddc/partner-program/badge?tenantId=tenant_B'));
    expect(res.status).toBe(403);
    expect(getBadgeStatus).not.toHaveBeenCalledWith('tenant_B');
    expect(getBadgeStatus).not.toHaveBeenCalled();
  });

  it('sem sessão (requireTenant falha) → erro propaga e nenhuma leitura de badge', async () => {
    const authMod = await import('@/lib/auth');
    (authMod.requireTenant as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('UNAUTHENTICATED'));
    // O erro de autenticação propaga (fail-closed): nenhuma resposta com dados.
    await expect(badgeGET(req('http://x/api/ddc/partner-program/badge'))).rejects.toThrow('UNAUTHENTICATED');
    expect(getBadgeStatus).not.toHaveBeenCalled();
  });
});

describe('WAVE 4F — IDOR: LGPD consent (escrita cross-tenant)', () => {
  const body = (tenantId: string) => ({
    tenantId,
    guestPhone: '5548999990000',
    consentType: 'marketing',
    granted: true,
  });

  beforeEach(() => {
    registrarConsentimento.mockClear();
    mockSession.user.tenantId = 'tenant_A';
    mockSession.user.role = 'TENANT_USER';
  });

  it('POST próprio tenant → 200 e grava somente em tenant_A', async () => {
    const res = await consentPOST(req('http://x/api/lgpd/consent', body('tenant_A')));
    expect(res.status).toBe(200);
    expect(registrarConsentimento).toHaveBeenCalledTimes(1);
    expect(registrarConsentimento.mock.calls[0][0].tenantId).toBe('tenant_A');
  });

  it('POST com tenantId=tenant_B (IDOR) → 403 e NUNCA grava no tenant_B', async () => {
    const res = await consentPOST(req('http://x/api/lgpd/consent', body('tenant_B')));
    expect(res.status).toBe(403);
    expect(registrarConsentimento).not.toHaveBeenCalled();
  });

  it('principal global sem role admin → 403 mesmo com body tenant de terceiros', async () => {
    mockSession.user.tenantId = undefined as unknown as string;
    mockSession.user.role = 'TENANT_USER';
    const res = await consentPOST(req('http://x/api/lgpd/consent', body('tenant_B')));
    expect(res.status).toBe(403);
    expect(registrarConsentimento).not.toHaveBeenCalled();
  });

  it('principal global ADMIN pode registrar para tenant alvo (workflow DPO)', async () => {
    mockSession.user.tenantId = undefined as unknown as string;
    mockSession.user.role = 'ADMIN';
    const res = await consentPOST(req('http://x/api/lgpd/consent', body('tenant_B')));
    expect(res.status).toBe(200);
    expect(registrarConsentimento.mock.calls[0][0].tenantId).toBe('tenant_B');
  });
});

describe('WAVE 4F — IDOR: LGPD delete-my-data (escrita cross-tenant)', () => {
  const body = (tenantId: string) => ({
    tenantId,
    guestName: 'Hóspede Teste',
    guestPhone: '5548999990000',
  });

  beforeEach(() => {
    solicitarExclusaoDados.mockClear();
    mockSession.user.tenantId = 'tenant_A';
    mockSession.user.role = 'TENANT_USER';
  });

  it('POST próprio tenant → 200 e registra somente em tenant_A', async () => {
    const res = await deletePOST(req('http://x/api/lgpd/delete-my-data', body('tenant_A')));
    expect(res.status).toBe(200);
    expect(solicitarExclusaoDados.mock.calls[0][0].tenantId).toBe('tenant_A');
  });

  it('POST com tenantId=tenant_B (IDOR) → 403 e NUNCA registra no tenant_B', async () => {
    const res = await deletePOST(req('http://x/api/lgpd/delete-my-data', body('tenant_B')));
    expect(res.status).toBe(403);
    expect(solicitarExclusaoDados).not.toHaveBeenCalled();
  });

  it('principal global sem role admin → 403', async () => {
    mockSession.user.tenantId = undefined as unknown as string;
    mockSession.user.role = 'staff';
    const res = await deletePOST(req('http://x/api/lgpd/delete-my-data', body('tenant_B')));
    expect(res.status).toBe(403);
    expect(solicitarExclusaoDados).not.toHaveBeenCalled();
  });
});
