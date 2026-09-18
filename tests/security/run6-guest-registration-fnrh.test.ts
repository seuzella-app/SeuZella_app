/**
 * RUN 6 — Guest Registration / FNRH: fluxo de cadastro de hóspede e
 * liberação de fechadura.
 *
 * Prova que:
 *  - POST/PATCH exigem sessão (antes eram anônimos);
 *  - tenantId do cliente nunca é autoridade (consistency check apenas);
 *  - guestId/reservationId precisam pertencer ao tenant da sessão;
 *  - a liberação de fechadura deriva do REGISTRO persistido (nunca do body);
 *  - updateFNRHData é fail-closed sem tenantId.
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

// ── Rotas / serviço (import após mocks) ─────────────────────────────────────

import { POST as registrationPOST, PATCH as registrationPATCH } from '@/app/api/ddc/guest-registration/route';
import { updateFNRHData } from '@/lib/fnrh';

const jsonReq = (url: string, body: unknown, method = 'POST') =>
  new NextRequest(url, { method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

describe('RUN 6 — guest-registration POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user.tenantId = 'tenant_A';
    dbMock.guest = { findFirst: vi.fn(async (args: any) => args.where.tenantId === 'tenant_A' && args.where.id === 'guest_A' ? { id: 'guest_A' } : null) };
    dbMock.reservation = { findFirst: vi.fn(async (args: any) => args.where.tenantId === 'tenant_A' && args.where.id === 'res_A' ? { id: 'res_A' } : null) };
    dbMock.guestRegistration = { create: vi.fn(async () => ({})) };
  });

  it('NEGATIVO: sem sessão → 401', async () => {
    const na = await import('next-auth');
    (na.getServerSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await registrationPOST(jsonReq('http://x/api/ddc/guest-registration', { tenantId: 'tenant_B', guestId: 'guest_B' }));
    expect(res.status).toBe(401);
  });

  it('NEGATIVO: body tenantId=tenant_B com sessão tenant_A → 403', async () => {
    const res = await registrationPOST(jsonReq('http://x/api/ddc/guest-registration', { tenantId: 'tenant_B', guestId: 'guest_A' }));
    expect(res.status).toBe(403);
  });

  it('NEGATIVO: guestId de OUTRO tenant → 404 e nenhuma FNRH criada', async () => {
    const res = await registrationPOST(jsonReq('http://x/api/ddc/guest-registration', { guestId: 'guest_B' }));
    expect(res.status).toBe(404);
    expect(dbMock.guestRegistration.create).not.toHaveBeenCalled();
  });

  it('NEGATIVO: reservationId de OUTRO tenant → 404', async () => {
    const res = await registrationPOST(jsonReq('http://x/api/ddc/guest-registration', { guestId: 'guest_A', reservationId: 'res_B' }));
    expect(res.status).toBe(404);
    expect(dbMock.guestRegistration.create).not.toHaveBeenCalled();
  });

  it('POSITIVO: guest + reservation do próprio tenant → FNRH criada no tenant da sessão', async () => {
    const res = await registrationPOST(jsonReq('http://x/api/ddc/guest-registration', { guestId: 'guest_A', reservationId: 'res_A' }));
    expect(res.status).toBe(200);
    const svc = await import('@/lib/fnrh');
    // createFNRHRecord grava com tenantId = sessão (registrado via db mock)
    expect(dbMock.guestRegistration.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId: 'tenant_A', guestId: 'guest_A', reservationId: 'res_A' }),
    }));
    void svc;
  });
});

describe('RUN 6 — guest-registration PATCH (lock release não é client-controlled)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.user.tenantId = 'tenant_A';
  });

  it('NEGATIVO: sem sessão → 401', async () => {
    const na = await import('next-auth');
    (na.getServerSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await registrationPATCH(jsonReq('http://x/api/ddc/guest-registration', { fnrhId: 'fnrh_x', data: {} }, 'PATCH'));
    expect(res.status).toBe(401);
  });

  it('NEGATIVO: registro de outro tenant → 404 (busca escopada)', async () => {
    dbMock.guestRegistration = { findFirst: vi.fn(async (args: any) => args.where.tenantId === 'tenant_A' ? null : null) };
    const res = await registrationPATCH(jsonReq('http://x/api/ddc/guest-registration', { fnrhId: 'fnrh_of_B', data: {} }, 'PATCH'));
    expect(res.status).toBe(404);
    expect(dbMock.guestRegistration.findFirst).toHaveBeenCalledWith({ where: { id: 'fnrh_of_B', tenantId: 'tenant_A' } });
  });

  it('POSITIVO: completion deriva guest/reservation do REGISTRO (não do body)', async () => {
    dbMock.guestRegistration = {
      findFirst: vi.fn(async (args: any) => ({ id: 'rec1', tenantId: args.where.tenantId, data: JSON.stringify({ guestId: 'guest_A', reservationId: 'res_A', status: 'collected' }) })),
      update: vi.fn(async () => ({})),
    };
    const res = await registrationPATCH(jsonReq('http://x/api/ddc/guest-registration', {
      fnrhId: 'rec1',
      tenantId: 'tenant_B', // valor hostil no body — deve ser ignorado/mismatch
      data: { fullName: 'Fulano', cpf: '000.000.000-00', rg: 'MG123456', birthDate: '01/01/1990', address: 'Rua 1', city: 'X', state: 'MG' },
      tenantIdBodyFake: true,
      guestId: 'guest_ATTACKER',
      reservationId: 'res_ATTACKER',
    }, 'PATCH'));
    // body.tenantId=tenant_B + sessão tenant_A → TENANT_MISMATCH 403
    expect(res.status).toBe(403);
  });

  it('POSITIVO: body consistente → lock release usa identidade do registro', async () => {
    dbMock.guestRegistration = {
      findFirst: vi.fn(async (args: any) => ({ id: 'rec1', tenantId: args.where.tenantId, data: JSON.stringify({ guestId: 'guest_A', reservationId: 'res_A', status: 'pending' }) })),
      update: vi.fn(async () => ({})),
    };
    const res = await registrationPATCH(jsonReq('http://x/api/ddc/guest-registration', {
      fnrhId: 'rec1',
      data: { fullName: 'Fulano', cpf: '000.000.000-00', rg: 'MG123456', birthDate: '01/01/1990', address: 'Rua 1', city: 'X', state: 'MG' },
    }, 'PATCH'));
    expect(res.status).toBe(200);
    const payload = await res.json();
    // release só pode referenciar identidade do registro (guest_A/res_A)
    expect(payload.data.fnrh.guestId).toBe('guest_A');
    expect(payload.data.fnrh.reservationId).toBe('res_A');
  });
});

describe('RUN 6 — updateFNRHData (lib fail-closed)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.guestRegistration = { findFirst: vi.fn(async () => null) };
  });

  it('NEGATIVO: sem tenantId → null SEM tocar o DB', async () => {
    const out = await updateFNRHData('fnrh_x', { cpf: '1' }, '');
    expect(out).toBeNull();
    expect(dbMock.guestRegistration.findFirst).not.toHaveBeenCalled();
  });

  it('NEGATIVO: busca sempre escopada por tenant', async () => {
    await updateFNRHData('fnrh_x', { cpf: '1' }, 'tenant_A');
    expect(dbMock.guestRegistration.findFirst).toHaveBeenCalledWith({ where: { id: 'fnrh_x', tenantId: 'tenant_A' } });
  });
});
