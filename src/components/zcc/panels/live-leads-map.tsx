"use client";
import "leaflet/dist/leaflet.css";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { Lead } from "@/lib/zcc/types";
import { relativeTime } from "@/lib/zcc/mock-data";

/*
 * Mapa real do Brasil usando Leaflet + tiles CartoDB dark matter.
 *
 * IMPORTANTE: Leaflet usa `window` em top-level, então só pode ser
 * carregado no client. O componente é exportado via `next/dynamic`
 * com `ssr: false` no painel pai (live-leads-panel.tsx).
 *
 * - Cada lead é colocado na coordenada REAL (lat/lng) da sua cidade
 * - Markers coloridos por status:
 *   • Verde  → convertido
 *   • Vermelho → hot / quente
 *   • Amarelo → outros
 * - Hot leads têm anel pulsante (animação CSS)
 * - Leads aparecem sequencialmente (efeito "live feed")
 * - Click no marker abre popup com detalhes
 */

// Centro geográfico do Brasil
const BRAZIL_CENTER: [number, number] = [-14.5, -52];
const BRAZIL_ZOOM = 4;

type MarkerColor = "green" | "red" | "yellow";

function leadColor(lead: Lead): MarkerColor {
  if (lead.status === "convertido") return "green";
  if (lead.scoreQual >= 85) return "red";
  return "yellow";
}

const COLOR_HEX: Record<MarkerColor, string> = {
  green: "#10b981",
  red: "#ef4444",
  yellow: "#f59e0b",
};

interface LiveLeadsMapProps {
  leads: Lead[];
  selectedLeadId?: string | null;
  onSelectLead?: (lead: Lead) => void;
  className?: string;
}

/**
 * Componente interno que renderiza o mapa Leaflet. Carregado dinamicamente
 * para garantir que `window` exista antes de importar react-leaflet.
 */
