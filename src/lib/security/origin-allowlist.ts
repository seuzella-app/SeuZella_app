// ============================================================================
// ZEHLA — Origin Allowlist (F27 CORS)
// ============================================================================
// Política única de CORS para endpoints de streaming (SSE/DDC).
// Substitui 'Access-Control-Allow-Origin: *' por allowlist explícita,
// sem reflexão cega de Origin e sem wildcard.
//
// Origens legítimas (NENHUM domínio inventado — todas já existem no projeto):
//   - NEXT_PUBLIC_APP_URL   → URL canônica da app (usada por callbacks/live-feed)
//   - NEXTAUTH_URL          → origem de autenticação da aplicação
//   - VERCEL_URL            → deployment preview (carregado em next.config.ts)
//   - https://seuzella.com.br → fallback já existente em ddc/live-feed
//   - Dev: localhost / 127.0.0.1 em qualquer porta (NODE_ENV !== 'production')
//
// Comportamento:
//   - Origin ausente (same-origin) → permitido (não exige CORS)
//   - Origin na allowlist          → ACAO = origem específica (+ Vary: Origin)
//   - Origin fora da allowlist     → SEM header ACAO (browser bloqueia)
// ============================================================================

const LEGACY_PRODUCTION_ORIGIN = 'https://seuzella.com.br';

function normalizeOrigin(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let origin = raw.trim().toLowerCase();
  if (!origin) return null;
  // VERCEL_URL chega sem protocolo (ex.: meu-app.vercel.app)
  if (!/^https?:\/\//.test(origin)) origin = `https://${origin}`;
  origin = origin.replace(/\/+$/, '');
  // Aceita apenas origens válidas (protocolo + host), sem path
  try {
    const url = new URL(origin);
    if (url.pathname && url.pathname !== '/') return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

type EnvLike = {
  NODE_ENV?: string;
  NEXT_PUBLIC_APP_URL?: string;
  NEXTAUTH_URL?: string;
  VERCEL_URL?: string;
};

/** Origens permitidas a partir do ambiente — nunca inventa domínio. */
export function getAllowedOrigins(env: EnvLike = process.env): string[] {
  const configured = [
    normalizeOrigin(env.NEXT_PUBLIC_APP_URL),
    normalizeOrigin(env.NEXTAUTH_URL),
    normalizeOrigin(env.VERCEL_URL),
    normalizeOrigin(LEGACY_PRODUCTION_ORIGIN),
  ].filter((o): o is string => !!o);
  return Array.from(new Set(configured));
}

function isLocalDevOrigin(origin: string): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    (/^http:\/\/localhost(:\d+)?$/.test(origin) || /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin))
  );
}

/**
 * Decide se uma Origin recebida é autorizada.
 * Origin nula/vazia = same-origin → permitido (CORS é irrelevante nesse caso).
 */
export function isOriginAllowed(origin: string | null | undefined): boolean {
  if (!origin) return true; // same-origin: sem header Origin
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  if (isLocalDevOrigin(normalized)) return true;
  return getAllowedOrigins().includes(normalized);
}

/**
 * Headers CORS para streaming SSE baseado na allowlist.
 * Nunca reflete Origin desconhecida e nunca emite wildcard.
 */
export function buildSseCorsHeaders(request: { headers: { get(name: string): string | null } }): Record<string, string> {
  const headers: Record<string, string> = {
    // Necessário para reconexão SSE (Last-Event-ID) em clients autorizados.
    'Access-Control-Allow-Headers': 'Last-Event-ID',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Cache-Control': 'no-cache, no-transform',
    Vary: 'Origin',
  };
  const origin = request.headers.get('origin');
  if (origin && isOriginAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = normalizeOrigin(origin)!;
  }
  return headers;
}
