// ============================================================================
// Unit tests for new Cérebro ML modules
// ============================================================================
// Tests the additive ML enhancements:
//  - semantic-similarity (TF-IDF cosine)
//  - cerebro-budget-guard (tier transitions)
//  - vulnerability-scanner (pattern matching)
//  - self-defense (action decisions)
//  - auto-remediator (blocklist + guardrails)
//  - churn-predictor (signal scoring)
//  - zaos-neuro-router decay
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  semanticSimilarity,
  tokenize,
  combinedSimilarity,
} from '@/lib/cerebro/semantic-similarity';
import { getCerebroBudgetGuard, CerebroBudgetGuard } from '@/lib/cerebro/cerebro-budget-guard';
import { getVulnerabilityScanner, VulnerabilityScanner } from '@/lib/cerebro/vulnerability-scanner';
import { getSelfDefense, CerebroSelfDefense } from '@/lib/cerebro/self-defense';
import { getAutoRemediator, AutoRemediator } from '@/lib/cerebro/auto-remediator';
import { getChurnPredictor, ChurnPredictor } from '@/lib/cerebro/churn-predictor';
import { ZaosNeuroRouter } from '@/lib/ai/zaos-neuro-router';

// ── 1. Semantic Similarity ──────────────────────────────────────────────────

describe('semantic-similarity', () => {
  it('tokenize: normalizes Portuguese text with accents', () => {
    const tokens = tokenize('Claro! O check-in é às 14h.');
    expect(tokens).toContain('claro');
    expect(tokens).toContain('check'); // hyphenated word split
    expect(tokens).toContain('14h');
    // Stopwords removidas
    expect(tokens).not.toContain('o');
    expect(tokens).not.toContain('e');
  });

  it('semanticSimilarity: same text returns 1', () => {
    const text = 'Check-in é às 14h';
    expect(semanticSimilarity(text, text)).toBe(1);
  });

  it('semanticSimilarity: paraphrased text has high similarity', () => {
    const text1 = 'Claro! O check-in é às 14h.';
    const text2 = 'Sim, pode fazer check-in a partir das 14h.';
    const sim = semanticSimilarity(text1, text2);
    expect(sim).toBeGreaterThan(0.3); // shared tokens: check-in, 14h
  });

  it('semanticSimilarity: unrelated text has low similarity', () => {
    const text1 = 'Check-in é às 14h';
    const text2 = 'Completamente diferente sobre café da manhã servido às 7h';
    const sim = semanticSimilarity(text1, text2);
    expect(sim).toBeLessThan(0.3);
  });

  it('combinedSimilarity: identifies trivial edits', () => {
    const rejected = 'Resposta simples';
    const chosen = 'Resposta simples.'; // only adds period
    const result = combinedSimilarity(rejected, chosen, 0.95);
    expect(result.shouldKeepAsDpo).toBe(false);
    expect(result.reason).toBe('EDICAO_TRIVIAL_SEMANTICA');
  });

  it('combinedSimilarity: identifies rewrites', () => {
    const rejected = 'Olá! Tudo bem? Como posso ajudar com sua reserva?';
    const chosen = 'O café da manhã está disponível das 7 às 10 da manhã no refeitório principal.';
    const result = combinedSimilarity(rejected, chosen, 0.1);
    expect(result.shouldKeepAsDpo).toBe(false);
    expect(result.reason).toBe('REESCRITA_FORA_DE_CONTEXTO_SEMANTICA');
  });

  it('combinedSimilarity: accepts valid DPO pairs', () => {
    const rejected = 'Olá! Tudo bem? Como posso ajudar com sua reserva?';
    const chosen = 'Olá! Tudo ótimo. Em que posso ajudar sobre sua reserva hoje?';
    const result = combinedSimilarity(rejected, chosen, 0.6);
    expect(result.shouldKeepAsDpo).toBe(true);
  });
});

// ── 2. Cérebro Budget Guard ─────────────────────────────────────────────────

describe('cerebro-budget-guard', () => {
  let guard: CerebroBudgetGuard;

  beforeEach(() => {
    guard = new CerebroBudgetGuard({
      monthlyBudgetUsd: 10,
      dailyBudgetUsd: 1,
    });
    guard.reset();
  });

  it('starts in OK tier with zero spend', () => {
    const stats = guard.getStats();
    expect(stats.state.currentTier).toBe('ok');
    expect(stats.state.monthlySpendUsd).toBe(0);
  });

  it('allows spend when budget is available', () => {
    const result = guard.canSpend(0.01);
    expect(result.allowed).toBe(true);
    expect(result.tier).toBe('ok');
  });

  it('escalates tier as spend grows', async () => {
    // SOFT at 50% = $5
    await guard.recordSpend(5, 'analysis');
    expect(guard.getStats().state.currentTier).toBe('soft');

    // HARD at 80% = $8
    await guard.recordSpend(3, 'analysis');
    expect(guard.getStats().state.currentTier).toBe('hard');

    // CRITICAL at 95% = $9.5
    await guard.recordSpend(1.5, 'analysis');
    expect(guard.getStats().state.currentTier).toBe('critical');
  });

  it('blocks spend at CRITICAL tier', async () => {
    await guard.recordSpend(9.5, 'analysis'); // 95%
    const result = guard.canSpend(0.5);
    expect(result.allowed).toBe(false);
    expect(result.tier).toBe('critical');
  });

  it('tracks total saved by mock fallback', () => {
    guard.recordSavings(0.5);
    guard.recordSavings(0.3);
    expect(guard.getStats().state.totalSavedByMock).toBe(0.8);
  });
});

