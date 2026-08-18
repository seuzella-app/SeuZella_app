import { describe, it, expect } from 'vitest';
import { ZellaSalesBrain } from '../src/lib/cerebro/zella-sales-brain';
import { hybridGraphSearch } from '../src/lib/ml/graph-rag';
import { captureDpoPair } from '../src/lib/ml/dpo-collector';
import { checkAndOptimizePrompts } from '../src/lib/ml/brain-health-optimizer';

describe('SUÍTE DE ALTO STRESS & CONCORRÊNCIA EXTREMA (Avalanche Load & High Throughput)', () => {
  it('1. Avalanche Massiva no Chat Zélla: Deve processar 100 mensagens simultâneas em batches de concorrência com 100% de sucesso', async () => {
    const totalRequests = 100;
    const startTime = Date.now();

    const promises = Array.from({ length: totalRequests }, (_, i) =>
      ZellaSalesBrain.processMessage(`Olá Zé, teste de carga simultânea ${i} - tenho 5 quartos em Ubatuba`, [])
    );

    const results = await Promise.all(promises);
    const totalDuration = Date.now() - startTime;

    expect(results).toHaveLength(totalRequests);
    expect(results.every(r => r.success)).toBe(true);
    console.log(`[STRESS TEST] 100 mensagens simultâneas do Zélla processadas em ${totalDuration}ms (média: ${(totalDuration / totalRequests).toFixed(2)}ms/req)`);
  }, 60000);

  it('2. Carga Extrema no GraphRAG: Deve resolver 200 buscas híbridas de grafo concorrentes sem travamento', async () => {
    const totalQueries = 200;
    const startTime = Date.now();

    const queries = [
      'Horário de check-in',
      'Posso levar cachorro?',
      'Aceita cartão ou pix?',
      'Qual a regra de late check-out?',
    ];

    const promises = Array.from({ length: totalQueries }, (_, i) =>
      hybridGraphSearch('tenant_stress_test', queries[i % queries.length])
    );

    const results = await Promise.all(promises);
    const totalDuration = Date.now() - startTime;

    expect(results).toHaveLength(totalQueries);
    expect(results.every(r => r.includes('CONHECIMENTO HIERÁRQUICO'))).toBe(true);
    console.log(`[STRESS TEST] 200 buscas GraphRAG executadas simultaneamente em ${totalDuration}ms`);
  }, 30000);

  it('3. Ingestão Concorrente DPO & Health Optimizer: Deve processar 200 gravadas DPO simultâneas sem race condition', async () => {
    const totalDpo = 200;

    const dpoPromises = Array.from({ length: totalDpo }, (_, i) =>
      captureDpoPair({
        tenantId: `tenant_stress_${i % 10}`,
        prompt: `Pergunta de carga ${i}`,
        rejected: `Resposta antiga não aceita número ${i}`,
        chosen: `Resposta ideal ajustada pelo anfitrião número ${i} com detalhes adicionais do local`,
      })
    );

    const dpoResults = await Promise.all(dpoPromises);
    expect(dpoResults).toHaveLength(totalDpo);

    const healthRes = await checkAndOptimizePrompts('tenant_stress_0');
    expect(healthRes.tenantId).toBe('tenant_stress_0');
  }, 30000);
});
