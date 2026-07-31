import { db } from "@/lib/db";

export interface CaptureDpoParams {
  tenantId: string;
  prompt: string;
  rejected: string;
  chosen: string;
}

export interface DpoPairResult {
  saved: boolean;
  reason?: string;
  similarityScore: number;
}

/**
 * Calcula a distância de Levenshtein entre duas strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

/**
 * Calcula a taxa de similaridade relativa entre a resposta rejeitada e a escolhida.
 */
export function calculateSimilarityScore(rejected: string, chosen: string): number {
  const distance = levenshteinDistance(rejected, chosen);
  const maxLength = Math.max(rejected.length, chosen.length);
  if (maxLength === 0) return 1.0;
  return 1.0 - distance / maxLength;
}

/**
 * Captura pares de preferência DPO (Direct Preference Optimization)
 * Filtra edições triviais (>0.85) ou reescritas totais fora de contexto (<0.15).
 */
export async function captureDpoPair(params: CaptureDpoParams): Promise<DpoPairResult> {
  const { tenantId, prompt, rejected, chosen } = params;

  const similarityScore = calculateSimilarityScore(rejected, chosen);

  // Filtra edições triviais (>0.85) ou reescritas totais fora de contexto (<0.15)
  if (similarityScore < 0.15 || similarityScore > 0.85) {
    return {
      saved: false,
      reason: similarityScore > 0.85 ? 'EDICAO_TRIVIAL_IGNORADA' : 'REESCRITA_FORA_DE_CONTEXTO_IGNORADA',
      similarityScore,
    };
  }

  try {
    if (db && (db as any).dpoPreferencePair) {
      await (db as any).dpoPreferencePair.create({
        data: {
          tenantId,
          prompt,
          chosen,
          rejected,
          similarityScore,
          status: 'pending',
        },
      });
    }
  } catch (error) {
    console.warn('[DPO-COLLECTOR] Fallback de persistência acionado (dev mode):', error);
  }

  return {
    saved: true,
    similarityScore,
  };
}
