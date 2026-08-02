'use client';

// ==============================================================================
// BI TAB — MAX plan tab (R$797/mês)
// ==============================================================================
// Business Intelligence avançado para o plano MAX.
// Without this tab, MAX had ZERO additional DDC tabs vs PRO (R$397) —
// massive value perception problem.
//
// Features:
//   - Heatmap de ocupação por canal (WhatsApp/Booking/Airbnb/Direto)
//   - Previsão de demanda (7/30 dias) — mock forecast
//   - Benchmark vs mercado regional
//   - Alertas de churn preditivo
//   - Análise de ADR (Average Daily Rate) por período
// ==============================================================================

import { motion } from 'framer-motion';
import {
  BarChart3,
  TrendingUp,
  Flame,
  Brain,
  AlertTriangle,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

// ─── Mock Data ───────────────────────────────────────────────────────────────

// Heatmap: days × channels — value = occupancy %
const HEATMAP_DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const HEATMAP_CHANNELS = ['WhatsApp', 'Booking', 'Airbnb', 'Direto'];
const HEATMAP_DATA: number[][] = [
  [45, 62, 38, 22], // Seg
  [52, 68, 41, 28], // Ter
  [58, 71, 48, 32], // Qua
  [65, 75, 56, 38], // Qui
  [88, 92, 84, 65], // Sex
  [95, 98, 96, 78], // Sáb
  [82, 88, 79, 58], // Dom
];

const FORECAST_DATA = [
  { day: 'Hoje', real: 78, previsto: 80 },
  { day: '+1d', real: 82, previsto: 81 },
  { day: '+2d', real: null, previsto: 85 },
  { day: '+3d', real: null, previsto: 88 },
  { day: '+4d', real: null, previsto: 91 },
  { day: '+5d', real: null, previsto: 89 },
  { day: '+6d', real: null, previsto: 92 },
  { day: '+7d', real: null, previsto: 95 },
];

const BENCHMARK_DATA = [
  { metric: 'Ocupação', you: 78, market: 65, unit: '%' },
  { metric: 'ADR', you: 420, market: 380, unit: 'R$' },
  { metric: 'RevPAR', you: 327, market: 247, unit: 'R$' },
  { metric: 'Conversão', you: 34, market: 22, unit: '%' },
];

const ADR_DATA = [
  { month: 'Mar', adr: 380, prev: 360 },
  { month: 'Abr', adr: 395, prev: 380 },
  { month: 'Mai', adr: 410, prev: 395 },
  { month: 'Jun', adr: 425, prev: 410 },
  { month: 'Jul', adr: 460, prev: 425 },
  { month: 'Ago', adr: 490, prev: 460 },
];

const CHURN_ALERTS = [
  { id: '1', type: 'high', label: 'Hóspede recorrente sem reserva há 45 dias', detail: 'Maria S. — 4 reservas anteriores', probability: 78 },
  { id: '2', type: 'medium', label: 'Quarto Standard com ocupação caindo', detail: 'Q3: -18% vs mês passado', probability: 54 },
  { id: '3', type: 'low', label: 'Avaliação média abaixo de 4.5', detail: 'Última semana: 4.3 estrelas', probability: 32 },
];

// ─── Chart Configs ───────────────────────────────────────────────────────────

const forecastChartConfig: ChartConfig = {
  real: { label: 'Real', color: '#10b981' },
  previsto: { label: 'Previsto', color: '#f59e0b' },
};

const adrChartConfig: ChartConfig = {
  adr: { label: 'ADR Atual', color: '#10b981' },
  prev: { label: 'ADR Anterior', color: '#6366f1' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getHeatmapColor(value: number): { bg: string; text: string } {
  if (value >= 90) return { bg: 'bg-emerald-500/90', text: 'text-white' };
  if (value >= 75) return { bg: 'bg-emerald-500/70', text: 'text-white' };
  if (value >= 60) return { bg: 'bg-emerald-500/50', text: 'text-white' };
  if (value >= 40) return { bg: 'bg-amber-500/50', text: 'text-white' };
  if (value >= 20) return { bg: 'bg-amber-500/30', text: 'text-amber-200' };
  return { bg: 'bg-rose-500/30', text: 'text-rose-200' };
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function BITab() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Hero Banner */}
      <Card className="relative overflow-hidden border-amber-500/30 bg-gradient-to-r from-amber-500/[0.08] via-orange-500/[0.05] to-amber-500/[0.08]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <CardContent className="relative p-5">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <Brain className="w-6 h-6 text-amber-300" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-bold text-white">Business Intelligence Avançado</h2>
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-mono uppercase">
                  <Sparkles className="w-3 h-3 mr-1" />
                  MAX
                </Badge>
              </div>
              <p className="text-sm text-white/60 max-w-xl">
                Heatmap de ocupação, previsão de demanda com IA, benchmark vs mercado regional
                e alertas preditivos de churn. Tudo para você tomar decisões estratégicas.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Ocupação Geral', value: '78%', delta: '+12pp', up: true, icon: Activity, color: 'text-emerald-400' },
          { label: 'ADR Médio', value: 'R$ 490', delta: '+8.4%', up: true, icon: TrendingUp, color: 'text-blue-400' },
          { label: 'RevPAR', value: 'R$ 327', delta: '+15%', up: true, icon: BarChart3, color: 'text-amber-400' },
          { label: 'Demanda +7d', value: '95%', delta: 'pico', up: true, icon: Flame, color: 'text-rose-400' },
        ].map((kpi, idx) => {
          const Icon = kpi.icon;
          const TrendIcon = kpi.up ? ArrowUpRight : ArrowDownRight;
          return (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className={`w-3.5 h-3.5 ${kpi.color}`} />
                <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                  <TrendIcon className="w-2.5 h-2.5 mr-0.5" />
                  {kpi.delta}
                </Badge>
              </div>
              <div className="text-xl font-bold text-white">{kpi.value}</div>
              <div className="text-[10px] text-white/50 font-mono uppercase">{kpi.label}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Heatmap de Ocupação por Canal */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" />
            Heatmap de Ocupação por Canal
          </CardTitle>
          <CardDescription className="text-xs">
            Visualize sua ocupação por dia da semana e canal de origem. Identifique gargalos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[480px]">
              {/* Header */}
              <div className="grid grid-cols-[80px_repeat(4,1fr)] gap-2 mb-2">
                <div />
                {HEATMAP_CHANNELS.map(ch => (
                  <div key={ch} className="text-center text-[10px] font-mono uppercase tracking-wider text-white/50">
                    {ch}
                  </div>
                ))}
              </div>
              {/* Rows */}
              {HEATMAP_DAYS.map((day, dayIdx) => (
                <div key={day} className="grid grid-cols-[80px_repeat(4,1fr)] gap-2 mb-2">
                  <div className="text-xs font-medium text-white/70 flex items-center">{day}</div>
                  {HEATMAP_DATA[dayIdx].map((value, chIdx) => {
                    const color = getHeatmapColor(value);
                    return (
                      <div
                        key={chIdx}
                        className={`relative h-12 rounded-lg ${color.bg} flex items-center justify-center transition-all hover:scale-105 cursor-pointer`}
                        title={`${day} · ${HEATMAP_CHANNELS[chIdx]}: ${value}%`}
                      >
                        <span className={`text-xs font-bold ${color.text}`}>{value}%</span>
                      </div>
                    );
                  })}
                </div>
              ))}
              {/* Legend */}
              <div className="flex items-center justify-end gap-3 mt-3 text-[9px] font-mono text-white/40">
                <span>0-20%</span>
                <div className="flex gap-0.5">
                  <div className="w-4 h-2 rounded bg-rose-500/30" />
                  <div className="w-4 h-2 rounded bg-amber-500/30" />
                  <div className="w-4 h-2 rounded bg-amber-500/50" />
                  <div className="w-4 h-2 rounded bg-emerald-500/50" />
                  <div className="w-4 h-2 rounded bg-emerald-500/70" />
                  <div className="w-4 h-2 rounded bg-emerald-500/90" />
                </div>
                <span>90-100%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Previsão de Demanda (Forecast) */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Brain className="w-4 h-4 text-amber-400" />
            Previsão de Demanda — IA Zélla
            <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-400 border-amber-500/30 ml-2">
              7 dias
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Previsão baseada em sazonalidade, histórico de reservas e tendências de mercado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={forecastChartConfig} className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={FORECAST_DATA} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                <defs>
                  <linearGradient id="realGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="prevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="day" stroke="#ffffff60" fontSize={10} />
                <YAxis stroke="#ffffff60" fontSize={10} domain={[60, 100]} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="real"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#realGrad)"
                  connectNulls={false}
                />
                <Area
                  type="monotone"
                  dataKey="previsto"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  fill="url(#prevGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
          <div className="mt-3 rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-white/70">
              <strong className="text-amber-300">Insight da IA:</strong>{' '}
              Demanda prevista de <strong>95% para +7d</strong>. Considere aumentar ADR em 8-12%
              e ativar campanhas de remarketing para o fim de semana.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Benchmark vs Mercado */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            Benchmark vs Mercado Regional
          </CardTitle>
          <CardDescription className="text-xs">
            Comparação com a média do mercado regional (pousadas e flats similares).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {BENCHMARK_DATA.map(item => {
              const diff = ((item.you - item.market) / item.market) * 100;
              const isUp = diff > 0;
              const unitPrefix = item.unit === 'R$' ? 'R$ ' : '';
              const unitSuffix = item.unit === '%' ? '%' : '';
              return (
                <div key={item.metric} className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-white/80">{item.metric}</span>
                    <Badge variant="outline" className={`text-[9px] ${isUp ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}`}>
                      {isUp ? '+' : ''}{diff.toFixed(1)}% vs mercado
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <div>
                      <div className="text-[10px] text-white/40 font-mono uppercase">Você</div>
                      <div className="text-lg font-bold text-emerald-400">
                        {unitPrefix}{item.you}{unitSuffix}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-white/40 font-mono uppercase">Mercado</div>
                      <div className="text-lg font-bold text-white/60">
                        {unitPrefix}{item.market}{unitSuffix}
                      </div>
                    </div>
                  </div>
                  <Progress
                    value={(item.market / Math.max(item.you, item.market)) * 100}
                    className="h-1"
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ADR Analysis */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            Análise de ADR — Average Daily Rate
          </CardTitle>
          <CardDescription className="text-xs">
            Evolução do ADR vs período anterior. Identifique tendências de precificação.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={adrChartConfig} className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ADR_DATA} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="month" stroke="#ffffff60" fontSize={10} />
                <YAxis stroke="#ffffff60" fontSize={10} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="prev" fill="#6366f1" radius={[4, 4, 0, 0]} name="Anterior" />
                <Bar dataKey="adr" fill="#10b981" radius={[4, 4, 0, 0]} name="Atual" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Churn Preditivo Alerts */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            Alertas Preditivos de Churn
          </CardTitle>
          <CardDescription className="text-xs">
            IA detectou padrões de risco. Aja antes que vire perda real.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {CHURN_ALERTS.map(alert => {
            const isHigh = alert.type === 'high';
            const isMed = alert.type === 'medium';
            const color = isHigh ? 'rose' : isMed ? 'amber' : 'blue';
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className={`rounded-lg border p-3 flex items-start gap-3 bg-${color}-500/[0.05] border-${color}-500/20`}
              >
                <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 text-${color}-400`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white/90">{alert.label}</div>
                  <div className="text-[10px] text-white/50 mt-0.5">{alert.detail}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-lg font-bold text-${color}-400`}>{alert.probability}%</div>
                  <div className="text-[9px] text-white/40 font-mono uppercase">risco</div>
                </div>
              </motion.div>
            );
          })}
        </CardContent>
      </Card>
    </motion.div>
  );
}
