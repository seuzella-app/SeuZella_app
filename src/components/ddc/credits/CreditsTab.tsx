'use client';

import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { useCredits } from '@/lib/credits/use-credits';
import type { PlanTier } from '@/lib/plan-features';
import { CreditsHero } from './CreditsHero';
import { ReferralLinksCard } from './ReferralLinksCard';
import { LiteMilestoneCard } from './LiteMilestoneCard';
import { ReferralsHistory } from './ReferralsHistory';
import { RulesCard } from './RulesCard';

interface Props {
  /** Plano atual do tenant (default PRO para demo). */
  plan?: PlanTier;
  /** Nicho do dashboard — só para messaging sutil. */
  niche?: 'pousada' | 'airbnb';
}

export function CreditsTab({ plan = 'pro', niche = 'pousada' }: Props) {
  const { data: session } = useSession();
  const tenantId = session?.user?.tenantId ?? 'demo-tenant';
  const {
    balance,
    codes,
    referrals,
    liteMilestone,
    loading,
    error,
    createCode,
  } = useCredits(tenantId, plan, niche || 'pousada');

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* Hero — saldo e projeção */}
      <CreditsHero balance={balance} plan={plan} loading={loading} />

      {/* LITE milestone — só aparece se for LITE */}
      {plan === 'lite' && (
        <LiteMilestoneCard milestone={liteMilestone} loading={loading} />
      )}

      {/* Grid: links + history */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ReferralLinksCard codes={codes} onCreateCode={createCode} loading={loading} />
        <ReferralsHistory referrals={referrals} loading={loading} />
      </div>

      {/* Rules — sempre visível */}
      <RulesCard />

      {/* Error toast */}
      {error && (
        <div className="bg-red-500/[0.06] border border-red-500/20 rounded-lg p-3 text-xs text-red-300">
          {error}
        </div>
      )}
    </motion.div>
  );
}
