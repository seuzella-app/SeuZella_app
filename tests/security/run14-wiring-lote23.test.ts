/**
 * SEUZELLA RUN14-A — suíte anti-regressão da fiação do Lote 2/3 + mop-up health.
 *
 * Valida contra a EVIDÊNCIA real (WIRING_LOTE23_APPLIED.json) gerada pelo
 * wire_lote23.js: cada arquivo WIRED precisa ter exatamente 1 guardRequest +
 * 1 auditRouteEvent + o import da wiring; health precisa do payload
 * security: w2Status() quando WIRED; registry precisa existir na versão
 * RUN14-A com as ondas RUN13-A e RUN14-A fechando com a evidência; o teste
 * do RUN13 precisa ter sido atualizado para registry por onda; e o Lote 1
 * do RUN13 precisa permanecer íntegro (sem fiação dupla).
 * Diferidos (DEFERRED/DEFERRED_TSC/MISSING) precisam de motivo registrado.
 *
 * Env overrides (sandbox E2E): SZ_RUN14_EVID_JSON, SZ_RUN14_SRC_ROOT.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function repoRoot(): string {
  if (process.env.SZ_RUN14_SRC_ROOT) return process.env.SZ_RUN14_SRC_ROOT;
  return process.cwd();
}
function evidJsonPath(): string {
  if (process.env.SZ_RUN14_EVID_JSON) return process.env.SZ_RUN14_EVID_JSON;
  const root = repoRoot();
  const dir = path.join(root, '99_AUDITS');
  const candidates = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((d) => d.startsWith('RUN14_A_')).sort()
    : [];
  expect(candidates.length, '99_AUDITS/RUN14_A_* ausente — rode o kit primeiro').toBeGreaterThan(0);
  return path.join(dir, candidates[candidates.length - 1], 'WIRING_LOTE23_APPLIED.json');
}
function run13EvidPath(): string {
  const root = repoRoot();
  const dir = path.join(root, '99_AUDITS');
  const candidates = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((d) => d.startsWith('RUN13_A_')).sort()
    : [];
  expect(candidates.length, '99_AUDITS/RUN13_A_* ausente — o RUN13 precisa vir antes').toBeGreaterThan(0);
  return path.join(dir, candidates[candidates.length - 1], 'WIRING_LOTE1_APPLIED.json');
}

interface Applied {
  files: Record<string, { status: string; reason?: string; routeId?: string; policy?: { points: number; windowMs: number } }>;
  items: Array<{ targetRoute: string; status: string; module?: string }>;
  registryPath: string;
  pendingItems: number;
  uniqueFiles: number;
  run13TestPatched: boolean;
}

const evid: Applied = JSON.parse(fs.readFileSync(evidJsonPath(), 'utf8'));
const ev13 = JSON.parse(fs.readFileSync(run13EvidPath(), 'utf8')) as {
  files: Record<string, { status: string }>;
};
const root = repoRoot();
const HEALTH_REL = 'src/app/api/health/route.ts';

function countOccurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

describe('RUN14-A: fiação do Lote 2/3 (W2 guard+audit) e mop-up do payload W2 no /api/health', () => {
  it('evidência fecha (itens pendentes -> arquivos únicos dedupados)', () => {
    expect(evid.pendingItems).toBeGreaterThan(0);
    expect(evid.uniqueFiles).toBeLessThanOrEqual(evid.pendingItems);
    expect(Object.keys(evid.files).length).toBeGreaterThanOrEqual(evid.uniqueFiles);
  });

  it('teste do RUN13 atualizado para registry por onda', () => {
    expect(evid.run13TestPatched, 'run13TestPatched deve ser true').toBe(true);
    const t = fs.readFileSync(path.join(root, 'tests/security/run13-wiring-lote1.test.ts'), 'utf8');
    expect(t).toContain("version: 'RUN1\\d-A'");
    expect(t).toContain("{ wave: 'RUN13-A'");
  });

  it('wiring-registry.ts: version RUN14-A + w2Status() + ondas RUN11-W3/RUN13-A/RUN14-A', () => {
    const regPath = path.join(root, evid.registryPath);
    expect(fs.existsSync(regPath), `${evid.registryPath} ausente`).toBe(true);
    const reg = fs.readFileSync(regPath, 'utf8');
    expect(reg).toMatch(/version: 'RUN1\d-A'/); // registry evolui por onda (RUN18+)
    expect(reg).toContain("{ wave: 'RUN14-A'");
    expect(reg).toContain('export function w2Status()');
    expect(reg).toContain('RUN11-W3');
    expect(reg).toContain("{ wave: 'RUN13-A'");
    expect(reg).toContain("{ wave: 'RUN14-A'");
  });

  it('/api/health contém o payload W2 (security: w2Status()) quando WIRED', () => {
    const st = evid.files[HEALTH_REL];
    expect(st, 'health não processado').toBeTruthy();
    const src = fs.readFileSync(path.join(root, HEALTH_REL), 'utf8');
    if (st.status === 'WIRED') {
      expect(countOccurrences(src, 'w2Status')).toBeGreaterThanOrEqual(2); // import + uso
      expect(src).toContain('security: w2Status()');
    } else {
      expect(st.reason, 'diferido precisa de motivo').toBeTruthy();
    }
  });

  it('cada arquivo WIRED desta onda tem exatamente 1 guardRequest + 1 auditRouteEvent + import', () => {
    const wired = Object.entries(evid.files).filter(
      ([rel, st]) => st.status === 'WIRED' && rel !== HEALTH_REL
    );
    expect(Array.isArray(wired)).toBe(true);
    for (const [rel, st] of wired) {
      const src = fs.readFileSync(path.join(root, rel), 'utf8');
      const routeId = (st as { routeId?: string }).routeId as string;
      expect(src, `${rel}: import da wiring ausente`).toContain(
        "import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';"
      );
      expect(countOccurrences(src, 'guardRequest(')).toBe(1);
      expect(countOccurrences(src, 'auditRouteEvent(')).toBe(1);
      expect(src).toContain(`'${routeId}'`);
      expect(src).toMatch(/RUN14-A \(W2\): anti-flood/);
    }
  });

  it('Lote 1 do RUN13 permanece íntegro — sem fiação dupla', () => {
    for (const [rel, st] of Object.entries(ev13.files || {})) {
      if (st.status !== 'WIRED' || rel === HEALTH_REL) continue;
      const src = fs.readFileSync(path.join(root, rel), 'utf8');
      expect(countOccurrences(src, "from '@/lib/infra/wiring';"), rel).toBe(1);
      expect(countOccurrences(src, 'guardRequest('), rel).toBe(1);
    }
  });

  it('nenhum arquivo recebeu fiação dupla nesta onda (idempotência estrutural)', () => {
    for (const [rel, st] of Object.entries(evid.files)) {
      if (st.status !== 'WIRED') continue;
      const src = fs.readFileSync(path.join(root, rel), 'utf8');
      expect(countOccurrences(src, "from '@/lib/infra/wiring';"), `${rel}`).toBeLessThanOrEqual(1);
    }
  });

  it('SKIP_JUSTIFIED/DEFERRED/DEFERRED_TSC/MISSING têm motivo; items fecham com files', () => {
    for (const [rel, st] of Object.entries(evid.files)) {
      if (['SKIP_JUSTIFIED', 'DEFERRED', 'DEFERRED_TSC', 'ALREADY_WIRED', 'MISSING'].includes(st.status)) {
        expect(st.reason, `${rel}: motivo ausente`).toBeTruthy();
      }
    }
    for (const it of evid.items) {
      expect(evid.files[it.targetRoute], `item sem arquivo: ${it.targetRoute}`).toBeTruthy();
      expect(it.status).toBe(evid.files[it.targetRoute].status);
    }
  });
});
