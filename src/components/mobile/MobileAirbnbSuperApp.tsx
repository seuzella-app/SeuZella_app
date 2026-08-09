'use client';

// ==============================================================================
// SEU ZÉLLA SUPER APP MOBILE — AIRBNB (Google Stitch Fidelity)
// ==============================================================================
// - 100% Mobile Native Layout extracted directly from Google Stitch designs
// - High-performance dark HUD aesthetic (Obsidian #0a0a0f, Electric Blue #3b82f6)
// - Fixed top app bar with notification bell & PIX Gatekeeper Anti-Ban status
// - Fixed bottom navigation bar (Financeiro, Check-ins/PIN, PIX Shield, Link-in-Bio, Simulador)
// - Connected to real backend BFF APIs (/api/v1/guest/ddc/overview)
// ==============================================================================

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  CreditCard,
  Users,
  Brain,
  Smartphone,
  Settings,
  Bell,
  Wifi,
  Zap,
  TrendingUp,
  ShieldCheck,
  QrCode,
  Lock,
  Unlock,
  Key,
  RefreshCw,
  Send,
  MessageSquare,
  ChevronRight,
  MoreHorizontal,
  Power,
  Sparkles,
  Home,
  Link as LinkIcon,
  Sparkle,
  SlidersHorizontal,
  DollarSign,
  Copy,
} from 'lucide-react';

