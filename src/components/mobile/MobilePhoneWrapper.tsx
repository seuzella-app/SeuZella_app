'use client';

// ==============================================================================
// MOBILE PHONE WRAPPER & RESPONSIVE ROUTER
// ==============================================================================
// - On Mobile (< 768px): Renders 100% Fullscreen Mobile Super App (NO fake frames, NO bezels)
// - On Desktop (>= 768px): Automatically redirects to Web Desktop DDC (/ddc/pousada or /ddc/airbnb)
// ==============================================================================

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface MobilePhoneWrapperProps {
  children: ReactNode;
  title: string;
  niche: 'pousada' | 'airbnb';
}

export function MobilePhoneWrapper({ children, niche }: MobilePhoneWrapperProps) {
  const router = useRouter();
  const [isDesktop, setIsDesktop] = useState<boolean>(false);

  useEffect(() => {
    const checkViewport = () => {
      const desktop = window.innerWidth >= 768;
      setIsDesktop(desktop);
      if (desktop) {
        // Automatically redirect desktop users to the Web DDC dashboard
        router.replace(niche === 'pousada' ? '/ddc/pousada' : '/ddc/airbnb');
      }
    };

    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, [niche, router]);

  if (isDesktop) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center font-mono text-sm gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
        <span>Redirecionando para o Dashboard Web Desktop ({niche.toUpperCase()})...</span>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      {children}
    </div>
  );
}
