"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  CreditCard,
  Receipt,
  Building2,
  DollarSign,
  TrendingDown,
  MapPin,
  Info,
  RefreshCw,
  Link2,
  Percent,
  Banknote,
  PiggyBank,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/*
 * ExpensesBreakdown — Componente de Taxas e Impostos
 *
 * CONEXÕES:
 *  - GET /api/zcc/finance/expenses → dados completos
 *  - Prisma: Subscription (paymentMethod) + Transaction + Tenant
 *
 * TAXAS DE GATEWAY (conforme escolhidos):
 *  - Mercado Pago PIX:           0.99%
 *  - Mercado Pago Cartão débito: 1.99%
 *  - Mercado Pago Cartão crédito: 4.99% + R$ 0,40
 *  - Stripe Cartão internacional: 4.99% + R$ 0,50 + 1% cross-border
 *
 * IMPOSTOS (Praia Grande/SP — Litoral Sul de São Paulo):
 *  - Simples Nacional Anexo III: 6% (faixa 1 até R$ 180k/ano)
 *  - ISS Praia Grande: 5% (já embutido no Simples)
 *  - PIS/COFINS: 0,74% (já embutido no Simples)
 */

interface GatewayFeeItem {
  gateway: string;
  paymentMethod: string;
  label: string;
  ratePct: number;
  fixedFeeBRL: number;
  effectiveRatePct: number;
  transactionCount: number;
  volumeBRL: number;
  feeBRL: number;
}

interface TaxItem {
  name: string;
  description: string;
  ratePct: number;
  baseBRL: number;
  amountBRL: number;
  isPracaGrandeSpecific: boolean;
}

interface OtherExpense {
  id: string;
  category: string;
  label: string;
  amountBRL: number;
  detail?: string;
  isRecurring: boolean;
}

interface PerPlanItem {
  plan: string;
  priceBRL: number;
  paymentMethod: string;
  gateway: string;
  gatewayFeeBRL: number;
  taxBRL: number;
  netPerClientBRL: number;
  clientCount: number;
  totalNetBRL: number;
}

interface ExpensesData {
  gatewayFees: GatewayFeeItem[];
  totalGatewayFeesBRL: number;
  taxes: TaxItem[];
  totalTaxesBRL: number;
  otherExpenses: OtherExpense[];
  totalOtherExpensesBRL: number;
  grossRevenueBRL: number;
  totalExpensesBRL: number;
  netRevenueBRL: number;
  marginPct: number;
  jurisdiction: {
    city: string;
    state: string;
    country: string;
    taxRegime: string;
    anexo: string;
    annualRevenueBracket: string;
    effectiveTaxRatePct: number;
  };
  perPlanBreakdown: PerPlanItem[];
}

const GATEWAY_BADGE: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  mercadopago: {
    color: "text-sky-400",
    bg: "bg-sky-500/10 border-sky-500/30",
    icon: <Banknote className="size-3" />,
  },
  stripe: {
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/30",
    icon: <CreditCard className="size-3" />,
  },
};

const METHOD_LABEL: Record<string, string> = {
  pix: "PIX",
  debito: "Débito",
  credito: "Crédito",
  credito_internacional: "Crédito Internacional",
};

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtBRLShort = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtPct = (n: number) => `${Math.round(n * 100) / 100}%`;

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  infrastructure: <Building2 className="size-3" />,
  marketing: <TrendingDown className="size-3" />,
  tool: <CreditCard className="size-3" />,
  team: <PiggyBank className="size-3" />,
  other: <Receipt className="size-3" />,
  gateway_fee: <Percent className="size-3" />,
  tax: <Receipt className="size-3" />,
};

