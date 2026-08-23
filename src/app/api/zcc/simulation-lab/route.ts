// ============================================================================
// GET /api/zcc/simulation-lab — list experiment results
// POST /api/zcc/simulation-lab/run — run a new experiment
// ============================================================================

import { NextResponse } from 'next/server';
import { simulationLab } from '@/simulation';
import type { ExperimentConfig } from '@/simulation';

export async function GET() {
  return NextResponse.json({
    results: simulationLab.getResults(),
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const config: ExperimentConfig = {
      experimentId: body.experimentId ?? `exp_${Date.now()}`,
      hypothesis: body.hypothesis ?? 'Unspecified hypothesis',
      feature: body.feature ?? 'unspecified',
      eventCount: body.eventCount,
      durationCapMs: body.durationCapMs,
      metrics: body.metrics,
      approvalThresholds: body.approvalThresholds,
      baseline: body.baseline,
      eventGenerator: body.eventGenerator, // usually undefined for client requests
    };
    const result = await simulationLab.run(config);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
