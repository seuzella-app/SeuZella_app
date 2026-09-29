/**
 * RBW Fases K+L — WhatsApp multi-tenant (credenciais por tenant) e estado REAL
 * de conexão. Simulação local — nenhuma chamada à Graph API da Meta.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const dbMock: Record<string, any> = {};
vi.mock('@/lib/db', () => ({
  db: new Proxy({}, {
    get(_t, prop: string) {
      if (!dbMock[prop]) dbMock[prop] = {};
      return dbMock[prop];
    },
  }),
}));

import { resolveTenantWhatsAppCredentials } from '@/lib/whatsapp/tenant-whatsapp-credentials';
import { resolveWhatsAppConnectionState, whatsappConnectedFromState } from '@/lib/whatsapp/connection-state';

const ENV_DEV = { WHATSAPP_ACCESS_TOKEN: 'tok', WHATSAPP_PHONE_NUMBER_ID: 'pn_global', NODE_ENV: 'test' };
const ENV_PROD_NO_TOKEN = { WHATSAPP_ACCESS_TOKEN: '', WHATSAPP_PHONE_NUMBER_ID: '', NODE_ENV: 'production' };

describe('RBW-K · resolveTenantWhatsAppCredentials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.metaConnection = { findFirst: vi.fn(async () => null) };
  });

  it('Tenant A → Phone A: conexão do próprio tenant é usada', async () => {
    dbMock.metaConnection.findFirst.mockImplementation(async (args: any) =>
      args.where.tenantId === 'tenant_A' ? { phoneNumberId: 'pn_A', verificationStatus: 'VERIFIED', connectionStatus: 'CONNECTED' } : null);
    const r = await resolveTenantWhatsAppCredentials('tenant_A', ENV_DEV);
    expect(r).toMatchObject({ mode: 'tenant', phoneNumberId: 'pn_A' });
  });

  it('Tenant B → Phone B: cada tenant resolve o SEU número', async () => {
    dbMock.metaConnection.findFirst.mockImplementation(async (args: any) =>
      ({ tenant_A: { phoneNumberId: 'pn_A', verificationStatus: 'VERIFIED', connectionStatus: 'CONNECTED' }, tenant_B: { phoneNumberId: 'pn_B', verificationStatus: 'VERIFIED', connectionStatus: 'CONNECTED' } } as any)[args.where.tenantId] ?? null);
    expect((await resolveTenantWhatsAppCredentials('tenant_A', ENV_DEV)).mode === 'tenant' && (await resolveTenantWhatsAppCredentials('tenant_A', ENV_DEV) as any).phoneNumberId).toBe('pn_A');
    expect((await resolveTenantWhatsAppCredentials('tenant_B', ENV_DEV)).mode === 'tenant' && (await resolveTenantWhatsAppCredentials('tenant_B', ENV_DEV) as any).phoneNumberId).toBe('pn_B');
  });

  it('Tenant A → Phone B = DENY por construção: resolver de A NUNCA devolve pn_B', async () => {
    dbMock.metaConnection.findFirst.mockImplementation(async (args: any) =>
      args.where.tenantId === 'tenant_B' ? { phoneNumberId: 'pn_B', verificationStatus: 'VERIFIED', connectionStatus: 'CONNECTED' } : null);
    const r = await resolveTenantWhatsAppCredentials('tenant_A', ENV_DEV);
    // A não tem conexão: dev/test cai no global (pn_global), JAMAIS em pn_B.
    expect(JSON.stringify(r)).not.toContain('pn_B');
  });

  it('PRODUÇÃO sem conexão do tenant → fail-closed tenant_not_connected_in_production', async () => {
    dbMock.metaConnection.findFirst.mockResolvedValue(null);
    const r = await resolveTenantWhatsAppCredentials('tenant_A', ENV_PROD_NO_TOKEN);
    expect(r).toMatchObject({ mode: 'none', reason: 'tenant_not_connected_in_production' });
  });

  it('PRODUÇÃO com conexão do tenant VERIFICADA → usa o número do tenant mesmo sem global', async () => {
    dbMock.metaConnection.findFirst.mockResolvedValue({ phoneNumberId: 'pn_A', verificationStatus: 'VERIFIED', connectionStatus: 'CONNECTED' });
    const r = await resolveTenantWhatsAppCredentials('tenant_A', { WHATSAPP_ACCESS_TOKEN: 'tok', NODE_ENV: 'production' });
    expect(r).toMatchObject({ mode: 'tenant', phoneNumberId: 'pn_A' });
  });
});

describe('RBW v2 · gate de estado REAL no outbound de produção (item 3.5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.metaConnection = { findFirst: vi.fn(async () => null) };
  });

  const PROD = { WHATSAPP_ACCESS_TOKEN: 'tok', WHATSAPP_PHONE_NUMBER_ID: 'pn_global', NODE_ENV: 'production' };

  it.each([
    ['UNVERIFIED', 'CONNECTING'],
    ['UNVERIFIED', 'ERROR'],
    ['UNVERIFIED', 'NOT_CONFIGURED'],
    ['PENDING_VERIFICATION', 'CONNECTING'],
  ])('conexão UNVERIFIED/PENDING (verification=%s, connection=%s) → fail-closed', async (verification, connection) => {
    dbMock.metaConnection.findFirst.mockResolvedValue({ phoneNumberId: 'pn_A', verificationStatus: verification, connectionStatus: connection, lastWebhookAt: null });
    const r = await resolveTenantWhatsAppCredentials('tenant_A', PROD);
    expect(r).toMatchObject({ mode: 'none', reason: 'tenant_connection_not_verified_in_production' });
    expect(JSON.stringify(r)).not.toContain('pn_A');
    expect(JSON.stringify(r)).not.toContain('pn_global');
  });

  it('conexão VERIFIED → permitido (número do tenant)', async () => {
    dbMock.metaConnection.findFirst.mockResolvedValue({ phoneNumberId: 'pn_A', verificationStatus: 'VERIFIED', connectionStatus: 'CONNECTED', lastWebhookAt: null });
    const r = await resolveTenantWhatsAppCredentials('tenant_A', PROD);
    expect(r).toMatchObject({ mode: 'tenant', phoneNumberId: 'pn_A' });
  });

  it('conexão HEALTHY (webhook recente) → permitido (número do tenant)', async () => {
    dbMock.metaConnection.findFirst.mockResolvedValue({ phoneNumberId: 'pn_A', verificationStatus: 'VERIFIED', connectionStatus: 'CONNECTED', lastWebhookAt: new Date().toISOString() });
    const r = await resolveTenantWhatsAppCredentials('tenant_A', PROD);
    expect(r).toMatchObject({ mode: 'tenant', phoneNumberId: 'pn_A' });
  });

  it('DEV/TEST com conexão não verificada → fallback de dev preservado (comportamento sandbox)', async () => {
    dbMock.metaConnection.findFirst.mockResolvedValue({ phoneNumberId: 'pn_A', verificationStatus: 'UNVERIFIED', connectionStatus: 'CONNECTING', lastWebhookAt: null });
    const r = await resolveTenantWhatsAppCredentials('tenant_A', ENV_DEV);
    // Dev mantém acesso ao número do tenant para sandbox (não é produção).
    expect(r).toMatchObject({ mode: 'tenant', phoneNumberId: 'pn_A' });
  });
});

describe('RBW-L · resolveWhatsAppConnectionState (estado REAL)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.metaConnection = { findFirst: vi.fn(async () => null) };
  });
  afterEach(() => vi.unstubAllEnvs());

  it('sem MetaConnection → NOT_CONFIGURED (nunca "conectado")', async () => {
    const r = await resolveWhatsAppConnectionState('tenant_A');
    expect(r.state).toBe('NOT_CONFIGURED');
    expect(r.source).toBe('none');
    expect(whatsappConnectedFromState(r.state)).toBe(false);
  });

  it('verificationStatus VERIFIED → VERIFIED (conectado de verdade)', async () => {
    dbMock.metaConnection.findFirst.mockResolvedValue({ phoneNumberId: 'pn_A', connectionStatus: 'CONNECTED', verificationStatus: 'VERIFIED', lastWebhookAt: null });
    const r = await resolveWhatsAppConnectionState('tenant_A');
    expect(r.state).toBe('VERIFIED');
    expect(whatsappConnectedFromState(r.state)).toBe(true);
    expect(r.source).toBe('meta_connection');
  });

  it('webhook recente + VERIFIED → HEALTHY', async () => {
    dbMock.metaConnection.findFirst.mockResolvedValue({ phoneNumberId: 'pn_A', connectionStatus: 'CONNECTED', verificationStatus: 'VERIFIED', lastWebhookAt: new Date().toISOString() });
    const r = await resolveWhatsAppConnectionState('tenant_A');
    expect(r.state).toBe('HEALTHY');
  });

  it('configurado sem verificação → PENDING_VERIFICATION + BLOCKED_EXTERNAL_DEPENDENCY', async () => {
    dbMock.metaConnection.findFirst.mockResolvedValue({ phoneNumberId: 'pn_A', connectionStatus: 'CONNECTING', verificationStatus: 'UNVERIFIED', lastWebhookAt: null });
    const r = await resolveWhatsAppConnectionState('tenant_A');
    expect(r.state).toBe('PENDING_VERIFICATION');
    expect(r.externalValidation).toBe('BLOCKED_EXTERNAL_DEPENDENCY');
    expect(whatsappConnectedFromState(r.state)).toBe(false);
  });

  it('status ERROR → ERROR (não conectado)', async () => {
    dbMock.metaConnection.findFirst.mockResolvedValue({ phoneNumberId: 'pn_A', connectionStatus: 'ERROR', verificationStatus: 'UNVERIFIED', lastWebhookAt: null });
    const r = await resolveWhatsAppConnectionState('tenant_A');
    expect(r.state).toBe('ERROR');
  });
});
