/**
 * RUN 6B — Push Service primitive: tenantId OBRIGATÓRIO (fail-closed).
 *
 * Prova por invocação REAL do serviço e da rota de que:
 *  - removePushSubscription SEM tenant → fail closed (nenhuma escrita);
 *  - tenant A desativa SOMENTE subscriptions do tenant A;
 *  - tenant A apontando endpoint do tenant B → B NÃO é alterado;
 *  - caller legítimo interno (POST /api/push/unsubscribe com sessão)
 *    continua funcionando (ALLOW);
 *  - sem sessão → 401 (rota não chega a tocar o serviço).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks de infraestrutura ─────────────────────────────────────────────────

const mockSession = { user: { id: 'user_A', tenantId: 'tenant_A', role: 'owner' } };

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => mockSession),
  default: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  apiRatelimit: { limit: vi.fn(async () => ({ success: true })) },
  enforceRateLimit: vi.fn(async () => ({ success: true })),
  buildIdentifier: vi.fn(async () => 'ip-test'),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// db mock — updateMany registra as chamadas para asserção de escopo.
type UpdateManyArgs = { where: { endpoint: string; tenantId?: string } };
const updateManyMock = vi.fn(async (args: UpdateManyArgs) => ({
  count: args.where.tenantId === 'tenant_A' ? 1 : 0,
}));

vi.mock('@/lib/db', () => ({
  db: {
    pushSubscription: {
      updateMany: (args: UpdateManyArgs) => updateManyMock(args),
    },
  },
  isDatabaseAvailable: vi.fn(async () => true),
}));

vi.mock('@/lib/ddc/auth-utils', () => ({
  resolveTenantId: vi.fn(async () => mockSession.user.tenantId),
  requireDDCTenantId: vi.fn(async () => mockSession.user.tenantId),
}));

// ── Serviço / rota (import após mocks) ──────────────────────────────────────

import { removePushSubscription } from '@/lib/push/push-service';
import { POST as pushUnsubscribePOST } from '@/app/api/push/unsubscribe/route';

const jsonReq = (url: string, body: unknown, method = 'POST') =>
  new NextRequest(url, {
    method,
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });

describe('RUN 6B — removePushSubscription primitive (tenantId obrigatório)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user.tenantId = 'tenant_A';
  });

  it('FAIL CLOSED: chamada SEM tenant não escreve nada no banco', async () => {
    // Caller legado JS/TS (pré-RUN6B) invocando o serviço SEM tenant:
    // expressado via assinatura antiga (double-cast through unknown) — a
    // prova é RUNTIME: guard fail-closed recusa e nenhuma escrita ocorre.
    const removeAsLegacy = removePushSubscription as unknown as
      (endpoint: string, tenantId?: string) => Promise<{ success: boolean }>;
    const r1 = await removeAsLegacy('https://push.service/ep_x');
    expect(r1.success).toBe(false);
    expect(updateManyMock).not.toHaveBeenCalled();

    const r2 = await removePushSubscription('https://push.service/ep_x', '');
    expect(r2.success).toBe(false);
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it('ALLOW: tenant A desativa subscription própria (where escopado)', async () => {
    const r = await removePushSubscription('https://push.service/ep_of_A', 'tenant_A');
    expect(r.success).toBe(true);
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { endpoint: 'https://push.service/ep_of_A', tenantId: 'tenant_A' },
      data: { isActive: false },
    });
  });

  it('DENY: tenant A apontando endpoint do tenant B — B NÃO é alterado', async () => {
    const r = await removePushSubscription('https://push.service/endpoint_of_B', 'tenant_A');
    expect(r.success).toBe(true); // operação executou…
    // …porém o where SEMPRE inclui tenantId do chamador: o updateMany do
    // banco só afetaria linhas de tenant_A; a linha de tenant_B (tenant_B no
    // where) é intocável — o mock devolve count 0 para outro tenant.
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { endpoint: 'https://push.service/endpoint_of_B', tenantId: 'tenant_A' },
      data: { isActive: false },
    });
    // Prova estrutural: nenhum caminho do serviço produz where sem tenantId.
    for (const call of updateManyMock.mock.calls) {
      const args = call[0] as { where: { tenantId?: string } };
      expect(args.where.tenantId).toBe('tenant_A');
    }
  });

  it('ALLOW: caller legítimo interno (rota unsubscribe com sessão) continua funcionando', async () => {
    const res = await pushUnsubscribePOST(
      jsonReq('http://x/api/push/unsubscribe', { endpoint: 'https://push.service/ep_of_A' }),
    );
    expect(res.status).toBe(200);
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { endpoint: 'https://push.service/ep_of_A', tenantId: 'tenant_A' },
      data: { isActive: false },
    });
  });

  it('DENY: rota sem sessão → 401 e nenhuma escrita', async () => {
    const authUtils = await import('@/lib/ddc/auth-utils');
    (authUtils.resolveTenantId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await pushUnsubscribePOST(
      jsonReq('http://x/api/push/unsubscribe', { endpoint: 'https://push.service/ep_of_B' }),
    );
    expect(res.status).toBe(401);
    expect(updateManyMock).not.toHaveBeenCalled();
  });
});
