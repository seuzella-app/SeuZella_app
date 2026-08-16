/**
 * Tier Distributor — Roteamento cognitivo 80/15/5
 * =================================================
 *
 * OTIMIZAÇÃO D (do vídeo): divide mensagens em 3 tiers por complexidade:
 *
 *   TIER 1 (Flash — 80% dos casos) → GLM-4.7-flash / DeepSeek Lite / Llama 3
 *     - Saudações, FAQ, Wi-Fi, horário, localização
 *     - Custo: < $0.001/mensagem
 *
 *   TIER 2 (Full — 15% dos casos) → GLM 5.2 / Qwen 2.5 14B / Gemini Flash
 *     - Cotação, Yield Engine, PIX One-Shot, pacotes Réveillon
 *     - Custo: ~$0.005/mensagem
 *
 *   TIER 3 (Reasoning — 5% dos casos) → DeepSeek R1 / Claude Sonnet / Gemini Pro
 *     - Conflitos, cancelamentos, exceções GraphRAG
 *     - Custo: ~$0.02/mensagem
 *
 * IMPACTO: 80% das mensagens custam frações de centavo.
 * Custo médio ponderado: 0.80 × $0.001 + 0.15 × $0.005 + 0.05 × $0.02 = $0.00215/msg
 * vs $0.005/msg (Tier 2 sempre) = 57% de redução.
 *
 * COMO FUNCIONA:
 *   Quando caller não explicita request.tier, este módulo decide
 *   probabilisticamente baseado em features da mensagem:
 *     - Complexidade léxica (palavras longas, multi-cláusula)
 *     - Intenção detectada (cotacao_reserva = tier 2, duvida_geral = tier 1)
 *     - Histórico recente (já falou 3+ vezes = upgrade para tier 2)
 *     - Palavras-chave de conflito (cancelar, reembolso, erro = tier 3)
 *
 * Não substitui o ContextDiscretizer — usa ele como input + adiciona
 * a distribuição probabilística 80/15/5.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export type TierLevel = 1 | 2 | 3;

export interface TierDecision {
  tier: TierLevel;
  reason: string;
  confidence: number;
  // Features que influenciaram a decisão
  features: {
    messageLength: number;
    hasNegotiationKeywords: boolean;
    hasConflictKeywords: boolean;
    hasSimpleFAQKeywords: boolean;
    intentComplexity: 'low' | 'medium' | 'high';
    historicalTurnCount: number;
  };
  // Se foi decidido por distribuição probabilística (vs override explícito)
  probabilistic: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// DISTRIBUIÇÃO 80/15/5
// ─────────────────────────────────────────────────────────────────────────────

const TIER_DISTRIBUTION = {
  tier1: 0.80, // 80% — Flash
  tier2: 0.15, // 15% — Full
  tier3: 0.05, // 5%  — Reasoning
};

// ─────────────────────────────────────────────────────────────────────────────
// PALAVRAS-CHAVE POR TIER
// ─────────────────────────────────────────────────────────────────────────────

const TIER1_KEYWORDS = [
  // Saudações
  'ola', 'oi', 'bom dia', 'boa tarde', 'boa noite', 'obrigado', 'obrigada',
  // FAQ simples
  'wifi', 'wi-fi', 'senha', 'internet', 'horario', 'cafe da manha',
  'cafe', 'estacionamento', 'piscina', 'ar condicionado',
  // Localização
  'onde fica', 'como chegar', 'endereco', 'mapa',
];

const TIER2_KEYWORDS = [
  // Cotação
  'preco', 'preço', 'valor', 'quanto custa', 'quanto fica', 'diaria', 'diária', 'tarifa',
  'pacote', 'reserva', 'reservar', 'disponibilidade', 'quartos',
  // Pagamento
  'pix', 'pagar', 'pagamento', 'caucao', 'cação', 'sinal',
  // Serviço extra
  'check-in antecipado', 'check-out estendido', 'pet', 'entrar mais cedo', 'sair mais tarde',
];

const TIER3_KEYWORDS = [
  // Conflito
  'cancelar', 'cancelamento', 'reembolso', 'estorno', 'chargeback',
  'problema', 'erro', 'errado', 'insatisfeito', 'reclamacao',
  'advogado', 'justica', 'procon', ' Judicial',
  // Exceções
  'excecao', 'caso especial', 'poderia fazer diferente',
];

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decide o tier baseado na mensagem + contexto.
 *
 * Se caller não explicita tier, aplica distribuição 80/15/5
 * ajustada pelas features detectadas (keywords, complexidade, etc).
 *
 * @param message Mensagem do hóspede
 * @param options Override opcional (caller pode forçar tier)
 * @returns Decisão de tier com reason + confidence
 */
