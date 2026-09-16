import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { apiRatelimit } from '@/lib/rate-limit';

export async function GET(_request: NextRequest) {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { success } = await apiRatelimit.limit(tenantId);
    if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
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

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

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

    const transactions: Array<{
      id: string;
      guestName: string;
      roomName: string;
      amount: number;
      time: string;
      txId: string;
      checkIn: string;
      checkOut: string;
      nights: number;
      chatExcerpt: Array<{ sender: 'guest' | 'ai' | 'human'; content: string; time: string }>;
    }> = [];

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
          chatExcerpt = [...conversation.messages].reverse().map((m) => ({
            sender: m.from === 'guest' ? 'guest' : m.from === 'ai' ? 'ai' : 'human',
            content: m.content,
            time: new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          }));
        }
      }

      const txTime = new Date(booking.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      transactions.push({
        id: booking.id,
        guestName: booking.guestName,
        roomName: booking.roomName,
        amount: booking.totalValue,
        time: txTime,
        txId: booking.id,
        checkIn: new Date(booking.checkIn).toLocaleDateString('pt-BR'),
        checkOut: new Date(booking.checkOut).toLocaleDateString('pt-BR'),
        nights: booking.nights,
        chatExcerpt,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        transactions,
        totalRevenueToday: transactions.reduce((sum, tx) => sum + tx.amount, 0),
        totalBookingsToday: transactions.length,
        degraded: false,
        source: 'database',
      },
    });
  } catch (error) {
    console.error('[DDC revenue-details] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
