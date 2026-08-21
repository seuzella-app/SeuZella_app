'use client';

// ==============================================================================
// SEU ZÉLLA SUPER APP MOBILE — POUSADA (Native Mobile App Experience)
// ==============================================================================
// - Design System: Cyber-Luxe Glassmorphism (#0a0a0f + Emerald #10b981)
// - Native Mobile App UX: Touch Targets min-h 48px, Floating HUD, Haptics & Gestures
// - Módulos Nativos: Visão Geral, Hóspedes, UPSELL Feriados (7%), Fechaduras & Governança, Whats Live, Mais
// ==============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useMobileDevicePing } from './useMobileDevicePing';
import { MobileYieldProfitWidget } from './MobileYieldProfitWidget';
import { DDCNotificationCenter } from '@/components/ddc/notifications/DDCNotificationCenter';
import { useDDCMobileNotifications } from '@/lib/notifications/use-mobile-notifications';
import {
  BRAND_CATALOG,
  listAllBrands,
  getBrandInfo,
  type LockBrand,
  type ProviderType,
} from '@/lib/locks/types';
import {
  LayoutGrid,
  Users,
  Brain,
  Power,
  Bell,
  Wifi,
  WifiOff,
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
  AlertTriangle,
  Cpu,
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
  BatteryLow,
  Flame,
  DollarSign,
  KeyRound,
  CheckCheck,
  Brush,
  Sliders,
  CalendarCheck,
  ExternalLink,
  LogOut,
  Radio,
} from 'lucide-react';

export function MobilePousadaSuperApp() {
  const [activeTab, setActiveTab] = useState<'visao_geral' | 'financeiro' | 'hospedes' | 'upsell' | 'fechaduras' | 'central_zella' | 'whats_live' | 'mais'>('visao_geral');

  // ZCC Analytics — registra pings de uso Mobile (compara com Desktop)
  useMobileDevicePing({
    niche: 'pousada',
    route: '/mobile/pousada',
    tenantId: typeof window !== 'undefined' ? (window as any).__ZELLA_TENANT_ID ?? 'demo-pousada' : 'demo-pousada',
    tenantName: typeof window !== 'undefined' ? (window as any).__ZELLA_TENANT_NAME : undefined,
    tabName: activeTab,
  });

  // Visibilidade de Valores Financeiros ("Olhinho")
  const [showFinancialValues, setShowFinancialValues] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('zella_show_financial_values');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  const handleToggleFinancialValues = () => {
    setShowFinancialValues((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('zella_show_financial_values', String(next));
      }
      toast.info(next ? '👁️ Valores financeiros visíveis' : '🙈 Valores financeiros ocultos');
      return next;
    });
  };

  const formatMoney = (val: number | string) => {
    if (!showFinancialValues) return 'R$ ••••••';
    if (typeof val === 'number') {
      return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    return val.startsWith('R$') ? val : `R$ ${val}`;
  };

  // Font Scale (Accessibility)
  const [fontScale, setFontScale] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('zella_font_scale');
      return saved ? parseFloat(saved) : 1;
    }
    return 1;
  });

