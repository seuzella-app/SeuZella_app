'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { DDCShell, type NavItem } from '@/components/ddc/DDCShell';
import { NotificationFAB } from '@/components/ddc/notifications/NotificationFAB';
import { MagicScanner, type MagicScanResult } from '@/components/ddc/MagicScanner';
import { ZellaSimulator } from '@/components/ddc/ZellaSimulator';
import { WhatsAppDeviceManager } from '@/components/ddc/WhatsAppDeviceManager';
import { GuestGuidePanel } from '@/components/ddc/GuestGuidePanel';
import { BookingSyncPanel } from '@/components/ddc/BookingSyncPanel';
import { LinkInBioEditor } from '@/components/linkinbio/LinkInBioEditor';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  RefreshCw,
  Bot,
  Settings,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ChevronRight,
  Star,
  Zap,
  Plus,
  Home,
  Trophy,
  CalendarDays,
  Activity,
  MessageSquare,
  Shield,
  CircleCheck,
  CircleX,
  Circle,
  Bell,
  Key,
  Crown,
  Sparkles,
  MapPin,
  Wifi,
  Smartphone,
  QrCode,
  Users,
  CreditCard,
  Link as LinkIcon,
  Gift,
  BarChart2,
  Building2,
  Coins,
  LayoutDashboard,
} from 'lucide-react';
import { CreditsTab } from '@/components/ddc/credits/CreditsTab';
import { BITab } from '@/components/ddc/BITab';
import { MultiPropertiesTab } from '@/components/ddc/MultiPropertiesTab';
import { LocksTab } from '@/components/ddc/LocksTab';
import { ConquistasTab } from '@/components/ddc/conquistas/ConquistasTab';
import { DDCUpsellTab } from '@/components/ddc/DDCUpsellTab';
import { useCurrentPlan } from '@/lib/hooks/use-current-plan';

// ── Types 

type AirbnbTab = 'financeiro' | 'upsell' | 'propriedades' | 'sincronizacao' | 'automacao' | 'simulador' | 'whatsapp' | 'linkinbio' | 'guia' | 'config' | 'creditos' | 'bi' | 'properties' | 'fechaduras' | 'conquistas';

interface PropertyData {
  id: string;
  name: string;
  location: string;
  connected: boolean;
  occupancy: number;
  rating: number;
  reviews: number;
  revenue: number;
}

interface CalendarDay {
  day: number;
  status: 'booked' | 'blocked' | 'available' | 'past';
  guest?: string;
}

interface SyncSource {
  name: string;
  icon: string;
  status: 'synced' | 'disconnected';
  lastSync: string;
}

interface AutomationLog {
  id: string;
  action: string;
  detail: string;
  time: string;
  type: 'auto-reply' | 'instruction' | 'update' | 'reminder';
}

// ── Mock Data 

const MOCK_PROPERTIES: PropertyData[] = [
  {
    id: '1',
    name: 'Apartamento Vista Mar — Copacabana',
    location: 'Copacabana, Rio de Janeiro, RJ',
    connected: true,
    occupancy: 84,
    rating: 4.96,
    reviews: 214,
    revenue: 8450,
  },
  {
    id: '2',
    name: 'Chalé Campos do Jordão',
    location: 'Campos do Jordão, SP',
    connected: true,
    occupancy: 72,
    rating: 4.85,
    reviews: 156,
    revenue: 6280,
  },
  {
    id: '3',
    name: 'Studio Paulista',
    location: 'São Paulo, SP',
    connected: false,
    occupancy: 63,
    rating: 4.78,
    reviews: 89,
    revenue: 3920,
  },
];

const REVENUE_TREND_DATA = [
  { day: '01', receita: 1200 },
  { day: '05', receita: 2400 },
  { day: '10', receita: 3800 },
  { day: '15', receita: 5100 },
  { day: '20', receita: 7200 },
  { day: '25', receita: 12450 },
  { day: '30', receita: 18650 },
];

const PAYMENT_METHOD_DATA = [
  { name: 'PIX Direto (0% Taxa)', value: 68, color: '#10b981' },
  { name: 'Airbnb / OTAs', value: 24, color: '#3b82f6' },
  { name: 'Cartão de Crédito', value: 8, color: '#f59e0b' },
];

const MOCK_SYNC_SOURCES: SyncSource[] = [
  { name: 'Airbnb iCal', icon: '🏠', status: 'synced', lastSync: '2min' },
  { name: 'Booking.com iCal', icon: '🔵', status: 'synced', lastSync: '5min' },
  { name: 'Google Calendar', icon: '📅', status: 'disconnected', lastSync: '' },
];

const MOCK_AUTOMATION_LOG: AutomationLog[] = [
  { id: '1', action: 'Resposta automática enviada', detail: 'para Marcos', time: '2min atrás', type: 'auto-reply' },
  { id: '2', action: 'Instruções de check-in enviadas', detail: 'para Ana', time: '15min atrás', type: 'instruction' },
  { id: '3', action: 'Disponibilidade atualizada no Airbnb', detail: 'Flat Copacabana', time: '1h atrás', type: 'update' },
  { id: '4', action: 'Lembrete de review enviado', detail: 'para João', time: '3h atrás', type: 'reminder' },
  { id: '5', action: 'Resposta automática enviada', detail: 'para Carla', time: '5h atrás', type: 'auto-reply' },
  { id: '6', action: 'Preço atualizado automaticamente', detail: 'Chalé Campos do Jordão', time: '6h atrás', type: 'update' },
];

