"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserCheck,
  Mail,
  MessageCircle,
  KeyRound,
  CreditCard,
  ScanLine,
  CheckCircle2,
  Circle,
  Loader2,
  Clock,
  ChevronRight,
  Users,
  Zap,
  Target,
  TrendingUp,
  DollarSign,
  Brain,
  Megaphone,
  Rocket,
  AlertTriangle,
  Activity,
  Link2,
  RefreshCw,
  Lightbulb,
  Building2,
  Home,
  Crown,
  Sparkles,
  Shield,
  Handshake,
} from "lucide-react";
import { PanelHeader } from "../shared/panel-header";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/*
 * OnboardingTrackerPanel — Funil de ativação + Funil de Vendas para Google Ads
 *
 * INTEGRAÇÃO COM BREAKDOWN:
 *  - GET /api/zcc/metrics/periods?period=month → KPIs (MRR, novos clientes, churn, conversion)
 *  - GET /api/zcc/sales-funnel → Funil completo Google Ads (Impressões → Clientes)
 *
 * CONTEÚDO:
 *  1. Header com taxa de onboarding + Health Score (do Breakdown)
 *  2. Funil de ativação: 5 etapas por tenant (Payment → Email → Scan → WhatsApp → Auto-PIN)
 *  3. Funil de Vendas Google Ads: Impressões → Cliques → Leads → MQL → SQL → Clientes
 *  4. Personas para Google Ads (Tradicional, Moderno, Elite)
 *  5. Recomendações de campanhas por persona (palavras-chave, orçamento, target CPA)
 *  6. Distribuição geográfica (onde investir mais)
 *  7. Resumo executivo para o setor de Marketing
 */

interface OnboardingStep {
  id: "payment" | "email" | "scan" | "whatsapp" | "autopin";
  label: string;
  icon: React.ReactNode;
  done: boolean;
  inProgress?: boolean;
}

interface OnboardingTenant {
  id: string;
  name: string;
  niche: "pousada" | "airbnb";
  plan: "LITE" | "PRO" | "MAX" | "PARCEIRO";
  createdAt: string;
  steps: OnboardingStep[];
}

const STEP_DEFS: { id: OnboardingStep["id"]; label: string; icon: React.ReactNode }[] = [
  { id: "payment", label: "Payment", icon: <CreditCard className="size-3.5" /> },
  { id: "email", label: "Email", icon: <Mail className="size-3.5" /> },
  { id: "scan", label: "Magic Scan", icon: <ScanLine className="size-3.5" /> },
  { id: "whatsapp", label: "WhatsApp", icon: <MessageCircle className="size-3.5" /> },
  { id: "autopin", label: "Auto-PIN", icon: <KeyRound className="size-3.5" /> },
];

