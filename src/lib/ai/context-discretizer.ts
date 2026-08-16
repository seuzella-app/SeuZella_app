/**
 * Context Discretizer for ZaosNeuroRouter
 *
 * Fast (<5ms) context classification into 32 predefined buckets using
 * regex patterns and keyword matching. No ML inference required —
 * pure deterministic matching for ultra-low latency.
 *
 * Each bucket maps to a suggested provider tier:
 *   Tier 1 (Budget):  Simple, well-structured queries
 *   Tier 2 (Mid):     Standard operational tasks
 *   Tier 3 (Premium): Complex reasoning, analysis, composition
 */

export interface ClassificationResult {
  /** The matched context bucket */
  bucket: string;
  /** Confidence score between 0 and 1 */
  confidence: number;
  /** Suggested provider tier (1-3) */
  suggestedTier: number;
  /** Matched keyword(s) that drove the classification */
  matchedKeywords: string[];
}

interface BucketRule {
  /** The bucket identifier */
  bucket: string;
  /** Suggested tier for this bucket */
  suggestedTier: number;
  /** Ordered list of regex patterns (first match wins highest confidence) */
  patterns: Array<{
    regex: RegExp;
    keywords: string[];
    confidence: number;
  }>;
}

/** All 32 context buckets used by ZaosNeuroRouter */
export const CONTEXT_BUCKETS = [
  'reservation_query', 'pricing_optimization', 'guest_communication',
  'review_analysis', 'revenue_diagnosis', 'competitor_monitoring',
  'lead_prospection', 'email_composition', 'whatsapp_template',
  'checkin_assistance', 'checkout_assistance', 'upselling',
  'housekeeping_request', 'maintenance_request', 'complaint_handling',
  'local_recommendation', 'weather_info', 'payment_processing',
  'booking_cancellation', 'availability_check', 'amenity_info',
  'transportation', 'event_planning', 'dietary_request',
  'pet_policy', 'accessibility', 'group_booking', 'long_stay',
  'corporate_booking', 'ota_management', 'channel_management',
  'financial_reporting',
] as const;

export type ContextBucket = (typeof CONTEXT_BUCKETS)[number];

/**
 * Build all bucket rules with Portuguese-first patterns for Brazilian pousadas.
 */
