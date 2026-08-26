import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiRatelimit } from '@/lib/rate-limit';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

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
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401, headers: { 'X-Security-Shield': 'zero-trust-v2' } }
      );
    }

    const { id } = await params;

    const target = await db.target.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });

    if (!target) {
      return NextResponse.json(
        { error: 'Target não encontrado' },
        { status: 404, headers: { 'X-Security-Shield': 'zero-trust-v2' } }
      );
    }

    return NextResponse.json({
      ...target,
      createdAt: target.createdAt.toISOString(),
      updatedAt: target.updatedAt.toISOString(),
    }, { headers: { 'X-Security-Shield': 'zero-trust-v2' } });
  } catch (error) {
    console.error('[TARGET_GET]', error);
    return NextResponse.json(
      { error: 'Erro ao buscar target' },
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
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401, headers: { 'X-Security-Shield': 'zero-trust-v2' } }
      );
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await db.target.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Target não encontrado' },
        { status: 404, headers: { 'X-Security-Shield': 'zero-trust-v2' } }
      );
    }

    const { status, priority, name, website, city, state } = body;

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (name !== undefined) updateData.name = name;
    if (website !== undefined) updateData.website = website;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;

    const updated = await db.target.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    }, { headers: { 'X-Security-Shield': 'zero-trust-v2' } });
  } catch (error) {
    console.error('[TARGET_PUT]', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar target' },
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
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401, headers: { 'X-Security-Shield': 'zero-trust-v2' } }
      );
    }

    const { id } = await params;

    const existing = await db.target.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Target não encontrado' },
        { status: 404, headers: { 'X-Security-Shield': 'zero-trust-v2' } }
      );
    }

    await db.target.delete({ where: { id } });

    return NextResponse.json({ success: true, deletedId: id }, { headers: { 'X-Security-Shield': 'zero-trust-v2' } });
  } catch (error) {
    console.error('[TARGET_DELETE]', error);
    return NextResponse.json(
      { error: 'Erro ao deletar target' },
      { status: 500, headers: { 'X-Security-Shield': 'zero-trust-v2' } }
    );
  }
}