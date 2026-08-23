"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Search,
  Power,
  Building2,
  Home,
  Crown,
  Shield,
  FlaskConical,
  Filter,
  RefreshCw,
  Link2,
  MapPin,
} from "lucide-react";
import { PanelHeader } from "../shared/panel-header";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Plan } from "@/lib/zcc/types";

/*
 * TenantsPanel — Gestão multi-tenant (X-ray view).
 *
 * CONEXÕES COM O CÓDIGO:
 *  - GET /api/zcc/tenants → hidratação real (Prisma Tenant + Subscription + AirBSubscription)
 *  - PATCH /api/zcc/tenants/[id]/status → kill switch (suspende/reativa)
 *  - Cérebro: SelfDefenseAgent escuta mudança → pausa webhooks + IA do tenant
 *  - AuditLog: registra ação do operador ZCC
 *  - Tenant.niche (pousada | airbnb) → determinado por Property.type
 *  - Tenant.plan (lite | pro | max | parceiro) → migrated via migratePlanLegacy
 *  - MRR = Subscription.amount (prioridade) ou AirBSubscription.amount ou plan default
 *  - lastActive = updatedAt do Tenant
 *
 * Em mock mode (Vercel sem DB): API retorna array vazio → usa fallback demo
 */

type TenantStatus = "active" | "suspended" | "churned";
type Niche = "pousada" | "airbnb";

interface TenantRow {
  id: string;
  name: string;
  niche: Niche;
  plan: string; // lite | pro | max | parceiro (lowercase, da API)
  status: TenantStatus;
  mrr: number;
  lastActive: string; // ISO
  isTestTenant: boolean;
  email?: string;
  domain?: string | null;
  city?: string;
  state?: string;
  revenue?: number;
  aiMessagesProcessed?: number;
  conversionRate?: number;
  brainAccuracy?: number;
  brainStatus?: string;
}

// ---- fallback demo (usado quando API retorna vazio ou erro) ----

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString();
const daysAgo = (d: number) => new Date(now - d * 86400_000).toISOString();

const FALLBACK_TENANTS: TenantRow[] = [
  { id: "t-001", name: "Pousada Maravilha", niche: "pousada", plan: "pro", status: "active", mrr: 397, lastActive: hoursAgo(1), isTestTenant: false, email: "contato@pousadamaravilha.com.br", domain: "pousadamaravilha.com.br", city: "Florianópolis", state: "SC", aiMessagesProcessed: 1240, conversionRate: 32, brainAccuracy: 91, brainStatus: "learning" },
  { id: "t-002", name: "Villa Geribá Búzios", niche: "airbnb", plan: "max", status: "active", mrr: 797, lastActive: hoursAgo(2), isTestTenant: false, email: "host@villageriba.com", domain: "villageriba.com", city: "Búzios", state: "RJ", aiMessagesProcessed: 2840, conversionRate: 41, brainAccuracy: 96, brainStatus: "learning" },
  { id: "t-003", name: "Pousada Vila Floripa", niche: "pousada", plan: "pro", status: "active", mrr: 397, lastActive: hoursAgo(4), isTestTenant: false, email: "ola@vilafloripa.com.br", domain: "vilafloripa.com.br", city: "Florianópolis", state: "SC", aiMessagesProcessed: 980, conversionRate: 28, brainAccuracy: 91, brainStatus: "learning" },
  { id: "t-004", name: "Casa Trancoso BA", niche: "airbnb", plan: "max", status: "active", mrr: 797, lastActive: hoursAgo(8), isTestTenant: false, email: "contato@casatrancoso.com", domain: "casatrancoso.com", city: "Trancoso", state: "BA", aiMessagesProcessed: 1920, conversionRate: 38, brainAccuracy: 96, brainStatus: "learning" },
  { id: "t-005", name: "Pousada Serenity Paraty", niche: "pousada", plan: "lite", status: "active", mrr: 197, lastActive: hoursAgo(12), isTestTenant: false, email: "serenity@paraty.com", domain: "pousadaserenity.com.br", city: "Paraty", state: "RJ", aiMessagesProcessed: 540, conversionRate: 22, brainAccuracy: 85, brainStatus: "learning" },
  { id: "t-006", name: "Studio Costa Verde", niche: "airbnb", plan: "pro", status: "suspended", mrr: 0, lastActive: daysAgo(5), isTestTenant: false, email: "studio@costaverde.com", domain: "costaverde.com", city: "Angra dos Reis", state: "RJ", aiMessagesProcessed: 320, conversionRate: 12, brainAccuracy: 0, brainStatus: "paused" },
  { id: "t-007", name: "Pousada Beach Test", niche: "pousada", plan: "pro", status: "active", mrr: 397, lastActive: hoursAgo(0.5), isTestTenant: true, email: "test@beach.com", domain: null, city: "Florianópolis", state: "SC", aiMessagesProcessed: 80, conversionRate: 15, brainAccuracy: 91, brainStatus: "learning" },
  { id: "t-008", name: "Airbnb Demo Host", niche: "airbnb", plan: "lite", status: "churned", mrr: 0, lastActive: daysAgo(34), isTestTenant: true, email: "demo@host.com", domain: null, city: "Jericoacoara", state: "CE", aiMessagesProcessed: 12, conversionRate: 0, brainAccuracy: 0, brainStatus: "paused" },
];

