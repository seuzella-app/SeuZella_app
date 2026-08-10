'use client';

// ==============================================================================
// DDC AIRBNB CLIENT CONTENT — Seamless Responsive Viewport Engine
// ==============================================================================
// - Mobile Viewport (< 768px): Renders MobileAirbnbSuperApp (Fullscreen Cyber-Luxe)
// - Desktop Viewport (>= 768px): Renders DDCAirbnbContent (Desktop Web DDC Dashboard)
// ==============================================================================

import dynamic from 'next/dynamic';
import { MobileAirbnbSuperApp } from '@/components/mobile/MobileAirbnbSuperApp';

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
      {/* Mobile Super App view (< 768px) */}
      <div className="block md:hidden w-full min-h-screen bg-[#0a0a0f]">
        <MobileAirbnbSuperApp />
      </div>

      {/* Web Desktop DDC view (>= 768px) */}
      <div className="hidden md:block w-full min-h-screen bg-[#0a0a0f]">
        <DDCAirbnbContent />
      </div>
    </>
  );
}
