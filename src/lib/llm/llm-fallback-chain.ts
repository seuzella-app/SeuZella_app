// @ts-nocheck — to be fixed in dedicated type refactoring pass
/**
 * LLM Fallback Chain — compatibilidade com código legado
 * ============================================================================
 *
 * Este arquivo agora é um wrapper do llm-router.ts (que tem a cadeia completa
 * de 5 LLMs por setor). Mantido para compatibilidade com código que já importa
 * callLLMWithFallback, callLLMWithCache, classifyComplexity, etc.
 *
 * Cadeia real (no llm-router.ts):
 *   1. Qwen 2.5 72B     → Atendimento WhatsApp (primário)
 *   2. GPT-4o-mini      → Smart Locks
 *   3. DeepSeek-V3      → Yield & Finanças
 *   4. Mistral Small 3  → Segurança & Pentest
 *   5. Llama 3.3 70B    → Contingência (Groq)
 *
 * Fallback universal: Qwen → Zai GLM → Groq Llama → fallback local
 * ============================================================================
 */

export { callLLMBySector, callConciergeLLM, callLocksLLM, callYieldLLM, callSecurityLLM, callContingencyLLM, getLLMStatus, SECTOR_MODELS } from './llm-router';
export type { LLMSector, LLMProvider, LLMModelConfig, LLMCallResult } from './llm-router';

import { callLLMBySector, callLLMWithCache as routerCallWithCache } from './llm-router';
import type { LLMSector, LLMCallResult } from './llm-router';

// ─────────────────────────────────────────────────────────────────────────────
// COMPATIBILIDADE — classifyComplexity + callLLMWithFallback + callLLMWithCache
// ─────────────────────────────────────────────────────────────────────────────

export type ModelTier = 'fast' | 'balanced' | 'powerful';

export function classifyComplexity(message: string): ModelTier {
  const lower = message.toLowerCase();
  const wordCount = message.split(/\s+/).length;

  if (
    lower.includes('reclama') || lower.includes('processo') ||
    lower.includes('advogad') || lower.includes('direitos do consumidor') ||
    (lower.includes('cancelamento') && lower.includes('reembolso')) ||
    wordCount > 100
  ) {
    return 'powerful';
  }

  if (
    lower.includes('desconto') || lower.includes('mais barato') ||
    lower.includes('preocupad') || lower.includes('como funciona') ||
    lower.includes('explica') || wordCount > 30
  ) {
    return 'balanced';
  }

  return 'fast';
}

/**
 * callLLMWithFallback — mantido para compatibilidade.
 * Internamente delega para callLLMBySector('whatsapp_concierge', ...)
 * que usa Qwen 2.5 72B como primário.
 */
export async function callLLMWithFallback(
  prompt: string,
  preferredTier?: ModelTier,
): Promise<LLMCallResult> {
  // Mapeia tier → setor (todos usam Qwen para concierge, mas respeitam complexidade)
  const sector: LLMSector = 'whatsapp_concierge';
  return callLLMBySector(sector, prompt);
}

/**
 * callLLMWithCache — mantido para compatibilidade.
 */
export async function callLLMWithCache(
  prompt: string,
  cacheTTL: number = 3_600_000,
): Promise<LLMCallResult & { cached: boolean }> {
  return routerCallWithCache('whatsapp_concierge', prompt, undefined, cacheTTL);
}