const PLAN_ICON: Record<string, React.ElementType> = {
  lite: Building2,
  LITE: Building2,
  pro: Crown,
  PRO: Crown,
  max: Crown,
  MAX: Crown,
  parceiro: Shield,
  PARCEIRO: Shield,
};

const PLAN_BADGE: Record<string, string> = {
  lite: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  LITE: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  pro: "border-violet-500/30 bg-violet-500/10 text-violet-400",
  PRO: "border-violet-500/30 bg-violet-500/10 text-violet-400",
  max: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  MAX: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  parceiro: "border-rose-500/30 bg-rose-500/10 text-rose-400",
  PARCEIRO: "border-rose-500/30 bg-rose-500/10 text-rose-400",
};

const STATUS_BADGE: Record<TenantStatus, string> = {
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  suspended: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  churned: "border-red-500/30 bg-red-500/10 text-red-400",
};

const STATUS_DOT: Record<TenantStatus, string> = {
  active: "bg-emerald-500",
  suspended: "bg-amber-500",
  churned: "bg-red-500",
};

const NICHE_ICON: Record<Niche, React.ElementType> = {
  pousada: Building2,
  airbnb: Home,
};

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}

type FilterKey = "all" | "active" | "suspended" | "churned";

// ---- component ------------------------------------------------------

