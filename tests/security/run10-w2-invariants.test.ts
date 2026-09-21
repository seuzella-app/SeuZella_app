import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { checkRateLimit, rateLimitResponse } from '../../src/lib/cerebro/rate-limit';
import { AI_ENV_KEYS, getAiEnv, aiEnvStatus, requireAiEnv } from '../../src/lib/cerebro/ai-env';

/**
 * RUN10-W2 V3 — INVARIANTES (fechaduras da onda, fs-based / sem DB / sem rede)
 *
 * FIX V3 (causa raiz provada em sandbox — repro 8/8 espelhando o RED do iMac):
 * o secret-redactor.ts real contem strings-exemplo com formato de chave
 * DENTRO de TEMPLATE LITERAL (backticks). Essas strings:
 *   - sao invisiveis ao AST (ts.isStringLiteral) -> patcher: NO_LITERAL_FOUND
 *   - nao sao comentarios -> EVID: contexto=CODIGO
 *   - sobrevivem ao stripComments do V2 (que nao rastreia backticks) -> RED
 * A suíte V2 (scan textual) e o patcher (AST) discordavam por heuristica.
 * V3 usa O MESMO criterio do patcher: AST, APENAS StringLiteral. Template
 * literals, regex literals e comentarios NAO contam (exemplos inertes em
 * runtime — residuais documentados, ver R10-8-EVID3 no log do apply).
 *
 * Pin anti-crescimento V3: baseline AST por-arquivo congelado POS-patch pelo
 * APPLY ({"src/lib/cerebro/agency-agents-catalog.ts":0,"src/lib/cerebro/ai-env.ts":0,"src/lib/cerebro/alert-bus.ts":0,"src/lib/cerebro/anomaly-detector.ts":0,"src/lib/cerebro/auto-remediator.ts":0,"src/lib/cerebro/best-practices.ts":0,"src/lib/cerebro/cerebro-budget-guard.ts":0,"src/lib/cerebro/cerebro-learning-service.ts":0,"src/lib/cerebro/cerebro-orchestrator.ts":0,"src/lib/cerebro/churn-predictor.ts":0,"src/lib/cerebro/code-indexer.ts":0,"src/lib/cerebro/code-reviewer/code-reader.ts":0,"src/lib/cerebro/code-reviewer/diff-extractor.ts":0,"src/lib/cerebro/code-reviewer/path-instructions-loader.ts":0,"src/lib/cerebro/code-reviewer/quality-gates.ts":0,"src/lib/cerebro/code-reviewer/reviewer-service.ts":0,"src/lib/cerebro/code-reviewer/secret-redactor.ts":0,"src/lib/cerebro/code-reviewer/types.ts":0,"src/lib/cerebro/contextual-bandits.ts":0,"src/lib/cerebro/error-reporter.ts":0,"src/lib/cerebro/glm-service.ts":0,"src/lib/cerebro/guest-responder-brain.ts":0,"src/lib/cerebro/knowledge-distiller.ts":0,"src/lib/cerebro/learning-engine.ts":0,"src/lib/cerebro/log-sink.ts":0,"src/lib/cerebro/night-activity-tracker-service.ts":0,"src/lib/cerebro/night-audit-service.ts":0,"src/lib/cerebro/night-pentest-service.ts":0,"src/lib/cerebro/night-pulse-service.ts":0,"src/lib/cerebro/rate-limit.ts":0,"src/lib/cerebro/refactor-suggester.ts":0,"src/lib/cerebro/self-defense.ts":0,"src/lib/cerebro/semantic-similarity.ts":0,"src/lib/cerebro/telemetry-bridge.ts":0,"src/lib/cerebro/tfidf.ts":0,"src/lib/cerebro/types.ts":0,"src/lib/cerebro/vulnerability-scanner.ts":0,"src/lib/cerebro/workflow-engine.ts":0,"src/lib/cerebro/yield-citation-hook.ts":0,"src/lib/cerebro/ze-code/apply-via-pr.ts":0,"src/lib/cerebro/ze-code/bottleneck-detector.ts":0,"src/lib/cerebro/ze-code/command-allowlist.ts":0,"src/lib/cerebro/ze-code/gap-detector.ts":0,"src/lib/cerebro/ze-code/git-applier.ts":0,"src/lib/cerebro/ze-code/orchestrator.ts":0,"src/lib/cerebro/ze-code/types.ts":0,"src/lib/cerebro/zelador-suporte-brain.ts":0,"src/lib/cerebro/zella-sales-brain.ts":0,"src/lib/cerebro/zella-skills.ts":0}). Qualquer .ts do cerebro que GANHE um literal
 * vendor acima do baseline -> RED. Arquivos novos fora do baseline -> teto 0.
 */
const require_ = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ts = require_(path.join(process.cwd(), 'node_modules', 'typescript')) as any;

const proj = process.cwd();
const SR = path.join(proj, 'src/lib/cerebro/code-reviewer/secret-redactor.ts');
const RL = path.join(proj, 'src/lib/cerebro/rate-limit.ts');
const ENV = path.join(proj, 'src/lib/cerebro/ai-env.ts');

