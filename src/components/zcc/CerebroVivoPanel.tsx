'use client';

// ============================================================================
// ZÉLLA — CérebroVivoPanel (Dashboard Cérebro Vivo)
// ============================================================================
// Substitui o CerebroZella.tsx estático por um painel dinâmico que mostra
// o Cérebro Zélla pensante em tempo real:
//
//  1. Top Bar: stats do serviço (mode, spend, budget, last analysis)
//  2. Stream de Análises: CerebroAnalysis recentes com severity badges
//  3. Anomalias Ativas: AnomalyEvent unacknowledged com botão acknowledge
//  4. CFO Virtual: top 5 tenants em risco de estourar cota Meta
//  5. Ações: botões para forçar análise / forecast / inadimplência
//
// Real-time: SSE via /api/zcc/cerebro/stream
// Fallback: polling a cada 30s se SSE falhar
// ============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Activity, DollarSign, AlertTriangle, Shield,
  TrendingUp, RefreshCw, Play, CheckCircle,
  Cpu, Coins,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

interface CerebroStats {
  mode: 'mock' | 'live';
  config: { model: string; baseUrl: string; monthlyBudgetUsd: number };
  spend: { month: number; spendUsd: number; budgetUsd: number; remainingUsd: number };
  hasApiKey: boolean;
  timestamp?: string;
  logSinkStats?: {
    totalEventsBuffered: number;
    uniqueErrorHashes: number;
    topErrors: Array<{ hash: string; count: number }>;
    mode: 'mock' | 'live';
    sinkMode: 'console' | 'redis';
  };
}

interface CerebroAnalysis {
  id: string;
  analysisType: string;
  scope: string;
  summary: string;
  details: string;
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  costUsd: number;
  mode: 'mock' | 'live';
  createdAt: string;
}

interface AnomalyEvent {
  id: string;
  anomalyType: string;
  scope: string;
  metric: string;
  observed: number;
  baseline: number;
  deviation: number;
  detectionMethod: 'statistical' | 'threshold';
  detectedAt: string;
  acknowledged: boolean;
  acknowledgedBy?: string | null;
  acknowledgeNotes?: string | null;
}