export function TenantsPanel() {
  const [tenants, setTenants] = React.useState<TenantRow[]>(FALLBACK_TENANTS);
  const [filter, setFilter] = React.useState<FilterKey>("all");
  const [search, setSearch] = React.useState("");
  const [pendingKillId, setPendingKillId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [dataSource, setDataSource] = React.useState<string>("fallback");
  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  // ── Hidratação: GET /api/zcc/tenants ───────────────────────────
  const loadTenants = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/zcc/tenants", { cache: "no-store" });
      if (!res.ok) throw new Error("API error");
      const json = await res.json();
      if (json?.success && Array.isArray(json.data) && json.data.length > 0) {
        // Mapeia resposta da API → TenantRow
        const mapped: TenantRow[] = json.data.map((t: any) => ({
          id: t.id,
          name: t.name,
          niche: (t.niche ?? "pousada") as Niche,
          plan: (t.plan ?? "lite").toLowerCase(),
          status: (t.status ?? "active") as TenantStatus,
          mrr: t.planPrice ?? t.revenue ?? 0,
          lastActive: t.updatedAt ?? t.createdAt ?? new Date().toISOString(),
          isTestTenant: t.isTestTenant ?? false,
          email: t.email,
          domain: t.domain,
          city: t.city,
          state: t.state,
          revenue: t.revenue ?? 0,
          aiMessagesProcessed: t.aiMessagesProcessed ?? 0,
          conversionRate: t.conversionRate ?? 0,
          brainAccuracy: t.brainAccuracy ?? 0,
          brainStatus: t.brainStatus ?? "idle",
        }));
        setTenants(mapped);
        setDataSource("db");
      } else {
        // API retornou vazio → mantém fallback
        setDataSource("demo (API vazia)");
      }
    } catch {
      setDataSource("fallback (API indisponível)");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const filtered = React.useMemo(() => {
    return tenants.filter((t) => {
      if (filter !== "all" && t.status !== filter) return false;
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [tenants, filter, search]);

  const kpis = React.useMemo(() => {
    const active = tenants.filter((t) => t.status === "active").length;
    const suspended = tenants.filter((t) => t.status === "suspended").length;
    const churned = tenants.filter((t) => t.status === "churned").length;
    const test = tenants.filter((t) => t.isTestTenant).length;
    const totalMrr = tenants.reduce((s, t) => s + t.mrr, 0);
    return { total: tenants.length, active, suspended, churned, test, totalMrr };
  }, [tenants]);

  // ── Kill switch: PATCH /api/zcc/tenants/[id]/status ────────────
  const toggleKillSwitch = React.useCallback(
    async (tenant: TenantRow) => {
      setTogglingId(tenant.id);
      const newStatus = tenant.status === "active" ? "suspended" : "active";

      // Otimistic UI update
      setTenants((prev) =>
        prev.map((t) =>
          t.id === tenant.id
            ? {
                ...t,
                status: newStatus as TenantStatus,
                mrr: newStatus === "suspended" ? 0 : t.mrr || getPlanPrice(t.plan),
                brainStatus: newStatus === "suspended" ? "paused" : "learning",
              }
            : t
        )
      );

      try {
        const res = await fetch(`/api/zcc/tenants/${tenant.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.message ?? `HTTP ${res.status}`);
        }

        const json = await res.json();
        if (!json?.success) {
          throw new Error(json?.message ?? "API retornou success=false");
        }

        if (newStatus === "suspended") {
          toast.warning(`Tenant ${tenant.name} suspenso`, {
            description: "Kill switch ativado · IA e mensagens pausadas · AuditLog registrado",
          });
        } else {
          toast.success(`Tenant ${tenant.name} reativado`, {
            description: "IA e webhooks voltam a operar normalmente",
          });
        }
      } catch (error) {
        // Rollback em caso de erro
        setTenants((prev) =>
          prev.map((t) =>
            t.id === tenant.id
              ? { ...t, status: tenant.status, mrr: tenant.mrr, brainStatus: tenant.brainStatus }
              : t
          )
        );
        toast.error(`Erro ao alternar status do tenant`, {
          description: error instanceof Error ? error.message : "Erro desconhecido",
        });
      } finally {
        setTogglingId(null);
        setPendingKillId(null);
      }
    },
    []
  );

  const handleRefresh = () => {
    loadTenants();
    toast.success("Lista de tenants atualizada");
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader
        title="Tenants"
        description="Gestão multi-empresa · X-ray view · kill switch live"
        icon={<Users className="size-5" />}
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground">
              <Link2 className="size-3 text-primary" />
              <span className="text-primary">{dataSource}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
              </span>
              {kpis.active}/{kpis.total} ativos
            </span>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            </button>
          </div>
        }
      />

      <div className="zcc-scroll flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* ===== AVISO DE CONEXÕES ===== */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Link2 className="size-3.5 text-primary shrink-0" />
            <span>
              <strong className="text-foreground">Conexões ativas:</strong>{" "}
              <code className="font-mono text-primary">GET /api/zcc/tenants</code> (Prisma: Tenant + Subscription + AirBSubscription){" "}
              · <code className="font-mono text-primary">PATCH /api/zcc/tenants/[id]/status</code> (Kill switch + AuditLog){" "}
              · Cérebro <code className="font-mono text-primary">SelfDefenseAgent</code> escuta mudança → pausa IA
            </span>
          </p>
        </div>

        {/* ===== KPIs ===== */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <TenantKpi label="Total tenants" value={kpis.total} icon={<Users className="size-4" />} accent="primary" index={0} />
          <TenantKpi label="Ativos" value={kpis.active} icon={<span className="size-2 rounded-full bg-emerald-500" />} accent="emerald" index={1} />
          <TenantKpi label="Suspensos" value={kpis.suspended} icon={<span className="size-2 rounded-full bg-amber-500" />} accent="amber" index={2} />
          <TenantKpi label="Churned" value={kpis.churned} icon={<span className="size-2 rounded-full bg-red-500" />} accent="rose" index={3} />
          <TenantKpi label="Test tenants" value={kpis.test} icon={<FlaskConical className="size-4" />} accent="primary" index={4} />
        </div>

        {/* ===== FILTERS ===== */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5">
            <Filter className="ml-1 size-3 text-muted-foreground" />
            {(["all", "active", "suspended", "churned"] as FilterKey[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded px-2 py-0.5 text-[10px] font-medium capitalize transition-colors",
                  filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f === "all" ? "Todos" : f === "active" ? "Ativos" : f === "suspended" ? "Suspensos" : "Churned"}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome do tenant..."
              className="h-8 w-full rounded-md border border-border bg-card pl-8 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <span className="text-[10px] text-muted-foreground">
            MRR total: <span className="font-bold text-foreground">{fmtBRL(kpis.totalMrr)}</span>
          </span>
        </div>

        {/* ===== TENANT GRID ===== */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((tenant, idx) => (
              <TenantCard
                key={tenant.id}
                tenant={tenant}
                index={idx}
                pendingKill={pendingKillId === tenant.id}
                toggling={togglingId === tenant.id}
                onToggleKill={() => {
                  if (tenant.status === "active") {
                    setPendingKillId(tenant.id);
                  } else {
                    toggleKillSwitch(tenant);
                  }
                }}
                onConfirmKill={() => toggleKillSwitch(tenant)}
                onCancelKill={() => setPendingKillId(null)}
              />
            ))}
          </AnimatePresence>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Nenhum tenant encontrado com os filtros atuais.
          </div>
        ) : null}

        {/* ===== RODAPÉ ===== */}
        <div className="rounded-lg border border-border bg-card p-3 text-[10px] text-muted-foreground">
          <p className="mb-1">
            <strong className="text-foreground">Modelos Prisma conectados:</strong>
          </p>
          <ul className="space-y-0.5 ml-3">
            <li>• <code className="font-mono text-primary">Tenant</code> — id, name, niche, plan, status, isTestTenant</li>
            <li>• <code className="font-mono text-primary">Subscription</code> — amount (overrides plan default), planType</li>
            <li>• <code className="font-mono text-primary">AirBSubscription</code> — amount para tenants airbnb</li>
            <li>• <code className="font-mono text-primary">Transaction</code> — receita agregada (revenue)</li>
            <li>• <code className="font-mono text-primary">AgentLog</code> — aiMessagesProcessed (count success)</li>
            <li>• <code className="font-mono text-primary">Guest</code> — conversionRate (booked / total)</li>
            <li>• <code className="font-mono text-primary">AuditLog</code> — registra kill switch</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ---- helpers --------------------------------------------------------

function getPlanPrice(plan: string): number {
  const p = plan.toLowerCase();
  if (p === "lite") return 197;
  if (p === "pro") return 397;
  if (p === "max") return 797;
  if (p === "parceiro") return 247;
  return 0;
}

// ---- sub-components -------------------------------------------------

function TenantKpi({
  label,
  value,
  icon,
  accent,
  index,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent: "primary" | "emerald" | "amber" | "rose";
  index: number;
}) {
  const colorMap: Record<string, string> = {
    primary: "border-primary/30 bg-primary/5 text-primary",
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-400",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-400",
    rose: "border-red-500/30 bg-red-500/5 text-red-400",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      className={cn("rounded-lg border p-3", colorMap[accent])}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="[&_svg]:size-3.5">{icon}</span>
      </div>
      <p className="mt-1 text-xl font-bold text-foreground sm:text-2xl">{value}</p>
    </motion.div>
  );
}

function TenantCard({
  tenant,
  index,
  pendingKill,
  toggling,
  onToggleKill,
  onConfirmKill,
  onCancelKill,
}: {
  tenant: TenantRow;
  index: number;
  pendingKill: boolean;
  toggling: boolean;
  onToggleKill: () => void;
  onConfirmKill: () => void;
  onCancelKill: () => void;
}) {
  const PlanIcon = PLAN_ICON[tenant.plan] ?? Building2;
  const NicheIcon = NICHE_ICON[tenant.niche] ?? Building2;
  const planUpper = tenant.plan.toUpperCase();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className={cn(
        "rounded-lg border bg-card p-3 transition-colors",
        tenant.status === "active" ? "border-border hover:border-primary/40" :
        tenant.status === "suspended" ? "border-amber-500/30 bg-amber-500/5" :
        "border-red-500/30 bg-red-500/5 opacity-75"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <NicheIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <p className="truncate text-sm font-semibold text-foreground">{tenant.name}</p>
          </div>
          {tenant.email ? (
            <p className="truncate text-[10px] text-muted-foreground">{tenant.email}</p>
          ) : null}
          {(tenant.city || tenant.state) ? (
            <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-muted-foreground">
              <MapPin className="size-2.5" />
              {tenant.city}{tenant.city && tenant.state ? " — " : ""}{tenant.state}
            </p>
          ) : null}
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded border px-1 py-0.5 text-[8px] font-bold uppercase",
            STATUS_BADGE[tenant.status]
          )}
        >
          <span className={cn("size-1 rounded-full", STATUS_DOT[tenant.status])} />
          {tenant.status}
        </span>
      </div>

      {/* Plan + niche badges */}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded border px-1 py-0.5 text-[8px] font-bold uppercase",
            PLAN_BADGE[tenant.plan] ?? PLAN_BADGE.lite
          )}
        >
          <PlanIcon className="size-2.5" />
          {planUpper}
        </span>
        <span className="rounded border border-border bg-background px-1 py-0.5 text-[8px] font-medium uppercase text-muted-foreground">
          {tenant.niche}
        </span>
        {tenant.isTestTenant ? (
          <span className="inline-flex items-center gap-0.5 rounded border border-primary/30 bg-primary/10 px-1 py-0.5 text-[8px] font-bold uppercase text-primary">
            <FlaskConical className="size-2.5" />
            TEST
          </span>
        ) : null}
      </div>

      {/* Metrics */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded border border-border/60 bg-background/50 p-1.5">
          <p className="text-[8px] uppercase text-muted-foreground">MRR</p>
          <p className={cn("font-mono font-bold", tenant.mrr > 0 ? "text-emerald-400" : "text-muted-foreground")}>
            {tenant.mrr > 0 ? fmtBRL(tenant.mrr) : "—"}
          </p>
        </div>
        <div className="rounded border border-border/60 bg-background/50 p-1.5">
          <p className="text-[8px] uppercase text-muted-foreground">Última ativ.</p>
          <p className="font-mono text-muted-foreground">{relativeTime(tenant.lastActive)}</p>
        </div>
      </div>

      {/* AI metrics extras */}
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-[9px]">
        <div className="rounded border border-border/40 bg-background/30 p-1 text-center">
          <p className="text-[7px] uppercase text-muted-foreground">Msgs IA</p>
          <p className="font-mono font-semibold text-foreground">{tenant.aiMessagesProcessed ?? 0}</p>
        </div>
        <div className="rounded border border-border/40 bg-background/30 p-1 text-center">
          <p className="text-[7px] uppercase text-muted-foreground">Conv.</p>
          <p className="font-mono font-semibold text-foreground">{tenant.conversionRate ?? 0}%</p>
        </div>
        <div className="rounded border border-border/40 bg-background/30 p-1 text-center">
          <p className="text-[7px] uppercase text-muted-foreground">Brain</p>
          <p className="font-mono font-semibold text-foreground">{tenant.brainAccuracy ?? 0}%</p>
        </div>
      </div>

      {/* Brain status indicator */}
      <div className="mt-2 flex items-center justify-between text-[9px]">
        <span className="text-muted-foreground">Cérebro:</span>
        <span className={cn(
          "inline-flex items-center gap-1 font-medium",
          tenant.brainStatus === "learning" ? "text-emerald-400" :
          tenant.brainStatus === "paused" ? "text-amber-400" :
          "text-muted-foreground"
        )}>
          <span className={cn(
            "size-1.5 rounded-full",
            tenant.brainStatus === "learning" ? "bg-emerald-500 animate-pulse" :
            tenant.brainStatus === "paused" ? "bg-amber-500" :
            "bg-muted-foreground"
          )} />
          {tenant.brainStatus ?? "idle"}
        </span>
      </div>

      {/* Domain */}
      {tenant.domain ? (
        <p className="mt-2 truncate text-[10px] text-muted-foreground" title={tenant.domain}>
          🌐 {tenant.domain}
        </p>
      ) : null}

      {/* Kill switch */}
      <div className="mt-3 border-t border-border/50 pt-2">
        {pendingKill ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onConfirmKill}
              disabled={toggling}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[10px] font-bold uppercase text-red-400 hover:bg-red-500/20 disabled:opacity-50"
            >
              {toggling ? (
                <>
                  <span className="size-3 animate-spin rounded-full border-2 border-red-500/40 border-t-red-500" />
                  Aplicando...
                </>
              ) : (
                <>
                  <Power className="size-3" />
                  Confirmar
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onCancelKill}
              disabled={toggling}
              className="rounded border border-border bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onToggleKill}
            disabled={toggling || tenant.status === "churned"}
            className={cn(
              "w-full inline-flex items-center justify-center gap-1 rounded border px-2 py-1 text-[10px] font-medium transition-colors disabled:opacity-50",
              tenant.status === "active"
                ? "border-amber-500/30 bg-amber-500/5 text-amber-400 hover:bg-amber-500/15"
                : "border-emerald-500/30 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/15"
            )}
          >
            {toggling ? (
              <>
                <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Processando...
              </>
            ) : (
              <>
                <Power className="size-3" />
                {tenant.status === "active" ? "Kill Switch" : "Reativar"}
              </>
            )}
          </button>
        )}
      </div>
    </motion.div>
  );
}
