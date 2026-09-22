// ============================================================================
// JEV — Testes do LEDGER (RUN24-A) — jev-ledger.test.ts
// ============================================================================
// Prova, no nível do ledger: (1) append-only (entrada congelada, seq
// monotônica); (2) idempotência por contentHash com ts FORA do hash;
// (3) fail-closed (payload recusado, tenant puro recusado, campo desconhecido
// recusado); (4) retenção por idade/capacidade com clock injetado;
// (5) higiene sobre a PRÓPRIA serialização (sem tenant puro, sem payload,
// canários de PII ausentes); (6) sinks locais (memória + arquivo append-only,
// desativado por default, nunca lança); (7) ponte Cérebro (parser firewall +
// fingerprint + drafts pending); (8) sem rede (fetch espiado).
// NOTA (lições RUN22/23): este suite NÃO muta process.env; registro
// condicional puro (if no collection); nenhum timer real (clock injetado).
// ============================================================================
import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  JevLedger,
  JEV_LEDGER_DEFAULT_RETENTION_MS,
  type JevLedgerDraft,
} from '../../lib/ai/jev/jev-ledger';
import { MemorySink, FileSink, flushLedgerToSink } from '../../lib/ai/jev/jev-ledger-sink';
import {
  parseCerebroSample,
  normalizeCerebroSamples,
  toLedgerDrafts,
} from '../../lib/ai/jev/jev-cerebro-samples';
import { hashTenantId } from '../../lib/ai/jev/jev-shadow';

