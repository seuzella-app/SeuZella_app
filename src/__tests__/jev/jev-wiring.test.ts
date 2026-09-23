// ============================================================================
// JEV — Security tests da FIAÇÃO NO CÉREBRO (RUN26-A, SHADOW_ONLY)
// ============================================================================
// O que esta suíte PROVA (fiação da ponte RUN24-A + chamador RUN25-A):
//   1. FONTE REAL READ-ONLY: export JSONL existente lido com caps (tamanho/
//      linhas); caminhos sujos => fonte null; linhas inválidas seguem para o
//      parser e são RECUSADAS com reason tipado (nada "entra para ver se serve").
//   2. CICLO FAIL-CLOSED: fonte ausente/que lança => ciclo INERTE tipado;
//      remoto só existe com flag+chave+shadow (fábrica RUN25-A); sem chave o
//      ciclo roda SÓ-LOCAL e nada quebra.
//   3. AGREEMENT REAL: com remoto aceso (fetch mock), o agreement local-vs-
//      remoto acende com cenário PINADO 3 avaliadas => 3 remotas ok =>
//      2 acordos + 1 divergência.
//   4. LEDGER: cerebro-sample (pending) + shadow-decision (labels/agreement)
//      no MESMO ledger; re-ciclo com a mesma fonte => 0 novos + 6 duplicatas
//      (idempotência por contentHash provada de ponta a ponta).
//   5. HIGIENE ESTRUTURAL: relatório/sink NUNCA carregam tenant puro, payload
//      ou a chave; só hashes 16-hex e contagens; caps respeitados.
//
// Disciplina herdada (RUN22..RUN25): NUNCA muta NODE_ENV; env salva/restaurada
// por describe; resetJevConfigCache(); NENHUMA rede real (fetch injetado);
// sem Math.random; guard da casa NUNCA é presumido (lição RUN25-A).
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resetJevConfigCache } from '../../lib/ai/jev/jev-config';
import {
  createFileSampleSource,
  JEV_FILE_SOURCE_MAX_BYTES,
} from '../../lib/ai/jev/jev-cerebro-file-source';
import { runCerebroShadowCycle } from '../../lib/ai/jev/jev-cerebro-shadow-loop';
import { JevLedger } from '../../lib/ai/jev/jev-ledger';
import { MemorySink } from '../../lib/ai/jev/jev-ledger-sink';
import { createActiveShadowRunner } from '../../lib/ai/jev/jev-integration';

// ---------------------------------------------------------------------------
// disciplina de env (NUNCA NODE_ENV) + relatório da onda
// ---------------------------------------------------------------------------

const ENV_KEYS = [
  'JEV_ENABLED',
  'TYPESAFE_API_KEY',
  'JEV_MODEL',
  'JEV_TIMEOUT_MS',
  'JEV_MAX_RETRIES',
  'JEV_TYPESAFE_BASE_URL',
  'JEV_DEFAULT_CONFIDENCE_THRESHOLD',
  'SSRF_ALLOWLIST',
  'SSRF_ENFORCED',
];

const M2M_KEY = 'm2m-wiring-key-0123456789abcdef';
const TENANT_A = 'tenant-wiring-alpha';
const TENANT_B = 'tenant-wiring-beta';
const FIXED_NOW = 1_727_000_000_000;
const FIXED_TS = new Date(FIXED_NOW).toISOString();

function cleanEnvHooks(): void {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    resetJevConfigCache();
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    resetJevConfigCache();
  });
}

function setEnv(map: Record<string, string>): void {
  for (const [k, v] of Object.entries(map)) process.env[k] = v;
  resetJevConfigCache();
}

