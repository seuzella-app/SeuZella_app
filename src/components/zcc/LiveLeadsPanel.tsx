'use client';

// ==============================================================================
// ZCC LIVE LEADS PANEL — Replicating Exact LeadMap UI/UX with ZCC Theme
// ==============================================================================
// Implements exact layout from reference screenshot:
// - Top-left Zélla Logo + / Live Leads
// - Sidebar with 3 tabs (Mapa | Lista | Stats), Search, Region/Status filters
// - Overlay floating bar over map with sidebar toggle, count & region pills
// - Cards list with ★ score and ⚡ intent signal
// - Full Cérebro Zélla Engine integration with ZDR 2.0 & Gemini 2.0 Flash
// ==============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import {
  Search, MapPin, Building2, Sparkles, Menu, ChevronLeft,
  Zap, Brain, Copy, Check, Phone, Mail, Instagram, X, Flame
} from 'lucide-react';
import { MOCK_LIVE_LEADS, getMockStats, type LiveLead } from '@/lib/live-leads-mock-data';

// Dynamically import LeafletMapCore with { ssr: false } to prevent SSR hydration errors
const LeafletMapCore = dynamic(() => import('./LeafletMapCore'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-[#0a0e1a] flex flex-col items-center justify-center text-slate-400 gap-3">
      <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-mono">Carregando Mapa de Leads Zélla...</span>
    </div>
  ),
});

