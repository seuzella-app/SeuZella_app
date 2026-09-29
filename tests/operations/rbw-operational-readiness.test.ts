/**
 * RBW Fase O — PropertyOperationalReadiness: autoridade de operação REAL.
 * Simulação local com banco mockado.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const dbMock: Record<string, any> = {};
vi.mock('@/lib/db', () => ({
  db: new Proxy({}, {
    get(_t, prop: string) {
      if (!dbMock[prop]) dbMock[prop] = {};
      return dbMock[prop];
    },
  }),
}));

import { evaluatePropertyOperationalReadiness } from '@/lib/operations/operational-readiness';

const completeProperty = {
  name: 'Pousada Zélla',
  metadata: JSON.stringify({ checkInTime: '14:00', checkOutTime: '12:00', aiTone: 'descontraida' }),
  pixKey: 'pix@zella.com',
  rooms: [{ name: 'Suíte 1', price: 350 }, { name: 'Suíte 2', price: 420 }],
};

describe('RBW-O · evaluatePropertyOperationalReadiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.metaConnection = { findFirst: vi.fn(async () => null) };
  });

  it('complete → OPERATIONAL_READY (com WhatsApp verificado)', async () => {
    dbMock.property = { findFirst: vi.fn(async () => completeProperty) };
    dbMock.metaConnection.findFirst.mockResolvedValue({ phoneNumberId: 'pn_A', connectionStatus: 'CONNECTED', verificationStatus: 'VERIFIED', lastWebhookAt: new Date().toISOString() });
    const r = await evaluatePropertyOperationalReadiness('tenant_A');
    expect(r.ready).toBe(true);
    expect(r.state).toBe('OPERATIONAL_READY');
    expect(r.checks.every(c => c.ok)).toBe(true);
  });

  it('incomplete: sem quartos → INCOMPLETE com ROOMS_VALID falso', async () => {
    dbMock.property = { findFirst: vi.fn(async () => ({ ...completeProperty, rooms: [] })) };
    dbMock.metaConnection.findFirst.mockResolvedValue({ phoneNumberId: 'pn_A', verificationStatus: 'VERIFIED', connectionStatus: 'CONNECTED' });
    const r = await evaluatePropertyOperationalReadiness('tenant_A');
    expect(r.state).toBe('INCOMPLETE');
    expect(r.checks.find(c => c.id === 'ROOMS_VALID')?.ok).toBe(false);
  });

  it('WhatsApp unverified → INCOMPLETE + BLOCKED_EXTERNAL_DEPENDENCY', async () => {
    dbMock.property = { findFirst: vi.fn(async () => completeProperty) };
    dbMock.metaConnection.findFirst.mockResolvedValue({ phoneNumberId: 'pn_A', connectionStatus: 'CONNECTING', verificationStatus: 'UNVERIFIED' });
    const r = await evaluatePropertyOperationalReadiness('tenant_A');
    const wa = r.checks.find(c => c.id === 'WHATSAPP_VERIFIED');
    expect(wa?.ok).toBe(false);
    expect(wa?.externalDependency).toBe('BLOCKED_EXTERNAL_DEPENDENCY');
    expect(r.ready).toBe(false);
  });

  it('payment unavailable: sem pixKey → INCOMPLETE (PAYMENT_READY falso)', async () => {
    dbMock.property = { findFirst: vi.fn(async () => ({ ...completeProperty, pixKey: '' })) };
    dbMock.metaConnection.findFirst.mockResolvedValue({ phoneNumberId: 'pn_A', verificationStatus: 'VERIFIED', connectionStatus: 'CONNECTED' });
    const r = await evaluatePropertyOperationalReadiness('tenant_A');
    expect(r.checks.find(c => c.id === 'PAYMENT_READY')?.ok).toBe(false);
    expect(r.ready).toBe(false);
  });

  it('sem propriedade → INCOMPLETE (PROPERTY_VALID falso), sem exceção', async () => {
    dbMock.property = { findFirst: vi.fn(async () => null) };
    const r = await evaluatePropertyOperationalReadiness('tenant_A');
    expect(r.state).toBe('INCOMPLETE');
    expect(r.checks[0].id).toBe('PROPERTY_VALID');
  });

  it('isolamento: eval de tenant_A nunca lê propriedade de tenant_B', async () => {
    dbMock.property = { findFirst: vi.fn(async (args: any) => args.where.tenantId === 'tenant_A' ? completeProperty : null) };
    const r = await evaluatePropertyOperationalReadiness('tenant_B');
    expect(r.state).toBe('INCOMPLETE');
  });
});
