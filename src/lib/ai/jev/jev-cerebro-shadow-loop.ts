// ============================================================================
// JEV — CHAMADOR do ciclo shadow do Cérebro (RUN26-A — FIAÇÃO NO CÉREBRO)
// ============================================================================
// Único ponto que USA a fábrica protegida da RUN25-A (createActiveShadowRunner)
// e a ponte da RUN24-A (parser + drafts): um ciclo = ler amostras EXISTENTES
// (fonte plugável, ex.: export JSONL via jev-cerebro-file-source) -> parser
// (firewall/tenant-hash/fingerprint) -> ledger (cerebro-sample) -> runner
// shadow (local SEMPRE + remoto protegido QUANDO aceso) -> ledger
// (shadow-decision com agreement) -> export JSONL -> sink local (opt-in).
//
// INVARIANTES (mesmas das ondas RUN22..RUN25):
//  - SHADOW_ONLY: shadowOnly literal true em toda resposta; nada vivo;
//  - tenantId puro NUNCA sai do ciclo: só entra no runner (que hasheia —
//    provado nas ondas 22-24) e no parser (que hasheia); o relatório do
//    ciclo carrega SOMENTE contagens/estados — zero payload, zero tenant;
//  - fail-closed: fonte ausente/leitura falha => ciclo INERTE tipado;
//    NUNCA lança (try/catch externo -> relatório tipado);
//  - NADA em produção chama este módulo automaticamente: o ciclo é opt-in,
//    disparado pelo chamador (hoje: suíte de fiação; amanhã: cron do Cérebro
//    com as shapes exatas extraídas no digest desta onda);
//  - sem leitura direta de variáveis de ambiente (bundle default usa jev-config), sem rede real
//    (remoto só com fetch injetado nos testes), sem banco.
// ============================================================================

import type { JevCerebroSample, JevSampleSource } from './jev-cerebro-samples';
import { parseCerebroSample, toLedgerDrafts } from './jev-cerebro-samples';
import { JevLedger } from './jev-ledger';
import type { JevLedgerSink } from './jev-ledger-sink';
import { createActiveShadowRunner, type ActiveShadowRunnerBundle } from './jev-integration';

/** Teto de amostras por ciclo (clamp 1..500; default 50). */
export const JEV_CYCLE_MAX_SAMPLES_DEFAULT = 50;
export const JEV_CYCLE_MAX_SAMPLES_CAP = 500;

export interface JevShadowCycleOptions {
  /** Fonte de amostras EXISTENTES (null => ciclo inerte). */
  source: JevSampleSource | null;
  /** Ledger compartilhado (senão um novo local — janela em memória). */
  ledger?: JevLedger;
  /** Bundle pré-montado (senão createActiveShadowRunner() do ambiente). */
  bundle?: ActiveShadowRunnerBundle | null;
  /** Teto de amostras processadas neste ciclo. */
  maxSamples?: number;
  /** Clock injetável (determinismo nos testes). */
  now?: () => number;
  /** Sink local opt-in (export JSONL do ledger após o ciclo). */
  sink?: JevLedgerSink | null;
}

export interface JevShadowCycleReport {
  cycle: 'RUN26-A';
  status: 'inert' | 'ran';
  reason: string | null;
  sourceName: string | null;
  /** Espelha bundle.status.remoteActive — true só com flag+chave+shadow. */
  remoteActive: boolean;
  read: number;
  readCapped: boolean;
  accepted: number;
  rejected: number;
  evaluated: number;
  remoteOk: number;
  agreements: number;
  mismatches: number;
  ledger: { appended: number; duplicates: number; rejected: number; total: number };
  sink: { ok: boolean; written: number } | null;
  maxSamplesCap: number;
  /** Só contagens — NUNCA payload/tenant. Prova estrutural na suíte. */
}

function clampCap(raw: number | undefined): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return JEV_CYCLE_MAX_SAMPLES_DEFAULT;
  return Math.min(JEV_CYCLE_MAX_SAMPLES_CAP, Math.max(1, Math.floor(raw)));
}

function rawTenantOf(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const t = (raw as Record<string, unknown>)['tenantId'];
  return typeof t === 'string' ? t : null;
}

/**
 * Executa UM ciclo shadow sobre a fonte. NUNCA lança.
 * Fonte ausente ou leitura falha => { status: 'inert', reason } (tipado).
 */
