/**
 * ZaosNeuroRouter — Cérebro ZÉLLA Cognitive Router
 *
 * The brain that decides which LLM provider to use for each request.
 * Implements:
 *   - Thompson Sampling with Beta posteriors (Marsaglia-Tsang + Johnk fallback)
 *   - Circuit Breaker pattern per provider
 *   - Budget Guard for cost control
 *   - Context Discretizer for fast bucket classification
 *   - Semantic Cache for response deduplication
 *   - Headroom Proxy for prompt compression
 *   - Session stickiness for conversation consistency
 *
 * Provider Tiers:
 *   Tier 1 (Budget):  Local Ollama, DeepSeek V4 Flash — simple queries, low cost
 *   Tier 2 (Mid):     Groq, Gemini Flash, Zhipu GLM 5.2, Moonshot Kimi K2.6 — standard operations
 *   Tier 3 (Premium): OpenRouter GPT-4o, Gemini Flash — complex reasoning
 *
 * Cost Knowledge Injection:
 *   The router uses `CostKnowledge` (cost-knowledge.ts) to embed real LLM pricing
 *   from Jun/2026. This biases Thompson Sampling toward the cheapest adequate model
 *   for each context bucket, reducing average cost by ~5x vs. uninformed routing.
 */

import { CircuitBreaker, CircuitState } from './circuit-breaker';
import { BudgetGuard, BudgetLevel, ProviderTier, tenantBudgetGuard } from './budget-guard';
import { ContextDiscretizer, CONTEXT_BUCKETS } from './context-discretizer';
import { SemanticCache, buildCacheKey } from './semantic-cache';
import { HeadroomClient } from './headroom-client';
import { CostKnowledge, costKnowledge } from './cost-knowledge';
import ZAI from 'z-ai-web-dev-sdk';
import {
  callOpenAICompatible,
  callAnthropic,
  callAnthropicWithTools,
  callGemini,
  callOpenAIWithTools,
  callGeminiWithTools,
  callGeminiWithAudio,
  mapWhatsappAudioToGemini,
  AdapterMessage,
  AdapterToolDef,
  AdapterToolResponse,
} from './llm-adapters';
import {
  persistBudgetGuard,
  loadBudgetGuard,
  persistRouterState,
  loadRouterState
} from './brain-persistence';

/* ================================================================== */
/* Type Definitions                                                     */
/* ================================================================== */

/** All 32 context buckets */
export type ContextBucket = (typeof CONTEXT_BUCKETS)[number];

/** LLM Request payload */
export interface LLMRequest {
  /** The user message / prompt */
  message: string;
  /** Optional session ID for stickiness */
  sessionId?: string;
  /** Override the suggested tier (1-3) */
  tier?: number;
  /** Force a specific provider ID */
  provider?: string;
  /** Maximum acceptable latency in ms */
  maxLatencyMs?: number;
  /** System prompt override */
  systemPrompt?: string;
  /** Optional additional parameters */
  params?: Record<string, unknown>;
  /** Skip cache for this request */
  noCache?: boolean;
  /** Enable JSON Mode for structured output */
  jsonMode?: boolean;
  /** Tenant ID for per-tenant budget isolation */
  tenantId?: string;
  /** Tenant plan type for budget calculation */
  tenantPlan?: string;
}

/** LLM Response from the router */
export interface LLMResponse {
  /** The generated response text */
  response: string;
  /** ID of the provider that handled the request */
  providerId: string;
  /** Display name of the provider */
  providerName: string;
  /** Provider tier used */
  tier: number;
  /** Context bucket classification */
  bucket: string;
  /** Classification confidence (0-1) */
  confidence: number;
  /** End-to-end latency in ms */
  latencyMs: number;
  /** Cost of this request in USD */
  costUsd: number;
  /** Number of input tokens (estimated) */
  inputTokens: number;
  /** Number of output tokens (estimated) */
  outputTokens: number;
  /** Whether the response came from cache */
  cacheHit: boolean;
  /** Compression ratio from Headroom (0 = none, >0 = compressed) */
  compressionRatio: number;
  /** Circuit breaker state of the selected provider */
  circuitState: string;
  /** Budget level at time of request */
  budgetLevel: string;
  /** Thompson Sampling theta value drawn for selected provider */
  thompsonTheta: number;
  /** All Thompson Sampling thetas (for observability) */
  allThetas: Record<string, number>;
  /** Whether this response was generated using a mock engine */
  isMock: boolean;
}

/** Tool call returned by the LLM */
export interface LLMToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** LLM Response with tool calls (from generateWithTools) */
export interface LLMToolResponse extends LLMResponse {
  /** Tool calls requested by the LLM (empty if final text response) */
  toolCalls: LLMToolCall[];
  /** 'stop' = final text, 'tool_calls' = LLM wants to invoke tools */
  finishReason: 'stop' | 'tool_calls';
}

/** Request payload for generateWithTools */
export interface LLMToolRequest {
  /** Multi-turn conversation messages */
  messages: AdapterMessage[];
  /** Tool definitions in OpenAI-compatible format */
  tools: AdapterToolDef[];
  /** Optional session ID for stickiness */
  sessionId?: string;
  /** Override the suggested tier (1-3) */
  tier?: number;
  /** Tenant ID for per-tenant budget isolation */
  tenantId?: string;
  /** Tenant plan type for budget calculation */
  tenantPlan?: string;
}

/** Provider registration configuration */
export interface ProviderRegistration {
  id: string;
  name: string;
  tier: number;
  /** Cost per 1K input tokens in USD */
  costPer1kInput: number;
  /** Cost per 1K output tokens in USD */
  costPer1kOutput: number;
  /** Average expected latency in ms */
  expectedLatencyMs: number;
  /** Maximum context window in tokens */
  maxContextTokens: number;
  /** Whether provider supports JSON mode */
  supportsJson: boolean;
  /** Whether provider supports tool/function calling */
  supportsTools: boolean;
  /** Base URL for API calls (null for local) */
  baseUrl: string | null;
  /** Initial alpha for Beta posterior (default: 1.0) */
  initialAlpha?: number;
  /** Initial beta for Beta posterior (default: 1.0) */
  initialBeta?: number;
}

/** Internal provider state tracked by the router */
export interface RouterProviderState {
  registration: ProviderRegistration;
  circuitBreaker: CircuitBreaker;
  alpha: number;  // Beta posterior α (successes + prior)
  beta: number;   // Beta posterior β (failures + prior)
  totalLatencyMs: number;
  totalRequests: number;
}

/* ================================================================== */
/* Default Provider Registry                                           */
/* ================================================================== */

const DEFAULT_PROVIDERS: ProviderRegistration[] = [
  {
    id: 'ollama-llama3',
    name: 'Ollama Llama 3.1 8B (Local)',
    tier: 1,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    expectedLatencyMs: 120,
    maxContextTokens: 8192,
    supportsJson: true,
    supportsTools: false,
    baseUrl: null,
    initialAlpha: 3.0,
    initialBeta: 1.0,
  },
  {
    id: 'ollama-gemma3',
    name: 'Ollama Gemma 3 27B (Local)',
    tier: 1,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    expectedLatencyMs: 200,
    maxContextTokens: 8192,
    supportsJson: true,
    supportsTools: false,
    baseUrl: null,
    initialAlpha: 2.0,
    initialBeta: 1.0,
  },
  {
    id: 'groq-llama3-70b',
    name: 'Groq Llama 3.3 70B',
    tier: 2,
    costPer1kInput: 0.00059,
    costPer1kOutput: 0.00079,
    expectedLatencyMs: 45,
    maxContextTokens: 32768,
    supportsJson: true,
    supportsTools: true,
    baseUrl: 'https://api.groq.com/openai/v1',
    initialAlpha: 2.0,
    initialBeta: 1.0,
  },
  {
    id: 'gemini-flash',
    name: 'Google Gemini 2.5 Flash',
    tier: 2,
    costPer1kInput: 0.00030,
    costPer1kOutput: 0.00250,
    expectedLatencyMs: 60,
    maxContextTokens: 1_048_576,
    supportsJson: true,
    supportsTools: true,
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    initialAlpha: 2.0,
    initialBeta: 1.0,
  },
  {
    id: 'deepseek-v4-flash',
    name: 'DeepSeek V4 Flash',
    tier: 1,
    costPer1kInput: 0.00014,
    costPer1kOutput: 0.00028,
    expectedLatencyMs: 55,
    maxContextTokens: 1_048_576,
    supportsJson: true,
    supportsTools: true,
    baseUrl: 'https://api.deepseek.com',
    initialAlpha: 2.0,
    initialBeta: 1.0,
  },
  {
    id: 'zhipu-glm5',
    name: 'Zhipu GLM 5.2',
    tier: 2,
    costPer1kInput: 0.00140,
    costPer1kOutput: 0.00440,
    expectedLatencyMs: 80,
    maxContextTokens: 1_048_576,
    supportsJson: true,
    supportsTools: true,
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    initialAlpha: 2.0,
    initialBeta: 1.0,
  },
  {
    id: 'moonshot-kimi-k2-6',
    name: 'Moonshot Kimi K2.6',
    tier: 2,
    costPer1kInput: 0.00095,
    costPer1kOutput: 0.00400,
    expectedLatencyMs: 70,
    maxContextTokens: 262_144,
    supportsJson: true,
    supportsTools: true,
    baseUrl: 'https://api.moonshot.cn/v1',
    initialAlpha: 2.0,
    initialBeta: 1.0,
  },
  {
    id: 'openrouter-gpt4o',
    name: 'OpenRouter GPT-4o',
    tier: 3,
    costPer1kInput: 0.0025,
    costPer1kOutput: 0.010,
    expectedLatencyMs: 80,
    maxContextTokens: 128000,
    supportsJson: true,
    supportsTools: true,
    baseUrl: 'https://openrouter.ai/api/v1',
    initialAlpha: 3.0,
    initialBeta: 1.0,
  },
  // ─── NEW (Patch B): GLM-4.7-Flash — Tier 1 ultra-fast for Conductor/Leads/Operations ───
  {
    id: 'zhipu-glm-4-7-flash',
    name: 'Zhipu GLM-4.7-Flash',
    tier: 1,
    costPer1kInput: 0.00010,   // $0.10 / 1M input
    costPer1kOutput: 0.00010,  // $0.10 / 1M output
    expectedLatencyMs: 35,     // sub-40ms target for WhatsApp
    maxContextTokens: 128_000,
    supportsJson: true,
    supportsTools: true,
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    initialAlpha: 2.5,         // mild prior preference (cheap + fast)
    initialBeta: 1.0,
  },
  // ─── NEW (Patch B): Claude 3.5 Haiku — Tier 3 primary for Refactor Agent ───
  {
    id: 'anthropic-claude-3-5-haiku',
    name: 'Anthropic Claude 3.5 Haiku',
    tier: 3,
    costPer1kInput: 0.00080,   // $0.80 / 1M
    costPer1kOutput: 0.00400,  // $4.00 / 1M
    expectedLatencyMs: 90,
    maxContextTokens: 200_000,
    supportsJson: true,
    supportsTools: true,
    baseUrl: 'https://api.anthropic.com/v1',
    initialAlpha: 3.0,         // strong prior — known excellent for code
    initialBeta: 1.0,
  },
  // ─── NEW (Patch B): Claude 3.5 Sonnet — Tier 3 option for Cerebro Agent (deep reasoning) ───
  {
    id: 'anthropic-claude-3-5-sonnet',
    name: 'Anthropic Claude 3.5 Sonnet',
    tier: 3,
    costPer1kInput: 0.00300,   // $3.00 / 1M
    costPer1kOutput: 0.01500,  // $15.00 / 1M
    expectedLatencyMs: 120,
    maxContextTokens: 200_000,
    supportsJson: true,
    supportsTools: true,
    baseUrl: 'https://api.anthropic.com/v1',
    initialAlpha: 2.5,
    initialBeta: 1.0,
  },
];

