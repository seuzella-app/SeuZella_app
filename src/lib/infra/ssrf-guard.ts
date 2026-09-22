/**
 * SEUZELLA RUN19-A (HYGIENE) — ssrf-guard.ts
 *
 * Allowlist de destinos para rotas de proxy (SSRF: o proxy/[...path] é
 * SSRF-prone por natureza — o rate-limit do MOP-UP não elimina esse risco).
 *
 * MODO SOMBRA (default): só registra log — NÃO bloqueia nada.
 * MODO ENFORCE: SZ_SSRF_ENFORCE=1 + PROXY_ALLOWLIST=host1.com,host2.com
 *   (subdomínios do host listado também passam; allowlist vazia em enforce
 *   bloqueia TUDO — fail-closed por design).
 * Instalado pela onda RUN19-A; NÃO editar à mão.
 */
import { timingSafeEqual } from 'node:crypto';

export function ssrfAllowlist(): string[] {
  return (process.env.PROXY_ALLOWLIST || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

export function ssrfEnforced(): boolean {
  return process.env.SZ_SSRF_ENFORCE === '1';
}

export function hostOf(targetUrl: string): string | null {
  try {
    return new URL(targetUrl).host.toLowerCase();
  } catch {
    return null;
  }
}

function allowlisted(host: string, list: string[]): boolean {
  return list.some((h) => host === h || host.endsWith('.' + h));
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
void safeEqual;

export function ssrfGuard(targetUrl: string): Response | null {
  const host = hostOf(targetUrl);
  const list = ssrfAllowlist();
  const ok = host !== null && allowlisted(host, list);
  if (!ssrfEnforced()) {
    console.warn(JSON.stringify({ evt: 'ssrf.shadow', host, allowlisted: ok }));
    return null;
  }
  if (ok) return null;
  return new Response(JSON.stringify({ error: 'blocked_by_ssrf_guard' }), {
    status: 403,
    headers: { 'content-type': 'application/json' },
  });
}
