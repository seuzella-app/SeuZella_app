// src/components/zcc/panels/BreakdownPanel.tsx
'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Zap, Sparkles, ShieldCheck } from 'lucide-react';

interface PlanBreakdown {
  name: string;
  rooms: string;
  basePrice: number;
  upsellPotential: number;
  totalEstimated: number;
  highlight?: string;
  color: string;
}

const PLANS_DATA: PlanBreakdown[] = [
  {
    name: 'LITE',
    rooms: '1 a 4 quartos',
    basePrice: 197.0,
    upsellPotential: 85.0,
    totalEstimated: 282.0,
    color: 'border-blue-500/40 bg-blue-500/5',
  },
  {
    name: 'ZÉLLA PARCEIRO',
    rooms: '5 a 12 quartos',
    basePrice: 247.0,
    upsellPotential: 350.0,
    totalEstimated: 597.0,
    highlight: 'Trava 100 Primeiros (24 meses)',
    color: 'border-amber-500/40 bg-amber-500/5',
  },
  {
    name: 'PRO',
    rooms: '5 a 12 quartos',
    basePrice: 397.0,
    upsellPotential: 1170.0,
    totalEstimated: 1567.0,
    color: 'border-emerald-500/40 bg-emerald-500/5',
  },
  {
    name: 'MAX',
    rooms: '13 a 20 quartos',
    basePrice: 797.0,
    upsellPotential: 2550.0,
    totalEstimated: 3347.0,
    highlight: 'Core de Mercado',
    color: 'border-purple-500/40 bg-purple-500/5',
  },
  {
    name: 'MAX PLUS',
    rooms: '21 a 32 quartos',
    basePrice: 1497.0,
    upsellPotential: 4815.0,
    totalEstimated: 6312.0,
    color: 'border-orange-500/40 bg-orange-500/5',
  },
  {
    name: 'ENTERPRISE',
    rooms: '> 32 quartos',
    basePrice: 2497.0,
    upsellPotential: 5003.0,
    totalEstimated: 7500.0,
    highlight: 'Multi-Propriedade / Sob Consulta',
    color: 'border-red-500/40 bg-red-500/5',
  },
];

export function BreakdownPanel() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold tracking-tight">Breakdown Financeiro & Métricas de UPSELL</h2>
        <p className="text-sm text-muted-foreground">
          Estrutura de precificação base combinada com o ganho extra gerado pelo motor ZaosYieldBooster.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PLANS_DATA.map((plan) => (
          <Card key={plan.name} className={`border ${plan.color} relative overflow-hidden`}>
            {plan.highlight && (
              <div className="absolute top-2 right-2">
                <Badge variant="outline" className="text-[10px] bg-background/80 font-mono">
                  {plan.highlight}
                </Badge>
              </div>
            )}
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-bold flex items-center justify-between">
                {plan.name}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{plan.rooms}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-baseline border-b border-border/40 pb-2">
                <span className="text-xs text-muted-foreground">Mensalidade Base:</span>
                <span className="text-base font-semibold">
                  {plan.basePrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <TrendingUp className="w-3.5 h-3.5" /> UPSELL Estimado (Alta Temporada):
                  </span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    +{plan.upsellPotential.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Early/late check-in, taxa pet e taxa de sucesso do Yield Booster.
                </p>
              </div>

              <div className="pt-2 border-t border-border/60 flex justify-between items-baseline">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground/80">
                  Receita Total/Tenant:
                </span>
                <span className="text-lg font-bold text-foreground">
                  {plan.totalEstimated.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default BreakdownPanel;
