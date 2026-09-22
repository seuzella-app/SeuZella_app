import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/api-shield';
import { requireTenantAccess } from '@/lib/security/tenant-authorization';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { bridgeIcalSync } from '@/lib/notifications/bridges';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

// GET /api/ddc/booking-sync — Get Booking.com sync status
async function getHandler(request: NextRequest) {
  // RUN14-A (W2): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(request, 'ddc.booking-sync', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN14-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:ddc.booking-sync', what: 'ddc.booking-sync.entry', resource: 'api', result: 'ALLOW' });
  try {
    const auth = await requireTenantAccess(request);
    if (!auth.allowed) {
      return auth.response!;
    }

    const tenantId = auth.context.tenantId!;

    const configs = await db.bookingSyncConfig.findMany({
      where: { tenantId },
    });

    const channels = [
      { id: 'booking', name: 'Booking.com', connected: configs.some(c => c.status === 'connected'), config: configs.find(c => !c.airbPropertyId) },
      { id: 'airbnb', name: 'Airbnb', connected: true, note: 'Synced via Airbnb API' },
    ];

    return NextResponse.json({
      success: true,
      channels,
      totalConnected: channels.filter(c => c.connected).length,
      configs,
    });
  } catch (error) {
    console.error('[BookingSync] GET error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/ddc/booking-sync — Configure Booking.com sync
async function postHandler(request: NextRequest) {
  try {
    const auth = await requireTenantAccess(request);
    if (!auth.allowed) {
      return auth.response!;
    }

    const authenticatedTenantId = auth.context.tenantId!;
    const body = await request.json();
    const { tenantId: requestedTenantId, propertyId, airbPropertyId, icalImportUrl, hotelId, action } = body;

    // IDOR Protection: Se o cliente forneceu tenantId e for diferente do autenticado, rejeita com 403
    if (requestedTenantId && requestedTenantId !== authenticatedTenantId) {
      return NextResponse.json(
        { success: false, error: 'Acesso negado: tenantId incompatível com a sessão.', code: 'FORBIDDEN_CROSS_TENANT' },
        { status: 403 }
      );
    }

    const tenantId = authenticatedTenantId;

    if (action === 'sync') {
      // Trigger iCal import sync
      const config = await db.bookingSyncConfig.findFirst({
        where: { tenantId, status: 'connected' },
      });

      if (!config || !config.icalImportUrl) {
        return NextResponse.json({ success: false, error: 'No Booking.com iCal URL configured' }, { status: 400 });
      }

      // Import iCal data com proteção SSRF
      const { importICal } = await import('@/lib/ical-import-engine');
      const result = await importICal(tenantId, config.icalImportUrl);

      await db.bookingSyncConfig.update({
        where: { id: config.id },
        data: {
          lastSync: new Date(),
          syncCount: { increment: 1 },
          bookingsImported: { increment: result.imported },
          errorMessage: result.errors > 0 ? `${result.errors} errors during import` : '',
        },
      });

      // ── Notification bridge: notify owner about iCal sync result ──
      try {
        if (result.errors > 0) {
          bridgeIcalSync({
            niche: 'pousada',
            status: 'sync_failed',
            calendarName: 'Booking.com',
            reason: `${result.errors} erro(s) durante importação`,
            tenantId,
          });
        } else if (result.imported > 0) {
          bridgeIcalSync({
            niche: 'pousada',
            status: 'sync_success',
            calendarName: 'Booking.com',
            count: result.imported,
            tenantId,
          });
        }
      } catch (notifErr) {
        console.error('[BookingSync] notification bridge error:', notifErr);
      }

      return NextResponse.json({ success: true, imported: result.imported, errors: result.errors, skipped: result.skipped });
    }

    // Configure new sync
    const syncToken = crypto.randomBytes(24).toString('hex');
    const icalExportUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://seuzella.com'}/api/ical/${syncToken}`;

    const existing = await db.bookingSyncConfig.findFirst({
      where: { tenantId, propertyId: propertyId || null, airbPropertyId: airbPropertyId || null },
    });

    if (existing) {
      // Update existing config
      const updated = await db.bookingSyncConfig.update({
        where: { id: existing.id },
        data: {
          icalImportUrl: icalImportUrl || existing.icalImportUrl,
          hotelId: hotelId || existing.hotelId,
          status: 'connected',
          errorMessage: '',
        },
      });

      return NextResponse.json({ success: true, config: updated, icalExportUrl: updated.icalExportUrl || icalExportUrl });
    }

    // Create new config
    const config = await db.bookingSyncConfig.create({
      data: {
        tenantId,
        propertyId: propertyId || null,
        airbPropertyId: airbPropertyId || null,
        hotelId: hotelId || null,
        icalImportUrl: icalImportUrl || null,
        icalExportUrl,
        syncToken,
        status: icalImportUrl ? 'connected' : 'pending',
      },
    });

    return NextResponse.json({ success: true, config, icalExportUrl });
  } catch (error) {
    console.error('[BookingSync] POST error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/ddc/booking-sync — Disconnect Booking.com
async function deleteHandler(request: NextRequest) {
  try {
    const auth = await requireTenantAccess(request);
    if (!auth.allowed) {
      return auth.response!;
    }

    const { searchParams } = new URL(request.url);
    const configId = searchParams.get('configId');

    if (!configId) {
      return NextResponse.json({ success: false, error: 'configId required' }, { status: 400 });
    }

    const config = await db.bookingSyncConfig.findFirst({
      where: { id: configId, tenantId: auth.context.tenantId! },
    });

    if (!config) {
      return NextResponse.json({ success: false, error: 'Config not found or access denied' }, { status: 404 });
    }

    await db.bookingSyncConfig.delete({ where: { id: configId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[BookingSync] DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withSecurity(getHandler, { routeLabel: 'booking-sync' });
export const POST = withSecurity(postHandler, { routeLabel: 'booking-sync' });
export const DELETE = withSecurity(deleteHandler, { routeLabel: 'booking-sync' });
