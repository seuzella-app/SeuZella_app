/**
 * RUN 4 — WAVE 4A: Testes adversariais do Checkout Security Engine.
 *
 * Contrato P0: segredo exclusivamente de configuração segura (fail-closed),
 * sem fallback hardcoded, anti-replay bidirecional, comparação timing-safe,
 * nenhum leak de segredo em erros.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  generateCheckoutSignature,
  verifyCheckoutSignature,
} from '@/lib/checkout/checkout-security';

const SECRET_A = 'checkout-secret-a-0123456789abcdef0123456789abcdef'; // ≥32
const SECRET_WEAK = 'curta';
const VALID_TS = Date.now();

describe('WAVE 4A — checkout-security fail-closed', () => {
  const ORIGINAL_NEXTAUTH = process.env.NEXTAUTH_SECRET;
  const ORIGINAL_PAYMENT = process.env.PAYMENT_WEBHOOK_SECRET;

  beforeEach(() => {
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.PAYMENT_WEBHOOK_SECRET;
  });

  afterEach(() => {
    if (ORIGINAL_NEXTAUTH === undefined) delete process.env.NEXTAUTH_SECRET; else process.env.NEXTAUTH_SECRET = ORIGINAL_NEXTAUTH;
    if (ORIGINAL_PAYMENT === undefined) delete process.env.PAYMENT_WEBHOOK_SECRET; else process.env.PAYMENT_WEBHOOK_SECRET = ORIGINAL_PAYMENT;
  });

  // ── Configuração de segredo ────────────────────────────────────────────

  it('1. secret ausente → generate falha (fail-closed) e verify retorna false', () => {
    expect(() => generateCheckoutSignature('sub_1', 'tenant_1', VALID_TS)).toThrow();
    const sig = 'a'.repeat(64);
    expect(verifyCheckoutSignature('sub_1', 'tenant_1', VALID_TS, sig)).toBe(false);
  });

  it('2. secret vazio → fail-closed (generate falha, verify false)', () => {
    process.env.NEXTAUTH_SECRET = '';
    expect(() => generateCheckoutSignature('sub_1', 'tenant_1', VALID_TS)).toThrow();
    expect(verifyCheckoutSignature('sub_1', 'tenant_1', VALID_TS, 'a'.repeat(64))).toBe(false);
  });

  it('3. secret curto (<32) → fail-closed (generate falha, verify false)', () => {
    process.env.NEXTAUTH_SECRET = SECRET_WEAK;
    expect(() => generateCheckoutSignature('sub_1', 'tenant_1', VALID_TS)).toThrow(/at least 32/);
    expect(verifyCheckoutSignature('sub_1', 'tenant_1', VALID_TS, 'a'.repeat(64))).toBe(false);
  });

  it('3b. secret curto apenas no fallback PAYMENT_WEBHOOK_SECRET → fail-closed', () => {
    process.env.PAYMENT_WEBHOOK_SECRET = SECRET_WEAK;
    expect(() => generateCheckoutSignature('sub_1', 'tenant_1', VALID_TS)).toThrow(/PAYMENT_WEBHOOK_SECRET/);
  });

  it('3c. sem NEXTAUTH_SECRET, PAYMENT_WEBHOOK_SECRET válido é aceito (precedência preservada)', () => {
    process.env.PAYMENT_WEBHOOK_SECRET = SECRET_A;
    const sig = generateCheckoutSignature('sub_1', 'tenant_1', VALID_TS);
    expect(sig).toHaveLength(64);
    expect(verifyCheckoutSignature('sub_1', 'tenant_1', VALID_TS, sig)).toBe(true);
  });

  it('3d. erro de configuração não vaza valor de segredo (apenas nome da env)', () => {
    const leaked = 'nao-vaze-este-valor-secreto-xyz';
    process.env.PAYMENT_WEBHOOK_SECRET = 'x'; // curto, força erro
    try {
      generateCheckoutSignature('sub_1', 'tenant_1', VALID_TS);
      throw new Error('deveria ter falhado');
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain('PAYMENT_WEBHOOK_SECRET');
      expect(msg).not.toContain(leaked);
      expect(msg).not.toContain('zella-checkout-fallback-secret-2026');
    }
  });

  // ── Assinaturas ────────────────────────────────────────────────────────

  const withSecret = (fn: () => void): void => {
    process.env.NEXTAUTH_SECRET = SECRET_A;
    fn();
  };

  it('4. assinatura inválida → false', () => {
    withSecret(() => {
      const sig = generateCheckoutSignature('sub_1', 'tenant_1', VALID_TS);
      const bad = sig.slice(0, 62) + (sig.endsWith('a') ? 'b' : 'a') + 'x'.slice(0, 0);
      expect(verifyCheckoutSignature('sub_1', 'tenant_1', VALID_TS, bad.slice(0, 64))).toBe(false);
      expect(verifyCheckoutSignature('sub_1', 'tenant_1', VALID_TS, 'z'.repeat(64))).toBe(false);
    });
  });

  it('5. assinatura correta → true (round-trip)', () => {
    withSecret(() => {
      const sig = generateCheckoutSignature('sub_9', 'tenant_9', VALID_TS);
      expect(verifyCheckoutSignature('sub_9', 'tenant_9', VALID_TS, sig)).toBe(true);
    });
  });

  it('6. timestamp expirado (>30min no passado) → false', () => {
    withSecret(() => {
      const old = Date.now() - 1_800_001;
      const sig = generateCheckoutSignature('sub_1', 'tenant_1', old);
      expect(verifyCheckoutSignature('sub_1', 'tenant_1', old, sig)).toBe(false);
    });
  });

  it('7. timestamp futuro (fora da tolerância) → false', () => {
    withSecret(() => {
      const future = Date.now() + 7_200_001;
      const sig = generateCheckoutSignature('sub_1', 'tenant_1', future);
      expect(verifyCheckoutSignature('sub_1', 'tenant_1', future, sig)).toBe(false);
    });
  });

  it('7b. timestamp dentro da janela futura (clock skew pequeno) → aceito', () => {
    withSecret(() => {
      const skew = Date.now() + 5_000;
      const sig = generateCheckoutSignature('sub_1', 'tenant_1', skew);
      expect(verifyCheckoutSignature('sub_1', 'tenant_1', skew, sig)).toBe(true);
    });
  });

  it('8. assinatura com tamanho incompatível (truncada/estendida) → false, sem throw', () => {
    withSecret(() => {
      const sig = generateCheckoutSignature('sub_1', 'tenant_1', VALID_TS);
      expect(verifyCheckoutSignature('sub_1', 'tenant_1', VALID_TS, sig.slice(0, 32))).toBe(false);
      expect(verifyCheckoutSignature('sub_1', 'tenant_1', VALID_TS, sig + 'deadbeef')).toBe(false);
      expect(verifyCheckoutSignature('sub_1', 'tenant_1', VALID_TS, '')).toBe(false);
    });
  });

  it('8b. assinatura não-hex → false', () => {
    withSecret(() => {
      expect(verifyCheckoutSignature('sub_1', 'tenant_1', VALID_TS, 'g'.repeat(64))).toBe(false);
    });
  });

  it('9. timestamp inválido (NaN, negativo, 0, float) → false', () => {
    withSecret(() => {
      const sig = generateCheckoutSignature('sub_1', 'tenant_1', VALID_TS);
      expect(verifyCheckoutSignature('sub_1', 'tenant_1', Number.NaN, sig)).toBe(false);
      expect(verifyCheckoutSignature('sub_1', 'tenant_1', -1, sig)).toBe(false);
      expect(verifyCheckoutSignature('sub_1', 'tenant_1', 0, sig)).toBe(false);
      expect(verifyCheckoutSignature('sub_1', 'tenant_1', VALID_TS + 0.5, sig)).toBe(false);
      expect(verifyCheckoutSignature('sub_1', 'tenant_1', Number.POSITIVE_INFINITY, sig)).toBe(false);
    });
  });

  it('10. payload alterado (replay/troca de parâmetros) → false', () => {
    withSecret(() => {
      const sig = generateCheckoutSignature('sub_1', 'tenant_1', VALID_TS);
      expect(verifyCheckoutSignature('sub_2', 'tenant_1', VALID_TS, sig)).toBe(false);
      expect(verifyCheckoutSignature('sub_1', 'tenant_2', VALID_TS, sig)).toBe(false);
    });
  });

  it('10b. segredo diferente → false (assinatura de outro contexto não valida)', () => {
    withSecret(() => {
      const sig = generateCheckoutSignature('sub_1', 'tenant_1', VALID_TS);
      process.env.NEXTAUTH_SECRET = 'outro-segredo-valido-0123456789abcdef012345';
      expect(verifyCheckoutSignature('sub_1', 'tenant_1', VALID_TS, sig)).toBe(false);
    });
  });

  it('11. nenhum fallback hardcoded permanece no módulo (fonte auditada)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/lib/checkout/checkout-security.ts'),
      'utf8'
    );
    expect(src).not.toContain('zella-checkout-fallback-secret-2026');
    expect(src).not.toMatch(/\|\|\s*['"][^'"]{16,}['"]/); // sem fallback literal de segredo
  });
});
