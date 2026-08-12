"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Activity, Zap, Timer, Cpu, ShieldCheck, Database,
  Lock, RefreshCw, Ghost, Heart, ChevronRight, TrendingUp,
  DollarSign, MessageSquare, Star, Headphones,
} from "lucide-react";
import { PanelHeader } from "../shared/panel-header";
import { cn } from "@/lib/utils";

/*
 * Cérebro Zélla — IA central com Thompson Sampling + Circuit Breakers.
 *
 * Baseado no CerebroZella.tsx real do projeto:
 *   - Providers com alpha/beta (Thompson Sampling)
 *   - Circuit Breakers (CLOSED/HALF_OPEN/OPEN)
 *   - Semantic Cache (hit rate, entries, TTL)
 *   - Budget Guard (USD spent today)
 *   - Learning metrics (patterns, anti-patterns, sentiment)
 *   - Feed de decisões em tempo real
 *
 * Hidrata via /api/brain (GET a cada 5s).
 * Em produção: substituir MOCK_BRAIN por fetch('/api/brain').
 */

interface ProviderData {
  id: string;
  name: string;
  tier: string;
  circuitState: "CLOSED" | "HALF_OPEN" | "OPEN";
  alpha: number;
  beta: number;
  estimatedSuccessRate: number;
  avgLatencyMs: number;
  totalRequests: number;
  costPer1kInput: number;
  costPer1kOutput: number;
}

interface BrainHealthResponse {
  status: string;
  service: string;
  version: string;
  engine: string;
  budget: {
    spentToday?: number;
    dailyLimit?: number;
  };
  cache: {
    hitRate: number;
    totalEntries: number;
    avgTtlMinutes: number;
  };
  circuitBreakers: Record<string, string>;
  providers: ProviderData[];
  learning?: {
    totalPatterns: number;
    verifiedPatterns: number;
    antiPatternsCount: number;
    learningVelocity: number;
    avgSentimentScore: number;
  };
}

interface FeedEntry {
  id: string;
  timestamp: string;
  type: "price" | "lead" | "payment" | "message" | "review" | "support";
  message: string;
}

// ── Mock brain data (em produção: fetch('/api/brain')) ──
const MOCK_BRAIN: BrainHealthResponse = {
  status: "ok",
  service: "ZaosNeuroRouter",
  version: "2.0.1",
  engine: "Thompson + Pareto + SemanticCache",
  budget: {
    spentToday: 2.47,
    dailyLimit: 10.00,
  },
  cache: {
    hitRate: 78.3,
    totalEntries: 247,
    avgTtlMinutes: 45.2,
  },
  circuitBreakers: {},
  providers: [
    { id: "glm-4.7-flash", name: "GLM-4.7-Flash", tier: "tier-1", circuitState: "CLOSED", alpha: 847, beta: 23, estimatedSuccessRate: 97.4, avgLatencyMs: 124, totalRequests: 870, costPer1kInput: 0.10, costPer1kOutput: 0.20 },
    { id: "glm-4.7", name: "GLM-4.7", tier: "tier-2", circuitState: "CLOSED", alpha: 412, beta: 18, estimatedSuccessRate: 95.8, avgLatencyMs: 342, totalRequests: 430, costPer1kInput: 0.50, costPer1kOutput: 1.00 },
    { id: "groq-llama-3-70b", name: "Groq Llama 3 70B", tier: "tier-1", circuitState: "CLOSED", alpha: 623, beta: 31, estimatedSuccessRate: 95.3, avgLatencyMs: 89, totalRequests: 654, costPer1kInput: 0.10, costPer1kOutput: 0.20 },
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", tier: "tier-1", circuitState: "CLOSED", alpha: 389, beta: 27, estimatedSuccessRate: 93.5, avgLatencyMs: 156, totalRequests: 416, costPer1kInput: 0.15, costPer1kOutput: 0.30 },
    { id: "deepseek-v3", name: "DeepSeek V3", tier: "tier-2", circuitState: "HALF_OPEN", alpha: 187, beta: 21, estimatedSuccessRate: 89.9, avgLatencyMs: 412, totalRequests: 208, costPer1kInput: 0.27, costPer1kOutput: 1.10 },
    { id: "openai-gpt-4o-mini", name: "OpenAI GPT-4o-mini", tier: "tier-1", circuitState: "CLOSED", alpha: 298, beta: 15, estimatedSuccessRate: 95.2, avgLatencyMs: 287, totalRequests: 313, costPer1kInput: 0.15, costPer1kOutput: 0.60 },
    { id: "claude-3.5-sonnet", name: "Claude 3.5 Sonnet", tier: "tier-3", circuitState: "CLOSED", alpha: 145, beta: 9, estimatedSuccessRate: 94.2, avgLatencyMs: 567, totalRequests: 154, costPer1kInput: 3.00, costPer1kOutput: 15.00 },
  ],
  learning: {
    totalPatterns: 1247,
    verifiedPatterns: 892,
    antiPatternsCount: 73,
    learningVelocity: 12,
    avgSentimentScore: 0.34,
  },
};

