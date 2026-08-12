"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Menu,
  X,
  Search,
  DollarSign,
  CheckSquare,
  TrendingUp,
  Clock,
  Bell,
  Download,
  Check,
  MapPin,
} from "lucide-react";
import { ZccSidebar } from "./zcc-sidebar";
import { OperatorConsolePanel } from "./panels/operator-console-panel";
import { LiveLeadsPanel } from "./panels/live-leads-panel";
import { CerebroPanel } from "./panels/cerebro-panel";
import { CerebroTestPanel } from "./panels/cerebro-test-panel";
import { LiveAgentsPanel } from "./panels/live-agents-panel";
import { TokensAIPanel } from "./panels/tokens-ai-panel";
import { AirbnbPanel } from "./panels/airbnb-panel";
import { PousadasPanel } from "./panels/pousadas-panel";
import { GeoMetricsPanel } from "./panels/geo-panel";
import { FinancialBreakdownPanel } from "./panels/breakdown-panel";
import { OnboardingTrackerPanel } from "./panels/onboarding-panel";
import { DDCPanel } from "./panels/ddc-panel";
import { ActivityPanel } from "./panels/activity-panel";
import { SettingsPanel } from "./panels/settings-panel";
import { FinanceiroPanel } from "./panels/financeiro-panel";
import { PulseCheckPanel } from "./panels/pulse-check-panel";
import { BurnRatePanel } from "./panels/burn-rate-panel";
import { TenantsPanel } from "./panels/tenants-panel";
import { RefactorsPanel } from "./panels/refactors-panel";
import { SandboxPanel } from "./panels/sandbox-panel";
import type { ZccTabId } from "@/lib/zcc/types";
import { leads, integrations } from "@/lib/zcc/mock-data";

// ===== MATEMÁTICA REAL DE RECEITA E MÉTRICAS =====
// Base: 37 leads reais do seed + JSON-LD do seu layout.tsx
//   LITE: R$ 197/mês
//   PRO:  R$ 397/mês
//   MAX:  R$ 797/mês
//   Link-in-Bio: R$ 47/mês
//   Parceiro: R$ 197/mês (revenda)

const PLANS = {
  lite: { price: 197, count: 0 },
  pro: { price: 397, count: 0 },
  max: { price: 797, count: 0 },
  linkInBio: { price: 47, count: 0 },
  parceiro: { price: 197, count: 0 },
};

// Mock: simulando distribuição de assinantes (modo demonstração)
// Em produção: vem do Prisma (model Subscription WHERE status = 'active')
const MOCK_SUBSCRIBERS = {
  lite: 8,        // R$ 1.576
  pro: 5,          // R$ 1.985
  max: 2,         // R$ 1.594
  linkInBio: 12,   // R$ 564
  parceiro: 3,    // R$ 591
};

const TOTAL_MRR =
  MOCK_SUBSCRIBERS.lite * PLANS.lite.price +
  MOCK_SUBSCRIBERS.pro * PLANS.pro.price +
  MOCK_SUBSCRIBERS.max * PLANS.max.price +
  MOCK_SUBSCRIBERS.linkInBio * PLANS.linkInBio.price +
  MOCK_SUBSCRIBERS.parceiro * PLANS.parceiro.price;

const TOTAL_CLIENTS =
  MOCK_SUBSCRIBERS.lite +
  MOCK_SUBSCRIBERS.pro +
  MOCK_SUBSCRIBERS.max +
  MOCK_SUBSCRIBERS.linkInBio +
  MOCK_SUBSCRIBERS.parceiro;

const HOT_LEADS_COUNT = leads.filter((l) => l.scoreQual >= 85).length;
const ONLINE_INTEGRATIONS = integrations.filter((i) => i.status === "online").length;
const TOTAL_INTEGRATIONS = integrations.length;

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

