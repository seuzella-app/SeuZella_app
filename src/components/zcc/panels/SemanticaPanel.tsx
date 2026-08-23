// src/components/zcc/panels/SemanticaPanel.tsx
'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Network, Database, Cpu, CheckCircle2, AlertTriangle } from 'lucide-react';

export function SemanticaPanel() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold tracking-tight">Métricas do Grafo Semântico & GraphRAG</h2>
        <p className="text-sm text-muted-foreground">
          Monitoramento ontológico de regras, desambiguação e eficiência de cache em tempo real.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Semantic Cache Hit Rate</CardTitle>
            <Database className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">31.4%</div>
            <p className="text-xs text-muted-foreground">Meta: 25% a 35% (Redução de 35% de custo LLM)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Latência de Resolução</CardTitle>
            <Cpu className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">840ms</div>
            <p className="text-xs text-muted-foreground">P95 abaixo do teto de 1.96s</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Arestas SUPERSEDES</CardTitle>
            <Network className="w-4 h-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">142 ativas</div>
            <p className="text-xs text-muted-foreground">Conflitos de regras sobrepostos com sucesso</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Desambiguação</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">99.8%</div>
            <p className="text-xs text-muted-foreground">Zero alucinações em horários de check-in</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Network className="w-4 h-4 text-primary" />
            Estrutura Ontológica em Memória (Semantica Core)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-3 rounded-lg border bg-muted/30">
              <span className="font-semibold block mb-1">Nós de Domínio (Nodes)</span>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• <code>POLICY</code>: Regras de cancelamento e pets</li>
                <li>• <code>RULE</code>: Horários de check-in/out e café</li>
                <li>• <code>PRICING</code>: Tarifário base e diárias dinâmicas</li>
              </ul>
            </div>

            <div className="p-3 rounded-lg border bg-muted/30">
              <span className="font-semibold block mb-1">Relações Hierárquicas (Edges)</span>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• <code>SUPERSEDES</code>: Regra da pousada sobrepõe regra geral</li>
                <li>• <code>FORBIDS</code>: Bloqueio estrito de acesso sem PIX</li>
                <li>• <code>REQUIRES</code>: Exige caução/FNRH antes do PIN</li>
              </ul>
            </div>

            <div className="p-3 rounded-lg border bg-muted/30">
              <span className="font-semibold block mb-1">Status de Resolução de Conflitos</span>
              <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Nenhum ciclo infinito ou conflito ontológico pendente</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SemanticaPanel;
