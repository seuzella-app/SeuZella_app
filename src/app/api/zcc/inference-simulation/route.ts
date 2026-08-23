/**
 * ZCC — Inference Cost Simulation API
 * =====================================
 *
 * GET /api/zcc/inference-simulation
 *   Retorna a simulação de impacto financeiro das 4 otimizações de inferência
 *   em 3 cenários de escala (134, 100, 140 pousadas).
 *
 * Os dados são servidos do JSON estático em /public/data/inference-cost-simulation.json
 * (gerado por scripts/inference-cost-simulation.py).
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const jsonPath = path.join(process.cwd(), 'public', 'data', 'inference-cost-simulation.json');
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch {
    // Fallback se arquivo não existir
    return NextResponse.json({
      error: 'Simulation data not found. Run scripts/inference-cost-simulation.py first.',
      scenarios: [],
    }, { status: 404 });
  }
}
