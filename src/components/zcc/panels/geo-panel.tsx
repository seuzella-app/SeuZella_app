"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Building2,
  Home,
  DollarSign,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  Layers,
  Users,
  Star,
  RefreshCw,
  Link2,
} from "lucide-react";
import { PanelHeader } from "../shared/panel-header";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/*
 * GeoMetricsPanel — Resumo agregado da aba Live Leads.
 *
 * CRUZAMENTO DE DADOS:
 *  - GET /api/zcc/metrics/geographic → agrega leads por UF (mesma fonte do LiveLeadsPanel)
 *  - Total de leads, convertidos, hot leads vêm do mesmo dataset
 *  - Pousada vs Airbnb split baseado em comportamento de compra
 *  - MRR estimado por plano convertido (MAX/PRO/PARCEIRO/LITE)
 *
 * Em mock mode (Vercel sem DB): usa /lib/zcc/mock-data.ts → leads[]
 * Em produção: complementa com Tenants ativos do Prisma
 */

interface CityDetail {
  name: string;
  pousadas: number;
  airbnb: number;
  mrr: number;
  leads?: number;
}

interface StateGeo {
  uf: string;
  name: string;
  pousadas: number;
  airbnb: number;
  mrr: number;
  growth: number;
  leads: number;
  convertedLeads: number;
  hotLeads: number;
  avgScore: number;
  cities: CityDetail[];
}

interface GeoApiData {
  states: StateGeo[];
  totals: {
    states: number;
    pousadas: number;
    airbnb: number;
    mrr: number;
    leads: number;
    convertedLeads: number;
    hotLeads: number;
  };
  sourceLeadsCount: number;
  sourceNote: string;
}

interface GeoApiResponse {
  success?: boolean;
  data?: GeoApiData;
  meta?: { source: string };
}

