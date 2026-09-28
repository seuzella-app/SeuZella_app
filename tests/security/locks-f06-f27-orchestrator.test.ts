/**
 * F06 + F27 CSPRNG — Orchestrator de Fechaduras (Segurança Física)
 * ============================================================================
 * F06: revokeReservationPins NUNCA assume tenant 'default' silenciosamente.
 *      tenantId/reservationId explícitos são OBRIGATÓRIOS (fail-closed).
 * F27: generateReservationPin usa CSPRNG (crypto.randomInt) — 6 dígitos,
 *      100000 <= PIN <= 999999, sem Math.random.
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { generateReservationPin, revokeReservationPins } from '@/lib/locks/orchestrator';

const ORCHESTRATOR_SRC = readFileSync(join(__dirname, '..', '..', 'src', 'lib', 'locks', 'orchestrator.ts'), 'utf-8');

describe('F27 CSPRNG — generateReservationPin', () => {
  it('SAST: orchestrator.ts NÃO contém Math.random (regressão F27)', () => {
    expect(ORCHESTRATOR_SRC).not.toContain('Math.random');
    expect(ORCHESTRATOR_SRC).toContain('randomInt');
  });

  it('PIN tem exatamente 6 dígitos em [100000, 999999] (200 amostras)', async () => {
    for (let i = 0; i < 200; i++) {
      const result = await generateReservationPin({
        tenantId: 'tenant_f27_test',
        reservationId: `res_${i}`,
        checkIn: new Date(),
        checkOut: new Date(Date.now() + 86400000),
      });
      expect(result.success).toBe(true);
      expect(result.status).toBe('ACCESS_CONFIRMED');
      expect(result.passcode).toMatch(/^\d{6}$/);
      const numeric = Number(result.passcode);
      expect(numeric).toBeGreaterThanOrEqual(100000);
      expect(numeric).toBeLessThanOrEqual(999999);
    }
  });

  it('PINs consecutivos não são todos iguais (não-determinismo básico)', async () => {
    const pins = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const r = await generateReservationPin({
        tenantId: 'tenant_f27_test',
        reservationId: `res_${i}`,
        checkIn: new Date(),
        checkOut: new Date(),
      });
      pins.add(r.passcode);
    }
    // Espaço de 900k valores: 20 amostras idênticas é prática impossível sob CSPRNG.
    expect(pins.size).toBeGreaterThan(1);
  });
});

describe('F06 — revokeReservationPins sem fallback de tenant', () => {
  it('SAST: não existe mais fallback tenantId = "default"', () => {
    expect(ORCHESTRATOR_SRC).not.toContain("tenantId = 'default'");
    expect(ORCHESTRATOR_SRC).not.toContain("tenantIdOrParams || 'default'");
    expect(ORCHESTRATOR_SRC).toContain('TENANT_ID_REQUIRED');
  });

  it('object form SEM tenantId → throw TENANT_ID_REQUIRED (fail-closed)', async () => {
    await expect(
      revokeReservationPins({ reservationId: 'res_sem_tenant', reason: 'teste F06' } as never),
    ).rejects.toThrow('TENANT_ID_REQUIRED');
  });

  it('object form com tenantId vazio → throw TENANT_ID_REQUIRED', async () => {
    await expect(
      revokeReservationPins({ tenantId: '', reservationId: 'res_x', reason: 'teste F06' }),
    ).rejects.toThrow('TENANT_ID_REQUIRED');
  });

  it('string form vazia → throw TENANT_ID_REQUIRED', async () => {
    await expect(revokeReservationPins('', 'res_x')).rejects.toThrow('TENANT_ID_REQUIRED');
  });

  it('sem reservationId (string form) → throw TENANT_ID_REQUIRED', async () => {
    await expect(
      revokeReservationPins('tenant_f06_test', undefined),
    ).rejects.toThrow('TENANT_ID_REQUIRED');
  });

  it('tenantId explícito → operação segue contrato (ACCESS_REVOKED)', async () => {
    // Com DB indisponível o contrato devolve sucesso com 0 revogações;
    // com DB disponível executa query escopada por tenant. Ambos os caminhos
    // preservam o contrato — o que NÃO pode acontecer é fallback p/ 'default'.
    const result = await revokeReservationPins({
      tenantId: 'tenant_f06_explicito',
      reservationId: 'res_f06_123',
      reason: 'Cancelamento de teste F06',
    });
    expect(result.success).toBe(true);
    expect(result.status).toBe('ACCESS_REVOKED');
    expect(typeof result.revokedCount).toBe('number');
  });
});
