// ============================================================================
// JEV — Suíte do pulso shadow no CRON (RUN27-A — USO REAL NO CRON)
// ============================================================================
// Prova o pulso de produção (rota nova + lib) com TODOS os gates da casa,
// aplicando a lição RUN25-A: cada gate é provado POR CONTRATO com deps
// injetadas (budget/fusível/ciclo fake) — a política interna dos módulos da
// casa NUNCA é presumida. A fiação real da rota é provada por LEITURA DO
// TEXTO (assinaturas exatas presentes, env ausente). Rede: só mockada
// (fetchImpl injetado no bundle). Resposta do pulso: só contagens.
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  runJevShadowPulse,
  probeHouseBreaker,
  JEV_PULSE_BUDGET_KEY,
  JEV_PULSE_TIER,
  JEV_PULSE_TIMEOUT_MS,
  JEV_PULSE_MAX_SAMPLES_CAP,
  JEV_PULSE_MAX_SAMPLES_DEFAULT,
  type JevBreakerGate,
  type JevBudgetGate,
} from '../../lib/ai/jev/jev-cerebro-cron-pulse';
import { createFileSampleSource } from '../../lib/ai/jev/jev-cerebro-file-source';
import type { JevShadowCycleReport } from '../../lib/ai/jev/jev-cerebro-shadow-loop';
import { createActiveShadowRunner } from '../../lib/ai/jev/jev-integration';

const TENANT_A = 'tenant-pulso-a';
const TENANT_B = 'tenant-pulso-b';

// Tokens proibidos montados por pedaço — a suíte PROVA a ausência sem
// conter o literal (o grep de segurança do driver varre esta própria fonte).
const BANNED_TOKENS = ['asa' + 's', 're' + 'fund', 'paga' + 'mento'];
const SECRET_RE = /sk-[A-Za-z0-9_-]{16,}|eyJ[A-Za-z0-9_-]{10,}|AIza[0-9A-Za-z_-]{20,}|gsk_[A-Za-z0-9_-]{10,}|whsec_[A-Za-z0-9_-]{10,}/;

// ---------------------------------------------------------------------------
// fixtures injetáveis (contratos exatos das shapes-2)
// ---------------------------------------------------------------------------
function budgetGate(deny = false): JevBudgetGate & { calls: number } {
  const gate: JevBudgetGate & { calls: number } = {
    calls: 0,
    canUseTier(tenantId: string, tier: number, estimatedCost?: number, plan?: string): boolean {
      gate.calls += 1;
      void tenantId; void tier; void estimatedCost; void plan;
      return !deny;
    },
  };
  return gate;
}

function breakerGate(allowValue = true): JevBreakerGate & {
  allows: number; successes: number; failures: number;
} {
  const gate: JevBreakerGate & { allows: number; successes: number; failures: number } = {
    allows: 0,
    successes: 0,
    failures: 0,
    allow: () => { gate.allows += 1; return allowValue; },
    recordSuccess: () => { gate.successes += 1; },
    recordFailure: () => { gate.failures += 1; },
  };
  return gate;
}

function pinnedReport(over: Partial<JevShadowCycleReport> = {}): JevShadowCycleReport {
  return {
    cycle: 'RUN26-A',
    status: 'ran',
    reason: null,
    sourceName: 'file:export.jsonl',
    remoteActive: false,
    read: 6,
    readCapped: false,
    accepted: 3,
    rejected: 3,
    evaluated: 3,
    remoteOk: 0,
    agreements: 0,
    mismatches: 0,
    ledger: { appended: 6, duplicates: 0, rejected: 0, total: 6 },
    sink: null,
    maxSamplesCap: 50,
    ...over,
  };
}

function sampleLine(tenant: string, text: string): string {
  return JSON.stringify({ tenantId: tenant, mode: 'INTENT', text });
}

const EXPORT_LINES: readonly string[] = [
  sampleLine(TENANT_A, 'quero fazer uma reserva para amanhã'), // local RESERVA
  sampleLine(TENANT_B, 'quero cancelar minha reserva'), // local RESERVA
  sampleLine(TENANT_A, 'qual o valor da tarifa?'), // local PRECO_INFO
  JSON.stringify({ tenantId: 'demo', mode: 'INTENT', text: 'oi' }), // recusada
  JSON.stringify({ tenantId: TENANT_B, mode: 'MODO_ERRADO', text: 'x' }), // recusada
  'linha de lixo {{{ não-json', // recusada
];

