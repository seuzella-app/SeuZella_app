"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Activity,
  Shield,
  Database,
  Dice5,
  GraduationCap,
  Code2,
  Play,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Clock,
  TrendingUp,
  Gauge,
  Terminal,
} from "lucide-react";
import { PanelHeader } from "../shared/panel-header";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/*
 * CerebroTestPanel — Testes dos 6 subsistemas do Cérebro Zélla.
 *
 * Subsistemas:
 *   1. Anomaly Detection    — detecta anomalias (error spike, latency, cost)
 *   2. Budget Guard         — guardião de orçamento (USD/dia, USD/mês)
 *   3. Semantic Cache       — cache semântico (hit rate, TTL)
 *   4. Thompson Sampling    — router de providers (alpha/beta)
 *   5. Learning Pipeline    — padrões aprendidos (verified/anti)
 *   6. Refactor Suggester  — sugestões de refatoração (LLM)
 *
 * Cada card: nome, score 0-100, status (pass/warn/fail), last test date, descrição.
 * Overall score: média ponderada.
 * Botão "Run all tests" com loading state.
 */

type SubsystemStatus = "pass" | "warn" | "fail";

interface SubsystemTest {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  score: number;
  weight: number; // peso no overall
  status: SubsystemStatus;
  lastTestAt: string;
  details: { label: string; value: string; ok: boolean }[];
}

const INITIAL_TESTS: SubsystemTest[] = [
  {
    id: "anomaly",
    name: "Anomaly Detection",
    description:
      "Detecta picos de erro, degradação de latência e anomalias de custo em tempo real.",
    icon: <Activity className="size-5" />,
    score: 95,
    weight: 1.0,
    status: "pass",
    lastTestAt: "há 2 min",
    details: [
      { label: "Error spike scan", value: "0 anomalias", ok: true },
      { label: "Latency baseline", value: "124ms", ok: true },
      { label: "Cost anomaly", value: "nominal", ok: true },
    ],
  },
  {
    id: "budget",
    name: "Budget Guard",
    description:
      "Guardião de orçamento diário e mensal (USD) com níveis nominal/warning/critical.",
    icon: <Shield className="size-5" />,
    score: 88,
    weight: 1.2,
    status: "pass",
    lastTestAt: "há 5 min",
    details: [
      { label: "Daily spend", value: "$2.47 / $10.00", ok: true },
      { label: "Monthly spend", value: "$48.20 / $300.00", ok: true },
      { label: "Critical level", value: "nominal", ok: true },
    ],
  },
  {
    id: "cache",
    name: "Semantic Cache",
    description:
      "Cache semântico de respostas LLM com hit rate, TTL médio e invalidação automática.",
    icon: <Database className="size-5" />,
    score: 92,
    weight: 0.8,
    status: "pass",
    lastTestAt: "há 1 min",
    details: [
      { label: "Hit rate", value: "78.3%", ok: true },
      { label: "Entries", value: "247", ok: true },
      { label: "Avg TTL", value: "45.2 min", ok: true },
    ],
  },
  {
    id: "thompson",
    name: "Thompson Sampling",
    description:
      "Router de providers com Thompson Sampling (alpha/beta) e Circuit Breakers.",
    icon: <Dice5 className="size-5" />,
    score: 97,
    weight: 1.0,
    status: "pass",
    lastTestAt: "há 3 min",
    details: [
      { label: "Providers ativos", value: "7/7", ok: true },
      { label: "Circuit breakers", value: "6 CLOSED · 1 HALF_OPEN", ok: true },
      { label: "Best provider", value: "glm-4.7-flash (97.4%)", ok: true },
    ],
  },
  {
    id: "learning",
    name: "Learning Pipeline",
    description:
      "Pipeline de aprendizado com padrões verificados, anti-padrões e sentiment scoring.",
    icon: <GraduationCap className="size-5" />,
    score: 85,
    weight: 0.9,
    status: "warn",
    lastTestAt: "há 8 min",
    details: [
      { label: "Total patterns", value: "1.247", ok: true },
      { label: "Verified", value: "892 (71.5%)", ok: true },
      { label: "Anti-patterns", value: "73", ok: false },
    ],
  },
  {
    id: "refactor",
    name: "Refactor Suggester",
    description:
      "Sugere refatorações de código a partir de erros recorrentes usando LLM (GLM-4.7).",
    icon: <Code2 className="size-5" />,
    score: 78,
    weight: 0.7,
    status: "warn",
    lastTestAt: "há 15 min",
    details: [
      { label: "Suggestions pending", value: "12", ok: false },
      { label: "Applied (30d)", value: "47", ok: true },
      { label: "Avg confidence", value: "78%", ok: true },
    ],
  },
];

