import { NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { processAirBMessage } from '@/lib/airb';

const demoConversations = [
  {
    id: 'demo-airb-conv-1',
    tenantId: 'demo',
    propertyId: 'demo-airb-1',
    guestName: 'Maria Silva',
    guestPhone: '5511977665544',
    status: 'active',
    platformContext: 'airbnb_app',
    mode: 'post_booking',
    lastMessage: 'Olá, qual o horário de check-in?',
    lastMessageAt: new Date(Date.now() - 1800000).toISOString(),
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 1800000).toISOString(),
    property: { name: 'Apartamento Vista Mar - Jurerê Internacional' },
    messages: [
      { id: 'msg-1-1', direction: 'inbound', content: 'Olá! Tenho uma reserva para próxima semana.', intent: 'general_greet', isAiGenerated: false, createdAt: new Date(Date.now() - 7200000).toISOString() },
      { id: 'msg-1-2', direction: 'outbound', content: 'Olá Maria! Bem-vinda! Posso ajudar com algo sobre sua estadia em Jurerê?', intent: 'general_greet', isAiGenerated: true, createdAt: new Date(Date.now() - 7100000).toISOString() },
      { id: 'msg-1-3', direction: 'inbound', content: 'Olá, qual o horário de check-in?', intent: 'checkin', isAiGenerated: false, createdAt: new Date(Date.now() - 1800000).toISOString() },
    ],
  },
  {
    id: 'demo-airb-conv-2',
    tenantId: 'demo',
    propertyId: 'demo-airb-1',
    guestName: 'João Santos',
    guestPhone: '5521966554433',
    status: 'active',
    platformContext: 'whatsapp',
    mode: 'post_booking',
    lastMessage: 'O Wi-Fi é rápido? Preciso trabalhar durante a estadia.',
    lastMessageAt: new Date(Date.now() - 7200000).toISOString(),
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date(Date.now() - 7200000).toISOString(),
    property: { name: 'Apartamento Vista Mar - Jurerê Internacional' },
    messages: [
      { id: 'msg-2-1', direction: 'inbound', content: 'Oi, tudo bem? Vou me hospedar mês que vem.', intent: 'general_greet', isAiGenerated: false, createdAt: new Date(Date.now() - 86400000).toISOString() },
      { id: 'msg-2-2', direction: 'outbound', content: 'Olá João! Tudo ótimo! Como posso te ajudar?', intent: 'general_greet', isAiGenerated: true, createdAt: new Date(Date.now() - 86300000).toISOString() },
      { id: 'msg-2-3', direction: 'inbound', content: 'O Wi-Fi é rápido? Preciso trabalhar durante a estadia.', intent: 'amenities', isAiGenerated: false, createdAt: new Date(Date.now() - 7200000).toISOString() },
    ],
  },
  {
    id: 'demo-airb-conv-3',
    tenantId: 'demo',
    propertyId: 'demo-airb-2',
    guestName: 'Ana Costa',
    guestPhone: '5531955443322',
    status: 'resolved',
    platformContext: 'airbnb_web',
    mode: 'pre_booking',
    lastMessage: 'Perfeito, confirmado para sexta!',
    lastMessageAt: new Date(Date.now() - 14400000).toISOString(),
    createdAt: new Date(Date.now() - 259200000).toISOString(),
    updatedAt: new Date(Date.now() - 14400000).toISOString(),
    property: { name: 'Studio Moderno - Copacabana' },
    messages: [
      { id: 'msg-3-1', direction: 'inbound', content: 'Vocês aceitam pets? Tenho um gato.', intent: 'house_rules', isAiGenerated: false, createdAt: new Date(Date.now() - 28800000).toISOString() },
      { id: 'msg-3-2', direction: 'outbound', content: 'Infelizmente não aceitamos animais no studio, Ana. Mas podemos recomendar opções pet-friendly próximas!', intent: 'house_rules', isAiGenerated: true, createdAt: new Date(Date.now() - 28700000).toISOString() },
      { id: 'msg-3-3', direction: 'inbound', content: 'Entendi, sem problemas. Qual o valor para 3 noites?', intent: 'pricing', isAiGenerated: false, createdAt: new Date(Date.now() - 14400000).toISOString() },
      { id: 'msg-3-4', direction: 'outbound', content: 'Para 3 noites em nosso studio em Copacabana, o valor é R$ 660. Deseja confirmar a reserva?', intent: 'pricing', isAiGenerated: true, createdAt: new Date(Date.now() - 14300000).toISOString() },
      { id: 'msg-3-5', direction: 'inbound', content: 'Perfeito, confirmado para sexta!', intent: 'booking_intent', isAiGenerated: false, createdAt: new Date(Date.now() - 14200000).toISOString() },
    ],
  },
  {
    id: 'demo-airb-conv-4',
    tenantId: 'demo',
    propertyId: 'demo-airb-3',
    guestName: 'Carlos Mendes',
    guestPhone: '5541988776655',
    status: 'active',
    platformContext: 'direct',
    mode: 'post_booking',
    lastMessage: 'A piscina é aquecida? Minha filha adora nadar!',
    lastMessageAt: new Date(Date.now() - 28800000).toISOString(),
    createdAt: new Date(Date.now() - 345600000).toISOString(),
    updatedAt: new Date(Date.now() - 28800000).toISOString(),
    property: { name: 'Casa com Piscina - Campos do Jordão' },
    messages: [
      { id: 'msg-4-1', direction: 'inbound', content: 'Boa tarde! Reservei a casa para o feriado.', intent: 'general_greet', isAiGenerated: false, createdAt: new Date(Date.now() - 57600000).toISOString() },
      { id: 'msg-4-2', direction: 'outbound', content: 'Boa tarde, Carlos! Ótima escolha! A casa em Campos do Jordão é perfeita para o feriado. Como posso ajudar?', intent: 'general_greet', isAiGenerated: true, createdAt: new Date(Date.now() - 57500000).toISOString() },
      { id: 'msg-4-3', direction: 'inbound', content: 'A piscina é aquecida? Minha filha adora nadar!', intent: 'amenities', isAiGenerated: false, createdAt: new Date(Date.now() - 28800000).toISOString() },
    ],
  },
];

// GET /api/ddc/airb/conversations — List all Airbnb conversations for tenant
export async function GET() {
  try {
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      return NextResponse.json({ success: true, data: demoConversations });
    }

    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const conversations = await db.airBConversation.findMany({
      where: { tenantId },
      include: {
        property: { select: { name: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: conversations });
  } catch (error) {
    console.error('[AIRB] Error listing conversations:', error);
    return NextResponse.json({ success: false, error: 'Failed to list conversations' }, { status: 500 });
  }
}

// POST /api/ddc/airb/conversations — Simulate sending/receiving a message in an Airbnb conversation
export async function POST(request: Request) {
  try {
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      return NextResponse.json({ success: false, error: 'Banco de dados indisponível' }, { status: 503 });
    }

    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { conversationId, messageContent } = body;

    if (!conversationId || !messageContent) {
      return NextResponse.json({ success: false, error: 'conversationId and messageContent are required' }, { status: 400 });
    }

    // Verify conversation belongs to tenant
    const conversation = await db.airBConversation.findFirst({
      where: { id: conversationId, tenantId },
    });

    if (!conversation) {
      return NextResponse.json({ success: false, error: 'Conversation not found or access denied' }, { status: 404 });
    }

    const result = await processAirBMessage({
      tenantId,
      conversationId,
      messageContent,
    });

    return NextResponse.json({
      success: true,
      data: result,
    }, { status: 201 });
  } catch (error) {
    console.error('[AIRB] Error simulating message processing:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}
