'use client';
import { logger } from '@/lib/infra/logger';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { XCircle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function CheckoutCancelPage() {
  useEffect(() => {
    logger.info('Checkout cancelado pelo usuário');
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-8">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="max-w-md w-full">
        <div className="bg-[#1a1a1a] border border-red-500/20 rounded-3xl p-8 text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 200 }} className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-red-400" />
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-3xl font-bold text-white mb-3">Pagamento Cancelado</motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="text-neutral-400 mb-8">
            Seu pagamento foi cancelado. Não se preocupe, você pode tentar novamente a qualquer momento.
          </motion.p>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="space-y-3 mb-8 text-left bg-[#0a0a0a] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-2">O que pode ter acontecido:</h3>
            <div className="space-y-2 text-sm text-neutral-400">
              <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-red-400 rounded-full" /><span>Você cancelou manualmente</span></div>
              <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-red-400 rounded-full" /><span>Pagamento expirou</span></div>
              <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-red-400 rounded-full" /><span>Problema com o cartão</span></div>
              <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-red-400 rounded-full" /><span>Tentativas excedidas</span></div>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="space-y-3">
            <Link href="/#precos" className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-all">Tentar Novamente<RefreshCw className="w-4 h-4" /></Link>
            <Link href="/" className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium transition-all">Voltar ao Início<Home className="w-4 h-4" /></Link>
          </motion.div>
        </div>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="text-center text-neutral-500 text-sm mt-6">Precisa de ajuda? Entre em contato com nosso suporte</motion.p>
      </motion.div>
    </div>
  );
}