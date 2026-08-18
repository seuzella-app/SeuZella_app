'use client';

// ============================================================================
// ZÉLLA — CodeReviewerPanel (CodeRabbit-style tool — embedded in ZCC)
// ============================================================================
// Painel visual para admin Zélla disparar e revisar análises de código.
//
// Funcionalidades:
//  - Dashboard: budget atual, rate limits, total reviews/comments
//  - Trigger: 4 modos (diff | file | directory | hotspot) com opções
//  - Lista de revisões passadas com filtros
//  - Detalhe expansível: walkthrough + comments linha-a-linha
//  - Ações por comentário: apply / dismiss / approve / reject
//  - Diff viewer (código atual vs sugerido)
//  - Config editor (path_instructions, exclude_patterns, profile)
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Code, GitBranch, FileCode, FolderTree, Flame, Play, RefreshCw,
  Check, X, AlertTriangle, AlertOctagon, Info, Zap, DollarSign,
  ChevronDown, ChevronRight, ShieldCheck, Activity,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

interface CodeReviewComment {
  id: string;
  reviewId: string;
  filePath: string;
  startLine: number | null;
  endLine: number | null;
  category: string;
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  title: string;
  description: string;
  suggestedCode: string | null;
  currentCode: string | null;
  rationale: string | null;
  confidence: number;
  status: 'pending' | 'approved' | 'rejected' | 'applied' | 'dismissed';
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
}

interface CodeReview {
  id: string;
  reviewMode: 'diff' | 'file' | 'directory' | 'hotspot';
  scope: string;
  highLevelSummary: string;
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  stats: {
    filesReviewed: number;
    totalComments: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    emergencyCount: number;
    filesSkipped: number;
    bytesAnalyzed: number;
    tokensUsed: number;
    costUsd: number;
  };
  costUsd: number;
  mode: 'mock' | 'live';
  status: 'running' | 'completed' | 'failed' | 'dismissed';
  triggeredBy: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  comments?: CodeReviewComment[];
}

interface StatsData {
  mode: 'mock' | 'live';
  totalReviews: number;
  completedReviews: number;
  failedReviews: number;
  totalComments: number;
  pendingComments: number;
  appliedComments: number;
  criticalOpen: number;
}

interface BudgetData {
  spentUsd: number;
  budgetUsd: number;
  remainingUsd: number;
  percentUsed: number;
}

interface RateLimitData {
  reviewsLastMin: number;
  reviewsLastHour: number;
  limitPerMin: number;
  limitPerHour: number;
}

type ReviewMode = 'diff' | 'file' | 'directory' | 'hotspot';

// ── Helpers ─────────────────────────────────────────────────────────────────

function severityColor(s: string): string {
  switch (s) {
    case 'emergency': return '#dc2626';
    case 'critical': return '#ef4444';
    case 'warning': return '#f59e0b';
    default: return '#3b82f6';
  }
}

function severityIcon(s: string) {
  switch (s) {
    case 'emergency': return <AlertOctagon size={12} />;
    case 'critical': return <AlertTriangle size={12} />;
    case 'warning': return <AlertTriangle size={12} />;
    default: return <Info size={12} />;
  }
}

function categoryColor(c: string): string {
  switch (c) {
    case 'security': return '#dc2626';
    case 'performance': return '#f59e0b';
    case 'bug': return '#ef4444';
    case 'maintainability': return '#a78bfa';
    case 'style': return '#60a5fa';
    case 'best_practice': return '#10b981';
    default: return '#71717a';
  }
}

function statusColor(s: string): string {
  switch (s) {
    case 'completed': return '#10b981';
    case 'failed': return '#ef4444';
    case 'running': return '#3b82f6';
    case 'dismissed': return '#71717a';
    case 'applied': return '#10b981';
    case 'approved': return '#3b82f6';
    case 'rejected': return '#ef4444';
    case 'dismissed': return '#71717a';
    default: return '#f59e0b';
  }
}

function statusLabel(s: string): string {
  return s.toUpperCase();
}

