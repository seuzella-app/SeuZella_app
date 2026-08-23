// src/components/zcc/panels/MobileAnalyticsPanel.tsx
'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Eye, MousePointerClick, Smartphone, ArrowUpRight } from 'lucide-react';

export function MobileAnalyticsPanel() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold tracking-tight">Mobile Analytics & Telemetria do Visitante</h2>
        <p className="text-sm text-muted-foreground">
          Mapeamento do comportamento de navegação na landing page capturado via <code>landing-telemetry.ts</code>.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Tempo Médio na Página (Dwell Time)</CardTitle>
            <Clock className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2m 48s</div>
            <p className="text-[11px] text-emerald-600 flex items-center gap-0.5 mt-1 font-medium">
              <ArrowUpRight className="w-3 h-3" /> +18.4% vs mês anterior
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Profundidade de Rolagem (Scroll)</CardTitle>
            <Eye className="w-4 h-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">78.2%</div>
            <p className="text-[11px] text-muted-foreground mt-1">Alta retenção até a seção de Preços</p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Cliques na Calculadora de ROI</CardTitle>
            <MousePointerClick className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">412 cliques</div>
            <p className="text-[11px] text-emerald-600 mt-1 font-medium">31.3% de conversão para checkout</p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Proporção Mobile vs Desktop</CardTitle>
            <Smartphone className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">84% Mobile</div>
            <p className="text-[11px] text-muted-foreground mt-1">Tráfego oriundo de Instagram e Search</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Engajamento por Seção da Landing Page</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="space-y-1">
              <div className="flex justify-between font-medium">
                <span>Hero / Vídeo Alex Ribeiro</span>
                <span>94% retenção</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: '94%' }} />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between font-medium">
                <span>Diferencial Pousadas vs Airbnb</span>
                <span>82% retenção</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: '82%' }} />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between font-medium">
                <span>Calculadora de Ganho com Precificação Dinâmica</span>
                <span>68% retenção</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: '68%' }} />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between font-medium">
                <span>Tabela de Planos & Assinatura Direta</span>
                <span>54% retenção</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: '54%' }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Distribuição Geográfica de Leads (Top Hotspots)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-border/40">
              <span className="font-medium">1. Litoral de Santa Catarina (Praia do Rosa, Garopaba, Floripa)</span>
              <Badge variant="outline">2.681 leads</Badge>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-border/40">
              <span className="font-medium">2. Litoral Norte de São Paulo (Juquehy, Maresias, Ubatuba)</span>
              <Badge variant="outline">2.140 leads</Badge>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-border/40">
              <span className="font-medium">3. Região dos Lagos / Costa Verde RJ (Búzios, Saquarema, Paraty)</span>
              <Badge variant="outline">1.890 leads</Badge>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="font-medium">4. Litoral Sul da Bahia (Itacaré, Morro de São Paulo, Trancoso)</span>
              <Badge variant="outline">1.403 leads</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default MobileAnalyticsPanel;