const report: {
  wave: 'RUN26-A';
  generatedAt: string | null;
  source: { capBytes: number; accepted: number; rejected: number; read: number };
  cycle: {
    evaluated: number;
    remoteOk: number;
    agreements: number;
    mismatches: number;
    inertFailClosed: boolean;
  };
  ledger: { appendedFirst: number; totalFirst: number; reRunAppended: number; reRunDuplicates: number };
  sink: { ok: boolean; written: number; noPayloadNoTenant: boolean };
  invariants: {
    tenantHashOnly: boolean;
    payloadNotSerialized: boolean;
    idempotentCycle: boolean;
    networkOnlyMocked: boolean;
    capRespected: boolean;
    secretNeverInReport: boolean;
  };
} = {
  wave: 'RUN26-A',
  generatedAt: null,
  source: { capBytes: JEV_FILE_SOURCE_MAX_BYTES, accepted: 0, rejected: 0, read: 0 },
  cycle: { evaluated: 0, remoteOk: 0, agreements: 0, mismatches: 0, inertFailClosed: false },
  ledger: { appendedFirst: 0, totalFirst: 0, reRunAppended: 0, reRunDuplicates: 0 },
  sink: { ok: false, written: 0, noPayloadNoTenant: false },
  invariants: {
    tenantHashOnly: false,
    payloadNotSerialized: false,
    idempotentCycle: false,
    networkOnlyMocked: true,
    capRespected: false,
    secretNeverInReport: false,
  },
};

afterAll(() => {
  const dir = process.env.JEV_WIRING_EVIDENCE_DIR;
  if (typeof dir !== 'string' || dir.length === 0) return;
  try {
    report.generatedAt = new Date().toISOString();
    writeFileSync(join(dir, 'JEV_WIRING_REPORT.json'), JSON.stringify(report, null, 2));
  } catch {
    // evidência nunca quebra a suíte
  }
});

// ---------------------------------------------------------------------------
// fixture: export JSONL EXISTENTE (dados do Cérebro já exportados pelo dono)
// ---------------------------------------------------------------------------

let tmpDir: string | null = null;
let exportPath = '';

function sampleLine(tenant: string, text: string): string {
  return JSON.stringify({ tenantId: tenant, mode: 'INTENT', text });
}

const EXPORT_LINES: readonly string[] = [
  sampleLine(TENANT_A, 'quero fazer uma reserva para amanhã'), // local RESERVA
  sampleLine(TENANT_B, 'quero cancelar minha reserva'), // local RESERVA (match reserva)
  sampleLine(TENANT_A, 'qual o valor da tarifa?'), // local PRECO_INFO (não casa reserva/diária)
  JSON.stringify({ tenantId: 'demo', mode: 'INTENT', text: 'oi' }), // recusado: tenant demo
  JSON.stringify({ tenantId: TENANT_B, mode: 'MODO_ERRADO', text: 'x' }), // recusado: modo
  'linha de lixo {{{ não-json', // recusado: não-objeto
];

function writeExport(lines: readonly string[]): string {
  const p = join(tmpDir ?? '.', `export-${lines.length}-${Math.abs(lines[0]?.length ?? 0)}.jsonl`);
  writeFileSync(p, lines.join('\n') + '\n', 'utf8');
  return p;
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'jev-wiring-'));
});
afterEach(() => {
  if (tmpDir !== null) rmSync(tmpDir, { recursive: true, force: true });
  tmpDir = null;
});
afterAll(() => {
  // nada persiste fora do tmp do teste
});

