// ═══════════════════════════════════════════════════════════════
// AIRB AI RESPONDER SWARM — ZÉLLA AIRB
// Orquestrador de Agentes Inteligentes e Regras de Negócio Airbnb
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { buildAirBSystemPrompt, getAgentForIntent, type AirBIntent } from './system-prompt';
import { queryRAG } from './rag-pipeline';
import { filterPixFromResponse, type PlatformContext, checkEntitlement } from './gatekeeper';
import { llmRouter } from '../ai/llm-router';

interface ProcessAirBMessageParams {
  tenantId: string;
  conversationId: string;
  messageContent: string;
}

export async function processAirBMessage(params: ProcessAirBMessageParams): Promise<{
  responseContent: string;
  agentName: string;
  intent: AirBIntent;
}> {
  const { tenantId, conversationId, messageContent } = params;

  // 1. Fetch conversation and property context
  const conversation = await db.airBConversation.findUnique({
    where: { id: conversationId },
    include: { property: true }
  });

  if (!conversation) {
    throw new Error(`Conversation not found: ${conversationId}`);
  }

  const property = conversation.property;

  // 2. Check active AI conversations entitlement
  const entitlement = await checkEntitlement(tenantId, 'ACCESS_AI_CONVERSATIONS', undefined, property.id);
  if (!entitlement.allowed) {
    return {
      responseContent: `[Sistema: Limite do plano atingido para conversas de IA: ${entitlement.reason}]`,
      agentName: 'SYSTEM',
      intent: 'general_greet'
    };
  }

  // 3. Save incoming message
  await db.airBMessage.create({
    data: {
      conversationId,
      direction: 'inbound',
      content: messageContent,
      isAiGenerated: false
    }
  });

  // 4. Classify intent
  let intent: AirBIntent = 'general_greet';
  const cleanMsg = messageContent.toLowerCase();
  if (cleanMsg.includes('checkin') || cleanMsg.includes('check-in') || cleanMsg.includes('entrar') || cleanMsg.includes('chegar')) {
    intent = 'checkin';
  } else if (cleanMsg.includes('checkout') || cleanMsg.includes('check-out') || cleanMsg.includes('sair') || cleanMsg.includes('partir')) {
    intent = 'checkout';
  } else if (cleanMsg.includes('regra') || cleanMsg.includes('pet') || cleanMsg.includes('fumar') || cleanMsg.includes('festa')) {
    intent = 'house_rules';
  } else if (cleanMsg.includes('wifi') || cleanMsg.includes('wi-fi') || cleanMsg.includes('internet') || cleanMsg.includes('piscina') || cleanMsg.includes('aquecida')) {
    intent = 'amenities';
  } else if (cleanMsg.includes('preço') || cleanMsg.includes('valor') || cleanMsg.includes('diária') || cleanMsg.includes('desconto') || cleanMsg.includes('quanto custa')) {
    intent = 'pricing';
  } else if (cleanMsg.includes('reservar') || cleanMsg.includes('confirma') || cleanMsg.includes('fechar')) {
    intent = 'booking_intent';
  } else if (cleanMsg.includes('local') || cleanMsg.includes('onde fica') || cleanMsg.includes('endereço') || cleanMsg.includes('localização')) {
    intent = 'location_info';
  } else if (cleanMsg.includes('supermercado') || cleanMsg.includes('padaria') || cleanMsg.includes('restaurante') || cleanMsg.includes('praia') || cleanMsg.includes('perto')) {
    intent = 'neighborhood';
  } else if (cleanMsg.includes('problema') || cleanMsg.includes('quebrado') || cleanMsg.includes('sujo') || cleanMsg.includes('limpeza') || cleanMsg.includes('vazamento')) {
    intent = 'complaint';
  } else if (cleanMsg.includes('ajuda') || cleanMsg.includes('urgente') || cleanMsg.includes('emergência') || cleanMsg.includes('polícia') || cleanMsg.includes('médico')) {
    intent = 'emergency';
  }

  const agentName = getAgentForIntent(intent);

  // 5. Query RAG context for the specific agent and property
  let ragContextBlock = '';
  if (agentName === 'CONCIERGE' || agentName === 'ANFITRIAO' || agentName === 'CHECK_IN' || agentName === 'RESOLVER') {
    const ragData = await queryRAG(tenantId, property.id, messageContent, intent);
    ragContextBlock = ragData.assembledContext;
  }

  // 6. Build system prompt
  const systemPrompt = buildAirBSystemPrompt({
    propertyName: property.name,
    hostFirstName: property.name.split(' ')[0],
    propertyType: property.propertyType,
    maxGuests: property.maxGuests,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    checkinTime: property.checkinTime,
    checkoutTime: property.checkoutTime,
    houseRules: property.houseRules,
    amenities: property.amenities,
    hostKnowledge: property.hostKnowledge,
    emergencyContacts: property.emergencyContacts,
    checkinInstructions: property.lockCode ? `Código da fechadura: ${property.lockCode}` : undefined,
    ragContextBlock,
    platformContext: conversation.platformContext as PlatformContext,
    conversationMode: conversation.mode as 'pre_booking' | 'post_booking'
  });

  // 7. Get last messages history
  const recentMessages = await db.airBMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    take: 8
  });

  const formattedHistory = recentMessages.map(msg => ({
    role: msg.direction === 'inbound' ? 'user' : 'assistant',
    content: msg.content
  }));

  // 8. Generate AI response via Cérebro Zélla GuestResponderBrain
  const { GuestResponderBrain } = await import('@/lib/cerebro/guest-responder-brain');
  const brainRes = await GuestResponderBrain.processGuestMessage({
    tenantId,
    niche: 'airbnb',
    channel: conversation.platformContext && (conversation.platformContext as any).platform === 'airbnb' ? 'airbnb_inbox' : 'whatsapp',
    messageContent,
    history: recentMessages.map(msg => ({
      from: msg.direction === 'inbound' ? 'guest' : 'ai',
      content: msg.content
    })),
    propertyContext: {
      name: property.name,
      city: property.city || 'Brasil',
    }
  });

  let responseContent = brainRes.response;

  // 9. Apply PIX Gate filters (refrequentado pelo Gatekeeper se for canal Airbnb)
  const platformContext = conversation.platformContext as PlatformContext;
  responseContent = filterPixFromResponse(responseContent, platformContext);

  // 10. Save outgoing AI message
  await db.airBMessage.create({
    data: {
      conversationId,
      direction: 'outbound',
      content: responseContent,
      intent,
      isAiGenerated: true
    }
  });

  // 11. Log the AI interaction
  await db.agentLog.create({
    data: {
      tenantId,
      agentId: agentName.toLowerCase(),
      action: 'airb_reply',
      status: 'success',
      inputTokens: llmResult.tokensUsed || 0,
      outputTokens: 0,
      costUsd: llmResult.cost || 0,
      metadata: JSON.stringify({
        intent,
        conversationId
      })
    }
  });

  // 12. Update conversation status
  await db.airBConversation.update({
    where: { id: conversationId },
    data: {
      lastIntent: intent,
      lastMessageAt: new Date(),
      messageCount: { increment: 1 }
    }
  });

  return {
    responseContent,
    agentName,
    intent
  };
}