/* ================================================================== */
/* Per-Agent Fallback Chain Configuration (Patch D)                    */
/* ================================================================== */

/**
 * Per-Agent Fallback Chain Configuration
 *
 * Maps each logical ZCC agent to its preferred primary + fallback LLM provider.
 * Consumed by dispatchWithFailover() to enforce deterministic failover order
 * BEFORE Thompson Sampling kicks in for last-resort selection.
 *
 * DESIGN PRINCIPLES:
 *   1. Primary is chosen for cost/latency fit to the agent's task profile
 *   2. Fallback is from a DIFFERENT provider family (no correlated failures)
 *   3. Tier matches the agent's reasoning complexity:
 *      - Tier 1 = ultra-fast routing/triage (Conductor, Operations, Leads)
 *      - Tier 2 = standard reasoning (Data, Comms)
 *      - Tier 3 = deep reasoning (Finance, Cerebro, Refactor)
 *
 * MATRIX (validated against user spec 2026-08-04):
 *
 *   Agente        | Primário                  | Fallback                  | Tier
 *   --------------|---------------------------|---------------------------|-----
 *   conductor     | GLM-4.7-Flash             | Gemini 2.0 Flash          | 1
 *   data          | Gemini 2.0 Flash          | GLM-4.7-Flash             | 2
 *   finance       | DeepSeek V4 Flash         | GLM-5.2                   | 3
 *   leads         | GLM-4.7-Flash             | DeepSeek V4 Flash         | 1
 *   comms         | Gemini 2.0 Flash          | GLM-4.7-Flash             | 2
 *   operations    | GLM-4.7-Flash             | DeepSeek V4 Flash         | 1
 *   cerebro       | DeepSeek V4 Flash         | GLM-5.2                   | 3
 *   refactor      | Claude 3.5 Haiku          | DeepSeek V4 Flash         | 3
 */
export interface AgentFallbackChain {
  /** Provider ID do primário (deve estar registrado em DEFAULT_PROVIDERS) */
  primary: string | null;
  /** Provider ID do fallback (deve estar em DEFAULT_PROVIDERS, família diferente) */
  fallback: string | null;
  /** Tier máximo permitido para este agente (controla custo) */
  tier: 1 | 2 | 3;
  /** Descrição humana para observabilidade */
  rationale: string;
}

export const AGENT_FALLBACK_CHAINS: Record<string, AgentFallbackChain> = {
  conductor: {
    primary: 'zhipu-glm-4-7-flash',
    fallback: 'gemini-flash',
    tier: 1,
    rationale: 'Roteamento simples e JSON schema — ultra-baixo custo, sub-40ms',
  },
  data: {
    primary: 'gemini-flash',
    fallback: 'zhipu-glm-4-7-flash',
    tier: 2,
    rationale: 'RAG + sumarização longa — janela 1M do Gemini é diferencial',
  },
  finance: {
    primary: 'deepseek-v4-flash',
    fallback: 'zhipu-glm5',
    tier: 3,
    rationale: 'Raciocínio matemático sem alucinação — DeepSeek imbatível em lógica',
  },
  leads: {
    primary: 'zhipu-glm-4-7-flash',
    fallback: 'deepseek-v4-flash',
    tier: 1,
    rationale: 'Scoring e classificação tabular — JSON schema + baixo custo',
  },
  comms: {
    primary: 'gemini-flash',
    fallback: 'zhipu-glm-4-7-flash',
    tier: 2,
    rationale: 'Suporte a áudios diretos no WhatsApp (sem Whisper) + mensagens longas',
  },
  operations: {
    primary: 'zhipu-glm-4-7-flash',
    fallback: 'deepseek-v4-flash',
    tier: 1,
    rationale: 'Decisão binária e checklists de check-in — ultra-rápido',
  },
  cerebro: {
    primary: 'deepseek-v4-flash',
    fallback: 'zhipu-glm5',
    tier: 3,
    rationale: 'Raciocínio estendido para detecção de anomalias',
  },
  refactor: {
    primary: 'anthropic-claude-3-5-haiku',
    fallback: 'deepseek-v4-flash',
    tier: 3,
    rationale: 'Auto-fix de código/Prisma — Claude é rei em geração e correção de SQL',
  },
};

/**
 * Helper: Resolve the fallback chain for an agent.
 * Falls back to Thompson Sampling mode (primary=null) for unknown agents.
 */
export function getAgentChain(agentId: string): AgentFallbackChain {
  return AGENT_FALLBACK_CHAINS[agentId] ?? {
    primary: null,
    fallback: null,
    tier: 2,
    rationale: 'Agente não mapeado — Thompson Sampling decide dinamicamente',
  };
}

/* ================================================================== */
/* Seeded PRNG — Mulberry32                                             */
/* ================================================================== */

/**
 * Mulberry32 is a fast, high-quality 32-bit PRNG.
 * Used to ensure deterministic Thompson Sampling draws.
 */
function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ================================================================== */
/* ZaosNeuroRouter Class                                                */
/* ================================================================== */

export class ZaosNeuroRouter {
  private providers: Map<string, RouterProviderState>;
  private budgetGuard: BudgetGuard;
  private contextDiscretizer: ContextDiscretizer;
  private semanticCache: SemanticCache;
  private headroomClient: HeadroomClient;
  private sessionStickiness: Map<string, string>;
  private zai: any = null;

  /** Cost Knowledge base — tabela de preços reais + recomendações por bucket */
  private costKnowledge: CostKnowledge;

  /** Cost-weight for Thompson Sampling utility (default: 50) */
  private costWeight: number;

  /** Request counter for seeding the PRNG */
  private requestCounter: number;

  constructor(config?: {
    budgetGuard?: BudgetGuard;
    providers?: ProviderRegistration[];
    costWeight?: number;
    cacheMaxSize?: number;
    cacheTtlMs?: number;
    dailyBudgetUsd?: number;
    monthlyBudgetUsd?: number;
  }) {
    // Initialize providers
    this.providers = new Map();
    const registrations = config?.providers ?? DEFAULT_PROVIDERS;
    for (const reg of registrations) {
      this.providers.set(reg.id, {
        registration: reg,
        circuitBreaker: new CircuitBreaker({
          failureThreshold: 3,
          cooldownMs: 60_000,
        }),
        alpha: reg.initialAlpha ?? 1.0,
        beta: reg.initialBeta ?? 1.0,
        totalLatencyMs: 0,
        totalRequests: 0,
      });
    }

    // Initialize sub-components
    this.budgetGuard = config?.budgetGuard ?? new BudgetGuard({
      dailyBudgetUsd: config?.dailyBudgetUsd ?? 50,
      monthlyBudgetUsd: config?.monthlyBudgetUsd ?? 1500,
    });

    this.contextDiscretizer = new ContextDiscretizer();
    this.semanticCache = new SemanticCache({
      maxSize: config?.cacheMaxSize ?? 1000,
      defaultTtlMs: config?.cacheTtlMs ?? 3_600_000,
    });

    this.headroomClient = new HeadroomClient();
    this.sessionStickiness = new Map();
    this.costKnowledge = costKnowledge;
    this.costWeight = config?.costWeight ?? 50;
    this.requestCounter = 0;
  }

