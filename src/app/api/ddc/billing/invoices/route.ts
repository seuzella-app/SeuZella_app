import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AsaasBillingService } from '@/lib/billing/asaas';

/**
 * GET /api/ddc/billing/invoices?tenantId=xxx
 *
 * Retorna o extrato de faturas, status de assinatura e links oficiais do Asaas (invoiceUrl, NFS-e)
 * para exibição no painel financeiro do DDC.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId');

  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'MISSING_TENANT_ID' }, { status: 400 });
  }

  try {
    let tenantPlan = 'PARCEIRO';
    let tenantName = 'Minha Pousada';
    let tenantEmail = '';
    let asaasCustomerId: string | null = null;

    if (db) {
      const tenant = await (db as any).tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          email: true,
          plan: true,
          status: true,
          metadata: true,
        },
      });

      if (tenant) {
        tenantPlan = (tenant.plan || 'PARCEIRO').toUpperCase();
        tenantName = tenant.name;
        tenantEmail = tenant.email || '';

        try {
          const meta = JSON.parse(tenant.metadata || '{}');
          asaasCustomerId = meta.asaasCustomerId || null;
        } catch {
          asaasCustomerId = null;
        }
      }
    }

    // Se ainda não tem asaasCustomerId, garante o registro
    if (!asaasCustomerId) {
      asaasCustomerId = await AsaasBillingService.ensureCustomer({
        tenantId,
        name: tenantName,
        email: tenantEmail || `financeiro-${tenantId}@seuzella.com`,
      });
    }

    // Busca faturas diretamente do Asaas
    const invoices = await AsaasBillingService.getTenantInvoices(asaasCustomerId);

    // Identifica se há faturas vencidas (Grace Period)
    const hasOverdue = invoices.some((inv) => inv.status === 'OVERDUE');
    const financialStatus = hasOverdue ? 'OVERDUE' : 'UP_TO_DATE';

    return NextResponse.json({
      success: true,
      data: {
        plan: tenantPlan,
        asaasCustomerId,
        financialStatus,
        invoices: invoices.map((inv) => ({
          id: inv.id,
          value: inv.value,
          dueDate: inv.dueDate,
          status: inv.status,
          billingType: inv.billingType,
          invoiceUrl: inv.invoiceUrl,
          bankSlipUrl: inv.bankSlipUrl,
          description: inv.description,
        })),
      },
    });
  } catch (error: any) {
    console.error('[DDC_BILLING_INVOICES_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', message: error?.message || 'Falha ao buscar faturas.' },
      { status: 500 }
    );
  }
}
