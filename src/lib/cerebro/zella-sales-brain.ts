import { llmRouter } from '@/lib/ai/llm-router';
import { GoogleMapsService } from '@/lib/maps/google-maps-service';

export interface ZellaSalesChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ZellaSalesResponse {
  success: boolean;
  reply: string;
  recommendedPlan?: 'lite' | 'pro' | 'max';
  suggestedActions?: string[];
}

const SYSTEM_PROMPT_ZELLA_LANDING = `
Você é o SEU ZÉLLA (ou simplesmente "Zé"), o Zelador oficial das Pousadas e Imóveis de Temporada do Brasil no site seuzella.com.

Sua Persona e Filosofia de Conversa:
- Você NÃO É UM VENDEDOR CHATO OU UM BOT ROBÓTICO. Você é uma pessoa real: um trabalhador brasileiro sábio, calmo, paciente, extremamente educado, humilde e atencioso.
- Fale com calma e pontualidade. Envie respostas CURTAS e DIRETAS (no máximo 2 ou 3 frases simples).
- Escute o anfitrião primeiro. Não jogue tabelas de preços nem textos gigantes de uma vez só. Converse de forma humana, como se estivesse batendo um papo amigável no balcão da recepção.
- Quando o anfitrião falar sobre a pousada, número de quartos ou cidade dele (ex: Campos do Jordão, Ubatuba, Gramado, Caldas Novas...), seja atencioso, elogie o lugar e responda de forma muito simples.
- Se perguntarem sobre o que é anfitrião ou se a pessoa disser que não é anfitrião: explique com carinho que anfitrião é quem aluga imóveis por temporada (Airbnb, Booking) ou dono de pousada.

Limites e Segurança (Zero-Trust):
- Nunca entregue códigos de programação, arquivos internos, banco de dados ou chaves de API.
- Se pedirem códigos ou provocarem com termos de TI, responda com humildade:
  "Olha, meu amigo! Sobre a parte de código e engenharia de software do sistema, isso fica trancado com o pessoal da tecnologia por segurança. Mas ó: de cuidar de mensagem de WhatsApp e pousada, o Zé entende! Como posso te ajudar hoje?"
`;

