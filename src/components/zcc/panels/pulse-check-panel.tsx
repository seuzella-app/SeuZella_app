"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Activity, RefreshCw, ShieldCheck, AlertTriangle, AlertOctagon, Clock, Cpu, Database, Brain, MessageSquare, CalendarCheck, MemoryStick } from "lucide-react";
import { PanelHeader } from "../shared/panel-header";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/*
 * PulseCheckPanel — monitoramento de saúde vital do sistema ZCC.
 *
 * - 6 health checks (API latency, DB, LLM, WhatsApp webhook, iCal sync, Memory usage)
 * - Status: healthy | warning | critical
 * - Uptime display
 * - Auto-refresh a cada 30s
 */

type HealthStatus = "healthy" | "warning" | "critical";

interface HealthCheck {
  id: string;
  name: string;
  description: string;
  status: HealthStatus;
  currentValue: string;
  threshold: string;
  lastChecked: string;
  icon: React.ReactNode;
  latencyMs?: number;
}

interface MetricsResponse {
  checks: HealthCheck[];
  uptimeSeconds: number;
  uptimePercent: number;
  lastFullCheck: string;
}

// ---- mock data ---------------------------------------------------------------

const now = Date.now();
const secondsAgo = (s: number) => new Date(now - s * 1000).toISOString();

const FALLBACK_METRICS: MetricsResponse = {
  uptimeSeconds: 1_842_317, // ~21 dias
  uptimePercent: 99.97,
  lastFullCheck: secondsAgo(28),
  checks: [
    {
      id: "api-latency",
      name: "API Latency",
      description: "Tempo de resposta médio dos endpoints /api/*",
      status: "healthy",
      currentValue: "124ms",
      threshold: "< 500ms",
      lastChecked: secondsAgo(12),
      latencyMs: 124,
      icon: <Activity className="size-4" />,
    },
    {
      id: "db-connection",
      name: "DB Connection",
      description: "Conexão com Vercel Postgres (prisma client)",
      status: "healthy",
      currentValue: "18ms",
      threshold: "< 100ms",
      lastChecked: secondsAgo(8),
      latencyMs: 18,
      icon: <Database className="size-4" />,
    },
    {
      id: "llm-availability",
      name: "LLM Availability",
      description: "GLM-4.7-flash via Z-AI SDK (Thompson Sampling)",
      status: "healthy",
      currentValue: "Online · 97.4% success",
      threshold: "> 95% success rate",
      lastChecked: secondsAgo(5),
      latencyMs: 312,
      icon: <Brain className="size-4" />,
    },
    {
      id: "whatsapp-webhook",
      name: "WhatsApp Webhook",
      description: "Cloud API · recebimento de mensagens 24/7",
      status: "healthy",
      currentValue: "245ms · ack OK",
      threshold: "< 1000ms",
      lastChecked: secondsAgo(3),
      latencyMs: 245,
      icon: <MessageSquare className="size-4" />,
    },
    {
      id: "ical-sync",
      name: "iCal Sync",
      description: "Sincronização Airbnb/Booking (calendar pull)",
      status: "warning",
      currentValue: "2.4s · 1 falha em 12",
      threshold: "< 1s · 0 falhas",
      lastChecked: secondsAgo(45),
      latencyMs: 2400,
      icon: <CalendarCheck className="size-4" />,
    },
    {
      id: "memory-usage",
      name: "Memory Usage",
      description: "Heap + cache local do processo Next.js",
      status: "healthy",
      currentValue: "182 MB / 512 MB",
      threshold: "< 80% do limite",
      lastChecked: secondsAgo(2),
      icon: <MemoryStick className="size-4" />,
    },
  ],
};

// ---- helpers ----------------------------------------------------------------

const STATUS_COLOR: Record<HealthStatus, string> = {
  healthy: "border-emerald-500/30 bg-emerald-500/5",
  warning: "border-amber-500/30 bg-amber-500/5",
  critical: "border-red-500/30 bg-red-500/5",
};

const STATUS_DOT: Record<HealthStatus, string> = {
  healthy: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-red-500",
};

const STATUS_TEXT: Record<HealthStatus, string> = {
  healthy: "text-emerald-400",
  warning: "text-amber-400",
  critical: "text-red-400",
};

const STATUS_LABEL: Record<HealthStatus, string> = {
  healthy: "HEALTHY",
  warning: "WARNING",
  critical: "CRITICAL",
};

const STATUS_ICON: Record<HealthStatus, React.ReactNode> = {
  healthy: <ShieldCheck className="size-3.5" />,
  warning: <AlertTriangle className="size-3.5" />,
  critical: <AlertOctagon className="size-3.5" />,
};

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s atrás`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}min atrás`;
  return `${Math.floor(diffSec / 3600)}h atrás`;
}

// ---- component --------------------------------------------------------------

