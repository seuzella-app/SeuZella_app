"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Activity,
  Wifi,
  WifiOff,
  Brain,
  RefreshCw,
  DollarSign,
  Users,
  MessageSquare,
  CalendarCheck,
  Cpu,
  Gauge,
  CreditCard,
  Home as HomeIcon,
  Database,
  Zap,
  Sparkles,
  ArrowRight,
  Clock,
} from "lucide-react";
import { PanelHeader } from "../shared/panel-header";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/*
 * OperatorConsolePanel — Console do operador ZCC (substitui OverviewPanel).
 *
 * 4 seções:
 *   1. PULSE ROW       — 6 KPIs (MRR, Clientes, Mensagens 24h, Reservas 7d, Agentes 0/12, Cérebro acc)
 *   2. CONNECTIONS     — 6 integrações (WhatsApp, Airbnb, Mercado Pago, Z-AI SDK, Groq, Vercel Postgres)
 *   3. AGENT LIST      — 12 agentes com status, last run, cost USD
 *   4. KNOWLEDGE CORE  — Live feed + recent decisions (2 colunas)
 *
 * Hidrata via fetch('/api/zcc/metrics') e fetch('/api/zcc/agents') com fallbacks mock.
 */

// ============================================================================
// TIPOS
// ============================================================================

type TrendDir = "up" | "down" | "stable";

interface PulseKPI {
  label: string;
  value: string | number;
  hint?: string;
  trend?: TrendDir;
  trendValue?: string;
  icon: React.ReactNode;
  accent?: "primary" | "emerald" | "amber" | "rose";
}

interface ConsoleIntegration {
  id: string;
  name: string;
  category: "messaging" | "booking" | "payment" | "llm" | "database";
  status: "online" | "idle";
  latencyMs: number;
  purpose: string;
  isLLM?: boolean;
}

interface ConsoleAgent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  department: string;
  status: "idle" | "active" | "thinking" | "error" | "offline";
  lastRun: string;
  costUsd: number;
  model?: string;
}

interface FeedEntry {
  id: string;
  type: "info" | "ok" | "warn" | "error" | "decision";
  agent: string;
  message: string;
  detail?: string;
  at: string;
  confidence?: number;
}

interface DecisionEntry {
  id: string;
  title: string;
  rationale: string;
  agent: string;
  at: string;
  confidence: number;
}

interface MetricsResponse {
  pulse: PulseKPI[];
  integrations: ConsoleIntegration[];
  feed: FeedEntry[];
  decisions: DecisionEntry[];
  cerebroAccuracy: number;
}

// ============================================================================
// MOCK DATA (fallback)
// ============================================================================

const now = Date.now();
const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();