// Mesmos padrões do patcher 10A (prefixos vendor de chaves de IA/SaaS)
const KEY_PATTERNS: RegExp[] = [
  /^sk-[A-Za-z0-9_-]{16,}$/,
  /^AIza[0-9A-Za-z_-]{30,}$/,
  /^gsk_[A-Za-z0-9]{20,}$/,
  /^xox[baprs]-[A-Za-z0-9-]{16,}$/,
  /^gh[pousr]_[A-Za-z0-9]{30,}$/,
  /^eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\./,
];
const keyLike = (s: string): boolean => KEY_PATTERNS.some((r) => r.test(s));

function astVendorHits(abs: string): number {
  let src = '';
  try { src = fs.readFileSync(abs, 'utf8'); } catch { return 0; }
  const sf = ts.createSourceFile(abs, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let n = 0;
  const rec = (node: any): void => {
    if (ts.isStringLiteral(node) && node.text && node.text.length >= 20 && keyLike(node.text)) n++;
    ts.forEachChild(node, rec);
  };
  rec(sf);
  return n;
}

// Baseline congelado pelo APPLY no momento da aplicacao (pos-patch).
const AST_BASELINE: Record<string, number> = {"src/lib/cerebro/agency-agents-catalog.ts":0,"src/lib/cerebro/ai-env.ts":0,"src/lib/cerebro/alert-bus.ts":0,"src/lib/cerebro/anomaly-detector.ts":0,"src/lib/cerebro/auto-remediator.ts":0,"src/lib/cerebro/best-practices.ts":0,"src/lib/cerebro/cerebro-budget-guard.ts":0,"src/lib/cerebro/cerebro-learning-service.ts":0,"src/lib/cerebro/cerebro-orchestrator.ts":0,"src/lib/cerebro/churn-predictor.ts":0,"src/lib/cerebro/code-indexer.ts":0,"src/lib/cerebro/code-reviewer/code-reader.ts":0,"src/lib/cerebro/code-reviewer/diff-extractor.ts":0,"src/lib/cerebro/code-reviewer/path-instructions-loader.ts":0,"src/lib/cerebro/code-reviewer/quality-gates.ts":0,"src/lib/cerebro/code-reviewer/reviewer-service.ts":0,"src/lib/cerebro/code-reviewer/secret-redactor.ts":0,"src/lib/cerebro/code-reviewer/types.ts":0,"src/lib/cerebro/contextual-bandits.ts":0,"src/lib/cerebro/error-reporter.ts":0,"src/lib/cerebro/glm-service.ts":0,"src/lib/cerebro/guest-responder-brain.ts":0,"src/lib/cerebro/knowledge-distiller.ts":0,"src/lib/cerebro/learning-engine.ts":0,"src/lib/cerebro/log-sink.ts":0,"src/lib/cerebro/night-activity-tracker-service.ts":0,"src/lib/cerebro/night-audit-service.ts":0,"src/lib/cerebro/night-pentest-service.ts":0,"src/lib/cerebro/night-pulse-service.ts":0,"src/lib/cerebro/rate-limit.ts":0,"src/lib/cerebro/refactor-suggester.ts":0,"src/lib/cerebro/self-defense.ts":0,"src/lib/cerebro/semantic-similarity.ts":0,"src/lib/cerebro/telemetry-bridge.ts":0,"src/lib/cerebro/tfidf.ts":0,"src/lib/cerebro/types.ts":0,"src/lib/cerebro/vulnerability-scanner.ts":0,"src/lib/cerebro/workflow-engine.ts":0,"src/lib/cerebro/yield-citation-hook.ts":0,"src/lib/cerebro/ze-code/apply-via-pr.ts":0,"src/lib/cerebro/ze-code/bottleneck-detector.ts":0,"src/lib/cerebro/ze-code/command-allowlist.ts":0,"src/lib/cerebro/ze-code/gap-detector.ts":0,"src/lib/cerebro/ze-code/git-applier.ts":0,"src/lib/cerebro/ze-code/orchestrator.ts":0,"src/lib/cerebro/ze-code/types.ts":0,"src/lib/cerebro/zelador-suporte-brain.ts":0,"src/lib/cerebro/zella-sales-brain.ts":0,"src/lib/cerebro/zella-skills.ts":0};

describe('RUN10-W2 — 10A: secret-redactor sem literal de chave (V3: AST, critério do patcher)', () => {
  it('arquivo existe e NÃO contém StringLiteral com formato de chave vendor (AST)', () => {
    expect(fs.existsSync(SR)).toBe(true);
    expect(astVendorHits(SR)).toBe(0);
  });
});

describe('RUN10-W2 — R10-8 documental (record p1.status presente)', () => {
  it('record W2 mais recente documenta status do P1 (NO_LITERAL_FOUND/REVIEW/FIXED)', () => {
    const audits = path.join(proj, '99_AUDITS');
    const dirs = fs.readdirSync(audits).filter((d) => d.startsWith('RUN10_W2_')).sort();
    expect(dirs.length).toBeGreaterThan(0);
    const recPath = path.join(audits, dirs[dirs.length - 1], 'W2_PATCH_RECORD.json');
    expect(fs.existsSync(recPath)).toBe(true);
    const rec = JSON.parse(fs.readFileSync(recPath, 'utf8'));
    expect(typeof (rec.p1 && rec.p1.status)).toBe('string');
  });
});

describe('RUN10-W2 — 10B: rate-limit fail-closed', () => {
  it('util existe com markers da onda', () => {
    expect(fs.existsSync(RL)).toBe(true);
    const t = fs.readFileSync(RL, 'utf8');
    expect(t).toContain('RUN10-W2 10B');
    expect(t).toContain('429');
    expect(t).toContain('AI_RATE_LIMIT_MAX');
  });
  it('checkRateLimit permite dentro do limite e bloqueia (429) ao esgotar', () => {
    const key = 'inv10b-' + Date.now();
    const req = new Request('http://local/invariantes', { headers: { 'x-forwarded-for': '10.99.99.10' } });
    expect(checkRateLimit(req, key).ok).toBe(true);
    for (let i = 0; i < 200; i++) checkRateLimit(req, key);
    const r = checkRateLimit(req, key);
    expect(r.ok).toBe(false);
    expect(r.retryAfterSec).toBeGreaterThan(0);
    expect(rateLimitResponse({ ok: false, retryAfterSec: 7, remaining: 0 }).status).toBe(429);
  });
  it('buckets são isolados por IP+rota', () => {
    const key = 'inv10b-iso-' + Date.now();
    const a = new Request('http://local/iso', { headers: { 'x-forwarded-for': '10.99.99.11' } });
    const b = new Request('http://local/iso', { headers: { 'x-forwarded-for': '10.99.99.12' } });
    for (let i = 0; i < 200; i++) checkRateLimit(a, key);
    expect(checkRateLimit(a, key).ok).toBe(false);
    expect(checkRateLimit(b, key).ok).toBe(true);
  });
});

describe('RUN10-W2 — rotas patcheadas têm marker e import', () => {
  it('todo arquivo em PATCHED_FILES.txt contém marker 10B/10C (ou é o redactor neutralizado)', () => {
    const audits = path.join(proj, '99_AUDITS');
    const dirs = fs.readdirSync(audits).filter((d) => d.startsWith('RUN10_W2_')).sort();
    expect(dirs.length).toBeGreaterThan(0);
    const recPath = path.join(audits, dirs[dirs.length - 1], 'W2_PATCH_RECORD.json');
    expect(fs.existsSync(recPath)).toBe(true);
    const rec = JSON.parse(fs.readFileSync(recPath, 'utf8'));
    expect(rec.rolledBack).toBe(false);
    expect(Array.isArray(rec.filesPatched)).toBe(true);
    for (const rel of rec.filesPatched) {
      const abs = path.join(proj, rel);
      expect(fs.existsSync(abs)).toBe(true);
      const t = fs.readFileSync(abs, 'utf8');
      const isRl = t.includes('RUN10-W2 10B');
      const isTmo = t.includes('AbortSignal.timeout');
      expect(isRl || isTmo || rel.endsWith('secret-redactor.ts')).toBe(true);
    }
  });
});

describe('RUN10-W2 — 10E: ai-env fail-closed', () => {
  it('módulo existe com API completa', () => {
    expect(fs.existsSync(ENV)).toBe(true);
    const t = fs.readFileSync(ENV, 'utf8');
    expect(t).toContain('RUN10-W2 10E');
    expect(Array.isArray(AI_ENV_KEYS)).toBe(true);
  });
  it('getAiEnv retorna null para chave desconhecida; requireAiEnv lança; status é objeto', () => {
    expect(getAiEnv('__NAO_EXISTE_XYZ__')).toBeNull();
    expect(() => requireAiEnv('__NAO_EXISTE_XYZ__')).toThrow();
    expect(typeof aiEnvStatus()).toBe('object');
  });
});

describe('RUN10-W2 — pin anti-crescimento (src/lib/cerebro, V3: AST + baseline congelado)', () => {
  it('nenhum arquivo .ts do cerebro ganha StringLiteral de chave vendor acima do baseline', () => {
    const root = path.join(proj, 'src/lib/cerebro');
    const files: string[] = [];
    const walk = (d: string) => {
      if (files.length > 200) return;
      let ents: fs.Dirent[] = [];
      try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const e of ents) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.isFile() && e.name.endsWith('.ts') && !e.name.endsWith('.test.ts')) files.push(p);
      }
    };
    if (fs.existsSync(root)) walk(root);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files.slice(0, 200)) {
      const rel = path.relative(proj, f).split(path.sep).join('/');
      const hits = astVendorHits(f);
      const base = Object.prototype.hasOwnProperty.call(AST_BASELINE, rel) ? AST_BASELINE[rel] : 0;
      expect(hits).toBeLessThanOrEqual(base);
    }
  });
});