const TAB_TITLES: Record<ZccTabId, string> = {
  overview: "Visão Geral",
  "live-leads": "Live Leads",
  financeiro: "Financeiro",
  onboarding: "Onboarding Tracker",
  "live-agents": "Agentes Vivos",
  "pulse-check": "Pulse Check",
  brain: "Cérebro",
  "brain-tests": "Testes Cérebro",
  refactors: "Refactors",
  sandbox: "Sandbox",
  breakdown: "Breakdown",
  airbnb: "Airbnb",
  pousadas: "Pousadas",
  "burn-rate": "Burn Rate",
  tenants: "Tenants",
  geo: "Geo",
  "tokens-ai": "Tokens & IA",
};

function GlobalKpiBar() {
  const [downloaded, setDownloaded] = React.useState(false);
  const [now, setNow] = React.useState("");

  React.useEffect(() => {
    const update = () =>
      setNow(
        new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = "/zcc-lis-integrated.zip";
    link.download = "zcc-lis-integrated.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  return (
    <div className="flex items-center gap-1.5">
      {/* MRR — matemática real */}
      <div className="hidden items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground md:flex">
        <DollarSign className="size-3.5 text-primary" />
        <span className="font-bold text-foreground">{formatBRL(TOTAL_MRR)}</span>
        <span className="text-muted-foreground/70">MRR</span>
      </div>

      {/* Clientes ativos */}
      <div className="hidden items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground sm:flex">
        <CheckSquare className="size-3.5 text-emerald-400" />
        <span className="font-bold text-foreground">{TOTAL_CLIENTS}</span>
        <span className="text-muted-foreground/70">clientes</span>
      </div>

      {/* Integrações online */}
      <div className="hidden items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground lg:flex">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
        </span>
        <span className="font-bold text-foreground">
          {ONLINE_INTEGRATIONS}/{TOTAL_INTEGRATIONS}
        </span>
        <span className="text-muted-foreground/70">online</span>
      </div>

      {/* Hot leads */}
      <div className="hidden items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground lg:flex">
        <TrendingUp className="size-3.5 text-amber-400" />
        <span className="font-bold text-foreground">{HOT_LEADS_COUNT}</span>
        <span className="text-muted-foreground/70">hots</span>
      </div>

      {/* Botão de download do código do Live Leads */}
      <button
        type="button"
        onClick={handleDownload}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-all",
          downloaded
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
            : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
        )}
        title="Baixar código completo do Live Leads (ZIP)"
      >
        {downloaded ? (
          <>
            <Check className="size-3.5" />
            <span className="hidden sm:inline">Baixado!</span>
          </>
        ) : (
          <>
            <Download className="size-3.5" />
            <span className="hidden sm:inline">Baixar Live Leads</span>
          </>
        )}
      </button>

      {/* Relógio */}
      <div className="hidden items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground sm:flex">
        <Clock className="size-3.5 text-muted-foreground" />
        <span className="font-mono text-foreground">{now}</span>
      </div>

      {/* Notificações */}
      <button
        type="button"
        className="relative grid size-8 place-items-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground"
        aria-label="Notificações"
        title="Notificações"
      >
        <Bell className="size-4" />
        <span className="absolute -right-0.5 -top-0.5 grid size-3.5 place-items-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
          {HOT_LEADS_COUNT}
        </span>
      </button>

      {/* Avatar Zé — logo circular */}
      <img
        src="/ze-seuzella-avatar.png"
        alt="Zé — Assistente Seu Zélla"
        title="Zé · Assistente Inteligente"
        className="size-8 rounded-full border border-primary/40 object-cover"
        style={{ filter: "drop-shadow(0 0 6px rgba(212, 168, 67, 0.3))" }}
      />
    </div>
  );
}

