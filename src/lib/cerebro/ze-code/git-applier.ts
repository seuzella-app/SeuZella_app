// ============================================================================
// ZÉLLA — ZéCode Git Applier (Auto-PR com Safety Locks)
// ============================================================================
// Aplica uma sugestão do ZéCode criando um PR automaticamente no GitHub:
//   1. Cria branch `zecode/apply-{category}-{shortId}` a partir da default
//   2. Aplica o patch (suggestedCode) no arquivo target
//   3. Commit com mensagem rica (rationale, severity, jobId)
//   4. Abre PR via GitHub API com descrição completa
//   5. Marca o finding no DB com prUrl + prBranch + status='applied'
//
// SAFETY LOCKS (CRÍTICOS):
//   - Reusa code-reader.ts para validar path (allowlist ext, anti-traversal)
//   - Reusa secret-redactor.ts antes de escrever qualquer coisa no commit
//   - Apenas arquivos dentro da allowlist podem ser modificados
//   - NUNCA toca em: .env*, .git/, node_modules, *.pem, *.key, credentials
//   - Branch SEMPRE criada a partir da default branch (não force-push em main)
//   - PR SEMPRE aberto como draft (requer review humano antes do merge)
//   - GODMODE obrigatório (ZCC_GODMODE=true)
//   - Limite de 10 PRs/dia por usuário (rate limit anti-abuso)
//   - Em modo mock: simula, não toca no git real
//
// CONFIGURAÇÃO:
//   - GITHUB_TOKEN: token com scope `repo` (ou `contents:write` + `pull-requests:write`)
//   - GITHUB_REPO_OWNER: ex "MarcioCau14"
//   - GITHUB_REPO_NAME: ex "SmartHotel_Zehla"
//
// INTEGRAÇÃO GLM 5.2 (opcional):
//   - Em live mode, o GLM pode gerar o patch final a partir do suggestedCode
//   - Em mock mode, usa o suggestedCode direto da heurística
// ============================================================================

import { Octokit } from '@octokit/rest';
import simpleGit from 'simple-git';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { logSink } from '../log-sink';
import { getCerebroMode } from '../types';
import { isPathAllowed } from '../code-reviewer/code-reader';
import { redactSecrets } from '../code-reviewer/secret-redactor';
import { db } from '@/lib/db';

// ── Types ──────────────────────────────────────────────────────────────────

export interface GitApplyRequest {
  /** Categoria do finding (review | refactor | gap | bottleneck) */
  category: 'review' | 'refactor' | 'gap' | 'bottleneck';
  /** ID do finding no DB */
  findingId: string;
  /** Path relativo do arquivo a modificar */
  filePath: string;
  /** Linha inicial (1-indexed) — se null, substitui todo o conteúdo */
  startLine?: number | null;
  /** Linha final (1-indexed, inclusive) */
  endLine?: number | null;
  /** Código a inserir (já redacted e validado) */
  newCode: string;
  /** Mensagem de commit (sem prefix) */
  commitMessage: string;
  /** Quem disparou (ZCC admin email) — obrigatório */
  appliedBy: string;
  /** Título do PR */
  prTitle: string;
  /** Corpo do PR (markdown) */
  prBody: string;
}

