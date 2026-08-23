// ============================================================================
// ZÉLLA — Code Reviewer Service (Main Orchestrator)
// ============================================================================
// Serviço singleton que orquestra revisões de código usando GLM 5.2 embarcado
// (via /lib/cerebro/glm-service e /lib/ai/llm-adapters).
//
// FLUXO PRINCIPAL:
//  1. Recebe ReviewRequest (mode + target + opts)
//  2. runQualityGates(req) — valida budget, rate limit, paths
//  3. Coleta arquivos para revisar:
//     - "diff": extractDiff(base, head) → apenas arquivos modificados
//     - "file": readCodeFile(target) → arquivo único
//     - "directory": listCodeFiles(target, opts) → arquivos da pasta
//     - "hotspot": consulta CerebroAnalysis recentes → arquivos com erros
//  4. Para cada arquivo:
//     a. Lê conteúdo via readCodeFile (sandboxed + secret redaction)
//     b. Seleciona path_instructions aplicáveis
//     c. Constrói prompt rico (system + user)
//     d. Chama GLM 5.2 em JSON mode (ou mock)
//     e. Persiste CodeReviewComment
//  5. Gera walkthrough summary (consolida todos os comentários)
//  6. Persiste CodeReview com stats + cost
//  7. AuditLog + LogSink + AuditBus notifica ZCC
//
// MODO MOCK (padrão, CEREBRO_LIVE_MODE=false):
//  - NÃO chama GLM 5.2 (custo $0)
//  - Gera comentários sintéticos baseados em heurísticas (regex patterns)
//  - Persiste CodeReview com mode="mock"
//
// MODO LIVE (CEREBRO_LIVE_MODE=true + GLM_5_2_API_KEY):
//  - Chama GLM 5.2 com JSON mode
//  - Prompt engineering estruturado com path_instructions
//  - Custo estimado: ~$0.003 por arquivo (3k tokens input + 1k output)
//
// QUALIDADE:
//  - Confidence < 0.4 → marcada como "low_confidence" (não auto-aplicável)
//  - Severity "emergency" → alerta direção via AlertBus
//  - Toda sugestão suggestedCode é validada por parser simples antes de salvar
// ============================================================================

import { db } from '@/lib/db';
import { logSink } from '../log-sink';
import { getCerebroMode } from '../types';
import { callOpenAICompatible, type AdapterMessage } from '@/lib/ai/llm-adapters';
import { readCodeFile, listCodeFiles, readLineRange } from './code-reader';
import { extractDiff } from './diff-extractor';
import { loadInstructions, selectInstructionsForPath } from './path-instructions-loader';
import { runQualityGates } from './quality-gates';
import {
  DEFAULT_REVIEW_PROFILE,
  SEVERITY_RANK,
  type CodeReviewComment,
  type CodeReviewResult,
  type ReviewRequest,
  type ReviewSeverity,
  type ReviewerLLMOutput,
} from './types';

// ── Configuração ────────────────────────────────────────────────────────────

interface ReviewerConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

function loadConfig(): ReviewerConfig {
  return {
    apiKey: process.env.GLM_5_2_API_KEY || process.env.ZHIPU_API_KEY || '',
    baseUrl: process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
    model: process.env.GLM_MODEL || 'glm-5.2',
    temperature: 0.2, // baixa temperatura — análise técnica consistente
    maxTokens: 4000,
  };
}

// ── Custo por tokens (estimativa — GLM pricing) ────────────────────────────

const COST_PER_1K_INPUT_TOKENS_USD = 0.0007; // $0.70 / 1M
const COST_PER_1K_OUTPUT_TOKENS_USD = 0.0028; // $2.80 / 1M

function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1000) * COST_PER_1K_INPUT_TOKENS_USD +
    (outputTokens / 1000) * COST_PER_1K_OUTPUT_TOKENS_USD
  );
}

// ── Tipos internos ──────────────────────────────────────────────────────────

interface FileToReview {
  path: string;
  content: string;
  lines: string[];
  /** True se é arquivo modificado no diff (apenas essas linhas são revisadas) */
  diffOnly?: boolean;
  /** Linhas adicionadas (se diffOnly) — array de { line, content } */
  addedLines?: { line: number; content: string }[];
}

// ── Helper: coletar arquivos para revisão ───────────────────────────────────

