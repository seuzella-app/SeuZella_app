'use client';

// ==============================================================================
// LEAFLET MAP CORE — Client-only Isolated Component
// ==============================================================================
// Dynamically imported with { ssr: false } to prevent SSR hydration crashes
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
}

// Helper to smooth fly map position
function MapController({ target }: { target: LiveLead | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo([target.latitude, target.longitude], 11, { duration: 1.2 });
    }
  }, [target, map]);
  return null;
}

// Custom Leaflet Pin Icon with Zélla Logo
function createZellaIcon(status: string, score: number, isSelected: boolean) {
  const isConv = status === 'convertido';
  const isHot = score >= 90;

  const borderColor = isSelected ? '#10b981' : isConv ? '#10b981' : isHot ? '#f59e0b' : '#3b82f6';
  const badgeColor = isConv ? '#10b981' : isHot ? '#ef4444' : '#f59e0b';
  const glowClass = isSelected
    ? 'drop-shadow-[0_0_12px_rgba(16,185,129,0.8)]'
    : isHot
    ? 'drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]'
    : '';

  const html = `
    <div class="relative group cursor-pointer ${glowClass}">
      <div class="w-10 h-10 rounded-full bg-[#0d1420] border-2 p-1 shadow-xl flex items-center justify-center transition-transform hover:scale-110" style="border-color: ${borderColor}">
        <img src="/assets/brand/Arte_SeuZellaCom_Logo.png" alt="Zélla" class="w-full h-full object-contain" />
      </div>
      <div class="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow" style="background-color: ${badgeColor}">
        ${isConv ? '✓' : isHot ? '🔥' : '★'}
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'zella-leaflet-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });
}

export default function LeafletMapCore({ leads, selectedLead, onSelectLead }: LeafletMapCoreProps) {
  return (
    <MapContainer
      center={[-14.235, -51.9253]}
      zoom={5}
      className="h-full w-full z-0"
      zoomControl={false}
      style={{ background: '#0a0f1e' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <MapController target={selectedLead} />
      {leads.map((lead) => (
        <Marker
          key={lead.id}
          position={[lead.latitude, lead.longitude]}
          icon={createZellaIcon(lead.status, lead.scoreQual, selectedLead?.id === lead.id)}
          eventHandlers={{
            click: () => onSelectLead(lead),
          }}
        >
          <Popup className="zella-custom-popup">
            <div className="p-2 min-w-[220px] font-sans bg-[#0d1420] text-white rounded-lg">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-bold text-xs text-white truncate">{lead.pousada}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 font-mono">
                  Score {lead.scoreQual}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mb-2">{lead.cidade}/{lead.uf} • {lead.qtdQuartos || '?'} quartos</p>
              <button
                onClick={() => onSelectLead(lead)}
                className="w-full text-center py-1 rounded bg-teal-600 hover:bg-teal-500 text-white text-[10px] font-medium transition-colors"
              >
                Ver no Cérebro Zélla →
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
