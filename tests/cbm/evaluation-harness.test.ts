/**
 * CBM Evaluation Harness — contract tests
 * Valida que o harness simula CBM corretamente para o ZéCode.
 */
import { describe, expect, it } from 'vitest';
import { searchGraph, tracePath, detectDeadCode, getArchitecture, queryCodebase } from '@/lib/cbm/evaluation-harness';

describe('🧠 CBM Evaluation Harness — simula codebase-memory-mcp', () => {
  it('searchGraph finds functions by name', () => {
    const result = searchGraph('function:resolveTenantId');
    expect(result.symbols.length).toBeGreaterThan(0);
    expect(result.symbols[0].type).toBe('function');
    expect(result.durationMs).toBeLessThan(2000);
  });

  it('searchGraph finds routes', () => {
    const result = searchGraph('route:/api/ddc/locks');
    expect(result.symbols.length).toBeGreaterThan(0);
    expect(result.symbols.some(s => s.type === 'route')).toBe(true);
  });

  it('searchGraph finds Prisma models', () => {
    const result = searchGraph('model:Tenant');
    expect(result.symbols.length).toBeGreaterThan(0);
    expect(result.symbols.some(s => s.type === 'model')).toBe(true);
  });

  it('tracePath finds callers of a function', () => {
    const result = tracePath('resolveTenantId');
    expect(result.symbols.length).toBeGreaterThan(0);
    // Should find at least 1 caller file
    expect(result.durationMs).toBeLessThan(5000);
  });

  it('getArchitecture returns overview with routes + models + hotspots', () => {
    const result = getArchitecture();
    expect(result.overview).toBeDefined();
    expect(result.overview!.routes.length).toBeGreaterThan(50);
    expect(result.overview!.models.length).toBeGreaterThan(50);
    expect(result.overview!.hotspots.length).toBeGreaterThan(0);
    expect(result.overview!.totalFiles).toBeGreaterThan(100);
  });

  it('queryCodebase routes to correct function', async () => {
    const archResult = await queryCodebase('architecture');
    expect(archResult.overview).toBeDefined();

    const searchResult = await queryCodebase('function:generatePin');
    expect(searchResult.symbols.length).toBeGreaterThan(0);

    const traceResult = await queryCodebase('trace:resolveTenantId');
    expect(traceResult.symbols.length).toBeGreaterThan(0);
  });

  it('index completes in < 5s (fast like CBM)', () => {
    const start = Date.now();
    getArchitecture();
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(5000);
  });

  it('no OpenAI/Anthropic — 100% local grep + regex', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(process.cwd(), 'src/lib/cbm/evaluation-harness.ts'),
      'utf8'
    );
    expect(source).not.toContain('OPENAI_API_KEY');
    expect(source).not.toContain('ANTHROPIC_API_KEY');
    expect(source).toContain('grep');
    expect(source).toContain('readFileSync');
  });
});
