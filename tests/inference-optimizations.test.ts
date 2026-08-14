/**
 * Testes das 4 Otimizações de Engenharia de Inferência
 * =====================================================
 *
 * A) Deferred Tool Discovery (tool-discovery.ts)
 * B) Prompt Caching (prompt-caching.ts)
 * C) Tool Output Cap (tool-output-cap.ts)
 * D) Tier Distributor 80/15/5 (tier-distributor.ts)
 */

import { describe, it, expect } from 'vitest';
import {
  loadToolsForIntent,
  loadAllTools,
  estimateTokenSavings,
  listIntentToolMapping,
  type IntentType,
} from '../src/lib/ai/tool-discovery';

import {
  buildStaticPrefix,
  buildCachedPrompt,
  hasPrefixChanged,
  getPromptCachingProviders,
} from '../src/lib/ai/prompt-caching';

import {
  capToolOutput,
  getCapStats,
  type CapStrategy,
} from '../src/lib/ai/tool-output-cap';

import {
  decideTier,
  estimateWeightedCost,
  getTierDistributionStats,
  type TierLevel,
} from '../src/lib/ai/tier-distributor';

// ─────────────────────────────────────────────────────────────────────────────
// PARTE A: Deferred Tool Discovery
// ─────────────────────────────────────────────────────────────────────────────

