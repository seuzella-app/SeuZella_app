// ============================================================================
// ZÉLLA — ZCC Endpoint: Cérebro Stream (SSE)
// ============================================================================
// Server-Sent Events endpoint para o dashboard Cérebro Vivo receber atualizações
// em tempo real sem polling.
//
// Eventos emitidos:
//  - "stats": stats do GlmCerebroService (mode, spend, budget) a cada 30s
//  - "analysis": nova CerebroAnalysis criada (push imediato)
//  - "anomaly": novo AnomalyEvent detectado (push imediato)
//  - "heartbeat": keep-alive a cada 15s para evitar timeout do navegador
//
// AUTH:
//  SSE não suporta headers custom facilmente em browsers. Por isso, aceitamos
//  o token godmode via query param OU cookie. Em produção, validar sempre.
//
// USO (frontend):
//   const es = new EventSource('/api/zcc/cerebro/stream?godmode=<token>');
//   es.addEventListener('analysis', (e) => { ... });
//   es.addEventListener('anomaly', (e) => { ... });
// ============================================================================

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { getGlmCerebroService } from '@/lib/cerebro/glm-service';
import { logSink } from '@/lib/cerebro/log-sink';
import { getCerebroMode } from '@/lib/cerebro/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ── Helper: stream com keep-alive ──────────────────────────────────────────

interface SSEStreamController {
  enqueue: (data: string) => void;
  close: () => void;
}

function sendEvent(controller: SSEStreamController, event: string, data: unknown): void {
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  controller.enqueue(`event: ${event}\ndata: ${payload}\n\n`);
}

function sendHeartbeat(controller: SSEStreamController): void {
  // Comment line (RFC 8895) — keeps connection alive without emitting client event
  controller.enqueue(`:heartbeat ${Date.now()}\n\n`);
}

// ── GET handler: estabelece SSE stream ─────────────────────────────────────

export async function GET(request: NextRequest): Promise<Response> {
  // ── Auth ──
  // Para SSE, precisamos converter a NextRequest em algo que verifyZCCAccessOrReject aceita.
  // O godmode pode vir via query param (?godmode=) ou cookie.
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  const mode = getCerebroMode();
  const encoder = new TextEncoder();

  // ── Setup stream ──
  const stream = new ReadableStream({
    start(controller) {
      const sseController: SSEStreamController = {
        enqueue: (data: string) => controller.enqueue(encoder.encode(data)),
        close: () => controller.close(),
      };

      // 1. Envia stats iniciais imediatamente
      try {
        const service = getGlmCerebroService();
        const stats = service.getStats();
        sendEvent(sseController, 'stats', {
          ...stats,
          timestamp: new Date().toISOString(),
          logSinkStats: logSink.getStats(),
        });
      } catch (err) {
        logSink.error({
          module: 'cerebro-stream',
          event: 'initial_stats_failed',
          message: 'Falha ao enviar stats iniciais SSE',
          error: err,
        });
      }

      // 2. Envia análises recentes (initial load)
      db.cerebroAnalysis.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
      }).then((recent) => {
        for (const a of recent) {
          sendEvent(sseController, 'analysis', a);
        }
      }).catch((err) => {
        logSink.warn({
          module: 'cerebro-stream',
          event: 'recent_analyses_fetch_failed',
          message: 'Falha ao buscar análises recentes (non-fatal)',
          error: err,
        });
      });

      // 3. Envia anomalias unacknowledged recentes (initial load)
      db.anomalyEvent.findMany({
        where: { acknowledged: false },
        orderBy: { detectedAt: 'desc' },
        take: 5,
      }).then((recent) => {
        for (const a of recent) {
          sendEvent(sseController, 'anomaly', a);
        }
      }).catch((err) => {
        logSink.warn({
          module: 'cerebro-stream',
          event: 'recent_anomalies_fetch_failed',
          message: 'Falha ao buscar anomalias recentes (non-fatal)',
          error: err,
        });
      });

      // 4. Keep-alive heartbeat a cada 15s
      const heartbeatInterval = setInterval(() => {
        try {
          sendHeartbeat(sseController);
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 15_000);

      // 5. Stats refresh a cada 30s (custo, mode, etc)
      const statsInterval = setInterval(() => {
        try {
          const service = getGlmCerebroService();
          const stats = service.getStats();
          sendEvent(sseController, 'stats', {
            ...stats,
            timestamp: new Date().toISOString(),
            logSinkStats: logSink.getStats(),
          });
        } catch {
          clearInterval(statsInterval);
        }
      }, 30_000);

      // 6. Polling por novas análises/anomalias a cada 10s
      //    (SSE push real exigiria Redis pub/sub — por ora usamos polling server-side)
      let lastAnalysisCheck = new Date();
      let lastAnomalyCheck = new Date();

      const pollInterval = setInterval(async () => {
        try {
          // Busca novas análises desde último check
          const newAnalyses = await db.cerebroAnalysis.findMany({
            where: { createdAt: { gt: lastAnalysisCheck } },
            orderBy: { createdAt: 'asc' },
            take: 10,
          });

          for (const a of newAnalyses) {
            sendEvent(sseController, 'analysis', a);
            lastAnalysisCheck = a.createdAt;
          }

          // Busca novas anomalias desde último check
          const newAnomalies = await db.anomalyEvent.findMany({
            where: { detectedAt: { gt: lastAnomalyCheck } },
            orderBy: { detectedAt: 'asc' },
            take: 10,
          });

          for (const a of newAnomalies) {
            sendEvent(sseController, 'anomaly', a);
            lastAnomalyCheck = a.detectedAt;
          }
        } catch {
          clearInterval(pollInterval);
        }
      }, 10_000);

      // 7. Cleanup quando cliente desconecta
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        clearInterval(statsInterval);
        clearInterval(pollInterval);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  // ── Retorna Response com headers SSE ──
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
      'X-Cerebro-Mode': mode,
    },
  });
}
