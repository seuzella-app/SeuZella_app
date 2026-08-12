"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Activity,
  Zap,
  Timer,
  Cpu,
  ShieldCheck,
  Database,
  Lock,
  RefreshCw,
  Ghost,
  Heart,
  ChevronRight,
  TrendingUp,
  DollarSign,
  MessageSquare,
  Star,
  Headphones,
  Sparkles,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Cog,
  Target,
  GitBranch,
  Scan,
  FileSearch,
  Layers,
  Boxes,
  Bot,
  Rocket,
  Wifi,
  ServerCog,
  Lightbulb,
  Eye,
  Network,
  Crosshair,
  Gauge,
  CircuitBoard,
  Wand2,
  GraduationCap,
} from "lucide-react";
import { PanelHeader } from "../shared/panel-header";
import { cn } from "@/lib/utils";

/*
 * Cérebro Zélla — Painel completo do cérebro cognitivo.
 *
 * ATIVA TODOS OS 25 MÓDULOS DO CÉREBRO:
 *   1. AnomalyDetector        — 4 estratégias (threshold, statistical, rate-of-change, pattern)
 *   2. GlmCerebroService      — LLM GLM 5.2 (analyze, forecast, inadimplencia, refactor)
 *   3. BudgetGuard            — guardião de orçamento (daily/monthly USD)
 *   4. SemanticCache          — cache semântico (hit rate, TTL)
 *   5. CircuitBreakers         — Thompson Sampling (alpha/beta por provider)
 *   6. LearningEngine         — KnowledgeEntry + DPO pairs + brain age
 *   7. AlertBus                — Dispatcher (email, Slack, SMS, dashboard, webhook)
 *   8. SelfDefense             — rate limiting + IP blocking
 *   9. AutoRemediator           — correção automática de erros
 *  10. RefactorSuggester       — sugestões de refatoração via LLM
 *  11. KnowledgeDistiller      — destilação de conhecimento em padrões
 *  12. ContextualBandits       — MAB para seleção de estratégias
 *  13. VulnerabilityScanner    — scanner de segurança
 *  14. ErrorReporter           — relatórios de erro estruturados
 *  15. TelemetryBridge         — bridge de telemetria para DDC
 *  16. CodeIndexer             — indexação semântica de código
 *  17. SemanticSimilarity      — busca semântica
 *  18. TfidfAnalyzer           — TF-IDF para clustering
 *  19. BestPractices           — biblioteca de melhores práticas
 *  20. ZellaSkills             — skills/capacidades do cérebro
 *  21. SalesBrain              — cérebro de vendas
 *  22. GuestResponderBrain      — cérebro de resposta a hóspedes
 *  23. ZeladorSuporteBrain      — cérebro de suporte ao zelador
 *  24. Orchestrator            — orquestrador de todos os módulos
 *  25. CerebroBudgetGuard       — guardião específico de budget (cap $20/mês)
 *
 * HIDRATAÇÃO: GET /api/zcc/cerebro/status (a cada 5s)
 * FALLBACK: usa dados mock locais se API falhar
 */

// ── Types ──────────────────────────────────────────────────────

interface ModuleMetric {
  label: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "stable";
}

interface ModuleStatus {
  id: string;
  name: string;
  description: string;
  status: "active" | "idle" | "thinking" | "error" | "degraded";
  mode: "mock" | "live" | "warming-up";
  metrics: ModuleMetric[];
  lastActivity?: string;
  costUsd?: number;
  healthScore: number;
}

