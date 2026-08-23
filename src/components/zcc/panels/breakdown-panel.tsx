"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PieChart,
  DollarSign,
  Users,
  TrendingDown,
  TrendingUp,
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
  Calendar,
  Download,
  FileText,
  FileSpreadsheet,
  Target,
  Zap,
  Brain,
  Lightbulb,
  Rocket,
  Activity,
} from "lucide-react";
import { PanelHeader } from "../shared/panel-header";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/*
 * FinancialBreakdownPanel — Decomposição financeira do ZCC.
 *
 * - 6 botões de período: Dia / Semana / Mês / Trimestre / Semestre / Ano
 * - Para cada período: KPIs com % de crescimento/declínio vs período anterior
 * - Pontos críticos identificados com severidade
 * - Insights acionáveis: onde atuar, qual setor, como reverter
 * - Metas futuras com base nos dados atuais
 * - Exportação PDF (HTML imprimível) e XLSX (CSV)
 * - Math Audit no rodapê para verificação de consistência
 */

type PeriodKey = 'day' | 'week' | 'month' | 'quarter' | 'semester' | 'year';

const PERIOD_OPTIONS: Array<{ key: PeriodKey; label: string; short: string }> = [
  { key: 'day', label: 'Dia', short: 'D' },
  { key: 'week', label: 'Semana', short: 'S' },
  { key: 'month', label: 'Mês', short: 'M' },
  { key: 'quarter', label: 'Trimestre', short: 'T' },
  { key: 'semester', label: 'Semestre', short: 'S1' },
  { key: 'year', label: 'Ano', short: 'A' },
];

interface PlanBreakdown {
  plan: string;
  label: string;
  price: number;
  count: number;
  mrr: number;
  ratio: number;
  features: string[];
}

interface NicheBreakdown {
  niche: string;
  label: string;
  clients: number;
  mrr: number;
  ratio: number;
}

interface PeriodMetrics {
  range: { start: string; end: string; label: string };
  totalMRR: number;
  newMRR: number;
  lostMRR: number;
  activeClients: number;
  newClients: number;
  churnedClients: number;
  totalLeads: number;
  convertedLeads: number;
  lostLeads: number;
  conversionRate: number;
  revenue: number;
  arpu: number;
  burn: number;
  netProfit: number;
  burnPerClient: number;
}

interface Insight {
  type: 'growth' | 'decline' | 'critical' | 'opportunity' | 'success';
  severity: 'info' | 'warning' | 'critical' | 'success';
  metric: string;
  current: number;
  previous: number;
  changePct: number;
  message: string;
  actionArea: string;
  recommendation: string;
  futureGoal?: string;
}

interface Summary {
  period: PeriodKey;
  periodLabel: string;
  previousPeriodLabel: string;
  growthRate: number;
  healthScore: number;
  actionAreas: string[];
  topPriorities: Array<{
    metric: string;
    message: string;
    recommendation: string;
    actionArea: string;
  }>;
}

interface PeriodApiResponse {
  success: boolean;
  data: {
    current: PeriodMetrics;
    previous: PeriodMetrics;
    insights: Insight[];
    summary: Summary;
  };
  meta: { source: string; generatedAt: string };
}

const FALLBACK_DATA = {
  totalMRR: 24 * 197 + 48 * 397 + 32 * 797 + 18 * 247,
  arpu: 485,
  churnRate: 2.1,
  totalClients: 122,
  activeClients: 119,
  churnedClients: 3,
  mrrLost: 1191,
  planBreakdown: [
    { plan: "LITE", label: "LITE", price: 197, count: 24, mrr: 24 * 197, ratio: 0, features: ["50 hóspedes", "500 mensagens", "IA limitada"] },
    { plan: "PRO", label: "PRO", price: 397, count: 48, mrr: 48 * 397, ratio: 0, features: ["Ilimitado", "OAuth Airbnb", "Dynamic pricing"] },
    { plan: "MAX", label: "MAX", price: 797, count: 32, mrr: 32 * 797, ratio: 0, features: ["Tudo de PRO", "Competitor monitoring", "Multi-property"] },
    { plan: "PARCEIRO", label: "PARCEIRO", price: 247, count: 18, mrr: 18 * 247, ratio: 0, features: ["PRO + tab Conquistas", "Referral gamification"] },
  ] as PlanBreakdown[],
  nicheBreakdown: [
    { niche: "pousada", label: "Pousadas", clients: 64, mrr: 31280, ratio: 0 },
    { niche: "airbnb", label: "Airbnb", clients: 40, mrr: 13420, ratio: 0 },
    { niche: "parceiro", label: "Parceiros", clients: 18, mrr: 4446, ratio: 0 },
  ] as NicheBreakdown[],
};

