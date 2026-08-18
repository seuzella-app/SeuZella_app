// ============================================================================
// ZÉLLA — LogSink Distribuído (Cérebro Memory)
// ============================================================================
// Substitui console.error/warn direto por um sink que:
//  - Em MODO MOCK (padrão): apenas replica para console (não envia para Redis)
//  - Em MODO LIVE: envia para Redis Stream `logs:*` com TTL 7 dias, mantém
//    ring buffer in-memory de 1000 eventos como fallback, e replica para console
//  - Deduplica erros por hash (mesmo stack = agregado em 60s)
//
// COMO USAR:
//   import { logSink } from '@/lib/cerebro/log-sink';
//
//   // Em vez de:
//   console.error('[WhatsApp Webhook] Falha', err);
//
//   // Use:
//   logSink.error({
//     module: 'whatsapp-webhook',
//     event: 'process_failure',
//     message: 'Falha ao processar mensagem',
//     error: err,
//     context: { tenantId, guestPhone },
//   });
//
// INTERCEPTAÇÃO AUTOMÁTICA:
//   instrumentation.ts chama logSink.interceptConsole() no boot do server,
//   capturando TODOS os console.error/warn do app legado sem precisar
//   refatorar cada chamada individualmente.
// ============================================================================

import {
  type LogEvent,
  type LogLevel,
  getCerebroMode,
  getLogSinkMode,
  hashErrorStack,
} from './types';

// ── Estado in-memory (ring buffer) ──────────────────────────────────────────

const MAX_IN_MEMORY_EVENTS = 1000;
const inMemoryBuffer: LogEvent[] = [];
let consoleIntercepted = false;

// Deduplication: hash → { count, firstSeen, lastSeen }
const errorHashCounts = new Map<string, { count: number; firstSeen: number; lastSeen: number }>();
const DEDUP_WINDOW_MS = 60_000; // 60s

// ── Helper: obter deployment ID (Vercel) ────────────────────────────────────

function getDeploymentId(): string | undefined {
  return process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 8);
}

// ── Core: addEvent ──────────────────────────────────────────────────────────

interface LogSinkInput {
  module: string;
  event: string;
  message: string;
  level?: LogLevel;
  error?: unknown;
  context?: Record<string, unknown>;
  /** Stack trace override (se error não tiver stack) */
  stack?: string;
}

/**
 * Adiciona um evento de log ao sink.
 *
 * Em MODO MOCK: apenas console.log/error + ring buffer in-memory.
 * Em MODO LIVE: tudo do mock + envio assíncrono para Redis Stream.
 *
 * Fire-and-forget: nunca bloqueia o caller. Erros no envio são silenciosos
 * (mas capturados para telemetria do próprio Cérebro).
 */
export function addEvent(input: LogSinkInput): void {
  const level = input.level ?? (input.error ? 'error' : 'info');
  const errorObj = input.error instanceof Error ? input.error : null;
  const stack = input.stack ?? errorObj?.stack;

  // Hash para deduplicação (apenas erros)
  const errorHash = level === 'error' ? hashErrorStack(stack) : undefined;

  // Deduplicação: se mesmo hash apareceu nos últimos 60s, apenas incrementa contador
  if (errorHash) {
    const now = Date.now();
    const existing = errorHashCounts.get(errorHash);
    if (existing) {
      existing.count++;
      existing.lastSeen = now;
      // Se ainda dentro da janela de dedup, NÃO cria novo evento (apenas conta)
      if (now - existing.firstSeen < DEDUP_WINDOW_MS) {
        // Ainda assim replica para console (para debug imediato)
        consoleReplica(level, input, errorObj);
        return;
      }
      // Janela expirou — reset e cria novo evento
      errorHashCounts.set(errorHash, { count: 1, firstSeen: now, lastSeen: now });
    } else {
      errorHashCounts.set(errorHash, { count: 1, firstSeen: now, lastSeen: now });
    }
  }

  const logEvent: LogEvent = {
    timestamp: new Date().toISOString(),
    level,
    module: input.module,
    event: input.event,
    message: input.message,
    stack,
    errorHash,
    context: input.context,
    env: (process.env.NODE_ENV === 'production' ? 'production' : 'development'),
    deploymentId: getDeploymentId(),
  };

  // 1. Ring buffer in-memory (sempre)
  inMemoryBuffer.push(logEvent);
  if (inMemoryBuffer.length > MAX_IN_MEMORY_EVENTS) {
    inMemoryBuffer.shift(); // remove o mais antigo
  }

  // 2. Console (sempre, em qualquer modo)
  consoleReplica(level, input, errorObj);

  // 3. Redis Stream (apenas em modo live com Redis configurado)
  const mode = getLogSinkMode();
  if (mode === 'redis') {
    sendToRedisStream(logEvent).catch((err) => {
      // Silencioso — não queremos que erro de telemetria quebre o app
      // Apenas log para debug interno
      console.warn('[LogSink] Redis stream send failed (silent):', err instanceof Error ? err.message : err);
    });
  }
}