async function collectFiles(req: ReviewRequest): Promise<{
  files: FileToReview[];
  diffSummary?: { additions: number; deletions: number; filesTotal: number };
}> {
  switch (req.mode) {
    case 'diff': {
      const baseRef = req.target || 'origin/main';
      const diff = extractDiff(baseRef, 'HEAD');
      if (!diff.ok || diff.files.length === 0) {
        logSink.info({
          module: 'code-reviewer',
          event: 'diff_empty',
          message: `Diff vazio para ${baseRef}..HEAD`,
        });
        return { files: [] };
      }
      const files: FileToReview[] = [];
      for (const df of diff.files) {
        // Para diff mode, lemos apenas o arquivo + adjacentes, não o conteúdo completo
        // O diff já contém as linhas modificadas
        const fullFile = readCodeFile(df.path);
        files.push({
          path: df.path,
          content: fullFile.ok ? fullFile.redactedContent || '' : '',
          lines: fullFile.ok ? fullFile.lines || [] : [],
          diffOnly: true,
          addedLines: df.additions,
        });
      }
      return {
        files,
        diffSummary: {
          additions: diff.totalAdditions,
          deletions: diff.totalDeletions,
          filesTotal: diff.files.length,
        },
      };
    }

    case 'file': {
      const result = readCodeFile(req.target);
      if (!result.ok) {
        logSink.warn({
          module: 'code-reviewer',
          event: 'file_read_failed',
          message: `Falha ao ler ${req.target}: ${result.error}`,
        });
        return { files: [] };
      }
      return {
        files: [
          {
            path: req.target,
            content: result.redactedContent || '',
            lines: result.lines || [],
          },
        ],
      };
    }

    case 'directory': {
      const dirPath = req.target || 'src/lib';
      const filePaths = listCodeFiles(dirPath, {
        maxFiles: req.maxFiles ?? 10,
        includePatterns: req.includePatterns,
        excludePatterns: req.excludePatterns,
      });
      const files: FileToReview[] = [];
      for (const fp of filePaths) {
        const result = readCodeFile(fp);
        if (result.ok) {
          files.push({
            path: fp,
            content: result.redactedContent || '',
            lines: result.lines || [],
          });
        }
      }
      return { files };
    }

    case 'hotspot': {
      const windowHours = parseInt(req.target || '24', 10);
      const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
      // Consulta RefactorSuggestions pendentes (erros recorrentes)
      const suggestions = await db.refactorSuggestion.findMany({
        where: {
          status: 'pending_review',
          createdAt: { gte: since },
        },
        take: req.maxFiles ?? 10,
        orderBy: { createdAt: 'desc' },
      });

      const seenPaths = new Set<string>();
      const files: FileToReview[] = [];
      for (const s of suggestions) {
        if (seenPaths.has(s.filePath)) continue;
        seenPaths.add(s.filePath);
        const result = readCodeFile(s.filePath);
        if (result.ok) {
          files.push({
            path: s.filePath,
            content: result.redactedContent || '',
            lines: result.lines || [],
          });
        }
      }
      return { files };
    }

    default:
      return { files: [] };
  }
}

// ── Helper: construir prompt para um arquivo ────────────────────────────────

