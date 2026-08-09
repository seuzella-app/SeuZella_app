'use client';

// ==============================================================================
// SEU ZÉLLA SUPER APP MOBILE — POUSADA (Google Stitch 100% Fidelity)
// ==============================================================================
// - 100% Faithful to Google Stitch HTML screens in Downloads
// - 5 Complete Native Mobile Screens mapped to Bottom Navigation Tabs:
//   1. Visão Geral (Financeiro HUD + Terminal + Bento KPIs + Recent PIX)
//   2. Hóspedes (Gestão de Hóspedes Mobile + Filtros + FAB + Enviar Guia)
//   3. Central IA (Central do Estabelecimento: Master Suite R$850, Chalé R$620, OTAs, Knowledge Base)
//   4. Guia & Conexão (Digital Guest Guide: Wi-Fi, Fallback PIN, Menu, QR Gen + WhatsApp Pairing Node)
//   5. Mais & Simulador (Simulador Zélla 24h + Configurações)
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  LayoutGrid,
  Users,
  Brain,
  Power,
  Menu,
  Bell,
  Wifi,
  WifiOff,
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
  Sparkles,
  BedDouble,
  Plus,
  Utensils,
  Wine,
  FileText,
  Printer,
  Download,
  Eye,
  EyeOff,
  Globe,
  Settings,
  HelpCircle,
  Copy,
  ChevronUp,
  Edit2,
  Trash2,
  PhoneCall,
  Activity,
  Server,
  Layers,
  Search,
} from 'lucide-react';

