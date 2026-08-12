"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "primary" | "warning" | "danger";
  className?: string;
}

const TONE_STYLES: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "border-border",
  primary: "border-primary/30 bg-primary/5",
  warning: "border-amber-500/30 bg-amber-500/5",
  danger: "border-destructive/30 bg-destructive/5",
};

/**
 * Card de métrica compacto — usado em painéis do ZCC.
 * Mesmo padrão visual (bg-card, border, texto) da sidebar.
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 sm:p-4",
        TONE_STYLES[tone],
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground sm:text-xs">
          {label}
        </span>
        {icon ? (
          <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
        ) : null}
      </div>
      <div className="mt-1 text-xl font-semibold text-foreground sm:text-2xl">
        {value}
      </div>
      {hint ? (
        <div className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
