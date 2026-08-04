'use client';

// ==============================================================================
// DDC AIRBNB CLIENT CONTENT — Client Component
// ==============================================================================
// - Wraps DDCAirbnbContent with next/dynamic (ssr: false)
// - Has loading state for better UX
// ==============================================================================

import dynamic from 'next/dynamic';

const DDCAirbnbContent = dynamic(
  () => import('./DDCAirbnbContent'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400 text-sm">Carregando Dashboard Airbnb...</p>
        </div>
      </div>
    ),
  }
);

export function DDCAirbnbClientContent() {
  return <DDCAirbnbContent />;
}
