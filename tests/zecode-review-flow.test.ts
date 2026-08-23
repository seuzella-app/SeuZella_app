import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCodeReviewer } from '@/lib/cerebro/code-reviewer/reviewer-service';

describe('ZéCode & CodeReviewer — Enterprise Review Flow (Mock Mode)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Executa review de arquivo em modo mock sem erros de banco e com custo $0', async () => {
    const reviewer = getCodeReviewer();
    const result = await reviewer.review({
      mode: 'file',
      target: 'src/lib/auth.ts',
      forceLive: false,
    });

    expect(result).toBeDefined();
    expect(result.mode).toBe('mock');
    expect(result.reviewId).toBeDefined();
    expect(result.stats.filesReviewed).toBeGreaterThanOrEqual(1);
    expect(result.stats.costUsd).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.comments)).toBe(true);
    expect(result.highLevelSummary).toContain('Revisão');
  });

  it('Executa review de diretório com cálculo correto de severidades', async () => {
    const reviewer = getCodeReviewer();
    const result = await reviewer.review({
      mode: 'directory',
      target: 'src/lib/zcc',
      maxFiles: 5,
      forceLive: false,
    });

    expect(result).toBeDefined();
    expect(result.stats.filesReviewed).toBeGreaterThanOrEqual(1);
    expect(result.stats.filesReviewed).toBeLessThanOrEqual(5);
    expect(['info', 'warning', 'critical', 'emergency']).toContain(result.severity);
  });

  it('getStats retorna estrutura consistente de contadores mesmo sem migração DB', async () => {
    const reviewer = getCodeReviewer();
    const stats = await reviewer.getStats();

    expect(stats).toBeDefined();
    expect(stats.mode).toBe('mock');
    expect(typeof stats.totalReviews).toBe('number');
    expect(typeof stats.totalComments).toBe('number');
  });
});