function LeafletMapInner({
  leads,
  selectedLeadId,
  onSelectLead,
}: LiveLeadsMapProps) {
  // Imports dinâmicos no cliente — carrega react-leaflet apenas quando montado
  const [LeafletMods, setLeafletMods] = React.useState<{
    MapContainer: typeof import("react-leaflet").MapContainer;
    TileLayer: typeof import("react-leaflet").TileLayer;
    Marker: typeof import("react-leaflet").Marker;
    Popup: typeof import("react-leaflet").Popup;
    Tooltip: typeof import("react-leaflet").Tooltip;
    useMap: typeof import("react-leaflet").useMap;
    L: typeof import("leaflet");
  } | null>(null);

  React.useEffect(() => {
    let mounted = true;
    Promise.all([import("react-leaflet"), import("leaflet")]).then(
      ([rl, L]) => {
        if (!mounted) return;
        setLeafletMods({
          MapContainer: rl.MapContainer,
          TileLayer: rl.TileLayer,
          Marker: rl.Marker,
          Popup: rl.Popup,
          Tooltip: rl.Tooltip,
          useMap: rl.useMap,
          L: L.default,
        });
      }
    );
    return () => {
      mounted = false;
    };
  }, []);

  const [visibleCount, setVisibleCount] = React.useState(0);

  // Animação "live feed": leads aparecem um a um
  React.useEffect(() => {
    if (leads.length === 0) {
      setVisibleCount(0);
      return;
    }
    setVisibleCount(0);
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setVisibleCount(i);
      if (i >= leads.length) {
        clearInterval(interval);
      }
    }, 120);
    return () => clearInterval(interval);
  }, [leads]);

  const selectedLead = React.useMemo(
    () => leads.find((l) => l.id === selectedLeadId) ?? null,
    [leads, selectedLeadId]
  );

  // Memoiza ícones para não recriar a cada render
  const iconFor = React.useCallback(
    (lead: Lead, highlighted: boolean) => {
      if (!LeafletMods?.L) return null;
      const color = leadColor(lead);
      const hex = COLOR_HEX[color];
      const pulseRing = lead.scoreQual >= 85;
      const size = highlighted ? 22 : 16;
      return LeafletMods.L.divIcon({
        className: "zcc-lead-marker",
        html: `
          <div class="zcc-marker-wrap" style="--marker-color: ${hex};">
            ${pulseRing ? `<span class="zcc-marker-pulse" style="background: ${hex};"></span>` : ""}
            <span class="zcc-marker-dot" style="background: ${hex}; width: ${size}px; height: ${size}px; ${
              highlighted
                ? `box-shadow: 0 0 0 3px ${hex}55, 0 0 12px ${hex};`
                : `box-shadow: 0 0 0 2px #0a0a0a99;`
            }"></span>
          </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2],
      });
    },
    [LeafletMods]
  );

  if (!LeafletMods) {
    return (
      <div className="grid h-full w-full place-items-center bg-background">
        <div className="flex flex-col items-center gap-2">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs text-muted-foreground">Carregando mapa…</p>
        </div>
      </div>
    );
  }

  const {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    Tooltip,
    useMap,
  } = LeafletMods;

  /** Componente que centraliza o mapa num lead específico (quando selecionado). */
  const FlyToSelected = ({ lead, zoom }: { lead: Lead | null; zoom?: number }) => {
    const map = useMap();
    React.useEffect(() => {
      if (lead) {
        map.flyTo([lead.latitude, lead.longitude], zoom ?? 8, { duration: 0.8 });
      }
    }, [lead, map, zoom]);
    return null;
  };

  /** Componente que abre o popup do marker do lead selecionado. */
  const OpenSelectedPopup = ({ leadId }: { leadId?: string | null }) => {
    const map = useMap();
    React.useEffect(() => {
      if (!leadId) return;
      // Procura o marker correspondente no layer do leaflet
      map.eachLayer((layer) => {
        const anyLayer = layer as unknown as {
          getLatLng?: () => { lat: number; lng: number };
          openPopup?: () => void;
          options?: { leadId?: string };
        };
        if (anyLayer.openPopup && anyLayer.options?.leadId === leadId) {
          // pequeno delay para o flyTo completar primeiro
          setTimeout(() => anyLayer.openPopup?.(), 400);
        }
      });
    }, [leadId, map]);
    return null;
  };

  /** Componente que invalida o tamanho do mapa quando o container muda. */
  const ResizeHandler = () => {
    const map = useMap();
    React.useEffect(() => {
      const t = setTimeout(() => map.invalidateSize(), 200);
      return () => clearTimeout(t);
    }, [map]);
    return null;
  };

  return (
    <MapContainer
      center={BRAZIL_CENTER}
      zoom={BRAZIL_ZOOM}
      minZoom={3}
      maxZoom={18}
      zoomControl={false}
      attributionControl={false}
      scrollWheelZoom={true}
      className="h-full w-full"
      style={{ background: "#1a1a2e" }}
    >
      {/* Tiles escuros CartoDB */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={19}
      />

      {/* Labels sobrepostos para legibilidade de cidades/estados */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={19}
        opacity={0.7}
      />

      <ResizeHandler />
      <FlyToSelected lead={selectedLead} />
      <OpenSelectedPopup leadId={selectedLeadId} />

      {/* Markers de leads */}
      {leads.slice(0, visibleCount).map((lead) => {
        const isSelected = lead.id === selectedLeadId;
        const icon = iconFor(lead, isSelected);
        if (!icon) return null;
        return (
          <Marker
            key={lead.id}
            position={[lead.latitude, lead.longitude]}
            icon={icon}
            // @ts-expect-error — leadId é uma option customizada para lookup posterior
            leadId={lead.id}
            eventHandlers={{
              click: () => onSelectLead?.(lead),
            }}
            zIndexOffset={isSelected ? 1000 : 0}
          >
            <Popup closeButton={false} offset={[0, -8]}>
              <div className="min-w-[200px] rounded-md border border-border bg-popover p-2.5 text-foreground">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-semibold leading-tight">
                    {lead.pousada}
                  </p>
                  <span
                    className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase"
                    style={{
                      background: `${COLOR_HEX[leadColor(lead)]}22`,
                      color: COLOR_HEX[leadColor(lead)],
                    }}
                  >
                    {lead.status}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {lead.cidade}/{lead.uf}{lead.localPraia ? ` · ${lead.localPraia}` : ""}
                </p>
                {lead.sinaisIntencao ? (
                  <p className="mt-1 text-[11px] text-amber-300">
                    ★ {lead.sinaisIntencao}
                  </p>
                ) : null}
                <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-[10px]">
                  <div>
                    <p className="text-muted-foreground">Score Qual</p>
                    <p
                      className="font-bold"
                      style={{ color: COLOR_HEX[leadColor(lead)] }}
                    >
                      {lead.scoreQual}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Score Valid</p>
                    <p className="font-semibold text-emerald-300">
                      {lead.scoreValid}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Quartos</p>
                    <p className="font-semibold">
                      {lead.qtdQuartos ?? "—"}
                    </p>
                  </div>
                </div>
                <p className="mt-1.5 text-[9px] text-muted-foreground/70">
                  {relativeTime(lead.createdAt)} · {lead.id}
                </p>
              </div>
            </Popup>
            <Tooltip direction="top" offset={[0, -8]} opacity={1}>
              <span className="text-[11px] font-semibold">{lead.name}</span>
              <span className="text-[10px] text-muted-foreground">
                {" "}— {lead.city}/{lead.uf}
              </span>
            </Tooltip>
          </Marker>
        );
      })}

      {/* Controles de zoom dentro do MapContainer para ter acesso ao useMap */}
      <ZoomControlsInner />
    </MapContainer>
  );
}

/**
 * Controles de zoom + e - discretos no canto inferior direito.
 * Renderiza dentro do MapContainer (tem acesso ao useMap).
 */
function ZoomControlsInner() {
  const [mods, setMods] = React.useState<typeof import("react-leaflet").useMap | null>(null);

  React.useEffect(() => {
    let mounted = true;
    import("react-leaflet").then((rl) => {
      if (!mounted) return;
      setMods(() => rl.useMap);
    });
    return () => { mounted = false; };
  }, []);

  const useMap = mods;
  if (!useMap) return null;
  return <ZoomControlsClient useMap={useMap} />;
}

function ZoomControlsClient({
  useMap,
}: {
  useMap: typeof import("react-leaflet").useMap;
}) {
  const map = useMap();

  const zoomIn = () => map.setZoom(map.getZoom() + 1, { animate: true });
  const zoomOut = () => map.setZoom(map.getZoom() - 1, { animate: true });
  const resetView = () => map.setView([-14.5, -52], 4, { animate: true });

  return (
    <>
      {/* Portais via CSS absolute - posicionados no wrapper externo */}
      <div
        style={{
          position: "absolute",
          bottom: "8px",
          right: "8px",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        <button
          type="button"
          onClick={zoomIn}
          style={{
            width: "32px",
            height: "32px",
            display: "grid",
            placeItems: "center",
            borderRadius: "6px",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(13, 17, 23, 0.95)",
            backdropFilter: "blur(8px)",
            color: "#f1f5f9",
            fontSize: "16px",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
          aria-label="Aumentar zoom"
          title="Aumentar zoom (+)"
        >
          +
        </button>
        <button
          type="button"
          onClick={zoomOut}
          style={{
            width: "32px",
            height: "32px",
            display: "grid",
            placeItems: "center",
            borderRadius: "6px",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(13, 17, 23, 0.95)",
            backdropFilter: "blur(8px)",
            color: "#f1f5f9",
            fontSize: "16px",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
          aria-label="Diminuir zoom"
          title="Diminuir zoom (−)"
        >
          −
        </button>
        <button
          type="button"
          onClick={resetView}
          style={{
            width: "32px",
            height: "32px",
            display: "grid",
            placeItems: "center",
            borderRadius: "6px",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(13, 17, 23, 0.95)",
            backdropFilter: "blur(8px)",
            color: "#f1f5f9",
            fontSize: "10px",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
          aria-label="Resetar visão"
          title="Voltar para visão Brasil"
        >
          ⟲
        </button>
      </div>
    </>
  );
}

export function LiveLeadsMap({
  leads,
  selectedLeadId,
  onSelectLead,
  className,
}: LiveLeadsMapProps) {
  return (
    <div className={cn("relative h-full w-full", className)}>
      <LeafletMapInner
        leads={leads}
        selectedLeadId={selectedLeadId}
        onSelectLead={onSelectLead}
      />

      {/* Indicador "AO VIVO" no canto superior esquerdo */}
      <div className="pointer-events-none absolute left-2 top-2 z-[1000] flex items-center gap-1.5 rounded-md border border-primary/30 bg-black/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary backdrop-blur">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
        </span>
        AO VIVO
      </div>

      {/* (Controles de zoom são renderizados dentro do MapContainer pelo ZoomControlsInner) */}

      {/* Contador de leads visíveis no canto inferior esquerdo */}
      <div className="pointer-events-none absolute bottom-2 left-2 z-[1000] rounded-md border border-border bg-black/80 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur">
        <span className="font-semibold text-foreground">
          {leads.length > 0 ? Math.min(leads.length, leads.length) : 0}
        </span>
        {" / "}
        <span>{leads.length}</span> leads
      </div>
    </div>
  );
}

