"use client";
import "leaflet/dist/leaflet.css";

import * as React from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import {
  Map as MapIcon,
  List,
  BarChart3,
  Search,
  X,
  MapPin,
  ExternalLink,
  Phone,
  Mail,
  MessageCircle,
  Globe,
  Star,
  TrendingUp,
  Users,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { leads, computeStats, formatBRL, relativeTime } from "@/lib/zcc/mock-data";
import type { Lead, LeadStatus, Validacao, ComportamentoCompra, Region } from "@/lib/zcc/types";

const LiveLeadsMap = dynamic(
  () => import("./live-leads-map").then((m) => m.LiveLeadsMap),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full w-full place-items-center bg-background">
        <div className="flex flex-col items-center gap-2">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs text-muted-foreground">Carregando mapa…</p>
        </div>
      </div>
    ),
  }
);

const STATUS_STYLES: Record<LeadStatus, string> = {
  novo: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  contatado: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  respondido: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  convertido: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  perdido: "bg-red-500/15 text-red-400 border-red-500/30",
};

const STATUS_LABEL: Record<LeadStatus, string> = {
  novo: "Novo",
  contatado: "Contatado",
  respondido: "Respondido",
  convertido: "Convertido",
  perdido: "Perdido",
};

const COMPORTAMENTO_LABEL: Record<ComportamentoCompra, string> = {
  "Tradicional": "Tradicional",
  "Moderno": "Moderno",
  "Elite": "Elite",
};

const REGIONS: Region[] = ["Sul", "Sudeste", "Nordeste", "Norte", "Centro-Oeste"];

type ViewMode = "map" | "list" | "analytics";

function LeadCard({
  lead,
  selected,
  onClick,
}: {
  lead: Lead;
  selected: boolean;
  onClick: () => void;
}) {
  const whatsappClean = lead.whatsapp.replace(/\D/g, "");
  const whatsappLink = `https://wa.me/${whatsappClean}`;
  const emailLink = `mailto:${lead.email}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group w-full rounded-md border bg-card p-2.5 text-left transition-all",
        selected
          ? "border-primary ring-1 ring-primary/40"
          : "border-border hover:border-primary/40 hover:bg-secondary/40"
      )}
    >
      {/* Linha 1: nome + status badge */}
      <div className="flex items-start justify-between gap-2">
        <p className={cn(
          "truncate text-[13px] font-semibold",
          lead.status === "convertido"
            ? "text-emerald-400"
            : lead.scoreQual >= 85
              ? "text-primary"
              : "text-foreground"
        )}>
          {lead.pousada}
        </p>
        <span className={cn(
          "shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide",
          STATUS_STYLES[lead.status]
        )}>
          {STATUS_LABEL[lead.status]}
        </span>
      </div>

      {/* Linha 2: localização */}
      <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
        <MapPin className="size-2.5 shrink-0" />
        {lead.cidade}/{lead.uf}
        {lead.localPraia ? ` · ${lead.localPraia}` : ""}
      </p>

      {/* Linha 3: sinais de intenção (amarelo) */}
      {lead.sinaisIntencao ? (
        <p className="mt-1 line-clamp-1 text-[11px] text-amber-300/90">
          <span className="text-amber-400">★</span> {lead.sinaisIntencao}
        </p>
      ) : null}

      {/* Linha 4: scores + valores */}
      <div className="mt-1.5 flex items-end justify-between">
        <div className="flex gap-1.5">
          <div className="text-center">
            <p className="text-[8px] uppercase tracking-wider text-muted-foreground">Qual</p>
            <span className={cn(
              "text-lg font-bold leading-none",
              lead.scoreQual >= 85 ? "text-emerald-400"
                : lead.scoreQual >= 70 ? "text-amber-300"
                : "text-muted-foreground"
            )}>
              {lead.scoreQual}
            </span>
          </div>
          <div className="text-center">
            <p className="text-[8px] uppercase tracking-wider text-muted-foreground">Valid</p>
            <span className={cn(
              "text-lg font-bold leading-none",
              lead.scoreValid >= 85 ? "text-emerald-400"
                : lead.scoreValid >= 70 ? "text-amber-300"
                : "text-muted-foreground"
            )}>
              {lead.scoreValid}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          {lead.qtdQuartos ? (
            <span className="text-[10px] text-muted-foreground">
              {lead.qtdQuartos} quartos
            </span>
          ) : null}
          <span className="text-[10px] text-muted-foreground/70">
            {relativeTime(lead.createdAt)}
          </span>
        </div>
      </div>

      {/* Linha 5: valores estimados + comportamento */}
      <div className="mt-1 flex items-center justify-between gap-2 border-t border-border/50 pt-1.5">
        {lead.valoresEstimados ? (
          <span className="truncate font-mono text-[10px] text-primary">
            {lead.valoresEstimados}
          </span>
        ) : <span />}
        {lead.comportamentoCompra ? (
          <span className="shrink-0 rounded bg-secondary px-1 py-0.5 text-[9px] font-medium uppercase text-muted-foreground">
            {COMPORTAMENTO_LABEL[lead.comportamentoCompra]}
          </span>
        ) : null}
      </div>

      {/* Linha 6: ações rápidas (aparece no hover) */}
      <div className="mt-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <a
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex flex-1 items-center justify-center gap-1 rounded bg-emerald-600/20 px-1.5 py-1 text-[9px] font-medium text-emerald-400 transition-colors hover:bg-emerald-600/30"
        >
          <MessageCircle className="size-2.5" />
          WhatsApp
        </a>
        <a
          href={emailLink}
          onClick={(e) => e.stopPropagation()}
          className="flex flex-1 items-center justify-center gap-1 rounded bg-blue-600/20 px-1.5 py-1 text-[9px] font-medium text-blue-400 transition-colors hover:bg-blue-600/30"
        >
          <Mail className="size-2.5" />
          E-mail
        </a>
        {lead.site ? (
          <a
            href={`https://${lead.site.replace(/^https?:\/\//, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex flex-1 items-center justify-center gap-1 rounded bg-violet-600/20 px-1.5 py-1 text-[9px] font-medium text-violet-400 transition-colors hover:bg-violet-600/30"
          >
            <Globe className="size-2.5" />
            Site
          </a>
        ) : null}
      </div>
    </button>
  );
}

