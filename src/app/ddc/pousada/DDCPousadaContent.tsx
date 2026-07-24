'use client';

import { useState, useMemo, useCallback } from 'react';
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
  BarChart,
  Bar,
} from 'recharts';
import { DDCShell, type NavItem } from '@/components/ddc/DDCShell';
import { MagicScanner, type MagicScanResult } from '@/components/ddc/MagicScanner';
import { ZellaSimulator } from '@/components/ddc/ZellaSimulator';
import { WhatsAppDeviceManager } from '@/components/ddc/WhatsAppDeviceManager';
import { GuestGuidePanel } from '@/components/ddc/GuestGuidePanel';
import { BookingSyncPanel } from '@/components/ddc/BookingSyncPanel';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  LayoutDashboard,
  Users,
  Brain,
  Settings,
  TrendingUp,
  DollarSign,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  QrCode,
  MessageSquare,
  Calendar,
  Bed,
  CheckCircle2,
  Clock,
  Upload,
  Link as LinkIcon,
  Globe,
  FileText,
  Loader2,
  Sparkles,
  Phone,
  Building2,
  ShieldCheck,
  ChevronRight,
  Star,
  Zap,
  Plus,
  MapPin,
  Bot,
  Smartphone,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type PousadaTab = 'financeiro' | 'hospedes' | 'cerebro' | 'simulador' | 'whatsapp' | 'guia' | 'integracoes' | 'config';

interface GuestCardData {
  id: string;
  name: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  value: number;
  source: 'WhatsApp' | 'Booking' | 'Airbnb';
}

interface Transaction {
  id: string;
  guest: string;
  description: string;
  method: 'PIX' | 'Cartão' | 'Dinheiro';
  amount: number;
  date: string;
  status: 'confirmado' | 'pendente' | 'reembolso';
}

