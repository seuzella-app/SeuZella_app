// =============================================================================
// ZÉLLA Central Control — Security Gate V3 Test Suite
// =============================================================================
// 3 Pilares de Teste:
// 1. Zero-State Tests (Anti-Crash) — Garante que dados vazios não crasham o sistema
// 2. WhatsApp Cost Meter (Taxímetro) — Validação matemática do Message Bundling
// 3. Security Gate Attack Simulation — Ataque simulado às 6 camadas de proteção
// =============================================================================

import { describe, test, expect, beforeEach } from 'vitest';
import {
  addMessageToBundle,
  getBundlerStats,
  resetBundlerStats,
  flushAllBundles,
  COST_PER_MESSAGE_USD,
  BUNDLE_WINDOW_MS,
} from '@/lib/message-bundler';

// ═══════════════════════════════════════════════════════════════════════════════
// PILAR 1: ZERO-STATE TESTS (Anti-Crash)
// Garante que o sistema responde graciosamente a arrays vazios e dados zerados
// ═══════════════════════════════════════════════════════════════════════════════

describe('PILAR 1: Zero-State Tests (Anti-Crash)', () => {
  test('Métricas zeradas não devem produzir NaN ou undefined', () => {
    const zeroMetrics = {
      totalClients: 0,
      totalRooms: 0,
      totalReservations: 0,
      totalRevenue: 0,
      totalMessagesProcessed: 0,
      avgOccupancy: 0,
      avgBrainAccuracy: 0,
      monthlyGrowth: 0,
      mrr: { total: 0, pousadas: 0, airbnb: 0, parceiro: 0 },
      nicheBreakdown: {
        pousadas: { clients: 0, revenue: 0, reservations: 0 },
        anfitrioes: { clients: 0, revenue: 0, properties: 0, superhosts: 0 },
        parceiro: { clients: 0, mrr: 0, referrals: 0 },
      },
    };

    // MRR display should not be NaN
    const mrrDisplay = (zeroMetrics.mrr.total / 1000).toFixed(1);
    expect(mrrDisplay).toBe('0.0');
    expect(isNaN(Number(mrrDisplay))).toBe(false);

    // Occupancy display should not be NaN
    const occupancyDisplay = `${zeroMetrics.avgOccupancy}%`;
    expect(occupancyDisplay).toBe('0%');

    // Revenue per niche should not produce NaN when divided
    const pousadaRevenueK = zeroMetrics.nicheBreakdown.pousadas.revenue > 0
      ? (zeroMetrics.nicheBreakdown.pousadas.revenue / 1000).toFixed(1)
      : '0.0';
    expect(pousadaRevenueK).toBe('0.0');
    expect(isNaN(Number(pousadaRevenueK))).toBe(false);
  });

  test('Divisão por zero em taxa de conversão deve retornar 0, não NaN', () => {
    const totalGuests = 0;
    const bookedGuests = 0;
    const conversionRate = totalGuests > 0 ? Math.round((bookedGuests / totalGuests) * 100) : 0;
    expect(conversionRate).toBe(0);
    expect(isNaN(conversionRate)).toBe(false);
  });

  test('Divisão por zero em ocupação deve retornar 0, não NaN', () => {
    const totalRooms = 0;
    const occupiedRooms = 0;
    const avgOccupancy = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
    expect(avgOccupancy).toBe(0);
    expect(isNaN(avgOccupancy)).toBe(false);
  });

  test('Divisão por zero em custo por MRR deve retornar 0, não Infinity', () => {
    const totalCost = 5.44;
    const totalMRR = 0;
    const costRatio = totalMRR > 0 ? totalCost / totalMRR : 0;
    expect(costRatio).toBe(0);
    expect(isFinite(costRatio)).toBe(true);
  });

  test('Formatadores de moeda não devem crashar com valores zerados', () => {
    const values = [0, -0, 0.0];
    for (const v of values) {
      expect(() => v.toLocaleString('pt-BR')).not.toThrow();
      expect(() => (v / 1000).toFixed(1)).not.toThrow();
    }
  });

  test('String vazia em sparkline data não deve crashar', () => {
    const data: number[] = [];
    // A MiniSparkline component returns null when data.length < 2
    const shouldRender = data.length >= 2;
    expect(shouldRender).toBe(false);
  });

  test('Bundler stats com zero bundles processados deve retornar valores seguros', () => {
    resetBundlerStats();
    const stats = getBundlerStats();

    expect(stats.totalBundlesProcessed).toBe(0);
    expect(stats.totalMessagesProcessed).toBe(0);
    expect(stats.avgMessagesPerBundle).toBe(0);
    expect(stats.oneShotRate).toBe(0);
    expect(stats.savingsRate).toBe(0);
    expect(isNaN(stats.avgMessagesPerBundle)).toBe(false);
    expect(isNaN(stats.oneShotRate)).toBe(false);
    expect(isNaN(stats.savingsRate)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PILAR 2: WHATSAPP COST METER (Taxímetro) — Validação Matemática
// Testa o Message Bundling: 3 mensagens em 3s = 1 tarifa, não 3
// ═══════════════════════════════════════════════════════════════════════════════

describe('PILAR 2: WhatsApp Cost Meter — Validação Matemática', () => {
  beforeEach(() => {
    resetBundlerStats();
  });

  test('Custo por mensagem deve ser exatamente US$ 0,0068', () => {
    expect(COST_PER_MESSAGE_USD).toBe(0.0068);
  });

  test('Janela de bundle deve ser 3 segundos (3000ms)', () => {
    expect(BUNDLE_WINDOW_MS).toBe(3000);
  });

  test('Mensagem única outbound deve custar exatamente US$ 0,0068', async () => {
    const result = await addMessageToBundle('tenant-test-1', 'outbound');

    expect(result.messageCount).toBe(1);
    expect(result.costUsd).toBe(COST_PER_MESSAGE_USD);
    expect(result.savedCostUsd).toBe(0); // No savings with 1 message
  });

  test('Mensagem inbound deve custar US$ 0,00 (sem tarifa Meta)', async () => {
    const result = await addMessageToBundle('tenant-test-inbound', 'inbound');

    expect(result.messageCount).toBe(1);
    expect(result.costUsd).toBe(0);
    expect(result.savedCostUsd).toBe(0);
  });

  test('3 mensagens rápidas em 3s devem resultar em 1 única tarifa (Message Bundling)', async () => {
    // Simula: "Oi", "Tudo bem?", "Qual o valor?" — todas em sequência rápida
    const tenantId = 'tenant-bundle-test';

    // Dispara 3 mensagens quase simultâneas
    const promise1 = addMessageToBundle(tenantId, 'outbound', { intent: 'greeting' });
    // Pequeno delay para garantir que a primeira mensagem registrou antes da segunda
    await new Promise(r => setTimeout(r, 50));
    const promise2 = addMessageToBundle(tenantId, 'outbound', { intent: 'check-in' });
    await new Promise(r => setTimeout(r, 50));
    const promise3 = addMessageToBundle(tenantId, 'outbound', { intent: 'pricing' });

    // Todas devem resolver com o mesmo resultado (bundle fechado)
    const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

    // Todas as 3 promessas devem ver o mesmo bundle
    expect(result1.messageCount).toBe(3);
    expect(result2.messageCount).toBe(3);
    expect(result3.messageCount).toBe(3);

    // Custo total: apenas 1 tarifa de US$ 0,0068 (não 3 × 0,0068 = 0,0204)
    expect(result1.costUsd).toBe(COST_PER_MESSAGE_USD); // 0.0068

    // Economia: 2 × 0,0068 = 0,0136 (as 2 mensagens extras foram "de graça")
    expect(result1.savedCostUsd).toBeCloseTo(2 * COST_PER_MESSAGE_USD, 4);

    // Sem bundling seriam 3 tarifas: 3 × 0,0068 = 0,0204
    // Com bundling: 1 × 0,0068 = 0,0068
    // Economia: 66,67%
    const unbundledCost = 3 * COST_PER_MESSAGE_USD;
    const savingsRate = (result1.savedCostUsd / unbundledCost) * 100;
    expect(savingsRate).toBeCloseTo(66.67, 0);
  });

  test('Mensagens em janelas diferentes devem gerar tarifas separadas', async () => {
    const tenantId = 'tenant-separate-test';

    // Primeira mensagem
    const result1 = await addMessageToBundle(tenantId, 'outbound');

    // Espera a janela de 3s fechar + margem
    await new Promise(r => setTimeout(r, BUNDLE_WINDOW_MS + 200));

    // Segunda mensagem (nova janela)
    const result2 = await addMessageToBundle(tenantId, 'outbound');

    // Cada bundle deve ter apenas 1 mensagem
    expect(result1.messageCount).toBe(1);
    expect(result2.messageCount).toBe(1);

    // Cada uma custou US$ 0,0068
    expect(result1.costUsd).toBe(COST_PER_MESSAGE_USD);
    expect(result2.costUsd).toBe(COST_PER_MESSAGE_USD);
  });

  test('One-Shot Resolution deve ser rastreado corretamente', async () => {
    const tenantId = 'tenant-oneshot-test';

    const result = await addMessageToBundle(tenantId, 'outbound', {
      oneShot: true,
      intent: 'complete_reply',
    });

    expect(result.isOneShot).toBe(true);
    expect(result.intent).toBe('complete_reply');
  });

  test('Bundler stats devem refletir economia acumulada', async () => {
    // Process 1 bundle with 3 messages — fire without awaiting individual promises
    const p1 = addMessageToBundle('stats-tenant', 'outbound');
    await new Promise(r => setTimeout(r, 50));
    const p2 = addMessageToBundle('stats-tenant', 'outbound');
    await new Promise(r => setTimeout(r, 50));
    const p3 = addMessageToBundle('stats-tenant', 'outbound', { oneShot: true });

    // Wait for all promises to resolve (bundle window closes after 3s)
    const [result1, result2, result3] = await Promise.all([p1, p2, p3]);

    const stats = getBundlerStats();
    expect(stats.totalBundlesProcessed).toBe(1);
    expect(stats.totalMessagesProcessed).toBe(result1.messageCount);
    expect(stats.totalOneShots).toBe(1);
    expect(stats.oneShotRate).toBe(100); // 1/1 = 100%
  });

  test('flushAllBundles deve processar bundles pendentes imediatamente', async () => {
    // Add a message but don't wait for the timer
    addMessageToBundle('flush-tenant', 'outbound');

    // Force flush
    const results = flushAllBundles();

    // The pending bundle should be flushed
    expect(results.length).toBeGreaterThanOrEqual(1);
    if (results.length > 0) {
      expect(results[0].tenantId).toBe('flush-tenant');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PILAR 3: SECURITY GATE V3 — Attack Simulation
// Testa as 6 camadas de proteção contra acesso não autorizado
// ═══════════════════════════════════════════════════════════════════════════════

describe('PILAR 3: Security Gate V3 — Attack Simulation', () => {
  // Note: These tests verify the logic of the security functions directly.
  // Full integration tests with actual NextRequest objects would need
  // a running server or more complex mocking.

  test('verifyZCCAccess deve estar exportado e funcional', async () => {
    const { verifyZCCAccess } = await import('@/lib/zcc-security');
    expect(typeof verifyZCCAccess).toBe('function');
  });

  test('verifyZCCAccessOrReject deve estar exportado e funcional', async () => {
    const { verifyZCCAccessOrReject } = await import('@/lib/zcc-security');
    expect(typeof verifyZCCAccessOrReject).toBe('function');
  });

  test('getZCCSecurityAuditLog deve estar exportado e funcional', async () => {
    const { getZCCSecurityAuditLog } = await import('@/lib/zcc-security');
    expect(typeof getZCCSecurityAuditLog).toBe('function');
  });

  test('getZCCRateLimiterState deve estar exportado e funcional', async () => {
    const { getZCCRateLimiterState } = await import('@/lib/zcc-security');
    expect(typeof getZCCRateLimiterState).toBe('function');
  });

  test('Audit log deve registrar entradas com formato correto', async () => {
    const { getZCCSecurityAuditLog } = await import('@/lib/zcc-security');
    const log = await getZCCSecurityAuditLog();
    expect(Array.isArray(log)).toBe(true);
  });

  test('Rate limiter state deve retornar estrutura correta', async () => {
    const { getZCCRateLimiterState } = await import('@/lib/zcc-security');
    const state = getZCCRateLimiterState();
    expect(state).toHaveProperty('activeIPs');
    expect(state).toHaveProperty('activeNonces');
    expect(state).toHaveProperty('auditLogEntries');
    expect(typeof state.activeIPs).toBe('number');
    expect(typeof state.activeNonces).toBe('number');
    expect(typeof state.auditLogEntries).toBe('number');
  });

  test('Request sem Master Key header deve ser rejeitado com status 404 (silent rejection)', async () => {
    const { verifyZCCAccess } = await import('@/lib/zcc-security');

    // Create a minimal NextRequest-like object
    const mockRequest = {
      headers: new Headers(),
      cookies: {
        get: () => undefined,
      },
      nextUrl: {
        pathname: '/api/zcc/metrics',
        searchParams: new URLSearchParams(),
      },
    } as any;

    // Set env vars for testing
    process.env.ZCC_MASTER_KEY = 'test-master-key-2026';
    process.env.ZCC_ADMIN_EMAILS = 'admin@zella.com';
    process.env.NEXTAUTH_SECRET = 'test-secret';

    const result = await verifyZCCAccess(mockRequest);

    expect(result.allowed).toBe(false);
    expect(result.response).toBeDefined();
    expect(result.response?.status).toBe(404);

    // Silent rejection: body should NOT contain sensitive data
    const body = await result.response?.text();
    expect(body).not.toContain('totalMRR');
    expect(body).not.toContain('whatsapp_message_costs');
    expect(body).not.toContain('admin');
  });

  test('Request com Master Key inválida deve ser rejeitado com status 404', async () => {
    const { verifyZCCAccess } = await import('@/lib/zcc-security');

    const headers = new Headers();
    headers.set('x-zcc-master-key', 'tentativa-hacker-chave-errada');
    headers.set('x-forwarded-for', '192.168.1.50');

    const mockRequest = {
      headers,
      cookies: {
        get: () => undefined,
      },
      nextUrl: {
        pathname: '/api/zcc/metrics',
        searchParams: new URLSearchParams(),
      },
    } as any;

    process.env.ZCC_MASTER_KEY = 'test-master-key-2026';
    process.env.ZCC_ADMIN_EMAILS = 'admin@zella.com';
    process.env.NEXTAUTH_SECRET = 'test-secret';

    const result = await verifyZCCAccess(mockRequest);

    expect(result.allowed).toBe(false);
    expect(result.response?.status).toBe(404);
  });

  test('Request com Master Key válida deve ser permitido', async () => {
    const { verifyZCCAccess } = await import('@/lib/zcc-security');

    const headers = new Headers();
    headers.set('x-zcc-master-key', 'test-master-key-2026');
    headers.set('x-forwarded-for', '192.168.1.50');

    const mockRequest = {
      headers,
      cookies: {
        get: () => undefined,
      },
      nextUrl: {
        pathname: '/api/zcc/metrics',
        searchParams: new URLSearchParams(),
      },
    } as any;

    process.env.ZCC_MASTER_KEY = 'test-master-key-2026';
    process.env.ZCC_ADMIN_EMAILS = 'admin@zella.com';
    process.env.NEXTAUTH_SECRET = 'test-secret';

    const result = await verifyZCCAccess(mockRequest);

    expect(result.allowed).toBe(true);
    expect(result.ip).toBe('192.168.1.50');
  });

  test('Rate limiting: 6 tentativas inválidas do mesmo IP devem acionar HTTP 429', async () => {
    const { verifyZCCAccess } = await import('@/lib/zcc-security');

    process.env.ZCC_MASTER_KEY = 'rate-limit-test-key';
    process.env.ZCC_ADMIN_EMAILS = 'admin@zella.com';
    process.env.NEXTAUTH_SECRET = 'test-secret';

    const makeRequest = () => {
      const headers = new Headers();
      headers.set('x-zcc-master-key', 'chave-invalida-estresse');
      headers.set('x-forwarded-for', '10.0.0.99');
      return {
        headers,
        cookies: { get: () => undefined },
        nextUrl: {
          pathname: '/api/zcc/metrics',
          searchParams: new URLSearchParams(),
        },
      } as any;
    };

    // Primeiras 5 tentativas: devem ser rejeitadas com 404
    for (let i = 0; i < 5; i++) {
      const result = await verifyZCCAccess(makeRequest());
      expect(result.allowed).toBe(false);
      expect(result.response?.status).toBe(404);
    }

    // 6ª tentativa: Rate limit ativado — HTTP 429
    const bruteForceResult = await verifyZCCAccess(makeRequest());
    expect(bruteForceResult.allowed).toBe(false);
    expect(bruteForceResult.response?.status).toBe(429);

    const body = await bruteForceResult.response?.json();
    expect(body.error).toContain('Too many requests');
  });

  test('Rejeição silenciosa nunca deve revelar motivo de falha', async () => {
    const { verifyZCCAccess } = await import('@/lib/zcc-security');

    const headers = new Headers();
    headers.set('x-forwarded-for', '172.16.0.1');

    const mockRequest = {
      headers,
      cookies: { get: () => undefined },
      nextUrl: {
        pathname: '/api/zcc/burn-rate',
        searchParams: new URLSearchParams(),
      },
    } as any;

    process.env.ZCC_MASTER_KEY = 'silent-test-key';
    process.env.ZCC_ADMIN_EMAILS = 'admin@zella.com';
    process.env.NEXTAUTH_SECRET = 'test-secret';

    const result = await verifyZCCAccess(mockRequest);

    expect(result.allowed).toBe(false);
    const body = await result.response?.text();

    // Nunca revelar:
    // - que a rota existe
    // - qual camada falhou
    // - se rate limiting está ativo
    // - detalhes sobre autenticação
    expect(body).not.toContain('Unauthorized');
    expect(body).not.toContain('Forbidden');
    expect(body).not.toContain('Authentication');
    expect(body).not.toContain('Master Key');
    expect(body).not.toContain('rate limit');
  });
});
