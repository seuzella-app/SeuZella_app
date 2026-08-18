'use client';

// ═══════════════════════════════════════════════════════════════════════════
// useCurrentPlan — Hook unificado para resolver o plano do tenant logado
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import type { PlanTier } from '@/lib/plan-features';

const PLAN_CACHE_KEY = 'zella_current_plan';
const DEFAULT_PLAN: PlanTier = 'pro';

export function useCurrentPlan(): {
  plan: PlanTier;
  isLoading: boolean;
  error: Error | null;
} {
  const { data: session, status } = useSession();
  const [plan, setPlan] = useState<PlanTier>(DEFAULT_PLAN);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function resolvePlan() {
      try {
        if (session?.user) {
          const sessionPlan = (session.user as any)?.plan as PlanTier | undefined;
          if (sessionPlan && isValidPlan(sessionPlan)) {
            if (mounted) {
              setPlan(sessionPlan);
              setIsLoading(false);
              try { localStorage.setItem(PLAN_CACHE_KEY, sessionPlan); } catch {}
            }
            return;
          }
        }

        if (status === 'authenticated') {
          try {
            const res = await fetch('/api/v1/guest/ddc/overview', {
              cache: 'no-store',
            });
            if (res.ok) {
              const data = await res.json();
              const bffPlan = data?.tenant?.plan as PlanTier | undefined;
              if (bffPlan && isValidPlan(bffPlan)) {
                if (mounted) {
                  setPlan(bffPlan);
                  setIsLoading(false);
                  try { localStorage.setItem(PLAN_CACHE_KEY, bffPlan); } catch {}
                }
                return;
              }
            }
          } catch {
            // BFF might not be available in dev/mock
          }
        }

        try {
          const cached = localStorage.getItem(PLAN_CACHE_KEY) as PlanTier | null;
          if (cached && isValidPlan(cached)) {
            if (mounted) {
              setPlan(cached);
              setIsLoading(false);
            }
            return;
          }
        } catch {}

        if (mounted) {
          setPlan(DEFAULT_PLAN);
          setIsLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
          setPlan(DEFAULT_PLAN);
          setIsLoading(false);
        }
      }
    }

    resolvePlan();
    return () => { mounted = false; };
  }, [session, status]);

  return { plan, isLoading, error };
}

function isValidPlan(plan: string): plan is PlanTier {
  return ['gratuito', 'lite', 'pro', 'max', 'parceiro'].includes(plan);
}
