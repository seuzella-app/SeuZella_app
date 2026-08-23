"use client";

/**
 * InferenceSimulationCard — Card de simulação de impacto financeiro
 * das 4 otimizações de Inferência (A/B/C/D) na aba Financeiro do ZCC.
 *
 * Mostra 3 cenários:
 *   1. Atual (Mock ZCC — 134 clientes)
 *   2. Temporada 26/27 (100 pousadas)
 *   3. Carnaval 2027 (140 pousadas)
 *
 * Para cada cenário:
 *   - Custo de IA ANTES vs DEPOIS (USD + BRL)
 *   - % de redução
 *   - Tokens economizados
 *   - Distribuição de tiers (80/15/5)
 *   - Custo por mensagem
 *   - Margem líquida ANTES vs DEPOIS
 */

import * as React from "react";
import { motion } from "framer-motion";
import {
  Zap, TrendingDown, DollarSign, Cpu, Brain, CheckCircle2,
  Loader2, AlertCircle, Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Scenario {
  name: string;
  clients: number;
  mrr: number;
  messages_30d: number;
  cost_before_usd: number;
  cost_before_brl: number;
  cost_after_usd: number;
  cost_after_brl: number;
  savings_usd: number;
  savings_brl: number;
  savings_percent: number;
  tokens_before: number;
  tokens_after: number;
  tokens_saved: number;
  tokens_saved_percent: number;
  tier1_msgs: number;
  tier2_msgs: number;
  tier3_msgs: number;
  tier1_pct: number;
  tier2_pct: number;
  tier3_pct: number;
  cost_per_msg_before: number;
  cost_per_msg_after: number;
  margin_before_brl: number;
  margin_after_brl: number;
  margin_improvement_brl: number;
}

export function InferenceSimulationCard() {
  const [scenarios, setScenarios] = React.useState<Scenario[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/zcc/inference-simulation", { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.scenarios) setScenarios(data.scenarios);
        else setError("Simulação não disponível");
      })
      .catch(() => setError("Falha ao carregar"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="border-primary/30">
        <CardContent className="p-4 flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Carregando simulação...</span>
        </CardContent>
      </Card>
    );
  }

  if (error || scenarios.length === 0) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          <span className="text-sm text-amber-700">{error ?? "Sem dados"}</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="size-4 text-primary" />
            Simulação: Impacto das 4 Otimizações de Inferência
            <Badge className="ml-auto bg-emerald-100 text-emerald-700 border-emerald-300">
              {scenarios[0]?.savings_percent.toFixed(0)}% redução
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          {/* 4 otimizações aplicadas */}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <OptBadge icon="A" label="Deferred Tools" desc="-50% tokens" />
            <OptBadge icon="B" label="Prompt Caching" desc="-80% reprocess" />
            <OptBadge icon="C" label="Output Cap" desc="≤250 tokens" />
            <OptBadge icon="D" label="Tier 80/15/5" desc="-73% custo" />
          </div>

          {/* Cenários */}
          {scenarios.map((s, i) => (
            <ScenarioBlock key={i} scenario={s} />
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function OptBadge({ icon, label, desc }: { icon: string; label: string; desc: string }) {
  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-center">
      <div className="flex items-center justify-center gap-1 mb-0.5">
        <span className="grid size-4 place-items-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
          {icon}
        </span>
        <span className="text-[10px] font-semibold">{label}</span>
      </div>
      <p className="text-[9px] text-muted-foreground">{desc}</p>
    </div>
  );
}

function ScenarioBlock({ scenario: s }: { scenario: Scenario }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold">{s.name}</h4>
        <Badge variant="outline" className="text-[9px]">
          {s.clients} clientes · {s.messages_30d.toLocaleString("pt-BR")} msgs/30d
        </Badge>
      </div>

      {/* Custo ANTES vs DEPOIS */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-2">
          <p className="text-[9px] uppercase text-muted-foreground">ANTES (sem otimizações)</p>
          <p className="text-sm font-bold text-rose-600">
            R$ {s.cost_before_brl.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[9px] text-muted-foreground">
            US$ {s.cost_before_usd.toFixed(2)} · {s.cost_per_msg_before.toFixed(4)}/msg
          </p>
        </div>
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2">
          <p className="text-[9px] uppercase text-muted-foreground">DEPOIS (4 otimizações)</p>
          <p className="text-sm font-bold text-emerald-600">
            R$ {s.cost_after_brl.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[9px] text-muted-foreground">
            US$ {s.cost_after_usd.toFixed(2)} · {s.cost_per_msg_after.toFixed(4)}/msg
          </p>
        </div>
      </div>

      {/* Economia */}
      <div className="flex items-center justify-between rounded-md bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 mb-2">
        <span className="text-[10px] uppercase tracking-wider text-emerald-700 flex items-center gap-1">
          <TrendingDown className="size-3" />
          Economia mensal
        </span>
        <span className="text-sm font-bold text-emerald-700">
          R$ {s.savings_brl.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          <span className="text-[10px] font-normal ml-1">({s.savings_percent.toFixed(1)}%)</span>
        </span>
      </div>

      {/* Tokens economizados */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        <MiniStat label="Tokens ANTES" value={formatTokens(s.tokens_before)} />
        <MiniStat label="Tokens DEPOIS" value={formatTokens(s.tokens_after)} />
        <MiniStat
          label="Tokens salvos"
          value={`${formatTokens(s.tokens_saved)} (${s.tokens_saved_percent.toFixed(0)}%)`}
          highlight
        />
      </div>

      {/* Distribuição tiers */}
      <div className="mb-2">
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">
          Distribuição de Tiers
        </p>
        <div className="flex h-5 rounded-md overflow-hidden">
          <div
            className="bg-blue-500 flex items-center justify-center text-white text-[9px] font-bold"
            style={{ width: `${s.tier1_pct}%` }}
            title={`Tier 1 (Flash): ${s.tier1_msgs.toLocaleString()} msgs`}
          >
            {s.tier1_pct.toFixed(0)}%
          </div>
          <div
            className="bg-amber-500 flex items-center justify-center text-white text-[9px] font-bold"
            style={{ width: `${s.tier2_pct}%` }}
            title={`Tier 2 (Full): ${s.tier2_msgs.toLocaleString()} msgs`}
          >
            {s.tier2_pct.toFixed(0)}%
          </div>
          <div
            className="bg-rose-500 flex items-center justify-center text-white text-[9px] font-bold"
            style={{ width: `${s.tier3_pct}%` }}
            title={`Tier 3 (Reasoning): ${s.tier3_msgs.toLocaleString()} msgs`}
          >
            {s.tier3_pct.toFixed(0)}%
          </div>
        </div>
        <div className="flex justify-between text-[8px] text-muted-foreground mt-0.5">
          <span>T1 Flash</span>
          <span>T2 Full</span>
          <span>T3 Reasoning</span>
        </div>
      </div>

      {/* Margem líquida */}
      <div className="flex items-center justify-between text-[11px] border-t border-border pt-2">
        <span className="text-muted-foreground">Margem líquida:</span>
        <div className="flex items-center gap-2">
          <span className="text-rose-500 line-through">
            R$ {s.margin_before_brl.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
          </span>
          <span className="text-emerald-600 font-bold">
            R$ {s.margin_after_brl.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
          </span>
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 text-[9px]">
            +R$ {s.margin_improvement_brl.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md border p-1.5 text-center ${highlight ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-card/40"}`}>
      <p className="text-[8px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-[11px] font-bold ${highlight ? "text-emerald-600" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
}

export default InferenceSimulationCard;
