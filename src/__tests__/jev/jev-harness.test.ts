// ============================================================================
// JEV — Testes do SHADOW HARNESS (RUN23-A) — jev-harness.test.ts
// ============================================================================
// Prová, no nível do harness: (1) corpus válido e independente da heurística;
// (2) execução integral pelo runner shadow com agreement determinístico;
// (3) divergências documentadas pinadas como especificação do baseline atual;
// (4) invariantes SHADOW_ONLY (sem rede, sem tenant puro, sem payload no
// relatório); (5) evidência JSON para o gate do driver quando o ambiente
// JEV_HARNESS_EVIDENCE_DIR está definido (no-op fora do driver).
// NOTA (lição RUN22-A r0): este suite NÃO muta process.env — nada aqui
// depende de NODE_ENV e nada atribui/deleta chaves de ambiente.
// ============================================================================
import { describe, it, expect, vi } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

import {
  JEV_HARNESS_CORPUS_VERSION,
  JEV_HARNESS_SAMPLES,
} from '../../lib/ai/jev/jev-harness-samples';
import {
  agreementStats,
  recordFromResponse,
} from '../../lib/ai/jev/jev-agreement';
import { runJevHarness } from '../../lib/ai/jev/jev-harness';
import { JevShadowRunner } from '../../lib/ai/jev/jev-shadow';
import type { IJevDecisionPort } from '../../domain/decision/ports/IJevDecisionPort';
import type { JevDecisionResponse } from '../../domain/decision/contracts/JevTypes';

function stubPort(label: string): IJevDecisionPort {
  return {
    source: 'jev-local-heuristic',
    decide: async () =>
      ({
        status: 'ok',
        mode: 'INTENT',
        source: 'jev-local-heuristic',
        decision: { label, confidence: 0.9 },
        shadowOnly: true,
        latencyMs: 1,
      }) as JevDecisionResponse,
  };
}

describe('corpus v1 — forma, unicidade e higiene', () => {
  it('tem 28 amostras, ids únicos e >= 4 por modo', () => {
    expect(JEV_HARNESS_SAMPLES.length).toBe(28);
    const ids = new Set(JEV_HARNESS_SAMPLES.map((s) => s.id));
    expect(ids.size).toBe(JEV_HARNESS_SAMPLES.length);
    const perMode: Record<string, number> = {};
    for (const s of JEV_HARNESS_SAMPLES) perMode[s.mode] = (perMode[s.mode] ?? 0) + 1;
    for (const n of Object.values(perMode)) expect(n).toBeGreaterThanOrEqual(4);
    expect(Object.keys(perMode).length).toBe(7);
  });

  it('toda amostra tem forma válida (tenant sintético, rótulo e nota presentes)', () => {
    for (const s of JEV_HARNESS_SAMPLES) {
      expect(s.tenantId.startsWith('tenant-harness-')).toBe(true);
      expect(s.tenantId.toLowerCase().includes('demo')).toBe(false);
      expect(s.expectedLabel.length).toBeGreaterThan(0);
      expect(s.note.length).toBeGreaterThan(0);
      expect(typeof s.payload).toBe('object');
      expect(s.payload).not.toBeNull();
      expect(Array.isArray(s.payload)).toBe(false);
    }
  });

  it('textos são sintéticos e sem PII (sem @, sem sequência de 3+ dígitos)', () => {
    for (const s of JEV_HARNESS_SAMPLES) {
      const text = s.payload['text'];
      if (typeof text === 'string') {
        expect(text).not.toContain('@');
        expect(/\d{3,}/.test(text)).toBe(false);
      }
    }
  });

  it('versão do corpus registrada', () => {
    expect(JEV_HARNESS_CORPUS_VERSION).toBe('jev-harness-corpus-v1');
  });
});

