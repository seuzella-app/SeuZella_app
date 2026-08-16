"use client";

import * as React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  DollarSign, TrendingUp, TrendingDown, ArrowUpRight,
  Building2, Home, Crown, Shield, Flame, Link2,
  ExternalLink, AlertCircle, RefreshCw, Download, Plus, X,
  Calendar, Mail, MessageCircle, PieChart,
} from "lucide-react";
import { PanelHeader } from "../shared/panel-header";
import { cn } from "@/lib/utils";
import { PLAN_PRICING } from "@/lib/zcc/types";
import type { Plan } from "@/lib/zcc/types";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { InferenceSimulationCard } from "./inference-simulation-card";

// Lazy-load ExpensesBreakdown (componente pesado com fetch próprio)
const ExpensesBreakdownLazy = dynamic(
  () => import("./expenses-breakdown").then((m) => m.ExpensesBreakdown),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid place-items-center py-8">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-2 text-[10px] text-muted-foreground">Carregando taxas e impostos...</p>
        </div>
      </div>
    ),
  }
);

/*
 * Financeiro Integrado v2 — alinhado com Prisma + custos editáveis.
 *
 * Plan enum: LITE (R$197), PRO (R$397), MAX (R$797), PARCEIRO (R$247) — sem trial.
 *
 * NOVIDADES v2:
 *   - Custos mensais editáveis (impostos, Google Ads, Claude Code, etc.)
 *   - Botão + para adicionar mais itens de custo
 *   - Botão X para remover itens de custo
 *   - Período: dia / semana / mês / meses / ano
 *   - Download CSV / envio por email / WhatsApp
 *   - Card de Churn (clientes perdidos / MRR perdido)
 */

interface PlanRow {
  plan: Plan;
  label: string;
  count: number;
  mrr: number;
  price: number;
  ratio: string;
  features: string[];
}

interface MonthForecast {
  month: string;
  value: number;
  positive: boolean;
}

interface BurnRow {
  tenant: string;
  niche: "pousada" | "airbnb";
  plan: string;
  whatsappCost: number;
  llmCost: number;
  total: number;
}

interface CustomCost {
  id: string;
  label: string;
  amount: number;
  category: "fixo" | "variavel" | "imposto" | "marketing" | "ferramenta" | "pessoal" | "outro";
  period: "mensal" | "anual";
}

type PeriodView = "dia" | "semana" | "mes" | "meses" | "ano";

const PLAN_ICONS: Record<Plan, React.ElementType> = {
  LITE: Building2, PRO: TrendingUp, MAX: Crown, PARCEIRO: Shield, LINK_IN_BIO: Link2,
};

const PLAN_COLORS: Record<Plan, string> = {
  LITE: "bg-sky-500", PRO: "bg-violet-500", MAX: "bg-amber-500", PARCEIRO: "bg-rose-500", LINK_IN_BIO: "bg-emerald-500",
};

const PLAN_BREAKDOWN: PlanRow[] = [
  { plan: "LITE", label: "LITE", count: 24, mrr: 4728, price: 197, ratio: "8.7%", features: ["50 hóspedes", "500 mensagens", "IA limitada"] },
  { plan: "PRO", label: "PRO", count: 48, mrr: 19056, price: 397, ratio: "35.1%", features: ["Ilimitado", "OAuth Airbnb", "Dynamic pricing"] },
  { plan: "MAX", label: "MAX", count: 32, mrr: 25504, price: 797, ratio: "47.0%", features: ["Tudo de PRO", "Competitor monitoring", "Multi-property"] },
  { plan: "PARCEIRO", label: "PARCEIRO", count: 18, mrr: 4446, price: 247, ratio: "8.2%", features: ["PRO + Conquistas", "Referral gamification"] },
  { plan: "LINK_IN_BIO", label: "Link-in-Bio", count: 12, mrr: 564, price: 47, ratio: "1.0%", features: ["Página personalizada", "Sem assistente IA", "Análise de cliques"] },
];

const TOTAL_MRR = PLAN_BREAKDOWN.reduce((s, p) => s + p.mrr, 0);
const TOTAL_CLIENTS = PLAN_BREAKDOWN.reduce((s, p) => s + p.count, 0);

const BURN_ROWS: BurnRow[] = [
  { tenant: "Pousada Maravilha", niche: "pousada", plan: "PRO", whatsappCost: 48.50, llmCost: 18.20, total: 66.70 },
  { tenant: "Villa Geribá Búzios", niche: "airbnb", plan: "MAX", whatsappCost: 32.10, llmCost: 12.40, total: 44.50 },
  { tenant: "Pousada Vila Floripa", niche: "pousada", plan: "PRO", whatsappCost: 29.80, llmCost: 9.60, total: 39.40 },
  { tenant: "Casa Trancoso BA", niche: "airbnb", plan: "MAX", whatsappCost: 41.20, llmCost: 15.80, total: 57.00 },
  { tenant: "Pousada Serenity Paraty", niche: "pousada", plan: "LITE", whatsappCost: 18.90, llmCost: 6.40, total: 25.30 },
  { tenant: "Studio Costa Verde", niche: "airbnb", plan: "PRO", whatsappCost: 35.60, llmCost: 11.20, total: 46.80 },
];

