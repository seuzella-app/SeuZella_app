/**
 * Evolve-to-PR Pipeline — Transforma RefactorSuggestion em Pull Request.
 *
 * Fluxo:
 *  1. gap-detector/bottleneck-detector cria RefactorSuggestion (status: pending_review)
 *  2. Admin revisa no ZCC Panel → clica "Apply via PR"
 *  3. applySuggestionViaPR():
 *     - Cria branch feat/ze-code/{slug}
 *     - Commit atômico (múltiplos arquivos via Git Database API)
 *     - Abre PR com body estruturado
 *     - Opcional: cria issue linked
 *     - Atualiza status da suggestion para "pr_open"
 *  4. GitHub Action roda no PR (não chama ZéCode novamente — evita loop)
 *  5. Human review → merge ou close
 *  6. Webhook "pull_request.closed.merged" → ZéCode marca suggestion como "applied"
 *
 * Doc: "Bíblia do ZéCode — GitHub GitOps" (Cap. 6)
 *
 * SAFETY LOCKS:
 *  - Limite MAX_OPEN_PRS=3 PRs abertos pelo ZéCode simultaneamente
 *  - Branches sempre dedicadas (feat/ze-code/...), nunca push direto em main
 *  - Commit message prefixado com [ze-code-automated]
 *  - Co-authored-by trailer identifica o bot
 *  - Dry-run mode: gera plano mas não cria PR
 *  - GODMODE required para live mode (operacao sensível)
 */

import { getGitHubClient } from '@/lib/github/github-client';
import { db } from '@/lib/db';
import { auditLog } from '@/lib/github/pat-vault';

const MAX_OPEN_PRS = 3;
const BRANCH_PREFIX = 'feat/ze-code/';
const BOT_EMAIL = 'ze-code@zehla.local';
const BOT_NAME = 'ZéCode Bot';

export interface ApplyViaPROpts {
  suggestionId: string;
  credentialId: string;
  dryRun?: boolean;
  createIssue?: boolean;
  actorUserId: string;
  godMode?: boolean; // required para live mode
}

export interface ApplyViaPRResult {
  success: boolean;
  dryRun?: boolean;
  prUrl?: string;
  prNumber?: number;
  issueNumber?: number | null;
  branchName?: string;
  commitSha?: string;
  plan?: {
    branchName: string;
    files: Array<{ path: string; additions: number; deletions: number }>;
    commitMessage: string;
    prTitle: string;
    prBody: string;
  };
  error?: string;
}

/**
 * Aplica RefactorSuggestion via Pull Request.
 * Em caso de erro, retorna { success: false, error } — não lança.
 */
