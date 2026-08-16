/**
 * GET /api/health
 *
 * Liveness probe — retorna 200 sempre que o app responde.
 * Para Kubernetes/Docker/ECS: usar este endpoint.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
