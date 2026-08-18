'use client';

import { motion } from 'framer-motion';
import {
  Coins,
  TrendingDown,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  Sparkles,
  Info,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CreditBalanceDTO } from '@/lib/credits/engine';
import { formatCentsAsBRL, MAX_AMORTIZATION_PERCENT } from '@/lib/credits/rules';
import type { PlanTier } from '@/lib/plan-features';
import { PLAN_DISPLAY } from '@/lib/plan-features';

interface Props {
  balance: CreditBalanceDTO | null;
  plan: PlanTier;
  loading: boolean;
}

export function CreditsHero({ balance, plan, loading }: Props) {
  const planDisplay = PLAN_DISPLAY[plan];

  if (loading || !balance) {
    return (
      <Card className="bg-gradient-to-br from-emerald-500/[0.06] via-[#0d0d14] to-[#0d0d14] border-emerald-500/15">
        <CardContent className="p-6 md:p-8">
          <div className="h-32 animate-pulse bg-white/[0.03] rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  const monthlyCents = balance.nextMonthEstimateCents + balance.nextMonthDiscountCents;
  const discountPercent = monthlyCents > 0 ? Math.round((balance.nextMonthDiscountCents / monthlyCents) * 100) : 0;

  return (
    <Card className="bg-gradient-to-br from-emerald-500/[0.08] via-[#0d0d14] to-[#0d0d14] border-emerald-500/20 overflow-hidden relative">
      {/* Glow effect */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-teal-500/[0.06] rounded-full blur-3xl pointer-events-none" />

      <CardContent className="p-6 md:p-8 relative">
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Coins className="w-5 h-5 text-emerald-400" />
              <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                Créditos de Amortização
              </h2>
              <Badge className="bg-emerald-500/15 border-emerald-500/30 text-emerald-400 text-[9px] uppercase tracking-wider">
                {planDisplay.label}
              </Badge>
            </div>
            <p className="text-xs md:text-sm text-zinc-400 max-w-xl leading-relaxed">
              Indique o Seu Zélla para outras pousadas e anfitriões. A cada conversão paga, você acumula
              créditos que <strong className="text-emerald-400">amortizam até {Math.round(MAX_AMORTIZATION_PERCENT * 100)}% da sua próxima mensalidade</strong>.
              Sem pagamento via PIX — apenas desconto na fatura.
            </p>
          </div>
        </div>

        {/* Stat grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {/* Saldo disponível — destaque */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="md:col-span-2 bg-gradient-to-br from-emerald-500/[0.12] to-emerald-500/[0.04] border border-emerald-500/25 rounded-xl p-5 relative overflow-hidden"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] uppercase tracking-widest text-emerald-300/80 font-bold">
                Saldo disponível
              </span>
            </div>
            <p className="text-3xl md:text-4xl font-extrabold text-white tracking-tight tabular-nums">
              {formatCentsAsBRL(balance.availableCents)}
            </p>
            <p className="text-[11px] text-emerald-300/70 mt-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>
                Desconto de {formatCentsAsBRL(balance.nextMonthDiscountCents)} na próxima fatura ({discountPercent}%)
              </span>
            </p>
          </motion.div>

          {/* Pending */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5"
          >
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Em confirmação
              </span>
            </div>
            <p className="text-xl md:text-2xl font-bold text-amber-400 tabular-nums">
              {formatCentsAsBRL(balance.pendingCents)}
            </p>
            <p className="text-[10px] text-zinc-500 mt-1">
              Aguardando 30 dias anti-chargeback
            </p>
          </motion.div>

          {/* Aplicado */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5"
          >
            <div className="flex items-center gap-1.5 mb-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Já aplicado
              </span>
            </div>
            <p className="text-xl md:text-2xl font-bold text-white tabular-nums">
              {formatCentsAsBRL(balance.appliedThisYearCents)}
            </p>
            <p className="text-[10px] text-zinc-500 mt-1">
              Total amortizado este ano
            </p>
          </motion.div>
        </div>

        {/* Próxima fatura preview */}
        <div className="mt-4 bg-[#0a0a0f]/70 border border-white/[0.06] rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Projeção da próxima mensalidade
              </p>
              <p className="text-sm text-white">
                <span className="line-through text-zinc-500 mr-2">
                  {formatCentsAsBRL(monthlyCents)}
                </span>
                <span className="font-bold text-emerald-400 text-lg">
                  {formatCentsAsBRL(balance.nextMonthEstimateCents)}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-zinc-400">
            <Info className="w-3.5 h-3.5 text-zinc-500" />
            <span>
              Limite mensal: <strong className="text-zinc-300">{formatCentsAsBRL(balance.maxApplicableCents)}</strong> (50%)
            </span>
            <ArrowUpRight className="w-3 h-3 text-emerald-400" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
