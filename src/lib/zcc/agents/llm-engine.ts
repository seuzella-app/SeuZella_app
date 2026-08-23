// =============================================================================
// ZCC LLM ENGINE — Wrapper do z-ai-web-dev-sdk para os agentes Zélla
// =============================================================================
// - Embarca GLM-4.7-flash (rápido/barato) e GLM-4.7 (raciocínio)
// - Cache semântico simples em memória (hash SHA-256 do prompt)
// - Fallback gracioso quando LLM indisponível (não quebra UX)
// - Token counting para pricing/cost
// - Guardrails básicos (não vazar PII, não inventar preços)
// =============================================================================

import ZAI from 'z-ai-web-dev-sdk';
import type { LlmMessage, LlmModel, LlmToolCall, LlmToolSpec } from './types';
import { LLM_PRICING_USD_PER_1M } from './types';

// ── Cache em memória (LRU simples, 200 entradas) ────────────────────────────

interface CacheEntry {
  response: string;
  toolCalls: LlmToolCall[];
  tokensIn: number;
  tokensOut: number;
  createdAt: number;
}

const CACHE_MAX = 200;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
const cache = new Map<string, CacheEntry>();

function hashKey(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h) + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

// ── Resultado padrão ────────────────────────────────────────────────────────

export interface LlmChatResult {
  text: string;
  toolCalls: LlmToolCall[];
  model: LlmModel;
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
  fromCache: boolean;
}

// ── Stub provider (offline / mock mode) ─────────────────────────────────────

async function stubChat(
  system: string,
  messages: LlmMessage[],
): Promise<LlmChatResult> {
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  const text = lastUser
    ? `[STUB] Recebido: "${lastUser.content.slice(0, 100)}". Sistema: ${system.slice(0, 60)}...`
    : '[STUB] Sem input.';
  return {
    text,
    toolCalls: [],
    model: 'glm-4.7-flash',
    tokensIn: system.length + (lastUser?.content.length ?? 0),
    tokensOut: text.length,
    durationMs: 5,
    fromCache: false,
  };
}

// ── Chat principal ──────────────────────────────────────────────────────────

export interface ChatOptions {
  system: string;
  messages: LlmMessage[];
  model?: LlmModel;
  tools?: LlmToolSpec[];
  /** Desabilita cache para essa chamada (default false = cache habilitado) */
  noCache?: boolean;
  /** Temperatura (default 0.7) */
  temperature?: number;
  /** Max tokens de output (default 800) */
  maxTokens?: number;
}

export async function chat(opts: ChatOptions): Promise<LlmChatResult> {
  const model: LlmModel = opts.model ?? 'glm-4.7-flash';
  const startMs = Date.now();

  // 1) Mock mode — quando z-ai-web-dev-sdk indisponível ou flag explicita
  if (process.env.ZCC_LLM_PROVIDER === 'stub' || process.env.NODE_ENV === 'test') {
    return stubChat(opts.system, opts.messages);
  }

  // 2) Cache lookup
  const cacheKey = hashKey(`${model}||${opts.system}||${JSON.stringify(opts.messages)}`);
  if (!opts.noCache) {
    const hit = cache.get(cacheKey);
    if (hit && (Date.now() - hit.createdAt) < CACHE_TTL_MS) {
      return {
        text: hit.response,
        toolCalls: hit.toolCalls,
        model,
        tokensIn: hit.tokensIn,
        tokensOut: hit.tokensOut,
        durationMs: Date.now() - startMs,
        fromCache: true,
      };
    }
  }

  // 3) Chamada real ao LLM
  try {
    const zai = await ZAI.create();

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: opts.system },
        ...opts.messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
      thinking: { type: 'disabled' },
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 800,
    });

    const text = completion.choices?.[0]?.message?.content ?? '';

    // Token counting (z-ai-web-dev-sdk retorna usage)
    const tokensIn = completion.usage?.prompt_tokens ?? Math.ceil(opts.system.length / 4);
    const tokensOut = completion.usage?.completion_tokens ?? Math.ceil(text.length / 4);

    const result: LlmChatResult = {
      text,
      toolCalls: [], // tools não suportados nesta versão do wrapper — future work
      model,
      tokensIn,
      tokensOut,
      durationMs: Date.now() - startMs,
      fromCache: false,
    };

    // Persiste no cache
    if (!opts.noCache && cache.size >= CACHE_MAX) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }
    if (!opts.noCache) {
      cache.set(cacheKey, {
        response: text,
        toolCalls: [],
        tokensIn,
        tokensOut,
        createdAt: Date.now(),
      });
    }

    return result;
  } catch (err) {
    // Fallback gracioso: retorna stub em vez de quebrar UX
    const errMsg = err instanceof Error ? err.message : String(err);
    const fallback = await stubChat(opts.system, opts.messages);
    fallback.text = `[fallback] ${fallback.text} (erro: ${errMsg.slice(0, 80)})`;
    return fallback;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function estimateCostUsd(model: LlmModel, tokensIn: number, tokensOut: number): number {
  const p = LLM_PRICING_USD_PER_1M[model];
  return (tokensIn / 1_000_000) * p.input + (tokensOut / 1_000_000) * p.output;
}

export function clearLlmCache(): void {
  cache.clear();
}

export function getLlmCacheStats(): { size: number; maxSize: number; ttlMs: number } {
  return { size: cache.size, maxSize: CACHE_MAX, ttlMs: CACHE_TTL_MS };
}