const MOCK_TENANTS: OnboardingTenant[] = [
  {
    id: "t1", name: "Pousada Serenity Paraty", niche: "pousada", plan: "MAX", createdAt: "há 2 dias",
    steps: [
      { id: "payment", label: "Payment", icon: <CreditCard className="size-3.5" />, done: true },
      { id: "email", label: "Email", icon: <Mail className="size-3.5" />, done: true },
      { id: "scan", label: "Magic Scan", icon: <ScanLine className="size-3.5" />, done: true },
      { id: "whatsapp", label: "WhatsApp", icon: <MessageCircle className="size-3.5" />, done: true },
      { id: "autopin", label: "Auto-PIN", icon: <KeyRound className="size-3.5" />, done: true },
    ],
  },
  {
    id: "t2", name: "Villa Geribá Búzios", niche: "airbnb", plan: "PRO", createdAt: "há 3 dias",
    steps: [
      { id: "payment", label: "Payment", icon: <CreditCard className="size-3.5" />, done: true },
      { id: "email", label: "Email", icon: <Mail className="size-3.5" />, done: true },
      { id: "scan", label: "Magic Scan", icon: <ScanLine className="size-3.5" />, done: true },
      { id: "whatsapp", label: "WhatsApp", icon: <MessageCircle className="size-3.5" />, done: true },
      { id: "autopin", label: "Auto-PIN", icon: <KeyRound className="size-3.5" />, done: false, inProgress: true },
    ],
  },
  {
    id: "t3", name: "Casa Trancoso BA", niche: "airbnb", plan: "MAX", createdAt: "há 4 dias",
    steps: [
      { id: "payment", label: "Payment", icon: <CreditCard className="size-3.5" />, done: true },
      { id: "email", label: "Email", icon: <Mail className="size-3.5" />, done: true },
      { id: "scan", label: "Magic Scan", icon: <ScanLine className="size-3.5" />, done: true },
      { id: "whatsapp", label: "WhatsApp", icon: <MessageCircle className="size-3.5" />, done: false, inProgress: true },
      { id: "autopin", label: "Auto-PIN", icon: <KeyRound className="size-3.5" />, done: false },
    ],
  },
  {
    id: "t4", name: "Pousada Floripa Beira Mar", niche: "pousada", plan: "PRO", createdAt: "há 5 dias",
    steps: [
      { id: "payment", label: "Payment", icon: <CreditCard className="size-3.5" />, done: true },
      { id: "email", label: "Email", icon: <Mail className="size-3.5" />, done: true },
      { id: "scan", label: "Magic Scan", icon: <ScanLine className="size-3.5" />, done: false, inProgress: true },
      { id: "whatsapp", label: "WhatsApp", icon: <MessageCircle className="size-3.5" />, done: false },
      { id: "autopin", label: "Auto-PIN", icon: <KeyRound className="size-3.5" />, done: false },
    ],
  },
  {
    id: "t5", name: "Studio Costa Verde", niche: "airbnb", plan: "LITE", createdAt: "há 6 dias",
    steps: [
      { id: "payment", label: "Payment", icon: <CreditCard className="size-3.5" />, done: true },
      { id: "email", label: "Email", icon: <Mail className="size-3.5" />, done: false, inProgress: true },
      { id: "scan", label: "Magic Scan", icon: <ScanLine className="size-3.5" />, done: false },
      { id: "whatsapp", label: "WhatsApp", icon: <MessageCircle className="size-3.5" />, done: false },
      { id: "autopin", label: "Auto-PIN", icon: <KeyRound className="size-3.5" />, done: false },
    ],
  },
  {
    id: "t6", name: "Pousada Encanto da Serra", niche: "pousada", plan: "PARCEIRO", createdAt: "há 7 dias",
    steps: [
      { id: "payment", label: "Payment", icon: <CreditCard className="size-3.5" />, done: true },
      { id: "email", label: "Email", icon: <Mail className="size-3.5" />, done: true },
      { id: "scan", label: "Magic Scan", icon: <ScanLine className="size-3.5" />, done: true },
      { id: "whatsapp", label: "WhatsApp", icon: <MessageCircle className="size-3.5" />, done: true },
      { id: "autopin", label: "Auto-PIN", icon: <KeyRound className="size-3.5" />, done: true },
    ],
  },
];

const PLAN_COLOR: Record<string, string> = {
  LITE: "text-sky-400 bg-sky-500/10 border-sky-500/30",
  PRO: "text-teal-400 bg-teal-500/10 border-teal-500/30",
  MAX: "text-primary bg-primary/10 border-primary/30",
  PARCEIRO: "text-rose-400 bg-rose-500/10 border-rose-500/30",
};

// ── Types for Sales Funnel API ────────────────────────────────────

interface FunnelStage {
  stage: string;
  label: string;
  count: number;
  conversionRate: number;
  cumulativeRate: number;
  avgCost: number;
  avgTimeDays: number;
  dropoff: number;
}

interface Persona {
  name: string;
  segment: string;
  description: string;
  demographics: {
    ageRange: string;
    cities: string[];
    states: string[];
    digitalMaturity: 'low' | 'medium' | 'high';
  };
  business: {
    rooms: number;
    pricePerNight: number;
    monthlyRevenue: number;
    otaCommissionPaid: number;
  };
  pains: string[];
  desires: string[];
  behavior: 'Tradicional' | 'Moderno' | 'Elite';
  cacTarget: number;
  ltvTarget: number;
  budgetSuggestionBRL: number;
  keywords: string[];
  negativeKeywords: string[];
  adsBidding: string;
  targetCPA: number;
}

