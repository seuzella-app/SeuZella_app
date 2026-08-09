'use client';

// ==============================================================================
// SEU ZÉLLA SUPER APP MOBILE — POUSADA (Google Stitch Cyber-Luxe 100% Fidelity)
// ==============================================================================
// - Design System: Cyber-Luxe Glassmorphism (The Void #0a0a0f + Primary Emerald #10b981)
// - 100% Faithful to Google Stitch HTML Specs in Downloads
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  LayoutGrid,
  Users,
  Brain,
  Power,
  Bell,
  Wifi,
  Zap,
  TrendingUp,
  ShieldCheck,
  QrCode,
  Lock,
  RefreshCw,
  Send,
  MessageSquare,
  ChevronRight,
  MoreHorizontal,
  Sparkles,
  BedDouble,
  Plus,
  Utensils,
  Wine,
  FileText,
  Eye,
  EyeOff,
  Globe,
  Settings,
  HelpCircle,
  Copy,
  Activity,
  Server,
  Key,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Smartphone,
} from 'lucide-react';

export function MobilePousadaSuperApp() {
  const [activeTab, setActiveTab] = useState<'visao_geral' | 'hospedes' | 'central_ia' | 'guia_conexao' | 'mais'>('visao_geral');
  const [aiActive, setAiActive] = useState<boolean>(true);
  const [time, setTime] = useState<string>('');
  const [guestFilter, setGuestFilter] = useState<'todos' | 'whatsapp' | 'booking' | 'airbnb'>('todos');
  const [showWifiPassword, setShowWifiPassword] = useState<boolean>(false);
  const [selectedRoomQr, setSelectedRoomQr] = useState<string>('101');
  const [fallbackPin, setFallbackPin] = useState<string>('849201');
  const [simulatedMsg, setSimulatedMsg] = useState<string>('');
  const [chatLog, setChatLog] = useState<Array<{ sender: 'guest' | 'zella'; text: string; time: string }>>([
    { sender: 'guest', text: 'Olá! Qual o horário de check-in e a senha do Wi-Fi?', time: '14:32' },
    { sender: 'zella', text: 'Olá! Nosso check-in é a partir das 14h. O Wi-Fi é "Zella_Guest_5G" e a senha é "cyberpunk2077". Precisa de ajuda com o estacionamento?', time: '14:32' },
  ]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
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
      toast.success(next ? '⚡ IA Zélla ATIVADA (Recepção Virtual 24h)' : '⏸️ IA Zélla PAUSADA');
      return next;
    });
  };

  const handleSendSimulatedMsg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simulatedMsg.trim()) return;

    const userText = simulatedMsg;
    setSimulatedMsg('');
    const nowStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    setChatLog((prev) => [...prev, { sender: 'guest', text: userText, time: nowStr }]);

    setTimeout(() => {
      let botReply = 'Entendi! Vou verificar a disponibilidade e te confirmo em instantes.';
      const lower = userText.toLowerCase();
      if (lower.includes('preço') || lower.includes('valor') || lower.includes('diária')) {
        botReply = 'Nossa Suíte Master está por R$ 850/noite e o Chalé Família R$ 620/noite. Posso gerar o link de reserva com desconto PIX agora mesmo!';
      } else if (lower.includes('pet') || lower.includes('cachorro')) {
        botReply = 'Aceitamos pets de pequeno porte no Chalé Família! Taxa única de R$ 80 por estada.';
      } else if (lower.includes('pix') || lower.includes('desconto')) {
        botReply = 'Reservando direto pelo PIX você economiza 10% de taxa da OTA! Chave PIX gerada com reconciliação automática.';
      }

      setChatLog((prev) => [...prev, { sender: 'zella', text: botReply, time: nowStr }]);
    }, 600);
  };

  return (
    <div className="w-full min-h-screen bg-[#0a0a0f] text-[#e4e1e9] font-sans flex flex-col pb-24 selection:bg-emerald-500/30">
      
      {/* ─────────────────────────────────────────────────────────────
          1. TOP APP BAR CYBER-LUXE (Mobile Header)
      ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/[0.08] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-mono font-bold text-xs shadow-[0_0_12px_rgba(16,185,129,0.2)]">
            Z
          </div>
          <div>
            <span className="font-mono text-xs font-bold tracking-tight text-emerald-400">
              [SEU ZÉLLA // POUSADA]
            </span>
            <div className="flex items-center gap-1 text-[9px] font-mono text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>TERMINAL ONLINE · {time || '12:00'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleAI}
            className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border transition-all flex items-center gap-1.5 ${
              aiActive
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                : 'bg-zinc-800/60 text-zinc-400 border-zinc-700'
            }`}
          >
            <Power className="w-3 h-3" />
            <span>{aiActive ? 'IA ON' : 'IA OFF'}</span>
          </button>
          <button
            onClick={() => toast.info('Notificações do Terminal Pousada')}
            className="w-8 h-8 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-300 hover:text-white transition-all active:scale-95"
          >
            <Bell className="w-4 h-4 text-emerald-400" />
          </button>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. CONTEÚDO DAS ABAS (Main Container)
      ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 px-4 pt-4 space-y-4">
        
        {/* ABA 1: VISÃO GERAL (Financeiro HUD + Terminal + Bento KPIs) */}
        {activeTab === 'visao_geral' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            
            {/* Terminal Header Spec Google Stitch */}
            <div className="space-y-1.5">
              <h1 className="font-mono text-lg font-extrabold text-emerald-400 tracking-tight flex items-center gap-2">
                <span>&gt; zella-pousada --terminal</span>
              </h1>
              <div className="inline-flex items-center gap-2 bg-white/[0.03] backdrop-blur-xl px-3 py-1.5 rounded-lg border border-white/[0.08]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]" />
                <span className="text-xs text-zinc-200 font-mono">Virtual Reception 24h (WhatsApp Autonomous)</span>
                <span className="bg-emerald-500 text-[#0a0a0f] text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded ml-1">
                  ACTIVE
                </span>
              </div>
            </div>

            {/* Quick Actions (1-Tap Touch Targets min-h-[44px]) */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => toast.success('Check-in rápido ativado')}
                className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center gap-2.5 min-h-[48px] active:scale-95 transition-all shadow-[0_0_15px_rgba(16,185,129,0.1)]"
              >
                <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="text-left">
                  <div className="font-bold">Check-in Rápido</div>
                  <div className="text-[9px] font-mono text-emerald-400/80">1-Tap WhatsApp</div>
                </div>
              </button>

              <button
                onClick={() => toast.info('Sincronização iCal disparada')}
                className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-zinc-200 font-bold text-xs flex items-center gap-2.5 min-h-[48px] active:scale-95 transition-all"
              >
                <RefreshCw className="w-4 h-4 text-cyan-400 shrink-0" />
                <div className="text-left">
                  <div className="font-bold">Sync OTAs</div>
                  <div className="text-[9px] font-mono text-zinc-400">Booking / iCal</div>
                </div>
              </button>
            </div>

            {/* Bento Grid KPIs (Google Stitch Design Specs) */}
            <div className="grid grid-cols-2 gap-3">
              {/* KPI 1 */}
              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-3.5 space-y-2 relative overflow-hidden group">
                <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-400">MRR Extrapolado</div>
                <div className="text-2xl font-mono font-extrabold text-white text-shadow-emerald">R$ 42.800</div>
                <div className="flex items-center text-[10px] text-emerald-400 font-medium gap-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>+12% vs mês anterior</span>
                </div>
              </div>

              {/* KPI 2 */}
              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-3.5 space-y-2 relative overflow-hidden group">
                <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-400">Economia PIX</div>
                <div className="text-2xl font-mono font-extrabold text-white">R$ 1.240</div>
                <div className="flex items-center text-[10px] text-emerald-400 font-medium gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>0% taxa OTA</span>
                </div>
              </div>

              {/* KPI 3 */}
              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-3.5 space-y-2 relative overflow-hidden group">
                <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-400">Conversão IA</div>
                <div className="text-2xl font-mono font-extrabold text-white">94.2%</div>
                <div className="flex items-center text-[10px] text-cyan-400 font-medium gap-1">
                  <Brain className="w-3 h-3" />
                  <span>Leads WhatsApp</span>
                </div>
              </div>

              {/* KPI 4 */}
              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-3.5 space-y-2 relative overflow-hidden group">
                <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-400">Ocupação Semanal</div>
                <div className="text-2xl font-mono font-extrabold text-white">88%</div>
                <div className="flex items-center text-[10px] text-amber-400 font-medium gap-1">
                  <BedDouble className="w-3 h-3" />
                  <span>Alta demanda</span>
                </div>
              </div>
            </div>

            {/* Lista de Pagamentos PIX Reconciliados */}
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-white font-mono">PIX RECONCILIADOS RECENTES</h3>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  AUTO-SYNC
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                {[
                  { name: 'Maria Silva', room: 'Suíte Master 101', val: 'R$ 850,00', status: 'Reconciliado 100%' },
                  { name: 'Carlos Andrade', room: 'Chalé Família 204', val: 'R$ 1.240,00', status: 'Reconciliado 100%' },
                  { name: 'Fernanda Lima', room: 'Suíte Luxo 103', val: 'R$ 620,00', status: 'Reconciliado 100%' },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div>
                      <div className="font-bold text-white">{item.name}</div>
                      <div className="text-[10px] text-zinc-400 font-mono">{item.room}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-emerald-400">{item.val}</div>
                      <span className="text-[9px] text-emerald-400/90 font-mono">{item.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </motion.div>
        )}

        {/* ABA 2: HÓSPEDES (Gestão de Hóspedes Mobile + Filtros + FAB + Guia) */}
        {activeTab === 'hospedes' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-sm font-extrabold text-white tracking-tight">
                <span className="text-emerald-400">&gt;</span> GESTÃO DE HÓSPEDES
              </h2>
              <span className="text-[10px] font-mono text-zinc-400 bg-white/[0.04] px-2.5 py-1 rounded-full border border-white/[0.08]">
                3 Ativos
              </span>
            </div>

            {/* Quick Filters Pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {(['todos', 'whatsapp', 'booking', 'airbnb'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setGuestFilter(filter)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-mono font-bold uppercase transition-all shrink-0 min-h-[38px] ${
                    guestFilter === filter
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                      : 'bg-white/[0.04] text-zinc-400 border border-white/[0.08] hover:text-white'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Lista Vertical de Cards de Hóspede (No Overflow Horizontal) */}
            <div className="space-y-3">
              {[
                { name: 'Maria Silva', status: 'Atendimento IA', room: 'Suíte Master 101', checkin: '12-15 NOV', val: 'R$ 850', ota: 'WhatsApp' },
                { name: 'Carlos Andrade', status: 'Pendente PIX', room: 'Chalé Família 204', checkin: '14-18 NOV', val: 'R$ 1.240', ota: 'Booking' },
                { name: 'Roberto Santos', status: 'Check-in Realizado', room: 'Suíte Luxo 102', checkin: '10-14 NOV', val: 'R$ 620', ota: 'Airbnb' },
              ]
                .filter((g) => guestFilter === 'todos' || g.ota.toLowerCase() === guestFilter)
                .map((guest, idx) => (
                  <article key={idx} className="p-4 rounded-xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
                    
                    <div className="flex items-start justify-between border-b border-white/[0.06] pb-2.5 pl-2">
                      <div>
                        <h4 className="text-xs font-bold text-white">{guest.name}</h4>
                        <p className="text-[10px] font-mono text-emerald-400">{guest.room}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {guest.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pl-2">
                      <div>
                        <span className="block text-[10px] text-zinc-500 font-mono">Período</span>
                        <span className="text-xs font-mono font-bold text-zinc-200">{guest.checkin}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-zinc-500 font-mono">Valor Total</span>
                        <span className="text-xs font-mono font-bold text-emerald-400">{guest.val}</span>
                      </div>
                    </div>

                    <div className="pt-2 pl-2 flex items-center justify-between border-t border-white/[0.04] min-h-[44px]">
                      <button
                        onClick={() => toast.success(`Guia Digital enviado para ${guest.name} via WhatsApp!`)}
                        className="px-3 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 min-h-[44px] active:scale-95 transition-all"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Enviar Guia WhatsApp</span>
                      </button>

                      <span className="text-[10px] font-mono text-zinc-500 uppercase">{guest.ota}</span>
                    </div>
                  </article>
                ))}
            </div>

            {/* FAB + (Floating Action Button) */}
            <button
              onClick={() => toast.info('Adicionar novo hóspede manualmente')}
              className="fixed bottom-20 right-5 w-12 h-12 rounded-full bg-emerald-500 text-[#0a0a0f] flex items-center justify-center font-bold shadow-[0_0_20px_rgba(16,185,129,0.5)] active:scale-90 transition-all z-30"
              title="Adicionar Hóspede"
            >
              <Plus className="w-6 h-6" />
            </button>

          </motion.div>
        )}

        {/* ABA 3: CENTRAL IA (Central do Estabelecimento + Acomodações + OTAs) */}
        {activeTab === 'central_ia' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-emerald-400 tracking-wider">
                [MODULE :: CORE_INTELLIGENCE]
              </span>
              <h2 className="text-sm font-bold text-white font-mono">Central do Estabelecimento</h2>
            </div>

            {/* Acomodações Cadastradas */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-zinc-300 font-mono">ACOMODAÇÕES & TARIFAS</h3>

              <div className="space-y-3">
                {/* Acomodação 1 */}
                <div className="p-4 rounded-xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] space-y-3">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                    <div>
                      <h4 className="text-xs font-bold text-white">Master Suite</h4>
                      <p className="text-[10px] text-zinc-400">Vista para o mar · Jacuzzi · Cama King</p>
                    </div>
                    <span className="text-xs font-mono font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                      R$ 850 / noite
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-[9px] font-mono text-zinc-300">
                    <span className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08]">WIFI 6</span>
                    <span className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08]">AC 18k BTU</span>
                    <span className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08]">SMART TV 65"</span>
                    <span className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08]">QTD: 2 UN</span>
                  </div>
                </div>

                {/* Acomodação 2 */}
                <div className="p-4 rounded-xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] space-y-3">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                    <div>
                      <h4 className="text-xs font-bold text-white">Chalé Família</h4>
                      <p className="text-[10px] text-zinc-400">Cozinha completa · Deck privativo · Pet friendly</p>
                    </div>
                    <span className="text-xs font-mono font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                      R$ 620 / noite
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-[9px] font-mono text-zinc-300">
                    <span className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08]">WIFI 6</span>
                    <span className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08]">COZINHA</span>
                    <span className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08]">CHURRASQUEIRA</span>
                    <span className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08]">QTD: 4 UN</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Integrações OTA */}
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-white font-mono flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                <span>INTEGRAÇÕES OTA & SYNCS</span>
              </h3>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                  <span>Booking.com</span>
                  <span className="text-[9px] font-mono text-emerald-400 font-bold">ONLINE</span>
                </div>
                <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                  <span>Airbnb</span>
                  <span className="text-[9px] font-mono text-emerald-400 font-bold">ONLINE</span>
                </div>
                <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                  <span>Decolar</span>
                  <span className="text-[9px] font-mono text-zinc-500 font-bold">PAUSADO</span>
                </div>
                <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                  <span>Trivago</span>
                  <span className="text-[9px] font-mono text-emerald-400 font-bold">ONLINE</span>
                </div>
              </div>
            </div>

          </motion.div>
        )}

        {/* ABA 4: GUIA & CONEXÃO (Digital Guest Guide + Pairing Node WhatsApp) */}
        {activeTab === 'guia_conexao' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-emerald-400 tracking-wider">[MODULE // GUEST_GUIDE]</span>
              <h2 className="text-sm font-bold text-white font-mono">Guia Digital do Hóspede & WhatsApp</h2>
            </div>

            {/* Guia Digital Wi-Fi & Locks */}
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-white font-mono flex items-center gap-2">
                <Wifi className="w-4 h-4 text-emerald-400" />
                <span>ACESSO & WI-FI DA POUSADA</span>
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-zinc-400 font-mono">Rede Wi-Fi (SSID):</span>
                  <span className="font-bold text-white font-mono">Zella_Guest_5G</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-zinc-400 font-mono">Senha do Wi-Fi:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-400 font-mono">
                      {showWifiPassword ? 'cyberpunk2077' : '••••••••••••'}
                    </span>
                    <button
                      onClick={() => setShowWifiPassword(!showWifiPassword)}
                      className="text-zinc-400 hover:text-white p-1"
                    >
                      {showWifiPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-zinc-400 font-mono">Smart Lock PIN Fallback:</span>
                  <span className="font-mono font-bold text-amber-400">{fallbackPin}</span>
                </div>
              </div>
            </div>

            {/* WhatsApp Pairing Node */}
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-4 space-y-3 text-center">
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-emerald-400 font-mono">
                <QrCode className="w-4 h-4" />
                <span>PAIRING_NODE :: WHATSAPP RECEPÇÃO</span>
              </div>

              <div className="w-44 h-44 mx-auto bg-white p-3 rounded-2xl flex items-center justify-center border-4 border-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.3)]">
                <QrCode className="w-full h-full text-black" />
              </div>

              <p className="text-[10px] font-mono text-zinc-400">
                Escaneie o QR Code no WhatsApp da Pousada para conectar a recepção 24h
              </p>

              <button
                onClick={() => toast.success('Novo QR Code de pareamento gerado!')}
                className="px-4 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold w-full min-h-[44px] active:scale-95 transition-all"
              >
                REGENERATE PAIRING QR
              </button>
            </div>

          </motion.div>
        )}

        {/* ABA 5: MAIS & SIMULADOR ZÉLLA 24H */}
        {activeTab === 'mais' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-cyan-400 tracking-wider">[MODULE // SIMULATOR_24H]</span>
              <h2 className="text-sm font-bold text-white font-mono">Simulador de Respostas Zélla 24h</h2>
            </div>

            {/* Chat Box Simulador */}
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-3.5 space-y-3 flex flex-col h-[380px]">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 text-[10px] font-mono text-zinc-400">
                <span className="text-emerald-400">LATENCY: 380ms</span>
                <span>CONFIDENCE: 98.4%</span>
              </div>

              {/* Chat Log Scroll */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 no-scrollbar text-xs">
                {chatLog.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col max-w-[85%] ${
                      msg.sender === 'guest' ? 'ml-auto items-end' : 'mr-auto items-start'
                    }`}
                  >
                    <div
                      className={`p-3 rounded-xl ${
                        msg.sender === 'guest'
                          ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 rounded-tr-none'
                          : 'bg-white/[0.05] text-zinc-200 border border-white/[0.08] rounded-tl-none'
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[9px] font-mono text-zinc-500 mt-1">{msg.time}</span>
                  </div>
                ))}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendSimulatedMsg} className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
                <input
                  type="text"
                  value={simulatedMsg}
                  onChange={(e) => setSimulatedMsg(e.target.value)}
                  placeholder="Simular mensagem do hóspede..."
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
                />
                <button
                  type="submit"
                  className="w-9 h-9 rounded-lg bg-emerald-500 text-[#0a0a0f] flex items-center justify-center font-bold active:scale-95 transition-all shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>

          </motion.div>
        )}

      </main>

      {/* ─────────────────────────────────────────────────────────────
          3. CYBER-LUXE BOTTOM NAVIGATION BAR (Fixed at bottom)
      ───────────────────────────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 w-full bg-[#0a0a0f]/95 backdrop-blur-2xl border-t border-white/[0.08] px-2 py-2.5 z-50 flex items-center justify-around">
        
        {/* Tab 1: Visão Geral */}
        <button
          onClick={() => setActiveTab('visao_geral')}
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${
            activeTab === 'visao_geral' ? 'text-emerald-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <LayoutGrid className="w-5 h-5" />
          <span className="text-[9px] font-mono">Visão Geral</span>
        </button>

        {/* Tab 2: Hóspedes */}
        <button
          onClick={() => setActiveTab('hospedes')}
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${
            activeTab === 'hospedes' ? 'text-emerald-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[9px] font-mono">Hóspedes</span>
        </button>

        {/* Tab 3: Central IA */}
        <button
          onClick={() => setActiveTab('central_ia')}
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${
            activeTab === 'central_ia' ? 'text-emerald-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Brain className="w-5 h-5" />
          <span className="text-[9px] font-mono">Central IA</span>
        </button>

        {/* Tab 4: Guia/WhatsApp */}
        <button
          onClick={() => setActiveTab('guia_conexao')}
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${
            activeTab === 'guia_conexao' ? 'text-emerald-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <QrCode className="w-5 h-5" />
          <span className="text-[9px] font-mono">Guia/Whats</span>
        </button>

        {/* Tab 5: Mais */}
        <button
          onClick={() => setActiveTab('mais')}
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${
            activeTab === 'mais' ? 'text-emerald-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-[9px] font-mono">Mais</span>
        </button>

      </nav>

    </div>
  );
}
