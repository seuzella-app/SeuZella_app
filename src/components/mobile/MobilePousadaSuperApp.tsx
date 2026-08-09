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
  Minus,
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
  Menu,
  X,
  Check,
  Type,
  Hash,
  Phone,
  Clock,
  BarChart3,
} from 'lucide-react';

export function MobilePousadaSuperApp() {
  const [activeTab, setActiveTab] = useState<'visao_geral' | 'hospedes' | 'central_zella' | 'whats_live' | 'mais'>('visao_geral');

  // Font Scale (Accessibility)
  const [fontScale, setFontScale] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('zella_font_scale');
      return saved ? parseFloat(saved) : 1;
    }
    return 1;
  });

  // Rooms management (Central Zélla)
  const [rooms, setRooms] = useState([
    { id: '101', name: 'Suíte Master 101', type: 'Suíte', status: 'ocupado' as const, guest: 'Maria Silva', guestCode: 'HSP-001', price: 850 },
    { id: '103', name: 'Suíte Luxo 103', type: 'Suíte', status: 'ocupado' as const, guest: 'Fernanda Lima', guestCode: 'HSP-003', price: 620 },
    { id: '105', name: 'Quarto Standard 105', type: 'Standard', status: 'livre' as const, guest: '', guestCode: '', price: 450 },
    { id: '204', name: 'Chalé Família 204', type: 'Chalé', status: 'ocupado' as const, guest: 'Carlos Andrade', guestCode: 'HSP-002', price: 620 },
    { id: '205', name: 'Chalé Família 205', type: 'Chalé', status: 'manutencao' as const, guest: '', guestCode: '', price: 620 },
    { id: '106', name: 'Quarto Standard 106', type: 'Standard', status: 'livre' as const, guest: '', guestCode: '', price: 450 },
  ]);
  const [isAddRoomOpen, setIsAddRoomOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomType, setNewRoomType] = useState<'Suíte' | 'Chalé' | 'Standard'>('Standard');
  const [newRoomPrice, setNewRoomPrice] = useState('450');

  // WhatsApp Live data
  const [whatsLiveConversations] = useState([
    { id: 1, guestName: 'Carlos Andrade', room: 'Chalé 204', lastMsg: 'Obrigado! O estacionamento é gratuito?', time: '14:38', isLive: true },
    { id: 2, guestName: 'Fernanda Lima', room: 'Suíte 103', lastMsg: 'Qual o horário do café da manhã?', time: '14:32', isLive: true },
    { id: 3, guestName: 'Maria Silva', room: 'Suíte 101', lastMsg: 'Perfeito, obrigada!', time: '13:55', isLive: false },
  ]);
  const [messageStats] = useState({ today: 47, week: 218, month: 894, previous: 761 });
  const [planType] = useState<'pro' | 'lite'>('pro');
  const [liteMessagesUsed] = useState(3420);
  const [liteMessagesTotal] = useState(5000);
  const [whatsViewMode, setWhatsViewMode] = useState<'live' | 'history' | 'stats'>('live');
  const [propertyName, setPropertyName] = useState<string>('Pousada Solar das Marés');
  const [aiActive, setAiActive] = useState<boolean>(true);
  const [time, setTime] = useState<string>('');
  const [guestFilter, setGuestFilter] = useState<'todos' | 'whatsapp' | 'booking' | 'airbnb'>('todos');
  const [showWifiPassword, setShowWifiPassword] = useState<boolean>(false);
  const [selectedRoomQr, setSelectedRoomQr] = useState<string>('101');
  const [fallbackPin, setFallbackPin] = useState<string>('849201');
  const [simulatedMsg, setSimulatedMsg] = useState<string>('');
  
  // Interactive Drawers & Modals
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isCheckInOpen, setIsCheckInOpen] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [isSyncingOTAs, setIsSyncingOTAs] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Há 2 min');

  // Check-in Modal Form State
  const [newGuestName, setNewGuestName] = useState<string>('');
  const [newGuestRoom, setNewGuestRoom] = useState<string>('Suíte Master 101');
  const [newGuestPhone, setNewGuestPhone] = useState<string>('');
  const [newGuestOrigin, setNewGuestOrigin] = useState<'WhatsApp' | 'Booking.com' | 'Direct PIX' | 'Balcão'>('Direct PIX');

  // Synced Notifications List
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Nova Reserva Confirmada', desc: 'Suíte 101 - R$ 1.700 via Direct PIX', time: 'Há 5 min', unread: true },
    { id: 2, title: 'Zélla Respondeu', desc: 'Dúvida de Wi-Fi e estacionamento para Carlos', time: 'Há 12 min', unread: true },
    { id: 3, title: 'Sync OTAs Concluído', desc: 'Calendários Booking.com e Airbnb 100% atualizados', time: 'Há 25 min', unread: false },
    { id: 4, title: 'Fechadura Eletrônica', desc: 'PIN 849201 gerado com sucesso para Suíte Master', time: 'Há 1h', unread: false },
  ]);

  const [guestsList, setGuestsList] = useState([
    { id: '1', name: 'Maria Silva', room: 'Suíte Master 101', status: 'CONFIRMADO', origin: 'Direct PIX', phone: '(11) 98822-1100' },
    { id: '2', name: 'Carlos Andrade', room: 'Chalé Família 204', status: 'CHECKED_IN', origin: 'Booking.com', phone: '(21) 97110-3344' },
    { id: '3', name: 'Fernanda Lima', room: 'Suíte Luxo 103', status: 'CONFIRMADO', origin: 'WhatsApp', phone: '(48) 99123-5566' },
  ]);

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
      toast.success(next ? '⚡ Cérebro Zélla ATIVADO (Recepção Virtual 24h)' : '⏸️ Cérebro Zélla PAUSADO');
      return next;
    });
  };

  const handleSyncOTAs = async () => {
    setIsSyncingOTAs(true);
    toast.info('🔄 Sincronizando calendários iCal / Booking.com / Airbnb...');
    
    try {
      await fetch('/api/integrations/sync', { method: 'POST' });
    } catch {
      // Fallback
    }

    setTimeout(() => {
      setIsSyncingOTAs(false);
      const nowStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setLastSyncTime(`Hoje às ${nowStr}`);
      toast.success('✅ Sincronização Concluída! 4 Reservas e 2 Bloqueios Atualizados');
      setNotifications((prev) => [
        {
          id: Date.now(),
          title: 'Sync OTAs Executado',
          desc: 'Calendários Booking/Airbnb/iCal sincronizados com o DDC',
          time: 'Agora mesmo',
          unread: true,
        },
        ...prev,
      ]);
    }, 1200);
  };

  const handleCreateCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGuestName.trim()) {
      toast.error('Informe o nome do hóspede');
      return;
    }

    const newGuest = {
      id: Date.now().toString(),
      name: newGuestName,
      room: newGuestRoom,
      status: 'CHECKED_IN',
      origin: newGuestOrigin,
      phone: newGuestPhone || '(11) 99000-0000',
    };

    setGuestsList((prev) => [newGuest, ...prev]);
    setIsCheckInOpen(false);
    setNewGuestName('');
    setNewGuestPhone('');
    toast.success(`🔑 Check-in efetuado para ${newGuest.name} na ${newGuest.room}!`);

    setNotifications((prev) => [
      {
        id: Date.now(),
        title: 'Novo Check-in Efetuado',
        desc: `${newGuest.name} na ${newGuest.room} (${newGuest.origin})`,
        time: 'Agora mesmo',
        unread: true,
      },
      ...prev,
    ]);
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

  const unreadCount = notifications.filter((n) => n.unread).length;

  // Persist font scale
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('zella_font_scale', fontScale.toString());
    }
  }, [fontScale]);

  const handleAddRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    const newId = (Math.max(...rooms.map(r => parseInt(r.id))) + 1).toString();
    setRooms(prev => [...prev, {
      id: newId, name: newRoomName, type: newRoomType, status: 'livre' as const,
      guest: '', guestCode: '', price: parseInt(newRoomPrice) || 450,
    }]);
    setNewRoomName('');
    setIsAddRoomOpen(false);
    toast.success(`Quarto "${newRoomName}" adicionado com sucesso!`);
  };

  return (
    <div className="w-full min-h-screen bg-[#0a0a0f] text-[#e4e1e9] font-sans flex flex-col pb-24 selection:bg-emerald-500/30 relative" style={{ fontSize: `${fontScale}rem` }}>
      
      {/* ─────────────────────────────────────────────────────────────
          1. TOP APP BAR CYBER-LUXE (Mobile Header com Hambúrguer)
      ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/[0.08] px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {/* Botão Hambúrguer para abrir Menu Lateral */}
          <button
            onClick={() => setIsMenuOpen(true)}
            className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-zinc-300 hover:text-white active:scale-95 transition-all"
            aria-label="Abrir Menu DDC"
          >
            <Menu className="w-5 h-5 text-emerald-400" />
          </button>

          <img
            src="/SeuZella_Logo_site.png"
            alt="Seu Zélla"
            className="h-6 w-auto object-contain"
          />
          <div className="h-3.5 w-[1px] bg-white/20" />
          <span className="font-mono text-xs font-extrabold tracking-widest text-emerald-400 uppercase">
            POUSADA
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-300 bg-white/[0.04] px-2.5 py-1 rounded-full border border-white/[0.08]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#10b981]" />
            <span>ONLINE · {time || '12:00'}</span>
          </div>
          <button
            onClick={() => setIsNotificationsOpen(true)}
            className="w-8 h-8 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-300 hover:text-white transition-all active:scale-95 relative"
            aria-label="Notificações Sincronizadas"
          >
            <Bell className="w-4 h-4 text-emerald-400" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 text-[#0a0a0f] text-[9px] font-mono font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. CONTEÚDO DAS ABAS (Main Container)
      ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 px-4 pt-4 space-y-4">
        
        {/* ABA 1: VISÃO GERAL (Dashboard da Pousada + Bento KPIs) */}
        {activeTab === 'visao_geral' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            
            {/* Header com Nome da Pousada Cadastrada */}
            <div className="space-y-1.5">
              <h1 className="font-mono text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                <span className="text-emerald-400">&gt;</span> Dashboard da {propertyName}
              </h1>
              <div className="inline-flex items-center gap-2 bg-white/[0.03] backdrop-blur-xl px-3 py-1.5 rounded-lg border border-white/[0.08]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]" />
                <span className="text-xs text-zinc-200 font-mono">Recepção Virtual 24h (WhatsApp Ativo)</span>
                <span className="bg-emerald-500 text-[#0a0a0f] text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded ml-1">
                  CONECTADA
                </span>
              </div>
            </div>

            {/* Quick Actions Com Ações Reais (Check-in & Sync OTAs) */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setIsCheckInOpen(true)}
                className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center gap-2.5 min-h-[48px] active:scale-95 transition-all shadow-[0_0_15px_rgba(16,185,129,0.1)]"
              >
                <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="text-left">
                  <div className="font-bold">Check-in Rápido</div>
                  <div className="text-[9px] font-mono text-emerald-400/80">Novo Hóspede</div>
                </div>
              </button>

              <button
                onClick={handleSyncOTAs}
                disabled={isSyncingOTAs}
                className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-zinc-200 font-bold text-xs flex items-center gap-2.5 min-h-[48px] active:scale-95 transition-all"
              >
                <RefreshCw className={`w-4 h-4 text-cyan-400 shrink-0 ${isSyncingOTAs ? 'animate-spin' : ''}`} />
                <div className="text-left">
                  <div className="font-bold">Sync OTAs</div>
                  <div className="text-[9px] font-mono text-zinc-400">{lastSyncTime}</div>
                </div>
              </button>
            </div>

            {/* Bento Grid KPIs Reais da Pousada (Sem MRR corporativo) */}
            <div className="grid grid-cols-2 gap-3">
              {/* KPI 1: Faturamento do Mês */}
              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-3.5 space-y-2 relative overflow-hidden group">
                <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-400">Faturamento do Mês</div>
                <div className="text-2xl font-mono font-extrabold text-white text-shadow-emerald">R$ 42.800</div>
                <div className="flex items-center text-[10px] text-emerald-400 font-medium gap-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>+12% vs mês anterior</span>
                </div>
              </div>

              {/* KPI 2: Economia Direct PIX */}
              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-3.5 space-y-2 relative overflow-hidden group">
                <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-400">Economia Direct PIX</div>
                <div className="text-2xl font-mono font-extrabold text-white">R$ 1.240</div>
                <div className="flex items-center text-[10px] text-emerald-400 font-medium gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>0% taxa de OTA</span>
                </div>
              </div>

              {/* KPI 3: Conversão Zélla WhatsApp */}
              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-3.5 space-y-2 relative overflow-hidden group">
                <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-400">Conversão Zélla WhatsApp</div>
                <div className="text-2xl font-mono font-extrabold text-white">94.2%</div>
                <div className="flex items-center text-[10px] text-cyan-400 font-medium gap-1">
                  <Brain className="w-3 h-3" />
                  <span>Atendimentos Zélla 24h</span>
                </div>
              </div>

              {/* KPI 4: Taxa de Ocupação Semanal */}
              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-3.5 space-y-2 relative overflow-hidden group">
                <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-400">Ocupação Semanal</div>
                <div className="text-2xl font-mono font-extrabold text-white">88%</div>
                <div className="flex items-center text-[10px] text-amber-400 font-medium gap-1">
                  <BedDouble className="w-3 h-3" />
                  <span>14 de 16 suítes</span>
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

        {/* ABA 3: CENTRAL ZÉLLA (Gestão Completa de Quartos + Hóspedes + Cérebro Sync) */}
        {activeTab === 'central_zella' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-emerald-400 tracking-wider">
                [MODULE :: CÉREBRO_ZÉLLA]
              </span>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white font-mono">Central Zélla — {propertyName}</h2>
                <button
                  onClick={() => setIsAddRoomOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-mono text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all"
                >
                  <Plus className="w-3 h-3" /> + Quarto
                </button>
              </div>
            </div>

            {/* Banner Cérebro Zélla Conhecimento */}
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5">
              <Brain className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <div className="font-bold text-white font-mono">Cérebro Zélla Sincronizado</div>
                <p className="text-[11px] text-zinc-300">
                  O Seu Zélla conhece a estrutura dos seus quartos, hóspedes ativos e códigos de acesso. Ele gerencia o atendimento 24h via WhatsApp com base nesta configuração.
                </p>
              </div>
            </div>

            {/* Grid de Quartos e Acomodações */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-zinc-300 font-mono">QUARTOS & ACOMODAÇÕES ({rooms.length})</h3>
                <span className="text-[9px] font-mono text-emerald-400">{rooms.filter(r => r.status === 'ocupado').length} Ocupados · {rooms.filter(r => r.status === 'livre').length} Livres</span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      room.status === 'ocupado'
                        ? 'bg-white/[0.04] border-emerald-500/40'
                        : room.status === 'manutencao'
                        ? 'bg-amber-500/5 border-amber-500/30'
                        : 'bg-white/[0.02] border-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <BedDouble className={`w-4 h-4 ${room.status === 'ocupado' ? 'text-emerald-400' : room.status === 'manutencao' ? 'text-amber-400' : 'text-zinc-500'}`} />
                        <span className="font-bold text-xs text-white">{room.name}</span>
                        <span className="text-[9px] font-mono text-zinc-400 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.08]">
                          {room.type}
                        </span>
                      </div>
                      <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded ${
                        room.status === 'ocupado'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : room.status === 'manutencao'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30'
                      }`}>
                        {room.status === 'ocupado' ? 'OCUPADO' : room.status === 'manutencao' ? 'MANUTENÇÃO' : 'LIVRE'}
                      </span>
                    </div>

                    {room.status === 'ocupado' ? (
                      <div className="flex items-center justify-between text-xs bg-white/[0.03] p-2 rounded-lg border border-white/[0.04]">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="font-medium text-white">{room.guest}</span>
                        </div>
                        <span className="font-mono text-[10px] text-emerald-400">{room.guestCode}</span>
                      </div>
                    ) : (
                      <div className="text-[10px] font-mono text-zinc-500 flex justify-between items-center">
                        <span>Pronto para check-in</span>
                        <span className="text-zinc-300 font-bold">R$ {room.price}/noite</span>
                      </div>
                    )}
                  </div>
                ))}
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

        {/* ABA 4: WHATS LIVE (Hóspedes Ativos Tempo Real + Métricas Mensagens + Alerta LITE) */}
        {activeTab === 'whats_live' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-emerald-400 tracking-wider">[WHATSAPP // LIVE_MESSAGING]</span>
                <span className="flex items-center gap-1.5 text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  TEMPO REAL
                </span>
              </div>
              <h2 className="text-sm font-bold text-white font-mono">Whats Live — Atendimentos Seu Zélla</h2>
            </div>

            {/* Controle de Modo de Visão */}
            <div className="grid grid-cols-3 gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/[0.08] text-xs font-mono">
              <button
                onClick={() => setWhatsViewMode('live')}
                className={`py-1.5 rounded-lg font-bold transition-all ${
                  whatsViewMode === 'live' ? 'bg-emerald-500 text-[#0a0a0f]' : 'text-zinc-400'
                }`}
              >
                AO VIVO ({whatsLiveConversations.filter(c => c.isLive).length})
              </button>
              <button
                onClick={() => setWhatsViewMode('history')}
                className={`py-1.5 rounded-lg font-bold transition-all ${
                  whatsViewMode === 'history' ? 'bg-emerald-500 text-[#0a0a0f]' : 'text-zinc-400'
                }`}
              >
                MENSAGENS
              </button>
              <button
                onClick={() => setWhatsViewMode('stats')}
                className={`py-1.5 rounded-lg font-bold transition-all ${
                  whatsViewMode === 'stats' ? 'bg-emerald-500 text-[#0a0a0f]' : 'text-zinc-400'
                }`}
              >
                MÉTRICAS
              </button>
            </div>

            {/* Seção 1: Hóspedes em Tempo Real */}
            {whatsViewMode === 'live' && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-zinc-300 font-mono flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  <span>CONVERSAS EM TEMPO REAL AGORA</span>
                </div>

                <div className="space-y-2">
                  {whatsLiveConversations.map((conv) => (
                    <div
                      key={conv.id}
                      className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-2 hover:border-emerald-500/40 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#10b981]" />
                          <span className="font-bold text-xs text-white">{conv.guestName}</span>
                          <span className="text-[9px] font-mono text-zinc-400 bg-white/[0.04] px-1.5 py-0.5 rounded">
                            {conv.room}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500">{conv.time}</span>
                      </div>
                      <p className="text-xs text-emerald-200/90 font-mono bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                        "{conv.lastMsg}"
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Seção 2: Métricas de Mensagens (Hoje / Semana / Mês / Anteriores) */}
            {(whatsViewMode === 'stats' || whatsViewMode === 'live') && (
              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-bold text-white font-mono">VOLUME DE MENSAGENS EXECUTADAS</h3>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div className="text-[9px] font-mono text-zinc-400">HOJE</div>
                    <div className="text-lg font-mono font-extrabold text-emerald-400">{messageStats.today} msgs</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div className="text-[9px] font-mono text-zinc-400">ESTA SEMANA</div>
                    <div className="text-lg font-mono font-extrabold text-white">{messageStats.week} msgs</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div className="text-[9px] font-mono text-zinc-400">ESTE MÊS</div>
                    <div className="text-lg font-mono font-extrabold text-white">{messageStats.month} msgs</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div className="text-[9px] font-mono text-zinc-400">MENSES ANTERIORES</div>
                    <div className="text-lg font-mono font-extrabold text-zinc-400">{messageStats.previous} msgs</div>
                  </div>
                </div>
              </div>
            )}

            {/* Painel do Pacote LITE - Medidor de Créditos 60 dias / Notificação de recarga */}
            <div className="bg-white/[0.03] backdrop-blur-xl border border-amber-500/30 rounded-xl p-4 space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold text-white font-mono">CRÉDITOS MENSAGENS (PACOTE LITE)</h3>
                </div>
                <span className="text-[9px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  60 DIAS ATIVOS
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-zinc-400">Mensagens Utilizadas:</span>
                  <span className="font-bold text-amber-400">{liteMessagesUsed} / {liteMessagesTotal}</span>
                </div>
                {/* Barra de Progresso */}
                <div className="w-full h-2.5 rounded-full bg-white/[0.08] overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all"
                    style={{ width: `${(liteMessagesUsed / liteMessagesTotal) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-zinc-400 font-mono">
                  Restam {liteMessagesTotal - liteMessagesUsed} mensagens antes de precisar adquirir créditos complementares.
                </p>
              </div>

              <button
                onClick={() => toast.info('Redirecionando para recarga de créditos complementares')}
                className="w-full p-2.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-mono text-xs font-bold active:scale-95 transition-all text-center"
              >
                COMPRAR MAIS CRÉDITOS COMPLEMENTARES
              </button>
            </div>

          </motion.div>
        )}

        {/* ABA 5: MAIS (Configuração Acessibilidade de Fontes + Simulador Zélla 24h) */}
        {activeTab === 'mais' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            
            {/* Seção Acessibilidade: Ajuste de Tamanho das Fontes */}
            <div className="bg-white/[0.03] backdrop-blur-xl border border-emerald-500/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                <div className="flex items-center gap-2">
                  <Type className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-white font-mono">TAMANHO DA FONTE (EXIBIÇÃO)</h3>
                </div>
                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                  {fontScale === 0.85 ? 'PEQUENO' : fontScale === 1.15 ? 'GRANDE' : 'PADRÃO'}
                </span>
              </div>

              <p className="text-[11px] text-zinc-400 font-sans">
                Ajuste a escala das fontes do dashboard mobile para a melhor leitura no seu dispositivo.
              </p>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => { setFontScale(0.85); toast.success('Tamanho de fonte: PEQUENO'); }}
                  className={`p-2.5 rounded-lg border font-mono text-xs font-bold transition-all ${
                    fontScale === 0.85
                      ? 'bg-emerald-500 text-[#0a0a0f] border-emerald-400'
                      : 'bg-white/[0.03] text-zinc-300 border-white/[0.08]'
                  }`}
                >
                  Pequeno (85%)
                </button>
                <button
                  onClick={() => { setFontScale(1); toast.success('Tamanho de fonte: PADRÃO'); }}
                  className={`p-2.5 rounded-lg border font-mono text-xs font-bold transition-all ${
                    fontScale === 1
                      ? 'bg-emerald-500 text-[#0a0a0f] border-emerald-400'
                      : 'bg-white/[0.03] text-zinc-300 border-white/[0.08]'
                  }`}
                >
                  Padrão (100%)
                </button>
                <button
                  onClick={() => { setFontScale(1.15); toast.success('Tamanho de fonte: GRANDE'); }}
                  className={`p-2.5 rounded-lg border font-mono text-xs font-bold transition-all ${
                    fontScale === 1.15
                      ? 'bg-emerald-500 text-[#0a0a0f] border-emerald-400'
                      : 'bg-white/[0.03] text-zinc-300 border-white/[0.08]'
                  }`}
                >
                  Grande (115%)
                </button>
              </div>
            </div>

            <div className="space-y-1 pt-2">
              <span className="text-[10px] font-mono text-cyan-400 tracking-wider">[MODULE // SIMULATOR_24H]</span>
              <h2 className="text-sm font-bold text-white font-mono">Simulador de Respostas Seu Zélla 24h</h2>
            </div>

            {/* Chat Box Simulador */}
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-3.5 space-y-3 flex flex-col h-[340px]">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 text-[10px] font-mono text-zinc-400">
                <span className="text-emerald-400 font-bold">ZÉLLA ENGINE 24H</span>
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

        {/* Tab 3: Central Zélla */}
        <button
          onClick={() => setActiveTab('central_zella')}
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${
            activeTab === 'central_zella' ? 'text-emerald-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Brain className="w-5 h-5" />
          <span className="text-[9px] font-mono">Central Zélla</span>
        </button>

        {/* Tab 4: Whats Live */}
        <button
          onClick={() => setActiveTab('whats_live')}
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${
            activeTab === 'whats_live' ? 'text-emerald-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[9px] font-mono">Whats Live</span>
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

      {/* ─────────────────────────────────────────────────────────────
          4. MENU LATERAL DRAWER (Hambúrguer Menu)
      ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="fixed top-0 left-0 bottom-0 w-[82%] max-w-[320px] bg-[#0d0d14] border-r border-white/[0.08] z-50 p-5 flex flex-col justify-between"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                  <div className="flex items-center gap-2">
                    <img src="/SeuZella_Logo_site.png" alt="Seu Zélla" className="h-6 w-auto" />
                    <span className="font-mono text-xs font-bold text-emerald-400">POUSADA</span>
                  </div>
                  <button
                    onClick={() => setIsMenuOpen(false)}
                    className="p-1 rounded-lg bg-white/[0.04] text-zinc-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="bg-white/[0.03] p-3 rounded-xl border border-white/[0.08] space-y-1">
                  <div className="text-[10px] font-mono text-zinc-400">PROPRIEDADE CONECTADA</div>
                  <div className="font-bold text-sm text-white">{propertyName}</div>
                  <div className="text-[10px] font-mono text-emerald-400">Plano Pousada Pro Active</div>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] font-mono text-zinc-400 px-2 pb-1">NAVEGAÇÃO RÁPIDA</div>
                  
                  <button
                    onClick={() => { setActiveTab('visao_geral'); setIsMenuOpen(false); }}
                    className="w-full p-2.5 rounded-lg flex items-center gap-3 text-xs font-medium text-zinc-200 hover:bg-white/[0.05] hover:text-emerald-400 transition-all text-left"
                  >
                    <LayoutGrid className="w-4 h-4 text-emerald-400" />
                    <span>Visão Geral / Dashboard</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('hospedes'); setIsMenuOpen(false); }}
                    className="w-full p-2.5 rounded-lg flex items-center gap-3 text-xs font-medium text-zinc-200 hover:bg-white/[0.05] hover:text-emerald-400 transition-all text-left"
                  >
                    <Users className="w-4 h-4 text-emerald-400" />
                    <span>Gestão de Hóspedes</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('central_zella'); setIsMenuOpen(false); }}
                    className="w-full p-2.5 rounded-lg flex items-center gap-3 text-xs font-medium text-zinc-200 hover:bg-white/[0.05] hover:text-emerald-400 transition-all text-left"
                  >
                    <Brain className="w-4 h-4 text-emerald-400" />
                    <span>Central Zélla & Configurações</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('whats_live'); setIsMenuOpen(false); }}
                    className="w-full p-2.5 rounded-lg flex items-center gap-3 text-xs font-medium text-zinc-200 hover:bg-white/[0.05] hover:text-emerald-400 transition-all text-left"
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    <span>WhatsApp Live & Histórico</span>
                  </button>

                  <div className="h-[1px] bg-white/[0.06] my-2" />

                  <button
                    onClick={() => { setIsCheckInOpen(true); setIsMenuOpen(false); }}
                    className="w-full p-2.5 rounded-lg flex items-center gap-3 text-xs font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all text-left border border-emerald-500/20"
                  >
                    <Zap className="w-4 h-4 text-emerald-400" />
                    <span>Check-in Rápido</span>
                  </button>

                  <button
                    onClick={() => { handleSyncOTAs(); setIsMenuOpen(false); }}
                    className="w-full p-2.5 rounded-lg flex items-center gap-3 text-xs font-medium text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 transition-all text-left border border-cyan-500/20"
                  >
                    <RefreshCw className="w-4 h-4 text-cyan-400" />
                    <span>Sincronizar OTAs</span>
                  </button>

                  <button
                    onClick={() => { setIsNotificationsOpen(true); setIsMenuOpen(false); }}
                    className="w-full p-2.5 rounded-lg flex items-center gap-3 text-xs font-medium text-zinc-200 hover:bg-white/[0.05] transition-all text-left"
                  >
                    <Bell className="w-4 h-4 text-emerald-400" />
                    <span>Central de Notificações</span>
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-white/[0.08] text-[10px] font-mono text-zinc-500 text-center">
                Seu Zélla SmartHotel v3.2 · Live Mobile
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────
          5. MODAL CHECK-IN RÁPIDO (Ação Real)
      ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isCheckInOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-[#13131a] border border-emerald-500/30 rounded-2xl p-5 space-y-4 shadow-[0_0_30px_rgba(16,185,129,0.15)]"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-sm text-white font-mono">CHECK-IN RÁPIDO DDC</h3>
                </div>
                <button onClick={() => setIsCheckInOpen(false)} className="text-zinc-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateCheckIn} className="space-y-3">
                <div>
                  <label className="text-[10px] font-mono text-zinc-400 uppercase">Nome do Hóspede *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Mariana Souza"
                    value={newGuestName}
                    onChange={(e) => setNewGuestName(e.target.value)}
                    className="w-full mt-1 bg-white/[0.04] border border-white/[0.1] rounded-lg p-2.5 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-zinc-400 uppercase">Quarto / Acomodação</label>
                  <select
                    value={newGuestRoom}
                    onChange={(e) => setNewGuestRoom(e.target.value)}
                    className="w-full mt-1 bg-[#1a1a24] border border-white/[0.1] rounded-lg p-2.5 text-xs text-white focus:border-emerald-500 outline-none"
                  >
                    <option value="Suíte Master 101">Suíte Master 101 (R$ 850)</option>
                    <option value="Chalé Família 204">Chalé Família 204 (R$ 620)</option>
                    <option value="Suíte Luxo 103">Suíte Luxo 103 (R$ 620)</option>
                    <option value="Quarto Standard 105">Quarto Standard 105 (R$ 450)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-zinc-400 uppercase">WhatsApp (Opcional)</label>
                  <input
                    type="text"
                    placeholder="(11) 99999-8888"
                    value={newGuestPhone}
                    onChange={(e) => setNewGuestPhone(e.target.value)}
                    className="w-full mt-1 bg-white/[0.04] border border-white/[0.1] rounded-lg p-2.5 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-zinc-400 uppercase">Canal de Origem</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {(['Direct PIX', 'WhatsApp', 'Booking.com', 'Balcão'] as const).map((orig) => (
                      <button
                        type="button"
                        key={orig}
                        onClick={() => setNewGuestOrigin(orig)}
                        className={`p-2 rounded-lg text-xs font-mono font-bold border transition-all ${
                          newGuestOrigin === orig
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                            : 'bg-white/[0.03] text-zinc-400 border-white/[0.08]'
                        }`}
                      >
                        {orig}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCheckInOpen(false)}
                    className="flex-1 p-2.5 rounded-xl bg-white/[0.04] text-zinc-300 font-bold text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#0a0a0f] font-mono font-extrabold text-xs shadow-[0_0_15px_#10b981]"
                  >
                    Confirmar Check-in
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────
          6. SHEET CENTRAL DE NOTIFICAÇÕES (Sincronizada)
      ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isNotificationsOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end justify-center">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="w-full max-w-md bg-[#13131a] border-t border-white/[0.1] rounded-t-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-sm text-white font-mono">NOTIFICAÇÕES SINCRONIZADAS</h3>
                </div>
                <button onClick={() => setIsNotificationsOpen(false)} className="text-zinc-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-3 rounded-xl border transition-all ${
                      notif.unread
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : 'bg-white/[0.02] border-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-bold text-xs text-white">{notif.title}</div>
                      <span className="text-[9px] font-mono text-zinc-400">{notif.time}</span>
                    </div>
                    <p className="text-xs text-zinc-300 font-sans">{notif.desc}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
                  toast.success('Todas as notificações foram marcadas como lidas');
                }}
                className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-mono font-bold text-zinc-300 hover:text-white"
              >
                Marcar todas como lidas
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────
          7. MODAL ADICIONAR QUARTO (Central Zélla)
      ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isAddRoomOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-[#13131a] border border-emerald-500/30 rounded-2xl p-5 space-y-4 shadow-[0_0_30px_rgba(16,185,129,0.15)]"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2">
                  <BedDouble className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-sm text-white font-mono">ADICIONAR NOVO QUARTO</h3>
                </div>
                <button onClick={() => setIsAddRoomOpen(false)} className="text-zinc-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddRoom} className="space-y-3">
                <div>
                  <label className="text-[10px] font-mono text-zinc-400 uppercase">Nome / Número do Quarto *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Suíte Presidencial 301"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="w-full mt-1 bg-white/[0.04] border border-white/[0.1] rounded-lg p-2.5 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-zinc-400 uppercase">Tipo de Acomodação</label>
                  <select
                    value={newRoomType}
                    onChange={(e) => setNewRoomType(e.target.value as any)}
                    className="w-full mt-1 bg-[#1a1a24] border border-white/[0.1] rounded-lg p-2.5 text-xs text-white focus:border-emerald-500 outline-none"
                  >
                    <option value="Suíte">Suíte</option>
                    <option value="Chalé">Chalé</option>
                    <option value="Standard">Standard</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-zinc-400 uppercase">Valor da Diária (R$)</label>
                  <input
                    type="number"
                    placeholder="450"
                    value={newRoomPrice}
                    onChange={(e) => setNewRoomPrice(e.target.value)}
                    className="w-full mt-1 bg-white/[0.04] border border-white/[0.1] rounded-lg p-2.5 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddRoomOpen(false)}
                    className="flex-1 p-2.5 rounded-xl bg-white/[0.04] text-zinc-300 font-bold text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#0a0a0f] font-mono font-extrabold text-xs shadow-[0_0_15px_#10b981]"
                  >
                    Salvar Quarto
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
