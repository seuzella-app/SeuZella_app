// ============================================================================
// GET /api/zcc/zgs/decisions — list ZGS strategic decisions
// PATCH /api/zcc/zgs/decisions — update decision status (approve/reject/execute)
// ============================================================================

import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { ZellaGrowthStrategy } from '@/domain/strategy';
import { getAdapters } from '@/adapters';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';

// RUN 6 — tenant/authority hardening: o plano ZCC exige o gate canônico.
// ANTES: GET/PATCH sem nenhuma autenticação — qualquer chamador listava e
// alterava o status de decisões estratégicas (approve/reject/execute).
async function guard(request: NextRequest): Promise<NextResponse | null> {
  const zcc = await verifyZCCAccessOrReject(request);
  if (!zcc.allowed) return zcc.response!;
  return null;
}

let _zgs: ZellaGrowthStrategy | undefined;
function getInstance(): ZellaGrowthStrategy {
  if (!_zgs) _zgs = new ZellaGrowthStrategy(getAdapters());
  return _zgs;
}

export async function GET(req: Request) {
  const denied = await guard(req as NextRequest);
  if (denied) return denied;
  const url = new URL(req.url);
  const status = url.searchParams.get('status') as ZellaGrowthStrategy extends never ? never : any;
  const kind = url.searchParams.get('kind') as any;
  const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined;
  const zgs = getInstance();
  return NextResponse.json({
    decisions: zgs.getDecisions({ status, kind, limit }),
    snapshot: zgs.snapshot(),
  });
}

export async function PATCH(req: Request) {
  try {
    const denied = await guard(req as NextRequest);
    if (denied) return denied;
    const body = await req.json();
    const { decisionId, status } = body as { decisionId: string; status: 'proposed' | 'approved' | 'rejected' | 'executed' | 'failed' };
    if (!decisionId || !status) {
      return NextResponse.json(
        { ok: false, error: 'decisionId and status required' },
        { status: 400 }
      );
    }
    const zgs = getInstance();
    await zgs.updateDecisionStatus(decisionId, status);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
