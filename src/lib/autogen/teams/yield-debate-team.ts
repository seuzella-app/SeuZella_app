// =============================================================================
// SEU ZÉLLA AUTOGEN TEAM — YIELD DEBATE WAR ROOM (MAXIMIZER VS DEFENDER)
// =============================================================================

import { ConversableAgent } from '../core/conversable-agent';
import { GroupChat, GroupChatManager } from '../core/group-chat';
import { type GroupChatTranscript } from '../core/types';

export function createYieldDebateTeam(): {
  maximizer: ConversableAgent;
  defender: ConversableAgent;
  manager: GroupChatManager;
} {
  const maximizer = new ConversableAgent({
    name: 'YieldMaximizer',
    systemMessage: 'Você é o Estrategista Agressivo de Revenue Management. Seu objetivo é buscar a margem máxima de lucro extra nos feriados.',
  });

  const defender = new ConversableAgent({
    name: 'OccupancyDefender',
    systemMessage: 'Você é o Guardião de Ocupação e Risco de Cancelamento. Seu objetivo é evitar diárias abusivas que afastem hóspedes.',
  });

  maximizer.registerReply(async (messages) => {
    const last = messages[messages.length - 1]?.content || '';
    if (messages.length <= 1) {
      return {
        content: 'Proponho um aumento de +R$ 300 por diária no feriado. A procura está aquecida e podemos capturar alto excedente.',
        tokensUsed: 80,
      };
    }
    if (last.includes('R$ 220') || last.includes('acordo')) {
      return {
        content: 'Concordo com o ponto de equilíbrio em +R$ 220/quarto. Garante +R$ 3.682,80 líquidos (93%) para o anfitrião e excelente taxa de ocupação. Decisão aprovada! TERMINATE',
        tokensUsed: 95,
      };
    }
    return {
      content: 'Entendo o risco. Que tal fecharmos em +R$ 220/quarto mantendo 93% pro anfitrião e 7% pro Zélla?',
      tokensUsed: 75,
    };
  });

  defender.registerReply(async (messages) => {
    const last = messages[messages.length - 1]?.content || '';
    if (last.includes('+R$ 300')) {
      return {
        content: 'Alerta: +R$ 300 aumenta o risco de cancelamento em 22% com base no histórico da região. Recomendo negociar um valor intermediário como +R$ 220/quarto para garantir 100% de ocupação.',
        tokensUsed: 90,
      };
    }
    return {
      content: 'Excelente. Em +R$ 220/diária o risco de vacância é quase nulo e a margem extra é fantástica. Estamos em total consenso. TERMINATE',
      tokensUsed: 80,
    };
  });

  const groupChat = new GroupChat([maximizer, defender], 4);
  const manager = new GroupChatManager(groupChat, {
    maxRounds: 4,
    speakerSelectionMethod: 'round_robin',
  });

  return { maximizer, defender, manager };
}

export async function runYieldDebate(holidayName: string, basePrice: number): Promise<GroupChatTranscript> {
  const { manager } = createYieldDebateTeam();
  const query = `Debate Estratégico de Precificação para "${holidayName}" (Diária base: R$ ${basePrice}). Qual o reajuste ideal?`;
  return manager.run('YieldDebate', query);
}