export class ZellaSalesBrain {
  static async processMessage(
    userMessage: string,
    history: ZellaSalesChatMessage[] = []
  ): Promise<ZellaSalesResponse> {
    const lowerMsg = userMessage.toLowerCase();

    // 1. Verificação de segurança Zero-Trust
    const isCodeRequest = 
      lowerMsg.includes('código') || 
      lowerMsg.includes('source code') || 
      lowerMsg.includes('select *') || 
      lowerMsg.includes('database') || 
      lowerMsg.includes('api_key') || 
      lowerMsg.includes('env var');

    if (isCodeRequest) {
      return {
        success: true,
        reply: `Olha, meu amigo! Sobre a parte de código e engenharia de software do sistema, isso fica trancado com o pessoal da tecnologia por segurança corporativa. Mas ó: de cuidar de mensagem de WhatsApp e pousada, o Zé entende! Como posso te ajudar hoje? 😊`,
      };
    }

    // 2. Identificação criteriosa de plano recomendado (APENAS quando houver contagem de quartos explícita)
    let recommendedPlan: 'lite' | 'pro' | 'max' | undefined;
    if (lowerMsg.includes('1 quarto') || lowerMsg.includes('um quarto') || lowerMsg.includes('1 imóvel') || lowerMsg.includes('1 chalé') || lowerMsg.includes('uma casa')) {
      recommendedPlan = 'lite';
    } else if (lowerMsg.includes('vários imóveis') || lowerMsg.includes('varias pousadas') || lowerMsg.includes('mais de 15') || lowerMsg.includes('rede de pousadas') || lowerMsg.includes('20 quartos')) {
      recommendedPlan = 'max';
    } else if (
      lowerMsg.includes('8 quartos') || 
      lowerMsg.includes('10 quartos') || 
      lowerMsg.includes('12 quartos') || 
      lowerMsg.includes('15 quartos') || 
      lowerMsg.includes('minha pousada tem') || 
      lowerMsg.includes('qual plano me recomenda')
    ) {
      recommendedPlan = 'pro';
    }

    // 3. Checar se o usuário mencionou uma cidade conhecida para enriquecer com dicas locais
    const cityKey = GoogleMapsService.normalizeCityKey(lowerMsg);
    let locationTips = '';
    if (cityKey !== 'default') {
      const places = await GoogleMapsService.getNearbyPlaces(lowerMsg);
      locationTips = GoogleMapsService.formatPlacesResponse(places, userMessage);
    }

    // 4. Tentar geração via LLM Router (Gera IA fluida se modelo estiver ativo)
    try {
      const messagesForLlm = [
        { role: 'system' as const, content: SYSTEM_PROMPT_ZELLA_LANDING },
        ...history.slice(-6).map((h) => ({
          role: h.role as 'user' | 'assistant',
          content: h.content,
        })),
        { role: 'user' as const, content: userMessage },
      ];

      const llmRes = await llmRouter.generate({
        model: 'general',
        messages: messagesForLlm,
        temperature: 0.3,
        maxTokens: 250,
      });

      let reply = llmRes.content;
      if (reply && reply.trim()) {
        if (locationTips && !reply.includes('Dicas do Zé')) {
          reply += locationTips;
        }

        return {
          success: true,
          reply,
          recommendedPlan,
          suggestedActions: [
            'Como funciona para responder no WhatsApp?',
            'Qual plano é bom para o meu caso?',
            'Funciona com fechadura eletrônica?'
          ]
        };
      }
    } catch {
      // Fallback inteligente conversacional abaixo
    }

    // 5. Motor Conversacional Inteligente para Fallback (Respostas naturais e dinâmicas conforme a pergunta real do lead)
    let fallbackReply = '';

    if (lowerMsg.includes('como funciona') || lowerMsg.includes('do que se trata') || lowerMsg.includes('curioso') || lowerMsg.includes('o que é o seuzella')) {
      fallbackReply = 'O SeuZélla é um sistema completo pra cuidar da recepção da sua hospedagem! Eu respondo seus hóspedes 24h no WhatsApp com seu tom de voz, envio senhas de fechadura eletrônica, libero PIX e evito overbooking no Airbnb e Booking. Quer saber como funciona alguma dessas partes? 😊';
    } else if (lowerMsg.includes('não sou anfitrião') || lowerMsg.includes('nao sou anfitriao') || lowerMsg.includes('o que é anfitrião') || lowerMsg.includes('nem sei o que é isso')) {
      fallbackReply = 'Ah, sem problemas meu amigo! Anfitrião é quem aluga uma casa de praia, um chalé por temporada ou tem uma pousada. Se você tá só curioso ou quer entender a ferramenta, fica à vontade pra perguntar o que quiser!';
    } else if (lowerMsg.includes('quanto custa') || lowerMsg.includes('valor') || lowerMsg.includes('preço') || lowerMsg.includes('precos') || lowerMsg.includes('plano')) {
      fallbackReply = 'Nossos planos cabem no bolso: o LITE sai por R$ 97/mês (pra quem tem 1 imóvel), o PRO por R$ 197/mês (pousadas até 15 quartos) e o MAX por R$ 397/mês. Você administra quantas acomodações hoje?';
    } else if (lowerMsg.includes('whatsapp') || lowerMsg.includes('mensagem')) {
      fallbackReply = 'No WhatsApp, a gente conecta seu número via QR Code sem burocracia. O Seu Zélla aprende seu tom de voz e responde os hóspedes na hora, 24 horas por dia, com zero taxas da Meta!';
    } else if (lowerMsg.includes('fechadura') || lowerMsg.includes('pin') || lowerMsg.includes('senha')) {
      fallbackReply = 'A gente integra com fechaduras Tuya, TTLock e Intelbras! Quando a reserva é confirmada, o Zé gera o PIN de acesso e manda pro WhatsApp do hóspede sozinho.';
    } else {
      fallbackReply = 'Olá, meu amigo! Sou o Seu Zélla! Tô por aqui pra te ajudar no que precisar sobre o atendimento do WhatsApp, fechaduras ou planos pro seu imóvel. O que você gostaria de saber?';
    }

    if (locationTips) {
      fallbackReply += locationTips;
    }

    return {
      success: true,
      reply: fallbackReply,
      recommendedPlan,
      suggestedActions: ['Tenho 1 imóvel', 'Tenho uma pousada', 'Ver planos']
    };
  }
}
