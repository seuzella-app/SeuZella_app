/**
 * RUN 6B — Isolamento LGPD A↔B (contexto brasileiro, Lei nº 13.709/2018).
 *
 * Prova comportamental dos controles técnicos de isolamento por tenant nos
 * fluxos de titulares (art. 18 LGPD): exclusão, consentimento, exportação,
 * DPO e FNRH. Evidência técnica de TENANT ISOLATION — não constitui, por si
 * só, declaração de "compliance LGPD" (ver RUN6B_AUDIT_REPORT §LGPD).
 *
 *  - delete A não afeta B (TENANT_MISMATCH 403 + serviço NUNCA chamado);
 *  - consent A não altera B;
 *  - DPO A não grava em B;
 *  - FNRH A não altera registro de B (service fail-closed escopado);
 *  - dados pessoais não vazam por resource ID (export escopado, coberto
 *    também em run6-tenant-isolation).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockSession = { user: { id: 'user_A', tenantId: 'tenant_A', role: 'owner' } };

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => mockSession),
  default: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
  requireTenant: vi.fn(async () => mockSession.user.tenantId),
  verifyRobotToken: vi.fn(async () => false),
}));

vi.mock('@/lib/security/api-guard', async () => {
  const actual = await vi.importActual<typeof import('@/lib/security/api-guard')>('@/lib/security/api-guard');
  return actual; // withApiGuard real — é parte da superfície testada
});

vi.mock('@/lib/security/rate-limit', () => ({
  enforceRateLimit: vi.fn(async () => ({ success: true })),
  buildIdentifier: vi.fn(async () => 'ip-test'),
}));

vi.mock('@/lib/rate-limit', () => ({
  apiRatelimit: { limit: vi.fn(async () => ({ success: true })) },
  authRatelimit: { limit: vi.fn(async () => ({ success: true })) },
  buildIdentifier: vi.fn(async () => 'ip-test'),
}));

const solicitarExclusaoDados = vi.fn(async (p: { tenantId: string }) => ({ id: 'req_1', ...p }));
const registrarConsentimento = vi.fn(async (p: { tenantId: string }) => ({ id: 'consent_1', ...p }));
vi.mock('@/lib/lgpd/lgpd-service', () => ({
  solicitarExclusaoDados: (p: { tenantId: string }) => solicitarExclusaoDados(p),
  registrarConsentimento: (p: { tenantId: string }) => registrarConsentimento(p),
  exportarDadosHospede: vi.fn(async () => ({ guest: null })),
  DPA_TEMPLATE: 'DPA-TEMPLATE-ESTATICO',
}));

const captureDpoPair = vi.fn(async (p: { tenantId: string }) => ({ saved: true, ...p }));
vi.mock('@/lib/ml/dpo-collector', () => ({
  captureDpoPair: (p: { tenantId: string }) => captureDpoPair(p),
}));

vi.mock('@/lib/semantica/client', () => ({
  SemanticaClient: {
    isEnabled: vi.fn(() => false),
    isConfigured: vi.fn(() => false),
    addNode: vi.fn(async () => ({ id: 'node_1' })),
    addEdge: vi.fn(async () => ({ ok: true })),
  },
  addSemanticMemory: vi.fn(async () => ({ ok: true })),
}));

// db mock para FNRH (guestRegistration) — escopo no serviço
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

// ── Rotas / serviços (import após mocks) ────────────────────────────────────

import { POST as deleteMyDataPOST } from '@/app/api/lgpd/delete-my-data/route';
import { POST as consentPOST } from '@/app/api/lgpd/consent/route';
import { POST as dpoCapturePOST } from '@/app/api/ddc/dpo-capture/route';
import { updateFNRHData } from '@/lib/fnrh/index';

const jsonReq = (url: string, body: unknown) =>
  new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });

describe('RUN 6B — LGPD: direito ao esquecimento A↔B (art. 18, VI)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user.tenantId = 'tenant_A';
  });

  it('DENY: sessão do tenant A com body.tenantId = B → 403 e pedido NUNCA registrado em B', async () => {
    const res = await deleteMyDataPOST(jsonReq('http://x/api/lgpd/delete-my-data', {
      tenantId: 'tenant_B', guestName: 'Hospede B', reason: 'teste',
    }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('TENANT_MISMATCH');
    expect(solicitarExclusaoDados).not.toHaveBeenCalled();
  });

  it('ALLOW: titular do próprio tenant A registra pedido (prazo art. 18)', async () => {
    const res = await deleteMyDataPOST(jsonReq('http://x/api/lgpd/delete-my-data', {
      tenantId: 'tenant_A', guestName: 'Hospede A',
    }));
    expect(res.status).toBe(200);
    expect(solicitarExclusaoDados).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant_A' }));
  });
});

describe('RUN 6B — LGPD: consentimento A↔B (art. 8º)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user.tenantId = 'tenant_A';
  });

  it('DENY: consent do tenant A NUNCA grava em B', async () => {
    const res = await consentPOST(jsonReq('http://x/api/lgpd/consent', {
      tenantId: 'tenant_B', guestPhone: '5548999990000', consentType: 'marketing', granted: true,
    }));
    expect(res.status).toBe(403);
    expect(registrarConsentimento).not.toHaveBeenCalled();
  });

  it('ALLOW: consent do próprio tenant A gravado', async () => {
    const res = await consentPOST(jsonReq('http://x/api/lgpd/consent', {
      tenantId: 'tenant_A', guestPhone: '5548999990000', consentType: 'whatsapp_contact', granted: true,
    }));
    expect(res.status).toBe(200);
    expect(registrarConsentimento).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant_A' }));
  });
});

describe('RUN 6B — LGPD: DPO capture A↔B (dados de treinamento)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user.tenantId = 'tenant_A';
  });

  it('DENY: pair de treinamento do tenant A NUNCA grava em B', async () => {
    const res = await dpoCapturePOST(jsonReq('http://x/api/ddc/dpo-capture', {
      tenantId: 'tenant_B', prompt: 'p', rejected: 'r', chosen: 'c',
    }));
    expect([401, 403]).toContain(res.status);
    expect(captureDpoPair).not.toHaveBeenCalled();
  });

  it('ALLOW: pair do próprio tenant A gravado com tenantId da sessão', async () => {
    const res = await dpoCapturePOST(jsonReq('http://x/api/ddc/dpo-capture', {
      tenantId: 'tenant_A', prompt: 'p', rejected: 'r', chosen: 'c',
    }));
    expect(res.status).toBe(200);
    expect(captureDpoPair).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant_A' }));
  });
});

describe('RUN 6B — LGPD/FNRH: updateFNRHData fail-closed escopado (dados de hóspede)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.guestRegistration = {
      findFirst: vi.fn(async (args: any) =>
        args?.where?.tenantId === 'tenant_A' && args?.where?.id === 'fnrh_of_A'
          ? { id: 'fnrh_of_A', tenantId: 'tenant_A', data: JSON.stringify({ fullName: 'Hospede A' }) }
          : null),
      update: vi.fn(async (args: any) => ({ id: args.where.id, data: args.data.data })),
    };
  });

  it('DENY: FNRH de B nunca é alterado por operação do tenant A (null + update NUNCA chamado)', async () => {
    const result = await updateFNRHData('fnrh_of_B', { fullName: 'Ataque' }, 'tenant_A');
    expect(result).toBeNull();
    expect(dbMock.guestRegistration.update).not.toHaveBeenCalled();
  });

  it('DENY: sem tenantId (caller interno sem autoridade) → null, fail-closed', async () => {
    const result = await updateFNRHData('fnrh_of_A', { fullName: 'X' }, '');
    expect(result).toBeNull();
    expect(dbMock.guestRegistration.findFirst).not.toHaveBeenCalled();
  });

  it('ALLOW: FNRH do próprio tenant A é atualizado', async () => {
    const result = await updateFNRHData('fnrh_of_A', { fullName: 'Hospede A Completo' }, 'tenant_A');
    expect(result).not.toBeNull();
    expect(dbMock.guestRegistration.update).toHaveBeenCalled();
  });
});
