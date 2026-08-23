// ============================================================================
// ZÉLLA — ZéCode PR Review Script (GitHub Action Entry Point)
// ============================================================================
// Roda em GitHub Actions quando um PR é aberto/sincronizado.
// Reusa 100% do reviewer-service.ts (CodeRabbit-style) para:
//   1. Extrair diff do PR via git
//   2. Rodar quality gates (path allowlist, secret redaction, etc)
//   3. Persistir CodeReview + Comments no DB (se DATABASE_URL disponível)
//   4. Em modo live: chamar GLM 5.2 para análise profunda
//   5. Postar comentários no PR via GitHub API (Octokit)
//
// SAFETY LOCKS:
//   - Reusa code-reader.ts (allowlist ext, anti-traversal)
//   - Reusa secret-redactor.ts (redact antes de qualquer LLM)
//   - Reusa quality-gates.ts (budget, rate limit, path validation)
//   - Em modo mock: heurísticas apenas ($0)
//   - Em modo live: GLM 5.2 com JSON mode + budget guard
//   - Nunca aprova PR automaticamente (apenas comenta)
//
// CONFIGURAÇÃO (env vars no GitHub Action):
//   - GITHUB_TOKEN: automático no GitHub Actions
//   - DATABASE_URL: opcional (se vazio, pula persistência)
//   - CEREBRO_LIVE_MODE: 'true' para usar GLM 5.2
//   - GLM_5_2_API_KEY: chave da API GLM (apenas em live mode)
//   - PR_NUMBER: número do PR (passado pelo workflow)
// ============================================================================

import { Octokit } from '@octokit/rest';
import { getCodeReviewer } from '../src/lib/cerebro/code-reviewer/reviewer-service';
import { logSink } from '../src/lib/cerebro/log-sink';
import type { ReviewRequest } from '../src/lib/cerebro/code-reviewer/types';

// ── Helpers ─────────────────────────────────────────────────────────────────

function envOrThrow(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var obrigatória ausente: ${key}`);
  return v;
}

function envOr(key: string, def: string): string {
  return process.env[key] || def;
}

// ── Posta comentários no PR via GitHub API ──────────────────────────────────

async function postCommentsToPR(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  comments: Array<{
    filePath: string;
    startLine?: number | null;
    endLine?: number | null;
    category: string;
    severity: string;
    title: string;
    description: string;
    suggestedCode?: string | null;
    confidence: number;
  }>,
): Promise<{ posted: number; skipped: number }> {
  let posted = 0;
  let skipped = 0;

  for (const c of comments) {
    try {
      // Se tem line number, posta como review comment (inline)
      if (c.startLine && c.startLine > 0) {
        const body = formatCommentBody(c);
        await octokit.rest.pulls.createReviewComment({
          owner,
          repo,
          pull_number: prNumber,
          body,
          path: c.filePath,
          line: c.endLine || c.startLine,
          start_line: c.endLine && c.endLine !== c.startLine ? c.startLine : undefined,
        });
      } else {
        // Sem line number, posta como issue comment
        const body = formatIssueCommentBody(c);
        await octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number: prNumber,
          body,
        });
      }
      posted++;
    } catch (e) {
      logSink.warn({
        module: 'ze-code-pr-review',
        event: 'comment-post-failed',
        message: `Falha ao postar comentário: ${(e as Error).message}`,
        context: { filePath: c.filePath, line: c.startLine },
      });
      skipped++;
    }
  }

  return { posted, skipped };
}

function formatCommentBody(c: {
  category: string;
  severity: string;
  title: string;
  description: string;
  suggestedCode?: string | null;
  confidence: number;
}): string {
  const severityIcon = (sev: string): string => {
    switch (sev) {
      case 'emergency': return '🚨';
      case 'critical': return '🔴';
      case 'warning': return '🟡';
      case 'info': return '🔵';
      default: return 'ℹ️';
    }
  };

  const lines: string[] = [
    `### ${severityIcon(c.severity)} ${c.title}`,
    '',
    `**Categoria:** \`${c.category}\` · **Severidade:** \`${c.severity}\` · **Confiança:** ${(c.confidence * 100).toFixed(0)}%`,
    '',
    c.description,
  ];

  if (c.suggestedCode) {
    lines.push('', '**Sugestão:**', '```ts', c.suggestedCode, '```');
  }

  lines.push('', '---', '_Gerado pelo ZéCode (DEV FULL STACK interno) em modo ' + (process.env.CEREBRO_LIVE_MODE === 'true' ? 'live (GLM 5.2)' : 'mock (heurística)') + '_');

  return lines.join('\n');
}

