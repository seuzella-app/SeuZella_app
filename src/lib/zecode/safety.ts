/**
 * ZéCode — Safety Guards (Travas de Segurança)
 * ============================================================================
 * ZéCode é um agente DEV FULL STACK que atua sobre o código-fonte do projeto.
 * Por design, ZéCode é READ-ONLY no filesystem: ele propõe mudanças, nunca
 * aplica diretamente. Todas as mudanças passam por aprovação humana no painel
 * e são aplicadas via commit explicit pelo operador.
 *
 * O Cérebro Zélla opera em runtime (decisões em produção); o ZéCode opera
 * em código (análise, refactor, gargalos, gaps). Escopos distintos → sem
 * conflito, executam em paralelo.
 *
 * TRAVAS:
 *   1. WHITELIST de extensões (.ts, .tsx, .js, .jsx, .json, .prisma, .md)
 *   2. BLACKLIST de paths (.env*, .git, node_modules, build artifacts)
 *   3. Limite de tamanho por arquivo (256 KB)
 *   4. Limite de arquivos por scan (50)
 *   5. Limite de tokens por chamada LLM (8k in, 2k out)
 *   6. RAIZ obrigatória (src/, prisma/, package.json, tsconfig.json)
 *   7. NUNCA lê segredos (.env, .env.local, .env.production, etc.)
 *   8. NUNCA escreve no filesystem — só propõe
 * ============================================================================
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG — TRAVAS
// ─────────────────────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(process.cwd());

const ALLOWED_ROOTS = [
  'src',
  'prisma',
  'package.json',
  'tsconfig.json',
  'next.config.js',
  'next.config.mjs',
  'tailwind.config.ts',
  'postcss.config.mjs',
  'postcss.config.js',
  'components.json',
];

const ALLOWED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.prisma', '.mjs', '.cjs', '.md',
]);

const FORBIDDEN_PATTERNS: RegExp[] = [
  /(^|\/)\.env(\.|$)/i,           // .env, .env.local, .env.production
  /(^|\/)\.git(\/|$)/,
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)\.next(\/|$)/,
  /(^|\/)build(\/|$)/,
  /(^|\/)dist(\/|$)/,
  /(^|\/)coverage(\/|$)/,
  /(^|\/)\.turbo(\/|$)/,
  /(^|\/)\.cache(\/|$)/,
  /(^|\/)\.swc(\/|$)/,
  /\.log$/i,
  /(^|\/)lock\b/i,                // yarn.lock, package-lock.json
  /(^|\/)\.pnp(\.|$)/,
];

const MAX_FILE_SIZE_BYTES = 256 * 1024; // 256 KB
const MAX_FILES_PER_SCAN = 50;
const MAX_FILE_TOKENS_ESTIMATE = 8_000;  // ~4:1 chars→tokens
const MAX_LLM_OUTPUT_TOKENS = 2_000;

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export interface SafetyCheckResult {
  passed: boolean;
  reason?: string;
  normalizedPath?: string;
}

export interface FileNode {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  language?: string;
  children?: FileNode[];
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDAÇÃO DE PATH — TRAVA CENTRAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida se um path é seguro para leitura pelo ZéCode.
 * Aplica whitelist de raiz + extensões + blacklist de padrões proibidos.
 * Retorna path normalizado (absoluto) ou falha com motivo.
 */
export function validatePath(relativePath: string): SafetyCheckResult {
  if (!relativePath || typeof relativePath !== 'string') {
    return { passed: false, reason: 'Path vazio' };
  }

  // Normaliza contra path traversal
  const normalized = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
  const absolute = path.resolve(PROJECT_ROOT, normalized);

  // TRAVA: path deve estar dentro do PROJECT_ROOT
  if (!absolute.startsWith(PROJECT_ROOT)) {
    return { passed: false, reason: 'Path fora do projeto (path traversal)' };
  }

  // TRAVA: blacklisted patterns
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(normalized) || pattern.test(absolute)) {
      return { passed: false, reason: `Path proibido por trava de segurança: ${normalized}` };
    }
  }

  // TRAVA: deve estar em uma das raízes permitidas
  const relativeToRoot = path.relative(PROJECT_ROOT, absolute);
  const topSegment = relativeToRoot.split(path.sep)[0];

  if (!ALLOWED_ROOTS.includes(topSegment) && !ALLOWED_ROOTS.includes(relativeToRoot)) {
    return { passed: false, reason: `Raiz não permitida: ${topSegment}` };
  }

  // TRAVA: extensão (apenas para arquivos)
  if (path.extname(normalized)) {
    const ext = path.extname(normalized).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return { passed: false, reason: `Extensão não permitida: ${ext}` };
    }
  }

  return { passed: true, normalizedPath: absolute };
}

/**
 * Lista arquivos de um diretório de forma segura (recursiva limitada).
 */