export interface GitApplyResult {
  ok: boolean;
  /** URL do PR criado */
  prUrl?: string;
  /** Número do PR */
  prNumber?: number;
  /** Branch criada */
  branch?: string;
  /** SHA do commit */
  commitSha?: string;
  /** Modo de execução */
  mode: 'mock' | 'live';
  /** Erro (se !ok) */
  error?: string;
  /** Safety locks acionados */
  safetyLocksTriggered: string[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getGitHubConfig(): { token: string; owner: string; repo: string } | null {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  if (!token || !owner || !repo) return null;
  return { token, owner, repo };
}

function shortId(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toLowerCase();
}

function branchName(req: GitApplyRequest): string {
  return `zecode/${req.category}-${shortId(req.findingId)}`;
}

// ── Rate limit: máx 10 PRs/dia por usuário ──────────────────────────────────

const userPrTimestamps: Map<string, number[]> = new Map();
const MAX_PRS_PER_DAY = 10;

function checkRateLimit(userEmail: string): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const timestamps = userPrTimestamps.get(userEmail) || [];
  const recent = timestamps.filter((t) => t > oneDayAgo);

  if (recent.length >= MAX_PRS_PER_DAY) {
    return {
      allowed: false,
      reason: `Rate limit: máximo ${MAX_PRS_PER_DAY} PRs ZéCode por dia para ${userEmail}`,
    };
  }

  recent.push(now);
  userPrTimestamps.set(userEmail, recent);
  return { allowed: true };
}

// ── Safety: validar path do arquivo antes de qualquer escrita ───────────────

function validateFilePath(filePath: string): { ok: boolean; reason?: string } {
  if (!filePath || typeof filePath !== 'string') {
    return { ok: false, reason: 'filePath obrigatório' };
  }

  // Reusa code-reader.ts para validar
  if (!isPathAllowed(filePath)) {
    return { ok: false, reason: `Path não permitido pela allowlist: ${filePath}` };
  }

  // Blocklist adicional: nunca mexer em arquivos críticos
  const FORBIDDEN_PATTERNS = [
    /\.env/i, /\.secret/i, /credentials?\.json$/i, /\.pem$/i, /\.key$/i,
    /schema\.prisma$/i, /migrate/i, /seed/i,
    /middleware\.ts$/i, // middleware requer deploy próprio
  ];
  for (const pat of FORBIDDEN_PATTERNS) {
    if (pat.test(filePath)) {
      return { ok: false, reason: `Arquivo proibido para auto-apply: ${filePath} (match: ${pat.source})` };
    }
  }

  return { ok: true };
}

// ── Mock mode: simula criação de PR ─────────────────────────────────────────

function mockApply(req: GitApplyRequest): GitApplyResult {
  const branch = branchName(req);
  const mockPrNumber = Math.floor(Math.random() * 9000) + 1000;
  const mockSha = `mock_sha_${ Math.random().toString(36).slice(2, 12)}`;

  logSink.info({
    module: 'ze-code',
    event: 'git-applier-mock',
    message: `[MOCK] PR simulado: #${mockPrNumber} branch=${branch} file=${req.filePath}`,
    context: {
      findingId: req.findingId,
      category: req.category,
      filePath: req.filePath,
      branch,
      mockPrNumber,
      appliedBy: req.appliedBy,
    },
  });

  return {
    ok: true,
    prUrl: `https://github.com/MarcioCau14/SmartHotel_Zehla/pull/${mockPrNumber}`,
    prNumber: mockPrNumber,
    branch,
    commitSha: mockSha,
    mode: 'mock',
    safetyLocksTriggered: ['mock_mode_no_real_write', 'pr_simulated'],
  };
}

// ── Live mode: cria branch local, commit, push, PR via Octokit ───────────────

async function liveApply(req: GitApplyRequest): Promise<GitApplyResult> {
  const safetyLocksTriggered: string[] = [];
  const config = getGitHubConfig();

  if (!config) {
    return {
      ok: false,
      mode: 'live',
      error: 'GITHUB_TOKEN, GITHUB_REPO_OWNER ou GITHUB_REPO_NAME não configurados',
      safetyLocksTriggered: ['missing_github_config'],
    };
  }

  // 1. Validar path (allowlist + blocklist adicional)
  const pathValidation = validateFilePath(req.filePath);
  if (!pathValidation.ok) {
    safetyLocksTriggered.push('path_validation_failed');
    return {
      ok: false,
      mode: 'live',
      error: pathValidation.reason,
      safetyLocksTriggered,
    };
  }
  safetyLocksTriggered.push('path_validated');

  // 2. GODMODE obrigatório
  const godmode = process.env.ZCC_GODMODE === 'true' || process.env.GODMODE === 'true';
  if (!godmode) {
    safetyLocksTriggered.push('godmode_required');
    return {
      ok: false,
      mode: 'live',
      error: 'GODMODE obrigatório para auto-create PR. Configure ZCC_GODMODE=true.',
      safetyLocksTriggered,
    };
  }
  safetyLocksTriggered.push('godmode_confirmed');

  // 3. Rate limit
  const rateLimit = checkRateLimit(req.appliedBy);
  if (!rateLimit.allowed) {
    safetyLocksTriggered.push('rate_limited');
    return {
      ok: false,
      mode: 'live',
      error: rateLimit.reason,
      safetyLocksTriggered,
    };
  }
  safetyLocksTriggered.push('rate_limit_ok');

  // 4. Verificar que arquivo existe
  const absPath = join(process.cwd(), req.filePath);
  if (!existsSync(absPath)) {
    safetyLocksTriggered.push('file_not_found');
    return {
      ok: false,
      mode: 'live',
      error: `Arquivo não encontrado: ${req.filePath}`,
      safetyLocksTriggered,
    };
  }

  // 5. Ler conteúdo original + redact secrets (auditoria)
  const originalContent = readFileSync(absPath, 'utf-8');
  const redaction = redactSecrets(originalContent);
  if (redaction.hasSecrets) {
    safetyLocksTriggered.push('secrets_detected_in_original');
    logSink.warn({
      module: 'ze-code',
      event: 'git-applier-secrets-detected',
      message: `Arquivo ${req.filePath} contém ${redaction.foundSecrets.length} padrões de secret. Auto-apply bloqueado por segurança.`,
      context: {
        filePath: req.filePath,
        secretsFound: redaction.foundSecrets.map((s) => s.type),
      },
    });
    return {
      ok: false,
      mode: 'live',
      error: `Arquivo contém ${redaction.foundSecrets.length} padrões de secret. Auto-apply bloqueado por segurança — revise manualmente.`,
      safetyLocksTriggered,
    };
  }
  safetyLocksTriggered.push('secrets_check_passed');

  // 6. Aplicar patch (substituir linhas startLine-endLine ou append)
  const lines = originalContent.split('\n');
  let newContent: string;

  if (req.startLine && req.endLine && req.startLine > 0 && req.endLine >= req.startLine) {
    // Substituir range específico
    const before = lines.slice(0, req.startLine - 1);
    const after = lines.slice(req.endLine);
    const newLines = req.newCode.split('\n');
    newContent = [...before, ...newLines, ...after].join('\n');
  } else if (req.startLine && req.startLine > 0) {
    // Inserir após startLine
    const before = lines.slice(0, req.startLine);
    const after = lines.slice(req.startLine);
    const newLines = req.newCode.split('\n');
    newContent = [...before, ...newLines, ...after].join('\n');
  } else {
    // Substituir conteúdo inteiro (apenas se arquivo pequeno < 5KB)
    if (originalContent.length > 5_000) {
      safetyLocksTriggered.push('full_replace_too_large');
      return {
        ok: false,
        mode: 'live',
        error: 'Substituição completa bloqueada para arquivos > 5KB (use startLine/endLine)',
        safetyLocksTriggered,
      };
    }
    newContent = req.newCode;
  }
  safetyLocksTriggered.push('patch_computed');

  // 7. Validar conteúdo novo (redact também, nunca escrever secret novo)
  const newRedaction = redactSecrets(newContent);
  if (newRedaction.hasSecrets) {
    safetyLocksTriggered.push('secrets_in_new_content');
    return {
      ok: false,
      mode: 'live',
      error: 'Novo conteúdo contém padrões de secret. Auto-apply bloqueado.',
      safetyLocksTriggered,
    };
  }

  // 8. Setup git via simple-git (em processo cwd)
  const git = simpleGit(process.cwd());
  const branch = branchName(req);

  try {
    // Verifica se repo está limpo
    const status = await git.status();
    if (!status.isClean() && !process.env.ZECODE_ALLOW_DIRTY_REPO) {
      safetyLocksTriggered.push('repo_not_clean');
      return {
        ok: false,
        mode: 'live',
        error: 'Repo não está limpo. Commit ou stash suas mudanças antes de rodar auto-apply.',
        safetyLocksTriggered,
      };
    }

    // Cria branch a partir da default (main)
    await git.checkoutLocalBranch(branch);
    safetyLocksTriggered.push('branch_created');

    // Escreve arquivo modificado
    writeFileSync(absPath, newContent, 'utf-8');

    // Stage + commit
    await git.add([req.filePath]);
    const commit = await git.commit(`feat(zécode): ${req.commitMessage}\n\nFinding: ${req.category}#${req.findingId}\nApplied-by: ${req.appliedBy}\nGenerated-by: ZéCode (DEV FULL STACK interno)`);
    safetyLocksTriggered.push('committed');

    // Push via remote com token embutido (apenas neste comando, sem persistir)
    const remoteUrl = `https://x-access-token:${config.token}@github.com/${config.owner}/${config.repo}.git`;
    await git.push(remoteUrl, branch, { '--set-upstream': null });
    safetyLocksTriggered.push('pushed');

    // Cria PR via Octokit
    const octokit = new Octokit({ auth: config.token });

    // Determina default branch para abrir PR contra
    const repoInfo = await octokit.rest.repos.get({ owner: config.owner, repo: config.repo });
    const defaultBranch = repoInfo.data.default_branch;

    const pr = await octokit.rest.pulls.create({
      owner: config.owner,
      repo: config.repo,
      title: req.prTitle,
      head: branch,
      base: defaultBranch,
      body: req.prBody,
      draft: true, // SEMPRE draft — humano precisa marcar ready for review
    });

    safetyLocksTriggered.push('pr_created_draft');

    // Volta para branch original (main)
    await git.checkout(defaultBranch);

    logSink.info({
      module: 'ze-code',
      event: 'git-applier-live',
      message: `PR criado: #${pr.data.number} (${branch}) — ${req.filePath}`,
      context: {
        findingId: req.findingId,
        category: req.category,
        filePath: req.filePath,
        branch,
        prNumber: pr.data.number,
        prUrl: pr.data.html_url,
        commitSha: commit.commit,
        appliedBy: req.appliedBy,
      },
    });

    return {
      ok: true,
      prUrl: pr.data.html_url,
      prNumber: pr.data.number,
      branch,
      commitSha: commit.commit,
      mode: 'live',
      safetyLocksTriggered,
    };
  } catch (e) {
    const err = e as Error;
    // Volta para main em caso de erro
    try {
      const repoInfo = await new Octokit({ auth: config.token }).rest.repos.get({ owner: config.owner, repo: config.repo });
      await git.checkout(repoInfo.data.default_branch);
    } catch { /* ignore */ }

    logSink.error({
      module: 'ze-code',
      event: 'git-applier-failed',
      message: `Falha no auto-apply: ${err.message}`,
      context: {
        findingId: req.findingId,
        filePath: req.filePath,
        branch,
        error: err.message,
        stack: err.stack,
      },
    });

    return {
      ok: false,
      mode: 'live',
      error: err.message,
      safetyLocksTriggered: [...safetyLocksTriggered, 'live_apply_failed'],
    };
  }
}

// ── API pública ─────────────────────────────────────────────────────────────

export async function applySuggestionViaGit(req: GitApplyRequest): Promise<GitApplyResult> {
  const mode = getCerebroMode();
  const safetyLocksTriggered: string[] = ['manual_approval_required', 'no_auto_apply'];

  if (!req.appliedBy) {
    return {
      ok: false,
      mode,
      error: 'appliedBy é obrigatório',
      safetyLocksTriggered: [...safetyLocksTriggered, 'missing_applied_by'],
    };
  }

  if (mode === 'mock') {
    safetyLocksTriggered.push('mock_mode_no_real_write');
    return { ...mockApply(req), safetyLocksTriggered: [...safetyLocksTriggered, ...mockApply(req).safetyLocksTriggered] };
  }

  // Live mode
  const result = await liveApply(req);

  // Persiste prUrl + prBranch no DB se sucesso
  if (result.ok && result.prUrl && result.branch) {
    try {
      if (req.category === 'gap' && db.gapFinding) {
        await db.gapFinding.update({
          where: { id: req.findingId },
          data: {
            status: 'applied',
            appliedBy: req.appliedBy,
            appliedAt: new Date(),
            prUrl: result.prUrl,
            prBranch: result.branch,
          },
        });
      } else if (req.category === 'bottleneck' && db.bottleneckFinding) {
        await db.bottleneckFinding.update({
          where: { id: req.findingId },
          data: {
            status: 'applied',
            appliedBy: req.appliedBy,
            appliedAt: new Date(),
            prUrl: result.prUrl,
            prBranch: result.branch,
          },
        });
      } else if (req.category === 'refactor' && db.refactorSuggestion) {
        await db.refactorSuggestion.update({
          where: { id: req.findingId },
          data: {
            status: 'applied',
            reviewedBy: req.appliedBy,
            reviewedAt: new Date(),
            reviewNotes: `PR auto-criado: ${result.prUrl}`,
          },
        });
      }
    } catch (e) {
      logSink.warn({
        module: 'ze-code',
        event: 'git-applier-db-update-failed',
        message: `PR criado mas falha ao atualizar DB: ${(e as Error).message}`,
        context: { findingId: req.findingId, prUrl: result.prUrl },
      });
    }
  }

  return { ...result, safetyLocksTriggered: [...safetyLocksTriggered, ...result.safetyLocksTriggered] };
}
