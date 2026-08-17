// @ts-nocheck — to be fixed in dedicated type refactoring pass
/**
 * LLM Fallback Chain — GLM 5.2 → Gemini Flash → Gemini Pro com circuit breaker
 * ============================================================================
 *
 * Estratégia para otimizar custo de inferência:
 *   - 80% das mensagens são simples (saudação, cotação) → GLM 4 Flash (barato)
 *   - 15% são moderadas (objeções, contexto) → GLM 4 Plus (médio)
 *   - 5% são complexas (resolução de conflito) → Gemini 2.5 Flash (preciso)
 *
 * Circuit breaker: se um provider falhar 3x em 30s, fallback para próximo.
 *
 * Providers:
 *   1. Zai GLM 5.2 / GLM 4 Flash (primário — mais barato)
 *   2. Google Gemini 2.5 Flash (fallback rápido — ultra barato)
 *   3. Google Gemini 2.5 Pro (fallback complexo — para casos difíceis)
 *
 * CUSTOS (por 1.000 mensagens com 1.500 in + 300 out tokens):
 *   - GLM 4 Flash:   ~R$ 0,50 (estimado)
 *   - Gemini Flash:  ~R$ 1,14 ($0.075 in / $0.30 out por 1M tokens)
 *   - Gemini Pro:    ~R$ 18,90 ($1.25 in / $5.00 out por 1M tokens)
 *
 * Anthropic REMOVIDO — muito caro (Claude 3.5 Sonnet: R$ 50,40/1k msgs)
 * ============================================================================
 */

import { captureError } from '@/lib/monitoring/error-tracking';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const ZAI_GLM_API_KEY = process.env.ZAI_API_KEY || process.env.GLM_5_2_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
export type ModelTier = 'fast' | 'balanced' | 'powerful';

export interface ModelConfig {
  provider: 'zai' | 'gemini' | 'fallback-local';
  model: string;
  tier: ModelTier;
  maxTokens: number;
  temperature: number;
  estimatedCostPer1k: number;  // USD por 1k tokens
}

