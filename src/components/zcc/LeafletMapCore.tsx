'use client';

// ==============================================================================
// LEAFLET MAP CORE — ZCC Live Leads (Client-only rendering)
// ==============================================================================
// 100% Bulletproof Inverted OSM Dark Map Tiles + SVG Location Drop Pins
// Guaranteed to load Brazil map with all cities, borders, and coastlines
// ==============================================================================

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LiveLead } from '@/lib/live-leads-mock-data';

interface LeafletMapCoreProps {
  leads: LiveLead[];
  selectedLead: LiveLead | null;
  onSelectLead: (lead: LiveLead) => void;
  onAnalyzeBrain?: (lead: LiveLead) => void;
}

// 1. Default Location Drop Pin (Gold/Amber ★)
const defaultIcon = L.divIcon({
  html: `<svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z" fill="url(#grad-amber)" stroke="#050811" stroke-width="1.5"/>
    <circle cx="14" cy="13" r="6" fill="white" opacity="0.95"/>
    <text x="14" y="16" text-anchor="middle" font-size="9" font-weight="bold" fill="#050811">&#9733;</text>
    <defs>
      <linearGradient id="grad-amber" x1="0" y1="0" x2="0" y2="36">
        <stop offset="0%" stop-color="#f59e0b"/>
        <stop offset="100%" stop-color="#d97706"/>
      </linearGradient>
    </defs>
  </svg>`,
  className: 'zella-marker-default',
  iconSize: [28, 36],
  iconAnchor: [14, 36],
  popupAnchor: [0, -36],
});

// 2. Hotspot Location Drop Pin (Red 🔥)
const hotspotIcon = L.divIcon({
  html: `<svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 0C7.164 0 0 7.164 0 16c0 12 16 24 16 24s16-12 16-24C32 7.164 24.836 0 16 0z" fill="url(#grad-red)" stroke="#050811" stroke-width="1.5"/>
    <circle cx="16" cy="15" r="7" fill="white" opacity="0.95"/>
    <text x="16" y="19" text-anchor="middle" font-size="11" font-weight="bold" fill="#dc2626">&#128293;</text>
    <defs>
      <linearGradient id="grad-red" x1="0" y1="0" x2="0" y2="40">
        <stop offset="0%" stop-color="#ef4444"/>
        <stop offset="100%" stop-color="#dc2626"/>
      </linearGradient>
    </defs>
  </svg>`,
  className: 'zella-marker-hot',
  iconSize: [32, 40],
  iconAnchor: [16, 40],
  popupAnchor: [0, -40],
});

// 3. Converted Location Drop Pin (Green ✓)
const convertedIcon = L.divIcon({
  html: `<svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z" fill="url(#grad-green)" stroke="#050811" stroke-width="1.5"/>
    <circle cx="14" cy="13" r="6" fill="white" opacity="0.95"/>
    <text x="14" y="16" text-anchor="middle" font-size="9" font-weight="bold" fill="#059669">&#10003;</text>
    <defs>
      <linearGradient id="grad-green" x1="0" y1="0" x2="0" y2="36">
        <stop offset="0%" stop-color="#10b981"/>
        <stop offset="100%" stop-color="#059669"/>
      </linearGradient>
    </defs>
  </svg>`,
  className: 'zella-marker-conv',
  iconSize: [28, 36],
  iconAnchor: [14, 36],
  popupAnchor: [0, -36],
});

function getLeadMarkerIcon(status: string, scoreQual: number) {
  if (status === 'convertido') return convertedIcon;
  if (scoreQual >= 90) return hotspotIcon;
  return defaultIcon;
}

// Controller to force Leaflet map size invalidation on render and smooth flyTo
function MapController({ target }: { target: LiveLead | null }) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 500);
    const t3 = setTimeout(() => map.invalidateSize(), 1200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [map]);

  useEffect(() => {
    if (target) {
      map.flyTo([target.latitude, target.longitude], 11, { duration: 1.2 });
    }
  }, [target, map]);

  return null;
}

// Functional Zoom Control Card Overlay (+ and - buttons)
function CustomZoomControl() {
  const map = useMap();

  const handleZoomIn = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    map.zoomIn();
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    map.zoomOut();
  };

  return (
    <div className="absolute bottom-6 left-6 z-[9999] pointer-events-auto">
      <div className="bg-[#090d16]/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl flex flex-col overflow-hidden text-white divide-y divide-slate-800">
        <button
          type="button"
          onClick={handleZoomIn}
          className="w-10 h-10 flex items-center justify-center text-xl font-mono font-bold hover:bg-slate-800 text-slate-100 transition-colors active:scale-95 cursor-pointer"
          title="Aumentar Zoom (+)"
          aria-label="Aumentar Zoom"
        >
          +
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="w-10 h-10 flex items-center justify-center text-xl font-mono font-bold hover:bg-slate-800 text-slate-100 transition-colors active:scale-95 cursor-pointer"
          title="Diminuir Zoom (-)"
          aria-label="Diminuir Zoom"
        >
          −
        </button>
      </div>
    </div>
  );
}

export default function LeafletMapCore({ leads, selectedLead, onSelectLead, onAnalyzeBrain }: LeafletMapCoreProps) {
  return (
    <div className="relative w-full h-full min-h-[550px] bg-[#050811] zella-dark-tiles">
      <MapContainer
        center={[-14.235, -51.9253]}
        zoom={5}
        className="h-full w-full z-0 min-h-[550px]"
        zoomControl={false}
        attributionControl={false}
        style={{ background: '#050811', width: '100%', height: '100%' }}
      >
        {/* Bulletproof OSM Inverted Dark Map Tiles */}
        <TileLayer
          attribution=""
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          subdomains={['a', 'b', 'c']}
          maxZoom={19}
        />
        <MapController target={selectedLead} />
        <CustomZoomControl />
        {leads.map((lead) => (
          <Marker
            key={lead.id}
            position={[lead.latitude, lead.longitude]}
            icon={getLeadMarkerIcon(lead.status, lead.scoreQual)}
            eventHandlers={{
              click: () => onSelectLead(lead),
            }}
          >
            <Popup className="zella-custom-popup">
              <div className="p-3 min-w-[240px] max-w-[280px] font-mono bg-[#090d16] text-white rounded-xl shadow-2xl border border-slate-800">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <h3 className="text-xs font-bold text-slate-100 leading-tight">{lead.pousada}</h3>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap font-mono">
                    {lead.status === 'convertido' ? 'Cliente' : `Score ${lead.scoreQual}`}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mb-2">{lead.cidade}/{lead.uf} {lead.localPraia ? `• ${lead.localPraia}` : ''}</p>
                
                <div className="grid grid-cols-2 gap-1.5 mb-2.5 text-[10px] bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-slate-500 block">Quartos:</span>
                    <span className="font-bold text-slate-200">{lead.qtdQuartos || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Diária Est.:</span>
                    <span className="font-bold text-emerald-400 truncate block">{lead.valoresEstimados || '-'}</span>
                  </div>
                </div>

                {lead.sinaisIntencao && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-1.5 mb-2.5 text-[10px] text-amber-300 truncate">
                    ⚡ {lead.sinaisIntencao}
                  </div>
                )}

                <button
                  onClick={() => {
                    onSelectLead(lead);
                    if (onAnalyzeBrain) onAnalyzeBrain(lead);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-[11px] font-bold shadow-md transition-all cursor-pointer font-mono"
                >
                  <span>⚡ Analisar no Cérebro Zélla</span>
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
