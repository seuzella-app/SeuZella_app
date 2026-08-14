"use client";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { Lead } from "@/lib/zcc/types";
import { relativeTime } from "@/lib/zcc/mock-data";
import {
  fetchPousadasBrasil,
  fetchPousadasConvertidasMock,
  fetchCliquesAnuncioMock,
  type PousadaBrasil,
} from "@/lib/zcc/pousadas-brasil-data";

/*
 * LiveLeadsMap — Sistema de 3 Cores com MarkerCluster (Malha Real)
 * =================================================================
 *
 * MALHA LAT/LNG:
 *   - Cada pousada é plotada em SUA coordenada geográfica real (lat/lng do Brasil)
 *   - Validada por isValidCoord(): -35 < lat < 5, -75 < lng < -30 (bounds Brasil)
 *   - Markers sem coord válida NÃO são renderizados (elimina 'flutuando')
 *
 * MARKERCLUSTER (malha invisível que organiza os markers):
 *   - Em zoom baixo (Brasil inteiro), markers próximos são agrupados em clusters
 *     (círculos azuis com número = "37 pousadas nesta região")
 *   - Em zoom alto (cidade), cada cluster se expande mostrando as pousadas individuais
 *   - Performance: 9.627 markers renderizados em Canvas, sem travar o browser
 *   - Visual: cada pousada fica NO LUGAR CERTO, sem empilhamento visual
 *
 * Sistema de 3 Cores:
 *   - VERDE   (#22c55e) = Pousada convertida (mock: top 8 HOT score≥95)
 *   - AMARELO (#facc15) = Pousada prospectada (9.627 da planilha)
 *   - AZUL    (#3b82f6) = Clique no anúncio (mock: 12 cliques)
 *
 * Bolinhas MENORES (versão anterior era 16px, agora 6px para prospectadas).
 */

const BRAZIL_CENTER: [number, number] = [-14.5, -52];
const BRAZIL_ZOOM = 4;

// ── Sistema de 3 Cores ─────────────────────────────────────────────────────────

type MarkerCategory = "converted" | "prospect" | "click";

interface CategoryStyle {
  color: string;
  label: string;
  description: string;
  size: number;
  selectedSize: number;
  hasPulse?: boolean;
  hasStar?: boolean;
  zIndex: number;
}

const CATEGORY_STYLE: Record<MarkerCategory, CategoryStyle> = {
  converted: {
    color: "#22c55e",
    label: "Convertida",
    description: "Pousada cliente Zélla (pagante)",
    size: 12,
    selectedSize: 18,
    hasStar: true,
    zIndex: 1000,
  },
  prospect: {
    color: "#facc15",
    label: "Prospectada",
    description: "Pousada da planilha (9.627 prospectadas)",
    size: 6,
    selectedSize: 12,
    zIndex: 100,
  },
  click: {
    color: "#3b82f6",
    label: "Clique Anúncio",
    description: "Clique no Google Ads (mock — real quando GA4 integrar)",
    size: 10,
    selectedSize: 16,
    hasPulse: true,
    zIndex: 500,
  },
};

interface LeadMarker {
  id: string;
  lat: number;
  lng: number;
  category: MarkerCategory;
  nome: string;
  cidade: string;
  uf: string;
  tier?: string;
  funnel?: string;
  score?: number;
  qtdQuartos?: number;
  valores?: string;
  sinaisIntencao?: string;
  localPraia?: string;
  whatsapp?: string;
}

interface LiveLeadsMapProps {
  leads: Lead[];
  selectedLeadId?: string | null;
  onSelectLead?: (lead: Lead) => void;
  className?: string;
  activeFilter?: MarkerCategory | null;
  onPousadasLoaded?: (data: {
    prospectadas: PousadaBrasil[];
    convertidas: PousadaBrasil[];
    cliques: PousadaBrasil[];
  }) => void;
}

function leadCategory(lead: Lead): MarkerCategory {
  if (lead.status === "convertido" || lead.converted) return "converted";
  if (lead.tierSugerido || lead.roomsCount > 0) return "prospect";
  return "click";
}

