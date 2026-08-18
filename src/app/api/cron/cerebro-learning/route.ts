/**
 * CRON — Cérebro Learning Cycle (diário 03:30 BRT, após Night Audit)
 * =====================================================================
 *
 * Schedule: "30 6 * * *" (06:30 UTC = 03:30 BRT America/Sao_Paulo)
 *
 * Roda APÓS o Night Audit (que roda às 03:00 BRT) completar.
 * Executa o workflow "Delirium Zero":
 *   1. INGEST: Lê último NightAuditReport completo
 *   2. EXTRACT: Identifica padrões recorrentes (vulns, métricas, anomalias)
 *   3. DISTILL: Converte em KnowledgeFacts estruturados
 *   4. VALIDATE: Cada fato tem confidence 0-1 e source citada
 *   5. PERSIST: Salva em CerebroKnowledgeFact para RAG futuro
 *
 * Quando o operador pergunta algo ao Cérebro:
 *   - Sistema busca KnowledgeFacts relevantes (TF-IDF)
 *   - Injeta no system prompt do GLM 5.2
 *   - LLM responde com fatos citados (não alucina)
 *
 * Auth: M2M EdDSA JWT via verifyCronM2MToken(scope='cerebro:write')
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronM2MToken } from '@/lib/security/cron-auth';
import { CerebroLearningService } from '@/lib/cerebro/cerebro-learning-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 min

export async function GET(request: NextRequest) {
  return runLearning(request);
}

export async function POST(request: NextRequest) {
  return runLearning(request);
}

async function runLearning(request: NextRequest) {
  const startTime = Date.now();

  const auth = await verifyCronM2MToken(request, 'cerebro:write');
  if (!auth.ok) return auth.response;

  try {
    const result = await CerebroLearningService.runLearningCycle();

    return NextResponse.json({
      ok: true,
      auditDate: result.auditDate,
      mode: result.mode,
      stats: {
        factsExtracted: result.factsExtracted,
        factsValidated: result.factsValidated,
        factsUpdated: result.factsUpdated,
        newPatternsDetected: result.newPatternsDetected,
      },
      llmCostUsd: result.costUsd,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[CRON_CEREBRO_LEARNING] Falha:', err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
