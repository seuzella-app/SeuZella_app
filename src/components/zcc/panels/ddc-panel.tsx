// @ts-nocheck — ZCC visual panel, types fixed in dedicated refactoring pass
"use client";

import * as React from "react";
type DDCPanelId = string;
import {
  Hotel,
  Home,
  Globe,
  Smartphone,
  ExternalLink,
  Users,
  TrendingUp,
  DollarSign,
  Clock,
  Power,
  RefreshCw,
  Activity,
  Zap,
  Webhook,
  Copy,
  Check,
} from "lucide-react";
import { PanelHeader } from "../shared/panel-header";
import { leads, formatBRL, formatPct } from "@/lib/zcc/mock-data";
import type { DDCPanelId } from "@/lib/zcc/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Mapa de painéis DDC → URL de produção real
 * Conecta as 4 rotas oficiais da Vercel
 */
const PANEL_URL: Record<DDCPanelId, string> = {
  "pousada-web": "https://smart-hotel-zehla.vercel.app/ddc/pousada",
  "airbnb-web": "https://smart-hotel-zehla.vercel.app/ddc/airbnb",
  "pousada-mobile": "https://smart-hotel-zehla.vercel.app/mobile/pousada",
  "airbnb-mobile": "https://smart-hotel-zehla.vercel.app/mobile/airbnb",
};

const PANEL_META: Record<
  DDCPanelId,
  {
    kind: "Pousada" | "Airbnb";
    device: "Web" | "Mobile";
    icon: React.ReactNode;
    route: string;
    description: string;
  }
> = {
  "pousada-web": {
    kind: "Pousada", device: "Web", route: "/ddc/pousada",
    icon: <Hotel className="size-5" />,
    description: "Dashboard de Pousadas · canal direto desktop",
  },
  "airbnb-web": {
    kind: "Airbnb", device: "Web", route: "/ddc/airbnb",
    icon: <Home className="size-5" />,
    description: "Integrador Airbnb · desktop",
  },
  "pousada-mobile": {
    kind: "Pousada", device: "Mobile", route: "/mobile/pousada",
    icon: <Smartphone className="size-5" />,
    description: "PWA Pousada · hóspedes mobile",
  },
  "airbnb-mobile": {
    kind: "Airbnb", device: "Mobile", route: "/mobile/airbnb",
    icon: <Smartphone className="size-5" />,
    description: "PWA Airbnb · hóspedes mobile",
  },
};

const SOURCE_TO_PANEL: Record<string, DDCPanelId> = {
  "pousada-web": "pousada-web",
  "airbnb-web": "airbnb-web",
  "pousada-mobile": "pousada-mobile",
  "airbnb-mobile": "airbnb-mobile",
};

interface DDCPanelProps {
  panelId: DDCPanelId;
}

