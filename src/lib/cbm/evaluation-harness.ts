/**
 * CBM Evaluation Harness — Simula codebase-memory-mcp localmente
 * ============================================================================
 *
 * O CBM real é um binário C que indexa o repositório em um knowledge graph.
 * Este harness SIMULA o comportamento do CBM usando grep + AST básico,
 * permitindo que o ZéCode faça queries estruturais SEM instalar o binário.
 *
 * Quando o CBM real for instalado (PR #22 merge), este harness é substituído
 * pela chamada MCP real. A interface (queryCodebase) permanece a mesma.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, join, extname } from 'node:path';

export interface CodeSymbol {
  name: string;
  type: 'function' | 'class' | 'route' | 'model' | 'interface' | 'type';
  file: string;
  line: number;
  exported: boolean;
}

export interface CallEdge {
  from: string;
  to: string;
  fromFile: string;
  toFile: string;
}

export interface ArchitectureOverview {
  languages: Record<string, number>;
  totalFiles: number;
  totalSymbols: number;
  routes: string[];
  models: string[];
  hotspots: Array<{ file: string; symbolCount: number }>;
  deadCode: Array<{ name: string; file: string; line: number }>;
}

export interface CodebaseQueryResult {
  query: string;
  symbols: CodeSymbol[];
  edges?: CallEdge[];
  overview?: ArchitectureOverview;
  durationMs: number;
}

function indexCodebase(rootDir: string): { symbols: CodeSymbol[]; edges: CallEdge[] } {
  const symbols: CodeSymbol[] = [];
  const edges: CallEdge[] = [];
  const files: string[] = [];

  function walkDir(dir: string) {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        if (['node_modules', '.next', 'dist', '.git', 'upload', 'tool-results'].includes(entry)) continue;
        walkDir(fullPath);
      } else if (['.ts', '.tsx'].includes(extname(fullPath)) && !entry.endsWith('.d.ts')) {
        files.push(fullPath);
      }
    }
  }

  walkDir(rootDir);

  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf8');
      const relPath = relative(rootDir, file);
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        const fnMatch = line.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
        if (fnMatch) {
          symbols.push({ name: fnMatch[1], type: 'function', file: relPath, line: i + 1, exported: line.includes('export') });
          continue;
        }

        const arrowMatch = line.match(/^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(/);
        if (arrowMatch) {
          symbols.push({ name: arrowMatch[1], type: 'function', file: relPath, line: i + 1, exported: line.includes('export') });
          continue;
        }

        const classMatch = line.match(/^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/);
        if (classMatch) {
          symbols.push({ name: classMatch[1], type: 'class', file: relPath, line: i + 1, exported: line.includes('export') });
          continue;
        }

        const ifaceMatch = line.match(/^(?:export\s+)?interface\s+(\w+)/);
        if (ifaceMatch) {
          symbols.push({ name: ifaceMatch[1], type: 'interface', file: relPath, line: i + 1, exported: line.includes('export') });
          continue;
        }

        const typeMatch = line.match(/^(?:export\s+)?type\s+(\w+)/);
        if (typeMatch) {
          symbols.push({ name: typeMatch[1], type: 'type', file: relPath, line: i + 1, exported: line.includes('export') });
          continue;
        }

        const routeMatch = line.match(/^export\s+const\s+(GET|POST|PUT|DELETE|PATCH)\s*=/);
        if (routeMatch) {
          const routePath = relPath.replace('src/app/api/', '/api/').replace('/route.ts', '').replace(/\[([^\]]+)\]/g, ':$1');
          symbols.push({ name: `${routeMatch[1]} ${routePath}`, type: 'route', file: relPath, line: i + 1, exported: true });
        }
      }

      // Prisma models
      if (file.endsWith('schema.prisma')) {
        for (let i = 0; i < lines.length; i++) {
          const modelMatch = lines[i].match(/^model\s+(\w+)\s*\{/);
          if (modelMatch) {
            symbols.push({ name: modelMatch[1], type: 'model', file: relative(rootDir, file), line: i + 1, exported: true });
          }
        }
      }

      // Import edges
      for (let i = 0; i < lines.length; i++) {
        const importMatch = lines[i].match(/from\s+['"]@\/([^'"]+)['"]/);
        if (importMatch) {
          edges.push({ from: relPath, to: `src/${importMatch[1]}`, fromFile: relPath, toFile: `src/${importMatch[1]}` });
        }
      }
    } catch {}
  }

  return { symbols, edges };
}

let cachedIndex: { symbols: CodeSymbol[]; edges: CallEdge[]; rootDir: string } | null = null;

function getIndex(rootDir: string) {
  if (cachedIndex && cachedIndex.rootDir === rootDir) return cachedIndex;
  const index = indexCodebase(rootDir);
  cachedIndex = { ...index, rootDir };
  return index;
}

export function searchGraph(query: string, rootDir: string = process.cwd()): CodebaseQueryResult {
  const start = Date.now();
  const { symbols } = getIndex(rootDir);
  let results: CodeSymbol[] = [];

  if (query.startsWith('function:')) {
    results = symbols.filter(s => s.type === 'function' && s.name.includes(query.slice(10)));
  } else if (query.startsWith('route:')) {
    results = symbols.filter(s => s.type === 'route' && s.name.includes(query.slice(6)));
  } else if (query.startsWith('model:')) {
    results = symbols.filter(s => s.type === 'model' && s.name.includes(query.slice(6)));
  } else {
    results = symbols.filter(s => s.name.toLowerCase().includes(query.toLowerCase()) || s.file.toLowerCase().includes(query.toLowerCase()));
  }

  return { query, symbols: results, durationMs: Date.now() - start };
}

export function tracePath(functionName: string, rootDir: string = process.cwd()): CodebaseQueryResult {
  const start = Date.now();
  const { symbols } = getIndex(rootDir);
  const callers: CodeSymbol[] = [];

  try {
    const grepResult = execFileSync('grep', ['-rln', '--include=*.ts', '--include=*.tsx', functionName, 'src/'], { timeout: 5000, encoding: 'utf8' }).trim();
    const callerFiles = grepResult.split('\n').filter(Boolean);
    for (const file of callerFiles) {
      const relPath = relative(rootDir, file);
      const content = readFileSync(file, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(functionName) && !lines[i].includes('import')) {
          callers.push({ name: `${functionName} caller`, type: 'function', file: relPath, line: i + 1, exported: false });
          break;
        }
      }
    }
  } catch {}

  return { query: `trace:${functionName}`, symbols: callers, durationMs: Date.now() - start };
}

export function detectDeadCode(rootDir: string = process.cwd()): CodebaseQueryResult {
  const start = Date.now();
  const { symbols } = getIndex(rootDir);
  const deadCode: CodeSymbol[] = [];

  for (const symbol of symbols) {
    if (symbol.type !== 'function' || !symbol.exported) continue;
    try {
      execFileSync('grep', ['-rln', '--include=*.ts', '--include=*.tsx', symbol.name, 'src/'], { timeout: 3000, encoding: 'utf8' });
      // If grep succeeds (exit 0), the name was found — but check if it's only in its own file
      const grepResult = execFileSync('grep', ['-rln', '--include=*.ts', '--include=*.tsx', symbol.name, 'src/'], { timeout: 3000, encoding: 'utf8' }).trim();
      const files = grepResult.split('\n').filter(f => f && !f.endsWith(symbol.file));
      if (files.length === 0) deadCode.push(symbol);
    } catch {
      deadCode.push(symbol);
    }
  }

  return { query: 'detect:dead-code', symbols: deadCode, durationMs: Date.now() - start };
}

export function getArchitecture(rootDir: string = process.cwd()): CodebaseQueryResult {
  const start = Date.now();
  const { symbols } = getIndex(rootDir);
  const routes = symbols.filter(s => s.type === 'route').map(s => s.name);
  const models = symbols.filter(s => s.type === 'model').map(s => s.name);

  const fileCount: Record<string, number> = {};
  for (const s of symbols) fileCount[s.file] = (fileCount[s.file] || 0) + 1;
  const hotspots = Object.entries(fileCount).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([file, count]) => ({ file, symbolCount: count }));

  let deadCode: Array<{ name: string; file: string; line: number }> = [];
  try { deadCode = detectDeadCode(rootDir).symbols.map(s => ({ name: s.name, file: s.file, line: s.line })); } catch {}

  return { query: 'architecture', symbols: [], overview: { languages: { TypeScript: 1 }, totalFiles: Object.keys(fileCount).length, totalSymbols: symbols.length, routes, models, hotspots, deadCode: deadCode.slice(0, 20) }, durationMs: Date.now() - start };
}

export async function queryCodebase(query: string): Promise<CodebaseQueryResult> {
  if (query.startsWith('trace:')) return tracePath(query.slice(6));
  if (query === 'detect:dead-code') return detectDeadCode();
  if (query === 'architecture') return getArchitecture();
  return searchGraph(query);
}
