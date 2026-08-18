/**
 * GET /api/readiness
 *
 * Readiness probe — verifica se TODAS as dependências estão prontas.
 * Kubernetes/Docker: só recebe tráfego quando este endpoint retorna 200.
 */

import { NextResponse } from 'next/server';
import { checkSystemHealth } from '@/lib/monitoring/health';

export async function GET() {
  const health = await checkSystemHealth();

  if (health.status === 'down') {
    return NextResponse.json(health, { status: 503 });
  }

  return NextResponse.json(health);
}
