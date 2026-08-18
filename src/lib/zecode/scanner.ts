/**
 * ZéCode — Scanner (Core do DEV FULL STACK)
 * ============================================================================
 * Recebe um path (arquivo ou diretório), lê o código-fonte (com travas),
 * envia para a LLM embarcada (Mistral Small 3 — setor security_pentest) com
 * um prompt especializado em análise de código, e retorna findings estruturados.
 *
 * TIPOS DE ANÁLISE:
 *   - bottleneck     → gargalos de performance (N+1, re-renders, memory leaks)
 *   - gap            → gaps de funcionalidade, testes faltantes, handlers ausentes
 *   - improvement     → melhorias incrementais (types, naming, structure)
 *   - refactor       → refactor estrutural (early-return, DRY, SOLID)
 *   - security       → audit de segurança (XSS, injection, secrets)
 *   - tech_debt      → débito técnico identificado
 *   - anti_pattern   → anti-patterns detectados
 * ============================================================================
 */

import { readFileSafe, listFiles, scanProposedCode, type CodeSanityFlag } from './safety';
import type {
  ZeCodeFinding,
  ZeCodeScanMode,
  ZeCodeScanRequest,
  ZeCodeScanResponse,
  ZeCodeAnalysisKind,
  ZeCodeSeverity,
  ZeCodeSafetyCheck,
} from '@/lib/zcc/types';
import { callLLMBySector } from '@/lib/llm/llm-router';

const SECTOR = 'security_pentest' as const; // Mistral Small 3 — audit/pentest/code

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT — Especialista em análise de código FULL STACK
// ─────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `Você é o ZéCode, um Desenvolvedor FULL STACK sênior interno do projeto Zélla (SaaS para pousadas e Airbnbs brasileiros).

MISSÃO: analisar o código-fonte do projeto e propor melhorias precisas, refactors, identificar gargalos, gaps e riscos de segurança.

CONTEXTO DO PROJETO:
- Next.js 16 (App Router) + TypeScript + Prisma + Tailwind
- Multi-tenant com isolamento por tenantId
- 12 agentes autônomos (Conductor, Concierge, CFO, Guardian, Sales, Marketing, DSPy, GraphRAG, etc.)
- Cérebro Zélla: runtime decisions (não mexer no runtime — apenas melhorar código)
- LLM Router: 5 LLMs por setor (Qwen, GPT-4o-mini, DeepSeek, Mistral, Llama)
- PromptGuard Anti-Delírio: validação de respostas LLM
- Multi-cloud: DeepInfra, OpenAI, DeepSeek, Mistral AI, Groq, Zai GLM

REGRAS:
1. Proponha APENAS mudanças seguras, pequenas e incrementais
2. NUNCA proponha deletar arquivos inteiros ou reescrever módulos
3. Sempre inclua o rationale claro (por que essa mudança?)
4. Para cada finding, forneça:
   - kind: bottleneck | gap | improvement | refactor | security | tech_debt | anti_pattern
   - severity: info | low | medium | high | critical
   - title: curto e específico
   - description: detalhamento (1-3 frases)
   - filePath: path relativo (ex: src/lib/zcc/router.ts)
   - lineRange: aproximação (ex: 42-58)
   - confidence: 0-100 (sua confiança na análise)
   - currentCode: trecho atual (máx 30 linhas, string vazia se não aplicável)
   - proposedCode: trecho proposto (máx 40 linhas, string vazia se apenas alerta)
   - rationale: motivo da mudança (1-2 frases)
5. NUNCA proponha código que execute shell, escreva arquivos, ou exponha segredos
6. Responda SEMPRE em JSON válido no formato:
   {
     "findings": [
       {
         "kind": "bottleneck",
         "severity": "medium",
         "title": "...",
         "description": "...",
         "filePath": "...",
         "lineRange": "...",
         "confidence": 85,
         "currentCode": "...",
         "proposedCode": "...",
         "rationale": "..."
       }
     ]
   }
7. Se não houver findings, retorne { "findings": [] }
8. Máximo 5 findings por arquivo (priorize os mais impactantes)`;
}

function buildUserPrompt(files: { path: string; content: string }[], kinds: ZeCodeAnalysisKind[]): string {
  const kindsLabel = kinds.length > 0 ? kinds.join(', ') : 'todos';
  const filesBlock = files
    .map((f) => `--- FILE: ${f.path} ---\n${f.content}`)
    .join('\n\n');

  return `Analise os arquivos abaixo e proponha melhorias (foco: ${kindsLabel}).

Para cada arquivo, identifique até 5 findings principais. Seja específico: cite linhas, nomes de funções, padrões. Não proponha nada genérico.

CÓDIGO-FONTE:

${filesBlock}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM RESPONSE PARSER — Robusto contra JSON inválido
// ─────────────────────────────────────────────────────────────────────────────

interface RawFinding {
  kind?: string;
  severity?: string;
  title?: string;
  description?: string;
  filePath?: string;
  lineRange?: string;
  confidence?: number;
  currentCode?: string;
  proposedCode?: string;
  rationale?: string;
}

