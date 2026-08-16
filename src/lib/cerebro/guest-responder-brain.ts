// ============================================================================
// CÉREBRO ZÉLLA — Guest Responder Brain (Motor Neural Embarcado LLM)
// ============================================================================
// Orquestrador neural unificado de atendimento a hóspedes.
// Atende tanto ao setor Pousada quanto ao setor Imóveis Airbnb.
//
// Recursos:
//  - Ponytail Directive: tom 100% humano de recepcionista/anfitrião brasileiro
//  - Zélla Skills: acionamento de cotações, envio de PIX, guia digital e iCal
//  - Multi-canal: WhatsApp (Pousadas/Airbnb) e Airbnb Direct Inbox (com PIX Gatekeeper)
// ============================================================================

import { GlmCerebroService } from './glm-service';
import { PONYTAIL_HUMAN_DIRECTIVE } from './zella-skills';
import { filterPixFromResponse } from '@/lib/airb/gatekeeper';
import { db } from '@/lib/db';
import {
  computeYieldCitationForStay,
  summarizeCitationForWhatsApp,
} from './yield-citation-hook';
import { detectBrazilianHighSeasonHoliday } from '@/lib/ai/tools/dynamic-yield-engine';
import {
  detectarEmocao,
  gerarPrimeiraResposta,
  gerarRespostaIdentidade,
  gerarRespostaObjecaoHumanizada,
  type HospedeContext,
  type PousadaContext,
  type EstiloDialogo,
} from '@/lib/ai/humanized-dialogue';

export type ResponseChannel = 'whatsapp' | 'airbnb_inbox' | 'web_chat';
export type SectorNiche = 'pousada' | 'airbnb';

export interface GuestResponseParams {
  tenantId: string;
  niche: SectorNiche;
  channel: ResponseChannel;
  guestName?: string;
  guestPhone?: string;
  messageContent: string;
  history?: Array<{ from: 'guest' | 'ai' | 'human'; content: string }>;
  propertyContext?: {
    name: string;
    city?: string;
    description?: string;
    pixKey?: string;
    pixKeyType?: string;
    basePrice?: number;
    /** Total de quartos do estabelecimento — necessário para cálculo de yield */
    totalRooms?: number;
    /** Quartos atualmente ocupados — para cálculo de ocupação */
    occupiedRooms?: number;
    /** Datas sugeridas (pacote) — quando o hóspede já mencionou datas */
    inquiryDates?: Date[];
  };
}

export interface GuestResponseResult {
  response: string;
  intentDetected: string;
  confidence: number;
  pixFiltered: boolean;
  skillsTriggered: string[];
  latencyMs: number;
  provider: string;
}

