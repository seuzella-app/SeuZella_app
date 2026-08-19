'use client';

// ==============================================================================
// SEU ZÉLLA SUPER APP MOBILE — POUSADA (Native Mobile App Experience)
// ==============================================================================
// - Design System: Cyber-Luxe Glassmorphism (#0a0a0f + Emerald #10b981)
// - Native Mobile App UX: Touch Targets min-h 48px, Floating HUD, Haptics & Gestures
// - Módulos Nativos: Visão Geral, Hóspedes, UPSELL Feriados (7%), Fechaduras & Governança, Whats Live, Mais
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useMobileDevicePing } from './useMobileDevicePing';
import { MobileYieldProfitWidget } from './MobileYieldProfitWidget';
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
  Unlock,
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
  Battery,
  BatteryWarning,
  Flame,
  DollarSign,
  KeyRound,
  CheckCheck,
  Brush,
  Sliders,
  CalendarCheck,
} from 'lucide-react';

export function MobilePousadaSuperApp() {
  const [activeTab, setActiveTab] = useState<'visao_geral' | 'hospedes' | 'upsell' | 'fechaduras' | 'central_zella' | 'whats_live' | 'mais'>('visao_geral');

  // ZCC Analytics — registra pings de uso Mobile (compara com Desktop)
  useMobileDevicePing({
    niche: 'pousada',
    route: '/mobile/pousada',
    tenantId: typeof window !== 'undefined' ? (window as any).__ZELLA_TENANT_ID ?? 'demo-pousada' : 'demo-pousada',
    tenantName: typeof window !== 'undefined' ? (window as any).__ZELLA_TENANT_NAME : undefined,
    tabName: activeTab,
  });

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
    { id: '101', name: 'Suíte Master 101', type: 'Suíte', status: 'ocupado' as const, guest: 'Maria Silva', guestCode: 'HSP-001', price: 850, lockBattery: 92, pin: '849201', lockModel: 'Intelbras IFR 7000' },
    { id: '103', name: 'Suíte Luxo 103', type: 'Suíte', status: 'ocupado' as const, guest: 'Fernanda Lima', guestCode: 'HSP-003', price: 620, lockBattery: 19, pin: '391044', lockModel: 'Tuya Smart G2' },
    { id: '105', name: 'Quarto Standard 105', type: 'Standard', status: 'livre' as const, guest: '', guestCode: '', price: 450, lockBattery: 85, pin: '772190', lockModel: 'TTLock Gateway BLE' },
    { id: '204', name: 'Chalé Família 204', type: 'Chalé', status: 'ocupado' as const, guest: 'Carlos Andrade', guestCode: 'HSP-002', price: 620, lockBattery: 74, pin: '510933', lockModel: 'Yale Assure 2' },
    { id: '205', name: 'Chalé Família 205', type: 'Chalé', status: 'manutencao' as const, guest: '', guestCode: '', price: 620, lockBattery: 88, pin: '640192', lockModel: 'Intelbras IFR 7000' },
    { id: '106', name: 'Quarto Standard 106', type: 'Standard', status: 'livre' as const, guest: '', guestCode: '', price: 450, lockBattery: 95, pin: '190344', lockModel: 'Tuya Smart G2' },
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
  const [unlockingRoomId, setUnlockingRoomId] = useState<string | null>(null);

  // Check-in Modal Form State
  const [newGuestName, setNewGuestName] = useState<string>('');
  const [newGuestRoom, setNewGuestRoom] = useState<string>('Suíte Master 101');
  const [newGuestPhone, setNewGuestPhone] = useState<string>('');
  const [newGuestOrigin, setNewGuestOrigin] = useState<'WhatsApp' | 'Booking.com' | 'Direct PIX' | 'Balcão'>('Direct PIX');

  // UPSELL State (Feriados Prolongados & Alta Demanda)
  const [selectedHoliday, setSelectedHoliday] = useState<'Reveillon' | 'Carnaval' | 'FeriasJan' | 'Setembro7' | 'Outubro12' | 'Novembro15'>('Reveillon');
  const [dailyIncrease, setDailyIncrease] = useState<number>(200);
  const [upsellActive, setUpsellActive] = useState<boolean>(true);

  const holidaysConfig = {
    Reveillon: { name: 'Réveillon 2026/2027', dates: '29 DEZ - 02 JAN', nights: 4, demand: 'Altíssima (98%)' },
    Carnaval: { name: 'Carnaval 2027', dates: '12 FEV - 16 FEV', nights: 4, demand: 'Altíssima (95%)' },
    FeriasJan: { name: 'Férias de Janeiro', dates: '05 JAN - 25 JAN', nights: 7, demand: 'Alta (89%)' },
    Setembro7: { name: '7 de Setembro (Independência)', dates: '05 SET - 08 SET', nights: 3, demand: 'Média/Alta (82%)' },
    Outubro12: { name: '12 de Outubro (N. Sra. Aparecida)', dates: '10 OUT - 13 OUT', nights: 3, demand: 'Alta (86%)' },
    Novembro15: { name: '15 de Novembro (República)', dates: '13 NOV - 16 NOV', nights: 3, demand: 'Alta (91%)' },
  };

  // Synced Notifications List
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Nova Reserva Confirmada', desc: 'Suíte 101 - R$ 1.700 via Direct PIX (0% comissão)', time: 'Há 5 min', unread: true },
    { id: 2, title: 'Cérebro Zélla Respondeu', desc: 'Dúvida de Wi-Fi e estacionamento para Carlos', time: 'Há 12 min', unread: true },
    { id: 3, title: 'Aumento UPSELL Ativo', desc: 'Feriado Réveillon: +R$ 200/diária aplicado em 6 quartos', time: 'Há 20 min', unread: true },
    { id: 4, title: 'Sync OTAs Concluído', desc: 'Calendários Booking.com e Airbnb 100% atualizados', time: 'Há 25 min', unread: false },
    { id: 5, title: 'Alerta de Bateria Fechadura', desc: 'Suíte Luxo 103 com 19% de bateria (trocar pilhas)', time: 'Há 1h', unread: false },
  ]);

  const [guestsList, setGuestsList] = useState([
    { id: '1', name: 'Maria Silva', room: 'Suíte Master 101', status: 'CONFIRMADO', origin: 'Direct PIX', phone: '(11) 98822-1100' },
    { id: '2', name: 'Carlos Andrade', room: 'Chalé Família 204', status: 'CHECKED_IN', origin: 'Booking.com', phone: '(21) 97110-3344' },
    { id: '3', name: 'Fernanda Lima', room: 'Suíte Luxo 103', status: 'CONFIRMADO', origin: 'WhatsApp', phone: '(48) 99123-5566' },
  ]);

  const [chatLog, setChatLog] = useState<Array<{ sender: 'guest' | 'zella'; text: string; time: string }>>([
    { sender: 'guest', text: 'Olá! Qual o horário de check-in e a senha do Wi-Fi?', time: '14:32' },
    { sender: 'zella', text: 'Olá! Nosso check-in é a partir das 14h. O Wi-Fi é "Zella_Guest_5G" e a senha é "marés_vip2026". Precisa de ajuda com o estacionamento?', time: '14:32' },
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
      toast.success(next ? '⚡ Cérebro Zélla ATIVADO (Recepção Virtual 24h)' : '⏸ Cérebro Zélla PAUSADO');
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

  const handleRemoteUnlock = (roomId: string, roomName: string) => {
    setUnlockingRoomId(roomId);
    toast.info(`🔑 Enviando sinal BLE/Gateway para ${roomName}...`);
    setTimeout(() => {
      setUnlockingRoomId(null);
      toast.success(`🔓 ${roomName} DESTRANCADA COM SUCESSO! Acesso liberado.`);
    }, 1200);
  };

  const handleGenerateNewPin = (roomId: string, roomName: string) => {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    const newPin = (arr[0] % 1000000).toString().padStart(6, '0');
    setRooms((prev) => prev.map((r) => r.id === roomId ? { ...r, pin: newPin } : r));
    toast.success(`🔑 Novo PIN Gerado para ${roomName}: ${newPin}`);
  };

  const handleMarkClean = (roomId: string, roomName: string) => {
    setRooms((prev) => prev.map((r) => r.id === roomId ? { ...r, status: 'livre' } : r));
    toast.success(`🧹 ${roomName} MARCADO COMO LIMPO! Pronto para próximo check-in.`);
  };

  const handleApplyUpsell = () => {
    toast.success(`⚡ UPSELL ATIVADO! +R$ ${dailyIncrease}/diária aplicado para ${holidaysConfig[selectedHoliday].name}`);
  };

  const handleCreateCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGuestName.trim()) return;

    const newGuest = {
      id: Date.now().toString(),
      name: newGuestName,
      room: newGuestRoom,
      status: 'CONFIRMADO',
      origin: newGuestOrigin,
      phone: newGuestPhone || '(11) 99999-0000',
    };

    setGuestsList([newGuest, ...guestsList]);
    setRooms(rooms.map((r) => (r.name === newGuestRoom ? { ...r, status: 'ocupado', guest: newGuestName } : r)));
    
    setNotifications((prev) => [
      {
        id: Date.now(),
        title: 'Check-in Manual Registrado',
        desc: `${newGuestName} em ${newGuestRoom} via ${newGuestOrigin}`,
        time: 'Agora mesmo',
        unread: true,
      },
      ...prev,
    ]);

    setNewGuestName('');
    setNewGuestPhone('');
    setIsCheckInOpen(false);
    toast.success(`🎉 Check-in de ${newGuest.name} realizado com sucesso!`);
  };

  const handleAddRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    const newRoom = {
      id: (rooms.length + 101).toString(),
      name: newRoomName,
      type: newRoomType,
      status: 'livre' as const,
      guest: '',
      guestCode: '',
      price: parseFloat(newRoomPrice) || 450,
      lockBattery: 100,
      pin: '123456',
      lockModel: 'Intelbras IFR 7000',
    };

    setRooms([...rooms, newRoom]);
    setNewRoomName('');
    setNewRoomPrice('450');
    setIsAddRoomOpen(false);
    toast.success(`✅ Quarto ${newRoom.name} adicionado com sucesso!`);
  };

  const handleSendSimulatedMsg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simulatedMsg.trim()) return;

    const userText = simulatedMsg;
    setSimulatedMsg('');

    setChatLog((prev) => [...prev, { sender: 'guest', text: userText, time: time || '14:40' }]);

    setTimeout(() => {
      let botResponse = 'Perfeito! Sou a assistente inteligente do Seu Zélla. Como posso ajudar com sua reserva na pousada?';
      const lower = userText.toLowerCase();

      if (lower.includes('wi-fi') || lower.includes('wifi') || lower.includes('senha')) {
        botResponse = 'Nossa rede Wi-Fi é "Zella_Guest_5G" e a senha de acesso é "marés_vip2026". O sinal pega em todas as suítes e área da piscina!';
      } else if (lower.includes('café') || lower.includes('cafe') || lower.includes('almoço')) {
        botResponse = 'Nosso café da manhã colonial é servido diariamente das 07:30 às 10:30 no salão principal com vista para o mar! ☕🥐';
      } else if (lower.includes('checkin') || lower.includes('check-in') || lower.includes('horario')) {
        botResponse = 'O horário de check-in é a partir das 14h e checkout até às 12h. Se precisar de Early Check-in ou Late Checkout, me avise!';
      } else if (lower.includes('chave') || lower.includes('porta') || lower.includes('senha')) {
        botResponse = 'Sua fechadura é 100% eletrônica! A senha temporária da sua suíte foi enviada no seu WhatsApp.';
      }

      setChatLog((prev) => [...prev, { sender: 'zella', text: botResponse, time: time || '14:40' }]);
    }, 800);
  };

  const unreadCount = notifications.filter((n) => n.unread).length;

  // UPSELL Math calculation
  const totalOccupiedRooms = rooms.filter((r) => r.status === 'ocupado').length || 4;
  const currentHolidayConfig = holidaysConfig[selectedHoliday];
  const upsellExcedentTotal = rooms.length * currentHolidayConfig.nights * dailyIncrease;
  const pousadaUpsellProfit = upsellExcedentTotal * 0.93;
  const zellaUpsellFee = upsellExcedentTotal * 0.07;

  return (
    <div
      className="w-full min-h-screen bg-[#0a0a0f] text-[#e4e1e9] font-sans flex flex-col pb-28 selection:bg-emerald-500/30 relative overflow-x-hidden"
      style={{ fontSize: `${fontScale * 14}px` }}
    >
      {/* ──
          1. TOP APP BAR CYBER-LUXE POUSADA (Mobile Header)
      ── */}
      <header className="sticky top-0 z-40 bg-[#0a0a0f]/95 backdrop-blur-2xl border-b border-white/[0.08] px-3.5 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMenuOpen(true)}
            className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-zinc-300 hover:text-white active:scale-95 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Abrir Menu"
          >
            <Menu className="w-5 h-5 text-emerald-400" />
          </button>

          <div className="flex items-center gap-2">
            <img
              src="/SeuZella_Logo_site.png"
              alt="Seu Zélla"
              className="h-6 w-auto object-contain"
            />
            <div className="h-3.5 w-[1px] bg-white/20" />
            <span className="font-mono text-[11px] font-extrabold tracking-widest text-emerald-400 uppercase">
              POUSADA
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Botão de Toggle do Cérebro IA */}
          <button
            onClick={handleToggleAI}
            className={`px-2.5 py-1 rounded-full border text-[10px] font-mono font-bold flex items-center gap-1.5 transition-all min-h-[36px] active:scale-95 ${
              aiActive
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${aiActive ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
            <span>{aiActive ? 'IA 24H' : 'PAUSADA'}</span>
          </button>

          {/* Notificações Bell */}
          <button
            onClick={() => setIsNotificationsOpen(true)}
            className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-300 hover:text-white transition-all active:scale-95 relative"
            aria-label="Notificações"
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

      {/* ──
          2. QUICK ACTIONS CHIP BAR (Horizontal Native Carousel)
      ── */}
      <div className="px-3.5 pt-3 pb-1 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('upsell')}
          className="shrink-0 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold font-mono flex items-center gap-1.5 active:scale-95 transition-all shadow-[0_0_12px_rgba(245,158,11,0.15)]"
        >
          <Flame className="w-3.5 h-3.5 text-amber-400" />
          <span>⚡ UPSELL Feriado (+R$ {dailyIncrease})</span>
        </button>

        <button
          onClick={() => setActiveTab('fechaduras')}
          className="shrink-0 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold font-mono flex items-center gap-1.5 active:scale-95 transition-all"
        >
          <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
          <span>🔑 Fechaduras & Bateria</span>
        </button>

        <button
          onClick={() => { setIsCheckInOpen(true); }}
          className="shrink-0 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.1] text-zinc-200 text-xs font-bold font-mono flex items-center gap-1.5 active:scale-95 transition-all"
        >
          <Zap className="w-3.5 h-3.5 text-cyan-400" />
          <span>+ Check-in Rápido</span>
        </button>

        <button
          onClick={handleSyncOTAs}
          className="shrink-0 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.1] text-zinc-200 text-xs font-bold font-mono flex items-center gap-1.5 active:scale-95 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isSyncingOTAs ? 'animate-spin' : ''}`} />
          <span>Sync OTAs</span>
        </button>
      </div>

      {/* ──
          3. CONTEÚDO DAS ABAS (Main Container)
      ── */}
      <main className="flex-1 px-3.5 pt-3 space-y-4">
        
        {/* ABA 1: VISÃO GERAL */}
        {activeTab === 'visao_geral' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            
            {/* Yield Booster (Lucro Extra IA) */}
            <MobileYieldProfitWidget niche="pousada" />

            {/* Header Pousada Title */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <h1 className="font-mono text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                  <span className="text-emerald-400">&gt;</span> {propertyName}
                </h1>
                <span className="text-[10px] font-mono text-zinc-400 bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.08]">
                  {rooms.length} Quartos
                </span>
              </div>
              <p className="text-xs text-zinc-400">Painel de Ocupação, Fechaduras e UPSELL</p>
            </div>

            {/* Bento Grid KPIs Pousada */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-3.5 space-y-1.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Taxa Ocupação</div>
                <div className="text-2xl font-mono font-extrabold text-white">
                  {Math.round((totalOccupiedRooms / rooms.length) * 100)}%
                </div>
                <div className="flex items-center text-[10px] text-emerald-400 font-medium gap-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>{totalOccupiedRooms} de {rooms.length} quartos ocupados</span>
                </div>
              </div>

              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-3.5 space-y-1.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Receita Mês</div>
                <div className="text-2xl font-mono font-extrabold text-emerald-400">R$ 28.450</div>
                <div className="flex items-center text-[10px] text-zinc-400 font-medium gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>0% comissão em diárias</span>
                </div>
              </div>
            </div>

            {/* Banner UPSELL Feriado Promocional */}
            <div className="bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-cyan-500/10 border border-amber-500/30 rounded-2xl p-3.5 space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400 animate-bounce" />
                  <span className="text-xs font-bold text-white font-mono">MOTOR DE UPSELL ATIVO</span>
                </div>
                <span className="text-[9px] font-mono font-extrabold bg-amber-500 text-zinc-950 px-2 py-0.5 rounded-full">
                  7% TAXA
                </span>
              </div>
              <p className="text-xs text-zinc-300">
                Próximo feriado: <strong className="text-amber-300">{currentHolidayConfig.name}</strong> (+R$ {dailyIncrease}/quarto).
              </p>
              <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
                <span className="text-[11px] text-zinc-400">Seu Lucro Líquido Previsto:</span>
                <span className="text-xs font-bold text-emerald-400 font-mono">
                  R$ {Math.round(pousadaUpsellProfit).toLocaleString('pt-BR')}
                </span>
              </div>
              <button
                onClick={() => setActiveTab('upsell')}
                className="w-full py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold font-mono flex items-center justify-center gap-1.5 active:scale-95 transition-all mt-1"
              >
                <span>Ajustar Aumento de Diária do Feriado</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Mapa Rápido dos Quartos (Room Grid) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                  <BedDouble className="w-4 h-4 text-emerald-400" />
                  <span>MAPA DE QUARTOS & FECHADURAS</span>
                </h3>
                <button
                  onClick={() => setActiveTab('fechaduras')}
                  className="text-[11px] text-emerald-400 hover:underline font-mono"
                >
                  Ver Todas &gt;
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {rooms.slice(0, 4).map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-2 relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white truncate">{r.name}</span>
                      <span className={`w-2 h-2 rounded-full ${
                        r.status === 'ocupado' ? 'bg-emerald-400' : r.status === 'livre' ? 'bg-zinc-500' : 'bg-amber-400'
                      }`} />
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                      <span>R$ {r.price}/dia</span>
                      <span className="flex items-center gap-1 text-zinc-300">
                        <Battery className={`w-3 h-3 ${r.lockBattery < 20 ? 'text-rose-400' : 'text-emerald-400'}`} />
                        {r.lockBattery}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
                      <span className="text-[10px] font-mono text-zinc-400">PIN: {r.pin}</span>
                      <button
                        onClick={() => handleRemoteUnlock(r.id, r.name)}
                        disabled={unlockingRoomId === r.id}
                        className="px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-bold font-mono active:scale-95"
                      >
                        {unlockingRoomId === r.id ? 'Abrindo...' : 'Destravar'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </motion.div>
        )}

        {/* ABA 2: HÓSPEDES */}
        {activeTab === 'hospedes' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white font-mono">Hóspedes & Check-ins</h2>
                <p className="text-xs text-zinc-400">Controle de entrada, WhatsApp e Guia Digital</p>
              </div>
              <button
                onClick={() => setIsCheckInOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-emerald-500 text-zinc-950 font-bold text-xs font-mono flex items-center gap-1 shadow-[0_0_12px_rgba(16,185,129,0.3)] active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Check-in</span>
              </button>
            </div>

            {/* Filtros */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {(['todos', 'whatsapp', 'booking', 'airbnb'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setGuestFilter(filter)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold uppercase transition-all shrink-0 ${
                    guestFilter === filter
                      ? 'bg-emerald-500 text-[#0a0a0f] shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                      : 'bg-white/[0.04] text-zinc-400 border border-white/[0.08]'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Lista Vertical de Cards de Hóspede */}
            <div className="space-y-2.5">
              {guestsList.map((guest) => (
                <article
                  key={guest.id}
                  className="p-3.5 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] space-y-3 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between border-b border-white/[0.06] pb-2">
                    <div>
                      <h4 className="text-xs font-bold text-white">{guest.name}</h4>
                      <p className="text-[11px] font-mono text-emerald-400">{guest.room}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {guest.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="block text-[10px] text-zinc-500 font-mono">Contato</span>
                      <span className="text-xs font-mono text-zinc-200">{guest.phone}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-zinc-500 font-mono">Origem Reserva</span>
                      <span className="text-xs font-mono font-bold text-emerald-400">{guest.origin}</span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-white/[0.04] gap-2">
                    <button
                      onClick={() => toast.success(`📱 Guia Digital com PIX enviado para ${guest.name} no WhatsApp!`)}
                      className="flex-1 py-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 min-h-[44px] active:scale-95 transition-all"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Guia WhatsApp</span>
                    </button>

                    <button
                      onClick={() => {
                        const targetRoom = rooms.find((r) => r.name === guest.room) || rooms[0];
                        handleRemoteUnlock(targetRoom.id, targetRoom.name);
                      }}
                      className="py-2 px-3 rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/[0.1] text-zinc-200 text-xs font-bold flex items-center justify-center gap-1.5 min-h-[44px] active:scale-95"
                      title="Destrancar Fechadura"
                    >
                      <Key className="w-3.5 h-3.5 text-amber-400" />
                      <span>Abrir Porta</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>

          </motion.div>
        )}

        {/* ABA 3: UPSELL FERIADOS PROLONGADOS (7% TAXA DE SUCESSO) */}
        {activeTab === 'upsell' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            
            <div className="bg-gradient-to-br from-amber-500/10 via-emerald-500/10 to-zinc-900 border border-amber-500/30 rounded-3xl p-4 space-y-3 shadow-[0_0_30px_rgba(245,158,11,0.1)]">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-400 animate-pulse" />
                  <div>
                    <h2 className="text-xs font-bold text-white font-mono">MOTOR DE UPSELL CANÔNICO</h2>
                    <p className="text-[10px] text-zinc-400">Cobrança exclusiva de 7% sobre o aumento de diária</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  FERIADOS
                </span>
              </div>

              {/* Seletor de Feriado */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-zinc-400 uppercase">Selecione a Data Comemorativa / Feriado</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(holidaysConfig) as Array<keyof typeof holidaysConfig>).map((key) => (
                    <button
                      key={key}
                      onClick={() => setSelectedHoliday(key)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        selectedHoliday === key
                          ? 'bg-amber-500/20 border-amber-500/50 text-white shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                          : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <div className="text-xs font-bold truncate">{holidaysConfig[key].name}</div>
                      <div className="text-[10px] font-mono text-amber-400/80">{holidaysConfig[key].dates}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Slider de Aumento de Diária (+R$ 100 a +R$ 500) */}
              <div className="space-y-2 bg-black/40 p-3.5 rounded-2xl border border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-300 font-medium">Aumento por Quarto / Diária:</span>
                  <span className="text-base font-extrabold text-amber-400 font-mono">
                    +R$ {dailyIncrease}
                  </span>
                </div>

                <input
                  type="range"
                  min="50"
                  max="600"
                  step="25"
                  value={dailyIncrease}
                  onChange={(e) => setDailyIncrease(Number(e.target.value))}
                  className="w-full accent-amber-400 h-2 bg-zinc-800 rounded-lg cursor-pointer"
                />

                <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                  <span>+R$ 50</span>
                  <span>+R$ 300</span>
                  <span>+R$ 600</span>
                </div>
              </div>

              {/* Demonstrativo Matemático Transparente */}
              <div className="bg-white/[0.03] p-3 rounded-2xl border border-white/[0.08] space-y-2 text-xs">
                <div className="flex justify-between text-zinc-300">
                  <span>Fórmula:</span>
                  <span className="font-mono text-zinc-400">{rooms.length} quartos × {currentHolidayConfig.nights} noites × +R$ {dailyIncrease}</span>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span>Excedente Bruto Gerado:</span>
                  <span className="font-mono font-bold text-white">R$ {upsellExcedentTotal.toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex justify-between text-emerald-400 font-bold border-t border-white/[0.06] pt-1.5">
                  <span>💰 Seu Lucro Líquido (93%):</span>
                  <span className="font-mono text-sm">R$ {Math.round(pousadaUpsellProfit).toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex justify-between text-zinc-400 text-[11px]">
                  <span>Taxa de Sucesso Seu Zélla (7%):</span>
                  <span className="font-mono text-amber-400">R$ {Math.round(zellaUpsellFee).toLocaleString('pt-BR')}</span>
                </div>
              </div>

              <button
                onClick={handleApplyUpsell}
                className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold font-mono text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.4)] active:scale-95 transition-all"
              >
                <Zap className="w-4 h-4 fill-current" />
                <span>ATIVAR AUMENTO DE DIÁRIA NO CALENDÁRIO</span>
              </button>
            </div>

            {/* Detalhe dos Quartos com Aumento */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-white font-mono">QUARTOS COM REAJUSTE DE FERIADO</h3>
              <div className="space-y-2">
                {rooms.map((room) => (
                  <div key={room.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-white">{room.name}</div>
                      <div className="text-[10px] font-mono text-zinc-400">Diária Normal: R$ {room.price}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-amber-400 font-mono">R$ {room.price + dailyIncrease}</div>
                      <div className="text-[9px] font-mono text-emerald-400">Excedente: +R$ {dailyIncrease}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </motion.div>
        )}

        {/* ABA 4: FECHADURAS INTELIGENTES & GOVERNANÇA */}
        {activeTab === 'fechaduras' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white font-mono">Fechaduras & Governança</h2>
                <p className="text-xs text-zinc-400">Intelbras, Tuya, TTLock, Yale & Limpeza</p>
              </div>
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                GATEWAY ONLINE
              </span>
            </div>

            {/* Grid de Fechaduras Eletrônicas */}
            <div className="space-y-2.5">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="p-3.5 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] space-y-2.5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white">{room.name}</h4>
                      <p className="text-[10px] font-mono text-zinc-400">{room.lockModel}</p>
                    </div>

                    <div className={`flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                      room.lockBattery < 20
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse'
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    }`}>
                      <Battery className="w-3.5 h-3.5" />
                      <span>{room.lockBattery}% {room.lockBattery < 20 && '⚠️ TROCAR'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-black/30 p-2.5 rounded-xl border border-white/[0.04] text-xs">
                    <div>
                      <span className="block text-[9px] font-mono text-zinc-500 uppercase">PIN Digital Hóspede</span>
                      <span className="font-mono text-sm font-extrabold text-amber-400 tracking-wider">{room.pin}</span>
                    </div>
                    <button
                      onClick={() => handleGenerateNewPin(room.id, room.name)}
                      className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/10 text-zinc-300 text-xs font-mono active:scale-95"
                    >
                      Novo PIN
                    </button>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-white/[0.04]">
                    <button
                      onClick={() => handleRemoteUnlock(room.id, room.name)}
                      disabled={unlockingRoomId === room.id}
                      className="flex-1 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold font-mono flex items-center justify-center gap-1.5 min-h-[44px] active:scale-95"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>{unlockingRoomId === room.id ? 'Destrancando...' : 'Destrancar Remoto'}</span>
                    </button>

                    {room.status === 'manutencao' ? (
                      <button
                        onClick={() => handleMarkClean(room.id, room.name)}
                        className="py-2 px-3 rounded-xl bg-cyan-500 text-zinc-950 text-xs font-bold font-mono flex items-center gap-1 min-h-[44px] active:scale-95"
                      >
                        <Brush className="w-3.5 h-3.5" />
                        <span>Quarto Limpo</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setRooms(rooms.map((r) => r.id === room.id ? { ...r, status: 'manutencao' } : r));
                          toast.info(`🧹 ${room.name} colocado em faxina/governança`);
                        }}
                        className="py-2 px-3 rounded-xl bg-white/[0.04] text-zinc-400 text-xs font-mono flex items-center gap-1 min-h-[44px]"
                      >
                        <Brush className="w-3.5 h-3.5" />
                        <span>Faxina</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

          </motion.div>
        )}

        {/* ABA 5: CENTRAL ZÉLLA (Gestão de Quartos & Configurações) */}
        {activeTab === 'central_zella' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white font-mono">Central Zélla — Quartos</h2>
                <p className="text-xs text-zinc-400">Configuração de diárias padrão e acomodações</p>
              </div>
              <button
                onClick={() => setIsAddRoomOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-emerald-500 text-zinc-950 font-bold text-xs font-mono flex items-center gap-1 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Quarto</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {rooms.map((r) => (
                <div key={r.id} className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-sm text-white">{r.name}</div>
                    <span className="text-[10px] font-mono text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                      {r.type}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
                    <span>Diária Base: <strong className="text-white">R$ {r.price}</strong></span>
                    <span>Status: <strong className="text-emerald-400">{r.status}</strong></span>
                  </div>
                </div>
              ))}
            </div>

          </motion.div>
        )}

        {/* ABA 6: WHATS LIVE */}
        {activeTab === 'whats_live' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white font-mono">WhatsApp Live Feed</h2>
                <p className="text-xs text-zinc-400">Atendimento autônomo 24h pelo Cérebro Zélla</p>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            <div className="space-y-2.5">
              {whatsLiveConversations.map((conv) => (
                <div
                  key={conv.id}
                  className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-2 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-xs text-white">{conv.guestName} ({conv.room})</div>
                    <span className="text-[10px] font-mono text-zinc-500">{conv.time}</span>
                  </div>
                  <p className="text-xs text-zinc-300 bg-black/30 p-2.5 rounded-xl border border-white/[0.04]">
                    "{conv.lastMsg}"
                  </p>
                  <div className="flex items-center justify-between pt-1 text-[10px] font-mono text-emerald-400">
                    <span className="flex items-center gap-1">
                      <CheckCheck className="w-3.5 h-3.5" /> Respondido pelo Cérebro Zélla
                    </span>
                    <button
                      onClick={() => toast.success(`Assumindo atendimento de ${conv.guestName}`)}
                      className="px-2 py-1 rounded bg-white/[0.05] text-zinc-300 hover:text-white"
                    >
                      Assumir Chat
                    </button>
                  </div>
                </div>
              ))}
            </div>

          </motion.div>
        )}

        {/* ABA 7: MAIS & SIMULADOR */}
        {activeTab === 'mais' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            
            {/* Acessibilidade de Fontes */}
            <div className="bg-white/[0.03] backdrop-blur-xl border border-emerald-500/30 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                <div className="flex items-center gap-2">
                  <Type className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-white font-mono">TAMANHO DA FONTE</h3>
                </div>
                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                  {fontScale === 0.85 ? 'PEQUENO' : fontScale === 1.15 ? 'GRANDE' : 'PADRÃO'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => { setFontScale(0.85); toast.success('Tamanho: PEQUENO'); }}
                  className={`p-2.5 rounded-xl border font-mono text-xs font-bold ${
                    fontScale === 0.85 ? 'bg-emerald-500 text-zinc-950 border-emerald-400' : 'bg-white/[0.03] text-zinc-300 border-white/[0.08]'
                  }`}
                >
                  85%
                </button>
                <button
                  onClick={() => { setFontScale(1); toast.success('Tamanho: PADRÃO'); }}
                  className={`p-2.5 rounded-xl border font-mono text-xs font-bold ${
                    fontScale === 1 ? 'bg-emerald-500 text-zinc-950 border-emerald-400' : 'bg-white/[0.03] text-zinc-300 border-white/[0.08]'
                  }`}
                >
                  100%
                </button>
                <button
                  onClick={() => { setFontScale(1.15); toast.success('Tamanho: GRANDE'); }}
                  className={`p-2.5 rounded-xl border font-mono text-xs font-bold ${
                    fontScale === 1.15 ? 'bg-emerald-500 text-zinc-950 border-emerald-400' : 'bg-white/[0.03] text-zinc-300 border-white/[0.08]'
                  }`}
                >
                  115%
                </button>
              </div>
            </div>

            {/* Chat Box Simulador Zélla 24h */}
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 space-y-3 flex flex-col h-[340px]">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 text-[10px] font-mono text-zinc-400">
                <span className="text-emerald-400 font-bold">ZÉLLA SIMULATOR 24H</span>
                <span>CONFIDENCE: 99.2%</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 no-scrollbar text-xs">
                {chatLog.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col max-w-[85%] ${
                      msg.sender === 'guest' ? 'ml-auto items-end' : 'mr-auto items-start'
                    }`}
                  >
                    <div
                      className={`p-3 rounded-2xl ${
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

              <form onSubmit={handleSendSimulatedMsg} className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
                <input
                  type="text"
                  value={simulatedMsg}
                  onChange={(e) => setSimulatedMsg(e.target.value)}
                  placeholder="Perguntar sobre café, Wi-Fi, fechadura..."
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
                />
                <button
                  type="submit"
                  className="w-10 h-10 rounded-xl bg-emerald-500 text-zinc-950 flex items-center justify-center font-bold active:scale-95 transition-all shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>

          </motion.div>
        )}

      </main>

      {/* ──
          4. NATIVE MOBILE FLOATING BOTTOM NAVIGATION BAR (Fixed at bottom)
      ── */}
      <nav className="fixed bottom-0 left-0 w-full bg-[#0a0a0f]/95 backdrop-blur-2xl border-t border-white/[0.08] px-2 py-2.5 z-50 flex items-center justify-around">
        
        {/* Tab 1: Visão Geral */}
        <button
          onClick={() => setActiveTab('visao_geral')}
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${
            activeTab === 'visao_geral' ? 'text-emerald-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <LayoutGrid className="w-5 h-5" />
          <span className="text-[9px] font-mono">Geral</span>
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

        {/* Tab 3: UPSELL */}
        <button
          onClick={() => setActiveTab('upsell')}
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 relative ${
            activeTab === 'upsell' ? 'text-amber-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Flame className="w-5 h-5" />
          <span className="text-[9px] font-mono">UPSELL</span>
          <span className="absolute -top-1 right-0 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        </button>

        {/* Tab 4: Fechaduras */}
        <button
          onClick={() => setActiveTab('fechaduras')}
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${
            activeTab === 'fechaduras' ? 'text-emerald-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <KeyRound className="w-5 h-5" />
          <span className="text-[9px] font-mono">Fechaduras</span>
        </button>

        {/* Tab 5: Whats Live */}
        <button
          onClick={() => setActiveTab('whats_live')}
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${
            activeTab === 'whats_live' ? 'text-emerald-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[9px] font-mono">Whats Live</span>
        </button>

        {/* Tab 6: Mais */}
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

      {/* ──
          5. MENU LATERAL DRAWER
      ── */}
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
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                  <div className="flex items-center gap-2">
                    <img src="/SeuZella_Logo_site.png" alt="Seu Zélla" className="h-6 w-auto" />
                    <span className="font-mono text-xs font-bold text-emerald-400">POUSADA</span>
                  </div>
                  <button onClick={() => setIsMenuOpen(false)} className="p-1 rounded-lg bg-white/[0.04] text-zinc-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="bg-white/[0.03] p-3 rounded-xl border border-white/[0.08] space-y-1">
                  <div className="text-[10px] font-mono text-zinc-400">PROPRIEDADE CONECTADA</div>
                  <div className="font-bold text-sm text-white">{propertyName}</div>
                  <div className="text-[10px] font-mono text-emerald-400">Plano Pousada Pro Active</div>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] font-mono text-zinc-400 px-2 pb-1">MENU NATIVO</div>
                  
                  <button
                    onClick={() => { setActiveTab('visao_geral'); setIsMenuOpen(false); }}
                    className="w-full p-2.5 rounded-lg flex items-center gap-3 text-xs font-medium text-zinc-200 hover:bg-white/[0.05] hover:text-emerald-400 transition-all text-left"
                  >
                    <LayoutGrid className="w-4 h-4 text-emerald-400" />
                    <span>Visão Geral</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('hospedes'); setIsMenuOpen(false); }}
                    className="w-full p-2.5 rounded-lg flex items-center gap-3 text-xs font-medium text-zinc-200 hover:bg-white/[0.05] hover:text-emerald-400 transition-all text-left"
                  >
                    <Users className="w-4 h-4 text-emerald-400" />
                    <span>Hóspedes & Check-in</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('upsell'); setIsMenuOpen(false); }}
                    className="w-full p-2.5 rounded-lg flex items-center gap-3 text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 transition-all text-left border border-amber-500/20"
                  >
                    <Flame className="w-4 h-4 text-amber-400" />
                    <span>⚡ UPSELL Feriados (7%)</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('fechaduras'); setIsMenuOpen(false); }}
                    className="w-full p-2.5 rounded-lg flex items-center gap-3 text-xs font-medium text-zinc-200 hover:bg-white/[0.05] hover:text-emerald-400 transition-all text-left"
                  >
                    <KeyRound className="w-4 h-4 text-emerald-400" />
                    <span>Fechaduras Inteligentes</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('whats_live'); setIsMenuOpen(false); }}
                    className="w-full p-2.5 rounded-lg flex items-center gap-3 text-xs font-medium text-zinc-200 hover:bg-white/[0.05] hover:text-emerald-400 transition-all text-left"
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    <span>WhatsApp Live Feed</span>
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-white/[0.08] text-[10px] font-mono text-zinc-500 text-center">
                Seu Zélla Pousada Super App v4.0 · Native Mobile
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ──
          6. MODAL CHECK-IN RÁPIDO
      ── */}
      <AnimatePresence>
        {isCheckInOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-[#13131a] border border-emerald-500/30 rounded-3xl p-5 space-y-4 shadow-[0_0_30px_rgba(16,185,129,0.2)]"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-sm text-white font-mono">CHECK-IN RÁPIDO</h3>
                </div>
                <button onClick={() => setIsCheckInOpen(false)} className="text-zinc-400 hover:text-white p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateCheckIn} className="space-y-3">
                <div>
                  <label className="text-[10px] font-mono text-zinc-400 uppercase">Nome Completo do Hóspede *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Roberto Oliveira"
                    value={newGuestName}
                    onChange={(e) => setNewGuestName(e.target.value)}
                    className="w-full mt-1 bg-white/[0.04] border border-white/[0.1] rounded-xl p-2.5 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-zinc-400 uppercase">WhatsApp</label>
                  <input
                    type="tel"
                    placeholder="(11) 99999-8888"
                    value={newGuestPhone}
                    onChange={(e) => setNewGuestPhone(e.target.value)}
                    className="w-full mt-1 bg-white/[0.04] border border-white/[0.1] rounded-xl p-2.5 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-zinc-400 uppercase">Quarto Selecionado</label>
                  <select
                    value={newGuestRoom}
                    onChange={(e) => setNewGuestRoom(e.target.value)}
                    className="w-full mt-1 bg-[#1a1a24] border border-white/[0.1] rounded-xl p-2.5 text-xs text-white focus:border-emerald-500 outline-none"
                  >
                    {rooms.map((r) => (
                      <option key={r.id} value={r.name}>{r.name} (R$ {r.price}/dia)</option>
                    ))}
                  </select>
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

      {/* ──
          7. SHEET CENTRAL DE NOTIFICAÇÕES
      ── */}
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
                  <h3 className="font-bold text-sm text-white font-mono">NOTIFICAÇÕES POUSADA</h3>
                </div>
                <button onClick={() => setIsNotificationsOpen(false)} className="text-zinc-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-3 rounded-2xl border transition-all ${
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

      {/* ──
          8. MODAL ADICIONAR QUARTO
      ── */}
      <AnimatePresence>
        {isAddRoomOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-[#13131a] border border-emerald-500/30 rounded-3xl p-5 space-y-4 shadow-[0_0_30px_rgba(16,185,129,0.15)]"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2">
                  <BedDouble className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-sm text-white font-mono">NOVO QUARTO</h3>
                </div>
                <button onClick={() => setIsAddRoomOpen(false)} className="text-zinc-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddRoom} className="space-y-3">
                <div>
                  <label className="text-[10px] font-mono text-zinc-400 uppercase">Nome / Número *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Suíte Presidencial 301"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="w-full mt-1 bg-white/[0.04] border border-white/[0.1] rounded-xl p-2.5 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-zinc-400 uppercase">Tipo</label>
                  <select
                    value={newRoomType}
                    onChange={(e) => setNewRoomType(e.target.value as any)}
                    className="w-full mt-1 bg-[#1a1a24] border border-white/[0.1] rounded-xl p-2.5 text-xs text-white focus:border-emerald-500 outline-none"
                  >
                    <option value="Suíte">Suíte</option>
                    <option value="Chalé">Chalé</option>
                    <option value="Standard">Standard</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-zinc-400 uppercase">Diária Base (R$)</label>
                  <input
                    type="number"
                    placeholder="450"
                    value={newRoomPrice}
                    onChange={(e) => setNewRoomPrice(e.target.value)}
                    className="w-full mt-1 bg-white/[0.04] border border-white/[0.1] rounded-xl p-2.5 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 outline-none"
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
