type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
type LogContext = Record<string, any>;

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  requestId?: string;
  durationMs?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}

const LOG_BUFFER: LogEntry[] = [];
const MAX_BUFFER_SIZE = 100;

function generateRequestId(): string {
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4
};

function shouldLog(level: LogLevel): boolean {
  const minLevel = (process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')) as LogLevel;
  return (LOG_LEVEL_VALUES[level] ?? 0) >= (LOG_LEVEL_VALUES[minLevel] ?? 1);
}

const SENSITIVE_KEYS = [
  'password', 'secret', 'token', 'authorization', 'bearer', 'apikey', 'api_key',
  'creditcard', 'cvv', 'cvc', 'cpf', 'cardnumber', 'privatekey', 'cert'
];

function sanitizeValue(key: string, value: any): any {
  if (typeof value === 'string') {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some((s) => lowerKey.includes(s))) {
      return '[REDACTED]';
    }
  } else if (typeof value === 'object' && value !== null) {
    if (Array.isArray(value)) {
      return value.map((item, idx) => sanitizeValue(String(idx), item));
    }
    const sanitizedObj: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      sanitizedObj[k] = sanitizeValue(k, v);
    }
    return sanitizedObj;
  }
  return value;
}

function sanitizeContext(context?: LogContext): LogContext | undefined {
  if (!context) return undefined;
  return sanitizeValue('root', context);
}

function createEntry(level: LogLevel, message: string, context?: LogContext, requestId?: string, durationMs?: number): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    context: sanitizeContext(context),
    requestId,
    durationMs
  };
}

function addToBuffer(entry: LogEntry): void {
  LOG_BUFFER.push(entry);
  if (LOG_BUFFER.length > MAX_BUFFER_SIZE) {
    LOG_BUFFER.shift();
  }
}

function formatEntry(entry: LogEntry): string {
  if (process.env.NODE_ENV === 'production') {
    return JSON.stringify(entry);
  }
  const reqStr = entry.requestId ? ` [${entry.requestId}]` : '';
  const contextStr = entry.context ? ` | context: ${JSON.stringify(entry.context)}` : '';
  const durStr = entry.durationMs ? ` (${entry.durationMs}ms)` : '';
  return `[${entry.timestamp}] ${entry.level.toUpperCase()}${reqStr}: ${entry.message}${durStr}${contextStr}`;
}

function log(level: LogLevel, message: string, context?: LogContext, requestId?: string, durationMs?: number): void {  
  if (!shouldLog(level)) return;  
  const entry = createEntry(level, message, context, requestId, durationMs);  
  addToBuffer(entry);  
  const formatted = formatEntry(entry);  
  switch (level) {  
    case 'debug': case 'info': console.log(formatted); break;  
    case 'warn': console.warn(formatted); break;  
    case 'error': case 'fatal': console.error(formatted); break;  
  }  
}

function serializeError(error: unknown): LogEntry['error'] {  
  if (error instanceof Error) {  
    return {  
      name: error.name, message: error.message,  
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,  
      code: (error as Error & { code?: string }).code,  
    };  
  }  
  if (typeof error === 'string') return { name: 'Error', message: error };  
  return { name: 'UnknownError', message: String(error) };  
}

export const logger = {  
  debug(message: string, context?: LogContext, requestId?: string): void {  
    log('debug', message, context, requestId);  
  },  
  info(message: string, context?: LogContext, requestId?: string): void {  
    log('info', message, context, requestId);  
  },  
  warn(message: string, context?: LogContext, requestId?: string): void {  
    log('warn', message, context, requestId);  
  },  
  error(message: string, error?: unknown, context?: LogContext, requestId?: string): void {  
    const entry = createEntry('error', message, context, requestId);  
    if (error) entry.error = serializeError(error);  
    addToBuffer(entry);  
    console.error(formatEntry(entry));  
  },  
  fatal(message: string, error?: unknown, context?: LogContext, requestId?: string): void {  
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
