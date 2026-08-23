// @ts-nocheck — ZCC visual panel, types fixed in dedicated refactoring pass
"use client";

import * as React from "react";
import {
  LayoutDashboard,
  Activity,
  Wifi,
  WifiOff,
  Brain,
  ArrowRight,
  RefreshCw,
  Cpu,
  Zap,
  Database,
  MessageSquare,
  CreditCard,
  Home as HomeIcon,
  Sparkles,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
} from "lucide-react";
import { PanelHeader } from "../shared/panel-header";
import { NavigationHub } from "../navigation-hub";
import {
  operatorKPIs,
  integrations,
  agents,
  brainEvents,
  relativeTime,
} from "@/lib/zcc/mock-data";
import type { Agent, Integration, BrainEvent, EventType } from "@/lib/zcc/types";
import { cn } from "@/lib/utils";

const INTEGRATION_ICON: Record<Integration["category"], React.ReactNode> = {
  messaging: <MessageSquare className="size-4" />,
  booking: <HomeIcon className="size-4" />,
  payment: <CreditCard className="size-4" />,
  llm: <Cpu className="size-4" />,
  database: <Database className="size-4" />,
};

const EVENT_COLOR: Record<EventType, string> = {
  info: "text-slate-400 border-slate-700",
  ok: "text-emerald-400 border-emerald-700",
  warn: "text-amber-400 border-amber-700",
  error: "text-red-400 border-red-700",
  decision: "text-violet-400 border-violet-700",
};

const EVENT_LABEL: Record<EventType, string> = {
  info: "INFO", ok: "OK", warn: "WARN", error: "ERR", decision: "DECISION",
};

const TREND_ICON = {
  up: <TrendingUp className="size-3 text-emerald-400" />,
  down: <TrendingDown className="size-3 text-red-400" />,
  stable: <Minus className="size-3 text-muted-foreground" />,
};