// Recalcula ratios do fallback
(() => {
  const total = FALLBACK_DATA.totalMRR;
  FALLBACK_DATA.planBreakdown.forEach((p) => {
    p.ratio = total > 0 ? Math.round((p.mrr / total) * 1000) / 10 : 0;
  });
  const nicheTotal = FALLBACK_DATA.nicheBreakdown.reduce((s, n) => s + n.mrr, 0);
  FALLBACK_DATA.nicheBreakdown.forEach((n) => {
    n.ratio = nicheTotal > 0 ? Math.round((n.mrr / nicheTotal) * 1000) / 10 : 0;
  });
})();

const PLAN_META: Record<string, { icon: React.ReactNode; accent: string; bar: string }> = {
  LITE: { icon: <Sparkles className="size-4" />, accent: "text-sky-400 border-sky-500/30 bg-sky-500/10", bar: "bg-sky-400" },
  PRO: { icon: <Shield className="size-4" />, accent: "text-teal-400 border-teal-500/30 bg-teal-500/10", bar: "bg-teal-400" },
  MAX: { icon: <Crown className="size-4" />, accent: "text-primary border-primary/30 bg-primary/10", bar: "bg-primary" },
  PARCEIRO: { icon: <Handshake className="size-4" />, accent: "text-rose-400 border-rose-500/30 bg-rose-500/10", bar: "bg-rose-400" },
};

const NICHE_META: Record<string, { icon: React.ReactNode; accent: string; bar: string }> = {
  pousada: { icon: <Building2 className="size-4" />, accent: "text-primary border-primary/30 bg-primary/10", bar: "bg-primary" },
  airbnb: { icon: <Home className="size-4" />, accent: "text-teal-400 border-teal-500/30 bg-teal-500/10", bar: "bg-teal-400" },
  parceiro: { icon: <Handshake className="size-4" />, accent: "text-rose-400 border-rose-500/30 bg-rose-500/10", bar: "bg-rose-400" },
};

const SEVERITY_META: Record<Insight['severity'], { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  critical: { color: "text-red-400", bg: "bg-red-500/5", border: "border-red-500/30", icon: <AlertTriangle className="size-4" /> },
  warning: { color: "text-amber-400", bg: "bg-amber-500/5", border: "border-amber-500/30", icon: <AlertTriangle className="size-4" /> },
  success: { color: "text-emerald-400", bg: "bg-emerald-500/5", border: "border-emerald-500/30", icon: <TrendingUp className="size-4" /> },
  info: { color: "text-blue-400", bg: "bg-blue-500/5", border: "border-blue-500/30", icon: <Lightbulb className="size-4" /> },
};

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtPct = (n: number) => `${Math.round(n * 10) / 10}%`;

const fmtNum = (n: number) => n.toLocaleString("pt-BR");