const FALLBACK_METRICS: MetricsResponse = {
  cerebroAccuracy: 94.2,
  pulse: [
    {
      label: "MRR",
      value: "R$ 48.5k",
      hint: "vs mês anterior",
      trend: "up",
      trendValue: "+8.4%",
      icon: <DollarSign className="size-4" />,
      accent: "primary",
    },
    {
      label: "Clientes",
      value: 122,
      hint: "ativos",
      trend: "up",
      trendValue: "+4",
      icon: <Users className="size-4" />,
      accent: "emerald",
    },
    {
      label: "Mensagens 24h",
      value: 1847,
      hint: "via WhatsApp",
      trend: "up",
      trendValue: "+12%",
      icon: <MessageSquare className="size-4" />,
      accent: "emerald",
    },
    {
      label: "Reservas 7d",
      value: 89,
      hint: "confirmadas",
      trend: "up",
      trendValue: "+7",
      icon: <CalendarCheck className="size-4" />,
      accent: "emerald",
    },
    {
      label: "Agentes ativos",
      value: "0/12",
      hint: "prontos p/ execução",
      trend: "stable",
      icon: <Cpu className="size-4" />,
      accent: "amber",
    },
    {
      label: "Cérebro accuracy",
      value: "94.2%",
      hint: "Thompson Sampling",
      trend: "up",
      trendValue: "+1.1pp",
      icon: <Gauge className="size-4" />,
      accent: "primary",
    },
  ],
  integrations: [
    {
      id: "whatsapp",
      name: "WhatsApp Cloud API",
      category: "messaging",
      status: "online",
      latencyMs: 245,
      purpose: "Envio/recebimento de mensagens 24/7",
    },
    {
      id: "airbnb",
      name: "Airbnb OAuth",
      category: "booking",
      status: "online",
      latencyMs: 892,
      purpose: "Sincroniza calendário e reservas Airbnb",
    },
    {
      id: "mercado-pago",
      name: "Mercado Pago",
      category: "payment",
      status: "online",
      latencyMs: 412,
      purpose: "Geração de PIX e processamento de pagamentos",
    },
    {
      id: "zai-sdk",
      name: "Z-AI SDK (GLM)",
      category: "llm",
      status: "online",
      latencyMs: 320,
      purpose: "LLM principal — glm-4.7 para análise",
      isLLM: true,
    },
    {
      id: "groq",
      name: "Groq (Llama 3 70B)",
      category: "llm",
      status: "idle",
      latencyMs: 89,
      purpose: "LLM rápido para routing/comms",
      isLLM: true,
    },
    {
      id: "vercel-postgres",
      name: "Vercel Postgres",
      category: "database",
      status: "online",
      latencyMs: 18,
      purpose: "Banco principal — leads, agentes, eventos",
    },
  ],
  feed: [
    {
      id: "f1",
      type: "ok",
      agent: "cerebro",
      message: "Cérebro analisou padrões de ocupação — sem anomalias nas últimas 24h.",
      detail: "Ocupação média: 87%. Threshold: 3σ.",
      at: minutesAgo(8),
      confidence: 0.95,
    },
    {
      id: "f2",
      type: "decision",
      agent: "finance",
      message: "Finance Agent detectou 2 PIX pendentes — seguindo para conciliação.",
      detail: "Valor total: R$ 1.194. Plano: PRO ×2, MAX ×1.",
      at: minutesAgo(15),
      confidence: 0.88,
    },
    {
      id: "f3",
      type: "info",
      agent: "conductor",
      message: "Conductor routeou 47 mensagens para Comms Agent (24h).",
      at: minutesAgo(32),
    },
    {
      id: "f4",
      type: "warn",
      agent: "budget-guard",
      message: "Budget Guard: gasto diário em 24.7% do limite ($2.47 / $10.00).",
      detail: "Nível nominal. Sem ação necessária.",
      at: minutesAgo(45),
      confidence: 0.92,
    },
    {
      id: "f5",
      type: "ok",
      agent: "refactor",
      message: "Refactor Suggester aplicou 3 refatorações automáticas (30d).",
      detail: "Confiança média: 78%. Arquivos: router.ts, cache.ts, agents.ts.",
      at: minutesAgo(67),
      confidence: 0.78,
    },
    {
      id: "f6",
      type: "info",
      agent: "leads",
      message: "Leads Agent: 12 novos leads qualificados (score ≥ 70).",
      at: minutesAgo(92),
    },
    {
      id: "f7",
      type: "decision",
      agent: "thompson",
      message: "Thompson Sampling: glm-4.7-flash mantém 97.4% como melhor provider.",
      detail: "Alpha: 847, Beta: 23. Circuit: CLOSED.",
      at: minutesAgo(118),
      confidence: 0.97,
    },
  ],
  decisions: [
    {
      id: "d1",
      title: "Reajuste de preço +12% para alta temporada",
      rationale:
        "Demanda projetada 34% acima da capacidade. Concorrentes subiram 8-15%. Elasticidade -0.4.",
      agent: "finance",
      at: minutesAgo(15),
      confidence: 0.88,
    },
    {
      id: "d2",
      title: "Roteamento 100% para glm-4.7-flash",
      rationale:
        "Thompson Sampling convergeu: 97.4% success rate, 124ms latência, $0.10/1k input.",
      agent: "thompson",
      at: minutesAgo(118),
      confidence: 0.97,
    },
    {
      id: "d3",
      title: "Suspender tenant t-927 por inadimplência",
      rationale:
        "3 faturas em atraso. Tentativas de cobrança: 4. Score de risco: 0.91 (crítico).",
      agent: "cerebro",
      at: minutesAgo(240),
      confidence: 0.91,
    },
    {
      id: "d4",
      title: "Aplicar refatoração em router.ts",
      rationale:
        "Padrão de erro recorrente (47 ocorrências em 30d). Refatoração proposta com 78% confiança.",
      agent: "refactor",
      at: minutesAgo(67),
      confidence: 0.78,
    },
    {
      id: "d5",
      title: "Priorizar leads da região Sul (SC/PR/RS)",
      rationale:
        "Taxa de conversão 2.3x maior que média nacional. CAC 34% menor.",
      agent: "leads",
      at: minutesAgo(92),
      confidence: 0.84,
    },
  ],
};

