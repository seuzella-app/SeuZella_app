"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Command, DollarSign, ListChecks, MessageSquare,
  MapPin, Database, Code, Target, Smartphone, Home, UserPlus,
  Loader2, Send, Zap, AlertCircle, CheckCircle2, XCircle,
  Play, Clock, Cpu, Activity,
} from "lucide-react";
import { PanelHeader } from "../shared/panel-header";
import { agents, relativeTime } from "@/lib/zcc/mock-data";
import type { Agent, AgentStatus } from "@/lib/zcc/types";
import { cn } from "@/lib/utils";

// Mapeamento de nomes de ícones para componentes
const ICONS: Record<string, React.ElementType> = {
  Command,
  MessageSquare,
  DollarSign,
  ListChecks,
  Target,
  MapPin,
  Database,
  Brain,
  Code,
  Smartphone,
  Home,
  UserPlus,
};

const DEPT_LABEL: Record<string, string> = {
  command: "Comando",
  comms: "Comunicação",
  finance: "Financeiro",
  operations: "Operação",
  sales: "Vendas",
  tech: "Tech",
  marketing: "Marketing",
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

const STATUS_COLOR: Record<AgentStatus, string> = {
  idle: "border-slate-700 bg-secondary text-slate-400",
  active: "border-emerald-700 bg-emerald-500/10 text-emerald-400",
  thinking: "border-amber-700 bg-amber-500/10 text-amber-400",
  error: "border-red-700 bg-red-500/10 text-red-400",
  offline: "border-zinc-700 bg-zinc-700/20 text-zinc-500",
};

interface RunResult {
  id: string;
  agentId: string;
  ok: boolean;
  summary: string;
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: number | null;
  durationMs: number | null;
  startedAt: string;
  finishedAt: string;
}

interface ConductorResult {
  routedTo: string;
  agentName: string;
  text: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
}

export function LiveAgentsPanel() {
  const [agentStates, setAgentStates] = React.useState<Record<string, AgentStatus>>({});
  const [runningId, setRunningId] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<Record<string, RunResult>>({});
  const [error, setError] = React.useState<string | null>(null);

  // Conductor state
  const [conductorInput, setConductorInput] = React.useState("");
  const [conductorResult, setConductorResult] = React.useState<ConductorResult | null>(null);
  const [conductorLoading, setConductorLoading] = React.useState(false);

  // ── Run agent (mock) ──
  const runAgent = React.useCallback(async (agentId: string) => {
    setRunningId(agentId);
    setAgentStates((prev) => ({ ...prev, [agentId]: "thinking" }));
    setError(null);

    // Mock de execução — em produção: POST /api/zcc/agents/[id]/run
    setTimeout(() => {
      const agent = agents.find((a) => a.id === agentId);
      const result: RunResult = {
        id: `run-${Date.now()}`,
        agentId,
        ok: true,
        summary: `${agent?.name} executou com sucesso. Em produção, isto chamaria /api/zcc/agents/${agentId}/run que roteia para o LLM (${agent?.defaultModel}).`,
        model: agent?.defaultModel ?? null,
        tokensIn: 247,
        tokensOut: 184,
        costUsd: 0.0023,
        durationMs: 1240,
        startedAt: new Date(Date.now() - 1240).toISOString(),
        finishedAt: new Date().toISOString(),
      };
      setResults((prev) => ({ ...prev, [agentId]: result }));
      setAgentStates((prev) => ({ ...prev, [agentId]: "active" }));
      setRunningId(null);
    }, 1200);
  }, []);

  // ── Conductor route (mock) ──
  const sendToConductor = React.useCallback(async () => {
    const trimmed = conductorInput.trim();
    if (!trimmed || conductorLoading) return;
    setConductorLoading(true);
    setError(null);

    // Mock de roteamento — em produção: POST /api/zcc/conductor
    setTimeout(() => {
      // Roteamento simples baseado em keywords
      const msg = trimmed.toLowerCase();
      let routedTo = "concierge";
      let agentName = "Zella Concierge";

      if (msg.includes("finance") || msg.includes("mrr") || msg.includes("custo") || msg.includes("receita")) {
        routedTo = "cfo"; agentName = "CFO Financeiro";
      } else if (msg.includes("lead") || msg.includes("venda") || msg.includes("convert")) {
        routedTo = "sales"; agentName = "Zélla Sales Brain";
      } else if (msg.includes("seguran") || msg.includes("ataque") || msg.includes("hack")) {
        routedTo = "selfdefense"; agentName = "Self-Defense Guard";
      } else if (msg.includes("whatsapp") || msg.includes("mensagem")) {
        routedTo = "meta-cloud"; agentName = "Meta Cloud API Gateway Agent";
      } else if (msg.includes("ocup") || msg.includes("quarto") || msg.includes("pousada")) {
        routedTo = "pousadabrain"; agentName = "Pousadas BI Agent";
      } else if (msg.includes("marketing") || msg.includes("campanha")) {
        routedTo = "marketing"; agentName = "Marketing Hotspots";
      }

      const result: ConductorResult = {
        routedTo,
        agentName,
        text: `[${agentName}] Processando: "${trimmed}"\n\nEm produção, o Conductor chamaria /api/zcc/conductor que roteia para o agente certo via LLM (glm-4.7-flash). O agente ${agentName} processaria a mensagem e retornaria uma resposta contextual.`,
        model: "glm-4.7-flash",
        tokensIn: 89,
        tokensOut: 156,
        durationMs: 890,
      };
      setConductorResult(result);
      setConductorLoading(false);
    }, 900);
  }, [conductorInput, conductorLoading]);

  const getStatus = (agentId: string): AgentStatus => agentStates[agentId] ?? "idle";

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader
        title="Agentes Vivos"
        description={`${agents.length} agentes · sistema multi-LLM com Conductor Router`}
        icon={<Brain className="size-5" />}
      />

      <div className="zcc-scroll flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* ── Guia Didático ── */}
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.03] p-4 space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <Brain className="size-4" />
            <span>O Que São os 12 Agentes Vivos e Por Que São Indispensáveis no ZCC</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Os <strong className="text-foreground">12 Agentes Vivos</strong> são microsserviços autônomos de IA rodando em background com modelos LLM dedicados. Eles monitoram e executam tarefas operacionais do Seu Zélla 24 horas por dia sem intervenção humana:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-[11px] text-muted-foreground">
            <div className="p-3 rounded-md border border-border bg-background/60">
              <strong className="text-emerald-400 block mb-1">⚡ Autodespacho & Conductor</strong>
              Roteia automaticamente cada mensagem recebida para o agente especialista (vendas, suporte, financeiro ou IoT).
            </div>
            <div className="p-3 rounded-md border border-border bg-background/60">
              <strong className="text-sky-400 block mb-1">🔒 Zelador IoT & Fechaduras</strong>
              Monitora a saúde das fechaduras (bateria, conectividade, geração de PINs) e revoga senhas em casos de emergência.
            </div>
            <div className="p-3 rounded-md border border-border bg-background/60">
              <strong className="text-amber-400 block mb-1">📈 CFO & Otimizador DSPy</strong>
              Garante zero estouro de cota nas APIs de LLM/WhatsApp e reajusta prompts dinamicamente para aumentar conversões.
            </div>
          </div>
        </div>

        {/* ── Conductor Chat ── */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-primary to-accent" />
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground">
                <Command className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Conductor Zélla</h3>
                <p className="text-[11px] text-muted-foreground">
                  Fale com a equipe — a IA escolhe o melhor agente
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={conductorInput}
                onChange={(e) => setConductorInput(e.target.value.slice(0, 500))}
                onKeyDown={(e) => { if (e.key === "Enter") sendToConductor(); }}
                placeholder="Ex: Como está o financeiro? ou @finance-agent analise o MRR"
                disabled={conductorLoading}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                onClick={sendToConductor}
                disabled={!conductorInput.trim() || conductorLoading}
                className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {conductorLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </button>
            </div>

            <AnimatePresence>
              {conductorResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-3 p-3 rounded-lg border border-border bg-secondary/30"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 rounded bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      <Zap className="size-2.5" />
                      Roteado para: {conductorResult.agentName}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {conductorResult.model} · {conductorResult.durationMs}ms ·{" "}
                      {conductorResult.tokensIn + conductorResult.tokensOut} tokens
                    </span>
                  </div>
                  <div className="text-[13px] text-foreground whitespace-pre-wrap leading-relaxed">
                    {conductorResult.text}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Error ── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 flex items-center gap-2"
            >
              <AlertCircle className="size-4 text-red-400 flex-shrink-0" />
              <span className="text-[13px] text-red-300">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Agent Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              status={getStatus(agent.id)}
              isRunning={runningId === agent.id}
              result={results[agent.id]}
              onRun={() => runAgent(agent.id)}
            />
          ))}
        </div>

        {/* ── Aviso ── */}
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200/90">
          <strong className="font-semibold">🤖 Sobre os Agentes Vivos:</strong> Cada agente
          usa um LLM diferente (Groq Llama 3, Gemini, DeepSeek, OpenAI GPT-4o, Claude 3.5,
          Zhipu GLM-4, Moonshot Kimi, Ollama). O Conductor roteia via Thompson Sampling.
          Em produção, configurar chaves em <strong>Tokens &amp; IA</strong>.
        </div>
      </div>
    </div>
  );
}

