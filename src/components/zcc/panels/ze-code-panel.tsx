'use client';

// ============================================================================
// ZÉLLA — ZéCodePanel (DEV FULL STACK Interno — Inspirado no CodeRabbit)
// ============================================================================
// Painel master do ZéCode, substituindo o antigo "RefactorSuggestionsPanel".
// Trabalha em PARALELO com o Cérebro Zélla:
//   - Cérebro Zélla (aba `cerebro`) = "código vivo" — runtime, anomalias, budget
//   - ZéCode (aba `ze-code`) = "DEV FULL STACK" — revisão e evolução do código
//
// 5 VIEWS:
//   1. Overview     — codebase domain + safety locks + stats unificadas
//   2. Reviews      — disparar e listar Code Reviews (CodeRabbit-style)
//   3. Refactors    — fila de sugestões de refatoração (approve/reject/apply)
//   4. Gaps         — gaps detectados (missing tests/types/error handling)
//   5. Bottlenecks  — gargalos detectados (N+1, sync IO, missing index)
//
// AÇÕES:
//   - "Evolve Code" — comando master que roda todas as detecções
//   - "Trigger Review" — dispara review manual
//   - "Approve / Reject / Apply" — ações por sugestão (com safety locks)
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Code2, Brain, Shield, Zap, GitBranch, Check, X,
  FileCode, TrendingUp, Database, RefreshCw, Lock, Activity,
  Wrench, Target, Gauge,
} from 'lucide-react';
import type {
  ZeCodeStats,
  ZeCodeView,
  GapFinding,
  BottleneckFinding,
  EvolveResult,
} from '@/lib/cerebro/ze-code/types';

// ── Light types for proxy responses (reviews + refactors come from DB) ──────

interface ReviewListItem {
  id?: string;
  scope?: string;
  reviewMode?: string;
  highLevelSummary?: string;
  createdAt?: string;
  status?: string;
}

interface RefactorListItem {
  id: string;
  filePath: string;
  lineRange: string;
  currentCode: string;
  proposedCode: string;
  rationale: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'applied';
  confidence: number;
  mode: 'mock' | 'live';
  createdAt: string;
  reviewNotes?: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function severityColor(s: string): string {
  switch (s) {
    case 'emergency': return '#dc2626';
    case 'critical': return '#ef4444';
    case 'warning': return '#f59e0b';
    case 'info': return '#3b82f6';
    default: return '#888';
  }
}

function severityLabel(s: string): string {
  return s.toUpperCase();
}

function confidenceColor(c: number): string {
  if (c >= 0.8) return '#10b981';
  if (c >= 0.6) return '#3b82f6';
  if (c >= 0.4) return '#f59e0b';
  return '#ef4444';
}

function formatTimeAgo(iso: string): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s atrás`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  return `${Math.floor(hours / 24)}d atrás`;
}

// ── Sub-component: StatCard ─────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, color,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; color: string;
}) {
  return (
    <div className="rounded p-2.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <div className="flex items-center gap-1 mb-1">
        <span style={{ color }}>{icon}</span>
        <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'var(--zcc-text-muted)' }}>
          {label}
        </span>
      </div>
      <div className="text-sm font-bold font-mono" style={{ color }}>{value}</div>
      {sub && (
        <div className="text-[9px] font-mono mt-0.5" style={{ color: 'var(--zcc-text-muted)' }}>{sub}</div>
      )}
    </div>
  );
}

// ── Sub-component: SafetyLockBadge ──────────────────────────────────────────

function SafetyLockBadge({ label, active, value }: { label: string; active: boolean; value?: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded" style={{
      background: active ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
      border: `1px solid ${active ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
    }}>
      <Lock className="w-2.5 h-2.5" style={{ color: active ? '#10b981' : '#ef4444' }} />
      <span className="text-[9px] font-mono font-medium" style={{ color: active ? '#10b981' : '#ef4444' }}>
        {label}
      </span>
      {value && (
        <span className="text-[9px] font-mono" style={{ color: 'var(--zcc-text-muted)' }}>· {value}</span>
      )}
    </div>
  );
}

// ── Sub-component: DiffViewer ───────────────────────────────────────────────

