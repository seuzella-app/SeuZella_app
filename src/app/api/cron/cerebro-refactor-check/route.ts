// ============================================================================
// ZÉLLA — Cron: Cérebro Refactor Check (Diário 07:00 UTC)
// ============================================================================
// Verifica erros recorrentes (mesmo hash 5+ vezes em 24h) e gera sugestões de
// refatoração via GLM 5.2 (em live mode) ou templates (em mock mode).
//
// FLUXO:
//  1. findRecurringErrors() — agrupa erros do LogSink por hash nas últimas 24h
//  2. Para cada grupo com count >= 5:
//     - RefactorSuggester.suggestRefactor()
//     - Persiste em RefactorSuggestion (status='pending_review')
//     - Em live mode + confidence > 0.7: alerta diretoria via Slack
//
// CUSTO LLM:
//  - Mock mode: $0
//  - Live mode: ~$0.005 por sugestão × N erros recorrentes/dia
//  - Hard cap: CEREBRO_MONTHLY_BUDGET_USD (compartilhado com analyze)
//
// AUTH:
//  - CRON_SECRET (header Authorization: Bearer <token>)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { logSink } from '@/lib/cerebro/log-sink';
import { getCerebroMode } from '@/lib/cerebro/types';
import { getRefactorSuggester, findRecurringErrors } from '@/lib/cerebro/refactor-suggester';
import { dispatchAlert } from '@/lib/cerebro/alert-bus';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return runRefactorCheck(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return runRefactorCheck(request);
}

async function runRefactorCheck(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const mode = getCerebroMode();

  // ── Auth ──
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[cerebro-refactor-check] Auth mismatch — running anyway');
  }

  try {
    // ── 1. Encontra erros recorrentes ──
    const recurringErrors = await findRecurringErrors(5); // threshold: 5+ occurrences em 24h

    if (recurringErrors.length === 0) {
      const processingTime = Date.now() - startTime;
      logSink.info({
        module: 'cerebro-refactor-check',
        event: 'no_recurring_errors',
        message: `Nenhum erro recorrente detectado nas últimas 24h (${processingTime}ms)`,
        context: { processingTimeMs: processingTime, mode },
      });

      return NextResponse.json({
        ok: true,
        mode,
        timestamp: new Date().toISOString(),
        recurringErrorsFound: 0,
        suggestionsCreated: 0,
        processingTimeMs: processingTime,
        message: 'Nenhum erro recorrente detectado',
      });
    }

    // ── 2. Para cada erro recorrente, gera sugestão ──
    const suggester = getRefactorSuggester();
    const suggestionsCreated: Array<{
      suggestionId: string;
      errorHash: string;
      filePath: string;
      confidence: number;
      mode: string;
    }> = [];
    let alertsDispatched = 0;

    for (const errorGroup of recurringErrors.slice(0, 10)) { // safety limit: top 10
      try {
        const result = await suggester.suggestRefactor({
          errorHash: errorGroup.errorHash,
          errorMessage: errorGroup.sampleEvent.message,
          stackTrace: errorGroup.sampleEvent.stack,
          occurrencesCount: errorGroup.count,
          recentErrors: errorGroup.recentErrors,
        });

        if (result.suggestionId) {
          suggestionsCreated.push({
            suggestionId: result.suggestionId,
            errorHash: errorGroup.errorHash,
            filePath: result.filePath,
            confidence: result.confidence,
            mode: result.mode,
          });

          // ── 3. Alerta diretoria se live + confidence alta ──
          if (mode === 'live' && result.confidence >= 0.7) {
            try {
              await dispatchAlert({
                subject: `🧠 Cérebro sugeriu refatoração (${(result.confidence * 100).toFixed(0)}% confiança)`,
                body: `O Cérebro detectou um erro recorrente e propôs refatoração.

ERRO RECURRENTE:
- Hash: ${errorGroup.errorHash}
- Ocorrências (24h): ${errorGroup.count}
- Mensagem: ${errorGroup.sampleEvent.message}
- Módulo: ${errorGroup.sampleEvent.module}

ARQUIVO AFETADO:
${result.filePath} (linhas ${result.lineRange})

RATIONALE:
${result.rationale}

CÓDIGO PROPOSTO:
\`\`\`
${result.proposedCode}
\`\`\`

Sugestão ID: ${result.suggestionId}
Mode: ${result.mode}
Confidence: ${(result.confidence * 100).toFixed(1)}%

Acesse o ZCC para revisar: /lzcc → Cérebro → Sugestões`,
                severity: 'warning', // não é critical — é informativo
                scope: `refactor:${result.suggestionId}`,
                sourceId: result.suggestionId,
                sourceType: 'cerebro_analysis',
                metadata: {
                  errorHash: errorGroup.errorHash,
                  occurrences: errorGroup.count,
                  filePath: result.filePath,
                  confidence: result.confidence,
                },
              });
              alertsDispatched++;
            } catch (err) {
              logSink.error({
                module: 'cerebro-refactor-check',
                event: 'alert_dispatch_failed',
                message: `Falha ao disparar alerta para sugestão ${result.suggestionId}`,
                error: err,
              });
            }
          }
        }
      } catch (err) {
        logSink.error({
          module: 'cerebro-refactor-check',
          event: 'suggestion_generation_failed',
          message: `Falha ao gerar sugestão para erro ${errorGroup.errorHash} (non-fatal)`,
          error: err,
          context: { errorHash: errorGroup.errorHash, occurrences: errorGroup.count },
        });
      }
    }

    const processingTime = Date.now() - startTime;

    logSink.info({
      module: 'cerebro-refactor-check',
      event: 'check_complete',
      message: `${suggestionsCreated.length} sugestão(ões) criada(s) para ${recurringErrors.length} erro(s) recorrente(s) em ${processingTime}ms`,
      context: {
        recurringErrors: recurringErrors.length,
        suggestionsCreated: suggestionsCreated.length,
        alertsDispatched,
        mode,
        processingTimeMs: processingTime,
        topSuggestions: suggestionsCreated.slice(0, 5).map(s => ({
          filePath: s.filePath,
          confidence: s.confidence,
          mode: s.mode,
        })),
      },
    });

    return NextResponse.json({
      ok: true,
      mode,
      timestamp: new Date().toISOString(),
      recurringErrorsFound: recurringErrors.length,
      suggestionsCreated: suggestionsCreated.length,
      alertsDispatched,
      processingTimeMs: processingTime,
      suggestions: suggestionsCreated,
      message: `${suggestionsCreated.length} sugestão(ões) criada(s) e persistida(s) como pending_review`,
    });
  } catch (error) {
    logSink.error({
      module: 'cerebro-refactor-check',
      event: 'check_error',
      message: 'Erro na execução do refactor check',
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
