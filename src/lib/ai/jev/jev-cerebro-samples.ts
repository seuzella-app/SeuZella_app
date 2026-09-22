// ============================================================================
// JEV — Ponte de amostras REAIS do Cérebro (RUN24-A) — jev-cerebro-samples.ts
// ============================================================================
// Port (fonte plugável) + parser/normalizador PURO da exportação v1 de
// amostras do Cérebro. NÃO lê banco, NÃO lê rede, NÃO lê env nesta onda: a
// extração REAL dos dados existentes acontecerá na onda de fiação no Cérebro,
// IMPLEMENTANDO esta ponte (nova fonte, arquivo novo) — sem editar arquivo
// existente e sem tocar fluxo de produção.
//
// Fronteira da amostra (por construção):
//  - tenantId puro NUNCA sai do parser: vira hashTenantId (16 hex);
//  - payload passa pelo MESMO firewall da produção (allowlist por modo,
//    PII ofuscada, trunc 512); amostra sem campo útil após o firewall é
//    RECUSADA (fail-closed) — nada "entra para ver se serve";
//  - expectedLabel é opcional (amostra real pode chegar sem rótulo);
//  - fingerprint estável (sha256 do conteúdo) vira requestId — o dedupe do
//    ledger (contentHash) elimina re-exportações idênticas;
//  - Fuzzing-safe: NUNCA lança — qualquer entrada vira resultado tipado com
//    reason (a security test de fuzz do parser REMOTO fica para a integração).
// ============================================================================

import { createHash } from 'node:crypto';

import {
  isJevDecisionMode,
  type JevDecisionMode,
} from '../../../domain/decision/contracts/JevTypes';
import { JEV_MODE_ALLOWED_FIELDS, sanitizeJevPayload } from './jev-pii-firewall';
import { hashTenantId } from './jev-shadow';

/** Amostra do Cérebro JÁ higienizada (pronta para virar draft do ledger). */
export interface JevCerebroSample {
  /** sha256(tenantId) truncado — o id puro não atravessa o parser. */
  tenantHash: string;
  mode: JevDecisionMode;
  /** Payload minimizado pelo firewall (allowlist por modo, PII ofuscada). */
  payload: Record<string, string | number | boolean | Array<string | number | boolean>>;
  /** Rótulo de referência quando houver; null = amostra não rotulada. */
  expectedLabel: string | null;
  /** 'cerebro-' + fingerprint de conteúdo — base do dedupe no ledger. */
  requestId: string;
}

export type JevCerebroParseResult =
  | { ok: true; sample: JevCerebroSample }
  | { ok: false; reason: string };

const CEREBRO_TENANT_MAX = 256;
const CEREBRO_LABEL_MAX = 64;

/** Serialização estável de payload plano (ordem de chaves fixa). */
function stablePayloadString(
  payload: Record<string, string | number | boolean | Array<string | number | boolean>>,
): string {
  return Object.keys(payload)
    .sort()
    .map((k) => `${k}=${JSON.stringify(payload[k])}`)
    .join('|');
}

/** Fingerprint de conteúdo (16 hex) — igual conteúdo => igual fingerprint. */
export function cerebroFingerprint(parts: {
  tenantHash: string;
  mode: JevDecisionMode;
  payload: Record<string, string | number | boolean | Array<string | number | boolean>>;
  expectedLabel: string | null;
}): string {
  const canonical = `${parts.tenantHash}|${parts.mode}|${stablePayloadString(parts.payload)}|${parts.expectedLabel ?? ''}`;
  return createHash('sha256').update(canonical, 'utf8').digest('hex').slice(0, 16);
}

/** Todos os campos allowlisted de TODOS os modos (para capturar campos no
 * topo da amostra, além de rec.payload). */
const ALL_ALLOWED_FIELDS: readonly string[] = Array.from(
  new Set(Object.values(JEV_MODE_ALLOWED_FIELDS).flat()),
);

/**
 * Parser da amostra v1 do Cérebro. Formato esperado (JSON):
 *   { tenantId: string, mode: JevDecisionMode,
 *     payload?: objeto plano, ...campos allowlist no topo (text, channel...),
 *     expectedLabel?: string }
 * Nunca lança. Recusa: tenant ausente/vazio/longo/demo, modo inválido,
 * rótulo inválido, payload que sobra vazio após o firewall.
 */
