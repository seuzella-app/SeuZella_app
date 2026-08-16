/**
 * Testes do UPSELL Engine — Comissão Zélla 7% sobre valores extras
 * ==================================================================
 *
 * Valida:
 *   1. Calcular comissão 7% corretamente sobre UPSELL
 *   2. ZERO comissão sobre valores normais (simulado via interface)
 *   3. Catálogo de UPSELLs tem 15 tipos
 *   4. Criar/listar UPSELLs (com fallback mock quando DB indisponível)
 *   5. Confirmar/cancelar/pagar UPSELL
 *   6. gerarSugestaoUpsell produz texto em PT-BR
 *   7. EXPLICACAO_UPSELL contém regras (0% normal, 7% upsell)
 */

import { describe, it, expect } from 'vitest';
import {
  COMISSAO_ZELLA_RATE,
  UPSELL_TYPES_CATALOG,
  calcularComissaoZehla,
  criarUpsell,
  listarUpsells,
  calcularMetricasUpsell,
  confirmarUpsell,
  cancelarUpsell,
  marcarComoPago,
  gerarSugestaoUpsell,
  EXPLICACAO_UPSELL,
  type UpsellType,
} from '@/lib/upsell/upsell-engine';

describe('UPSELL Engine — Constantes e catálogo', () => {
  it('COMISSAO_ZELLA_RATE é 7% (0.07)', () => {
    expect(COMISSAO_ZELLA_RATE).toBe(0.07);
  });

  it('Catálogo tem 15 tipos de UPSELL', () => {
    const tipos = Object.keys(UPSELL_TYPES_CATALOG);
    expect(tipos.length).toBe(15);
  });

  it('Todos os tipos têm label, description, defaultPrice e unitLabel', () => {
    for (const [tipo, info] of Object.entries(UPSELL_TYPES_CATALOG)) {
      expect(info.label).toBeTruthy();
      expect(info.description).toBeTruthy();
      expect(typeof info.defaultPrice).toBe('number');
      expect(info.defaultPrice).toBeGreaterThan(0);
      expect(info.unitLabel).toBeTruthy();
    }
  });

  it('Tipo "late_checkout" tem preço padrão R$ 50', () => {
    expect(UPSELL_TYPES_CATALOG.late_checkout.defaultPrice).toBe(50);
  });

  it('Tipo "massagem" tem preço padrão R$ 150', () => {
    expect(UPSELL_TYPES_CATALOG.massagem.defaultPrice).toBe(150);
  });

  it('Tipo "spa_day" é o mais caro (R$ 250)', () => {
    expect(UPSELL_TYPES_CATALOG.spa_day.defaultPrice).toBe(250);
  });
});

describe('UPSELL Engine — calcularComissaoZehla', () => {
  it('Calcula 7% sobre R$ 200 = R$ 14', () => {
    expect(calcularComissaoZehla(200)).toBe(14);
  });

  it('Calcula 7% sobre R$ 1000 = R$ 70', () => {
    expect(calcularComissaoZehla(1000)).toBe(70);
  });

  it('Calcula 7% sobre R$ 50,50 = R$ 3,54', () => {
    expect(calcularComissaoZehla(50.50)).toBe(3.54);
  });

  it('Retorna 0 para valores negativos ou zero', () => {
    expect(calcularComissaoZehla(0)).toBe(0);
    expect(calcularComissaoZehla(-100)).toBe(0);
  });

  it('Aceita taxa customizada (não usa default 7%)', () => {
    expect(calcularComissaoZehla(100, 0.10)).toBe(10); // 10%
    expect(calcularComissaoZehla(100, 0)).toBe(0); // 0% (valores normais)
  });
});

