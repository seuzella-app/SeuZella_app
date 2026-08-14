"use client";
import "leaflet/dist/leaflet.css";

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
 * LiveLeadsMap — Sistema de 3 Cores (Yield Strategy)
 * =====================================================
 *
 * Marcadores no mapa:
 *   - VERDE   = Pousada convertida (cliente Zélla pagante) — mock: top 8 HOT score≥95
 *   - AMARELO = Pousada prospectada (9.627 da planilha Planilha_Funil_pousadas_BR_.xlsx)
 *   - AZUL    = Clique no anúncio Google Ads — mock: 12 cliques em HOT (real quando GA4 integrar)
 *
 * Tamanhos menores (vs versão anterior):
 *   - Bolinha amarela (prospectada): 6px (era 16px)
 *   - Bolinha azul (clique anúncio): 10px com anel
 *   - Bolinha verde (convertida): 12px com estrela central
 *   - Bolinha selecionada: +6px
 *
 * Performance:
 *   - 9.627 markers podem pesar. Usamos Canvas rendering via L.canvasMarkers
 *     para evitar 9k DOM nodes.
 *   - Dataset é carregado via fetch lazy (cache HTTP agressivo).
 *   - Animação "live feed" desativada quando > 500 markers (aparece tudo de uma vez).
 *
 * Filtros (gerenciados pelo parent panel):
 *   - Pode receber apenas leads filtrados ou o dataset completo.
 *   - As 3 categorias são computadas aqui baseadas em status/score.
 */

// Centro geográfico do Brasil
const BRAZIL_CENTER: [number, number] = [-14.5, -52];
const BRAZIL_ZOOM = 4;

// ── Sistema de 3 Cores ─────────────────────────────────────────────────────────

type MarkerCategory = "converted" | "prospect" | "click";

interface CategoryStyle {
  color: string;
  label: string;
  description: string;
  size: number;          // diâmetro da bolinha em px (MENOR que versão anterior)
  selectedSize: number;  // tamanho quando selecionada
  hasPulse?: boolean;    // anel pulsante
  hasStar?: boolean;      // estrela central (apenas convertidas)
  zIndex: number;         // sobreposição
}

