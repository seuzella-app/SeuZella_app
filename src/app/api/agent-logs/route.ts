import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiRatelimit } from '@/lib/rate-limit';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }
  const { tenantId } = session.user;

  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = await apiRatelimit.limit(`api:${clientIp}:${new URL(request.url).pathname}`);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', message: 'Muitas requisições.', retryAfter: Math.ceil((rl.reset - Date.now()) / 1000) },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)), 'X-RateLimit-Remaining': '0' } }
    );
  }

  try {
    const { searchParams } = new URL(request.url);

    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const agentId = searchParams.get('agentId') || undefined;

    const where: Record<string, unknown> = { tenantId };
    if (agentId) {
      where.agentId = agentId;
    }

    const logs = await db.agentLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json(
      logs.map((log: { id: string; createdAt: Date; [key: string]: unknown }) => ({
        ...log,
        createdAt: log.createdAt.toISOString(),
      })),
      { headers: { 'X-Security-Shield': 'zero-trust-v2' } }
    );
  } catch (error) {
    console.error('[AGENT_LOGS_GET]', error);
    return NextResponse.json(
      { error: 'Erro ao buscar logs de agente' },
      { status: 500, headers: { 'X-Security-Shield': 'zero-trust-v2' } }
    );
  }
}