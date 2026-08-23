// src/lib/finance/tax-calculator.ts

export interface FinancialBreakdownInput {
  grossRevenue: number;          // Receita Bruta Total
  activeTenants: number;         // Base ativa de pousadas
  paidReservationsVolume: number; // Volume total de transações de reservas
}

export interface FinancialBreakdownResult {
  grossRevenue: number;
  simplesNacionalTax: number;    // Imposto 6%
  gatewayFees: number;           // Taxas Asaas e Mercado Pago
  cogsVariable: number;          // Custos diretos (Meta API + LLMs)
  opexFixed: number;             // Custos fixos estruturais
  totalExpenses: number;
  netOperatingProfit: number;    // Lucro Líquido Real
  netMarginPct: number;          // Margem Líquida %
}

export class FinancialCalculator {
  // Constantes de Operação Real
  private static readonly SIMPLES_NACIONAL_RATE = 0.06; // 6% Anexo III
  private static readonly COGS_PER_TENANT = 45.00;      // R$ 45,00/mês
  private static readonly OPEX_FIXED = 8230.00;         // R$ 3.230 OPEX + R$ 5.000 Google Ads

  public static calculateDRE(input: FinancialBreakdownInput): FinancialBreakdownResult {
    const { grossRevenue, activeTenants, paidReservationsVolume } = input;

    // 1. Imposto Simples Nacional (6%)
    const simplesNacionalTax = grossRevenue * this.SIMPLES_NACIONAL_RATE;

    // 2. Custos de Gateway (Média R$ 2,50 por cobrança Asaas emitida + split Mercado Pago)
    const gatewayFees = activeTenants * 2.50 + paidReservationsVolume * 0.99;

    // 3. Custos Variáveis de Infraestrutura / IA (COGS)
    const cogsVariable = activeTenants * this.COGS_PER_TENANT;

    // 4. Custo Fixo Total
    const opexFixed = this.OPEX_FIXED;

    // 5. Consolidação de Despesas e Lucro Líquido
    const totalExpenses = simplesNacionalTax + gatewayFees + cogsVariable + opexFixed;
    const netOperatingProfit = grossRevenue - totalExpenses;
    const netMarginPct = grossRevenue > 0 ? (netOperatingProfit / grossRevenue) * 100 : 0;

    return {
      grossRevenue,
      simplesNacionalTax,
      gatewayFees,
      cogsVariable,
      opexFixed,
      totalExpenses,
      netOperatingProfit,
      netMarginPct: Math.round(netMarginPct * 10) / 10,
    };
  }
}
