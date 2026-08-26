// ============================================================================
// ZÉLLA — Path Instructions Loader (Code Reviewer)
// ============================================================================
// Carrega as `path_instructions` e `instructions` globais que orientam a
// revisão. Source-of-truth: arquivo `.coderabbit.yaml` na raiz do projeto.
//
// ESTRATÉGIA:
//  - Em runtime, espelhamos o conteúdo do .coderabbit.yaml em TypeScript
//    (DEFAULT_PATH_INSTRUCTIONS em ./types.ts) — garantindo que mudanças
//    no YAML sejam refletidas no código após sync manual.
//  - Permite também extensão via DB (model CodeReviewConfig) para que o
//    admin do ZCC adicione/remova instruções sem deploy.
//  - Mantém um cache em memória (5min TTL) para evitar queries repetidas.
// ============================================================================

import { db } from '@/lib/db';
import {
  DEFAULT_PATH_INSTRUCTIONS,
  DEFAULT_REVIEW_PROFILE,
  DEFAULT_PATH_FILTERS_EXCLUDE,
  type PathInstruction,
} from './types';

// ── Cache ───────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
let cache: { ts: number; data: LoadedInstructions } | null = null;

interface LoadedInstructions {
  /** Instruções globais (instructions: do YAML) */
  globalProfile: string;
  /** Path instructions específicas */
  pathInstructions: PathInstruction[];
  /** Padrões de exclusão (path_filters: do YAML) */
  excludePatterns: string[];
  /** Profile de revisão: "assertive" | "gentle" */
  reviewProfile: 'assertive' | 'gentle';
  /** High-level summary habilitado? */
  highLevelSummary: boolean;
  /** Walkthrough collapsed? */
  collapseWalkthrough: boolean;
  /** Sequence diagrams habilitados? (reservado p/ futura feature) */
  sequenceDiagrams: boolean;
}

// ── Loader: lê do DB e mescla com defaults ──────────────────────────────────

async function loadFromDB(): Promise<Partial<LoadedInstructions>> {
  try {
    const rows = await db.codeReviewConfig.findMany({
      where: {
        key: {
          in: ['global_profile', 'path_instructions', 'exclude_patterns', 'review_profile'],
        },
      },
    });

    const result: Partial<LoadedInstructions> = {};
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.value);
        if (row.key === 'global_profile' && typeof parsed === 'string') {
          result.globalProfile = parsed;
        } else if (row.key === 'path_instructions' && Array.isArray(parsed)) {
          result.pathInstructions = parsed.filter(
            (p): p is PathInstruction =>
              typeof p === 'object' && p !== null && typeof p.path === 'string' && typeof p.instructions === 'string',
          );
        } else if (row.key === 'exclude_patterns' && Array.isArray(parsed)) {
          result.excludePatterns = parsed.filter((p) => typeof p === 'string');
        } else if (row.key === 'review_profile' && (parsed === 'assertive' || parsed === 'gentle')) {
          result.reviewProfile = parsed;
        }
      } catch {
        // ignore parse errors — fall back to defaults
      }
    }
    return result;
  } catch {
    // DB indisponível — usa defaults
    return {};
  }
}

// ── Main: loadInstructions ──────────────────────────────────────────────────

export async function loadInstructions(): Promise<LoadedInstructions> {
  // Check cache
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return cache.data;
  }

  const dbOverrides = await loadFromDB();

  const data: LoadedInstructions = {
    globalProfile: dbOverrides.globalProfile ?? DEFAULT_REVIEW_PROFILE,
    pathInstructions: dbOverrides.pathInstructions ?? DEFAULT_PATH_INSTRUCTIONS,
    excludePatterns: dbOverrides.excludePatterns ?? DEFAULT_PATH_FILTERS_EXCLUDE,
    reviewProfile: dbOverrides.reviewProfile ?? 'assertive',
    highLevelSummary: true,
    collapseWalkthrough: false,
    sequenceDiagrams: true,
  };

  cache = { ts: Date.now(), data };
  return data;
}

// ── Helper: selecionar path instructions aplicáveis a um arquivo ────────────

export function selectInstructionsForPath(
  filePath: string,
  pathInstructions: PathInstruction[],
): string[] {
  const applicable: string[] = [];

  for (const instr of pathInstructions) {
    if (globMatch(instr.path, filePath)) {
      applicable.push(`[Path: ${instr.path}]\n${instr.instructions}`);
    }
  }

  return applicable;
}

// ── Helper: glob match (simplificado, suporta ** e *) ───────────────────────

function globMatch(pattern: string, path: string): boolean {
  let re = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLESTAR::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DOUBLESTAR::/g, '.*')
    .replace(/\?/g, '.');

  if (!re.endsWith('$')) re += '$';
  if (!re.startsWith('^')) re = `^${ re}`;

  try {
    return new RegExp(re).test(path);
  } catch {
    return false;
  }
}

// ── Helper: limpar cache (para testes) ──────────────────────────────────────

export function clearInstructionsCache(): void {
  cache = null;
}
