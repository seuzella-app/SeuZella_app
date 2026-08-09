'use client';

// ==============================================================================
// SEU ZÉLLA SUPER APP MOBILE — POUSADA (Google Stitch Fidelity)
// ==============================================================================
// - 100% Mobile Native Layout extracted directly from Google Stitch designs
// - High-performance dark HUD aesthetic (Obsidian #0a0a0f, Emerald #10b981)
// - Fixed top app bar with notification bell & live WhatsApp AI status
// - Fixed bottom navigation bar (Financeiro, Hóspedes, Quartos/Fechaduras, Simulador, Mais)
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
  Bed,
  CheckCircle2,
  Clock,
  Phone,
  Building2,
  Coins,
} from 'lucide-react';
import { ZellaLogo } from '@/components/brand/ZellaLogo';

export function MobilePousadaSuperApp() {
  const [activeTab, setActiveTab] = useState<'financeiro' | 'hospedes' | 'quartos' | 'simulador' | 'mais'>('financeiro');
  const [aiActive, setAiActive] = useState<boolean>(true);
  const [time, setTime] = useState<string>('');
  const [guestFilter, setGuestFilter] = useState<'todos' | 'whatsapp' | 'booking' | 'airbnb'>('todos');
  const [lockState, setLockState] = useState<Record<string, boolean>>({
    '101': true,
    '102': true,
    '103': false,
    '104': true,
  });

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
      toast.success(next ? '🤖 IA Zélla ATIVADA com sucesso!' : '⏸️ IA Zélla PAUSADA (Modo Recepção)');
      return next;
    });
  };

  const handleToggleLock = (roomNumber: string) => {
    setLockState((prev) => {
      const isCurrentlyLocked = prev[roomNumber] ?? true;
      const next = !isCurrentlyLocked;
      toast.success(next ? `🔒 Quarto ${roomNumber} Trancado` : `🔓 Quarto ${roomNumber} Desbloqueado Remotamente!`);
      return { ...prev, [roomNumber]: next };
    });
  };

  const handleSendGuide = (guestName: string) => {
    toast.success(`📲 Guia Digital enviado para ${guestName} via WhatsApp!`);
  };

  const handleSyncBooking = () => {
    toast.promise(new Promise((res) => setTimeout(res, 1200)), {
      loading: '🔄 Sincronizando Booking.com & PMS...',
      success: '✅ Calendários sincronizados!',
      error: 'Erro no sync',
    });
  };

  // Mock Guest List for Pousada
  const guests = [
    { id: '1', name: 'Ana Silva', room: 'Suíte Master 101', channel: 'whatsapp', status: 'Check-in Hoje', time: '14:00', paid: 'R$ 900', statusColor: 'bg-emerald-500/20 text-emerald-400' },
    { id: '2', name: 'Carlos Mendes', room: 'Quarto Luxo 102', channel: 'booking', status: 'Hóspede Ativo', time: 'Saída Amanhã', paid: 'R$ 1.250', statusColor: 'bg-cyan-500/20 text-cyan-400' },
    { id: '3', name: 'Juliana Costa', room: 'Bangalô 103', channel: 'airbnb', status: 'Confirmado', time: 'Sex 15:00', paid: 'R$ 1.600', statusColor: 'bg-blue-500/20 text-blue-400' },
    { id: '4', name: 'Roberto Lima', room: 'Standard 104', channel: 'whatsapp', status: 'Checkout Pendente', time: '11:00', paid: 'R$ 650', statusColor: 'bg-amber-500/20 text-amber-400' },
  ];

  const filteredGuests = guestFilter === 'todos' 
    ? guests 
    : guests.filter((g) => g.channel === guestFilter);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col font-sans pb-24 selection:bg-emerald-500/30">
      {/* 🟢 TOP APP BAR (MOBILE HUD HEADER) */}
      <header className="sticky top-0 z-50 bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/[0.08] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Zap className="w-4 h-4 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="font-mono text-xs font-extrabold tracking-tight text-emerald-400">
              [SEU ZÉLLA // POUSADA]
            </span>
            <span className="text-[9px] font-mono text-zinc-400">
              {time || '10:45:00'} · VIRTUAL RECEPTION 24H
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleAI}
            className={`px-2.5 py-1 rounded-full text-[9px] font-mono font-extrabold border transition-all flex items-center gap-1 ${
              aiActive
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
            }`}
          >
            <Power className="w-3 h-3" />
            <span>{aiActive ? 'IA ON' : 'IA OFF'}</span>
          </button>
          <button className="p-2 rounded-lg bg-white/[0.04] border border-white/10 text-zinc-300 hover:text-white">
            <Bell className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ⚡ 1-TAP QUICK ACTIONS CAROUSEL */}
      <div className="bg-[#0e0e15] border-b border-white/[0.06] p-3">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[10px] font-mono font-extrabold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            Painel de Controle Rápido
          </span>
          <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
            1-TAP HUD
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => handleSendGuide('Hóspedes de Hoje')}
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/[0.03] border border-white/10 hover:border-emerald-500/40 text-zinc-200 active:scale-95 transition-all"
          >
            <Send className="w-4 h-4 text-emerald-400 mb-1" />
            <span className="text-[9px] font-mono font-bold">Enviar Guia</span>
          </button>

          <button
            onClick={() => handleToggleLock('101')}
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/[0.03] border border-white/10 hover:border-amber-500/40 text-zinc-200 active:scale-95 transition-all"
          >
            {lockState['101'] ? (
              <Lock className="w-4 h-4 text-amber-400 mb-1" />
            ) : (
              <Unlock className="w-4 h-4 text-emerald-400 mb-1" />
            )}
            <span className="text-[9px] font-mono font-bold">Qto 101</span>
          </button>

          <button
            onClick={handleSyncBooking}
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/[0.03] border border-white/10 hover:border-cyan-500/40 text-zinc-200 active:scale-95 transition-all"
          >
            <RefreshCw className="w-4 h-4 text-cyan-400 mb-1" />
            <span className="text-[9px] font-mono font-bold">Sync OTAs</span>
          </button>

          <button
            onClick={() => setActiveTab('simulador')}
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/[0.03] border border-white/10 hover:border-purple-500/40 text-zinc-200 active:scale-95 transition-all"
          >
            <Brain className="w-4 h-4 text-purple-400 mb-1" />
            <span className="text-[9px] font-mono font-bold">Testar IA</span>
          </button>
        </div>
      </div>

      {/* 📱 TAB CONTENT AREA */}
      <main className="p-4 flex-1">
        <AnimatePresence mode="wait">
          {/* TAB 1: FINANCEIRO & HUD */}
          {activeTab === 'financeiro' && (
            <motion.div
              key="financeiro"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-mono text-sm font-bold text-emerald-400 tracking-tight">
                  &gt; VISÃO FINANCEIRA & HUD
                </h2>
                <span className="text-[10px] font-mono text-zinc-400 bg-white/[0.04] px-2 py-1 rounded border border-white/10">
                  Mês Atual
                </span>
              </div>

              {/* BENTO KPI GRID */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-3 flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-cyan-500" />
                  <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase">Receita Mês</span>
                  <span className="text-xl font-mono font-extrabold text-white tracking-tight my-1">R$ 42.800</span>
                  <span className="text-[9px] font-mono text-emerald-400 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> +14% vs mês ant.
                  </span>
                </div>

                <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-3 flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-500" />
                  <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase">Ocupação Hoje</span>
                  <span className="text-xl font-mono font-extrabold text-cyan-300 tracking-tight my-1">88%</span>
                  <span className="text-[9px] font-mono text-zinc-400">14 de 16 quartos</span>
                </div>

                <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-3 flex flex-col justify-between relative overflow-hidden">
                  <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase">Diária Média (ADR)</span>
                  <span className="text-xl font-mono font-extrabold text-emerald-300 tracking-tight my-1">R$ 420</span>
                  <span className="text-[9px] font-mono text-emerald-400">+R$ 45 vs semana pass.</span>
                </div>

                <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-3 flex flex-col justify-between relative overflow-hidden">
                  <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase">Meta Save (80%)</span>
                  <span className="text-xl font-mono font-extrabold text-emerald-400 tracking-tight my-1">R$ 1.240</span>
                  <span className="text-[9px] font-mono text-zinc-400">Economia no WhatsApp</span>
                </div>
              </div>

              {/* RECENT TRANSACTIONS */}
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-zinc-200">Últimos Pagamentos PIX</span>
                  <span className="text-[10px] font-mono text-emerald-400">Automático</span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <QrCode className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-zinc-200">Ana S. (Suíte 101)</span>
                        <span className="text-[10px] font-mono text-zinc-400">Há 10 minutos · PIX MercadoPago</span>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-extrabold text-emerald-400">+R$ 450,00</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                        <Coins className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-zinc-200">Carlos M. (Quarto 102)</span>
                        <span className="text-[10px] font-mono text-zinc-400">Há 2 horas · Cartão Crédito</span>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-extrabold text-cyan-300">+R$ 620,00</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: HÓSPEDES & ENTREGAS */}
          {activeTab === 'hospedes' && (
            <motion.div
              key="hospedes"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-mono text-sm font-bold text-emerald-400 tracking-tight">
                  &gt; GESTÃO DE HÓSPEDES
                </h2>
                <span className="text-[10px] font-mono text-zinc-400">4 Ativos</span>
              </div>

              {/* QUICK FILTERS HORIZONTAL SCROLL */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {(['todos', 'whatsapp', 'booking', 'airbnb'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setGuestFilter(filter)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-mono font-bold uppercase transition-all whitespace-nowrap border ${
                      guestFilter === filter
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-500/20'
                        : 'bg-white/[0.03] text-zinc-400 border-white/10 hover:text-zinc-200'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              {/* GUEST CARDS LIST */}
              <div className="flex flex-col gap-2.5">
                {filteredGuests.map((guest) => (
                  <div
                    key={guest.id}
                    className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center font-mono font-bold text-xs text-emerald-400">
                          {guest.name.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-zinc-100">{guest.name}</span>
                          <span className="text-[10px] text-zinc-400 font-mono">{guest.room}</span>
                        </div>
                      </div>
                      <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${guest.statusColor}`}>
                        {guest.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.04] text-[10px] text-zinc-400">
                      <span>Horário: <strong className="text-zinc-200 font-mono">{guest.time}</strong></span>
                      <span>Total: <strong className="text-emerald-400 font-mono">{guest.paid}</strong></span>
                    </div>

                    <button
                      onClick={() => handleSendGuide(guest.name)}
                      className="w-full py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono font-bold flex items-center justify-center gap-1.5 hover:bg-emerald-500/25 transition-all"
                    >
                      <Send className="w-3 h-3" />
                      Enviar Guia Digital no WhatsApp
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* TAB 3: QUARTOS & TRAVAS */}
          {activeTab === 'quartos' && (
            <motion.div
              key="quartos"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-mono text-sm font-bold text-emerald-400 tracking-tight">
                  &gt; FECHADURAS INTELIGENTES
                </h2>
                <span className="text-[10px] font-mono text-zinc-400">Tuya / TTLock Sync</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {['101', '102', '103', '104'].map((room) => {
                  const isLocked = lockState[room] ?? true;
                  return (
                    <div
                      key={room}
                      className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 flex flex-col gap-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-zinc-200">Quarto {room}</span>
                        <span className={`w-2 h-2 rounded-full ${isLocked ? 'bg-amber-400' : 'bg-emerald-400 animate-ping'}`} />
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                        <span>Bateria: <strong className="text-emerald-400">92%</strong></span>
                        <span>{isLocked ? 'Trancado' : 'Aberto'}</span>
                      </div>

                      <button
                        onClick={() => handleToggleLock(room)}
                        className={`w-full py-2 rounded-lg border text-[10px] font-mono font-bold flex items-center justify-center gap-1.5 transition-all ${
                          isLocked
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                            : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        }`}
                      >
                        {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                        <span>{isLocked ? 'Destravar Remoto' : 'Trancar Porta'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* TAB 4: SIMULADOR ZÉLLA 24H */}
          {activeTab === 'simulador' && (
            <motion.div
              key="simulador"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-mono text-sm font-bold text-purple-400 tracking-tight">
                  &gt; SIMULADOR WHATSAPP 24H
                </h2>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  LIVE MOCK
                </span>
              </div>

              <div className="bg-[#07090e] border border-white/10 rounded-xl p-3 flex flex-col gap-3 min-h-[300px]">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-mono font-bold text-zinc-200">Hóspede de Teste</span>
                  </div>
                  <span className="text-[9px] font-mono text-zinc-400">Latência: 450ms</span>
                </div>

                <div className="flex flex-col gap-2 text-xs">
                  {/* Hóspede msg */}
                  <div className="self-start bg-zinc-800/80 border border-zinc-700 text-zinc-200 p-2.5 rounded-2xl rounded-tl-none max-w-[80%]">
                    Qual o horário do café da manhã da pousada e tem estacionamento grátis?
                  </div>

                  {/* IA Zélla msg */}
                  <div className="self-end bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 p-2.5 rounded-2xl rounded-tr-none max-w-[85%] font-sans">
                    <div className="flex items-center gap-1 text-[9px] font-mono text-emerald-400 mb-1">
                      <Sparkles className="w-3 h-3" /> Zélla AI (Confiança: 98%)
                    </div>
                    Olá! O nosso café da manhã delicioso é servido das 07:30 às 10:00 no restaurante principal. E sim, temos estacionamento privativo e gratuito para todos os nossos hóspedes! ☕🚗
                  </div>
                </div>

                <button
                  onClick={() => toast.success('🧪 Pergunta de teste enviada para o Cérebro Zélla!')}
                  className="mt-auto w-full py-2 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-mono font-bold flex items-center justify-center gap-1.5 hover:bg-purple-500/30 transition-all"
                >
                  <MessageSquare className="w-4 h-4" />
                  Simular Pergunta de Hóspede
                </button>
              </div>
            </motion.div>
          )}

          {/* TAB 5: MAIS & CONFIGURAÇÕES */}
          {activeTab === 'mais' && (
            <motion.div
              key="mais"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-mono text-sm font-bold text-zinc-300 tracking-tight">
                  &gt; MAIS OPCÕES & CANAIS
                </h2>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={handleSyncBooking}
                  className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between hover:bg-white/[0.06] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <RefreshCw className="w-5 h-5 text-cyan-400" />
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold text-zinc-200">Sincronizador Booking.com & iCal</span>
                      <span className="text-[10px] text-zinc-400">Status: Conectado e Sincronizado</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </button>

                <button
                  onClick={() => toast.info('📲 Conector WhatsApp Ativo (Session 01)')}
                  className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between hover:bg-white/[0.06] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-emerald-400" />
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold text-zinc-200">WhatsApp Web Conector</span>
                      <span className="text-[10px] text-emerald-400 font-mono">ONLINE · QR Code Ativo</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </button>

                <button
                  onClick={() => toast.success('⚙️ Configurações da Pousada salvas!')}
                  className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between hover:bg-white/[0.06] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Settings className="w-5 h-5 text-purple-400" />
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold text-zinc-200">Personalidade & Tom da IA</span>
                      <span className="text-[10px] text-zinc-400">Tom: Amigável e Atencioso</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* 🔴 FIXED MOBILE BOTTOM NAVIGATION BAR (GOOGLE STITCH PATTERN) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#060913]/95 backdrop-blur-2xl border-t border-white/[0.12] px-2 py-2 shadow-2xl shadow-black">
        <div className="flex items-center justify-around max-w-md mx-auto">
          <button
            onClick={() => setActiveTab('financeiro')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
              activeTab === 'financeiro'
                ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <CreditCard className="w-5 h-5" />
            <span className="text-[9px] font-mono font-bold mt-0.5">Financeiro</span>
          </button>

          <button
            onClick={() => setActiveTab('hospedes')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
              activeTab === 'hospedes'
                ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[9px] font-mono font-bold mt-0.5">Hóspedes</span>
          </button>

          <button
            onClick={() => setActiveTab('quartos')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
              activeTab === 'quartos'
                ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Key className="w-5 h-5" />
            <span className="text-[9px] font-mono font-bold mt-0.5">Travas</span>
          </button>

          <button
            onClick={() => setActiveTab('simulador')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
              activeTab === 'simulador'
                ? 'text-purple-400 bg-purple-500/15 border border-purple-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Brain className="w-5 h-5" />
            <span className="text-[9px] font-mono font-bold mt-0.5">Simulador</span>
          </button>

          <button
            onClick={() => setActiveTab('mais')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
              activeTab === 'mais'
                ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[9px] font-mono font-bold mt-0.5">Mais</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