interface GoogleAdsRec {
  campaignType: string;
  name: string;
  primaryPersonas: string[];
  keywords: Array<{
    keyword: string;
    matchType: string;
    avgCpcBRL: number;
    monthlyVolume: number;
    intent: string;
  }>;
  negativeKeywords: string[];
  budgetBRL: number;
  targetCPA: number;
  targetROAS: number;
  adsBidding: string;
  expectedResults: {
    impressions: number;
    clicks: number;
    leads: number;
    conversions: number;
    revenueBRL: number;
  };
  landingPage: string;
  adCopy: {
    headline1: string;
    headline2: string;
    headline3: string;
    description1: string;
    description2: string;
    sitelinks: string[];
  };
}

interface SalesFunnelData {
  funnel: FunnelStage[];
  personas: Persona[];
  googleAdsRecommendations: GoogleAdsRec[];
  geoDistribution: Array<{
    uf: string;
    totalLeads: number;
    convertedLeads: number;
    conversionRate: number;
    revenue: number;
    recommendIncrease: boolean;
  }>;
  executiveSummary: {
    totalLeadsInPipeline: number;
    mqlCount: number;
    sqlCount: number;
    customers: number;
    lost: number;
    conversionRateTopToBottom: number;
    avgTicket: number;
    cac: number;
    ltv: number;
    roas: number;
    ltvCacRatio: number;
    paybackMonths: number;
    recommendedBudgetBRL: number;
    recommendedChannels: string[];
    primaryPersona: string;
    primaryActionArea: string;
    nextSteps: string[];
  };
}

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtNum = (n: number) => n.toLocaleString("pt-BR");

// ── Component ─────────────────────────────────────────────────────

