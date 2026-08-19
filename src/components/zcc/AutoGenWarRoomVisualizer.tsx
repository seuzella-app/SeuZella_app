'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Play,
  CheckCircle2,
  Clock,
  Coins,
  Sparkles,
  RefreshCw,
  Scale,
  HeartHandshake,
  Briefcase,
  Bot,
  MessageSquareQuote,
} from 'lucide-react';
import {
  runYieldDebate,
  runGuestEmpathyNestedChat,
  runExecutiveWarRoom,
  type GroupChatTranscript,
} from '@/lib/autogen';

type AutoGenDebateType = 'yield_debate' | 'guest_empathy' | 'executive_board';

export function AutoGenWarRoomVisualizer() {
  const [selectedDebate, setSelectedDebate] = useState<AutoGenDebateType>('yield_debate');
  const [isRunning, setIsRunning] = useState(false);
  const [transcript, setTranscript] = useState<GroupChatTranscript | null>(null);

  const handleRunDebate = async () => {
    setIsRunning(true);
    setTranscript(null);

    try {
      if (selectedDebate === 'yield_debate') {
        const res = await runYieldDebate('Réveillon 2026/2027', 450);
        setTranscript(res);
      } else if (selectedDebate === 'guest_empathy') {
        const res = await runGuestEmpathyNestedChat(
          'Preciso muito entrar às 12h porque meu vôo chega cedo com 2 crianças pequenas.',
          'Juliana Menezes'
        );
        setTranscript(res.transcript);
      } else {
        const res = await runExecutiveWarRoom(
          'Qual a estratégia ótima para maximizar reservas diretas no segundo semestre?'
        );
        setTranscript(res);
      }
    } catch (err) {
      console.error('Erro no debate AutoGen:', err);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="bg-[#0e0e17] border border-white/[0.08] rounded-3xl p-6 space-y-6 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
              AUTOGEN MULTI-AGENT GROUPCHAT & WAR ROOM
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              CONVERSATIONAL CONSENSUS
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Debates adversariais dinâmicos entre agentes especializados para tomada de decisão e consenso automatizado.
          </p>
        </div>

        <button
          onClick={handleRunDebate}
          disabled={isRunning}
          className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold font-mono text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.35)] active:scale-95 transition-all disabled:opacity-50"
        >
          {isRunning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Debatendo em Grupo...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Iniciar Debate AutoGen</span>
            </>
          )}
        </button>
      </div>

      {/* Seletor de Debates */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            id: 'yield_debate',
            label: 'Yield Maximizer vs Defender',
            desc: 'Estrategista de Receita vs Guardião de Ocupação',
            icon: Scale,
            color: 'text-amber-400',
            border: 'border-amber-500/30',
          },
          {
            id: 'guest_empathy',
            label: 'Guest Empathy Committee',
            desc: 'Acolhimento WhatsApp + Auditoria de Regras',
            icon: HeartHandshake,
            color: 'text-emerald-400',
            border: 'border-emerald-500/30',
          },
          {
            id: 'executive_board',
            label: 'Executive Board War Room',
            desc: 'Diretoria Financeira, Demanda e Retenção',
            icon: Briefcase,
            color: 'text-cyan-400',
            border: 'border-cyan-500/30',
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = selectedDebate === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { setSelectedDebate(tab.id as AutoGenDebateType); setTranscript(null); }}
              className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
                isSelected
                  ? `bg-white/[0.08] ${tab.border} shadow-[0_0_15px_rgba(255,255,255,0.05)]`
                  : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] text-zinc-400'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${tab.color}`} />
                <span className={`text-xs font-bold font-mono truncate ${isSelected ? 'text-white' : 'text-zinc-400'}`}>
                  {tab.label}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 line-clamp-1">{tab.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Painel do Diálogo AutoGen */}
      <div className="bg-black/40 border border-white/[0.06] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 text-xs font-mono">
          <span className="text-zinc-400">STATUS DO DEBATE:</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              {transcript?.durationMs ? `${transcript.durationMs}ms` : '0ms'}
            </span>
            <span className="flex items-center gap-1.5 text-zinc-300">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              {transcript?.totalTokensUsed ?? 0} tokens (${transcript?.estimatedCostUsd?.toFixed(5) ?? '0.00000'})
            </span>
          </div>
        </div>

        {/* Diálogo dos Agentes */}
        {transcript ? (
          <div className="space-y-4">
            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {transcript.messages.map((msg, idx) => {
                const isUser = msg.sender === 'User';
                return (
                  <motion.div
                    key={msg.id || idx}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-3 rounded-xl border text-xs leading-relaxed ${
                      isUser
                        ? 'bg-zinc-900/80 border-zinc-700 text-zinc-300'
                        : 'bg-white/[0.04] border-white/[0.08] text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 font-bold font-mono text-[11px] text-cyan-400">
                        <Bot className="w-3.5 h-3.5" />
                        <span>{msg.sender}</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        Turno {idx + 1}
                      </span>
                    </div>
                    <p className="text-zinc-300">{msg.content}</p>
                  </motion.div>
                );
              })}
            </div>

            {/* Box de Consenso Aprovado */}
            <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="text-xs font-bold text-cyan-300 font-mono flex items-center gap-2">
                  <span>CONSENSO ALCANÇADO PELO GRUPO</span>
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                  {transcript.consensusSummary}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-zinc-500 text-xs font-mono flex flex-col items-center gap-2">
            <MessageSquareQuote className="w-8 h-8 text-zinc-600 mb-1" />
            <span>Clique em "Iniciar Debate AutoGen" para ver a colaboração multi-agente em tempo real.</span>
          </div>
        )}
      </div>
    </div>
  );
}