function buildBucketRules(): BucketRule[] {
  return [
    {
      bucket: 'reservation_query',
      suggestedTier: 1,
      patterns: [
        { regex: /\b(reserva|reserv[aei]|booking|reservou|reservar|minha reserva|confirmar reserva|número da reserva)\b/i, keywords: ['reserva', 'booking'], confidence: 0.95 },
        { regex: /\b(quero reservar|fazer reserva|agendar|dispon[íi]vel para)\b/i, keywords: ['reservar', 'agendar'], confidence: 0.90 },
      ],
    },
    {
      bucket: 'pricing_optimization',
      suggestedTier: 3,
      patterns: [
        { regex: /\b(diagn[oó]stico de receita|otimiz[aã]r pre[cç]o|pre[cç]o din[aâ]mico|yield|revenue management|estrat[eé]gia de pre[cç]o|curva de demanda)\b/i, keywords: ['preço dinâmico', 'yield', 'revenue'], confidence: 0.92 },
        { regex: /\b(reajustar tarifas|taxa de ocupa[cç][aã]o|revpar|adr|pre[cç]o m[eé]dio|an[aá]lise de pre[cç]os)\b/i, keywords: ['tarifa', 'revpar', 'ADR'], confidence: 0.88 },
      ],
    },
    {
      bucket: 'guest_communication',
      suggestedTier: 2,
      patterns: [
        { regex: /\b(responder (ao |a )?h[oó]spede|mensagem (para o|pro) h[oó]spede|comunicado|aviso ao h[oó]spede|enviar mensagem)\b/i, keywords: ['hóspede', 'mensagem', 'comunicado'], confidence: 0.88 },
        { regex: /\b(notifica[cç][aã]o|lembrar (do |de )?check|pr[eé]-check-in|informar h[oó]spede)\b/i, keywords: ['notificação', 'pré-check-in'], confidence: 0.85 },
      ],
    },
    {
      bucket: 'review_analysis',
      suggestedTier: 2,
      patterns: [
        { regex: /\b(an[aá]lise (de )?(avalia[cç][oõ]es|reviews|review)|sentimento|an[aá]lise de sentimento|avalia[cç][aã]o do google|tripadvisor)\b/i, keywords: ['review', 'avaliação', 'sentimento'], confidence: 0.92 },
        { regex: /\b(feedback|resposta (ao |a )?review|responder avalia[cç][aã]o|reclama[cç][aã]o no google)\b/i, keywords: ['feedback', 'resposta review'], confidence: 0.87 },
      ],
    },
    {
      bucket: 'revenue_diagnosis',
      suggestedTier: 3,
      patterns: [
        { regex: /\b(diagn[oó]stico (de )?receita|receita mensal|relat[oó]rio financeiro completo|an[aá]lise (de )?receita|fluxo de caixa|dre)\b/i, keywords: ['diagnóstico receita', 'receita mensal', 'DRE'], confidence: 0.93 },
        { regex: /\b(margem de lucro|lucratividade|break.even|ponto de equilibrio|custo por quarto|custo operacional)\b/i, keywords: ['margem', 'break-even', 'custo por quarto'], confidence: 0.90 },
      ],
    },
    {
      bucket: 'competitor_monitoring',
      suggestedTier: 2,
      patterns: [
        { regex: /\b(concorrente|competidor|monitorar pre[cç]os|pre[cç]o (da |do )?concorr[eê]ncia|benchmark|comparar pre[cç]os)\b/i, keywords: ['concorrente', 'benchmark', 'comparar preços'], confidence: 0.90 },
        { regex: /\b(market share|participa[cç][aã]o de mercado|an[aá]lise competitiva|intelig[eê]ncia de mercado)\b/i, keywords: ['market share', 'inteligência de mercado'], confidence: 0.88 },
      ],
    },
    {
      bucket: 'lead_prospection',
      suggestedTier: 2,
      patterns: [
        { regex: /\b(prospec[cç][aã]o|captar h[oó]spedes|encontrar clientes|leads|funil de vendas|crm)\b/i, keywords: ['prospecção', 'leads', 'funil'], confidence: 0.90 },
        { regex: /\b(pousada (sem |n[aã]o tem )?(sistema|software|gest[aã]o)|potenciais clientes|pousadas (para |que )?(vender|oferecer|contatar))\b/i, keywords: ['potenciais clientes', 'pousadas sem sistema'], confidence: 0.85 },
      ],
    },
    {
      bucket: 'email_composition',
      suggestedTier: 2,
      patterns: [
        { regex: /\b(redigir? e?mail|escrever? e?mail|compor? e?mail|modelo de e?mail|template (de )?e?mail|e?mail (de )?(marketing|boas.vindas|follow.up|confirma[cç][aã]o))\b/i, keywords: ['email', 'redigir email', 'template email'], confidence: 0.92 },
      ],
    },
    {
      bucket: 'whatsapp_template',
      suggestedTier: 2,
      patterns: [
        { regex: /\b(template (de )?whatsapp|modelo (de )?whatsapp|mensagem (de )?whatsapp|whatsapp (de )?(boas.vindas|confirma[cç][aã]o|lembrete|marketing))\b/i, keywords: ['whatsapp template', 'modelo whatsapp'], confidence: 0.93 },
        { regex: /\b(mensagem (para|pr[oó]) (h[oó]spede|cliente)|resposta (de )?whatsapp|script (de )?whatsapp)\b/i, keywords: ['mensagem para hóspede', 'script whatsapp'], confidence: 0.87 },
      ],
    },
    {
      bucket: 'checkin_assistance',
      suggestedTier: 1,
      patterns: [
        { regex: /\b(check.in|chegada|entrando|fazer check.in|hor[aá]rio (de )?check.in|registrar chegada|chave (do )?quarto|porta (do )?quarto)\b/i, keywords: ['check-in', 'chegada', 'chave do quarto'], confidence: 0.96 },
        { regex: /\b(aonde (fico|fica o quarto)|como entrar|senha (da |do )?(quarto|porta|wi.fi|wifi))\b/i, keywords: ['senha', 'como entrar'], confidence: 0.88 },
      ],
    },
    {
      bucket: 'checkout_assistance',
      suggestedTier: 1,
      patterns: [
        { regex: /\b(check.out|sa[ií]da|sair (do )?quarto|fazer check.out|hor[aá]rio (de )?check.out|devolver chave|encerrar (estadia|hospedagem))\b/i, keywords: ['check-out', 'saída', 'devolver chave'], confidence: 0.96 },
      ],
    },
    {
      bucket: 'upselling',
      suggestedTier: 2,
      patterns: [
        { regex: /\b(upsell|upgrade|melhorar quarto|sugest[aã]o (de )?(upgrade|melhoria)|oferta especial|promo[cç][aã]o (para|do) h[oó]spede)\b/i, keywords: ['upsell', 'upgrade', 'oferta especial'], confidence: 0.90 },
        { regex: /\b(late checkout|checkout tardio|café da manh[aã]|spa|piscina|experi[eê]ncia|tour|passeio)\b/i, keywords: ['late checkout', 'café da manhã', 'passeio'], confidence: 0.82 },
      ],
    },
    {
      bucket: 'housekeeping_request',
      suggestedTier: 1,
      patterns: [
        { regex: /\b(limpeza|arruma[cç][aã]o|camareira|housekeeping|trocar (toalha|len[cç]ol|roupa)|quarto sujo|n[aã]o foi limpo|pedir (toalha|len[cç]ol|travesseiro))\b/i, keywords: ['limpeza', 'toalha', 'lençol'], confidence: 0.94 },
        { regex: /\b(sabonete|papel higi[eê]nico|shampoo|condicionador|amenidade)\b/i, keywords: ['sabonete', 'shampoo', 'papel higiênico'], confidence: 0.88 },
      ],
    },
    {
      bucket: 'maintenance_request',
      suggestedTier: 1,
      patterns: [
        { regex: /\b(manuten[cç][aã]o|consertar|reparar|quebrad[oa]|n[aã]o funciona|ar.condicionado|tv|chuveiro|torneira|luz|tomada| ventilador|geladeira)\b/i, keywords: ['manutenção', 'quebrado', 'não funciona'], confidence: 0.93 },
        { regex: /\b(vazamento|inund[açc][aã]o|curto.circuito|sem [aá]gua|sem luz|barulho)\b/i, keywords: ['vazamento', 'curto-circuito', 'barulho'], confidence: 0.90 },
      ],
    },
    {
      bucket: 'complaint_handling',
      suggestedTier: 3,
      patterns: [
        { regex: /\b(reclama[cç][aã]o|insatisfa[cç][aã]o|problema com|estou insatisfeit[oa]|p[eé]ssimo|ruim|horr[ií]vel|péssimo atendimento|supervisor|gerente)\b/i, keywords: ['reclamação', 'insatisfeito', 'péssimo'], confidence: 0.93 },
        { regex: /\b(refund|reembolso|compens[açc][aã]o|desconto|indeniza[cç][aã]o|escalar|urgente|emerg[eê]ncia)\b/i, keywords: ['reembolso', 'compensação', 'escalar'], confidence: 0.90 },
      ],
    },
    {
      bucket: 'local_recommendation',
      suggestedTier: 1,
      patterns: [
        { regex: /\b(restaurant(?:e|es)|comer|almo[cç]ar|jantar|lugar (para )?comer|passeio|turismo|ponto tur[ií]stico|praia|trilha|cachoeira|museu)\b/i, keywords: ['restaurante', 'passeio', 'praia'], confidence: 0.88 },
        { regex: /\b(o que fazer|onde ir|recomend|dica (de )?(lugar|restaurante|passeio)|atividade|excurs[aã]o|mirante)\b/i, keywords: ['o que fazer', 'onde ir', 'dica'], confidence: 0.85 },
      ],
    },
    {
      bucket: 'weather_info',
      suggestedTier: 1,
      patterns: [
        { regex: /\b(tempo|clima|previs[aã]o (do )?tempo|chuva|sol|temperatura|vento|frio|calor|ensaio caiu|vai chover)\b/i, keywords: ['tempo', 'clima', 'previsão'], confidence: 0.95 },
      ],
    },
    {
      bucket: 'payment_processing',
      suggestedTier: 2,
      patterns: [
        { regex: /\b(pagamento|pagar|pago|pix|cart[aã]o|boleto|transfer[eê]ncia|cobran[cç]a|fatura|recibo|nota fiscal|cupom)\b/i, keywords: ['pagamento', 'pix', 'cartão'], confidence: 0.92 },
        { regex: /\b(estorno|chargeback|disputa|fraude|transa[cç][aã]o (reprovada|negada))\b/i, keywords: ['estorno', 'chargeback', 'fraude'], confidence: 0.88 },
      ],
    },
    {
      bucket: 'booking_cancellation',
      suggestedTier: 1,
      patterns: [
        { regex: /\b(cancel[aei]|cancelamento|desistir|n[aã]o vou (mais |poder )?ir|remarcar|reagendar|pol[ií]tica de cancelamento)\b/i, keywords: ['cancelar', 'cancelamento', 'desistir'], confidence: 0.95 },
      ],
    },
    {
      bucket: 'availability_check',
      suggestedTier: 1,
      patterns: [
        { regex: /\b(dispon[ií]vel|disponibilidade|tem vaga|tem quarto|quarto (dispon[ií]vel|livre)|quartos (dispon[ií]veis|livres)|data (dispon[ií]vel|livre))\b/i, keywords: ['disponível', 'tem vaga', 'quarto disponível'], confidence: 0.95 },
      ],
    },
    {
      bucket: 'amenity_info',
      suggestedTier: 1,
      patterns: [
        { regex: /\b(piscina|wi.fi|wifi|academia|spa|estacionamento|churrasqueira|playground|sal[aã]o (de )?(festas|eventos)|lareira)\b/i, keywords: ['piscina', 'wifi', 'estacionamento'], confidence: 0.94 },
        { regex: /\b(hor[aá]rio (da )?(piscina|academia|spa|restaurante|bar)|funcionamento|abre|fecha)\b/i, keywords: ['horário da piscina', 'funcionamento'], confidence: 0.90 },
      ],
    },
    {
      bucket: 'transportation',
      suggestedTier: 1,
      patterns: [
        { regex: /\b(traslado|transfer|aeroporto|t[aá]xi|uber|99|carro|aluguel (de )?carro|how to get|como chegar|ônibus|[oô]nibus|van)\b/i, keywords: ['traslado', 'aeroporto', 'transfer'], confidence: 0.90 },
      ],
    },
    {
      bucket: 'event_planning',
      suggestedTier: 3,
      patterns: [
        { regex: /\b(evento|casamento|anivers[aá]rio|corporativo|retiro|workshop|palestra|fechar (para )?evento|buffet|decora[cç][aã]o)\b/i, keywords: ['evento', 'casamento', 'corporativo'], confidence: 0.90 },
        { regex: /\b(capacidade (para )?evento|grupo grande|festa|celebra[cç][aã]o|encontro|reuni[aã]o)\b/i, keywords: ['capacidade evento', 'grupo grande'], confidence: 0.85 },
      ],
    },
    {
      bucket: 'dietary_request',
      suggestedTier: 1,
      patterns: [
        { regex: /\b(vegetarian[oa]|vegano|alergia|intoler[aâ]ncia|sem gl[uú]ten|cel[ií]aco|sem lactose|halal|kosher|dieta especial|restri[cç][aã]o alimentar)\b/i, keywords: ['vegetariano', 'alergia', 'sem glúten'], confidence: 0.94 },
        { regex: /\b(café da manh[aã]|café|menu|card[aá]pio|refei[cç][aã]o|jantar (incluso|no)|comida)\b/i, keywords: ['café da manhã', 'cardápio', 'refeição'], confidence: 0.82 },
      ],
    },
    {
      bucket: 'pet_policy',
      suggestedTier: 1,
      patterns: [
        { regex: /\b(cachorro|gato|pet|animal (de )?estima[cç][aã]o|c[aã]es|gatos|pets|aceita (cachorro|pet|animal))\b/i, keywords: ['cachorro', 'pet', 'animal de estimação'], confidence: 0.96 },
      ],
    },
    {
      bucket: 'accessibility',
      suggestedTier: 1,
      patterns: [
        { regex: /\b(acessibilidade|cadeirante|defici[eê]ncia|pcd|cama (para )?cadeirante|rampa|elevador|banheiro adaptado)\b/i, keywords: ['acessibilidade', 'PCD', 'cadeirante'], confidence: 0.95 },
      ],
    },
    {
      bucket: 'group_booking',
      suggestedTier: 2,
      patterns: [
        { regex: /\b(grupo|grupos|reserva (de )?grupo|v[aá]rios quartos|bloqueio (de )?quartos|muitas pessoas|turma|fam[ií]lia grande)\b/i, keywords: ['grupo', 'vários quartos', 'bloqueio'], confidence: 0.90 },
      ],
    },
    {
      bucket: 'long_stay',
      suggestedTier: 2,
      patterns: [
        { regex: /\b(longa estadia|estadia longa|mensal|semanal|per[ií]odo longo|extended stay|m[eê]s inteiro|temporada|morar|trabalho remoto)\b/i, keywords: ['longa estadia', 'mensal', 'temporada'], confidence: 0.92 },
      ],
    },
    {
      bucket: 'corporate_booking',
      suggestedTier: 2,
      patterns: [
        { regex: /\b(corporativo|empresa|viagem (de )?neg[oó]cios|b2b|conv[eê]nio|corporation|business travel)\b/i, keywords: ['corporativo', 'empresa', 'negócios'], confidence: 0.90 },
      ],
    },
    {
      bucket: 'ota_management',
      suggestedTier: 2,
      patterns: [
        { regex: /\b(booking\.com|airbnb|expedia|decolar|trivago|ota|canal (de )?venda|calend[aá]rio (de )?disponibilidade|pre[cç]o (no )?booking)\b/i, keywords: ['booking.com', 'airbnb', 'OTA'], confidence: 0.92 },
        { regex: /\b(integra[cç][aã]o (com )?(ota|booking|airbnb)|sincronizar calend[aá]rio|atualizar disponibilidade)\b/i, keywords: ['integração OTA', 'sincronizar calendário'], confidence: 0.87 },
      ],
    },
    {
      bucket: 'channel_management',
      suggestedTier: 2,
      patterns: [
        { regex: /\b(canal (de )?distribui[cç][aã]o|channel manager|gerenciador (de )?canais|multi.canal|direto|site pr[oó]prio)\b/i, keywords: ['channel manager', 'distribuição', 'multi-canal'], confidence: 0.90 },
        { regex: /\b(comiss[aã]o (do )?(booking|airbnb|ota)|taxa (de )?canal|custo (do )?canal)\b/i, keywords: ['comissão booking', 'taxa de canal'], confidence: 0.85 },
      ],
    },
    {
      bucket: 'financial_reporting',
      suggestedTier: 3,
      patterns: [
        { regex: /\b(relat[oó]rio (financeiro|cont[aá]bil|fiscal|de vendas|de despesas)|balan[cç]o|demonstrativo|imposto|nota fiscal|iss|icms|simples nacional)\b/i, keywords: ['relatório financeiro', 'balanço', 'imposto'], confidence: 0.93 },
        { regex: /\b(das|dare|sped|efd|escritura[cç][aã]o|contabilidade|contador|fatura|cobran[cç]a|inadimpl[eê]ncia)\b/i, keywords: ['DAS', 'contabilidade', 'inadimplência'], confidence: 0.88 },
      ],
    },
  ];
}

