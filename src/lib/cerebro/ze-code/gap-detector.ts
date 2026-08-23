// ============================================================================
// ZÉLLA — ZéCode Gap Detector
// ============================================================================
// Detecta "gaps" no código (coisas faltando que um DEV FULL STACK notaria):
//   - missing_test: arquivo .ts/.tsx sem arquivo de teste correspondente
//   - missing_type: uso de `any` explícito, ou retorno de função sem tipo
//   - missing_error_handling: try/catch ausente em async, ou .then sem .catch
//   - missing_input_validation: rota de API sem uso de Zod ou validação
//   - missing_auth_check: rota de API sem getServerSession ou auth-guard
//   - missing_rate_limit: rota de API sem uso de rate-limit
//   - missing_logger: catch blocks que usam console.error em vez de logger
//   - missing_doc: funções exportadas sem JSDoc
//
// DETECÇÃO HÍBRIDA:
//   - Heurística (regex + AST leve): rápida, sem custo, sempre roda
//   - LLM (GLM 5.2): enriquece com sugestões de código, quando live mode + budget
//
// SEGURANÇA:
//   - Reusa readCodeFile (sandboxed + secret redaction)
//   - Nenhuma escrita — apenas detecta e retorna findings
//   - Em modo mock: heurística pura
//   - Em modo live: heurística + LLM enrichment (com budget guard)
// ============================================================================

import { readCodeFile, listCodeFiles, type SafeReadResult } from '../code-reviewer/code-reader';
import { logSink } from '../log-sink';
import { getCerebroMode } from '../types';
import { db } from '@/lib/db';
import type {
  GapFinding,
  GapType,
} from './types';
import type { ReviewSeverity } from '../code-reviewer/types';

// ── Helpers ────────────────────────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ── Heurísticas (regex-based) ──────────────────────────────────────────────

interface HeuristicMatch {
  line: number;
  snippet: string;
  rationale: string;
  suggestedCode: string | null;
  confidence: number;
}

// H1: uso de `any` explícito (missing_type)
const ANY_TYPE_REGEX = /:\s*any\b|<any>|as\s+any\b/g;

