/**
 * Faturamento Zélla — Agregador de Comissões UPSELL (7%) de TODAS as pousadas
 * ============================================================================
 *
 * Visão administrativa da seuzella.com:
 *   - Agrega comissão 7% de TODAS as pousadas cadastradas (todos os tenants)
 *   - Calcula faturamento mensal da seuzella.com
 *   - Lista pousadas com maior contribuição
 *   - Gera cobrança mensal automática (cartão de crédito via Mercado Pago) para cada tenant
 *
 * Modelo:
 *   - 0% sobre valores normais das diárias (dia a dia)
 *   - 7% sobre valores de UPSELL (serviços extras sugeridos pela IA Zélla)
 *
 * Faturamento mensal = Σ (totalPrice * 0.07) para cada UpsellRecord.confirmado
 * ============================================================================
 */

import { db } from '@/lib/db';
import {
  COMISSAO_ZELLA_RATE,
  type UpsellType,
  type UpsellStatus,
} from '@/lib/upsell/upsell-engine';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
export interface FaturamentoMensalZehla {
  mes: number; // 1-12
  ano: number;
  total_comissao: number; // total creditado à seuzella.com
  total_receita_gerada: number; // total de UPSELLs (antes da comissão)
  total_upsells: number; // número de UPSELLs confirmados
  total_pousadas_ativas: number; // pousadas com pelo menos 1 UPSELL no mês
  media_por_pousada: number;
  projecao_anual: number; // 12× o mês atual (estimativa conservadora)
  por_tipo: Array<{
    type: UpsellType;
    count: number;
    total_receita: number;
    comissao: number;
  }>;
  top_pousadas: Array<{
    tenantId: string;
    tenantName?: string;
    total_upsells: number;
    total_comissao: number;
  }>;
}

