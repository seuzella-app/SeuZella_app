'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  Coins,
  Cpu,
  ShieldCheck,
  TrendingUp,
  MessageSquare,
  Key,
  Flame,
  Sparkles,
  Zap,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import {
  runYieldWarRoom,
  runGuestConcierge,
  runHITLArbitration,
  runLockGuardian,
  runExperienceDistiller,
  type SOPExecutionLog,
} from '@/lib/metagpt';

type AvailableSOP = 'yield' | 'concierge' | 'hitl' | 'lock' | 'distiller';

export function SOPTimelineVisualizer() {
  const [selectedSOP, setSelectedSOP] = useState<AvailableSOP>('yield');
  const [isRunning, setIsRunning] = useState(false);
  const [executionLog, setExecutionLog] = useState<SOPExecutionLog | null>(null);

  const handleExecuteSOP = async () => {
    setIsRunning(true);
    setExecutionLog(null);

    try {
      let res: any;
      if (selectedSOP === 'yield') {
        res = await runYieldWarRoom({
          holidayName: 'Réveillon 2026/2027',
          nights: 4,
          totalRooms: 6,
          baseDailyPrice: 450,
          customIncrease: 200,
          occupancyRate: 0.92,
        });
      } else if (selectedSOP === 'concierge') {
        res = await runGuestConcierge({
          messageText: 'Olá! Qual a senha do Wi-Fi e como funciona a fechadura?',
          guestName: 'Mariana Duarte',
          propertyName: 'Pousada Solar das Marés',
          wifiPassword: 'marés_vip2026',
        });
      } else if (selectedSOP === 'hitl') {
        res = await runHITLArbitration({
          guestName: 'Carlos Andrade',
          guestPhone: '(21) 97110-3344',
          propertyName: 'Pousada Solar das Marés',
          reason: 'USER_CLICK_ASSUMIR',
        });
      } else if (selectedSOP === 'lock') {
        res = await runLockGuardian({
          roomName: 'Suíte Master 101',
          guestName: 'Maria Silva',
          batteryLevel: 88,
          isCheckOut: true,
        });
      } else {
        res = await runExperienceDistiller({
          guestName: 'Fernanda Lima',
          roomName: 'Suíte Luxo 103',
          npsScore: 10,
          feedbackText: 'Amamos o café da manhã e o atendimento no WhatsApp foi super rápido!',
        });
      }

      setExecutionLog(res.log);
    } catch (err: any) {
      console.error('Erro na execução do SOP:', err);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="bg-[#0e0e17] border border-white/[0.08] rounded-3xl p-6 space-y-6 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
      {/* Header do Visualizador */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
              METAGPT SOP ORCHESTRATION ENGINE
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              LIVE MULTI-AGENT
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Execução de Procedimentos Operacionais Padronizados com governança e validação cruzada entre papéis.
          </p>
        </div>

        {/* Botão de Execução */}
        <button
          onClick={handleExecuteSOP}
          disabled={isRunning}
          className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold font-mono text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.35)] active:scale-95 transition-all disabled:opacity-50"
        >
          {isRunning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Orquestrando Agentes...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Executar SOP ao Vivo</span>
            </>
          )}
        </button>
      </div>

      {/* Seletor de SOPs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {[
          { id: 'yield', label: 'Yield War-Room', icon: Flame, color: 'text-amber-400', border: 'border-amber-500/30' },
          { id: 'concierge', label: 'Delirium Zero Concierge', icon: MessageSquare, color: 'text-emerald-400', border: 'border-emerald-500/30' },
          { id: 'hitl', label: 'HITL Arbitration', icon: ShieldCheck, color: 'text-cyan-400', border: 'border-cyan-500/30' },
          { id: 'lock', label: 'Lock Guardian', icon: Key, color: 'text-indigo-400', border: 'border-indigo-500/30' },
          { id: 'distiller', label: 'Experience Distiller', icon: Sparkles, color: 'text-purple-400', border: 'border-purple-500/30' },
        ].map((item) => {
          const Icon = item.icon;
          const isSelected = selectedSOP === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { setSelectedSOP(item.id as AvailableSOP); setExecutionLog(null); }}
              className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden ${
                isSelected
                  ? `bg-white/[0.08] ${item.border} shadow-[0_0_15px_rgba(255,255,255,0.05)]`
                  : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] text-zinc-400'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${item.color}`} />
                <span className={`text-xs font-bold font-mono truncate ${isSelected ? 'text-white' : 'text-zinc-400'}`}>
                  {item.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Painel de Resultados da Execução */}
      <div className="bg-black/40 border border-white/[0.06] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 text-xs font-mono">
          <span className="text-zinc-400">STATUS DO PIPELINE:</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              {executionLog?.durationMs ? `${executionLog.durationMs}ms` : '0ms'}
            </span>
            <span className="flex items-center gap-1.5 text-zinc-300">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              {executionLog?.totalTokensUsed ?? 0} tokens (${executionLog?.estimatedCostUsd?.toFixed(5) ?? '0.00000'})
            </span>
          </div>
        </div>

        {/* Timeline dos Passos dos Agentes */}
        {executionLog ? (
          <div className="space-y-3">
            {executionLog.steps.map((step) => (
              <motion.div
                key={step.stepIndex}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-mono font-bold flex items-center justify-center text-[10px]">
                    {step.stepIndex}
                  </span>
                  <div>
                    <div className="font-bold text-white font-mono flex items-center gap-2">
                      <span>{step.roleName}</span>
                      <ChevronRight className="w-3 h-3 text-zinc-500" />
                      <span className="text-emerald-400">{step.actionName}</span>
                    </div>
                    <div className="text-[11px] text-zinc-400 font-mono truncate max-w-[450px]">
                      {step.outputSummary}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 font-mono text-[10px] text-zinc-500 self-end md:self-center">
                  <span>{step.durationMs}ms</span>
                  <span>{step.tokensUsed} tokens</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-zinc-500 text-xs font-mono">
            Clique em "Executar SOP ao Vivo" para orquestrar os agentes do MetaGPT.
          </div>
        )}
      </div>
    </div>
  );
}
