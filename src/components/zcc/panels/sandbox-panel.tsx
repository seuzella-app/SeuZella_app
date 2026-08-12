"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FlaskConical, Play, Trash2, TrendingUp, TrendingDown, BedDouble,
  Percent, DollarSign, FlaskRound, Sparkles, Loader2, CheckCircle2,
} from "lucide-react";
import { PanelHeader } from "../shared/panel-header";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/*
 * SandboxPanel — Z-Lab · ambiente de simulação.
 *
 * - Simulation runner: input + "Run Simulation" button
 * - 3 pre-built scenarios
 * - Results: revenue projection, occupancy, conversion
 * - Test tenant management: list + cleanup button
 */

type ScenarioId = "high-season" | "low-season" | "price-war";

interface Scenario {
  id: ScenarioId;
  label: string;
  description: string;
  emoji: string;
  revenueImpact: number; // % vs baseline
  occupancyImpact: number; // % vs baseline
  conversionImpact: number; // % vs baseline
  assumptions: string[];
}

interface SimulationResult {
  scenarioId: ScenarioId;
  scenarioLabel: string;
  scenarioDescription: string;
  customInput: string;
  revenueProjection: number; // R$
  occupancyRate: number; // %
  conversionRate: number; // %
  deltaRevenue: number; // % vs baseline
  deltaOccupancy: number;
  deltaConversion: number;
  runAt: string;
  durationMs: number;
}

interface TestTenant {
  id: string;
  name: string;
  niche: "pousada" | "airbnb";
  createdAt: string;
  lastUsed: string;
  messageCount: number;
}

// ---- mock data --------------------------------------------------------------

const SCENARIOS: Scenario[] = [
  {
    id: "high-season",
    label: "Alta Temporada",
    description: "Dezembro a Carnaval · demanda 3x média anual",
    emoji: "🏖️",
    revenueImpact: 142,
    occupancyImpact: 28,
    conversionImpact: 18,
    assumptions: [
      "Ocupação base 70% → 89% (+19pp)",
      "Diária média +18% (premium de temporada)",
      "Conversão de leads +18% (urgência)",
      "Custo WhatsApp +32% (mais msgs)",
    ],
  },
  {
    id: "low-season",
    label: "Baixa Temporada",
    description: "Maio-Junho · demanda abaixo da média",
    emoji: "🌧️",
    revenueImpact: -34,
    occupancyImpact: -22,
    conversionImpact: -15,
    assumptions: [
      "Ocupação base 70% → 48% (-22pp)",
      "Diária média -12% (promoções)",
      "Conversão de leads -15%",
      "Reduzir investimento em ads -40%",
    ],
  },
  {
    id: "price-war",
    label: "Guerra de Preços",
    description: "Concorrente cortou 25% das diárias",
    emoji: "⚔️",
    revenueImpact: -18,
    occupancyImpact: 12,
    conversionImpact: 8,
    assumptions: [
      "Match de preço: -22% diária",
      "Ocupação +12% (capta share do concorrente)",
      "Margem líquida -28%",
      "Manter diferenciação: IA + otimização",
    ],
  },
];

const TEST_TENANTS_INITIAL: TestTenant[] = [
  { id: "t-test-001", name: "Pousada Beach Test", niche: "pousada", createdAt: new Date(Date.now() - 14 * 86400_000).toISOString(), lastUsed: new Date(Date.now() - 2 * 3600_000).toISOString(), messageCount: 847 },
  { id: "t-test-002", name: "Airbnb Demo Host", niche: "airbnb", createdAt: new Date(Date.now() - 7 * 86400_000).toISOString(), lastUsed: new Date(Date.now() - 6 * 3600_000).toISOString(), messageCount: 312 },
  { id: "t-test-003", name: "QA Sandbox Floripa", niche: "pousada", createdAt: new Date(Date.now() - 30 * 86400_000).toISOString(), lastUsed: new Date(Date.now() - 24 * 3600_000).toISOString(), messageCount: 1240 },
];

const BASELINE = {
  revenue: 54298, // R$ MRR atual
  occupancy: 70,
  conversion: 12,
};

// ---- helpers ----------------------------------------------------------------

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diffMs / 3600_000);
  if (h < 1) return `${Math.floor(diffMs / 60_000)}min atrás`;
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

// ---- component --------------------------------------------------------------

