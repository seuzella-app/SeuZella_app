// ============================================================================
// ZÉLLA — Error Reporter (Sentry-compatible, sem SDK dependency)
// ============================================================================
// Captura erros não tratados e envia para Sentry via HTTP direto.
// Não usa @sentry/nextjs para evitar bundle size + incompatibilidades de build.
//
// FUNCIONAMENTO:
//  - Em instrumentation.ts: registra handlers para unhandledRejection/uncaughtException
//  - Em try/catch críticos: chamar errorReporter.capture(err, { context })
//  - Se SENTRY_DSN configurado: envia via HTTP para Sentry ingest API
//  - Se não: apenas loga no LogSink (Cérebro captura para análise)
//
// FORMATO DO DSN:
//  https://<public_key>@<host>/<project_id>
//  Ex: https://abc123@o12345.ingest.sentry.io/67890
//
// RATE LIMITING (client-side):
//  - Max 10 erros/min para não sobrecarregar Sentry em loop infinito
//  - Deduplicação por hash de mensagem (mesmo erro = 1 envio por 5 min)
// ============================================================================

import { logSink } from '@/lib/cerebro/log-sink';
import { hashErrorStack } from '@/lib/cerebro/types';

// ── Configuração ────────────────────────────────────────────────────────────

interface ErrorReporterConfig {
  dsn: string | null;
  environment: string;
  release: string | null;
  serverName: string;
}

function loadConfig(): ErrorReporterConfig {
  const dsn = process.env.SENTRY_DSN || null;
  return {
    dsn,
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    release: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 8) || null,
    serverName: process.env.VERCEL_REGION || process.env.VERCEL_DEPLOYMENT_ID || 'local',
  };
}

// ── Rate limiting (client-side) ─────────────────────────────────────────────

const RATE_LIMIT_MAX = 10; // max errors per minute
const RATE_LIMIT_WINDOW_MS = 60_000;
const DEDUP_WINDOW_MS = 5 * 60_000; // 5 min

let errorCount = 0;
let windowStart = Date.now();
const sentHashes = new Map<string, number>(); // hash → timestamp

function isRateLimited(): boolean {
  const now = Date.now();
  if (now - windowStart > RATE_LIMIT_WINDOW_MS) {
    errorCount = 0;
    windowStart = now;
  }
  errorCount++;
  return errorCount > RATE_LIMIT_MAX;
}

function isDuplicate(message: string, stack?: string): boolean {
  const hash = hashErrorStack(stack || message) || 'nohash';
  const now = Date.now();
  const lastSent = sentHashes.get(hash);
  if (lastSent && now - lastSent < DEDUP_WINDOW_MS) {
    return true;
  }
  sentHashes.set(hash, now);
  return false;
}

// Cleanup periodic para evitar memory leak (apenas em Node.js runtime)
if (typeof setInterval !== 'undefined' && typeof window === 'undefined') {
  try {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [hash, ts] of sentHashes.entries()) {
        if (now - ts > DEDUP_WINDOW_MS * 2) {
          sentHashes.delete(hash);
        }
      }
    }, 10 * 60_000);
    // unref apenas existe em Node.js, não em Edge
    if (cleanupInterval && typeof cleanupInterval.unref === 'function') {
      cleanupInterval.unref();
    }
  } catch {
    // Edge Runtime não suporta setInterval — ignora
  }
}

// ── Sentry envelope format (simplified) ─────────────────────────────────────

interface SentryEvent {
  event_id: string;
  timestamp: string;
  level: 'error' | 'warning' | 'info';
  platform: 'nodejs';
  environment: string;
  release?: string;
  server_name: string;
  message: string;
  exception?: {
    values: Array<{
      type: string;
      value: string;
      stacktrace?: {
        frames: Array<{
          filename: string;
          function: string;
          lineno: number;
          colno: number;
          in_app: boolean;
        }>;
      };
    }>;
  };
  extra?: Record<string, unknown>;
  tags?: Record<string, string>;
}

function generateEventId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