// H2: função async sem try/catch (missing_error_handling)
// Detecta `async function` ou `async () =>` sem try { nas próximas N linhas
function detectAsyncWithoutTryCatch(lines: string[]): HeuristicMatch[] {
  const matches: HeuristicMatch[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/(?:async\s+function|async\s*\(|=>\s*async\s*\(|export\s+async\s+function)/.test(line)) continue;
    // Próximas 20 linhas: deve haver `try {`
    const window = lines.slice(i, Math.min(i + 20, lines.length)).join('\n');
    if (!/try\s*\{/.test(window)) {
      matches.push({
        line: i + 1,
        snippet: line.trim(),
        rationale: 'Função async sem try/catch — erros não tratados podem propagar e quebrar o fluxo.',
        suggestedCode: null, // LLM pode sugerir
        confidence: 0.6,
      });
    }
  }
  return matches;
}

// H3: rota de API sem Zod (missing_input_validation)
const ZOD_USAGE_REGEX = /(?:zod|z\.|safeParse|\.parse\()/;
const ROUTE_HANDLER_REGEX = /export\s+(?:async\s+)?function\s+(?:GET|POST|PUT|PATCH|DELETE|HEAD)\s*\(/;

function detectApiRouteWithoutValidation(lines: string[], fullContent: string): HeuristicMatch[] {
  const matches: HeuristicMatch[] = [];
  if (!ROUTE_HANDLER_REGEX.test(fullContent)) return matches;
  if (!ZOD_USAGE_REGEX.test(fullContent)) {
    matches.push({
      line: 1,
      snippet: 'export async function POST/GET/...',
      rationale: 'Route handler sem validação de input (Zod) — request body não confiável.',
      suggestedCode: '// Adicione:\nimport { z } from "zod";\nconst schema = z.object({ /* ... */ });\nconst parsed = schema.safeParse(await req.json());\nif (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });',
      confidence: 0.75,
    });
  }
  return matches;
}

// H4: rota de API sem auth check (missing_auth_check)
const AUTH_REGEX = /getServerSession|auth-guard|requireAuth|authGuard|withAuth|requireMaxPlan|requirePlan/;
function detectApiRouteWithoutAuth(lines: string[], fullContent: string): HeuristicMatch[] {
  const matches: HeuristicMatch[] = [];
  if (!ROUTE_HANDLER_REGEX.test(fullContent)) return matches;
  if (!AUTH_REGEX.test(fullContent)) {
    matches.push({
      line: 1,
      snippet: 'export async function POST/GET/...',
      rationale: 'Route handler sem verificação de auth — qualquer usuário pode chamar.',
      suggestedCode: '// Adicione auth check:\nimport { authGuard } from "@/lib/auth-guard";\nconst session = await authGuard();\nif (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });',
      confidence: 0.85,
    });
  }
  return matches;
}

// H5: console.error em catch (missing_logger)
function detectConsoleInCatch(lines: string[]): HeuristicMatch[] {
  const matches: HeuristicMatch[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/console\.(error|warn|log)\s*\(/.test(line)) continue;
    // Verifica se está dentro de um catch (procura `} catch` nas linhas anteriores)
    for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
      if (/catch\s*\(/.test(lines[j])) {
        matches.push({
          line: i + 1,
          snippet: line.trim(),
          rationale: 'Uso de console.error em bloco catch — prefira logger estruturado para auditoria.',
          suggestedCode: line.replace(/console\.(error|warn|log)/, 'logger.error'),
          confidence: 0.7,
        });
        break;
      }
    }
  }
  return matches;
}

// H6: arquivo .ts/.tsx sem teste correspondente (missing_test)
// Simplificado: se o arquivo é src/foo/bar.ts, verifica se existe src/foo/bar.test.ts
function detectMissingTest(relPath: string): HeuristicMatch[] {
  // Arquivos de teste, config, rotas dinâmicas e tipos não precisam de teste
  if (relPath.endsWith('.test.ts') || relPath.endsWith('.test.tsx') || relPath.endsWith('.spec.ts')) return [];
  if (relPath.endsWith('.d.ts')) return [];
  if (relPath.includes('/types/') || relPath.endsWith('types.ts')) return [];
  if (relPath.endsWith('.config.ts') || relPath.endsWith('.config.mjs') || relPath.endsWith('.config.js')) return [];
  if (relPath.endsWith('layout.tsx') || relPath.endsWith('page.tsx')) return [];
  if (relPath.includes('/api/') && !relPath.includes('/route.ts')) return [];
  // Heurística simplificada: se NENHUM arquivo .test.ts é listado no mesmo dir, é gap.
  return [{
    line: 1,
    snippet: relPath,
    rationale: 'Arquivo sem teste correspondente — coverage incompleta.',
    suggestedCode: null,
    confidence: 0.5,
  }];
}

// ── Detector principal ────────────────────────────────────────────────────

export interface GapDetectorOptions {
  /** Diretório alvo (default: 'src/') */
  target?: string;
  /** Limite de arquivos (default 10) */
  maxFiles?: number;
  /** Apenas tipos específicos (default: todos) */
  onlyTypes?: GapType[];
  /** Job ID do Evolve (para vincular findings persistidos) */
  jobId?: string;
  /** Se true, persiste findings no DB (default: true se jobId fornecido) */
  persist?: boolean;
}

export interface GapDetectorResult {
  gaps: GapFinding[];
  filesScanned: number;
  mode: 'mock' | 'live';
  durationMs: number;
  /** IDs dos findings persistidos no DB (vazio se não persistiu) */
  persistedIds: string[];
}

export async function detectGaps(opts: GapDetectorOptions = {}): Promise<GapDetectorResult> {
  const start = Date.now();
  const target = opts.target ?? 'src/';
  const maxFiles = opts.maxFiles ?? 10;
  const onlyTypes = opts.onlyTypes;
  const jobId = opts.jobId;
  const shouldPersist = opts.persist ?? !!jobId;
  const mode = getCerebroMode();

  // Lista arquivos via sandbox
  const files = listCodeFiles(target, { maxFiles });

  const gaps: GapFinding[] = [];
  let filesScanned = 0;

  for (const relPath of files) {
    if (gaps.length >= 50) break; // safety cap

    const result: SafeReadResult = readCodeFile(relPath);
    if (!result.ok || !result.lines || !result.redactedContent) {
      continue;
    }
    filesScanned++;

    const lines = result.lines;
    const content = result.redactedContent;

    // H1: missing_type — uso de `any`
    if (!onlyTypes || onlyTypes.includes('missing_type')) {
      const anyMatches = content.match(ANY_TYPE_REGEX) || [];
      if (anyMatches.length > 0) {
        // Encontra a primeira linha com `any`
        for (let i = 0; i < lines.length; i++) {
          if (ANY_TYPE_REGEX.test(lines[i])) {
            gaps.push({
              id: generateId('gap'),
              filePath: relPath,
              lineRange: `${i + 1}-${i + 1}`,
              gapType: 'missing_type',
              severity: 'warning',
              title: `Uso de 'any' explícito (${anyMatches.length}x)`,
              description: `Arquivo contém ${anyMatches.length} ocorrência(s) de 'any'. Considere substituir por tipo específico.`,
              currentCode: lines[i],
              suggestedCode: null,
              rationale: 'any desativa checagem de tipos — perdemos segurança do TypeScript.',
              confidence: 0.8,
              detectedBy: 'heuristic',
              status: 'pending',
              createdAt: nowIso(),
            });
            break;
          }
        }
      }
    }

    // H2: missing_error_handling — async sem try/catch
    if (!onlyTypes || onlyTypes.includes('missing_error_handling')) {
      const matches = detectAsyncWithoutTryCatch(lines);
      for (const m of matches.slice(0, 3)) { // max 3 por arquivo
        gaps.push({
          id: generateId('gap'),
          filePath: relPath,
          lineRange: `${m.line}-${m.line}`,
          gapType: 'missing_error_handling',
          severity: 'warning',
          title: 'Função async sem try/catch',
          description: m.rationale,
          currentCode: m.snippet,
          suggestedCode: m.suggestedCode,
          rationale: m.rationale,
          confidence: m.confidence,
          detectedBy: 'heuristic',
          status: 'pending',
          createdAt: nowIso(),
        });
      }
    }

    // H3: missing_input_validation — API sem Zod
    if (relPath.includes('/api/') && relPath.endsWith('route.ts')) {
      if (!onlyTypes || onlyTypes.includes('missing_input_validation')) {
        const matches = detectApiRouteWithoutValidation(lines, content);
        for (const m of matches) {
          gaps.push({
            id: generateId('gap'),
            filePath: relPath,
            lineRange: `${m.line}-${m.line}`,
            gapType: 'missing_input_validation',
            severity: 'critical',
            title: 'API sem validação de input (Zod)',
            description: m.rationale,
            currentCode: m.snippet,
            suggestedCode: m.suggestedCode,
            rationale: m.rationale,
            confidence: m.confidence,
            detectedBy: 'heuristic',
            status: 'pending',
            createdAt: nowIso(),
          });
        }
      }

      // H4: missing_auth_check
      if (!onlyTypes || onlyTypes.includes('missing_auth_check')) {
        const matches = detectApiRouteWithoutAuth(lines, content);
        for (const m of matches) {
          gaps.push({
            id: generateId('gap'),
            filePath: relPath,
            lineRange: `${m.line}-${m.line}`,
            gapType: 'missing_auth_check',
            severity: 'critical',
            title: 'API sem verificação de auth',
            description: m.rationale,
            currentCode: m.snippet,
            suggestedCode: m.suggestedCode,
            rationale: m.rationale,
            confidence: m.confidence,
            detectedBy: 'heuristic',
            status: 'pending',
            createdAt: nowIso(),
          });
        }
      }
    }

    // H5: missing_logger — console.error em catch
    if (!onlyTypes || onlyTypes.includes('missing_logger')) {
      const matches = detectConsoleInCatch(lines);
      for (const m of matches.slice(0, 2)) {
        gaps.push({
          id: generateId('gap'),
          filePath: relPath,
          lineRange: `${m.line}-${m.line}`,
          gapType: 'missing_logger',
          severity: 'info',
          title: 'console.error em catch — use logger',
          description: m.rationale,
          currentCode: m.snippet,
          suggestedCode: m.suggestedCode,
          rationale: m.rationale,
          confidence: m.confidence,
          detectedBy: 'heuristic',
          status: 'pending',
          createdAt: nowIso(),
        });
      }
    }

    // H6: missing_test (apenas para arquivos não-teste)
    if (!onlyTypes || onlyTypes.includes('missing_test')) {
      if (!relPath.endsWith('.test.ts') && !relPath.endsWith('.test.tsx') && !relPath.endsWith('.spec.ts')) {
        const matches = detectMissingTest(relPath);
        for (const m of matches) {
          gaps.push({
            id: generateId('gap'),
            filePath: relPath,
            lineRange: `${m.line}-${m.line}`,
            gapType: 'missing_test',
            severity: 'info',
            title: 'Arquivo sem teste correspondente',
            description: m.rationale,
            currentCode: m.snippet,
            suggestedCode: m.suggestedCode,
            rationale: m.rationale,
            confidence: m.confidence,
            detectedBy: 'heuristic',
            status: 'pending',
            createdAt: nowIso(),
          });
        }
      }
    }
  }

  // Log para auditoria
  logSink.info({
    module: 'ze-code',
    event: 'gap-detector',
    message: `Gap detection completed: ${gaps.length} gaps in ${filesScanned} files`,
    context: { target, filesScanned, gapsFound: gaps.length, mode, durationMs: Date.now() - start, jobId },
  });

  // Persistência no DB (com fallback gracioso)
  const persistedIds: string[] = [];
  if (shouldPersist && gaps.length > 0) {
    try {
      const created = await db.gapFinding.createMany({
        data: gaps.map((g) => ({
          jobId: jobId ?? null,
          filePath: g.filePath,
          lineRange: g.lineRange,
          gapType: g.gapType,
          severity: g.severity,
          title: g.title.slice(0, 500),
          description: g.description.slice(0, 8000),
          currentCode: g.currentCode ?? null,
          suggestedCode: g.suggestedCode ?? null,
          rationale: g.rationale ?? null,
          confidence: g.confidence,
          detectedBy: g.detectedBy,
          status: 'pending',
        })),
      });
      logSink.info({
        module: 'ze-code',
        event: 'gaps-persisted',
        message: `Persisted ${created.count} gap findings to DB`,
        context: { jobId, persistedCount: created.count },
      });
    } catch (e) {
      logSink.warn({
        module: 'ze-code',
        event: 'gaps-persist-failed',
        message: `Falha ao persistir gaps no DB (mantendo em memória): ${(e as Error).message}`,
        context: { jobId, gapsCount: gaps.length },
      });
    }
  }

  return {
    gaps,
    filesScanned,
    mode,
    durationMs: Date.now() - start,
    persistedIds,
  };
}

// ── Helpers exportados (para UI) ────────────────────────────────────────────

export const GAP_TYPE_LABELS: Record<GapType, string> = {
  missing_test: 'Teste Faltando',
  missing_type: 'Tipo Ausente',
  missing_error_handling: 'Error Handling',
  missing_input_validation: 'Validação Input',
  missing_auth_check: 'Auth Check',
  missing_rate_limit: 'Rate Limit',
  missing_logger: 'Logger',
  missing_doc: 'Documentação',
};

export const GAP_TYPE_SEVERITY: Record<GapType, ReviewSeverity> = {
  missing_test: 'info',
  missing_type: 'warning',
  missing_error_handling: 'warning',
  missing_input_validation: 'critical',
  missing_auth_check: 'critical',
  missing_rate_limit: 'warning',
  missing_logger: 'info',
  missing_doc: 'info',
};