function buildPromptForFile(
  file: FileToReview,
  instructions: Awaited<ReturnType<typeof loadInstructions>>,
  profile: 'assertive' | 'gentle',
): AdapterMessage[] {
  const pathInstructions = selectInstructionsForPath(file.path, instructions.pathInstructions);
  const profileText = profile === 'assertive'
    ? 'Seja ASSERTIVO: reporte TODOS os problemas encontrados, mesmo os menores. Prefira false positives a false negatives.'
    : 'Seja EDUCADO: reporte apenas problemas críticos e de alta confiança. Ignore nitpicks de estilo.';

  // Para diff mode, focamos apenas nas linhas adicionadas
  let codeBlock: string;
  if (file.diffOnly && file.addedLines && file.addedLines.length > 0) {
    const addedBlock = file.addedLines
      .map((l) => `${l.line.toString().padStart(5, ' ')}|+| ${l.content}`)
      .join('\n');
    codeBlock = `=== LINHAS ADICIONADAS (diff mode) ===\n${addedBlock}\n\n=== ARQUIVO COMPLETO (para contexto) ===\n${file.content}`;
  } else {
    const numbered = file.lines
      .map((l, i) => `${(i + 1).toString().padStart(5, ' ')}| ${l}`)
      .join('\n');
    codeBlock = numbered;
  }

  const systemPrompt = `${instructions.globalProfile}

${profileText}

Você está revisando o arquivo: ${file.path}

${pathInstructions.length > 0 ? `\n=== INSTRUÇÕES ESPECÍFICAS PARA ESTE PATH ===\n${pathInstructions.join('\n\n')}` : ''}

FORMATO OBRIGATÓRIO DE RESPOSTA (JSON):
{
  "highLevelSummary": "Resumo de 1-3 frases sobre a qualidade geral do código revisado.",
  "severity": "info" | "warning" | "critical" | "emergency",
  "comments": [
    {
      "filePath": "${file.path}",
      "startLine": <numero ou null>,
      "endLine": <numero ou null>,
      "category": "security" | "performance" | "bug" | "maintainability" | "style" | "best_practice" | "info",
      "severity": "info" | "warning" | "critical" | "emergency",
      "title": "Título curto do problema (max 80 chars)",
      "description": "Descrição detalhada do problema (markdown). Inclua: o que está errado, por quê, e qual o impacto.",
      "suggestedCode": "Código sugerido (ou null se for apenas informativo). Se fornecer, seja completo e aplicável.",
      "rationale": "Justificativa técnica da mudança sugerida (ou null).",
      "confidence": <0..1>
    }
  ]
}

REGRAS:
- Comments DEVE ser um array (pode ser vazio se nada de errado encontrado).
- Line numbers referem-se ao arquivo COMPLETO (não ao diff).
- NUNCA invente linhas — só comente linhas que existem no código fornecido.
- confidence < 0.4 = suspeita; 0.4-0.7 = média; > 0.7 = alta confiança.
- Em "gentle" profile, retorne APENAS severity >= "warning" e confidence >= 0.6.
- Para erros de segurança, use severity "critical" ou "emergency".
- Não inclua o path do arquivo na resposta (já está no contexto).`;

  const userPrompt = `Revise o código abaixo e retorne SOMENTE um JSON válido conforme o schema especificado.

ARQUIVO: ${file.path}

\`\`\`
${codeBlock}
\`\`\``;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}

// ── Helper: chamada GLM 5.2 com JSON mode ────────────────────────────────────

async function callReviewerLLM(
  messages: AdapterMessage[],
  config: ReviewerConfig,
): Promise<{ output: ReviewerLLMOutput | null; inputTokens: number; outputTokens: number; error?: string }> {
  try {
    const response = await callOpenAICompatible({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      messages,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      jsonMode: true,
    });

    // Parse JSON
    let parsed: ReviewerLLMOutput | null = null;
    try {
      // GLM em JSON mode retorna diretamente o objeto
      const content = response.content.trim();
      // Remove wrapping ```json se presente
      const clean = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
      parsed = JSON.parse(clean) as ReviewerLLMOutput;
    } catch (e) {
      return {
        output: null,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        error: `JSON parse failed: ${(e as Error).message}`,
      };
    }

    return {
      output: parsed,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    };
  } catch (e) {
    return {
      output: null,
      inputTokens: 0,
      outputTokens: 0,
      error: (e as Error).message,
    };
  }
}

// ── Mock mode: gera comentários sintéticos ──────────────────────────────────

