// ============================================================================
// JEV — LEDGER apend-only das entradas shadow (RUN24-A) — jev-ledger.ts
// ============================================================================
// Persistência EM JANELA DE MEMÓRIA + exportação JSONL da onda LEDGER:
//  - APPEND-ONLY: nenhuma API muta ou remove entrada individual. A ÚNICA
//    forma de uma entrada sair é a RETENÇÃO (idade máxima / capacidade),
//    que poda as mais antigas — nunca reescreve histórico dentro da janela;
//  - IDEMPOTÊNCIA: cada entrada tem contentHash (sha256 do conteúdo SEMÂNTICO,
//    timestamp FORA do hash) — re-append do mesmo conteúdo não duplica linha;
//  - HIGIENE POR CONSTRUÇÃO: o ledger NEM ACEITA payload (todo draft com
//    campo desconhecido é recusado — reason 'payload-forbidden') e NEM ACEITA
//    tenantId puro (só tenantHash de 16 hex minúsculos);
//  - FAIL-CLOSED: append nunca lança — devolve resultado tipado com reason;
//  - SEM REDE, SEM ENV: nenhuma leitura de variável de ambiente, nenhuma
//    chamada de rede. O sink de arquivo é opt-in explícito (jev-ledger-sink).
// Nenhum fluxo de produção chama isto ainda — a fiação no Cérebro vem em onda
// futura usando a ponte desta onda (jev-cerebro-samples). Nesta trilha: nada
// de domínio financeiro; NUNCA push.
// ============================================================================

import { createHash } from 'node:crypto';

import {
  isJevDecisionMode,
  type JevDecisionMode,
} from '../../../domain/decision/contracts/JevTypes';

/** Tipos de entrada do ledger. */
export type JevLedgerEntryKind = 'shadow-decision' | 'cerebro-sample';

/** Origem da entrada (de onde veio o evento registrado). */
export type JevLedgerSource = 'harness-corpus' | 'runtime-shadow' | 'cerebro-export';

/** Estado da decisão local. 'pending' = amostra aguardando decisão (ponte
 * Cérebro); shadow-decision nunca usa 'pending'. */
export type JevLedgerLocalStatus = 'ok' | 'unavailable' | 'rejected' | 'pending';

/** UMA entrada do ledger (imutável após o append — Object.freeze). */
export interface JevLedgerEntry {
  /** Monotônico por append bem-sucedido (nunca reinicia, mesmo após prune). */
  seq: number;
  /** ISO-8601 do EVENTO (informado no draft). */
  ts: string;
  kind: JevLedgerEntryKind;
  source: JevLedgerSource;
  requestId: string;
  /** sha256(tenantId) truncado a 16 hex — id puro NUNCA entra no ledger. */
  tenantHash: string;
  mode: JevDecisionMode;
  localStatus: JevLedgerLocalStatus;
  localLabel: string | null;
  localConfidence: number | null;
  remoteLabel: string | null;
  /** true/false só quando houver par local-vs-remoto decidido; senão null. */
  agreement: boolean | null;
  /** Ground truth quando houver (corpus/cerebro rotulado); senão null. */
  expectedLabel: string | null;
  /** sha256 do conteúdo semântico (sem ts) — base da idempotência. */
  contentHash: string;
}

/** Rascunho de entrada. O ledger valida TUDO (fail-closed) antes de aceitar. */
export interface JevLedgerDraft {
  ts: string;
  kind: JevLedgerEntryKind;
  source: JevLedgerSource;
  requestId: string;
  /** JÁ hasheado (16 hex). Enviar tenantId puro é RECUSADO. */
  tenantHash: string;
  mode: JevDecisionMode;
  localStatus: JevLedgerLocalStatus;
  localLabel?: string | null;
  localConfidence?: number | null;
  remoteLabel?: string | null;
  agreement?: boolean | null;
  expectedLabel?: string | null;
}

export type JevAppendResult =
  | { ok: true; seq: number; duplicate: boolean }
  | { ok: false; reason: string };

export interface JevLedgerFilter {
  mode?: JevDecisionMode;
  kind?: JevLedgerEntryKind;
  /** Máximo de entradas retornadas (mais recentes). */
  limit?: number;
}