function DiffViewer({ current, proposed }: { current: string | null; proposed: string | null }) {
  if (!current && !proposed) return null;
  const currentLines = (current || '').split('\n');
  const proposedLines = (proposed || '').split('\n');
  const maxLines = Math.max(currentLines.length, proposedLines.length, 6);

  return (
    <div className="grid grid-cols-2 gap-2 mt-2">
      <div>
        <div className="text-[9px] font-mono uppercase tracking-wider mb-1" style={{ color: '#ef4444' }}>
          − ATUAL
        </div>
        <pre className="text-[10px] font-mono p-2 rounded overflow-x-auto max-h-48 overflow-y-auto"
          style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
          {currentLines.slice(0, maxLines).map((line, i) => (
            <div key={i} className="flex">
              <span className="text-zinc-600 select-none mr-2">{i + 1}</span>
              <span className="text-red-300/70 whitespace-pre">{line}</span>
            </div>
          ))}
        </pre>
      </div>
      <div>
        <div className="text-[9px] font-mono uppercase tracking-wider mb-1" style={{ color: '#10b981' }}>
          + SUGERIDO
        </div>
        <pre className="text-[10px] font-mono p-2 rounded overflow-x-auto max-h-48 overflow-y-auto"
          style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)' }}>
          {proposedLines.slice(0, maxLines).map((line, i) => (
            <div key={i} className="flex">
              <span className="text-zinc-600 select-none mr-2">{i + 1}</span>
              <span className="text-emerald-300/70 whitespace-pre">{line}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

// ── Sub-component: FindingCard (genérico para Gaps e Bottlenecks) ────────────

function FindingCard({
  finding,
  onApply,
  actionLoading,
  expanded,
  onToggleExpand,
  categoryLabel,
}: {
  finding: GapFinding | BottleneckFinding;
  onApply: () => void;
  actionLoading: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  categoryLabel: string;
}) {
  const f = finding as GapFinding & BottleneckFinding;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="zcc-panel p-4"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <FileCode className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--zcc-kinpaku)' }} />
            <span className="text-xs font-mono truncate" style={{ color: 'var(--zcc-champagne)' }}>
              {f.filePath}
            </span>
            <span className="text-[9px] font-mono" style={{ color: 'var(--zcc-text-muted)' }}>
              L{f.lineRange}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[9px] font-mono flex-wrap" style={{ color: 'var(--zcc-text-muted)' }}>
            <span className="px-1.5 py-0.5 rounded uppercase font-bold"
              style={{ background: `${severityColor(f.severity)}20`, color: severityColor(f.severity) }}>
              {severityLabel(f.severity)}
            </span>
            <span className="px-1.5 py-0.5 rounded uppercase"
              style={{ background: 'rgba(212,168,67,0.1)', color: 'var(--zcc-kinpaku)' }}>
              {categoryLabel}
            </span>
            <span className="px-1.5 py-0.5 rounded uppercase"
              style={{ background: `${confidenceColor(f.confidence)}20`, color: confidenceColor(f.confidence) }}>
              {(f.confidence * 100).toFixed(0)}%
            </span>
            <span className="px-1.5 py-0.5 rounded uppercase"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--zcc-text-muted)' }}>
              {f.detectedBy}
            </span>
            {f.estimatedImpact && (
              <span className="px-1.5 py-0.5 rounded uppercase"
                style={{
                  background: f.estimatedImpact === 'critical' ? 'rgba(220,38,38,0.15)' : 'rgba(245,158,11,0.1)',
                  color: f.estimatedImpact === 'critical' ? '#dc2626' : '#f59e0b',
                }}>
                IMPACT: {f.estimatedImpact.toUpperCase()}
              </span>
            )}
            <span>·</span>
            <span>{formatTimeAgo(f.createdAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onApply} disabled={actionLoading}
            className="p-1.5 rounded transition-colors"
            style={{
              background: 'rgba(59,130,246,0.1)', color: '#3b82f6',
              border: '1px solid rgba(59,130,246,0.3)',
              cursor: actionLoading ? 'wait' : 'pointer',
            }}
            title="Marcar como aplicada (humano aprova — safety lock)">
            {actionLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          </button>
        </div>
      </div>

      <div className="mb-2">
        <div className="text-xs font-semibold mb-0.5" style={{ color: 'var(--zcc-champagne)' }}>
          {f.title}
        </div>
        <p className="text-xs" style={{ color: 'var(--zcc-text-secondary)' }}>
          {f.description}
        </p>
      </div>

      <button onClick={onToggleExpand}
        className="text-[9px] font-mono uppercase tracking-wider flex items-center gap-1 mt-2"
        style={{ color: 'var(--zcc-kinpaku)', cursor: 'pointer' }}>
        {expanded ? '▼' : '▶'} Ver diff do código
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}>
            <DiffViewer current={f.currentCode} proposed={f.suggestedCode} />
            {f.rationale && (
              <div className="mt-2 p-2 rounded text-[10px] font-mono" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <span style={{ color: 'var(--zcc-text-muted)' }}>Rationale: </span>
                <span style={{ color: 'var(--zcc-text-secondary)' }}>{f.rationale}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function ZeCodePanel() {
  const [view, setView] = useState<ZeCodeView>('overview');
  const [stats, setStats] = useState<ZeCodeStats | null>(null);
  const [gaps, setGaps] = useState<GapFinding[]>([]);
  const [bottlenecks, setBottlenecks] = useState<BottleneckFinding[]>([]);
  const [refactors, setRefactors] = useState<RefactorListItem[]>([]);
  const [reviews, setReviews] = useState<ReviewListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [evolveResult, setEvolveResult] = useState<EvolveResult | null>(null);

  // ── Fetchers ──

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/zcc/ze-code/stats');
      if (res.ok) {
        const json = await res.json();
        if (json.success) setStats(json.data);
      }
    } catch (e) {
      console.error('[ZeCodePanel] stats fetch error:', e);
    }
  }, []);

  const fetchGaps = useCallback(async () => {
    try {
      const res = await fetch('/api/zcc/ze-code/gaps?maxFiles=15');
      if (res.ok) {
        const json = await res.json();
        if (json.success) setGaps(json.data.gaps || []);
      }
    } catch (e) {
      console.error('[ZeCodePanel] gaps fetch error:', e);
    }
  }, []);

  const fetchBottlenecks = useCallback(async () => {
    try {
      const res = await fetch('/api/zcc/ze-code/bottlenecks?maxFiles=15');
      if (res.ok) {
        const json = await res.json();
        if (json.success) setBottlenecks(json.data.bottlenecks || []);
      }
    } catch (e) {
      console.error('[ZeCodePanel] bottlenecks fetch error:', e);
    }
  }, []);

  const fetchRefactors = useCallback(async () => {
    try {
      const res = await fetch('/api/zcc/ze-code/refactors?limit=20');
      if (res.ok) {
        const json = await res.json();
        if (json.success) setRefactors(json.data || []);
      }
    } catch (e) {
      console.error('[ZeCodePanel] refactors fetch error:', e);
    }
  }, []);

  const fetchReviews = useCallback(async () => {
    try {
      const res = await fetch('/api/zcc/ze-code/review?limit=20');
      if (res.ok) {
        const json = await res.json();
        if (json.success) setReviews(json.data?.reviews || []);
      }
    } catch (e) {
      console.error('[ZeCodePanel] reviews fetch error:', e);
    }
  }, []);

  // ── Initial load + auto-refresh ──

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      await Promise.all([fetchStats(), fetchRefactors(), fetchReviews()]);
      setLoading(false);
    }
    loadAll();
    const interval = setInterval(() => {
      fetchStats();
    }, 60_000); // refresh stats a cada 60s
    return () => clearInterval(interval);
  }, [fetchStats, fetchRefactors, fetchReviews]);

  // ── Lazy load gaps/bottlenecks when view switches ──

  useEffect(() => {
    if (view === 'gaps' && gaps.length === 0) fetchGaps();
    if (view === 'bottlenecks' && bottlenecks.length === 0) fetchBottlenecks();
  }, [view, gaps.length, bottlenecks.length, fetchGaps, fetchBottlenecks]);

  // ── Actions ──

  const handleEvolve = async (): Promise<void> => {
    setActionLoading('evolve');
    try {
      const res = await fetch('/api/zcc/ze-code/evolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'directory', target: 'src/', maxFiles: 10 }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setEvolveResult(json.data);
          // Refresh all views
          await Promise.all([fetchStats(), fetchGaps(), fetchBottlenecks(), fetchRefactors()]);
        }
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleApply = async (category: 'review' | 'refactor' | 'gap' | 'bottleneck', suggestionId: string): Promise<void> => {
    setActionLoading(`${category}-${suggestionId}`);
    try {
      await fetch('/api/zcc/ze-code/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, suggestionId }),
      });
      // Refresh appropriate view
      if (category === 'gap') await fetchGaps();
      if (category === 'bottleneck') await fetchBottlenecks();
      if (category === 'refactor') await fetchRefactors();
      if (category === 'review') await fetchReviews();
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefactorAction = async (suggestionId: string, action: 'approve' | 'reject' | 'apply'): Promise<void> => {
    setActionLoading(`refactor-${suggestionId}-${action}`);
    try {
      await fetch(`/api/zcc/ze-code/refactors?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId, notes: action === 'reject' ? (window.prompt('Notas:') || '') : '' }),
      });
      await fetchRefactors();
    } finally {
      setActionLoading(null);
    }
  };

  // ── Render ──

  const views: { id: ZeCodeView; label: string; icon: React.ElementType }[] = [
    { id: 'overview',    label: 'Overview',    icon: Activity },
    { id: 'reviews',     label: 'Reviews',     icon: GitBranch },
    { id: 'refactors',  label: 'Refactors',    icon: Wrench },
    { id: 'gaps',        label: 'Gaps',        icon: Target },
    { id: 'bottlenecks', label: 'Gargalos',    icon: Gauge },
  ];

  return (
    <div className="space-y-5">
      {/* ===== TOP: ZéCode Header + Master Actions ===== */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="zcc-panel p-5"
        style={{ borderColor: 'var(--zcc-kinpaku)', borderWidth: 1 }}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5" style={{ color: 'var(--zcc-kinpaku)' }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--zcc-champagne)' }}>
              ZéCode — DEV FULL STACK Interno
            </h3>
            {stats && (
              <span
                className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider"
                style={{
                  background: stats.mode === 'live' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                  color: stats.mode === 'live' ? '#10b981' : '#f59e0b',
                  border: `1px solid ${stats.mode === 'live' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                }}>
                {stats.mode === 'live' ? '● LIVE' : '● MOCK'}
              </span>
            )}
            <span className="text-[9px] font-mono" style={{ color: 'var(--zcc-text-muted)' }}>
              · Inspirado no CodeRabbit · Trabalha em paralelo ao Cérebro Zélla
            </span>
          </div>
          <button
            onClick={handleEvolve}
            disabled={actionLoading === 'evolve'}
            className="flex items-center gap-1.5 px-4 py-2 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-all"
            style={{
              background: 'rgba(212,168,67,0.12)',
              color: 'var(--zcc-kinpaku)',
              border: '1px solid rgba(212,168,67,0.3)',
              cursor: actionLoading === 'evolve' ? 'wait' : 'pointer',
              opacity: actionLoading === 'evolve' ? 0.6 : 1,
            }}>
            {actionLoading === 'evolve' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            Evoluir Código
          </button>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-1 flex-wrap">
          {views.map(v => {
            const Icon = v.icon;
            return (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono font-medium uppercase tracking-wider transition-all"
                style={{
                  background: view === v.id ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.03)',
                  color: view === v.id ? 'var(--zcc-kinpaku)' : 'var(--zcc-text-muted)',
                  border: `1px solid ${view === v.id ? 'rgba(212,168,67,0.3)' : 'rgba(255,255,255,0.05)'}`,
                  cursor: 'pointer',
                }}>
                <Icon className="w-3 h-3" />
                <span>{v.label}</span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* ===== VIEW: OVERVIEW ===== */}
      {view === 'overview' && (
        <div className="space-y-5">
          {/* Codebase Domain */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="zcc-panel p-5">
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-4 h-4" style={{ color: 'var(--zcc-kinpaku)' }} />
              <h4 className="text-sm font-bold" style={{ color: 'var(--zcc-champagne)' }}>Codebase Domain</h4>
              <span className="text-[9px] font-mono" style={{ color: 'var(--zcc-text-muted)' }}>
                · Quanto o ZéCode conhece do projeto
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <StatCard label="ARQUIVOS" value={stats?.domain.totalCodeFiles ?? '—'} sub="código-fonte" icon={<FileCode className="w-3 h-3" />} color="#3b82f6" />
              <StatCard label="DB CHUNKS" value={stats?.domain.dbChunks ?? '—'} sub="indexados" icon={<Database className="w-3 h-3" />} color="#10b981" />
              <StatCard label="TF-IDF DOCS" value={stats?.domain.tfidf.totalDocs ?? '—'} sub={stats?.domain.tfidf.isLoaded ? 'loaded' : 'cold'} icon={<TrendingUp className="w-3 h-3" />} color="#10b981" />
              <StatCard label="TERMS" value={stats?.domain.tfidf.totalTerms ?? '—'} sub="vocabulário" icon={<Brain className="w-3 h-3" />} color="var(--zcc-kinpaku)" />
              <StatCard label="LAST SCAN" value={stats?.domain.lastScanAt ? formatTimeAgo(stats.domain.lastScanAt) : '—'} icon={<Activity className="w-3 h-3" />} color="#888" />
            </div>

            {/* Top directories */}
            {stats?.domain.topDirectories && stats.domain.topDirectories.length > 0 && (
              <div className="mt-4">
                <div className="text-[9px] font-mono uppercase tracking-wider mb-2" style={{ color: 'var(--zcc-text-muted)' }}>
                  TOP DIRETÓRIOS
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {stats.domain.topDirectories.map(d => (
                    <div key={d.dir} className="flex items-center gap-1.5 px-2 py-1 rounded" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <span className="text-[9px] font-mono" style={{ color: 'var(--zcc-champagne)' }}>{d.dir || '(root)'}</span>
                      <span className="text-[9px] font-mono font-bold" style={{ color: 'var(--zcc-kinpaku)' }}>{d.files}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          {/* Safety Locks */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="zcc-panel p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4" style={{ color: 'var(--zcc-kinpaku)' }} />
              <h4 className="text-sm font-bold" style={{ color: 'var(--zcc-champagne)' }}>Safety Locks</h4>
              <span className="text-[9px] font-mono" style={{ color: 'var(--zcc-text-muted)' }}>
                · Travas precisas para super trabalho
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              <SafetyLockBadge label="Allowlist Ext" active={!!stats?.safety.extensionAllowlist.length} value={`${stats?.safety.extensionAllowlist.length ?? 0} exts`} />
              <SafetyLockBadge label="Skip Dirs" active={!!stats?.safety.blockedDirs.length} value={`${stats?.safety.blockedDirs.length ?? 0} dirs`} />
              <SafetyLockBadge label="Max File Size" active={true} value={`${stats?.safety.maxFileSizeKb ?? 100}KB`} />
              <SafetyLockBadge label="Auto-Apply" active={false} value="SEMPRE OFF" />
              <SafetyLockBadge label="Budget" active={(stats?.safety.budgetUsagePercent ?? 0) < 100} value={`$${stats?.safety.monthSpendUsd.toFixed(2) ?? 0}/$${stats?.safety.monthlyBudgetUsd.toFixed(2) ?? 20}`} />
              <SafetyLockBadge label="Rate Limit" active={true} value={`${stats?.safety.reviewsLastHour ?? 0}/${stats?.safety.rateLimitPerHour ?? 10}/h`} />
              <SafetyLockBadge label="Live Mode" active={stats?.safety.liveModeEnabled ?? false} value={stats?.safety.liveModeEnabled ? 'ON' : 'OFF'} />
              <SafetyLockBadge label="GODMODE" active={stats?.safety.godmodeRequired ?? true} value="Required" />
            </div>
          </motion.div>

          {/* Unified Counts */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="zcc-panel p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4" style={{ color: 'var(--zcc-kinpaku)' }} />
              <h4 className="text-sm font-bold" style={{ color: 'var(--zcc-champagne)' }}>Unified Counts</h4>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              <StatCard label="REVIEWS" value={stats?.counts.reviewsTotal ?? 0} sub={`${stats?.counts.reviewsPending ?? 0} pend.`} icon={<GitBranch className="w-3 h-3" />} color="#3b82f6" />
              <StatCard label="REFACTORS" value={stats?.counts.refactorsTotal ?? 0} sub={`${stats?.counts.refactorsPending ?? 0} pend.`} icon={<Wrench className="w-3 h-3" />} color="var(--zcc-kinpaku)" />
              <StatCard label="GAPS" value={stats?.counts.gapsTotal ?? 0} sub={`${stats?.counts.gapsPending ?? 0} pend.`} icon={<Target className="w-3 h-3" />} color="#f59e0b" />
              <StatCard label="GARGALOS" value={stats?.counts.bottlenecksTotal ?? 0} sub={`${stats?.counts.bottlenecksPending ?? 0} pend.`} icon={<Gauge className="w-3 h-3" />} color="#ef4444" />
              <StatCard label="APLICADAS" value={stats?.counts.appliedTotal ?? 0} icon={<Check className="w-3 h-3" />} color="#10b981" />
              <StatCard label="LAST ACT." value={stats?.lastActivityAt ? formatTimeAgo(stats.lastActivityAt) : '—'} icon={<Activity className="w-3 h-3" />} color="#888" />
            </div>
          </motion.div>

          {/* Evolve Result (if any) */}
          {evolveResult && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="zcc-panel p-5"
              style={{ borderColor: evolveResult.status === 'completed' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)', borderWidth: 1 }}>
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4" style={{ color: evolveResult.status === 'completed' ? '#10b981' : '#ef4444' }} />
                <h4 className="text-sm font-bold" style={{ color: 'var(--zcc-champagne)' }}>
                  Último Evolve · {evolveResult.jobId}
                </h4>
                <span className="text-[9px] font-mono" style={{ color: 'var(--zcc-text-muted)' }}>
                  · {evolveResult.durationMs}ms · ${evolveResult.costUsd.toFixed(4)}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <StatCard label="GAPS" value={evolveResult.gapsCreated} icon={<Target className="w-3 h-3" />} color="#f59e0b" />
                <StatCard label="GARGALOS" value={evolveResult.bottlenecksCreated} icon={<Gauge className="w-3 h-3" />} color="#ef4444" />
                <StatCard label="REVIEWS" value={evolveResult.reviewsCreated} icon={<GitBranch className="w-3 h-3" />} color="#3b82f6" />
                <StatCard label="REFACTORS" value={evolveResult.refactorsCreated} icon={<Wrench className="w-3 h-3" />} color="var(--zcc-kinpaku)" />
              </div>
              <pre className="text-[10px] font-mono p-3 rounded overflow-x-auto" style={{ background: 'rgba(255,255,255,0.02)', color: 'var(--zcc-text-secondary)' }}>
                {evolveResult.summary}
              </pre>
              {evolveResult.warnings.length > 0 && (
                <div className="mt-2 p-2 rounded text-[10px] font-mono" style={{ background: 'rgba(245,158,11,0.08)', color: '#f59e0b' }}>
                  ⚠ Warnings: {evolveResult.warnings.join('; ')}
                </div>
              )}
            </motion.div>
          )}

          {/* Architecture Diagram (textual) */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="zcc-panel p-5">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4" style={{ color: 'var(--zcc-kinpaku)' }} />
              <h4 className="text-sm font-bold" style={{ color: 'var(--zcc-champagne)' }}>Arquitetura · Cérebro Zélla vs ZéCode</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded" style={{ background: 'rgba(74,154,154,0.05)', border: '1px solid rgba(74,154,154,0.15)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="w-4 h-4" style={{ color: 'var(--zcc-patina)' }} />
                  <span className="text-xs font-bold" style={{ color: 'var(--zcc-patina)' }}>Cérebro Zélla</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(74,154,154,0.1)', color: 'var(--zcc-patina)' }}>
                    código vivo
                  </span>
                </div>
                <ul className="text-[10px] font-mono space-y-1" style={{ color: 'var(--zcc-text-secondary)' }}>
                  <li>· Anomalias runtime (CPU, RAM, error rate)</li>
                  <li>· Budget forecast por tenant</li>
                  <li>· Inadimplência & churn risk</li>
                  <li>· LogSink + AlertBus (SSE stream)</li>
                  <li>· Cron 07:00 UTC — análise diária</li>
                </ul>
              </div>
              <div className="p-3 rounded" style={{ background: 'rgba(212,168,67,0.05)', border: '1px solid rgba(212,168,67,0.15)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Code2 className="w-4 h-4" style={{ color: 'var(--zcc-kinpaku)' }} />
                  <span className="text-xs font-bold" style={{ color: 'var(--zcc-kinpaku)' }}>ZéCode</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(212,168,67,0.1)', color: 'var(--zcc-kinpaku)' }}>
                    DEV FULL STACK
                  </span>
                </div>
                <ul className="text-[10px] font-mono space-y-1" style={{ color: 'var(--zcc-text-secondary)' }}>
                  <li>· Code Review estilo CodeRabbit (4 modes)</li>
                  <li>· Refactor suggestions para erros recorrentes</li>
                  <li>· Gap detection (testes, tipos, validation)</li>
                  <li>· Bottleneck detection (N+1, sync IO, missing index)</li>
                  <li>· Sandbox + safety locks + GODMODE</li>
                </ul>
              </div>
            </div>
            <div className="mt-3 text-center text-[9px] font-mono" style={{ color: 'var(--zcc-text-muted)' }}>
              Ambos usam GLM 5.2 embarcado (lib/cerebro/glm-service) · ambos têm budget guard · trabalham em paralelo, sem overlap de responsabilidade
            </div>
          </motion.div>
        </div>
      )}

      {/* ===== VIEW: REVIEWS ===== */}
      {view === 'reviews' && (
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="zcc-panel p-4 h-24 shimmer" style={{ background: 'rgba(255,255,255,0.04)' }} />
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <div className="zcc-panel p-8 text-center">
              <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: 'var(--zcc-text-muted)' }} />
              <p className="text-xs" style={{ color: 'var(--zcc-text-muted)' }}>
                Nenhuma review ainda. Use a aba <button onClick={() => setView('overview')} className="underline" style={{ color: 'var(--zcc-kinpaku)' }}>Overview → Evoluir Código</button> ou dispare manualmente via API.
              </p>
            </div>
          ) : (
            reviews.map((r, i) => (
              <motion.div key={r.id || i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="zcc-panel p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <GitBranch className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--zcc-kinpaku)' }} />
                      <span className="text-xs font-mono truncate" style={{ color: 'var(--zcc-champagne)' }}>
                        {r.scope || r.reviewMode || 'review'}
                      </span>
                      <span className="text-[9px] font-mono" style={{ color: 'var(--zcc-text-muted)' }}>
                        {formatTimeAgo(r.createdAt || '')}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--zcc-text-secondary)' }}>
                      {r.highLevelSummary || '(no summary)'}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* ===== VIEW: REFACTORS ===== */}
      {view === 'refactors' && (
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="zcc-panel p-4 h-24 shimmer" style={{ background: 'rgba(255,255,255,0.04)' }} />
              ))}
            </div>
          ) : refactors.length === 0 ? (
            <div className="zcc-panel p-8 text-center">
              <Wrench className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: 'var(--zcc-text-muted)' }} />
              <p className="text-xs" style={{ color: 'var(--zcc-text-muted)' }}>
                Nenhuma sugestão de refactor. Aguardando cron diário (07:00 UTC) detectar erros recorrentes...
              </p>
            </div>
          ) : (
            refactors.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ delay: i * 0.03 }} className="zcc-panel p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileCode className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--zcc-kinpaku)' }} />
                      <span className="text-xs font-mono truncate" style={{ color: 'var(--zcc-champagne)' }}>{s.filePath}</span>
                      <span className="text-[9px] font-mono" style={{ color: 'var(--zcc-text-muted)' }}>L{s.lineRange}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] font-mono" style={{ color: 'var(--zcc-text-muted)' }}>
                      <span className="px-1.5 py-0.5 rounded uppercase font-bold"
                        style={{ background: `${severityColor(s.status === 'applied' ? 'info' : 'warning')}20`, color: severityColor(s.status === 'applied' ? 'info' : 'warning') }}>
                        {s.status?.toUpperCase()}
                      </span>
                      <span className="px-1.5 py-0.5 rounded uppercase"
                        style={{ background: `${confidenceColor(s.confidence)}20`, color: confidenceColor(s.confidence) }}>
                        {(s.confidence * 100).toFixed(0)}%
                      </span>
                      <span className="px-1.5 py-0.5 rounded uppercase"
                        style={{ background: s.mode === 'live' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: s.mode === 'live' ? '#10b981' : '#f59e0b' }}>
                        {s.mode?.toUpperCase()}
                      </span>
                      <span>·</span>
                      <span>{formatTimeAgo(s.createdAt)}</span>
                    </div>
                  </div>
                  {s.status === 'pending_review' && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => handleRefactorAction(s.id, 'reject')} disabled={actionLoading?.startsWith(`refactor-${s.id}`)}
                        className="p-1.5 rounded transition-colors"
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                        title="Rejeitar">
                        <X className="w-3 h-3" />
                      </button>
                      <button onClick={() => handleRefactorAction(s.id, 'approve')} disabled={actionLoading?.startsWith(`refactor-${s.id}`)}
                        className="p-1.5 rounded transition-colors"
                        style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}
                        title="Aprovar">
                        <Check className="w-3 h-3" />
                      </button>
                      <button onClick={() => handleRefactorAction(s.id, 'apply')} disabled={actionLoading?.startsWith(`refactor-${s.id}`)}
                        className="p-1.5 rounded transition-colors"
                        style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' }}
                        title="Marcar como aplicada">
                        <GitBranch className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="mb-2">
                  <p className="text-xs" style={{ color: 'var(--zcc-text-secondary)' }}>{s.rationale}</p>
                </div>
                <button onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                  className="text-[9px] font-mono uppercase tracking-wider flex items-center gap-1"
                  style={{ color: 'var(--zcc-kinpaku)', cursor: 'pointer' }}>
                  {expandedId === s.id ? '▼' : '▶'} Ver diff do código
                </button>
                <AnimatePresence>
                  {expandedId === s.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                      <DiffViewer current={s.currentCode} proposed={s.proposedCode} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* ===== VIEW: GAPS ===== */}
      {view === 'gaps' && (
        <div className="space-y-3">
          {gaps.length === 0 && !loading ? (
            <div className="zcc-panel p-8 text-center">
              <Target className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: 'var(--zcc-text-muted)' }} />
              <p className="text-xs" style={{ color: 'var(--zcc-text-muted)' }}>
                Nenhum gap detectado. Clique em <button onClick={() => { fetchGaps(); }} className="underline" style={{ color: 'var(--zcc-kinpaku)' }}>refresh</button> ou use <button onClick={handleEvolve} className="underline" style={{ color: 'var(--zcc-kinpaku)' }}>Evoluir Código</button>.
              </p>
            </div>
          ) : gaps.length === 0 ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="zcc-panel p-4 h-24 shimmer" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
            </div>
          ) : (
            gaps.map(g => (
              <FindingCard
                key={g.id}
                finding={g}
                onApply={() => handleApply('gap', g.id)}
                actionLoading={actionLoading === `gap-${g.id}`}
                expanded={expandedId === g.id}
                onToggleExpand={() => setExpandedId(expandedId === g.id ? null : g.id)}
                categoryLabel={g.gapType.replace(/_/g, ' ')}
              />
            ))
          )}
        </div>
      )}

      {/* ===== VIEW: BOTTLENECKS ===== */}
      {view === 'bottlenecks' && (
        <div className="space-y-3">
          {bottlenecks.length === 0 && !loading ? (
            <div className="zcc-panel p-8 text-center">
              <Gauge className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: 'var(--zcc-text-muted)' }} />
              <p className="text-xs" style={{ color: 'var(--zcc-text-muted)' }}>
                Nenhum gargalo detectado. Clique em <button onClick={() => { fetchBottlenecks(); }} className="underline" style={{ color: 'var(--zcc-kinpaku)' }}>refresh</button> ou use <button onClick={handleEvolve} className="underline" style={{ color: 'var(--zcc-kinpaku)' }}>Evoluir Código</button>.
              </p>
            </div>
          ) : bottlenecks.length === 0 ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="zcc-panel p-4 h-24 shimmer" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
            </div>
          ) : (
            bottlenecks.map(b => (
              <FindingCard
                key={b.id}
                finding={b}
                onApply={() => handleApply('bottleneck', b.id)}
                actionLoading={actionLoading === `bottleneck-${b.id}`}
                expanded={expandedId === b.id}
                onToggleExpand={() => setExpandedId(expandedId === b.id ? null : b.id)}
                categoryLabel={b.bottleneckType.replace(/_/g, ' ')}
              />
            ))
          )}
        </div>
      )}

      {/* ===== FOOTER ===== */}
      <div className="text-center text-[9px] font-mono py-2" style={{ color: 'var(--zcc-text-muted)' }}>
        ZéCode trabalha em paralelo ao Cérebro Zélla · ambos usam GLM 5.2 embarcado · safety locks sempre ativos · auto-apply SEMPRE off · GODMODE requerido para forceLive
      </div>
    </div>
  );
}
