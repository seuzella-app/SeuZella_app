/**
 * SEUZELLA RUN19-A — suíte anti-regressão da HYGIENE (retry + transform + shadow + recon).
 * v2 (lição do RED RUN19_A_20260922_112020): a evidência tem que bater com a
 * REALIDADE DOS ARQUIVOS — não basta o JSON ser bonito. Esta suíte pega
 * exatamente a classe de bug que fechou a tentativa 1 em RED (evidência
 * afirmando "ssrf FIADO" para uma rota que o rollback fino do tsc reverteu).
 *
 * Valida contra a EVIDÊNCIA real (HYGIENE_WIRING_APPLIED.json +
 * HYGIENE_DECISIONS.json + HYGIENE_RECON.json) gerada pelos scripts do kit:
 *  - aritmética: 13 arquivos processados fecham com os status declarados;
 *  - cada arquivo WIRED (retry/transform) tem exatamente 1 guardRequest + 1
 *    auditRouteEvent + o import da wiring + marcador RUN19-A;
 *  - cada arquivo NÃO fiado (DEFERRED, DEFERRED_TSC, MISSING) está LIMPO
 *    (rollback fino deixou o arquivo como o HEAD: sem import, sem marcador);
 *  - TRIANGULAÇÃO DO SSRF: evid.ssrf.wired <=> rota proxy WIRED com ssrf
 *    <=> import/chamada ssrfGuard presentes (ou ausentes) no ARQUIVO real;
 *  - cada arquivo SHADOW_WIRED tem requireInternalSecret + import + chamada
 *    ANTES do bloco RUN18 (ordem: segredo primeiro); shadows não aplicados
 *    ficam limpos;
 *  - módulos novos existem e exportam o contrato (ssrfGuard /
 *    requireInternalSecret);
 *  - wiring-registry.ts evoluiu para version RUN19-A com a onda RUN19-A
 *    FECHANDO com wiredRouteIds da evidência (ondas anteriores preservadas);
 *  - teste do RUN18 atualizado para registry por onda;
 *  - diferidos continuam com motivo registrado (fail-safe preservado).
 *
 * Env overrides (sandbox E2E): SZ_RUN19_SRC_ROOT, SZ_RUN19_EVID_JSON.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function repoRoot(): string {
  if (process.env.SZ_RUN19_SRC_ROOT) return process.env.SZ_RUN19_SRC_ROOT;
  return process.cwd();
}
function evidDir(): string {
  const root = repoRoot();
  const dir = path.join(root, '99_AUDITS');
  const candidates = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((d) => d.startsWith('RUN19_A_')).sort()
    : [];
  expect(candidates.length, '99_AUDITS/RUN19_A_* ausente — rode o kit primeiro').toBeGreaterThan(0);
  return path.join(dir, candidates[candidates.length - 1]);
}
function evidJsonPath(): string {
  if (process.env.SZ_RUN19_EVID_JSON) return process.env.SZ_RUN19_EVID_JSON;
  return path.join(evidDir(), 'HYGIENE_WIRING_APPLIED.json');
}

interface Applied {
  schema: string;
  wireFiles: Record<string, { status: string; reason?: string; routeId?: string; prioridade?: string; via?: string; policy?: { points: number; windowMs: number }; ssrf?: { wired?: boolean; targetVar?: string; reason?: string } | null }>;
  shadowFiles: Record<string, { status: string; reason?: string; param?: string }>;
  modulesInstalled: string[];
  ssrf: { wired: boolean; targetVar: string | null; note: string };
  items?: unknown[];
  registryPath: string;
  registryPrevVersion: string;
  retryItems: number;
  wiredRouteIds: string[];
  run18TestPatched: boolean;
  tscRounds: number;
}

const evid: Applied = JSON.parse(fs.readFileSync(evidJsonPath(), 'utf8'));
const root = repoRoot();

function countOccurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

const NOT_WIRED = ['DEFERRED', 'DEFERRED_TSC', 'MISSING'];

describe('RUN19-A: HYGIENE (retry expandido + transform + shadow interno + módulos)', () => {
  it('evidência fecha (retry declarado = arquivos processados; registry herdado do RUN18-A)', () => {
    expect(evid.schema).toBe('RUN19_HYGIENE_WIRING_APPLIED/v1');
    expect(evid.retryItems).toBeGreaterThan(0);
    expect(evid.registryPrevVersion).toBe('RUN18-A');
    expect(evid.modulesInstalled).toContain('src/lib/infra/ssrf-guard.ts');
    expect(evid.modulesInstalled).toContain('src/lib/infra/internal-secret.ts');
  });

  it('aritmética: todos os arquivos do retry aparecem e os status somam', () => {
    const statuses = Object.values(evid.wireFiles).map((s) => s.status);
    expect(Object.keys(evid.wireFiles).length, 'wireFiles deve cobrir todos os itens do retry').toBe(evid.retryItems);
    const valid = statuses.filter((s) => ['WIRED', 'ALREADY_WIRED', 'DEFERRED', 'DEFERRED_TSC', 'MISSING'].includes(s));
    expect(valid.length, 'status não reconhecido em wireFiles').toBe(evid.retryItems);
    const wired = statuses.filter((s) => s === 'WIRED').length;
    expect(evid.wiredRouteIds.length, 'wiredRouteIds deve fechar com os WIRED').toBe(wired);
  });

  it('módulos novos existem e exportam o contrato', () => {
    const ssrf = fs.readFileSync(path.join(root, 'src/lib/infra/ssrf-guard.ts'), 'utf8');
    expect(ssrf).toContain('export function ssrfGuard');
    expect(ssrf).toContain('PROXY_ALLOWLIST');
    expect(ssrf).toContain('SZ_SSRF_ENFORCE');
    const isec = fs.readFileSync(path.join(root, 'src/lib/infra/internal-secret.ts'), 'utf8');
    expect(isec).toContain('export function requireInternalSecret');
    expect(isec).toContain('INTERNAL_SECRET');
    expect(isec).toContain('SZ_ENFORCE_INTERNAL');
  });

  it('wiring-registry.ts: version RUN19-A + ondas preservadas + nova onda RUN19-A', () => {
    const regPath = path.join(root, evid.registryPath);
    expect(fs.existsSync(regPath), `${evid.registryPath} ausente`).toBe(true);
    const reg = fs.readFileSync(regPath, 'utf8');
    expect(reg).toContain("version: 'RUN19-A'");
    expect(reg).toContain('export function w2Status()');
    expect(reg).toContain("{ wave: 'RUN11-W3'");
    expect(reg).toContain("{ wave: 'RUN13-A'");
    expect(reg).toContain("{ wave: 'RUN14-A'");
    expect(reg).toContain("{ wave: 'RUN18-A'");
    expect(reg).toContain("{ wave: 'RUN19-A'");
  });

  it('registry: onda RUN19-A fecha EXATAMENTE com os wiredRouteIds da evidência', () => {
    const reg = fs.readFileSync(path.join(root, evid.registryPath), 'utf8');
    const m = reg.match(/\{\s*wave:\s*'RUN19-A'\s*,\s*wired:\s*(\[[^\n]*\])\s*\}/);
    expect(m, 'onda RUN19-A parseável no registry').toBeTruthy();
    const arr = JSON.parse((m as RegExpMatchArray)[1].replace(/'/g, '"')) as string[];
    expect([...arr].sort()).toEqual([...evid.wiredRouteIds].sort());
  });

  it('cada arquivo WIRED (retry/transform) tem exatamente 1 guardRequest + 1 auditRouteEvent + import + marcador RUN19-A', () => {
    const wired = Object.entries(evid.wireFiles).filter(([, st]) => st.status === 'WIRED');
    expect(wired.length, 'deve haver rotas WIRED no retry').toBeGreaterThan(0);
    for (const [rel, st] of wired) {
      const src = fs.readFileSync(path.join(root, rel), 'utf8');
      const routeId = (st as { routeId?: string }).routeId as string;
      expect(src, `${rel}: import da wiring ausente`).toContain(
        "import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';"
      );
      expect(countOccurrences(src, 'guardRequest(')).toBe(1);
      expect(countOccurrences(src, 'auditRouteEvent(')).toBe(1);
      expect(src).toContain(`'${routeId}'`);
      expect(src).toMatch(/RUN19-A \(HYGIENE\): anti-flood/);
      if (st.via === 'transform') {
        expect(src, `${rel}: transform deve ter introduzido request: Request`).toContain('request: Request');
      }
    }
  });

  it('rollback fino limpo: arquivos NÃO fiados estão como o HEAD (sem import W2, sem marcador RUN19-A)', () => {
    for (const [rel, st] of Object.entries(evid.wireFiles)) {
      if (!NOT_WIRED.includes(st.status)) continue; // ALREADY_WIRED tem import de onda anterior — legítimo
      if (!fs.existsSync(path.join(root, rel))) continue; // MISSING: nada a conferir
      const src = fs.readFileSync(path.join(root, rel), 'utf8');
      expect(src, `${rel} (${st.status}): import da wiring sobreviveu ao rollback?`).not.toContain("from '@/lib/infra/wiring';");
      expect(src, `${rel} (${st.status}): marcador RUN19-A sobreviveu ao rollback?`).not.toContain('RUN19-A (HYGIENE)');
    }
    for (const [rel, st] of Object.entries(evid.shadowFiles)) {
      if (st.status === 'SHADOW_WIRED' || st.status === 'ALREADY_SHADOW') continue;
      if (!fs.existsSync(path.join(root, rel))) continue;
      const src = fs.readFileSync(path.join(root, rel), 'utf8');
      expect(src, `${rel} (${st.status}): requireInternalSecret sobreviveu ao rollback?`).not.toContain('requireInternalSecret(');
      expect(src, `${rel} (${st.status}): import do internal-secret sobreviveu ao rollback?`).not.toContain("from '@/lib/infra/internal-secret';");
    }
  });

  it('TRIANGULAÇÃO DO SSRF: evidência <=> rota proxy <=> arquivo real (lição do RED 112020)', () => {
    const proxyEntry = Object.entries(evid.wireFiles).find(([rel]) => rel.includes('proxy'));
    const proxyRec = proxyEntry ? (proxyEntry[1] as { status: string; ssrf?: { wired?: boolean; targetVar?: string } | null }) : null;
    const proxyWired = !!(proxyEntry && proxyRec!.status === 'WIRED' && proxyRec!.ssrf && proxyRec!.ssrf.wired);

    if (evid.ssrf.wired) {
      expect(proxyWired, 'evid.ssrf.wired=true exige proxy WIRED com ssrf.wired (não pode sobrar de rollback fino)').toBe(true);
      const src = fs.readFileSync(path.join(root, proxyEntry![0]), 'utf8');
      expect(src).toContain("import { ssrfGuard } from '@/lib/infra/ssrf-guard';");
      expect(src).toContain(`ssrfGuard(${evid.ssrf.targetVar})`);
      expect(src).toMatch(/RUN19-A \(HYGIENE\): allowlist SSRF/);
    } else if (proxyEntry) {
      const src = fs.readFileSync(path.join(root, proxyEntry[0]), 'utf8');
      expect(src, 'proxy não fiado: arquivo real não pode ter ssrfGuard (rollback limpo)').not.toContain("from '@/lib/infra/ssrf-guard';");
      expect(src, 'proxy não fiado: arquivo real não pode chamar ssrfGuard').not.toContain('ssrfGuard(');
    }

    if (proxyRec && proxyRec.ssrf && proxyRec.ssrf.wired) {
      expect(evid.ssrf.wired, 'registro por-rota do ssrf exige evid.ssrf.wired=true (uma fonte só de verdade)').toBe(true);
    }
  });

  it('cada arquivo SHADOW_WIRED tem requireInternalSecret + import + chamada antes do bloco RUN18', () => {
    const shadow = Object.entries(evid.shadowFiles).filter(([, st]) => st.status === 'SHADOW_WIRED');
    expect(shadow.length, 'deve haver rotas SHADOW_WIRED').toBeGreaterThan(0);
    for (const [rel] of shadow) {
      const src = fs.readFileSync(path.join(root, rel), 'utf8');
      expect(src).toContain("import { requireInternalSecret } from '@/lib/infra/internal-secret';");
      expect(countOccurrences(src, 'requireInternalSecret(')).toBe(1);
      expect(src).toMatch(/RUN19-A \(HYGIENE\): segredo interno em modo sombra/);
      expect(src.indexOf('requireInternalSecret(')).toBeLessThan(src.indexOf('// RUN18-A (W2/MOP-UP): anti-flood'));
    }
  });

  it('teste do RUN18 atualizado para registry por onda', () => {
    expect(evid.run18TestPatched, 'run18TestPatched deve ser true').toBe(true);
    const t = fs.readFileSync(path.join(root, 'tests/security/run18-mopup.test.ts'), 'utf8');
    expect(t).toContain("version: 'RUN1\\d-A'");
    expect(t).toContain("{ wave: 'RUN18-A'");
  });

  it('nenhum arquivo tocado recebeu fiação dupla (idempotência estrutural)', () => {
    for (const [rel] of Object.entries(evid.wireFiles)) {
      const src = fs.readFileSync(path.join(root, rel), 'utf8');
      expect(countOccurrences(src, "from '@/lib/infra/wiring';"), `${rel}`).toBeLessThanOrEqual(1);
    }
  });

  it('diferidos e shadows não aplicados têm motivo; onda RUN19-A fecha com os routeIds', () => {
    for (const [rel, st] of Object.entries(evid.wireFiles)) {
      if (['DEFERRED', 'DEFERRED_TSC', 'MISSING', 'ALREADY_WIRED'].includes(st.status)) {
        expect(st.reason, `${rel}: motivo ausente`).toBeTruthy();
      }
    }
    for (const [rel, st] of Object.entries(evid.shadowFiles)) {
      if (st.status !== 'SHADOW_WIRED') {
        expect(st.reason, `${rel}: motivo ausente`).toBeTruthy();
      }
    }
    const wired = Object.values(evid.wireFiles).filter((st) => st.status === 'WIRED');
    expect(evid.wiredRouteIds.length).toBe(wired.length);
  });
});