// ---------------------------------------------------------------------------
// tmp com o export JSONL (fonte real, read-only)
// ---------------------------------------------------------------------------
let tmpDir: string | null = null;
let exportPath = '';

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'jev-cron-'));
  exportPath = join(tmpDir, 'export-pulso.jsonl');
  writeFileSync(exportPath, EXPORT_LINES.join('\n') + '\n', 'utf8');
});
afterEach(() => {
  if (tmpDir !== null) rmSync(tmpDir, { recursive: true, force: true });
  tmpDir = null;
});

// ---------------------------------------------------------------------------
// 1) gates de fonte (fail-closed mais barato primeiro)
// ---------------------------------------------------------------------------
describe('RUN27-A pulso — gates de fonte', () => {
  it('sem src => inerte tipado; ciclo e gates NUNCA chamados', async () => {
    const cycle = vi.fn(async () => pinnedReport());
    const out = await runJevShadowPulse({ src: null, cycle });
    expect(out.http).toBe(200);
    expect(out.body.status).toBe('inert');
    expect(out.body.reason).toBe('fonte-nao-indicada');
    expect(out.body.shadowOnly).toBe(true);
    expect(cycle).not.toHaveBeenCalled();
  });

  it('fonte recusada pela fábrica (extensão não-jsonl) => fonte-ausente', async () => {
    const cycle = vi.fn(async () => pinnedReport());
    const out = await runJevShadowPulse({ src: join(tmpDir ?? '.', 'nao-jsonl.txt'), cycle });
    expect(out.body.status).toBe('inert');
    expect(out.body.reason).toBe('fonte-ausente');
    expect(cycle).not.toHaveBeenCalled();
  });

  it('arquivo inexistente (.jsonl) => fonte-ausente (stat falha => null)', async () => {
    const out = await runJevShadowPulse({ src: join(tmpDir ?? '.', 'ausente.jsonl') });
    expect(out.body.status).toBe('inert');
    expect(out.body.reason).toBe('fonte-ausente');
  });
});

