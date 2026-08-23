// @ts-nocheck — ZCC visual panel, types fixed in dedicated refactoring pass
"use client";

import * as React from "react";
import {
  Activity,
  UserPlus,
  CalendarCheck,
  MessageSquare,
  AlertTriangle,
  Cog,
  ExternalLink,
  DollarSign,
} from "lucide-react";
import { PanelHeader } from "../shared/panel-header";
import { activity, ddcPanels, relativeTime } from "@/lib/zcc/mock-data";
import type { ActivityEntry } from "@/lib/zcc/types";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<ActivityEntry["type"], React.ReactNode> = {
  lead: <UserPlus className="size-4" />,
  reservation: <CalendarCheck className="size-4" />,
  message: <MessageSquare className="size-4" />,
  alert: <AlertTriangle className="size-4" />,
  payment: <DollarSign className="size-4" />,
  system: <Cog className="size-4" />,
};

const TYPE_COLOR: Record<ActivityEntry["type"], string> = {
  lead: "text-sky-300 bg-sky-500/10 border-sky-500/20",
  reservation: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
  message: "text-violet-300 bg-violet-500/10 border-violet-500/20",
  alert: "text-amber-300 bg-amber-500/10 border-amber-500/20",
  payment: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
  system: "text-muted-foreground bg-secondary border-border",
};

export function ActivityPanel() {
  const [filter, setFilter] = React.useState<ActivityEntry["type"] | "all">("all");

  const filtered = React.useMemo(
    () => (filter === "all" ? activity : activity.filter((a) => a.type === filter)),
    [filter]
  );

  const panelLabel = (id?: string) =>
    id ? ddcPanels.find((p) => p.id === id)?.label : null;

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader
        title="Atividade"
        description="Log de eventos em tempo real do ZCC"
        icon={<Activity className="size-5" />}
      />

      <div className="border-b border-border bg-card/40 px-4 py-2 sm:px-6">
        <div className="zcc-scroll flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {(["all", "lead", "reservation", "message", "alert", "system"] as const).map(
            (f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize transition-colors",
                  filter === f
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                )}
              >
                {f === "all" ? "Tudo" : f === "reservation" ? "Reservas" : f}
              </button>
            )
          )}
        </div>
      </div>

      <div className="zcc-scroll flex-1 overflow-y-auto p-4 sm:p-6">
        <ol className="relative space-y-1 border-l border-border pl-4">
          {filtered.map((entry) => {
            const pl = panelLabel(entry.panel);
            return (
              <li key={entry.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-[1.42rem] grid size-7 place-items-center rounded-full border",
                    TYPE_COLOR[entry.type]
                  )}
                >
                  {TYPE_ICON[entry.type]}
                </span>
                <div className="rounded-md border border-transparent px-2 py-1.5 transition-colors hover:border-border hover:bg-card/60">
                  <p className="text-sm text-foreground">{entry.text}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{relativeTime(entry.at)}</span>
                    {pl ? (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          {pl}
                          <ExternalLink className="size-2.5" />
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
