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
- Se perguntarem sobre os planos:
  * LITE (R$ 97/mês): para quem tem 1 único imóvel ou chalé.
  * PRO (R$ 197/mês): para pousadas até 15 quartos (com fechaduras, iCal sem overbooking e PIX).
  * MAX (R$ 397/mês): para redes maiores ou consultoria executiva.

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

    // Verificação de segurança Zero-Trust
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

    // Identificação pragmática de planos recomendados por quantidade de quartos
    let recommendedPlan: 'lite' | 'pro' | 'max' | undefined;
    if (lowerMsg.includes('1 quarto') || lowerMsg.includes('um quarto') || lowerMsg.includes('1 imóvel') || lowerMsg.includes('1 chalé') || lowerMsg.includes('uma casa')) {
      recommendedPlan = 'lite';
    } else if (lowerMsg.includes('vários imóveis') || lowerMsg.includes('varias pousadas') || lowerMsg.includes('mais de 15') || lowerMsg.includes('rede de pousadas')) {
      recommendedPlan = 'max';
    } else if (lowerMsg.includes('quartos') || lowerMsg.includes('pousada') || lowerMsg.includes('chalés')) {
      recommendedPlan = 'pro';
    }

    // Checar se o usuário mencionou uma cidade conhecida para enriquecer com dicas locais
    const cityKey = GoogleMapsService.normalizeCityKey(lowerMsg);
    let locationTips = '';
    if (cityKey !== 'default') {
      const places = await GoogleMapsService.getNearbyPlaces(lowerMsg);
      locationTips = GoogleMapsService.formatPlacesResponse(places, userMessage);
    }

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

      let reply = llmRes.content || 'Olá, meu amigo anfitrião! Sou o Seu Zélla! Tô por aqui pra te ajudar na sua hospedagem hoje!';
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
    } catch (error) {
      console.error('[ZellaSalesBrain] Erro ao processar IA de Vendas:', error);
      let reply = 'Olá, meu amigo anfitrião! Sou o Seu Zélla! Tô por aqui pra te ajudar na sua hospedagem hoje!';
      if (locationTips) {
        reply += locationTips;
      }
      return {
        success: true,
        reply,
        recommendedPlan: recommendedPlan || 'pro',
        suggestedActions: ['Tenho 1 imóvel', 'Tenho uma pousada', 'Ver planos']
      };
    }
  }
}