function leadToMarker(lead: Lead): LeadMarker {
  const l = lead as any;
  return {
    id: l.id,
    lat: l.latitude ?? l.lat ?? -14.5,
    lng: l.longitude ?? l.lng ?? -52,
    category: leadCategory(lead),
    nome: l.pousada || l.empresa || l.name || "Pousada",
    cidade: l.cidade || l.city || "",
    uf: l.uf || l.state || "",
    tier: l.tierSugerido || l.leadTier || l.tier,
    funnel: l.funnelStage || l.funnel || l.cluster,
    score: l.scoreQual ?? l.avgScore ?? l.scoreValid ?? l.score,
    qtdQuartos: l.qtdQuartos ?? l.roomsCount ?? 0,
    valores: l.valoresEstimados ?? l.estimatedValues ?? undefined,
    sinaisIntencao: l.sinaisIntencao ?? l.intentSignals ?? undefined,
    localPraia: l.localPraia ?? undefined,
    whatsapp: l.whatsapp ?? l.phone ?? undefined,
  };
}

function LeafletMapInner({
  leads,
  selectedLeadId,
  onSelectLead,
  activeFilter,
  onPousadasLoaded,
}: LiveLeadsMapProps) {
  const [LeafletMods, setLeafletMods] = React.useState<{
    MapContainer: typeof import("react-leaflet").MapContainer;
    TileLayer: typeof import("react-leaflet").TileLayer;
    Marker: typeof import("react-leaflet").Marker;
    Popup: typeof import("react-leaflet").Popup;
    Tooltip: typeof import("react-leaflet").Tooltip;
    useMap: typeof import("react-leaflet").useMap;
    L: typeof import("leaflet");
    MarkerClusterGroup: any;
  } | null>(null);

  React.useEffect(() => {
    let mounted = true;
    Promise.all([
      import("react-leaflet"),
      import("leaflet"),
      // react-leaflet-cluster exporta default em runtime
      import("react-leaflet-cluster") as any,
    ]).then(([rl, L, clusterMod]: any) => {
      if (!mounted) return;
      const ClusterGroup = clusterMod.default || clusterMod.MarkerClusterGroup || clusterMod;
      setLeafletMods({
        MapContainer: rl.MapContainer,
        TileLayer: rl.TileLayer,
        Marker: rl.Marker,
        Popup: rl.Popup,
        Tooltip: rl.Tooltip,
        useMap: rl.useMap,
        L: L.default,
        MarkerClusterGroup: ClusterGroup,
      });
    });
    return () => {
      mounted = false;
    };
  }, []);

  // ── Carrega dataset da planilha (lazy via fetch) ──
  const [planilhaData, setPlanilhaData] = React.useState<{
    prospectadas: PousadaBrasil[];
    convertidas: PousadaBrasil[];
    cliques: PousadaBrasil[];
  } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchPousadasBrasil(),
      fetchPousadasConvertidasMock(),
      fetchCliquesAnuncioMock(),
    ]).then(([prospectadas, convertidas, cliques]) => {
      if (cancelled) return;
      setPlanilhaData({ prospectadas, convertidas, cliques });
      onPousadasLoaded?.({ prospectadas, convertidas, cliques });
    });
    return () => { cancelled = true; };
  }, [onPousadasLoaded]);

  // ── Marcadores a renderizar ──
  // USA APENAS as 9.627 pousadas da planilha com lat/lng reais e jitter aplicado.
  // Os `leads` do ZCC (37 mocks) NÃO são mostrados no mapa (dados de teste).
  const markers: LeadMarker[] = React.useMemo(() => {
    if (!planilhaData) return [];

    const result: LeadMarker[] = [];

    // Helper: valida se lat/lng estão dentro do Brasil (elimina markers flutuando)
    const isValidCoord = (lat: number, lng: number) =>
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -35 && lat <= 5 &&
      lng >= -75 && lng <= -30;

    // 1. PROSPECTADAS (AMARELO) — todas as 9.627 da planilha
    for (const p of planilhaData.prospectadas) {
      if (!isValidCoord(p.lat, p.lng)) continue;
      result.push({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        category: "prospect",
        nome: p.nome,
        cidade: p.cidade,
        uf: p.uf,
        tier: p.tier,
        funnel: p.funnel,
        score: p.score,
        qtdQuartos: p.qtdQuartos,
        valores: p.valores,
        sinaisIntencao: p.sinaisIntencao,
        localPraia: p.localPraia,
        whatsapp: p.whatsapp,
      });
    }

    // 2. CONVERTIDAS (VERDE) — sobrepõe as prospectadas
    for (const p of planilhaData.convertidas) {
      if (!isValidCoord(p.lat, p.lng)) continue;
      const existing = result.find(m => m.id === p.id);
      if (existing) {
        existing.category = "converted";
      } else {
        result.push({
          id: p.id,
          lat: p.lat,
          lng: p.lng,
          category: "converted",
          nome: p.nome,
          cidade: p.cidade,
          uf: p.uf,
          tier: p.tier,
          funnel: p.funnel,
          score: p.score,
          qtdQuartos: p.qtdQuartos,
          valores: p.valores,
          sinaisIntencao: p.sinaisIntencao,
          localPraia: p.localPraia,
          whatsapp: p.whatsapp,
        });
      }
    }

    // 3. CLIQUES (AZUL) — 12 cliques mock
    for (const p of planilhaData.cliques) {
      if (!isValidCoord(p.lat, p.lng)) continue;
      result.push({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        category: "click",
        nome: p.nome,
        cidade: p.cidade,
        uf: p.uf,
        tier: p.tier,
        funnel: p.funnel,
        score: p.score,
        qtdQuartos: p.qtdQuartos,
        valores: p.valores,
        sinaisIntencao: p.sinaisIntencao,
        localPraia: p.localPraia,
        whatsapp: p.whatsapp,
      });
    }

    return result;
  }, [planilhaData]);

  // Aplica filtro de categoria (verde/amarelo/azul)
  const filteredMarkers = React.useMemo(() => {
    if (!activeFilter) return markers;
    return markers.filter(m => m.category === activeFilter);
  }, [markers, activeFilter]);

  const selectedMarker = React.useMemo(
    () => filteredMarkers.find(m => m.id === selectedLeadId) ?? null,
    [filteredMarkers, selectedLeadId]
  );

  // Memoiza ícones para não recriar a cada render
  const iconFor = React.useCallback(
    (marker: LeadMarker, highlighted: boolean) => {
      if (!LeafletMods?.L) return null;
      const style = CATEGORY_STYLE[marker.category];
      const size = highlighted ? style.selectedSize : style.size;
      const hex = style.color;
      const pulseRing = style.hasPulse;
      const star = style.hasStar;

      return LeafletMods.L.divIcon({
        className: "zcc-lead-marker zcc-lead-marker--" + marker.category,
        html: `
          <div class="zcc-marker-wrap" style="--marker-color: ${hex};">
            ${pulseRing ? `<span class="zcc-marker-pulse" style="background: ${hex};"></span>` : ""}
            <span class="zcc-marker-dot" style="
              background: ${hex};
              width: ${size}px;
              height: ${size}px;
              ${highlighted
                ? `box-shadow: 0 0 0 3px ${hex}55, 0 0 12px ${hex};`
                : `box-shadow: 0 0 0 1px #0a0a0a99;`
              }
            ">
              ${star ? `<svg class="zcc-marker-star" viewBox="0 0 24 24" fill="white"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>` : ""}
            </span>
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
    L,
    MarkerClusterGroup,
  } = LeafletMods;

  /** Componente que centraliza o mapa num lead específico. */
  const FlyToSelected = ({ marker, zoom }: { marker: LeadMarker | null; zoom?: number }) => {
    const map = useMap();
    React.useEffect(() => {
      if (marker) {
        map.flyTo([marker.lat, marker.lng], zoom ?? 12, { duration: 0.8 });
      }
    }, [marker, map, zoom]);
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

  /**
   * Customiza a aparência dos clusters.
   * Cluster = agrupamento de markers próximos em zoom baixo.
   * Cor do cluster = cor da categoria dominante dentro dele.
   */
  const clusterIcon = (cluster: any) => {
    const count = cluster.getChildCount();
    // Conta categorias dentro do cluster
    const children = cluster.getAllChildMarkers();
    const categories = children.map((m: any) => m.options.category as MarkerCategory);
    const dominant = categories.sort((a: string, b: string) =>
      categories.filter((v: string) => v === a).length -
      categories.filter((v: string) => v === b).length
    )[0] || "prospect";
    const style = CATEGORY_STYLE[dominant as MarkerCategory];
    const size = count > 100 ? 44 : count > 10 ? 36 : 28;

    return L.divIcon({
      html: `
        <div class="zcc-cluster zcc-cluster--${dominant}" style="
          background: radial-gradient(circle at center, ${style.color} 0%, ${style.color}cc 60%, ${style.color}88 100%);
          width: ${size}px;
          height: ${size}px;
          border: 2px solid white;
          box-shadow: 0 0 0 1px ${style.color}, 0 2px 8px rgba(0,0,0,0.4);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 700;
          font-size: ${count > 99 ? '10px' : '12px'};
          font-family: 'JetBrains Mono', monospace;
        ">
          ${count > 99 ? '99+' : count}
        </div>
      `,
      className: "zcc-cluster-icon",
      iconSize: L.point(size, size),
    });
  };

  return (
    <MapContainer
      center={BRAZIL_CENTER}
      zoom={BRAZIL_ZOOM}
      minZoom={3}
      maxZoom={20}
      zoomControl={false}
      attributionControl={false}
      scrollWheelZoom={true}
      preferCanvas={true}
      className="h-full w-full"
      style={{ background: "#1a1a2e" }}
    >
      {/* Tiles escuros CartoDB — malha visual de fundo */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={20}
        maxNativeZoom={19}
      />
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={20}
        maxNativeZoom={19}
        opacity={0.7}
      />

      <ResizeHandler />
      <FlyToSelected marker={selectedMarker} />

      {/*
       * MARKERCLUSTER GROUP — malha invisível que organiza os markers:
       *   - Em zoom baixo: 9.627 markers viram ~150-300 clusters (círculos numerados)
       *     Cada cluster mostra a contagem (ex: "37" = 37 pousadas nesta região)
       *   - Em zoom médio: clusters se expandem em sub-clusters
       *   - Em zoom alto: cada pousada aparece em sua posição individual
       *   - Spiderfy: se 2+ markers têm EXATAMENTE a mesma coord, abrem em espiral
       *
       * Configurações:
       *   - showCoverageOnHover: false (não mostra bounds ao hover)
       *   - spiderfyOnMaxZoom: true (abre espiral quando máximo zoom ainda agrupa)
       *   - maxClusterRadius: 50 (raio em pixels para agrupar)
       *   - disableClusteringAtZoom: 14 (em zoom >= 14, mostra todos individuais)
       *   - chunkedLoading: true (carrega em chunks para não travar)
       */
      filteredMarkers.length > 0 && (
        <MarkerClusterGroup
          showCoverageOnHover={false}
          spiderfyOnMaxZoom={true}
          spiderfyDistanceMultiplier={2}
          maxClusterRadius={50}
          disableClusteringAtZoom={14}
          chunkedLoading={true}
          iconCreateFunction={clusterIcon}
          polygonOptions={{
            color: "#3b82f6",
            weight: 1,
            opacity: 0.3,
            fillOpacity: 0.05,
          }}
        >
          {filteredMarkers.map((marker) => {
            const isSelected = marker.id === selectedLeadId;
            const icon = iconFor(marker, isSelected);
            if (!icon) return null;
            const style = CATEGORY_STYLE[marker.category];
            return (
              <Marker
                key={marker.id}
                position={[marker.lat, marker.lng]}
                icon={icon}
                {...({ category: marker.category, markerId: marker.id } as any)}
                eventHandlers={{
                  click: () => {
                    const lead = leads.find(l => l.id === marker.id);
                    if (lead) onSelectLead?.(lead);
                  },
                }}
                zIndexOffset={isSelected ? 2000 : style.zIndex}
              >
                <Popup closeButton={false} offset={[0, -8]} maxWidth={260}>
                  <div className="min-w-[220px] rounded-md border border-border bg-popover p-2.5 text-foreground">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-semibold leading-tight">
                        {marker.nome}
                      </p>
                      <span
                        className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase"
                        style={{
                          background: `${style.color}22`,
                          color: style.color,
                        }}
                      >
                        {style.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {marker.cidade}/{marker.uf}{marker.localPraia ? ` · ${marker.localPraia}` : ""}
                    </p>

                    {marker.sinaisIntencao ? (
                      <p className="mt-1 text-[11px] text-amber-300">
                        ★ {marker.sinaisIntencao}
                      </p>
                    ) : null}

                    <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-[10px]">
                      {marker.score !== undefined && (
                        <div>
                          <p className="text-muted-foreground">Score</p>
                          <p className="font-bold" style={{ color: style.color }}>
                            {marker.score}
                          </p>
                        </div>
                      )}
                      {marker.tier && (
                        <div>
                          <p className="text-muted-foreground">Tier</p>
                          <p className="font-semibold">{marker.tier}</p>
                        </div>
                      )}
                      {marker.qtdQuartos !== undefined && marker.qtdQuartos > 0 && (
                        <div>
                          <p className="text-muted-foreground">Quartos</p>
                          <p className="font-semibold">{marker.qtdQuartos}</p>
                        </div>
                      )}
                    </div>

                    {marker.valores && (
                      <p className="mt-1.5 text-[11px] text-emerald-300">
                        {marker.valores}
                      </p>
                    )}

                    {marker.whatsapp && (
                      <p className="mt-1 text-[10px] text-muted-foreground/70">
                        WhatsApp: {marker.whatsapp}
                      </p>
                    )}

                    <p className="mt-1.5 text-[9px] text-muted-foreground/70">
                      Coordenadas: {marker.lat.toFixed(4)}, {marker.lng.toFixed(4)} · ID: {marker.id}
                    </p>
                  </div>
                </Popup>
                <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                  <span className="text-[11px] font-semibold">{marker.nome}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {" "}— {marker.cidade}/{marker.uf}
                  </span>
                </Tooltip>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      )}

      <ZoomControlsInner />
    </MapContainer>
  );
}

/**
 * Controles de zoom discretos no canto inferior direito.
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
  const resetView = () => map.setView(BRAZIL_CENTER, BRAZIL_ZOOM, { animate: true });

  return (
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
          width: "32px", height: "32px",
          display: "grid", placeItems: "center",
          borderRadius: "6px",
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(13, 17, 23, 0.95)",
          backdropFilter: "blur(8px)",
          color: "#f1f5f9", fontSize: "16px", fontWeight: 700,
          cursor: "pointer", transition: "all 0.15s",
        }}
        aria-label="Aumentar zoom"
        title="Aumentar zoom (+)"
      >+</button>
      <button
        type="button"
        onClick={zoomOut}
        style={{
          width: "32px", height: "32px",
          display: "grid", placeItems: "center",
          borderRadius: "6px",
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(13, 17, 23, 0.95)",
          backdropFilter: "blur(8px)",
          color: "#f1f5f9", fontSize: "16px", fontWeight: 700,
          cursor: "pointer", transition: "all 0.15s",
        }}
        aria-label="Diminuir zoom"
        title="Diminuir zoom (−)"
      >−</button>
      <button
        type="button"
        onClick={resetView}
        style={{
          width: "32px", height: "32px",
          display: "grid", placeItems: "center",
          borderRadius: "6px",
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(13, 17, 23, 0.95)",
          backdropFilter: "blur(8px)",
          color: "#f1f5f9", fontSize: "10px", fontWeight: 700,
          cursor: "pointer", transition: "all 0.15s",
        }}
        aria-label="Resetar visão"
        title="Voltar para visão Brasil"
      >⟲</button>
    </div>
  );
}

// ── EXPORTS ─────────────────────────────────────────────────────────────────

export function LiveLeadsMap({
  leads,
  selectedLeadId,
  onSelectLead,
  className,
  activeFilter,
  onPousadasLoaded,
}: LiveLeadsMapProps) {
  const [counts, setCounts] = React.useState({ converted: 0, prospect: 0, click: 0 });

  const handlePousadasLoaded = React.useCallback((data: {
    prospectadas: PousadaBrasil[];
    convertidas: PousadaBrasil[];
    cliques: PousadaBrasil[];
  }) => {
    setCounts({
      converted: data.convertidas.length,
      prospect: data.prospectadas.length,
      click: data.cliques.length,
    });
    onPousadasLoaded?.(data);
  }, [onPousadasLoaded]);

  return (
    <div className={cn("relative h-full w-full", className)}>
      <LeafletMapInner
        leads={leads}
        selectedLeadId={selectedLeadId}
        onSelectLead={onSelectLead}
        activeFilter={activeFilter}
        onPousadasLoaded={handlePousadasLoaded}
      />

      {/* Indicador "AO VIVO" no canto superior esquerdo */}
      <div className="pointer-events-none absolute left-2 top-2 z-[1000] flex items-center gap-1.5 rounded-md border border-primary/30 bg-black/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary backdrop-blur">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
        </span>
        AO VIVO
      </div>

      {/* Legenda das 3 cores — canto superior direito */}
      <div className="pointer-events-none absolute right-2 top-2 z-[1000] rounded-md border border-border bg-black/85 px-3 py-2 backdrop-blur">
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1.5">
          Sistema de Cores
        </p>
        <div className="space-y-1">
          <LegendItem color={CATEGORY_STYLE.converted.color} label="Convertida" count={counts.converted} />
          <LegendItem color={CATEGORY_STYLE.prospect.color} label="Prospectada" count={counts.prospect} />
          <LegendItem color={CATEGORY_STYLE.click.color} label="Clique Anúncio" count={counts.click} />
        </div>
        <p className="text-[8px] text-muted-foreground/70 mt-1.5 pt-1.5 border-t border-border/50">
          Clique num cluster p/ expandir
        </p>
      </div>

      {/* Contador no canto inferior esquerdo */}
      <div className="pointer-events-none absolute bottom-2 left-2 z-[1000] rounded-md border border-border bg-black/80 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur">
        <span className="font-semibold text-foreground">
          {counts.converted + counts.prospect + counts.click}
        </span>
        {" markers · "}
        <span className="text-blue-400">agrupados em clusters</span>
        {activeFilter && (
          <span className="ml-1 text-amber-400">· filtro: {CATEGORY_STYLE[activeFilter].label}</span>
        )}
      </div>
    </div>
  );
}

function LegendItem({
  color,
  label,
  count,
}: {
  color: string;
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span
        className="inline-block rounded-full"
        style={{
          backgroundColor: color,
          width: label === "Prospectada" ? "6px" : label === "Convertida" ? "10px" : "8px",
          height: label === "Prospectada" ? "6px" : label === "Convertida" ? "10px" : "8px",
          boxShadow: `0 0 0 1px ${color}55`,
        }}
      />
      <span className="text-zinc-300">{label}</span>
      <span className="ml-auto text-zinc-500 tabular-nums">{count.toLocaleString('pt-BR')}</span>
    </div>
  );
}

export { CATEGORY_STYLE };
export type { MarkerCategory, LeadMarker };

// Existe só para satisfazer imports antigos; pode ser removido quando não houver mais referências.
void relativeTime;