export async function applySuggestionViaPR(opts: ApplyViaPROpts): Promise<ApplyViaPRResult> {
  const { suggestionId, credentialId, actorUserId } = opts;

  // 1. Carrega suggestion
  const suggestion = await db.refactorSuggestion.findUnique({
    where: { id: suggestionId },
  });

  if (!suggestion) {
    return { success: false, error: `Suggestion ${suggestionId} não encontrada` };
  }

  if (suggestion.status !== 'pending_review' && suggestion.status !== 'approved') {
    return {
      success: false,
      error: `Suggestion deve estar em "pending_review" ou "approved", got "${suggestion.status}"`,
    };
  }

  // 2. GODMODE check para live mode
  if (!opts.dryRun && !opts.godMode) {
    return {
      success: false,
      error:
        'GODMODE deve estar habilitado para criar PRs. Ative em ZCC → Settings → GODMODE.',
    };
  }

  // 3. Verifica limite de PRs abertos pelo ZéCode
  if (!opts.dryRun) {
    const openSuggestions = await db.refactorSuggestion.count({
      where: { status: 'applied', mode: 'live', reviewedBy: 'ze-code-bot' },
    });
    // Considera "applied" em live mode como PRs abertos (não foram merged ainda)
    if (openSuggestions >= MAX_OPEN_PRS) {
      return {
        success: false,
        error: `Limite de ${MAX_OPEN_PRS} PRs abertos pelo ZéCode atingido. Aguarde merge de algum PR existente.`,
      };
    }
  }

  // 4. Prepara plano
  const repo = process.env.ZECODE_TARGET_REPO || 'MarcioCau14/SmartHotel_Zehla';
  const baseBranch = 'main';
  const branchSlug = `${suggestion.filePath.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${suggestion.id.substring(0, 8)}`;
  const branchName = `${BRANCH_PREFIX}${branchSlug}`;

  const files = [
    {
      path: suggestion.filePath,
      content: suggestion.proposedCode,
    },
  ];

  const commitMessage = `[ze-code-automated] Refactor: ${suggestion.filePath}

Suggestion ID: ${suggestion.id}
Confidence: ${(suggestion.confidence * 100).toFixed(1)}%
Mode: ${suggestion.mode}

${suggestion.rationale}

Co-authored-by: ZéCode <${BOT_EMAIL}>`;

  const prTitle = `[ze-code-automated] Refactor: ${suggestion.filePath}`;
  const prBody = renderPRBody(suggestion);

  // 5. Dry-run mode: só retorna o plano
  if (opts.dryRun) {
    const currentLines = suggestion.currentCode.split('\n').length;
    const proposedLines = suggestion.proposedCode.split('\n').length;
    const additions = Math.max(0, proposedLines - currentLines);
    const deletions = Math.max(0, currentLines - proposedLines);

    return {
      success: true,
      dryRun: true,
      plan: {
        branchName,
        files: [{ path: suggestion.filePath, additions, deletions }],
        commitMessage,
        prTitle,
        prBody,
      },
    };
  }

  // 6. Executa operação live
  const client = getGitHubClient(credentialId);

  try {
    // 6a. Cria branch
    await client.createBranch(repo, baseBranch, branchName);

    // 6b. Commit atômico
    const commitResult = await client.commitFiles(repo, branchName, files, commitMessage);

    // 6c. Abre PR
    const pr = await client.createPR({
      repo,
      title: prTitle,
      head: branchName,
      base: baseBranch,
      body: prBody,
      draft: false,
    });

    // 6d. Cria issue linked (opcional)
    let issueNumber: number | null = null;
    if (opts.createIssue) {
      const issue = await client.createIssue(
        repo,
        `[ze-code-automated] Refactor: ${suggestion.filePath}`,
        `## Contexto\n\nSugerido por ZéCode em ${suggestion.createdAt.toISOString()}\n\n` +
          `Linked to PR #${pr.number}\n\n` +
          `## Rationale\n\n${suggestion.rationale}\n\n` +
          `## Arquivo\n\n\`${suggestion.filePath}\` (linhas ${suggestion.lineRange})`,
        ['ze-code-automated', `confidence:${suggestion.confidence > 0.8 ? 'high' : 'medium'}`]
      );
      issueNumber = issue.number;
    }

    // 6e. Atualiza suggestion no DB
    await db.refactorSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: 'applied',
        reviewedBy: 'ze-code-bot',
        reviewedAt: new Date(),
        reviewNotes: `PR #${pr.number} criado via ZéCode. Branch: ${branchName}. Commit: ${commitResult.sha.substring(0, 7)}. Issue: ${issueNumber || 'N/A'}.`,
      },
    });

    // 6f. Audit
    await auditLog(credentialId, 'API_CALL', {
      apiEndpoint: `POST /repos/${repo}/pulls`,
      apiMethod: 'POST',
      repository: repo,
      success: true,
      statusCode: 201,
    });

    return {
      success: true,
      prUrl: pr.html_url,
      prNumber: pr.number,
      issueNumber,
      branchName,
      commitSha: commitResult.sha,
    };
  } catch (err: any) {
    // Em caso de erro, marca suggestion com erro mas NÃO altera status (permite retry)
    await db.refactorSuggestion.update({
      where: { id: suggestionId },
      data: {
        reviewNotes: `ERRO ao aplicar: ${err.message}`,
      },
    });

    await auditLog(credentialId, 'API_CALL', {
      apiEndpoint: `POST /repos/${repo}/pulls`,
      apiMethod: 'POST',
      repository: repo,
      success: false,
      errorMessage: String(err).substring(0, 2000),
    });

    return {
      success: false,
      error: err.message || String(err),
    };
  }
}

/**
 * Renderiza corpo do PR em markdown estruturado.
 */
function renderPRBody(suggestion: any): string {
  const confidencePct = (suggestion.confidence * 100).toFixed(1);
  const confidenceLevel =
    suggestion.confidence >= 0.85 ? 'high' : suggestion.confidence >= 0.7 ? 'medium' : 'low';

  return `## ZéCode Automated Refactor

### Justificativa
${suggestion.rationale}

### Detalhes da Detecção
- **Arquivo:** \`${suggestion.filePath}\` (linhas ${suggestion.lineRange})
- **Confiança:** ${confidencePct}% (\`${confidenceLevel}\`)
- **Modo:** \`${suggestion.mode}\`
- **Suggestion ID:** \`${suggestion.id}\`
- **Detected at:** ${suggestion.createdAt.toISOString()}

### Código Atual
\`\`\`
${(suggestion.currentCode || '// empty').substring(0, 500)}
\`\`\`

### Código Proposto
\`\`\`
${(suggestion.proposedCode || '// empty').substring(0, 1000)}
\`\`\`

### Checklist de Revisão
- [ ] A mudança resolve o problema identificado?
- [ ] Não introduz regressão em testes existentes?
- [ ] Mantém ou melhora a legibilidade do código?
- [ ] Não quebra compatibilidade de API pública?
- [ ] Segue os padrões de código do projeto (ESLint, Prettier)?

### Como Reverter
Se precisar reverter este PR após merge:
\`\`\`bash
git revert ${suggestion.id.substring(0, 7)}-zecode
\`\`\`

---
*Este PR foi criado automaticamente pelo **ZéCode** (ZCC Platform). Revise com atenção e faça merge apenas se concordar com a mudança. Em caso de dúvida, comente com label \`ze-code-help-needed\`.*`;
}