function parseStack(stack: string): Array<{
  filename: string;
  function: string;
  lineno: number;
  colno: number;
  in_app: boolean;
}> {
  const frames: Array<{
    filename: string;
    function: string;
    lineno: number;
    colno: number;
    in_app: boolean;
  }> = [];

  const lines = stack.split('\n');
  for (const line of lines) {
    // Padrão: "    at functionName (file:line:col)"
    const match = line.match(/^\s*at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
    if (match) {
      const [, funcName, filename, lineno, colno] = match;
      frames.push({
        filename,
        function: funcName,
        lineno: parseInt(lineno, 10),
        colno: parseInt(colno, 10),
        in_app: !filename.includes('node_modules'),
      });
    } else {
      // Padrão alternativo: "    at file:line:col"
      const match2 = line.match(/^\s*at\s+(.+?):(\d+):(\d+)/);
      if (match2) {
        const [, filename, lineno, colno] = match2;
        frames.push({
          filename,
          function: '<anonymous>',
          lineno: parseInt(lineno, 10),
          colno: parseInt(colno, 10),
          in_app: !filename.includes('node_modules'),
        });
      }
    }
  }

  return frames;
}

// ── API pública ─────────────────────────────────────────────────────────────

export interface CaptureOptions {
  level?: 'error' | 'warning' | 'info';
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  /** Contexto adicional para LogSink (não enviado para Sentry) */
  context?: Record<string, unknown>;
  /** Module para LogSink */
  module?: string;
}

/**
 * Captura um erro e envia para Sentry (se configurado) + LogSink (sempre).
 *
 * Uso:
 *   import { errorReporter } from '@/lib/cerebro/error-reporter';
 *
 *   try {
 *     await riskyOperation();
 *   } catch (err) {
 *     errorReporter.capture(err, {
 *       tags: { component: 'webhook' },
 *       extra: { tenantId, guestPhone },
 *       module: 'whatsapp-webhook',
 *     });
 *     throw err; // re-throw se quiser propagar
 *   }
 */
export const errorReporter = {
  capture(error: unknown, options: CaptureOptions = {}): void {
    const errObj = error instanceof Error ? error : new Error(String(error));
    const message = errObj.message;
    const stack = errObj.stack;
    const level = options.level || 'error';

    // 1. Sempre registra no LogSink (Cérebro analisa)
    logSink.error({
      module: options.module || 'error-reporter',
      event: 'captured_error',
      message,
      error: errObj,
      context: {
        ...options.context,
        ...options.extra,
        tags: options.tags,
        sentToSentry: !!process.env.SENTRY_DSN,
      },
    });

    // 2. Rate limit + dedup (apenas para Sentry)
    if (!process.env.SENTRY_DSN) return; // Sentry não configurado
    if (level !== 'error') return; // só erros vão para Sentry
    if (isRateLimited()) return;
    if (isDuplicate(message, stack)) return;

    // 3. Envia para Sentry (fire-and-forget)
    this.sendToSentry(errObj, options).catch(() => {
      // Silent fail — LogSink já registrou
    });
  },

  /**
   * Captura mensagem (sem erro) — útil para warnings/info.
   */
  captureMessage(message: string, options: CaptureOptions = {}): void {
    const level = options.level || 'info';

    logSink.info({
      module: options.module || 'error-reporter',
      event: 'captured_message',
      message,
      context: {
        ...options.context,
        ...options.extra,
        tags: options.tags,
      },
    });

    if (!process.env.SENTRY_DSN) return;
    if (level === 'info') return; // info não vai para Sentry
    if (isRateLimited()) return;

    const fakeErr = new Error(message);
    this.sendToSentry(fakeErr, { ...options, level }).catch(() => {});
  },

  /**
   * Envia evento para Sentry via HTTP.
   * Formato: https://docs.sentry.io/development/sdk-client/overview/
   */
  async sendToSentry(error: Error, options: CaptureOptions): Promise<void> {
    const config = loadConfig();
    if (!config.dsn) return;

    // Parse DSN: https://<public_key>@<host>/<project_id>
    const dsnMatch = config.dsn.match(/^https?:\/\/([^@]+)@([^/]+)\/(\d+)$/);
    if (!dsnMatch) {
      console.warn('[ErrorReporter] SENTRY_DSN inválido. Formato esperado: https://<key>@<host>/<project_id>');
      return;
    }

    const [, publicKey, host, projectId] = dsnMatch;

    const event: SentryEvent = {
      event_id: generateEventId(),
      timestamp: new Date().toISOString(),
      level: options.level || 'error',
      platform: 'nodejs',
      environment: config.environment,
      release: config.release || undefined,
      server_name: config.serverName,
      message: error.message,
      exception: error.stack ? {
        values: [{
          type: error.name || 'Error',
          value: error.message,
          stacktrace: {
            frames: parseStack(error.stack),
          },
        }],
      } : undefined,
      extra: options.extra,
      tags: options.tags,
    };

    // Sentry envelope format (newer API)
    const envelope = JSON.stringify({
      event_id: event.event_id,
      sent_at: new Date().toISOString(),
    }) + '\n' + JSON.stringify({
      type: 'event',
      ...event,
    });

    const url = `https://${host}/api/${projectId}/envelope/`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Sentry-Auth': `Sentry sentry_key=${publicKey}, sentry_version=7, sentry_client=zella-custom/1.0`,
      },
      body: envelope,
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      // Silent fail mas loga para diagnóstico
      console.warn(`[ErrorReporter] Sentry HTTP ${res.status}: ${await res.text().catch(() => 'unknown')}`);
    }
  },

  /**
   * Stats para dashboard.
   */
  getStats(): {
    configured: boolean;
    environment: string;
    release: string | null;
    rateLimitRemaining: number;
    dedupCacheSize: number;
  } {
    const config = loadConfig();
    const remaining = Math.max(0, RATE_LIMIT_MAX - errorCount);
    return {
      configured: !!config.dsn,
      environment: config.environment,
      release: config.release,
      rateLimitRemaining: remaining,
      dedupCacheSize: sentHashes.size,
    };
  },
};

// ── Handler global para erros não tratados ──────────────────────────────────

/**
 * Registra handlers globais para unhandledRejection e uncaughtException.
 * Chamado por instrumentation.ts no boot do server.
 */
export function registerGlobalErrorHandlers(): void {
  // Guard: só registra handlers se estivermos em Node.js runtime (não Edge)
  const proc = (globalThis as any).process;
  if (typeof window !== 'undefined' || !proc || typeof proc.on !== 'function') return;

  try {
    proc.on('unhandledRejection', (reason: any) => {
      errorReporter.capture(reason, {
        level: 'error',
        module: 'process',
        tags: { type: 'unhandledRejection' },
        extra: { reason: String(reason) },
      });
    });

    proc.on('uncaughtException', (error: any) => {
      errorReporter.capture(error, {
        level: 'error',
        module: 'process',
        tags: { type: 'uncaughtException' },
        extra: { pid: proc.pid ? proc.pid : 'unknown' },
      });
    });
  } catch {
    // Edge Runtime ignorado silenciosamente
  }
}
