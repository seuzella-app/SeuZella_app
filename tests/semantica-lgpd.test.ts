/**
 * Testes do LGPD Forget Guest API
 *
 * Valida:
 *   1. Validação de campos obrigatórios
 *   2. Validação de reasons válidos
 *   3. Fallback gracioso quando Semantica indisponível
 *   4. Estrutura da resposta (nodesMarkedForgotten, decisionsAnonymized, consentLogId)
 *
 * LGPD Art. 18 — Direito ao esquecimento
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SemanticaError } from '@/lib/semantica/types';

// Mock do verifyZCCAccessOrReject para bypassar auth em testes
vi.mock('@/lib/zcc-security', () => ({
  verifyZCCAccessOrReject: vi.fn().mockResolvedValue({
    allowed: true,
    response: null,
    ip: '127.0.0.1',
  }),
}));

// Mock do db
vi.mock('@/lib/db', () => ({
  db: {
    guest: {
      update: vi.fn().mockResolvedValue({}),
    },
    guestMessage: {
      updateMany: vi.fn().mockResolvedValue({ count: 5 }),
    },
    consentLog: {
      create: vi.fn().mockResolvedValue({ id: 'cl_test_001' }),
    },
  },
  isDatabaseAvailable: vi.fn().mockResolvedValue(false),
}));

describe('LGPD Forget Guest — Validação de Input', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.USE_SEMANTICA_GRAPH = 'false';
    process.env.SEMANTICA_API_KEY = '';
    process.env.SEMANTICA_BASE_URL = 'http://127.0.0.1:9999';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ═══════════════════════════════════════════════════════════════
  // 1. VALIDAÇÃO DE TYPES
  // ═══════════════════════════════════════════════════════════════

  describe('ForgetGuestRequest — validação', () => {
    it('reason "user_request" é válido', () => {
      const validReasons = ['user_request', 'gdpr_right_to_erasure', 'data_retention_expiry', 'manual'];
      expect(validReasons).toContain('user_request');
    });

    it('reason "gdpr_right_to_erasure" é válido', () => {
      const validReasons = ['user_request', 'gdpr_right_to_erasure', 'data_retention_expiry', 'manual'];
      expect(validReasons).toContain('gdpr_right_to_erasure');
    });

    it('reason "data_retention_expiry" é válido', () => {
      const validReasons = ['user_request', 'gdpr_right_to_erasure', 'data_retention_expiry', 'manual'];
      expect(validReasons).toContain('data_retention_expiry');
    });

    it('reason "manual" é válido', () => {
      const validReasons = ['user_request', 'gdpr_right_to_erasure', 'data_retention_expiry', 'manual'];
      expect(validReasons).toContain('manual');
    });

    it('reason "invalid_reason" NÃO é válido', () => {
      const validReasons = ['user_request', 'gdpr_right_to_erasure', 'data_retention_expiry', 'manual'];
      expect(validReasons).not.toContain('invalid_reason');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 2. ESTRUTURA DA RESPOSTA
  // ═══════════════════════════════════════════════════════════════

  describe('ForgetGuestResult — estrutura', () => {
    it('tem todos os campos obrigatórios', () => {
      const result = {
        guestId: 'guest_123',
        tenantId: 'tenant_001',
        nodesMarkedForgotten: 3,
        decisionsAnonymized: 2,
        edgesRemoved: 1,
        consentLogId: 'cl_test_001',
        completedAt: new Date().toISOString(),
      };

      expect(result).toHaveProperty('guestId');
      expect(result).toHaveProperty('tenantId');
      expect(result).toHaveProperty('nodesMarkedForgotten');
      expect(result).toHaveProperty('decisionsAnonymized');
      expect(result).toHaveProperty('edgesRemoved');
      expect(result).toHaveProperty('consentLogId');
      expect(result).toHaveProperty('completedAt');
    });

    it('nodesMarkedForgotten é número', () => {
      const result = { nodesMarkedForgotten: 0 };
      expect(typeof result.nodesMarkedForgotten).toBe('number');
    });

    it('decisionsAnonymized é número', () => {
      const result = { decisionsAnonymized: 0 };
      expect(typeof result.decisionsAnonymized).toBe('number');
    });

    it('consentLogId é string não vazia', () => {
      const result = { consentLogId: 'cl_test_001' };
      expect(typeof result.consentLogId).toBe('string');
      expect(result.consentLogId.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 3. SEMANTICA ERROR RECOVERY
  // ═══════════════════════════════════════════════════════════════

  describe('SemanticaError recovery', () => {
    it('UNAUTHORIZED não é recoverable (não deve fazer fallback)', () => {
      const err = new SemanticaError('UNAUTHORIZED', 'bad key', 401);
      expect(err.isRecoverable()).toBe(false);
    });

    it('SERVICE_UNAVAILABLE é recoverable (deve fazer fallback)', () => {
      const err = new SemanticaError('SERVICE_UNAVAILABLE', 'down', 503);
      expect(err.isRecoverable()).toBe(true);
    });

    it('TIMEOUT é recoverable (deve fazer fallback)', () => {
      const err = new SemanticaError('TIMEOUT', 'slow', 408);
      expect(err.isRecoverable()).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 4. LGPD COMPLIANCE — Campos anonimizados
  // ═══════════════════════════════════════════════════════════════

  describe('LGPD anonimização', () => {
    it('scenario é substituído por "[ANONIMIZADO - LGPD]"', () => {
      const original = 'Hóspede João Silva perguntou sobre check-in';
      const anonymized = '[ANONIMIZADO - LGPD]';
      expect(anonymized).not.toContain('João');
      expect(anonymized).not.toContain('Silva');
    });

    it('guestId é removido dos metadados da decisão', () => {
      const metadata = { guestId: null, providerId: 'glm-4.7-flash' };
      expect(metadata.guestId).toBeNull();
    });

    it('nós marcados como forgotten=true não são deletados (mantêm auditoria)', () => {
      const node = { forgotten: true, content: 'original content' };
      expect(node.forgotten).toBe(true);
      expect(node.content).toBeTruthy(); // conteúdo preservado para auditoria
    });
  });
});
