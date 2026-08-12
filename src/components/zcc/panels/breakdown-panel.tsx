"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  PieChart,
  DollarSign,
  Users,
  TrendingDown,
  Building2,
  Home,
  Handshake,
  Crown,
  Sparkles,
  Shield,
  RefreshCw,
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
} from "lucide-react";
import { PanelHeader } from "../shared/panel-header";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/*
 * FinancialBreakdownPanel — Decomposição financeira do ZCC.
 *
 * - KPIs: MRR total, ARPU, Churn rate, Active clients, Churned clients
 * - Plan breakdown (LITE R$197, PRO R$397, MAX R$797, PARCEIRO R$247)
 * - Niche comparison (Pousadas vs Airbnb vs Parceiro)
 * - Churn summary (rate, active, churned, MRR lost)
 *
 * Hidrata via fetch('/api/zcc/metrics/financial') com fallback mock.
 * Plan enum: LITE/PRO/MAX/PARCEIRO — sem trial (alinhado com Prisma).
 */

interface PlanBreakdown {
  plan: string;
  label: string;
  price: number;
  count: number;
  mrr: number;
  ratio: number; // % 0-100
  features: string[];
}

interface NicheBreakdown {
  niche: string;
  label: string;
  clients: number;
  mrr: number;
  ratio: number;
}

interface FinancialData {
  totalMRR: number;
  arpu: number;
  churnRate: number;
  totalClients: number;
  churnedClients: number;
  activeClients: number;
  mrrLost: number;
  planBreakdown: PlanBreakdown[];
  nicheBreakdown: NicheBreakdown[];
}

const FALLBACK_DATA: FinancialData = {
  totalMRR: 24 * 197 + 48 * 397 + 32 * 797 + 18 * 247,
  arpu: 485,
  churnRate: 2.1,
  totalClients: 122,
  activeClients: 119,
  churnedClients: 3,
  mrrLost: 1191,
  planBreakdown: [
    {
      plan: "LITE",
      label: "LITE",
      price: 197,
      count: 24,
      mrr: 24 * 197,
      ratio: 19.3,
      features: ["50 hóspedes", "500 mensagens", "IA limitada"],
    },
    {
      plan: "PRO",
      label: "PRO",
      price: 397,
      count: 48,
      mrr: 48 * 397,
      ratio: 78.4,
      features: ["Ilimitado", "OAuth Airbnb", "Dynamic pricing"],
    },
    {
      plan: "MAX",
      label: "MAX",
      price: 797,
      count: 32,
      mrr: 32 * 797,
      ratio: 104.4,
      features: ["Tudo de PRO", "Competitor monitoring", "Multi-property"],
    },
    {
      plan: "PARCEIRO",
      label: "PARCEIRO",
      price: 247,
      count: 18,
      mrr: 18 * 247,
      ratio: 18.3,
      features: ["PRO + tab Conquistas", "Referral gamification"],
    },
  ],
  nicheBreakdown: [
    {
      niche: "pousada",
      label: "Pousadas",
      clients: 64,
      mrr: 31280,
      ratio: 64.2,
    },
    {
      niche: "airbnb",
      label: "Airbnb",
      clients: 40,
      mrr: 13420,
      ratio: 27.6,
    },
    {
      niche: "parceiro",
      label: "Parceiros",
      clients: 18,
      mrr: 4446,
      ratio: 9.1,
    },
  ],
};

const PLAN_META: Record<
  string,
  { icon: React.ReactNode; accent: string; bar: string }
> = {
  LITE: {
    icon: <Sparkles className="size-4" />,
    accent: "text-sky-400 border-sky-500/30 bg-sky-500/10",
    bar: "bg-sky-400",
  },
  PRO: {
    icon: <Shield className="size-4" />,
    accent: "text-teal-400 border-teal-500/30 bg-teal-500/10",
    bar: "bg-teal-400",
  },
  MAX: {
    icon: <Crown className="size-4" />,
    accent: "text-primary border-primary/30 bg-primary/10",
    bar: "bg-primary",
  },
  PARCEIRO: {
    icon: <Handshake className="size-4" />,
    accent: "text-rose-400 border-rose-500/30 bg-rose-500/10",
    bar: "bg-rose-400",
  },
};

const NICHE_META: Record<
  string,
  { icon: React.ReactNode; accent: string; bar: string }
