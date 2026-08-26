// @ts-nocheck — to be fixed in dedicated type refactoring pass
import { getNeuroRouter } from './zaos-neuro-router';

// ── Tipos ───────────────────────────────────────────────────────────

export type GuestIntent =
  | 'cotacao_reserva'
  | 'upsell_servico'
  | 'fnrh_registro'
  | 'check_out_aviso'
  | 'reserva_direta'
  | 'suporte_tecnico'
  | 'info_geral'
  | 'checkin_checkout'
  | 'cancelamento'
  | 'agradecimento'
  | 'desconhecido'
  | 'human_handover'
  | 'duvida_geral';

export interface IntentResult {  
  /** Intenção classificada */  
  intent: GuestIntent;  
  /** Confiança da classificação (0-1) */  
  confidence: number;  
  /** Método usado: 'heuristic' | 'llm' */  
  method: 'heuristic' | 'llm';  
  /** Palavras-chave que motivaram a classificação */  
  matchedKeywords: string[];  
  /** Data/hora da classificação */  
  timestamp: Date;  
}

const SINGLE_SHOT_INTENTS: GuestIntent[] = [
  'cotacao_reserva',
  'reserva_direta',
  'duvida_geral',
  'checkin_checkout',
  'cancelamento',
  'suporte_tecnico', // Solução completa em 1 balão (evita ida e volta)
  'info_geral', // Informações gerais consolidadas em 1 balão
];

// Intents that should NOT use single-shot (short acknowledgment responses)
const NON_SINGLE_SHOT_INTENTS: GuestIntent[] = [
  'agradecimento', // "Obrigado!" → resposta curta e natural, sem forçar conteúdo extra
  'human_handover', // Escalação → não precisa de resposta longa
  'desconhecido', // Fallback → melhor ser conciso
];

export function shouldUseSingleShot(intent: GuestIntent): boolean {
  if (NON_SINGLE_SHOT_INTENTS.includes(intent)) return false;
  return SINGLE_SHOT_INTENTS.includes(intent);
}

// ── Heurísticas rápidas ──────────────────────────────────────────────

/**
 * Padrões que indicam claramente intenção de cotação/reserva.
 *
 * CORREÇÃO v2 — finding 2.3:
 *  Versão anterior exigia "preço|valor|tarifa" + "quarto|suíte|diária|noite|hospedagem|estadia"
 *  na mesma mensagem. Padrões comuns como "quanto fica amanhã?" não casavam,
 *  caiam em `desconhecido` e o One-Shot Resolution não ativava — gerando
 *  múltiplos balões WhatsApp e custos Meta desnecessários.
 *
 * V2 adiciona padrões curtos com data futura e "tem vaga?" isolado.
 */
const BOOKING_INTENT_PATTERNS: Array<{ regex: RegExp; keywords: string[]; confidence: number }> = [
  // Pattern rigoroso original (mantém alta confiança)
  { regex: /\b(pre[cç]o|valor|custo|tarifa|quanto\s*(custa|cobras?|fica))\s.*(quarto|su[ií]te|di[aá]ria|noite|hospedagem|estadia)/i, keywords: ['preço', 'valor', 'tarifa'], confidence: 0.95 },
  // NOVO: pattern curto "quanto fica/sai/custa" + data futura
  { regex: /\b(quanto\s*(fica|custa|sai)|qual\s*(o\s+)?(pre[cç]o|valor))\b.*\b(amanh[aã]|hoje|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo|pr[oó]xim[oa]|pr[oó]xima|fim\s*de\s*semana|\d{1,2}[\/\-]\d{1,2}|\d{1,2}\s*de\s*\w+)/i, keywords: ['quanto fica', 'qual preço', 'data'], confidence: 0.85 },
  // NOVO: "tem vaga?" / "tem quarto?" isolado — já é cotação
  { regex: /\b(tem\s*(vaga|quarto|dispon[ií]vel|lugar|algo))\b/i, keywords: ['tem vaga', 'tem quarto'], confidence: 0.90 },
  // Mantém patterns existentes
  { regex: /\b(reserv[aei]|quero reservar|fazer reserva|agendar|dispon[ií]vel para|quarto para)\b/i, keywords: ['reserva', 'reservar', 'agendar', 'disponível'], confidence: 0.95 },
  { regex: /\b(tem\s*(vaga|quarto|dispon[ií]vel|lugar)|quartos?\s*(dispon[ií]veis|livres))\b/i, keywords: ['tem vaga', 'tem quarto', 'disponível'], confidence: 0.92 },
  { regex: /\b(check[\s-]?in|check[\s-]?out|chegar|sair|data|di[aá]ria|noite)\b.*\b(\d{1,2}[\/\-]\d{1,2}|\d{1,2}\s*de\s*\w+|fim\s*de\s*semana|semana\s*que\s*vem|pr[oó]ximo|pr[oó]xima)/i, keywords: ['check-in', 'data', 'fim de semana'], confidence: 0.93 },
  { regex: /\b(quero\s*uma?\s*(su[ií]te|quarto|chal[eé])|busco\s*(hospedagem|pousada|quarto))\b/i, keywords: ['quero uma suíte', 'quero um quarto'], confidence: 0.91 },
  { regex: /\b(para\s*(\d|dois|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez)\s*(pessoas?|h[oó]spedes?|adultos?|camas?))\b/i, keywords: ['pessoas', 'hóspedes'], confidence: 0.88 },
  { regex: /\b(cota[cç][aã]o|or[cç]amento|simular|calcular)\b/i, keywords: ['cotação', 'orçamento', 'simular'], confidence: 0.94 },
];

