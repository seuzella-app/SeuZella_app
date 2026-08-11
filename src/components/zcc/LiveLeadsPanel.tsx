'use client';

// ==============================================================================
// ZCC LIVE LEADS PANEL — Inteligência Comercial de Leads em Tempo Real
// ==============================================================================
// Integrado com Cérebro Zélla + Google AI + Marcadores com Logo Oficial Zélla
// ==============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Search, Filter, Sparkles, Phone, Mail, Instagram,
  ChevronRight, Brain, Zap, CheckCircle2, ShieldCheck,
  TrendingUp, BarChart3, Building2, Flame, Award, ArrowUpRight,
  RefreshCw, Copy, Check
} from 'lucide-react';
import { MOCK_LIVE_LEADS, getMockStats, type LiveLead } from '@/lib/live-leads-mock-data';

import dynamic from 'next/dynamic';

const LeafletMap = dynamic(() => import('./LeafletMapCore'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-[#0a0f1e] flex flex-col items-center justify-center text-slate-400 gap-3">
      <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-mono">Carregando Mapa do Brasil com Logo Zélla...</span>
    </div>
  ),
});

export function LiveLeadsPanel() {
  const [leads] = useState<LiveLead[]>(MOCK_LIVE_LEADS);
  const [selectedLead, setSelectedLead] = useState<LiveLead | null>(MOCK_LIVE_LEADS[0]);
  const [activeTab, setActiveTab] = useState<'map' | 'list' | 'analytics'>('map');
  const [search, setSearch] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('todas');
  const [selectedStatus, setSelectedStatus] = useState<string>('todos');
  const [copiedScript, setCopiedScript] = useState(false);

  // Cérebro Zélla Analysis State
  const [analyzingBrain, setAnalyzingBrain] = useState(false);
  const [brainAnalysis, setBrainAnalysis] = useState<{
    diagnostico: string;
    dorPrincipal: string;
    planoRecomendado: string;
    scriptWhatsapp: string;
    probabilidadeConversao: string;
  } | null>(null);

  // Filter leads
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      const matchSearch =
        search === '' ||
        l.pousada.toLowerCase().includes(search.toLowerCase()) ||
        l.cidade.toLowerCase().includes(search.toLowerCase()) ||
        l.uf.toLowerCase().includes(search.toLowerCase());
      const matchRegion = selectedRegion === 'todas' || l.regiao === selectedRegion;
      const matchStatus = selectedStatus === 'todos' || l.status === selectedStatus;
      return matchSearch && matchRegion && matchStatus;
    });
  }, [leads, search, selectedRegion, selectedStatus]);

  const stats = useMemo(() => getMockStats(filteredLeads), [filteredLeads]);

  // Run Cérebro Zélla Analysis on selected lead
  const handleAnalyzeWithBrain = useCallback(async (lead: LiveLead) => {
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
      /* fallback static calculation */
      setBrainAnalysis({
        diagnostico: `A ${lead.pousada} tem alto potencial de aumento de margem no PIX. Automação de WhatsApp para os seus ${lead.qtdQuartos || 12} quartos elimina taxas de comissão.`,
        dorPrincipal: 'Comissão elevada para OTAs e demora em responder cotações à noite.',
        planoRecomendado: 'PRO (R$ 397/mês)',
        scriptWhatsapp: `Olá! Aqui é o Seu Zélla. Vi a ${lead.pousada} em ${lead.cidade} e sei exatamente como podemos zerar suas taxas de comissão no WhatsApp. Vamos conversar?`,
        probabilidadeConversao: '92%',
      });
    } finally {
      setAnalyzingBrain(false);
    }
  }, []);

  // Auto-analyze selected lead on change
  useEffect(() => {
    if (selectedLead) {
      handleAnalyzeWithBrain(selectedLead);
    }
  }, [selectedLead, handleAnalyzeWithBrain]);

  const copyScriptToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  return (
    <div className="h-[calc(100vh-6rem)] w-full flex flex-col bg-[#0a0f1e] text-white rounded-xl overflow-hidden border border-slate-800/80 shadow-2xl">
      {/* ── TOP CONTROLS & METRICS STRIP ──────────────────────────────────────── */}
      <div className="p-3 bg-[#0d1420]/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 p-0.5 shadow-lg shadow-teal-500/20">
            <div className="w-full h-full bg-[#0d1420] rounded-[7px] flex items-center justify-center">
              <img src="/assets/brand/Arte_SeuZellaCom_Logo.png" alt="Zélla" className="w-6 h-6 object-contain" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-white">Live Leads Mapeados</h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                CÉREBRO VIVO
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Inteligência de Vendas de Pousadas & Imóveis em Tempo Real</p>
          </div>
        </div>

        {/* Region Fast Selectors */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {['todas', 'Sul', 'Sudeste', 'Nordeste', 'Norte', 'Centro-Oeste'].map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRegion(r)}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                selectedRegion === r
                  ? 'bg-teal-500/20 border-teal-500 text-teal-300 font-bold'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {r === 'todas' ? 'Brasil' : r}
            </button>
          ))}
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab('map')}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium transition-all ${
              activeTab === 'map' ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            Mapa Brasil
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium transition-all ${
              activeTab === 'list' ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Lista ({filteredLeads.length})
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium transition-all ${
              activeTab === 'analytics' ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Google AI
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT WORKSPACE ────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* ── LEFT SIDEBAR (SEARCH + LIST OF LEADS) ───────────────────────────── */}
        <div className="w-80 bg-[#0d1420] border-r border-slate-800 flex flex-col shrink-0 hidden md:flex">
          <div className="p-3 border-b border-slate-800/80 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar pousada, cidade..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-700/60 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
            >
              <option value="todos">Todos os Status ({leads.length})</option>
              <option value="novo">Novos Leads</option>
              <option value="contatado">Contatados</option>
              <option value="respondido">Em Negociação</option>
              <option value="convertido">Clientes Zélla ✓</option>
            </select>
          </div>

          {/* Lead Cards List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
            {filteredLeads.map((lead) => {
              const isSelected = selectedLead?.id === lead.id;
              return (
                <button
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all group ${
                    isSelected
                      ? 'bg-gradient-to-r from-teal-500/15 to-emerald-500/10 border-teal-500/50 shadow-lg'
                      : 'bg-slate-900/40 border-slate-800/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <span className={`text-xs font-bold truncate ${isSelected ? 'text-teal-300' : 'text-slate-200'}`}>
                      {lead.pousada}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full border whitespace-nowrap font-mono ${
                        lead.status === 'convertido'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : lead.scoreQual >= 90
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {lead.status === 'convertido' ? 'Cliente ✓' : `Score ${lead.scoreQual}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>{lead.cidade}/{lead.uf}</span>
                    <span className="text-slate-500">{lead.qtdQuartos || '?'} qtos</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── CENTER AREA: MAP / LIST / ANALYTICS ──────────────────────────────── */}
        <div className="flex-1 relative bg-[#0a0f1e] overflow-hidden">
          {activeTab === 'map' && (
            <LeafletMap
              leads={filteredLeads}
              selectedLead={selectedLead}
              onSelectLead={(l) => setSelectedLead(l)}
            />
          )}

          {activeTab === 'list' && (
            <div className="h-full overflow-y-auto p-4 md:p-6 custom-scrollbar">
              <h2 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-teal-400" />
                Mapeamento Geral de Pousadas ({filteredLeads.length})
              </h2>
              <div className="bg-[#0d1420] rounded-xl border border-slate-800 overflow-hidden shadow-xl">
                <table className="w-full text-xs text-left min-w-[650px]">
                  <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 font-mono text-[10px]">
                    <tr>
                      <th className="p-3">PROPRIEDADE</th>
                      <th className="p-3">CIDADE/UF</th>
                      <th className="p-3">QUARTOS</th>
                      <th className="p-3">SCORE QUAL.</th>
                      <th className="p-3">STATUS</th>
                      <th className="p-3 text-right">AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredLeads.map((l) => (
                      <tr
                        key={l.id}
                        onClick={() => setSelectedLead(l)}
                        className={`hover:bg-teal-500/10 cursor-pointer transition-colors ${
                          selectedLead?.id === l.id ? 'bg-teal-500/15 font-medium' : ''
                        }`}
                      >
                        <td className="p-3 font-bold text-slate-200">{l.pousada}</td>
                        <td className="p-3 text-slate-400">{l.cidade}/{l.uf}</td>
                        <td className="p-3 text-slate-400">{l.qtdQuartos || '-'}</td>
                        <td className="p-3">
                          <span className="font-bold text-teal-400">{l.scoreQual}</span>/100
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 text-[10px] rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                            {l.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLead(l);
                              setActiveTab('map');
                            }}
                            className="text-[10px] px-2 py-1 rounded bg-teal-600/30 text-teal-300 border border-teal-500/40 hover:bg-teal-600 hover:text-white transition-all"
                          >
                            Ver no Cérebro →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="h-full overflow-y-auto p-4 md:p-6 custom-scrollbar space-y-4 max-w-4xl mx-auto">
              {/* Google AI Card */}
              <div className="bg-gradient-to-r from-amber-500/10 via-teal-500/10 to-emerald-500/10 border border-amber-500/30 rounded-2xl p-5 shadow-xl relative overflow-hidden">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 border border-amber-500/30">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      Diagnóstico Cognitivo Google AI + Gemini 2.0 Flash
                    </h3>
                    <p className="text-xs text-slate-400">Análise de Potencial de Receita em Pousadas do Brasil</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-mono block mb-1">Potencial em Vendas Diretas</span>
                    <span className="text-lg font-bold text-emerald-400">R$ 142.800/mês</span>
                    <p className="text-[10px] text-slate-400 mt-1">Economia estimada em comissões de OTAs.</p>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-mono block mb-1">Região com Maior Intenção</span>
                    <span className="text-lg font-bold text-teal-300">Sudeste & Sul (68%)</span>
                    <p className="text-[10px] text-slate-400 mt-1">Demanda alta por recepção 24h via WhatsApp.</p>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-mono block mb-1">Conversão Média Esperada</span>
                    <span className="text-lg font-bold text-amber-300">92.4%</span>
                    <p className="text-[10px] text-slate-400 mt-1">Com script do Cérebro Zélla ativado.</p>
                  </div>
                </div>
              </div>

              {/* Region & Funnel breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#0d1420] p-4 rounded-xl border border-slate-800">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 font-mono">
                    Distribuição por Região Brasil
                  </h4>
                  <div className="space-y-2.5">
                    {stats.regioes.map((r) => (
                      <div key={r.regiao}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-300">{r.regiao}</span>
                          <span className="text-teal-400 font-mono">{r.count} pousadas ({r.pct}%)</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full"
                            style={{ width: `${r.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#0d1420] p-4 rounded-xl border border-slate-800">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 font-mono">
                    Funil de Conversão Comercial
                  </h4>
                  <div className="space-y-2.5">
                    {stats.statusList.map((s) => (
                      <div key={s.status} className="flex items-center justify-between text-xs bg-slate-900/60 p-2 rounded-lg">
                        <span className="text-slate-300 font-medium">{s.label}</span>
                        <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-mono font-bold">
                          {s.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT DRAWER: SELECTED LEAD & CÉREBRO ZÉLLA BRAIN ANALYSIS ──────── */}
        {selectedLead && (
          <div className="w-full md:w-96 bg-[#0d1420] border-l border-slate-800 flex flex-col overflow-y-auto custom-scrollbar shadow-2xl shrink-0">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-900/50">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  {selectedLead.tipoPropriedade}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Score: <strong className="text-teal-400 text-xs">{selectedLead.scoreQual}</strong>/100
                </span>
              </div>
              <h2 className="text-sm font-bold text-white leading-snug">{selectedLead.pousada}</h2>
              <p className="text-xs text-slate-400">{selectedLead.cidade}/{selectedLead.uf} • {selectedLead.localPraia || 'Região Turística'}</p>
            </div>

            {/* Quick Specs */}
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Quartos</span>
                  <span className="font-bold text-slate-200">{selectedLead.qtdQuartos || 'N/A'}</span>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Diária Média</span>
                  <span className="font-bold text-emerald-400">{selectedLead.valoresEstimados || 'N/A'}</span>
                </div>
              </div>

              {selectedLead.sinaisIntencao && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs">
                  <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5" /> Sinais de Intenção Detectados
                  </div>
                  <p className="text-amber-200/90 text-[11px] leading-relaxed">{selectedLead.sinaisIntencao}</p>
                </div>
              )}

              {/* ── CÉREBRO ZÉLLA ENGINE BOX ───────────────────────────────────── */}
              <div className="bg-gradient-to-br from-teal-950/60 to-emerald-950/40 border border-teal-500/40 rounded-2xl p-4 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-teal-400 animate-pulse" />
                    <span className="text-xs font-bold text-teal-300">Cérebro Zélla Engine</span>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30">
                    ZDR 2.0 Protegido
                  </span>
                </div>

                {analyzingBrain ? (
                  <div className="py-6 flex flex-col items-center justify-center text-center gap-2">
                    <div className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-teal-300 font-mono">Processando análise com Gemini 2.0 Flash...</span>
                  </div>
                ) : brainAnalysis ? (
                  <div className="space-y-2.5 text-xs">
                    <div className="bg-slate-900/80 p-2.5 rounded-lg border border-teal-500/30">
                      <span className="text-[10px] font-bold text-teal-400 uppercase block mb-1">Diagnóstico Cognitivo:</span>
                      <p className="text-slate-300 text-[11px] leading-relaxed">{brainAnalysis.diagnostico}</p>
                    </div>

                    <div className="flex justify-between items-center bg-slate-900/80 p-2 rounded-lg text-[11px]">
                      <span className="text-slate-400">Plano Recomendado:</span>
                      <span className="font-bold text-amber-300">{brainAnalysis.planoRecomendado}</span>
                    </div>

                    {/* WhatsApp Action Script */}
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="font-bold text-teal-300 flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-400" /> Script WhatsApp IA:
                        </span>
                        <button
                          onClick={() => copyScriptToClipboard(brainAnalysis.scriptWhatsapp)}
                          className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
                        >
                          {copiedScript ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copiedScript ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-300 font-mono bg-slate-900/80 p-2 rounded border border-slate-800 leading-relaxed italic">
                        "{brainAnalysis.scriptWhatsapp}"
                      </p>
                    </div>

                    {/* Send on WhatsApp Button */}
                    <a
                      href={`https://wa.me/${selectedLead.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(brainAnalysis.scriptWhatsapp)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs py-2.5 rounded-xl shadow-lg transition-all transform hover:scale-[1.02]"
                    >
                      <Phone className="w-4 h-4 fill-white" />
                      Enviar no WhatsApp (1-Clique PIX)
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
