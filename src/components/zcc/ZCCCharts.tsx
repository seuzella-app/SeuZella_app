'use client';

// ==============================================================================
// ZCC CHARTS — Real recharts components for the Overview tab
// ==============================================================================
// Three reusable chart components:
//   - ZCCMrrAreaChart: stacked area chart of MRR over 14 days (pousada vs airbnb)
//   - ZCCReservationsBarChart: bar chart of daily reservations
//   - ZCCNicheDonut: donut chart showing niche distribution
//
// All charts use the existing ZCC color palette (kinpaku / patina / champagne).
// ==============================================================================

import {
  Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from 'recharts';

// ── Shared tooltip ────────────────────────────────────────────────────────────
function ZCCChartTooltip({ active, payload, label, formatter }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  formatter?: (value: number, name: string) => string;
}) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      className="px-2.5 py-1.5 rounded border text-[10px] font-mono"
      style={{
        background: 'var(--zcc-lacquer-sunken)',
        borderColor: 'var(--zcc-hairline-strong)',
      }}
    >
      {label && (
        <div className="mb-1" style={{ color: 'var(--zcc-text-muted)' }}>
          {label}
        </div>
      )}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-sm"
            style={{ background: p.color }}
          />
          <span style={{ color: 'var(--zcc-text-secondary)' }}>{p.name}:</span>
          <span style={{ color: 'var(--zcc-champagne)' }}>
            {formatter ? formatter(p.value, p.name) : p.value.toLocaleString('pt-BR')}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── MRR Area Chart (stacked pousada + airbnb + parceiro) ─────────────────────
export interface MrrDataPoint {
  date: string;
  pousada: number;
  airbnb: number;
  parceiro: number;
}

export function ZCCMrrAreaChart({ data, height = 200 }: { data: MrrDataPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="mrr-pousada" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d4a843" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#d4a843" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="mrr-airbnb" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4a9a9a" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#4a9a9a" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="mrr-parceiro" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c45454" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#c45454" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,168,67,0.06)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: 'var(--zcc-text-muted)', fontSize: 9, fontFamily: 'monospace' }}
          tickLine={false}
          axisLine={{ stroke: 'var(--zcc-hairline)' }}
        />
        <YAxis
          tick={{ fill: 'var(--zcc-text-muted)', fontSize: 9, fontFamily: 'monospace' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          content={<ZCCChartTooltip formatter={(v) => `R$ ${v.toLocaleString('pt-BR')}`} />}
          cursor={{ stroke: 'var(--zcc-hairline-strong)', strokeWidth: 1 }}
        />
        <Area
          type="monotone"
          dataKey="pousada"
          stackId="mrr"
          stroke="#d4a843"
          strokeWidth={1.5}
          fill="url(#mrr-pousada)"
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="airbnb"
          stackId="mrr"
          stroke="#4a9a9a"
          strokeWidth={1.5}
          fill="url(#mrr-airbnb)"
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="parceiro"
          stackId="mrr"
          stroke="#c45454"
          strokeWidth={1.5}
          fill="url(#mrr-parceiro)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Reservations Bar Chart ────────────────────────────────────────────────────
export interface ReservationDataPoint {
  date: string;
  direct: number;
  airbnb: number;
  booking: number;
}

export function ZCCReservationsBarChart({ data, height = 180 }: { data: ReservationDataPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,168,67,0.06)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: 'var(--zcc-text-muted)', fontSize: 9, fontFamily: 'monospace' }}
          tickLine={false}
          axisLine={{ stroke: 'var(--zcc-hairline)' }}
        />
        <YAxis
          tick={{ fill: 'var(--zcc-text-muted)', fontSize: 9, fontFamily: 'monospace' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          content={<ZCCChartTooltip />}
          cursor={{ fill: 'rgba(212,168,67,0.04)' }}
        />
        <Bar dataKey="direct" stackId="res" fill="#d4a843" isAnimationActive={false} radius={[0, 0, 0, 0]} />
        <Bar dataKey="airbnb" stackId="res" fill="#4a9a9a" isAnimationActive={false} radius={[0, 0, 0, 0]} />
        <Bar dataKey="booking" stackId="res" fill="#5a9a6a" isAnimationActive={false} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Niche Distribution Donut ─────────────────────────────────────────────────
export interface NicheDataPoint {
  name: string;
  value: number;
  color: string;
}

export function ZCCNicheDonut({ data, height = 180 }: { data: NicheDataPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={45}
          outerRadius={70}
          paddingAngle={2}
          isAnimationActive={false}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} stroke="var(--zcc-lacquer-raised)" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip
          content={<ZCCChartTooltip formatter={(v) => `${v} clientes`} />}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
