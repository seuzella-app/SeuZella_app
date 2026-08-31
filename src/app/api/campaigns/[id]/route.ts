import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTenantId } from '@/lib/security/tenant-context';
import { apiRatelimit } from '@/lib/rate-limit';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = await apiRatelimit.limit(`api:${clientIp}:${new URL(request.url).pathname}`);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', message: 'Muitas requisições.', retryAfter: Math.ceil((rl.reset - Date.now()) / 1000) },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)), 'X-RateLimit-Remaining': '0' } }
    );
  }

  try {
    const tenantId = await requireTenantId();
    const { id } = await params;

    const campaign = await db.campaign.findFirst({ where: { id, tenantId } });

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campanha não encontrada' },
        { status: 404, headers: { 'X-Security-Shield': 'zero-trust-v2' } }
      );
    }

    return NextResponse.json({
      ...campaign,
      scheduledAt: campaign.scheduledAt?.toISOString() ?? null,
      startedAt: campaign.startedAt?.toISOString() ?? null,
      completedAt: campaign.completedAt?.toISOString() ?? null,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
    }, { headers: { 'X-Security-Shield': 'zero-trust-v2' } });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: error.message }, { status: 401, headers: { 'X-Security-Shield': 'zero-trust-v2' } });
    }
    console.error('[CAMPAIGN_GET]', error);
    return NextResponse.json(
      { error: 'Erro ao buscar campanha' },
      { status: 500, headers: { 'X-Security-Shield': 'zero-trust-v2' } }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = await apiRatelimit.limit(`api:${clientIp}:${new URL(request.url).pathname}`);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', message: 'Muitas requisições.', retryAfter: Math.ceil((rl.reset - Date.now()) / 1000) },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)), 'X-RateLimit-Remaining': '0' } }
    );
  }

  try {
    const tenantId = await requireTenantId();
    const { id } = await params;
    const body = await request.json();

    const existing = await db.campaign.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Campanha não encontrada' },
        { status: 404, headers: { 'X-Security-Shield': 'zero-trust-v2' } }
      );
    }

    const { status, name, type, targetAudience, messageTemplate } = body;
    const now = new Date();

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (targetAudience !== undefined) updateData.targetAudience = targetAudience;
    if (messageTemplate !== undefined) updateData.messageTemplate = messageTemplate;

    if (status !== undefined) {
      updateData.status = status;

      if (status === 'active' && !existing.startedAt) {
        updateData.startedAt = now;
      }

      if (status === 'completed') {
        updateData.completedAt = now;
      }
    }

    const updated = await db.campaign.update({
      where: { id: existing.id },
      data: updateData,
    });

    return NextResponse.json({
      ...updated,
      scheduledAt: updated.scheduledAt?.toISOString() ?? null,
      startedAt: updated.startedAt?.toISOString() ?? null,
      completedAt: updated.completedAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    }, { headers: { 'X-Security-Shield': 'zero-trust-v2' } });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: error.message }, { status: 401, headers: { 'X-Security-Shield': 'zero-trust-v2' } });
    }
    console.error('[CAMPAIGN_PUT]', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar campanha' },
      { status: 500, headers: { 'X-Security-Shield': 'zero-trust-v2' } }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = await apiRatelimit.limit(`api:${clientIp}:${new URL(request.url).pathname}`);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', message: 'Muitas requisições.', retryAfter: Math.ceil((rl.reset - Date.now()) / 1000) },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)), 'X-RateLimit-Remaining': '0' } }
    );
  }

  try {
    const tenantId = await requireTenantId();
    const { id } = await params;

    const existing = await db.campaign.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Campanha não encontrada' },
        { status: 404, headers: { 'X-Security-Shield': 'zero-trust-v2' } }
      );
    }

    await db.campaign.delete({ where: { id: existing.id } });

    return NextResponse.json({ success: true, deletedId: id }, { headers: { 'X-Security-Shield': 'zero-trust-v2' } });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: error.message }, { status: 401, headers: { 'X-Security-Shield': 'zero-trust-v2' } });
    }
    console.error('[CAMPAIGN_DELETE]', error);
    return NextResponse.json(
      { error: 'Erro ao deletar campanha' },
      { status: 500, headers: { 'X-Security-Shield': 'zero-trust-v2' } }
    );
  }
}