export function parseCerebroSample(raw: unknown): JevCerebroParseResult {
  try {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      return { ok: false, reason: 'amostra-nao-objeto' };
    }
    const rec = raw as Record<string, unknown>;

    const tenantRaw = rec['tenantId'];
    if (typeof tenantRaw !== 'string') return { ok: false, reason: 'tenant-ausente' };
    const tenant = tenantRaw.trim();
    if (tenant === '') return { ok: false, reason: 'tenant-vazio' };
    if (tenant.length > CEREBRO_TENANT_MAX) return { ok: false, reason: 'tenant-muito-longo' };
    const tenantLower = tenant.toLowerCase();
    if (tenantLower === 'demo' || tenantLower.startsWith('demo-')) {
      return { ok: false, reason: 'tenant-demo-proibido' };
    }

    const modeRaw = rec['mode'];
    if (typeof modeRaw !== 'string' || !isJevDecisionMode(modeRaw)) {
      return { ok: false, reason: 'modo-invalido' };
    }

    let expectedLabel: string | null = null;
    if (rec['expectedLabel'] !== undefined && rec['expectedLabel'] !== null) {
      if (typeof rec['expectedLabel'] !== 'string') return { ok: false, reason: 'rotulo-invalido' };
      const label = rec['expectedLabel'].trim();
      if (label === '' || label.length > CEREBRO_LABEL_MAX) {
        return { ok: false, reason: 'rotulo-invalido' };
      }
      expectedLabel = label;
    }

    const candidate: Record<string, unknown> = {};
    const inner = rec['payload'];
    if (inner !== undefined && inner !== null) {
      if (typeof inner !== 'object' || Array.isArray(inner)) {
        return { ok: false, reason: 'payload-invalido' };
      }
      Object.assign(candidate, inner as Record<string, unknown>);
    }
    for (const field of ALL_ALLOWED_FIELDS) {
      if (rec[field] !== undefined) candidate[field] = rec[field];
    }
    const minimized = sanitizeJevPayload(modeRaw, candidate);
    if (Object.keys(minimized).length === 0) {
      return { ok: false, reason: 'payload-vazio-apos-firewall' };
    }

    const tenantHash = hashTenantId(tenant);
    const requestId = `cerebro-${cerebroFingerprint({
      tenantHash,
      mode: modeRaw,
      payload: minimized,
      expectedLabel,
    })}`;
    return {
      ok: true,
      sample: { tenantHash, mode: modeRaw, payload: minimized, expectedLabel, requestId },
    };
  } catch {
    return { ok: false, reason: 'excecao-no-parser' };
  }
}

export interface JevCerebroNormalizeResult {
  accepted: JevCerebroSample[];
  rejected: Array<{ index: number; reason: string }>;
}

/** Normaliza um lote (ex.: linhas de um export JSONL já parseado). */
export function normalizeCerebroSamples(raws: readonly unknown[]): JevCerebroNormalizeResult {
  const accepted: JevCerebroSample[] = [];
  const rejected: Array<{ index: number; reason: string }> = [];
  raws.forEach((raw, index) => {
    const parsed = parseCerebroSample(raw);
    if (parsed.ok) accepted.push(parsed.sample);
    else rejected.push({ index, reason: parsed.reason });
  });
  return { accepted, rejected };
}

/** Fonte de amostras (port). A fiação no Cérebro implementa isto num arquivo
 * NOVO (ex.: leitura read-only do banco local) sem editar código existente. */
export interface JevSampleSource {
  readonly sourceName: string;
  fetchSamples(): Promise<readonly unknown[]>;
}

/** Converte amostras higienizadas em drafts do ledger (kind cerebro-sample,
 * status pending — a decisão virá pelo runner em onda futura). */
export function toLedgerDrafts(
  samples: readonly JevCerebroSample[],
  opts?: { ts?: string },
): Array<import('./jev-ledger').JevLedgerDraft> {
  const ts = opts?.ts ?? new Date().toISOString();
  return samples.map((s) => ({
    ts,
    kind: 'cerebro-sample' as const,
    source: 'cerebro-export' as const,
    requestId: s.requestId,
    tenantHash: s.tenantHash,
    mode: s.mode,
    localStatus: 'pending' as const,
    localLabel: null,
    localConfidence: null,
    remoteLabel: null,
    agreement: null,
    expectedLabel: s.expectedLabel,
  }));
}
