import { Suspense } from 'react';
import ZccLoginContent from './zcc-login.client';

export default function ZccLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#080b14] flex items-center justify-center text-zinc-400">Carregando...</div>}>
      <ZccLoginContent />
    </Suspense>
  );
}