const RESPONSE_TIME_DATA = [
  { day: 'Seg', seconds: 62 },
  { day: 'Ter', seconds: 55 },
  { day: 'Qua', seconds: 48 },
  { day: 'Qui', seconds: 51 },
  { day: 'Sex', seconds: 39 },
  { day: 'Sáb', seconds: 44 },
  { day: 'Dom', seconds: 47 },
];

// ── Calendar Helper 

function generateCalendarDays(): CalendarDay[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();

  const days: CalendarDay[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    if (d < today) {
      days.push({ day: d, status: 'past' });
    } else if (d === today || d === today + 3 || d === today + 7 || d === today + 8) {
      days.push({ day: d, status: 'booked', guest: d === today ? 'Ana S.' : d === today + 3 ? 'Marcos L.' : d === today + 7 ? 'João P.' : 'Carla M.' });
    } else if (d === today + 1 || d === today + 10) {
      days.push({ day: d, status: 'blocked' });
    } else {
      days.push({ day: d, status: 'available' });
    }
  }
  return days;
}

// ── Chart Config 

const responseTimeChartConfig: ChartConfig = {
  seconds: {
    label: 'Segundos',
    color: '#3b82f6',
  },
};

const revenueChartConfig: ChartConfig = {
  receita: {
    label: 'Receita (R$)',
    color: '#3b82f6',
  },
};

const paymentChartConfig: ChartConfig = {
  pix: { label: 'PIX Direto', color: '#10b981' },
  ota: { label: 'Airbnb / OTAs', color: '#3b82f6' },
  card: { label: 'Cartão', color: '#f59e0b' },
};

// ── Animation Variants 

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

// ── Sidebar Navigation Items 

const airbnbNavItems: NavItem[] = [
  { id: 'financeiro', label: 'Painel Financeiro', icon: <LayoutDashboard className="size-4" /> },
  { id: 'upsell', label: 'UPSELL & Feriados (7%)', icon: <TrendingUp className="size-4 text-emerald-400" /> },
  { id: 'propriedades', label: 'Imóveis & Ocupação', icon: <Building2 className="size-4" /> },
  { id: 'sincronizacao', label: 'Sincronização', icon: <CalendarDays className="size-4" /> },
  { id: 'automacao', label: 'Automação', icon: <Bot className="size-4" /> },
  { id: 'simulador', label: 'Simulador Zélla', icon: <MessageSquare className="size-4" /> },
  { id: 'whatsapp', label: 'Connection Center', icon: <Smartphone className="size-4" /> },
  { id: 'linkinbio', label: 'Link-in-Bio Instagram', icon: <LinkIcon className="size-4" /> },
  { id: 'guia', label: 'Guia Digital', icon: <QrCode className="size-4" /> },
  { id: 'fechaduras', label: 'Fechaduras Eletrônicas', icon: <Key className="size-4" />, tier: 'lite' },
  { id: 'creditos', label: 'Créditos de Amortização', icon: <Coins className="size-4" />, tier: 'lite' },
  { id: 'bi', label: 'BI Avançado', icon: <BarChart2 className="size-4" />, tier: 'max' },
  { id: 'properties', label: 'Multi-Propriedades', icon: <Building2 className="size-4" />, tier: 'max' },
  { id: 'conquistas', label: 'Conquistas', icon: <Trophy className="size-4" />, tier: 'parceiro' },
  { id: 'config', label: 'Configurações', icon: <Settings className="size-4" /> },
];

