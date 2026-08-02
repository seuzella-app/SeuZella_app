'use client';

// ==============================================================================
// ZCC KPI CARD — Reusable stat card with recharts sparkline + delta + tooltip
// ==============================================================================
// Replaces the inline MiniSparkline SVG with a proper recharts AreaChart
// that has hover tooltip, gradient fill, and smooth animation.
// ==============================================================================

import { motion } from 'framer-motion';
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface ZCCKpiCardProps {
  label: string;
  value: string;
  color: string;
  sparkData?: number[];
  delta?: number; // percentage change vs previous period
  deltaLabel?: string; // e.g. "vs semana passada"
  icon?: React.ElementType;
  hint?: string;
  isLoading?: boolean;
  delay?: number;
}

interface TooltipEntry {
  value: number;
}

function SparklineTooltip({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      className="px-2 py-1 rounded border text-[10px] font-mono"
      style={{
        background: 'var(--zcc-lacquer-sunken)',
        borderColor: 'var(--zcc-hairline-strong)',
        color: 'var(--zcc-champagne)',
      }}
    >
      {payload[0].value.toLocaleString('pt-BR')}
    </div>
  );
}

export function ZCCKpiCard({
  label,
  value,
  color,
  sparkData,
  delta,
  deltaLabel,
  icon: Icon,
  hint,
  isLoading,
  delay = 0,
}: ZCCKpiCardProps) {
  if (isLoading) {
    return (
      <div className="zcc-panel p-4">
        <div className="zcc-eyebrow">&nbsp;</div>
        <div
          className="h-5 w-16 rounded shimmer"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        />
        <div
          className="h-3 w-12 mt-2 rounded"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        />
      </div>
    );
  }

  // Convert sparkData to chart data
  const chartData = sparkData
    ? sparkData.map((v, i) => ({ idx: i, value: Math.round(v) }))
    : [];

  const isDeltaPositive = delta !== undefined && delta >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="zcc-panel p-4 relative overflow-hidden group"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="zcc-eyebrow">{label}</div>
        {Icon && (
          <Icon
            className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity"
            style={{ color }}
          />
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <div
          className="text-lg font-bold font-mono"
          style={{ color }}
        >
          {value}
        </div>
        {delta !== undefined && (
          <div
            className="flex items-center gap-0.5 text-[10px] font-mono"
            style={{ color: isDeltaPositive ? 'var(--zcc-success)' : 'var(--zcc-danger)' }}
          >
            {isDeltaPositive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
            {isDeltaPositive ? '+' : ''}{delta}%
          </div>
        )}
      </div>

      {deltaLabel && (
        <div className="text-[9px] font-mono mt-0.5" style={{ color: 'var(--zcc-text-muted)' }}>
          {deltaLabel}
        </div>
      )}

      {hint && (
        <div className="text-[9px] font-mono mt-1" style={{ color: 'var(--zcc-text-muted)' }}>
          {hint}
        </div>
      )}

      {chartData.length > 1 && (
        <div className="mt-2 -mx-1 h-8" style={{ pointerEvents: 'none' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 2, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id={`spark-gradient-${label.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={1.5}
                fill={`url(#spark-gradient-${label.replace(/\s+/g, '-')})`}
                isAnimationActive={false}
              />
              <Tooltip
                content={<SparklineTooltip />}
                cursor={{ stroke: color, strokeWidth: 0.5, strokeDasharray: '2 2' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
}
