// ============================================================================
// ZÉLLA — Cron: Learning Cycle (Daily 04:00 BRT = 07:00 UTC)
// ============================================================================
// Executa o ciclo de aprendizado diário:
//   1. Marca DPO pairs antigos como 'trained'
//   2. Recalcula effectiveness de KnowledgeEntries com uso > 5
//   3. Detecta anti-patterns (3+ failures consecutivos)
//   4. Gera telemetry de aprendizado por tenant
// Schedule Vercel: 0 7 * * *
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { runLearningCycle } from '@/lib/cerebro/learning-engine';
import { verifyCronAuth } from '@/lib/security/cron-auth-unified';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<NextResponse> {
  return runCycle(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return runCycle(request);
}

async function runCycle(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
    // Auth unificada: M2M EdDSA JWT primeiro, fallback CRON_SECRET
  const auth = await verifyCronAuth(request, 'cerebro:write');
  if (!auth.ok) return auth.response!;

  try {
    // Optional tenantId query param to process only one tenant
    const tenantId = new URL(request.url).searchParams.get('tenantId') ?? undefined;

    const result = await runLearningCycle(tenantId);
    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      tenantsProcessed: result.tenantsProcessed,
      dpoPairsTrained: result.dpoPairsTrained,
      effectivenessRecalculated: result.effectivenessRecalculated,
      antiPatternsDetected: result.antiPatternsDetected,
      errors: result.errors.slice(0, 5),
      processingTimeMs: processingTime,
      mode: 'mock',
      message: `Learning cycle: ${result.tenantsProcessed} tenants processados, ${result.antiPatternsDetected} anti-patterns detectados`,
    });
  } catch (error) {
    console.error('[Cron:learning-cycle] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
