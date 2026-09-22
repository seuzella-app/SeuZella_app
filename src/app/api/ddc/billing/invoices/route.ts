import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AsaasBillingService } from '@/lib/billing/asaas';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

/**
 * GET /api/ddc/billing/invoices
 *
 * Retorna o extrato de faturas, status de assinatura e links oficiais do Asaas (invoiceUrl, NFS-e)
 * para exibição no painel financeiro do DDC.
 *
 * Wave B IDOR fix: tenantId now derived from session, NOT from query param.
 */
export async function GET(request: NextRequest) {
  // RUN14-A (W2): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(request, 'ddc.billing.invoices', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN14-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:ddc.billing.invoices', what: 'ddc.billing.invoices.entry', resource: 'api', result: 'ALLOW' });
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
  const tenantId = (session.user as any).tenantId;
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