const STATUS_META: Record<
  SubsystemStatus,
  { label: string; color: string; bg: string; border: string; icon: React.ReactNode }
> = {
  pass: {
    label: "PASS",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    icon: <CheckCircle2 className="size-3.5" />,
  },
  warn: {
    label: "WARN",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    icon: <AlertTriangle className="size-3.5" />,
  },
  fail: {
    label: "FAIL",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    icon: <XCircle className="size-3.5" />,
  },
};

function scoreToStatus(score: number): SubsystemStatus {
  if (score >= 85) return "pass";
  if (score >= 70) return "warn";
  return "fail";
}

export function CerebroTestPanel() {
  const [tests, setTests] = React.useState<SubsystemTest[]>(INITIAL_TESTS);
  const [running, setRunning] = React.useState(false);
  const [runningId, setRunningId] = React.useState<string | null>(null);
  const [lastRun, setLastRun] = React.useState<string>("há 15 min");

  const overall = React.useMemo(() => {
    const totalWeight = tests.reduce((s, t) => s + t.weight, 0);
    const weighted = tests.reduce((s, t) => s + t.score * t.weight, 0);
    return Math.round(weighted / totalWeight);
  }, [tests]);

  const overallStatus = scoreToStatus(overall);

  const runAll = async () => {
    setRunning(true);
    toast.info("Executando 6 testes de subsistemas...", {
      description: "Anomaly · Budget · Cache · Thompson · Learning · Refactor",
    });

    // Simula execução sequencial com delays
    for (let i = 0; i < tests.length; i++) {
      const t = tests[i];
      setRunningId(t.id);
      // pequena variação de score
      await new Promise((r) => setTimeout(r, 380));
      const delta = Math.floor(Math.random() * 6) - 2; // -2..+3
      const newScore = Math.max(0, Math.min(100, t.score + delta));
      setTests((prev) =>
        prev.map((x) =>
          x.id === t.id
            ? {
                ...x,
                score: newScore,
                status: scoreToStatus(newScore),
                lastTestAt: "agora",
              }
            : x
        )
      );
    }

    setRunningId(null);
    setRunning(false);
    setLastRun("agora");
    toast.success("Todos os testes concluídos", {
      description: `Overall score: ${overall}% · ${overallStatus.toUpperCase()}`,
    });
  };

  const runOne = async (id: string) => {
    setRunningId(id);
    await new Promise((r) => setTimeout(r, 600));
    setTests((prev) =>
      prev.map((x) => {
        if (x.id !== id) return x;
        const delta = Math.floor(Math.random() * 6) - 2;
        const newScore = Math.max(0, Math.min(100, x.score + delta));
        return {
          ...x,
          score: newScore,
          status: scoreToStatus(newScore),
          lastTestAt: "agora",
        };
      })
    );
    setRunningId(null);
    toast.success("Teste executado", {
      description: `Subsistema ${id} reavaliado`,
    });
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader
        title="Cérebro · Test Suite"
        description="6 subsistemas · Anomaly, Budget, Cache, Thompson, Learning, Refactor"
        icon={<Brain className="size-5" />}
        actions={
          <button
            type="button"
            onClick={runAll}
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
          >
            {running ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5" />
            )}
            {running ? "Running..." : "Run all tests"}
          </button>
        }
      />

      <div className="zcc-scroll flex-1 overflow-y-auto p-4 sm:p-6">
        {/* ====== OVERALL SCORE ====== */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6"
        >
          <div
            className={cn(
              "relative overflow-hidden rounded-lg border bg-card p-5",
              STATUS_META[overallStatus].border
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "relative grid size-16 place-items-center rounded-full border-2",
                    STATUS_META[overallStatus].border,
                    STATUS_META[overallStatus].bg
                  )}
                >
                  <Gauge className={cn("size-7", STATUS_META[overallStatus].color)} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Overall Cérebro score · weighted avg
                  </p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold text-foreground">{overall}%</p>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase",
                        STATUS_META[overallStatus].border,
                        STATUS_META[overallStatus].color,
                        STATUS_META[overallStatus].bg
                      )}
                    >
                      {STATUS_META[overallStatus].icon}
                      {STATUS_META[overallStatus].label}
                    </span>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="size-3" />
                    último run: {lastRun}
                  </p>
                </div>
              </div>

              {/* Mini stats */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold text-emerald-400">
                    {tests.filter((t) => t.status === "pass").length}
                  </p>
                  <p className="text-[9px] uppercase text-muted-foreground">pass</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-amber-400">
                    {tests.filter((t) => t.status === "warn").length}
                  </p>
                  <p className="text-[9px] uppercase text-muted-foreground">warn</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-red-400">
                    {tests.filter((t) => t.status === "fail").length}
                  </p>
                  <p className="text-[9px] uppercase text-muted-foreground">fail</p>
                </div>
              </div>
            </div>

            {/* Overall progress bar */}
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <motion.div
                className={cn(
                  "h-full",
                  overallStatus === "pass"
                    ? "bg-emerald-400"
                    : overallStatus === "warn"
                      ? "bg-amber-400"
                      : "bg-red-400"
                )}
                initial={{ width: 0 }}
                animate={{ width: `${overall}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>
          </div>
        </motion.div>

        {/* ====== SUBSYSTEM CARDS ====== */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Brain className="size-3.5 text-primary" />
              Subsistemas · {tests.length} testes
            </h3>
            <span className="text-[10px] text-muted-foreground">
              clique em um card para re-testar
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tests.map((test, idx) => (
              <SubsystemCard
                key={test.id}
                test={test}
                index={idx}
                running={runningId === test.id}
                onRun={() => runOne(test.id)}
              />
            ))}
          </div>
        </motion.div>

        {/* ====== TELEMETRY TERMINAL · Live feed do cérebro ====== */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6"
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Terminal className="size-3.5 text-emerald-400" />
              Telemetria do Cérebro · Terminal Live
            </h3>
            <span className="text-[10px] text-muted-foreground">
              tempo real · decisões · alertas · aprendizado
            </span>
          </div>
          <CerebroTelemetryTerminal />
        </motion.div>
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTES
// ============================================================================

function SubsystemCard({
  test,
  index,
  running,
  onRun,
}: {
  test: SubsystemTest;
  index: number;
  running: boolean;
  onRun: () => void;
}) {
  const meta = STATUS_META[test.status];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={cn(
        "relative overflow-hidden rounded-lg border bg-card p-4 transition-colors",
        meta.border
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "grid size-9 place-items-center rounded-md border",
              meta.border,
              meta.bg,
              meta.color
            )}
          >
            {test.icon}
          </span>
          <div>
            <p className="text-sm font-bold text-foreground">{test.name}</p>
            <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="size-2.5" />
              {test.lastTestAt}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase",
            meta.border,
            meta.color,
            meta.bg
          )}
        >
          {meta.icon}
          {meta.label}
        </span>
      </div>

      {/* Score */}
      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            score
          </p>
          <div className="flex items-baseline gap-1">
            <p className={cn("text-2xl font-bold", meta.color)}>{test.score}</p>
            <span className="text-xs text-muted-foreground">/100</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <TrendingUp className="size-3" />
          peso {test.weight}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <motion.div
          className={cn(
            "h-full",
            test.status === "pass"
              ? "bg-emerald-400"
              : test.status === "warn"
                ? "bg-amber-400"
                : "bg-red-400"
          )}
          initial={{ width: 0 }}
          animate={{ width: `${test.score}%` }}
          transition={{ duration: 0.5, delay: index * 0.05 + 0.1 }}
        />
      </div>

      {/* Description */}
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        {test.description}
      </p>

      {/* Details */}
      <div className="mt-3 space-y-1 border-t border-border pt-3">
        {test.details.map((d) => (
          <div
            key={d.label}
            className="flex items-center justify-between text-[10px]"
          >
            <span className="text-muted-foreground">{d.label}</span>
            <span className="flex items-center gap-1.5">
              <span className="font-mono text-foreground">{d.value}</span>
              {d.ok ? (
                <CheckCircle2 className="size-3 text-emerald-400" />
              ) : (
                <AlertTriangle className="size-3 text-amber-400" />
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Run button */}
      <div className="mt-3 flex items-center justify-end border-t border-border pt-3">
        <button
          type="button"
          onClick={onRun}
          disabled={running}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground disabled:opacity-50"
        >
          {running ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}
          {running ? "Testing..." : "Re-test"}
        </button>
      </div>

      {/* Loading overlay */}
      <AnimatePresence>
        {running && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-[1px]"
          >
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="size-5 animate-spin text-primary" />
              <span className="text-[10px] font-medium text-muted-foreground">
                executando...
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// CEREBRO TELEMETRY TERMINAL — Painel live de telemetria do cérebro
// ============================================================================

interface TelemetryLine {
  id: string;
  timestamp: string;
  level: 'INFO' | 'OK' | 'WARN' | 'ERROR' | 'CRITICAL';
  module: string;
  message: string;
}

const TELEMETRY_SEED: Array<Omit<TelemetryLine, 'id' | 'timestamp'>> = [
  { level: 'INFO', module: 'orchestrator', message: 'Cérebro Zélla inicializado · 25 módulos carregados' },
  { level: 'OK', module: 'anomaly-detector', message: 'Detector pronto · 4 estratégias ativas (3σ)' },
  { level: 'OK', module: 'circuit-breakers', message: '8 providers Thompson Sampling (α/β) carregados' },
  { level: 'OK', module: 'semantic-cache', message: 'Cache hidratado · 247 entradas · hit rate 78%' },
  { level: 'OK', module: 'budget-guard', message: 'Budget nominal · $2.47/$10 diário (24.7%)' },
  { level: 'INFO', module: 'learning-engine', message: 'Brain age: 145 dias · 1247 padrões (892 verificados)' },
  { level: 'OK', module: 'alert-bus', message: 'Canais: email, dashboard, slack · 12 alertas 24h' },
  { level: 'INFO', module: 'glm-service', message: 'GLM-4.7-flash em modo mock (economia de tokens)' },
  { level: 'WARN', module: 'circuit-breakers', message: 'DeepSeek V3 circuit HALF_OPEN · testando recuperação' },
  { level: 'OK', module: 'auto-remediator', message: '3 tentativas 24h · 2 sucesso · 1 falha' },
  { level: 'OK', module: 'refactor-suggester', message: '8 sugestões geradas · 5 pending review' },
  { level: 'INFO', module: 'knowledge-distiller', message: '47 entries consolidadas em 12 clusters' },
  { level: 'OK', module: 'telemetry-bridge', message: '6 tenants conectados · 348 eventos enviados' },
  { level: 'INFO', module: 'orchestrator', message: 'Sales Brain acionado · lead score 96' },
  { level: 'OK', module: 'guest-responder-brain', message: '348 mensagens 24h · 78% auto-resposta' },
  { level: 'WARN', module: 'anomaly-detector', message: 'Pico de latência em /api/zcc/metrics (2.4σ acima)' },
  { level: 'OK', module: 'contextual-bandits', message: 'Best arm: "amigável" · regret 0.12' },
  { level: 'OK', module: 'self-defense', message: '0 IPs bloqueados · rate limit 5 req/15min OK' },
  { level: 'INFO', module: 'sales-brain', message: 'Pitch gerado · LTV previsto R$ 7140' },
  { level: 'OK', module: 'zelador-suporte-brain', message: '6/8 tickets resolvidos · satisfação 94%' },
  { level: 'INFO', module: 'vulnerability-scanner', message: 'Scan semanal OK · 0 deps vulneráveis' },
  { level: 'OK', module: 'code-indexer', message: '1270 arquivos indexados · 4280 embeddings' },
  { level: 'INFO', module: 'tfidf', message: '3480 documentos · top term: "hóspede"' },
  { level: 'OK', module: 'semantic-similarity', message: '142 queries 24h · match rate 78%' },
  { level: 'OK', module: 'best-practices', message: '47 regras · 234 aplicações · 0 violações' },
  { level: 'INFO', module: 'zella-skills', message: '24 skills · 12 ativas · accuracy 91%' },
  { level: 'CRITICAL', module: 'budget-guard', message: 'Cérebro consumiu 24% do budget diário · monitorando' },
  { level: 'OK', module: 'orchestrator', message: 'Fallback para GLM-4.7-flash (cache miss + tier-1)' },
  { level: 'INFO', module: 'learning-engine', message: 'Novo padrão: "hóspede elogia café → upsell Premium"' },
  { level: 'OK', module: 'alert-bus', message: 'Alerta enviado dashboard · budget 24%' },
];

const LEVEL_COLOR: Record<TelemetryLine['level'], string> = {
  INFO: 'text-blue-400',
  OK: 'text-emerald-400',
  WARN: 'text-amber-400',
  ERROR: 'text-red-400',
  CRITICAL: 'text-red-500 font-bold',
};

const LEVEL_BG: Record<TelemetryLine['level'], string> = {
  INFO: 'bg-blue-500/10 border-blue-500/30',
  OK: 'bg-emerald-500/10 border-emerald-500/30',
  WARN: 'bg-amber-500/10 border-amber-500/30',
  ERROR: 'bg-red-500/10 border-red-500/30',
  CRITICAL: 'bg-red-500/20 border-red-500/40',
};

function formatTelemetryTime(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function CerebroTelemetryTerminal() {
  const [lines, setLines] = React.useState<TelemetryLine[]>([]);
  const [isLive, setIsLive] = React.useState(true);
  const [filter, setFilter] = React.useState<'all' | TelemetryLine['level']>('all');
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const seedIndex = React.useRef(0);

  // Adiciona uma nova linha a cada 2 segundos
  React.useEffect(() => {
    if (!isLive) return;

    const addLine = () => {
      const seed = TELEMETRY_SEED[seedIndex.current % TELEMETRY_SEED.length];
      seedIndex.current++;

      const newLine: TelemetryLine = {
        id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: formatTelemetryTime(new Date()),
        ...seed,
      };

      setLines((prev) => {
        const next = [...prev, newLine];
        return next.length > 100 ? next.slice(-100) : next;
      });
    };

    // Adiciona 5 linhas iniciais rápido
    for (let i = 0; i < 5; i++) {
      setTimeout(() => addLine(), i * 100);
    }

    const id = setInterval(addLine, 2500);
    return () => clearInterval(id);
  }, [isLive]);

  // Auto-scroll para o final quando novas linhas chegam
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const filteredLines = React.useMemo(() => {
    if (filter === 'all') return lines;
    return lines.filter((l) => l.level === filter);
  }, [lines, filter]);

  const stats = React.useMemo(() => {
    return {
      total: lines.length,
      info: lines.filter((l) => l.level === 'INFO').length,
      ok: lines.filter((l) => l.level === 'OK').length,
      warn: lines.filter((l) => l.level === 'WARN').length,
      error: lines.filter((l) => l.level === 'ERROR').length,
      critical: lines.filter((l) => l.level === 'CRITICAL').length,
    };
  }, [lines]);

  return (
    <div className="rounded-lg border border-emerald-500/30 bg-black/80 overflow-hidden">
      {/* Terminal header */}
      <div className="flex items-center justify-between border-b border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-red-500/80" />
            <span className="size-2.5 rounded-full bg-amber-500/80" />
            <span className="size-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <span className="ml-2 text-[11px] font-mono text-emerald-400">
            zélla-cérebro ~ telemetry
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase",
            isLive ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-border bg-secondary text-muted-foreground"
          )}>
            <span className={cn("size-1.5 rounded-full", isLive ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground")} />
            {isLive ? 'LIVE' : 'PAUSED'}
          </span>
          <button
            onClick={() => setIsLive((v) => !v)}
            className="rounded border border-border bg-background px-2 py-0.5 text-[9px] font-medium text-muted-foreground hover:text-foreground"
          >
            {isLive ? '⏸ Pausar' : '▶ Retomar'}
          </button>
          <button
            onClick={() => setLines([])}
            className="rounded border border-border bg-background px-2 py-0.5 text-[9px] font-medium text-muted-foreground hover:text-foreground"
          >
            🗑 Limpar
          </button>
        </div>
      </div>

      {/* Filters + Stats */}
      <div className="flex items-center justify-between border-b border-emerald-500/20 px-3 py-1.5 bg-black/60">
        <div className="flex items-center gap-0.5">
          <span className="text-[9px] text-muted-foreground mr-1">filter:</span>
          {(['all', 'INFO', 'OK', 'WARN', 'ERROR', 'CRITICAL'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded px-1.5 py-0.5 text-[9px] font-mono font-bold transition-colors",
                filter === f ? "bg-emerald-500/20 text-emerald-400" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[9px] font-mono">
          <span className="text-blue-400">{stats.info} INFO</span>
          <span className="text-emerald-400">{stats.ok} OK</span>
          <span className="text-amber-400">{stats.warn} WARN</span>
          <span className="text-red-400">{stats.error} ERR</span>
          <span className="text-red-500 font-bold">{stats.critical} CRIT</span>
        </div>
      </div>

      {/* Terminal body */}
      <div
        ref={scrollRef}
        className="h-80 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed zcc-scroll"
        style={{
          fontFamily: 'var(--font-mono, ui-monospace, "JetBrains Mono", Menlo, Monaco, Consolas, monospace)',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.9) 100%)',
        }}
      >
        {filteredLines.length === 0 ? (
          <div className="text-muted-foreground text-center py-8">
            <Activity className="size-4 mx-auto mb-2 opacity-40" />
            <span>Aguardando telemetria do cérebro...</span>
          </div>
        ) : (
          filteredLines.map((line) => (
            <motion.div
              key={line.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-start gap-2 py-0.5 hover:bg-emerald-500/5 rounded px-1"
            >
              <span className="text-muted-foreground/60 shrink-0">
                [{line.timestamp}]
              </span>
              <span className={cn(
                "shrink-0 inline-flex items-center justify-center rounded border px-1 text-[9px] font-bold",
                LEVEL_BG[line.level],
                LEVEL_COLOR[line.level]
              )}>
                {line.level}
              </span>
              <span className="text-violet-400 shrink-0">
                {line.module}:
              </span>
              <span className={cn(
                "min-w-0 flex-1",
                line.level === 'CRITICAL' ? 'text-red-300 font-bold' :
                line.level === 'ERROR' ? 'text-red-300' :
                line.level === 'WARN' ? 'text-amber-300' :
                line.level === 'OK' ? 'text-emerald-300' :
                'text-foreground/90'
              )}>
                {line.message}
              </span>
            </motion.div>
          ))
        )}
      </div>

      {/* Terminal footer */}
      <div className="border-t border-emerald-500/20 bg-black/60 px-3 py-1.5">
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className="text-emerald-400">zélla@cérebro</span>
          <span className="text-muted-foreground">:</span>
          <span className="text-blue-400">~/telemetry</span>
          <span className="text-muted-foreground">$</span>
          {isLive ? (
            <span className="inline-block w-2 h-3.5 bg-emerald-400 animate-pulse" />
          ) : (
            <span className="text-muted-foreground italic">pausado</span>
          )}
        </div>
      </div>
    </div>
  );
}