// ── Agent Card ──────────────────────────────────────────────────────────────

interface AgentCardProps {
  agent: Agent;
  status: AgentStatus;
  isRunning: boolean;
  result?: RunResult;
  onRun: () => void;
}

function AgentCard({ agent, status, isRunning, result, onRun }: AgentCardProps) {
  const Icon = ICONS[agent.icon] ?? Brain;
  const deptColor = DEPT_COLOR[agent.department] ?? "border-border text-muted-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className="rounded-lg border border-border bg-card h-full flex flex-col">
        <div className="p-4 flex-1 flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className={cn("grid size-8 place-items-center rounded-lg border bg-background", deptColor)}>
                <Icon className="size-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-foreground truncate">{agent.name}</h4>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {DEPT_LABEL[agent.department] ?? agent.department} · {agent.tier}
                </span>
              </div>
            </div>
            {result && (
              result.ok
                ? <CheckCircle2 className="size-4 text-emerald-400 flex-shrink-0" />
                : <XCircle className="size-4 text-red-400 flex-shrink-0" />
            )}
          </div>

          {/* Description */}
          <p className="text-[11px] text-muted-foreground leading-relaxed flex-1">
            {agent.description}
          </p>

          {/* LLM Badge */}
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 rounded bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-400">
              <Cpu className="size-2.5" />
              {agent.defaultModel}
            </span>
            <span className={cn("rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase", STATUS_COLOR[status])}>
              {status}
            </span>
          </div>

          {/* Last run */}
          {agent.lastRun ? (
            <p className="text-[9px] text-muted-foreground">
              <Clock className="mr-1 inline size-2.5" />
              último run: {relativeTime(agent.lastRun)}
            </p>
          ) : null}

          {/* Result preview */}
          {result && (
            <div className="p-2 rounded-md border border-border bg-secondary/30">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Última execução</span>
                <span className="text-[9px] text-muted-foreground font-mono">
                  {result.durationMs ?? 0}ms · ${(result.costUsd ?? 0).toFixed(4)}
                </span>
              </div>
              <p className="text-[11px] text-foreground/80 line-clamp-3 whitespace-pre-wrap">
                {result.summary}
              </p>
            </div>
          )}

          {/* Run button */}
          <button
            onClick={onRun}
            disabled={isRunning}
            className={cn(
              "w-full h-8 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5",
              isRunning
                ? "bg-secondary text-muted-foreground cursor-not-allowed"
                : "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"
            )}
          >
            {isRunning ? (
              <>
                <Loader2 className="size-3 animate-spin" />
                Executando...
              </>
            ) : (
              <>
                <Play className="size-3" />
                Executar
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
