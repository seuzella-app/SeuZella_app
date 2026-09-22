/**
 * SEUZELLA RUN13-A — suíte anti-regressão da fiação do Lote 1.
 *
 * Valida contra a EVIDÊNCIA real (WIRING_LOTE1_APPLIED.json) gerada pelo
 * wire_lote1.js: cada arquivo WIRED precisa ter exatamente 1 guardRequest +
 * 1 auditRouteEvent + o import da wiring; health precisa do payload
 * security: w2Status(); registry precisa existir e fechar com a evidência.
 * Diferidos (DEFERRED/DEFERRED_TSC) precisam de motivo registrado.
 *
 * Env overrides (sandbox E2E): SZ_RUN13_EVID_JSON, SZ_RUN13_SRC_ROOT.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function repoRoot(): string {
  if (process.env.SZ_RUN13_SRC_ROOT) return process.env.SZ_RUN13_SRC_ROOT;
  return process.cwd();
}
function evidJsonPath(): string {
  if (process.env.SZ_RUN13_EVID_JSON) return process.env.SZ_RUN13_EVID_JSON;
  const root = repoRoot();
  const dir = path.join(root, '99_AUDITS');
  const candidates = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((d) => d.startsWith('RUN13_A_')).sort()
    : [];
  expect(candidates.length, '99_AUDITS/RUN13_A_* ausente — rode o kit primeiro').toBeGreaterThan(0);
  return path.join(dir, candidates[candidates.length - 1], 'WIRING_LOTE1_APPLIED.json');
}

interface Applied {
  files: Record<string, { status: string; reason?: string; routeId?: string; policy?: { points: number; windowMs: number } }>;
  items: Array<{ targetRoute: string; status: string; module?: string }>;
  registryPath: string;
  lote1Items: number;
  uniqueFiles: number;
}

const evid: Applied = JSON.parse(fs.readFileSync(evidJsonPath(), 'utf8'));
const root = repoRoot();

function countOccurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

describe('RUN13-A: fiação do Lote 1 (W2 guard+audit) e payload W2 no /api/health', () => {
  it('evidência fecha com o esperado (12 itens -> arquivos únicos dedupados)', () => {
    expect(evid.lote1Items).toBe(12);
    expect(evid.uniqueFiles).toBeLessThanOrEqual(12);
    expect(Object.keys(evid.files).length).toBeGreaterThanOrEqual(evid.uniqueFiles);
  });

  it('wiring-registry.ts existe, tem versão RUN13-A e w2Status()', () => {
    const regPath = path.join(root, evid.registryPath);
    expect(fs.existsSync(regPath), `${evid.registryPath} ausente`).toBe(true);
    const reg = fs.readFileSync(regPath, 'utf8');
    expect(reg).toMatch(/version: 'RUN1\d-A'/); // registry evolui por onda (RUN14+)
    expect(reg).toContain("{ wave: 'RUN13-A'");
    expect(reg).toContain('export function w2Status()');
    expect(reg).toContain('RUN11-W3');
  });

  it('/api/health contém o payload W2 (security: w2Status()) quando WIRED', () => {
    const st = evid.files['src/app/api/health/route.ts'];
    expect(st, 'health não processado').toBeTruthy();
    const src = fs.readFileSync(path.join(root, 'src/app/api/health/route.ts'), 'utf8');
    if (st.status === 'WIRED') {
      expect(countOccurrences(src, 'w2Status')).toBeGreaterThanOrEqual(2); // import + uso
      expect(src).toContain('security: w2Status()');
    } else {
      expect(st.reason, 'diferido precisa de motivo').toBeTruthy();
    }
  });

  it('cada arquivo WIRED tem exatamente 1 guardRequest + 1 auditRouteEvent + import', () => {
    const wired = Object.entries(evid.files).filter(
      ([rel, st]) => st.status === 'WIRED' && rel !== 'src/app/api/health/route.ts'
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
      expect(src).toMatch(/RUN13-A \(W2\): anti-flood/);
    }
  });

  it('nenhum arquivo recebeu fiação dupla (idempotência estrutural)', () => {
    for (const [rel, st] of Object.entries(evid.files)) {
      if (st.status !== 'WIRED') continue;
      const src = fs.readFileSync(path.join(root, rel), 'utf8');
      expect(countOccurrences(src, "from '@/lib/infra/wiring';"), `${rel}`).toBeLessThanOrEqual(1);
    }
  });

  it('SKIP_JUSTIFIED e DEFERRED têm motivo registrado; items fecham com files', () => {
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
