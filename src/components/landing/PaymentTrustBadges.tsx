'use client';

import { ShieldCheck, Lock, CheckCircle2, Zap, CreditCard, QrCode } from 'lucide-react';

export function PaymentTrustBadges({ compact = false }: { compact?: boolean }) {
  return (
    <div className="w-full flex flex-col items-center justify-center gap-3 pt-6 pb-2">
      {/* Micro Eyebrow */}
      <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium">
        <Lock className="w-3.5 h-3.5 text-emerald-400" />
        <span>Pagamento seguro e processamento bancário via</span>
      </div>

      {/* Badges Bar */}
      <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
        {/* ASAAS Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900/90 border border-blue-500/30 text-xs font-bold text-blue-400 shadow-md">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span>ASAAS</span>
          <span className="text-[9px] font-normal text-zinc-400 border-l border-white/10 pl-1.5">SaaS Recorrente</span>
        </div>

        {/* MERCADO PAGO Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900/90 border border-sky-500/30 text-xs font-bold text-sky-300 shadow-md">
          <div className="w-2 h-2 rounded-full bg-sky-400" />
          <span>Mercado Pago</span>
          <span className="text-[9px] font-normal text-zinc-400 border-l border-white/10 pl-1.5">Antifraude 98.4%</span>
        </div>

        {/* PIX BACEN Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900/90 border border-teal-500/30 text-xs font-bold text-teal-300 shadow-md">
          <QrCode className="w-3.5 h-3.5 text-teal-400" />
          <span>PIX Instantâneo</span>
        </div>

        {/* BANDEIRAS CARTÃO Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/90 border border-white/10 text-xs font-medium text-zinc-300 shadow-md">
          <CreditCard className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-mono text-[11px]">Visa • Master • Elo • Hiper</span>
        </div>
      </div>

      {!compact && (
        <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-zinc-300 font-medium">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Cobrança Recorrente Transparente
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Nota Fiscal Eletrônica Automática (NFS-e)
          </span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Criptografia de Ponta SSL 256-bit
          </span>
        </div>
      )}
    </div>
  );
}