const TENANT_HASH_RE = /^[0-9a-f]{16}$/;
const KINDS: readonly string[] = ['shadow-decision', 'cerebro-sample'];
const SOURCES: readonly string[] = ['harness-corpus', 'runtime-shadow', 'cerebro-export'];
const STATUSES: readonly string[] = ['ok', 'unavailable', 'rejected', 'pending'];
const DRAFT_ALLOWED_KEYS: readonly string[] = [
  'ts', 'kind', 'source', 'requestId', 'tenantHash', 'mode', 'localStatus',
  'localLabel', 'localConfidence', 'remoteLabel', 'agreement', 'expectedLabel',
];
const LABEL_MAX = 64;
const REQUEST_ID_MAX = 128;

export const JEV_LEDGER_DEFAULT_CAPACITY = 1000;
/** Retenção padrão: 30 dias (política da onda LEDGER; clock injetável). */
export const JEV_LEDGER_DEFAULT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Hash do conteúdo SEMÂNTICO (ts fora) — igual conteúdo => igual hash. */
export function ledgerContentHash(d: {
  kind: JevLedgerEntryKind;
  source: JevLedgerSource;
  requestId: string;
  tenantHash: string;
  mode: JevDecisionMode;
  localStatus: JevLedgerLocalStatus;
  localLabel?: string | null;
  localConfidence?: number | null;
  remoteLabel?: string | null;
  agreement?: boolean | null;
  expectedLabel?: string | null;
}): string {
  const canonical = JSON.stringify([
    d.kind, d.source, d.requestId, d.tenantHash, d.mode, d.localStatus,
    d.localLabel ?? null, typeof d.localConfidence === 'number' ? d.localConfidence : null,
    d.remoteLabel ?? null, typeof d.agreement === 'boolean' ? d.agreement : null,
    d.expectedLabel ?? null,
  ]);
  return createHash('sha256').update(canonical, 'utf8').digest('hex').slice(0, 32);
}

function validLabel(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= LABEL_MAX;
}

/** Validação fail-closed do draft. Nunca lança. */
export function validateJevLedgerDraft(draft: unknown): { ok: true } | { ok: false; reason: string } {
  if (typeof draft !== 'object' || draft === null || Array.isArray(draft)) {
    return { ok: false, reason: 'draft-invalido' };
  }
  const rec = draft as Record<string, unknown>;
  for (const key of Object.keys(rec)) {
    if (key === 'payload') return { ok: false, reason: 'payload-forbidden' };
    if (!DRAFT_ALLOWED_KEYS.includes(key)) return { ok: false, reason: `campo-desconhecido:${key}` };
  }
  if (typeof rec['ts'] !== 'string' || Number.isNaN(Date.parse(rec['ts']))) {
    return { ok: false, reason: 'ts-invalido' };
  }
  if (typeof rec['kind'] !== 'string' || !KINDS.includes(rec['kind'])) {
    return { ok: false, reason: 'kind-invalido' };
  }
  if (typeof rec['source'] !== 'string' || !SOURCES.includes(rec['source'])) {
    return { ok: false, reason: 'source-invalido' };
  }
  const rid = rec['requestId'];
  if (typeof rid !== 'string' || rid.trim() === '' || rid.length > REQUEST_ID_MAX) {
    return { ok: false, reason: 'request-id-invalido' };
  }
  if (typeof rec['tenantHash'] !== 'string' || !TENANT_HASH_RE.test(rec['tenantHash'])) {
    return { ok: false, reason: 'tenant-hash-invalido (envie sha256-16hex; id puro é proibido)' };
  }
  if (!isJevDecisionMode(rec['mode'])) {
    return { ok: false, reason: 'modo-invalido' };
  }
  if (typeof rec['localStatus'] !== 'string' || !STATUSES.includes(rec['localStatus'])) {
    return { ok: false, reason: 'status-invalido' };
  }
  for (const field of ['localLabel', 'remoteLabel', 'expectedLabel'] as const) {
    const v = rec[field];
    if (v !== undefined && v !== null && !validLabel(v)) {
      return { ok: false, reason: `${field.toLowerCase()}-invalido` };
    }
  }
  const conf = rec['localConfidence'];
  if (conf !== undefined && conf !== null) {
    if (typeof conf !== 'number' || !Number.isFinite(conf) || conf < 0 || conf > 1) {
      return { ok: false, reason: 'confidencia-invalida' };
    }
  }
  const agreement = rec['agreement'];
  if (agreement !== undefined && agreement !== null && typeof agreement !== 'boolean') {
    return { ok: false, reason: 'agreement-invalido' };
  }
  if (rec['localStatus'] === 'pending' && rec['localLabel'] !== undefined && rec['localLabel'] !== null) {
    return { ok: false, reason: 'status-pendente-nao-aceita-label' };
  }
  return { ok: true };
}