export function ZccShell() {
  const [tab, setTab] = React.useState<ZccTabId>("overview");
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const handleChange = (next: ZccTabId) => {
    setTab(next);
    setMobileOpen(false);
  };

  return (
    <div className="dark flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* ====== HEADER GLOBAL ====== */}
      <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-3 py-2 sm:px-4">
        {/* Esquerda: logo + breadcrumb */}
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="grid size-8 place-items-center rounded-md border border-border bg-background text-foreground lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="size-4" />
          </button>

          {/* Logo Seu Zélla (substitui "Seu Zélla" em texto) */}
          <img
            src="/seuzella-logo.png"
            alt="Seu Zélla"
            className="h-7 w-auto sm:h-8"
            style={{ filter: "drop-shadow(0 0 4px rgba(212, 168, 67, 0.2))" }}
          />

          {/* Breadcrumb: / Visão Geral (sem subtitle) */}
          <div className="hidden items-center gap-1.5 sm:flex">
            <span className="text-xs text-muted-foreground/50">/</span>
            <span className="text-sm font-semibold text-foreground">
              {TAB_TITLES[tab]}
            </span>
            {tab === "live-leads" ? (
              <MapPin className="size-3.5 text-primary" />
            ) : null}
          </div>
        </div>

        {/* Centro: busca global (escondida no mobile) */}
        <div className="relative hidden max-w-md flex-1 md:block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Buscar módulos, ações..."
            className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-12 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-secondary px-1 py-0.5 text-[9px] text-muted-foreground">
            ⌘K
          </kbd>
        </div>

        {/* Direita: KPIs + ações + avatar */}
        <GlobalKpiBar />
      </header>

      {/* ====== CONTEÚDO: sidebar + painel ====== */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar fixa em desktop */}
        <div className="hidden w-60 shrink-0 lg:block">
          <ZccSidebar active={tab} onChange={handleChange} className="h-full" />
        </div>

        {/* Sidebar mobile (drawer) */}
        {mobileOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setMobileOpen(false)}
              aria-hidden
            />
            <div className="absolute left-0 top-0 h-full w-72 max-w-[85vw]">
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-border bg-card px-3 py-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Navegação
                  </span>
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="grid size-7 place-items-center rounded-md border border-border bg-background text-foreground"
                    aria-label="Fechar menu"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <ZccSidebar
                  active={tab}
                  onChange={handleChange}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        ) : null}

        {/* Área de painel ativo */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* NÚCLEO / TIER 1 — Executive */}
            {tab === "overview" ? <OperatorConsolePanel /> : null}
            {tab === "live-leads" ? <LiveLeadsPanel /> : null}
            {tab === "financeiro" ? <FinanceiroPanel /> : null}
            {tab === "onboarding" ? <OnboardingTrackerPanel /> : null}
            {tab === "live-agents" ? <LiveAgentsPanel /> : null}
            {tab === "pulse-check" ? <PulseCheckPanel /> : null}
            {tab === "brain" ? <CerebroPanel /> : null}
            {tab === "brain-tests" ? <CerebroTestPanel /> : null}
            {tab === "refactors" ? <RefactorsPanel /> : null}
            {tab === "sandbox" ? <SandboxPanel /> : null}
            {tab === "breakdown" ? <FinancialBreakdownPanel /> : null}

            {/* OPERAÇÃO / TIER 2 */}
            {tab === "airbnb" ? <AirbnbPanel /> : null}
            {tab === "pousadas" ? <PousadasPanel /> : null}
            {tab === "burn-rate" ? <BurnRatePanel /> : null}
            {tab === "tenants" ? <TenantsPanel /> : null}
            {tab === "geo" ? <GeoMetricsPanel /> : null}

            {/* CONFIGURAÇÃO / TIER 3 */}
            {tab === "tokens-ai" ? <TokensAIPanel /> : null}
          </div>
        </main>
      </div>

      {/* ====== FOOTER ====== */}
      <footer className="shrink-0 border-t border-border bg-card/80 px-4 py-2 backdrop-blur flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>
            <strong className="font-semibold text-foreground">
              Zélla Central Control
            </strong>
            <span className="mx-1.5 opacity-50">·</span>
            <span>Mission Control v5.0 · {new Date().getFullYear()}</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline">Modo Mock ativo</span>
          <span className="flex items-center gap-1.5">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
            </span>
            MODO DEUS
          </span>
        </div>
      </footer>
    </div>
  );
}