// ── 3. Vulnerability Scanner ────────────────────────────────────────────────

describe('vulnerability-scanner', () => {
  let scanner: VulnerabilityScanner;

  beforeEach(() => {
    scanner = new VulnerabilityScanner({ useGitDiff: false });
  });

  it('loads all vulnerability patterns', () => {
    const patterns = scanner.getPatterns();
    expect(patterns.length).toBeGreaterThanOrEqual(10);

    // Verifica categorias esperadas
    const categories = new Set(patterns.map(p => p.category));
    expect(categories.has('secret')).toBe(true);
    expect(categories.has('sqli')).toBe(true);
    expect(categories.has('ssrf')).toBe(true);
    expect(categories.has('eval')).toBe(true);
    expect(categories.has('crypto_weakness')).toBe(true);
  });

  it('completes a scan without errors', async () => {
    const result = await scanner.scan();
    expect(result.totalFilesScanned).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThan(0);
    expect(result.mode).toBeDefined();
    expect(Array.isArray(result.findings)).toBe(true);
  });

  it('detects OpenAI API key pattern', () => {
    const patterns = scanner.getPatterns();
    const openaiPattern = patterns.find(p => p.id === 'SECRET_OPENAI_KEY');
    expect(openaiPattern).toBeDefined();
    expect(openaiPattern!.regex.test('sk-abcdefghijklmnopqrstuvwxyz1234567890')).toBe(true);
    expect(openaiPattern!.regex.test('not-a-key')).toBe(false);
  });

  it('detects eval() usage', () => {
    const patterns = scanner.getPatterns();
    const evalPattern = patterns.find(p => p.id === 'UNSAFE_EVAL');
    expect(evalPattern).toBeDefined();
    expect(evalPattern!.regex.test('eval(userInput)')).toBe(true);
    expect(evalPattern!.regex.test('evaluate(x)')).toBe(false); // não é eval(
  });
});

// ── 4. Self-Defense ─────────────────────────────────────────────────────────

describe('self-defense', () => {
  let defense: CerebroSelfDefense;

  beforeEach(() => {
    defense = new CerebroSelfDefense();
  });

  it('takes no action for non-critical anomalies', async () => {
    const results = await defense.reactToAnomalies([
      {
        anomalyType: 'error_spike',
        scope: 'module:test',
        severity: 'info',
        observed: 5,
        baseline: 2,
      },
    ]);
    expect(results.length).toBe(0);
  });

  it('takes action for critical auth_failure_pattern', async () => {
    const results = await defense.reactToAnomalies([
      {
        anomalyType: 'auth_failure_pattern',
        scope: 'global:auth',
        severity: 'critical',
        observed: 60,
        baseline: 5,
        evidence: [{ context: { ip: '203.0.113.50' } }],
      },
    ]);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].action).toBe('ip_ban');
    expect(results[0].target).toBe('203.0.113.50');
  });

  it('takes action for emergency tenant_under_attack', async () => {
    const results = await defense.reactToAnomalies([
      {
        anomalyType: 'tenant_under_attack',
        scope: 'global:auth-distributed',
        severity: 'emergency',
        observed: 200,
        baseline: 5,
        evidence: [],
      },
    ]);
    expect(results.length).toBeGreaterThan(0);
    // emergency TTL deve ser 24h = 1440 min
    const ttl = results[0].ttlMinutes;
    expect(ttl).toBe(24 * 60);
  });

  it('cost_anomaly produces alert_only (no defense action)', async () => {
    const results = await defense.reactToAnomalies([
      {
        anomalyType: 'cost_anomaly',
        scope: 'global:meta-api',
        severity: 'critical',
        observed: 25,
        baseline: 1,
      },
    ]);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].action).toBe('alert_only');
    expect(results[0].ttlMinutes).toBe(0);
  });

  it('returns stats', () => {
    const stats = defense.getStats();
    expect(stats).toHaveProperty('mode');
    expect(stats).toHaveProperty('maxActionsPerHour');
    expect(stats.maxActionsPerHour).toBe(10);
  });
});

