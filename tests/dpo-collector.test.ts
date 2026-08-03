import { describe, it, expect } from 'vitest';
import {
  levenshteinDistance,
  calculateSimilarityScore,
  captureDpoPair,
} from '../src/lib/ml/dpo-collector';
import { exportDpoDataset } from '../scripts/export-dpo-dataset';
import fs from 'fs';
import path from 'path';

describe('PARTE 1: Alinhamento por Preferência (DPO / LoRA Collector & Exporter)', () => {
  it('PILAR 1: Levenshtein Distance > deve calcular a distância relativa de edição corretamente', () => {
    expect(levenshteinDistance('gato', 'gato')).toBe(0);
    expect(levenshteinDistance('gato', 'gata')).toBe(1);
    expect(levenshteinDistance('ab', 'abcd')).toBe(2);
  });

  it('PILAR 2: Similarity Score > deve retornar 1.0 para strings idênticas e valores proporcionais', () => {
    expect(calculateSimilarityScore('Olá', 'Olá')).toBe(1.0);
    const score = calculateSimilarityScore(
      'O check-in é às 14h',
      'O check-in abre às 14:00h e pode ser antecipado'
    );
    expect(score).toBeGreaterThan(0.3);
    expect(score).toBeLessThan(0.85);
  });

  it('PILAR 3: Filtro de Reescrita (0.15 <= similarity <= 0.85) > deve rejeitar edições triviais (>0.85)', async () => {
    const res = await captureDpoPair({
      tenantId: 'tenant_test',
      prompt: 'Qual o horário?',
      rejected: 'O check-in é 14h',
      chosen: 'O check-in é 14h.', // Apenas adic. ponto
    });
    expect(res.saved).toBe(false);
    expect(res.reason).toBe('EDICAO_TRIVIAL_IGNORADA');
    expect(res.similarityScore).toBeGreaterThan(0.85);
  });

  it('PILAR 3: Filtro de Reescrita (0.15 <= similarity <= 0.85) > deve rejeitar reescritas totalmente fora de contexto (<0.15)', async () => {
    const res = await captureDpoPair({
      tenantId: 'tenant_test',
      prompt: 'Aceita cartão?',
      rejected: 'Sim',
      chosen: 'Texto completamente gigantesco e descontextualizado sem nenhuma relação com a pergunta original enviada.',
    });
    expect(res.saved).toBe(false);
    expect(res.reason).toBe('REESCRITA_FORA_DE_CONTEXTO_IGNORADA');
    expect(res.similarityScore).toBeLessThan(0.15);
  });

  it('PILAR 3: Filtro de Reescrita (0.15 <= similarity <= 0.85) > deve aceitar pares válidos dentro da janela de preferência (0.15 a 0.85)', async () => {
    const res = await captureDpoPair({
      tenantId: 'tenant_test',
      prompt: 'Qual o horário do café?',
      rejected: 'O café é das 7h às 10h.',
      chosen: 'Nosso café colonial é servido diariamente das 07:00 às 10:30 na varanda principal! 😊',
    });
    expect(res.saved).toBe(true);
    expect(res.similarityScore).toBeGreaterThanOrEqual(0.15);
    expect(res.similarityScore).toBeLessThanOrEqual(0.85);
  });

  it('PILAR 4: Dataset Exporter > deve exportar dataset JSONL formatado para treino DPO', async () => {
    const testExportPath = path.resolve('./test_dpo_dataset.jsonl');
    const exportedCount = await exportDpoDataset(testExportPath);

    expect(exportedCount).toBeGreaterThan(0);
    expect(fs.existsSync(testExportPath)).toBe(true);

    const content = fs.readFileSync(testExportPath, 'utf-8');
    const firstLine = JSON.parse(content.trim().split('\n')[0]);
    expect(firstLine).toHaveProperty('prompt');
    expect(firstLine).toHaveProperty('chosen');
    expect(firstLine).toHaveProperty('rejected');

    // Limpar arquivo de teste
    fs.unlinkSync(testExportPath);
  });
});