  async initialize(): Promise<void> {
    if (!this.zai) {
      try {
        this.zai = await ZAI.create();
      } catch (err) {
        console.error('[ZaosNeuroRouter] Failed to create ZAI client:', err);
      }
    }
    await loadBudgetGuard(this.budgetGuard);
    await loadRouterState(this);
  }

  /* -------------------------------------------------------------- */
  /* Main Routing Method                                              */
  /* -------------------------------------------------------------- */

  /**
   * Route a request through the full cognitive pipeline:
   *
   * 1. Classify context via ContextDiscretizer (<5ms regex match)
   * 2. Validate budget via BudgetGuard
   * 3. Filter providers by circuit breakers (skip OPEN)
   * 4. Filter by SLA requirements (latency constraints)
   * 5. Pareto filter by budget-allowed tiers
   * 6. Thompson Sampling selection among eligible providers
   * 7. Apply session stickiness override
   * 8. Check semantic cache
   * 9. Optionally compress via Headroom Proxy
   * 10. Dispatch to selected provider (mock)
   * 11. Record feedback (update α/β posteriors)
   * 12. Update circuit breaker state
   *
   * @param request - The LLM request to route
   * @returns LLMResponse with routing metadata
   */
  async generate(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    this.requestCounter++;

    // --- Step 1: Context Classification ---
    const classification = this.contextDiscretizer.classify(request.message);

    // Determine target tier: user override > classification suggestion
    const targetTier = request.tier ?? classification.suggestedTier;

    // --- Step 2: Budget Validation ---
    // Use per-tenant budget guard when tenantId is provided (multi-tenant isolation)
    // Falls back to the global budget guard for backward compatibility
    let budgetLevel: BudgetLevel;
    let maxAllowedTier: number;
    if (request.tenantId) {
      const tenantLevel = tenantBudgetGuard.getLevel(request.tenantId, request.tenantPlan);
      const tenantMaxTier = tenantBudgetGuard.getMaxAllowedTier(request.tenantId, request.tenantPlan);
      budgetLevel = tenantLevel;
      maxAllowedTier = tenantMaxTier;
    } else {
      budgetLevel = this.budgetGuard.getLevel();
      maxAllowedTier = this.budgetGuard.getMaxAllowedTier();
    }

    // If budget restricts us, clamp the target tier
    const effectiveTier = Math.min(targetTier, maxAllowedTier);

    // --- Step 3: Filter by Circuit Breakers ---
    const circuitFiltered = this.filterByCircuitBreakers();

    // --- Step 4: Filter by Budget-Allowed Tiers ---
    const tierFiltered = this.filterByTier(circuitFiltered, effectiveTier);

    // --- Step 5: Filter by SLA (latency constraint) ---
    const slaFiltered = request.maxLatencyMs
      ? this.filterByLatency(tierFiltered, request.maxLatencyMs)
      : tierFiltered;

    // --- Step 6: Handle empty provider set ---
    if (slaFiltered.length === 0) {
      // Fallback: try lower tiers, then any available provider
      const fallbackProviders = this.filterByCircuitBreakers();
      if (fallbackProviders.length === 0) {
        throw new Error(
          'ZaosNeuroRouter: All providers have open circuit breakers. No available LLM backend.'
        );
      }
      return this.dispatchWithProvider(
        fallbackProviders[0],
        request,
        startTime,
        classification,
        budgetLevel,
        slaFiltered,
        this.requestCounter,
      );
    }

    // --- Step 7: Session Stickiness ---
    let selectedProvider: RouterProviderState;
    if (request.sessionId) {
      const stickyId = this.sessionStickiness.get(request.sessionId);
      if (stickyId) {
        const stickyProvider = slaFiltered.find(p => p.registration.id === stickyId);
        if (stickyProvider) {
          selectedProvider = stickyProvider;
        } else {
          selectedProvider = this.thompsonSample(slaFiltered, this.requestCounter, classification.bucket, budgetLevel);
        }
      } else {
        selectedProvider = this.thompsonSample(slaFiltered, this.requestCounter, classification.bucket, budgetLevel);
      }
    } else {
      selectedProvider = this.thompsonSample(slaFiltered, this.requestCounter, classification.bucket, budgetLevel);
    }

    // Record session stickiness
    if (request.sessionId) {
      this.sessionStickiness.set(request.sessionId, selectedProvider.registration.id);
    }

    return this.dispatchWithProvider(
      selectedProvider,
      request,
      startTime,
      classification,
      budgetLevel,
      slaFiltered,
      this.requestCounter,
    );
  }

  /* -------------------------------------------------------------- */
  /* Thompson Sampling                                               */
  /* -------------------------------------------------------------- */

  /**
   * Thompson Sampling: select a provider by drawing θ_p ~ Beta(α_p, β_p)
   * for each eligible provider and computing a utility score.
   *
   * Utility(p) = θ_p − w × adjustedCost(p)
   *
   * Where adjustedCost normalizes per-provider cost against the cheapest
   * provider in the set, and w is the cost weight hyperparameter.
   *
   * The Beta samples are generated using the Marsaglia & Tsang (2000)
   * method for Gamma variates, with a Johnk's algorithm fallback for
   * cases where min(α, β) < 1.0.
   *
   * @param eligibleProviders - Providers that passed all filters
   * @param seed - Seed for the PRNG (ensures reproducibility per request)
   * @param bucket - Context bucket (from ContextDiscretizer) for cost-aware routing
   * @param budgetLevel - Current budget level for cost modifier scaling
   * @returns The provider with the highest utility score
   */
  thompsonSample(
    eligibleProviders: RouterProviderState[],
    seed: number,
    bucket: string = 'reservation_query',
    budgetLevel: string = 'nominal',
  ): RouterProviderState {
    if (eligibleProviders.length === 1) {
      return eligibleProviders[0];
    }

    const rng = mulberry32(seed);
    const thetas: Record<string, number> = {};

    // Find minimum cost for normalization
    let minCost = Infinity;
    for (const p of eligibleProviders) {
      const avgCost = (p.registration.costPer1kInput + p.registration.costPer1kOutput) / 2;
      if (avgCost < minCost) minCost = avgCost;
    }
    // Avoid division by zero for free providers
    if (minCost === 0) minCost = 0.001;

    let bestProvider = eligibleProviders[0];
    let bestUtility = -Infinity;

    for (const provider of eligibleProviders) {
      // Draw θ ~ Beta(alpha, beta)
      const theta = this.sampleBeta(provider.alpha, provider.beta, rng);
      thetas[provider.registration.id] = theta;

      // Compute adjusted cost (normalized against cheapest)
      const avgCost = (provider.registration.costPer1kInput + provider.registration.costPer1kOutput) / 2;
      const adjustedCost = avgCost / minCost;

      // Cost Knowledge modifier: biasing selection toward the cheapest adequate
      // model for the current context bucket. Modifier < 1 = rewarded, > 1 penalized.
      const costModifier = this.costKnowledge.getCostModifier(
        provider.registration.id,
        bucket,
        budgetLevel,
      );

      // Utility: higher theta (success probability) minus cost penalty
      // weighted by the cost knowledge modifier
      const utility = theta - this.costWeight * 0.001 * adjustedCost * costModifier;

      if (utility > bestUtility) {
        bestUtility = utility;
        bestProvider = provider;
      }
    }

    // Attach thetas to response for observability
    this._lastThetas = thetas;
    this._lastSelectedTheta = thetas[bestProvider.registration.id] ?? 0;

    return bestProvider;
  }

  /** Last Thompson Sampling thetas (for observability) */
  private _lastThetas: Record<string, number> = {};
  /** Last selected provider's theta */
  private _lastSelectedTheta = 0;

  /**
   * Draw a sample from Beta(α, β) using Gamma variates:
   *   Beta(α, β) = Gamma(α) / (Gamma(α) + Gamma(β))
   *
   * Uses Marsaglia & Tsang (2000) for Gamma generation when both
   * α, β ≥ 1. Falls back to Johnk's algorithm when min(α, β) < 1.
   *
   * @param alpha - Beta distribution α parameter (> 0)
   * @param beta - Beta distribution β parameter (> 0)
   * @param rng - Seeded PRNG function returning values in [0, 1)
   * @returns A sample from Beta(alpha, beta)
   */
  sampleBeta(alpha: number, beta: number, rng: () => number): number {
    const x = this.marsagliaTsang(alpha, rng);
    const y = this.marsagliaTsang(beta, rng);

    // Avoid division by zero
    const sum = x + y;
    if (sum === 0) return 0.5; // Uniform fallback
    return x / sum;
  }

