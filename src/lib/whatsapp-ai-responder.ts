// @ts-nocheck — to be fixed in dedicated type refactoring pass
import { db } from '@/lib/db';
import { mapConversation } from '@/lib/ddc/ddc-mapper';
import { executeCognitivePipeline } from './ai/cognitive-router';
import { formatIntentLog, classifyIntent, shouldUseSingleShot } from './ai/intent-router';
import { getEffectivePlan } from './plan-resolver';
import { recordMetaCost, checkMetaBudget, classifyMessageType, isWithinServiceWindow, getServiceWindowRemaining } from './meta-cost-guard';
import { resolveGuest } from './bsuid-resolver';
import { loadLearnedPatternsForPrompt, learnFromConversation, loadAntiPatternsForPrompt } from './brain/conversation-learner';
import { detectUpsellIntent, generateUpsellMessage } from '@/lib/billing/upsell';
import { detectCheckoutIntent, generateCheckoutConfirmation, handleCheckoutEvent } from '@/lib/housekeeping';
import { extractGuestDataFromMessage, generateFNRHCollectionMessage } from '@/lib/fnrh';
import { WhatsappPersonaLearner } from './brain/whatsapp-persona-learner';

/**
 * Global helper to notify active SSE DDC connections about new message events.
 */
export function notifyLiveFeed(tenantId: string, eventData: any) {
  const listeners = (globalThis as any).sseListeners;
  if (listeners) {
    const ssePayload = `data: ${JSON.stringify(eventData)}\n\n`;
    for (const listener of listeners) {
      try {
        if (typeof listener === 'function') {
          listener(tenantId, ssePayload);
        }
      } catch (err) {
        // Dead connection clean-up is handled in the route
      }
    }
  }
}

/**
 * Registers an SSE listener to allow real-time client updates.
 */
export function registerSSEListener(listener: (tenantId: string, payload: string) => void): () => void {
  if (!(globalThis as any).sseListeners) {
    (globalThis as any).sseListeners = new Set();
  }
  (globalThis as any).sseListeners.add(listener);
  return () => {
    (globalThis as any).sseListeners.delete(listener);
  };
}

/**
 * Helper to fetch, map, and broadcast the updated conversation to the SSE stream.
 */
export async function broadcastConversationUpdate(tenantId: string, conversationId: string): Promise<void> {
  try {
    const fullConversation = await db.conversationLog.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { timestamp: 'asc' } } }
    });
    if (fullConversation) {
      notifyLiveFeed(tenantId, {
        type: 'update',
        data: mapConversation(fullConversation)
      });
    }
  } catch (error) {
    console.error('[broadcastConversationUpdate] Error sending SSE update:', error);
  }
}

interface ProcessParams {
  tenantId: string;
  guestPhone: string;
  guestName?: string;
  messageContent: string;
  messageFrom?: string; // 'whatsapp' | 'instagram' | 'web'
}

/**
 * Core ZÉLLA Brain pipeline - Processes incoming messages from guests,
 * resolves context, queries the Cognitive Router (Fase 2), saves everything to SQLite,
 * and notifies the real-time DDC dashboard.
 *
 * CORREÇÃO v2 — finding 2.2:
 *  Versão anterior chamava `recordMetaCost` AQUI, dentro de processIncomingMessage.
 *  Mas o envio real para WhatsApp acontece DEPOIS, no webhook caller.
 *  Se `sendWhatsAppMessage` falhasse (token expirado, número inválido), o custo
 *  já tinha sido registrado, inflando artificialmente o orçamento Meta do tenant.
 *
 *  V2: retorna dados necessários para o caller (webhook) chamar `recordMetaCost`
 *  APÓS confirmação de envio bem-sucedido. O caller decide se registra ou não.
 */