function formatIssueCommentBody(c: {
  filePath: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  suggestedCode?: string | null;
  confidence: number;
}): string {
  return `### 🤖 ZéCode Review — ${c.filePath}

${formatCommentBody(c)}`;
}

// ── Posta walkthrough summary como issue comment ────────────────────────────

async function postWalkthrough(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  walkthrough: string,
  stats: {
    filesReviewed: number;
    totalComments: number;
    criticalCount: number;
    warningCount: number;
    emergencyCount: number;
    costUsd: number;
    mode: 'mock' | 'live';
  },
): Promise<void> {
  const body = `## 🤖 ZéCode Walkthrough

${walkthrough}

### Estatísticas
- **Arquivos revisados:** ${stats.filesReviewed}
- **Comentários gerados:** ${stats.totalComments}
- **🚨 Emergências:** ${stats.emergencyCount}
- **🔴 Críticos:** ${stats.criticalCount}
- **🟡 Warnings:** ${stats.warningCount}
- **Modo:** \`${stats.mode}\` ${stats.mode === 'live' ? `(GLM 5.2 · $${stats.costUsd.toFixed(4)})` : '(heurística · $0)'}

---
_Powered by ZéCode · [SmartHotel Zehla](https://github.com/MarcioCau14/SmartHotel_Zehla)_`;

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body,
  });
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startTime = Date.now();

  logSink.info({
    module: 'ze-code-pr-review',
    event: 'started',
    message: 'ZéCode PR Review script started',
    context: {
      prNumber: process.env.PR_NUMBER,
      liveMode: process.env.CEREBRO_LIVE_MODE === 'true',
      hasDb: !!process.env.DATABASE_URL,
      hasGlm: !!process.env.GLM_5_2_API_KEY,
    },
  });

  // Validar env vars
  const githubToken = envOrThrow('GITHUB_TOKEN');
  const prNumberStr = envOrThrow('PR_NUMBER');
  const prNumber = parseInt(prNumberStr, 10);
  if (isNaN(prNumber) || prNumber <= 0) {
    throw new Error(`PR_NUMBER inválido: ${prNumberStr}`);
  }

  // Owner/Repo do evento
  const owner = envOr('GITHUB_REPOSITORY_OWNER', 'MarcioCau14');
  const repo = (process.env.GITHUB_REPOSITORY || 'MarcioCau14/SmartHotel_Zehla').split('/')[1] || 'SmartHotel_Zehla';

  const octokit = new Octokit({ auth: githubToken });

  // Buscar info do PR (base, head, files)
  const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number: prNumber });

  logSink.info({
    module: 'ze-code-pr-review',
    event: 'pr-fetched',
    message: `PR #${prNumber}: ${pr.title} — ${pr.changed_files} files, +${pr.additions} -${pr.deletions}`,
    context: {
      prNumber,
      title: pr.title,
      head: pr.head.ref,
      base: pr.base.ref,
      changedFiles: pr.changed_files,
      additions: pr.additions,
      deletions: pr.deletions,
    },
  });

  // Constrói ReviewRequest em modo diff
  const reviewReq: ReviewRequest = {
    mode: 'diff',
    target: pr.base.ref, // diff contra base branch
    maxFiles: 30,
    forceLive: process.env.CEREBRO_LIVE_MODE === 'true',
    triggeredBy: 'github-actions[bot]',
  };

  // Roda review (reusa reviewer-service.ts)
  const reviewer = getCodeReviewer();
  const result = await reviewer.review(reviewReq);

  logSink.info({
    module: 'ze-code-pr-review',
    event: 'review-completed',
    message: `Review concluída: ${result.comments.length} comentários — severity=${result.severity}`,
    context: {
      prNumber,
      commentsCount: result.comments.length,
      criticalCount: result.stats.criticalCount,
      warningCount: result.stats.warningCount,
      emergencyCount: result.stats.emergencyCount,
      costUsd: result.stats.costUsd,
      mode: result.mode,
      durationMs: Date.now() - startTime,
    },
  });

  // Posta walkthrough
  await postWalkthrough(octokit, owner, repo, prNumber, result.highLevelSummary, {
    filesReviewed: result.stats.filesReviewed,
    totalComments: result.stats.totalComments,
    criticalCount: result.stats.criticalCount,
    warningCount: result.stats.warningCount,
    emergencyCount: result.stats.emergencyCount,
    costUsd: result.stats.costUsd,
    mode: result.mode,
  });

  // Posta comentários individuais (limite de 50 para evitar spam)
  const commentsToPost = result.comments.slice(0, 50);
  const postResult = await postCommentsToPR(octokit, owner, repo, prNumber, commentsToPost);

  logSink.info({
    module: 'ze-code-pr-review',
    event: 'comments-posted',
    message: `Posted ${postResult.posted} comments to PR #${prNumber} (skipped: ${postResult.skipped})`,
    context: {
      prNumber,
      posted: postResult.posted,
      skipped: postResult.skipped,
      totalComments: result.comments.length,
      truncated: result.comments.length > 50,
    },
  });

  // Se há emergências, adiciona label
  if (result.stats.emergencyCount > 0) {
    try {
      await octokit.rest.issues.addLabels({
        owner,
        repo,
        issue_number: prNumber,
        labels: ['zécode:emergency', 'needs-human-review'],
      });
    } catch (e) {
      logSink.warn({
        module: 'ze-code-pr-review',
        event: 'label-failed',
        message: `Falha ao adicionar label: ${(e as Error).message}`,
      });
    }
  } else if (result.stats.criticalCount > 0) {
    try {
      await octokit.rest.issues.addLabels({
        owner,
        repo,
        issue_number: prNumber,
        labels: ['zécode:critical', 'needs-human-review'],
      });
    } catch (e) {
      logSink.warn({
        module: 'ze-code-pr-review',
        event: 'label-failed',
        message: `Falha ao adicionar label: ${(e as Error).message}`,
      });
    }
  }

  logSink.info({
    module: 'ze-code-pr-review',
    event: 'completed',
    message: `ZéCode PR Review completed in ${Date.now() - startTime}ms`,
    context: {
      prNumber,
      durationMs: Date.now() - startTime,
      totalComments: result.comments.length,
      posted: postResult.posted,
    },
  });

  // Exit code: 1 se há emergências (para bloquear merge via status check)
  if (result.stats.emergencyCount > 0) {
    console.log('::error::ZéCode detectou EMERGENCES — review manual obrigatório');
    process.exit(1);
  }

  console.log('::notice::ZéCode PR Review completed successfully');
}

main().catch((e) => {
  logSink.error({
    module: 'ze-code-pr-review',
    event: 'fatal-error',
    message: `ZéCode PR Review falhou: ${(e as Error).message}`,
    stack: (e as Error).stack,
  });
  console.error('::error::ZéCode PR Review falhou:', (e as Error).message);
  // Não falha o workflow — apenas loga. Review é informativo.
  process.exit(0);
});
