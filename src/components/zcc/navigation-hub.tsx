"use client";

import * as React from "react";
import {
  ExternalLink,
  Globe,
  LogIn,
  Home as HomeIcon,
  Hotel,
  Smartphone,
  Monitor,
  LayoutDashboard,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * URLs oficiais de produção (Vercel)
 * Conecta todos os painéis do projeto Seu Zélla
 */
const PRODUCTION_URLS_LIST: any[] = [
  {
    id: "landing",
    label: "Landing Page Oficial",
    description: "Site público · SEO · conversão",
    url: "https://smart-hotel-zehla.vercel.app/",
    icon: Globe,
    category: "public",
    color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/5",
  },
  {
    id: "login",
    label: "Login",
    description: "Auth · clientes e parceiros",
    url: "https://smart-hotel-zehla.vercel.app/login",
    icon: LogIn,
    category: "auth",
    color: "text-violet-400 border-violet-500/30 bg-violet-500/5",
  },
  {
    id: "ddc-pousada-web",
    label: "DDC Pousada Web",
    description: "Dashboard Direto · desktop",
    url: "https://smart-hotel-zehla.vercel.app/ddc/pousada",
    icon: Hotel,
    category: "ddc-web",
    color: "text-sky-400 border-sky-500/30 bg-sky-500/5",
  },
  {
    id: "ddc-airbnb-web",
    label: "DDC Airbnb Web",
    description: "Integrador · desktop",
    url: "https://smart-hotel-zehla.vercel.app/ddc/airbnb",
    icon: HomeIcon,
    category: "ddc-web",
    color: "text-rose-400 border-rose-500/30 bg-rose-500/5",
  },
  {
    id: "ddc-pousada-mobile",
    label: "DDC Pousada Mobile",
    description: "PWA · hóspedes",
    url: "https://smart-hotel-zehla.vercel.app/mobile/pousada",
    icon: Smartphone,
    category: "ddc-mobile",
    color: "text-sky-400 border-sky-500/30 bg-sky-500/5",
  },
  {
    id: "ddc-airbnb-mobile",
    label: "DDC Airbnb Mobile",
    description: "PWA · hóspedes",
    url: "https://smart-hotel-zehla.vercel.app/mobile/airbnb",
    icon: Smartphone,
    category: "ddc-mobile",
    color: "text-rose-400 border-rose-500/30 bg-rose-500/5",
  },
  {
    id: "zcc",
    label: "ZCC Control Center",
    description: "Você está aqui",
    url: "https://smart-hotel-zehla.vercel.app/zcc",
    icon: LayoutDashboard,
    category: "zcc",
    color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10 ring-1 ring-emerald-500/20",
    current: true,
  },
] as const;

const CATEGORY_LABEL: Record<string, string> = {
  public: "Público",
  auth: "Autenticação",
  "ddc-web": "DDC Web (desktop)",
  "ddc-mobile": "DDC Mobile (PWA)",
  zcc: "Central",
};

export function NavigationHub({ className }: { className?: string }) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const copyUrl = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const grouped = React.useMemo(() => {
    const groups: Record<string, typeof PRODUCTION_URLS_LIST> = {};
    for (const u of PRODUCTION_URLS_LIST) {
      if (!groups[u.category]) groups[u.category] = [];
      groups[u.category].push(u);
    }
    return groups;
  }, []);

  return (
    <div className={cn("rounded-lg border border-border bg-card p-4", className)}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Globe className="size-4 text-primary" />
            Navigation Hub
          </h3>
          <p className="text-[11px] text-muted-foreground">
            {PRODUCTION_URLS_LIST.length} painéis conectados em produção
          </p>
        </div>
        <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
          {PRODUCTION_URLS_LIST.filter((u) => !("current" in u && u.current)).length + 1} ONLINE
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {PRODUCTION_URLS_LIST.map((u) => {
          const Icon = u.icon;
          return (
            <div
              key={u.id}
              className={cn(
                "group relative rounded-md border p-2.5 transition-all",
                u.color
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Icon className="size-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-semibold text-foreground">
                      {u.label}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {u.description}
                    </p>
                  </div>
                </div>
                {"current" in u && u.current ? (
                  <span className="shrink-0 rounded bg-emerald-500/20 px-1 py-0.5 text-[8px] font-bold uppercase text-emerald-400">
                    aqui
                  </span>
                ) : null}
              </div>
              <div className="mt-1.5 flex items-center gap-1">
                <a
                  href={u.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded border border-border bg-background px-1.5 py-1 text-[10px] font-medium text-foreground hover:bg-secondary"
                >
                  <ExternalLink className="size-3" />
                  Abrir
                </a>
                <button
                  type="button"
                  onClick={() => copyUrl(u.id, u.url)}
                  className="grid size-6 place-items-center rounded border border-border bg-background text-muted-foreground hover:text-foreground"
                  aria-label="Copiar URL"
                  title="Copiar URL"
                >
                  {copiedId === u.id ? (
                    <Check className="size-3 text-emerald-400" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </button>
              </div>
              <p className="mt-1 truncate font-mono text-[9px] text-muted-foreground/70">
                {u.url.replace("https://smart-hotel-zehla.vercel.app", "")}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
