import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { requireTenantId } from '@/lib/security/tenant-context';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NICHES = new Set(['pousada', 'airbnb']);
const MAX_BODY_BYTES = 16_384;

/**
 * Tenant-safe mobile/desktop presence endpoint.
 * The browser may describe the device, but tenant identity always comes
 * from the authenticated server-side tenant context.
 */
export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    const tenantId = await requireTenantId();
    const body = await request.json();
    const {
      tenantName,
      niche,
      route,
      isMobile,
      deviceId,
      viewport,
      tabName,
    } = body ?? {};

    if (!NICHES.has(niche) || typeof deviceId !== 'string' || !deviceId || typeof route !== 'string' || !route) {
      return NextResponse.json({ error: 'Invalid tracking payload' }, { status: 400 });
    }

    if (deviceId.length > 128 || route.length > 256 || String(tabName ?? '').length > 128) {
      return NextResponse.json({ error: 'Invalid tracking payload' }, { status: 400 });
    }

    if (!(await isDatabaseAvailable())) {
      return NextResponse.json({ success: true, persisted: false });
    }

    const now = new Date();
    const {devicePing} = (db as any);
    if (!devicePing) {
      return NextResponse.json({ success: true, persisted: false });
    }

    // deviceId is only unique inside the authenticated tenant boundary.
    const existing = await devicePing.findFirst({
      where: { deviceId, tenantId },
      select: { id: true, pingCount: true },
    });

    if (existing) {
      await devicePing.update({
        where: { id: existing.id },
        data: {
          lastSeen: now,
          pingCount: (existing.pingCount ?? 0) + 1,
          tenantName: typeof tenantName === 'string' ? tenantName.slice(0, 160) : undefined,
          route: route.slice(0, 256),
          isMobile: Boolean(isMobile),
          viewport: typeof viewport === 'string' ? viewport.slice(0, 32) : undefined,
          tabName: typeof tabName === 'string' ? tabName.slice(0, 128) : undefined,
        },
      });
    } else {
      await devicePing.create({
        data: {
          tenantId,
          tenantName: typeof tenantName === 'string' ? tenantName.slice(0, 160) : null,
          niche,
          route: route.slice(0, 256),
          isMobile: Boolean(isMobile),
          deviceId,
          viewport: typeof viewport === 'string' ? viewport.slice(0, 32) : null,
          userAgent: null,
          tabName: typeof tabName === 'string' ? tabName.slice(0, 128) : null,
          firstSeen: now,
          lastSeen: now,
          pingCount: 1,
        },
      });
    }

    return NextResponse.json({ success: true, persisted: true });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('UNAUTHORIZED:')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to register ping' }, { status: 500 });
  }
}