const FEED_MESSAGES: Omit<FeedEntry, "id" | "timestamp">[] = [
  { type: "lead", message: "Novo lead de Pousada Mar e Terra Búzios — score 96" },
  { type: "price", message: "Cérebro sugeriu +12% no preço para alta temporada" },
  { type: "message", message: "Concierge respondeu hóspede em 1.2s" },
  { type: "payment", message: "PIX confirmado — R$ 397 plano PRO" },
  { type: "lead", message: "Lead qualificado — Pousada Floripa Beira Mar (score 79)" },
  { type: "review", message: "Avaliação 5★ recebida — Pousada Refúgio da Praia" },
  { type: "support", message: "Guardian detectou tentativa de acesso — bloqueado" },
];

function formatTime(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function feedIcon(type: FeedEntry["type"]) {
  switch (type) {
    case "price": return <TrendingUp className="size-3.5 text-emerald-400" />;
    case "lead": return <Activity className="size-3.5 text-cyan-400" />;
    case "payment": return <DollarSign className="size-3.5 text-amber-400" />;
    case "message": return <MessageSquare className="size-3.5 text-violet-400" />;
    case "review": return <Star className="size-3.5 text-yellow-400" />;
    case "support": return <Headphones className="size-3.5 text-orange-400" />;
  }
}

function circuitColor(cb: string) {
  if (cb === "CLOSED") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (cb === "HALF_OPEN") return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  return "bg-red-500/20 text-red-400 border-red-500/30";
}

export function CerebroPanel() {
  const [brainData, setBrainData] = React.useState<BrainHealthResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [lastFetch, setLastFetch] = React.useState<Date | null>(null);

  const fetchBrainHealth = React.useCallback(async () => {
    // Em produção: const res = await fetch('/api/brain');
    // if (res.ok) { const data = await res.json(); setBrainData(data); }
    setTimeout(() => {
      setBrainData(MOCK_BRAIN);
      setLastFetch(new Date());
      setIsLoading(false);
    }, 300);
  }, []);

  React.useEffect(() => {
    fetchBrainHealth();
    const id = setInterval(fetchBrainHealth, 5000);
    return () => clearInterval(id);
  }, [fetchBrainHealth]);

  // ── Feed state ──
  const [feed, setFeed] = React.useState<FeedEntry[]>([]);

  const addFeedEntry = React.useCallback(() => {
    if (FEED_MESSAGES.length === 0) return;
    const msg = FEED_MESSAGES[Math.floor(Math.random() * FEED_MESSAGES.length)];
    const entry: FeedEntry = {
      id: `feed-${Date.now()}`,
      timestamp: formatTime(new Date()),
      type: msg.type,
      message: msg.message,
    };
    setFeed((prev) => {
      const next = [...prev, entry];
      return next.length > 40 ? next.slice(-40) : next;
    });
  }, []);

  React.useEffect(() => {
    const id = setInterval(addFeedEntry, 2500);
    return () => clearInterval(id);
  }, [addFeedEntry]);

  const providers = brainData?.providers ?? [];
  const cacheData = brainData?.cache;
  const cacheHitRate = cacheData?.hitRate ?? 0;
  const cacheEntries = cacheData?.totalEntries ?? 0;
  const cacheTtl = cacheData?.avgTtlMinutes ?? 0;
  const budgetData = brainData?.budget;

  const allClosed = providers.length > 0 && providers.every((p) => p.circuitState === "CLOSED");
  const status = isLoading ? "Carregando..." : allClosed ? "Ativo" : "Degradado";

  const totalRequests = providers.reduce((s, p) => s + (p.totalRequests || 0), 0);
  const avgLatency =
    providers.length > 0
      ? Math.round(providers.reduce((s, p) => s + (p.avgLatencyMs || 0), 0) / providers.length)
      : 0;

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader
        title="Cérebro Zélla"
        description="IA central · Thompson Sampling + Circuit Breakers + Semantic Cache"
        icon={<Brain className="size-5" />}
        actions={
          <>
            <span className="text-[10px] text-muted-foreground font-mono">
              {brainData?.service || "ZaosNeuroRouter"} · v{brainData?.version || "—"}
            </span>
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold",
              status === "Ativo"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-amber-500/30 bg-amber-500/10 text-amber-400"
            )}>
              <Cpu className="size-3" />
              {status}
            </span>
            <button
              onClick={fetchBrainHealth}
              className="grid size-7 place-items-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground"
              title="Atualizar"
            >
              <RefreshCw className={cn("size-3.5", isLoading && "animate-spin")} />
            </button>
          </>
        }
      />

      <div className="zcc-scroll flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {/* ── Thompson Sampling — Providers ── */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShieldCheck className="size-4 text-emerald-400" />
              Thompson Sampling — Routing Inteligente
            </h3>
            <span className="text-[10px] text-muted-foreground font-mono">
              dados reais a cada 5s
            </span>
          </div>
          {isLoading ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              Conectando ao cérebro...
            </div>
          ) : providers.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              Nenhum provider registrado. Verifique as API keys.
            </div>
          ) : (
            <div className="space-y-3">
              {providers.map((p, i) => {
                const successRate = Math.round((p.alpha / (p.alpha + p.beta)) * 10000) / 100;
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="flex items-center gap-3"
                  >
                    <span className="w-24 text-xs font-semibold text-foreground shrink-0 truncate">
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
                    <span className="text-[10px] text-muted-foreground font-mono w-20 text-right shrink-0 hidden sm:inline-block">
                      a {p.alpha.toFixed(1)} / b {p.beta.toFixed(1)}
                    </span>
                    <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-md border shrink-0", circuitColor(p.circuitState))}>
                      {p.circuitState}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Brain Metrics — 6 mini cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            {
              label: "Requests Hoje",
              value: totalRequests > 1000 ? `${(totalRequests / 1000).toFixed(1)}k` : String(totalRequests),
              icon: <Zap className="size-4 text-emerald-400" />,
              color: "text-emerald-400",
            },
            {
              label: "Latência Média",
              value: `${avgLatency}ms`,
              icon: <Timer className="size-4 text-cyan-400" />,
              color: "text-cyan-400",
            },
            {
              label: "Cache Hit Rate",
              value: `${cacheHitRate.toFixed(1)}%`,
              icon: <Cpu className="size-4 text-violet-400" />,
              color: "text-violet-400",
            },
            {
              label: "Padrões Aprendidos",
              value: String(brainData?.learning?.totalPatterns ?? 0),
              icon: <Brain className="size-4 text-emerald-400" />,
              color: "text-emerald-400",
              sub: `${brainData?.learning?.verifiedPatterns ?? 0} verificados`,
            },
            {
              label: "Anti-padrões",
              value: String(brainData?.learning?.antiPatternsCount ?? 0),
              icon: <Ghost className="size-4 text-red-400" />,
              color: "text-red-400",
              sub: "erros capturados",
            },
            {
              label: "Sentimento Médio",
              value: brainData?.learning?.avgSentimentScore
                ? `${brainData.learning.avgSentimentScore > 0 ? "+" : ""}${brainData.learning.avgSentimentScore.toFixed(2)}`
                : "—",
              icon: <Heart className="size-4 text-pink-400" />,
              color: brainData?.learning?.avgSentimentScore
                ? brainData.learning.avgSentimentScore > 0 ? "text-emerald-400" : "text-red-400"
                : "text-muted-foreground",
              sub: brainData?.learning?.learningVelocity
                ? `${brainData.learning.learningVelocity}/sem aprend.`
                : undefined,
            },
          ].map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.07 }}
              className="rounded-lg border border-border bg-card p-4 flex items-start gap-3"
            >
              <div className="mt-0.5">{m.icon}</div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{m.label}</div>
                <div className={cn("text-lg font-bold font-mono", m.color)}>{m.value}</div>
                {m.sub && <div className="text-[9px] text-muted-foreground mt-0.5">{m.sub}</div>}
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Feed + Motor Cognitivo ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Feed (3 cols) */}
          <div className="lg:col-span-3 rounded-lg border border-border bg-card p-5 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Activity className="size-4 text-emerald-400" />
                Feed de Decisões em Tempo Real
              </h3>
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
              </span>
            </div>
            <div className="flex-1 max-h-72 overflow-y-auto space-y-1 pr-1 zcc-scroll">
              <AnimatePresence initial={false}>
                {feed.length === 0 && (
                  <div className="text-center py-8">
                    <Activity className="size-5 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground font-mono">
                      Aguardando decisões...
                    </p>
                  </div>
                )}
                {feed.map((entry) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -16, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: "auto" }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: 0.35 }}
                    className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-secondary/30 transition-colors"
                  >
                    <span className="text-[10px] text-muted-foreground font-mono w-16 shrink-0">
                      {entry.timestamp}
                    </span>
                    <span className="shrink-0">{feedIcon(entry.type)}</span>
                    <span className="text-xs text-foreground truncate">{entry.message}</span>
                    <ChevronRight className="size-3 text-muted-foreground shrink-0 ml-auto" />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Motor Cognitivo (2 cols) */}
          <div className="lg:col-span-2 rounded-lg border border-border bg-card p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
              <Database className="size-4 text-emerald-400" />
              Motor Cognitivo
            </h3>
            <div className="space-y-3">
              {[
                { label: "Algoritmo", value: "Thompson Sampling + Pareto" },
                { label: "Circuit Breakers", value: `${providers.filter((p) => p.circuitState === "CLOSED").length}/${providers.length} CLOSED` },
                { label: "Semantic Cache", value: `${cacheHitRate.toFixed(1)}% hit · ${cacheEntries} entries` },
                { label: "Budget Guard", value: budgetData ? `US$ ${budgetData.spentToday?.toFixed(2) ?? "0.00"} hoje` : "NOMINAL" },
                { label: "Providers", value: `${providers.length} registrados (${[...new Set(providers.map((p) => p.tier))].length} tiers)` },
                { label: "Anti-padrões", value: `${brainData?.learning?.antiPatternsCount ?? 0} capturados` },
                { label: "Confidence Decay", value: "ativo (30d threshold)" },
                { label: "Adaptive RAG", value: "threshold auto-ajustável" },
                { label: "Engine", value: brainData?.engine?.split("+")[0]?.trim() ?? "—" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-1">
                  <span className="text-[11px] text-muted-foreground">{item.label}</span>
                  <span className="text-[11px] text-foreground font-mono">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Semantic Cache ── */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
            <Lock className="size-4 text-emerald-400" />
            Semantic Cache
          </h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { label: "Hit Rate", value: `${cacheHitRate.toFixed(1)}%`, color: "text-emerald-400" },
              { label: "Entries", value: String(cacheEntries), color: "text-cyan-400" },
              { label: "Avg TTL", value: cacheTtl > 0 ? `${cacheTtl.toFixed(1)}min` : "—", color: "text-violet-400" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-background p-3">
                <div className="text-[10px] text-muted-foreground mb-0.5">{s.label}</div>
                <div className={cn("text-base font-bold font-mono", s.color)}>{s.value}</div>
              </div>
            ))}
          </div>
          {cacheEntries > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-muted-foreground w-12 shrink-0">Capacidade</span>
              <div className="flex-1 h-2 bg-secondary/40 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                  animate={{ width: `${Math.min(100, (cacheEntries / 1000) * 100)}%` }}
                  transition={{ duration: 1.5, ease: "easeInOut" }}
                />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground w-10 text-right">
                {Math.min(100, Math.round((cacheEntries / 1000) * 100))}%
              </span>
            </div>
          )}
        </div>

        {/* ── Aviso ── */}
        <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3 text-xs text-violet-200/90">
          <strong className="font-semibold">🧠 Cérebro Zélla:</strong> IA central com Thompson
          Sampling que roteia para o melhor LLM. Circuit Breakers protegem contra falhas.
          Semantic Cache economiza tokens. Em produção, hidrata via{" "}
          <code className="rounded bg-background/60 px-1 py-0.5 font-mono">/api/brain</code>{" "}
          a cada 5s.
        </div>
      </div>
    </div>
  );
}
