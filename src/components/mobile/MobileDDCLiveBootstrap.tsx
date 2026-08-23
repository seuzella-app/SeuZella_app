'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { MobileDDCLiveProvider, useMobileDDCLive } from './MobileDDCLiveContext';

function TenantStateBridge({
  niche,
}: {
  niche: 'pousada' | 'airbnb';
}) {
  const { data } = useMobileDDCLive();

  useEffect(() => {
    if (!data?.tenant) return;
    const key = niche === 'pousada' ? 'zella_pousada_nome' : 'zella_airbnb_imovel_nome';
    localStorage.setItem(key, data.tenant.name);
    window.dispatchEvent(new CustomEvent('zella:tenant-state', { detail: data.tenant }));
  }, [data?.tenant, niche]);

  return null;
}

/** Shared live-data boundary for both Mobile DDC niches. */
export function MobileDDCLiveBootstrap({
  niche,
  children,
}: {
  niche: 'pousada' | 'airbnb';
  children: ReactNode;
}) {
  return (
    <MobileDDCLiveProvider>
      <TenantStateBridge niche={niche} />
      {children}
    </MobileDDCLiveProvider>
  );
}
