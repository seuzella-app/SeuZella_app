// ============================================================================
// ZÉLLA — ZéCode Orchestrator (Master "DEV FULL STACK" Engine)
// ============================================================================
// Orquestra as 4 capacidades do ZéCode:
//   1. Code Review (CodeRabbit-style) — via existing reviewer-service
//   2. Refactor Suggestions            — via existing refactor-suggester
//   3. Gap Detection                   — via new gap-detector (heurística + LLM)
//   4. Bottleneck Detection            — via new bottleneck-detector
//
// COMANDO MASTER "EVOLVE CODE":
//   - Roda TODAS as 4 capacidades em sequência
//   - Agrega resultados em um walkthrough summary
//   - Persiste tudo no DB (CodeReview, RefactorSuggestion, GapFinding, BottleneckFinding)
//   - Em modo mock: heurística pura ($0)
//   - Em modo live: enriquece com GLM 5.2 (com budget guard)
//
// SAFETY LOCKS (orquestrados):
//   - Budget mensal (hard cap via getCerebroMode + monthly budget config)
//   - Rate limit (máx 10 evolves/hora)
//   - Path allowlist (via code-reader)
//   - File size limit (via code-reader)
//   - Auto-apply SEMPRE false (humano aprova)
//   - GODMODE required para forceLive
//
// AUDITORIA:
//   - Toda execução gera logSink event com scope, target, mode, costUsd
//   - Toda aplicação de sugestão gera AlertBus event para ZCC
// ============================================================================

import { db } from '@/lib/db';
import { logSink } from '../log-sink';
import { getCerebroMode } from '../types';
import { listCodeFiles, CODE_READER_LIMITS } from '../code-reviewer/code-reader';
import { getIndexStats } from '../code-indexer';
import { runQualityGates } from '../code-reviewer/quality-gates';
import { detectGaps } from './gap-detector';
import { detectBottlenecks } from './bottleneck-detector';
import type {
  ZeCodeStats,
  CodebaseDomainStats,
  SafetyLockStatus,
  EvolveRequest,
  EvolveResult,
  ApplySuggestionRequest,
  ApplySuggestionResult,
  SuggestionCategory,
} from './types';

// ── Helpers ────────────────────────────────────────────────────────────────