export async function listFiles(
  dir: string,
  options: { maxDepth?: number; maxFiles?: number } = {}
): Promise<FileNode[]> {
  const { maxDepth = 3, maxFiles = MAX_FILES_PER_SCAN } = options;
  const result: FileNode[] = [];
  let count = 0;

  async function walk(currentDir: string, depth: number): Promise<void> {
    if (depth > maxDepth || count >= maxFiles) return;

    const validation = validatePath(currentDir);
    if (!validation.passed || !validation.normalizedPath) return;

    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(validation.normalizedPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (count >= maxFiles) break;

      const entryPath = path.relative(PROJECT_ROOT, path.join(validation.normalizedPath!, entry.name));
      const entryValidation = validatePath(entryPath);
      if (!entryValidation.passed) continue;

      if (entry.isDirectory()) {
        result.push({
          path: entryPath,
          name: entry.name,
          type: 'directory',
          children: [],
        });
        count++;
        await walk(path.join(currentDir, entry.name), depth + 1);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ALLOWED_EXTENSIONS.has(ext)) {
          const stat = await fs.stat(entryValidation.normalizedPath!).catch(() => null);
          result.push({
            path: entryPath,
            name: entry.name,
            type: 'file',
            size: stat?.size,
            language: detectLanguage(ext),
          });
          count++;
        }
      }
    }
  }

  await walk(dir, 0);
  return result;
}

/**
 * Lê um arquivo de forma segura (com trava de tamanho).
 */
export async function readFileSafe(relativePath: string): Promise<{ content: string; size: number }> {
  const validation = validatePath(relativePath);
  if (!validation.passed || !validation.normalizedPath) {
    throw new Error(`ZéCode bloqueou leitura: ${validation.reason}`);
  }

  const stat = await fs.stat(validation.normalizedPath);
  if (stat.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Arquivo excede limite de ${MAX_FILE_SIZE_BYTES} bytes (${stat.size} bytes)`);
  }

  const content = await fs.readFile(validation.normalizedPath, 'utf-8');
  return { content, size: stat.size };
}

function detectLanguage(ext: string): string | undefined {
  const map: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescriptreact',
    '.js': 'javascript',
    '.jsx': 'javascriptreact',
    '.json': 'json',
    '.prisma': 'prisma',
    '.md': 'markdown',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
  };
  return map[ext];
}

export const SAFETY_LIMITS = {
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_SCAN,
  MAX_FILE_TOKENS_ESTIMATE,
  MAX_LLM_OUTPUT_TOKENS,
  ALLOWED_ROOTS,
  ALLOWED_EXTENSIONS: Array.from(ALLOWED_EXTENSIONS),
  FORBIDDEN_PATTERNS: FORBIDDEN_PATTERNS.map((r) => r.source),
};

/**
 * Trava de sanidade: garante que proposedCode nunca contém comandos perigosos.
 * Apenas sinaliza (não bloqueia) — o operador decide.
 */
export interface CodeSanityFlag {
  id: string;
  label: string;
  severity: 'info' | 'warning' | 'critical';
  detail: string;
}

const DANGEROUS_PATTERNS: { id: string; regex: RegExp; label: string; severity: CodeSanityFlag['severity']; detail: string }[] = [
  {
    id: 'shell_exec',
    regex: /\bchild_process\b|\bexec\s*\(|\bspawn\s*\(|\bexecSync\s*\(/,
    label: 'Shell execution',
    severity: 'critical',
    detail: 'Proposta executa comando shell — revise carefully antes de aplicar',
  },
  {
    id: 'fs_write',
    regex: /\bfs\.write|\bfs\.unlink|\bfs\.rm\s*\(|\bfs\.mkdir\b/,
    label: 'Filesystem write',
    severity: 'critical',
    detail: 'Proposta escreve/deleta arquivos — requer aprovação explícita',
  },
  {
    id: 'eval',
    regex: /\beval\s*\(|\bnew\s+Function\s*\(/,
    label: 'Dynamic eval',
    severity: 'critical',
    detail: 'Uso de eval/Function dinâmica — risco de injeção',
  },
  {
    id: 'env_secret',
    regex: /process\.env\.\w*(?:KEY|SECRET|PASSWORD|TOKEN|PRIVATE)\w*/i,
    label: 'Secret exposure',
    severity: 'warning',
    detail: 'Proposta referencia segredo do env — nunca logar nem retornar ao cliente',
  },
  {
    id: 'sql_raw',
    regex: /\$\$raw|\$queryRaw|\bexecute\s*\(\s*['"`]/,
    label: 'Raw SQL',
    severity: 'warning',
    detail: 'SQL raw detectado — risco de SQL injection se não parametrizado',
  },
  {
    id: 'disable_safe',
    regex: /@ts-nocheck|@ts-ignore|eslint-disable-next-line\s+@typescript-eslint\//,
    label: 'Safety override',
    severity: 'warning',
    detail: 'Proposta desabilita checagens de tipo/lint — use com moderação',
  },
  {
    id: 'http_external',
    regex: /fetch\s*\(\s*['"`]https?:\/\//,
    label: 'External HTTP',
    severity: 'info',
    detail: 'Proposta faz chamada HTTP externa — confirme o endpoint',
  },
];

export function scanProposedCode(proposedCode: string): CodeSanityFlag[] {
  const flags: CodeSanityFlag[] = [];
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.regex.test(proposedCode)) {
      flags.push({
        id: pattern.id,
        label: pattern.label,
        severity: pattern.severity,
        detail: pattern.detail,
      });
    }
  }
  return flags;
}