// 12 agentes com cost USD (não existe no schema, mockado)
const FALLBACK_AGENTS: ConsoleAgent[] = [
  { id: "conductor", name: "Conductor", emoji: "🎭", role: "Maestro que roteia comandos", department: "command", status: "active", lastRun: minutesAgo(0.5 * 60), costUsd: 0.42, model: "glm-4.7-flash" },
  { id: "comms-agent", name: "Comms Agent", emoji: "💬", role: "Comunicação unificada WA/IG/email", department: "comms", status: "active", lastRun: minutesAgo(2 * 60), costUsd: 1.18, model: "glm-4.7-flash" },
  { id: "finance-agent", name: "Finance Agent", emoji: "💰", role: "DRE, fluxo de caixa, despesas", department: "finance", status: "thinking", lastRun: minutesAgo(8 * 60), costUsd: 2.34, model: "glm-4.7" },
  { id: "operations-agent", name: "Operations Agent", emoji: "⚙️", role: "Limpeza, manutenção, checklists", department: "operations", status: "idle", lastRun: minutesAgo(1.5 * 60), costUsd: 0.87, model: "glm-4.7-flash" },
  { id: "goals-agent", name: "Goals Agent", emoji: "🎯", role: "KPIs e metas com projeção linear", department: "finance", status: "idle", lastRun: minutesAgo(6 * 60), costUsd: 1.42, model: "glm-4.7" },
  { id: "leads-agent", name: "Leads Agent", emoji: "📍", role: "Funil comercial e mapa de leads", department: "sales", status: "active", lastRun: minutesAgo(0.8 * 60), costUsd: 0.94, model: "glm-4.7-flash" },
  { id: "data-agent", name: "Data Agent", emoji: "🗄️", role: "Busca na base de conhecimento", department: "tech", status: "idle", lastRun: minutesAgo(4 * 60), costUsd: 0.31, model: "glm-4.7-flash" },
  { id: "cerebro-agent", name: "Cérebro Agent", emoji: "🧠", role: "Detecção de anomalias, churn risk", department: "tech", status: "thinking", lastRun: minutesAgo(1 * 60), costUsd: 3.87, model: "glm-4.7" },
  { id: "refactor-agent", name: "Refactor Agent", emoji: "🔧", role: "Auto-aprendizado, sugestões de refactor", department: "tech", status: "idle", lastRun: minutesAgo(12 * 60), costUsd: 1.62, model: "glm-4.7" },
  { id: "whatsapp-worker", name: "WhatsApp Worker", emoji: "📱", role: "Status WA e mensagens processadas", department: "comms", status: "active", lastRun: minutesAgo(0.2 * 60), costUsd: 0.18, model: "glm-4.7-flash" },
  { id: "airbnb-worker", name: "Airbnb Worker", emoji: "🏠", role: "Sincronização iCal e ocupação", department: "operations", status: "idle", lastRun: minutesAgo(3 * 60), costUsd: 0.24, model: "glm-4.7-flash" },
  { id: "onboarding-agent", name: "Onboarding Agent", emoji: "👋", role: "Orienta novos tenants no setup", department: "sales", status: "idle", lastRun: minutesAgo(5 * 60), costUsd: 0.56, model: "glm-4.7-flash" },
];

// ============================================================================
// CONSTANTES DE UI
// ============================================================================