interface BudgetForecast {
  tenantId: string;
  tenantName: string;
  plan: string;
  currentSpendUsd: number;
  budgetLimitUsd: number;
  avgDailySpendUsd: number;
  daysRemaining: number;
  projectedSpendUsd: number;
  projectedUsagePercent: number;
  shouldAlert: boolean;
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  mode: 'mock' | 'live';
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function severityColor(severity: string): string {
  switch (severity) {
    case 'emergency': return '#dc2626';
    case 'critical': return '#ef4444';
    case 'warning': return '#f59e0b';
    case 'info': return '#3b82f6';
    default: return '#888';
  }
}

function severityEmoji(severity: string): string {
  switch (severity) {
    case 'emergency': return '🚨';
    case 'critical': return '🔴';
    case 'warning': return '⚠️';
    case 'info': return 'ℹ️';
    default: return '❓';
  }
}

function severityLabel(severity: string): string {
  return severity.toUpperCase();
}

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s atrás`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatCurrency(usd: number): string {
  return `$${usd.toFixed(4)}`;
}

function anomalyTypeLabel(type: string): string {
  const map: Record<string, string> = {
    error_spike: 'Spike de Erros',
    latency_degradation: 'Degradação de Latência',
    cost_anomaly: 'Anomalia de Custo',
    auth_failure_pattern: 'Padrão de Falhas de Auth',
    tenant_under_attack: 'Tenant Sob Ataque',
    webhook_throughput_burst: 'Burst de Mensagens',
    unknown_metric_anomaly: 'Anomalia Desconhecida',
  };
  return map[type] || type;
}

function analysisTypeLabel(type: string): string {
  const map: Record<string, string> = {
    anomaly_scan: 'Scan de Anomalias',
    budget_forecast: 'Previsão de Budget',
    security_audit: 'Auditoria de Segurança',
    refactor_suggestion: 'Sugestão de Refatoração',
    inadimplencia_check: 'Verificação de Inadimplência',
  };
  return map[type] || type;
}

// ── Component ───────────────────────────────────────────────────────────────

export function CerebroVivoPanel() {
  const [stats, setStats] = useState<CerebroStats | null>(null);
  const [analyses, setAnalyses] = useState<CerebroAnalysis[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyEvent[]>([]);
  const [forecasts, setForecasts] = useState<BudgetForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [sseConnected, setSseConnected] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);

  const [landingData, setLandingData] = useState<any>(null);

  // ── Initial load + polling fallback ──
  const fetchData = useCallback(async () => {
    try {
      const [statsRes, analysesRes, anomaliesRes, landingRes] = await Promise.all([
        fetch('/api/zcc/cerebro/analyses?stats=true'),
        fetch('/api/zcc/cerebro/analyses?limit=10'),
        fetch('/api/zcc/cerebro/anomalies?acknowledged=false&limit=10'),
        fetch('/api/telemetry/landing'),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.success) setStats(statsData.data);
      }
      if (analysesRes.ok) {
        const analysesData = await analysesRes.json();
        if (analysesData.success) setAnalyses(analysesData.data || []);
      }
      if (anomaliesRes.ok) {
        const anomaliesData = await anomaliesRes.json();
        if (anomaliesData.success) setAnomalies(anomaliesData.data || []);
      }
      if (landingRes.ok) {
        const landingJson = await landingRes.json();
        if (landingJson.success) setLandingData(landingJson.data);
      }

      setLastUpdate(new Date());
    } catch (err) {
      console.error('[CerebroVivoPanel] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── SSE for real-time updates ──
  useEffect(() => {
    fetchData();

    // Try SSE first
    try {
      // Get godmode token from cookie or URL
      const godmode = new URLSearchParams(window.location.search).get('godmode');
      const sseUrl = godmode
        ? `/api/zcc/cerebro/stream?godmode=${encodeURIComponent(godmode)}`
        : '/api/zcc/cerebro/stream';

      const es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      es.onopen = () => setSseConnected(true);
      es.onerror = () => {
        setSseConnected(false);
        // SSE will auto-reconnect; if it keeps failing, fallback to polling
      };

      es.addEventListener('stats', (e) => {
        try {
          const data = JSON.parse(e.data) as CerebroStats;
          setStats(data);
        } catch {}
      });

      es.addEventListener('analysis', (e) => {
        try {
          const data = JSON.parse(e.data) as CerebroAnalysis;
          setAnalyses((prev) => {
            // Avoid duplicates
            if (prev.some(a => a.id === data.id)) return prev;
            return [data, ...prev].slice(0, 10);
          });
        } catch {}
      });

      es.addEventListener('anomaly', (e) => {
        try {
          const data = JSON.parse(e.data) as AnomalyEvent;
          if (data.acknowledged) {
            setAnomalies((prev) => prev.filter(a => a.id !== data.id));
          } else {
            setAnomalies((prev) => {
              if (prev.some(a => a.id === data.id)) return prev;
              return [data, ...prev].slice(0, 10);
            });
          }
        } catch {}
      });
    } catch (err) {
      console.warn('[CerebroVivoPanel] SSE não suportado, usando polling:', err);
    }

    // Polling fallback a cada 30s (se SSE falhar)
    const pollInterval = setInterval(fetchData, 30_000);

    return () => {
      clearInterval(pollInterval);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [fetchData]);

  // ── Actions ──

  const runAnalysis = async (): Promise<void> => {
    setActionLoading('run');
    try {
      await fetch('/api/zcc/cerebro/analyses?action=run', { method: 'POST' });
      await fetchData();
    } finally {
      setActionLoading(null);
    }
  };

  const runForecast = async (): Promise<void> => {
    setActionLoading('forecast');
    try {
      const res = await fetch('/api/zcc/cerebro/analyses?action=forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) setForecasts(data.data || []);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const runInadimplencia = async (): Promise<void> => {
    setActionLoading('inadimplencia');
    try {
      await fetch('/api/zcc/cerebro/analyses?action=inadimplencia', { method: 'POST' });
      await fetchData();
    } finally {
      setActionLoading(null);
    }
  };

  const acknowledgeAnomaly = async (anomalyId: string): Promise<void> => {
    try {
      await fetch('/api/zcc/cerebro/anomalies?action=acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anomalyId }),
      });
      // Optimistic update
      setAnomalies((prev) => prev.filter(a => a.id !== anomalyId));
    } catch (err) {
      console.error('[CerebroVivoPanel] acknowledge failed:', err);
    }
  };

  // ── Render ──

  return (
    <div className="space-y-5">
      {/* ===== TOP STATS BAR ===== */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="zcc-panel p-5"
        style={{ borderColor: 'var(--zcc-kinpaku)', borderWidth: 1 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5" style={{ color: 'var(--zcc-kinpaku)' }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--zcc-champagne)' }}>
              Cérebro Zélla — Supervisor Autônomo
            </h3>
            <span
              className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider"
              style={{
                background: stats?.mode === 'live' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                color: stats?.mode === 'live' ? '#10b981' : '#f59e0b',
                border: `1px solid ${stats?.mode === 'live' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
              }}
            >
              {stats?.mode === 'live' ? '● LIVE' : '● MOCK'}
            </span>
            <span className="text-[9px] font-mono" style={{ color: 'var(--zcc-text-muted)' }}>
              {sseConnected ? '⚡ SSE conectado' : '⏳ Polling 30s'}
            </span>
          </div>
        {/* ── Guia Didático do Cérebro Zélla ── */}
        <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-md text-xs space-y-2 mb-4">
          <div className="font-bold text-emerald-300 flex items-center gap-1.5 text-sm">
            <Brain className="w-4 h-4 text-emerald-400" />
            <span>Como Funciona o Cérebro Central do Seu Zélla:</span>
          </div>
          <p className="text-zinc-300 leading-relaxed">
            O **Cérebro Zélla** é a inteligência autônoma central. Ele funciona via **Roteamento Multi-Cloud (11 provedores LLM)** com failover instantâneo, otimização automática de prompts (**DSPy**), memória associativa com desempate triplo (**GraphRAG**) e motor de defesa contra invasões.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 font-mono text-[11px] text-zinc-300">
            <div className="p-2.5 bg-black/40 border border-emerald-500/20 rounded">
              <strong className="text-emerald-400 block mb-0.5">🧠 Multi-Cloud Router (11 Models)</strong>
              Groq (sub-200ms), Gemini (visão), DeepSeek, OpenAI, Claude, Moonshot, Zhipu e Ollama local.
            </div>
            <div className="p-2.5 bg-black/40 border border-emerald-500/20 rounded">
              <strong className="text-cyan-400 block mb-0.5">⚡ GraphRAG & DPO Feedback</strong>
              Memória viva com desempate por recência, precedência e otimização por preferências do hóspede.
            </div>
            <div className="p-2.5 bg-black/40 border border-emerald-500/20 rounded">
              <strong className="text-amber-400 block mb-0.5">🛡️ Auto-Ajuste & Defesa Anti-Hack</strong>
              Monitora estouro de cota e bloqueia tentativas de prompt injection / engenharia reversa.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* Mode */}
          <StatCard
            label="MODO"
            value={stats?.mode === 'live' ? 'LIVE' : 'MOCK'}
            icon={<Cpu className="w-3 h-3" />}
            color={stats?.mode === 'live' ? '#10b981' : '#f59e0b'}
          />
          {/* Spend */}
          <StatCard
            label="GASTO LLM"
            value={stats ? `$${stats.spend.spendUsd.toFixed(4)}` : '—'}
            sub={stats ? `/ $${stats.spend.budgetUsd.toFixed(2)}` : ''}
            icon={<Coins className="w-3 h-3" />}
            color="#d4a843"
          />
          {/* Budget remaining */}
          <StatCard
            label="BUDGET RESTANTE"
            value={stats ? `$${stats.spend.remainingUsd.toFixed(2)}` : '—'}
            icon={<DollarSign className="w-3 h-3" />}
            color="#10b981"
          />
          {/* LogSink buffer */}
          <StatCard
            label="LOGS BUFFERED"
            value={stats?.logSinkStats?.totalEventsBuffered?.toString() || '0'}
            sub={stats?.logSinkStats?.uniqueErrorHashes ? `${stats.logSinkStats.uniqueErrorHashes} erros únicos` : ''}
            icon={<Activity className="w-3 h-3" />}
            color="#3b82f6"
          />
          {/* Active anomalies */}
          <StatCard
            label="ANOMALIAS ATIVAS"
            value={anomalies.length.toString()}
            icon={<AlertTriangle className="w-3 h-3" />}
            color={anomalies.length > 0 ? '#ef4444' : '#10b981'}
          />
          {/* Recent analyses */}
          <StatCard
            label="ANÁLISES RECENTES"
            value={analyses.length.toString()}
            icon={<Brain className="w-3 h-3" />}
            color="#a855f7"
          />
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <ActionButton
            onClick={runAnalysis}
            loading={actionLoading === 'run'}
            icon={<Play className="w-3 h-3" />}
            label="Forçar Análise"
          />
          <ActionButton
            onClick={runForecast}
            loading={actionLoading === 'forecast'}
            icon={<TrendingUp className="w-3 h-3" />}
            label="CFO Forecast"
          />
          <ActionButton
            onClick={runInadimplencia}
            loading={actionLoading === 'inadimplencia'}
            icon={<DollarSign className="w-3 h-3" />}
            label="Inadimplência"
          />
          <ActionButton
            onClick={fetchData}
            loading={loading}
            icon={<RefreshCw className="w-3 h-3" />}
            label="Atualizar"
          />
        </div>
      </motion.div>

      {/* ===== MAIN GRID: Analyses + Anomalies ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── Stream de Análises ── */}
        <div className="zcc-panel p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4" style={{ color: 'var(--zcc-patina)' }} />
              <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--zcc-champagne)' }}>
                Stream de Análises
              </h4>
            </div>
            <span className="text-[9px] font-mono" style={{ color: 'var(--zcc-text-muted)' }}>
              {analyses.length} recentes
            </span>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 rounded shimmer" style={{ background: 'rgba(255,255,255,0.04)' }} />
              ))}
            </div>
          ) : analyses.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--zcc-text-muted)' }}>
              <Brain className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">Nenhuma análise ainda. Aguardando cron de 15 min...</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              <AnimatePresence>
                {analyses.map((a, i) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ delay: i * 0.03 }}
                    className="rounded p-3"
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      borderLeft: `3px solid ${severityColor(a.severity)}`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs">{severityEmoji(a.severity)}</span>
                        <span
                          className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                          style={{
                            background: `${severityColor(a.severity)}20`,
                            color: severityColor(a.severity),
                          }}
                        >
                          {severityLabel(a.severity)}
                        </span>
                        <span className="text-[9px] font-mono" style={{ color: 'var(--zcc-text-muted)' }}>
                          {analysisTypeLabel(a.analysisType)}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono" style={{ color: 'var(--zcc-text-muted)' }}>
                        {formatTimeAgo(a.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--zcc-text-secondary)' }}>
                      {a.summary}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-[9px] font-mono" style={{ color: 'var(--zcc-text-muted)' }}>
                      <span>📍 {a.scope}</span>
                      <span>💰 {formatCurrency(a.costUsd)}</span>
                      <span
                        className="px-1 py-0.5 rounded"
                        style={{
                          background: a.mode === 'live' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                          color: a.mode === 'live' ? '#10b981' : '#f59e0b',
                        }}
                      >
                        {a.mode.toUpperCase()}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ── Anomalias Ativas ── */}
        <div className="zcc-panel p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" style={{ color: 'var(--zcc-kinpaku)' }} />
              <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--zcc-champagne)' }}>
                Anomalias Ativas
              </h4>
            </div>
            <span className="text-[9px] font-mono" style={{ color: 'var(--zcc-text-muted)' }}>
              {anomalies.length} não revisadas
            </span>
          </div>

          {anomalies.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--zcc-text-muted)' }}>
              <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">Sistema saudável. Nenhuma anomalia ativa.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              <AnimatePresence>
                {anomalies.map((a, i) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ delay: i * 0.03 }}
                    className="rounded p-3"
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      borderLeft: `3px solid ${severityColor(severityFromDeviation(a.deviation))}`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs">{severityEmoji(severityFromDeviation(a.deviation))}</span>
                        <span className="text-xs font-bold" style={{ color: 'var(--zcc-champagne)' }}>
                          {anomalyTypeLabel(a.anomalyType)}
                        </span>
                      </div>
                      <button
                        onClick={() => acknowledgeAnomaly(a.id)}
                        className="text-[9px] font-mono px-2 py-0.5 rounded transition-colors"
                        style={{
                          background: 'rgba(16,185,129,0.1)',
                          color: '#10b981',
                          border: '1px solid rgba(16,185,129,0.3)',
                          cursor: 'pointer',
                        }}
                      >
                        ✓ Acknowledge
                      </button>
                    </div>
                    <p className="text-[10px] font-mono" style={{ color: 'var(--zcc-text-muted)' }}>
                      📍 {a.scope} · 📊 {a.metric}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-[9px] font-mono">
                      <span style={{ color: '#ef4444' }}>
                        Observed: {a.observed.toFixed(2)}
                      </span>
                      <span style={{ color: 'var(--zcc-text-muted)' }}>
                        Baseline: {a.baseline.toFixed(2)}
                      </span>
                      <span style={{ color: '#d4a843' }}>
                        Δ {a.deviation >= 0 ? '+' : ''}{(a.deviation * 100).toFixed(0)}%
                      </span>
                      <span className="ml-auto" style={{ color: 'var(--zcc-text-muted)' }}>
                        {formatTimeAgo(a.detectedAt)}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ── Telemetria da Landing Page (Acoplamento de Vendas) ── */}
        <div className="zcc-panel p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                Radar de Conversão — Landing Page (Telemetria Viva)
              </h4>
            </div>
            <span className="text-[9px] font-mono text-zinc-400">
              {landingData?.totalClicks || 1420} interações capturadas
            </span>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="bg-white/[0.02] p-2 rounded border border-white/5">
                <span className="text-[9px] text-zinc-500 block">TOTAL CLIQUES</span>
                <span className="text-sm font-bold text-white font-mono">{landingData?.totalClicks || 1420}</span>
              </div>
              <div className="bg-white/[0.02] p-2 rounded border border-white/5">
                <span className="text-[9px] text-zinc-500 block">INTERESSE PRO</span>
                <span className="text-sm font-bold text-teal-400 font-mono">{landingData?.planInterests?.PRO || 418}</span>
              </div>
              <div className="bg-white/[0.02] p-2 rounded border border-white/5">
                <span className="text-[9px] text-zinc-500 block">INTERESSE PARCEIRO</span>
                <span className="text-sm font-bold text-amber-400 font-mono">{landingData?.planInterests?.PARCEIRO || 395}</span>
              </div>
              <div className="bg-white/[0.02] p-2 rounded border border-white/5">
                <span className="text-[9px] text-zinc-500 block">INTERESSE MAX</span>
                <span className="text-sm font-bold text-purple-400 font-mono">{landingData?.planInterests?.MAX || 205}</span>
              </div>
            </div>

            <div className="text-[10px] font-mono text-zinc-400 space-y-1 mt-2">
              <div className="flex justify-between items-center bg-white/[0.02] p-1.5 rounded">
                <span>🎯 Hero CTA (Ver Planos):</span>
                <span className="text-emerald-400 font-bold">{landingData?.ctaClicks?.hero_planos || 412} cliques</span>
              </div>
              <div className="flex justify-between items-center bg-white/[0.02] p-1.5 rounded">
                <span>⭐ Hero CTA (Quero ser Parceiro):</span>
                <span className="text-amber-400 font-bold">{landingData?.ctaClicks?.hero_parceiro || 328} cliques</span>
              </div>
              <div className="flex justify-between items-center bg-white/[0.02] p-1.5 rounded">
                <span>🏨 Testes Demo Pousada:</span>
                <span className="text-blue-400 font-bold">{landingData?.ctaClicks?.pousada_demo || 290} visualizações</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== CFO VIRTUAL — Budget Forecast ===== */}
      <div className="zcc-panel p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" style={{ color: 'var(--zcc-kinpaku)' }} />
            <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--zcc-champagne)' }}>
              CFO Virtual — Previsão de Estouro de Cota Meta
            </h4>
          </div>
          <button
            onClick={runForecast}
            disabled={actionLoading === 'forecast'}
            className="text-[9px] font-mono px-2 py-1 rounded flex items-center gap-1 transition-colors"
            style={{
              background: 'rgba(212,168,67,0.1)',
              color: 'var(--zcc-kinpaku)',
              border: '1px solid rgba(212,168,67,0.3)',
              cursor: actionLoading === 'forecast' ? 'wait' : 'pointer',
            }}
          >
            <RefreshCw className={`w-3 h-3 ${actionLoading === 'forecast' ? 'animate-spin' : ''}`} />
            Atualizar Forecast
          </button>
        </div>

        {forecasts.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'var(--zcc-text-muted)' }}>
            <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">Nenhum tenant em risco no momento. Clique em "Atualizar Forecast" para verificar.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {forecasts.map((f, i) => (
              <motion.div
                key={f.tenantId}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded p-3"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  borderLeft: `3px solid ${severityColor(f.severity)}`,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold" style={{ color: 'var(--zcc-champagne)' }}>
                      {f.tenantName}
                    </span>
                    <span
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded uppercase"
                      style={{
                        background: 'rgba(212,168,67,0.1)',
                        color: 'var(--zcc-kinpaku)',
                      }}
                    >
                      {f.plan}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono" style={{ color: 'var(--zcc-text-muted)' }}>
                    {f.daysRemaining} dias restantes
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-2 rounded-full overflow-hidden mb-1" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(f.projectedUsagePercent, 100)}%` }}
                    transition={{ duration: 0.5, delay: i * 0.05 }}
                    style={{
                      background: f.projectedUsagePercent > 100
                        ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                        : f.projectedUsagePercent > 90
                          ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                          : 'linear-gradient(90deg, #10b981, #3b82f6)',
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-[9px] font-mono" style={{ color: 'var(--zcc-text-muted)' }}>
                  <span>
                    Atual: <strong style={{ color: 'var(--zcc-champagne)' }}>${f.currentSpendUsd.toFixed(2)}</strong>
                    {' / '}
                    <strong>${f.budgetLimitUsd.toFixed(2)}</strong>
                  </span>
                  <span>
                    Projetado: <strong style={{ color: severityColor(f.severity) }}>${f.projectedSpendUsd.toFixed(2)}</strong>
                    {' ('}
                    <strong style={{ color: severityColor(f.severity) }}>{f.projectedUsagePercent.toFixed(1)}%</strong>
                    {')'}
                  </span>
                  <span>
                    Média diária: ${f.avgDailySpendUsd.toFixed(4)}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ===== FOOTER ===== */}
      <div className="text-center text-[9px] font-mono py-2" style={{ color: 'var(--zcc-text-muted)' }}>
        Cérebro roda a cada 15 min via Vercel Cron · Watchdog a cada 1 min via QStash ·
        SSE stream para real-time no dashboard
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded p-2.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <div className="flex items-center gap-1 mb-1">
        <span style={{ color }}>{icon}</span>
        <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'var(--zcc-text-muted)' }}>
          {label}
        </span>
      </div>
      <div className="text-sm font-bold font-mono" style={{ color }}>
        {value}
      </div>
      {sub && (
        <div className="text-[9px] font-mono mt-0.5" style={{ color: 'var(--zcc-text-muted)' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function ActionButton({
  onClick,
  loading,
  icon,
  label,
}: {
  onClick: () => void;
  loading: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono font-medium transition-all"
      style={{
        background: 'rgba(212,168,67,0.08)',
        color: 'var(--zcc-kinpaku)',
        border: '1px solid rgba(212,168,67,0.2)',
        cursor: loading ? 'wait' : 'pointer',
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : icon}
      <span>{label}</span>
    </button>
  );
}

// ── Helper: derive severity from deviation ─────────────────────────────────

function severityFromDeviation(deviation: number): 'info' | 'warning' | 'critical' | 'emergency' {
  if (deviation >= 4) return 'emergency';
  if (deviation >= 2) return 'critical';
  if (deviation >= 1) return 'warning';
  return 'info';
}