interface TrainingItem {
  id: string;
  title: string;
  status: 'completo' | 'em progresso' | 'pendente';
  icon: React.ReactNode;
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const revenueTrendData = [
  { day: '01/02', receita: 2800 },
  { day: '02/02', receita: 3200 },
  { day: '03/02', receita: 1900 },
  { day: '04/02', receita: 4100 },
  { day: '05/02', receita: 3600 },
  { day: '06/02', receita: 5200 },
  { day: '07/02', receita: 4800 },
  { day: '08/02', receita: 3900 },
  { day: '09/02', receita: 4600 },
  { day: '10/02', receita: 5800 },
  { day: '11/02', receita: 4300 },
  { day: '12/02', receita: 6100 },
  { day: '13/02', receita: 5500 },
  { day: '14/02', receita: 7200 },
  { day: '15/02', receita: 6800 },
  { day: '16/02', receita: 5900 },
  { day: '17/02', receita: 6400 },
  { day: '18/02', receita: 7800 },
  { day: '19/02', receita: 7100 },
  { day: '20/02', receita: 8200 },
  { day: '21/02', receita: 7500 },
  { day: '22/02', receita: 8900 },
  { day: '23/02', receita: 8100 },
  { day: '24/02', receita: 9400 },
  { day: '25/02', receita: 8600 },
  { day: '26/02', receita: 9800 },
  { day: '27/02', receita: 9200 },
  { day: '28/02', receita: 10500 },
];

const paymentMethodData = [
  { method: 'PIX', value: 18700, fill: '#10b981' },
  { method: 'Cartão', value: 12300, fill: '#f59e0b' },
  { method: 'Dinheiro', value: 3400, fill: '#6366f1' },
];

const weeklyOccupancyData = [
  { week: 'Sem 1', taxa: 62 },
  { week: 'Sem 2', taxa: 71 },
  { week: 'Sem 3', taxa: 85 },
  { week: 'Sem 4', taxa: 78 },
];

const kanbanGuests: Record<string, GuestCardData[]> = {
  'atendimento-ia': [
    { id: '1', name: 'Maria Silva', roomType: 'Suíte Master', checkIn: '15/03', checkOut: '18/03', value: 1350, source: 'WhatsApp' },
    { id: '2', name: 'João Pereira', roomType: 'Chalé', checkIn: '20/03', checkOut: '23/03', value: 2100, source: 'Booking' },
    { id: '3', name: 'Ana Costa', roomType: 'Quarto Standard', checkIn: '22/03', checkOut: '24/03', value: 680, source: 'WhatsApp' },
  ],
  'aguardando-pagamento': [
    { id: '4', name: 'Roberto Lima', roomType: 'Suíte Master', checkIn: '18/03', checkOut: '21/03', value: 1350, source: 'Airbnb' },
    { id: '5', name: 'Carla Mendes', roomType: 'Chalé', checkIn: '25/03', checkOut: '28/03', value: 2100, source: 'WhatsApp' },
  ],
  'confirmado': [
    { id: '6', name: 'Fernando Oliveira', roomType: 'Suíte Master', checkIn: '12/03', checkOut: '15/03', value: 1350, source: 'Booking' },
    { id: '7', name: 'Patrícia Santos', roomType: 'Quarto Standard', checkIn: '14/03', checkOut: '16/03', value: 680, source: 'WhatsApp' },
    { id: '8', name: 'Lucas Almeida', roomType: 'Chalé', checkIn: '16/03', checkOut: '19/03', value: 2100, source: 'Airbnb' },
  ],
  'checkin-hoje': [
    { id: '9', name: 'Camila Rodrigues', roomType: 'Suíte Master', checkIn: '10/03', checkOut: '13/03', value: 1350, source: 'WhatsApp' },
    { id: '10', name: 'Diego Ferreira', roomType: 'Quarto Standard', checkIn: '10/03', checkOut: '12/03', value: 680, source: 'Booking' },
  ],
};

const recentTransactions: Transaction[] = [
  { id: 't1', guest: 'Camila Rodrigues', description: 'Reserva Suíte Master (3 noites)', method: 'PIX', amount: 1350, date: '10/03/2025', status: 'confirmado' },
  { id: 't2', guest: 'Diego Ferreira', description: 'Reserva Standard (2 noites)', method: 'Cartão', amount: 680, date: '10/03/2025', status: 'pendente' },
  { id: 't3', guest: 'Fernando Oliveira', description: 'Reserva Suíte Master (3 noites)', method: 'PIX', amount: 1350, date: '09/03/2025', status: 'confirmado' },
  { id: 't4', guest: 'Patrícia Santos', description: 'Reserva Standard (2 noites)', method: 'Dinheiro', amount: 680, date: '08/03/2025', status: 'confirmado' },
  { id: 't5', guest: 'Lucas Almeida', description: 'Reserva Chalé (3 noites)', method: 'PIX', amount: 2100, date: '08/03/2025', status: 'confirmado' },
  { id: 't6', guest: 'Carlos Nogueira', description: 'Reembolso Cancelamento', method: 'PIX', amount: -450, date: '07/03/2025', status: 'reembolso' },
  { id: 't7', guest: 'Mariana Torres', description: 'Reserva Suíte Master (2 noites)', method: 'Cartão', amount: 900, date: '07/03/2025', status: 'confirmado' },
  { id: 't8', guest: 'André Barbosa', description: 'Reserva Chalé (4 noites)', method: 'PIX', amount: 2800, date: '06/03/2025', status: 'confirmado' },
];

const trainingItems: TrainingItem[] = [
  { id: 'tr1', title: 'Cardápio do Café da Manhã', status: 'completo', icon: <FileText className="size-4" /> },
  { id: 'tr2', title: 'Regras da Piscina', status: 'completo', icon: <ShieldCheck className="size-4" /> },
  { id: 'tr3', title: 'Horários de Check-in/Check-out', status: 'completo', icon: <Clock className="size-4" /> },
  { id: 'tr4', title: 'Preços e Temporadas', status: 'completo', icon: <DollarSign className="size-4" /> },
  { id: 'tr5', title: 'Políticas de Cancelamento', status: 'em progresso', icon: <FileText className="size-4" /> },
  { id: 'tr6', title: 'Atrações Turísticas Próximas', status: 'pendente', icon: <Globe className="size-4" /> },
  { id: 'tr7', title: 'Cardápio do Restaurante', status: 'pendente', icon: <FileText className="size-4" /> },
];

// ─── Chart Configs ───────────────────────────────────────────────────────────

const revenueChartConfig: ChartConfig = {
  receita: {
    label: 'Receita (R$)',
    color: '#10b981',
  },
};

const paymentChartConfig: ChartConfig = {
  PIX: { label: 'PIX', color: '#10b981' },
  Cartão: { label: 'Cartão', color: '#f59e0b' },
  Dinheiro: { label: 'Dinheiro', color: '#6366f1' },
};

const occupancyChartConfig: ChartConfig = {
  taxa: { label: 'Taxa (%)', color: '#10b981' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getSourceColor(source: string) {
  switch (source) {
    case 'WhatsApp': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Booking': return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 'Airbnb': return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    default: return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
  }
}

function getTransactionStatusColor(status: string) {
  switch (status) {
    case 'confirmado': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'pendente': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'reembolso': return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    default: return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
  }
}

function getTrainingStatusColor(status: string) {
  switch (status) {
    case 'completo': return 'text-emerald-400 bg-emerald-500/10';
    case 'em progresso': return 'text-amber-400 bg-amber-500/10';
    case 'pendente': return 'text-zinc-500 bg-zinc-500/10';
    default: return 'text-zinc-500 bg-zinc-500/10';
  }
}

function getTrainingStatusIcon(status: string) {
  switch (status) {
    case 'completo': return <CheckCircle2 className="size-4 text-emerald-400" />;
    case 'em progresso': return <Loader2 className="size-4 text-amber-400 animate-spin" />;
    case 'pendente': return <Clock className="size-4 text-zinc-500" />;
  }
}

// ─── Sidebar Navigation Items ────────────────────────────────────────────────

const pousadaNavItems: NavItem[] = [
  { id: 'financeiro', label: 'Visão Financeira', icon: <LayoutDashboard className="size-4" /> },
  { id: 'hospedes', label: 'Controle de Hóspedes', icon: <Users className="size-4" /> },
  { id: 'cerebro', label: 'Cérebro da Pousada', icon: <Brain className="size-4" /> },
  { id: 'simulador', label: 'Simulador Zélla', icon: <MessageSquare className="size-4" /> },
  { id: 'whatsapp', label: 'Connection Center', icon: <Smartphone className="size-4" /> },
  { id: 'guia', label: 'Guia Digital', icon: <QrCode className="size-4" /> },
  { id: 'integracoes', label: 'Integrações', icon: <Globe className="size-4" /> },
  { id: 'config', label: 'Configurações', icon: <Settings className="size-4" /> },
];

// ─── Main Component ──────────────────────────────────────────────────────────

export default function DDCPousadaContent() {
  const [activeTab, setActiveTab] = useState<PousadaTab>('financeiro');
  const [trainingUrl, setTrainingUrl] = useState('');
  const [isTraining, setIsTraining] = useState(false);
  const [isAddGuestOpen, setIsAddGuestOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [guestsState, setGuestsState] = useState<Record<string, GuestCardData[]>>(kanbanGuests);
  const [newGuestForm, setNewGuestForm] = useState({
    name: '',
    roomType: 'Suíte Master',
    checkIn: '15/03',
    checkOut: '18/03',
    value: 1200,
    source: 'WhatsApp' as 'WhatsApp' | 'Booking' | 'Airbnb',
    column: 'atendimento-ia',
  });

  const [scannedData, setScannedData] = useState<MagicScanResult | null>({
    propertyName: 'Pousada Serenity Paraty',
    amenities: ['Wi-Fi', 'Café da manhã', 'Piscina', 'Estacionamento', 'Ar-condicionado', 'Vista mar'],
    checkInTime: '14:00',
    checkOutTime: '12:00',
    aiVoiceTone: 'Acolhedor e profissional',
    source: 'airbnb',
    location: 'Paraty, RJ',
    rating: 4.9,
    totalRooms: 12,
    description: 'Pousada encantadora no centro histórico de Paraty com vista para a baía.',
    priceRange: 'R$ 280 - R$ 590',
    policies: 'Cancelamento gratuito até 48h antes. Check-in: 14h, Check-out: 12h.',
    highlights: ['Centro histórico', 'Vista baía', 'Café artesanal', 'Piscina natural'],
  });

  // Computed metrics (declared before any early return — Rules of Hooks)
  const totalMRR = useMemo(() => {
    const lastDay = revenueTrendData[revenueTrendData.length - 1].receita;
    return lastDay * 30; // extrapolated monthly
  }, []);

  const handleScanComplete = useCallback((result: MagicScanResult) => {
    setScannedData(result);
  }, []);

  const handleAddGuest = useCallback(() => {
    if (!newGuestForm.name.trim()) return;
    const newEntry: GuestCardData = {
      id: `g-${Date.now()}`,
      name: newGuestForm.name,
      roomType: newGuestForm.roomType,
      checkIn: newGuestForm.checkIn,
      checkOut: newGuestForm.checkOut,
      value: Number(newGuestForm.value) || 1000,
      source: newGuestForm.source,
    };

    setGuestsState((prev) => ({
      ...prev,
      [newGuestForm.column]: [newEntry, ...prev[newGuestForm.column]],
    }));

    setNewGuestForm({
      name: '',
      roomType: 'Suíte Master',
      checkIn: '15/03',
      checkOut: '18/03',
      value: 1200,
      source: 'WhatsApp',
      column: 'atendimento-ia',
    });
    setIsAddGuestOpen(false);
  }, [newGuestForm]);

  // Show Magic Scanner if no scan data yet
  if (!scannedData) {
    return <MagicScanner niche="pousada" onComplete={handleScanComplete} />;
  }

  const conversionRate = 34.7;
  const totalGuests = Object.values(guestsState).flat().length;
  const confirmedCount = (guestsState['confirmado']?.length || 0) + (guestsState['checkin-hoje']?.length || 0);

  // ─── Tab Content ────────────────────────────────────────────────────────

  const renderFinanceiro = () => (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Scan Summary Banner — mostra dados extraídos do Magic Scanner */}
      <Card className="bg-gradient-to-r from-emerald-500/[0.08] to-cyan-500/[0.05] border-emerald-500/20 overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-white font-semibold text-sm">{scannedData.propertyName}</h3>
                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">
                  <CheckCircle2 className="w-3 h-3 mr-1" />Lido pelo Scanner
                </Badge>
              </div>
              <p className="text-zinc-400 text-xs mb-3">{scannedData.description || ''}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs text-zinc-300">{scannedData.location || '—'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs text-zinc-300">Check-in {scannedData.checkInTime} / Check-out {scannedData.checkOutTime}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Bed className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs text-zinc-300">{scannedData.totalRooms ?? '—'} quartos</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs text-zinc-300 truncate">{(scannedData.aiVoiceTone || '').split('—')[0]}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {scannedData.amenities.map((amenity) => (
                  <Badge key={amenity} variant="outline" className="text-[10px] border-emerald-500/20 text-emerald-300 bg-emerald-500/5">
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
        <Card className="bg-[#111118] border-zinc-800/60 hover:border-emerald-500/30 transition-colors">
          <CardHeader className="pb-2">
            <CardDescription className="text-zinc-400 text-xs uppercase tracking-wider">MRR Estimado</CardDescription>
            <CardTitle className="text-2xl font-bold text-white">
              {formatCurrency(totalMRR)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1.5 text-emerald-400 text-sm">
              <TrendingUp className="size-4" />
              <span>+12.5% vs mês anterior</span>
            </div>
          </CardContent>
        </Card>

        {/* Conversion Rate Card */}
        <Card className="bg-[#111118] border-zinc-800/60 hover:border-emerald-500/30 transition-colors">
          <CardHeader className="pb-2">
            <CardDescription className="text-zinc-400 text-xs uppercase tracking-wider">Taxa de Conversão</CardDescription>
            <CardTitle className="text-2xl font-bold text-white">{conversionRate}%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1.5 text-emerald-400 text-sm">
              <ArrowUpRight className="size-4" />
              <span>Contatos → Reservas</span>
            </div>
          </CardContent>
        </Card>

        {/* Active Guests Card */}
        <Card className="bg-[#111118] border-zinc-800/60 hover:border-emerald-500/30 transition-colors">
          <CardHeader className="pb-2">
            <CardDescription className="text-zinc-400 text-xs uppercase tracking-wider">Hóspedes Ativos</CardDescription>
            <CardTitle className="text-2xl font-bold text-white">{totalGuests}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1.5 text-amber-400 text-sm">
              <Users className="size-4" />
              <span>{confirmedCount} confirmados</span>
            </div>
          </CardContent>
        </Card>

        {/* Avg Ticket Card */}
        <Card className="bg-[#111118] border-zinc-800/60 hover:border-emerald-500/30 transition-colors">
          <CardHeader className="pb-2">
            <CardDescription className="text-zinc-400 text-xs uppercase tracking-wider">Ticket Médio</CardDescription>
            <CardTitle className="text-2xl font-bold text-white">R$ 1.229</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1.5 text-rose-400 text-sm">
              <ArrowDownRight className="size-4" />
              <span>-3.2% vs mês anterior</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Trend Chart - 2 cols */}
        <Card className="lg:col-span-2 bg-[#111118] border-zinc-800/60">
          <CardHeader>
            <CardTitle className="text-base text-white">Receita dos Últimos 30 Dias</CardTitle>
            <CardDescription className="text-zinc-500">Evolução diária de faturamento</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={revenueChartConfig} className="h-[260px] w-full">
              <LineChart data={revenueTrendData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                <XAxis dataKey="day" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  formatter={(value: number) => [formatCurrency(value), 'Receita']}
                />
                <Line
                  type="monotone"
                  dataKey="receita"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: '#10b981', stroke: '#0a0a0f', strokeWidth: 2 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Payment Method Donut Chart */}
        <Card className="bg-[#111118] border-zinc-800/60">
          <CardHeader>
            <CardTitle className="text-base text-white">Métodos de Pagamento</CardTitle>
            <CardDescription className="text-zinc-500">Volume por método</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <ChartContainer config={paymentChartConfig} className="h-[180px] w-full">
              <PieChart>
                <Pie
                  data={paymentMethodData}
                  dataKey="value"
                  nameKey="method"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  strokeWidth={0}
                >
                  {paymentMethodData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  formatter={(value: number) => [formatCurrency(value)]}
                />
              </PieChart>
            </ChartContainer>
            <div className="flex flex-col gap-2 mt-3 w-full">
              {paymentMethodData.map((item) => (
                <div key={item.method} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="size-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                    <span className="text-zinc-400">{item.method}</span>
                  </div>
                  <span className="text-white font-medium">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Occupancy Bar Chart + Transactions Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Occupancy Bar Chart */}
        <Card className="bg-[#111118] border-zinc-800/60">
          <CardHeader>
            <CardTitle className="text-base text-white">Taxa de Ocupação</CardTitle>
            <CardDescription className="text-zinc-500">Semanal (%)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={occupancyChartConfig} className="h-[200px] w-full">
              <BarChart data={weeklyOccupancyData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                <XAxis dataKey="week" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  formatter={(value: number) => [`${value}%`, 'Taxa']}
                />
                <Bar dataKey="taxa" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Recent Transactions Table */}
        <Card className="lg:col-span-2 bg-[#111118] border-zinc-800/60">
          <CardHeader>
            <CardTitle className="text-base text-white">Transações Recentes</CardTitle>
            <CardDescription className="text-zinc-500">Últimos recebimentos e reembolsos</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[280px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-500">Hóspede</TableHead>
                    <TableHead className="text-zinc-500 hidden sm:table-cell">Descrição</TableHead>
                    <TableHead className="text-zinc-500">Método</TableHead>
                    <TableHead className="text-zinc-500 text-right">Valor</TableHead>
                    <TableHead className="text-zinc-500">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTransactions.map((tx) => (
                    <TableRow key={tx.id} className="border-zinc-800/50 hover:bg-zinc-800/30">
                      <TableCell className="text-white font-medium text-sm">{tx.guest}</TableCell>
                      <TableCell className="text-zinc-400 text-sm hidden sm:table-cell max-w-[200px] truncate">{tx.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${tx.method === 'PIX' ? 'border-emerald-500/30 text-emerald-400' : tx.method === 'Cartão' ? 'border-amber-500/30 text-amber-400' : 'border-zinc-500/30 text-zinc-400'}`}>
                          {tx.method === 'PIX' ? <QrCode className="size-3 mr-1" /> : tx.method === 'Cartão' ? <CreditCard className="size-3 mr-1" /> : <DollarSign className="size-3 mr-1" />}
                          {tx.method}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-medium text-sm ${tx.amount < 0 ? 'text-rose-400' : 'text-white'}`}>
                        {formatCurrency(tx.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${getTransactionStatusColor(tx.status)}`}>
                          {tx.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );

  const renderHospedes = () => {
    const columns: { id: string; title: string; color: string; accentBg: string; dotColor: string }[] = [
      { id: 'atendimento-ia', title: 'Atendimento IA', color: 'text-amber-400', accentBg: 'bg-amber-500/10', dotColor: 'bg-amber-400' },
      { id: 'aguardando-pagamento', title: 'Aguardando Pagamento', color: 'text-orange-400', accentBg: 'bg-orange-500/10', dotColor: 'bg-orange-400' },
      { id: 'confirmado', title: 'Confirmado', color: 'text-emerald-400', accentBg: 'bg-emerald-500/10', dotColor: 'bg-emerald-400' },
      { id: 'checkin-hoje', title: 'Check-in Hoje', color: 'text-blue-400', accentBg: 'bg-blue-500/10', dotColor: 'bg-blue-400' },
    ];

    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-4"
      >
        {/* Header stats */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Pipeline de Hóspedes</h2>
            <p className="text-sm text-zinc-500">{totalGuests} hóspedes no funil</p>
          </div>
          <Button
            onClick={() => setIsAddGuestOpen(true)}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-95 transition-all"
          >
            <Plus className="size-4 mr-1" />
            Novo Hóspede
          </Button>
        </div>

        {/* Kanban Board */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {columns.map((col) => (
            <div key={col.id} className="space-y-3">
              {/* Column Header */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${col.accentBg}`}>
                <div className={`size-2.5 rounded-full ${col.dotColor}`} />
                <span className={`text-sm font-medium ${col.color}`}>{col.title}</span>
                <Badge variant="outline" className="ml-auto text-xs border-zinc-700 text-zinc-400">
                  {(guestsState[col.id] || []).length}
                </Badge>
              </div>

              {/* Column Cards */}
              <div className="space-y-2">
                {(guestsState[col.id] || []).map((guest, idx) => (
                  <motion.div
                    key={guest.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: idx * 0.05 }}
                  >
                    <Card className="bg-[#111118] border-zinc-800/60 hover:border-zinc-700 transition-colors cursor-pointer group">
                      <CardContent className="p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-white">{guest.name}</span>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getSourceColor(guest.source)}`}>
                            {guest.source}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                            <Bed className="size-3" />
                            <span>{guest.roomType}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                            <Calendar className="size-3" />
                            <span>{guest.checkIn} → {guest.checkOut}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-zinc-800/50">
                          <span className="text-sm font-semibold text-emerald-400">{formatCurrency(guest.value)}</span>
                          <ChevronRight className="size-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    );
  };

  const renderCerebro = () => {
    const completedCount = trainingItems.filter((t) => t.status === 'completo').length;
    const totalItems = trainingItems.length;
    const progressPercent = Math.round((completedCount / totalItems) * 100);

    const handleTrainSubmit = () => {
      if (trainingUrl.trim()) {
        setIsTraining(true);
        setTimeout(() => setIsTraining(false), 3000);
      }
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        {/* Magic Onboarding */}
        <Card className="bg-[#111118] border-zinc-800/60 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
          <CardHeader className="relative">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-emerald-400" />
              <CardTitle className="text-base text-white">Onboarding Mágico</CardTitle>
            </div>
            <CardDescription className="text-zinc-400">
              Insira o link do site da pousada ou suba um PDF para treinar a IA
            </CardDescription>
          </CardHeader>
          <CardContent className="relative space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
                <Input
                  placeholder="https://www.suapousada.com.br"
                  value={trainingUrl}
                  onChange={(e) => setTrainingUrl(e.target.value)}
                  className="pl-10 bg-[#0a0a0f] border-zinc-700 text-white placeholder:text-zinc-600 focus:border-emerald-500/50"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleTrainSubmit}
                  disabled={isTraining || !trainingUrl.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[120px]"
                >
                  {isTraining ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      Treinando
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4 mr-2" />
                      Treinar IA
                    </>
                  )}
                </Button>
                <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white">
                  <Upload className="size-4 mr-2" />
                  PDF
                </Button>
              </div>
            </div>

            {/* Training Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Progresso do treinamento</span>
                <span className="text-emerald-400 font-medium">{progressPercent}% ({completedCount}/{totalItems})</span>
              </div>
              <Progress value={progressPercent} className="h-2 bg-zinc-800 [&>div]:bg-emerald-500" />
            </div>
          </CardContent>
        </Card>

        {/* Training Items Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {trainingItems.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.05 }}
            >
              <Card className={`bg-[#111118] border-zinc-800/60 hover:border-zinc-700 transition-colors ${item.status === 'em progresso' ? 'border-amber-500/30' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${getTrainingStatusColor(item.status)}`}>
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{item.title}</span>
                        {getTrainingStatusIcon(item.status)}
                      </div>
                      <span className={`text-xs capitalize ${item.status === 'completo' ? 'text-emerald-400' : item.status === 'em progresso' ? 'text-amber-400' : 'text-zinc-500'}`}>
                        {item.status === 'completo' ? 'Concluído' : item.status === 'em progresso' ? 'Em progresso' : 'Pendente'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* AI Knowledge Base Summary */}
        <Card className="bg-[#111118] border-zinc-800/60">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Brain className="size-5 text-emerald-400" />
              <CardTitle className="text-base text-white">Base de Conhecimento da IA</CardTitle>
            </div>
            <CardDescription className="text-zinc-400">
              Resumo do que a Recepcionista ZÉLLA já aprendeu
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#0a0a0f] rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-emerald-400">{completedCount}</div>
                <div className="text-xs text-zinc-500">Módulos</div>
              </div>
              <div className="bg-[#0a0a0f] rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-white">47</div>
                <div className="text-xs text-zinc-500">Páginas Lidas</div>
              </div>
              <div className="bg-[#0a0a0f] rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-white">23</div>
                <div className="text-xs text-zinc-500">Perguntas Mapeadas</div>
              </div>
              <div className="bg-[#0a0a0f] rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-emerald-400">92%</div>
                <div className="text-xs text-zinc-500">Confiança</div>
              </div>
            </div>

            <Separator className="bg-zinc-800" />

            <div className="space-y-2">
              <p className="text-sm text-zinc-400">
                A <span className="text-emerald-400 font-medium">Recepcionista ZÉLLA</span> já pode responder sobre horários, preços, café da manhã e regras da piscina. Complete o treinamento de políticas de cancelamento e atrações turísticas para atingir 100%.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  const renderConfig = () => (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Profile Info */}
      <Card className="bg-[#111118] border-zinc-800/60">
        <CardHeader>
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Building2 className="size-4 text-emerald-400" />
            Perfil da Pousada
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="size-16 border-2 border-emerald-500/30">
              <AvatarFallback className="bg-emerald-500/10 text-emerald-400 text-lg font-bold">
                {(scannedData.propertyName ?? '?').split(' ').map(n => n[0]).join('').slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-white font-semibold text-lg">{scannedData.propertyName}</h3>
              <p className="text-zinc-400 text-sm">CNPJ: 12.345.678/0001-90</p>
            </div>
          </div>
          <Separator className="bg-zinc-800" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-zinc-500 uppercase tracking-wider">Nome</label>
              <Input defaultValue="Pousada Recanto Verde" className="bg-[#0a0a0f] border-zinc-700 text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-zinc-500 uppercase tracking-wider">E-mail</label>
              <Input defaultValue="contato@recantoverde.com.br" className="bg-[#0a0a0f] border-zinc-700 text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-zinc-500 uppercase tracking-wider">Telefone</label>
              <Input defaultValue="(24) 99999-0000" className="bg-[#0a0a0f] border-zinc-700 text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-zinc-500 uppercase tracking-wider">Cidade</label>
              <Input defaultValue="Teresópolis - RJ" className="bg-[#0a0a0f] border-zinc-700 text-white" />
            </div>
          </div>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
            Salvar Alterações
          </Button>
        </CardContent>
      </Card>

      {/* Plan Info */}
      <Card className="bg-[#111118] border-zinc-800/60 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
        <CardHeader className="relative">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Star className="size-4 text-amber-400" />
            Plano Atual
          </CardTitle>
        </CardHeader>
        <CardContent className="relative space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 text-sm px-3 py-1">
                <Zap className="size-3.5 mr-1.5" />
                Pro
              </Badge>
              <p className="text-zinc-400 text-sm mt-2">R$ 197/mês · Renovação em 15/04/2025</p>
            </div>
            <Button variant="outline" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300">
              <Zap className="size-4 mr-1.5" />
              Upgrade Elite
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#0a0a0f] rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-white">500</div>
              <div className="text-xs text-zinc-500">Conversas/mês</div>
            </div>
            <div className="bg-[#0a0a0f] rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-white">3</div>
              <div className="text-xs text-zinc-500">Integrações</div>
            </div>
            <div className="bg-[#0a0a0f] rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-emerald-400">✓</div>
              <div className="text-xs text-zinc-500">IA Avançada</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp Connection */}
      <Card className="bg-[#111118] border-zinc-800/60">
        <CardHeader>
          <CardTitle className="text-base text-white flex items-center gap-2">
            <MessageSquare className="size-4 text-emerald-400" />
            Conexão WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-[#0a0a0f] rounded-lg">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <Phone className="size-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">WhatsApp Business</p>
                <p className="text-xs text-zinc-500">(24) 99999-0000</p>
              </div>
            </div>
            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
              <CheckCircle2 className="size-3 mr-1" />
              Conectado
            </Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Resposta automática</span>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Modo ausência</span>
            <Switch />
          </div>
        </CardContent>
      </Card>

      {/* Integration Settings */}
      <Card className="bg-[#111118] border-zinc-800/60">
        <CardHeader>
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Globe className="size-4 text-emerald-400" />
            Integrações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { name: 'Booking.com', status: 'conectado', icon: <Globe className="size-4 text-blue-400" /> },
            { name: 'Airbnb', status: 'conectado', icon: <Globe className="size-4 text-rose-400" /> },
            { name: 'Google Calendar', status: 'pendente', icon: <Calendar className="size-4 text-zinc-400" /> },
            { name: 'Mercado Pago', status: 'pendente', icon: <CreditCard className="size-4 text-zinc-400" /> },
          ].map((integration) => (
            <div key={integration.name} className="flex items-center justify-between p-3 bg-[#0a0a0f] rounded-lg">
              <div className="flex items-center gap-3">
                {integration.icon}
                <span className="text-sm text-white">{integration.name}</span>
              </div>
              {integration.status === 'conectado' ? (
                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 text-xs">
                  Conectado
                </Badge>
              ) : (
                <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white text-xs">
                  Conectar
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <DDCShell
      niche="pousada"
      navItems={pousadaNavItems}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as PousadaTab)}
      propertyName={scannedData.propertyName}
    >
      <AnimatePresence mode="wait">
        {activeTab === 'financeiro' && <div key="financeiro">{renderFinanceiro()}</div>}
        {activeTab === 'hospedes' && <div key="hospedes">{renderHospedes()}</div>}
        {activeTab === 'cerebro' && <div key="cerebro">{renderCerebro()}</div>}
        {activeTab === 'simulador' && (
          <div key="simulador">
            <ZellaSimulator niche="pousada" propertyData={scannedData} />
          </div>
        )}
        {activeTab === 'whatsapp' && (
          <div key="whatsapp">
            <WhatsAppDeviceManager niche="pousada" propertyName={scannedData.propertyName} />
          </div>
        )}
        {activeTab === 'guia' && (
          <div key="guia">
            <GuestGuidePanel niche="pousada" propertyName={scannedData.propertyName} />
          </div>
        )}
        {activeTab === 'integracoes' && (
          <div key="integracoes">
            <BookingSyncPanel niche="pousada" propertyName={scannedData.propertyName} />
          </div>
        )}
      {/* Modal: Novo Hóspede */}
      <Dialog open={isAddGuestOpen} onOpenChange={setIsAddGuestOpen}>
        <DialogContent className="bg-[#111118] border-zinc-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-emerald-400">
              <Plus className="size-5" /> Novo Hóspede no Funil
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Cadastre manualmente uma reserva ou pré-reserva para acompanhar no Kanban.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Nome do Hóspede</label>
              <Input
                placeholder="Ex: João da Silva"
                value={newGuestForm.name}
                onChange={(e) => setNewGuestForm({ ...newGuestForm, name: e.target.value })}
                className="bg-[#0a0a0f] border-zinc-700 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Acomodação</label>
                <Input
                  placeholder="Ex: Suíte Master"
                  value={newGuestForm.roomType}
                  onChange={(e) => setNewGuestForm({ ...newGuestForm, roomType: e.target.value })}
                  className="bg-[#0a0a0f] border-zinc-700 text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Valor Estimado (R$)</label>
                <Input
                  type="number"
                  placeholder="1200"
                  value={newGuestForm.value}
                  onChange={(e) => setNewGuestForm({ ...newGuestForm, value: Number(e.target.value) })}
                  className="bg-[#0a0a0f] border-zinc-700 text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Check-in</label>
                <Input
                  placeholder="15/03"
                  value={newGuestForm.checkIn}
                  onChange={(e) => setNewGuestForm({ ...newGuestForm, checkIn: e.target.value })}
                  className="bg-[#0a0a0f] border-zinc-700 text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Check-out</label>
                <Input
                  placeholder="18/03"
                  value={newGuestForm.checkOut}
                  onChange={(e) => setNewGuestForm({ ...newGuestForm, checkOut: e.target.value })}
                  className="bg-[#0a0a0f] border-zinc-700 text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Canal</label>
                <select
                  value={newGuestForm.source}
                  onChange={(e) => setNewGuestForm({ ...newGuestForm, source: e.target.value as any })}
                  className="w-full h-9 rounded-md bg-[#0a0a0f] border border-zinc-700 text-white px-3 text-sm"
                >
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Booking">Booking.com</option>
                  <option value="Airbnb">Airbnb</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Estágio do Funil</label>
                <select
                  value={newGuestForm.column}
                  onChange={(e) => setNewGuestForm({ ...newGuestForm, column: e.target.value })}
                  className="w-full h-9 rounded-md bg-[#0a0a0f] border border-zinc-700 text-white px-3 text-sm"
                >
                  <option value="atendimento-ia">Atendimento IA</option>
                  <option value="aguardando-pagamento">Aguardando Pagamento</option>
                  <option value="confirmado">Confirmado</option>
                  <option value="checkin-hoje">Check-in Hoje</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setIsAddGuestOpen(false)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddGuest}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              Salvar Hóspede
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DDCShell>
  );
}
