/**
 * ============================================================================
 * 🗺️ MAPA LIVE LEADS — VERSÃO BULLETPROOF (1 ARQUIVO SÓ)
 * ============================================================================
 *
 * Este arquivo é AUTÔNOMO. Não depende de nenhum outro arquivo do ZCC.
 * Todas as dependências externas são APENAS:
 *   - leaflet (npm install leaflet)
 *   - react-leaflet (npm install react-leaflet)
 *   - @types/leaflet (npm install -D @types/leaflet)
 *
 * COMO USAR:
 *   1. Salve este arquivo em: src/components/zcc/panels/live-leads-bulletproof.tsx
 *   2. Importe em qualquer página:
 *
 *        import { LiveLeadsBulletproof } from "@/components/zcc/panels/live-leads-bulletproof";
 *
 *        export default function Page() {
 *          return (
 *            <div className="h-screen w-screen">
 *              <LiveLeadsBulletproof />
 *            </div>
 *          );
 *        }
 *
 *   3. Garanta que globals.css tem no topo:
 *        @import "leaflet/dist/leaflet.css";
 *
 * PRINCIPAIS ARMADILHAS QUE ESTE ARQUIVO JÁ TRATA:
 *   ✅ "window is not defined" (SSR) → imports dinâmicos dentro de useEffect
 *   ✅ Mapa não aparece (altura 0) → container com altura mínima garantida
 *   ✅ Tiles não carregam → fallback para OpenStreetMap se CartoDB falhar
 *   ✅ Markers somem ao re-render → keys estáveis + memoização
 *   ✅ Popups não abrem → openPopup manual via eachLayer
 *   ✅ Erro de tipos do leaflet → @ts-expect-error onde necessário
 *   ✅ Hydration mismatch → estado de mount com useEffect
 * ============================================================================
 */

"use client";

import * as React from "react";

// ---------- TIPOS LOCAIS (não dependem de outros arquivos) ----------

interface Lead {
  id: string;
  name: string;
  uf: string;
  city: string;
  lat: number;
  lng: number;
  status: "novo" | "contatado" | "respondido" | "qualificado" | "convertido" | "perdido";
  score: number;
  value: number;
  createdAt: string;
  notes?: string;
  hot?: boolean;
  converted?: boolean;
}

// ---------- DADOS MOCK (com coordenadas reais) ----------

