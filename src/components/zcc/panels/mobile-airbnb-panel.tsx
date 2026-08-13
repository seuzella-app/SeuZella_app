"use client";

/**
 * ZCC Panel — DDC Mobile Airbnb (Embed)
 * ======================================
 *
 * Embeda o DDC Mobile do Airbnb dentro do ZCC em um iframe responsivo.
 * Útil para o operador do ZCC visualizar exatamente o que o anfitrião
 * vê no celular, sem precisar abrir nova aba.
 *
 * O iframe aponta para /mobile/airbnb que renderiza o MobileAirbnbSuperApp
 * dentro de um MobilePhoneWrapper (moldura de smartphone).
 */

import * as React from "react";
import { Smartphone, ExternalLink, RefreshCw, Home } from "lucide-react";

export function MobileAirbnbPanel() {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-card/50 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-lg bg-blue-500/15 text-blue-500">
              <Home className="size-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                DDC Mobile — Airbnb
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Visualização do app mobile que o anfitrião acessa em /mobile/airbnb
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs hover:bg-secondary"
            >
              <RefreshCw className="size-3.5" />
              Recarregar
            </button>
            <a
              href="/mobile/airbnb"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs hover:bg-secondary"
            >
              <ExternalLink className="size-3.5" />
              Abrir
            </a>
          </div>
        </div>
      </div>

      {/* Iframe container — phone-frame visualization */}
      <div className="flex-1 overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 flex items-center justify-center">
        <div className="relative w-full max-w-[420px] aspect-[9/16] max-h-full">
          <div className="absolute inset-0 rounded-[2.5rem] border-8 border-zinc-800 shadow-2xl overflow-hidden bg-black">
            {/* Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-zinc-900 rounded-b-2xl z-10" />
            <iframe
              key={refreshKey}
              ref={iframeRef}
              src="/mobile/airbnb"
              className="w-full h-full border-0 bg-[#0a0a0f]"
              title="DDC Mobile Airbnb"
              loading="lazy"
            />
          </div>
          {/* Side buttons */}
          <div className="absolute -left-1 top-1/3 w-1 h-12 bg-zinc-700 rounded-l-sm" />
          <div className="absolute -left-1 top-1/2 w-1 h-16 bg-zinc-700 rounded-l-sm translate-y-4" />
          <div className="absolute -right-1 top-1/3 w-1 h-20 bg-zinc-700 rounded-r-sm" />
        </div>
      </div>

      {/* Footer info */}
      <div className="shrink-0 border-t border-border bg-card/80 px-4 py-2 text-[11px] text-muted-foreground flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone className="size-3.5" />
          <span>5 abas: Financeiro, Check-ins, Shield, Link-in-Bio, Simulador</span>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-blue-500" />
            Online
          </span>
          <span>iPhone 14 Pro · 393×852</span>
        </div>
      </div>
    </div>
  );
}