function getStatusBadge(status: string) {
  const badges: Record<string, { label: string; className: string }> = {
    novo: { label: 'Novo', className: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
    contatado: { label: 'Contatado', className: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    respondido: { label: 'Respondido', className: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
    convertido: { label: 'Convertido', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    perdido: { label: 'Perdido', className: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  };
  return badges[status] || badges.novo;
}

function getScoreColor(score: number) {
  if (score >= 85) return 'text-emerald-400';
  if (score >= 70) return 'text-amber-400';
  if (score >= 50) return 'text-orange-400';
  return 'text-rose-400';
}

export function LiveLeadsPanel() {
  const [leads] = useState<LiveLead[]>(MOCK_LIVE_LEADS);
  const [selectedLead, setSelectedLead] = useState<LiveLead | null>(MOCK_LIVE_LEADS[0]);
  const [detailLead, setDetailLead] = useState<LiveLead | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'map' | 'list' | 'analytics'>('map');
  const [filters, setFilters] = useState({
    regiao: 'todas',
    status: 'todos',
    search: '',
  });

  // Cérebro Zélla State
  const [analyzingBrain, setAnalyzingBrain] = useState(false);
  const [brainAnalysis, setBrainAnalysis] = useState<{
    diagnostico: string;
    dorPrincipal: string;
    planoRecomendado: string;
    scriptWhatsapp: string;
    probabilidadeConversao: string;
  } | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);

  // Filter logic
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      const matchSearch =
        !filters.search ||
        l.pousada.toLowerCase().includes(filters.search.toLowerCase()) ||
        l.cidade.toLowerCase().includes(filters.search.toLowerCase()) ||
        l.uf.toLowerCase().includes(filters.search.toLowerCase());
      const matchRegiao = filters.regiao === 'todas' || l.regiao === filters.regiao;
      const matchStatus = filters.status === 'todos' || l.status === filters.status;
      return matchSearch && matchRegiao && matchStatus;
    });
  }, [leads, filters]);

  const stats = useMemo(() => getMockStats(filteredLeads), [filteredLeads]);

  // Execute Cérebro Zélla analysis via API
  const handleAnalyzeBrain = useCallback(async (lead: LiveLead) => {
    setAnalyzingBrain(true);
    setBrainAnalysis(null);

    try {
      const res = await fetch('/api/zcc/leads/brain-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead),
      });

      if (res.ok) {
        const json = await res.json();
        setBrainAnalysis(json.data);
      }
    } catch {
      /* Fallback deterministic response */
      setBrainAnalysis({
        diagnostico: `A ${lead.pousada} em ${lead.cidade}/${lead.uf} possui alto potencial de aumento de faturamento no PIX. Automação de WhatsApp para os seus ${lead.qtdQuartos || 12} quartos elimina taxas de comissão.`,
        dorPrincipal: 'Comissão alta de 18% para Booking/Airbnb e demora no atendimento noturno.',
        planoRecomendado: 'PRO (R$ 397/mês)',
        scriptWhatsapp: `Olá! Aqui é o Seu Zélla. Vi a ${lead.pousada} em ${lead.cidade} e sei exatamente como podemos zerar suas taxas de comissão e colocar seu WhatsApp atendendo e vendendo diárias no PIX 24h por dia. Podemos conversar 2 minutinhos?`,
        probabilidadeConversao: '94%',
      });
    } finally {
      setAnalyzingBrain(false);
    }
  }, []);

  // Run analysis whenever detail lead changes
  useEffect(() => {
    if (detailLead) {
      handleAnalyzeBrain(detailLead);
    }
  }, [detailLead, handleAnalyzeBrain]);

  const handleSelectLead = (lead: LiveLead) => {
    setSelectedLead(lead);
    setDetailLead(lead);
  };

  const copyScript = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  return (
    <div className="h-[calc(100vh-6rem)] w-full flex bg-[#050811] text-white overflow-hidden rounded-xl border border-slate-800/80 shadow-2xl relative font-sans">
      {/* ── 1. LEFT SIDEBAR (EXACT LAYOUT FROM SCREENSHOT) ───────────────────── */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 overflow-hidden flex-shrink-0 border-r border-slate-800/80 z-10`}>
        <div className="w-80 h-full flex flex-col bg-[#080d16]">
          {/* Header with Logo + ZÉLLA LIS */}
          {/* Header (ZÉLLA LIS) */}
          <div className="p-4 border-b border-slate-800/80">
            <div className="mb-3">
              <h1 className="text-sm font-mono font-bold text-[#10b981] tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                ZÉLLA
              </h1>
              <p className="text-[10px] font-mono text-slate-400">Lead Intelligence System</p>
            </div>

            {/* 3 Tabs (Mapa | Lista | Stats) */}
            <div className="flex gap-1 bg-slate-900/80 rounded-lg p-1 border border-slate-800 font-mono">
              {(['map', 'list', 'analytics'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 text-xs py-1.5 rounded-md transition-all font-bold font-mono ${
                    activeTab === tab
                      ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab === 'map' ? 'Mapa' : tab === 'list' ? 'Lista' : 'Stats'}
                </button>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="p-4 border-b border-slate-800/80 space-y-2 font-mono">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar pousada, cidade..."
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                className="w-full bg-slate-900/80 border border-slate-700/60 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#10b981]/60 font-mono"
              />
            </div>
            <select
              value={filters.regiao}
              onChange={(e) => setFilters((f) => ({ ...f, regiao: e.target.value }))}
              className="w-full bg-slate-900/80 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#10b981]/60 font-mono"
            >
              <option value="todas">Todas as Regiões</option>
              <option value="Sul">Sul</option>
              <option value="Sudeste">Sudeste</option>
              <option value="Nordeste">Nordeste</option>
              <option value="Norte">Norte</option>
              <option value="Centro-Oeste">Centro-Oeste</option>
            </select>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="w-full bg-slate-900/80 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#10b981]/60 font-mono"
            >
              <option value="todos">Todos os Status</option>
              <option value="novo">Novo</option>
              <option value="contatado">Contatado</option>
              <option value="respondido">Respondido</option>
              <option value="convertido">Convertido</option>
              <option value="perdido">Perdido</option>
            </select>
          </div>

          {/* Cards Content List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 font-mono">
            {activeTab === 'map' ? (
              <>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 font-mono">
                  LEADS NO MAPA ({filteredLeads.length})
                </h3>
                {filteredLeads.map((lead) => {
                  const badge = getStatusBadge(lead.status);
                  const isSelected = selectedLead?.id === lead.id;
                  return (
                    <button
                      key={lead.id}
                      onClick={() => handleSelectLead(lead)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all font-mono ${
                        isSelected
                          ? 'bg-[#0e1813] border-[#10b981]/60 shadow-lg'
                          : 'bg-slate-900/40 border-slate-800/60 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1 font-mono">
                        <span className={`text-xs font-bold truncate ${isSelected ? 'text-[#10b981]' : 'text-slate-100'}`}>{lead.pousada}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border whitespace-nowrap font-mono ${badge.className}`}>
                          {badge.label}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{lead.cidade}/{lead.uf}</div>
                      <div className="flex items-center gap-2 mt-1 font-mono">
                        <span className={`text-[10px] font-bold font-mono ${getScoreColor(lead.scoreQual)}`}>
                          ★ {lead.scoreQual}
                        </span>
                        {lead.sinaisIntencao && (
                          <span className="text-[10px] text-amber-400 truncate font-mono">⚡ {lead.sinaisIntencao}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </>
            ) : activeTab === 'list' ? (
              <div className="space-y-1.5">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  TODOS OS LEADS ({filteredLeads.length})
                </h3>
                {filteredLeads.map((lead) => (
                  <div
                    key={lead.id}
                    onClick={() => handleSelectLead(lead)}
                    className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/40 border border-slate-800/60 text-[10px] cursor-pointer hover:bg-slate-800/40 transition-colors"
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${lead.scoreQual >= 85 ? 'bg-emerald-500' : lead.scoreQual >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-200 font-bold truncate">{lead.pousada}</div>
                      <div className="text-slate-500">{lead.cidade}/{lead.uf}</div>
                    </div>
                    <span className="text-amber-400 font-bold">{lead.scoreQual}</span>
                  </div>
                ))}
              </div>
            ) : (
              /* Stats View */
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-900/60 rounded-xl p-2.5 border border-slate-800">
                    <div className="text-[9px] text-slate-500 uppercase tracking-wider">Total Leads</div>
                    <div className="text-lg font-bold text-white">{stats.totalLeads}</div>
                  </div>
                  <div className="bg-slate-900/60 rounded-xl p-2.5 border border-slate-800">
                    <div className="text-[9px] text-slate-500 uppercase tracking-wider">Score Médio</div>
                    <div className="text-lg font-bold text-amber-400">{stats.avgScoreQual}</div>
                  </div>
                </div>
                <div>
                  <h4 className="text-[9px] text-slate-500 uppercase tracking-wider mb-2">Por Região</h4>
                  <div className="space-y-1.5">
                    {stats.regioes.map((r) => (
                      <div key={r.regiao} className="flex items-center gap-2 text-[10px]">
                        <span className="text-slate-300 w-20 truncate">{r.regiao}</span>
                        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full" style={{ width: `${r.pct}%` }} />
                        </div>
                        <span className="text-slate-400 w-5 text-right font-mono">{r.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Stats */}
          {stats && (
            <div className="p-3 border-t border-slate-800/60 bg-slate-900/40 text-[10px] flex items-center justify-between text-slate-400">
              <span>Exibindo: <strong className="text-slate-200">{filteredLeads.length}</strong> de {stats.totalLeads}</span>
              <span>Score Méd: <strong className="text-amber-400">{stats.avgScoreQual}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* ── 2. MAIN MAP & FLOATING OVERLAY TOP BAR ───────────────────────────── */}
      <div className="flex-1 relative bg-[#0a0e1a] overflow-hidden">
        {/* Floating Top Bar Over Map */}
        <div className="absolute top-0 left-0 right-0 z-[1000] p-3 pointer-events-none">
          <div className="flex items-center justify-between flex-wrap gap-2 pointer-events-auto">
            {/* Left Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="bg-[#0d1117]/90 backdrop-blur-md border border-slate-700/60 rounded-lg p-2 text-slate-300 hover:bg-slate-800 transition-colors shadow-lg"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="bg-[#0d1117]/90 backdrop-blur-md border border-slate-700/60 rounded-lg px-3 py-1.5 shadow-lg">
                <span className="text-xs text-slate-300">
                  <span className="text-amber-400 font-bold">{filteredLeads.length}</span> leads mapeados
                </span>
              </div>
            </div>

            {/* Right Controls: Region Pills & Legend */}
            <div className="flex items-center gap-2 flex-wrap">
              {['Sul', 'Sudeste', 'Nordeste', 'Norte', 'Centro-Oeste'].map((regiao) => (
                <button
                  key={regiao}
                  onClick={() => setFilters((f) => ({ ...f, regiao: f.regiao === regiao ? 'todas' : regiao }))}
                  className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border backdrop-blur-md transition-all shadow-md ${
                    filters.regiao === regiao
                      ? 'bg-amber-600/90 border-amber-500 text-white'
                      : 'bg-[#0d1117]/90 border-slate-700/60 text-slate-300 hover:text-white'
                  }`}
                >
                  {regiao}
                </button>
              ))}

              {/* Legend Pill */}
              <div className="bg-[#0d1117]/90 backdrop-blur-md border border-slate-700/60 rounded-lg px-3 py-1.5 hidden lg:flex items-center gap-3 shadow-lg">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-slate-300">Conv.</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="text-[10px] text-slate-300">Hot</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-[10px] text-slate-300">Outros</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Leaflet Map Rendering */}
        <LeafletMapCore
          leads={filteredLeads}
          selectedLead={selectedLead}
          onSelectLead={handleSelectLead}
          onAnalyzeBrain={handleAnalyzeBrain}
        />

        {/* ── 3. DETAIL DRAWER & CÉREBRO ZÉLLA ANALYSIS PANEL ──────────────── */}
        {detailLead && (
          <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-[390px] z-[1000]">
            <div className="bg-[#0d1117]/95 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 shadow-2xl space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">{detailLead.pousada}</h3>
                  <p className="text-xs text-slate-400">{detailLead.cidade}/{detailLead.uf} {detailLead.localPraia ? `• ${detailLead.localPraia}` : ''}</p>
                </div>
                <button onClick={() => setDetailLead(null)} className="text-slate-400 hover:text-white transition-colors p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800">
                  <div className="text-[9px] text-slate-500">Score Qual.</div>
                  <div className={`text-base font-bold ${getScoreColor(detailLead.scoreQual)}`}>{detailLead.scoreQual}</div>
                </div>
                <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800">
                  <div className="text-[9px] text-slate-500">Score Valid.</div>
                  <div className={`text-base font-bold ${getScoreColor(detailLead.scoreValid)}`}>{detailLead.scoreValid}</div>
                </div>
                <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800">
                  <div className="text-[9px] text-slate-500">Status</div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full border inline-block mt-0.5 ${getStatusBadge(detailLead.status).className}`}>
                    {getStatusBadge(detailLead.status).label}
                  </span>
                </div>
              </div>

              {/* ── CÉREBRO ZÉLLA ANALYTICS ENGINE BOX ────────────────────────── */}
              <div className="bg-gradient-to-br from-amber-500/10 via-slate-900 to-orange-500/10 border border-amber-500/30 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                    <Brain className="w-3.5 h-3.5 text-amber-400 animate-pulse" /> Cérebro Zélla IA
                  </span>
                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30">
                    ZDR 2.0 Protegido
                  </span>
                </div>

                {analyzingBrain ? (
                  <div className="py-4 flex items-center justify-center gap-2 text-xs text-amber-300 font-mono">
                    <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    <span>Analisando lead com Gemini 2.0...</span>
                  </div>
                ) : brainAnalysis ? (
                  <div className="space-y-2 text-xs">
                    <p className="text-slate-300 text-[11px] leading-relaxed bg-slate-900/80 p-2 rounded border border-slate-800">
                      {brainAnalysis.diagnostico}
                    </p>

                    <div className="flex items-center justify-between text-[10px] bg-slate-900/80 p-1.5 rounded">
                      <span className="text-slate-400">Plano Recomendado:</span>
                      <span className="font-bold text-amber-300">{brainAnalysis.planoRecomendado}</span>
                    </div>

                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-amber-400 flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-400" /> Script WhatsApp:
                        </span>
                        <button
                          onClick={() => copyScript(brainAnalysis.scriptWhatsapp)}
                          className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
                        >
                          {copiedScript ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copiedScript ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-300 font-mono italic leading-relaxed">
                        "{brainAnalysis.scriptWhatsapp}"
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {detailLead.whatsapp && (
                  <a
                    href={`https://wa.me/${detailLead.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(brainAnalysis?.scriptWhatsapp || '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl py-2.5 transition-colors shadow-lg"
                  >
                    <Phone className="w-3.5 h-3.5 fill-white" /> WhatsApp
                  </a>
                )}
                {detailLead.email && (
                  <a
                    href={`mailto:${detailLead.email}`}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl py-2.5 transition-colors shadow-lg"
                  >
                    <Mail className="w-3.5 h-3.5" /> E-mail
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
