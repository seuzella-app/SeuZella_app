"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Flame, TrendingUp, TrendingDown, DollarSign, Cpu, MessageSquare, Database, Cloud, Server, Calendar } from "lucide-react";
import { PanelHeader } from "../shared/panel-header";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PLAN_PRICING } from "@/lib/zcc/types";

/*
 * BurnRatePanel — custos API + runway + projeção financeira.
 *
 * - Daily/monthly API cost breakdown: WhatsApp, LLM tokens, Vercel, Postgres
 * - Total daily burn: $2.47
 * - Total monthly burn: ~$74
 * - Runway (MRR vs burn)
 * - Cost per tenant (6 tenants com barras)
 * - Cost trend chart (12 meses, divs)
 */

interface CostItem {
  id: string;
  label: string;
  dailyUsd: number;
  monthlyUsd: number;
  detail: string;
  icon: React.ReactNode;
  accent: "primary" | "emerald" | "amber" | "rose" | "sky";
}

interface TenantCost {
  id: string;
  name: string;
  niche: "pousada" | "airbnb";
  monthlyUsd: number;
  share: number;
}

interface MonthTrend {
  month: string;
  cost: number;
}

// ---- mock data --------------------------------------------------------------

const COST_ITEMS: CostItem[] = [
  {
    id: "whatsapp",
    label: "WhatsApp Cloud API",
    dailyUsd: 1.18,
    monthlyUsd: 35.40,
    detail: "$0.0068/msg · ~174 msgs/dia",
    icon: <MessageSquare className="size-4" />,
    accent: "emerald",
  },
  {
    id: "llm",
    label: "LLM Tokens (GLM-4.7-flash)",
    dailyUsd: 0.82,
    monthlyUsd: 24.60,
    detail: "$0.10/$0.20 per 1M tokens · cache hit 47%",
    icon: <Cpu className="size-4" />,
    accent: "primary",
  },
  {
    id: "vercel",
    label: "Vercel Pro (hosting)",
    dailyUsd: 0.33,
    monthlyUsd: 10.00,
    detail: "Next.js 16 + edge functions",
    icon: <Cloud className="size-4" />,
    accent: "sky",
  },
  {
    id: "postgres",
    label: "Vercel Postgres",
    dailyUsd: 0.14,
    monthlyUsd: 4.00,
    detail: "Prisma ORM · 1GB storage usado",
    icon: <Database className="size-4" />,
    accent: "amber",
  },
];

const TOTAL_DAILY_BURN = COST_ITEMS.reduce((s, c) => s + c.dailyUsd, 0); // ~$2.47
const TOTAL_MONTHLY_BURN = COST_ITEMS.reduce((s, c) => s + c.monthlyUsd, 0); // ~$74

const TENANT_COSTS: TenantCost[] = [
  { id: "t1", name: "Pousada Maravilha", niche: "pousada", monthlyUsd: 18.20, share: 0 },
  { id: "t2", name: "Villa Geribá Búzios", niche: "airbnb", monthlyUsd: 15.40, share: 0 },
  { id: "t3", name: "Pousada Vila Floripa", niche: "pousada", monthlyUsd: 12.60, share: 0 },
  { id: "t4", name: "Casa Trancoso BA", niche: "airbnb", monthlyUsd: 14.80, share: 0 },
  { id: "t5", name: "Pousada Serenity Paraty", niche: "pousada", monthlyUsd: 6.40, share: 0 },
  { id: "t6", name: "Studio Costa Verde", niche: "airbnb", monthlyUsd: 11.20, share: 0 },
];

const maxTenantCost = Math.max(...TENANT_COSTS.map((t) => t.monthlyUsd));
TENANT_COSTS.forEach((t) => (t.share = (t.monthlyUsd / maxTenantCost) * 100));