// ── Convenience methods (estilo console.*) ──────────────────────────────────

export const logSink = {
  error(input: Omit<LogSinkInput, 'level'>): void {
    addEvent({ ...input, level: 'error' });
  },

  warn(input: Omit<LogSinkInput, 'level'>): void {
    addEvent({ ...input, level: 'warn' });
  },

  info(input: Omit<LogSinkInput, 'level' | 'error'>): void {
    addEvent({ ...input, level: 'info' });
  },

  /** Acesso ao buffer in-memory (para debug/desenvolvimento) */
  getBuffer(): readonly LogEvent[] {
    return [...inMemoryBuffer];
  },

  /** Limpa o buffer (apenas para testes) */
  clearBuffer(): void {
    inMemoryBuffer.length = 0;
    errorHashCounts.clear();
  },

  /** Estatísticas de deduplicação (para dashboard) */
  getStats(): {
    totalEventsBuffered: number;
    uniqueErrorHashes: number;
    topErrors: Array<{ hash: string; count: number }>;
    mode: 'mock' | 'live';
    sinkMode: 'console' | 'redis';
  } {
    const topErrors = Array.from(errorHashCounts.entries())
      .map(([hash, info]) => ({ hash, count: info.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    return {
      totalEventsBuffered: inMemoryBuffer.length,
      uniqueErrorHashes: errorHashCounts.size,
      topErrors,
      mode: getCerebroMode(),
      sinkMode: getLogSinkMode(),
    };
  },

  /**
   * Intercepta console.error e console.warn globalmente.
   * Chamado por instrumentation.ts no boot do server.
   *
   * Captura TODOS os console.error/warn do app legado (200+ pontos) sem
   * precisar refatorar cada chamada individualmente.
   */
  interceptConsole(): void {
    if (consoleIntercepted) return;
    if (typeof window !== 'undefined') return; // Só no server

    // Guarda refs originais ANTES de substituir
    originalConsoleError = console.error.bind(console);
    originalConsoleWarn = console.warn.bind(console);
    originalConsoleLog = console.log.bind(console);

    console.error = (...args: unknown[]): void => {
      try {
        const message = args.map(a =>
          a instanceof Error ? `${a.name}: ${a.message}` : String(a)
        ).join(' ');
        const errorObj = args.find(a => a instanceof Error) as Error | undefined;
        addEvent({
          module: 'console',
          event: 'console_error',
          message,
          level: 'error',
          error: errorObj,
        });
      } catch {
        // Never throw from interceptor
      }
      // Always replicate to original console
      originalConsoleError!(...args);
    };

    console.warn = (...args: unknown[]): void => {
      try {
        const message = args.map(a =>
          a instanceof Error ? `${a.name}: ${a.message}` : String(a)
        ).join(' ');
        addEvent({
          module: 'console',
          event: 'console_warn',
          message,
          level: 'warn',
        });
      } catch {
        // Never throw from interceptor
      }
      originalConsoleWarn!(...args);
    };

    consoleIntercepted = true;
    originalConsoleError('[LogSink] Console interception ACTIVE — mode:', getCerebroMode());
  },
};

// ── Console replica (mantém comportamento original) ─────────────────────────
//
// Guarda referências aos métodos originais do console antes da interceptação.
// Quando o LogSink intercepta, ele substitui console.error/warn/log por wrappers
// que chamam addEvent + o método original. Estes guardam as refs originais.

let originalConsoleError: typeof console.error | null = null;
let originalConsoleWarn: typeof console.warn | null = null;
let originalConsoleLog: typeof console.log | null = null;

function consoleReplica(level: LogLevel, input: LogSinkInput, errorObj: Error | null): void {
  const prefix = `[${input.module}]`;
  const contextStr = input.context ? ` ${JSON.stringify(input.context)}` : '';
  const message = `${prefix} ${input.message}${contextStr}`;

  // Usa as refs originais se disponíveis (interceptação ativa), senão usa console direto
  const logFn = level === 'error'
    ? (originalConsoleError ?? console.error)
    : level === 'warn'
      ? (originalConsoleWarn ?? console.warn)
      : (originalConsoleLog ?? console.log);

  if (level === 'error' && errorObj) {
    logFn.call(console, message, errorObj);
  } else {
    logFn.call(console, message);
  }
}

// ── Redis Stream sender (apenas em modo live) ──────────────────────────────

async function sendToRedisStream(event: LogEvent): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;

  const streamKey = `logs:${event.module}`;

  // XADD logs:<module> MAXLEN ~ 10000 * <json>
  // MAXLEN ~ 10000 mantém ring buffer server-side de ~10k eventos por módulo
  const res = await fetch(`${url}/xadd/${streamKey}/MAXLEN/~/10000/*`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      'timestamp', event.timestamp,
      'level', event.level,
      'event', event.event,
      'message', event.message,
      'errorHash', event.errorHash || '',
      'stack', event.stack || '',
      'context', JSON.stringify(event.context || {}),
      'env', event.env,
      'deploymentId', event.deploymentId || '',
    ]),
    signal: AbortSignal.timeout(3000),
  });

  if (!res.ok) {
    throw new Error(`Redis XADD HTTP ${res.status}`);
  }
}

