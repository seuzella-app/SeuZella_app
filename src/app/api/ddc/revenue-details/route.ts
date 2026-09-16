import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { apiRatelimit } from '@/lib/rate-limit';
import { withApiGuard } from '@/lib/security/api-guard';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      // Onda correção/hardening (auditoria FASE 8): a resposta antiga devolvia
      // transações demo HARDCODED — receita FABRICADA, e antes mesmo da
      // autenticação (vazamento + anti-pattern "verde fabricado" que a onda
      // Meta combateu no meta-connect). Resposta honesta: shape preservado
      // para o frontend, valores ZERO + flag degraded — o UI exibe vazio.
      return NextResponse.json({
        success: true,
        data: {
          transactions: [],
          totalRevenueToday: 0,
          totalBookingsToday: 0,
          degraded: true,
          source: 'database_unavailable',
        },
      });
    }

    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { success } = await apiRatelimit.limit(tenantId);
    if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    // Start of today (local timezone start)
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Fetch real bookings confirmed or paid today via PIX
    // FASE 02B (FRENTE 10/11): pending/cancelled NÃO são receita —
    // filtro de status explícito (mesma regra de ddc/metrics e metrics-snapshot).
    const bookings = await db.booking.findMany({
      where: {
        tenantId,
        createdAt: { gte: startOfToday },
        paymentMethod: 'pix',
        status: { in: ['confirmed', 'checked_in', 'checked_out'] },
      },
      include: {
        guest: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const transactions: any[] = [];

    for (const booking of bookings) {
      let chatExcerpt: Array<{ sender: 'guest' | 'ai' | 'human'; content: string; time: string }> = [];
      if (booking.guestId) {
        const conversation = await db.conversationLog.findFirst({
          where: {
            tenantId,
            guestId: booking.guestId,
          },
          include: {
            messages: {
              orderBy: { timestamp: 'desc' },
              take: 5,
            },
          },
        });

        if (conversation && conversation.messages.length > 0) {
          // reverse to chronological order
          const sortedMsgs = [...conversation.messages].reverse();
          chatExcerpt = sortedMsgs.map(m => ({
            sender: m.from === 'guest' ? 'guest' : m.from === 'ai' ? 'ai' : 'human',
            content: m.content,
            time: new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          }));
        }
      }

      // FASE 02 (auditoria forense): sem conversa real, o UI recebe chatExcerpt
      // VAZIO. Antes, este trecho FABRICAVA uma conversa (guest + AI) que nunca
      // existiu — evidência de comunicação falsa em produção. Honestidade > cosmética.
      // chatExcerpt permanece [] quando não há mensagens reais.

      const txTime = new Date(booking.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      // FASE 02 (auditoria forense): txId antes era Math.random() somado a uma
      // data hardcodada — identificador FABRICADO e não-rastreável.
      // O id real da Booking é estável, honesto e auditável.
      const txId = booking.id;

      transactions.push({
        id: booking.id,
        guestName: booking.guestName,
        roomName: booking.roomName,
        amount: booking.totalValue,
        time: txTime,
        txId,
        checkIn: new Date(booking.checkIn).toLocaleDateString('pt-BR'),
        checkOut: new Date(booking.checkOut).toLocaleDateString('pt-BR'),
        nights: booking.nights,
        chatExcerpt,
      });
    }

    // FASE 02 (auditoria forense): FALLBACK FABRICADO REMOVIDO.
    // Antes, um dia sem bookings devolvia 4 transações INVENTADAS (nomes,
    // valores R$ 850–2400, txIds e conversas falsas) somadas em
    // totalRevenueToday — receita FICTÍCIA exibida como real, sem flag.
    // Resposta honesta: shape preservado, zeros + degraded/source explícitos
    // (mesmo contrato do caminho database_unavailable acima). O UI exibe vazio.

    return NextResponse.json({
      success: true,
      data: {
        transactions,
        totalRevenueToday: transactions.reduce((sum, tx) => sum + tx.amount, 0),
        totalBookingsToday: transactions.length,
        degraded: transactions.length === 0,
        source: transactions.length === 0 ? 'no_bookings_today' : 'database',
      }
    });

  } catch (error) {
    console.error('[DDC revenue-details] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
