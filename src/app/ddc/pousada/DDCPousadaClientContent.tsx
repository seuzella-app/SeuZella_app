'use client';

import dynamic from 'next/dynamic';
import { MobilePousadaSuperApp } from '@/components/mobile/MobilePousadaSuperApp';
import { MobileDDCLiveBootstrap } from '@/components/mobile/MobileDDCLiveBootstrap';
import { DDCStaleShellGuard } from '@/components/ddc/DDCStaleShellGuard';

const DDCPousadaContent = dynamic(
  () => import('./DDCPousadaContent'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400 text-sm font-mono">Carregando Dashboard Pousada Desktop...</p>
        </div>
      </div>
    ),
  }
);

export function DDCPousadaClientContent({ buildId }: { buildId: string }) {
  return (
    <>
      <DDCStaleShellGuard expectedBuildId={buildId} />

      {/*
       * Phones (<768px) keep the dedicated mobile SuperApp.
       * Tablets/iPad (>=768px) MUST use the current desktop DDC. Previously
       * this boundary was `lg` (1024px), which incorrectly classified an
       * iPad in portrait (768–1023px) as MobilePousadaSuperApp — making the
       * device appear to be serving an old DDC even though production was
       * current. Desktop behavior at >=1024px is unchanged.
       */}
      <div className="block md:hidden w-full min-h-screen bg-[#0a0a0f]">
        <MobileDDCLiveBootstrap niche="pousada">
          <MobilePousadaSuperApp />
        </MobileDDCLiveBootstrap>
      </div>

      <div className="hidden md:block w-full min-h-screen bg-[#0a0a0f]">
        <DDCPousadaContent />
      </div>
    </>
  );
}