// Custos customizáveis padrão (editáveis + persistência em localStorage)
const DEFAULT_COSTS: CustomCost[] = [
  { id: "c1", label: "Impostos (Simples Nacional 6%)", amount: TOTAL_MRR * 0.06, category: "imposto", period: "mensal" },
  { id: "c2", label: "Google Ads", amount: 2000, category: "marketing", period: "mensal" },
  { id: "c3", label: "Claude Code (Anthropic)", amount: 500, category: "ferramenta", period: "mensal" },
  { id: "c4", label: "Vercel Pro", amount: 150, category: "ferramenta", period: "mensal" },
  { id: "c5", label: "Vercel Postgres", amount: 80, category: "ferramenta", period: "mensal" },
  { id: "c6", label: "WhatsApp Cloud API", amount: 320, category: "ferramenta", period: "mensal" },
  { id: "c7", label: "Domínio + DNS", amount: 30, category: "fixo", period: "mensal" },
  { id: "c8", label: "Equipe (1 dev + 1 marketing)", amount: 8000, category: "pessoal", period: "mensal" },
  // Cérebro Zélla — Z.ai API (GLM 5.2) — orçamento mensal fixo
  { id: "c9", label: "Z.ai API (GLM 5.2 — Cérebro)", amount: 20, category: "ferramenta", period: "mensal" },
  // Cérebro Noturno Ativo (3 cron jobs: pulsos + pentest + audit)
  // Detalhamento:
  //   - 48 pulsos/dia × 30 dias × $0.0003 (glm-4.7-flash se anomalia) = $0.43
  //   - 1 pentest diário × 30 dias × $0.015 (5k tokens) = $0.45
  //   - 1 night audit diário × 30 dias × $0.009 (3k tokens) = $0.27
  //   Total: ~$0.84/mês (dentro do budget $20 do Cérebro)
  { id: "c10", label: "Cérebro Noturno (pulsos + pentest + audit)", amount: 0.84, category: "ferramenta", period: "mensal" },
  // VPS Hostinger MVK4 (planejado — quando contratar)
  { id: "c11", label: "VPS Hostinger MVK4 (planejado)", amount: 0, category: "ferramenta", period: "mensal" },
];

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const PERIOD_MULTIPLIER: Record<PeriodView, number> = {
  dia: 1 / 30,
  semana: 7 / 30,
  mes: 1,
  meses: 3, // trimestre
  ano: 12,
};

const PERIOD_LABEL: Record<PeriodView, string> = {
  dia: "por dia", semana: "por semana", mes: "por mês", meses: "por trimestre", ano: "por ano",
};

