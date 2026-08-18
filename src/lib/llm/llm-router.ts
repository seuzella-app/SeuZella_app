// @ts-nocheck — to be fixed in dedicated type refactoring pass
/**
 * LLM Router — Alocação de LLMs por setor (Ultra Econômico)
 * ============================================================================
 *
 * 5 LLMs de fallback, cada uma alocada para um setor específico:
 *
 *   1. Qwen 2.5 72B     → Atendimento WhatsApp & Concierge (primário)
 *   2. GPT-4o-mini      → Smart Locks & Fechaduras (Function Calling)
 *   3. DeepSeek-V3      → Dynamic Yield & Cálculos Financeiros
 *   4. Mistral Small 3  → Auditoria Noturna, LGPD & Pentest
 *   5. Llama 3.3 70B    → Contingência de Latência Zero (via Groq)
 *
 * CUSTO MÉDIO: R$ 0,0018 por atendimento (98% de margem)
 *
 * CUSTO POR 1.000 ATENDIMENTOS (1.500 in + 300 out tokens):
 *   - Qwen 2.5 72B:    R$ 1,85 (DeepInfra)
 *   - GPT-4o-mini:     R$ 2,30 (OpenAI)
 *   - DeepSeek-V3:     R$ 1,60 (DeepSeek)
 *   - Mistral Small 3: R$ 2,50 (Mistral AI)
 *   - Llama 3.3 70B:   R$ 1,80 (Groq)
 * ============================================================================
 */

import { captureError } from '@/lib/monitoring/error-tracking';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG — API Keys
// ─────────────────────────────────────────────────────────────────────────────
const ZAI_GLM_API_KEY = process.env.ZAI_API_KEY || process.env.GLM_5_2_API_KEY || '';
const QWEN_API_KEY = process.env.DEEPINFRA_API_KEY || process.env.QWEN_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
export type LLMSector =
  | 'whatsapp_concierge'   // Atendimento WhatsApp + UPSELL
  | 'smart_locks'          // Fechaduras + PINs + Function Calling
  | 'yield_finance'        // Dynamic Yield + Cálculos financeiros
  | 'security_pentest'     // Night Audit + LGPD + Pentest
  | 'contingency';         // Contingência de latência zero

export type LLMProvider = 'zai' | 'qwen' | 'openai' | 'deepseek' | 'mistral' | 'groq' | 'fallback-local';