export interface JevLedgerOptions {
  /** Máximo de entradas na janela (poda as mais antigas por seq). */
  capacity?: number;
  /** Idade máxima (ms) — poda por timestamp do evento. */
  retentionMs?: number;
  /** Clock injetável (determinismo em testes; default Date.now). */
  now?: () => number;
}

export interface JevLedgerStats {
  total: number;
  byKind: Record<string, number>;
  byMode: Record<string, number>;
  /** agreement === true (pares local-vs-remoto decididos). */
  matches: number;
  /** agreement === false. */
  mismatches: number;
  /** matches / (matches + mismatches) — null se nenhum par decidido. */
  agreementRate: number | null;
  /** Entradas com rótulo de referência presente (corpus/cerebro). */
  expectedLabeled: number;
  firstSeq: number | null;
  lastSeq: number | null;
}

export interface JevLedgerReport {
  wave: 'RUN24-A';
  generatedAt: string;
  ledger: JevLedgerStats;
  retention: { capacityEntries: number; retentionMs: number; lastPruned: number };
  invariants: {
    /** seq estritamente crescente na ordem de inserção. */
    seqMonotonic: boolean;
    /** Todos os tenantHash têm forma 16-hex (id puro estruturalmente ausente). */
    tenantHashOnly: boolean;
    /** Serialização das entradas não contém a chave "payload". */
    payloadNotSerialized: boolean;
    /** Todas as entradas armazenadas estão congeladas (imutáveis). */
    appendOnlyFrozen: boolean;
    /** Índice de dedupe coerente com a janela (sem duplicatas). */
    idempotentAppends: boolean;
  };
}

/**
 * Ledger apend-only com janela de memória, idempotência por contentHash,
 * retenção por idade/capacidade e exportação JSONL higienizada.
 */
export class JevLedger {
  private entries: JevLedgerEntry[] = [];
  private readonly hashIndex = new Map<string, number>();
  private seqCounter = 0;
  private prunedTotal = 0;
  private readonly capacity: number;
  private readonly retentionMs: number;
  private readonly nowFn: () => number;

  constructor(opts?: JevLedgerOptions) {
    this.capacity =
      typeof opts?.capacity === 'number' && Number.isFinite(opts.capacity) && opts.capacity > 0
        ? Math.floor(opts.capacity)
        : JEV_LEDGER_DEFAULT_CAPACITY;
    this.retentionMs =
      typeof opts?.retentionMs === 'number' && Number.isFinite(opts.retentionMs) && opts.retentionMs > 0
        ? Math.floor(opts.retentionMs)
        : JEV_LEDGER_DEFAULT_RETENTION_MS;
    this.nowFn = opts?.now ?? (() => Date.now());
  }

  /** Insere UMA entrada (validação fail-closed + dedupe). NUNCA lança. */
  append(draft: unknown): JevAppendResult {
    const check = validateJevLedgerDraft(draft);
    if (!check.ok) return { ok: false, reason: check.reason };
    const d = draft as JevLedgerDraft;
    const contentHash = ledgerContentHash(d);
    const existing = this.hashIndex.get(contentHash);
    if (existing !== undefined) {
      return { ok: true, seq: existing, duplicate: true };
    }
    this.seqCounter += 1;
    const entry: JevLedgerEntry = {
      seq: this.seqCounter,
      ts: d.ts,
      kind: d.kind,
      source: d.source,
      requestId: d.requestId,
      tenantHash: d.tenantHash,
      mode: d.mode,
      localStatus: d.localStatus,
      localLabel: d.localLabel ?? null,
      localConfidence: typeof d.localConfidence === 'number' ? d.localConfidence : null,
      remoteLabel: d.remoteLabel ?? null,
      agreement: typeof d.agreement === 'boolean' ? d.agreement : null,
      expectedLabel: d.expectedLabel ?? null,
      contentHash,
    };
    const frozen = Object.freeze(entry) as JevLedgerEntry;
    this.entries.push(frozen);
    this.hashIndex.set(contentHash, frozen.seq);
    this.prune();
    return { ok: true, seq: frozen.seq, duplicate: false };
  }