function remoteReservaBundle() {
  return createActiveShadowRunner({
    baseUrl: 'https://api.typesafe.ai',
    fetchImpl: async () =>
      new Response(JSON.stringify({ decisions: [{ label: 'RESERVA', confidence: 0.9 }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  });
}

// ---------------------------------------------------------------------------
// 1) Fonte real read-only — caps e fail-closed
// ---------------------------------------------------------------------------

describe('fonte de arquivo real — extração read-only com caps', () => {
  cleanEnvHooks();

  it('caminhos sujos => fonte null (vazio, extensão errada, ausente, diretório)', () => {
    expect(createFileSampleSource('')).toBeNull();
    expect(createFileSampleSource('sem-extensao.txt')).toBeNull();
    expect(createFileSampleSource(join(tmpDir ?? '.', 'ausente.jsonl'))).toBeNull();
    expect(createFileSampleSource(tmpDir ?? '.')).toBeNull(); // diretório
  });

  it('export acima do cap de tamanho => fonte null (nunca carrega gigante)', () => {
    const big = join(tmpDir ?? '.', 'grande.jsonl');
    writeFileSync(big, Buffer.alloc(JEV_FILE_SOURCE_MAX_BYTES + 1, 0x61));
    expect(createFileSampleSource(big)).toBeNull();
  });

  it('export válido => fonte com nome estável e lote integral (6 entradas)', async () => {
    const p = writeExport(EXPORT_LINES);
    const source = createFileSampleSource(p);
    expect(source).not.toBeNull();
    expect(source?.sourceName).toBe('file:' + p.split('/').pop());
    const raws = (await source?.fetchSamples()) ?? [];
    expect(raws.length).toBe(6);
    const first = raws[0] as Record<string, unknown>;
    expect(first['tenantId']).toBe(TENANT_A);
  });

  it('linhas vazias/em branco são ignoradas sem alterar o lote', async () => {
    const p = join(tmpDir ?? '.', 'com-brancos.jsonl');
    writeFileSync(p, '\n\n' + EXPORT_LINES.join('\n') + '\n   \n\n', 'utf8');
    const source = createFileSampleSource(p);
    expect(((await source?.fetchSamples()) ?? []).length).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// 2) Ciclo fail-closed — fonte ausente ou quebrada => INERTE tipado
// ---------------------------------------------------------------------------

describe('ciclo shadow — fail-closed na fonte', () => {
  cleanEnvHooks();

  it('fonte null => ciclo inerte (fonte-ausente), nada lido, nada no ledger', async () => {
    const ledger = new JevLedger({ now: () => FIXED_NOW });
    const rep = await runCerebroShadowCycle({ source: null, ledger, now: () => FIXED_NOW });
    expect(rep.status).toBe('inert');
    expect(rep.reason).toBe('fonte-ausente');
    expect(rep.read).toBe(0);
    expect(rep.evaluated).toBe(0);
    expect(ledger.stats().total).toBe(0);
    report.cycle.inertFailClosed = true;
  });

  it('fonte que lança => ciclo inerte (fonte-falhou-leitura), NUNCA propaga', async () => {
    const rep = await runCerebroShadowCycle({
      source: {
        sourceName: 'boom',
        fetchSamples() {
          throw new Error('IO simulada');
        },
      },
      now: () => FIXED_NOW,
    });
    expect(rep.status).toBe('inert');
    expect(rep.reason).toBe('fonte-falhou-leitura');
    expect(rep.evaluated).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3) Ciclo com remoto APAGADO — só-local + ledger (comportamento RUN22..24)
// ---------------------------------------------------------------------------

describe('ciclo com remoto apagado — só local, ledger com cerebro-sample', () => {
  cleanEnvHooks();

  it('sem env: remoteActive false, 3 aceitas, 3 recusadas, 3 avaliadas só-local', async () => {
    const p = writeExport(EXPORT_LINES);
    const ledger = new JevLedger({ now: () => FIXED_NOW });
    const rep = await runCerebroShadowCycle({
      source: createFileSampleSource(p),
      ledger,
      now: () => FIXED_NOW,
    });
    expect(rep.status).toBe('ran');
    expect(rep.remoteActive).toBe(false);
    expect(rep.read).toBe(6);
    expect(rep.accepted).toBe(3);
    expect(rep.rejected).toBe(3);
    expect(rep.evaluated).toBe(3);
    expect(rep.remoteOk).toBe(0);
    expect(rep.agreements).toBe(0);
    expect(rep.mismatches).toBe(0);
    expect(rep.ledger.appended).toBe(6); // 3 cerebro-sample + 3 shadow-decision (agreement null)
    expect(ledger.stats().total).toBe(6);
    expect(ledger.stats().byKind['cerebro-sample']).toBe(3);
    expect(ledger.stats().byKind['shadow-decision']).toBe(3);
    expect(ledger.stats().matches).toBe(0);
    expect(ledger.stats().mismatches).toBe(0);
    report.source = { capBytes: JEV_FILE_SOURCE_MAX_BYTES, accepted: 3, rejected: 3, read: 6 };
  });
});

// ---------------------------------------------------------------------------
// 4) Ciclo com remoto ACESO — agreement real + ledger duplo + idempotência
// ---------------------------------------------------------------------------

describe('ciclo com remoto aceso — cenário PINADO 3 => 3 ok => 2 acordos + 1 divergência', () => {
  cleanEnvHooks();

  it('flag+chave: remoteOk=3, agreements=2, mismatches=1, ledger 3+3=6', async () => {
    setEnv({ JEV_ENABLED: 'true', TYPESAFE_API_KEY: M2M_KEY, SSRF_ALLOWLIST: 'api.typesafe.ai', JEV_MAX_RETRIES: '0' });
    const p = writeExport(EXPORT_LINES);
    const ledger = new JevLedger({ now: () => FIXED_NOW });
    const bundle = remoteReservaBundle();
    expect(bundle.remotePort).not.toBeNull();
    const rep = await runCerebroShadowCycle({
      source: createFileSampleSource(p),
      ledger,
      bundle,
      now: () => FIXED_NOW,
    });
    expect(rep.status).toBe('ran');
    expect(rep.remoteActive).toBe(true);
    expect(rep.evaluated).toBe(3);
    expect(rep.remoteOk).toBe(3);
    expect(rep.agreements).toBe(2); // 2x RESERVA local == RESERVA remota
    expect(rep.mismatches).toBe(1); // PRECO_INFO local != RESERVA remota
    expect(rep.ledger.appended).toBe(6);
    expect(ledger.stats().total).toBe(6);
    expect(ledger.stats().byKind['cerebro-sample']).toBe(3);
    expect(ledger.stats().byKind['shadow-decision']).toBe(3);
    expect(ledger.stats().matches).toBe(2);
    expect(ledger.stats().mismatches).toBe(1);
    report.cycle = {
      evaluated: 3,
      remoteOk: 3,
      agreements: 2,
      mismatches: 1,
      inertFailClosed: true,
    };
    report.ledger.appendedFirst = 6;
    report.ledger.totalFirst = 6;

    // higiene do relatório: zero tenant puro, zero payload, zero chave
    const repStr = JSON.stringify(rep);
    expect(repStr).not.toContain(TENANT_A);
    expect(repStr).not.toContain(TENANT_B);
    expect(repStr).not.toContain(M2M_KEY);
    expect(repStr).not.toContain('"payload"');
    report.invariants.secretNeverInReport = true;
  });

  it('re-ciclo com a MESMA fonte e ledger => 0 novos + 6 duplicatas (idempotência)', async () => {
    setEnv({ JEV_ENABLED: 'true', TYPESAFE_API_KEY: M2M_KEY, SSRF_ALLOWLIST: 'api.typesafe.ai', JEV_MAX_RETRIES: '0' });
    const p = writeExport(EXPORT_LINES);
    const ledger = new JevLedger({ now: () => FIXED_NOW });
    const bundle = remoteReservaBundle();
    await runCerebroShadowCycle({ source: createFileSampleSource(p), ledger, bundle, now: () => FIXED_NOW });
    const rep2 = await runCerebroShadowCycle({
      source: createFileSampleSource(p),
      ledger,
      bundle,
      now: () => FIXED_NOW,
    });
    expect(rep2.status).toBe('ran');
    expect(rep2.ledger.appended).toBe(0);
    expect(rep2.ledger.duplicates).toBe(6);
    expect(ledger.stats().total).toBe(6); // janela congelada — nada duplicou
    report.ledger.reRunAppended = 0;
    report.ledger.reRunDuplicates = 6;
    report.invariants.idempotentCycle = true;
  });

  it('sem chave (só flag): fábrica inerte => ciclo roda só-local (remoteActive false)', async () => {
    setEnv({ JEV_ENABLED: 'true' });
    const p = writeExport(EXPORT_LINES);
    const ledger = new JevLedger({ now: () => FIXED_NOW });
    const rep = await runCerebroShadowCycle({
      source: createFileSampleSource(p),
      ledger,
      now: () => FIXED_NOW,
    });
    expect(rep.remoteActive).toBe(false);
    expect(rep.remoteOk).toBe(0);
    expect(rep.evaluated).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 5) Sink local opt-in + higiene estrutural do export
// ---------------------------------------------------------------------------

describe('sink do ledger — export JSONL sem payload e sem tenant puro', () => {
  cleanEnvHooks();

  it('sink recebe TODAS as linhas; nenhuma linha tem "payload", tenant puro ou chave', async () => {
    setEnv({ JEV_ENABLED: 'true', TYPESAFE_API_KEY: M2M_KEY, SSRF_ALLOWLIST: 'api.typesafe.ai', JEV_MAX_RETRIES: '0' });
    const p = writeExport(EXPORT_LINES);
    const ledger = new JevLedger({ now: () => FIXED_NOW });
    const sink = new MemorySink();
    const rep = await runCerebroShadowCycle({
      source: createFileSampleSource(p),
      ledger,
      bundle: remoteReservaBundle(),
      sink,
      now: () => FIXED_NOW,
    });
    expect(rep.sink).not.toBeNull();
    expect(rep.sink?.ok).toBe(true);
    expect(rep.sink?.written).toBe(6);
    const exported = JSON.parse(JSON.stringify(sink.snapshot())) as string[];
    expect(exported.length).toBe(6);
    const HEX16 = /^[0-9a-f]{16}$/;
    for (const line of exported) {
      const obj = JSON.parse(line) as Record<string, unknown>;
      expect(obj).not.toHaveProperty('payload');
      expect(typeof obj['tenantHash']).toBe('string');
      expect(HEX16.test(String(obj['tenantHash']))).toBe(true);
      expect(String(line)).not.toContain(TENANT_A);
      expect(String(line)).not.toContain(TENANT_B);
      expect(String(line)).not.toContain(M2M_KEY);
    }
    report.sink = { ok: true, written: 6, noPayloadNoTenant: true };
    report.invariants.tenantHashOnly = true;
    report.invariants.payloadNotSerialized = true;
  });

  it('caps: maxSamples=2 => readCapped true, 2 aceitas, 2 avaliadas, ledger 4', async () => {
    setEnv({ JEV_ENABLED: 'true', TYPESAFE_API_KEY: M2M_KEY, SSRF_ALLOWLIST: 'api.typesafe.ai', JEV_MAX_RETRIES: '0' });
    const p = writeExport(EXPORT_LINES);
    const ledger = new JevLedger({ now: () => FIXED_NOW });
    const rep = await runCerebroShadowCycle({
      source: createFileSampleSource(p),
      ledger,
      bundle: remoteReservaBundle(),
      maxSamples: 2,
      now: () => FIXED_NOW,
    });
    expect(rep.read).toBe(6);
    expect(rep.readCapped).toBe(true);
    expect(rep.accepted).toBe(2);
    expect(rep.evaluated).toBe(2);
    expect(rep.ledger.appended).toBe(4); // 2 cerebro-sample + 2 shadow-decision
    report.invariants.capRespected = true;
    report.invariants.networkOnlyMocked = true;
  });
});