export interface FaturaTenant {
  tenantId: string;
  tenantName?: string;
  tenantEmail?: string;
  mes: number;
  ano: number;
  upsells_count: number;
  total_receita_extra: number; // receita extra para a pousada
  comissao_zehla: number; // 7% a pagar à seuzella.com
  comissao_rate: number; // 0.07
  status: 'pendente' | 'paga' | 'vencida';
  vencimento: string; // ISO date
  itens: Array<{
    type: UpsellType;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    comissionAmount: number;
    createdAt: string;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// FATURAMENTO MENSAL DA seuzella.com — agrega todos os tenants
// ─────────────────────────────────────────────────────────────────────────────
export async function calcularFaturamentoMensalZehla(
  mes: number,
  ano: number,
): Promise<FaturamentoMensalZehla> {
  const empty: FaturamentoMensalZehla = {
    mes,
    ano,
    total_comissao: 0,
    total_receita_gerada: 0,
    total_upsells: 0,
    total_pousadas_ativas: 0,
    media_por_pousada: 0,
    projecao_anual: 0,
    por_tipo: [],
    top_pousadas: [],
  };

  try {
    if (!db || !(db as any).upsellRecord) return empty;

    const startDate = new Date(ano, mes - 1, 1);
    const endDate = new Date(ano, mes, 0, 23, 59, 59);

    // Busca todos os UPSELLs confirmados do período (todos os tenants)
    const records = await (db as any).upsellRecord.findMany({
      where: {
        status: { in: ['confirmed', 'paid'] },
        createdAt: { gte: startDate, lte: endDate },
      },
      include: {
        tenant: { select: { id: true, name: true, email: true } },
      },
    });

    if (records.length === 0) return empty;

    // Agregações
    const totalComissao = records.reduce((s: number, r: any) => s + r.comissionAmount, 0);
    const totalReceita = records.reduce((s: number, r: any) => s + r.totalPrice, 0);
    const tenantSet = new Set<string>(records.map((r: any) => r.tenantId));

    // Por tipo
    const porTipoMap = new Map<string, { count: number; total_receita: number; comissao: number }>();
    for (const r of records) {
      const existing = porTipoMap.get(r.type) || { count: 0, total_receita: 0, comissao: 0 };
      existing.count += 1;
      existing.total_receita += r.totalPrice;
      existing.comissao += r.comissionAmount;
      porTipoMap.set(r.type, existing);
    }
    const por_tipo = Array.from(porTipoMap.entries())
      .map(([type, v]) => ({ type: type as UpsellType, ...v }))
      .sort((a, b) => b.comissao - a.comissao);

    // Top pousadas
    const tenantMap = new Map<string, { tenantId: string; tenantName?: string; total_upsells: number; total_comissao: number }>();
    for (const r of records) {
      const existing = tenantMap.get(r.tenantId) || {
        tenantId: r.tenantId,
        tenantName: r.tenant?.name,
        total_upsells: 0,
        total_comissao: 0,
      };
      existing.total_upsells += 1;
      existing.total_comissao += r.comissionAmount;
      tenantMap.set(r.tenantId, existing);
    }
    const top_pousadas = Array.from(tenantMap.values())
      .sort((a, b) => b.total_comissao - a.total_comissao)
      .slice(0, 20);

    return {
      mes,
      ano,
      total_comissao: Number(totalComissao.toFixed(2)),
      total_receita_gerada: Number(totalReceita.toFixed(2)),
      total_upsells: records.length,
      total_pousadas_ativas: tenantSet.size,
      media_por_pousada: tenantSet.size > 0 ? Number((totalComissao / tenantSet.size).toFixed(2)) : 0,
      projecao_anual: Number((totalComissao * 12).toFixed(2)),
      por_tipo,
      top_pousadas,
    };
  } catch (err) {
    console.error('[FATURAMENTO_ZELLA] calcularFaturamentoMensalZehla falhou:', err);
    return empty;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FATURA INDIVIDUAL POR TENANT — para cobrança mensal
// ─────────────────────────────────────────────────────────────────────────────
export async function gerarFaturaTenant(
  tenantId: string,
  mes: number,
  ano: number,
): Promise<FaturaTenant | null> {
  try {
    if (!db || !(db as any).upsellRecord) return null;

    const startDate = new Date(ano, mes - 1, 1);
    const endDate = new Date(ano, mes, 0, 23, 59, 59);

    const [records, tenant] = await Promise.all([
      (db as any).upsellRecord.findMany({
        where: {
          tenantId,
          status: { in: ['confirmed', 'paid'] },
          createdAt: { gte: startDate, lte: endDate },
        },
        orderBy: { createdAt: 'asc' },
      }),
      (db as any).tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, email: true },
      }),
    ]);

    if (records.length === 0) return null;

    const totalReceitaExtra = records.reduce((s: number, r: any) => s + r.totalPrice, 0);
    const comissaoZehla = records.reduce((s: number, r: any) => s + r.comissionAmount, 0);
    // Vencimento: dia 10 do mês seguinte
    const vencimento = new Date(ano, mes, 10);

    return {
      tenantId,
      tenantName: tenant?.name,
      tenantEmail: tenant?.email,
      mes,
      ano,
      upsells_count: records.length,
      total_receita_extra: Number(totalReceitaExtra.toFixed(2)),
      comissao_zehla: Number(comissaoZehla.toFixed(2)),
      comissao_rate: COMISSAO_ZELLA_RATE,
      status: comissaoZehla > 0 ? 'pendente' : 'paga',
      vencimento: vencimento.toISOString(),
      itens: records.map((r: any) => ({
        type: r.type as UpsellType,
        quantity: r.quantity,
        unitPrice: r.unitPrice,
        totalPrice: r.totalPrice,
        comissionAmount: r.comissionAmount,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  } catch (err) {
    console.error('[FATURAMENTO_ZELLA] gerarFaturaTenant falhou:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LISTA TODOS OS TENANTS COM FATURAMENTO DO MÊS — para visão administrativa
// ─────────────────────────────────────────────────────────────────────────────
export async function listarFaturasMes(
  mes: number,
  ano: number,
): Promise<Array<FaturaTenant & { calculatedAt: string }>> {
  try {
    if (!db || !(db as any).tenant) return [];

    // Busca todos os tenants ativos
    const tenants = await (db as any).tenant.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, email: true },
    });

    const faturas: Array<FaturaTenant & { calculatedAt: string }> = [];
    const now = new Date().toISOString();

    for (const t of tenants) {
      const fatura = await gerarFaturaTenant(t.id, mes, ano);
      if (fatura && fatura.upsells_count > 0) {
        faturas.push({ ...fatura, calculatedAt: now });
      }
    }

    // Ordena por comissão (maior primeiro)
    return faturas.sort((a, b) => b.comissao_zehla - a.comissao_zehla);
  } catch (err) {
    console.error('[FATURAMENTO_ZELLA] listarFaturasMes falhou:', err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COBRANÇA AUTOMÁTICA — gera registro de cobrança mensal
// ─────────────────────────────────────────────────────────────────────────────
export interface CobrancaMensal {
  tenantId: string;
  tenantName?: string;
  mes: number;
  ano: number;
  valor: number; // comissão Zélla a pagar
  vencimento: string;
  status: 'pendente' | 'paga' | 'vencida';
  metodo: 'cartao' | 'boleto';
  // Gateway de pagamento (Mercado Pago)
  gateway: 'mercadopago' | 'infinitypay';
}

export async function gerarCobrancasMensais(
  mes: number,
  ano: number,
): Promise<{
  total_a_receber: number;
  total_tenants: number;
  cobrancas: CobrancaMensal[];
}> {
  try {
    const faturas = await listarFaturasMes(mes, ano);
    const gateway = (process.env.PAYMENT_GATEWAY as 'mercadopago' | 'infinitypay') || 'mercadopago';

    const cobrancas: CobrancaMensal[] = faturas.map((f) => ({
      tenantId: f.tenantId,
      tenantName: f.tenantName,
      mes: f.mes,
      ano: f.ano,
      valor: f.comissao_zehla,
      vencimento: f.vencimento,
      status: f.status,
      metodo: 'cartao',
      gateway,
    }));

    const totalAReceber = cobrancas.reduce((s, c) => s + c.valor, 0);

    return {
      total_a_receber: Number(totalAReceber.toFixed(2)),
      total_tenants: cobrancas.length,
      cobrancas,
    };
  } catch (err) {
    console.error('[FATURAMENTO_ZELLA] gerarCobrancasMensais falhou:', err);
    return { total_a_receber: 0, total_tenants: 0, cobrancas: [] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
export function formatarPeriodo(mes: number, ano: number): string {
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  return `${meses[mes - 1]} ${ano}`;
}

export function formatarBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
