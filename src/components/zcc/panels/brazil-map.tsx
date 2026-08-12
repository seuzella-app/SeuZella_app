"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { STATE_NAMES, STATE_CENTROID } from "@/lib/zcc/states";
import type { UF, StateAggregate, Lead } from "@/lib/zcc/types";
import { Flame, Plus, Minus } from "lucide-react";

/*
 * Mapa do Brasil — SVG simplificado e reconhecível com os 27 estados.
 *
 * Cada estado é um <path> independente e clicável.
 * Markers de leads são sobrepostos via coordenadas (x%, y%) no centróide.
 *
 * Cores de markers (espelham produção):
 *   - Verde  → convertido
 *   - Vermelho → hot / quente
 *   - Amarelo → outros
 */

interface BrazilMapProps {
  aggregates: StateAggregate[];
  leads: Lead[];
  selectedUf?: UF | null;
  onSelectUf?: (uf: UF | null) => void;
  selectedLeadId?: string | null;
  onSelectLead?: (lead: Lead) => void;
  className?: string;
}

// Paths SVG aproximados por estado (viewBox 0 0 460 480).
const STATE_PATHS: Record<UF, string> = {
  RR: "M120 50 L170 45 L190 70 L175 95 L150 100 L125 85 Z",
  AP: "M250 45 L285 50 L290 75 L265 85 L250 70 Z",
  AM: "M95 95 L175 80 L195 105 L185 145 L150 165 L110 150 L90 120 Z",
  AC: "M70 155 L120 150 L130 180 L110 200 L80 195 L65 175 Z",
  PA: "M195 70 L290 65 L300 110 L295 165 L260 185 L215 175 L195 140 L205 100 Z",
  RO: "M110 175 L155 165 L165 195 L140 220 L115 210 L100 190 Z",
  TO: "M285 195 L330 185 L345 220 L335 255 L300 265 L280 240 Z",
  MA: "M250 150 L320 145 L335 175 L325 210 L295 220 L270 200 Z",
  PI: "M295 215 L345 210 L360 250 L345 290 L315 295 L300 270 L290 240 Z",
  CE: "M345 175 L390 170 L400 200 L380 220 L350 215 L342 195 Z",
  RN: "M390 165 L415 160 L420 180 L400 190 L390 180 Z",
  PB: "M395 195 L420 190 L425 215 L405 220 L395 210 Z",
  PE: "M380 220 L420 215 L430 245 L410 255 L385 245 Z",
  AL: "M385 250 L410 250 L415 270 L395 275 L385 265 Z",
  SE: "M375 270 L405 265 L410 285 L385 290 Z",
  BA: "M320 220 L370 220 L395 250 L410 285 L405 320 L370 345 L335 340 L315 310 L305 275 L310 245 Z",
  MT: "M140 220 L220 215 L285 210 L280 270 L235 285 L180 280 L150 260 Z",
  MS: "M170 290 L240 285 L250 320 L215 335 L180 325 Z",
  GO: "M245 240 L290 245 L300 285 L285 315 L255 310 L245 280 Z",
  DF: "M265 275 L285 273 L290 290 L270 292 Z",
  MG: "M290 285 L355 280 L370 320 L355 365 L320 380 L295 360 L285 320 Z",
  ES: "M355 305 L380 310 L385 340 L365 345 L355 325 Z",
  RJ: "M335 350 L370 345 L380 375 L360 385 L340 375 Z",
  SP: "M250 320 L320 315 L335 355 L325 385 L290 390 L265 370 L255 345 Z",
  PR: "M230 380 L300 375 L315 405 L300 425 L260 430 L235 415 Z",
  SC: "M235 420 L290 415 L300 440 L265 450 L240 445 Z",
  RS: "M195 430 L280 425 L300 450 L275 470 L230 470 L200 455 Z",
};

const ALL_UFS = Object.keys(STATE_PATHS) as UF[];

function intensityColor(ratio: number): string {
  if (ratio <= 0) return "oklch(0.22 0.02 162.48 / 0.6)";   // sem leads — quase preto
  if (ratio < 0.2) return "oklch(0.32 0.06 162.48 / 0.7)";
  if (ratio < 0.4) return "oklch(0.42 0.10 162.48 / 0.8)";
  if (ratio < 0.6) return "oklch(0.55 0.13 162.48 / 0.88)";
  if (ratio < 0.8) return "oklch(0.65 0.15 162.48 / 0.94)";
  return "oklch(0.72 0.17 162.48)";
}

function leadMarkerColor(lead: Lead): string {
  if (lead.converted || lead.status === "convertido") return "#10b981"; // verde
  if (lead.hot || lead.score ?? 0 >= 85) return "#ef4444";                   // vermelho
  return "#f59e0b";                                                      // amarelo
}