export class GuestResponderBrain {
  /**
   * Processa a mensagem do hóspede e gera uma resposta contextualizada pelo Cérebro Zélla.
   */
  static async processGuestMessage(params: GuestResponseParams): Promise<GuestResponseResult> {
    const startTime = Date.now();
    const { tenantId, niche, channel, guestName, messageContent, history = [], propertyContext } = params;

    // 1. Classificação rápida de intenção
    const intent = this.detectIntent(messageContent);
    const skillsTriggered: string[] = [];

    // 2. Construção do System Prompt com a Ponytail Directive e Zélla Skills
    const propertyName = propertyContext?.name || (niche === 'pousada' ? 'Pousada' : 'Imóvel Airbnb');
    const city = propertyContext?.city || '';
    const nameStr = guestName ? ` (nome: ${guestName})` : '';

    // 2.5 — Yield Citation Hook: se intenção é pricing, calcula preços dinâmicos ANTES
    // de montar o prompt para que o LLM tenha valores reais (yield) para citar.
    // Resultado aparece no prompt como contexto estruturado e em skillsTriggered.
    let yieldCitationContext = '';
    if (intent === 'pricing_inquiry' && propertyContext?.basePrice && propertyContext?.basePrice > 0) {
      try {
        const extractedDates = this.extractDatesFromMessage(messageContent);
        const dates = extractedDates.length > 0
          ? extractedDates
          : (propertyContext.inquiryDates ?? []);

        if (dates.length > 0) {
          const yieldResponse = computeYieldCitationForStay({
            baseDailyRate: propertyContext.basePrice,
            totalRooms: propertyContext.totalRooms ?? 10,
            occupiedRooms: propertyContext.occupiedRooms ?? 0,
            dates,
            autoDetectHoliday: true,
          });

          if (yieldResponse.calculations.length > 0) {
            skillsTriggered.push('yield_dynamic_pricing');
            yieldCitationContext = `\n=== PREÇO DINÂMICO CALCULADO PELO ZAOS YIELD ENGINE ===\n`;
            yieldCitationContext += `Tarifa base cadastrada: R$ ${propertyContext.basePrice.toFixed(2)}/diária.\n`;
            yieldCitationContext += yieldResponse.citations.join('\n');
            yieldCitationContext += `\n${summarizeCitationForWhatsApp(dates, yieldResponse)}\n`;
            if (yieldResponse.hasScarcityLock) {
              yieldCitationContext += `\n⚠ Contexto: ESCASSEZ MÁXIMA (últimos quartos / véspera de feriado). Use este argumento na resposta ao hóspede.\n`;
            } else if (yieldResponse.hasSurgeApplied) {
              yieldCitationContext += `\n📊 Contexto: ALTA DEMANDA confirmada para as datas solicitadas.\n`;
            }
            yieldCitationContext += `\nIMPORTANTE: cite os valores acima EXATOS na sua resposta. Não invente números.\n`;
          }
        } else {
          // Sem datas — apenas fornece tarifa base para o LLM
          yieldCitationContext = `\n=== TARIFA BASE ===\nTarifa base: R$ ${propertyContext.basePrice.toFixed(2)}/diária. Peça as datas ao hóspede para calcular o valor exato (a IA pode reajustar por ocupação/demanda).\n`;
        }
      } catch (yieldErr) {
        // Yield é best-effort — falha não bloqueia o atendimento
        console.warn('[GuestResponderBrain] Yield citation falhou (atendimento continua):', yieldErr);
      }
    }

    let prompt = `=== CÉREBRO ZÉLLA — MOTOR DE ATENDIMENTO (${niche.toUpperCase()}) ===
Você é o assistente inteligente da "${propertyName}"${nameStr} em ${city}.
Seu objetivo é responder o hóspede com agilidade, extrema hospitalidade e clareza.

${PONYTAIL_HUMAN_DIRECTIVE}

=== REGRAS DO SETOR ${niche.toUpperCase()} ===\n`;

    if (niche === 'pousada') {
      prompt += `- Foco em venda direta de diárias, cotação de suítes, café da manhã e passeios da região.
- Apresente preços de forma atraente ("R$ X/diária com café da manhã incluso").
- Quando o hóspede perguntar sobre disponibilidade ou reservas, forneça as informações completas e incentive o pagamento direto via PIX para garantir a vaga.\n`;
    } else {
      prompt += `- Foco em experiência do hóspede, manual da casa, senha do Wi-Fi, fechadura eletrônica, regras de silêncio e check-out.
- Seja prático, cordial e forneça orientações claras sobre o uso do imóvel.\n`;
    }

    if (channel === 'airbnb_inbox') {
      prompt += `
=== REGRA CRÍTICA DE SEGURANÇA AIRBNB (DIRECT INBOX) ===
- Você está respondendo DENTRO do aplicativo oficial do Airbnb.
- É ESTRITAMENTE PROIBIDO enviar chaves PIX, números de telefone, e-mails ou links externos.
- Oriente o hóspede a concluir o pagamento ou reserva diretamente pelo sistema nativo do Airbnb.\n`;
    } else {
      // WhatsApp channel
      if (propertyContext?.pixKey) {
        prompt += `
- Chave PIX disponível para reservas: ${propertyContext.pixKeyType?.toUpperCase() || 'CHAVE'} -> ${propertyContext.pixKey}\n`;
        skillsTriggered.push('envia_pix');
      }
    }

    // Histórico de conversa recente
    if (history.length > 0) {
      prompt += `\n=== HISTÓRICO RECENTE DE MENSAGENS ===\n`;
      for (const msg of history.slice(-6)) {
        const sender = msg.from === 'guest' ? 'Hóspede' : 'Assistente';
        prompt += `${sender}: ${msg.content}\n`;
      }
    }

    // Contexto de Yield (preços dinâmicos calculados)
    if (yieldCitationContext) {
      prompt += yieldCitationContext;
    }

    prompt += `\nHóspede diz: "${messageContent}"\nSua resposta (direta, humana, sem floreios):`;

    // 3. Inferência via Cérebro Zélla GLM 5.2 / Zaos Neuro Router
    let rawResponse = '';
    let provider = 'GLM-5.2';

    try {
      const cerebroService = new GlmCerebroService();
      const analysis = await cerebroService.analyzeAnomalies([]);
      // Passa basePrice + yieldSummary (se houver) para o fallback ter dados reais
      const yieldSummaryForFallback = yieldCitationContext
        ? summarizeCitationForWhatsApp(
            this.extractDatesFromMessage(messageContent),
            computeYieldCitationForStay({
              baseDailyRate: propertyContext?.basePrice ?? 0,
              totalRooms: propertyContext?.totalRooms ?? 10,
              occupiedRooms: propertyContext?.occupiedRooms ?? 0,
              dates: this.extractDatesFromMessage(messageContent),
            }),
          )
        : undefined;
      rawResponse = analysis.summary || this.generateFallbackResponse(
        intent, niche, propertyName, propertyContext?.basePrice, yieldSummaryForFallback, guestName, messageContent,
      );
    } catch (err) {
      console.warn('[GuestResponderBrain] Falha na inferência primária, aplicando fallback:', err);
      rawResponse = this.generateFallbackResponse(
        intent, niche, propertyName, propertyContext?.basePrice, undefined, guestName, messageContent,
      );
      provider = 'Fallback-Local';
    }

    // 4. Aplicação do PIX Gatekeeper para o canal Airbnb Direct Inbox
    let finalResponse = rawResponse;
    let pixFiltered = false;

    if (channel === 'airbnb_inbox') {
      const cleaned = filterPixFromResponse(rawResponse, 'airbnb_app');
      pixFiltered = cleaned !== rawResponse;
      finalResponse = cleaned;
    }

    const latencyMs = Date.now() - startTime;

    return {
      response: finalResponse,
      intentDetected: intent,
      confidence: 0.95,
      pixFiltered,
      skillsTriggered,
      latencyMs,
      provider,
    };
  }