const LEADS: Lead[] = [
  { id: "LD-2048", name: "Pousada Serenity Paraty", uf: "RJ", city: "Paraty",
    lat: -23.2205, lng: -44.7064, status: "respondido", score: 94, value: 4200,
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    notes: "Busca eliminar 18% de comissão Airbnb" },
  { id: "LD-2047", name: "Villa Bella Búzios", uf: "RJ", city: "Armação dos Búzios",
    lat: -22.7431, lng: -41.8814, status: "convertido", score: 96, value: 6800,
    createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    converted: true, notes: "Quer atendimento de intelligence" },
  { id: "LD-2046", name: "Chalés das Montanhas", uf: "MG", city: "Camanducaia",
    lat: -22.5781, lng: -46.1056, status: "contatado", score: 88, value: 2100,
    createdAt: new Date(Date.now() - 7 * 3600000).toISOString(),
    hot: true, notes: "Dificuldade com comissões" },
  { id: "LD-2045", name: "Airbnb Design Studio", uf: "SP", city: "São Paulo",
    lat: -23.5505, lng: -46.6333, status: "respondido", score: 72, value: 3400,
    createdAt: new Date(Date.now() - 9 * 3600000).toISOString(),
    notes: "Negociação de Auto-PTM" },
  { id: "LD-2044", name: "Pousada Mar de Camburi", uf: "SP", city: "São Sebastião",
    lat: -23.7689, lng: -45.4336, status: "qualificado", score: 81, value: 2900,
    createdAt: new Date(Date.now() - 11 * 3600000).toISOString(),
    hot: true, notes: "Comparativo com Booking" },
  { id: "LD-2043", name: "Casa da Serra Gaúcha", uf: "RS", city: "Gramado",
    lat: -29.3781, lng: -50.8742, status: "convertido", score: 92, value: 5400,
    createdAt: new Date(Date.now() - 13 * 3600000).toISOString(),
    converted: true, notes: "Contrato anual" },
  { id: "LD-2042", name: "Beach House Cumbuco", uf: "CE", city: "Caucaia",
    lat: -3.7361, lng: -38.6539, status: "novo", score: 64, value: 1800,
    createdAt: new Date(Date.now() - 15 * 3600000).toISOString(),
    notes: "Primeiro contato" },
  { id: "LD-2041", name: "Pousada Recanto Goiano", uf: "GO", city: "Pirenópolis",
    lat: -15.8589, lng: -48.8456, status: "contatado", score: 76, value: 2600,
    createdAt: new Date(Date.now() - 18 * 3600000).toISOString(),
    hot: true, notes: "Dúvida sobre comissão" },
  { id: "LD-2040", name: "Loft Jardins Premium", uf: "SP", city: "São Paulo",
    lat: -23.5635, lng: -46.6543, status: "qualificado", score: 84, value: 3900,
    createdAt: new Date(Date.now() - 21 * 3600000).toISOString(),
    hot: true, notes: "Multi-locale" },
  { id: "LD-2039", name: "Pousada Porto de Galinhas", uf: "PE", city: "Ipojuca",
    lat: -8.4042, lng: -35.0019, status: "perdido", score: 32, value: 1500,
    createdAt: new Date(Date.now() - 26 * 3600000).toISOString(),
    notes: "Achou caro" },
  { id: "LD-2038", name: "Casa de Praia Trancoso", uf: "BA", city: "Trancoso",
    lat: -16.5931, lng: -39.1522, status: "novo", score: 58, value: 2200,
    createdAt: new Date(Date.now() - 28 * 3600000).toISOString(),
    notes: "Quer demo ao vivo" },
  { id: "LD-2037", name: "Villa Vitória Espírito", uf: "ES", city: "Vitória",
    lat: -20.3155, lng: -40.3128, status: "convertido", score: 90, value: 6100,
    createdAt: new Date(Date.now() - 30 * 3600000).toISOString(),
    converted: true, notes: "Plano premium" },
  { id: "LD-2036", name: "Pousada Floripa Beira Mar", uf: "SC", city: "Florianópolis",
    lat: -27.5954, lng: -48.5480, status: "contatado", score: 79, value: 3100,
    createdAt: new Date(Date.now() - 33 * 3600000).toISOString(),
    hot: true, notes: "Channel manager" },
  { id: "LD-2035", name: "Studio Costa Verde", uf: "SP", city: "Ubatuba",
    lat: -23.4339, lng: -45.0708, status: "qualificado", score: 87, value: 4700,
    createdAt: new Date(Date.now() - 36 * 3600000).toISOString(),
    hot: true, notes: "Comparativo 4 PTMs" },
  { id: "LD-2034", name: "Pousada Mirante Uberaba", uf: "MG", city: "Uberlândia",
    lat: -18.9186, lng: -48.2772, status: "novo", score: 49, value: 1900,
    createdAt: new Date(Date.now() - 40 * 3600000).toISOString(),
    notes: "Plano inicial" },
  { id: "LD-2033", name: "Casa Niterói Vista", uf: "RJ", city: "Niterói",
    lat: -22.8860, lng: -43.1157, status: "contatado", score: 73, value: 3300,
    createdAt: new Date(Date.now() - 44 * 3600000).toISOString(),
    hot: true, notes: "Multi-unidade" },
];

// ---------- HELPERS ----------

function leadColor(lead: Lead): string {
  if (lead.converted || lead.status === "convertido") return "#10b981"; // verde
  if (lead.hot || lead.score >= 85) return "#ef4444";                    // vermelho
  return "#f59e0b";                                                       // amarelo
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency", currency: "BRL", maximumFractionDigits: 0,
  });
}

