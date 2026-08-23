'use client';

// ==============================================================================
// DDC KPI HERO — Premium KPI cards with sparklines for DDC overview
// ==============================================================================
// Shows 4 hero KPI cards with:
//   - Big number (formatted BRL or %)
//   - Trend indicator (up/down/flat with delta)
//   - Mini sparkline using recharts (last 7 days)
//   - Niche-themed accent color
// Designed to make the dashboard feel "premium" the moment it loads.
// ==============================================================================

import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Minus, type LucideIcon } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, YAxis } from 'recharts';

export interface KpiHeroData {
  id: string;
  label: string;
  value: string;
  delta?: number; // percentage change vs previous period
  deltaLabel?: string; // e.g., "vs semana passada"
  icon: LucideIcon;
  spark: { day: string; value: number }[];
}

interface DDCKpiHeroProps {
  kpis: KpiHeroData[];
  accentColor: string; // hex like '#10b981' for pousada, '#3b82f6' for airbnb
}

export function DDCKpiHero({ kpis, accentColor }: DDCKpiHeroProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {kpis.map((kpi, idx) => {
        const Icon = kpi.icon;
        const isUp = (kpi.delta ?? 0) > 0;
        const isDown = (kpi.delta ?? 0) < 0;
        const isFlat = (kpi.delta ?? 0) === 0;
        const TrendIcon = isUp ? ArrowUpRight : isDown ? ArrowDownRight : Minus;
        const trendColor = isUp ? 'text-emerald-400' : isDown ? 'text-rose-400' : 'text-zinc-400';

        return (
          <motion.div
            key={kpi.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-4 hover:border-white/[0.12] transition-all group"
          >
            {/* Decorative gradient blob */}
            <div
              className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-30"
              style={{ background: accentColor }}
            />

            <div className="relative flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${accentColor}20`, color: accentColor }}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/50">
                  {kpi.label}
                </span>
              </div>
            </div>

            <div className="relative flex items-end justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-2xl font-bold text-white tracking-tight truncate">
                  {kpi.value}
                </div>
                {kpi.delta !== undefined && (
                  <div className="flex items-center gap-1 mt-1">
                    <TrendIcon className={`w-3 h-3 ${trendColor}`} />
                    <span className={`text-xs font-semibold ${trendColor}`}>
                      {isUp ? '+' : ''}{kpi.delta.toFixed(1)}%
                    </span>
                    {kpi.deltaLabel && (
                      <span className="text-[10px] text-white/40 ml-1 truncate">
                        {kpi.deltaLabel}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Mini sparkline */}
              <div className="w-20 h-10 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={kpi.spark} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
                    <defs>
                      <linearGradient id={`spark-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={accentColor} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <YAxis hide domain={['dataMin', 'dataMax']} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={accentColor}
                      strokeWidth={1.5}
                      fill={`url(#spark-${kpi.id})`}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