  /**
   * Generate a Gamma(α, 1) variate using Marsaglia & Tsang (2000) method.
   *
   * For α ≥ 1:
   *   Uses the transformation method with d = α - 1/3, c = 1/√(9d).
   *   Generates normal variates and applies the acceptance criterion.
   *
   * For α < 1 (Johnk's algorithm fallback):
   *   Uses the identity X = U^(1/α) / (U^(1/α) + V^(1/β)) where
   *   U, V ~ Uniform(0,1), then X * Gamma(α+1, 1).
   *
   * Reference: Marsaglia, G. and Tsang, W.W. (2000)
   *   "A Simple Method for Generating Gamma Variables"
   *   ACM Transactions on Mathematical Software, Vol. 26, No. 3.
   *
   * @param alpha - Shape parameter of the Gamma distribution (> 0)
   * @param rng - Seeded PRNG function returning values in [0, 1)
   * @returns A Gamma(alpha, 1) sample
   */
  marsagliaTsang(alpha: number, rng: () => number): number {
    if (alpha <= 0) return 0;

    // --- Johnk's algorithm for α < 1 ---
    if (alpha < 1.0) {
      return this.johnkGamma(alpha, rng);
    }

    // --- Marsaglia & Tsang for α ≥ 1 ---
    const d = alpha - 1.0 / 3.0;
    const c = 1.0 / Math.sqrt(9.0 * d);

    // Rejection sampling loop with a safety bound
    for (let attempt = 0; attempt < 1000; attempt++) {
      // Generate standard normal via Box-Muller using our RNG
      const u1 = rng();
      const u2 = rng();
      const normal = Math.sqrt(-2.0 * Math.log(Math.max(u1, 1e-30))) * Math.cos(2.0 * Math.PI * u2);

      let x = 1.0 + c * normal;
      if (x <= 0) continue;

      x = x * x * x; // x^3

      const u3 = rng();
      const acceptanceThreshold = 1.0 - 0.0331 * (u3 * u3) * (u3 * u3);

      if (u3 < acceptanceThreshold) {
        return d * x;
      }

      // Logarithmic acceptance check (for edge cases)
      if (Math.log(u3) < 0.5 * normal * normal + d * (1.0 - x + Math.log(x))) {
        return d * x;
      }
    }

    // Safety fallback: return the mean of the distribution
    return alpha;
  }

  /**
   * Johnk's algorithm for generating Gamma(α) variates when α < 1.
   *
   * Uses the identity: if U, V ~ Uniform(0,1) and
   *   X = U^(1/α) / (U^(1/α) + V^(1/(1-α)))
   * then X ~ Beta(α, 1-α), and Gamma(α) = X * Gamma(α+1).
   *
   * We recursively call marsagliaTsang(α+1, rng) which will use
   * the Marsaglia-Tsang method since α+1 ≥ 1.
   *
   * @param alpha - Shape parameter (0 < α < 1)
   * @param rng - Seeded PRNG
   * @returns A Gamma(alpha, 1) sample
   */
  private johnkGamma(alpha: number, rng: () => number): number {
    for (let attempt = 0; attempt < 1000; attempt++) {
      const u = rng();
      const v = rng();

      // Avoid log(0)
      if (u === 0 || v === 0) continue;

      const x = Math.pow(u, 1.0 / alpha);
      const y = Math.pow(v, 1.0 / (1.0 - alpha));

      if (x + y <= 0) continue;

      // X ~ Beta(alpha, 1-alpha)
      const betaSample = x / (x + y);

      // Gamma(alpha) = Beta(alpha, 1-alpha) * Gamma(alpha + 1)
      const gammaAlphaPlus1 = this.marsagliaTsang(alpha + 1.0, rng);
      return betaSample * gammaAlphaPlus1;
    }

    // Safety fallback: exponential approximation for small alpha
    return alpha * (-Math.log(Math.max(rng(), 1e-30)));
  }

  /* -------------------------------------------------------------- */
  /* Feedback Recording                                              */
  /* -------------------------------------------------------------- */

  /**
   * Record feedback for a provider after a request completes.
   * Updates Beta posteriors (α for success, β for failure) and
   * the circuit breaker state.
   *
   * @param providerId - The provider that handled the request
   * @param success - Whether the request succeeded
   * @param latencyMs - Observed latency in milliseconds
   */
  recordFeedback(providerId: string, success: boolean, latencyMs: number): void {
    const provider = this.providers.get(providerId);
    if (!provider) return;

    // Update Beta posterior
    if (success) {
      provider.alpha += 1;
    } else {
      provider.beta += 1;
    }

    // Update latency tracking
    provider.totalLatencyMs += latencyMs;
    provider.totalRequests += 1;

    // Update circuit breaker
    if (success) {
      provider.circuitBreaker.recordSuccess();
    } else {
      provider.circuitBreaker.recordFailure();
    }
  }

  /**
   * Apply exponential decay to all Thompson Sampling posteriors.
   *
   * PROBLEM: Standard Thompson Sampling assumes stationary rewards — if a
   * provider's quality changes (degrades or improves) over time, the
   * accumulated α/β counts dominate and the sampler can't adapt.
   *
   * SOLUTION: Apply exponential decay (γ < 1) to α and β periodically.
   * This effectively limits the "memory" of the sampler, making it
   * responsive to recent observations while keeping prior strength bounded.
   *
   * RECOMMENDED USAGE:
   *  - Daily cron with γ = 0.95 (keeps ~95% of historical evidence per day)
   *  - After 30 days of decay: effective evidence = 0.95^30 ≈ 21% of original
   *  - Providers that recently degraded will have their posterior mean shift
   *    downward within ~3-5 days (instead of weeks)
   *
   * GUARDRAILS:
   *  - Never decays below the prior (initialAlpha, initialBeta)
   *  - Logs decay applied per provider for observability
   *
   * @param gamma - Decay factor (default 0.95). Must be in (0, 1).
   * @returns Stats about decay applied per provider
   */
  applyPosteriorDecay(gamma: number = 0.95): {
    providerId: string;
    beforeAlpha: number;
    beforeBeta: number;
    afterAlpha: number;
    afterBeta: number;
    effectiveEvidenceKept: number;
  }[] {
    if (gamma <= 0 || gamma >= 1) {
      throw new Error(`gamma must be in (0, 1), got ${gamma}`);
    }

    const results: Array<{
      providerId: string;
      beforeAlpha: number;
      beforeBeta: number;
      afterAlpha: number;
      afterBeta: number;
      effectiveEvidenceKept: number;
    }> = [];

    for (const [providerId, provider] of this.providers) {
      const beforeAlpha = provider.alpha;
      const beforeBeta = provider.beta;
      const priorAlpha = provider.registration.initialAlpha ?? 1.0;
      const priorBeta = provider.registration.initialBeta ?? 1.0;

      // Decay toward prior (not toward 0 — we want to keep some baseline confidence)
      const decayedAlpha = priorAlpha + (provider.alpha - priorAlpha) * gamma;
      const decayedBeta = priorBeta + (provider.beta - priorBeta) * gamma;

      provider.alpha = Math.max(priorAlpha, decayedAlpha);
      provider.beta = Math.max(priorBeta, decayedBeta);

      // Effective evidence kept (sum of α + β - prior)
      const beforeEvidence = beforeAlpha + beforeBeta - priorAlpha - priorBeta;
      const afterEvidence = provider.alpha + provider.beta - priorAlpha - priorBeta;
      const effectiveKept = beforeEvidence > 0 ? afterEvidence / beforeEvidence : 1;

      results.push({
        providerId,
        beforeAlpha,
        beforeBeta,
        afterAlpha: provider.alpha,
        afterBeta: provider.beta,
        effectiveEvidenceKept: effectiveKept,
      });
    }

    // Log observability
    if (typeof console !== 'undefined') {
      console.log(`[ZaosNeuroRouter] Posterior decay applied (γ=${gamma}):`, {
        providers: results.map(r => ({
          id: r.providerId,
          α: `${r.beforeAlpha.toFixed(2)} → ${r.afterAlpha.toFixed(2)}`,
          β: `${r.beforeBeta.toFixed(2)} → ${r.afterBeta.toFixed(2)}`,
          kept: `${(r.effectiveEvidenceKept * 100).toFixed(1)}%`,
        })),
      });
    }

    return results;
  }

  /**
   * Returns a snapshot of all provider posteriors for observability/dashboard.
   * Useful for monitoring drift over time and confirming decay is working.
   */
  getPosteriorSnapshot(): Array<{
    providerId: string;
    providerName: string;
    tier: number;
    alpha: number;
    beta: number;
    posteriorMean: number; // α / (α + β)
    totalRequests: number;
    avgLatencyMs: number;
    circuitState: string;
  }> {
    return Array.from(this.providers.values()).map(p => ({
      providerId: p.registration.id,
      providerName: p.registration.name,
      tier: p.registration.tier,
      alpha: p.alpha,
      beta: p.beta,
      posteriorMean: p.alpha / (p.alpha + p.beta),
      totalRequests: p.totalRequests,
      avgLatencyMs: p.totalRequests > 0 ? p.totalLatencyMs / p.totalRequests : 0,
      circuitState: p.circuitBreaker.getState(),
    }));
  }

  /* -------------------------------------------------------------- */
  /* Provider Management                                             */
  /* -------------------------------------------------------------- */

