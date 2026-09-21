/**
 * SEUZELLA RUN12-A — suíte anti-regressão (higiene I8 + logger).
 *
 * Garante:
 *   - logger estruturado: JSON por linha, redação de segredos (reuso do
 *     redactValue do audit W2), chave sensível redigida, gating por
 *     LOG_LEVEL, sinks corretos por nível, nunca lança.
 *   - I8: todo arquivo convertido (tests/security/run12-i8-files.json)
 *     existe e está SEM console.log/debug/info em posição de código
 *     (mesma regex do HARNESS, pulando comentários).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { logger } from '@/lib/infra/logger';

const I8_JSON_URL = new URL('./run12-i8-files.json', import.meta.url);
const HARNESS_LINE = /console\.(log|debug|info)\s*\(/;

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.LOG_LEVEL;
});

describe('RUN12-A logger estruturado', () => {
  it('emite uma linha JSON com level/ts/msg via console.log', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('processando lote', { itens: 3 });
    expect(spy).toHaveBeenCalledTimes(1);
    const raw = spy.mock.calls[0][0] as string;
    const parsed = JSON.parse(raw);
    expect(parsed.level).toBe('info');
    expect(parsed.msg).toBe('processando lote');
    expect(parsed.data).toEqual({ itens: 3 });
    expect(typeof parsed.ts).toBe('string');
  });

  it('redige vendor key (sk-...) na mensagem', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('chave recebida: sk-abcdefghijklmnop1234');
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.msg).toContain('[REDACTED:vendor-key]');
    expect(parsed.msg).not.toContain('sk-abcdefghijklmnop');
  });

  it('redige jwt-like (eyJ...) e bearer no meta', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('req', { auth: 'eyJabc123456789012345', h: 'Bearer abcdefgh123' });
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.data.auth).toBe('[REDACTED:jwt-like]');
    expect(parsed.data.h).toBe('[REDACTED:bearer]');
  });

  it('redige por chave sensível (password/token) no objeto', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('login', { user: 'marcio', password: 'supersecreto' });
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.data.user).toBe('marcio');
    expect(parsed.data.password).toBe('[REDACTED:key]');
  });

  it('LOG_LEVEL=error suprime info e mantém error', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.LOG_LEVEL = 'error';
    logger.info('não deve sair');
    logger.error('falhou', { code: 'X' });
    expect(logSpy).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(errSpy.mock.calls[0][0] as string);
    expect(parsed.level).toBe('error');
    expect(parsed.msg).toBe('falhou');
  });

  it('debug é suprimido no piso default (info)', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.debug('ruido', { a: 1 });
    expect(spy).not.toHaveBeenCalled();
    process.env.LOG_LEVEL = 'debug';
    logger.debug('agora sai');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('nunca lança, mesmo com meta circular', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const a: Record<string, unknown> = { b: 1 };
    a.self = a;
    expect(() => logger.info('circular', a)).not.toThrow();
    expect(spy).toHaveBeenCalled();
  });
});

describe('RUN12-A invariantes I8', () => {
  it('logger.ts existe na camada de infra', () => {
    // O import no topo já falha se ausente — este teste documenta a intenção.
    expect(typeof logger.info).toBe('function');
  });

  it('todo arquivo convertido está sem console.log/debug/info — salvo nas linhas DEFERRED registradas', () => {
    const marker = JSON.parse(readFileSync(fileURLToPath(I8_JSON_URL), 'utf8'));
    expect(marker.schema).toBe('RUN12_I8_FILES/v1');
    expect(Array.isArray(marker.converted)).toBe(true);
    const deferredMap = new Map<string, Set<number>>();
    for (const d of (marker.deferred || []) as Array<{ file: string; lines: number[] }>) {
      deferredMap.set(d.file, new Set(d.lines));
    }
    for (const rel of marker.converted as string[]) {
      const src = readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
      const allowed = deferredMap.get(rel) ?? new Set<number>();
      const offenders = src
        .split('\n')
        .map((l, i) => ({ l, n: i + 1 }))
        .filter(({ l, n }) => !/^\s*\/\//.test(l) && HARNESS_LINE.test(l) && !allowed.has(n));
      expect(
        offenders,
        `${rel} ainda tem console.* fora das linhas deferidas: ${offenders.map((o) => o.n).join(',')}`,
      ).toEqual([]);
    }
  });
});