describe('runJevHarness — execução integral pelo runner shadow', () => {
  it('roda as 28 amostras e contabiliza tudo (nada perdido)', async () => {
    const report = await runJevHarness();
    expect(report.wave).toBe('RUN23-A');
    expect(report.totalSamples).toBe(28);
    expect(report.agreement.total).toBe(28);
    const summed =
      report.agreement.matches +
      report.agreement.mismatches +
      report.agreement.rejected +
      report.agreement.unavailable;
    expect(summed).toBe(28);
    expect(report.agreement.rejected).toBe(0);
    expect(report.agreement.unavailable).toBe(0);
  });

  it('agreementRate global = matches / (matches + mismatches), em [0,1]', async () => {
    const report = await runJevHarness();
    const rate = report.agreement.agreementRate;
    expect(rate).not.toBeNull();
    if (rate === null) return;
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThanOrEqual(1);
    const decided = report.agreement.matches + report.agreement.mismatches;
    expect(rate).toBeCloseTo(report.agreement.matches / decided, 12);
  });

  it('âncoras de coerência corpus<->heurística (match garantido)', async () => {
    const report = await runJevHarness();
    const intent = report.agreement.byMode['INTENT'];
    expect(intent).toBeDefined();
    expect(intent.divergences.map((d) => d.sampleId)).not.toContain('INT-001');
    const anomaly = report.agreement.byMode['ANOMALY'];
    expect(anomaly.matches).toBe(4);
    const upsell = report.agreement.byMode['UPSELL'];
    expect(upsell.matches).toBe(4);
  });

  it('divergências documentadas pinadas (especificação do baseline atual)', async () => {
    const report = await runJevHarness();
    const divergent = new Map<string, { expected: string; got: string | null }>();
    for (const bucket of Object.values(report.agreement.byMode)) {
      for (const d of bucket.divergences) divergent.set(d.sampleId, d);
    }
    expect(divergent.size).toBe(3);
    expect(divergent.get('INT-002')).toMatchObject({ expected: 'CANCELAMENTO', got: 'RESERVA' });
    expect(divergent.get('CHU-004')).toMatchObject({ expected: 'MEDIO', got: 'ALTO' });
    expect(divergent.get('LEA-003')).toMatchObject({
      expected: 'LEAD_QUALIFICADO',
      got: 'NAO_QUALIFICADO',
    });
  });

  it('invariantes SHADOW_ONLY todos verdadeiros', async () => {
    const report = await runJevHarness();
    expect(report.invariants.shadowOnlyAllTrue).toBe(true);
    expect(report.invariants.remotePortUsed).toBe(false);
    expect(report.invariants.tenantHashOnly).toBe(true);
    expect(report.invariants.payloadNotSerialized).toBe(true);
  });

  it('determinístico: duas execuções produzem o mesmo agreement', async () => {
    const a = await runJevHarness();
    const b = await runJevHarness();
    expect(JSON.stringify(a.agreement)).toBe(JSON.stringify(b.agreement));
    expect(JSON.stringify(a.invariants)).toBe(JSON.stringify(b.invariants));
  });

  it('motor desacoplado: stub com label fixo vira mismatch em tudo', async () => {
    const runner = new JevShadowRunner({ localPort: stubPort('STUB_LABEL'), remotePort: null });
    const report = await runJevHarness({ runner });
    expect(report.agreement.matches).toBe(0);
    expect(report.agreement.mismatches).toBe(28);
    expect(report.agreement.agreementRate).toBe(0);
  });

  it('fetch global NUNCA é chamado (sem rede por construção)', async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error('REDE PROIBIDA NO HARNESS');
    });
    vi.stubGlobal('fetch', fetchSpy);
    try {
      const report = await runJevHarness();
      expect(report.totalSamples).toBe(28);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('relatório não contém tenantId puro nem texto de payload (higiene PII)', async () => {
    const report = await runJevHarness();
    const serialized = JSON.stringify(report);
    for (const s of JEV_HARNESS_SAMPLES) {
      expect(serialized.includes(s.tenantId)).toBe(false);
      const text = s.payload['text'];
      if (typeof text === 'string' && text.length >= 8) {
        expect(serialized.includes(text)).toBe(false);
      }
    }
  });

  it('recordFromResponse mapeia os 4 status sem lançar', () => {
    const sample = { id: 'X-1', mode: 'INTENT' as const, expectedLabel: 'RESERVA' };
    const ok = recordFromResponse(sample, {
      status: 'ok',
      mode: 'INTENT',
      source: 'jev-local-heuristic',
      decision: { label: 'RESERVA', confidence: 0.75 },
      shadowOnly: true,
      latencyMs: 0,
    });
    expect(ok.status).toBe('match');
    const bad = recordFromResponse(sample, {
      status: 'ok',
      mode: 'INTENT',
      source: 'jev-local-heuristic',
      decision: { label: 'OUTRO', confidence: 0.4 },
      shadowOnly: true,
      latencyMs: 0,
    });
    expect(bad.status).toBe('mismatch');
    const unavailable = recordFromResponse(sample, {
      status: 'unavailable',
      mode: 'INTENT',
      reason: 'JEV_DISABLED',
      shadowOnly: true,
      latencyMs: 0,
    });
    expect(unavailable.status).toBe('unavailable');
    const rejected = recordFromResponse(sample, {
      status: 'rejected',
      mode: 'INTENT',
      reason: 'JEV_MODE_INVALID',
      shadowOnly: true,
      latencyMs: 0,
    });
    expect(rejected.status).toBe('rejected');
    const empty = agreementStats([]);
    expect(empty.agreementRate).toBeNull();
  });

  // Evidência para o gate do driver: o teste só é REGISTRADO quando o
  // ambiente JEV_HARNESS_EVIDENCE_DIR está definido (rodada do driver).
  // Registro condicional puro (sem skipIf/skip tipado) — portável a qualquer
  // versão de vitest; zero efeito colateral em execuções normais do projeto.
  if (process.env.JEV_HARNESS_EVIDENCE_DIR) {
    it('evidência: relatório JSON escrito para o gate do driver', async () => {
      const report = await runJevHarness();
      const outDir = process.env.JEV_HARNESS_EVIDENCE_DIR as string;
      mkdirSync(outDir, { recursive: true });
      writeFileSync(
        path.join(outDir, 'JEV_HARNESS_REPORT.json'),
        JSON.stringify(report, null, 2),
      );
      expect(report.invariants.shadowOnlyAllTrue).toBe(true);
      expect(report.invariants.tenantHashOnly).toBe(true);
      expect(report.invariants.payloadNotSerialized).toBe(true);
      expect(report.totalSamples).toBe(report.agreement.total);
    });
  }
});