// ── Format Helpers 

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatCompactBRL(value: number): string {
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(1).replace('.', ',')}k`;
  }
  return formatBRL(value);
}

// ── Main Component 

export default function DDCAirbnbContent() {
  const { plan: currentPlan } = useCurrentPlan();
  const [activeTab, setActiveTab] = useState<AirbnbTab>('financeiro');
  const [calendarDays] = useState<CalendarDay[]>(generateCalendarDays);
  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);
  const [propertiesState, setPropertiesState] = useState<PropertyData[]>(MOCK_PROPERTIES);
  const [newPropertyForm, setNewPropertyForm] = useState({
    name: '',
    location: '',
    revenue: 4500,
  });

  const [scannedData, setScannedData] = useState<MagicScanResult | null>({
    propertyName: 'Apartamento Vista Mar — Copacabana',
    amenities: ['Wi-Fi', 'Ar-condicionado', 'Cozinha completa', 'Vista mar', 'Estacionamento', 'Smart TV'],
    checkInTime: '15:00',
    checkOutTime: '11:00',
    aiVoiceTone: 'Moderno e direto',
    source: 'airbnb',
    location: 'Copacabana, Rio de Janeiro',
    rating: 4.96,
    totalRooms: 2,
    description: 'Apartamento com vista panorâmica para o mar em Copacabana. Perfeito para casais e famílias pequenas.',
    priceRange: 'R$ 280 - R$ 550',
    policies: 'Cancelamento flexível. Proibido festa. Check-in: 15h, Check-out: 11h.',
    highlights: ['Vista mar panorâmica', '2 quartos', 'Copacabana', 'Metro próximo'],
  });

  // Notification toggles (must be declared before any early return)
  const [notifNewReservation, setNotifNewReservation] = useState(true);
  const [notifCancellation, setNotifCancellation] = useState(true);
  const [notifReview, setNotifReview] = useState(true);
  const [notifMessage, setNotifMessage] = useState(false);

  const handleScanComplete = useCallback((result: MagicScanResult) => {
    setScannedData(result);
  }, []);

  // Tab navigation handler (declared before early return — Rules of Hooks)
  const handleTabChange = useCallback((id: string) => {
    const validTabs: AirbnbTab[] = ['financeiro', 'upsell', 'propriedades', 'sincronizacao', 'automacao', 'simulador', 'whatsapp', 'linkinbio', 'guia', 'config', 'creditos', 'bi', 'properties', 'fechaduras', 'conquistas'];
    if (validTabs.includes(id as AirbnbTab)) {
      setActiveTab(id as AirbnbTab);
    } else {
      setActiveTab('financeiro');
    }
  }, []);

  const handleAddProperty = useCallback(() => {
    if (!newPropertyForm.name.trim()) return;
    const newProp: PropertyData = {
      id: `p-${Date.now()}`,
      name: newPropertyForm.name,
      location: newPropertyForm.location || 'Brasil',
      connected: true,
      occupancy: 80,
      rating: 5.0,
      reviews: 12,
      revenue: Number(newPropertyForm.revenue) || 5000,
    };

    setPropertiesState((prev) => [newProp, ...prev]);
    setNewPropertyForm({ name: '', location: '', revenue: 4500 });
    setIsAddPropertyOpen(false);
  }, [newPropertyForm]);

  // Show Magic Scanner if no scan data yet
  if (!scannedData) {
    return <MagicScanner niche="airbnb" onComplete={handleScanComplete} />;
  }

  // Summary stats
  const totalProperties = propertiesState.length;
  const totalRevenue = propertiesState.reduce((sum, p) => sum + p.revenue, 0);
  const avgRating = (propertiesState.reduce((sum, p) => sum + p.rating, 0) / (propertiesState.length || 1)).toFixed(2);
  const totalReviews = propertiesState.reduce((sum, p) => sum + p.reviews, 0);

  const now = new Date();
  const monthName = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // ── Tab: Painel de Propriedades 

  const TabPropriedades = () => (
    <motion.div
      key="propriedades"
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="space-y-6"
    >
      {/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · theme: Terminal · option: 08 (Azul Cyber) */}
      {/* ── DDC AIRBNB / ANFITRIÕES: HALLMARK OPTION 08 (ESTILO TERMINAL AZUL CYBER)  */}

      {/* N8 Terminal Command Header */}
      <div className="p-3.5 bg-[#040c1a] border border-[#00d8ff]/40 rounded-lg font-mono text-xs text-[#00d8ff] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[0_0_20px_rgba(0,216,255,0.12)]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[#00d8ff] font-bold">&gt; zella-airbnb --terminal</span>
          <span className="text-zinc-400">|</span>
          <span className="text-[#93c5fd]">--ical [SYNC_100%]</span>
          <span className="text-[#93c5fd]">--fechaduras [AUTO_PIN]</span>
          <span className="text-[#93c5fd]">--status [SUPERHOST_ACTIVE]</span>
          <span className="text-[#00d8ff] font-bold animate-pulse">▮</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-[#00d8ff]/10 text-[#00d8ff] border border-[#00d8ff]/30 text-[10px] font-mono uppercase tracking-widest">
            [MODE: TERMINAL_AZUL_08]
          </Badge>
        </div>
      </div>

      {/* ── DDC AIRBNB WEB: CYBER-LUXE GLASSMORPHISM DESIGN SYSTEM  */}

      {/* Operational Status Header — Clean Lines, Rounded Corners, No Shadows */}
      <div className="p-4 bg-[#0d0d14] border border-blue-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
            <Home className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-tight">Cockpit Anfitrião ProHost — Terminal Seu Zélla 24h</span>
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px] uppercase font-mono rounded-full px-2.5 py-0.5">SUPERHOST ATIVO</Badge>
            </div>
            <p className="text-xs text-white/60 mt-0.5">Gestão de múltiplos imóveis, sincronização de calendários iCAL e automação de PINs no WhatsApp</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded-full text-blue-400 font-bold">🛡️ MOTOR ZÉLLA: ATIVO</span>
          <span className="px-3 py-1 bg-white/[0.02] border border-white/10 rounded-full text-blue-400">⚡ iCAL: 100% SYNC</span>
          <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded-full text-blue-300">🔑 AUTO-PIN: ON</span>
        </div>
      </div>

      {/* Property Information Card — Clean Line Border, Rounded Corners */}
      <Card className="bg-[#0d0d14] border border-white/10 rounded-2xl overflow-hidden shadow-none">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-white font-bold text-base tracking-tight">{scannedData.propertyName}</h3>
                <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px] rounded-full px-2.5">
                  CALENDÁRIO iCAL CONECTADO
                </Badge>
              </div>
              <p className="text-white/60 text-xs mb-3">{scannedData.description || ''}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <MapPin className="w-3.5 h-3.5 text-blue-400" />
                  <span>{scannedData.location || '—'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span>Check-in {scannedData.checkInTime} / Out {scannedData.checkOutTime}</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <Wifi className="w-3.5 h-3.5 text-blue-400" />
                  <span>{scannedData.amenities.length} comodidades</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <Bot className="w-3.5 h-3.5 text-blue-400" />
                  <span className="truncate">{(scannedData.aiVoiceTone || '').split('—')[0]}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {scannedData.amenities.map((amenity) => (
                  <Badge key={amenity} variant="outline" className="text-[10px] border-blue-500/30 text-blue-300 bg-blue-500/5 rounded-full px-2.5">
                    +{amenity}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Portfólio de Imóveis Airbnb</h2>
          <p className="text-sm text-zinc-400">{totalProperties} imóveis conectados e monitorados pela IA Zélla</p>
        </div>
        <Button
          onClick={() => setIsAddPropertyOpen(true)}
          size="sm"
          className="bg-blue-600 hover:bg-blue-500 text-white font-medium cursor-pointer active:scale-95 transition-all rounded-full px-4"
        >
          <Plus className="size-4 mr-1" />
          Adicionar Imóvel
        </Button>
      </div>

      {/* Summary Stats — Clean Solid Lines, Rounded-2xl */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div variants={staggerItem}>
          <Card className="bg-[#0d0d14] border border-white/10 hover:border-blue-500/30 transition-all rounded-2xl shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Home className="h-4 w-4 text-blue-400" />
                <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[9px] rounded-full">CONECTADO</Badge>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{totalProperties}</p>
              <p className="text-xs text-zinc-400 mt-1 font-mono uppercase">Total Imóveis</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={staggerItem}>
          <Card className="bg-[#0d0d14] border border-blue-500/30 hover:border-blue-500/60 transition-all rounded-2xl shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="h-4 w-4 text-blue-400" />
                <TrendingUp className="h-3.5 w-3.5 text-blue-400" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{formatCompactBRL(totalRevenue)}</p>
              <p className="text-xs text-blue-400 mt-1 font-mono uppercase">Receita Bruta do Mês</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={staggerItem}>
          <Card className="bg-[#0d0d14] border border-white/10 hover:border-blue-500/30 transition-all rounded-2xl shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Star className="h-4 w-4 text-amber-400" />
                <span className="text-xs text-blue-400 font-bold">+0.03</span>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{avgRating}</p>
              <p className="text-xs text-zinc-400 mt-1 font-mono uppercase">Avaliação Média</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={staggerItem}>
          <Card className="bg-[#0d0d14] border border-white/10 hover:border-blue-500/30 transition-all rounded-2xl shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <MessageSquare className="h-4 w-4 text-blue-400" />
                <ArrowUpRight className="h-3.5 w-3.5 text-blue-400" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{totalReviews}</p>
              <p className="text-xs text-zinc-400 mt-1 font-mono uppercase">Total Avaliações</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Property Cards Grid — Clean Lines, Rounded-2xl */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {propertiesState.map((property) => (
          <motion.div key={property.id} variants={staggerItem}>
            <Card className="bg-[#0d0d14] border border-blue-500/30 hover:border-blue-500/60 transition-all duration-300 group rounded-2xl shadow-none">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-white text-base group-hover:text-blue-400 transition-colors font-bold">
                      {property.name}
                    </CardTitle>
                    <CardDescription className="text-zinc-400 text-xs mt-0.5 font-mono">
                      {property.location}
                    </CardDescription>
                  </div>
                  <Badge
                    className={
                      property.connected
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 font-mono text-[10px] rounded-full px-2.5'
                        : 'bg-red-500/10 text-red-400 border-red-500/30 font-mono text-[10px] rounded-full px-2.5'
                    }
                    variant="outline"
                  >
                    {property.connected ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 mr-1 text-blue-400" />
                        CONECTADO
                      </>
                    ) : (
                      <>
                        <CircleX className="h-3 w-3 mr-1" />
                        OFFLINE
                      </>
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                {/* Occupancy */}
                <div>
                  <div className="flex items-center justify-between mb-1.5 font-mono">
                    <span className="text-xs text-zinc-400">Ocupação Mensal</span>
                    <span className="text-sm font-bold text-blue-400">{property.occupancy}%</span>
                  </div>
                  <Progress value={property.occupancy} className="h-1.5 bg-white/10 [&>div]:bg-blue-400 rounded-full" />
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-3 font-mono">
                  <div className="text-center p-2 rounded-xl bg-white/[0.02] border border-white/10">
                    <div className="flex items-center justify-center gap-0.5 mb-0.5">
                      <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                      <span className="text-sm font-bold text-white">{property.rating}</span>
                    </div>
                    <p className="text-[10px] text-zinc-400">AVALIAÇÃO</p>
                  </div>
                  <div className="text-center p-2 rounded-xl bg-white/[0.02] border border-white/10">
                    <p className="text-sm font-bold text-white">{property.reviews}</p>
                    <p className="text-[10px] text-zinc-400">REVIEWS</p>
                  </div>
                  <div className="text-center p-2 rounded-xl bg-white/[0.02] border border-white/10">
                    <p className="text-sm font-bold text-blue-400">{formatBRL(property.revenue)}</p>
                    <p className="text-[10px] text-zinc-400">RECEITA</p>
                  </div>
                </div>

                <Separator className="bg-white/10" />

                <Button
                  variant="ghost"
                  className="w-full text-blue-400 hover:text-white hover:bg-blue-500/10 text-xs font-mono rounded-xl"
                >
                  Ver Detalhes do Imóvel
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {/* Add New Property Card */}
        <motion.div variants={staggerItem}>
          <Card className="bg-[#0d0d14] border-2 border-dashed border-white/10 hover:border-blue-500/40 transition-all duration-300 cursor-pointer group min-h-[280px] flex items-center justify-center rounded-2xl shadow-none">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-500/20 border border-blue-500/20 transition-all">
                <Plus className="h-6 w-6 text-blue-400 group-hover:text-blue-300 transition-colors" />
              </div>
              <p className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors">
                Conectar Novo Imóvel
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Vincule sua propriedade via OAuth iCAL
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );

  // ── Tab: Sincronização 

  const TabSincronizacao = () => {
    const days = calendarDays;
    const firstDayOfWeek = new Date(now.getFullYear(), now.getMonth(), 1).getDay();

    return (
      <motion.div
        key="sincronizacao"
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="space-y-6"
      >
        {/* Calendar Header + Sync Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <motion.div variants={staggerItem}>
            <h3 className="text-lg font-semibold text-white capitalize">{monthName}</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Visualização de disponibilidade em tempo real</p>
          </motion.div>
          <motion.div variants={staggerItem} className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="bg-zinc-900/60 border-zinc-700/50 text-zinc-300 hover:text-white hover:border-blue-500/40"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Sincronizar Agora
            </Button>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <motion.div variants={staggerItem} className="lg:col-span-2">
            <Card className="bg-zinc-900/60 border-zinc-800/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base">Calendário de Reservas</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
                    <div key={d} className="text-center text-[10px] text-zinc-500 font-medium py-1">
                      {d}
                    </div>
                  ))}
                </div>
                {/* Empty slots before month starts */}
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ))}
                  {/* Calendar days */}
                  {days.map((d) => {
                    let bgClass = '';
                    let textClass = 'text-zinc-300';
                    let indicator = null;

                    if (d.status === 'past') {
                      bgClass = 'bg-zinc-800/30';
                      textClass = 'text-zinc-600';
                    } else if (d.status === 'booked') {
                      bgClass = 'bg-blue-500/20 border border-blue-500/30';
                      textClass = 'text-blue-300';
                      indicator = <span className="text-[8px] text-blue-400 truncate px-0.5">{d.guest}</span>;
                    } else if (d.status === 'blocked') {
                      bgClass = 'bg-zinc-700/30 border border-zinc-600/30';
                      textClass = 'text-zinc-400';
                    } else if (d.status === 'available') {
                      indicator = <Circle className="h-1.5 w-1.5 text-emerald-400 fill-emerald-400 mx-auto" />;
                    }

                    return (
                      <div
                        key={d.day}
                        className={`aspect-square rounded-md flex flex-col items-center justify-center p-0.5 ${bgClass} transition-colors hover:bg-zinc-700/30`}
                      >
                        <span className={`text-xs font-medium leading-none ${textClass}`}>{d.day}</span>
                        {indicator}
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-4 mt-4 pt-3 border-t border-zinc-800/50">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-blue-500/20 border border-blue-500/30" />
                    <span className="text-[11px] text-zinc-400">Reservado</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-zinc-700/30 border border-zinc-600/30" />
                    <span className="text-[11px] text-zinc-400">Bloqueado</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Circle className="h-2 w-2 text-emerald-400 fill-emerald-400" />
                    <span className="text-[11px] text-zinc-400">Disponível</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-zinc-800/30" />
                    <span className="text-[11px] text-zinc-400">Passado</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Sync Sources & Guarantee */}
          <motion.div variants={staggerItem} className="space-y-4">
            {/* iCal Sync Status */}
            <Card className="bg-zinc-900/60 border-zinc-800/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base">Status iCal</CardTitle>
                <CardDescription className="text-zinc-500 text-xs">Última sincronização</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {MOCK_SYNC_SOURCES.map((source) => (
                  <div
                    key={source.name}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-800/30"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{source.icon}</span>
                      <div>
                        <p className="text-sm text-white font-medium">{source.name}</p>
                        {source.status === 'synced' ? (
                          <p className="text-[11px] text-zinc-400">
                            Sincronizado há {source.lastSync}
                          </p>
                        ) : (
                          <p className="text-[11px] text-red-400">Não conectado</p>
                        )}
                      </div>
                    </div>
                    {source.status === 'synced' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <CircleX className="h-4 w-4 text-red-400" />
                    )}
                  </div>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 bg-zinc-800/40 border-zinc-700/50 text-zinc-300 hover:text-white hover:border-blue-500/40"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Sincronizar Tudo
                </Button>
              </CardContent>
            </Card>

            {/* Anti-Overbooking Guarantee */}
            <Card className="bg-gradient-to-br from-blue-600/10 to-blue-800/5 border-blue-500/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                    <Shield className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Garantia Anti-Overbooking</p>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                      Zélla bloqueia datas automaticamente em todos os canais. Double-booking é impossível.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>
    );
  };

  // ── Tab: Automação 

  const TabAutomacao = () => (
    <motion.div
      key="automacao"
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="space-y-6"
    >
      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div variants={staggerItem}>
          <Card className="bg-zinc-900/60 border-zinc-800/50 hover:border-blue-500/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-blue-400" />
                <span className="text-xs text-zinc-400">Tempo Médio de Resposta</span>
              </div>
              <p className="text-3xl font-bold text-white">47<span className="text-lg text-zinc-400 ml-1">seg</span></p>
              <div className="flex items-center gap-1.5 mt-2">
                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30" variant="outline">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Meta: &lt; 1min
                </Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={staggerItem}>
          <Card className="bg-zinc-900/60 border-zinc-800/50 hover:border-blue-500/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-amber-400" />
                <span className="text-xs text-zinc-400">One-Shot Resolution</span>
              </div>
              <p className="text-3xl font-bold text-white">78<span className="text-lg text-zinc-400 ml-1">%</span></p>
              <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
                Resolução na primeira interação sem necessidade de acompanhamento
              </p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={staggerItem}>
          <Card className="bg-zinc-900/60 border-zinc-800/50 hover:border-blue-500/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-blue-400" />
                <span className="text-xs text-zinc-400">Mensagens Salvas (Bundling)</span>
              </div>
              <p className="text-3xl font-bold text-white">234</p>
              <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
                Mensagens WhatsApp agrupadas este mês, reduzindo tarifas
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Response Time Chart */}
        <motion.div variants={staggerItem} className="lg:col-span-2">
          <Card className="bg-zinc-900/60 border-zinc-800/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-base">Tempo de Resposta — Últimos 7 dias</CardTitle>
                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30" variant="outline">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  -24%
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ChartContainer config={responseTimeChartConfig} className="h-[220px] w-full">
                <LineChart data={RESPONSE_TIME_DATA} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#71717a', fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#71717a', fontSize: 12 }}
                    tickFormatter={(v) => `${v}s`}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="seconds"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={{ fill: '#3b82f6', r: 4, strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: '#3b82f6', stroke: '#0a0a0f', strokeWidth: 2 }}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Airbnb Algorithm Health */}
        <motion.div variants={staggerItem}>
          <Card className="bg-zinc-900/60 border-zinc-800/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">Saúde do Algoritmo Airbnb</CardTitle>
              <CardDescription className="text-zinc-500 text-xs">Seu posicionamento nos resultados</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-zinc-300">Taxa de Resposta</span>
                  <span className="text-sm font-semibold text-emerald-400">98%</span>
                </div>
                <Progress value={98} className="h-2 bg-zinc-800 [&>div]:bg-emerald-500" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-zinc-300">Taxa de Aceitação</span>
                  <span className="text-sm font-semibold text-emerald-400">100%</span>
                </div>
                <Progress value={100} className="h-2 bg-zinc-800 [&>div]:bg-emerald-500" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-zinc-300">Comprometimento</span>
                  <span className="text-sm font-semibold text-blue-400">95%</span>
                </div>
                <Progress value={95} className="h-2 bg-zinc-800 [&>div]:bg-blue-500" />
              </div>

              <Separator className="bg-zinc-800/50" />

              <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                <p className="text-xs text-emerald-300">
                  Superhost: todos os critérios atingidos
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Automation Activity Log */}
      <motion.div variants={staggerItem}>
        <Card className="bg-zinc-900/60 border-zinc-800/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-base">Log de Automação</CardTitle>
              <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30" variant="outline">
                <Activity className="h-3 w-3 mr-1" />
                Ao vivo
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-72">
              <div className="space-y-2">
                {MOCK_AUTOMATION_LOG.map((log) => {
                  const typeIcons: Record<string, React.ElementType> = {
                    'auto-reply': MessageSquare,
                    instruction: CheckCircle2,
                    update: RefreshCw,
                    reminder: Bell,
                  };
                  const typeColors: Record<string, string> = {
                    'auto-reply': 'text-blue-400 bg-blue-500/15',
                    instruction: 'text-emerald-400 bg-emerald-500/15',
                    update: 'text-amber-400 bg-amber-500/15',
                    reminder: 'text-purple-400 bg-purple-500/15',
                  };
                  const Icon = typeIcons[log.type] || Activity;
                  const color = typeColors[log.type] || 'text-zinc-400 bg-zinc-500/15';

                  return (
                    <div
                      key={log.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/20 hover:bg-zinc-800/40 transition-colors"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{log.action}</p>
                        <p className="text-xs text-zinc-500 truncate">{log.detail}</p>
                      </div>
                      <span className="text-[11px] text-zinc-500 shrink-0">{log.time}</span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );

  // ── Tab: Configurações 

  const TabConfig = () => (
    <motion.div
      key="config"
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile */}
        <motion.div variants={staggerItem}>
          <Card className="bg-zinc-900/60 border-zinc-800/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">Perfil</CardTitle>
              <CardDescription className="text-zinc-500 text-xs">Informações da sua conta</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-zinc-400 font-medium">Nome</label>
                <Input
                  defaultValue="Ricardo Mendes"
                  className="bg-zinc-800/50 border-zinc-700/50 text-white focus:border-blue-500/50 focus:ring-blue-500/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-zinc-400 font-medium">E-mail</label>
                <Input
                  defaultValue="ricardo@exemplo.com"
                  className="bg-zinc-800/50 border-zinc-700/50 text-white focus:border-blue-500/50 focus:ring-blue-500/20"
                  type="email"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-zinc-400 font-medium">Telefone</label>
                <Input
                  defaultValue="+55 21 99999-0000"
                  className="bg-zinc-800/50 border-zinc-700/50 text-white focus:border-blue-500/50 focus:ring-blue-500/20"
                  type="tel"
                />
              </div>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                Salvar Alterações
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Airbnb OAuth + Plan */}
        <motion.div variants={staggerItem} className="space-y-4">
          {/* Airbnb Connection */}
          <Card className="bg-zinc-900/60 border-zinc-800/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">Conexão Airbnb</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center">
                    <Key className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">OAuth Airbnb</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <CircleCheck className="h-3 w-3 text-emerald-400" />
                      <span className="text-xs text-emerald-400">Conectado</span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-zinc-800/40 border-zinc-700/50 text-zinc-300 hover:text-white hover:border-blue-500/40"
                >
                  Reconectar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Plan Info */}
          <Card className="bg-gradient-to-br from-blue-600/10 to-blue-800/5 border-blue-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-400" />
                Seu Plano
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-lg font-bold text-white">Pro Airbnb</p>
                  <p className="text-xs text-zinc-400">R$ 147/mês · Até 5 imóveis</p>
                </div>
                <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30" variant="outline">
                  Ativo
                </Badge>
              </div>
              <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                Fazer Upgrade para Enterprise
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Notifications */}
        <motion.div variants={staggerItem}>
          <Card className="bg-zinc-900/60 border-zinc-800/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">Notificações</CardTitle>
              <CardDescription className="text-zinc-500 text-xs">Configure quais alertas deseja receber</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white">Nova reserva</p>
                    <p className="text-xs text-zinc-500">Quando um hóspede reserva</p>
                  </div>
                </div>
                <Switch
                  checked={notifNewReservation}
                  onCheckedChange={setNotifNewReservation}
                />
              </div>
              <Separator className="bg-zinc-800/50" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center">
                    <CircleX className="h-4 w-4 text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white">Cancelamento</p>
                    <p className="text-xs text-zinc-500">Quando uma reserva é cancelada</p>
                  </div>
                </div>
                <Switch
                  checked={notifCancellation}
                  onCheckedChange={setNotifCancellation}
                />
              </div>
              <Separator className="bg-zinc-800/50" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                    <Star className="h-4 w-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white">Review recebida</p>
                    <p className="text-xs text-zinc-500">Quando um hóspede deixa avaliação</p>
                  </div>
                </div>
                <Switch
                  checked={notifReview}
                  onCheckedChange={setNotifReview}
                />
              </div>
              <Separator className="bg-zinc-800/50" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white">Mensagem de hóspede</p>
                    <p className="text-xs text-zinc-500">Quando não respondido em 5min</p>
                  </div>
                </div>
                <Switch
                  checked={notifMessage}
                  onCheckedChange={setNotifMessage}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Language Preference */}
        <motion.div variants={staggerItem}>
          <Card className="bg-zinc-900/60 border-zinc-800/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">Idioma</CardTitle>
              <CardDescription className="text-zinc-500 text-xs">Preferência de idioma da interface</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <label className="text-xs text-zinc-400 font-medium">Idioma da interface</label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    🇧🇷 Português (BR)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-zinc-800/40 border-zinc-700/50 text-zinc-300 hover:text-white"
                  >
                    🇺🇸 English
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-zinc-800/40 border-zinc-700/50 text-zinc-300 hover:text-white"
                  >
                    🇪🇸 Español
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );

  // ── Tab: Painel Financeiro 

  const TabFinanceiro = () => (
    <motion.div
      key="financeiro"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Scan Summary Banner */}
      <Card className="bg-gradient-to-r from-blue-500/[0.08] to-indigo-500/[0.05] border-blue-500/20 overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-blue-500/15 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-white font-semibold text-sm">{scannedData.propertyName}</h3>
                <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-[10px]">
                  <CheckCircle2 className="w-3 h-3 mr-1" />iCal & WhatsApp Conectados
                </Badge>
              </div>
              <p className="text-zinc-400 text-xs mb-3">{scannedData.description || ''}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs text-zinc-300">{scannedData.location || '—'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs text-zinc-300">Check-in {scannedData.checkInTime} / Check-out {scannedData.checkOutTime}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs text-zinc-300">{totalProperties} imóveis monitorados</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs text-zinc-300 truncate">{(scannedData.aiVoiceTone || '').split('—')[0]}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {scannedData.amenities.map((amenity) => (
                  <Badge key={amenity} variant="outline" className="text-[10px] border-blue-500/20 text-blue-300 bg-blue-500/5">
                    {amenity}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR Card */}
        <Card className="bg-[#111118] border-zinc-800/60 hover:border-blue-500/30 transition-colors">
          <CardHeader className="pb-2">
            <CardDescription className="text-zinc-400 text-xs uppercase tracking-wider">Faturamento do Mês</CardDescription>
            <CardTitle className="text-2xl font-bold text-white">
              {formatBRL(totalRevenue)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1.5 text-emerald-400 text-sm">
              <TrendingUp className="size-4" />
              <span>+18.4% vs mês anterior</span>
            </div>
          </CardContent>
        </Card>

        {/* Taxa de Conversão */}
        <Card className="bg-[#111118] border-zinc-800/60 hover:border-blue-500/30 transition-colors">
          <CardHeader className="pb-2">
            <CardDescription className="text-zinc-400 text-xs uppercase tracking-wider">Conversão Direta WhatsApp</CardDescription>
            <CardTitle className="text-2xl font-bold text-white">41.2%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1.5 text-blue-400 text-sm">
              <ArrowUpRight className="size-4" />
              <span>Sem comissão de OTAs</span>
            </div>
          </CardContent>
        </Card>

        {/* Imóveis Ativos */}
        <Card className="bg-[#111118] border-zinc-800/60 hover:border-blue-500/30 transition-colors">
          <CardHeader className="pb-2">
            <CardDescription className="text-zinc-400 text-xs uppercase tracking-wider">Portfólio Ativo</CardDescription>
            <CardTitle className="text-2xl font-bold text-white">{totalProperties} Imóveis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1.5 text-amber-400 text-sm">
              <Home className="size-4" />
              <span>Ocupação média: 73%</span>
            </div>
          </CardContent>
        </Card>

        {/* Economia em Comissões Airbnb */}
        <Card className="bg-[#111118] border-zinc-800/60 hover:border-blue-500/30 transition-colors">
          <CardHeader className="pb-2">
            <CardDescription className="text-zinc-400 text-xs uppercase tracking-wider">Economia em Comissões</CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-400">R$ 2.797</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1.5 text-emerald-400 text-sm">
              <ShieldCheck className="size-4" />
              <span>15% economizados no PIX</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Trend Chart - 2 cols */}
        <Card className="lg:col-span-2 bg-[#111118] border-zinc-800/60">
          <CardHeader>
            <CardTitle className="text-base text-white">Evolução de Faturamento (30 Dias)</CardTitle>
            <CardDescription className="text-zinc-500">Receita acumulada do portfólio de imóveis</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={revenueChartConfig} className="h-[260px] w-full">
              <LineChart data={REVENUE_TREND_DATA} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                <XAxis dataKey="day" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  formatter={(value: number) => [formatBRL(value), 'Receita']}
                />
                <Line
                  type="monotone"
                  dataKey="receita"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: '#3b82f6', stroke: '#0a0a0f', strokeWidth: 2 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Payment Method Donut Chart */}
        <Card className="bg-[#111118] border-zinc-800/60">
          <CardHeader>
            <CardTitle className="text-base text-white">Origem dos Pagamentos</CardTitle>
            <CardDescription className="text-zinc-500">Distribuição por canal de recebimento</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <ChartContainer config={paymentChartConfig} className="h-[180px] w-full">
              <PieChart>
                <Pie
                  data={PAYMENT_METHOD_DATA}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  strokeWidth={2}
                  stroke="#111118"
                >
                  {PAYMENT_METHOD_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
            <div className="w-full space-y-2 mt-2">
              {PAYMENT_METHOD_DATA.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-zinc-300">{item.name}</span>
                  </div>
                  <span className="font-semibold text-white">{item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );

  // ── Tab Renderer 

  const renderTab = () => {
    switch (activeTab) {
      case 'financeiro':
        return <TabFinanceiro />;
      case 'upsell':
        return <DDCUpsellTab />;
      case 'propriedades':
        return <TabPropriedades />;
      case 'sincronizacao':
        return <BookingSyncPanel niche="airbnb" propertyName={scannedData.propertyName} />;
      case 'automacao':
        return <TabAutomacao />;
      case 'simulador':
        return <ZellaSimulator niche="airbnb" propertyData={scannedData} />;
      case 'whatsapp':
        return <WhatsAppDeviceManager niche="airbnb" propertyName={scannedData.propertyName} />;
      case 'linkinbio':
        return <LinkInBioEditor initialPropertyName={scannedData.propertyName} niche="airbnb" />;
      case 'guia':
        return <GuestGuidePanel niche="airbnb" propertyName={scannedData.propertyName} />;
      case 'config':
        return <TabConfig />;
      case 'creditos':
        return <CreditsTab plan="pro" niche="airbnb" />;
      case 'bi':
        return <BITab />;
      case 'properties':
        return <MultiPropertiesTab />;
      case 'fechaduras':
        return <LocksTab niche="airbnb" />;
      case 'conquistas':
        return <ConquistasTab />;
    }
  };

  return (
    <DDCShell
      niche="airbnb"
      navItems={airbnbNavItems}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      propertyName={scannedData.propertyName}
      currentPlan={currentPlan}
    >
      <AnimatePresence mode="wait">
        {renderTab()}
      </AnimatePresence>

      {/* Modal: Novo Imóvel Airbnb */}
      <Dialog open={isAddPropertyOpen} onOpenChange={setIsAddPropertyOpen}>
        <DialogContent className="bg-[#111118] border-zinc-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-blue-400">
              <Plus className="size-5" /> Adicionar Imóvel Airbnb
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Conecte um novo imóvel do seu portfólio para co-gestão automática via IA.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Nome do Anúncio / Imóvel</label>
              <Input
                placeholder="Ex: Loft Design Jardins"
                value={newPropertyForm.name}
                onChange={(e) => setNewPropertyForm({ ...newPropertyForm, name: e.target.value })}
                className="bg-[#0a0a0f] border-zinc-700 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Localização</label>
                <Input
                  placeholder="Ex: São Paulo, SP"
                  value={newPropertyForm.location}
                  onChange={(e) => setNewPropertyForm({ ...newPropertyForm, location: e.target.value })}
                  className="bg-[#0a0a0f] border-zinc-700 text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Receita Média (R$)</label>
                <Input
                  type="number"
                  placeholder="5000"
                  value={newPropertyForm.revenue}
                  onChange={(e) => setNewPropertyForm({ ...newPropertyForm, revenue: Number(e.target.value) })}
                  className="bg-[#0a0a0f] border-zinc-700 text-white"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setIsAddPropertyOpen(false)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddProperty}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold"
            >
              Conectar Imóvel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <NotificationFAB niche="airbnb" plan={currentPlan} />
    </DDCShell>
  );
}
