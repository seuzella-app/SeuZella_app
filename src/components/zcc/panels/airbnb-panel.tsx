"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, Star, MessageSquare, TrendingUp, Calendar,
  Shield, Zap, Clock, Users, ChevronRight, ChevronDown,
  Brain, Wifi, WifiOff, CheckCircle2, AlertCircle,
  DollarSign, Link2, Loader2, Phone, Database, Lock,
  Eye, Webhook, ExternalLink, BedDouble,
} from "lucide-react";
import { PanelHeader } from "../shared/panel-header";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/*
 * AirbnbPanel — baseado no AirbnbPanel.tsx real do projeto.
 *
 * Features:
 *   - Lista de hosts com plan (PRO/MAX), status (ACTIVE/ONBOARDING/TRIAL)
 *   - Brain status (learning/calibrated/optimizing)
 *   - OAuth connection (POST /api/zcc/airbnb/oauth)
 *   - Webhook simulation (POST /api/zcc/airbnb/webhook)
 *   - Consent management (LGPD)
 *   - Sort by: name, plan, properties, bookings, revenue, responseRate, conversion, brainAccuracy
 */

interface AirbnbHost {
  id: string;
  name: string;
  plan: "pro" | "max";
  status: "ACTIVE" | "ONBOARDING" | "TRIAL";
  brainStatus: "learning" | "calibrated" | "optimizing";
  brainAccuracy: number;
  properties: number;
  bookings: number;
  revenue: number;
  responseRate: number;
  conversion: number;
  lastActive: string;
}

const MOCK_HOSTS: AirbnbHost[] = [
  { id: "h1", name: "Villa Geribá Búzios", plan: "max", status: "ACTIVE", brainStatus: "optimizing", brainAccuracy: 94, properties: 3, bookings: 47, revenue: 18400, responseRate: 98, conversion: 32, lastActive: "há 2h" },
  { id: "h2", name: "Casa Trancoso BA", plan: "max", status: "ACTIVE", brainStatus: "calibrated", brainAccuracy: 91, properties: 2, bookings: 31, revenue: 12700, responseRate: 96, conversion: 28, lastActive: "há 1h" },
  { id: "h3", name: "Studio Costa Verde", plan: "pro", status: "ACTIVE", brainStatus: "optimizing", brainAccuracy: 88, properties: 1, bookings: 24, revenue: 6800, responseRate: 94, conversion: 25, lastActive: "há 30min" },
  { id: "h4", name: "Loft Jardins Premium", plan: "pro", status: "ONBOARDING", brainStatus: "learning", brainAccuracy: 0, properties: 1, bookings: 0, revenue: 0, responseRate: 0, conversion: 0, lastActive: "há 3d" },
  { id: "h5", name: "Airbnb Design Studio", plan: "pro", status: "ACTIVE", brainStatus: "calibrated", brainAccuracy: 85, properties: 1, bookings: 19, revenue: 5400, responseRate: 92, conversion: 22, lastActive: "há 5h" },
];

const PLAN_CONFIG = {
  pro: { label: "PRO", color: "text-violet-400 bg-violet-500/15 border-violet-500/30" },
  max: { label: "MAX", color: "text-amber-400 bg-amber-500/15 border-amber-500/30" },
};

