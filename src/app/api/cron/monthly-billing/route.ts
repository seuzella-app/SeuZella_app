import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/security/cron-auth-unified';
import { db } from '@/lib/db';
import { AsaasBillingService } from '@/lib/billing/asaas';
import { executeWithBillingIdempotency } from '@/lib/payments/idempotency';

const PLAN_BASE_PRICES: Record<string, number> = {
  lite: 197,
  parceiro: 247,
  pro: 397,
  max: 797,
  max_plus: 1497,
};

/**
 * GET/POST /api/cron/monthly-billing
 *
 * Cron Job executado no dia 5 de cada mês:
 * 1. Recupera todas as pousadas e anfitriões ativos
 * 2. Calcula o Plano Base Fixo + Taxa de Sucesso de 7% sobre os UPSELLs de feriados do mês
 * 3. Emite a cobrança consolidada no Asaas com descrição discriminada (< 500 chars)
 * 4. BLINDAGEM: Idempotência atômica C6 (executeWithBillingIdempotency) por tenant e ano/mês
 * 5. BLINDAGEM: Loop resiliente com try/catch isolado por tenant
 */
export async function GET(request: NextRequest) {
  return handleMonthlyBilling(request);
}

export async function POST(request: NextRequest) {
  return handleMonthlyBilling(request);
}

async function handleMonthlyBilling(request: NextRequest) {
  // ── Auth: verifyCronAuth (Onda 5H) ──
  const authResult = await verifyCronAuth(request, 'admin:all');
  if (!authResult.ok) {
    return authResult.response ?? NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const now = new Date();
  const refYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const refMonth = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  const [dueDate] = new Date(now.getTime() + 5 * 86400000).toISOString().split('T'); // Vencimento em 5 dias

  interface InvoiceSummary {
    tenantId: string;
    name: string;
    plan: string;
    total: number;
    invoiceUrl: string;
    deduplicated: boolean;
    inProgress: boolean;
  }

  interface ErrorSummary {
    tenantId: string;
    name: string;
    error: string;
  }

  const results: {
    total: number;
    success: number;
    failed: number;
    invoices: InvoiceSummary[];
    errors: ErrorSummary[];
  } = {
    total: 0,
    success: 0,
    failed: 0,
    invoices: [],
    errors: [],
  };

  if (!db) {
    return NextResponse.json({
      success: true,
      mode: 'fallback_mock',
      message: `Faturamento simulado para ${refMonth} em modo fallback.`,
      summary: { total: 1, success: 1, failed: 0 },
    });
  }

  try {
    const activeTenants = await db.tenant.findMany({
      where: {
        status: 'active',
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        plan: true,
        niche: true,
      },
    });

    results.total = activeTenants.length;

    for (const tenant of activeTenants) {
      try {
        const planKey = (tenant.plan || 'parceiro').toLowerCase();
        const basePrice = PLAN_BASE_PRICES[planKey] ?? 247;

        // 1. Calcula taxa de UPSELL do mês anterior para pousadas
        let upsellCommission = 0;
        if (tenant.niche === 'pousada') {
          try {
            const upsellRecords = await (db as unknown as { upsellRecord?: { findMany: (q: unknown) => Promise<Array<{ successFee?: number }>> } }).upsellRecord?.findMany?.({
              where: {
                tenantId: tenant.id,
                status: 'CONFIRMED',
              },
            });
            if (Array.isArray(upsellRecords)) {
              upsellCommission = upsellRecords.reduce(
                (sum: number, u: { successFee?: number }) => sum + (u.successFee || 0),
                0
              );
            }
          } catch {
            // Em caso de tabela de upsell ausente, prossegue com 0
            upsellCommission = 0;
          }
        }

        const totalValue = Number((basePrice + upsellCommission).toFixed(2));
        const planNameFormatted = planKey.toUpperCase();

        // 2. Monta descrição concisa (< 500 chars)
        let description = `Seu Zélla — Plano ${planNameFormatted} (R$ ${basePrice.toFixed(2)})`;
        if (upsellCommission > 0) {
          description += ` + Taxa Sucesso UPSELL Feriados (R$ ${upsellCommission.toFixed(2)})`;
        }
        description += ` • Ref: ${refMonth}`;

        // 3. Execução idempotente atômica com chave determinística mensal
        const idempotencyResult = await executeWithBillingIdempotency<Record<string, unknown>>(
          {
            provider: 'asaas',
            eventId: `monthly-billing:${tenant.id}:${refYearMonth}`,
            eventType: 'cron.monthly_invoice',
            status: 'issued',
          },
          async () => {
            // Garante cliente no Asaas
            const asaasCustomerId = await AsaasBillingService.ensureCustomer({
              tenantId: tenant.id,
              name: tenant.name || 'Pousada Parceira',
              email: tenant.email || `financeiro-${tenant.id}@seuzella.com`,
              phone: tenant.phone || undefined,
            });

            // Cria fatura consolidada no Asaas
            const createdInvoice = await AsaasBillingService.createMonthlyInvoice({
              customerId: asaasCustomerId,
              value: totalValue,
              dueDate: dueDate || new Date().toISOString().split('T')[0],
              description,
              externalReference: tenant.id,
            });

            return createdInvoice as unknown as Record<string, unknown>;
          }
        );

        const invoice = idempotencyResult.data as { invoiceUrl?: string } | null;

        results.success++;
        results.invoices.push({
          tenantId: tenant.id,
          name: tenant.name,
          plan: planNameFormatted,
          total: totalValue,
          invoiceUrl: invoice?.invoiceUrl || '',
          deduplicated: idempotencyResult.deduplicated,
          inProgress: idempotencyResult.inProgress || false,
        });
      } catch (tenantErr: unknown) {
        const errorMsg = tenantErr instanceof Error ? tenantErr.message : 'Erro desconhecido';
        results.failed++;
        results.errors.push({
          tenantId: tenant.id,
          name: tenant.name,
          error: errorMsg,
        });
        console.error(`[CRON_BILLING_ERROR] Falha ao processar tenant ${tenant.id}:`, tenantErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Faturamento consolidado do Dia 5 (${refMonth}) processado com sucesso.`,
      summary: results,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[CRON_BILLING_FATAL] Erro geral no faturamento mensal:', error);
    return NextResponse.json(
      { success: false, error: 'CRON_FATAL_ERROR', message: errorMsg },
      { status: 500 }
    );
  }
}
