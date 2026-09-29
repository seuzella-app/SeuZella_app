/**
 * ============================================================================
 * RBW v2 · MESSAGE BUNDLER — claim atômico + janela de dedup coerente (3.8)
 * ============================================================================
 * Simulação local com fetch stubado (Upstash REST) — nenhum Redis/QStash real.
 *
 * Cobre a lista obrigatória da missão:
 *   flush 1 · flush 2 (buffer vazio) · claim simultâneo (1 processa, 2º vazio)
 *   retry/requeue em falha do processor · duplicata de flush · janelas de
 *   dedup diferentes (id novo) · tenant A/B isolados.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import {
  handleFlushBufferRequest,
  buildFlushDeduplicationId,
  redisKey,
  BUNDLE_WINDOW_MS,
  type BufferMessagePayload,
} from '@/lib/message-bundler';

function msg(partial: Partial<BufferMessagePayload>): BufferMessagePayload {
  return {
    tenantId: 'tenant_A',
    guestPhone: '5511999999999',
    messageContent: 'oi',
    messageFrom: 'guest',
    ...partial,
  };
}

function redisFetchResponse(result: string[] | null) {
  return { ok: true, status: 200, json: async () => ({ result }) } as unknown as Response;
}

describe('RBW v2 · handleFlushBufferRequest — claim atômico (LPOP)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'tok');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('FLUSH 1: buffer com 2 mensagens → processor chamado 1x com conteúdo concatenado', async () => {
    const m1 = msg({ messageContent: 'primeira' });
    const m2 = msg({ messageContent: 'segunda' });
    fetchMock.mockResolvedValueOnce(redisFetchResponse([JSON.stringify(m1), JSON.stringify(m2)]));
    const processor = vi.fn(async (_payload: BufferMessagePayload) => ({}));
    const r = await handleFlushBufferRequest({ tenantId: 'tenant_A', guestPhone: '5511999999999' }, processor);
    expect(r.success).toBe(true);
    expect(r.messageCount).toBe(2);
    expect(processor).toHaveBeenCalledTimes(1);
    expect(processor.mock.calls[0]![0].messageContent).toBe('primeira\nsegunda');
  });

  it('FLUSH 2 (buffer já reclamado): LPOP vazio → NO-OP, processor NUNCA reprocessa', async () => {
    fetchMock.mockResolvedValueOnce(redisFetchResponse(null));
    const processor = vi.fn(async () => ({}));
    const r = await handleFlushBufferRequest({ tenantId: 'tenant_A', guestPhone: '5511999999999' }, processor);
    expect(r.success).toBe(true);
    expect(r.messageCount).toBe(0);
    expect(processor).not.toHaveBeenCalled();
  });

  it('CLAIM SIMULTÂNEO: worker 1 reclama, worker 2 encontra vazio → processamento único', async () => {
    const m1 = msg({ messageContent: 'unica' });
    fetchMock
      .mockResolvedValueOnce(redisFetchResponse([JSON.stringify(m1)])) // worker 1
      .mockResolvedValueOnce(redisFetchResponse(null)); // worker 2
    const processor = vi.fn(async () => ({}));
    const [w1, w2] = await Promise.all([
      handleFlushBufferRequest({ tenantId: 'tenant_A', guestPhone: '5511999999999' }, processor),
      handleFlushBufferRequest({ tenantId: 'tenant_A', guestPhone: '5511999999999' }, processor),
    ]);
    expect(w1.success && w2.success).toBe(true);
    expect(w1.messageCount + w2.messageCount).toBe(1);
    expect(processor).toHaveBeenCalledTimes(1);
  });

  it('FALHA DO PROCESSOR → requeue RPUSH com as mesmas mensagens + TTL renovado', async () => {
    const m1 = msg({ messageContent: 'sera-reenfileirada' });
    const raw = JSON.stringify(m1);
    fetchMock
      .mockResolvedValueOnce(redisFetchResponse([raw])) // LPOP
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: 'OK' }) } as unknown as Response) // RPUSH
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: 1 }) } as unknown as Response); // EXPIRE
    const processor = vi.fn(async () => { throw new Error('IA down'); });
    const r = await handleFlushBufferRequest({ tenantId: 'tenant_A', guestPhone: '5511999999999' }, processor);
    expect(r.success).toBe(false);
    expect(r.error).toBe('PROCESSOR_FAILED_REQUEUED');
    // 2ª chamada ao fetch = RPUSH do requeue
    const rpushCall = fetchMock.mock.calls[1];
    expect(rpushCall[0]).toContain('/rpush/');
    expect(JSON.stringify(rpushCall[1].body)).toContain('sera-reenfileirada');
  });
});

describe('RBW v2 · buildFlushDeduplicationId — janela determinística coerente', () => {
  it('mesma janela (mesmo ciclo) → MESMO id (duplicata do ciclo é absorvida)', () => {
    const base = 999_000; // fronteira de bucket (múltiplo de 3000)
    const a = buildFlushDeduplicationId('tA', '5511999999999', base);
    const b = buildFlushDeduplicationId('tA', '5511999999999', base + BUNDLE_WINDOW_MS - 1);
    expect(a).toBe(b);
  });

  it('janelas DIFERENTES → ids DIFERENTES (nunca suprime flush de janela futura)', () => {
    const base = 999_000;
    const a = buildFlushDeduplicationId('tA', '5511999999999', base);
    const next = buildFlushDeduplicationId('tA', '5511999999999', base + BUNDLE_WINDOW_MS);
    expect(a).not.toBe(next);
  });

  it('janela = BUNDLE_WINDOW_MS (não mais 10× — correção da v1)', () => {
    const base = 999_000;
    // 2s depois (dentro da janela de 3s): mesmo bucket
    expect(buildFlushDeduplicationId('tA', 'p', base)).toBe(buildFlushDeduplicationId('tA', 'p', base + 2_000));
    // 4s depois (janela nova): bucket novo — a v1 (30s) suprimiria este publish
    expect(buildFlushDeduplicationId('tA', 'p', base)).not.toBe(buildFlushDeduplicationId('tA', 'p', base + 4_000));
  });

  it('tenant A/B com o mesmo telefone → ids DIFERENTES (isolamento)', () => {
    expect(buildFlushDeduplicationId('tenant_A', '5511999999999', 999_000))
      .not.toBe(buildFlushDeduplicationId('tenant_B', '5511999999999', 999_000));
  });

  it('redisKey isola tenant A/B mesmo com telefone idêntico', () => {
    expect(redisKey('tenant_A', '5511-999')).not.toBe(redisKey('tenant_B', '5511-999'));
    expect(redisKey('tenant_A', '5511-999')).toBe(redisKey('tenant_A', '5511.999'));
  });
});