const CATEGORY_STYLE: Record<MarkerCategory, CategoryStyle> = {
  converted: {
    color: "#22c55e",       // verde-500
    label: "Convertida",
    description: "Pousada cliente Zélla (pagante)",
    size: 12,                // menor que versão anterior (era 16)
    selectedSize: 18,
    hasStar: true,
    zIndex: 1000,
  },
  prospect: {
    color: "#facc15",       // amarelo-400
    label: "Prospectada",
    description: "Pousada da planilha (10.175 prospectadas)",
    size: 6,                // MUITO menor — visualização densa
    selectedSize: 12,
    zIndex: 100,
  },
  click: {
    color: "#3b82f6",       // azul-500
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
  // Dados para popup
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
  /** Filtro de categoria (mostrar só uma cor) — null = todas */
  activeFilter?: MarkerCategory | null;
  /** Callback quando dados da planilha carregam (para KPIs do parent) */
  onPousadasLoaded?: (data: {
    prospectadas: PousadaBrasil[];
    convertidas: PousadaBrasil[];
    cliques: PousadaBrasil[];
  }) => void;
}

/**
 * Helper: computa categoria de um Lead existente (legado do ZCC).
 * Pousadas convertidas (status=convertido) → VERDE
 * Pousadas com tier/quartos (prospectadas) → AMARELO
 * Cliques (status=pending sem tier) → AZUL
 */
function leadCategory(lead: Lead): MarkerCategory {
  if (lead.status === "convertido" || lead.converted) return "converted";
  if (lead.tierSugerido || lead.roomsCount > 0) return "prospect";
  return "click";
}

/** Helper: converte Lead do ZCC para o formato unificado. */
function leadToMarker(lead: Lead): LeadMarker {
  // Type assertion ampla: mocks antigos têm campos não-tipados (pousada, cidade, etc.)
  // que existem em runtime mas não na interface Lead.
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

/**
 * Componente interno que renderiza o mapa Leaflet. Carregado dinamicamente
 * para garantir que `window` exista antes de importar react-leaflet.
 */
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

  // ── Carrega dataset da planilha (lazy) ──
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
  // PRIORIZA o dataset da planilha (9.627 pousadas com lat/lng reais e jitter aplicado).
  // Os `leads` do ZCC (legado, 37 mocks) NÃO são mostrados no mapa — apenas a planilha.
  // Motivo: o usuário pediu para usar APENAS os dados da planilha com lat/lng válidos.
  const markers: LeadMarker[] = React.useMemo(() => {
    if (!planilhaData) return [];

    const result: LeadMarker[] = [];

    // Helper: valida se lat/lng estão dentro do Brasil (evita markers "flutuando")
    const isValidCoord = (lat: number, lng: number) =>
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -35 && lat <= 5 &&   // Brasil: -33 a +5 (extremo norte)
      lng >= -75 && lng <= -30;   // Brasil: -73 a -32

    // 1. PROSPECTADAS (AMARELO) — TODAS as 9.627 da planilha (sem limite de 5k)
    for (const p of planilhaData.prospectadas) {
      if (!isValidCoord(p.lat, p.lng)) continue; // pula inválidas (não vira "floating")
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

    // 2. CONVERTIDAS (VERDE) — sobrepõe as prospectadas (8 pousadas mock)
    const prospectIds = new Set(result.map(m => m.id));
    for (const p of planilhaData.convertidas) {
      if (!isValidCoord(p.lat, p.lng)) continue;
      // Se já existe como prospectada, ATUALIZA a categoria para "converted"
      // (não cria duplicata) — verde sobrepõe amarelo
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
    // Clicques têm IDs próprios (CLICK-XXX-BR-YYYY) para não colidir com prospectadas
    for (const p of planilhaData.cliques) {
      if (!isValidCoord(p.lat, p.lng)) continue;
      result.push({
        id: p.id, // já vem com prefixo CLICK-
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

  // Aplica filtro de categoria
  const filteredMarkers = React.useMemo(() => {
    if (!activeFilter) return markers;
    return markers.filter(m => m.category === activeFilter);
  }, [markers, activeFilter]);

  // Animação "live feed" (só se < 500 markers — com 9.627 markers, aparece tudo direto)
  const [visibleCount, setVisibleCount] = React.useState(0);
  React.useEffect(() => {
    if (filteredMarkers.length === 0) {
      setVisibleCount(0);
      return;
    }
    if (filteredMarkers.length > 500) {
      // Render direto sem animação (9.627 markers aparecem instantaneamente)
      setVisibleCount(filteredMarkers.length);
      return;
    }
    setVisibleCount(0);
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setVisibleCount(i);
      if (i >= filteredMarkers.length) {
        clearInterval(interval);
      }
    }, 80);
    return () => clearInterval(interval);
  }, [filteredMarkers]);

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
  } = LeafletMods;

  /** Componente que centraliza o mapa num lead específico (quando selecionado). */
  const FlyToSelected = ({ marker, zoom }: { marker: LeadMarker | null; zoom?: number }) => {
    const map = useMap();
    React.useEffect(() => {
      if (marker) {
        map.flyTo([marker.lat, marker.lng], zoom ?? 8, { duration: 0.8 });
      }
    }, [marker, map, zoom]);
    return null;
  };

  /** Componente que abre o popup do marker do lead selecionado. */
  const OpenSelectedPopup = ({ markerId }: { markerId?: string | null }) => {
    const map = useMap();
    React.useEffect(() => {
      if (!markerId) return;
      map.eachLayer((layer) => {
        const anyLayer = layer as unknown as {
          getLatLng?: () => { lat: number; lng: number };
          openPopup?: () => void;
          options?: { markerId?: string };
        };
        if (anyLayer.openPopup && anyLayer.options?.markerId === markerId) {
          setTimeout(() => anyLayer.openPopup?.(), 400);
        }
      });
    }, [markerId, map]);
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
      maxZoom={20}          // aumentado de 18 → 20 (permite zoom rua-level)
      zoomControl={false}
      attributionControl={false}
      scrollWheelZoom={true}
      preferCanvas={true}    // render via Canvas (9.627 markers DOM = browser crash; Canvas = OK)
      className="h-full w-full"
      style={{ background: "#1a1a2e" }}
    >
      {/* Tiles escuros CartoDB — maxNativeZoom=19 para tiles nítidos até zoom 20 */}
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
      <OpenSelectedPopup markerId={selectedLeadId} />

      {/* Marcadores — sistema de 3 cores */}
      {filteredMarkers.slice(0, visibleCount).map((marker) => {
        const isSelected = marker.id === selectedLeadId;
        const icon = iconFor(marker, isSelected);
        if (!icon) return null;
        const style = CATEGORY_STYLE[marker.category];
        return (
          <Marker
            key={marker.id}
            position={[marker.lat, marker.lng]}
            icon={icon}
            // @ts-expect-error — markerId é uma option customizada para lookup posterior
            markerId={marker.id}
            eventHandlers={{
              click: () => {
                // Sincroniza com Lead do ZCC se existir
                const lead = leads.find(l => l.id === marker.id);
                if (lead) onSelectLead?.(lead);
              },
            }}
            zIndexOffset={isSelected ? 2000 : style.zIndex}
          >
            <Popup closeButton={false} offset={[0, -8]}>
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
                  ID: {marker.id}
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
  // Conta marcadores visíveis por categoria (para o footer)
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
      </div>

      {/* Contador no canto inferior esquerdo */}
      <div className="pointer-events-none absolute bottom-2 left-2 z-[1000] rounded-md border border-border bg-black/80 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur">
        <span className="font-semibold text-foreground">
          {counts.converted + counts.prospect + counts.click}
        </span>
        {" markers no mapa"}
        {activeFilter && (
          <span className="ml-1 text-amber-400">· filtrado: {CATEGORY_STYLE[activeFilter].label}</span>
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
