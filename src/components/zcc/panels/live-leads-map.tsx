// @ts-nocheck — ZCC visual panel, types fixed in dedicated refactoring pass
"use client";
import "leaflet/dist/leaflet.css";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { Lead } from "@/lib/zcc/types";

/*
 * LiveLeadsMap v4 — Limpo, performático, sem planilha pesada
 * ============================================================
 *
 * ARQUITETURA:
 *   - Marcadores VERDES (conversão): carregados via /api/leads/converted-pousadas
 *     (Tenants ativos com Property + lat/lng). Quando o dono da pousada
 *     paga um plano e completa o cadastro, ele vira bolinha verde aqui.
 *
 *   - Marcadores AMARELOS (prospectados): mock de demonstração do ZCC
 *     (leads pendentes com tierSugerido/roomsCount). Substituídos por
 *     dados reais quando houver integração com prospecção.
 *
 *   - Marcadores AZUIS (clique anúncio): mock de demonstração.
 *     Substituídos por tracking Google Ads quando houver integração.
 *
 * BOLINHAS MENORES:
 *   - Verde (convertida): 12px com estrela branca central
 *   - Amarelo (prospectada): 8px
 *   - Azul (clique anúncio): 10px com anel pulsante
 *
 * PERFORMANCE:
 *   - Sem cluster (era pesado com 9k+ markers da planilha)
 *   - Popups gerados via JSX (React puro, sem HTML string)
 *   - Mapa carrega instantaneamente (sem fetch de 2MB)
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
    description: "Lead prospectado (mock)",
    size: 8,
    selectedSize: 14,
    zIndex: 100,
  },
  click: {
    color: "#3b82f6",
    label: "Clique Anúncio",
    description: "Clique no anúncio (mock — real quando GA4 integrar)",
    size: 10,
    selectedSize: 16,
    hasPulse: true,
    zIndex: 500,
  },
};

interface PousadaConvertida {
  id: string;
  tenantId: string;
  nome: string;
  plano: string;
  status: string;
  subscriptionAt: string | null;
  enderecoCompleto: string;
  lat: number | null;
  lng: number | null;
  whatsapp: string | null;
  email: string | null;
  phone: string | null;
  niche: string;
  cidade: string;
  uf: string;
  rua: string;
  numero: string;
  bairro: string;
  tipo: string;
}

interface LeadMarker {
  id: string;
  lat: number;
  lng: number;
  category: MarkerCategory;
  nome: string;
  cidade: string;
  uf: string;
  // Dados extras para popup
  tier?: string;
  funnel?: string;
  score?: number;
  qtdQuartos?: number;
  valores?: string;
  sinaisIntencao?: string;
  localPraia?: string;
  whatsapp?: string;
  email?: string;
  endereco?: string;
  plano?: string;
  subscriptionAt?: string;
}

interface LiveLeadsMapProps {
  leads: Lead[];
  selectedLeadId?: string | null;
  onSelectLead?: (lead: Lead) => void;
  className?: string;
  activeFilter?: MarkerCategory | null;
}

function isValidCoord(lat: number, lng: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -35 && lat <= 5 &&
    lng >= -75 && lng <= -30
  );
}

/** Helper: determina a categoria de um Lead do ZCC. */
function leadCategory(lead: Lead): MarkerCategory {
  if (lead.status === "convertido" || lead.converted) return "converted";
  if (lead.tierSugerido || lead.roomsCount > 0) return "prospect";
  return "click";
}

