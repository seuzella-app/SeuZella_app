// ============================================================================
// ZÉLLA — Git Diff Extractor (Code Reviewer)
// ============================================================================
// Extrai diff de mudanças do repositório git de forma SEGURA.
//
// GARANTIAS:
//  - Usa `child_process.execFileSync` (NÃO execSync/string) — sem shell injection
//  - Comando `git diff` é chamado com args explícitos (sem interpolação de string)
//  - Limites rígidos: max diff size (200KB), max arquivos (50), max linhas por hunk
//  - Paths retornados passam pela mesma allowlist de code-reader
//  - Output do git é sanitizado (paths relativos, sem metadata sensível)
//  - Em ambientes sem git ou fora de repo, retorna erro controlado
// ============================================================================

import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { isPathAllowed } from './code-reader';
import { redactSecrets } from './secret-redactor';

// ── Configuração ────────────────────────────────────────────────────────────

const MAX_DIFF_KB = 200; // 200KB total de diff
const MAX_DIFF_BYTES = MAX_DIFF_KB * 1024;
const MAX_FILES_IN_DIFF = 50;
const MAX_LINES_PER_HUNK = 200;
const GIT_TIMEOUT_MS = 10_000;

// ── Tipos ───────────────────────────────────────────────────────────────────

export interface DiffHunk {
  /** Linha antiga inicial (1-indexed) */
  oldStart: number;
  /** Quantidade de linhas antigas */
  oldLines: number;
  /** Linha nova inicial (1-indexed) */
  newStart: number;
  /** Quantidade de linhas novas */
  newLines: number;
  /** Conteúdo do hunk (com prefixos +/-/space) — secrets redactados */
  content: string;
  /** Linhas apenas adicionadas (sem prefix, para contexto) */
  addedLines: string[];
  /** Linhas apenas removidas */
  removedLines: string[];
}

export interface DiffFile {
  /** Path relativo ao repo (ex: "src/lib/auth.ts") */
  path: string;
  /** Status: "added" | "modified" | "deleted" | "renamed" */
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  /** Path anterior (apenas para renames) */
  oldPath?: string;
  /** Hunks de mudanças */
  hunks: DiffHunk[];
  /** Linhas adicionadas (com número de linha novo) */
  additions: { line: number; content: string }[];
  /** Linhas removidas (com número de linha antigo) */
  deletions: { line: number; content: string }[];
  /** Total de adições */
  additionsCount: number;
  /** Total de deleções */
  deletionsCount: number;
}

export interface DiffResult {
  ok: boolean;
  files: DiffFile[];
  /** Total de adições em todos os arquivos */
  totalAdditions: number;
  /** Total de deleções em todos os arquivos */
  totalDeletions: number;
  /** Tamanho em bytes do diff cru (antes de redact) */
  rawSizeBytes: number;
  /** Mensagem de erro (se !ok) */
  error?: string;
  errorCode?: 'not_a_repo' | 'git_failed' | 'diff_too_large' | 'diff_empty' | 'diff_timeout';
  /** Secrets redactados no diff (para auditoria) — vazio em caso de erro */
  redactedTypes: string[];
}

// ── Helper: obter root dir ───────────────────────────────────────────────────

function getRootDir(): string {
  return process.cwd();
}

// ── Helper: executar git com segurança ─────────────────────────────────────

function git(args: string[], cwd: string, timeout = GIT_TIMEOUT_MS): string {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      timeout,
      maxBuffer: 5 * 1024 * 1024, // 5MB cap
      stdio: ['pipe', 'pipe', 'pipe'],
    }).toString();
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { stderr?: Buffer; signal?: string };
    if (err.signal === 'SIGTERM') {
      throw new Error(`git timeout (${timeout}ms)`);
    }
    throw new Error(`git failed: ${err.stderr?.toString().trim() || err.message}`);
  }
}

// ── Main: extractDiff ───────────────────────────────────────────────────────

