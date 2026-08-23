"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Building2, BedDouble, Users, DollarSign, TrendingUp,
  Calendar, CheckCircle2, AlertCircle, Clock, Wifi,
} from "lucide-react";
import { PanelHeader } from "../shared/panel-header";
import { cn } from "@/lib/utils";

/*
 * PousadasPanel — baseado no PousadasPanel.tsx real do projeto.
 * Usa Card/Badge/Button do shadcn/ui (aqui adaptado para o tema do sandbox).
 * Mostra pousadas com: quartos, ocupação, reservas, receita, status.
 */

interface Pousada {
  id: string;
  name: string;
  city: string;
  uf: string;
  plan: "LITE" | "PRO" | "MAX" | "PARCEIRO";
  rooms: number;
  occupiedRooms: number;
  reservations: number;
  revenue: number;
  status: "active" | "onboarding" | "suspended";
  lastActive: string;
  whatsappConnected: boolean;
}

const MOCK_POUSADAS: Pousada[] = [
  { id: "p1", name: "Pousada Serenity Paraty", city: "Paraty", uf: "RJ", plan: "MAX", rooms: 18, occupiedRooms: 14, reservations: 47, revenue: 18400, status: "active", lastActive: "há 2h", whatsappConnected: true },
  { id: "p2", name: "Pousada Mar de Camburi", city: "São Sebastião", uf: "SP", plan: "PRO", rooms: 16, occupiedRooms: 12, reservations: 31, revenue: 12700, status: "active", lastActive: "há 1h", whatsappConnected: true },
  { id: "p3", name: "Pousada Floripa Beira Mar", city: "Florianópolis", uf: "SC", plan: "PRO", rooms: 15, occupiedRooms: 9, reservations: 24, revenue: 6800, status: "active", lastActive: "há 30min", whatsappConnected: true },
  { id: "p4", name: "Pousada Refúgio da Praia", city: "Ilhabela", uf: "SP", plan: "MAX", rooms: 9, occupiedRooms: 7, reservations: 19, revenue: 5400, status: "active", lastActive: "há 5h", whatsappConnected: false },
  { id: "p5", name: "Pousada Encanto da Serra", city: "Morretes", uf: "PR", plan: "LITE", rooms: 8, occupiedRooms: 4, reservations: 12, revenue: 3200, status: "active", lastActive: "há 1d", whatsappConnected: true },
  { id: "p6", name: "Pousada Costa Verde Torres", city: "Torres", uf: "RS", plan: "LITE", rooms: 9, occupiedRooms: 0, reservations: 0, revenue: 0, status: "onboarding", lastActive: "há 3d", whatsappConnected: false },
];

const PLAN_COLORS: Record<string, string> = {
  LITE: "text-sky-400 bg-sky-500/15 border-sky-500/30",
  PRO: "text-violet-400 bg-violet-500/15 border-violet-500/30",
  MAX: "text-amber-400 bg-amber-500/15 border-amber-500/30",
  PARCEIRO: "text-rose-400 bg-rose-500/15 border-rose-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  active: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
  onboarding: "text-amber-400 bg-amber-500/15 border-amber-500/30",
  suspended: "text-red-400 bg-red-500/15 border-red-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  onboarding: "Onboarding",
  suspended: "Suspenso",
};

