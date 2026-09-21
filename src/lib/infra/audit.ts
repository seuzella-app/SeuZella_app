/**
 * SEUZELLA RUN11-W2 — trilha de auditoria estruturada (cronograma 11D).
 *
 * Garante: who / what / when / tenant / resource / result / correlationId.
 * Proíbe: senha, token, segredo, PII desnecessária — por CHAVE (regex de
 * campos sensíveis) e por VALOR (padrões vendor: sk-, eyJ, AIza, gsk_,
 * Bearer). Mesma lição do RUN10-V3: avaliar o que é STRING literal no
 * dado, não comentários.
 *
 * Saída: JSON line (console por padrão; sink injetável para testes/rotas).
 * Zero contas externas.
 */
import { randomUUID } from 'node:crypto';

export type AuditResult = 'OK' | 'ALLOW' | 'DENY' | 'ERROR';

export interface AuditEvent {
  who: string;
  what: string;
  /** ISO-8601; ausente => agora */
  when?: string;
  tenantId?: string;
  resource?: string;
  result: AuditResult;
  correlationId?: string;
  meta?: Record<string, unknown>;
}

const SENSITIVE_KEY_RE = /pass(word)?|pwd|secret|token|authorization|api[-_]?key|apikey|cookie|session/i;
const SECRET_VALUE_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bsk-[A-Za-z0-9_-]{16,}/g, label: 'vendor-key' },
  { re: /\beyJ[A-Za-z0-9_-]{10,}/g, label: 'jwt-like' },
  { re: /\bAIza[0-9A-Za-z_-]{20,}/g, label: 'google-key' },
  { re: /\bgsk_[A-Za-z0-9_-]{10,}/g, label: 'groq-key' },
  { re: /\bBearer\s+[A-Za-z0-9._-]{8,}/g, label: 'bearer' },
];
const MAX_STRING_LEN = 4096;
const MAX_DEPTH = 6;

export function redactValue<T>(value: T, depth = 0, seen = new Set<unknown>()): T {
  if (value === null || value === undefined) return value;
  if (depth > MAX_DEPTH) return '[TRUNCATED:depth]' as unknown as T;

  const t = typeof value;
  if (t === 'string') {
    let s = value as unknown as string;
    for (const p of SECRET_VALUE_PATTERNS) {
      s = s.replace(p.re, `[REDACTED:${p.label}]`);
    }
    if (s.length > MAX_STRING_LEN) s = s.slice(0, MAX_STRING_LEN) + '…[TRUNCATED:len]';
    return s as unknown as T;
  }
  if (t === 'number' || t === 'boolean' || t === 'bigint') return value;

  if (seen.has(value)) return '[CIRCULAR]' as unknown as T;
  if (t === 'object') {
    seen.add(value);
    try {
      if (Array.isArray(value)) {
        return value.map((v) => redactValue(v, depth + 1, seen)) as unknown as T;
      }
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (SENSITIVE_KEY_RE.test(k)) {
          out[k] = '[REDACTED:key]';
        } else {
          out[k] = redactValue(v, depth + 1, seen);
        }
      }
      return out as unknown as T;
    } finally {
      seen.delete(value);
    }
  }
  return '[UNSERIALIZABLE]' as unknown as T;
}

export function audit(event: AuditEvent, sink?: (line: string) => void): string {
  const record = {
    ts: event.when ?? new Date().toISOString(),
    who: event.who,
    what: event.what,
    tenantId: event.tenantId,
    resource: event.resource,
    result: event.result,
    correlationId: event.correlationId ?? randomUUID(),
    meta: event.meta === undefined ? undefined : redactValue(event.meta),
  };
  const line = JSON.stringify(record);
  (sink ?? ((l: string) => console.log(l)))(line);
  return line;
}
