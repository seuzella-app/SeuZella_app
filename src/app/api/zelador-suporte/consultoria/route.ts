import { NextRequest, NextResponse } from 'next/server';
import { ZeladorSuporteBrain } from '@/lib/cerebro/zelador-suporte-brain';
import { PlanTier } from '@/lib/plan-features';

/**
 * POST `/api/zelador-suporte/consultoria`
 * Gerador de Relatório Consultivo VIP Zélla em 1 Clique (Exclusivo Plano MAX).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { propertyName = 'Minha Hospedagem', userName = 'Anfitrião', tier = 'max' } = body;

    if ((tier as PlanTier) !== 'max') {
      return NextResponse.json(
        { error: 'Recurso exclusivo para assinantes do Plano MAX VIP.' },
        { status: 403 }
      );
    }

    const report = await ZeladorSuporteBrain.generateConsultoriaReport(propertyName, userName);

    return NextResponse.json({
      success: true,
      report,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[zelador-consultoria-api] Erro ao gerar relatório:', error);
    return NextResponse.json(
      { success: false, error: 'Falha ao gerar relatório de consultoria' },
      { status: 500 }
    );
  }
}
