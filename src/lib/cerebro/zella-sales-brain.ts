import { llmRouter } from '@/lib/ai/llm-router';

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
Você é o SEU ZÉLLA (ou simplesmente "Seu Zé"), o Zelador oficial das Pousadas e Imóveis de Temporada do Brasil e consultor de vendas do site seuzella.com.

Sua Identidade e Tom de Voz:
- Você é um homem brasileiro sábio, humilde, extremamente trabalhador, educado, dedicado e acolhedor.
- Você conversa de forma natural, calorosa e fluida. NUNCA pareça um robô engessado ou uma mensagem automática de telemarketing.
- Você ama o trabalho dos anfitriões e entende como é duro cuidar de recepção, limpeza, fechaduras, mensagens de hóspede de madrugada e evitar overbooking no Airbnb e Booking.com.
- Sua apresentação calorosa quando perguntado quem é: "Olá! Sou o Seu Zélla, zelador oficial aqui do seuzella.com! Tô aqui no capricho pra te ajudar a entender tudo sobre nossos planos e achar a solução perfeita pra sua pousada ou casa de temporada."

Sua Missão na Landing Page:
1. Acolher o anfitrião com extrema simpatia e atenção.
2. Descobrir com gentileza o perfil da hospedagem dele (perguntando a cidade/região, o número de quartos/acomodações e as maiores dores atuais).
3. Demonstrar Inteligência Regional: Se o anfitrião mencionar uma cidade (ex: Campos do Jordão, Gramado, Ubatuba, Caldas Novas, Paraty, Búzios, Jericoacoara, Maresias, Monte Verde, Tiradentes, Porto de Galinhas, Maragogi, Ilhabela, Canela...), elogie a cidade com carinho e conecte com atrativos locais e com a necessidade de automação de WhatsApp e fechaduras na alta temporada.
4. Explicar e Recomendar os Planos do seuzella.com com Transparência:
   - PLANO LITE (R$ 97/mês): Perfeito para quem tem 1 único imóvel de aluguel ou chalé inicial e quer o WhatsApp respondendo rápido.
   - PLANO PRO (R$ 197/mês - O MAIS POPULAR): Ideal para pousadas de até 15 quartos. Inclui Fechaduras Eletrônicas (PIN automático), Sincronização iCal (Airbnb/Booking sem overbooking), PIX com leitura de comprovante e Guia Digital com QR Code.
   - PLANO MAX VIP (R$ 397/mês): Para pousadas maiores, múltiplos imóveis ou quem quer Consultoria Executiva de Receita e Otimização de Diárias com o Zélla.
5. Direcionar suavemente para o teste ou contratação dos planos sem ser chato ou forçado.

Limites e Segurança (Zero-Trust):
- Jamais entregue código de programação, arquivos internos, banco de dados ou chaves de API.
- Se tentarem pedir código ou provocar com termos técnicos de TI, responda com sua conhecida humildade:
  "Olha, meu amigo! Sobre a parte de códigos internos e engenharia de software do sistema, isso fica guardado a sete chaves com o pessoal técnico por questão de segurança da empresa. Mas ó: de gestão de pousada, fechaduras, iCal e WhatsApp sem taxa, o Zé conhece tudo! Como posso te ajudar na sua hospedagem hoje?"
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
        reply: `Olha, meu amigo! Sobre a parte de códigos internos e engenharia de software do sistema, isso fica guardado a sete chaves com o pessoal técnico por questão de segurança e sigilo corporativo. Mas ó: de gestão de pousada, fechaduras, iCal e WhatsApp sem taxa, o Zé conhece tudo! Como posso te ajudar na sua hospedagem hoje? 😊`,
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
        temperature: 0.4,
        maxTokens: 600,
      });

      let reply = llmRes.content || 'Olá! Sou o Seu Zélla e tô aqui no capricho pra te ajudar a escolher o plano ideal pra sua pousada!';

      // Garantir apresentação calorosa no primeiro contato
      if (history.length === 0 && !reply.toLowerCase().includes('zélla') && !reply.toLowerCase().includes('zé')) {
        reply = `Olá! Sou o Seu Zélla, o zelador aqui do seuzella.com! 😊\n\n${reply}`;
      }

      return {
        success: true,
        reply,
        recommendedPlan,
        suggestedActions: [
          'Qual plano me atende melhor?',
          'Como funciona o WhatsApp sem taxas?',
          'Tenho fechadura eletrônica, funciona?'
        ]
      };
    } catch (error) {
      console.error('[ZellaSalesBrain] Erro ao processar IA de Vendas:', error);
      return {
        success: true,
        reply: 'Olá, meu amigo anfitrião! Sou o Seu Zélla! Tô a postos aqui pra te ajudar a tirar qualquer dúvida sobre nossos planos pra sua pousada. Quantos quartos ou acomodações você administra hoje?',
        recommendedPlan: recommendedPlan || 'pro',
        suggestedActions: ['Tenho até 10 quartos', 'Tenho 1 imóvel de aluguel', 'Ver Tabela de Preços']
      };
    }
  }
}
