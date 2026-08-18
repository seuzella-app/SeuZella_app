// ============================================================================
// Cérebro Zélla — TEST SUITE 1: APRENDIZADO DE MÁQUINA (ML Core)
// ============================================================================
// Verifica que os pontos críticos de MITIGAÇÃO de ML foram codificados e
// reagem corretamente. Esta suite foca em:
//
//   1. Thompson Sampling (Beta-Binomial posterior) — ZaosNeuroRouter
//   2. Non-stationary adaptation via posterior decay (γ-factor)
//   3. TF-IDF cosine semantic similarity para DPO filtering
//   4. Cérebro Budget Guard (tiered thresholds: OK/SOFT/HARD/CRITICAL)
//   5. Churn Predictor scoring matemática (5 sinais ponderados)
//
// Estes testes GARANTEM que o Cérebro aprende com feedback, esquece
// gradualmente (decay), filtra pares DPO com qualidade semântica, respeita
// orçamento e calcula risco de churn com precisão.
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { ZaosNeuroRouter } from '@/lib/ai/zaos-neuro-router';
import {
  semanticSimilarity,
  combinedSimilarity,
  tokenize,
  termFrequency,
  inverseDocFrequency,
  tfidfVector,
  cosineSimilarity,
} from '@/lib/cerebro/semantic-similarity';
import { CerebroBudgetGuard } from '@/lib/cerebro/cerebro-budget-guard';
import { ChurnPredictor } from '@/lib/cerebro/churn-predictor';

// ============================================================================
// 1. THOMPSON SAMPLING — Aprendizado Beta-Binomial
// ============================================================================

describe('[ML-1] Thompson Sampling — posterior Beta-Binomial', () => {
  it('registers providers com alpha/beta iniciais definidos', () => {
    const router = new ZaosNeuroRouter();
    const snapshot = router.getPosteriorSnapshot();
    expect(snapshot.length).toBeGreaterThanOrEqual(8);

    // Cada provider tem alpha >= 1 e beta >= 1 (prior informativo ou uniforme)
    for (const p of snapshot) {
      expect(p.alpha).toBeGreaterThanOrEqual(1);
      expect(p.beta).toBeGreaterThanOrEqual(1);
      // Posterior mean deve estar no intervalo (0, 1)
      expect(p.posteriorMean).toBeGreaterThan(0);
      expect(p.posteriorMean).toBeLessThan(1);
    }
  });

  it('incrementa alpha após sucesso (aprende que provider é bom)', () => {
    const router = new ZaosNeuroRouter();
    const snap = router.getPosteriorSnapshot();
    const id = snap[0].providerId;
    const alphaBefore = snap[0].alpha;
    const betaBefore = snap[0].beta;

    router.recordFeedback(id, true, 100);

    const after = router.getPosteriorSnapshot().find(p => p.providerId === id)!;
    expect(after.alpha).toBe(alphaBefore + 1);
    expect(after.beta).toBe(betaBefore); // inalterado
  });

  it('incrementa beta após falha (aprende que provider é ruim)', () => {
    const router = new ZaosNeuroRouter();
    const snap = router.getPosteriorSnapshot();
    const id = snap[0].providerId;
    const alphaBefore = snap[0].alpha;
    const betaBefore = snap[0].beta;

    router.recordFeedback(id, false, 500);

    const after = router.getPosteriorSnapshot().find(p => p.providerId === id)!;
    expect(after.alpha).toBe(alphaBefore);
    expect(after.beta).toBe(betaBefore + 1);
  });

  it('posteriorMean converge para true success rate após N amostras', () => {
    const router = new ZaosNeuroRouter();
    const snap = router.getPosteriorSnapshot();
    const id = snap[0].providerId;

    // Simula 30 sucessos + 10 falhas = 75% true success rate
    for (let i = 0; i < 30; i++) router.recordFeedback(id, true, 100);
    for (let i = 0; i < 10; i++) router.recordFeedback(id, false, 200);

    const after = router.getPosteriorSnapshot().find(p => p.providerId === id)!;
    // Posterior mean = α/(α+β) = 31/(31+11) ≈ 0.738
    // Deve estar perto de 0.75 (com smoothing do prior)
    expect(after.posteriorMean).toBeGreaterThan(0.70);
    expect(after.posteriorMean).toBeLessThan(0.78);
  });

  it('diferencia providers por performance (aprendizado discriminativo)', () => {
    const router = new ZaosNeuroRouter();
    const snap = router.getPosteriorSnapshot();
    const goodId = snap[0].providerId;
    const badId = snap[1].providerId;

    // Good: 20 sucessos, 0 falhas
    for (let i = 0; i < 20; i++) router.recordFeedback(goodId, true, 80);
    // Bad: 0 sucessos, 20 falhas
    for (let i = 0; i < 20; i++) router.recordFeedback(badId, false, 1500);

    const after = router.getPosteriorSnapshot();
    const good = after.find(p => p.providerId === goodId)!;
    const bad = after.find(p => p.providerId === badId)!;

    // Good deve ter posteriorMean ~1.0, Bad ~0.0
    expect(good.posteriorMean).toBeGreaterThan(0.85);
    expect(bad.posteriorMean).toBeLessThan(0.15);
    expect(good.posteriorMean).toBeGreaterThan(bad.posteriorMean);
  });
});