// ─────────────────────────────────────────────────────────────────────────────
// RECEITA DE COMISSÕES UPSELL — 7% por quarto (creditada à seuzella.com)
// ─────────────────────────────────────────────────────────────────────────────
// Modelo de comissão Zélla:
//   - Valores NORMAIS das diárias: 0% taxa (você fica com 100%)
//   - Valores de UPSELL (serviços extras sugeridos pela IA Zélla): 7% por quarto
//
// Esta seção mostra o total acumulado no período (mês atual default),
// agregando todas as pousadas cadastradas. Os valores são buscados da
// API /api/ddc/upsell/metrics, com fallback mock quando Vercel serverless
// não tem DB conectado.
// ─────────────────────────────────────────────────────────────────────────────
function UpsellComissionRevenueCard({ period }: { period: PeriodView }) {
  const [metrics, setMetrics] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Busca métricas do mês atual
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        const res = await fetch(
          `/api/ddc/upsell/metrics?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
        );
        if (res.ok) {
          const json = await res.json();
          if (!cancelled && json.success) {
            setMetrics(json.data);
          }
        }
      } catch {
        // Fallback mock quando DB indisponível (Vercel serverless sem DB)
        if (!cancelled) {
          setMetrics({
            total_aceitos: 0,
            total_receita_extra: 0,
            total_comissao_zehla: 0,
            total_comissao_pendente: 0,
            total_comissao_paga: 0,
            por_tipo: [],
            media_por_reserva: 0,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [period]);

  // Projeção anual (12× o mês atual) — estimativa conservadora
  const projecaoAnual = (metrics?.total_comissao_zehla ?? 0) * 12;
  // Meta mensal estimada (R$ 5.000 de comissão Zélla/mês para escalar)
  const metaMensal = 5000;
  const progressoMeta = Math.min(100, ((metrics?.total_comissao_zehla ?? 0) / metaMensal) * 100);

  return (
    <section className="rounded-lg border border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-blue-500/5 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
          <DollarSign className="size-3.5" />
          Receita de Comissões UPSELL (7% por quarto) · {PERIOD_LABEL[period]}
        </h3>
        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-300">
          creditada à seuzella.com
        </span>
      </div>

      <p className="mb-4 text-[11px] text-muted-foreground">
        Modelo: <strong className="text-foreground">0% sobre diárias normais</strong> (você fica com
        100% das diárias) + <strong className="text-foreground">7% sobre UPSELL</strong> (serviços extras
        sugeridos pela IA Zélla — late checkout, café premium, massagem, etc.).
      </p>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md border border-border bg-background p-3">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">
            UPSELLs no mês
          </p>
          <p className="mt-1 text-xl font-bold text-foreground">
            {metrics?.total_aceitos ?? 0}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Aceitos por hóspedes
          </p>
        </div>
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
          <p className="text-[10px] font-semibold uppercase text-emerald-300/70">
            Receita extra pousadas
          </p>
          <p className="mt-1 text-xl font-bold text-emerald-300">
            {fmtBRL(metrics?.total_receita_extra ?? 0)}
          </p>
          <p className="mt-1 text-[10px] text-emerald-300/70">
            Gerada por UPSELLs
          </p>
        </div>
        <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3">
          <p className="text-[10px] font-semibold uppercase text-blue-300/70">
            Comissão Zélla (7%)
          </p>
          <p className="mt-1 text-xl font-bold text-blue-300">
            {fmtBRL(metrics?.total_comissao_zehla ?? 0)}
          </p>
          <p className="mt-1 text-[10px] text-blue-300/70">
            Creditada à seuzella.com
          </p>
        </div>
        <div className="rounded-md border-2 border-amber-500/40 bg-amber-500/5 p-3">
          <p className="text-[10px] font-semibold uppercase text-amber-300/70">
            Projeção anual
          </p>
          <p className="mt-1 text-xl font-bold text-amber-300">
            {fmtBRL(projecaoAnual)}
          </p>
          <p className="mt-1 text-[10px] text-amber-300/70">
            12× o mês atual
          </p>
        </div>
      </div>

      {/* Progresso da meta mensal */}
      <div className="mt-4 rounded-md border border-border bg-background p-3">
        <div className="mb-2 flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">Progresso da meta mensal</span>
          <span className="font-semibold text-foreground">
            {fmtBRL(metrics?.total_comissao_zehla ?? 0)} / {fmtBRL(metaMensal)}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all"
            style={{ width: `${progressoMeta}%` }}
          />
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          {progressoMeta >= 100
            ? "🎉 Meta mensal atingida! Parabéns."
            : `Faltam ${fmtBRL(Math.max(0, metaMensal - (metrics?.total_comissao_zehla ?? 0)))} para bater a meta de R$ ${metaMensal.toLocaleString("pt-BR")}/mês.`}
        </p>
      </div>

      {/* Detalhamento por status */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2">
          <p className="text-[9px] uppercase text-amber-300/70">Pendente</p>
          <p className="text-xs font-bold text-amber-300">
            {fmtBRL(metrics?.total_comissao_pendente ?? 0)}
          </p>
        </div>
        <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-2">
          <p className="text-[9px] uppercase text-emerald-300/70">Pago</p>
          <p className="text-xs font-bold text-emerald-300">
            {fmtBRL(metrics?.total_comissao_paga ?? 0)}
          </p>
        </div>
        <div className="rounded border border-border bg-background p-2">
          <p className="text-[9px] uppercase text-muted-foreground">Média/reserva</p>
          <p className="text-xs font-bold text-foreground">
            {fmtBRL(metrics?.media_por_reserva ?? 0)}
          </p>
        </div>
        <div className="rounded border border-border bg-background p-2">
          <p className="text-[9px] uppercase text-muted-foreground">Tipos ativos</p>
          <p className="text-xs font-bold text-foreground">
            {metrics?.por_tipo?.length ?? 0}/15
          </p>
        </div>
      </div>

      {/* Link para aba UPSELL */}
      <div className="mt-4 flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 p-3">
        <div className="flex items-center gap-2">
          <DollarSign className="size-4 text-primary" />
          <p className="text-[11px] text-muted-foreground">
            Ver detalhes completos (tabela, histórico, calculadora)
          </p>
        </div>
        <Link
          href="/zcc?tab=upsell"
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Abrir aba UPSELL
          <ArrowUpRight className="size-3" />
        </Link>
      </div>

      {loading ? (
        <p className="mt-3 text-[10px] text-muted-foreground">Carregando métricas...</p>
      ) : null}
    </section>
  );
}

export function FinanceiroPanel() {
  const [period, setPeriod] = React.useState<PeriodView>("mes");
  const [customCosts, setCustomCosts] = React.useState<CustomCost[]>(DEFAULT_COSTS);
  const [showAddCost, setShowAddCost] = React.useState(false);
  const [newCostLabel, setNewCostLabel] = React.useState("");
  const [newCostAmount, setNewCostAmount] = React.useState("");
  const [newCostCategory, setNewCostCategory] = React.useState<CustomCost["category"]>("outro");
  const [loading, setLoading] = React.useState(true);

  // Carregar custos do localStorage
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("zcc:custom-costs");
      if (stored) setCustomCosts(JSON.parse(stored));
    } catch { /* keep default */ }
    setLoading(false);
  }, []);

  // Persistir custos
  const saveCosts = (costs: CustomCost[]) => {
    setCustomCosts(costs);
    try { localStorage.setItem("zcc:custom-costs", JSON.stringify(costs)); } catch { /* ignore */ }
  };

  const addCost = () => {
    if (!newCostLabel.trim() || !newCostAmount) return;
    const cost: CustomCost = {
      id: `c${Date.now()}`,
      label: newCostLabel.trim(),
      amount: parseFloat(newCostAmount) || 0,
      category: newCostCategory,
      period: "mensal",
    };
    saveCosts([...customCosts, cost]);
    setNewCostLabel("");
    setNewCostAmount("");
    setShowAddCost(false);
    toast.success(`Custo "${cost.label}" adicionado`);
  };

  const removeCost = (id: string) => {
    saveCosts(customCosts.filter((c) => c.id !== id));
    toast.info("Custo removido");
  };

  const updateCost = (id: string, amount: number) => {
    saveCosts(customCosts.map((c) => (c.id === id ? { ...c, amount } : c)));
  };

  const mult = PERIOD_MULTIPLIER[period];

  const totalCustomCosts = customCosts.reduce((s, c) => s + c.amount, 0);
  const totalBurn = BURN_ROWS.reduce((s, b) => s + b.total, 0);
  const totalCosts = totalCustomCosts + totalBurn;
  const net = TOTAL_MRR - totalCosts;
  const margin = (net / TOTAL_MRR) * 100;

  // Churn metrics (mock alinhado com Prisma Subscription)
  const churnRate = 0.8; // % mensal
  const churnedClients = Math.round(TOTAL_CLIENTS * (churnRate / 100));
  const churnedMRR = TOTAL_MRR * (churnRate / 100);
  const avgLifetimeMonths = 1 / (churnRate / 100);
  const ltv = TOTAL_MRR / TOTAL_CLIENTS * avgLifetimeMonths;

  // Export CSV
  const exportCSV = () => {
    const rows = [
      ["Métrica", "Valor (" + PERIOD_LABEL[period] + ")"],
      ["MRR Total", fmtBRL(TOTAL_MRR * mult)],
      ["Custos API (WhatsApp + LLM)", fmtBRL(totalBurn * mult)],
      ...customCosts.map((c) => [`Custo: ${c.label}`, fmtBRL(c.amount * mult)]),
      ["Custos Totais", fmtBRL(totalCosts * mult)],
      ["Líquido", fmtBRL(net * mult)],
      ["Margem %", `${margin.toFixed(1)}%`],
      ["Clientes Ativos", String(TOTAL_CLIENTS)],
      ["ARPU", fmtBRL(TOTAL_MRR / TOTAL_CLIENTS)],
      ["Churn Rate", `${churnRate}%`],
      ["Clientes Perdidos (mês)", String(churnedClients)],
      ["MRR Perdido (mês)", fmtBRL(churnedMRR)],
      ["LTV médio", fmtBRL(ltv)],
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro-zcc-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado com sucesso");
  };

  const sendByEmail = () => {
    const subject = encodeURIComponent("Relatório Financeiro ZCC");
    const body = encodeURIComponent(
      `Relatório financeiro Seu Zélla — ${PERIOD_LABEL[period]}\n\n` +
      `MRR: ${fmtBRL(TOTAL_MRR * mult)}\n` +
      `Custos: ${fmtBRL(totalCosts * mult)}\n` +
      `Líquido: ${fmtBRL(net * mult)}\n` +
      `Margem: ${margin.toFixed(1)}%\n` +
      `Clientes: ${TOTAL_CLIENTS}\n` +
      `Churn: ${churnRate}%\n`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const sendByWhatsApp = () => {
    const msg = encodeURIComponent(
      `*Relatório Financeiro ZCC*\n${PERIOD_LABEL[period]}\n\n` +
      `*MRR:* ${fmtBRL(TOTAL_MRR * mult)}\n` +
      `*Custos:* ${fmtBRL(totalCosts * mult)}\n` +
      `*Líquido:* ${fmtBRL(net * mult)}\n` +
      `*Margem:* ${margin.toFixed(1)}%\n` +
      `*Clientes:* ${TOTAL_CLIENTS}\n` +
      `*Churn:* ${churnRate}%`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader
        title="Financeiro Integrado"
        description="Visão 360° · MRR · Custos editáveis · Churn · Projeção · DDC"
        icon={<DollarSign className="size-5" />}
        actions={
          <>
            {/* Seletor de período */}
            <div className="flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5">
              {(["dia", "semana", "mes", "meses", "ano"] as PeriodView[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "rounded px-2 py-0.5 text-[10px] font-medium capitalize transition-colors",
                    period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p === "meses" ? "trim." : p}
                </button>
              ))}
            </div>

            {/* Download / Export */}
            <button onClick={exportCSV} className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-foreground hover:bg-secondary" title="Exportar CSV">
              <Download className="size-3" />
            </button>
            <button onClick={sendByEmail} className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-foreground hover:bg-secondary" title="Enviar por e-mail">
              <Mail className="size-3" />
            </button>
            <button onClick={sendByWhatsApp} className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/20" title="Enviar por WhatsApp">
              <MessageCircle className="size-3" />
            </button>
          </>
        }
      />

      <div className="zcc-scroll flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* ── KPIs principais ── */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label={`MRR ${PERIOD_LABEL[period]}`} value={fmtBRL(TOTAL_MRR * mult)} hint="Receita recorrente" icon={<DollarSign />} tone="primary" trend="up" trendValue="+12% MoM" />
          <KpiCard label={`Custos ${PERIOD_LABEL[period]}`} value={fmtBRL(totalCosts * mult)} hint={`${customCosts.length + 1} itens`} icon={<Flame />} trend="up" trendValue="+R$ 200" />
          <KpiCard label={`Líquido ${PERIOD_LABEL[period]}`} value={fmtBRL(net * mult)} hint={`Margem ${margin.toFixed(1)}%`} icon={<TrendingUp />} tone={net >= 0 ? "primary" : "default"} trend={net >= 0 ? "up" : "down"} trendValue={margin.toFixed(1) + "%"} />
          <KpiCard label="ARPA" value={fmtBRL(TOTAL_MRR / TOTAL_CLIENTS)} hint="ticket médio / cliente" icon={<PieChart />} trend="stable" trendValue="—" />
        </div>

        {/* ── CARD DE CHURN ── */}
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-red-400">
              <TrendingDown className="size-4" />
              Churn · métricas de retenção
            </h3>
            <span className="text-[10px] text-muted-foreground">Prisma: Subscription WHERE status = &apos;canceled&apos;</span>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="rounded border border-border bg-background p-2 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Churn Rate</p>
              <p className="text-lg font-bold text-red-400">{churnRate}%</p>
              <p className="text-[9px] text-muted-foreground">mensal</p>
            </div>
            <div className="rounded border border-border bg-background p-2 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Perdidos/mês</p>
              <p className="text-lg font-bold text-red-400">{churnedClients}</p>
              <p className="text-[9px] text-muted-foreground">clientes</p>
            </div>
            <div className="rounded border border-border bg-background p-2 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">MRR perdido</p>
              <p className="text-lg font-bold text-red-400">{fmtBRL(churnedMRR)}</p>
              <p className="text-[9px] text-muted-foreground">mensal</p>
            </div>
            <div className="rounded border border-border bg-background p-2 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Lifetime</p>
              <p className="text-lg font-bold text-foreground">{avgLifetimeMonths.toFixed(0)}</p>
              <p className="text-[9px] text-muted-foreground">meses</p>
            </div>
            <div className="rounded border border-border bg-background p-2 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">LTV médio</p>
              <p className="text-lg font-bold text-emerald-400">{fmtBRL(ltv)}</p>
              <p className="text-[9px] text-muted-foreground">por cliente</p>
            </div>
          </div>
        </div>

        {/* ── FLUXO DE CAIXA ── */}
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Fluxo de caixa · {PERIOD_LABEL[period]}
          </h3>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="border-b border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Receitas (MRR)</span>
                <span className="text-lg font-bold text-emerald-400">{fmtBRL(TOTAL_MRR * mult)}</span>
              </div>
              <div className="h-2 bg-secondary/40 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: "100%" }} />
              </div>
            </div>
            <div className="border-b border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Custos API (WhatsApp + LLM)</span>
                <span className="text-lg font-bold text-red-400">−{fmtBRL(totalBurn * mult)}</span>
              </div>
              <div className="h-2 bg-secondary/40 rounded-full overflow-hidden">
                <div className="h-full bg-red-500" style={{ width: `${(totalBurn / Math.max(TOTAL_MRR, 1)) * 100}%` }} />
              </div>
            </div>
            <div className="border-b border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Custos operacionais ({customCosts.length} itens)</span>
                <span className="text-lg font-bold text-red-400">−{fmtBRL(totalCustomCosts * mult)}</span>
              </div>
              <div className="h-2 bg-secondary/40 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500" style={{ width: `${(totalCustomCosts / Math.max(TOTAL_MRR, 1)) * 100}%` }} />
              </div>
            </div>
            <div className="p-4 bg-primary/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-primary uppercase tracking-wider font-semibold">Líquido {PERIOD_LABEL[period]}</span>
                <span className={cn("text-2xl font-bold", net >= 0 ? "text-emerald-400" : "text-red-400")}>
                  {net >= 0 ? "+" : "−"}{fmtBRL(Math.abs(net * mult))}
                </span>
              </div>
              <div className="h-2 bg-secondary/40 rounded-full overflow-hidden">
                <div className={cn("h-full", net >= 0 ? "bg-primary" : "bg-red-500")} style={{ width: `${(Math.abs(net) / Math.max(TOTAL_MRR, 1)) * 100}%` }} />
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Margem: <span className={cn("font-bold", margin >= 30 ? "text-emerald-400" : margin >= 10 ? "text-amber-400" : "text-red-400")}>{margin.toFixed(1)}%</span>
              </p>
            </div>
          </div>
        </section>

        {/* ── MRR POR PLANO ── */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              MRR por plano · 4 planos pagos + Link-in-Bio (sem trial)
            </h3>
            <span className="text-[11px] text-muted-foreground">
              ARPU <span className="font-bold text-foreground">{fmtBRL(TOTAL_MRR / TOTAL_CLIENTS)}</span> · {TOTAL_CLIENTS} clientes
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {PLAN_BREAKDOWN.map((row) => {
              const Icon = PLAN_ICONS[row.plan];
              return (
                <div key={row.plan} className={cn("rounded-lg border p-3", PLAN_COLORS[row.plan] ? "border-border bg-card" : "")}>
                  <div className="flex items-center justify-between">
                    <Icon className={cn("size-4", `text-${PLAN_COLORS[row.plan].replace("bg-", "")}`)} />
                    <span className="text-[9px] font-bold uppercase text-muted-foreground">{row.ratio}</span>
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground">{fmtBRL(row.price)}/mês</p>
                  <p className="text-lg font-bold text-foreground">{row.count} <span className="text-[10px] font-normal text-muted-foreground">clientes</span></p>
                  <p className="text-sm font-bold text-emerald-400">{fmtBRL(row.mrr)}</p>
                  <p className="text-[9px] text-muted-foreground">MRR deste plano</p>
                  <ul className="mt-2 border-t border-border/50 pt-2 text-[9px] text-muted-foreground space-y-0.5">
                    {row.features.map((f) => <li key={f}>• {f}</li>)}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── SIMULAÇÃO DE IMPACTO DAS OTIMIZAÇÕES DE INFERÊNCIA ── */}
        <InferenceSimulationCard />

        {/* ── RECEITA DE COMISSÕES UPSELL (7% por quarto) ── */}
        <UpsellComissionRevenueCard period={period} />

        {/* ── CUSTOS EDITÁVEIS ── */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Flame className="size-3.5 text-orange-400" />
              Custos operacionais · {PERIOD_LABEL[period]} · editável
            </h3>
            <button
              type="button"
              onClick={() => setShowAddCost(!showAddCost)}
              className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/20"
            >
              <Plus className="size-3" />
              Adicionar custo
            </button>
          </div>

          {/* Form de adicionar custo */}
          {showAddCost ? (
            <div className="mb-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                <input
                  type="text"
                  value={newCostLabel}
                  onChange={(e) => setNewCostLabel(e.target.value)}
                  placeholder="Nome do custo (ex: Vercel Pro)"
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none sm:col-span-2"
                />
                <input
                  type="number"
                  value={newCostAmount}
                  onChange={(e) => setNewCostAmount(e.target.value)}
                  placeholder="R$ / mês"
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
                />
                <select
                  value={newCostCategory}
                  onChange={(e) => setNewCostCategory(e.target.value as CustomCost["category"])}
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:border-primary/50 focus:outline-none"
                >
                  <option value="fixo">Fixo</option>
                  <option value="variavel">Variável</option>
                  <option value="imposto">Imposto</option>
                  <option value="marketing">Marketing</option>
                  <option value="ferramenta">Ferramenta</option>
                  <option value="pessoal">Pessoal</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div className="mt-2 flex gap-2">
                <button onClick={addCost} className="rounded-md bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90">
                  Adicionar
                </button>
                <button onClick={() => setShowAddCost(false)} className="rounded-md border border-border bg-secondary px-3 py-1 text-[11px] text-foreground hover:bg-secondary/70">
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}

          {/* Lista de custos */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 border-b border-border bg-secondary/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Item</span>
              <span className="text-center w-20">Categoria</span>
              <span className="text-right w-24">Valor {PERIOD_LABEL[period]}</span>
              <span className="w-8 text-center">—</span>
            </div>
            {customCosts.map((c) => (
              <div key={c.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 border-b border-border px-4 py-2 last:border-0 items-center hover:bg-secondary/20">
                <span className="text-xs text-foreground truncate">{c.label}</span>
                <span className="text-center w-20">
                  <span className="rounded bg-secondary px-1 py-0.5 text-[9px] uppercase text-muted-foreground">{c.category}</span>
                </span>
                <span className="text-right w-24">
                  <input
                    type="number"
                    value={c.amount}
                    onChange={(e) => updateCost(c.id, parseFloat(e.target.value) || 0)}
                    className="w-full rounded border border-border bg-background px-1 py-0.5 text-right text-xs text-foreground focus:border-primary/50 focus:outline-none"
                  />
                </span>
                <button
                  onClick={() => removeCost(c.id)}
                  className="grid size-6 place-items-center rounded text-red-400 hover:bg-red-500/10"
                  title="Remover"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
            {/* Total */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-4 py-2 bg-primary/5 items-center">
              <span className="text-xs font-semibold text-foreground">Total de custos operacionais</span>
              <span className="w-20" />
              <span className="text-right w-24 text-sm font-bold text-red-400">−{fmtBRL(totalCustomCosts * mult)}</span>
              <span className="w-8" />
            </div>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Custos persistem em localStorage. Em produção, salvar via <code className="rounded bg-background/60 px-1 font-mono">/api/config/keys</code> ou tabela Prisma dedicada.
          </p>
        </section>

        {/* ── CUSTOS API POR TENANT ── */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Custos API · top tenants · {PERIOD_LABEL[period]}
            </h3>
            <span className="text-[11px] text-muted-foreground">
              Total: <span className="font-bold text-red-400">{fmtBRL(totalBurn * mult)}</span> · {BURN_ROWS.length} tenants
            </span>
          </div>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-4 gap-2 border-b border-border bg-secondary/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Tenant</span>
              <span className="text-center">Niche</span>
              <span className="text-right">WhatsApp</span>
              <span className="text-right">Total</span>
            </div>
            {BURN_ROWS.map((b, i) => (
              <div key={i} className="grid grid-cols-4 gap-2 border-b border-border px-4 py-2 last:border-0 hover:bg-secondary/20">
                <span className="text-xs font-medium text-foreground truncate">{b.tenant} <span className="text-[9px] text-muted-foreground">{b.plan}</span></span>
                <div className="text-center">
                  {b.niche === "pousada" ? <Building2 className="mx-auto size-3 text-sky-400" /> : <Home className="mx-auto size-3 text-rose-400" />}
                </div>
                <span className="text-right text-xs text-red-400">−{fmtBRL(b.whatsappCost * mult)}</span>
                <span className="text-right text-xs font-semibold text-red-400">−{fmtBRL(b.total * mult)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── PROJEÇÃO 6 MESES · DINÂMICA (tempo real) ── */}
        <CashflowProjection mrr={TOTAL_MRR} costs={totalCosts} />

        {/* ── TAXAS DE GATEWAY + IMPOSTOS PRAIA GRANDE ── */}
        <ExpensesBreakdownLazy />

        {/* ── INTEGRAÇÃO DDC ── */}
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Integração DDC · dashboards de clientes</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Link href="/ddc/pousada" className="group flex items-center justify-between rounded-lg border border-border bg-card p-3 hover:border-primary/40">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground"><Building2 className="size-3.5 text-sky-400" /> DDC Pousada</div>
                <div className="mt-1 text-[10px] text-muted-foreground">Dashboard do cliente pousada</div>
              </div>
              <ExternalLink className="size-3 text-muted-foreground group-hover:text-primary" />
            </Link>
            <Link href="/ddc/airbnb" className="group flex items-center justify-between rounded-lg border border-border bg-card p-3 hover:border-primary/40">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground"><Home className="size-3.5 text-rose-400" /> DDC Airbnb</div>
                <div className="mt-1 text-[10px] text-muted-foreground">Dashboard do anfitrião Airbnb</div>
              </div>
              <ExternalLink className="size-3 text-muted-foreground group-hover:text-primary" />
            </Link>
            <Link href="/ddc" className="group flex items-center justify-between rounded-lg border border-border bg-card p-3 hover:border-primary/40">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground"><ArrowUpRight className="size-3.5 text-primary" /> DDC Overview</div>
                <div className="mt-1 text-[10px] text-muted-foreground">Visão geral de todos os clientes</div>
              </div>
              <ExternalLink className="size-3 text-muted-foreground group-hover:text-primary" />
            </Link>
          </div>
        </section>

        {/* ── Aviso ── */}
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200/90">
          <strong className="font-semibold">⚠️ Alinhado com Prisma:</strong> 4 planos pagos (LITE/PRO/MAX/PARCEIRO), sem trial. Custos operacionais são editáveis e persistem em localStorage. Churn alinhado com <code className="rounded bg-background/60 px-1 py-0.5 font-mono">Subscription WHERE status=&apos;canceled&apos;</code>. Em produção, hidrata via <code className="rounded bg-background/60 px-1 py-0.5 font-mono">/api/zcc/metrics/financial</code> e <code className="rounded bg-background/60 px-1 py-0.5 font-mono">/api/zcc/burn-rate</code>.
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label, value, hint, icon, tone = "default", trend, trendValue,
}: {
  label: string; value: React.ReactNode; hint?: string; icon?: React.ReactNode;
  tone?: "default" | "primary"; trend?: "up" | "down" | "stable"; trendValue?: string;
}) {
  return (
    <div className={cn("rounded-lg border bg-card p-3", tone === "primary" ? "border-primary/30 bg-primary/5" : "border-border")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
        {icon ? <span className="text-muted-foreground [&_svg]:size-4">{icon}</span> : null}
      </div>
      <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p> : null}
      {trend && trendValue ? (
        <p className="mt-1 flex items-center gap-1 text-[10px]">
          {trend === "up" ? <ArrowUpRight className="size-3 text-emerald-400" /> : trend === "down" ? <TrendingDown className="size-3 text-red-400" /> : <span className="size-3 text-muted-foreground">→</span>}
          <span className={cn(trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-muted-foreground")}>{trendValue}</span>
        </p>
      ) : null}
    </div>
  );
}

// ============================================================================
// CASHFLOW PROJECTION · 6 meses dinâmicos (tempo real)
// ============================================================================
// Gera automaticamente os próximos 6 meses a partir do mês atual.
// Cada mês mostra:
//   - Nome do mês (ex: "DEZ 24", "JAN 25")
//   - Valor projetado (crescimento MoM aplicado)
//   - Trend visual (crescimento/declínio)
//   - Indicador de período Beta (até dados reais entrarem)
//
// Modo mock: aplica +10% MoM (crescimento simulado)
// Modo real: usará dados históricos do Prisma para calcular MoM real
// ============================================================================

function CashflowProjection({ mrr, costs }: { mrr: number; costs: number }) {
  const [now, setNow] = React.useState(new Date());

  // Atualiza a cada minuto (garante que mês atual sempre correto)
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  // Gera próximos 6 meses a partir do atual
  const months = React.useMemo(() => {
    const MONTH_NAMES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const result: Array<{
      label: string;
      year: number;
      monthIdx: number;
      isCurrent: boolean;
      projected: number;
      previous: number;
      growthPct: number;
      isDecline: boolean;
    }> = [];

    // Período Beta: os 3 primeiros meses são marcados como "Período Beta"
    // (janela de testes — dados mock; será zerado quando dados reais entrarem)
    const baseGrowthRate = 0.10; // 10% MoM (mock)
    let lastValue = mrr - costs; // líquido atual

    for (let i = 0; i < 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthIdx = date.getMonth();
      const year = date.getFullYear();
      const label = `${MONTH_NAMES[monthIdx]} ${String(year).slice(2)}`;
      const isCurrent = i === 0;

      // Aplica growth rate acumulado
      const projected = Math.round(mrr * Math.pow(1 + baseGrowthRate, i + 1) - costs * Math.pow(1.02, i));
      const previous = i === 0 ? mrr - costs : result[i - 1].projected;
      const growthPct = previous > 0
        ? Math.round(((projected - previous) / previous) * 1000) / 10
        : 0;
      const isDecline = growthPct < 0;

      result.push({
        label,
        year,
        monthIdx,
        isCurrent,
        projected,
        previous,
        growthPct,
        isDecline,
      });
    }

    return result;
  }, [mrr, costs, now]);

  // Estatísticas de tendência
  const avgGrowth = months.reduce((s, m) => s + m.growthPct, 0) / months.length;
  const totalGrowth = months.length > 0 ? months[months.length - 1].projected - months[0].previous : 0;
  const isOverallGrowth = avgGrowth > 0;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Calendar className={cn("size-3.5", isOverallGrowth ? "text-emerald-400" : "text-red-400")} />
          Cashflow · projeção 6 meses · tempo real
        </h3>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className={cn("size-1.5 rounded-full animate-pulse", isOverallGrowth ? "bg-emerald-500" : "bg-red-500")} />
            média: <span className={cn("font-bold", isOverallGrowth ? "text-emerald-400" : "text-red-400")}>
              {isOverallGrowth ? '+' : ''}{avgGrowth.toFixed(1)}% MoM
            </span>
          </span>
          <span className="hidden sm:inline">
            Δ total: <span className={cn("font-bold", totalGrowth >= 0 ? "text-emerald-400" : "text-red-400")}>
              {totalGrowth >= 0 ? '+' : ''}{fmtBRL(totalGrowth)}
            </span>
          </span>
          <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-400">
            β Beta
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {months.map((m, i) => (
          <motion.div
            key={`${m.label}-${i}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className={cn(
              "relative rounded-lg border p-3 text-center transition-colors",
              m.isCurrent
                ? "border-primary/40 bg-primary/5"
                : m.isDecline
                  ? "border-red-500/30 bg-red-500/5"
                  : "border-emerald-500/30 bg-emerald-500/5"
            )}
          >
            {/* Badge de mês atual */}
            {m.isCurrent ? (
              <span className="absolute -top-1 -right-1 grid size-3.5 place-items-center rounded-full bg-primary text-[7px] font-bold text-primary-foreground">
                ●
              </span>
            ) : null}

            <div className={cn(
              "text-[10px] font-bold uppercase",
              m.isCurrent ? "text-primary" : "text-muted-foreground"
            )}>
              {m.label}
            </div>

            <div className={cn(
              "mt-1 text-sm font-bold",
              m.isDecline ? "text-red-400" : "text-emerald-400"
            )}>
              {m.projected >= 0 ? "+" : ""}{fmtBRL(m.projected)}
            </div>

            {/* Trend indicator */}
            <div className="mt-1 flex items-center justify-center gap-0.5 text-[9px]">
              {m.growthPct > 0 ? (
                <ArrowUpRight className="size-2.5 text-emerald-400" />
              ) : m.growthPct < 0 ? (
                <TrendingDown className="size-2.5 text-red-400" />
              ) : (
                <span className="size-2.5 text-muted-foreground">→</span>
              )}
              <span className={cn(
                "font-semibold",
                m.growthPct > 0 ? "text-emerald-400" :
                m.growthPct < 0 ? "text-red-400" :
                "text-muted-foreground"
              )}>
                {m.growthPct > 0 ? '+' : ''}{m.growthPct}%
              </span>
            </div>

            {/* Indicador Período Beta (3 primeiros meses) */}
            {i < 3 ? (
              <div className="mt-1.5 text-[7px] uppercase tracking-wide text-amber-400/70">
                período β
              </div>
            ) : (
              <div className="mt-1.5 text-[7px] uppercase tracking-wide text-muted-foreground/50">
                projeção
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Info bar */}
      <div className="mt-2 flex items-center justify-between text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-primary animate-pulse" />
          <strong className="text-foreground">Mês atual:</strong> {months[0]?.label ?? '—'}
          {" · "}atualização automática a cada minuto
        </span>
        <span className="hidden sm:inline">
          Base: MRR {fmtBRL(mrr)} − Custos {fmtBRL(costs)} = Líquido {fmtBRL(mrr - costs)}
        </span>
        <span className="text-amber-400">
          ⚠ Período Beta: dados mock serão zerados ao inserir dados reais
        </span>
      </div>
    </section>
  );
}
