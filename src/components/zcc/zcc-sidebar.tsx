"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  // Tier 1 — Executive (visão estratégica)
  LayoutDashboard,
  MapPin,
  Users,
  Brain,
  TrendingUp,
  // Tier 2 — Operations (gestão)
  Home,
  Hotel,
  Flame,
  Wallet,
  MonitorSmartphone,
  // Tier 3 — Configuration (admin)
  KeyRound,
  Settings,
  // Sub-items executivos
  ListChecks,
  Bot,
  Activity as ActivityIcon,
  FlaskConical,
  Code2,
  FlaskRound,
  ChartColumn,
  Globe,
  Network,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { ZccTabId } from "@/lib/zcc/types";

interface ZccSidebarProps {
  active: ZccTabId;
  onChange: (tab: ZccTabId) => void;
  className?: string;
}

interface NavItem {
  id: ZccTabId;
  label: string;
  icon: LucideIcon;
  description?: string;
  badge?: string;
  soon?: boolean;
  /** Peso decisório: 1=crítico, 2=alto, 3=médio */
  priority?: 1 | 2 | 3;
}

/*
 * SIDEBAR REORGANIZADA POR PESO DECISÓRIO
 *
 * TIER 1 — EXECUTIVE (decisão estratégica diária)
 *   Visão Geral, Live Leads, Agentes Vivos, Cérebro, Pulse Check
 *
 * TIER 2 — OPERATIONS (gestão de canais e clientes)
 *   Airbnb, Pousadas, Financeiro, Breakdown, Onboarding, Burn Rate, Tenants, Geo, Refactors, Sandbox
 *
 * TIER 3 — CONFIGURATION (admin)
 *   Tokens & IA, Testes Cérebro
 */
const EXEC_NAV: NavItem[] = [
  { id: "overview", label: "Visão Geral", icon: LayoutDashboard, description: "Command Center", priority: 1 },
  { id: "live-leads", label: "Live Leads", icon: MapPin, description: "Pipeline em tempo real", badge: "AO VIVO", priority: 1 },
  { id: "financeiro", label: "Financeiro", icon: Wallet, description: "MRR · Planos · Métricas", priority: 1 },
  { id: "live-agents", label: "Agentes Vivos", icon: Bot, description: "12 agentes ativos", priority: 1 },
  { id: "brain", label: "Cérebro", icon: Brain, description: "IA central · decisões", priority: 1 },
  { id: "pulse-check", label: "Pulse Check", icon: ActivityIcon, description: "Saúde vital do sistema", priority: 2 },
];

const OPS_NAV: NavItem[] = [
  { id: "airbnb", label: "Airbnb", icon: Home, description: "Canal Airbnb", priority: 1 },
  { id: "pousadas", label: "Pousadas", icon: Hotel, description: "Canal Direto", priority: 1 },
  { id: "upsell", label: "UPSELL", icon: Sparkles, description: "Comissão Zélla 6% · ZERO em diárias", badge: "6%", priority: 1 },
  { id: "mobile-analytics", label: "Mobile Analytics", icon: MonitorSmartphone, description: "Uso mobile vs desktop · insights", badge: "LIVE", priority: 1 },
  { id: "breakdown", label: "Breakdown", icon: ChartColumn, description: "Receita por fonte", priority: 2 },
  { id: "onboarding", label: "Onboarding", icon: ListChecks, description: "Tracker de clientes", priority: 2 },
  { id: "burn-rate", label: "Burn Rate", icon: Flame, description: "Runway", priority: 3 },
  { id: "tenants", label: "Tenants", icon: Users, description: "Multi-empresa", priority: 3 },
  { id: "geo", label: "Geo", icon: Globe, description: "Distribuição geográfica", priority: 3 },
  { id: "refactors", label: "Refactors", icon: Code2, description: "Melhorias de código", priority: 3 },
  { id: "sandbox", label: "Sandbox", icon: FlaskRound, description: "Experimentação", priority: 3 },
];

const CONFIG_NAV: NavItem[] = [
  { id: "tokens-ai", label: "Tokens & IA", icon: KeyRound, description: "6 integrações", priority: 1 },
  { id: "settings", label: "Configurações", icon: Settings, description: "Depósito PIX · Webhooks · Notificações", priority: 1 },
  { id: "brain-tests", label: "Testes Cérebro", icon: FlaskConical, description: "Validação", priority: 3 },
  { id: "semantica", label: "Semântica", icon: Network, description: "GraphRAG + Decisões", priority: 2 },
];

const PRIORITY_DOT: Record<1 | 2 | 3, string> = {
  1: "bg-emerald-500",
  2: "bg-amber-500",
  3: "bg-slate-500",
};

function NavSection({
  title,
  items,
  active,
  onChange,
}: {
  title: string;
  items: NavItem[];
  active: ZccTabId;
  onChange: (t: ZccTabId) => void;
}) {
  return (
    <div className="px-2 py-1.5">
      <div className="mb-1 flex items-center justify-between px-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          {title}
        </p>
        <span className="text-[9px] text-muted-foreground/50">
          {items.length} {items.length === 1 ? "item" : "itens"}
        </span>
      </div>
      <nav className="flex flex-col gap-0.5">
        {items.map((item) => {
          const isActive = active === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              )}
            >
              {isActive ? (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary"
                />
              ) : null}
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-md border transition-colors",
                  isActive
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border bg-background text-muted-foreground group-hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="truncate text-[13px] font-medium">{item.label}</span>
                {item.priority ? (
                  <span
                    className={cn("size-1 rounded-full", PRIORITY_DOT[item.priority])}
                    title={`Prioridade ${item.priority}`}
                  />
                ) : null}
                {item.badge ? (
                  <span className="rounded bg-primary/20 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
                    {item.badge}
                  </span>
                ) : null}
                {item.soon ? (
                  <span className="rounded bg-secondary px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
                    em breve
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/**
 * Sidebar do ZCC v4 — organizada por TIER (peso decisório)
 *
 * TIER 1 — EXECUTIVE: decisão estratégica diária
 * TIER 2 — OPERATIONS: gestão de canais e clientes
 * TIER 3 — CONFIGURATION: admin (Tokens, Testes Cérebro)
 */
export function ZccSidebar({ active, onChange, className }: ZccSidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        className
      )}
    >
      {/* Marca Zélla Central Control — sem ícone à esquerda */}
      <div className="border-b border-sidebar-border px-3 py-2.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-primary">
          Zélla Central Control
        </p>
        <p className="text-[9px] font-mono text-muted-foreground/60 mt-0.5">
          Mission Control · v5.0
        </p>
      </div>

      {/* Navegação scrollável */}
      <div className="zcc-scroll flex-1 overflow-y-auto py-1">
        <NavSection title="Tier 1 · Executive" items={EXEC_NAV} active={active} onChange={onChange} />
        <div className="mx-2 my-1 border-t border-sidebar-border" />
        <NavSection title="Tier 2 · Operations" items={OPS_NAV} active={active} onChange={onChange} />
        <div className="mx-2 my-1 border-t border-sidebar-border" />
        <NavSection title="Tier 3 · Configuration" items={CONFIG_NAV} active={active} onChange={onChange} />
      </div>

      {/* Rodapé da sidebar */}
      <div className="border-t border-sidebar-border px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[10px] text-muted-foreground">Modo Mock</span>
          </div>
          <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-secondary-foreground">
            v4.0
          </span>
        </div>
      </div>
    </aside>
  );
}
