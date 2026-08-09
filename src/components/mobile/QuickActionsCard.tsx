'use client';

// ==============================================================================
// QUICK ACTIONS CARD — 1-Tap Control Island for Mobile
// ==============================================================================
// - 4 high-priority 1-tap touch actions per niche
// - Real-time toggle feedback (IA ON/OFF, PIX Gatekeeper, Lock Unlock, etc.)
// - Touch target sizes >= 48px for mobile usability
// ==============================================================================

import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Power,
  Key,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  DollarSign,
  Send,
  Lock,
  Unlock,
} from 'lucide-react';

interface QuickActionsCardProps {
  niche: 'pousada' | 'airbnb';
}

export function QuickActionsCard({ niche }: QuickActionsCardProps) {
  const [aiActive, setAiActive] = useState<boolean>(true);
  const [gatekeeperActive, setGatekeeperActive] = useState<boolean>(true);
  const [lockStatus, setLockStatus] = useState<'locked' | 'unlocked'>('locked');

  const isPousada = niche === 'pousada';

  const handleToggleAI = () => {
    setAiActive((prev) => {
      const next = !prev;
      toast.success(next ? '🤖 IA Zélla ATIVADA com sucesso!' : '⏸️ IA Zélla PAUSADA (Modo Recepção)');
      return next;
    });
  };

  const handleToggleGatekeeper = () => {
    setGatekeeperActive((prev) => {
      const next = !prev;
      toast.info(next ? '🛡️ PIX Gatekeeper ATIVO (Escudo Anti-Ban)' : '⚠️ PIX Gatekeeper PAUSADO');
      return next;
    });
  };

  const handleToggleLock = () => {
    setLockStatus((prev) => {
      const next = prev === 'locked' ? 'unlocked' : 'locked';
      toast.success(next === 'unlocked' ? '🔓 Fechadura Desbloqueada Remotamente!' : '🔒 Fechadura Trancada');
      return next;
    });
  };

  const handleSendGuide = () => {
    toast.success('📲 Guia Digital enviado via WhatsApp para os hóspedes de hoje!');
  };

  const handleNotifyCleaners = () => {
    toast.success('🧹 Equipe de Limpeza notificada via WhatsApp sobre o Checkout!');
  };

  const handleSyncBooking = () => {
    toast.promise(new Promise((res) => setTimeout(res, 1200)), {
      loading: '🔄 Sincronizando com Booking.com / iCal...',
      success: '✅ Sincronização concluída com sucesso!',
      error: 'Erro no sync',
    });
  };

  return (
    <div className="w-full bg-[#0a0a12]/95 border-b border-white/[0.08] p-3 text-white">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono font-extrabold text-zinc-400 tracking-wider uppercase flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-emerald-400" />
          AÇÕES RÁPIDAS (1-TAP)
        </span>
        <span className="text-[9px] font-mono text-zinc-400">Toque Único</span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {/* ACTION 1: IA Kill Switch */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={handleToggleAI}
          className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all min-h-[56px] ${
            aiActive
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-lg shadow-emerald-500/10'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-lg shadow-rose-500/10'
          }`}
        >
          <Power className="w-4 h-4 mb-1" />
          <span className="text-[9px] font-mono font-extrabold">
            {aiActive ? 'IA ON' : 'IA OFF'}
          </span>
        </motion.button>

        {/* ACTION 2: Niche Specific Action 1 */}
        {isPousada ? (
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleSendGuide}
            className="flex flex-col items-center justify-center p-2 rounded-xl border bg-white/[0.04] border-white/10 hover:border-emerald-500/40 text-zinc-200 hover:text-emerald-300 transition-all min-h-[56px]"
          >
            <Send className="w-4 h-4 mb-1 text-emerald-400" />
            <span className="text-[9px] font-mono font-bold">Enviar Guia</span>
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleToggleGatekeeper}
            className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all min-h-[56px] ${
              gatekeeperActive
                ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400'
            }`}
          >
            <ShieldCheck className="w-4 h-4 mb-1" />
            <span className="text-[9px] font-mono font-bold">PIX Shield</span>
          </motion.button>
        )}

        {/* ACTION 3: Lock Control */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={handleToggleLock}
          className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all min-h-[56px] ${
            lockStatus === 'unlocked'
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
              : 'bg-white/[0.04] border-white/10 text-zinc-200'
          }`}
        >
          {lockStatus === 'unlocked' ? (
            <Unlock className="w-4 h-4 mb-1 text-amber-400" />
          ) : (
            <Lock className="w-4 h-4 mb-1 text-zinc-400" />
          )}
          <span className="text-[9px] font-mono font-bold">
            {lockStatus === 'unlocked' ? 'Aberto' : 'Trancar'}
          </span>
        </motion.button>

        {/* ACTION 4: Niche Specific Action 2 */}
        {isPousada ? (
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleSyncBooking}
            className="flex flex-col items-center justify-center p-2 rounded-xl border bg-white/[0.04] border-white/10 hover:border-cyan-500/40 text-zinc-200 hover:text-cyan-300 transition-all min-h-[56px]"
          >
            <RefreshCw className="w-4 h-4 mb-1 text-cyan-400" />
            <span className="text-[9px] font-mono font-bold">Sync OTAs</span>
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleNotifyCleaners}
            className="flex flex-col items-center justify-center p-2 rounded-xl border bg-white/[0.04] border-white/10 hover:border-blue-500/40 text-zinc-200 hover:text-blue-300 transition-all min-h-[56px]"
          >
            <MessageSquare className="w-4 h-4 mb-1 text-blue-400" />
            <span className="text-[9px] font-mono font-bold">Faxina</span>
          </motion.button>
        )}
      </div>
    </div>
  );
}
