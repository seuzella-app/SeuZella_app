'use client';

import { Lock, ShieldCheck, CheckCircle2 } from 'lucide-react';

export function PaymentTrustBadges({ compact = false }: { compact?: boolean }) {
  return (
    <div className="w-full flex flex-col items-center justify-center gap-3 py-4">
      {/* Header Eyebrow */}
      <div className="flex items-center gap-2 text-zinc-400 text-xs sm:text-sm font-medium">
        <Lock className="w-4 h-4 text-emerald-400" />
        <span>Pagamento seguro e processamento bancário via</span>
      </div>

      {/* Homogeneous Real Logos Row */}
      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 pt-1">
        {/* ASAAS LOGO */}
        <div className="flex items-center justify-center px-4 py-2 rounded-xl bg-white shadow-md border border-white/20 hover:scale-105 transition-all duration-200 h-12 sm:h-14">
          <img
            src="/images/payments/images_asaas.png"
            alt="ASAAS - SaaS Recorrente"
            className="h-7 sm:h-8 w-auto object-contain"
          />
        </div>

        {/* MERCADO PAGO LOGO (Mercado_Pago.svg.webp) */}
        <div className="flex items-center justify-center px-4 py-2 rounded-xl bg-white shadow-md border border-white/20 hover:scale-105 transition-all duration-200 h-12 sm:h-14">
          <img
            src="/images/payments/Mercado_Pago.svg.webp"
            alt="Mercado Pago"
            className="h-7 sm:h-8 w-auto object-contain"
          />
        </div>

        {/* PIX BANCO CENTRAL LOGO */}
        <div className="flex items-center justify-center px-4 py-2 rounded-xl bg-white shadow-md border border-white/20 hover:scale-105 transition-all duration-200 h-12 sm:h-14">
          <img
            src="/images/payments/pix-bc-logo.png"
            alt="PIX Powered by Banco Central"
            className="h-7 sm:h-8 w-auto object-contain"
          />
        </div>

        {/* BANDEIRAS CARTÃO LOGO (VISA, HIPERCARD, ELO, MASTERCARD) */}
        <div className="flex items-center justify-center px-4 py-2 rounded-xl bg-white shadow-md border border-white/20 hover:scale-105 transition-all duration-200 h-12 sm:h-14">
          <img
            src="/images/payments/images_bandeiras.png"
            alt="Visa, Hipercard, Elo, Mastercard"
            className="h-6 sm:h-7 w-auto object-contain"
          />
        </div>
      </div>

      {!compact && (
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-zinc-400 font-medium pt-2">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Cobrança Recorrente Transparente
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Nota Fiscal Eletrônica Automática (NFS-e)
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Criptografia SSL 256-bit
          </span>
        </div>
      )}
    </div>
  );
}
