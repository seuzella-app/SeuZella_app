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

    const lead = await db.lead.findFirst({ where: { id, tenantId } });

    if (!lead) {
      return NextResponse.json(
        { error: 'Lead não encontrado' },
        { status: 404, headers: { 'X-Security-Shield': 'zero-trust-v2' } }
      );
    }

    return NextResponse.json({
      ...lead,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
    }, { headers: { 'X-Security-Shield': 'zero-trust-v2' } });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: error.message }, { status: 401, headers: { 'X-Security-Shield': 'zero-trust-v2' } });
    }
    console.error('[LEAD_GET]', error);
    return NextResponse.json(
      { error: 'Erro ao buscar lead' },
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

    const existing = await db.lead.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Lead não encontrado' },
        { status: 404, headers: { 'X-Security-Shield': 'zero-trust-v2' } }
      );
    }

    const { status, validationScore, decisor, cargo, whatsapp, setor, porte, hook, socialMedia } = body;

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (validationScore !== undefined) updateData.validationScore = validationScore;
    if (decisor !== undefined) updateData.decisor = decisor;
    if (cargo !== undefined) updateData.cargo = cargo;
    if (whatsapp !== undefined) updateData.whatsapp = whatsapp;
    if (setor !== undefined) updateData.setor = setor;
    if (porte !== undefined) updateData.porte = porte;
    if (hook !== undefined) updateData.hook = hook;
    if (socialMedia !== undefined) updateData.socialMedia = JSON.stringify(socialMedia);

    const updated = await db.lead.update({
      where: { id: existing.id },
      data: updateData,
    });

    return NextResponse.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    }, { headers: { 'X-Security-Shield': 'zero-trust-v2' } });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: error.message }, { status: 401, headers: { 'X-Security-Shield': 'zero-trust-v2' } });
    }
    console.error('[LEAD_PUT]', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar lead' },
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

    const existing = await db.lead.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Lead não encontrado' },
        { status: 404, headers: { 'X-Security-Shield': 'zero-trust-v2' } }
      );
    }

    await db.lead.delete({ where: { id: existing.id } });

    return NextResponse.json({ success: true, deletedId: id }, { headers: { 'X-Security-Shield': 'zero-trust-v2' } });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: error.message }, { status: 401, headers: { 'X-Security-Shield': 'zero-trust-v2' } });
    }
    console.error('[LEAD_DELETE]', error);
    return NextResponse.json(
      { error: 'Erro ao deletar lead' },
      { status: 500, headers: { 'X-Security-Shield': 'zero-trust-v2' } }
    );
  }
}