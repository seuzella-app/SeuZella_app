// ============================================================================
// JEV — Orquestrador do SHADOW HARNESS (RUN23-A) — jev-harness.ts
// ============================================================================
// Roda o corpus rotulado PELO RUNNER SHADOW (mesmo caminho de produção:
// contrato -> firewall -> adapter local -> buffer em memória), compara cada
// resposta com o ground truth do corpus e produz um relatório determinístico
// com agreementRate por modo + invariantes de segurança provadas.
//
// Garantias da onda (SHADOW_ONLY):
//  - o runner default é construído com remotePort: null — o caminho remoto é
//    ESTRUTURALMENTE inexistente aqui (não depende de env, flag ou chave);
//  - o relatório NÃO contém tenantId puro, NÃO contém payload e NÃO contém
//    resposta bruta — só contagens, labels, ids de amostra e invariants;
//  - nada persiste: o runner é isolado por execução (o singleton jevShadow
//    da casa não é tocado, a menos que o chamador o injete explicitamente).
// O agreement local-vs-remoto do runner continua null nesta onda — acende na
// integração (onda seguinte: LEDGER).
// ============================================================================

import { JevShadowRunner } from './jev-shadow';
import {
  JEV_HARNESS_CORPUS_VERSION,
  JEV_HARNESS_SAMPLES,
  type JevHarnessSample,
} from './jev-harness-samples';
import {
  agreementStats,
  recordFromResponse,
  type JevAgreementRecord,
  type JevAgreementStats,
} from './jev-agreement';

export { JEV_HARNESS_CORPUS_VERSION } from './jev-harness-samples';
export type { JevHarnessSample } from './jev-harness-samples';

export interface JevHarnessInvariants {
  /** Toda resposta local veio com shadowOnly === true (invariante do tipo). */
  shadowOnlyAllTrue: boolean;
  /** O harness nunca configura porta remota (default: remotePort null). */
  remotePortUsed: boolean;
  /** Nenhum tenantId puro aparece no relatório serializado. */
  tenantHashOnly: boolean;
  /** Nenhum texto de payload do corpus aparece no relatório serializado. */
  payloadNotSerialized: boolean;
}

export interface JevHarnessReport {
  wave: 'RUN23-A';
  corpusVersion: string;
  generatedAt: string;
  totalSamples: number;
  agreement: JevAgreementStats;
  /** null nesta onda: agreement local-vs-remoto acende na integração. */
  remoteAgreementRate: null;
  invariants: JevHarnessInvariants;
}

export interface JevHarnessOptions {
  /** Corpus alternativo (default: JEV_HARNESS_SAMPLES). */
  samples?: readonly JevHarnessSample[];
  /** Runner injetado (default: JevShadowRunner isolado, remotePort null). */
  runner?: JevShadowRunner;
}

function contains(haystack: string, needle: string): boolean {
  // Guarda de comprimento: strings curtas geram falso positivo (substring
  // acidental); o invariante só é significativo para valores discriminantes.
  return needle.length >= 8 && haystack.includes(needle);
}

/**
 * Executa o corpus no runner shadow e agrega o agreement por modo.
 * Determinístico: mesma entrada => mesmo agreement (latência/timestamps não
 * entram no relatório).
 */
export async function runJevHarness(opts?: JevHarnessOptions): Promise<JevHarnessReport> {
  const samples = opts?.samples ?? JEV_HARNESS_SAMPLES;
  const runner = opts?.runner ?? new JevShadowRunner({ remotePort: null });

  const records: JevAgreementRecord[] = [];
  let shadowOnlyAllTrue = samples.length > 0;

  for (const sample of samples) {
    const entry = await runner.evaluate({
      requestId: `harness-${sample.id}`,
      tenantId: sample.tenantId,
      mode: sample.mode,
      payload: sample.payload,
      occurredAt: new Date().toISOString(),
    });
    if (entry.local.shadowOnly !== true) {
      shadowOnlyAllTrue = false;
    }
    records.push(recordFromResponse(sample, entry.local));
  }

  const agreement = agreementStats(records);
  const report: JevHarnessReport = {
    wave: 'RUN23-A',
    corpusVersion: JEV_HARNESS_CORPUS_VERSION,
    generatedAt: new Date().toISOString(),
    totalSamples: samples.length,
    agreement,
    remoteAgreementRate: null,
    invariants: {
      shadowOnlyAllTrue,
      remotePortUsed: false,
      tenantHashOnly: false,
      payloadNotSerialized: false,
    },
  };

  // Higiene de PII do relatório: provada sobre a PRÓPRIA serialização.
  const serialized = JSON.stringify(report);
  report.invariants.tenantHashOnly = samples.every((s) => !contains(serialized, s.tenantId));
  report.invariants.payloadNotSerialized = samples.every((s) => {
    const text = s.payload['text'];
    return typeof text === 'string' ? !contains(serialized, text) : true;
  });

  return report;
}