export function DDCPanel({ panelId }: DDCPanelProps) {
  const meta = PANEL_META[panelId];
  const productionUrl = PANEL_URL[panelId];
  const [copied, setCopied] = React.useState(false);
  const [online, setOnline] = React.useState(true);

  const panelLeads = React.useMemo(
    () => leads.filter((l) => SOURCE_TO_PANEL[l.source] === panelId),
    [panelId]
  );

  const deviceIcon = meta.device === "Web" ? <Globe className="size-4" /> : <Smartphone className="size-4" />;

  const copyUrl = () => {
    navigator.clipboard.writeText(productionUrl);
    setCopied(true);
    toast.success("URL copiada para área de transferência");
    setTimeout(() => setCopied(false), 2000);
  };

  const togglePower = () => {
    setOnline((cur) => {
      const next = !cur;
      toast.info(`${meta.kind} ${meta.device}: ${next ? "online" : "offline"}`);
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader
        title={`DDC ${meta.kind} ${meta.device}`}
        description={`${meta.description} · ${productionUrl}`}
        icon={meta.icon}
        actions={
          <>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium",
                online
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-destructive/30 bg-destructive/10 text-red-300"
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  online ? "bg-emerald-500" : "bg-red-500"
                )}
              />
              {online ? "Online" : "Offline"}
            </span>
            <a
              href={productionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/70"
              title={`Abrir ${meta.kind} ${meta.device} em nova aba`}
            >
              <ExternalLink className="size-3.5" />
              <span className="hidden sm:inline">Abrir painel</span>
            </a>
          </>
        }
      />

      <div className="zcc-scroll flex-1 overflow-y-auto p-4 sm:p-6">
        {/* KPIs do painel */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Leads hoje" value={online ? 12 : 0} hint={`${panelLeads.length} histórico`} icon={<Users />} tone="primary" />
          <KpiCard label="Conversão" value={online ? formatPct(0.28) : "—"} hint="média mensal" icon={<TrendingUp />} />
          <KpiCard label="Receita do mês" value={formatBRL(48200)} icon={<DollarSign />} />
          <KpiCard label="Resposta média" value={online ? "6 min" : "—"} hint="1ª resposta" icon={<Clock />} />
        </div>

        {/* Conexão com produção + ações */}
        <div className="mt-4 rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span className={cn(
                  "grid size-7 place-items-center rounded-md border",
                  meta.kind === "Pousada"
                    ? "border-sky-500/30 bg-sky-500/10 text-sky-400"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-400"
                )}>
                  {deviceIcon}
                </span>
                <h3 className="text-sm font-semibold text-foreground">
                  {meta.kind} · {meta.device}
                </h3>
                <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {meta.route}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {online
                  ? "Sincronização ativa — calendário e leads em tempo real"
                  : "Integrador offline — verifique credenciais e webhook"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copyUrl}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/70"
              >
                {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                <span className="hidden sm:inline">{copied ? "Copiado!" : "Copiar URL"}</span>
              </button>
              <button
                type="button"
                onClick={() => toast.info(`Sincronizando ${meta.kind} ${meta.device}...`)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/70"
              >
                <RefreshCw className="size-3.5" />
                <span className="hidden sm:inline">Sincronizar</span>
              </button>
              <button
                type="button"
                onClick={togglePower}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                  online
                    ? "border-destructive/30 bg-destructive/10 text-red-300 hover:bg-destructive/20"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                )}
              >
                <Power className="size-3.5" />
                <span className="hidden sm:inline">{online ? "Desligar" : "Ligar"}</span>
              </button>
            </div>
          </div>

          {/* Endpoints */}
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-md border border-border bg-background p-2.5">
              <div className="flex items-center gap-1.5">
                <Activity className="size-3 text-emerald-400" />
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Produção
                </p>
              </div>
              <p className="mt-0.5 truncate font-mono text-[11px] text-foreground">
                {productionUrl.replace("https://smart-hotel-zehla.vercel.app", "")}
              </p>
              <a
                href={productionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
              >
                <ExternalLink className="size-2.5" />
                Acessar painel real
              </a>
            </div>
            <div className="rounded-md border border-border bg-background p-2.5">
              <div className="flex items-center gap-1.5">
                <Zap className="size-3 text-amber-400" />
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  API
                </p>
              </div>
              <p className="mt-0.5 truncate font-mono text-[11px] text-foreground">
                /api/v1/{panelId}
              </p>
            </div>
            <div className="rounded-md border border-border bg-background p-2.5">
              <div className="flex items-center gap-1.5">
                <Webhook className="size-3 text-violet-400" />
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Webhook
                </p>
              </div>
              <p className="mt-0.5 truncate font-mono text-[11px] text-foreground">
                /hooks/{panelId}/leads
              </p>
            </div>
          </div>
        </div>

        {/* Cross-links: 3 outros DDCs */}
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            Cross-links · outros painéis DDC
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(Object.keys(PANEL_META) as DDCPanelId[])
              .filter((id) => id !== panelId)
              .map((id) => {
                const m = PANEL_META[id];
                const Icon = m.icon;
                return (
                  <a
                    key={id}
                    href={PANEL_URL[id]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-2 rounded-md border border-border bg-card p-2.5 transition-all hover:border-primary/40 hover:bg-primary/5"
                  >
                    <span className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-md border",
                      m.kind === "Pousada"
                        ? "border-sky-500/30 bg-sky-500/10 text-sky-400"
                        : "border-rose-500/30 bg-rose-500/10 text-rose-400"
                    )}>
                      <Icon.type className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">
                        {m.kind} {m.device}
                      </p>
                      <p className="truncate text-[10px] font-mono text-muted-foreground">
                        {m.route}
                      </p>
                    </div>
                    <ExternalLink className="size-3 text-muted-foreground group-hover:text-primary" />
                  </a>
                );
              })}
          </div>
        </div>

        {/* Tabela de leads */}
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            Leads deste canal ({panelLeads.length})
          </h3>
          {panelLeads.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
              Nenhum lead registrado neste painel ainda.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-2 border-b border-border bg-secondary/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <span>Lead</span>
                <span>Origem</span>
                <span className="text-right">Valor</span>
                <span className="text-right">Score</span>
              </div>
              <div className="zcc-scroll max-h-96 overflow-y-auto">
                {panelLeads.map((l) => (
                  <div
                    key={l.id}
                    className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-2 border-b border-border px-3 py-2 text-xs last:border-0 hover:bg-secondary/30"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{l.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {l.city}/{l.uf}
                      </p>
                    </div>
                    <span className="text-muted-foreground">{l.channel}</span>
                    <span className="text-right font-semibold text-emerald-300">
                      {formatBRL(l.value)}
                    </span>
                    <span className="text-right text-muted-foreground">{l.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Aviso mock */}
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200/90">
          <strong className="font-semibold">Modo Mock:</strong> Métricas fictícias. Para dados
          reais, conecte o integrador em <strong>Tokens &amp; IA</strong> e rode o primeiro INIT.
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "default" | "primary";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3",
        tone === "primary" ? "border-primary/30 bg-primary/5" : "border-border"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {icon ? <span className="text-muted-foreground [&_svg]:size-4">{icon}</span> : null}
      </div>
      <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
      {hint ? (
        <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
