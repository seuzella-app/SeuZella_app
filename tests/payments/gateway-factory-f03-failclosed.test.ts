/**
 * F03 — Gateway Factory Fail-Closed (Mock proibido em produção)
 * ============================================================================
 * Contrato:
 *   1. Produção + getGateway('mock')                    → throw MOCK_GATEWAY_FORBIDDEN
 *   2. Produção + sem gateway real + getDefaultGateway() → throw NOT_CONFIGURED (fail-closed)
 *   3. Produção + asaas configurado                     → getDefaultGateway() = asaas
 *   4. Dev/test + sem gateway real                      → getDefaultGateway() = mock (compat)
 *   5. Dev/test + getGateway('mock')                    → funciona (compat gateway-scope)
 *   6. getGatewayHealth() NUNCA lança (health reporta, não derruba)
 *   7. Downstream MOCK_GATEWAY_FORBIDDEN em reservation-payment-service preservado
 * ============================================================================
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const FACTORY_PATH = join(__dirname, '..', '..', 'src', 'lib', 'payments', 'gateway-factory.ts');
const RPS_SRC = readFileSync(join(__dirname, '..', '..', 'src', 'lib', 'payments', 'reservation-payment-service.ts'), 'utf-8');

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
// tsc marca NODE_ENV como read-only; alias tipado permite manipulação em testes.
const testEnv = process.env as Record<string, string | undefined>;

async function loadFactory(env: { NODE_ENV: string; ASAAS_ACCESS_TOKEN?: string; MP_ACCESS_TOKEN?: string; DEFAULT_PAYMENT_GATEWAY?: string }) {
  vi.resetModules();
  testEnv.NODE_ENV = env.NODE_ENV;
  if (env.ASAAS_ACCESS_TOKEN) process.env.ASAAS_ACCESS_TOKEN = env.ASAAS_ACCESS_TOKEN; else delete process.env.ASAAS_ACCESS_TOKEN;
  if (env.MP_ACCESS_TOKEN) process.env.MP_ACCESS_TOKEN = env.MP_ACCESS_TOKEN; else delete process.env.MP_ACCESS_TOKEN;
  if (env.DEFAULT_PAYMENT_GATEWAY) process.env.DEFAULT_PAYMENT_GATEWAY = env.DEFAULT_PAYMENT_GATEWAY; else delete process.env.DEFAULT_PAYMENT_GATEWAY;
  const mod = await import('@/lib/payments/gateway-factory');
  return mod as typeof import('@/lib/payments/gateway-factory');
}

describe('F03 — gateway-factory fail-closed em produção', () => {
  afterEach(() => {
    testEnv.NODE_ENV = ORIGINAL_NODE_ENV;
    delete process.env.ASAAS_ACCESS_TOKEN;
    delete process.env.MP_ACCESS_TOKEN;
    delete process.env.DEFAULT_PAYMENT_GATEWAY;
    vi.restoreAllMocks();
  });

  it('1. produção + getGateway("mock") → PaymentGatewayError MOCK_GATEWAY_FORBIDDEN', async () => {
    const factory = await loadFactory({ NODE_ENV: 'production' });
    try {
      factory.getGateway('mock');
      expect.unreachable('getGateway("mock") deveria lançar em produção');
    } catch (error) {
      expect((error as Error).name).toBe('PaymentGatewayError');
      expect((error as { code?: string }).code).toBe('MOCK_GATEWAY_FORBIDDEN');
      expect((error as Error).message).toContain('MOCK_GATEWAY_FORBIDDEN');
    }
  });

  it('2. produção sem gateway real + getDefaultGateway() → fail-closed NOT_CONFIGURED', async () => {
    const factory = await loadFactory({ NODE_ENV: 'production' });
    expect(() => factory.getDefaultGateway()).toThrowError(/PAYMENT_GATEWAY_NOT_CONFIGURED/);
    try {
      factory.getDefaultGateway();
    } catch (error) {
      expect((error as { code?: string }).code).toBe('NOT_CONFIGURED');
      expect((error as { statusCode?: number }).statusCode).toBe(503);
    }
  });

  it('3. produção com asaas configurado → default = asaas (não lança)', async () => {
    const factory = await loadFactory({ NODE_ENV: 'production', ASAAS_ACCESS_TOKEN: 'prod-asaas-token-f03' });
    const gateway = factory.getDefaultGateway();
    expect(gateway.id).toBe('asaas');
  });

  it('4. dev/test sem gateway real → default = mock (compatibilidade)', async () => {
    const factory = await loadFactory({ NODE_ENV: 'test' });
    const gateway = factory.getDefaultGateway();
    expect(gateway.id).toBe('mock');
  });

  it('5. dev/test + getGateway("mock") → funciona (compat gateway-scope)', async () => {
    const factory = await loadFactory({ NODE_ENV: 'test' });
    expect(factory.getGateway('mock').id).toBe('mock');
  });

  it('6. produção + DEFAULT_PAYMENT_GATEWAY=mercadopago sem token → fail-closed (não cai para mock)', async () => {
    const factory = await loadFactory({ NODE_ENV: 'production', DEFAULT_PAYMENT_GATEWAY: 'mercadopago' });
    expect(() => factory.getDefaultGateway()).toThrowError(/PAYMENT_GATEWAY_NOT_CONFIGURED/);
  });

  it('6b. produção + getGatewayHealth() NUNCA lança e nunca marca mock como default sem gateway real', async () => {
    const factory = await loadFactory({ NODE_ENV: 'production' });
    const health = factory.getGatewayHealth();
    expect(health.mock.isDefault).toBe(false);
    expect(health.asaas.configured).toBe(false);
    expect(health.mercadopago.configured).toBe(false);
  });

  it('7. SAST: reservation-payment-service mantém MOCK_GATEWAY_FORBIDDEN (defesa em profundidade)', () => {
    expect(RPS_SRC).toContain("MOCK_GATEWAY_FORBIDDEN");
  });
});
