// ============================================================================
// ZÉLLA — Code Reader (Code Reviewer — Sandboxed File Access)
// ============================================================================
// Camada OBRIGATÓRIA entre o filesystem e o serviço de revisão.
//
// Garantias de segurança:
//  1. ALLOWLIST de extensões (.ts, .tsx, .js, .jsx, .mjs, .cjs, .json, .prisma)
//  2. BLOCKLIST de diretórios (node_modules, .next, .git, dist, build, etc.)
//  3. Padrões de SECRET no nome do arquivo são rejeitados (.env, *.secret, *.pem)
//  4. Limite de tamanho por arquivo (MAX_FILE_SIZE_KB = 100)
//  5. Resolução de path anti-traversal: normaliza, resolve, e checa se está
//     dentro da ROOT_DIR (raiz do projeto)
//  6. Symlinks NÃO são seguidos (proteção contra escape)
//  7. Tudo que é lido passa por `redactSecrets()` ANTES de retornar
//  8. NUNCA lê arquivos que começam com . (exceto .coderabbit.yaml — para
//     inspeção de config)
//
// API pública:
//  - readCodeFile(relPath): SafeReadResult
//  - listCodeFiles(dirRelPath, opts): string[] (paths relativos)
//  - isPathAllowed(relPath): boolean
// ============================================================================

import { readFileSync, lstatSync, readdirSync, realpathSync, type Dirent } from 'fs';
import { join, resolve, relative, sep, extname } from 'path';
import { redactSecrets, type RedactionResult } from './secret-redactor';

// ── Configuração ────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_KB = 100; // 100KB por arquivo (código, não dados)
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_KB * 1024;

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.prisma', '.md',
]);

const SKIP_DIRS = new Set([
  'node_modules', '.next', '.git', 'dist', 'build', 'coverage',
  '__tests__', '__mocks__', '.cache', 'tmp', '.turbo', 'out',
  'test-screenshots', '.agents', '.antigravity', '.docs',
  'scripts', // scripts contêm código de teste/stress — não revisar
  'striker_runs', 'agent-ctx',
]);

// Heurística: se nome do arquivo bate com esses padrões, REJEITAR
const SECRET_NAME_PATTERNS = [
  /\.env/i, /\.secret/i, /secret\./i, /\btoken\b/i, /\bpassword\b/i,
  /\bapikey\b/i, /\bapi_key\b/i, /\bprivate_?key\b/i,
  /credentials?\.json$/i, /\.pem$/i, /\.key$/i,
];

// ── Root dir (project root) ──────────────────────────────────────────────────

function getRootDir(): string {
  // Em runtime Next.js, process.cwd() aponta para a raiz do projeto
  return process.cwd();
}

// ── Tipos ───────────────────────────────────────────────────────────────────

export interface SafeReadResult {
  ok: boolean;
  /** Path absoluto normalizado (se ok) */
  absPath?: string;
  /** Path relativo ao root (se ok) */
  relPath?: string;
  /** Conteúdo com segredos redactados (se ok) */
  redactedContent?: string;
  /** Estatísticas de redação (se ok) */
  redaction?: RedactionResult;
  /** Linhas (split por \n) do conteúdo redacted (se ok) */
  lines?: string[];
  /** Tamanho em bytes do conteúdo original (se ok) */
  sizeBytes?: number;
  /** Erro (se !ok) */
  error?: string;
  /** Código do erro (se !ok) */
  errorCode?:
  | 'path_not_allowed'
  | 'extension_blocked'
  | 'dir_skipped'
  | 'secret_name_pattern'
  | 'file_too_large'
  | 'not_found'
  | 'not_a_file'
  | 'symlink_detected'
  | 'outside_root'
  | 'read_error';
}

export interface ListOptions {
  /** Limite máximo de arquivos (default 50) */
  maxFiles?: number;
  /** Padrões de inclusão (glob simplificado, ex: todos os arquivos) */
  includePatterns?: string[];
  /** Padrões de exclusão (default: skip dirs listadas em SKIP_DIRS) */
  excludePatterns?: string[];
}

