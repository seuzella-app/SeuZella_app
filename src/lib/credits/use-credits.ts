'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PlanTier } from '@/lib/plan-features';
import type {
  CreditBalanceDTO,
  ReferralCodeDTO,
  ReferralRowDTO,
  LiteMilestoneDTO,
  ReferralChannel,
} from '@/lib/credits/engine';

interface UseCreditsResult {
  balance: CreditBalanceDTO | null;
  codes: ReferralCodeDTO[];
  referrals: ReferralRowDTO[];
  liteMilestone: LiteMilestoneDTO | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createCode: (channel: ReferralChannel, label?: string) => Promise<{ success: boolean; error?: string }>;
}

export function useCredits(tenantId: string | null, _plan: PlanTier, _niche: 'pousada' | 'airbnb'): UseCreditsResult {
  const [balance, setBalance] = useState<CreditBalanceDTO | null>(null);
  const [codes, setCodes] = useState<ReferralCodeDTO[]>([]);
  const [referrals, setReferrals] = useState<ReferralRowDTO[]>([]);
  const [liteMilestone, setLiteMilestone] = useState<LiteMilestoneDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [balRes, codesRes, refsRes, liteRes] = await Promise.all([
        fetch('/api/ddc/credits/balance', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/ddc/credits/codes', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/ddc/credits/referrals', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/ddc/credits/lite-milestone', { cache: 'no-store' }).then((r) => r.json()),
      ]);

      if (balRes?.data) setBalance(balRes.data);
      if (codesRes?.data) setCodes(codesRes.data);
      if (refsRes?.data) setReferrals(refsRes.data);
      if (liteRes?.data) setLiteMilestone(liteRes.data);
    } catch (err) {
      console.error('[useCredits] fetch error:', err);
      setError('Não foi possível carregar seus créditos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const createCode = useCallback(
    async (channel: ReferralChannel, label?: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await fetch('/api/ddc/credits/create-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel, label }),
        });
        const json = await res.json();
        if (!res.ok || !json?.data) {
          return { success: false, error: json?.error || 'Falha ao criar código' };
        }
        await fetchAll();
        return { success: true };
      } catch (err) {
        console.error('[useCredits] createCode error:', err);
        return { success: false, error: 'Falha de comunicação com o servidor' };
      }
    },
    [fetchAll],
  );

  return {
    balance,
    codes,
    referrals,
    liteMilestone,
    loading,
    error,
    refresh: fetchAll,
    createCode,
  };
}