  /** Register a new provider (or update an existing one) */
  registerProvider(registration: ProviderRegistration): void {
    const existing = this.providers.get(registration.id);
    this.providers.set(registration.id, {
      registration,
      circuitBreaker: existing?.circuitBreaker ?? new CircuitBreaker(),
      alpha: registration.initialAlpha ?? existing?.alpha ?? 1.0,
      beta: registration.initialBeta ?? existing?.beta ?? 1.0,
      totalLatencyMs: existing?.totalLatencyMs ?? 0,
      totalRequests: existing?.totalRequests ?? 0,
    });
  }

  /** Remove a provider by ID */
  removeProvider(providerId: string): boolean {
    return this.providers.delete(providerId);
  }

  /** Get all registered providers with their current state */
  getProviders(): RouterProviderState[] {
    return Array.from(this.providers.values());
  }

  /** Get a specific provider's state */
  getProvider(providerId: string): RouterProviderState | undefined {
    return this.providers.get(providerId);
  }

  /* -------------------------------------------------------------- */
  /* Observability                                                   */
  /* -------------------------------------------------------------- */

  /** Get the budget guard snapshot */
  getBudgetSnapshot() {
    return this.budgetGuard.getSnapshot();
  }

  /** Get the semantic cache stats */
  getCacheStats() {
    return this.semanticCache.stats();
  }

  /** Get all circuit breaker states */
  getCircuitBreakerStates(): Record<string, { state: string; consecutiveFailures: number; successRate: number }> {
    const result: Record<string, { state: string; consecutiveFailures: number; successRate: number }> = {};
    for (const [id, provider] of this.providers) {
      const snapshot = provider.circuitBreaker.getSnapshot();
      result[id] = {
        state: snapshot.state,
        consecutiveFailures: snapshot.consecutiveFailures,
        successRate: provider.circuitBreaker.getSuccessRate(),
      };
    }
    return result;
  }

  /** Get the context discretizer instance (for testing) */
  getContextDiscretizer(): ContextDiscretizer {
    return this.contextDiscretizer;
  }

  /** Get the headroom client instance */
  getHeadroomClient(): HeadroomClient {
    return this.headroomClient;
  }

  /** Clear session stickiness map */
  clearSessionStickiness(): void {
    this.sessionStickiness.clear();
  }

  /** Clear the semantic cache */
  clearCache(): void {
    this.semanticCache.clear();
  }

  /** Manually add spend to budget guard */
  addBudgetSpend(amountUsd: number): void {
    this.budgetGuard.addSpend(amountUsd);
  }

  /* -------------------------------------------------------------- */
  /* Internal: Provider Filtering                                     */
  /* -------------------------------------------------------------- */

  /** Filter out providers with OPEN circuit breakers */
  private filterByCircuitBreakers(): RouterProviderState[] {
    const eligible: RouterProviderState[] = [];
    for (const provider of this.providers.values()) {
      if (provider.circuitBreaker.allow()) {
        eligible.push(provider);
      }
    }
    return eligible;
  }

  /** Filter providers by maximum allowed tier */
  private filterByTier(providers: RouterProviderState[], maxTier: number): RouterProviderState[] {
    return providers.filter(p => p.registration.tier <= maxTier);
  }

  /** Filter providers by expected latency (SLA) */
  private filterByLatency(providers: RouterProviderState[], maxLatencyMs: number): RouterProviderState[] {
    // Use 2x expected latency as a safety margin
    return providers.filter(p => p.registration.expectedLatencyMs <= maxLatencyMs * 2);
  }

  /* -------------------------------------------------------------- */
  /* Internal: Dispatch                                               */
  /* -------------------------------------------------------------- */

  /**
   * Dispatch a request to a specific provider, handling cache,
   * compression, and mock response generation.
   */
  private async dispatchWithProvider(
    provider: RouterProviderState,
    request: LLMRequest,
    startTime: number,
    classification: ReturnType<ContextDiscretizer['classify']>,
    budgetLevel: BudgetLevel,
    eligibleProviders: RouterProviderState[],
    seed: number,
  ): Promise<LLMResponse> {
    const providerId = provider.registration.id;
    const providerName = provider.registration.name;

    // Estimate token counts
    const inputChars = request.message.length + (request.systemPrompt?.length ?? 0);
    const inputTokens = Math.ceil(inputChars / 4);
    const outputTokens = 150 + Math.floor(Math.random() * 200); // Mock output size

    // --- Semantic Cache Check ---
    if (!request.noCache) {
      const cacheKey = buildCacheKey(providerId, request.message, request.params);
      const cached = this.semanticCache.get(cacheKey);
      if (cached) {
        const latencyMs = Date.now() - startTime;
        const costUsd = 0; // Cache hits are free

        return {
          response: cached.value as string,
          providerId,
          providerName,
          tier: provider.registration.tier,
          bucket: classification.bucket,
          confidence: classification.confidence,
          latencyMs,
          costUsd,
          inputTokens: cached.inputTokens,
          outputTokens: cached.outputTokens,
          cacheHit: true,
          compressionRatio: 0,
          circuitState: provider.circuitBreaker.getState(),
          budgetLevel,
          thompsonTheta: this._lastSelectedTheta,
          allThetas: this._lastThetas,
          isMock: false,
        };
      }
    }

    // --- Build final prompt (prepend system prompt if provided) ---
    let finalPrompt = request.systemPrompt
      ? `${request.systemPrompt}\n\n${request.message}`
      : request.message;
    let compressionRatio = 0;
    if (this.headroomClient.shouldCompress(finalPrompt.length)) {
      const result = await this.headroomClient.compress(finalPrompt);
      finalPrompt = result.prompt;
      compressionRatio = result.compressionRatio;
    }

    // --- Real LLM Dispatch ---
    let responseText = '';
    let isSuccess = true;
    let dispatchLatency = 0;
    let calculatedInputTokens = 0;
    let calculatedOutputTokens = 0;

    const dispatchStart = Date.now();
    const isMock = this.isMockMode(providerId);

    if (isMock) {
      // Simulate latency and return mock response
      dispatchLatency = this.simulateProviderLatency(provider);
      responseText = this.generateMockResponse(
        request.message,
        classification.bucket,
        providerName,
      );
      calculatedInputTokens = Math.ceil(finalPrompt.length / 4);
      calculatedOutputTokens = Math.ceil(responseText.length / 4);
      isSuccess = true;
    } else {
      try {
        const result = await this.callRealLLM(provider, finalPrompt, request.systemPrompt, request.jsonMode);
        responseText = result.content;
        calculatedInputTokens = result.inputTokens;
        calculatedOutputTokens = result.outputTokens;
        dispatchLatency = Date.now() - dispatchStart;
      } catch (error) {
        console.error(`[ZaosNeuroRouter] Error dispatching to provider ${providerId}:`, error);
        isSuccess = false;
        dispatchLatency = Date.now() - dispatchStart;

        // Fallback response in case the SDK fails (so the guest still gets a response)
        responseText = this.generateMockResponse(
          request.message,
          classification.bucket,
          providerName,
        );
        calculatedInputTokens = Math.ceil(finalPrompt.length / 4);
        calculatedOutputTokens = Math.ceil(responseText.length / 4);
      }
    }

    const totalLatencyMs = Date.now() - startTime;

    // Calculate cost based on actual tokens
    const costUsd = this.calculateCost(
      provider.registration,
      calculatedInputTokens,
      calculatedOutputTokens,
    );

    // --- Record in cache ---
    if (!request.noCache && isSuccess) {
      const cacheKey = buildCacheKey(providerId, request.message, request.params);
      this.semanticCache.set(
        cacheKey,
        responseText,
        calculatedInputTokens,
        calculatedOutputTokens,
        providerId,
      );
    }

    // --- Record budget spend ---
    this.budgetGuard.addSpend(costUsd);

    // --- Record feedback ---
    this.recordFeedback(providerId, isSuccess, dispatchLatency);

    // --- Persist state asynchronously (fire-and-forget) ---
    persistBudgetGuard(this.budgetGuard).catch(err =>
      console.error('[ZaosNeuroRouter] Failed to persist budget guard state:', err)
    );
    persistRouterState(this.getProviders()).catch(err =>
      console.error('[ZaosNeuroRouter] Failed to persist router state:', err)
    );

    // Compute Thompson thetas for observability (if not already computed)
    const thetas = this._lastThetas;

    return {
      response: responseText,
      providerId,
      providerName,
      tier: provider.registration.tier,
      bucket: classification.bucket,
      confidence: classification.confidence,
      latencyMs: totalLatencyMs,
      costUsd: Math.round(costUsd * 1_000_000) / 1_000_000,
      inputTokens: calculatedInputTokens,
      outputTokens: calculatedOutputTokens,
      cacheHit: false,
      compressionRatio,
      circuitState: provider.circuitBreaker.getState(),
      budgetLevel,
      thompsonTheta: this._lastSelectedTheta,
      allThetas: thetas,
      isMock: isMock || !isSuccess,
    };
  }

  /* -------------------------------------------------------------- */
  /* Dispatch with Failover (Patch A)                                 */
  /* -------------------------------------------------------------- */

