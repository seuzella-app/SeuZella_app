/**
 * SEUZELLA RUN11-W3 — fiação da camada de infra nas rotas.
 *
 * Contrato:
 *   - guardRequest(): rate-limit fail-closed por IP+rota usando o RateLimiter
 *     da camada W2. NUNCA lança. Semântica:
 *       LIMIT_EXCEEDED    -> 429 + Retry-After
 *       STORE_UNAVAILABLE -> segue failMode (closed => 503; open => libera,
 *                            com WARN único já emitido pelo limiter)
 *   - auditRouteEvent(): trilha de auditoria W2 (who/what/when/result +
 *     correlationId) com redação por chave/valor. IP nunca vai cru para a
 *     trilha — só o prefixo do hash SHA-256 (privacidade por design).
 *   - Zero segredos em literais; zero contas externas (mesma doutrina W2).
 */
import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { getRateLimiter, rateLimitKey, type RateLimitPolicy } from './rate-limit';
import { audit, type AuditEvent } from './audit';

export type GuardPolicy = RateLimitPolicy;

export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim() || 'unknown';
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** Prefixo do hash do IP (12 hex) — correlaciona abuso sem armazenar PII. */
export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 12);
}

/** Retorna NextResponse (429/503) quando o acesso deve ser bloqueado; null = liberado. */
export function guardRequest(
  req: Request,
  routeLabel: string,
  policy: GuardPolicy,
): NextResponse | null {
  const limiter = getRateLimiter();
  const key = rateLimitKey({ ip: clientIp(req), route: routeLabel });
  const decision = limiter.check(key, policy);
  if (decision.allowed) return null;
  if (decision.reason === 'LIMIT_EXCEEDED') {
    auditRouteEvent({
      who: `rate-limit:${routeLabel}`,
      what: 'request.deny',
      resource: routeLabel,
      result: 'DENY',
      meta: { ipHashPrefix: hashIp(clientIp(req)), reason: decision.reason },
    });
  }
  const retryAfter = Math.max(1, Math.ceil((decision.resetAt - Date.now()) / 1000));
  const status = decision.reason === 'LIMIT_EXCEEDED' ? 429 : 503;
  return NextResponse.json(
    { error: 'RATE_LIMITED', reason: decision.reason, retryAfter },
    { status, headers: { 'Retry-After': String(retryAfter) } },
  );
}

/** Wrapper da trilha W2 para rotas (mantém redação + correlationId). */
export function auditRouteEvent(event: AuditEvent): string {
  return audit(event);
}