const MONTH_TREND: MonthTrend[] = [
  { month: "Jan", cost: 58 },
  { month: "Fev", cost: 61 },
  { month: "Mar", cost: 64 },
  { month: "Abr", cost: 62 },
  { month: "Mai", cost: 67 },
  { month: "Jun", cost: 69 },
  { month: "Jul", cost: 71 },
  { month: "Ago", cost: 70 },
  { month: "Set", cost: 72 },
  { month: "Out", cost: 73 },
  { month: "Nov", cost: 74 },
  { month: "Dez", cost: TOTAL_MONTHLY_BURN },
];

const maxMonthCost = Math.max(...MONTH_TREND.map((m) => m.cost));

// MRR USD ≈ R$ 54k / 5 (cotação mock)
const MRR_USD = 10850;
const NET_MONTHLY = MRR_USD - TOTAL_MONTHLY_BURN;
const RUNWAY_MONTHS = MRR_USD > 0 ? Math.floor(50000 / NET_MONTHLY) : 0; // mock runway

// ---- helpers ----------------------------------------------------------------

const ACCENT_BORDER: Record<CostItem["accent"], string> = {
  primary: "border-primary/30 bg-primary/5 text-primary",
  emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-400",
  amber: "border-amber-500/30 bg-amber-500/5 text-amber-400",
  rose: "border-rose-500/30 bg-rose-500/5 text-rose-400",
  sky: "border-sky-500/30 bg-sky-500/5 text-sky-400",
};

const ACCENT_BAR: Record<CostItem["accent"], string> = {
  primary: "bg-primary",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  sky: "bg-sky-500",
};

