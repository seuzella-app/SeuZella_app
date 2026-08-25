/**
 * CBM Evaluation Harness — local structural approximation of codebase-memory-mcp.
 *
 * This is NOT the CBM binary. It provides the same high-level query contract so
 * ZéCode can be evaluated before the native MCP server is introduced.
 * No source code or credentials leave the process.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

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

const IGNORED_DIRS = new Set(['node_modules', '.next', 'dist', '.git', 'upload', 'tool-results', 'coverage']);
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx']);

function collectFiles(rootDir: string): string[] {
  const files: string[] = [];

  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      if (IGNORED_DIRS.has(entry)) continue;
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) walk(fullPath);
      else if (SOURCE_EXTENSIONS.has(extname(fullPath)) || entry === 'schema.prisma') files.push(fullPath);
    }
  }

  walk(rootDir);
  return files;
}

function routeName(relativeFile: string): string | null {
  const normalized = relativeFile.replace(/\\/g, '/');
  const match = normalized.match(/^src\/app\/api\/(.*)\/route\.(?:ts|tsx)$/);
  if (!match) return null;
  return `/api/${match[1].replace(/\[([^\]]+)\]/g, ':$1')}`;
}

function indexCodebase(rootDir: string): { symbols: CodeSymbol[]; edges: CallEdge[]; totalFiles: number; languages: Record<string, number> } {
  const symbols: CodeSymbol[] = [];
  const edges: CallEdge[] = [];
  const files = collectFiles(rootDir);
  const languages: Record<string, number> = {};

  for (const file of files) {
    const relPath = relative(rootDir, file).replace(/\\/g, '/');
    const ext = extname(file) || 'unknown';
    const language = ext === '.prisma' ? 'Prisma' : ['.ts', '.tsx', '.mts', '.cts'].includes(ext) ? 'TypeScript' : 'JavaScript';
    languages[language] = (languages[language] ?? 0) + 1;

    let content: string;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }
    const lines = content.split('\n');

    if (relPath.endsWith('schema.prisma')) {
      for (let i = 0; i < lines.length; i++) {
        const modelMatch = lines[i].match(/^\s*model\s+(\w+)\s*\{/);
        if (modelMatch) symbols.push({ name: modelMatch[1], type: 'model', file: relPath, line: i + 1, exported: true });
      }
      continue;
    }

    const routePath = routeName(relPath);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Route detection must happen BEFORE generic const-function detection.
      const routeMatch = line.match(/^\s*export\s+(?:async\s+)?(?:const|function)\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\b/);
      if (routeMatch && routePath) {
        symbols.push({ name: `${routeMatch[1]} ${routePath}`, type: 'route', file: relPath, line: i + 1, exported: true });
      }

      const fnMatch = line.match(/^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
      if (fnMatch) {
        symbols.push({ name: fnMatch[1], type: 'function', file: relPath, line: i + 1, exported: /\bexport\b/.test(line) });
      }

      const arrowMatch = line.match(/^\s*(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/);
      if (arrowMatch && !['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(arrowMatch[1])) {
        symbols.push({ name: arrowMatch[1], type: 'function', file: relPath, line: i + 1, exported: /\bexport\b/.test(line) });
      }

      const classMatch = line.match(/^\s*(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/);
      if (classMatch) symbols.push({ name: classMatch[1], type: 'class', file: relPath, line: i + 1, exported: /\bexport\b/.test(line) });

      const ifaceMatch = line.match(/^\s*(?:export\s+)?interface\s+(\w+)/);
      if (ifaceMatch) symbols.push({ name: ifaceMatch[1], type: 'interface', file: relPath, line: i + 1, exported: /\bexport\b/.test(line) });

      const typeMatch = line.match(/^\s*(?:export\s+)?type\s+(\w+)/);
      if (typeMatch) symbols.push({ name: typeMatch[1], type: 'type', file: relPath, line: i + 1, exported: /\bexport\b/.test(line) });
    }

    // Approximate import edges. This is deliberately labelled as structural,
    // not a substitute for the native CBM/LSP resolver.
    for (const line of lines) {
      const importMatch = line.match(/(?:from|import)\s*['"]@\/([^'"]+)['"]/);
      if (importMatch) {
        edges.push({ from: relPath, to: `src/${importMatch[1]}`, fromFile: relPath, toFile: `src/${importMatch[1]}` });
      }
    }
  }

  return { symbols, edges, totalFiles: files.length, languages };
}

let cachedIndex: ReturnType<typeof indexCodebase> & { rootDir: string } | null = null;

function getIndex(rootDir: string) {
  if (cachedIndex?.rootDir === rootDir) return cachedIndex;
  const index = indexCodebase(rootDir);
  cachedIndex = { ...index, rootDir };
  return cachedIndex;
}

export function searchGraph(query: string, rootDir: string = process.cwd()): CodebaseQueryResult {
  const start = Date.now();
  const { symbols } = getIndex(rootDir);
  const term = query.includes(':') ? query.slice(query.indexOf(':') + 1) : query;
  let results: CodeSymbol[];

  if (query.startsWith('function:')) results = symbols.filter(s => s.type === 'function' && s.name.includes(term));
  else if (query.startsWith('route:')) results = symbols.filter(s => s.type === 'route' && s.name.includes(term));
  else if (query.startsWith('model:')) results = symbols.filter(s => s.type === 'model' && s.name.includes(term));
  else results = symbols.filter(s => s.name.toLowerCase().includes(query.toLowerCase()) || s.file.toLowerCase().includes(query.toLowerCase()));

  return { query, symbols: results, durationMs: Date.now() - start };
}

export function tracePath(functionName: string, rootDir: string = process.cwd()): CodebaseQueryResult {
  const start = Date.now();
  const { symbols } = getIndex(rootDir);
  const callers: CodeSymbol[] = [];

  try {
    const output = execFileSync('grep', ['-rln', '--include=*.ts', '--include=*.tsx', functionName, 'src/'], { timeout: 5000, encoding: 'utf8' }).trim();
    for (const file of output.split('\n').filter(Boolean)) {
      const relPath = relative(rootDir, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      const lines = content.split('\n');
      const lineIndex = lines.findIndex(line => line.includes(functionName) && !/\b(import|export)\b/.test(line));
      if (lineIndex >= 0) callers.push({ name: `${functionName} caller`, type: 'function', file: relPath, line: lineIndex + 1, exported: false });
    }
  } catch { /* grep exit 1 means no matches; return an empty result */ }

  return { query: `trace:${functionName}`, symbols: callers, durationMs: Date.now() - start };
}

