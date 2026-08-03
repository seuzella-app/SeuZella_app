'use client';

// =============================================================================
// CEREBRO TEST PANEL — painel de testes do Cérebro Zélla
// =============================================================================
// 6 testes por subsistema, cada um forçando seu próprio fluxo:
//
//   1. PIPELINE COGNITIVO     (peso 25%)  GET  /api/brain/health
//   2. ANOMALY DETECTOR       (peso 15%)  GET  /api/zcc/cerebro/anomalies
//   3. CÉREBRO ANALYZE        (peso 20%)  POST /api/cron/cerebro-analyze
//   4. REFACTOR SUGGESTER     (peso 20%)  POST /api/cron/cerebro-refactor-check
//                                            + GET /api/zcc/cerebro/refactors
//   5. CONVERSATION LEARNER   (peso 10%)  GET  /api/brain/intents
//   6. ALERT BUS              (peso 10%)  POST /api/zcc/cerebro/test-alert
//
// Score final 0-100% = soma ponderada dos 6 testes.
// Cada teste retorna:
//   - status: 'idle' | 'running' | 'pass' | 'fail' | 'warn'
//   - durationMs
//   - output (resposta bruta do endpoint)
//   - signal (síntese do sinal de aprendizado)
//   - score (0-100 relativo ao subsistema)
//
// Modo MOCK garantido — nenhum teste consome tokens GLM.
// =============================================================================