export function FinancialBreakdownPanel() {
  const [period, setPeriod] = React.useState<PeriodKey>('month');
  const [loading, setLoading] = React.useState(false);
  const [exporting, setExporting] = React.useState<'pdf' | 'xlsx' | null>(null);
  const [periodData, setPeriodData] = React.useState<PeriodApiResponse['data'] | null>(null);
  const [dataSource, setDataSource] = React.useState<string>('fallback');
  const [planBreakdown, setPlanBreakdown] = React.useState<PlanBreakdown[]>(FALLBACK_DATA.planBreakdown);
  const [nicheBreakdown, setNicheBreakdown] = React.useState<NicheBreakdown[]>(FALLBACK_DATA.nicheBreakdown);
  const [showExportMenu, setShowExportMenu] = React.useState(false);
  const [exportSections, setExportSections] = React.useState({
    kpis: true, planBreakdown: true, nicheBreakdown: true,
    churn: true, insights: true, funnel: true,
  });

  // ── Load period data ──────────────────────────────────────────
  const loadPeriodData = React.useCallback(async (p: PeriodKey) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/zcc/metrics/periods?period=${p}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('API error');
      const json: PeriodApiResponse = await res.json();
      if (json?.success && json?.data) {
        setPeriodData(json.data);
        setDataSource(json.meta?.source ?? 'api');
      }
    } catch {
      setDataSource('fallback');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Load breakdown (planos/nichos) ───────────────────────────
  const loadBreakdown = React.useCallback(async () => {
    try {
      const res = await fetch('/api/zcc/metrics/financial', { cache: 'no-store' });
      const json = await res.json();
      if (json?.success && json?.data) {
        const d = json.data;
        if (Array.isArray(d.planBreakdown) && d.planBreakdown.length) {
          setPlanBreakdown(d.planBreakdown);
        }
        if (Array.isArray(d.nicheBreakdown) && d.nicheBreakdown.length) {
          setNicheBreakdown(d.nicheBreakdown);
        }
      }
    } catch {
      // keep fallback
    }
  }, []);

  React.useEffect(() => {
    loadPeriodData(period);
    loadBreakdown();
  }, [period, loadPeriodData, loadBreakdown]);

  const curr = periodData?.current;
  const prev = periodData?.previous;
  const insights = periodData?.insights ?? [];
  const summary = periodData?.summary;

  const maxPlanMrr = Math.max(...planBreakdown.map((p) => p.mrr));
  const maxNicheMrr = Math.max(...nicheBreakdown.map((n) => n.mrr));

  // ── Export handler ────────────────────────────────────────────
  const handleExport = async (format: 'pdf' | 'xlsx') => {
    setExporting(format);
    try {
      const sections = Object.keys(exportSections).filter((k) => exportSections[k as keyof typeof exportSections]);
      const res = await fetch('/api/zcc/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          period,
          sections,
          data: {
            current: curr,
            previous: prev,
            insights,
            planBreakdown,
            nicheBreakdown,
          },
        }),
      });

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const filename = `zcc-breakdown-${period}-${new Date().toISOString().slice(0, 10)}.${format === 'pdf' ? 'html' : 'csv'}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Relatório ${format.toUpperCase()} exportado`, {
        description: `${sections.length} seções incluídas · ${filename}`,
      });
      setShowExportMenu(false);
    } catch (error) {
      toast.error('Erro ao exportar', {
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader
        title="Financial Breakdown"
        description="Decomposição de receita · planos, nichos, churn & insights por período"
        icon={<PieChart className="size-5" />}
        actions={
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {dataSource}
            </span>
            <button
              type="button"
              onClick={() => { loadPeriodData(period); loadBreakdown(); }}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={cn("size-3", loading && "animate-spin")} />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowExportMenu((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary transition-colors hover:bg-primary/20"
              >
                <Download className="size-3" />
                Exportar
              </button>
              <AnimatePresence>
                {showExportMenu ? (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute right-0 top-8 z-50 w-72 rounded-lg border border-border bg-popover p-3 shadow-xl"
                  >
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Seções a incluir
                    </p>
                    <div className="mb-3 space-y-1">
                      {Object.keys(exportSections).map((key) => (
                        <label key={key} className="flex items-center gap-2 text-[11px] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={exportSections[key as keyof typeof exportSections]}
                            onChange={(e) => setExportSections((prev) => ({ ...prev, [key]: e.target.checked }))}
                            className="size-3 rounded border-border"
                          />
                          <span className="text-foreground capitalize">{key}</span>
                        </label>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleExport('pdf')}
                        disabled={exporting !== null}
                        className="inline-flex items-center justify-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1.5 text-[10px] font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
                      >
                        {exporting === 'pdf' ? (
                          <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <FileText className="size-3" />
                        )}
                        PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExport('xlsx')}
                        disabled={exporting !== null}
                        className="inline-flex items-center justify-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
                      >
                        {exporting === 'xlsx' ? (
                          <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <FileSpreadsheet className="size-3" />
                        )}
                        XLSX
                      </button>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        }
      />

      <div className="zcc-scroll flex-1 overflow-y-auto p-4 sm:p-6">
        {/* ====== PERÍODO SELECTOR ====== */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Calendar className="size-3" />
            Selecione o período para análise comparativa (atual vs anterior)
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setPeriod(opt.key)}
                className={cn(
                  "relative rounded-lg border px-3 py-2 text-center transition-all",
                  period === opt.key
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                <p className="text-sm font-bold">{opt.label}</p>
                <p className="mt-0.5 text-[9px] uppercase tracking-wide opacity-70">
                  {opt.short}
                </p>
                {period === opt.key ? (
                  <span className="absolute -right-1 -top-1 grid size-3 place-items-center rounded-full bg-primary text-[7px] text-primary-foreground">
                    ✓
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          {curr?.range?.label ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              <strong className="text-foreground">Período atual:</strong> {curr.range.label}{" "}
              · <strong className="text-foreground">Anterior:</strong> {prev?.range?.label ?? '—'}
            </p>
          ) : null}
        </motion.div>

        {/* ====== HEALTH SCORE ====== */}
        {summary ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-6 rounded-lg border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Activity className="size-3.5 text-primary" />
                  Health Score · {summary.periodLabel}
                </p>
                <div className="mt-2 flex items-end gap-3">
                  <p className={cn(
                    "text-3xl font-bold",
                    summary.healthScore >= 70 ? "text-emerald-400" :
                    summary.healthScore >= 40 ? "text-amber-400" :
                    "text-red-400"
                  )}>
                    {summary.healthScore}
                  </p>
                  <p className="mb-1 text-[10px] text-muted-foreground">/ 100</p>
                  <p className="mb-1 text-[11px] text-muted-foreground">
                    Crescimento: <span className={cn("font-bold", summary.growthRate > 0 ? "text-emerald-400" : "text-red-400")}>
                      {summary.growthRate > 0 ? '+' : ''}{summary.growthRate}%
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-end justify-end gap-1.5">
                {summary.actionAreas.slice(0, 4).map((area) => (
                  <span
                    key={area}
                    className="rounded border border-border bg-secondary px-2 py-0.5 text-[9px] text-muted-foreground"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        ) : null}

        {/* ====== KPIs ====== */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          <KpiCard
            icon={<DollarSign className="size-4" />}
            label="MRR Total"
            value={fmtBRL(curr?.totalMRR ?? FALLBACK_DATA.totalMRR)}
            change={changePct(curr?.totalMRR, prev?.totalMRR)}
            highlight
          />
          <KpiCard
            icon={<Rocket className="size-4" />}
            label="Novo MRR"
            value={fmtBRL(curr?.newMRR ?? 0)}
            change={changePct(curr?.newMRR, prev?.newMRR)}
          />
          <KpiCard
            icon={<TrendingDown className="size-4" />}
            label="MRR Perdido"
            value={fmtBRL(curr?.lostMRR ?? 0)}
            change={changePct(curr?.lostMRR, prev?.lostMRR)}
            inverse
          />
          <KpiCard
            icon={<Users className="size-4" />}
            label="Clientes Ativos"
            value={String(curr?.activeClients ?? FALLBACK_DATA.activeClients)}
            change={changePct(curr?.activeClients, prev?.activeClients)}
          />
          <KpiCard
            icon={<ArrowUpRight className="size-4" />}
            label="Novos Clientes"
            value={String(curr?.newClients ?? 0)}
            change={changePct(curr?.newClients, prev?.newClients)}
          />
          <KpiCard
            icon={<ArrowDownRight className="size-4" />}
            label="Churned"
            value={String(curr?.churnedClients ?? FALLBACK_DATA.churnedClients)}
            change={changePct(curr?.churnedClients, prev?.churnedClients)}
            inverse
          />
          <KpiCard
            icon={<Target className="size-4" />}
            label="Conversão Leads"
            value={fmtPct(curr?.conversionRate ?? 0)}
            change={changePct(curr?.conversionRate, prev?.conversionRate)}
          />
          <KpiCard
            icon={<TrendingUp className="size-4" />}
            label="Lucro Líquido"
            value={fmtBRL(curr?.netProfit ?? 0)}
            change={changePct(curr?.netProfit, prev?.netProfit)}
          />
          <KpiCard
            icon={<DollarSign className="size-4" />}
            label="ARPU"
            value={fmtBRL(curr?.arpu ?? FALLBACK_DATA.arpu)}
            change={changePct(curr?.arpu, prev?.arpu)}
          />
          <KpiCard
            icon={<Zap className="size-4" />}
            label="Burn"
            value={fmtBRL(curr?.burn ?? 0)}
            change={changePct(curr?.burn, prev?.burn)}
            inverse
          />
          <KpiCard
            icon={<Target className="size-4" />}
            label="Receita"
            value={fmtBRL(curr?.revenue ?? 0)}
            change={changePct(curr?.revenue, prev?.revenue)}
          />
          <KpiCard
            icon={<Activity className="size-4" />}
            label="Leads Totais"
            value={String(curr?.totalLeads ?? 0)}
            change={changePct(curr?.totalLeads, prev?.totalLeads)}
          />
        </motion.div>

        {/* ====== INSIGHTS & RECOMENDAÇÕES ====== */}
        {insights.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-6"
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Brain className="size-3.5 text-primary" />
                Insights & Recomendações ({insights.length})
              </h3>
              <span className="text-[10px] text-muted-foreground">
                {insights.filter((i) => i.severity === 'critical').length} críticos ·{" "}
                {insights.filter((i) => i.severity === 'warning').length} alertas ·{" "}
                {insights.filter((i) => i.severity === 'success').length} sucessos
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {insights.map((insight, idx) => {
                const meta = SEVERITY_META[insight.severity];
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.04 }}
                    className={cn("rounded-lg border p-3", meta.bg, meta.border)}
                  >
                    <div className="flex items-start gap-2">
                      <span className={cn("shrink-0", meta.color)}>{meta.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-[11px] font-semibold leading-tight", meta.color)}>
                          {insight.message}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          <strong className="text-foreground">Atual:</strong>{" "}
                          {typeof insight.current === 'number' ? fmtNum(insight.current) : insight.current}
                          {" · "}
                          <strong className="text-foreground">Anterior:</strong>{" "}
                          {typeof insight.previous === 'number' ? fmtNum(insight.previous) : insight.previous}
                          {" · "}
                          <span className={insight.changePct > 0 ? "text-emerald-400" : "text-red-400"}>
                            {insight.changePct > 0 ? '+' : ''}{insight.changePct}%
                          </span>
                        </p>
                        <p className="mt-1.5 text-[10px] text-muted-foreground">
                          <strong className="text-foreground">📍 Onde atuar:</strong> {insight.actionArea}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          <strong className="text-foreground">🎯 Como reverter/melhorar:</strong> {insight.recommendation}
                        </p>
                        {insight.futureGoal ? (
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            <strong className="text-foreground">🚀 Meta futura:</strong> {insight.futureGoal}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        ) : null}

        {/* ====== TOP PRIORITIES ====== */}
        {summary?.topPriorities?.length ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4"
          >
            <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-amber-400">
              <AlertTriangle className="size-3.5" />
              Top {summary.topPriorities.length} prioridades
            </h3>
            <div className="space-y-2">
              {summary.topPriorities.map((p, idx) => (
                <div key={idx} className="rounded border border-amber-500/20 bg-amber-500/5 p-2">
                  <p className="text-[11px] font-semibold text-foreground">
                    {idx + 1}. {p.metric} — {p.message}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    <strong className="text-foreground">Setor:</strong> {p.actionArea}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    <strong className="text-foreground">Ação:</strong> {p.recommendation}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        ) : null}

        {/* ====== PLAN BREAKDOWN ====== */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-6"
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Crown className="size-3.5 text-primary" />
              Plan breakdown · 4 planos pagos
            </h3>
            <span className="text-[10px] text-muted-foreground">sem trial · alinhado com Prisma</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {planBreakdown.map((plan, idx) => {
              const meta = PLAN_META[plan.plan] ?? PLAN_META.LITE;
              return (
                <motion.div
                  key={plan.plan}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30"
                >
                  <div className="flex items-center justify-between">
                    <span className={cn("grid size-8 place-items-center rounded-md border", meta.accent)}>{meta.icon}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{plan.ratio.toFixed(1)}%</span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-foreground">{plan.label}</p>
                  <p className="text-[11px] text-muted-foreground">{fmtBRL(plan.price)}/mês</p>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] uppercase text-muted-foreground">assinantes</span>
                      <span className="text-sm font-semibold text-foreground">{plan.count}</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] uppercase text-muted-foreground">MRR</span>
                      <span className="text-sm font-semibold text-primary">{fmtBRL(plan.mrr)}</span>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <motion.div
                      className={cn("h-full", meta.bar)}
                      initial={{ width: 0 }}
                      animate={{ width: `${maxPlanMrr > 0 ? (plan.mrr / maxPlanMrr) * 100 : 0}%` }}
                      transition={{ duration: 0.6, delay: idx * 0.05 + 0.2 }}
                    />
                  </div>
                  <ul className="mt-3 space-y-1">
                    {plan.features.slice(0, 2).map((f) => (
                      <li key={f} className="flex items-start gap-1 text-[10px] text-muted-foreground">
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
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Building2 className="size-3.5 text-primary" />
              Niche comparison · Pousadas vs Airbnb vs Parceiro
            </h3>
            <span className="text-[10px] text-muted-foreground">
              {nicheBreakdown.reduce((s, n) => s + n.clients, 0)} clientes
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {nicheBreakdown.map((niche, idx) => {
              const meta = NICHE_META[niche.niche] ?? NICHE_META.pousada;
              return (
                <motion.div
                  key={niche.niche}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className={cn("grid size-8 place-items-center rounded-md border", meta.accent)}>{meta.icon}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{niche.ratio.toFixed(1)}%</span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-foreground">{niche.label}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">clientes</p>
                      <p className="text-base font-semibold text-foreground">{niche.clients}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">MRR</p>
                      <p className="text-base font-semibold text-primary">{fmtBRL(niche.mrr)}</p>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <motion.div
                      className={cn("h-full", meta.bar)}
                      initial={{ width: 0 }}
                      animate={{ width: `${maxNicheMrr > 0 ? (niche.mrr / maxNicheMrr) * 100 : 0}%` }}
                      transition={{ duration: 0.6, delay: idx * 0.05 + 0.2 }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* ====== MATH AUDIT ====== */}
        <MathAudit
          data={{
            totalMRR: curr?.totalMRR ?? FALLBACK_DATA.totalMRR,
            activeClients: curr?.activeClients ?? FALLBACK_DATA.activeClients,
            totalClients: (curr?.activeClients ?? FALLBACK_DATA.activeClients) + (curr?.churnedClients ?? FALLBACK_DATA.churnedClients),
            churnedClients: curr?.churnedClients ?? FALLBACK_DATA.churnedClients,
            churnRate: curr?.churnedClients && curr?.activeClients
              ? (curr.churnedClients / (curr.activeClients + curr.churnedClients)) * 100
              : FALLBACK_DATA.churnRate,
            arpu: curr?.arpu ?? FALLBACK_DATA.arpu,
            mrrLost: curr?.lostMRR ?? FALLBACK_DATA.mrrLost,
            planBreakdown,
            nicheBreakdown,
          }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function changePct(curr?: number, prev?: number): string {
  if (curr === undefined || prev === undefined || prev === 0) return '—';
  const change = ((curr - prev) / Math.abs(prev)) * 100;
  const sign = change > 0 ? '+' : '';
  return `${sign}${Math.round(change * 10) / 10}%`;
}

// ============================================================================
// SUB-COMPONENTES
// ============================================================================

function KpiCard({
  icon,
  label,
  value,
  change,
  highlight,
  inverse,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  change?: string;
  highlight?: boolean;
  inverse?: boolean;
}) {
  const isPositive = change?.startsWith('+');
  const isNegative = change?.startsWith('-');
  const isGoodChange = inverse ? isNegative : isPositive;
  const isBadChange = inverse ? isPositive : isNegative;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-card p-3 transition-colors",
        highlight
          ? "border-primary/40 bg-primary/5"
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
        {change && change !== '—' ? (
          <span
            className={cn(
              "flex items-center gap-0.5 text-[10px] font-semibold",
              isGoodChange ? "text-emerald-400" :
              isBadChange ? "text-red-400" :
              "text-muted-foreground"
            )}
          >
            {isPositive ? <ArrowUpRight className="size-3" /> : isNegative ? <ArrowDownRight className="size-3" /> : null}
            {change}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-lg font-bold", highlight ? "text-primary" : "text-foreground")}>{value}</p>
    </div>
  );
}

function MathAudit({ data }: { data: any }) {
  const planSumMrr = data.planBreakdown.reduce((s: number, p: any) => s + p.mrr, 0);
  const planSumCount = data.planBreakdown.reduce((s: number, p: any) => s + p.count, 0);
  const nicheSumMrr = data.nicheBreakdown.reduce((s: number, n: any) => s + n.mrr, 0);
  const nicheSumClients = data.nicheBreakdown.reduce((s: number, n: any) => s + n.clients, 0);

  const mrrOk = Math.abs(planSumMrr - data.totalMRR) <= 1;
  const countOk = planSumCount === data.activeClients;
  const nicheClientsOk = nicheSumClients === data.activeClients || nicheSumClients === data.totalClients;
  const nicheMrrOk = Math.abs(nicheSumMrr - data.totalMRR) <= 1;
  const arpuOk = data.activeClients > 0
    ? Math.abs(data.arpu - Math.round(data.totalMRR / data.activeClients)) <= 5
    : data.arpu === 0;
  const churnOk = data.totalClients > 0
    ? Math.abs(data.churnRate - (data.churnedClients / data.totalClients) * 100) <= 0.2
    : data.churnRate === 0;
  const mrrLostOk = data.churnedClients > 0
    ? Math.abs(data.mrrLost - data.churnedClients * data.arpu) <= data.arpu
    : data.mrrLost === 0;

  const checks = [
    { label: "Σ planos MRR = totalMRR", ok: mrrOk, detail: `${fmtBRL(planSumMrr)} vs ${fmtBRL(data.totalMRR)}` },
    { label: "Σ planos count = activeClients", ok: countOk, detail: `${planSumCount} vs ${data.activeClients}` },
    { label: "Σ nicho MRR = totalMRR", ok: nicheMrrOk, detail: `${fmtBRL(nicheSumMrr)} vs ${fmtBRL(data.totalMRR)}` },
    { label: "Σ nicho clients = totalClients", ok: nicheClientsOk, detail: `${nicheSumClients} vs ${data.totalClients}` },
    { label: "ARPU = totalMRR / activeClients", ok: arpuOk, detail: `esperado: ${data.activeClients > 0 ? fmtBRL(Math.round(data.totalMRR / data.activeClients)) : "—"}` },
    { label: "Churn = churned / total × 100", ok: churnOk, detail: `${data.churnRate.toFixed(1)}% esperado` },
    { label: "MRR lost ≈ churned × ARPU", ok: mrrLostOk, detail: `${fmtBRL(data.mrrLost)} vs ${fmtBRL(data.churnedClients * data.arpu)}` },
  ];

  const okCount = checks.filter((c) => c.ok).length;
  const allOk = okCount === checks.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span className={cn("size-2 rounded-full", allOk ? "bg-emerald-500" : "bg-amber-500")} />
          Math audit · consistência cruzada ({okCount}/{checks.length})
        </h3>
        <span className={cn("text-[10px] font-bold uppercase", allOk ? "text-emerald-400" : "text-amber-400")}>
          {allOk ? "all checks passed" : "drift detected"}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {checks.map((c, idx) => (
          <div
            key={c.label}
            className={cn(
              "flex items-center justify-between rounded border px-2.5 py-1.5 text-[10px]",
              c.ok ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"
            )}
          >
            <span className="flex items-center gap-1.5 truncate text-muted-foreground">
              <span className={cn(
                "grid size-3.5 place-items-center rounded-full text-[8px] font-bold text-white",
                c.ok ? "bg-emerald-500" : "bg-amber-500"
              )}>
                {c.ok ? "✓" : "!"}
              </span>
              <span className="truncate font-mono">{c.label}</span>
            </span>
            <span className="ml-2 shrink-0 font-mono text-[9px] text-muted-foreground/70" title={c.detail}>
              {c.detail}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