export function decideTier(
  message: string,
  options?: {
    explicitTier?: TierLevel;
    historicalTurnCount?: number;
    suggestedTierFromDiscretizer?: number;
  }
): TierDecision {
  const lower = message.toLowerCase();
  const messageLength = message.length;

  // 1. Override explícito do caller — sempre respeita
  if (options?.explicitTier) {
    return {
      tier: options.explicitTier,
      reason: 'Explicit tier override from caller',
      confidence: 1.0,
      features: extractFeatures(lower, messageLength, options.historicalTurnCount ?? 0),
      probabilistic: false,
    };
  }

  // 2. Extrai features
  const features = extractFeatures(lower, messageLength, options?.historicalTurnCount ?? 0);

  // 3. Heurísticas determinísticas (não-probabilísticas)
  // Se tem palavras-chave de conflito → sempre Tier 3
  if (features.hasConflictKeywords) {
    return {
      tier: 3,
      reason: 'Conflict keywords detected (cancelamento/reembolso/erro)',
      confidence: 0.9,
      features,
      probabilistic: false,
    };
  }

  // Se tem palavras-chave de negociação → sempre Tier 2
  if (features.hasNegotiationKeywords) {
    return {
      tier: 2,
      reason: 'Negotiation keywords detected (preco/reserva/pix)',
      confidence: 0.85,
      features,
      probabilistic: false,
    };
  }

  // Se mensagem é muito curta + FAQ simples → Tier 1
  if (features.hasSimpleFAQKeywords && messageLength < 100) {
    return {
      tier: 1,
      reason: 'Simple FAQ keywords + short message',
      confidence: 0.9,
      features,
      probabilistic: false,
    };
  }

  // Se já teve 5+ turnos na conversa → upgrade para Tier 2 (contexto complexo)
  if (features.historicalTurnCount >= 5) {
    return {
      tier: 2,
      reason: `High historical turn count (${features.historicalTurnCount}) — context complex`,
      confidence: 0.7,
      features,
      probabilistic: false,
    };
  }

  // 4. Distribuição probabilística 80/15/5 (quando heurísticas não casam)
  const random = Math.random();
  let tier: TierLevel;
  let reason: string;

  if (random < TIER_DISTRIBUTION.tier1) {
    tier = 1;
    reason = `Probabilistic distribution (80% Tier 1) — random=${random.toFixed(3)}`;
  } else if (random < TIER_DISTRIBUTION.tier1 + TIER_DISTRIBUTION.tier2) {
    tier = 2;
    reason = `Probabilistic distribution (15% Tier 2) — random=${random.toFixed(3)}`;
  } else {
    tier = 3;
    reason = `Probabilistic distribution (5% Tier 3) — random=${random.toFixed(3)}`;
  }

  // 5. Se ContextDiscretizer sugeriu tier diferente, usa o mais alto
  // (previne que mensagens complexas caiam em Tier 1 por acaso)
  if (options?.suggestedTierFromDiscretizer && options.suggestedTierFromDiscretizer > tier) {
    tier = options.suggestedTierFromDiscretizer as TierLevel;
    reason = `Upgraded from probabilistic to Tier ${tier} (ContextDiscretizer suggestion)`;
  }

  return {
    tier,
    reason,
    confidence: 0.6, // probabilístico = confiança média
    features,
    probabilistic: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function extractFeatures(
  lowerMessage: string,
  messageLength: number,
  historicalTurnCount: number
): TierDecision['features'] {
  const hasNegotiationKeywords = TIER2_KEYWORDS.some(kw => lowerMessage.includes(kw));
  const hasConflictKeywords = TIER3_KEYWORDS.some(kw => lowerMessage.includes(kw));
  const hasSimpleFAQKeywords = TIER1_KEYWORDS.some(kw => lowerMessage.includes(kw));

  // Complexidade léxica
  let intentComplexity: 'low' | 'medium' | 'high';
  if (messageLength < 50) {
    intentComplexity = 'low';
  } else if (messageLength < 200) {
    intentComplexity = 'medium';
  } else {
    intentComplexity = 'high';
  }

  return {
    messageLength,
    hasNegotiationKeywords,
    hasConflictKeywords,
    hasSimpleFAQKeywords,
    intentComplexity,
    historicalTurnCount,
  };
}

/**
 * Estima custo médio ponderado com a distribuição 80/15/5.
 *
 * @param costTier1 Custo por mensagem no Tier 1 (ex: $0.001)
 * @param costTier2 Custo por mensagem no Tier 2 (ex: $0.005)
 * @param costTier3 Custo por mensagem no Tier 3 (ex: $0.02)
 * @returns Custo médio ponderado
 */
export function estimateWeightedCost(
  costTier1: number,
  costTier2: number,
  costTier3: number
): {
  weightedCost: number;
  vsAlwaysTier2: number; // % de redução vs sempre usar Tier 2
  vsAlwaysTier3: number; // % de redução vs sempre usar Tier 3
} {
  const weighted = TIER_DISTRIBUTION.tier1 * costTier1 +
                   TIER_DISTRIBUTION.tier2 * costTier2 +
                   TIER_DISTRIBUTION.tier3 * costTier3;

  const alwaysTier2 = costTier2;
  const alwaysTier3 = costTier3;

  return {
    weightedCost: weighted,
    vsAlwaysTier2: ((alwaysTier2 - weighted) / alwaysTier2) * 100,
    vsAlwaysTier3: ((alwaysTier3 - weighted) / alwaysTier3) * 100,
  };
}

/**
 * Stats para logging no ZCC.
 */
export function getTierDistributionStats() {
  return {
    distribution: TIER_DISTRIBUTION,
    description: '80% Flash (Tier 1) + 15% Full (Tier 2) + 5% Reasoning (Tier 3)',
    expectedReduction: '57% vs always Tier 2, 89% vs always Tier 3',
  };
}