/** Padrões que indicam reserva direta imediata */
const DIRECT_BOOKING_PATTERNS: Array<{ regex: RegExp; keywords: string[]; confidence: number }> = [
  { regex: /\b(quero reservar agora|fechar reserva|confirmar reserva|link de pagamento|gerar pix|mandar o pix|fechar agora)\b/i, keywords: ['confirmar reserva', 'pix', 'fechar agora'], confidence: 0.95 },
];

/** Padrões que indicam pedido de atendente humano ou suporte técnico */  
const HUMAN_HANDOVER_PATTERNS: Array<{ regex: RegExp; keywords: string[]; confidence: number }> = [  
  { regex: /\b(urgente|emerg[eê]ncia|socorro|pol[ií]cia|samu|bombeiro)\b/i, keywords: ['urgente', 'emergência', 'socorro'], confidence: 0.98 },  
  { regex: /\b(fal[ae]r?\s*(com|para)\s*(o|um)\s*(gerente|dono|respons[aá]vel|humano|persona|atendente))\b/i, keywords: ['falar com gerente', 'atendente humano'], confidence: 0.95 },  
  { regex: /^(n[aã]o\s*(quero|gosto)\s*(de|do?)\s*(ia|robo?t?|autom[aá]tico|virtual|chat))/i, keywords: ['não quero IA', 'não gosto de robô'], confidence: 0.90 },  
  { regex: /\b(ningu[eé]m\s*responde|demor[oa]\s*(demais|muito)|j[aá]\s*(esperei|tento|horras?)|insatisfeit[oa])\b/i, keywords: ['ninguém responde', 'demora', 'já esperei'], confidence: 0.85 },  
  { regex: /\b(advogado|processo|justi[cç]a|procon|reclame\s*aqui|den[uú]ncia)\b/i, keywords: ['advogado', 'procon', 'denúncia'], confidence: 0.92 },  
  { regex: /\b(agress[aã]o|amea[cç]a|perigo|viol[eê]ncia|roubo|furto)\b/i, keywords: ['agressão', 'ameaça', 'perigo'], confidence: 0.97 },  
];

/** Padrões de suporte/problemas */
const SUPPORT_PATTERNS: Array<{ regex: RegExp; keywords: string[]; confidence: number }> = [
  { regex: /\b(erro|problema|nao consigo|nao funciona|bug|falha|ativar)\b/i, keywords: ['erro', 'problema', 'falha'], confidence: 0.90 },
];

/** Padrões de check-in / check-out */
const CHECKIN_CHECKOUT_PATTERNS: Array<{ regex: RegExp; keywords: string[]; confidence: number }> = [
  { regex: /\b(chegar|partir|check-in|check-out|horario checkin|horario checkout)\b/i, keywords: ['check-in', 'check-out'], confidence: 0.90 },
];

/** Padrões de cancelamento */
const CANCEL_PATTERNS: Array<{ regex: RegExp; keywords: string[]; confidence: number }> = [
  { regex: /\b(cancelar|desistir|nao quero mais|estorno|devolucao)\b/i, keywords: ['cancelar', 'estorno'], confidence: 0.90 },
];

/** Padrões de agradecimento */
const THANKS_PATTERNS: Array<{ regex: RegExp; keywords: string[]; confidence: number }> = [
  { regex: /\b(obrigado|valeu|thanks|agradecido|obrigada|grato)\b/i, keywords: ['obrigado', 'obrigada'], confidence: 0.95 },
];