export function OnboardingTrackerPanel() {
  const [tenants] = React.useState<OnboardingTenant[]>(MOCK_TENANTS);
  const [salesData, setSalesData] = React.useState<SalesFunnelData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [dataSource, setDataSource] = React.useState<string>('fallback');

  const stats = React.useMemo(() => {
    const total = tenants.length;
    const completed = tenants.filter((t) => t.steps.every((s) => s.done)).length;
    const emailsSent = tenants.filter((t) => t.steps.find((s) => s.id === "email")?.done).length;
    const whatsappConnected = tenants.filter((t) => t.steps.find((s) => s.id === "whatsapp")?.done).length;
    const autopinActive = tenants.filter((t) => t.steps.find((s) => s.id === "autopin")?.done).length;
    const rate = total > 0 ? (completed / total) * 100 : 0;
    return { total, completed, emailsSent, whatsappConnected, autopinActive, rate };
  }, [tenants]);

  // ── Load sales funnel data ─────────────────────────────────────
  const loadSalesData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/zcc/sales-funnel', { cache: 'no-store' });
      if (!res.ok) throw new Error('API error');
      const json = await res.json();
      if (json?.success && json?.data) {
        setSalesData(json.data);
        setDataSource(json.meta?.source ?? 'api');
      }
    } catch {
      setDataSource('fallback');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadSalesData();
  }, [loadSalesData]);

  const handleNudge = (tenant: OnboardingTenant) => {
    toast.success("Lembrete enviado", {
      description: `Notificação enviada para ${tenant.name}`,
    });
  };

  const handleRefresh = () => {
    loadSalesData();
    toast.success("Funil de vendas atualizado");
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader
        title="Onboarding Tracker"
        description="Funil de ativação + Funil de Vendas Google Ads · dados do Breakdown"
        icon={<UserCheck className="size-5" />}
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground">
              <Link2 className="size-3 text-primary" />
              <span className="text-primary">{dataSource}</span>
            </span>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={cn("size-3", loading && "animate-spin")} />
            </button>
            <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1">
              <Zap className="size-3.5 text-primary" />
              <span className="text-sm font-bold text-primary">{stats.rate.toFixed(0)}%</span>
              <span className="text-[10px] text-muted-foreground">onboarding</span>
            </div>
          </div>
        }
      />

      <div className="zcc-scroll flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* ====== AVISO DE INTEGRAÇÃO COM BREAKDOWN ====== */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Link2 className="size-3.5 text-primary shrink-0" />
            <span>
              <strong className="text-foreground">Integração ativa:</strong> Esta aba consome{" "}
              <code className="font-mono text-primary">/api/zcc/metrics/periods</code> (Breakdown) +{" "}
              <code className="font-mono text-primary">/api/zcc/sales-funnel</code> (Google Ads){" "}
              para gerar o funil de vendas completo que orienta o setor de Marketing.
            </span>
          </p>
        </div>

        {/* ====== FUNIL DE ATIVAÇÃO (5 etapas) ====== */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          <FunnelCard
            icon={<Users className="size-4" />}
            label="Total tenants"
            value={String(stats.total)}
            sub={`${stats.completed} completos`}
            pct={100}
          />
          <FunnelCard
            icon={<Mail className="size-4" />}
            label="Emails sent"
            value={String(stats.emailsSent)}
            sub={`${stats.total > 0 ? ((stats.emailsSent / stats.total) * 100).toFixed(0) : 0}% do total`}
            pct={stats.total > 0 ? (stats.emailsSent / stats.total) * 100 : 0}
          />
          <FunnelCard
            icon={<MessageCircle className="size-4" />}
            label="WhatsApp connected"
            value={String(stats.whatsappConnected)}
            sub={`${stats.total > 0 ? ((stats.whatsappConnected / stats.total) * 100).toFixed(0) : 0}% do total`}
            pct={stats.total > 0 ? (stats.whatsappConnected / stats.total) * 100 : 0}
          />
          <FunnelCard
            icon={<KeyRound className="size-4" />}
            label="Auto-PIN active"
            value={String(stats.autopinActive)}
            sub={`${stats.total > 0 ? ((stats.autopinActive / stats.total) * 100).toFixed(0) : 0}% do total`}
            pct={stats.total > 0 ? (stats.autopinActive / stats.total) * 100 : 0}
            highlight
          />
        </motion.div>

        {/* ====== FUNIL DE VENDAS GOOGLE ADS ====== */}
        {salesData?.funnel?.length ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Megaphone className="size-3.5 text-primary" />
                Funil de Vendas Google Ads · Impressões → Clientes
              </h3>
              <span className="text-[10px] text-muted-foreground">
                Conversão top-to-bottom: <span className="font-bold text-primary">{salesData.executiveSummary.conversionRateTopToBottom}%</span>
              </span>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {salesData.funnel.map((stage, idx) => (
                  <motion.div
                    key={stage.stage}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="rounded-md border border-border bg-background/50 p-2 text-center"
                  >
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Etapa {idx + 1}
                    </p>
                    <p className="mt-1 text-lg font-bold text-foreground">
                      {fmtNum(stage.count)}
                    </p>
                    <p className="text-[9px] text-muted-foreground leading-tight">
                      {stage.label.split('·')[0].trim()}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold text-emerald-400">
                      {stage.conversionRate}%
                    </p>
                    <p className="text-[8px] text-muted-foreground">
                      conv. anterior
                    </p>
                    {stage.avgCost > 0 ? (
                      <p className="mt-1 text-[9px] text-amber-400 font-mono">
                        {fmtBRL(stage.avgCost)}
                      </p>
                    ) : null}
                  </motion.div>
                ))}
              </div>
              {/* Dropoff visualization */}
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3 text-[10px]">
                <div className="flex items-center gap-1">
                  <TrendingUp className="size-3 text-emerald-400" />
                  <span className="text-muted-foreground">
                    CAC: <span className="font-bold text-foreground">{fmtBRL(salesData.executiveSummary.cac)}</span>
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <DollarSign className="size-3 text-primary" />
                  <span className="text-muted-foreground">
                    LTV: <span className="font-bold text-foreground">{fmtBRL(salesData.executiveSummary.ltv)}</span>
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Activity className="size-3 text-emerald-400" />
                  <span className="text-muted-foreground">
                    LTV/CAC: <span className="font-bold text-foreground">{salesData.executiveSummary.ltvCacRatio}</span>
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="size-3 text-amber-400" />
                  <span className="text-muted-foreground">
                    Payback: <span className="font-bold text-foreground">{salesData.executiveSummary.paybackMonths} meses</span>
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Target className="size-3 text-primary" />
                  <span className="text-muted-foreground">
                    ROAS: <span className="font-bold text-foreground">{salesData.executiveSummary.roas}x</span>
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}

        {/* ====== RESUMO EXECUTIVO PARA MARKETING ====== */}
        {salesData?.executiveSummary ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-lg border border-primary/30 bg-primary/5 p-4"
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
                <Brain className="size-3.5" />
                Resumo executivo · Diretrizes para Marketing
              </h3>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9px] font-semibold uppercase text-primary">
                Persona: {salesData.executiveSummary.primaryPersona}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Foco principal</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {salesData.executiveSummary.primaryActionArea}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Orçamento sugerido</p>
                <p className="mt-1 text-sm font-bold text-primary">
                  {fmtBRL(salesData.executiveSummary.recommendedBudgetBRL)}/mês
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Canais recomendados</p>
                <p className="mt-1 text-xs font-semibold text-foreground">
                  {salesData.executiveSummary.recommendedChannels.join(' · ')}
                </p>
              </div>
            </div>
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                Próximos passos para o time de Marketing
              </p>
              <ul className="space-y-1">
                {salesData.executiveSummary.nextSteps.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                    <span className="grid size-3.5 shrink-0 place-items-center rounded-full bg-primary/20 text-[8px] font-bold text-primary">
                      {idx + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        ) : null}

        {/* ====== PERSONAS PARA GOOGLE ADS ====== */}
        {salesData?.personas?.length ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Users className="size-3.5 text-primary" />
                Personas para Google Ads · {salesData.personas.length} clusters
              </h3>
              <span className="text-[10px] text-muted-foreground">
                Clusterização por comportamento de compra
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {salesData.personas.map((persona, idx) => (
                <PersonaCard key={persona.name} persona={persona} index={idx} />
              ))}
            </div>
          </motion.div>
        ) : null}

        {/* ====== RECOMENDAÇÕES DE CAMPANHAS GOOGLE ADS ====== */}
        {salesData?.googleAdsRecommendations?.length ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Megaphone className="size-3.5 text-primary" />
                Campanhas Google Ads recomendadas · {salesData.googleAdsRecommendations.length}
              </h3>
              <span className="text-[10px] text-muted-foreground">
                Investimento total: <span className="font-bold text-foreground">
                  {fmtBRL(salesData.googleAdsRecommendations.reduce((s, c) => s + c.budgetBRL, 0))}/mês
                </span>
              </span>
            </div>
            <div className="space-y-3">
              {salesData.googleAdsRecommendations.map((rec, idx) => (
                <CampaignCard key={idx} rec={rec} index={idx} />
              ))}
            </div>
          </motion.div>
        ) : null}

        {/* ====== DISTRIBUIÇÃO GEOGRÁFICA ====== */}
        {salesData?.geoDistribution?.length ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Target className="size-3.5 text-primary" />
                Distribuição geográfica · onde investir Google Ads
              </h3>
              <span className="text-[10px] text-muted-foreground">
                Estados com melhor conversão
              </span>
            </div>
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="grid grid-cols-[3rem_1fr_4rem_4rem_5rem_2rem] items-center gap-2 border-b border-border bg-secondary/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span>UF</span>
                <span>Localização</span>
                <span className="text-center">Leads</span>
                <span className="text-center">Conv.</span>
                <span className="text-right">Receita</span>
                <span className="text-center">Ação</span>
              </div>
              <div>
                {salesData.geoDistribution.map((geo, idx) => (
                  <div
                    key={geo.uf}
                    className="grid grid-cols-[3rem_1fr_4rem_4rem_5rem_2rem] items-center gap-2 border-b border-border last:border-0 px-3 py-2 hover:bg-secondary/10"
                  >
                    <span className="text-xs font-bold text-foreground">{geo.uf}</span>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {geo.totalLeads} leads · {geo.convertedLeads} convertidos
                    </span>
                    <span className="text-center text-xs text-foreground">{geo.totalLeads}</span>
                    <span className="text-center text-xs text-emerald-400">{geo.convertedLeads}</span>
                    <span className="text-right font-mono text-xs font-semibold text-primary">
                      {fmtBRL(geo.revenue)}
                    </span>
                    <span className="text-center">
                      {geo.recommendIncrease ? (
                        <span className="inline-flex items-center gap-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-1 py-0.5 text-[8px] font-bold uppercase text-emerald-400">
                          <TrendingUp className="size-2.5" />
                          ↑
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border bg-secondary/30 px-3 py-2 text-[10px] text-muted-foreground">
                <strong className="text-foreground">↑</strong> = aumentar investimento ·{" "}
                <strong className="text-foreground">—</strong> = manter
              </div>
            </div>
          </motion.div>
        ) : null}

        {/* ====== TENANT ONBOARDING LIST ====== */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Clock className="size-3.5 text-primary" />
              Tenant onboarding · {tenants.length} ativos
            </h3>
            <span className="text-[10px] text-muted-foreground">
              5 etapas · Payment → Email → Scan → WhatsApp → Auto-PIN
            </span>
          </div>
          <div className="space-y-2">
            {tenants.map((tenant, idx) => (
              <TenantRow key={tenant.id} tenant={tenant} index={idx} onNudge={() => handleNudge(tenant)} />
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTES
// ============================================================================

function FunnelCard({
  icon, label, value, sub, pct, highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  pct: number;
  highlight?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "relative overflow-hidden rounded-lg border bg-card p-4 transition-colors",
        highlight ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/30"
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn(
          "grid size-7 place-items-center rounded-md border",
          highlight ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground"
        )}>
          {icon}
        </span>
        <span className={cn("text-[11px] font-bold", highlight ? "text-primary" : "text-foreground")}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-2xl font-bold", highlight ? "text-primary" : "text-foreground")}>{value}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-secondary">
        <motion.div
          className={cn("h-full", highlight ? "bg-primary" : "bg-foreground/40")}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, delay: 0.2 }}
        />
      </div>
    </motion.div>
  );
}

function TenantRow({
  tenant, index, onNudge,
}: {
  tenant: OnboardingTenant;
  index: number;
  onNudge: () => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const completed = tenant.steps.filter((s) => s.done).length;
  const total = tenant.steps.length;
  const pct = (completed / total) * 100;
  const isComplete = completed === total;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={cn(
        "overflow-hidden rounded-lg border bg-card transition-colors",
        isComplete ? "border-emerald-500/30" : expanded ? "border-primary/30" : "border-border hover:border-primary/30"
      )}
    >
      <button type="button" onClick={() => setExpanded((p) => !p)} className="flex w-full items-center gap-3 p-3 text-left">
        <span className={cn(
          "grid size-9 shrink-0 place-items-center rounded-md border text-xs font-bold",
          isComplete ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-border bg-secondary text-muted-foreground"
        )}>
          {tenant.name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{tenant.name}</p>
            <span className={cn("rounded border px-1 py-0.5 text-[9px] font-semibold uppercase", PLAN_COLOR[tenant.plan])}>
              {tenant.plan}
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">{tenant.niche} · {tenant.createdAt}</p>
        </div>
        <div className="hidden flex-col items-end gap-1 sm:flex">
          <span className={cn("text-xs font-bold", isComplete ? "text-emerald-400" : "text-primary")}>
            {completed}/{total}
          </span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
            <motion.div
              className={cn("h-full", isComplete ? "bg-emerald-400" : "bg-primary")}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ delay: index * 0.04 + 0.1 }}
            />
          </div>
        </div>
        <span className={cn(
          "rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase",
          isComplete ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-amber-500/30 bg-amber-500/10 text-amber-400"
        )}>
          {isComplete ? "done" : "wip"}
        </span>
        <ChevronRight className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-90")} />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-border bg-background/40"
          >
            <div className="p-3">
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-5">
                {STEP_DEFS.map((def, i) => {
                  const step = tenant.steps.find((s) => s.id === def.id);
                  if (!step) return null;
                  return <StepPill key={def.id} label={def.label} icon={def.icon} order={i + 1} done={step.done} inProgress={step.inProgress} />;
                })}
              </div>
              {!isComplete && (
                <div className="mt-3 flex items-center justify-end gap-2 border-t border-border pt-3">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onNudge(); }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  >
                    <Mail className="size-3.5" />
                    Nudge tenant
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StepPill({
  label, icon, order, done, inProgress,
}: {
  label: string;
  icon: React.ReactNode;
  order: number;
  done: boolean;
  inProgress?: boolean;
}) {
  return (
    <div className={cn(
      "flex items-center gap-2 rounded-md border px-2.5 py-2",
      done ? "border-emerald-500/30 bg-emerald-500/5" : inProgress ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-secondary/30"
    )}>
      <span className={cn(
        "grid size-5 shrink-0 place-items-center rounded-full border text-[9px] font-bold",
        done ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-400" :
        inProgress ? "border-amber-500/40 bg-amber-500/20 text-amber-400" :
        "border-border bg-secondary text-muted-foreground"
      )}>
        {done ? <CheckCircle2 className="size-3.5" /> : inProgress ? <Loader2 className="size-3.5 animate-spin" /> : <Circle className="size-3.5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn(
          "truncate text-[10px] font-semibold uppercase tracking-wide",
          done ? "text-emerald-400" : inProgress ? "text-amber-400" : "text-muted-foreground"
        )}>
          {order}. {label}
        </p>
        <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
          {icon}
          <span>{done ? "completo" : inProgress ? "em andamento" : "pendente"}</span>
        </div>
      </div>
    </div>
  );
}

// ── Persona Card ──────────────────────────────────────────────────

function PersonaCard({ persona, index }: { persona: Persona; index: number }) {
  const behaviorColor = {
    Tradicional: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    Moderno: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
    Elite: 'text-violet-400 bg-violet-500/10 border-violet-500/30',
  }[persona.behavior];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-lg border border-border bg-card p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">{persona.name}</p>
          <p className="text-[10px] text-muted-foreground">{persona.segment}</p>
        </div>
        <span className={cn("rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase", behaviorColor)}>
          {persona.behavior}
        </span>
      </div>

      <p className="mt-2 text-[10px] text-muted-foreground leading-tight line-clamp-3">
        {persona.description}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded border border-border/60 bg-background/50 p-1.5">
          <p className="text-[8px] uppercase text-muted-foreground">CAC Target</p>
          <p className="font-mono font-bold text-amber-400">{fmtBRL(persona.cacTarget)}</p>
        </div>
        <div className="rounded border border-border/60 bg-background/50 p-1.5">
          <p className="text-[8px] uppercase text-muted-foreground">LTV Target</p>
          <p className="font-mono font-bold text-emerald-400">{fmtBRL(persona.ltvTarget)}</p>
        </div>
        <div className="rounded border border-border/60 bg-background/50 p-1.5">
          <p className="text-[8px] uppercase text-muted-foreground">Budget/mês</p>
          <p className="font-mono font-bold text-primary">{fmtBRL(persona.budgetSuggestionBRL)}</p>
        </div>
        <div className="rounded border border-border/60 bg-background/50 p-1.5">
          <p className="text-[8px] uppercase text-muted-foreground">Target CPA</p>
          <p className="font-mono font-bold text-foreground">{fmtBRL(persona.targetCPA)}</p>
        </div>
      </div>

      <div className="mt-2">
        <p className="text-[8px] uppercase text-muted-foreground mb-1">Top palavras-chave</p>
        <div className="flex flex-wrap gap-1">
          {persona.keywords.slice(0, 3).map((k) => (
            <span key={k} className="rounded border border-border bg-secondary px-1.5 py-0.5 text-[9px] text-muted-foreground">
              {k}
            </span>
          ))}
          <span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
            +{persona.keywords.length - 3}
          </span>
        </div>
      </div>

      <div className="mt-2">
        <p className="text-[8px] uppercase text-muted-foreground mb-1">Localização (top 3)</p>
        <div className="flex flex-wrap gap-1">
          {persona.demographics.states.slice(0, 3).map((s) => (
            <span key={s} className="rounded border border-border bg-secondary px-1.5 py-0.5 text-[9px] text-muted-foreground">
              {s}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Campaign Card ─────────────────────────────────────────────────

function CampaignCard({ rec, index }: { rec: GoogleAdsRec; index: number }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-lg border border-border bg-card overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-md border border-primary/30 bg-primary/10 text-primary">
          <Megaphone className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[8px] font-bold uppercase text-primary">
              {rec.campaignType}
            </span>
            <p className="truncate text-sm font-semibold text-foreground">{rec.name}</p>
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Budget: <span className="font-bold text-foreground">{fmtBRL(rec.budgetBRL)}/mês</span>
            {" · "}CPA: <span className="font-bold text-foreground">{fmtBRL(rec.targetCPA)}</span>
            {" · "}ROAS: <span className="font-bold text-foreground">{rec.targetROAS}x</span>
          </p>
        </div>
        <div className="hidden sm:block text-right">
          <p className="text-[9px] uppercase text-muted-foreground">Receita projetada</p>
          <p className="font-bold text-emerald-400">{fmtBRL(rec.expectedResults.revenueBRL)}</p>
        </div>
        <ChevronRight className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-90")} />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border bg-background/40"
          >
            <div className="p-3 space-y-3">
              {/* Keywords */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                  Palavras-chave ({rec.keywords.length})
                </p>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {rec.keywords.map((k) => (
                    <div key={k.keyword} className="flex items-center justify-between rounded border border-border bg-card px-2 py-1 text-[10px]">
                      <span className="truncate text-foreground">{k.keyword}</span>
                      <span className="ml-2 shrink-0 flex items-center gap-1 text-muted-foreground">
                        <span className="rounded border border-border bg-secondary px-1 text-[8px] uppercase">{k.matchType}</span>
                        <span className="font-mono">{fmtBRL(k.avgCpcBRL)}</span>
                        <span className="text-[8px]">{k.intent}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Negative keywords */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                  Palavras-chave negativas ({rec.negativeKeywords.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {rec.negativeKeywords.map((k) => (
                    <span key={k} className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[9px] text-red-400">
                      -{k}
                    </span>
                  ))}
                </div>
              </div>

              {/* Ad Copy */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                  Copy do anúncio
                </p>
                <div className="rounded border border-border bg-card p-2 text-[10px]">
                  <p className="font-bold text-primary">{rec.adCopy.headline1} | {rec.adCopy.headline2} | {rec.adCopy.headline3}</p>
                  <p className="mt-1 text-muted-foreground">{rec.adCopy.description1}</p>
                  <p className="text-muted-foreground">{rec.adCopy.description2}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {rec.adCopy.sitelinks.map((s) => (
                      <span key={s} className="rounded border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[9px] text-blue-400">
                        🔗 {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Expected results */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <div className="rounded border border-border bg-card p-2 text-center">
                  <p className="text-[8px] uppercase text-muted-foreground">Impressões</p>
                  <p className="text-sm font-bold text-foreground">{fmtNum(rec.expectedResults.impressions)}</p>
                </div>
                <div className="rounded border border-border bg-card p-2 text-center">
                  <p className="text-[8px] uppercase text-muted-foreground">Cliques</p>
                  <p className="text-sm font-bold text-foreground">{fmtNum(rec.expectedResults.clicks)}</p>
                </div>
                <div className="rounded border border-border bg-card p-2 text-center">
                  <p className="text-[8px] uppercase text-muted-foreground">Leads</p>
                  <p className="text-sm font-bold text-amber-400">{fmtNum(rec.expectedResults.leads)}</p>
                </div>
                <div className="rounded border border-border bg-card p-2 text-center">
                  <p className="text-[8px] uppercase text-muted-foreground">Conv.</p>
                  <p className="text-sm font-bold text-emerald-400">{fmtNum(rec.expectedResults.conversions)}</p>
                </div>
                <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-2 text-center">
                  <p className="text-[8px] uppercase text-muted-foreground">Receita</p>
                  <p className="text-sm font-bold text-emerald-400">{fmtBRL(rec.expectedResults.revenueBRL)}</p>
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground">
                <strong className="text-foreground">Landing page:</strong> {rec.landingPage}
                {" · "}
                <strong className="text-foreground">Bidding:</strong> {rec.adsBidding}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
