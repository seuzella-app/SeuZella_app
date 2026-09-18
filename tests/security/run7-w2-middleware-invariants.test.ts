/**
 * RUN 7-W2 — INVARIANTES DO FECHAMENTO 7A/RES-01 + TRIAGEM 7D/7H
 *
 * Estilo W1: provas ESTRUTURAIS (leitura de fs, sem runtime/prisma/env).
 * Diferença do W1: aqui as afirmações exigem o PATCH aplicado — sobre o baseline
 * puro (0cbc984c) estas afirmações FALHAM (RED por design); após o patch do W2
 * ficam VERDES. Qualquer rollback silencioso do perímetro quebra esta suíte.
 *
 * Este arquivo é ADITIVO: não altera nenhum código de produção.
 *
 * Cobertura:
 *  - RES-01 ....... cookie-presença removida do perímetro /api/*; JWT validado;
 *                   fail-closed (sem secret/exception => 401); machine auth preservada
 *  - superfícies .. lista pública, bloqueios de produção, páginas protegidas, matcher
 *  - herdado ...... suíte W1, push primitive (7E), gates ZCC do RUN6B
 *  - 7D/7H ........ matriz final gerada pela triagem sem UNKNOWN aberto
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p: string): string => readFileSync(join(root, p), 'utf8');
const listDir = (p: string): string[] => readdirSync(join(root, p));

describe('RUN7-W2 — RES-01 fechado: perímetro valida sessão (JWT), não presença de cookie', () => {
  const mw = read('src/middleware.ts');

  it('padrão vulnerável presence-only REMOVIDO do bloco /api/*', () => {
    const vulnerable = "!getSessionCookie(request) && !isMachineAuthorized(request)";
    expect(mw, 'middleware ainda contém o gate presence-only (RES-01 aberto) — patch RUN7-W2 ausente').not.toContain(vulnerable);
  });

  it('marker RUN7-W2 presente no middleware (prova de aplicação)', () => {
    expect(mw).toContain('RUN7-W2 (RES-01)');
  });

  it('JWT validado de fato no perímetro (getToken com req+secret)', () => {
    expect(mw).toContain('let apiAuthorized = false');
    expect(mw).toContain('await getToken({ req: request');
    expect(mw).toContain("secret: _szSecret");
  });

  it('fail-closed: exceção ou secret ausente => 401 AUTH_REQUIRED (nunca throw, nunca pass-through)', () => {
    expect(mw).toContain('catch { apiAuthorized = false; }');
    expect(mw).toMatch(/if \(!apiAuthorized\) return securityHeaders\(NextResponse\.json\(\{error:'AUTH_REQUIRED',requestId\},\{status:401\}\),requestId\);/);
  });

  it('sem NEXTAUTH_SECRET o perímetro nega (apiAuthorized permanece false)', () => {
    // o bloco de validação inteiro deve estar condicionado à existência do secret
    expect(mw).toMatch(/const _szSecret = process\.env\.NEXTAUTH_SECRET; if \(_szSecret\) \{/);
  });

  it('machine auth preservada — cron/M2M atravessam com Bearer válido', () => {
    expect(mw).toContain('if (!apiAuthorized && isMachineAuthorized(request)) apiAuthorized = true;');
  });

  it('cookie correto escolhido por nome (__Secure vs insecure)', () => {
    expect(mw).toContain("cookieName: _szSecure ? '__Secure-next-auth.session-token' : 'next-auth.session-token'");
  });
});

describe('RUN7-W2 — superfícies do perímetro sem regressão', () => {
  const mw = read('src/middleware.ts');

  it('lista pública intacta (health/readiness/auth/webhooks)', () => {
    for (const p of ['/api/health', '/api/readiness', '/api/auth', '/api/webhook-whatsapp',
      '/api/webhooks/whatsapp', '/api/webhooks/asaas', '/api/webhooks/mercadopago',
      '/api/webhooks/payment', '/api/checkout/webhook', '/api/webhooks/booking-com']) {
      expect(mw, `prefixo público ausente: ${p}`).toContain(`'${p}'`);
    }
  });

  it('bloqueios de produção intactos (debug-agent/proxy/diagnose)', () => {
    for (const p of ['/api/debug-agent', '/api/proxy', '/api/diagnose']) {
      expect(mw).toContain(`'${p}'`);
    }
  });

  it('páginas protegidas continuam com gate de presença (UX) — getSessionCookie em uso', () => {
    expect(mw).toContain('PROTECTED_PAGE_PREFIXES');
    expect(mw).toContain('getSessionCookie(request)');
  });

  it('matcher amplo preservado (nenhuma rota escapa do middleware)', () => {
    expect(mw).toMatch(/matcher:\s*\['\/\(\(\?!_next/);
  });
});

describe('RUN7-W2 — fechaduras herdadas e triagem 7D/7H', () => {
  it('suíte W1 segue presente (invariantes do baseline)', () => {
    expect(existsSync(join(root, 'tests', 'security', 'run7-baseline-invariants.test.ts'))).toBe(true);
  });

  it('7E — push primitive com tenantId permanece no baseline', () => {
    const src = read('src/lib/push/push-service.ts');
    const idx = src.indexOf('export async function removePushSubscription');
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(src.slice(idx, idx + 400)).toContain('tenantId');
  });

  it('RUN6B — gates ZCC canônicos presentes em security/monitoring/tenants', () => {
    for (const f of ['src/app/api/security/route.ts', 'src/app/api/monitoring/route.ts', 'src/app/api/tenants/route.ts']) {
      expect(read(f), `gate ZCC ausente em ${f}`).toContain('verifyZCCAccessOrReject');
    }
  });

  it('7D/7H — matriz final da triagem existe e não tem UNKNOWN aberto', () => {
    const audits = join(root, '99_AUDITS');
    expect(existsSync(audits), '99_AUDITS inexistente — triagem W2 não rodou').toBe(true);
    // NB: readdirSync direto — audits já é absoluto; listDir() re-faria join(root, ...)
    const dirs = readdirSync(audits).filter((d) => /^RUN7_W2_\d{8}_\d{6}$/.test(d)).sort();
    const latest = dirs[dirs.length - 1];
    expect(latest, 'nenhum 99_AUDITS/RUN7_W2_* — triagem W2 não rodou').toBeTruthy();
    const matrix = JSON.parse(readFileSync(join(audits, latest!, 'RUN7_TENANT_MATRIX_FINAL.json'), 'utf8'));
    expect(matrix.totals.final_unknown_open, 'matriz final com UNKNOWN aberto').toBe(0);
    expect(Array.isArray(matrix.matrix)).toBe(true);
    // projeto real: ~320 rotas (W1); fixture de teste: ≥20
    expect(matrix.matrix.length, 'matriz final menor que o esperado').toBeGreaterThanOrEqual(20);
  });
});
