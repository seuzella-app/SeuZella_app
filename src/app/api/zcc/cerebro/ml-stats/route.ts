// ============================================================================
// ZÉLLA — ZCC Endpoint: Cérebro ML Stats
// ============================================================================
// Agrega estatísticas de todos os novos módulos ML do Cérebro em um único
// endpoint para alimentar o dashboard ZCC.
//
// Módulos cobertos:
//  - Cérebro Budget Guard (orçamento interno LLM)
//  - Vulnerability Scanner (SAST interno)
//  - Self-Defense (ações defensivas tomadas)
//  - Auto-Remediator (refatorações auto-aplicadas)
//  - Churn Predictor (tenants em risco)
//  - Knowledge Distiller (chunks de conhecimento)
//  - Cérebro Orchestrator (status do master loop)
//  - Alert Bus dedup stats
//  - ZaosNeuroRouter posterior snapshot
//
// AUTH: requer session NextAuth (admin role para ver stats detalhadas)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCerebroMode } from '@/lib/cerebro/types';
import { getCerebroBudgetGuard } from '@/lib/cerebro/cerebro-budget-guard';
import { getVulnerabilityScanner } from '@/lib/cerebro/vulnerability-scanner';
import { getSelfDefense } from '@/lib/cerebro/self-defense';
import { getAutoRemediator } from '@/lib/cerebro/auto-remediator';
import { getChurnPredictor } from '@/lib/cerebro/churn-predictor';
import { getKnowledgeDistiller } from '@/lib/cerebro/knowledge-distiller';
import { getCerebroOrchestrator } from '@/lib/cerebro/cerebro-orchestrator';
import { getAlertDedupStats } from '@/lib/cerebro/alert-bus';
import { logSink } from '@/lib/cerebro/log-sink';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // ── Auth ──
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const mode = getCerebroMode();

    // ── Aggrega stats de todos módulos ──
    const stats = {
      timestamp: new Date().toISOString(),
      mode,
      modules: {
        budgetGuard: getCerebroBudgetGuard().getStats(),
        vulnerabilityScanner: {
          patternsCount: getVulnerabilityScanner().getPatterns().length,
          patterns: getVulnerabilityScanner().getPatterns().map(p => ({
            id: p.id,
            name: p.name,
            severity: p.severity,
            category: p.category,
          })),
        },
        selfDefense: getSelfDefense().getStats(),
        autoRemediator: getAutoRemediator().getStats(),
        churnPredictor: getChurnPredictor().getStats(),
        knowledgeDistiller: getKnowledgeDistiller().getStats(),
        orchestrator: getCerebroOrchestrator().getStats(),
        alertDedup: getAlertDedupStats(),
        logSink: logSink.getStats(),
      },
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('[cerebro-ml-stats] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
