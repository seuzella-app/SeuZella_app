import { NextRequest, NextResponse } from 'next/server';
import { evaluateVpsScaling, HostingerTier } from '@/lib/infrastructure/vps-scaling-ruler';
import { db } from '@/lib/db';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

export async function GET(req: NextRequest) {
  // RUN18-A (W2/MOP-UP): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(req, 'zcc.infra.scaling-ruler', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN18-A (W2/MOP-UP): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:zcc.infra.scaling-ruler', what: 'zcc.infra.scaling-ruler.entry', resource: 'api', result: 'ALLOW' });
  try {
    const { searchParams } = new URL(req.url);
    const tierParam = (searchParams.get('tier') as HostingerTier) || 'KVM_4';
    const overridePousadas = searchParams.get('pousadas');

    let activePousadas = 18; // valor padrão para simulações
    if (overridePousadas) {
      activePousadas = parseInt(overridePousadas, 10) || 18;
    } else {
      try {
        // Tenta buscar o número real de pousadas cadastradas no banco
        const count = await (db as any).tenant?.count?.();
        if (typeof count === 'number') {
          activePousadas = count;
        }
      } catch {
        // fallback suave caso db não esteja disponível
      }
    }

    const evaluation = evaluateVpsScaling(activePousadas, tierParam);

    return NextResponse.json({
      success: true,
      data: evaluation,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Erro ao avaliar dimensionamento de VPS',
      },
      { status: 500 }
    );
  }
}