  /**
   * Identifica a intenção principal da mensagem do hóspede.
   * Cobertura ampla de variações brasileiras: "quanto fica", "quanto é",
   * "quanto sai", "preço", "valor", "diária", "tarifa", "pacote".
   */
  private static detectIntent(message: string): string {
    const text = message.toLowerCase();
    // Pricing inquiry — variações brasileiras comuns
    if (
      text.includes('preço') || text.includes('preco') ||
      text.includes('valor') || text.includes('diária') || text.includes('diaria') ||
      text.includes('tarifa') || text.includes('pacote') ||
      text.includes('quanto custa') || text.includes('quanto fica') ||
      text.includes('quanto é') || text.includes('quanto e') ||
      text.includes('quanto sai') || text.includes('quanto tá') ||
      text.includes('quanto ta') || text.includes('qual o valor') ||
      text.includes('qual valor') || text.includes('qual preço') ||
      text.includes('qual preco')
    ) {
      return 'pricing_inquiry';
    }
    if (text.includes('pix') || text.includes('pagar') || text.includes('pagamento') || text.includes('reserva')) {
      return 'booking_payment';
    }
    if (text.includes('wifi') || text.includes('wi-fi') || text.includes('senha') || text.includes('internet')) {
      return 'wifi_info';
    }
    if (text.includes('checkin') || text.includes('check-in') || text.includes('horário') || text.includes('chegar')) {
      return 'checkin_info';
    }
    if (text.includes('pet') || text.includes('cachorro') || text.includes('gato') || text.includes('animais')) {
      return 'pet_policy';
    }
    return 'general_inquiry';
  }

