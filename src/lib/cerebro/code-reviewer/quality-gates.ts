// ============================================================================
// ZÉLLA — Quality Gates (Code Reviewer — Travas Precisas)
// ============================================================================
// Gates OBRIGATÓRIOS executados ANTES de qualquer chamada ao LLM.
// Qualquer falha aqui aborta a revisão — nada é processado.
//
// FILOSOFIA: "Fail closed, log everything."
//
// GATES IMPLEMENTADOS:
//  1. Budget cap mensal (reusa CEREBRO_MONTHLY_BUDGET_USD = $20)
//  2. Rate limiting (max 5 revisões/min, 50/hora)
//  3. Max files por revisão (default 10, hard cap 30)
//  4. Path allowlist (já feita em code-reader)
//  5. File size cap (já feito em code-reader: 100KB)
//  6. Diff size cap (já feito em diff-extractor: 200KB)
//  7. Request validation (target obrigatório, mode válido)
// ============================================================================

import { db } from '@/lib/db';
import { logSink } from '../log-sink';
import {
  REVIEW_MODES,
  type QualityGateResult,
  type ReviewRequest,
  type ReviewMode,
} from './types';

// ── Configuração ────────────────────────────────────────────────────────────

const RATE_LIMIT_PER_MIN = 5;
const RATE_LIMIT_PER_HOUR = 50;
const MAX_FILES_DEFAULT = 10;
const MAX_FILES_HARD_CAP = 30;
const COST_ESTIMATE_PER_FILE_USD = 0.003; // ~3 mil input tokens por arquivo

// ── Rate limiter in-memory (por processo) ───────────────────────────────────

const reviewTimestamps: number[] = [];
const reviewTimestampsHour: number[] = [];

function checkRateLimit(): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const oneMinAgo = now - 60_000;
  const oneHourAgo = now - 3_600_000;

  // Limpa expirados
  while (reviewTimestamps.length > 0 && reviewTimestamps[0] < oneMinAgo) {
    reviewTimestamps.shift();
  }
  while (reviewTimestampsHour.length > 0 && reviewTimestampsHour[0] < oneHourAgo) {
    reviewTimestampsHour.shift();
  }

  if (reviewTimestamps.length >= RATE_LIMIT_PER_MIN) {
    return {
      allowed: false,
      reason: `Rate limit: máximo ${RATE_LIMIT_PER_MIN} revisões/min`,
    };
  }

  if (reviewTimestampsHour.length >= RATE_LIMIT_PER_HOUR) {
    return {
      allowed: false,
      reason: `Rate limit: máximo ${RATE_LIMIT_PER_HOUR} revisões/hora`,
    };
  }

  // Registra este timestamp
  reviewTimestamps.push(now);
  reviewTimestampsHour.push(now);

  return { allowed: true };
}

// ── Budget checker (reusa Cérebro) ──────────────────────────────────────────

async function checkBudget(estimatedCostUsd: number): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // Soma custo de todas CodeReviews + CerebroAnalyses do mês atual
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [codeReviewsSum, cerebroSum] = await Promise.all([
      db.codeReview.aggregate({
        _sum: { costUsd: true },
        where: { createdAt: { gte: startOfMonth } },
      }),
      db.cerebroAnalysis.aggregate({
        _sum: { costUsd: true },
        where: { createdAt: { gte: startOfMonth } },
      }),
    ]);

    const monthlyBudgetUsd = parseFloat(process.env.CEREBRO_MONTHLY_BUDGET_USD || '20');
    const spent =
      (codeReviewsSum._sum.costUsd ?? 0) + (cerebroSum._sum.costUsd ?? 0);
    const remaining = monthlyBudgetUsd - spent;

    if (remaining <= 0) {
      return {
        allowed: false,
        reason: `Budget mensal esgotado: $${spent.toFixed(4)} / $${monthlyBudgetUsd.toFixed(2)}`,
      };
    }

    if (estimatedCostUsd > remaining) {
      return {
        allowed: false,
        reason: `Custo estimado $${estimatedCostUsd.toFixed(4)} excede budget restante $${remaining.toFixed(4)}`,
      };
    }

    return { allowed: true };
  } catch {
    // DB indisponível — fail OPEN mas loga
    logSink.warn({
      module: 'code-reviewer',
      event: 'budget_check_failed',
      message: 'Falha ao consultar budget — fail open com aviso',
    });
    return { allowed: true };
  }
}

// ── Helper: validar request ────────────────────────────────────────────────

function validateRequest(req: Partial<ReviewRequest>): { ok: boolean; reason?: string; mode?: ReviewMode; target?: string } {
  if (!req.mode || !REVIEW_MODES.includes(req.mode)) {
    return { ok: false, reason: `mode inválido (deve ser um de: ${REVIEW_MODES.join(', ')})` };
  }
  if (!req.target || typeof req.target !== 'string' || req.target.trim().length === 0) {
    return { ok: false, reason: 'target obrigatório' };
  }
  // No path traversal
  if (req.target.includes('..')) {
    return { ok: false, reason: 'target não pode conter ".."' };
  }
  return { ok: true, mode: req.mode, target: req.target };
}

// ── Helper: normalizar maxFiles ─────────────────────────────────────────────

function normalizeMaxFiles(req: ReviewRequest): number {
  const requested = req.maxFiles ?? MAX_FILES_DEFAULT;
  return Math.min(Math.max(1, requested), MAX_FILES_HARD_CAP);
}

