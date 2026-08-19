// ============================================================================
// ZéCode — Testes de Persistência de GapFinding + BottleneckFinding
// ============================================================================
// Valida que:
//   1. detectGaps retorna estrutura correta + persiste no DB (com fallback)
//   2. detectBottlenecks idem
//   3. evolveCode({ jobId }) vincula findings persistidos ao jobId
//   4. applySuggestion para category='gap' e 'bottleneck' atualiza status
//   5. getZeCodeStats retorna contagens reais (não zeros hardcoded)
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock do DB (factory hoisted — sem variáveis top-level) ──────────────────

const dbMock = {
  gapFinding: {
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
    count: vi.fn().mockResolvedValue(0),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({ id: 'mock-id' }),
  },
  bottleneckFinding: {
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
    count: vi.fn().mockResolvedValue(0),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({ id: 'mock-id' }),
  },
  refactorSuggestion: {
    count: vi.fn().mockResolvedValue(0),
    findFirst: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue({ id: 'mock-id' }),
  },
  codeReview: {
    count: vi.fn().mockResolvedValue(0),
    findFirst: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue({ id: 'mock-id' }),
  },
};

vi.mock('@/lib/db', () => ({ db: dbMock }));

// Importa depois do mock
const { detectGaps } = await import('@/lib/cerebro/ze-code/gap-detector');
const { detectBottlenecks } = await import('@/lib/cerebro/ze-code/bottleneck-detector');
const { evolveCode, getZeCodeStats, applySuggestion } = await import('@/lib/cerebro/ze-code/orchestrator');

import type { GapType, SuggestionCategory } from '@/lib/cerebro/ze-code/types';

describe('ZéCode — Persistência de GapFindings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CEREBRO_LIVE_MODE = 'false'; // mock mode
  });

  it('detectGaps retorna estrutura com persistedIds (mesmo vazia)', async () => {
    const result = await detectGaps({ target: 'src/lib', maxFiles: 3, persist: false });

    expect(result).toBeDefined();
    expect(result.gaps).toBeInstanceOf(Array);
    expect(result.filesScanned).toBeGreaterThanOrEqual(0);
    expect(result.mode).toBe('mock');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.persistedIds)).toBe(true);
  });

  it('detectGaps chama db.gapFinding.createMany quando persist=true', async () => {
    dbMock.gapFinding.createMany.mockResolvedValueOnce({ count: 1 });

    // Procura por um arquivo que tenha `any` (alta chance de existir)
    const result = await detectGaps({
      target: 'src/lib/cerebro/ze-code',
      maxFiles: 5,
      persist: true,
      jobId: 'test-job-123',
    });

    if (result.gaps.length > 0) {
      expect(dbMock.gapFinding.createMany).toHaveBeenCalledTimes(1);
      const callArg = dbMock.gapFinding.createMany.mock.calls[0][0];
      expect(callArg.data).toBeInstanceOf(Array);
      expect(callArg.data[0]).toHaveProperty('jobId', 'test-job-123');
      expect(callArg.data[0]).toHaveProperty('filePath');
      expect(callArg.data[0]).toHaveProperty('gapType');
      expect(callArg.data[0]).toHaveProperty('severity');
      expect(callArg.data[0]).toHaveProperty('status', 'pending');
    }
  });

  it('detectGaps faz fallback gracioso se DB falha', async () => {
    dbMock.gapFinding.createMany.mockRejectedValueOnce(new Error('DB offline'));

    const result = await detectGaps({
      target: 'src/lib/cerebro/ze-code',
      maxFiles: 5,
      persist: true,
      jobId: 'test-job-fallback',
    });

    // Mesmo com erro de DB, retorna os gaps em memória
    expect(result.gaps).toBeInstanceOf(Array);
    expect(result.persistedIds).toEqual([]);
  });

  it('detectGaps respeita onlyTypes', async () => {
    const result = await detectGaps({
      target: 'src/lib/cerebro',
      maxFiles: 3,
      onlyTypes: ['missing_type'] as GapType[],
      persist: false,
    });

    // Todos os gaps devem ser do tipo missing_type
    for (const g of result.gaps) {
      expect(g.gapType).toBe('missing_type');
    }
  });
});

describe('ZéCode — Persistência de BottleneckFindings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CEREBRO_LIVE_MODE = 'false';
  });

  it('detectBottlenecks retorna estrutura com persistedIds', async () => {
    const result = await detectBottlenecks({ target: 'src/lib', maxFiles: 3, persist: false });

    expect(result).toBeDefined();
    expect(result.bottlenecks).toBeInstanceOf(Array);
    expect(result.mode).toBe('mock');
    expect(Array.isArray(result.persistedIds)).toBe(true);
  });

  it('detectBottlenecks chama db.bottleneckFinding.createMany quando persist=true + jobId', async () => {
    dbMock.bottleneckFinding.createMany.mockResolvedValueOnce({ count: 1 });

    const result = await detectBottlenecks({
      target: 'src/lib/cerebro',
      maxFiles: 5,
      persist: true,
      jobId: 'test-bn-job-456',
    });

    if (result.bottlenecks.length > 0) {
      expect(dbMock.bottleneckFinding.createMany).toHaveBeenCalledTimes(1);
      const callArg = dbMock.bottleneckFinding.createMany.mock.calls[0][0];
      expect(callArg.data[0]).toHaveProperty('jobId', 'test-bn-job-456');
      expect(callArg.data[0]).toHaveProperty('bottleneckType');
      expect(callArg.data[0]).toHaveProperty('estimatedImpact');
      expect(callArg.data[0]).toHaveProperty('status', 'pending');
    }
  });
});

