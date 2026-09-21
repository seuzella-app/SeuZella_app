/**
 * SEUZELLA RUN12-A — logger estruturado da camada de infra (fecha o I8).
 *
 * Por quê: 48 chamadas diretas de console.log/debug/info em código de
 * produção (src/app + src/server) fugiam da trilha de auditoria e não
 * tinham redação. Este módulo dá saída JSON estruturada (uma linha por
 * evento) com redação REUTILIZANDO o redactValue do audit W2 (padrões
 * sk-/eyJ/AIza/gsk_/Bearer + chave sensível + truncamento + circular).
 *
 * Contrato:
 *   - Assinatura VARIÁDICA, compatível com a forma de chamada do console
 *     (console.log('a', b, c) => logger.info('a', b, c)) para que o
 *     codemod I8 seja mecânico e type-safe.
 *   - NUNCA lança. Sink só console.* local — zero rede, zero segredo.
 *   - LOG_LEVEL controla o piso (default: info). debug só com LOG_LEVEL=debug.
 */
import { redactValue } from './audit';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function minRank(): number {
  const raw = (process.env.LOG_LEVEL || '').toLowerCase() as LogLevel;
  return raw in LEVEL_RANK ? LEVEL_RANK[raw] : LEVEL_RANK.info;
}

function serialize(head: unknown): unknown {
  if (typeof head === 'string') return redactValue(head);
  try {
    return redactValue(JSON.parse(JSON.stringify(head ?? null)));
  } catch {
    return '[UNSERIALIZABLE]';
  }
}

function emit(level: LogLevel, args: unknown[]): void {
  if (LEVEL_RANK[level] < minRank()) return;
  const [head, ...rest] = args;
  const line: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg: serialize(head),
  };
  if (rest.length === 1) line.data = redactValue(rest[0]);
  else if (rest.length > 1) line.data = redactValue(rest);
  const sink =
    level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  try {
    sink(JSON.stringify(line));
  } catch {
    /* nunca lança — logging não pode derrubar a rota */
  }
}

export const logger = {
  log: (...args: unknown[]) => emit('info', args),
  info: (...args: unknown[]) => emit('info', args),
  debug: (...args: unknown[]) => emit('debug', args),
  warn: (...args: unknown[]) => emit('warn', args),
  error: (...args: unknown[]) => emit('error', args),
};

export default logger;