function AnalyticsView({ leadsList }: { leadsList: Lead[] }) {
  const stats = computeStats(leadsList);

  // Score distribution
  const buckets = [
    { range: "0-50", count: 0, color: "bg-red-500" },
    { range: "51-70", count: 0, color: "bg-orange-500" },
    { range: "71-85", count: 0, color: "bg-amber-500" },
    { range: "86-100", count: 0, color: "bg-emerald-500" },
  ];
  for (const l of leadsList) {
    if (l.scoreQual <= 50) buckets[0].count++;
    else if (l.scoreQual <= 70) buckets[1].count++;
    else if (l.scoreQual <= 85) buckets[2].count++;
    else buckets[3].count++;
  }
  const maxBucket = Math.max(...buckets.map(b => b.count), 1);

  // Comportamento
  const porComportamento = new Map<string, number>();
  for (const l of leadsList) {
    const c = l.comportamentoCompra ?? "—";
    porComportamento.set(c, (porComportamento.get(c) ?? 0) + 1);
  }

  return (
    <div className="zcc-scroll h-full overflow-y-auto p-4 space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</p>
          <p className="text-2xl font-bold text-primary">{stats.total}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Convertidos</p>
          <p className="text-2xl font-bold text-emerald-400">
            {stats.porStatus.find(s => s.status === "convertido")?.count ?? 0}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Score Qual Méd</p>
          <p className="text-2xl font-bold text-primary">{stats.avgScoreQual}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Score Valid Méd</p>
          <p className="text-2xl font-bold text-primary">{stats.avgScoreValid}</p>
        </div>
      </div>

      {/* Score distribution */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Distribuição de Scores
        </h4>
        <div className="space-y-2">
          {buckets.map(b => (
            <div key={b.range} className="flex items-center gap-2">
              <span className="w-16 text-[11px] font-mono text-muted-foreground">{b.range}</span>
              <div className="flex-1 h-6 bg-secondary/40 rounded overflow-hidden">
                <div
                  className={cn("h-full transition-all", b.color)}
                  style={{ width: `${(b.count / maxBucket) * 100}%` }}
                />
              </div>
              <span className="w-8 text-right text-xs font-bold text-foreground">{b.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Por região */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Por Região
        </h4>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {stats.porRegiao.map(r => (
            <div key={r.regiao} className="rounded-md border border-border bg-background p-2 text-center">
              <p className="text-[10px] text-muted-foreground">{r.regiao}</p>
              <p className="text-lg font-bold text-primary">{r.count}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Por status */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Por Status
        </h4>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {stats.porStatus.map(s => (
            <div key={s.status} className="rounded-md border border-border bg-background p-2 text-center">
              <p className="text-[10px] text-muted-foreground capitalize">{s.status}</p>
              <p className="text-lg font-bold text-foreground">{s.count}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Por comportamento */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Comportamento de Compra
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {[...porComportamento.entries()].map(([c, count]) => (
            <div key={c} className="rounded-md border border-border bg-background p-2 text-center">
              <p className="text-[10px] text-muted-foreground">{c}</p>
              <p className="text-lg font-bold text-primary">{count}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * ListView — tabela detalhada de leads (clicável para selecionar)
 * Mostra TODOS os campos do Prisma: empresa, decisor, cargo, score, scoreValid, etc.
 */
function ListView({
  leadsList,
  selectedLead,
  onSelectLead,
}: {
  leadsList: Lead[];
  selectedLead: Lead | null;
  onSelectLead: (lead: Lead) => void;
}) {
  const [sortBy, setSortBy] = React.useState<"scoreQual" | "scoreValid" | "name" | "cidade" | "status">("scoreQual");
  const [sortAsc, setSortAsc] = React.useState(false);

  const sorted = React.useMemo(() => {
    const arr = [...leadsList];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = (a.empresa || a.name || "").localeCompare(b.empresa || b.name || "");
      else if (sortBy === "cidade") cmp = (a.cidade || "").localeCompare(b.cidade || "");
      else if (sortBy === "status") cmp = (a.status || "").localeCompare(b.status || "");
      else cmp = (a[sortBy] as number) - (b[sortBy] as number);
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [leadsList, sortBy, sortAsc]);

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortAsc(!sortAsc);
    else { setSortBy(col); setSortAsc(false); }
  };

  if (leadsList.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 py-10 text-center">
        <List className="size-7 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">Nenhum lead encontrado.</p>
      </div>
    );
  }

  return (
    <div className="zcc-scroll flex-1 overflow-auto">
      <table className="w-full text-[11px]">
        <thead className="sticky top-0 bg-card border-b border-border">
          <tr className="text-left">
            <th className="px-2 py-2 cursor-pointer hover:bg-secondary/40" onClick={() => toggleSort("name")}>
              Empresa {sortBy === "name" && (sortAsc ? "↑" : "↓")}
            </th>
            <th className="px-2 py-2 cursor-pointer hover:bg-secondary/40" onClick={() => toggleSort("cidade")}>
              Cidade {sortBy === "cidade" && (sortAsc ? "↑" : "↓")}
            </th>
            <th className="px-2 py-2 text-center cursor-pointer hover:bg-secondary/40" onClick={() => toggleSort("scoreQual")}>
              Score {sortBy === "scoreQual" && (sortAsc ? "↑" : "↓")}
            </th>
            <th className="px-2 py-2 text-center cursor-pointer hover:bg-secondary/40" onClick={() => toggleSort("scoreValid")}>
              Valid {sortBy === "scoreValid" && (sortAsc ? "↑" : "↓")}
            </th>
            <th className="px-2 py-2 text-center cursor-pointer hover:bg-secondary/40" onClick={() => toggleSort("status")}>
              Status {sortBy === "status" && (sortAsc ? "↑" : "↓")}
            </th>
            <th className="px-2 py-2 text-center hidden sm:table-cell">Quartos</th>
            <th className="px-2 py-2 hidden md:table-cell">Valores</th>
            <th className="px-2 py-2 hidden lg:table-cell">Comportamento</th>
            <th className="px-2 py-2 text-center">Ações</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((lead) => {
            const isSelected = selectedLead?.id === lead.id;
            return (
              <tr
                key={lead.id}
                onClick={() => onSelectLead(lead)}
                className={cn(
                  "border-b border-border/50 cursor-pointer transition-colors",
                  isSelected ? "bg-primary/10" : "hover:bg-secondary/30"
                )}
              >
                <td className="px-2 py-2">
                  <p className="font-semibold text-foreground truncate max-w-[180px]">
                    {lead.empresa || lead.name || lead.pousada}
                  </p>
                  {lead.decisor ? (
                    <p className="text-[9px] text-muted-foreground truncate">
                      {lead.decisor} {lead.cargo && `· ${lead.cargo}`}
                    </p>
                  ) : null}
                </td>
                <td className="px-2 py-2">
                  <p className="text-foreground truncate max-w-[120px]">{lead.cidade}/{lead.state || lead.uf}</p>
                  {lead.localPraia ? (
                    <p className="text-[9px] text-muted-foreground truncate">{lead.localPraia}</p>
                  ) : null}
                </td>
                <td className="px-2 py-2 text-center">
                  <span className={cn(
                    "font-bold",
                    lead.scoreQual >= 85 ? "text-emerald-400"
                      : lead.scoreQual >= 70 ? "text-amber-300"
                      : "text-muted-foreground"
                  )}>
                    {lead.scoreQual}
                  </span>
                </td>
                <td className="px-2 py-2 text-center">
                  <span className={cn(
                    "font-semibold",
                    lead.scoreValid >= 85 ? "text-emerald-400"
                      : lead.scoreValid >= 70 ? "text-amber-300"
                      : "text-muted-foreground"
                  )}>
                    {lead.scoreValid}
                  </span>
                </td>
                <td className="px-2 py-2 text-center">
                  <span className={cn(
                    "rounded border px-1 py-0.5 text-[9px] font-medium uppercase",
                    lead.status === "convertido" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      : lead.status === "respondido" ? "bg-violet-500/15 text-violet-300 border-violet-500/30"
                      : lead.status === "contatado" ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
                      : lead.status === "perdido" ? "bg-red-500/15 text-red-400 border-red-500/30"
                      : "bg-slate-500/15 text-slate-300 border-slate-500/30"
                  )}>
                    {lead.status}
                  </span>
                </td>
                <td className="px-2 py-2 text-center text-muted-foreground hidden sm:table-cell">
                  {lead.qtdQuartos || lead.roomsCount || "—"}
                </td>
                <td className="px-2 py-2 font-mono text-[10px] text-primary hidden md:table-cell">
                  {lead.valoresEstimados || lead.estimatedValues || "—"}
                </td>
                <td className="px-2 py-2 hidden lg:table-cell">
                  {lead.comportamentoCompra || lead.buyingBehavior || "—"}
                </td>
                <td className="px-2 py-2">
                  <div className="flex gap-1 justify-center">
                    {lead.whatsapp || lead.phone ? (
                      <a
                        href={`https://wa.me/${(lead.whatsapp || lead.phone || "").replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="grid size-6 place-items-center rounded bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"
                        title="WhatsApp"
                      >
                        <MessageCircle className="size-3" />
                      </a>
                    ) : null}
                    {lead.email ? (
                      <a
                        href={`mailto:${lead.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="grid size-6 place-items-center rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/30"
                        title="E-mail"
                      >
                        <Mail className="size-3" />
                      </a>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
        Exibindo <span className="font-semibold text-foreground">{sorted.length}</span> leads · clique numa coluna para ordenar
      </div>
    </div>
  );
}

export function LiveLeadsPanel() {
  const [view, setView] = React.useState<ViewMode>("map");
  const [selectedLead, setSelectedLead] = React.useState<Lead | null>(null);
  const [activeRegion, setActiveRegion] = React.useState<Region | "todas">("todas");
  const [statusFilter, setStatusFilter] = React.useState<LeadStatus | "todos">("todos");
  const [query, setQuery] = React.useState("");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const filtered = React.useMemo(() => {
    return leads
      .filter((l) => (activeRegion !== "todas" ? l.regiao === activeRegion : true))
      .filter((l) => (statusFilter !== "todos" ? l.status === statusFilter : true))
      .filter((l) =>
        query.trim()
          ? `${l.pousada} ${l.cidade} ${l.email} ${l.uf}`.toLowerCase().includes(query.toLowerCase())
          : true
      )
      .sort((a, b) => b.scoreQual - a.scoreQual);
  }, [activeRegion, statusFilter, query]);

  const handleSelectLead = React.useCallback((lead: Lead) => {
    setSelectedLead((cur) => (cur?.id === lead.id ? null : lead));
  }, []);

  const stats = computeStats(filtered);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Sub-painel: 2 colunas */}
      <div className="zcc-scroll grid flex-1 grid-cols-1 overflow-y-auto overflow-x-hidden lg:grid-cols-[380px_1fr] lg:overflow-hidden">
        {/* ====== COLUNA ESQUERDA ====== */}
        <section className="flex h-[55vh] min-h-0 flex-col overflow-hidden border-b border-border bg-card/40 lg:h-full lg:border-b-0 lg:border-r">
          {/* Header interno: ZÉLLA + subtítulo */}
          <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
            <div className="grid size-7 shrink-0 place-items-center rounded bg-primary text-primary-foreground">
              <span className="text-[10px] font-bold">Z</span>
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-tight text-foreground">ZÉLLA</p>
              <p className="truncate text-[10px] text-muted-foreground">Lead Intelligence System</p>
            </div>
          </div>

          {/* Tabs internas: Mapa / Lista / Stats */}
          <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
            {([
              { id: "map", label: "Mapa", icon: MapIcon },
              { id: "list", label: "Lista", icon: List },
              { id: "analytics", label: "Stats", icon: BarChart3 },
            ] as const).map((t) => {
              const Icon = t.icon;
              const isActive = view === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setView(t.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  )}
                >
                  <Icon className="size-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Filtros */}
          <div className="space-y-1.5 border-b border-border px-2.5 py-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar pousada, cidade..."
                className="h-8 w-full rounded-md border border-border bg-background pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <select
                value={activeRegion}
                onChange={(e) => setActiveRegion(e.target.value as Region | "todas")}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:border-primary/50 focus:outline-none"
              >
                <option value="todas">Todas Regiões</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as LeadStatus | "todos")}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:border-primary/50 focus:outline-none"
              >
                <option value="todos">Todos Status</option>
                <option value="novo">Novos</option>
                <option value="contatado">Contatados</option>
                <option value="respondido">Respondidos</option>
                <option value="convertido">Convertidos</option>
                <option value="perdido">Perdidos</option>
              </select>
            </div>
          </div>

          {/* Header da lista */}
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Leads no Mapa ({filtered.length})
            </span>
            {(activeRegion !== "todas" || statusFilter !== "todos" || query) && (
              <button
                type="button"
                onClick={() => {
                  setActiveRegion("todas");
                  setStatusFilter("todos");
                  setQuery("");
                }}
                className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
              >
                <X className="size-3" /> limpar
              </button>
            )}
          </div>

          {/* Conteúdo baseado na view: Mapa (cards + mapa), Lista (tabela), Stats (analytics) */}
          {view === "analytics" ? (
            <AnalyticsView leadsList={filtered} />
          ) : view === "list" ? (
            <ListView leadsList={filtered} selectedLead={selectedLead} onSelectLead={handleSelectLead} />
          ) : (
            <>
              {/* Lista de leads (cards) */}
              <div className="zcc-scroll flex-1 space-y-1.5 overflow-y-auto px-2.5 pb-2">
                {filtered.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                    <MapPin className="size-7 text-muted-foreground/40" />
                    <p className="text-xs text-muted-foreground">Nenhum lead encontrado.</p>
                  </div>
                ) : (
                  <>
                    <LeadCard
                      lead={filtered[0]}
                      selected={selectedLead?.id === filtered[0].id}
                      onClick={() => handleSelectLead(filtered[0])}
                    />
                    {filtered.slice(1).map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        selected={selectedLead?.id === lead.id}
                        onClick={() => handleSelectLead(lead)}
                      />
                    ))}
                  </>
                )}
              </div>

              {/* Footer da lista */}
              <div className="flex items-center justify-between border-t border-border px-3 py-1.5">
                <span className="text-[10px] text-muted-foreground">
                  Exibindo: <span className="text-foreground">{filtered.length}</span> de {leads.length}
                </span>
                <span className="text-[10px] font-semibold text-primary">
                  Score Méd: {stats.avgScoreQual}
                </span>
              </div>
            </>
          )}
        </section>

        {/* ====== COLUNA DIREITA ====== */}
        <section className="relative flex h-[60vh] min-h-[400px] flex-col overflow-hidden bg-background lg:h-full">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card/40 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
                <MapPin className="size-3" />
                {filtered.length} leads mapeados
              </span>
            </div>
            {/* Chips de região */}
            <div className="zcc-scroll flex items-center gap-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveRegion("todas")}
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                  activeRegion === "todas"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                )}
              >
                Todas
              </button>
              {REGIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setActiveRegion(r)}
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                    activeRegion === r
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            {/* Legenda — Sistema de 3 Cores */}
            <div className="hidden items-center gap-3 text-[10px] text-muted-foreground sm:flex">
              <span className="flex items-center gap-1">
                <span className="size-2.5 rounded-full bg-emerald-500" /> Conv.
              </span>
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-yellow-400" /> Prospect.
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-blue-500" /> Clique Ad
              </span>
            </div>
          </div>

          {/* Mapa aparece apenas em view=map. Em Lista e Stats, mostra info relevante */}
          {view === "map" ? (
            <div className="relative flex-1 overflow-hidden">
              {mounted ? (
                <LiveLeadsMap
                  leads={filtered}
                  selectedLeadId={selectedLead?.id ?? null}
                  onSelectLead={handleSelectLead}
                />
              ) : (
                <div className="grid h-full w-full place-items-center">
                  <p className="text-xs text-muted-foreground">Carregando…</p>
                </div>
              )}
            </div>
          ) : view === "list" ? (
            <div className="flex flex-1 items-center justify-center p-4 text-center">
              <div>
                <List className="mx-auto size-8 text-muted-foreground/40" />
                <p className="mt-2 text-xs text-muted-foreground">
                  Visualização em lista está na coluna à esquerda
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground/70">
                  Clique em "Mapa" para voltar a ver o mapa
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-4 text-center">
              <div>
                <BarChart3 className="mx-auto size-8 text-muted-foreground/40" />
                <p className="mt-2 text-xs text-muted-foreground">
                  Analytics completo na coluna à esquerda
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground/70">
                  Clique em "Mapa" para voltar a ver o mapa
                </p>
              </div>
            </div>
          )}

          {/* Detalhes do lead selecionado (overlay) */}
          {selectedLead ? (
            <div className="absolute bottom-2 left-2 right-2 z-10 rounded-lg border border-border bg-popover/95 p-3 shadow-lg backdrop-blur sm:left-auto sm:w-96">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {selectedLead.pousada}
                  </p>
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <MapPin className="size-2.5" />
                    {selectedLead.cidade}/{selectedLead.uf}
                    {selectedLead.localPraia ? ` · ${selectedLead.localPraia}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLead(null)}
                  className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label="Fechar"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              {/* Qualificação */}
              {selectedLead.qualificacao ? (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {selectedLead.qualificacao}
                </p>
              ) : null}

              {/* Sinais de intenção */}
              {selectedLead.sinaisIntencao ? (
                <p className="mt-1.5 rounded border border-amber-500/20 bg-amber-500/5 p-1.5 text-[11px] text-amber-300">
                  <span className="text-amber-400">★</span> {selectedLead.sinaisIntencao}
                </p>
              ) : null}

              {/* Scores + valores */}
              <div className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
                <div>
                  <p className="text-muted-foreground">Score Qual</p>
                  <p className={cn(
                    "font-bold",
                    selectedLead.scoreQual >= 85 ? "text-emerald-400"
                      : selectedLead.scoreQual >= 70 ? "text-amber-300"
                      : "text-foreground"
                  )}>
                    {selectedLead.scoreQual}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Score Valid</p>
                  <p className={cn(
                    "font-bold",
                    selectedLead.scoreValid >= 85 ? "text-emerald-400"
                      : selectedLead.scoreValid >= 70 ? "text-amber-300"
                      : "text-foreground"
                  )}>
                    {selectedLead.scoreValid}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Quartos</p>
                  <p className="font-semibold text-foreground">{selectedLead.qtdQuartos ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-semibold capitalize text-foreground">
                    {STATUS_LABEL[selectedLead.status]}
                  </p>
                </div>
              </div>

              {/* Valores + comportamento */}
              <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
                {selectedLead.valoresEstimados ? (
                  <span className="font-mono text-primary">{selectedLead.valoresEstimados}</span>
                ) : <span />}
                {selectedLead.comportamentoCompra ? (
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px] font-medium uppercase text-muted-foreground">
                    {COMPORTAMENTO_LABEL[selectedLead.comportamentoCompra]}
                  </span>
                ) : null}
              </div>

              {/* Ações */}
              <div className="mt-2 flex gap-1.5">
                <a
                  href={`https://wa.me/${selectedLead.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded bg-emerald-600/20 px-2 py-1.5 text-[11px] font-medium text-emerald-400 transition-colors hover:bg-emerald-600/30"
                >
                  <MessageCircle className="size-3" />
                  WhatsApp
                </a>
                <a
                  href={`mailto:${selectedLead.email}`}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded bg-blue-600/20 px-2 py-1.5 text-[11px] font-medium text-blue-400 transition-colors hover:bg-blue-600/30"
                >
                  <Mail className="size-3" />
                  E-mail
                </a>
                {selectedLead.site ? (
                  <a
                    href={`https://${selectedLead.site.replace(/^https?:\/\//, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded bg-violet-600/20 px-2 py-1.5 text-[11px] font-medium text-violet-400 transition-colors hover:bg-violet-600/30"
                  >
                    <Globe className="size-3" />
                    Site
                  </a>
                ) : null}
              </div>

              {/* Instagram */}
              {selectedLead.redesSociais ? (
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  📷 <span className="text-primary">@{selectedLead.redesSociais.replace('@', '')}</span>
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
