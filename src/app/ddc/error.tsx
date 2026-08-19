'use client';

import { useEffect } from 'react';
import { RefreshCw, LayoutDashboard, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DDCError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[DDC Error Boundary]', error?.message, error?.digest);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <header className="sticky top-0 z-50 bg-[#0a0a0f]/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="h-[2px] w-full bg-emerald-500/60" />
        <div className="flex items-center justify-between px-4 py-3 max-w-[1920px] mx-auto">
          <div className="flex items-center gap-3">
            <a href="/login" className="text-white/30 hover:text-white/70 transition-all p-2 rounded-lg hover:bg-white/[0.04]">
              <ArrowLeft className="w-5 h-5" />
            </a>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">Seu Zélla</h1>
              <p className="text-[10px] text-white/40 font-mono uppercase tracking-wider">Central de Controle</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold uppercase">
              Conectado
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto mt-20 px-6">
        <div className="bg-[#121216] border border-white/[0.06] rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <LayoutDashboard className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            Painel do Seu Zélla
          </h2>
          <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
            Carregando os módulos operacionais do Seu Zélla.
            Clique abaixo para acessar o painel completo.
          </p>

          {error?.digest && (
            <p className="text-[10px] text-zinc-600 font-mono mb-4">Ref: {error.digest}</p>
          )}

          <div className="flex flex-col gap-3">
            <Button
              onClick={reset}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl h-11 cursor-pointer transition-all shadow-lg"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Recarregar Painel
            </Button>
            <a href="/login" className="w-full">
              <Button
                variant="outline"
                className="w-full border-white/[0.08] text-zinc-300 hover:bg-white/[0.04] rounded-xl h-11 cursor-pointer"
              >
                Voltar ao Login
              </Button>
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-6">
          <div className="bg-[#121216]/50 border border-white/[0.03] rounded-xl p-3.5 text-center">
            <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Status do Sistema</div>
            <div className="text-sm font-bold text-emerald-400 mt-1 flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Online 24h
            </div>
          </div>
          <div className="bg-[#121216]/50 border border-white/[0.03] rounded-xl p-3.5 text-center">
            <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Plano</div>
            <div className="text-sm font-bold text-white mt-1">Plano PRO • Ativo</div>
          </div>
        </div>
      </div>
    </div>
  );
}