function confidenceLabel(c: number): string {
  if (c >= 0.8) return 'ALTA';
  if (c >= 0.6) return 'MÉDIA';
  if (c >= 0.4) return 'BAIXA';
  return 'MÍNIMA';
}

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

// ── DiffViewer ──────────────────────────────────────────────────────────────

function DiffViewer({ current, proposed }: { current: string; proposed: string }) {
  const currentLines = current.split('\n');
  const proposedLines = proposed.split('\n');
  const maxLines = Math.max(currentLines.length, proposedLines.length, 5);

  return (
    <div className="grid grid-cols-2 gap-2 mt-2">
      <div>
        <div className="text-[9px] font-mono uppercase tracking-wider mb-1 flex items-center gap-1" style={{ color: '#ef4444' }}>
          <span>−</span> CÓDIGO ATUAL
        </div>
        <pre
          className="text-[10px] font-mono p-2 rounded overflow-x-auto max-h-56 overflow-y-auto"
          style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          {currentLines.slice(0, maxLines).map((line, i) => (
            <div key={i} className="flex">
              <span className="text-zinc-600 select-none mr-2 w-8 text-right">{i + 1}</span>
              <span className="text-red-300/70 whitespace-pre">{line || ' '}</span>
            </div>
          ))}
        </pre>
      </div>
      <div>
        <div className="text-[9px] font-mono uppercase tracking-wider mb-1 flex items-center gap-1" style={{ color: '#10b981' }}>
          <span>+</span> CÓDIGO SUGERIDO
        </div>
        <pre
          className="text-[10px] font-mono p-2 rounded overflow-x-auto max-h-56 overflow-y-auto"
          style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)' }}
        >
          {proposedLines.slice(0, maxLines).map((line, i) => (
            <div key={i} className="flex">
              <span className="text-zinc-600 select-none mr-2 w-8 text-right">{i + 1}</span>
              <span className="text-emerald-300/70 whitespace-pre">{line || ' '}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

// ── Stats Header ────────────────────────────────────────────────────────────

function StatsHeader({
  stats, budget, rateLimits, onRefresh,
}: {
  stats: StatsData | null;
  budget: BudgetData | null;
  rateLimits: RateLimitData | null;
  onRefresh: () => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
      <div className="rounded p-3" style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)' }}>
        <div className="text-[9px] uppercase tracking-wider text-zinc-500 flex items-center gap-1">
          <Activity size={10} /> MODO
        </div>
        <div className="text-base font-mono mt-1" style={{ color: stats?.mode === 'live' ? '#10b981' : '#f59e0b' }}>
          {stats?.mode?.toUpperCase() ?? '...'}
        </div>
      </div>

      <div className="rounded p-3" style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)' }}>
        <div className="text-[9px] uppercase tracking-wider text-zinc-500 flex items-center gap-1">
          <DollarSign size={10} /> BUDGET
        </div>
        <div className="text-base font-mono mt-1 text-emerald-400">
          ${budget?.remainingUsd.toFixed(4) ?? '0.0000'}
        </div>
        <div className="text-[9px] text-zinc-500 mt-0.5">
          {budget?.percentUsed.toFixed(1)}% usado
        </div>
      </div>

      <div className="rounded p-3" style={{ background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.2)' }}>
        <div className="text-[9px] uppercase tracking-wider text-zinc-500 flex items-center gap-1">
          <ShieldCheck size={10} /> RATE LIMIT
        </div>
        <div className="text-base font-mono mt-1 text-purple-400">
          {rateLimits?.reviewsLastMin ?? 0}/{rateLimits?.limitPerMin ?? 5}
        </div>
        <div className="text-[9px] text-zinc-500 mt-0.5">/min</div>
      </div>

      <div className="rounded p-3" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)' }}>
        <div className="text-[9px] uppercase tracking-wider text-zinc-500 flex items-center gap-1">
          <Code size={10} /> REVIEWS
        </div>
        <div className="text-base font-mono mt-1 text-amber-400">
          {stats?.totalReviews ?? 0}
        </div>
        <div className="text-[9px] text-zinc-500 mt-0.5">
          {stats?.completedReviews ?? 0} ok · {stats?.failedReviews ?? 0} fail
        </div>
      </div>

      <div className="rounded p-3" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
        <div className="text-[9px] uppercase tracking-wider text-zinc-500 flex items-center gap-1">
          <AlertOctagon size={10} /> CRÍTICOS ABERTOS
        </div>
        <div className="text-base font-mono mt-1 text-red-400">
          {stats?.criticalOpen ?? 0}
        </div>
        <div className="text-[9px] text-zinc-500 mt-0.5">
          {stats?.pendingComments ?? 0} coment. pend.
        </div>
      </div>

      <div className="rounded p-3 flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)' }}>
        <button
          onClick={onRefresh}
          className="text-zinc-400 hover:text-white transition-colors"
          title="Atualizar"
        >
          <RefreshCw size={16} />
        </button>
      </div>
    </div>
  );
}

// ── New Review Trigger ──────────────────────────────────────────────────────

function ReviewTrigger({ onTriggered }: { onTriggered: () => void }) {
  const [mode, setMode] = useState<ReviewMode>('diff');
  const [target, setTarget] = useState('origin/main');
  const [maxFiles, setMaxFiles] = useState(10);
  const [profile, setProfile] = useState<'assertive' | 'gentle'>('assertive');
  const [minSeverity, setMinSeverity] = useState<'info' | 'warning' | 'critical'>('info');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTrigger = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/zcc/code-reviewer/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode, target, maxFiles, profile, minSeverity,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Falha ao disparar revisão');
      onTriggered();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const modeConfig: Array<{
    value: ReviewMode; label: string; icon: React.ElementType; desc: string; placeholder: string;
  }> = [
    { value: 'diff', label: 'Diff', icon: GitBranch, desc: 'Revisar mudanças não mergeadas', placeholder: 'origin/main' },
    { value: 'file', label: 'Arquivo', icon: FileCode, desc: 'Revisar arquivo único', placeholder: 'src/lib/auth.ts' },
    { value: 'directory', label: 'Pasta', icon: FolderTree, desc: 'Revisar todos arquivos de uma pasta', placeholder: 'src/lib/cerebro' },
    { value: 'hotspot', label: 'Hotspot', icon: Flame, desc: 'Arquivos com erros recentes (24h)', placeholder: '24' },
  ];

  return (
    <div className="rounded-lg p-4 mb-4" style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(99,102,241,0.2)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Zap size={14} style={{ color: '#818cf8' }} />
        <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
          Disparar Nova Revisão
        </h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        {modeConfig.map((m) => {
          const Icon = m.icon;
          const active = mode === m.value;
          return (
            <button
              key={m.value}
              onClick={() => { setMode(m.value); setTarget(m.placeholder === '24' ? '24' : m.placeholder); }}
              className="rounded p-2 text-left transition-all"
              style={{
                background: active ? 'rgba(129,140,248,0.15)' : 'rgba(15,23,42,0.3)',
                border: active ? '1px solid rgba(129,140,248,0.5)' : '1px solid rgba(63,63,70,0.5)',
              }}
            >
              <Icon size={14} style={{ color: active ? '#818cf8' : '#71717a' }} />
              <div className="text-[11px] font-medium mt-1" style={{ color: active ? '#e5e7eb' : '#a1a1aa' }}>
                {m.label}
              </div>
              <div className="text-[9px] text-zinc-500 mt-0.5 leading-tight">{m.desc}</div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-[9px] uppercase tracking-wider text-zinc-500 block mb-1">Target</label>
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={modeConfig.find((m) => m.value === mode)?.placeholder}
            className="w-full rounded px-2 py-1.5 text-xs font-mono text-zinc-200"
            style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(63,63,70,0.6)' }}
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[9px] uppercase tracking-wider text-zinc-500 block mb-1">Max Files</label>
            <input
              type="number"
              min={1}
              max={30}
              value={maxFiles}
              onChange={(e) => setMaxFiles(Math.min(30, Math.max(1, parseInt(e.target.value || '10', 10))))}
              className="w-full rounded px-2 py-1.5 text-xs font-mono text-zinc-200"
              style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(63,63,70,0.6)' }}
            />
          </div>
          <div>
            <label className="text-[9px] uppercase tracking-wider text-zinc-500 block mb-1">Profile</label>
            <select
              value={profile}
              onChange={(e) => setProfile(e.target.value as 'assertive' | 'gentle')}
              className="w-full rounded px-2 py-1.5 text-xs text-zinc-200"
              style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(63,63,70,0.6)' }}
            >
              <option value="assertive">Assertive</option>
              <option value="gentle">Gentle</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] uppercase tracking-wider text-zinc-500 block mb-1">Min Sev</label>
            <select
              value={minSeverity}
              onChange={(e) => setMinSeverity(e.target.value as 'info' | 'warning' | 'critical')}
              className="w-full rounded px-2 py-1.5 text-xs text-zinc-200"
              style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(63,63,70,0.6)' }}
            >
              <option value="info">Info+</option>
              <option value="warning">Warning+</option>
              <option value="critical">Critical+</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-3 text-xs text-red-400 font-mono p-2 rounded" style={{ background: 'rgba(239,68,68,0.1)' }}>
          {error}
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <button
          onClick={handleTrigger}
          disabled={loading || !target}
          className="rounded px-4 py-1.5 text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
          style={{ background: 'rgba(129,140,248,0.15)', color: '#a5b4fc', border: '1px solid rgba(129,140,248,0.4)' }}
        >
          {loading ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
          {loading ? 'Revisando...' : 'Disparar Revisão'}
        </button>
      </div>
    </div>
  );
}

// ── Comment Card ────────────────────────────────────────────────────────────

function CommentCard({ comment, onAction }: {
  comment: CodeReviewComment;
  onAction: (commentId: string, action: 'apply' | 'dismiss' | 'approve' | 'reject') => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const handleAction = async (action: 'apply' | 'dismiss' | 'approve' | 'reject'): Promise<void> => {
    setActionLoading(true);
    try {
      await onAction(comment.id, action);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div
      className="rounded p-3 mb-2"
      style={{
        background: 'rgba(15,23,42,0.4)',
        border: '1px solid rgba(63,63,70,0.4)',
        borderLeft: `3px solid ${severityColor(comment.severity)}`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded"
              style={{ background: `${severityColor(comment.severity)}22`, color: severityColor(comment.severity) }}
            >
              {severityIcon(comment.severity)} {comment.severity}
            </span>
            <span
              className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded"
              style={{ background: `${categoryColor(comment.category)}22`, color: categoryColor(comment.category) }}
            >
              {comment.category}
            </span>
            <span className="text-[9px] text-zinc-500 font-mono">
              {comment.filePath}:{comment.startLine ?? 'file'}
            </span>
          </div>
          <div className="text-xs font-medium text-zinc-200">{comment.title}</div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="text-[11px] text-zinc-400 mt-2 leading-relaxed">
              {comment.description}
            </div>

            {comment.rationale && (
              <div className="text-[10px] text-zinc-500 mt-2 italic">
                <span className="font-semibold">Rationale:</span> {comment.rationale}
              </div>
            )}

            {comment.suggestedCode && comment.currentCode && (
              <DiffViewer current={comment.currentCode} proposed={comment.suggestedCode} />
            )}

            {comment.suggestedCode && !comment.currentCode && (
              <pre className="mt-2 text-[10px] font-mono p-2 rounded overflow-x-auto" style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <span className="text-emerald-300/80">{comment.suggestedCode}</span>
              </pre>
            )}

            <div className="mt-2 flex items-center gap-3 text-[9px] text-zinc-500">
              <span>Confiança: <span style={{ color: comment.confidence >= 0.6 ? '#10b981' : comment.confidence >= 0.4 ? '#f59e0b' : '#ef4444' }}>{confidenceLabel(comment.confidence)} ({(comment.confidence * 100).toFixed(0)}%)</span></span>
              {comment.reviewedBy && (
                <span>· Review: <span style={{ color: statusColor(comment.status) }}>{statusLabel(comment.status)}</span> por {comment.reviewedBy}</span>
              )}
            </div>

            {comment.status === 'pending' && (
              <div className="mt-2 flex items-center gap-1.5">
                {comment.suggestedCode && (
                  <button
                    onClick={() => handleAction('apply')}
                    disabled={actionLoading}
                    className="text-[10px] rounded px-2 py-1 flex items-center gap-1 transition-all disabled:opacity-50"
                    style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.4)' }}
                  >
                    <Check size={10} /> Aplicar
                  </button>
                )}
                <button
                  onClick={() => handleAction('approve')}
                  disabled={actionLoading}
                  className="text-[10px] rounded px-2 py-1 flex items-center gap-1 transition-all disabled:opacity-50"
                  style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.4)' }}
                >
                  <Check size={10} /> Aprovar
                </button>
                <button
                  onClick={() => handleAction('reject')}
                  disabled={actionLoading}
                  className="text-[10px] rounded px-2 py-1 flex items-center gap-1 transition-all disabled:opacity-50"
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)' }}
                >
                  <X size={10} /> Rejeitar
                </button>
                <button
                  onClick={() => handleAction('dismiss')}
                  disabled={actionLoading}
                  className="text-[10px] rounded px-2 py-1 flex items-center gap-1 transition-all disabled:opacity-50"
                  style={{ background: 'rgba(113,113,122,0.15)', color: '#a1a1aa', border: '1px solid rgba(113,113,122,0.4)' }}
                >
                  <X size={10} /> Descartar
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Review Card ─────────────────────────────────────────────────────────────

function ReviewCard({ review, onAction }: {
  review: CodeReview;
  onAction: (commentId: string, action: 'apply' | 'dismiss' | 'approve' | 'reject') => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<CodeReviewComment[] | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);

  const loadComments = useCallback(async (): Promise<void> => {
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/zcc/code-reviewer/reviews/${review.id}`);
      const data = await res.json();
      if (data.ok) setComments(data.data.comments);
    } finally {
      setLoadingComments(false);
    }
  }, [review.id]);

  const toggleExpand = (): void => {
    if (!expanded && !comments) {
      void loadComments();
    }
    setExpanded(!expanded);
  };

  return (
    <div
      className="rounded p-3 mb-2"
      style={{
        background: 'rgba(15,23,42,0.5)',
        border: '1px solid rgba(63,63,70,0.4)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded"
              style={{ background: `${severityColor(review.severity)}22`, color: severityColor(review.severity) }}
            >
              {severityIcon(review.severity)} {review.severity}
            </span>
            <span
              className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded"
              style={{ background: `${statusColor(review.status)}22`, color: statusColor(review.status) }}
            >
              {statusLabel(review.status)}
            </span>
            <span className="text-[9px] text-zinc-500 font-mono">{review.reviewMode}</span>
            <span className="text-[9px] text-zinc-600 font-mono">{review.scope}</span>
            <span className="text-[9px] text-zinc-600 font-mono">·</span>
            <span className="text-[9px] text-zinc-500">{formatTimeAgo(review.createdAt)}</span>
            <span className="text-[9px] text-zinc-600 font-mono">·</span>
            <span className="text-[9px] text-zinc-500">{review.mode}</span>
          </div>
          <div className="text-[11px] text-zinc-300 leading-relaxed">{review.highLevelSummary || '(sem resumo)'}</div>
          {review.errorMessage && (
            <div className="text-[10px] text-red-400 mt-1 font-mono">{review.errorMessage}</div>
          )}
          {review.status === 'completed' && (
            <div className="flex items-center gap-3 mt-2 text-[9px] text-zinc-500">
              <span>{review.stats.filesReviewed} arquivo(s)</span>
              <span>· {review.stats.totalComments} comentário(s)</span>
              {review.stats.criticalCount > 0 && <span style={{ color: '#ef4444' }}>· {review.stats.criticalCount} crítico(s)</span>}
              {review.stats.warningCount > 0 && <span style={{ color: '#f59e0b' }}>· {review.stats.warningCount} warning(s)</span>}
              <span>· {formatBytes(review.stats.bytesAnalyzed)}</span>
              <span>· ${review.costUsd.toFixed(4)}</span>
            </div>
          )}
        </div>
        {review.status === 'completed' && (
          <button onClick={toggleExpand} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mt-3"
          >
            {loadingComments && (
              <div className="text-[10px] text-zinc-500 flex items-center gap-2">
                <RefreshCw size={10} className="animate-spin" /> Carregando comentários...
              </div>
            )}
            {comments && comments.length === 0 && (
              <div className="text-[10px] text-zinc-500 italic">Nenhum comentário — código limpo!</div>
            )}
            {comments && comments.map((c) => (
              <CommentCard key={c.id} comment={c} onAction={onAction} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function CodeReviewerPanel() {
  const [reviews, setReviews] = useState<CodeReview[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [budget, setBudget] = useState<BudgetData | null>(null);
  const [rateLimits, setRateLimits] = useState<RateLimitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      const [listRes, statsRes] = await Promise.all([
        fetch(`/api/zcc/code-reviewer/reviews?limit=30${statusFilter ? `&status=${statusFilter}` : ''}`),
        fetch('/api/zcc/code-reviewer/stats'),
      ]);

      if (listRes.ok) {
        const data = await listRes.json();
        if (data.ok) setReviews(data.data.reviews);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        if (data.ok) {
          setStats(data.data.stats);
          setBudget(data.data.budget);
          setRateLimits(data.data.rateLimits);
        }
      }
    } catch (err) {
      console.error('[CodeReviewerPanel] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleAction = async (
    commentId: string,
    action: 'apply' | 'dismiss' | 'approve' | 'reject',
  ): Promise<void> => {
    try {
      const res = await fetch('/api/zcc/code-reviewer/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId, action }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      // Refresh local comments + stats
      await fetchData();
    } catch (err) {
      console.error('[CodeReviewerPanel] action error:', err);
      alert(`Erro: ${(err as Error).message}`);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
          <Code size={18} style={{ color: '#818cf8' }} />
          Code Reviewer
          <span className="text-[10px] font-normal text-zinc-500 ml-2">
            (inspirado em CodeRabbit · LLM GLM 5.2 embarcado)
          </span>
        </h2>
        <p className="text-[11px] text-zinc-500 mt-0.5">
          Revisão automatizada de código com análise de segurança, performance, bugs e boas práticas.
          Travas: budget mensal, rate limit, allowlist de paths, redação de segredos.
        </p>
      </div>

      <StatsHeader stats={stats} budget={budget} rateLimits={rateLimits} onRefresh={fetchData} />

      <ReviewTrigger onTriggered={fetchData} />

      {/* Filter */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] uppercase tracking-wider text-zinc-500">Filtro:</span>
        {['', 'completed', 'failed', 'running', 'dismissed'].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatusFilter(s)}
            className="text-[10px] rounded px-2 py-0.5 transition-all"
            style={{
              background: statusFilter === s ? 'rgba(129,140,248,0.15)' : 'rgba(15,23,42,0.4)',
              color: statusFilter === s ? '#a5b4fc' : '#71717a',
              border: `1px solid ${statusFilter === s ? 'rgba(129,140,248,0.4)' : 'rgba(63,63,70,0.4)'}`,
            }}
          >
            {s || 'Todos'}
          </button>
        ))}
      </div>

      {/* Reviews List */}
      <div>
        {loading && (
          <div className="text-xs text-zinc-500 flex items-center gap-2">
            <RefreshCw size={12} className="animate-spin" /> Carregando...
          </div>
        )}
        {!loading && reviews.length === 0 && (
          <div className="text-xs text-zinc-500 italic p-4 text-center">
            Nenhuma revisão encontrada. Dispare a primeira acima.
          </div>
        )}
        {reviews.map((r) => (
          <ReviewCard key={r.id} review={r} onAction={handleAction} />
        ))}
      </div>
    </div>
  );
}
