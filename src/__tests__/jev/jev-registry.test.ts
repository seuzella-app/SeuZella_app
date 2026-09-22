// ============================================================================
// JEV — Testes do registro kind=DECISION (RUN22-A, SHADOW_ONLY)
// ============================================================================
import { describe, it, expect } from 'vitest';

// Suítes vivem em src/__tests__/jev/ — local coberto pelo include do vitest do
// projeto (tests/** e src/__tests__/**), descoberto no 2º envio do RUN22-A.
import { JEV_DECISION_MODES } from '../../domain/decision/contracts/JevTypes';
import {
  JevDecisionRegistry,
  JevRegistryError,
  JEV_DEFAULT_PROVIDERS,
  seedJevRegistry,
  validateJevRegistration,
  type JevProviderRegistration,
} from '../../lib/ai/jev/jev-provider-registry';

function validRegistration(overrides?: Partial<JevProviderRegistration>): JevProviderRegistration {
  return {
    id: 'jev-test-provider',
    name: 'Provider de teste',
    kind: 'DECISION',
    modes: ['INTENT'],
    shadowOnly: true,
    active: true,
    tier: 1,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    expectedLatencyMs: 10,
    maxContextTokens: 1024,
    supportsJson: true,
    supportsTools: false,
    baseUrl: null,
    ...overrides,
  };
}

describe('JEV registro — defaults', () => {
  it('2 defaults (local + typesafe), ambos DECISION e shadowOnly', () => {
    expect(JEV_DEFAULT_PROVIDERS).toHaveLength(2);
    for (const p of JEV_DEFAULT_PROVIDERS) {
      expect(p.kind).toBe('DECISION');
      expect(p.shadowOnly).toBe(true);
      expect(p.modes).toEqual([...JEV_DECISION_MODES]);
    }
    expect(JEV_DEFAULT_PROVIDERS[0].id).toBe('jev-local-heuristic');
    expect(JEV_DEFAULT_PROVIDERS[1].id).toBe('jev-typesafe');
  });

  it('seed é idempotente e snapshot fica shadowOnlyOnly=true', () => {
    const registry = new JevDecisionRegistry();
    seedJevRegistry(registry);
    seedJevRegistry(registry); // segunda passada não duplica
    expect(registry.listProviders()).toHaveLength(2);
    const snap = registry.snapshot();
    expect(snap.total).toBe(2);
    expect(snap.kinds).toEqual({ DECISION: 2, GENERATIVE: 0 });
    expect(snap.shadowOnlyOnly).toBe(true);
  });
});

describe('JEV registro — fail-closed', () => {
  it('aceita inscrição válida e filtra por modo', () => {
    const registry = new JevDecisionRegistry();
    registry.registerProvider(validRegistration());
    expect(registry.has('jev-test-provider')).toBe(true);
    expect(registry.providersForMode('INTENT')).toHaveLength(1);
    expect(registry.providersForMode('ANOMALY')).toHaveLength(0);
  });

  it('recusa kind GENERATIVE (JEV é DECISION PROVIDER)', () => {
    expect(validateJevRegistration(validRegistration({ kind: 'GENERATIVE' }))).toBe(
      'JEV_REG_KIND_MUST_BE_DECISION',
    );
    const registry = new JevDecisionRegistry();
    expect(() => registry.registerProvider(validRegistration({ kind: 'GENERATIVE' }))).toThrow(
      JevRegistryError,
    );
  });

  it('recusa shadowOnly=false (onda SHADOW_ONLY é invariante)', () => {
    expect(validateJevRegistration(validRegistration({ shadowOnly: false }))).toBe(
      'JEV_REG_SHADOW_ONLY_REQUIRED',
    );
  });

  it('recusa id duplicado', () => {
    const registry = new JevDecisionRegistry();
    registry.registerProvider(validRegistration());
    expect(() => registry.registerProvider(validRegistration())).toThrow(JevRegistryError);
  });

  it('recusa modos inválidos e tier fora de 1..3', () => {
    expect(
      validateJevRegistration(validRegistration({ modes: ['HACK' as never] })),
    ).toBe('JEV_REG_MODES_INVALID');
    expect(validateJevRegistration(validRegistration({ tier: 9 }))).toBe('JEV_REG_TIER_INVALID');
  });

  it('recusa custos negativos e latência não-positiva', () => {
    expect(validateJevRegistration(validRegistration({ costPer1kInput: -1 }))).toBe(
      'JEV_REG_COST_INPUT_INVALID',
    );
    expect(validateJevRegistration(validRegistration({ expectedLatencyMs: 0 }))).toBe(
      'JEV_REG_LATENCY_INVALID',
    );
  });

  it('erros carregam código estável (auditável no digest)', () => {
    const registry = new JevDecisionRegistry();
    try {
      registry.registerProvider(validRegistration({ shadowOnly: false }));
      throw new Error('deveria ter lançado');
    } catch (error) {
      expect(error).toBeInstanceOf(JevRegistryError);
      expect((error as JevRegistryError).code).toBe('JEV_REG_SHADOW_ONLY_REQUIRED');
    }
  });
});
