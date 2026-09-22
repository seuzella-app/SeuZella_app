// ============================================================================
// JEV — Motor de agreement do SHADOW HARNESS (RUN23-A) — jev-agreement.ts
// ============================================================================
// Compara a resposta do baseline local (heurística) com o rótulo de referência
// do corpus (ground truth INDEPENDENTE do código) e agrega a métrica por modo.
//
// Definição única e explícita:
//   agreementRate = matches / (matches + mismatches)
//   — conta APENAS amostras decididas (status 'ok'). Amostras rejected/
//     unavailable ficam fora do denominador e são reportadas à parte, para
//     que indisponibilidade nunca "inflacione" nem "esconda" qualidade.
//
// O agreement local-vs-remoto (heurística vs Jev/TypeSafe) continua sendo
// papel do runner shadow (jev-shadow) e só acende na onda de integração —
// aqui medimos o baseline contra o ground truth para dizer ONDE o remoto
// vale o custo. Nada lança; nada toca rede; nada persiste.
// ============================================================================

import type {
  JevDecisionMode,
  JevDecisionResponse,
} from '../../../domain/decision/contracts/JevTypes';

export type JevAgreementStatus = 'match' | 'mismatch' | 'rejected' | 'unavailable';

/** Resultado de UMA amostra do corpus contra a resposta do baseline. */
export interface JevAgreementRecord {
  sampleId: string;
  mode: JevDecisionMode;
  expectedLabel: string;
  /** Label produzido pelo baseline (null se rejected/unavailable). */
  gotLabel: string | null;
  /** Confiança reportada pelo baseline (null se não decidiu). */
  confidence: number | null;
  status: JevAgreementStatus;
}

/** Agregação por modo. divergences lista ONDE o baseline errou (o mapa de
 * calor para a escada de custo da diretiva). */
export interface JevModeAgreement {
  mode: JevDecisionMode;
  n: number;
  matches: number;
  mismatches: number;
  rejected: number;
  unavailable: number;
  /** matches / (matches + mismatches) — null se o modo não decidiu nada. */
  agreementRate: number | null;
  divergences: Array<{ sampleId: string; expected: string; got: string | null }>;
}

export interface JevAgreementStats {
  total: number;
  matches: number;
  mismatches: number;
  rejected: number;
  unavailable: number;
  /** matches / (matches + mismatches) — null se nenhuma amostra decidiu. */
  agreementRate: number | null;
  byMode: Record<string, JevModeAgreement>;
}

/** Entrada mínima que o motor precisa da amostra (evita acoplamento ao corpus). */
export interface JevAgreementSampleRef {
  id: string;
  mode: JevDecisionMode;
  expectedLabel: string;
}

/** Converte UMA resposta do baseline em registro de agreement. Nunca lança. */
export function recordFromResponse(
  sample: JevAgreementSampleRef,
  response: JevDecisionResponse,
): JevAgreementRecord {
  if (response.status === 'ok') {
    return {
      sampleId: sample.id,
      mode: sample.mode,
      expectedLabel: sample.expectedLabel,
      gotLabel: response.decision.label,
      confidence: response.decision.confidence,
      status: response.decision.label === sample.expectedLabel ? 'match' : 'mismatch',
    };
  }
  if (response.status === 'unavailable') {
    return {
      sampleId: sample.id,
      mode: sample.mode,
      expectedLabel: sample.expectedLabel,
      gotLabel: null,
      confidence: null,
      status: 'unavailable',
    };
  }
  return {
    sampleId: sample.id,
    mode: sample.mode,
    expectedLabel: sample.expectedLabel,
    gotLabel: null,
    confidence: null,
    status: 'rejected',
  };
}

/** Agrega registros em stats por modo. Determinístico (ordem de entrada). */
export function agreementStats(records: readonly JevAgreementRecord[]): JevAgreementStats {
  const byMode: Record<string, JevModeAgreement> = {};
  let matches = 0;
  let mismatches = 0;
  let rejected = 0;
  let unavailable = 0;

  for (const r of records) {
    const bucket = byMode[r.mode] ?? {
      mode: r.mode,
      n: 0,
      matches: 0,
      mismatches: 0,
      rejected: 0,
      unavailable: 0,
      agreementRate: null,
      divergences: [],
    };
    bucket.n += 1;
    if (r.status === 'match') {
      matches += 1;
      bucket.matches += 1;
    } else if (r.status === 'mismatch') {
      mismatches += 1;
      bucket.mismatches += 1;
      bucket.divergences.push({ sampleId: r.sampleId, expected: r.expectedLabel, got: r.gotLabel });
    } else if (r.status === 'rejected') {
      rejected += 1;
      bucket.rejected += 1;
    } else {
      unavailable += 1;
      bucket.unavailable += 1;
    }
    byMode[r.mode] = bucket;
  }

  const decided = matches + mismatches;
  for (const bucket of Object.values(byMode)) {
    const bucketDecided = bucket.matches + bucket.mismatches;
    bucket.agreementRate = bucketDecided > 0 ? bucket.matches / bucketDecided : null;
  }

  return {
    total: records.length,
    matches,
    mismatches,
    rejected,
    unavailable,
    agreementRate: decided > 0 ? matches / decided : null,
    byMode,
  };
}
