import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { apiRatelimit } from '@/lib/rate-limit';
// Notification bridge — Phase 2: pushes escalation into DDC notification system
import { bridgeWhatsAppEscalation } from '@/lib/notifications/bridges';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { success } = await apiRatelimit.limit(tenantId);
    if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const conversation = await db.conversationLog.findFirst({
      where: { id, tenantId },
    });

    if (!conversation) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: '404',
            message: 'Conversation not found',
          },
        },
        { status: 404 }
      );
    }

    // Update conversation status to escalated and create notification
    const [updatedConversation, notification] = await Promise.all([
      db.conversationLog.update({
        where: { id: conversation.id },
        data: {
          status: 'escalated',
          lastUpdate: new Date(),
        },
      }),
      db.notification.create({
        data: {
          tenantId,
          type: 'escalation',
          priority: 'urgent',
          title: '⚠️ Escalonamento Necessário',
          message: `Conversa com ${conversation.guestName} (${conversation.guestPhone}) requer atenção humana.`,
          actionUrl: `/conversations/${id}`,
          actionLabel: 'Ver Conversa',
        },
      }),
    ]);

    // ── Notification bridge: also pushes into the DDC mobile notification system 
    try {
      bridgeWhatsAppEscalation({
        niche: 'all',
        guestName: conversation.guestName ?? conversation.guestPhone ?? 'Hóspede',
        conversationId: id,
        reason: 'Escalonamento manual pelo dono',
        tenantId,
      });
    } catch (notifErr) {
      console.error('[escalate] notification bridge error:', notifErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        conversation: {
          id: updatedConversation.id,
          status: updatedConversation.status,
          lastUpdate: updatedConversation.lastUpdate.toISOString(),
        },
        notification: {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          priority: notification.priority,
          createdAt: notification.createdAt.toISOString(),
        },
      },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('Error escalating conversation:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: '500',
          message: 'Failed to escalate conversation',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}