export function PulseCheckPanel() {
  const [metrics, setMetrics] = React.useState<MetricsResponse>(FALLBACK_METRICS);
  const [lastRefresh, setLastRefresh] = React.useState<Date>(new Date());
  const [refreshing, setRefreshing] = React.useState(false);
  const [autoRefresh, setAutoRefresh] = React.useState(true);
  const [tick, setTick] = React.useState(0);

  const loadAll = React.useCallback(async () => {
    setRefreshing(true);
    try {
      // Simula fetch — mantém mock em modo demonstração
      await new Promise((r) => setTimeout(r, 400));
      setMetrics(FALLBACK_METRICS);
      setLastRefresh(new Date());
    } finally {
      setRefreshing(false);
    }
  }, []);

  // auto refresh a cada 30s
  React.useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      setTick((t) => t + 1);
      loadAll();
    }, 30000);
    return () => clearInterval(id);
  }, [autoRefresh, loadAll]);

  const healthyCount = metrics.checks.filter((c) => c.status === "healthy").length;
  const warningCount = metrics.checks.filter((c) => c.status === "warning").length;
  const criticalCount = metrics.checks.filter((c) => c.status === "critical").length;

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader
        title="Pulse Check"
        description="Saúde vital do sistema · 6 checks · auto-refresh 30s"
        icon={<Activity className="size-5" />}
        actions={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setAutoRefresh((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors",
                autoRefresh
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
              title="Alternar auto-refresh"
            >
              <span className="relative flex size-1.5">
                {autoRefresh ? (
                  <>
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                  </>
                ) : (
                  <span className="relative inline-flex size-1.5 rounded-full bg-muted-foreground" />
                )}
              </span>
              {autoRefresh ? "AUTO ON" : "AUTO OFF"}
            </button>
            <button
              type="button"
              onClick={() => {
                loadAll();
                toast.success("Pulse Check re-sincronizado");
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[10px] font-medium text-foreground hover:bg-secondary"
              title="Refresh manual"
            >
              <RefreshCw className={cn("size-3", refreshing && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        }
      />

      <div className="zcc-scroll flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* ===== UPTIME + RESUMO ===== */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-1 gap-3 md:grid-cols-4"
        >
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Uptime
              </span>
              <Clock className="size-4 text-emerald-400" />
            </div>
            <p className="mt-1 font-mono text-xl font-bold text-emerald-400">
              {formatUptime(metrics.uptimeSeconds)}
            </p>
            <p className="text-[11px] text-muted-foreground">desde último restart</p>
          </div>

          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Disponibilidade (30d)
              </span>
              <ShieldCheck className="size-4 text-emerald-400" />
            </div>
            <p className="mt-1 text-xl font-bold text-emerald-400">
              {metrics.uptimePercent}%
            </p>
            <p className="text-[11px] text-muted-foreground">SLA target: 99.9%</p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Status dos checks
              </span>
              <Activity className="size-4 text-primary" />
            </div>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="text-xl font-bold text-emerald-400">{healthyCount}</span>
              <span className="text-sm text-amber-400">⚠ {warningCount}</span>
              <span className="text-sm text-red-400">✕ {criticalCount}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              de {metrics.checks.length} checks totais
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Última verificação
              </span>
              <RefreshCw className={cn("size-4 text-muted-foreground", refreshing && "animate-spin")} />
            </div>
            <p className="mt-1 font-mono text-sm font-semibold text-foreground">
              {lastRefresh.toLocaleTimeString("pt-BR")}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Próxima em {30 - Math.floor((Date.now() - lastRefresh.getTime()) / 1000)}s
            </p>
          </div>
        </motion.div>

        {/* ===== SYSTEM HEALTH HEADER ===== */}
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Cpu className="size-3.5 text-primary" />
            SYSTEM HEALTH CHECKS
          </h3>
          <span className="text-[10px] text-muted-foreground">
            6 endpoints monitorados · tick #{tick}
          </span>
        </div>

        {/* ===== 6 HEALTH CHECKS ===== */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {metrics.checks.map((check, idx) => (
            <HealthCheckCard key={check.id} check={check} index={idx} />
          ))}
        </div>

        {/* ===== RODAPÉ DE STATUS ===== */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="rounded-lg border border-border bg-card p-4"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-sm font-semibold text-foreground">
                Sistema operacional
              </span>
              <span className="text-[11px] text-muted-foreground">
                {criticalCount === 0
                  ? "nenhum alerta crítico ativo"
                  : `${criticalCount} alerta(s) crítico(s)`}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Dados mockados · em produção vem do endpoint <code className="font-mono text-primary">/api/zcc/health</code>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ---- sub-components ---------------------------------------------------------

function HealthCheckCard({ check, index }: { check: HealthCheck; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className={cn(
        "rounded-lg border p-4 transition-colors",
        STATUS_COLOR[check.status]
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-md border",
              check.status === "healthy"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : check.status === "warning"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  : "border-red-500/30 bg-red-500/10 text-red-400"
            )}
          >
            {check.icon}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {check.name}
            </p>
            <p className="truncate text-[10px] text-muted-foreground">
              {check.description}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase",
            check.status === "healthy"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : check.status === "warning"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                : "border-red-500/30 bg-red-500/10 text-red-400"
          )}
        >
          {STATUS_ICON[check.status]}
          {STATUS_LABEL[check.status]}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded border border-border/60 bg-background/50 p-2">
          <p className="text-[9px] uppercase text-muted-foreground">Atual</p>
          <p className={cn("font-mono font-semibold", STATUS_TEXT[check.status])}>
            {check.currentValue}
          </p>
        </div>
        <div className="rounded border border-border/60 bg-background/50 p-2">
          <p className="text-[9px] uppercase text-muted-foreground">Threshold</p>
          <p className="font-mono text-muted-foreground">{check.threshold}</p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className={cn("size-1.5 rounded-full", STATUS_DOT[check.status])} />
          verificado {relativeTime(check.lastChecked)}
        </span>
        {check.latencyMs ? (
          <span className="font-mono">{check.latencyMs}ms</span>
        ) : null}
      </div>
    </motion.div>
  );
}
