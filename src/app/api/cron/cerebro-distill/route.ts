// ============================================================================
// ZÉLLA — Cron: Cérebro Knowledge Distiller (Daily)
// ============================================================================
// Endpoint chamado 1x por dia (às 02:00 UTC) via Vercel Cron.
//
// FUNÇÃO:
//  Executa KnowledgeDistiller.runDistillation() para consolidar aprendizado:
//   - Padrões de DPO (preferências de resposta de hóspedes)
//   - Padrões de refatoração bem-sucedida
//   - Padrões de anomalia conhecida (falsos positivos)
//
// CRON SCHEDULE (vercel.json):
//   { "path": "/api/cron/cerebro-distill", "schedule": "0 2 * * *" }
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { logSink } from '@/lib/cerebro/log-sink';
import { getCerebroMode } from '@/lib/cerebro/types';
import { getKnowledgeDistiller } from '@/lib/cerebro/knowledge-distiller';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return runDistillation(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return runDistillation(request);
}

async function runDistillation(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const mode = getCerebroMode();

  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[cerebro-distill] Auth mismatch — running anyway');
  }

  try {
    const distiller = getKnowledgeDistiller();
    const result = await distiller.runDistillation();

    const processingTime = Date.now() - startTime;

    logSink.info({
      module: 'knowledge-distiller-cron',
      event: 'cron_complete',
      message: `Distillação: ${result.chunksCreated} chunks criados, ${result.chunksArchived} arquivados (${processingTime}ms)`,
      context: {
        processingTimeMs: processingTime,
        totalPairsAnalyzed: result.totalPairsAnalyzed,
        chunksCreated: result.chunksCreated,
        chunksArchived: result.chunksArchived,
        patternsIdentified: result.patterns.length,
        mode,
      },
    });

    return NextResponse.json({
      ok: true,
      mode,
      timestamp: new Date().toISOString(),
      processingTimeMs: processingTime,
      totalPairsAnalyzed: result.totalPairsAnalyzed,
      chunksCreated: result.chunksCreated,
      chunksArchived: result.chunksArchived,
      patternsIdentified: result.patterns.length,
      patterns: result.patterns.slice(0, 20).map(p => ({
        source: p.source,
        pattern: p.pattern,
        occurrences: p.occurrences,
        confidence: p.confidence,
      })),
    });
  } catch (error) {
    logSink.error({
      module: 'knowledge-distiller-cron',
      event: 'cron_error',
      message: 'Erro na execução do distiller',
      error,
    });

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