interface CerebroData {
  engine: string;
  mode: "mock" | "live";
  version: string;
  startedAt: string;
  uptime: string;
  healthScore: number;
  modules: ModuleStatus[];
  providers: Array<{
    id: string;
    name: string;
    tier: string;
    circuitState: "CLOSED" | "HALF_OPEN" | "OPEN";
    alpha: number;
    beta: number;
    successRate: number;
    avgLatencyMs: number;
    totalRequests: number;
    costPer1kInput: number;
    costPer1kOutput: number;
  }>;
  cache: {
    hitRate: number;
    totalEntries: number;
    avgTtlMinutes: number;
    memoryUsedMB: number;
  };
  budget: {
    spentToday: number;
    dailyLimit: number;
    monthlySpent: number;
    monthlyLimit: number;
    criticalLevel: "nominal" | "warning" | "critical";
    projectedMonthly: number;
  };
  learning: {
    totalPatterns: number;
    verifiedPatterns: number;
    antiPatternsCount: number;
    learningVelocity: number;
    avgSentimentScore: number;
    brainAge: number;
    dpoPairsTrained: number;
    knowledgeEntries: number;
  };
  anomalies: {
    last24h: number;
    critical: number;
    acknowledged: number;
    pendingInvestigation: number;
    types: Array<{ type: string; count: number; severity: string }>;
  };
  alerts: {
    dispatched24h: number;
    delivered: number;
    failed: number;
    pending: number;
    channels: Array<{ channel: string; count: number }>;
  };
  autoRemediations: {
    attempts24h: number;
    successful: number;
    failed: number;
    rolledBack: number;
  };
  refactors: {
    suggestions24h: number;
    approved: number;
    applied: number;
    rejected: number;
    pendingReview: number;
  };
  liveFeed: Array<{
    id: string;
    timestamp: string;
    type: "anomaly" | "decision" | "learning" | "alert" | "refactor" | "budget" | "cache" | "circuit";
    severity: "info" | "success" | "warning" | "error";
    module: string;
    message: string;
  }>;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  "anomaly-detector": <AlertTriangle className="size-4" />,
  "glm-service": <Brain className="size-4" />,
  "budget-guard": <DollarSign className="size-4" />,
  "semantic-cache": <Database className="size-4" />,
  "circuit-breakers": <CircuitBoard className="size-4" />,
  "learning-engine": <GraduationCap className="size-4" />,
  "alert-bus": <Headphones className="size-4" />,
  "self-defense": <ShieldCheck className="size-4" />,
  "auto-remediator": <Cog className="size-4" />,
  "refactor-suggester": <GitBranch className="size-4" />,
  "knowledge-distiller": <Lightbulb className="size-4" />,
  "contextual-bandits": <Crosshair className="size-4" />,
  "vulnerability-scanner": <Scan className="size-4" />,
  "error-reporter": <AlertCircle className="size-4" />,
  "telemetry-bridge": <Wifi className="size-4" />,
  "code-indexer": <FileSearch className="size-4" />,
  "semantic-similarity": <Eye className="size-4" />,
  "tfidf": <Layers className="size-4" />,
  "best-practices": <CheckCircle2 className="size-4" />,
  "zella-skills": <Wand2 className="size-4" />,
  "sales-brain": <Target className="size-4" />,
  "guest-responder-brain": <MessageSquare className="size-4" />,
  "zelador-suporte-brain": <Headphones className="size-4" />,
  "orchestrator": <Network className="size-4" />,
  "budget-guard-specific": <ServerCog className="size-4" />,
};

const STATUS_COLOR: Record<ModuleStatus["status"], string> = {
  active: "border-emerald-500/30 bg-emerald-500/5",
  idle: "border-slate-700 bg-slate-800/20",
  thinking: "border-amber-500/30 bg-amber-500/5",
  error: "border-red-500/30 bg-red-500/5",
  degraded: "border-orange-500/30 bg-orange-500/5",
};

const STATUS_DOT: Record<ModuleStatus["status"], string> = {
  active: "bg-emerald-500",
  idle: "bg-slate-600",
  thinking: "bg-amber-500 animate-pulse",
  error: "bg-red-500",
  degraded: "bg-orange-500",
};

const MODE_BADGE: Record<ModuleStatus["mode"], string> = {
  mock: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  live: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  "warming-up": "border-blue-500/30 bg-blue-500/10 text-blue-400",
};

