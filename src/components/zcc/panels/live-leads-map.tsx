"use client";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { Lead } from "@/lib/zcc/types";
import {
  fetchPousadasBrasil,
  fetchPousadasConvertidasMock,
  fetchCliquesAnuncioMock,
  type PousadaBrasil,
} from "@/lib/zcc/pousadas-brasil-data";

/*
 * LiveLeadsMap v3 — MarkerCluster nativo (sem react-leaflet-cluster)
 * =================================================================
 *
 * CORREÇÃO DEFINITIVA:
 *   O react-leaflet-cluster v4 tem bug com react-leaflet v5 — em zoom
 *   alto (disableClusteringAtZoom), os markers somem do DOM. Esta versão
 *   usa o leaflet.markercluster nativo via API direta (L.markerClusterGroup)
 *   com useRef + useMap, sem depender do wrapper React.
 *
 * Resultado:
 *   - 9.627 pousadas plotadas em SUAS coordenadas reais (lat/lng da planilha)
 *   - Em zoom baixo: agrupadas em clusters coloridos (50px radius)
 *   - Em zoom médio: sub-clusters + markers individuais aparecem
 *   - Em zoom alto: TODAS as 9.627 pousadas visíveis em suas posições reais
 *   - Click em qualquer bolinha: popup com NOME + CIDADE + UF + WHATSAPP +
 *     EMAIL + TIER + SCORE + QUARTOS + VALORES da pousada
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
  email?: string;
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

function isValidCoord(lat: number, lng: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -35 && lat <= 5 &&
    lng >= -75 && lng <= -30
  );
}

/** Helper: cria o HTML do ícone da bolinha (com cor/tamanho/estrela). */
function markerIconHTML(category: MarkerCategory, isSelected: boolean): string {
  const style = CATEGORY_STYLE[category];
  const size = isSelected ? style.selectedSize : style.size;
  const hex = style.color;
  const pulseRing = style.hasPulse;
  const star = style.hasStar;

  return `
    <div class="zcc-marker-wrap" style="--marker-color: ${hex};">
      ${pulseRing ? `<span class="zcc-marker-pulse" style="background: ${hex};"></span>` : ""}
      <span class="zcc-marker-dot" style="
        background: ${hex};
        width: ${size}px;
        height: ${size}px;
        ${isSelected
          ? `box-shadow: 0 0 0 3px ${hex}55, 0 0 12px ${hex};`
          : `box-shadow: 0 0 0 1px #0a0a0a99;`
        }
      ">
        ${star ? `<svg class="zcc-marker-star" viewBox="0 0 24 24" fill="white"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>` : ""}
      </span>
    </div>
  `;
}

/** Helper: gera o conteúdo HTML do popup com TODOS os dados da pousada. */
function popupHTML(marker: LeadMarker): string {
  const style = CATEGORY_STYLE[marker.category];

  // Monta dados completos da pousada
  const localText = `${marker.cidade}/${marker.uf}${marker.localPraia ? ` · ${marker.localPraia}` : ""}`;
  const scoreBlock = marker.score !== undefined ? `
    <div>
      <p style="margin:0;font-size:10px;color:#94a3b8;">Score</p>
      <p style="margin:0;font-weight:700;color:${style.color};">${marker.score}</p>
    </div>` : "";

  const tierBlock = marker.tier ? `
    <div>
      <p style="margin:0;font-size:10px;color:#94a3b8;">Tier</p>
      <p style="margin:0;font-weight:600;">${marker.tier}</p>
    </div>` : "";

  const quartosBlock = marker.qtdQuartos && marker.qtdQuartos > 0 ? `
    <div>
      <p style="margin:0;font-size:10px;color:#94a3b8;">Quartos</p>
      <p style="margin:0;font-weight:600;">${marker.qtdQuartos}</p>
    </div>` : "";

  const valoresBlock = marker.valores ? `
    <p style="margin:8px 0 0;font-size:11px;color:#34d399;">${marker.valores}</p>` : "";

  const sinaisBlock = marker.sinaisIntencao ? `
    <p style="margin:6px 0 0;font-size:11px;color:#fbbf24;">★ ${marker.sinaisIntencao}</p>` : "";

  // Bloco de contato — sempre presente com WhatsApp + Email
  const contatoItems = [];
  if (marker.whatsapp) {
    contatoItems.push(`<span style="display:inline-block;background:#25D36622;color:#25D366;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;margin:2px 4px 2px 0;">📱 WhatsApp: ${marker.whatsapp}</span>`);
  }
  if (marker.email) {
    contatoItems.push(`<span style="display:inline-block;background:#3b82f622;color:#60a5fa;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;margin:2px 4px 2px 0;">✉ ${marker.email}</span>`);
  }
  const contatoBlock = contatoItems.length > 0 ? `
    <div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.08);">
      <p style="margin:0 0 4px;font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Contato</p>
      <div>${contatoItems.join("")}</div>
    </div>` : "";

  // Coordenadas (footer para auditoria)
  const coordBlock = `
    <p style="margin:8px 0 0;font-size:9px;color:#64748b;">
      Lat/Lng: ${marker.lat.toFixed(5)}, ${marker.lng.toFixed(5)} · ID: ${marker.id}
    </p>`;

  return `
    <div style="min-width:240px;max-width:280px;font-family:system-ui,-apple-system,sans-serif;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
        <p style="margin:0;font-size:13px;font-weight:600;color:#f1f5f9;line-height:1.3;">${marker.nome}</p>
        <span style="background:${style.color}22;color:${style.color};padding:2px 6px;border-radius:3px;font-size:9px;font-weight:600;text-transform:uppercase;flex-shrink:0;">${style.label}</span>
      </div>
      <p style="margin:2px 0 0;font-size:11px;color:#94a3b8;">${localText}</p>
      ${sinaisBlock}
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:8px;font-size:10px;">
        ${scoreBlock}${tierBlock}${quartosBlock}
      </div>
      ${valoresBlock}
      ${contatoBlock}
      ${coordBlock}
    </div>
  `;
}

function LeafletMapInner({
  selectedLeadId,
  activeFilter,
  onPousadasLoaded,
}: LiveLeadsMapProps) {
  const [LeafletMods, setLeafletMods] = React.useState<{
    MapContainer: typeof import("react-leaflet").MapContainer;
    TileLayer: typeof import("react-leaflet").TileLayer;
    useMap: typeof import("react-leaflet").useMap;
    L: typeof import("leaflet");
  } | null>(null);

  React.useEffect(() => {
    let mounted = true;
    Promise.all([
      import("react-leaflet"),
      import("leaflet"),
      import("leaflet.markercluster"),
    ]).then(([rl, L]) => {
      if (!mounted) return;
      setLeafletMods({
        MapContainer: rl.MapContainer,
        TileLayer: rl.TileLayer,
        useMap: rl.useMap,
        L: L.default,
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
  const markers: LeadMarker[] = React.useMemo(() => {
    if (!planilhaData) return [];

    const result: LeadMarker[] = [];

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
        email: p.email,
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
          id: p.id, lat: p.lat, lng: p.lng, category: "converted",
          nome: p.nome, cidade: p.cidade, uf: p.uf,
          tier: p.tier, funnel: p.funnel, score: p.score,
          qtdQuartos: p.qtdQuartos, valores: p.valores,
          sinaisIntencao: p.sinaisIntencao, localPraia: p.localPraia,
          whatsapp: p.whatsapp, email: p.email,
        });
      }
    }

    // 3. CLIQUES (AZUL) — 12 cliques mock
    for (const p of planilhaData.cliques) {
      if (!isValidCoord(p.lat, p.lng)) continue;
      result.push({
        id: p.id, lat: p.lat, lng: p.lng, category: "click",
        nome: p.nome, cidade: p.cidade, uf: p.uf,
        tier: p.tier, funnel: p.funnel, score: p.score,
        qtdQuartos: p.qtdQuartos, valores: p.valores,
        sinaisIntencao: p.sinaisIntencao, localPraia: p.localPraia,
        whatsapp: p.whatsapp, email: p.email,
      });
    }

    return result;
  }, [planilhaData]);

  // Aplica filtro de categoria
  const filteredMarkers = React.useMemo(() => {
    if (!activeFilter) return markers;
    return markers.filter(m => m.category === activeFilter);
  }, [markers, activeFilter]);

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

  const { MapContainer, TileLayer, useMap, L } = LeafletMods;

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
      <FlyToSelected selectedLeadId={selectedLeadId} markers={filteredMarkers} />

      {/* MarkerClusterGroup via API nativa do leaflet.markercluster */}
      <ClusterLayer
        L={L}
        markers={filteredMarkers}
        selectedLeadId={selectedLeadId}
      />

      <ZoomControlsInner />
    </MapContainer>
  );
}

/**
 * ClusterLayer — Componente que cria e gerencia o MarkerClusterGroup
 * nativo do leaflet.markercluster (sem react-leaflet-cluster).
 *
 * Vantagens:
 *   - Mais estável: usa API nativa, sem wrapper React com bugs
 *   - Markers NÃO somem ao fazer zoom (problema do react-leaflet-cluster v4)
 *   - Em disableClusteringAtZoom, markers individuais aparecem com popup completo
 */
function ClusterLayer({
  L,
  markers,
  selectedLeadId,
}: {
  L: typeof import("leaflet");
  markers: LeadMarker[];
  selectedLeadId?: string | null;
}) {
  const useMap = React.useMemo(() => {
    // Importa useMap dinamicamente
    // (já foi carregado no parent LeafletMapInner, mas precisamos de acesso ao map)
    return null;
  }, []);

  // Acesso ao map via hook useMap (importado em runtime)
  const [useMapHook, setUseMapHook] = React.useState<any>(null);

  React.useEffect(() => {
    import("react-leaflet").then((rl) => setUseMapHook(() => rl.useMap));
  }, []);

  if (!useMapHook) return null;

  return (
    <ClusterLayerInner
      L={L}
      markers={markers}
      selectedLeadId={selectedLeadId}
      useMap={useMapHook}
    />
  );
}

function ClusterLayerInner({
  L,
  markers,
  selectedLeadId,
  useMap,
}: {
  L: typeof import("leaflet");
  markers: LeadMarker[];
  selectedLeadId?: string | null;
  useMap: typeof import("react-leaflet").useMap;
}) {
  const map = useMap();
  const clusterGroupRef = React.useRef<any>(null);

  // Cria o cluster group uma vez
  React.useEffect(() => {
    const clusterGroup = (L as any).markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      spiderfyDistanceMultiplier: 2,
      maxClusterRadius: 50,
      disableClusteringAtZoom: 14,
      chunkedLoading: true,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        const children = cluster.getAllChildMarkers();
        // Categoria dominante
        const cats = children.map((m: any) => m.options.category as MarkerCategory);
        const counts: Record<string, number> = {};
        for (const c of cats) counts[c] = (counts[c] || 0) + 1;
        const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "prospect";
        const style = CATEGORY_STYLE[dominant as MarkerCategory];
        const size = count > 100 ? 44 : count > 10 ? 36 : 28;

        return (L as any).divIcon({
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
          iconSize: (L as any).point(size, size),
        });
      },
      polygonOptions: {
        color: "#3b82f6",
        weight: 1,
        opacity: 0.3,
        fillOpacity: 0.05,
      },
    });

    clusterGroupRef.current = clusterGroup;
    map.addLayer(clusterGroup);

    return () => {
      map.removeLayer(clusterGroup);
      clusterGroupRef.current = null;
    };
  }, [L, map]);

  // Atualiza markers quando mudam (add/remove)
  React.useEffect(() => {
    const clusterGroup = clusterGroupRef.current;
    if (!clusterGroup) return;

    // Limpa markers antigos
    clusterGroup.clearLayers();

    // Cria novos markers com popup completo
    const newMarkers: any[] = [];
    for (const marker of markers) {
      if (!isValidCoord(marker.lat, marker.lng)) continue;

      const isSelected = marker.id === selectedLeadId;
      const style = CATEGORY_STYLE[marker.category];
      const size = isSelected ? style.selectedSize : style.size;

      const icon = (L as any).divIcon({
        className: "zcc-lead-marker zcc-lead-marker--" + marker.category,
        html: markerIconHTML(marker.category, isSelected),
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2],
      });

      const m = (L as any).marker([marker.lat, marker.lng], {
        icon,
        category: marker.category,
        markerId: marker.id,
        zIndexOffset: isSelected ? 2000 : style.zIndex,
      });

      // Popup COMPLETO com todos os dados da pousada
      m.bindPopup(popupHTML(marker), {
        closeButton: false,
        offset: [0, -8],
        maxWidth: 300,
      });

      // Tooltip no hover (mostra nome rápido)
      m.bindTooltip(
        `<span style="font-size:11px;font-weight:600;">${marker.nome}</span><span style="font-size:10px;color:#94a3b8;"> — ${marker.cidade}/${marker.uf}</span>`,
        { direction: "top", offset: [0, -8], opacity: 1 }
      );

      newMarkers.push(m);
    }

    // Adiciona ao cluster group de uma vez (performance)
    if (newMarkers.length > 0) {
      clusterGroup.addLayers(newMarkers);
    }
  }, [markers, selectedLeadId, L]);

  return null;
}

/** Componente que centraliza o mapa num lead específico. */
function FlyToSelected({
  selectedLeadId,
  markers,
}: {
  selectedLeadId?: string | null;
  markers: LeadMarker[];
}) {
  const [useMapHook, setUseMapHook] = React.useState<any>(null);

  React.useEffect(() => {
    import("react-leaflet").then((rl) => setUseMapHook(() => rl.useMap));
  }, []);

  if (!useMapHook) return null;
  return <FlyToSelectedInner selectedLeadId={selectedLeadId} markers={markers} useMap={useMapHook} />;
}

function FlyToSelectedInner({
  selectedLeadId,
  markers,
  useMap,
}: {
  selectedLeadId?: string | null;
  markers: LeadMarker[];
  useMap: typeof import("react-leaflet").useMap;
}) {
  const map = useMap();
  const marker = React.useMemo(
    () => markers.find(m => m.id === selectedLeadId) ?? null,
    [markers, selectedLeadId]
  );

  React.useEffect(() => {
    if (marker) {
      map.flyTo([marker.lat, marker.lng], 12, { duration: 0.8 });
    }
  }, [marker, map]);

  return null;
}

/** Componente que invalida o tamanho do mapa quando o container muda. */
function ResizeHandler() {
  const [useMapHook, setUseMapHook] = React.useState<any>(null);

  React.useEffect(() => {
    import("react-leaflet").then((rl) => setUseMapHook(() => rl.useMap));
  }, []);

  if (!useMapHook) return null;
  return <ResizeHandlerInner useMap={useMapHook} />;
}

function ResizeHandlerInner({
  useMap,
}: {
  useMap: typeof import("react-leaflet").useMap;
}) {
  const map = useMap();
  React.useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

/**
 * Controles de zoom discretos no canto inferior direito.
 */
function ZoomControlsInner() {
  const [useMapHook, setUseMapHook] = React.useState<any>(null);

  React.useEffect(() => {
    import("react-leaflet").then((rl) => setUseMapHook(() => rl.useMap));
  }, []);

  if (!useMapHook) return null;
  return <ZoomControlsClient useMap={useMapHook} />;
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
  leads: _leads,
  selectedLeadId,
  onSelectLead: _onSelectLead,
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
        leads={_leads}
        selectedLeadId={selectedLeadId}
        onSelectLead={_onSelectLead}
        activeFilter={activeFilter}
        onPousadasLoaded={handlePousadasLoaded}
      />

      {/* Indicador "AO VIVO" */}
      <div className="pointer-events-none absolute left-2 top-2 z-[1000] flex items-center gap-1.5 rounded-md border border-primary/30 bg-black/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary backdrop-blur">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
        </span>
        AO VIVO
      </div>

      {/* Legenda das 3 cores */}
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

      {/* Contador */}
      <div className="pointer-events-none absolute bottom-2 left-2 z-[1000] rounded-md border border-border bg-black/80 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur">
        <span className="font-semibold text-foreground">
          {counts.converted + counts.prospect + counts.click}
        </span>
        {" markers · "}
        <span className="text-blue-400">clusters dinâmicos</span>
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