const STATUS_CONFIG = {
  ACTIVE: { label: "Ativo", color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30" },
  ONBOARDING: { label: "Onboarding", color: "text-amber-400 bg-amber-500/15 border-amber-500/30" },
  TRIAL: { label: "Trial", color: "text-slate-400 bg-slate-500/15 border-slate-500/30" },
};

const BRAIN_CONFIG = {
  learning: { label: "Aprendendo", icon: WifiOff, color: "text-amber-400" },
  calibrated: { label: "Calibrado", icon: Wifi, color: "text-cyan-400" },
  optimizing: { label: "Otimizando", icon: Brain, color: "text-emerald-400" },
};

type SortKey = "name" | "plan" | "properties" | "bookings" | "revenue" | "responseRate" | "conversion" | "brainAccuracy";

export function AirbnbPanel() {
  const [hosts] = React.useState<AirbnbHost[]>(MOCK_HOSTS);
  const [sortKey, setSortKey] = React.useState<SortKey>("revenue");
  const [sortAsc, setSortAsc] = React.useState(false);
  const [selectedHost, setSelectedHost] = React.useState<AirbnbHost | null>(null);
  const [devToolsOpen, setDevToolsOpen] = React.useState(false);

  // OAuth state
  const [oauthLoading, setOauthLoading] = React.useState(false);
  const [oauthResult, setOauthResult] = React.useState<{ importedCount: number; expiresAt: string } | null>(null);

  // Webhook state
  const [webhookLoading, setWebhookLoading] = React.useState(false);
  const [webhookResult, setWebhookResult] = React.useState<{ id: string; eventType: string } | null>(null);

  const handleOAuth = async () => {
    setOauthLoading(true);
    try {
      // Em produção: POST /api/zcc/airbnb/oauth
      setTimeout(() => {
        setOauthResult({ importedCount: 3, expiresAt: "2026-09-11" });
        toast.success("OAuth conectado! 3 propriedades importadas");
      }, 1200);
    } finally {
      setOauthLoading(false);
    }
  };

  const handleWebhook = async () => {
    setWebhookLoading(true);
    try {
      // Em produção: POST /api/zcc/airbnb/webhook
      setTimeout(() => {
        setWebhookResult({ id: `evt-${Date.now()}`, eventType: "reservation.created" });
        toast.success("Webhook recebido! Reserva simulada criada");
      }, 800);
    } finally {
      setWebhookLoading(false);
    }
  };

  const sorted = React.useMemo(() => {
    const arr = [...hosts];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else cmp = (a[sortKey] as number) - (b[sortKey] as number);
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [hosts, sortKey, sortAsc]);

  const totalRevenue = hosts.reduce((s, h) => s + h.revenue, 0);
  const totalBookings = hosts.reduce((s, h) => s + h.bookings, 0);
  const totalProperties = hosts.reduce((s, h) => s + h.properties, 0);
  const avgBrainAccuracy = Math.round(hosts.reduce((s, h) => s + h.brainAccuracy, 0) / hosts.length);

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader
        title="Airbnb · Anfitriões & Imóveis"
        description={`${hosts.length} hosts · ${totalProperties} propriedades · ${totalBookings} reservas · MRR ${totalRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}`}
        icon={<Home className="size-5" />}
        actions={
          <>
            {/* OAuth */}
            <button
              onClick={handleOAuth}
              disabled={oauthLoading}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                oauthResult
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
              )}
            >
              {oauthLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
              {oauthResult ? "OAuth Ativo" : "Conectar OAuth"}
            </button>
            <a
              href="/ddc/airbnb"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/70"
            >
              <ExternalLink className="size-3.5" />
              DDC Airbnb
            </a>
          </>
        }
      />

      <div className="zcc-scroll flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Hosts ativos" value={hosts.filter(h => h.status === "ACTIVE").length} hint={`${hosts.length} total`} icon={<Users />} />
          <KpiCard label="Propriedades" value={totalProperties} icon={<Home />} />
          <KpiCard label="Reservas (total)" value={totalBookings} icon={<Calendar />} />
          <KpiCard label="Brain Accuracy" value={`${avgBrainAccuracy}%`} hint="média dos hosts" icon={<Brain />} tone="primary" />
        </div>

        {/* OAuth + Webhook results */}
        {oauthResult ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="size-4" />
              <strong>OAuth conectado!</strong>
              <span className="text-muted-foreground">
                {oauthResult.importedCount} propriedades importadas · expira em {oauthResult.expiresAt}
              </span>
            </div>
          </div>
        ) : null}

        {/* Dev Tools (OAuth + Webhook simulation) */}
        <div className="rounded-lg border border-border bg-card p-3">
          <button
            onClick={() => setDevToolsOpen(!devToolsOpen)}
            className="flex w-full items-center justify-between text-xs font-semibold text-foreground"
          >
            <span className="flex items-center gap-2">
              <Zap className="size-3.5 text-amber-400" />
              Dev Tools · OAuth + Webhook (simulação)
            </span>
            <ChevronDown className={cn("size-4 transition-transform", devToolsOpen && "rotate-180")} />
          </button>
          <AnimatePresence>
            {devToolsOpen ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    onClick={handleOAuth}
                    disabled={oauthLoading}
                    className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20"
                  >
                    {oauthLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
                    Disparar OAuth
                  </button>
                  <button
                    onClick={handleWebhook}
                    disabled={webhookLoading}
                    className="flex items-center gap-2 rounded-md border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-400 hover:bg-violet-500/20"
                  >
                    {webhookLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Webhook className="size-3.5" />}
                    Simular Webhook
                  </button>
                </div>
                {webhookResult ? (
                  <div className="mt-2 rounded-md border border-violet-500/20 bg-violet-500/5 p-2 text-[11px] text-violet-300">
                    <Webhook className="mr-1 inline size-3" />
                    Evento <code className="font-mono">{webhookResult.id}</code> · tipo:{" "}
                    <strong>{webhookResult.eventType}</strong>
                  </div>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Host table */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-2 border-b border-border bg-secondary/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <th className="cursor-pointer hover:text-foreground" onClick={() => { setSortKey("name"); setSortAsc(!sortAsc); }}>Host</th>
            <th className="cursor-pointer hover:text-foreground" onClick={() => { setSortKey("plan"); setSortAsc(!sortAsc); }}>Plano</th>
            <th className="cursor-pointer hover:text-foreground text-center" onClick={() => { setSortKey("properties"); setSortAsc(!sortAsc); }}>Props</th>
            <th className="cursor-pointer hover:text-foreground text-center" onClick={() => { setSortKey("bookings"); setSortAsc(!sortAsc); }}>Reservas</th>
            <th className="cursor-pointer hover:text-foreground text-right" onClick={() => { setSortKey("revenue"); setSortAsc(!sortAsc); }}>Receita</th>
            <th className="cursor-pointer hover:text-foreground text-center" onClick={() => { setSortKey("brainAccuracy"); setSortAsc(!sortAsc); }}>Brain</th>
          </div>
          {sorted.map((host) => {
            const planCfg = PLAN_CONFIG[host.plan];
            const statusCfg = STATUS_CONFIG[host.status];
            const brainCfg = BRAIN_CONFIG[host.brainStatus];
            const BrainIcon = brainCfg.icon;
            return (
              <div
                key={host.id}
                onClick={() => setSelectedHost(host)}
                className={cn(
                  "grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-2 border-b border-border px-3 py-2 last:border-0 cursor-pointer transition-colors",
                  selectedHost?.id === host.id ? "bg-primary/10" : "hover:bg-secondary/20"
                )}
              >
                {/* Name + status */}
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground">{host.name}</p>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("rounded border px-1 py-0.5 text-[8px] font-bold uppercase", statusCfg.color)}>
                      {statusCfg.label}
                    </span>
                    <span className="text-[9px] text-muted-foreground">{host.lastActive}</span>
                  </div>
                </div>
                {/* Plan */}
                <div>
                  <span className={cn("rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase", planCfg.color)}>
                    {planCfg.label}
                  </span>
                </div>
                {/* Properties */}
                <div className="text-center text-xs text-foreground">{host.properties}</div>
                {/* Bookings */}
                <div className="text-center text-xs text-foreground">{host.bookings}</div>
                {/* Revenue */}
                <div className="text-right text-xs font-semibold text-emerald-400">
                  {host.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                </div>
                {/* Brain */}
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <BrainIcon className={cn("size-3", brainCfg.color)} />
                    <span className={cn("text-xs font-bold", brainCfg.color)}>
                      {host.brainAccuracy > 0 ? `${host.brainAccuracy}%` : "—"}
                    </span>
                  </div>
                  <span className="text-[8px] text-muted-foreground">{brainCfg.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected host details */}
        <AnimatePresence>
          {selectedHost ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-lg border border-primary/30 bg-primary/5 p-4"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-sm font-bold text-foreground">{selectedHost.name}</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Plano {selectedHost.plan.toUpperCase()} · {selectedHost.properties} propriedade(s) · {selectedHost.status}
                  </p>
                </div>
                <button onClick={() => setSelectedHost(null)} className="text-muted-foreground hover:text-foreground">
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="rounded border border-border bg-background p-2">
                  <p className="text-[10px] text-muted-foreground">Receita total</p>
                  <p className="text-sm font-bold text-emerald-400">
                    {selectedHost.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="rounded border border-border bg-background p-2">
                  <p className="text-[10px] text-muted-foreground">Taxa de resposta</p>
                  <p className="text-sm font-bold text-foreground">{selectedHost.responseRate}%</p>
                </div>
                <div className="rounded border border-border bg-background p-2">
                  <p className="text-[10px] text-muted-foreground">Conversão</p>
                  <p className="text-sm font-bold text-foreground">{selectedHost.conversion}%</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className={cn("rounded border px-2 py-0.5 text-[10px] font-bold uppercase", BRAIN_CONFIG[selectedHost.brainStatus].color ? `border-border bg-secondary ${BRAIN_CONFIG[selectedHost.brainStatus].color}` : "")}>
                  {BRAIN_CONFIG[selectedHost.brainStatus].label}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Brain Accuracy: {selectedHost.brainAccuracy}%
                </span>
              </div>
              {/* DDC link */}
              <a
                href="/ddc/airbnb"
                className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
              >
                <ExternalLink className="size-3" />
                Abrir DDC do Airbnb
              </a>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Aviso */}
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200/90">
          <strong className="font-semibold">⚠️ AirbnbPanel:</strong> Hosts reais vindos de{" "}
          <code className="rounded bg-background/60 px-1 py-0.5 font-mono">airbnbHosts</code> em{" "}
          <code className="rounded bg-background/60 px-1 py-0.5 font-mono">@/lib/zcc-clients-data</code>.
          OAuth via <code className="rounded bg-background/60 px-1 py-0.5 font-mono">POST /api/zcc/airbnb/oauth</code>.
          Webhooks via <code className="rounded bg-background/60 px-1 py-0.5 font-mono">POST /api/zcc/airbnb/webhook</code>.
          Models Prisma: <code className="rounded bg-background/60 px-1 py-0.5 font-mono">AirBProperty</code>,{" "}
          <code className="rounded bg-background/60 px-1 py-0.5 font-mono">AirBSubscription</code>,{" "}
          <code className="rounded bg-background/60 px-1 py-0.5 font-mono">AirBConversation</code>.
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label, value, hint, icon, tone = "default",
}: {
  label: string; value: React.ReactNode; hint?: string; icon?: React.ReactNode; tone?: "default" | "primary";
}) {
  return (
    <div className={cn("rounded-lg border bg-card p-3", tone === "primary" ? "border-primary/30 bg-primary/5" : "border-border")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
        {icon ? <span className="text-muted-foreground [&_svg]:size-4">{icon}</span> : null}
      </div>
      <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
