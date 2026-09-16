import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { resolveTenantId, mapConversation } from '@/lib/ddc/ddc-mapper';
import { apiRatelimit } from '@/lib/rate-limit';

async function seedDemoConversations(tenantId: string) {
  const now = new Date();

  // 1. Carlos Mendes (Pix Booking)
  const g1 = await db.guest.create({
    data: {
      tenantId,
      name: 'Carlos Mendes',
      phone: '5541988776655',
      status: 'booked',
      source: 'whatsapp',
      value: 700.0,
      aiScore: 96,
      notes: 'Pagamento via PIX realizado',
      conversationCount: 6,
    }
  });

  const c1 = await db.conversationLog.create({
    data: {
      tenantId,
      guestId: g1.id,
      guestName: g1.name,
      guestPhone: g1.phone || '',
      status: 'active',
      aiConfidence: 96,
      lastUpdate: now,
    }
  });

  await db.conversationMessage.createMany({
    data: [
      { conversationId: c1.id, from: 'guest', content: 'Olá, tem quarto de casal disponível para este final de semana? Qual o valor?', timestamp: new Date(now.getTime() - 20 * 60 * 1000) },
      { conversationId: c1.id, from: 'ai', content: 'Olá, Carlos! Sim, temos a Suíte Vista Mar disponível de sexta a domingo. O valor total das 2 diárias fica em R$ 700,00 com café da manhã incluso. Deseja realizar a reserva?', timestamp: new Date(now.getTime() - 18 * 60 * 1000) },
      { conversationId: c1.id, from: 'guest', content: 'Quero sim! Como faço o pagamento?', timestamp: new Date(now.getTime() - 15 * 60 * 1000) },
      { conversationId: c1.id, from: 'ai', content: 'Ótimo! Para confirmar a sua reserva, você pode efetuar o pagamento do valor total ou de um sinal de 50% (R$ 350,00) via Pix. A nossa chave Pix (e-mail) é: pix@pousadaserenity.com.br. Após realizar a transação, por favor envie o comprovante por aqui!', timestamp: new Date(now.getTime() - 12 * 60 * 1000) },
      { conversationId: c1.id, from: 'guest', content: 'Comprovante enviado! Pix de R$ 700,00 feito.', timestamp: new Date(now.getTime() - 10 * 60 * 1000) },
      { conversationId: c1.id, from: 'ai', content: 'Comprovante recebido com sucesso, Carlos! Identificamos o pagamento de R$ 700,00 via Pix. Sua reserva para a Suíte Vista Mar está confirmada de sexta-feira a domingo. O check-in é a partir das 14h. Esperamos você!', timestamp: new Date(now.getTime() - 9 * 60 * 1000) },
    ]
  });

  await db.booking.create({
    data: {
      tenantId,
      guestId: g1.id,
      guestName: g1.name,
      roomName: 'Suíte Vista Mar',
      checkIn: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      checkOut: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      nights: 2,
      guests: 2,
      totalValue: 700.0,
      status: 'confirmed',
      paymentMethod: 'pix',
      paymentStatus: 'paid',
      source: 'whatsapp_ai',
      aiGenerated: true,
    }
  });

  // 2. Mariana Souza (Local Tourism)
  const g2 = await db.guest.create({
    data: {
      tenantId,
      name: 'Mariana Souza',
      phone: '5511977665544',
      status: 'warm',
      source: 'whatsapp',
      value: 0.0,
      aiScore: 85,
      notes: 'Interessada em passeios locais',
      conversationCount: 4,
    }
  });

  const c2 = await db.conversationLog.create({
    data: {
      tenantId,
      guestId: g2.id,
      guestName: g2.name,
      guestPhone: g2.phone || '',
      status: 'active',
      aiConfidence: 94,
      lastUpdate: new Date(now.getTime() - 2 * 60 * 1000),
    }
  });

  await db.conversationMessage.createMany({
    data: [
      { conversationId: c2.id, from: 'guest', content: 'Bom dia! Gostaria de saber o que tem para fazer perto da pousada. Tem praias boas ou pontos turísticos que dê para ir a pé?', timestamp: new Date(now.getTime() - 30 * 60 * 1000) },
      { conversationId: c2.id, from: 'ai', content: 'Bom dia, Mariana! A Pousada Serenity fica a apenas 5 minutos de caminhada da Praia do Centro, excelente para banho e caminhadas. Além disso, estamos bem próximos ao Centro Histórico (cerca de 10 minutos a pé), onde você encontra casarões coloniais, museus e excelentes restaurantes. Para praias mais reservadas, recomendo a Praia dos Castelhanos, que fica a 15 minutos de carro e tem passeios de barco maravilhosos. Deseja que eu te dê mais alguma recomendação gastronômica na região?', timestamp: new Date(now.getTime() - 28 * 60 * 1000) },
      { conversationId: c2.id, from: 'guest', content: 'Nossa, muito bom! Quais os restaurantes mais famosos por aí?', timestamp: new Date(now.getTime() - 25 * 60 * 1000) },
      { conversationId: c2.id, from: 'ai', content: 'No Centro Histórico, recomendo o Restaurante Punto Divino (italiano maravilhoso) e o Banana da Terra, famoso pela culinária caiçara e frutos do mar frescos. Para algo mais descontraído à beira-mar, o Quiosque do Jamil na Praia de Santa Rita serve ótimas porções. 🌴', timestamp: new Date(now.getTime() - 22 * 60 * 1000) },
    ]
  });

  // 3. Ricardo Alves (Amenities & Rules)
  const g3 = await db.guest.create({
    data: {
      tenantId,
      name: 'Ricardo Alves',
      phone: '5521966554433',
      status: 'warm',
      source: 'whatsapp',
      value: 0.0,
      aiScore: 90,
      notes: 'Perguntou sobre pet policy e Wi-Fi',
      conversationCount: 2,
    }
  });

  const c3 = await db.conversationLog.create({
    data: {
      tenantId,
      guestId: g3.id,
      guestName: g3.name,
      guestPhone: g3.phone || '',
      status: 'active',
      aiConfidence: 98,
      lastUpdate: new Date(now.getTime() - 5 * 60 * 1000),
    }
  });

  await db.conversationMessage.createMany({
    data: [
      { conversationId: c3.id, from: 'guest', content: 'Olá, aceitam animais de estimação na pousada? E como funciona o Wi-Fi para quem precisa trabalhar?', timestamp: new Date(now.getTime() - 40 * 60 * 1000) },
      { conversationId: c3.id, from: 'ai', content: 'Olá, Ricardo! Sim, somos pet-friendly! Aceitamos animais de pequeno e médio porte (até 15kg). Cobramos uma taxa única de higienização de R$ 50,00 por pet por toda a estadia. Fornecemos potinhos de água e ração no quarto. Quanto ao Wi-Fi, dispomos de fibra óptica de alta velocidade de 300 Mbps em todas as áreas comuns e nos quartos, perfeita para home office e reuniões de vídeo estáveis. Posso te ajudar a escolher o melhor quarto para você e seu pet? 🐾', timestamp: new Date(now.getTime() - 38 * 60 * 1000) },
    ]
  });

  // 4. Letícia Lima (Escalation)
  const g4 = await db.guest.create({
    data: {
      tenantId,
      name: 'Letícia Lima',
      phone: '5531955443322',
      status: 'hot',
      source: 'whatsapp',
      value: 500.0,
      aiScore: 92,
      notes: 'Solicitou reagendamento complexo',
      conversationCount: 2,
    }
  });

  const c4 = await db.conversationLog.create({
    data: {
      tenantId,
      guestId: g4.id,
      guestName: g4.name,
      guestPhone: g4.phone || '',
      status: 'escalated',
      aiConfidence: 65,
      lastUpdate: new Date(now.getTime() - 15 * 60 * 1000),
    }
  });

  await db.conversationMessage.createMany({
    data: [
      { conversationId: c4.id, from: 'guest', content: 'Olá! Fiz uma reserva para o próximo mês mas tive um imprevisto de trabalho e vou precisar adiar a data da minha viagem em uma semana. Tem alguma taxa para trocar a data?', timestamp: new Date(now.getTime() - 50 * 60 * 1000) },
      { conversationId: c4.id, from: 'ai', content: 'Olá, Letícia! Entendo perfeitamente o imprevisto. A alteração de datas depende da disponibilidade dos quartos para o novo período. Vou chamar um dos nossos atendentes humanos da pousada para analisar o seu caso pessoalmente e fazer essa alteração da melhor forma para você. Só um minuto! ⚠️', timestamp: new Date(now.getTime() - 48 * 60 * 1000) },
    ]
  });

  await db.booking.create({
    data: {
      tenantId,
      guestId: g4.id,
      guestName: g4.name,
      roomName: 'Suíte Standard',
      checkIn: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
      checkOut: new Date(now.getTime() + 12 * 24 * 60 * 60 * 1000),
      nights: 2,
      guests: 1,
      totalValue: 500.0,
      status: 'pending',
      paymentMethod: 'none',
      paymentStatus: 'pending',
      source: 'whatsapp_ai',
      aiGenerated: true,
    }
  });
}

