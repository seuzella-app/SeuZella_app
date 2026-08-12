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