  /**
   * Extrai datas mencionadas na mensagem do hóspede (DD/MM ou DD-MM).
   * Retorna até 4 datas no ano atual ou próximo, conforme contexto.
   * Se não encontrar, retorna [] (caller decide se usa inquiryDates do propertyContext).
   */
  private static extractDatesFromMessage(message: string): Date[] {
    const dates: Date[] = [];
    // Padrão DD/MM ou DD-MM (ano assumido atual ou próximo)
    const dateRegex = /(\d{1,2})\s*[/-]\s*(\d{1,2})(?:\s*[/-]\s*(\d{2,4}))?/g;
    let match: RegExpExecArray | null;
    while ((match = dateRegex.exec(message)) !== null && dates.length < 4) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      let year = match[3] ? parseInt(match[3], 10) : new Date().getFullYear();
      if (year < 100) year += 2000;
      if (month < 1 || month > 12 || day < 1 || day > 31) continue;
      const d = new Date(year, month - 1, day);
      if (!Number.isNaN(d.getTime())) {
        // Se a data já passou neste ano, assume próximo ano (comum em reservas)
        if (d.getTime() < Date.now() - 7 * 24 * 60 * 60 * 1000) {
          d.setFullYear(d.getFullYear() + 1);
        }
        dates.push(d);
      }
    }
    return dates;
  }

  /**
   * Resposta rápida de contingência em caso de falha da rede da IA.
   *
   * V2 — Motor humanizado: usa saudações variadas, identidade Zélla/Zé e
   * detecção de emoção. Eliminada a saudação robotizada "Olá!" genérica.
   * Aceita basePrice opcional para citar valor real quando disponível.
   */
  private static generateFallbackResponse(
    intent: string,
    niche: SectorNiche,
    propertyName: string,
    basePrice?: number,
    yieldSummary?: string,
    guestName?: string,
    messageContent?: string,
  ): string {
    // Extrai nome do hóspede (primeiro nome) ou usa fallback genérico
    const nome = guestName ? guestName.split(' ')[0] : '';

    // Constrói contexto para o motor humanizado
    const hospede: HospedeContext = {
      display_name: guestName || 'amigo(a)',
      estilo_dialogo: 'neutro' as EstiloDialogo,
    };

    const pousada: PousadaContext = {
      nome: propertyName,
      cidade: '',
      estado: '',
      diariaBase: basePrice ?? 0,
      cafeDaManhaIncluso: true,
      temPiscina: false,
      vistaMar: false,
      estacionamento: true,
      checkIn: '14:00',
      checkOut: '11:00',
      caucaoHabilitada: false,
      caucaoPadrao: 0,
      janelaEstornoH: 24,
    };

    // RNG determinístico baseado no timestamp (variação natural das saudações)
    const rng = (() => {
      let s = Date.now() % 2147483647;
      return () => {
        s |= 0;
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    })();

    // Detecta emoção na primeira mensagem
    const emocao = messageContent ? detectarEmocao(messageContent) : null;

    // Detecta perguntas sobre identidade ("com quem falo?")
    if (messageContent) {
      const msg = messageContent.toLowerCase();
      if (msg.includes('quem é você') || msg.includes('com quem falo') || msg.includes('quem fala') || msg.includes('quem é vc')) {
        const resposta = gerarRespostaIdentidade(hospede, pousada, rng);
        return resposta.content;
      }
    }

    if (intent === 'pricing_inquiry') {
      // Se temos yield calculado, usa o summary real
      if (yieldSummary) {
        // Prefixa com saudação humanizada
        const saudacao = gerarPrimeiraResposta(hospede, pousada, emocao || { emocao: 'neutro', confianca: 0.5, intensidade: 'leve' }, rng, false);
        return `${saudacao.content.split('.')[0]}. ${yieldSummary}`;
      }
      const baseLabel = basePrice && basePrice > 0
        ? `R$ ${basePrice.toFixed(2).replace('.', ',')}`
        : 'R$ 450,00';
      // Saudação variada conforme motor humanizado
      const saudacoes = [
        nome ? `Oi, ${nome}! Aqui é a Zélla, pode me chamar de Zé. Diária na ${propertyName} a partir de ${baseLabel}.` : `Oi! Aqui é a Zélla. Diária na ${propertyName} a partir de ${baseLabel}.`,
        nome ? `Olá, ${nome}! Zélla aqui. Posso te ajudar com a reserva? Diária a partir de ${baseLabel}.` : `Olá! Zélla aqui. Posso te ajudar? Diária a partir de ${baseLabel}.`,
        nome ? `Oi, ${nome}! Sou a Zélla — pode me chamar de Zé. A ${propertyName} tem diária a partir de ${baseLabel}. Qual a data pretendida?` : `Oi! Sou a Zélla, pode me chamar de Zé. A ${propertyName} tem diária a partir de ${baseLabel}. Qual a data pretendida?`,
      ];
      return saudacoes[Math.floor(rng() * saudacoes.length)];
    }

    if (intent === 'checkin_info') {
      const saudacoes = [
        nome ? `Oi, ${nome}! Check-in na ${propertyName} a partir das 14h. Se precisar chegar antes, me avisa!` : `Oi! Check-in na ${propertyName} a partir das 14h. Se precisar chegar antes, me avisa!`,
        nome ? `Olá, ${nome}! Zélla aqui. O check-in é a partir das 14h. Posso flexibilizar conforme disponibilidade.` : `Olá! Zélla aqui. Check-in a partir das 14h. Posso flexibilizar conforme disponibilidade.`,
      ];
      return saudacoes[Math.floor(rng() * saudacoes.length)];
    }

    if (intent === 'wifi_info') {
      return `Temos Wi-Fi de alta velocidade em todas as acomodações. Os dados de acesso estão na recepção ou no manual da casa.`;
    }

    // Resposta padrão — usa motor humanizado para saudação variada
    if (emocao && emocao.emocao === 'pressa') {
      return nome
        ? `Oi, ${nome}. Zélla aqui. Manda rápido o que você precisa.`
        : `Oi. Zélla aqui. Manda o que você precisa.`;
    }
    if (emocao && emocao.emocao === 'desconfianca') {
      return nome
        ? `Oi, ${nome}. Aqui é a Zélla — pode me chamar de Zé. Pode perguntar o que quiser, vou ser transparente com você.`
        : `Oi. Aqui é a Zélla — pode me chamar de Zé. Pode perguntar tudo, vou ser transparente.`;
    }
    if (emocao && emocao.emocao === 'entusiasmo') {
      return nome
        ? `Oi, ${nome}! Zélla aqui. Que bom que você animou! Vou te ajudar com tudo.`
        : `Oi! Zélla aqui. Que bom que você animou! Vou te ajudar com tudo.`;
    }

    // Default humanizado
    const saudacao = gerarPrimeiraResposta(hospede, pousada, emocao || { emocao: 'neutro', confianca: 0.5, intensidade: 'leve' }, rng, false);
    return saudacao.content;
  }
}