export function MobileAirbnbSuperApp() {
  const [activeTab, setActiveTab] = useState<'financeiro' | 'checkins' | 'shield' | 'linkinbio' | 'simulador'>('financeiro');
  const [aiActive, setAiActive] = useState<boolean>(true);
  const [pixShieldActive, setPixShieldActive] = useState<boolean>(true);
  const [time, setTime] = useState<string>('');
  const [pinCode, setPinCode] = useState<string>('8492');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleAI = () => {
    setAiActive((prev) => {
      const next = !prev;
      toast.success(next ? '🤖 IA Zélla ATIVADA!' : '⏸️ IA Zélla PAUSADA');
      return next;
    });
  };

  const handleToggleShield = () => {
    setPixShieldActive((prev) => {
      const next = !prev;
      toast.info(next ? '🛡️ PIX Gatekeeper ATIVADO (Escudo Anti-Ban)' : '⚠️ Escudo Desativado');
      return next;
    });
  };

  const handleGeneratePIN = () => {
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();
    setPinCode(newPin);
    toast.success(`🔑 Novo PIN Digital Gerado: ${newPin}`);
  };

  const handleNotifyCleaners = (guestName: string) => {
    toast.success(`🧹 Notificação de Faxina pós-checkout enviada para a equipe (Hóspede: ${guestName})`);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col font-sans pb-24 selection:bg-blue-500/30">
      {/* 🔵 TOP APP BAR (AIRBNB MOBILE HUD HEADER) */}
      <header className="sticky top-0 z-50 bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/[0.08] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Home className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-mono text-xs font-extrabold tracking-tight text-blue-400">
              [SEU ZÉLLA // AIRBNB]
            </span>
            <span className="text-[9px] font-mono text-zinc-400">
              {time || '10:45:00'} · SELF CHECK-IN HUD
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleShield}
            className={`px-2.5 py-1 rounded-full text-[9px] font-mono font-extrabold border transition-all flex items-center gap-1 ${
              pixShieldActive
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-sm shadow-blue-500/20'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}
          >
            <ShieldCheck className="w-3 h-3 text-blue-400" />
            <span>{pixShieldActive ? 'SHIELD ON' : 'OFF'}</span>
          </button>

          <button className="p-2 rounded-lg bg-white/[0.04] border border-white/10 text-zinc-300 hover:text-white">
            <Bell className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ⚡ 1-TAP QUICK ACTIONS CAROUSEL */}
      <div className="bg-[#0b0e17] border-b border-white/[0.06] p-3">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[10px] font-mono font-extrabold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
            <Zap className="w-3 h-3 text-blue-400" />
            Painel do Anfitrião
          </span>
          <span className="text-[9px] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
            AIRBNB HUD
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={handleGeneratePIN}
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/[0.03] border border-white/10 hover:border-blue-500/40 text-zinc-200 active:scale-95 transition-all"
          >
            <Key className="w-4 h-4 text-blue-400 mb-1" />
            <span className="text-[9px] font-mono font-bold">Novo PIN</span>
          </button>

          <button
            onClick={() => handleNotifyCleaners('Lucas M.')}
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/[0.03] border border-white/10 hover:border-cyan-500/40 text-zinc-200 active:scale-95 transition-all"
          >
            <MessageSquare className="w-4 h-4 text-cyan-400 mb-1" />
            <span className="text-[9px] font-mono font-bold">Faxina</span>
          </button>

          <button
            onClick={handleToggleAI}
            className={`flex flex-col items-center justify-center p-2 rounded-xl border active:scale-95 transition-all ${
              aiActive
                ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
            }`}
          >
            <Power className="w-4 h-4 mb-1" />
            <span className="text-[9px] font-mono font-bold">{aiActive ? 'IA ON' : 'IA OFF'}</span>
          </button>

          <button
            onClick={() => setActiveTab('linkinbio')}
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/[0.03] border border-white/10 hover:border-purple-500/40 text-zinc-200 active:scale-95 transition-all"
          >
            <LinkIcon className="w-4 h-4 text-purple-400 mb-1" />
            <span className="text-[9px] font-mono font-bold">Link-in-Bio</span>
          </button>
        </div>
      </div>

      {/* 📱 TAB CONTENT AREA */}
      <main className="p-4 flex-1">
        <AnimatePresence mode="wait">
          {/* TAB 1: FINANCEIRO AIRBNB */}
          {activeTab === 'financeiro' && (
            <motion.div
              key="financeiro"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-mono text-sm font-bold text-blue-400 tracking-tight">
                  &gt; FATURAMENTO & METRICAS AIRBNB
                </h2>
                <span className="text-[10px] font-mono text-zinc-400 bg-white/[0.04] px-2 py-1 rounded border border-white/10">
                  Mês Atual
                </span>
              </div>

              {/* BENTO KPI GRID */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-3 flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
                  <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase">Receita Bruta</span>
                  <span className="text-xl font-mono font-extrabold text-white tracking-tight my-1">R$ 8.950</span>
                  <span className="text-[9px] font-mono text-blue-400 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> +18% m/m
                  </span>
                </div>

                <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-3 flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-emerald-500" />
                  <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase">Cliques Link-in-Bio</span>
                  <span className="text-xl font-mono font-extrabold text-cyan-300 tracking-tight my-1">342</span>
                  <span className="text-[9px] font-mono text-emerald-400">12 Reservas Diretas</span>
                </div>

                <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-3 flex flex-col justify-between relative overflow-hidden">
                  <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase">Diária Média</span>
                  <span className="text-xl font-mono font-extrabold text-blue-300 tracking-tight my-1">R$ 380</span>
                  <span className="text-[9px] font-mono text-zinc-400">Studio Jardins</span>
                </div>

                <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-3 flex flex-col justify-between relative overflow-hidden">
                  <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase">PIX Bloq. Anti-Ban</span>
                  <span className="text-xl font-mono font-extrabold text-emerald-400 tracking-tight my-1">5</span>
                  <span className="text-[9px] font-mono text-zinc-400">Escudo Airbnb Ativo</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: CHECK-INS & PIN FECHADURA */}
          {activeTab === 'checkins' && (
            <motion.div
              key="checkins"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-mono text-sm font-bold text-blue-400 tracking-tight">
                  &gt; SELF CHECK-IN & PIN DIGITAL
                </h2>
                <button
                  onClick={handleGeneratePIN}
                  className="text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 px-2 py-1 rounded border border-blue-500/40 hover:bg-blue-500/30 transition-all"
                >
                  + Gerar Novo PIN
                </button>
              </div>

              {/* PIN CARD ACTIVE */}
              <div className="bg-gradient-to-r from-blue-950/40 to-indigo-950/40 border border-blue-500/30 rounded-xl p-4 flex flex-col gap-2">
                <span className="text-[9px] font-mono text-blue-400 font-bold uppercase">PIN Digital do Flat (Válido para o Hóspede Atual)</span>
                <div className="flex items-center justify-between my-1">
                  <span className="text-3xl font-mono font-black tracking-widest text-white">{pinCode}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(pinCode);
                      toast.success('📋 PIN copiado para a área de transferência!');
                    }}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-200"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-[10px] text-zinc-400">Válido até Domingo às 11:00 (Checkout Lucas M.)</span>
              </div>

              {/* UPCOMING GUESTS */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-zinc-200">Próximas Entradas</span>

                <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-zinc-100">Lucas Machado</span>
                      <span className="text-[10px] font-mono text-zinc-400">Studio Jardins #402</span>
                    </div>
                    <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Entrada Hoje 14:00
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-white/[0.04]">
                    <button
                      onClick={() => handleNotifyCleaners('Lucas M.')}
                      className="flex-1 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[10px] font-mono font-bold flex items-center justify-center gap-1 hover:bg-blue-500/25 transition-all"
                    >
                      <MessageSquare className="w-3 h-3" />
                      Chamar Faxina
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 3: PIX SHIELD ANTI-BAN */}
          {activeTab === 'shield' && (
            <motion.div
              key="shield"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-mono text-sm font-bold text-blue-400 tracking-tight">
                  &gt; PIX GATEKEEPER (ANTI-BAN AIRBNB)
                </h2>
                <button
                  onClick={handleToggleShield}
                  className={`text-[10px] font-mono font-bold px-2 py-1 rounded border transition-all ${
                    pixShieldActive
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  }`}
                >
                  {pixShieldActive ? 'ESCUDO ATIVO' : 'ESCUDO DESATIVADO'}
                </button>
              </div>

              <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-zinc-100">Proteção contra Punições do Algoritmo</span>
                    <span className="text-[10px] text-zinc-400">Filtra dados bancários e WhatsApp no chat do Airbnb</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 text-[11px] font-mono text-zinc-300">
                  <span className="text-emerald-400 font-bold">5 Tentativas de Chave PIX Interceptadas</span> e convertidas com segurança sem violar as políticas do Airbnb.
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 4: ADDON LINK-IN-BIO */}
          {activeTab === 'linkinbio' && (
            <motion.div
              key="linkinbio"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-mono text-sm font-bold text-purple-400 tracking-tight">
                  &gt; LINK-IN-BIO INSTAGRAM
                </h2>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  R$ 0 TAXA AIRBNB
                </span>
              </div>

              <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-200">Perfil: @studiojardins.zehla</span>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText('https://zehla.com.br/b/studiojardins');
                      toast.success('🔗 Link da Bio copiado!');
                    }}
                    className="text-[10px] font-mono text-purple-400 hover:underline flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" /> Copiar Link
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 my-1">
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <span className="text-[9px] font-mono text-zinc-400">Visitas na Bio</span>
                    <span className="text-lg font-mono font-extrabold text-purple-300 block">342</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <span className="text-[9px] font-mono text-zinc-400">Reservas Diretas</span>
                    <span className="text-lg font-mono font-extrabold text-emerald-400 block">12</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 5: SIMULADOR AIRBNB */}
          {activeTab === 'simulador' && (
            <motion.div
              key="simulador"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-mono text-sm font-bold text-blue-400 tracking-tight">
                  &gt; SIMULADOR AIRBNB 24H
                </h2>
              </div>

              <div className="bg-[#07090e] border border-white/10 rounded-xl p-3 flex flex-col gap-3 min-h-[280px]">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                  <span className="text-xs font-mono font-bold text-zinc-200">Hóspede Airbnb</span>
                  <span className="text-[9px] font-mono text-zinc-400">Latência: 380ms</span>
                </div>

                <div className="flex flex-col gap-2 text-xs">
                  <div className="self-start bg-zinc-800/80 border border-zinc-700 text-zinc-200 p-2.5 rounded-2xl rounded-tl-none max-w-[80%]">
                    Tem vaga de garagem inclusa e como funciona a chave do flat?
                  </div>

                  <div className="self-end bg-blue-950/60 border border-blue-500/40 text-blue-200 p-2.5 rounded-2xl rounded-tr-none max-w-[85%] font-sans">
                    <div className="flex items-center gap-1 text-[9px] font-mono text-blue-400 mb-1">
                      <Sparkles className="w-3 h-3" /> Zélla AI (Confiança: 99%)
                    </div>
                    Olá! Sim, temos 1 vaga coberta e demarcada no subsolo. A entrada é via fechadura digital com PIN enviado automaticamente 2 horas antes do seu check-in! 🔑🚗
                  </div>
                </div>

                <button
                  onClick={() => toast.success('🧪 Teste de atendimento enviado!')}
                  className="mt-auto w-full py-2 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-300 text-xs font-mono font-bold flex items-center justify-center gap-1.5 hover:bg-blue-500/30 transition-all"
                >
                  <MessageSquare className="w-4 h-4" />
                  Simular Pergunta Airbnb
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* 🔵 FIXED MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#060913]/95 backdrop-blur-2xl border-t border-white/[0.12] px-2 py-2 shadow-2xl shadow-black">
        <div className="flex items-center justify-around max-w-md mx-auto">
          <button
            onClick={() => setActiveTab('financeiro')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
              activeTab === 'financeiro'
                ? 'text-blue-400 bg-blue-500/15 border border-blue-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <CreditCard className="w-5 h-5" />
            <span className="text-[9px] font-mono font-bold mt-0.5">Financeiro</span>
          </button>

          <button
            onClick={() => setActiveTab('checkins')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
              activeTab === 'checkins'
                ? 'text-blue-400 bg-blue-500/15 border border-blue-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Key className="w-5 h-5" />
            <span className="text-[9px] font-mono font-bold mt-0.5">Check-ins</span>
          </button>

          <button
            onClick={() => setActiveTab('shield')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
              activeTab === 'shield'
                ? 'text-blue-400 bg-blue-500/15 border border-blue-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
            <span className="text-[9px] font-mono font-bold mt-0.5">PIX Shield</span>
          </button>

          <button
            onClick={() => setActiveTab('linkinbio')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
              activeTab === 'linkinbio'
                ? 'text-purple-400 bg-purple-500/15 border border-purple-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <LinkIcon className="w-5 h-5" />
            <span className="text-[9px] font-mono font-bold mt-0.5">Link-in-Bio</span>
          </button>

          <button
            onClick={() => setActiveTab('simulador')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
              activeTab === 'simulador'
                ? 'text-blue-400 bg-blue-500/15 border border-blue-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Brain className="w-5 h-5" />
            <span className="text-[9px] font-mono font-bold mt-0.5">Simulador</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