  /** Insere em lote. Sempre devolve UM resultado por draft (mesma ordem). */
  appendMany(drafts: readonly unknown[]): JevAppendResult[] {
    return drafts.map((d) => this.append(d));
  }

  /**
   * RETENÇÃO (a única forma de uma entrada sair do ledger):
   *  1) remove entradas com ts anterior a now - retentionMs;
   *  2) se ainda acima da capacidade, remove as mais antigas por seq.
   * Nunca reescreve entradas dentro da janela.
   */
  prune(): { pruned: number; remaining: number } {
    const cutoff = this.nowFn() - this.retentionMs;
    let pruned = 0;
    const kept: JevLedgerEntry[] = [];
    for (const e of this.entries) {
      const t = Date.parse(e.ts);
      if (Number.isFinite(t) && t < cutoff) {
        this.hashIndex.delete(e.contentHash);
        pruned += 1;
      } else {
        kept.push(e);
      }
    }
    while (kept.length > this.capacity) {
      const dropped = kept.shift();
      if (dropped) this.hashIndex.delete(dropped.contentHash);
      pruned += 1;
    }
    this.entries = kept;
    this.prunedTotal += pruned;
    return { pruned, remaining: this.entries.length };
  }

  /** Cópias de leitura (as entradas em si são congeladas na origem). */
  list(filter?: JevLedgerFilter): readonly JevLedgerEntry[] {
    let out = this.entries.slice();
    if (filter?.mode) out = out.filter((e) => e.mode === filter.mode);
    if (filter?.kind) out = out.filter((e) => e.kind === filter.kind);
    if (typeof filter?.limit === 'number' && filter.limit >= 0) {
      out = out.slice(Math.max(0, out.length - Math.floor(filter.limit)));
    }
    return out;
  }

  get size(): number {
    return this.entries.length;
  }

  get lastPruned(): number {
    return this.prunedTotal;
  }

  stats(): JevLedgerStats {
    const byKind: Record<string, number> = {};
    const byMode: Record<string, number> = {};
    let matches = 0;
    let mismatches = 0;
    let expectedLabeled = 0;
    for (const e of this.entries) {
      byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
      byMode[e.mode] = (byMode[e.mode] ?? 0) + 1;
      if (e.agreement === true) matches += 1;
      if (e.agreement === false) mismatches += 1;
      if (e.expectedLabel !== null) expectedLabeled += 1;
    }
    const decided = matches + mismatches;
    return {
      total: this.entries.length,
      byKind,
      byMode,
      matches,
      mismatches,
      agreementRate: decided > 0 ? matches / decided : null,
      expectedLabeled,
      firstSeq: this.entries.length > 0 ? this.entries[0].seq : null,
      lastSeq: this.entries.length > 0 ? this.entries[this.entries.length - 1].seq : null,
    };
  }

  /** Linhas JSONL (uma JSON por entrada, ordem de inserção). Sem payload por
   * construção — o método é defesa em profundidade para o sink. */
  exportJsonlLines(filter?: JevLedgerFilter): string[] {
    return this.list(filter).map((e) => JSON.stringify(e));
  }

  exportJsonl(filter?: JevLedgerFilter): string {
    return this.exportJsonlLines(filter).join('\n');
  }

  /** Relatório com invariantes provadas sobre o estado atual. */
  toReport(): JevLedgerReport {
    let seqMonotonic = true;
    for (let i = 1; i < this.entries.length; i += 1) {
      if (this.entries[i].seq <= this.entries[i - 1].seq) {
        seqMonotonic = false;
        break;
      }
    }
    const entriesSerialized = JSON.stringify(this.entries);
    return {
      wave: 'RUN24-A',
      generatedAt: new Date(this.nowFn()).toISOString(),
      ledger: this.stats(),
      retention: {
        capacityEntries: this.capacity,
        retentionMs: this.retentionMs,
        lastPruned: this.prunedTotal,
      },
      invariants: {
        seqMonotonic,
        tenantHashOnly: this.entries.every((e) => TENANT_HASH_RE.test(e.tenantHash)),
        payloadNotSerialized: !entriesSerialized.includes('"payload"'),
        appendOnlyFrozen: this.entries.every((e) => Object.isFrozen(e)),
        idempotentAppends: this.hashIndex.size === this.entries.length,
      },
    };
  }
}