// ── Helper: path allowlist ───────────────────────────────────────────────────

export function isPathAllowed(relPath: string): boolean {
  if (!relPath || typeof relPath !== 'string') return false;

  // Rejeita path absoluto (deve ser relativo ao root)
  if (relPath.startsWith('/')) return false;

  // Rejeita path traversal
  if (relPath.includes('..')) return false;

  // Rejeita if começa com . (exceto .coderabbit.yaml)
  const baseName = relPath.split(sep).pop() || '';
  if (baseName.startsWith('.') && baseName !== '.coderabbit.yaml') return false;

  // Rejeita se qualquer segmento do path está em SKIP_DIRS
  const segments = relPath.split(sep);
  for (const seg of segments) {
    if (SKIP_DIRS.has(seg)) return false;
  }

  // Rejeita se nome do arquivo bate com padrão de secret
  if (SECRET_NAME_PATTERNS.some((p) => p.test(baseName))) return false;

  // Rejeita extensões não-permitidas
  const ext = extname(baseName).toLowerCase();
  if (ext && !CODE_EXTENSIONS.has(ext)) return false;

  return true;
}

// ── Helper: validar path após resolução (anti-traversal definitivo) ──────────

function assertPathInsideRoot(absPath: string, root: string): boolean {
  const normalizedRoot = realpathSync(root);
  try {
    const normalizedPath = resolve(absPath);
    const rel = relative(normalizedRoot, normalizedPath);
    // Se o path relativo começa com .. ou é absoluto → está fora do root
    if (!rel || rel.startsWith('..') || resolve(normalizedRoot, rel) !== normalizedPath) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ── Main: readCodeFile ──────────────────────────────────────────────────────

export function readCodeFile(relPath: string): SafeReadResult {
  const root = getRootDir();

  // 1. Allowlist check
  if (!isPathAllowed(relPath)) {
    return {
      ok: false,
      errorCode: 'path_not_allowed',
      error: `Path rejeitado pela allowlist: ${relPath}`,
    };
  }

  const absPath = join(root, relPath);

  // 2. Anti-traversal
  if (!assertPathInsideRoot(absPath, root)) {
    return {
      ok: false,
      errorCode: 'outside_root',
      error: `Path fora do root do projeto: ${relPath}`,
    };
  }

  let stat;
  try {
    // 3. Symlink check — lstat não segue symlinks
    stat = lstatSync(absPath);
    if (stat.isSymbolicLink()) {
      return {
        ok: false,
        errorCode: 'symlink_detected',
        error: `Symlink detectado (não permitido): ${relPath}`,
      };
    }
    if (!stat.isFile()) {
      return {
        ok: false,
        errorCode: 'not_a_file',
        error: `Não é arquivo regular: ${relPath}`,
      };
    }
  } catch {
    return {
      ok: false,
      errorCode: 'not_found',
      error: `Arquivo não encontrado: ${relPath}`,
    };
  }

  // 4. Size check
  if (stat.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      errorCode: 'file_too_large',
      error: `Arquivo excede ${MAX_FILE_SIZE_KB}KB (${Math.round(stat.size / 1024)}KB): ${relPath}`,
    };
  }

  // 5. Read
  let raw: string;
  try {
    raw = readFileSync(absPath, 'utf8');
  } catch (e) {
    return {
      ok: false,
      errorCode: 'read_error',
      error: `Erro de leitura: ${(e as Error).message}`,
    };
  }

  // 6. Redact secrets (OBRIGATÓRIO — mesmo em arquivos da allowlist)
  const redaction = redactSecrets(raw);

  return {
    ok: true,
    absPath,
    relPath,
    redactedContent: redaction.redacted,
    redaction,
    lines: redaction.redacted.split('\n'),
    sizeBytes: stat.size,
  };
}

// ── Helper: glob match simplificado ──────────────────────────────────────────

function matchGlob(pattern: string, path: string): boolean {
  // Converte glob simples (com ** e *) para regex
  // Ex: "src/app/api/**" → /^src\/app\/api\/.*$/
  // Ex: "*.ts" → /^.*\.ts$/
  let re = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLESTAR::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DOUBLESTAR::/g, '.*')
    .replace(/\?/g, '.');

  if (!re.endsWith('$')) re += '$';
  if (!re.startsWith('^')) re = '^' + re;

  try {
    return new RegExp(re).test(path);
  } catch {
    return false;
  }
}

