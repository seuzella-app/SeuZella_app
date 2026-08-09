'use client';

// ==============================================================================
// DDC POUSADA CLIENT CONTENT — Responsive Auto-Routing
// ==============================================================================
// - On Mobile (< 768px): Auto-redirects to /mobile/pousada (Fullscreen Mobile Super App)
// - On Desktop (>= 768px): Renders full Web Desktop DDC Dashboard
// ==============================================================================

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const DDCPousadaContent = dynamic(
  () => import('./DDCPousadaContent'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400 text-sm">Carregando Dashboard Pousada...</p>
        </div>
      </div>
    ),
  }
);

export function DDCPousadaClientContent() {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const checkViewport = () => {
      if (window.innerWidth < 768) {
        setIsMobile(true);
        router.replace('/mobile/pousada');
      }
    };

    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, [router]);

  if (isMobile) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center font-mono text-sm">
        <span>Carregando App Mobile Pousada...</span>
      </div>
    );
  }

  return <DDCPousadaContent />;
}