export function OverviewPanel({
  onNavigateLiveLeads,
  onNavigateAgents,
  onNavigateCerebro,
}: {
  onNavigateLiveLeads?: () => void;
  onNavigateAgents?: () => void;
  onNavigateCerebro?: () => void;
}) {
  const [updatedAt, setUpdatedAt] = React.useState("");

  React.useEffect(() => {
    const update = () => {
      const d = new Date();
      setUpdatedAt(
        d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const onlineIntegrations = integrations.filter((i) => i.status === "online").length;
  const llmAgents = agents.filter((a) => a.llmProvider && a.llmProvider !== "none").length;
  const criticalEvents = brainEvents.filter((e) => e.type === "warn" || e.type === "error").length;

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader
        title="Visão Geral"
        description="Command Center · decisão executiva em tempo real"
        icon={<LayoutDashboard className="size-5" />}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              ATUALIZADO {updatedAt}
            </span>
            <button
              type="button"
              className="grid size-7 place-items-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground"
              title="Recarregar"
            >
              <RefreshCw className="size-3.5" />
            </button>
          </div>
        }
      />

      <div className="zcc-scroll flex-1 overflow-y-auto p-4 sm:p-6">
        {/* ====== PULSE · KPIs executivos com trend ====== */}
        <div className="mb-6">
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
            {operatorKPIs.map((kpi) => (
              <div
                key={kpi.label}
                className="group relative overflow-hidden rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40"
              >
                <div className="flex items-start justify-between">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {kpi.label}
                  </p>
                  {kpi.trend ? TREND_ICON[kpi.trend] : null}
                </div>
                <p className="mt-1 text-xl font-bold text-foreground">
                  {kpi.value}
                </p>
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
                {/* Barra de progresso decorativa */}
                <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-primary transition-all duration-500 group-hover:w-full" />
              </div>
            ))}
          </div>
        </div>

        {/* ====== ALERTAS PRIORITÁRIOS ====== */}
        {criticalEvents > 0 ? (
          <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-400" />
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                Alertas prioritários · {criticalEvents} pendentes
              </h3>
            </div>
            <div className="mt-2 space-y-1">
              {brainEvents
                .filter((e) => e.type === "warn" || e.type === "error")
                .map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-2 text-[11px] text-foreground"
                  >
                    <span className="text-amber-400">⚠</span>
                    <span className="flex-1">{event.message}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {relativeTime(event.at)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        ) : null}

        {/* ====== CONNECTIONS · 6 integrações live ====== */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Wifi className="size-3.5 text-emerald-400" />
              CONNECTIONS · LIVE INTEGRATIONS
            </h3>
            <span className="text-[11px] text-muted-foreground">
              <span className="font-bold text-emerald-400">{onlineIntegrations}</span>
              /{integrations.length} ONLINE
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {integrations.map((integration) => (
              <IntegrationCard key={integration.id} integration={integration} />
            ))}
          </div>
        </div>

        {/* ====== AGENTES VIVOS · 12 agentes ====== */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="size-3.5 text-emerald-400" />
              AGENTES VIVOS · {agents.length} AGENTS · {llmAgents} COM LLM
            </h3>
            {onNavigateAgents ? (
              <button
                type="button"
                onClick={onNavigateAgents}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:underline"
              >
                VER TODOS <ArrowRight className="size-3" />
              </button>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {agents.slice(0, 8).map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </div>

        {/* ====== KNOWLEDGE CORE · feed + decisões ====== */}
        <div className="mb-6">
          <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Brain className="size-3.5 text-emerald-400" />
            KNOWLEDGE CORE · ACTIVITY &amp; DECISIONS
          </h3>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
                    FEED AO VIVO
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {brainEvents.length} EVENTOS
                </span>
              </div>
              <div className="max-h-72 overflow-y-auto zcc-scroll">
                {brainEvents.map((event) => (
                  <BrainEventRow key={event.id} event={event} />
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-3 py-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
                  DECISÕES RECENTES
                </span>
                <span className="text-[10px] text-muted-foreground">BRAIN</span>
              </div>
              <div className="max-h-72 overflow-y-auto zcc-scroll">
                {brainEvents
                  .filter((e) => e.type === "ok" || e.type === "decision" || e.type === "warn")
                  .map((event) => (
                    <BrainEventRow key={event.id} event={event} showDetail />
                  ))}
                <div className="border-t border-border px-3 py-2 text-center">
                  {onNavigateCerebro ? (
                    <button
                      type="button"
                      onClick={onNavigateCerebro}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:underline"
                    >
                      Abrir Cérebro <ArrowRight className="size-3" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ====== NAVIGATION HUB · 7 painéis conectados ====== */}
        <div className="mb-6">
          <NavigationHub />
        </div>

        {/* ====== ATORES RÁPIDOS ====== */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <QuickActionCard
            title="Ver Live Leads"
            description="Pipeline em tempo real no mapa"
            icon={<ArrowRight className="size-4" />}
            onClick={onNavigateLiveLeads}
          />
          <QuickActionCard
            title="Configurar Tokens"
            description="6 integrações · 2 LLMs"
            icon={<ChevronRight className="size-4" />}
            onClick={() => (window.location.href = "/zcc")}
          />
          <QuickActionCard
            title="Ver Agentes"
            description="12 agentes · status em tempo real"
            icon={<ArrowRight className="size-4" />}
            onClick={onNavigateAgents}
          />
        </div>

        {/* ====== Aviso modo mock ====== */}
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200/90">
          <strong className="font-semibold">⚠️ Modo Mock:</strong> Todos os KPIs, agentes e
          integrações estão em estado idle. Para ativar execução real, configure tokens em{" "}
          <strong>Tokens &amp; IA</strong> e rode o primeiro INIT.
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTES
// ============================================================================

function IntegrationCard({ integration }: { integration: Integration }) {
  const isOnline = integration.status === "online";
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 transition-colors",
        isOnline ? "border-emerald-500/30" : "border-red-500/30"
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
            <WifiOff className="size-3.5 text-red-400" />
          )}
          <span
            className={cn(
              "size-1.5 rounded-full",
              isOnline ? "bg-emerald-500" : "bg-red-500"
            )}
          />
        </div>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">{integration.purpose}</p>
      {integration.latencyMs ? (
        <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
          <Zap className="size-3 text-amber-400" />
          <span className="font-mono text-foreground">
            {integration.latencyMs}ms
          </span>
          <span>·</span>
          <span>ping {integration.lastCheck ? relativeTime(integration.lastCheck) : "—"}</span>
        </p>
      ) : null}
    </div>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  const llmBadge = agent.llmProvider && agent.llmProvider !== "none" ? (
    <span className="rounded bg-violet-500/15 px-1 py-0.5 text-[8px] font-semibold uppercase text-violet-400">
      {agent.llmProvider === "openai" ? "GPT" : agent.llmProvider === "groq" ? "LLAMA" : "LLM"}
    </span>
  ) : (
    <span className="rounded bg-secondary px-1 py-0.5 text-[8px] font-semibold uppercase text-muted-foreground">
      sem LLM
    </span>
  );

  return (
    <div className="rounded-lg border border-border bg-card p-3">
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
            agent.status === "active"
              ? "border-emerald-700 bg-emerald-500/10 text-emerald-400"
              : agent.status === "thinking"
                ? "border-amber-700 bg-amber-500/10 text-amber-400"
                : agent.status === "error"
                  ? "border-red-700 bg-red-500/10 text-red-400"
                  : "border-slate-700 bg-secondary text-slate-400"
          )}
        >
          {agent.status}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        {llmBadge}
        {agent.llmModel ? (
          <span className="truncate font-mono text-[9px] text-muted-foreground">
            {agent.llmModel}
          </span>
        ) : null}
      </div>
      {agent.lastRun ? (
        <p className="mt-1.5 text-[9px] text-muted-foreground">
          último run: {relativeTime(agent.lastRun)}
        </p>
      ) : null}
    </div>
  );
}

function BrainEventRow({
  event,
  showDetail,
}: {
  event: BrainEvent;
  showDetail?: boolean;
}) {
  return (
    <div className="border-b border-border px-3 py-2 text-[11px] last:border-0">
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "mt-0.5 shrink-0 rounded border px-1 py-0.5 text-[8px] font-bold uppercase",
            EVENT_COLOR[event.type]
          )}
        >
          {EVENT_LABEL[event.type]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-foreground">{event.message}</p>
          {showDetail && event.detail ? (
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {event.detail}
            </p>
          ) : null}
          <div className="mt-0.5 flex items-center gap-2 text-[9px] text-muted-foreground">
            <span className="capitalize">{event.agent}</span>
            <span>·</span>
            <span>{relativeTime(event.at)}</span>
            {event.confidence ? (
              <>
                <span>·</span>
                <span>conf: {(event.confidence * 100).toFixed(0)}%</span>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickActionCard({
  title,
  description,
  icon,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-all hover:border-primary/40 hover:bg-primary/5"
    >
      <div className="grid size-9 place-items-center rounded-md border border-primary/30 bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
      <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </button>
  );
}