export function extractDiff(baseRef = 'origin/main', headRef = 'HEAD'): DiffResult {
  const root = getRootDir();

  // 1. Verifica se é um repo git
  if (!existsSync(join(root, '.git'))) {
    return {
      ok: false,
      files: [],
      totalAdditions: 0,
      totalDeletions: 0,
      rawSizeBytes: 0,
      redactedTypes: [],
      errorCode: 'not_a_repo',
      error: 'Diretório atual não é um repositório git',
    };
  }

  // 2. Verifica se base ref existe
  let baseSha: string;
  try {
    baseSha = git(['rev-parse', '--verify', baseRef], root).trim();
  } catch {
    // Fallback: tenta apenas 'main'
    try {
      baseSha = git(['rev-parse', '--verify', 'main'], root).trim();
    } catch {
      return {
        ok: false,
        files: [],
        totalAdditions: 0,
        totalDeletions: 0,
        rawSizeBytes: 0,
        redactedTypes: [],
        errorCode: 'not_a_repo',
        error: `Base ref não encontrada: ${baseRef}`,
      };
    }
  }

  // 3. Extrai diff cru
  let rawDiff: string;
  try {
    rawDiff = git(['diff', `${baseSha}..${headRef}`, '--no-color', '--no-ext-diff'], root);
  } catch (e) {
    return {
      ok: false,
      files: [],
      totalAdditions: 0,
      totalDeletions: 0,
      rawSizeBytes: 0,
      redactedTypes: [],
      errorCode: 'git_failed',
      error: (e as Error).message,
    };
  }

  if (!rawDiff || rawDiff.trim().length === 0) {
    return {
      ok: false,
      files: [],
      totalAdditions: 0,
      totalDeletions: 0,
      rawSizeBytes: 0,
      redactedTypes: [],
      errorCode: 'diff_empty',
      error: 'Diff vazio — nenhum arquivo modificado',
    };
  }

  // 4. Size check
  if (rawDiff.length > MAX_DIFF_BYTES) {
    return {
      ok: false,
      files: [],
      totalAdditions: 0,
      totalDeletions: 0,
      rawSizeBytes: rawDiff.length,
      redactedTypes: [],
      errorCode: 'diff_too_large',
      error: `Diff excede ${MAX_DIFF_KB}KB (${Math.round(rawDiff.length / 1024)}KB)`,
    };
  }

  // 5. Parse do diff
  const parsed = parseDiff(rawDiff);
  if (parsed.length === 0) {
    return {
      ok: false,
      files: [],
      totalAdditions: 0,
      totalDeletions: 0,
      rawSizeBytes: rawDiff.length,
      redactedTypes: [],
      errorCode: 'diff_empty',
      error: 'Nenhum arquivo de código no diff',
    };
  }

  // 6. Aplica allowlist (filtra arquivos não-permitidos)
  const allowedFiles = parsed.filter((f) => isPathAllowed(f.path));

  // 7. Limita a MAX_FILES_IN_DIFF
  const truncatedFiles = allowedFiles.slice(0, MAX_FILES_IN_DIFF);

  // 8. Calcula totais
  const totalAdditions = truncatedFiles.reduce((s, f) => s + f.additionsCount, 0);
  const totalDeletions = truncatedFiles.reduce((s, f) => s + f.deletionsCount, 0);

  // 9. Redact secrets em todos os hunks (já feito no parser, mas confirmamos aqui)
  const redactedTypes = new Set<string>();
  for (const f of truncatedFiles) {
    for (const h of f.hunks) {
      const r = redactSecrets(h.content);
      h.content = r.redacted;
      r.foundSecrets.forEach((s) => redactedTypes.add(s.type));
      h.addedLines = h.addedLines.map((l) => redactSecrets(l).redacted);
      h.removedLines = h.removedLines.map((l) => redactSecrets(l).redacted);
    }
    f.additions = f.additions.map((a) => ({
      line: a.line,
      content: redactSecrets(a.content).redacted,
    }));
    f.deletions = f.deletions.map((d) => ({
      line: d.line,
      content: redactSecrets(d.content).redacted,
    }));
  }

  return {
    ok: true,
    files: truncatedFiles,
    totalAdditions,
    totalDeletions,
    rawSizeBytes: rawDiff.length,
    redactedTypes: Array.from(redactedTypes),
  };
}

// ── Parser: git diff --no-color output ──────────────────────────────────────
// Formato esperado:
//   diff --git a/path b/path
//   index abc..def 100644
//   --- a/path
//   +++ b/path
//   @@ -oldStart,oldLines +newStart,newLines @@ context
//   (linhas do hunk)