export function BrazilMap({
  aggregates,
  leads,
  selectedUf,
  onSelectUf,
  selectedLeadId,
  onSelectLead,
  className,
}: BrazilMapProps) {
  const [hoverUf, setHoverUf] = React.useState<UF | null>(null);
  const [zoom, setZoom] = React.useState(1);

  const aggregateMap = React.useMemo(() => {
    const m = new Map<UF, StateAggregate>();
    for (const a of aggregates) m.set(a.uf, a);
    return m;
  }, [aggregates]);

  const maxLeads = React.useMemo(
    () => aggregates.reduce((max, a) => Math.max(max, a.totalLeads ?? 0), 1),
    [aggregates]
  );

  const getAggregate = (uf: UF) => aggregateMap.get(uf);

  const handleSelect = (uf: UF) => {
    if (selectedUf === uf) {
      onSelectUf?.(null);
    } else {
      onSelectUf?.(uf);
    }
  };

  const tooltipText = (uf: UF): string => {
    const a = getAggregate(uf);
    if (!a || a.totalLeads ?? 0 === 0) return `${STATE_NAMES[uf]} — sem leads`;
    return `${STATE_NAMES[uf]} — ${a.totalLeads ?? 0} leads · ${a.hotLeads} quentes`;
  };

  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col",
        className
      )}
    >
      {/* Área do mapa (com zoom via transform) */}
      <div className="relative flex-1 overflow-hidden">
        <svg
          viewBox="0 0 460 480"
          className="h-full w-full"
          role="img"
          aria-label="Mapa do Brasil com leads por estado"
          style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
        >
          <defs>
            <radialGradient id="zcc-map-glow" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="oklch(0.696 0.17 162.48 / 0.05)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
            <filter id="zcc-state-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow
                dx="0"
                dy="1"
                stdDeviation="1.2"
                floodColor="oklch(0 0 0 / 0.35)"
              />
            </filter>
            <filter id="zcc-marker-shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow
                dx="0"
                dy="1"
                stdDeviation="1.5"
                floodColor="oklch(0 0 0 / 0.6)"
              />
            </filter>
          </defs>

          <rect x="0" y="0" width="460" height="480" fill="url(#zcc-map-glow)" />

          {/* Estados */}
          {ALL_UFS.map((uf) => {
            const a = getAggregate(uf);
            const ratio = a ? a.totalLeads ?? 0 / maxLeads : 0;
            const isSelected = selectedUf === uf;
            const isHover = hoverUf === uf;
            return (
              <path
                key={uf}
                d={STATE_PATHS[uf]}
                fill={intensityColor(ratio)}
                stroke={
                  isSelected
                    ? "oklch(0.85 0.18 162.48)"
                    : isHover
                      ? "oklch(0.7 0.16 162.48 / 0.9)"
                      : "oklch(0.18 0 0 / 0.7)"
                }
                strokeWidth={isSelected ? 2 : isHover ? 1.5 : 0.8}
                filter="url(#zcc-state-shadow)"
                className="cursor-pointer transition-all duration-150"
                onClick={() => handleSelect(uf)}
                onMouseEnter={() => setHoverUf(uf)}
                onMouseLeave={() => setHoverUf(null)}
                tabIndex={0}
                role="button"
                aria-label={tooltipText(uf)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelect(uf);
                  }
                }}
              />
            );
          })}

          {/* Markers de leads */}
          {leads.map((lead) => {
            const c = STATE_CENTROID[lead.uf];
            const x = (c.x / 100) * 460;
            const y = (c.y / 100) * 480;
            const color = leadMarkerColor(lead);
            const isSelected = selectedLeadId === lead.id;
            return (
              <g
                key={lead.id}
                className="cursor-pointer"
                onClick={() => onSelectLead?.(lead)}
                filter="url(#zcc-marker-shadow)"
              >
                {/* halo se selecionado */}
                {isSelected ? (
                  <circle
                    cx={x}
                    cy={y}
                    r={10}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.5}
                    opacity={0.6}
                  >
                    <animate
                      attributeName="r"
                      values="8;13;8"
                      dur="1.4s"
                      repeatCount="indefinite"
                    />
                  </circle>
                ) : null}
                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? 6 : 4.5}
                  fill={color}
                  stroke="oklch(0.15 0 0)"
                  strokeWidth={1.2}
                  className="transition-all duration-150 hover:opacity-80"
                />
                {/* Ícone de chama para hot leads */}
                {(lead.hot || lead.score ?? 0 >= 85) && !lead.converted ? (
                  <text
                    x={x}
                    y={y + 1.5}
                    textAnchor="middle"
                    fontSize="6"
                    fill="white"
                    pointerEvents="none"
                  >
                    <Flame className="hidden" />
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>

        {/* Tooltip do estado em hover */}
        {(hoverUf || selectedUf) && (
          <div className="pointer-events-none absolute left-2 bottom-2 rounded-md border border-border bg-popover/95 px-2.5 py-1.5 text-[11px] shadow-lg backdrop-blur">
            <span className="font-semibold text-foreground">
              {(hoverUf ?? selectedUf) as UF}
            </span>
            <span className="text-muted-foreground">
              {" "}— {tooltipText((hoverUf ?? selectedUf) as UF)}
            </span>
          </div>
        )}
      </div>

      {/* Controles de zoom (canto inferior esquerdo, espelha produção) */}
      <div className="absolute bottom-2 right-2 flex flex-col overflow-hidden rounded-md border border-border bg-card/95 shadow-lg backdrop-blur">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(z + 0.25, 2.5))}
          className="grid size-8 place-items-center text-foreground transition-colors hover:bg-secondary"
          aria-label="Aumentar zoom"
          title="Aumentar zoom"
        >
          <Plus className="size-4" />
        </button>
        <div className="h-px w-full bg-border" />
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(z - 0.25, 0.7))}
          className="grid size-8 place-items-center text-foreground transition-colors hover:bg-secondary"
          aria-label="Diminuir zoom"
          title="Diminuir zoom"
        >
          <Minus className="size-4" />
        </button>
      </div>
    </div>
  );
}
