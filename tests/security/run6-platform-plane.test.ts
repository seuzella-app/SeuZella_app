/**
 * RUN 6 — Platform Plane: endpoints de infra global e plano ZCC.
 *
 * Prova que:
 *  - escrita em estado GLOBAL (circuit breaker, budget guard, programa
 *    parceiro, decisões ZGS) exige autoridade (machine token / ZCC admin);
 *  - usuário de tenant comum NUNCA executa operações globais;
 *  - DPO/Semantica aceita apenas o tenant da sessão;
 *  - chamadores autorizados continuam operando (ALLOW).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
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

const reopenSecondBatch = vi.fn(async (_p?: unknown) => ({ status: 'REOPENED' }));
vi.mock('@/lib/partner-program/partner-service', () => ({
  PartnerProgramService: { reopenSecondBatch: (p?: unknown) => reopenSecondBatch(p) },
}));

const updateDecisionStatus = vi.fn(async () => true);
vi.mock('@/domain/strategy', () => ({
  ZellaGrowthStrategy: class {
    getDecisions() { return []; }
    snapshot() { return {}; }
    updateDecisionStatus = updateDecisionStatus;
  },
}));

vi.mock('@/adapters', () => ({
  getAdapters: vi.fn(() => ({})),
}));

const captureDpoPair = vi.fn(async (p: { tenantId: string }) => ({ saved: true, similarityScore: 0.5, ...p }));
vi.mock('@/lib/ml/dpo-collector', () => ({
  captureDpoPair: (p: { tenantId: string }) => captureDpoPair(p),
}));

vi.mock('@/lib/semantica/client', () => ({
  SemanticaClient: {
    isEnabled: vi.fn(() => false),
    isConfigured: vi.fn(() => false),
    addNode: vi.fn(),
    addEdge: vi.fn(),
  },
}));

vi.mock('@/lib/cerebro/log-sink', () => ({
  logSink: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/security/api-guard', () => ({
  withApiGuard: vi.fn(),
}));

// ── Rotas (import após mocks) ───────────────────────────────────────────────

import { POST as routerProvidersPOST } from '@/app/api/router/providers/route';
import { POST as routerBudgetPOST } from '@/app/api/router/budget/route';
import { POST as reopenPOST } from '@/app/api/zcc/partner-program/reopen/route';
import { PATCH as zgsDecisionsPATCH } from '@/app/api/zcc/zgs/decisions/route';
import { POST as dpoCapturePOST } from '@/app/api/ddc/dpo-capture/route';

const jsonReq = (url: string, body: unknown, method = 'POST') =>
  new NextRequest(url, { method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

describe('RUN 6 — router/providers POST (circuit breaker global)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    zccAllowed.mockResolvedValue(false);
    dbMock.routerProvider = {
      findUnique: vi.fn(async () => ({ id: 'p1', alpha: 0, beta: 0, successCount: 0, failureCount: 0, avgLatencyMs: 100, circuitStatus: 'closed', lastFailureAt: null })),
      update: vi.fn(async (args: any) => ({ id: args.where.id, alpha: 0, beta: 1, successCount: 0, failureCount: 1, avgLatencyMs: 100, circuitStatus: 'open', lastFailureAt: null, createdAt: new Date(), updatedAt: new Date() })),
    };
  });

  it('NEGATIVO: sem autoridade → 404 stealth e provider.update NUNCA chamado', async () => {
    const res = await routerProvidersPOST(jsonReq('http://x/api/router/providers', { providerId: 'p1', success: false, latencyMs: 10 }));
    expect(res.status).toBe(404);
    expect(dbMock.routerProvider.update).not.toHaveBeenCalled();
  });

  it('POSITIVO: machine token (loop interno) → feedback aceito', async () => {
    const auth = await import('@/lib/auth');
    (auth.verifyRobotToken as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);
    const res = await routerProvidersPOST(jsonReq('http://x/api/router/providers', { providerId: 'p1', success: false, latencyMs: 10 }));
    expect(res.status).toBe(200);
    expect(dbMock.routerProvider.update).toHaveBeenCalled();
  });

  it('POSITIVO: admin ZCC → feedback aceito', async () => {
    zccAllowed.mockResolvedValue(true);
    const res = await routerProvidersPOST(jsonReq('http://x/api/router/providers', { providerId: 'p1', success: false, latencyMs: 10 }));
    expect(res.status).toBe(200);
    expect(dbMock.routerProvider.update).toHaveBeenCalled();
  });
});

describe('RUN 6 — router/budget POST (budget guard global)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    zccAllowed.mockResolvedValue(false);
    dbMock.budgetGuardState = {
      findUnique: vi.fn(async () => ({ date: '2026-09-18', dailySpendUsd: 0, dailyBudgetUsd: 50, monthlySpendUsd: 0, monthlyBudgetUsd: 1500, criticalLevel: 'nominal' })),
      create: vi.fn(),
      update: vi.fn(async (args: any) => ({ ...args.data, date: args.where.date, createdAt: new Date(), updatedAt: new Date() })),
    };
  });

  it('NEGATIVO: sem autoridade → custo NUNCA acumulado', async () => {
    const res = await routerBudgetPOST(jsonReq('http://x/api/router/budget', { costUsd: 9999 }));
    expect(res.status).toBe(404);
    expect(dbMock.budgetGuardState.update).not.toHaveBeenCalled();
  });

  it('POSITIVO: machine token → custo acumulado', async () => {
    const auth = await import('@/lib/auth');
    (auth.verifyRobotToken as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);
    const res = await routerBudgetPOST(jsonReq('http://x/api/router/budget', { costUsd: 5 }));
    expect(res.status).toBe(200);
    expect(dbMock.budgetGuardState.update).toHaveBeenCalled();
  });
});

describe('RUN 6 — zcc/partner-program/reopen (check morto → gate ZCC)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    zccAllowed.mockResolvedValue(false);
  });

  it('NEGATIVO: usuário de tenant comum → reabertura GLOBAL negada', async () => {
    const res = await reopenPOST(jsonReq('http://x/api/zcc/partner-program/reopen', {}));
    expect(res.status).toBe(404);
    expect(reopenSecondBatch).not.toHaveBeenCalled();
  });

  it('POSITIVO: admin ZCC → reabertura executada', async () => {
    zccAllowed.mockResolvedValue(true);
    const res = await reopenPOST(jsonReq('http://x/api/zcc/partner-program/reopen', {}));
    expect(res.status).toBe(200);
    expect(reopenSecondBatch).toHaveBeenCalledTimes(1);
  });
});

describe('RUN 6 — zcc/zgs/decisions PATCH (decisões estratégicas)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    zccAllowed.mockResolvedValue(false);
  });

  it('NEGATIVO: sem gate ZCC → status de decisão NUNCA alterado', async () => {
    const res = await zgsDecisionsPATCH(jsonReq('http://x/api/zcc/zgs/decisions', { decisionId: 'd1', status: 'approved' }, 'PATCH'));
    expect(res.status).toBe(404);
    expect(updateDecisionStatus).not.toHaveBeenCalled();
  });

  it('POSITIVO: admin ZCC → decisão alterada', async () => {
    zccAllowed.mockResolvedValue(true);
    const res = await zgsDecisionsPATCH(jsonReq('http://x/api/zcc/zgs/decisions', { decisionId: 'd1', status: 'approved' }, 'PATCH'));
    expect(res.status).toBe(200);
    expect(updateDecisionStatus).toHaveBeenCalledWith('d1', 'approved');
  });
});

describe('RUN 6 — ddc/dpo-capture POST (envenenamento anônimo fechado)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user.tenantId = 'tenant_A';
    captureDpoPair.mockClear();
  });

  it('NEGATIVO: sem sessão → 401 e nenhum par DPO gravado', async () => {
    const na = await import('next-auth');
    (na.getServerSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await dpoCapturePOST(jsonReq('http://x/api/ddc/dpo-capture', { tenantId: 'tenant_A', prompt: 'p', rejected: 'r', chosen: 'c' }));
    expect(res.status).toBe(401);
    expect(captureDpoPair).not.toHaveBeenCalled();
  });

  it('NEGATIVO: body tenantId=tenant_B com sessão tenant_A → 403 e nenhum write', async () => {
    const res = await dpoCapturePOST(jsonReq('http://x/api/ddc/dpo-capture', { tenantId: 'tenant_B', prompt: 'p', rejected: 'r', chosen: 'c' }));
    expect(res.status).toBe(403);
    expect(captureDpoPair).not.toHaveBeenCalled();
  });

  it('POSITIVO: sessão tenant_A + tenantId consistente → gravado em tenant_A', async () => {
    const res = await dpoCapturePOST(jsonReq('http://x/api/ddc/dpo-capture', { tenantId: 'tenant_A', prompt: 'p', rejected: 'r', chosen: 'c' }));
    expect(res.status).toBe(200);
    expect(captureDpoPair).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant_A' }));
  });
});