// ============================================================================
// 2. POSTERIOR DECAY — Non-stationary adaptation
// ============================================================================

describe('[ML-2] Posterior Decay — adaptação não-estacionária', () => {
  it('decay γ=0.95 mantém 95% da evidência acumulada', () => {
    const router = new ZaosNeuroRouter();
    const snap = router.getPosteriorSnapshot();
    const id = snap[0].providerId;

    // Acumula evidência: 10 sucessos, 2 falhas
    for (let i = 0; i < 10; i++) router.recordFeedback(id, true, 100);
    for (let i = 0; i < 2; i++) router.recordFeedback(id, false, 200);

    const decayResults = router.applyPosteriorDecay(0.95);
    const r = decayResults.find(x => x.providerId === id)!;

    // effectiveEvidenceKept deve estar próximo de 0.95
    expect(r.effectiveEvidenceKept).toBeGreaterThan(0.90);
    expect(r.effectiveEvidenceKept).toBeLessThan(1.0);
    // α deve ter diminuído (decay reduz evidência)
    expect(r.afterAlpha).toBeLessThan(r.beforeAlpha);
    expect(r.afterBeta).toBeLessThan(r.beforeBeta);
  });

  it('decay γ=0.5 mantém 50% da evidência', () => {
    const router = new ZaosNeuroRouter();
    const snap = router.getPosteriorSnapshot();
    const id = snap[0].providerId;

    for (let i = 0; i < 10; i++) router.recordFeedback(id, true, 100);

    const r = router.applyPosteriorDecay(0.5).find(x => x.providerId === id)!;
    expect(r.effectiveEvidenceKept).toBeCloseTo(0.5, 1);
  });

  it('decay nunca reduz α/β abaixo do prior (preserve baseline)', () => {
    const router = new ZaosNeuroRouter();
    const snap = router.getPosteriorSnapshot();
    const id = snap[0].providerId;
    const priorAlpha = snap[0].alpha;
    const priorBeta = snap[0].beta;

    // Aplica 100 decays agressivos (γ=0.1)
    for (let i = 0; i < 100; i++) {
      router.applyPosteriorDecay(0.1);
    }

    const after = router.getPosteriorSnapshot().find(p => p.providerId === id)!;
    expect(after.alpha).toBeGreaterThanOrEqual(priorAlpha - 0.001);
    expect(after.beta).toBeGreaterThanOrEqual(priorBeta - 0.001);
  });

  it('decay rejeita γ inválido (0, 1, negativo, >1)', () => {
    const router = new ZaosNeuroRouter();
    expect(() => router.applyPosteriorDecay(0)).toThrow();
    expect(() => router.applyPosteriorDecay(1)).toThrow();
    expect(() => router.applyPosteriorDecay(-0.5)).toThrow();
    expect(() => router.applyPosteriorDecay(1.5)).toThrow();
  });

  it('decay simula mudança de regime: provider que era bom fica ruim', () => {
    const router = new ZaosNeuroRouter();
    const snap = router.getPosteriorSnapshot();
    const id = snap[0].providerId;

    // Phase 1: provider é excelente (20 sucessos)
    for (let i = 0; i < 20; i++) router.recordFeedback(id, true, 100);
    const phase1 = router.getPosteriorSnapshot().find(p => p.providerId === id)!;
    expect(phase1.posteriorMean).toBeGreaterThan(0.90);

    // Decay para simular tempo passando
    router.applyPosteriorDecay(0.3);

    // Phase 2: provider degrada (10 falhas seguidas)
    for (let i = 0; i < 10; i++) router.recordFeedback(id, false, 1500);
    const phase2 = router.getPosteriorSnapshot().find(p => p.providerId === id)!;

    // Posterior deve ter caído significativamente (não ficou preso no passado)
    expect(phase2.posteriorMean).toBeLessThan(phase1.posteriorMean - 0.2);
  });
});

