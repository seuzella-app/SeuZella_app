"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Code2, ChevronRight, Check, X, Wrench, FileCode2, Sparkles,
  ThumbsUp, ThumbsDown, Loader2, TrendingUp, GitBranch,
} from "lucide-react";
import { PanelHeader } from "../shared/panel-header";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/*
 * RefactorsPanel — refatorações sugeridas pela IA (CerebroAnalysis + RefactorSuggestion).
 *
 * - 5 cards de sugestão de refatoração
 * - Cada card expansível (currentCode vs proposedCode)
 * - Approve/Reject por card
 * - KPIs: total, pending, approved, applied, avg confidence
 */

type RefactorStatus = "pending_review" | "approved" | "rejected" | "applied";

interface RefactorSuggestionRow {
  id: string;
  filePath: string;
  lineRange: string;
  rationale: string;
  confidence: number; // 0-100
  status: RefactorStatus;
  currentCode: string;
  proposedCode: string;
  createdAt: string;
  sourceErrorHash: string;
}

// ---- mock data --------------------------------------------------------------

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString();

const INITIAL_SUGGESTIONS: RefactorSuggestionRow[] = [
  {
    id: "rs-001",
    filePath: "src/lib/zcc/router.ts",
    lineRange: "42-58",
    rationale: "Padrão de erro recorrente (47 ocorrências em 30d). Refatoração para early-return reduz complexidade ciclomática de 8 para 3.",
    confidence: 94,
    status: "pending_review",
    sourceErrorHash: "err_8a3f12",
    createdAt: hoursAgo(2),
    currentCode: `export function routeMessage(msg: Message) {
  if (msg.type === "text") {
    if (msg.text.length > 0) {
      if (msg.from === "tenant") {
        return handleTenantMessage(msg);
      } else {
        return handleGuestMessage(msg);
      }
    } else {
      return null;
    }
  } else if (msg.type === "image") {
    return handleImage(msg);
  }
  return null;
}`,
    proposedCode: `export function routeMessage(msg: Message): HandlerResult | null {
  if (msg.type === "image") return handleImage(msg);
  if (msg.type !== "text" || !msg.text?.length) return null;
  return msg.from === "tenant"
    ? handleTenantMessage(msg)
    : handleGuestMessage(msg);
}`,
  },
  {
    id: "rs-002",
    filePath: "src/lib/zcc/cache.ts",
    lineRange: "118-134",
    rationale: "Memory leak detectado: cache LRU cresce indefinidamente. Adicionar TTL e limite de 1000 entradas.",
    confidence: 87,
    status: "pending_review",
    sourceErrorHash: "err_4d7e21",
    createdAt: hoursAgo(5),
    currentCode: `const cache = new Map<string, any>();

export function get(key: string) {
  return cache.get(key);
}

export function set(key: string, value: any) {
  cache.set(key, value);
}`,
    proposedCode: `const MAX_ENTRIES = 1000;
const TTL_MS = 5 * 60 * 1000; // 5 min

const cache = new Map<string, { value: any; expiresAt: number }>();

export function get<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function set(key: string, value: unknown): void {
  if (cache.size >= MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
}`,
  },
  {
    id: "rs-003",
    filePath: "src/app/api/agents/route.ts",
    lineRange: "67-89",
    rationale: "N+1 queries em loop. Substituir por Promise.all + batch fetch do Prisma (inclue agents.tasks).",
    confidence: 81,
    status: "pending_review",
    sourceErrorHash: "err_9b2c45",
    createdAt: hoursAgo(12),
    currentCode: `export async function GET() {
  const agents = await db.agent.findMany();
  const result = [];
  for (const agent of agents) {
    const tasks = await db.task.findMany({
      where: { agentId: agent.id }
    });
    result.push({ ...agent, tasks });
  }
  return Response.json(result);
}`,
    proposedCode: `export async function GET() {
  const agents = await db.agent.findMany({
    include: { tasks: true },
    orderBy: { createdAt: "desc" },
  });
  return Response.json(agents);
}`,
  },
  {
    id: "rs-004",
    filePath: "src/components/zcc/panels/cerebro-panel.tsx",
    lineRange: "203-227",
    rationale: "Re-render desnecessário (3.2x por segundo). Memoizar BrainEventRow com React.memo + useCallback.",
    confidence: 76,
    status: "approved",
    sourceErrorHash: "err_1f8a90",
    createdAt: hoursAgo(28),
    currentCode: `function BrainEventRow({ event }: { event: BrainEvent }) {
  return (
    <div className="border-b border-border px-3 py-2">
      <span>{event.message}</span>
      <span>{relativeTime(event.at)}</span>
    </div>
  );
}`,
    proposedCode: `const BrainEventRow = React.memo(function BrainEventRow({
  event,
}: {
  event: BrainEvent;
}) {
  const timeLabel = React.useMemo(
    () => relativeTime(event.at),
    [event.at]
  );
  return (
    <div className="border-b border-border px-3 py-2">
      <span>{event.message}</span>
      <span>{timeLabel}</span>
    </div>
  );
});`,
  },
  {
    id: "rs-005",
    filePath: "src/lib/zcc/budget-guard.ts",
    lineRange: "55-72",
    rationale: "Race condition em updateBudgetState quando múltiplos tenants fazem checkout simultâneo. Usar transaction do Prisma.",
    confidence: 72,
    status: "pending_review",
    sourceErrorHash: "err_7c3e11",
    createdAt: hoursAgo(48),
    currentCode: `export async function updateBudgetState(tenantId: string, cost: number) {
  const state = await db.budgetGuardState.findFirst({
    where: { tenantId }
  });
  if (!state) return;
  const newSpend = state.dailySpendUsd + cost;
  await db.budgetGuardState.update({
    where: { id: state.id },
    data: { dailySpendUsd: newSpend }
  });
}`,
    proposedCode: `export async function updateBudgetState(
  tenantId: string,
  cost: number
): Promise<void> {
  await db.$transaction(async (tx) => {
    const state = await tx.budgetGuardState.findFirst({
      where: { tenantId },
    });
    if (!state) return;
    await tx.budgetGuardState.update({
      where: { id: state.id },
      data: {
        dailySpendUsd: { increment: cost },
        monthlySpendUsd: { increment: cost },
      },
    });
  });
}`,
  },
];

