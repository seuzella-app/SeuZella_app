import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenantId } from '@/lib/ddc/ddc-mapper';
import { apiRatelimit } from '@/lib/rate-limit';

export async function PUT(request: NextRequest) {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { success, reset } = await apiRatelimit.limit(tenantId);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: Math.max(1, Math.ceil((reset - Date.now()) / 1000)) },
        { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))) } },
      );
    }

    await db.notification.updateMany({
      where: { tenantId, read: false },
      data: { read: true },
    });

    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    console.error('[DDC_NOTIFICATIONS_READ_ALL]', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Não foi possível atualizar as notificações' } }, { status: 500 });
  }
}
