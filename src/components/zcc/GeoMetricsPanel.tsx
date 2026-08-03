'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Globe, MapPin, TrendingUp, Building2, Home, ArrowUpRight } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface GeoData {
  pousadaByState: { state: string; count: number }[];
  airbnbByState: { state: string; count: number }[];
  mrrByState: Record<string, { pousada: number; airbnb: number; total: number }>;
}

// ── Mock Data ──────────────────────────────────────────────────────────────────

const mockGeoData: GeoData = {
  pousadaByState: [
    { state: 'SC', count: 12 },
    { state: 'RJ', count: 8 },
    { state: 'BA', count: 6 },
    { state: 'SP', count: 5 },
    { state: 'RS', count: 4 },
  ],
  airbnbByState: [
    { state: 'RJ', count: 9 },
    { state: 'BA', count: 7 },
    { state: 'SC', count: 5 },
    { state: 'PE', count: 4 },
    { state: 'CE', count: 3 },
  ],
  mrrByState: {
    'SC': { pousada: 3200, airbnb: 1800, total: 5000 },
    'RJ': { pousada: 2400, airbnb: 2800, total: 5200 },
    'BA': { pousada: 1800, airbnb: 2200, total: 4000 },
    'SP': { pousada: 1500, airbnb: 800, total: 2300 },
    'RS': { pousada: 1200, airbnb: 400, total: 1600 },
    'PE': { pousada: 0, airbnb: 1200, total: 1200 },
    'CE': { pousada: 0, airbnb: 900, total: 900 },
  },
};

// ── City Breakdown Dictionary ──────────────────────────────────────────────────

interface CityDetail {
  cityName: string;
  pousadas: number;
  airbnb: number;
  mrr: number;
  properties: string[];
}

const CITY_BREAKDOWN: Record<string, CityDetail[]> = {
  'SC': [
    { cityName: 'Praia do Rosa / Imbituba', pousadas: 5, airbnb: 3, mrr: 2100, properties: ['Pousada Vida Sol', 'Rosa Surf Chalés', 'Refúgio das Dunas', 'Pousada Quintal do Rosa', 'Solar do Rosa'] },
    { cityName: 'Florianópolis', pousadas: 4, airbnb: 2, mrr: 1800, properties: ['Pousada Vila Floripa', 'Lagoa Sunset Loft', 'Canasvieiras Beach Haus', 'Morro das Pedras Eco Lodge'] },
    { cityName: 'Bombinhas & Itapema', pousadas: 3, airbnb: 0, mrr: 1100, properties: ['Pousada Mar de Fora', 'Itapema Sun Suites', 'Ponto das Vieiras'] },
  ],
  'RJ': [
    { cityName: 'Búzios & Cabo Frio', pousadas: 4, airbnb: 5, mrr: 2800, properties: ['Villa Geribá Búzios', 'Pousada João Fernandes', 'Ferradura Bay Suites', 'Lakeside Loft Cabo Frio'] },
    { cityName: 'Paraty & Trindade', pousadas: 4, airbnb: 4, mrr: 2400, properties: ['Pousada do Ouro', 'Trindade Eco Chalés', 'Paraty Historic House', 'Casa da Mata Paraty'] },
  ],
  'BA': [
    { cityName: 'Trancoso & Arraial d\'Ajuda', pousadas: 3, airbnb: 4, mrr: 2200, properties: ['Pousada Quadrado Trancoso', 'Arraial Sun Resort', 'Coqueiros Beach Villa'] },
    { cityName: 'Itacaré & Morro de SP', pousadas: 3, airbnb: 3, mrr: 1800, properties: ['Pousada Resende Itacaré', 'Morro Paradise Chalés', 'Tiririca Surf Lodge'] },
  ],
  'SP': [
    { cityName: 'Ubatuba & Maresias', pousadas: 3, airbnb: 3, mrr: 1400, properties: ['Pousada Itamambuca', 'Maresias Point Chalés', 'Vermelha Eco Suite'] },
    { cityName: 'Ilhabela & Campos do Jordão', pousadas: 2, airbnb: 2, mrr: 900, properties: ['Ilhabela Sailing Lodge', 'Campos Mountain Chalet'] },
  ],
  'RS': [
    { cityName: 'Gramado & Canela', pousadas: 3, airbnb: 2, mrr: 1200, properties: ['Pousada Valle D\'Italia', 'Canela Alpine Suite', 'Serra Gaúcha Lodge'] },
  ],
  'PE': [
    { cityName: 'Fernando de Noronha & Porto', pousadas: 2, airbnb: 4, mrr: 1200, properties: ['Pousada Maravilha Noronha', 'Porto Sun Reef', 'Carneiros Beach Villa'] },
  ],
  'CE': [
    { cityName: 'Jericoacoara & Canoa Quebrada', pousadas: 2, airbnb: 3, mrr: 900, properties: ['Jeri Dune Pousada', 'Canoa Sunset Suites', 'Preá Wind Lodge'] },
  ]
};