const INTEGRATION_ICON: Record<ConsoleIntegration["category"], React.ReactNode> = {
  messaging: <MessageSquare className="size-4" />,
  booking: <HomeIcon className="size-4" />,
  payment: <CreditCard className="size-4" />,
  llm: <Cpu className="size-4" />,
  database: <Database className="size-4" />,
};

const TREND_ICON: Record<TrendDir, React.ReactNode> = {
  up: <ArrowRight className="size-3 rotate-[-45deg] text-emerald-400" />,
  down: <ArrowRight className="size-3 rotate-45 text-red-400" />,
  stable: <span className="text-muted-foreground">—</span>,
};

const ACCENT_COLOR: Record<string, string> = {
  primary: "border-primary/30 bg-primary/10 text-primary",
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  rose: "border-rose-500/30 bg-rose-500/10 text-rose-400",
};

const AGENT_STATUS_COLOR: Record<ConsoleAgent["status"], string> = {
  idle: "border-slate-700 bg-secondary text-slate-400",
  active: "border-emerald-700 bg-emerald-500/10 text-emerald-400",
  thinking: "border-amber-700 bg-amber-500/10 text-amber-400",
  error: "border-red-700 bg-red-500/10 text-red-400",
  offline: "border-zinc-700 bg-zinc-700/20 text-zinc-500",
};

const DEPT_COLOR: Record<string, string> = {
  command: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
  comms: "border-cyan-500/40 text-cyan-400 bg-cyan-500/10",
  finance: "border-amber-500/40 text-amber-400 bg-amber-500/10",
  operations: "border-sky-500/40 text-sky-400 bg-sky-500/10",
  sales: "border-violet-500/40 text-violet-400 bg-violet-500/10",
  tech: "border-rose-500/40 text-rose-400 bg-rose-500/10",
  marketing: "border-pink-500/40 text-pink-400 bg-pink-500/10",
};

// ============================================================================
// HELPERS
// ============================================================================

const relativeTime = (isoDate: string): string => {
  const diff = Date.now() - new Date(isoDate).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
};