// ── Query helpers (para endpoints e dashboard) ─────────────────────────────

export interface LogQueryParams {
  level?: LogLevel;
  module?: string;
  errorHash?: string;
  since?: Date;
  limit?: number;
}

export function queryEvents(params: LogQueryParams = {}): LogEvent[] {
  let result = [...inMemoryBuffer];

  if (params.level) {
    result = result.filter(e => e.level === params.level);
  }
  if (params.module) {
    result = result.filter(e => e.module === params.module);
  }
  if (params.errorHash) {
    result = result.filter(e => e.errorHash === params.errorHash);
  }
  if (params.since) {
    const sinceMs = params.since.getTime();
    result = result.filter(e => new Date(e.timestamp).getTime() >= sinceMs);
  }

  // Reverse chronological
  result.reverse();

  if (params.limit) {
    result = result.slice(0, params.limit);
  }

  return result;
}

/**
 * Conta ocorrências de erro por hash em uma janela de tempo.
 * Usado pelo AnomalyDetector para detectar "error_spike".
 */
export function countErrorsByHash(since: Date): Map<string, number> {
  const sinceMs = since.getTime();
  const counts = new Map<string, number>();

  for (const event of inMemoryBuffer) {
    if (event.level !== 'error') continue;
    if (!event.errorHash) continue;
    if (new Date(event.timestamp).getTime() < sinceMs) continue;

    counts.set(event.errorHash, (counts.get(event.errorHash) || 0) + 1);
  }

  return counts;
}
