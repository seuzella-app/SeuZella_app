type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
type LogContext = Record<string, unknown>;

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  requestId?: string;
  durationMs?: number;
  error?: { name: string; message: string; stack?: string; code?: string };
}

const LOG_BUFFER: LogEntry[] = [];
const MAX_BUFFER_SIZE = 100;

function generateRequestId(): string {
  return `req-${Date.now().toString(36)}-${cryptoRandomSuffix()}`;
}

function cryptoRandomSuffix(): string {
  // Avoid Math.random for request identifiers.
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = new Uint8Array(6);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 8);
  }
  return `${Date.now().toString(36)}-${process.pid.toString(36)}`.slice(-8);
}

const LOG_LEVEL_VALUES: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 };
function shouldLog(level: LogLevel): boolean {
  const minLevel = (process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')) as LogLevel;
  return (LOG_LEVEL_VALUES[level] ?? 0) >= (LOG_LEVEL_VALUES[minLevel] ?? 1);
}

const SENSITIVE_KEYS = [
  'password', 'passwd', 'secret', 'token', 'authorization', 'bearer', 'apikey', 'api_key',
  'access_token', 'refresh_token', 'client_secret', 'privatekey', 'private_key', 'cert',
  'cookie', 'set-cookie', 'session', 'code', 'otp', 'magiclink', 'magic_link',
  'creditcard', 'cvv', 'cvc', 'cpf', 'cardnumber', 'wifipassword', 'wifi_password',
  'lockcode', 'lock_code', 'passcode', 'qr_code_base64'
];

const PII_KEYS = ['email', 'phone', 'mobile', 'whatsapp', 'cpf', 'document', 'address', 'guestname', 'guest_name'];

function sanitizeValue(key: string, value: unknown): unknown {
  const lowerKey = key.toLowerCase().replace(/[-\s]/g, '_');
  if (SENSITIVE_KEYS.some((s) => lowerKey.includes(s))) return '[REDACTED]';
  if (PII_KEYS.some((s) => lowerKey === s || lowerKey.endsWith(`_${s}`))) {
    return process.env.LOG_PII === 'true' && process.env.NODE_ENV !== 'production' ? value : '[PII_REDACTED]';
  }
  if (typeof value === 'string') return value.length > 4000 ? `${value.slice(0, 4000)}…[TRUNCATED]` : value;
  if (Array.isArray(value)) return value.map((item, idx) => sanitizeValue(String(idx), item));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeValue(k, v);
    return out;
  }
  return value;
}

function sanitizeContext(context?: LogContext): LogContext | undefined {
  return context ? (sanitizeValue('root', context) as LogContext) : undefined;
}

function serializeError(error: unknown): LogEntry['error'] {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: sanitizeValue('error_message', error.message) as string,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
      code: (error as Error & { code?: string }).code,
    };
  }
  return { name: 'UnknownError', message: String(sanitizeValue('error', error)) };
}

function createEntry(level: LogLevel, message: string, context?: LogContext, requestId?: string, durationMs?: number): LogEntry {
  return { timestamp: new Date().toISOString(), level, message, context: sanitizeContext(context), requestId, durationMs };
}

function addToBuffer(entry: LogEntry): void {
  LOG_BUFFER.push(entry);
  if (LOG_BUFFER.length > MAX_BUFFER_SIZE) LOG_BUFFER.shift();
}

function formatEntry(entry: LogEntry): string {
  if (process.env.NODE_ENV === 'production') return JSON.stringify(entry);
  const reqStr = entry.requestId ? ` [${entry.requestId}]` : '';
  const contextStr = entry.context ? ` | context: ${JSON.stringify(entry.context)}` : '';
  const durStr = entry.durationMs !== undefined ? ` (${entry.durationMs}ms)` : '';
  return `[${entry.timestamp}] ${entry.level.toUpperCase()}${reqStr}: ${entry.message}${durStr}${contextStr}`;
}

function log(level: LogLevel, message: string, context?: LogContext, requestId?: string, durationMs?: number): void {
  if (!shouldLog(level)) return;
  const entry = createEntry(level, message, context, requestId, durationMs);
  addToBuffer(entry);
  const formatted = formatEntry(entry);
  if (level === 'debug' || level === 'info') console.log(formatted);
  else console.error(formatted);
}

export const logger = {
  debug(message: string, context?: LogContext, requestId?: string) { log('debug', message, context, requestId); },
  info(message: string, context?: LogContext, requestId?: string) { log('info', message, context, requestId); },
  warn(message: string, context?: LogContext, requestId?: string) { log('warn', message, context, requestId); },
  error(message: string, error?: unknown, context?: LogContext, requestId?: string) {
    const entry = createEntry('error', message, context, requestId);
    if (error) entry.error = serializeError(error);
    addToBuffer(entry);
    console.error(formatEntry(entry));
  },
  fatal(message: string, error?: unknown, context?: LogContext, requestId?: string) {
    const entry = createEntry('fatal', message, context, requestId);
    if (error) entry.error = serializeError(error);
    addToBuffer(entry);
    console.error(formatEntry(entry));
  },
  withRequest(requestId?: string) {
    const rid = requestId || generateRequestId();
    return {
      debug: (message: string, context?: LogContext) => log('debug', message, context, rid),
      info: (message: string, context?: LogContext) => log('info', message, context, rid),
      warn: (message: string, context?: LogContext) => log('warn', message, context, rid),
      error: (message: string, error?: unknown, context?: LogContext) => log('error', message, context, rid),
      fatal: (message: string, error?: unknown, context?: LogContext) => log('fatal', message, context, rid),
    };
  },
  generateRequestId,
  getBuffer(): LogEntry[] { return [...LOG_BUFFER]; },
  getBufferStats() {
    const levels = { debug: 0, info: 0, warn: 0, error: 0, fatal: 0 } as Record<LogLevel, number>;
    for (const entry of LOG_BUFFER) levels[entry.level] += 1;
    return { size: LOG_BUFFER.length, maxSize: MAX_BUFFER_SIZE, levels };
  },
};

export type { LogEntry, LogLevel, LogContext };