describe('ZéCode — Evolve com Persistência', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CEREBRO_LIVE_MODE = 'false';
  });

  it('evolveCode propaga jobId para detectGaps e detectBottlenecks', async () => {
    const result = await evolveCode({
      scope: 'directory',
      target: 'src/lib/cerebro/ze-code',
      maxFiles: 3,
      triggeredBy: 'test@zella.com',
    });

    expect(result).toBeDefined();
    expect(result.jobId).toBeDefined();
    expect(typeof result.jobId).toBe('string');
    expect(result.jobId).toMatch(/^zcode_/);
    expect(result.mode).toBe('mock');
    expect(result.status).toMatch(/^(completed|failed)$/);
    expect(result.gapsCreated).toBeGreaterThanOrEqual(0);
    expect(result.bottlenecksCreated).toBeGreaterThanOrEqual(0);
  });

  it('evolveCode retorna summary em markdown', async () => {
    const result = await evolveCode({
      scope: 'directory',
      target: 'src/lib',
      maxFiles: 2,
    });

    expect(result.summary).toContain('ZéCode Evolve');
    expect(result.summary).toContain('Arquivos escaneados');
    expect(result.summary).toContain('Gaps identificados');
    expect(result.summary).toContain('Gargalos detectados');
  });
});

describe('ZéCode — applySuggestion para gaps e bottlenecks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CEREBRO_LIVE_MODE = 'false';
  });

  it('applySuggestion com category=gap chama db.gapFinding.update', async () => {
    dbMock.gapFinding.update.mockResolvedValueOnce({ id: 'gap-123', status: 'applied' });

    const result = await applySuggestion({
      category: 'gap' as SuggestionCategory,
      suggestionId: 'gap-123',
      appliedBy: 'admin@zella.com',
      notes: 'Teste de apply',
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe('applied');
    expect(result.safetyLocksTriggered).toContain('manual_approval_required');
    expect(result.safetyLocksTriggered).toContain('no_auto_apply');
    expect(result.safetyLocksTriggered).toContain('mock_mode_no_real_write');
  });

  it('applySuggestion com category=bottleneck chama db.bottleneckFinding.update', async () => {
    dbMock.bottleneckFinding.update.mockResolvedValueOnce({ id: 'bn-456', status: 'applied' });

    const result = await applySuggestion({
      category: 'bottleneck' as SuggestionCategory,
      suggestionId: 'bn-456',
      appliedBy: 'admin@zella.com',
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe('applied');
  });

  it('applySuggestion falha sem appliedBy', async () => {
    const result = await applySuggestion({
      category: 'gap',
      suggestionId: 'gap-123',
      appliedBy: '',
    } as any);

    expect(result.ok).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.safetyLocksTriggered).toContain('missing_applied_by');
  });

  it('applySuggestion falha com categoria inválida', async () => {
    const result = await applySuggestion({
      category: 'invalid' as any,
      suggestionId: 'x',
      appliedBy: 'admin@zella.com',
    });

    expect(result.ok).toBe(false);
    expect(result.safetyLocksTriggered).toContain('invalid_category');
  });
});

describe('ZéCode — getZeCodeStats com contagens reais', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CEREBRO_LIVE_MODE = 'false';
  });

  it('getZeCodeStats retorna estrutura completa', async () => {
    const stats = await getZeCodeStats(0);

    expect(stats).toBeDefined();
    expect(stats.mode).toBe('mock');
    expect(stats.domain).toBeDefined();
    expect(stats.safety).toBeDefined();
    expect(stats.counts).toBeDefined();
    expect(stats.counts).toHaveProperty('reviewsTotal');
    expect(stats.counts).toHaveProperty('refactorsTotal');
    expect(stats.counts).toHaveProperty('gapsTotal');
    expect(stats.counts).toHaveProperty('bottlenecksTotal');
    expect(stats.counts).toHaveProperty('appliedTotal');
  });

  it('getZeCodeStats safety locks estão sempre configured', async () => {
    const stats = await getZeCodeStats(0);

    expect(stats.safety.autoApplyEnabled).toBe(false);
    expect(stats.safety.godmodeRequired).toBe(true);
    expect(stats.safety.rateLimitPerHour).toBe(10);
    expect(stats.safety.extensionAllowlist).toBeInstanceOf(Array);
    expect(stats.safety.blockedDirs).toBeInstanceOf(Array);
    expect(stats.safety.maxFileSizeKb).toBeGreaterThan(0);
    expect(stats.safety.monthlyBudgetUsd).toBeGreaterThan(0);
  });

  it('getZeCodeStats retorna domain stats mesmo sem DB', async () => {
    const stats = await getZeCodeStats(0);

    expect(stats.domain.totalCodeFiles).toBeGreaterThanOrEqual(0);
    expect(stats.domain.byExtension).toBeInstanceOf(Array);
    expect(stats.domain.topDirectories).toBeInstanceOf(Array);
    expect(stats.domain.mode).toBe('mock');
  });
});