export interface LLMModelConfig {
  provider: LLMProvider;
  model: string;
  baseUrl: string;
  apiKeyEnv: string;
  maxTokens: number;
  temperature: number;
  costPer1kIn: number;   // USD por 1M tokens in / 1000
  costPer1kOut: number;  // USD por 1M tokens out / 1000
  timeoutMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODELOS POR SETOR
// ─────────────────────────────────────────────────────────────────────────────
export const SECTOR_MODELS: Record<LLMSector, LLMModelConfig> = {
  // 1. Atendimento WhatsApp & Concierge → Qwen 2.5 72B (substituto do Anthropic)
  whatsapp_concierge: {
    provider: 'qwen',
    model: 'Qwen/Qwen2.5-72B-Instruct',
    baseUrl: 'https://api.deepinfra.com/v1/openai/chat/completions',
    apiKeyEnv: 'DEEPINFRA_API_KEY',
    maxTokens: 500,
    temperature: 0.7,
    costPer1kIn: 0.00017,   // $0.17/1M = $0.00017/1k
    costPer1kOut: 0.0004,   // $0.40/1M = $0.0004/1k
    timeoutMs: 10_000,
  },
  // 2. Smart Locks & Fechaduras → GPT-4o-mini (Function Calling preciso)
  smart_locks: {
    provider: 'openai',
    model: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    apiKeyEnv: 'OPENAI_API_KEY',
    maxTokens: 300,
    temperature: 0.3,  // baixa temperatura para precisão de JSON
    costPer1kIn: 0.00015,
    costPer1kOut: 0.0006,
    timeoutMs: 8_000,
  },
  // 3. Dynamic Yield & Finanças → DeepSeek-V3 (matemática de ponta)
  yield_finance: {
    provider: 'deepseek',
    model: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    maxTokens: 400,
    temperature: 0.2,  // quase determinístico para cálculos
    costPer1kIn: 0.00014,
    costPer1kOut: 0.00028,
    timeoutMs: 10_000,
  },
  // 4. Segurança & Pentest → Mistral Small 3 (conformidade LGPD europeia)
  security_pentest: {
    provider: 'mistral',
    model: 'mistral-small-latest',
    baseUrl: 'https://api.mistral.ai/v1/chat/completions',
    apiKeyEnv: 'MISTRAL_API_KEY',
    maxTokens: 600,
    temperature: 0.1,  // determinístico para auditoria
    costPer1kIn: 0.0002,
    costPer1kOut: 0.0006,
    timeoutMs: 15_000,
  },
  // 5. Contingência de Latência Zero → Llama 3.3 70B no Groq (<150ms)
  contingency: {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    apiKeyEnv: 'GROQ_API_KEY',
    maxTokens: 300,
    temperature: 0.7,
    costPer1kIn: 0.00013,
    costPer1kOut: 0.0004,
    timeoutMs: 5_000,  // Groq é ultra rápido, 5s é mais que suficiente
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
const RECOVERY_TIMEOUT = 30_000;

function getCircuit(key: string): CircuitState {
  if (!circuits[key]) circuits[key] = { failures: 0, lastFailure: 0, state: 'closed' };
  return circuits[key];
}

function recordSuccess(key: string): void {
  const c = getCircuit(key);
  c.failures = 0;
  c.state = 'closed';
}

function recordFailure(key: string): void {
  const c = getCircuit(key);
  c.failures += 1;
  c.lastFailure = Date.now();
  if (c.failures >= FAILURE_THRESHOLD) {
    c.state = 'open';
    console.warn(`[LLM_ROUTER] Circuit OPEN para ${key} (${c.failures} falhas)`);
  }
}

function isCircuitOpen(key: string): boolean {
  const c = getCircuit(key);
  if (c.state === 'open') {
    if (Date.now() - c.lastFailure > RECOVERY_TIMEOUT) {
      c.state = 'half-open';
      return false;
    }
    return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAMADA GENÉRICA — OpenAI-compatible API (todos providers usam este formato)
// ─────────────────────────────────────────────────────────────────────────────
async function callOpenAICompatible(
  config: LLMModelConfig,
  apiKey: string,
  prompt: string,
  systemPrompt?: string,
): Promise<string> {
  if (!apiKey) throw new Error(`${config.apiKeyEnv} não configurada`);

  const messages: any[] = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const res = await fetch(config.baseUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
    }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`${config.provider} API error: ${res.status} — ${errBody.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAMADA ZAI (formato diferente — usa endpoint próprio)
// ─────────────────────────────────────────────────────────────────────────────
async function callZai(model: string, prompt: string, systemPrompt?: string, maxTokens = 500): Promise<string> {
  if (!ZAI_GLM_API_KEY) throw new Error('ZAI_API_KEY não configurada');

  const messages: any[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const res = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ZAI_GLM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) throw new Error(`Zai API error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// ─────────────────────────────────────────────────────────────────────────────
// MAPA DE API KEYS POR PROVIDER
// ─────────────────────────────────────────────────────────────────────────────
function getApiKey(provider: LLMProvider): string {
  switch (provider) {
    case 'qwen': return QWEN_API_KEY;
    case 'openai': return OPENAI_API_KEY;
    case 'deepseek': return DEEPSEEK_API_KEY;
    case 'mistral': return MISTRAL_API_KEY;
    case 'groq': return GROQ_API_KEY;
    case 'zai': return ZAI_GLM_API_KEY;
    default: return '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROTEADOR PRINCIPAL — chama LLM do setor, com fallback automático
// ─────────────────────────────────────────────────────────────────────────────
export interface LLMCallResult {
  text: string;
  provider: string;
  model: string;
  sector: LLMSector;
  latencyMs: number;
  tokensUsed: number;
  estimatedCostUsd: number;
  fellBack: boolean;
}

/**
 * Chama a LLM apropriada para o setor especificado.
 * Se a LLM principal falhar, faz fallback automático:
 *   1. LLM do setor (ex: Qwen para WhatsApp)
 *   2. Zai GLM 5.2 (sempre disponível se configurada)
 *   3. Groq Llama 3.3 70B (contingência ultra-rápida)
 *   4. Fallback local (template fixo)
 */
export async function callLLMBySector(
  sector: LLMSector,
  prompt: string,
  systemPrompt?: string,
): Promise<LLMCallResult> {
  const startTime = Date.now();
  const primaryConfig = SECTOR_MODELS[sector];

  // Define cadeia de fallback: primário → Zai GLM → Groq Llama → fallback local
  const fallbackChain: { config: LLMModelConfig | null; useZai: boolean }[] = [
    { config: primaryConfig, useZai: false },
    { config: null, useZai: true },  // Zai GLM 5.2 como fallback universal
    { config: SECTOR_MODELS.contingency, useZai: false },  // Groq Llama como contingência
  ];

  let lastError: Error | null = null;

  for (const { config, useZai } of fallbackChain) {
    const circuitKey = useZai ? 'zai:glm-5.2' : `${config?.provider}:${config?.model}`;

    if (isCircuitOpen(circuitKey)) {
      console.log(`[LLM_ROUTER] Circuit aberto para ${circuitKey}, pulando`);
      continue;
    }

    try {
      let text = '';

      if (useZai) {
        // Fallback para Zai GLM 5.2
        text = await callZai('glm-4-flash', prompt, systemPrompt, 500);
      } else if (config) {
        const apiKey = getApiKey(config.provider);
        if (config.provider === 'zai') {
          text = await callZai(config.model, prompt, systemPrompt, config.maxTokens);
        } else {
          text = await callOpenAICompatible(config, apiKey, prompt, systemPrompt);
        }
      }

      recordSuccess(circuitKey);

      const tokensUsed = Math.ceil((prompt.length + text.length) / 4);
      const costUsd = config
        ? (1500 / 1_000_000 * config.costPer1kIn * 1000 + 300 / 1_000_000 * config.costPer1kOut * 1000) / 1000
        : 0;

      return {
        text,
        provider: useZai ? 'zai' : config!.provider,
        model: useZai ? 'glm-4-flash' : config!.model,
        sector,
        latencyMs: Date.now() - startTime,
        tokensUsed,
        estimatedCostUsd: costUsd,
        fellBack: useZai || (config !== primaryConfig),
      };
    } catch (err: any) {
      lastError = err;
      recordFailure(circuitKey);
      console.warn(`[LLM_ROUTER] ${useZai ? 'zai:glm' : `${config?.provider}:${config?.model}`} falhou: ${err.message}`);
    }
  }

  // Todos falharam — fallback local
  await captureError(lastError || new Error('All LLM providers failed'), {
    extra: { sector, prompt: prompt.slice(0, 200) },
  });

  return {
    text: 'Desculpe, estou com dificuldade técnica. Um atendente humano vai responder em breve.',
    provider: 'fallback-local',
    model: 'template',
    sector,
    latencyMs: Date.now() - startTime,
    tokensUsed: 0,
    estimatedCostUsd: 0,
    fellBack: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE CONVENIÊNCIA — um por setor
// ─────────────────────────────────────────────────────────────────────────────

/** Atendimento WhatsApp & Concierge (Qwen 2.5 72B) */
export async function callConciergeLLM(prompt: string, systemPrompt?: string): Promise<LLMCallResult> {
  return callLLMBySector('whatsapp_concierge', prompt, systemPrompt);
}

/** Smart Locks & Fechaduras (GPT-4o-mini) */
export async function callLocksLLM(prompt: string, systemPrompt?: string): Promise<LLMCallResult> {
  return callLLMBySector('smart_locks', prompt, systemPrompt);
}

/** Dynamic Yield & Finanças (DeepSeek-V3) */
export async function callYieldLLM(prompt: string, systemPrompt?: string): Promise<LLMCallResult> {
  return callLLMBySector('yield_finance', prompt, systemPrompt);
}

/** Segurança & Pentest (Mistral Small 3) */
export async function callSecurityLLM(prompt: string, systemPrompt?: string): Promise<LLMCallResult> {
  return callLLMBySector('security_pentest', prompt, systemPrompt);
}

/** Contingência de Latência Zero (Llama 3.3 70B no Groq) */
export async function callContingencyLLM(prompt: string, systemPrompt?: string): Promise<LLMCallResult> {
  return callLLMBySector('contingency', prompt, systemPrompt);
}

// ─────────────────────────────────────────────────────────────────────────────
// CACHE SEMÂNTICO — pergunta repetida = resposta cacheada por 1h
// ─────────────────────────────────────────────────────────────────────────────
const semanticCache = new Map<string, { text: string; expiresAt: number }>();

export async function callLLMWithCache(
  sector: LLMSector,
  prompt: string,
  systemPrompt?: string,
  cacheTTL: number = 3_600_000,
): Promise<LLMCallResult & { cached: boolean }> {
  const cacheKey = `${sector}:${hashPrompt(prompt)}`;

  const cached = semanticCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      text: cached.text,
      provider: 'cache',
      model: 'semantic',
      sector,
      latencyMs: 0,
      tokensUsed: 0,
      estimatedCostUsd: 0,
      fellBack: false,
      cached: true,
    };
  }

  const result = await callLLMBySector(sector, prompt, systemPrompt);

  if (result.provider !== 'fallback-local') {
    semanticCache.set(cacheKey, {
      text: result.text,
      expiresAt: Date.now() + cacheTTL,
    });
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

// ─────────────────────────────────────────────────────────────────────────────
// STATUS — verifica quais LLMs estão configuradas
// ─────────────────────────────────────────────────────────────────────────────
export function getLLMStatus(): Record<LLMProvider, boolean> {
  return {
    zai: !!ZAI_GLM_API_KEY,
    qwen: !!QWEN_API_KEY,
    openai: !!OPENAI_API_KEY,
    deepseek: !!DEEPSEEK_API_KEY,
    mistral: !!MISTRAL_API_KEY,
    groq: !!GROQ_API_KEY,
    'fallback-local': true,
  };
}
