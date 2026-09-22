/**
 * SEUZELLA RUN18-A — suíte anti-regressão do MOP-UP (fiação W2 P1+P2).
 *
 * Valida contra a EVIDÊNCIA real (MOPUP_WIRING_APPLIED.json + MOPUP_DECISIONS.json)
 * gerada pelo mopup_wire.js/mopup_decisions.js:
 *  - cada arquivo WIRED tem exatamente 1 guardRequest + 1 auditRouteEvent +
 *    o import da wiring + marcador RUN18-A;
 *  - wiring-registry.ts evoluiu para version RUN18-A com a onda RUN18-A
 *    fechando com a evidência (e ondas anteriores preservadas);
 *  - P3 documentadas continuam SEM import de wiring (zero código);
 *  - teste do RUN14 atualizado para registry por onda;
 *  - sem fiação dupla em nenhum arquivo tocado;
 *  - diferidos (DEFERRED/DEFERRED_TSC/MISSING) têm motivo registrado.
 *
 * Env overrides (sandbox E2E): SZ_RUN18_EVID_JSON, SZ_RUN18_SRC_ROOT.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function repoRoot(): string {
  if (process.env.SZ_RUN18_SRC_ROOT) return process.env.SZ_RUN18_SRC_ROOT;
  return process.cwd();
}
function evidDir(): string {
  const root = repoRoot();
  const dir = path.join(root, '99_AUDITS');
  const candidates = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((d) => d.startsWith('RUN18_A_')).sort()
    : [];
  expect(candidates.length, '99_AUDITS/RUN18_A_* ausente — rode o kit primeiro').toBeGreaterThan(0);
  return path.join(dir, candidates[candidates.length - 1]);
}
function evidJsonPath(): string {
  if (process.env.SZ_RUN18_EVID_JSON) return process.env.SZ_RUN18_EVID_JSON;
  return path.join(evidDir(), 'MOPUP_WIRING_APPLIED.json');
}

interface Applied {
  schema: string;
  files: Record<string, { status: string; reason?: string; routeId?: string; prioridade?: string; policy?: { points: number; windowMs: number } }>;
  items: Array<{ rel: string; prioridade: string; status: string }>;
  documentP3: string[];
  nochangeP4: string[];
  registryPath: string;
  registryPrevVersion: string;
  wireItems: number;
  uniqueFiles: number;
  run14TestPatched: boolean;
}

const evid: Applied = JSON.parse(fs.readFileSync(evidJsonPath(), 'utf8'));
const root = repoRoot();

function countOccurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

describe('RUN18-A: MOP-UP (fiação W2 P1+P2 do veredito RED TEAM)', () => {
  it('evidência fecha (itens WIRE -> arquivos únicos; P3/P4 registradas)', () => {
    expect(evid.schema).toBe('RUN18_MOPUP_WIRING_APPLIED/v1');
    expect(evid.wireItems).toBeGreaterThan(0);
    expect(evid.uniqueFiles).toBeLessThanOrEqual(evid.wireItems);
    expect(evid.documentP3.length).toBe(7);
    expect(evid.nochangeP4.length).toBe(6);
  });

  it('wiring-registry.ts: version RUN18-A + w2Status() + ondas preservadas + nova onda RUN18-A', () => {
    const regPath = path.join(root, evid.registryPath);
    expect(fs.existsSync(regPath), `${evid.registryPath} ausente`).toBe(true);
    const reg = fs.readFileSync(regPath, 'utf8');
    expect(reg).toContain("version: 'RUN18-A'");
    expect(reg).toContain('export function w2Status()');
    expect(reg).toContain("{ wave: 'RUN11-W3'");
    expect(reg).toContain("{ wave: 'RUN13-A'");
    expect(reg).toContain("{ wave: 'RUN14-A'");
    expect(reg).toContain("{ wave: 'RUN18-A'");
  });

  it('cada arquivo WIRED desta onda tem exatamente 1 guardRequest + 1 auditRouteEvent + import + marcador RUN18-A', () => {
    const wired = Object.entries(evid.files).filter(([rel, st]) => st.status === 'WIRED');
    expect(wired.length, 'deve haver rotas WIRED nesta onda').toBeGreaterThan(0);
    for (const [rel, st] of wired) {
      const src = fs.readFileSync(path.join(root, rel), 'utf8');
      const routeId = (st as { routeId?: string }).routeId as string;
      expect(src, `${rel}: import da wiring ausente`).toContain(
        "import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';"
      );
      expect(countOccurrences(src, 'guardRequest(')).toBe(1);
      expect(countOccurrences(src, 'auditRouteEvent(')).toBe(1);
      expect(src).toContain(`'${routeId}'`);
      expect(src).toMatch(/RUN18-A \(W2\/MOP-UP\): anti-flood/);
      const pol = (st as { policy?: { points: number } }).policy;
      if (pol && pol.points === 120) {
        expect(src).toContain('points: 120');
      }
    }
  });

  it('P3 documentadas continuam SEM fiação (zero código tocado nelas)', () => {
    expect(evid.documentP3.length).toBeGreaterThan(0);
    for (const rel of evid.documentP3) {
      const src = fs.readFileSync(path.join(root, rel), 'utf8');
      expect(src, `${rel} não deveria ter import de wiring`).not.toContain(
        "import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';"
      );
    }
  });

  it('teste do RUN14 atualizado para registry por onda', () => {
    expect(evid.run14TestPatched, 'run14TestPatched deve ser true').toBe(true);
    const t = fs.readFileSync(path.join(root, 'tests/security/run14-wiring-lote23.test.ts'), 'utf8');
    expect(t).toContain("version: 'RUN1\\d-A'");
    expect(t).toContain("{ wave: 'RUN14-A'");
  });

  it('nenhum arquivo recebeu fiação dupla (idempotência estrutural)', () => {
    for (const [rel] of Object.entries(evid.files)) {
      const src = fs.readFileSync(path.join(root, rel), 'utf8');
      expect(countOccurrences(src, "from '@/lib/infra/wiring';"), `${rel}`).toBeLessThanOrEqual(1);
    }
  });

  it('SKIP_JUSTIFIED/DEFERRED/DEFERRED_TSC/MISSING/ALREADY_WIRED têm motivo; items fecham com files', () => {
    for (const [rel, st] of Object.entries(evid.files)) {
      if (['SKIP_JUSTIFIED', 'DEFERRED', 'DEFERRED_TSC', 'ALREADY_WIRED', 'MISSING'].includes(st.status)) {
        expect(st.reason, `${rel}: motivo ausente`).toBeTruthy();
      }
    }
    for (const it of evid.items) {
      expect(evid.files[it.rel], `item sem arquivo: ${it.rel}`).toBeTruthy();
      expect(it.status).toBe(evid.files[it.rel].status);
    }
  });
});
