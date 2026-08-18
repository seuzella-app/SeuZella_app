/**
 * CRON — Night Pulse (a cada 30min, 24/7)
 * ========================================
 *
 * Schedule: every 30 minutes (UTC) - configured in vercel.json
 *
 * 3 tipos de pulso alternados:
 *   - xx:00 → METRICS_SNAPSHOT (hora cheia)
 *   - xx:30 → MINI_SCAN (meia-hora)
 *   - outros → HEARTBEAT (fallback)
 *
 * Total: 48 pulsos/dia. Custo: ~$0.004/dia (apenas METRICS_SNAPSHOT usa LLM
 * e só quando detecta anomalia).
 *
 * Auth: M2M EdDSA JWT via verifyCronM2MToken(scope='cerebro:write')
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronM2MToken } from '@/lib/security/cron-auth';
import { NightPulseService } from '@/lib/cerebro/night-pulse-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 1 min — pulsos são rápidos

export async function GET(request: NextRequest) {
  return runPulse(request);
}

export async function POST(request: NextRequest) {
  return runPulse(request);
}

async function runPulse(request: NextRequest) {
  const startTime = Date.now();

  // Auth M2M
  const auth = await verifyCronM2MToken(request, 'cerebro:write');
  if (!auth.ok) return auth.response;

  // Permite forçar tipo de pulso via query param (?type=heartbeat)
  const sp = request.nextUrl.searchParams;
  const forcedType = sp.get('type') as 'heartbeat' | 'mini_scan' | 'metrics_snapshot' | null;

  try {
    const result = await NightPulseService.run(
      forcedType ? { pulseType: forcedType } : undefined
    );

    return NextResponse.json({
      ok: true,
      pulseType: result.pulseType,
      status: result.status,
      durationMs: Date.now() - startTime,
      triggeredAlert: result.triggeredAlert,
      alertMessage: result.alertMessage,
      mode: result.mode,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[CRON_NIGHT_PULSE] Falha:', err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
