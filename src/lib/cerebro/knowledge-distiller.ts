// ============================================================================
// ZÉLLA — Knowledge Distiller (Cérebro Memory Consolidation)
// ============================================================================
// Extrai aprendizado de fontes esparsas e consolida em KnowledgeChunks:
//
//  FONTES:
//  1. DpoPreferencePair (chosen vs rejected) — pares aprovados por humanos
//  2. RefactorSuggestion (applied) — refatorações que funcionaram
//  3. BrainHealthLog — métricas de health por tenant
//  4. AnomalyEvent (acknowledged) — falsos positivos conhecidos
//  5. AuditLog (security alerts) — padrões de ataque vistos
//
//  DESTINO: KnowledgeChunk com source='distilled_knowledge'
//  - Cada chunk tem um padrão aprendido: "Quando X acontece, faça Y"
//  - Ex: "Quando hóspede pergunta sobre late check-in, responder com policy X"
//  - Ex: "Quando erro Z acontece em arquivo W, refatoração Y funciona"
//
//  CRON: Roda diariamente. Identifica padrões recorrentes (>= N ocorrências)
//  e cria KnowledgeChunks novos. Old chunks (>= 30 dias sem uso) são arquivados.
//
//  AUTO-APRENDIZADO LOOP:
//  RefactorSuggester consulta KnowledgeChunks ao propor novas refatorações.
//  Conforme rejeita/aprova sugestões, distiller consolida padrões.
//  Conforme tenants editam respostas IA (DPO), distiller aprende preferências.
// ============================================================================

import { db } from '@/lib/db';
import { logSink } from './log-sink';
import { getCerebroMode } from './types';

// ── Types ───────────────────────────────────────────────────────────────────

export interface DistilledKnowledge {
  source: 'dpo_pattern' | 'refactor_pattern' | 'anomaly_pattern' | 'brain_health_pattern';
  pattern: string;
  occurrences: number;
  confidence: number;
  content: string;
  metadata: Record<string, unknown>;
}

export interface DistillationResult {
  totalPairsAnalyzed: number;
  chunksCreated: number;
  chunksArchived: number;
  patterns: DistilledKnowledge[];
  durationMs: number;
  mode: 'mock' | 'live';
}

// ── Knowledge Distiller ─────────────────────────────────────────────────────

const MIN_OCCURRENCES_FOR_PATTERN = 3; // Mínimo de 3 ocorrências para virar KnowledgeChunk
const ARCHIVE_UNUSED_DAYS = 30;

export class KnowledgeDistiller {
  private mode: 'mock' | 'live';

  constructor() {
    this.mode = getCerebroMode();
  }