export class ContextDiscretizer {
  private readonly rules: BucketRule[];

  constructor() {
    this.rules = buildBucketRules();
  }

  /**
   * Classify a message into a context bucket.
   *
   * Uses ordered regex matching: iterates through all bucket rules,
   * tests each pattern against the message, and returns the highest-
   * confidence match. Falls back to `reservation_query` at Tier 1 if
   * no pattern matches (confidence 0.3).
   *
   * @param message - The user's message text
   * @returns ClassificationResult with bucket, confidence, suggestedTier, and matchedKeywords
   */
  classify(message: string): ClassificationResult {
    const normalized = message.toLowerCase().trim();

    let bestMatch: ClassificationResult | null = null;

    for (const rule of this.rules) {
      for (const pattern of rule.patterns) {
        if (pattern.regex.test(normalized)) {
          if (!bestMatch || pattern.confidence > bestMatch.confidence) {
            bestMatch = {
              bucket: rule.bucket,
              confidence: pattern.confidence,
              suggestedTier: rule.suggestedTier,
              matchedKeywords: pattern.keywords.filter(kw =>
                normalized.includes(kw.toLowerCase())
              ),
            };
          }
          // Don't break — keep checking for a higher-confidence match
          // in a different bucket
        }
      }
    }

    if (bestMatch) {
      return bestMatch;
    }

    // Fallback: classify as general reservation query with low confidence
    return {
      bucket: 'reservation_query',
      confidence: 0.30,
      suggestedTier: 1,
      matchedKeywords: [],
    };
  }

  /**
   * Get all 32 context bucket names.
   */
  getBuckets(): readonly string[] {
    return CONTEXT_BUCKETS;
  }

  /**
   * Get the suggested tier for a specific bucket.
   */
  getSuggestedTier(bucket: string): number {
    const rule = this.rules.find(r => r.bucket === bucket);
    return rule?.suggestedTier ?? 1;
  }
}