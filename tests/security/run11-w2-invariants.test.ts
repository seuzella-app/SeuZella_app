import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as ts from 'typescript';

/**
 * RUN11-W2 — invariantes estruturais da camada de infra (lição RUN10-V3):
 * a avaliação de segredos usa O MESMO critério do patcher V1 (AST — apenas
 * StringLiteral / NoSubstitutionTemplateLiteral contam; comentário, regex e
 * template com expressão NÃO são segredo em código executável).
 *
 * Fechaduras:
 *  1. Zero literal-vendor em strings de src/lib/infra (anti-crescimento).
 *  2. NENHUM import/require estático de 'ioredis' (Redis é opcional via
 *     importOptional; import estático quebraria o build sem o pacote).
 *  3. Nenhuma URL redis:// hardcoded (REDIS_URL só via process.env).
 *  4. Manifesto dos 6 módulos presente (anti-remoção silenciosa).
 */

const proj = process.cwd();
const INFRA_DIR = path.join(proj, 'src', 'lib', 'infra');

const EXPECTED_MODULES = [
  'optional-require.ts',
  'cache.ts',
  'queue.ts',
  'rate-limit.ts',
  'audit.ts',
  'health.ts',
];

const VENDOR_SECRET_RE = /sk-[A-Za-z0-9_-]{16,}|eyJ[A-Za-z0-9_-]{10,}|AIza[0-9A-Za-z_-]{20,}|gsk_[A-Za-z0-9_-]{10,}/;

function listInfraFiles(): string[] {
  expect(fs.existsSync(INFRA_DIR), 'src/lib/infra existe (camada RUN11-W2 montada)').toBe(true);
  return fs
    .readdirSync(INFRA_DIR)
    .filter((f) => f.endsWith('.ts'))
    .sort();
}

function collectStringLiterals(sf: ts.SourceFile): string[] {
  const out: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node)
    ) {
      out.push(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

describe('RUN11-W2 invariants — camada infra AST-aligned', () => {
  it('manifesto: os 6 módulos da camada existem (nada removido silenciosamente)', () => {
    const files = listInfraFiles();
    for (const m of EXPECTED_MODULES) {
      expect(files, `módulo ${m} presente`).toContain(m);
    }
  });

  it('zero literal-vendor em strings dos módulos (mesmo critério AST do patcher RUN10-V3)', () => {
    for (const f of listInfraFiles()) {
      const src = fs.readFileSync(path.join(INFRA_DIR, f), 'utf8');
      const sf = ts.createSourceFile(f, src, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
      const literals = collectStringLiterals(sf);
      const bad = literals.filter((l) => VENDOR_SECRET_RE.test(l));
      expect(bad, `${f} contém literal-vendor em StringLiteral: ${JSON.stringify(bad)}`).toEqual([]);
    }
  });

  it('sem import/require estático de ioredis (opcionalidade é invariante de build)', () => {
    const staticImportRe = /(^|\n)\s*(import\s+[^;]*from\s+['"]ioredis['"]|const\s+\w+\s*=\s*require\(\s*['"]ioredis['"]\s*\))/;
    const dynamicViaHelperRe = /return\s+import\(m\);/;
    for (const f of listInfraFiles()) {
      const src = fs.readFileSync(path.join(INFRA_DIR, f), 'utf8');
      expect(staticImportRe.test(src), `${f} importa ioredis estaticamente`).toBe(false);
      if (f === 'optional-require.ts') {
        expect(dynamicViaHelperRe.test(src), 'helper opaco presente').toBe(true);
      }
    }
  });

  it('nenhuma redis:// hardcoded — REDIS_URL somente via process.env', () => {
    for (const f of listInfraFiles()) {
      const src = fs.readFileSync(path.join(INFRA_DIR, f), 'utf8');
      const sf = ts.createSourceFile(f, src, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
      for (const lit of collectStringLiterals(sf)) {
        expect(lit.startsWith('redis://'), `${f}: URL redis hardcoded em string literal`).toBe(false);
      }
    }
  });

  it('fio do fail-closed: rate-limit declara modo closed como default', () => {
    const src = fs.readFileSync(path.join(INFRA_DIR, 'rate-limit.ts'), 'utf8');
    expect(src.includes("'closed'")).toBe(true);
    expect(src.includes('STORE_UNAVAILABLE')).toBe(true);
  });
});