// ── 5. Auto-Remediator ──────────────────────────────────────────────────────

describe('auto-remediator', () => {
  let remediator: AutoRemediator;

  beforeEach(() => {
    remediator = new AutoRemediator();
  });

  it('has critical files in blocklist', () => {
    const stats = remediator.getStats();
    expect(stats.blocklistSize).toBeGreaterThan(5);
  });

  it('auto mode defaults to false (require approval)', () => {
    const stats = remediator.getStats();
    expect(stats.config.autoMode).toBe(false);
  });

  it('confidence threshold defaults to 0.85', () => {
    const stats = remediator.getStats();
    expect(stats.config.autoConfidenceThreshold).toBe(0.85);
  });
});

// ── 6. Churn Predictor ──────────────────────────────────────────────────────

describe('churn-predictor', () => {
  let predictor: ChurnPredictor;

  beforeEach(() => {
    predictor = new ChurnPredictor();
  });

  it('returns weights for all 5 signals', () => {
    const stats = predictor.getStats();
    const weights = stats.weights;
    expect(Object.keys(weights)).toHaveLength(5);
    expect(weights.ai_activity_decline).toBe(0.30);
    expect(weights.conversation_decline).toBe(0.20);
    expect(weights.meta_cost_decline).toBe(0.15);
    expect(weights.brain_health).toBe(0.20);
    expect(weights.login_recency).toBe(0.15);
  });

  it('weights sum to 1.0', () => {
    const stats = predictor.getStats();
    const total = Object.values(stats.weights).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1.0, 2);
  });

  it('has 4 risk levels', () => {
    const stats = predictor.getStats();
    expect(Object.keys(stats.riskThresholds)).toHaveLength(4);
  });
});

// ── 7. ZaosNeuroRouter Decay ────────────────────────────────────────────────

describe('zaos-neuro-router posterior decay', () => {
  it('applyPosteriorDecay reduces alpha and beta', () => {
    const router = new ZaosNeuroRouter();

    // Accumulate evidence
    const snapshot0 = router.getPosteriorSnapshot();
    const firstProviderId = snapshot0[0].providerId;

    router.recordFeedback(firstProviderId, true, 100);
    router.recordFeedback(firstProviderId, true, 100);
    router.recordFeedback(firstProviderId, false, 200);

    const before = router.getPosteriorSnapshot().find(p => p.providerId === firstProviderId)!;
    expect(before.alpha).toBeGreaterThan(before.beta); // 2 successes, 1 failure

    const decayResults = router.applyPosteriorDecay(0.5); // 50% decay
    const result = decayResults.find(r => r.providerId === firstProviderId)!;

    expect(result.afterAlpha).toBeLessThan(result.beforeAlpha);
    expect(result.afterBeta).toBeLessThan(result.beforeBeta);
    expect(result.effectiveEvidenceKept).toBeCloseTo(0.5, 1);
  });

  it('applyPosteriorDecay rejects invalid gamma', () => {
    const router = new ZaosNeuroRouter();
    expect(() => router.applyPosteriorDecay(0)).toThrow();
    expect(() => router.applyPosteriorDecay(1)).toThrow();
    expect(() => router.applyPosteriorDecay(1.5)).toThrow();
    expect(() => router.applyPosteriorDecay(-0.5)).toThrow();
  });

  it('applyPosteriorDecay never goes below prior', () => {
    const router = new ZaosNeuroRouter();
    const snapshot = router.getPosteriorSnapshot();
    const firstId = snapshot[0].providerId;
    const priorAlpha = snapshot[0].alpha;

    // Apply many decays
    for (let i = 0; i < 50; i++) {
      router.applyPosteriorDecay(0.1); // aggressive decay
    }

    const after = router.getPosteriorSnapshot().find(p => p.providerId === firstId)!;
    expect(after.alpha).toBeGreaterThanOrEqual(priorAlpha - 0.001); // allow tiny float error
  });

  it('getPosteriorSnapshot returns all 8 default providers', () => {
    const router = new ZaosNeuroRouter();
    const snapshot = router.getPosteriorSnapshot();
    expect(snapshot.length).toBe(8); // ollama x2, groq, gemini, deepseek, zhipu, moonshot, openrouter

    // Each entry has required fields
    for (const entry of snapshot) {
      expect(entry).toHaveProperty('providerId');
      expect(entry).toHaveProperty('providerName');
      expect(entry).toHaveProperty('tier');
      expect(entry).toHaveProperty('alpha');
      expect(entry).toHaveProperty('beta');
      expect(entry).toHaveProperty('posteriorMean');
      expect(entry.posteriorMean).toBeGreaterThan(0);
      expect(entry.posteriorMean).toBeLessThan(1);
    }
  });
});
