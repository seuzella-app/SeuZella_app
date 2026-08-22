import { NextRequest, NextResponse } from 'next/server';
import { publishTenantEvent } from '@/lib/realtime/tenant-pubsub';
import { db } from '@/lib/db';
import { resolveTenantId, mapGuest } from '@/lib/ddc/ddc-mapper';
import { createError, apiSuccess } from '@/lib/error-handler';
import { apiRatelimit } from '@/lib/rate-limit';
import { withApiGuard } from '@/lib/security/api-guard';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface RouteContext { params: Promise<{ id: string }> }

async function guard(): Promise<string | NextResponse> {
  const tenantId = await resolveTenantId();
  if (!tenantId) return createError(401, 'UNAUTHORIZED', 'Não autorizado');
  const { success } = await apiRatelimit.limit(tenantId);
  if (!success) return createError(429, 'RATE_LIMITED', 'Muitas requisições');
  return tenantId;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const g = await guard();
    if (g instanceof NextResponse) return g;
    const { id } = await context.params;
    const guest = await db.guest.findUnique({ where: { id } });
    if (!guest) return createError(404, 'NOT_FOUND', 'Guest not found');
    return apiSuccess(mapGuest(guest));
  } catch (error) {
    return createError(500, 'FETCH_FAILED', 'Failed to fetch guest');
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const g = await guard();
    if (g instanceof NextResponse) return g;
    const { id } = await context.params;
    const body = await request.json();
    const existing = await db.guest.findUnique({ where: { id } });
    if (!existing) return createError(404, 'NOT_FOUND', 'Guest not found');

    const updateData: any = {};
    if (body.name) updateData.name = body.name;
    if (body.phoneNumber) updateData.phone = body.phoneNumber;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.status) updateData.status = body.status === 'cold' ? 'new' : body.status === 'closed' ? 'booked' : body.status;
    if (body.score !== undefined) updateData.aiScore = body.score;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.value !== undefined) updateData.value = body.value;

    const updated = await db.guest.update({ where: { id }, data: updateData });

    // Publish realtime event AFTER DB write succeeds.
    publishTenantEvent(g, 'guest:updated', {
      guestId: id,
      action: 'updated',
      updatedFields: Object.keys(updateData),
    });

    return apiSuccess(mapGuest(updated));
  } catch (error) {
    return createError(500, 'UPDATE_FAILED', 'Failed to update guest');
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const g = await guard();
    if (g instanceof NextResponse) return g;
    const { id } = await context.params;
    await db.guest.delete({ where: { id } });

    // Publish realtime event AFTER DB delete succeeds.
    publishTenantEvent(g, 'guest:updated', {
      guestId: id,
      action: 'deleted',
    });

    return apiSuccess(null);
  } catch (error) {
    return createError(500, 'DELETE_FAILED', 'Failed to delete guest');
  }
}
