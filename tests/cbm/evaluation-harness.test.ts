/**
 * CBM Evaluation Harness — behavioral certification.
 * These tests validate the local approximation, not the native CBM binary.
 */
import { describe, expect, it } from 'vitest';
import { searchGraph, tracePath, getArchitecture, queryCodebase } from '@/lib/cbm/evaluation-harness';

describe('🧠 CBM Evaluation Harness', () => {
  it('searchGraph finds functions by name', () => {
    const result = searchGraph('function:resolveTenantId');
    expect(result.symbols.length).toBeGreaterThan(0);
    expect(result.symbols.every(s => s.type === 'function')).toBe(true);
    expect(result.durationMs).toBeLessThan(5000);
  });

  it('searchGraph discovers real API routes', () => {
    const result = searchGraph('route:/api/ddc/locks');
    expect(result.symbols.length).toBeGreaterThan(0);
    expect(result.symbols.every(s => s.type === 'route')).toBe(true);
  });

  it('searchGraph discovers Prisma models from schema.prisma', () => {
    const result = searchGraph('model:Tenant');
    expect(result.symbols.length).toBeGreaterThan(0);
    expect(result.symbols.some(s => s.type === 'model' && s.name === 'Tenant')).toBe(true);
  });

  it('tracePath returns references for a real security primitive', () => {
    const result = tracePath('resolveTenantId');
    expect(result.symbols.length).toBeGreaterThan(0);
    expect(result.durationMs).toBeLessThan(10000);
  });

  it('getArchitecture returns real repository overview', () => {
    const result = getArchitecture();
    expect(result.overview).toBeDefined();
    expect(result.overview!.routes.length).toBeGreaterThan(0);
    expect(result.overview!.models.length).toBeGreaterThan(0);
    expect(result.overview!.hotspots.length).toBeGreaterThan(0);
    expect(result.overview!.totalFiles).toBeGreaterThan(100);
    expect(result.overview!.languages.TypeScript).toBeGreaterThan(0);
  });

  it('queryCodebase routes structural queries correctly', async () => {
    const archResult = await queryCodebase('architecture');
    expect(archResult.overview?.models.length).toBeGreaterThan(0);

    const searchResult = await queryCodebase('function:generatePin');
    expect(searchResult.symbols.length).toBeGreaterThan(0);

    const traceResult = await queryCodebase('trace:resolveTenantId');
    expect(traceResult.symbols.length).toBeGreaterThan(0);
  });

  it('architecture index completes within the local evaluation budget', () => {
    const start = Date.now();
    const result = getArchitecture();
    const duration = Date.now() - start;
    expect(result.overview).toBeDefined();
    expect(duration).toBeLessThan(5000);
  });

  it('harness is local and has no provider credentials', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(resolve(process.cwd(), 'src/lib/cbm/evaluation-harness.ts'), 'utf8');
    expect(source).not.toContain('OPENAI_API_KEY');
    expect(source).not.toContain('ANTHROPIC_API_KEY');
    expect(source).toContain("execFileSync('grep'");
    expect(source).toContain('readFileSync');
  });
});
