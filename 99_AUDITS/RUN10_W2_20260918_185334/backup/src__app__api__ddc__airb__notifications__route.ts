import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import {
  evaluateClosingIntent,
  formatNotification,
  validateReservationDetails,
} from '@/lib/airb/closing-notification-prompt';
import type { NotificationType, NotificationFormatData } from '@/lib/airb/closing-notification-prompt';

// ═══════════════════════════════════════════════════════════════
// POST /api/ddc/airb/notifications — Send closing notification to owner
// Body: { type, propertyId, reservationDetails, conversationSummary }
// ═══════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      type,
      propertyId,
      reservationDetails,
      conversationSummary,
      guestMessage,
    } = body;

    // ── If just evaluating intent (no notification yet) ──
    if (guestMessage && !type) {
      const evaluation = evaluateClosingIntent(guestMessage);
      return NextResponse.json({ success: true, data: evaluation });
    }

    if (!type || !propertyId) {
      return NextResponse.json(
        { success: false, error: 'type e propertyId são obrigatórios' },
        { status: 400 }
      );
    }

    const validTypes: NotificationType[] = [
      'RESERVATION_CLOSED',
      'RESERVATION_PENDING_PAYMENT',
      'RESERVATION_NEGOTIATED',
      'ESCALATION_REQUESTED',
    ];

    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: `Tipo inválido: ${type}. Válidos: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate reservation details
    const validation = validateReservationDetails(reservationDetails || {});
    if (!validation.complete) {
      return NextResponse.json({
        success: false,
        error: `Dados da reserva incompletos: ${validation.missing.join(', ')}`,
        data: { missingFields: validation.missing },
      }, { status: 400 });
    }

    const dbAvailable = await isDatabaseAvailable();

    // Fetch property context
    let propertyName = 'Propriedade';
    let checkinTime = '15:00';
    let checkoutTime = '11:00';
    if (dbAvailable) {
      const property = await db.airBProperty.findFirst({
        where: { id: propertyId, tenantId },
      });

      if (!property) {
        return NextResponse.json(
          { success: false, error: 'Propriedade não encontrada' },
          { status: 404 }
        );
      }

      propertyName = property.name || propertyName;
      checkinTime = property.checkinTime || checkinTime;
      checkoutTime = property.checkoutTime || checkoutTime;
    }

    // Build the notification format data matching the interface
    const formatData: NotificationFormatData = {
      propertyName: reservationDetails?.propertyName || propertyName,
      guestName: reservationDetails?.guestName || null,
      checkInDate: reservationDetails?.checkInDate || null,
      checkOutDate: reservationDetails?.checkOutDate || null,
      checkinTime,
      checkoutTime,
      guestCount: reservationDetails?.guestCount || null,
      agreedPrice: reservationDetails?.agreedPrice || String(reservationDetails?.totalValue || '0'),
      originalPrice: reservationDetails?.originalTotal ? String(reservationDetails.originalTotal) : undefined,
      discountPercent: reservationDetails?.discountPercent ? String(reservationDetails.discountPercent) : undefined,
      paymentMethod: reservationDetails?.paymentMethod || 'pix',
      pixKey: reservationDetails?.pixKey || undefined,
      guestPhone: reservationDetails?.guestPhone || undefined,
      specialRequests: reservationDetails?.specialRequests || [],
      escalationReason: reservationDetails?.escalationReason || undefined,
      conversationSummary: conversationSummary || undefined,
    };

    // Format the WhatsApp notification message
    const formattedMessage = formatNotification(type as NotificationType, formatData);

    // Create notification in DB
    let notificationId: string | null = null;
    if (dbAvailable) {
      try {
        const notification = await db.notification.create({
          data: {
            tenantId,
            type: 'RESERVATION',
            title: `Reserva ${type === 'ESCALATION_REQUESTED' ? '— Escalação' : 'Fechada'}`,
            message: formattedMessage,
            priority: type === 'ESCALATION_REQUESTED' ? 'urgent' : 'high',
          },
        });
        notificationId = notification.id;
      } catch (dbError) {
        console.error('[NOTIFICATION] Error saving notification:', dbError);
      }
    }

    // Log the closing event
    if (dbAvailable) {
      try {
        await db.agentLog.create({
          data: {
            tenantId,
            agentName: 'ZellaAirB',
            action: 'CLOSING_NOTIFICATION',
            intent: type,
            confidence: reservationDetails?.finalConfidence || 0.9,
            metadata: JSON.stringify({
              propertyId,
              notificationType: type,
              reservationDetails,
              conversationSummary,
            }),
          },
        });
      } catch (logError) {
        console.error('[NOTIFICATION] Error logging:', logError);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        notificationId,
        type,
        propertyId,
        formattedMessage,
        deliveredVia: 'whatsapp',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[NOTIFICATION] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao processar notificação de fechamento' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// GET /api/ddc/airb/notifications — List recent notifications
// Query params: ?propertyId=xxx&limit=20
// ═══════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const dbAvailable = await isDatabaseAvailable();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    if (!dbAvailable) {
      return NextResponse.json({ success: true, data: [] });
    }

    const notifications = await db.notification.findMany({
      where: {
        tenantId,
        type: 'RESERVATION',
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });

    return NextResponse.json({ success: true, data: notifications });
  } catch (error) {
    console.error('[NOTIFICATION] Error listing:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao listar notificações' },
      { status: 500 }
    );
  }
}