  /**
   * Executa ciclo completo de destilação de conhecimento.
   */
  async runDistillation(): Promise<DistillationResult> {
    const startTime = Date.now();
    const patterns: DistilledKnowledge[] = [];
    let chunksCreated = 0;
    let totalPairsAnalyzed = 0;

    // ── 1. Destila padrões de DPO (preferências de resposta) ──
    const dpoPatterns = await this.distillDpoPatterns();
    patterns.push(...dpoPatterns.patterns);
    totalPairsAnalyzed += dpoPatterns.analyzed;

    // ── 2. Destila padrões de refatoração bem-sucedida ──
    const refactorPatterns = await this.distillRefactorPatterns();
    patterns.push(...refactorPatterns.patterns);
    totalPairsAnalyzed += refactorPatterns.analyzed;

    // ── 3. Destila padrões de anomalia (falsos positivos conhecidos) ──
    const anomalyPatterns = await this.distillAnomalyPatterns();
    patterns.push(...anomalyPatterns.patterns);
    totalPairsAnalyzed += anomalyPatterns.analyzed;

    // ── 4. Persiste padrões em KnowledgeChunk ──
    for (const pattern of patterns) {
      if (pattern.occurrences < MIN_OCCURRENCES_FOR_PATTERN) continue;

      try {
        await db.knowledgeChunk.create({
          data: {
            source: 'distilled_knowledge',
            sourceRef: `${pattern.source}:${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            filePath: null,
            content: pattern.content,
            embedding: '[]',
            metadata: JSON.stringify({
              source: pattern.source,
              pattern: pattern.pattern,
              occurrences: pattern.occurrences,
              confidence: pattern.confidence,
              distilledAt: new Date().toISOString(),
              ...pattern.metadata,
            }),
          },
        });
        chunksCreated++;
      } catch (err) {
        logSink.warn({
          module: 'knowledge-distiller',
          event: 'chunk_persist_failed',
          message: `Falha ao persistir KnowledgeChunk para pattern "${pattern.pattern}"`,
          error: err,
        });
      }
    }

    // ── 5. Arquiva chunks antigos sem uso ──
    let chunksArchived = 0;
    try {
      const cutoff = new Date(Date.now() - ARCHIVE_UNUSED_DAYS * 24 * 60 * 60 * 1000);
      // NOTA: KnowledgeChunk não tem lastAccessedAt; usamos createdAt como aproximação
      // Apenas marca como archived via metadata update (não deleta — preserva história)
      const oldChunks = await db.knowledgeChunk.findMany({
        where: {
          source: 'distilled_knowledge',
          createdAt: { lt: cutoff },
        },
        select: { id: true, metadata: true },
        take: 100,
      });

      for (const chunk of oldChunks) {
        try {
          const meta = JSON.parse(chunk.metadata || '{}');
          if (meta.archived) continue; // já arquivado
          await db.knowledgeChunk.update({
            where: { id: chunk.id },
            data: {
              metadata: JSON.stringify({ ...meta, archived: true, archivedAt: new Date().toISOString() }),
            },
          });
          chunksArchived++;
        } catch {
          // skip
        }
      }
    } catch (err) {
      logSink.warn({
        module: 'knowledge-distiller',
        event: 'archive_failed',
        message: 'Falha ao arquivar chunks antigos',
        error: err,
      });
    }

    const durationMs = Date.now() - startTime;

    logSink.info({
      module: 'knowledge-distiller',
      event: 'distillation_complete',
      message: `Distillação: ${chunksCreated} chunks criados, ${chunksArchived} arquivados, ${patterns.length} padrões identificados (${durationMs}ms)`,
      context: {
        totalPairsAnalyzed,
        chunksCreated,
        chunksArchived,
        patternsCount: patterns.length,
        durationMs,
        mode: this.mode,
      },
    });

    return {
      totalPairsAnalyzed,
      chunksCreated,
      chunksArchived,
      patterns,
      durationMs,
      mode: this.mode,
    };
  }

  /**
   * Destila padrões de pares DPO.
   * Agrupa por similaridade de prompt (primeiras 3 palavras) e identifica
   * padrões de "quando pergunta X, escolha Y é preferível a Z".
   */
  private async distillDpoPatterns(): Promise<{ patterns: DistilledKnowledge[]; analyzed: number }> {
    const patterns: DistilledKnowledge[] = [];
    let analyzed = 0;

    try {
      // Busca pares DPO das últimas 2 semanas
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const pairs = await db.dpoPreferencePair.findMany({
        where: {
          createdAt: { gte: twoWeeksAgo },
          status: { in: ['pending', 'exported'] },
        },
        select: { prompt: true, chosen: true, rejected: true, similarityScore: true },
        take: 500,
      });

      analyzed = pairs.length;

      if (pairs.length === 0) {
        return { patterns, analyzed };
      }

      // Agrupa por "prompt prefix" (primeiras 3 palavras normalizadas)
      const promptGroups = new Map<string, typeof pairs>();
      for (const pair of pairs) {
        const prefix = pair.prompt
          .toLowerCase()
          .split(/\s+/)
          .slice(0, 3)
          .join(' ')
          .replace(/[^a-z0-9 ]/g, '');
        if (!promptGroups.has(prefix)) promptGroups.set(prefix, []);
        promptGroups.get(prefix)!.push(pair);
      }

      // Para cada grupo com >= 3 ocorrências, cria pattern
      for (const [prefix, groupPairs] of promptGroups.entries()) {
        if (groupPairs.length < MIN_OCCURRENCES_FOR_PATTERN) continue;

        // Identifica diferença comum entre chosen e rejected
        const firstPair = groupPairs[0];
        const chosenWords = firstPair.chosen.split(/\s+/);
        const rejectedWords = firstPair.rejected.split(/\s+/);

        // Heurística simples: se chosen é mais curto que rejected, prefere concisão
        const avgChosenLen = groupPairs.reduce((acc, p) => acc + p.chosen.split(/\s+/).length, 0) / groupPairs.length;
        const avgRejectedLen = groupPairs.reduce((acc, p) => acc + p.rejected.split(/\s+/).length, 0) / groupPairs.length;

        let pattern = '';
        let content = '';
        const confidence = Math.min(1, groupPairs.length / 10);

        if (avgChosenLen < avgRejectedLen * 0.8) {
          pattern = `prefer_concise_response_for:${prefix}`;
          content = `## Padrão Aprendido (DPO)
Quando o hóspede pergunta algo começando com "${prefix}...",
a resposta preferida (escolhida por humanos) é em média ${(avgChosenLen / avgRejectedLen * 100).toFixed(0)}% do tamanho da rejeitada.

### Exemplo:
**PROMPT:** ${firstPair.prompt.substring(0, 200)}
**ESCOLHIDA (${avgChosenLen.toFixed(0)} palavras):** ${firstPair.chosen.substring(0, 200)}
**REJEITADA (${avgRejectedLen.toFixed(0)} palavras):** ${firstPair.rejected.substring(0, 200)}

### Recomendação:
Para prompts similares, gerar respostas mais concisas e diretas.
Confiança: ${(confidence * 100).toFixed(0)}% (baseado em ${groupPairs.length} exemplos)
`;
        } else if (avgChosenLen > avgRejectedLen * 1.2) {
          pattern = `prefer_detailed_response_for:${prefix}`;
          content = `## Padrão Aprendido (DPO)
Quando o hóspede pergunta algo começando com "${prefix}...",
a resposta preferida é mais detalhada (média ${avgChosenLen.toFixed(0)} palavras vs ${avgRejectedLen.toFixed(0)} rejeitadas).

### Exemplo:
**PROMPT:** ${firstPair.prompt.substring(0, 200)}
**ESCOLHIDA:** ${firstPair.chosen.substring(0, 300)}
**REJEITADA:** ${firstPair.rejected.substring(0, 200)}

### Recomendação:
Para prompts similares, gerar respostas mais completas com detalhes adicionais.
Confiança: ${(confidence * 100).toFixed(0)}%
`;
        } else {
          // Diferença sutil — registrar padrão genérico
          pattern = `dpo_pattern_for:${prefix}`;
          content = `## Padrão DPO Identificado
Para prompts começando com "${prefix}...", humanos preferiram respostas específicas.

### Exemplo escolhido:
${firstPair.chosen.substring(0, 300)}

### Exemplo rejeitado:
${firstPair.rejected.substring(0, 300)}

### Recomendação:
Estudar diferenças estilísticas e aplicar em futuras gerações.
Confiança: ${(confidence * 100).toFixed(0)}%
`;
        }

        patterns.push({
          source: 'dpo_pattern',
          pattern,
          occurrences: groupPairs.length,
          confidence,
          content,
          metadata: {
            promptPrefix: prefix,
            avgChosenLen,
            avgRejectedLen,
            avgSimilarity: groupPairs.reduce((acc, p) => acc + p.similarityScore, 0) / groupPairs.length,
          },
        });
      }
    } catch (err) {
      logSink.warn({
        module: 'knowledge-distiller',
        event: 'dpo_distill_failed',
        message: 'Falha ao destilar padrões DPO',
        error: err,
      });
    }

    return { patterns, analyzed };
  }

  /**
   * Destila padrões de refatorações bem-sucedidas.
   * Agrupa por filePath + sourceErrorHash e identifica que tipo de refatoração funcionou.
   */
  private async distillRefactorPatterns(): Promise<{ patterns: DistilledKnowledge[]; analyzed: number }> {
    const patterns: DistilledKnowledge[] = [];
    let analyzed = 0;

    try {
      const appliedRefactors = await db.refactorSuggestion.findMany({
        where: { status: 'applied' },
        select: {
          filePath: true,
          sourceErrorHash: true,
          rationale: true,
          proposedCode: true,
          confidence: true,
        },
        take: 500,
      });

      analyzed = appliedRefactors.length;

      if (appliedRefactors.length === 0) {
        return { patterns, analyzed };
      }

      // Agrupa por errorHash
      const hashGroups = new Map<string, typeof appliedRefactors>();
      for (const r of appliedRefactors) {
        if (!r.sourceErrorHash) continue;
        if (!hashGroups.has(r.sourceErrorHash)) hashGroups.set(r.sourceErrorHash, []);
        hashGroups.get(r.sourceErrorHash)!.push(r);
      }

      for (const [hash, group] of hashGroups.entries()) {
        if (group.length < 1) continue; // Mesmo 1 aplicação bem-sucedida é conhecimento

        const first = group[0];
        const pattern = `refactor_works_for:${hash}`;

        const content = `## Padrão de Refatoração Bem-sucedida
**Erro hash:** ${hash}
**Arquivo:** ${first.filePath}
**Vezes aplicada:** ${group.length}

### Rationale que funcionou:
${first.rationale?.substring(0, 500) || '(sem rationale)'}

### Código proposto (que resolveu o erro):
\`\`\`
${first.proposedCode?.substring(0, 800) || '(não disponível)'}
\`\`\`

### Confiança média: ${(group.reduce((acc, g) => acc + (g.confidence || 0), 0) / group.length * 100).toFixed(0)}%

### Recomendação:
Se erro com hash similar aparecer novamente, propor esta refatoração primeiro.
`;

        patterns.push({
          source: 'refactor_pattern',
          pattern,
          occurrences: group.length,
          confidence: Math.min(1, group.reduce((acc, g) => acc + (g.confidence || 0), 0) / group.length),
          content,
          metadata: {
            errorHash: hash,
            filePath: first.filePath,
          },
        });
      }
    } catch (err) {
      logSink.warn({
        module: 'knowledge-distiller',
        event: 'refactor_distill_failed',
        message: 'Falha ao destilar padrões de refatoração',
        error: err,
      });
    }

    return { patterns, analyzed };
  }

  /**
   * Destila padrões de anomalias acknowledge (falsos positivos conhecidos).
   */
  private async distillAnomalyPatterns(): Promise<{ patterns: DistilledKnowledge[]; analyzed: number }> {
    const patterns: DistilledKnowledge[] = [];
    let analyzed = 0;

    try {
      // Busca anomalias acknowledged nas últimas 4 semanas
      const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
      const acknowledged = await db.anomalyEvent.findMany({
        where: {
          acknowledged: true,
          detectedAt: { gte: fourWeeksAgo },
        },
        select: {
          anomalyType: true,
          scope: true,
          metric: true,
          observed: true,
          baseline: true,
          acknowledgeNotes: true,
        },
        take: 500,
      });

      analyzed = acknowledged.length;

      if (acknowledged.length === 0) {
        return { patterns, analyzed };
      }

      // Agrupa por anomalyType + scope
      const scopeGroups = new Map<string, typeof acknowledged>();
      for (const a of acknowledged) {
        const key = `${a.anomalyType}:${a.scope}`;
        if (!scopeGroups.has(key)) scopeGroups.set(key, []);
        scopeGroups.get(key)!.push(a);
      }

      for (const [key, group] of scopeGroups.entries()) {
        if (group.length < MIN_OCCURRENCES_FOR_PATTERN) continue;

        const first = group[0];
        const pattern = `known_anomaly_pattern:${key}`;

        const content = `## Padrão de Anomalia Conhecida (Falso Positivo Recorrente)
**Tipo:** ${first.anomalyType}
**Escopo:** ${first.scope}
**Vezes detectada e acknowledge:** ${group.length}

### Métrica típica:
- Observed: ${first.observed}
- Baseline: ${first.baseline}

### Notas humanas:
${group[0].acknowledgeNotes || '(sem notas)'}

### Recomendação:
Esta anomalia é recorrente e foi acknowledged ${group.length} vezes.
Considerar ajustar threshold do detector ou adicionar à whitelist.
`;

        patterns.push({
          source: 'anomaly_pattern',
          pattern,
          occurrences: group.length,
          confidence: Math.min(1, group.length / 5),
          content,
          metadata: {
            anomalyType: first.anomalyType,
            scope: first.scope,
          },
        });
      }
    } catch (err) {
      logSink.warn({
        module: 'knowledge-distiller',
        event: 'anomaly_distill_failed',
        message: 'Falha ao destilar padrões de anomalia',
        error: err,
      });
    }

    return { patterns, analyzed };
  }

  /**
   * Estatísticas para dashboard.
   */
  getStats() {
    return {
      mode: this.mode,
      config: {
        minOccurrencesForPattern: MIN_OCCURRENCES_FOR_PATTERN,
        archiveUnusedDays: ARCHIVE_UNUSED_DAYS,
      },
    };
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let singleton: KnowledgeDistiller | null = null;

export function getKnowledgeDistiller(): KnowledgeDistiller {
  if (!singleton) {
    singleton = new KnowledgeDistiller();
  }
  return singleton;
}
