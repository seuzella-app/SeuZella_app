// =============================================================================
// SEU ZÉLLA AUTOGEN TEAM — GUEST EMPATHY & POLICY COMMITTEE (NESTED CHAT)
// =============================================================================

import { ConversableAgent } from '../core/conversable-agent';
import { NestedChatCoordinator } from '../core/nested-chat';
import { type GroupChatTranscript } from '../core/types';

export function createGuestEmpathyTeam(): {
  concierge: ConversableAgent;
  empathySpecialist: ConversableAgent;
  policyAuditor: ConversableAgent;
} {
  const concierge = new ConversableAgent({
    name: 'PrimaryConcierge',
    systemMessage: 'Concierge principal do WhatsApp do Seu Zélla.',
  });

  const empathySpecialist = new ConversableAgent({
    name: 'EmpathySpecialist',
    systemMessage: 'Especialista em hospitalidade humanizada, acolhimento e desescalada de atritos.',
  });

  const policyAuditor = new ConversableAgent({
    name: 'PolicyAuditor',
    systemMessage: 'Auditor de regras e horários da propriedade para evitar promessas indevidas.',
  });

  empathySpecialist.registerReply(async (messages) => {
    return {
      content: 'Proposta de Acolhimento: "Compreendo perfeitamente sua situação e queremos que sua experiência seja inesquecível! Vamos verificar a disponibilidade agora mesmo com todo carinho."',
      tokensUsed: 70,
    };
  });

  policyAuditor.registerReply(async (messages) => {
    return {
      content: 'Validação de Política: Check-in antecipado sujeito à liberação da governança às 13:00 sem custo adicional. Resposta segura e acolhedora aprovada! TERMINATE',
      tokensUsed: 65,
    };
  });

  return { concierge, empathySpecialist, policyAuditor };
}

export async function runGuestEmpathyNestedChat(
  guestQuery: string,
  guestName = 'Hóspede'
): Promise<{ finalResponse: string; transcript: GroupChatTranscript }> {
  const { concierge, empathySpecialist, policyAuditor } = createGuestEmpathyTeam();

  const res = await NestedChatCoordinator.execute(
    concierge,
    {
      recipient: [empathySpecialist, policyAuditor],
      topic: 'GuestInquiryCommittee',
      maxRounds: 3,
    },
    `Analisar mensagem de ${guestName}: "${guestQuery}"`
  );

  const finalResponse = `Olá, ${guestName}! Compreendemos perfeitamente sua solicitação e queremos que sua estadia seja incrível. Estamos organizando com nossa governança para liberar sua suíte a partir das 13h sem nenhum custo extra! ✨🔑`;

  return {
    finalResponse,
    transcript: res.transcript,
  };
}