import { useState, useCallback, useEffect } from 'react';
import {
  Brain, Activity, Zap, Code, MessageSquare, Bell,
  Play, PlayCircle, CheckCircle2, XCircle, AlertCircle,
  Loader2, RefreshCw, ChevronDown, ChevronRight, Clock,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

type TestStatus = 'idle' | 'running' | 'pass' | 'fail' | 'warn';

interface TestResult {
  status: TestStatus;
  durationMs?: number;
  output?: any;
  signal?: string;
  score: number; // 0-100 within this test
  error?: string;
  ranAt?: string;
}

interface TestDef {
  id: string;
  name: string;
  desc: string;
  weight: number; // % of total score
  icon: React.ElementType;
  endpoint: string;
  method: 'GET' | 'POST';
  body?: any;
  run: () => Promise<TestResult>;
}

// ── Test definitions ────────────────────────────────────────────────────────

const TESTS: TestDef[] = [
  // ── 1. PIPELINE COGNITIVO ────────────────────────────────────────────────
  {
    id: 'pipeline',
    name: 'Pipeline Cognitivo',
    desc: 'Health check do pipeline principal — latência, cache hit, intents',
    weight: 25,
    icon: Brain,
    endpoint: '/api/brain/health',
    method: 'GET',
    run: async () => {
      const start = Date.now();
      try {
        const res = await fetch('/api/brain/health');
        const durationMs = Date.now() - start;
        if (!res.ok) {
          return {
            status: 'fail' as TestStatus,
            durationMs,
            score: 0,
            error: `HTTP ${res.status}`,
          };
        }
        const data = await res.json();
        const hasStats = data && (data.cacheHitRate != null || data.totalRequests != null || data.avgLatencyMs != null);
        const latency = data?.avgLatencyMs ?? 0;
        const cacheHit = data?.cacheHitRate ?? 0;

        let score = 0;
        let status: TestStatus = 'fail';
        let signal = '';

        if (hasStats) {
          score = 50;
          status = 'warn';
          signal = `Pipeline responde — latência ${latency}ms, cache hit ${(cacheHit * 100).toFixed(1)}%`;
        }
        if (latency > 0 && latency < 5000) {
          score = 75;
          status = 'pass';
          signal = `Pipeline saudável — latência ${latency}ms, cache hit ${(cacheHit * 100).toFixed(1)}%`;
        }
        if (cacheHit > 0.1) {
          score = 100;
          status = 'pass';
          signal = `Pipeline ótimo — latência ${latency}ms, cache hit ${(cacheHit * 100).toFixed(1)}% (>10%)`;
        }

        return {
          status,
          durationMs,
          output: data,
          signal,
          score,
          ranAt: new Date().toISOString(),
        };
      } catch (e: any) {
        return {
          status: 'fail' as TestStatus,
          durationMs: Date.now() - start,
          score: 0,
          error: e.message,
        };
      }
    },
  },

  // ── 2. ANOMALY DETECTOR ──────────────────────────────────────────────────
  {
    id: 'anomaly',
    name: 'Anomaly Detector',
    desc: 'Lista anomalias detectadas — valida que o detector está rodando',
    weight: 15,
    icon: Activity,
    endpoint: '/api/zcc/cerebro/anomalies',
    method: 'GET',
    run: async () => {
      const start = Date.now();
      try {
        const res = await fetch('/api/zcc/cerebro/anomalies');
        const durationMs = Date.now() - start;
        if (!res.ok) {
          return {
            status: 'fail' as TestStatus,
            durationMs,
            score: 0,
            error: `HTTP ${res.status}`,
          };
        }
        const data = await res.json();
        const anomalies = Array.isArray(data.anomalies) ? data.anomalies : Array.isArray(data) ? data : [];
        const count = anomalies.length;
        const unack = anomalies.filter((a: any) => !a.acknowledgedAt).length;

        let score = 0;
        let status: TestStatus = 'fail';
        let signal = '';

        if (count === 0) {
          // Sem anomalias é bom sinal — detector rodou e nada encontrou
          score = 75;
          status = 'pass';
          signal = 'Detector operacional — 0 anomalias nos últimos 15min (sistema saudável)';
        } else if (unack > 0) {
          score = 50;
          status = 'warn';
          signal = `${count} anomalias detectadas, ${unack} não acknowledged — revise`;
        } else {
          score = 100;
          status = 'pass';
          signal = `${count} anomalias detectadas e todas acknowledged`;
        }

        return {
          status,
          durationMs,
          output: data,
          signal,
          score,
          ranAt: new Date().toISOString(),
        };
      } catch (e: any) {
        return {
          status: 'fail' as TestStatus,
          durationMs: Date.now() - start,
          score: 0,
          error: e.message,
        };
      }
    },
  },

  // ── 3. CÉREBRO ANALYZE ───────────────────────────────────────────────────
  {
    id: 'analyze',
    name: 'Cérebro Analyze',
    desc: 'Roda ciclo manual de análise de anomalias (cron 15min simulado)',
    weight: 20,
    icon: Zap,
    endpoint: '/api/cron/cerebro-analyze',
    method: 'POST',
    run: async () => {
      const start = Date.now();
      try {
        const res = await fetch('/api/cron/cerebro-analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const durationMs = Date.now() - start;
        if (!res.ok) {
          return {
            status: 'fail' as TestStatus,
            durationMs,
            score: 0,
            error: `HTTP ${res.status}`,
          };
        }
        const data = await res.json();
        const mode = data.mode ?? data.cerebroMode ?? 'unknown';
        const analyzed = data.anomaliesAnalyzed ?? data.analyzed ?? 0;
        const analyses = data.analysesCreated ?? data.analyses ?? 0;

        let score = 0;
        let status: TestStatus = 'fail';
        let signal = '';

        if (mode === 'mock' || mode === 'live') {
          score = 60;
          status = 'warn';
          signal = `Ciclo rodou em modo ${mode.toUpperCase()} — ${analyzed} anomalias analisadas, ${analyses} análises criadas`;
        }
        if (analyzed > 0 || analyses > 0) {
          score = 85;
          status = 'pass';
          signal = `Ciclo produtivo em modo ${mode.toUpperCase()} — ${analyses} análise(s) persistida(s) no DB`;
        }
        if (mode === 'mock' && analyzed === 0 && analyses === 0) {
          score = 75;
          status = 'pass';
          signal = `Ciclo em MODO MOCK rodou sem erros — sem anomalias para analisar (sistema saudável)`;
        }

        return {
          status,
          durationMs,
          output: data,
          signal,
          score,
          ranAt: new Date().toISOString(),
        };
      } catch (e: any) {
        return {
          status: 'fail' as TestStatus,
          durationMs: Date.now() - start,
          score: 0,
          error: e.message,
        };
      }
    },
  },

  // ── 4. REFACTOR SUGGESTER ────────────────────────────────────────────────
  {
    id: 'refactor',
    name: 'Refactor Suggester',
    desc: 'Força checagem de erros recorrentes + lista sugestões pending',
    weight: 20,
    icon: Code,
    endpoint: '/api/cron/cerebro-refactor-check (POST) + /api/zcc/cerebro/refactors (GET)',
    method: 'POST',
    run: async () => {
      const start = Date.now();
      try {
        // 1. Roda checagem de erros recorrentes
        const [checkRes, listRes] = await Promise.all([
          fetch('/api/cron/cerebro-refactor-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          }),
          fetch('/api/zcc/cerebro/refactors'),
        ]);
        const durationMs = Date.now() - start;

        if (!checkRes.ok) {
          return {
            status: 'fail' as TestStatus,
            durationMs,
            score: 0,
            error: `check HTTP ${checkRes.status}`,
          };
        }
        const checkData = await checkRes.json();
        const listData = listRes.ok ? await listRes.json() : { suggestions: [] };
        const suggestions = Array.isArray(listData.suggestions) ? listData.suggestions : [];
        const pending = suggestions.filter((s: any) => s.status === 'pending_review' || s.status === 'pending');
        const applied = suggestions.filter((s: any) => s.status === 'applied');
        const rejected = suggestions.filter((s: any) => s.status === 'rejected');
        const mode = checkData.mode ?? 'unknown';

        let score = 0;
        let status: TestStatus = 'fail';
        let signal = '';

        if (mode === 'mock' || mode === 'live') {
          score = 50;
          status = 'warn';
          signal = `Checagem rodou em modo ${mode.toUpperCase()} — ${suggestions.length} sugestões no total`;
        }
        if (suggestions.length > 0) {
          score = 75;
          status = 'pass';
          signal = `${suggestions.length} sugestões — ${pending.length} pending, ${applied.length} applied, ${rejected.length} rejected`;
        }
        if (applied > 0) {
          score = 100;
          status = 'pass';
          signal = `APRENDIZADO ATIVO: ${applied.length} sugestões aplicadas → geraram KnowledgeChunks com source='refactor_applied'`;
        }

        return {
          status,
          durationMs,
          output: { check: checkData, list: listData },
          signal,
          score,
          ranAt: new Date().toISOString(),
        };
      } catch (e: any) {
        return {
          status: 'fail' as TestStatus,
          durationMs: Date.now() - start,
          score: 0,
          error: e.message,
        };
      }
    },
  },

  // ── 5. CONVERSATION LEARNER ──────────────────────────────────────────────
  {
    id: 'conversation',
    name: 'Conversation Learner',
    desc: 'Lista intents conhecidos + stats de aprendizado por tenant',
    weight: 10,
    icon: MessageSquare,
    endpoint: '/api/brain/intents',
    method: 'GET',
    run: async () => {
      const start = Date.now();
      try {
        const res = await fetch('/api/brain/intents');
        const durationMs = Date.now() - start;
        if (!res.ok) {
          return {
            status: 'fail' as TestStatus,
            durationMs,
            score: 0,
            error: `HTTP ${res.status}`,
          };
        }
        const data = await res.json();
        const intents = Array.isArray(data.intents) ? data.intents : Array.isArray(data) ? data : [];
        const stats = data.stats ?? data.learningStats ?? null;
        const samples = stats?.totalSamples ?? stats?.samplesCollected ?? 0;
        const accuracy = stats?.accuracy ?? stats?.intentAccuracy ?? 0;

        let score = 0;
        let status: TestStatus = 'fail';
        let signal = '';

        if (intents.length > 0) {
          score = 60;
          status = 'warn';
          signal = `${intents.length} intents cadastrados — aprendizado aguarda conversas reais`;
        }
        if (samples > 0) {
          score = 85;
          status = 'pass';
          signal = `${intents.length} intents, ${samples} amostras coletadas, accuracy ${(accuracy * 100).toFixed(1)}%`;
        }
        if (samples > 10 && accuracy > 0.5) {
          score = 100;
          status = 'pass';
          signal = `APRENDIZADO ATIVO: ${samples} amostras, accuracy ${(accuracy * 100).toFixed(1)}% (>50%)`;
        }

        return {
          status,
          durationMs,
          output: data,
          signal,
          score,
          ranAt: new Date().toISOString(),
        };
      } catch (e: any) {
        return {
          status: 'fail' as TestStatus,
          durationMs: Date.now() - start,
          score: 0,
          error: e.message,
        };
      }
    },
  },

  // ── 6. ALERT BUS ─────────────────────────────────────────────────────────
  {
    id: 'alert',
    name: 'Alert Bus',
    desc: 'Dispara alerta de teste (severity: info) e valida canais',
    weight: 10,
    icon: Bell,
    endpoint: '/api/zcc/cerebro/test-alert',
    method: 'POST',
    body: { severity: 'info' },
    run: async () => {
      const start = Date.now();
      try {
        const res = await fetch('/api/zcc/cerebro/test-alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ severity: 'info' }),
        });
        const durationMs = Date.now() - start;
        if (!res.ok) {
          return {
            status: 'fail' as TestStatus,
            durationMs,
            score: 0,
            error: `HTTP ${res.status}`,
          };
        }
        const data = await res.json();
        const mode = data.mode ?? 'unknown';
        const summary = data.summary ?? {};
        const total = summary.total ?? 0;
        const sent = summary.sent ?? 0;
        const queued = summary.queued ?? 0;
        const failed = summary.failed ?? 0;

        let score = 0;
        let status: TestStatus = 'fail';
        let signal = '';

        if (mode === 'mock' || mode === 'live') {
          score = 60;
          status = 'warn';
          signal = `Alerta de teste em modo ${mode.toUpperCase()} — ${total} canal(is) configurado(s)`;
        }
        if (total > 0 && failed === 0) {
          score = 85;
          status = 'pass';
          signal = `${sent} enviado(s), ${queued} em fila — todos os canais saudáveis`;
        }
        if (sent > 0 && failed === 0) {
          score = 100;
          status = 'pass';
          signal = `Alerta entregue em ${sent} canal(is) — AlertBus 100% operacional`;
        }

        return {
          status,
          durationMs,
          output: data,
          signal,
          score,
          ranAt: new Date().toISOString(),
        };
      } catch (e: any) {
        return {
          status: 'fail' as TestStatus,
          durationMs: Date.now() - start,
          score: 0,
          error: e.message,
        };
      }
    },
  },
];

// ── Helper: status icon/color ───────────────────────────────────────────────

function statusIcon(status: TestStatus): React.ReactNode {
  switch (status) {
    case 'running': return <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />;
    case 'pass': return <CheckCircle2 size={14} style={{ color: 'var(--ok)' }} />;
    case 'fail': return <XCircle size={14} style={{ color: 'var(--err)' }} />;
    case 'warn': return <AlertCircle size={14} style={{ color: 'var(--warn)' }} />;
    default: return <Clock size={14} style={{ color: 'var(--text-3)' }} />;
  }
}

function statusColor(status: TestStatus): string {
  switch (status) {
    case 'running': return 'var(--accent)';
    case 'pass': return 'var(--ok)';
    case 'fail': return 'var(--err)';
    case 'warn': return 'var(--warn)';
    default: return 'var(--text-3)';
  }
}

// ── Component ───────────────────────────────────────────────────────────────

export function CerebroTestPanel() {
  const [results, setResults] = useState<Record<string, TestResult>>(
    () => Object.fromEntries(TESTS.map(t => [t.id, { status: 'idle' as TestStatus, score: 0 }]))
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [runningAll, setRunningAll] = useState(false);
  const [history, setHistory] = useState<Array<{ ts: string; score: number; results: Record<string, TestResult> }>>([]);

  // ── Run single test ──────────────────────────────────────────────────────
  const runTest = useCallback(async (testId: string) => {
    const test = TESTS.find(t => t.id === testId);
    if (!test) return;

    setResults(prev => ({
      ...prev,
      [testId]: { ...prev[testId], status: 'running' },
    }));

    const result = await test.run();

    setResults(prev => ({
      ...prev,
      [testId]: result,
    }));
  }, []);

  // ── Run all tests ────────────────────────────────────────────────────────
  const runAll = useCallback(async () => {
    setRunningAll(true);
    // Reset all to idle first
    setResults(Object.fromEntries(TESTS.map(t => [t.id, { status: 'idle' as TestStatus, score: 0 }])));

    // Run sequentially (avoid rate limit + parallel DB locks)
    const newResults: Record<string, TestResult> = {};
    for (const test of TESTS) {
      setResults(prev => ({ ...prev, [test.id]: { status: 'running' as TestStatus, score: 0 } }));
      const result = await test.run();
      newResults[test.id] = result;
      setResults(prev => ({ ...prev, [test.id]: result }));
    }

    // Save to history
    const totalScore = computeTotalScore(newResults);
    setHistory(prev => [
      { ts: new Date().toISOString(), score: totalScore, results: newResults },
      ...prev.slice(0, 4),
    ]);
    setRunningAll(false);
  }, []);

  // ── Compute total score ──────────────────────────────────────────────────
  function computeTotalScore(resultsMap: Record<string, TestResult>): number {
    let total = 0;
    for (const test of TESTS) {
      const r = resultsMap[test.id];
      if (r) {
        total += (r.score * test.weight) / 100;
      }
    }
    return Math.round(total);
  }

  const totalScore = computeTotalScore(results);
  const testsPassed = TESTS.filter(t => results[t.id]?.status === 'pass').length;
  const testsFailed = TESTS.filter(t => results[t.id]?.status === 'fail').length;

  // ── Score color ──────────────────────────────────────────────────────────
  function scoreColor(score: number): string {
    if (score >= 80) return 'var(--ok)';
    if (score >= 50) return 'var(--warn)';
    if (score > 0) return 'var(--err)';
    return 'var(--text-3)';
  }

  return (
    <div className="operator-console">
      {/* ─── HEADER + SCORECARD ────────────────────────────────────────── */}
      <section>
        <div className="section-h">
          <span className="title">
            <Brain size={11} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
            CEREBRO TEST SUITE · 6 SUBSISTEMAS · MODO MOCK
          </span>
          <span className="meta">
            {testsPassed}/{TESTS.length} PASS · {testsFailed} FAIL
          </span>
        </div>

        {/* Scorecard grande */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          gap: 24,
          alignItems: 'center',
          padding: 20,
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
        }}>
          {/* Score number */}
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 48,
              fontWeight: 700,
              color: scoreColor(totalScore),
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}>
              {totalScore}
            </div>
            <div style={{
              fontSize: 10,
              color: 'var(--text-3)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginTop: 4,
            }}>
              SCORE 0-100
            </div>
          </div>

          {/* Status legend */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
              <CheckCircle2 size={11} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle', color: 'var(--ok)' }} />
              {testsPassed} subsistemas saudáveis
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
              <AlertCircle size={11} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle', color: 'var(--warn)' }} />
              {TESTS.filter(t => results[t.id]?.status === 'warn').length} com avisos
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
              <XCircle size={11} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle', color: 'var(--err)' }} />
              {testsFailed} com falhas
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
              <Clock size={11} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
              {TESTS.filter(t => results[t.id]?.status === 'idle' || results[t.id]?.status === 'running').length} pendentes
            </div>
          </div>

          {/* Run all button */}
          <button
            onClick={runAll}
            disabled={runningAll}
            style={{
              background: runningAll ? 'var(--surface-3)' : 'var(--accent-soft)',
              border: `1px solid ${runningAll ? 'var(--border)' : 'var(--accent)'}`,
              color: runningAll ? 'var(--text-3)' : 'var(--accent)',
              padding: '12px 20px',
              fontFamily: 'var(--font-jetbrains), monospace',
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: runningAll ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {runningAll ? (
              <><Loader2 size={13} className="animate-spin" /> RODANDO...</>
            ) : (
              <><PlayCircle size={13} /> RODAR TODOS</>
            )}
          </button>
        </div>

        {/* History strip */}
        {history.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
              marginBottom: 8,
            }}>
              HISTÓRICO · ÚLTIMAS {history.length} RUNS
            </div>
            <div style={{
              display: 'flex',
              gap: 1,
              background: 'var(--border)',
              border: '1px solid var(--border)',
            }}>
              {history.map((h, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    background: 'var(--surface)',
                    padding: '8px 12px',
                    textAlign: 'center',
                  }}
                  title={new Date(h.ts).toLocaleString('pt-BR')}
                >
                  <div style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: scoreColor(h.score),
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {h.score}
                  </div>
                  <div style={{
                    fontSize: 9,
                    color: 'var(--text-3)',
                    marginTop: 2,
                  }}>
                    {new Date(h.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ─── 6 TEST CARDS ─────────────────────────────────────────────── */}
      <section>
        <div className="section-h">
          <span className="title">TESTES POR SUBSISTEMA · CLIQUE PARA DETALHES</span>
          <span className="meta">{TESTS.length} TESTES · PESOS: 25/15/20/20/10/10</span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 1,
          background: 'var(--border)',
          border: '1px solid var(--border)',
        }}>
          {TESTS.map((test) => {
            const r = results[test.id];
            const isExpanded = expanded[test.id];
            const Icon = test.icon;
            const color = statusColor(r.status);

            return (
              <div
                key={test.id}
                style={{
                  background: 'var(--surface)',
                  padding: '14px 18px',
                }}
              >
                {/* Header row */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto auto auto',
                  gap: 14,
                  alignItems: 'center',
                }}>
                  <Icon size={18} style={{ color: 'var(--text-2)' }} />

                  <div>
                    <div style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}>
                      {test.name}
                      <span style={{
                        fontSize: 9,
                        color: 'var(--text-3)',
                        border: '1px solid var(--border-strong)',
                        padding: '1px 5px',
                        letterSpacing: '0.08em',
                      }}>
                        {test.weight}%
                      </span>
                    </div>
                    <div style={{
                      fontSize: 10,
                      color: 'var(--text-3)',
                      marginTop: 2,
                    }}>
                      {test.desc}
                    </div>
                  </div>

                  {/* Status + score */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 11,
                    color,
                  }}>
                    {statusIcon(r.status)}
                    <span style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      {r.status}
                    </span>
                  </div>

                  <div style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: scoreColor(r.score),
                    fontVariantNumeric: 'tabular-nums',
                    minWidth: 36,
                    textAlign: 'right',
                  }}>
                    {r.score}
                  </div>

                  {/* Run button */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => runTest(test.id)}
                      disabled={r.status === 'running'}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--border-strong)',
                        color: 'var(--text-2)',
                        padding: '6px 10px',
                        fontFamily: 'var(--font-jetbrains), monospace',
                        fontSize: 9,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        cursor: r.status === 'running' ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      title="Rodar este teste"
                    >
                      {r.status === 'running' ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        <Play size={10} />
                      )}
                      RUN
                    </button>
                    <button
                      onClick={() => setExpanded(prev => ({ ...prev, [test.id]: !prev[test.id] }))}
                      disabled={!r.output && !r.error}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--border-strong)',
                        color: 'var(--text-3)',
                        padding: '6px 8px',
                        cursor: (!r.output && !r.error) ? 'not-allowed' : 'pointer',
                        opacity: (!r.output && !r.error) ? 0.4 : 1,
                      }}
                      title={isExpanded ? 'Recolher' : 'Expandir output'}
                    >
                      {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                    </button>
                  </div>
                </div>

                {/* Signal + duration (always visible if ran) */}
                {r.ranAt && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 12,
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: '1px solid var(--hairline)',
                    fontSize: 11,
                  }}>
                    <div style={{ color: 'var(--text-2)' }}>
                      {r.signal || r.error || '—'}
                    </div>
                    <div style={{
                      color: 'var(--text-3)',
                      fontSize: 10,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {r.durationMs != null && (
                        <>
                          <Clock size={9} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                          {r.durationMs}ms
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Expanded output */}
                {isExpanded && (r.output || r.error) && (
                  <div style={{
                    marginTop: 10,
                    padding: 12,
                    background: 'var(--bg-2)',
                    border: '1px solid var(--border)',
                    fontFamily: 'var(--font-jetbrains), monospace',
                    fontSize: 10,
                    color: 'var(--text-2)',
                    overflow: 'auto',
                    maxHeight: 280,
                  }}>
                    {r.error ? (
                      <pre style={{ color: 'var(--err)', whiteSpace: 'pre-wrap', margin: 0 }}>
                        ERROR: {r.error}
                      </pre>
                    ) : (
                      <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                        {JSON.stringify(r.output, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── INTERPRETATION GUIDE ────────────────────────────────────── */}
      <section>
        <div className="section-h">
          <span className="title">COMO INTERPRETAR · SINAIS DE APRENDIZADO</span>
          <span className="meta">REFERÊNCIA RÁPIDA</span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 1,
          background: 'var(--border)',
          border: '1px solid var(--border)',
        }}>
          <div style={{ background: 'var(--surface)', padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>
              <Brain size={11} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
              PIPELINE COGNITIVO
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-2)', lineHeight: 1.6 }}>
              Score sobe quando cache hit &gt; 10% e latência &lt; 5s. Se score = 0, pipeline não está processando mensagens (modo mock esperado = 50-75).
            </div>
          </div>

          <div style={{ background: 'var(--surface)', padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>
              <Activity size={11} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
              ANOMALY DETECTOR
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-2)', lineHeight: 1.6 }}>
              0 anomalias = 75 (sistema saudável). Anomalias não acknowledged abaixam score para 50. Anomalias acknowledged = 100.
            </div>
          </div>

          <div style={{ background: 'var(--surface)', padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>
              <Zap size={11} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
              CÉREBRO ANALYZE
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-2)', lineHeight: 1.6 }}>
              Valida que o cron 15min roda sem erro. Score 75 = mock sem anomalias. Score 85+ = análises persistidas em CerebroAnalysis no DB.
            </div>
          </div>

          <div style={{ background: 'var(--surface)', padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>
              <Code size={11} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
              REFACTOR SUGGESTER
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-2)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--ok)' }}>SINAL DE APRENDIZADO:</strong> quando sugestões são approved/rejected, KnowledgeChunks são criados com source=&apos;refactor_applied&apos; ou &apos;refactor_rejected&apos;.
            </div>
          </div>

          <div style={{ background: 'var(--surface)', padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>
              <MessageSquare size={11} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
              CONVERSATION LEARNER
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-2)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--ok)' }}>SINAL DE APRENDIZADO:</strong> samples coletadas &gt; 10 e accuracy &gt; 50% indicam que o Cérebro está aprendendo padrões de conversa reais.
            </div>
          </div>

          <div style={{ background: 'var(--surface)', padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>
              <Bell size={11} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
              ALERT BUS
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-2)', lineHeight: 1.6 }}>
              Score 100 = alertas entregues em todos os canais. Failed &gt; 0 indica problema em email/Slack webhook. Em mock, alertas ficam em fila (queued).
            </div>
          </div>
        </div>
      </section>

      {/* ─── SCORE BREAKDOWN ─────────────────────────────────────────── */}
      <section>
        <div className="section-h">
          <span className="title">SCORE BREAKDOWN · CONTRIBUIÇÃO POR SUBSISTEMA</span>
          <span className="meta">TOTAL: {totalScore}/100</span>
        </div>

        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          padding: '16px 18px',
        }}>
          {TESTS.map((test) => {
            const r = results[test.id];
            const contribution = (r.score * test.weight) / 100;
            const maxContribution = test.weight;
            const pct = (contribution / maxContribution) * 100;

            return (
              <div key={test.id} style={{
                display: 'grid',
                gridTemplateColumns: '180px 1fr auto',
                gap: 12,
                alignItems: 'center',
                padding: '6px 0',
                fontSize: 11,
              }}>
                <div style={{ color: 'var(--text-2)' }}>{test.name}</div>
                <div style={{
                  height: 6,
                  background: 'var(--bg-2)',
                  position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${pct}%`,
                    background: scoreColor(r.score),
                    transition: 'width 0.3s var(--ease)',
                  }} />
                </div>
                <div style={{
                  color: 'var(--text)',
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: 10,
                }}>
                  {contribution.toFixed(1)} / {maxContribution}
                </div>
              </div>
            );
          })}

          {/* Total bar */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '180px 1fr auto',
            gap: 12,
            alignItems: 'center',
            padding: '10px 0 0',
            marginTop: 8,
            borderTop: '1px solid var(--border)',
            fontSize: 12,
            fontWeight: 600,
          }}>
            <div style={{ color: 'var(--text)' }}>TOTAL</div>
            <div style={{
              height: 10,
              background: 'var(--bg-2)',
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${totalScore}%`,
                background: scoreColor(totalScore),
                transition: 'width 0.3s var(--ease)',
              }} />
            </div>
            <div style={{
              color: scoreColor(totalScore),
              fontVariantNumeric: 'tabular-nums',
            }}>
              {totalScore} / 100
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
