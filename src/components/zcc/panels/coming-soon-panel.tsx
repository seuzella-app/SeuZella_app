"use client";

import * as React from "react";
import { LucideIcon, Sparkles, Wrench } from "lucide-react";
import { PanelHeader } from "../shared/panel-header";

interface ComingSoonPanelProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
}

/**
 * Painel placeholder para abas do ZCC que ainda não foram implementadas.
 * Avisa que está em construção mas mantém a navegação funcional.
 */
export function ComingSoonPanel({ title, description, icon: Icon }: ComingSoonPanelProps) {
  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader
        title={title}
        description={description ?? "Módulo do ZCC em construção"}
        icon={Icon ? <Icon className="size-5" /> : <Sparkles className="size-5" />}
      />
      <div className="zcc-scroll flex flex-1 flex-col items-center justify-center gap-3 overflow-y-auto p-6 text-center">
        <div className="grid size-14 place-items-center rounded-full border border-primary/30 bg-primary/5 text-primary">
          <Wrench className="size-7" />
        </div>
        <div>
          <p className="text-base font-semibold text-foreground">{title}</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Este módulo faz parte da estrutura do ZCC mas ainda não foi
            implementado neste preview. Os dados abaixo são fictícios (mock).
          </p>
        </div>
        <div className="mt-2 rounded-lg border border-border bg-card px-4 py-3 text-left text-xs">
          <p className="mb-1 font-semibold text-foreground">Próximos passos:</p>
          <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
            <li>Definir schema de dados do módulo</li>
            <li>Implementar layout específico</li>
            <li>Conectar à fonte de dados real</li>
            <li>Testar fluxo de interação</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
