'use client';

import type { ReactNode } from 'react';
import { MobileDDCLiveProvider } from './MobileDDCLiveContext';

/**
 * Canonical data boundary for both Mobile DDC niches.
 * Keeps one authenticated live-state request above feature modules so
 * Pousada and Airbnb cannot drift into separate browser-side data models.
 */
export function MobileDDCDataBoundary({ children }: { children: ReactNode }) {
  return <MobileDDCLiveProvider>{children}</MobileDDCLiveProvider>;
}