const NOW = Date.parse('2026-09-22T22:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const clock = (): number => NOW;
const iso = (msOffset: number = 0): string => new Date(NOW + msOffset).toISOString();
const HASH1 = hashTenantId('tenant-ledger-01');

function shadowDraft(over: Partial<JevLedgerDraft> = {}): JevLedgerDraft {
  return {
    ts: iso(),
    kind: 'shadow-decision',
    source: 'runtime-shadow',
    requestId: 'sh-test-0001',
    tenantHash: HASH1,
    mode: 'INTENT',
    localStatus: 'ok',
    localLabel: 'RESERVA',
    localConfidence: 0.8,
    remoteLabel: null,
    agreement: null,
    expectedLabel: null,
    ...over,
  };
}

describe('ledger — append, append-only e idempotência', () => {
  it('append atribui seq monotônica e devolve entradas congeladas', () => {
    const ledger = new JevLedger({ now: clock });
    const r1 = ledger.append(shadowDraft({ requestId: 'sh-a' }));
    const r2 = ledger.append(shadowDraft({ requestId: 'sh-b' }));
    expect(r1).toMatchObject({ ok: true, seq: 1, duplicate: false });
    expect(r2).toMatchObject({ ok: true, seq: 2, duplicate: false });
    const entries = ledger.list();
    expect(Object.isFrozen(entries[0])).toBe(true);
    expect(ledger.stats().lastSeq).toBe(2);
  });

  it('append-only: nenhuma API muta entrada já armazenada', () => {
    const ledger = new JevLedger({ now: clock });
    ledger.append(shadowDraft({ requestId: 'sh-a', localLabel: 'RESERVA' }));
    const entry = ledger.list()[0];
    const before = entry.localLabel;
    try {
      (entry as { localLabel?: string | null }).localLabel = 'HACKEADO';
    } catch {
      // strict mode lança em objeto congelado — também é aceitável
    }
    expect(entry.localLabel).toBe(before);
    expect(ledger.list()[0].localLabel).toBe(before);
  });

  it('idempotência: mesmo conteúdo não duplica (ts FORA do contentHash)', () => {
    const ledger = new JevLedger({ now: clock });
    const first = ledger.append(shadowDraft({ requestId: 'sh-dup', ts: iso(0) }));
    const again = ledger.append(shadowDraft({ requestId: 'sh-dup', ts: iso(60_000) }));
    expect(first).toMatchObject({ ok: true, seq: 1, duplicate: false });
    expect(again).toMatchObject({ ok: true, seq: 1, duplicate: true });
    expect(ledger.size).toBe(1);
  });

  it('fail-closed: draft com payload é RECUSADO (PII nunca entra no ledger)', () => {
    const ledger = new JevLedger({ now: clock });
    const result = ledger.append({ ...shadowDraft(), payload: { canary: 'PII-CANARY-LEDGER-12345678' } });
    expect(result).toMatchObject({ ok: false, reason: 'payload-forbidden' });
    expect(ledger.size).toBe(0);
    expect(ledger.exportJsonl()).not.toContain('PII-CANARY-LEDGER-12345678');
  });

  it('fail-closed: tenantId puro recusado — só tenantHash 16-hex entra', () => {
    const ledger = new JevLedger({ now: clock });
    expect(ledger.append(shadowDraft({ tenantHash: 'tenant-ledger-01' }))).toMatchObject({ ok: false });
    expect(ledger.append(shadowDraft({ tenantHash: 'ABCDEF' }))).toMatchObject({ ok: false });
    expect(ledger.append(shadowDraft({ tenantHash: 'ZZZZZZZZZZZZZZZZ' }))).toMatchObject({ ok: false });
    expect(ledger.append(shadowDraft({ tenantHash: HASH1 }))).toMatchObject({ ok: true });
  });

  it('fail-closed: kind/source/ts/modo/status/campo desconhecido recusados', () => {
    const ledger = new JevLedger({ now: clock });
    expect(ledger.append(shadowDraft({ kind: 'generative' as unknown as JevLedgerDraft['kind'] }))).toMatchObject({ ok: false, reason: 'kind-invalido' });
    expect(ledger.append(shadowDraft({ source: 'openai' as unknown as JevLedgerDraft['source'] }))).toMatchObject({ ok: false, reason: 'source-invalido' });
    expect(ledger.append(shadowDraft({ ts: 'nao-e-data' }))).toMatchObject({ ok: false, reason: 'ts-invalido' });
    expect(ledger.append(shadowDraft({ mode: 'FINANCEIRO' as unknown as JevLedgerDraft['mode'] }))).toMatchObject({ ok: false, reason: 'modo-invalido' });
    expect(ledger.append(shadowDraft({ localStatus: 'aprovado' as unknown as JevLedgerDraft['localStatus'] }))).toMatchObject({ ok: false, reason: 'status-invalido' });
    expect(ledger.append({ ...shadowDraft(), extra: 1 })).toMatchObject({ ok: false, reason: 'campo-desconhecido:extra' });
    expect(ledger.append(null)).toMatchObject({ ok: false, reason: 'draft-invalido' });
    expect(ledger.size).toBe(0);
  });

  it('consistência: status pending não aceita label local (ponte Cérebro)', () => {
    const ledger = new JevLedger({ now: clock });
    expect(ledger.append(shadowDraft({ localStatus: 'pending', localLabel: 'RESERVA' }))).toMatchObject({
      ok: false,
      reason: 'status-pendente-nao-aceita-label',
    });
    expect(ledger.append(shadowDraft({ localStatus: 'pending', localLabel: null }))).toMatchObject({ ok: true });
  });
});

describe('retenção (única forma de saída — nunca reescreve dentro da janela)', () => {
  it('capacidade: as mais antigas por seq saem; seq global continua monotônica', () => {
    const ledger = new JevLedger({ capacity: 3, now: clock });
    for (const rid of ['sh-1', 'sh-2', 'sh-3', 'sh-4']) {
      ledger.append(shadowDraft({ requestId: rid }));
    }
    expect(ledger.size).toBe(3);
    expect(ledger.list().map((e) => e.requestId)).toEqual(['sh-2', 'sh-3', 'sh-4']);
    expect(ledger.list().map((e) => e.seq)).toEqual([2, 3, 4]);
  });

  it('idade: prune() remove entradas anteriores a now - retentionMs (clock injetado)', () => {
    const ledger = new JevLedger({ retentionMs: 5 * DAY, now: clock });
    ledger.append(shadowDraft({ requestId: 'sh-fresh' }));
    // entrada com ts de 40 dias atrás é podada JÁ no append (auto-prune)
    const old = ledger.append(shadowDraft({ requestId: 'sh-old', ts: iso(-40 * DAY) }));
    expect(old).toMatchObject({ ok: true, seq: 2, duplicate: false });
    expect(ledger.size).toBe(1);
    expect(ledger.lastPruned).toBe(1);
    expect(ledger.list()[0].requestId).toBe('sh-fresh');
  });

  it('histórico dentro da janela permanece idêntico byte a byte', () => {
    const ledger = new JevLedger({ capacity: 10, now: clock });
    ledger.append(shadowDraft({ requestId: 'sh-1' }));
    ledger.append(shadowDraft({ requestId: 'sh-2' }));
    const before = ledger.exportJsonl();
    ledger.append(shadowDraft({ requestId: 'sh-3' }));
    ledger.prune();
    const afterLines = ledger.exportJsonl().split('\n');
    expect(afterLines.slice(0, 2).join('\n')).toBe(before);
    expect(afterLines.length).toBe(3);
  });
});

describe('exportação JSONL, stats e relatório', () => {
  it('exportJsonl: linhas JSON válidas, sem chave payload, só tenant hash', () => {
    const ledger = new JevLedger({ now: clock });
    ledger.append(shadowDraft({ requestId: 'sh-1' }));
    const lines = ledger.exportJsonlLines();
    expect(lines.length).toBe(1);
    const parsed = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(parsed['payload']).toBeUndefined();
    expect(parsed['tenantHash']).toBe(HASH1);
    expect(parsed['requestId']).toBe('sh-1');
  });

  it('stats: agreementRate = matches/(matches+mismatch), pending/null fora do denominador', () => {
    const ledger = new JevLedger({ now: clock });
    ledger.append(shadowDraft({ requestId: 'a', agreement: true }));
    ledger.append(shadowDraft({ requestId: 'b', agreement: true }));
    ledger.append(shadowDraft({ requestId: 'c', agreement: false }));
    ledger.append(shadowDraft({ requestId: 'd', agreement: null }));
    ledger.append({ ...toLedgerDrafts([
      { tenantHash: HASH1, mode: 'LEAD', payload: { text: 'ola' }, expectedLabel: null, requestId: 'cerebro-x1' },
    ])[0] });
    const stats = ledger.stats();
    expect(stats.total).toBe(5);
    expect(stats.matches).toBe(2);
    expect(stats.mismatches).toBe(1);
    expect(stats.agreementRate).toBeCloseTo(2 / 3, 12);
    expect(stats.byKind['shadow-decision']).toBe(4);
    expect(stats.byKind['cerebro-sample']).toBe(1);
  });

  it('relatório: invariantes todas true em ledger não vazio', () => {
    const ledger = new JevLedger({ now: clock });
    ledger.append(shadowDraft({ requestId: 'a', agreement: true }));
    const report = ledger.toReport();
    expect(report.wave).toBe('RUN24-A');
    expect(report.invariants.seqMonotonic).toBe(true);
    expect(report.invariants.tenantHashOnly).toBe(true);
    expect(report.invariants.payloadNotSerialized).toBe(true);
    expect(report.invariants.appendOnlyFrozen).toBe(true);
    expect(report.invariants.idempotentAppends).toBe(true);
    expect(report.retention.retentionMs).toBe(JEV_LEDGER_DEFAULT_RETENTION_MS);
  });

  it('higiene sobre a serialização: canários PII nunca aparecem', () => {
    const ledger = new JevLedger({ now: clock });
    ledger.append(shadowDraft({ requestId: 'sh-1' }));
    ledger.append({ ...shadowDraft(), payload: { canary: 'PII-CANARY-LEDGER-12345678' } });
    const report = ledger.toReport();
    const serialized = JSON.stringify(report) + ledger.exportJsonl();
    expect(serialized.includes('tenant-ledger-01')).toBe(false);
    expect(serialized.includes('PII-CANARY-LEDGER-12345678')).toBe(false);
    expect(serialized.includes('"payload"')).toBe(false);
  });

  it('ledger novo: export vazio e stats zerados (agreementRate null)', () => {
    const ledger = new JevLedger({ now: clock });
    expect(ledger.exportJsonlLines()).toEqual([]);
    const stats = ledger.stats();
    expect(stats.total).toBe(0);
    expect(stats.agreementRate).toBeNull();
    expect(stats.firstSeq).toBeNull();
  });
});

describe('sinks locais (opt-in, fail-closed, sem rede)', () => {
  it('MemorySink: guarda linhas; recusa lote INTEIRO que excede capacidade', async () => {
    const sink = new MemorySink(3);
    const r1 = await sink.appendJsonl(['l1', 'l2']);
    expect(r1).toMatchObject({ ok: true, written: 2 });
    const r2 = await sink.appendJsonl(['l3', 'l4']);
    expect(r2).toMatchObject({ ok: false, reason: 'capacidade-memoria-atingida' });
    expect(sink.snapshot().length).toBe(2);
  });

  it('FileSink: append-only em tmpdir — segundo flush ACUMULA, nunca trunca', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'jev-ledger-test-'));
    try {
      const sink = new FileSink(dir);
      const r1 = await sink.appendJsonl(['{"a":1}', '{"a":2}', '{"a":3}']);
      expect(r1).toMatchObject({ ok: true, written: 3 });
      const r2 = await sink.appendJsonl(['{"a":4}', '{"a":5}']);
      expect(r2).toMatchObject({ ok: true, written: 2 });
      const content = readFileSync(path.join(dir, 'jev-ledger.jsonl'), 'utf8');
      expect(content.split('\n').filter((l) => l.trim() !== '').length).toBe(5);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('FileSink desativado (null): fail-closed com reason, sem escrever nada', async () => {
    const sink = new FileSink(null);
    expect(sink.name).toBe('file-disabled');
    const r = await sink.appendJsonl(['{"a":1}']);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('desativado');
  });

  it('FileSink: caminho inválido (arquivo no lugar de diretório) -> ok:false sem lançar', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'jev-ledger-bad-'));
    const filePath = path.join(dir, 'nao-e-diretorio');
    writeFileSync(filePath, 'x', 'utf8');
    try {
      const sink = new FileSink(filePath);
      const r = await sink.appendJsonl(['{"a":1}']);
      expect(r.ok).toBe(false);
      expect(r.reason).toMatch(/^fs-/);
      expect(r.written).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('flushLedgerToSink: written = linhas exportadas; ledger vazio -> written 0', async () => {
    const ledger = new JevLedger({ now: clock });
    const sink = new MemorySink();
    const empty = await flushLedgerToSink(ledger, sink);
    expect(empty).toMatchObject({ ok: true, written: 0 });
    ledger.append(shadowDraft({ requestId: 'sh-1' }));
    ledger.append(shadowDraft({ requestId: 'sh-2' }));
    const full = await flushLedgerToSink(ledger, sink);
    expect(full).toMatchObject({ ok: true, written: 2 });
    expect(sink.snapshot().length).toBe(2);
  });
});

describe('ponte Cérebro — parser firewall, fingerprint e drafts', () => {
  it('parser: PII ofuscada, campos fora da allowlist descartados, tenant hasheado', () => {
    const parsed = parseCerebroSample({
      tenantId: 'tenant-cerebro-alpha',
      mode: 'LEAD',
      text: 'ola, meu email e joao@example.com e meu telefone 11987654321, quero reservar para 4 pessoas',
      hasContact: true,
      partySize: 4,
      campoDesconhecido: 'ignorar',
      expectedLabel: 'LEAD_QUALIFICADO',
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const s = parsed.sample;
    expect(s.tenantHash).toBe(hashTenantId('tenant-cerebro-alpha'));
    expect(s.tenantHash).toMatch(/^[0-9a-f]{16}$/);
    expect(s.payload['text']).toContain('[redacted-email]');
    expect(s.payload['text']).toContain('[redacted-phone]');
    expect(String(s.payload['text'])).not.toContain('@');
    expect(String(s.payload['text'])).not.toContain('11987654321');
    expect(s.payload['hasContact']).toBe(true);
    expect(s.payload['partySize']).toBe(4);
    expect(s.payload['campoDesconhecido']).toBeUndefined();
    expect(s.expectedLabel).toBe('LEAD_QUALIFICADO');
    expect(s.requestId.startsWith('cerebro-')).toBe(true);
  });

  it('parser: tenant demo/vazio/ausente e modo inválido recusados', () => {
    expect(parseCerebroSample({ tenantId: 'demo', mode: 'INTENT', text: 'oi' })).toMatchObject({ ok: false, reason: 'tenant-demo-proibido' });
    expect(parseCerebroSample({ tenantId: 'demo-xyz', mode: 'INTENT', text: 'oi' })).toMatchObject({ ok: false, reason: 'tenant-demo-proibido' });
    expect(parseCerebroSample({ tenantId: '   ', mode: 'INTENT', text: 'oi' })).toMatchObject({ ok: false, reason: 'tenant-vazio' });
    expect(parseCerebroSample({ mode: 'INTENT', text: 'oi' })).toMatchObject({ ok: false, reason: 'tenant-ausente' });
    expect(parseCerebroSample({ tenantId: 'tenant-ok', mode: 'NAO_EXISTE' })).toMatchObject({ ok: false, reason: 'modo-invalido' });
  });

  it('parser fuzz: entradas absurdas NUNCA lançam e sempre dão reason', () => {
    const absurd: readonly unknown[] = [
      null, undefined, 42, 'texto puro', [], {},
      { tenantId: 'tenant-ok', mode: 'INTENT' },
      { tenantId: 'tenant-ok', mode: 'INTENT', payload: { so_campo_desconhecido: 1 } },
      { tenantId: 'x'.repeat(999), mode: 'INTENT', text: 'oi' },
      { tenantId: 'tenant-ok', mode: 'INTENT', text: 'oi', expectedLabel: 123 },
    ];
    for (const raw of absurd) {
      const r = parseCerebroSample(raw);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason.length).toBeGreaterThan(0);
    }
  });

  it('normalização em lote: accepted/rejected com índice e reason', () => {
    const result = normalizeCerebroSamples([
      { tenantId: 'tenant-ok-1', mode: 'INTENT', text: 'quero reservar' },
      'nao-sou-objeto',
      { tenantId: 'tenant-ok-2', mode: 'CHURN', recencyDays: 3, bookingCount: 2 },
    ]);
    expect(result.accepted.length).toBe(2);
    expect(result.rejected).toEqual([{ index: 1, reason: 'amostra-nao-objeto' }]);
  });

  it('drafts Cérebro: kind/source/status corretos e dedupe via fingerprint (ts fora do hash)', () => {
    const parsedA = parseCerebroSample({ tenantId: 'tenant-cerebro-gamma', mode: 'INTENT', text: 'quero cancelar minha reserva de amanha', channel: 'whatsapp', expectedLabel: 'CANCELAMENTO' });
    expect(parsedA.ok).toBe(true);
    if (!parsedA.ok) return;
    const drafts = toLedgerDrafts([parsedA.sample], { ts: iso(0) });
    expect(drafts.length).toBe(1);
    expect(drafts[0]).toMatchObject({
      kind: 'cerebro-sample',
      source: 'cerebro-export',
      localStatus: 'pending',
      expectedLabel: 'CANCELAMENTO',
      localLabel: null,
      agreement: null,
    });
    const ledger = new JevLedger({ now: clock });
    const r1 = ledger.append(drafts[0]);
    expect(r1).toMatchObject({ ok: true, seq: 1, duplicate: false });
    // re-exportação da MESMA amostra (ts diferente) => dedupe por contentHash
    const redraft = toLedgerDrafts([parsedA.sample], { ts: iso(9_000) })[0];
    const r2 = ledger.append(redraft);
    expect(r2).toMatchObject({ ok: true, seq: 1, duplicate: true });
    expect(ledger.size).toBe(1);
  });

  it('fetch global NUNCA é chamado (sem rede por construção)', async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error('REDE PROIBIDA NO LEDGER');
    });
    vi.stubGlobal('fetch', fetchSpy);
    try {
      const ledger = new JevLedger({ now: clock });
      const parsed = parseCerebroSample({ tenantId: 'tenant-ok', mode: 'INTENT', text: 'bom dia' });
      if (parsed.ok) ledger.append(toLedgerDrafts([parsed.sample])[0]);
      ledger.append(shadowDraft({ requestId: 'sh-net' }));
      await flushLedgerToSink(ledger, new MemorySink());
      await new FileSink(null).appendJsonl(['x']);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  // Evidência para o gate do driver: registrado SÓ quando o driver define
  // JEV_LEDGER_EVIDENCE_DIR (mesma rodada do vitest = fonte única).
  // Registro condicional puro (sem skipIf) — portável a qualquer vitest.
  if (process.env.JEV_LEDGER_EVIDENCE_DIR) {
    it('evidência: relatório JSON determinístico para o gate do driver', async () => {
      const ledger = new JevLedger({ capacity: 100, retentionMs: 30 * DAY, now: clock });

      // 6 entradas shadow-decision (4 com par local-vs-remoto: 2 match, 2 mismatch)
      ledger.append(shadowDraft({ requestId: 'sh-001', mode: 'INTENT', localLabel: 'RESERVA', localConfidence: 0.82, remoteLabel: 'RESERVA', agreement: true }));
      ledger.append(shadowDraft({ requestId: 'sh-002', mode: 'INTENT', localLabel: 'CANCELAMENTO', localConfidence: 0.64, remoteLabel: 'RESERVA', agreement: false }));
      ledger.append(shadowDraft({ requestId: 'sh-003', mode: 'SENTIMENT', localLabel: 'POSITIVO', localConfidence: 0.91, remoteLabel: 'POSITIVO', agreement: true }));
      ledger.append(shadowDraft({ requestId: 'sh-004', mode: 'SENTIMENT', localLabel: 'NEGATIVO', localConfidence: 0.55, remoteLabel: 'POSITIVO', agreement: false }));
      ledger.append(shadowDraft({ requestId: 'sh-005', mode: 'CHURN', localLabel: 'ALTO', localConfidence: 0.7 }));
      ledger.append(shadowDraft({ requestId: 'sh-006', mode: 'CHURN', localStatus: 'rejected', localLabel: null, localConfidence: null }));

      // 3 amostras Cérebro (com PII no cru) + 1 re-exportação idêntica (dedupe)
      const raws = [
        { tenantId: 'tenant-cerebro-alpha', mode: 'LEAD', text: 'ola, meu email e joao@example.com e meu telefone 11987654321, quero reservar para 4 pessoas', hasContact: true, partySize: 4, expectedLabel: 'LEAD_QUALIFICADO' },
        { tenantId: 'tenant-cerebro-beta', mode: 'UPSELL', payload: { partySize: 2, nights: 3, totalValue: 1500, tier: 'standard', observacao: 'campo-fora' }, text: 'quero upgrade para o chale premium' },
        { tenantId: 'tenant-cerebro-gamma', mode: 'INTENT', text: 'quero cancelar minha reserva de amanha', channel: 'whatsapp', expectedLabel: 'CANCELAMENTO' },
      ];
      const norm = normalizeCerebroSamples(raws);
      expect(norm.accepted.length).toBe(3);
      const dup = normalizeCerebroSamples([raws[0]]).accepted[0];
      const results = ledger.appendMany(toLedgerDrafts([...norm.accepted, dup], { ts: iso() }));
      expect(results.map((r) => (r.ok ? r.duplicate : null))).toEqual([false, false, false, true]);

      // tentativas inválidas (fail-closed) — canário NUNCA entra
      expect(ledger.append(shadowDraft({ tenantHash: 'tenant-ledger-01' })).ok).toBe(false);
      expect(ledger.append({ ...shadowDraft(), payload: { canary: 'PII-CANARY-LEDGER-12345678' } })).toMatchObject({ ok: false, reason: 'payload-forbidden' });

      // retenção: 1 entrada com 40 dias sai (auto-prune no append acumula 1)
      ledger.append(shadowDraft({ requestId: 'sh-old-0001', mode: 'ANOMALY', ts: iso(-40 * DAY) }));
      const pruned = ledger.prune();
      expect(pruned.remaining).toBe(9);

      // sink de arquivo em tmpdir (append-only) + limpeza
      const dir = mkdtempSync(path.join(os.tmpdir(), 'jev-ledger-ev-'));
      let written = 0;
      try {
        const sink = new FileSink(dir);
        const flushed = await flushLedgerToSink(ledger, sink);
        expect(flushed.ok).toBe(true);
        written = flushed.written;
        const fileContent = readFileSync(path.join(dir, 'jev-ledger.jsonl'), 'utf8');
        expect(fileContent.split('\n').filter((l) => l.trim() !== '').length).toBe(9);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }

      const report = ledger.toReport();
      const reportWithSink = {
        ...report,
        sink: { name: 'file:jev-ledger.jsonl', written, appendedOnly: true },
      };

      // números PINADOS (determinismo da evidência)
      expect(report.ledger.total).toBe(9);
      expect(report.ledger.byKind).toEqual({ 'shadow-decision': 6, 'cerebro-sample': 3 });
      expect(report.ledger.byMode).toEqual({ INTENT: 3, SENTIMENT: 2, CHURN: 2, LEAD: 1, UPSELL: 1 });
      expect(report.ledger.matches).toBe(2);
      expect(report.ledger.mismatches).toBe(2);
      expect(report.ledger.agreementRate).toBeCloseTo(0.5, 12);
      expect(report.ledger.expectedLabeled).toBe(2);
      expect(report.ledger.firstSeq).toBe(1);
      expect(report.ledger.lastSeq).toBe(9);
      expect(report.retention.lastPruned).toBe(1);
      expect(written).toBe(9);
      for (const key of ['seqMonotonic', 'tenantHashOnly', 'payloadNotSerialized', 'appendOnlyFrozen', 'idempotentAppends'] as const) {
        expect(report.invariants[key]).toBe(true);
      }

      // higiene sobre a PRÓPRIA serialização (relatório + export)
      const serialized = JSON.stringify(reportWithSink) + ledger.exportJsonl();
      for (const canary of [
        'tenant-ledger-01', 'tenant-cerebro-alpha', 'tenant-cerebro-beta', 'tenant-cerebro-gamma',
        'joao@example.com', '11987654321', 'PII-CANARY-LEDGER-12345678', '"payload"',
      ]) {
        expect(serialized.includes(canary)).toBe(false);
      }

      const outDir = process.env.JEV_LEDGER_EVIDENCE_DIR as string;
      mkdirSync(outDir, { recursive: true });
      writeFileSync(path.join(outDir, 'JEV_LEDGER_REPORT.json'), JSON.stringify(reportWithSink, null, 2));
      expect(statSync(path.join(outDir, 'JEV_LEDGER_REPORT.json')).size).toBeGreaterThan(0);
    });
  }
});
