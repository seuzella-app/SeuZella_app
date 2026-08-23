'use client';

import { useMemo } from 'react';
import { useMobileDDCLive } from './MobileDDCLiveContext';

/**
 * Derived operational metrics shared by Pousada and Airbnb mobile DDCs.
 * No browser-supplied tenant identity is used; all source data comes from
 * the authenticated canonical Mobile DDC state.
 */
export function useDDCMobileOperationalSummary() {
  const { data, loading, error, refresh } = useMobileDDCLive();

  const summary = useMemo(() => {
    const reservations = data?.reservations ?? [];
    const checkedIn = reservations.filter((item) => item.status === 'CHECKED_IN').length;
    const confirmed = reservations.filter((item) => item.status === 'CONFIRMED').length;
    const totalValue = reservations.reduce((sum, item) => {
      const value = typeof item.totalPrice === 'number' ? item.totalPrice : Number(item.totalPrice ?? 0);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);

    return {
      reservationsCount: reservations.length,
      checkedIn,
      confirmed,
      totalValue,
      tenantName: data?.tenant.name ?? null,
      niche: data?.tenant.niche ?? null,
      generatedAt: data?.generatedAt ?? null,
    };
  }, [data]);

  return { ...summary, loading, error, refresh };
}
