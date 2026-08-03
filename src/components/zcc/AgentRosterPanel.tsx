'use client';

// =============================================================================
// AGENT ROSTER PANEL — Painel de agentes vivos dentro do ZCC
// =============================================================================
// Mostra os 12 agentes em grid. Cada card:
//   - Icon + nome + departamento
//   - Status (idle/active/error)
//   - Botão "Run" para executar
//   - Expande para mostrar últimos runs
//
// Conductor Chat no topo: input que roteia mensagem para o agente certo.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Command, DollarSign, ListChecks, MessageSquare, MapPin, Database, Code, Target, Smartphone, Home, UserPlus, Loader2, Send, Zap, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// ── Icon mapping ────────────────────────────────────────────────────────────

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
  command: 'Comando',
  comms: 'Comunicação',
  finance: 'Financeiro',
  operations: 'Operação',
  sales: 'Vendas',
  tech: 'Tech',
  marketing: 'Marketing',
};

const DEPT_COLOR: Record<string, string> = {
  command: 'border-purple-500/30 text-purple-400',
  comms: 'border-blue-500/30 text-blue-400',
  finance: 'border-emerald-500/30 text-emerald-400',
  operations: 'border-amber-500/30 text-amber-400',
  sales: 'border-pink-500/30 text-pink-400',
  tech: 'border-cyan-500/30 text-cyan-400',
  marketing: 'border-rose-500/30 text-rose-400',
};

// ── Types ───────────────────────────────────────────────────────────────────

interface AgentInfo {
  id: string;
  name: string;
  description: string;
  department: string;
  tier: string;
  defaultModel: string;
  icon: string;
  canRespond: boolean;
}

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

// ── Component ───────────────────────────────────────────────────────────────

export function AgentRosterPanel() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, RunResult>>({});
  const [error, setError] = useState<string | null>(null);

  // Conductor state
  const [conductorInput, setConductorInput] = useState('');
  const [conductorResult, setConductorResult] = useState<ConductorResult | null>(null);
  const [conductorLoading, setConductorLoading] = useState(false);

  // ── Fetch agents ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/zcc/agents')
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data?.agents) setAgents(json.data.agents);
      })
      .catch(() => { /* silent */ })
      .finally(() => setLoadingAgents(false));
  }, []);

  // ── Run agent ────────────────────────────────────────────────────────────
  const runAgent = useCallback(async (agentId: string) => {
    setRunningId(agentId);
    setError(null);
    try {
      const res = await fetch(`/api/zcc/agents/${agentId}/run`, { method: 'POST' });
      const json = await res.json();
      if (json.success && json.data?.run) {
        setResults(prev => ({ ...prev, [agentId]: json.data.run }));
      } else {
        setError(json.message ?? 'Falha ao executar agente.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro de rede');
    } finally {
      setRunningId(null);
    }
  }, []);

  // ── Conductor route ──────────────────────────────────────────────────────
  const sendToConductor = useCallback(async () => {
    const trimmed = conductorInput.trim();
    if (!trimmed || conductorLoading) return;
    setConductorLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/zcc/conductor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setConductorResult(json.data);
      } else {
        setError(json.message ?? 'Conductor falhou.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro de rede');
    } finally {
      setConductorLoading(false);
    }
  }, [conductorInput, conductorLoading]);

  return (
    <div className="space-y-6">
      {/* ── Conductor Chat ────────────────────────────────────────────── */}
      <Card className="bg-black/40 border-white/[0.06] overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-purple-600 to-indigo-600" />
        <div className="p-4 md:p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
              <Command className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Conductor Zélla</h3>
              <p className="text-xs text-white/50 mt-0.5">Fale com a equipe — a IA escolhe o melhor agente</p>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={conductorInput}
              onChange={e => setConductorInput(e.target.value.slice(0, 500))}
              onKeyDown={e => { if (e.key === 'Enter') sendToConductor(); }}
              placeholder="Ex: Como está o financeiro? ou @finance-agent analise o MRR"
              disabled={conductorLoading}
              className="flex-1 rounded-lg bg-white/[0.04] border border-white/[0.08] focus-within:border-purple-500/40 px-3 py-2 text-white text-sm placeholder:text-white/30 outline-none transition-colors"
            />
            <Button
              onClick={sendToConductor}
              disabled={!conductorInput.trim() || conductorLoading}
              className="h-10 w-10 p-0 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
            >
              {conductorLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>

          {/* Conductor result */}
          <AnimatePresence>
            {conductorResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-purple-500/20 text-purple-300 border-0 text-[10px]">
                    <Zap className="w-2.5 h-2.5 mr-1" />
                    Roteado para: {conductorResult.agentName}
                  </Badge>
                  <span className="text-[10px] text-white/40">
                    {conductorResult.model} · {conductorResult.durationMs}ms · {conductorResult.tokensIn + conductorResult.tokensOut} tokens
                  </span>
                </div>
                <div className="text-[13px] text-white/90 whitespace-pre-wrap leading-relaxed">
                  {conductorResult.text}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>

      {/* ── Error ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-[13px] text-red-300">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Agent Grid ────────────────────────────────────────────────── */}
      {loadingAgents ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {agents.map((agent) => {
            const Icon = ICONS[agent.icon] ?? Brain;
            const isRunning = runningId === agent.id;
            const result = results[agent.id];
            const deptColor = DEPT_COLOR[agent.department] ?? 'border-white/30 text-white/60';

            return (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="bg-black/40 border-white/[0.06] hover:border-white/[0.12] transition-colors h-full flex flex-col">
                  <div className="p-4 flex-1 flex flex-col gap-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg bg-white/[0.04] border ${deptColor} flex items-center justify-center`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-white truncate">{agent.name}</h4>
                          <span className="text-[10px] text-white/40 uppercase tracking-wider">
                            {DEPT_LABEL[agent.department] ?? agent.department} · {agent.tier}
                          </span>
                        </div>
                      </div>
                      {result && (
                        result.ok
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-[11px] text-white/50 leading-relaxed flex-1">
                      {agent.description}
                    </p>

                    {/* Result preview */}
                    {result && (
                      <div className="p-2 rounded-md bg-white/[0.03] border border-white/[0.06]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] text-white/40 uppercase tracking-wider">Última execução</span>
                          <span className="text-[9px] text-white/40 font-mono">
                            {result.durationMs ?? 0}ms · ${(result.costUsd ?? 0).toFixed(4)}
                          </span>
                        </div>
                        <p className="text-[11px] text-white/70 line-clamp-3 whitespace-pre-wrap">
                          {result.summary}
                        </p>
                      </div>
                    )}

                    {/* Run button */}
                    <Button
                      onClick={() => runAgent(agent.id)}
                      disabled={isRunning}
                      size="sm"
                      className="w-full h-8 bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/[0.08]"
                    >
                      {isRunning ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                          Executando...
                        </>
                      ) : (
                        <>
                          <Zap className="w-3 h-3 mr-1.5" />
                          Executar
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