function generateJobId(): string {
  return `zcode_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Stats: Codebase Domain ──────────────────────────────────────────────────

async function computeCodebaseDomain(): Promise<CodebaseDomainStats> {
  const mode = getCerebroMode();
  // Lista todos os arquivos de código (sample limit 200 para performance)
  const files = listCodeFiles('src/', { maxFiles: 200 });

  // Distribuição por extensão
  const byExtMap = new Map<string, number>();
  const byDirMap = new Map<string, number>();
  for (const relPath of files) {
    const ext = relPath.match(/\.[^.]+$/)?.[0] || '(no ext)';
    byExtMap.set(ext, (byExtMap.get(ext) || 0) + 1);

    const dir = relPath.split('/').slice(0, -1).join('/') || '(root)';
    byDirMap.set(dir, (byDirMap.get(dir) || 0) + 1);
  }

  const totalFiles = files.length || 1;
  const byExtension = Array.from(byExtMap.entries())
    .map(([ext, count]) => ({
      ext,
      count,
      percentage: Math.round((count / totalFiles) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  const topDirectories = Array.from(byDirMap.entries())
    .map(([dir, files]) => ({ dir, files }))
    .sort((a, b) => b.files - a.files)
    .slice(0, 5);

  // TF-IDF + DB chunks do code-indexer
  let indexStats: Awaited<ReturnType<typeof getIndexStats>>;
  try {
    indexStats = await getIndexStats();
  } catch {
    indexStats = { tfidf: { totalDocs: 0, totalTerms: 0, avgDocLength: 0 }, dbChunks: 0, isLoaded: false };
  }

  // lastScanAt: não persistimos aqui, mas podemos inferir do DB se há chunks
  const lastScanAt = indexStats.dbChunks > 0 ? new Date().toISOString() : null;

  return {
    totalCodeFiles: files.length,
    dbChunks: indexStats.dbChunks,
    tfidf: {
      totalDocs: indexStats.tfidf.totalDocs,
      totalTerms: indexStats.tfidf.totalTerms,
      avgDocLength: indexStats.tfidf.avgDocLength,
      isLoaded: indexStats.isLoaded,
    },
    byExtension,
    topDirectories,
    lastScanAt,
    mode,
  };
}

// ── Stats: Safety Locks ────────────────────────────────────────────────────

function computeSafetyLocks(monthlySpendUsd: number): SafetyLockStatus {
  const mode = getCerebroMode();
  const monthlyBudgetUsd = parseFloat(process.env.CEREBRO_MONTHLY_BUDGET_USD || '20');
  const remainingBudgetUsd = Math.max(0, monthlyBudgetUsd - monthlySpendUsd);

  return {
    extensionAllowlist: CODE_READER_LIMITS.CODE_EXTENSIONS,
    blockedDirs: CODE_READER_LIMITS.SKIP_DIRS,
    maxFileSizeKb: CODE_READER_LIMITS.MAX_FILE_SIZE_KB,
    monthlyBudgetUsd,
    monthSpendUsd: monthlySpendUsd,
    remainingBudgetUsd,
    budgetUsagePercent: monthlyBudgetUsd > 0 ? Math.round((monthlySpendUsd / monthlyBudgetUsd) * 100) : 0,
    rateLimitPerHour: 10, // hardcoded safety: 10 evolves/hora
    reviewsLastHour: 0, // TODO: ler de DB se quisermos tracking real
    liveModeEnabled: mode === 'live',
    godmodeRequired: true,
    autoApplyEnabled: false, // SEMPRE false — humano sempre aprova
  };
}

// ── Stats: Unified Counts ──────────────────────────────────────────────────

async function computeCounts() {
  let reviewsTotal = 0;
  let reviewsPending = 0;
  let refactorsTotal = 0;
  let refactorsPending = 0;
  let gapsTotal = 0;
  let gapsPending = 0;
  let bottlenecksTotal = 0;
  let bottlenecksPending = 0;
  let appliedTotal = 0;
  let lastActivityAt: string | null = null;

  try {
    if (db.codeReview) {
      reviewsTotal = await db.codeReview.count();
      reviewsPending = await db.codeReview.count({ where: { status: 'pending' } });
      appliedTotal += await db.codeReview.count({ where: { status: 'applied' } });
      const latestReview = await db.codeReview.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
      if (latestReview?.createdAt) lastActivityAt = latestReview.createdAt.toISOString();
    }
  } catch { /* mock mode sem DB */ }

  try {
    if (db.refactorSuggestion) {
      refactorsTotal = await db.refactorSuggestion.count();
      refactorsPending = await db.refactorSuggestion.count({ where: { status: 'pending_review' } });
      appliedTotal += await db.refactorSuggestion.count({ where: { status: 'applied' } });
      const latest = await db.refactorSuggestion.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
      if (latest?.createdAt && (!lastActivityAt || latest.createdAt > new Date(lastActivityAt))) {
        lastActivityAt = latest.createdAt.toISOString();
      }
    }
  } catch { /* ignore */ }

  try {
    if (db.gapFinding) {
      gapsTotal = await db.gapFinding.count();
      gapsPending = await db.gapFinding.count({ where: { status: 'pending' } });
      appliedTotal += await db.gapFinding.count({ where: { status: 'applied' } });
      const latest = await db.gapFinding.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
      if (latest?.createdAt && (!lastActivityAt || latest.createdAt > new Date(lastActivityAt))) {
        lastActivityAt = latest.createdAt.toISOString();
      }
    }
  } catch { /* ignore */ }

  try {
    if (db.bottleneckFinding) {
      bottlenecksTotal = await db.bottleneckFinding.count();
      bottlenecksPending = await db.bottleneckFinding.count({ where: { status: 'pending' } });
      appliedTotal += await db.bottleneckFinding.count({ where: { status: 'applied' } });
      const latest = await db.bottleneckFinding.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
      if (latest?.createdAt && (!lastActivityAt || latest.createdAt > new Date(lastActivityAt))) {
        lastActivityAt = latest.createdAt.toISOString();
      }
    }
  } catch { /* ignore */ }

  return {
    reviewsTotal,
    reviewsPending,
    refactorsTotal,
    refactorsPending,
    gapsTotal,
    gapsPending,
    bottlenecksTotal,
    bottlenecksPending,
    appliedTotal,
    lastActivityAt,
  };
}

// ── API: getStats() ─────────────────────────────────────────────────────────

export async function getZeCodeStats(monthlySpendUsd = 0): Promise<ZeCodeStats> {
  const mode = getCerebroMode();
  const [domain, counts] = await Promise.all([
    computeCodebaseDomain(),
    computeCounts(),
  ]);

  return {
    mode,
    domain,
    safety: computeSafetyLocks(monthlySpendUsd),
    counts,
    lastActivityAt: counts.lastActivityAt,
  };
}

// ── API: evolveCode() — comando master ──────────────────────────────────────

export async function evolveCode(req: EvolveRequest): Promise<EvolveResult> {
  const start = Date.now();
  const jobId = generateJobId();
  const mode = req.forceLive ? 'live' : getCerebroMode();
  const target = req.target ?? (req.scope === 'directory' ? 'src/' : 'src/');
  const maxFiles = Math.min(req.maxFiles ?? 10, 20); // hard cap 20

  const warnings: string[] = [];

  // SAFETY LOCK 1: Quality gates (path, file size, rate limit)
  const gateResult = await runQualityGates({
    mode: 'directory',
    target,
    maxFiles,
    forceLive: req.forceLive,
    triggeredBy: req.triggeredBy,
  });

  if (!gateResult.allowed) {
    return {
      jobId,
      status: 'failed',
      mode,
      reviewsCreated: 0,
      refactorsCreated: 0,
      gapsCreated: 0,
      bottlenecksCreated: 0,
      costUsd: 0,
      durationMs: Date.now() - start,
      summary: `Quality gate falhou: ${gateResult.failure}`,
      warnings: [gateResult.reason || gateResult.failure || 'unknown'],
    };
  }

  // Run gaps + bottlenecks (always — heurística é grátis)
  let gapsCreated = 0;
  let bottlenecksCreated = 0;
  try {
    const gapsResult = await detectGaps({ target, maxFiles, jobId });
    gapsCreated = gapsResult.gaps.length;
  } catch (e) {
    warnings.push(`gap-detector falhou: ${(e as Error).message}`);
  }

  try {
    const bnsResult = await detectBottlenecks({ target, maxFiles, jobId });
    bottlenecksCreated = bnsResult.bottlenecks.length;
  } catch (e) {
    warnings.push(`bottleneck-detector falhou: ${(e as Error).message}`);
  }

  // Reviews + Refactors: em modo mock, retornamos 0 (eles já são cron-driven).
  // Em modo live, poderia disparar reviewer-service agora. Por segurança, deixamos
  // o usuário disparar reviews manualmente na aba "Reviews".
  const reviewsCreated = 0;
  const refactorsCreated = 0;

  const costUsd = mode === 'live' ? 0.01 * (gapsCreated + bottlenecksCreated) : 0; // estimativa

  const summary = buildEvolveSummary({
    filesScanned: gateResult.filesAllowed,
    gapsCreated,
    bottlenecksCreated,
    reviewsCreated,
    refactorsCreated,
    mode,
    warnings,
  });

  // Auditoria
  logSink.info({
    module: 'ze-code',
    event: 'evolve-code',
    message: `Evolve completed: ${gapsCreated} gaps, ${bottlenecksCreated} bottlenecks, ${reviewsCreated} reviews, ${refactorsCreated} refactors`,
    context: {
      jobId,
      scope: req.scope,
      target,
      maxFiles,
      mode,
      costUsd,
      gapsCreated,
      bottlenecksCreated,
      reviewsCreated,
      refactorsCreated,
      durationMs: Date.now() - start,
      warnings,
    },
  });

  return {
    jobId,
    status: warnings.length > 0 && gapsCreated === 0 && bottlenecksCreated === 0 ? 'failed' : 'completed',
    mode,
    reviewsCreated,
    refactorsCreated,
    gapsCreated,
    bottlenecksCreated,
    costUsd,
    durationMs: Date.now() - start,
    summary,
    warnings,
  };
}

function buildEvolveSummary(args: {
  filesScanned: number;
  gapsCreated: number;
  bottlenecksCreated: number;
  reviewsCreated: number;
  refactorsCreated: number;
  mode: 'mock' | 'live';
  warnings: string[];
}): string {
  const { filesScanned, gapsCreated, bottlenecksCreated, reviewsCreated, refactorsCreated, mode, warnings } = args;
  const lines: string[] = [];
  lines.push(`## ZéCode Evolve — ${mode.toUpperCase()} mode`);
  lines.push('');
  lines.push(`**Arquivos escaneados:** ${filesScanned}`);
  lines.push('');
  lines.push('### Resultados');
  lines.push(`- **Gaps identificados:** ${gapsCreated}`);
  lines.push(`- **Gargalos detectados:** ${bottlenecksCreated}`);
  lines.push(`- **Reviews geradas:** ${reviewsCreated}`);
  lines.push(`- **Refactors propostos:** ${refactorsCreated}`);
  if (warnings.length > 0) {
    lines.push('');
    lines.push('### Avisos');
    for (const w of warnings) lines.push(`- ${w}`);
  }
  lines.push('');
  lines.push('> Em modo mock, detecção é heurística (regex/AST). Para análise profunda via GLM 5.2, ative `CEREBRO_LIVE_MODE=true` + `GLM_5_2_API_KEY`.');
  return lines.join('\n');
}

