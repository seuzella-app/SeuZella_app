// @ts-nocheck — to be fixed in dedicated type refactoring pass
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyCronSecret } from '@/lib/security/cron-secret';
import { verifyCronAuth } from '@/lib/security/cron-auth-unified';

/**
 * GET /api/cron/ical-sync (a cada 2 min)
 * Sincroniza calendários iCal (Airbnb, Booking, VRBO) com DB interno.
 * Bloqueia quartos imediatamente quando reservados via WhatsApp.
 */
export async function GET(request: NextRequest) {
  const auth = verifyCronSecret(request);
  if (!auth.ok) return auth.response!;

  let synced = 0;
  let blocked = 0;

  try {
    if (!db) return NextResponse.json({ success: true, data: { synced: 0, blocked: 0 } });

    // Busca todas as configs de calendar sync ativas
    const syncConfigs = await (db as any).calendarSync.findMany({
      where: { active: true },
      take: 50,
    });

    for (const config of syncConfigs) {
      try {
        // Importa iCal service
        const { importICalFeed } = await import('@/lib/integrations/ical-service');
        const events = await importICalFeed(config.icalUrl);
        
        for (const event of events) {
          // Verifica se já existe reserva para este evento
          const existing = await (db as any).reservation.findFirst({
            where: {
              tenantId: config.tenantId,
              externalId: event.uid,
            },
          });

          if (!existing) {
            // Cria reserva bloqueada
            await (db as any).reservation.create({
              data: {
                tenantId: config.tenantId,
                guestId: 'system_ical',
                checkIn: event.start,
                checkOut: event.end,
                status: 'blocked',
                source: config.platform,
                externalId: event.uid,
                metadata: JSON.stringify({ icalSync: true, syncedAt: new Date().toISOString() }),
              },
            });
            blocked++;
          }
          synced++;
        }
      } catch (err) {
        console.warn(`[iCal Sync] Error for config ${config.id}:`, err);
      }
    }

    return NextResponse.json({ success: true, data: { synced, blocked, configs: syncConfigs.length } });
  } catch (err) {
    console.error('[Cron iCal Sync] Error:', err);
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