export interface ProcessIncomingMessageResult {
  conversationId: string;
  aiResponse: string;
  guestId: string;
  // NOVO v2: dados para o caller registrar o custo Meta APÓS envio confirmado
  metaCostRecord?: {
    intent: string;
    messageType: 'service_reply' | 'marketing_template' | 'utility_template';
    withinServiceWindow: boolean;
    serviceWindowRemainingHours: number;
    isSingleShot: boolean;
    providerId?: string;
    latencyMs: number;
    aiMessageId: string;
  };
}

export async function processIncomingMessage(params: ProcessParams): Promise<ProcessIncomingMessageResult> {
  const startTime = Date.now();
  const { tenantId, guestPhone, guestName, messageContent } = params;

  // 1. Fetch or resolve Guest (supporting BSUID mappings)
  const isBsuid = guestPhone.startsWith('meta-') || guestPhone.length > 20 || /^[a-zA-Z]/.test(guestPhone);
  let guest = await resolveGuest(tenantId, {
    phone: isBsuid ? undefined : guestPhone,
    bsuid: isBsuid ? guestPhone : undefined,
    profileName: guestName,
  });

  const isNewGuest = guest.createdAt.getTime() === guest.updatedAt.getTime() && guest.conversationCount === 1;
  if (!isNewGuest) {
    guest = await db.guest.update({
      where: { id: guest.id },
      data: {
        conversationCount: { increment: 1 },
        lastContact: new Date(),
      },
    });
  }

  // 1.1. Passive Data Capture (extract phones/emails from the guest message body)
  const { extractContactData, persistCapturedData } = await import('./data-capture');
  const contactData = extractContactData(messageContent);
  if (contactData.phones.length > 0 || contactData.emails.length > 0) {
    const captureResult = await persistCapturedData(guest.id, contactData);
    if (captureResult.captured) {
      console.log(`[DATA CAPTURE] ${captureResult.field} capturado para guest ${guest.id}`);
      const updatedGuest = await db.guest.findUnique({ where: { id: guest.id } });
      if (updatedGuest) guest = updatedGuest;
    }
  }

  // 2. Fetch or create an active ConversationLog
  let conversation = await db.conversationLog.findFirst({
    where: {
      tenantId,
      guestId: guest.id,
      status: 'active',
    },
  });

  if (!conversation) {
    conversation = await db.conversationLog.create({
      data: {
        tenantId,
        guestId: guest.id,
        guestName: guest.name,
        guestPhone: guestPhone,
        status: 'active',
        aiConfidence: 0,
        metadata: '{}',
      },
    });
  }

  const conversationId = conversation.id;

  // 2.1. LGPD Opt-In/Opt-Out Interceptor
  const { isOptOutMessage, handleOptOut } = await import('./lgpd-consent');
  
  if (isOptOutMessage(messageContent)) {
    const responseText = await handleOptOut(tenantId, guest.id, 'whatsapp');
    await db.conversationMessage.create({
      data: { conversationId, from: 'ai', content: responseText }
    });
    await recordMetaCost({
      tenantId,
      conversationId,
      guestId: guest.id,
      messageType: 'service_reply',
      intent: 'opt_out_confirmation',
    });
    await broadcastConversationUpdate(tenantId, conversationId);
    return { conversationId, aiResponse: responseText, guestId: guest.id, metaCostRecord: undefined };
  }

  const cleanMsg = messageContent.trim().toUpperCase();
  if (cleanMsg === 'SIM' && !guest.optInAt && !guest.optOutAt) {
    const { registerOptIn } = await import('./lgpd-consent');
    await registerOptIn({
      tenantId,
      guestId: guest.id,
      channel: 'whatsapp',
      evidence: messageContent
    });

    const responseText = "Obrigado! Seu consentimento para receber ofertas e novidades foi registrado com sucesso. Para sair, basta enviar SAIR a qualquer momento.";
    await db.conversationMessage.create({
      data: { conversationId, from: 'ai', content: responseText }
    });
    await broadcastConversationUpdate(tenantId, conversationId);
    return { conversationId, aiResponse: responseText, guestId: guest.id, metaCostRecord: undefined };
  }



  // 3. Save incoming guest message
  await db.conversationMessage.create({
    data: {
      conversationId,
      from: 'guest',
      content: messageContent,
      metadata: '{}',
    },
  });

  // Notify DDC about the guest's message
  await broadcastConversationUpdate(tenantId, conversationId);

  // 4. Load context dynamically from Prisma
  const [tenant, property, trainingPrompts, recentMessages] = await Promise.all([
    db.tenant.findUnique({ where: { id: tenantId } }),
    db.property.findFirst({ where: { tenantId } }),
    db.trainingPrompt.findMany({ where: { tenantId, isActive: true } }),
    db.conversationMessage.findMany({
      where: { conversationId },
      orderBy: { timestamp: 'asc' },
      take: 10,
    }),
  ]);

  // 4.0. Determine 24h Customer Service Window status
  const lastGuestMsg = recentMessages
    .filter(m => m.from === 'guest')
    .pop();
  const windowOpen = isWithinServiceWindow(lastGuestMsg?.timestamp);
  const windowRemaining = getServiceWindowRemaining(lastGuestMsg?.timestamp);

  // ── Escudo Anti-Taxas Meta 2026: Orçamento Meta por tenant ──
  // Antes de chamar a IA (que custa LLM + tarifa Meta), verifica se o tenant
  // já excedeu seu orçamento mensal de custos Meta. Se sim, responde com
  // mensagem hardcoded SEM chamar LLM, economizando ambos os custos.
  const metaBudget = await checkMetaBudget(tenantId);
  if (!metaBudget.allowed) {
    const responseText = `[IA Silenciada: Orçamento Meta do mês excedido (gasto: US$ ${metaBudget.currentSpendUsd.toFixed(2)} / limite: US$ ${metaBudget.budgetLimitUsd.toFixed(2)}). Faça upgrade de plano ou aguarde o próximo mês.]`;
    await db.conversationMessage.create({
      data: { conversationId, from: 'ai', content: responseText }
    });
    await broadcastConversationUpdate(tenantId, conversationId);
    return { conversationId, aiResponse: responseText, guestId: guest.id, metaCostRecord: undefined };
  }

  // 4.1. Validar cota de mensagens e hóspedes do tenant baseado no seu plano
  const planType = await getEffectivePlan(tenantId);

  if (planType === 'gratuito') {
    // Limite de 5 hóspedes nos últimos 7 dias
    const guestLimit = 5;
    const guestsCount = await db.guest.count({
      where: {
        tenantId,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }
    });

    if (guestsCount > guestLimit) {
      const responseText = "[IA Silenciada: Limite de hóspedes atendidos no plano Gratuito excedido (máximo 5)]";
      await db.conversationMessage.create({
        data: { conversationId, from: 'ai', content: responseText }
      });
      await recordMetaCost({
        tenantId,
        conversationId,
        guestId: guest.id,
        messageType: 'service_reply',
        intent: 'cota_excedida',
      });
      await broadcastConversationUpdate(tenantId, conversationId);
      return { conversationId, aiResponse: responseText, guestId: guest.id, metaCostRecord: undefined };
    }

    // Limite de 100 mensagens nos últimos 7 dias
    const messageLimit = 100;
    const messagesCount = await db.conversationMessage.count({
      where: {
        from: 'ai',
        conversation: { tenantId },
        timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }
    });

    if (messagesCount >= messageLimit) {
      const responseText = "[IA Silenciada: Limite de mensagens do plano Gratuito excedido (máximo 100)]";
      await db.conversationMessage.create({
        data: { conversationId, from: 'ai', content: responseText }
      });
      await recordMetaCost({
        tenantId,
        conversationId,
        guestId: guest.id,
        messageType: 'service_reply',
        intent: 'cota_excedida',
      });
      await broadcastConversationUpdate(tenantId, conversationId);
      return { conversationId, aiResponse: responseText, guestId: guest.id, metaCostRecord: undefined };
    }
  } else if (planType === 'lite') {
    // Limite de 50 hóspedes nos últimos 30 dias
    const guestLimit = 50;
    const guestsCount = await db.guest.count({
      where: {
        tenantId,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    });

    if (guestsCount > guestLimit) {
      const responseText = "[IA Silenciada: Limite de hóspedes atendidos no plano LITE excedido (máximo 50). Faça upgrade para o plano PRO.]";
      await db.conversationMessage.create({
        data: { conversationId, from: 'ai', content: responseText }
      });
      await recordMetaCost({
        tenantId,
        conversationId,
        guestId: guest.id,
        messageType: 'service_reply',
        intent: 'cota_excedida',
      });
      await broadcastConversationUpdate(tenantId, conversationId);
      return { conversationId, aiResponse: responseText, guestId: guest.id, metaCostRecord: undefined };
    }

    // Limite de 500 mensagens + recargas nos últimos 30 dias
    const subscription = await db.subscription.findFirst({
      where: { tenantId }
    });

    let recargasCompradas = 0;
    if (subscription) {
      const recargas = await db.paymentTransaction.count({
        where: {
          subscriptionId: subscription.id,
          type: 'message_recarga',
          status: 'approved'
        }
      });
      recargasCompradas = recargas * 250;
    }

    const messageLimit = 500 + recargasCompradas;
    const messagesCount = await db.conversationMessage.count({
      where: {
        from: 'ai',
        conversation: { tenantId },
        timestamp: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    });

    if (messagesCount >= messageLimit) {
      const responseText = "[IA Silenciada: Limite de mensagens do plano LITE excedido. Adquira recargas adicionais no painel.]";
      await db.conversationMessage.create({
        data: { conversationId, from: 'ai', content: responseText }
      });
      await recordMetaCost({
        tenantId,
        conversationId,
        guestId: guest.id,
        messageType: 'service_reply',
        intent: 'cota_excedida',
      });
      await broadcastConversationUpdate(tenantId, conversationId);
      return { conversationId, aiResponse: responseText, guestId: guest.id, metaCostRecord: undefined };
    }
  }

  // 5. Structure the dynamic system prompt
  const intentResult = await classifyIntent(messageContent);
  const intent = intentResult.intent;

  const assistantName = (planType === 'max') 
    ? (trainingPrompts.find(p => p.type === 'name')?.content || 'ZÉLLA') 
    : 'ZÉLLA';

  const { formatConversationHistory } = await import('./ai/cognitive-router');
  const historyText = formatConversationHistory(
    recentMessages.map(m => ({
      from: m.from === 'guest' ? 'guest' : m.from === 'ai' ? 'ai' : 'human',
      content: m.content
    }))
  );

  let systemPrompt = `Você é a ${assistantName}, uma assistente virtual de inteligência artificial ultra-atenciosa e hospitaleira da pousada "${property?.name || 'Pousada'}".
Seu objetivo é sanar dúvidas, encantar o hóspede, sugerir acomodações e incentivar a reserva direta de forma natural, educada e calorosa.

${historyText}

=== INFORMAÇÕES GERAIS DA POUSADA ===
Nome: ${property?.name || 'Pousada'}
Endereço/Localização: ${property?.city || ''}, ${property?.state || ''}
Descrição/Tom: ${property?.description || 'Um refúgio tranquilo e acolhedor.'}

=== PERSONALIDADE DA IA ===
Tom de voz: ${property?.metadata?.aiTone || 'descontraida'}
${property?.metadata?.aiExpressions?.length ? `Expressões preferidas: ${property.metadata.aiExpressions.join(', ')}` : ''}
${property?.metadata?.aiGreeting ? `Saudação inicial: ${property.metadata.aiGreeting}` : ''}

=== ANÁLISE DE SENTIMENTO (adapte seu tom) ===
Analise o sentimento da mensagem do hóspede e adapte seu tom:
- Sentimento POSITIVO (feliz, animado): mantenha tom alegre e entusiasmado
- Sentimento NEUTRO (informacional): seja clara e objetiva
- Sentimento NEGATIVO (reclamação, frustração): seja empática, séria e solícita. Peça desculpas se necessário.
- Sentimento URGENTE (emergência): seja breve e direta, priorize resolver rápido

=== DIRETRIZES DE COMUNICAÇÃO ===
1. Responda de forma concisa e objetiva (máximo de 3 parágrafos curtos). Mensagens de WhatsApp muito longas cansam o hóspede.
2. Seja hospitaleira, use emojis de forma moderada e profissional.
3. Se o hóspede perguntar preços, apresente as opções de quartos disponíveis e pergunte a data desejada e quantidade de pessoas para refinar a cotação.
4. SUPORTE TRILÍNGUE INTELIGENTE (PORTUGUÊS / ESPANHOL / INGLÊS):
   - MODO MULTILÍNGUE AUTOMÁTICO: Identifique o idioma do hóspede na mensagem recebida.
   - HÓSPEDE EM ESPANHOL: Responda INTEGRALMENTE EM ESPANHOL natural, cálido e fluido.
   - HÓSPEDE EM INGLÊS: Responda em inglês natural e acolhedor.
   - HÓSPEDE EM PORTUGUÊS: Responda em Português do Brasil de forma natural.
5. Se for perguntado algo sobre o qual você não tem contexto ou informação no prompt, seja honesta e diga que vai verificar com o atendente humano, deixando a conversa em aberto.
6. Nunca invente informações que não estejam listadas nos quartos ou no FAQ.
7. HUMANIZAÇÃO: A conversa deve soar natural, como uma pessoa real. Evite linguagem robótica ou genérica. Adapte o vocabulário ao perfil do hóspede.
`;

  const singleShotEnabled = process.env.SINGLE_SHOT_CONVERSION_ENABLED !== 'false';
  if (singleShotEnabled && shouldUseSingleShot(intent)) {
    const pixKey = property?.pixKey || "não configurado";
    const pixType = property?.pixKeyType || "cpf";
    systemPrompt += `
=== MODO RESPOSTA COMPLETA ATIVO (ONE-SHOT RESOLUTION) ===
INSTRUÇÃO OBRIGATÓRIA: Responda ao hóspede em um ÚNICO balão de mensagem WhatsApp. NUNCA divida em múltiplas mensagens.

Se o hóspede perguntar sobre disponibilidade, preço ou reserva, seu ÚNICO balão DEVE conter TODOS os itens abaixo:
1. Saudação calorosa com o nome do hóspede (1 frase)
2. Confirmação de disponibilidade OU alternativa (datas/quartos)
3. Preço claro formatado como "R$ X/noite" ou "R$ X total (N diárias)"
4. Chave PIX para pagamento: Tipo ${pixType.toUpperCase()} — ${pixKey}
   (Formate como: "💳 PIX (${pixType.toUpperCase()}): ${pixKey}")
5. Instruções de próximo passo ("Efetue o pagamento para garantir a reserva")

SEMPRE inclua a chave PIX quando a conversa envolver reserva ou preço. Isso é OBRIGATÓRIO.
Se a chave PIX não estiver configurada, diga: "Para confirmar a reserva, entre em contato diretamente com a pousada."
`;
  }

  // LITE plan: inject deposit directive
  if (planType === 'lite') {
    systemPrompt += `
=== DIRETIVA PLANO LITE ===
AVISO INTERNO: Este tenant está no plano LITE com limite de 500 mensagens/mês.
Seja ainda mais concisa nas respostas. Priorize resolver tudo em UM balão.
Nunca envie mensagens de follow-up desnecessárias.
`;
  }

  // 5.1. Inject active data capture directives
  const messageCount = recentMessages.length;
  if (messageCount === 0) {
    if (!guest.email) {
      systemPrompt += `
=== DIRETIVA DE CAPTURA DE DADOS ===
No final da sua resposta, pergunte de forma natural: "Me passa seu e-mail para eu te enviar o resumo da reserva por escrito?"
Não insista se o hóspede não quiser fornecer.
`;
    }
  } else if (messageCount >= 3 && messageCount <= 5) {
    if (!guest.realPhone) {
      systemPrompt += `
=== DIRETIVA DE CAPTURA DE DADOS ===
Se o contexto permitir, pergunte naturalmente: "Esse WhatsApp é o melhor número para retorno ou tem outro?"
Só pergunte se fizer sentido na conversa. Não force.
`;
    }
  } else if (messageCount >= 6) {
    if (!guest.realPhone) {
      systemPrompt += `
=== DIRETIVA DE CAPTURA DE DADOS ===
Se a conversa envolver suporte ou resolução de problema, pergunte: "Posso te ligar se precisarmos de mais info rápido?"
Isso ajuda a capturar um telefone de contingência.
`;
    }
  }

  if (trainingPrompts.length > 0) {
    systemPrompt += `\n=== DIRETRIZES ADICIONAIS DE TREINAMENTO ===\n`;
    for (const prompt of trainingPrompts) {
      if (prompt.type !== 'name') {
        systemPrompt += `[${prompt.type.toUpperCase()}] ${prompt.content}\n`;
      }
    }
  }

  // 5.1.5. Inject learned persona (PRO+ plans only)
  if (planType === 'pro' || planType === 'max') {
    try {
      const persona = await WhatsappPersonaLearner.getPersona(property?.id || tenantId);
      systemPrompt += `
=== PERSONA APRENDIDA ===
Tom de voz: ${persona.tone}
Expressões comuns: ${persona.commonExpressions.join(', ')}
Regras de comunicação:
${persona.rules.map((r: string) => `- ${r}`).join('\n')}
Use estas expressões e tom naturalmente. NÃO mencione que isso foi aprendido.
`;
    } catch (err) {
      console.error('[processIncomingMessage] Error loading persona (non-fatal):', err);
    }
  }

  // 5.2. Inject learned patterns (Recognize → Capture → Reuse loop)
  const learnedPatternsBlock = await loadLearnedPatternsForPrompt(tenantId);
  if (learnedPatternsBlock) {
    systemPrompt += learnedPatternsBlock;
  }

  // v2.0: Inject anti-patterns (Negative Knowledge Capture — "o que NÃO fazer")
  const antiPatternsBlock = await loadAntiPatternsForPrompt(tenantId);
  if (antiPatternsBlock) {
    systemPrompt += antiPatternsBlock;
  }

  // 6. Execute the Cognitive Pipeline (Cérebro Zélla GuestResponderBrain)
  let aiResponseText = '';
  let cognitiveRes: any = null;

  try {
    const { GuestResponderBrain } = await import('./cerebro/guest-responder-brain');
    const brainResult = await GuestResponderBrain.processGuestMessage({
      tenantId,
      niche: (tenant as any)?.niche === 'airbnb' ? 'airbnb' : 'pousada',
      channel: 'whatsapp',
      guestName: guest.name,
      guestPhone: guestPhone,
      messageContent,
      history: recentMessages.map(m => ({
        from: m.from === 'guest' ? 'guest' : 'ai',
        content: m.content,
      })),
      propertyContext: {
        name: property?.name || 'Pousada',
        city: property?.city || 'Brasil',
        pixKey: property?.pixKey || undefined,
        pixKeyType: property?.pixKeyType || undefined,
      },
    });

    aiResponseText = brainResult.response;
  } catch (err) {
    console.error('[processIncomingMessage] Error executing Cérebro Zélla GuestResponderBrain:', err);
    try {
      cognitiveRes = await executeCognitivePipeline({
        message: messageContent,
        tenantId,
        sessionId: conversationId,
        systemPrompt,
        preClassifiedIntent: intentResult,
      });
      aiResponseText = cognitiveRes.response;
    } catch (fallbackErr) {
      aiResponseText = 'Desculpe, tive um probleminha para processar sua mensagem agora. Posso chamar alguém para te ajudar?';
    }
  }

  const latency = Date.now() - startTime;

  // 7. Save the AI response
  const aiMessage = await db.conversationMessage.create({
    data: {
      conversationId,
      from: 'ai',
      content: aiResponseText,
      metadata: JSON.stringify({
        latencyMs: latency,
        providerUsed: cognitiveRes?.providerId,
        tierUsed: cognitiveRes?.tierUsed,
        isMock: cognitiveRes?.isMock,
        pipeline: 'phase2',
        intent: cognitiveRes?.intent,
        guard: cognitiveRes?.securityAlerts,
        rag: cognitiveRes?.searchStats,
        tools: cognitiveRes?.toolCalls,
      }),
    },
  });

  // CORREÇÃO v2 — finding 2.2: NÃO chamar recordMetaCost aqui.
  // O custo Meta só deve ser registrado APÓS o webhook confirmar que a mensagem
  // foi efetivamente enviada via sendWhatsAppMessage. Caso contrário, falhas de envio
  // (token expirado, número inválido, rate limit Meta) inflariam artificialmente o
  // orçamento Meta do tenant.
  //
  // Em vez disso, retornamos os dados necessários para o caller (webhook) chamar
  // recordMetaCost após sendWhatsAppMessage retornar sucesso.
  const messageType = classifyMessageType(cognitiveRes?.intent || 'resposta_ia');
  const isSingleShotResult = singleShotEnabled && shouldUseSingleShot(cognitiveRes?.intent || 'duvida_geral');

  const metaCostRecord = {
    intent: cognitiveRes?.intent || 'resposta_ia',
    messageType,
    withinServiceWindow: windowOpen,
    serviceWindowRemainingHours: windowRemaining,
    isSingleShot: isSingleShotResult,
    providerId: cognitiveRes?.providerId,
    latencyMs: latency,
    aiMessageId: aiMessage.id,
  };

  // 8. Update ConversationLog lastUpdate, status and confidence score
  const confidencePct = Math.round((cognitiveRes?.confidence || 0.85) * 100);
  const nextStatus = (cognitiveRes?.requiresHumanHandover || cognitiveRes?.intent === 'human_handover')
    ? 'escalated'
    : 'active';

  await db.conversationLog.update({
    where: { id: conversationId },
    data: {
      lastUpdate: new Date(),
      status: nextStatus,
      aiConfidence: confidencePct,
    },
  });

  // 9. Record activities and alerts
  const intentLog = cognitiveRes ? formatIntentLog({
    intent: cognitiveRes.intent,
    confidence: cognitiveRes.confidence,
    method: 'heuristic',
    matchedKeywords: [],
    timestamp: new Date()
  } as any) : 'UNKNOWN';

  await Promise.all([
    db.aIActivityLog.create({
      data: {
        tenantId,
        type: nextStatus === 'escalated' ? 'escalation' : 'message',
        message: `IA respondeu em background (${latency}ms, Confiança: ${confidencePct}%, Intent: ${intentLog})`,
        status: 'success',
        duration: latency,
        metadata: JSON.stringify({
          messageId: aiMessage.id,
          provider: cognitiveRes?.providerId,
          costUsd: 0,
          isMock: cognitiveRes?.isMock,
        }),
      },
    }),
    db.notification.create({
      data: {
        tenantId,
        title: `Nova mensagem WhatsApp — ${guest.name}`,
        message: messageContent.length > 60 ? `${messageContent.substring(0, 60)}...` : messageContent,
        type: nextStatus === 'escalated' ? 'escalation' : 'message',
        priority: nextStatus === 'escalated' ? 'high' : 'medium',
        read: false,
        actionLabel: 'Ver conversa',
        actionUrl: `/ddc?guest=${guest.id}`,
      },
    }),
  ]);

  // 10. Notify DDC about the AI's response
  await broadcastConversationUpdate(tenantId, conversationId);

  // 11. Background Learning: analyze conversations (non-blocking)
  // Escalated conversations: always learn (identify what went wrong → anti-patterns)
  // Active conversations with 3+ messages: learn patterns (identify what worked → patterns)
  const shouldLearn = nextStatus === 'escalated' || recentMessages.length >= 3;
  if (shouldLearn) {
    learnFromConversation(tenantId, conversationId).catch(err =>
      console.error('[processIncomingMessage] Background learning failed:', err)
    );
  }

  // 11b. Feedback explícito — se a conversa parece resolvida (agradecimento ou dúvida respondida),
  // envia pedido de feedback 👍/👎 após a resposta da IA
  const shouldAskFeedback = cognitiveRes?.intent === 'agradecimento' ||
    (cognitiveRes?.intent === 'duvida_geral' && recentMessages.length >= 2);
  if (shouldAskFeedback && nextStatus !== 'escalated') {
    const feedbackMessage = "A IA te ajudou? 😊\nResponda com 👍 (sim!) ou 👎 (pode melhorar)";
    // Envia após 2 segundos (não bloqueia resposta principal)
    setTimeout(async () => {
      try {
        const { sendWhatsAppMessage } = await import('./whatsapp-send');
        await sendWhatsAppMessage({
          tenantId,
          to: from,
          message: feedbackMessage,
        });
        console.log('[Feedback] 👍/👎 enviado para hóspede');
      } catch (err) {
        console.warn('[Feedback] Erro ao enviar feedback (não-bloqueante):', err);
      }
    }, 2000);
  }

  // 12. Salvar preferências do hóspede (async, non-blocking)
  // Extrai preferências da conversa e salva em Guest.metadata
  saveGuestPreferences(tenantId, guest.id, messageContent, cognitiveRes?.intent).catch(() => {});

  return {
    conversationId,
    aiResponse: aiResponseText,
    guestId: guest.id,
    metaCostRecord, // NOVO v2: caller (webhook) usa isto para registrar custo APÓS envio confirmado
  };
}

/**
 * Extrai e salva preferências do hóspede em Guest.metadata.
 * Detecta: alergias, preferências de quarto, número de pessoas, datas pretendidas.
 * Non-blocking — erros não afetam a resposta ao hóspede.
 */
async function saveGuestPreferences(tenantId: string, guestId: string, aiResponse: string, intent?: string): Promise<void> {
  try {
    if (!db) return;
    const guest = await (db as any).guest.findUnique({
      where: { id: guestId },
      select: { id: true, metadata: true },
    });
    if (!guest) return;

    const meta = JSON.parse(guest.metadata || '{}');
    let updated = false;

    // Detecta menções a alergias/restrições alimentares na resposta da IA
    if (/alerg|restri[cç][ãa]o alimentar|sem gl[uú]ten|vegano?|vegetarian|lactose/i.test(aiResponse)) {
      meta.dietaryRestrictions = true;
      updated = true;
    }

    // Detecta se hóspede mencionou crianças
    if (/crian[cç]a|beb[eê]|filho|filhos|fam[ií]lia/i.test(aiResponse)) {
      meta.hasChildren = true;
      updated = true;
    }

    // Detecta se é hóspede internacional (resposta em espanhol/inglês)
    if (intent === 'duvida_geral' && /[a-z][a-z]/.test(aiResponse)) {
      const lang = /hola|buenos|gracias|por favor/i.test(aiResponse) ? 'es' :
                   /hello|thank you|please/i.test(aiResponse) ? 'en' : 'pt';
      if (meta.preferredLanguage !== lang) {
        meta.preferredLanguage = lang;
        updated = true;
      }
    }

    // Salva última intenção para contexto futuro
    meta.lastIntent = intent;
    meta.lastInteractionAt = new Date().toISOString();
    updated = true;

    if (updated) {
      await (db as any).guest.update({
        where: { id: guestId },
        data: { metadata: JSON.stringify(meta) },
      });
    }
  } catch {
    // Non-blocking
  }
}