export function PousadasPanel() {
  const [pousadas] = React.useState<Pousada[]>(MOCK_POUSADAS);
  const [selected, setSelected] = React.useState<Pousada | null>(null);

  const totalRooms = pousadas.reduce((s, p) => s + p.rooms, 0);
  const totalOccupied = pousadas.reduce((s, p) => s + p.occupiedRooms, 0);
  const totalRevenue = pousadas.reduce((s, p) => s + p.revenue, 0);
  const totalReservations = pousadas.reduce((s, p) => s + p.reservations, 0);
  const occupancyRate = totalRooms > 0 ? Math.round((totalOccupied / totalRooms) * 100) : 0;

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader
        title="Pousadas · Hotelaria & Recepção"
        description={`${pousadas.length} pousadas · ${totalRooms} quartos · ${occupancyRate}% ocupação · ${totalReservations} reservas`}
        icon={<Building2 className="size-5" />}
      />

      <div className="zcc-scroll flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <KpiCard label="Pousadas" value={pousadas.length} hint={`${pousadas.filter(p => p.status === "active").length} ativas`} icon={<Building2 />} />
          <KpiCard label="Quartos" value={totalRooms} hint={`${totalOccupied} ocupados`} icon={<BedDouble />} />
          <KpiCard label="Ocupação" value={`${occupancyRate}%`} icon={<TrendingUp />} tone="primary" />
          <KpiCard label="Reservas" value={totalReservations} icon={<Calendar />} />
          <KpiCard label="Receita" value={totalRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} icon={<DollarSign />} tone="primary" />
        </div>

        {/* Pousada cards grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pousadas.map((p, i) => {
            const occ = p.rooms > 0 ? Math.round((p.occupiedRooms / p.rooms) * 100) : 0;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelected(p)}
                className={cn(
                  "rounded-lg border bg-card p-3 cursor-pointer transition-all hover:border-primary/40",
                  selected?.id === p.id ? "border-primary ring-1 ring-primary/40" : "border-border"
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-semibold text-foreground">{p.name}</h4>
                    <p className="text-[10px] text-muted-foreground">{p.city}/{p.uf}</p>
                  </div>
                  <span className={cn("shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase", PLAN_COLORS[p.plan])}>
                    {p.plan}
                  </span>
                </div>

                {/* Status + WhatsApp */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn("rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase", STATUS_COLORS[p.status])}>
                    {STATUS_LABELS[p.status]}
                  </span>
                  {p.whatsappConnected ? (
                    <span className="flex items-center gap-0.5 text-[9px] text-emerald-400">
                      <Wifi className="size-2.5" /> WhatsApp
                    </span>
                  ) : (
                    <span className="text-[9px] text-muted-foreground">WhatsApp desconectado</span>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div>
                    <p className="text-muted-foreground">Quartos</p>
                    <p className="font-bold text-foreground">{p.rooms}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Ocupados</p>
                    <p className="font-bold text-foreground">{p.occupiedRooms}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Reservas</p>
                    <p className="font-bold text-foreground">{p.reservations}</p>
                  </div>
                </div>

                {/* Occupancy bar */}
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-0.5">
                    <span>Ocupação</span>
                    <span className={cn("font-bold", occ >= 75 ? "text-emerald-400" : occ >= 50 ? "text-amber-400" : "text-red-400")}>{occ}%</span>
                  </div>
                  <div className="h-1.5 bg-secondary/40 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", occ >= 75 ? "bg-emerald-500" : occ >= 50 ? "bg-amber-500" : "bg-red-500")}
                      style={{ width: `${occ}%` }}
                    />
                  </div>
                </div>

                {/* Revenue */}
                <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-2">
                  <span className="text-[9px] text-muted-foreground">Receita</span>
                  <span className="text-xs font-bold text-emerald-400">
                    {p.revenue > 0 ? p.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : "—"}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* DDC link */}
        <a
          href="/ddc/pousada"
          className="flex items-center justify-between rounded-lg border border-border bg-card p-3 hover:border-primary/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-sky-400" />
            <div>
              <p className="text-sm font-semibold text-foreground">DDC Pousada</p>
              <p className="text-[10px] text-muted-foreground">Dashboard detalhado do cliente pousada</p>
            </div>
          </div>
          <span className="text-[11px] text-primary">Abrir →</span>
        </a>

        {/* Aviso */}
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200/90">
          <strong className="font-semibold">⚠️ PousadasPanel:</strong> Dados dos models Prisma{" "}
          <code className="rounded bg-background/60 px-1 py-0.5 font-mono">Property</code>,{" "}
          <code className="rounded bg-background/60 px-1 py-0.5 font-mono">Room</code>,{" "}
          <code className="rounded bg-background/60 px-1 py-0.5 font-mono">Booking</code>,{" "}
          <code className="rounded bg-background/60 px-1 py-0.5 font-mono">Reservation</code>.
          Em produção, hidratar via <code className="rounded bg-background/60 px-1 py-0.5 font-mono">/api/zcc/metrics</code>.
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