export function detectDeadCode(rootDir: string = process.cwd()): CodebaseQueryResult {
  const start = Date.now();
  const { symbols } = getIndex(rootDir);
  const deadCode: CodeSymbol[] = [];

  for (const symbol of symbols) {
    if (symbol.type !== 'function' || !symbol.exported) continue;
    try {
      const output = execFileSync('grep', ['-rnl', '--include=*.ts', '--include=*.tsx', symbol.name, 'src/'], { timeout: 3000, encoding: 'utf8' }).trim();
      const files = output.split('\n').filter(Boolean);
      // A symbol is only a candidate for dead code when its name is absent from
      // every other source file. This is intentionally conservative.
      if (files.length === 0 || files.every(file => relative(rootDir, file).replace(/\\/g, '/') === symbol.file)) deadCode.push(symbol);
    } catch { deadCode.push(symbol); }
  }

  return { query: 'detect:dead-code', symbols: deadCode, durationMs: Date.now() - start };
}

export function getArchitecture(rootDir: string = process.cwd()): CodebaseQueryResult {
  const start = Date.now();
  const { symbols, totalFiles, languages } = getIndex(rootDir);
  const routes = symbols.filter(s => s.type === 'route').map(s => s.name);
  const models = symbols.filter(s => s.type === 'model').map(s => s.name);
  const fileCount: Record<string, number> = {};
  for (const symbol of symbols) fileCount[symbol.file] = (fileCount[symbol.file] ?? 0) + 1;
  const hotspots = Object.entries(fileCount).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([file, symbolCount]) => ({ file, symbolCount }));
  const deadCode = detectDeadCode(rootDir).symbols.slice(0, 20).map(s => ({ name: s.name, file: s.file, line: s.line }));

  return {
    query: 'architecture',
    symbols: [],
    overview: { languages, totalFiles, totalSymbols: symbols.length, routes, models, hotspots, deadCode },
    durationMs: Date.now() - start,
  };
}

export async function queryCodebase(query: string): Promise<CodebaseQueryResult> {
  if (query.startsWith('trace:')) return tracePath(query.slice(6));
  if (query === 'detect:dead-code') return detectDeadCode();
  if (query === 'architecture') return getArchitecture();
  return searchGraph(query);
}
