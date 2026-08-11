'use client';

// ═══════════════════════════════════════════════════════════════════════════
// QUICK ACTIONS CARD — Neo-Emerald HUD Quick Actions
// ═══════════════════════════════════════════════════════════════════════════
// Card flutuante com 4 ações de 1 toque:
//
// POUSADA:
//   1. Kill-Switch IA (ON/OFF/Handover)
//   2. Check-in Express + Guia Digital
//   3. Gerenciador de Fechaduras (unlock/PIN)
//   4. Sync Booking.com forçado
//
// AIRBNB:
//   1. Gerar PIN Digital (self check-in)
//   2. Notificar Limpeza (faxineira)
//   3. PIX Gatekeeper toggle
//   4. Calculadora Preço Dinâmico
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Power, Send, KeyRound, RefreshCw, Sparkles, Bell, Shield, Calculator } from 'lucide-react';

interface QuickActionsCardProps {
  niche: 'pousada' | 'airbnb';
  onAction?: (actionId: string, data?: any) => void;
}

interface ActionButton {
  id: string;
  label: string;
  icon: typeof Power;
  color: string;
  glow: string;
  description: string;
}

export function QuickActionsCard({ niche, onAction }: QuickActionsCardProps) {
  const [aiState, setAiState] = useState<'on' | 'off' | 'handover'>('on');
  const [pixGatekeeper, setPixGatekeeper] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const isPousada = niche === 'pousada';

  const pousadaActions: ActionButton[] = [
    {
      id: 'kill-switch',
      label: aiState === 'on' ? 'IA ON' : aiState === 'off' ? 'IA OFF' : 'HANDOVER',
      icon: Power,
      color: aiState === 'on'
        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
        : 'bg-red-500/15 text-red-400 border-red-500/30',
      glow: aiState === 'on' ? 'hud-glow-emerald' : 'hud-glow-red',
      description: 'Toggle atendimento automático da IA',
    },
    {
      id: 'checkin-express',
      label: 'Check-in',
      icon: Send,
      color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
      glow: 'hud-glow-blue',
      description: 'Enviar Guia Digital ao hóspede via WhatsApp',
    },
    {
      id: 'lock-manager',
      label: 'Fechadura',
      icon: KeyRound,
      color: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      glow: '',
      description: 'Desbloquear quarto ou gerar PIN temporário',
    },
    {
      id: 'booking-sync',
      label: 'Sync iCal',
      icon: RefreshCw,
      color: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
      glow: '',
      description: 'Forçar sincronização Booking.com',
    },
  ];

  const airbnbActions: ActionButton[] = [
    {
      id: 'pin-generate',
      label: 'Gerar PIN',
      icon: KeyRound,
      color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
      glow: 'hud-glow-blue',
      description: 'Gerar senha de self check-in (4-6 dígitos)',
    },
    {
      id: 'notify-cleaning',
      label: 'Limpeza',
      icon: Bell,
      color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      glow: 'hud-glow-emerald',
      description: 'Notificar faxineira sobre check-out',
    },
    {
      id: 'pix-gatekeeper',
      label: pixGatekeeper ? 'ESCUDO ON' : 'ESCUDO OFF',
      icon: Shield,
      color: pixGatekeeper
        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
        : 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
      glow: pixGatekeeper ? 'hud-glow-emerald' : '',
      description: 'Filtro anti-ban: bloqueia PIX/telefone antes da reserva',
    },
    {
      id: 'price-calculator',
      label: 'Preço',
      icon: Calculator,
      color: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      glow: '',
      description: 'Ajustar diária para fim de semana/feriado',
    },
  ];

  const actions = isPousada ? pousadaActions : airbnbActions;

  const handleAction = (actionId: string) => {
    if (actionId === 'kill-switch') {
      const next = aiState === 'on' ? 'off' : aiState === 'off' ? 'handover' : 'on';
      setAiState(next);
    }
    if (actionId === 'pix-gatekeeper') {
      setPixGatekeeper(!pixGatekeeper);
    }
    if (actionId === 'booking-sync') {
      setLastSync(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    }
    onAction?.(actionId, { aiState, pixGatekeeper });
  };

  return (
    <div className="px-3 py-2">
      {/* Quick Actions Grid 2×2 */}
      <div className="grid grid-cols-4 gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          const isPulsing = action.id === 'kill-switch' && aiState === 'on';
          return (
            <motion.button
              key={action.id}
              whileTap={{ scale: 0.92 }}
              onClick={() => handleAction(action.id)}
              className={`relative flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-xl border ${action.color} ${action.glow} ${isPulsing ? 'hud-pulse-emerald' : ''} transition-all hover:scale-105`}
              title={action.description}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[9px] font-bold uppercase tracking-wider leading-none">
                {action.label}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Status indicators */}
      <div className="mt-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          {isPousada ? (
            <>
              {aiState === 'on' && (
                <span className="badge-nano text-emerald-400">
                  ● IA ZÉLLA ATIVA
                </span>
              )}
              {aiState === 'off' && (
                <span className="badge-nano text-red-400 hud-pulse-red">
                  ● IA DESLIGADA
                </span>
              )}
              {aiState === 'handover' && (
                <span className="badge-nano text-amber-400">
                  ● HANDOVER HUMANO
                </span>
              )}
              {lastSync && (
                <span className="badge-nano text-white/40">
                  ⟳ SYNC {lastSync}
                </span>
              )}
            </>
          ) : (
            <>
              {pixGatekeeper && (
                <span className="badge-nano text-emerald-400">
                  ● ESCUDO ANTI-BAN ATIVO
                </span>
              )}
              <span className="badge-nano text-white/40">
                IA ATIVA
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
