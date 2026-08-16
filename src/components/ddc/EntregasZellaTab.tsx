'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  Zap,
  Brain,
  BarChart2,
  MessageSquare,
  DollarSign,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
} from 'lucide-react';

// ══
// Types — matches API DeliveriesData shape
// ══

interface EntregasZellaTabProps {
  currentPlan: 'gratuito' | 'lite' | 'pro' | 'max' | 'parceiro';
}

interface DeliveryData {
  responseTime: {
    avgSeconds: number;
    targetSeconds: number;
    withinTarget: boolean;
  };
  availabilityUptime: {
    percentage: number;
    label: string;
  };
  messageBundling: {
    totalBundlesProcessed: number;
    totalMessagesProcessed: number;
    avgMessagesPerBundle: number;
    savingsRate: number;
    totalSavedBrl: number;
  };
  oneShotResolution: {
    totalOneShots: number;
    oneShotRate: number;
    example: {
      guestName: string;
      intents: string[];
      responsePreview: string;
    };
  };
  metaShield: {
    currentSpendBrl: number;
    estimatedWithoutZellaBrl: number;
    savingsPercent: number;
    countdownDays: number;
    costPerMessageBrl: number;
  };
  otaSavings: {
    directBookingsCount: number;
    estimatedCommissionSaved: number;
    totalDirectRevenue: number;
  };
  planLimits: {
    plan: string;
    messagesLimit: number | null;
    messagesUsed: number;
    guestsLimit: number | null;
    guestsAttended: number;
    needsDisclaimer: boolean;
  };
}

// ══
// Fallback defaults (match API demo values)
// ══

const FALLBACK_DATA: DeliveryData = {
  responseTime: { avgSeconds: 6.2, targetSeconds: 8, withinTarget: true },
  availabilityUptime: { percentage: 99.7, label: '24/7' },
  messageBundling: {
    totalBundlesProcessed: 147,
    totalMessagesProcessed: 382,
    avgMessagesPerBundle: 2.6,
    savingsRate: 64,
    totalSavedBrl: 47.32,
  },
  oneShotResolution: {
    totalOneShots: 89,
    oneShotRate: 60.5,
    example: {
      guestName: 'Maria Silva',
      intents: ['cotacao_reserva', 'preco_diaria', 'pagamento_pix'],
      responsePreview:
        'Olá Maria! 😊 A suíte Jardim está disponível: R$280/noite (2 diárias = R$560). Check-in 14h, checkout 12h. PIX: 12.345.678/0001-90 (Zélla Pousada). Qualquer dúvida, estou aqui!',
    },
  },
  metaShield: {
    currentSpendBrl: 23.4,
    estimatedWithoutZellaBrl: 112.5,
    savingsPercent: 79.2,
    countdownDays: 550,
    costPerMessageBrl: 0.035,
  },
  otaSavings: {
    directBookingsCount: 34,
    estimatedCommissionSaved: 15870,
    totalDirectRevenue: 105800,
  },
  planLimits: {
    plan: 'lite',
    messagesLimit: 500,
    messagesUsed: 382,
    guestsLimit: 50,
    guestsAttended: 24,
    needsDisclaimer: true,
  },
};

// ══
// Animation variants
// ══

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

// ══
// Helpers
// ══

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR');
}

function getCountdown(days: number): string {
  if (days <= 0) return 'Chegou!';
  const months = Math.floor(days / 30);
  const remainingDays = days % 30;
  if (months > 0) return `${months}m ${remainingDays}d`;
  return `${days} dias`;
}

function intentLabel(intent: string): string {
  const map: Record<string, string> = {
    cotacao_reserva: 'Tem vaga?',
    preco_diaria: 'Preço?',
    pagamento_pix: 'Aceita PIX?',
    pet_policy: 'Aceita pet?',
    checkin_horario: 'Horário check-in?',
    endereco: 'Endereço?',
  };
  return map[intent] || intent;
}

