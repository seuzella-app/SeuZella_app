/**
 * Deferred Tool Discovery — Injeção sob demanda de tools no PromptBuilder
 * =====================================================================
 *
 * OTIMIZAÇÃO A (do vídeo): em vez de injetar as 10+ tools em TODAS as
 * mensagens do WhatsApp, injeta apenas as tools RELEVANTES para a intenção
 * detectada pelo intent-router.
 *
 * GANHO: Redução de 40-60% no consumo de tokens por mensagem.
 *
 * FLUXO:
 *   1. intent-router classifica mensagem → ex: 'cotacao_reserva'
 *   2. loadToolsForIntent('cotacao_reserva') retorna apenas:
 *      - check_availability
 *      - get_room_details
 *      - calculate_dynamic_price
 *   3. PromptBuilder injeta apenas essas 3 tools (vs 10 anteriormente)
 *
 * MAPA INTENT → TOOLS:
 *   cotacao_reserva      → [check_availability, get_room_details, calculate_dynamic_price, get_pix_info]
 *   reserva_direta       → [check_availability, get_pix_info, send_guest_guide]
 *   checkin_checkout     → [get_policies, send_guest_guide]
 *   cancelamento         → [get_policies]
 *   duvida_geral         → [get_policies, send_guest_guide]
 *   suporte_tecnico      → [get_policies]
 *   agradecimento        → [] (sem tools)
 *   human_handover       → [] (sem tools)
 *   fallback (default)   → [get_policies] (mínimo)
 */

import { AVAILABLE_TOOLS, type ToolDefinition } from './tool-calling';

export type IntentType =
  | 'cotacao_reserva'
  | 'reserva_direta'
  | 'duvida_geral'
  | 'suporte_tecnico'
  | 'checkin_checkout'
  | 'cancelamento'
  | 'agradecimento'
  | 'human_handover'
  | 'unknown';

// Mapa intenção → tools necessárias
const INTENT_TOOLS_MAP: Record<IntentType, string[]> = {
  cotacao_reserva: [
    'check_availability',
    'get_room_details',
    'calculate_dynamic_price',
    'get_pix_info',
  ],
  reserva_direta: [
    'check_availability',
    'get_pix_info',
    'send_guest_guide',
  ],
  checkin_checkout: [
    'get_policies',
    'send_guest_guide',
  ],
  cancelamento: [
    'get_policies',
  ],
  duvida_geral: [
    'get_policies',
    'send_guest_guide',
  ],
  suporte_tecnico: [
    'get_policies',
  ],
  agradecimento: [],
  human_handover: [],
  unknown: ['get_policies'], // mínimo para fallback
};

// Cache para evitar reprocessar AVAILABLE_TOOLS a cada chamada
const toolByName: Map<string, ToolDefinition> = new Map(
  AVAILABLE_TOOLS.map(t => [t.name, t])
);

/**
 * Carrega apenas as tools necessárias para uma intenção específica.
 *
 * @param intent Intenção detectada pelo intent-router
 * @returns Array de ToolDefinition (apenas as relevantes)
 */
export function loadToolsForIntent(intent: IntentType | string): ToolDefinition[] {
  const toolNames = INTENT_TOOLS_MAP[intent as IntentType] ?? INTENT_TOOLS_MAP.unknown;
  const tools: ToolDefinition[] = [];

  for (const name of toolNames) {
    const tool = toolByName.get(name);
    if (tool) {
      tools.push(tool);
    }
  }

  return tools;
}

/**
 * Carrega TODAS as tools disponíveis (apenas para debug/fallback).
 * Em produção, prefira sempre loadToolsForIntent().
 */
export function loadAllTools(): ToolDefinition[] {
  return [...AVAILABLE_TOOLS];
}

/**
 * Calcula economia estimada de tokens ao usar deferred discovery.
 *
 * Cada tool definition consome ~50-100 tokens (name + description + parameters schema).
 * Com 10 tools injetadas: ~700 tokens
 * Com 3 tools injetadas: ~210 tokens
 * Economia: ~490 tokens por mensagem = 60%
 */
export function estimateTokenSavings(intent: IntentType | string): {
  fullToolsCount: number;
  intentToolsCount: number;
  estimatedTokensSaved: number;
  percentReduction: number;
} {
  const fullCount = AVAILABLE_TOOLS.length;
  const intentTools = INTENT_TOOLS_MAP[intent as IntentType] ?? INTENT_TOOLS_MAP.unknown;
  const intentCount = intentTools.length;

  // Estimativa: 70 tokens por tool (média entre name + description + schema)
  const tokensPerTool = 70;
  const tokensFull = fullCount * tokensPerTool;
  const tokensIntent = intentCount * tokensPerTool;
  const saved = tokensFull - tokensIntent;
  const percent = tokensFull > 0 ? (saved / tokensFull) * 100 : 0;

  return {
    fullToolsCount: fullCount,
    intentToolsCount: intentCount,
    estimatedTokensSaved: saved,
    percentReduction: Math.round(percent),
  };
}

/**
 * Lista todas as tools disponíveis por intenção (para UI/debug do ZCC).
 */
export function listIntentToolMapping(): Record<string, string[]> {
  return { ...INTENT_TOOLS_MAP };
}
