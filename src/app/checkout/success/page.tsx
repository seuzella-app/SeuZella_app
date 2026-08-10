'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle2, ArrowRight, Home, Mail, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const nicheParam = searchParams.get('niche') || searchParams.get('nicheType') || 'pousada';
  const isAirbnb = nicheParam.toLowerCase() === 'airbnb';

  const ddcTargetUrl = isAirbnb ? '/ddc/airbnb' : '/ddc/pousada';
  const nicheLabel = isAirbnb ? 'DDC Anfitrião (Airbnb)' : 'DDC Pousada';

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6 text-white">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="max-w-md w-full">
        <div className="bg-[#12121c] border border-emerald-500/30 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden">
          {/* Accent glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl" />

          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.15, type: 'spring', stiffness: 220 }} className="w-20 h-20 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="text-3xl font-extrabold text-white mb-2 tracking-tight">
            Pagamento Aprovado!
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="text-zinc-400 text-sm mb-6">
            Sua assinatura do <strong>Seu Zélla SmartHotel</strong> foi ativada com sucesso para <span className="text-emerald-400 font-semibold">{nicheLabel}</span>.
          </motion.p>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} className="space-y-3 mb-8 text-left bg-[#0a0a0f] border border-white/5 rounded-2xl p-4 text-xs text-zinc-300">
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> Provisionamento Concluído
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /><span>Painel do Cliente ({nicheLabel}) ativado</span></div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /><span>Assistente IA pré-configurada em Modo Zero Taxa</span></div>
              <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-emerald-400 shrink-0" /><span>E-mail com credenciais e link de acesso enviado</span></div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="space-y-3">
            <Link href={ddcTargetUrl} className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 text-sm">
              ACESSAR MEU PAINEL DDC <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/" className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl font-medium text-sm transition-all border border-white/10">
              Voltar à Página Inicial <Home className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }} className="text-center text-zinc-500 text-xs mt-6">
          Precisa de ajuda? Fale com o suporte no WhatsApp da Central Zélla.
        </motion.p>
      </motion.div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-zinc-400 text-sm">
        Carregando informações da sua reserva...
      </div>
    }>
      <CheckoutSuccessContent />
    </Suspense>
  );
}