/**
 * SEUZELLA RUN19-A (HYGIENE) — internal-secret.ts
 *
 * Segredo de ambiente para ferramentas internas (debug-agent x3, leads/seed —
 * decisão do MOPUP_GAPS: "P1 internas -> segredo/admin").
 *
 * MODO SOMBRA (default): só registra log — NÃO bloqueia nada (não quebramos
 * ferramenta do dono sem aval).
 * MODO ENFORCE: SZ_ENFORCE_INTERNAL=1 + INTERNAL_SECRET=<valor alto>; sem o
 *   segredo configurado em enforce, responde 503 (fail-closed); header aceito:
 *   x-internal-secret: <valor> ou Authorization: Bearer <valor>.
 * Instalado pela onda RUN19-A; NÃO editar à mão.
 */
import { timingSafeEqual } from 'node:crypto';

export function internalEnforced(): boolean {
  return process.env.SZ_ENFORCE_INTERNAL === '1';
}

export function providedInternalSecret(req: unknown): string | null {
  try {
    const r = req as { headers?: { get?: (k: string) => string | null } };
    const get = r && r.headers && typeof r.headers.get === 'function' ? r.headers.get.bind(r.headers) : null;
    if (!get) return null;
    const direct = get('x-internal-secret');
    if (direct) return direct.trim();
    const auth = get('authorization');
    if (auth && auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
    return null;
  } catch {
    return null;
  }
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function requireInternalSecret(req: unknown): Response | null {
  const provided = providedInternalSecret(req);
  const expected = process.env.INTERNAL_SECRET || '';
  if (!internalEnforced()) {
    console.warn(JSON.stringify({ evt: 'internal.shadow', checked: Boolean(provided) }));
    return null;
  }
  if (!expected) {
    return new Response(JSON.stringify({ error: 'internal_secret_unconfigured' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (!provided || !safeEqual(provided, expected)) {
    return new Response(JSON.stringify({ error: 'internal_secret_required' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
  return null;
}