// ── Main: listCodeFiles ────────────────────────────────────────────────────

export function listCodeFiles(
  dirRelPath: string,
  opts: ListOptions = {},
): string[] {
  const root = getRootDir();
  const maxFiles = opts.maxFiles ?? 50;
  const includePatterns = opts.includePatterns ?? ['**/*'];
  const excludePatterns = opts.excludePatterns ?? [];

  // Converte excludePatterns "!**/foo/**" para padrões positivos
  const excludes = excludePatterns
    .filter((p) => p.startsWith('!'))
    .map((p) => p.slice(1));

  const absDir = join(root, dirRelPath);

  // Anti-traversal
  if (!assertPathInsideRoot(absDir, root)) {
    return [];
  }

  const found: string[] = [];

  function walk(currentAbs: string) {
    if (found.length >= maxFiles) return;

    let entries: Dirent[];
    try {
      entries = readdirSync(currentAbs, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (found.length >= maxFiles) return;

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        // Symlink check
        const fullPath = join(currentAbs, entry.name);
        try {
          if (lstatSync(fullPath).isSymbolicLink()) continue;
        } catch {
          continue;
        }
        walk(fullPath);
      } else if (entry.isFile()) {
        const baseName = entry.name;
        if (baseName.startsWith('.') && baseName !== '.coderabbit.yaml') continue;

        const ext = extname(baseName).toLowerCase();
        if (ext && !CODE_EXTENSIONS.has(ext)) continue;

        if (SECRET_NAME_PATTERNS.some((p) => p.test(baseName))) continue;

        // Caminho relativo ao root
        const fullPath = join(currentAbs, baseName);
        const relPath = relative(root, fullPath).split(sep).join('/');

        // Aplica include patterns (pelo menos 1 deve casar)
        const included = includePatterns.some((p) => matchGlob(p, relPath));
        if (!included) continue;

        // Aplica exclude patterns (nenhum deve casar)
        const excluded = excludes.some((p) => matchGlob(p, relPath));
        if (excluded) continue;

        found.push(relPath);
      }
    }
  }

  try {
    const stat = lstatSync(absDir);
    if (stat.isDirectory()) {
      walk(absDir);
    } else if (stat.isFile()) {
      // Se passaram um arquivo único em vez de dir, retorna só ele (se allowlist ok)
      const relPath = relative(root, absDir).split(sep).join('/');
      if (isPathAllowed(relPath)) found.push(relPath);
    }
  } catch {
    return [];
  }

  return found.sort();
}

// ── Helper: ler trecho de linhas específicas (para comentários) ──────────────

export function readLineRange(relPath: string, startLine: number, endLine: number): string | null {
  const result = readCodeFile(relPath);
  if (!result.ok || !result.lines) return null;

  const start = Math.max(1, startLine);
  const end = Math.min(result.lines.length, endLine);
  if (start > end) return null;

  return result.lines.slice(start - 1, end).join('\n');
}

// ── Export de constantes para auditoria/UI ──────────────────────────────────

export const CODE_READER_LIMITS = {
  MAX_FILE_SIZE_KB,
  MAX_FILE_SIZE_BYTES,
  CODE_EXTENSIONS: Array.from(CODE_EXTENSIONS),
  SKIP_DIRS: Array.from(SKIP_DIRS),
  SECRET_NAME_PATTERNS: SECRET_NAME_PATTERNS.map((p) => p.source),
} as const;