  /**
   * Dispatch with explicit failover chain.
   *
   * Tries providers in order: agentFallbackChain → thompsonSampledHealthyProviders → mock.
   *
   * FAILOVER CONTRACT:
   *   1. Primary provider (from AGENT_FALLBACK_CHAINS[agentId].primary)
   *   2. Fallback provider (from AGENT_FALLBACK_CHAINS[agentId].fallback)
   *   3. Thompson Sampling among healthy providers of same tier
   *   4. Mock response (last resort — keeps guest unblocked)
   *
   * LATENCY BUDGET per failover hop: <50ms (circuit breaker check + adapter call setup)
   * TOTAL BUDGET for full chain: <150ms (3 hops × 50ms) before falling to mock
   *
   * @param agentId - Logical agent ID (e.g. 'conductor', 'finance', 'refactor')
   * @param request - Standard LLMRequest
   * @returns LLMResponse with providerId reflecting which provider actually served
   *          + failoverHops[] showing the chain of providers tried
   */
  async dispatchWithFailover(
    agentId: string,
    request: LLMRequest,
  ): Promise<LLMResponse & { failoverHops: string[] }> {
    const startTime = Date.now();
    const chain = getAgentChain(agentId);
    const failoverHops: string[] = [];

    // Build candidate list in priority order:
    // 1. Declared primary (if registered + circuit closed)
    // 2. Declared fallback (if registered + circuit closed)
    // 3. Any other healthy provider at chain.tier or below (Thompson-sorted)
    const candidates: RouterProviderState[] = [];
    const seen = new Set<string>();

    for (const candidateId of [chain.primary, chain.fallback]) {
      if (!candidateId) continue;
      const prov = this.providers.get(candidateId);
      if (prov && prov.circuitBreaker.allow() && !seen.has(candidateId)) {
        candidates.push(prov);
        seen.add(candidateId);
      }
    }

    // Append Thompson-sorted healthy providers as additional fallbacks
    const healthy = this.filterByCircuitBreakers()
      .filter(p => p.registration.tier <= (chain.tier ?? 2))
      .filter(p => !seen.has(p.registration.id));
    // Sort by posterior mean descending (highest success probability first)
    healthy.sort((a, b) => (b.alpha / (b.alpha + b.beta)) - (a.alpha / (a.alpha + a.beta)));
    candidates.push(...healthy);

    // If no candidates at all (all circuits open), include primary even if circuit open
    if (candidates.length === 0 && chain.primary) {
      const prov = this.providers.get(chain.primary);
      if (prov) candidates.push(prov);
    }

    // Try each candidate in order
    let lastError: Error | null = null;
    for (const candidate of candidates) {
      const providerId = candidate.registration.id;
      failoverHops.push(providerId);
      const hopStart = Date.now();

      try {
        const result = await this.dispatchWithProvider(
          candidate,
          request,
          startTime,
          this.contextDiscretizer.classify(request.message),
          this.budgetGuard.getLevel(),
          candidates,
          this.requestCounter,
        );

        // Log failover if we hopped past the primary
        if (failoverHops.length > 1) {
          console.warn(
            `[ZaosNeuroRouter] Failover for agent "${agentId}": ` +
            `primary=${chain.primary} → served by ${providerId} ` +
            `after ${failoverHops.length - 1} hop(s), ` +
            `hop_latency=${Date.now() - hopStart}ms, total_latency=${Date.now() - startTime}ms`,
          );
        }

        return { ...result, failoverHops };
      } catch (err) {
        lastError = err as Error;
        console.warn(
          `[ZaosNeuroRouter] Provider ${providerId} failed for agent "${agentId}": ` +
          `${(err as Error).message}. Trying next in chain...`,
        );
        // Record failure so Circuit Breaker can trip after 3 consecutive errors
        this.recordFeedback(providerId, false, Date.now() - hopStart);
        continue;
      }
    }

    // All providers exhausted — last-resort mock (keeps guest unblocked)
    console.error(
      `[ZaosNeuroRouter] ALL providers exhausted for agent "${agentId}". ` +
      `Hops tried: ${failoverHops.join(' → ')}. Falling back to mock. Last error: ${lastError?.message}`,
    );

    const mockProviderId = chain.primary ?? 'deepseek-v4-flash';
    const mockProvider = this.providers.get(mockProviderId);
    const mockProviderName = mockProvider?.registration.name ?? 'Mock (unknown)';
    const mockResponse = this.generateMockResponse(
      request.message,
      this.contextDiscretizer.classify(request.message).bucket,
      mockProviderName,
    );

    return {
      response: mockResponse,
      providerId: 'mock-fallback',
      providerName: 'Mock (all providers exhausted)',
      tier: 0,
      bucket: 'failover_exhausted',
      confidence: 0,
      latencyMs: Date.now() - startTime,
      costUsd: 0,
      inputTokens: Math.ceil(request.message.length / 4),
      outputTokens: Math.ceil(mockResponse.length / 4),
      cacheHit: false,
      compressionRatio: 0,
      circuitState: 'OPEN_ALL',
      budgetLevel: this.budgetGuard.getLevel(),
      thompsonTheta: 0,
      allThetas: {},
      isMock: true,
      failoverHops,
    };
  }

  /* -------------------------------------------------------------- */
  /* Native Function Calling                                          */
  /* -------------------------------------------------------------- */

  /**
   * Route a tool-calling request through the cognitive pipeline.
   *
   * Diferente do `generate` padrão:
   * - Filtra apenas providers com supportsTools=true
   * - Usa chamadas nativas de function calling (sem regex/JSON-in-text)
   * - Retorna tool calls estruturados do LLM
   * - Sem cache semântico (respostas com tools são não-determinísticas)
   * - Sem compressão Headroom (quebraria definições de tools)
   *
   * @param request - LLMToolRequest com messages e tools
   * @returns LLMToolResponse com response + toolCalls
   */
  async generateWithTools(request: LLMToolRequest): Promise<LLMToolResponse> {
    const startTime = Date.now();
    this.requestCounter++;

    // --- Step 1: Budget Validation (per-tenant or global) ---
    let budgetLevel: BudgetLevel;
    let maxAllowedTier: number;
    if (request.tenantId) {
      budgetLevel = tenantBudgetGuard.getLevel(request.tenantId, request.tenantPlan);
      maxAllowedTier = tenantBudgetGuard.getMaxAllowedTier(request.tenantId, request.tenantPlan);
    } else {
      budgetLevel = this.budgetGuard.getLevel();
      maxAllowedTier = this.budgetGuard.getMaxAllowedTier();
    }

    const effectiveTier = request.tier ?? Math.min(maxAllowedTier, 2); // Tools need at least Tier 2

    // --- Step 2: Filter by Circuit Breakers ---
    const circuitFiltered = this.filterByCircuitBreakers();

    // --- Step 3: Filter by tool-supporting providers ONLY ---
    const toolProviders = circuitFiltered.filter(
      p => p.registration.supportsTools && p.registration.tier <= effectiveTier,
    );

    if (toolProviders.length === 0) {
      // Fallback: try any tool-supporting provider regardless of tier
      const anyToolProviders = circuitFiltered.filter(p => p.registration.supportsTools);
      if (anyToolProviders.length === 0) {
        throw new Error(
          'ZaosNeuroRouter: No providers with tool support available.',
        );
      }
      return this.dispatchToolRequest(
        anyToolProviders[0],
        request,
        startTime,
        budgetLevel,
        anyToolProviders,
      );
    }

    // --- Step 4: Thompson Sampling among tool-supporting providers ---
    const selectedProvider = this.thompsonSample(
      toolProviders,
      this.requestCounter,
      'reservation_query',
      budgetLevel,
    );

    // Record session stickiness
    if (request.sessionId) {
      this.sessionStickiness.set(request.sessionId, selectedProvider.registration.id);
    }

    return this.dispatchToolRequest(
      selectedProvider,
      request,
      startTime,
      budgetLevel,
      toolProviders,
    );
  }

  /**
   * Dispatch a tool-calling request to a specific provider.
   */
  private async dispatchToolRequest(
    provider: RouterProviderState,
    request: LLMToolRequest,
    startTime: number,
    budgetLevel: BudgetLevel,
    eligibleProviders: RouterProviderState[],
  ): Promise<LLMToolResponse> {
    const providerId = provider.registration.id;
    const providerName = provider.registration.name;
    const isMock = this.isMockMode(providerId);

    let toolResponse: AdapterToolResponse;
    let isSuccess = true;
    let dispatchLatency = 0;

    const dispatchStart = Date.now();

    if (isMock) {
      // Mock response — no real tool calls
      dispatchLatency = this.simulateProviderLatency(provider);
      toolResponse = {
        content: this.generateMockResponse(
          request.messages[request.messages.length - 1]?.content || '',
          'reservation_query',
          providerName,
        ),
        inputTokens: Math.ceil(JSON.stringify(request.messages).length / 4),
        outputTokens: 150,
        toolCalls: [],
        finishReason: 'stop',
      };
    } else {
      try {
        toolResponse = await this.callRealLLMWithTools(
          provider,
          request.messages,
          request.tools,
        );
        dispatchLatency = Date.now() - dispatchStart;
      } catch (error) {
        console.error(`[ZaosNeuroRouter] Error in tool calling to ${providerId}:`, error);
        isSuccess = false;
        dispatchLatency = Date.now() - dispatchStart;

        // Fallback mock response
        toolResponse = {
          content: this.generateMockResponse(
            request.messages[request.messages.length - 1]?.content || '',
            'reservation_query',
            providerName,
          ),
          inputTokens: Math.ceil(JSON.stringify(request.messages).length / 4),
          outputTokens: 150,
          toolCalls: [],
          finishReason: 'stop',
        };
      }
    }

    const totalLatencyMs = Date.now() - startTime;

    // Calculate cost
    const costUsd = this.calculateCost(
      provider.registration,
      toolResponse.inputTokens,
      toolResponse.outputTokens,
    );

    // Record budget spend
    this.budgetGuard.addSpend(costUsd);

    // Record feedback
    this.recordFeedback(providerId, isSuccess, dispatchLatency);

    // Persist state asynchronously
    persistBudgetGuard(this.budgetGuard).catch(err =>
      console.error('[ZaosNeuroRouter] Failed to persist budget guard state:', err),
    );
    persistRouterState(this.getProviders()).catch(err =>
      console.error('[ZaosNeuroRouter] Failed to persist router state:', err),
    );

    return {
      response: toolResponse.content,
      providerId,
      providerName,
      tier: provider.registration.tier,
      bucket: 'reservation_query',
      confidence: 1.0,
      latencyMs: totalLatencyMs,
      costUsd: Math.round(costUsd * 1_000_000) / 1_000_000,
      inputTokens: toolResponse.inputTokens,
      outputTokens: toolResponse.outputTokens,
      cacheHit: false,
      compressionRatio: 0,
      circuitState: provider.circuitBreaker.getState(),
      budgetLevel,
      thompsonTheta: this._lastSelectedTheta,
      allThetas: this._lastThetas,
      isMock: isMock || !isSuccess,
      toolCalls: toolResponse.toolCalls.map(tc => ({
        id: tc.id,
        name: tc.name,
        arguments: tc.arguments,
      })),
      finishReason: toolResponse.finishReason,
    };
  }