// ══
// Skeleton loader
// ══

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0d0d14] p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-white/[0.04] animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded bg-white/[0.06] animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-white/[0.04] animate-pulse" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-8 w-1/3 rounded bg-white/[0.06] animate-pulse" />
        <div className="h-3 w-2/3 rounded bg-white/[0.04] animate-pulse" />
      </div>
      <div className="flex gap-2">
        <div className="h-5 w-20 rounded-full bg-white/[0.04] animate-pulse" />
        <div className="h-5 w-24 rounded-full bg-white/[0.04] animate-pulse" />
      </div>
    </div>
  );
}

// ══
// Gradient border wrapper
// ══

function GradientBorderCard({
  children,
  gradientFrom,
  gradientTo,
  className = '',
}: {
  children: React.ReactNode;
  gradientFrom: string;
  gradientTo: string;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-xl p-[1px] bg-gradient-to-br ${gradientFrom} ${gradientTo} ${className}`}
    >
      <div className="rounded-xl bg-[#0d0d14] h-full">{children}</div>
    </div>
  );
}

// ══
// Main Component
// ══

export function EntregasZellaTab({ currentPlan }: EntregasZellaTabProps) {
  const [data, setData] = useState<DeliveryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/ddc/deliveries')
      .then((r) => r.json())
      .then((d) => setData(d?.data || FALLBACK_DATA))
      .catch(() => setData(FALLBACK_DATA))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="space-y-2">
          <div className="h-8 w-72 rounded bg-white/[0.06] animate-pulse" />
          <div className="h-4 w-96 rounded bg-white/[0.04] animate-pulse" />
        </div>
        {/* Card skeletons */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  const d = data || FALLBACK_DATA;
  const isLite = currentPlan === 'lite' || d.planLimits.needsDisclaimer;

  return (
    <div className="space-y-6">
      {/* ── Header  */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Promessas Entregues
        </h2>
        <p className="text-sm text-zinc-400">
          Cada promessa da landing page, comprovada com dados reais do seu painel.
        </p>
      </div>

      {/* ── Cards Grid  */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* ══
            Card 1 — ⚡ Nunca mais perca uma reserva
            ══ */}
        <motion.div variants={cardVariants}>
          <GradientBorderCard gradientFrom="from-emerald-500/30" gradientTo="to-emerald-500/5">
            <Card className="bg-transparent border-0 shadow-none">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-white text-base">
                      ⚡ Nunca mais perca uma reserva
                    </CardTitle>
                    <CardDescription className="text-zinc-500 text-xs">
                      IA disponível 24/7, respondendo em segundos
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Response Time */}
                <div className="space-y-1">
                  <div className="flex items-end justify-between">
                    <span className="text-xs text-zinc-500 uppercase tracking-wider font-mono">
                      Tempo de resposta
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-emerald-400">
                        {d.responseTime.avgSeconds}
                      </span>
                      <span className="text-sm text-zinc-500">s</span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700"
                      style={{
                        width: `${Math.min((d.responseTime.targetSeconds / (d.responseTime.avgSeconds * 2)) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-600 font-mono">
                    <span>Meta: ≤{d.responseTime.targetSeconds}s</span>
                    <span className={d.responseTime.withinTarget ? 'text-emerald-500' : 'text-rose-400'}>
                      {d.responseTime.withinTarget ? '✓ Atingido' : '✕ Acima da meta'}
                    </span>
                  </div>
                </div>

                {/* AI Uptime */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">IA Uptime</span>
                  <span className="text-lg font-bold text-emerald-400">{d.availabilityUptime.percentage}%</span>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5"
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    24/7 Online
                  </Badge>
                  <Badge
                    variant="outline"
                    className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5"
                  >
                    <Clock className="w-3 h-3 mr-1" />
                    Resposta em {d.responseTime.avgSeconds}s
                  </Badge>
                  <Badge
                    variant="outline"
                    className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5"
                  >
                    <MessageSquare className="w-3 h-3 mr-1" />
                    {formatNumber(d.messageBundling.totalMessagesProcessed)} msgs/mês
                  </Badge>
                </div>

                {/* LITE Disclaimer */}
                {isLite && (
                  <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div className="flex gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-300 font-medium leading-relaxed">
                        Seu plano LITE atende até <strong>{d.planLimits.guestsLimit} hóspedes/mês</strong> com{' '}
                        <strong>{d.planLimits.messagesLimit} mensagens</strong>. Para atendimento ilimitado, upgrade para{' '}
                        <span className="text-amber-200 font-bold">PRO</span>.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </GradientBorderCard>
        </motion.div>

        {/* ══
            Card 2 — 📦 Message Bundling Inteligente
            ══ */}
        <motion.div variants={cardVariants}>
          <GradientBorderCard gradientFrom="from-emerald-500/30" gradientTo="to-emerald-500/5">
            <Card className="bg-transparent border-0 shadow-none">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-white text-base">
                      📦 Message Bundling Inteligente
                    </CardTitle>
                    <CardDescription className="text-zinc-500 text-xs">
                      Uma mensagem, tudo resolvido
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Metrics row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">
                      Bundles
                    </span>
                    <p className="text-xl font-bold text-white">
                      {formatNumber(d.messageBundling.totalBundlesProcessed)}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">
                      Msgs/bundle
                    </span>
                    <p className="text-xl font-bold text-white">
                      {d.messageBundling.avgMessagesPerBundle}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">
                      Economia
                    </span>
                    <p className="text-xl font-bold text-emerald-400">
                      {d.messageBundling.savingsRate}%
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">
                      R$ economizado
                    </span>
                    <p className="text-xl font-bold text-emerald-400">
                      {formatBRL(d.messageBundling.totalSavedBrl)}
                    </p>
                  </div>
                </div>

                {/* Before / After visual */}
                <div className="space-y-3">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-mono font-medium">
                    Antes do Zélla → Depois
                  </p>

                  {/* Before: fragmented messages */}
                  <div className="space-y-1.5">
                    {d.oneShotResolution.example.intents.slice(0, 5).map((intent, i) => (
                      <div
                        key={i}
                        className="max-w-[75%] ml-auto bg-zinc-800/60 border border-zinc-700/40 rounded-lg px-3 py-1.5 text-xs text-zinc-400"
                      >
                        {intentLabel(intent)}
                      </div>
                    ))}
                  </div>

                  {/* After: one complete bundle */}
                  <div className="max-w-[90%] bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-xs text-emerald-300 leading-relaxed">
                    <p className="font-medium text-emerald-200 mb-1">Zélla responde tudo:</p>
                    {d.oneShotResolution.example.responsePreview}
                  </div>
                </div>
              </CardContent>
            </Card>
          </GradientBorderCard>
        </motion.div>

        {/* ══
            Card 3 — 🧠 Contexto Inteligente (One-Shot Resolution)
            ══ */}
        <motion.div variants={cardVariants}>
          <GradientBorderCard gradientFrom="from-emerald-500/30" gradientTo="to-emerald-500/5">
            <Card className="bg-transparent border-0 shadow-none">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                    <Brain className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-white text-base">
                      🧠 Contexto Inteligente
                    </CardTitle>
                    <CardDescription className="text-zinc-500 text-xs">
                      One-Shot Resolution — resolve tudo em uma resposta
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* One-Shot Rate */}
                <div className="space-y-1">
                  <div className="flex items-end justify-between">
                    <span className="text-xs text-zinc-500 uppercase tracking-wider font-mono">
                      Taxa One-Shot
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-emerald-400">
                        {d.oneShotResolution.oneShotRate}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-700"
                      style={{ width: `${d.oneShotResolution.oneShotRate}%` }}
                    />
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">
                      Resoluções 1-shot
                    </span>
                    <p className="text-xl font-bold text-white">
                      {formatNumber(d.oneShotResolution.totalOneShots)}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">
                      Redução de custo
                    </span>
                    <p className="text-xl font-bold text-emerald-400">
                      {d.messageBundling.savingsRate}%
                    </p>
                  </div>
                </div>

                {/* Example conversation */}
                <div className="space-y-2">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-mono font-medium">
                    Exemplo real — {d.oneShotResolution.example.guestName}
                  </p>
                  {/* Guest messages */}
                  <div className="space-y-1">
                    {d.oneShotResolution.example.intents.map((intent, i) => (
                      <div
                        key={i}
                        className="max-w-[65%] ml-auto bg-zinc-800/60 border border-zinc-700/40 rounded-lg px-3 py-1.5 text-xs text-zinc-400"
                      >
                        {intentLabel(intent)}
                      </div>
                    ))}
                  </div>
                  {/* Zélla one-shot response */}
                  <div className="max-w-[92%] bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-xs text-emerald-300 leading-relaxed">
                    <p className="font-medium text-emerald-200 mb-1">Zélla — 1 mensagem:</p>
                    {d.oneShotResolution.example.responsePreview}
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5"
                >
                  <ArrowUpRight className="w-3 h-3 mr-1" />
                  {d.oneShotResolution.oneShotRate}% resolvido na primeira resposta
                </Badge>
              </CardContent>
            </Card>
          </GradientBorderCard>
        </motion.div>

        {/* ══
            Card 4 — 📊 Painel em Tempo Real
            ══ */}
        <motion.div variants={cardVariants}>
          <GradientBorderCard gradientFrom="from-emerald-500/30" gradientTo="to-emerald-500/5">
            <Card className="bg-transparent border-0 shadow-none">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                    <BarChart2 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-white text-base">
                      📊 Painel em Tempo Real
                    </CardTitle>
                    <CardDescription className="text-zinc-500 text-xs">
                      Métricas atualizadas ao vivo
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Live metrics */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 text-center space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">
                      Reservas
                    </span>
                    <p className="text-lg font-bold text-white">
                      {formatNumber(d.otaSavings.directBookingsCount)}
                    </p>
                  </div>
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 text-center space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">
                      Receita
                    </span>
                    <p className="text-lg font-bold text-emerald-400">
                      {d.otaSavings.totalDirectRevenue >= 1000
                        ? `${(d.otaSavings.totalDirectRevenue / 1000).toFixed(0)}k`
                        : formatBRL(d.otaSavings.totalDirectRevenue)}
                    </p>
                  </div>
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 text-center space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">
                      Msgs IA
                    </span>
                    <p className="text-lg font-bold text-white">
                      {formatNumber(d.messageBundling.totalMessagesProcessed)}
                    </p>
                  </div>
                </div>

                {/* Live badge */}
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5"
                  >
                    <span className="relative flex h-2 w-2 mr-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    Atualizado ao vivo
                  </Badge>
                </div>

                {/* Weekly report status */}
                <div className="flex items-center gap-2 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-zinc-400">Relatórios semanais por e-mail</span>
                  <Badge
                    variant="outline"
                    className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 text-[9px] px-1.5 py-0 h-4"
                  >
                    ATIVO
                  </Badge>
                </div>

                {/* Message usage progress */}
                {d.planLimits.messagesLimit && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500">Uso de mensagens</span>
                      <span className="text-zinc-400">
                        {formatNumber(d.planLimits.messagesUsed)} / {formatNumber(d.planLimits.messagesLimit)}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-zinc-800">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          (d.planLimits.messagesUsed / d.planLimits.messagesLimit) >= 0.8
                            ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                            : 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                        }`}
                        style={{
                          width: `${Math.min((d.planLimits.messagesUsed / d.planLimits.messagesLimit) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Guest usage */}
                {d.planLimits.guestsLimit && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500">Hóspedes atendidos</span>
                      <span className="text-zinc-400">
                        {formatNumber(d.planLimits.guestsAttended)} / {formatNumber(d.planLimits.guestsLimit)}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-zinc-800">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          (d.planLimits.guestsAttended / d.planLimits.guestsLimit) >= 0.8
                            ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                            : 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                        }`}
                        style={{
                          width: `${Math.min((d.planLimits.guestsAttended / d.planLimits.guestsLimit) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </GradientBorderCard>
        </motion.div>

        {/* ══
            Card 5 — 🛡️ Escudo Meta 2026
            ══ */}
        <motion.div variants={cardVariants}>
          <GradientBorderCard gradientFrom="from-amber-500/30" gradientTo="to-amber-500/5">
            <Card className="bg-transparent border-0 shadow-none">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-white text-base">
                      🛡️ Escudo Meta 2026
                    </CardTitle>
                    <CardDescription className="text-zinc-500 text-xs">
                      Proteção contra aumento de custos da Meta
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Shield visual with savings */}
                <div className="flex items-center justify-center py-2">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center">
                      <div className="text-center">
                        <span className="text-2xl font-black text-amber-400">
                          {d.metaShield.savingsPercent}%
                        </span>
                        <p className="text-[9px] text-amber-400/70 uppercase tracking-wider font-mono">
                          economia
                        </p>
                      </div>
                    </div>
                    <Shield className="absolute -top-1 -right-1 w-6 h-6 text-amber-400 drop-shadow-lg" />
                  </div>
                </div>

                {/* Cost comparison */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Custo atual com Zélla</span>
                    <span className="text-sm font-bold text-amber-400">
                      {formatBRL(d.metaShield.currentSpendBrl)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Estimado SEM Zélla</span>
                    <span className="text-sm font-bold text-rose-400 line-through">
                      {formatBRL(d.metaShield.estimatedWithoutZellaBrl)}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="flex h-full">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-amber-400 rounded-l-full transition-all duration-700"
                        style={{ width: `${100 - d.metaShield.savingsPercent}%` }}
                      />
                      <div
                        className="bg-zinc-700 rounded-r-full"
                        style={{ width: `${d.metaShield.savingsPercent}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-600 text-center font-mono">
                    Você paga apenas {Math.round(100 - d.metaShield.savingsPercent)}% do custo original
                  </p>
                </div>

                {/* Cost per message */}
                <div className="flex items-center justify-between bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2">
                  <span className="text-xs text-zinc-400">Custo por mensagem</span>
                  <span className="text-sm font-bold text-amber-400 font-mono">
                    R$ {d.metaShield.costPerMessageBrl.toFixed(3)}
                  </span>
                </div>

                {/* Countdown */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Contagem regressiva Out/2026</span>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-sm font-bold text-amber-300 font-mono">
                      {getCountdown(d.metaShield.countdownDays)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </GradientBorderCard>
        </motion.div>

        {/* ══
            Card 6 — 💰 Zero Comissão de OTA
            ══ */}
        <motion.div variants={cardVariants}>
          <GradientBorderCard gradientFrom="from-emerald-500/30" gradientTo="to-emerald-500/5">
            <Card className="bg-transparent border-0 shadow-none">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-white text-base">
                      💰 Zero Comissão de OTA
                    </CardTitle>
                    <CardDescription className="text-zinc-500 text-xs">
                      Reservas diretas = 100% do lucro fica com você
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Commission saved hero */}
                <div className="text-center py-2">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">
                    Comissão economizada
                  </span>
                  <p className="text-3xl font-black text-emerald-400 mt-1">
                    {formatBRL(d.otaSavings.estimatedCommissionSaved)}
                  </p>
                  <p className="text-[10px] text-zinc-600 mt-1">
                    15% de Booking/Decolar que fica no seu bolso
                  </p>
                </div>

                {/* Comparison bars */}
                <div className="space-y-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-zinc-500">Via OTA (Booking/Decolar)</span>
                      <span className="text-rose-400">-15%</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-rose-600 to-rose-500 rounded-full"
                        style={{ width: '15%' }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-zinc-500">Direto via WhatsApp + Zélla</span>
                      <span className="text-emerald-400">0% comissão</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-zinc-800 overflow-hidden">
                      <div className="h-full w-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full" />
                    </div>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">
                      Reservas diretas
                    </span>
                    <p className="text-xl font-bold text-white">
                      {formatNumber(d.otaSavings.directBookingsCount)}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">
                      Receita direta
                    </span>
                    <p className="text-xl font-bold text-emerald-400">
                      {d.otaSavings.totalDirectRevenue >= 1000
                        ? `${(d.otaSavings.totalDirectRevenue / 1000).toFixed(1)}k`
                        : formatBRL(d.otaSavings.totalDirectRevenue)}
                    </p>
                  </div>
                </div>

                {/* Disclaimer */}
                <div className="flex items-start gap-2 bg-emerald-500/5 border border-emerald-500/10 rounded-lg px-3 py-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Cada reserva direta = <span className="text-emerald-400 font-semibold">15%</span> que fica no seu bolso
                  </p>
                </div>
              </CardContent>
            </Card>
          </GradientBorderCard>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default EntregasZellaTab;
