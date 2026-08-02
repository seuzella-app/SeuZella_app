'use client';

// ==============================================================================
// MULTI-PROPERTIES TAB — MAX plan tab (R$797/mês)
// ==============================================================================
// Gestão Multi-Propriedades para o plano MAX (até 12 propriedades).
// Without this tab, multi-property operation was impossible — users had no
// way to switch between properties or see a consolidated view.
//
// Features:
//   - Property switcher with quick-search
//   - Consolidated revenue / occupancy view
//   - Per-property performance breakdown
//   - Team permissions (mock)
//   - Add new property (mock)
// ==============================================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Building2,
  Home,
  Plus,
  Search,
  TrendingUp,
  Users,
  DollarSign,
  Activity,
  Star,
  MapPin,
  ChevronRight,
  Crown,
  Sparkles,
  Eye,
  Edit,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
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
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Property {
  id: string;
  name: string;
  location: string;
  type: 'pousada' | 'airbnb';
  occupancy: number;
  revenue: number;
  rating: number;
  reviews: number;
  status: 'connected' | 'disconnected';
  team: { name: string; role: string }[];
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_PROPERTIES: Property[] = [
  {
    id: '1',
    name: 'Pousada Serenity Paraty',
    location: 'Paraty, RJ',
    type: 'pousada',
    occupancy: 84,
    revenue: 18450,
    rating: 4.9,
    reviews: 312,
    status: 'connected',
    team: [
      { name: 'Ana Maria', role: 'Owner' },
      { name: 'Carlos Silva', role: 'Manager' },
    ],
  },
  {
    id: '2',
    name: 'Apartamento Vista Mar — Copacabana',
    location: 'Rio de Janeiro, RJ',
    type: 'airbnb',
    occupancy: 91,
    revenue: 8450,
    rating: 4.96,
    reviews: 214,
    status: 'connected',
    team: [{ name: 'Ana Maria', role: 'Owner' }],
  },
  {
    id: '3',
    name: 'Chalé Campos do Jordão',
    location: 'Campos do Jordão, SP',
    type: 'airbnb',
    occupancy: 72,
    revenue: 6280,
    rating: 4.85,
    reviews: 156,
    status: 'connected',
    team: [{ name: 'Ana Maria', role: 'Owner' }],
  },
  {
    id: '4',
    name: 'Studio Paulista',
    location: 'São Paulo, SP',
    type: 'airbnb',
    occupancy: 63,
    revenue: 3920,
    rating: 4.78,
    reviews: 89,
    status: 'disconnected',
    team: [{ name: 'Ana Maria', role: 'Owner' }],
  },
];

const PROPERTY_CHART_DATA = MOCK_PROPERTIES.map(p => ({
  name: p.name.split(' — ')[0].split(' ')[0],
  receita: p.revenue,
  ocupacao: p.occupancy,
}));

const propertyChartConfig: ChartConfig = {
  receita: { label: 'Receita', color: '#10b981' },
  ocupacao: { label: 'Ocupação', color: '#3b82f6' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function MultiPropertiesTab() {
  const [properties] = useState<Property[]>(MOCK_PROPERTIES);
  const [search, setSearch] = useState('');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newPropertyName, setNewPropertyName] = useState('');
  const [newPropertyLocation, setNewPropertyLocation] = useState('');

  const totalRevenue = properties.reduce((acc, p) => acc + p.revenue, 0);
  const avgOccupancy = properties.reduce((acc, p) => acc + p.occupancy, 0) / properties.length;
  const connectedCount = properties.filter(p => p.status === 'connected').length;
  const totalReviews = properties.reduce((acc, p) => acc + p.reviews, 0);

  const filtered = properties.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.location.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddProperty = () => {
    if (!newPropertyName.trim() || !newPropertyLocation.trim()) {
      toast.error('Preencha nome e localização da propriedade.');
      return;
    }
    if (properties.length >= 12) {
      toast.error('Limite do plano MAX atingido (12 propriedades).');
      return;
    }
    toast.success(`Propriedade "${newPropertyName}" adicionada! Inicie o Magic Scanner para configurá-la.`);
    setNewPropertyName('');
    setNewPropertyLocation('');
    setIsAddOpen(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Hero Banner */}
      <Card className="relative overflow-hidden border-amber-500/30 bg-gradient-to-r from-amber-500/[0.08] via-orange-500/[0.05] to-amber-500/[0.08]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <CardContent className="relative p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-bold text-white">Gestão Multi-Propriedades</h2>
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-mono uppercase">
                    <Crown className="w-3 h-3 mr-1" />
                    MAX
                  </Badge>
                </div>
                <p className="text-sm text-white/60 max-w-xl">
                  Gerencie até 12 propriedades em uma única conta. Troca rápida, visão consolidada,
                  relatórios por propriedade e permissões por equipe.
                </p>
              </div>
            </div>
            <Button
              onClick={() => setIsAddOpen(true)}
              className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Adicionar Propriedade
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Consolidated KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Propriedades', value: `${properties.length}/12`, icon: Building2, color: 'text-amber-400' },
          { label: 'Receita Consolidada', value: formatBRL(totalRevenue), icon: DollarSign, color: 'text-emerald-400' },
          { label: 'Ocupação Média', value: `${avgOccupancy.toFixed(0)}%`, icon: Activity, color: 'text-blue-400' },
          { label: 'Avaliações', value: String(totalReviews), icon: Star, color: 'text-purple-400' },
        ].map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className={`w-3 h-3 ${kpi.color}`} />
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/50">
                  {kpi.label}
                </span>
              </div>
              <div className="text-xl font-bold text-white">{kpi.value}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Consolidated Chart */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            Receita por Propriedade
          </CardTitle>
          <CardDescription className="text-xs">
            Comparativo de receita e ocupação entre todas as propriedades.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={propertyChartConfig} className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={PROPERTY_CHART_DATA} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="name" stroke="#ffffff60" fontSize={10} />
                <YAxis stroke="#ffffff60" fontSize={10} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="receita" fill="#10b981" radius={[4, 4, 0, 0]} name="Receita (R$)" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Properties List with Search */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Home className="w-4 h-4 text-amber-400" />
                Propriedades
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {filtered.length} de {properties.length} propriedades · {connectedCount} conectadas
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <Input
                placeholder="Buscar propriedade..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 bg-black/30 border-white/[0.06] text-xs"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filtered.map(prop => (
              <motion.div
                key={prop.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-xl border border-white/[0.06] bg-black/20 p-3 hover:border-white/[0.12] transition-all"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${prop.type === 'pousada' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'}`}>
                      {prop.type === 'pousada' ? <Building2 className="w-4 h-4" /> : <Home className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-sm font-semibold text-white truncate">{prop.name}</h3>
                        {prop.status === 'connected' ? (
                          <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shrink-0">
                            <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
                            Conectada
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] bg-rose-500/10 text-rose-400 border-rose-500/30 shrink-0">
                            <AlertCircle className="w-2.5 h-2.5 mr-0.5" />
                            Desconectada
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-white/50 font-mono">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5" />
                          {prop.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="w-2.5 h-2.5 text-amber-400 fill-current" />
                          {prop.rating}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-2.5 h-2.5" />
                          {prop.reviews} reviews
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <div className="text-xs text-white/40 font-mono uppercase">Receita</div>
                      <div className="text-sm font-bold text-emerald-400">{formatBRL(prop.revenue)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-white/40 font-mono uppercase">Ocupação</div>
                      <div className="text-sm font-bold text-blue-400">{prop.occupancy}%</div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedProperty(prop)}
                      className="text-white/60 hover:text-white hover:bg-white/[0.04]"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      Detalhes
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Progress value={prop.occupancy} className="h-1 flex-1" />
                  <span className="text-[9px] text-white/40 font-mono">{prop.occupancy}% ocupado</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Property Details Dialog */}
      <Dialog open={!!selectedProperty} onOpenChange={(open) => !open && setSelectedProperty(null)}>
        <DialogContent className="max-w-lg bg-[#0d0d14] border-white/[0.08]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              {selectedProperty && (
                <>
                  {selectedProperty.type === 'pousada' ? <Building2 className="w-4 h-4 text-emerald-400" /> : <Home className="w-4 h-4 text-blue-400" />}
                  {selectedProperty.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              {selectedProperty?.location}
            </DialogDescription>
          </DialogHeader>
          {selectedProperty && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
                  <div className="text-[10px] text-white/40 font-mono uppercase mb-1">Receita mensal</div>
                  <div className="text-lg font-bold text-emerald-400">{formatBRL(selectedProperty.revenue)}</div>
                </div>
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
                  <div className="text-[10px] text-white/40 font-mono uppercase mb-1">Ocupação</div>
                  <div className="text-lg font-bold text-blue-400">{selectedProperty.occupancy}%</div>
                </div>
              </div>
              <Separator className="bg-white/[0.06]" />
              <div>
                <div className="text-xs font-medium text-white/80 mb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                  Equipe
                </div>
                <div className="space-y-1.5">
                  {selectedProperty.team.map(member => (
                    <div key={member.name} className="flex items-center justify-between rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2">
                      <span className="text-sm text-white/90">{member.name}</span>
                      <Badge variant="outline" className="text-[9px] bg-white/[0.04] text-white/60 border-white/[0.06]">
                        {member.role}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Button variant="outline" size="sm" className="border-white/[0.08] text-white/70 hover:bg-white/[0.04]">
                  <Edit className="w-3.5 h-3.5 mr-1.5" />
                  Editar
                </Button>
                <Button size="sm" className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40">
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Treinar IA
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-emerald-400 hover:bg-emerald-500/10"
                  onClick={() => {
                    toast.success(`Trocando para "${selectedProperty.name}"...`);
                    setSelectedProperty(null);
                  }}
                >
                  Acessar
                  <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Property Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md bg-[#0d0d14] border-white/[0.08]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Plus className="w-4 h-4 text-amber-400" />
              Adicionar Propriedade
            </DialogTitle>
            <DialogDescription className="text-white/50">
              Você tem {properties.length}/12 propriedades no plano MAX.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-mono uppercase text-white/50 mb-1.5 block">
                Nome da propriedade
              </label>
              <Input
                value={newPropertyName}
                onChange={e => setNewPropertyName(e.target.value)}
                placeholder="Ex: Pousada Recanto das Águas"
                className="bg-black/30 border-white/[0.08] text-white"
              />
            </div>
            <div>
              <label className="text-xs font-mono uppercase text-white/50 mb-1.5 block">
                Localização
              </label>
              <Input
                value={newPropertyLocation}
                onChange={e => setNewPropertyLocation(e.target.value)}
                placeholder="Ex: Florianópolis, SC"
                className="bg-black/30 border-white/[0.08] text-white"
              />
            </div>
            <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-2.5 text-[11px] text-white/60">
              <Sparkles className="w-3 h-3 text-amber-400 inline mr-1" />
              Após adicionar, você usará o <strong className="text-amber-300">Magic Scanner</strong> para configurar a IA automaticamente a partir do link do Airbnb ou Booking.
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAddOpen(false)} className="text-white/60 hover:bg-white/[0.04]">
              Cancelar
            </Button>
            <Button
              onClick={handleAddProperty}
              className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