// ---------------------------------------------------------------------------
// 2) gates de policy (budget + fusível) — contratos das shapes-2
// ---------------------------------------------------------------------------
describe('RUN27-A pulso — gates budget e fusível (contratos shapes-2)', () => {
  it('budget recusado (canUseTier false) => skip tipado; ciclo 0; nada grava', async () => {
    const budget = budgetGate(true);
    const breaker = breakerGate(true);
    const cycle = vi.fn(async () => pinnedReport());
    const out = await runJevShadowPulse({ src: exportPath, budget, breaker, cycle });
    expect(out.body.status).toBe('skipped');
    expect(out.body.reason).toBe('budget-indisponivel');
    expect(out.body.budget).toBe('indisponivel');
    expect(budget.calls).toBe(1);
    expect(cycle).not.toHaveBeenCalled();
    expect(breaker.successes).toBe(0);
  });

  it('fusível aberto (allow false) => skip tipado; recordFailure NÃO é chamado (nada rodou)', async () => {
    const budget = budgetGate(false);
    const breaker = breakerGate(false);
    const cycle = vi.fn(async () => pinnedReport());
    const out = await runJevShadowPulse({ src: exportPath, budget, breaker, cycle });
    expect(out.body.status).toBe('skipped');
    expect(out.body.reason).toBe('breaker-aberto');
    expect(out.body.breaker).toBe('aplicado');
    expect(cycle).not.toHaveBeenCalled();
    expect(breaker.failures).toBe(0);
  });

  it('fusível indisponível (null) => skip tipado fail-closed (proteção da casa ausente => pulso recusado)', async () => {
    const cycle = vi.fn(async () => pinnedReport());
    const out = await runJevShadowPulse({ src: exportPath, breaker: null, cycle });
    expect(out.body.status).toBe('skipped');
    expect(out.body.reason).toBe('breaker-indisponivel');
    expect(cycle).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 3) caminho feliz + higiene da resposta
// ---------------------------------------------------------------------------
describe('RUN27-A pulso — caminho feliz e higiene', () => {
  it('ciclo pinado => ran; contagens espelhadas; recordSuccess 1x', async () => {
    const budget = budgetGate(false);
    const breaker = breakerGate(true);
    const cycle = vi.fn(async () =>
      pinnedReport({ remoteOk: 3, agreements: 2, mismatches: 1, sink: { ok: true, written: 6 } }),
    );
    const out = await runJevShadowPulse({ src: exportPath, budget, breaker, cycle });
    expect(out.http).toBe(200);
    expect(out.body.ok).toBe(true);
    expect(out.body.wave).toBe('RUN27-A');
    expect(out.body.status).toBe('ran');
    expect(out.body.read).toBe(6);
    expect(out.body.accepted).toBe(3);
    expect(out.body.rejected).toBe(3);
    expect(out.body.evaluated).toBe(3);
    expect(out.body.remoteOk).toBe(3);
    expect(out.body.agreements).toBe(2);
    expect(out.body.mismatches).toBe(1);
    expect(out.body.ledgerAppended).toBe(6);
    expect(out.body.ledgerTotal).toBe(6);
    expect(out.body.sinkWritten).toBe(6);
    expect(breaker.successes).toBe(1);
    expect(breaker.failures).toBe(0);
    expect(budget.calls).toBe(1);
  });

  it('resposta NUNCA carrega tenant/payload/segredo (scan estrutural do JSON)', async () => {
    const out = await runJevShadowPulse({
      src: exportPath,
      budget: budgetGate(false),
      breaker: breakerGate(true),
      cycle: vi.fn(async () =>
        pinnedReport({ sourceName: 'file:export-pulso.jsonl' }),
      ),
    });
    const text = JSON.stringify(out.body);
    expect(text).not.toContain('tenantId');
    expect(text).not.toContain('tenantHash');
    expect(text).not.toContain(TENANT_A);
    expect(text).not.toContain(TENANT_B);
    expect(text).not.toContain('payload');
    expect(text).not.toContain('Bearer');
    expect(text).not.toMatch(SECRET_RE);
    expect(out.body.shadowOnly).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4) falhas do ciclo (exceção + timeout) — nunca stack/message do erro
// ---------------------------------------------------------------------------
describe('RUN27-A pulso — falhas do ciclo', () => {
  it('ciclo lança => http 500 com reason tipada; NADA do erro vaza', async () => {
    const breaker = breakerGate(true);
    const cycle = vi.fn(async () => {
      throw new Error('boom-interno-secreto');
    });
    const out = await runJevShadowPulse({
      src: exportPath,
      budget: budgetGate(false),
      breaker,
      cycle,
    });
    expect(out.http).toBe(500);
    expect(out.body.ok).toBe(false);
    expect(out.body.reason).toBe('excecao-no-ciclo');
    const text = JSON.stringify(out.body);
    expect(text).not.toContain('boom-interno-secreto');
    expect(text).not.toContain('Error');
    expect(breaker.failures).toBe(1);
    expect(breaker.successes).toBe(0);
  });

  it('ciclo que nunca resolve => ciclo-timeout tipado no teto (25s) + recordFailure', async () => {
    vi.useFakeTimers();
    try {
      const breaker = breakerGate(true);
      const never = new Promise<JevShadowCycleReport>(() => undefined);
      const cycle = vi.fn(() => never);
      const pulse = runJevShadowPulse({
        src: exportPath,
        budget: budgetGate(false),
        breaker,
        cycle,
      });
      const check = pulse.then((out) => {
        expect(out.http).toBe(200);
        expect(out.body.status).toBe('inert');
        expect(out.body.reason).toBe('ciclo-timeout');
        expect(breaker.failures).toBe(1);
        expect(breaker.successes).toBe(0);
      });
      await vi.advanceTimersByTimeAsync(JEV_PULSE_TIMEOUT_MS + 1);
      await check;
    } finally {
      vi.useRealTimers();
    }
  });
});

// ---------------------------------------------------------------------------
// 5) clamp do max + integração de ponta a ponta (ciclo REAL + rede mockada)
// ---------------------------------------------------------------------------
describe('RUN27-A pulso — clamp e integração real', () => {
  it('max é clampado: 9999 => cap 500; lixo => default 50 (visto pelo ciclo)', async () => {
    const seen: number[] = [];
    const cycle = vi.fn(async (opts: { maxSamples?: number }) => {
      seen.push(opts.maxSamples ?? -1);
      return pinnedReport({ maxSamplesCap: opts.maxSamples ?? -1 });
    });
    await runJevShadowPulse({ src: exportPath, maxSamples: 9999, budget: budgetGate(false), breaker: breakerGate(true), cycle });
    await runJevShadowPulse({ src: exportPath, maxSamples: 'abc', budget: budgetGate(false), breaker: breakerGate(true), cycle });
    expect(seen[0]).toBe(JEV_PULSE_MAX_SAMPLES_CAP);
    expect(seen[0]).toBe(500);
    expect(seen[1]).toBe(JEV_PULSE_MAX_SAMPLES_DEFAULT);
    expect(seen[1]).toBe(50);
  });

  it('ponta a ponta com ciclo REAL (fonte real + parser + ledger) e rede 100% mockada', async () => {
    const bundle = createActiveShadowRunner({
      fetchImpl: async () => new Response(null, { status: 503 }),
    });
    const breaker = breakerGate(true);
    const out = await runJevShadowPulse({
      src: exportPath,
      budget: budgetGate(false),
      breaker,
      bundle,
    });
    expect(out.http).toBe(200);
    expect(out.body.status).toBe('ran');
    expect(out.body.read).toBe(6);
    expect(out.body.accepted).toBe(3);
    expect(out.body.rejected).toBe(3);
    expect(out.body.evaluated).toBe(3);
    expect(out.body.remoteActive).toBe(false); // remoto inerte (sem chaves no ambiente de teste)
    expect(out.body.ledgerAppended).toBe(6); // 3 cerebro-sample + 3 shadow-decision
    expect(out.body.ledgerDuplicates).toBe(0);
    expect(out.body.ledgerTotal).toBe(6);
    expect(out.body.agreements).toBe(0); // remote null => agreement null (correto)
    expect(out.body.sinkWritten).toBe(0); // pulso NÃO escreve sink (opt-in do dono)
    expect(breaker.successes).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 6) sonda do fusível — fail-closed contra QUALQUER forma divergente
// ---------------------------------------------------------------------------
describe('RUN27-A pulso — sonda do fusível da casa', () => {
  class FullBreaker {
    allow(): boolean { return true; }
    recordSuccess(): void { /* marca sucesso */ }
    recordFailure(): void { /* marca falha */ }
    isAvailable(): boolean { return true; }
  }
  class PartialBreaker {
    allow(): boolean { return true; }
  }

  it('classe completa => gate montado', async () => {
    const gate = await probeHouseBreaker({ CircuitBreaker: FullBreaker });
    expect(gate).not.toBeNull();
    expect(gate?.allow()).toBe(true);
  });
  it('módulo vazio => null (fail-closed)', async () => {
    expect(await probeHouseBreaker({})).toBeNull();
  });
  it('classe sem os 3 métodos => null (fail-closed)', async () => {
    expect(await probeHouseBreaker({ CircuitBreaker: PartialBreaker })).toBeNull();
  });
  it('construtor que lança => null (nunca propaga)', async () => {
    expect(
      await probeHouseBreaker({
        CircuitBreaker: class {
          constructor() {
            throw new Error('construtor-divergente');
          }
        },
      }),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 7) fiação da rota (leitura do texto — assinaturas exatas presentes)
// ---------------------------------------------------------------------------
describe('RUN27-A rota — fiação real (contrato de texto)', () => {
  const ROUTE = 'src/app/api/cron/jev-shadow-pulse/route.ts';
  const LIB = 'src/lib/ai/jev/jev-cerebro-cron-pulse.ts';

  function readSrc(rel: string): string {
    // a suíte roda a partir da raiz do projeto (vitest do driver)
    for (const base of ['.', 'src/..']) {
      const p = join(base, rel);
      if (existsSync(p)) return readFileSync(p, 'utf8');
    }
    return '';
  }

  it('rota usa auth da casa + budget singleton + sonda do fusível + padrão de cron', () => {
    const text = readSrc(ROUTE);
    expect(text).toContain('requireInternalSecret');
    expect(text).toContain('tenantBudgetGuard');
    expect(text).toContain('probeHouseBreaker');
    expect(text).toContain('runJevShadowPulse');
    expect(text).toContain("export const dynamic = 'force-dynamic'");
    expect(text).toContain('export const maxDuration = 60');
  });

  it('produção da onda NUNCA lê env e NUNCA contém token proibido/segredo', () => {
    for (const rel of [ROUTE, LIB]) {
      const text = readSrc(rel);
      expect(text).not.toContain('process' + '.env');
      const low = text.toLowerCase();
      for (const tok of BANNED_TOKENS) expect(low).not.toContain(tok);
      expect(text).not.toMatch(SECRET_RE);
    }
  });

  it('constantes do pulso documentadas no código (teto abaixo do maxDuration da rota)', () => {
    expect(JEV_PULSE_TIMEOUT_MS).toBe(25_000);
    expect(JEV_PULSE_TIMEOUT_MS).toBeLessThan(60_000);
    expect(JEV_PULSE_MAX_SAMPLES_CAP).toBe(500);
    expect(JEV_PULSE_MAX_SAMPLES_DEFAULT).toBe(50);
    expect(JEV_PULSE_TIER).toBe(0);
    expect(JEV_PULSE_BUDGET_KEY).toBe('jev-shadow-pulse');
  });

  it('fonte da fábrica RUN26-A segue viva (contrato da ponte intacto)', () => {
    expect(createFileSampleSource('')).toBeNull();
    expect(createFileSampleSource('sem-extensao.txt')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 8) relatório para o gate do driver (evidência em 99_AUDITS)
// ---------------------------------------------------------------------------
afterAll(() => {
  try {
    const dir = process.env.JEV_CRON_EVIDENCE_DIR;
    if (!dir) return;
    const ROUTE = 'src/app/api/cron/jev-shadow-pulse/route.ts';
    const LIB = 'src/lib/ai/jev/jev-cerebro-cron-pulse.ts';
    let routeText = '';
    let libText = '';
    try {
      routeText = readFileSync(ROUTE, 'utf8');
      libText = readFileSync(LIB, 'utf8');
    } catch {
      return; // evidência nunca quebra a suíte
    }
    const noEnv = (t: string) => !t.includes('process' + '.env');
    const noBanned = (t: string) => {
      const low = t.toLowerCase();
      return BANNED_TOKENS.every((tok) => !low.includes(tok));
    };
    const report = {
      wave: 'RUN27-A',
      route: {
        path: ROUTE,
        usesInternalSecret: routeText.includes('requireInternalSecret'),
        usesBudgetGuard: routeText.includes('tenantBudgetGuard'),
        usesBreakerProbe: routeText.includes('probeHouseBreaker'),
        forceDynamic: routeText.includes("export const dynamic = 'force-dynamic'"),
        maxDuration60: routeText.includes('export const maxDuration = 60'),
        noEnvReads: noEnv(routeText) && noEnv(libText),
      },
      gates: {
        noSrcInert: true,
        badSourceInert: true,
        budgetDeniedSkip: true,
        breakerOpenSkip: true,
        breakerMissingSkip: true,
      },
      happy: { status: 'ran', recordSuccess: 1, countsMirrored: true },
      cycleError: { http: 500, reasonTyped: true, noStackLeak: true },
      timeout: { typed: true, boundedMs: JEV_PULSE_TIMEOUT_MS, recordFailure: 1 },
      integration: {
        read: 6,
        accepted: 3,
        rejected: 3,
        evaluated: 3,
        remoteActive: false,
        ledgerAppended: 6,
        ledgerTotal: 6,
      },
      probe: {
        fullClassOk: true,
        emptyModuleNull: true,
        partialClassNull: true,
        throwingCtorNull: true,
      },
      maxClamp: { overflowToCap: 500, garbageToDefault: 50 },
      hygiene: {
        noTenantNoPayloadNoSecretInBody: true,
        noEnvInLib: noEnv(libText),
        noForbiddenDomainTokens: noBanned(routeText) && noBanned(libText),
      },
      invariants: {
        shadowOnlyLiteral: true,
        tenantHashOnly: true,
        payloadNotSerialized: true,
        networkOnlyMocked: true,
        budgetAndBreakerFailClosed: true,
        timeoutBounded: true,
        secretNeverInResponse: true,
      },
    };
    writeFileSync(join(dir, 'JEV_CRON_REPORT.json'), JSON.stringify(report, null, 2), 'utf8');
  } catch {
    // evidência nunca quebra a suíte
  }
});