const FALLBACK_STATES: StateGeo[] = [
  {
    uf: "SC",
    name: "Santa Catarina",
    pousadas: 14,
    airbnb: 9,
    mrr: 18450,
    growth: 12.4,
    leads: 23,
    convertedLeads: 8,
    hotLeads: 6,
    avgScore: 84,
    cities: [
      { name: "Florianópolis", pousadas: 6, airbnb: 5, mrr: 8200, leads: 8 },
      { name: "Balneário Camboriú", pousadas: 4, airbnb: 2, mrr: 5400, leads: 6 },
      { name: "Camboriú", pousadas: 2, airbnb: 1, mrr: 2650, leads: 4 },
      { name: "Garopaba", pousadas: 2, airbnb: 1, mrr: 2200, leads: 5 },
    ],
  },
  {
    uf: "RJ",
    name: "Rio de Janeiro",
    pousadas: 11,
    airbnb: 13,
    mrr: 16720,
    growth: 8.7,
    leads: 19,
    convertedLeads: 6,
    hotLeads: 5,
    avgScore: 80,
    cities: [
      { name: "Búzios", pousadas: 5, airbnb: 6, mrr: 7200, leads: 7 },
      { name: "Paraty", pousadas: 4, airbnb: 3, mrr: 5400, leads: 5 },
      { name: "Angra dos Reis", pousadas: 2, airbnb: 3, mrr: 2820, leads: 4 },
      { name: "Rio de Janeiro", pousadas: 0, airbnb: 1, mrr: 1300, leads: 3 },
    ],
  },
  {
    uf: "BA",
    name: "Bahia",
    pousadas: 9,
    airbnb: 7,
    mrr: 13980,
    growth: 15.2,
    leads: 16,
    convertedLeads: 5,
    hotLeads: 4,
    avgScore: 82,
    cities: [
      { name: "Trancoso", pousadas: 4, airbnb: 2, mrr: 6100, leads: 5 },
      { name: "Porto Seguro", pousadas: 3, airbnb: 2, mrr: 4300, leads: 4 },
      { name: "Salvador", pousadas: 1, airbnb: 2, mrr: 2080, leads: 4 },
      { name: "Morro de São Paulo", pousadas: 1, airbnb: 1, mrr: 1500, leads: 3 },
    ],
  },
  {
    uf: "SP",
    name: "São Paulo",
    pousadas: 8,
    airbnb: 11,
    mrr: 12640,
    growth: 4.3,
    leads: 15,
    convertedLeads: 4,
    hotLeads: 3,
    avgScore: 75,
    cities: [
      { name: "Ilhabela", pousadas: 3, airbnb: 2, mrr: 4200, leads: 4 },
      { name: "São Sebastião", pousadas: 2, airbnb: 3, mrr: 3100, leads: 4 },
      { name: "Ubatuba", pousadas: 2, airbnb: 3, mrr: 2840, leads: 4 },
      { name: "São Paulo", pousadas: 1, airbnb: 3, mrr: 2500, leads: 3 },
    ],
  },
  {
    uf: "RS",
    name: "Rio Grande do Sul",
    pousadas: 6,
    airbnb: 3,
    mrr: 7920,
    growth: 6.1,
    leads: 12,
    convertedLeads: 3,
    hotLeads: 2,
    avgScore: 78,
    cities: [
      { name: "Torres", pousadas: 3, airbnb: 1, mrr: 3800, leads: 5 },
      { name: "Capão da Canoa", pousadas: 2, airbnb: 1, mrr: 2400, leads: 4 },
      { name: "Gramado", pousadas: 1, airbnb: 1, mrr: 1720, leads: 3 },
    ],
  },
  {
    uf: "PE",
    name: "Pernambuco",
    pousadas: 5,
    airbnb: 4,
    mrr: 6480,
    growth: 9.8,
    leads: 10,
    convertedLeads: 2,
    hotLeads: 2,
    avgScore: 76,
    cities: [
      { name: "Porto de Galinhas", pousadas: 3, airbnb: 2, mrr: 3800, leads: 4 },
      { name: "Recife", pousadas: 1, airbnb: 1, mrr: 1500, leads: 3 },
      { name: "Maragogi", pousadas: 1, airbnb: 1, mrr: 1180, leads: 3 },
    ],
  },
  {
    uf: "CE",
    name: "Ceará",
    pousadas: 4,
    airbnb: 5,
    mrr: 5360,
    growth: 11.5,
    leads: 9,
    convertedLeads: 2,
    hotLeads: 2,
    avgScore: 80,
    cities: [
      { name: "Jericoacoara", pousadas: 2, airbnb: 2, mrr: 2600, leads: 4 },
      { name: "Fortaleza", pousadas: 1, airbnb: 2, mrr: 1760, leads: 3 },
      { name: "Cumbuco", pousadas: 1, airbnb: 1, mrr: 1000, leads: 2 },
    ],
  },
];

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function GeoMetricsPanel() {
  const [states, setStates] = React.useState<StateGeo[]>(FALLBACK_STATES);
  const [totals, setTotals] = React.useState({
    states: FALLBACK_STATES.length,
    pousadas: FALLBACK_STATES.reduce((s, st) => s + st.pousadas, 0),
    airbnb: FALLBACK_STATES.reduce((s, st) => s + st.airbnb, 0),
    mrr: FALLBACK_STATES.reduce((s, st) => s + st.mrr, 0),
    leads: FALLBACK_STATES.reduce((s, st) => s + st.leads, 0),
    convertedLeads: FALLBACK_STATES.reduce((s, st) => s + st.convertedLeads, 0),
    hotLeads: FALLBACK_STATES.reduce((s, st) => s + st.hotLeads, 0),
  });
  const [loading, setLoading] = React.useState(false);
  const [dataSource, setDataSource] = React.useState<string>("fallback");
  const [expandedUf, setExpandedUf] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/zcc/metrics/geographic");
      if (!res.ok) throw new Error("API error");
      const json: GeoApiResponse = await res.json();
      if (json?.success !== false && json?.data?.states?.length) {
        setStates(json.data.states);
        setTotals({
          states: json.data.totals.states,
          pousadas: json.data.totals.pousadas,
          airbnb: json.data.totals.airbnb,
          mrr: json.data.totals.mrr,
          leads: json.data.totals.leads,
          convertedLeads: json.data.totals.convertedLeads,
          hotLeads: json.data.totals.hotLeads,
        });
        setDataSource(json.meta?.source ?? "api");
      }
    } catch {
      setDataSource("fallback");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const maxMrr = React.useMemo(
    () => Math.max(...states.map((s) => s.mrr), 1),
    [states]
  );

  const sortedStates = React.useMemo(
    () => [...states].sort((a, b) => b.mrr - a.mrr).slice(0, 10),
    [states]
  );

  const toggleExpand = (uf: string) => {
    setExpandedUf((prev) => (prev === uf ? null : uf));
  };

  const handleRefresh = () => {
    loadData();
    toast.success("Métricas geográficas atualizadas", {
      description: `${totals.states} estados · ${totals.leads} leads agregados`,
    });
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader
        title="Geo Metrics"
        description="Resumo agregado do Live Leads · pousadas, airbnb & MRR por estado"
        icon={<MapPin className="size-5" />}
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
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
              Atualizar
            </button>
          </div>
        }
      />

      <div className="zcc-scroll flex-1 overflow-y-auto p-4 sm:p-6">
        {/* ====== AVISO DE CRUZAMENTO DE DADOS ====== */}
        <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Link2 className="size-3.5 text-primary" />
            <span>
              <strong className="text-foreground">Cruzamento ativo:</strong>{" "}
              esta aba agrega{" "}
              <code className="font-mono text-primary">{totals.leads} leads</code>{" "}
              da mesma fonte do <strong className="text-foreground">Live Leads</strong>{" "}
              · <code className="font-mono text-primary">{totals.convertedLeads} convertidos</code>{" "}
              · <code className="font-mono text-primary">{totals.hotLeads} hot leads</code>{" "}
              · fonte: <code className="font-mono text-primary">{dataSource}</code>
            </span>
          </p>
        </div>

        {/* ====== QUICK STATS ====== */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          <QuickStatCard
            icon={<MapPin className="size-4" />}
            label="Estados cobertos"
            value={String(totals.states)}
            hint="regiões ativas"
          />
          <QuickStatCard
            icon={<Users className="size-4" />}
            label="Total leads"
            value={String(totals.leads)}
            hint={`${totals.hotLeads} hot leads`}
          />
          <QuickStatCard
            icon={<Building2 className="size-4" />}
            label="Pousadas vs Airbnb"
            value={`${totals.pousadas}p · ${totals.airbnb}a`}
            hint="distribuição por niche"
          />
          <QuickStatCard
            icon={<DollarSign className="size-4" />}
            label="Total MRR estimado"
            value={fmtBRL(totals.mrr)}
            hint="receita recorrente convertida"
            highlight
          />
        </motion.div>

        {/* ====== SPLIT BARS ====== */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="mb-6"
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Layers className="size-3.5 text-primary" />
              Pousada vs Airbnb · split por estado
            </h3>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1 text-muted-foreground">
                <span className="size-2 rounded-sm bg-primary" />
                Pousada
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <span className="size-2 rounded-sm bg-teal-400" />
                Airbnb
              </span>
            </div>
          </div>
          <div className="space-y-2 rounded-lg border border-border bg-card p-4">
            {sortedStates.map((st, idx) => {
              const total = st.pousadas + st.airbnb;
              const pousadaPct = total > 0 ? (st.pousadas / total) * 100 : 0;
              const airbnbPct = total > 0 ? (st.airbnb / total) * 100 : 0;
              return (
                <motion.div
                  key={st.uf}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: idx * 0.04 }}
                  className="grid grid-cols-[60px_1fr_70px] items-center gap-3"
                >
                  <span className="text-xs font-semibold text-foreground">
                    {st.uf}
                  </span>
                  <div className="flex h-2.5 overflow-hidden rounded-full bg-secondary">
                    <motion.div
                      className="h-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${pousadaPct}%` }}
                      transition={{ duration: 0.5, delay: idx * 0.04 + 0.1 }}
                    />
                    <motion.div
                      className="h-full bg-teal-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${airbnbPct}%` }}
                      transition={{ duration: 0.5, delay: idx * 0.04 + 0.15 }}
                    />
                  </div>
                  <span className="text-right text-[10px] text-muted-foreground">
                    {st.pousadas}p · {st.airbnb}a
                  </span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* ====== TABLE TOP 10 STATES ====== */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <TrendingUp className="size-3.5 text-primary" />
              Top {sortedStates.length} estados por MRR
            </h3>
            <span className="text-[10px] text-muted-foreground">
              clique para ver cidades
            </span>
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {/* Header */}
            <div className="grid grid-cols-[2.5rem_1fr_3.5rem_3.5rem_4rem_3.5rem_3rem_2rem] items-center gap-2 border-b border-border bg-secondary/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>#</span>
              <span>Estado</span>
              <span className="text-center">Leads</span>
              <span className="text-center">Conv.</span>
              <span className="text-right">MRR</span>
              <span className="text-right">Score</span>
              <span className="text-right">Growth</span>
              <span />
            </div>
            {/* Rows */}
            <div>
              {sortedStates.map((st, idx) => {
                const isExpanded = expandedUf === st.uf;
                const barPct = (st.mrr / maxMrr) * 100;
                return (
                  <div key={st.uf} className="border-b border-border last:border-0">
                    <button
                      type="button"
                      onClick={() => toggleExpand(st.uf)}
                      className="grid w-full grid-cols-[2.5rem_1fr_3.5rem_3.5rem_4rem_3.5rem_3rem_2rem] items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-secondary/20"
                    >
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-foreground">
                          {st.name}
                        </p>
                        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-secondary">
                          <motion.div
                            className="h-full bg-primary/70"
                            initial={{ width: 0 }}
                            animate={{ width: `${barPct}%` }}
                            transition={{ duration: 0.5, delay: idx * 0.03 }}
                          />
                        </div>
                      </div>
                      <span className="text-center text-xs font-medium text-foreground">
                        {st.leads}
                      </span>
                      <span className="text-center text-xs font-medium text-emerald-400">
                        {st.convertedLeads}
                      </span>
                      <span className="text-right font-mono text-xs font-semibold text-primary">
                        {fmtBRL(st.mrr)}
                      </span>
                      <span className="flex items-center justify-end gap-0.5 text-xs font-medium text-foreground">
                        <Star className="size-2.5 text-amber-400" />
                        {st.avgScore || 0}
                      </span>
                      <span
                        className={cn(
                          "text-right text-xs font-medium",
                          st.growth >= 10
                            ? "text-emerald-400"
                            : st.growth >= 5
                              ? "text-amber-400"
                              : "text-muted-foreground"
                        )}
                      >
                        +{st.growth.toFixed(1)}%
                      </span>
                      <span className="flex justify-end text-muted-foreground">
                        {isExpanded ? (
                          <ChevronDown className="size-3.5" />
                        ) : (
                          <ChevronRight className="size-3.5" />
                        )}
                      </span>
                    </button>

                    {/* Expanded cities */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden bg-background/40"
                        >
                          <div className="px-3 py-2">
                            <div className="grid grid-cols-[1fr_3rem_3rem_3rem_5rem] gap-2 border-b border-border px-2 pb-1.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                              <span>Cidade</span>
                              <span className="text-center">Leads</span>
                              <span className="text-center">Pous.</span>
                              <span className="text-center">Airb.</span>
                              <span className="text-right">MRR</span>
                            </div>
                            <div className="mt-1 space-y-0.5">
                              {st.cities.map((city) => (
                                <div
                                  key={city.name}
                                  className="grid grid-cols-[1fr_3rem_3rem_3rem_5rem] items-center gap-2 rounded px-2 py-1 text-[11px] hover:bg-secondary/20"
                                >
                                  <span className="flex items-center gap-1.5 truncate text-foreground">
                                    <MapPin className="size-3 text-muted-foreground" />
                                    {city.name}
                                  </span>
                                  <span className="text-center text-muted-foreground">
                                    {city.leads ?? 0}
                                  </span>
                                  <span className="text-center text-muted-foreground">
                                    {city.pousadas}
                                  </span>
                                  <span className="text-center text-muted-foreground">
                                    {city.airbnb}
                                  </span>
                                  <span className="text-right font-mono text-foreground">
                                    {fmtBRL(city.mrr)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* ====== RODAPÉ ====== */}
        <div className="mt-6 rounded-lg border border-border bg-card p-3 text-[10px] text-muted-foreground">
          <p>
            <strong className="text-foreground">Cruzamento de dados:</strong>{" "}
            Esta aba consome{" "}
            <code className="font-mono text-primary">GET /api/zcc/metrics/geographic</code>{" "}
            que agrega{" "}
            <code className="font-mono text-primary">{totals.leads} leads</code>{" "}
            da mesma fonte do{" "}
            <code className="font-mono text-primary">LiveLeadsPanel</code> (mock-data.ts){" "}
            e complementa com{" "}
            <code className="font-mono text-primary">Tenants ativos</code> do Prisma.{" "}
            MRR estimado por plano convertido (MAX R$797, PRO R$397, PARCEIRO R$247, LITE R$197).
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTES
// ============================================================================

function QuickStatCard({
  icon,
  label,
  value,
  hint,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div
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
      </div>
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-xl font-bold",
          highlight ? "text-primary" : "text-foreground"
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>
      ) : null}
      <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-primary transition-all duration-500 hover:w-full" />
    </div>
  );
}