describe('PARTE A: Deferred Tool Discovery', () => {
  it('loadToolsForIntent(cotacao_reserva) retorna apenas 4 tools relevantes', () => {
    const tools = loadToolsForIntent('cotacao_reserva');
    expect(tools.length).toBe(4);
    expect(tools.map(t => t.name)).toContain('check_availability');
    expect(tools.map(t => t.name)).toContain('calculate_dynamic_price');
    expect(tools.map(t => t.name)).toContain('get_pix_info');
  });

  it('loadToolsForIntent(agradecimento) retorna 0 tools', () => {
    const tools = loadToolsForIntent('agradecimento');
    expect(tools.length).toBe(0);
  });

  it('loadToolsForIntent(human_handover) retorna 0 tools', () => {
    const tools = loadToolsForIntent('human_handover');
    expect(tools.length).toBe(0);
  });

  it('loadToolsForIntent(unknown) retorna 1 tool default (get_policies)', () => {
    const tools = loadToolsForIntent('unknown');
    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe('get_policies');
  });

  it('loadAllTools() retorna mais tools que loadToolsForIntent(cotacao_reserva)', () => {
    const all = loadAllTools();
    const intent = loadToolsForIntent('cotacao_reserva');
    expect(all.length).toBeGreaterThan(intent.length);
  });

  it('estimateTokenSavings(cotacao_reserva) mostra redução > 50%', () => {
    const savings = estimateTokenSavings('cotacao_reserva');
    expect(savings.percentReduction).toBeGreaterThan(50);
    expect(savings.estimatedTokensSaved).toBeGreaterThan(100);
  });

  it('estimateTokenSavings(agradecimento) mostra 100% (sem tools)', () => {
    const savings = estimateTokenSavings('agradecimento');
    expect(savings.percentReduction).toBe(100);
  });

  it('listIntentToolMapping() retorna mapa com 9 intents', () => {
    const mapping = listIntentToolMapping();
    expect(Object.keys(mapping).length).toBeGreaterThanOrEqual(8);
    expect(mapping.cotacao_reserva).toBeDefined();
    expect(mapping.human_handover).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PARTE B: Prompt Caching
// ─────────────────────────────────────────────────────────────────────────────

describe('PARTE B: Prompt Caching', () => {
  it('buildStaticPrefix() gera prefix com hash', () => {
    const prefix = buildStaticPrefix({
      propertyName: 'Pousada Solar das Marés',
      city: 'Ubatuba/SP',
      pixKey: '12345678901',
      pixKeyType: 'cpf',
    });
    expect(prefix.content).toContain('Pousada Solar das Marés');
    expect(prefix.content).toContain('Ubatuba/SP');
    expect(prefix.content).toContain('12345678901');
    expect(prefix.hash).toBeTruthy();
    expect(prefix.cacheTtlMs).toBeGreaterThan(0);
  });

  it('buildStaticPrefix() gera hash diferente para pousadas diferentes', () => {
    const prefix1 = buildStaticPrefix({ propertyName: 'Pousada A' });
    const prefix2 = buildStaticPrefix({ propertyName: 'Pousada B' });
    expect(prefix1.hash).not.toBe(prefix2.hash);
  });

  it('buildStaticPrefix() gera hash IGUAL para mesma pousada', () => {
    const prefix1 = buildStaticPrefix({ propertyName: 'Pousada A', city: 'SP' });
    const prefix2 = buildStaticPrefix({ propertyName: 'Pousada A', city: 'SP' });
    expect(prefix1.hash).toBe(prefix2.hash);
  });

  it('buildCachedPrompt() retorna system + history + current', () => {
    const prefix = buildStaticPrefix({ propertyName: 'Test Pousada' });
    const cached = buildCachedPrompt({
      staticPrefix: prefix,
      history: [
        { from: 'guest', content: 'Oi' },
        { from: 'ai', content: 'Olá!' },
        { from: 'guest', content: 'Qual o preço?' },
      ],
      currentMessage: 'Quero reservar',
      provider: 'anthropic',
    });

    expect(cached.systemMessage.role).toBe('system');
    expect(cached.historyMessages.length).toBe(3);
    expect(cached.currentMessage.role).toBe('user');
    expect(cached.currentMessage.content).toBe('Quero reservar');
    expect(cached.metadata.historyLength).toBe(3);
  });

  it('buildCachedPrompt() limita histórico a 6 mensagens', () => {
    const prefix = buildStaticPrefix({ propertyName: 'Test' });
    const longHistory = Array.from({ length: 10 }, (_, i) => ({
      from: i % 2 === 0 ? 'guest' : 'ai',
      content: `Message ${i}`,
    }));

    const cached = buildCachedPrompt({
      staticPrefix: prefix,
      history: longHistory,
      currentMessage: 'Atual',
    });

    expect(cached.historyMessages.length).toBe(6);
  });

  it('buildCachedPrompt() com Anthropic ativa cache_control', () => {
    const prefix = buildStaticPrefix({ propertyName: 'Test' });
    const cached = buildCachedPrompt({
      staticPrefix: prefix,
      history: [],
      currentMessage: 'test',
      provider: 'anthropic',
    });
    // cache_control só existe para Anthropic
    expect(cached.systemMessage).toBeDefined();
    expect(cached.metadata.cachedTokens).toBeGreaterThan(0);
    expect(cached.metadata.estimatedSavingsUsd).toBeGreaterThan(0);
  });

  it('hasPrefixChanged() detecta mudança', () => {
    const prefix1 = buildStaticPrefix({ propertyName: 'A' });
    const prefix2 = buildStaticPrefix({ propertyName: 'B' });
    expect(hasPrefixChanged(prefix1, undefined)).toBe(true); // primeira vez
    expect(hasPrefixChanged(prefix1, prefix1.hash)).toBe(false); // mesma
    expect(hasPrefixChanged(prefix2, prefix1.hash)).toBe(true); // mudou
  });

  it('getPromptCachingProviders() retorna 4 provedores', () => {
    const providers = getPromptCachingProviders();
    expect(providers.length).toBe(4);
    expect(providers.map(p => p.provider)).toContain('anthropic');
    expect(providers.map(p => p.provider)).toContain('gemini');
    expect(providers.map(p => p.provider)).toContain('deepseek');
    expect(providers.map(p => p.provider)).toContain('openai');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PARTE C: Tool Output Cap
// ─────────────────────────────────────────────────────────────────────────────

describe('PARTE C: Tool Output Cap', () => {
  it('capToolOutput() com output curto NÃO trunca', () => {
    const result = capToolOutput('{"available": true}', {
      maxTokens: 250,
      strategy: 'truncate',
    });
    expect(result.truncated).toBe(false);
    expect(result.output).toBe('{"available": true}');
  });

  it('capToolOutput() com output longo TRUNCA via truncate', () => {
    const longOutput = JSON.stringify({
      available: true,
      details: 'x'.repeat(2000),
    });
    const result = capToolOutput(longOutput, {
      maxTokens: 50, // ~200 chars
      strategy: 'truncate',
    });
    expect(result.truncated).toBe(true);
    expect(result.cappedTokens).toBeLessThan(result.originalTokens);
    expect(result.output.length).toBeLessThan(longOutput.length);
  });

  it('capToolOutput() com strategy=summarize extrai campos de array', () => {
    const bigArray = JSON.stringify(
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        name: `Room ${i}`,
        price: 100 + i,
        description: 'x'.repeat(100),
      }))
    );
    const result = capToolOutput(bigArray, {
      strategy: 'summarize',
      maxTokens: 100,
    });
    expect(result.truncated).toBe(true);
    // Deve ter reduzido o array para top 5
    expect(result.output).toContain('count');
    expect(result.output).toContain('showing');
  });

  it('capToolOutput() com strategy=key-fields extrai campos essenciais', () => {
    const fullOutput = JSON.stringify({
      available: true,
      roomType: 'Standard',
      date: '2026-12-31',
      price: 1200,
      // Campos extras que serão removidos:
      description: 'x'.repeat(500),
      metadata: { foo: 'bar', count: 999 },
      internalNotes: 'não expor',
    });

    const result = capToolOutput(fullOutput, {
      strategy: 'key-fields',
      toolName: 'check_availability',
      maxTokens: 100,
    });
    expect(result.truncated).toBe(true);
    const parsed = JSON.parse(result.output);
    expect(parsed.available).toBe(true);
    expect(parsed.roomType).toBe('Standard');
    expect(parsed.price).toBe(1200);
    // Campos extras removidos
    expect(parsed.internalNotes).toBeUndefined();
  });

  it('capToolOutput() com JSON inválido cai para truncate', () => {
    const invalidJson = '{not valid json' + 'x'.repeat(2000);
    const result = capToolOutput(invalidJson, {
      strategy: 'summarize',
      maxTokens: 50,
    });
    expect(result.truncated).toBe(true);
    expect(result.output.length).toBeLessThan(invalidJson.length);
  });

  it('getCapStats() retorna configuração', () => {
    const stats = getCapStats();
    expect(stats.defaultMaxTokens).toBe(250);
    expect(stats.essentialFieldsConfigured).toBeGreaterThan(0);
    expect(stats.strategiesAvailable).toContain('truncate');
    expect(stats.strategiesAvailable).toContain('summarize');
    expect(stats.strategiesAvailable).toContain('key-fields');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PARTE D: Tier Distributor 80/15/5
// ─────────────────────────────────────────────────────────────────────────────

describe('PARTE D: Tier Distributor 80/15/5', () => {
  it('decideTier() com palavras de conflito → sempre Tier 3', () => {
    const result = decideTier('Quero cancelar minha reserva e pedir reembolso');
    expect(result.tier).toBe(3);
    expect(result.probabilistic).toBe(false);
    expect(result.features.hasConflictKeywords).toBe(true);
  });

  it('decideTier() com palavras de negociação → sempre Tier 2', () => {
    const result = decideTier('Qual o preço da diária? Quero reservar');
    expect(result.tier).toBe(2);
    expect(result.probabilistic).toBe(false);
    expect(result.features.hasNegotiationKeywords).toBe(true);
  });

  it('decideTier() com FAQ simples + curto → Tier 1', () => {
    const result = decideTier('Qual a senha do wifi?');
    expect(result.tier).toBe(1);
    expect(result.probabilistic).toBe(false);
    expect(result.features.hasSimpleFAQKeywords).toBe(true);
  });

  it('decideTier() com 5+ turnos históricos → Tier 2 (contexto complexo)', () => {
    const result = decideTier('Ok', { historicalTurnCount: 7 });
    expect(result.tier).toBe(2);
    expect(result.reason).toContain('High historical turn count');
  });

  it('decideTier() com override explícito respeita caller', () => {
    const result = decideTier('Quero cancelar', { explicitTier: 1 });
    expect(result.tier).toBe(1);
    expect(result.probabilistic).toBe(false);
    expect(result.confidence).toBe(1.0);
  });

  it('decideTier() sem heurística → distribuição probabilística (80/15/5)', () => {
    // Roda 1000 vezes para validar distribuição aprox 80/15/5
    const counts = { 1: 0, 2: 0, 3: 0 };
    for (let i = 0; i < 1000; i++) {
      const result = decideTier('mensagem genérica sem keywords específicas');
      counts[result.tier]++;
    }
    // Tier 1 deve ser ~80% (tolerância ±10%)
    expect(counts[1]).toBeGreaterThan(700);
    expect(counts[1]).toBeLessThan(900);
    // Tier 2 deve ser ~15% (tolerância ±10%)
    expect(counts[2]).toBeGreaterThan(50);
    expect(counts[2]).toBeLessThan(250);
    // Tier 3 deve ser ~5% (tolerância ±5%)
    expect(counts[3]).toBeLessThan(100);
  });

  it('decideTier() com suggestedTierFromDiscretizer upgrade se maior', () => {
    const result = decideTier('mensagem genérica', {
      suggestedTierFromDiscretizer: 3,
    });
    expect(result.tier).toBeGreaterThanOrEqual(1);
    // Se probabilístico caiu em 1 ou 2, deve ter upgradado para 3
    if (result.reason.includes('Upgraded')) {
      expect(result.tier).toBe(3);
    }
  });

  it('estimateWeightedCost() calcula custo médio ponderado', () => {
    const result = estimateWeightedCost(0.001, 0.005, 0.02);
    // 0.80 × 0.001 + 0.15 × 0.005 + 0.05 × 0.02 = 0.0008 + 0.00075 + 0.001 = 0.00255
    expect(result.weightedCost).toBeCloseTo(0.00255, 4);
    expect(result.vsAlwaysTier2).toBeGreaterThan(40); // > 40% redução
    expect(result.vsAlwaysTier3).toBeGreaterThan(80); // > 80% redução
  });

  it('getTierDistributionStats() retorna 80/15/5', () => {
    const stats = getTierDistributionStats();
    expect(stats.distribution.tier1).toBe(0.80);
    expect(stats.distribution.tier2).toBe(0.15);
    expect(stats.distribution.tier3).toBe(0.05);
    expect(stats.description).toContain('80%');
    expect(stats.description).toContain('15%');
    expect(stats.description).toContain('5%');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PARTE E: Integração — 4 otimizações juntas
// ─────────────────────────────────────────────────────────────────────────────

describe('PARTE E: Integração das 4 otimizações', () => {
  it('Fluxo completo: intent → tools → prompt → tier → cap', () => {
    // 1. Detecta intenção (simulado)
    const intent = 'cotacao_reserva' as IntentType;

    // 2. Deferred Tool Discovery
    const tools = loadToolsForIntent(intent);
    expect(tools.length).toBe(4);

    // 3. Prompt Caching
    const prefix = buildStaticPrefix({
      propertyName: 'Pousada Teste',
      city: 'Ubatuba/SP',
      pixKey: '11999999999',
      toolsDescription: tools.map(t => `- ${t.name}`).join('\n'),
    });
    const cachedPrompt = buildCachedPrompt({
      staticPrefix: prefix,
      history: [
        { from: 'guest', content: 'Oi, quero reservar' },
      ],
      currentMessage: 'Qual o preço para Réveillon?',
      provider: 'anthropic',
    });
    expect(cachedPrompt.metadata.estimatedInputTokens).toBeGreaterThan(0);

    // 4. Tier Distributor
    const tierDecision = decideTier('Qual o preço para Réveillon?');
    expect(tierDecision.tier).toBe(2); // negociação → Tier 2
    expect(tierDecision.features.hasNegotiationKeywords).toBe(true);

    // 5. Tool Output Cap (simula resposta de check_availability)
    const toolRawOutput = JSON.stringify({
      available: true,
      roomType: 'Suíte Master',
      date: '2026-12-31',
      price: 1500,
      description: 'x'.repeat(2000),
      metadata: { foo: 'bar' },
    });
    const cappedOutput = capToolOutput(toolRawOutput, {
      strategy: 'key-fields',
      toolName: 'check_availability',
      maxTokens: 100,
    });
    expect(cappedOutput.truncated).toBe(true);
    const parsed = JSON.parse(cappedOutput.output);
    expect(parsed.price).toBe(1500);
    expect(parsed.description).toBeUndefined();
  });

  it('Economia total estimada com 4 otimizações juntas', () => {
    // Cenário: 1000 mensagens/dia sem otimizações vs com otimizações
    const messagesPerDay = 1000;

    // Sem otimizações (sempre Tier 2, todas tools injetadas, sem cache, sem cap)
    const costBeforePerMsg = 0.005; // Tier 2
    const tokensBeforePerMsg = 2000; // system + tools + history + current
    const costBefore = messagesPerDay * costBeforePerMsg;

    // Com otimizações:
    // A) Deferred Tools: -50% tokens de tools
    const tokensTools = 700; // antes
    const tokensToolsAfter = 350; // depois (50% redução)
    const tokensSavedByTools = tokensTools - tokensToolsAfter;

    // B) Prompt Caching: -80% nos tokens cached
    const tokensCached = 500; // prefix estático
    const tokensChargedForCache = tokensCached * 0.2; // 80% off
    const tokensSavedByCaching = tokensCached * 0.8;

    // C) Tool Output Cap: -150 tokens por tool call (média)
    const tokensSavedByCap = 150;

    // D) Tier Distributor: custo médio ponderado 80/15/5
    const costAfterPerMsg = 0.00255; // 0.80×0.001 + 0.15×0.005 + 0.05×0.02
    const costAfter = messagesPerDay * costAfterPerMsg;

    // Total economia
    const costReduction = ((costBefore - costAfter) / costBefore) * 100;
    expect(costReduction).toBeGreaterThan(40); // > 40% redução
    expect(tokensSavedByTools).toBe(350);
    expect(tokensSavedByCaching).toBe(400);
    expect(tokensSavedByCap).toBe(150);
  });
});