export async function GET(request: NextRequest) {
  try {
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      // FASE 02B (FRENTE 10/55): DB indisponível = lista vazia honesta + flag
      // (antes retornava demoConversations — chats falsos com aparência real).
      return NextResponse.json({
        success: true,
        data: { items: [], total: 0, page: 1, limit: 0, totalPages: 0 },
        meta: { timestamp: new Date().toISOString(), source: 'database_unavailable', degraded: true },
      });
    }

    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { success } = await apiRatelimit.limit(tenantId);
    if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    // Dynamic auto-seeder: if there are no conversation logs for this tenant, seed them.
    // FASE 02B (P0): o seeder grava guests/bookings FICTÍCIOS (ex.: booking PIX
    // "confirmado/pago" de R$ 700) que poluem TODAS as calculadoras de receita.
    // Permitido APENAS fora de produção (conveniência de dev).
    const count = await db.conversationLog.count({ where: { tenantId } });
    if (count === 0 && process.env.NODE_ENV !== 'production') {
      await seedDemoConversations(tenantId);
    }

    const {searchParams} = request.nextUrl;
    const status = searchParams.get('status');
    const escalated = searchParams.get('escalated');
    const search = searchParams.get('search');

    const where: any = { tenantId };
    if (status) {
      if (status === 'in_progress') where.status = 'active';
      else if (status === 'closed') where.status = { in: ['resolved', 'abandoned'] };
      else where.status = status;
    }
    if (escalated === 'true') where.status = 'escalated';
    if (search) {
      where.OR = [
        { guestName: { contains: search } },
        { guestPhone: { contains: search } },
      ];
    }

    const conversations = await db.conversationLog.findMany({
      where,
      include: { messages: { orderBy: { timestamp: 'asc' } } },
      orderBy: { lastUpdate: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: { items: conversations.map(mapConversation), total: conversations.length, page: 1, limit: conversations.length, totalPages: 1 }
    });
  } catch (error) {
    console.error('[DDC conversations] Prisma error:', error);
    return NextResponse.json({ success: true, data: { items: [], total: 0, page: 1, limit: 0, totalPages: 0 }, meta: { source: 'fallback-zeros', degraded: true } });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { success } = await apiRatelimit.limit(tenantId);
    if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    const body = await request.json();
    if (!body.conversationId) return NextResponse.json({ success: false, error: { code: '400', message: 'Missing conversationId' } }, { status: 400 });
    await db.conversationLog.delete({ where: { id: body.conversationId } });
    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    return NextResponse.json({ success: false, error: { code: '500', message: 'Failed to delete conversation' } }, { status: 500 });
  }
}