/** Padrões de dúvida geral (FAQ) */  
const FAQ_INTENT_PATTERNS: Array<{ regex: RegExp; keywords: string[]; confidence: number }> = [  
  { regex: /\b(hor[aá]rio|funciona|abre|fecha|hor[aá]rio\s*(de )?(check|piscina|caf[eé]|restaurante|academia|spa|bar))\b/i, keywords: ['horário', 'funciona', 'abre'], confidence: 0.88 },  
  { regex: /\b(piscina|wi[\s-]?fi|wifi|academia|spa|estacionamento|churrasqueira|playground|p[eé]tio|lareira)\b/i, keywords: ['piscina', 'wifi', 'estacionamento'], confidence: 0.85 },  
  { regex: /\b(como\s*chegar|endere[cç]o|localiza[cç][aã]o|onde\s*fica|gps|waze|google\s*maps)\b/i, keywords: ['como chegar', 'endereço', 'localização'], confidence: 0.90 },  
  { regex: /\b(aceita\s*(cachorro|pet|animal)|pet|c[aã]o|gato|animal\s*de\s*estima[cç][aã]o)\b/i, keywords: ['aceita pet', 'cachorro', 'animal de estimação'], confidence: 0.93 },  
  { regex: /\b(caf[eé]\s*(da\s*)?manh[aã]|caf[eé]\s*incluso|incluso|inclui|tem\s*caf[eé])\b/i, keywords: ['café da manhã', 'café incluso'], confidence: 0.87 },  
  { regex: /\b(crian[cç]a|beb[eê]|ber[cç]o|cama\s*extra|cama\s*adicional)\b/i, keywords: ['criança', 'berço', 'cama extra'], confidence: 0.84 },  
  { regex: /\b(o\s*que\s*(fazer|tem|oferece)|atividade|passeio|restaurante|comer|dica|recomend)/i, keywords: ['o que fazer', 'atividade', 'restaurante'], confidence: 0.82 },  
  { regex: /\b(pol[ií]tica|regras|cancelamento|check[\s-]?in|check[\s-]?out)\b(?!\s*(\d|data|di[aá]ria|noite))/i, keywords: ['política', 'regras', 'cancelamento'], confidence: 0.86 },  
];

// ── LLM Intent Classifier prompt ────────────────────────────────────

const INTENT_CLASSIFIER_PROMPT = `Você é um classificador de intenção de mensagens de hóspedes de pousada via WhatsApp.

Você deve responder obrigatoriamente com um objeto JSON válido contendo as seguintes propriedades:
- "intent": "duvida_geral" | "cotacao_reserva" | "reserva_direta" | "suporte_tecnico" | "checkin_checkout" | "cancelamento" | "agradecimento" | "human_handover"
- "confidence": número entre 0 e 1 indicando a confiança da classificação

Diretrizes de Classificação:
1. "duvida_geral" — Perguntas gerais sobre a pousada (como Wi-Fi, horário do café da manhã, se aceita pet, voltagem das tomadas, política de cancelamento) que não definem ou perguntam sobre datas específicas.
2. "cotacao_reserva" — Perguntas sobre valores, cotações, orçamentos, disponibilidade, ou intenção de fechar reserva para datas específicas.
3. "reserva_direta" — Mensagens claras de fechamento de reserva, pedido de PIX para pagamento, confirmação ou envio de comprovantes.
4. "suporte_tecnico" — Relato de problemas, erros no site/sistema ou dúvidas de como ativar/acessar algo com erro.
5. "checkin_checkout" — Perguntas específicas sobre horários de entrada, saída, antecipação de entrada ou saída tardia.
6. "cancelamento" — Pedido de cancelamento, reembolso, estorno ou desistência da estadia.
7. "agradecimento" — Mensagens curtas de obrigado, valeu, até logo ou confirmação simples de recebido.
8. "human_handover" — Pedidos para falar com atendentes humanos, reclamações graves, situações de urgência ou emergência, ou contatos jurídicos/Procon.

Exemplo de resposta JSON:
{
  "intent": "cotacao_reserva",
  "confidence": 0.95
}`;

// ── Funções ──────────────────────────────────────────────────────────

