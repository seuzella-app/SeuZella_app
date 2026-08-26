/**
 * Prompt Caching Service — Estrutura append-only + prefix estático
 * =================================================================
 *
 * OTIMIZAÇÃO B (do vídeo): estruturar o system prompt em 2 partes:
 *   1. PREFIX ESTÁTICO — diretrizes da pousada, regras GraphRAG
 *      → permanece idêntico entre chamadas → ATIVA cache 80% off
 *   2. BLOCO DINÂMICO APPEND-ONLY — histórico de mensagens
 *      → apenas acrescenta novas falas ao final, sem reescrever
 *
 * GANHO: -80% no custo de reprocessamento + <1s de resposta
 *
 * PROVEDORES QUE SUPORTAM PROMPT CACHING:
 *   - Anthropic Claude: cache_control: { type: 'ephemeral' } (5min TTL)
 *   - Google Gemini: cachedContent API (1h TTL)
 *   - DeepSeek: automatic prefix caching (4h TTL)
 *   - OpenAI: automatic prefix caching (5-10min TTL)
 *
 * ESTRUTURA FINAL DO PROMPT:
 *
 *   [PREFIXO ESTÁTICO - CACHED]
 *   ├── Identidade do Zélla (Ponytail Directive)
 *   ├── Diretrizes da pousada (fixas por tenant)
 *   ├── Regras GraphRAG (fixas por tenant)
 *   └── Tools disponíveis para esta intenção (deferred discovery)
 *
 *   [BLOCO DINÂMICO APPEND-ONLY]
 *   ├── Mensagem 1 (user)
 *   ├── Mensagem 2 (assistant)
 *   ├── Mensagem 3 (user)
 *   └── Mensagem atual (user) ← sempre nova
 *
 * A chave do cache é gerada a partir do PREFIXO ESTÁTICO.
 * Enquanto o prefixo não muda, todas as chamadas subsequentes
 * reutilizam o cache com 80% de desconto.
 */

import type { AdapterMessage } from '@/lib/ai/llm-adapters';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export interface StaticPrefix {
  // Conteúdo estático do system prompt (gerado uma vez por sessão)
  content: string;
  // Hash para validar se mudou desde última chamada
  hash: string;
  // TTL do cache (depende do provider)
  cacheTtlMs: number;
}

