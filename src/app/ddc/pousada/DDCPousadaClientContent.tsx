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

      <div className="block lg:hidden w-full min-h-screen bg-[#0a0a0f]">
        <MobileDDCLiveBootstrap niche="pousada">
          <MobilePousadaSuperApp />
        </MobileDDCLiveBootstrap>
      </div>

      <div className="hidden lg:block w-full min-h-screen bg-[#0a0a0f]">
        <DDCPousadaContent />
      </div>
    </>
  );
}