function parseDiff(rawDiff: string): DiffFile[] {
  const files: DiffFile[] = [];
  const lines = rawDiff.split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Detecta início de arquivo
    if (!line.startsWith('diff --git ')) {
      i++;
      continue;
    }

    // Parse do path: "diff --git a/foo.ts b/foo.ts"
    const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (!match) {
      i++;
      continue;
    }
    const [, aPath, bPath] = match;

    // Avança para encontrar "--- a/..." e "+++ b/..."
    let oldPath = aPath;
    let newPath = bPath;
    let status: DiffFile['status'] = 'modified';

    // Próximas linhas: index line, --- / +++
    let j = i + 1;
    while (j < lines.length && !lines[j].startsWith('@@') && !lines[j].startsWith('diff --git ')) {
      const cur = lines[j];
      if (cur.startsWith('--- ')) {
        const p = cur.slice(4);
        if (p === '/dev/null') {
          status = 'added';
          oldPath = '';
        } else if (p.startsWith('a/')) {
          oldPath = p.slice(2);
        }
      } else if (cur.startsWith('+++ ')) {
        const p = cur.slice(4);
        if (p === '/dev/null') {
          status = 'deleted';
          newPath = '';
        } else if (p.startsWith('b/')) {
          newPath = p.slice(2);
        }
      } else if (cur.startsWith('rename from ')) {
        status = 'renamed';
        oldPath = cur.slice(12);
      } else if (cur.startsWith('rename to ')) {
        newPath = cur.slice(10);
      } else if (cur.startsWith('new file mode ')) {
        status = 'added';
      } else if (cur.startsWith('deleted file mode ')) {
        status = 'deleted';
      }
      j++;
    }

    const file: DiffFile = {
      path: newPath || oldPath,
      status,
      oldPath: status === 'renamed' ? oldPath : undefined,
      hunks: [],
      additions: [],
      deletions: [],
      additionsCount: 0,
      deletionsCount: 0,
    };

    if (status === 'renamed' && oldPath) {
      file.oldPath = oldPath;
    }

    // Parse hunks
    while (j < lines.length && (lines[j].startsWith('@@') || !lines[j].startsWith('diff --git '))) {
      if (j >= lines.length) break;
      const hunkLine = lines[j];

      if (hunkLine.startsWith('diff --git ')) {
        break;
      }

      if (!hunkLine.startsWith('@@')) {
        j++;
        continue;
      }

      // @@ -oldStart,oldLines +newStart,newLines @@ context
      const hunkMatch = hunkLine.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (!hunkMatch) {
        j++;
        continue;
      }

      const oldStart = parseInt(hunkMatch[1], 10);
      const oldLines = hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1;
      const newStart = parseInt(hunkMatch[3], 10);
      const newLines = hunkMatch[4] ? parseInt(hunkMatch[4], 10) : 1;

      j++; // avança para a primeira linha do hunk

      const hunkContent: string[] = [];
      const addedLines: string[] = [];
      const removedLines: string[] = [];
      let lineCount = 0;
      let curOldLine = oldStart;
      let curNewLine = newStart;

      while (j < lines.length && !lines[j].startsWith('@@') && !lines[j].startsWith('diff --git ')) {
        const cur = lines[j];
        // Linha vazia entre hunks é o fim do hunk
        if (cur === '' && j + 1 < lines.length && (lines[j + 1].startsWith('diff --git ') || lines[j + 1].startsWith('@@'))) {
          break;
        }

        if (cur.startsWith('+')) {
          const content = cur.slice(1);
          hunkContent.push(cur);
          addedLines.push(content);
          file.additions.push({ line: curNewLine, content });
          file.additionsCount++;
          curNewLine++;
        } else if (cur.startsWith('-')) {
          const content = cur.slice(1);
          hunkContent.push(cur);
          removedLines.push(content);
          file.deletions.push({ line: curOldLine, content });
          file.deletionsCount++;
          curOldLine++;
        } else if (cur.startsWith('\\')) {
          // "\ No newline at end of file" — skip
        } else if (cur.startsWith(' ')) {
          hunkContent.push(cur);
          curOldLine++;
          curNewLine++;
        } else if (cur === '') {
          // blank line (context)
          hunkContent.push(cur);
        } else {
          // linha desconhecida — provavelmente fim do hunk
          break;
        }

        j++;
        lineCount++;
        if (lineCount > MAX_LINES_PER_HUNK) break;
      }

      file.hunks.push({
        oldStart,
        oldLines,
        newStart,
        newLines,
        content: hunkContent.join('\n'),
        addedLines,
        removedLines,
      });
    }

    files.push(file);
    i = j;
  }

  return files;
}

// ── Helper: listar arquivos modificados (sem conteúdo) ──────────────────────
// Mais rápido que extractDiff para UI de "preview antes de revisar"

export function listModifiedFiles(baseRef = 'origin/main'): string[] {
  const root = getRootDir();
  if (!existsSync(join(root, '.git'))) return [];

  try {
    const baseSha = git(['rev-parse', '--verify', baseRef], root).trim();
    const output = git(['diff', '--name-only', `${baseSha}..HEAD`], root);
    return output
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((p) => isPathAllowed(p))
      .slice(0, MAX_FILES_IN_DIFF);
  } catch {
    return [];
  }
}

// ── Export de constantes ────────────────────────────────────────────────────

export const DIFF_LIMITS = {
  MAX_DIFF_KB,
  MAX_DIFF_BYTES,
  MAX_FILES_IN_DIFF,
  MAX_LINES_PER_HUNK,
  GIT_TIMEOUT_MS,
} as const;
