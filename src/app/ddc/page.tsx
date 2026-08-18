'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DDCIndexPage() {
  const router = useRouter();

  useEffect(() => {
    // Resolve niche from saved preference or default to pousada
    let savedNiche = 'pousada';
    try {
      savedNiche = localStorage.getItem('zehla_niche') || 'pousada';
    } catch {
      // localStorage unavailable
    }

    const targetRoute = savedNiche === 'airbnb' ? '/ddc/airbnb' : '/ddc/pousada';
    router.replace(targetRoute);
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center p-4">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto" />
        <p className="text-zinc-400 text-xs font-mono">Redirecionando para o seu Painel DDC...</p>
      </div>
    </div>
  );
}