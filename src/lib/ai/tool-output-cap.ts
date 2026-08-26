/**
 * Tool Output Cap — Limita resposta de tools a 250 tokens
 * ==========================================================
 *
 * OTIMIZAÇÃO C (do vídeo): ao consultar tabelas de disponibilidade,
 * regras extensas, ou qualquer tool que retorne JSON grande, NUNCA
 * passar o JSON bruto gigantesco para o LLM.
 *
 * GANHO: Evita estouro de contexto + reduz custo de input tokens.
 *
 * USO (no tool-calling.ts):
 *   import { capToolOutput } from '@/lib/ai/tool-output-cap';
 *
 *   const rawOutput = JSON.stringify(toolResult.data);
 *   const cappedOutput = capToolOutput(rawOutput, {
 *     maxTokens: 250,
 *     strategy: 'summarize', // ou 'truncate' ou 'key-fields'
 *   });
 *
 * ESTRATÉGIAS:
 *   1. truncate — corta no limite (simples, pode perder info)
 *   2. summarize — extrai campos principais (preserva info crítica)
 *   3. key-fields — retorna apenas campos essenciais (mais agressivo)
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_MAX_TOKENS = 250;
const DEFAULT_MAX_CHARS = 1000; // 250 tokens × 4 chars/token

// Campos essenciais por tipo de tool (para strategy=key-fields)
const ESSENTIAL_FIELDS: Record<string, string[]> = {
  check_availability: ['available', 'roomType', 'date', 'price'],
  get_room_details: ['name', 'type', 'capacity', 'price', 'status'],
  get_policies: ['checkin', 'checkout', 'pets', 'smoking'],
  get_pix_info: ['pixKey', 'pixKeyType', 'amount'],
  get_occupancy: ['totalRooms', 'occupiedRooms', 'rate'],
  send_guest_guide: ['sent', 'guideUrl'],
  calculate_dynamic_price: ['basePrice', 'yieldPrice', 'tier'],
  request_deposit: ['amount', 'status'],
  get_upsell_items: ['items', 'totalExtra'],
  get_fnrh_status: ['status', 'missingFields'],
};

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export type CapStrategy = 'truncate' | 'summarize' | 'key-fields';

export interface CapOptions {
  maxTokens?: number;
  maxChars?: number;
  strategy?: CapStrategy;
  toolName?: string; // para strategy=key-fields
}

export interface CapResult {
  output: string;
  originalTokens: number;
  cappedTokens: number;
  truncated: boolean;
  strategy: CapStrategy;
}

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Limita output de tool a N tokens (default 250).
 *
 * @param rawOutput String original (geralmente JSON.stringify do toolResult.data)
 * @param options Configuração
 * @returns String limitada + metadados
 */
export function capToolOutput(rawOutput: string, options: CapOptions = {}): CapResult {
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const maxChars = options.maxChars ?? maxTokens * 4;
  const strategy = options.strategy ?? 'summarize';
  const {toolName} = options;

  const originalTokens = estimateTokens(rawOutput);

  // Se já está dentro do limite, retorna como está
  if (originalTokens <= maxTokens) {
    return {
      output: rawOutput,
      originalTokens,
      cappedTokens: originalTokens,
      truncated: false,
      strategy,
    };
  }

  // Aplica estratégia de redução
  let output: string;
  switch (strategy) {
    case 'truncate':
      output = truncateStrategy(rawOutput, maxChars);
      break;
    case 'key-fields':
      output = keyFieldsStrategy(rawOutput, toolName, maxChars);
      break;
    case 'summarize':
    default:
      output = summarizeStrategy(rawOutput, toolName, maxChars);
      break;
  }

  const cappedTokens = estimateTokens(output);

  return {
    output,
    originalTokens,
    cappedTokens,
    truncated: true,
    strategy,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTRATÉGIAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Truncate — corta simples no limite de chars.
 * Mais rápido, mas pode cortar JSON no meio.
 */
function truncateStrategy(output: string, maxChars: number): string {
  if (output.length <= maxChars) return output;
  return `${output.slice(0, maxChars - 3) }...`;
}

/**
 * Summarize — tenta parsear JSON e extrai campos principais.
 * Se não for JSON, cai para truncate.
 */
function summarizeStrategy(output: string, toolName?: string, maxChars = DEFAULT_MAX_CHARS): string {
  try {
    const parsed = JSON.parse(output);

    // Se é array, resume para top N items
    if (Array.isArray(parsed)) {
      const top = parsed.slice(0, 5);
      const summary = {
        count: parsed.length,
        showing: Math.min(5, parsed.length),
        items: top,
        truncated: parsed.length > 5,
      };
      const result = JSON.stringify(summary);
      return result.length > maxChars ? truncateStrategy(result, maxChars) : result;
    }

    // Se é objeto, extrai campos essenciais
    if (typeof parsed === 'object' && parsed !== null) {
      const fields = toolName ? ESSENTIAL_FIELDS[toolName] : null;
      if (fields) {
        const extracted: any = {};
        for (const field of fields) {
          if (parsed[field] !== undefined) {
            extracted[field] = parsed[field];
          }
        }
        extracted._note = `Resumido de ${Object.keys(parsed).length} campos para ${fields.length} essenciais`;
        const result = JSON.stringify(extracted);
        return result.length > maxChars ? truncateStrategy(result, maxChars) : result;
      }
    }

    // Fallback: truncate
    return truncateStrategy(output, maxChars);
  } catch {
    // Não é JSON — truncate puro
    return truncateStrategy(output, maxChars);
  }
}

/**
 * Key-fields — retorna APENAS campos essenciais definidos por tool.
 * Mais agressivo que summarize.
 */
function keyFieldsStrategy(output: string, toolName?: string, maxChars = DEFAULT_MAX_CHARS): string {
  if (!toolName) {
    return summarizeStrategy(output, undefined, maxChars);
  }

  const fields = ESSENTIAL_FIELDS[toolName];
  if (!fields) {
    return summarizeStrategy(output, toolName, maxChars);
  }

  try {
    const parsed = JSON.parse(output);
    const extracted: any = {};
    for (const field of fields) {
      if (parsed[field] !== undefined) {
        extracted[field] = parsed[field];
      }
    }
    const result = JSON.stringify(extracted);
    return result.length > maxChars ? truncateStrategy(result, maxChars) : result;
  } catch {
    return truncateStrategy(output, maxChars);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Stats para logging no ZCC (custo economizado por tool call).
 */
export function getCapStats(): {
  defaultMaxTokens: number;
  essentialFieldsConfigured: number;
  strategiesAvailable: CapStrategy[];
} {
  return {
    defaultMaxTokens: DEFAULT_MAX_TOKENS,
    essentialFieldsConfigured: Object.keys(ESSENTIAL_FIELDS).length,
    strategiesAvailable: ['truncate', 'summarize', 'key-fields'],
  };
}