function fmtUSD(v: number): string {
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtUSDShort(v: number): string {
  return `$${v.toFixed(2)}`;
}

// ---- component --------------------------------------------------------------

export function BurnRatePanel() {
  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader
        title="Burn Rate"
        description="Custos API em USD · runway · projeção 12 meses"
        icon={<Flame className="size-5" />}
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-400">
            <Flame className="size-3" />
            {fmtUSDShort(TOTAL_DAILY_BURN)}/dia
          </span>
        }
      />

      <div className="zcc-scroll flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* ===== KPIs PRINCIPAIS ===== */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <BurnKpi
            label="Burn diário"
            value={fmtUSD(TOTAL_DAILY_BURN)}
            hint="WhatsApp + LLM + Vercel + DB"
            icon={<Flame className="size-4" />}
            accent="amber"
            trend="down"
            trendValue="-3% vs ontem"
            index={0}
          />
          <BurnKpi
            label="Burn mensal"
            value={fmtUSD(TOTAL_MONTHLY_BURN)}
            hint="Projeção 30 dias"
            icon={<Calendar className="size-4" />}
            accent="rose"
            trend="up"
            trendValue="+5% MoM"
            index={1}
          />
          <BurnKpi
            label="MRR (USD)"
            value={fmtUSD(MRR_USD)}
            hint={`Líquido: ${fmtUSD(NET_MONTHLY)}`}
            icon={<TrendingUp className="size-4" />}
            accent="emerald"
            trend="up"
            trendValue="+8% MoM"
            index={2}
          />
          <BurnKpi
            label="Runway"
            value={`${RUNWAY_MONTHS} meses`}
            hint={`caixa $50k · burn ${fmtUSDShort(TOTAL_MONTHLY_BURN)}/mês`}
            icon={<DollarSign className="size-4" />}
            accent="primary"
            trend="stable"
            trendValue="—"
            index={3}
          />
        </div>

        {/* ===== COST BREAKDOWN ===== */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Server className="size-3.5 text-primary" />
              API COST BREAKDOWN · DAILY × MONTHLY
            </h3>
            <span className="text-[10px] text-muted-foreground">
              Total: <span className="font-bold text-foreground">{fmtUSD(TOTAL_MONTHLY_BURN)}/mês</span>
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {COST_ITEMS.map((item, idx) => (
              <CostItemCard key={item.id} item={item} index={idx} />
            ))}
          </div>
        </section>

        {/* ===== RUNWAY PROGRESS ===== */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="rounded-lg border border-border bg-card p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <DollarSign className="size-3.5 text-emerald-400" />
              RUNWAY · CAIXA vs BURN
            </h3>
            <button
              type="button"
              onClick={() => toast.info("Relatório de runway exportado")}
              className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
            >
              Ver detalhes
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Caixa disponível</span>
                <span className="font-mono font-bold text-emerald-400">$50,000.00</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary/40">
                <div className="h-full bg-emerald-500" style={{ width: "100%" }} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Burn acumulado (mês atual)</span>
                <span className="font-mono font-bold text-amber-400">{fmtUSD(TOTAL_MONTHLY_BURN)}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary/40">
                <div
                  className="h-full bg-amber-500"
                  style={{ width: `${(TOTAL_MONTHLY_BURN / 50000) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Líquido mensal (MRR − burn)</span>
                <span className="font-mono font-bold text-primary">{fmtUSD(NET_MONTHLY)}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary/40">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${(NET_MONTHLY / MRR_USD) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <p className="mt-3 text-[10px] text-muted-foreground">
            Margem:{" "}
            <span className="font-bold text-emerald-400">
              {((NET_MONTHLY / MRR_USD) * 100).toFixed(1)}%
            </span>{" "}
            · runway estimado: <span className="font-bold text-foreground">{RUNWAY_MONTHS} meses</span>
          </p>
        </motion.section>

        {/* ===== COST PER TENANT ===== */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Server className="size-3.5 text-primary" />
              CUSTO POR TENANT · TOP 6
            </h3>
            <span className="text-[10px] text-muted-foreground">
              Total: {fmtUSD(TENANT_COSTS.reduce((s, t) => s + t.monthlyUsd, 0))}/mês
            </span>
          </div>
          <div className="rounded-lg border border-border bg-card divide-y divide-border">
            {TENANT_COSTS.map((t, idx) => (
              <TenantCostRow key={t.id} tenant={t} index={idx} />
            ))}
          </div>
        </section>

        {/* ===== COST TREND CHART ===== */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <TrendingUp className="size-3.5 text-primary" />
              CUSTO 12 MESES · USD/mês
            </h3>
            <span className="text-[10px] text-muted-foreground">
              Pico: <span className="font-bold text-foreground">{fmtUSDShort(maxMonthCost)}</span> · Mín: <span className="font-bold text-foreground">{fmtUSDShort(Math.min(...MONTH_TREND.map((m) => m.cost)))}</span>
            </span>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex h-44 items-end justify-between gap-1.5">
              {MONTH_TREND.map((m, idx) => (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${(m.cost / maxMonthCost) * 100}%` }}
                    transition={{ duration: 0.4, delay: idx * 0.03 }}
                    className={cn(
                      "w-full rounded-t-sm",
                      idx === MONTH_TREND.length - 1 ? "bg-primary" : "bg-primary/40 hover:bg-primary/60"
                    )}
                    title={`${m.month}: ${fmtUSDShort(m.cost)}`}
                    style={{ minHeight: 4 }}
                  />
                  <span className="text-[9px] text-muted-foreground">{m.month}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-[10px] text-muted-foreground">
              <span>Média 12m: <span className="font-bold text-foreground">{fmtUSDShort(MONTH_TREND.reduce((s, m) => s + m.cost, 0) / 12)}</span></span>
              <span>Tendência: <span className="font-bold text-emerald-400">estável</span></span>
              <span>Variação YoY: <span className="font-bold text-amber-400">+27%</span></span>
            </div>
          </div>
        </section>

        {/* ===== RODAPÉ ===== */}
        <div className="rounded-lg border border-border bg-card p-3 text-[10px] text-muted-foreground">
          <p>
            <strong className="text-foreground">Custos alinhados com</strong>{" "}
            <code className="font-mono text-primary">CostLog</code> +{" "}
            <code className="font-mono text-primary">BudgetGuardState</code> (Prisma). Em produção, valores vêm do endpoint{" "}
            <code className="font-mono text-primary">/api/zcc/burn</code>. Planos ativos:{" "}
            <span className="font-bold text-foreground">{PLAN_PRICING.length}</span> (LITE, PRO, MAX, PARCEIRO).
          </p>
        </div>
      </div>
    </div>
  );
}

// ---- sub-components ---------------------------------------------------------

function BurnKpi({
  label,
  value,
  hint,
  icon,
  accent,
  trend,
  trendValue,
  index,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  accent: "primary" | "emerald" | "amber" | "rose" | "sky";
  trend: "up" | "down" | "stable";
  trendValue?: string;
  index: number;
}) {
  const trendIcon =
    trend === "up" ? <TrendingUp className="size-3 text-emerald-400" /> :
    trend === "down" ? <TrendingDown className="size-3 text-red-400" /> :
    <span className="text-muted-foreground">—</span>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className={cn("rounded-lg border p-3", ACCENT_BORDER[accent])}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="[&_svg]:size-3.5">{icon}</span>
      </div>
      <p className="mt-1 font-mono text-lg font-bold text-foreground sm:text-xl">
        {value}
      </p>
      {hint ? (
        <p className="text-[10px] text-muted-foreground">{hint}</p>
      ) : null}
      {trendValue ? (
        <div className="mt-1 flex items-center gap-1 text-[10px]">
          {trendIcon}
          <span className={cn(
            trend === "up" ? "text-emerald-400" :
            trend === "down" ? "text-red-400" :
            "text-muted-foreground"
          )}>
            {trendValue}
          </span>
        </div>
      ) : null}
    </motion.div>
  );
}