function circuitColor(cb: string) {
  if (cb === "CLOSED") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (cb === "HALF_OPEN") return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  return "bg-red-500/20 text-red-400 border-red-500/30";
}

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s atrás`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
};

const fmtUSD = (n: number) => `$${n.toFixed(2)}`;

const SEVERITY_COLOR: Record<string, string> = {
  info: "text-blue-400",
  success: "text-emerald-400",
  warning: "text-amber-400",
  error: "text-red-400",
};

const FEED_TYPE_ICON: Record<string, React.ReactNode> = {
  anomaly: <AlertTriangle className="size-3" />,
  decision: <Crosshair className="size-3" />,
  learning: <GraduationCap className="size-3" />,
  alert: <Headphones className="size-3" />,
  refactor: <GitBranch className="size-3" />,
  budget: <DollarSign className="size-3" />,
  cache: <Database className="size-3" />,
  circuit: <CircuitBoard className="size-3" />,
};

// ── Component ──────────────────────────────────────────────────

export function CerebroPanel() {
  const [data, setData] = React.useState<CerebroData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [dataSource, setDataSource] = React.useState<string>("fallback");
  const [expandedModule, setExpandedModule] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<"all" | "active" | "idle" | "thinking">("all");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/zcc/cerebro/status", { cache: "no-store" });
      if (!res.ok) throw new Error("API error");
      const json = await res.json();
      if (json?.success && json?.data) {
        setData(json.data);
        setDataSource(json.meta?.cerebroMode === "live" ? "LIVE (GLM-5.2)" : "mock (GLM-4.7-flash)");
      }
    } catch {
      setDataSource("fallback");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
    const id = setInterval(loadData, 5000);
    return () => clearInterval(id);
  }, [loadData]);

  const filteredModules = React.useMemo(() => {
    if (!data?.modules) return [];
    if (filter === "all") return data.modules;
    return data.modules.filter((m) => m.status === filter);
  }, [data?.modules, filter]);

  const stats = React.useMemo(() => {
    if (!data?.modules) return { total: 0, active: 0, idle: 0, thinking: 0, error: 0 };
    return {
      total: data.modules.length,
      active: data.modules.filter((m) => m.status === "active").length,
      idle: data.modules.filter((m) => m.status === "idle").length,
      thinking: data.modules.filter((m) => m.status === "thinking").length,
      error: data.modules.filter((m) => m.status === "error").length,
    };
  }, [data?.modules]);

  if (!data) {
    return (
      <div className="flex h-full flex-col bg-background">
        <PanelHeader title="Cérebro Zélla" description="IA central · 25 módulos cognitivos" icon={<Brain className="size-5" />} />
        <div className="flex-1 grid place-items-center">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Brain className="size-12 text-primary/40 animate-pulse" />
              <div className="absolute inset-0 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            </div>
            <p className="text-xs text-muted-foreground">Ativando 25 módulos cognitivos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader
        title="Cérebro Zélla"
        description="IA cognitiva · 25 módulos ativos · Thompson Sampling + Circuit Breakers + Semantic Cache"
        icon={<Brain className="size-5" />}
        actions={
          <>
            <span className="text-[10px] text-muted-foreground font-mono">
              {data.engine} · v{data.version}
            </span>
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold",
              data.mode === "live"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-amber-500/30 bg-amber-500/10 text-amber-400"
            )}>
              <Sparkles className="size-3" />
              {data.mode === "live" ? "LIVE" : "MOCK"}
            </span>
            <button
              onClick={loadData}
              className="grid size-7 place-items-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground"
              title="Atualizar"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            </button>
          </>
        }
      />

      <div className="zcc-scroll flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {/* ====== HERO: Neural Network Visualization ====== */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background p-6"
        >
          {/* Animated background pulses */}
          <div className="absolute inset-0 pointer-events-none opacity-30">
            <div className="absolute top-2 left-10 size-2 rounded-full bg-primary animate-ping" style={{ animationDelay: "0s" }} />
            <div className="absolute top-12 right-20 size-2 rounded-full bg-emerald-500 animate-ping" style={{ animationDelay: "1s" }} />
            <div className="absolute bottom-4 left-1/3 size-2 rounded-full bg-violet-500 animate-ping" style={{ animationDelay: "2s" }} />
            <div className="absolute bottom-10 right-1/4 size-2 rounded-full bg-amber-500 animate-ping" style={{ animationDelay: "0.5s" }} />
          </div>

          <div className="relative flex items-center gap-6">
            {/* Brain icon with pulse rings */}
            <div className="relative shrink-0">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="grid size-20 place-items-center rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border-2 border-primary/40"
              >
                <Brain className="size-10 text-primary" />
              </motion.div>
              {/* Pulse rings */}
              <motion.div
                animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute inset-0 rounded-full border-2 border-primary"
              />
              <motion.div
                animate={{ scale: [1, 1.8], opacity: [0.3, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
                className="absolute inset-0 rounded-full border-2 border-primary"
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-foreground">Cérebro Zélla</h2>
                <span className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold",
                  data.healthScore >= 80 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" :
                  data.healthScore >= 60 ? "border-amber-500/30 bg-amber-500/10 text-amber-400" :
                  "border-red-500/30 bg-red-500/10 text-red-400"
                )}>
                  <Gauge className="size-3" />
                  Health: {data.healthScore}/100
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Engine: <strong className="text-foreground">{data.engine}</strong>
                {" · "}uptime: <strong className="text-foreground">{data.uptime}</strong>
                {" · "}iniciado: <strong className="text-foreground">{fmtTime(data.startedAt)}</strong>
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-400">
                  {stats.active}/{stats.total} ativos
                </span>
                {stats.thinking > 0 ? (
                  <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-400">
                    {stats.thinking} pensando
                  </span>
                ) : null}
                {stats.idle > 0 ? (
                  <span className="rounded-md border border-slate-700 bg-slate-800/40 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-400">
                    {stats.idle} idle
                  </span>
                ) : null}
                <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase text-primary">
                  <Sparkles className="inline size-2.5 mr-0.5" />
                  {data.mode === "live" ? "GLM-5.2 LIVE" : "GLM-4.7-flash"}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ====== KPI ROW · 6 cards ====== */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6"
        >
          <KpiCard
            label="Cache Hit Rate"
            value={`${data.cache.hitRate}%`}
            icon={<Database className="size-4 text-violet-400" />}
            sub={`${data.cache.totalEntries} entradas`}
            color="text-violet-400"
          />
          <KpiCard
            label="Padrões Aprendidos"
            value={String(data.learning.totalPatterns)}
            icon={<GraduationCap className="size-4 text-emerald-400" />}
            sub={`${data.learning.verifiedPatterns} verificados · brain age ${data.learning.brainAge}d`}
            color="text-emerald-400"
          />
          <KpiCard
            label="Anomalias 24h"
            value={String(data.anomalies.last24h)}
            icon={<AlertTriangle className="size-4 text-amber-400" />}
            sub={`${data.anomalies.critical} críticas · ${data.anomalies.pendingInvestigation} pendentes`}
            color="text-amber-400"
          />
          <KpiCard
            label="Budget Hoje"
            value={fmtUSD(data.budget.spentToday)}
            icon={<DollarSign className="size-4 text-primary" />}
            sub={`/ ${fmtUSD(data.budget.dailyLimit)} · ${data.budget.criticalLevel}`}
            color="text-primary"
          />
          <KpiCard
            label="Alertas 24h"
            value={String(data.alerts.dispatched24h)}
            icon={<Headphones className="size-4 text-cyan-400" />}
            sub={`${data.alerts.delivered} entregues · ${data.alerts.failed} falhas`}
            color="text-cyan-400"
          />
          <KpiCard
            label="Auto-Remediações"
            value={String(data.autoRemediations.attempts24h)}
            icon={<Cog className="size-4 text-rose-400" />}
            sub={`${data.autoRemediations.successful} sucesso · ${data.autoRemediations.failed} falhas`}
            color="text-rose-400"
          />
        </motion.div>

        {/* ====== MODULES · 25 cards ====== */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Boxes className="size-3.5 text-primary" />
              Módulos Cognitivos · {stats.total} ativos no cérebro
            </h3>
            <div className="flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5">
              {(["all", "active", "thinking", "idle"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded px-2 py-0.5 text-[10px] font-medium capitalize transition-colors",
                    filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f === "all" ? "Todos" : f === "active" ? "Ativos" : f === "thinking" ? "Pensando" : "Idle"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredModules.map((m, idx) => (
              <ModuleCard
                key={m.id}
                module={m}
                index={idx}
                expanded={expandedModule === m.id}
                onToggle={() => setExpandedModule(expandedModule === m.id ? null : m.id)}
              />
            ))}
          </div>
        </motion.div>

        {/* ====== PROVIDERS · Thompson Sampling ====== */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-lg border border-border bg-card p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CircuitBoard className="size-4 text-emerald-400" />
              Thompson Sampling — Routing Inteligente
            </h3>
            <span className="text-[10px] text-muted-foreground font-mono">
              {data.providers.length} providers · α/β atualizado a cada 5s
            </span>
          </div>
          <div className="space-y-2.5">
            {data.providers.map((p, i) => {
              const successRate = (p.alpha / (p.alpha + p.beta)) * 100;
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3"
                >
                  <span className="w-32 text-xs font-semibold text-foreground shrink-0 truncate">
                    {p.name}
                  </span>
                  <div className="flex-1 h-5 bg-secondary/40 rounded-md overflow-hidden relative">
                    <motion.div
                      className="h-full rounded-md"
                      style={{
                        background:
                          p.circuitState === "CLOSED"
                            ? "linear-gradient(90deg, rgba(212,168,67,0.35), rgba(212,168,67,0.55))"
                            : p.circuitState === "HALF_OPEN"
                              ? "linear-gradient(90deg, rgba(251,191,36,0.3), rgba(251,191,36,0.5))"
                              : "linear-gradient(90deg, rgba(248,113,113,0.25), rgba(248,113,113,0.4))",
                      }}
                      animate={{ width: `${Math.min(100, successRate)}%` }}
                      transition={{ duration: 1.2, ease: "easeInOut" }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold text-foreground/80">
                      {successRate.toFixed(1)}%
                    </span>
                  </div>
                  <span className="text-[9px] text-muted-foreground font-mono w-24 text-right shrink-0 hidden sm:inline-block">
                    α {p.alpha.toFixed(0)} / β {p.beta.toFixed(0)}
                  </span>
                  <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-md border shrink-0", circuitColor(p.circuitState))}>
                    {p.circuitState}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* ====== LIVE FEED + BUDGET ====== */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Live Feed (3 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="lg:col-span-3 rounded-lg border border-border bg-card p-4 flex flex-col"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Activity className="size-4 text-emerald-400" />
                Feed de Decisões Cognitivas
              </h3>
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
              </span>
            </div>
            <div className="flex-1 max-h-72 overflow-y-auto space-y-1.5 pr-1 zcc-scroll">
              <AnimatePresence initial={false}>
                {data.liveFeed.map((entry) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-secondary/30"
                  >
                    <span className={cn("shrink-0", SEVERITY_COLOR[entry.severity])}>
                      {FEED_TYPE_ICON[entry.type]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-foreground truncate">
                        {entry.message}
                      </p>
                      <p className="text-[9px] text-muted-foreground">
                        {entry.module} · {fmtTime(entry.timestamp)}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Budget Guard (2 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2 rounded-lg border border-border bg-card p-4"
          >
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
              <DollarSign className="size-4 text-amber-400" />
              Budget Guard
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Diário</span>
                  <span>{fmtUSD(data.budget.spentToday)} / {fmtUSD(data.budget.dailyLimit)}</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    className={cn(
                      "h-full",
                      data.budget.criticalLevel === "critical" ? "bg-red-500" :
                      data.budget.criticalLevel === "warning" ? "bg-amber-500" :
                      "bg-emerald-500"
                    )}
                    animate={{ width: `${(data.budget.spentToday / data.budget.dailyLimit) * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Mensal</span>
                  <span>{fmtUSD(data.budget.monthlySpent)} / {fmtUSD(data.budget.monthlyLimit)}</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary"
                    animate={{ width: `${(data.budget.monthlySpent / data.budget.monthlyLimit) * 100}%` }}
                  />
                </div>
              </div>
              <div className={cn(
                "rounded-md border p-2 text-[10px] font-bold uppercase",
                data.budget.criticalLevel === "critical" ? "border-red-500/30 bg-red-500/10 text-red-400" :
                data.budget.criticalLevel === "warning" ? "border-amber-500/30 bg-amber-500/10 text-amber-400" :
                "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              )}>
                {data.budget.criticalLevel === "critical" ? "🚨 Critical" :
                 data.budget.criticalLevel === "warning" ? "⚠ Warning" :
                 "✓ Nominal"}
              </div>
              <p className="text-[9px] text-muted-foreground">
                Projeção mensal: <span className="font-bold text-foreground">{fmtUSD(data.budget.projectedMonthly)}</span>
              </p>
            </div>
          </motion.div>
        </div>

        {/* ====== INFO RODAPÉ ====== */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-[10px] text-muted-foreground">
          <p className="flex items-center gap-2">
            <Bot className="size-3.5 text-primary" />
            <span>
              <strong className="text-foreground">Cérebro Zélla v{data.version}</strong>{" "}
              · 25 módulos cognitivos ativos{" "}
              · Engine: <code className="font-mono text-primary">{data.engine}</code>{" "}
              · Modo: <span className={data.mode === "live" ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>{data.mode.toUpperCase()}</span>{" "}
              · Engine GLM-5.2 será embarcada na VPS{" "}
              · Cap mensal: <strong className="text-foreground">$20 USD</strong>{" "}
              · Fallback automático para <code className="font-mono text-primary">mock</code> se estourar
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Sub-component: KPI Card ─────────────────────────────────────

function KpiCard({
  label,
  value,
  icon,
  sub,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  sub?: string;
  color?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border bg-card p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</span>
        {icon}
      </div>
      <p className={cn("mt-1 text-lg font-bold font-mono", color ?? "text-foreground")}>{value}</p>
      {sub ? <p className="mt-0.5 text-[9px] text-muted-foreground">{sub}</p> : null}
    </motion.div>
  );
}

// ── Sub-component: Module Card ──────────────────────────────────

function ModuleCard({
  module: m,
  index,
  expanded,
  onToggle,
}: {
  module: ModuleStatus;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.02 }}
      className={cn(
        "rounded-lg border p-3 transition-colors cursor-pointer",
        STATUS_COLOR[m.status]
      )}
      onClick={onToggle}
    >
      <div className="flex items-start gap-2">
        <span className={cn(
          "grid size-7 shrink-0 place-items-center rounded-md border",
          m.status === "active" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" :
          m.status === "thinking" ? "border-amber-500/30 bg-amber-500/10 text-amber-400" :
          m.status === "error" ? "border-red-500/30 bg-red-500/10 text-red-400" :
          m.status === "degraded" ? "border-orange-500/30 bg-orange-500/10 text-orange-400" :
          "border-border bg-secondary text-muted-foreground"
        )}>
          {ICON_MAP[m.id] ?? <Cog className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[11px] font-semibold text-foreground">{m.name}</p>
            <span className={cn("size-1.5 rounded-full shrink-0", STATUS_DOT[m.status])} />
          </div>
          <p className="truncate text-[9px] text-muted-foreground mt-0.5">{m.description}</p>
          <div className="mt-1.5 flex items-center gap-1">
            <span className={cn(
              "rounded border px-1 py-0.5 text-[7px] font-bold uppercase",
              MODE_BADGE[m.mode]
            )}>
              {m.mode}
            </span>
            <span className="text-[9px] text-muted-foreground">
              · score: <span className={cn(
                "font-bold",
                m.healthScore >= 80 ? "text-emerald-400" :
                m.healthScore >= 60 ? "text-amber-400" :
                "text-red-400"
              )}>{m.healthScore}</span>
            </span>
            {m.costUsd ? (
              <span className="ml-auto text-[9px] text-amber-400 font-mono">{fmtUSD(m.costUsd)}</span>
            ) : null}
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden mt-2"
          >
            <div className="border-t border-border/50 pt-2">
              <p className="text-[10px] text-muted-foreground mb-1.5">{m.description}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {m.metrics.map((metric, i) => (
                  <div key={i} className="rounded border border-border/50 bg-background/50 px-2 py-1">
                    <p className="text-[8px] uppercase text-muted-foreground">{metric.label}</p>
                    <p className="font-mono text-[11px] font-bold text-foreground">
                      {metric.value}{metric.unit ? <span className="text-muted-foreground text-[9px]"> {metric.unit}</span> : null}
                    </p>
                  </div>
                ))}
              </div>
              {m.lastActivity ? (
                <p className="mt-1.5 text-[8px] text-muted-foreground">
                  Última atividade: {fmtTime(m.lastActivity)}
                </p>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
