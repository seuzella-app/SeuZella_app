import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { resolveTenantId, mapNotification } from '@/lib/ddc/ddc-mapper';
import { apiRatelimit } from '@/lib/rate-limit';

const demoNotifications = [
  { id: 'demo-n-1', type: 'booking', title: 'Nova reserva confirmada', message: 'Carlos Mendes reservou a Suíte Vista Mar para o final de semana', status: 'unread' as const, priority: 'high' as const, userId: 'demo', propertyId: 'demo', createdAt: new Date(Date.now() - 900000).toISOString() },
  { id: 'demo-n-2', type: 'payment', title: 'Pagamento recebido', message: 'Pix de R$ 1.500,00 confirmado para Maria Silva', status: 'unread' as const, priority: 'normal' as const, userId: 'demo', propertyId: 'demo', createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: 'demo-n-3', type: 'escalation', title: 'Atenção necessária', message: 'João Santos solicitou remarcação — conversa escalonada para humano', status: 'unread' as const, priority: 'urgent' as const, userId: 'demo', propertyId: 'demo', createdAt: new Date(Date.now() - 7200000).toISOString() },
  { id: 'demo-n-4', type: 'ai', title: 'IA aprendeu novo padrão', message: 'Novo padrão identificado: hóspedes perguntando sobre Wi-Fi', status: 'read' as const, priority: 'low' as const, userId: 'demo', propertyId: 'demo', readAt: new Date(Date.now() - 5400000).toISOString(), createdAt: new Date(Date.now() - 10800000).toISOString() },
];

export async function GET(request: NextRequest) {
  try {
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      return NextResponse.json({ success: true, data: demoNotifications });
    }

    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { success } = await apiRatelimit.limit(tenantId);
    if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const notifications = await db.notification.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ success: true, data: notifications.map(mapNotification) });
  } catch (error) {
    console.error('[DDC notifications] Prisma error:', error);
    return NextResponse.json({ success: true, data: [] });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { success } = await apiRatelimit.limit(tenantId);
    if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    const body = await request.json();
    const { notificationId, status } = body;
    if (!notificationId || !status) {
      return NextResponse.json({ success: false, error: { code: '400', message: 'Missing required fields: notificationId, status' } }, { status: 400 });
    }
    const existing = await db.notification.findFirst({
      where: { id: notificationId, tenantId },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: { code: '404', message: 'Notification not found' } }, { status: 404 });
    }

    const updated = await db.notification.update({
      where: { id: existing.id },
      data: { read: status === 'read' },
    });
    return NextResponse.json({ success: true, data: mapNotification(updated) });
  } catch (error) {
    console.error('[DDC notifications PUT] Error:', error);
    return NextResponse.json({ success: false, error: { code: '500', message: 'Failed to update notification' } }, { status: 500 });
  }
}