interface PousadaRoom {
  id: string;
  name: string;
  type: string;
  status: 'ocupado' | 'livre' | 'limpeza' | 'manutencao';
  guest: string;
  guestCode: string;
  price: number;
  lockBattery: number;
  pin: string;
  lockModel: string;
  brand: LockBrand;
  providerType: ProviderType;
  pairingStatus: 'connected' | 'pairing' | 'registered' | 'offline';
  pinStatus: 'active' | 'scheduled' | 'revoked' | 'expired';
  pinValidFrom: string;
  pinValidTo: string;
  phone: string;
}

  // Rooms management (Central Zélla & Fechaduras - 10 Marcas BR)
  const [rooms, setRooms] = useState<PousadaRoom[]>([
    { id: '101', name: 'Suíte Master 101', type: 'Suíte', status: 'ocupado', guest: 'Maria Silva', guestCode: 'HSP-001', price: 850, lockBattery: 92, pin: '849201', lockModel: 'Intelbras IFR 7000', brand: 'intelbras', providerType: 'manual', pairingStatus: 'connected', pinStatus: 'active', pinValidFrom: '14:00', pinValidTo: '11:00', phone: '(11) 98822-1100' },
    { id: '103', name: 'Suíte Luxo 103', type: 'Suíte', status: 'ocupado', guest: 'Fernanda Lima', guestCode: 'HSP-003', price: 620, lockBattery: 19, pin: '391044', lockModel: 'Tuya Smart Lock G2', brand: 'tuya', providerType: 'api', pairingStatus: 'connected', pinStatus: 'active', pinValidFrom: '14:00', pinValidTo: '12:00', phone: '(48) 99123-5566' },
    { id: '105', name: 'Quarto Standard 105', type: 'Standard', status: 'livre', guest: '', guestCode: '', price: 450, lockBattery: 85, pin: '772190', lockModel: 'TTLock X20 Gateway BLE', brand: 'ttlock', providerType: 'api', pairingStatus: 'connected', pinStatus: 'scheduled', pinValidFrom: '14:00', pinValidTo: '11:00', phone: '' },
    { id: '204', name: 'Chalé Família 204', type: 'Chalé', status: 'ocupado', guest: 'Carlos Andrade', guestCode: 'HSP-002', price: 620, lockBattery: 74, pin: '510933', lockModel: 'Yale YDM 4109 Smart', brand: 'yale', providerType: 'manual', pairingStatus: 'connected', pinStatus: 'active', pinValidFrom: '14:00', pinValidTo: '11:00', phone: '(21) 97110-3344' },
    { id: '205', name: 'Chalé Família 205', type: 'Chalé', status: 'manutencao', guest: '', guestCode: '', price: 620, lockBattery: 88, pin: '640192', lockModel: 'Nuki Smart Lock 4.0 Pro', brand: 'nuki', providerType: 'api', pairingStatus: 'connected', pinStatus: 'scheduled', pinValidFrom: '14:00', pinValidTo: '11:00', phone: '' },
    { id: '106', name: 'Quarto Standard 106', type: 'Standard', status: 'livre', guest: '', guestCode: '', price: 450, lockBattery: 95, pin: '190344', lockModel: 'Igloohome Deadbolt 2S', brand: 'igloohome', providerType: 'api', pairingStatus: 'connected', pinStatus: 'scheduled', pinValidFrom: '14:00', pinValidTo: '11:00', phone: '' },
    { id: '301', name: 'Bangalô Vista Mar 301', type: 'Suíte', status: 'ocupado', guest: 'Dr. Roberto Dias', guestCode: 'HSP-004', price: 920, lockBattery: 68, pin: '418302', lockModel: 'August Wi-Fi Smart Lock', brand: 'august', providerType: 'api', pairingStatus: 'pairing', pinStatus: 'active', pinValidFrom: '15:00', pinValidTo: '12:00', phone: '(31) 98765-4321' },
    { id: '206', name: 'Chalé Rústico 206', type: 'Chalé', status: 'livre', guest: '', guestCode: '', price: 580, lockBattery: 79, pin: '239841', lockModel: 'Papaiz Eletronika FR 200', brand: 'papaiz', providerType: 'manual', pairingStatus: 'connected', pinStatus: 'scheduled', pinValidFrom: '14:00', pinValidTo: '11:00', phone: '' },
    { id: '108', name: 'Quarto Família 108', type: 'Standard', status: 'livre', guest: '', guestCode: '', price: 490, lockBattery: 15, pin: '582019', lockModel: 'Philco PH200S Smart', brand: 'philco', providerType: 'manual', pairingStatus: 'registered', pinStatus: 'scheduled', pinValidFrom: '14:00', pinValidTo: '11:00', phone: '' },
    { id: '501', name: 'Studio Executivo 501', type: 'Suíte', status: 'ocupado', guest: 'Juliana Prado', guestCode: 'HSP-005', price: 750, lockBattery: 91, pin: '831094', lockModel: 'Samsung SHP-DP609', brand: 'samsung', providerType: 'manual', pairingStatus: 'connected', pinStatus: 'active', pinValidFrom: '14:00', pinValidTo: '11:00', phone: '(11) 97788-9900' },
  ]);
  const [isAddRoomOpen, setIsAddRoomOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomType, setNewRoomType] = useState<'Suíte' | 'Chalé' | 'Standard'>('Standard');
  const [newRoomPrice, setNewRoomPrice] = useState('450');

  // Locks & Governança state
  const [lockFilter, setLockFilter] = useState<'all' | 'api' | 'manual' | 'battery' | 'pairing'>('all');
  const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);
  const [pairingStep, setPairingStep] = useState<1 | 2 | 3>(1);
  const [pairingBrand, setPairingBrand] = useState<LockBrand>('ttlock');
  const [pairingRoomName, setPairingRoomName] = useState('');
  const [pairingDeviceId, setPairingDeviceId] = useState('');
  const [selectedLockForPanic, setSelectedLockForPanic] = useState<any | null>(null);
  const [selectedLockForWhatsApp, setSelectedLockForWhatsApp] = useState<any | null>(null);

  // WhatsApp Live data
  const [whatsLiveConversations] = useState([
    { id: 1, guestName: 'Carlos Andrade', room: 'Chalé 204', phone: '21971103344', lastMsg: 'Obrigado! O estacionamento é gratuito?', time: '14:38', isLive: true },
    { id: 2, guestName: 'Fernanda Lima', room: 'Suíte 103', phone: '48991235566', lastMsg: 'Qual o horário do café da manhã?', time: '14:32', isLive: true },
    { id: 3, guestName: 'Maria Silva', room: 'Suíte 101', phone: '11988221100', lastMsg: 'Perfeito, obrigada!', time: '13:55', isLive: false },
  ]);
  const [assumedChatIds, setAssumedChatIds] = useState<number[]>([]);
  const [messageStats] = useState({ today: 47, week: 218, month: 894, previous: 761 });
  const [planType] = useState<'pro' | 'lite'>('pro');
  const [liteMessagesUsed] = useState(3420);
  const [liteMessagesTotal] = useState(5000);
  // Nome da Pousada (vinculado ao cadastro do proprietário em Configurações da Pousada)
  const [propertyName, setPropertyName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('zella_pousada_nome');
      if (saved) return saved;
    }
    return 'NOME DA POUSADA';
  });

  // Check-outs de Hoje (Painel Geral & Governança)
  const [checkoutsList, setCheckoutsList] = useState([
    { id: 'co-1', guestName: 'Dr. Roberto Dias', room: 'Bangalô Vista Mar 301', timeLimit: '12:00', status: 'PENDENTE', phone: '(31) 98765-4321' },
    { id: 'co-2', guestName: 'Juliana Prado', room: 'Studio Executivo 501', timeLimit: '11:00', status: 'CONCLUÍDO', phone: '(11) 97788-9900' },
  ]);

  const handleCheckoutAction = (coId: string, guestName: string, roomName: string) => {
    setCheckoutsList((prev) => prev.map((co) => co.id === coId ? { ...co, status: 'CONCLUÍDO' } : co));
    handleCheckOut(coId, guestName, roomName);
  };

  const [aiActive, setAiActive] = useState<boolean>(true);
  const [time, setTime] = useState<string>('');
  const [guestFilter, setGuestFilter] = useState<'todos' | 'whatsapp' | 'booking' | 'airbnb' | 'direct'>('todos');
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

  // Live Synced Notifications Engine
  const { unreadCount, notifications, simulateNotification } = useDDCMobileNotifications({
    niche: 'pousada',
    pollInterval: 15000,
    enableSound: false,
    enableBrowserNotifications: false,
  });

  const [guestsList, setGuestsList] = useState([
    { id: '1', name: 'Maria Silva', room: 'Suíte Master 101', status: 'CONFIRMADO', origin: 'Direct PIX', phone: '(11) 98822-1100' },
    { id: '2', name: 'Carlos Andrade', room: 'Chalé Família 204', status: 'CHECKED_IN', origin: 'Booking.com', phone: '(21) 97110-3344' },
    { id: '3', name: 'Fernanda Lima', room: 'Suíte Luxo 103', status: 'CONFIRMADO', origin: 'WhatsApp', phone: '(48) 99123-5566' },
  ]);

  const [chatLog, setChatLog] = useState<Array<{ sender: 'guest' | 'zella'; text: string; time: string }>>([
    { sender: 'guest', text: 'Olá! Qual o horário de check-in e a senha do Wi-Fi?', time: '14:32' },
    { sender: 'zella', text: 'Olá! Nosso check-in é a partir das 14h. O Wi-Fi é "Zella_Guest_5G" e a senha é "marés_vip2026". Precisa de ajuda com o estacionamento?', time: '14:32' },
  ]);

  // Sincronização entre Desktop e Mobile via Storage Events
  useEffect(() => {
    const syncFromStorage = () => {
      try {
        const savedRooms = localStorage.getItem('zella_pousada_rooms');
        if (savedRooms) setRooms(JSON.parse(savedRooms));
        const savedUpsell = localStorage.getItem('zella_pousada_upsell');
        if (savedUpsell) {
          const parsed = JSON.parse(savedUpsell);
          if (parsed.dailyIncrease) setDailyIncrease(parsed.dailyIncrease);
          if (parsed.selectedHoliday) setSelectedHoliday(parsed.selectedHoliday);
        }
      } catch {}
    };
    syncFromStorage();
    window.addEventListener('storage', syncFromStorage);
    window.addEventListener('zella_sync_state', syncFromStorage);
    return () => {
      window.removeEventListener('storage', syncFromStorage);
      window.removeEventListener('zella_sync_state', syncFromStorage);
    };
  }, []);

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
      toast.success(next ? '⚡ Motor Seu Zélla ATIVADO (Atendimento 24h)' : '⏸ Motor Seu Zélla PAUSADO');
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
    }, 1200);
  };

  const handleRemoteUnlock = (roomId: string, roomName: string, brand?: LockBrand, providerType?: ProviderType) => {
    const isManual = providerType === 'manual';
    if (isManual) {
      toast.info(`🛡️ ${roomName} (${brand?.toUpperCase()}): Fechadura offline/manual. Destrancamento remoto exige Gateway BLE/WiFi ativo ou digitação do PIN na porta.`);
      return;
    }
    setUnlockingRoomId(roomId);
    toast.info(`🔑 Enviando sinal criptografado via API ${brand?.toUpperCase()} para ${roomName}...`);
    setTimeout(() => {
      setUnlockingRoomId(null);
      toast.success(`🔓 ${roomName} DESTRANCADA COM SUCESSO! Acesso liberado.`);
    }, 1200);
  };

  const handleGenerateNewPin = (roomId: string, roomName: string) => {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    const newPin = (arr[0] % 1000000).toString().padStart(6, '0');
    const updated = rooms.map((r) => r.id === roomId ? { ...r, pin: newPin, pinStatus: 'active' as const } : r);
    setRooms(updated);
    try {
      localStorage.setItem('zella_pousada_rooms', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('zella_sync_state'));
    } catch {}
    toast.success(`🔑 Novo PIN Gerado para ${roomName}: ${newPin}# (Ativação Fail-Closed)`);
  };

  const handlePanicRevoke = (roomId: string, roomName: string) => {
    const updated = rooms.map((r) => r.id === roomId ? { ...r, pin: '------', pinStatus: 'revoked' as const } : r);
    setRooms(updated);
    try {
      localStorage.setItem('zella_pousada_rooms', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('zella_sync_state'));
    } catch {}
    toast.error(`🚨 REVOGAÇÃO DE PÂNICO CONCLUÍDA! PIN de ${roomName} foi invalidado e fechadura trancada.`);
    setSelectedLockForPanic(null);
  };

  const handleSendWhatsAppPin = (room: any) => {
    const phoneClean = (room.phone || '5511988221100').replace(/\D/g, '');
    const msg = encodeURIComponent(
      `🏨 *${propertyName}* — Acesso Liberado!\n\n` +
      `Olá, ${room.guest || 'Hóspede'}!\n` +
      `Sua acomodação: *${room.name}*\n` +
      `🔑 *Seu PIN Digital:* \`${room.pin}#\`\n` +
      `⏰ *Janela de Acesso:* ${room.pinValidFrom} às ${room.pinValidTo}\n\n` +
      `Instruções: Digite os 6 dígitos seguidos da tecla # na fechadura da porta.\n` +
      `Tenha uma excelente estadia!`
    );
    window.open(`https://wa.me/${phoneClean}?text=${msg}`, '_blank');
    toast.success(`📲 PIN de ${room.name} enviado via WhatsApp!`);
    setSelectedLockForWhatsApp(null);
  };

  const handlePairNewLock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairingRoomName) {
      toast.error('Informe o nome do quarto');
      return;
    }
    const brandInfo = getBrandInfo(pairingBrand);
    const id = (rooms.length + 101).toString();
    const newRoomObj = {
      id,
      name: pairingRoomName,
      type: 'Suíte' as const,
      status: 'livre' as const,
      guest: '',
      guestCode: '',
      price: 520,
      lockBattery: 100,
      pin: Math.floor(100000 + Math.random() * 900000).toString(),
      lockModel: `${brandInfo?.label || pairingBrand} Smart`,
      brand: pairingBrand,
      providerType: (brandInfo?.providerType || 'api') as ProviderType,
      pairingStatus: 'connected' as const,
      pinStatus: 'scheduled' as const,
      pinValidFrom: '14:00',
      pinValidTo: '11:00',
      phone: '',
    };
    const updated = [newRoomObj, ...rooms];
    setRooms(updated);
    try {
      localStorage.setItem('zella_pousada_rooms', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('zella_sync_state'));
    } catch {}
    toast.success(`🔐 Fechadura ${brandInfo?.label} pareada e vinculada a ${pairingRoomName}!`);
    setIsPairingModalOpen(false);
    setPairingStep(1);
    setPairingRoomName('');
    setPairingDeviceId('');
  };

  const handleMarkClean = (roomId: string, roomName: string) => {
    const updated = rooms.map((r) => r.id === roomId ? { ...r, status: 'livre' as const } : r);
    setRooms(updated);
    try {
      localStorage.setItem('zella_pousada_rooms', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('zella_sync_state'));
    } catch {}
    toast.success(`🧹 ${roomName} MARCADO COMO LIMPO! Pronto para próximo check-in.`);
  };

  const handleApplyUpsell = () => {
    try {
      localStorage.setItem('zella_pousada_upsell', JSON.stringify({ dailyIncrease, selectedHoliday, upsellActive }));
      window.dispatchEvent(new CustomEvent('zella_sync_state'));
    } catch {}
    toast.success(`⚡ UPSELL ATIVADO! +R$ ${dailyIncrease}/diária aplicado para ${holidaysConfig[selectedHoliday].name}`);
  };

  const handleCheckOut = (guestId: string, guestName: string, roomName: string) => {
    setGuestsList((prev) => prev.map((g) => g.id === guestId ? { ...g, status: 'CHECKED_OUT' } : g));
    const updatedRooms = rooms.map((r) => r.name === roomName ? { ...r, status: 'manutencao' as const, guest: '' } : r);
    setRooms(updatedRooms);
    try {
      localStorage.setItem('zella_pousada_rooms', JSON.stringify(updatedRooms));
      window.dispatchEvent(new CustomEvent('zella_sync_state'));
    } catch {}
    toast.success(`👋 Check-out de ${guestName} realizado com sucesso!`, {
      description: `${roomName} liberado e colocado em governança/faxina. Pesquisa NPS enviada.`,
    });
  };

  const handleAssumeChat = (conv: { id: number; guestName: string; phone?: string; room: string }) => {
    const rawPhone = conv.phone || '11988221100';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    
    // Abre o WhatsApp direto no chat do cliente
    if (typeof window !== 'undefined') {
      window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(`Olá ${conv.guestName}, sou o responsável pela pousada!`)}`, '_blank');
    }
    
    setAssumedChatIds((prev) => [...prev, conv.id]);
    toast.info(`💬 Atendimento Humano Iniciado para ${conv.guestName}!`, {
      description: 'O Motor Seu Zélla pausou respostas automáticas. Conforme os Termos de Uso, intervenções pontuais não afetam a mensalidade ou regras.',
      duration: 6000,
    });
  };

  const handleResumeZella = (convId: number, guestName: string) => {
    setAssumedChatIds((prev) => prev.filter((id) => id !== convId));
    toast.success(`🛡️ Motor Seu Zélla Reassumiu o Atendimento!`, {
      description: `Automação 24h restabelecida para ${guestName} com histórico contextual 100% preservado.`,
    });
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
    const updatedRooms = rooms.map((r) => (r.name === newGuestRoom ? { ...r, status: 'ocupado' as const, guest: newGuestName } : r));
    setRooms(updatedRooms);
    try {
      localStorage.setItem('zella_pousada_rooms', JSON.stringify(updatedRooms));
      window.dispatchEvent(new CustomEvent('zella_sync_state'));
    } catch {}

    setNewGuestName('');
    setNewGuestPhone('');
    setIsCheckInOpen(false);
    toast.success(`🎉 Check-in de ${newGuest.name} realizado com sucesso!`);
  };

  const filteredGuests = useMemo(() => {
    if (guestFilter === 'todos') return guestsList;
    if (guestFilter === 'whatsapp') return guestsList.filter((g) => g.origin.toLowerCase().includes('whatsapp'));
    if (guestFilter === 'booking') return guestsList.filter((g) => g.origin.toLowerCase().includes('booking'));
    if (guestFilter === 'airbnb') return guestsList.filter((g) => g.origin.toLowerCase().includes('airbnb'));
    if (guestFilter === 'direct') return guestsList.filter((g) => g.origin.toLowerCase().includes('direct') || g.origin.toLowerCase().includes('pix'));
    return guestsList;
  }, [guestsList, guestFilter]);

  const handleAddRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    const newRoom: PousadaRoom = {
      id: (rooms.length + 101).toString(),
      name: newRoomName,
      type: newRoomType,
      status: 'livre',
      guest: '',
      guestCode: '',
      price: parseFloat(newRoomPrice) || 450,
      lockBattery: 100,
      pin: '123456',
      lockModel: 'Intelbras IFR 7000',
      brand: 'intelbras',
      providerType: 'manual',
      pairingStatus: 'connected',
      pinStatus: 'scheduled',
      pinValidFrom: '14:00',
      pinValidTo: '11:00',
      phone: '',
    };

    setRooms([...rooms, newRoom]);
    setNewRoomName('');
    setNewRoomPrice('450');
    setIsAddRoomOpen(false);
    toast.success(`✅ Quarto ${newRoom.name} adicionado com sucesso!`);
  };

  const handleSetFontScale = (scale: number) => {
    setFontScale(scale);
    if (typeof window !== 'undefined') {
      localStorage.setItem('zella_font_scale', String(scale));
      document.documentElement.style.setProperty('--zella-font-scale', String(scale));
    }
    toast.success(`🔤 Tamanho da fonte ajustado para ${Math.round(scale * 100)}%!`);
  };

  const handleSendSimulatedMsg = (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const query = customQuery || simulatedMsg;
    if (!query.trim()) return;

    setSimulatedMsg('');
    setChatLog((prev) => [...prev, { sender: 'guest', text: query, time: time || 'Agora' }]);

    setTimeout(() => {
      let botResponse = '';
      const lower = query.toLowerCase();

      if (lower.includes('parear') || lower.includes('fechadura') || lower.includes('adicionar fechadura') || lower.includes('marca')) {
        botResponse = '🔐 Para parear uma fechadura: Vá na aba "Fechaduras" e toque no botão "+ Parear". Escolha entre as 10 marcas compatíveis (TTLock, Tuya, Intelbras, Yale, Nuki, Igloohome, August, Papaiz, Philco, Samsung), informe o quarto/device ID e conclua a validação Fail-Closed!';
      } else if (lower.includes('upsell') || lower.includes('feriado') || lower.includes('7%') || lower.includes('alta temporada')) {
        botResponse = '⚡ O UPSELL de Feriados permite ativar tarifas inteligentes para datas de pico (Réveillon, Carnaval, Férias). O aumento diário configurado é repassado 93% direto para a pousada, com apenas 7% de taxa de performance Zélla!';
      } else if (lower.includes('pin') || lower.includes('senha') || lower.includes('whatsapp') || lower.includes('enviar pin')) {
        botResponse = '📲 Envio de PIN via WhatsApp: Na aba "Fechaduras", toque em "WhatsApp" no card do quarto. O Zélla gera um template pronto com o código (ex: 849201#) e a janela temporal (-15 min do check-in até o check-out).';
      } else if (lower.includes('destrancar') || lower.includes('abrir remoto') || lower.includes('destravar')) {
        botResponse = '🔓 Destrancamento Remoto: Disponível para marcas com API/Gateway (TTLock, Tuya, Nuki, Igloohome, August). Para marcas manuais/offline (Intelbras, Yale, Papaiz, etc.), o acesso é feito digitando o PIN diretamente no teclado da porta.';
      } else if (lower.includes('panico') || lower.includes('pânico') || lower.includes('revogar') || lower.includes('bloquear')) {
        botResponse = '🚨 Revogação de Pânico: Toque no botão "Pânico" em qualquer fechadura para invalidar imediatamente o PIN do hóspede e travar o acesso em tempo real, garantindo segurança total.';
      } else if (lower.includes('bateria') || lower.includes('pilha') || lower.includes('20%')) {
        botResponse = '🔋 Telemetria de Bateria: O DDC alerta automaticamente quando o nível cair abaixo de 20%. Toque em "Pedir Troca" para acionar a equipe de governança e trocar as 4 pilhas AA antes do próximo hóspede.';
      } else if (lower.includes('taxa') || lower.includes('15%') || lower.includes('comissao') || lower.includes('comissão') || lower.includes('economia') || lower.includes('financeiro') || lower.includes('pix')) {
        botResponse = '💰 Economia de Taxas: Na aba "Financeiro", o Radar Zélla calcula a economia líquida obtida ao converter reservas diretas no PIX (0% de taxa de intermediação) em vez de pagar 15% a 25% nas OTAs como Booking e Airbnb.';
      } else if (lower.includes('checkin') || lower.includes('check-in') || lower.includes('novo hospede') || lower.includes('hóspede')) {
        botResponse = '🏨 Check-in Rápido: Toque em "+ Check-in Rápido" na barra superior ou na aba Hóspedes para cadastrar o nome, quarto, canal (PIX/WhatsApp/Booking) e já gerar o PIN de acesso digital.';
      } else if (lower.includes('fonte') || lower.includes('letra') || lower.includes('tamanho') || lower.includes('140%') || lower.includes('letras')) {
        botResponse = '🔤 Tamanho de Fonte: Na aba "Mais", selecione entre 85%, 100%, 115% ou 140% para redimensionar instantaneamente todo o texto do DDC Mobile no seu celular.';
      } else if (lower.includes('escudo') || lower.includes('anti-ban') || lower.includes('banimento')) {
        botResponse = '🛡️ Escudo Anti-Ban: Protege o número de WhatsApp da pousada distribuindo mensagens e links do Guia Digital de forma humanizada, evitando bloqueios da Meta.';
      } else {
        botResponse = '🔒 Travas de Segurança Operacional Ativas: Sou o Guia Operacional exclusivo do DDC Mobile Seu Zélla. Posso te orientar sobre o uso de: Fechaduras (10 marcas), Financeiro & PIX, UPSELL 7%, WhatsApp de Hóspedes e Check-in. Como posso te ajudar na pousada?';
      }

      setChatLog((prev) => [...prev, { sender: 'zella', text: botResponse, time: time || 'Agora' }]);
    }, 400);
  };



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
          1. TOP APP BAR CYBER-LUXE POUSADA (Mobile Header - Limpo & Espaçoso)
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
              className="h-7 w-auto object-contain max-w-[110px]"
            />
            <div className="h-4 w-[1px] bg-white/20" />
            <span className="font-mono text-[10px] font-black tracking-widest text-emerald-400 uppercase bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              POUSADA
            </span>
          </div>
        </div>

        {/* Ações Direitas: Olhinho & Notificações (Sem a bolinha de status, com espaço e respiro total) */}
        <div className="flex items-center gap-2.5 pr-0.5">
          {/* Botão Olhinho (Show / Hide Financial Values) */}
          <button
            onClick={handleToggleFinancialValues}
            className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-300 hover:text-white transition-all active:scale-95 relative"
            title={showFinancialValues ? 'Ocultar valores financeiros' : 'Mostrar valores financeiros'}
            aria-label={showFinancialValues ? 'Ocultar valores financeiros' : 'Mostrar valores financeiros'}
          >
            {showFinancialValues ? <Eye className="w-4 h-4 text-emerald-400" /> : <EyeOff className="w-4 h-4 text-zinc-400" />}
          </button>

          {/* Notificações Bell com badge */}
          <button
            onClick={() => setIsNotificationsOpen(true)}
            className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-300 hover:text-white transition-all active:scale-95 relative"
            aria-label="Notificações"
          >
            <Bell className="w-4 h-4 text-emerald-400" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 text-[#0a0a0f] text-[9px] font-mono font-bold flex items-center justify-center shadow-[0_0_8px_#10b981]">
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
          onClick={() => setActiveTab('financeiro')}
          className="shrink-0 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold font-mono flex items-center gap-1.5 active:scale-95 transition-all shadow-[0_0_12px_rgba(16,185,129,0.15)]"
        >
          <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          <span>💰 Financeiro ({formatMoney(48920)})</span>
        </button>

        <button
          onClick={() => setActiveTab('upsell')}
          className="shrink-0 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold font-mono flex items-center gap-1.5 active:scale-95 transition-all shadow-[0_0_12px_rgba(245,158,11,0.15)]"
        >
          <Flame className="w-3.5 h-3.5 text-amber-400" />
          <span>⚡ UPSELL Feriado (+{formatMoney(dailyIncrease)})</span>
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
          <Plus className="w-3.5 h-3.5 text-emerald-400" />
          <span>+ Check-in Rápido</span>
        </button>

        <button
          onClick={handleSyncOTAs}
          disabled={isSyncingOTAs}
          className="shrink-0 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.1] text-zinc-200 text-xs font-bold font-mono flex items-center gap-1.5 active:scale-95 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isSyncingOTAs ? 'animate-spin' : ''}`} />
          <span>{isSyncingOTAs ? 'Sync OTAs...' : 'Sync OTAs'}</span>
        </button>
      </div>

      {/* ──
          3. CORPO DINÂMICO CONFORME A ABA ATIVA
      ── */}
      <main className="flex-1 px-3.5 pt-3 space-y-4">
        
        {/* ABA 1: VISÃO GERAL (PAINEL EXECUTIVO COMPLETO DDC POUSADA) */}
        {activeTab === 'visao_geral' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3.5">
            
            {/* HERO EXECUTIVO: NOME DA POUSADA EM DESTAQUE */}
            <div className="p-4 rounded-3xl bg-gradient-to-br from-emerald-500/20 via-emerald-950/20 to-black/70 border border-emerald-500/30 backdrop-blur-xl relative overflow-hidden space-y-3 shadow-[0_0_30px_rgba(16,185,129,0.12)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    {/* Nome da Pousada Cadastrada em Configurações */}
                    <span className="text-xs font-bold text-white uppercase tracking-wide font-mono block">
                      {propertyName}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">Painel Geral · Tempo Real</span>
                  </div>
                </div>
                <button
                  onClick={() => toast.info('🛡️ 100% OPERACIONAL: Motor Seu Zélla ativo 24h no WhatsApp, 10 fechaduras integradas e conciliação PIX em tempo real sem intermediários.')}
                  className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                  title="Clique para ver o status dos serviços"
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> 100% OPERACIONAL
                </button>
              </div>

              {/* Faturamento do Mês */}
              <div className="pt-1">
                <span className="block text-[10px] font-mono text-zinc-400 uppercase">Faturamento Mês em Aberto</span>
                <div className="text-3xl font-black text-white font-mono tracking-tight mt-0.5">
                  {formatMoney(48920)}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1 font-bold">
                    <TrendingUp className="w-3 h-3" /> +18.4% vs mês anterior
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">14 reservas diretas PIX</span>
                </div>
              </div>

              {/* 4 KPIs Rápidos */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.08]">
                <div className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-0.5">
                  <span className="text-[9px] font-mono text-zinc-400 uppercase">Ocupação Hoje</span>
                  <div className="text-sm font-extrabold text-white font-mono">84.5% (8/10)</div>
                  <span className="text-[9px] font-mono text-emerald-400">2 quartos livres</span>
                </div>

                <div className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-0.5">
                  <span className="text-[9px] font-mono text-zinc-400 uppercase">Economia de Taxas</span>
                  <div className="text-sm font-extrabold text-cyan-400 font-mono">{formatMoney(4549.50)}</div>
                  <span className="text-[9px] font-mono text-zinc-400">0% vs 15% OTAs</span>
                </div>

                <div className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-0.5">
                  <span className="text-[9px] font-mono text-zinc-400 uppercase">UPSELL Réveillon</span>
                  <div className="text-sm font-extrabold text-amber-400 font-mono">+{formatMoney(dailyIncrease)}/dia</div>
                  <span className="text-[9px] font-mono text-zinc-400">93% da pousada (7% taxa)</span>
                </div>

                <div className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-0.5">
                  <span className="text-[9px] font-mono text-zinc-400 uppercase">Fechaduras & Pilhas</span>
                  <div className="text-sm font-extrabold text-white font-mono">9/10 Ok</div>
                  <span className="text-[9px] font-mono text-rose-400 font-bold">1 com bateria &lt;20%</span>
                </div>
              </div>
            </div>

            {/* CARD 1: CHEGADAS & CHECK-INS DE HOJE */}
            <div className="p-4 rounded-3xl bg-[#12121a]/90 border border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.3)] space-y-3">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
                <h3 className="text-xs font-bold text-white font-mono flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span>CHEGADAS & CHECK-INS DE HOJE</span>
                </h3>
                <button
                  onClick={() => setActiveTab('hospedes')}
                  className="text-[11px] text-emerald-400 hover:underline font-mono"
                >
                  Ver Todos ({guestsList.length}) &gt;
                </button>
              </div>

              <div className="space-y-2">
                {guestsList.map((g) => (
                  <div
                    key={g.id}
                    className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between text-xs hover:border-emerald-500/30 transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white">{g.name}</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                          {g.origin}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                        {g.room} · Status: <span className="text-emerald-400 font-bold">{g.status}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          const phoneClean = (g.phone || '5511988221100').replace(/\D/g, '');
                          window.open(`https://wa.me/${phoneClean}?text=${encodeURIComponent(`Olá ${g.name}! Sua reserva na ${propertyName} está confirmada. Segue seu link do Guia Digital com instruções de acesso e detalhes da sua hospedagem: https://smart-hotel-zehla.vercel.app/guia`)}`, '_blank');
                          toast.success(`WhatsApp aberto para ${g.name}!`);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold font-mono flex items-center gap-1 active:scale-95"
                      >
                        <Send className="w-3 h-3" />
                        <span>WhatsApp</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CARD 2: STATUS DOS QUARTOS & FECHADURAS */}
            <div className="p-4 rounded-3xl bg-[#12121a]/90 border border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.3)] space-y-3">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
                <h3 className="text-xs font-bold text-white font-mono flex items-center gap-2">
                  <BedDouble className="w-4 h-4 text-emerald-400" />
                  <span>STATUS DOS QUARTOS & FECHADURAS</span>
                </h3>
                <button
                  onClick={() => setActiveTab('fechaduras')}
                  className="text-[11px] text-emerald-400 hover:underline font-mono"
                >
                  10 Marcas BR &gt;
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {rooms.slice(0, 4).map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-2 relative overflow-hidden hover:border-emerald-500/30 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white truncate">{r.name}</span>
                      <span className={`w-2 h-2 rounded-full ${
                        r.status === 'ocupado' ? 'bg-emerald-400' : r.status === 'livre' ? 'bg-zinc-500' : 'bg-amber-400'
                      }`} />
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                      <span>{formatMoney(r.price)}/dia</span>
                      <span className={`flex items-center gap-1 font-bold ${r.lockBattery < 20 ? 'text-rose-400 animate-pulse' : 'text-zinc-300'}`}>
                        <Battery className="w-3 h-3" />
                        {r.lockBattery}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
                      <span className="text-[10px] font-mono text-amber-400 font-bold">{r.pin}#</span>
                      <button
                        onClick={() => handleRemoteUnlock(r.id, r.name, r.brand, r.providerType)}
                        disabled={unlockingRoomId === r.id}
                        className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-bold font-mono active:scale-95"
                      >
                        {unlockingRoomId === r.id ? 'Abrindo...' : 'Destravar'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CARD 3: STATUS DE CHECK-OUT */}
            <div className="p-4 rounded-3xl bg-[#12121a]/90 border border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.3)] space-y-3">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
                <h3 className="text-xs font-bold text-white font-mono flex items-center gap-2">
                  <LogOut className="w-4 h-4 text-amber-400" />
                  <span>STATUS DE CHECK-OUT</span>
                </h3>
                <span className="text-[10px] font-mono text-zinc-400">Hoje até 12:00</span>
              </div>

              <div className="space-y-2">
                {checkoutsList.map((co) => (
                  <div
                    key={co.id}
                    className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between text-xs hover:border-amber-500/30 transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white">{co.guestName}</span>
                        <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold border ${
                          co.status === 'CONCLUÍDO'
                            ? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {co.status}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                        {co.room} · Limite: <span className="text-amber-300 font-bold">{co.timeLimit}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {co.status !== 'CONCLUÍDO' && (
                        <button
                          onClick={() => handleCheckoutAction(co.id, co.guestName, co.room)}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[10px] font-bold font-mono active:scale-95"
                        >
                          Liberar Limpeza
                        </button>
                      )}
                      <button
                        onClick={() => {
                          const phoneClean = (co.phone || '5511988221100').replace(/\D/g, '');
                          window.open(`https://wa.me/${phoneClean}?text=${encodeURIComponent(`Olá ${co.guestName}! Agradecemos sua estadia na ${propertyName}. Esperamos que tenha sido incrível! Poderia nos avaliar no link: https://smart-hotel-zehla.vercel.app/nps`)}`, '_blank');
                        }}
                        className="p-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold font-mono active:scale-95"
                        title="Enviar NPS WhatsApp"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* WI-FI DA POUSADA (FORA DE CARD — ATENDIDO AUTOMATICAMENTE PELO SEU ZÉLLA NO WHATSAPP) */}
            <div className="px-1 py-2 flex items-center justify-between border-t border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Wifi className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white font-mono">Wi-Fi Pousada</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 font-bold">
                      🤖 Seu Zélla Responde
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-zinc-400">
                    {showWifiPassword ? 'marés_vip2026' : '••••••••••••'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowWifiPassword(!showWifiPassword)}
                  className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/10 text-zinc-300 active:scale-95 transition-all"
                  aria-label="Ver Senha"
                >
                  {showWifiPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('marés_vip2026');
                    toast.success('Senha do Wi-Fi copiada para envio!');
                  }}
                  className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 active:scale-95 transition-all"
                  aria-label="Copiar Senha"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

          </motion.div>
        )}

        {/* ABA FINANCEIRO: RADAR & FATURAMENTO CYBER-LUXE POUSADA */}
        {activeTab === 'financeiro' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            
            {/* Header & Hero de Faturamento */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/15 via-emerald-950/20 to-black/60 border border-emerald-500/30 backdrop-blur-xl relative overflow-hidden space-y-3 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold">FATURAMENTO TOTAL DO MÊS</span>
                    <div className="text-[11px] text-zinc-400 font-mono">Pousada Solar das Marés</div>
                  </div>
                </div>
                <button
                  onClick={handleToggleFinancialValues}
                  className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/10 text-zinc-300 active:scale-95 transition-all"
                  aria-label="Alternar exibição de valores"
                >
                  {showFinancialValues ? <Eye className="w-4 h-4 text-emerald-400" /> : <EyeOff className="w-4 h-4 text-zinc-400" />}
                </button>
              </div>

              <div>
                <div className="text-3xl font-black text-white font-mono tracking-tight">
                  {formatMoney(48920)}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1 font-bold">
                    <TrendingUp className="w-3 h-3" /> +18.4% vs mês anterior
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400">Tempo real</span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between text-[11px] font-mono">
                <span className="text-zinc-400">Automação PIX + OTAs</span>
                <span className="text-emerald-400 flex items-center gap-1 font-bold">
                  <CheckCircle2 className="w-3 h-3" /> 100% Conciliado
                </span>
              </div>
            </div>

            {/* Widget Financeiro Yield Profit */}
            <MobileYieldProfitWidget
              niche="pousada"
              propertyName={propertyName}
              onNavigate={(tab) => setActiveTab(tab as any)}
              showValues={showFinancialValues}
            />

            {/* Grid de 4 Indicadores Estratégicos */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-1">
                <span className="text-[10px] font-mono text-zinc-400 uppercase">Diária Média (ADR)</span>
                <div className="text-base font-bold text-white font-mono">{formatMoney(580)}</div>
                <span className="text-[10px] font-mono text-emerald-400">+12% com Yield IA</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-1">
                <span className="text-[10px] font-mono text-zinc-400 uppercase">Taxa de Ocupação</span>
                <div className="text-base font-bold text-white font-mono">84.5%</div>
                <span className="text-[10px] font-mono text-cyan-400">Meta: 80% superada</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-1">
                <span className="text-[10px] font-mono text-zinc-400 uppercase">Lucro Extra Yield</span>
                <div className="text-base font-bold text-emerald-400 font-mono">{formatMoney(21450)}</div>
                <span className="text-[10px] font-mono text-zinc-400">Temporada 2026/27</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-1">
                <span className="text-[10px] font-mono text-zinc-400 uppercase">Economia de Taxas</span>
                <div className="text-base font-bold text-cyan-400 font-mono">{formatMoney(4549.50)}</div>
                <span className="text-[10px] font-mono text-zinc-400">PIX direto vs OTAs</span>
              </div>
            </div>

            {/* Distribuição por Canal (Share de Canais) */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span>CANAIS DE DISTRIBUIÇÃO & SHARE</span>
                </h3>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  62% Direto PIX
                </span>
              </div>

              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-white font-semibold">⚡ Direto no WhatsApp / PIX (0% Taxa)</span>
                    <span className="text-emerald-400 font-bold">{formatMoney(30330.40)} (62%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '62%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-zinc-300">🏨 Booking.com (15% Comissão)</span>
                    <span className="text-zinc-200">{formatMoney(10762.40)} (22%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: '22%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-zinc-300">🏡 Airbnb (15% Comissão)</span>
                    <span className="text-zinc-200">{formatMoney(5381.20)} (11%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full bg-rose-500 rounded-full" style={{ width: '11%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-zinc-400">🚶 Balcão / Walk-in</span>
                    <span className="text-zinc-400">{formatMoney(2446.00)} (5%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full bg-zinc-500 rounded-full" style={{ width: '5%' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Extrato Recente de Transações */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>ÚLTIMAS TRANSAÇÕES CONCILIADAS</span>
                </h3>
                <span className="text-[10px] font-mono text-zinc-400">Ao vivo</span>
              </div>

              <div className="space-y-2">
                {[
                  { id: 'tx-1', desc: 'Reserva Suíte Master 101 — 2 diárias', guest: 'Roberto Oliveira', method: 'PIX Direto', value: 1700, status: 'Confirmado', time: 'Há 12 min' },
                  { id: 'tx-2', desc: 'UPSELL Réveillon — Chalé Família 204', guest: 'Carlos Andrade', method: 'Link Cartão', value: 600, status: 'Confirmado', time: 'Há 45 min' },
                  { id: 'tx-3', desc: 'Reserva Quarto Standard 105', guest: 'Lucas Prado', method: 'PIX Direto', value: 900, status: 'Confirmado', time: 'Há 2h' },
                  { id: 'tx-4', desc: 'Devolução de Caução — Suíte Luxo 103', guest: 'Fernanda Lima', method: 'Estorno PIX', value: 400, status: 'Vistoria OK', time: 'Hoje 11:30' },
                ].map((tx) => (
                  <div key={tx.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white truncate max-w-[200px]">{tx.desc}</div>
                      <div className="text-[10px] font-mono text-zinc-400 flex items-center gap-1.5 mt-0.5">
                        <span>{tx.guest}</span>
                        <span>•</span>
                        <span className="text-emerald-400">{tx.method}</span>
                        <span>•</span>
                        <span>{tx.time}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-white">
                        {tx.method.includes('Estorno') ? `- ${formatMoney(tx.value)}` : `+ ${formatMoney(tx.value)}`}
                      </div>
                      <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        {tx.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ações Rápidas Financeiras */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => toast.success('Link de Cobrança PIX 1-clique gerado e copiado!')}
                className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 text-xs font-bold font-mono flex items-center justify-center gap-1.5 active:scale-95 transition-all"
              >
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                <span>+ Cobrança PIX</span>
              </button>

              <button
                onClick={() => toast.info('Exportando relatório financeiro completo da pousada...')}
                className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-zinc-200 hover:bg-white/[0.08] text-xs font-bold font-mono flex items-center justify-center gap-1.5 active:scale-95 transition-all"
              >
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                <span>Relatório Completo</span>
              </button>
            </div>

          </motion.div>
        )}

        {/* ABA 2: HÓSPEDES & CHECK-INS */}
        {activeTab === 'hospedes' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            
            <div className="flex items-center justify-between gap-3 pb-1">
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-white font-mono truncate">Hóspedes & Check-ins</h2>
                <p className="text-xs text-zinc-400 truncate">Controle de entrada, WhatsApp, Guia e Check-out</p>
              </div>
              <button
                onClick={() => setIsCheckInOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs font-mono flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.35)] active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Check-in</span>
              </button>
            </div>

            {/* Filtros */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {(['todos', 'whatsapp', 'direct', 'booking', 'airbnb'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setGuestFilter(filter)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold uppercase transition-all shrink-0 ${
                    guestFilter === filter
                      ? 'bg-emerald-500 text-[#0a0a0f] shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                      : 'bg-white/[0.04] text-zinc-400 border border-white/[0.08]'
                  }`}
                >
                  {filter === 'direct' ? 'Direct PIX' : filter}
                </button>
              ))}
            </div>

            {/* Lista Vertical de Cards de Hóspede (Bordas nítidas de alto contraste) */}
            <div className="space-y-3">
              {filteredGuests.map((guest) => {
                const cleanPhone = (guest.phone || '').replace(/\D/g, '');
                const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

                return (
                  <article
                    key={guest.id}
                    className="p-4 rounded-2xl bg-[#14141e] border-2 border-zinc-700/80 shadow-[0_4px_16px_rgba(0,0,0,0.4)] space-y-3 relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between border-b border-zinc-800 pb-2.5">
                      <div>
                        <h4 className="text-xs font-bold text-white font-mono">{guest.name}</h4>
                        <p className="text-[11px] font-mono text-emerald-400 font-semibold">{guest.room}</p>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold border ${
                        guest.status === 'CHECKED_OUT'
                          ? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                          : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      }`}>
                        {guest.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="block text-[10px] text-zinc-400 font-mono">Contato WhatsApp</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (typeof window !== 'undefined') {
                              window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(`Olá ${guest.name}, tudo bem? Aqui é da ${propertyName}!`)}`, '_blank');
                            }
                          }}
                          className="text-xs font-mono text-emerald-400 hover:underline flex items-center gap-1 font-bold mt-0.5"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{guest.phone}</span>
                        </button>
                      </div>
                      <div>
                        <span className="block text-[10px] text-zinc-400 font-mono">Origem Reserva</span>
                        <span className="text-xs font-mono font-bold text-zinc-200 mt-0.5 block">{guest.origin}</span>
                      </div>
                    </div>

                    <div className="pt-2.5 grid grid-cols-3 gap-2 border-t border-zinc-800">
                      <button
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(`Olá ${guest.name}! Segue o link do seu Guia Digital da ${propertyName} com chave PIX e detalhes da sua hospedagem: https://smart-hotel-zehla.vercel.app/guia`)}`, '_blank');
                          }
                          toast.success(`📱 Guia Digital com PIX enviado para ${guest.name} no WhatsApp!`);
                        }}
                        className="py-2.5 px-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center justify-center gap-1 min-h-[44px] active:scale-95 transition-all cursor-pointer"
                        title="Enviar Guia Digital WhatsApp"
                      >
                        <Send className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Guia Whats</span>
                      </button>

                      <button
                        onClick={() => {
                          const targetRoom = rooms.find((r) => r.name === guest.room) || rooms[0];
                          handleRemoteUnlock(targetRoom.id, targetRoom.name);
                        }}
                        className="py-2.5 px-2 rounded-xl bg-white/[0.06] hover:bg-white/10 border border-white/[0.15] text-zinc-200 text-[11px] font-bold flex items-center justify-center gap-1 min-h-[44px] active:scale-95 transition-all cursor-pointer"
                        title="Destrancar Fechadura"
                      >
                        <Key className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="truncate">Abrir Porta</span>
                      </button>

                      <button
                        onClick={() => handleCheckOut(guest.id, guest.name, guest.room)}
                        disabled={guest.status === 'CHECKED_OUT'}
                        className={`py-2.5 px-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 min-h-[44px] active:scale-95 transition-all cursor-pointer ${
                          guest.status === 'CHECKED_OUT'
                            ? 'bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed'
                            : 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/30 text-rose-300'
                        }`}
                        title="Realizar Check-out do Hóspede"
                      >
                        <LogOut className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{guest.status === 'CHECKED_OUT' ? 'Encerrado' : 'Check-out'}</span>
                      </button>
                    </div>
                  </article>
                );
              })}
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
                  SINCRONIZADO
                </span>
              </div>

              {/* Seletor do Feriado */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase text-zinc-400">Selecione o Feriado / Data de Pico</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(holidaysConfig).map(([key, config]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedHoliday(key as any)}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                        selectedHoliday === key
                          ? 'bg-amber-500/20 border-amber-500/50 text-white shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                          : 'bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:text-white'
                      }`}
                    >
                      <div className="font-bold text-[11px] truncate">{config.name}</div>
                      <div className="text-[9px] font-mono text-zinc-500">{config.dates} ({config.nights} noites)</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Slider de Aumento de Diária */}
              <div className="bg-black/40 p-3 rounded-2xl border border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-zinc-300">Aumento por Diária:</span>
                  <span className="text-sm font-mono font-extrabold text-amber-400">+R$ {dailyIncrease}</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="600"
                  step="25"
                  value={dailyIncrease}
                  onChange={(e) => setDailyIncrease(parseInt(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer h-2 bg-zinc-800 rounded-lg"
                />
                <div className="flex justify-between text-[9px] font-mono text-zinc-500">
                  <span>+R$ 50/dia</span>
                  <span>+R$ 300/dia</span>
                  <span>+R$ 600/dia</span>
                </div>
              </div>

              {/* Simulação Canônica (93% Pousada / 7% Zélla) */}
              <div className="grid grid-cols-2 gap-2 bg-white/[0.02] p-3 rounded-2xl border border-white/[0.04] text-xs font-mono">
                <div>
                  <span className="text-[10px] text-zinc-500 block">Lucro Extra Pousada (93%)</span>
                  <span className="text-sm font-bold text-emerald-400">R$ {pousadaUpsellProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 block">Taxa Sucesso Zélla (7%)</span>
                  <span className="text-sm font-bold text-amber-400">R$ {zellaUpsellFee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
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

        {/* ABA 4: FECHADURAS INTELIGENTES & GOVERNANÇA (10 MARCAS BR & FAIL-CLOSED) */}
        {activeTab === 'fechaduras' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3.5">
            
            {/* Header & Botão Parear */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white font-mono">Fechaduras & Governança</h2>
                <p className="text-[11px] text-zinc-400">10 Marcas do Mercado BR · Zero-Trust Fail-Closed</p>
              </div>
              <button
                onClick={() => {
                  setPairingStep(1);
                  setIsPairingModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-extrabold text-xs font-mono flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Parear</span>
              </button>
            </div>

            {/* PROTOCOLO FAIL-CLOSED & ZERO-TRUST BADGE */}
            <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-emerald-950/20 to-black/60 border border-emerald-500/30 text-xs text-emerald-200 space-y-1.5 relative overflow-hidden shadow-[0_0_20px_rgba(16,185,129,0.08)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-emerald-300 font-mono text-[11px]">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>PROTOCOLO FAIL-CLOSED ATIVO</span>
                </div>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                  ZERO PIN FALSO
                </span>
              </div>
              <p className="text-[10px] text-zinc-300 leading-relaxed font-mono">
                PINs emitidos exclusivamente após confirmação de reserva/pagamento. Ativação automática 15 min antes do check-in. Isolamento multi-tenant e tokens com Nonce anti-CSRF.
              </p>
            </div>

            {/* KPIs Métricos das 10 Marcas */}
            <div className="grid grid-cols-4 gap-2">
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-center">
                <span className="block text-[9px] font-mono text-zinc-500 uppercase">Total</span>
                <span className="text-sm font-extrabold text-white font-mono">{rooms.length}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-center">
                <span className="block text-[9px] font-mono text-emerald-400 uppercase">API Nuvem</span>
                <span className="text-sm font-extrabold text-emerald-400 font-mono">
                  {rooms.filter((r) => r.providerType === 'api').length}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-center">
                <span className="block text-[9px] font-mono text-blue-400 uppercase">Manual</span>
                <span className="text-sm font-extrabold text-blue-400 font-mono">
                  {rooms.filter((r) => r.providerType === 'manual').length}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-center">
                <span className="block text-[9px] font-mono text-rose-400 uppercase">Bateria &lt;20%</span>
                <span className={`text-sm font-extrabold font-mono ${rooms.some((r) => r.lockBattery < 20) ? 'text-rose-400 animate-pulse' : 'text-zinc-400'}`}>
                  {rooms.filter((r) => r.lockBattery < 20).length}
                </span>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-mono">
              <button
                onClick={() => setLockFilter('all')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap border transition-all ${
                  lockFilter === 'all'
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-white font-bold'
                    : 'bg-white/[0.02] border-white/[0.06] text-zinc-400'
                }`}
              >
                Todas ({rooms.length})
              </button>
              <button
                onClick={() => setLockFilter('api')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap border transition-all ${
                  lockFilter === 'api'
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold'
                    : 'bg-white/[0.02] border-white/[0.06] text-zinc-400'
                }`}
              >
                ⚡ API Nuvem ({rooms.filter((r) => r.providerType === 'api').length})
              </button>
              <button
                onClick={() => setLockFilter('manual')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap border transition-all ${
                  lockFilter === 'manual'
                    ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 font-bold'
                    : 'bg-white/[0.02] border-white/[0.06] text-zinc-400'
                }`}
              >
                🇧🇷 Modo Manual ({rooms.filter((r) => r.providerType === 'manual').length})
              </button>
              <button
                onClick={() => setLockFilter('battery')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap border transition-all ${
                  lockFilter === 'battery'
                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 font-bold'
                    : 'bg-white/[0.02] border-white/[0.06] text-zinc-400'
                }`}
              >
                ⚠️ Bateria Baixa ({rooms.filter((r) => r.lockBattery < 20).length})
              </button>
            </div>

            {/* Grid de Fechaduras Eletrônicas das 10 Marcas */}
            <div className="space-y-3">
              {rooms
                .filter((r) => {
                  if (lockFilter === 'api') return r.providerType === 'api';
                  if (lockFilter === 'manual') return r.providerType === 'manual';
                  if (lockFilter === 'battery') return r.lockBattery < 20;
                  if (lockFilter === 'pairing') return r.pairingStatus === 'pairing' || r.pairingStatus === 'registered';
                  return true;
                })
                .map((room) => {
                  const brandInfo = getBrandInfo(room.brand);
                  const isApi = room.providerType === 'api';
                  const isCriticalBattery = room.lockBattery < 20;

                  return (
                    <div
                      key={room.id}
                      className="p-3.5 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] space-y-3 relative overflow-hidden"
                    >
                      {/* Top row: Room name + Brand & Model */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-lg shrink-0">
                            {brandInfo?.logo || '🔐'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-xs font-bold text-white">{room.name}</h4>
                              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                                room.status === 'ocupado'
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                  : room.status === 'livre'
                                  ? 'bg-zinc-500/10 border-zinc-500/30 text-zinc-400'
                                  : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                              }`}>
                                {room.status.toUpperCase()}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] font-mono text-zinc-400">
                              <span className="text-zinc-300 font-bold">{brandInfo?.label || room.brand}</span>
                              <span>·</span>
                              <span>{room.lockModel}</span>
                            </div>
                          </div>
                        </div>

                        {/* Battery status */}
                        <div className={`flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-1 rounded-lg border ${
                          isCriticalBattery
                            ? 'bg-rose-500/15 border-rose-500/30 text-rose-400 animate-pulse'
                            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        }`}>
                          <Battery className="w-3.5 h-3.5" />
                          <span>{room.lockBattery}%</span>
                        </div>
                      </div>

                      {/* Staged Pairing & Provider Status */}
                      <div className="flex items-center justify-between text-[10px] font-mono pt-1 border-t border-white/[0.04]">
                        <div className="flex items-center gap-1.5">
                          {room.pairingStatus === 'connected' ? (
                            <span className="text-emerald-400 flex items-center gap-1 font-bold">
                              <CheckCircle2 className="w-3 h-3" /> Provider Ready
                            </span>
                          ) : (
                            <span className="text-amber-400 flex items-center gap-1 font-bold">
                              <RefreshCw className="w-3 h-3 animate-spin" /> Pareamento BLE/WiFi
                            </span>
                          )}
                          <span className="text-zinc-600">|</span>
                          {isApi ? (
                            <span className="text-emerald-300 flex items-center gap-0.5">
                              <Zap className="w-2.5 h-2.5" /> API Cloud
                            </span>
                          ) : (
                            <span className="text-zinc-400 flex items-center gap-0.5">
                              <Cpu className="w-2.5 h-2.5" /> Manual Offline
                            </span>
                          )}
                        </div>

                        {isCriticalBattery && (
                          <button
                            onClick={() => toast.success(`🔋 Ordem de troca de pilhas emitida para a governança (${room.name})`)}
                            className="text-rose-400 text-[9px] underline font-bold"
                          >
                            Pedir Troca
                          </button>
                        )}
                      </div>

                      {/* PIN Box with Temporal Access Window */}
                      <div className="bg-black/40 p-3 rounded-xl border border-white/[0.06] space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="block text-[9px] font-mono text-zinc-500 uppercase">
                              PIN Digital do Hóspede ({room.guest || 'Aguardando'})
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-base font-extrabold text-amber-400 tracking-wider">
                                {room.pin}#
                              </span>
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                {room.pinStatus === 'active' ? 'ATIVO' : 'AGENDADO (-15m)'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`${room.pin}#`);
                                toast.success(`📋 PIN ${room.pin}# copiado!`);
                              }}
                              className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/10 text-zinc-300 text-xs active:scale-95"
                              title="Copiar PIN"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleGenerateNewPin(room.id, room.name)}
                              className="px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/10 text-zinc-300 text-[10px] font-mono active:scale-95"
                            >
                              Novo PIN
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400 pt-1 border-t border-white/[0.04]">
                          <span className="flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-zinc-500" />
                            Janela: {room.pinValidFrom} → {room.pinValidTo}
                          </span>
                          <span className="text-zinc-500">Teclado: Digite PIN + #</span>
                        </div>
                      </div>

                      {/* Action Buttons: WhatsApp 1-Clique, Destrancar, Pânico, Faxina */}
                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        <button
                          onClick={() => setSelectedLockForWhatsApp(room)}
                          className="py-2.5 px-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold font-mono flex items-center justify-center gap-1 min-h-[44px] active:scale-95 transition-all"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </button>

                        <button
                          onClick={() => handleRemoteUnlock(room.id, room.name, room.brand, room.providerType)}
                          disabled={unlockingRoomId === room.id}
                          className="py-2.5 px-2 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 text-[11px] font-bold font-mono flex items-center justify-center gap-1 min-h-[44px] active:scale-95 transition-all"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          <span>{unlockingRoomId === room.id ? 'Abrindo...' : 'Destrancar'}</span>
                        </button>

                        <button
                          onClick={() => setSelectedLockForPanic(room)}
                          className="py-2.5 px-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-[11px] font-bold font-mono flex items-center justify-center gap-1 min-h-[44px] active:scale-95 transition-all"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Pânico</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>

          </motion.div>
        )}

        {/* ABA 6: WHATSAPP LIVE FEED */}
        {activeTab === 'whats_live' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white font-mono">WhatsApp Live Feed</h2>
                <p className="text-xs text-zinc-400">Atendimento autônomo 24h pelo Motor Seu Zélla</p>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            {/* Aviso de Intervenção Humana Segura */}
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                <ShieldCheck className="w-4 h-4" />
                <span>Intervenção Humana Conforme Termos de Uso</span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                Ao clicar em <strong>Assumir Chat</strong>, você atende diretamente pelo WhatsApp. Conforme os Termos de Uso, intervenções diretas não alteram sua mensalidade ou regras. Clique em <strong>Zélla assume</strong> para restabelecer a IA.
              </p>
            </div>

            <div className="space-y-2.5">
              {whatsLiveConversations.map((conv) => {
                const isAssumed = assumedChatIds.includes(conv.id);

                return (
                  <div
                    key={conv.id}
                    className={`p-3.5 rounded-2xl border space-y-2 relative overflow-hidden transition-all ${
                      isAssumed
                        ? 'bg-amber-500/10 border-amber-500/40'
                        : 'bg-white/[0.03] border-white/[0.08]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-xs text-white">{conv.guestName} ({conv.room})</div>
                      <span className="text-[10px] font-mono text-zinc-500">{conv.time}</span>
                    </div>
                    <p className="text-xs text-zinc-300 bg-black/30 p-2.5 rounded-xl border border-white/[0.04]">
                      "{conv.lastMsg}"
                    </p>
                    <div className="flex items-center justify-between pt-1 text-[10px] font-mono">
                      {isAssumed ? (
                        <span className="text-amber-400 font-bold flex items-center gap-1">
                          ⚠️ Atendimento Humano Ativo
                        </span>
                      ) : (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCheck className="w-3.5 h-3.5" /> Respondido pelo Motor Zélla
                        </span>
                      )}

                      {isAssumed ? (
                        <button
                          onClick={() => handleResumeZella(conv.id, conv.guestName)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs font-mono flex items-center gap-1 active:scale-95 shadow-[0_0_12px_rgba(16,185,129,0.3)] transition-all"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Zélla assume</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAssumeChat(conv)}
                          className="px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/20 text-zinc-200 font-bold text-xs font-mono flex items-center gap-1 active:scale-95 border border-white/[0.1] transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Assumir Chat</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          </motion.div>
        )}

        {/* ABA 7: MAIS & SIMULADOR */}
        {activeTab === 'mais' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            
            {/* Links Rápidos e Termos de Uso */}
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-white font-mono flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>CENTRAL LEGAL & SUPORTE</span>
              </h3>
              
              <div className="grid grid-cols-2 gap-2">
                <a
                  href="/legal/termos-uso"
                  target="_blank"
                  className="p-3 rounded-xl bg-white/[0.04] hover:bg-white/10 border border-white/[0.08] text-xs font-mono font-bold text-zinc-200 flex items-center justify-between"
                >
                  <span>Termos de Uso</span>
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                </a>

                <a
                  href="https://wa.me/5511999990000?text=Ol%C3%A1%2C%20preciso%20de%20suporte%20Seu%20Z%C3%A9lla"
                  target="_blank"
                  className="p-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-mono font-bold text-emerald-300 flex items-center justify-between"
                >
                  <span>Suporte 24h</span>
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                </a>
              </div>
            </div>

            {/* Acessibilidade de Fontes (85%, 100%, 115%, 140%) */}
            <div className="bg-white/[0.03] backdrop-blur-xl border border-emerald-500/30 rounded-3xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                <div className="flex items-center gap-2">
                  <Type className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-white font-mono">TAMANHO DA FONTE</h3>
                </div>
                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-bold">
                  {fontScale === 0.85 ? '85% · PEQUENO' : fontScale === 1.15 ? '115% · GRANDE' : fontScale === 1.4 ? '140% · EXTRA' : '100% · PADRÃO'}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSetFontScale(0.85)}
                  className={`py-2.5 rounded-xl border font-mono text-xs font-bold transition-all active:scale-95 ${
                    fontScale === 0.85 ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-[0_0_10px_#10b981]' : 'bg-white/[0.03] text-zinc-300 border-white/[0.08]'
                  }`}
                >
                  85%
                </button>
                <button
                  type="button"
                  onClick={() => handleSetFontScale(1)}
                  className={`py-2.5 rounded-xl border font-mono text-xs font-bold transition-all active:scale-95 ${
                    fontScale === 1 ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-[0_0_10px_#10b981]' : 'bg-white/[0.03] text-zinc-300 border-white/[0.08]'
                  }`}
                >
                  100%
                </button>
                <button
                  type="button"
                  onClick={() => handleSetFontScale(1.15)}
                  className={`py-2.5 rounded-xl border font-mono text-xs font-bold transition-all active:scale-95 ${
                    fontScale === 1.15 ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-[0_0_10px_#10b981]' : 'bg-white/[0.03] text-zinc-300 border-white/[0.08]'
                  }`}
                >
                  115%
                </button>
                <button
                  type="button"
                  onClick={() => handleSetFontScale(1.4)}
                  className={`py-2.5 rounded-xl border font-mono text-xs font-bold transition-all active:scale-95 ${
                    fontScale === 1.4 ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-[0_0_10px_#10b981]' : 'bg-white/[0.03] text-zinc-300 border-white/[0.08]'
                  }`}
                >
                  140%
                </button>
              </div>
              <p className="text-[10px] text-zinc-400 font-mono">
                Toque para aumentar as letras instantaneamente e melhorar a visibilidade no celular.
              </p>
            </div>

            {/* Chat Box: GUIA & ESPECIALISTA OPERACIONAL DDC MOBILE SEU ZÉLLA (Com travas) */}
            <div className="bg-white/[0.03] backdrop-blur-xl border border-emerald-500/20 rounded-3xl p-4 space-y-3 flex flex-col h-[400px]">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 text-[10px] font-mono">
                <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                  <Brain className="w-3.5 h-3.5" />
                  <span>GUIA OPERACIONAL DO DDC MOBILE</span>
                </div>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold">
                  TRAVAS ATIVAS
                </span>
              </div>

              {/* Sugestões Rápidas de Operação */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-[10px] font-mono">
                <button
                  type="button"
                  onClick={() => handleSendSimulatedMsg(undefined, 'Como parear fechadura?')}
                  className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-emerald-500/10 border border-white/[0.08] text-zinc-300 whitespace-nowrap active:scale-95"
                >
                  🔑 Parear Fechadura
                </button>
                <button
                  type="button"
                  onClick={() => handleSendSimulatedMsg(undefined, 'Como funciona o UPSELL 7%?')}
                  className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-amber-500/10 border border-white/[0.08] text-zinc-300 whitespace-nowrap active:scale-95"
                >
                  ⚡ UPSELL 7%
                </button>
                <button
                  type="button"
                  onClick={() => handleSendSimulatedMsg(undefined, 'Como enviar PIN no WhatsApp?')}
                  className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-emerald-500/10 border border-white/[0.08] text-zinc-300 whitespace-nowrap active:scale-95"
                >
                  📲 Enviar PIN WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => handleSendSimulatedMsg(undefined, 'Como economizar a taxa de 15%?')}
                  className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-cyan-500/10 border border-white/[0.08] text-zinc-300 whitespace-nowrap active:scale-95"
                >
                  💰 Economia 15% OTAs
                </button>
                <button
                  type="button"
                  onClick={() => handleSendSimulatedMsg(undefined, 'Como funciona a Revogação de Pânico?')}
                  className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-rose-500/10 border border-white/[0.08] text-zinc-300 whitespace-nowrap active:scale-95"
                >
                  🚨 Pânico
                </button>
              </div>

              {/* Área de Mensagens */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 no-scrollbar text-xs">
                {chatLog.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col max-w-[88%] ${
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
                  placeholder="Pergunte sobre fechaduras, financeiro, UPSELL, check-in..."
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

        {/* Tab 2: Financeiro */}
        <button
          onClick={() => setActiveTab('financeiro')}
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${
            activeTab === 'financeiro' ? 'text-emerald-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <DollarSign className="w-5 h-5" />
          <span className="text-[9px] font-mono">Financeiro</span>
        </button>

        {/* Tab 3: Hóspedes */}
        <button
          onClick={() => setActiveTab('hospedes')}
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${
            activeTab === 'hospedes' ? 'text-emerald-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[9px] font-mono">Hóspedes</span>
        </button>

        {/* Tab 4: UPSELL */}
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

        {/* Tab 5: Fechaduras */}
        <button
          onClick={() => setActiveTab('fechaduras')}
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${
            activeTab === 'fechaduras' ? 'text-emerald-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <KeyRound className="w-5 h-5" />
          <span className="text-[9px] font-mono">Fechaduras</span>
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
                    onClick={() => { setActiveTab('financeiro'); setIsMenuOpen(false); }}
                    className="w-full p-2.5 rounded-lg flex items-center gap-3 text-xs font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all text-left border border-emerald-500/20"
                  >
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    <span>💰 Visão Financeira & Faturamento</span>
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
          7. SHEET CENTRAL DE NOTIFICAÇÕES (Canônica & Alinhada com DDC)
      ── */}
      <DDCNotificationCenter
        open={isNotificationsOpen}
        onOpenChange={setIsNotificationsOpen}
        niche="pousada"
      />

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

      {/* ──
          9. MODAL PAREAMENTO EM 3 ESTÁGIOS (10 MARCAS BR)
      ── */}
      <AnimatePresence>
        {isPairingModalOpen && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-[#13131a] border border-emerald-500/30 rounded-3xl p-5 space-y-4 shadow-[0_0_35px_rgba(16,185,129,0.2)] max-h-[90vh] overflow-y-auto"
            >
              {/* Header com etapas */}
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h3 className="font-bold text-sm text-white font-mono uppercase">Parear Fechadura</h3>
                    <span className="text-[10px] text-zinc-400 font-mono">Etapa {pairingStep} de 3 · Staged Pairing</span>
                  </div>
                </div>
                <button onClick={() => setIsPairingModalOpen(false)} className="text-zinc-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Step 1: Escolha da Marca (10 Marcas) */}
              {pairingStep === 1 && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-300">
                    Selecione a fabricante da fechadura instalada na porta:
                  </p>

                  <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                    {listAllBrands().map((brand) => (
                      <button
                        key={brand.id}
                        type="button"
                        onClick={() => setPairingBrand(brand.id)}
                        className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                          pairingBrand === brand.id
                            ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                            : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-base">{brand.logo}</span>
                          <span className={`text-[8px] font-mono px-1 py-0.2 rounded font-bold uppercase ${
                            brand.apiAvailable
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {brand.apiAvailable ? 'API' : 'Manual'}
                          </span>
                        </div>
                        <div className="font-bold text-xs mt-1 text-white truncate">{brand.label}</div>
                        <div className="text-[9px] font-mono text-zinc-500 truncate">{brand.popularModels[0]}</div>
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setPairingStep(2)}
                    className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold font-mono text-xs shadow-[0_0_15px_#10b981] active:scale-95 transition-all"
                  >
                    Avançar para Vinculação &gt;
                  </button>
                </div>
              )}

              {/* Step 2: Quarto & Hardware ID */}
              {pairingStep === 2 && (
                <div className="space-y-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200">
                    <span className="font-bold">Marca Selecionada:</span> {getBrandInfo(pairingBrand)?.label} ({getBrandInfo(pairingBrand)?.apiAvailable ? 'API Nuvem' : 'Manual Offline'})
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-zinc-400 uppercase">Nome da Unidade / Quarto *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Suíte Presidencial 301"
                      value={pairingRoomName}
                      onChange={(e) => setPairingRoomName(e.target.value)}
                      className="w-full mt-1 bg-white/[0.04] border border-white/[0.1] rounded-xl p-2.5 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-zinc-400 uppercase">
                      {getBrandInfo(pairingBrand)?.apiAvailable ? 'Device ID / MAC Bluetooth *' : 'Código Serial / Identificador (Opcional)'}
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: LOCK-7721-BLE ou IFR-7000-01"
                      value={pairingDeviceId}
                      onChange={(e) => setPairingDeviceId(e.target.value)}
                      className="w-full mt-1 bg-white/[0.04] border border-white/[0.1] rounded-xl p-2.5 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 outline-none font-mono"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setPairingStep(1)}
                      className="flex-1 p-2.5 rounded-xl bg-white/[0.04] text-zinc-300 font-bold text-xs"
                    >
                      &lt; Voltar
                    </button>
                    <button
                      type="button"
                      onClick={() => setPairingStep(3)}
                      className="flex-1 p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold font-mono text-xs shadow-[0_0_15px_#10b981]"
                    >
                      Verificar &gt;
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Teste Fail-Closed & Conclusão */}
              {pairingStep === 3 && (
                <div className="space-y-3.5 text-center">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <ShieldCheck className="w-7 h-7" />
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-white font-mono">Pronto para Pareamento!</h4>
                    <p className="text-xs text-zinc-400 mt-1">
                      O motor Zélla validou as credenciais fail-closed e a fechadura <strong>{getBrandInfo(pairingBrand)?.label}</strong> será integrada à governança de <strong>{pairingRoomName}</strong>.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] text-left text-[11px] font-mono space-y-1 text-zinc-300">
                    <div><strong>Quarto:</strong> {pairingRoomName}</div>
                    <div><strong>Fabricante:</strong> {getBrandInfo(pairingBrand)?.label}</div>
                    <div><strong>Tipo de PIN:</strong> {getBrandInfo(pairingBrand)?.offlinePinSupported ? 'Online & Offline Algorítmico' : 'Online Temporário'}</div>
                    <div><strong>Segurança:</strong> Zero PIN Simulado · Fail-Closed</div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setPairingStep(2)}
                      className="flex-1 p-2.5 rounded-xl bg-white/[0.04] text-zinc-300 font-bold text-xs"
                    >
                      &lt; Voltar
                    </button>
                    <button
                      type="button"
                      onClick={handlePairNewLock}
                      className="flex-1 p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-mono font-extrabold text-xs shadow-[0_0_20px_#10b981] active:scale-95 transition-all"
                    >
                      Concluir Pareamento
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ──
          10. MODAL REVOGAÇÃO DE PÂNICO (FAIL-CLOSED)
      ── */}
      <AnimatePresence>
        {selectedLockForPanic && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-[#181115] border border-rose-500/40 rounded-3xl p-5 space-y-4 shadow-[0_0_35px_rgba(244,63,94,0.25)]"
            >
              <div className="flex items-center gap-3 border-b border-rose-500/20 pb-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-rose-200 font-mono">REVOGAÇÃO DE PÂNICO</h3>
                  <span className="text-[10px] text-rose-400 font-mono">{selectedLockForPanic.name}</span>
                </div>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">
                Você tem certeza que deseja revogar <strong>imediatamente</strong> o PIN do hóspede ({selectedLockForPanic.guest || 'Hóspede Atual'})? A fechadura será bloqueada e o PIN atual deixará de funcionar na mesma hora.
              </p>

              <div className="p-3 rounded-xl bg-black/40 border border-rose-500/20 text-[11px] font-mono text-rose-300">
                ⚠️ Protocolo Fail-Closed: Qualquer acesso não autorizado será rejeitado no teclado físico.
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedLockForPanic(null)}
                  className="flex-1 p-2.5 rounded-xl bg-white/[0.05] text-zinc-300 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handlePanicRevoke(selectedLockForPanic.id, selectedLockForPanic.name)}
                  className="flex-1 p-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-mono font-extrabold text-xs shadow-[0_0_15px_rgba(244,63,94,0.4)] active:scale-95"
                >
                  Confirmar Revogação
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ──
          11. MODAL DISPARO WHATSAPP DO PIN
      ── */}
      <AnimatePresence>
        {selectedLockForWhatsApp && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-[#13131a] border border-emerald-500/30 rounded-3xl p-5 space-y-4 shadow-[0_0_35px_rgba(16,185,129,0.2)]"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2">
                  <Send className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-sm text-white font-mono">DISPARAR PIN VIA WHATSAPP</h3>
                </div>
                <button onClick={() => setSelectedLockForWhatsApp(null)} className="text-zinc-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-mono text-zinc-400 uppercase">Preview da Mensagem Oficial</span>
                <div className="p-3.5 rounded-2xl bg-black/50 border border-emerald-500/20 text-xs text-zinc-200 font-mono space-y-2 leading-relaxed">
                  <div className="text-emerald-400 font-bold">🏨 {propertyName} — Acesso Liberado!</div>
                  <div>Olá, {selectedLockForWhatsApp.guest || 'Hóspede'}!</div>
                  <div>Sua acomodação: <strong>{selectedLockForWhatsApp.name}</strong></div>
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-bold">
                    🔑 Seu PIN: {selectedLockForWhatsApp.pin}#
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    ⏰ Janela de Validade: {selectedLockForWhatsApp.pinValidFrom} às {selectedLockForWhatsApp.pinValidTo}
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    Digite os 6 dígitos seguidos de # na fechadura. Tenha uma ótima estadia!
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedLockForWhatsApp(null)}
                  className="flex-1 p-2.5 rounded-xl bg-white/[0.04] text-zinc-300 font-bold text-xs"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => handleSendWhatsAppPin(selectedLockForWhatsApp)}
                  className="flex-1 p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-mono font-extrabold text-xs shadow-[0_0_20px_#10b981] flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar Agora</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