export function SandboxPanel() {
  const [scenarioInput, setScenarioInput] = React.useState("");
  const [activeScenario, setActiveScenario] = React.useState<ScenarioId | null>(null);
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState<SimulationResult | null>(null);
  const [testTenants, setTestTenants] = React.useState<TestTenant[]>(TEST_TENANTS_INITIAL);

  const runSimulation = async (scenario?: Scenario, customInput?: string) => {
    setRunning(true);
    setResult(null);
    const input = customInput ?? scenarioInput;
    if (scenario) setActiveScenario(scenario.id);

    // Simula delay de processamento
    await new Promise((r) => setTimeout(r, 1100));

    const sc = scenario ?? SCENARIOS[0];
    const newResult: SimulationResult = {
      scenarioId: sc.id,
      scenarioLabel: sc.label,
      scenarioDescription: sc.description,
      customInput: input,
      revenueProjection: BASELINE.revenue * (1 + sc.revenueImpact / 100),
      occupancyRate: BASELINE.occupancy + sc.occupancyImpact,
      conversionRate: BASELINE.conversion + sc.conversionImpact,
      deltaRevenue: sc.revenueImpact,
      deltaOccupancy: sc.occupancyImpact,
      deltaConversion: sc.conversionImpact,
      runAt: new Date().toISOString(),
      durationMs: 1100,
    };
    setResult(newResult);
    setRunning(false);
    toast.success(`Simulação "${sc.label}" concluída`, {
      description: `Δ receita ${fmtPct(sc.revenueImpact)} · Δ ocupação ${sc.occupancyImpact >= 0 ? "+" : ""}${sc.occupancyImpact}pp`,
    });
  };

  const handleCleanup = (tenant: TestTenant) => {
    setTestTenants((prev) => prev.filter((t) => t.id !== tenant.id));
    toast.success(`Tenant de teste removido: ${tenant.name}`);
  };

  const handleCleanupAll = () => {
    const count = testTenants.length;
    setTestTenants([]);
    toast.success(`${count} tenants de teste limpos`);
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader
        title="Sandbox · Z-Lab"
        description="Laboratório de simulação · cenários · test tenants"
        icon={<FlaskConical className="size-5" />}
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
            <Sparkles className="size-3" />
            Z-Lab v1.0
          </span>
        }
      />

      <div className="zcc-scroll flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* ===== SIMULATION RUNNER ===== */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-lg border border-border bg-card p-4"
        >
          <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            <Play className="size-3.5 text-primary" />
            SIMULATION RUNNER
          </h3>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={scenarioInput}
              onChange={(e) => setScenarioInput(e.target.value)}
              placeholder="Descreva o cenário que deseja simular (ex: alta temporada + 30% investimento em ads)"
              className="h-9 flex-1 rounded-md border border-border bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
              onKeyDown={(e) => {
                if (e.key === "Enter" && scenarioInput.trim()) {
                  runSimulation(SCENARIOS[0], scenarioInput);
                }
              }}
            />
            <button
              type="button"
              onClick={() => runSimulation(SCENARIOS[0], scenarioInput)}
              disabled={running}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold uppercase text-primary hover:bg-primary/20 transition-colors",
                running && "opacity-60 cursor-not-allowed"
              )}
            >
              {running ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Play className="size-3.5" />
              )}
              {running ? "Rodando..." : "Run Simulation"}
            </button>
          </div>

          {/* Pre-built scenarios */}
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
              Cenários pré-configurados
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {SCENARIOS.map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => runSimulation(sc, scenarioInput)}
                  disabled={running}
                  className={cn(
                    "rounded-md border p-2 text-left transition-colors",
                    activeScenario === sc.id
                      ? "border-primary/40 bg-primary/10"
                      : "border-border bg-background hover:border-primary/30",
                    running && "opacity-60 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{sc.emoji}</span>
                    <span className="text-xs font-semibold text-foreground">{sc.label}</span>
                  </div>
                  <p className="mt-0.5 text-[9px] text-muted-foreground line-clamp-2">{sc.description}</p>
                  <p className={cn("mt-1 text-[10px] font-bold", sc.revenueImpact >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {fmtPct(sc.revenueImpact)} receita
                  </p>
                </button>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ===== RESULTS ===== */}
        <AnimatePresence mode="wait">
          {result ? (
            <motion.section
              key={result.runAt}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="rounded-lg border border-primary/30 bg-primary/5 p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
                  <CheckCircle2 className="size-3.5" />
                  RESULTADO DA SIMULAÇÃO
                </h3>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {result.durationMs}ms · {new Date(result.runAt).toLocaleTimeString("pt-BR")}
                </span>
              </div>

              <div className="mb-3">
                <p className="text-sm font-semibold text-foreground">
                  {result.scenarioLabel}
                </p>
                <p className="text-[11px] text-muted-foreground">{result.scenarioDescription}</p>
                {result.customInput ? (
                  <p className="mt-1 text-[10px] text-muted-foreground italic">
                    Input: "{result.customInput}"
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Revenue */}
                <ResultMetric
                  label="Receita projetada"
                  value={fmtBRL(result.revenueProjection)}
                  baseline={`Base: ${fmtBRL(BASELINE.revenue)}`}
                  delta={result.deltaRevenue}
                  icon={<DollarSign className="size-4" />}
                  accent="emerald"
                />
                {/* Occupancy */}
                <ResultMetric
                  label="Ocupação"
                  value={`${result.occupancyRate.toFixed(0)}%`}
                  baseline={`Base: ${BASELINE.occupancy}%`}
                  delta={result.deltaOccupancy}
                  icon={<BedDouble className="size-4" />}
                  accent="primary"
                  suffix="pp"
                />
                {/* Conversion */}
                <ResultMetric
                  label="Conversão"
                  value={`${result.conversionRate.toFixed(1)}%`}
                  baseline={`Base: ${BASELINE.conversion}%`}
                  delta={result.deltaConversion}
                  icon={<Percent className="size-4" />}
                  accent="amber"
                  suffix="pp"
                />
              </div>

              {/* Assumptions */}
              <div className="mt-3 rounded-md border border-border bg-background/60 p-2">
                <p className="text-[9px] font-semibold uppercase text-muted-foreground mb-1">
                  Premissas do modelo
                </p>
                <ul className="space-y-0.5">
                  {SCENARIOS.find((s) => s.id === result.scenarioId)?.assumptions.map((a, i) => (
                    <li key={i} className="text-[10px] text-muted-foreground">
                      • {a}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.section>
          ) : running ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-lg border border-primary/30 bg-primary/5 p-8 text-center"
            >
              <Loader2 className="mx-auto size-6 animate-spin text-primary" />
              <p className="mt-2 text-sm text-muted-foreground">Processando simulação...</p>
              <p className="text-[10px] text-muted-foreground">Aplicando Thompson Sampling + projeção linear</p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* ===== TEST TENANT MANAGEMENT ===== */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <FlaskRound className="size-3.5 text-amber-400" />
              TEST TENANTS · IS_TEST_TENANT = TRUE
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">
                {testTenants.length} ativos
              </span>
              {testTenants.length > 0 ? (
                <button
                  type="button"
                  onClick={handleCleanupAll}
                  className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] font-medium text-red-400 hover:bg-red-500/20"
                >
                  <Trash2 className="size-3" />
                  Limpar todos
                </button>
              ) : null}
            </div>
          </div>

          {testTenants.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-xs text-muted-foreground">
              <FlaskConical className="mx-auto mb-2 size-6 text-muted-foreground/60" />
              Nenhum tenant de teste ativo. Use o simulation runner para criar novos.
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card divide-y divide-border">
              <AnimatePresence mode="popLayout">
                {testTenants.map((t, idx) => (
                  <TestTenantRow key={t.id} tenant={t} index={idx} onCleanup={() => handleCleanup(t)} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>

        {/* ===== RODAPÉ ===== */}
        <div className="rounded-lg border border-border bg-card p-3 text-[10px] text-muted-foreground">
          <p>
            <strong className="text-foreground">Z-Lab</strong> simula cenários sem tocar produção. Tenants com{" "}
            <code className="font-mono text-primary">isTestTenant = true</code> (Prisma Tenant) podem ser criados e limpos livremente.
            Resultados usam Thompson Sampling + projeção linear.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---- sub-components ---------------------------------------------------------

function ResultMetric({
  label,
  value,
  baseline,
  delta,
  icon,
  accent,
  suffix = "%",
}: {
  label: string;
  value: string;
  baseline: string;
  delta: number;
  icon: React.ReactNode;
  accent: "emerald" | "primary" | "amber";
  suffix?: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-400",
    primary: "border-primary/30 bg-primary/5 text-primary",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-400",
  };

  const deltaColor = delta >= 0 ? "text-emerald-400" : "text-red-400";
  const DeltaIcon = delta >= 0 ? TrendingUp : TrendingDown;

  return (
    <div className={cn("rounded-lg border p-3", colorMap[accent])}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="[&_svg]:size-3.5">{icon}</span>
      </div>
      <p className="mt-1 font-mono text-lg font-bold text-foreground">{value}</p>
      <div className="mt-1 flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">{baseline}</span>
        <span className={cn("inline-flex items-center gap-0.5 font-bold", deltaColor)}>
          <DeltaIcon className="size-2.5" />
          {delta >= 0 ? "+" : ""}{delta.toFixed(1)}{suffix}
        </span>
      </div>
    </div>
  );
}

function TestTenantRow({
  tenant,
  index,
  onCleanup,
}: {
  tenant: TestTenant;
  index: number;
  onCleanup: () => void;
}) {
  const nicheColor = tenant.niche === "pousada" ? "text-amber-400" : "text-sky-400";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className="flex items-center gap-3 px-3 py-2.5"
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-md border border-primary/30 bg-primary/10 text-primary">
        <FlaskRound className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">{tenant.name}</p>
          <span className={cn("text-[9px] font-bold uppercase", nicheColor)}>
            {tenant.niche}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground">
          {tenant.messageCount} msgs · usado {relativeTime(tenant.lastUsed)} · criado {relativeTime(tenant.createdAt)}
        </p>
      </div>
      <button
        type="button"
        onClick={onCleanup}
        className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] font-medium text-red-400 hover:bg-red-500/20 transition-colors"
        title="Remover tenant de teste"
      >
        <Trash2 className="size-3" />
        <span className="hidden sm:inline">Limpar</span>
      </button>
    </motion.div>
  );
}