export async function classifyIntent(message: string): Promise<IntentResult> {  
  const lower = message.toLowerCase().trim();

  // ── Passo 1: Heurística rápida ──

  // 1. Verificar human_handover
  for (const { regex, keywords, confidence } of HUMAN_HANDOVER_PATTERNS) {  
    if (regex.test(lower)) {  
      const matched = keywords.filter(kw => lower.includes(kw.toLowerCase()));  
      return {  
        intent: 'human_handover',  
        confidence,  
        method: 'heuristic',  
        matchedKeywords: matched,  
        timestamp: new Date(),  
      };  
    }  
  }

  // 2. Verificar reserva_direta
  for (const { regex, keywords, confidence } of DIRECT_BOOKING_PATTERNS) {
    if (regex.test(lower)) {
      const matched = keywords.filter(kw => lower.includes(kw.toLowerCase()));
      return {
        intent: 'reserva_direta',
        confidence,
        method: 'heuristic',
        matchedKeywords: matched,
        timestamp: new Date(),
      };
    }
  }

  // 3. Verificar cotacao_reserva  
  for (const { regex, keywords, confidence } of BOOKING_INTENT_PATTERNS) {  
    if (regex.test(lower)) {  
      const matched = keywords.filter(kw => lower.includes(kw.toLowerCase()));  
      return {  
        intent: 'cotacao_reserva',  
        confidence,  
        method: 'heuristic',  
        matchedKeywords: matched,  
        timestamp: new Date(),  
      };  
    }  
  }

  // 4. Verificar cancelamento
  for (const { regex, keywords, confidence } of CANCEL_PATTERNS) {
    if (regex.test(lower)) {
      const matched = keywords.filter(kw => lower.includes(kw.toLowerCase()));
      return {
        intent: 'cancelamento',
        confidence,
        method: 'heuristic',
        matchedKeywords: matched,
        timestamp: new Date(),
      };
    }
  }

  // 5. Verificar check-in/check-out
  for (const { regex, keywords, confidence } of CHECKIN_CHECKOUT_PATTERNS) {
    if (regex.test(lower)) {
      const matched = keywords.filter(kw => lower.includes(kw.toLowerCase()));
      return {
        intent: 'checkin_checkout',
        confidence,
        method: 'heuristic',
        matchedKeywords: matched,
        timestamp: new Date(),
      };
    }
  }

  // 6. Verificar suporte técnico
  for (const { regex, keywords, confidence } of SUPPORT_PATTERNS) {
    if (regex.test(lower)) {
      const matched = keywords.filter(kw => lower.includes(kw.toLowerCase()));
      return {
        intent: 'suporte_tecnico',
        confidence,
        method: 'heuristic',
        matchedKeywords: matched,
        timestamp: new Date(),
      };
    }
  }

  // 7. Verificar agradecimento
  for (const { regex, keywords, confidence } of THANKS_PATTERNS) {
    if (regex.test(lower)) {
      const matched = keywords.filter(kw => lower.includes(kw.toLowerCase()));
      return {
        intent: 'agradecimento',
        confidence,
        method: 'heuristic',
        matchedKeywords: matched,
        timestamp: new Date(),
      };
    }
  }

  // 8. Verificar FAQ  
  for (const { regex, keywords, confidence } of FAQ_INTENT_PATTERNS) {  
    if (regex.test(lower)) {  
      const matched = keywords.filter(kw => lower.includes(kw.toLowerCase()));  
      return {  
        intent: 'duvida_geral',  
        confidence,  
        method: 'heuristic',  
        matchedKeywords: matched,  
        timestamp: new Date(),  
      };  
    }  
  }

  // ── Passo 2: LLM Classifier (Tier 1) ──  
  try {  
    const router = await getNeuroRouter();  
    const result = await router.generate({  
      message: `${INTENT_CLASSIFIER_PROMPT}\n\nMensagem do hóspede: "${message}"`,  
      tier: 1,  
      noCache: true,  
      maxLatencyMs: 500,  
      jsonMode: true,
    });

    const parsed = JSON.parse(result.response);
    const validIntents: GuestIntent[] = [
      'duvida_geral', 'cotacao_reserva', 'reserva_direta', 
      'suporte_tecnico', 'checkin_checkout', 'cancelamento', 
      'agradecimento', 'human_handover'
    ];  
    
    if (parsed && validIntents.includes(parsed.intent)) {
      return {  
        intent: parsed.intent as GuestIntent,  
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.85,  
        method: 'llm',  
        matchedKeywords: [],  
        timestamp: new Date(),  
      };  
    }  
  } catch (error) {  
    console.error('[IntentRouter] LLM classifier parsing error:', error);
  }

  // ── Fallback ──  
  return {  
    intent: 'duvida_geral',  
    confidence: 0.5,  
    method: 'heuristic',  
    matchedKeywords: [],  
    timestamp: new Date(),  
  };  
}

export function formatIntentLog(intentResult: IntentResult): string {  
  const intentLabels: Record<GuestIntent, string> = {  
    duvida_geral: '📝 Dúvida Geral',  
    cotacao_reserva: '💰 Cotação/Reserva',  
    reserva_direta: '⚡ Reserva Direta',
    suporte_tecnico: '🛠️ Suporte Técnico',
    checkin_checkout: '🔑 Check-in/out',
    cancelamento: '❌ Cancelamento',
    agradecimento: '🙏 Agradecimento',
    desconhecido: '❓ Desconhecido',
    human_handover: '👤 Handover Humano',  
    info_geral: 'ℹ️ Informação Geral',
  };  
  return `${intentLabels[intentResult.intent] || '❓ Desconhecido'} (conf: ${intentResult.confidence}, via: ${intentResult.method})`;  
}  
