'use client';

// =============================================================================
// POUSADAS PANEL — Painel Específico do Nicho Pousadas & Hotelaria no ZCC
// =============================================================================
// Central de Controle com dados contundentes sobre Pousadas clientes:
//   - Ocupação Média das Pousadas
//   - Recepção Virtual 24h no WhatsApp
//   - Distribuição de Quartos por Categoria (LITE / PRO / MAX)
//   - Integrações PMS (Desbravador, Hospedin, Hbook, Cloudbeds, Omnibees)
// =============================================================================

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2, Users, TrendingUp, CheckCircle2,
  Calendar, KeyRound, Wifi, ShieldCheck, Sparkles
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface PousadaItem {
  id: string;
  name: string;
  cityState: string;
  rooms: number;
  occupancyPct: number;
  monthlyRevenue: number;
  pmsIntegration: string;
  virtualReceptionActive: boolean;
  activeGuestsCount: number;
}

const MOCK_POUSADAS: PousadaItem[] = [
  {
    id: 'p1',
    name: 'Pousada Maravilha',
    cityState: 'Fernando de Noronha / PE',
    rooms: 14,
    occupancyPct: 94,
    monthlyRevenue: 38500,
    pmsIntegration: 'Cloudbeds',
    virtualReceptionActive: true,
    activeGuestsCount: 12,
  },
  {
    id: 'p2',
    name: 'Pousada Vila Floripa',
    cityState: 'Florianópolis / SC',
    rooms: 8,
    occupancyPct: 88,
    monthlyRevenue: 24700,
    pmsIntegration: 'Hospedin',
    virtualReceptionActive: true,
    activeGuestsCount: 7,
  },
  {
    id: 'p3',
    name: 'Pousada do Ouro',
    cityState: 'Paraty / RJ',
    rooms: 12,
    occupancyPct: 91,
    monthlyRevenue: 31200,
    pmsIntegration: 'Desbravador',
    virtualReceptionActive: true,
    activeGuestsCount: 10,
  },
  {
    id: 'p4',
    name: 'Pousada Quadrado Trancoso',
    cityState: 'Porto Seguro / BA',
    rooms: 10,
    occupancyPct: 96,
    monthlyRevenue: 42000,
    pmsIntegration: 'Omnibees',
    virtualReceptionActive: true,
    activeGuestsCount: 9,
  },
  {
    id: 'p5',
    name: 'Pousada Itamambuca Surf Lodge',
    cityState: 'Ubatuba / SP',
    rooms: 7,
    occupancyPct: 82,
    monthlyRevenue: 19800,
    pmsIntegration: 'Hbook',
    virtualReceptionActive: true,
    activeGuestsCount: 5,
  },
];

export function PousadasPanel() {
  const [selectedPousada, setSelectedPousada] = useState<string | null>(MOCK_POUSADAS[0].id);

  const totalPousadas = MOCK_POUSADAS.length;
  const avgOccupancy = (MOCK_POUSADAS.reduce((s, p) => s + p.occupancyPct, 0) / totalPousadas).toFixed(1);
  const totalRooms = MOCK_POUSADAS.reduce((s, p) => s + p.rooms, 0);
  const totalRevenue = MOCK_POUSADAS.reduce((s, p) => s + p.monthlyRevenue, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <Card className="p-6 border-emerald-500/30 bg-emerald-500/[0.03] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/40">
              <Building2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>Central do Nicho Pousadas & Hotelaria</span>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-mono text-xs">ONLINE</Badge>
              </h2>
              <p className="text-sm text-zinc-400">
                Gestão centralizada da Recepção Virtual, PMS, fechaduras eletrônicas e ocupação em tempo real.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-zinc-950/80 border-white/10">
          <div className="text-xs text-zinc-400 font-mono">POUSADAS ATIVAS</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">{totalPousadas}</div>
          <div className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> 100% com Recepção Virtual
          </div>
        </Card>

        <Card className="p-4 bg-zinc-950/80 border-white/10">
          <div className="text-xs text-zinc-400 font-mono">OCUPAÇÃO MÉDIA</div>
          <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">{avgOccupancy}%</div>
          <div className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-cyan-400" /> +6.4% em relação ao mês anterior
          </div>
        </Card>

        <Card className="p-4 bg-zinc-950/80 border-white/10">
          <div className="text-xs text-zinc-400 font-mono">TOTAL DE QUARTOS</div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1">{totalRooms}</div>
          <div className="text-[11px] text-zinc-500 mt-1">
            Média de {(totalRooms / totalPousadas).toFixed(1)} quartos por pousada
          </div>
        </Card>

        <Card className="p-4 bg-zinc-950/80 border-white/10">
          <div className="text-xs text-zinc-400 font-mono">FATURAMENTO POUSADAS</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            R$ {totalRevenue.toLocaleString('pt-BR')}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Geração de receita no ecossistema</div>
        </Card>
      </div>

      {/* PMS Connections & Integration status */}
      <Card className="p-5 bg-zinc-950/80 border-white/10 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <Wifi className="w-4 h-4 text-emerald-400" />
          <span>Sistemas PMS Conectados às Pousadas</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono">
          {['Desbravador', 'Hospedin', 'Hbook', 'Cloudbeds', 'Omnibees'].map((pms) => (
            <div key={pms} className="p-3 bg-zinc-900 border border-white/10 rounded-md text-center space-y-1">
              <div className="text-zinc-300 font-bold">{pms}</div>
              <div className="text-[10px] text-emerald-400 flex items-center justify-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Conectado
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Pousadas Table */}
      <Card className="p-5 bg-zinc-950/80 border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <span>Pousadas em Operação no Brasil</span>
          </div>
          <span className="text-xs text-zinc-400 font-mono">Clique para inspecionar</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-white/10 text-zinc-400">
                <th className="text-left py-2 px-3">Pousada / Localização</th>
                <th className="text-right py-2 px-3">Quartos</th>
                <th className="text-right py-2 px-3">Ocupação</th>
                <th className="text-right py-2 px-3">PMS</th>
                <th className="text-right py-2 px-3">Hóspedes Ativos</th>
                <th className="text-right py-2 px-3">Receita Mensal</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_POUSADAS.map((p) => {
                const isSelected = selectedPousada === p.id;
                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedPousada(p.id)}
                    className={`border-b border-white/5 cursor-pointer transition-colors ${
                      isSelected ? 'bg-emerald-500/10 border-l-2 border-l-emerald-400' : 'hover:bg-white/5'
                    }`}
                  >
                    <td className="py-3 px-3">
                      <div className="font-bold text-white text-sm">{p.name}</div>
                      <div className="text-zinc-400 text-[11px]">{p.cityState}</div>
                    </td>
                    <td className="py-3 px-3 text-right text-zinc-300">{p.rooms} quartos</td>
                    <td className="py-3 px-3 text-right">
                      <span className="text-emerald-400 font-bold">{p.occupancyPct}%</span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700 text-[10px]">
                        {p.pmsIntegration}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-right text-cyan-400">{p.activeGuestsCount} no local</td>
                    <td className="py-3 px-3 text-right font-bold text-white">
                      R$ {p.monthlyRevenue.toLocaleString('pt-BR')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