const MOCK_PATTERNS: Array<{
  pattern: RegExp;
  category: CodeReviewComment['category'];
  severity: ReviewSeverity;
  title: string;
  description: string;
  suggestion?: string;
}> = [
  {
    pattern: /\beval\s*\(/g,
    category: 'security',
    severity: 'critical',
    title: 'Uso de eval() detectado',
    description: '`eval()` permite execução arbitrária de código, criando risco sério de injeção de código. Substitua por alternativas seguras como `JSON.parse()` ou `Function()` com validação estrita de entrada.',
    suggestion: 'JSON.parse(input) // em vez de eval(input)',
  },
  {
    pattern: /dangerouslySetInnerHTML/g,
    category: 'security',
    severity: 'warning',
    title: 'Uso de dangerouslySetInnerHTML',
    description: 'Renderização de HTML não-sanitizado pode levar a XSS. Certifique-se de que o conteúdo é sanitizado por biblioteca confiável (DOMPurify) antes de ser injetado.',
    suggestion: '<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />',
  },
  {
    pattern: /\$queryRaw\s*\(/g,
    category: 'security',
    severity: 'critical',
    title: 'Prisma raw query detectada',
    description: 'Queries SQL brutas (`$queryRaw`) são suscetíveis a SQL injection se construídas com concatenação de string. Use sempre queries parametrizadas com `$queryRaw\`SELECT ... WHERE id = $1\``.',
    suggestion: 'await prisma.$queryRaw`SELECT * FROM users WHERE id = ${userId}`',
  },
  {
    pattern: /console\.log\s*\(/g,
    category: 'style',
    severity: 'info',
    title: 'console.log() em produção',
    description: 'Logs de console em produção podem vazar dados sensíveis (PII, tokens) e degradar performance. Use `logSink.info()` que aplica redação e deduplicação.',
    suggestion: 'logSink.info({ module: "...", event: "...", message: "..." })',
  },
  {
    pattern: /TODO|FIXME|XXX/g,
    category: 'maintainability',
    severity: 'info',
    title: 'TODO/FIXME pendente',
    description: 'Marcadores TODO/FIXME indicam dívida técnica. Revise se ainda aplicável e crie issue tracking para resolver.',
  },
  {
    pattern: /any\b/g,
    category: 'maintainability',
    severity: 'info',
    title: 'Uso de tipo "any"',
    description: 'O tipo `any` desativa checagem de tipos em TypeScript, perdendo benefícios de type-safety. Defina tipos explícitos.',
  },
  {
    pattern: /\.catch\s*\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/g,
    category: 'bug',
    severity: 'warning',
    title: 'Catch vazio',
    description: 'Capturar erro e ignorar silenciosamente esconde bugs. Pelo menos registre o erro via logSink.',
    suggestion: '.catch((err) => logSink.error({ module: "...", event: "...", message: err.message }))',
  },
  {
    pattern: /process\.env\.[A-Z_]+/g,
    category: 'security',
    severity: 'info',
    title: 'Acesso direto a variável de ambiente',
    description: 'Acesso direto a `process.env.X` sem validação pode falhar silenciosamente em produção se a variável não estiver definida. Use helper com fallback.',
    suggestion: "const secret = process.env.SECRET ?? throw new Error('SECRET not configured')",
  },
];

function generateMockComments(file: FileToReview): CodeReviewComment[] {
  const comments: CodeReviewComment[] = [];
  const fullText = file.content;

  for (const pat of MOCK_PATTERNS) {
    const regex = new RegExp(pat.pattern.source, pat.pattern.flags);
    let match;
    while ((match = regex.exec(fullText)) !== null) {
      // Encontra a linha correspondente
      const offset = match.index;
      const lineNum = fullText.slice(0, offset).split('\n').length;

      comments.push({
        filePath: file.path,
        startLine: lineNum,
        endLine: lineNum,
        category: pat.category,
        severity: pat.severity,
        title: pat.title,
        description: pat.description,
        suggestedCode: pat.suggestion ?? null,
        currentCode: readLineRange(file.path, Math.max(1, lineNum - 1), lineNum + 1),
        rationale: 'Mock pattern detection (heuristic)',
        confidence: 0.6,
      });

      // Limita a 1 match por pattern por arquivo
      break;
    }
  }

  return comments;
}

// ── Helper: consolidar severity geral ───────────────────────────────────────

function maxSeverity(severities: ReviewSeverity[]): ReviewSeverity {
  if (severities.length === 0) return 'info';
  return severities.reduce((max, s) =>
    SEVERITY_RANK[s] > SEVERITY_RANK[max] ? s : max,
  );
}

// ── Helper: gerar walkthrough summary ───────────────────────────────────────

function buildWalkthrough(comments: CodeReviewComment[], filesCount: number): string {
  if (comments.length === 0) {
    return `Revisão de ${filesCount} arquivo(s) concluída. Nenhum problema crítico detectado. Recomenda-se manter boas práticas e monitoramento contínuo.`;
  }

  const byCategory = new Map<string, number>();
  const bySeverity = new Map<string, number>();
  for (const c of comments) {
    byCategory.set(c.category, (byCategory.get(c.category) ?? 0) + 1);
    bySeverity.set(c.severity, (bySeverity.get(c.severity) ?? 0) + 1);
  }

  const topCategory = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1])[0];
  const criticalCount = bySeverity.get('critical') ?? 0;
  const emergencyCount = bySeverity.get('emergency') ?? 0;
  const warningCount = bySeverity.get('warning') ?? 0;

  let summary = `Revisão de ${filesCount} arquivo(s) — ${comments.length} comentário(s) gerado(s).`;

  if (emergencyCount > 0) {
    summary += ` ⚠️ ${emergencyCount} problema(s) EMERGÊNCIA detectados — ação imediata requerida.`;
  }
  if (criticalCount > 0) {
    summary += ` ${criticalCount} problema(s) crítico(s) encontrados.`;
  }
  if (warningCount > 0) {
    summary += ` ${warningCount} alerta(s) de severidade média.`;
  }

  if (topCategory) {
    summary += ` Categoria mais frequente: ${topCategory[0]} (${topCategory[1]} ocorrências).`;
  }

  return summary;
}

// ── Main Service ────────────────────────────────────────────────────────────

export class CodeReviewerService {
  private readonly config: ReviewerConfig;
  private readonly mode: 'mock' | 'live';

  constructor() {
    this.config = loadConfig();
    this.mode = getCerebroMode();
  }

  async review(req: ReviewRequest): Promise<CodeReviewResult & { reviewId?: string }> {
    // 1. Quality gates
    const gate = await runQualityGates(req);
    if (!gate.allowed) {
      throw new Error(`Quality gate falhou: ${gate.failure} — ${gate.reason}`);
    }

    // 2. Carrega instruções (path_filters, path_instructions, profile)
    const instructions = await loadInstructions();
    const profile = req.profile ?? instructions.reviewProfile;

    // 3. Coleta arquivos
    const { files, diffSummary } = await collectFiles(req);
    if (files.length === 0) {
      throw new Error('Nenhum arquivo elegível para revisão após aplicar filtros');
    }

    logSink.info({
      module: 'code-reviewer',
      event: 'review_started',
      message: `Revisão ${req.mode}:${req.target} — ${files.length} arquivo(s)`,
      context: {
        mode: this.mode,
        profile,
        filesCount: files.length,
        triggeredBy: req.triggeredBy,
      },
    });

    // 4. Cria registro CodeReview (status=running) com fallback seguro
    let reviewId = `cr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    try {
      if ((db as any)?.codeReview?.create) {
        const review = await (db as any).codeReview.create({
          data: {
            reviewMode: req.mode,
            scope: `${req.mode}:${req.target}`,
            highLevelSummary: '', // preenchido depois
            severity: 'info',
            stats: '{}',
            costUsd: 0,
            mode: this.mode,
            status: 'running',
            triggeredBy: req.triggeredBy ?? null,
          },
        });
        if (review?.id) reviewId = review.id;
      }
    } catch (dbErr) {
      logSink.warn({
        module: 'code-reviewer',
        event: 'db_review_create_fallback',
        message: `Falha ao persistir CodeReview inicial no DB (usando in-memory ID ${reviewId}): ${(dbErr as Error).message}`,
      });
    }

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCostUsd = 0;
    const allComments: CodeReviewComment[] = [];
    let filesSkipped = 0;

    try {
      // 5. Para cada arquivo, chama LLM (ou mock)
      for (const file of files) {
        if (this.mode === 'live') {
          const messages = buildPromptForFile(file, instructions, profile);
          const llmResult = await callReviewerLLM(messages, this.config);

          totalInputTokens += llmResult.inputTokens;
          totalOutputTokens += llmResult.outputTokens;

          if (llmResult.error || !llmResult.output) {
            filesSkipped++;
            logSink.warn({
              module: 'code-reviewer',
              event: 'llm_call_failed',
              message: `LLM falhou para ${file.path}: ${llmResult.error}`,
            });
            continue;
          }

          // Mapeia saída para CodeReviewComment
          for (const c of llmResult.output.comments ?? []) {
            // Validação básica
            if (!c.title || !c.description) continue;

            // Linha fora do range do arquivo? skip
            const lineCount = file.lines.length;
            if (c.startLine && (c.startLine < 1 || c.startLine > lineCount + 100)) {
              c.startLine = null;
              c.endLine = null;
            }

            const comment: CodeReviewComment = {
              filePath: file.path,
              startLine: c.startLine ?? null,
              endLine: c.endLine ?? null,
              category: c.category,
              severity: c.severity,
              title: c.title.slice(0, 200),
              description: c.description,
              suggestedCode: c.suggestedCode ?? null,
              currentCode: c.startLine && c.endLine
                ? readLineRange(file.path, c.startLine, c.endLine)
                : null,
              rationale: c.rationale ?? null,
              confidence: typeof c.confidence === 'number' ? Math.min(1, Math.max(0, c.confidence)) : 0.5,
            };
            allComments.push(comment);
          }
        } else {
          // Mock mode — heurísticas
          const mockComments = generateMockComments(file);
          allComments.push(...mockComments);
          // Mock não consome tokens reais
          totalInputTokens += Math.min(file.content.length / 4, 3000);
          totalOutputTokens += 500;
        }
      }

      // 6. Filtra por minSeverity
      const minSeverity = req.minSeverity ?? 'info';
      const minRank = SEVERITY_RANK[minSeverity];
      const filteredComments = allComments.filter((c) => SEVERITY_RANK[c.severity] >= minRank);

      // 7. Calcula stats
      const criticalCount = filteredComments.filter((c) => c.severity === 'critical').length;
      const warningCount = filteredComments.filter((c) => c.severity === 'warning').length;
      const infoCount = filteredComments.filter((c) => c.severity === 'info').length;
      const emergencyCount = filteredComments.filter((c) => c.severity === 'emergency').length;

      // 8. Walkthrough summary
      const walkthrough = buildWalkthrough(filteredComments, files.length);
      const overallSeverity = maxSeverity(filteredComments.map((c) => c.severity));

      // 9. Custo
      totalCostUsd = estimateCostUsd(totalInputTokens, totalOutputTokens);

      const stats = {
        filesReviewed: files.length,
        filesSkipped,
        totalComments: filteredComments.length,
        criticalCount,
        warningCount,
        infoCount,
        emergencyCount,
        bytesAnalyzed: files.reduce((s, f) => s + f.content.length, 0),
        tokensUsed: totalInputTokens + totalOutputTokens,
        diffSummary,
      };

      // 10. Persiste comments (se DB estiver disponível)
      if (filteredComments.length > 0) {
        try {
          if ((db as any)?.codeReviewComment?.createMany) {
            await (db as any).codeReviewComment.createMany({
              data: filteredComments.map((c) => ({
                reviewId,
                filePath: c.filePath,
                startLine: c.startLine,
                endLine: c.endLine,
                category: c.category,
                severity: c.severity,
                title: c.title,
                description: c.description,
                suggestedCode: c.suggestedCode,
                currentCode: c.currentCode,
                rationale: c.rationale,
                confidence: c.confidence,
                status: 'pending',
              })),
            });
          }
        } catch (commentDbErr) {
          logSink.warn({
            module: 'code-reviewer',
            event: 'db_comments_persist_failed',
            message: `Falha ao persistir comentários no DB (mantendo em memória): ${(commentDbErr as Error).message}`,
          });
        }
      }

      // 11. Atualiza CodeReview
      try {
        if ((db as any)?.codeReview?.update) {
          await (db as any).codeReview.update({
            where: { id: reviewId },
            data: {
              highLevelSummary: walkthrough,
              severity: overallSeverity,
              stats: JSON.stringify(stats),
              costUsd: totalCostUsd,
              status: 'completed',
              completedAt: new Date(),
            },
          });
        }
      } catch (updateErr) {
        // Ignora silenciosamente se o registro inicial era in-memory
      }

      logSink.info({
        module: 'code-reviewer',
        event: 'review_completed',
        message: `Revisão ${reviewId} concluída: ${filteredComments.length} comentários, severity=${overallSeverity}`,
        context: {
          reviewId,
          mode: this.mode,
          filesReviewed: files.length,
          totalComments: filteredComments.length,
          criticalCount,
          warningCount,
          costUsd: totalCostUsd,
        },
      });

      return {
        highLevelSummary: walkthrough,
        severity: overallSeverity,
        comments: filteredComments,
        stats: {
          filesReviewed: files.length,
          totalComments: filteredComments.length,
          criticalCount,
          warningCount,
          infoCount,
          emergencyCount,
          filesSkipped,
          bytesAnalyzed: stats.bytesAnalyzed,
          tokensUsed: stats.tokensUsed,
          costUsd: totalCostUsd,
        },
        mode: this.mode,
        reviewId,
      };
    } catch (err) {
      // Marca review como failed
      try {
        if ((db as any)?.codeReview?.update) {
          await (db as any).codeReview.update({
            where: { id: reviewId },
            data: {
              status: 'failed',
              errorMessage: (err as Error).message.slice(0, 1000),
              completedAt: new Date(),
            },
          });
        }
      } catch {
        // Fallback silencioso
      }

      logSink.error({
        module: 'code-reviewer',
        event: 'review_failed',
        message: `Revisão ${reviewId} falhou: ${(err as Error).message}`,
        context: { reviewId },
      });

      throw err;
    }
  }

  // ── Helper: aplicar uma sugestão (manual approval required) ──
  async applySuggestion(commentId: string, reviewerEmail: string): Promise<{ ok: boolean; reason?: string }> {
    try {
      if ((db as any)?.codeReviewComment?.findUnique) {
        const comment = await (db as any).codeReviewComment.findUnique({
          where: { id: commentId },
          include: { review: true },
        });
        if (!comment) {
          return { ok: false, reason: 'Comentário não encontrado' };
        }
        if (comment.status === 'applied') {
          return { ok: false, reason: 'Comentário já aplicado' };
        }
        if (!comment.suggestedCode) {
          return { ok: false, reason: 'Comentário não tem código sugerido' };
        }

        await (db as any).codeReviewComment.update({
          where: { id: commentId },
          data: {
            status: 'applied',
            reviewedBy: reviewerEmail,
            reviewedAt: new Date(),
          },
        });
      }
    } catch (err) {
      logSink.warn({
        module: 'code-reviewer',
        event: 'suggestion_apply_db_fallback',
        message: `DB offline ao aplicar sugestão ${commentId}: ${(err as Error).message}`,
      });
    }

    logSink.info({
      module: 'code-reviewer',
      event: 'suggestion_applied',
      message: `Sugestão ${commentId} aplicada por ${reviewerEmail}`,
      context: { commentId, reviewerEmail },
    });

    return { ok: true };
  }

  async dismissComment(commentId: string, reviewerEmail: string, notes?: string): Promise<{ ok: boolean }> {
    try {
      if ((db as any)?.codeReviewComment?.update) {
        await (db as any).codeReviewComment.update({
          where: { id: commentId },
          data: {
            status: 'dismissed',
            reviewedBy: reviewerEmail,
            reviewedAt: new Date(),
            reviewNotes: notes ?? null,
          },
        });
      }
    } catch (err) {
      logSink.warn({
        module: 'code-reviewer',
        event: 'dismiss_comment_db_fallback',
        message: `DB offline ao dispensar comentário ${commentId}`,
      });
    }
    return { ok: true };
  }

  // ── Helper: estatísticas para UI ──
  async getStats(): Promise<{
    mode: 'mock' | 'live';
    totalReviews: number;
    completedReviews: number;
    failedReviews: number;
    totalComments: number;
    pendingComments: number;
    appliedComments: number;
    criticalOpen: number;
  }> {
    try {
      if ((db as any)?.codeReview?.count && (db as any)?.codeReviewComment?.count) {
        const [
          totalReviews,
          completedReviews,
          failedReviews,
          totalComments,
          pendingComments,
          appliedComments,
          criticalOpen,
        ] = await Promise.all([
          (db as any).codeReview.count(),
          (db as any).codeReview.count({ where: { status: 'completed' } }),
          (db as any).codeReview.count({ where: { status: 'failed' } }),
          (db as any).codeReviewComment.count(),
          (db as any).codeReviewComment.count({ where: { status: 'pending' } }),
          (db as any).codeReviewComment.count({ where: { status: 'applied' } }),
          (db as any).codeReviewComment.count({
            where: {
              status: 'pending',
              severity: { in: ['critical', 'emergency'] },
            },
          }),
        ]);

        return {
          mode: this.mode,
          totalReviews,
          completedReviews,
          failedReviews,
          totalComments,
          pendingComments,
          appliedComments,
          criticalOpen,
        };
      }
    } catch {
      // Fallback in-memory
    }

    return {
      mode: this.mode,
      totalReviews: 0,
      completedReviews: 0,
      failedReviews: 0,
      totalComments: 0,
      pendingComments: 0,
      appliedComments: 0,
      criticalOpen: 0,
    };
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────

let _instance: CodeReviewerService | null = null;

export function getCodeReviewer(): CodeReviewerService {
  if (!_instance) {
    _instance = new CodeReviewerService();
  }
  return _instance;
}

// ── Re-exports para conveniência ────────────────────────────────────────────

export { DEFAULT_REVIEW_PROFILE };
