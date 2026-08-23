"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface PanelHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Cabeçalho padrão de cada painel do ZCC.
 * Usa os mesmos tokens da sidebar (bg-card, border, text-foreground)
 * para garantir consistência visual em toda a central de controle.
 */
export function PanelHeader({
  title,
  description,
  icon,
  actions,
  className,
}: PanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/60 px-4 py-3 sm:px-6",
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {icon ? (
          <div className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-background text-primary">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-foreground sm:text-lg">
            {title}
          </h2>
          {description ? (
            <p className="truncate text-xs text-muted-foreground sm:text-sm">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