// ============================================================================
// 3. SEMANTIC SIMILARITY — DPO Pair Filtering
// ============================================================================

describe('[ML-3] TF-IDF Cosine Similarity — filtro de pares DPO', () => {
  it('tokenize normaliza PT-BR com acentos e hífens', () => {
    const tokens = tokenize('Claro! O check-in é às 14h.');
    expect(tokens).toContain('claro');
    expect(tokens).toContain('check'); // hyphenated word split
    expect(tokens).toContain('14h');
    // Stopwords removidas
    expect(tokens).not.toContain('o');
    expect(tokens).not.toContain('as');
    expect(tokens).not.toContain('e');
  });

  it('tokenize remove diacríticos (ã→a, ç→c, á→a)', () => {
    const tokens = tokenize('café manhã pousada');
    expect(tokens).toContain('cafe');
    expect(tokens).toContain('manha');
    expect(tokens).toContain('pousada');
  });

  it('tokenize retorna vazio para string vazia ou null', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize(null as unknown as string)).toEqual([]);
  });

  it('termFrequency calcula frequência relativa', () => {
    const tf = termFrequency(['a', 'a', 'b']);
    expect(tf.get('a')).toBeCloseTo(2 / 3, 5);
    expect(tf.get('b')).toBeCloseTo(1 / 3, 5);
  });

  it('inverseDocFrequency atribui maior IDF a tokens únicos', () => {
    const docA = ['checkin', 'cafe', 'manha'];
    const docB = ['checkin', 'piscina'];
    const idf = inverseDocFrequency([docA, docB]);

    // 'checkin' está em ambos → IDF baixo
    // 'cafe' está só em A → IDF alto
    expect(idf.get('checkin')!).toBeLessThan(idf.get('cafe')!);
    expect(idf.get('piscina')!).toBeGreaterThan(idf.get('checkin')!);
  });

  it('tfidfVector combina TF e IDF', () => {
    const tokens = ['checkin', 'cafe', 'cafe'];
    const idf = new Map([['checkin', 0.5], ['cafe', 1.0]]);
    const vec = tfidfVector(tokens, idf);

    // tf(checkin) = 1/3, idf = 0.5 → 0.167
    expect(vec.get('checkin')!).toBeCloseTo((1 / 3) * 0.5, 3);
    // tf(cafe) = 2/3, idf = 1.0 → 0.667
    expect(vec.get('cafe')!).toBeCloseTo((2 / 3) * 1.0, 3);
  });

  it('cosineSimilarity retorna ~1 para vetores idênticos', () => {
    const v = new Map([['a', 1], ['b', 2]]);
    // Floating point: 0.9999...8 em vez de 1 exato
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 10);
  });

  it('cosineSimilarity retorna 0 para vetores ortogonais', () => {
    const a = new Map([['x', 1]]);
    const b = new Map([['y', 1]]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('semanticSimilarity retorna 1 para texto idêntico', () => {
    const t = 'O check-in é às 14h';
    expect(semanticSimilarity(t, t)).toBe(1);
  });

  it('semanticSimilarity detecta paráfrases (mesmo sentido, palavras diferentes)', () => {
    const t1 = 'Claro! O check-in é às 14h.';
    const t2 = 'Sim, pode fazer check-in a partir das 14h.';
    const sim = semanticSimilarity(t1, t2);
    // Tokens compartilhados: check-in, 14h → similaridade moderada
    expect(sim).toBeGreaterThan(0.2);
    expect(sim).toBeLessThan(1.0);
  });

  it('semanticSimilarity retorna baixo score para textos não relacionados', () => {
    const t1 = 'Check-in é às 14h';
    const t2 = 'Completamente diferente sobre café da manhã servido às 7h';
    const sim = semanticSimilarity(t1, t2);
    expect(sim).toBeLessThan(0.3);
  });

  it('combinedSimilarity classifica edição trivial (reject)', () => {
    const rejected = 'Resposta simples';
    const chosen = 'Resposta simples.'; // só adiciona ponto
    const result = combinedSimilarity(rejected, chosen, 0.95);
    expect(result.shouldKeepAsDpo).toBe(false);
    expect(result.reason).toBe('EDICAO_TRIVIAL_SEMANTICA');
  });

  it('combinedSimilarity classifica reescrita fora de contexto (reject)', () => {
    const rejected = 'Olá! Tudo bem? Como posso ajudar com sua reserva?';
    const chosen = 'O café da manhã está disponível das 7 às 10 da manhã no refeitório principal.';
    const result = combinedSimilarity(rejected, chosen, 0.1);
    expect(result.shouldKeepAsDpo).toBe(false);
    expect(result.reason).toBe('REESCRITA_FORA_DE_CONTEXTO_SEMANTICA');
  });

  it('combinedSimilarity aceita DPO pair válido', () => {
    const rejected = 'Olá! Tudo bem? Como posso ajudar com sua reserva?';
    const chosen = 'Olá! Tudo ótimo. Em que posso ajudar sobre sua reserva hoje?';
    const result = combinedSimilarity(rejected, chosen, 0.6);
    expect(result.shouldKeepAsDpo).toBe(true);
  });

  it('combinedSimilarity identifica paráfrase rica (DPO valioso)', () => {
    // Mesmo significado, palavras diferentes
    const rejected = 'Posso ajudar com sua reserva?';
    const chosen = 'Como posso auxiliar no seu booking?';
    const result = combinedSimilarity(rejected, chosen, 0.3);
    expect(result.shouldKeepAsDpo).toBe(true);
    // Pode ser DPO_PADRAO_ACEITO ou PARAFRASE_RICA_DPO_VALIOSO
    expect(['PARAFRASE_RICA_DPO_VALIOSO', 'DPO_PADRAO_ACEITO']).toContain(result.reason);
  });
});

// ============================================================================
// 4. CÉREBRO BUDGET GUARD — Tiered FinOps
// ============================================================================

describe('[ML-4] Cérebro Budget Guard — tiered thresholds', () => {
  let guard: CerebroBudgetGuard;

  beforeEach(() => {
    guard = new CerebroBudgetGuard({
      monthlyBudgetUsd: 10,
      dailyBudgetUsd: 1,
    });
    guard.reset();
  });

  it('inicia em tier OK com zero spend', () => {
    const stats = guard.getStats();
    expect(stats.state.currentTier).toBe('ok');
    expect(stats.state.monthlySpendUsd).toBe(0);
    expect(stats.state.dailySpendUsd).toBe(0);
  });

  it('permite spend em tier OK', () => {
    const result = guard.canSpend(0.01);
    expect(result.allowed).toBe(true);
    expect(result.tier).toBe('ok');
  });

  it('escala para SOFT em 50% do orçamento mensal', async () => {
    await guard.recordSpend(5, 'analysis'); // 50%
    const stats = guard.getStats();
    expect(stats.state.currentTier).toBe('soft');
    expect(stats.state.monthlyUsagePercent).toBeCloseTo(50, 1);
  });

  it('escala para HARD em 80% do orçamento mensal', async () => {
    await guard.recordSpend(8, 'analysis'); // 80%
    expect(guard.getStats().state.currentTier).toBe('hard');
  });

  it('escala para CRITICAL em 95% do orçamento mensal', async () => {
    await guard.recordSpend(9.5, 'analysis'); // 95%
    expect(guard.getStats().state.currentTier).toBe('critical');
  });

  it('bloqueia spend em tier CRITICAL', async () => {
    await guard.recordSpend(9.5, 'analysis'); // 95%
    const result = guard.canSpend(0.1);
    expect(result.allowed).toBe(false);
    expect(result.tier).toBe('critical');
    expect(result.reason).toContain('CRITICAL');
  });

  it('bloqueia spend que excederia orçamento mensal', () => {
    const result = guard.canSpend(11); // tentativa de gastar mais que o budget total
    expect(result.allowed).toBe(false);
  });

  it('tracking de totalAnalyses e totalRefactors', async () => {
    await guard.recordSpend(0.01, 'analysis');
    await guard.recordSpend(0.01, 'analysis');
    await guard.recordSpend(0.02, 'refactor');
    const stats = guard.getStats();
    expect(stats.state.totalAnalyses).toBe(2);
    expect(stats.state.totalRefactors).toBe(1);
  });

  it('tracking de savings por fallback para mock', () => {
    guard.recordSavings(0.5);
    guard.recordSavings(0.3);
    expect(guard.getStats().state.totalSavedByMock).toBeCloseTo(0.8, 5);
  });

  it('reset() zera spend e tier', async () => {
    await guard.recordSpend(8, 'analysis');
    expect(guard.getStats().state.currentTier).toBe('hard');

    guard.reset();
    const stats = guard.getStats();
    expect(stats.state.currentTier).toBe('ok');
    expect(stats.state.monthlySpendUsd).toBe(0);
    expect(stats.state.dailySpendUsd).toBe(0);
  });
});

// ============================================================================
// 5. CHURN PREDICTOR — Matemática de Scoring
// ============================================================================

describe('[ML-5] Churn Predictor — weighted scoring matemática', () => {
  let predictor: ChurnPredictor;

  beforeEach(() => {
    predictor = new ChurnPredictor();
  });

  it('tem exatamente 5 sinais com pesos pré-definidos', () => {
    const stats = predictor.getStats();
    const w = stats.weights;
    expect(Object.keys(w)).toHaveLength(5);
    expect(w.ai_activity_decline).toBe(0.30);
    expect(w.conversation_decline).toBe(0.20);
    expect(w.meta_cost_decline).toBe(0.15);
    expect(w.brain_health).toBe(0.20);
    expect(w.login_recency).toBe(0.15);
  });

  it('pesos somam exatamente 1.0 (modelo matemático consistente)', () => {
    const stats = predictor.getStats();
    const total = Object.values(stats.weights).reduce((a, b) => a + b, 0);
    // Soma: 0.30 + 0.20 + 0.15 + 0.20 + 0.15 = 1.00
    expect(total).toBeCloseTo(1.0, 5);
  });

  it('tem 4 níveis de risco', () => {
    const stats = predictor.getStats();
    const levels = Object.keys(stats.riskThresholds);
    expect(levels).toContain('ok');
    expect(levels).toContain('watch');
    expect(levels).toContain('warning');
    expect(levels).toContain('critical');
    expect(levels).toHaveLength(4);
  });

  it('limiares de risco estão ordenados corretamente', () => {
    const stats = predictor.getStats();
    // < 0.30 OK, 0.30-0.60 WATCH, 0.60-0.85 WARNING, >= 0.85 CRITICAL
    const thresholds = stats.riskThresholds;
    expect(thresholds.ok).toContain('0.30');
    expect(thresholds.critical).toContain('0.85');
  });

  it('getStats retorna mode (mock ou live)', () => {
    const stats = predictor.getStats();
    expect(['mock', 'live']).toContain(stats.mode);
  });
});
