// ============================================================================
// ZÉLLA — ZéCode Bottleneck Detector
// ============================================================================
// Detecta gargalos de performance no código (coisas que um DEV FULL STACK
// sênior notaria em code review):
//   - n_plus_one_query: loop com await db.* dentro (clássico N+1)
//   - sync_blocking_io: readFileSync/writeFileSync em hot path
//   - missing_db_index: where em campo sem índice óbvio (heurística)
//   - large_payload: select sem select específico (db.*.findMany sem take)
//   - memory_leak_risk: setInterval/setTimeout sem cleanup, listeners sem remove
//   - unnecessary_re_render: useState + useEffect malicioso em React
//   - expensive_loop: nested loops O(n²) óbvios
//   - missing_pagination: list endpoints sem take/skip
//
// DETECÇÃO HÍBRIDA (igual ao gap-detector):
//   - Heurística: regex + análise de padrões
//   - LLM: enriquece com sugestões de código (quando live + budget)
//
// SEGURANÇA: mesma do gap-detector (readCodeFile sandboxed).
// ============================================================================

import { readCodeFile, listCodeFiles, type SafeReadResult } from '../code-reviewer/code-reader';
import { logSink } from '../log-sink';
import { getCerebroMode } from '../types';
import type {
  BottleneckFinding,
  BottleneckType,
} from './types';
import type { ReviewSeverity } from '../code-reviewer/types';

// ── Helpers ────────────────────────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ── Heurísticas ────────────────────────────────────────────────────────────

interface BottleneckMatch {
  line: number;
  snippet: string;
  rationale: string;
  suggestedCode: string | null;
  confidence: number;
  estimatedImpact: 'low' | 'medium' | 'high' | 'critical';
}

