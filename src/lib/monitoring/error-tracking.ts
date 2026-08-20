// Centralized error tracking with PII-safe local and Sentry payloads.

interface CaptureOptions {
  extra?: Record<string, unknown>;
  tags?: Record<string, string>;
  user?: { id: string; email?: string; tenantId?: string };
  level?: 'info' | 'warning' | 'error' | 'fatal';
}

const SENTRY_DSN = process.env.SENTRY_DSN || '';
const SENTRY_ENABLED = !!SENTRY_DSN && process.env.NODE_ENV === 'production';
let sentryClient: typeof import('@sentry/node') | null = null;

const SECRET_KEY = /(password|passwd|secret|token|authorization|cookie|api[_-]?key|private[_-]?key|refresh[_-]?token|access[_-]?token|otp|lock(code)?|wifi(password)?|client[_-]?secret)/i;
const PII_KEY = /(email|phone|whatsapp|cpf|cnpj|address|street|zip|document)/i;

function sanitize(value: unknown, key = '', depth = 0): unknown {
  if (depth > 4) return '[TRUNCATED]';
  if (SECRET_KEY.test(key)) return '[REDACTED]';
  if (typeof value === 'string') {
    const text = value.slice(0, 2000);
    if (PII_KEY.test(key)) return text.length <= 4 ? '***' : `${text.slice(0, 2)}***${text.slice(-2)}`;
    return text;
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitize(item, key, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 100).map(([k, v]) => [k, sanitize(v, k, depth + 1)]));
  }
  return value;
}

function safeExtra(extra?: Record<string, unknown>): Record<string, unknown> {
  return (sanitize(extra || {}) as Record<string, unknown>) || {};
}

async function getSentry() {
  if (!SENTRY_ENABLED) return null;
  if (sentryClient) return sentryClient;
  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({ dsn: SENTRY_DSN, environment: process.env.NODE_ENV, tracesSampleRate: 0.1, profilesSampleRate: 0.1, integrations: [] });
    sentryClient = Sentry;
    return Sentry;
  } catch {
    return null;
  }
}

export async function captureError(error: Error | unknown, options: CaptureOptions = {}): Promise<void> {
  const err = error instanceof Error ? error : new Error('Unknown error');
  const extra = safeExtra(options.extra);
  console.error('[ERROR]', sanitize(err.message, 'errorMessage'), { stack: err.stack?.slice(0, 8000), ...extra });

  const Sentry = await getSentry();
  if (!Sentry) return;
  try {
    // Do not send email, tenant identifiers or other PII as Sentry user fields.
    if (options.tags) for (const [key, value] of Object.entries(options.tags)) Sentry.setTag(key, String(sanitize(value, key)));
    for (const [key, value] of Object.entries(extra)) Sentry.setExtra(key, value);
    Sentry.captureException(err);
  } catch {
    // Error tracking must never break the application path.
  }
}

export async function captureMessage(message: string, options: CaptureOptions = {}): Promise<void> {
  const level = options.level || 'info';
  const safeMessage = String(sanitize(message, 'message')).slice(0, 2000);
  const extra = safeExtra(options.extra);
  if (level === 'warning') console.warn('[WARN]', safeMessage, extra);
  else if (level === 'error' || level === 'fatal') console.error('[ERROR]', safeMessage, extra);
  else console.log('[INFO]', safeMessage, extra);

  const Sentry = await getSentry();
  if (!Sentry) return;
  try { Sentry.captureMessage(safeMessage, level); } catch { /* non-fatal */ }
}

export function withErrorTracking<T extends (...args: any[]) => Promise<any>>(fn: T, options: CaptureOptions = {}): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (err) {
      await captureError(err, { ...options, extra: { ...options.extra, argCount: args.length } });
      throw err;
    }
  }) as T;
}
