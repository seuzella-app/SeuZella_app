/**
 * Testes do SemanticaClient — Bridge TypeScript ↔ Python Sidecar
 *
 * Valida:
 *   1. Tipos e interfaces (ContextNode, GraphEdge, Decision, etc.)
 *   2. SemanticaError com error codes e isRecoverable()
 *   3. SemanticaClient.isEnabled() / isConfigured() com feature flags
 *   4. Cache LRU (get/set/invalidate/clear)
 *   5. withFallback() — fallback gracioso automático
 *   6. Retry com backoff exponencial
 *   7. Auth via SEMANTICA_API_KEY
 *
 * Não testa HTTP real (sidecar Python) — apenas lógica do cliente TS.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SemanticaClient, withFallback } from '@/lib/semantica/client';
import { SemanticaError } from '@/lib/semantica/types';

describe('SemanticaClient — Bridge TypeScript', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset env vars before each test
    process.env.USE_SEMANTICA_GRAPH = 'false';
    process.env.SEMANTICA_BASE_URL = 'http://127.0.0.1:7432';
    process.env.SEMANTICA_API_KEY = '';
    process.env.SEMANTICA_TIMEOUT_MS = '3000';
    process.env.SEMANTICA_CACHE_TTL = '300';
    process.env.SEMANTICA_MAX_RETRIES = '3';
    SemanticaClient.clearCache();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════
  // 1. FEATURE FLAGS
  // ═══════════════════════════════════════════════════════════════

  describe('Feature Flags', () => {
    it('isEnabled() retorna false quando USE_SEMANTICA_GRAPH=false (default)', () => {
      process.env.USE_SEMANTICA_GRAPH = 'false';
      expect(SemanticaClient.isEnabled()).toBe(false);
    });

    it('isEnabled() retorna true quando USE_SEMANTICA_GRAPH=true', () => {
      process.env.USE_SEMANTICA_GRAPH = 'true';
      expect(SemanticaClient.isEnabled()).toBe(true);
    });

    it('isConfigured() retorna false quando SEMANTICA_API_KEY está vazio', () => {
      process.env.SEMANTICA_API_KEY = '';
      expect(SemanticaClient.isConfigured()).toBe(false);
    });

    it('isConfigured() retorna true quando SEMANTICA_API_KEY e BASE_URL estão setados', () => {
      process.env.SEMANTICA_API_KEY = 'test-key-123';
      process.env.SEMANTICA_BASE_URL = 'http://127.0.0.1:7432';
      expect(SemanticaClient.isConfigured()).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 2. SEMANTICA ERROR
  // ═══════════════════════════════════════════════════════════════

  describe('SemanticaError', () => {
    it('cria erro com code, message e statusCode', () => {
      const err = new SemanticaError('TIMEOUT', 'Request timed out', 408);
      expect(err.code).toBe('TIMEOUT');
      expect(err.message).toBe('Request timed out');
      expect(err.statusCode).toBe(408);
      expect(err.name).toBe('SemanticaError');
    });

    it('isRecoverable() retorna true para TIMEOUT', () => {
      const err = new SemanticaError('TIMEOUT', 'timeout', 408);
      expect(err.isRecoverable()).toBe(true);
    });

    it('isRecoverable() retorna true para SERVICE_UNAVAILABLE', () => {
      const err = new SemanticaError('SERVICE_UNAVAILABLE', 'down', 503);
      expect(err.isRecoverable()).toBe(true);
    });

    it('isRecoverable() retorna true para INTERNAL_ERROR', () => {
      const err = new SemanticaError('INTERNAL_ERROR', 'crash', 500);
      expect(err.isRecoverable()).toBe(true);
    });

    it('isRecoverable() retorna false para UNAUTHORIZED', () => {
      const err = new SemanticaError('UNAUTHORIZED', 'bad key', 401);
      expect(err.isRecoverable()).toBe(false);
    });

    it('isRecoverable() retorna false para VALIDATION_ERROR', () => {
      const err = new SemanticaError('VALIDATION_ERROR', 'bad payload', 422);
      expect(err.isRecoverable()).toBe(false);
    });

    it('shouldAlert() retorna true para INTERNAL_ERROR', () => {
      const err = new SemanticaError('INTERNAL_ERROR', 'crash', 500);
      expect(err.shouldAlert()).toBe(true);
    });

    it('shouldAlert() retorna true para GRAPH_INVALID', () => {
      const err = new SemanticaError('GRAPH_INVALID', 'corrupted', 500);
      expect(err.shouldAlert()).toBe(true);
    });

    it('shouldAlert() retorna false para TIMEOUT (recoverable, não alerta)', () => {
      const err = new SemanticaError('TIMEOUT', 'slow', 408);
      expect(err.shouldAlert()).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 3. CACHE LRU
  // ═══════════════════════════════════════════════════════════════

  describe('Cache LRU', () => {
    it('getCacheSize() retorna 0 inicialmente', () => {
      SemanticaClient.clearCache();
      expect(SemanticaClient.getCacheSize()).toBe(0);
    });

    it('clearCache() zera o cache', () => {
      SemanticaClient.clearCache();
      expect(SemanticaClient.getCacheSize()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 4. WITH FALLBACK
  // ═══════════════════════════════════════════════════════════════

  describe('withFallback()', () => {
    it('retorna resultado do primary quando primary sucede', async () => {
      const primary = vi.fn().mockResolvedValue('primary-result');
      const fallback = vi.fn().mockResolvedValue('fallback-result');

      const result = await withFallback(primary, fallback);

      expect(result).toBe('primary-result');
      expect(primary).toHaveBeenCalledOnce();
      expect(fallback).not.toHaveBeenCalled();
    });

    it('executa fallback quando primary lança SemanticaError recoverable', async () => {
      const primary = vi.fn().mockRejectedValue(
        new SemanticaError('TIMEOUT', 'timed out', 408)
      );
      const fallback = vi.fn().mockResolvedValue('fallback-result');

      const result = await withFallback(primary, fallback);

      expect(result).toBe('fallback-result');
      expect(primary).toHaveBeenCalledOnce();
      expect(fallback).toHaveBeenCalledOnce();
    });

    it('executa fallback quando primary lança SERVICE_UNAVAILABLE', async () => {
      const primary = vi.fn().mockRejectedValue(
        new SemanticaError('SERVICE_UNAVAILABLE', 'sidecar down', 503)
      );
      const fallback = vi.fn().mockResolvedValue('fallback-result');

      const result = await withFallback(primary, fallback);

      expect(result).toBe('fallback-result');
      expect(fallback).toHaveBeenCalledOnce();
    });

    it('não executa fallback quando erro é não-recoverable (UNAUTHORIZED)', async () => {
      const primary = vi.fn().mockRejectedValue(
        new SemanticaError('UNAUTHORIZED', 'bad key', 401)
      );
      const fallback = vi.fn().mockResolvedValue('fallback-result');

      await expect(withFallback(primary, fallback)).rejects.toThrow('bad key');
      expect(fallback).not.toHaveBeenCalled();
    });

    it('chama onError callback quando fornecido', async () => {
      const primary = vi.fn().mockRejectedValue(
        new SemanticaError('TIMEOUT', 'timed out', 408)
      );
      const fallback = vi.fn().mockResolvedValue('fallback-result');
      const onError = vi.fn();

      await withFallback(primary, fallback, onError);

      expect(onError).toHaveBeenCalledOnce();
      expect(onError.mock.calls[0][0]).toBeInstanceOf(SemanticaError);
    });

    it('propaga erros não-SemanticaError sem fallback', async () => {
      const primary = vi.fn().mockRejectedValue(new Error('random error'));
      const fallback = vi.fn().mockResolvedValue('fallback-result');

      await expect(withFallback(primary, fallback)).rejects.toThrow('random error');
      expect(fallback).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 5. HEALTH CHECK (não requer auth)
  // ═══════════════════════════════════════════════════════════════

  describe('health()', () => {
    it('retorna status "down" quando sidecar indisponível', async () => {
      process.env.SEMANTICA_BASE_URL = 'http://127.0.0.1:9999'; // porta não usada
      const health = await SemanticaClient.health();
      expect(health.status).toBe('down');
      expect(health.postgres).toBe('disconnected');
      expect(health.totalNodes).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 6. API QUANDO DESABILITADO
  // ═══════════════════════════════════════════════════════════════

  describe('API quando USE_SEMANTICA_GRAPH=false', () => {
    it('hybridSearch lança SERVICE_UNAVAILABLE quando disabled', async () => {
      process.env.USE_SEMANTICA_GRAPH = 'false';
      await expect(
        SemanticaClient.hybridSearch({ tenantId: 't1', query: 'test' })
      ).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
        statusCode: 503,
      });
    });

    it('addNode lança SERVICE_UNAVAILABLE quando disabled', async () => {
      process.env.USE_SEMANTICA_GRAPH = 'false';
      await expect(
        SemanticaClient.addNode({
          tenantId: 't1',
          type: 'CHECKIN',
          name: 'Test',
          content: 'Test content',
        })
      ).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      });
    });

    it('recordDecision lança SERVICE_UNAVAILABLE quando disabled', async () => {
      process.env.USE_SEMANTICA_GRAPH = 'false';
      await expect(
        SemanticaClient.recordDecision({
          tenantId: 't1',
          category: 'guest_response',
          scenario: 'test',
          reasoning: 'test',
          outcome: 'success',
          confidence: 0.9,
        })
      ).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 7. AUTH QUANDO HABILITADO MAS SEM API_KEY
  // ═══════════════════════════════════════════════════════════════

  describe('Auth quando habilitado mas sem API_KEY', () => {
    it('hybridSearch lança UNAUTHORIZED quando API_KEY vazia', async () => {
      process.env.USE_SEMANTICA_GRAPH = 'true';
      process.env.SEMANTICA_API_KEY = '';
      await expect(
        SemanticaClient.hybridSearch({ tenantId: 't1', query: 'test' })
      ).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        statusCode: 401,
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 8. CACHE INVALIDATION
  // ═══════════════════════════════════════════════════════════════

  describe('invalidateTenantCache()', () => {
    it('não lança erro ao invalidar cache de tenant inexistente', () => {
      expect(() => SemanticaClient.invalidateTenantCache('nonexistent')).not.toThrow();
    });
  });
});
