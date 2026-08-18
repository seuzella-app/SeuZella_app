'use client';

// ==============================================================================
// DDC POUSADA CLIENT CONTENT — Seamless Responsive Viewport Engine
// ==============================================================================
// - Mobile Viewport (< 768px): Renders MobilePousadaSuperApp (Fullscreen Cyber-Luxe)
// - Desktop Viewport (>= 768px): Renders DDCPousadaContent (Desktop Web DDC Dashboard)
// ==============================================================================

import dynamic from 'next/dynamic';
import { MobilePousadaSuperApp } from '@/components/mobile/MobilePousadaSuperApp';

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

export function DDCPousadaClientContent() {
  return (
    <>
      {/* Mobile Super App view (< 1024px) — iPad/celular */}
      <div className="block lg:hidden w-full min-h-screen bg-[#0a0a0f]">
        <MobilePousadaSuperApp />
      </div>

      {/* Web Desktop DDC view (>= 1024px) */}
      <div className="hidden lg:block w-full min-h-screen bg-[#0a0a0f]">
        <DDCPousadaContent />
      </div>
    </>
  );
}