  /**
   * Call a real LLM provider with native function calling support.
   * Routes to the correct adapter based on provider type.
   */
  private async callRealLLMWithTools(
    provider: RouterProviderState,
    messages: AdapterMessage[],
    tools: AdapterToolDef[],
  ): Promise<AdapterToolResponse> {
    const providerId = provider.registration.id;
    const baseUrl = provider.registration.baseUrl || '';
    const maxTokens = 1024;
    const temp = 0.3; // Lower temperature for tool calling (more precise)

    if (providerId.includes('gemini')) {
      const apiKey = process.env.GEMINI_API_KEY || '';
      return callGeminiWithTools({
        apiKey,
        model: providerId,
        messages,
        tools,
        temperature: temp,
        maxTokens,
      });
    }

    // NEW (Patch B): Anthropic Claude supports tool calling via its own format
    if (providerId.includes('anthropic') || providerId.includes('claude')) {
      const apiKey = process.env.ANTHROPIC_API_KEY || '';
      const model = providerId === 'anthropic-claude-3-5-haiku'
        ? 'claude-3-5-haiku-20241022'
        : providerId === 'anthropic-claude-3-5-sonnet'
          ? 'claude-3-5-sonnet-20241022'
          : 'claude-3-5-haiku-20241022';
      return callAnthropicWithTools({
        apiKey,
        model,
        messages,
        tools,
        temperature: temp,
        maxTokens,
      });
    }

    // All other tool-supporting providers use OpenAI-compatible format
    let apiKey = '';
    let realModel = providerId;
    const realUrl = baseUrl;

    if (providerId.includes('groq')) {
      apiKey = process.env.GROQ_API_KEY || '';
      realModel = providerId === 'groq-llama3-70b' ? 'llama-3.3-70b-versatile' : 'llama-3.1-8b-instant';
    } else if (providerId.includes('openrouter')) {
      apiKey = process.env.OPENROUTER_API_KEY || '';
    } else if (providerId.includes('deepseek')) {
      apiKey = process.env.DEEPSEEK_API_KEY || '';
    } else if (providerId.includes('glm5') || providerId.includes('zhipu')) {
      apiKey = process.env.GLM_5_2_API_KEY || process.env.ZHIPU_API_KEY || '';
      realModel = providerId === 'zhipu-glm-4-7-flash' ? 'glm-4.7-flash' : 'glm-5.2';
    } else if (providerId.includes('kimi') || providerId.includes('moonshot')) {
      apiKey = process.env.KIMI_K2_6_API_KEY || process.env.MOONSHOT_API_KEY || '';
      realModel = 'kimi-k2.6';
    }

    return callOpenAIWithTools({
      apiKey,
      baseUrl: realUrl,
      model: realModel,
      messages,
      tools,
      temperature: temp,
      maxTokens,
      isOpenRouter: providerId.includes('openrouter'),
    });
  }

  /* -------------------------------------------------------------- */
  /* Mock Helpers                                                    */
  /* -------------------------------------------------------------- */

  private simulateProviderLatency(provider: RouterProviderState): number {
    const base = provider.registration.expectedLatencyMs;
    // Add jitter: ±30% of base latency
    const jitter = base * 0.3 * (Math.random() * 2 - 1);
    return Math.max(10, Math.round(base + jitter));
  }

  private generateMockResponse(message: string, bucket: string, providerName: string): string {
    const lower = message.toLowerCase();

    // Context-aware mock responses for Brazilian hospitality
    const responses: Record<string, string> = {
      reservation_query: `✅ **Consulta de Reserva**\n\nEncontrei sua reserva no sistema. Para detalhes completos, informe o número da reserva ou seu CPF.\n\n*Processado via ${providerName}*`,
      pricing_optimization: `📊 **Análise de Preços**\n\nCom base nos dados atuais de demanda, recomendo ajuste de +8% nas suítes para o fim de semana. A taxa de ocupação está em 92%, indicando elasticidade favorável.\n\n*Processado via ${providerName}*`,
      guest_communication: `💬 **Mensagem ao Hóspede**\n\nPrezado(a) hóspede, sua solicitação foi recebida. Em breve retornaremos com mais informações.\n\n*Processado via ${providerName}*`,
      review_analysis: `⭐ **Análise de Reviews**\n\nTendência positiva: 87% das avaliações recentes são 4+ estrelas. Principais elogios: localização, café da manhã. Ponto de atenção: Wi-Fi nos quartos superiores.\n\n*Processado via ${providerName}*`,
      revenue_diagnosis: `💰 **Diagnóstico de Receita**\n\nReceita mensal: R$ 68.900 (+12% vs mês anterior). RevPAR: R$ 342. ADR: R$ 420. Ocupação: 81,4%. Recomendação: focar em upselling de late checkout (+R$ 150/mês por checkout).\n\n*Processado via ${providerName}*`,
      competitor_monitoring: `🔍 **Monitoramento Competitivo**\n\n3 concorrentes monitorados. Seus preços estão 5% abaixo da média local para suítes. Oportunidade: ajustar tarifas premium em +12% sem perder competitividade.\n\n*Processado via ${providerName}*`,
      lead_prospection: `🎯 **Prospecção**\n\n14 novas pousadas identificadas sem sistema de gestão. Lead score médio: 82/100. 5 com potencial alto para abordagem esta semana.\n\n*Processado via ${providerName}*`,
      email_composition: `📧 **Email Composto**\n\nAssunto: Sua estadia na Pousada 🌊\n\nPrezado(a) hóspede,\n\nTemos prazer em confirmar sua reserva...\n\n*Processado via ${providerName}*`,
      whatsapp_template: `📱 **Template WhatsApp**\n\n"Olá {nome}! 🌟 Sua reserva para {quarto} está confirmada. Check-in: {data}. Qualquer dúvida, estamos aqui! 😊"\n\n*Processado via ${providerName}*`,
      checkin_assistance: `🔑 **Check-in Assistido**\n\nSeu quarto está pronto! Chave disponível na recepção. WiFi: rede "POUSADA_Guest", senha fornecida no welcome kit.\n\n*Processado via ${providerName}*`,
      checkout_assistance: `✅ **Check-out**\n\nSeu check-out foi processado com sucesso. Chave devolvida. Obrigado por sua estadia! Avaliação: ★★★★★\n\n*Processado via ${providerName}*`,
      upselling: `💎 **Oferta de Upsell**\n\nHóspede qualificado para upgrade Suite Deluxe (+R$ 180/noite). Inclui vista panorâmica e café da manhã gourmet. Taxa de aceitação histórica: 34%.\n\n*Processado via ${providerName}*`,
      housekeeping_request: `🧹 **Housekeeping**\n\nSolicitação registrada. Previsão de atendimento: 20 minutos. Camareira Maria designada para o quarto.\n\n*Processado via ${providerName}*`,
      maintenance_request: `🔧 **Manutenção**\n\nChamado aberto. Técnico designado: Carlos. Previsão: 45 minutos para atendimento. Status: pendente.\n\n*Processado via ${providerName}*`,
      complaint_handling: `⚠️ **Tratamento de Reclamação**\n\nReclamação registrada com prioridade ALTA. Supervisor notificado. Proposta: desconto de 20% na próxima estadia + amenities complementares.\n\n*Processado via ${providerName}*`,
      local_recommendation: `🗺️ **Recomendações Locais**\n\n1. **Restaurante Mar Azul** — frutos do mar, 300m (⭐ 4.7)\n2. **Trilha da Praia do Sancho** — 15 min de caminhada\n3. **Mirante do Pôr do Sol** — melhor horário: 17:30\n\n*Processado via ${providerName}*`,
      weather_info: `🌤️ **Previsão do Tempo**\n\nHoje: 28°C, sol com nuvens esparsas. Noite: 22°C. Próximos 3 dias: tempo estável, ideal para praia.\n\n*Processado via ${providerName}*`,
      payment_processing: `💳 **Pagamento**\n\nTransação processada com sucesso. Valor: confirmado via PIX. Comprovante enviado para seu email.\n\n*Processado via ${providerName}*`,
      booking_cancellation: `❌ **Cancelamento**\n\nReserva cancelada conforme política. Reembolso processado em até 5 dias úteis via PIX. Taxa de cancelamento: R$ 0,00 (cancelamento gratuito).\n\n*Processado via ${providerName}*`,
      availability_check: `📅 **Disponibilidade**\n\nQuartos disponíveis para o período solicitado:\n• Standard: 3 quartos — R$ 280/noite\n• Superior: 2 quartos — R$ 420/noite\n• Suite: 1 quarto — R$ 850/noite\n\n*Processado via ${providerName}*`,
      amenity_info: `🏊 **Comodidades**\n\n• Piscina: 7h-22h (toalhas na recepção)\n• WiFi: "POUSADA_Guest" (senha no quarto)\n• Estacionamento: incluso, vaga designada\n• Academia: 6h-22h\n\n*Processado via ${providerName}*`,
      transportation: `🚗 **Transporte**\n\nTraslado aeroporto disponível: R$ 120 (ida). Uber/99: ~R$ 80-100. Tempo estimado: 45 minutos.\n\n*Processado via ${providerName}*`,
      event_planning: `🎉 **Planejamento de Evento**\n\nCapacidade máxima: 60 pessoas. Salão de eventos disponível. Buffet partner: contato fornecido. Orçamento estimado: R$ 8.500-15.000.\n\n*Processado via ${providerName}*`,
      dietary_request: `🍽️ **Requisitos Alimentares**\n\nOpções vegetarianas e veganas disponíveis no café da manhã. Alergias registradas no sistema. Cardápio sem glúten sob consulta.\n\n*Processado via ${providerName}*`,
      pet_policy: `🐕 **Política de Pets**\n\nAceitamos cães e gatos de pequeno porte (até 10kg). Taxa adicional: R$ 50/dia. Informar na reserva.\n\n*Processado via ${providerName}*`,
      accessibility: `♿ **Acessibilidade**\n\nQuartos adaptados disponíveis: 2 unidades. Rampa de acesso, banheiro adaptado, corrimãos. Informar na reserva.\n\n*Processado via ${providerName}*`,
      group_booking: `👥 **Reserva de Grupo**\n\nDesconto para grupos (5+ quartos): 10-15%. Bloqueio de quartos disponível. Contrato específico para eventos corporativos.\n\n*Processado via ${providerName}*`,
      long_stay: `🏠 **Estadia Longa**\n\nDesconto semanal: 10%. Mensal: 20%. Inclui lavanderia semanal e troca de roupa de cama. Ideal para trabalho remoto.\n\n*Processado via ${providerName}*`,
      corporate_booking: `🏢 **Reserva Corporativa**\n\nConvenio corporativo disponível. Nota fiscal e relatório de despesas. Checkout flexível para viagens de negócios.\n\n*Processado via ${providerName}*`,
      ota_management: `🌐 **Gestão OTA**\n\nSincronizado com: Booking.com, Airbnb, Expedia. Calendário atualizado. Preço paridade: verificada. 12 reservas OTA este mês.\n\n*Processado via ${providerName}*`,
      channel_management: `📊 **Gestão de Canais**\n\nCanal direto: 45% das reservas (meta: 60%). Booking.com: 35%. Airbnb: 15%. Comissões totais: R$ 4.200/mês.\n\n*Processado via ${providerName}*`,
      financial_reporting: `📈 **Relatório Financeiro**\n\nFaturamento do mês: R$ 68.900. Despesas operacionais: R$ 32.100. Lucro bruto: R$ 36.800 (53,4%). Margem líquida: 38,2%.\n\n*Processado via ${providerName}*`,
    };

    return responses[bucket] ?? `🤖 **Resposta do Cérebro ZÉLLA**\n\nSua mensagem foi processada pelo roteador cognitivo. Contexto: ${bucket}.\n\n*Processado via ${providerName}*`;
  }

