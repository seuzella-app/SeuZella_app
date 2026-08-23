// ============================================================================
// ZÉLLA — GET /api/ddc/cerebro/learning
// ============================================================================
// Retorna learning telemetry completo do tenant:
//   - Brain age (stage, autonomy level, days old)
//   - Patterns learned (today, week, month, total)
//   - Top categories
//   - DPO pairs status (pending vs trained)
//   - Feedback loop status
//   - Personalization profile
// Usado pelo DDC para mostrar ao dono como o cérebro está aprendendo.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireDDCTenantId } from '@/lib/ddc/auth-utils';
import {
  getLearningTelemetry,
  getBrainAge,
  getPersonalizationProfile,
  getAntiPatternsForPrompt,
} from '@/lib/cerebro/learning-engine';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  try {
    const tenantId = await requireDDCTenantId();

    const [telemetry, brainAge, personalization, antiPatterns] = await Promise.all([
      getLearningTelemetry(tenantId),
      getBrainAge(tenantId),
      getPersonalizationProfile(tenantId),
      getAntiPatternsForPrompt(tenantId),
    ]);

    return NextResponse.json({
      success: true,
      brainAge,
      learning: {
        patternsLearnedToday: telemetry.patternsLearnedToday,
        patternsLearnedThisWeek: telemetry.patternsLearnedThisWeek,
        patternsLearnedThisMonth: telemetry.patternsLearnedThisMonth,
        totalPatterns: telemetry.totalPatterns,
        averageEffectiveness: telemetry.averageEffectiveness,
        topCategories: telemetry.topCategories,
        feedbackLoopActive: telemetry.feedbackLoopActive,
        dpoPairsPending: telemetry.dpoPairsPending,
        dpoPairsTrained: telemetry.dpoPairsTrained,
        lastLearningAt: telemetry.lastLearningAt,
      },
      personalization,
      antiPatterns,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error.message?.includes('DDC_AUTH_REQUIRED')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('[GET /api/ddc/cerebro/learning]', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
