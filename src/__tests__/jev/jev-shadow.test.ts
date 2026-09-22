// ============================================================================
// JEV — Testes de config fail-closed + shadow runner (RUN22-A, SHADOW_ONLY)
// ============================================================================
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Suítes vivem em src/__tests__/jev/ — local coberto pelo include do vitest do
// projeto (tests/** e src/__tests__/**), descoberto no 2º envio do RUN22-A.
import {
  readJevConfig,
  resetJevConfigCache,
  jevAvailable,
  JEV_DEFAULTS,
} from '../../lib/ai/jev/jev-config';
import { JevShadowRunner, hashTenantId } from '../../lib/ai/jev/jev-shadow';
import { JevTypesafeAdapter } from '../../domain/decision/adapters/JevTypesafeAdapter';
import type { IJevDecisionPort } from '../../domain/decision/ports/IJevDecisionPort';
import type { JevDecisionResponse } from '../../domain/decision/contracts/JevTypes';

const VALID = {
  requestId: 'req-shadow-1',
  tenantId: 'tenant-shadow',
  mode: 'INTENT' as const,
  payload: { text: 'quero fazer uma reserva' },
  occurredAt: '2026-09-22T12:00:00.000Z',
};

function localOk(label: string): IJevDecisionPort {
  return {
    source: 'jev-local-heuristic',
    decide: async () =>
      ({
        status: 'ok',
        mode: 'INTENT',
        source: 'jev-local-heuristic',
        decision: { label, confidence: 0.9 },
        shadowOnly: true,
        latencyMs: 1,
      }) as JevDecisionResponse,
  };
}

function remoteStub(response: JevDecisionResponse): IJevDecisionPort {
  return {
    source: 'jev-typesafe',
    decide: async () => response,
  };
}

describe('JEV config — fail-closed por padrão', () => {
  const saved: Record<string, string | undefined> = {};
  const KEYS = ['JEV_ENABLED', 'JEV_MODEL', 'JEV_TIMEOUT_MS', 'JEV_MAX_RETRIES', 'JEV_DEFAULT_CONFIDENCE_THRESHOLD', 'TYPESAFE_API_KEY', 'JEV_TYPESAFE_BASE_URL'];

  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    resetJevConfigCache();
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    resetJevConfigCache();
  });

  it('sem nada no env: disabled, shadow, sem chave, defaults', () => {
    const cfg = readJevConfig({});
    expect(cfg.enabled).toBe(false);
    expect(cfg.shadowMode).toBe(true);
    expect(cfg.typesafeKeyPresent).toBe(false);
    expect(cfg.model).toBe(JEV_DEFAULTS.model);
    expect(cfg.timeoutMs).toBe(JEV_DEFAULTS.timeoutMs);
    expect(cfg.maxRetries).toBe(JEV_DEFAULTS.maxRetries);
    expect(cfg.confidenceThreshold).toBe(JEV_DEFAULTS.confidenceThreshold);
    expect(cfg.baseUrl).toBe(JEV_DEFAULTS.baseUrl);
  });

  it('valores sujos caem nos defaults/clamps (nunca NaN)', () => {
    const cfg = readJevConfig({
      JEV_TIMEOUT_MS: 'banana',
      JEV_MAX_RETRIES: '99',
      JEV_DEFAULT_CONFIDENCE_THRESHOLD: '7',
      JEV_MODEL: '   ',
    });
    expect(cfg.timeoutMs).toBe(JEV_DEFAULTS.timeoutMs);
    expect(cfg.maxRetries).toBe(JEV_DEFAULTS.maxRetriesCap); // clamp p/ 5
    expect(cfg.confidenceThreshold).toBe(1); // clamp p/ [0,1]
    expect(cfg.model).toBe(JEV_DEFAULTS.model);
  });

  it('jevAvailable exige flag + chave + shadow (false em qualquer combinação parcial)', () => {
    expect(jevAvailable(readJevConfig({}))).toBe(false);
    expect(jevAvailable(readJevConfig({ JEV_ENABLED: 'true' }))).toBe(false);
    expect(jevAvailable(readJevConfig({ JEV_ENABLED: 'true', TYPESAFE_API_KEY: 'k' }))).toBe(true);
  });

  it('a chave nunca aparece no config (só presença booleana)', () => {
    const serialized = JSON.stringify(readJevConfig({ TYPESAFE_API_KEY: 'sk-super-secreto' }));
    expect(serialized).not.toContain('sk-super-secreto');
  });
});