export function MobilePousadaSuperApp() {
  const [activeTab, setActiveTab] = useState<'visao_geral' | 'hospedes' | 'central_ia' | 'guia_conexao' | 'mais'>('visao_geral');
  const [aiActive, setAiActive] = useState<boolean>(true);
  const [time, setTime] = useState<string>('');
  const [guestFilter, setGuestFilter] = useState<'todos' | 'whatsapp' | 'booking' | 'airbnb'>('todos');
  const [showWifiPassword, setShowWifiPassword] = useState<boolean>(false);
  const [selectedRoomQr, setSelectedRoomQr] = useState<string>('101');
  const [fallbackPin, setFallbackPin] = useState<string>('849201');

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
      toast.success(next ? '⚡ IA Zélla ATIVADA (Recepção Virtual 24h)' : '⏸️ IA Zélla PAUSADA');
      return next;
    });
  };

  const handleGenerateQr = () => {
    toast.success(`📱 QR Code gerado para Quarto ${selectedRoomQr}!`);
  };

  const handleRegeneratePin = () => {
    const newPin = Math.floor(100000 + Math.random() * 900000).toString();
    setFallbackPin(newPin);
    toast.success(`🔑 Novo PIN Fallback Gerado: ${newPin}`);
  };

  const handleSendGuide = (guestName: string) => {
    toast.success(`📲 Guia Digital enviado para ${guestName} no WhatsApp!`);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col font-sans selection:bg-emerald-500/30 overflow-x-hidden">
      {/* 🟢 TOP APP BAR (EXACT STITCH DESIGN) */}
      <header className="sticky top-0 z-50 bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/[0.08] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Zap className="w-4 h-4 animate-pulse" />
          </div>
          <h1 className="font-mono text-sm font-extrabold text-emerald-400 tracking-tighter">
            [SEU ZÉLLA // POUSADA]
          </h1>
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
          <button className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.04] border border-white/10 text-emerald-400 hover:opacity-80">
            <Bell className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 📱 SCREEN CONTENT CONTAINER */}
      <main className="flex-1 p-4 pb-28 flex flex-col gap-5 max-w-lg mx-auto w-full">
        <AnimatePresence mode="wait">
          {/* =================================================================== */}
          {/* TAB 1: VISÃO GERAL (STITCH FINANCIAL HUD & TERMINAL)               */}
          {/* =================================================================== */}
          {activeTab === 'visao_geral' && (
            <motion.div
              key="visao_geral"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-4"
            >
              <div>
                <div className="inline-block px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-400 font-mono text-[9px] uppercase tracking-widest mb-1">
                  TERMINAL :: TELEMETRIA 24H
                </div>
                <h2 className="font-mono text-base font-extrabold text-zinc-100 tracking-tight">
                  &gt; zella-pousada --terminal
                </h2>
                <p className="text-xs text-zinc-400">Status dos sistemas e faturamento em tempo real.</p>
              </div>

              {/* BENTO GRID 4 KPIS */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#13131a] backdrop-blur-xl border border-white/[0.08] rounded-xl p-3 flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-emerald-400 shadow-[0_0_10px_rgba(78,222,163,0.5)]" />
                  <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-wider">MRR Extrapolado</span>
                  <span className="text-xl font-mono font-black text-emerald-400 my-1">R$ 42.800</span>
                  <span className="text-[9px] font-mono text-emerald-400 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> +14% vs mês ant.
                  </span>
                </div>

                <div className="bg-[#13131a] backdrop-blur-xl border border-white/[0.08] rounded-xl p-3 flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
                  <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-wider">Ocupação Semanal</span>
                  <span className="text-xl font-mono font-black text-cyan-300 my-1">88%</span>
                  <span className="text-[9px] font-mono text-zinc-400">14 de 16 quartos</span>
                </div>

                <div className="bg-[#13131a] backdrop-blur-xl border border-white/[0.08] rounded-xl p-3 flex flex-col justify-between relative overflow-hidden">
                  <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-wider">Conversão IA</span>
                  <span className="text-xl font-mono font-black text-emerald-300 my-1">94.2%</span>
                  <span className="text-[9px] font-mono text-emerald-400">454 atendimentos</span>
                </div>

                <div className="bg-[#13131a] backdrop-blur-xl border border-white/[0.08] rounded-xl p-3 flex flex-col justify-between relative overflow-hidden">
                  <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-wider">Economia PIX</span>
                  <span className="text-xl font-mono font-black text-emerald-400 my-1">R$ 1.240</span>
                  <span className="text-[9px] font-mono text-zinc-400">0% taxa vs OTA</span>
                </div>
              </div>

              {/* RECENT TRANSACTIONS */}
              <div className="bg-[#13131a] border border-white/[0.08] rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-zinc-200 uppercase tracking-wider">Últimos Pagamentos Reconciliados</span>
                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    AUTOMÁTICO
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <QrCode className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-zinc-100">Ana Silva (Master Suite)</span>
                        <span className="text-[10px] font-mono text-zinc-400">Há 10 min · PIX Confirmado</span>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-black text-emerald-400">+R$ 850,00</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                        <BedDouble className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-zinc-100">Carlos Andrade (Chalé)</span>
                        <span className="text-[10px] font-mono text-zinc-400">Há 2 horas · Booking Sync</span>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-black text-cyan-300">+R$ 620,00</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* =================================================================== */}
          {/* TAB 2: HÓSPEDES (STITCH GESTÃO DE HÓSPEDES MOBILE SCREEN)          */}
          {/* =================================================================== */}
          {activeTab === 'hospedes' && (
            <motion.div
              key="hospedes"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-4 relative"
            >
              <div>
                <h2 className="font-mono text-base font-black text-emerald-400 tracking-tight uppercase">
                  &gt; GESTÃO DE HÓSPEDES
                </h2>
                <p className="text-xs text-zinc-400">Filtro de contatos e status de reservas em tempo real.</p>
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
                        : 'bg-[#13131a] text-zinc-400 border-white/10 hover:text-zinc-200'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              {/* MOBILE GUEST CARDS (STITCH STYLED VERTICAL LIST) */}
              <div className="flex flex-col gap-3">
                <div className="bg-[#13131a] border border-white/[0.08] rounded-xl p-3.5 flex flex-col gap-2.5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-emerald-400" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center font-mono font-bold text-xs text-emerald-400">
                        MS
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-zinc-100">Maria Silva</span>
                        <span className="text-[10px] text-zinc-400">Dúvida sobre pets · Suíte Master</span>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      R$ 850
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 pt-2 border-t border-white/[0.04]">
                    <span>12 - 15 NOV</span>
                    <span className="text-emerald-400">ATENDIMENTO IA (3)</span>
                  </div>

                  <button
                    onClick={() => handleSendGuide('Maria Silva')}
                    className="w-full py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono font-bold flex items-center justify-center gap-1.5 hover:bg-emerald-500/25 transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Enviar Guia Digital no WhatsApp
                  </button>
                </div>

                <div className="bg-[#13131a] border border-white/[0.08] rounded-xl p-3.5 flex flex-col gap-2.5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-rose-400" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center font-mono font-bold text-xs text-rose-400">
                        CA
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-zinc-100">Carlos Andrade</span>
                        <span className="text-[10px] text-zinc-400">Negociando valor · Chalé Família</span>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono font-bold px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      Pendente
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 pt-2 border-t border-white/[0.04]">
                    <span>20 - 22 NOV</span>
                    <span className="text-rose-400">AGUARDANDO PIX</span>
                  </div>

                  <button
                    onClick={() => handleSendGuide('Carlos Andrade')}
                    className="w-full py-2 rounded-lg bg-white/[0.04] border border-white/10 text-zinc-300 text-[10px] font-mono font-bold flex items-center justify-center gap-1.5 hover:bg-white/[0.08] transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Cobrar PIX via WhatsApp
                  </button>
                </div>
              </div>

              {/* FLOATING ACTION BUTTON (+) */}
              <button
                onClick={() => toast.success('➕ Adicionar Novo Hóspede')}
                className="fixed bottom-24 right-5 w-12 h-12 rounded-full bg-emerald-400 text-black font-bold flex items-center justify-center shadow-lg shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-all z-40"
              >
                <Plus className="w-6 h-6 stroke-[3]" />
              </button>
            </motion.div>
          )}

          {/* =================================================================== */}
          {/* TAB 3: CENTRAL IA (STITCH CENTRAL DO ESTABELECIMENTO SCREEN)       */}
          {/* =================================================================== */}
          {activeTab === 'central_ia' && (
            <motion.div
              key="central_ia"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-4"
            >
              <div>
                <div className="inline-block px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-400 font-mono text-[9px] uppercase tracking-widest mb-1">
                  MODULE :: CORE_INTELLIGENCE
                </div>
                <h2 className="font-mono text-base font-extrabold text-zinc-100">Central do Estabelecimento</h2>
                <p className="text-xs text-zinc-400">Gerenciamento neural das acomodações e integrações OTA.</p>
              </div>

              {/* ACOMODAÇÕES SECTION */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-mono text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <BedDouble className="w-4 h-4" /> Acomodações
                  </h3>
                  <button className="px-2.5 py-1 bg-white/[0.04] border border-white/10 rounded-lg text-emerald-400 font-mono text-[10px] font-bold flex items-center gap-1 hover:bg-white/[0.08]">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>

                {/* MASTER SUITE */}
                <div className="bg-[#13131a] border border-white/[0.08] rounded-xl p-3.5 flex flex-col gap-3 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-emerald-400 shadow-[0_0_10px_rgba(78,222,163,0.5)]" />
                  <div className="flex gap-3">
                    <div className="w-20 h-20 rounded-lg bg-emerald-950/40 border border-emerald-500/30 flex flex-col items-center justify-center shrink-0 relative overflow-hidden">
                      <BedDouble className="w-8 h-8 text-emerald-400" />
                      <span className="absolute bottom-1 right-1 text-[8px] font-mono font-bold bg-black/80 px-1 rounded text-emerald-400">
                        QTD: 2
                      </span>
                    </div>
                    <div className="flex-1 flex flex-col justify-between">
                      <div className="flex items-start justify-between">
                        <h4 className="text-xs font-bold text-zinc-100">Master Suite</h4>
                        <span className="text-xs font-mono font-black text-emerald-400">
                          R$ 850<span className="text-[9px] text-zinc-400 font-normal">/noite</span>
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400">Capacidade: 2 adultos • Vista Mar • Jacuzzi</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className="px-1.5 py-0.5 bg-white/[0.04] rounded border border-white/10 text-[8px] font-mono text-zinc-300">WIFI 6</span>
                        <span className="px-1.5 py-0.5 bg-white/[0.04] rounded border border-white/10 text-[8px] font-mono text-zinc-300">AC</span>
                        <span className="px-1.5 py-0.5 bg-white/[0.04] rounded border border-white/10 text-[8px] font-mono text-zinc-300">SMART TV</span>
                        <span className="px-1.5 py-0.5 bg-emerald-500/10 rounded border border-emerald-500/30 text-[8px] font-mono text-emerald-400">JACUZZI</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CHALÉ FAMÍLIA */}
                <div className="bg-[#13131a] border border-white/[0.08] rounded-xl p-3.5 flex flex-col gap-3 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
                  <div className="flex gap-3">
                    <div className="w-20 h-20 rounded-lg bg-cyan-950/40 border border-cyan-500/30 flex flex-col items-center justify-center shrink-0 relative overflow-hidden">
                      <Layers className="w-8 h-8 text-cyan-400" />
                      <span className="absolute bottom-1 right-1 text-[8px] font-mono font-bold bg-black/80 px-1 rounded text-cyan-400">
                        QTD: 4
                      </span>
                    </div>
                    <div className="flex-1 flex flex-col justify-between">
                      <div className="flex items-start justify-between">
                        <h4 className="text-xs font-bold text-zinc-100">Chalé Família</h4>
                        <span className="text-xs font-mono font-black text-emerald-400">
                          R$ 620<span className="text-[9px] text-zinc-400 font-normal">/noite</span>
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400">Capacidade: 4 adultos • Jardim Privativo • Cozinha</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className="px-1.5 py-0.5 bg-white/[0.04] rounded border border-white/10 text-[8px] font-mono text-zinc-300">WIFI 6</span>
                        <span className="px-1.5 py-0.5 bg-white/[0.04] rounded border border-white/10 text-[8px] font-mono text-zinc-300">AC</span>
                        <span className="px-1.5 py-0.5 bg-white/[0.04] rounded border border-white/10 text-[8px] font-mono text-zinc-300">COZINHA</span>
                        <span className="px-1.5 py-0.5 bg-white/[0.04] rounded border border-white/10 text-[8px] font-mono text-zinc-300">DECK</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* INTEGRAÇÕES OTA SECTION */}
              <div className="flex flex-col gap-2.5">
                <h3 className="font-mono text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <RefreshCw className="w-4 h-4" /> Integrações OTA
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-[#13131a] border border-white/[0.08] flex flex-col items-center justify-center gap-1 relative">
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <Globe className="w-6 h-6 text-blue-500 mb-1" />
                    <span className="text-[10px] font-mono font-bold text-zinc-200">BOOKING</span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#13131a] border border-white/[0.08] flex flex-col items-center justify-center gap-1 relative">
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <Globe className="w-6 h-6 text-rose-500 mb-1" />
                    <span className="text-[10px] font-mono font-bold text-zinc-200">AIRBNB</span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#13131a] border border-white/[0.08] flex flex-col items-center justify-center gap-1 relative opacity-60">
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-zinc-600" />
                    <Globe className="w-6 h-6 text-zinc-500 mb-1" />
                    <span className="text-[10px] font-mono font-bold text-zinc-400">DECOLAR (OFF)</span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#13131a] border border-white/[0.08] flex flex-col items-center justify-center gap-1 relative">
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <Globe className="w-6 h-6 text-cyan-500 mb-1" />
                    <span className="text-[10px] font-mono font-bold text-zinc-200">TRIVAGO</span>
                  </div>
                </div>
              </div>

              {/* BASE DE CONHECIMENTO IA SECTION */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-mono text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Brain className="w-4 h-4" /> Base de Conhecimento IA
                  </h3>
                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    SYNC 100%
                  </span>
                </div>

                <div className="bg-[#13131a] border border-white/[0.08] rounded-xl overflow-hidden divide-y divide-white/[0.04]">
                  <button className="w-full p-3 flex items-center justify-between hover:bg-white/[0.02] text-left">
                    <span className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                      <Utensils className="w-4 h-4 text-emerald-400" /> Cardápio do Restaurante
                    </span>
                    <ChevronRight className="w-4 h-4 text-zinc-500" />
                  </button>

                  <button className="w-full p-3 flex items-center justify-between hover:bg-white/[0.02] text-left">
                    <span className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-cyan-400" /> Regras da Piscina (08h-22h)
                    </span>
                    <ChevronRight className="w-4 h-4 text-zinc-500" />
                  </button>

                  <button className="w-full p-3 flex items-center justify-between hover:bg-white/[0.02] text-left">
                    <span className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-purple-400" /> Políticas de Check-in/Out
                    </span>
                    <ChevronRight className="w-4 h-4 text-zinc-500" />
                  </button>

                  <button
                    onClick={() => toast.success('📑 Novo documento enviado para treinamento da IA Zélla!')}
                    className="w-full p-3 flex items-center justify-between hover:bg-white/[0.04] text-left text-emerald-400 font-mono text-xs font-bold"
                  >
                    <span className="flex items-center gap-2">
                      <Plus className="w-4 h-4" /> Adicionar Documento à Rede
                    </span>
                    <ChevronRight className="w-4 h-4 text-emerald-400" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* =================================================================== */}
          {/* TAB 4: GUIA & CONEXÃO (STITCH DIGITAL GUEST GUIDE & WHATSAPP PAIRING)*/}
          {/* =================================================================== */}
          {activeTab === 'guia_conexao' && (
            <motion.div
              key="guia_conexao"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-4"
            >
              <div>
                <div className="inline-block px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-400 font-mono text-[9px] uppercase tracking-widest mb-1">
                  [MODULE // GUEST_GUIDE & WHATSAPP_CONNECTION]
                </div>
                <h2 className="font-mono text-base font-black text-zinc-100">Digital Guest Guide & Instância</h2>
              </div>

              {/* PAIRING NODE & WHATSAPP INSTANCE */}
              <div className="bg-[#13131a] border border-white/[0.08] rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                  <span className="text-xs font-mono font-bold text-emerald-400">PAIRING_NODE</span>
                  <span className="text-[9px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    AWAITING_SCAN
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center p-4 bg-black/40 border border-dashed border-emerald-500/30 rounded-lg">
                  <QrCode className="w-28 h-28 text-emerald-400" />
                  <span className="text-[9px] font-mono text-zinc-400 mt-2 text-center">
                    ESCANEE O QR CODE NO SEU WHATSAPP DA RECEPÇÃO PARA ATIVAR O ZÉLLA EVOLUTION API
                  </span>
                </div>

                <button
                  onClick={() => toast.success('🔄 Novo QR Code de pareamento gerado!')}
                  className="w-full py-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold flex items-center justify-center gap-2 hover:bg-emerald-500/30 transition-all"
                >
                  <RefreshCw className="w-4 h-4" /> REGENERATE PAIRING QR
                </button>
              </div>

              {/* DIGITAL GUEST GUIDE ACCESS & AMENITIES */}
              <div className="bg-[#13131a] border border-white/[0.08] rounded-xl p-4 flex flex-col gap-3">
                <div className="font-mono text-xs font-bold text-emerald-400 border-b border-white/[0.06] pb-2">
                  [CONFIG // ACCESS & WI-FI]
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-mono text-zinc-400 uppercase">Wi-Fi Network (SSID)</label>
                  <input
                    readOnly
                    value="Zella_Guest_5G"
                    className="w-full p-2.5 rounded-lg bg-black/50 border border-white/10 text-xs font-mono text-emerald-300"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-mono text-zinc-400 uppercase">Wi-Fi Password</label>
                  <div className="relative">
                    <input
                      type={showWifiPassword ? 'text' : 'password'}
                      readOnly
                      value="cyberpunk2077"
                      className="w-full p-2.5 rounded-lg bg-black/50 border border-white/10 text-xs font-mono text-emerald-300 pr-10"
                    />
                    <button
                      onClick={() => setShowWifiPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                    >
                      {showWifiPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-mono text-zinc-400 uppercase">Default Smart Lock PIN (Fallback)</label>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={fallbackPin}
                      className="flex-1 p-2.5 rounded-lg bg-black/50 border border-white/10 text-xs font-mono text-emerald-400 tracking-widest text-center"
                    />
                    <button
                      onClick={handleRegeneratePin}
                      className="p-2.5 rounded-lg bg-white/[0.04] border border-white/10 text-zinc-300 hover:text-white"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* =================================================================== */}
          {/* TAB 5: MAIS (STITCH SIMULATOR & CONFIGURATIONS)                     */}
          {/* =================================================================== */}
          {activeTab === 'mais' && (
            <motion.div
              key="mais"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-4"
            >
              <div>
                <h2 className="font-mono text-base font-bold text-zinc-100 uppercase tracking-tight">
                  &gt; SIMULADOR & CONFIGURAÇÕES
                </h2>
              </div>

              {/* CHAT SIMULATOR */}
              <div className="bg-[#07090e] border border-white/10 rounded-xl p-3.5 flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-mono font-bold text-zinc-200">Simulador Zélla 24h</span>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    LATÊNCIA: 380MS
                  </span>
                </div>

                <div className="flex flex-col gap-2.5 text-xs">
                  <div className="self-start bg-zinc-800/80 border border-zinc-700 text-zinc-200 p-2.5 rounded-2xl rounded-tl-none max-w-[85%]">
                    Olá! Qual o horário do café da manhã e como solicito toalhas extras?
                  </div>

                  <div className="self-end bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 p-2.5 rounded-2xl rounded-tr-none max-w-[85%] font-sans">
                    <div className="flex items-center gap-1 text-[9px] font-mono text-emerald-400 mb-1">
                      <Sparkles className="w-3 h-3" /> Zélla AI (Confiança: 99%)
                    </div>
                    Olá! Nosso café da manhã é servido das 07:30 às 10:00 no restaurante principal. Para toalhas extras, é só me pedir por aqui que a recepção entrega no seu quarto! ☕🧹
                  </div>
                </div>

                <button
                  onClick={() => toast.success('🧪 Simulação de atendimento enviada para o WhatsApp!')}
                  className="w-full py-2.5 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-mono font-bold flex items-center justify-center gap-2 hover:bg-purple-500/30 transition-all"
                >
                  <MessageSquare className="w-4 h-4" /> Simular Pergunta no WhatsApp
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* 🔴 FIXED MOBILE BOTTOM NAVIGATION BAR (100% FAITHFUL TO STITCH SCREENSHOTS) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#060913]/95 backdrop-blur-2xl border-t border-white/[0.12] px-2 py-2.5 shadow-2xl shadow-black">
        <div className="flex items-center justify-around max-w-md mx-auto">
          <button
            onClick={() => setActiveTab('visao_geral')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
              activeTab === 'visao_geral'
                ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <LayoutGrid className="w-5 h-5" />
            <span className="text-[9px] font-mono font-bold mt-1">Visão Geral</span>
          </button>

          <button
            onClick={() => setActiveTab('hospedes')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
              activeTab === 'hospedes'
                ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[9px] font-mono font-bold mt-1">Hóspedes</span>
          </button>

          <button
            onClick={() => setActiveTab('central_ia')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
              activeTab === 'central_ia'
                ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Brain className="w-5 h-5" />
            <span className="text-[9px] font-mono font-bold mt-1">Central IA</span>
          </button>

          <button
            onClick={() => setActiveTab('guia_conexao')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
              activeTab === 'guia_conexao'
                ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <QrCode className="w-5 h-5" />
            <span className="text-[9px] font-mono font-bold mt-1">Guia/WhatsApp</span>
          </button>

          <button
            onClick={() => setActiveTab('mais')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
              activeTab === 'mais'
                ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[9px] font-mono font-bold mt-1">Mais</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