export function GeoMetricsPanel() {
  const [data, setData] = useState<GeoData>(mockGeoData);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'api' | 'demo'>('demo');
  const [expandedState, setExpandedState] = useState<string | null>('SC');

  useEffect(() => {
    async function fetchGeo() {
      try {
        const res = await fetch('/api/zcc/metrics/geographic');
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            setData(json.data);
            setSource(json.meta?.source === 'demo' ? 'demo' : 'api');
          }
        }
      } catch {
        /* keep mock */
      } finally {
        setLoading(false);
      }
    }
    fetchGeo();
    const interval = setInterval(fetchGeo, 60000);
    return () => clearInterval(interval);
  }, []);

  // Build unified state list sorted by total MRR
  const allStates = new Set<string>();
  data.pousadaByState.forEach(s => allStates.add(s.state));
  data.airbnbByState.forEach(s => allStates.add(s.state));

  const pousadaMap = Object.fromEntries(data.pousadaByState.map(s => [s.state, s.count]));
  const airbnbMap = Object.fromEntries(data.airbnbByState.map(s => [s.state, s.count]));

  const tableRows = Array.from(allStates)
    .map(state => ({
      state,
      pousadas: pousadaMap[state] || 0,
      airbnb: airbnbMap[state] || 0,
      mrrPousada: data.mrrByState[state]?.pousada ?? 0,
      mrrAirbnb: data.mrrByState[state]?.airbnb ?? 0,
      mrrTotal: data.mrrByState[state]?.total ?? 0,
    }))
    .sort((a, b) => b.mrrTotal - a.mrrTotal)
    .slice(0, 10);

  const totalMRR = tableRows.reduce((s, r) => s + r.mrrTotal, 0);
  const totalPousadas = tableRows.reduce((s, r) => s + r.pousadas, 0);
  const totalAirbnb = tableRows.reduce((s, r) => s + r.airbnb, 0);

  return (
    <div className="space-y-5">
      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center gap-2 px-3 py-2 rounded" style={{ background: 'rgba(212,168,67,0.06)', border: '1px solid rgba(212,168,67,0.12)' }}>
          <div className="w-3 h-3 border-2 border-amber-400/40 border-t-amber-400 rounded-full animate-spin" />
          <span className="text-[10px] font-mono" style={{ color: 'var(--zcc-kinpaku)' }}>Carregando métricas geográficas...</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5" style={{ color: 'var(--zcc-kinpaku)' }} />
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--zcc-champagne)' }}>Métricas Geográficas</h2>
            <p className="text-[10px] font-mono" style={{ color: 'var(--zcc-text-muted)' }}>
              Distribuição regional de propriedades · MRR por estado · Pousada vs Airbnb
            </p>
          </div>
        </div>
        {source === 'demo' && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded" style={{ background: 'rgba(212,168,67,0.06)', border: '1px solid rgba(212,168,67,0.12)' }}>
            <span className="text-[9px] font-mono" style={{ color: 'var(--zcc-kinpaku)' }}>DEMO DATA</span>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'ESTADOS COBERTOS', value: allStates.size, color: 'var(--zcc-champagne)', icon: Globe },
          { label: 'POUSADAS TOTAL', value: totalPousadas, color: 'var(--zcc-kinpaku)', icon: Building2 },
          { label: 'AIRBNB TOTAL', value: totalAirbnb, color: 'var(--zcc-patina)', icon: Home },
          { label: 'MRR TOTAL', value: `R$ ${totalMRR.toLocaleString('pt-BR')}`, color: 'var(--zcc-kinpaku)', icon: TrendingUp },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }} className="zcc-panel p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
                <div className="zcc-eyebrow">{stat.label}</div>
              </div>
              <div className="text-lg font-bold font-mono" style={{ color: stat.color }}>{stat.value}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Regional Breakdown Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="zcc-panel p-5">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-4 h-4" style={{ color: 'var(--zcc-patina)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--zcc-champagne)' }}>Top 10 Estados por MRR</h3>
        </div>
        <div className="overflow-x-auto zcc-scroll">
          <table className="zcc-table w-full text-sm">
            <thead>
              <tr>
                <th className="text-left px-3 py-2">Estado</th>
                <th className="text-right px-3 py-2">Pousadas</th>
                <th className="text-right px-3 py-2">Airbnb</th>
                <th className="text-right px-3 py-2">MRR Pousada</th>
                <th className="text-right px-3 py-2">MRR Airbnb</th>
                <th className="text-right px-3 py-2">MRR Total</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, i) => {
                const maxMRR = tableRows[0]?.mrrTotal || 1;
                const barWidth = (row.mrrTotal / maxMRR) * 100;
                const isExpanded = expandedState === row.state;
                const cities = CITY_BREAKDOWN[row.state] || [];

                return (
                  <React.Fragment key={row.state}>
                    <motion.tr
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => setExpandedState(isExpanded ? null : row.state)}
                      className="cursor-pointer hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="font-mono font-bold text-xs" style={{ color: 'var(--zcc-champagne)' }}>{row.state}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">({isExpanded ? '▲ recolher' : '▼ expandir cidades'})</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono" style={{ color: 'var(--zcc-kinpaku)' }}>{row.pousadas}</td>
                      <td className="px-3 py-2.5 text-right font-mono" style={{ color: 'var(--zcc-patina)' }}>{row.airbnb}</td>
                      <td className="px-3 py-2.5 text-right font-mono" style={{ color: 'var(--zcc-kinpaku)' }}>
                        R$ {row.mrrPousada.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono" style={{ color: 'var(--zcc-patina)' }}>
                        R$ {row.mrrAirbnb.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 zcc-progress-track" style={{ height: 4 }}>
                            <div className="zcc-progress-fill" style={{ width: `${barWidth}%`, background: 'var(--zcc-kinpaku)' }} />
                          </div>
                          <span className="font-mono font-bold text-xs" style={{ color: 'var(--zcc-champagne)' }}>
                            R$ {row.mrrTotal.toLocaleString('pt-BR')}
                          </span>
                        </div>
                      </td>
                    </motion.tr>

                    {/* Expanded City Details */}
                    {isExpanded && (
                      <tr className="bg-black/60 border-l-2 border-emerald-500">
                        <td colSpan={6} className="p-4">
                          <div className="space-y-3">
                            <div className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                              <Building2 className="w-4 h-4" />
                              <span>Detalhamento por Cidades em {row.state}</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {cities.map((city, idx) => (
                                <div key={idx} className="p-3 bg-zinc-900/80 border border-white/10 rounded space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <strong className="text-xs text-white">{city.cityName}</strong>
                                    <span className="text-xs font-mono text-emerald-400">MRR: R$ {city.mrr.toLocaleString('pt-BR')}</span>
                                  </div>
                                  <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-400">
                                    <span>🏨 {city.pousadas} Pousada(s)</span>
                                    <span>🏡 {city.airbnb} Anfitrião(ões) Airbnb</span>
                                  </div>
                                  <div className="text-[10px] text-zinc-400 font-mono pt-1">
                                    <span className="text-zinc-500">Estabelecimentos:</span> {city.properties.join(', ')}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {/* Total row */}
              <tr style={{ borderTop: '1px solid var(--zcc-border, rgba(255,255,255,0.08))' }}>
                <td className="px-3 py-2.5 font-semibold" style={{ color: 'var(--zcc-champagne)' }}>TOTAL</td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold" style={{ color: 'var(--zcc-kinpaku)' }}>{totalPousadas}</td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold" style={{ color: 'var(--zcc-patina)' }}>{totalAirbnb}</td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold" style={{ color: 'var(--zcc-kinpaku)' }}>
                  R$ {tableRows.reduce((s, r) => s + r.mrrPousada, 0).toLocaleString('pt-BR')}
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold" style={{ color: 'var(--zcc-patina)' }}>
                  R$ {tableRows.reduce((s, r) => s + r.mrrAirbnb, 0).toLocaleString('pt-BR')}
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-bold" style={{ color: 'var(--zcc-champagne)' }}>
                  R$ {totalMRR.toLocaleString('pt-BR')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Pousada vs Airbnb Split by Region */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        className="zcc-panel p-5">
        <div className="flex items-center gap-2 mb-4">
          <ArrowUpRight className="w-4 h-4" style={{ color: 'var(--zcc-kinpaku)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--zcc-champagne)' }}>Pousada vs Airbnb por Estado</h3>
        </div>
        <div className="space-y-3">
          {tableRows.slice(0, 7).map(row => {
            const total = row.pousadas + row.airbnb;
            const pousadaPct = total > 0 ? (row.pousadas / total) * 100 : 0;
            const airbnbPct = total > 0 ? (row.airbnb / total) * 100 : 0;
            return (
              <div key={row.state} className="flex items-center gap-3">
                <span className="font-mono font-bold text-xs w-8" style={{ color: 'var(--zcc-champagne)' }}>{row.state}</span>
                <div className="flex-1 flex items-center gap-1">
                  <div className="zcc-progress-track flex-1" style={{ height: 8 }}>
                    <div className="zcc-progress-fill rounded-l" style={{ width: `${pousadaPct}%`, background: 'var(--zcc-kinpaku)', float: 'left' }} />
                    <div className="zcc-progress-fill rounded-r" style={{ width: `${airbnbPct}%`, background: 'var(--zcc-patina)', float: 'left' }} />
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[9px] font-mono min-w-[140px] justify-end">
                  <span style={{ color: 'var(--zcc-kinpaku)' }}>{row.pousadas} pousadas</span>
                  <span style={{ color: 'var(--zcc-text-muted)' }}>·</span>
                  <span style={{ color: 'var(--zcc-patina)' }}>{row.airbnb} airbnb</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-4 pt-3" style={{ borderTop: '1px solid var(--zcc-hairline)' }}>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--zcc-kinpaku)' }} />
            <span className="text-[9px] font-mono" style={{ color: 'var(--zcc-text-secondary)' }}>Pousadas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--zcc-patina)' }} />
            <span className="text-[9px] font-mono" style={{ color: 'var(--zcc-text-secondary)' }}>Airbnb</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