export interface CachedPrompt {
  // Mensagem system com cache_control (se provider suportar)
  systemMessage: AdapterMessage;
  // Histórico append-only (não reescreve, só adiciona)
  historyMessages: AdapterMessage[];
  // Mensagem atual (sempre nova)
  currentMessage: AdapterMessage;
  // Metadados para logging
  metadata: {
    prefixHash: string;
    historyLength: number;
    estimatedInputTokens: number;
    cachedTokens: number; // tokens que serão cobrados com 80% off
    estimatedSavingsUsd: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────────────────────

const PONYTAIL_DIRECTIVE = `=== CÉREBRO ZÉLLA — DIRECTIVE (STATIC) ===
Você é o assistente inteligente da pousada. Atende pelo WhatsApp.
Seu tom é 100% humano: recepcionista brasileira experiente, calorosa e profissional.
NUNCA revele que é IA. NUNCA use jargão técnico. Sempre cumprimente pelo nome.
LGPD: nunca exponha dados de outros hóspedes.`;

const CACHE_TTL_MS = {
  anthropic: 5 * 60 * 1000, // 5 min
  gemini: 60 * 60 * 1000, // 1h
  deepseek: 4 * 60 * 60 * 1000, // 4h
  openai: 10 * 60 * 1000, // 10 min
  default: 5 * 60 * 1000, // 5 min
};

/**
 * Constrói o prefixo estático do system prompt para uma pousada.
 *
 * Este prefixo NÃO muda entre chamadas da mesma sessão — permite que
 * provedores de LLM reutilizem o cache com 80% de desconto.
 *
 * Composição:
 *   1. Ponytail Directive (identidade do Zélla) — fixa para sempre
 *   2. Diretrizes da pousada — fixas por tenant (name, city, pix)
 *   3. Regras GraphRAG — fixas por tenant (politicas, regras)
 *   4. Tools disponíveis — fixas por intenção (deferred discovery)
 */
export function buildStaticPrefix(params: {
  propertyName: string;
  city?: string;
  pixKey?: string;
  pixKeyType?: string;
  graphRules?: string; // regras GraphRAG da pousada
  toolsDescription?: string; // tools para esta intenção (deferred)
}): StaticPrefix {
  const {
    propertyName,
    city = '',
    pixKey,
    pixKeyType,
    graphRules = '',
    toolsDescription = '',
  } = params;

  // Estrutura fixa — ordem NUNCA muda entre chamadas
  const content = `${PONYTAIL_DIRECTIVE}

=== DIRETRIZES DA POUSADA (STATIC) ===
- Nome: ${propertyName}
- Cidade: ${city}
${pixKey ? `- Chave PIX (${pixKeyType || 'chave'}): ${pixKey}` : ''}

=== REGRAS DA POUSADA (GraphRAG STATIC) ===
${graphRules || '(Sem regras GraphRAG configuradas)'}

=== FERRAMENTAS DISPONÍVEIS (DEFERRED DISCOVERY) ===
${toolsDescription || '(Sem ferramentas necessárias para esta intenção)'}`;

  // Hash simples para detectar mudanças
  const hash = simpleHash(content);

  return {
    content,
    hash,
    cacheTtlMs: CACHE_TTL_MS.default,
  };
}

/**
 * Constrói o prompt completo cacheável.
 *
 * Estrutura final:
 *   [system: PREFIXO ESTÁTICO (cached)]
 *   [user: mensagem 1 do histórico]
 *   [assistant: resposta 1]
 *   [user: mensagem 2]
 *   ...
 *   [user: mensagem atual]
 *
 * O histórico é APPEND-ONLY — nunca reescreve turnos anteriores.
 * Isso maximiza o cache hit rate (provedores reutilizam o prefixo comum).
 */
export function buildCachedPrompt(params: {
  staticPrefix: StaticPrefix;
  history: Array<{ from: 'guest' | 'ai' | 'human'; content: string }>;
  currentMessage: string;
  provider?: 'anthropic' | 'gemini' | 'deepseek' | 'openai' | 'default';
}): CachedPrompt {
  const { staticPrefix, history, currentMessage, provider = 'default' } = params;

  // 1. System message — com cache_control se provider suportar
  const systemMessage: AdapterMessage = {
    role: 'system',
    content: staticPrefix.content,
    // @ts-expect-error — cache_control é específico do Anthropic, não está no tipo base
    cache_control: provider === 'anthropic' ? { type: 'ephemeral' } : undefined,
  };

  // 2. Histórico append-only (últimas 6 mensagens)
  const historyMessages: AdapterMessage[] = history
    .slice(-6) // máximo 6 turnos para não estourar contexto
    .map(msg => ({
      role: msg.from === 'guest' ? 'user' : 'assistant',
      content: msg.content,
    }));

  // 3. Mensagem atual (sempre nova)
  const currentMessageObj: AdapterMessage = {
    role: 'user',
    content: currentMessage,
  };

  // 4. Metadados para logging
  const estimatedInputTokens = estimateTokens(staticPrefix.content) +
    historyMessages.reduce((s, m) => s + estimateTokens(m.content), 0) +
    estimateTokens(currentMessage);

  // Tokens cached = prefixo estático (se provider suportar)
  const supportsCaching = ['anthropic', 'gemini', 'deepseek', 'openai'].includes(provider);
  const cachedTokens = supportsCaching ? estimateTokens(staticPrefix.content) : 0;

  // Economia: 80% off nos tokens cached
  // Custo médio: $0.00140/1k tokens (input)
  const estimatedSavingsUsd = (cachedTokens / 1000) * 0.00140 * 0.80;

  return {
    systemMessage,
    historyMessages,
    currentMessage: currentMessageObj,
    metadata: {
      prefixHash: staticPrefix.hash,
      historyLength: historyMessages.length,
      estimatedInputTokens,
      cachedTokens,
      estimatedSavingsUsd,
    },
  };
}

/**
 * Verifica se o prefixo estático mudou desde a última chamada.
 * Se mudou, o cache é invalidado e provedor precisa re-cachear.
 */
export function hasPrefixChanged(
  currentPrefix: StaticPrefix,
  previousHash?: string
): boolean {
  if (!previousHash) return true; // primeira chamada
  return currentPrefix.hash !== previousHash;
}

/**
 * Lista provedores que suportam prompt caching nativo.
 */
export function getPromptCachingProviders(): Array<{
  provider: string;
  cacheTtlMs: number;
  discountPercent: number;
}> {
  return [
    { provider: 'anthropic', cacheTtlMs: CACHE_TTL_MS.anthropic, discountPercent: 90 },
    { provider: 'gemini', cacheTtlMs: CACHE_TTL_MS.gemini, discountPercent: 80 },
    { provider: 'deepseek', cacheTtlMs: CACHE_TTL_MS.deepseek, discountPercent: 85 },
    { provider: 'openai', cacheTtlMs: CACHE_TTL_MS.openai, discountPercent: 50 },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estimativa simples de tokens (4 chars ≈ 1 token).
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Hash simples (FNV-1a) para detectar mudanças no prefixo.
 */
function simpleHash(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