  private isMockMode(providerId: string): boolean {
    let apiKey = '';
    if (providerId.includes('groq')) {
      apiKey = process.env.GROQ_API_KEY || '';
    } else if (providerId.includes('gemini')) {
      apiKey = process.env.GEMINI_API_KEY || '';
    } else if (providerId.includes('openai')) {
      apiKey = process.env.OPENAI_API_KEY || '';
    } else if (providerId.includes('anthropic')) {
      apiKey = process.env.ANTHROPIC_API_KEY || '';
    } else if (providerId.includes('openrouter')) {
      apiKey = process.env.OPENROUTER_API_KEY || '';
    } else if (providerId.includes('deepseek')) {
      apiKey = process.env.DEEPSEEK_API_KEY || '';
    } else if (providerId.includes('glm5') || providerId.includes('zhipu')) {
      apiKey = process.env.GLM_5_2_API_KEY || process.env.ZHIPU_API_KEY || '';
    } else if (providerId.includes('kimi') || providerId.includes('moonshot')) {
      apiKey = process.env.KIMI_K2_6_API_KEY || process.env.MOONSHOT_API_KEY || '';
    }

    if (!apiKey || apiKey === 'sk-mock' || apiKey.startsWith('sk-mock')) {
      return true;
    }
    return false;
  }

  private async callRealLLM(
    provider: RouterProviderState,
    prompt: string,
    systemPrompt?: string,
    jsonMode?: boolean,
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    const providerId = provider.registration.id;
    const baseUrl = provider.registration.baseUrl || '';

    const messages: AdapterMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const maxTokens = 1024;
    const temp = 0.7;

    if (providerId.includes('gemini')) {
      const apiKey = process.env.GEMINI_API_KEY || '';
      return callGemini({ apiKey, model: providerId, messages, temperature: temp, maxTokens, jsonMode });
    } else if (providerId.includes('anthropic') || providerId.includes('claude')) {
      const apiKey = process.env.ANTHROPIC_API_KEY || '';
      // Map provider ID to actual Anthropic model name (providerId is NOT a valid model)
      const model = providerId === 'anthropic-claude-3-5-haiku'
        ? 'claude-3-5-haiku-20241022'
        : providerId === 'anthropic-claude-3-5-sonnet'
          ? 'claude-3-5-sonnet-20241022'
          : 'claude-3-5-haiku-20241022'; // safe default
      return callAnthropic({ apiKey, model, messages, temperature: temp, maxTokens });
    } else {
      let apiKey = '';
      let realModel = providerId;
      const realUrl = baseUrl;

      if (providerId.includes('groq')) {
        apiKey = process.env.GROQ_API_KEY || '';
        if (providerId === 'groq-llama3-70b') {
          realModel = 'llama-3.3-70b-versatile';
        } else if (providerId === 'groq-llama3-8b') {
          realModel = 'llama-3.1-8b-instant';
        }
      } else if (providerId.includes('openai')) {
        apiKey = process.env.OPENAI_API_KEY || '';
      } else if (providerId.includes('openrouter')) {
        apiKey = process.env.OPENROUTER_API_KEY || '';
      } else if (providerId.includes('deepseek')) {
        apiKey = process.env.DEEPSEEK_API_KEY || '';
      } else if (providerId.includes('glm5') || providerId.includes('zhipu')) {
        apiKey = process.env.GLM_5_2_API_KEY || process.env.ZHIPU_API_KEY || '';
        // GLM-4.7-Flash uses different model name than GLM-5.2
        realModel = providerId === 'zhipu-glm-4-7-flash' ? 'glm-4.7-flash' : 'glm-5.2';
      } else if (providerId.includes('kimi') || providerId.includes('moonshot')) {
        apiKey = process.env.KIMI_K2_6_API_KEY || process.env.MOONSHOT_API_KEY || '';
        realModel = 'kimi-k2.6';
      }

      return callOpenAICompatible({
        apiKey,
        baseUrl: realUrl,
        model: realModel,
        messages,
        temperature: temp,
        maxTokens,
        isOpenRouter: providerId.includes('openrouter'),
        jsonMode,
      });
    }
  }

  private calculateCost(
    registration: ProviderRegistration,
    inputTokens: number,
    outputTokens: number,
  ): number {
    const inputCost = (inputTokens / 1000) * registration.costPer1kInput;
    const outputCost = (outputTokens / 1000) * registration.costPer1kOutput;
    return inputCost + outputCost;
  }
}

/* ================================================================== */
/* Singleton Export                                                    */
/* ================================================================== */

/** Global singleton instance of the ZaosNeuroRouter */
let _routerInstance: ZaosNeuroRouter | null = null;

/**
 * Get or create the global ZaosNeuroRouter singleton.
 * Safe for server-side use in Next.js API routes.
 */
export async function getNeuroRouter(): Promise<ZaosNeuroRouter> {
  if (!_routerInstance) {
    _routerInstance = new ZaosNeuroRouter();
    await _routerInstance.initialize();
  }
  return _routerInstance;
}

/**
 * Reset the global singleton (useful for testing).
 */
export function resetNeuroRouter(): void {
  _routerInstance = null;
}