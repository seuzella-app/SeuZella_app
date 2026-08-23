import { NextRequest, NextResponse } from 'next/server';
import { evaluateVpsScaling, HostingerTier } from '@/lib/infrastructure/vps-scaling-ruler';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
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