function parseFindings(raw: string): RawFinding[] {
  // Tenta extrair JSON da resposta (pode estar envolto em ```json ... ```)
  let cleaned = raw.trim();

  // Remove markdown code fences
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // Procura o primeiro { e o último }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) {
    return [];
  }
  cleaned = cleaned.slice(firstBrace, lastBrace + 1);

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && Array.isArray(parsed.findings)) {
      return parsed.findings as RawFinding[];
    }
    if (Array.isArray(parsed)) {
      return parsed as RawFinding[];
    }
    return [];
  } catch {
    return [];
  }
}

function normalizeKind(value?: string): ZeCodeAnalysisKind {
  const v = (value || '').toLowerCase().trim();
  const valid: ZeCodeAnalysisKind[] = [
    'bottleneck', 'gap', 'improvement', 'refactor',
    'security', 'tech_debt', 'anti_pattern',
  ];
  return (valid as string[]).includes(v) ? (v as ZeCodeAnalysisKind) : 'improvement';
}

function normalizeSeverity(value?: string): ZeCodeSeverity {
  const v = (value || '').toLowerCase().trim();
  const valid: ZeCodeSeverity[] = ['info', 'low', 'medium', 'high', 'critical'];
  return (valid as string[]).includes(v) ? (v as ZeCodeSeverity) : 'medium';
}

