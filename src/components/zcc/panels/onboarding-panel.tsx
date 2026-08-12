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
} from "lucide-react";
import { PanelHeader } from "../shared/panel-header";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/*
 * OnboardingTrackerPanel — Acompanha onboarding de novos tenants.
 *
 * Funil de 5 etapas:
 *   1. Payment      — pagamento confirmado (Mercado Pago)
 *   2. Email        — email mágico enviado
 *   3. Magic Scan   — magic scan QR / dados importados
 *   4. WhatsApp     — WhatsApp Cloud API conectado
 *   5. Auto-PIN     — PIN automático ativado (auto-resposta)
 *
 * - Header com taxa de onboarding %
 * - Funnel cards: Total tenants, Emails sent %, WhatsApp connected %, Auto-PIN active %
 * - Lista de tenants com progresso de 5 etapas
 * - Barra de progresso por tenant
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
    id: "t1",
    name: "Pousada Serenity Paraty",
    niche: "pousada",
    plan: "MAX",
    createdAt: "há 2 dias",
    steps: [
      { id: "payment", label: "Payment", icon: <CreditCard className="size-3.5" />, done: true },
      { id: "email", label: "Email", icon: <Mail className="size-3.5" />, done: true },
      { id: "scan", label: "Magic Scan", icon: <ScanLine className="size-3.5" />, done: true },
      { id: "whatsapp", label: "WhatsApp", icon: <MessageCircle className="size-3.5" />, done: true },
      { id: "autopin", label: "Auto-PIN", icon: <KeyRound className="size-3.5" />, done: true },
    ],
  },
  {
    id: "t2",
    name: "Villa Geribá Búzios",
    niche: "airbnb",
    plan: "PRO",
    createdAt: "há 3 dias",
    steps: [
      { id: "payment", label: "Payment", icon: <CreditCard className="size-3.5" />, done: true },
      { id: "email", label: "Email", icon: <Mail className="size-3.5" />, done: true },
      { id: "scan", label: "Magic Scan", icon: <ScanLine className="size-3.5" />, done: true },
      { id: "whatsapp", label: "WhatsApp", icon: <MessageCircle className="size-3.5" />, done: true },
      { id: "autopin", label: "Auto-PIN", icon: <KeyRound className="size-3.5" />, done: false, inProgress: true },
    ],
  },
  {
    id: "t3",
    name: "Casa Trancoso BA",
    niche: "airbnb",
    plan: "MAX",
    createdAt: "há 4 dias",
    steps: [
      { id: "payment", label: "Payment", icon: <CreditCard className="size-3.5" />, done: true },
      { id: "email", label: "Email", icon: <Mail className="size-3.5" />, done: true },
      { id: "scan", label: "Magic Scan", icon: <ScanLine className="size-3.5" />, done: true },
      { id: "whatsapp", label: "WhatsApp", icon: <MessageCircle className="size-3.5" />, done: false, inProgress: true },
      { id: "autopin", label: "Auto-PIN", icon: <KeyRound className="size-3.5" />, done: false },
    ],
  },
  {
    id: "t4",
    name: "Pousada Floripa Beira Mar",
    niche: "pousada",
    plan: "PRO",
    createdAt: "há 5 dias",
    steps: [
      { id: "payment", label: "Payment", icon: <CreditCard className="size-3.5" />, done: true },
      { id: "email", label: "Email", icon: <Mail className="size-3.5" />, done: true },
      { id: "scan", label: "Magic Scan", icon: <ScanLine className="size-3.5" />, done: false, inProgress: true },
      { id: "whatsapp", label: "WhatsApp", icon: <MessageCircle className="size-3.5" />, done: false },
      { id: "autopin", label: "Auto-PIN", icon: <KeyRound className="size-3.5" />, done: false },
    ],
  },
  {
    id: "t5",
    name: "Studio Costa Verde",
    niche: "airbnb",
    plan: "LITE",
    createdAt: "há 6 dias",
    steps: [
      { id: "payment", label: "Payment", icon: <CreditCard className="size-3.5" />, done: true },
      { id: "email", label: "Email", icon: <Mail className="size-3.5" />, done: false, inProgress: true },
      { id: "scan", label: "Magic Scan", icon: <ScanLine className="size-3.5" />, done: false },
      { id: "whatsapp", label: "WhatsApp", icon: <MessageCircle className="size-3.5" />, done: false },
      { id: "autopin", label: "Auto-PIN", icon: <KeyRound className="size-3.5" />, done: false },
    ],
  },
  {
    id: "t6",
    name: "Pousada Encanto da Serra",
    niche: "pousada",
    plan: "PARCEIRO",
    createdAt: "há 7 dias",
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

const NICHE_ICON: Record<string, React.ReactNode> = {
  pousada: <CreditCard className="size-3" />,
  airbnb: <Mail className="size-3" />,
};

export function OnboardingTrackerPanel() {
  const [tenants] = React.useState<OnboardingTenant[]>(MOCK_TENANTS);

  const stats = React.useMemo(() => {
    const total = tenants.length;
    const completed = tenants.filter((t) => t.steps.every((s) => s.done)).length;
    const emailsSent = tenants.filter((t) =>
      t.steps.find((s) => s.id === "email")?.done
    ).length;
    const whatsappConnected = tenants.filter((t) =>
      t.steps.find((s) => s.id === "whatsapp")?.done
    ).length;
    const autopinActive = tenants.filter((t) =>
      t.steps.find((s) => s.id === "autopin")?.done
    ).length;
    const rate = total > 0 ? (completed / total) * 100 : 0;
    return {
      total,
      completed,
      emailsSent,
      whatsappConnected,
      autopinActive,
      rate,
    };
  }, [tenants]);

  const handleNudge = (tenant: OnboardingTenant) => {
    toast.success("Lembrete enviado", {
      description: `Notificação enviada para ${tenant.name}`,
    });
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader
        title="Onboarding Tracker"
        description="Funil de ativação · 5 etapas por tenant"
        icon={<UserCheck className="size-5" />}
        actions={
          <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1">
            <Zap className="size-3.5 text-primary" />
            <span className="text-sm font-bold text-primary">
              {stats.rate.toFixed(0)}%
            </span>
            <span className="text-[10px] text-muted-foreground">onboarding</span>
          </div>
        }
      />

      <div className="zcc-scroll flex-1 overflow-y-auto p-4 sm:p-6">
        {/* ====== FUNNEL CARDS ====== */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
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

        {/* ====== TENANT LIST ====== */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
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
              <TenantRow
                key={tenant.id}
                tenant={tenant}
                index={idx}
                onNudge={() => handleNudge(tenant)}
              />
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
  icon,
  label,
  value,
  sub,
  pct,
  highlight,
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
      transition={{ duration: 0.3 }}
      className={cn(
        "relative overflow-hidden rounded-lg border bg-card p-4 transition-colors",
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
        <span
          className={cn(
            "text-[11px] font-bold",
            highlight ? "text-primary" : "text-foreground"
          )}
        >
          {pct.toFixed(0)}%
        </span>
      </div>
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-2xl font-bold",
          highlight ? "text-primary" : "text-foreground"
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>
      {/* Barra */}
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
  tenant,
  index,
  onNudge,
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
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className={cn(
        "overflow-hidden rounded-lg border bg-card transition-colors",
        isComplete
          ? "border-emerald-500/30"
          : expanded
            ? "border-primary/30"
            : "border-border hover:border-primary/30"
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        {/* Avatar */}
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-md border text-xs font-bold",
            isComplete
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-border bg-secondary text-muted-foreground"
          )}
        >
          {tenant.name.slice(0, 2).toUpperCase()}
        </span>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {tenant.name}
            </p>
            <span
              className={cn(
                "rounded border px-1 py-0.5 text-[9px] font-semibold uppercase",
                PLAN_COLOR[tenant.plan]
              )}
            >
              {tenant.plan}
            </span>
          </div>
          <p className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              {NICHE_ICON[tenant.niche]}
              {tenant.niche}
            </span>
            <span>·</span>
            <span>{tenant.createdAt}</span>
          </p>
        </div>

        {/* Progress */}
        <div className="hidden flex-col items-end gap-1 sm:flex">
          <span
            className={cn(
              "text-xs font-bold",
              isComplete ? "text-emerald-400" : "text-primary"
            )}
          >
            {completed}/{total}
          </span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
            <motion.div
              className={cn(
                "h-full",
                isComplete ? "bg-emerald-400" : "bg-primary"
              )}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, delay: index * 0.04 + 0.1 }}
            />
          </div>
        </div>

        {/* Status badge */}
        <span
          className={cn(
            "rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase",
            isComplete
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-amber-500/30 bg-amber-500/10 text-amber-400"
          )}
        >
          {isComplete ? "done" : "wip"}
        </span>

        <ChevronRight
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-90"
          )}
        />
      </button>

      {/* Expanded steps */}
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
              {/* Mobile progress */}
              <div className="mb-3 sm:hidden">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>progresso</span>
                  <span className="font-bold text-primary">
                    {completed}/{total}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn(
                      "h-full",
                      isComplete ? "bg-emerald-400" : "bg-primary"
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Steps */}
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-5">
                {STEP_DEFS.map((def, i) => {
                  const step = tenant.steps.find((s) => s.id === def.id);
                  if (!step) return null;
                  return (
                    <StepPill
                      key={def.id}
                      label={def.label}
                      icon={def.icon}
                      order={i + 1}
                      done={step.done}
                      inProgress={step.inProgress}
                    />
                  );
                })}
              </div>

              {/* Actions */}
              {!isComplete && (
                <div className="mt-3 flex items-center justify-end gap-2 border-t border-border pt-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNudge();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
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
  label,
  icon,
  order,
  done,
  inProgress,
}: {
  label: string;
  icon: React.ReactNode;
  order: number;
  done: boolean;
  inProgress?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-2.5 py-2",
        done
          ? "border-emerald-500/30 bg-emerald-500/5"
          : inProgress
            ? "border-amber-500/30 bg-amber-500/5"
            : "border-border bg-secondary/30"
      )}
    >
      <span
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-full border text-[9px] font-bold",
          done
            ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-400"
            : inProgress
              ? "border-amber-500/40 bg-amber-500/20 text-amber-400"
              : "border-border bg-secondary text-muted-foreground"
        )}
      >
        {done ? (
          <CheckCircle2 className="size-3.5" />
        ) : inProgress ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Circle className="size-3.5" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-[10px] font-semibold uppercase tracking-wide",
            done
              ? "text-emerald-400"
              : inProgress
                ? "text-amber-400"
                : "text-muted-foreground"
          )}
        >
          {order}. {label}
        </p>
        <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
          {icon}
          <span>
            {done ? "completo" : inProgress ? "em andamento" : "pendente"}
          </span>
        </div>
      </div>
    </div>
  );
}