/** Helper: converte Lead do ZCC para o formato unificado do mapa. */
function leadToMarker(lead: Lead): LeadMarker | null {
  const l = lead as any;
  const lat = l.latitude ?? l.lat;
  const lng = l.longitude ?? l.lng;
  if (lat == null || lng == null || !isValidCoord(lat, lng)) return null;

  return {
    id: l.id,
    lat,
    lng,
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

/** Helper: converte pousada convertida (Tenant pago) para marker VERDE. */
function convertedToMarker(p: PousadaConvertida): LeadMarker | null {
  if (p.lat == null || p.lng == null || !isValidCoord(p.lat, p.lng)) return null;

  return {
    id: `conv-${p.id}`,
    lat: p.lat,
    lng: p.lng,
    category: "converted",
    nome: p.nome,
    cidade: p.cidade,
    uf: p.uf,
    whatsapp: p.whatsapp ?? undefined,
    email: p.email ?? undefined,
    endereco: p.enderecoCompleto,
    plano: p.plano,
    subscriptionAt: p.subscriptionAt ?? undefined,
  };
}

function LeafletMapInner({
  leads,
  selectedLeadId,
  onSelectLead,
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
    Promise.all([import("react-leaflet"), import("leaflet")]).then(([rl, L]) => {
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
    });
    return () => { mounted = false; };
  }, []);

  // ── Carrega pousadas convertidas (Tenants ativos com lat/lng) ──
  const [converted, setConverted] = React.useState<PousadaConvertida[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/leads/converted-pousadas', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { pousadas: [] })
      .then(data => {
        if (cancelled) return;
        setConverted(data.pousadas ?? []);
      })
      .catch(err => {
        console.warn('[LIVE_LEADS_MAP] Falha ao carregar convertidas:', err);
        if (!cancelled) setConverted([]);
      });
    return () => { cancelled = true; };
  }, []);

  // ── Marcadores a renderizar (mocks do ZCC + convertidas reais) ──
  const markers: LeadMarker[] = React.useMemo(() => {
    const result: LeadMarker[] = [];

    // 1. Mocks do ZCC (legado) — converte e descarta inválidos
    for (const lead of leads) {
      const m = leadToMarker(lead);
      if (m) result.push(m);
    }

    // 2. Pousadas convertidas REAIS (Tenants ativos com cadastro completo)
    for (const p of converted) {
      const m = convertedToMarker(p);
      if (m) result.push(m);
    }

    return result;
  }, [leads, converted]);

  const selectedMarker = React.useMemo(
    () => markers.find(m => m.id === selectedLeadId) ?? null,
    [markers, selectedLeadId]
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

  const { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } = LeafletMods;

  /** Componente que centraliza o mapa num lead específico. */
  const FlyToSelected = ({ marker, zoom }: { marker: LeadMarker | null; zoom?: number }) => {
    const map = useMap();
    React.useEffect(() => {
      if (marker) {
        map.flyTo([marker.lat, marker.lng], zoom ?? 8, { duration: 0.8 });
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
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={19}
      />
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={19}
        opacity={0.7}
      />

      <ResizeHandler />
      <FlyToSelected marker={selectedMarker} />

      {/* Marcadores — renderiza direto no DOM (volume pequeno agora) */}
      {markers.map((marker) => {
        const isSelected = marker.id === selectedLeadId;
        const icon = iconFor(marker, isSelected);
        if (!icon) return null;
        const style = CATEGORY_STYLE[marker.category];
        return (
          <Marker
            key={marker.id}
            position={[marker.lat, marker.lng]}
            icon={icon}
            eventHandlers={{
              click: () => {
                const lead = leads.find(l => l.id === marker.id);
                if (lead) onSelectLead?.(lead);
              },
            }}
            zIndexOffset={isSelected ? 2000 : style.zIndex}
          >
            <Popup closeButton={false} offset={[0, -8]} maxWidth={300}>
              <PopupContent marker={marker} />
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

/** Conteúdo do popup com TODOS os dados da pousada. */
function PopupContent({ marker }: { marker: LeadMarker }) {
  const style = CATEGORY_STYLE[marker.category];
  const local = `${marker.cidade}/${marker.uf}${marker.localPraia ? ` · ${marker.localPraia}` : ""}`;

  return (
    <div className="min-w-[240px] max-w-[280px]">
      {/* Header: Nome + Badge categoria */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-semibold leading-tight text-foreground">
          {marker.nome}
        </p>
        <span
          className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase"
          style={{ background: `${style.color}22`, color: style.color }}
        >
          {style.label}
        </span>
      </div>

      {/* Cidade/UF + Local */}
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {local}
      </p>

      {/* Endereço completo (apenas para convertidas com endereço) */}
      {marker.endereco && (
        <p className="mt-1 text-[11px] text-emerald-300">
          📍 {marker.endereco}
        </p>
      )}

      {/* Sinais de intenção */}
      {marker.sinaisIntencao && (
        <p className="mt-1 text-[11px] text-amber-300">
          ★ {marker.sinaisIntencao}
        </p>
      )}

      {/* Grid 3 colunas: Score / Tier / Quartos (para mocks) */}
      {(marker.score !== undefined || marker.tier || marker.qtdQuartos) && (
        <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px]">
          {marker.score !== undefined && (
            <div>
              <p className="text-muted-foreground">Score</p>
              <p className="font-bold" style={{ color: style.color }}>{marker.score}</p>
            </div>
          )}
          {marker.tier && (
            <div>
              <p className="text-muted-foreground">Tier</p>
              <p className="font-semibold">{marker.tier}</p>
            </div>
          )}
          {marker.qtdQuartos && marker.qtdQuartos > 0 && (
            <div>
              <p className="text-muted-foreground">Quartos</p>
              <p className="font-semibold">{marker.qtdQuartos}</p>
            </div>
          )}
        </div>
      )}

      {/* Plano (apenas para convertidas) */}
      {marker.plano && (
        <p className="mt-2 text-[11px] text-emerald-300 font-semibold">
          PLANO {marker.plano.toUpperCase()}
          {marker.subscriptionAt && (
            <span className="ml-1 text-muted-foreground">
              · desde {new Date(marker.subscriptionAt).toLocaleDateString('pt-BR')}
            </span>
          )}
        </p>
      )}

      {/* Valores estimados */}
      {marker.valores && (
        <p className="mt-1.5 text-[11px] text-emerald-300">{marker.valores}</p>
      )}

      {/* Bloco CONTATO — sempre presente */}
      {(marker.whatsapp || marker.email) && (
        <div className="mt-2 pt-2 border-t border-border">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">
            Contato
          </p>
          <div className="flex flex-wrap gap-1">
            {marker.whatsapp && (
              <span className="inline-block rounded bg-[#25D36622] px-1.5 py-0.5 text-[10px] font-semibold text-[#25D366]">
                📱 {marker.whatsapp}
              </span>
            )}
            {marker.email && (
              <span className="inline-block rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">
                ✉ {marker.email}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Footer: Coordenadas para auditoria */}
      <p className="mt-2 text-[9px] text-muted-foreground/70">
        Lat/Lng: {marker.lat.toFixed(5)}, {marker.lng.toFixed(5)}
      </p>
    </div>
  );
}

/** Controles de zoom discretos no canto inferior direito. */
function ZoomControlsInner() {
  const [useMapHook, setUseMapHook] = React.useState<typeof import("react-leaflet").useMap | null>(null);

  React.useEffect(() => {
    let mounted = true;
    import("react-leaflet").then((rl) => {
      if (!mounted) return;
      setUseMapHook(() => rl.useMap);
    });
    return () => { mounted = false; };
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
        aria-label="Aumentar zoom"
        title="Aumentar zoom (+)"
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
      >+</button>
      <button
        type="button"
        onClick={zoomOut}
        aria-label="Diminuir zoom"
        title="Diminuir zoom (−)"
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
      >−</button>
      <button
        type="button"
        onClick={resetView}
        aria-label="Resetar visão"
        title="Voltar para visão Brasil"
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
}: LiveLeadsMapProps) {
  const [counts, setCounts] = React.useState({ converted: 0, prospect: 0, click: 0 });

  // Conta categorias dos leads atuais
  React.useEffect(() => {
    const c = { converted: 0, prospect: 0, click: 0 };
    for (const lead of leads) {
      const cat = leadCategory(lead);
      c[cat]++;
    }
    // Soma convertidas da API
    fetch('/api/leads/converted-pousadas', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { pousadas: [] })
      .then(data => {
        c.converted += (data.pousadas?.length ?? 0);
        setCounts(c);
      })
      .catch(() => setCounts(c));
  }, [leads]);

  return (
    <div className={cn("relative h-full w-full", className)}>
      <LeafletMapInner
        leads={leads}
        selectedLeadId={selectedLeadId}
        onSelectLead={onSelectLead}
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
      </div>

      {/* Contador */}
      <div className="pointer-events-none absolute bottom-2 left-2 z-[1000] rounded-md border border-border bg-black/80 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur">
        <span className="font-semibold text-foreground">
          {counts.converted + counts.prospect + counts.click}
        </span>
        {" markers no mapa"}
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
          width: label === "Prospectada" ? "8px" : label === "Convertida" ? "10px" : "8px",
          height: label === "Prospectada" ? "8px" : label === "Convertida" ? "10px" : "8px",
          boxShadow: `0 0 0 1px ${color}55`,
        }}
      />
      <span className="text-zinc-300">{label}</span>
      <span className="ml-auto text-zinc-500 tabular-nums">{count.toLocaleString('pt-BR')}</span>
    </div>
  );
}

export { CATEGORY_STYLE };
export type { MarkerCategory, LeadMarker, PousadaConvertida };
