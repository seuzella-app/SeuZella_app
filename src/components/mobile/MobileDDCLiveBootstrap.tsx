'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useDDCMobileLiveState } from './useDDCMobileLiveState';

export function MobileDDCLiveBootstrap({
  niche,
  children,
}: {
  niche: 'pousada' | 'airbnb';
  children: ReactNode;
}) {
  const { data } = useDDCMobileLiveState(true);

  useEffect(() => {
    if (!data?.tenant) return;
    const key = niche === 'pousada' ? 'zella_pousada_nome' : 'zella_airbnb_imovel_nome';
    localStorage.setItem(key, data.tenant.name);
    window.dispatchEvent(new CustomEvent('zella:tenant-state', { detail: data.tenant }));
  }, [data?.tenant, niche]);

  return children;
}
