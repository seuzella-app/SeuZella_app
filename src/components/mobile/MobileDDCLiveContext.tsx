'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useDDCMobileLiveState } from './useDDCMobileLiveState';

type LiveStateResult = ReturnType<typeof useDDCMobileLiveState>;

const MobileDDCLiveContext = createContext<LiveStateResult | null>(null);

export function MobileDDCLiveProvider({ children }: { children: ReactNode }) {
  const state = useDDCMobileLiveState(true);
  return <MobileDDCLiveContext.Provider value={state}>{children}</MobileDDCLiveContext.Provider>;
}

export function useMobileDDCLive() {
  const value = useContext(MobileDDCLiveContext);
  if (!value) throw new Error('useMobileDDCLive must be used inside MobileDDCLiveProvider');
  return value;
}