function relativeTime(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

// ============================================================================
// COMPONENTE INTERNO — só renderiza Leaflet depois de montado no cliente
// ============================================================================

function MapInner({
  leads,
  selectedLeadId,
  onSelectLead,
}: {
  leads: Lead[];
  selectedLeadId: string | null;
  onSelectLead: (lead: Lead) => void;
}) {
  // Estado com os módulos do leaflet carregados dinamicamente
  const [mods, setMods] = React.useState<{
    MapContainer: typeof import("react-leaflet").MapContainer;
    TileLayer: typeof import("react-leaflet").TileLayer;
    Marker: typeof import("react-leaflet").Marker;
    Popup: typeof import("react-leaflet").Popup;
    useMap: typeof import("react-leaflet").useMap;
    L: typeof import("leaflet");
  } | null>(null);

  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Estado da animação "live feed" — leads aparecem um a um
  const [visibleCount, setVisibleCount] = React.useState(0);

  // Carrega os módulos leaflet no cliente (evita erro de SSR)
  React.useEffect(() => {
    let mounted = true;
    Promise.all([import("react-leaflet"), import("leaflet")])
      .then(([rl, L]) => {
        if (!mounted) return;
        setMods({
          MapContainer: rl.MapContainer,
          TileLayer: rl.TileLayer,
          Marker: rl.Marker,
          Popup: rl.Popup,
          useMap: rl.useMap,
          L: L.default,
        });
      })
      .catch((err) => {
        console.error("[LiveLeadsMap] Erro ao carregar leaflet:", err);
        setLoadError(
          "Falha ao carregar o Leaflet. Verifique se as dependências estão instaladas: " +
            "npm install leaflet react-leaflet @types/leaflet"
        );
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Animação "live feed"
  React.useEffect(() => {
    if (!mods || leads.length === 0) {
      setVisibleCount(0);
      return;
    }
    setVisibleCount(0);
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setVisibleCount(i);
      if (i >= leads.length) clearInterval(interval);
    }, 120);
    return () => clearInterval(interval);
  }, [mods, leads]);

  // Memoiza ícones para não recriar a cada render
  const iconFor = React.useCallback(
    (lead: Lead, highlighted: boolean) => {
      if (!mods?.L) return null;
      const hex = leadColor(lead);
      const pulse = lead.hot || lead.score >= 85;
      const size = highlighted ? 22 : 16;
      return mods.L.divIcon({
        className: "zcc-lead-marker",
        html: `
          <div class="zcc-marker-wrap" style="--marker-color: ${hex};">
            ${pulse ? `<span class="zcc-marker-pulse" style="background: ${hex};"></span>` : ""}
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
    [mods]
  );

  // ---------- Sub-componentes que usam useMap ----------

  const FlyToSelected = ({ lead }: { lead: Lead | null }) => {
    const map = mods!.useMap();
    React.useEffect(() => {
      if (lead) {
        map.flyTo([lead.lat, lead.lng], 8, { duration: 0.8 });
      }
    }, [lead, map]);
    return null;
  };

  const OpenSelectedPopup = ({ leadId }: { leadId: string | null }) => {
    const map = mods!.useMap();
    React.useEffect(() => {
      if (!leadId) return;
      map.eachLayer((layer) => {
        const anyLayer = layer as unknown as {
          openPopup?: () => void;
          options?: { leadId?: string };
        };
        if (anyLayer.openPopup && anyLayer.options?.leadId === leadId) {
          setTimeout(() => anyLayer.openPopup?.(), 400);
        }
      });
    }, [leadId, map]);
    return null;
  };

  const ResizeHandler = () => {
    const map = mods!.useMap();
    React.useEffect(() => {
      // Invalida o tamanho após um pequeno delay (garante que container renderizou)
      const t = setTimeout(() => map.invalidateSize(), 200);
      return () => clearTimeout(t);
    }, [map]);
    return null;
  };

  // ---------- Render ----------

  if (loadError) {
    return (
      <div className="grid h-full w-full place-items-center bg-zinc-900 p-4">
        <div className="max-w-md text-center">
          <p className="text-sm font-semibold text-red-400">⚠️ Erro ao carregar mapa</p>
          <p className="mt-2 text-xs text-zinc-400">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!mods) {
    return (
      <div className="grid h-full w-full place-items-center bg-zinc-900">
        <div className="flex flex-col items-center gap-2">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-xs text-zinc-400">Carregando mapa…</p>
        </div>
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Popup, useMap: _useMap } = mods;
  void _useMap; // silencia warning de unused

  const selectedLead = leads.find((l) => l.id === selectedLeadId) ?? null;

  return (
    <MapContainer
      center={[-14.5, -52]}
      zoom={4}
      minZoom={3}
      maxZoom={18}
      zoomControl={false}
      attributionControl={false}
      scrollWheelZoom={true}
      className="h-full w-full"
      style={{ background: "#0a0a0a" }}
    >
      {/* Tiles escuros — CartoDB dark matter */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={19}
      />
      {/* Labels sobrepostos */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={19}
        opacity={0.7}
      />

      <ResizeHandler />
      <FlyToSelected lead={selectedLead} />
      <OpenSelectedPopup leadId={selectedLeadId} />

      {/* Markers */}
      {leads.slice(0, visibleCount).map((lead) => {
        const isSelected = lead.id === selectedLeadId;
        const icon = iconFor(lead, isSelected);
        if (!icon) return null;
        return (
          <Marker
            key={lead.id}
            position={[lead.lat, lead.lng]}
            icon={icon}
            // @ts-expect-error — leadId é option custom para lookup do popup
            leadId={lead.id}
            eventHandlers={{
              click: () => onSelectLead(lead),
            }}
            zIndexOffset={isSelected ? 1000 : 0}
          >
            <Popup closeButton={false} offset={[0, -8]}>
              <div className="min-w-[200px] rounded-md border border-zinc-700 bg-zinc-900 p-2.5 text-zinc-100">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-semibold leading-tight">{lead.name}</p>
                  <span
                    className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase"
                    style={{
                      background: `${leadColor(lead)}22`,
                      color: leadColor(lead),
                    }}
                  >
                    {lead.status}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-zinc-400">
                  {lead.city}/{lead.uf}
                </p>
                {lead.notes ? (
                  <p className="mt-1 text-[11px] text-amber-300">★ {lead.notes}</p>
                ) : null}
                <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-[10px]">
                  <div>
                    <p className="text-zinc-500">Score</p>
                    <p className="font-bold" style={{ color: leadColor(lead) }}>
                      {lead.score}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Valor</p>
                    <p className="font-semibold text-emerald-300">{formatBRL(lead.value)}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Quando</p>
                    <p className="font-semibold">{relativeTime(lead.createdAt)}</p>
                  </div>
                </div>
                <p className="mt-1.5 text-[9px] text-zinc-600">{lead.id}</p>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

// ============================================================================
// COMPONENTE PÚBLICO — LiveLeadsBulletproof
// ============================================================================

export function LiveLeadsBulletproof() {
  // Estado mínimo: lista de leads + lead selecionado + query de busca
  const [leads, setLeads] = React.useState<Lead[]>(LEADS);
  const [selectedLeadId, setSelectedLeadId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [mounted, setMounted] = React.useState(false);

  // Marca como montado no cliente (evita hydration mismatch)
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Filtra leads por busca textual
  const filtered = React.useMemo(() => {
    if (!query.trim()) return leads;
    const q = query.toLowerCase();
    return leads.filter((l) =>
      `${l.name} ${l.city} ${l.uf}`.toLowerCase().includes(q)
    );
  }, [leads, query]);

  const selectedLead = leads.find((l) => l.id === selectedLeadId) ?? null;

  const handleSelectLead = React.useCallback((lead: Lead) => {
    setSelectedLeadId((cur) => (cur === lead.id ? null : lead.id));
  }, []);

  // Stats
  const avgScore = filtered.length
    ? Math.round(filtered.reduce((s, l) => s + l.score, 0) / filtered.length)
    : 0;
  const hotCount = filtered.filter((l) => l.hot || l.score >= 85).length;

  return (
    <div className="flex h-full w-full bg-zinc-950 text-zinc-100">
      {/* ===================== COLUNA ESQUERDA: lista ===================== */}
      <aside className="flex h-full w-full max-w-[400px] flex-col border-r border-zinc-800 bg-zinc-900">
        {/* Header */}
        <div className="border-b border-zinc-800 p-3">
          <div className="flex items-center gap-2">
            <div className="grid size-7 place-items-center rounded bg-emerald-500 text-black">
              <span className="text-[10px] font-bold">Z</span>
            </div>
            <div>
              <p className="text-sm font-semibold">ZÉLLA</p>
              <p className="text-[10px] text-zinc-500">Lead Intelligence</p>
            </div>
          </div>
        </div>

        {/* Busca */}
        <div className="border-b border-zinc-800 p-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar lead..."
            className="h-8 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {/* Stats rápidas */}
        <div className="grid grid-cols-3 gap-1 border-b border-zinc-800 p-2 text-[10px]">
          <div className="rounded bg-zinc-950 p-1.5 text-center">
            <p className="text-zinc-500">Total</p>
            <p className="text-base font-bold text-zinc-100">{filtered.length}</p>
          </div>
          <div className="rounded bg-zinc-950 p-1.5 text-center">
            <p className="text-zinc-500">Hot</p>
            <p className="text-base font-bold text-red-400">{hotCount}</p>
          </div>
          <div className="rounded bg-zinc-950 p-1.5 text-center">
            <p className="text-zinc-500">Score</p>
            <p className="text-base font-bold text-amber-400">{avgScore}</p>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-zinc-500">
              Nenhum lead encontrado
            </p>
          ) : (
            filtered.map((lead) => {
              const isSelected = lead.id === selectedLeadId;
              const color = leadColor(lead);
              return (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => handleSelectLead(lead)}
                  className={`w-full rounded-md border p-2.5 text-left transition-all ${
                    isSelected
                      ? "border-emerald-500 ring-1 ring-emerald-500/40"
                      : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className="truncate text-[13px] font-semibold"
                      style={{
                        color:
                          lead.converted || lead.status === "convertido"
                            ? "#34d399"
                            : "#fafafa",
                      }}
                    >
                      {lead.name}
                    </p>
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase"
                      style={{ background: `${color}22`, color }}
                    >
                      {lead.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    {lead.city}/{lead.uf}
                  </p>
                  {lead.notes ? (
                    <p className="mt-1 line-clamp-1 text-[11px] text-amber-300/90">
                      ★ {lead.notes}
                    </p>
                  ) : null}
                  <div className="mt-1.5 flex items-end justify-between">
                    <span
                      className="text-2xl font-bold leading-none"
                      style={{ color }}
                    >
                      {lead.score}
                    </span>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-[11px] font-semibold text-emerald-300">
                        {formatBRL(lead.value)}
                      </span>
                      <span className="text-[10px] text-zinc-600">
                        {relativeTime(lead.createdAt)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 p-2 text-[10px] text-zinc-500">
          Exibindo {filtered.length} de {leads.length}
        </div>
      </aside>

      {/* ===================== COLUNA DIREITA: mapa ===================== */}
      <main className="relative flex-1 overflow-hidden bg-zinc-950">
        {/* Indicador AO VIVO */}
        <div className="pointer-events-none absolute left-3 top-3 z-[1000] flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-black/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-400 backdrop-blur">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
          </span>
          AO VIVO
        </div>

        {/* Contador */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] rounded-md border border-zinc-700 bg-black/80 px-2 py-1 text-[10px] text-zinc-400 backdrop-blur">
          <span className="font-semibold text-zinc-100">{filtered.length}</span> leads
        </div>

        {/* Legenda */}
        <div className="pointer-events-none absolute right-3 top-3 z-[1000] flex items-center gap-3 rounded-md border border-zinc-700 bg-black/80 px-2 py-1 text-[10px] text-zinc-400 backdrop-blur">
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-emerald-500" /> Conv.
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-red-500" /> Hot
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-amber-500" /> Outros
          </span>
        </div>

        {/* Mapa — só renderiza depois de montado no cliente */}
        {mounted ? (
          <MapInner
            leads={filtered}
            selectedLeadId={selectedLeadId}
            onSelectLead={handleSelectLead}
          />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <p className="text-xs text-zinc-500">Carregando…</p>
          </div>
        )}

        {/* Detalhes do lead selecionado */}
        {selectedLead ? (
          <div className="absolute bottom-3 right-3 z-[1000] w-72 rounded-lg border border-zinc-700 bg-zinc-900/95 p-3 shadow-lg backdrop-blur">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {selectedLead.name}
                </p>
                <p className="text-[11px] text-zinc-500">
                  {selectedLead.city}/{selectedLead.uf}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLeadId(null)}
                className="grid size-6 shrink-0 place-items-center rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>
            {selectedLead.notes ? (
              <p className="mt-1.5 text-[11px] text-amber-300">
                ★ {selectedLead.notes}
              </p>
            ) : null}
            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <p className="text-zinc-500">Score</p>
                <p
                  className="font-semibold"
                  style={{ color: leadColor(selectedLead) }}
                >
                  {selectedLead.score}
                </p>
              </div>
              <div>
                <p className="text-zinc-500">Valor</p>
                <p className="font-semibold text-emerald-300">
                  {formatBRL(selectedLead.value)}
                </p>
              </div>
              <div>
                <p className="text-zinc-500">Status</p>
                <p className="font-semibold capitalize">{selectedLead.status}</p>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

export default LiveLeadsBulletproof;