export async function runCerebroShadowCycle(
  opts: JevShadowCycleOptions,
): Promise<JevShadowCycleReport> {
  const base: JevShadowCycleReport = {
    cycle: 'RUN26-A',
    status: 'inert',
    reason: null,
    sourceName: null,
    remoteActive: false,
    read: 0,
    readCapped: false,
    accepted: 0,
    rejected: 0,
    evaluated: 0,
    remoteOk: 0,
    agreements: 0,
    mismatches: 0,
    ledger: { appended: 0, duplicates: 0, rejected: 0, total: 0 },
    sink: null,
    maxSamplesCap: clampCap(opts?.maxSamples),
  };
  try {
    const source = opts?.source ?? null;
    if (source === null) {
      return { ...base, reason: 'fonte-ausente' };
    }
    base.sourceName = source.sourceName ?? null;

    let raws: readonly unknown[] = [];
    try {
      raws = await source.fetchSamples();
    } catch {
      return { ...base, reason: 'fonte-falhou-leitura' };
    }
    if (!Array.isArray(raws)) {
      return { ...base, reason: 'fonte-lote-invalido' };
    }

    const nowFn = opts?.now ?? (() => Date.now());
    const ts = new Date(nowFn()).toISOString();
    const cap = clampCap(opts?.maxSamples);
    const read = raws.length;
    const sliced = raws.slice(0, cap);

    const ledger = opts?.ledger ?? new JevLedger();
    const bundle: ActiveShadowRunnerBundle =
      opts?.bundle ?? createActiveShadowRunner({ runnerOptions: { capacity: Math.max(50, cap) } });

    // 1) parser (RUN24-A): aceitos viram amostras higienizadas + par com o raw
    const pairs: Array<{ raw: unknown; tenant: string | null }> = [];
    const parsedSamples: JevCerebroSample[] = [];
    for (const raw of sliced) {
      const parsed = parseCerebroSample(raw);
      if (parsed.ok) {
        parsedSamples.push(parsed.sample);
        pairs.push({ raw, tenant: rawTenantOf(raw) });
        base.accepted += 1;
      } else {
        base.rejected += 1;
      }
    }
    base.read = read;
    base.readCapped = read > sliced.length;
    base.status = 'ran';

    // 2) ledger: drafts cerebro-sample (pending — dedupe por contentHash)
    for (const draft of toLedgerDrafts(parsedSamples, { ts })) {
      const res = ledger.append(draft);
      if (res.ok) {
        if (res.duplicate) base.ledger.duplicates += 1;
        else base.ledger.appended += 1;
      } else {
        base.ledger.rejected += 1;
      }
    }

    // 3) runner shadow: local SEMPRE, remoto protegido quando aceso
    base.remoteActive = bundle.remotePort !== null;
    for (let i = 0; i < parsedSamples.length; i += 1) {
      const sample = parsedSamples[i];
      const tenant = pairs[i]?.tenant ?? null;
      if (tenant === null) {
        base.rejected += 1; // impossível pelo parser; guarda defensiva
        continue;
      }
      const entry = await bundle.runner.evaluate({
        requestId: sample.requestId,
        tenantId: tenant,
        mode: sample.mode,
        payload: sample.payload,
        occurredAt: ts,
      });
      base.evaluated += 1;
      if (entry.remote !== null && entry.remote.status === 'ok') base.remoteOk += 1;
      if (entry.agreement === true) base.agreements += 1;
      else if (entry.agreement === false) base.mismatches += 1;

      // 4) ledger: shadow-decision (labels/agreement — payload não existe no formato)
      const res = ledger.append({
        ts,
        kind: 'shadow-decision',
        source: 'runtime-shadow',
        requestId: entry.requestId,
        tenantHash: entry.tenantHash,
        mode: entry.mode,
        localStatus: entry.local.status,
        localLabel: entry.local.status === 'ok' ? entry.local.decision?.label ?? null : null,
        localConfidence:
          entry.local.status === 'ok' ? entry.local.decision?.confidence ?? null : null,
        remoteLabel: entry.remote?.status === 'ok' ? entry.remote.decision?.label ?? null : null,
        agreement: entry.agreement,
        expectedLabel: sample.expectedLabel,
      });
      if (res.ok) {
        if (res.duplicate) base.ledger.duplicates += 1;
        else base.ledger.appended += 1;
      } else {
        base.ledger.rejected += 1;
      }
    }

    // 5) sink local opt-in: export JSONL do ledger (linhas já higienizadas)
    if (opts?.sink) {
      try {
        const res = await opts.sink.appendJsonl(ledger.exportJsonlLines());
        base.sink = { ok: res.ok, written: res.ok ? res.written : 0 };
      } catch {
        base.sink = { ok: false, written: 0 }; // evidência nunca quebra o ciclo
      }
    }

    base.ledger.total = ledger.stats().total;
    return base;
  } catch {
    return { ...base, status: 'inert', reason: 'excecao-inesperada-no-ciclo' };
  }
}
