'use client';

// ==============================================================================
// INDICATIONS TAB — PARCEIRO plan tab (R$247/mês)
// ==============================================================================
// Central de Indicações: referral pipeline + commission tracker.
// This is the KILLER FEATURE of the PARCEIRO plan — without this tab, the
// PARCEIRO plan had ZERO visible benefit over LITE despite costing R$50 more.
//
// Features:
//   - Personalized referral link with copy button
//   - Conversion pipeline (Clicou → Cadastrou → Trial → Convertido)
//   - Commission tracker (R$50 per converted indication)
//   - Available for withdrawal / pending / total received
//   - Recent indications table with status
//   - PIX withdrawal request button (mock)
//   - Selo Parceiro Zélla verificado badge
// ==============================================================================

import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Gift,
  Copy,
  Check,
  TrendingUp,
  Users,
  DollarSign,
  Wallet,
  Star,
  ChevronRight,
  Sparkles,
  Award,
  Link as LinkIcon,
  Clock,
  CheckCircle2,
  ArrowRight,
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
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ─── Types ───────────────────────────────────────────────────────────────────

type IndicationStatus = 'clicked' | 'registered' | 'trial' | 'converted' | 'churned';

interface Indication {
  id: string;
  name: string;
  email: string;
  property: string;
  status: IndicationStatus;
  commission: number;
  date: string;
}

// ─── Mock Data (MODO MOCK — conforme Auditoria Forense v2.0) ─────────────────

const REFERRAL_CODE = 'ZELLA-PARC-2026';
const REFERRAL_LINK = `https://seuzella.com/?ref=${REFERRAL_CODE}`;

const PIPELINE_STAGES: { id: IndicationStatus; label: string; count: number; color: string }[] = [
  { id: 'clicked', label: 'Clicou no link', count: 87, color: 'bg-zinc-500' },
  { id: 'registered', label: 'Cadastrou', count: 34, color: 'bg-blue-500' },
  { id: 'trial', label: 'Iniciou Trial', count: 18, color: 'bg-amber-500' },
  { id: 'converted', label: 'Convertido', count: 11, color: 'bg-emerald-500' },
];