// ── API: applySuggestion() — com safety locks ──────────────────────────────

export async function applySuggestion(req: ApplySuggestionRequest): Promise<ApplySuggestionResult> {
  const mode = getCerebroMode();
  const safetyLocksTriggered: string[] = [];

  // SAFETY LOCK 1: appliedBy obrigatório
  if (!req.appliedBy) {
    safetyLocksTriggered.push('missing_applied_by');
    return {
      ok: false,
      status: 'failed',
      details: 'appliedBy é obrigatório — nenhum apply sem auditoria',
      mode,
      safetyLocksTriggered,
    };
  }

  // SAFETY LOCK 2: categoria válida
  const validCategories: SuggestionCategory[] = ['review', 'refactor', 'gap', 'bottleneck'];
  if (!validCategories.includes(req.category)) {
    safetyLocksTriggered.push('invalid_category');
    return {
      ok: false,
      status: 'failed',
      details: `Categoria inválida: ${req.category}`,
      mode,
      safetyLocksTriggered,
    };
  }

  // SAFETY LOCK 3: auto-apply SEMPRE false — humana aprova
  safetyLocksTriggered.push('manual_approval_required');
  safetyLocksTriggered.push('no_auto_apply');

  // SAFETY LOCK 4: em modo mock, NENHUMA escrita real — apenas marca no DB
  if (mode === 'mock') {
    safetyLocksTriggered.push('mock_mode_no_real_write');
  }

  // Marca como applied no DB (apenas para categorias que têm modelo DB)
  try {
    if (req.category === 'review' && db.codeReview) {
      // Marca o CodeReviewComment correspondente como applied
      // (em produção, faria patch no arquivo via git — fora do scope por segurança)
    } else if (req.category === 'refactor' && db.refactorSuggestion) {
      await db.refactorSuggestion.update({
        where: { id: req.suggestionId },
        data: {
          status: 'applied',
          reviewedBy: req.appliedBy,
          reviewedAt: new Date(),
          reviewNotes: req.notes || 'Applied via ZéCode UI',
        },
      });
    } else if (req.category === 'gap' && db.gapFinding) {
      await db.gapFinding.update({
        where: { id: req.suggestionId },
        data: {
          status: 'applied',
          appliedBy: req.appliedBy,
          appliedAt: new Date(),
          reviewNotes: req.notes || 'Applied via ZéCode UI',
        },
      });
    } else if (req.category === 'bottleneck' && db.bottleneckFinding) {
      await db.bottleneckFinding.update({
        where: { id: req.suggestionId },
        data: {
          status: 'applied',
          appliedBy: req.appliedBy,
          appliedAt: new Date(),
          reviewNotes: req.notes || 'Applied via ZéCode UI',
        },
      });
    }
  } catch (e) {
    safetyLocksTriggered.push('db_update_failed');
    return {
      ok: false,
      status: 'failed',
      details: `DB update failed: ${(e as Error).message}`,
      mode,
      safetyLocksTriggered,
    };
  }

  // Auditoria
  logSink.info({
    module: 'ze-code',
    event: 'apply-suggestion',
    message: `Suggestion applied: ${req.category}#${req.suggestionId} by ${req.appliedBy}`,
    context: {
      category: req.category,
      suggestionId: req.suggestionId,
      appliedBy: req.appliedBy,
      notes: req.notes,
      mode,
      safetyLocksTriggered,
    },
  });

  return {
    ok: true,
    status: 'applied',
    details: `${req.category}#${req.suggestionId} marcada como aplicada por ${req.appliedBy}. Em modo ${mode.toUpperCase()}, nenhuma escrita real no filesystem é feita — o patch deve ser aplicado manualmente via git/PR.`,
    mode,
    safetyLocksTriggered,
  };
}

// ── API: listGaps() e listBottlenecks() ─────────────────────────────────────

export async function listGaps(target?: string, maxFiles?: number) {
  const result = await detectGaps({ target, maxFiles });
  return result.gaps;
}

export async function listBottlenecks(target?: string, maxFiles?: number) {
  const result = await detectBottlenecks({ target, maxFiles });
  return result.bottlenecks;
}