const STATUS_BADGE: Record<RefactorStatus, string> = {
  pending_review: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  approved: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  rejected: "border-red-500/30 bg-red-500/10 text-red-400",
  applied: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
};

const STATUS_LABEL: Record<RefactorStatus, string> = {
  pending_review: "PENDING REVIEW",
  approved: "APPROVED",
  rejected: "REJECTED",
  applied: "APPLIED",
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diffMs / 3600_000);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}

// ---- component --------------------------------------------------------------

export function RefactorsPanel() {
  const [suggestions, setSuggestions] = React.useState<RefactorSuggestionRow[]>(INITIAL_SUGGESTIONS);

  const updateStatus = (id: string, status: RefactorStatus) => {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status } : s))
    );
  };

  const handleApprove = (s: RefactorSuggestionRow) => {
    updateStatus(s.id, "approved");
    toast.success(`Refatoração aprovada: ${s.filePath}`, {
      description: `Confiança ${s.confidence}% · pronta para aplicar`,
    });
  };

  const handleReject = (s: RefactorSuggestionRow) => {
    updateStatus(s.id, "rejected");
    toast.error(`Refatoração rejeitada: ${s.filePath}`);
  };

  const handleApply = (s: RefactorSuggestionRow) => {
    updateStatus(s.id, "applied");
    toast.success(`Refatoração aplicada em produção: ${s.filePath}`, {
      description: `Commit gerado · CI/CD acionado`,
    });
  };

  const kpis = React.useMemo(() => {
    const total = suggestions.length;
    const pending = suggestions.filter((s) => s.status === "pending_review").length;
    const approved = suggestions.filter((s) => s.status === "approved").length;
    const rejected = suggestions.filter((s) => s.status === "rejected").length;
    const applied = suggestions.filter((s) => s.status === "applied").length;
    const avgConfidence = suggestions.reduce((sum, s) => sum + s.confidence, 0) / (total || 1);
    return { total, pending, approved, rejected, applied, avgConfidence };
  }, [suggestions]);

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader
        title="Refactors"
        description="Refatorações sugeridas pela IA · CerebroAnalysis + RefactorSuggestion"
        icon={<Code2 className="size-5" />}
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
            <Sparkles className="size-3" />
            {kpis.avgConfidence.toFixed(0)}% conf. média
          </span>
        }
      />

      <div className="zcc-scroll flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* ===== KPIs ===== */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <RefactorKpi label="Total sugestões" value={kpis.total} icon={<Code2 className="size-4" />} accent="primary" index={0} />
          <RefactorKpi label="Pendentes" value={kpis.pending} icon={<Loader2 className="size-4" />} accent="amber" index={1} />
          <RefactorKpi label="Aprovadas" value={kpis.approved} icon={<ThumbsUp className="size-4" />} accent="sky" index={2} />
          <RefactorKpi label="Aplicadas" value={kpis.applied} icon={<Check className="size-4" />} accent="emerald" index={3} />
          <RefactorKpi label="Conf. média" value={`${kpis.avgConfidence.toFixed(0)}%`} icon={<TrendingUp className="size-4" />} accent="primary" index={4} />
        </div>

        {/* ===== SECTION HEADER ===== */}
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <GitBranch className="size-3.5 text-primary" />
            SUGESTÕES DE REFACTORIZAÇÃO · {suggestions.length}
          </h3>
          <span className="text-[10px] text-muted-foreground">
            Pendentes: <span className="font-bold text-amber-400">{kpis.pending}</span> ·
            Rejeitadas: <span className="font-bold text-red-400">{kpis.rejected}</span>
          </span>
        </div>

        {/* ===== REFACTOR CARDS ===== */}
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {suggestions.map((s, idx) => (
              <RefactorCard
                key={s.id}
                suggestion={s}
                index={idx}
                onApprove={() => handleApprove(s)}
                onReject={() => handleReject(s)}
                onApply={() => handleApply(s)}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* ===== RODAPÉ ===== */}
        <div className="rounded-lg border border-border bg-card p-3 text-[10px] text-muted-foreground">
          <p>
            <strong className="text-foreground">Sugestões geradas por</strong>{" "}
            <code className="font-mono text-primary">CerebroAnalysis.analysisType = refactor_suggestion</code>{" "}
            → persistidas em{" "}
            <code className="font-mono text-primary">RefactorSuggestion</code> (Prisma). Pipeline completo via{" "}
            <code className="font-mono text-primary">/api/zcc/refactors</code>.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---- sub-components ---------------------------------------------------------

function RefactorKpi({
  label,
  value,
  icon,
  accent,
  index,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent: "primary" | "emerald" | "amber" | "rose" | "sky";
  index: number;
}) {
  const colorMap: Record<string, string> = {
    primary: "border-primary/30 bg-primary/5 text-primary",
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-400",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-400",
    rose: "border-red-500/30 bg-red-500/5 text-red-400",
    sky: "border-sky-500/30 bg-sky-500/5 text-sky-400",
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

function RefactorCard({
  suggestion,
  index,
  onApprove,
  onReject,
  onApply,
}: {
  suggestion: RefactorSuggestionRow;
  index: number;
  onApprove: () => void;
  onReject: () => void;
  onApply: () => void;
}) {
  const [expanded, setExpanded] = React.useState(false);

  const confidenceColor =
    suggestion.confidence >= 85 ? "text-emerald-400" :
    suggestion.confidence >= 75 ? "text-amber-400" :
    "text-red-400";

  const confidenceBg =
    suggestion.confidence >= 85 ? "bg-emerald-500" :
    suggestion.confidence >= 75 ? "bg-amber-500" :
    "bg-red-500";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className="rounded-lg border border-border bg-card overflow-hidden"
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-secondary/30 transition-colors"
      >
        <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border", STATUS_BADGE[suggestion.status])}>
          <FileCode2 className="size-3.5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-mono text-sm font-semibold text-foreground">
              {suggestion.filePath}
              <span className="ml-1 text-muted-foreground">:{suggestion.lineRange}</span>
            </p>
            <span className={cn("inline-flex items-center rounded border px-1 py-0.5 text-[8px] font-bold uppercase", STATUS_BADGE[suggestion.status])}>
              {STATUS_LABEL[suggestion.status]}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
            {suggestion.rationale}
          </p>
          <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="font-mono">#{suggestion.sourceErrorHash}</span>
            <span>·</span>
            <span>{relativeTime(suggestion.createdAt)}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={cn("font-mono text-sm font-bold", confidenceColor)}>
            {suggestion.confidence}%
          </span>
          <div className="h-1.5 w-12 overflow-hidden rounded-full bg-secondary/40">
            <div
              className={cn("h-full", confidenceBg)}
              style={{ width: `${suggestion.confidence}%` }}
            />
          </div>
          <ChevronRight className={cn("size-3 text-muted-foreground transition-transform", expanded && "rotate-90")} />
        </div>
      </button>

      {/* Expanded: code diff */}
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="border-t border-border overflow-hidden"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">
              {/* CURRENT CODE */}
              <div className="bg-background/50">
                <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-red-400">
                    − CURRENT CODE
                  </span>
                  <span className="text-[9px] text-muted-foreground font-mono">{suggestion.lineRange}</span>
                </div>
                <pre className="zcc-scroll max-h-64 overflow-auto p-3 text-[10px] leading-relaxed font-mono text-muted-foreground">
                  <code>{suggestion.currentCode}</code>
                </pre>
              </div>

              {/* PROPOSED CODE */}
              <div className="bg-emerald-500/5">
                <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                    + PROPOSED CODE
                  </span>
                  <span className="text-[9px] text-muted-foreground font-mono">
                    -{suggestion.currentCode.split("\n").length} +{suggestion.proposedCode.split("\n").length} linhas
                  </span>
                </div>
                <pre className="zcc-scroll max-h-64 overflow-auto p-3 text-[10px] leading-relaxed font-mono text-emerald-300">
                  <code>{suggestion.proposedCode}</code>
                </pre>
              </div>
            </div>

            {/* Actions */}
            <div className="border-t border-border bg-card px-3 py-2 flex flex-wrap items-center gap-2">
              {suggestion.status === "pending_review" ? (
                <>
                  <button
                    type="button"
                    onClick={onApprove}
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                  >
                    <ThumbsUp className="size-3" />
                    Aprovar
                  </button>
                  <button
                    type="button"
                    onClick={onReject}
                    className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-[10px] font-bold uppercase text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <ThumbsDown className="size-3" />
                    Rejeitar
                  </button>
                </>
              ) : null}

              {suggestion.status === "approved" ? (
                <button
                  type="button"
                  onClick={onApply}
                  className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase text-primary hover:bg-primary/20 transition-colors"
                >
                  <Wrench className="size-3" />
                  Aplicar em produção
                </button>
              ) : null}

              {suggestion.status === "applied" ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-400">
                  <Check className="size-3" />
                  Aplicada em produção · commit gerado
                </span>
              ) : null}

              {suggestion.status === "rejected" ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-red-400">
                  <X className="size-3" />
                  Rejeitada pelo operador
                </span>
              ) : null}

              <span className="ml-auto text-[9px] text-muted-foreground">
                Criada {relativeTime(suggestion.createdAt)}
              </span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
