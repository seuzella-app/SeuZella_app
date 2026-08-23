// ============================================================================
// k6 Stress Test — Zélla 10x pico projetado
// ============================================================================
// Simula 1.000 usuários simultâneos (10x o pico normal estimado).
// Roda por 5 minutos para identificar gargalos de memória, CPU e DB.
//
// Rodar:
//   k6 run tests/load/stress-10x.js
//
// Requer: k6 instalado (https://k6.io)
// ============================================================================

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Métricas customizadas
const errorRate = new Rate('errors');
const llmLatency = new Trend('llm_latency_ms');
const apiLatency = new Trend('api_latency_ms');

// Configuração do teste — 10x pico
export const options = {
  stages: [
    { duration: '30s', target: 50 },    // ramp-up inicial
    { duration: '1m', target: 200 },    // carga moderada
    { duration: '30s', target: 500 },  // alta carga
    { duration: '2m', target: 1000 },   // pico 10x
    { duration: '1m', target: 1000 },   // mantém pico
    { duration: '30s', target: 0 },     // ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],  // 95% das reqs < 2s
    http_req_failed: ['rate<0.05'],                     // <5% de erros
    errors: ['rate<0.10'],                                // <10% de erros custom
  },
};

export default function () {
  // 1. Health check (pesado em carga)
  const healthRes = http.get(`${BASE_URL}/api/health`);
  apiLatency.add(healthRes.timings.duration);
  check(healthRes, {
    'health 200': (r) => r.status === 200,
  });

  // 2. Readiness (verifica dependências)
  const readyRes = http.get(`${BASE_URL}/api/readiness`);
  check(readyRes, {
    'readiness 200 or 503': (r) => [200, 503].includes(r.status),
  });

  // 3. Simula lead chegando (POST /api/ddc/upsell)
  const upsellRes = http.post(
    `${BASE_URL}/api/ddc/upsell`,
    JSON.stringify({
      type: 'late_checkout',
      quantity: 4,
      unitPrice: 50,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  apiLatency.add(upsellRes.timings.duration);

  // 4. LGPD DPA (endpoint público)
  const dpaRes = http.get(`${BASE_URL}/api/lgpd/dpa`);
  check(dpaRes, {
    'dpa 200': (r) => r.status === 200,
  });

  // 5. WAF — testa bloqueio de bot
  const botRes = http.get(`${BASE_URL}/api/health`, {
    headers: { 'User-Agent': 'sqlmap/1.6' },
  });
  check(botRes, {
    'bot blocked 403': (r) => r.status === 403,
  });

  // Registra erros
  if (healthRes.status !== 200 || dpaRes.status !== 200) {
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }

  sleep(0.5);  // think time
}

export function handleSummary(data) {
  return {
    'tests/load/stress-report.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data),
  };
}

function textSummary(data) {
  return `
═══════════════════════════════════════════════════════════════
  ZÉLLA STRESS TEST — RELATÓRIO RESUMO
═══════════════════════════════════════════════════════════════

📊 Métricas gerais:
  • Total de requisições: ${data.metrics.http_reqs?.values?.count || 0}
  • Duração total: ${(data.metrics.iteration_duration?.values?.avg / 1000 || 0).toFixed(2)}s (média)
  • Latência p95: ${data.metrics.http_req_duration?.values?.['p(95)']?.toFixed(2) || 0}ms
  • Latência p99: ${data.metrics.http_req_duration?.values?.['p(99)']?.toFixed(2) || 0}ms

✅ Thresholds:
  ${Object.entries(data.metrics.http_req_duration?.thresholds || {})
    .map(([k, v]) => `  • ${k}: ${v.ok ? 'PASSOU' : 'FALHOU'}`)
    .join('\n') || '  (sem thresholds)'}

❌ Erros:
  • Taxa de erro: ${(data.metrics.errors?.values?.rate * 100 || 0).toFixed(2)}%
  • HTTP falhas: ${(data.metrics.http_req_failed?.values?.rate * 100 || 0).toFixed(2)}%

${(data.metrics.errors?.values?.rate || 0) < 0.10 && (data.metrics.http_req_failed?.values?.rate || 0) < 0.05
  ? '🎉 SISTEMA PASSOU NO STRESS TEST — pronto para produção!'
  : '⚠️  SISTEMA FALHOU — revisar gargalos antes do launch'}
`;
}