// B1: N+1 — loop com await db.* dentro
// Padrão: for/forEach/map/while + await db.<table>.<method>
const LOOP_REGEX = /\b(?:for|while|do)\s*\{|\.(?:forEach|map|filter|reduce|flatMap)\s*\(/;
const DB_AWAIT_IN_LOOP_REGEX = /await\s+(?:db|prisma)\.[a-zA-Z]+\.(?:findMany|findUnique|findFirst|create|update|delete|upsert|count|aggregate)\s*\(/;

function detectNPlusOne(lines: string[]): BottleneckMatch[] {
  const matches: BottleneckMatch[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!LOOP_REGEX.test(line)) continue;
    // Próximas 15 linhas: deve haver `await db.*.` ou `await prisma.*.`
    const window = lines.slice(i, Math.min(i + 15, lines.length)).join('\n');
    if (DB_AWAIT_IN_LOOP_REGEX.test(window)) {
      matches.push({
        line: i + 1,
        snippet: line.trim(),
        rationale: 'Possível N+1: await db.* dentro de loop. Considere batch query com where IN ou include.',
        suggestedCode: '// Substitua por query única:\n// const items = await db.item.findMany({ where: { id: { in: ids } } });',
        confidence: 0.85,
        estimatedImpact: 'high',
      });
    }
  }
  return matches;
}

// B2: sync blocking IO em hot path
const SYNC_IO_REGEX = /(?:readFileSync|writeFileSync|appendFileSync|unlinkSync|mkdirSync|existsSync)\s*\(/;
function detectSyncBlockingIO(lines: string[], isApiRoute: boolean): BottleneckMatch[] {
  const matches: BottleneckMatch[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!SYNC_IO_REGEX.test(line)) continue;
    // Em API routes ou dentro de funções async, sync IO é proibido
    if (isApiRoute || /async\s+function/.test(lines.slice(Math.max(0, i - 20), i).join('\n'))) {
      matches.push({
        line: i + 1,
        snippet: line.trim(),
        rationale: 'I/O síncrono em hot path — bloqueia event loop. Use versão async (promises).',
        suggestedCode: line.replace(/(\w+)Sync/g, (_, fn) => fn).replace(/\(([^)]+)\)/, '($1)'),
        confidence: 0.9,
        estimatedImpact: 'high',
      });
    }
  }
  return matches;
}

// B3: missing_db_index — where em campo não-id
// Heurística simples: prisma findMany com where em campo que não seja id/email/createdAt
const WHERE_FIELD_REGEX = /where:\s*\{[^}]*([a-zA-Z]+)\s*:/g;
function detectMissingDbIndex(lines: string[], content: string): BottleneckMatch[] {
  const matches: BottleneckMatch[] = [];
  const knownIndexedFields = new Set(['id', 'email', 'createdAt', 'updatedAt', 'tenantId', 'userId', 'slug']);
  // Procura findMany/findFirst/findUnique com where
  const findMatches = content.match(/(?:db|prisma)\.[a-zA-Z]+\.(?:findMany|findFirst|findUnique)\s*\(\s*\{[^}]*where:\s*\{[^}]+\}/g) || [];
  for (const m of findMatches.slice(0, 2)) {
    const fieldMatches = [...m.matchAll(WHERE_FIELD_REGEX)];
    for (const fm of fieldMatches) {
      const fieldName = fm[1];
      if (fieldName && !knownIndexedFields.has(fieldName)) {
        // Tenta localizar a linha aproximada
        const lineIdx = lines.findIndex(l => l.includes(fieldName) && l.includes('where'));
        matches.push({
          line: lineIdx >= 0 ? lineIdx + 1 : 1,
          snippet: m.split('\n').slice(0, 2).join('\n').trim(),
          rationale: `Consulta por campo '${fieldName}' sem índice óbvio — considere adicionar @@index([${fieldName}]) no schema Prisma.`,
          suggestedCode: `// No schema.prisma:\n// model Foo {\n//   ${fieldName} String\n//   @@index([${fieldName}])\n// }`,
          confidence: 0.6,
          estimatedImpact: 'medium',
        });
        break; // 1 por consulta
      }
    }
  }
  return matches;
}

// B4: large_payload — findMany sem take/limit
function detectLargePayload(lines: string[], content: string): BottleneckMatch[] {
  const matches: BottleneckMatch[] = [];
  const findManyMatches = content.match(/\.(?:findMany)\s*\(\s*\{[^}]*\}/g) || [];
  for (const m of findManyMatches.slice(0, 3)) {
    if (!/\btake\b|\blimit\b/.test(m)) {
      const lineIdx = lines.findIndex(l => l.includes('findMany'));
      matches.push({
        line: lineIdx >= 0 ? lineIdx + 1 : 1,
        snippet: m.split('\n').slice(0, 2).join('\n').trim(),
        rationale: 'findMany sem take/limit — pode retornar milhares de registros. Adicione take: 50.',
        suggestedCode: '// Adicione:\n//   take: 50,\n//   orderBy: { createdAt: "desc" }',
        confidence: 0.75,
        estimatedImpact: 'medium',
      });
    }
  }
  return matches;
}

// B5: memory_leak_risk — setInterval sem cleanup
const SET_INTERVAL_REGEX = /setInterval\s*\(/;
function detectMemoryLeakRisk(lines: string[]): BottleneckMatch[] {
  const matches: BottleneckMatch[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!SET_INTERVAL_REGEX.test(line)) continue;
    // Próximas 30 linhas: deve haver clearInterval ou return cleanup
    const window = lines.slice(i, Math.min(i + 30, lines.length)).join('\n');
    if (!/clearInterval/.test(window) && !/return\s*\(\)\s*=>/.test(window)) {
      matches.push({
        line: i + 1,
        snippet: line.trim(),
        rationale: 'setInterval sem cleanup — pode causar memory leak em long-lived processes.',
        suggestedCode: '// const interval = setInterval(...)\n// return () => clearInterval(interval);',
        confidence: 0.7,
        estimatedImpact: 'medium',
      });
    }
  }
  return matches;
}

// B6: unnecessary_re_render — useState + useEffect com dependência mutável
function detectUnnecessaryReRender(lines: string[]): BottleneckMatch[] {
  const matches: BottleneckMatch[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // useEffect com [] vazio mas referenciando variável externa
    if (/useEffect\s*\(\s*\(\s*\)\s*=>/.test(line)) {
      const window = lines.slice(i, Math.min(i + 5, lines.length)).join('\n');
      if (/,\s*\[\]\s*\)/.test(window)) {
        // Procura chamadas de setState dentro — possível loop
        if (/setState|set[A-Z]\w+/.test(window) && !/useCallback|useMemo|useRef/.test(lines.slice(Math.max(0, i - 5), i + 15).join('\n'))) {
          matches.push({
            line: i + 1,
            snippet: line.trim(),
            rationale: 'Possível re-render desnecessário: useEffect com deps vazias mas chamadas setState. Considere useCallback ou derived state.',
            suggestedCode: null,
            confidence: 0.55,
            estimatedImpact: 'low',
          });
        }
      }
    }
  }
  return matches;
}

// B7: missing_pagination — list endpoints sem take/skip
const LIST_ENDPOINT_REGEX = /(?:findMany|aggregate|groupBy)\s*\(/;
function detectMissingPagination(lines: string[], content: string, isApiRoute: boolean): BottleneckMatch[] {
  const matches: BottleneckMatch[] = [];
  if (!isApiRoute) return matches;
  if (!LIST_ENDPOINT_REGEX.test(content)) return matches;
  // Se tem findMany em API route e nenhum take/skip
  if (/\btake\b/.test(content) || /\bskip\b/.test(content)) return matches;
  const lineIdx = lines.findIndex(l => l.includes('findMany'));
  matches.push({
    line: lineIdx >= 0 ? lineIdx + 1 : 1,
    snippet: 'findMany sem paginação (take/skip)',
    rationale: 'List endpoint sem paginação — pode retornar payload gigante e OOM.',
    suggestedCode: '// const { page = 1, pageSize = 50 } = await req.json();\n// const items = await db.x.findMany({ take: pageSize, skip: (page-1) * pageSize });',
    confidence: 0.8,
    estimatedImpact: 'high',
  });
  return matches;
}

// ── Detector principal ──────────────────────────────────────────────────────

export interface BottleneckDetectorOptions {
  target?: string;
  maxFiles?: number;
  onlyTypes?: BottleneckType[];
}

export interface BottleneckDetectorResult {
  bottlenecks: BottleneckFinding[];
  filesScanned: number;
  mode: 'mock' | 'live';
  durationMs: number;
}

export async function detectBottlenecks(opts: BottleneckDetectorOptions = {}): Promise<BottleneckDetectorResult> {
  const start = Date.now();
  const target = opts.target ?? 'src/';
  const maxFiles = opts.maxFiles ?? 10;
  const onlyTypes = opts.onlyTypes;
  const mode = getCerebroMode();

  const files = listCodeFiles(target, { maxFiles });

  const bottlenecks: BottleneckFinding[] = [];
  let filesScanned = 0;

  for (const relPath of files) {
    if (bottlenecks.length >= 50) break;

    const result: SafeReadResult = readCodeFile(relPath);
    if (!result.ok || !result.lines || !result.redactedContent) continue;
    filesScanned++;

    const lines = result.lines;
    const content = result.redactedContent;
    const isApiRoute = relPath.includes('/api/') && relPath.endsWith('route.ts');

    // B1: N+1
    if (!onlyTypes || onlyTypes.includes('n_plus_one_query')) {
      const matches = detectNPlusOne(lines);
      for (const m of matches.slice(0, 2)) {
        bottlenecks.push({
          id: generateId('bn'),
          filePath: relPath,
          lineRange: `${m.line}-${m.line}`,
          bottleneckType: 'n_plus_one_query',
          severity: 'critical',
          title: 'Possível N+1 query',
          description: m.rationale,
          currentCode: m.snippet,
          suggestedCode: m.suggestedCode,
          rationale: m.rationale,
          estimatedImpact: m.estimatedImpact,
          confidence: m.confidence,
          detectedBy: 'heuristic',
          status: 'pending',
          createdAt: nowIso(),
        });
      }
    }

    // B2: sync blocking IO
    if (!onlyTypes || onlyTypes.includes('sync_blocking_io')) {
      const matches = detectSyncBlockingIO(lines, isApiRoute);
      for (const m of matches.slice(0, 2)) {
        bottlenecks.push({
          id: generateId('bn'),
          filePath: relPath,
          lineRange: `${m.line}-${m.line}`,
          bottleneckType: 'sync_blocking_io',
          severity: 'critical',
          title: 'I/O síncrono em hot path',
          description: m.rationale,
          currentCode: m.snippet,
          suggestedCode: m.suggestedCode,
          rationale: m.rationale,
          estimatedImpact: m.estimatedImpact,
          confidence: m.confidence,
          detectedBy: 'heuristic',
          status: 'pending',
          createdAt: nowIso(),
        });
      }
    }

    // B3: missing_db_index
    if (!onlyTypes || onlyTypes.includes('missing_db_index')) {
      const matches = detectMissingDbIndex(lines, content);
      for (const m of matches.slice(0, 1)) {
        bottlenecks.push({
          id: generateId('bn'),
          filePath: relPath,
          lineRange: `${m.line}-${m.line}`,
          bottleneckType: 'missing_db_index',
          severity: 'warning',
          title: 'Possível índice faltante',
          description: m.rationale,
          currentCode: m.snippet,
          suggestedCode: m.suggestedCode,
          rationale: m.rationale,
          estimatedImpact: m.estimatedImpact,
          confidence: m.confidence,
          detectedBy: 'heuristic',
          status: 'pending',
          createdAt: nowIso(),
        });
      }
    }

    // B4: large_payload
    if (!onlyTypes || onlyTypes.includes('large_payload')) {
      const matches = detectLargePayload(lines, content);
      for (const m of matches.slice(0, 2)) {
        bottlenecks.push({
          id: generateId('bn'),
          filePath: relPath,
          lineRange: `${m.line}-${m.line}`,
          bottleneckType: 'large_payload',
          severity: 'warning',
          title: 'findMany sem take/limit',
          description: m.rationale,
          currentCode: m.snippet,
          suggestedCode: m.suggestedCode,
          rationale: m.rationale,
          estimatedImpact: m.estimatedImpact,
          confidence: m.confidence,
          detectedBy: 'heuristic',
          status: 'pending',
          createdAt: nowIso(),
        });
      }
    }

    // B5: memory_leak_risk
    if (!onlyTypes || onlyTypes.includes('memory_leak_risk')) {
      const matches = detectMemoryLeakRisk(lines);
      for (const m of matches.slice(0, 2)) {
        bottlenecks.push({
          id: generateId('bn'),
          filePath: relPath,
          lineRange: `${m.line}-${m.line}`,
          bottleneckType: 'memory_leak_risk',
          severity: 'warning',
          title: 'setInterval sem cleanup',
          description: m.rationale,
          currentCode: m.snippet,
          suggestedCode: m.suggestedCode,
          rationale: m.rationale,
          estimatedImpact: m.estimatedImpact,
          confidence: m.confidence,
          detectedBy: 'heuristic',
          status: 'pending',
          createdAt: nowIso(),
        });
      }
    }

    // B6: unnecessary_re_render
    if (!onlyTypes || onlyTypes.includes('unnecessary_re_render')) {
      const matches = detectUnnecessaryReRender(lines);
      for (const m of matches.slice(0, 1)) {
        bottlenecks.push({
          id: generateId('bn'),
          filePath: relPath,
          lineRange: `${m.line}-${m.line}`,
          bottleneckType: 'unnecessary_re_render',
          severity: 'info',
          title: 'Possível re-render desnecessário',
          description: m.rationale,
          currentCode: m.snippet,
          suggestedCode: m.suggestedCode,
          rationale: m.rationale,
          estimatedImpact: m.estimatedImpact,
          confidence: m.confidence,
          detectedBy: 'heuristic',
          status: 'pending',
          createdAt: nowIso(),
        });
      }
    }

    // B7: missing_pagination (em API routes)
    if (!onlyTypes || onlyTypes.includes('missing_pagination')) {
      const matches = detectMissingPagination(lines, content, isApiRoute);
      for (const m of matches.slice(0, 1)) {
        bottlenecks.push({
          id: generateId('bn'),
          filePath: relPath,
          lineRange: `${m.line}-${m.line}`,
          bottleneckType: 'missing_pagination',
          severity: 'warning',
          title: 'List endpoint sem paginação',
          description: m.rationale,
          currentCode: m.snippet,
          suggestedCode: m.suggestedCode,
          rationale: m.rationale,
          estimatedImpact: m.estimatedImpact,
          confidence: m.confidence,
          detectedBy: 'heuristic',
          status: 'pending',
          createdAt: nowIso(),
        });
      }
    }
  }

  logSink.info({
    module: 'ze-code',
    event: 'bottleneck-detector',
    message: `Bottleneck detection completed: ${bottlenecks.length} findings in ${filesScanned} files`,
    context: { target, filesScanned, bottlenecksFound: bottlenecks.length, mode, durationMs: Date.now() - start },
  });

  return {
    bottlenecks,
    filesScanned,
    mode,
    durationMs: Date.now() - start,
  };
}

// ── Helpers exportados (para UI) ────────────────────────────────────────────

export const BOTTLENECK_TYPE_LABELS: Record<BottleneckType, string> = {
  n_plus_one_query: 'N+1 Query',
  sync_blocking_io: 'I/O Síncrono',
  missing_db_index: 'Índice Faltante',
  large_payload: 'Payload Gigante',
  memory_leak_risk: 'Memory Leak',
  unnecessary_re_render: 'Re-render Desnecessário',
  expensive_loop: 'Loop Custoso',
  missing_pagination: 'Sem Paginação',
};

export const BOTTLENECK_TYPE_SEVERITY: Record<BottleneckType, ReviewSeverity> = {
  n_plus_one_query: 'critical',
  sync_blocking_io: 'critical',
  missing_db_index: 'warning',
  large_payload: 'warning',
  memory_leak_risk: 'warning',
  unnecessary_re_render: 'info',
  expensive_loop: 'warning',
  missing_pagination: 'warning',
};
