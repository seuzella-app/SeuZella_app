'use client';

import dynamic from 'next/dynamic';
import { MobileAirbnbSuperApp } from '@/components/mobile/MobileAirbnbSuperApp';
import { MobileDDCLiveBootstrap } from '@/components/mobile/MobileDDCLiveBootstrap';

const DDCAirbnbContent = dynamic(
  () => import('./DDCAirbnbContent'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400 text-sm font-mono">Carregando Dashboard Airbnb Desktop...</p>
        </div>
      </div>
    ),
  }
);

export function DDCAirbnbClientContent() {
  return (
    <>
      <div className="block lg:hidden w-full min-h-screen bg-[#0a0a0f]">
        <MobileDDCLiveBootstrap niche="airbnb">
          <MobileAirbnbSuperApp />
        </MobileDDCLiveBootstrap>
      </div>

      <div className="hidden lg:block w-full min-h-screen bg-[#0a0a0f]">
        <DDCAirbnbContent />
      </div>
    </>
  );
}