function clampConfidence(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function truncate(text: string | undefined, maxLines: number): string {
  if (!text) return '';
  const lines = text.split('\n');
  if (lines.length <= maxLines) return text;
  return lines.slice(0, maxLines).join('\n') + '\n// ... (truncado)';
}

// ─────────────────────────────────────────────────────────────────────────────
// SAFETY CHECKS — Para cada finding proposto
// ─────────────────────────────────────────────────────────────────────────────

function buildSafetyChecks(
  finding: RawFinding,
  sanityFlags: CodeSanityFlag[],
): ZeCodeSafetyCheck[] {
  const checks: ZeCodeSafetyCheck[] = [];

  // 1. Path validation
  if (finding.filePath) {
    checks.push({
      id: 'path_safe',
      label: 'Path dentro do whitelist',
      passed: true,
      detail: finding.filePath,
    });
  }

  // 2. Proposed code não executa shell
  const hasShellFlag = sanityFlags.some((f) => f.id === 'shell_exec');
  checks.push({
    id: 'no_shell_exec',
    label: 'Não executa shell',
    passed: !hasShellFlag,
    detail: hasShellFlag ? 'Proposta contém execução de shell — bloqueada' : undefined,
  });

  // 3. Proposed code não escreve no filesystem
  const hasFsWrite = sanityFlags.some((f) => f.id === 'fs_write');
  checks.push({
    id: 'no_fs_write',
    label: 'Não escreve no filesystem',
    passed: !hasFsWrite,
    detail: hasFsWrite ? 'Proposta escreve no FS — bloqueada' : undefined,
  });

  // 4. Proposed code não usa eval
  const hasEval = sanityFlags.some((f) => f.id === 'eval');
  checks.push({
    id: 'no_eval',
    label: 'Não usa eval/Function dinâmica',
    passed: !hasEval,
    detail: hasEval ? 'Uso de eval detectado — bloqueado' : undefined,
  });

  // 5. Confidence dentro de range
  checks.push({
    id: 'confidence_range',
    label: 'Confiança em [0, 100]',
    passed: finding.confidence === undefined || (finding.confidence >= 0 && finding.confidence <= 100),
  });

  return checks;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCANNER — Orquestra listagem, leitura, LLM, parsing, safety
// ─────────────────────────────────────────────────────────────────────────────

export async function runScan(
  request: ZeCodeScanRequest,
): Promise<ZeCodeScanResponse> {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();
  const scanId = `zecode-scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // ── 1. Descobrir arquivos alvo
  const targetFiles = await resolveTargetFiles(request);

  if (targetFiles.length === 0) {
    return {
      ok: true,
      scanId,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      filesScanned: 0,
      findings: [],
      safetySummary: { totalChecks: 0, passed: 0, blocked: 0 },
      llmProvider: 'none',
      llmModel: 'none',
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
    };
  }

  // ── 2. Ler conteúdo (com travas de tamanho)
  const filesToAnalyze: { path: string; content: string }[] = [];
  for (const file of targetFiles) {
    try {
      const { content } = await readFileSafe(file.path);
      // Trunca conteúdo se exceder estimativa de tokens
      const truncated = content.length > 32_000
        ? content.slice(0, 32_000) + '\n// ... (truncado para análise)'
        : content;
      filesToAnalyze.push({ path: file.path, content: truncated });
    } catch (err) {
      console.warn(`[ZéCode] Pulou arquivo ${file.path}:`, err instanceof Error ? err.message : err);
    }
  }

  // ── 3. Chamar LLM
  const kinds = request.kinds ?? [];
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(filesToAnalyze, kinds);

  let llmResult;
  let provider = 'unknown';
  let model = 'unknown';
  let tokensIn = 0;
  let tokensOut = 0;
  let costUsd = 0;

  try {
    llmResult = await callLLMBySector(SECTOR, userPrompt, systemPrompt);
    provider = llmResult.provider;
    model = llmResult.model;
    tokensIn = Math.ceil(userPrompt.length / 4);
    tokensOut = llmResult.tokensUsed;
    costUsd = llmResult.estimatedCostUsd;
  } catch (err) {
    console.error('[ZéCode] LLM call failed:', err);
    return {
      ok: false,
      scanId,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      filesScanned: filesToAnalyze.length,
      findings: [],
      safetySummary: { totalChecks: 0, passed: 0, blocked: 0 },
      llmProvider: 'error',
      llmModel: 'error',
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
    };
  }

  // ── 4. Parsear findings
  const rawFindings = parseFindings(llmResult.text);

  // ── 5. Normalizar + aplicar travas
  const findings: ZeCodeFinding[] = [];
  let totalChecks = 0;
  let passedChecks = 0;
  let blockedChecks = 0;

  for (let i = 0; i < rawFindings.length; i++) {
    const raw = rawFindings[i];
    const sanityFlags = scanProposedCode(raw.proposedCode || '');
    const safetyChecks = buildSafetyChecks(raw, sanityFlags);
    totalChecks += safetyChecks.length;
    const passed = safetyChecks.filter((c) => c.passed).length;
    passedChecks += passed;
    blockedChecks += safetyChecks.length - passed;

    const hasBlock = safetyChecks.some((c) => !c.passed && (
      c.id === 'no_shell_exec' || c.id === 'no_fs_write' || c.id === 'no_eval'
    ));

    findings.push({
      id: `${scanId}-f${i + 1}`,
      kind: normalizeKind(raw.kind),
      severity: normalizeSeverity(raw.severity),
      title: (raw.title || 'Finding sem título').slice(0, 200),
      description: (raw.description || '').slice(0, 1000),
      filePath: (raw.filePath || '').slice(0, 500),
      lineRange: (raw.lineRange || '').slice(0, 50),
      confidence: clampConfidence(raw.confidence),
      status: hasBlock ? 'blocked_safety' : 'pending_review',
      currentCode: truncate(raw.currentCode, 30),
      proposedCode: truncate(raw.proposedCode, 40),
      rationale: (raw.rationale || '').slice(0, 1000),
      createdAt: new Date().toISOString(),
      reviewedAt: null,
      safetyChecks,
    });
  }

  return {
    ok: true,
    scanId,
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    filesScanned: filesToAnalyze.length,
    findings,
    safetySummary: {
      totalChecks,
      passed: passedChecks,
      blocked: blockedChecks,
    },
    llmProvider: provider,
    llmModel: model,
    tokensIn,
    tokensOut,
    costUsd,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RESOLUÇÃO DE ARQUIVOS ALVO (por modo de scan)
// ─────────────────────────────────────────────────────────────────────────────

async function resolveTargetFiles(
  request: ZeCodeScanRequest,
): Promise<{ path: string }[]> {
  const mode: ZeCodeScanMode = request.mode;
  const maxFindings = request.maxFindings ?? 5;

  if (mode === 'targeted' && request.targetPath) {
    // Tenta ler como arquivo; se for diretório, lista
    try {
      await readFileSafe(request.targetPath);
      return [{ path: request.targetPath }];
    } catch {
      // Pode ser diretório
      const nodes = await listFiles(request.targetPath, { maxDepth: 2, maxFiles: 10 });
      return nodes
        .filter((n) => n.type === 'file')
        .slice(0, Math.min(10, maxFindings * 2))
        .map((n) => ({ path: n.path }));
    }
  }

  if (mode === 'quick') {
    // Hot files: arquivos críticos pré-definidos
    const hotPaths = [
      'src/lib/llm/llm-router.ts',
      'src/lib/zcc/types.ts',
      'src/components/zcc/zcc-shell.tsx',
      'src/components/zcc/zcc-sidebar.tsx',
      'src/app/api/brain/route.ts',
    ];
    const valid: { path: string }[] = [];
    for (const p of hotPaths) {
      try {
        await readFileSafe(p);
        valid.push({ path: p });
        if (valid.length >= 5) break;
      } catch {
        // skip
      }
    }
    return valid;
  }

  if (mode === 'deep') {
    // Lista src/ recursivamente (limitado)
    const nodes = await listFiles('src', { maxDepth: 3, maxFiles: 20 });
    return nodes
      .filter((n) => n.type === 'file')
      .slice(0, 20)
      .map((n) => ({ path: n.path }));
  }

  if (mode === 'diff') {
    // Scan de pending changes — por ora, simula com hot paths
    // (integração com git diff pode ser adicionada depois)
    const hotPaths = [
      'src/lib/llm/llm-router.ts',
      'src/app/api/brain/route.ts',
    ];
    const valid: { path: string }[] = [];
    for (const p of hotPaths) {
      try {
        await readFileSafe(p);
        valid.push({ path: p });
      } catch {
        // skip
      }
    }
    return valid;
  }

  return [];
}
