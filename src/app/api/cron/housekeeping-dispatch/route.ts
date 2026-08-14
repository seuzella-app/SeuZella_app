import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyCronSecret } from '@/lib/security/cron-secret';
import { detectCheckoutIntent, handleCheckoutEvent } from '@/lib/housekeeping';
import { verifyCronAuth } from '@/lib/security/cron-auth-unified';

/**
 * GET /api/cron/housekeeping-dispatch (a cada 5 min)
 * Verifica mensagens recentes que indicam check-out e dispara limpeza.
 */
export async function GET(request: NextRequest) {
  const auth = verifyCronSecret(request);
  if (!auth.ok) return auth.response!;

  let dispatches = 0;

  try {
    if (!db) return NextResponse.json({ success: true, data: { dispatches: 0 } });

    // Busca mensagens dos últimos 10 min que mencionam check-out
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    const messages = await (db as any).guestMessage.findMany({
      where: {
        from: 'guest',
        timestamp: { gte: tenMinAgo },
      },
      include: {
        guest: { select: { id: true, name: true, phone: true, tenantId: true } },
      },
      take: 50,
    });

    for (const msg of messages) {
      if (detectCheckoutIntent(msg.content)) {
        // Busca propriedade do tenant
        const property = await (db as any).property.findFirst({
          where: { tenantId: msg.guest.tenantId },
          select: { id: true, name: true, metadata: true },
        });

        const meta = JSON.parse(property?.metadata || '{}');
        
        await handleCheckoutEvent({
          tenantId: msg.guest.tenantId,
          roomName: msg.roomId || 'Quarto',
          guestName: msg.guest.name,
          cleaningTeamPhone: meta.cleaningTeamPhone,
        });

        // Marca conversa como check-out detectado
        dispatches++;
      }
    }

    return NextResponse.json({ success: true, data: { dispatches, checked: messages.length } });
  } catch (err) {
    console.error('[Cron Housekeeping] Error:', err);
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