> = {
  pousada: {
    icon: <Building2 className="size-4" />,
    accent: "text-primary border-primary/30 bg-primary/10",
    bar: "bg-primary",
  },
  airbnb: {
    icon: <Home className="size-4" />,
    accent: "text-teal-400 border-teal-500/30 bg-teal-500/10",
    bar: "bg-teal-400",
  },
  parceiro: {
    icon: <Handshake className="size-4" />,
    accent: "text-rose-400 border-rose-500/30 bg-rose-500/10",
    bar: "bg-rose-400",
  },
};

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function FinancialBreakdownPanel() {
  const [data, setData] = React.useState<FinancialData>(FALLBACK_DATA);
  const [loading, setLoading] = React.useState(false);
  const [usingFallback, setUsingFallback] = React.useState(true);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/zcc/metrics/financial");
      if (!res.ok) throw new Error("API error");
      const json = await res.json();
      if (json?.success && json?.data) {
        const d = json.data;
        // adapt API -> local shape
        const planBreakdown: PlanBreakdown[] = (d.planBreakdown ?? []).map(
          (p: {
            plan: string;
            label: string;
            price: number;
            count: number;
            mrr: number;
            ratio: string;
            features: string[];
          }) => ({
            plan: p.plan,
            label: p.label,
            price: p.price,
            count: p.count,
            mrr: p.mrr,
            ratio: parseFloat(String(p.ratio)) || 0,
            features: p.features ?? [],
          })
        );
        const totalClients = d.totalClients ?? planBreakdown.reduce((s, p) => s + p.count, 0);
        const churned = Math.round((totalClients * (d.churnRate ?? 2.1)) / 100);
        setData({
          totalMRR: d.totalMRR ?? FALLBACK_DATA.totalMRR,
          arpu: d.arpu ?? FALLBACK_DATA.arpu,
          churnRate: d.churnRate ?? FALLBACK_DATA.churnRate,
          totalClients,
          activeClients: totalClients - churned,
          churnedClients: churned,
          mrrLost: churned * (d.arpu ?? FALLBACK_DATA.arpu),
          planBreakdown: planBreakdown.length ? planBreakdown : FALLBACK_DATA.planBreakdown,
          nicheBreakdown: FALLBACK_DATA.nicheBreakdown,
        });
        setUsingFallback(false);
      }
    } catch {
      // keep fallback
      setUsingFallback(true);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    loadData();
    toast.success("Breakdown financeiro recalculado", {
      description: usingFallback ? "usando fallback local" : "dados hidratados da API",
    });
  };

  const maxPlanMrr = Math.max(...data.planBreakdown.map((p) => p.mrr));
  const maxNicheMrr = Math.max(...data.nicheBreakdown.map((n) => n.mrr));

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader
        title="Financial Breakdown"
        description="Decomposição de receita · planos, nichos e churn"
        icon={<PieChart className="size-5" />}
        actions={
          <div className="flex items-center gap-2">
            {usingFallback ? (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                fallback
              </span>
            ) : null}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
              Atualizar
            </button>
          </div>
        }
      />

      <div className="zcc-scroll flex-1 overflow-y-auto p-4 sm:p-6">
        {/* ====== KPIs ====== */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5"
        >
          <KpiCard
            icon={<DollarSign className="size-4" />}
            label="MRR total"
            value={fmtBRL(data.totalMRR)}
            trend="up"
            trendValue="+8.4%"
            highlight
          />
          <KpiCard
            icon={<Users className="size-4" />}
            label="ARPU"
            value={fmtBRL(data.arpu)}
            trend="up"
            trendValue="+R$12"
          />
          <KpiCard
            icon={<TrendingDown className="size-4" />}
            label="Churn rate"
            value={`${data.churnRate.toFixed(1)}%`}
            trend="down"
            trendValue="-0.3pp"
            danger
          />
          <KpiCard
            icon={<Users className="size-4" />}
            label="Active clients"
            value={String(data.activeClients)}
            trend="up"
            trendValue="+4"
          />
          <KpiCard
            icon={<ArrowDownRight className="size-4" />}
            label="Churned"
            value={String(data.churnedClients)}
            trend="down"
            trendValue="-1"
          />
        </motion.div>

        {/* ====== PLAN BREAKDOWN ====== */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="mb-6"
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Crown className="size-3.5 text-primary" />
              Plan breakdown · 4 planos pagos
            </h3>
            <span className="text-[10px] text-muted-foreground">
              sem trial · alinhado com Prisma
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.planBreakdown.map((plan, idx) => {
              const meta = PLAN_META[plan.plan] ?? PLAN_META.LITE;
              return (
                <motion.div
                  key={plan.plan}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                  className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "grid size-8 place-items-center rounded-md border",
                        meta.accent
                      )}
                    >
                      {meta.icon}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {plan.ratio.toFixed(1)}%
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-foreground">
                    {plan.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {fmtBRL(plan.price)}/mês
                  </p>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] uppercase text-muted-foreground">
                        assinantes
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {plan.count}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] uppercase text-muted-foreground">
                        MRR
                      </span>
                      <span className="text-sm font-semibold text-primary">
                        {fmtBRL(plan.mrr)}
                      </span>
                    </div>
                  </div>
                  {/* Barra */}
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <motion.div
                      className={cn("h-full", meta.bar)}
                      initial={{ width: 0 }}
                      animate={{ width: `${(plan.mrr / maxPlanMrr) * 100}%` }}
                      transition={{ duration: 0.6, delay: idx * 0.05 + 0.2 }}
                    />
                  </div>
                  {/* Features */}
                  <ul className="mt-3 space-y-1">
                    {plan.features.slice(0, 2).map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-1 text-[10px] text-muted-foreground"
                      >
                        <span className="mt-0.5 size-1 shrink-0 rounded-full bg-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* ====== NICHE COMPARISON ====== */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="mb-6"
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Building2 className="size-3.5 text-primary" />
              Niche comparison · Pousadas vs Airbnb vs Parceiro
            </h3>
            <span className="text-[10px] text-muted-foreground">
              {data.nicheBreakdown.reduce((s, n) => s + n.clients, 0)} clientes
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {data.nicheBreakdown.map((niche, idx) => {
              const meta = NICHE_META[niche.niche] ?? NICHE_META.pousada;
              return (
                <motion.div
                  key={niche.niche}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "grid size-8 place-items-center rounded-md border",
                        meta.accent
                      )}
                    >
                      {meta.icon}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {niche.ratio.toFixed(1)}%
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-foreground">
                    {niche.label}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">
                        clientes
                      </p>
                      <p className="text-base font-semibold text-foreground">
                        {niche.clients}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">
                        MRR
                      </p>
                      <p className="text-base font-semibold text-primary">
                        {fmtBRL(niche.mrr)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <motion.div
                      className={cn("h-full", meta.bar)}
                      initial={{ width: 0 }}
                      animate={{ width: `${(niche.mrr / maxNicheMrr) * 100}%` }}
                      transition={{ duration: 0.6, delay: idx * 0.05 + 0.2 }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* ====== CHURN SUMMARY ====== */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <AlertTriangle className="size-3.5 text-amber-400" />
              Churn summary · perdas & retenção
            </h3>
            <span className="text-[10px] text-muted-foreground">últimos 30 dias</span>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <ChurnCard
              label="Churn rate"
              value={`${data.churnRate.toFixed(1)}%`}
              sub="meta < 3%"
              tone={data.churnRate < 3 ? "ok" : "warn"}
            />
            <ChurnCard
              label="Active"
              value={String(data.activeClients)}
              sub="assinaturas ativas"
              tone="ok"
            />
            <ChurnCard
              label="Churned"
              value={String(data.churnedClients)}
              sub="cancelamentos"
              tone="danger"
            />
            <ChurnCard
              label="MRR lost"
              value={fmtBRL(data.mrrLost)}
              sub="receita perdida"
              tone="danger"
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTES
// ============================================================================

function KpiCard({
  icon,
  label,
  value,
  trend,
  trendValue,
  highlight,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend?: "up" | "down";
  trendValue?: string;
  highlight?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-card p-3 transition-colors",
        highlight
          ? "border-primary/40 bg-primary/5"
          : danger
            ? "border-red-500/30"
            : "border-border hover:border-primary/30"
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "grid size-7 place-items-center rounded-md border",
            highlight
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-border bg-secondary text-muted-foreground"
          )}
        >
          {icon}
        </span>
        {trend && trendValue ? (
          <span
            className={cn(
              "flex items-center gap-0.5 text-[10px] font-semibold",
              trend === "up" ? "text-emerald-400" : "text-red-400"
            )}
          >
            {trend === "up" ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {trendValue}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-lg font-bold",
          highlight ? "text-primary" : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ChurnCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "ok" | "warn" | "danger";
}) {
  const toneCls = {
    ok: "border-emerald-500/30 bg-emerald-500/5 text-emerald-400",
    warn: "border-amber-500/30 bg-amber-500/5 text-amber-400",
    danger: "border-red-500/30 bg-red-500/5 text-red-400",
  }[tone];
  return (
    <div className={cn("rounded-lg border p-3", toneCls)}>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      <p className="mt-0.5 text-[10px] opacity-70">{sub}</p>
    </div>
  );
}