describe('UPSELL Engine — criarUpsell', () => {
  it('Cria UPSELL de late checkout (4 horas × R$ 50)', async () => {
    const record = await criarUpsell({
      tenantId: 'test_tenant',
      roomId: 'room_1',
      type: 'late_checkout',
      quantity: 4,
      unitPrice: 50,
      suggestedByZehla: true,
    });

    expect(record).not.toBeNull();
    if (record) {
      expect(record.type).toBe('late_checkout');
      expect(record.quantity).toBe(4);
      expect(record.unitPrice).toBe(50);
      expect(record.totalPrice).toBe(200);
      expect(record.comissionRate).toBe(0.07);
      expect(record.comissionAmount).toBe(14);
      expect(record.status).toBe('pending');
      expect(record.suggestedByZehla).toBe(true);
    }
  });

  it('Cria UPSELL com valores default do catálogo', async () => {
    const record = await criarUpsell({
      tenantId: 'test_tenant',
      type: 'massagem',
    });

    expect(record).not.toBeNull();
    if (record) {
      expect(record.unitPrice).toBe(150); // default
      expect(record.totalPrice).toBe(150);
      expect(record.comissionAmount).toBe(10.5); // 7% de 150
    }
  });

  it('Calcula comissão para café premium 3 diárias × R$ 35 = R$ 105', async () => {
    const record = await criarUpsell({
      tenantId: 'test_tenant',
      type: 'cafe_premium',
      quantity: 3,
      unitPrice: 35,
    });

    expect(record).not.toBeNull();
    if (record) {
      expect(record.totalPrice).toBe(105);
      expect(record.comissionAmount).toBe(7.35); // 7% de 105
    }
  });

  it('Marca feriado e temporada quando informados', async () => {
    const record = await criarUpsell({
      tenantId: 'test_tenant',
      type: 'late_checkout',
      feriado: 'Réveillon',
      temporada: 'alta',
      yieldMultiplier: 2.5,
    });

    expect(record).not.toBeNull();
    if (record) {
      expect(record.feriado).toBe('Réveillon');
      expect(record.temporada).toBe('alta');
      expect(record.yieldMultiplier).toBe(2.5);
    }
  });
});

describe('UPSELL Engine — listar e métricas', () => {
  it('listarUpsells retorna array (mesmo sem DB)', async () => {
    const records = await listarUpsells({ tenantId: 'test_tenant' });
    expect(Array.isArray(records)).toBe(true);
  });

  it('calcularMetricasUpsell retorna estrutura completa', async () => {
    const metrics = await calcularMetricasUpsell({ tenantId: 'test_tenant' });

    expect(metrics).toHaveProperty('total_aceitos');
    expect(metrics).toHaveProperty('total_receita_extra');
    expect(metrics).toHaveProperty('total_comissao_zehla');
    expect(metrics).toHaveProperty('total_comissao_pendente');
    expect(metrics).toHaveProperty('total_comissao_paga');
    expect(metrics).toHaveProperty('por_tipo');
    expect(metrics).toHaveProperty('por_status');
    expect(metrics).toHaveProperty('media_por_reserva');
    expect(Array.isArray(metrics.por_tipo)).toBe(true);
    expect(typeof metrics.total_comissao_zehla).toBe('number');
  });

  it('calcularMetricasUpsell retorna 0 quando não há records', async () => {
    const metrics = await calcularMetricasUpsell({ tenantId: 'test_tenant_vazio' });
    expect(metrics.total_aceitos).toBe(0);
    expect(metrics.total_comissao_zehla).toBe(0);
  });
});

describe('UPSELL Engine — confirmar, cancelar, pagar', () => {
  it('confirmarUpsell não lança erro mesmo sem DB', async () => {
    const result = await confirmarUpsell('upsell_123', 'test_tenant');
    // Sem DB retorna false (não erro)
    expect(typeof result).toBe('boolean');
  });

  it('cancelarUpsell não lança erro mesmo sem DB', async () => {
    const result = await cancelarUpsell('upsell_123', 'test_tenant', 'desistência');
    expect(typeof result).toBe('boolean');
  });

  it('marcarComoPago retorna 0 para lista vazia', async () => {
    const count = await marcarComoPago([], 'test_tenant');
    expect(count).toBe(0);
  });
});

