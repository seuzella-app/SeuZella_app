'use client';

// ============================================================================
// ZÉLLA — RefactorSuggestionsPanel (UI para revisar sugestões)
// ============================================================================
// Painel visual para admin Zélla revisar sugestões de refatoração geradas
// pelo Cérebro (GLM 5.2 + RAG).
//
// Funcionalidades:
//  - Lista sugestões com filtros (pending / approved / rejected / applied)
//  - Visual diff: código atual vs código proposto (estilo GitHub PR)
//  - Botões Approve / Reject / Apply
//  - Stats do índice TF-IDF (total chunks, files indexed)
//  - Botão "Re-indexar código" para forçar atualização
//  - Botão "Forçar análise manual" para testar
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Code, GitBranch, Check, X, Zap, RefreshCw, FileCode,
  AlertCircle, TrendingUp, Database,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

interface RefactorSuggestion {
  id: string;
  sourceErrorHash: string;
  filePath: string;
  lineRange: string;
  currentCode: string;
  proposedCode: string;
  rationale: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'applied';
  confidence: number;
  mode: 'mock' | 'live';
  reviewNotes: string | null;
  reviewedBy: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

interface RefactorStats {
  mode: 'mock' | 'live';
  config: { model: string; recurringErrorThreshold: number };
  indexStats: {
    tfidf: { totalDocs: number; totalTerms: number; avgDocLength: number };
    dbChunks: number;
    isLoaded: boolean;
  };
  totalSuggestions: number;
  pendingReview: number;
  approved: number;
  rejected: number;
  applied: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function statusColor(status: string): string {
  switch (status) {
    case 'approved': return '#10b981';
    case 'rejected': return '#ef4444';
    case 'applied': return '#3b82f6';
    case 'pending_review':
    default: return '#f59e0b';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'pending_review': return 'PENDENTE';
    case 'approved': return 'APROVADA';
    case 'rejected': return 'REJEITADA';
    case 'applied': return 'APLICADA';
    default: return status.toUpperCase();
  }
}

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s atrás`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

function confidenceColor(c: number): string {
  if (c >= 0.8) return '#10b981';
  if (c >= 0.6) return '#3b82f6';
  if (c >= 0.4) return '#f59e0b';
  return '#ef4444';
}

function confidenceLabel(c: number): string {
  if (c >= 0.8) return 'ALTA';
  if (c >= 0.6) return 'MÉDIA';
  if (c >= 0.4) return 'BAIXA';
  return 'MUITO BAIXA';
}

// ── Diff visual simples ─────────────────────────────────────────────────────

function DiffViewer({ current, proposed }: { current: string; proposed: string }) {
  const currentLines = current.split('\n');
  const proposedLines = proposed.split('\n');
  const maxLines = Math.max(currentLines.length, proposedLines.length, 10);

  return (
    <div className="grid grid-cols-2 gap-2 mt-2">
      {/* Current code */}
      <div>
        <div className="text-[9px] font-mono uppercase tracking-wider mb-1 flex items-center gap-1" style={{ color: '#ef4444' }}>
          <span>−</span> CÓDIGO ATUAL
        </div>
        <pre
          className="text-[10px] font-mono p-2 rounded overflow-x-auto max-h-48 overflow-y-auto"
          style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          {currentLines.slice(0, maxLines).map((line, i) => (
            <div key={i} className="flex">
              <span className="text-zinc-600 select-none mr-2">{i + 1}</span>
              <span className="text-red-300/70">{line}</span>
            </div>
          ))}
        </pre>
      </div>

      {/* Proposed code */}
      <div>
        <div className="text-[9px] font-mono uppercase tracking-wider mb-1 flex items-center gap-1" style={{ color: '#10b981' }}>
          <span>+</span> CÓDIGO PROPOSTO
        </div>
        <pre
          className="text-[10px] font-mono p-2 rounded overflow-x-auto max-h-48 overflow-y-auto"
          style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)' }}
        >
          {proposedLines.slice(0, maxLines).map((line, i) => (
            <div key={i} className="flex">
              <span className="text-zinc-600 select-none mr-2">{i + 1}</span>
              <span className="text-emerald-300/70">{line}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

// ── Component ───────────────────────────────────────────────────────────────

export function RefactorSuggestionsPanel() {
  const [suggestions, setSuggestions] = useState<RefactorSuggestion[]>([]);
  const [stats, setStats] = useState<RefactorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending_review' | 'approved' | 'rejected' | 'applied' | 'all'>('pending_review');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [listRes, statsRes] = await Promise.all([
        fetch(`/api/zcc/cerebro/refactors?status=${filter === 'all' ? '' : filter}&limit=20`),
        fetch('/api/zcc/cerebro/refactors?stats=true'),
      ]);

      if (listRes.ok) {
        const data = await listRes.json();
        if (data.success) setSuggestions(data.data || []);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.success) setStats(statsData.data);
      }
    } catch (err) {
      console.error('[RefactorSuggestionsPanel] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── Actions ──

  const handleAction = async (suggestionId: string, action: 'approve' | 'reject' | 'apply'): Promise<void> => {
    setActionLoading(suggestionId);
    try {
      const notes = action === 'reject'
        ? window.prompt('Notas (opcional):') || ''
        : '';

      await fetch(`/api/zcc/cerebro/refactors?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId, notes }),
      });

      // Optimistic: remove da lista (ou refetch)
      await fetchData();
    } finally {
      setActionLoading(null);
    }
  };

  const reindex = async (): Promise<void> => {
    setActionLoading('reindex');
    try {
      await fetch('/api/zcc/cerebro/refactors?reindex=true', { method: 'GET' });
      await fetchData();
    } finally {
      setActionLoading(null);
    }
  };

  const trigger = async (): Promise<void> => {
    setActionLoading('trigger');
    try {
      await fetch('/api/zcc/cerebro/refactors?action=trigger', { method: 'POST' });
      await fetchData();
    } finally {
      setActionLoading(null);
    }
  };

  // ── Render ──

  return (
    <div className="space-y-5">
      {/* ===== TOP STATS ===== */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="zcc-panel p-5"
        style={{ borderColor: 'var(--zcc-kinpaku)', borderWidth: 1 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5" style={{ color: 'var(--zcc-kinpaku)' }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--zcc-champagne)' }}>
              RefactorSuggester — Auto-Aprendizado
            </h3>
            {stats && (
              <span
                className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider"
                style={{
                  background: stats.mode === 'live' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                  color: stats.mode === 'live' ? '#10b981' : '#f59e0b',
                  border: `1px solid ${stats.mode === 'live' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                }}
              >
                {stats.mode === 'live' ? '● LIVE' : '● MOCK'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={reindex}
              disabled={actionLoading === 'reindex'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono font-medium transition-all"
              style={{
                background: 'rgba(212,168,67,0.08)',
                color: 'var(--zcc-kinpaku)',
                border: '1px solid rgba(212,168,67,0.2)',
                cursor: actionLoading === 'reindex' ? 'wait' : 'pointer',
                opacity: actionLoading === 'reindex' ? 0.6 : 1,
              }}
            >
              {actionLoading === 'reindex' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />}
              <span>Re-indexar</span>
            </button>
            <button
              onClick={trigger}
              disabled={actionLoading === 'trigger'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono font-medium transition-all"
              style={{
                background: 'rgba(16,185,129,0.08)',
                color: '#10b981',
                border: '1px solid rgba(16,185,129,0.2)',
                cursor: actionLoading === 'trigger' ? 'wait' : 'pointer',
                opacity: actionLoading === 'trigger' ? 0.6 : 1,
              }}
            >
              {actionLoading === 'trigger' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              <span>Forçar Análise</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="INDEX DB" value={stats?.indexStats.dbChunks?.toString() || '0'} sub="chunks" icon={<Database className="w-3 h-3" />} color="#3b82f6" />
          <StatCard label="INDEX MEM" value={stats?.indexStats.tfidf.totalDocs?.toString() || '0'} sub={stats?.indexStats.isLoaded ? 'loaded' : 'cold'} icon={<TrendingUp className="w-3 h-3" />} color="#10b981" />
          <StatCard label="PENDENTES" value={stats?.pendingReview?.toString() || '0'} icon={<AlertCircle className="w-3 h-3" />} color="#f59e0b" />
          <StatCard label="APROVADAS" value={stats?.approved?.toString() || '0'} icon={<Check className="w-3 h-3" />} color="#10b981" />
          <StatCard label="REJEITADAS" value={stats?.rejected?.toString() || '0'} icon={<X className="w-3 h-3" />} color="#ef4444" />
          <StatCard label="APLICADAS" value={stats?.applied?.toString() || '0'} icon={<GitBranch className="w-3 h-3" />} color="#3b82f6" />
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mt-4 flex-wrap">
          {(['pending_review', 'approved', 'rejected', 'applied', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-[10px] font-mono font-medium uppercase tracking-wider transition-all ${
                filter === f ? 'text-white' : ''
              }`}
              style={{
                background: filter === f ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.03)',
                color: filter === f ? 'var(--zcc-kinpaku)' : 'var(--zcc-text-muted)',
                border: `1px solid ${filter === f ? 'rgba(212,168,67,0.3)' : 'rgba(255,255,255,0.05)'}`,
                cursor: 'pointer',
              }}
            >
              {f === 'all' ? 'TODAS' : statusLabel(f)}
            </button>
          ))}
        </div>
      </motion.div>

      {/* ===== SUGGESTIONS LIST ===== */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="zcc-panel p-4 h-32 shimmer" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
      ) : suggestions.length === 0 ? (
        <div className="zcc-panel p-8 text-center">
          <Code className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: 'var(--zcc-text-muted)' }} />
          <p className="text-xs" style={{ color: 'var(--zcc-text-muted)' }}>
            Nenhuma sugestão {filter === 'all' ? '' : statusLabel(filter).toLowerCase()}.
            <br />
            Aguardando cron diário (07:00 UTC) detectar erros recorrentes...
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {suggestions.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ delay: i * 0.03 }}
                className="zcc-panel p-4"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileCode className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--zcc-kinpaku)' }} />
                      <span className="text-xs font-mono truncate" style={{ color: 'var(--zcc-champagne)' }}>
                        {s.filePath}
                      </span>
                      <span className="text-[9px] font-mono" style={{ color: 'var(--zcc-text-muted)' }}>
                        L{s.lineRange}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] font-mono" style={{ color: 'var(--zcc-text-muted)' }}>
                      <span
                        className="px-1.5 py-0.5 rounded uppercase"
                        style={{
                          background: `${statusColor(s.status)}20`,
                          color: statusColor(s.status),
                        }}
                      >
                        {statusLabel(s.status)}
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded uppercase"
                        style={{
                          background: `${confidenceColor(s.confidence)}20`,
                          color: confidenceColor(s.confidence),
                        }}
                      >
                        {confidenceLabel(s.confidence)} ({(s.confidence * 100).toFixed(0)}%)
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded uppercase"
                        style={{
                          background: s.mode === 'live' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                          color: s.mode === 'live' ? '#10b981' : '#f59e0b',
                        }}
                      >
                        {s.mode.toUpperCase()}
                      </span>
                      <span>·</span>
                      <span>Erro: <code style={{ color: 'var(--zcc-text-secondary)' }}>{s.sourceErrorHash}</code></span>
                      <span>·</span>
                      <span>{formatTimeAgo(s.createdAt)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  {s.status === 'pending_review' && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleAction(s.id, 'reject')}
                        disabled={actionLoading === s.id}
                        className="p-1.5 rounded transition-colors"
                        style={{
                          background: 'rgba(239,68,68,0.1)',
                          color: '#ef4444',
                          border: '1px solid rgba(239,68,68,0.3)',
                          cursor: actionLoading === s.id ? 'wait' : 'pointer',
                        }}
                        title="Rejeitar"
                      >
                        {actionLoading === s.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                      </button>
                      <button
                        onClick={() => handleAction(s.id, 'approve')}
                        disabled={actionLoading === s.id}
                        className="p-1.5 rounded transition-colors"
                        style={{
                          background: 'rgba(16,185,129,0.1)',
                          color: '#10b981',
                          border: '1px solid rgba(16,185,129,0.3)',
                          cursor: actionLoading === s.id ? 'wait' : 'pointer',
                        }}
                        title="Aprovar"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleAction(s.id, 'apply')}
                        disabled={actionLoading === s.id}
                        className="p-1.5 rounded transition-colors"
                        style={{
                          background: 'rgba(59,130,246,0.1)',
                          color: '#3b82f6',
                          border: '1px solid rgba(59,130,246,0.3)',
                          cursor: actionLoading === s.id ? 'wait' : 'pointer',
                        }}
                        title="Marcar como aplicada"
                      >
                        <GitBranch className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Rationale */}
                <div className="mb-2">
                  <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'var(--zcc-text-muted)' }}>
                    Rationale
                  </span>
                  <p className="text-xs mt-1" style={{ color: 'var(--zcc-text-secondary)' }}>
                    {s.rationale}
                  </p>
                </div>

                {/* Expandable diff */}
                <button
                  onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                  className="text-[9px] font-mono uppercase tracking-wider flex items-center gap-1 mt-2"
                  style={{ color: 'var(--zcc-kinpaku)', cursor: 'pointer' }}
                >
                  {expandedId === s.id ? '▼' : '▶'} Ver diff do código
                </button>

                <AnimatePresence>
                  {expandedId === s.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <DiffViewer current={s.currentCode} proposed={s.proposedCode} />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Review notes (if exists) */}
                {s.reviewNotes && (
                  <div className="mt-2 p-2 rounded text-[10px] font-mono" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <span style={{ color: 'var(--zcc-text-muted)' }}>Review notes:</span>
                    <span style={{ color: 'var(--zcc-text-secondary)' }}> {s.reviewNotes}</span>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ===== FOOTER ===== */}
      <div className="text-center text-[9px] font-mono py-2" style={{ color: 'var(--zcc-text-muted)' }}>
        Cron diário 07:00 UTC verifica erros recorrentes (5+ em 24h) · GLM 5.2 propõe refatoração · Feedback humano retroalimenta o knowledge base
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded p-2.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <div className="flex items-center gap-1 mb-1">
        <span style={{ color }}>{icon}</span>
        <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'var(--zcc-text-muted)' }}>
          {label}
        </span>
      </div>
      <div className="text-sm font-bold font-mono" style={{ color }}>
        {value}
      </div>
      {sub && (
        <div className="text-[9px] font-mono mt-0.5" style={{ color: 'var(--zcc-text-muted)' }}>
          {sub}
        </div>
      )}
    </div>
  );
}
