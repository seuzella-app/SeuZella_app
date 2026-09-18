import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiRatelimit } from '@/lib/rate-limit';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = await apiRatelimit.limit(`api:${clientIp}:${new URL(request.url).pathname}`);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', message: 'Muitas requisições.', retryAfter: Math.ceil((rl.reset - Date.now()) / 1000) },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)), 'X-RateLimit-Remaining': '0' } }
    );
  }

  try {
    // RUN 6B (R6B-02): SwipeTemplate é recurso TENANT-SCOPED (model tem
    // tenantId FK + cascade). Antes: findMany({ isActive: true }) SEM escopo
    // devolvia templates de TODOS os tenants (conteúdo comercial sensível)
    // para qualquer request com cookie presente. Escopo = sessão.
    const session = await getServerSession(authOptions);
    const tenantId = (session?.user as { tenantId?: unknown })?.tenantId;
    if (!session?.user || typeof tenantId !== 'string' || !tenantId) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    const templates = await db.swipeTemplate.findMany({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      templates.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      { headers: { 'X-Security-Shield': 'zero-trust-v2' } }
    );
  } catch (error) {
    console.error('[SWIPE_TEMPLATES_GET]', error);
    return NextResponse.json(
      { error: 'Erro ao buscar templates' },
      { status: 500, headers: { 'X-Security-Shield': 'zero-trust-v2' } }
    );
  }
}