describe('UPSELL Engine — gerarSugestaoUpsell', () => {
  it('Sugere late checkout com texto em PT-BR e valor 4×50 = 200', () => {
    const result = gerarSugestaoUpsell('late_checkout', 'João', {});
    expect(result.type).toBe('late_checkout');
    expect(result.valorSugerido).toBe(200); // 4 horas × 50
    expect(result.texto).toContain('check-out');
    expect(result.texto).toContain('50');
  });

  it('Sugere café premium calculando por diárias', () => {
    const result = gerarSugestaoUpsell('cafe_premium', 'Maria', { diarias: 3 });
    expect(result.valorSugerido).toBe(105); // 3 × 35
    expect(result.texto).toContain('Maria');
    expect(result.texto).toContain('35');
  });

  it('Sugere passeio de barco calculando por grupo', () => {
    const result = gerarSugestaoUpsell('passeio_barco', 'Carlos', { grupoTamanho: 4 });
    expect(result.valorSugerido).toBe(480); // 4 × 120
    expect(result.texto).toContain('480');
  });

  it('Sugere massagem com nome do hóspede', () => {
    const result = gerarSugestaoUpsell('massagem', 'Ana', {});
    expect(result.texto).toContain('Ana');
    expect(result.texto).toContain('massagem');
  });
});

describe('UPSELL Engine — EXPLICACAO_UPSELL', () => {
  it('Contém título e seções explicativas', () => {
    expect(EXPLICACAO_UPSELL.titulo).toBeTruthy();
    expect(EXPLICACAO_UPSELL.o_que_e).toBeTruthy();
    expect(EXPLICACAO_UPSELL.zero_taxa).toBeTruthy();
    expect(EXPLICACAO_UPSELL.comissao_6).toBeTruthy();
    expect(EXPLICACAO_UPSELL.como_descontado).toBeTruthy();
    expect(EXPLICACAO_UPSELL.exemplo).toBeTruthy();
  });

  it('Zero taxa é mencionado explicitamente', () => {
    expect(EXPLICACAO_UPSELL.zero_taxa.toLowerCase()).toContain('zero');
    expect(EXPLICACAO_UPSELL.zero_taxa.toLowerCase()).toContain('100%');
  });

  it('Comissão 7% é mencionada explicitamente', () => {
    expect(EXPLICACAO_UPSELL.comissao_6).toContain('7%');
  });

  it('Exemplo prático contém números coerentes', () => {
    expect(EXPLICACAO_UPSELL.exemplo).toContain('1.050');
    expect(EXPLICACAO_UPSELL.exemplo).toContain('R$ 14');
    expect(EXPLICACAO_UPSELL.exemplo).toContain('R$ 21,35');
  });
});

describe('UPSELL Engine — Cenário completo de exemplo prático', () => {
  it('Cenário do enunciado: 3 diárias + late checkout + café premium', async () => {
    // Hóspede reserva 3 diárias × R$ 350 = R$ 1.050 (valor normal → 0% taxa)
    const valorDiarias = 3 * 350;
    expect(valorDiarias).toBe(1050);

    // Aceita late checkout +4h: R$ 200 (UPSELL → 7% = R$ 14)
    const lateCheckout = await criarUpsell({
      tenantId: 'test_tenant',
      type: 'late_checkout',
      quantity: 4,
      unitPrice: 50,
    });
    expect(lateCheckout?.totalPrice).toBe(200);
    expect(lateCheckout?.comissionAmount).toBe(14);

    // Aceita café premium 3×: R$ 105 (UPSELL → 7% = R$ 7,35)
    const cafePremium = await criarUpsell({
      tenantId: 'test_tenant',
      type: 'cafe_premium',
      quantity: 3,
      unitPrice: 35,
    });
    expect(cafePremium?.totalPrice).toBe(105);
    expect(cafePremium?.comissionAmount).toBe(7.35);

    // Total: R$ 1.355 para a pousada, R$ 21,35 de comissão Zélla
    const totalReceitaPousada = valorDiarias + (lateCheckout?.totalPrice ?? 0) + (cafePremium?.totalPrice ?? 0);
    const totalComissaoZehla = (lateCheckout?.comissionAmount ?? 0) + (cafePremium?.comissionAmount ?? 0);

    expect(totalReceitaPousada).toBe(1355);
    expect(totalComissaoZehla).toBeCloseTo(21.35, 2);

    // Valores normais das diárias têm ZERO taxa
    const comissaoSobreDiarias = calcularComissaoZehla(valorDiarias, 0);
    expect(comissaoSobreDiarias).toBe(0);
  });
});
