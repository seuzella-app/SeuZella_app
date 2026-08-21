// src/components/zcc/panels/LiveAgentsPanel.tsx
'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, DollarSign, RefreshCw } from 'lucide-react';

interface AgentScript {
  id: string;
  domain: string;
  name: string;
  status: 'IDLE' | 'RUNNING' | 'SUCCESS' | 'ALERT';
  lastRun: string;
  costUsd: number;
  mode: 'AUTO' | 'MANUAL_ONLY';
}

const AGENTS_CATALOG: AgentScript[] = [
  { id: 'health-db-check', domain: 'health', name: 'Database & Connection Pool Probe', status: 'SUCCESS', lastRun: '1 min atrás', costUsd: 0.000, mode: 'AUTO' },
  { id: 'anomaly-churn-scan', domain: 'anomaly', name: 'Churn & Takeover Predictor', status: 'SUCCESS', lastRun: '15 min atrás', costUsd: 0.012, mode: 'AUTO' },
  { id: 'remediation-cache-purge', domain: 'remediation', name: 'Semantic Cache Pruning & Sync', status: 'IDLE', lastRun: '2 horas atrás', costUsd: 0.000, mode: 'AUTO' },
  { id: 'finance-mrr-forecast', domain: 'finance', name: 'MRR & Yield Performance Forecast', status: 'SUCCESS', lastRun: '1 hora atrás', costUsd: 0.015, mode: 'AUTO' },
  { id: 'whatsapp-persona-eval', domain: 'whatsapp', name: 'Persona Tone & DPO Evaluator', status: 'RUNNING', lastRun: 'Agora', costUsd: 0.020, mode: 'AUTO' },
  { id: 'security-secret-scan', domain: 'security', name: 'Canary & Secret Leakage Scanner', status: 'SUCCESS', lastRun: '30 min atrás', costUsd: 0.005, mode: 'AUTO' },
  { id: 'code-refactor-suggester', domain: 'code', name: 'AST & Gap-Detector Refactorer', status: 'IDLE', lastRun: '6 horas atrás', costUsd: 0.041, mode: 'MANUAL_ONLY' },
  { id: 'lgpd-pii-scrubber', domain: 'lgpd', name: 'PII Tokenization & Retention Cleaner', status: 'SUCCESS', lastRun: '45 min atrás', costUsd: 0.000, mode: 'AUTO' },
];

export function LiveAgentsPanel() {
  const [agents] = useState<AgentScript[]>(AGENTS_CATALOG);
  const totalCostToday = agents.reduce((acc, curr) => acc + curr.costUsd, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Cérebro Zélla — Agentes Vivos em Tempo Real</h2>
          <p className="text-sm text-muted-foreground">
            Supervisão e auditoria dos 43 scripts autônomos em execução contínua na infraestrutura.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-3 py-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/30 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 animate-pulse" /> 43 Scripts Ativos
          </Badge>
          <Badge variant="outline" className="px-3 py-1 bg-blue-500/10 text-blue-600 border-blue-500/30 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" /> Custo Hoje: ${totalCostToday.toFixed(3)} USD
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Orçamento do Tenant (Budget Guard)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$3.42 / $20.00</div>
            <p className="text-[11px] text-muted-foreground mt-1">17.1% do limite mensal utilizado</p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Scripts em Autonomia Plena</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">26 Scripts</div>
            <p className="text-[11px] text-muted-foreground mt-1">Auto-resolução sem intervenção humana</p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Scripts Críticos (Human-in-the-Loop)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">17 Scripts</div>
            <p className="text-[11px] text-muted-foreground mt-1">Exigem confirmação explícita de admin</p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Circuit Breaker & Falhas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">0 Bloqueios</div>
            <p className="text-[11px] text-muted-foreground mt-1">Taxa de sucesso operacional: 100%</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            <span>Matriz de Execução e Telemetria de Agentes</span>
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
              <RefreshCw className="w-3.5 h-3.5" /> Atualizar Telemetria
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border divide-y divide-border/60">
            {agents.map((agent) => (
              <div key={agent.id} className="p-3.5 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{agent.name}</span>
                    <Badge variant="secondary" className="text-[10px] uppercase font-mono px-1.5 py-0">
                      {agent.domain}
                    </Badge>
                    {agent.mode === 'MANUAL_ONLY' && (
                      <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">
                        Admin Approval Req
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">ID: <code>{agent.id}</code> • Última execução: {agent.lastRun}</p>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-xs font-mono text-muted-foreground">${agent.costUsd.toFixed(3)} USD</span>
                  <Badge
                    className={
                      agent.status === 'SUCCESS'
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                        : agent.status === 'RUNNING'
                        ? 'bg-blue-500/10 text-blue-600 border-blue-500/30 animate-pulse'
                        : 'bg-muted text-muted-foreground'
                    }
                  >
                    {agent.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default LiveAgentsPanel;