function CostItemCard({ item, index }: { item: CostItem; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className="rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40"
    >
      <div className="flex items-center justify-between">
        <span className={cn("grid size-7 place-items-center rounded-md border", ACCENT_BORDER[item.accent])}>
          {item.icon}
        </span>
        <span className="text-[9px] font-bold uppercase text-muted-foreground">
          {((item.monthlyUsd / TOTAL_MONTHLY_BURN) * 100).toFixed(0)}%
        </span>
      </div>
      <p className="mt-2 text-[11px] font-semibold text-foreground">{item.label}</p>
      <p className="text-[9px] text-muted-foreground">{item.detail}</p>

      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Diário</span>
          <span className="font-mono font-bold text-amber-400">{fmtUSDShort(item.dailyUsd)}</span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Mensal</span>
          <span className="font-mono font-bold text-foreground">{fmtUSDShort(item.monthlyUsd)}</span>
        </div>
      </div>

      <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary/40">
        <div
          className={cn("h-full", ACCENT_BAR[item.accent])}
          style={{ width: `${(item.monthlyUsd / TOTAL_MONTHLY_BURN) * 100}%` }}
        />
      </div>
    </motion.div>
  );
}

function TenantCostRow({ tenant, index }: { tenant: TenantCost; index: number }) {
  const nicheColor = tenant.niche === "pousada" ? "text-amber-400" : "text-sky-400";
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className="flex items-center gap-3 px-3 py-2.5"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{tenant.name}</span>
          <span className={cn("text-[9px] font-bold uppercase", nicheColor)}>
            {tenant.niche}
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary/40">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${tenant.share}%` }}
            transition={{ duration: 0.4, delay: index * 0.04 }}
            className="h-full bg-primary"
          />
        </div>
      </div>
      <div className="text-right">
        <p className="font-mono text-sm font-bold text-foreground">{fmtUSDShort(tenant.monthlyUsd)}</p>
        <p className="text-[9px] text-muted-foreground">{tenant.share.toFixed(0)}% do top</p>
      </div>
    </motion.div>
  );
}
