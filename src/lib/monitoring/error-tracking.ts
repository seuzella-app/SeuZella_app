// @ts-nocheck — to be fixed in dedicated type refactoring pass
/**
 * Error Tracking Service — Sentry + fallback console
 * ============================================================================
 *
 * Em produção: integra com Sentry (SENTRY_DSN configurada).
 * Em desenvolvimento: console.error apenas.
 *
 * Uso:
 *   import { captureError, captureMessage } from '@/lib/monitoring/error-tracking';
 *   try { ... } catch (err) {
 *     captureError(err, { extra: { tenantId, action } });
 *   }
 * ============================================================================
 */

interface CaptureOptions {
  extra?: Record<string, unknown>;
  tags?: Record<string, string>;
  user?: { id: string; email?: string; tenantId?: string };
  level?: 'info' | 'warning' | 'error' | 'fatal';
}

const SENTRY_DSN = process.env.SENTRY_DSN || '';
const SENTRY_ENABLED = !!SENTRY_DSN && process.env.NODE_ENV === 'production';

let sentryClient: any = null;

async function getSentry() {
  if (!SENTRY_ENABLED) return null;
  if (sentryClient) return sentryClient;
  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
      profilesSampleRate: 0.1,
      integrations: [],
    });
    sentryClient = Sentry;
    return Sentry;
  } catch (err) {
    console.error('[ERROR_TRACKING] Sentry init falhou:', err);
    return null;
  }
}

/**
 * Captura erro e envia para Sentry (em produção) ou console (dev).
 */
export async function captureError(error: Error | unknown, options: CaptureOptions = {}): Promise<void> {
  const err = error instanceof Error ? error : new Error(String(error));

  // Log local (sempre)
  console.error('[ERROR]', err.message, {
    stack: err.stack,
    ...options.extra,
  });

  // Sentry (apenas produção)
  if (SENTRY_ENABLED) {
    const Sentry = await getSentry();
    if (Sentry) {
      try {
        if (options.user) Sentry.setUser(options.user);
        if (options.tags) {
          for (const [k, v] of Object.entries(options.tags)) {
            Sentry.setTag(k, v);
          }
        }
        if (options.extra) {
          for (const [k, v] of Object.entries(options.extra)) {
            Sentry.setExtra(k, v);
          }
        }
        Sentry.captureException(err);
      } catch (sentryErr) {
        console.error('[ERROR_TRACKING] Falha ao enviar para Sentry:', sentryErr);
      }
    }
  }
}

/**
 * Captura mensagem (info/warning).
 */
export async function captureMessage(message: string, options: CaptureOptions = {}): Promise<void> {
  const level = options.level || 'info';

  if (level === 'warning') console.warn('[WARN]', message, options.extra);
  else if (level === 'error') console.error('[ERROR]', message, options.extra);
  else console.log('[INFO]', message, options.extra);

  if (SENTRY_ENABLED) {
    const Sentry = await getSentry();
    if (Sentry) {
      try {
        Sentry.captureMessage(message, level);
      } catch (sentryErr) {
        // silent fail
      }
    }
  }
}

/**
 * Wrapper para funções async — captura erros automaticamente.
 *
 * @example
 * export const POST = withErrorTracking(async (req) => {
 *   // ...
 * }, { tags: { route: 'upsell-create' } });
 */
export function withErrorTracking<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: CaptureOptions = {},
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (err) {
      await captureError(err, {
        ...options,
        extra: {
          ...options.extra,
          args: args.slice(0, 2),  // limit args to avoid huge payloads
        },
      });
      throw err;
    }
  }) as T;
}