const fmtUSD = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export function OperatorConsolePanel() {
  const [metrics, setMetrics] = React.useState<MetricsResponse>(FALLBACK_METRICS);
  const [agentList, setAgentList] = React.useState<ConsoleAgent[]>(FALLBACK_AGENTS);
  const [loading, setLoading] = React.useState(false);
  const [usingFallback, setUsingFallback] = React.useState(true);
  const [updatedAt, setUpdatedAt] = React.useState("");

  React.useEffect(() => {
    const update = () => {
      setUpdatedAt(
        new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadMetrics = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/zcc/metrics");
      if (!res.ok) throw new Error("metrics API error");
      const json = await res.json();
      if (json?.success && json?.data) {
        // adapt API -> local shape (best effort)
        const d = json.data;
        setMetrics({
          cerebroAccuracy: d.cerebroAccuracy ?? FALLBACK_METRICS.cerebroAccuracy,
          pulse: d.pulse ?? FALLBACK_METRICS.pulse,
          integrations: d.integrations ?? FALLBACK_METRICS.integrations,
          feed: d.feed ?? FALLBACK_METRICS.feed,
          decisions: d.decisions ?? FALLBACK_METRICS.decisions,
        });
        setUsingFallback(false);
        return;
      }
      throw new Error("invalid metrics response");
    } catch {
      setMetrics(FALLBACK_METRICS);
      setUsingFallback(true);
    }
  }, []);

  const loadAgents = React.useCallback(async () => {
    try {
      const res = await fetch("/api/zcc/agents");
      if (!res.ok) throw new Error("agents API error");
      const json = await res.json();
      if (json?.success && json?.data?.agents) {
        const adapted: ConsoleAgent[] = json.data.agents.map(
          (a: {
            id: string;
            name: string;
            emoji?: string;
            role?: string;
            department?: string;
            status?: ConsoleAgent["status"];
            lastRun?: string;
            defaultModel?: string;
          }) => ({
            id: a.id,
            name: a.name,
            emoji: a.emoji ?? "🤖",
            role: a.role ?? "",
            department: a.department ?? "operations",
            status: a.status ?? "idle",
            lastRun: a.lastRun ?? minutesAgo(60),
            costUsd: 0,
            model: a.defaultModel,
          })
        );
        // merge cost USD mockado
        const merged = adapted.map((a, i) => ({
          ...a,
          costUsd: FALLBACK_AGENTS[i % FALLBACK_AGENTS.length].costUsd,
        }));
        setAgentList(merged);
      }
    } catch {
      setAgentList(FALLBACK_AGENTS);
    }
  }, []);

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    await Promise.allSettled([loadMetrics(), loadAgents()]);
    setLoading(false);
  }, [loadMetrics, loadAgents]);

  React.useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onlineIntegrations = metrics.integrations.filter(
    (i) => i.status === "online"
  ).length;
  const activeAgents = agentList.filter(
    (a) => a.status === "active" || a.status === "thinking"
  ).length;
  const totalCostUsd = agentList.reduce((s, a) => s + a.costUsd, 0);

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader
        title="Operator Console"
        description="Command Center · decisão executiva em tempo real"
        icon={<LayoutDashboard className="size-5" />}
        actions={
          <div className="flex items-center gap-2">
            {usingFallback ? (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                fallback
              </span>
            ) : null}
            <span className="hidden text-[11px] text-muted-foreground sm:inline">
              ATUALIZADO {updatedAt}
            </span>
            <button
              type="button"
              onClick={() => {
                loadAll();
                toast.success("Console atualizado", {
                  description: usingFallback
                    ? "usando fallback local"
                    : "dados hidratados da API",
                });
              }}
              disabled={loading}
              className="grid size-7 place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              title="Recarregar"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            </button>
          </div>
        }
      />

      <div className="zcc-scroll flex-1 overflow-y-auto p-4 sm:p-6">
        {/* ====== HERO · Mission Control Banner ====== */}
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="mb-6 relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background p-5"
        >
          {/* Animated pulse dots background */}
          <div className="absolute inset-0 pointer-events-none opacity-20">
            <div className="absolute top-2 left-1/4 size-1.5 rounded-full bg-primary animate-ping" style={{ animationDelay: "0s" }} />
            <div className="absolute top-6 right-1/3 size-1.5 rounded-full bg-emerald-500 animate-ping" style={{ animationDelay: "1.5s" }} />
            <div className="absolute bottom-3 left-1/2 size-1.5 rounded-full bg-violet-500 animate-ping" style={{ animationDelay: "0.7s" }} />
            <div className="absolute bottom-6 right-1/4 size-1.5 rounded-full bg-amber-500 animate-ping" style={{ animationDelay: "2s" }} />
          </div>

          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Mission control icon with pulsing rings */}
              <div className="relative">
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  className="grid size-14 place-items-center rounded-xl bg-gradient-to-br from-primary/30 to-primary/5 border border-primary/40"
                >
                  <LayoutDashboard className="size-7 text-primary" />
                </motion.div>
                <motion.div
                  animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                  className="absolute inset-0 rounded-xl border-2 border-primary"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-foreground">Mission Control</h2>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {usingFallback ? "Mock" : "Live"}
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase text-primary">
                    <Cpu className="size-2.5" />
                    Cérebro {metrics.cerebroAccuracy}%
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Zélla Central Control · {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                </p>
              </div>
            </div>

            {/* Real-time clock */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">agora</p>
                <p className="font-mono text-2xl font-bold text-primary tabular-nums">{updatedAt}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  loadAll();
                  toast.success("Console atualizado", {
                    description: usingFallback ? "usando fallback local" : "dados hidratados da API",
                  });
                }}
                disabled={loading}
                className="grid size-10 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
                title="Recarregar dados"
              >
                <RefreshCw className={cn("size-5", loading && "animate-spin")} />
              </button>
            </div>
          </div>

          {/* Quick stats bar */}
          <div className="relative mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {metrics.pulse.slice(0, 6).map((kpi, idx) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="rounded-lg border border-border/60 bg-background/40 px-2 py-1.5 backdrop-blur"
              >
                <p className="text-[8px] uppercase tracking-wider text-muted-foreground">{kpi.label}</p>
                <p className={cn(
                  "font-mono text-sm font-bold",
                  kpi.trend === "up" ? "text-emerald-400" :
                  kpi.trend === "down" ? "text-red-400" :
                  "text-foreground"
                )}>
                  {kpi.value}
                </p>
                {kpi.trendValue ? (
                  <p className={cn(
                    "text-[8px] flex items-center gap-0.5",
                    kpi.trend === "up" ? "text-emerald-400" :
                    kpi.trend === "down" ? "text-red-400" :
                    "text-muted-foreground"
                  )}>
                    {kpi.trend === "up" ? <ArrowRight className="size-2" /> : <ArrowRight className="size-2" />}
                    {kpi.trendValue}
                  </p>
                ) : null}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ====== PULSE ROW · 6 KPIs executivos ====== */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6"
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Activity className="size-3.5 text-emerald-400" />
              PULSE · OPERATOR CONSOLE
            </h3>
            <span className="text-[10px] text-muted-foreground">
              6 KPIs · atualização em tempo real
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {metrics.pulse.map((kpi, idx) => (
              <PulseKpiCard key={kpi.label} kpi={kpi} index={idx} />
            ))}
          </div>
        </motion.div>

        {/* ====== CONNECTIONS · 6 integrações ====== */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="mb-6"
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Wifi className="size-3.5 text-emerald-400" />
              CONNECTIONS · LIVE INTEGRATIONS
            </h3>
            <span className="text-[11px] text-muted-foreground">
              <span className="font-bold text-emerald-400">{onlineIntegrations}</span>
              /{metrics.integrations.length} ONLINE
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {metrics.integrations.map((integration, idx) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                index={idx}
              />
            ))}
          </div>
        </motion.div>

        {/* ====== AGENT LIST · 12 agentes ====== */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="mb-6"
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="size-3.5 text-emerald-400" />
              AGENT LIST · {agentList.length} AGENTS · {activeAgents} ATIVOS
            </h3>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <DollarSign className="size-3 text-primary" />
              custo 24h:{" "}
              <span className="font-bold text-primary">{fmtUSD(totalCostUsd)}</span>
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {agentList.map((agent, idx) => (
              <AgentCard key={agent.id} agent={agent} index={idx} />
            ))}
          </div>
        </motion.div>

        {/* ====== KNOWLEDGE CORE · feed + decisões (TERMINAIS) ====== */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Brain className="size-3.5 text-emerald-400" />
            KNOWLEDGE CORE · ACTIVITY &amp; DECISIONS
          </h3>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {/* ===== LEFT TERMINAL · FEED AO VIVO ===== */}
            <div className="overflow-hidden rounded-lg border border-border bg-[#0a0e1a] font-mono">
              {/* title bar com 3 dots */}
              <div className="flex items-center gap-2 border-b border-border bg-[#0d1117] px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-[#ff5f56]" />
                  <span className="size-2.5 rounded-full bg-[#ffbd2e]" />
                  <span className="size-2.5 rounded-full bg-[#27c93f]" />
                </div>
                <div className="flex flex-1 items-center justify-center gap-1.5">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-400">
                    FEED AO VIVO
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {metrics.feed.length} EV
                </span>
              </div>
              {/* scroll area */}
              <div className="zcc-scroll max-h-72 overflow-y-auto p-3 text-[11px] leading-relaxed text-[#4ade80]">
                <div className="mb-1 text-[#64748b]">
                  $ tail -f /var/log/zcc/live-feed.log
                </div>
                {metrics.feed.map((event) => (
                  <TerminalFeedRow key={event.id} event={event} />
                ))}
                <div className="mt-1 flex items-center text-[#4ade80]">
                  <span className="text-[#64748b]">$</span>
                  <span className="zcc-terminal-cursor" aria-hidden />
                </div>
              </div>
            </div>

            {/* ===== RIGHT TERMINAL · DECISÕES RECENTES ===== */}
            <div className="overflow-hidden rounded-lg border border-border bg-[#0a0e1a] font-mono">
              {/* title bar com 3 dots */}
              <div className="flex items-center gap-2 border-b border-border bg-[#0d1117] px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-[#ff5f56]" />
                  <span className="size-2.5 rounded-full bg-[#ffbd2e]" />
                  <span className="size-2.5 rounded-full bg-[#27c93f]" />
                </div>
                <div className="flex flex-1 items-center justify-center gap-1.5">
                  <Brain className="size-3.5 text-primary" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                    DECISÕES RECENTES
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">BRAIN</span>
              </div>
              {/* scroll area */}
              <div className="zcc-scroll max-h-72 overflow-y-auto p-3 text-[11px] leading-relaxed text-slate-300">
                <div className="mb-1 text-[#64748b]">
                  $ cerebro --decisions --tail
                </div>
                {metrics.decisions.map((decision) => (
                  <TerminalDecisionRow key={decision.id} decision={decision} />
                ))}
                <button
                  type="button"
                  onClick={() => {
                    loadAll();
                    toast.success("Cérebro re-sincronizado");
                  }}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                >
                  $ Abrir Cérebro <ArrowRight className="size-3" />
                </button>
                <div className="mt-1 flex items-center text-primary">
                  <span className="text-[#64748b]">$</span>
                  <span className="zcc-terminal-cursor" aria-hidden />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTES
// ============================================================================

function PulseKpiCard({ kpi, index }: { kpi: PulseKPI; index: number }) {
  const accent = kpi.accent ?? "primary";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className="group relative overflow-hidden rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40"
    >
      <div className="flex items-start justify-between">
        <span
          className={cn(
            "grid size-7 place-items-center rounded-md border",
            ACCENT_COLOR[accent]
          )}
        >
          {kpi.icon}
        </span>
        {kpi.trend ? TREND_ICON[kpi.trend] : null}
      </div>
      <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        {kpi.label}
      </p>
      <p className="mt-0.5 text-xl font-bold text-foreground">{kpi.value}</p>
      {kpi.hint ? (
        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
          {kpi.trendValue ? (
            <span
              className={cn(
                "font-semibold",
                kpi.trend === "up"
                  ? "text-emerald-400"
                  : kpi.trend === "down"
                    ? "text-red-400"
                    : "text-muted-foreground"
              )}
            >
              {kpi.trendValue}
            </span>
          ) : null}
          {kpi.hint}
        </p>
      ) : null}
      <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-primary transition-all duration-500 group-hover:w-full" />
    </motion.div>
  );
}

function IntegrationCard({
  integration,
  index,
}: {
  integration: ConsoleIntegration;
  index: number;
}) {
  const isOnline = integration.status === "online";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className={cn(
        "rounded-lg border bg-card p-3 transition-colors",
        isOnline ? "border-emerald-500/30" : "border-amber-500/30"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "grid size-7 place-items-center rounded-md border",
              integration.isLLM
                ? "border-violet-500/30 bg-violet-500/10 text-violet-400"
                : "border-border bg-secondary text-muted-foreground"
            )}
          >
            {INTEGRATION_ICON[integration.category]}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">
              {integration.name}
            </p>
            <p className="truncate text-[10px] text-muted-foreground">
              {integration.category.toUpperCase()}
              {integration.isLLM ? " · LLM" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {isOnline ? (
            <Wifi className="size-3.5 text-emerald-400" />
          ) : (
            <WifiOff className="size-3.5 text-amber-400" />
          )}
          <span
            className={cn(
              "size-1.5 rounded-full",
              isOnline ? "bg-emerald-500" : "bg-amber-500"
            )}
          />
        </div>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">{integration.purpose}</p>
      <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
        <Zap className="size-3 text-amber-400" />
        <span className="font-mono text-foreground">{integration.latencyMs}ms</span>
        <span>·</span>
        <span className="capitalize">{integration.status}</span>
      </p>
    </motion.div>
  );
}

function AgentCard({ agent, index }: { agent: ConsoleAgent; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      className="rounded-lg border border-border bg-card p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{agent.emoji}</span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">
              {agent.name}
            </p>
            <p className="truncate text-[10px] text-muted-foreground">
              {agent.role}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "rounded border px-1.5 py-0.5 text-[8px] font-semibold uppercase",
            AGENT_STATUS_COLOR[agent.status]
          )}
        >
          {agent.status}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span
          className={cn(
            "rounded border px-1 py-0.5 text-[8px] font-semibold uppercase",
            DEPT_COLOR[agent.department] ?? "border-border bg-secondary text-muted-foreground"
          )}
        >
          {agent.department}
        </span>
        {agent.model ? (
          <span className="truncate font-mono text-[9px] text-muted-foreground">
            {agent.model}
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2 text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="size-2.5" />
          {relativeTime(agent.lastRun)}
        </span>
        <span className="flex items-center gap-0.5 font-mono font-semibold text-primary">
          <DollarSign className="size-2.5" />
          {agent.costUsd.toFixed(2)}
        </span>
      </div>
    </motion.div>
  );
}

// ============================================================================
// TERMINAL-STYLE ROWS (KNOWLEDGE CORE · macOS-style terminals)
// ============================================================================

const TERMINAL_TAG_COLOR: Record<FeedEntry["type"], string> = {
  info: "text-sky-400",
  ok: "text-emerald-400",
  warn: "text-amber-400",
  error: "text-red-400",
  decision: "text-primary",
};

const TERMINAL_TAG_LABEL: Record<FeedEntry["type"], string> = {
  info: "INFO",
  ok: "OK",
  warn: "WARN",
  error: "ERR",
  decision: "DECISION",
};

function formatTimeShort(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function TerminalFeedRow({ event }: { event: FeedEntry }) {
  return (
    <div className="py-0.5">
      <span className="text-[#64748b]">[{formatTimeShort(event.at)}]</span>{" "}
      <span className={cn("font-bold", TERMINAL_TAG_COLOR[event.type])}>
        [{TERMINAL_TAG_LABEL[event.type]}]
      </span>{" "}
      <span className="text-[#4ade80]">{event.message}</span>
      {event.detail ? (
        <div className="pl-4 text-[#94a3b8]">↳ {event.detail}</div>
      ) : null}
      <div className="pl-4 text-[#64748b]">
        agent: <span className="text-[#94a3b8]">{event.agent}</span>
        {event.confidence ? (
          <>
            {" · "}
            conf:{" "}
            <span
              className={cn(
                "font-bold",
                event.confidence >= 0.9
                  ? "text-emerald-400"
                  : event.confidence >= 0.75
                    ? "text-amber-400"
                    : "text-red-400"
              )}
            >
              {(event.confidence * 100).toFixed(0)}%
            </span>
          </>
        ) : null}
        {" · "}
        <span className="text-[#94a3b8]">{relativeTime(event.at)}</span>
      </div>
    </div>
  );
}

function TerminalDecisionRow({ decision }: { decision: DecisionEntry }) {
  const confidenceColor =
    decision.confidence >= 0.9
      ? "text-emerald-400"
      : decision.confidence >= 0.75
        ? "text-amber-400"
        : "text-red-400";

  const tagColor =
    decision.confidence >= 0.9
      ? "text-emerald-400"
      : decision.confidence >= 0.75
        ? "text-amber-400"
        : "text-sky-400";

  const tagLabel =
    decision.confidence >= 0.9 ? "OK" : decision.confidence >= 0.75 ? "WARN" : "INFO";

  return (
    <div className="py-0.5">
      <span className="text-[#64748b]">[{formatTimeShort(decision.at)}]</span>{" "}
      <span className={cn("font-bold", tagColor)}>[{tagLabel}]</span>{" "}
      <span className="text-primary">{decision.title}</span>
      <div className="pl-4 text-[#94a3b8]">↳ {decision.rationale}</div>
      <div className="pl-4 text-[#64748b]">
        agent: <span className="text-[#94a3b8]">{decision.agent}</span>
        {" · "}
        conf:{" "}
        <span className={cn("font-bold", confidenceColor)}>
          {(decision.confidence * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