export function ExpensesBreakdown() {
  const [data, setData] = React.useState<ExpensesData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [dataSource, setDataSource] = React.useState<string>('fallback');

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/zcc/finance/expenses', { cache: 'no-store' });
      if (!res.ok) throw new Error('API error');
      const json = await res.json();
      if (json?.success && json?.data) {
        setData(json.data);
        setDataSource(json.meta?.source ?? 'api');
      }
    } catch {
      setDataSource('fallback');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    loadData();
    toast.success('Taxas e impostos recalculados');
  };

  if (!data) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Taxas de Gateway + Impostos (Praia Grande/SP)
          </h3>
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
        </div>
        <div className="grid place-items-center py-8">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-2 text-[10px] text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border bg-card p-4"
    >
      {/* ── Header ── */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Receipt className="size-3.5 text-primary" />
            Taxas de Gateway + Impostos · {data.jurisdiction.city}/{data.jurisdiction.state}
          </h3>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {data.jurisdiction.taxRegime} · Anexo {data.jurisdiction.anexo} · {data.jurisdiction.annualRevenueBracket}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[9px] font-medium text-muted-foreground">
            <Link2 className="size-2.5 text-primary" />
            <span className="text-primary">{dataSource}</span>
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="grid size-6 place-items-center rounded border border-border bg-background text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={cn("size-3", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* ── KPIs Resumo ── */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KpiTile
          label="Receita Bruta"
          value={fmtBRLShort(data.grossRevenueBRL)}
          icon={<DollarSign className="size-3" />}
          accent="primary"
        />
        <KpiTile
          label="Taxas Gateway"
          value={fmtBRLShort(data.totalGatewayFeesBRL)}
          icon={<CreditCard className="size-3" />}
          accent="amber"
          pct={data.grossRevenueBRL > 0 ? (data.totalGatewayFeesBRL / data.grossRevenueBRL) * 100 : 0}
        />
        <KpiTile
          label="Impostos"
          value={fmtBRLShort(data.totalTaxesBRL)}
          icon={<Receipt className="size-3" />}
          accent="rose"
          pct={data.grossRevenueBRL > 0 ? (data.totalTaxesBRL / data.grossRevenueBRL) * 100 : 0}
        />
        <KpiTile
          label="Líquido"
          value={fmtBRLShort(data.netRevenueBRL)}
          icon={<PiggyBank className="size-3" />}
          accent="emerald"
          pct={data.marginPct}
        />
      </div>

      {/* ── Taxas de Gateway detalhadas ── */}
      <div className="mb-4">
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <CreditCard className="size-3 text-amber-400" />
          Taxas de Cartão por Gateway
        </p>
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-[1fr_4rem_4rem_4rem_5rem] items-center gap-2 border-b border-border bg-secondary/30 px-2 py-1.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Gateway / Método</span>
            <span className="text-center">Taxa %</span>
            <span className="text-center">Transações</span>
            <span className="text-right">Volume</span>
            <span className="text-right">Taxa (R$)</span>
          </div>
          {data.gatewayFees.map((g, idx) => {
            const badge = GATEWAY_BADGE[g.gateway] ?? GATEWAY_BADGE.mercadopago;
            return (
              <motion.div
                key={`${g.gateway}-${g.paymentMethod}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="grid grid-cols-[1fr_4rem_4rem_4rem_5rem] items-center gap-2 border-b border-border last:border-0 px-2 py-2 hover:bg-secondary/10"
              >
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold text-foreground">{g.label}</p>
                  <div className="mt-0.5 flex items-center gap-1">
                    <span className={cn("inline-flex items-center gap-0.5 rounded border px-1 py-0.5 text-[8px] font-bold uppercase", badge.bg, badge.color)}>
                      {badge.icon}
                      {g.gateway}
                    </span>
                    <span className="rounded border border-border bg-background px-1 py-0.5 text-[8px] font-medium uppercase text-muted-foreground">
                      {METHOD_LABEL[g.paymentMethod] ?? g.paymentMethod}
                    </span>
                    {g.fixedFeeBRL > 0 ? (
                      <span className="text-[8px] text-muted-foreground">+ {fmtBRL(g.fixedFeeBRL)} fixo</span>
                    ) : null}
                  </div>
                </div>
                <span className="text-center font-mono text-[11px] font-bold text-amber-400">
                  {fmtPct(g.ratePct)}
                </span>
                <span className="text-center text-[11px] text-foreground">{g.transactionCount}</span>
                <span className="text-right font-mono text-[10px] text-muted-foreground">
                  {fmtBRLShort(g.volumeBRL)}
                </span>
                <span className="text-right font-mono text-[11px] font-bold text-red-400">
                  −{fmtBRLShort(g.feeBRL)}
                </span>
              </motion.div>
            );
          })}
        </div>
        <p className="mt-1.5 text-[9px] text-muted-foreground">
          Total: <span className="font-bold text-red-400">{fmtBRL(data.totalGatewayFeesBRL)}</span>
          {" · "}Efetivo médio: <span className="font-bold text-foreground">
            {data.grossRevenueBRL > 0 ? fmtPct((data.totalGatewayFeesBRL / data.grossRevenueBRL) * 100) : '0%'}
          </span>
          {" · "}Gateways: Mercado Pago (PIX, débito, crédito) + Stripe (internacional)
        </p>
      </div>

      {/* ── Impostos Praia Grande/SP ── */}
      <div className="mb-4">
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <MapPin className="size-3 text-rose-400" />
          Impostos · {data.jurisdiction.city}/{data.jurisdiction.state} · {data.jurisdiction.taxRegime}
        </p>
        <div className="space-y-1.5">
          {data.taxes.map((t, idx) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={cn(
                "rounded-md border p-2",
                t.amountBRL > 0
                  ? "border-rose-500/30 bg-rose-500/5"
                  : "border-emerald-500/30 bg-emerald-500/5"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-[11px] font-semibold text-foreground">{t.name}</p>
                    {t.isPracaGrandeSpecific ? (
                      <span className="inline-flex items-center gap-0.5 rounded border border-amber-500/30 bg-amber-500/10 px-1 py-0.5 text-[7px] font-bold uppercase text-amber-400">
                        <MapPin className="size-2" />
                        PG
                      </span>
                    ) : null}
                    {t.amountBRL === 0 ? (
                      <span className="inline-flex items-center gap-0.5 text-[9px] text-emerald-400">
                        <CheckCircle2 className="size-2.5" />
                        embutido
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[9px] text-muted-foreground leading-tight">{t.description}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[11px] font-bold text-foreground">
                    {t.ratePct > 0 ? fmtPct(t.ratePct) : '—'}
                  </p>
                  <p className={cn(
                    "font-mono text-[10px]",
                    t.amountBRL > 0 ? "text-red-400 font-bold" : "text-muted-foreground"
                  )}>
                    {t.amountBRL > 0 ? `−${fmtBRLShort(t.amountBRL)}` : 'R$ 0'}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        <p className="mt-1.5 text-[9px] text-muted-foreground">
          Total impostos: <span className="font-bold text-red-400">{fmtBRL(data.totalTaxesBRL)}</span>
          {" · "}Alíquota efetiva: <span className="font-bold text-foreground">{fmtPct(data.jurisdiction.effectiveTaxRatePct)}</span>
          {" · "}Base de cálculo: <span className="font-bold text-foreground">{fmtBRLShort(data.grossRevenueBRL)}</span>
        </p>
      </div>

      {/* ── Breakdown por plano (com gateway + impostos) ── */}
      {data.perPlanBreakdown.length > 0 ? (
        <div className="mb-4">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <PiggyBank className="size-3 text-emerald-400" />
            Líquido por plano · após taxas + impostos
          </p>
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="grid grid-cols-[3rem_4rem_4rem_5rem_5rem_5rem] items-center gap-2 border-b border-border bg-secondary/30 px-2 py-1.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Plano</span>
              <span className="text-center">Preço</span>
              <span className="text-center">Método</span>
              <span className="text-right">Gateway</span>
              <span className="text-right">Imposto</span>
              <span className="text-right">Líq/cliente</span>
            </div>
            {data.perPlanBreakdown.map((p, idx) => (
              <motion.div
                key={`${p.plan}-${p.paymentMethod}-${idx}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="grid grid-cols-[3rem_4rem_4rem_5rem_5rem_5rem] items-center gap-2 border-b border-border last:border-0 px-2 py-1.5 hover:bg-secondary/10"
              >
                <span className="text-[10px] font-bold text-foreground">{p.plan}</span>
                <span className="text-center font-mono text-[10px] text-foreground">{fmtBRLShort(p.priceBRL)}</span>
                <span className="text-center text-[9px] text-muted-foreground">{METHOD_LABEL[p.paymentMethod] ?? p.paymentMethod}</span>
                <span className="text-right font-mono text-[9px] text-amber-400">−{fmtBRLShort(p.gatewayFeeBRL)}</span>
                <span className="text-right font-mono text-[9px] text-red-400">−{fmtBRLShort(p.taxBRL)}</span>
                <span className="text-right font-mono text-[10px] font-bold text-emerald-400">
                  {fmtBRLShort(p.netPerClientBRL)}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Outras despesas operacionais ── */}
      <div className="mb-4">
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Building2 className="size-3 text-primary" />
          Outras despesas operacionais
        </p>
        <div className="space-y-1">
          {data.otherExpenses.map((e, idx) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="flex items-center justify-between rounded border border-border bg-background px-2 py-1.5"
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="grid size-5 place-items-center rounded border border-border bg-secondary text-muted-foreground">
                  {CATEGORY_ICON[e.category] ?? <Receipt className="size-3" />}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-medium text-foreground">{e.label}</p>
                  {e.detail ? (
                    <p className="truncate text-[9px] text-muted-foreground">{e.detail}</p>
                  ) : null}
                </div>
              </div>
              <span className="ml-2 shrink-0 font-mono text-[11px] font-semibold text-red-400">
                −{fmtBRLShort(e.amountBRL)}
              </span>
            </motion.div>
          ))}
        </div>
        <p className="mt-1.5 text-[9px] text-muted-foreground">
          Total: <span className="font-bold text-red-400">{fmtBRL(data.totalOtherExpensesBRL)}</span>
        </p>
      </div>

      {/* ── Resumo Final ── */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Resumo · {data.jurisdiction.city}/{data.jurisdiction.state}
            </p>
            <p className="mt-1 text-[11px] text-foreground">
              <strong>Receita bruta:</strong> {fmtBRL(data.grossRevenueBRL)}
            </p>
            <p className="text-[11px] text-red-400">
              <strong>− Taxas de gateway:</strong> {fmtBRL(data.totalGatewayFeesBRL)}
              {" ("}{data.grossRevenueBRL > 0 ? fmtPct((data.totalGatewayFeesBRL / data.grossRevenueBRL) * 100) : '0%'}{")"}
            </p>
            <p className="text-[11px] text-red-400">
              <strong>− Impostos ({data.jurisdiction.taxRegime}):</strong> {fmtBRL(data.totalTaxesBRL)}
              {" ("}{data.jurisdiction.effectiveTaxRatePct}%{")"}
            </p>
            <p className="text-[11px] text-red-400">
              <strong>− Outras despesas:</strong> {fmtBRL(data.totalOtherExpensesBRL)}
            </p>
            <p className="mt-1 text-[12px] font-bold text-emerald-400">
              = Líquido: {fmtBRL(data.netRevenueBRL)} · Margem {data.marginPct}%
            </p>
          </div>
        </div>
      </div>

      {/* ── Info box ── */}
      <div className="mt-3 flex items-start gap-2 rounded-md border border-blue-500/30 bg-blue-500/5 p-2 text-[9px] text-muted-foreground">
        <Info className="size-3 shrink-0 text-blue-400 mt-0.5" />
        <div>
          <strong className="text-foreground">Cálculo conforme Praia Grande/SP:</strong>
          {" · "}Simples Nacional Anexo III (6% faixa 1)
          {" · "}ISS municipal já embutido
          {" · "}Taxas de gateway atualizadas conforme tabela 2025 (MP e Stripe)
          {" · "}Dados via <code className="font-mono text-primary">/api/zcc/finance/expenses</code>
        </div>
      </div>
    </motion.div>
  );
}

// ── Sub-component ──────────────────────────────────────────────

function KpiTile({
  label,
  value,
  icon,
  accent,
  pct,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: 'primary' | 'amber' | 'rose' | 'emerald';
  pct?: number;
}) {
  const accentMap: Record<string, string> = {
    primary: "border-primary/30 bg-primary/5 text-primary",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-400",
    rose: "border-rose-500/30 bg-rose-500/5 text-rose-400",
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-400",
  };

  return (
    <div className={cn("rounded-lg border p-2", accentMap[accent])}>
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="[&_svg]:size-3">{icon}</span>
      </div>
      <p className="mt-1 font-mono text-sm font-bold text-foreground">{value}</p>
      {pct !== undefined ? (
        <p className={cn("text-[9px]", accent === 'emerald' ? "text-emerald-400" : "text-muted-foreground")}>
          {pct.toFixed(1)}% do bruto
        </p>
      ) : null}
    </div>
  );
}