const MOCK_INDICATIONS: Indication[] = [
  { id: '1', name: 'Pousada Recanto das Águas', email: 'contato@recantoaguas.com.br', property: 'Pousada', status: 'converted', commission: 50, date: '12/08/2026' },
  { id: '2', name: 'Chalé Vista Serra', email: 'reservas@vistaserra.com', property: 'Airbnb', status: 'converted', commission: 50, date: '08/08/2026' },
  { id: '3', name: 'Ana Beatriz Host', email: 'ana.host@gmail.com', property: 'Airbnb', status: 'trial', commission: 0, date: '05/08/2026' },
  { id: '4', name: 'Pousada Maré Cheia', email: 'marecheia@hotmail.com', property: 'Pousada', status: 'trial', commission: 0, date: '03/08/2026' },
  { id: '5', name: 'Studio Centro SP', email: 'studio.centralsp@gmail.com', property: 'Airbnb', status: 'registered', commission: 0, date: '01/08/2026' },
  { id: '6', name: 'Recanto Família Lima', email: 'familia.lima@uol.com.br', property: 'Pousada', status: 'converted', commission: 50, date: '28/07/2026' },
  { id: '7', name: 'Flats Beira Mar Fortaleza', email: 'flats.beiramarr@gmail.com', property: 'Airbnb', status: 'clicked', commission: 0, date: '25/07/2026' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getStatusBadge(status: IndicationStatus) {
  const map = {
    clicked: { label: 'Clicou', variant: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' },
    registered: { label: 'Cadastrou', variant: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
    trial: { label: 'Em Trial', variant: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    converted: { label: 'Convertido', variant: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    churned: { label: 'Perdido', variant: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
  } as const;
  const cfg = map[status];
  return (
    <Badge variant="outline" className={`text-[9px] font-mono uppercase ${cfg.variant}`}>
      {cfg.label}
    </Badge>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function IndicationsTab() {
  const [copied, setCopied] = useState(false);
  const [isRequestingWithdrawal, setIsRequestingWithdrawal] = useState(false);

  const totalReceived = MOCK_INDICATIONS.reduce((acc, i) => acc + i.commission, 0);
  const convertedCount = MOCK_INDICATIONS.filter(i => i.status === 'converted').length;
  const availableForWithdrawal = totalReceived; // mock — assume all available
  const pending = 0;
  const conversionRate = ((convertedCount / 87) * 100).toFixed(1);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(REFERRAL_LINK);
      setCopied(true);
      toast.success('Link de indicação copiado!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Não foi possível copiar o link.');
    }
  };

  const handleRequestWithdrawal = () => {
    if (availableForWithdrawal < 100) {
      toast.error('Valor mínimo para saque: R$ 100,00');
      return;
    }
    setIsRequestingWithdrawal(true);
    setTimeout(() => {
      setIsRequestingWithdrawal(false);
      toast.success(`Saque de ${formatBRL(availableForWithdrawal)} solicitado! Chegará via PIX em até 24h.`);
    }, 1800);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Hero — Parceiro Zélla Banner */}
      <Card className="relative overflow-hidden border-purple-500/30 bg-gradient-to-r from-purple-500/[0.08] via-fuchsia-500/[0.05] to-purple-500/[0.08]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <CardContent className="relative p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
                <Award className="w-6 h-6 text-purple-300" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-bold text-white">Central de Indicações</h2>
                  <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px] font-mono uppercase">
                    <Star className="w-3 h-3 mr-1 fill-current" />
                    Parceiro Verificado
                  </Badge>
                </div>
                <p className="text-sm text-white/60 max-w-xl">
                  Monetize sua rede indicando pousadas e anfitriões para o Seu Zélla.
                  Ganhe <strong className="text-emerald-400">R$ 50</strong> por cada indicação convertida.
                </p>
              </div>
            </div>

            {/* Available for withdrawal card */}
            <div className="bg-black/30 border border-purple-500/30 rounded-xl p-3 min-w-[200px]">
              <div className="flex items-center gap-1.5 mb-1">
                <Wallet className="w-3.5 h-3.5 text-purple-300" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/50">
                  Disponível para saque
                </span>
              </div>
              <div className="text-2xl font-bold text-emerald-400 mb-2">
                {formatBRL(availableForWithdrawal)}
              </div>
              <Button
                size="sm"
                onClick={handleRequestWithdrawal}
                disabled={isRequestingWithdrawal || availableForWithdrawal < 100}
                className="w-full bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/40"
              >
                {isRequestingWithdrawal ? (
                  <>
                    <Clock className="w-3 h-3 mr-1.5 animate-spin" />
                    Solicitando...
                  </>
                ) : (
                  <>
                    <Wallet className="w-3 h-3 mr-1.5" />
                    Solicitar saque PIX
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Referral Link Section */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-purple-400" />
            Seu link de indicação
          </CardTitle>
          <CardDescription className="text-xs">
            Compartilhe este link. Qualquer pousada ou anfitrião que se cadastrar por ele é sua indicação.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2.5 rounded-lg bg-black/40 border border-white/[0.06] font-mono text-xs text-purple-200 truncate">
              {REFERRAL_LINK}
            </div>
            <Button
              onClick={handleCopyLink}
              variant="outline"
              className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10 hover:text-purple-200"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-1.5" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1.5" />
                  Copiar
                </>
              )}
            </Button>
          </div>
          <div className="mt-3 flex items-center gap-3 text-[10px] text-white/40 font-mono">
            <span>Código: <strong className="text-purple-300">{REFERRAL_CODE}</strong></span>
            <span>•</span>
            <span>Recompensa: <strong className="text-emerald-400">R$ 50</strong> por conversão</span>
            <span>•</span>
            <span>Saque mínimo: R$ 100</span>
          </div>
        </CardContent>
      </Card>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Recebido', value: formatBRL(totalReceived), icon: DollarSign, color: 'text-emerald-400' },
          { label: 'Conversões', value: String(convertedCount), icon: CheckCircle2, color: 'text-purple-400' },
          { label: 'Taxa de Conversão', value: `${conversionRate}%`, icon: TrendingUp, color: 'text-blue-400' },
          { label: 'Cliques no Link', value: '87', icon: Users, color: 'text-amber-400' },
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

      {/* Conversion Pipeline */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            Funil de Conversão
          </CardTitle>
          <CardDescription className="text-xs">
            Acompanhe a jornada de cada indicação desde o clique até a conversão.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {PIPELINE_STAGES.map((stage, idx) => {
              const conversionVsFirst = ((stage.count / PIPELINE_STAGES[0].count) * 100).toFixed(0);
              return (
                <motion.div
                  key={stage.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.08 }}
                  className="relative"
                >
                  <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                      {idx < PIPELINE_STAGES.length - 1 && (
                        <ChevronRight className="w-3 h-3 text-white/20" />
                      )}
                    </div>
                    <div className="text-2xl font-bold text-white mb-0.5">{stage.count}</div>
                    <div className="text-[10px] text-white/50 mb-2">{stage.label}</div>
                    <Progress
                      value={Number(conversionVsFirst)}
                      className="h-1 bg-white/[0.04]"
                    />
                    <div className="text-[9px] text-white/40 mt-1 font-mono">
                      {conversionVsFirst}% do funil
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Indications Table */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" />
            Indicações Recentes
          </CardTitle>
          <CardDescription className="text-xs">
            Últimas 7 indicações — atualizado em tempo real.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[10px] font-mono uppercase text-white/40">Indicação</TableHead>
                <TableHead className="text-[10px] font-mono uppercase text-white/40">Tipo</TableHead>
                <TableHead className="text-[10px] font-mono uppercase text-white/40">Status</TableHead>
                <TableHead className="text-[10px] font-mono uppercase text-white/40 text-right">Comissão</TableHead>
                <TableHead className="text-[10px] font-mono uppercase text-white/40 text-right">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_INDICATIONS.map(ind => (
                <TableRow key={ind.id} className="border-white/[0.04] hover:bg-white/[0.02]">
                  <TableCell>
                    <div className="text-sm font-medium text-white/90">{ind.name}</div>
                    <div className="text-[10px] text-white/40">{ind.email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[9px] ${ind.property === 'Pousada' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-blue-500/10 text-blue-400 border-blue-500/30'}`}>
                      {ind.property}
                    </Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(ind.status)}</TableCell>
                  <TableCell className="text-right">
                    {ind.commission > 0 ? (
                      <span className="text-sm font-bold text-emerald-400">{formatBRL(ind.commission)}</span>
                    ) : (
                      <span className="text-xs text-white/30">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs text-white/40 font-mono">{ind.date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Footer Info */}
      <div className="rounded-xl border border-purple-500/20 bg-purple-500/[0.03] p-4 flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
        <div className="text-xs text-white/60 leading-relaxed">
          <strong className="text-purple-300">Regras da comissão:</strong>{' '}
          você recebe R$ 50 para cada indicação que assinar um plano pago (LITE, PRO, MAX ou PARCEIRO).
          A comissão é creditada após 30 dias de pagamento confirmado.
          Saque mínimo via PIX: R$ 100. Processamento em até 24h úteis.
        </div>
      </div>
    </motion.div>
  );
}
