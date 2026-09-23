// ============================================================================
// JEV — Fiação da fonte REAL de amostras do Cérebro (RUN26-A — FIAÇÃO)
// ============================================================================
// IMPLEMENTA a ponte da RUN24-A (interface JevSampleSource em
// jev-cerebro-samples.ts) com uma fonte de leitura READ-ONLY de arquivo
// JSONL explícito — o export de dados EXISTENTES do Cérebro.
//
// Fronteiras invioláveis desta onda (iguais às anteriores):
//  - NÃO lê banco (schema do prisma fica para shapes exatas; extração via
//    export JSONL do próprio dono — comando documentado no digest/docs);
//  - NÃO lê rede e NÃO lê variáveis de ambiente (config central é jev-config;
//    o caminho do export é parâmetro EXPLÍCITO do chamador — opt-in);
//  - NUNCA lança: problemas de caminho/tamanho/leitura viram fonte null ou
//    lote vazio tipado; linhas inválidas seguem cruas para o parser da
//    RUN24-A, que as recusa com reason tipado (fail-closed, nada "entra
//    para ver se serve");
//  - Somente leitura (flag 'r'); cap de tamanho (recusa > 5 MB) para nunca
//    carregar arquivo gigante em memória.
// ============================================================================

import { statSync, readFileSync } from 'node:fs';

import type { JevSampleSource } from './jev-cerebro-samples';

/** Cap de tamanho do export (bytes). Export maior que isso é RECUSADO. */
export const JEV_FILE_SOURCE_MAX_BYTES = 5 * 1024 * 1024;

/** Máximo de linhas lidas de um export (defesa em profundidade). */
export const JEV_FILE_SOURCE_MAX_LINES = 10_000;

function isPlainJsonlPath(filePath: string): boolean {
  return typeof filePath === 'string' && filePath.endsWith('.jsonl') && filePath.length > 6;
}

/**
 * Fonte de amostras a partir de um export JSONL EXISTENTE (leitura pura).
 * Devolve null (fonte inerte) se: caminho vazio/mal-formado, não termina em
 * .jsonl, não existe, não é arquivo regular, ou excede o cap de tamanho.
 * NUNCA lança.
 */
export function createFileSampleSource(filePath: string): JevSampleSource | null {
  try {
    if (!isPlainJsonlPath(filePath)) return null;
    const st = statSync(filePath);
    if (!st.isFile()) return null;
    if (st.size > JEV_FILE_SOURCE_MAX_BYTES) return null;
  } catch {
    return null; // caminho inexistente/inacessível => fonte inerte
  }
  const sourceName = `file:${filePath.split('/').pop() ?? 'export.jsonl'}`;
  return {
    sourceName,
    async fetchSamples(): Promise<readonly unknown[]> {
      try {
        const st = statSync(filePath);
        if (!st.isFile() || st.size > JEV_FILE_SOURCE_MAX_BYTES) return [];
        const raw = readFileSync(filePath, { encoding: 'utf8', flag: 'r' });
        const lines = raw.split('\n');
        const out: unknown[] = [];
        for (const line of lines) {
          if (out.length >= JEV_FILE_SOURCE_MAX_LINES) break;
          const trimmed = line.trim();
          if (trimmed === '') continue;
          try {
            out.push(JSON.parse(trimmed) as unknown);
          } catch {
            out.push(trimmed); // linha crua => parser da RUN24-A recusa tipado
          }
        }
        return out;
      } catch {
        return []; // leitura falhou => lote vazio (nunca lança)
      }
    },
  };
}
