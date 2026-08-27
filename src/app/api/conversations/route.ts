// =============================================================================
// API — Conversations
// =============================================================================
// GET /api/conversations — Lista conversas do tenant
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }
    const { tenantId } = session.user;

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');
    const mode = searchParams.get('mode');

    const where: Record<string, unknown> = { tenantId };
    if (propertyId) where.propertyId = propertyId;
    if (status) where.status = status;
    if (mode) where.conversationMode = mode;

    const conversations = await db.conversation.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            airbnbId: true,
            city: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    // Get counts by mode
    const [preBookingCount, postBookingCount, activeCount] = await Promise.all([
      db.conversation.count({ where: { tenantId, conversationMode: 'pre_booking' } }),
      db.conversation.count({ where: { tenantId, conversationMode: 'post_booking' } }),
      db.conversation.count({ where: { tenantId, status: 'active' } }),
    ]);

    return NextResponse.json({
      conversations,
      stats: {
        total: conversations.length,
        preBooking: preBookingCount,
        postBooking: postBookingCount,
        active: activeCount,
      },
    });
  } catch (error) {
    console.error('[api/conversations] GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
