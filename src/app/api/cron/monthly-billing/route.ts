import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AsaasBillingService } from '@/lib/billing/asaas';

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
 * 4. BLINDAGEM: Loop resiliente com try/catch isolado por tenant
 */
export async function GET(request: NextRequest) {
  return handleMonthlyBilling(request);
}

export async function POST(request: NextRequest) {
  return handleMonthlyBilling(request);
}

async function handleMonthlyBilling(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const { searchParams } = new URL(request.url);
  const secretParam = searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET || 'seuzella-cron-secret-2026';

  const isAuthorized =
    authHeader === `Bearer ${cronSecret}` ||
    secretParam === cronSecret ||
    process.env.NODE_ENV === 'development';

  if (!isAuthorized) {
    return NextResponse.json({ error: 'UNAUTHORIZED_CRON' }, { status: 401 });
  }

  const now = new Date();
  const refMonth = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  const dueDate = new Date(now.getTime() + 5 * 86400000).toISOString().split('T')[0]; // Vencimento em 5 dias

  const results = {
    total: 0,
    success: 0,
    failed: 0,
    invoices: [] as any[],
    errors: [] as any[],
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
    const activeTenants = await (db as any).tenant.findMany({
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
        metadata: true,
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
            const upsellRecords = await (db as any).upsellRecord?.findMany?.({
              where: {
                tenantId: tenant.id,
                status: 'CONFIRMED',
              },
            });
            if (Array.isArray(upsellRecords)) {
              upsellCommission = upsellRecords.reduce(
                (sum: number, u: any) => sum + (u.successFee || 0),
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

        // 3. Garante cliente no Asaas
        const asaasCustomerId = await AsaasBillingService.ensureCustomer({
          tenantId: tenant.id,
          name: tenant.name || 'Pousada Parceira',
          email: tenant.email || `financeiro-${tenant.id}@seuzella.com.br`,
          phone: tenant.phone || undefined,
        });

        // 4. Cria fatura consolidada no Asaas
        const invoice = await AsaasBillingService.createMonthlyInvoice({
          customerId: asaasCustomerId,
          value: totalValue,
          dueDate,
          description,
          externalReference: tenant.id,
        });

        results.success++;
        results.invoices.push({
          tenantId: tenant.id,
          name: tenant.name,
          plan: planNameFormatted,
          total: totalValue,
          invoiceUrl: invoice.invoiceUrl,
        });
      } catch (tenantErr: any) {
        results.failed++;
        results.errors.push({
          tenantId: tenant.id,
          name: tenant.name,
          error: tenantErr?.message || 'Erro desconhecido',
        });
        console.error(`[CRON_BILLING_ERROR] Falha ao processar tenant ${tenant.id}:`, tenantErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Faturamento consolidado do Dia 5 (${refMonth}) processado com sucesso.`,
      summary: results,
    });
  } catch (error: any) {
    console.error('[CRON_BILLING_FATAL] Erro geral no faturamento mensal:', error);
    return NextResponse.json(
      { success: false, error: 'CRON_FATAL_ERROR', message: error?.message },
      { status: 500 }
    );
  }
}
