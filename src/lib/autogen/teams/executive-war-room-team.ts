// =============================================================================
// SEU ZÉLLA AUTOGEN TEAM — EXECUTIVE WAR ROOM (BOARD ADVISORY)
// =============================================================================

import { ConversableAgent } from '../core/conversable-agent';
import { GroupChat, GroupChatManager } from '../core/group-chat';
import { type GroupChatTranscript } from '../core/types';

export function createExecutiveWarRoomTeam(): {
  finance: ConversableAgent;
  demand: ConversableAgent;
  retention: ConversableAgent;
  manager: GroupChatManager;
} {
  const finance = new ConversableAgent({
    name: 'FinanceDirector',
    systemMessage: 'Diretor Financeiro focado em margem líquida, MRR e comissões de UPSELL.',
  });

  const demand = new ConversableAgent({
    name: 'DemandStrategist',
    systemMessage: 'Estrategista de Demanda focado em conversão de canais diretos PIX vs OTAs.',
  });

  const retention = new ConversableAgent({
    name: 'RetentionSpecialist',
    systemMessage: 'Especialista em LTV e Satisfação do Cliente (NPS > 9.2).',
  });

  finance.registerReply(async (messages) => {
    return {
      content: '[Financeiro]: Migrar 40% das reservas para Direct PIX economiza R$ 3.800/mês em taxas da Booking/Airbnb e aumenta o lucro líquido imediato.',
      tokensUsed: 80,
    };
  });

  demand.registerReply(async (messages) => {
    return {
      content: '[Demanda]: Oferecendo late checkout cortesia para quem reserva direto via WhatsApp, a taxa de conversão sobe 28% no piloto da região.',
      tokensUsed: 75,
    };
  });

  retention.registerReply(async (messages) => {
    return {
      content: '[Retenção]: O NPS dos hóspedes que utilizam o Guia WhatsApp do Seu Zélla subiu para 9.6. Recomendação do comitê aprovada por unanimidade! TERMINATE',
      tokensUsed: 85,
    };
  });

  const groupChat = new GroupChat([finance, demand, retention], 4);
  const manager = new GroupChatManager(groupChat, {
    maxRounds: 4,
    speakerSelectionMethod: 'round_robin',
  });

  return { finance, demand, retention, manager };
}

export async function runExecutiveWarRoom(topicQuestion: string): Promise<GroupChatTranscript> {
  const { manager } = createExecutiveWarRoomTeam();
  return manager.run('ExecutiveWarRoom', topicQuestion);
}