describe('JEV shadow runner — SHADOW_ONLY', () => {
  it('entrada inválida vira rejected sem lançar', async () => {
    const runner = new JevShadowRunner({ localPort: localOk('X'), remotePort: null });
    const entry = await runner.evaluate('lixo');
    expect(entry.local.status).toBe('rejected');
    expect(entry.agreement).toBeNull();
    expect(entry.tenantHash).toBe('invalid');
  });

  it('decisão local ok; buffer guarda HASH do tenant, nunca o id puro', async () => {
    const runner = new JevShadowRunner({ localPort: localOk('RESERVA'), remotePort: null });
    const entry = await runner.evaluate(VALID);
    expect(entry.local.status).toBe('ok');
    expect(entry.tenantHash).toBe(hashTenantId('tenant-shadow'));
    expect(entry.tenantHash).not.toContain('tenant-shadow');
    expect(JSON.stringify(entry)).not.toContain('tenant-shadow');
    expect(JSON.stringify(entry)).not.toContain('quero fazer uma reserva');
  });

  it('buffer limitado (capacity) — mais velho sai primeiro', async () => {
    const runner = new JevShadowRunner({ localPort: localOk('X'), remotePort: null, capacity: 3 });
    for (let i = 0; i < 5; i += 1) {
      await runner.evaluate({ ...VALID, requestId: `r-${i}` });
    }
    expect(runner.size).toBe(3);
    const recent = runner.recent(3);
    expect(recent.map((e) => e.requestId)).toEqual(['r-2', 'r-3', 'r-4']);
  });

  it('stats agregam por modo e agreementRate é null sem remoto', async () => {
    const runner = new JevShadowRunner({ localPort: localOk('RESERVA'), remotePort: null });
    await runner.evaluate(VALID);
    await runner.evaluate({ ...VALID, requestId: 'r2', mode: 'ANOMALY' as const, payload: { deviation: 3.2 } });
    const stats = runner.stats();
    expect(stats.total).toBe(2);
    expect(stats.okLocal).toBe(2);
    expect(stats.remoteOk).toBe(0);
    expect(stats.agreementRate).toBeNull();
    expect(stats.byMode.INTENT.n).toBe(1);
    expect(stats.byMode.ANOMALY.n).toBe(1);
  });

  it('sem remoto disponível: remote fica null e agreement null (fail-closed)', async () => {
    const remote = remoteStub({
      status: 'ok',
      mode: 'INTENT',
      source: 'jev-typesafe',
      decision: { label: 'RESERVA', confidence: 0.93 },
      shadowOnly: true,
      latencyMs: 5,
    });
    const runner = new JevShadowRunner({ localPort: localOk('RESERVA'), remotePort: remote });
    // jevAvailable() é false no env de teste => remoto não é chamado; a
    // comparação só acende quando a chave existir (onda de integração).
    const entry = await runner.evaluate(VALID);
    expect(entry.remote).toBeNull();
    expect(entry.agreement).toBeNull();
  });

  it('heurística local INTENT: palavra-chave de reserva => label RESERVA', async () => {
    const runner = new JevShadowRunner({ remotePort: null });
    const entry = await runner.evaluate(VALID);
    expect(entry.local.status).toBe('ok');
    if (entry.local.status === 'ok') {
      expect(entry.local.decision.label).toBe('RESERVA');
      expect(entry.local.decision.confidence).toBeGreaterThanOrEqual(0);
      expect(entry.local.decision.confidence).toBeLessThanOrEqual(1);
    }
    expect(entry.local.shadowOnly).toBe(true);
  });
});

describe('JEV adapter TypeSafe — fail-closed sem chave (nunca sai do processo)', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of ['JEV_ENABLED', 'TYPESAFE_API_KEY']) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    resetJevConfigCache();
  });
  afterEach(() => {
    for (const k of ['JEV_ENABLED', 'TYPESAFE_API_KEY']) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    resetJevConfigCache();
  });

  it('JEV_ENABLED ausente => JEV_DISABLED e fetch NUNCA é chamado', async () => {
    const fetchSpy = vi.fn();
    const adapter = new JevTypesafeAdapter({ fetchImpl: fetchSpy as unknown as typeof fetch });
    const response = await adapter.decide({
      requestId: 'r1',
      tenantId: 't1',
      mode: 'INTENT',
      payload: { text: 'x' },
      occurredAt: '2026-09-22T12:00:00.000Z',
    });
    expect(response.status).toBe('unavailable');
    if (response.status === 'unavailable') {
      expect(response.reason).toBe('JEV_DISABLED');
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('flag ligada sem chave => JEV_KEY_MISSING e fetch NUNCA é chamado', async () => {
    process.env.JEV_ENABLED = 'true';
    resetJevConfigCache();
    const fetchSpy = vi.fn();
    const adapter = new JevTypesafeAdapter({ fetchImpl: fetchSpy as unknown as typeof fetch });
    const response = await adapter.decide({
      requestId: 'r2',
      tenantId: 't2',
      mode: 'SENTIMENT',
      payload: { text: 'ótimo' },
      occurredAt: '2026-09-22T12:00:00.000Z',
    });
    expect(response.status).toBe('unavailable');
    if (response.status === 'unavailable') {
      expect(response.reason).toBe('JEV_KEY_MISSING');
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('shadowOnly é literal true em TODA resposta do adapter', async () => {
    const adapter = new JevTypesafeAdapter({ fetchImpl: vi.fn() as unknown as typeof fetch });
    const response = await adapter.decide({
      requestId: 'r3',
      tenantId: 't3',
      mode: 'ANOMALY',
      payload: { deviation: 1.5 },
      occurredAt: '2026-09-22T12:00:00.000Z',
    });
    expect(response.shadowOnly).toBe(true);
  });
});