// ── Helper: validar padrões de inclusão/exclusão ───────────────────────────

function validatePatterns(patterns: string[] | undefined): { ok: boolean; reason?: string } {
  if (!patterns) return { ok: true };
  if (!Array.isArray(patterns)) {
    return { ok: false, reason: 'patterns deve ser array de strings' };
  }
  for (const p of patterns) {
    if (typeof p !== 'string' || p.length > 500) {
      return { ok: false, reason: 'padrão inválido (string > 500 chars)' };
    }
    // Rejeita tentativas de regex injection (apenas globs simples permitidos)
    if (/[\\^$()|]/.test(p)) {
      return { ok: false, reason: `padrão contém caracteres não permitidos: ${p}` };
    }
  }
  return { ok: true };
}

// ── Main: runQualityGates ───────────────────────────────────────────────────

export async function runQualityGates(req: Partial<ReviewRequest>): Promise<QualityGateResult> {
  // 1. Validar request shape
  const validation = validateRequest(req);
  if (!validation.ok) {
    return {
      allowed: false,
      failure: 'invalid_request',
      reason: validation.reason,
      filesConsidered: 0,
      filesAllowed: 0,
    };
  }

  // 2. Validar patterns
  const incOk = validatePatterns(req.includePatterns);
  if (!incOk.ok) {
    return {
      allowed: false,
      failure: 'invalid_request',
      reason: incOk.reason,
      filesConsidered: 0,
      filesAllowed: 0,
    };
  }
  const excOk = validatePatterns(req.excludePatterns);
  if (!excOk.ok) {
    return {
      allowed: false,
      failure: 'invalid_request',
      reason: excOk.reason,
      filesConsidered: 0,
      filesAllowed: 0,
    };
  }

  // 3. Rate limit
  const rate = checkRateLimit();
  if (!rate.allowed) {
    return {
      allowed: false,
      failure: 'rate_limited',
      reason: rate.reason,
      filesConsidered: 0,
      filesAllowed: 0,
    };
  }

  // 4. Calcular custo estimado
  const maxFiles = normalizeMaxFiles(req as ReviewRequest);
  const estimatedCostUsd = maxFiles * COST_ESTIMATE_PER_FILE_USD;

  // 5. Budget check
  const budget = await checkBudget(estimatedCostUsd);
  if (!budget.allowed) {
    return {
      allowed: false,
      failure: 'budget_exhausted',
      reason: budget.reason,
      filesConsidered: 0,
      filesAllowed: 0,
    };
  }

  return {
    allowed: true,
    filesConsidered: maxFiles,
    filesAllowed: maxFiles,
  };
}

// ── Export de constantes para auditoria ────────────────────────────────────

export const QUALITY_GATE_LIMITS = {
  RATE_LIMIT_PER_MIN,
  RATE_LIMIT_PER_HOUR,
  MAX_FILES_DEFAULT,
  MAX_FILES_HARD_CAP,
  COST_ESTIMATE_PER_FILE_USD,
  MONTHLY_BUDGET_USD: parseFloat(process.env.CEREBRO_MONTHLY_BUDGET_USD || '20'),
} as const;

// ── Helper: obter stats de rate limit (para UI) ─────────────────────────────

export function getRateLimitStats(): {
  reviewsLastMin: number;
  reviewsLastHour: number;
  limitPerMin: number;
  limitPerHour: number;
} {
  const now = Date.now();
  const oneMinAgo = now - 60_000;
  const oneHourAgo = now - 3_600_000;

  return {
    reviewsLastMin: reviewTimestamps.filter((t) => t > oneMinAgo).length,
    reviewsLastHour: reviewTimestampsHour.filter((t) => t > oneHourAgo).length,
    limitPerMin: RATE_LIMIT_PER_MIN,
    limitPerHour: RATE_LIMIT_PER_HOUR,
  };
}

// ── Helper: obter budget stats (para UI) ─────────────────────────────────────

export async function getBudgetStats(): Promise<{
  spentUsd: number;
  budgetUsd: number;
  remainingUsd: number;
  percentUsed: number;
}> {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [codeReviewsSum, cerebroSum] = await Promise.all([
      db.codeReview.aggregate({
        _sum: { costUsd: true },
        where: { createdAt: { gte: startOfMonth } },
      }),
      db.cerebroAnalysis.aggregate({
        _sum: { costUsd: true },
        where: { createdAt: { gte: startOfMonth } },
      }),
    ]);

    const budgetUsd = parseFloat(process.env.CEREBRO_MONTHLY_BUDGET_USD || '20');
    const spent =
      (codeReviewsSum._sum.costUsd ?? 0) + (cerebroSum._sum.costUsd ?? 0);

    return {
      spentUsd: Math.round(spent * 10000) / 10000,
      budgetUsd,
      remainingUsd: Math.round((budgetUsd - spent) * 10000) / 10000,
      percentUsed: Math.round((spent / budgetUsd) * 10000) / 100,
    };
  } catch {
    return {
      spentUsd: 0,
      budgetUsd: parseFloat(process.env.CEREBRO_MONTHLY_BUDGET_USD || '20'),
      remainingUsd: parseFloat(process.env.CEREBRO_MONTHLY_BUDGET_USD || '20'),
      percentUsed: 0,
    };
  }
}