export const MODELS: Record<ModelTier, ModelConfig> = {
  fast: {
    provider: 'zai',
    model: 'glm-4-flash',
    tier: 'fast',
    maxTokens: 200,
    temperature: 0.7,
    estimatedCostPer1k: 0.0001,
  },
  balanced: {
    provider: 'zai',
    model: 'glm-4-plus',
    tier: 'balanced',
    maxTokens: 500,
    temperature: 0.7,
    estimatedCostPer1k: 0.0005,
  },
  powerful: {
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    tier: 'powerful',
    maxTokens: 1000,
    temperature: 0.7,
    estimatedCostPer1k: 0.000375,  // $0.075 in + $0.30 out = $0.375 per 1M → $0.000375 per 1k
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CIRCUIT BREAKER — abre se 3 falhas em 30s
// ─────────────────────────────────────────────────────────────────────────────
interface CircuitState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

const circuits: Record<string, CircuitState> = {};
const FAILURE_THRESHOLD = 3;
const RECOVERY_TIMEOUT = 30_000;  // 30s

function getCircuit(key: string): CircuitState {
  if (!circuits[key]) {
    circuits[key] = { failures: 0, lastFailure: 0, state: 'closed' };
  }
  return circuits[key];
}

function recordSuccess(key: string): void {
  const circuit = getCircuit(key);
  circuit.failures = 0;
  circuit.state = 'closed';
}

function recordFailure(key: string): void {
  const circuit = getCircuit(key);
  circuit.failures += 1;
  circuit.lastFailure = Date.now();
  if (circuit.failures >= FAILURE_THRESHOLD) {
    circuit.state = 'open';
    console.warn(`[LLM_CHAIN] Circuit OPEN para ${key} (${circuit.failures} falhas)`);
  }
}

function isCircuitOpen(key: string): boolean {
  const circuit = getCircuit(key);
  if (circuit.state === 'open') {
    // Verifica se pode tentar half-open
    if (Date.now() - circuit.lastFailure > RECOVERY_TIMEOUT) {
      circuit.state = 'half-open';
      return false;
    }
    return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLASSIFICAÇÃO DE COMPLEXIDADE — decide qual modelo usar
// ─────────────────────────────────────────────────────────────────────────────
export function classifyComplexity(message: string): ModelTier {
  const lower = message.toLowerCase();
  const wordCount = message.split(/\s+/).length;

  // POWERFUL — conflito, negociação, contexto longo
  if (
    lower.includes('reclama') || lower.includes('processo') ||
    lower.includes('advogad') || lower.includes('direitos do consumidor') ||
    lower.includes('cancelamento') && lower.includes('reembolso') ||
    wordCount > 100
  ) {
    return 'powerful';
  }

  // BALANCED — objeções, contexto médio
  if (
    lower.includes('desconto') || lower.includes('mais barato') ||
    lower.includes('preocupad') || lower.includes('como funciona') ||
    lower.includes('explica') || wordCount > 30
  ) {
    return 'balanced';
  }

  // FAST — saudação, cotação simples, FAQ
  return 'fast';
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAMADAS AOS PROVIDERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Chama Zai GLM 5.2 / GLM 4 Flash via API REST.
 * Custo: ~R$ 0,50 por 1.000 mensagens
 */
async function callZai(model: string, prompt: string, options: any = {}): Promise<string> {
  if (!ZAI_GLM_API_KEY) throw new Error('ZAI_API_KEY não configurada');

  const res = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ZAI_GLM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options.maxTokens || 200,
      temperature: options.temperature || 0.7,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Zai API error: ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Chama Google Gemini via API REST (generateContent).
 * Suporta Gemini 2.5 Flash (barato) e Gemini 2.5 Pro (complexo).
 * Custo Flash: ~R$ 1,14 por 1.000 mensagens
 * Custo Pro:   ~R$ 18,90 por 1.000 mensagens
 */
async function callGemini(model: string, prompt: string, options: any = {}): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY não configurada');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }],
      }],
      generationConfig: {
        maxOutputTokens: options.maxTokens || 500,
        temperature: options.temperature || 0.7,
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Gemini API error: ${res.status} — ${errBody.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAIN PRINCIPAL — tenta em ordem, fallback automático
// ─────────────────────────────────────────────────────────────────────────────
export interface LLMCallResult {
  text: string;
  provider: string;
  model: string;
  tier: ModelTier;
  latencyMs: number;
  tokensUsed: number;
  estimatedCost: number;
}

export async function callLLMWithFallback(
  prompt: string,
  preferredTier?: ModelTier,
): Promise<LLMCallResult> {
  const tier = preferredTier || classifyComplexity(prompt);
  const startTime = Date.now();

  // Define chain baseado no tier — GLM primeiro, Gemini como fallback
  const chain: ModelConfig[] = [];
  if (tier === 'fast') {
    // FAST: GLM Flash → Gemini Flash → fallback local
    chain.push(MODELS.fast, { ...MODELS.powerful, model: 'gemini-2.5-flash' }, MODELS.balanced);
  } else if (tier === 'balanced') {
    // BALANCED: GLM Plus → Gemini Flash → Gemini Pro
    chain.push(MODELS.balanced, { ...MODELS.powerful, model: 'gemini-2.5-flash' }, MODELS.powerful);
  } else {
    // POWERFUL: Gemini Flash → Gemini Pro → GLM Plus
    chain.push({ ...MODELS.powerful, model: 'gemini-2.5-flash' }, MODELS.powerful, MODELS.balanced);
  }

  let lastError: Error | null = null;

  for (const model of chain) {
    const circuitKey = `${model.provider}:${model.model}`;

    if (isCircuitOpen(circuitKey)) {
      console.log(`[LLM_CHAIN] Circuit aberto para ${circuitKey}, pulando`);
      continue;
    }

    try {
      let text = '';
      if (model.provider === 'zai') {
        text = await callZai(model.model, prompt, model);
      } else if (model.provider === 'gemini') {
        text = await callGemini(model.model, prompt, model);
      }

      recordSuccess(circuitKey);

      const tokensUsed = Math.ceil((prompt.length + text.length) / 4);
      const estimatedCost = (tokensUsed / 1000) * model.estimatedCostPer1k;

      return {
        text,
        provider: model.provider,
        model: model.model,
        tier: model.tier,
        latencyMs: Date.now() - startTime,
        tokensUsed,
        estimatedCost,
      };
    } catch (err: any) {
      lastError = err;
      recordFailure(circuitKey);
      console.warn(`[LLM_CHAIN] ${model.provider}:${model.model} falhou: ${err.message}`);
    }
  }

  // Todos falharam — usa fallback local (template)
  await captureError(lastError || new Error('All LLM providers failed'), {
    extra: { tier, prompt: prompt.slice(0, 200) },
  });

  return {
    text: 'Desculpe, estou com dificuldade técnica. Um atendente humano vai responder em breve.',
    provider: 'fallback-local',
    model: 'template',
    tier,
    latencyMs: Date.now() - startTime,
    tokensUsed: 0,
    estimatedCost: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CACHE SEMÂNTICO — pergunta repetida = resposta cacheada por 1h
// ─────────────────────────────────────────────────────────────────────────────
const semanticCache = new Map<string, { text: string; expiresAt: number }>();

export async function callLLMWithCache(
  prompt: string,
  cacheTTL: number = 3_600_000,  // 1h default
): Promise<LLMCallResult & { cached: boolean }> {
  const cacheKey = hashPrompt(prompt);

  const cached = semanticCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      text: cached.text,
      provider: 'cache',
      model: 'semantic',
      tier: 'fast',
      latencyMs: 0,
      tokensUsed: 0,
      estimatedCost: 0,
      cached: true,
    };
  }

  const result = await callLLMWithFallback(prompt);

  // Cacheia apenas respostas bem-sucedidas
  if (result.provider !== 'fallback-local') {
    semanticCache.set(cacheKey, {
      text: result.text,
      expiresAt: Date.now() + cacheTTL,
    });

    // Limpa cache antigo (mantém últimos 1000)
    if (semanticCache.size > 1000) {
      const firstKey = semanticCache.keys().next().value;
      if (firstKey) semanticCache.delete(firstKey);
    }
  }

  return { ...result, cached: false };
}

function hashPrompt(prompt: string): string {
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    const char = prompt.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `prompt_${Math.abs(hash).toString(36)}`;
}
